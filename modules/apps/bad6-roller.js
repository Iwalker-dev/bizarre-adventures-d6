/**
 * BAD6 Contest Roller - Main coordination module
 * Modularized structure for better maintainability
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// Internal modules
import { SYSTEM_ID, CONTEST_FLAG } from "./roller/constants.js";
import {
	resetGambitDefaults,
	createContestState,
	upgradeActionStateToContest,
	getRollOrder
} from "./roller/state.js";
import { findOwner, findRoller, requestStat } from "./roller/participant-selection.js";
import { buildContestHtml } from "./roller/render.js";
import {
	registerRollerSocketHandlers,
	executePrepareRollFormulaAsUser,
	executePreparedRollAsUser
} from "./roller/socket-rpc.js";
import {
	initContestMessageStore,
	updateContestMessage,
	updateContestMessageAsGM
} from "./roller/message-store.js";
import { initHandlers, registerChatMessageHook } from "./roller/handlers.js";
import {
	initPrepareFlow,
	prepareOneStep,
	prepareRollFormulaSelection
} from "./roller/prepare-flow.js";
import { executePreparedRoll } from "./roller/execution-flow.js";
import { 
	initResolution,
	updateResultState,
	resolveContest
} from "./roller/resolution.js";

// System utilities
import { statValueToDiceCount } from "../dice.js";
import { canUseLuckMove } from "../luck-moves.js";
import { canViewActorFormula } from "../utils.js";
import {
	showConfirmRollerDialog,
	escapeHtml
} from "../dialog.js";

// ============================================================================
// SOCKET SETUP
// ============================================================================

let socket;

Hooks.once("socketlib.ready", () => {
	socket = registerRollerSocketHandlers(SYSTEM_ID, {
		prepareRollFormula: prepareRollFormulaSelectionViaSocket,
		executePreparedRoll: executePreparedRollViaSocket,
		updateContestMessage: updateContestMessageAsGM
	});
	initContestMessageStore({ socket });
	
	// Initialize handler and resolution modules with dependencies
	initHandlers({
		prepareOneStep,
		resolveContest,
		updateContestMessage,
		resolveActorFromUuidSync,
		resolveActorFromSpeaker
	});

	initPrepareFlow({
		findRoller,
		requestStat
	});
	
	initResolution({
		findOwner,
		updateContestMessage,
		executePrepareRollFormulaAsUser,
		executePreparedRollAsUser
	});
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Resolve an Actor from a UUID without async calls.
 * @param {string|null|undefined} uuid
 * @returns {Actor|null}
 */
function resolveActorFromUuidSync(uuid) {
	if (!uuid || typeof uuid !== "string") return null;
	const doc = fromUuidSync(uuid);
	if (doc instanceof Actor) return doc;
	return null;
}

/**
 * Resolve an Actor from a speaker.
 * @param {object|null|undefined} speaker
 * @returns {Actor|null}
 */
function resolveActorFromSpeaker(speaker) {
	const actorId = speaker?.actor;
	if (!actorId) return null;
	return game.actors?.get(actorId) || null;
}

// ============================================================================
// SOCKET HANDLERS
// ============================================================================

/**
 * Socket wrapper for formula preparation.
 * @returns {Promise<{formula:string,useFudge:boolean,useGambitForFudge:boolean}|null>}
 */
async function prepareRollFormulaSelectionViaSocket(actorId, baseFormula, statKey, statLabel, advantage, data, useFudge = false, gambitForFudge = false, showFudge = true, fudgeLockReason = "", context = "", luckActorUuid = null) {
	return prepareRollFormulaSelection(actorId, baseFormula, statKey, statLabel, advantage, data, useFudge, gambitForFudge, showFudge, fudgeLockReason, context, luckActorUuid);
}

/**
 * Socket wrapper for executing a prepared formula roll.
 * @returns {Promise<{total:number,snapshot:Object,useFudge:boolean,effectiveAdvantage:number,rollHtml:string}|null>}
 */
async function executePreparedRollViaSocket(actorId, finalFormula, advantage, data, feintCount = 0, gambitForFeint = false, useFudge = false, gambitForFudge = false, suppressMessage = false, luckActorUuid = null) {
	return executePreparedRoll(actorId, finalFormula, advantage, data, feintCount, gambitForFeint, useFudge, gambitForFudge, suppressMessage, luckActorUuid);
}

// ============================================================================
// CONTEST MESSAGE CREATION
// ============================================================================

/**
 * Create a contest message in chat.
 * @param {Object} [options]
 * @param {boolean} [options.forceContest=false]
 * @param {boolean} [options.forceUserSpeaker=false]
 * @returns {Promise<ChatMessage>}
 */
async function createContestMessage({ forceContest = false, forceUserSpeaker = false } = {}) {
	resetGambitDefaults();
	
	let hasReaction = false;
	let gmNarrator = false;
	const targetCount = game.user.targets.size;
	
	if (targetCount > 0) {
		hasReaction = true;
	}
	if (game.user.isGM) {
		if (canvas.tokens.controlled.length < 1) {
			gmNarrator = true;
			hasReaction = false;
		}
		if (canvas.tokens.controlled.length > 1) {
			hasReaction = true;
		}
	}
	if (forceContest) {
		hasReaction = true;
	}
	
	const state = createContestState(hasReaction);
	const rollOrder = getRollOrder(hasReaction);
	const firstStep = rollOrder[0];
	state.nextStep = firstStep;
	updateResultState(state);

	const speaker = (forceUserSpeaker || gmNarrator)
		? { alias: game.user.name }
		: ChatMessage.getSpeaker({ actor: null });
	
	const message = await ChatMessage.create({
		speaker,
		content: buildContestHtml(state),
		flags: {
			[SYSTEM_ID]: {
				[CONTEST_FLAG]: state
			}
		}
	});
	return message;
}

// ============================================================================
// SCENE CONTROL BUTTON
// ============================================================================

let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
const DOUBLE_CLICK_WINDOW_MS = 250;

/**
 * Register the scene control button for the D6 Roller.
 */
export function rollerControl() {
	Hooks.on("getSceneControlButtons", (controls) => {
		const tokenControls = controls.tokens;
		if (!tokenControls) return;

		tokenControls.tools["rollerButton"] = {
			name: "rollerButton",
			title: "D6 Roller",
			icon: "fas fa-dice-d6",
			visible: true,
			button: true,
			order: 50,
			onChange: async () => {
				if (rollerClickTimer) {
					clearTimeout(rollerClickTimer);
					rollerClickTimer = null;
					const now = Date.now();
					const priorId = lastActionMessageId;
					const isDouble = priorId && (now - lastActionMessageAt) <= DOUBLE_CLICK_WINDOW_MS;
					lastActionMessageId = null;
					lastActionMessageAt = 0;
					if (isDouble && priorId) {
						const prior = game.messages.get(priorId);
						const priorState = prior?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
						if (prior && priorState && !priorState.hasReaction) {
							upgradeActionStateToContest(priorState);
							priorState.result = null;
							await updateContestMessage(prior, priorState);
							return;
						}
					}
					await createContestMessage({ forceContest: true, forceUserSpeaker: true });
					return;
				}
				const msg = await createContestMessage({ forceContest: false, forceUserSpeaker: true });
				lastActionMessageId = msg?.id || null;
				lastActionMessageAt = Date.now();
				rollerClickTimer = setTimeout(() => {
					rollerClickTimer = null;
					lastActionMessageId = null;
					lastActionMessageAt = 0;
				}, DOUBLE_CLICK_WINDOW_MS);
			}
		};
	});
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Register the chat message hook
Hooks.once("ready", () => {
	registerChatMessageHook();
});

// ============================================================================
// ENTRYPOINT
// ============================================================================

/**
 * Main entrypoint for the roller.
 * @returns {Promise<ChatMessage>}
 */
async function main() {
	return createContestMessage();
}

export default main;

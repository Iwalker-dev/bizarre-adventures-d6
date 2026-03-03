/**
 * BAD6 Contest Roller - Main coordination module
 * Modularized structure for better maintainability
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// Internal modules
import { SYSTEM_ID, CONTEST_FLAG, CSS_CLASSES, NOTIFICATION_MESSAGES } from "./roller/constants.js";
import {
	rollProcessGambitDefaults,
	resetGambitDefaults,
	getContestStateFromMessage,
	createEmptyRollState,
	createPairState,
	createContestState,
	getRollOrder,
	getFirstUnresolvedStep
} from "./roller/state.js";
import { buildContestHtml } from "./roller/render.js";
import { initHandlers, registerChatMessageHook } from "./roller/handlers.js";
import { 
	initResolution,
	updateResultState,
	prepareOneStep,
	prepareRollFormulaSelection,
	executePreparedRoll,
	resolveContest
} from "./roller/resolution.js";

// System utilities
import { statValueToDiceCount, prepareFormula, buildRollSnapshot, playDiceAnimation } from "../dice.js";
import { spendLuckMove, canUseLuckMove } from "../luck-moves.js";
import { canViewActorFormula } from "../utils.js";
import {
	showChoiceDialog,
	showRollReadyDialog,
	showConfirmRollerDialog,
	getActorDisplayName,
	showStatDialog,
	escapeHtml
} from "../dialog.js";
import { isDebugEnabled } from "../config.js";

// ============================================================================
// SOCKET SETUP
// ============================================================================

let socket;

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem(SYSTEM_ID);
	socket.register("pCheck", readyCheck);
	socket.register("prepareRollFormula", prepareRollFormulaSelectionViaSocket);
	socket.register("executePreparedRoll", executePreparedRollViaSocket);
	socket.register("updateContestMessage", updateContestMessageAsGM);
	
	// Initialize handler and resolution modules with dependencies
	initHandlers({
		prepareOneStep,
		resolveContest,
		updateContestMessage,
		resolveActorFromUuidSync,
		resolveActorFromSpeaker
	});
	
	initResolution({
		socket,
		findOwner,
		findRoller,
		requestStat,
		updateContestMessage,
		convDC,
		convHit
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

/**
 * Convert a DC total to a label.
 * @param {number} value
 * @returns {string}
 */
function convDC(value) {
	const map = {
		0: "Trivial",
		1: "Easy",
		2: "Challenging",
		3: "Dire",
		4: "Herculean",
		5: "Extraordinary",
		6: "Superhuman",
		7: "Unbelievable",
		8: "Surreal",
		9: "Absurd",
		10: "Nigh-Impossible",
		11: "Nigh-Impossible",
		12: "Nigh-Impossible",
		13: "Nigh-Impossible",
		14: "Nigh-Impossible"

	};
	return map[value] || "Impossible";
}

/**
 * Convert hit difference to a severity label.
 * @param {number} value
 * @returns {string}
 */
function convHit(value) {
	const map = {
		0: "Clash!",
		1: "Minor",
		2: "Moderate",
		3: "Serious",
		4: "Debilitating",
		5: "Critical",
		6: "Macabre"
	};
	if (value > 6) return "Grindhouse";
	return map[value] || "Invalid Hit";
}

/**
 * Helper to find a non-GM owner or fallback to GM.
 * @param {Actor} actor
 * @returns {User|undefined}
 */
function findOwner(actor) {
	return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ||
		game.users.find(u => u.isGM);
}

/**
 * Request a stat selection from the user.
 * @param {Actor} actor
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
function requestStat(actor, options = {}) {
	return showStatDialog(actor, options);
}

// ============================================================================
// ACTOR SELECTION
// ============================================================================

/**
 * Resolve which actor will roll, with linked-actor selection as needed.
 * @param {number} i
 * @param {boolean} [reaction=false]
 * @returns {Promise<Actor|null>}
 */
async function findRoller(i, reaction = false) {
	if (game.user.isGM) {
		if (isDebugEnabled()) {
			console.warn("BAD6 | reaction:", reaction);
		}
		let token;
		let roller;
		// Roll the same actor for both rolls if only one token is selected
		if (canvas.tokens.controlled.length === 1) i = 0;
		token = canvas.tokens.controlled[i];
		if (!token) {
			ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
			return null;
		}
		roller = token.actor;
		// If there are valid remaining targets, use them instead
		if (reaction) {
			if (game.user.targets.size > 0) {
				// Roll the same reactor for both rolls if only one token is selected
				if (game.user.targets.size === 1) i = 0;
				token = Array.from(game.user.targets)[i];
				if (!token) {
					ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
					return null;
				}
				roller = token.actor;
			} else {
				// No targets: fall back to additional controlled tokens
				if (canvas.tokens.controlled.length === 1) i = 0;
				token = canvas.tokens.controlled[i];
				if (!token) {
					ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
					return null;
				}
				roller = token.actor;
			}
		}
		if (isDebugEnabled()) {
			console.warn("BAD6 | Roller chosen:", roller.name);
		}
		// Check for linked actors
		return new Promise(async (resolve) => {
			const linkedActors = roller.system.bio.linkedActors?.value || [];
			if (isDebugEnabled()) {
				console.warn("BAD6 | Linked actors:", linkedActors);
			}
			if (linkedActors.length === 0) {
				ui.notifications.warn("No linked abilities found. Defaulting to original roller.");
				return resolve(roller);
			}
			const rollerDisplayName = getActorDisplayName(roller);
			let buttons = {
				[roller.id]: {
					label: rollerDisplayName,
					callback: () => roller
				}
			};
			// Fetch each linked actor and create a button
			for (let linked of linkedActors) {
				const actor = await fromUuid(linked.uuid);
				if (actor) {
					const displayName = getActorDisplayName(actor);
					buttons[linked.uuid] = {
						label: `${displayName} (${linked.type})`,
						callback: () => actor
					};
				}
			}
			const choice = await showChoiceDialog({
				title: "Choose Roller",
				content: "<p>Select an ability to use:</p>",
				buttons,
				defaultId: Object.keys(buttons)[0],
				closeValue: null
			});
			resolve(choice || null);
		});
	}
	const owned = game.actors.filter(a => a.isOwner);
	if (owned.length === 0) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.NO_OWNED_ACTORS);
		return null;
	}
	if (owned.length === 1) return owned[0];

	return new Promise(async resolve => {
		const buttons = {};
		for (let a of owned) {
			const displayName = getActorDisplayName(a);
			buttons[a.id] = {
				label: displayName,
				callback: () => a
			};
		}
		const choice = await showChoiceDialog({
			title: "Choose an Actor",
			content: "<p>Select an actor:</p>",
			buttons,
			defaultId: Object.keys(buttons)[0],
			closeValue: null
		});
		resolve(choice || null);
	});
}

// ============================================================================
// SOCKET HANDLERS
// ============================================================================

/**
 * GM-run ready check on behalf of a player.
 * @param {string} actorId
 * @param {string} baseFormula
 * @param {string} statKey
 * @param {string} statLabel
 * @param {number} advantage
 * @param {Object} data
 * @param {number} [feintCount=0]
 * @param {boolean} [useFudge=false]
 * @param {boolean} [gambitForFeint=false]
 * @param {boolean} [gambitForFudge=false]
 * @param {boolean} [showFudge=true]
 * @param {string} [fudgeLockReason=""]
 * @param {boolean} [suppressMessage=false]
 * @param {string|null} [luckActorUuid=null]
 * @returns {Promise<{total:number,snapshot:Object,useFudge:boolean,effectiveAdvantage:number,rollHtml:string}|null>}
 */
async function readyCheck(actorId, baseFormula, statKey, statLabel, advantage, data, feintCount = 0, useFudge = false, gambitForFeint = false, gambitForFudge = false, showFudge = true, fudgeLockReason = "", suppressMessage = false, luckActorUuid = null) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;
	const luckActor = luckActorUuid ? await fromUuid(luckActorUuid) : actor;

	const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
	const formulaResult = await prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge, gambitForFudge, showFudge, fudgeLockReason, "", luckActorUuid);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	rollProcessGambitDefaults.fudge = !!formulaResult?.useGambitForFudge;
	const confirmed = await showRollReadyDialog({
		statLabel,
		advantagePhrase,
		formula: finalFormula
	});
	if (!confirmed) return null;

	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", gambitForFeint, feintCount, luckActor);
		if (!success && error) {
			ui.notifications.error(error);
		}
	}

	if (useFudge && showFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", rollProcessGambitDefaults.fudge, 0, luckActor);
		if (!success && error) {
			ui.notifications.error(error);
		}
	}

	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });
	const rollHtml = await roll.render();
	if (!suppressMessage) {
		const speaker = ChatMessage.getSpeaker({ actor });
		await roll.toMessage({ speaker });
	}

	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return { total: roll.total, snapshot, useFudge, effectiveAdvantage, rollHtml };
}

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

/**
 * Update contest chat message, routing via GM if needed.
 * @param {ChatMessage|string} message - ChatMessage object or message ID
 * @param {Object} state - State updates to apply
 * @returns {Promise<Object|void>}
 */
async function updateContestMessage(message, state) {
	const messageId = typeof message === 'string' ? message : message.id;
	
	if (game.user.isGM) {
		const freshMessage = game.messages.get(messageId);
		if (!freshMessage) {
			console.warn(`BAD6 | Cannot update contest message: message ${messageId} not found.`);
			return;
		}
		
		const freshState = getContestStateFromMessage(freshMessage) || {};
		const mergedState = foundry.utils.mergeObject(freshState, state, { inplace: false });
		
		await freshMessage.setFlag(SYSTEM_ID, CONTEST_FLAG, mergedState);
		await freshMessage.update({ content: buildContestHtml(mergedState) });
		return mergedState;
	}
	if (!socket) {
		console.warn("BAD6 | Socket not ready; cannot update contest message as GM.");
		return;
	}
	await socket.executeAsGM("updateContestMessage", messageId, state);
}

/**
 * GM-side update for contest messages (called via socketlib).
 * @param {string} messageId
 * @param {Object} state
 * @returns {Promise<boolean>}
 */
async function updateContestMessageAsGM(messageId, state) {
	const message = game.messages.get(messageId);
	if (!message) return false;
	
	const freshState = getContestStateFromMessage(message) || {};
	const mergedState = foundry.utils.mergeObject(freshState, state, { inplace: false });
	
	await message.setFlag(SYSTEM_ID, CONTEST_FLAG, mergedState);
	await message.update({ content: buildContestHtml(mergedState) });
	return true;
}

// ============================================================================
// CONTEST MESSAGE CREATION
// ============================================================================

/**
 * Upgrade a single-action contest state into a full contest state.
 * @param {Object} state
 * @returns {Object}
 */
function upgradeActionStateToContest(state) {
	if (!state) return state;
	state.hasReaction = true;
	if (!state.reaction) {
		state.reaction = createPairState();
	}
	state.result = null;
	state.nextStep = "reaction-1";
	return state;
}

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
							const upgraded = upgradeActionStateToContest(priorState);
							await updateContestMessage(prior, upgraded);
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

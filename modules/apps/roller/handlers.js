/**
 * Event handlers for BAD6 contest roller UI.
 */

import { CSS_CLASSES, NOTIFICATION_MESSAGES, STATUS_MESSAGES } from "./constants.js";
import {
	getContestStateFromMessage,
	getQuadrantRoll,
	parseQuadrant,
	clearPreparedRoll,
	getFirstUnresolvedStep,
	applyPreparedToState
} from "./state.js";
import { canViewActorFormula } from "../../utils.js";
import { handleUnreadyAction } from "./unready-action.js";
import { handleFeintAction } from "./feint-action.js";
import { closeContestDialogs } from "./dialog-lifecycle.js";

// Import functions needed from main file (will be defined when we refactor main)
// These will be exported from the main roller file or a resolution module
let prepareOneStep, resolveContest, updateContestMessage, resolveActorFromUuidSync, resolveActorFromSpeaker;
let delegatedClickBound = false;
let contestSyncHookBound = false;

/**
 * Handle a delegated roller button click.
 * @param {MouseEvent} event
 * @returns {Promise<void>}
 */
async function handleDelegatedRollerClick(event) {
	const target = event.target?.closest?.(`button.${CSS_CLASSES.ROLL_BTN}, button.${CSS_CLASSES.ACTION_BTN}, button[data-action]`);
	if (!target) return;

	const messageEl = target.closest?.("[data-message-id]");
	const messageId = messageEl?.dataset?.messageId || "";
	if (!messageId) return;

	const message = game.messages.get(messageId);
	const contest = getContestStateFromMessage(message);
	if (!contest) return;

	event.preventDefault();

	if (target.classList?.contains(CSS_CLASSES.ROLL_BTN)) {
		const quadrant = target.dataset?.quadrant;
		const parsed = quadrant ? parseQuadrant(quadrant) : null;
		if (!parsed || !["action", "reaction"].includes(parsed.side)) return;
		await handlePrepareClick(messageId, quadrant);
		return;
	}

	const action = target.dataset?.action;
	if (!action) return;
	const quadrant = target.dataset?.quadrant;
	const parsed = quadrant ? parseQuadrant(quadrant) : null;

	if (action === "resolve") {
		await handleResolveClick(messageId);
	} else if (action === "unready" && parsed && ["action", "reaction"].includes(parsed.side)) {
		await handleUnreadyClick(messageId, parsed.side, parsed.rollIndex);
	} else if (action === "feint" && parsed && ["action", "reaction"].includes(parsed.side)) {
		await handleFeintClick(messageId, parsed.side, parsed.rollIndex);
	}
}

/**
 * Initialize handler dependencies.
 * Called from main roller file to inject dependencies.
 * @param {Object} deps
 */
export function initHandlers(deps) {
	prepareOneStep = deps.prepareOneStep;
	resolveContest = deps.resolveContest;
	updateContestMessage = deps.updateContestMessage;
	resolveActorFromUuidSync = deps.resolveActorFromUuidSync;
	resolveActorFromSpeaker = deps.resolveActorFromSpeaker;
}

/**
 * Handle prepare/edit button click.
 * @param {string} messageId
 * @param {string} quadrant
 * @returns {Promise<void>}
 */
export async function handlePrepareClick(messageId, quadrant) {
	const parsed = parseQuadrant(quadrant);
	if (!parsed) return;
	
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;
	
	const { side, rollIndex } = parsed;
	const currentRoll = getQuadrantRoll(state, side, rollIndex);
	
	// If already resolved, can't change
	if (currentRoll?.resolved) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.ROLL_ALREADY_RESOLVED);
		return;
	}
	
	// If prepared, clear it first (edit mode)
	if (currentRoll?.prepared) {
		clearPreparedRoll(state, side, rollIndex);
		state.nextStep = getFirstUnresolvedStep(state);
	}
	
	// Prepare the roll
	const preparedData = await prepareOneStep(side, rollIndex, state, messageId);
	if (!preparedData) return;
	
	// Apply prepared state
	applyPreparedToState(state, side, rollIndex, preparedData);
	state.nextStep = getFirstUnresolvedStep(state);
	
	// Update the message
	const refreshed = game.messages.get(messageId);
	if (refreshed) {
		await updateContestMessage(refreshed, state);
	}
}

/**
 * Handle unready button click.
 * Refunds feint luck if feints were used on this roll.
 * @param {string} messageId
 * @param {string} side
 * @param {number} rollIndex
 * @returns {Promise<void>}
 */
export async function handleUnreadyClick(messageId, side, rollIndex) {
	await handleUnreadyAction({
		messageId,
		side,
		rollIndex,
		updateContestMessage
	});
}

/**
 * Handle feint button click.
 * @param {string} messageId
 * @param {string} side
 * @param {number} rollIndex
 * @returns {Promise<void>}
 */
export async function handleFeintClick(messageId, side, rollIndex) {
	await handleFeintAction({
		messageId,
		side,
		rollIndex,
		prepareOneStep,
		updateContestMessage
	});
}

/**
 * Handle resolve contest button click.
 * @param {string} messageId
 * @returns {Promise<void>}
 */
export async function handleResolveClick(messageId) {
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;
	
	await resolveContest(state, messageId);
}

/**
 * Register the renderChatMessageHTML hook for contest messages.
 */
export function registerChatMessageHook() {
	if (!delegatedClickBound) {
		document.addEventListener("click", handleDelegatedRollerClick);
		delegatedClickBound = true;
	}

	if (!contestSyncHookBound) {
		Hooks.on("updateChatMessage", (message) => {
			const contest = getContestStateFromMessage(message);
			if (!contest?.isResolving) return;
			closeContestDialogs();
		});
		contestSyncHookBound = true;
	}

	Hooks.on("renderChatMessageHTML", (message, html) => {
		const contest = getContestStateFromMessage(message);
		
		if (contest) {
			// Wrap HTMLElement in jQuery for selector compatibility
			const $html = $(html);

			// Hide roll formulas for users without permission
			$html.find(".bad6-roll-card[data-actor-uuid]").each((_, el) => {
				const actorUuid = el?.dataset?.actorUuid || "";
				const actor = resolveActorFromUuidSync(actorUuid);
				if (!canViewActorFormula(actor)) {
					el.innerHTML = `<em>${STATUS_MESSAGES.FORMULA_HIDDEN}</em>`;
				}
			});

			const speakerActor = resolveActorFromSpeaker(message?.speaker);
			if (speakerActor && !canViewActorFormula(speakerActor)) {
				$html.find(".dice-formula").text(STATUS_MESSAGES.FORMULA_HIDDEN);
			}
		}
	});
}

/**
 * Event handlers for BAD6 contest roller UI.
 */

import { CSS_CLASSES, NOTIFICATION_MESSAGES } from "./constants.js";
import {
	getContestStateFromMessage,
	getQuadrantRoll,
	getPairState,
	parseQuadrant,
	clearPreparedRoll,
	getFirstUnresolvedStep,
	applyPreparedToState
} from "./state.js";
import { buildContestHtml } from "./render.js";
import { canViewActorFormula } from "../../utils.js";
import { canUseLuckMove, refundLuckMove } from "../../luck-moves.js";
import { showFeintGambitDialog } from "../../dialog.js";

// Import functions needed from main file (will be defined when we refactor main)
// These will be exported from the main roller file or a resolution module
let prepareOneStep, resolveContest, updateContestMessage, resolveActorFromUuidSync, resolveActorFromSpeaker;

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
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;
	
	// Get the roll data before clearing it
	const rollData = getQuadrantRoll(state, side, rollIndex);
	
	// If this roll had feints, refund the luck
	if (rollData && rollData.feintCount > 0) {
		const actor = rollData.actorUuid ? await fromUuid(rollData.actorUuid) : null;
		const luckActor = rollData.luckActorUuid ? await fromUuid(rollData.luckActorUuid) : actor;
		
		if (actor && luckActor) {
			// Get the gambit selections for this roll's feints
			const useGambit = rollData.gambitSelections?.feint || false;
			
			const refundResult = await refundLuckMove(actor, "feint", useGambit, rollData.feintCount, luckActor);
			
			if (refundResult.success) {
				if (refundResult.capped) {
					ui.notifications.warn(NOTIFICATION_MESSAGES.LUCK_REFUNDED_CAPPED);
				}
			} else if (refundResult.error) {
				ui.notifications.error(refundResult.error);
			}
		}
	}
	
	// Reset the roll and advantage locks for this side
	clearPreparedRoll(state, side, rollIndex);
	// Reset side-wide advantage lock
	const pairState = getPairState(state, side);
	if (pairState) {
		pairState.advantage = null;
		pairState.advantageChosenBy = null;
	}
	state.nextStep = getFirstUnresolvedStep(state);
	state.result = null;
	await updateContestMessage(latest, state);
}

/**
 * Handle feint button click.
 * @param {string} messageId
 * @param {string} side
 * @param {number} rollIndex
 * @returns {Promise<void>}
 */
export async function handleFeintClick(messageId, side, rollIndex) {
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;

	const currentRoll = getQuadrantRoll(state, side, rollIndex);
	if (!currentRoll) return;

	// Capture pre-dialog snapshot
	const snapshotActorUuid = currentRoll.actorUuid;
	const snapshotFeintCounter = currentRoll.feintCounter || 0;

	// Prepare the new roll (opens stat dialog without feint counter)
	const preparedData = await prepareOneStep(side, rollIndex, state, messageId, true);
	
	if (!preparedData) {
		// Dialog was cancelled
		const cancelledMessage = game.messages.get(messageId);
		if (cancelledMessage) {
			const cancelledState = getContestStateFromMessage(cancelledMessage);
			if (cancelledState) await updateContestMessage(cancelledMessage, cancelledState);
		}
		return;
	}

	// Show feint gambit dialog
	const gambitResult = await showFeintGambitDialog({
		gambitDefault: !!preparedData.gambitSelections?.feint
	});

	if (gambitResult === null) {
		// Feint was cancelled in gambit dialog
		const cancelledMessage = game.messages.get(messageId);
		if (cancelledMessage) {
			const cancelledState = getContestStateFromMessage(cancelledMessage);
			if (cancelledState) await updateContestMessage(cancelledMessage, cancelledState);
		}
		return;
	}

	// Run failsafe checks
	const freshMessage = game.messages.get(messageId);
	const freshState = getContestStateFromMessage(freshMessage);
	if (!freshState) {
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_DELETED);
		return;
	}

	const freshRoll = getQuadrantRoll(freshState, side, rollIndex);
	if (!freshRoll) {
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_MISSING);
		return;
	}
	if (freshRoll.resolved) {
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_RESOLVED);
		return;
	}
	if (freshRoll.actorUuid !== snapshotActorUuid) {
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_ACTOR);
		return;
	}

	// When feinting, clear the advantage lock so the new action can have a different advantage
	const freshPair = getPairState(freshState, side);
	if (freshPair) {
		freshPair.advantage = null;
		freshPair.advantageChosenBy = null;
	}

	// Apply feint flags
	preparedData.isFeinting = true;
	preparedData.feintCounter = snapshotFeintCounter + 1;
	preparedData.gambitSelections = { feint: gambitResult.useGambit };

	applyPreparedToState(freshState, side, rollIndex, preparedData);
	
	// Update the other roll in the pair to use the new advantage
	const otherRollIndex = rollIndex === 1 ? 2 : 1;
	const otherRoll = getQuadrantRoll(freshState, side, otherRollIndex);
	if (otherRoll && otherRoll.prepared && !otherRoll.resolved) {
		// Update the other roll's advantage to match the new pair advantage
		const newAdvantage = freshPair?.advantage !== null && freshPair?.advantage !== undefined 
			? freshPair.advantage 
			: Number(preparedData.advantage || 0);
		otherRoll.advantage = newAdvantage;
	}
	
	freshState.nextStep = getFirstUnresolvedStep(freshState);

	const refreshed = game.messages.get(messageId);
	if (refreshed) {
		await updateContestMessage(refreshed, freshState);
	}
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
	Hooks.on("renderChatMessageHTML", (message, html) => {
		const contest = getContestStateFromMessage(message);
		
		if (contest) {
			// Wrap HTMLElement in jQuery for selector compatibility
			const $html = $(html);
			
			// Handler for Prepare/Edit buttons
			$html.find(`button.${CSS_CLASSES.ROLL_BTN}`).on("click", async (event) => {
				event.preventDefault();
				const quadrant = event.currentTarget?.dataset?.quadrant;
				if (!quadrant) return;
				await handlePrepareClick(message.id, quadrant);
			});

			// Handler for action buttons (Unready, Feint, Resolve)
			$html.find(`button.${CSS_CLASSES.ACTION_BTN}, button[data-action]`).on("click", async (event) => {
				event.preventDefault();
				const action = event.currentTarget?.dataset?.action;
				if (!action) return;
				
				const quadrant = event.currentTarget?.dataset?.quadrant;
				const parsed = quadrant ? parseQuadrant(quadrant) : null;
				
				// Route to appropriate handler
				if (action === "resolve") {
					await handleResolveClick(message.id);
				} else if (action === "unready" && parsed) {
					await handleUnreadyClick(message.id, parsed.side, parsed.rollIndex);
				} else if (action === "feint" && parsed) {
					await handleFeintClick(message.id, parsed.side, parsed.rollIndex);
				}
			});

			// Hide roll formulas for users without permission
			$html.find(".bad6-roll-card[data-actor-uuid]").each((_, el) => {
				const actorUuid = el?.dataset?.actorUuid || "";
				const actor = resolveActorFromUuidSync(actorUuid);
				if (!canViewActorFormula(actor)) {
					el.innerHTML = "<em>Formula hidden</em>";
				}
			});

			const speakerActor = resolveActorFromSpeaker(message?.speaker);
			if (speakerActor && !canViewActorFormula(speakerActor)) {
				$html.find(".dice-formula").text("Formula hidden");
			}
		}
	});
}

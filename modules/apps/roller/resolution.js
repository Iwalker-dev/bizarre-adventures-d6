/**
 * Contest resolution logic for BAD6 roller.
 * Handles roll preparation, execution, and post-roll luck moves.
 */

import {
	rollProcessGambitDefaults,
	allQuadrantsPrepared,
	anyQuadrantsResolved,
	getRollOrder,
	applyRollToState,
	getContestStateFromMessage
} from "./state.js";
import { NOTIFICATION_MESSAGES, RESULT_MESSAGES } from "./constants.js";
import { closeContestDialogs } from "./dialog-lifecycle.js";
import { convDC, convHit } from "./result-labels.js";
import { prepareRollFormulaSelection } from "./prepare-flow.js";
import { executePreparedRoll } from "./execution-flow.js";
import {
	beginResolutionTransition,
	abortResolutionTransition,
	completeResolutionTransition
} from "./resolution-status.js";
import { prepareResolutionQueue, executeResolutionQueue } from "./resolution-flow.js";
import { applyPersistResetOutcome, applyClashOutcome } from "./resolution-outcomes.js";
import { handlePostRollLuck } from "./luck-flow.js";
import { 
	spendLuckMove
} from "../../luck-moves.js";
import { 
	showConfirmRollerDialog
} from "../../dialog.js";
// Import dependencies that will be injected
let findOwner, updateContestMessage, executePrepareRollFormulaAsUser, executePreparedRollAsUser;

/**
 * Initialize resolution module dependencies.
 * @param {Object} deps
 */
export function initResolution(deps) {
	findOwner = deps.findOwner;
	updateContestMessage = deps.updateContestMessage;
	executePrepareRollFormulaAsUser = deps.executePrepareRollFormulaAsUser;
	executePreparedRollAsUser = deps.executePreparedRollAsUser;
}

/**
 * Update contest result based on totals.
 * @param {Object} state
 * @returns {void}
 */
export function updateResultState(state) {
	if (!state.hasReaction) {
		if (state.action.total !== null) {
			state.result = {
				type: "dc",
				label: RESULT_MESSAGES.DC_TOTAL(state.action.total, convDC(state.action.total))
			};
		}
		return;
	}
	if (state.action.total === null || state.reaction.total === null) return;
	const diff = Number(state.action.total) - Number(state.reaction.total);
	if (diff === 0) {
		state.result = { type: "clash", label: RESULT_MESSAGES.CLASH };
		return;
	}
	if (diff < 0) {
		state.result = { type: "reaction", label: RESULT_MESSAGES.REACTOR_SUCCEEDS(diff) };
		return;
	}
	state.result = { type: "action", label: RESULT_MESSAGES.ATTACKERS_WIN(convHit(diff), diff) };
}

/**
 * Resolve all prepared rolls in a contest.
 * @param {Object} state
 * @param {string|null} messageId
 * @returns {Promise<void>}
 */
export async function resolveContest(state, messageId) {
	const message = messageId ? game.messages.get(messageId) : null;
	if (!message) return;
	
	// Always read fresh state to prevent race conditions
	const freshState = getContestStateFromMessage(message);
	if (!freshState) {
		ui.notifications.error(NOTIFICATION_MESSAGES.RESOLUTION_STATE_NOT_FOUND);
		return;
	}
	
	if (freshState.isResolving) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.RESOLUTION_ALREADY_IN_PROGRESS);
		return;
	}
	
	// Use fresh state from now on
	state = freshState;
	
	if (!allQuadrantsPrepared(state) || anyQuadrantsResolved(state)) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.RESOLUTION_INVALID_PREPARED_STATE);
		return;
	}

	await beginResolutionTransition({ state, message, updateContestMessage, closeContestDialogs });

	const stagedFudgeBy = {
		action: state.action?.fudgeChosenBy || null,
		reaction: state.reaction?.fudgeChosenBy || null
	};

	const prepPhase = await prepareResolutionQueue({
		state,
		stagedFudgeBy,
		findOwner,
		showConfirmRollerDialog,
		executePrepareRollFormulaAsUser,
		prepareRollFormulaSelection,
		rollProcessGambitDefaults
	});

	if (prepPhase.status === "error") {
		await abortResolutionTransition({
			state,
			message,
			updateContestMessage,
			level: "error",
			text: prepPhase.message
		});
		return;
	}

	if (prepPhase.status === "cancelled") {
		await abortResolutionTransition({
			state,
			message,
			updateContestMessage,
			level: "warn",
			text: NOTIFICATION_MESSAGES.RESOLUTION_CANCELLED_RESTART
		});
		return;
	}

	const execPhase = await executeResolutionQueue({
		state,
		message,
		collectedRolls: prepPhase.collectedRolls,
		executePreparedRollAsUser,
		executePreparedRoll,
		spendLuckMove,
		applyRollToState,
		updateContestMessage
	});

	if (execPhase.status === "error") {
		await abortResolutionTransition({
			state,
			message,
			updateContestMessage,
			level: "error",
			text: execPhase.message
		});
		return;
	}

	if (execPhase.status === "feint-reset") {
		state.isResolving = false;
		return;
	}

	// Handle post-roll luck moves after each pair completes
	for (const side of ["reaction", "action"]) {
		const pair = state[side];
		if (pair.rolls[1]?.resolved && pair.rolls[2]?.resolved) {
			const actor2 = pair.rolls[2]?.actorUuid ? await fromUuid(pair.rolls[2].actorUuid) : null;
			if (actor2) {
				const { resetPair, persistActorName } = await handlePostRollLuck(pair, actor2, {
					state,
					side,
					messageId
				});
				
				if (resetPair) {
					await applyPersistResetOutcome({
						state,
						side,
						pair,
						persistActorName,
						actorForSpeaker: actor2,
						message,
						updateContestMessage
					});
					return;
				}
			}
		}
	}

	// Update final result
	updateResultState(state);
	
	if (await applyClashOutcome({ state, message, updateContestMessage })) {
		return;
	}
	
	await completeResolutionTransition({ state, message, updateContestMessage });
}

/**
 * Feint action flow for prepared rolls.
 */

import { NOTIFICATION_MESSAGES } from "./constants.js";
import {
	getContestStateFromMessage,
	getQuadrantRoll,
	clearPairAdvantage,
	getFirstUnresolvedStep,
	applyPreparedToState
} from "./state.js";
import { showFeintGambitDialog } from "../../dialog.js";
import { mutateAndUpdateContestMessage } from "./message-store.js";

/**
 * Handle feint click flow.
 * @param {Object} params
 * @param {string} params.messageId
 * @param {"action"|"reaction"} params.side
 * @param {number} params.rollIndex
 * @param {(side: "action"|"reaction", rollIndex: number, state: Object, messageId?: string|null, isFeint?: boolean) => Promise<Object|null>} params.prepareOneStep
 * @param {(message: ChatMessage|string, state: Object) => Promise<any>} params.updateContestMessage
 * @returns {Promise<void>}
 */
export async function handleFeintAction({ messageId, side, rollIndex, prepareOneStep, updateContestMessage }) {
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;
	if (state.isResolving) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.FEINT_DURING_RESOLUTION);
		return;
	}

	const currentRoll = getQuadrantRoll(state, side, rollIndex);
	if (!currentRoll) return;

	await mutateAndUpdateContestMessage({
		message: latest,
		state,
		updateContestMessage,
		mutate: (nextState) => {
			const roll = getQuadrantRoll(nextState, side, rollIndex);
			if (roll) roll.feintDialogOpen = true;
		}
	});

	const snapshotActorUuid = currentRoll.actorUuid;
	const snapshotFeintCounter = currentRoll.feintCounter || 0;

	const preparedData = await prepareOneStep(side, rollIndex, state, messageId, true);
	if (!preparedData) {
		const cancelledMessage = game.messages.get(messageId);
		const cancelledState = getContestStateFromMessage(cancelledMessage);
		if (!cancelledState) return;
		await mutateAndUpdateContestMessage({
			message: cancelledMessage,
			state: cancelledState,
			updateContestMessage,
			mutate: (nextState) => {
				const roll = getQuadrantRoll(nextState, side, rollIndex);
				if (roll) roll.feintDialogOpen = false;
			}
		});
		return;
	}

	const gambitResult = await showFeintGambitDialog({
		gambitDefault: !!preparedData.gambitSelections?.feint
	});

	if (gambitResult === null) {
		const cancelledMessage = game.messages.get(messageId);
		const cancelledState = getContestStateFromMessage(cancelledMessage);
		if (!cancelledState) return;
		await mutateAndUpdateContestMessage({
			message: cancelledMessage,
			state: cancelledState,
			updateContestMessage,
			mutate: (nextState) => {
				const roll = getQuadrantRoll(nextState, side, rollIndex);
				if (roll) roll.feintDialogOpen = false;
			}
		});
		return;
	}

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
		await mutateAndUpdateContestMessage({
			message: freshMessage,
			state: freshState,
			updateContestMessage,
			mutate: (nextState) => {
				const roll = getQuadrantRoll(nextState, side, rollIndex);
				if (roll) roll.feintDialogOpen = false;
			}
		});
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_RESOLVED);
		return;
	}
	if (freshRoll.actorUuid !== snapshotActorUuid) {
		await mutateAndUpdateContestMessage({
			message: freshMessage,
			state: freshState,
			updateContestMessage,
			mutate: (nextState) => {
				const roll = getQuadrantRoll(nextState, side, rollIndex);
				if (roll) roll.feintDialogOpen = false;
			}
		});
		ui.notifications.error(NOTIFICATION_MESSAGES.FEINT_STATE_CHANGED_ACTOR);
		return;
	}

	preparedData.isFeinting = true;
	preparedData.feintCounter = snapshotFeintCounter + 1;
	preparedData.gambitSelections = { feint: gambitResult.useGambit };

	await mutateAndUpdateContestMessage({
		message: freshMessage,
		state: freshState,
		updateContestMessage,
		mutate: (nextState) => {
			const roll = getQuadrantRoll(nextState, side, rollIndex);
			if (roll) roll.feintDialogOpen = false;
			clearPairAdvantage(nextState, side);
			applyPreparedToState(nextState, side, rollIndex, preparedData);
			nextState.nextStep = getFirstUnresolvedStep(nextState);
		}
	});
}

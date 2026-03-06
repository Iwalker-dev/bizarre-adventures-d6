/**
 * Unready action flow for prepared rolls.
 */

import { NOTIFICATION_MESSAGES } from "./constants.js";
import {
	getContestStateFromMessage,
	getQuadrantRoll,
	clearPreparedRoll,
	getFirstUnresolvedStep
} from "./state.js";
import { refundLuckMove } from "../../luck-moves.js";
import { mutateAndUpdateContestMessage } from "./message-store.js";

/**
 * Handle unready click flow.
 * @param {Object} params
 * @param {string} params.messageId
 * @param {"action"|"reaction"} params.side
 * @param {number} params.rollIndex
 * @param {(message: ChatMessage|string, state: Object) => Promise<any>} params.updateContestMessage
 * @returns {Promise<void>}
 */
export async function handleUnreadyAction({ messageId, side, rollIndex, updateContestMessage }) {
	const latest = game.messages.get(messageId);
	const state = getContestStateFromMessage(latest);
	if (!state) return;
	if (state.isResolving) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.UNREADY_DURING_RESOLUTION);
		return;
	}

	const rollData = getQuadrantRoll(state, side, rollIndex);

	if (rollData && rollData.feintCount > 0) {
		const actor = rollData.actorUuid ? await fromUuid(rollData.actorUuid) : null;
		const luckActor = rollData.luckActorUuid ? await fromUuid(rollData.luckActorUuid) : actor;

		if (actor && luckActor) {
			const useGambit = rollData.gambitSelections?.feint || false;
			const refundResult = await refundLuckMove(actor, "feint", useGambit, rollData.feintCount, luckActor);

			if (refundResult.success && refundResult.capped) {
				ui.notifications.warn(NOTIFICATION_MESSAGES.LUCK_REFUNDED_CAPPED);
			} else if (!refundResult.success && refundResult.error) {
				ui.notifications.error(refundResult.error);
			}
		}
	}

	await mutateAndUpdateContestMessage({
		message: latest,
		state,
		updateContestMessage,
		mutate: (nextState) => {
			clearPreparedRoll(nextState, side, rollIndex);
			nextState.nextStep = getFirstUnresolvedStep(nextState);
			nextState.result = null;
		}
	});
}

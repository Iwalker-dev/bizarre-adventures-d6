/**
 * Resolution status transition helpers.
 */

import { mutateAndUpdateContestMessage } from "./message-store.js";
import { NOTIFICATION_MESSAGES } from "./constants.js";

/**
 * Mark contest as resolving and persist updated message state.
 * @param {Object} params
 * @returns {Promise<void>}
 */
export async function beginResolutionTransition(params) {
	const { state, message, updateContestMessage, closeContestDialogs } = params;
	if (typeof closeContestDialogs === "function") {
		closeContestDialogs();
	}
	await mutateAndUpdateContestMessage({
		message,
		state,
		updateContestMessage,
		mutate: (nextState) => {
			nextState.isResolving = true;
		}
	});
}

/**
 * Abort resolution and emit a user notification.
 * @param {Object} params
 * @returns {Promise<void>}
 */
export async function abortResolutionTransition(params) {
	const { state, message, updateContestMessage, level = "warn", text = NOTIFICATION_MESSAGES.RESOLUTION_CANCELLED } = params;
	await mutateAndUpdateContestMessage({
		message,
		state,
		updateContestMessage,
		mutate: (nextState) => {
			nextState.isResolving = false;
		}
	});

	if (!text) return;
	if (level === "error") {
		ui.notifications.error(text);
		return;
	}
	ui.notifications.warn(text);
}

/**
 * Mark resolution as complete and persist updated message state.
 * @param {Object} params
 * @returns {Promise<void>}
 */
export async function completeResolutionTransition(params) {
	const { state, message, updateContestMessage } = params;
	await mutateAndUpdateContestMessage({
		message,
		state,
		updateContestMessage,
		mutate: (nextState) => {
			nextState.isResolving = false;
		}
	});
}

/**
 * Contest message store and GM-routed update helpers.
 */

import { SYSTEM_ID, CONTEST_FLAG } from "./constants.js";
import { getContestStateFromMessage } from "./state.js";
import { buildContestHtml } from "./render.js";

let socketRef = null;

/**
 * Initialize store dependencies.
 * @param {Object} deps
 * @param {Object|null} deps.socket
 */
export function initContestMessageStore({ socket = null } = {}) {
	socketRef = socket;
}

/**
 * Update contest chat message, routing via GM if needed.
 * @param {ChatMessage|string} message - ChatMessage object or message ID
 * @param {Object} state - State updates to apply
 * @returns {Promise<Object|void>}
 */
export async function updateContestMessage(message, state) {
	const messageId = typeof message === "string" ? message : message.id;

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

	if (!socketRef) {
		console.warn("BAD6 | Socket not ready; cannot update contest message as GM.");
		return;
	}

	await socketRef.executeAsGM("updateContestMessage", messageId, state);
}

/**
 * GM-side update for contest messages (called via socketlib).
 * @param {string} messageId
 * @param {Object} state
 * @returns {Promise<boolean>}
 */
export async function updateContestMessageAsGM(messageId, state) {
	const message = game.messages.get(messageId);
	if (!message) return false;

	const freshState = getContestStateFromMessage(message) || {};
	const mergedState = foundry.utils.mergeObject(freshState, state, { inplace: false });

	await message.setFlag(SYSTEM_ID, CONTEST_FLAG, mergedState);
	await message.update({ content: buildContestHtml(mergedState) });
	return true;
}

/**
 * Mutate contest state and immediately push a single message update.
 * @param {Object} params
 * @param {ChatMessage} params.message
 * @param {Object} params.state
 * @param {(message: ChatMessage|string, state: Object) => Promise<any>} params.updateContestMessage
 * @param {(state: Object) => void} [params.mutate]
 * @returns {Promise<void>}
 */
export async function mutateAndUpdateContestMessage({ message, state, updateContestMessage, mutate }) {
	if (!message || !state || typeof updateContestMessage !== "function") return;
	if (typeof mutate === "function") {
		mutate(state);
	}
	await updateContestMessage(message, state);
}

/**
 * Core state accessors.
 * Simple getters for accessing state data, with safety checks.
 */

import { SYSTEM_ID, CONTEST_FLAG } from "../constants.js";

/**
 * Safely get a quadrant's roll data from state.
 * @param {Object} state
 * @param {string} side
 * @param {number} rollIndex
 * @returns {Object|null}
 */
export function getQuadrantRoll(state, side, rollIndex) {
	return state?.[side]?.rolls?.[rollIndex] ?? null;
}

/**
 * Safely get a pair's state from contest state.
 * @param {Object} state
 * @param {string} side
 * @returns {Object|null}
 */
export function getPairState(state, side) {
	return state?.[side] ?? null;
}

/**
 * Get contest state from a chat message.
 * @param {ChatMessage|string} message
 * @returns {Object|null}
 */
export function getContestStateFromMessage(message) {
	const msg = typeof message === "string" ? game.messages.get(message) : message;
	return msg?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG] ?? null;
}

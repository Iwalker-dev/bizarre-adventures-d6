/**
 * State query and ordering helpers.
 * Complex accessors
 */

import { getQuadrantRoll } from "./accessors.js";

/**
 * Parse a quadrant string into its components.
 * @param {string} quadrant
 * @returns {{side:"action"|"reaction",rollIndex:number}|null}
 */
export function parseQuadrant(quadrant) {
	const [side, idx] = String(quadrant || "").split("-");
	const rollIndex = Number(idx || 0);
	if (!side || !["action", "reaction"].includes(side) || ![1, 2].includes(rollIndex)) return null;
	return { side, rollIndex };
}

/**
 * Compute total for a roll pair.
 * @param {Object} pair
 * @returns {number|null}
 */
export function computePairTotal(pair) {
	if (pair?.rolls?.[1]?.resolved && pair?.rolls?.[2]?.resolved) {
		return Number(pair.rolls[1].total || 0) + Number(pair.rolls[2].total || 0);
	}
	return null;
}

/**
 * Get roll order by whether a reaction exists.
 * @param {boolean} hasReaction
 * @returns {string[]}
 */
export function getRollOrder(hasReaction) {
	return hasReaction
		? ["reaction-1", "reaction-2", "action-1", "action-2"]
		: ["action-1", "action-2"];
}

/**
 * Check if all required quadrants are prepared.
 * @param {Object} state
 * @returns {boolean}
 */
export function allQuadrantsPrepared(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = getQuadrantRoll(state, parsed.side, parsed.rollIndex);
		if (!roll?.prepared) return false;
	}
	return true;
}

/**
 * Check if any quadrants are resolved.
 * @param {Object} state
 * @returns {boolean}
 */
export function anyQuadrantsResolved(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = getQuadrantRoll(state, parsed.side, parsed.rollIndex);
		if (roll?.resolved) return true;
	}
	return false;
}

/**
 * Find the first unresolved quadrant in roll order.
 * @param {Object} state
 * @returns {string|null}
 */
export function getFirstUnresolvedStep(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = getQuadrantRoll(state, parsed.side, parsed.rollIndex);
		if (!roll?.resolved) return quadrant;
	}
	return null;
}

/**
 * Get next roll quadrant in order.
 * @param {Object} state
 * @param {string} currentQuadrant
 * @returns {string|null}
 */
export function getNextStepInOrder(state, currentQuadrant) {
	const order = getRollOrder(state?.hasReaction);
	const idx = order.indexOf(currentQuadrant);
	if (idx === -1) return state?.nextStep || null;
	return order[idx + 1] || null;
}

/**
 * Get the advantage lock value for a specific pair.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @returns {number|null}
 */
export function getPairAdvantage(state, side) {
	const pair = state?.[side];
	if (pair?.advantage !== null && pair?.advantage !== undefined) {
		return Number(pair.advantage);
	}
	return null;
}

/**
 * Get the advantage chooser label for a specific pair.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @returns {string}
 */
export function getPairAdvantageChosenBy(state, side) {
	return state?.[side]?.advantageChosenBy || "";
}

/**
 * Apply advantage lock to a specific pair and unresolved prepared rolls in that pair.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} advantage
 * @param {string} chosenBy
 * @returns {void}
 */
export function setPairAdvantage(state, side, advantage, chosenBy = "Unknown") {
	const pair = state?.[side];
	if (!pair) return;
	const value = Number(advantage || 0);
	pair.advantage = value;
	pair.advantageChosenBy = chosenBy;
	for (const rollIndex of [1, 2]) {
		const roll = pair.rolls?.[rollIndex];
		if (roll?.prepared && !roll?.resolved) {
			roll.advantage = value;
		}
	}
}

/**
 * Clear advantage lock for a specific pair.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @returns {void}
 */
export function clearPairAdvantage(state, side) {
	const pair = state?.[side];
	if (!pair) return;
	pair.advantage = null;
	pair.advantageChosenBy = null;
}

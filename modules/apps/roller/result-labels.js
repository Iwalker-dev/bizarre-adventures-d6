/**
 * Label converters for contest result summaries.
 */

import { RESULT_LABELS } from "./constants.js";

/**
 * Convert a DC total to a label.
 * @param {number} value
 * @returns {string}
 */
export function convDC(value) {
	return RESULT_LABELS.DC[value] || RESULT_LABELS.DC_FALLBACK;
}

/**
 * Convert hit difference to a severity label.
 * @param {number} value
 * @returns {string}
 */
export function convHit(value) {
	if (value > 6) return RESULT_LABELS.HIT_GRINDHOUSE;
	return RESULT_LABELS.HIT[value] || RESULT_LABELS.HIT_INVALID;
}

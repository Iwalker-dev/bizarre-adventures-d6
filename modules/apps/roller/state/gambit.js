/**
 * Gambit defaults persisting across a single roll process.
 */

export let rollProcessGambitDefaults = {
	feint: false,
	fudge: false,
	mulligan: false,
	persist: false
};

/**
 * Reset gambit defaults (called when starting a new roll process).
 */
export function resetGambitDefaults() {
	rollProcessGambitDefaults = {
		feint: false,
		fudge: false,
		mulligan: false,
		persist: false
	};
}

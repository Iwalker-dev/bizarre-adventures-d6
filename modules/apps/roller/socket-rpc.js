/**
 * Socket RPC registration and wrappers for BAD6 roller.
 */

export const ROLLER_RPC = {
	PREPARE_ROLL_FORMULA: "prepareRollFormula",
	EXECUTE_PREPARED_ROLL: "executePreparedRoll",
	UPDATE_CONTEST_MESSAGE: "updateContestMessage"
};

let socketRef = null;

/**
 * Register roller socket handlers.
 * @param {string} systemId
 * @param {Object} handlers
 * @returns {Object}
 */
export function registerRollerSocketHandlers(systemId, handlers) {
	socketRef = socketlib.registerSystem(systemId);
	socketRef.register(ROLLER_RPC.PREPARE_ROLL_FORMULA, handlers.prepareRollFormula);
	socketRef.register(ROLLER_RPC.EXECUTE_PREPARED_ROLL, handlers.executePreparedRoll);
	socketRef.register(ROLLER_RPC.UPDATE_CONTEST_MESSAGE, handlers.updateContestMessage);
	return socketRef;
}

/**
 * Get registered socket instance.
 * @returns {Object|null}
 */
export function getRollerSocket() {
	return socketRef;
}

/**
 * Execute prepare-roll-formula as a specific user.
 * @param {string} userId
 * @param {...any} args
 * @returns {Promise<any>}
 */
export async function executePrepareRollFormulaAsUser(userId, ...args) {
	if (!socketRef) {
		console.warn("BAD6 | Socket not ready; cannot delegate prepareRollFormula.");
		return null;
	}
	return socketRef.executeAsUser(ROLLER_RPC.PREPARE_ROLL_FORMULA, userId, ...args);
}

/**
 * Execute prepared-roll as a specific user.
 * @param {string} userId
 * @param {...any} args
 * @returns {Promise<any>}
 */
export async function executePreparedRollAsUser(userId, ...args) {
	if (!socketRef) {
		console.warn("BAD6 | Socket not ready; cannot delegate executePreparedRoll.");
		return null;
	}
	return socketRef.executeAsUser(ROLLER_RPC.EXECUTE_PREPARED_ROLL, userId, ...args);
}

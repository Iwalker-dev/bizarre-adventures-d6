/**
 * State management for BAD6 roller system.
 */

import { SYSTEM_ID, CONTEST_FLAG } from "./constants.js";
import { spendLuckMove } from "../../luck-moves.js";

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

// ============================================================================
// STATE ACCESSORS
// ============================================================================

/**
 * Safely get a quadrant's roll data from state.
 * @param {Object} state - Contest state object
 * @param {string} side - "action" or "reaction"
 * @param {number} rollIndex - 1 or 2
 * @returns {Object|null}
 */
export function getQuadrantRoll(state, side, rollIndex) {
	return state?.[side]?.rolls?.[rollIndex] ?? null;
}

/**
 * Safely get a pair's state from contest state.
 * @param {Object} state - Contest state object
 * @param {string} side - "action" or "reaction"
 * @returns {Object|null}
 */
export function getPairState(state, side) {
	return state?.[side] ?? null;
}

/**
 * Get contest state from a chat message.
 * @param {ChatMessage|string} message - Message object or ID
 * @returns {Object|null}
 */
export function getContestStateFromMessage(message) {
	const msg = typeof message === 'string' ? game.messages.get(message) : message;
	return msg?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG] ?? null;
}

// ============================================================================
// STATE CREATION
// ============================================================================

/**
 * Create an empty roll state for a single roll.
 * @returns {Object}
 */
export function createEmptyRollState() {
	return {
		prepared: false,
		resolved: false,
		actorUuid: null,
		luckActorUuid: null,
		actorName: null,
		statKey: null,
		statLabel: null,
		statValue: null,
		baseFormula: null,
		formula: null,
		diceResults: null,
		total: null,
		advantage: null,
		effectiveAdvantage: null,
		useFudge: false,
		useGambit: false,
		feintCount: 0,
		feintGambits: [],
		isFeinting: false,
		feintCounter: 0,
		feintDialogOpen: false,
		gambitSelections: null,
		mulliganApplied: false,
		mulliganNote: null,
		snapshot: null,
		rollHtml: null
	};
}

/**
 * Create roll pair state (two rolls and metadata).
 * @returns {Object}
 */
export function createPairState() {
	return {
		advantage: null,
		advantageChosenBy: null,
		rolls: {
			1: createEmptyRollState(),
			2: createEmptyRollState()
		},
		total: null,
		mulliganNote: null,
		fudgeChosenBy: null,
		persistCount: 0,
		persistNote: null,
		persistLock: null
	};
}

/**
 * Create the contest state container.
 * @param {boolean} hasReaction
 * @returns {Object}
 */
export function createContestState(hasReaction) {
	return {
		version: 1,
		hasReaction: !!hasReaction,
		nextStep: null,
		isResolving: false,
		action: createPairState(),
		reaction: createPairState(),
		result: null
	};
}

// ============================================================================
// STATE QUERIES
// ============================================================================

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

// ============================================================================
// STATE MUTATIONS
// ============================================================================

/**
 * Apply prepared data to contest state (stat selection complete, not rolled yet).
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} preparedData
 * @returns {void}
 */
export function applyPreparedToState(state, side, rollIndex, preparedData) {
	const pair = state[side];
	const rollState = pair.rolls[rollIndex];
	
	// Determine advantage: use locked pair advantage if available, otherwise use prepared data
	const finalAdvantage = (pair.advantage !== null && pair.advantage !== undefined) 
		? pair.advantage 
		: Number(preparedData.advantage || 0);
	
	Object.assign(rollState, {
		prepared: true,
		resolved: false,
		preparedBy: game.user.id,
		actorUuid: preparedData.actorUuid,
		luckActorUuid: preparedData.luckActorUuid || null,
		actorName: preparedData.actorName,
		statKey: preparedData.statKey,
		statLabel: preparedData.statLabel,
		statValue: preparedData.statValue,
		baseFormula: preparedData.baseFormula,
		advantage: finalAdvantage,
		feintCount: preparedData.feintCount || 0,
		feintGambits: preparedData.feintGambits || [],
		isFeinting: preparedData.isFeinting || false,
		feintCounter: preparedData.feintCounter || 0,
		gambitSelections: preparedData.gambitSelections || null
	});
	// Lock advantage for the pair if not already locked
	if (!pair.advantage && pair.advantage !== 0) {
		pair.advantage = Number(finalAdvantage || 0);
		pair.advantageChosenBy = preparedData.actorName || "Unknown";
	}
}

/**
 * Apply roll result to contest state.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @returns {Promise<void>}
 */
export async function applyRollToState(state, side, rollIndex, rollData) {
	const pair = state[side];
	const rollState = pair.rolls[rollIndex];
	
	// Handle feint execution on resolution
	if (rollState?.isFeinting) {
		const actor = rollData.actorUuid ? await fromUuid(rollData.actorUuid) : null;
		if (actor) {
			const luckActor = rollData.luckActorUuid ? await fromUuid(rollData.luckActorUuid) : actor;
			// Spend luck for the feint one time
			const { success, error } = await spendLuckMove(actor, "feint", rollState.useGambit || false, 1, luckActor || actor);
			if (!success) {
				ui.notifications.error(error || "Failed to spend luck for feint");
				return;
			}
			// Reset the pair (clear advantage, feint pending count, etc.)
			const feintCounter = rollState.feintCounter || 1;
			resetPairState(pair);
			// Restore feint counter for this quadrant
			pair.rolls[rollIndex].feintCounter = feintCounter;
		}
	}
	
	Object.assign(rollState, {
		resolved: true,
		actorUuid: rollData.actorUuid,
		luckActorUuid: rollData.luckActorUuid || null,
		actorName: rollData.actorName,
		statKey: rollData.statKey,
		statLabel: rollData.statLabel,
		formula: rollData.formula || null,
		diceResults: rollData.diceResults || null,
		total: rollData.total,
		advantage: rollData.advantage,
		effectiveAdvantage: rollData.effectiveAdvantage,
		useFudge: rollData.useFudge,
		useGambit: rollData.useGambit,
		feintCount: rollData.feintCount,
		isFeinting: false,
		snapshot: rollData.snapshot,
		rollHtml: rollData.rollHtml || null
	});
	if (rollData.useFudge && !pair.fudgeChosenBy) {
		pair.fudgeChosenBy = rollData.actorName || "Unknown";
	}
	pair.total = computePairTotal(pair);
}

/**
 * Clear a prepared roll from contest state.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @returns {void}
 */
export function clearPreparedRoll(state, side, rollIndex) {
	const pair = state[side];
	const roll = pair.rolls[rollIndex];
	
	// If this roll set the advantage lock for its pair, reset it
	if (pair.advantageChosenBy === roll.actorName) {
		pair.advantage = null;
		pair.advantageChosenBy = null;
	}
	
	// If this roll used Fudge, reset that too
	if (pair.fudgeChosenBy === roll.actorName) {
		pair.fudgeChosenBy = null;
	}
	
	// Reset the roll state
	pair.rolls[rollIndex] = createEmptyRollState();
}

/**
 * Reset a roll pair after Persist.
 * @param {Object} pair
 * @returns {void}
 */
export function resetPairState(pair) {
	const persistCount = Number(pair?.persistCount || 0);
	const persistNote = pair?.persistNote || null;
	const persistLock = pair?.persistLock && pair.persistLock.expiresAt > Date.now() ? pair.persistLock : null;
	pair.advantage = null;
	pair.advantageChosenBy = null;
	pair.rolls[1] = createEmptyRollState();
	pair.rolls[2] = createEmptyRollState();
	pair.total = null;
	pair.mulliganNote = null;
	pair.fudgeChosenBy = null;
	pair.persistCount = persistCount;
	pair.persistNote = persistNote;
	pair.persistLock = persistLock;
}

/**
 * Upgrade a single-action contest state into a full contest state.
 * Preserves any resolved action rolls.
 * @param {Object} state
 * @returns {void}
 */
export function upgradeActionStateToContest(state) {
	state.hasReaction = true;
	if (!state.reaction) {
		state.reaction = createPairState();
	}
	state.nextStep = getFirstUnresolvedStep(state);
}

/**
 * Collect linked actor UUIDs for an actor.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function getLinkedActorUuids(actor) {
	const linkedSet = new Set();
	if (!actor) return linkedSet;
	if (actor.uuid) linkedSet.add(actor.uuid);
	const linked = actor.system?.bio?.linkedActors?.value || [];
	for (const link of linked) {
		if (link?.uuid) linkedSet.add(link.uuid);
	}
	return linkedSet;
}

/**
 * Check if two actors are linked directly or indirectly.
 * @param {Actor} actorA
 * @param {Actor} actorB
 * @returns {boolean}
 */
export function areActorsLinked(actorA, actorB) {
	if (!actorA || !actorB) return false;
	const setA = getLinkedActorUuids(actorA);
	if (setA.has(actorB.uuid)) return true;
	const setB = getLinkedActorUuids(actorB);
	if (setB.has(actorA.uuid)) return true;
	for (const id of setA) {
		if (setB.has(id)) return true;
	}
	return false;
}

/**
 * Close all dialogs related to the contest.
 * @returns {void}
 */
export function closeContestDialogs() {
	const openDialogs = Object.values(ui.windows).filter(d => d instanceof Dialog);
	for (const dialog of openDialogs) {
		const content = dialog.element?.[0]?.innerText || "";
		// Close stat dialogs, feint dialogs, choice dialogs (look for common patterns)
		if (content.includes("Stat") || content.includes("Feint") || content.includes("Choose") || 
		    content.includes("Prepare") || content.includes("Action") || content.includes("Reaction")) {
			dialog.close();
		}
	}
}

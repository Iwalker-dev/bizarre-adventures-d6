/**
 * State mutation helpers.
 */

import { createEmptyRollState, createPairState } from "./factories.js";
import {
	getPairAdvantage,
	getPairAdvantageChosenBy,
	setPairAdvantage,
	clearPairAdvantage,
	computePairTotal,
	getFirstUnresolvedStep
} from "./queries.js";

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

	const pairAdvantage = getPairAdvantage(state, side);
	const finalAdvantage = (pairAdvantage !== null && pairAdvantage !== undefined)
		? pairAdvantage
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
		feintDialogOpen: preparedData.feintDialogOpen || false,
		gambitSelections: preparedData.gambitSelections || null
	});

	if (pairAdvantage === null || pairAdvantage === undefined) {
		setPairAdvantage(state, side, finalAdvantage, preparedData.actorName || "Unknown");
	} else {
		setPairAdvantage(state, side, pairAdvantage, getPairAdvantageChosenBy(state, side) || preparedData.actorName || "Unknown");
	}
}

/**
 * Apply roll result to contest state.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @returns {void}
 */
export function applyRollToState(state, side, rollIndex, rollData) {
	const pair = state[side];
	const rollState = pair.rolls[rollIndex];

	if (rollState?.isFeinting) {
		const feintCounter = rollState.feintCounter || 1;
		clearPairAdvantage(state, side);
		pair.total = null;
		pair.rolls[rollIndex] = createEmptyRollState();
		pair.rolls[rollIndex].feintCounter = feintCounter;
		return;
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
		luckMovesUsed: Array.isArray(rollData.luckMovesUsed) ? rollData.luckMovesUsed : [],
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
	clearPairAdvantage(state, side);
	const roll = pair.rolls[rollIndex];

	if (pair.fudgeChosenBy === roll.actorName) {
		pair.fudgeChosenBy = null;
	}

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

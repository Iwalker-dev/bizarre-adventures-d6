/**
 * State creation helpers.
 * Object creation and initialization
 */

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
		luckMovesUsed: [],
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

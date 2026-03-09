export const LUCK_MOVES = {
	feint: {
		name: "Feint",
		description: "Edit your Action/Reaction after hearing the enemy's",
		costType: "temp",
		cost: 1,
		timing: "pre-roll",
		effect: "feint"
	},
	fudge: {
		name: "Fudge",
		description: "Add a free Advantage, pre-roll",
		costType: "temp",
		cost: 2,
		timing: "pre-roll",
		effect: "advantage"
	},
	flashback: {
		name: "Flashback",
		description: "Retcon a detail you choose",
		costType: "temp",
		cost: 3,
		timing: "post-roll",
		effect: "narrative"
	},
	mulligan: {
		name: "Mulligan",
		description: "Add a free Advantage, post-roll",
		costType: "temp",
		cost: 4,
		timing: "post-roll",
		effect: "advantage"
	},
	persist: {
		name: "Persist",
		description: "Try another Action/Reaction after a failed one, as if it tied",
		costType: "perm",
		cost: 2,
		timing: "post-roll",
		effect: "reroll"
	},
	gambit: {
		name: "Gambit",
		description: "Zero cost if using Chekhov's Gun or successful plan",
		costType: "gambit",
		cost: 0,
		timing: "anytime",
		effect: "special"
	}
};
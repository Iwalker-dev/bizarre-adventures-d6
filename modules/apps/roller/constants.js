/**
 * Constants for the BAD6 roller system.
 * Mainly useful for future language support
 */

export const SYSTEM_ID = "bizarre-adventures-d6";
export const CONTEST_FLAG = "contest";

export const CSS_CLASSES = {
	ROLL_BTN: "bad6-roll-btn",
	ACTION_BTN: "bad6-action-btn",
	RESULT_BTN: "bad6-result-btn",
	CONTEST: "bad6-contest"
};

export const QUADRANT_LABELS = {
	"action-1": "Action Roll 1",
	"action-2": "Action Roll 2",
	"reaction-1": "Reaction Roll 1",
	"reaction-2": "Reaction Roll 2",
	FALLBACK: (side, rollIndex) => `${side === "reaction" ? "Reaction" : "Action"} Roll ${rollIndex}`
};

export const BUTTON_LABELS = {
	PENDING: "Prepare",
	ROLLING: "Rolling...",
	FEINT_PENDING: "Feint pending...",
	RESOLVE: "🎲 Resolve Contest",
	UNREADY: "Unready",
	FEINT: "Feint",
	PREPARE_REACTION: "Prepare Reaction",
	PREPARE_ACTION: "Prepare Action",
	EDIT_REACTION: "Edit Reaction",
	EDIT_ACTION: "Edit Action",
	PREPARE_ROLL: (sideLabel, rollIndex) => `Prepare ${sideLabel} ${rollIndex}`,
	EDIT_ROLL: (sideLabel, rollIndex) => `Edit ${sideLabel} ${rollIndex}`
};

export const NOTIFICATION_MESSAGES = {
	ROLL_ALREADY_RESOLVED: "That roll is already resolved.",
	FEINT_STATE_CHANGED_DELETED: "Roll state changed, feint cancelled (message deleted)",
	FEINT_STATE_CHANGED_MISSING: "Roll state changed, feint cancelled (quadrant missing)",
	FEINT_STATE_CHANGED_RESOLVED: "Roll state changed, feint cancelled (already resolved)",
	FEINT_STATE_CHANGED_ACTOR: "Roll state changed, feint cancelled (actor mismatch)",
	LUCK_REFUNDED_CAPPED: "Luck refunded but capped at 5 (maximum).",
	NO_TOKEN_SELECTED: "No token selected. Select up to 2.",
	NO_OWNED_ACTORS: "You don't own any actors. A player may only roll from their owned actors.",
	NO_LINKED_ABILITIES: "No linked abilities found. Defaulting to original roller.",
	STAT_SELECTION_CANCELLED: "Stat selection cancelled.",
	RESOLUTION_STATE_NOT_FOUND: "Cannot resolve: message state not found.",
	RESOLUTION_ALREADY_IN_PROGRESS: "Another user is already resolving this contest.",
	RESOLUTION_INVALID_PREPARED_STATE: "Cannot resolve: not all rolls are prepared or some are already resolved.",
	RESOLUTION_CANCELLED: "Resolution cancelled.",
	RESOLUTION_CANCELLED_RESTART: "Resolution cancelled. Click Resolve Contest to start over.",
	UNREADY_DURING_RESOLUTION: "Cannot unready while contest resolution is in progress.",
	FEINT_DURING_RESOLUTION: "Cannot feint while contest resolution is in progress.",
	PREPARE_FORMULA_FAILED: (side, rollIndex) => `Failed to prepare formula for ${side} roll ${rollIndex}`,
	EXECUTE_ROLL_FAILED: (side, rollIndex) => `Failed to execute ${side} roll ${rollIndex}`,
	FEINT_LUCK_SPEND_FAILED: "Failed to spend luck for feint"
};

export const STATUS_MESSAGES = {
	FEINTING: "Feinting",
	READY_TO_RESOLVE: "Ready to resolve",
	FEINTS: "🎭 Feints",
	PENDING: "Pending",
	LUCK_MOVES_USED: "Luck moves used",
	GAMBIT_SUFFIX: "(Gambit)",
	ADVANTAGE: "Advantage",
	ADVANTAGE_CHOSEN_BY: (name) => `(chosen by ${name})`,
	RESULT: "Result:",
	FORMULA_HIDDEN: "Formula hidden",
	MULLIGAN_APPLIED: "Mulligan applied (+1 Advantage)",
	PERSIST_ALREADY_CHOSEN_BY: (name) => `Persist already chosen by ${name}.`,
	PERSIST_NOTE: (actorName, count) => `✨ Persist: ${actorName}${count > 1 ? ` ×${count}` : ""}`
};

export const RESULT_MESSAGES = {
	DC_TOTAL: (total, dcLabel) => `Total: ${total}! ${dcLabel}`,
	CLASH: "Clash!",
	REACTOR_SUCCEEDS: (diff) => `Reactor succeeds (${Math.abs(diff)})`,
	ATTACKERS_WIN: (hitLabel, diff) => `Attackers win: ${hitLabel} (${diff})`
};

export const RESULT_LABELS = {
	DC: {
		0: "Trivial",
		1: "Easy",
		2: "Challenging",
		3: "Dire",
		4: "Herculean",
		5: "Extraordinary",
		6: "Superhuman",
		7: "Unbelievable",
		8: "Surreal",
		9: "Absurd",
		10: "Nigh-Impossible",
		11: "Nigh-Impossible",
		12: "Nigh-Impossible",
		13: "Nigh-Impossible",
		14: "Nigh-Impossible"
	},
	DC_FALLBACK: "Impossible",
	HIT: {
		0: "Clash!",
		1: "Minor",
		2: "Moderate",
		3: "Serious",
		4: "Debilitating",
		5: "Critical",
		6: "Macabre"
	},
	HIT_GRINDHOUSE: "Grindhouse",
	HIT_INVALID: "Invalid Hit"
};

export const LUCK_MOVE_VISUALS = {
	feint: { short: "Feint", title: "Feint" },
	fudge: { short: "Fudge", title: "Fudge" },
	mulligan: { short: "Mull", title: "Mulligan" },
	persist: { short: "Persist", title: "Persist" }
};

export const DIALOG_MESSAGES = {
	COMMON: {
		YES: "Yes",
		NO: "No",
		CANCEL: "Cancel",
		UNKNOWN: "Unknown"
	},
	ROLL_READY: {
		TITLE: "A Roll is Ready",
		CONTENT: (statLabel, advantagePhrase, formula) => `<p>Roll <strong>${statLabel}</strong>${advantagePhrase}? <code>${formula}</code></p>`
	},
	CONFIRM_ROLLER: {
		TITLE: "Player Owner Detected",
		CONTENT: "<p>Have the player finish this roll?</p>"
	},
	MULLIGAN: {
		TITLE: "Mulligan",
		CONTENT: (gambitChecked = false) => `
			<p>Use <strong>Mulligan</strong> to add +1 Advantage to the last two rolls?</p>
			<label style="display:block; margin-top:8px;">
				<input type="checkbox" id="use-gambit-mulligan" ${gambitChecked ? "checked" : ""}>
				<strong>Gambit</strong> — Nullify Mulligan cost
			</label>
		`
	},
	FEINT_GAMBIT: {
		TITLE: "Feint",
		CONFIRM_LABEL: "Feint",
		CONTENT: (gambitChecked = false) => `
			<label style="display:block;">
				<input type="checkbox" id="use-gambit-feint" ${gambitChecked ? "checked" : ""}>
				<strong>Gambit</strong> — Nullify Feint cost
			</label>
		`
	},
	PERSIST: {
		TITLE: (context = "") => context ? `Persist — ${context}` : "Persist",
		LOCK_FALLBACK: "Persist already chosen by another reactor.",
		CONTENT: (gambitChecked = false, lockReason = "") => `
			<p>Use <strong>Persist</strong> to redo the last two rolls?</p>
			<p style="color:#c00;"><strong>Costs PERMANENT Luck</strong></p>
			<label style="display:block; margin-top:8px;">
				<input type="checkbox" id="use-gambit-persist" ${gambitChecked ? "checked" : ""}>
				<strong>Gambit</strong> — Nullify Persist cost
			</label>
			<div id="persist-lock-reason" style="margin-top:6px; color:#b00; font-size:0.9em;">${lockReason}</div>
		`
	},
	STAT_SELECTION: {
		TITLE: "Choose a Stat & Luck Options",
		LOCK_MESSAGE: "The previous roll must be completed first.",
		UNSUPPORTED_ACTOR_FORMAT: "Unsupported actor format.",
		NO_NUMERIC_STATS: "No numeric stats found.",
		SELECT_ADVANTAGE_WARNING: "Select an Advantage level before rolling.",
		ADVANTAGE_LOCKED_FOR_PAIR: "Advantage already locked for this pair.",
		ADVANTAGE_HEADER: "Advantage",
		ADVANTAGE_CHOSEN_BY: (name = "Unknown") => `Advantage chosen by ${name}`,
		ADVANTAGE_PHRASE: (advantage) => advantage > 0 ? `+${advantage} Advantage` : "No Advantage",
		SELECT_STAT_PROMPT: "Select a Stat:",
		CHOOSE_LUCK_SPENDER_TITLE: "Choose Luck Spender",
		CHOOSE_LUCK_SPENDER_CONTENT: "<p>Select the actor whose Luck will be spent:</p>",
		LUCK_SPENDER_LABEL: (displayName, type, temp, perm) => `${displayName} (${type}) — Luck: ${temp}T / ${perm}P`
	},
	PARTICIPANT_SELECTION: {
		CHOOSE_ROLLER_TITLE: "Choose Roller",
		CHOOSE_ROLLER_CONTENT: "<p>Select an ability to use:</p>",
		CHOOSE_ACTOR_TITLE: "Choose an Actor",
		CHOOSE_ACTOR_CONTENT: "<p>Select an actor:</p>"
	},
	PREPARE_ROLL: {
		TITLE: (side, rollIndex) => `Prepare ${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`,
		CONTEXT: (side, rollIndex) => `${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`
	},
	OPTIONAL_FORMULA: {
		TITLE: (context = "") => context ? `Optional Formula Lines — ${context}` : "Optional Formula Lines",
		SELECT_PROMPT: "Select optional formula lines to include:",
		FUDGE_LABEL: "Fudge",
		FUDGE_BONUS: "(+1 Advantage)",
		FUDGE_COST: (cost) => `— Cost: ${cost} Temp`,
		FUDGE_USED_BY: (name) => `Fudge used by ${name}!`,
		GAMBIT_LABEL: "Gambit",
		GAMBIT_DESC: "— Nullify Fudge cost",
		INCLUDE_SELECTED: "Include Selected",
		ROLL_LINE_LABEL: (actorName, itemName, op, varOrVal) => `${actorName} - ${itemName}: ${op} ${varOrVal}`,
		FALLBACK_ACTOR: "Actor",
		FALLBACK_ITEM: "Item"
	},
	SPECIAL_STAT: {
		BASE_LABEL: (statLabel) => `${statLabel} (Base)`,
		CONTENT: (statLabel) => `<p>Select which special stat to use for this roll of <strong>${statLabel}</strong>:</p>`,
		TITLE: (statLabel) => `Choose Special Stat — ${statLabel}`
	}
};

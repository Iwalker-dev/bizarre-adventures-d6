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
	"reaction-2": "Reaction Roll 2"
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
	EDIT_ACTION: "Edit Action"
};

export const NOTIFICATION_MESSAGES = {
	ROLL_ALREADY_RESOLVED: "That roll is already resolved.",
	FEINT_STATE_CHANGED_DELETED: "Roll state changed, feint cancelled (message deleted)",
	FEINT_STATE_CHANGED_MISSING: "Roll state changed, feint cancelled (quadrant missing)",
	FEINT_STATE_CHANGED_RESOLVED: "Roll state changed, feint cancelled (already resolved)",
	FEINT_STATE_CHANGED_ACTOR: "Roll state changed, feint cancelled (actor mismatch)",
	LUCK_REFUNDED_CAPPED: "Luck refunded but capped at 5 (maximum).",
	NO_TOKEN_SELECTED: "No token selected. Select up to 2.",
	NO_OWNED_ACTORS: "You don't own any actors. A player may only roll from their owned actors."
};

export const STATUS_MESSAGES = {
	FEINTING: "Feinting",
	READY_TO_RESOLVE: "Ready to resolve",
	FEINTS: "🎭 Feints"
};

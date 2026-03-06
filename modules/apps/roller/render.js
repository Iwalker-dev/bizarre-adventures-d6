/**
 * Rendering functions for BAD6 contest roller UI.
 */

import { CSS_CLASSES, QUADRANT_LABELS, BUTTON_LABELS, NOTIFICATION_MESSAGES, STATUS_MESSAGES, LUCK_MOVE_VISUALS } from "./constants.js";
import { 
	getQuadrantRoll, 
	allQuadrantsPrepared, 
	anyQuadrantsResolved,
	parseQuadrant 
} from "./state.js";
import { canViewActorFormula } from "../../utils.js";
import { escapeHtml } from "../../dialog.js";
import { canUseLuckMove } from "../../luck-moves.js";
import { isDebugEnabled } from "../../config.js";

/**
 * Resolve actor UUID synchronously (cached lookup).
 * @param {string} uuid
 * @returns {Actor|null}
 */
function resolveActorFromUuidSync(uuid) {
	if (!uuid) return null;
	const cached = fromUuidSync(uuid);
	return cached?.documentName === "Actor" ? cached : null;
}

// ============================================================================
// SUMMARY FORMATTERS
// ============================================================================

/**
 * Format a prepared roll summary (stats selected but not rolled).
 * @param {Object} roll
 * @returns {string}
 */
export function formatPreparedSummary(roll) {
	if (!roll?.prepared || roll?.resolved) return "";
	const actorName = escapeHtml(roll.actorName || "Unknown");
	const statLabel = escapeHtml(roll.statLabel || "Stat");
	const advDisplay = roll.advantage !== null && roll.advantage !== undefined 
		? ` (+${roll.advantage} Adv)`
		: "";
	const feintDisplay = roll.feintCount > 0
		? `<div style="color:#c70; font-weight:bold; margin-top:4px;">${STATUS_MESSAGES.FEINTS}: ${roll.feintCount}</div>`
		: "";
	const lineStyle = "white-space:normal; overflow-wrap:anywhere; word-break:break-word;";
	
	// Show feinting status or ready to resolve
	const statusText = roll.isFeinting
		? `<em>${STATUS_MESSAGES.FEINTING} (x${roll.feintCounter || 1})</em>`
		: `<em>${STATUS_MESSAGES.READY_TO_RESOLVE}</em>`;
	const preparedLuckMoves = [];
	if (Number(roll.feintCount || 0) > 0) {
		preparedLuckMoves.push({
			move: "feint",
			gambit: !!roll?.gambitSelections?.feint,
			count: Number(roll.feintCount || 1)
		});
	}
	const luckStrip = renderLuckMoveStrip(preparedLuckMoves);
	
	return `
		<div style="${lineStyle}"><strong>${actorName}</strong> — ${statLabel}${advDisplay}</div>
		${feintDisplay}
		${luckStrip}
		<div style="font-size:0.85em; color:#666; margin-top:2px;">${statusText}</div>
	`;
}

/**
 * Format a roll summary HTML block.
 * @param {Object} roll
 * @returns {string}
 */
export function formatRollSummary(roll) {
	if (!roll?.resolved) return `<em>${STATUS_MESSAGES.PENDING}</em>`;
	const actorName = escapeHtml(roll.actorName || "Unknown");
	const statLabel = escapeHtml(roll.statLabel || "Stat");
	const lineStyle = "white-space:normal; overflow-wrap:anywhere; word-break:break-word;";
	const actorUuid = escapeHtml(roll.actorUuid || "");
	const rollCard = roll.rollHtml
		? `<div class="bad6-roll-card" data-actor-uuid="${actorUuid}" style="margin:4px 0;">${roll.rollHtml}</div>`
		: "";
	const mulliganBanner = roll?.mulliganApplied
		? `<div style="margin-top:4px; color:#2f6; font-weight:bold;">✨ ${escapeHtml(roll.mulliganNote || STATUS_MESSAGES.MULLIGAN_APPLIED)}</div>`
		: "";
	const luckStrip = renderLuckMoveStrip(roll?.luckMovesUsed || []);
	return `
		<div style="${lineStyle}"><strong>${actorName}</strong> — ${statLabel}</div>
		${luckStrip}
		${rollCard}
		${mulliganBanner}
	`;
}

/**
 * Render compact luck move chips for a quadrant.
 * Gambit moves are highlighted with a gold outline.
 * @param {Array<{move:string,gambit?:boolean,count?:number}>} moves
 * @returns {string}
 */
export function renderLuckMoveStrip(moves = []) {
	if (!Array.isArray(moves) || !moves.length) return "";
	const normalized = moves
		.map((entry) => ({
			move: String(entry?.move || "").toLowerCase(),
			gambit: !!entry?.gambit,
			count: Number(entry?.count || 1)
		}))
		.filter((entry) => !!entry.move && LUCK_MOVE_VISUALS[entry.move]);
	if (!normalized.length) return "";

	const chips = normalized.map((entry) => {
		const visual = LUCK_MOVE_VISUALS[entry.move];
		const countLabel = entry.count > 1 ? ` ×${entry.count}` : "";
		const tooltip = `${visual.title}${countLabel}${entry.gambit ? ` ${STATUS_MESSAGES.GAMBIT_SUFFIX}` : ""}`;
		const classes = `bad6-luck-chip${entry.gambit ? " bad6-luck-chip--gambit" : ""}`;
		return `<span class="${classes}" title="${escapeHtml(tooltip)}">${escapeHtml(visual.short)}${escapeHtml(countLabel)}</span>`;
	});

	return `<div class="bad6-luck-strip" title="${STATUS_MESSAGES.LUCK_MOVES_USED}">${chips.join("")}</div>`;
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

/**
 * Get display label for a quadrant.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @returns {string}
 */
export function getQuadrantLabel(side, rollIndex) {
	const key = `${side}-${rollIndex}`;
	return QUADRANT_LABELS[key] || QUADRANT_LABELS.FALLBACK(side, rollIndex);
}

/**
 * Get button label for a quadrant.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @returns {string}
 */
export function getQuadrantButtonLabel(side, rollIndex, rollData) {
	if (rollData?.prepared && !rollData?.resolved) {
		const sideLabel = side === "reaction" ? BUTTON_LABELS.EDIT_REACTION.split(" ")[1] : BUTTON_LABELS.EDIT_ACTION.split(" ")[1];
		return BUTTON_LABELS.EDIT_ROLL(sideLabel, rollIndex);
	}
	if (side === "reaction" && rollIndex === 1) return BUTTON_LABELS.PREPARE_REACTION;
	if (side === "action" && rollIndex === 1) return BUTTON_LABELS.PREPARE_ACTION;
	const sideLabel = side === "reaction" ? "Reaction" : "Action";
	return BUTTON_LABELS.PREPARE_ROLL(sideLabel, rollIndex);
}

// ============================================================================
// BUTTON RENDERERS
// ============================================================================

/**
 * Render rolling state button (disabled).
 * @param {string} buttonStyle - CSS style string
 * @returns {string}
 */
export function renderRollingButton(buttonStyle) {
	return `<button type="button" class="${CSS_CLASSES.ROLL_BTN}" disabled style="${buttonStyle} opacity:0.6; cursor:not-allowed;">${BUTTON_LABELS.ROLLING}</button>`;
}

/**
 * Render feint pending message.
 * @returns {string}
 */
export function renderFeintPendingMessage() {
	return `<div style="margin-top: 6px; color: #999; font-style: italic;">${BUTTON_LABELS.FEINT_PENDING}</div>`;
}

/**
 * Render action buttons for prepared roll (Unready + optional Feint).
 * @param {string} quadrant - Quadrant identifier (e.g., "action-1")
 * @param {Object} rollData - Roll state data
 * @param {Object} state - Full contest state (for canResolveContest check)
 * @param {string} buttonStyle - CSS style string
 * @returns {string}
 */
export function renderActionButtons(quadrant, rollData, state, buttonStyle) {
	const actor = resolveActorFromUuidSync(rollData.actorUuid);
	const canView = canViewActorFormula(actor);
	
	if (!canView) return "";
	
	if (isDebugEnabled()) {
		console.log(`[Feint] Rendering ${quadrant}:`, {
			actorUuid: rollData.actorUuid,
			actorName: rollData.actorName,
			luckActorUuid: rollData.luckActorUuid,
			actor: actor?.name || "NOT FOUND",
			canView,
			prepared: rollData.prepared,
			resolved: rollData.resolved
		});
	}
	
	// Check if actor can afford feint
	const luckActor = rollData.luckActorUuid 
		? resolveActorFromUuidSync(rollData.luckActorUuid) 
		: actor;
	
	// Feint button only shows when:
	// 1. Contest can be resolved (all rolls ready, none resolved)
	// 2. Current user owns the rolling actor
	// 3. Current user owns the luck-spending actor
	// 4. Actor can afford the feint cost
	const canResolveContest = allQuadrantsPrepared(state) && !anyQuadrantsResolved(state) && !state.isResolving;
	const currentUserOwnsRoller = game.user.isGM || game.user.owns(actor);
	const currentUserOwnsLuckActor = game.user.isGM || game.user.owns(luckActor);
	const canAffordFeint = canUseLuckMove(actor, "feint", false, luckActor)?.canUse;
	
	const shouldShowFeintButton = canResolveContest && currentUserOwnsRoller && currentUserOwnsLuckActor && canAffordFeint;
	
	if (isDebugEnabled()) {
		const luckCheck = canUseLuckMove(actor, "feint", false, luckActor);
		console.log(`[Feint] Luck check for ${quadrant}:`, {
			luckActor: luckActor?.name || "NOT FOUND",
			tempLuck: luckActor?.system?.attributes?.stats?.luck?.temp || 0,
			canAffordFeint,
			canResolveContest,
			currentUserOwnsRoller,
			currentUserOwnsLuckActor,
			shouldShowFeintButton,
			fullCheck: luckCheck
		});
	}
	
	const unreadyBtn = `<button type="button" class="${CSS_CLASSES.ACTION_BTN}" data-action="unready" data-quadrant="${quadrant}" style="${buttonStyle} padding: 4px 8px; margin-right: 4px;">${BUTTON_LABELS.UNREADY}</button>`;
	const feintBtn = shouldShowFeintButton 
		? `<button type="button" class="${CSS_CLASSES.ACTION_BTN}" data-action="feint" data-quadrant="${quadrant}" style="${buttonStyle} padding: 4px 8px;">${BUTTON_LABELS.FEINT}</button>`
		: "";
	
	return `<div style="display: flex; margin-top: 6px;">${unreadyBtn}${feintBtn}</div>`;
}

/**
 * Render prepare button for unprepared roll.
 * @param {string} quadrant - Quadrant identifier
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @param {string} buttonStyle - CSS style string
 * @returns {string}
 */
export function renderPrepareButton(quadrant, side, rollIndex, rollData, buttonStyle) {
	return `<button type="button" class="${CSS_CLASSES.ROLL_BTN}" data-quadrant="${quadrant}" style="${buttonStyle}">${getQuadrantButtonLabel(side, rollIndex, rollData)}</button>`;
}

/**
 * Render buttons for a quadrant based on its state.
 * @param {string} quadrant - Quadrant identifier
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @param {Object} state - Full contest state
 * @param {boolean} isResolving
 * @param {string} buttonStyle - CSS style string
 * @returns {string}
 */
export function renderQuadrantButtons(quadrant, side, rollIndex, rollData, state, isResolving, buttonStyle) {
	// Already resolved - no buttons
	if (rollData?.resolved) return "";
	
	// Currently resolving - show disabled rolling button
	if (isResolving && rollData?.prepared) {
		return renderRollingButton(buttonStyle);
	}
	
	// Prepared but not resolved
	if (rollData?.prepared) {
		// Feint dialog is open
		if (rollData.feintDialogOpen) {
			return renderFeintPendingMessage();
		}
		// Show action buttons (Unready + Feint)
		return renderActionButtons(quadrant, rollData, state, buttonStyle);
	}
	
	// Not prepared - show prepare button
	return renderPrepareButton(quadrant, side, rollIndex, rollData, buttonStyle);
}

// ============================================================================
// QUADRANT & CONTEST RENDERERS
// ============================================================================

/**
 * Render a quadrant cell HTML block.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @param {Object} pairData
 * @param {Object} state - Full contest state
 * @param {string|null} nextStep
 * @param {boolean} isResolving
 * @returns {string}
 */
export function renderQuadrantCell(side, rollIndex, rollData, pairData, state, nextStep, isResolving) {
	const quadrant = `${side}-${rollIndex}`;
	const label = getQuadrantLabel(side, rollIndex);
	const buttonStyle = `margin-top:6px;`;
	
	// Determine content based on state
	let content;
	if (rollData?.resolved) {
		content = formatRollSummary(rollData);
	} else if (rollData?.prepared) {
		content = formatPreparedSummary(rollData);
	} else {
		content = `<em>${STATUS_MESSAGES.PENDING}</em>`;
	}
	
	// Render buttons based on state
	const button = renderQuadrantButtons(quadrant, side, rollIndex, rollData, state, isResolving, buttonStyle);
	
	return `
		<div style="padding:6px;">
			<div style="font-weight:bold; margin-bottom:4px;">${label}</div>
			<div style="display:flex; flex-direction:column; gap:2px;">${content}${button}</div>
		</div>
	`;
}

/**
 * Build contest chat HTML from state.
 * @param {Object} state
 * @returns {string}
 */
export function buildContestHtml(state) {
	const actionAdvNote = state.action?.advantage !== null && state.action?.advantage !== undefined
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${STATUS_MESSAGES.ADVANTAGE}: ${state.action.advantage} ${STATUS_MESSAGES.ADVANTAGE_CHOSEN_BY(escapeHtml(state.action.advantageChosenBy || "Unknown"))}</div>`
		: "";
	const actionPersistNote = state.action?.persistNote
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${state.action.persistNote}</div>`
		: "";
	const actionRow = `
		<div style="border-bottom:2px solid #555; padding-bottom:4px;">
			${renderQuadrantCell("action", 1, state.action.rolls[1], state.action, state, state.nextStep, state.isResolving)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("action", 2, state.action.rolls[2], state.action, state, state.nextStep, state.isResolving)}
			${actionAdvNote}
			${actionPersistNote}
		</div>
	`;
	const reactionAdvNote = state.reaction?.advantage !== null && state.reaction?.advantage !== undefined
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${STATUS_MESSAGES.ADVANTAGE}: ${state.reaction.advantage} ${STATUS_MESSAGES.ADVANTAGE_CHOSEN_BY(escapeHtml(state.reaction.advantageChosenBy || "Unknown"))}</div>`
		: "";
	const reactionPersistNote = state.reaction?.persistNote
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${state.reaction.persistNote}</div>`
		: "";
	const reactionRow = state.hasReaction
		? `
		<div style="margin-top:6px; padding-top:4px;">
			${renderQuadrantCell("reaction", 1, state.reaction.rolls[1], state.reaction, state, state.nextStep, state.isResolving)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("reaction", 2, state.reaction.rolls[2], state.reaction, state, state.nextStep, state.isResolving)}
			${reactionAdvNote}
			${reactionPersistNote}
		</div>
		`
		: "";
	
	// Show "Resolve Contest" button if all prepared and none resolved, and not currently resolving
	const canResolve = allQuadrantsPrepared(state) && !anyQuadrantsResolved(state) && !state.isResolving;
	const resolveButton = canResolve
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999; text-align:center;">
			<button type="button" data-action="resolve" style="background:#4a7; color:#fff; font-weight:bold; font-size:1.1em; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">
				${BUTTON_LABELS.RESOLVE}
			</button>
		</div>`
		: "";
	
	const resultHtml = state.result
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999;"><strong>${STATUS_MESSAGES.RESULT}</strong> ${state.result.label}</div>`
		: "";
	return `
		<div class="${CSS_CLASSES.CONTEST}" style="border:1px solid #777; padding:6px; background:#f8f8f8;">
			${actionRow}
			${reactionRow}
			${resolveButton}
			${resultHtml}
		</div>
	`;
}

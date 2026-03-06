/**
 * Preparation flow helpers for stat selection and formula confirmation.
 */

import {
	rollProcessGambitDefaults,
	getPairAdvantage,
	getPairAdvantageChosenBy
} from "./state.js";
import { DIALOG_MESSAGES, NOTIFICATION_MESSAGES } from "./constants.js";
import {
	getActorDisplayName,
	showRollReadyDialog,
	showSpecialStatSelectionDialog
} from "../../dialog.js";
import { prepareFormula, statValueToDiceCount } from "../../dice.js";

let findRoller, requestStat;

/**
 * Initialize prepare-flow dependencies.
 * @param {Object} deps
 */
export function initPrepareFlow(deps) {
	findRoller = deps.findRoller;
	requestStat = deps.requestStat;
}

/**
 * Prepare a single roll step (stat selection only, no roll execution).
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} state
 * @param {string|null} [messageId=null]
 * @param {boolean} [isFeint=false]
 * @returns {Promise<Object|null>}
 */
export async function prepareOneStep(side, rollIndex, state, messageId = null, isFeint = false) {
	const advantage = getPairAdvantage(state, side);
	const actor = await findRoller(0, side === "reaction");
	if (!actor) return null;

	const advantageLocked = !isFeint && advantage !== null && advantage !== undefined;
	const advantageValue = advantageLocked ? advantage : 0;
	const advantageChosenBy = getPairAdvantageChosenBy(state, side) || "";
	const advantageLockReason = advantageLocked ? DIALOG_MESSAGES.STAT_SELECTION.ADVANTAGE_LOCKED_FOR_PAIR : "";

	const allowFeint = !isFeint;
	const allowFudge = false;
	const allowGambit = allowFeint || allowFudge;

	const stat = await requestStat(actor, {
		showLuckOptions: true,
		allowFeint,
		allowGambit,
		advantageLocked,
		advantageValue,
		advantageChosenBy,
		advantageLockReason,
		gambitDefaults: rollProcessGambitDefaults,
		title: DIALOG_MESSAGES.PREPARE_ROLL.TITLE(side, rollIndex)
	});
	if (!stat) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.STAT_SELECTION_CANCELLED);
		return null;
	}

	rollProcessGambitDefaults.feint = !!stat.gambitSelections?.feint;

	const specialStatSelected = await showSpecialStatSelectionDialog(actor, stat.key, stat.label);

	return {
		actorUuid: actor.uuid,
		luckActorUuid: stat.luckActorUuid || null,
		actorName: getActorDisplayName(actor),
		statKey: stat.key,
		statLabel: stat.label,
		statValue: stat.value,
		baseFormula: `(${statValueToDiceCount(stat.value)}d6cs>=5)`,
		advantage: Number(stat.advantage || 0),
		feintCount: stat.feintCount || 0,
		feintGambits: Array(stat.feintCount || 0).fill(!!stat.gambitSelections?.feint),
		gambitSelections: stat.gambitSelections || null,
		specialStatSelected: specialStatSelected || null
	};
}

/**
 * Execute formula preparation for a prepared roll.
 * @param {string} actorId
 * @param {string} baseFormula
 * @param {string} statKey
 * @param {string} statLabel
 * @param {number} advantage
 * @param {Object} data
 * @param {boolean} useFudge
 * @param {boolean} gambitForFudge
 * @param {boolean} showFudge
 * @param {string} fudgeLockReason
 * @param {string} context
 * @param {string|null} luckActorUuid
 * @returns {Promise<{formula:string,useFudge:boolean,useGambitForFudge:boolean}|null>}
 */
export async function prepareRollFormulaSelection(actorId, baseFormula, statKey, statLabel, advantage, data, useFudge = false, gambitForFudge = false, showFudge = true, fudgeLockReason = "", context = "", luckActorUuid = null) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;

	const advantagePhrase = DIALOG_MESSAGES.STAT_SELECTION.ADVANTAGE_PHRASE(advantage);
	const formulaResult = await prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge, gambitForFudge, showFudge, fudgeLockReason, context, luckActorUuid);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	const chosenFudge = !!formulaResult?.useFudge;
	const chosenGambitForFudge = !!formulaResult?.useGambitForFudge;

	const confirmed = await showRollReadyDialog({
		statLabel,
		advantagePhrase,
		formula: finalFormula
	});
	if (!confirmed) return null;

	return {
		formula: finalFormula,
		useFudge: chosenFudge,
		useGambitForFudge: chosenGambitForFudge
	};
}

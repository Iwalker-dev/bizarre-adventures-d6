/**
 * Roll execution helpers for prepared contest rolls.
 */

import { spendLuckMove } from "../../luck-moves.js";
import { buildRollSnapshot, playDiceAnimation } from "../../dice.js";

/**
 * Execute an already-prepared roll formula (spend Luck + roll dice).
 * @param {string} actorId
 * @param {string} finalFormula
 * @param {number} advantage
 * @param {Object} data
 * @param {number} [feintCount=0]
 * @param {boolean} [gambitForFeint=false]
 * @param {boolean} [useFudge=false]
 * @param {boolean} [gambitForFudge=false]
 * @param {boolean} [suppressMessage=false]
 * @param {string|null} [luckActorUuid=null]
 * @returns {Promise<{total:number,snapshot:Object,useFudge:boolean,effectiveAdvantage:number,rollHtml:string}|null>}
 */
export async function executePreparedRoll(actorId, finalFormula, advantage, data, feintCount = 0, gambitForFeint = false, useFudge = false, gambitForFudge = false, suppressMessage = false, luckActorUuid = null) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;
	const luckActor = luckActorUuid ? await fromUuid(luckActorUuid) : actor;

	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", gambitForFeint, feintCount, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	if (useFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", gambitForFudge, 0, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });
	const rollHtml = await roll.render();
	if (!suppressMessage) {
		const speaker = ChatMessage.getSpeaker({ actor });
		await roll.toMessage({ speaker });
	}

	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return { total: roll.total, snapshot, useFudge, effectiveAdvantage, rollHtml };
}

/**
 * Resolution phase helpers for contest processing.
 */

import { getRollOrder, parseQuadrant, getFirstUnresolvedStep } from "./state.js";
import { DIALOG_MESSAGES, NOTIFICATION_MESSAGES } from "./constants.js";

/**
 * Prepare all unresolved quadrants into an execution queue.
 * @param {Object} params
 * @returns {Promise<{status:"ok",collectedRolls:Object[]}|{status:"error",message:string}|{status:"cancelled"}>}
 */
export async function prepareResolutionQueue(params) {
	const {
		state,
		stagedFudgeBy,
		findOwner,
		showConfirmRollerDialog,
		executePrepareRollFormulaAsUser,
		prepareRollFormulaSelection,
		rollProcessGambitDefaults
	} = params;

	const order = getRollOrder(state.hasReaction);
	const collectedRolls = [];

	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const { side, rollIndex } = parsed;
		const preparedRoll = state[side].rolls[rollIndex];
		if (!preparedRoll?.prepared || preparedRoll?.resolved) continue;

		const pair = state[side];
		const actor = await fromUuid(preparedRoll.actorUuid);
		if (!actor) {
			return { status: "error", message: NOTIFICATION_MESSAGES.PREPARE_FORMULA_FAILED(side, rollIndex) };
		}

		const advantage = Number(preparedRoll.advantage ?? pair.advantage ?? 0);
		const feintCount = Number(preparedRoll.feintCount || 0);
		const gambitForFeint = !!preparedRoll.gambitSelections?.feint;
		const showFudge = true;
		const currentFudgeBy = stagedFudgeBy[side];
		const fudgeLockReason = currentFudgeBy ? DIALOG_MESSAGES.OPTIONAL_FORMULA.FUDGE_USED_BY(currentFudgeBy) : "";
		const hasOwner = Object.entries(actor.ownership || {})
			.some(([uid, lvl]) => {
				const user = game.users.get(uid);
				return user?.active && !user.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
			});
		const owner = hasOwner ? findOwner(actor) : null;
		const data = actor.getRollData();
		const context = DIALOG_MESSAGES.PREPARE_ROLL.CONTEXT(side, rollIndex);

		let formulaResult;
		let delegatedToOwner = false;
		if (game.user.isGM && hasOwner && owner && await showConfirmRollerDialog()) {
			delegatedToOwner = true;
			formulaResult = await executePrepareRollFormulaAsUser(
				owner.id,
				actor.id,
				preparedRoll.baseFormula,
				preparedRoll.statKey,
				preparedRoll.statLabel,
				advantage,
				data,
				false,
				rollProcessGambitDefaults.fudge,
				showFudge,
				fudgeLockReason,
				context,
				preparedRoll.luckActorUuid || null
			);
		} else {
			formulaResult = await prepareRollFormulaSelection(
				actor.id,
				preparedRoll.baseFormula,
				preparedRoll.statKey,
				preparedRoll.statLabel,
				advantage,
				data,
				false,
				rollProcessGambitDefaults.fudge,
				showFudge,
				fudgeLockReason,
				context,
				preparedRoll.luckActorUuid || null
			);
		}

		if (formulaResult === null) {
			return { status: "cancelled" };
		}

		const finalFormula = formulaResult?.formula ?? formulaResult;
		const useFudge = !!formulaResult?.useFudge;
		const gambitForFudge = !!formulaResult?.useGambitForFudge;
		rollProcessGambitDefaults.fudge = gambitForFudge;
		if (useFudge && !stagedFudgeBy[side]) stagedFudgeBy[side] = preparedRoll.actorName || "Unknown";

		collectedRolls.push({
			side,
			rollIndex,
			isFeinting: !!preparedRoll.isFeinting,
			actor,
			owner,
			delegatedToOwner,
			luckActorUuid: preparedRoll.luckActorUuid || null,
			actorName: preparedRoll.actorName,
			statKey: preparedRoll.statKey,
			statLabel: preparedRoll.statLabel,
			advantage,
			feintCount,
			gambitForFeint,
			useFudge,
			gambitForFudge,
			finalFormula,
			data
		});
	}

	return { status: "ok", collectedRolls };
}

/**
 * Execute prepared roll queue and apply results to state.
 * @param {Object} params
 * @returns {Promise<{status:"ok"}|{status:"error",message:string}|{status:"feint-reset"}>}
 */
export async function executeResolutionQueue(params) {
	const {
		state,
		message,
		collectedRolls,
		executePreparedRollAsUser,
		executePreparedRoll,
		spendLuckMove,
		applyRollToState,
		updateContestMessage
	} = params;

	for (const preparedRoll of collectedRolls) {
		const rollResult = preparedRoll.delegatedToOwner && preparedRoll.owner
			? await executePreparedRollAsUser(
				preparedRoll.owner.id,
				preparedRoll.actor.id,
				preparedRoll.finalFormula,
				preparedRoll.advantage,
				preparedRoll.data,
				preparedRoll.feintCount,
				preparedRoll.gambitForFeint,
				preparedRoll.useFudge,
				preparedRoll.gambitForFudge,
				true,
				preparedRoll.luckActorUuid
			)
			: await executePreparedRoll(
				preparedRoll.actor.id,
				preparedRoll.finalFormula,
				preparedRoll.advantage,
				preparedRoll.data,
				preparedRoll.feintCount,
				preparedRoll.gambitForFeint,
				preparedRoll.useFudge,
				preparedRoll.gambitForFudge,
				true,
				preparedRoll.luckActorUuid
			);

		if (!rollResult) {
			return { status: "error", message: NOTIFICATION_MESSAGES.EXECUTE_ROLL_FAILED(preparedRoll.side, preparedRoll.rollIndex) };
		}

		const resolvedRoll = {
			actorUuid: preparedRoll.actor.uuid,
			luckActorUuid: preparedRoll.luckActorUuid,
			actorName: preparedRoll.actorName,
			statKey: preparedRoll.statKey,
			statLabel: preparedRoll.statLabel,
			formula: preparedRoll.finalFormula,
			diceResults: rollResult.snapshot?.diceResults || null,
			total: rollResult.total,
			advantage: preparedRoll.advantage,
			effectiveAdvantage: rollResult.effectiveAdvantage ?? preparedRoll.advantage,
			useFudge: preparedRoll.useFudge,
			useGambit: preparedRoll.gambitForFeint,
			feintCount: preparedRoll.feintCount,
			luckMovesUsed: [
				...(preparedRoll.feintCount > 0 ? [{ move: "feint", gambit: !!preparedRoll.gambitForFeint, count: Number(preparedRoll.feintCount || 1) }] : []),
				...(preparedRoll.useFudge ? [{ move: "fudge", gambit: !!preparedRoll.gambitForFudge, count: 1 }] : [])
			],
			snapshot: rollResult.snapshot,
			rollHtml: rollResult.rollHtml || null
		};

		if (preparedRoll.isFeinting) {
			const feintLuckActor = preparedRoll.luckActorUuid
				? await fromUuid(preparedRoll.luckActorUuid)
				: preparedRoll.actor;
			const feintSpend = await spendLuckMove(
				preparedRoll.actor,
				"feint",
				preparedRoll.gambitForFeint,
				1,
				feintLuckActor || preparedRoll.actor
			);
			if (!feintSpend.success) {
				return { status: "error", message: feintSpend.error || NOTIFICATION_MESSAGES.FEINT_LUCK_SPEND_FAILED };
			}
		}

		applyRollToState(state, preparedRoll.side, preparedRoll.rollIndex, resolvedRoll);

		if (preparedRoll.isFeinting) {
			state.result = null;
			state.nextStep = getFirstUnresolvedStep(state);
			await updateContestMessage(message, state);
			return { status: "feint-reset" };
		}

		await updateContestMessage(message, state);
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	return { status: "ok" };
}

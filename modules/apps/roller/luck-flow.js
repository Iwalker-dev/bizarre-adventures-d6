/**
 * Post-roll luck lifecycle helpers (mulligan/persist).
 */

import { SYSTEM_ID, CONTEST_FLAG, STATUS_MESSAGES } from "./constants.js";
import { rollProcessGambitDefaults } from "./state.js";
import { canUseLuckMove, spendLuckMove } from "../../luck-moves.js";
import { getActorDisplayName, showMulliganDialog, showPersistDialog, escapeHtml } from "../../dialog.js";
import { countSuccesses } from "../../dice.js";

/**
 * Handle post-roll luck moves (mulligan/persist).
 * @param {Object} pair
 * @param {Actor} actor
 * @param {Object} context
 * @returns {Promise<{resetPair:boolean,persistActorName?:string}>}
 */
export async function handlePostRollLuck(pair, actor, context = {}) {
	const { state, side, messageId } = context;
	const roll1 = pair.rolls[1];
	const roll2 = pair.rolls[2];
	const snaps = [roll1?.snapshot, roll2?.snapshot];
	if (!snaps[0] || !snaps[1] || !actor) return { resetPair: false };

	const luckActorUuid = roll2?.luckActorUuid || roll1?.luckActorUuid || null;
	const luckActor = luckActorUuid ? await fromUuid(luckActorUuid) : actor;

	const advValue = Number(pair.advantage || 0);
	const mulliganCheck = canUseLuckMove(actor, "mulligan", rollProcessGambitDefaults.mulligan, luckActor);
	if (advValue <= 2 && mulliganCheck.canUse) {
		const mulliganResult = await showMulliganDialog({
			gambitDefault: !!rollProcessGambitDefaults.mulligan
		});
		if (mulliganResult) {
			rollProcessGambitDefaults.mulligan = !!mulliganResult.useGambit;
		}
		if (mulliganResult?.confirmed) {
			const spend = await spendLuckMove(actor, "mulligan", mulliganResult.useGambit, 0, luckActor);
			if (!spend.success && spend.error) ui.notifications.error(spend.error);
			const appendLuckMove = (rollState, move, gambit, count = 1) => {
				if (!rollState) return;
				if (!Array.isArray(rollState.luckMovesUsed)) rollState.luckMovesUsed = [];
				rollState.luckMovesUsed.push({ move, gambit: !!gambit, count: Number(count || 1) });
			};
			appendLuckMove(roll1, "mulligan", mulliganResult.useGambit, 1);
			appendLuckMove(roll2, "mulligan", mulliganResult.useGambit, 1);
			const updatedTotals = [roll1, roll2].map((roll) => {
				const snap = roll.snapshot;
				const previousThreshold = Number(snap.threshold || 0);
				const previousTotal = Number(roll.total ?? snap.total ?? 0);
				const newThreshold = previousThreshold - 1;
				const newSuccesses = countSuccesses(snap.diceResults, newThreshold);
				const newTotal = newSuccesses + snap.delta;
				snap.threshold = newThreshold;
				snap.total = newTotal;
				roll.total = newTotal;
				roll.effectiveAdvantage = Number(roll.effectiveAdvantage ?? roll.advantage ?? 0) + 1;
				roll.mulliganApplied = true;
				roll.mulliganNote = `Mulligan: ${previousTotal} → ${newTotal} (cs>=${previousThreshold} → cs>=${newThreshold})`;
				return newTotal;
			});
			pair.mulliganNote = STATUS_MESSAGES.MULLIGAN_APPLIED;
			pair.total = updatedTotals.reduce((sum, value) => sum + Number(value || 0), 0);
		}
	}

	const isContest = !!state?.hasReaction;
	const diff = (isContest && state?.action?.total !== null && state?.reaction?.total !== null)
		? Number(state.action.total) - Number(state.reaction.total)
		: null;
	const persistAllowed = !isContest || (diff !== null && ((diff < 0 && side === "action") || (diff > 0 && side === "reaction")));
	if (!persistAllowed) return { resetPair: false };

	const getPersistLockState = () => {
		const latest = messageId ? game.messages.get(messageId) : null;
		const latestState = latest?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
		const latestPair = latestState?.[side];
		const lock = latestPair?.persistLock;
		if (lock && lock.expiresAt > Date.now()) {
			return { locked: true, reason: STATUS_MESSAGES.PERSIST_ALREADY_CHOSEN_BY(lock.by) };
		}
		return { locked: false };
	};
	const initialLock = getPersistLockState();

	const persistCandidates = [];
	const candidateMap = new Map();
	if (roll1?.actorUuid) {
		const actor1 = await fromUuid(roll1.actorUuid);
		if (actor1) {
			persistCandidates.push({ actor: actor1, luckActorUuid: roll1.luckActorUuid || null });
			candidateMap.set(actor1.uuid, actor1);
		}
	}
	if (roll2?.actorUuid) {
		const actor2 = await fromUuid(roll2.actorUuid);
		if (actor2 && !candidateMap.has(actor2.uuid)) {
			persistCandidates.push({ actor: actor2, luckActorUuid: roll2.luckActorUuid || null });
			candidateMap.set(actor2.uuid, actor2);
		}
	}
	const hasNonGmOwner = (candidate) => {
		const ownership = candidate?.actor?.ownership || {};
		return Object.entries(ownership).some(([uid, lvl]) => {
			const user = game.users.get(uid);
			return user?.active && !user.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
		});
	};
	persistCandidates.sort((a, b) => {
		const aPlayer = hasNonGmOwner(a);
		const bPlayer = hasNonGmOwner(b);
		if (aPlayer === bPlayer) return 0;
		return aPlayer ? -1 : 1;
	});

	for (const candidate of persistCandidates) {
		const candidateActor = candidate.actor;
		const candidateLuckActor = candidate.luckActorUuid ? await fromUuid(candidate.luckActorUuid) : candidateActor;
		const persistCheck = canUseLuckMove(candidateActor, "persist", rollProcessGambitDefaults.persist, candidateLuckActor);
		if (!persistCheck.canUse) continue;
		const persistResult = await showPersistDialog({
			gambitDefault: !!rollProcessGambitDefaults.persist,
			lockReason: initialLock?.locked ? initialLock.reason : "",
			lockCheck: getPersistLockState,
			autoCloseMs: 5000,
			context: side === "reaction" ? "Reaction" : "Action"
		});
		if (persistResult) {
			rollProcessGambitDefaults.persist = !!persistResult.useGambit;
		}
		if (persistResult?.confirmed) {
			const spend = await spendLuckMove(candidateActor, "persist", persistResult.useGambit, 0, candidateLuckActor);
			if (!spend.success && spend.error) ui.notifications.error(spend.error);
			const actorName = getActorDisplayName(candidateActor) || "Unknown";
			pair.persistLock = {
				by: getActorDisplayName(candidateActor),
				expiresAt: Date.now() + 5000
			};
			pair.persistCount = Number(pair.persistCount || 0) + 1;
			pair.persistNote = STATUS_MESSAGES.PERSIST_NOTE(escapeHtml(actorName), pair.persistCount);
			return { resetPair: true, persistActorName: getActorDisplayName(candidateActor) };
		}
	}

	return { resetPair: false };
}

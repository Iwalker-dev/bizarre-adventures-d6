/**
 * Contest resolution logic for BAD6 roller.
 * Handles roll preparation, execution, and post-roll luck moves.
 */

import { SYSTEM_ID, CONTEST_FLAG } from "./constants.js";
import {
	rollProcessGambitDefaults,
	getQuadrantRoll,
	allQuadrantsPrepared,
	anyQuadrantsResolved,
	getRollOrder,
	parseQuadrant,
	getFirstUnresolvedStep,
	closeContestDialogs,
	applyRollToState,
	resetPairState,
	createContestState,
	getContestStateFromMessage
} from "./state.js";
import { buildContestHtml } from "./render.js";
import { 
	canUseLuckMove, 
	spendLuckMove
} from "../../luck-moves.js";
import { 
	getActorDisplayName,
	showRollReadyDialog,
	showSpecialStatSelectionDialog,
	showConfirmRollerDialog,
	showChoiceDialog,
	showMulliganDialog,
	showPersistDialog,
	escapeHtml
} from "../../dialog.js";
import { 
	prepareFormula,
	statValueToDiceCount,
	buildRollSnapshot,
	playDiceAnimation,
	countSuccesses
} from "../../dice.js";
import { isDebugEnabled } from "../../config.js";

// Import dependencies that will be injected
let socket, findOwner, findRoller, requestStat, updateContestMessage, convDC, convHit;

/**
 * Initialize resolution module dependencies.
 * @param {Object} deps
 */
export function initResolution(deps) {
	socket = deps.socket;
	findOwner = deps.findOwner;
	findRoller = deps.findRoller;
	requestStat = deps.requestStat;
	updateContestMessage = deps.updateContestMessage;
	convDC = deps.convDC;
	convHit = deps.convHit;
}

/**
 * Update contest result based on totals.
 * @param {Object} state
 * @returns {void}
 */
export function updateResultState(state) {
	if (!state.hasReaction) {
		if (state.action.total !== null) {
			state.result = {
				type: "dc",
				label: `Total: ${state.action.total}! ${convDC(state.action.total)}`
			};
		}
		return;
	}
	if (state.action.total === null || state.reaction.total === null) return;
	const diff = Number(state.action.total) - Number(state.reaction.total);
	if (diff === 0) {
		state.result = { type: "clash", label: "Clash!" };
		return;
	}
	if (diff < 0) {
		state.result = { type: "reaction", label: `Reactor succeeds (${Math.abs(diff)})` };
		return;
	}
	state.result = { type: "action", label: `Attackers win: ${convHit(diff)} (${diff})` };
}

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
			const updatedTotals = [roll1, roll2].map((r) => {
				const snap = r.snapshot;
				const previousThreshold = Number(snap.threshold || 0);
				const previousTotal = Number(r.total ?? snap.total ?? 0);
				const newThreshold = previousThreshold - 1;
				const newSuccesses = countSuccesses(snap.diceResults, newThreshold);
				const newTotal = newSuccesses + snap.delta;
				snap.threshold = newThreshold;
				snap.total = newTotal;
				r.total = newTotal;
				r.effectiveAdvantage = Number(r.effectiveAdvantage ?? r.advantage ?? 0) + 1;
				r.mulliganApplied = true;
				r.mulliganNote = `Mulligan: ${previousTotal} → ${newTotal} (cs>=${previousThreshold} → cs>=${newThreshold})`;
				return newTotal;
			});
			pair.mulliganNote = "Mulligan applied (+1 Advantage)";
			pair.total = updatedTotals.reduce((sum, n) => sum + Number(n || 0), 0);
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
			return { locked: true, reason: `Persist already chosen by ${lock.by}.` };
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
			const u = game.users.get(uid);
			return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
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
			const countSuffix = pair.persistCount > 1 ? ` ×${pair.persistCount}` : "";
			pair.persistNote = `✨ Persist: ${escapeHtml(actorName)}${countSuffix}`;
			return { resetPair: true, persistActorName: getActorDisplayName(candidateActor) };
		}
	}
	return { resetPair: false };
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
	const pair = state[side];
	let advantage = pair.advantage;
	const actor = await findRoller(0, side === "reaction");
	if (!actor) return null;

	const advantageLocked = advantage !== null && advantage !== undefined;
	const advantageValue = advantageLocked ? advantage : 0;
	const advantageChosenBy = pair.advantageChosenBy || "";
	const advantageLockReason = advantageLocked ? "Advantage already locked for this pair." : "";

	const allowFeint = !isFeint; // Don't allow feint selection when feinting
	const allowFudge = false; // Fudge happens at resolution time
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
		title: `Prepare ${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`
	});
	if (!stat) {
		ui.notifications.warn("Stat selection cancelled.");
		return null;
	}

	rollProcessGambitDefaults.feint = !!stat.gambitSelections?.feint;

	// Ask user to select a special stat if any exist for this stat
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

	const advantagePhrase = advantage > 0 ? `+${advantage} Advantage` : "No Advantage";
	
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

/**
 * Resolve all prepared rolls in a contest.
 * @param {Object} state
 * @param {string|null} messageId
 * @returns {Promise<void>}
 */
export async function resolveContest(state, messageId) {
	const message = messageId ? game.messages.get(messageId) : null;
	if (!message) return;
	
	// Always read fresh state to prevent race conditions
	const freshState = getContestStateFromMessage(message);
	if (!freshState) {
		ui.notifications.error("Cannot resolve: message state not found.");
		return;
	}
	
	if (freshState.isResolving) {
		ui.notifications.warn("Another user is already resolving this contest.");
		return;
	}
	
	// Use fresh state from now on
	state = freshState;
	
	if (!allQuadrantsPrepared(state) || anyQuadrantsResolved(state)) {
		ui.notifications.warn("Cannot resolve: not all rolls are prepared or some are already resolved.");
		return;
	}

	// Mark that resolution is starting
	state.isResolving = true;
	closeContestDialogs();

	const order = getRollOrder(state.hasReaction);
	const collectedRolls = [];
	const stagedFudgeBy = {
		action: state.action?.fudgeChosenBy || null,
		reaction: state.reaction?.fudgeChosenBy || null
	};

	// Formula preparation phase: fully prepare every quadrant before any dice are rolled.
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const { side, rollIndex } = parsed;
		const preparedRoll = state[side].rolls[rollIndex];
		if (!preparedRoll?.prepared || preparedRoll?.resolved) continue;

		const pair = state[side];
		const actor = await fromUuid(preparedRoll.actorUuid);
		if (!actor) {
			state.isResolving = false;
			await updateContestMessage(message, state);
			ui.notifications.error(`Failed to prepare formula for ${side} roll ${rollIndex}`);
			return;
		}

		const advantage = Number(preparedRoll.advantage ?? pair.advantage ?? 0);
		const feintCount = Number(preparedRoll.feintCount || 0);
		const gambitForFeint = !!preparedRoll.gambitSelections?.feint;
		const showFudge = true;
		const currentFudgeBy = stagedFudgeBy[side];
		const fudgeLockReason = currentFudgeBy ? `Fudge used by ${currentFudgeBy}!` : "";
		const hasOwner = Object.entries(actor.ownership || {})
			.some(([uid, lvl]) => {
				const u = game.users.get(uid);
				return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
			});
		const owner = hasOwner ? findOwner(actor) : null;
		const data = actor.getRollData();
		const context = `${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`;

		let formulaResult;
		let delegatedToOwner = false;
		if (game.user.isGM && hasOwner && owner && await showConfirmRollerDialog()) {
			delegatedToOwner = true;
			formulaResult = await socket.executeAsUser(
				"prepareRollFormula",
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
			state.isResolving = false;
			await updateContestMessage(message, state);
			ui.notifications.warn("Resolution cancelled. Click Resolve Contest to start over.");
			return;
		}

		const finalFormula = formulaResult?.formula ?? formulaResult;
		const useFudge = !!formulaResult?.useFudge;
		const gambitForFudge = !!formulaResult?.useGambitForFudge;
		rollProcessGambitDefaults.fudge = gambitForFudge;
		if (useFudge && !stagedFudgeBy[side]) stagedFudgeBy[side] = preparedRoll.actorName || "Unknown";

		collectedRolls.push({
			side,
			rollIndex,
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
	
	// Execution phase: roll all dice only after every formula is fully prepared.
	for (const preparedRoll of collectedRolls) {
		const rollResult = preparedRoll.delegatedToOwner && preparedRoll.owner
			? await socket.executeAsUser(
				"executePreparedRoll",
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
			state.isResolving = false;
			await updateContestMessage(message, state);
			ui.notifications.error(`Failed to execute ${preparedRoll.side} roll ${preparedRoll.rollIndex}`);
			return;
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
			snapshot: rollResult.snapshot,
			rollHtml: rollResult.rollHtml || null
		};

		// Apply the result to state
		await applyRollToState(state, preparedRoll.side, preparedRoll.rollIndex, resolvedRoll);
		
		// Update the chat message after each roll
		await updateContestMessage(message, state);
		
		// Small delay to let animations play
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	// Handle post-roll luck moves after each pair completes
	for (const side of ["reaction", "action"]) {
		const pair = state[side];
		if (pair.rolls[1]?.resolved && pair.rolls[2]?.resolved) {
			const actor2 = pair.rolls[2]?.actorUuid ? await fromUuid(pair.rolls[2].actorUuid) : null;
			if (actor2) {
				const { resetPair, persistActorName } = await handlePostRollLuck(pair, actor2, {
					state,
					side,
					messageId
				});
				
				if (resetPair) {
					// Persist was used - reset pairs and return to prepare phase
					if (side === "action") {
						resetPairState(state.action);
						resetPairState(state.reaction);
						state.result = null;
						state.nextStep = getRollOrder(state.hasReaction)[0];
					} else {
						resetPairState(pair);
						state.result = null;
						state.nextStep = "reaction-1";
					}
					
					if (persistActorName) {
						ChatMessage.create({
							speaker: ChatMessage.getSpeaker({ actor: actor2 || undefined}),
							content: `✨ Persist used by <strong>${escapeHtml(persistActorName)}</strong>`
						});
					}
					
					state.isResolving = false;
					await updateContestMessage(message, state);
					return; // Stop resolution, return to prep phase
				}
			}
		}
	}

	// Update final result
	updateResultState(state);
	
	// Handle clash scenario
	if (state.result?.type === "clash") {
		const nextState = createContestState(state.hasReaction);
		nextState.action.persistCount = state.action.persistCount;
		nextState.action.persistNote = state.action.persistNote;
		nextState.reaction.persistCount = state.reaction.persistCount;
		nextState.reaction.persistNote = state.reaction.persistNote;
		nextState.nextStep = getRollOrder(nextState.hasReaction)[0];
		
		await updateContestMessage(message, state);
		
		const speakerActorUuid = state.action.rolls[1]?.actorUuid || state.reaction.rolls[1]?.actorUuid;
		const speakerActor = speakerActorUuid ? await fromUuid(speakerActorUuid) : null;
		
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: speakerActor || undefined }),
			content: buildContestHtml(nextState),
			flags: {
				[SYSTEM_ID]: {
					[CONTEST_FLAG]: nextState
				}
			}
		});
		state.isResolving = false;
		return;
	}
	
	state.isResolving = false;
	await updateContestMessage(message, state);
}

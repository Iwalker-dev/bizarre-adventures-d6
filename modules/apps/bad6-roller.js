let socket;

import { prepareFormula } from "../dice.js";
import { 
	canUseLuckMove, 
	spendLuckMove, 
	getAvailableLuckMoves, 
	applyLuckMoveEffect, 
	LUCK_MOVES 
} from "../luck-moves.js";
import {
	showChoiceDialog,
	showRollReadyDialog,
	showConfirmRollerDialog,
	showMulliganDialog,
	showPersistDialog,
	showStatDialog
} from "../dialog.js";
import { DEBUG_LOGS } from "../config.js";

// Register socket function as soon as socketlib is ready
Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem("bizarre-adventures-d6");
	socket.register("pCheck", readyCheck);
	socket.register("updateContestMessage", updateContestMessageAsGM);
});

// Inject button on init
Hooks.once("init", () => {
	rollerControl();
});

// Helper function
function escapeHtml(str) {
	if (str === undefined || str === null) return '';
	return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}

function parseThreshold(formula) {
	const match = /cs\s*>=\s*([0-9]+)/i.exec(formula || "");
	return match ? Number(match[1]) : 5;
}

function extractDiceResults(roll) {
	const dice = roll?.dice?.[0];
	if (!dice || !Array.isArray(dice.results)) return [];
	return dice.results.map(r => Number(r.result)).filter(n => !Number.isNaN(n));
}

function countSuccesses(results, threshold) {
	return results.reduce((sum, n) => sum + (n >= threshold ? 1 : 0), 0);
}

function buildRollSnapshot(roll, formula, advantage) {
	const threshold = parseThreshold(formula);
	const diceResults = extractDiceResults(roll);
	const baseSuccesses = countSuccesses(diceResults, threshold);
	const delta = (roll?.total ?? 0) - baseSuccesses;
	return {
		formula,
		threshold,
		diceResults,
		delta,
		advantage: Number(advantage || 0),
		total: roll?.total ?? 0
	};
}

async function playDiceAnimation(roll) {
    const dice3d = game?.dice3d;
    if (!dice3d?.showForRoll) return;

    const users = game.users
        .filter(u => u.active)
        .map(u => u.id);

    await dice3d.showForRoll(roll, game.user, {
        synchronize: true,
        users
    });
}

export function rollerControl() {
	Hooks.on("getSceneControlButtons", (controls) => {
		const tokenControls = controls.tokens;
		if (!tokenControls) return;

		tokenControls.tools["rollerButton"] = {
			name: "rollerButton"
			, title: "D6 Roller"
			, icon: "fas fa-dice-d6"
			, visible: true
			, button: true
			, order: 50
			, onClick: () => main()
		};
	});
}

// Takes an actorId, not an Actor instance
async function readyCheck(actorId, baseFormula, statKey, statLabel, advantage, data, feintCount = 0, useFudge = false, gambitForFeint = false, gambitForFudge = false, showFudge = true, fudgeLockReason = "", suppressMessage = false, luckActorUuid = null) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;
	const luckActor = luckActorUuid ? await fromUuid(luckActorUuid) : actor;

	const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
	// Let dice helpers prepare the final formula using items on the actor
	const formulaResult = await prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge, gambitForFudge, showFudge, fudgeLockReason);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	rollProcessGambitDefaults.fudge = !!formulaResult?.useGambitForFudge;
	const confirmed = await showRollReadyDialog({
		statLabel,
		advantagePhrase,
		formula: finalFormula
	});
	if (!confirmed) return null;

	// Handle Feint cost deduction
	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", gambitForFeint, feintCount, luckActor);
		if (!success && error) {
			ui.notifications.error(error);
		}
	}

	// Handle Fudge cost deduction (when used)
	if (useFudge && showFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", gambitForFudge, 0, luckActor);
		if (!success && error) {
			ui.notifications.error(error);
		}
	}

	const roll = new Roll(finalFormula, data);
	await roll.evaluate({
		async: true
	});
	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	const fudgeNote = useFudge ? ` (+1 Fudged)` : "";
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return { total: roll.total, snapshot, useFudge, effectiveAdvantage };
}

async function findRoller(i, reaction = false) {
	if (game.user.isGM) {
		if (DEBUG_LOGS) {
			console.warn("BAD6 | reaction:", reaction);
		}
		let token;
		let roller;
		// Roll the same actor for both rolls if only one token is selected
		if (canvas.tokens.controlled.length === 1) i = 0;
		token = canvas.tokens.controlled[i];
		if (!token) {
			ui.notifications.warn("No token selected. Select up to 2.");
			return null;
		}
		roller = token.actor;
		// If there are valid remaining targets, use them instead
		if (reaction) {
			if (game.user.targets.size > 0) {
				// Roll the same reactor for both rolls if only one token is selected
				if (game.user.targets.size === 1) i = 0;
				token = Array.from(game.user.targets)[i];
				if (!token) {
					ui.notifications.warn("No token selected. Select up to 2.");
					return null;
				}
				roller = token.actor;
			} else {
				// No targets: fall back to additional controlled tokens
				if (canvas.tokens.controlled.length === 1) i = 0;
				token = canvas.tokens.controlled[i];
				if (!token) {
					ui.notifications.warn("No token selected. Select up to 2.");
					return null;
				}
				roller = token.actor;
			}
		}
		if (DEBUG_LOGS) {
			console.warn("BAD6 | Roller chosen:", roller.name);
		}
		// Otherwise use the controlled token
		return new Promise(async (resolve) => {
			// Get linked actors from the actor's bio
			const linkedActors = roller.system.bio.linkedActors?.value || [];
			if (DEBUG_LOGS) {
				console.warn("BAD6 | Linked actors:", linkedActors);
			}
			if (linkedActors.length === 0) {
				ui.notifications.warn("No linked abilities found. Defaulting to original roller.");
				return resolve(roller);
			}
			let buttons = {
				[roller.id]: {
					label: roller.name,
					callback: () => roller
				}
			};
			// Fetch each linked actor and create a button
			for (let linked of linkedActors) {
				const actor = await fromUuid(linked.uuid);
				if (actor) {
					buttons[linked.uuid] = {
						label: `${linked.name} (${linked.type})`,
						callback: () => actor
					};
				}
			}
			const choice = await showChoiceDialog({
				title: "Choose Roller",
				content: "<p>Select an ability to use:</p>",
				buttons,
				defaultId: Object.keys(buttons)[0],
				closeValue: null
			});
			resolve(choice || null);
		});
	}
	const owned = game.actors.filter(a => a.isOwner);
	if (owned.length === 0) {
		ui.notifications.warn("You don't own any actors. A player may only roll from their owned actors.");
		return null;
	}
	if (owned.length === 1) return owned[0];

	return new Promise(async resolve => {
		const buttons = {};
		for (let a of owned) {
			buttons[a.id] = {
				label: a.name,
				callback: () => a
			};
		}
		const choice = await showChoiceDialog({
			title: "Choose an Actor",
			content: "<p>Select an actor:</p>",
			buttons,
			defaultId: Object.keys(buttons)[0],
			closeValue: null
		});
		resolve(choice || null);
	});
}

function requestStat(actor, options = {}) {
	return showStatDialog(actor, options);
}


function convDC(value) {
	const map = {
		0: "Trivial"
		, 1: "Easy"
		, 2: "Challenging"
		, 3: "Dire"
		, 4: "Herculean"
		, 5: "Extraordinary"
		, 6: "Superhuman"
		, 7: "Unbelievable"
		, 8: "Surreal"
		, 9: "Absurd"
		, 10: "Nigh-Impossible"
	};
	return map[value] || "Literally Impossible";
}

function convHit(value) {
	const map = {
		0: "Clash!"
		, 1: "Minor"
		, 2: "Moderate"
		, 3: "Serious"
		, 4: "Debilitating"
		, 5: "Critical"
		, 6: "Macabre"
	};
	if (value > 6) return "Grindhouse";
	return map[value] || "Invalid Hit";
}


// Helper to find a non-GM owner or fallback to GM
function findOwner(actor) {
	return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ||
		game.users.find(u => u.isGM);
}

const SYSTEM_ID = "bizarre-adventures-d6";
const CONTEST_FLAG = "contest";
let rollProcessGambitDefaults = {
	feint: false,
	fudge: false,
	mulligan: false,
	persist: false
};

function createEmptyRollState() {
	return {
		resolved: false,
		actorUuid: null,
		luckActorUuid: null,
		actorName: null,
		statKey: null,
		statLabel: null,
		formula: null,
		diceResults: null,
		total: null,
		advantage: null,
		effectiveAdvantage: null,
		useFudge: false,
		useGambit: false,
		feintCount: 0,
		snapshot: null
	};
}

function createPairState() {
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

function createContestState(hasReaction) {
	return {
		version: 1,
		hasReaction: !!hasReaction,
		nextStep: null,
		action: createPairState(),
		reaction: createPairState(),
		result: null
	};
}

function computePairTotal(pair) {
	if (pair?.rolls?.[1]?.resolved && pair?.rolls?.[2]?.resolved) {
		return Number(pair.rolls[1].total || 0) + Number(pair.rolls[2].total || 0);
	}
	return null;
}

function formatRollSummary(roll) {
	if (!roll?.resolved) return "<em>Pending</em>";
	const actorName = escapeHtml(roll.actorName || "Unknown");
	const statLabel = escapeHtml(roll.statLabel || "Stat");
	const formula = roll.formula ? escapeHtml(roll.formula) : "";
	const dice = Array.isArray(roll.diceResults) ? roll.diceResults.join(", ") : "";
	const total = Number(roll.total || 0);
	const adv = Number(roll.effectiveAdvantage ?? roll.advantage ?? 0);
	const fudgeNote = roll.useFudge ? " (+1 Fudged)" : "";
	const feintNote = roll.feintCount > 0 ? ` | Feints: ${roll.feintCount}` : "";
	const gambitNote = roll.useGambit ? " | Gambit" : "";
	const lineStyle = "white-space:normal; overflow-wrap:anywhere; word-break:break-word;";
	const formulaLine = formula ? `<div style=\"${lineStyle}\">Formula: <span>${formula}</span></div>` : "";
	const diceLine = dice ? `<div style=\"${lineStyle}\">Dice: <span>${dice}</span></div>` : "";
	return `
		<div style="${lineStyle}"><strong>${actorName}</strong> — ${statLabel}</div>
		${formulaLine}
		${diceLine}
		<div style="${lineStyle}">Total: <strong>${total}</strong> | Advantage: ${adv}${fudgeNote}${feintNote}${gambitNote}</div>
	`;
}

function getQuadrantLabel(side, rollIndex) {
	const sideLabel = side === "reaction" ? "Reaction" : "Action";
	return `${sideLabel} Roll ${rollIndex}`;
}

function getQuadrantButtonLabel(side, rollIndex) {
	if (side === "reaction" && rollIndex === 1) return "Roll Reaction";
	if (side === "action" && rollIndex === 1) return "Roll Action";
	const sideLabel = side === "reaction" ? "Reaction" : "Action";
	return `Roll ${sideLabel} ${rollIndex}`;
}

function renderQuadrantCell(side, rollIndex, rollData, nextStep) {
	const quadrant = `${side}-${rollIndex}`;
	const isNext = nextStep === quadrant;
	const isLocked = !isNext && !rollData?.resolved;
	const label = getQuadrantLabel(side, rollIndex);
	const buttonStyle = `margin-top:6px; ${isLocked ? "opacity:0.55;" : ""}`;
	const lockNote = isLocked ? `<div style="font-size:0.85em; color:#777;">Waiting for previous roll...</div>` : "";
	const button = !rollData?.resolved
		? `<button type="button" class="bad6-roll-btn" data-quadrant="${quadrant}" style="${buttonStyle}">${getQuadrantButtonLabel(side, rollIndex)}</button>`
		: "";
	const content = rollData?.resolved ? formatRollSummary(rollData) : (isNext ? "" : "<em>Pending</em>");
	return `
		<div style="padding:6px;">
			<div style="font-weight:bold; margin-bottom:4px;">${label}</div>
			<div style="display:flex; flex-direction:column; gap:2px;">${content}${lockNote}${button}</div>
		</div>
	`;
}

function buildContestHtml(state) {
	const actionAdvNote = state.action?.advantage !== null && state.action?.advantage !== undefined
		? `<div style="margin-top:4px; font-style:italic; color:#666;">Advantage: ${state.action.advantage} (chosen by ${escapeHtml(state.action.advantageChosenBy || "Unknown")})</div>`
		: "";
	const actionPersistNote = state.action?.persistNote
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${state.action.persistNote}</div>`
		: "";
	const actionRow = `
		<div style="border-bottom:2px solid #555; padding-bottom:4px;">
			${renderQuadrantCell("action", 1, state.action.rolls[1], state.nextStep)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("action", 2, state.action.rolls[2], state.nextStep)}
			${actionAdvNote}
			${actionPersistNote}
		</div>
	`;
	const reactionAdvNote = state.reaction?.advantage !== null && state.reaction?.advantage !== undefined
		? `<div style="margin-top:4px; font-style:italic; color:#666;">Advantage: ${state.reaction.advantage} (chosen by ${escapeHtml(state.reaction.advantageChosenBy || "Unknown")})</div>`
		: "";
	const reactionPersistNote = state.reaction?.persistNote
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${state.reaction.persistNote}</div>`
		: "";
	const reactionRow = state.hasReaction
		? `
		<div style="border-top:2px solid #555; margin-top:6px; padding-top:4px;">
			${renderQuadrantCell("reaction", 1, state.reaction.rolls[1], state.nextStep)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("reaction", 2, state.reaction.rolls[2], state.nextStep)}
			${reactionAdvNote}
			${reactionPersistNote}
		</div>
		`
		: "";
	const resultHtml = state.result
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999;"><strong>Result:</strong> ${state.result.label}</div>`
		: "";
	return `
		<div class="bad6-contest" style="border:1px solid #777; padding:6px; background:#f8f8f8;">
			${reactionRow}
			${actionRow}
			${resultHtml}
		</div>
	`;
}

async function updateContestMessage(message, state) {
	if (game.user.isGM) {
		await message.setFlag(SYSTEM_ID, CONTEST_FLAG, state);
		await message.update({ content: buildContestHtml(state) });
		return;
	}
	if (!socket) {
		console.warn("BAD6 | Socket not ready; cannot update contest message as GM.");
		return;
	}
	await socket.executeAsGM("updateContestMessage", message.id, state);
}

async function updateContestMessageAsGM(messageId, state) {
	const message = game.messages.get(messageId);
	if (!message) return false;
	await message.setFlag(SYSTEM_ID, CONTEST_FLAG, state);
	await message.update({ content: buildContestHtml(state) });
	return true;
}

function parseQuadrant(quadrant) {
	const [side, idx] = String(quadrant || "").split("-");
	const rollIndex = Number(idx || 0);
	if (!side || !["action", "reaction"].includes(side) || ![1, 2].includes(rollIndex)) return null;
	return { side, rollIndex };
}

function getLinkedActorUuids(actor) {
	const linkedSet = new Set();
	if (!actor) return linkedSet;
	if (actor.uuid) linkedSet.add(actor.uuid);
	const linked = actor.system?.bio?.linkedActors?.value || [];
	for (const link of linked) {
		if (link?.uuid) linkedSet.add(link.uuid);
	}
	return linkedSet;
}

function areActorsLinked(actorA, actorB) {
	if (!actorA || !actorB) return false;
	const setA = getLinkedActorUuids(actorA);
	if (setA.has(actorB.uuid)) return true;
	const setB = getLinkedActorUuids(actorB);
	if (setB.has(actorA.uuid)) return true;
	for (const id of setA) {
		if (setB.has(id)) return true;
	}
	return false;
}

function getRollOrder(hasReaction) {
	return hasReaction
		? ["reaction-1", "reaction-2", "action-1", "action-2"]
		: ["action-1", "action-2"];
}

function getNextStepInOrder(state, currentQuadrant) {
	const order = getRollOrder(state?.hasReaction);
	const idx = order.indexOf(currentQuadrant);
	if (idx === -1) return state?.nextStep || null;
	return order[idx + 1] || null;
}

async function handlePostRollLuck(pair, actor, context = {}) {
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
				const newThreshold = snap.threshold - 1;
				const newSuccesses = countSuccesses(snap.diceResults, newThreshold);
				const newTotal = newSuccesses + snap.delta;
				snap.threshold = newThreshold;
				snap.total = newTotal;
				r.total = newTotal;
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

	const persistCheck = canUseLuckMove(actor, "persist", rollProcessGambitDefaults.persist, luckActor);
	if (persistCheck.canUse) {
		const persistResult = await showPersistDialog({
			gambitDefault: !!rollProcessGambitDefaults.persist,
			lockReason: initialLock?.locked ? initialLock.reason : "",
			lockCheck: getPersistLockState,
			autoCloseMs: 5000
		});
		if (persistResult) {
			rollProcessGambitDefaults.persist = !!persistResult.useGambit;
		}
		if (persistResult?.confirmed) {
			const spend = await spendLuckMove(actor, "persist", persistResult.useGambit, 0, luckActor);
			if (!spend.success && spend.error) ui.notifications.error(spend.error);
			const actorName = actor?.name || "Unknown";
			pair.persistLock = {
				by: actorName,
				expiresAt: Date.now() + 5000
			};
			pair.persistCount = Number(pair.persistCount || 0) + 1;
			const countSuffix = pair.persistCount > 1 ? ` ×${pair.persistCount}` : "";
			pair.persistNote = `✨ Persist: ${escapeHtml(actorName)}${countSuffix}`;
			return { resetPair: true, persistActorName: actorName };
		}
	}
	return { resetPair: false };
}

async function rollOneStep(side, rollIndex, state, messageId = null) {
	const pair = state[side];
	let advantage = pair.advantage;
	const actor = await findRoller(0, side === "reaction");
	if (!actor) return null;

	const advantageLocked = advantage !== null && advantage !== undefined;
	const advantageValue = advantageLocked ? advantage : 0;
	const advantageChosenBy = pair.advantageChosenBy || "";
	const advantageLockReason = advantageLocked ? "Advantage already locked for this pair." : "";

	const isSecondRoll = rollIndex === 2;
	const roll1ActorUuid = pair?.rolls?.[1]?.actorUuid || null;
	const roll1Actor = isSecondRoll && roll1ActorUuid ? await fromUuid(roll1ActorUuid) : null;
	const allowFeint = true;
	const allowFudge = true;
	const allowGambit = allowFeint || allowFudge;
	const expectedQuadrant = `${side}-${rollIndex}`;
	const canProceed = () => {
		if (!messageId) return true;
		const latest = game.messages.get(messageId);
		const currentState = latest?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
		return currentState?.nextStep === expectedQuadrant;
	};
	const lockMessage = `Waiting for the previous roll before ${getQuadrantLabel(side, rollIndex)}.`;
	const stat = await requestStat(actor, {
		showLuckOptions: true,
		allowFeint,
		allowGambit,
		lockMessage,
		canProceed,
		advantageLocked,
		advantageValue,
		advantageChosenBy,
		advantageLockReason,
		gambitDefaults: rollProcessGambitDefaults
	});
	if (!stat) {
		ui.notifications.warn("Stat selection cancelled.");
		return null;
	}

	rollProcessGambitDefaults.feint = !!stat.gambitSelections?.feint;
	const luckActor = stat.luckActorUuid ? await fromUuid(stat.luckActorUuid) : actor;

	if (!advantageLocked) {
		pair.advantage = Number(stat.advantage || 0);
		pair.advantageChosenBy = actor.name;
	}
	advantage = pair.advantage ?? Number(stat.advantage || 0);
	if (typeof canProceed === "function" && !canProceed()) {
		ui.notifications.warn(lockMessage);
		return null;
	}

	const feintCount = stat.feintCount || 0;
	const gambitForFeint = !!stat.gambitSelections?.feint;
	const showFudge = allowFudge;
	const fudgeLockReason = pair.fudgeChosenBy ? `Fudge used by ${pair.fudgeChosenBy}!` : "";
	const hasOwner = Object.entries(actor.ownership || {})
		.some(([uid, lvl]) => {
			const u = game.users.get(uid);
			return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
		});

	if (game.user.isGM && hasOwner && await showConfirmRollerDialog()) {
		const base = `(${stat.value}d6cs>=5)`;
		const rollResult = await socket.executeAsUser(
			"pCheck",
			findOwner(actor).id,
			actor.id,
			base,
			stat.key,
			stat.label,
			advantage,
			actor.getRollData(),
			feintCount,
			false,
			gambitForFeint,
			rollProcessGambitDefaults.fudge,
			showFudge,
			fudgeLockReason,
			true,
			stat.luckActorUuid || null
		);
		if (!rollResult) return null;
		const useFudge = !!rollResult.useFudge;
		return {
			actorUuid: actor.uuid,
			luckActorUuid: stat.luckActorUuid || null,
			actorName: actor.name,
			statKey: stat.key,
			statLabel: stat.label,
			formula: rollResult.snapshot?.formula || null,
			diceResults: rollResult.snapshot?.diceResults || null,
			total: rollResult.total,
			advantage,
			effectiveAdvantage: rollResult.effectiveAdvantage ?? advantage,
			useFudge,
			useGambit: gambitForFeint,
			feintCount,
			snapshot: rollResult.snapshot
		};
	}

	const baseFormula = `(${stat.value}d6cs>=5)`;
	const data = actor.getRollData();
	let useFudge = false;
	const formulaResult = await prepareFormula(actor, baseFormula, stat.key, stat.label, advantage, data, useFudge, rollProcessGambitDefaults.fudge, showFudge, fudgeLockReason);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	const gambitForFudge = !!formulaResult?.useGambitForFudge;
	rollProcessGambitDefaults.fudge = gambitForFudge;
	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });

	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", gambitForFeint, feintCount, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	if (useFudge && showFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", gambitForFudge, 0, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return {
		actorUuid: actor.uuid,
		luckActorUuid: stat.luckActorUuid || null,
		actorName: actor.name,
		statKey: stat.key,
		statLabel: stat.label,
		formula: finalFormula,
		diceResults: snapshot.diceResults,
		total: roll.total,
		advantage,
		effectiveAdvantage,
		useFudge,
		useGambit: gambitForFeint,
		feintCount,
		snapshot
	};
}

function applyRollToState(state, side, rollIndex, rollData) {
	const pair = state[side];
	const rollState = pair.rolls[rollIndex];
	Object.assign(rollState, {
		resolved: true,
		actorUuid: rollData.actorUuid,
		luckActorUuid: rollData.luckActorUuid || null,
		actorName: rollData.actorName,
		statKey: rollData.statKey,
		statLabel: rollData.statLabel,
		formula: rollData.formula || null,
		diceResults: rollData.diceResults || null,
		total: rollData.total,
		advantage: rollData.advantage,
		effectiveAdvantage: rollData.effectiveAdvantage,
		useFudge: rollData.useFudge,
		useGambit: rollData.useGambit,
		feintCount: rollData.feintCount,
		snapshot: rollData.snapshot
	});
	if (rollData.useFudge && !pair.fudgeChosenBy) {
		pair.fudgeChosenBy = rollData.actorName || "Unknown";
	}
	pair.total = computePairTotal(pair);
}

function resetPairState(pair) {
	const persistCount = Number(pair.persistCount || 0);
	const persistNote = pair.persistNote || null;
	const persistLock = pair.persistLock && pair.persistLock.expiresAt > Date.now() ? pair.persistLock : null;
	pair.advantage = null;
	pair.advantageChosenBy = null;
	pair.rolls[1] = createEmptyRollState();
	pair.rolls[2] = createEmptyRollState();
	pair.total = null;
	pair.mulliganNote = null;
	pair.fudgeChosenBy = null;
	pair.persistCount = persistCount;
	pair.persistNote = persistNote;
	pair.persistLock = persistLock;
}

function updateResultState(state) {
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

Hooks.on("renderChatMessage", (message, html) => {
	const contest = message?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
	if (!contest) return;
	html.find("button.bad6-roll-btn").on("click", async (event) => {
		event.preventDefault();
		const quadrant = event.currentTarget?.dataset?.quadrant;
		const parsed = parseQuadrant(quadrant);
		if (!parsed) return;
		const latest = game.messages.get(message.id);
		const state = latest?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
		if (!state) return;
		const { side, rollIndex } = parsed;
		const rollData = await rollOneStep(side, rollIndex, state, message.id);
		if (!rollData) return;
		const refreshed = game.messages.get(message.id);
		const currentState = refreshed?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
		if (!currentState) return;
		const currentRoll = currentState?.[side]?.rolls?.[rollIndex];
		if (currentRoll?.resolved) {
			ui.notifications.warn("That roll is already resolved.");
			return;
		}
		applyRollToState(currentState, side, rollIndex, rollData);
		const pair = currentState[side];
		if (rollIndex === 2) {
			const actor = rollData.actorUuid ? await fromUuid(rollData.actorUuid) : null;
			const { resetPair, persistActorName } = await handlePostRollLuck(pair, actor, {
				state: currentState,
				side,
				messageId: message.id
			});
			if (resetPair) {
				resetPairState(pair);
				currentState.result = null;
				currentState.nextStep = `${side}-1`;
				if (persistActorName) {
					ChatMessage.create({
						speaker: ChatMessage.getSpeaker({ actor: actor || undefined }),
						content: `✨ Persist used by <strong>${escapeHtml(persistActorName)}</strong>`
					});
				}
				await updateContestMessage(refreshed, currentState);
				return;
			}
		}

	currentState.nextStep = getNextStepInOrder(currentState, quadrant);

	updateResultState(currentState);
	if (currentState.result?.type === "clash") {
		const nextState = createContestState(currentState.hasReaction);
		nextState.action.persistCount = currentState.action.persistCount;
		nextState.action.persistNote = currentState.action.persistNote;
		nextState.reaction.persistCount = currentState.reaction.persistCount;
		nextState.reaction.persistNote = currentState.reaction.persistNote;
		nextState.nextStep = getRollOrder(nextState.hasReaction)[0];
		await updateContestMessage(refreshed, nextState);
		const speakerActorUuid = currentState.action.rolls[1]?.actorUuid || currentState.reaction.rolls[1]?.actorUuid;
		const speakerActor = speakerActorUuid ? await fromUuid(speakerActorUuid) : null;
		ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: speakerActor || undefined }),
			content: "<strong>Clash!</strong> A new contest begins."
		});
		return;
	}
	await updateContestMessage(refreshed, currentState);
	});
});


// Entrypoint
async function main() {
	rollProcessGambitDefaults = {
		feint: false,
		fudge: false,
		mulligan: false,
		persist: false
	};
	let hasReaction = false;
	const targetCount = game.user.targets.size;
	if (targetCount > 0) {
			hasReaction = true;
		}
	if (game.user.isGM) {
		if (canvas.tokens.controlled.length < 1) {
			ui.notifications.warn("Select at least one token to start a roll.");
			return;
		}
		if (canvas.tokens.controlled.length > 1) {
			hasReaction = true;
		}
	}
	const state = createContestState(hasReaction);
	const rollOrder = getRollOrder(hasReaction);
	const firstStep = rollOrder[0];
	state.nextStep = firstStep;
	updateResultState(state);

	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: null }),
		content: buildContestHtml(state),
		flags: {
			[SYSTEM_ID]: {
				[CONTEST_FLAG]: state
			}
		}
	});
}
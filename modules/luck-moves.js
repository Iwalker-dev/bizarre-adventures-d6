import { resetQuadrant, createActionMessage, createContestMessage, recalculateQuadrantFormula, reevaluatePairRollResults, rerenderMessage } from "./apps/bad6-roller.js";
import { renderDialog } from "./dialog.js";
import { getRollerSocket } from "./sockets.js";
import { resolveActorFromSource } from "./apps/roller/actors.js";

function warnOwners(actor, warning) {
	const socket = getRollerSocket();
	if (!socket) {
		ui.notifications.warn("Socket is not ready. Owners not notified.");
		return null;
	}
	socket.executeForOthers("warnOwners", actor, warning)
}

async function executeRollerAsGM(handler, ...args) {
	const socket = getRollerSocket();
	if (!socket) {
		ui.notifications.error("Socket is not ready. Cannot execute GM action.");
		return null;
	}
	return await socket.executeAsGM(handler, ...args);
}

async function executeRollerAsPlayer(handler, userId, ...args) {
	const socket = getRollerSocket();
	if (!socket) {
		ui.notifications.error("Socket is not ready. Cannot execute player action.");
		return null;
	}
	return await socket.executeAsUser(handler, userId,  ...args);
}

function resolveActorFromSpenderRef(spenderRef) {
	if (!spenderRef) return null;

	if (typeof spenderRef === "object") {
		if (spenderRef.sourceUuid) {
			let doc = null;
			try {
				doc = fromUuidSync(spenderRef.sourceUuid);
			} catch (_err) {
				// Fall through to actorId fallback
			}
			if (doc?.documentName === "Actor") return doc;
			if (doc?.actor) return doc.actor;
		}
		if (spenderRef.actorId) {
			return game.actors.get(spenderRef.actorId) || null;
		}
		return null;
	}

	if (typeof spenderRef === "string") {
		if (spenderRef.includes(".")) {
			let doc = null;
			try {
				doc = fromUuidSync(spenderRef);
			} catch (_err) {
				// Fall through to actorId fallback
			}
			if (doc?.documentName === "Actor") return doc;
			if (doc?.actor) return doc.actor;
		}
		return game.actors.get(spenderRef) || null;
	}

	return null;
}

function getSpenderStorageKey(spenderRef) {
	if (!spenderRef) return null;
	if (typeof spenderRef === "string") return spenderRef;
	if (typeof spenderRef === "object") {
		if (typeof spenderRef.sourceUuid === "string" && spenderRef.sourceUuid) return spenderRef.sourceUuid;
		if (typeof spenderRef.actorId === "string" && spenderRef.actorId) return spenderRef.actorId;
	}
	return null;
}

export function getLuckMoveExecutionContext(move, spenders, { isGambit = false, checkCanUse = false } = {}) {
	const moveData = LUCK_MOVES[move];
	if (!moveData) {
		return { ok: false, reason: "Unknown move: " + move };
	}
	if (moveData.costType === "gambit") {
		return { ok: false, reason: "Gambit must resolve a target move before spending context is built." };
	}

	const spenderList = Array.isArray(spenders) ? spenders : [];
	let spender = null;
	switch (moveData.costType) {
		case "temp":
			spender = spenderList[0];
			break;
		case "perm":
			spender = spenderList[1];
			break;
		case "value":
			spender = spenderList[2];
			break;
		default:
			return { ok: false, reason: "Invalid cost type for move: " + moveData.name };
	}

	if (!spender) {
		return { ok: false, reason: "No valid Luck-spending actor could be resolved for this move." };
	}

	const spenderActor = resolveActorFromSpenderRef(spender);
	if (!spenderActor) {
		return { ok: false, reason: "No valid Luck-spending actor could be resolved for this move." };
	}

	const gambitCost = isGambit ? Math.ceil(moveData.cost / 2) : null;
	if (checkCanUse && !canUseMove(moveData, spenderActor, { costOverride: gambitCost })) {
		return { ok: false, reason: "Cannot spend luck for this move." };
	}

	return {
		ok: true,
		spender,
		spenderActor,
		spenderKey: getSpenderStorageKey(spender),
		moveData
	};
}

function canUseMove(move, actor, { costOverride = null } = {}) {
	if (!actor) {
		ui.notifications.warn("No valid actor available to spend Luck.");
		return false;
	}
	const luckStat = actor.system.attributes.stats.luck;
	const pool = move.costType === "perm" ? (luckStat.perm ?? 0) : (luckStat.temp ?? 0);
	const requiredCost = Number.isFinite(costOverride) ? costOverride : move.cost;
	if (pool < requiredCost) {
		const warning = `${actor.name} doesn't have enough luck for ${move.name}.`
		ui.notifications.warn(warning);
		warnOwners(actor, warning);
		return false;
	}
	return true;
}

export const LUCK_MOVES = {
	feint: {
		name: "Feint",
		key: "feint",
		description: "Edit your Action/Reaction after hearing the enemy's",
		costType: "temp",
		cost: 1,
		timing: "pre-roll",
		effect: "unprepare"
	},
	fudge: {
		name: "Fudge",
		key: "fudge",
		description: "Add a free Advantage, pre-roll",
		costType: "temp",
		cost: 2,
		timing: "pre-roll",
		effect: "advantage"
	},
	flashback: {
		name: "Flashback",
		key: "flashback",
		description: "Retcon a detail you choose",
		costType: "temp",
		cost: 3,
		timing: "anytime",
		effect: "narrative"
	},
	mulligan: {
		name: "Mulligan",
		key: "mulligan",
		description: "Add a free Advantage, post-roll",
		costType: "temp",
		cost: 4,
		timing: "post-roll",
		effect: "advantage"
	},
	persist: {
		name: "Persist",
		key: "persist",
		description: "Try another Action/Reaction after a failed one, as if it tied",
		costType: "perm",
		cost: 2,
		timing: "post-roll",
		effect: "reset"
	},
	gambit: {
		name: "Gambit",
		key: "gambit",
		description: "Zero cost if using successful plan",
		costType: "gambit",
		cost: 0,
		timing: "anytime",
		effect: "trigger"
	}
};

// TODO: Change to find arrays for each luck type.
export function chooseLuckSpenders(rollableActors) {
	let values = [];
	let spenders = [];
	for (const source of rollableActors) {
		let actor;
		if (source.sourceUuid) {
			let doc = null;
			try {
				doc = fromUuidSync(source.sourceUuid);
			} catch (_err) {
				// May throw for embedded token-actor UUIDs; fall through to actorId fallback
			}
			if (doc?.documentName === "Actor") actor = doc;
			else if (doc?.actor) actor = doc.actor;
		}
		if (!actor && source.actorId) {
			actor = game.actors.get(source.actorId);
		}
		if (!actor) continue; // Could not resolve actor, skip

		// Extract the burn type stats of the actor, specifically the luck stat if it has one, and its value
        const statsArray = Object.entries(actor.system.attributes.stats)
            .filter(([, stat]) => String(stat?.dtype || "").toLowerCase() === "burn")
            .map(([key, stat]) => ({
                key,
                name: stat.label || key
                ,value: stat.value ?? 0
				,temp: stat.temp ?? 0
				,perm: stat.perm ?? 0
        }));
		const luckStat = statsArray.find(stat => stat.name.toLowerCase() === "luck");
		if (!luckStat) continue; // Actor has no luck stat, skip
		const spenderRef = {
			sourceUuid: source.sourceUuid || actor.uuid,
			actorId: source.actorId || actor.id
		};
		// Check if this actor has the highest of any luck value so far
				if (!values[0] || luckStat.temp > values[0]) {
					values[0] = luckStat.temp;
					spenders[0] = spenderRef;
				}
				if (!values[1] || luckStat.perm > values[1]) {
					values[1] = luckStat.perm;
					spenders[1] = spenderRef;
				}
				if (!values[2] || luckStat.value > values[2]) {
					values[2] = luckStat.value;
					spenders[2] = spenderRef;
				}
	}

	return spenders;
}

export async function trySpendLuck(actorId, action, isRefund = false, isGambit = false) { //TODO: Refund logic into own function?
	const actor = resolveActorFromSpenderRef(actorId);
	if (!actor) {
		const displayRef = typeof actorId === "object" ? JSON.stringify(actorId) : String(actorId);
		console.warn(`BAD6 | trySpendLuck: could not resolve luck spender "${displayRef}"`);
		ui.notifications.warn("Could not find a valid Luck-spending actor.");
		return false;
	}
	const luckStat = actor.system.attributes.stats.luck;
	for (const move of Object.values(LUCK_MOVES)) {
		if (move.name === action) {
			const pool = move.costType === "perm" ? (luckStat.perm ?? 0) : (luckStat.temp ?? 0);
			const gambitCost = isGambit ? Math.ceil(move.cost / 2) : null;
			if (!isRefund && !canUseMove(move, actor, { costOverride: gambitCost })) {
				return false;
			}
			const cost = isGambit ? Math.ceil(move.cost / 2) : move.cost;
			switch (move.costType) {
				case "temp":
					actor.update({ "system.attributes.stats.luck.temp": luckStat.temp - (isRefund ? -cost : cost) });
					return true;
				case "perm":
					await actor.update({ "system.attributes.stats.luck.perm": luckStat.perm - (isRefund ? -cost : cost) });
					return true;
				case "value":
					await actor.update({ "system.attributes.stats.luck.value": luckStat.value - (isRefund ? -cost : cost) });
					return true;
				default:
					ui.notifications.warn("Invalid cost type for move: " + move.name);
					return false;
			}
		}
	}

}

export async function executeLuckMove(messageId, spenders, quadrantNum, move, isGambit = false, sender = game.user.id) {
	let message = game.messages.get(messageId);
	if (!message) return;
	if (!LUCK_MOVES[move]) {
		ui.notifications.warn("Unknown move: " + move);
		return;
	}

	const existing = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
	/*
	const countType = isGambit ? "gambitCounts" : "luckCounts";
	 Spare logic for gating luck moves which shouldnt be able to be spammed
	const currentCount = existing[countType]?.[move] || 0;
	// If this is not a gambit and the move has already been used, exit. Gambits can be used multiple times for free.
	if (move !== "feint" && currentCount > 0) {
		return;
	}
	*/
	let moveType = LUCK_MOVES[move].key // May be edited by gambit
	let gambitActor = null;
	let gambitId = null; //item id

	if (moveType == "gambit") {
		const gambitResult = await executeGambit(messageId, quadrantNum, sender);
		if (!gambitResult) return;
		const [newMoveType, gambitActorId, newGambitId] = gambitResult;
		moveType = newMoveType;
		gambitActor = game.actors.get(gambitActorId);
		gambitId = newGambitId; // TODO: change to this.gambitId once learned
		isGambit = true; // TODO: Move logic so this is where isGambit is initialized
	}

	const context = getLuckMoveExecutionContext(moveType, spenders, { isGambit, checkCanUse: true });
	if (!context.ok) {
		ui.notifications.warn(context.reason);
		return;
	}
	const spender = context.spender;
	const spenderKey = context.spenderKey;
	const spenderActorName = context.spenderActor?.name;

	let executed = false;
	// Attempt the luck move
	switch (moveType) {
		case "feint":
			executed = await executeFeint(messageId, quadrantNum);
			break;
		case "fudge":
			executed = await executeFudge(messageId, quadrantNum);
			break;
		case "flashback":
			executed = await executeFlashback(messageId, quadrantNum, sender, spenderActorName);
			break;
		case "mulligan":
			executed = await executeMulligan(messageId, quadrantNum);
			break;
		case "persist":
			executed = await executePersist(messageId, quadrantNum);
			break;
		case "reveal":
			executed = true;
			break;
		default:
			ui.notifications.warn("Unknown move: " + moveType);
			return;
	}

	// Save execution data in flags
	if (executed) {
		const spent = await trySpendLuck(spender, LUCK_MOVES[moveType].name, false, isGambit);
		if (!spent) return;

		message = game.messages.get(messageId); // Refetch message to ensure we have the latest flags after move execution
		// Prepare existing data
		const countType = isGambit ? "gambitCounts" : "luckCounts";
		const latest = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
		const lastLuckSpenders = latest.luckSpenders || existing.luckSpenders || {};
		const lastLuckMoveSpenders = lastLuckSpenders[moveType] || {};
		const lastGambitSpenders = latest.gambitSpenders || existing.gambitSpenders || {};
		const lastGambitMoveSpenders = lastGambitSpenders[moveType] || {};

		// Create the update data
		const updateData = {
			...latest,
			luckCounts: { ...(latest.luckCounts || existing.luckCounts || {}) },
			gambitCounts: { ...(latest.gambitCounts || existing.gambitCounts || {}) }
		};
		// luckSpenders are default cost. gambitSpenders are half cost.
		updateData[countType][moveType] = (updateData[countType][moveType] || 0) + 1;
		if (spenderKey) {
			if (!isGambit) {
				updateData.luckSpenders = {
					...lastLuckSpenders,
					[moveType]: {
						...lastLuckMoveSpenders,
						[spenderKey]: (lastLuckMoveSpenders[spenderKey] || 0) + 1
					}
				};
			} else {
				updateData.gambitSpenders = {
					...lastGambitSpenders,
					[moveType]: {
						...lastGambitMoveSpenders,
						[spenderKey]: (lastGambitMoveSpenders[spenderKey] || 0) + 1
					}
				};
			}
		}



		// Update the message flags with the new data
		await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, updateData);
		if (moveType === "fudge") {
			const quadrantNumber = Number(quadrantNum);
			const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
			for (const pairQuadrant of pairQuadrants) {
				await recalculateQuadrantFormula(messageId, pairQuadrant);
			}
		} else if (moveType === "mulligan") {
			const quadrantNumber = Number(quadrantNum);
			const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
			for (const pairQuadrant of pairQuadrants) {
				await recalculateQuadrantFormula(messageId, pairQuadrant, { includeMulligan: true });
			}
			await reevaluatePairRollResults(messageId, quadrantNum);
		}
		// Reveal and delete gambit document
		if (isGambit) {
			const isRevealed = revealGambit(gambitActor, gambitId);
			if (isRevealed) gambitActor.deleteEmbeddedDocuments("gambit", [gambitId]);
		}
	}
}

function getPairMulliganBonus(message, quadrantNum) {
	const quadrantNumber = Number(quadrantNum);
	const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];

	return pairQuadrants.reduce((total, index) => {
		const data = message?.getFlag("bizarre-adventures-d6", `quadrant${index}`) || {};
		const luck = Number(data?.luckCounts?.mulligan || 0);
		const gambit = Number(data?.gambitCounts?.mulligan || 0);
		return total + Math.max(0, luck + gambit);
	}, 0);
}

function getQuadrantAdvantage(message, quadrantNum) {
	const quadrantNumber = Number(quadrantNum);
	const pairKey = (quadrantNumber === 1 || quadrantNumber === 2)
		? "action"
		: ((quadrantNumber === 3 || quadrantNumber === 4) ? "reaction" : null);

	if (pairKey) {
		const pairAdvantage = message?.getFlag("bizarre-adventures-d6", "pairAdvantage") || {};
		const shared = Number(pairAdvantage[pairKey]);
		if (Number.isFinite(shared)) return Math.max(0, Math.min(3, shared));
	}

	const own = Number(message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNumber}`)?.advantage);
	if (Number.isFinite(own)) return Math.max(0, Math.min(3, own));

	return 0;
}


// Returns the executed luckMove
async function executeGambit(messageId, quadrantNum, sender) { // TODO: Clarify in all contexts that sender is an id
	// TODO: Generate actors from quadrant num. Use linked users and highlighted if GM, and owned users if player
	const socket = getRollerSocket();
	if (!socket) {
				ui.notifications.error("Socket is not ready. Cannot execute player action.");
				return null;
	}
	let actors = await socket.executeAsUser("getUserActors", sender, sender) // TODO: luck-moves.js currently runs in the context of the GM, not the user
	const isGM = !!game.users.get(sender).isGM ?? null;
	if (isGM) {
		const message = game.messages.get(messageId);
		const flagData = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
		const actor = flagData ? resolveActorFromSource(flagData) : null;
		if (actor) actors.push(actor);
	}
	// TODO: Pull the info from the dialog
	const gambitInfo = await renderDialog("gambit", {actors, quadrantNum} );
	if (!gambitInfo) return null;



	return [gambitInfo.gambit.name, gambitInfo.gambit.actorId, gambitInfo.gambit.itemId];
}

async function executeFeint(messageId, quadrantNum) {
	// Reset quadrant except for luck. Feint count is incremented by 1.
	await resetQuadrant(messageId, quadrantNum, false);
	return true;
}

// Does not actually change the advantage directly, this is handled by recalculating the formula
async function executeFudge(messageId, quadrantNum) {
	// Fudge adds a counted advantage bonus; formula recomputation applies it before custom modifiers.
	let message = game.messages.get(messageId);
	let existing = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
	let baseAdvantage = getQuadrantAdvantage(message, quadrantNum);
	const existingFudge = Number(existing?.luckCounts?.fudge || 0) + Number(existing?.gambitCounts?.fudge || 0);
	const effectiveAdvantage = Math.max(0, Math.min(3, baseAdvantage + Math.max(0, existingFudge)));
	let executed = false;
	if (effectiveAdvantage < 3) {
		executed = true;
	} else {
		ui.notifications.info("Advantage would exceed 3, Fudge not spent.");
	}
	return executed;
}

async function executeFlashback(messageId, quadrantNum, sender, spenderActorName) {
	const flashbackText = await executeRollerAsPlayer("rollerFlashbackCreate", sender);
	if (!flashbackText) return false;
	const requesterName = `${game.users.get(sender)?.name ?? "A player"} (Spent by ${spenderActorName ?? "Unknown"})`;
	return await executeRollerAsGM("rollerFlashbackRequest", requesterName, flashbackText);
}

async function executeMulligan(messageId, quadrantNum) {
	// Add 1 advantage to last roll, even if it was a tie or success. If the last roll had 2 or more advantage, refund the cost instead.
	let message = game.messages.get(messageId);
	let baseAdvantage = getQuadrantAdvantage(message, quadrantNum);
	const mulliganBonus = getPairMulliganBonus(message, quadrantNum);
	const currentAdvantage = Math.max(0, Math.min(3, baseAdvantage + mulliganBonus));
	let executed = false;
	if (currentAdvantage <= 2) {
		executed = true;
	} else {
		ui.notifications.info("Mulligan would exceed 3 advantage, not spent.");
	}
	return executed;
}

async function executePersist(messageId, quadrantNum) {
	// Execute a clash regardless of the last result, creating a new action/contest.
	const message = game.messages.get(messageId);
	const persistChatData = {
		content: `<p><strong>Persist!</strong></p>`
	};
	const rollMode = String(game.settings.get("core", "rollMode") || "publicroll");
	if (typeof ChatMessage?.applyRollMode === "function") {
		ChatMessage.applyRollMode(persistChatData, rollMode);
	} else if (rollMode === "gmroll") {
		persistChatData.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
	} else if (rollMode === "blindroll") {
		persistChatData.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
		persistChatData.blind = true;
	} else if (rollMode === "selfroll") {
		persistChatData.whisper = game.user?.id ? [game.user.id] : [];
	}
	const newMessage = await ChatMessage.create(persistChatData);
	await message.setFlag("bizarre-adventures-d6", "Locked", true); // keep locked, original message should not be editable after persist
	await rerenderMessage(message);
	const type = message.getFlag("bizarre-adventures-d6", "type");
	if (type === "action") {
		createActionMessage();
	} else if (type === "contest") {
		createContestMessage();
	}
	return true;
}

export async function createGambit(actorId, gambit) {
	const actor = game.actors.get(actorId);
	await actor.createEmbeddedDocuments("Item", [{
		name: gambit.name ?? "Gambit",
		type: "gambit", // must match your system's registered item type key
		img: gambit.img ?? "icons/svg/dice-target.svg",
		system: {
			luckMove: gambit.luckMove,
			trigger: gambit.trigger
		}
	}]);
}

function revealGambit(actorId, itemId) {
	const actor = game.actors.get(actorId)
	const item = game.items.get(itemId);

	const content = `
		<section class="bad6-gambit-reveal">
			<h2>Gambit Revealed!</h2>
			<p><strong>${actor.name}</strong> reveals <strong>${item.name}</strong>.</p>
			<hr>
			<h3>Trigger</h3>
			<p>${item.trigger}</p>
		</section>
	`
	
	ChatMessage.create({
		speaker: {
					alias: actor.name
				}
		, content
	});
	return true;
}
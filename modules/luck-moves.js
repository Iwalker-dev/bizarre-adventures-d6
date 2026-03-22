import { resetQuadrant, createActionMessage, createContestMessage, recalculateQuadrantFormula, reevaluatePairRollResults, rerenderMessage } from "./apps/bad6-roller.js";
import { getRollerSocket } from "./sockets.js";

async function executeRollerAsGM(handler, ...args) {
	const socket = getRollerSocket();
	if (!socket) {
		ui.notifications.error("Socket is not ready. Cannot execute GM action.");
		return null;
	}
	return await socket.executeAsGM(handler, ...args);
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

	if (isGambit || moveData.costType === "gambit") {
		return { ok: true, spender: null, spenderActor: null, spenderKey: null, moveData };
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

	if (checkCanUse && !canUseMove(moveData, spenderActor)) {
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

function canUseMove(move, actor) {
	if (!actor) {
		ui.notifications.warn("No valid actor available to spend Luck.");
		return false;
	}
	const luckStat = actor.system.attributes.stats.luck;
	const pool = move.costType === "perm" ? (luckStat.perm ?? 0) : (luckStat.temp ?? 0);
	if (pool < move.cost) {
		ui.notifications.warn("Not enough luck to spend!");
		return false;
	}
	return true;
}

export const LUCK_MOVES = {
	feint: {
		name: "Feint",
		description: "Edit your Action/Reaction after hearing the enemy's",
		costType: "temp",
		cost: 1,
		timing: "pre-roll",
		effect: "feint"
	},
	fudge: {
		name: "Fudge",
		description: "Add a free Advantage, pre-roll",
		costType: "temp",
		cost: 2,
		timing: "pre-roll",
		effect: "advantage"
	},
	flashback: {
		name: "Flashback",
		description: "Retcon a detail you choose",
		costType: "temp",
		cost: 3,
		timing: "anytime",
		effect: "narrative"
	},
	mulligan: {
		name: "Mulligan",
		description: "Add a free Advantage, post-roll",
		costType: "temp",
		cost: 4,
		timing: "post-roll",
		effect: "advantage"
	},
	persist: {
		name: "Persist",
		description: "Try another Action/Reaction after a failed one, as if it tied",
		costType: "perm",
		cost: 2,
		timing: "post-roll",
		effect: "reroll"
	},
	gambit: {
		name: "Gambit",
		description: "Zero cost if using Chekhov's Gun or successful plan",
		costType: "gambit",
		cost: 0,
		timing: "anytime",
		effect: "special"
	}
};

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

export async function trySpendLuck(actorId, action, refund = false) {
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
			if (!refund && !canUseMove(move, actor)) {
				return false;
			}
			switch (move.costType) {
				case "temp":
					actor.update({ "system.attributes.stats.luck.temp": luckStat.temp - (refund ? -move.cost : move.cost) });
					return true;
				case "perm":
					await actor.update({ "system.attributes.stats.luck.perm": luckStat.perm - (refund ? -move.cost : move.cost) });
					return true;
				case "value":
					await actor.update({ "system.attributes.stats.luck.value": luckStat.value - (refund ? -move.cost : move.cost) });
					return true;
				default:
					ui.notifications.warn("Invalid cost type for move: " + move.name);
					return false;
			}
		}
	}

}

export async function executeLuckMove(messageId, spenders, quadrantNum, move, isGambit = false) {
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
	const context = getLuckMoveExecutionContext(move, spenders, { isGambit, checkCanUse: true });
	if (!context.ok) {
		ui.notifications.warn(context.reason);
		return;
	}
	const spender = context.spender;
	const spenderKey = context.spenderKey;

	let executed = false;
	// Attempt the luck move
	switch (LUCK_MOVES[move].name.toLowerCase()) {
		case "feint":
			executed = await executeFeint(messageId, quadrantNum);
			break;
		case "fudge":
			executed = await executeFudge(messageId, quadrantNum);
			break;
		case "flashback":
			executed = await executeFlashback(messageId, quadrantNum);
			break;
		case "mulligan":
			executed = await executeMulligan(messageId, quadrantNum);
			break;
		case "persist":
			executed = await executePersist(messageId, quadrantNum);
			break;
		default:
			ui.notifications.warn("Unknown move: " + move);
			return;
	}

		// Save execution data in flags
		if (executed) {
			if (!isGambit) {
				const spent = await trySpendLuck(spender, LUCK_MOVES[move].name);
				if (!spent) return;
			}
			message = game.messages.get(messageId); // Refetch message to ensure we have the latest flags after move execution
			// Prepare existing data
			const countType = isGambit ? "gambitCounts" : "luckCounts";
			const latest = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
			const lastSpenders = latest.luckSpenders || existing.luckSpenders || {};
			const lastMoveSpenders = lastSpenders[move] || {};

			// Create the update data
			const updateData = {
				...latest,
				luckCounts: { ...(latest.luckCounts || existing.luckCounts || {}) },
				gambitCounts: { ...(latest.gambitCounts || existing.gambitCounts || {}) }
			};
			updateData[countType][move] = (updateData[countType][move] || 0) + 1;
			if (!isGambit && spenderKey) {
				updateData.luckSpenders = {
					...lastSpenders,
					[move]: {
						...lastMoveSpenders,
						[spenderKey]: (lastMoveSpenders[spenderKey] || 0) + 1
					}
				};
			}



			// Update the message flags with the new data
			await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, updateData);
			if (move === "fudge") {
				const quadrantNumber = Number(quadrantNum);
				const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
				for (const pairQuadrant of pairQuadrants) {
					await recalculateQuadrantFormula(messageId, pairQuadrant);
				}
			} else if (move === "mulligan") {
				const quadrantNumber = Number(quadrantNum);
				const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
				for (const pairQuadrant of pairQuadrants) {
					await recalculateQuadrantFormula(messageId, pairQuadrant, { includeMulligan: true });
				}
				await reevaluatePairRollResults(messageId, quadrantNum);
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

async function executeFlashback(messageId, quadrantNum) {
	const flashbackText = await new Promise((resolve) => {
		new Dialog({
			title: "Flashback",
			content: `<p>Describe the retcon you want to make:</p><textarea id="flashback-input" rows="4" style="width: 100%;"></textarea>`,
			buttons: {
				ok: { label: "Send to GM", callback: (html) => resolve(html.find("#flashback-input").val().trim()) },
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			close: () => resolve(null)
		}).render(true);
	});
	if (!flashbackText) return false;
	return await executeRollerAsGM("rollerFlashbackRequest", game.user.name, flashbackText);
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

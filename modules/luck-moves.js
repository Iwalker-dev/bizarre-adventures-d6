import { resetQuadrant, createActionMessage, createContestMessage, recalculateQuadrantFormula } from "./apps/bad6-roller.js";
import { getRollerSocket } from "./sockets.js";

async function executeRollerAsGM(handler, ...args) {
	const socket = getRollerSocket();
	if (!socket) {
		ui.notifications.error("Socket is not ready. Cannot execute GM action.");
		return null;
	}
	return await socket.executeAsGM(handler, ...args);
}

function canUseMove(move, actor) {
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
			const doc = fromUuidSync(source.sourceUuid);
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
		// Check if this actor has the highest of any luck value so far
				if (!values[0] || luckStat.temp > values[0]) {
					values[0] = luckStat.temp;
					spenders[0] = source.actorId;
				}
				if (!values[1] || luckStat.perm > values[1]) {
					values[1] = luckStat.perm;
					spenders[1] = source.actorId;
				}
				if (!values[2] || luckStat.value > values[2]) {
					values[2] = luckStat.value;
					spenders[2] = source.actorId;
				}
	}

	return spenders;
}

export async function trySpendLuck(actorId, action, refund = false) {
	const actor = game.actors.get(actorId);
	if (!actor) {
		console.error(`BAD6 | trySpendLuck: could not find actor with id "${actorId}"`);
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
	let spender;
	// Determine the spender based on move cost type
	switch (LUCK_MOVES[move].costType) {
		case "gambit":
			break;
		case "temp":
			spender = spenders[0]; // temp luck spender
			break;
		case "perm":
			spender = spenders[1]; // perm luck spender
			break;
		case "value":
			spender = spenders[2]; // value luck spender
			break;
		default:
			ui.notifications.warn("Invalid cost type for move: " + LUCK_MOVES[move].name);
			return;
	}
	if (!isGambit && !canUseMove(LUCK_MOVES[move], game.actors.get(spender))) {
		return;
	}

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
			await trySpendLuck(spender, LUCK_MOVES[move].name);
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
			if (!isGambit && spender) {
				updateData.luckSpenders = {
					...lastSpenders,
					[move]: {
						...lastMoveSpenders,
						[spender]: (lastMoveSpenders[spender] || 0) + 1
					}
				};
			}



			// Update the message flags with the new data
			await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, updateData);
			if (move === "fudge" || move === "mulligan") {
				await recalculateQuadrantFormula(messageId, quadrantNum);
			}
		}
}

function getQuadrantAdvantage(message, quadrantNum) {
	const quadrantNumber = Number(quadrantNum);
	const pairMap = { 1: 2, 2: 1, 3: 4, 4: 3 };
	const own = Number(message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNumber}`)?.advantage);
	if (Number.isFinite(own)) return own;

	const pairQuadrant = pairMap[quadrantNumber];
	const pair = Number(message?.getFlag("bizarre-adventures-d6", `quadrant${pairQuadrant}`)?.advantage);
	if (Number.isFinite(pair)) return pair;

	return 0;
}

async function executeFeint(messageId, quadrantNum) {
	// Reset quadrant except for luck. Feint count is incremented by 1.
	await resetQuadrant(messageId, quadrantNum, false);
	return true;
}

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
	let existing = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
	let advantage = getQuadrantAdvantage(message, quadrantNum);
	let executed = false;
	if (advantage < 2) {
		await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, { 
			...existing,
			advantage: advantage + 1
		});
		executed = true;
	}
	return executed;
}

async function executePersist(messageId, quadrantNum) {
	// Execute a clash regardless of the last result, creating a new action/contest.
	const message = game.messages.get(messageId);
	const newMessage = await ChatMessage.create({
		content: `<p><strong>Persist!</strong></p>`
	});
	await message.setFlag("bizarre-adventures-d6", "locked", true);
	const type = message.getFlag("bizarre-adventures-d6", "type");
	if (type === "action") {
		createActionMessage();
	} else if (type === "contest") {
		createContestMessage();
	}
	return true;
}

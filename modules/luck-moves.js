/**
 * Luck Moves System - Handles all Luck move checks, costs, and applications
 */

/**
 * Luck move definitions with their base costs and properties
 */
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
		timing: "post-roll",
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

function resolveLinkedActorSync(linked) {
	if (!linked) return null;
	if (linked.uuid && typeof fromUuidSync === "function") {
		try {
			return fromUuidSync(linked.uuid);
		} catch (e) {
			return null;
		}
	}
	return null;
}

function resolveLuckActorSync(actor) {
	if (!actor) return null;
	const luck = actor.system?.attributes?.stats?.luck;
	const temp = luck?.temp || 0;
	const perm = luck?.perm || 0;
	if (temp > 0 || perm > 0) return actor;

	const linkedActors = actor.system?.bio?.linkedActors?.value || [];
	for (const linked of linkedActors) {
		const linkedActor = resolveLinkedActorSync(linked);
		if (!linkedActor) continue;
		const l = linkedActor.system?.attributes?.stats?.luck;
		const t = l?.temp || 0;
		const p = l?.perm || 0;
		if (t > 0 || p > 0) return linkedActor;
	}
	return actor;
}

async function resolveLuckActor(actor) {
	if (!actor) return null;
	const luck = actor.system?.attributes?.stats?.luck;
	const temp = luck?.temp || 0;
	const perm = luck?.perm || 0;
	if (temp > 0 || perm > 0) return actor;

	const linkedActors = actor.system?.bio?.linkedActors?.value || [];
	for (const linked of linkedActors) {
		let linkedActor = null;
		if (linked.uuid) {
			try {
				linkedActor = await fromUuid(linked.uuid);
			} catch (e) {
				linkedActor = null;
			}
		}
		if (!linkedActor) continue;
		const l = linkedActor.system?.attributes?.stats?.luck;
		const t = l?.temp || 0;
		const p = l?.perm || 0;
		if (t > 0 || p > 0) return linkedActor;
	}
	return actor;
}

/**
 * Check if an actor has enough luck to use a move
 * @param {Actor} actor - The actor to check
 * @param {string} moveKey - The luck move key (e.g., "fudge", "mulligan")
 * @param {boolean} hasGambit - Whether the actor is using a Gambit (reduces cost to 0)
 * @returns {Object} { canUse: boolean, needed: number, current: number, reason: string }
 */
export function canUseLuckMove(actor, moveKey, hasGambit = false) {
	const move = LUCK_MOVES[moveKey];
	if (!move) return { canUse: false, reason: "Invalid luck move" };

	const luckActor = resolveLuckActorSync(actor);
	const luck = luckActor?.system?.attributes?.stats?.luck;
	if (!luck) return { canUse: false, reason: "Actor has no Luck stat" };

	const effectiveCost = hasGambit && moveKey !== "gambit" ? 0 : move.cost;
	const costType = move.costType;

	if (costType === "temp") {
		const current = luck.temp || 0;
		return {
			canUse: current >= effectiveCost,
			needed: effectiveCost,
			current,
			costType: "temp",
			reason: current < effectiveCost ? "(Not enough temp luck!)" : ""
		};
	} else if (costType === "perm") {
		const current = luck.perm || 0;
		return {
			canUse: current >= effectiveCost,
			needed: effectiveCost,
			current,
			costType: "perm",
			reason: current < effectiveCost ? "(Not enough perm luck!)" : ""
		};
	}

	return { canUse: false, reason: "Unknown cost type" };
}

/**
 * Spend luck for a move, with feint count multiplication if applicable
 * @param {Actor} actor - The actor spending luck
 * @param {string} moveKey - The luck move key
 * @param {boolean} hasGambit - Whether a Gambit is being used
 * @param {number} feintCount - Number of feints used (for feint move only)
 * @returns {Promise<{success: boolean, error: string|null}>} Success status and error message
 */
export async function spendLuckMove(actor, moveKey, hasGambit = false, feintCount = 0) {
	const move = LUCK_MOVES[moveKey];
	if (!move) return { success: false, error: "Invalid luck move" };

	const check = canUseLuckMove(actor, moveKey, hasGambit);
	if (!check.canUse) return { success: false, error: check.reason };

	const luckActor = await resolveLuckActor(actor);
	if (!luckActor) return { success: false, error: "No actor with Luck found" };
	const luck = luckActor.system.attributes.stats.luck;
	
	// Calculate effective cost
	let effectiveCost = hasGambit && moveKey !== "gambit" ? 0 : move.cost;
	
	// For feint, multiply cost by feint count
	if (moveKey === "feint" && feintCount > 0) {
		effectiveCost = move.cost * feintCount;
	}

	// If Gambit is used, no actual cost is deducted
	if (hasGambit && moveKey !== "gambit") {
		console.log(`BAD6 | ${actor.name} used ${move.name} with Gambit - no cost!`);
		return { success: true, error: null };
	}

	if (move.costType === "temp") {
		const newTemp = luck.temp - effectiveCost;
		if (newTemp < 0) {
			// Error but set to 0
			await luckActor.update({
				"system.attributes.stats.luck.temp": 0
			});
			return { 
				success: false, 
				error: `ERROR: Would reduce temp luck below 0! Set to 0. Tried to spend ${effectiveCost} but only had ${luck.temp}.`
			};
		}
		await luckActor.update({
			"system.attributes.stats.luck.temp": newTemp
		});
	} else if (move.costType === "perm") {
		const newPerm = luck.perm - effectiveCost;
		if (newPerm < 0) {
			// Error but set to 0
			await luckActor.update({
				"system.attributes.stats.luck.perm": 0
			});
			return { 
				success: false, 
				error: `ERROR: Would reduce perm luck below 0! Set to 0. Tried to spend ${effectiveCost} but only had ${luck.perm}.`
			};
		}
		await luckActor.update({
			"system.attributes.stats.luck.perm": newPerm
		});
	}

	console.log(`BAD6 | ${actor.name} spent ${effectiveCost} ${move.costType} luck on ${move.name}`);
	return { success: true, error: null };
}

/**
 * Check if Fudge can be used, accounting for advantage cap
 * @param {Actor} actor - The actor
 * @param {number} currentAdvantage - Current advantage level
 * @param {boolean} hasGambit - Whether Gambit is being used
 * @returns {Object} { canUse: boolean, reason: string, currentLuck: number }
 */
export function canUseFudge(actor, currentAdvantage = 0, hasGambit = false) {
	const luckActor = resolveLuckActorSync(actor);
	const luck = luckActor?.system?.attributes?.stats?.luck;
	if (!luck) return { canUse: false, reason: "Actor has no Luck stat", currentLuck: 0 };

	const effectiveCost = hasGambit ? 0 : 2;
	const tempLuck = luck.temp || 0;

	// Check advantage cap first (prioritize showing this error)
	if (currentAdvantage >= 3) {
		return {
			canUse: false,
			reason: "(Would break Advantage cap!)",
			currentLuck: tempLuck
		};
	}

	// Check temp luck
	if (tempLuck < effectiveCost) {
		return {
			canUse: false,
			reason: "(Not enough temp luck!)",
			currentLuck: tempLuck
		};
	}

	return {
		canUse: true,
		reason: "",
		currentLuck: tempLuck
	};
}

/**
 * Get available luck moves filtered by timing
 * @param {Actor} actor - The actor to check
 * @param {string} timing - "pre-roll", "post-roll", or "anytime"
 * @param {boolean} hasGambit - Whether Gambit is being used
 * @returns {Array} Array of move availability objects
 */
export function getAvailableLuckMoves(actor, timing = "anytime", hasGambit = false) {
	const moves = [];

	for (const [key, move] of Object.entries(LUCK_MOVES)) {
		// Filter by timing
		if (timing !== "anytime" && move.timing !== timing && move.timing !== "anytime") {
			continue;
		}

		const check = canUseLuckMove(actor, key, hasGambit);
		moves.push({
			key,
			move,
			canUse: check.canUse,
			reason: check.reason,
			costType: check.costType,
			needed: check.needed,
			current: check.current
		});
	}

	return moves;
}

/**
 * Create a feint counter UI for the stat selection dialog
 * Returns an object with HTML and functions to manage feint state
 * @param {Actor} actor - The actor using feints
 * @param {boolean} hasGambit - Whether Gambit is being used
 * @returns {Object} { html: string, feintCount: 0, messageId: null, addFeint, clearFeints, getCount }
 */
export function createFeintCounter(actor, hasGambit = false) {
	const state = {
		feintCount: 0,
		messageId: null,
		hasGambit
	};

	const luck = actor.system.attributes?.stats?.luck;
	const tempLuck = luck?.temp || 0;
	const cost = hasGambit ? 0 : 1;

	const html = `
		<div id="feint-counter" style="border-top: 1px solid #ccc; margin-top: 10px; padding-top: 10px;">
			<p style="margin: 5px 0;"><strong>Feint Counter</strong></p>
			<p style="font-size: 0.85em; color: #666;">Cost: ${cost} Temp Luck per feint</p>
			<div style="display: flex; gap: 8px; align-items: center;">
				<button id="btn-add-feint" style="padding: 4px 12px; cursor: pointer;">+ Feint</button>
				<button id="btn-clear-feint" style="padding: 4px 12px; cursor: pointer;">⊗ Clear</button>
				<span id="feint-display" style="font-weight: bold; min-width: 50px;">Count: 0</span>
			</div>
		</div>
	`;

	return {
		html,
		state,
		canAddFeint: () => {
			const effectiveCost = hasGambit ? 0 : 1;
			return tempLuck >= effectiveCost;
		},
		addFeint: async function(formElement) {
			if (!this.canAddFeint()) {
				ui.notifications.warn("Not enough temp luck for another feint!");
				return false;
			}
			this.state.feintCount++;
			const display = formElement.querySelector("#feint-display");
			if (display) {
				display.textContent = `Count: ${this.state.feintCount}`;
			}
			// Delete old message if exists
			if (this.state.messageId) {
				const oldMsg = game.messages.get(this.state.messageId);
				if (oldMsg) await oldMsg.delete();
			}
			// Send new feint message
			const msg = await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor }),
				content: `<strong>${actor.name} is feinting!</strong> x${this.state.feintCount}`,
				whisper: game.users.filter(u => u.isGM).map(u => u.id)
			});
			this.state.messageId = msg.id;
			return true;
		},
		clearFeints: async function(formElement) {
			if (this.state.feintCount > 0) {
				// Delete feint message
				if (this.state.messageId) {
					const msg = game.messages.get(this.state.messageId);
					if (msg) await msg.delete();
				}
				// Send cancel message
				const cancelMsg = await ChatMessage.create({
					speaker: ChatMessage.getSpeaker({ actor }),
					content: `<strong>${actor.name}</strong> Feint x${this.state.feintCount} Cancelled!`,
					whisper: game.users.filter(u => u.isGM).map(u => u.id)
				});
				// Delete cancel message after a short delay
				setTimeout(() => {
					cancelMsg.delete();
				}, 2000);
			}
			this.state.feintCount = 0;
			const display = formElement.querySelector("#feint-display");
			if (display) {
				display.textContent = "Count: 0";
			}
			this.state.messageId = null;
		},
		getCount: function() {
			return this.state.feintCount;
		}
	};
}

/**
 * Show a dialog to select a luck move for a given timing
 * @param {Actor} actor - The actor to check
 * @param {string} timing - "pre-roll" or "post-roll"
 * @param {boolean} hasGambit - Whether Gambit is being used
 * @returns {Promise<string|null>} Selected move key or null
 */
export function showLuckMoveDialog(actor, timing = "post-roll", hasGambit = false) {
	return new Promise(resolve => {
		const moves = getAvailableLuckMoves(actor, timing, hasGambit);

		if (moves.length === 0) {
			resolve(null);
			return;
		}

		// Build HTML for move options
		let html = '<div style="max-height: 300px; overflow-y: auto;">';
		const buttons = { skip: { label: "Skip", callback: () => resolve(null) } };

		for (const moveData of moves) {
			const { key, move, canUse, reason } = moveData;
			const cost = hasGambit && key !== "gambit" ? 0 : move.cost;
			const disabled = !canUse ? " disabled" : "";
			const reasonText = reason ? ` <span style="color: #ff6b6b; font-size: 0.9em;">${reason}</span>` : "";

			html += `
				<div style="margin-bottom: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
					<strong>${move.name}</strong> (Cost: ${cost} ${move.costType === "perm" ? "Perm" : "Temp"})
					${reasonText}
					<br><span style="font-size: 0.85em;">${move.description}</span>
				</div>
			`;

			buttons[key] = {
				label: move.name,
				callback: () => resolve(key),
				disabled: !canUse
			};
		}

		html += '</div>';

		new Dialog({
			title: `Select a Luck Move (${timing})`,
			content: html,
			buttons,
			default: "skip"
		}).render(true);
	});
}

/**
 * Create checkboxes for luck moves during rolling
 * @param {Actor} actor - The actor making the selection
 * @param {boolean} hasGambit - Whether Gambit is available
 * @returns {Object} { html: string, getSelected: function }
 */
export function createLuckMoveCheckboxes(actor, hasGambit = false) {
	const preRollMoves = getAvailableLuckMoves(actor, "pre-roll", hasGambit);
	const postRollMoves = getAvailableLuckMoves(actor, "post-roll", hasGambit);

	let html = '<div style="border-top: 1px solid #ccc; margin-top: 10px; padding-top: 10px;">';
	html += '<p style="margin: 5px 0;"><strong>Luck Moves</strong></p>';

	// Pre-roll moves
	if (preRollMoves.length > 0) {
		html += '<p style="margin: 5px 0; font-size: 0.9em; color: #666;">Pre-Roll:</p>';
		for (const moveData of preRollMoves) {
			const { key, move, canUse, reason } = moveData;
			const cost = hasGambit && key !== "gambit" ? 0 : move.cost;
			const disabled = !canUse ? "disabled" : "";
			const reasonText = reason ? ` ${reason}` : "";

			html += `
				<label style="display: block; margin: 4px 0; ${!canUse ? "opacity: 0.6;" : ""}">
					<input type="checkbox" name="luck_move_${key}" value="${key}" ${disabled}>
					${move.name} (-${cost} ${move.costType === "perm" ? "Perm" : "Temp"})${reasonText}
				</label>
			`;
		}
	}

	// Post-roll moves (as info only)
	if (postRollMoves.length > 0) {
		html += '<p style="margin: 5px 0; font-size: 0.9em; color: #666;">Post-Roll (available after):</p>';
		for (const moveData of postRollMoves) {
			const { move, canUse, reason } = moveData;
			const reasonText = reason ? ` ${reason}` : "";

			html += `
				<label style="display: block; margin: 4px 0; opacity: 0.7;">
					<input type="checkbox" disabled>
					${move.name}${reasonText}
				</label>
			`;
		}
	}

	html += '</div>';

	return {
		html,
		getSelected: (formElement) => {
			const checkboxes = formElement.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)');
			return Array.from(checkboxes).map(cb => cb.value);
		}
	};
}

/**
 * Apply a luck move's effect to a roll result
 * @param {string} moveKey - The luck move key
 * @param {number} currentAdvantage - Current advantage level
 * @returns {Object} { advantage: number, message: string }
 */
export function applyLuckMoveEffect(moveKey, currentAdvantage = 0) {
	const move = LUCK_MOVES[moveKey];
	if (!move) return { advantage: currentAdvantage, message: "" };

	switch (move.effect) {
		case "advantage":
			const newAdvantage = Math.min(currentAdvantage + 1, 3);
			return {
				advantage: newAdvantage,
				message: `Advantage increased to ${newAdvantage}`
			};

		case "narrative":
			return {
				advantage: currentAdvantage,
				message: "Narrator retcons a detail of your choice"
			};

		case "reroll":
			return {
				advantage: currentAdvantage,
				message: "You may attempt another Action/Reaction as if this action tied"
			};

		case "special":
			return {
				advantage: currentAdvantage,
				message: "Gambit activated - no cost applied to this action"
			};

		default:
			return { advantage: currentAdvantage, message: "" };
	}
}

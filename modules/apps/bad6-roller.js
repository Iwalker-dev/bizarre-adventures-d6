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
	showStatDialog,
	getActorDisplayName
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

/**
 * Escape HTML for safe injection into chat content.
 * @param {string|null|undefined} str
 * @returns {string}
 */
function escapeHtml(str) {
	if (str === undefined || str === null) return '';
	return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
}

/**
 * Check whether the current user can see roll formulas for an actor.
 * @param {Actor|null} actor
 * @returns {boolean}
 */
function canViewActorFormula(actor) {
	if (game.user.isGM) return true;
	if (!actor) return false;
	return !!actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
}

/**
 * Resolve an Actor from a UUID without async calls.
 * @param {string|null|undefined} uuid
 * @returns {Actor|null}
 */
function resolveActorFromUuidSync(uuid) {
	if (!uuid || typeof uuid !== "string") return null;
	if (!uuid.startsWith("Actor.")) return null;
	const parts = uuid.split(".");
	const actorId = parts[1];
	return game.actors?.get(actorId) || null;
}

/**
 * Resolve an Actor from a speaker.
 * @param {object|null|undefined} speaker
 * @returns {Actor|null}
 */
function resolveActorFromSpeaker(speaker) {
	const actorId = speaker?.actor;
	if (!actorId) return null;
	return game.actors?.get(actorId) || null;
}

/**
 * Parse the cs>=N threshold from a formula.
 * @param {string} formula
 * @returns {number}
 */
function parseThreshold(formula) {
	const match = /cs\s*>=\s*([0-9]+)/i.exec(formula || "");
	return match ? Number(match[1]) : 5;
}

/**
 * Extract d6 results from a roll.
 * @param {Roll} roll
 * @returns {number[]}
 */
function extractDiceResults(roll) {
	const dice = roll?.dice?.[0];
	if (!dice || !Array.isArray(dice.results)) return [];
	return dice.results.map(r => Number(r.result)).filter(n => !Number.isNaN(n));
}

/**
 * Count successes given a threshold.
 * @param {number[]} results
 * @param {number} threshold
 * @returns {number}
 */
function countSuccesses(results, threshold) {
	return results.reduce((sum, n) => sum + (n >= threshold ? 1 : 0), 0);
}

/**
 * Build a roll snapshot for chat rendering and luck logic.
 * @param {Roll} roll
 * @param {string} formula
 * @param {number} advantage
 * @returns {{formula:string,threshold:number,diceResults:number[],delta:number,advantage:number,total:number}}
 */
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

let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
const DOUBLE_CLICK_WINDOW_MS = 250;
/**
 * Play Dice So Nice animation if available.
 * @param {Roll} roll
 * @returns {Promise<void>}
 */
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

/**
 * Register the scene control button for the D6 Roller.
 * @returns {void}
 */
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
				, onClick: async () => {
					if (rollerClickTimer) {
						clearTimeout(rollerClickTimer);
						rollerClickTimer = null;
						const now = Date.now();
						const priorId = lastActionMessageId;
						const isDouble = priorId && (now - lastActionMessageAt) <= DOUBLE_CLICK_WINDOW_MS;
						lastActionMessageId = null;
						lastActionMessageAt = 0;
						if (isDouble && priorId) {
							const prior = game.messages.get(priorId);
							const priorState = prior?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
							if (prior && priorState && !priorState.hasReaction) {
								const upgraded = upgradeActionStateToContest(priorState);
								await updateContestMessage(prior, upgraded);
								return;
							}
						}
						await createContestMessage({ forceContest: true, forceUserSpeaker: true });
						return;
					}
					const msg = await createContestMessage({ forceContest: false, forceUserSpeaker: true });
					lastActionMessageId = msg?.id || null;
					lastActionMessageAt = Date.now();
					rollerClickTimer = setTimeout(() => {
						rollerClickTimer = null;
						lastActionMessageId = null;
						lastActionMessageAt = 0;
					}, DOUBLE_CLICK_WINDOW_MS);
				}
		};
	});

}

/**
 * GM-run ready check on behalf of a player.
 * @param {string} actorId
 * @param {string} baseFormula
 * @param {string} statKey
 * @param {string} statLabel
 * @param {number} advantage
 * @param {Object} data
 * @param {number} [feintCount=0]
 * @param {boolean} [useFudge=false]
 * @param {boolean} [gambitForFeint=false]
 * @param {boolean} [gambitForFudge=false]
 * @param {boolean} [showFudge=true]
 * @param {string} [fudgeLockReason=""]
 * @param {boolean} [suppressMessage=false]
 * @param {string|null} [luckActorUuid=null]
 * @returns {Promise<{total:number,snapshot:Object,useFudge:boolean,effectiveAdvantage:number}|null>}
 */
// Takes an actorId, not an Actor instance
async function readyCheck(actorId, baseFormula, statKey, statLabel, advantage, data, feintCount = 0, useFudge = false, gambitForFeint = false, gambitForFudge = false, showFudge = true, fudgeLockReason = "", suppressMessage = false, luckActorUuid = null) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;
	const luckActor = luckActorUuid ? await fromUuid(luckActorUuid) : actor;

	const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
	// Let dice helpers prepare the final formula using items on the actor
	const formulaResult = await prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge, gambitForFudge, showFudge, fudgeLockReason, "");
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
		const { success, error } = await spendLuckMove(actor, "fudge", rollProcessGambitDefaults.fudge, 0, luckActor);
		if (!success && error) {
			ui.notifications.error(error);
		}
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
 * Resolve which actor will roll, with linked-actor selection as needed.
 * @param {number} i
 * @param {boolean} [reaction=false]
 * @returns {Promise<Actor|null>}
 */
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
			const rollerDisplayName = getActorDisplayName(roller);
			let buttons = {
				[roller.id]: {
					label: rollerDisplayName,
					callback: () => roller
				}
			};
			// Fetch each linked actor and create a button
			for (let linked of linkedActors) {
				const actor = await fromUuid(linked.uuid);
				if (actor) {
					const displayName = getActorDisplayName(actor);
					buttons[linked.uuid] = {
						label: `${displayName} (${linked.type})`,
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
			const displayName = getActorDisplayName(a);
			buttons[a.id] = {
				label: displayName,
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

/**
 * Request a stat selection from the user.
 * @param {Actor} actor
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
function requestStat(actor, options = {}) {
	return showStatDialog(actor, options);
}


/**
 * Convert a DC total to a label.
 * @param {number} value
 * @returns {string}
 */
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

/**
 * Convert hit difference to a severity label.
 * @param {number} value
 * @returns {string}
 */
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


/**
 * Helper to find a non-GM owner or fallback to GM.
 * @param {Actor} actor
 * @returns {User|undefined}
 */
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

/**
 * Create an empty roll state for a single roll.
 * @returns {Object}
 */
function createEmptyRollState() {
	return {
		prepared: false,
		resolved: false,
		actorUuid: null,
		luckActorUuid: null,
		actorName: null,
		statKey: null,
		statLabel: null,
		statValue: null,
		baseFormula: null,
		formula: null,
		diceResults: null,
		total: null,
		advantage: null,
		effectiveAdvantage: null,
		useFudge: false,
		useGambit: false,
		feintCount: 0,
		gambitSelections: null,
		snapshot: null,
		rollHtml: null
	};
}

/**
 * Create roll pair state (two rolls and metadata).
 * @returns {Object}
 */
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

/**
 * Create the contest state container.
 * @param {boolean} hasReaction
 * @returns {Object}
 */
function createContestState(hasReaction) {
	return {
		version: 1,
		hasReaction: !!hasReaction,
		nextStep: null,
		isResolving: false,
		action: createPairState(),
		reaction: createPairState(),
		result: null
	};
}

/**
 * Compute total for a roll pair.
 * @param {Object} pair
 * @returns {number|null}
 */
function computePairTotal(pair) {
	if (pair?.rolls?.[1]?.resolved && pair?.rolls?.[2]?.resolved) {
		return Number(pair.rolls[1].total || 0) + Number(pair.rolls[2].total || 0);
	}
	return null;
}

/**
 * Check if all required quadrants are prepared.
 * @param {Object} state
 * @returns {boolean}
 */
function allQuadrantsPrepared(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = state?.[parsed.side]?.rolls?.[parsed.rollIndex];
		if (!roll?.prepared) return false;
	}
	return true;
}

/**
 * Check if any quadrants are resolved.
 * @param {Object} state
 * @returns {boolean}
 */
function anyQuadrantsResolved(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = state?.[parsed.side]?.rolls?.[parsed.rollIndex];
		if (roll?.resolved) return true;
	}
	return false;
}

/**
 * Close all dialogs related to the contest.
 * @returns {void}
 */
function closeContestDialogs() {
	const openDialogs = Object.values(ui.windows).filter(d => d instanceof Dialog);
	for (const dialog of openDialogs) {
		const content = dialog.element?.[0]?.innerText || "";
		// Close stat dialogs, feint dialogs, choice dialogs (look for common patterns)
		if (content.includes("Stat") || content.includes("Feint") || content.includes("Choose") || 
		    content.includes("Prepare") || content.includes("Action") || content.includes("Reaction")) {
			dialog.close();
		}
	}
}

/**
 * Format a prepared roll summary (stats selected but not rolled).
 * @param {Object} roll
 * @returns {string}
 */
function formatPreparedSummary(roll) {
	if (!roll?.prepared || roll?.resolved) return "";
	const actorName = escapeHtml(roll.actorName || "Unknown");
	const statLabel = escapeHtml(roll.statLabel || "Stat");
	const advDisplay = roll.advantage !== null && roll.advantage !== undefined 
		? ` (+${roll.advantage} Adv)`
		: "";
	const feintDisplay = roll.feintCount > 0
		? `<div style="color:#c70; font-weight:bold; margin-top:4px;">🎭 Feints: ${roll.feintCount}</div>`
		: "";
	const lineStyle = "white-space:normal; overflow-wrap:anywhere; word-break:break-word;";
	return `
		<div style="${lineStyle}"><strong>${actorName}</strong> — ${statLabel}${advDisplay}</div>
		${feintDisplay}
		<div style="font-size:0.85em; color:#666; margin-top:2px;"><em>Ready to resolve</em></div>
	`;
}

/**
 * Format a roll summary HTML block.
 * @param {Object} roll
 * @returns {string}
 */
function formatRollSummary(roll) {
	if (!roll?.resolved) return "<em>Pending</em>";
	const actorName = escapeHtml(roll.actorName || "Unknown");
	const statLabel = escapeHtml(roll.statLabel || "Stat");
	const lineStyle = "white-space:normal; overflow-wrap:anywhere; word-break:break-word;";
	const actorUuid = escapeHtml(roll.actorUuid || "");
	const rollCard = roll.rollHtml
		? `<div class="bad6-roll-card" data-actor-uuid="${actorUuid}" style="margin:4px 0;">${roll.rollHtml}</div>`
		: "";
	return `
		<div style="${lineStyle}"><strong>${actorName}</strong> — ${statLabel}</div>
		${rollCard}
	`;
}

/**
 * Get display label for a quadrant.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @returns {string}
 */
function getQuadrantLabel(side, rollIndex) {
	const sideLabel = side === "reaction" ? "Reaction" : "Action";
	return `${sideLabel} Roll ${rollIndex}`;
}

/**
 * Get button label for a quadrant.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @returns {string}
 */
function getQuadrantButtonLabel(side, rollIndex, rollData) {
	if (rollData?.prepared && !rollData?.resolved) {
		const sideLabel = side === "reaction" ? "Reaction" : "Action";
		return `Edit ${sideLabel} ${rollIndex}`;
	}
	if (side === "reaction" && rollIndex === 1) return "Prepare Reaction";
	if (side === "action" && rollIndex === 1) return "Prepare Action";
	const sideLabel = side === "reaction" ? "Reaction" : "Action";
	return `Prepare ${sideLabel} ${rollIndex}`;
}

/**
 * Render a quadrant cell HTML block.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @param {string|null} nextStep
 * @param {boolean} isResolving
 * @returns {string}
 */
function renderQuadrantCell(side, rollIndex, rollData, nextStep, isResolving) {
	const quadrant = `${side}-${rollIndex}`;
	const label = getQuadrantLabel(side, rollIndex);
	const buttonStyle = `margin-top:6px;`;
	
	let button = "";
	if (isResolving && rollData?.prepared && !rollData?.resolved) {
		// Show "Rolling..." button when resolution is in progress
		button = `<button type="button" class="bad6-roll-btn" disabled style="${buttonStyle} opacity:0.6; cursor:not-allowed;">Rolling...</button>`;
	} else if (!rollData?.resolved) {
		// Show prepare/edit button if not resolving and not resolved
		button = `<button type="button" class="bad6-roll-btn" data-quadrant="${quadrant}" style="${buttonStyle}">${getQuadrantButtonLabel(side, rollIndex, rollData)}</button>`;
	}
	
	let content;
	if (rollData?.resolved) {
		content = formatRollSummary(rollData);
	} else if (rollData?.prepared) {
		content = formatPreparedSummary(rollData);
	} else {
		content = "<em>Pending</em>";
	}
	return `
		<div style="padding:6px;">
			<div style="font-weight:bold; margin-bottom:4px;">${label}</div>
			<div style="display:flex; flex-direction:column; gap:2px;">${content}${button}</div>
		</div>
	`;
}

/**
 * Build contest chat HTML from state.
 * @param {Object} state
 * @returns {string}
 */
function buildContestHtml(state) {
	const actionAdvNote = state.action?.advantage !== null && state.action?.advantage !== undefined
		? `<div style="margin-top:4px; font-style:italic; color:#666;">Advantage: ${state.action.advantage} (chosen by ${escapeHtml(state.action.advantageChosenBy || "Unknown")})</div>`
		: "";
	const actionPersistNote = state.action?.persistNote
		? `<div style="margin-top:4px; font-style:italic; color:#666;">${state.action.persistNote}</div>`
		: "";
	const actionRow = `
		<div style="border-bottom:2px solid #555; padding-bottom:4px;">
			${renderQuadrantCell("action", 1, state.action.rolls[1], state.nextStep, state.isResolving)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("action", 2, state.action.rolls[2], state.nextStep, state.isResolving)}
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
		<div style="margin-top:6px; padding-top:4px;">
			${renderQuadrantCell("reaction", 1, state.reaction.rolls[1], state.nextStep, state.isResolving)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("reaction", 2, state.reaction.rolls[2], state.nextStep, state.isResolving)}
			${reactionAdvNote}
			${reactionPersistNote}
		</div>
		`
		: "";
	
	// Show "Resolve Contest" button if all prepared and none resolved, and not currently resolving
	const canResolve = allQuadrantsPrepared(state) && !anyQuadrantsResolved(state) && !state.isResolving;
	const resolveButton = canResolve
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999; text-align:center;">
			<button type="button" data-action="resolve" style="background:#4a7; color:#fff; font-weight:bold; font-size:1.1em; padding:8px 16px; border:none; border-radius:4px; cursor:pointer;">
				🎲 Resolve Contest
			</button>
		</div>`
		: "";
	
	const resultHtml = state.result
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999;"><strong>Result:</strong> ${state.result.label}</div>`
		: "";
	return `
		<div class="bad6-contest" style="border:1px solid #777; padding:6px; background:#f8f8f8;">
			${actionRow}
			${reactionRow}
			${resolveButton}
			${resultHtml}
		</div>
	`;
}

/**
 * Update contest chat message, routing via GM if needed.
 * @param {ChatMessage} message
 * @param {Object} state
 * @returns {Promise<void>}
 */
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

/**
 * GM-side update for contest messages.
 * @param {string} messageId
 * @param {Object} state
 * @returns {Promise<boolean>}
 */
async function updateContestMessageAsGM(messageId, state) {
	const message = game.messages.get(messageId);
	if (!message) return false;
	await message.setFlag(SYSTEM_ID, CONTEST_FLAG, state);
	await message.update({ content: buildContestHtml(state) });
	return true;
}

/**
 * Parse a quadrant string into its components.
 * @param {string} quadrant
 * @returns {{side:"action"|"reaction",rollIndex:number}|null}
 */
function parseQuadrant(quadrant) {
	const [side, idx] = String(quadrant || "").split("-");
	const rollIndex = Number(idx || 0);
	if (!side || !["action", "reaction"].includes(side) || ![1, 2].includes(rollIndex)) return null;
	return { side, rollIndex };
}

/**
 * Collect linked actor UUIDs for an actor.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
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

/**
 * Check if two actors are linked directly or indirectly.
 * @param {Actor} actorA
 * @param {Actor} actorB
 * @returns {boolean}
 */
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

/**
 * Get roll order by whether a reaction exists.
 * @param {boolean} hasReaction
 * @returns {string[]}
 */
function getRollOrder(hasReaction) {
	return hasReaction
		? ["reaction-1", "reaction-2", "action-1", "action-2"]
		: ["action-1", "action-2"];
}

/**
 * Get next roll quadrant in order.
 * @param {Object} state
 * @param {string} currentQuadrant
 * @returns {string|null}
 */
function getNextStepInOrder(state, currentQuadrant) {
	const order = getRollOrder(state?.hasReaction);
	const idx = order.indexOf(currentQuadrant);
	if (idx === -1) return state?.nextStep || null;
	return order[idx + 1] || null;
}

/**
 * Find the first unresolved quadrant in roll order.
 * @param {Object} state
 * @returns {string|null}
 */
function getFirstUnresolvedStep(state) {
	const order = getRollOrder(state?.hasReaction);
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		const roll = state?.[parsed.side]?.rolls?.[parsed.rollIndex];
		if (!roll?.resolved) return quadrant;
	}
	return null;
}

/**
 * Upgrade a single-action contest state into a full contest state.
 * Preserves any resolved action rolls.
 * @param {Object} state
 * @returns {Object}
 */
function upgradeActionStateToContest(state) {
	if (!state) return state;
	state.hasReaction = true;
	state.reaction = createPairState();
	state.action = createPairState();
	state.result = null;
	state.nextStep = "reaction-1";
	return state;
}

/**
 * Handle post-roll luck moves (mulligan/persist).
 * @param {Object} pair
 * @param {Actor} actor
 * @param {Object} context
 * @returns {Promise<{resetPair:boolean,persistActorName?:string}>}
 */
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
			const actorName = candidateActor?.name || "Unknown";
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

/**
 * Prepare a single roll step (stat selection only, no roll execution).
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} state
 * @param {string|null} [messageId=null]
 * @returns {Promise<Object|null>}
 */
async function prepareOneStep(side, rollIndex, state, messageId = null) {
	const pair = state[side];
	let advantage = pair.advantage;
	const actor = await findRoller(0, side === "reaction");
	if (!actor) return null;

	const advantageLocked = advantage !== null && advantage !== undefined;
	const advantageValue = advantageLocked ? advantage : 0;
	const advantageChosenBy = pair.advantageChosenBy || "";
	const advantageLockReason = advantageLocked ? "Advantage already locked for this pair." : "";

	const allowFeint = true;
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

	return {
		actorUuid: actor.uuid,
		luckActorUuid: stat.luckActorUuid || null,
		actorName: getActorDisplayName(actor),
		statKey: stat.key,
		statLabel: stat.label,
		statValue: stat.value,
		baseFormula: `(${stat.value}d6cs>=5)`,
		advantage: Number(stat.advantage || 0),
		feintCount: stat.feintCount || 0,
		gambitSelections: stat.gambitSelections || null
	};
}

/**
 * Execute a prepared roll (dice rolling and Luck spending).
 * @param {Object} preparedData
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @returns {Promise<Object|null>}
 */
async function executeOneRoll(preparedData, state, side, rollIndex) {
	const pair = state[side];
	const actor = await fromUuid(preparedData.actorUuid);
	if (!actor) return null;

	const luckActor = preparedData.luckActorUuid ? await fromUuid(preparedData.luckActorUuid) : actor;
	const advantage = preparedData.advantage;
	const feintCount = preparedData.feintCount || 0;
	const gambitForFeint = !!preparedData.gambitSelections?.feint;
	const allowFudge = true;
	const showFudge = allowFudge;
	const fudgeLockReason = pair.fudgeChosenBy ? `Fudge used by ${pair.fudgeChosenBy}!` : "";
	
	const hasOwner = Object.entries(actor.ownership || {})
		.some(([uid, lvl]) => {
			const u = game.users.get(uid);
			return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
		});

	// If GM is rolling for a player-owned actor, execute via socketlib
	if (game.user.isGM && hasOwner && await showConfirmRollerDialog()) {
		const rollResult = await socket.executeAsUser(
			"pCheck",
			findOwner(actor).id,
			actor.id,
			preparedData.baseFormula,
			preparedData.statKey,
			preparedData.statLabel,
			advantage,
			actor.getRollData(),
			feintCount,
			false,
			gambitForFeint,
			rollProcessGambitDefaults.fudge,
			showFudge,
			fudgeLockReason,
			true,
			preparedData.luckActorUuid || null
		);
		if (!rollResult) return null;
		const useFudge = !!rollResult.useFudge;
		return {
			actorUuid: actor.uuid,
			luckActorUuid: preparedData.luckActorUuid || null,
			actorName: preparedData.actorName,
			statKey: preparedData.statKey,
			statLabel: preparedData.statLabel,
			formula: rollResult.snapshot?.formula || null,
			diceResults: rollResult.snapshot?.diceResults || null,
			total: rollResult.total,
			advantage,
			effectiveAdvantage: rollResult.effectiveAdvantage ?? advantage,
			useFudge,
			useGambit: gambitForFeint,
			feintCount,
			snapshot: rollResult.snapshot,
			rollHtml: rollResult.rollHtml || null
		};
	}

	// Direct execution
	const data = actor.getRollData();
	let useFudge = false;
	const context = `${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`;
	const formulaResult = await prepareFormula(
		actor,
		preparedData.baseFormula,
		preparedData.statKey,
		preparedData.statLabel,
		advantage,
		data,
		useFudge,
		rollProcessGambitDefaults.fudge,
		showFudge,
		fudgeLockReason,
		context
	);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	const gambitForFudge = !!formulaResult?.useGambitForFudge;
	rollProcessGambitDefaults.fudge = gambitForFudge;
	
	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });
	const rollHtml = await roll.render();

	// Spend Luck for Feints
	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", gambitForFeint, feintCount, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	// Spend Luck for Fudge
	if (useFudge && showFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", gambitForFudge, 0, luckActor);
		if (!success && error) ui.notifications.error(error);
	}

	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return {
		actorUuid: actor.uuid,
		luckActorUuid: preparedData.luckActorUuid || null,
		actorName: preparedData.actorName,
		statKey: preparedData.statKey,
		statLabel: preparedData.statLabel,
		formula: finalFormula,
		diceResults: snapshot.diceResults,
		total: roll.total,
		advantage,
		effectiveAdvantage,
		useFudge,
		useGambit: gambitForFeint,
		feintCount,
		snapshot,
		rollHtml
	};
}

/**
 * Execute a single roll step in the contest flow.
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} state
 * @param {string|null} [messageId=null]
 * @returns {Promise<Object|null>}
 */
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
		gambitDefaults: rollProcessGambitDefaults,
		title: `Roll ${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`
	});
	if (!stat) {
		ui.notifications.warn("Stat selection cancelled.");
		return null;
	}

	rollProcessGambitDefaults.feint = !!stat.gambitSelections?.feint;
	const luckActor = stat.luckActorUuid ? await fromUuid(stat.luckActorUuid) : actor;

	if (!advantageLocked) {
		pair.advantage = Number(stat.advantage || 0);
		pair.advantageChosenBy = getActorDisplayName(actor);
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
			actorName: getActorDisplayName(actor),
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
			snapshot: rollResult.snapshot,
			rollHtml: rollResult.rollHtml || null
		};
	}

	const baseFormula = `(${stat.value}d6cs>=5)`;
	const data = actor.getRollData();
	let useFudge = false;
	const context = `${side === "reaction" ? "Reaction" : "Action"} ${rollIndex}`;
	const formulaResult = await prepareFormula(actor, baseFormula, stat.key, stat.label, advantage, data, useFudge, rollProcessGambitDefaults.fudge, showFudge, fudgeLockReason, context);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	const gambitForFudge = !!formulaResult?.useGambitForFudge;
	rollProcessGambitDefaults.fudge = gambitForFudge;
	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });
	const rollHtml = await roll.render();

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
		actorName: getActorDisplayName(actor),
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
		snapshot,
		rollHtml
	};
}

/**
 * Apply a resolved roll to contest state.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} rollData
 * @returns {void}
 */
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
		snapshot: rollData.snapshot,
		rollHtml: rollData.rollHtml || null
	});
	if (rollData.useFudge && !pair.fudgeChosenBy) {
		pair.fudgeChosenBy = rollData.actorName || "Unknown";
	}
	pair.total = computePairTotal(pair);
}

/**
 * Apply prepared data to contest state (stat selection complete, not rolled yet).
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @param {Object} preparedData
 * @returns {void}
 */
function applyPreparedToState(state, side, rollIndex, preparedData) {
	const pair = state[side];
	const rollState = pair.rolls[rollIndex];
	Object.assign(rollState, {
		prepared: true,
		resolved: false,
		actorUuid: preparedData.actorUuid,
		luckActorUuid: preparedData.luckActorUuid || null,
		actorName: preparedData.actorName,
		statKey: preparedData.statKey,
		statLabel: preparedData.statLabel,
		statValue: preparedData.statValue,
		baseFormula: preparedData.baseFormula,
		advantage: preparedData.advantage,
		feintCount: preparedData.feintCount || 0,
		gambitSelections: preparedData.gambitSelections || null
	});
	// Lock advantage for the pair if not already locked
	if (!pair.advantage && pair.advantage !== 0) {
		pair.advantage = Number(preparedData.advantage || 0);
		pair.advantageChosenBy = preparedData.actorName || "Unknown";
	}
}

/**
 * Clear a prepared roll from contest state.
 * @param {Object} state
 * @param {"action"|"reaction"} side
 * @param {number} rollIndex
 * @returns {void}
 */
function clearPreparedRoll(state, side, rollIndex) {
	const pair = state[side];
	const roll = pair.rolls[rollIndex];
	
	// If this roll set the advantage lock for its pair, reset it
	if (pair.advantageChosenBy === roll.actorName) {
		pair.advantage = null;
		pair.advantageChosenBy = null;
	}
	
	// If this roll used Fudge, reset that too
	if (pair.fudgeChosenBy === roll.actorName) {
		pair.fudgeChosenBy = null;
	}
	
	// Reset the roll state
	pair.rolls[rollIndex] = createEmptyRollState();
}

/**
 * Reset a roll pair after Persist.
 * @param {Object} pair
 * @returns {void}
 */
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

/**
 * Resolve all prepared rolls in a contest.
 * @param {Object} state
 * @param {string|null} messageId
 * @returns {Promise<void>}
 */
async function resolveContest(state, messageId) {
	if (!allQuadrantsPrepared(state) || anyQuadrantsResolved(state)) {
		ui.notifications.warn("Cannot resolve: not all rolls are prepared or some are already resolved.");
		return;
	}

	const message = messageId ? game.messages.get(messageId) : null;
	if (!message) return;

	// Mark that resolution is starting
	state.isResolving = true;
	closeContestDialogs();

	const order = getRollOrder(state.hasReaction);
	
	// Execute all rolls in sequence
	for (const quadrant of order) {
		const parsed = parseQuadrant(quadrant);
		if (!parsed) continue;
		
		const { side, rollIndex } = parsed;
		const preparedRoll = state[side].rolls[rollIndex];
		if (!preparedRoll?.prepared || preparedRoll?.resolved) continue;

		// Execute the roll
		const rollResult = await executeOneRoll(preparedRoll, state, side, rollIndex);
		if (!rollResult) {
			ui.notifications.error(`Failed to execute ${side} roll ${rollIndex}`);
			return;
		}

		// Apply the result to state
		applyRollToState(state, side, rollIndex, rollResult);
		
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
			content: "<strong>Clash!</strong> A new contest begins."
		});
		
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

/**
 * Update contest result based on totals.
 * @param {Object} state
 * @returns {void}
 */
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
	
	// Handler for Prepare/Edit buttons
	if (contest) {
		html.find("button.bad6-roll-btn").on("click", async (event) => {
			event.preventDefault();
			const quadrant = event.currentTarget?.dataset?.quadrant;
			const parsed = parseQuadrant(quadrant);
			if (!parsed) return;
			
			const latest = game.messages.get(message.id);
			const state = latest?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
			if (!state) return;
			
			const { side, rollIndex } = parsed;
			const currentRoll = state?.[side]?.rolls?.[rollIndex];
			
			// If already resolved, can't change
			if (currentRoll?.resolved) {
				ui.notifications.warn("That roll is already resolved.");
				return;
			}
			
			// If prepared, clear it first (edit mode)
			if (currentRoll?.prepared) {
				clearPreparedRoll(state, side, rollIndex);
			}
			
			// Prepare the roll
			const preparedData = await prepareOneStep(side, rollIndex, state, message.id);
			if (!preparedData) return;
			
			// Apply prepared state
			applyPreparedToState(state, side, rollIndex, preparedData);
			
			// Update the message
			const refreshed = game.messages.get(message.id);
			if (refreshed) {
				await updateContestMessage(refreshed, state);
			}
		});
		
		// Handler for Resolve Contest button
		html.find("button[data-action='resolve']").on("click", async (event) => {
			event.preventDefault();
			const latest = game.messages.get(message.id);
			const state = latest?.flags?.[SYSTEM_ID]?.[CONTEST_FLAG];
			if (!state) return;
			
			await resolveContest(state, message.id);
		});

		// Hide roll formulas for users without permission
		html.find(".bad6-roll-card[data-actor-uuid]").each((_, el) => {
			const actorUuid = el?.dataset?.actorUuid || "";
			const actor = resolveActorFromUuidSync(actorUuid);
			if (!canViewActorFormula(actor)) {
				el.innerHTML = "<em>Formula hidden</em>";
			}
		});
	}

	const speakerActor = resolveActorFromSpeaker(message?.speaker);
	if (speakerActor && !canViewActorFormula(speakerActor)) {
		html.find(".dice-formula").text("Formula hidden");
	}
});


/**
 * Create a contest message in chat.
 * @param {Object} [options]
 * @param {boolean} [options.forceContest=false]
 * @param {boolean} [options.forceUserSpeaker=false]
 * @returns {Promise<void>}
 */
async function createContestMessage({ forceContest = false, forceUserSpeaker = false } = {}) {
	rollProcessGambitDefaults = {
		feint: false,
		fudge: false,
		mulligan: false,
		persist: false
	};
	let hasReaction = false;
	let gmNarrator = false;
	const targetCount = game.user.targets.size;
	if (targetCount > 0) {
		hasReaction = true;
	}
	if (game.user.isGM) {
		// TODO:
		// -Fix persist logic for contests (untested fix implemented). Add automated hit application.
		// -Try to call actor in way which can trigger anonymous module (untested fix implemented). Also, fix it saying "only actors can be dragged in" when draging actors into the sheet (untested fix implemented).
		if (canvas.tokens.controlled.length < 1) {
			gmNarrator = true;
			hasReaction = false;
		}
		if (canvas.tokens.controlled.length > 1) {
			hasReaction = true;
		}
	}
	if (forceContest) {
		hasReaction = true;
	}
	const state = createContestState(hasReaction);
	const rollOrder = getRollOrder(hasReaction);
	const firstStep = rollOrder[0];
	state.nextStep = firstStep;
	updateResultState(state);

	const speaker = (forceUserSpeaker || gmNarrator)
		? { alias: game.user.name }
		: ChatMessage.getSpeaker({ actor: null });
	const message = await ChatMessage.create({
		speaker,
		content: buildContestHtml(state),
		flags: {
			[SYSTEM_ID]: {
				[CONTEST_FLAG]: state
			}
		}
	});
	return message;
}

// Entrypoint
/**
 * Entrypoint for the roller.
 * @returns {Promise<void>}
 */
async function main() {
	return createContestMessage();
}
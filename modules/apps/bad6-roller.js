let socket;

import { prepareFormula } from "../dice.js";
import { 
	canUseLuckMove, 
	spendLuckMove, 
	getAvailableLuckMoves, 
	applyLuckMoveEffect, 
	LUCK_MOVES 
} from "../luck-moves.js";

// Register socket function as soon as socketlib is ready
Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem("bizarre-adventures-d6");
	socket.register("pCheck", readyCheck);
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
async function readyCheck(actorId, baseFormula, statKey, statLabel, advantage, data, feintCount = 0, useFudge = false, useGambit = false, showFudge = true, suppressMessage = false) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;

	const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
	// Let dice helpers prepare the final formula using items on the actor
	const formulaResult = await prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge, useGambit, showFudge);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	const content = `<p>Roll <strong>${statLabel}</strong>${advantagePhrase}? <code>${finalFormula}</code></p>`;

	const confirmed = await new Promise(resolve => {
		new Dialog({
			title: "A Roll is Ready"
			, content
			, buttons: {
				Yes: {
					label: "Yes"
					, callback: () => resolve(true)
				}
				, No: {
					label: "No"
					, callback: () => resolve(false)
				}
			}
			, default: "No"
		}).render(true);
	});
	if (!confirmed) return null;

	// Handle Feint cost deduction
	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", useGambit, feintCount);
		if (!success && error) {
			ui.notifications.error(error);
		}
	}

	// Handle Fudge cost deduction (only on the first roll)
	if (useFudge && showFudge) {
		const { success, error } = await spendLuckMove(actor, "fudge", useGambit);
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

// Utility dialogs
function chooseAdvantage() {
	return new Promise(resolve => {
		new Dialog({
			title: "Choose Advantage"
			, content: "<p>Select an advantage value (0–3):</p>"
			, buttons: {
				0: {
					label: "0"
					, callback: () => resolve(0)
				}
				, 1: {
					label: "1"
					, callback: () => resolve(1)
				}
				, 2: {
					label: "2"
					, callback: () => resolve(2)
				}
				, 3: {
					label: "3"
					, callback: () => resolve(3)
				}
			}
			, default: "0"
		}).render(true);
	});
}

async function findRoller(i, reaction = false) {
	if (game.user.isGM) {
		console.warn("BAD6 | reaction:", reaction);
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
		console.warn("BAD6 | Roller chosen:", roller.name);
		// Otherwise use the controlled token
		return new Promise(async (resolve, reject) => {
				// Get linked actors from the actor's bio
				const linkedActors = roller.system.bio.linkedActors?.value || [];
				console.warn("BAD6 | Linked actors:", linkedActors);
				if (linkedActors.length === 0) {
					ui.notifications.warn("No linked abilities found. Defaulting to original roller.");
					return resolve(roller);
				}
				let buttons = {
					[roller.id]: {
						label: roller.name
						, callback: () => resolve(roller)
					}
				};
				// Fetch each linked actor and create a button
				for (let linked of linkedActors) {
					const actor = await fromUuid(linked.uuid);
					if (actor) {
						buttons[linked.uuid] = {
							label: `${linked.name} (${linked.type})`
							, callback: () => resolve(actor)
						};
					}
				}
				new Dialog({
					title: "Choose Roller"
					, content: "<p>Select an ability to use:</p>"
					, buttons
					, default: Object.keys(buttons)[0]
					, close: () => resolve(null)  // Handle X button click
				}).render(true);
		});
	}
	const owned = game.actors.filter(a => a.isOwner);
	if (owned.length === 0) {
		ui.notifications.warn("You don't own any actors. A player may only roll from their owned actors.");
		return null;
	}
	if (owned.length === 1) return owned[0];

	return new Promise(resolve => {
		const buttons = {};
		for (let a of owned) {
			buttons[a.id] = {
				label: a.name
				, callback: () => resolve(a)
			};
		}
		new Dialog({
			title: "Choose an Actor"
			, content: "<p>Select an actor:</p>"
			, buttons
			, default: Object.keys(buttons)[0]
		}).render(true);
	});
}

function requestStat(actor, showLuckOptions = true) {
	return new Promise(resolve => {
		let sources;
		if (actor.system.attributes?.ustats || actor.system.attributes?.sstats) {
			sources = {
				ustats: actor.system.attributes?.ustats || {}
				, sstats: actor.system.attributes?.sstats || {}
			};
		} else if (actor.type === "stand" || actor.type === "power") {
			sources = {
				sstats: actor.system.attributes?.stats || {}
			};
		} else if (actor.type === "user") {
			sources = {
				ustats: actor.system.attributes?.stats || {}
			};
		} else {
			ui.notifications.warn("Unsupported actor format.");
			return resolve(null);
		}


		const resolveLuckActorSync = (baseActor) => {
			if (!baseActor) return null;
			const luck = baseActor.system?.attributes?.stats?.luck;
			const temp = luck?.temp || 0;
			const perm = luck?.perm || 0;
			if (temp > 0 || perm > 0) return baseActor;
			const linkedActors = baseActor.system?.bio?.linkedActors?.value || [];
			for (const linked of linkedActors) {
				let linkedActor = null;
				if (linked.uuid && typeof fromUuidSync === "function") {
					try {
						linkedActor = fromUuidSync(linked.uuid);
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
			return baseActor;
		};

		const luckActor = resolveLuckActorSync(actor) || actor;
		const luck = luckActor.system?.attributes?.stats?.luck;
		const tempLuck = luck?.temp || 0;
		const feintCost = 1;
		const feintState = { count: 0, messageId: null };

		const buildFormHtml = () => {
			const canFeint = (tempLuck - feintState.count) >= feintCost;
			const showClear = feintState.count > 0;

			let content = "";
			if (showLuckOptions) {
				// Build Luck options section
				content += `<div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">`;
				content += `<p><strong>Luck Options</strong></p>`;
				content += `<label style="display: block; margin: 8px 0;">
					<input type="checkbox" id="use-gambit" value="gambit"> 
					<strong>Gambit</strong> - Makes all Luck moves cost 0 (if using Chekhov's Gun or solid plan)
				</label>`;
				content += `<div style="margin: 8px 0; padding: 8px; background: #fff; border-radius: 4px;">
					<p style="margin: 5px 0;"><strong>Feints</strong> (Cost: ${feintCost} Temp Luck each, have: ${tempLuck})</p>
					<div style="display: flex; gap: 8px; align-items: center;">
						<button type="button" id="btn-add-feint" ${!canFeint ? 'disabled' : ''} style="padding: 4px 12px; cursor: ${canFeint ? 'pointer' : 'not-allowed'}; opacity: ${canFeint ? '1' : '0.5'};">+ Feint</button>
						${showClear ? `<button type="button" id="btn-clear-feint" style="padding: 4px 12px; cursor: pointer;">⊗ Clear</button>` : ''}
						<span id="feint-display" style="font-weight: bold; min-width: 60px;">Count: ${feintState.count}</span>
					</div>
				</div></div>`;
			}

			// Build stat selection section
			content += `<p style="margin: 10px 0 5px 0;"><strong>Select a Stat:</strong></p>`;

			// Create form with stat buttons
			const dlgClass = `stat-selector-${Date.now()}`;
			let formHtml = content + `<form class="${dlgClass}">`;
			for (let [btnKey, btn] of Object.entries(buttons)) {
				formHtml += `<button type="button" class="stat-button" data-btn-key="${btnKey}" style="display: block; width: 100%; padding: 8px; margin: 4px 0; text-align: left; cursor: pointer; background: #f0f0f0; border: 1px solid #999; border-radius: 4px;">${escapeHtml(btn.label)}</button>`;
			}
			formHtml += `</form>`;
			return { formHtml, dlgClass };
		};

		const buttons = {};
		for (let [k, stats] of Object.entries(sources)) {
			for (let [key, stat] of Object.entries(stats)) {
				if (stat.dtype === "Number") {
					const name = stat.label || key;
					const label = `${k === "sstats" ? `【${name}】` : name} (${stat.value})`;
					buttons[`${k}-${key}`] = {
						label,
						key,
						statValue: stat.value,
						statName: name
					};
				}
			}
		}
		
		if (!Object.keys(buttons).length) {
			ui.notifications.warn("No numeric stats found.");
			return resolve(null);
		}

		let dialogInstance;
		const bindDialog = (dlgClass) => {
			setTimeout(() => {
				const root = dialogInstance?.element?.[0] || document;
				const form = root.querySelector(`.${dlgClass}`);
				if (!form) {
					return;
				}
				
				const gambitCheckbox = showLuckOptions ? root.querySelector('#use-gambit') : null;
				const addFeintBtn = showLuckOptions ? root.querySelector('#btn-add-feint') : null;
				const clearFeintBtn = showLuckOptions ? root.querySelector('#btn-clear-feint') : null;
				const feintDisplay = showLuckOptions ? root.querySelector('#feint-display') : null;
				if (feintDisplay) feintDisplay.textContent = `Count: ${feintState.count}`;

				const rerenderDialog = () => {
					if (dialogInstance) dialogInstance.close();
					renderDialog();
				};
				
				// Stat button click handlers
				form.querySelectorAll('.stat-button').forEach(btn => {
					btn.addEventListener('click', async () => {
						const btnKey = btn.dataset.btnKey;
						const btnData = buttons[btnKey];
						if (btnData) {
							dialogInstance.close();
							resolve({
								key: btnData.key,
								label: btnData.statName,
								value: btnData.statValue,
								feintCount: feintState.count,
								useGambit: gambitCheckbox?.checked || false
							});
						}
					});
				});
				
				// Feint add button
				if (addFeintBtn) {
					addFeintBtn.addEventListener('click', async () => {
						const usingGambit = gambitCheckbox?.checked || false;
						const effectiveCost = usingGambit ? 0 : 1;
						if (!usingGambit && tempLuck - feintState.count < effectiveCost) {
							ui.notifications.warn("Not enough temp luck for another feint!");
							return;
						}
						feintState.count++;
						
						// Create or update feint message (single message)
						const feintText = feintState.count > 1 ? ` x${feintState.count}` : "";
						const content = `<strong>${actor.name} is feinting!</strong>${feintText}`;
						let msg = feintState.messageId ? game.messages.get(feintState.messageId) : null;
						if (msg) {
							try {
								await msg.update({ content });
							
							} catch (e) {
								
							}
						} else {
							msg = await ChatMessage.create({
								speaker: ChatMessage.getSpeaker({ actor }),
								content,
								whisper: game.users.filter(u => u.isGM).map(u => u.id)
							});
							feintState.messageId = msg.id;
						}
						rerenderDialog();
					});
				}
				
				// Feint clear button
				if (clearFeintBtn) {
					clearFeintBtn.addEventListener('click', async () => {
						if (feintState.count > 0) {
							// Delete feint message
							if (feintState.messageId) {
								try {
									const msg = game.messages.get(feintState.messageId);
									if (msg) await msg.delete();
								} catch (e) { }
							}
							
							// Send cancel message
							const cancelText = feintState.count > 1 ? ` x${feintState.count}` : "";
							const cancelMsg = await ChatMessage.create({
								speaker: ChatMessage.getSpeaker({ actor }),
								content: `<strong>${actor.name}</strong> - Feint${cancelText} Cancelled!`,
								whisper: game.users.filter(u => u.isGM).map(u => u.id)
							});
							
							// Delete cancel message after delay
							setTimeout(() => {
								try { cancelMsg.delete(); } catch (e) { }
							}, 2000);
						}
						feintState.count = 0;
						feintState.messageId = null;
						rerenderDialog();
					});
				}
			}, 50);
		};

		const renderDialog = () => {
			const { formHtml, dlgClass } = buildFormHtml();
			dialogInstance = new Dialog({
				title: "Choose a Stat & Luck Options",
				content: formHtml,
				buttons: {
					cancel: { label: "Cancel", callback: () => resolve(null) }
				},
				default: "cancel"
			}, {
				width: 500,
				classes: ["roller-dialog"]
			});
			dialogInstance.render(true);
			bindDialog(dlgClass);
		};

		renderDialog();
	});
}

async function confirmRoller(actor) {
	const nonGm = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
	const player = nonGm || game.users.find(u => u.isGM);
	if (!player) return false;

	return new Promise(resolve => {
		new Dialog({
			title: "Player Owner Detected"
			, content: "<p>Have the player finish this roll?</p>"
			, buttons: {
				Yes: {
					label: "Yes"
					, callback: () => resolve(true)
				}
				, No: {
					label: "No"
					, callback: () => resolve(false)
				}
			}
		}).render(true);
	});
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

function promptMulligan(actor) {
	return new Promise(resolve => {
		new Dialog({
			title: "Mulligan",
			content: `<p>Use <strong>Mulligan</strong> to add +1 Advantage to the last two rolls?</p>`,
			buttons: {
				Yes: { label: "Yes", callback: () => resolve(true) },
				No: { label: "No", callback: () => resolve(false) }
			},
			default: "No"
		}).render(true);
	});
}

function promptPersist(actor) {
	return new Promise(resolve => {
		new Dialog({
			title: "Persist",
			content: `<p>Use <strong>Persist</strong> to redo the last two rolls?</p><p style="color:#c00;"><strong>Costs PERMANENT Luck</strong></p>`,
			buttons: {
				Yes: { label: "Yes", callback: () => resolve(true) },
				No: { label: "No", callback: () => resolve(false) }
			},
			default: "No"
		}).render(true);
	});
}

// Helper to find a non-GM owner or fallback to GM
function findOwner(actor) {
	return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ||
		game.users.find(u => u.isGM);
}

const SYSTEM_ID = "bizarre-adventures-d6";
const CONTEST_FLAG = "contest";

function createEmptyRollState() {
	return {
		resolved: false,
		actorUuid: null,
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
		pendingFudgeNextRoll: false,
		rolls: {
			1: createEmptyRollState(),
			2: createEmptyRollState()
		},
		total: null,
		mulliganNote: null
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
	const label = getQuadrantLabel(side, rollIndex);
	const button = isNext && !rollData?.resolved
		? `<button type="button" class="bad6-roll-btn" data-quadrant="${quadrant}" style="margin-top:6px;">${getQuadrantButtonLabel(side, rollIndex)}</button>`
		: "";
	const content = rollData?.resolved ? formatRollSummary(rollData) : (isNext ? "" : "<em>Pending</em>");
	return `
		<div style="padding:6px;">
			<div style="font-weight:bold; margin-bottom:4px;">${label}</div>
			<div style="display:flex; flex-direction:column; gap:2px;">${content}${button}</div>
		</div>
	`;
}

function buildContestHtml(state) {
	const actionRow = `
		<div style="border-bottom:2px solid #555; padding-bottom:4px;">
			${renderQuadrantCell("action", 1, state.action.rolls[1], state.nextStep)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("action", 2, state.action.rolls[2], state.nextStep)}
		</div>
	`;
	const reactionRow = state.hasReaction
		? `
		<div style="border-top:2px solid #555; margin-top:6px; padding-top:4px;">
			${renderQuadrantCell("reaction", 1, state.reaction.rolls[1], state.nextStep)}
			<div style="border-top:1px solid #999;"></div>
			${renderQuadrantCell("reaction", 2, state.reaction.rolls[2], state.nextStep)}
		</div>
		`
		: "";
	const resultHtml = state.result
		? `<div style="margin-top:8px; padding-top:6px; border-top:1px solid #999;"><strong>Result:</strong> ${state.result.label}</div>`
		: "";
	return `
		<div class="bad6-contest" style="border:1px solid #777; padding:6px; background:#f8f8f8;">
			${actionRow}
			${reactionRow}
			${resultHtml}
		</div>
	`;
}

async function updateContestMessage(message, state) {
	await message.setFlag(SYSTEM_ID, CONTEST_FLAG, state);
	await message.update({ content: buildContestHtml(state) });
}

function parseQuadrant(quadrant) {
	const [side, idx] = String(quadrant || "").split("-");
	const rollIndex = Number(idx || 0);
	if (!side || !["action", "reaction"].includes(side) || ![1, 2].includes(rollIndex)) return null;
	return { side, rollIndex };
}

async function handlePostRollLuck(pair, actor) {
	const roll1 = pair.rolls[1];
	const roll2 = pair.rolls[2];
	const snaps = [roll1?.snapshot, roll2?.snapshot];
	if (!snaps[0] || !snaps[1] || !actor) return { resetPair: false };
	const advValue = Number(pair.advantage || 0);
	const mulliganCheck = canUseLuckMove(actor, "mulligan", false);
	if (advValue <= 2 && mulliganCheck.canUse) {
		const doMulligan = await promptMulligan(actor);
		if (doMulligan) {
			const spend = await spendLuckMove(actor, "mulligan", false);
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

	const persistCheck = canUseLuckMove(actor, "persist", false);
	if (persistCheck.canUse) {
		const doPersist = await promptPersist(actor);
		if (doPersist) {
			const spend = await spendLuckMove(actor, "persist", false);
			if (!spend.success && spend.error) ui.notifications.error(spend.error);
			return { resetPair: true };
		}
	}
	return { resetPair: false };
}

async function rollOneStep(side, rollIndex, state) {
	const pair = state[side];
	let advantage = pair.advantage;
	if (advantage === null || advantage === undefined) {
		advantage = await chooseAdvantage();
		pair.advantage = advantage;
	}
	const actor = await findRoller(0, side === "reaction");
	if (!actor) return null;

	const showLuckOptions = rollIndex === 1;
	const stat = await requestStat(actor, showLuckOptions);
	if (!stat) {
		ui.notifications.warn("Stat selection cancelled.");
		return null;
	}

	const feintCount = stat.feintCount || 0;
	const useGambit = stat.useGambit || false;
	const useFudgeCarry = !showLuckOptions && pair.pendingFudgeNextRoll;
	const hasOwner = Object.entries(actor.ownership || {})
		.some(([uid, lvl]) => {
			const u = game.users.get(uid);
			return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
		});

	if (game.user.isGM && hasOwner && await confirmRoller(actor)) {
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
			useFudgeCarry,
			useGambit,
			showLuckOptions,
			true
		);
		if (!rollResult) return null;
		const useFudge = !!rollResult.useFudge;
		if (showLuckOptions && useFudge) {
			pair.pendingFudgeNextRoll = true;
		} else if (useFudgeCarry) {
			pair.pendingFudgeNextRoll = false;
		}
		return {
			actorUuid: actor.uuid,
			actorName: actor.name,
			statKey: stat.key,
			statLabel: stat.label,
			formula: rollResult.snapshot?.formula || null,
			diceResults: rollResult.snapshot?.diceResults || null,
			total: rollResult.total,
			advantage,
			effectiveAdvantage: rollResult.effectiveAdvantage ?? advantage,
			useFudge,
			useGambit,
			feintCount,
			snapshot: rollResult.snapshot
		};
	}

	const baseFormula = `(${stat.value}d6cs>=5)`;
	const data = actor.getRollData();
	let useFudge = useFudgeCarry;
	const formulaResult = await prepareFormula(actor, baseFormula, stat.key, stat.label, advantage, data, useFudge, useGambit, showLuckOptions);
	if (formulaResult === null) return null;
	const finalFormula = formulaResult?.formula ?? formulaResult;
	useFudge = !!formulaResult?.useFudge;
	if (showLuckOptions && useFudge) {
		pair.pendingFudgeNextRoll = true;
	} else if (useFudgeCarry) {
		pair.pendingFudgeNextRoll = false;
	}
	const roll = new Roll(finalFormula, data);
	await roll.evaluate({ async: true });

	if (feintCount > 0) {
		const { success, error } = await spendLuckMove(actor, "feint", useGambit, feintCount);
		if (!success && error) ui.notifications.error(error);
	}

	if (useFudge && showLuckOptions) {
		const { success, error } = await spendLuckMove(actor, "fudge", useGambit);
		if (!success && error) ui.notifications.error(error);
	}

	const effectiveAdvantage = Number(advantage || 0) + (useFudge ? 1 : 0);
	await playDiceAnimation(roll);
	const snapshot = buildRollSnapshot(roll, finalFormula, effectiveAdvantage);
	return {
		actorUuid: actor.uuid,
		actorName: actor.name,
		statKey: stat.key,
		statLabel: stat.label,
		formula: finalFormula,
		diceResults: snapshot.diceResults,
		total: roll.total,
		advantage,
		effectiveAdvantage,
		useFudge,
		useGambit,
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
	pair.total = computePairTotal(pair);
}

function resetPairState(pair) {
	pair.advantage = null;
	pair.pendingFudgeNextRoll = false;
	pair.rolls[1] = createEmptyRollState();
	pair.rolls[2] = createEmptyRollState();
	pair.total = null;
	pair.mulliganNote = null;
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
		if (!state || state.nextStep !== quadrant) return;
		const { side, rollIndex } = parsed;
		const rollData = await rollOneStep(side, rollIndex, state);
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
			const { resetPair } = await handlePostRollLuck(pair, actor);
			if (resetPair) {
				resetPairState(pair);
				currentState.nextStep = `${side}-1`;
				await updateContestMessage(refreshed, currentState);
				return;
			}
		}

	if (side === "action" && rollIndex === 1) {
		currentState.nextStep = "action-2";
	} else if (side === "action" && rollIndex === 2) {
		currentState.nextStep = currentState.hasReaction ? "reaction-1" : null;
	} else if (side === "reaction" && rollIndex === 1) {
		currentState.nextStep = "reaction-2";
	} else if (side === "reaction" && rollIndex === 2) {
		currentState.nextStep = null;
	}

	updateResultState(currentState);
	await updateContestMessage(refreshed, currentState);
	if (currentState.result?.type === "clash") {
		const speakerActorUuid = currentState.action.rolls[1]?.actorUuid || currentState.reaction.rolls[1]?.actorUuid;
		const speakerActor = speakerActorUuid ? await fromUuid(speakerActorUuid) : null;
		ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: speakerActor || undefined }),
			content: "<strong>Clash!</strong> A new contest begins."
		});
	}
	});
});


// Entrypoint
async function main() {
	let hasReaction = false;
	const targetCount = game.user.targets.size;
	if (targetCount > 0) {
			hasReaction = true;
		}
	if (game.user.isGM) {
		if (canvas.tokens.controlled.length < 1) {
			ui.notifications.warn("Select at least one token to start an Action roll.");
			return;
		}
		if (canvas.tokens.controlled.length > 1) {
			hasReaction = true;
		}
	}
	const state = createContestState(hasReaction);
	state.nextStep = "action-1";
	const rollData = await rollOneStep("action", 1, state);
	if (!rollData) return;
	applyRollToState(state, "action", 1, rollData);
	state.nextStep = "action-2";
	updateResultState(state);

	const speakerActor = rollData.actorUuid ? await fromUuid(rollData.actorUuid) : null;
	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: speakerActor || undefined }),
		content: buildContestHtml(state),
		flags: {
			[SYSTEM_ID]: {
				[CONTEST_FLAG]: state
			}
		}
	});
}
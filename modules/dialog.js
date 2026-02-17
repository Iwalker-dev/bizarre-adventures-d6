import { canUseFudge } from "./luck-moves.js";

/**
 * Dialog utilities for BAD6 rolling, stat selection, and formula configuration.
 */


/**
 * Escape HTML entities for safe insertion into dialog content.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
	if (str === undefined || str === null) return "";
	return String(str).replace(/[&<>"']/g, s => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		"\"": "&quot;",
		"'": "&#39;"
	})[s]);
}

/**
 * Get a display-safe actor name, allowing anonymizing modules to intercept.
 * @param {Actor} actor
 * @param {TokenDocument|Token} [token]
 * @returns {string}
 */
export function getActorDisplayName(actor, token = null) {
	if (!actor) return "Unknown";
	const speaker = ChatMessage.getSpeaker({ actor, token: token || undefined });
	return speaker?.alias || actor.name || "Unknown";
}


/**
 * Show a generic choice dialog.
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.content]
 * @param {Record<string, {label?: string, callback?: Function}>} [options.buttons]
 * @param {string|null} [options.defaultId]
 * @param {string[]} [options.classes]
 * @param {number} [options.width]
 * @param {*} [options.closeValue]
 * @returns {Promise<*>}
 */
export function showChoiceDialog({
	title = "",
	content = "",
	buttons = {},
	defaultId = null,
	classes = [],
	width = undefined,
	closeValue = undefined
} = {}) {
	return new Promise(resolve => {
		let resolved = false;
		const resolveOnce = (value) => {
			if (resolved) return;
			resolved = true;
			resolve(value);
		};

		const wrappedButtons = {};
		for (const [id, btn] of Object.entries(buttons)) {
			wrappedButtons[id] = {
				label: btn?.label || id,
				callback: (html) => {
					try {
						const result = btn?.callback ? btn.callback(html) : id;
						resolveOnce(result);
					} catch (e) {
						resolveOnce(id);
					}
				}
			};
		}

		const dlg = new Dialog({
			title,
			content,
			buttons: wrappedButtons,
			default: defaultId || undefined,
			close: () => {
				if (closeValue !== undefined) resolveOnce(closeValue);
			}
		}, {
			classes,
			width
		});
		dlg.render(true);
	});
}


/**
 * Confirm a roll before execution.
 * @param {Object} options
 * @param {string} options.statLabel
 * @param {string} [options.advantagePhrase]
 * @param {string} [options.formula]
 * @returns {Promise<boolean>}
 */
export function showRollReadyDialog({ statLabel, advantagePhrase = "", formula = "" } = {}) {
	const content = `<p>Roll <strong>${escapeHtml(statLabel)}</strong>${advantagePhrase}? <code>${escapeHtml(formula)}</code></p>`;
	return showChoiceDialog({
		title: "A Roll is Ready",
		content,
		buttons: {
			Yes: { label: "Yes", callback: () => true },
			No: { label: "No", callback: () => false }
		},
		defaultId: "No"
	});
}


/**
 * Ask GM whether a player owner should complete the roll.
 * @returns {Promise<boolean>}
 */
export function showConfirmRollerDialog() {
	return showChoiceDialog({
		title: "Player Owner Detected",
		content: "<p>Have the player finish this roll?</p>",
		buttons: {
			Yes: { label: "Yes", callback: () => true },
			No: { label: "No", callback: () => false }
		},
		defaultId: "No"
	});
}

/**
 * Prompt for Mulligan usage.
 * @param {Object} options
 * @param {boolean} [options.gambitDefault]
 * @returns {Promise<{confirmed:boolean,useGambit:boolean}>}
 */
export function showMulliganDialog({ gambitDefault = false } = {}) {
	const content = `
		<p>Use <strong>Mulligan</strong> to add +1 Advantage to the last two rolls?</p>
		<label style="display:block; margin-top:8px;">
			<input type="checkbox" id="use-gambit-mulligan" ${gambitDefault ? "checked" : ""}>
			<strong>Gambit</strong> — Nullify Mulligan cost
		</label>
	`;
	return showChoiceDialog({
		title: "Mulligan",
		content,
		buttons: {
			Yes: {
				label: "Yes",
				callback: (html) => ({
					confirmed: true,
					useGambit: !!html.find("#use-gambit-mulligan").prop("checked")
				})
			},
			No: {
				label: "No",
				callback: (html) => ({
					confirmed: false,
					useGambit: !!html.find("#use-gambit-mulligan").prop("checked")
				})
			}
		},
		defaultId: "No",
		closeValue: { confirmed: false, useGambit: !!gambitDefault }
	});
}


/**
 * Prompt for Persist usage.
 * @param {Object} options
 * @param {boolean} [options.gambitDefault]
 * @param {Function|null} [options.lockCheck]
 * @param {string} [options.lockReason]
 * @param {number} [options.autoCloseMs]
 * @returns {Promise<{confirmed:boolean,useGambit:boolean}>}
 */
export function showPersistDialog({
	gambitDefault = false,
	lockCheck = null,
	lockReason = "",
	autoCloseMs = 5000
} = {}) {
	return new Promise(resolve => {
		let resolved = false;
		let lockInterval = null;
		let autoCloseTimer = null;
		const resolveOnce = (value) => {
			if (resolved) return;
			resolved = true;
			if (lockInterval) clearInterval(lockInterval);
			if (autoCloseTimer) clearTimeout(autoCloseTimer);
			resolve(value);
		};

		const content = `
			<p>Use <strong>Persist</strong> to redo the last two rolls?</p>
			<p style="color:#c00;"><strong>Costs PERMANENT Luck</strong></p>
			<label style="display:block; margin-top:8px;">
				<input type="checkbox" id="use-gambit-persist" ${gambitDefault ? "checked" : ""}>
				<strong>Gambit</strong> — Nullify Persist cost
			</label>
			<div id="persist-lock-reason" style="margin-top:6px; color:#b00; font-size:0.9em;">${escapeHtml(lockReason || "")}</div>
		`;

		const dlg = new Dialog({
			title: "Persist",
			content,
			buttons: {
				yes: {
					label: "Yes",
					callback: (html) => resolveOnce({
						confirmed: true,
						useGambit: !!html.find("#use-gambit-persist").prop("checked")
					})
				},
				no: {
					label: "No",
					callback: (html) => resolveOnce({
						confirmed: false,
						useGambit: !!html.find("#use-gambit-persist").prop("checked")
					})
				}
			},
			default: "no",
			close: () => resolveOnce({ confirmed: false, useGambit: false })
		}, {
			width: 420
		});

		dlg.render(true);

		const applyLock = (reason) => {
			const root = dlg?.element;
			if (!root?.length) return;
			const yesBtn = root.find('button[data-button="yes"]');
			const reasonEl = root.find("#persist-lock-reason");
			if (yesBtn.length) yesBtn.prop("disabled", true).css("opacity", 0.6);
			if (reasonEl.length) reasonEl.text(reason || "Persist already chosen by another reactor.");
			if (!autoCloseTimer) {
				autoCloseTimer = setTimeout(() => {
					try { dlg.close(); } catch (e) { }
				}, autoCloseMs);
			}
		};

		if (lockReason) applyLock(lockReason);
		if (typeof lockCheck === "function") {
			lockInterval = setInterval(() => {
				const lockState = lockCheck();
				if (lockState?.locked) applyLock(lockState.reason);
			}, 250);
		}
	});
}

/**
 * Show stat selection dialog with Luck options.
 * @param {Actor} actor
 * @param {Object} [options]
 * @param {boolean} [options.showLuckOptions]
 * @param {boolean} [options.allowFeint]
 * @param {boolean} [options.allowGambit]
 * @param {string} [options.lockMessage]
 * @param {Function|null} [options.canProceed]
 * @param {boolean} [options.advantageLocked]
 * @param {number} [options.advantageValue]
 * @param {string} [options.advantageChosenBy]
 * @param {string} [options.advantageLockReason]
 * @param {Object} [options.gambitDefaults]
 * @returns {Promise<{key:string,label:string,value:number,advantage:number,feintCount:number,luckActorUuid:string|null,gambitSelections:{feint:boolean}}|null>}
 */
export async function showStatDialog(actor, options = {}) {
	const {
		showLuckOptions = true,
		allowFeint = true,
		allowGambit = true,
		lockMessage = "The previous roll must be completed first.",
		canProceed = null,
		advantageLocked = false,
		advantageValue = 0,
		advantageChosenBy = "",
		advantageLockReason = "",
		gambitDefaults = {}
	} = options || {};

	let sources;
	if (actor.system.attributes?.ustats || actor.system.attributes?.sstats) {
		sources = {
			ustats: actor.system.attributes?.ustats || {},
			sstats: actor.system.attributes?.sstats || {}
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
		return null;
	}

	/**
	 * Resolve a linked actor by UUID without async calls.
	 * @param {{uuid?: string}} linked
	 * @returns {Actor|null}
	 */
	const resolveLinkedActorSync = (linked) => {
		const uuid = linked?.uuid;
		if (!uuid || typeof uuid !== "string") return null;
		if (uuid.startsWith("Actor.")) {
			const parts = uuid.split(".");
			const actorId = parts[1];
			return game.actors?.get(actorId) || null;
		}
		return null;
	};

	const resolveLuckActorSync = (baseActor) => {
		if (!baseActor) return null;
		if (baseActor.type === "user" && hasLuckStat(baseActor)) return baseActor;
		const linkedActors = baseActor.system?.bio?.linkedActors?.value || [];
		for (const linked of linkedActors) {
			const linkedActor = resolveLinkedActorSync(linked);
			if (linkedActor && linkedActor.type === "user" && hasLuckStat(linkedActor)) {
				return linkedActor;
			}
		}
		return hasLuckStat(baseActor) ? baseActor : null;
	};

	const hasLuckStat = (candidate) => !!candidate?.system?.attributes?.stats?.luck;

	const getLuckCandidates = async (baseActor) => {
		const candidates = [];
		const seen = new Set();
		const addCandidate = (candidate) => {
			if (!candidate || !candidate.uuid || seen.has(candidate.uuid)) return;
			if (!hasLuckStat(candidate)) return;
			seen.add(candidate.uuid);
			candidates.push(candidate);
		};
		addCandidate(baseActor);
		const linkedActors = baseActor.system?.bio?.linkedActors?.value || [];
		for (const linked of linkedActors) {
			let linkedActor = resolveLinkedActorSync(linked);
			if (!linkedActor && linked?.uuid) {
				try {
					linkedActor = await fromUuid(linked.uuid);
				} catch (e) {
					linkedActor = null;
				}
			}
			addCandidate(linkedActor);
		}
		return candidates;
	};

	let selectedLuckActor = null;
	const luckCandidates = await getLuckCandidates(actor);
	if (luckCandidates.length > 1) {
		const buttons = {};
		for (const cand of luckCandidates) {
			const luck = cand.system?.attributes?.stats?.luck;
			const temp = luck?.temp ?? 0;
			const perm = luck?.perm ?? 0;
			const displayName = getActorDisplayName(cand);
			buttons[cand.uuid] = {
				label: `${displayName} (${cand.type}) — Luck: ${temp}T / ${perm}P`,
				callback: () => cand
			};
		}
		selectedLuckActor = await showChoiceDialog({
			title: "Choose Luck Spender",
			content: "<p>Select the actor whose Luck will be spent:</p>",
			buttons,
			defaultId: luckCandidates[0]?.uuid,
			closeValue: null
		});
	}
	if (!selectedLuckActor) {
		selectedLuckActor = luckCandidates[0] || resolveLuckActorSync(actor) || actor;
	}

	return new Promise(resolve => {
		const luckActor = selectedLuckActor || actor;
		const luckActorUuid = luckActor?.uuid || null;
		const luck = luckActor.system?.attributes?.stats?.luck;
		const tempLuck = luck?.temp || 0;
		const feintCost = 1;
		const feintState = { count: 0, messageId: null };
		const gambitState = {
			feint: !!gambitDefaults?.feint
		};
		const selectedAdv = advantageLocked
			? (Number.isFinite(Number(advantageValue)) ? Number(advantageValue) : 0)
			: null;

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
		let statResolved = false;
		let resolved = false;
		let isRerendering = false;

		const resolveOnce = (value) => {
			if (resolved) return;
			resolved = true;
			resolve(value);
		};

		/**
		 * Cancel any pending feints and clean up their chat messages.
		 * @returns {Promise<void>}
		 */
		const cancelFeints = async () => {
			if (feintState.count > 0) {
				if (feintState.messageId) {
					try {
						const msg = game.messages.get(feintState.messageId);
						if (msg) await msg.delete();
					} catch (e) { }
				}
				const cancelText = feintState.count > 1 ? ` x${feintState.count}` : "";
				const displayName = getActorDisplayName(actor);
				const cancelMsg = await ChatMessage.create({
					speaker: ChatMessage.getSpeaker({ actor }),
					content: `<strong>${escapeHtml(displayName)}</strong> - Feint${cancelText} Cancelled!`,
					whisper: game.users.filter(u => u.isGM).map(u => u.id)
				});
				setTimeout(() => {
					try { cancelMsg.delete(); } catch (e) { }
				}, 2000);
			}
			feintState.count = 0;
			feintState.messageId = null;
		};

		/**
		 * Build dialog HTML for stat selection and Luck options.
		 * @returns {{formHtml: string, dlgClass: string}}
		 */
		const buildFormHtml = () => {
			const canFeint = allowFeint && (gambitState.feint || (tempLuck - feintState.count) >= feintCost);
			const showClear = feintState.count > 0;

			let content = "";

			content += `<div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">`;
			content += `<p><strong>Advantage</strong></p>`;
			if (advantageLocked) {
				content += `<div style="color:#b00; font-size:0.9em; margin-bottom:6px;">Advantage chosen by ${escapeHtml(advantageChosenBy || "Unknown")}</div>`;
			}
			if (advantageLockReason) {
				content += `<div style="color:#b00; font-size:0.9em; margin-bottom:6px;">${escapeHtml(advantageLockReason)}</div>`;
			}
			content += `<div style="display:flex; gap:12px; flex-wrap:wrap;">`;
			for (let i = 0; i <= 3; i++) {
				const checked = selectedAdv === i ? "checked" : "";
				content += `
					<label style="display:flex; gap:6px; align-items:center;">
						<input type="radio" name="advantage" value="${i}" ${checked} ${advantageLocked ? "disabled" : ""}>
						${i}
					</label>`;
			}
			content += `</div></div>`;

			if (showLuckOptions && (allowFeint || allowGambit)) {
				content += `<div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">`;
				content += `<p><strong>Luck Options</strong></p>`;
				content += `<div style="margin: 8px 0; padding: 8px; background: #fff; border-radius: 4px;">
					<p style="margin: 5px 0;"><strong>Feints</strong> (Cost: ${feintCost} Temp Luck each, have: ${tempLuck})</p>
					${allowGambit ? `<label style="display:block; margin: 6px 0;">
						<input type="checkbox" id="use-gambit-feint" ${gambitState.feint ? "checked" : ""}>
						<strong>Gambit</strong> — Nullify Feint cost
					</label>` : ""}
					<div style="display: flex; gap: 8px; align-items: center;">
						<button type="button" id="btn-add-feint" ${!canFeint ? "disabled" : ""} style="padding: 4px 12px; cursor: ${canFeint ? "pointer" : "not-allowed"}; opacity: ${canFeint ? "1" : "0.5"};">+ Feint</button>
						${showClear ? `<button type="button" id="btn-clear-feint" style="padding: 4px 12px; cursor: pointer;">⊗ Clear</button>` : ""}
						<span id="feint-display" style="font-weight: bold; min-width: 60px;">Count: ${feintState.count}</span>
					</div>
					${allowFeint ? "" : ``}
				</div></div>`;
			}

			content += `<p style="margin: 10px 0 5px 0;"><strong>Select a Stat:</strong></p>`;

			const dlgClass = `stat-selector-${Date.now()}`;
			let formHtml = content + `<form class="${dlgClass}">`;
			for (let [btnKey, btn] of Object.entries(buttons)) {
				formHtml += `<button type="button" class="stat-button" data-btn-key="${btnKey}" style="display: block; width: 100%; padding: 8px; margin: 4px 0; text-align: left; cursor: pointer; background: #f0f0f0; border: 1px solid #999; border-radius: 4px;">${escapeHtml(btn.label)}</button>`;
			}
			formHtml += `</form>`;
			return { formHtml, dlgClass };
		};

		/**
		 * Bind dialog events after render.
		 * @param {string} dlgClass
		 * @returns {void}
		 */
		const bindDialog = (dlgClass) => {
			setTimeout(() => {
				const root = dialogInstance?.element?.[0] || document;
				const form = root.querySelector(`.${dlgClass}`);
				if (!form) return;

				const feintGambitCheckbox = (showLuckOptions && allowGambit) ? root.querySelector("#use-gambit-feint") : null;
				const addFeintBtn = showLuckOptions ? root.querySelector("#btn-add-feint") : null;
				const clearFeintBtn = showLuckOptions ? root.querySelector("#btn-clear-feint") : null;
				const feintDisplay = showLuckOptions ? root.querySelector("#feint-display") : null;
				if (feintDisplay) feintDisplay.textContent = `Count: ${feintState.count}`;

				const getAdvantageValue = () => {
					const selected = root.querySelector('input[name="advantage"]:checked');
					return selected ? Number(selected.value) : null;
				};

				const rerenderDialog = () => {
					isRerendering = true;
					if (dialogInstance) dialogInstance.close();
					isRerendering = false;
					renderDialog();
				};

				if (feintGambitCheckbox) {
					feintGambitCheckbox.addEventListener("change", () => {
						gambitState.feint = !!feintGambitCheckbox.checked;
						rerenderDialog();
					});
				}

				form.querySelectorAll(".stat-button").forEach(btn => {
					btn.addEventListener("click", async () => {
						const btnKey = btn.dataset.btnKey;
						const btnData = buttons[btnKey];
						if (btnData) {
							if (typeof canProceed === "function" && !canProceed()) {
								ui.notifications.warn(lockMessage);
								return;
							}
							const advValue = advantageLocked ? selectedAdv : getAdvantageValue();
							if (!advantageLocked && (advValue === null || Number.isNaN(advValue))) {
								ui.notifications.warn("Select an Advantage level before rolling.");
								return;
							}
							statResolved = true;
							dialogInstance.close();
							resolveOnce({
								key: btnData.key,
								label: btnData.statName,
								value: btnData.statValue,
								advantage: advValue,
								feintCount: feintState.count,
								luckActorUuid,
								gambitSelections: {
									feint: !!(feintGambitCheckbox?.checked ?? gambitState.feint)
								}
							});
						}
					});
				});

				if (addFeintBtn) {
					addFeintBtn.addEventListener("click", async () => {
						const usingGambit = feintGambitCheckbox?.checked || false;
						const effectiveCost = usingGambit ? 0 : feintCost;
						if (!usingGambit && tempLuck - feintState.count < effectiveCost) {
							ui.notifications.warn("Not enough temp luck for another feint!");
							return;
						}
						feintState.count++;

						const feintText = feintState.count > 1 ? ` x${feintState.count}` : "";
						const displayName = getActorDisplayName(actor);
						const content = `<strong>${escapeHtml(displayName)} is feinting!</strong>${feintText}`;
						let msg = feintState.messageId ? game.messages.get(feintState.messageId) : null;
						if (msg) {
							try { await msg.update({ content }); } catch (e) { }
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

				if (clearFeintBtn) {
					clearFeintBtn.addEventListener("click", async () => {
						await cancelFeints();
						rerenderDialog();
					});
				}
			}, 50);
		};

		/**
		 * Render the stat selection dialog.
		 * @returns {void}
		 */
		const renderDialog = () => {
			const { formHtml, dlgClass } = buildFormHtml();
			dialogInstance = new Dialog({
				title: "Choose a Stat & Luck Options",
				content: formHtml,
				buttons: {
					cancel: { label: "Cancel", callback: () => resolveOnce(null) }
				},
				default: "cancel",
				close: async () => {
					if (isRerendering) return;
					if (!statResolved) {
						resolveOnce(null);
						await cancelFeints();
					}
				}
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

/**
 * Show a dialog for optional formula lines and Fudge selection.
 * @param {Object} options
 * @param {Array} [options.required]
 * @param {Array} [options.optionalLines]
 * @param {boolean} [options.showFudge]
 * @param {boolean} [options.useFudgeSelected]
 * @param {boolean} [options.hasFudgeLock]
 * @param {string} [options.fudgeLockReason]
 * @param {Actor} options.actor
 * @param {boolean} [options.gambitDefault]
 * @param {Function} [options.computeAdvantageFromLines]
 * @returns {Promise<{chosenOptionalIndices:number[], useFudgeSelected:boolean, useGambitSelected:boolean}|null>}
 */
export function showOptionalFormulaDialog({
	required = [],
	optionalLines = [],
	showFudge = true,
	useFudgeSelected = false,
	hasFudgeLock = false,
	fudgeLockReason = "",
	actor,
	gambitDefault = false,
	computeAdvantageFromLines
} = {}) {
	return new Promise(resolve => {
		const dlgClass = `optional-lines-${Date.now()}`;
		let html = `<form class="${dlgClass}">`;
		let useGambitSelected = !!gambitDefault;

		if (showFudge) {
			const initialPreviewAdv = computeAdvantageFromLines
				? computeAdvantageFromLines([...required, ...optionalLines])
				: 0;
			const fudgeCheck = hasFudgeLock
				? { canUse: false, reason: fudgeLockReason }
				: canUseFudge(actor, initialPreviewAdv, useGambitSelected);
			const fudgeCost = useGambitSelected ? 0 : 2;
			const fudgeDisabled = !fudgeCheck.canUse ? "disabled" : "";
			const fudgeOpacity = fudgeCheck.canUse ? "1" : "0.6";
			const fudgeReason = hasFudgeLock ? (fudgeLockReason || "") : (fudgeCheck.reason || "");
			html += `
				<div style="margin-bottom:8px; padding:8px; background:#f5f5f5; border-radius:4px;">
					<label id="fudge-label" style="display:block; opacity:${fudgeOpacity};">
						<input type="checkbox" id="use-fudge" class="fudge-checkbox" ${useFudgeSelected ? "checked" : ""} ${fudgeDisabled}>
						<strong>Fudge</strong> (+1 Advantage) — Cost: ${fudgeCost} Temp
						<span class="fudge-reason" style="color:#b00; font-size:0.9em;">${escapeHtml(fudgeReason)}</span>
					</label>
					<label style="display:block; margin-top:6px;">
						<input type="checkbox" id="use-gambit-fudge" ${useGambitSelected ? "checked" : ""}>
						<strong>Gambit</strong> — Nullify Fudge cost
					</label>
				</div>
			`;
		}

		if (optionalLines.length) {
			html += `<p>Select optional formula lines to include:</p><div style="max-height:320px;overflow:auto;">`;
			optionalLines.forEach((opt, i) => {
				const op = (opt.line?.operand || "+").toString();
				const varOrVal = opt.line?.variable ? `${opt.line.variable}` : (opt.line?.value !== undefined ? `${opt.line.value}` : "");
				const label = `${opt.actorName || "Actor"} - ${opt.itemName || "Item"}: ${op} ${varOrVal}`;
				html += `<div><label><input type="checkbox" class="opt-checkbox" data-idx="${i}" checked> ${escapeHtml(label)}</label></div>`;
			});
			html += `</div>`;
		}
		html += `</form>`;

		const dialogInstance = new Dialog({
			title: "Optional Formula Lines",
			content: html,
			buttons: {
				include: {
					label: "Include Selected",
					callback: () => {
						const form = document.querySelector(`.${dlgClass}`);
						const checked = [];
						if (form) {
							form.querySelectorAll(".opt-checkbox").forEach(el => {
								if (el.checked) checked.push(Number(el.dataset.idx));
							});
							if (showFudge) {
								const fudgeBox = form.querySelector("#use-fudge");
								const gambitBox = form.querySelector("#use-gambit-fudge");
								if (hasFudgeLock) {
									if (fudgeBox) {
										fudgeBox.checked = false;
										fudgeBox.disabled = true;
									}
									if (gambitBox) {
										gambitBox.checked = false;
									}
									useFudgeSelected = false;
									useGambitSelected = false;
								} else {
									useFudgeSelected = !!(fudgeBox && fudgeBox.checked && !fudgeBox.disabled);
									useGambitSelected = !!(gambitBox && gambitBox.checked);
								}
							} else {
								useFudgeSelected = false;
								useGambitSelected = false;
							}
						}
						resolve({ chosenOptionalIndices: checked, useFudgeSelected, useGambitSelected });
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "include"
		});

		dialogInstance.render(true);

		setTimeout(() => {
			const form = document.querySelector(`.${dlgClass}`);
			if (!form || !showFudge) return;

			const updateFudgeState = () => {
				if (hasFudgeLock) {
					const fudgeBox = form.querySelector("#use-fudge");
					const fudgeReasonEl = form.querySelector(".fudge-reason");
					const fudgeLabelEl = form.querySelector("#fudge-label");
					const gambitBox = form.querySelector("#use-gambit-fudge");
					if (fudgeBox) {
						fudgeBox.disabled = true;
						fudgeBox.checked = false;
					}
					if (gambitBox) {
						gambitBox.disabled = true;
						gambitBox.checked = false;
					}
					if (fudgeReasonEl) fudgeReasonEl.textContent = fudgeLockReason || "";
					if (fudgeLabelEl) fudgeLabelEl.style.opacity = "0.6";
					return;
				}

				const checkedIndices = [];
				form.querySelectorAll(".opt-checkbox").forEach(el => {
					if (el.checked) checkedIndices.push(Number(el.dataset.idx));
				});

				const currentLines = [
					...required,
					...optionalLines.filter((_, i) => checkedIndices.includes(i))
				];
				const previewAdv = computeAdvantageFromLines ? computeAdvantageFromLines(currentLines) : 0;
				const gambitBox = form.querySelector("#use-gambit-fudge");
				const gambitActive = !!(gambitBox && gambitBox.checked);
				const fudgeCheckNow = canUseFudge(actor, previewAdv, gambitActive);

				const fudgeBox = form.querySelector("#use-fudge");
				const fudgeReasonEl = form.querySelector(".fudge-reason");
				const fudgeLabelEl = form.querySelector("#fudge-label");
				if (fudgeBox) {
					fudgeBox.disabled = !fudgeCheckNow.canUse;
					if (!fudgeCheckNow.canUse) fudgeBox.checked = false;
				}
				if (fudgeReasonEl) fudgeReasonEl.textContent = fudgeCheckNow.reason || "";
				if (fudgeLabelEl) fudgeLabelEl.style.opacity = fudgeCheckNow.canUse ? "1" : "0.6";
			};

			form.querySelectorAll(".opt-checkbox").forEach(el => {
				el.addEventListener("change", updateFudgeState);
			});
			const gambitBox = form.querySelector("#use-gambit-fudge");
			if (gambitBox) gambitBox.addEventListener("change", updateFudgeState);

			updateFudgeState();
		}, 50);
	});
}

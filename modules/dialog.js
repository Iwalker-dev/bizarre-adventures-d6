import { canUseFudge } from "./luck-moves.js";
import { DIALOG_MESSAGES } from "./apps/roller/constants.js";

export const ROLLER_DIALOG_CLASS = "bad6-roller-dialog";
export const ROLLER_DIALOG_IDS = {
	ROLL_READY: "roll-ready",
	CONFIRM_ROLLER: "confirm-roller",
	MULLIGAN: "mulligan",
	FEINT_GAMBIT: "feint-gambit",
	PERSIST: "persist",
	CHOOSE_LUCK_SPENDER: "choose-luck-spender",
	STAT_SELECTION: "stat-selection",
	OPTIONAL_FORMULA: "optional-formula",
	SPECIAL_STAT_SELECTION: "special-stat-selection"
};

function getRollerDialogClasses(classes = []) {
	const base = Array.isArray(classes) ? classes : [];
	return Array.from(new Set([ROLLER_DIALOG_CLASS, ...base]));
}

function tagRollerDialog(dialog, dialogId = "") {
	const root = dialog?.element?.[0];
	if (!root) return;
	root.classList.add(ROLLER_DIALOG_CLASS);
	if (dialogId) {
		root.dataset.bad6DialogId = String(dialogId);
	}
}

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
	if (!actor) return DIALOG_MESSAGES.COMMON.UNKNOWN;
	const speaker = ChatMessage.getSpeaker({ actor, token: token || undefined });
	return speaker?.alias || actor.name || DIALOG_MESSAGES.COMMON.UNKNOWN;
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
	dialogId = "",
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
			classes: getRollerDialogClasses(classes),
			width
		});
		dlg.render(true);
		tagRollerDialog(dlg, dialogId);
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
	const content = DIALOG_MESSAGES.ROLL_READY.CONTENT(escapeHtml(statLabel), advantagePhrase, escapeHtml(formula));
	return showChoiceDialog({
		title: DIALOG_MESSAGES.ROLL_READY.TITLE,
		dialogId: ROLLER_DIALOG_IDS.ROLL_READY,
		content,
		buttons: {
			Yes: { label: DIALOG_MESSAGES.COMMON.YES, callback: () => true },
			No: { label: DIALOG_MESSAGES.COMMON.NO, callback: () => false }
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
		title: DIALOG_MESSAGES.CONFIRM_ROLLER.TITLE,
		dialogId: ROLLER_DIALOG_IDS.CONFIRM_ROLLER,
		content: DIALOG_MESSAGES.CONFIRM_ROLLER.CONTENT,
		buttons: {
			Yes: { label: DIALOG_MESSAGES.COMMON.YES, callback: () => true },
			No: { label: DIALOG_MESSAGES.COMMON.NO, callback: () => false }
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
	const content = DIALOG_MESSAGES.MULLIGAN.CONTENT(!!gambitDefault);
	return showChoiceDialog({
		title: DIALOG_MESSAGES.MULLIGAN.TITLE,
		dialogId: ROLLER_DIALOG_IDS.MULLIGAN,
		content,
		buttons: {
			Yes: {
				label: DIALOG_MESSAGES.COMMON.YES,
				callback: (html) => ({
					confirmed: true,
					useGambit: !!html.find("#use-gambit-mulligan").prop("checked")
				})
			},
			No: {
				label: DIALOG_MESSAGES.COMMON.NO,
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
 * Prompt for Feint gambit usage.
 * @param {Object} options
 * @param {boolean} [options.gambitDefault]
 * @returns {Promise<{useGambit:boolean}>}
 */
export function showFeintGambitDialog({ gambitDefault = false } = {}) {
	const content = DIALOG_MESSAGES.FEINT_GAMBIT.CONTENT(!!gambitDefault);
	return showChoiceDialog({
		title: DIALOG_MESSAGES.FEINT_GAMBIT.TITLE,
		dialogId: ROLLER_DIALOG_IDS.FEINT_GAMBIT,
		content,
		buttons: {
			Yes: {
				label: DIALOG_MESSAGES.FEINT_GAMBIT.CONFIRM_LABEL,
				callback: (html) => ({
					useGambit: !!html.find("#use-gambit-feint").prop("checked")
				})
			},
			Cancel: {
				label: DIALOG_MESSAGES.COMMON.CANCEL,
				callback: (html) => null
			}
		},
		defaultId: "Yes",
		closeValue: null
	});
}


/**
 * Prompt for Persist usage.
 * @param {Object} options
 * @param {boolean} [options.gambitDefault]
 * @param {Function|null} [options.lockCheck]
 * @param {string} [options.lockReason]
 * @param {number} [options.autoCloseMs]
 * @param {string} [options.context] - Context label like "Action" or "Reaction"
 * @returns {Promise<{confirmed:boolean,useGambit:boolean}>}
 */
export function showPersistDialog({
	gambitDefault = false,
	lockCheck = null,
	lockReason = "",
	autoCloseMs = 5000,
	context = ""
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
			${DIALOG_MESSAGES.PERSIST.CONTENT(!!gambitDefault, escapeHtml(lockReason || ""))}
		`;

		const dialogTitle = DIALOG_MESSAGES.PERSIST.TITLE(context);
		const dlg = new Dialog({
			title: dialogTitle,
			content,
			buttons: {
				yes: {
					label: DIALOG_MESSAGES.COMMON.YES,
					callback: (html) => resolveOnce({
						confirmed: true,
						useGambit: !!html.find("#use-gambit-persist").prop("checked")
					})
				},
				no: {
					label: DIALOG_MESSAGES.COMMON.NO,
					callback: (html) => resolveOnce({
						confirmed: false,
						useGambit: !!html.find("#use-gambit-persist").prop("checked")
					})
				}
			},
			default: "no",
			close: () => resolveOnce({ confirmed: false, useGambit: false })
		}, {
			width: 420,
			classes: getRollerDialogClasses(["roller-dialog"]) 
		});

		dlg.render(true);
		tagRollerDialog(dlg, ROLLER_DIALOG_IDS.PERSIST);

		const applyLock = (reason) => {
			const root = dlg?.element;
			if (!root?.length) return;
			const yesBtn = root.find('button[data-button="yes"]');
			const reasonEl = root.find("#persist-lock-reason");
			if (yesBtn.length) yesBtn.prop("disabled", true).css("opacity", 0.6);
			if (reasonEl.length) reasonEl.text(reason || DIALOG_MESSAGES.PERSIST.LOCK_FALLBACK);
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
 * @param {boolean} [options.allowGambit]
 * @param {boolean} [options.allowFeint]
 * @param {string} [options.lockMessage]
 * @param {Function|null} [options.canProceed]
 * @param {boolean} [options.advantageLocked]
 * @param {number} [options.advantageValue]
 * @param {string} [options.advantageChosenBy]
 * @param {string} [options.advantageLockReason]
 * @param {Object} [options.gambitDefaults]
 * @returns {Promise<{key:string,label:string,value:number,advantage:number,luckActorUuid:string|null,gambitSelections:object,feintCount:number}|null>}
 */
export async function showStatDialog(actor, options = {}) {
	const {
		showLuckOptions = true,
		allowGambit = true,
		allowFeint = false,
		lockMessage = DIALOG_MESSAGES.STAT_SELECTION.LOCK_MESSAGE,
		canProceed = null,
		advantageLocked = false,
		advantageValue = 0,
		advantageChosenBy = "",
		advantageLockReason = "",
		gambitDefaults = {},
		title = DIALOG_MESSAGES.STAT_SELECTION.TITLE
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
		ui.notifications.warn(DIALOG_MESSAGES.STAT_SELECTION.UNSUPPORTED_ACTOR_FORMAT);
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
				label: DIALOG_MESSAGES.STAT_SELECTION.LUCK_SPENDER_LABEL(displayName, cand.type, temp, perm),
				callback: () => cand
			};
		}
		selectedLuckActor = await showChoiceDialog({
			title: DIALOG_MESSAGES.STAT_SELECTION.CHOOSE_LUCK_SPENDER_TITLE,
			dialogId: ROLLER_DIALOG_IDS.CHOOSE_LUCK_SPENDER,
			content: DIALOG_MESSAGES.STAT_SELECTION.CHOOSE_LUCK_SPENDER_CONTENT,
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
		const gambitState = {};
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
			ui.notifications.warn(DIALOG_MESSAGES.STAT_SELECTION.NO_NUMERIC_STATS);
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
		 * Build dialog HTML for stat selection and Luck options.
		 * @returns {{formHtml: string, dlgClass: string}}
		 */
		const buildFormHtml = () => {

			let content = "";

			content += `<div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">`;
			content += `<p><strong>${escapeHtml(DIALOG_MESSAGES.STAT_SELECTION.ADVANTAGE_HEADER)}</strong></p>`;
			if (advantageLocked) {
				content += `<div style="color:#b00; font-size:0.9em; margin-bottom:6px;">${escapeHtml(DIALOG_MESSAGES.STAT_SELECTION.ADVANTAGE_CHOSEN_BY(advantageChosenBy || DIALOG_MESSAGES.COMMON.UNKNOWN))}</div>`;
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

			content += `<p style="margin: 10px 0 5px 0;"><strong>${escapeHtml(DIALOG_MESSAGES.STAT_SELECTION.SELECT_STAT_PROMPT)}</strong></p>`;

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

				const getAdvantageValue = () => {
					const selected = root.querySelector('input[name="advantage"]:checked');
					return selected ? Number(selected.value) : null;
				};

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
								ui.notifications.warn(DIALOG_MESSAGES.STAT_SELECTION.SELECT_ADVANTAGE_WARNING);
								return;
							}
							statResolved = true;
							dialogInstance.close();
							
						// Stat selection confirmed
						resolveOnce({
							key: btnData.key,
							label: btnData.statName,
							value: btnData.statValue,
							advantage: advValue,
							luckActorUuid,
							gambitSelections: null,
							feintCount: 0
							});
						}
					});
				});
			}, 50);
		};

		/**
		 * Render the stat selection dialog.
		 * @returns {void}
		 */
		const renderDialog = () => {
			const { formHtml, dlgClass } = buildFormHtml();
			dialogInstance = new Dialog({
				title: title,
				content: formHtml,
				buttons: {
					cancel: { label: DIALOG_MESSAGES.COMMON.CANCEL, callback: () => resolveOnce(null) }
				},
				default: "cancel",
				close: async () => {
					if (isRerendering) return;
					if (!statResolved) {
						resolveOnce(null);
					}
				}
			}, {
				width: 500,
				classes: getRollerDialogClasses(["roller-dialog"])
			});
			dialogInstance.render(true);
			tagRollerDialog(dialogInstance, ROLLER_DIALOG_IDS.STAT_SELECTION);
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
 * @param {string} [options.context] - Context label like "Action 1" or "Reaction 2"
 * @param {string} [options.luckActorUuid] - UUID of the luck spender actor
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
	computeAdvantageFromLines,
	context = "",
	luckActorUuid = null
} = {}) {
	return new Promise(resolve => {
		const dlgClass = `optional-lines-${Date.now()}`;
		let html = `<form class="${dlgClass}">`;
		let useGambitSelected = !!gambitDefault;
		const luckActorOverride = luckActorUuid ? fromUuidSync(luckActorUuid) : null;

		if (showFudge) {
			const initialPreviewAdv = computeAdvantageFromLines
				? computeAdvantageFromLines([...required, ...optionalLines])
				: 0;
			const fudgeCheck = hasFudgeLock
				? { canUse: false, reason: fudgeLockReason }
				: canUseFudge(actor, initialPreviewAdv, useGambitSelected, luckActorOverride);
			const fudgeCost = useGambitSelected ? 0 : 2;
			const fudgeDisabled = !fudgeCheck.canUse ? "disabled" : "";
			const fudgeOpacity = fudgeCheck.canUse ? "1" : "0.6";
			const fudgeReason = hasFudgeLock ? (fudgeLockReason || "") : (fudgeCheck.reason || "");
			html += `
				<div style="margin-bottom:8px; padding:8px; background:#f5f5f5; border-radius:4px;">
					<label id="fudge-label" style="display:block; opacity:${fudgeOpacity};">
						<input type="checkbox" id="use-fudge" class="fudge-checkbox" ${useFudgeSelected ? "checked" : ""} ${fudgeDisabled}>
						<strong>${DIALOG_MESSAGES.OPTIONAL_FORMULA.FUDGE_LABEL}</strong> ${DIALOG_MESSAGES.OPTIONAL_FORMULA.FUDGE_BONUS} ${DIALOG_MESSAGES.OPTIONAL_FORMULA.FUDGE_COST(fudgeCost)}
						<span class="fudge-reason" style="color:#b00; font-size:0.9em;">${escapeHtml(fudgeReason)}</span>
					</label>
					<label style="display:block; margin-top:6px;">
						<input type="checkbox" id="use-gambit-fudge" ${useGambitSelected ? "checked" : ""}>
						<strong>${DIALOG_MESSAGES.OPTIONAL_FORMULA.GAMBIT_LABEL}</strong> ${DIALOG_MESSAGES.OPTIONAL_FORMULA.GAMBIT_DESC}
					</label>
				</div>
			`;
		}

		if (optionalLines.length) {
			html += `<p>${DIALOG_MESSAGES.OPTIONAL_FORMULA.SELECT_PROMPT}</p><div style="max-height:320px;overflow:auto;">`;
			optionalLines.forEach((opt, i) => {
				const op = (opt.line?.operand || "+").toString();
				const varOrVal = opt.line?.variable ? `${opt.line.variable}` : (opt.line?.value !== undefined ? `${opt.line.value}` : "");
				const label = DIALOG_MESSAGES.OPTIONAL_FORMULA.ROLL_LINE_LABEL(
					opt.actorName || DIALOG_MESSAGES.OPTIONAL_FORMULA.FALLBACK_ACTOR,
					opt.itemName || DIALOG_MESSAGES.OPTIONAL_FORMULA.FALLBACK_ITEM,
					op,
					varOrVal
				);
				html += `<div><label><input type="checkbox" class="opt-checkbox" data-idx="${i}" checked> ${escapeHtml(label)}</label></div>`;
			});
			html += `</div>`;
		}
		html += `</form>`;

		const dialogTitle = DIALOG_MESSAGES.OPTIONAL_FORMULA.TITLE(context);
		const dialogInstance = new Dialog({
			title: dialogTitle,
			content: html,
			buttons: {
				include: {
					label: DIALOG_MESSAGES.OPTIONAL_FORMULA.INCLUDE_SELECTED,
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
					label: DIALOG_MESSAGES.COMMON.CANCEL,
					callback: () => resolve(null)
				}
			},
			default: "include"
		}, {
			classes: getRollerDialogClasses(["roller-dialog"])
		});

		dialogInstance.render(true);
		tagRollerDialog(dialogInstance, ROLLER_DIALOG_IDS.OPTIONAL_FORMULA);

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
				const fudgeCheckNow = canUseFudge(actor, previewAdv, gambitActive, luckActorOverride);

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
/**
 * Show a dialog for selecting a special stat (if any exist for the chosen stat).
 * @param {Actor} actor - The actor performing the roll
 * @param {string} statKey - The key of the chosen stat (e.g., "body", "luck")
 * @param {string} statLabel - The label of the chosen stat for display
 * @returns {Promise<string|null>} - Returns the special stat name if selected, null for base stat
 */
export async function showSpecialStatSelectionDialog(actor, statKey, statLabel) {
	const normalizeSpecial = (special, index) => {
		const fallbackKey = (special?.name ?? `special-${index + 1}`).toString().trim();
		return {
			key: (special?.key ?? fallbackKey).toString(),
			label: (special?.label ?? special?.name ?? special?.key ?? fallbackKey).toString(),
			value: Number(special?.value ?? special?.points ?? 0)
		};
	};

	// Get the special stats array from the actor's stat
	let specialStats = [];
	
	// Try to get from user actor stats
	if (actor.system.attributes?.stats?.[statKey]?.special) {
		specialStats = actor.system.attributes.stats[statKey].special;
	}
	// Try to get from sstats/ustats (older/alternate format)
	else if (actor.system.attributes?.ustats?.[statKey]?.special) {
		specialStats = actor.system.attributes.ustats[statKey].special;
	}
	else if (actor.system.attributes?.sstats?.[statKey]?.special) {
		specialStats = actor.system.attributes.sstats[statKey].special;
	}
	
	// Normalize and validate special stats
	specialStats = Array.isArray(specialStats)
		? specialStats
			.map((special, index) => normalizeSpecial(special, index))
			.filter(special => special && typeof special === "object" && special.label)
		: [];
	
	if (!specialStats.length) {
		// No special stats, return null (use base stat)
		return null;
	}

	return new Promise(resolve => {
		const buttons = {};
		
		// Add button for base stat (no special)
		buttons["base-stat"] = {
			label: DIALOG_MESSAGES.SPECIAL_STAT.BASE_LABEL(escapeHtml(statLabel)),
			callback: () => resolve(null)
		};
		
		// Add buttons for each special stat
		specialStats.forEach((special, index) => {
			const displayName = `${escapeHtml(special.label)}`;
			const points = Number.isFinite(special.value) && special.value > 0 ? ` [${special.value}pts]` : "";
			buttons[`special-${index}`] = {
				label: `${displayName}${points}`,
				callback: () => resolve(special.key)
			};
		});

		const content = DIALOG_MESSAGES.SPECIAL_STAT.CONTENT(escapeHtml(statLabel));

		const dlg = new Dialog({
			title: DIALOG_MESSAGES.SPECIAL_STAT.TITLE(escapeHtml(statLabel)),
			content,
			buttons,
			default: "base-stat",
			close: () => resolve(null) // Cancel returns null (base stat)
		}, {
			width: 400,
			classes: getRollerDialogClasses(["special-stat-dialog"])
		});
		dlg.render(true);
		tagRollerDialog(dlg, ROLLER_DIALOG_IDS.SPECIAL_STAT_SELECTION);
	});
}
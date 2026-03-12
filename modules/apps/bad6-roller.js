import { actionLabels, LUCK_MOVE_HINTS, HitDC, HitDCFlavor, DC, DCDifficulty, DCFlavor } from "../constants.js";
import { renderDialog } from "../dialog.js";
import { chooseLuckSpenders, executeLuckMove, trySpendLuck, LUCK_MOVES} from "../luck-moves.js";
import { isDebugEnabled } from "../config.js";
import { createFormula, executeRoll, applyFormulaLines } from "../dice.js";
import { getRollerSocket } from "../sockets.js";
import { canViewActorFormula, canViewActorName, HIDDEN_ACTOR_NAME } from "../utils.js";

async function renderAction(data = {}) {

    const quadrants = data.quadrants
        ? [data.quadrants[1], data.quadrants[2]] // ensure order for actions
        : [
            { quadrantNum: 1, label: actionLabels[0].label, prepared: false, isResolved: false },
            { quadrantNum: 2, label: actionLabels[1].label, prepared: false, isResolved: false }
        ];

  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/action.hbs",
    { quadrants, showResolve: true, isResolved: !!data.isResolved, resolveLabel: data.resolveLabel ?? "Resolve", resolveTooltip: data.resolveTooltip ?? "" }
  );
}
async function renderContest(data = {}) {
    const quadrants = data.quadrants || {}; // object map by quadrant number

  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/contest.hbs",
    {
            actionSide: {
                quadrants: [
                    quadrants[1] || { quadrantNum: 1, label: actionLabels[0].label, prepared: false, isResolved: false },
                    quadrants[2] || { quadrantNum: 2, label: actionLabels[1].label, prepared: false, isResolved: false }
                ]
            },
            reactionSide: {
                quadrants: [
                    quadrants[3] || { quadrantNum: 3, label: actionLabels[2].label, prepared: false, isResolved: false },
                    quadrants[4] || { quadrantNum: 4, label: actionLabels[3].label, prepared: false, isResolved: false }
                ]
            },
            isResolved: !!data.isResolved, 
            resolveLabel: data.resolveLabel ?? "Resolve", 
            resolveTooltip: data.resolveTooltip ?? ""
    }
  );
}
let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
let chatListenersRegistered = false;
const DOUBLE_CLICK_WINDOW_MS = 250;
const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;

async function executeRollerAsGM(handler, ...args) {
    const socket = getRollerSocket();
    if (!socket) {
        ui.notifications.error("Socket is not ready. Cannot execute GM action.");
        return null;
    }
    return await socket.executeAsGM(handler, ...args);
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
				, onChange: async () => {
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
							if (prior) {
                                await dispatchUpdateToContest(priorId);
								return;
							} else {
                                await dispatchUpdateToContest(null);
                            }
						}
						return;
					}
                    lastActionMessageAt = Date.now();
					rollerClickTimer = setTimeout(() => {
						rollerClickTimer = null;
						lastActionMessageId = null;
						lastActionMessageAt = 0;
                        ui.notifications.info(LUCK_MOVE_HINTS.GAMBIT_HINT);
					}, DOUBLE_CLICK_WINDOW_MS);
					const msg = await createActionMessage();
					lastActionMessageId = msg?.id || null;
				}
		};
	});
}

export async function createActionMessage() { 
    const message = await ChatMessage.create({
        content: await renderAction()
    });
    await message.setFlag("bizarre-adventures-d6", "type", "action");
    return message;
}

export async function createContestMessage() {
    const message = await ChatMessage.create({
        content: await renderContest()
    });
    await message.setFlag("bizarre-adventures-d6", "type", "contest");
    return message;
}

export async function updateToContest(messageId) {
    let message = game.messages.get(messageId);

    if (message?.isOwner) {
        await message.setFlag("bizarre-adventures-d6", "type", "contest");
        const quadrants = {
            1: message.getFlag("bizarre-adventures-d6", "quadrant1"),
            2: message.getFlag("bizarre-adventures-d6", "quadrant2")
        };
        const content = await renderContest({ quadrants });
        await message.update({ content });   // keeps same message id
        return message;
    }

    const msg = await ChatMessage.create({ content: await renderContest() });
    await msg.setFlag("bizarre-adventures-d6", "type", "contest");
    ui.notifications.info(LUCK_MOVE_HINTS.GAMBIT_HINT);
    return msg;
}

// Prepare Phase ----------------------------------------------------------------------------------------------

export async function registerChatListeners() {
        if (chatListenersRegistered) return;
        chatListenersRegistered = true;

        Hooks.on("renderChatMessage", (message, html) => {
            applyClientActorLabels(html);
            applyClientRollVisibility(message, html);
            applyChatButtonPermissions(message, html);
        });

        $(document).on("click", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            const [actionType, actionArg] = button.dataset.action.split("-", 2);
            const isAllowed = canUserExecuteAction(messageId, actionType, quadrantNum);
            if (!isAllowed) {
                ui.notifications.warn("You do not own the required actor(s) for this action.");
                return;
            }
            switch (actionType) {
                case "prepare":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    await prepareQuadrant(messageId, quadrantNum, actorSources);
                    }
                    break;
                case "unready":
                    await dispatchResetQuadrant(messageId, quadrantNum);
                    break;
                case "luck":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    const luckActors = chooseLuckSpenders(actorSources);
                    await dispatchLuckMove(messageId, luckActors, quadrantNum, actionArg, false);
                    }
                    break;
                case "resolve":
                    await dispatchRollAll(messageId);
                    break;
                default:
                    notifications.info.warn("Unknown action for button: " + button.dataset.action);
            }
        });
        $(document).on("contextmenu", ".chat-message .select-stat", async (event) => {
            $(document).on("mousedown", ".chat-message .select-stat", (event) => {
                if (event.button !== 2) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            });
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            const [actionType, actionArg] = button.dataset.action.split("-", 2);
            const isAllowed = canUserExecuteAction(messageId, actionType, quadrantNum);
            if (!isAllowed) {
                ui.notifications.warn("You do not own the required actor(s) for this action.");
                return false;
            }
            switch (actionType) {
                case "luck":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return false;
                    const luckActors = chooseLuckSpenders(actorSources);
                    await dispatchLuckMove(messageId, luckActors, quadrantNum, actionArg, true);
                    }
                    break;
                default:
                    notifications.info.warn("Unknown action for button: " + button.dataset.action);
            }
            return false;
        });
}

async function dispatchUpdateToContest(messageId) {
    if (game.user.isGM) return await updateToContest(messageId);
    return await executeRollerAsGM("rollerUpdateToContest", messageId);
}

async function dispatchResetQuadrant(messageId, quadrantNum, refundLuck = true) {
    if (game.user.isGM) return await resetQuadrant(messageId, quadrantNum, refundLuck);
    return await executeRollerAsGM("rollerResetQuadrant", messageId, quadrantNum, refundLuck);
}

async function dispatchLuckMove(messageId, spenders, quadrantNum, move, isGambit = false) {
    if (game.user.isGM) {
        await executeLuckMove(messageId, spenders, quadrantNum, move, isGambit);
        const updatedMessage = game.messages.get(messageId);
        if (updatedMessage) await rerenderMessage(updatedMessage);
        return;
    }
    return await executeRollerAsGM("rollerExecuteLuckMove", messageId, spenders, quadrantNum, move, isGambit);
}

async function dispatchRollAll(messageId) {
    if (game.user.isGM) return await rollAll(messageId);
    return await executeRollerAsGM("rollerRollAll", messageId);
}

function getQuadrantOwnerState(message, quadrantNum) {
    const flagData = message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
    const actor = flagData ? resolveActorFromSource(flagData) : null;
    const isOwner = game.user.isGM || !actor || !!actor?.isOwner;
    return { actor, isOwner, flagData };
}

function canUserResolveMessage(message) {
    if (!message) return false;
    if (game.user.isGM) return true;

    const type = message.getFlag("bizarre-adventures-d6", "type") || "action";
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    return required.every((quadrantNum) => {
        const { actor } = getQuadrantOwnerState(message, quadrantNum);
        return !actor || !!actor?.isOwner;
    });
}

function canUserExecuteAction(messageId, actionType, quadrantNum) {
    const message = game.messages.get(messageId);
    if (!message) return false;

    if (actionType === "resolve") {
        return canUserResolveMessage(message);
    }

    if (actionType === "prepare") {
        return true;
    }

    if (actionType === "unready" || actionType === "luck") {
        const quadrantNumber = Number(quadrantNum);
        if (!Number.isInteger(quadrantNumber)) return false;
        return getQuadrantOwnerState(message, quadrantNumber).isOwner;
    }

    return true;
}

function setButtonDisabledState(buttonEl, disabled, tooltip) {
    const button = buttonEl instanceof HTMLElement ? buttonEl : buttonEl?.[0];
    if (!button) return;
    button.disabled = !!disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.classList.toggle("is-disabled", !!disabled);
    if (tooltip && disabled) {
        button.dataset.tooltip = tooltip;
    }
}

function resolveActorDisplayName({ sourceUuid, actorId, fallbackText }) {
    const actor = resolveActorFromSource({ sourceUuid, actorId });
    const canViewName = canViewActorName(actor, { sourceUuid });
    if (isDebugEnabled()) {
        logVisibilityDecision("name", { sourceUuid, actorId, actor, allowed: canViewName });
    }
    if (!canViewName) return HIDDEN_ACTOR_NAME;
    if (actor?.name) return actor.name;
    return fallbackText || HIDDEN_ACTOR_NAME;
}

function createRedactedRollHtml(flagData = {}) {
    const total = flagData.rollTotal ?? flagData.rollData?.total ?? "?";
    return `<div class="dice-roll bad6-redacted-roll"><div class="dice-result"><div class="dice-formula">Hidden Formula</div><h4 class="dice-total">${total}</h4></div></div>`;
}

function applyClientActorLabels(html) {
    const root = html?.[0] || html;
    if (!root) return;

    root.querySelectorAll(".bad6-actor-name").forEach((node) => {
        const sourceUuid = node.dataset.sourceUuid;
        const actorId = node.dataset.actorId;
        const fallbackText = node.dataset.fallback || node.textContent || "Unknown";
        node.textContent = resolveActorDisplayName({ sourceUuid, actorId, fallbackText });
    });
}

function applyClientRollVisibility(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) return;

    root.querySelectorAll(".bad6-roll-display[data-quadrant]").forEach((node) => {
        const quadrantNumber = Number(node.dataset.quadrant);
        if (!Number.isInteger(quadrantNumber)) return;

        const flagData = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNumber}`) || {};
        const actor = resolveActorFromSource(flagData);
        const canViewFormula = canViewActorFormula(actor, { sourceUuid: flagData.sourceUuid });
        if (isDebugEnabled()) {
            logVisibilityDecision("formula", {
                sourceUuid: flagData.sourceUuid,
                actorId: flagData.actorId,
                actor,
                quadrant: quadrantNumber,
                allowed: canViewFormula
            });
        }
        node.innerHTML = canViewFormula
            ? (flagData.rollHtml || createRedactedRollHtml(flagData))
            : createRedactedRollHtml(flagData);
    });
}

function logVisibilityDecision(type, { sourceUuid, actorId, actor, quadrant = null, allowed }) {
    const sourceDoc = sourceUuid ? fromUuidSync(sourceUuid) : null;
    const sourceOwner = !!sourceDoc?.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    const sourceActorOwner = !!sourceDoc?.actor?.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    const actorOwner = !!actor?.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);

    const roleKey = type === "formula" ? "formulaVisibilityRole" : "actorNameVisibilityRole";
    const ownerKey = type === "formula" ? "formulaVisibilityOwnerOverride" : "actorNameVisibilityOwnerOverride";
    const minimumRole = Number(game.settings.get("bizarre-adventures-d6", roleKey));
    const ownerOverride = !!game.settings.get("bizarre-adventures-d6", ownerKey);

    console.log("[BAD6][Visibility]", {
        type,
        quadrant,
        user: {
            id: game.user?.id,
            name: game.user?.name,
            role: Number(game.user?.role ?? CONST.USER_ROLES.NONE),
            isGM: !!game.user?.isGM
        },
        sourceUuid: sourceUuid || null,
        actorId: actorId || actor?.id || null,
        actorName: actor?.name || null,
        settings: {
            minimumRole,
            ownerOverride
        },
        ownership: {
            sourceOwner,
            sourceActorOwner,
            actorOwner
        },
        allowed
    });
}

function applyChatButtonPermissions(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) return;

    const noOwnershipTip = "You do not own the actor required for this action.";
    const noResolveTip = "You must own all actors in this roll to resolve.";

    root.querySelectorAll('.select-stat[data-action="prepare"]').forEach((button) => {
        setButtonDisabledState(button, false, noOwnershipTip);
    });

    root.querySelectorAll('.select-stat[data-quadrant]').forEach((button) => {
        const action = String(button.dataset.action || "");
        if (!(action === "unready" || action.startsWith("luck-"))) return;
        const quadrantNumber = Number(button.dataset.quadrant);
        const isOwned = Number.isInteger(quadrantNumber)
            ? getQuadrantOwnerState(message, quadrantNumber).isOwner
            : false;
        setButtonDisabledState(button, !isOwned, noOwnershipTip);
    });

    root.querySelectorAll('.select-stat[data-action="resolve"]').forEach((button) => {
        setButtonDisabledState(button, !canUserResolveMessage(message), noResolveTip);
    });
}

async function prepareQuadrant(messageId, quadrantNum, actorSources) {
    const prepare = await renderStatSelectionDialog(messageId, quadrantNum, actorSources);
    if (!prepare) return;
    const actor = resolveActorFromSource({ sourceUuid: prepare.sourceUuid, actorId: prepare.actorId });
    const customLines = actor ? collectActorFormulaLines(actor) : [];

    const baseFormula = createFormula(prepare.statValue, 6, prepare.advantage, 0);
    const evaluated = applyFormulaLines(
        {
            stat: prepare.statValue,
            sides: 6,
            advantage: prepare.advantage,
            modifier: 0,
            statKey: prepare.stat,
            statLabel: prepare.selectedSpecial?.label || prepare.stat
        },
        customLines,
        prepare.selectedModifierIds || []
    );

    const formula = evaluated?.formula || baseFormula;
    const preparedData = {
        ...prepare,
        formula,
        baseFormula,
        customApplied: !!evaluated?.customApplied,
        customTooltip: evaluated?.customTooltip || "",
        customLinesApplied: evaluated?.appliedLines || [],
        selectedModifierIds: prepare.selectedModifierIds || []
    };

    if (game.user.isGM) {
        await updateQuadrant(messageId, quadrantNum, preparedData);
        return;
    }

    await executeRollerAsGM("rollerApplyPreparedQuadrant", messageId, quadrantNum, preparedData);
}
export async function resetQuadrant(messageId, quadrantNum, refundLuck = true) {
    let message = game.messages.get(messageId);
    const locked = !await waitForUnlock(message)
    if (locked) {
        ui.notifications.error("Message is locked. Cannot update.");
        return;
    }
    await message.setFlag("bizarre-adventures-d6", "Locked", true);
    message = game.messages.get(messageId); // refetch to ensure we have the latest state after locking
    if (message) {
        // Per luck action, refund each actor based on the amount of times stored whihc they spent for a move.
        if (refundLuck) {
            const spentLuck = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`)?.luckSpenders || {};
            for (const move in spentLuck) {
                const moveData = LUCK_MOVES[move];
                if (!moveData) continue;
                if (moveData.costType === "gambit") continue;

                const moveSpenders = spentLuck[move] || {};
                for (const spender in moveSpenders) {
                    const count = moveSpenders[spender] || 0;
                    for (let i = 0; i < count; i++) {
                        await trySpendLuck(spender, moveData.name, true);
                    }
                }
            }
        }       
        await message.unsetFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
        rerenderMessage(message);
        await message.setFlag("bizarre-adventures-d6", "Locked", false);   
    } else {
        ui.notifications.error("Could not find message to update.");
         return;
     }
}

async function renderStatSelectionDialog(messageId, quadrantNum, actorSources) {
    if (!actorSources.length) return;
    const quadrantNumber = Number(quadrantNum);
    const pairMap = { 1: 2, 2: 1, 3: 4, 4: 3 };
    const pairQuadrant = pairMap[quadrantNumber];
    const message = game.messages.get(messageId);
    const ownAdvantage = message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNumber}`)?.advantage;
    const pairAdvantage = pairQuadrant
        ? message?.getFlag("bizarre-adventures-d6", `quadrant${pairQuadrant}`)?.advantage
        : undefined;
    const ownNumeric = Number(ownAdvantage);
    const pairNumeric = Number(pairAdvantage);
    const currentAdvantage = Number.isFinite(ownNumeric)
        ? ownNumeric
        : (Number.isFinite(pairNumeric) ? pairNumeric : undefined);

    // Create map of sources
    const actors = actorSources.map(source => {
        // Resolve actor from sourceUuid or actorId
        const actor = resolveActorFromSource(source);
        if (!actor) return null;
        const customLines = collectActorFormulaLines(actor);
        const customModifiers = encodeURIComponent(JSON.stringify(customLines));
        // Extract the number type stats of the actor, specifically the key, actor name, and stat value
        const statsArray = Object.entries(actor.system.attributes.stats)
            .filter(([, stat]) => String(stat?.dtype || "").toLowerCase() === "number")
            .map(([key, stat]) => ({
                key,
                name: stat.label || key,
                value: stat.value ?? 0,
                customModifiers
        }));
        return {
            sourceUuid: source.sourceUuid,
            actorId: source.actorId,
            name: source.name,
            stats: statsArray
        };
    }).filter(a => a);

    // Create dialog
    const statDialogResult = await renderDialog('statAndAdvantage', { actors, quadrantNum, currentAdvantage });
    if (!statDialogResult) return;

    const { stat, advantage, sourceUuid, actorId, selectedModifierIds = [] } = statDialogResult;
    if (!stat || advantage === undefined) return;
    if (!sourceUuid && !actorId) return;

    const actor = resolveActorFromSource({ sourceUuid, actorId });
    if (!actor) return;

    const specialArray = Array.isArray(actor.system.attributes.stats?.[stat]?.special)
        ? actor.system.attributes.stats[stat].special
        : [];
    let statValue = actor.system.attributes.stats[stat].value;
    let selectedSpecial = null;
    if (isDebugEnabled()) {
        console.log(`[Rework] Selected stat: "${stat}", Actor: ${actor.name}`
        , {
            hasSpecialProperty: !!actor.system.attributes.stats?.[stat]?.special,
            specialArray: specialArray,
            length: specialArray.length
        });
    }

    if (specialArray.length > 0) {
        const specialWithStat = [stat, ...specialArray];
        const specialStat = await renderDialog("special", { specialArray: specialWithStat });
        if (!specialStat) return;

        if (specialStat != stat) {
            const selected = specialArray.find(s => {
                const key = (s?.key ?? s?.name ?? "").toString();
                return key === specialStat;
            });
            const selectedValue = Number(selected?.value ?? selected?.points ?? statValue);
            statValue = Number.isFinite(selectedValue) ? selectedValue : statValue;
            selectedSpecial = selected;
        }
    } else {
        if (isDebugEnabled()) {
        console.log(`[Rework] No specials found for stat "${stat}"`);
        }
    }

    return { stat, advantage, sourceUuid, actorId, statValue, selectedSpecial, selectedModifierIds };
    
};


function getRollableActorSources({ user = game.user, warnOnFail = false, hardStopOnFail = false } = {}) {
    // TODO: Add setting to manipulate the roles which can highlight tokens.
    // Also, look into the extend of flatMaps and if they can be optimized
    if (user.isGM) {
        // Pull highlighted token's related actors and their linked actors, then create a list of sources
        const highlighted = canvas.tokens.controlled
            .map(t => {
                const actor = t.actor;
                if (!actor) return null;
                return {
                    sourceUuid: t.document.uuid,
                    actorId: actor.id,
                    name: t.name
                };
            })
            .filter(s => s);

        if (!highlighted.length) {
            if (warnOnFail) ui.notifications.warn("No tokens highlighted. Please highlight tokens to prepare rolls.");
            if (hardStopOnFail) return null;
            return [];
        }
        const linked = highlighted.flatMap((source) => {
            const actor = resolveActorFromSource(source);
            if (!actor) return [];
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    const doc = fromUuidSync(uuid);
                    if (!doc) return null;

                    let actorId;
                    if (doc.documentName === "Actor") {
                        actorId = doc.id;
                    } else if (doc.actor) {
                        actorId = doc.actor.id;
                    } else {
                        return null;
                    }

                    return {
                        sourceUuid: uuid,
                        actorId,
                        name: entry.name || doc.name
                    };
                })
                .filter(s => s);
        });
        // Deduplicate by sourceUuid
        const all = [...highlighted, ...linked];
        const seen = new Set();
        return all.filter(s => {
            if (seen.has(s.sourceUuid)) return false;
            seen.add(s.sourceUuid);
            return true;
        });
    } else {
        // Pull owned actors and their linked actors, then create a list of sources
        const owned = game.actors.filter(a => a.isOwner).map(a => ({
            sourceUuid: a.uuid,
            actorId: a.id,
            name: a.name
        }));
        if (!owned.length) {
            if (warnOnFail) ui.notifications.warn("No owned actors. Please ask your GM to assign you ownership of an actor to prepare rolls.");
            if (hardStopOnFail) return null;
            return [];
        }
        const linked = owned.flatMap((source) => {
            const actor = game.actors.get(source.actorId);
            if (!actor) return [];
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    const doc = fromUuidSync(uuid);
                    if (!doc) return null;

                    let actorId;
                    if (doc.documentName === "Actor") {
                        actorId = doc.id;
                    } else if (doc.actor) {
                        actorId = doc.actor.id;
                    } else {
                        return null;
                    }

                    return {
                        sourceUuid: uuid,
                        actorId,
                        name: entry.name || doc.name
                    };
                })
                .filter(s => s);
        });
        // Deduplicate by sourceUuid
        const all = [...owned, ...linked];
        const seen = new Set();
        return all.filter(s => {
            if (seen.has(s.sourceUuid)) return false;
            seen.add(s.sourceUuid);
            return true;
        });
    }
}

export async function updateQuadrant(messageId
    , quadrantNum
    , { sourceUuid, actorId, stat, advantage, statValue, formula, baseFormula, selectedSpecial, customApplied, customTooltip, customLinesApplied, selectedModifierIds }) 
    {

    let message = game.messages.get(messageId);

    if (!message) {
        ui.notifications.error("Could not find message to update with prepared roll.");
        return;
    }

    const locked = !await waitForUnlock(message)
    if (locked) {
        ui.notifications.error("Message is still locked. Cannot update.");
        return;
    }

    if (!message) return;

    await message.setFlag("bizarre-adventures-d6", `Locked`, true);
    message = game.messages.get(messageId); // refetch to ensure we have the latest state after locking
        const existingQuadrant = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
    await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, {
        sourceUuid,
        actorId,
        stat,
        advantage,
        statValue,
        formula,
        baseFormula: baseFormula || formula,
        selectedSpecial: selectedSpecial ?? null,
        customApplied: !!customApplied,
        customTooltip: customTooltip || "",
        customLinesApplied: Array.isArray(customLinesApplied) ? customLinesApplied : [],
        selectedModifierIds: Array.isArray(selectedModifierIds) ? selectedModifierIds.map(String) : [],
        luckCounts: existingQuadrant.luckCounts || {},
        gambitCounts: existingQuadrant.gambitCounts || {}
    });

    const pairedQuadrantNum = getPairedQuadrantNum(quadrantNum);
    const pairedQuadrant = pairedQuadrantNum
        ? message.getFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`)
        : null;

    if (pairedQuadrant && advantage !== undefined && advantage !== null) {
        await message.setFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`, {
            ...pairedQuadrant,
            advantage
        });
        if (pairedQuadrant.formula) {
            await recalculateQuadrantFormula(messageId, pairedQuadrantNum);
        }
    }

    await rerenderMessage(message);

    await message.setFlag("bizarre-adventures-d6", `Locked`, false);
}

function getPairedQuadrantNum(quadrantNum) {
    const quadrantNumber = Number(quadrantNum);
    const pairMap = { 1: 2, 2: 1, 3: 4, 4: 3 };
    return pairMap[quadrantNumber] ?? null;
}

/**
 * Resolve actor from sourceUuid+actorId with priority fallback.
 * @param {Object} source - { sourceUuid?, actorId? }
 * @returns {Actor|null}
 */
function resolveActorFromSource({ sourceUuid, actorId }) {
    if (sourceUuid) {
        const doc = fromUuidSync(sourceUuid);
        if (doc) {
            if (doc.actor) return doc.actor;
            if (doc.documentName === "Actor") return doc;
        }
    }
    if (actorId) {
        return game.actors.get(actorId);
    }
    return null;
}

function collectActorFormulaLines(actor) {
    if (!actor) return [];
    const lines = [];
    const validVariables = new Set(["stat", "sides", "advantage", "modifier"]);

    for (const item of actor.items || []) {
        const rawLines = item?.system?.formula?.lines;
        const normalized = Array.isArray(rawLines)
            ? rawLines
            : (rawLines && typeof rawLines === "object" ? Object.values(rawLines) : []);

        normalized.forEach((line, index) => {
            const variable = String(line?.variable || "").trim();
            if (!validVariables.has(variable)) return;

            const operand = String(line?.operand || "+").trim();
            const value = Number(line?.value ?? 0);
            if (!Number.isFinite(value)) return;

            lines.push({
                id: `${item.id}:${index}`,
                sourceName: item.name || "Custom",
                optional: !!line?.optional,
                stat: String(line?.stat || "").trim().toLowerCase(),
                variable,
                operand,
                value
            });
        });
    }

    return lines;
}

async function waitForUnlock(message, maxWaitMs = 5000) {
    const startTime = Date.now();
    while (message.getFlag("bizarre-adventures-d6", `Locked`)) {
        if (Date.now() - startTime > maxWaitMs) {
            return false; // timeout
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // wait 100ms
        message = game.messages.get(message.id); // refetch to get updated flags
    }
    return true;
}

export async function rerenderMessage(message) {
    const type = message.getFlag("bizarre-adventures-d6", "type") || "action";
    const quadrants = {};
    let count = 4; // default for contests
    let allPrepared = true;
    const result = message.getFlag("bizarre-adventures-d6", "result") || {};
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    const isResolved = required.every((index) => !!message.getFlag("bizarre-adventures-d6", `quadrant${index}`)?.rolled);
    const resolveLabel = result.label ?? "Resolve";
    const resolveTooltip = result.flavor ?? "";

    if (type === "action") {
        count = 2;
    }
    
    const toAdvantage = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : undefined;
    };
    const getFudgeBonus = (flagData = {}) => {
        const luckFudge = Number(flagData?.luckCounts?.fudge || 0);
        const gambitFudge = Number(flagData?.gambitCounts?.fudge || 0);
        return Math.max(0, luckFudge + gambitFudge);
    };

    // Read all quadrant flags
    for (let i = 1; i <= count; i++) {
        const flagData = message.getFlag("bizarre-adventures-d6", `quadrant${i}`);
        if (!flagData) {
            // Unprepared quadrant
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                lock: false
            };
        }
        else if (flagData.formula) { // Prepared quadrant
            const actor = resolveActorFromSource(flagData);
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: true,
                sourceUuid: flagData.sourceUuid || null,
                actorId: flagData.actorId || null,
                actorName: HIDDEN_ACTOR_NAME,
                statLabel: flagData.stat || "",
                statValue: flagData.statValue || 0,
                advantage: Math.min(3, (toAdvantage(flagData.advantage) ?? 0) + getFudgeBonus(flagData)),
                specialLabel: flagData.selectedSpecial?.label
                    || flagData.selectedSpecial?.name
                    || flagData.selectedSpecial?.key
                    || null,
                customApplied: !!flagData.customApplied,
                customTooltip: flagData.customTooltip || "",
                luckCounts: {
                    feint: flagData.luckCounts?.feint || 0,
                    fudge: flagData.luckCounts?.fudge || 0,
                    flashback: flagData.luckCounts?.flashback || 0,
                    mulligan: flagData.luckCounts?.mulligan || 0,
                    persist: flagData.luckCounts?.persist || 0,
                },
                gambitCounts: {
                    feint: flagData.gambitCounts?.feint || 0,
                    fudge: flagData.gambitCounts?.fudge || 0,
                    flashback: flagData.gambitCounts?.flashback || 0,
                    mulligan: flagData.gambitCounts?.mulligan || 0,
                    persist: flagData.gambitCounts?.persist || 0
                },
                rolled: !!flagData.rolled,
                rollTotal: flagData.rollTotal ?? null,
                rollHtml: createRedactedRollHtml(flagData),
                canUnready: game.user.isGM || !!actor?.isOwner,
                lock: false
            };
        }
        else if (flagData.luckCounts || flagData.gambitCounts) {
            // Feinted quadrant
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                lock: false,
                luckCounts: {
                    feint: flagData.luckCounts?.feint || 0,
                    fudge: flagData.luckCounts?.fudge || 0,
                    flashback: flagData.luckCounts?.flashback || 0,
                    mulligan: flagData.luckCounts?.mulligan || 0,
                    persist: flagData.luckCounts?.persist || 0
                }
            };
        } else {
            // Error if unknown flag state
            ui.notifications.error(`Quadrant ${i} has unknown flag state. Did not update`);
            continue;
        }
    }

    const pairings = [[1, 2], [3, 4]];
    for (const [first, second] of pairings) {
        const firstAdvantage = toAdvantage(quadrants[first]?.advantage);
        const secondAdvantage = toAdvantage(quadrants[second]?.advantage);

        if (quadrants[first]) {
            quadrants[first].advantage = firstAdvantage ?? secondAdvantage ?? 0;
        }
        if (quadrants[second]) {
            quadrants[second].advantage = secondAdvantage ?? firstAdvantage ?? 0;
        }
    }

    Object.values(quadrants).forEach(q => {
        q.allPrepared = allPrepared;
    });
    
    if (type == "action") {
        await message.update({ content: await renderAction({ quadrants, isResolved, resolveLabel, resolveTooltip }) });
    } else { //its a contest
        await message.update({ content: await renderContest({ quadrants, isResolved, resolveLabel, resolveTooltip }) });
    }

    if (isDebugEnabled()) {
        const updatedMessage = game.messages.get(message.id) || message;
        const messageData = updatedMessage.toObject();
        const flagScope = messageData.flags?.["bizarre-adventures-d6"] || {};
        const quadrantFlags = {
            quadrant1: flagScope.quadrant1 ?? null,
            quadrant2: flagScope.quadrant2 ?? null,
            quadrant3: flagScope.quadrant3 ?? null,
            quadrant4: flagScope.quadrant4 ?? null
        };

        console.log("[Rework][rerenderMessage] Updated message data", {
            messageId: updatedMessage.id,
            type,
            isResolved,
            allPrepared,
            quadrants,
            quadrantFlags,
            fullMessageData: messageData
        });
    }
}

export async function recalculateQuadrantFormula(messageId, quadrantNum) {
    const message = game.messages.get(messageId);
    if (!message) return;

    const current = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
    if (!current?.formula) return;

    const baseAdvantage = Number(current.advantage);
    const safeBaseAdvantage = Number.isFinite(baseAdvantage) ? baseAdvantage : 0;
    const luckFudge = Number(current?.luckCounts?.fudge || 0);
    const gambitFudge = Number(current?.gambitCounts?.fudge || 0);
    const effectiveAdvantage = Math.max(0, Math.min(3, safeBaseAdvantage + Math.max(0, luckFudge + gambitFudge)));

    const actor = resolveActorFromSource(current);
    const customLines = actor ? collectActorFormulaLines(actor) : [];
    const selectedModifierIds = Array.isArray(current.selectedModifierIds)
        ? current.selectedModifierIds.map(String)
        : [];

    const statValue = Number(current.statValue ?? 0);
    const baseFormula = createFormula(statValue, 6, effectiveAdvantage, 0);
    const evaluated = applyFormulaLines(
        {
            stat: statValue,
            sides: 6,
            advantage: effectiveAdvantage,
            modifier: 0,
            statKey: current.stat,
            statLabel: current.selectedSpecial?.label || current.stat
        },
        customLines,
        selectedModifierIds
    );

    const formula = evaluated?.formula || baseFormula;
    await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, {
        ...current,
        formula,
        baseFormula,
        customApplied: !!evaluated?.customApplied,
        customTooltip: evaluated?.customTooltip || "",
        customLinesApplied: evaluated?.appliedLines || []
    });

    const pairedQuadrantNum = getPairedQuadrantNum(quadrantNum);
    const pairedQuadrant = pairedQuadrantNum
        ? message.getFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`)
        : null;

    if (pairedQuadrant && Number(pairedQuadrant.advantage) !== safeBaseAdvantage) {
        await message.setFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`, {
            ...pairedQuadrant,
            advantage: safeBaseAdvantage
        });
    }
}

// Execution Phase ----------------------------------------------------------------------------------------------

export async function rollAll(messageId) {
    let message = game.messages.get(messageId);
    if (!message) return;
    const locked = !await waitForUnlock(message);
    if (locked) {
        ui.notifications.error("Message is still locked. Cannot roll.");
        return;
    }
    await message.setFlag("bizarre-adventures-d6", `Locked`, true);
    try {
        message = game.messages.get(messageId);
        const type = message.getFlag("bizarre-adventures-d6", "type");
        const order = type === "action" ? [1, 2] : [3, 4, 1, 2];
        const results = {};

        for (const i of order) {
        const q = message.getFlag("bizarre-adventures-d6", `quadrant${i}`);
        if (!q?.formula) {
            ui.notifications.warn("All required quadrants must be prepared before resolving.");
            return;
        }
        }

        for (let i = 0; i < order.length; i++) {
            const quadrant = message.getFlag("bizarre-adventures-d6", `quadrant${order[i]}`);
            if (quadrant.rolled) continue;
            const roll = await executeRoll(quadrant.formula);
            await message.setFlag("bizarre-adventures-d6", `quadrant${order[i]}`, { 
                ...quadrant
                , rolled: true
                , rollTotal: roll.total
                , rollHtml: await roll.render() 
                , rollData: roll.toJSON()
            });
        }
        // seperate loop incase of desync issues
        for (let i = 1; i <= (type === "action" ? 2 : 4); i++) {
            results[i] = message.getFlag("bizarre-adventures-d6", `quadrant${i}`)?.rollTotal || 0;
        }
        
        // Resolve
        if (type === "contest") {
            const actionTotal = results[1] + results[2] || 0;
            const reactionTotal = results[3] + results[4] || 0;
            const difference = actionTotal - reactionTotal;
            const { label: label, flavor: flavor } = getHitDCMeta(difference);

            if (difference == 0) {
                await ChatMessage.create({
                    content: `<p><strong>Clash!</strong></p>`
                });
                await createContestMessage();
            }
            await message.setFlag("bizarre-adventures-d6", `result`, {
                difference
                , label
                , flavor
            });
        } else {
            const result = results[1] + results[2] || 0;
            const { label, flavor } = getActionDCMeta(result);
            await message.setFlag("bizarre-adventures-d6", `result`, {
                result
                , label
                , flavor
            });
        }
    } finally {
    await rerenderMessage(game.messages.get(messageId));
    await message.setFlag("bizarre-adventures-d6", `Locked`, false);
    }
}

function getHitDCMeta(value) {
  const numeric = Number(value ?? 0);
  const key = Math.min(7, Math.max(0, Math.floor(numeric)));
  return {
    label: HitDC[key] ?? HitDC.default,
    flavor: HitDCFlavor[key] ?? HitDCFlavor.default
  };
}

function getActionDCMeta(value) {
  const key = Math.min(15, Math.max(0, Math.floor(Number(value ?? 0))));
  const context = DCDifficulty[key] + "\n" + DCFlavor[key];
  return {
    label: DC[key] ?? DC.default,
    flavor: context
  };
}
    
    
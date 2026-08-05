import { LUCK_MOVE_HINTS } from "../constants.js";
import { renderDialog } from "../dialog.js";
import { chooseLuckSpenders, executeLuckMove, trySpendLuck, createGambit, LUCK_MOVES} from "../luck-moves.js";
import { isDebugEnabled } from "../config.js";
import { createFormula, executeRoll, applyFormulaLines, collectActorFormulaLines } from "../dice.js";
import { getRollerSocket } from "../sockets.js";
import { shouldInheritLinkedActorModifiers, resolveActorFromSource, getRollableActorSources } from "./roller/actors.js";
import { canUserExecuteAction, canUserResolveMessage, isMessageLocked, applyChatButtonPermissions } from "./roller/permissions.js";
import { getPairAdvantage, getPairReckless, setPairAdvantage, setPairReckless, getPairQuadrantNumbers } from "./roller/pair-controls.js";
import { getHitDCMeta, getActionDCMeta } from "./roller/roll-resolution.js";
import { renderAction, renderContest, renderSource, rerenderMessage, rerenderDisplayMessage } from "./roller/display.js";
import { waitForUnlock, updateQuadrant, recalculateQuadrantFormula, reevaluatePairRollResults, getPairUsedUniqueModifierIds } from "./roller/quadrants.js";
export { rerenderMessage, recalculateQuadrantFormula, reevaluatePairRollResults };

// TODO: Calling a flag calls source message. Calling a Render also calls the Display message

let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
let chatListenersRegistered = false;
const DOUBLE_CLICK_WINDOW_MS = 500;

async function executeRollerAsGM(handler, ...args) {
    const socket = getRollerSocket();
    if (!socket) {
        ui.notifications.error("Socket is not ready. Cannot execute GM action.");
        return false;
    }
    return await socket.executeAsGM(handler, ...args);
}

function withCurrentMessageMode(chatData = {}) {
    const data = foundry.utils.deepClone(chatData);
    const messageMode = String(game.settings.get("core", "messageMode") || "public");
    ChatMessage.applyRollMode(data, messageMode);
    return data;
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
			, icon: "fas fa-dice-d6" // TODO: Default to menacing symbol, however allow the setting to change it to Aaesos' menacing kanji
			, visible: true
			, button: true
			, order: 50
				, onChange: async () => {
                    // If you very recently created an action
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
    const displayMessage = await ChatMessage.create(withCurrentMessageMode({
        content: await renderAction()
    }));
    await displayMessage.setFlag("bizarre-adventures-d6", "type", "action");
    const messageData = {
        speaker: {
            alias: "Debug Message"
        }
        , content: await renderSource()
    };
    ChatMessage.applyMode(messageData, "gm");
    const sourceMessage = await ChatMessage.create(messageData);
    await sourceMessage.setFlag("bizarre-adventures-d6", "type", "source");
    await sourceMessage.setFlag("bizarre-adventures-d6", "displayId", displayMessage.id);
    await displayMessage.setFlag("bizarre-adventures-d6", "sourceId", sourceMessage.id);
    return displayMessage;
}

export async function createContestMessage() {
    const message = await ChatMessage.create(withCurrentMessageMode({
        content: await renderContest()
    }));
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

    const msg = await ChatMessage.create(withCurrentMessageMode({ content: await renderContest() }));
    await msg.setFlag("bizarre-adventures-d6", "type", "contest");
    ui.notifications.info(LUCK_MOVE_HINTS.GAMBIT_HINT);
    return msg;
}

// Prepare Phase ----------------------------------------------------------------------------------------------

export async function registerChatListeners() {
        if (chatListenersRegistered) return;
        chatListenersRegistered = true;
        // First time Check
        const chatMessages = document.querySelectorAll(".chat-message[data-message-id]");
        // For GMs with debug off, hide the debug cards by removing the html.
        if (game.user.isGM && !isDebugEnabled) {
            const sourceMessages = game.messages.filter(message =>
                message.visible && message.getFlag('bizarre-adventures-d6', 'type') == 'source'
            );
            sourceMessages.forEach(message => {
                const el = document.querySelector(`[data-message-id="${message.id}"]`);
                el?.remove();
            });
        };
        // TODO: For Everyone, compute what roll messages should render.
        const displayMessages = game.messages.filter(message =>
                message.visible && 
                (message.getFlag('bizarre-adventures-d6', 'type') == 'action' ||
                message.getFlag('bizarre-adventures-d6', 'type') == 'contest')
            );
        displayMessages.forEach(message => 
            rerenderDisplayMessage(message)
        );
        
        /*
        const cardNeedsVisibilityPass = (card) => {
            const hasBad6Nodes = !!card.querySelector(".bad6-actor-name, .bad6-roll-display[data-quadrant]");
            if (!hasBad6Nodes) return false;

            const hasHiddenActor = Array.from(card.querySelectorAll(".bad6-actor-name"))
                .some((node) => String(node.textContent || "").trim() === "Hidden Actor");
            const hasRedactedRoll = !!card.querySelector(".bad6-redacted-roll");
            const neverPatched = card.dataset.bad6Patched !== "1";
            return hasHiddenActor || hasRedactedRoll || neverPatched;
        };

        const patchVisibleChatCards = () => {
            const chatMessages = document.querySelectorAll(".chat-message[data-message-id]");
            let patchedCount = 0;
            let pendingCount = 0;

            chatMessages.forEach((card) => {
                if (!cardNeedsVisibilityPass(card)) return;
                pendingCount += 1;
                const messageId = card.dataset.messageId;
                if (!messageId) return;
                const message = game.messages.get(messageId);
                if (!message) return;
                applyClientActorLabels(card);
                applyClientRollVisibility(message, card);
                applyChatButtonPermissions(message, card);
                card.dataset.bad6Patched = "1";
                patchedCount += 1;
            });

            if (isDebugEnabled()) {
                console.log("[BAD6][ChatDebug] patchVisibleChatCards run", {
                    renderedCards: chatMessages.length,
                    pendingCards: pendingCount,
                    patchedCards: patchedCount,
                    totalMessages: game.messages?.size ?? 0
                });
            }

            return pendingCount;
        };
        */
        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] registerChatListeners attached", {
                userId: game.user?.id,
                userName: game.user?.name,
                isGM: !!game.user?.isGM,
                currentMessageCount: game.messages?.size ?? 0
            });
        }
        // switched from renderChatMessage blind - unsure what context is
        Hooks.on("renderChatMessageHTML", (message, html, context) => {
            if (isDebugEnabled()) {
                const root = html?.[0] || html;
                const actorNameNodes = root?.querySelectorAll?.(".bad6-actor-name")?.length ?? 0;
                const rollNodes = root?.querySelectorAll?.(".bad6-roll-display[data-quadrant]")?.length ?? 0;
                console.log("[BAD6][ChatDebug] renderChatMessage fired", {
                    messageId: message?.id,
                    type: message?.getFlag?.("bizarre-adventures-d6", "type") || null,
                    actorNameNodes,
                    rollNodes,
                    locked: !!message?.getFlag?.("bizarre-adventures-d6", "Locked")
                });
            }
            // TODO: Check if privacy related and remove if so
            // applyClientActorLabels(html);
            // applyClientRollVisibility(message, html);
            // For our roll messages, re-add client limitation, or hide message entirely if debug is off
            const type = message.getFlag('bizarre-adventures-d6', 'type');
            if (type == 'contest' || type == 'action') applyChatButtonPermissions(message, html)
            else if (type == 'source' && !isDebugEnabled()) html.remove();
        });

        $(document).on("click", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            let message = game.messages.get(messageId);
            const sourceMessageId = message.getFlag('bizarre-adventures-d6', 'sourceId');
            let sourceMessage = game.messages.get(sourceMessageId);
            if (isMessageLocked(sourceMessage)) return;
            const [actionType, actionArg] = button.dataset.action.split("-", 2);
            const isAllowed = canUserExecuteAction(sourceMessageId, actionType, quadrantNum, actionArg);
            if (!isAllowed) {
                ui.notifications.warn("You cannot execute this action.");
                return;
            }
            
            switch (actionType) {
                case "prepare":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    const shouldContinue = !!await prepareQuadrant(sourceMessageId, quadrantNum, actorSources);
                    if (!shouldContinue) return;
                    }
                    break;
                case "unready":
                    const shouldContinue = await dispatchResetQuadrant(sourceMessageId, quadrantNum);
                    if (!shouldContinue) return;
                    break;
                case "luck":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    const luckActors = chooseLuckSpenders(actorSources);
                    await dispatchLuckMove(sourceMessageId, luckActors, quadrantNum, actionArg, false);
                    }
                    break;
                case "resolve":
                    await dispatchRollAll(sourceMessageId);
                    break;
                case "set":
                    if (actionArg === "advantage") {
                        const pairAdvantage = getPairAdvantage(message, Number(quadrantNum)) ?? 0;
                        const newAdvantage = await renderDialog("advantage", { quadrantNum: Number(quadrantNum), currentAdvantage: pairAdvantage });
                        if (newAdvantage === null || newAdvantage === undefined) return; // TODO: confirm changing from break to return solves passing advantage even on fail
                        await dispatchSetPairAdvantage(sourceMessageId, Number(quadrantNum), newAdvantage);
                        break;
                    }
                    if (actionArg === "reckless") {
                        const currentReckless = getPairReckless(message, Number(quadrantNum));
                        await dispatchSetPairReckless(sourceMessageId, Number(quadrantNum), !currentReckless);
                        break;
                    }
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
                    return;
                default:
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
                    return;
            }
            // The system only gets to this point if an action succeeded. TODO: THIS IS A LIE, ALL BUTTONS ALTER VISIBILITY
            await executeRollerAsGM("setFlag", sourceMessage, `quadrant${quadrantNum}Visibility`, { 
                playerId: game.user.id,
                messageMode: game.settings.get("core", "messageMode") 
            });
            const speaker = ChatMessage.getSpeaker();
            const isInCharacter = !!speaker.actor;

            sourceMessage = game.messages.get(sourceMessageId);
            const visibility = sourceMessage.getFlag('bizarre-adventures-d6', `quadrant${quadrantNum}Visibility`);
            const visibilityText = JSON.stringify(visibility);
            if(isDebugEnabled()) ui.notifications.warn(`Visibility Flag: ${visibilityText}`);
            await rerenderDisplayMessage(message);
        });

        $(document).on("mousedown", ".chat-message .select-stat", (event) => {
            if (event.button !== 2) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return false;
        });

        $(document).on("contextmenu", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return false;
        });
    /* TODO: Readd if breaks system, this may be the problem that causes unrendered messages to render
        // Existing chat cards may already be in the log before listeners are attached.
        // Re-render once so actor/formula visibility is applied to all visible messages.
        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] forcing ui.chat.render(true) after listener registration", {
                messageCount: game.messages?.size ?? 0
            });
        }
         
        
        // Do a direct pass over currently visible chat cards in case renderChatMessage
        // does not re-fire for existing entries on world refresh.
        const runPatchPasses = (attempt = 1, maxAttempts = 3) => {
            const pending = patchVisibleChatCards();
            if (pending <= 0 || attempt >= maxAttempts) return;
            const delay = attempt === 1 ? 250 : 750;
            setTimeout(() => runPatchPasses(attempt + 1, maxAttempts), delay);
        };
        runPatchPasses();

        if (isDebugEnabled()) {
            setTimeout(() => {
                const renderedMessages = document.querySelectorAll(".chat-message").length;
                console.log("[BAD6][ChatDebug] post-rerender DOM snapshot", {
                    renderedMessages,
                    totalMessages: game.messages?.size ?? 0
                });
            }, 250);
        }
    */
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
    const sender = game.user.id;
    if (game.user.isGM) {
        await executeLuckMove(messageId, spenders, quadrantNum, move, isGambit, sender);
        const updatedMessage = game.messages.get(messageId);
        if (updatedMessage) await rerenderMessage(updatedMessage);
        return;
    }
    return await executeRollerAsGM("rollerExecuteLuckMove", messageId, spenders, quadrantNum, move, isGambit, sender);
}

async function dispatchRollAll(messageId) {
    if (game.user.isGM) return await rollAll(messageId);
    return await executeRollerAsGM("rollerRollAll", messageId);
}

async function dispatchSetPairAdvantage(messageId, quadrantNum, advantage) {
    if (game.user.isGM) return await applySetPairAdvantage(messageId, quadrantNum, advantage);
    return await executeRollerAsGM("rollerSetPairAdvantage", messageId, quadrantNum, advantage);
}

async function dispatchSetPairReckless(messageId, quadrantNum, reckless) {
    if (game.user.isGM) return await applySetPairReckless(messageId, quadrantNum, reckless);
    return await executeRollerAsGM("rollerSetPairReckless", messageId, quadrantNum, reckless);
}

async function applyPairControlMutation(messageId, mutateFn) {
    let message = game.messages.get(messageId);
    if (!message) return;

    const locked = !await waitForUnlock(message);
    if (locked) {
        ui.notifications.error("Message is still locked. Cannot update.");
        return;
    }

    await message.setFlag("bizarre-adventures-d6", "Locked", true);
    message = game.messages.get(messageId);
    if (message) await rerenderMessage(message);

    try {
        message = game.messages.get(messageId);
        if (!message) return;
        await mutateFn(message);
    } finally {
        const finalMessage = game.messages.get(messageId);
        if (finalMessage) {
            await finalMessage.setFlag("bizarre-adventures-d6", "Locked", false);
            await rerenderMessage(finalMessage);
        }
    }
}

export async function applySetPairAdvantage(messageId, quadrantNum, advantage) {
    await applyPairControlMutation(messageId, async (message) => {
        await setPairAdvantage(message, quadrantNum, advantage);
        const pairNums = getPairQuadrantNumbers(quadrantNum);
        for (const qNum of pairNums) {
            const qFlag = message.getFlag("bizarre-adventures-d6", `quadrant${qNum}`);
            if (qFlag?.formula) await recalculateQuadrantFormula(messageId, qNum);
        }
    });
}

export async function applySetPairReckless(messageId, quadrantNum, reckless) {
    await applyPairControlMutation(messageId, async (message) => {
        await setPairReckless(message, quadrantNum, reckless);
    });
}
// TODO: Standardize across system after optimizing
export async function setFlag(message, flag, value) {
    await message.setFlag('bizarre-adventures-d6', flag, value);
}

async function prepareQuadrant(messageId, quadrantNum, actorSources) {
    const prepare = await renderStatSelectionDialog(messageId, quadrantNum, actorSources);
    if (!prepare) return false;

    const message = game.messages.get(messageId);
    const blockedUniqueLineIds = getPairUsedUniqueModifierIds(message, quadrantNum);
    const safeAdvantage = Number.isFinite(Number(prepare.advantage))
        ? Math.max(0, Math.min(3, Number(prepare.advantage)))
        : (getPairAdvantage(message, quadrantNum) ?? 0);
    const actor = resolveActorFromSource({ sourceUuid: prepare.sourceUuid, actorId: prepare.actorId });
    const customLines = actor
        ? collectActorFormulaLines(actor, { inheritLinkedActorModifiers: shouldInheritLinkedActorModifiers(actor) })
        : [];

    const baseFormula = createFormula(prepare.statValue, 6, safeAdvantage, 0);
    const evaluated = applyFormulaLines(
        {
            stat: prepare.statValue,
            sides: 6,
            advantage: safeAdvantage,
            modifier: 0,
            statKey: prepare.stat,
            statLabel: prepare.selectedSpecial?.label || prepare.stat
        },
        customLines,
        prepare.selectedModifierIds || [],
        { blockedUniqueLineIds }
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
    // TODO: unnecessary?
    if (game.user.isGM) {
        const shouldContinue = await updateQuadrant(messageId, quadrantNum, preparedData);
        return shouldContinue;
    }

    const shouldContinue = await executeRollerAsGM("rollerApplyPreparedQuadrant", messageId, quadrantNum, preparedData);
    return shouldContinue;
}

export async function resetQuadrant(messageId, quadrantNum, refundLuck = true) {
    let message = game.messages.get(messageId);
    const locked = !await waitForUnlock(message)
    if (locked) {
        ui.notifications.error("Message is locked. Cannot update.");
        return false;
    }
    await message.setFlag("bizarre-adventures-d6", "Locked", true);
    message = game.messages.get(messageId);
    if (message) await rerenderMessage(message);
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
            const spentGambits = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`)?.gambitSpenders || {};
            for (const move in spentGambits) {
                const moveData = LUCK_MOVES[move];
                if (!moveData) continue;
                if (moveData.costType === "gambit") continue;

                const moveSpenders = spentGambits[move] || {};
                for (const spender in moveSpenders) {
                    const count = moveSpenders[spender] || 0;
                    for (let i = 0; i < count; i++) {
                        await trySpendLuck(spender, moveData.name, true, true);
                    }
                }
            }
        }       
        await message.unsetFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
        await message.unsetFlag("bizarre-adventures-d6", `quadrant${quadrantNum}Visibility`);
        await rerenderMessage(message);
        await message.setFlag("bizarre-adventures-d6", "Locked", false);
        message = game.messages.get(messageId);
        if (message) await rerenderMessage(message);
        return true;
    } else {
        ui.notifications.error("Could not find message to update.");
         return false;
     }
}

async function renderStatSelectionDialog(messageId, quadrantNum, actorSources) {
    if (!actorSources.length) return;
    const quadrantNumber = Number(quadrantNum);
    const message = game.messages.get(messageId);
    const blockedUniqueLineIds = new Set(getPairUsedUniqueModifierIds(message, quadrantNum)); // Unique line is the same as Per-pair line
    void message; // pair advantage is set independently via the advantage control

    // Create map of sources
    const actors = actorSources.map(source => {
        // Resolve actor from sourceUuid or actorId
        const actor = resolveActorFromSource(source);
        if (!actor) return null;
        const customLines = collectActorFormulaLines(actor, {
            inheritLinkedActorModifiers: shouldInheritLinkedActorModifiers(actor)
        }).map((line) => {
            const isBlocked = !!line.unique && blockedUniqueLineIds.has(String(line.id || ""));
            return {
                ...line,
                unavailable: isBlocked,
                unavailableReason: isBlocked ? "Already used in this pair" : ""
            };
        });
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
    const statDialogResult = await renderDialog('stat', { actors, quadrantNum });
    if (!statDialogResult) return;

    const { stat, sourceUuid, actorId, selectedModifierIds = [], gambit = null } = statDialogResult;
    if (!stat) return;
    if (!sourceUuid && !actorId) return;

    const actor = resolveActorFromSource({ sourceUuid, actorId });
    if (!actor) return;

    const specialArray = Array.isArray(actor.system.attributes.stats?.[stat]?.special)
        ? actor.system.attributes.stats[stat].special
        : [];
    let statValue = actor.system.attributes.stats[stat].value;
    let selectedSpecial = null;
    if (isDebugEnabled()) {
        console.log(`Selected stat: "${stat}", Actor: ${actor.name}`
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
        console.log(`No specials found for stat "${stat}"`);
        }
    }

    let hasGambit = false;
    if(gambit) {
        createGambit(actor.id, gambit); //TODO: Create this function in luck-moves.js
        hasGambit = true;
    }

    return { stat, sourceUuid, actorId, statValue, selectedSpecial, selectedModifierIds, hasGambit }; //TODO: add hasGambit logic to all who call this function
    
};


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
    message = game.messages.get(messageId);
    if (message) await rerenderMessage(message);
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
            const reactionReckless = getPairReckless(message, 3);
            const { label: label, flavor: flavor } = getHitDCMeta(difference, { reactionReckless });

            if (difference == 0) {
                await ChatMessage.create(withCurrentMessageMode({
                    content: `<p><strong>Clash!</strong></p>`
                }));
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
    message = game.messages.get(messageId);
    await rerenderMessage(message);
    const displayMessage = game.messages.get(message.getFlag('bizarre-adventures-d6', 'displayId'));
    await rerenderDisplayMessage(displayMessage);
    }
}


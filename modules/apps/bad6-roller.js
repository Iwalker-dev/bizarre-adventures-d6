import { LUCK_MOVE_HINTS } from "../constants.js";
import { renderDialog } from "../dialog.js";
import { chooseLuckSpenders, executeLuckMove, trySpendLuck, LUCK_MOVES} from "../luck-moves.js";
import { isDebugEnabled } from "../config.js";
import { createFormula, executeRoll, applyFormulaLines, collectActorFormulaLines } from "../dice.js";
import { getRollerSocket } from "../sockets.js";
import { BAD6_PRIVACY_VERSION, buildClickMeta, getCurrentRollMode, getRollModeAudienceUserIds } from "../utils.js";
import { shouldInheritLinkedActorModifiers, resolveActorFromSource, getRollableActorSources } from "./roller/actors.js";
import { canUserExecuteAction, canUserResolveMessage, isMessageLocked, applyChatButtonPermissions } from "./roller/permissions.js";
import { getPairAdvantage, getPairReckless, setPairAdvantage, setPairReckless, getPairQuadrantNumbers } from "./roller/pair-controls.js";
import { getHitDCMeta, getActionDCMeta } from "./roller/roll-resolution.js";
import { renderAction, renderContest, rerenderMessage, applyClientActorLabels, applyClientRollVisibility, applyMessageCardPrivacy } from "./roller/display.js";
import { waitForUnlock, updateQuadrant, recalculateQuadrantFormula, reevaluatePairRollResults, getPairUsedUniqueModifierIds } from "./roller/quadrants.js";
export { rerenderMessage, updateQuadrant, recalculateQuadrantFormula, reevaluatePairRollResults };

let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
let chatListenersRegistered = false;
const DOUBLE_CLICK_WINDOW_MS = 500;
const BAD6_SCOPE = "bizarre-adventures-d6";

function getMessageByAny(ref) {
    if (!ref) return null;
    if (typeof ref === "string") return game.messages.get(ref) || null;
    return ref;
}

function isLegacyRollMessage(message) {
    if (!message) return false;
    const type = String(message.getFlag(BAD6_SCOPE, "type") || "");
    const isRollCard = type === "action" || type === "contest";
    const privacyVersion = Number(message.getFlag(BAD6_SCOPE, "privacyVersion") || 0);
    return isRollCard && privacyVersion !== BAD6_PRIVACY_VERSION;
}

function resolveMessagePair(ref) {
    const message = getMessageByAny(ref);
    if (!message) return { sourceMessage: null, displayMessage: null };

    const isTruth = !!message.getFlag(BAD6_SCOPE, "isTruthMessage");
    if (isTruth) {
        const displayId = String(message.getFlag(BAD6_SCOPE, "displayMessageId") || "").trim();
        return {
            sourceMessage: message,
            displayMessage: displayId ? (game.messages.get(displayId) || null) : null
        };
    }

    const truthId = String(message.getFlag(BAD6_SCOPE, "truthMessageId") || "").trim();
    return {
        sourceMessage: truthId ? (game.messages.get(truthId) || message) : message,
        displayMessage: message
    };
}

function getOperationalMessageId(messageId) {
    const message = getMessageByAny(messageId);
    if (!message) return String(messageId || "");

    if (message.getFlag(BAD6_SCOPE, "isTruthMessage")) {
        return String(message.id);
    }

    const truthId = String(message.getFlag(BAD6_SCOPE, "truthMessageId") || "").trim();
    if (truthId) return truthId;

    const pair = resolveMessagePair(message);
    return pair.sourceMessage?.id || String(message.id || messageId || "");
}

function getMessageShellAudience(messageRef) {
    const pair = resolveMessagePair(messageRef);
    const source = pair.sourceMessage;
    const shellRollMode = String(source?.getFlag(BAD6_SCOPE, "shellRollMode") || "").trim().toLowerCase();

    // Public shell audience should reflect the current world users, not a stale snapshot.
    if (shellRollMode === "publicroll") {
        return getRollModeAudienceUserIds("publicroll", game.user?.id);
    }

    const fallback = getRollModeAudienceUserIds(getCurrentRollMode(), game.user?.id);
    const audience = source?.getFlag(BAD6_SCOPE, "shellAudienceUserIds");
    return Array.isArray(audience) && audience.length ? audience : fallback;
}

function getClickMeta(messageRef, quadrantNum = null) {
    const parentAudienceUserIds = getMessageShellAudience(messageRef);
    const clickMeta = buildClickMeta({
        clickedByUserId: game.user?.id,
        rollModeAtClick: getCurrentRollMode(),
        parentAudienceUserIds
    });
    const parsedQuadrant = Number(quadrantNum);
    const hasQuadrantValue = !(quadrantNum === null || quadrantNum === undefined || String(quadrantNum).trim() === "");
    return {
        ...clickMeta,
        quadrantNum: hasQuadrantValue && Number.isInteger(parsedQuadrant) && parsedQuadrant > 0 ? parsedQuadrant : null
    };
}

async function stampClickMeta(messageRef, clickMeta) {
    const pair = resolveMessagePair(messageRef);
    const message = pair.sourceMessage;
    if (!message || !clickMeta) return;

    // Players may not own GM-created display/truth messages; do not block action flow.
    if (!game.user?.isGM && !message.isOwner) return;

    const history = message.getFlag(BAD6_SCOPE, "clickMetaHistory") || [];
    const nextHistory = Array.isArray(history) ? history.slice(-99) : [];
    nextHistory.push(clickMeta);
    await message.setFlag(BAD6_SCOPE, "clickMetaHistory", nextHistory);

    if (Number.isInteger(clickMeta.quadrantNum)) {
        const key = `quadrant${clickMeta.quadrantNum}`;
        const existing = message.getFlag(BAD6_SCOPE, key) || {};
        const hasExistingQuadrantState = !!(
            existing?.formula
            || existing?.sourceUuid
            || existing?.actorId
            || existing?.stat
            || existing?.luckCounts
            || existing?.gambitCounts
            || existing?.rolled
        );
        if (!hasExistingQuadrantState) return;
        await message.setFlag(BAD6_SCOPE, key, {
            ...existing,
            visibility: {
                clickedByUserId: clickMeta.clickedByUserId,
                rollModeAtClick: clickMeta.rollModeAtClick,
                audienceUserIds: Array.isArray(clickMeta.audienceUserIds) ? clickMeta.audienceUserIds : []
            }
        });
    }
}

export async function stampClickMetaAuthoritative(messageId, clickMeta) {
    if (!clickMeta) return;
    const operationalId = getOperationalMessageId(messageId);
    const message = game.messages.get(operationalId);
    if (!message) return;

    const history = message.getFlag(BAD6_SCOPE, "clickMetaHistory") || [];
    const nextHistory = Array.isArray(history) ? history.slice(-99) : [];
    nextHistory.push(clickMeta);
    await message.setFlag(BAD6_SCOPE, "clickMetaHistory", nextHistory);

    if (Number.isInteger(clickMeta.quadrantNum)) {
        const key = `quadrant${clickMeta.quadrantNum}`;
        const existing = message.getFlag(BAD6_SCOPE, key) || {};
        const hasExistingQuadrantState = !!(
            existing?.formula
            || existing?.sourceUuid
            || existing?.actorId
            || existing?.stat
            || existing?.luckCounts
            || existing?.gambitCounts
            || existing?.rolled
        );
        if (!hasExistingQuadrantState) return;
        await message.setFlag(BAD6_SCOPE, key, {
            ...existing,
            visibility: {
                clickedByUserId: clickMeta.clickedByUserId,
                rollModeAtClick: clickMeta.rollModeAtClick,
                audienceUserIds: Array.isArray(clickMeta.audienceUserIds) ? clickMeta.audienceUserIds : []
            }
        });
    }
}

async function createLinkedRollMessages(type, content) {
    const shellRollMode = getCurrentRollMode();
    const shellAudienceUserIds = getRollModeAudienceUserIds(shellRollMode, game.user?.id);
    const displayData = withCurrentRollMode({
        content,
        flags: {
            [BAD6_SCOPE]: {
                type,
                isDisplayMessage: true,
                privacyVersion: BAD6_PRIVACY_VERSION,
                shellRollMode,
                shellAudienceUserIds
            }
        }
    });
    const displayMessage = await ChatMessage.create(displayData);

    const gmRecipientIds = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
    const truthMessage = await ChatMessage.create({
        content: `<p><strong>BAD6 Internal Truth Message</strong></p>`,
        whisper: gmRecipientIds,
        flags: {
            [BAD6_SCOPE]: {
                type,
                isTruthMessage: true,
                privacyVersion: BAD6_PRIVACY_VERSION,
                displayMessageId: displayMessage.id,
                shellRollMode,
                shellAudienceUserIds
            }
        }
    });

    await displayMessage.setFlag(BAD6_SCOPE, "truthMessageId", truthMessage.id);
    await truthMessage.setFlag(BAD6_SCOPE, "displayMessageId", displayMessage.id);
    return { displayMessage, truthMessage };
}

// Certain functions require GM permissions, necessitating GM listener use
async function executeRollerAsGM(handler, ...args) {
    const socket = getRollerSocket();
    if (!socket) {
        ui.notifications.error("Socket is not ready. Cannot execute GM action.");
        return null;
    }
    return await socket.executeAsGM(handler, ...args);
}

// Used to take the chat message mode and apply it to the roll
function withCurrentRollMode(chatData = {}) {
    const data = foundry.utils.deepClone(chatData);
    const rollMode = String(getCurrentRollMode() || "publicroll");
    const currentUserId = String(game.user?.id || "").trim();

    // Explicitly apply mode fields so custom-button messages always match active chat mode.
    delete data.whisper;
    delete data.blind;

    if (rollMode === "gmroll") {
        const gmIds = ChatMessage.getWhisperRecipients("GM").map((u) => String(u.id));
        data.whisper = Array.from(new Set([...gmIds, currentUserId].filter(Boolean)));
    } else if (rollMode === "blindroll") {
        data.whisper = ChatMessage.getWhisperRecipients("GM").map((u) => String(u.id));
        data.blind = true;
    } else if (rollMode === "selfroll") {
        data.whisper = currentUserId ? [currentUserId] : [];
    }

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

// Renders a single pair chat message for uncontested actions
export async function createActionMessage() { 
    const { displayMessage, truthMessage } = await createLinkedRollMessages("action", await renderAction());
    await rerenderMessage(truthMessage);
    return displayMessage;
}

// Renders a double pair chat message for contested actions
export async function createContestMessage() {
    const { displayMessage, truthMessage } = await createLinkedRollMessages("contest", await renderContest());
    await rerenderMessage(truthMessage);
    return displayMessage;
}

// Used for double click functionality. Changes the existing action message to a contest message.
export async function updateToContest(messageId) {
    const { sourceMessage, displayMessage } = resolveMessagePair(messageId);
    let message = sourceMessage;

    if (message?.isOwner) {
        await message.setFlag(BAD6_SCOPE, "type", "contest");
        if (displayMessage) await displayMessage.setFlag(BAD6_SCOPE, "type", "contest");
        const quadrants = {
            1: message.getFlag(BAD6_SCOPE, "quadrant1"),
            2: message.getFlag(BAD6_SCOPE, "quadrant2")
        };
        if (displayMessage) {
            const content = await renderContest({ quadrants });
            await displayMessage.update({ content });
        }
        await rerenderMessage(message);
        return displayMessage || message;
    }

    const msg = await createContestMessage();
    ui.notifications.info(LUCK_MOVE_HINTS.GAMBIT_HINT);
    return msg;
}

// Prepare Phase ----------------------------------------------------------------------------------------------

export async function registerChatListeners() {
        if (chatListenersRegistered) return;
        chatListenersRegistered = true;

        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] registerChatListeners attached", {
                userId: game.user?.id,
                userName: game.user?.name,
                isGM: !!game.user?.isGM,
                currentMessageCount: game.messages?.size ?? 0
            });
        }

        const applyVisibilityAndPermissions = (message, html) => {
            const root = html?.[0] || html;
            if (isDebugEnabled()) {
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
            applyMessageCardPrivacy(message, html);
            applyClientActorLabels(html);
            applyClientRollVisibility(message, html);
            applyChatButtonPermissions(message, html);
        };

        Hooks.on("renderChatMessage", (message, html) => {
            applyVisibilityAndPermissions(message, html);
        });

        // Foundry v13+ path; keeps behavior consistent when legacy render hooks are skipped.
        Hooks.on("renderChatMessageHTML", (message, html) => {
            applyVisibilityAndPermissions(message, html);
        });

        Hooks.on("updateChatMessage", (message) => {
            const root = document.querySelector(`.chat-message[data-message-id="${message?.id}"]`);
            if (!root) return;
            applyVisibilityAndPermissions(message, root);
        });

        $(document).on("click", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            const message = game.messages.get(messageId);
            if (!message || !!message.getFlag(BAD6_SCOPE, "isTruthMessage") || isLegacyRollMessage(message)) return;
            if (isMessageLocked(message)) return;
            const [actionType, actionArg] = button.dataset.action.split("-", 2);
            const isAllowed = canUserExecuteAction(messageId, actionType, quadrantNum, actionArg);
            if (!isAllowed) {
                ui.notifications.warn("You do not own the required actor(s) for this action.");
                return;
            }
            const clickMeta = getClickMeta(messageId, quadrantNum);
            await stampClickMeta(messageId, clickMeta);
            switch (actionType) {
                case "prepare":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    await prepareQuadrant(messageId, quadrantNum, actorSources, clickMeta);
                    }
                    break;
                case "unready":
                    await dispatchResetQuadrant(messageId, quadrantNum, true, clickMeta);
                    break;
                case "luck":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return;
                    const luckActors = chooseLuckSpenders(actorSources);
                    await dispatchLuckMove(messageId, luckActors, quadrantNum, actionArg, false, clickMeta);
                    }
                    break;
                case "resolve":
                    await dispatchRollAll(messageId, clickMeta);
                    break;
                case "set":
                    if (actionArg === "advantage") {
                        const pairAdvantage = getPairAdvantage(message, Number(quadrantNum)) ?? 0;
                        const newAdvantage = await renderDialog("advantage", { quadrantNum: Number(quadrantNum), currentAdvantage: pairAdvantage });
                        if (newAdvantage === null || newAdvantage === undefined) break;
                        await dispatchSetPairAdvantage(messageId, Number(quadrantNum), newAdvantage, clickMeta);
                        break;
                    }
                    if (actionArg === "reckless") {
                        const currentReckless = getPairReckless(message, Number(quadrantNum));
                        await dispatchSetPairReckless(messageId, Number(quadrantNum), !currentReckless, clickMeta);
                        break;
                    }
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
                    break;
                default:
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
            }
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
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            const message = game.messages.get(messageId);
            if (!message || !!message.getFlag(BAD6_SCOPE, "isTruthMessage") || isLegacyRollMessage(message)) return false;
            if (isMessageLocked(message)) return false;
            const [actionType, actionArg] = button.dataset.action.split("-", 2);
            const isAllowed = canUserExecuteAction(messageId, actionType, quadrantNum, actionArg);
            if (!isAllowed) {
                ui.notifications.warn("You do not own the required actor(s) for this action.");
                return false;
            }
            const clickMeta = getClickMeta(messageId, quadrantNum);
            await stampClickMeta(messageId, clickMeta);
            switch (actionType) {
                case "luck":
                    {
                    const actorSources = getRollableActorSources({ warnOnFail: true, hardStopOnFail: true });
                    if (!actorSources) return false;
                    const luckActors = chooseLuckSpenders(actorSources);
                    await dispatchLuckMove(messageId, luckActors, quadrantNum, actionArg, true, clickMeta);
                    }
                    break;
                case "set":
                    if (actionArg === "advantage") {
                        // Left-click only; ignore right-click on the pair advantage control.
                        break;
                    }
                    if (actionArg === "reckless") {
                        // Left-click only; ignore right-click on the reckless control.
                        break;
                    }
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
                    break;
                default:
                    ui.notifications.warn("Unknown action for button: " + button.dataset.action);
            }
            return false;
        });

        // Existing chat cards may already be in the log before listeners are attached.
        // Re-render once so actor/formula visibility is applied to all visible messages.
        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] forcing ui.chat.render(true) after listener registration", {
                messageCount: game.messages?.size ?? 0
            });
        }
        ui.chat?.render(true);

        if (isDebugEnabled()) {
            setTimeout(() => {
                const renderedMessages = document.querySelectorAll(".chat-message").length;
                console.log("[BAD6][ChatDebug] post-rerender DOM snapshot", {
                    renderedMessages,
                    totalMessages: game.messages?.size ?? 0
                });
            }, 250);
        }
}

async function dispatchUpdateToContest(messageId) {
    const operationalId = getOperationalMessageId(messageId);
    if (game.user.isGM) return await updateToContest(operationalId);
    return await executeRollerAsGM("rollerUpdateToContest", operationalId);
}

async function dispatchAuthoritativeClickMetaStamp(messageId, clickMeta = null) {
    if (!clickMeta || game.user.isGM) return;
    const operationalId = getOperationalMessageId(messageId);
    await executeRollerAsGM("rollerStampClickMeta", operationalId, clickMeta);
}

async function dispatchResetQuadrant(messageId, quadrantNum, refundLuck = true, clickMeta = null) {
    await dispatchAuthoritativeClickMetaStamp(messageId, clickMeta);
    const operationalId = getOperationalMessageId(messageId);
    if (game.user.isGM) return await resetQuadrant(operationalId, quadrantNum, refundLuck);
    return await executeRollerAsGM("rollerResetQuadrant", operationalId, quadrantNum, refundLuck, clickMeta);
}

async function dispatchLuckMove(messageId, spenders, quadrantNum, move, isGambit = false, clickMeta = null) {
    await dispatchAuthoritativeClickMetaStamp(messageId, clickMeta);
    const operationalId = getOperationalMessageId(messageId);
    const sender = game.user.id;
    if (game.user.isGM) {
        await executeLuckMove(operationalId, spenders, quadrantNum, move, isGambit, sender, clickMeta);
        const updatedMessage = game.messages.get(operationalId);
        if (updatedMessage) await rerenderMessage(updatedMessage);
        return;
    }
    return await executeRollerAsGM("rollerExecuteLuckMove", operationalId, spenders, quadrantNum, move, isGambit, sender, clickMeta);
}

async function dispatchRollAll(messageId, clickMeta = null) {
    await dispatchAuthoritativeClickMetaStamp(messageId, clickMeta);
    const operationalId = getOperationalMessageId(messageId);
    if (game.user.isGM) return await rollAll(operationalId, clickMeta);
    return await executeRollerAsGM("rollerRollAll", operationalId, clickMeta);
}

async function dispatchSetPairAdvantage(messageId, quadrantNum, advantage, clickMeta = null) {
    await dispatchAuthoritativeClickMetaStamp(messageId, clickMeta);
    const operationalId = getOperationalMessageId(messageId);
    if (game.user.isGM) return await applySetPairAdvantage(operationalId, quadrantNum, advantage);
    return await executeRollerAsGM("rollerSetPairAdvantage", operationalId, quadrantNum, advantage, clickMeta);
}

async function dispatchSetPairReckless(messageId, quadrantNum, reckless, clickMeta = null) {
    await dispatchAuthoritativeClickMetaStamp(messageId, clickMeta);
    const operationalId = getOperationalMessageId(messageId);
    if (game.user.isGM) return await applySetPairReckless(operationalId, quadrantNum, reckless);
    return await executeRollerAsGM("rollerSetPairReckless", operationalId, quadrantNum, reckless, clickMeta);
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

async function prepareQuadrant(messageId, quadrantNum, actorSources, clickMeta = null) {
    const prepare = await renderStatSelectionDialog(messageId, quadrantNum, actorSources);
    if (!prepare) return;
    const operationalId = getOperationalMessageId(messageId);
    const message = game.messages.get(operationalId);
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
        selectedModifierIds: prepare.selectedModifierIds || [],
        visibility: {
            clickedByUserId: clickMeta?.clickedByUserId || game.user?.id,
            rollModeAtClick: clickMeta?.rollModeAtClick || getCurrentRollMode(),
            audienceUserIds: Array.isArray(clickMeta?.audienceUserIds) ? clickMeta.audienceUserIds : getMessageShellAudience(operationalId)
        }
    };

    if (game.user.isGM) {
        await updateQuadrant(operationalId, quadrantNum, preparedData);
        return;
    }

    await dispatchAuthoritativeClickMetaStamp(operationalId, clickMeta);
    await executeRollerAsGM("rollerApplyPreparedQuadrant", operationalId, quadrantNum, preparedData, clickMeta);
}
export async function resetQuadrant(messageId, quadrantNum, refundLuck = true) {
    let message = game.messages.get(messageId);
    const locked = !await waitForUnlock(message)
    if (locked) {
        ui.notifications.error("Message is locked. Cannot update.");
        return;
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
        }       
        await message.unsetFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
        await rerenderMessage(message);
        await message.setFlag("bizarre-adventures-d6", "Locked", false);
        message = game.messages.get(messageId);
        if (message) await rerenderMessage(message);
    } else {
        ui.notifications.error("Could not find message to update.");
         return;
     }
}

async function renderStatSelectionDialog(messageId, quadrantNum, actorSources) {
    if (!actorSources.length) return;
    const quadrantNumber = Number(quadrantNum);
    const message = game.messages.get(getOperationalMessageId(messageId));
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

    const { stat, sourceUuid, actorId, selectedModifierIds = [] } = statDialogResult;
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

    return { stat, sourceUuid, actorId, statValue, selectedSpecial, selectedModifierIds };
    
};


// Execution Phase ----------------------------------------------------------------------------------------------

export async function rollAll(messageId, clickMeta = null) {
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
            const existingVisibility = quadrant?.visibility || {};
            await message.setFlag("bizarre-adventures-d6", `quadrant${order[i]}`, { 
                ...quadrant
                , rolled: true
                , rollTotal: roll.total
                , rollHtml: await roll.render() 
                , rollData: roll.toJSON()
                , visibility: {
                    clickedByUserId: existingVisibility.clickedByUserId || clickMeta?.clickedByUserId || game.user?.id,
                    rollModeAtClick: existingVisibility.rollModeAtClick || clickMeta?.rollModeAtClick || getCurrentRollMode(),
                    audienceUserIds: Array.isArray(existingVisibility.audienceUserIds)
                        ? existingVisibility.audienceUserIds
                        : (Array.isArray(clickMeta?.audienceUserIds) ? clickMeta.audienceUserIds : getMessageShellAudience(messageId))
                }
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
                await ChatMessage.create(withCurrentRollMode({
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
    await rerenderMessage(game.messages.get(messageId));
    }
}


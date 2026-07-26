/**
 * Display helpers — template rendering, client-side DOM patching, and rerenderMessage.
 */

import { actionLabels } from "../../constants.js";
import { isDebugEnabled } from "../../config.js";
import { BAD6_PRIVACY_VERSION, HIDDEN_ACTOR_NAME, canCurrentUserSeeAudience } from "../../utils.js";
import { resolveActorFromSource } from "./actors.js";
import { getPairAdvantage, getPairFudgeBonus, getPairReckless } from "./pair-controls.js";
import { getContestResultLabel } from "./roll-resolution.js";

const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;
const BAD6_SCOPE = "bizarre-adventures-d6";

// ---------------------------------------------------------------------------
// Template renderers
// ---------------------------------------------------------------------------

export async function renderAction(data = {}) {
    const quadrants = data.quadrants
        ? [data.quadrants[1], data.quadrants[2]] // ensure order for actions
        : [
            { quadrantNum: 1, label: actionLabels[0].label, prepared: false, isResolved: false },
            { quadrantNum: 2, label: actionLabels[1].label, prepared: false, isResolved: false }
        ];
    const pairAdvantage = data.pairAdvantage ?? 0;
    const pairReckless = !!data.pairReckless;
    const showReckless = !!data.showReckless;
    const pairQuadrantNum = quadrants[0]?.quadrantNum ?? 1;

    return await renderTemplateV1(
        "systems/bizarre-adventures-d6/templates/chat/action.hbs",
        { quadrants, pairAdvantage, pairReckless, showReckless, pairQuadrantNum, showResolve: true, isResolved: !!data.isResolved, resolveLabel: data.resolveLabel ?? "Resolve", resolveTooltip: data.resolveTooltip ?? "", resolveStateClass: data.resolveStateClass ?? "" }
    );
}

export async function renderContest(data = {}) {
    const quadrants = data.quadrants || {}; // object map by quadrant number
    const actionPairAdvantage = data.actionPairAdvantage ?? 0;
    const reactionPairAdvantage = data.reactionPairAdvantage ?? 0;
    const reactionPairReckless = !!data.reactionPairReckless;

    return await renderTemplateV1(
        "systems/bizarre-adventures-d6/templates/chat/contest.hbs",
        {
            actionSide: {
                quadrants: [
                    quadrants[1] || { quadrantNum: 1, label: actionLabels[0].label, prepared: false, isResolved: false },
                    quadrants[2] || { quadrantNum: 2, label: actionLabels[1].label, prepared: false, isResolved: false }
                ],
                pairAdvantage: actionPairAdvantage,
                pairReckless: false,
                showReckless: false,
                pairQuadrantNum: 1
            },
            reactionSide: {
                quadrants: [
                    quadrants[3] || { quadrantNum: 3, label: actionLabels[2].label, prepared: false, isResolved: false },
                    quadrants[4] || { quadrantNum: 4, label: actionLabels[3].label, prepared: false, isResolved: false }
                ],
                pairAdvantage: reactionPairAdvantage,
                pairReckless: reactionPairReckless,
                showReckless: true,
                pairQuadrantNum: 3
            },
            isResolved: !!data.isResolved,
            resolveLabel: data.resolveLabel ?? "Resolve",
            resolveTooltip: data.resolveTooltip ?? "",
            resolveStateClass: data.resolveStateClass ?? ""
        }
    );
}

// ---------------------------------------------------------------------------
// Client-side DOM patching
// ---------------------------------------------------------------------------

export function createRedactedRollHtml(flagData = {}) {
    const total = flagData.rollTotal ?? flagData.rollData?.total ?? "?";
    return `<div class="dice-roll bad6-redacted-roll"><div class="dice-result"><div class="dice-formula">Hidden Formula</div><h4 class="dice-total">${total}</h4></div></div>`;
}

function isPrivacyV2Message(message) {
    return Number(message?.getFlag(BAD6_SCOPE, "privacyVersion") || 0) === BAD6_PRIVACY_VERSION;
}

function isTruthMessage(message) {
    return !!message?.getFlag(BAD6_SCOPE, "isTruthMessage");
}

function getLinkedMessage(message, key) {
    const linkedId = String(message?.getFlag(BAD6_SCOPE, key) || "").trim();
    return linkedId ? game.messages.get(linkedId) : null;
}

function resolveRenderPair(message) {
    const msg = message || null;
    if (!msg) return { sourceMessage: null, targetMessage: null };

    if (isTruthMessage(msg)) {
        return {
            sourceMessage: msg,
            targetMessage: getLinkedMessage(msg, "displayMessageId") || msg
        };
    }

    const truthMessage = getLinkedMessage(msg, "truthMessageId");
    return {
        sourceMessage: truthMessage || msg,
        targetMessage: msg
    };
}

async function syncDisplayFlagsFromTruth(sourceMessage, targetMessage, type, count) {
    if (!sourceMessage || !targetMessage || sourceMessage.id === targetMessage.id) return;

    await targetMessage.setFlag(BAD6_SCOPE, "type", type);
    await targetMessage.setFlag(BAD6_SCOPE, "Locked", !!sourceMessage.getFlag(BAD6_SCOPE, "Locked"));
    await targetMessage.setFlag(BAD6_SCOPE, "privacyVersion", Number(sourceMessage.getFlag(BAD6_SCOPE, "privacyVersion") || BAD6_PRIVACY_VERSION));

    for (let i = 1; i <= count; i++) {
        const src = sourceMessage.getFlag(BAD6_SCOPE, `quadrant${i}`);
        if (!src) {
            await targetMessage.unsetFlag(BAD6_SCOPE, `quadrant${i}`);
            continue;
        }

        await targetMessage.setFlag(BAD6_SCOPE, `quadrant${i}`, {
            sourceUuid: src.sourceUuid || null,
            actorId: src.actorId || null,
            rolled: !!src.rolled,
            luckCounts: src.luckCounts || {},
            gambitCounts: src.gambitCounts || {},
            visibility: src.visibility || {}
        });
    }
}

function styleLegacyCard(root) {
    root.style.background = "#fff6cc";
    root.style.border = "2px solid #c6a300";
    root.querySelectorAll("button.select-stat, .select-stat[role='button']").forEach((el) => {
        if (el instanceof HTMLButtonElement) el.disabled = true;
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
    });
}

function styleTruthDebugCard(root) {
    root.style.background = "#e0e0e0";
    root.style.border = "2px dashed #7a7a7a";
    root.style.opacity = "0.9";

    if (!root.querySelector(".bad6-truth-debug-banner")) {
        const banner = document.createElement("div");
        banner.className = "bad6-truth-debug-banner";
        banner.style.fontWeight = "700";
        banner.style.padding = "6px";
        banner.style.marginBottom = "6px";
        banner.style.background = "#bdbdbd";
        banner.textContent = "BAD6 INTERNAL TRUTH MESSAGE (DEBUG ONLY) - DO NOT USE FOR GAMEPLAY";
        root.prepend(banner);
    }

    root.querySelectorAll("button.select-stat, .select-stat[role='button']").forEach((el) => {
        if (el instanceof HTMLButtonElement) el.disabled = true;
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
    });
}

export function applyMessageCardPrivacy(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) return;

    if (isTruthMessage(message)) {
        if (!game.user?.isGM || !isDebugEnabled()) {
            root.style.display = "none";
            return;
        }
        styleTruthDebugCard(root);
        return;
    }

    const type = String(message.getFlag(BAD6_SCOPE, "type") || "");
    const isLegacyRollCard = (type === "action" || type === "contest") && !isPrivacyV2Message(message);
    if (isLegacyRollCard) {
        styleLegacyCard(root);
    }
}

export function applyClientActorLabels(_html) {
    // No-op in privacy v2: actor labels are rendered server-side from truth state.
}

export function applyClientRollVisibility(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) return;
    if (isTruthMessage(message)) return;

    const { sourceMessage } = resolveRenderPair(message);
    const stateMessage = sourceMessage || message;
    const type = String(stateMessage.getFlag(BAD6_SCOPE, "type") || message.getFlag(BAD6_SCOPE, "type") || "action");
    const count = type === "contest" ? 4 : 2;

    for (let i = 1; i <= count; i++) {
        const flagData = stateMessage.getFlag(BAD6_SCOPE, `quadrant${i}`) || message.getFlag(BAD6_SCOPE, `quadrant${i}`);
        if (!flagData) continue;

        const audienceUserIds = Array.isArray(flagData.visibility?.audienceUserIds)
            ? flagData.visibility.audienceUserIds
            : [];
        const canViewSensitive = audienceUserIds.length
            ? canCurrentUserSeeAudience(audienceUserIds)
            : false;
        if (canViewSensitive) continue;

        const trigger = root.querySelector(`button.select-stat[data-quadrant="${i}"]`);
        const context = trigger?.closest(".quadrant-context");
        if (!context) continue;

        context.querySelectorAll(".bad6-actor-name").forEach((node) => {
            node.textContent = HIDDEN_ACTOR_NAME;
        });

        const preparedStat = context.querySelector(".prepared-label-stat .prepared-stat-box");
        if (preparedStat) {
            preparedStat.textContent = "Hidden";
        }

        const rollNode = context.querySelector(`.bad6-roll-display[data-quadrant="${i}"]`);
        if (rollNode) {
            rollNode.innerHTML = createRedactedRollHtml(flagData);
        }
    }
}

// ---------------------------------------------------------------------------
// Main rerender orchestrator
// ---------------------------------------------------------------------------

export async function rerenderMessage(message) {
    const { sourceMessage, targetMessage } = resolveRenderPair(message);
    if (!sourceMessage || !targetMessage) return;

    const type = sourceMessage.getFlag(BAD6_SCOPE, "type") || "action";
    const quadrants = {};
    let count = 4; // default for contests
    let allPrepared = true;
    const result = sourceMessage.getFlag(BAD6_SCOPE, "result") || {};
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    const isResolved = required.every((index) => !!sourceMessage.getFlag(BAD6_SCOPE, `quadrant${index}`)?.rolled);
    const difference = Number(result.difference);
    const winnerSide = Number.isFinite(difference)
        ? (difference > 0 ? "action" : (difference < 0 ? "reaction" : "tie"))
        : null;
    const reactionReckless = getPairReckless(sourceMessage, 3);
    const compactResultLabel = getContestResultLabel(result.label ?? "Resolve", difference, winnerSide, { reactionReckless });
    const resolveLabel = type === "contest" ? compactResultLabel : (result.label ?? "Resolve");
    const resolveTooltip = result.flavor ?? "";
    const resolveStateClass = type === "contest" ? (
        winnerSide === "action" ? "is-victory-action"
            : (winnerSide === "reaction" ? "is-victory-reaction" 
                : (winnerSide === "tie" ? "is-tie" : ""
                )))
        : "";

    if (type === "action") {
        count = 2;
    }

    await syncDisplayFlagsFromTruth(sourceMessage, targetMessage, type, count);

    const toAdvantage = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : undefined;
    };
    // Read all quadrant flags
    for (let i = 1; i <= count; i++) {
        const flagData = sourceMessage.getFlag(BAD6_SCOPE, `quadrant${i}`);
        if (!flagData) {
            // Unprepared quadrant
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                winnerClass: "",
                lock: false
            };
        }
        else if (flagData.formula) { // Prepared quadrant
            const actor = resolveActorFromSource(flagData);
            const pairBaseAdvantage = toAdvantage(getPairAdvantage(sourceMessage, i));
            const pairFudgeBonus = getPairFudgeBonus(sourceMessage, i);
            const pairResolvedAdvantage = Number.isFinite(pairBaseAdvantage)
                ? Math.min(3, Math.max(0, pairBaseAdvantage + pairFudgeBonus))
                : undefined;
            const audienceUserIds = Array.isArray(flagData.visibility?.audienceUserIds)
                ? flagData.visibility.audienceUserIds
                : [];
            const canViewSensitive = audienceUserIds.length
                ? canCurrentUserSeeAudience(audienceUserIds)
                : false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: true,
                winnerClass: "",
                sourceUuid: flagData.sourceUuid || null,
                actorId: flagData.actorId || null,
                actorName: canViewSensitive ? (actor?.name || HIDDEN_ACTOR_NAME) : HIDDEN_ACTOR_NAME,
                statLabel: flagData.stat || "",
                statValue: flagData.statValue || 0,
                advantage: pairResolvedAdvantage ?? toAdvantage(flagData.advantage) ?? 0,
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
                rollHtml: canViewSensitive ? (flagData.rollHtml || createRedactedRollHtml(flagData)) : createRedactedRollHtml(flagData),
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
                winnerClass: "",
                lock: false,
                luckCounts: {
                    feint: flagData.luckCounts?.feint || 0,
                    fudge: flagData.luckCounts?.fudge || 0,
                    flashback: flagData.luckCounts?.flashback || 0,
                    mulligan: flagData.luckCounts?.mulligan || 0,
                    persist: flagData.luckCounts?.persist || 0
                }
            };
        } else if (flagData.visibility) {
            // Legacy/stub quadrant metadata should render as unprepared, not as a hard error.
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                winnerClass: "",
                lock: false
            };
        } else {
            // Error if unknown flag state
            ui.notifications.error(`Quadrant ${i} has unknown flag state. Did not update`);
            continue;
        }
    }

    if (type === "contest") {
        if (winnerSide === "action") {
            [1, 2].forEach((index) => {
                if (quadrants[index]) quadrants[index].winnerClass = "is-winner";
            });
            [3, 4].forEach((index) => {
                if (quadrants[index]) quadrants[index].winnerClass = "is-loser";
            });
        } else if (winnerSide === "reaction") {
            [3, 4].forEach((index) => {
                if (quadrants[index]) quadrants[index].winnerClass = "is-winner";
            });
            [1, 2].forEach((index) => {
                if (quadrants[index]) quadrants[index].winnerClass = "is-loser";
            });
        } else if (winnerSide === "tie") {
            [1, 2, 3, 4].forEach((index) => {
                if (quadrants[index]) quadrants[index].winnerClass = "is-tie";
            });
        }
    }

    Object.values(quadrants).forEach(q => {
        q.allPrepared = allPrepared;
    });

    if (type == "action") {
        const pairAdvantage = getPairAdvantage(sourceMessage, 1) ?? 0;
        await targetMessage.update({ content: await renderAction({ quadrants, isResolved, resolveLabel, resolveTooltip, resolveStateClass, pairAdvantage }) });
    } else { // its a contest
        const actionPairAdvantage = getPairAdvantage(sourceMessage, 1) ?? 0;
        const reactionPairAdvantage = getPairAdvantage(sourceMessage, 3) ?? 0;
        const reactionPairReckless = reactionReckless;
        await targetMessage.update({ content: await renderContest({ quadrants, isResolved, resolveLabel, resolveTooltip, resolveStateClass, actionPairAdvantage, reactionPairAdvantage, reactionPairReckless }) });
    }

    if (isDebugEnabled()) {
        const updatedMessage = game.messages.get(targetMessage.id) || targetMessage;
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
            sourceMessageId: sourceMessage.id,
            type,
            isResolved,
            allPrepared,
            quadrants,
            quadrantFlags,
            fullMessageData: messageData
        });
    }
}

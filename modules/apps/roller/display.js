/**
 * Display helpers — template rendering, client-side DOM patching, and rerenderMessage.
 */

import { actionLabels } from "../../constants.js";
import { isDebugEnabled } from "../../config.js";
// import { canViewActorFormula, canViewActorName, HIDDEN_ACTOR_NAME } from "../../utils.js";
import { resolveActorFromSource } from "./actors.js";
import { getPairAdvantage, getPairFudgeBonus, getPairReckless } from "./pair-controls.js";
import { getContestResultLabel } from "./roll-resolution.js";
import { canViewerSeeQuadrant } from "./chat.js";
import { getRollerSocket } from "../../sockets.js";

const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;

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

export async function renderSource(data = {}) {
    const quadrants = data.quadrants || {}; // object map by quadrant number
    const summaryLines = [];

    const appendQuadrantSummary = (quadrantNum, quadrant) => {
        if (!quadrant) return;

        const parts = [
            `label: ${quadrant?.label ?? "Unknown"}`,
            `prepared: ${quadrant?.prepared ? "yes" : "no"}`,
            quadrant?.statLabel !== undefined
                ? `stat: ${quadrant.statLabel}${quadrant?.statValue !== undefined ? ` (${quadrant.statValue})` : ""}`
                : null,
            quadrant?.advantage !== undefined ? `advantage: ${quadrant.advantage}` : null,
            quadrant?.specialLabel ? `special: ${quadrant.specialLabel}` : null,
            `rolled: ${quadrant?.rolled ? "yes" : "no"}`,
            quadrant?.rollTotal !== undefined && quadrant?.rollTotal !== null
                ? `rollTotal: ${quadrant.rollTotal}`
                : null,
            quadrant?.customTooltip ? `customTooltip: ${quadrant.customTooltip}` : null
        ].filter(Boolean);

        summaryLines.push(`Quadrant ${quadrantNum}: ${parts.join(", ")}`);
    };

    Object.entries(quadrants).forEach(([quadrantNum, quadrant]) => {
        appendQuadrantSummary(quadrantNum, quadrant);
    });

    if (data.actionPairAdvantage !== undefined) {
        summaryLines.push(`Action Advantage: ${data.actionPairAdvantage}`);
    }
    if (data.reactionPairAdvantage !== undefined) {
        summaryLines.push(`Reaction Advantage: ${data.reactionPairAdvantage}`);
    }
    if (data.reactionPairReckless !== undefined) {
        summaryLines.push(`Reaction Reckless: ${data.reactionPairReckless ? "yes" : "no"}`);
    }

    return summaryLines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Client-side DOM patching
// ---------------------------------------------------------------------------
/*
function resolveActorDisplayName({ sourceUuid, actorId, fallbackText }) {
    const actor = resolveActorFromSource({ sourceUuid, actorId });
    // const canViewName = canViewActorName(actor, { sourceUuid, actorId });
    if (isDebugEnabled()) {
        logVisibilityDecision("name", { sourceUuid, actorId, actor, allowed: canViewName });
    }
    // if (!canViewName) return HIDDEN_ACTOR_NAME;
    if (actor?.name) return actor.name;
    return fallbackText // || HIDDEN_ACTOR_NAME;
}

export function createRedactedRollHtml(flagData = {}) {
    const total = flagData.rollTotal ?? flagData.rollData?.total ?? "?";
    return `<div class="dice-roll bad6-redacted-roll"><div class="dice-result"><div class="dice-formula">Hidden Formula</div><h4 class="dice-total">${total}</h4></div></div>`;
}

export function applyClientActorLabels(html) {
    const root = html?.[0] || html;
    if (!root) {
        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] applyClientActorLabels skipped: missing root");
        }
        return;
    }

    if (isDebugEnabled()) {
        console.log("[BAD6][ChatDebug] applyClientActorLabels", {
            actorNodes: root.querySelectorAll(".bad6-actor-name").length
        });
    }

    root.querySelectorAll(".bad6-actor-name").forEach((node) => {
        const sourceUuid = node.dataset.sourceUuid;
        const actorId = node.dataset.actorId;
        const fallbackText = node.dataset.fallback || node.textContent || "Unknown";
        node.textContent = resolveActorDisplayName({ sourceUuid, actorId, fallbackText });
    });
}

export function applyClientRollVisibility(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) {
        if (isDebugEnabled()) {
            console.log("[BAD6][ChatDebug] applyClientRollVisibility skipped", {
                hasMessage: !!message,
                hasRoot: !!root
            });
        }
        return;
    }

    if (isDebugEnabled()) {
        console.log("[BAD6][ChatDebug] applyClientRollVisibility", {
            messageId: message.id,
            rollNodes: root.querySelectorAll(".bad6-roll-display[data-quadrant]").length
        });
    }

    root.querySelectorAll(".bad6-roll-display[data-quadrant]").forEach((node) => {
        const quadrantNumber = Number(node.dataset.quadrant);
        if (!Number.isInteger(quadrantNumber)) return;

        const flagData = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNumber}`) || {};
        const actor = resolveActorFromSource(flagData);
        const canViewFormula = canViewActorFormula(actor, { sourceUuid: flagData.sourceUuid, actorId: flagData.actorId });
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
*/
// ---------------------------------------------------------------------------
// Main rerender orchestrator
// ---------------------------------------------------------------------------

export async function rerenderMessage(message) {
    if (!message) return;

    let type = message.getFlag("bizarre-adventures-d6", "type");
    let targetMessage = message; // What message gets rerendered with the action/contest template
    // if (type != "source") ui.notifications.error("AAAAAAAAAAAAAA");
    const displayId = message.getFlag("bizarre-adventures-d6", "displayId");
    const displayMessage = game.messages.get(displayId);
    type = displayMessage?.getFlag("bizarre-adventures-d6", "type");
    if (!type) return; // action does not start with a type flag, this targets that.
    targetMessage = displayMessage;

    const quadrants = {};
    let count = 4; // default for contests
    let allPrepared = true;
    const result = message.getFlag("bizarre-adventures-d6", "result") || {};
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    const isResolved = required.every((index) => !!message.getFlag("bizarre-adventures-d6", `quadrant${index}`)?.rolled);
    const difference = Number(result.difference);
    const winnerSide = Number.isFinite(difference)
        ? (difference > 0 ? "action" : (difference < 0 ? "reaction" : "tie"))
        : null;
    const reactionReckless = getPairReckless(message, 3);
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

    const toAdvantage = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : undefined;
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
                winnerClass: "",
                lock: false
            };
        }
        else if (flagData.formula) { // Prepared quadrant
            const actor = resolveActorFromSource(flagData);
            const pairBaseAdvantage = toAdvantage(getPairAdvantage(message, i));
            const pairFudgeBonus = getPairFudgeBonus(message, i);
            const pairResolvedAdvantage = Number.isFinite(pairBaseAdvantage)
                ? Math.min(3, Math.max(0, pairBaseAdvantage + pairFudgeBonus))
                : undefined;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: true,
                winnerClass: "",
                sourceUuid: flagData.sourceUuid || null,
                actorId: flagData.actorId || null,
                actorName: null,
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
                rollHtml: flagData,
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
    // Apply to the current message (Update based on template)
    // TODO: All rerenders should also recalculate permissions. This will require having something to calculate those permissions to begin with.
    // All users now run this function, not just GM
    if (game.user.isGM) {
        if (type == "action") {
            const pairAdvantage = getPairAdvantage(message, 1) ?? 0;
            await message.update({ content: await renderSource({ quadrants, isResolved, resolveLabel, resolveTooltip, resolveStateClass, pairAdvantage }) });
        } else { // it's a contest
            const actionPairAdvantage = getPairAdvantage(message, 1) ?? 0;
            const reactionPairAdvantage = getPairAdvantage(message, 3) ?? 0;
            const reactionPairReckless = reactionReckless;
            await message.update({ content: await renderSource({ quadrants, isResolved, resolveLabel, resolveTooltip, resolveStateClass, actionPairAdvantage, reactionPairAdvantage, reactionPairReckless }) });
        }
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
            type,
            isResolved,
            allPrepared,
            quadrants,
            quadrantFlags,
            fullMessageData: messageData
        });
    }
    rerenderDisplayMessage(displayMessage);
}
// TODO: Must calculate each quadrant's visiblity based on message flags
export async function rerenderDisplayMessage(message) {
    if (!message) return;
    const sourceMessageId = message.getFlag("bizarre-adventures-d6", "sourceId");
    const sourceMessage = game.messages.get(sourceMessageId);
    if (!sourceMessage) return;

    const type = message.getFlag("bizarre-adventures-d6", "type");
    let count = 2;
    if (type === "contest") count = 4;

    const quadrants = {};
    let allPrepared = true;

    for (let i = 1; i <= count; i++) {
        const visibility = sourceMessage.getFlag("bizarre-adventures-d6", `quadrant${i}Visibility`) || null;
        const sourceFlag = sourceMessage.getFlag("bizarre-adventures-d6", `quadrant${i}`) || null;
        const quadrantGambitData = sourceMessage.getFlag("bizarre-adventures-d6", `quadrant${i}GambitData`) || null;
        const hasPlacedGambit = !!quadrantGambitData?.gambit?.luckMove;
        const visibilityMode = visibility?.messageMode || null;

        const shouldRender = canViewerSeeQuadrant({
            visibility,
            playerId: game.user.id,
            isGM: !!game.user.isGM
        });

        if (!sourceFlag) {
            // Nothing has happened in this quadrant yet.
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                winnerClass: "",
                lock: false,
                visibilityMode
            };
            continue;
        }

        if (!shouldRender) {
            // Something exists in this quadrant, but this viewer isn't permitted to see it.
            // Only reveal that something happened and how much (chip counts) — never the real content.
            const isPrepared = !!sourceFlag.formula;
            const isRolled = !!sourceFlag.rolled;
            if (!isPrepared) allPrepared = false;

            const luckTotal = Object.values(sourceFlag.luckCounts || {})
                .reduce((sum, n) => sum + (Number(n) || 0), 0);
            const gambitTotal = Object.values(sourceFlag.gambitCounts || {})
                .reduce((sum, n) => sum + (Number(n) || 0), 0);

            // Resolved only to gate the Flashback button — never exposed to the DOM for a hidden quadrant.
            const hiddenActor = resolveActorFromSource(sourceFlag);
            const canFlashback = game.user.isGM || !hiddenActor || !!hiddenActor?.isOwner;

            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: isPrepared,
                rolled: isRolled,
                winnerClass: "",
                hidden: true,
                visibilityMode,
                actorName: "(Hidden Actor)",
                statLabel: "(Hidden Stat)",
                specialLabel: null,
                rollHtml: isRolled
                    ? `<div class="dice-roll bad6-redacted-roll"><div class="dice-result"><div class="dice-formula">(Hidden Formula)</div><h4 class="dice-total">${sourceFlag.rollTotal ?? "?"}</h4></div></div>`
                    : null,
                hiddenLuckCount: luckTotal,
                hiddenGambitCount: gambitTotal,
                canUnready: false,
                canFlashback,
                hasPlacedGambit: false,
                lock: false
            };
            continue;
        }

        const actor = resolveActorFromSource(sourceFlag);
        const canFlashback = game.user.isGM || !actor || !!actor?.isOwner;
        quadrants[i] = {
            quadrantNum: i,
            label: actionLabels[i - 1].label,
            prepared: !!sourceFlag.formula,
            winnerClass: "",
            visibilityMode,
            canFlashback,
            sourceUuid: sourceFlag.sourceUuid || null,
            actorId: sourceFlag.actorId || null,
            actorName: actor?.name || "Hidden Actor",
            statLabel: sourceFlag.stat || "",
            statValue: sourceFlag.statValue || 0,
            advantage: Number.isFinite(Number(sourceFlag.advantage)) ? Number(sourceFlag.advantage) : 0,
            specialLabel: sourceFlag.selectedSpecial?.label
                || sourceFlag.selectedSpecial?.name
                || sourceFlag.selectedSpecial?.key
                || null,
            customApplied: !!sourceFlag.customApplied,
            customTooltip: sourceFlag.customTooltip || "",
            luckCounts: {
                feint: sourceFlag.luckCounts?.feint || 0,
                fudge: sourceFlag.luckCounts?.fudge || 0,
                flashback: sourceFlag.luckCounts?.flashback || 0,
                mulligan: sourceFlag.luckCounts?.mulligan || 0,
                persist: sourceFlag.luckCounts?.persist || 0,
            },
            gambitCounts: {
                feint: sourceFlag.gambitCounts?.feint || 0,
                fudge: sourceFlag.gambitCounts?.fudge || 0,
                flashback: sourceFlag.gambitCounts?.flashback || 0,
                mulligan: sourceFlag.gambitCounts?.mulligan || 0,
                persist: sourceFlag.gambitCounts?.persist || 0
            },
            hasPlacedGambit,
            rolled: !!sourceFlag.rolled,
            rollTotal: sourceFlag.rollTotal ?? null,
            rollHtml: sourceFlag.rollHtml || `<div class="dice-roll bad6-redacted-roll"><div class="dice-result"><div class="dice-formula">Hidden Formula</div><h4 class="dice-total">${sourceFlag.rollTotal ?? "?"}</h4></div></div>`,
            canUnready: game.user.isGM || !!actor?.isOwner,
            lock: false
        };
    }

    const result = sourceMessage.getFlag("bizarre-adventures-d6", "result") || {};
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    const isResolved = required.every((index) => !!sourceMessage.getFlag("bizarre-adventures-d6", `quadrant${index}`)?.rolled);
    const difference = Number(result.difference);
    const winnerSide = Number.isFinite(difference)
        ? (difference > 0 ? "action" : (difference < 0 ? "reaction" : "tie"))
        : null;
    const reactionReckless = getPairReckless(sourceMessage, 3);
    const resolveLabel = type === "contest"
        ? getContestResultLabel(result.label ?? "Resolve", difference, winnerSide, { reactionReckless })
        : (result.label ?? "Resolve");
    const resolveTooltip = result.flavor ?? "";
    const resolveStateClass = type === "contest"
        ? (winnerSide === "action" ? "is-victory-action"
            : (winnerSide === "reaction" ? "is-victory-reaction"
                : (winnerSide === "tie" ? "is-tie" : "")))
        : "";

    if (type === "contest") {
        if (winnerSide === "action") {
            [1, 2].forEach((index) => { if (quadrants[index]) quadrants[index].winnerClass = "is-winner"; });
            [3, 4].forEach((index) => { if (quadrants[index]) quadrants[index].winnerClass = "is-loser"; });
        } else if (winnerSide === "reaction") {
            [3, 4].forEach((index) => { if (quadrants[index]) quadrants[index].winnerClass = "is-winner"; });
            [1, 2].forEach((index) => { if (quadrants[index]) quadrants[index].winnerClass = "is-loser"; });
        } else if (winnerSide === "tie") {
            [1, 2, 3, 4].forEach((index) => { if (quadrants[index]) quadrants[index].winnerClass = "is-tie"; });
        }
    }

    Object.values(quadrants).forEach((q) => {
        if (!q?.prepared) allPrepared = false;
    });
    Object.values(quadrants).forEach((q) => {
        q.allPrepared = allPrepared;
    });

    const card = document.querySelector(`.chat-message[data-message-id="${message.id}"]`);
    const contentNode = card?.querySelector(".message-content");
    if (!contentNode) return;

    if (type === "action") {
        const pairAdvantage = getPairAdvantage(sourceMessage, 1) ?? 0;
        contentNode.innerHTML = await renderAction({ quadrants, pairAdvantage, isResolved, resolveLabel, resolveTooltip, resolveStateClass });
    } else {
        const actionPairAdvantage = getPairAdvantage(sourceMessage, 1) ?? 0;
        const reactionPairAdvantage = getPairAdvantage(sourceMessage, 3) ?? 0;
        contentNode.innerHTML = await renderContest({ quadrants, actionPairAdvantage, reactionPairAdvantage, reactionPairReckless: reactionReckless, isResolved, resolveLabel, resolveTooltip, resolveStateClass });
    }
    // Hopefully forces updates on all clients
    // if (game.user.isGM) await message.setFlag("bizarre-adventures-d6", "lastUpdate", Date.now());
}

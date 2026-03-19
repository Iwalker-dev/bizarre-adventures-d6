/**
 * Quadrant lifecycle helpers — prepare, update, reset, recalculate, reevaluate.
 * resetQuadrant and prepareQuadrant remain in bad6-roller.js (circular-dep avoidance
 * and local-only access respectively).
 */

import { createFormula, applyFormulaLines, collectActorFormulaLines } from "../../dice.js";
import { shouldInheritLinkedActorModifiers, resolveActorFromSource } from "./actors.js";
import { getPairAdvantage, getPairFudgeBonus, getPairMulliganBonus, getPairedQuadrantNum, setPairAdvantage, getPairQuadrantNumbers, getPairReckless } from "./pair-controls.js";
import { reevaluateStoredRoll, renderReevaluatedRollHtml, getHitDCMeta, getActionDCMeta } from "./roll-resolution.js";
import { rerenderMessage } from "./display.js";

// ---------------------------------------------------------------------------
// Lock helpers
// ---------------------------------------------------------------------------

export async function waitForUnlock(message, maxWaitMs = 5000) {
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

// ---------------------------------------------------------------------------
// Quadrant state mutations
// ---------------------------------------------------------------------------

export async function updateQuadrant(messageId
    , quadrantNum
    , { sourceUuid, actorId, stat, advantage, statValue, formula, baseFormula, selectedSpecial, customApplied, customTooltip, customLinesApplied, selectedModifierIds })
    {

    let message = game.messages.get(messageId);

    if (!message) {
        ui.notifications.error("Could not find message to update with prepared roll.");
        return;
    }

    const locked = !await waitForUnlock(message);
    if (locked) {
        ui.notifications.error("Message is still locked. Cannot update.");
        return;
    }

    if (!message) return;

    await message.setFlag("bizarre-adventures-d6", `Locked`, true);
    message = game.messages.get(messageId);
    if (message) await rerenderMessage(message);
    message = game.messages.get(messageId); // refetch to ensure we have the latest state after locking
    const existingQuadrant = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
    const parsedAdvantage = Number(advantage);
    const sharedAdvantage = Number.isFinite(parsedAdvantage)
        ? Math.max(0, Math.min(3, parsedAdvantage))
        : (getPairAdvantage(message, quadrantNum) ?? 0);
    const resolvedPairAdvantage = Math.max(0, Math.min(3, sharedAdvantage + getPairFudgeBonus(message, quadrantNum)));

    await setPairAdvantage(message, quadrantNum, sharedAdvantage);

    await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, {
        sourceUuid,
        actorId,
        stat,
        advantage: resolvedPairAdvantage,
        statValue,
        formula,
        baseFormula: baseFormula || formula,
        selectedSpecial: selectedSpecial ?? null,
        customApplied: !!customApplied,
        customTooltip: customTooltip || "",
        customLinesApplied: Array.isArray(customLinesApplied) ? customLinesApplied : [],
        selectedModifierIds: Array.isArray(selectedModifierIds) ? selectedModifierIds.map(String) : [],
        luckCounts: existingQuadrant.luckCounts || {},
        gambitCounts: existingQuadrant.gambitCounts || {},
        luckSpenders: existingQuadrant.luckSpenders || {}
    });

    const pairedQuadrantNum = getPairedQuadrantNum(quadrantNum);
    const currentQuadrant = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
    const pairedQuadrant = pairedQuadrantNum
        ? message.getFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`)
        : null;

    if (currentQuadrant?.formula) {
        await recalculateQuadrantFormula(messageId, quadrantNum);
    }
    if (pairedQuadrant?.formula) {
        await recalculateQuadrantFormula(messageId, pairedQuadrantNum);
    }

    await rerenderMessage(message);

    await message.setFlag("bizarre-adventures-d6", `Locked`, false);
    message = game.messages.get(messageId);
    if (message) await rerenderMessage(message);
}

export async function recalculateQuadrantFormula(messageId, quadrantNum, { includeMulligan = false } = {}) {
    const message = game.messages.get(messageId);
    if (!message) return;

    const current = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
    if (!current?.formula) return;

    const pairAdvantage = Number(getPairAdvantage(message, quadrantNum));
    const currentAdvantage = Number(current.advantage);
    const safeBaseAdvantage = Number.isFinite(pairAdvantage)
        ? pairAdvantage
        : (Number.isFinite(currentAdvantage) ? currentAdvantage : 0);
    const pairFudgeBonus = getPairFudgeBonus(message, quadrantNum);
    const pairMulliganBonus = includeMulligan ? getPairMulliganBonus(message, quadrantNum) : 0;
    const effectiveAdvantage = Math.max(0, Math.min(3, safeBaseAdvantage + pairFudgeBonus + pairMulliganBonus));

    const actor = resolveActorFromSource(current);
    const customLines = actor
        ? collectActorFormulaLines(actor, { inheritLinkedActorModifiers: shouldInheritLinkedActorModifiers(actor) })
        : [];
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
        advantage: effectiveAdvantage,
        formula,
        baseFormula,
        customApplied: !!evaluated?.customApplied,
        customTooltip: evaluated?.customTooltip || "",
        customLinesApplied: evaluated?.appliedLines || []
    });

    await setPairAdvantage(message, quadrantNum, safeBaseAdvantage);
}

// ---------------------------------------------------------------------------
// Pair roll reevaluation (after advantage / luck changes)
// ---------------------------------------------------------------------------

export async function reevaluatePairRollResults(messageId, quadrantNum) {
    const message = game.messages.get(messageId);
    if (!message) return;

    const pairQuadrants = getPairQuadrantNumbers(quadrantNum);
    for (const index of pairQuadrants) {
        const current = message.getFlag("bizarre-adventures-d6", `quadrant${index}`);
        if (!current?.rolled || !current?.rollData || !current?.formula) continue;

        const reevaluated = reevaluateStoredRoll(current.formula, current.rollData);
        if (!reevaluated) continue;

        const reevaluatedHtml = await renderReevaluatedRollHtml(
            current.formula,
            reevaluated.rollData,
            reevaluated.total,
            current.rollHtml
        );

        await message.setFlag("bizarre-adventures-d6", `quadrant${index}`, {
            ...current,
            rollTotal: reevaluated.total,
            rollData: reevaluated.rollData,
            rollHtml: reevaluatedHtml
        });
    }

    const type = message.getFlag("bizarre-adventures-d6", "type");
    if (type === "action") {
        const result =
            (Number(message.getFlag("bizarre-adventures-d6", "quadrant1")?.rollTotal) || 0)
            + (Number(message.getFlag("bizarre-adventures-d6", "quadrant2")?.rollTotal) || 0);
        const { label, flavor } = getActionDCMeta(result);
        await message.setFlag("bizarre-adventures-d6", "result", { result, label, flavor });
    } else if (type === "contest") {
        const actionTotal =
            (Number(message.getFlag("bizarre-adventures-d6", "quadrant1")?.rollTotal) || 0)
            + (Number(message.getFlag("bizarre-adventures-d6", "quadrant2")?.rollTotal) || 0);
        const reactionTotal =
            (Number(message.getFlag("bizarre-adventures-d6", "quadrant3")?.rollTotal) || 0)
            + (Number(message.getFlag("bizarre-adventures-d6", "quadrant4")?.rollTotal) || 0);
        const difference = actionTotal - reactionTotal;
        const reactionReckless = getPairReckless(message, 3);
        const { label, flavor } = getHitDCMeta(difference, { reactionReckless });
        await message.setFlag("bizarre-adventures-d6", "result", { difference, label, flavor });
    }

    await rerenderMessage(message);
}

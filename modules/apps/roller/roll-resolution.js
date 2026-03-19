/**
 * Roll resolution helpers — pure computation, no message mutations.
 * Functions that require rerenderMessage (rollAll, reevaluatePairRollResults) stay
 * in bad6-roller.js until rerenderMessage is extracted to display.js.
 */

import { HitDC, HitDCFlavor, DC, DCDifficulty, DCFlavor } from "../../constants.js";

// ---------------------------------------------------------------------------
// Roll reevaluation helpers
// ---------------------------------------------------------------------------

export function reevaluateStoredRoll(formula, rollData) {
    if (!formula || !rollData) return null;

    const thresholdMatch = String(formula).match(/cs>=\s*(-?\d+)/u);
    const modifierMatch = String(formula).match(/\+\s*(-?\d+)\s*$/u);
    const threshold = Number(thresholdMatch?.[1]);
    const modifier = Number(modifierMatch?.[1] ?? 0);
    if (!Number.isFinite(threshold) || !Number.isFinite(modifier)) return null;

    const clonedData = foundry.utils.deepClone(rollData);
    let successes = 0;

    for (const term of clonedData?.terms || []) {
        if (Array.isArray(term?.modifiers)) {
            term.modifiers = term.modifiers.map((modifier) => {
                if (typeof modifier !== "string") return modifier;
                return /^cs>=-?\d+$/u.test(modifier) ? `cs>=${threshold}` : modifier;
            });
        }

        if (!Array.isArray(term?.results)) continue;
        let termSuccesses = 0;
        for (const result of term.results) {
            if (result?.discarded) continue;
            const dieValue = Number(result?.result);
            const success = Number.isFinite(dieValue) && dieValue >= threshold;
            result.active = true;
            result.success = success;
            result.failure = !success;
            result.count = success ? 1 : 0;
            if (success) {
                successes += 1;
                termSuccesses += 1;
            }
        }

        term.total = termSuccesses;
    }

    return {
        total: successes + modifier,
        rollData: {
            ...clonedData,
            formula,
            _formula: formula,
            total: successes + modifier,
            _total: successes + modifier
        }
    };
}

export function updateRollHtmlFormula(rollHtml, formula) {
    if (typeof rollHtml !== "string") return rollHtml;
    return rollHtml.replace(/(<div class="dice-formula">)(.*?)(<\/div>)/u, `$1${formula}$3`);
}

export function updateRollHtmlTotal(rollHtml, total) {
    if (typeof rollHtml !== "string") return rollHtml;
    return rollHtml.replace(/(<h4 class="dice-total">)(.*?)(<\/h4>)/u, `$1${total}$3`);
}

export async function renderReevaluatedRollHtml(formula, rollData, total, fallbackHtml) {
    try {
        if (Roll?.fromData) {
            const roll = Roll.fromData(foundry.utils.deepClone(rollData));
            if (roll) {
                roll._formula = formula;
                roll._total = total;
                const html = await roll.render();
                if (html) return html;
            }
        }
    } catch (_error) {
        // Fallback below if roll reconstruction fails
    }

    const formulaUpdated = updateRollHtmlFormula(fallbackHtml, formula);
    return updateRollHtmlTotal(formulaUpdated, total);
}

// ---------------------------------------------------------------------------
// DC / result label helpers
// ---------------------------------------------------------------------------

export function getHitDCMeta(value, { reactionReckless = false } = {}) {
    const numeric = Number(value ?? 0);
    const base = Math.floor(numeric);
    const mappedValue = reactionReckless ? Math.abs(base) : base;
    const key = Math.min(7, Math.max(0, mappedValue));
    return {
        label: HitDC[key] ?? HitDC.default,
        flavor: HitDCFlavor[key] ?? HitDCFlavor.default
    };
}

export function getContestResultLabel(baseLabel, difference, winnerSide, { reactionReckless = false } = {}) {
    const safeBaseLabel = String(baseLabel || "Resolve").trim();
    if (!Number.isFinite(difference)) return safeBaseLabel;
    if (winnerSide === "action") return `Action wins by ${Math.abs(difference)} | ${safeBaseLabel}`;
    if (winnerSide === "reaction") {
        if (!reactionReckless) return safeBaseLabel;
        return `Reaction wins by ${Math.abs(difference)} | ${safeBaseLabel}`;
    }
    if (winnerSide === "tie") return `Tie | ${safeBaseLabel}`;
    return safeBaseLabel;
}

export function getActionDCMeta(value) {
    const key = Math.min(15, Math.max(0, Math.floor(Number(value ?? 0))));
    const context = DCDifficulty[key] + "\n" + DCFlavor[key];
    return {
        label: DC[key] ?? DC.default,
        flavor: context
    };
}

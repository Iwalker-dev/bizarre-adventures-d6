 import { USER_STATS, ABILITY_STATS, typeConfigs } from "./config.js";

 // {{!-- example formula: (@stat)d(@sides)cs>=(@advantage) + (@modifier) --}}

/* Exports:
createFormula(stat, sides, advantage, modifier) - creates a formula string based on the provided parameters
modifyFormula(formula, stat = null, sides = null, advantage = null, modifier = null, operands = []) - modifies an existing formula based on the provided parameters and operands
createRoll(formula) - creates a new Roll object based on the provided formula
parseFormula(component, formula) - parses a specific component (stat, sides, advantage, modifier) from the provided formula
*/

export function createFormula(stat, sides, advantage, modifier) {
        // Final resolved dice count for the roll. Earlier stages may mutate this via formula lines.
    stat = (stat === 6) ? 10 : stat; // 6 is the placeholder for infinite stat
  return `${stat}d${sides}cs>=${5-advantage} + ${modifier}`;
}

const VALID_FORMULA_VARIABLES = new Set(["stat", "sides", "advantage", "modifier"]);
const LEGACY_STAT_KEYS = new Set(["power", "precision", "speed", "range", "durability", "learning", "body", "luck", "menacing", "pluck", "reason", "wit"]);

export function modifyFormula(formula, stat = null, sides = null, advantage = null, modifier = null, operands = []) {
    // Collect the base values from the formula
    const baseStat = parseFormula("stat", formula);
    const baseSides = parseFormula("sides", formula);
    const baseAdvantage = parseFormula("advantage", formula);
    const baseModifier = parseFormula("modifier", formula);
    const baseValues = [baseStat, baseSides, baseAdvantage, baseModifier];
    const newValues = [stat, sides, advantage, modifier];
    // Track which values are being modified
    const modifiedValues = [];

    // If any of the new values are undefined or null, use the base value from the formula
    for (let i = 0; i < newValues.length; i++) {
        if (newValues[i] === undefined || newValues[i] === null) {
            newValues[i] = baseValues[i];
            modifiedValues[i] = false;
        } else {
            modifiedValues[i] = true;
        }
    }

    let index = 0;


    // Apply the operands to the new values
    // consider using (const i, i=0, i++) in the future to look cleaner, but this works for now
    for (const operand of operands) {
        index++;
        while (!modifiedValues[index]) {
            index++;
        }
        switch (operand) {
            case "+":
                newValues[index] = baseValues[index] + newValues[index];
                break;
            case "-":
                newValues[index] = baseValues[index] - newValues[index];
                break;
            case "*":
                newValues[index] = baseValues[index] * newValues[index];
                break;
            case "/":
                newValues[index] = baseValues[index] / newValues[index];
                break;
            case "=":
                // Do nothing, the new value is already set
                break;
            default:
                ui.notifications.warn("Invalid operand: " + operand);
        }
    }

  return formula
    .replace(/@stat/g, newValues[0])
    .replace(/@sides/g, newValues[1])
    .replace(/@advantage/g, newValues[2])
    .replace(/@modifier/g, newValues[3]);
}

function applyOperand(currentValue, operand, lineValue) {
    switch (operand) {
        case "+":
            return currentValue + lineValue;
        case "-":
            return currentValue - lineValue;
        case "*":
            return currentValue * lineValue;
        case "/":
            return lineValue !== 0 ? currentValue / lineValue : currentValue;
        case "=":
            return lineValue;
        default:
            return currentValue;
    }
}

function formatTrace(label, tokens, unclampedValue, clampedValue) {
    const expression = `${label}: ${tokens.join(" ")}`;
    if (unclampedValue !== clampedValue) {
        return `${expression} = ${unclampedValue} (${clampedValue})`;
    }
    return `${expression} = ${clampedValue}`;
}

export function normalizeFormulaLines(rawLines = []) {
    const normalizedInput = Array.isArray(rawLines)
        ? rawLines
        : (rawLines && typeof rawLines === "object" ? Object.values(rawLines) : []);

    return normalizedInput.map((rawLine) => {
        const line = rawLine || {};
        // `stat` is the targeting scope selector for a line (which chosen stat this line applies to).
        // Example values today: exact keys like "power"/"luck", or empty string for global.
        let stat = String(line.stat || "").trim().toLowerCase();
        // `variable` is the formula component being changed (stat/sides/advantage/modifier).
        let variable = String(line.variable || "modifier").trim().toLowerCase();

        if (!stat && LEGACY_STAT_KEYS.has(variable)) {
            stat = variable;
            variable = "stat";
        }

        return {
            ...line,
            optional: !!line.optional,
            unique: !!line.unique,
            operand: String(line.operand || "+").trim() || "+",
            stat,
            variable,
            value: Number(line.value ?? 0)
        };
    });
}

function parseConfigFormulaLine(rawLine) {
    if (!rawLine) return null;

    if (typeof rawLine === "object") {
        return {
            ...rawLine,
            stat: String(rawLine.stat || "").trim().toLowerCase(),
            variable: String(rawLine.variable || "modifier").trim().toLowerCase(),
            operand: String(rawLine.operand || "+").trim() || "+",
            value: Number(rawLine.value ?? 0),
            optional: !!rawLine.optional,
            unique: !!rawLine.unique,
            label: rawLine.label
        };
    }

    if (typeof rawLine !== "string") return null;
    const compact = rawLine.trim();
    if (!compact) return null;

    const match = compact.match(/^(?:(user|ability|[a-z]+)\s*:?\s+)?(stat|sides|advantage|modifier)\s*([+\-*/=])\s*(-?\d+(?:\.\d+)?)\s*(.*)$/i);
    if (!match) return null;

    const [, statScope = "", variable = "modifier", operand = "+", value = "0", flags = ""] = match;
    const flagSet = new Set(
        String(flags || "")
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
    );

    return {
        stat: String(statScope || "").trim().toLowerCase(),
        variable: String(variable || "modifier").trim().toLowerCase(),
        operand: String(operand || "+").trim() || "+",
        value: Number(value ?? 0),
        optional: flagSet.has("optional"),
        unique: flagSet.has("unique")
    };
}

function getTypeConfigFormulaLines(actor) {
    const actorType = String(actor?.type || "").trim();
    const bioType = String(actor?.system?.bio?.type || "").trim();
    if (!actorType || !bioType) return [];

    const config = typeConfigs?.[actorType]?.[bioType];
    if (!config || typeof config !== "object") return [];

    const rawLines = config.formulaLines ?? config.rollFormulas ?? config.formulas;
    if (!Array.isArray(rawLines)) return [];

    const parsed = rawLines
        .map(parseConfigFormulaLine)
        .filter(line => line && Number.isFinite(line.value) && VALID_FORMULA_VARIABLES.has(line.variable));

    return normalizeFormulaLines(parsed).map((line, index) => ({
        ...line,
        id: `type:${actor.id}:${actorType}:${bioType}:${index}`,
        sourceName: String(line.label || `${config.label || bioType} (Type Formula)`).trim()
    }));
}

function safeFromUuidSync(uuid) {
    if (typeof uuid !== "string" || !uuid) return null;

    try {
        return fromUuidSync(uuid);
    } catch (_error) {
        const tokenUuid = uuid.replace(/\.Actor\.[^.]+$/u, "");
        if (tokenUuid === uuid) return null;

        try {
            return fromUuidSync(tokenUuid);
        } catch (_nestedError) {
            return null;
        }
    }
}

function getPreferredLinkedActor(linkedUuid) {
    const linkedDoc = safeFromUuidSync(linkedUuid);
    const resolvedActor = linkedDoc?.actor || (linkedDoc?.documentName === "Actor" ? linkedDoc : null);
    if (!resolvedActor) return null;

    const activeTokenActor = canvas?.tokens?.placeables
        ?.map(token => token?.actor)
        ?.find(actor => actor?.id === resolvedActor.id);

    return activeTokenActor || resolvedActor;
}

export function collectActorFormulaLines(actor, { inheritLinkedActorModifiers = false } = {}) {
    if (!actor) return [];

    const lines = [];
    const seenActorIds = new Set();

    const appendActorLines = (sourceActor, sourceLabelPrefix = "") => {
        if (!sourceActor?.id || seenActorIds.has(sourceActor.id)) return;
        seenActorIds.add(sourceActor.id);

        const typeConfigLines = getTypeConfigFormulaLines(sourceActor);
        typeConfigLines.forEach((line) => {
            const sourceName = String(line.sourceName || "Custom").trim() || "Custom";
            lines.push({
                id: String(line.id),
                sourceActorId: sourceActor.id,
                sourceActorName: sourceActor.name || "",
                sourceName: sourceLabelPrefix ? `${sourceLabelPrefix} • ${sourceName}` : sourceName,
                optional: !!line.optional,
                unique: !!line.unique,
                stat: String(line.stat || "").trim().toLowerCase(),
                variable: line.variable,
                operand: String(line.operand || "+").trim(),
                value: Number(line.value ?? 0)
            });
        });

        for (const item of sourceActor.items || []) {
            const normalizedLines = normalizeFormulaLines(item?.system?.formula?.lines);
            normalizedLines.forEach((line, index) => {
                if (!VALID_FORMULA_VARIABLES.has(line.variable)) return;
                if (!Number.isFinite(line.value)) return;

                lines.push({
                    id: `${sourceActor.id}:${item.id}:${index}`,
                    sourceActorId: sourceActor.id,
                    sourceActorName: sourceActor.name || "",
                    sourceName: sourceLabelPrefix ? `${sourceLabelPrefix} • ${item.name || "Custom"}` : (item.name || "Custom"),
                    optional: !!line.optional,
                    unique: !!line.unique,
                    stat: String(line.stat || "").trim().toLowerCase(),
                    variable: line.variable,
                    operand: String(line.operand || "+").trim(),
                    value: Number(line.value ?? 0)
                });
            });
        }
    };

    appendActorLines(actor);

    if (inheritLinkedActorModifiers) {
        const linkedActors = actor.system?.bio?.linkedActors?.value || [];
        for (const entry of linkedActors) {
            const linkedUuid = entry?.uuid;
            if (typeof linkedUuid !== "string" || !linkedUuid) continue;

            const linkedActor = getPreferredLinkedActor(linkedUuid);
            if (!linkedActor || linkedActor.id === actor.id) continue;

            appendActorLines(linkedActor, linkedActor.name || entry?.name || "Linked Actor");
        }
    }

    return lines;
}

export function applyFormulaLines(base = {}, lines = [], selectedOptionalIds = [], options = {}) {
    const selectedIds = new Set((selectedOptionalIds || []).map(String));
    const blockedUniqueIds = new Set((options?.blockedUniqueLineIds || []).map(String));
    const values = {
        stat: Number(base.stat ?? 0),
        sides: Number(base.sides ?? 6),
        advantage: Number(base.advantage ?? 0),
        modifier: Number(base.modifier ?? 0)
    };

    const traceTokens = {
        stat: [`${values.stat} (${base.statLabel || "Stat"})`],
        sides: [String(values.sides)],
        advantage: [String(values.advantage)],
        modifier: [String(values.modifier)]
    };

    const appliedLines = [];
    const variableOrder = ["stat", "sides", "advantage", "modifier"];

    for (const rawLine of lines || []) {
        const line = rawLine || {};
        const variable = String(line.variable || "").trim();
        if (!variableOrder.includes(variable)) continue;

        // Stat targeting gate:
        // - base.statKey is the currently selected roll stat (from prepare flow).
        // - line.stat limits whether this line applies to that selected stat.
        // - current behavior is exact-match only (or global when line.stat is empty).
        // If group targeting is added later (e.g. user/stand), update this gate.
        const lineStat = String(line.stat || "").trim().toLowerCase();
        const selectedStat = String(base.statKey || "").trim().toLowerCase();
        const scope = getScope(selectedStat);

        if ((lineStat && selectedStat && lineStat !== selectedStat)
            && (lineStat != scope)) continue;
        if (line.optional && !selectedIds.has(String(line.id ?? ""))) continue;
        if (line.unique && blockedUniqueIds.has(String(line.id ?? ""))) continue;

        const operand = String(line.operand || "+").trim();
        const lineValue = Number(line.value ?? 0);
        if (!Number.isFinite(lineValue)) continue;

        const before = values[variable];
        // `variable === "stat"` means this line changes dice count directly.
        const after = applyOperand(before, operand, lineValue);
        if (!Number.isFinite(after)) continue;

        values[variable] = after;
        const sourceLabel = String(line.sourceName || "Custom").trim() || "Custom";
        traceTokens[variable].push(`${operand} ${lineValue} (${sourceLabel})`);
        appliedLines.push({
            id: line.id,
            sourceName: sourceLabel,
            stat: line.stat || "",
            optional: !!line.optional,
            unique: !!line.unique,
            variable,
            operand,
            value: lineValue,
            before,
            after
        });
    }

    const unclamped = {
        stat: values.stat,
        sides: values.sides,
        advantage: values.advantage,
        modifier: values.modifier
    };

    values.stat = Math.max(0, Math.floor(values.stat));
    values.sides = Math.max(1, Math.floor(values.sides));
    values.advantage = Math.max(0, Math.min(3, Math.floor(values.advantage)));
    values.modifier = Math.floor(values.modifier);

    const traceParts = [];
    if (traceTokens.stat.length > 1) traceParts.push(formatTrace("Stat", traceTokens.stat, unclamped.stat, values.stat));
    if (traceTokens.sides.length > 1) traceParts.push(formatTrace("Sides", traceTokens.sides, unclamped.sides, values.sides));
    if (traceTokens.advantage.length > 1) traceParts.push(formatTrace("Advantage", traceTokens.advantage, unclamped.advantage, values.advantage));
    if (traceTokens.modifier.length > 1) traceParts.push(formatTrace("Result", traceTokens.modifier, unclamped.modifier, values.modifier));

    return {
        // `values.stat` ends up as the X in XdY in the final constructed formula.
        formula: createFormula(values.stat, values.sides, values.advantage, values.modifier),
        values,
        appliedLines,
        customApplied: appliedLines.length > 0,
        customTooltip: traceParts.join(" | ")
    };
}

export async function executeRoll(formula) {
    const roll = new Roll(formula);
    await roll.evaluate();

    if (game.dice3d?.showForRoll) {
        try {
            await game.dice3d.showForRoll(roll, game.user, true);
        } catch (error) {
            console.warn("BAD6 | Dice So Nice roll display failed", error);
        }
    }

    return roll;
}

export function parseFormula(component, formula) {
    const map = {
        stat: /^(\d+)d/,      // first number before 'd'
        sides: /d(\d+)cs/,    // number between 'd' and 'cs'
        advantage: /cs>=(\d+)/,  // number after 'cs>='
        modifier: /\+ (\d+)$/    // number after '+'
    };
    const regex = map[component];
    const match = formula.match(regex);
    return match ? parseInt(match[1]) : null;
}

export function getScope(checkedStat) {
    for (const stat of USER_STATS) {
        if (checkedStat == stat) return "user"
    }
    for (const stat of ABILITY_STATS) {
        if (checkedStat == stat) return "ability"
    }
}
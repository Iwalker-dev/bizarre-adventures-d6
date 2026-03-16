 // {{!-- example formula: (@stat)d(@sides)cs>=(@advantage) + (@modifier) --}}

/* Exports:
createFormula(stat, sides, advantage, modifier) - creates a formula string based on the provided parameters
modifyFormula(formula, stat = null, sides = null, advantage = null, modifier = null, operands = []) - modifies an existing formula based on the provided parameters and operands
createRoll(formula) - creates a new Roll object based on the provided formula
parseFormula(component, formula) - parses a specific component (stat, sides, advantage, modifier) from the provided formula
*/

export function createFormula(stat, sides, advantage, modifier) {
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
                notifications.info.warn("Invalid operand: " + operand);
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
        let stat = String(line.stat || "").trim().toLowerCase();
        let variable = String(line.variable || "modifier").trim().toLowerCase();

        if (!stat && LEGACY_STAT_KEYS.has(variable)) {
            stat = variable;
            variable = "stat";
        }

        return {
            ...line,
            optional: !!line.optional,
            operand: String(line.operand || "+").trim() || "+",
            stat,
            variable,
            value: Number(line.value ?? 0)
        };
    });
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

export function applyFormulaLines(base = {}, lines = [], selectedOptionalIds = []) {
    const selectedIds = new Set((selectedOptionalIds || []).map(String));
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

        const lineStat = String(line.stat || "").trim().toLowerCase();
        const selectedStat = String(base.statKey || "").trim().toLowerCase();
        if (lineStat && selectedStat && lineStat !== selectedStat) continue;
        if (line.optional && !selectedIds.has(String(line.id ?? ""))) continue;

        const operand = String(line.operand || "+").trim();
        const lineValue = Number(line.value ?? 0);
        if (!Number.isFinite(lineValue)) continue;

        const before = values[variable];
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
        formula: createFormula(values.stat, values.sides, values.advantage, values.modifier),
        values,
        appliedLines,
        customApplied: appliedLines.length > 0,
        customTooltip: traceParts.join(" | ")
    };
}

export async function executeRoll(formula) {
    const roll = new Roll(formula);
    await roll.evaluate({ async: true });

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
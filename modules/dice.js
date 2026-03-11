 // {{!-- example formula: (@stat)d(@sides)cs>=(@advantage) + (@modifier) --}}
export function createFormula(stat, sides, advantage, modifier) {
  return `${stat}d${sides}cs>=${advantage} + ${modifier}`;
}

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

export function createRoll(formula) {
  return new Roll(formula);
}

function parseFormula(component, formula) {
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
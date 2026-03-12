 // {{!-- example formula: (@stat)d(@sides)cs>=(@advantage) + (@modifier) --}}

/* Exports:
createFormula(stat, sides, advantage, modifier) - creates a formula string based on the provided parameters
modifyFormula(formula, stat = null, sides = null, advantage = null, modifier = null, operands = []) - modifies an existing formula based on the provided parameters and operands
createRoll(formula) - creates a new Roll object based on the provided formula
parseFormula(component, formula) - parses a specific component (stat, sides, advantage, modifier) from the provided formula
*/

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

export function executeRoll(formula) {
    const roll = new Roll(formula);
    roll.evaluate({ async: true });
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
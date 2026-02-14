/**
 * dice.js
 * Helpers to assemble and prepare roll formulas based on actor/item formula lines.
 *
 * Exports:
 *   - prepareFormula(actor, baseFormula, statLabel, advantage, data, useFudge, useGambitForFudge)
 *
 * Behavior:
 *   - Scans the actor's items for `system.formula.lines` arrays (normalizes object -> array)
 *   - Builds additional arithmetic terms from each line (operand, variable/value)
 *   - Tries to resolve variables from the actor's roll data, falling back to `line.value` or 0
 *   - Returns a final Roll-compatible formula string and whether Fudge was selected
 *   - Includes Fudge luck move handling as a special formula modifier
 */

import { showOptionalFormulaDialog } from "./dialog.js";

export async function prepareFormula(actor, baseFormula, statKey, statLabel, advantage, data, useFudge = false, useGambitForFudge = false, showFudge = true, fudgeLockReason = "") {
	try {
		if (!actor || !baseFormula) return { formula: baseFormula, useFudge: false };

		const lines = [];
		const collectFromActor = (act) => {
			for (const item of act.items) {
				const formula = item?.system?.formula;
				if (!formula) continue;
				let lns = formula.lines;
				if (!Array.isArray(lns) && lns && typeof lns === 'object') lns = Object.values(lns);
				if (!lns || !lns.length) continue;
				for (const line of lns) {
					if (!line) continue;
					lines.push({ line, itemName: item.name, actorName: act.name });
				}
			}
		};

		collectFromActor(actor);
		// Include linked actor items/hits if present
		const linked = actor.system?.bio?.linkedActors?.value || [];
		if (Array.isArray(linked) && linked.length) {
			for (const ln of linked) {
				try {
					const linkedActor = await fromUuid(ln.uuid);
					if (linkedActor) collectFromActor(linkedActor);
				} catch (e) {
					// ignore missing linked actor
				}
			}
		}

		// Filter lines: include only those that are global (no stat) or match the current statKey
		const statKeyLc = (statKey || '').toString().toLowerCase();
		const relevant = lines.filter(x => {
			const lineStat = (x.line?.stat || '').toString().toLowerCase();
			return !lineStat || (statKeyLc && lineStat === statKeyLc);
		});

		const required = relevant.filter(x => !x.line?.optional);
		const optionalLines = relevant.filter(x => !!x.line?.optional);

		// Helper to apply operand semantics
		const applyOperand = (cur, op, val) => {
			val = Number(val) || 0;
			switch (op) {
				case '+': return cur + val;
				case '-': return cur - val;
				case '*': return Math.max(0, Math.round(cur * val));
				case '/': return Math.round(cur / (val || 1));
				case '=': return val;
				default: return cur + val;
			}
		};

		const computeAdvantageFromLines = (linesToUse) => {
			let advFromLines = 0;
			for (const obj of linesToUse) {
				const line = obj.line;
				const variable = (line?.variable || '').toString().toLowerCase();
				if (variable !== 'advantage') continue;
				const val = resolveVariableValue(line, data, statKey, statLabel, advantage);
				const op = (line?.operand || '+').toString();
				advFromLines = applyOperand(advFromLines, op, val);
			}
			return Number(advFromLines) + Number(advantage || 0);
		};

		let chosenOptionalIndices = [];
		let useFudgeSelected = !!useFudge;
		let useGambitSelected = !!useGambitForFudge;
		const hasFudgeLock = !!fudgeLockReason;
		if (optionalLines.length || showFudge) {
			const dialogResult = await showOptionalFormulaDialog({
				required,
				optionalLines,
				showFudge,
				useFudgeSelected,
				hasFudgeLock,
				fudgeLockReason,
				actor,
				gambitDefault: useGambitSelected,
				computeAdvantageFromLines
			});
			if (dialogResult === null) return null;
			chosenOptionalIndices = dialogResult.chosenOptionalIndices || [];
			useFudgeSelected = !!dialogResult.useFudgeSelected;
			useGambitSelected = !!dialogResult.useGambitSelected;
		}
		const chosenSet = new Set(chosenOptionalIndices);
		const selected = [
			...required,
			...optionalLines.filter((o, i) => chosenSet.has(i))
		];

		// Parse base formula for stat, sides, and cs threshold if present
		let statVal = null;
		let sidesVal = null;
		let baseThreshold = null;
		const diceMatch = /([0-9]+)\s*d\s*([0-9]+)/i.exec(baseFormula);
		const csMatch = /cs\s*>=\s*([0-9]+)/i.exec(baseFormula);
		if (diceMatch) {
			statVal = Number(diceMatch[1]);
			sidesVal = Number(diceMatch[2]);
		}
		if (csMatch) baseThreshold = Number(csMatch[1]);

		// Fall back to data if not parsed
		if (statVal === null) {
			const found = findValueInData(data, statKey) ?? findValueInData(data, statLabel);
			statVal = Number(found) || 0;
		}
		if (sidesVal === null) sidesVal = Number(findValueInData(data, 'sides')) || 6;
		if (baseThreshold === null) baseThreshold = 5;

		let advFromLines = 0;
		let modifierVal = Number(findValueInData(data, 'modifier')) || 0;
		const extraTerms = [];

		for (const obj of selected) {
			const line = obj.line;
			const variable = (line?.variable || '').toString().toLowerCase();
			const val = resolveVariableValue(line, data, statKey, statLabel, advantage);
			const op = (line?.operand || '+').toString();

			if (variable === 'stat') {
				statVal = applyOperand(statVal, op, val);
				statVal = Math.max(0, Math.round(statVal));
			} else if (variable === 'sides') {
				sidesVal = applyOperand(sidesVal, op, val);
				sidesVal = Math.max(2, Math.round(sidesVal));
			} else if (variable === 'advantage') {
				advFromLines = applyOperand(advFromLines, op, val);
			} else if (variable === 'modifier') {
				modifierVal = applyOperand(modifierVal, op, val);
			} else {
				// Unknown/extra variable -> append as arithmetic term
				extraTerms.push(`${op}(${Number(val) || 0})`);
			}
		}

		let totalAdvantage = Number(advFromLines) + Number(advantage || 0);

		// Apply Fudge as +1 Advantage (cap at 3)
		if (useFudgeSelected && totalAdvantage < 3) {
			totalAdvantage += 1;
		}
		
		const adjustedThreshold = Math.max(0, baseThreshold - totalAdvantage);

		// Build final formula from parsed and adjusted pieces
		let finalFormula = `(${Math.max(0, Math.round(statVal))}d${Math.max(2, Math.round(sidesVal))}cs>=${adjustedThreshold})`;
		if (modifierVal) finalFormula += ` + (${modifierVal})`;
		if (extraTerms.length) finalFormula += ' ' + extraTerms.join(' ');

		return { formula: finalFormula, useFudge: useFudgeSelected, useGambitForFudge: useGambitSelected };
	} catch (err) {
		console.error('BAD6 | prepareFormula error', err);
		return { formula: baseFormula, useFudge: false };
	}
}

function resolveVariableValue(line, data, statKey, statLabel, advantage) {
	const variable = (line?.variable || '').toString();
	// Prefer an explicit numeric 'value'
	if (line?.value !== undefined && line?.value !== null && line?.value !== '') {
		const n = Number(line.value);
		if (!Number.isNaN(n)) return n;
	}
	if (variable === 'advantage') return Number(advantage || 0);
	if (variable === 'stat') {
		// try finding the stat value by key first, then label
		let found = findValueInData(data, statKey);
		if (typeof found !== 'number') found = findValueInData(data, statLabel);
		if (typeof found === 'number') return found;
	}
	// Search for the variable name in the provided roll data
	const found = findValueInData(data, variable);
	if (typeof found === 'number') return found;
	// Fallback to 0
	return 0;
}

function findValueInData(obj, key) {
	if (!obj || !key) return undefined;
	const lk = key.toString().toLowerCase();
	const stack = [obj];
	const seen = new Set();
	while (stack.length) {
		const cur = stack.pop();
		if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
		seen.add(cur);
		for (const [k, v] of Object.entries(cur)) {
			if (k.toString().toLowerCase() === lk) {
				if (typeof v === 'number') return v;
				if (v && typeof v === 'object' && typeof v.value === 'number') return v.value;
			}
			if (v && typeof v === 'object') stack.push(v);
		}
	}
	return undefined;
}

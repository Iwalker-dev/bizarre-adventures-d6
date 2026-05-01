/**
 * Tests for dice.js pure functions.
 *
 * Run with:  node --test tests/dice.test.mjs
 *       or:  node --test tests/
 */

import './shims/foundry.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    createFormula,
    parseFormula,
    normalizeFormulaLines,
    applyFormulaLines,
    modifyFormula
} from '../modules/dice.js';

// ---------------------------------------------------------------------------
// createFormula
// ---------------------------------------------------------------------------

describe('createFormula', () => {
    it('produces the canonical formula shape', () => {
        assert.equal(createFormula(3, 6, 0, 0), '3d6cs>=5 + 0');
    });

    it('subtracts advantage from the success threshold', () => {
        assert.equal(createFormula(4, 6, 2, 1), '4d6cs>=3 + 1');
    });

    it('maps stat 6 (infinite) to 10 dice', () => {
        assert.equal(createFormula(6, 6, 0, 0), '10d6cs>=5 + 0');
    });

    it('handles max advantage of 3 (threshold 2)', () => {
        assert.equal(createFormula(2, 8, 3, 0), '2d8cs>=2 + 0');
    });

    it('handles a non-zero modifier', () => {
        assert.equal(createFormula(1, 6, 0, 3), '1d6cs>=5 + 3');
    });
});

// ---------------------------------------------------------------------------
// parseFormula
// ---------------------------------------------------------------------------

describe('parseFormula', () => {
    const formula = '4d8cs>=3 + 2';

    it('parses stat (die count)', () => {
        assert.equal(parseFormula('stat', formula), 4);
    });

    it('parses sides (die size)', () => {
        assert.equal(parseFormula('sides', formula), 8);
    });

    it('parses the raw success threshold stored after cs>=', () => {
        // advantage=2 → threshold = 5-2 = 3
        assert.equal(parseFormula('advantage', formula), 3);
    });

    it('parses modifier', () => {
        assert.equal(parseFormula('modifier', formula), 2);
    });

    it('returns null when the component is absent', () => {
        assert.equal(parseFormula('stat', 'invalid string'), null);
    });

    it('round-trips with createFormula', () => {
        const f = createFormula(5, 6, 1, 2);
        assert.equal(parseFormula('stat', f), 5);
        assert.equal(parseFormula('sides', f), 6);
        assert.equal(parseFormula('advantage', f), 4);   // threshold: 5-1=4
        assert.equal(parseFormula('modifier', f), 2);
    });
});

// ---------------------------------------------------------------------------
// normalizeFormulaLines
// ---------------------------------------------------------------------------

describe('normalizeFormulaLines', () => {
    it('returns an empty array for empty input', () => {
        assert.deepEqual(normalizeFormulaLines([]), []);
    });

    it('returns an empty array when called with no argument', () => {
        assert.deepEqual(normalizeFormulaLines(), []);
    });

    it('converts a legacy object-shaped input (Foundry index-keyed object) to an array', () => {
        const result = normalizeFormulaLines({ 0: { variable: 'modifier', value: 1, operand: '+' } });
        assert.equal(result.length, 1);
        assert.equal(result[0].variable, 'modifier');
    });

    it('promotes legacy stat keys: variable="power" becomes stat="power", variable="stat"', () => {
        const result = normalizeFormulaLines([{ variable: 'power', value: 2, operand: '+' }]);
        assert.equal(result[0].stat, 'power');
        assert.equal(result[0].variable, 'stat');
    });

    it('does not promote a non-legacy variable name', () => {
        const result = normalizeFormulaLines([{ variable: 'modifier', value: 1 }]);
        assert.equal(result[0].variable, 'modifier');
        assert.equal(result[0].stat, '');
    });

    it('defaults optional to false when absent', () => {
        const result = normalizeFormulaLines([{ variable: 'modifier', value: 1 }]);
        assert.equal(result[0].optional, false);
    });

    it('preserves optional: true when present', () => {
        const result = normalizeFormulaLines([{ variable: 'modifier', value: 1, optional: true }]);
        assert.equal(result[0].optional, true);
    });

    it('defaults operand to "+" when absent', () => {
        const result = normalizeFormulaLines([{ variable: 'modifier', value: 1 }]);
        assert.equal(result[0].operand, '+');
    });

    it('normalizes value to a number', () => {
        const result = normalizeFormulaLines([{ variable: 'modifier', value: '3' }]);
        assert.equal(typeof result[0].value, 'number');
        assert.equal(result[0].value, 3);
    });
});

// ---------------------------------------------------------------------------
// applyFormulaLines
// ---------------------------------------------------------------------------

describe('applyFormulaLines', () => {
    // Re-usable base for most tests
    const base = { stat: 3, sides: 6, advantage: 0, modifier: 0, statKey: 'body' };

    it('returns the base formula unchanged when lines is empty', () => {
        const result = applyFormulaLines(base, []);
        assert.equal(result.formula, '3d6cs>=5 + 0');
        assert.equal(result.customApplied, false);
        assert.equal(result.appliedLines.length, 0);
    });

    it('applies a modifier addition', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '+', value: 2, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.modifier, 2);
        assert.equal(result.customApplied, true);
    });

    it('skips an optional line that is not in selectedOptionalIds', () => {
        const lines = [{ id: 'opt1', variable: 'modifier', operand: '+', value: 5, stat: '', optional: true }];
        const result = applyFormulaLines(base, lines, []);
        assert.equal(result.values.modifier, 0);
    });

    it('applies an optional line when its id is in selectedOptionalIds', () => {
        const lines = [{ id: 'opt1', variable: 'modifier', operand: '+', value: 5, stat: '', optional: true }];
        const result = applyFormulaLines(base, lines, ['opt1']);
        assert.equal(result.values.modifier, 5);
    });

    it('skips a line whose stat does not match base.statKey', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '+', value: 3, stat: 'speed', optional: false }];
        const result = applyFormulaLines(base, lines);   // base.statKey = 'body'
        assert.equal(result.values.modifier, 0);
    });

    it('applies a line whose stat matches base.statKey', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '+', value: 3, stat: 'body', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.modifier, 3);
    });

    it('applies a line with no stat filter to any statKey', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '+', value: 1, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.modifier, 1);
    });

    it('clamps advantage to a maximum of 3', () => {
        const lines = [{ id: 'a', variable: 'advantage', operand: '+', value: 10, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.advantage, 3);
    });

    it('clamps stat to a minimum of 0', () => {
        const lines = [{ id: 'a', variable: 'stat', operand: '-', value: 999, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.stat, 0);
    });

    it('clamps sides to a minimum of 1', () => {
        const lines = [{ id: 'a', variable: 'sides', operand: '-', value: 999, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.sides, 1);
    });

    it('uses = operand to set a value directly (ignores base)', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '=', value: 7, stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.equal(result.values.modifier, 7);
    });

    it('produces a customTooltip when lines are applied', () => {
        const lines = [{ id: 'a', variable: 'modifier', operand: '+', value: 2, sourceName: 'Trait', stat: '', optional: false }];
        const result = applyFormulaLines(base, lines);
        assert.match(result.customTooltip, /Trait/);
    });

    it('returns an empty customTooltip when no lines are applied', () => {
        const result = applyFormulaLines(base, []);
        assert.equal(result.customTooltip, '');
    });
});

// ---------------------------------------------------------------------------
// modifyFormula  (operates on @-prefixed template strings)
// ---------------------------------------------------------------------------

describe('modifyFormula', () => {
    const template = '@statd@sidescs>=@advantage + @modifier';

    it('replaces all placeholders with base values when only formula is provided', () => {
        const result = modifyFormula(template, 3, 6, 5, 0);
        assert.equal(result, '3d6cs>=5 + 0');
    });

    it('keeps base values for omitted parameters', () => {
        // Only override stat; sides/advantage/modifier come from the formula placeholders
        // Note: @sides, @advantage, @modifier remain as-is because parseFormula cannot
        // parse the @-prefixed template — this documents the expected behavior.
        const result = modifyFormula(template, 4, null, null, null);
        assert.equal(result, '4d@sidescs>=@advantage + @modifier');
    });
});

/**
 * Tests for modules/apps/roller/roll-resolution.js pure functions.
 *
 * Run with:  node --test tests/roll-resolution.test.mjs
 *       or:  node --test tests/
 */

import './shims/foundry.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    reevaluateStoredRoll,
    updateRollHtmlFormula,
    updateRollHtmlTotal,
    getHitDCMeta,
    getContestResultLabel,
    getActionDCMeta
} from '../modules/apps/roller/roll-resolution.js';

// ---------------------------------------------------------------------------
// updateRollHtmlFormula
// ---------------------------------------------------------------------------

describe('updateRollHtmlFormula', () => {
    it('replaces the formula div content', () => {
        const html = '<div class="dice-formula">3d6cs>=5 + 0</div>';
        assert.equal(
            updateRollHtmlFormula(html, '5d6cs>=3 + 1'),
            '<div class="dice-formula">5d6cs>=3 + 1</div>'
        );
    });

    it('returns the input unchanged when it is not a string', () => {
        assert.equal(updateRollHtmlFormula(null, '5d6cs>=3 + 0'), null);
    });

    it('returns the html unchanged when the formula div is absent', () => {
        const html = '<div class="other">data</div>';
        assert.equal(updateRollHtmlFormula(html, 'new-formula'), html);
    });
});

// ---------------------------------------------------------------------------
// updateRollHtmlTotal
// ---------------------------------------------------------------------------

describe('updateRollHtmlTotal', () => {
    it('replaces the dice-total h4 content', () => {
        const html = '<h4 class="dice-total">2</h4>';
        assert.equal(
            updateRollHtmlTotal(html, 5),
            '<h4 class="dice-total">5</h4>'
        );
    });

    it('returns the input unchanged when it is not a string', () => {
        assert.equal(updateRollHtmlTotal(undefined, 5), undefined);
    });
});

// ---------------------------------------------------------------------------
// getHitDCMeta
// ---------------------------------------------------------------------------

describe('getHitDCMeta', () => {
    it('returns the label for 0', () => {
        const meta = getHitDCMeta(0);
        assert.equal(meta.label, '0 - None');
    });

    it('returns the label for a mid-range value', () => {
        const meta = getHitDCMeta(3);
        assert.equal(meta.label, '+3 - Serious');
    });

    it('clamps values above 7 to the max entry', () => {
        const meta7 = getHitDCMeta(7);
        const meta99 = getHitDCMeta(99);
        assert.equal(meta7.label, meta99.label);
    });

    it('clamps negative values to 0', () => {
        const metaN = getHitDCMeta(-5);
        const meta0 = getHitDCMeta(0);
        assert.equal(metaN.label, meta0.label);
    });

    it('with reactionReckless:true uses Math.abs of base before clamping', () => {
        const normal   = getHitDCMeta(-3);
        const reckless = getHitDCMeta(-3, { reactionReckless: true });
        // Without reckless, -3 clamps to 0. With reckless, abs(-3)=3.
        assert.notEqual(reckless.label, normal.label);
        assert.equal(reckless.label, getHitDCMeta(3).label);
    });

    it('includes a flavor string alongside the label', () => {
        const meta = getHitDCMeta(1);
        assert.ok(typeof meta.flavor === 'string');
    });
});

// ---------------------------------------------------------------------------
// getContestResultLabel
// ---------------------------------------------------------------------------

describe('getContestResultLabel', () => {
    it('returns base label when difference is not finite', () => {
        assert.equal(getContestResultLabel('Resolve', NaN, 'action'), 'Resolve');
    });

    it('prefixes "Action hits |" for action winner', () => {
        assert.equal(getContestResultLabel('Serious', 2, 'action'), 'Action hits | Serious');
    });

    it('prefixes "Reaction wins |" for reaction winner without reckless', () => {
        assert.equal(getContestResultLabel('None', 1, 'reaction'), 'Reaction wins | None');
    });

    it('prefixes "Reaction hits |" for reaction winner with reactionReckless', () => {
        assert.equal(
            getContestResultLabel('None', 1, 'reaction', { reactionReckless: true }),
            'Reaction hits | None'
        );
    });

    it('prefixes "Tie |" for a tie', () => {
        assert.equal(getContestResultLabel('None', 0, 'tie'), 'Tie | None');
    });

    it('returns a safe base label for an empty baseLabel', () => {
        const result = getContestResultLabel('', 2, 'action');
        assert.equal(result, 'Action hits | Resolve');
    });
});

// ---------------------------------------------------------------------------
// getActionDCMeta
// ---------------------------------------------------------------------------

describe('getActionDCMeta', () => {
    it('returns a result at index 0', () => {
        const meta = getActionDCMeta(0);
        assert.ok(typeof meta.label === 'string');
        assert.ok(meta.label.length > 0);
    });

    it('clamps to 15 for values above 15', () => {
        const meta15  = getActionDCMeta(15);
        const meta999 = getActionDCMeta(999);
        assert.equal(meta15.label, meta999.label);
    });

    it('clamps to 0 for negative values', () => {
        const metaN = getActionDCMeta(-5);
        const meta0 = getActionDCMeta(0);
        assert.equal(metaN.label, meta0.label);
    });

    it('floors decimal values', () => {
        const metaDec  = getActionDCMeta(3.9);
        const metaFloor = getActionDCMeta(3);
        assert.equal(metaDec.label, metaFloor.label);
    });
});

// ---------------------------------------------------------------------------
// reevaluateStoredRoll
// ---------------------------------------------------------------------------

describe('reevaluateStoredRoll', () => {
    // Build a minimal rollData that matches how Foundry serialises a roll.
    function makeRollData(results) {
        return {
            terms: [{
                modifiers: ['cs>=5'],
                results: results.map(r => ({
                    result: r,
                    active: true,
                    success: r >= 5,
                    failure: r < 5,
                    count: r >= 5 ? 1 : 0,
                    discarded: false
                })),
                total: results.filter(r => r >= 5).length
            }]
        };
    }

    it('returns null when formula is absent', () => {
        assert.equal(reevaluateStoredRoll(null, makeRollData([5, 3, 6])), null);
    });

    it('returns null when rollData is absent', () => {
        assert.equal(reevaluateStoredRoll('3d6cs>=5 + 0', null), null);
    });

    it('counts successes correctly with the original threshold', () => {
        // Dice: 5, 3, 6 → threshold 5 → two successes, modifier 0 → total 2
        const result = reevaluateStoredRoll('3d6cs>=5 + 0', makeRollData([5, 3, 6]));
        assert.equal(result.total, 2);
    });

    it('recounts successes when the threshold is lowered', () => {
        // Lower threshold from 5 to 3: 5, 3, 6 are all >=3 → three successes
        const result = reevaluateStoredRoll('3d6cs>=3 + 0', makeRollData([5, 3, 6]));
        assert.equal(result.total, 3);
    });

    it('adds the modifier to the success count', () => {
        const result = reevaluateStoredRoll('3d6cs>=5 + 2', makeRollData([5, 3, 6]));
        assert.equal(result.total, 4);   // 2 successes + 2 modifier
    });

    it('updates the formula and _formula fields in rollData', () => {
        const newFormula = '3d6cs>=3 + 0';
        const result = reevaluateStoredRoll(newFormula, makeRollData([5, 3, 6]));
        assert.equal(result.rollData.formula, newFormula);
        assert.equal(result.rollData._formula, newFormula);
    });

    it('does not mutate the original rollData', () => {
        const original = makeRollData([5, 3, 6]);
        const before = JSON.stringify(original);
        reevaluateStoredRoll('3d6cs>=3 + 0', original);
        assert.equal(JSON.stringify(original), before);
    });

    it('skips discarded dice when counting successes', () => {
        const rollData = {
            terms: [{
                modifiers: ['cs>=5'],
                results: [
                    { result: 6, active: false, discarded: true, count: 0 },
                    { result: 5, active: true, discarded: false, count: 1 },
                    { result: 3, active: true, discarded: false, count: 0 }
                ],
                total: 1
            }]
        };
        const result = reevaluateStoredRoll('3d6cs>=5 + 0', rollData);
        assert.equal(result.total, 1);   // discarded 6 is excluded
    });
});

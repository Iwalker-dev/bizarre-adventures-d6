/**
 * Tests for the Promise-returning dialog flows in dialog.js.
 *
 * renderDialog() wraps Foundry's v1 Dialog in `new Promise((resolve) => ...)`.
 * The shimmed Dialog in tests/shims/foundry.mjs mimics the real Dialog#submit
 * behavior: it invokes the pressed button's callback, then calls close()
 * immediately after — so a button callback must call resolve() *synchronously*
 * (no awaiting before resolve) or the close() handler's resolve(null) wins the
 * race first. See /memories/repo notes on this gotcha.
 *
 * Run with:  node --test tests/dialog.test.mjs
 */

import './shims/foundry.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderDialog } from '../modules/dialog.js';

// Minimal jQuery-like stub: only supports the chain dialog.js actually calls
// on the confirm callback's `html` argument for the gambit case.
function makeFakeHtml(dataset) {
    return {
        find: () => ({ data: (key) => dataset[key] ?? null })
    };
}

describe('renderDialog("gambit")', () => {
    const actors = [{ documentName: 'Actor', id: 'actor1', name: 'Test Actor', items: [] }];

    beforeEach(() => {
        Dialog.instances.length = 0;
    });

    it('resolves null when the user cancels', async () => {
        const pending = renderDialog('gambit', { actors, quadrantNum: 1 });

        // renderDialog awaits renderTemplateV1 before constructing the Dialog,
        // so wait a tick for the Dialog instance to exist before pressing a button.
        await Promise.resolve();
        const dialog = Dialog.instances.at(-1);
        dialog.pressButton('cancel');

        assert.equal(await pending, null);
    });

    it('resolves with the selected gambit when the user confirms', async () => {
        const pending = renderDialog('gambit', { actors, quadrantNum: 1 });

        await Promise.resolve();
        const dialog = Dialog.instances.at(-1);
        const html = makeFakeHtml({
            gambitName: 'Sneaky Plan',
            gambitMove: 'feint',
            actorId: 'actor1',
            itemId: 'item1'
        });
        dialog.pressButton('confirm', html);

        assert.deepEqual(await pending, {
            gambit: { name: 'Sneaky Plan', move: 'feint', actorId: 'actor1', itemId: 'item1' },
            itemId: 'item1',
            actorId: 'actor1'
        });
    });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
    readFileSync(new URL('../system.json', import.meta.url), 'utf8')
);

describe('system manifest compatibility', () => {
    it('keeps compatibility.maximum at the latest released Foundry generation', () => {
        assert.equal(manifest.compatibility.maximum, '14');
    });
});

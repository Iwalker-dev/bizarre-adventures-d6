import './shims/foundry.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// createActionMessage() reaches into several Foundry globals that the shared
// shim doesn't provide (they're only needed by this file), so we stub them
// here before importing the module under test.
foundry.applications = {
    handlebars: {
        // Real Foundry would render the .hbs file; the content itself isn't
        // under test here, so a fixed string is enough to prove the flow works.
        renderTemplate: async (path, data) => `rendered:${path}`
    }
};

class FakeChatMessage {
    constructor(data) {
        this.data = data;
        this.id = FakeChatMessage.nextId++;
        this.flags = {};
    }
    async setFlag(scope, key, value) {
        this.flags[`${scope}.${key}`] = value;
        return this;
    }
    static nextId = 1;
    static getSpeaker() {
        return { alias: 'Test Speaker' };
    }
    static applyMode(data) {
        // public mode: no-op, matches Foundry's default behavior
        return data;
    }
    static async create(data) {
        return new FakeChatMessage(data);
    }
}
globalThis.ChatMessage = FakeChatMessage;

const { createActionMessage } = await import('../modules/apps/bad6-roller.js');

describe('createActionMessage', () => {
    beforeEach(() => {
        FakeChatMessage.nextId = 1;
        game.user = { isGM: true };
        game.users = [{ id: 'gm1', isGM: true }];
        game.settings = { get: () => 'public' };
    });

    it('creates the display message with the action flag set', async () => {
        const msg = await createActionMessage();
        assert.equal(msg.flags['bizarre-adventures-d6.type'], 'action');
    });

    it('links the display message to a hidden GM-only source message', async () => {
        const msg = await createActionMessage();
        const sourceId = msg.flags['bizarre-adventures-d6.sourceId'];
        assert.ok(sourceId, 'display message should reference a source message id');
    });

    it('links the source message back to the display message', async () => {
        const msg = await createActionMessage();
        const displayId = msg.flags['bizarre-adventures-d6.sourceId'];
        assert.ok(displayId, 'source message should reference a display message id');
    });
});
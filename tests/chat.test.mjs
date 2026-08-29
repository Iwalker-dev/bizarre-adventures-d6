import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canViewerSeeQuadrant, shouldApplyVisibilityForAction } from '../modules/apps/roller/chat.js';

describe('shouldApplyVisibilityForAction', () => {
    it('treats flashback button presses as visibility updates', () => {
        assert.equal(shouldApplyVisibilityForAction('luck', 'flashback'), true);
        assert.equal(shouldApplyVisibilityForAction('luck', 'mulligan'), false);
    });
});

describe('canViewerSeeQuadrant', () => {
    it('defaults to visible when no visibility flag exists', () => {
        assert.equal(canViewerSeeQuadrant({ visibility: null, playerId: 'p1' }), true);
    });

    it('honors self-only visibility for non-owners', () => {
        assert.equal(
            canViewerSeeQuadrant({ visibility: { messageMode: 'self', playerId: 'p1' }, playerId: 'p2' }),
            false
        );
        assert.equal(
            canViewerSeeQuadrant({ visibility: { messageMode: 'self', playerId: 'p1' }, playerId: 'p1' }),
            true
        );
    });

    it('lets GMs see gm- or blind-only quadrants', () => {
        assert.equal(
            canViewerSeeQuadrant({ visibility: { messageMode: 'gm', playerId: 'p1' }, playerId: 'p2', isGM: true }),
            true
        );
        assert.equal(
            canViewerSeeQuadrant({ visibility: { messageMode: 'blind', playerId: 'p1' }, playerId: 'p2', isGM: true }),
            true
        );
    });
    
});



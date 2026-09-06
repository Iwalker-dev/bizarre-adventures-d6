/**
 * Minimal Foundry global stubs for the Node test runner.
 * Only stubs the globals actually exercised by the functions under test.
 * Import this file at the top of every test module.
 */

globalThis.ui = {
    notifications: {
        warn: () => {},
        error: () => {},
        info: () => {}
    }
};

globalThis.foundry = {
    utils: {
        deepClone: (obj) => structuredClone(obj)
    }
};

// Roll is referenced only in executeRoll (not under test) but importing dice.js
// references it as a runtime global, so a stub prevents ReferenceError if called.
globalThis.Roll = class Roll {
    constructor(formula) { this.formula = formula; }
};

// Other Foundry globals used by untested code paths — stubbed to avoid accidental
// ReferenceErrors if module-level code touches them.
globalThis.game = {};
globalThis.canvas = {};
globalThis.fromUuidSync = () => null;

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
    },
    applications: {
        handlebars: {
            // Real templates aren't compiled under Node; tests only care about the
            // data the dialog resolves with, not the rendered markup.
            renderTemplate: async () => "<div></div>"
        }
    }
};

// Mimics Foundry v1 Dialog#submit: invokes the button callback then calls
// this.close() SYNCHRONOUSLY right after, regardless of whether the callback
// is still pending (see repo memory: the resolve()-vs-close() race gotcha).
globalThis.Dialog = class Dialog {
    constructor(data, options = {}) {
        this.data = data;
        this.options = options;
        Dialog.instances.push(this);
    }
    render() { return this; }
    // Test helper (not part of the real Dialog API): simulates a user clicking
    // `buttonKey`, passing `html` to its callback, then firing close() right away.
    pressButton(buttonKey, html) {
        this.data.buttons[buttonKey]?.callback?.(html);
        this.data.close?.();
    }
};
// Every Dialog constructed during a test, most recent last — lets tests grab
// the instance a function-under-test created without it returning one.
globalThis.Dialog.instances = [];

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

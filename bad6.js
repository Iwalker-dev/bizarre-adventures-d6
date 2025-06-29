import { BAD6 } from "./modules/config.js";
import { setupStats } from "./modules/listenerFunctions.js";
import { registerHandlebarsHelpers } from "./modules/utils.js";
import { preloadHandlebarsTemplates } from "./modules/utils.js"; 
import { loadChartJS } from "./modules/objects/stat-chart-loader.js";
import { BAD6Roller } from './modules/apps/bad6-roller.js';

// Wait for Chart.js to load before initializing the system
Hooks.once("init", async () => {
    console.log("BAD6 Core System is Initializing");
    // Load Chart.js
    await loadChartJS();
    BAD6Roller();
    console.log("Chart.js has been loaded");
    // Dynamically import UserSheet and StandSheet after Chart.js is loaded
    const { UserSheet } = await import("./modules/sheets/user-actor-sheet.js");
    const { StandSheet } = await import("./modules/sheets/stand-actor-sheet.js");
    const { PowerSheet } = await import("./modules/sheets/power-actor-sheet.js");
    const { HitItemSheet } = await import("./modules/sheets/hit-item-sheet.js");
    const { DefaultItemSheet } = await import("./modules/sheets/default-item-sheet.js");

    // Global Configuration Object Setup
    CONFIG.BAD6 = BAD6;
    CONFIG.INIT = true;

    // Unregister core sheets
    Items.unregisterSheet("core", ItemSheet);
    Actors.unregisterSheet("core", ActorSheet);

    // Register custom sheets
    Actors.registerSheet("bizarre-adventures-d6", UserSheet, {
        types: ["user"],
        makeDefault: true
    });
    Actors.registerSheet("bizarre-adventures-d6", StandSheet, {
        types: ["stand"],
        makeDefault: true
    });
    Actors.registerSheet("bizarre-adventures-d6", PowerSheet, {
        types: ["power"],
        makeDefault: true
    });
    Items.registerSheet("bizarre-adventures-d6", HitItemSheet, {
        types: ["hit"],
        makeDefault: true
    });
    Items.registerSheet("bizarre-adventures-d6", DefaultItemSheet, {
        types: ["item"],
        makeDefault: true
    });

    // Register item types in the system
    CONFIG.Item.documentClasses = {
        hit: HitItemSheet,
        item: DefaultItemSheet
    };

    // Load Partial-Handlebar Files
    preloadHandlebarsTemplates();

    // Register Additional Handlebar Helpers
    registerHandlebarsHelpers();
});

Hooks.once("ready", async () => {
    // Release Initialization Lock
    CONFIG.INIT = false;

    // Only Run as GM
    if (!game.user.isGM) return;
});

setupStats();


import { BAD6 } from "./modules/config.js";
import { setupStats } from "./modules/listenerFunctions.js";
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from "./modules/utils.js"; 
import { loadChartJS } from "./modules/objects/stat-chart-loader.js";
import { rollerControl } from './modules/apps/bad6-roller.js';
import { HueShiftControl } from "./modules/apps/hue-shift.js";
import { outroControl } from './modules/apps/stylizedOutro.js';

Hooks.once("init", async () => {
    console.log("BAD6 Core System is Initializing");
    // Load Chart.js
    await loadChartJS();
    rollerControl();
    HueShiftControl();
    outroControl();


    await preloadHandlebarsTemplates();
    registerHandlebarsHelpers();

    Items.unregisterSheet("core", ItemSheet);
    Actors.unregisterSheet("core", ActorSheet);

    // Dynamically import and register all your sheets...
    const { UserSheet } = await import("./modules/sheets/user-actor-sheet.js");
    const { StandSheet } = await import("./modules/sheets/stand-actor-sheet.js");
    const { PowerSheet } = await import("./modules/sheets/power-actor-sheet.js");
    const { HitItemSheet } = await import("./modules/sheets/hit-item-sheet.js");
    const { DefaultItemSheet } = await import("./modules/sheets/default-item-sheet.js");

    CONFIG.BAD6  = BAD6;
    CONFIG.INIT  = true;



    Actors.registerSheet("bizarre-adventures-d6", UserSheet,     { types: ["user"], makeDefault: true });
    Actors.registerSheet("bizarre-adventures-d6", StandSheet,    { types: ["stand"], makeDefault: true });
    Actors.registerSheet("bizarre-adventures-d6", PowerSheet,    { types: ["power"], makeDefault: true });
    Items.registerSheet ( "bizarre-adventures-d6", HitItemSheet,  { types: ["hit"],  makeDefault: true });
    Items.registerSheet ( "bizarre-adventures-d6", DefaultItemSheet, { types: ["item"], makeDefault: true });

    CONFIG.Item.documentClasses = { hit: HitItemSheet, item: DefaultItemSheet };


    

    console.log("Chart.js has been loaded");
});

Hooks.once("ready", async () => {
    CONFIG.INIT = false;
    if (!game.user.isGM) return;
});

setupStats();

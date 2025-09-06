
import { BAD6 } from "./modules/config.js";
import { setupStats } from "./modules/listenerFunctions.js";
import { registerHandlebarsHelpers, preloadHandlebarsTemplates } from "./modules/utils.js"; 
import { loadChartJS } from "./modules/objects/stat-chart-loader.js";
import { rollerControl } from './modules/apps/bad6-roller.js';
import { HueShiftControl } from "./modules/apps/hue-shift.js";
import { outroControl } from './modules/apps/stylizedOutro.js';

import { UserSheet } from "./modules/sheets/user-actor-sheet.js";
import { StandSheet } from "./modules/sheets/stand-actor-sheet.js";
import { PowerSheet } from "./modules/sheets/power-actor-sheet.js";
import { HitItemSheet } from "./modules/sheets/hit-item-sheet.js";
import { DefaultItemSheet } from "./modules/sheets/default-item-sheet.js";

Hooks.once("init", async () => {
	console.log("BAD6 Core System is Initializing");
	Hooks.on("renderActorSheet", (app) => {
		console.log(`Rendered: ${app.actor.name}, Sheet: ${app.constructor.name}, Type: ${app.actor.type}`);
	});
	// Load Apps and Stat Chart
	await loadChartJS();
	rollerControl();
	HueShiftControl();
	outroControl();

	// Load helpers
	await preloadHandlebarsTemplates();
	registerHandlebarsHelpers();

	// Replace default sheet registry
	Items.unregisterSheet("core", ItemSheet);
	Actors.unregisterSheet("core", ActorSheet);
	CONFIG.BAD6 = BAD6;
	CONFIG.INIT = true;



	Actors.registerSheet("bizarre-adventures-d6", UserSheet, {
		types: ["user"]
		, makeDefault: true
	});
	Actors.registerSheet("bizarre-adventures-d6", StandSheet, {
		types: ["stand"]
		, makeDefault: true
	});
	Actors.registerSheet("bizarre-adventures-d6", PowerSheet, {
		types: ["power"]
		, makeDefault: true
	});
	Items.registerSheet("bizarre-adventures-d6", HitItemSheet, {
		types: ["hit"]
		, makeDefault: true
	});
	Items.registerSheet("bizarre-adventures-d6", DefaultItemSheet, {
		types: ["item"]
		, makeDefault: true
	});

	CONFIG.Item.documentClasses = {
		hit: HitItemSheet
		, item: DefaultItemSheet
	};
});

Hooks.once("ready", async () => {
	CONFIG.INIT = false;
	if (!game.user.isGM) return;
});

setupStats();


import { BAD6, isDebugEnabled } from "./modules/config.js";
import { setupStats } from "./modules/listenerFunctions.js";
import { registerHandlebarsHelpers, preloadHandlebarsTemplates, getVisibilityRoleChoices } from "./modules/utils.js"; 
import { rollerControl, registerChatListeners } from './modules/apps/bad6-roller.js';
import { registerSockets } from './modules/sockets.js';
import { HueShiftControl } from "./modules/apps/hue-shift.js";
import { outroControl } from './modules/apps/stylizedOutro.js';
import { migrateWorld } from "./modules/migration.js";

import { UserSheet } from "./modules/sheets/user-actor-sheet.js";
import { StandSheet } from "./modules/sheets/stand-actor-sheet.js";
import { PowerSheet } from "./modules/sheets/power-actor-sheet.js";
import { HitItemSheet } from "./modules/sheets/hit-item-sheet.js";
import { DefaultItemSheet } from "./modules/sheets/default-item-sheet.js";




Hooks.once("init", async () => {
	const refreshChatVisibility = () => ui.chat?.render(true);
	const roleChoices = getVisibilityRoleChoices();
	
	// Register settings first, before any code that might use them
	game.settings.register("bizarre-adventures-d6", "systemMigrationVersion", {
		name: "BAD6 System Migration Version",
		hint: "Tracks the last system version that completed migrations for this world.",
		scope: "world",
		config: false,
		type: String,
		default: "0.9.9"
	});

	game.settings.register("bizarre-adventures-d6", "welcomed", {
		name: "BAD6 Welcomed",
		hint: "Tracks whether the user has been welcomed to the system.",
		scope: "world",
		config: false,
		type: Boolean,
		default: true
	});

	game.settings.register("bizarre-adventures-d6", "debugLogs", {
		name: "BAD6 Debug Logs",
		hint: "Enable or disable debug logs for the BAD6 system.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	game.settings.register("bizarre-adventures-d6", "formulaVisibilityRole", {
		name: "Formula Visibility Role",
		hint: "Minimum user role required to see roll formulas in BAD6 chat cards.",
		scope: "world",
		config: true,
		type: Number,
		choices: roleChoices,
		default: CONST.USER_ROLES.GAMEMASTER,
		onChange: refreshChatVisibility
	});

	game.settings.register("bizarre-adventures-d6", "formulaVisibilityOwnerOverride", {
		name: "Formula Visibility Owner Override",
		hint: "Allow actor owners to see roll formulas even if their user role is below the formula visibility requirement.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
		onChange: refreshChatVisibility
	});

	game.settings.register("bizarre-adventures-d6", "actorNameVisibilityRole", {
		name: "Actor Name Visibility Role",
		hint: "Minimum user role required to see actor names in BAD6 chat cards.",
		scope: "world",
		config: true,
		type: Number,
		choices: roleChoices,
		default: CONST.USER_ROLES.PLAYER,
		onChange: refreshChatVisibility
	});

	game.settings.register("bizarre-adventures-d6", "actorNameVisibilityOwnerOverride", {
		name: "Actor Name Visibility Owner Override",
		hint: "Allow actor owners to see actor names even if their user role is below the actor-name visibility requirement.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true,
		onChange: refreshChatVisibility
	});

	game.system.migrateWorld = migrateWorld;

	if (isDebugEnabled()) {
		console.log("BAD6 Core System is Initializing");
		Hooks.on("renderActorSheet", (app) => {
			console.log(`Rendered: ${app.actor.name}, Sheet: ${app.constructor.name}, Type: ${app.actor.type}`);
		});
	}

	// Load Apps and Stat Chart
	rollerControl();
	HueShiftControl();
	outroControl();

	// Load helpers
	await preloadHandlebarsTemplates();
	registerHandlebarsHelpers();

	// Replace default sheet registry
	foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
	foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);


/*
	CONFIG.BAD6 = BAD6;
	CONFIG.INIT = true;
*/
	foundry.documents.collections.Actors.registerSheet("bizarre-adventures-d6", UserSheet, {
		types: ["user"]
		, makeDefault: true
	});
	foundry.documents.collections.Actors.registerSheet("bizarre-adventures-d6", StandSheet, {
		types: ["stand"]
		, makeDefault: true
	});
	foundry.documents.collections.Actors.registerSheet("bizarre-adventures-d6", PowerSheet, {
		types: ["power"]
		, makeDefault: true
	});
	foundry.documents.collections.Items.registerSheet("bizarre-adventures-d6", HitItemSheet, {
		types: ["hit"]
		, makeDefault: true
	});
	foundry.documents.collections.Items.registerSheet("bizarre-adventures-d6", DefaultItemSheet, {
		types: ["item"]
		, makeDefault: true
	});
});

Hooks.once("socketlib.ready", () => {
	registerSockets();
});

Hooks.once("ready", async () => {
	// Mark initilization complete 
	CONFIG.INIT = false;
	registerChatListeners();
	// Check for optional modules and provide relavant warnings
	if (!game.user.isGM) return;
	
	// Run migrations
	await migrateWorld();
	
	const lancerModule = game.modules.get("lancer-initiative");
	const libWrapperModule = game.modules.get("lib-wrapper");
	if (!lancerModule?.active) {
		ui.notifications.info("BAD6: Optional module Lancer Initiative is not active. Enable it for free-form combat initiative.");
	} else if (!libWrapperModule?.active) {
		ui.notifications.warn("BAD6: Optional module lib-wrapper is not active. Lancer Initiative will not function without it.");
	}
});

setupStats();

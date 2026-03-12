export function registerHandlebarsHelpers() {
	// Register custom and common helpers
	Handlebars.registerHelper("equals", (v1, v2) => v1 === v2);

	Handlebars.registerHelper("ifEquals", function(arg1, arg2, options) {
		return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
	});

	Handlebars.registerHelper("contains", function(array, value) {
		return Array.isArray(array) && array.includes(value);
	});

	Handlebars.registerHelper("concat", function(s1, s2, s3) {
		// Filter out the Handlebars options object (it's passed as the last parameter)
		const args = [];
		for (let i = 0; i < arguments.length - 1; i++) {
			if (typeof arguments[i] === 'string') args.push(arguments[i]);
		}
		return args.join('');
	});

	Handlebars.registerHelper("isGreater", (p1, p2) => p1 > p2);

	Handlebars.registerHelper("isEqualORGreater", (p1, p2) => p1 >= p2);

	Handlebars.registerHelper("ifOR", (c1, c2) => c1 || c2);

	Handlebars.registerHelper("doLog", value => console.log(value));

	Handlebars.registerHelper("toBoolean", str => str === "true");

	Handlebars.registerHelper("for", function(from, to, incr, content) {
		let result = "";
		for (let i = from; i < to; i += incr) result += content.fn(i);
		return result;
	});

	Handlebars.registerHelper("times", function(n, content) {
		let result = "";
		for (let i = 0; i < n; i++) result += content.fn(i);
		return result;
	});

	Handlebars.registerHelper("notEmpty", function(value) {
		if (value === 0 || value === "0") return true;
		if (value == null || value === "") return false;
		return true;
	});

	Handlebars.registerHelper("range", function(start, end) {
		const range = [];
		for (let i = start; i < end; i++) {
			range.push(i);
		}
		return range;
	});
	Handlebars.registerHelper("math", function(lvalue, operator, rvalue) {
		lvalue = parseFloat(lvalue);
		rvalue = parseFloat(rvalue);

		switch (operator) {
			case "+":
				return lvalue + rvalue;
			case "-":
				return lvalue - rvalue;
			case "*":
				return lvalue * rvalue;
			case "/":
				return rvalue !== 0 ? lvalue / rvalue : 0;
			default:
				return 0;
		}
	});
	Handlebars.registerHelper('getProperty', (obj, path) => {
		return foundry.utils.getProperty(obj, path);
	});
	Handlebars.registerHelper("getActor", (id) => game.actors.get(id));

	Handlebars.registerHelper("displayCount", function(value) {
    const count = Number(value ?? 0);
    return count > 1 ? count : "";
	});

	Handlebars.registerHelper("capitalize", function(value) {
		if (!value) return "";
		return String(value).charAt(0).toUpperCase() + String(value).slice(1);
	});
}

export async function preloadHandlebarsTemplates() {
	const templatePaths = [
    "systems/bizarre-adventures-d6/templates/actor/partials/actor-shell.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-nav.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-class.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-stats.hbs"

		,"systems/bizarre-adventures-d6/templates/item/partials/item-formula.hbs"

		, "systems/bizarre-adventures-d6/templates/chat/partials/quadrant.hbs"

		, "systems/bizarre-adventures-d6/templates/chat/action.hbs"
  
	, ];

	const [shellTpl, navTpl, classTpl, statsTp1, formulaTpl, quadrantTpl, actionTpl] = await foundry.applications.handlebars.loadTemplates(templatePaths);

	// Register based on hbs naming convention
	Handlebars.registerPartial("actor-shell", shellTpl);
	Handlebars.registerPartial("actor-nav", navTpl);
	Handlebars.registerPartial("actor-class", classTpl);
	Handlebars.registerPartial("actor-stats", statsTp1);
	Handlebars.registerPartial("item-formula", formulaTpl);
	Handlebars.registerPartial("roll-quadrant", quadrantTpl);
	Handlebars.registerPartial("action-card", actionTpl)
}

// Rolling related helpers

const BAD6_MODULE_ID = "bizarre-adventures-d6";
export const HIDDEN_ACTOR_NAME = "Hidden Actor";

export function getVisibilityRoleChoices() {
	return {
		[CONST.USER_ROLES.NONE]: "None",
		[CONST.USER_ROLES.PLAYER]: "Player",
		[CONST.USER_ROLES.TRUSTED]: "Trusted Player",
		[CONST.USER_ROLES.ASSISTANT]: "Assistant GM",
		[CONST.USER_ROLES.GAMEMASTER]: "Game Master"
	};
}

function getWorldSetting(settingKey, fallbackValue) {
	try {
		return game.settings.get(BAD6_MODULE_ID, settingKey);
	} catch (_error) {
		return fallbackValue;
	}
}

function userMeetsRoleThreshold(minimumRole = CONST.USER_ROLES.GAMEMASTER) {
	return Number(game.user?.role ?? CONST.USER_ROLES.NONE) >= Number(minimumRole);
}

function isActorOwner(actor, sourceUuid) {
	if (!game.user) return false;

	if (sourceUuid) {
		const sourceDoc = fromUuidSync(sourceUuid);
		if (sourceDoc?.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
			return true;
		}
		if (sourceDoc?.actor?.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
			return true;
		}
	}

	if (!actor) return false;
	return !!actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
}

function canViewActorData(actor, context, { roleSettingKey, ownerOverrideSettingKey, defaultRole, defaultOwnerOverride }) {
	if (game.user?.isGM) return true;

	const minimumRole = Number(getWorldSetting(roleSettingKey, defaultRole));
	const ownerOverride = !!getWorldSetting(ownerOverrideSettingKey, defaultOwnerOverride);
	const sourceUuid = context?.sourceUuid;

	if (ownerOverride && isActorOwner(actor, sourceUuid)) {
		return true;
	}

	return userMeetsRoleThreshold(minimumRole);
}



/**
 * Check whether the current user can see roll formulas for an actor.
 * @param {Actor|null} actor
 * @returns {boolean}
 */
export function canViewActorFormula(actor, context = {}) {
	return canViewActorData(actor, context, {
		roleSettingKey: "formulaVisibilityRole",
		ownerOverrideSettingKey: "formulaVisibilityOwnerOverride",
		defaultRole: CONST.USER_ROLES.GAMEMASTER,
		defaultOwnerOverride: true
	});
}

/**
 * Check whether the current user can see actor names for an actor.
 * @param {Actor|null} actor
 * @returns {boolean}
 */
export function canViewActorName(actor, context = {}) {
	return canViewActorData(actor, context, {
		roleSettingKey: "actorNameVisibilityRole",
		ownerOverrideSettingKey: "actorNameVisibilityOwnerOverride",
		defaultRole: CONST.USER_ROLES.PLAYER,
		defaultOwnerOverride: true
	});
}

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

		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-effects.hbs"

		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-header-blocks.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-nav.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-class.hbs"
    
		, "systems/bizarre-adventures-d6/templates/actor/partials/actor-stats.hbs"

		,"systems/bizarre-adventures-d6/templates/item/partials/item-formula.hbs"

		, "systems/bizarre-adventures-d6/templates/chat/partials/quadrant.hbs"

		, "systems/bizarre-adventures-d6/templates/chat/action.hbs"
  
	, ];

	const [shellTpl, effectsTpl, headerBlocksTpl, navTpl, classTpl, statsTp1, formulaTpl, quadrantTpl, actionTpl] = await foundry.applications.handlebars.loadTemplates(templatePaths);

	// Register based on hbs naming convention
	Handlebars.registerPartial("actor-shell", shellTpl);
	Handlebars.registerPartial("actor-effects", effectsTpl);
	Handlebars.registerPartial("actor-header-blocks", headerBlocksTpl);
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
export const BAD6_PRIVACY_VERSION = 2;

export function getCurrentRollMode() {
	// Foundry v13 can keep message mode in the chat control state rather than core.rollMode.
	if (typeof document !== "undefined") {
		const activeModeBtn = document.querySelector('button[data-action="messageMode"][aria-pressed="true"]');
		const mode = String(activeModeBtn?.dataset?.mode || "").trim().toLowerCase();
		if (mode === "gm") return "gmroll";
		if (mode === "blind") return "blindroll";
		if (mode === "self") return "selfroll";
		if (mode === "public" || mode === "ic") return "publicroll";
	}

	return String(game.settings.get("core", "rollMode") || "publicroll");
}

export function normalizeAudienceUserIds(userIds = []) {
	const ids = new Set();
	for (const id of userIds) {
		const safe = String(id || "").trim();
		if (!safe) continue;
		ids.add(safe);
	}
	return Array.from(ids);
}

export function getRollModeAudienceUserIds(rollMode, clickedByUserId = game.user?.id) {
	const mode = String(rollMode || "publicroll");
	const clickerId = String(clickedByUserId || game.user?.id || "").trim();
	const gmIds = game.users.filter((u) => u.isGM).map((u) => String(u.id));

	if (mode === "blindroll") {
		return normalizeAudienceUserIds(gmIds);
	}

	if (mode === "gmroll") {
		return normalizeAudienceUserIds([...gmIds, clickerId]);
	}

	if (mode === "selfroll") {
		return normalizeAudienceUserIds(clickerId ? [clickerId] : []);
	}

	return normalizeAudienceUserIds(game.users.map((u) => String(u.id)));
}

export function clampAudienceUserIds(parentAudienceUserIds = [], requestedAudienceUserIds = []) {
	const parent = normalizeAudienceUserIds(parentAudienceUserIds);
	const requested = new Set(normalizeAudienceUserIds(requestedAudienceUserIds));

	if (!parent.length) return Array.from(requested);
	return parent.filter((id) => requested.has(id));
}

export function canCurrentUserSeeAudience(audienceUserIds = [], userId = game.user?.id) {
	const currentUserId = String(userId || "").trim();
	if (!currentUserId) return false;
	const set = new Set(normalizeAudienceUserIds(audienceUserIds));
	return set.has(currentUserId);
}

export function buildClickMeta({ clickedByUserId, rollModeAtClick, parentAudienceUserIds = [] } = {}) {
	const userId = String(clickedByUserId || game.user?.id || "").trim();
	const mode = String(rollModeAtClick || getCurrentRollMode() || "publicroll");
	const requestedAudienceUserIds = getRollModeAudienceUserIds(mode, userId);
	const audienceUserIds = clampAudienceUserIds(parentAudienceUserIds, requestedAudienceUserIds);

	return {
		clickedByUserId: userId,
		rollModeAtClick: mode,
		audienceUserIds,
		timestamp: Date.now()
	};
}

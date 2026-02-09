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
}

export async function preloadHandlebarsTemplates() {
	const templatePaths = [
    "systems/bizarre-adventures-d6/templates/partials/actor-shell.hbs"
    
		, "systems/bizarre-adventures-d6/templates/partials/actor-nav.hbs"
    
		, "systems/bizarre-adventures-d6/templates/partials/actor-class.hbs"
    
		, "systems/bizarre-adventures-d6/templates/partials/actor-stats.hbs"

		,"systems/bizarre-adventures-d6/templates/partials/item-formula.hbs"
  
	, ];

	const [shellTpl, navTpl, classTpl, statsTp1, formulaTpl] = await foundry.applications.handlebars.loadTemplates(templatePaths);

	// Register based on hbs naming convention
	Handlebars.registerPartial("actor-shell", shellTpl);
	Handlebars.registerPartial("actor-nav", navTpl);
	Handlebars.registerPartial("actor-class", classTpl);
	Handlebars.registerPartial("actor-stats", statsTp1);
	Handlebars.registerPartial("item-formula", formulaTpl);
}

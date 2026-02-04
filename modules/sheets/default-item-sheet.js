export class DefaultItemSheet extends foundry.appv1.sheets.ItemSheet {
	/**
	 * Default options for the Default Item Sheet
	 */
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["bizarre-adventures-d6", "sheet", "item", "default"]
			, template: "systems/bizarre-adventures-d6/templates/sheets/default-item-sheet.hbs"
			, width: 400
			, height: 300
		, });
	}

	/**
	 * Get the data for the Default Item Sheet
	 */
	getData() {
		const data = super.getData();
		data.system = this.item.system;
		// Ensure formula exists and lines is an array; migrate older shapes when necessary
		data.system.formula = data.system.formula || { lines: [] };
		if (!Array.isArray(data.system.formula.lines)) {
			if (data.system.formula.lines && typeof data.system.formula.lines === 'object') {
				data.system.formula.lines = Object.values(data.system.formula.lines);
			} else {
				data.system.formula.lines = [];
			}
		}
		// Migrate individual lines to guaranteed shape
		const statKeys = new Set(["power","precision","speed","range","durability","learning","body","luck","menacing","pluck","reason","wit"]);
		data.system.formula.lines = data.system.formula.lines.map(line => {
			line = line || {};
			// If older data stored the stat in 'variable', migrate that
			if (!line.stat && line.variable && statKeys.has(line.variable)) {
				line.stat = line.variable;
				line.variable = 'stat';
			}
			line.optional = !!line.optional;
			line.operand = line.operand || '+';
			line.stat = line.stat || '';
			line.variable = line.variable || 'modifier';
			line.value = (line.value !== undefined && line.value !== null) ? line.value : 0;
			return line;
		});
		return data;
	}

	/**
	 * Attach listeners for add/remove buttons
	 */
	activateListeners(html) {
		super.activateListeners(html);
		html.find('.add-formula-line').on('click', this._onAddFormulaLine.bind(this));
		// delegate remove clicks because rows can be dynamic
		html.on('click', '.remove-formula-line', this._onRemoveFormulaLine.bind(this));
	}

	/**
	 * Add an empty default formula line and update the item
	 */
	async _onAddFormulaLine(event) {
		event?.preventDefault();
		const formula = foundry.utils.deepClone(this.item.system.formula || { lines: [] });
		// Normalize lines to an array (handle object storage)
		if (!Array.isArray(formula.lines)) {
			if (formula.lines && typeof formula.lines === 'object') formula.lines = Object.values(formula.lines);
			else formula.lines = [];
		}
		formula.lines.push({ optional: false, operand: '+', stat: '', variable: 'modifier', value: 0 });
		await this.item.update({ 'system.formula': formula });
		this.render();
	}

	/**
	 * Remove a formula line by index (data-index on the button)
	 */
	async _onRemoveFormulaLine(event) {
		event?.preventDefault();
		const idx = Number(event.currentTarget.dataset.index);
		if (Number.isNaN(idx)) return;
		const formula = foundry.utils.deepClone(this.item.system.formula || { lines: [] });
		// Normalize lines to an array (handle object storage)
		if (!Array.isArray(formula.lines)) {
			if (formula.lines && typeof formula.lines === 'object') formula.lines = Object.values(formula.lines);
			else formula.lines = [];
		}
		if (idx < 0 || idx >= formula.lines.length) return;
		formula.lines.splice(idx, 1);
		await this.item.update({ 'system.formula': formula });
		this.render();
	}
}

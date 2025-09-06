export class DefaultItemSheet extends ItemSheet {
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
		return data;
	}
}

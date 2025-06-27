export class HitItemSheet extends ItemSheet {
  /**
   * Default options for the Hit Item Sheet
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "item", "hit"],
      template: "systems/bizarre-adventures-d6/templates/sheets/hit-item-sheet.hbs",
      width: 400,
      height: 300,
    });
  }

  /**
   * Get the data for the Hit Item Sheet
   */
  getData() {
    const data = super.getData();
    data.system = this.item.system;
    return data;
  }

  /**
   * Activate listeners for the Hit Item Sheet
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Add custom logic for the Hit Item Sheet
    html.find("#update-hit").click(() => {
      const weight = parseFloat(html.find("#hit-weight").val()) || 0;
      const quantity = parseInt(html.find("#hit-quantity").val(), 10) || 0;

      if (weight > 0 && quantity > 0) {
        const damage = weight * quantity;
        this.item.update({
          "system.weight": weight,
          "system.quantity": quantity
        });

      } else {
        console.warn("Invalid hit data provided.");
      }
    });

  }
}
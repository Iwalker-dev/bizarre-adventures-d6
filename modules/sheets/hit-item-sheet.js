import { DefaultItemSheet } from "./default-item-sheet.js";

export class HitItemSheet extends DefaultItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["bizarre-adventures-d6", "sheet", "item", "hit"],
            template: "systems/bizarre-adventures-d6/templates/sheets/hit-item-sheet.hbs"
        });
    }
}
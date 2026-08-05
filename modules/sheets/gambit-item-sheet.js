import { DefaultItemSheet } from "./default-item-sheet.js";

export class GambitItemSheet extends DefaultItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["bizarre-adventures-d6", "sheet", "item", "gambit"],
            template: "systems/bizarre-adventures-d6/templates/item/gambit-item-sheet.hbs"
        });
    }
}
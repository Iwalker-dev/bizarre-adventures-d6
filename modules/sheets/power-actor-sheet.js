import { BaseActorSheet } from "./base-actor-sheet.js";
import { typeConfigs }    from "../config/actor-configs.js";
const mergeObject = foundry.utils.mergeObject;

export class PowerSheet extends BaseActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6","sheet","actor","power"],
      template: "systems/bizarre-adventures-d6/templates/sheets/power-actor-sheet.hbs",
      width: 800,
      height: 800,
      tabs: [{
        navSelector: ".sheet-tabs",
        contentSelector: "section.sheet-body",
        initial: "stats"
      }],
      submitOnChange: true,
      closeOnSubmit:  false
    });
  }

  /** Build statLabelMap so stats.hbs can pick up the custom labels */
  getData() {
    const data = super.getData();
    data.system      = this.actor.system;
    data.typeConfigs = typeConfigs.power;
    data.system.info = data.system.info || {};
    console.log("BAD6 | data.system.info.type", data.system.info.type);
    // If no type is saved yet, pretend we have one so the <select> shows it
    if (!data.system.info.type) {
      data.system.info.type = Object.keys(typeConfigs.power)[0];
    }

    data.extraConfig  = data.typeConfigs[data.system.info.type] || {};

    // Set description
    data.system.info.description = data.extraConfig.description || "";

    // —— NEW: statLabelMap —— 
    const keys = ['power','precision','speed','range','durability','learning'];
    data.statLabelMap = {};
    if (Array.isArray(data.extraConfig.statlabels)) {
      data.extraConfig.statlabels.forEach((lbl, idx) => {
        const key = keys[idx];
        if (key) data.statLabelMap[key] = lbl;
      });
    }
    // ————————————————

    data.getSelectedValue = stat => {
      const s = this.actor.system.attributes.stats[stat];
      return s[s.selected] || 0;
    };
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.renderStars(html);

    // Burn‐type toggles
    html.find(".switch-value").click(ev => {
      const { stat, value } = ev.currentTarget.dataset;
      this.actor.update({ [`system.attributes.stats.${stat}.selected`]: value });
    });

    // 1) Force the select to show the actual stored value
    const current = this.actor.system.info?.type;
    if (current) {
      html.find("#power-type").val(current);
    }
  }
}

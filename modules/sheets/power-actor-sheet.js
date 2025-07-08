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
      }]
    });
  }

  /** Build statLabelMap so stats.hbs can pick up the custom labels */
  getData() {
    const data = super.getData();
    data.system      = this.actor.system;
    data.typeConfigs = typeConfigs.power;
    data.system.info = data.system.info || {};
    data.extraConfig = data.typeConfigs[data.system.info.type] || {};

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

    // Handle Type dropdown changes
    html.find("#power-type").on("change", async ev => {
      const oldType = this.actor.system.info.type;
      const newType = ev.target.value;
      await this.actor.update({ "system.info.type": newType });

      // Remove old‐type extra fields
      const cleanup = {};
      (typeConfigs[oldType]?.fields||[]).forEach(f => cleanup[`system.extra.${f.key}`]=null);
      if (Object.keys(cleanup).length) await this.actor.update(cleanup);

      this.render();
    });

  const current = this.actor.system.info.type;
  if (!current) {
    const defaultType = Object.keys(typeConfigs.power)[0];
    // Write it back to the actor so future renders “remember”
    this.actor.update({ "system.info.type": defaultType }).then(() => {
      html.find("#power-type").val(defaultType);
    });
  }
  }
}

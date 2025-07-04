import { BaseActorSheet } from "./base-actor-sheet.js";
import { typeConfigs }    from "../config/actor-configs.js";

export class PowerSheet extends BaseActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "power"],
      template: "systems/bizarre-adventures-d6/templates/sheets/power-actor-sheet.hbs",
      width: 800,
      height: 800,
      tabs: [{
        navSelector: ".sheet-tabs",          // ← matches your <nav class="tabs">
        contentSelector: "section.sheet-body",
        initial: "stats"
      }]
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;
    data.typeConfigs = typeConfigs.power;

    // ensure info exists
    data.system.info = data.system.info || {};

    data.extraConfig = data.typeConfigs[data.system.info.type] || null;

    data.getSelectedValue = (stat) => {
      const statData = this.actor.system.attributes.stats[stat];
      return statData[statData.selected] || 0;
    };

    return data;
  }

  activateListeners(html) {
    // Let Foundry wire up the tabs for you
    super.activateListeners(html);

    // Render all of the “star” click‐to‐set listeners
    this.renderStars(html);

    // Handle any custom “switch-value” buttons you have (e.g. Burn vs Live, Original vs Temp, etc.)
    html.find(".switch-value").click(ev => {
      const button = ev.currentTarget;
      const stat     = button.dataset.stat;
      const valueType = button.dataset.value;
      // Toggle the selected sub-value on your actor’s stats
      this.actor.update({ [`system.attributes.stats.${stat}.selected`]: valueType });
    });
  }
   
}
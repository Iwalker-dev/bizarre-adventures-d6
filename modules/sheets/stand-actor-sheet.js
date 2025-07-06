import { BaseActorSheet } from "./base-actor-sheet.js";
import { typeConfigs }    from "../config/actor-configs.js";

export class StandSheet extends BaseActorSheet {
  static typeSpecificStats = {
    Independent: ["wit", "menacing"]
  };

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "stand"],
      template: "systems/bizarre-adventures-d6/templates/sheets/stand-actor-sheet.hbs",
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
    data.typeConfigs = typeConfigs.stand;

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

    // Handle Type dropdown changes
    html.find("#stand-type").on("change", async ev => {
      const oldType = this.actor.system.info.type;
      const newType = ev.target.value;
      await this.actor.update({ "system.info.type": newType });

      // Remove old‐type extra fields
      const cleanup = {};
      (typeConfigs[oldType]?.fields||[]).forEach(f => cleanup[`system.extra.${f.key}`]=null);
      if (Object.keys(cleanup).length) await this.actor.update(cleanup);

      this.render();
    });
   }

  async syncStatsForStand(newType) {
    const expected = StandSheet.typeSpecificStats[newType] || [];
    const current = this.actor.system.attributes?.stats || {};
    const updates = {};

    for (const stat of expected) {
      if (!current.hasOwnProperty(stat)) {
        updates[`system.attributes.stats.${stat}`] = {
          dtype: "Number",
          label: stat.charAt(0).toUpperCase() + stat.slice(1),
          value: 0,
          group: "sstats"
        };
      }
    }

    for (const stat in current) {
      if (!expected.includes(stat)) {
        updates[`system.attributes.stats.-=${stat}`] = null;
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.actor.update(updates);
    }
  }
}

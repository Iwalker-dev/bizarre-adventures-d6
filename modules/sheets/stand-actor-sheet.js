import { BaseActorSheet } from "./base-actor-sheet.js";
import { typeConfigs }    from "../config/actor-configs.js";

export class StandSheet extends BaseActorSheet {

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
      }],
      submitOnChange: true,
      closeOnSubmit:  false
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;
    data.typeConfigs = typeConfigs.stand;

    // ensure info exists
    data.system.info = data.system.info || {};

    data.extraConfig  = data.typeConfigs[data.system.info.type] || {};

    data.system.info.description = data.extraConfig.description || "";
    data.system.info.cost = data.extraConfig.cost || "";
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

     html.find("#stand-type").on("change", async ev => {
      const newType = ev.target.value;
      const updates = {};

      // 1) pull in your full map of stand‐type configs
      const configs = typeConfigs.stand;

      // 2) loop every entry in that map
      for (const [typeName, config] of Object.entries(configs)) {
        const statsArray = config.stats || [];
        if (typeName !== newType) {
          // if this isn’t the chosen type, remove those stats
          for (const stat of statsArray) {
            updates[`system.attributes.stats.${stat}`] = null;
          }
        } else {
          // if it is the chosen type, re-add with defaults
          for (const stat of statsArray) {
            updates[`system.attributes.stats.${stat}`] = {
              label: stat.charAt(0).toUpperCase() + stat.slice(1),
              dtype: "Number",
              value: 0,
              temp:  0,
              perm:  0
            };
          }
        }
      }

      await this.actor.update(updates);
      this.render();
    });


    // Handle Type dropdown changes
  const current = this.actor.system.info?.type;
  if (current) {
      html.find("#stand-type").val(current);
  }
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

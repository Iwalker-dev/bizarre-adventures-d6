import { StandSheet } from "./stand-actor-sheet.js";

export class PowerSheet extends StandSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "power"],
      template: "systems/bizarre-adventures-d6/templates/sheets/power-actor-sheet.hbs",
      width: 800,
      height: 600
    });
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.system = this.actor.system;

    // Add a helper to resolve the selected value for Burn-type stats
    data.getSelectedValue = (stat) => {
      const statData = this.actor.system.attributes.stats[stat];
      return statData[statData.selected] || 0;
    };

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Define the mapping of types to stat labels
    const statLabels = {
      Hamon: ['Strength (Power)', 'Accuracy (Precision)', 'Agility (Speed)', 'Conduction (Range)', 'Blocking (Durability)', 'Learning'],
      Vampire: ['Strength (Power)', 'Senses (Precision)', 'Reflex (Speed)', 'Bodily Control (Range)', 'Resilience (Durability)', 'Learning'],
      'Pillar Man': ['Strength (Power)', 'Senses (Precision)', 'Reflexes (Speed)', 'Bodily Control (Range)', 'Resilience (Durability)', 'Learning'],
      Spin: ['Mass (Power)', 'Control (Precision)', 'Velocity (Speed)', 'RPM (Range)', 'Sturdiness (Durability)', 'Learning'],
      'Armed Phenomenon': ['Strength (Power)', 'Accuracy (Precision)', 'Agility (Speed)', 'Evolution (Range)', 'Endurance (Durability)', 'Learning'],
      Cyborg: ['Tech Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning'],
      Other: ['Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning']
    };

    // Function to update stat labels based on the selected type
    const updateStatLabels = (type) => {
      const labels = statLabels[type] || statLabels.Other;
      html.find('[data-stat="power"] label').text(labels[0]);
      html.find('[data-stat="precision"] label').text(labels[1]);
      html.find('[data-stat="speed"] label').text(labels[2]);
      html.find('[data-stat="range"] label').text(labels[3]);
      html.find('[data-stat="durability"] label').text(labels[4]);
      html.find('[data-stat="learning"] label').text(labels[5]);
    };

    // Listen for changes in the dropdown
    html.find('#stand-type').on('change', (event) => {
      const selectedType = event.target.value;
      updateStatLabels(selectedType);
    });

    // Initialize labels on render
    const initialType = html.find('#stand-type').val();
    updateStatLabels(initialType);

    // Add event listeners for Burn-type stat switchers
    html.find(".switch-value").click(ev => {
      const button = ev.currentTarget;
      const stat = button.dataset.stat;
      const valueType = button.dataset.value;

      // Update the selected stat type and refresh the display
      this.actor.update({[`system.attributes.stats.${stat}.selected`]: valueType});
    });
  }
}
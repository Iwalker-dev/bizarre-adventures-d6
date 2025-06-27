export class StandSheet extends ActorSheet {
  static typeSpecificStats = {
    Independent: ["wit", "menacing"]
  };

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "stand"],
      template: "systems/bizarre-adventures-d6/templates/sheets/stand-actor-sheet.hbs",
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;

    data.getSelectedValue = (stat) => {
      const statData = this.actor.system.attributes.stats[stat];
      return statData[statData.selected] || 0;
    };

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".switch-value").click(ev => {
      const button = ev.currentTarget;
      const stat = button.dataset.stat;
      const valueType = button.dataset.value;

      this.actor.update({[`system.attributes.stats.${stat}.selected`]: valueType});
    });

    html.find('#stand-type').on('change', async (event) => {
      const newType = event.target.value;
      await this.actor.update({ "system.info.type": newType });
      await this.syncStatsForStand(newType);
    });

    this.renderStars(html);
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

  renderStars(html) {
    html.find(".stat-stars").each((_, container) => {
      const statKey = container.dataset.stat;
      const statParts = statKey.split("-");
      const statName = statParts[0];              // e.g., "learning"
      const valueType = statParts[1] || "value";  // e.g., "temp", "perm", or "value"

      const statData = this.actor.system.attributes.stats[statName];
      const value = statData?.[valueType] ?? 0;

      container.innerHTML = "";
      container.classList.toggle("infinite", value === 6);

      for (let i = 1; i <= 6; i++) {
        const star = document.createElement("span");
        star.classList.add("stat-star");
        if (i <= value) star.classList.add("filled");
        star.textContent = (i === 6 ? "✶" : "★");
        star.title = (i === 6)
          ? "∞ / Unmeasurable"
          : `Rank ${["E", "D", "C", "B", "A"][i - 1]}`;

        star.addEventListener("click", async () => {
          const newValue = (value === i) ? i - 1 : i;
          const path = `system.attributes.stats.${statName}.${valueType}`;
          await this.actor.update({ [path]: newValue });
          this.render(); // Refresh full sheet after stat update
        });

        container.appendChild(star);
      }
    });
  }
}

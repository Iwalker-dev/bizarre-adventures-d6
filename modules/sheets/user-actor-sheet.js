// systems/bizarre-adventures-d6/scripts/sheets/user-actor-sheet.js
import { BaseActorSheet } from "./base-actor-sheet.js";
import { typeConfigs }    from "../config/actor-configs.js";

export class UserSheet extends BaseActorSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:   ["bizarre-adventures-d6","sheet","actor","user"],
      template:  "systems/bizarre-adventures-d6/templates/sheets/user-actor-sheet.hbs",
      width:     800,
      height:    800,
      tabs: [{
        navSelector:    ".sheet-tabs",
        contentSelector:".sheet-body",
        initial:        "stats"
      }]
    });
  }

  /** @override */
  getData() {
    const data         = super.getData();
    data.system        = this.actor.system;
    data.system.info = data.system.info ?? {};
    data.system.info.type = data.system.info.type ?? "user";     
    data.typeConfigs   = typeConfigs.user;                                             // for <select> options
    data.extraConfig   = typeConfigs[data.system.info.type] || null;              // for {{> bio-extras}}

    // Helper to pick the right star-value sub-field
    data.getSelectedValue = stat => {
      const s = this.actor.system.attributes.stats[stat];
      return s?.[s.selected] ?? 0;
    };

    // Initialize health if missing
    this.actor.system.health ??= { min:0, max:0, value:0 };

    // Compute current HP based on Hit items
    const totalDamage = this.actor.items
      .filter(i => i.type==="hit")
      .reduce((sum,i)=>sum+(i.system.quantity||0),0);
    data.system.health.value = Math.max(
      this.actor.system.health.min,
      this.actor.system.health.max - totalDamage
    );

    return data;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Inject accent colors once
    const base   = game.user.color?.toString() || "#ffffff";
    const light  = this.lightenColor(base,  30);
    const dark   = this.lightenColor(base, -20);
    document.documentElement.style.setProperty("--accent-color", base);
    document.documentElement.style.setProperty("--accent-light", light);
    document.documentElement.style.setProperty("--accent-dark", dark);

    // Render all the stat-stars
    this.renderStars(html);

    // Handle Type dropdown changes
    html.find("#user-type").on("change", async ev => {
      const oldType = this.actor.system.info.type;
      const newType = ev.target.value;
      await this.actor.update({ "system.info.type": newType });

      // Remove old‐type extra fields
      const cleanup = {};
      (typeConfigs[oldType]?.fields||[]).forEach(f => cleanup[`system.extra.${f.key}`]=null);
      if (Object.keys(cleanup).length) await this.actor.update(cleanup);

      this.render();
    });

    // Health‐max changes
    html.find("input[name='system.health.max']").change(async ev => {
      const max = parseInt(ev.target.value);
      if (!Number.isNaN(max)) {
        await this.actor.update({ "system.health.max": max });
        this.render();
      }
    });

    // Create and delete Item entries
    html.find("#create-item").click(() => {
      this.actor.createEmbeddedDocuments("Item",[{
        name: "New Item", type:"item",
        system:{ weight:0, quantity:1 }
      }]);
    });
    html.find("#item-items").on("click",".delete-item",async ev=>{
      const id=$(ev.currentTarget).data("item-id");
      await this.actor.deleteEmbeddedDocuments("Item",[id]);
      this.render();
    });
    html.find("#item-items").on("click", "li", ev => {
  // If the click was on (or inside) the trash icon, bail out
  if ( $(ev.target).closest(".delete-item").length ) return;

  // Otherwise get the item ID from the <li> and open its sheet
  const id = $(ev.currentTarget).data("item-id");
  const item = this.actor.items.get(id);
  if ( item ) item.sheet.render(true);
  });

    // Create and delete Hit entries (and update health)
    const recalc = async () => this.render();
    html.find("#create-hit").click(async ()=>{
      await this.actor.createEmbeddedDocuments("Item",[{
        name:"New Hit",type:"hit",
        system:{ weight:1, quantity:1 }
      }]);
      recalc();
    });
    html.find("#hit-items").on("click",".delete-hit",async ev=>{
      const id=$(ev.currentTarget).data("item-id");
      await this.actor.deleteEmbeddedDocuments("Item",[id]);
      recalc();
    });
    html.find("#hit-items").on("click", "li", ev => {
  // If the click was on (or inside) the trash icon, bail out
  if ( $(ev.target).closest(".delete-hit").length ) return;
  // Otherwise get the item ID from the <li> and open its sheet
  const id = $(ev.currentTarget).data("item-id");
  const hit = this.actor.items.get(id);
  if ( hit ) hit.sheet.render(true);
});
  }

  /** Toggle Dark Determination on/off */
  async _onToggleDarkDetermination(event) {
    event.preventDefault();
    const ddActive = this.actor.getFlag("bizarre-adventures-d6", "darkDetermination") || false;
    const totalDamage = this.actor.items
        .filter(i => i.type==="hit")
        .reduce((sum,i)=>sum+(i.system.quantity||0),0);



    if (!ddActive) {
      await this.actor.setFlag("bizarre-adventures-d6","origDamage", totalDamage);
      // Store whatever the actor’s HP was before
      await this.actor.setFlag("bizarre-adventures-d6", "origHealth", {
        value: this.actor.system.health.value,
        max:   this.actor.system.health.max
      });
      
      // If we’re about to *activate* DD on a PC, check for owned Vampire actors
      if (!ddActive && this.actor.hasPlayerOwner) {
        const ownerUsers = game.users.filter(u =>
          !u.isGM &&
          this.actor.getUserLevel(u) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        );
        console.log("🔍 Owners of this actor:", ownerUsers.map(u=>u.name));

        const vampireActors = game.actors.filter(a => {
          if ( a.id === this.actor.id ) return false;  // skip self
          if ( !ownerUsers.some(u => a.getUserLevel(u) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) ) {
            return false;
          }
          const powerType = foundry.utils.getProperty(a, "system.info.type");
          return powerType === "Vampire";
        });

        if ( vampireActors.length ) {
          ui.notifications.warn("Reminder: A Vampire user may not activate Dark Determination.");
        }
      }

      // Switch into Dark Determination
      await this.actor.update({
        "system.health.value": -1,
        "system.health.max":   -1
      });

      await this.actor.setFlag("bizarre-adventures-d6", "darkDetermination", true);
    }
    else {
      // Restore the stored values and clear flags
      const orig = this.actor.getFlag("bizarre-adventures-d6", "origHealth");
      if (orig) {
        await this.actor.update({
          "system.health.value": orig.value,
          "system.health.max":   orig.max
        });
      }
      await this.actor.unsetFlag("bizarre-adventures-d6", "darkDetermination");
      await this.actor.unsetFlag("bizarre-adventures-d6", "origHealth");
    }
     await this.render(); 
  }
}

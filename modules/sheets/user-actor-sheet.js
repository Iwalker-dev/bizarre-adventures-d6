export class UserSheet extends ActorSheet {
  static statData = {
    body:     0,
    wit:      0,
    reason:   0,
    menacing: 0,
    pluck:    0,
    luck:     0
  };
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "user"],
      template: "systems/bizarre-adventures-d6/templates/sheets/user-actor-sheet.hbs",
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;

    // Add a helper to resolve the selected value for Burn-type stats
    data.getSelectedValue = (stat) => {
      const statData = this.actor.system.attributes.stats[stat];
      return statData[statData.selected] || 0;
    };

    // Ensure health data is initialized
    if (!this.actor.system.health) {
      this.actor.system.health = { max: 0, value: 0, current: 0 };
    }

    // Calculate total health damage from hits
    const totalDamage = this.actor.items
      .filter(item => item.type === "hit")
      .reduce((sum, item) => sum + (item.system.quantity ?? 0), 0);
    // Compute current health
    data.system.health.value = Math.max(this.actor.system.health.min, this.actor.system.health.max - totalDamage);

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Tab switching logic
    html.find(".tabs button").click(ev => {
      const tabId = ev.currentTarget.dataset.tab;

      // Deactivate all tabs and buttons
      html.find(".tabs button").removeClass("active");
      html.find(".tab-content").hide();

      // Activate the clicked button and its corresponding tab
      ev.currentTarget.classList.add("active");
      html.find(`#${tabId}`).show();
    });

    // Ensure the default tab is visible
    html.find(".tab-content#stats").show();

    // Helper function to update health value
    const updateHealthValue = async () => {
      const totalDamage = this.actor.items
        .filter(item => item.type === "hit")
        .reduce((sum, hit) => sum + (hit.system.damage || 0), 0);
      console.log("Total damage from hits:", totalDamage);
      const maxHP = this.actor.system.health.max || 0;
      const minHP = this.actor.system.health.min || 0;
      const newHP = Math.max(minHP, maxHP - totalDamage);

      await this.actor.update({ "system.health.value": newHP });
      this.render();
    };

    // Add logic for Hits tab
    html.find("#add-hit").click(async () => {
      const name = html.find("#hit-name").val();
      const weight = parseFloat(html.find("#hit-weight").val()) || 0;
      const quantity = parseInt(html.find("#hit-quantity").val(), 10) || 0;

      if (name && weight > 0 && quantity > 0) {
        const hitData = {
          name: name,
          type: "hit",
          data: {
            weight: weight,
            quantity: quantity
          }
        };

        await this.actor.createEmbeddedDocuments("Item", [hitData]);
        await updateHealthValue();
      } else {
        console.warn("Invalid hit data provided.");
      }
    });

    // Log initialization
    console.log("Listeners activated for UserSheet.");

    // ─────────────────────────────────────────────────────
    // Stat stars data & rendering logic
    // ─────────────────────────────────────────────────────

      // Render stars
  this.renderStars(html);
  /*
    // Update health dynamically based on hits
    const updateHealth = () => {
      const totalDamage = this.actor.items
        .filter(item => item.type === "hit")
        .reduce((sum, hit) => sum + (hit.system.damage || 0), 0);

      const newHealthValue = Math.max(0, this.actor.system.health.max - totalDamage);

      // Debugging health value changes
      console.log("Before update:", this.actor.system.health.value);
      console.log("Calculated new value:", newHealthValue);

      this.actor.update({ "system.health.value": newHealthValue }).then(() => {
        console.log("After update:", this.actor.system.health.value);
      });
    };
  */
const actorId = this.actor.id; //TODO move if working
  // Added edit button logic to open the hit's sheet
  html.find("#hit-items").on("click", ".edit-hit", (event) => {
    event.stopPropagation();
    const itemId = $(event.currentTarget).data("item-id");
    const actor = game.actors.get(actorId);
    const item = actor?.items.get(itemId);

    if (item) {
      item.sheet.render(true);
    } else {
      console.error("Edit failed. Hit not found for ID:", itemId);
    }
  });

  // Render hits from the actor's inventory
  const renderHits = () => {
    const hits = this.actor.items.filter(item => item.type === "hit");
    const hitList = html.find("#hit-items");
    hitList.empty();

    hits.forEach(hit => {
      const damage = hit.system.weight * hit.system.quantity;
      const listItem = `
        <li data-item-id="${hit.id}" style="background-color: rgba(0, 0, 0, 0.5); display: inline-block; padding: 10px; margin: 5px; cursor: pointer;">
          ${hit.name} - Weight: ${hit.system.weight}, Quantity: ${hit.system.quantity}, Damage: ${damage}
          <p style="margin: 5px 0; font-size: 0.9em; color: #ccc;">${hit.system.description || "No description provided."}</p>
          <button class="delete-hit" data-item-id="${hit.id}" style="margin-left: 10px;">Delete</button>
        </li>
      `;
      hitList.append(listItem);
    });
  };

  // Call renderHits on sheet render
  renderHits();

  // Simplified hit creation
  html.find("#create-hit").click(() => {
    const hitData = {
      name: "NewHit",
      type: "hit",
      system: {
        weight: 1,
        quantity: 1
      }
    };
    updateHealthValue();

    // Create the hit item in the actor's inventory
    this.actor.createEmbeddedDocuments("Item", [hitData]);
  });

   // Simplified item creation
  html.find("#create-item").click(() => {
    const itemData = {
      name: "NewItem",
      type: "item",
      system: {
        weight: 0,
        quantity: 1
      }
    };

    // Create the hit item in the actor's inventory
    this.actor.createEmbeddedDocuments("Item", [itemData]);
  });

  // Add click event listener for hits
  html.find('#hit-items li').on('click', function(event) {
    event.stopPropagation(); // Ensure the click event is not intercepted by child elements

    const itemId = $(this).data('item-id');
    console.log('Item ID:', itemId); // Log the retrieved item ID

    const actorId = html.closest('.sheet.actor-sheet').data('actor-id');
    console.log('Actor ID:', actorId); // Log the actor ID

    if (!actorId) {
      console.error('Actor ID is undefined');
      return;
    }

    const actor = game.actors.get(actorId);

    if (!actor) {
      console.error('Actor is undefined');
      return;
    }

    const hitItem = actor.items.get(itemId);

    if (hitItem) {
      hitItem.sheet.render(true);
    } else {
      console.error('Hit item not found');
    }
  });

  // Add click event listener for delete button
html.find("#hit-items").on("click", ".delete-hit", async (event) => {
  event.stopPropagation();
  const itemId = $(event.currentTarget).data("item-id");
  const actor = game.actors.get(actorId);

  if (!actor) return console.error("Actor not found");

  const item = actor.items.get(itemId);
  if (item) {
    await actor.deleteEmbeddedDocuments("Item", [itemId]);
    this.render(); // refresh UI
  } else {
    console.error("Delete failed. Hit not found for ID:", itemId);
  }
});

    // Log the actor's items collection
    console.log('Actor items before deletion:', actor.items);

    const hitItem = actor.items.get(itemId);
    if (hitItem) {
      console.log('Hit item found for deletion:', hitItem);
      actor.deleteEmbeddedDocuments('Item', [itemId]).then(() => {
        console.log('Hit item successfully deleted:', itemId);
        console.log('Actor items after deletion:', actor.items);
      }).catch(err => {
        console.error('Error occurred while deleting hit item:', err);
      });
    } else {
      console.error('Hit item not found for ID:', itemId);
    }
  });

  // Add event listener for max health input
  html.find("input[name='system.health.max']").change(async (ev) => {
    const newMax = parseInt(ev.target.value, 10);
    if (!isNaN(newMax)) {
      await this.actor.update({ "system.health.max": newMax });
      await updateHealthValue();
    }
  });

  // Add click event listener for items
  html.find('#item-items li').on('click', function(event) {
    event.stopPropagation(); // Ensure the click event is not intercepted by child elements

    const itemId = $(this).data('item-id');
    console.log('Item ID:', itemId); // Log the retrieved item ID

    const actorId = html.closest('.sheet.actor-sheet').data('actor-id');
    console.log('Actor ID:', actorId); // Log the actor ID

    if (!actorId) {
      console.error('Actor ID is undefined');
      return;
    }

    const actor = game.actors.get(actorId);

    if (!actor) {
      console.error('Actor is undefined');
      return;
    }

    const item = actor.items.get(itemId);

    if (item) {
      item.sheet.render(true);
    } else {
      console.error('Item not found');
    }
  });

  // Add click event listener for delete button in items
  html.find('.delete-item').on('click', function(event) {
    event.stopPropagation();

    const itemId = $(this).data('item-id');
    console.log('Delete button clicked. Item ID:', itemId);

    const actorId = html.closest('.sheet.actor-sheet').data('actor-id');
    console.log('Actor ID retrieved from sheet:', actorId);

    if (!actorId) {
      console.error('Actor ID is undefined');
      return;
    }

    const actor = game.actors.get(actorId);
    console.log('Actor object retrieved:', actor);

    if (!actor) {
      console.error('Actor is undefined');
      return;
    }

    // Log the actor's items collection
    console.log('Actor items before deletion:', actor.items);

    const item = actor.items.get(itemId);
    if (item) {
      console.log('Item found for deletion:', item);
      actor.deleteEmbeddedDocuments('Item', [itemId]).then(() => {
        console.log('Item successfully deleted:', itemId);
        console.log('Actor items after deletion:', actor.items);
      }).catch(err => {
        console.error('Error occurred while deleting item:', err);
      });
    } else {
      console.error('Item not found for ID:', itemId);
    }
  });

  // Add event listeners for Burn-type stat switchers
  html.find(".switch-value").click(ev => {
    const button = ev.currentTarget;
    const stat = button.dataset.stat;
    const valueType = button.dataset.value;

    // Update the displayed value based on the selected type
    const input = html.find(`input[name='system.attributes.stats.${stat}.value']`);
    const actorData = this.actor.system.attributes.stats[stat];
    input.val(actorData[valueType]);
  });
  }

  renderStars(html) {
    html.find(".stat-stars").each((_, container) => {
      const statKey = container.dataset.stat;
      container.innerHTML = "";
      const value = UserSheet.statData[statKey] || 0;

      container.classList.toggle("infinite", value === 6);

      for (let i = 1; i <= 6; i++) {
        const star = document.createElement("span");
        star.classList.add("stat-star");
        if (i <= value) star.classList.add("filled");
        star.textContent = (i === 6 ? "✶" : "★");

        star.title = (i === 6)
          ? "∞ / Unmeasurable"
          : `Rank ${["E", "D", "C", "B", "A"][i - 1]}`;

        star.addEventListener("click", () => {
          UserSheet.statData[statKey] = (UserSheet.statData[statKey] === i) ? i - 1 : i;
          this.renderStars(html); // Re-render stars
        });

        container.appendChild(star);
      }
    });
  }

  updateHitDamage() {
    const hits = this.actor.getFlag("bizarre-adventures-d6", "hits") || [];
    const hitList = this.element.find("#hit-list");
    hitList.empty();

    hits.forEach(hit => {
      const listItem = $(
        `<li>${hit.name} - Weight: ${hit.weight}, Quantity: ${hit.quantity} </br> Description: ${hit.description}</li>`
      );
      hitList.append(listItem);
    });
  }
}

  // ─────────────────────────────────────────────────────
  // Color variable injection for CSS
  // ─────────────────────────────────────────────────────
  function lightenColor(hex, percent) {
    if (typeof hex !== "string" || !hex.startsWith("#")) {
      console.warn("Invalid hex color provided:", hex);
      hex = "#ffffff"; // Default to white if the color is invalid
    }

    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R}, ${G}, ${B})`;
  }

  // Convert game.user.color to a hex string
  const baseAccent = game.user?.color?.toString() || "#ffffff"; // Convert Color object to hex string
  const lightAccent = lightenColor(baseAccent, 30);
  const darkAccent = lightenColor(baseAccent, -20);

  document.documentElement.style.setProperty("--accent-color", baseAccent);
  document.documentElement.style.setProperty("--accent-light", lightAccent);
  document.documentElement.style.setProperty("--accent-dark", darkAccent);

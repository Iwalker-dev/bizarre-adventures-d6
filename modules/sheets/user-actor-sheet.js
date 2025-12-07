  // systems/bizarre-adventures-d6/scripts/sheets/user-actor-sheet.js
  import { BaseActorSheet } from "./base-actor-sheet.js";
  import { typeConfigs }    from "../config.js";

  /**
   * The UserSheet class manages the actor sheet for 'user' type actors.
   * @extends BaseActorSheet
   */
  export class UserSheet extends BaseActorSheet {
  	/**
  	 * Track total damage for Dark Determination calculations.
  	 * @type {number}
  	 */
  	static totalDamage = 0; // for Dark Determination

  	/**
  	 * Provide default configuration options for the user sheet.
  	 * @override
  	 * @returns {object} Merged options including template path, size, and tabs.
  	 */
  	static get defaultOptions() {
  		return foundry.utils.mergeObject(super.defaultOptions, {
  			classes: ["bizarre-adventures-d6", "sheet", "actor", "user"]
  			, template: "systems/bizarre-adventures-d6/templates/sheets/user-actor-sheet.hbs"
  			, width: 800
  			, height: 900
  			, tabs: [{
  				navSelector: ".sheet-tabs"
  				, contentSelector: ".sheet-body"
  				, initial: "stats"
        }]
  		});
  	}

  	/**
  	 * Prepare data context for rendering the sheet template.
  	 * Recalculates health based on hits and Dark Determination state.
  	 * @override
  	 * @returns {object} Data used by the sheet template.
  	 */
  	getData() {
  		const data = super.getData();
  		data.system = this.actor.system;
  		data.system.info = data.system.info ?? {};
  		data.system.info.type = data.system.info.type ?? "user";
  		data.typeConfigs = typeConfigs.user; // Options for <select>
		data.extraConfig = data.typeConfigs[data.system.info.type] || {};
		data.darkDetermination = !!this.actor.getFlag("bizarre-adventures-d6", "darkDetermination");  		data.system.info.description = data.extraConfig.description || "";
  		data.system.info.cost = data.extraConfig.cost || "";
  		data.getSelectedValue = (stat) => {
  			const statData = this.actor.system.attributes.stats[stat];
  			return statData[statData.selected] || 0;
  		};

  		// Helper to select the correct stat sub-value
  		data.getSelectedValue = stat => {
  			const s = this.actor.system.attributes.stats[stat];
  			return s?.[s.selected] ?? 0;
  		};

  		// Recalculate health normally when Dark Determination is inactive
  		if (!data.darkDetermination) {
  			const totalDamage = this.actor.items
  				.filter(i => i.type === "hit")
  				.reduce((sum, i) => sum + (i.system.quantity || 0), 0);
  			const maxHP = this.actor.system.health.max;
  			data.system.health.value = Math.max(
  				this.actor.system.health.min
  				, maxHP - totalDamage
  			);
  		} else {
  			// Dark Determination health overrides
  			const orig = this.actor.getFlag("bizarre-adventures-d6", "origDamage") || 0;
  			const now = this.actor.items
  				.filter(i => i.type === "hit")
  				.reduce((s, i) => s + i.system.quantity, 0);
  			data.system.health.value = now > orig ? -2 : -1;
  		}

  		return data;
  	}

  	/**
  	 * Activate event listeners and DOM interactions for the sheet.
  	 * Handles UI styling, toggles, and embedded document creation/deletion.
  	 * @override
  	 * @param {jQuery} html - The sheet HTML element.
  	 */
  	activateListeners(html) {
  		super.activateListeners(html);

  		// Apply accent colors based on user color settings
  		const base = game.user.color?.toString() || "#ffffff";
  		const light = this.lightenColor(base, 30);
  		const dark = this.lightenColor(base, -20);
  		document.documentElement.style.setProperty("--accent-color", base);
  		document.documentElement.style.setProperty("--accent-light", light);
  		document.documentElement.style.setProperty("--accent-dark", dark);

		// Dark Determination toggle button
		html.find(".dark-determination-toggle")
			.click(this._onToggleDarkDetermination.bind(this));

		// Render star ratings for stats  		// Handle Type dropdown changes
  		const current = this.actor.system.info?.type;
  		if (current) {
  			html.find("#user-type").val(current);
  		}

  		// Health max input change updates actor
  		html.find("input[name='system.health.max']").change(async ev => {
  			const max = parseInt(ev.target.value);
  			if (!Number.isNaN(max)) {
  				await this.actor.update({
  					"system.health.max": max
  				});
  				this.render();
  			}
  		});

  		// Item creation and deletion
  		html.find("#create-item").click(() => {
  			this.actor.createEmbeddedDocuments("Item", [{
  				name: "New Item"
  				, type: "item"
  				, system: {
  					weight: 0
  					, quantity: 1
  				}
        }]);
  		});
  		html.find("#item-items").on("click", ".delete-item", async ev => {
  			const id = $(ev.currentTarget).data("item-id");
  			await this.actor.deleteEmbeddedDocuments("Item", [id]);
  			this.render();
  		});
  		html.find("#item-items").on("click", "li", ev => {
  			if ($(ev.target).closest(".delete-item").length) return;
  			const id = $(ev.currentTarget).data("item-id");
  			const item = this.actor.items.get(id);
  			if (item) item.sheet.render(true);
  		});

  		// Hit creation, deletion, and health recalculation
  		const recalc = async () => {
  			const dd = this.actor.getFlag("bizarre-adventures-d6", "darkDetermination");
  			if (dd) return;
  			const totalDamage = this.actor.items
  				.filter(i => i.type === "hit")
  				.reduce((sum, i) => sum + (i.system.quantity || 0), 0);
  			const maxHP = this.actor.system.health.max;
  			const newValue = Math.max(this.actor.system.health.min, maxHP - totalDamage);
  			await this.actor.update({
  				"system.health.value": newValue
  			});
  			this.render();
  		};
  		html.find("#create-hit").click(async () => {
  			await this.actor.createEmbeddedDocuments("Item", [{
  				name: "New Hit"
  				, type: "hit"
  				, system: {
  					weight: 1
  					, quantity: 1
  				}
        }]);
  			recalc();
  		});
  		html.find("#hit-items").on("click", ".delete-hit", async ev => {
  			const id = $(ev.currentTarget).data("item-id");
  			await this.actor.deleteEmbeddedDocuments("Item", [id]);
  			recalc();
  		});
  		html.find("#hit-items").on("click", "li", ev => {
  			if ($(ev.target).closest(".delete-hit").length) return;
  			const id = $(ev.currentTarget).data("item-id");
  			const hit = this.actor.items.get(id);
  			if (hit) hit.sheet.render(true);
  		});

		// Prevent autosubmit from stealing focus while typing in special fields
		// Marked in templates with `data-noautosubmit="true"`.
		html.find('[data-noautosubmit="true"]').on("input", ev => {
			ev.stopImmediatePropagation();
		});

		// Persist any `system.info.*` fields on change/blur so dynamic fields save reliably
		html.find('[name^="system.info."]').on("change blur", async ev => {
			// Prevent other handlers (like autosubmit) from firing first
			ev.stopImmediatePropagation();
			const el = ev.currentTarget;
			const path = el.name;
			let value;
			if (el.type === "checkbox") value = el.checked;
			else value = el.value;

			// Coerce number inputs to numbers
			if (el.type === "number") {
				const n = parseFloat(value);
				if (!Number.isNaN(n)) value = n;
			}

			console.debug("UserSheet: saving field", path, value);
			// Update the actor with the single changed path
			try {
				await this.actor.update({ [path]: value });
				console.debug("UserSheet: saved field", path);
			} catch (err) {
				console.error("UserSheet: Failed to save user sheet field", path, err);
			}
		});
  	}

  	/**
  	 * Toggle Dark Determination flag and adjust health accordingly.
  	 * @param {Event} event - Click event from the toggle button.
  	 */
  	async _onToggleDarkDetermination(event) {
  		event.preventDefault();
  		const ddActive = this.actor.getFlag("bizarre-adventures-d6", "darkDetermination") || false;
  		const totalDamage = this.actor.items
  			.filter(i => i.type === "hit")
  			.reduce((sum, i) => sum + (i.system.quantity || 0), 0);

  		if (!ddActive) {
  			// Activate Dark Determination: store original damage and health
  			await this.actor.setFlag("bizarre-adventures-d6", "origDamage", totalDamage);
  			await this.actor.setFlag("bizarre-adventures-d6", "origHealth", {
  				value: this.actor.system.health.value
  				, max: this.actor.system.health.max
  			});

  			// Warn if a Vampire actor is owned by any non-GM owner
  			if (this.actor.hasPlayerOwner) {
  				const ownerUsers = game.users.filter(u =>
  					!u.isGM && this.actor.getUserLevel(u) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
  				);
  				const vampireActors = game.actors.filter(a =>
  					a.id !== this.actor.id &&
  					ownerUsers.some(u => a.getUserLevel(u) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) &&
  					foundry.utils.getProperty(a, "system.info.type") === "Vampire"
  				);
  				if (vampireActors.length) ui.notifications.warn(
  					"Reminder: A Vampire user may not activate Dark Determination."
  				);
  			}

  			await this.actor.update({
  				"system.health.value": -1
  				, "system.health.max": -1
  			});
  			await this.actor.setFlag("bizarre-adventures-d6", "darkDetermination", true);
  		} else {
  			// Deactivate Dark Determination: restore original health
  			const orig = this.actor.getFlag("bizarre-adventures-d6", "origHealth");
  			if (orig) {
  				await this.actor.update({
  					"system.health.value": orig.value
  					, "system.health.max": orig.max
  				});
  			}
  			await this.actor.unsetFlag("bizarre-adventures-d6", "darkDetermination");
  			await this.actor.unsetFlag("bizarre-adventures-d6", "origHealth");
  		}

  		// Re-render sheet to reflect health changes
  		await this.render();
  	}
  }

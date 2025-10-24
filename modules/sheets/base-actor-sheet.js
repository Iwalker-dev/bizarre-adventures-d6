export class BaseActorSheet extends foundry.appv1.sheets.ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["bizarre-adventures-d6", "sheet", "actor-sheet", "character-sheet"]
			, tabs: [{
				navSelector: ".sheet-tabs"
				, contentSelector: ".sheet-body"
				, initial: "stats"
			}]
		});
	}

	static statOrder = [
    "power"
    , "precision"
    , "speed"
    , "durability"
    , "range"
    , "learning"
  ];
	/** @override **/
	getData() {
		const data = super.getData();
		const statsObj = data.actor.system.attributes.stats || {};

		// Build the flat array
		const stats = Object.entries(statsObj).map(([key, stat]) => ({
			key
			, dtype: stat.dtype
			, label: stat.label
			, value: stat.value
			, original: stat.original
			, temp: stat.temp
			, perm: stat.perm
		}));
		if (data.typeConfigs && typeof data.typeConfigs === "object") {
			const types = Object.keys(data.typeConfigs);
			if (!data.system.info.type && types.length) {
				data.system.info.type = types[0];
			}
		}
		// 1) Sort by dtype (Burn first, then Number)
		const dtypeOrder = {
			Burn: 0
			, Number: 1
		};

		// 2) Then by your static key order
		const keyOrder = this.constructor.statOrder;

		stats.sort((a, b) => {
			// primary: dtype
			const dd = (dtypeOrder[a.dtype] || 99) - (dtypeOrder[b.dtype] || 99);
			if (dd !== 0) return dd;
			// secondary: index in statOrder
			const ai = keyOrder.indexOf(a.key);
			const bi = keyOrder.indexOf(b.key);
			// missing keys go to the end
			return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
		});

		data.stats = stats;
		return data;
	}

	/**
	 * Renders the clickable star‐rating widgets for a given sheet.
	 *
	 * @param {jQuery<HTMLElement>} html    The jQuery‐wrapped root element of the sheet.
	 * @returns {void}
	 */

	activateListeners(html) {
		super.activateListeners(html);

		// Whenever any Burn‐type button is clicked, call showBurnStat
		html.find('.burn-control .burn-type').on('click', ev => {
			const $btn = $(ev.currentTarget);
			const statKey = $btn.closest('.burn-control').data('stat');
			const valueType = $btn.data('type');
			this.showBurnStat(statKey, valueType);
		});

		// Optionally, pre-display the “original” stars for each Burn stat:
		this.getData().stats
			.filter(s => s.dtype === "Burn")
			.forEach(s => this.showBurnStat(s.key, 'original'));
	}

	async _render(force, options) {
		// 0) Look for any null‐valued stats and schedule their deletion
		const stats = this.actor.system.attributes.stats || {};
		const deletions = {};
		for (const [key, val] of Object.entries(stats)) {
			if (val === null) {
				const path = `system.attributes.stats.-=${key}`;
				deletions[`${path}`] = null;
			}
		}

		// 1) If there are any deletions, apply them and re‐render once
		if (Object.keys(deletions).length) {
			await this.actor.update(deletions);
		}

		// 2) No nulls to delete: proceed with your normal render logic
		await super._render(force, options);

		const $sheet = this.element.find('.jojo-sheet');
		if (!$sheet.length) {
			console.error('BaseActorSheet._render(): ".jojo-sheet" element not found.');
			return;
		}
		const info = this.actor.system.info || {};
		const type = info.type;
		if (!type) {
			console.warn('BaseActorSheet._render(): actor.system.info.type is undefined. Default background applied');
			return;
		}

		console.warn(`Applying background for type-${type}`);

		$sheet.removeClass((i, cls) => (cls.match(/\btype-\S+/g) || []).join(' '));
		$sheet.addClass(`type-${type}`);
	}


	renderStars(html) {
		html.find(".stat-stars").each((_, container) => {
			const statKey = container.dataset.stat;
			const statParts = statKey.split("-");
			const statName = statParts[0]; // e.g., "learning"
			const valueType = statParts[1] || "value"; // e.g., "temp", "perm", or "value"

			const statData = this.actor.system.attributes.stats[statName];
			const value = statData?.[valueType] ?? 0;

			container.innerHTML = "";
			container.classList.toggle("infinite", value === 6);

			for (let i = 1; i <= 6; i++) {
				const star = document.createElement("span");
				star.classList.add("stat-star");
				if (i <= value) star.classList.add("filled");
				star.textContent = (i === 6 ? "✶" : "★");
				star.title = (i === 6) ?
					"∞ / Unmeasurable" :
					`Rank ${["E", "D", "C", "B", "A"][i - 1]}`;

				star.addEventListener("click", async () => {
					const newValue = (value === i) ? i - 1 : i;
					const path = `system.attributes.stats.${statName}.${valueType}`;
					await this.actor.update({
						[path]: newValue
					});
					this.render(); // Refresh full sheet after stat update
				});

				container.appendChild(star);
			}
		});
	}

	showBurnStat(statKey, valueType) {
		// Style the buttons
		const control = this.element.find(`.burn-control[data-stat="${statKey}"]`);
		control.find('.burn-type').each((i, btn) => {
			const $btn = $(btn);
			const active = $btn.data('type') === valueType;
			$btn.toggleClass('active', active);
		});

		// Hide all stars for this stat; show only the selected one
		this.element.find(`.stat-stars[data-stat^="${statKey}-"]`)
			.hide();
		const $star = this.element.find(`.stat-stars[data-stat="${statKey}-${valueType}"]`);
		if ($star.length) {
			$star.show();
			this.renderStars($star.parent()); // or pass $star if you customize renderStars
		}
	}

	/**
	 * Rebuilds the “Hit List” UI from the actor’s stored hits.
	 *
	 * Pulls the array of hit objects from the actor’s flags and then
	 * empties and repopulates the `#hit-list` element with `<li>` entries.
	 *
	 * @returns {void}
	 */

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


	/**
	 * Lightens (or darkens) a hex color by a given percentage.
	 *
	 * @param {string} hex
	 *   A color string in `#rrggbb` format. If invalid or not a string,
	 *   logs a warning and defaults to `#ffffff`.
	 * @param {number} percent
	 *   How much to lighten the color, from –100 (full darken) to +100 (max lighten).
	 *
	 * @returns {string}
	 *   An `rgb(r,g,b)` CSS color string reflecting the adjusted brightness.
	 */
	lightenColor(hex, percent) {
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


}

function getRankTitle(starNumber) {
	if (starNumber === 6) return "∞ / Unmeasurable";
	return `Rank ${["E", "D", "C", "B", "A"][starNumber - 1] ?? starNumber}`;
}

function normalizeSpecialStats(statData) {
	const raw = Array.isArray(statData?.special) ? statData.special : [];
	return raw
		.map((entry, idx) => ({
			name: (entry?.name ?? "").toString().trim(),
			points: Number(entry?.points ?? 0),
			createdIndex: idx
		}))
		.filter(entry => entry.name.length > 0 && Number.isFinite(entry.points) && entry.points > 0);
}

function getSpecialsAtValue(specialStats, value) {
	return specialStats.filter(s => Math.floor(s.points) === value);
}

async function showSpecialStatDialog(actor, statName, seed = null) {
	const statData = actor.system.attributes.stats?.[statName] ?? {};
	const current = normalizeSpecialStats(statData);
	const options = current
		.map((entry, idx) => `<option value="${idx}">${entry.name} (S(${Math.floor(entry.points)}))</option>`)
		.join("");

	const seedName = seed?.name ?? "";
	const seedPoints = Number(seed?.points ?? 1);

	const content = `
		<form class="bad6-special-stat-dialog">
			<div class="form-group">
				<label>Existing</label>
				<select id="specialExisting">
					<option value="">(New)</option>
					${options}
				</select>
			</div>
			<div class="form-group">
				<label>Name</label>
				<input id="specialName" type="text" value="${seedName}" placeholder="e.g. Requiem">
			</div>
			<div class="form-group">
				<label>Points</label>
				<input id="specialPoints" type="number" min="1" max="30" step="1" value="${seedPoints}">
			</div>
		</form>
	`;

	new Dialog({
		title: `Special Stat · ${statData?.label ?? statName}`,
		content,
		buttons: {
			save: {
				label: "Save",
				callback: async (html) => {
					const selected = html.find("#specialExisting").val();
					const name = String(html.find("#specialName").val() ?? "").trim();
					const points = Math.max(1, Math.floor(Number(html.find("#specialPoints").val() ?? 1)));

					if (!name) {
						ui.notifications.warn("Special stats need a name.");
						return;
					}

					const next = [...current];
					if (selected !== "") {
						next[Number(selected)] = {
							name,
							points,
							createdIndex: next[Number(selected)]?.createdIndex ?? Number(selected)
						};
					} else {
						next.push({
							name,
							points,
							createdIndex: next.length
						});
					}

					await actor.update({
						[`system.attributes.stats.${statName}.special`]: next.map(({ name: n, points: p }) => ({ name: n, points: p }))
					});
				}
			},
			delete: {
				label: "Delete",
				callback: async (html) => {
					const selected = html.find("#specialExisting").val();
					if (selected === "") return;
					const idx = Number(selected);
					const next = current.filter((_, i) => i !== idx);
					await actor.update({
						[`system.attributes.stats.${statName}.special`]: next.map(({ name: n, points: p }) => ({ name: n, points: p }))
					});
				}
			},
			cancel: {
				label: "Cancel"
			}
		},
		default: "save"
	}).render(true);
}

function bindStatLabelControl($container, actor, statName, statData) {
	const $label = $container.closest(".stat-line").find("label").first();
	if (!$label.length) return;
	if ($label.data("bad6SpecialBound")) return;
	$label.data("bad6SpecialBound", true);

	$label.on("click", async (event) => {
		event.preventDefault();
		if (statData.dtype === "Burn") return;
		await showSpecialStatDialog(actor, statName);
	});
}



export function renderStars(html, actor) {
	html.find(".stat-stars").each((_, container) => {
		const $container = $(container);
		const statKey = $container.data("stat");
		const [statName, valueType = "value"] = String(statKey).split("-");

		const statData = actor.system.attributes.stats?.[statName];
		if (!statData) return;

		const isBurn = statData.dtype === "Burn";
		const finalValueType = isBurn ? valueType : "value";

		let baseValue = Number(statData?.[finalValueType] ?? 0);
		if (!Number.isFinite(baseValue)) baseValue = 0;
		baseValue = Math.floor(baseValue);

		const specialStats = isBurn ? [] : normalizeSpecialStats(statData);
		const maxSpecial = specialStats.reduce((max, entry) => Math.max(max, Math.floor(entry.points)), 0);
		const maxStars = Math.max(6, baseValue, maxSpecial);

		$container.empty()
			.toggleClass("infinite", baseValue === 6)
			.toggleClass("has-special", specialStats.length > 0);

		bindStatLabelControl($container, actor, statName, statData);

		for (let starNumber = 1; starNumber <= maxStars; starNumber++) {
			const hasBase = starNumber <= baseValue;
			const specialsAtValue = getSpecialsAtValue(specialStats, starNumber);
			const hasMultipleSpecials = specialsAtValue.length > 1;

			const star = document.createElement("span");
			star.classList.add("stat-star");

			// Determine symbol and styling
			let symbol = (starNumber === 6 ? "✦" : "★");
			let isFilled = hasBase;
			let isSpecial = false;
			let title = getRankTitle(starNumber);

			if (specialsAtValue.length > 0) {
				// Has special(s) at this value: use unique symbol and special styling
				isSpecial = true;
				symbol = "✪"; // Unique symbol for special stats
				isFilled = true;
				if (hasMultipleSpecials) {
					star.classList.add("special-multiple");
					title = `${specialsAtValue.map(s => s.name).join(", ")} · S(${specialsAtValue[0].points})`;
				} else {
					star.classList.add("special-single");
					title = `${specialsAtValue[0].name} · S(${Math.floor(specialsAtValue[0].points)})`;
				}
			}

			if (isFilled && !isSpecial) {
				star.classList.add("filled");
			} else if (isSpecial) {
				star.classList.add("filled-special");
			}

			star.textContent = symbol;
			star.title = title;

			star.addEventListener("click", async () => {
				const newValue = (baseValue === starNumber) ? starNumber - 1 : starNumber;
				await actor.update({
					[`system.attributes.stats.${statName}.${finalValueType}`]: newValue
				});
			});

			if (!isBurn) {
				star.addEventListener("contextmenu", async (event) => {
					event.preventDefault();
					const existing = specialsAtValue[0] ?? { points: starNumber, name: "" };
					await showSpecialStatDialog(actor, statName, existing);
				});
			}

			$container[0].appendChild(star);
		}
	});
}

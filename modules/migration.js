// modules/migration.js
function toSpecialKey(label, fallback = "special") {
	const source = (label ?? "").toString().trim().toLowerCase();
	const normalized = source
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || fallback;
}

function normalizeSpecialArray(rawSpecials = []) {
	const used = new Set();
	return rawSpecials
		.map((entry, index) => {
			const label = (entry?.label ?? entry?.name ?? "").toString().trim();
			const value = Number(entry?.value ?? entry?.points ?? 0);
			const keyBase = (entry?.key ?? "").toString().trim() || toSpecialKey(label, `special-${index + 1}`);
			if (!label || !Number.isFinite(value) || value <= 0) return null;

			let key = keyBase;
			let suffix = 2;
			while (used.has(key)) {
				key = `${keyBase}-${suffix}`;
				suffix += 1;
			}
			used.add(key);

			return {
				key,
				label,
				value: Math.floor(value)
			};
		})
		.filter(entry => entry);
}

export async function migrateWorld() {
	// For old user actors, relocate their attributes to the new stats structure
	let count = 0;
	for (const id of game.actors.invalidDocumentIds) {
		const actor = game.actors.getInvalid(id);
		// If Hybrid, splt into separate User and Stand actors
		 if (actor.type === "character") {
			count ++;
			ui.notifications.info(`BAD6 Migratable | Starting migration process for ${actor.name} (${actor.id}).`);
			if (actor.system.attributes.ustats && actor.system.attributes.sstats) {
				// Create user actor
				const userData = foundry.utils.duplicate(actor.toObject());
				userData.type = "user";
				userData.name = `${actor.name} (user)`;
				userData.system.attributes.stats = userData.system.attributes.ustats;
				userData.system.attributes.stats.luck = userData.system.attributes.stats.luck || {};
				userData.system.attributes.stats.luck.dtype = "Burn";
				delete userData._id;
				delete userData.system.attributes.ustats;
				delete userData.system.attributes.sstats;

				// Create stand actor
				const standData = foundry.utils.duplicate(actor.toObject());
				standData.type = "stand";
				standData.name = `${actor.name} (stand)`;
				standData.system.attributes.stats = standData.system.attributes.sstats;
				standData.system.attributes.stats.learning = standData.system.attributes.stats.learning || {};
				standData.system.attributes.stats.learning.dtype = "Burn";
				delete standData._id;
				delete standData.system.attributes.ustats;
				delete standData.system.attributes.sstats;

				// Delete original
				await Actor.deleteDocuments([id]);

				// Create new actors
				await Actor.create(userData);
				await Actor.create(standData);

 				 ui.notifications.info(`BAD6 Migration | Hybrid actor ${actor.name} split into "${userData.name}" and "${standData.name}".`);
			}
			// If user only, create only a user type actor
			else if (actor.system.attributes.ustats) {
				// Set actors to the correct type by creating a new actor object
				const userData = foundry.utils.duplicate(actor.toObject());
				userData.type = "user";
				userData.name = `${actor.name} (user)`;
				userData.system.attributes.stats = userData.system.attributes.ustats;
				userData.system.attributes.stats.luck = userData.system.attributes.stats.luck || {};
				userData.system.attributes.stats.luck.dtype = "Burn";
				delete userData._id;
				delete userData.system.attributes.ustats;
				delete userData.system.attributes.sstats;

				// Delete original
				await Actor.deleteDocuments([id]);

				// Create new actor
				await Actor.create(userData);

				ui.notifications.info(`BAD6 Migration | Actor ${actor.name} migrated to type "user".`);
			}
			// If stand only, create only a stand type actor
			else if (actor.system.attributes.sstats) {
				// Set actors to the correct type by creating a new actor object
				const standData = foundry.utils.duplicate(actor.toObject());
				standData.type = "stand";
				standData.name = `${actor.name} (stand)`;
				standData.system.attributes.stats = standData.system.attributes.sstats;
				standData.system.attributes.stats.learning = standData.system.attributes.stats.learning || {};
				standData.system.attributes.stats.learning.dtype = "Burn";
				delete standData._id;
				delete standData.system.attributes.ustats;
				delete standData.system.attributes.sstats;

				// Delete original
				await Actor.deleteDocuments([id]);

				// Create new actor
				await Actor.create(standData);

				ui.notifications.info(`BAD6 Migration | Actor ${actor.name} migrated to type "stand".`);
			}
		}
	}
	if (count > 0) ui.notifications.info(`BAD6 Migration | Migration process completed. ${count} actors migrated.`);

	const current = game.system.version;
	if (!current) {
		console.error("BAD6 Migration | Could not read system version:", game.system);
		return;
	}

	const previous = game.settings.get("bizarre-adventures-d6", "systemMigrationVersion") || "0.0.0";
	if (!foundry.utils.isNewerVersion(current, previous)) return;

	const isNewer = foundry.utils.isNewerVersion;

	// — 0.9.1 migration: “Learning” → “Luck” —
	if (isNewer(current, previous) &&
		isNewer("0.9.1", previous) &&
		!isNewer("0.9.1", current)
	) {
		for (const actor of game.actors.filter(a => a.type === "user")) {
			if (actor.system.attributes.stats.luck?.label === "Learning") {
				await actor.update({
					"system.attributes.stats.luck.label": "Luck"
				});
			}
		}
		console.log("BAD6 | Applied 0.9.1 migration (Luck label fixed from Learning → Luck).");
	}

	// — 0.9.3 migration: remove -learning-original,temp,perm
	if (isNewer(current, previous) &&
		isNewer("0.9.3", previous) &&
		!isNewer("0.9.3", current)
	) {
		for (const actor of game.actors.filter(a => a.type === "power")) {
			if (actor.system.attributes.stats?.[`learning-original`]) {
				await actor.update({
					"system.attributes.stats.-=learning-original": null
					, "system.attributes.stats.-=learning-temp": null
					, "system.attributes.stats.-=learning-perm": null
				});
			}
		}
		console.log("BAD6 | Applied 0.9.3 migration (-learning-original,temp,perm on power users).");
	}

	// — 0.9.5 migration: apply default type images to power actors with mystery man
	if (isNewer(current, previous) &&
		isNewer("0.9.5", previous) &&
		!isNewer("0.9.5", current)
	) {
		for (const actor of game.actors.filter(a => a.type === "power")) {
			const typeKey = actor.system.info?.type;
			await actor.update({ "system.info.type": typeKey });
			console.log(`Updated ${actor.name}`);
		}
		console.log("BAD6 | Applied 0.9.5 migration (default type images for power actors) x");
	}

	//— 0.9.6 migration: move "info" to "bio" for universal linkedActors field —
	if (isNewer(current, previous) &&
		isNewer("0.9.6", previous) &&
		!isNewer("0.9.6", current)
	) {
		for (const actor of game.actors.filter(a => a.type === "power")) {
			if (actor.system.info) {
				const info = actor.system.info || {};
				const bio = actor.system.bio || {};
				await actor.update({
					"system.bio": info,
					"system.-=info": null
				});
			}
		}
		for (const actor of game.actors.filter(a => a.type === "stand")) {
			if (actor.system.info) {
				const info = actor.system.info || {};
				const bio = actor.system.bio || {};
				await actor.update({
					"system.bio": info,
					"system.-=info": null
				});
			}
		}
		console.log("BAD6 | Applied 0.9.6 migration (moved info to bio) x");
	}

	// — 0.9.9 migration: normalize stat specials to key/label/value —
	if (isNewer(current, previous) &&
		isNewer("0.9.9", previous) &&
		!isNewer("0.9.9", current)
	) {
		for (const actor of game.actors.filter(a => ["user", "stand", "power", "character"].includes(a.type))) {
			const stats = actor.system.attributes?.stats;
			if (!stats || typeof stats !== "object") continue;
			await game.settings.set("bizarre-adventures-d6", "welcomed", false);

			const updates = {};
			let changed = false;

			for (const [statKey, statData] of Object.entries(stats)) {
				if (!Array.isArray(statData?.special)) continue;

				const normalized = normalizeSpecialArray(statData.special);
				const before = JSON.stringify(statData.special);
				const after = JSON.stringify(normalized);
				if (before === after) continue;

				updates[`system.attributes.stats.${statKey}.special`] = normalized;
				changed = true;
			}

			if (changed) await actor.update(updates);
		}
		console.log("BAD6 | Applied 0.9.9 migration (special stats normalized to key/label/value).");
	}
	// — Record that we’re now at `current` —
	await game.settings.set("bizarre-adventures-d6", "systemMigrationVersion", current);

		if (isNewer(current, previous) &&
		isNewer("0.9.10", previous) &&
		!isNewer("0.9.10", current)
	) {
		await game.settings.set("bizarre-adventures-d6", "welcomed", false);
		ui.notifications.info("BAD6 Migration | Welcome message updated.");
	}



	// — First ever world load —
	const shouldWelcome = game.settings.get("bizarre-adventures-d6", "welcomed");
	if (shouldWelcome) {
		ChatMessage.create({
			user: game.user.id
			, speaker: {
				alias: game.system.title
			}
			, content: `<h2>Welcome to BAD6!</h2>
      <p> Controls: </p>
        <ul>
          <li>🎲 Use the "D6 Roller" in token controls for actions. Double click for Contests.</li>
          <li>🎲 As a GM, your highlighted tokens are the roll's context.</li>
          <li>🎯 As a player your owned actors are the roll's context.</li>
          <li>🎯 Contest rolls are resolved in the same chat message; use the buttons in each quadrant.</li>
          <li>🔧 Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue</li>
          <li>🌟 To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called "Outro" and it will automatically switch to it afterwards.</li>
          <li>🧑 Old Actors - On each load, actors will be automatically moved to a type (if set up properly in the Worldbuilding version.).</li>
        </ul>
        <p> This system is unfinished! Certain features are not yet implemented such as...</p>
        <ul>
          <li> Learning Automation.</li>
		  <li> (View the changelog for longer list) </li>
        </ul>
        <p> Please report any problems, ideas, or comments to itpart on Discord as I try to handle them quickly. I would love to make this the perfect system with your help! </p>`
			, whisper: game.users.filter(u => u.isGM).map(u => u.id)
		});
		await game.settings.set("bizarre-adventures-d6", "welcomed", true);
	}
}


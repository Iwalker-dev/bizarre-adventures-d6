// modules/migration.js
export async function migrateWorld() {
	const current = game.system.version;
	if (!current) {
		console.error("BAD6 Migration | Could not read system version:", game.system);
		return;
	}

	const previous = game.settings.get("bizarre-adventures-d6", "systemMigrationVersion") || "0.0.0";
	if (!foundry.utils.isNewerVersion(current, previous)) return;

	const isNewer = foundry.utils.isNewerVersion;
	for (const actor of game.actors.filter(a => a.type === "character")) {
		// For old user actors, relocate their attributes to the new stats structure
		if (actor.type === "character" && actor.system.attributes.ustats) {
			await actor.update({
				"system.attributes.stats": actor.system.attributes.ustats
				, "system.attributes.stats.luck.dtype": 'Burn'
				, "system.attributes.-=ustats": null
				, "system.attributes.-=advantage": null
				, "system.attributes.-=uroll": null
			, });
			// Set actors to the correct type by creating a new actor object
			const actorData = foundry.utils.duplicate(actor.toObject());
			actorData.type = "user";
			delete actorData._id;
			actorData.folder = actor.folder?.id;
			actorData.ownership = actor.ownership;
			await actor.delete();
			await Actor.create(actorData);
			ui.notifications.info(`BAD6 Migration | Actor ${actor.name} (${actor.id}) migrated to type "${actorData.type}".`);
		}
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
          <li>🎲 As a GM, select 1 token for the action roll. If multiple tokens are highlighted, it starts a contest.</li>
          <li>🎯 As a player, selecting targets starts a contest. Otherwise, you roll from owned actors.</li>
          <li>🎯 Contest rolls are resolved in the same chat message; use the buttons in each quadrant.</li>
          <li>🔧 Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue</li>
          <li>🌟 To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called "Outro" and it will automatically switch to it afterwards.</li>
          <li>🧑 Old Actors - On each load, actors will be automatically moved to a type (if set up properly in the Worldbuilding version.).</li>
        </ul>
        <p> This system is unfinished! Certain features are not yet implemented such as...</p>
        <ul>
          <li> Flashbacks (You will have to manually take the cost).</li>
        </ul>
        <p> Please report any problems, ideas, or comments to itpart on Discord. I would love to make this the perfect system with your help! </p>`
			, whisper: game.users.filter(u => u.isGM).map(u => u.id)
		});
	}

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
	// — Record that we’re now at `current` —
	await game.settings.set("bizarre-adventures-d6", "systemMigrationVersion", current);
}


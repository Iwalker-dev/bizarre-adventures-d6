// modules/migration.js
Hooks.once("ready", () => {
	game.settings.register("bizarre-adventures-d6", "migrationVersion", {
		name: "Last migration version"
		, scope: "world"
		, config: false
		, type: String
		, default: "0.0.0"
	});
});

// 2) Once everything is loaded, read the system version and run migrations
Hooks.once("ready", async () => {
	const current = game.system.version;
	if (!current) {
		console.error("BAD6 Migration | Could not read system version:", game.system);
		return;
	}

	const previous = game.settings.get("bizarre-adventures-d6", "migrationVersion") || "0.0.0";
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
			const actorData = duplicate(actor.toObject());
			actorData.type = "user";
			delete actorData._id;
			actorData.folder = actor.folder?.id;
			actorData.permission = actor.permission;
			await actor.delete();
			await Actor.create(actorData);
			ui.notifications.info(`BAD6 Migration | Actor ${actor.name} (${actor.id}) migrated to type "${actorData.type}".`);
		}
		// For old stand actors, relocate their attributes to the new stats structure
		if (actor.type === "character" && actor.system.attributes.sstats) {
			await actor.update({
				"system.attributes.stats": actor.system.attributes.sstats
				, "system.attributes.stats.learning.dtype": 'Burn'
				, "system.attributes.-=sstats": null
				, "system.attributes.-=advantage": null
				, "system.attributes.-=sroll": null
			, });
			// Set actors to the correct type by creating a new actor object
			const actorData = duplicate(actor.toObject());
			actorData.type = "stand";
			delete actorData._id;
			actorData.folder = actor.folder?.id;
			actorData.permission = actor.permission;
			await actor.delete();
			await Actor.create(actorData);
			ui.notifications.info(`BAD6 Migration | Actor ${actor.name} (${actor.id}) migrated to type "${actorData.type}".`);
		}

	}

	const isNewer = (a, b) => {
		const [A, B, C] = a.split(".").map(Number);
		const [X, Y, Z] = b.split(".").map(Number);
		return A > X || (A === X && (B > Y || (B === Y && C > Z)));
	};

	// — First ever world load —
	if (previous === "0.0.0") {
		ChatMessage.create({
			user: game.user.id
			, speaker: {
				alias: game.system.title
			}
			, content: `<h2>Welcome to BAD6!</h2>
      <p> Controls: </p>
        <ul>
          <li>🎲 Use the "D6 Roller" in token controls for rolls.</li>
          <li>🎲 As a GM, highlight up to 2 tokens then run the roller to roll their stats.</li>
          <li>🎲 As a player, select from your owned tokens for each roll.</li>
          <li>🔧 Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue</li>
          <li>🌟 To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called "Outro" and it will automatically switch to it afterwards.</li>
          <li>🧑 Old Actors - On each load, actors will be automatically moved to a type (if set up properly in the Worldbuilding version.).</li>
        </ul>
        <p> This system is unfinished! Certain features are not yet implemented such as...</p>
        <ul>
          <li> Custom Combat Implementation (Recommended to use Lancer Initiative as a replacement)</li>
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

	// — Record that we’re now at `current` —
	await game.settings.set("bizarre-adventures-d6", "migrationVersion", current);
});

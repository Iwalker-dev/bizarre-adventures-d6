async function migrateWorld() {
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
}
migrateWorld();
let socket;
export function rollerControl() {
    Hooks.on("getSceneControlButtons", (controls) => {
        const tokenControls = controls.find(c => c.name === "token");
        if (tokenControls) {
            tokenControls.tools.push({
                name: "rollerButton",
                title: "D6 Roller",
                icon: "fas fa-dice-d6",
                visible: true,
                onClick: () => {
                    main();
                },
                button: true
            });
        }
    });
}

async function readyCheck(actor, formula, statLabel, advantage, data) {
  const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
  const content = `<p>Would you like to roll <strong>${statLabel}</strong>${advantagePhrase}? <code>(${formula})</code></p>`;

  const confirmed = await new Promise(resolve => {
    new Dialog({
      title: "A Roll is Ready",
      content,
      buttons: {
        "Yes": { label: "Yes", callback: () => resolve(true) },
        "No": { label: "No", callback: () => resolve(false) }
      },
      default: "No"
    }).render(true);
  });
	if (confirmed) {
		// Roll it
		const roll = new Roll(formula, data);
		await roll.evaluate({ async: true });
		roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor }),
			flavor: `★ <em>${statLabel}</em> Challenge ★<br>Advantage Level: <strong>${advantage}</strong>`
		});
		return roll._total;
	}
}

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem('bizarre-adventures-d6');
	socket.register("pCheck", readyCheck);
});

// Sets advantage value
function chooseAdvantage() {
  return new Promise(resolve => {
    new Dialog({
      title: "Choose Advantage",
      content: "<p>Select an advantage value (0–3):</p>",
      buttons: {
        "0": {
          label: "0",
          callback: () => resolve(0)
        },
        "1": {
          label: "1",
          callback: () => resolve(1)
        },
        "2": {
          label: "2",
          callback: () => resolve(2)
        },
        "3": {
          label: "3",
          callback: () => resolve(3)
        }
      },
      default: "0"
    }).render(true);
  });
}

async function findRoller(i) {
  if (game.user.isGM) {
		if (canvas.tokens.controlled.length == 1) i = 0;
		const selectedToken = canvas.tokens.controlled[i];
		if (!selectedToken) {
			ui.notifications.warn("No token selected.");
			return null;
		}
    return selectedToken.actor;
	} else {
		const ownedActors = game.actors.filter(actor => actor.isOwner);
		if (ownedActors.length === 0) {
		ui.notifications.warn("You don't own any actors.");
		return null;
		}
		if (ownedActors.length === 1) {
		return ownedActors[0];
		}

		return await new Promise(resolve => {
		const buttons = {};
		for (const actor of ownedActors) {
			buttons[actor.id] = {
			label: actor.name,
			callback: () => resolve(actor)
			};
		}

		new Dialog({
			title: "Choose an Actor",
			content: "<p>Select an actor to use:</p>",
			buttons,
			default: Object.keys(buttons)[0]
		}).render(true);
		});
	}
}

// Finds all relevant stats and creates buttons for them. Returns label and value in that order as a list.
function requestStat(actor) {
  return new Promise(resolve => {
    let sources;

    // Check for ustats/sstats first (Mantain compatibility with simple worldbuilding)
    if (actor.system.attributes?.ustats || actor.system.attributes?.sstats) {
      sources = {
        ustats: actor.system.attributes?.ustats || {},
        sstats: actor.system.attributes?.sstats || {}
      };
    } 
    // Check if the type is "stand" (New system compatibility)
    else if (actor.type === "stand" || actor.type === "power") {
      sources = {
        sstats: actor.system.attributes?.stats || {}
      };
    } 
    // Check if the type is "user" (New system compatibility)
    else if (actor.type === "user") {
      sources = {
        ustats: actor.system.attributes?.stats || {}
      };
    } 
    // Unsupported actor format
    else {
      ui.notifications.warn("Unsupported actor format.");
      resolve(null);
      return;
    }

    const buttons = {};
    for (const [sourceKey, stats] of Object.entries(sources)) {
      for (const [key, stat] of Object.entries(stats)) {
        if (stat.dtype === "Number") {
          const name = stat.label || key;
          const formattedName = sourceKey === "sstats" ? `【${name}】` : name;
          const label = `${formattedName} (${stat.value})`;
          buttons[`${sourceKey}-${key}`] = {
            label,
            callback: () => resolve([name, stat.value])
          };
        }
      }
    }

    if (Object.keys(buttons).length === 0) {
      ui.notifications.warn("No numeric stats found.");
      resolve(null);
      return;
    }

    new Dialog({
      title: "Choose a Stat",
      content: "<p>Select a stat:</p>",
      buttons,
      default: Object.keys(buttons)[0]
    }).render(true);
  });
}

async function confirmRoller(actor) {
	let isPlayerRoller;
	let owner = findOwner(actor);
	
	// Ask the script runnner (GM) if they want to send requests to the owner
	isPlayerRoller = await new Promise(resolve => {
    new Dialog({
      title: "Player Owner Detected",
      content: "<p>Would you like the player owner to finish this roll?</p>",
      buttons: {
        "Yes": {
          label: "Yes",
          callback: () => resolve(true)
        },
        "No": {
          label: "No",
          callback: () => resolve(false)
        },
      }
    }).render(true);
  });
  return isPlayerRoller;
}

function findOwner(actor) {
    // Find the first non-GM owner based on permissions
    let nonGmOwner = game.users.find(user => {
        return !user.isGM && actor.testUserPermission(user, "OWNER");
    });

    // If there's a non-GM owner, return them; otherwise, return a GM
    let recipient = nonGmOwner ? nonGmOwner : game.users.find(user => user.isGM);

    if (!recipient) {
        console.error("No suitable owner found for actor:", actor.name);
        return null;
    }

    return recipient;
}

function convDC(value) {
	const tableDC = {
		0: "Trivial",
		1: "Easy",
		2: "Challenging",
		3: "Dire",
		4: "Herculean",
		5: "Extraordinary",
		6: "Superhuman",
		7: "Unbelievable",
		8: "Surreal",
		9: "Absurd",
		10:"Nigh-Impossible",
		11: " ★ Nigh-Impossible ★",
		12: " ★  ★ Nigh-Impossible  ★  ★",
		13: " ★  ★  ★ Nigh-Impossible ★  ★  ★",
		14: " ★  ★  ★  ★ Nigh-Impossible  ★  ★  ★  ★ "
	}
	return tableDC[value] ?? "Literally Impossible";
}



async function main() {
	let actor;
	let ownedActors;
	let advantage;
	let isPlayerRoller = false;
	let hasPlayerOwner;
	let stat;
	let player;
	let playerUsers;
	let contestValue;
	let content;
	let DC;
	
	let rollSum = 0;
	const targetActors = Array.from(game.user.targets).map(token => token.actor);

			for (let i = 0; i < 2; i++) {
				if (!advantage) advantage = await chooseAdvantage();
				actor = await findRoller(i);
				if (!actor) return;
				hasPlayerOwner	= actor.ownership && Object.entries(actor.ownership).some(([userId, level]) => {
					const user = game.users.get(userId);
					return user?.active && !user.isGM && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
				});
				
				stat = await requestStat(actor);
				if (!stat) {
					ui.notifications.warn("Stat selection cancelled.");
					return;
				}
				// ask if the stats should be rolled by player owner (if they exist, and you are the GM)
				if (game.user.isGM && hasPlayerOwner) isPlayerRoller = await confirmRoller(actor);
				
				const data = actor.getRollData();
				const statsSource = data.ustats?.body != null ? "ustats" : "sstats";
				const formula = `(${stat[1]}d6cs>=${5 - advantage})`;
				
				if (isPlayerRoller) {
					player = findOwner(actor);
					if (!player) {
						ui.notifications.warn("No valid player owner found.");
						return;
					}
					rollSum += await socket.executeAsUser("pCheck", player.id, actor, formula, stat[0], advantage, data);
					continue;
				}
				// Roll it
				const roll = new Roll(formula, data);
				await roll.evaluate({ async: true });
				roll.toMessage({
					speaker: ChatMessage.getSpeaker({ actor }),
					flavor: `★ <em>${stat[0]}</em> Challenge ★<br>Advantage Level: <strong>${advantage}</strong>`
				});
				const live = roll._total ?? 0;
				rollSum += live;
			}
			
			DC = convDC(rollSum);
			
			content = `A result of ${rollSum}! ${DC} roll!`
			ChatMessage.create({
				content: content,
				speaker: ChatMessage.getSpeaker()
			});

}
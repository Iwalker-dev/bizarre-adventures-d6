let socket;

// Register socket function as soon as socketlib is ready
Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem("bizarre-adventures-d6");
	socket.register("pCheck", readyCheck);
});

// Inject button on init
Hooks.once("init", () => {
	rollerControl();
});

export function rollerControl() {
	Hooks.on("getSceneControlButtons", (controls) => {
		const tokenControls = controls.tokens;
		if (!tokenControls) return;

		tokenControls.tools["rollerButton"] = {
			name: "rollerButton"
			, title: "D6 Roller"
			, icon: "fas fa-dice-d6"
			, visible: true
			, button: true
			, order: 50
			, onClick: () => main()
		};
	});
}

// Takes an actorId, not an Actor instance
async function readyCheck(actorId, formula, statLabel, advantage, data) {
	const actor = game.actors.get(actorId);
	if (!actor) return null;

	const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
	const content = `<p>Roll <strong>${statLabel}</strong>${advantagePhrase}? <code>(${formula})</code></p>`;

	const confirmed = await new Promise(resolve => {
		new Dialog({
			title: "A Roll is Ready"
			, content
			, buttons: {
				Yes: {
					label: "Yes"
					, callback: () => resolve(true)
				}
				, No: {
					label: "No"
					, callback: () => resolve(false)
				}
			}
			, default: "No"
		}).render(true);
	});
	if (!confirmed) return null;

	const roll = new Roll(formula, data);
	await roll.evaluate({
		async: true
	});
	roll.toMessage({
		speaker: ChatMessage.getSpeaker({
			actor
		})
		, flavor: `★ <em>${statLabel}</em> Challenge ★<br>Advantage Level: <strong>${advantage}</strong>`
	});
	return roll.total;
}

// Utility dialogs
function chooseAdvantage() {
	return new Promise(resolve => {
		new Dialog({
			title: "Choose Advantage"
			, content: "<p>Select an advantage value (0–3):</p>"
			, buttons: {
				0: {
					label: "0"
					, callback: () => resolve(0)
				}
				, 1: {
					label: "1"
					, callback: () => resolve(1)
				}
				, 2: {
					label: "2"
					, callback: () => resolve(2)
				}
				, 3: {
					label: "3"
					, callback: () => resolve(3)
				}
			}
			, default: "0"
		}).render(true);
	});
}

async function findRoller(i, reaction = false) {
	if (game.user.isGM) {
		console.warn("BAD6 | reaction:", reaction);
		let token;
		let roller;
		// Roll the same actor for both rolls if only one token is selected
		if (canvas.tokens.controlled.length === 1) i = 0;
		token = canvas.tokens.controlled[i];
		roller = token.actor;
		// If there are valid remaining targets, use them instead
		if (reaction) {
			// Roll the same reactor for both rolls if only one token is selected
			if (game.user.targets.size === 1) i = 0;
			token = Array.from(game.user.targets)[i];
			roller = token.actor;
		}
		// If no token, warn and null
		if (!token) {
			ui.notifications.warn("No token selected. Select up to 2.");
			return null;
		}
		console.warn("BAD6 | Roller chosen:", roller.name);
		// Otherwise use the controlled token
		return new Promise(async (resolve, reject) => {
				// Get linked actors from the actor's bio
				const linkedActors = roller.system.bio.linkedActors?.value || [];
				console.warn("BAD6 | Linked actors:", linkedActors);
				if (linkedActors.length === 0) {
					ui.notifications.warn("No linked abilities found. Defaulting to original roller.");
					return resolve(roller);
				}
				let buttons = {
					[roller.id]: {
						label: roller.name
						, callback: () => resolve(roller)
					}
				};
				// Fetch each linked actor and create a button
				for (let linked of linkedActors) {
					const actor = await fromUuid(linked.uuid);
					if (actor) {
						buttons[linked.uuid] = {
							label: `${linked.name} (${linked.type})`
							, callback: () => resolve(actor)
						};
					}
				}
				new Dialog({
					title: "Choose Roller"
					, content: "<p>Select an ability to use:</p>"
					, buttons
					, default: Object.keys(buttons)[0]
					, close: () => resolve(null)  // Handle X button click
				}).render(true);
		});
	}
	const owned = game.actors.filter(a => a.isOwner);
	if (owned.length === 0) {
		ui.notifications.warn("You don't own any actors. A player may only roll from their owned actors.");
		return null;
	}
	if (owned.length === 1) return owned[0];

	return new Promise(resolve => {
		const buttons = {};
		for (let a of owned) {
			buttons[a.id] = {
				label: a.name
				, callback: () => resolve(a)
			};
		}
		new Dialog({
			title: "Choose an Actor"
			, content: "<p>Select an actor:</p>"
			, buttons
			, default: Object.keys(buttons)[0]
		}).render(true);
	});
}

function requestStat(actor) {
	return new Promise(resolve => {
		let sources;
		if (actor.system.attributes?.ustats || actor.system.attributes?.sstats) {
			sources = {
				ustats: actor.system.attributes?.ustats || {}
				, sstats: actor.system.attributes?.sstats || {}
			};
		} else if (actor.type === "stand" || actor.type === "power") {
			sources = {
				sstats: actor.system.attributes?.stats || {}
			};
		} else if (actor.type === "user") {
			sources = {
				ustats: actor.system.attributes?.stats || {}
			};
		} else {
			ui.notifications.warn("Unsupported actor format.");
			return resolve(null);
		}

		const buttons = {};
		for (let [k, stats] of Object.entries(sources)) {
			for (let [key, stat] of Object.entries(stats)) {
				if (stat.dtype === "Number") {
					const name = stat.label || key;
					const label = `${k === "sstats" ? `【${name}】` : name} (${stat.value})`;
					buttons[`${k}-${key}`] = {
						label
						, callback: () => resolve([name, stat.value])
					};
				}
			}
		}
		if (!Object.keys(buttons).length) {
			ui.notifications.warn("No numeric stats found.");
			return resolve(null);
		}

		new Dialog({
			title: "Choose a Stat"
			, content: "<p>Select a stat:</p>"
			, buttons
			, default: Object.keys(buttons)[0]
		}, {
			width: 400
			, classes: ["roller-dialog"]
		}).render(true);
	});
}

async function confirmRoller(actor) {
	const nonGm = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
	const player = nonGm || game.users.find(u => u.isGM);
	if (!player) return false;

	return new Promise(resolve => {
		new Dialog({
			title: "Player Owner Detected"
			, content: "<p>Have the player finish this roll?</p>"
			, buttons: {
				Yes: {
					label: "Yes"
					, callback: () => resolve(true)
				}
				, No: {
					label: "No"
					, callback: () => resolve(false)
				}
			}
		}).render(true);
	});
}

function convDC(value) {
	const map = {
		0: "Trivial"
		, 1: "Easy"
		, 2: "Challenging"
		, 3: "Dire"
		, 4: "Herculean"
		, 5: "Extraordinary"
		, 6: "Superhuman"
		, 7: "Unbelievable"
		, 8: "Surreal"
		, 9: "Absurd"
		, 10: "Nigh-Impossible"
	};
	return map[value] || "Literally Impossible";
}

function convHit(value) {
	const map = {
		0: "None"
		, 1: "Minor"
		, 2: "Moderate"
		, 3: "Serious"
		, 4: "Debilitating"
		, 5: "Critical"
		, 6: "Macabre"
	};
	if (value > 6) return "Grindhouse";
	return map[value] || "Invalid Hit";
}

// Helper to find a non-GM owner or fallback to GM
function findOwner(actor) {
	return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ||
		game.users.find(u => u.isGM);
}


// Entrypoint
async function main() {
	let rollSum = 0;
	let advantage, actor, stat;
	let targetCount = game.user.targets.size;
	let reactSum = null;
	let reactor = null;
	let reaction = false;
	if (targetCount > 0) {
		if (!game.user.isGM) {
			ui.notifications.warn("Currently, only GMs can automate reactions. Proceeding as a normal roll.");
			targetCount = 0;
		} else if (targetCount > 2) {
			ui.notifications.warn("You can only target up to 2 tokens for reactions. Proceeding as a normal roll.");
			targetCount = 0;
		} else {
			reaction = true;
		}
	}
	// As a GM, if you are targeting 1-2 tokens, trigger a contest.
	do {
		if (targetCount <= 0) reaction = false;
		// Reactor (Targets) rolls first
		// 2 rolls
		for (let i = 0; i < 2; i++) {
			// Select advantage
			advantage = advantage ?? await chooseAdvantage();	
// TODO: link ability and user sheets for identification of roller regardless of 'dual-heat'
// Use the linked actor to give options for which actor to roll with
			actor = await findRoller(i, reaction);
			if (!actor) return;
			--targetCount;

			const hasOwner = Object.entries(actor.ownership || {})
				.some(([uid, lvl]) => {
					const u = game.users.get(uid);
					return u?.active && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
				});

			stat = await requestStat(actor);
			if (!stat) {
				ui.notifications.warn("Stat selection cancelled.");
				return;
			}

			// Let the player roll if desired
			if (game.user.isGM && hasOwner && await confirmRoller(actor)) {
				rollSum += await socket.executeAsUser(
					"pCheck"
					, findOwner(actor).id
					, actor.id
					, `(${stat[1]}d6cs>=${5-advantage})`
					, stat[0]
					, advantage
					, actor.getRollData()
				);
				continue;
			}

			// Otherwise roll here
			const formula = `(${stat[1]}d6cs>=${5-advantage})`;
			const data = actor.getRollData();
			const roll = new Roll(formula, data);
			await roll.evaluate({
				async: true
			});
			roll.toMessage({
				speaker: ChatMessage.getSpeaker({
					actor
				})
				, flavor: `★ <em>${stat[0]}</em> Challenge ★<br>Advantage: <strong>${advantage}</strong>`
			});
			rollSum += roll.total;
		}
		const ownerIds = game.users
			.filter(u => actor.testUserPermission(u, "OWNER"))
			.map(u => u.id);

		const DC = convDC(rollSum);
		ChatMessage.create({
			speaker: ChatMessage.getSpeaker({
				actor
			})
			, content: `Total: ${rollSum}! ${DC}`
			, whisper: ownerIds
		});
		if (!reactSum) {
			reactSum = rollSum;
			reactor = actor;
		} else {
			let diff = Math.abs(reactSum - rollSum);
			if (diff < 0) diff = 0;
			const hit = convHit(diff);
			ChatMessage.create({
				speaker: ChatMessage.getSpeaker({
					actor: reactor
				})
				, content: `Hit: ${hit} (${diff})`
				, whisper: ownerIds
			});
		}
		// Reset for next roller
		rollSum = 0;
		advantage = null;
		actor = null;
		stat = null;
	} while (reaction);
}
// roller.js
let socket;

// 1) Register your socket function as soon as socketlib is ready
Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerSystem("bizarre-adventures-d6");
  socket.register("pCheck", readyCheck);
});

// 2) Inject your scene button on init
Hooks.once("init", () => {
  rollerControl();
});

export function rollerControl() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.tokens;
    if (!tokenControls) return;

    tokenControls.tools["rollerButton"] = {
      name:    "rollerButton",
      title:   "D6 Roller",
      icon:    "fas fa-dice-d6",
      visible: true,
      button:  true,
      order:   50,
      onClick: () => main()
    };
  });
}

// 3) The remote helper: takes an actorId, not an Actor instance
async function readyCheck(actorId, formula, statLabel, advantage, data) {
  const actor = game.actors.get(actorId);
  if (!actor) return null;

  const advantagePhrase = advantage > 0 ? ` with +${advantage} advantage` : "";
  const content = `<p>Roll <strong>${statLabel}</strong>${advantagePhrase}? <code>(${formula})</code></p>`;

  const confirmed = await new Promise(resolve => {
    new Dialog({
      title:   "A Roll is Ready",
      content,
      buttons: {
        Yes: { label: "Yes", callback: () => resolve(true) },
        No:  { label: "No",  callback: () => resolve(false) }
      },
      default: "No"
    }).render(true);
  });
  if (!confirmed) return null;

  const roll = new Roll(formula, data);
  await roll.evaluate({ async: true });
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `★ <em>${statLabel}</em> Challenge ★<br>Advantage Level: <strong>${advantage}</strong>`
  });
  return roll.total;
}

// 4) Utility dialogs (unchanged)
function chooseAdvantage() {
  return new Promise(resolve => {
    new Dialog({
      title: "Choose Advantage",
      content: "<p>Select an advantage value (0–3):</p>",
      buttons: {
        0: { label: "0", callback: () => resolve(0) },
        1: { label: "1", callback: () => resolve(1) },
        2: { label: "2", callback: () => resolve(2) },
        3: { label: "3", callback: () => resolve(3) }
      },
      default: "0"
    }).render(true);
  });
}

async function findRoller(i) {
  if (game.user.isGM) {
    if (canvas.tokens.controlled.length === 1) i = 0;
    const token = canvas.tokens.controlled[i];
    if (!token) {
      ui.notifications.warn("No token selected. Select up to 2.");
      return null;
    }
    return token.actor;
  }
  const owned = game.actors.filter(a => a.isOwner);
  if (owned.length === 0) {
    ui.notifications.warn("You don't own any actors.");
    return null;
  }
  if (owned.length === 1) return owned[0];

  return new Promise(resolve => {
    const buttons = {};
    for (let a of owned) {
      buttons[a.id] = {
        label:    a.name,
        callback: () => resolve(a)
      };
    }
    new Dialog({
      title:   "Choose an Actor",
      content: "<p>Select an actor:</p>",
      buttons,
      default: Object.keys(buttons)[0]
    }).render(true);
  });
}

function requestStat(actor) {
  return new Promise(resolve => {
    let sources;
    if (actor.system.attributes?.ustats || actor.system.attributes?.sstats) {
      sources = {
        ustats: actor.system.attributes?.ustats || {},
        sstats: actor.system.attributes?.sstats || {}
      };
    }
    else if (actor.type === "stand" || actor.type === "power") {
      sources = { sstats: actor.system.attributes?.stats || {} };
    }
    else if (actor.type === "user") {
      sources = { ustats: actor.system.attributes?.stats || {} };
    }
    else {
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
            label,
            callback: () => resolve([ name, stat.value ])
          };
        }
      }
    }
    if (!Object.keys(buttons).length) {
      ui.notifications.warn("No numeric stats found.");
      return resolve(null);
    }

    new Dialog({
      title:   "Choose a Stat",
      content: "<p>Select a stat:</p>",
      buttons,
      default: Object.keys(buttons)[0]
    }, {
      width: 400,
      classes: ["roller-dialog"]
    }).render(true);
  });
}

async function confirmRoller(actor) {
  const nonGm = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  const player = nonGm || game.users.find(u => u.isGM);
  if (!player) return false;

  return new Promise(resolve => {
    new Dialog({
      title: "Player Owner Detected",
      content: "<p>Have the player finish this roll?</p>",
      buttons: {
        Yes: { label: "Yes", callback: () => resolve(true)  },
        No:  { label: "No",  callback: () => resolve(false) }
      }
    }).render(true);
  });
}

function convDC(value) {
  const map = {
    0: "Trivial", 1: "Easy",      2: "Challenging", 3: "Dire",
    4: "Herculean",5: "Extraordinary",6: "Superhuman",
    7: "Unbelievable", 8: "Surreal", 9: "Absurd", 10: "Nigh-Impossible"
  };
  return map[value] || "Literally Impossible";
}

// 5) The main entrypoint
async function main() {
  let rollSum = 0;
  let advantage, actor, stat;

  for (let i = 0; i < 2; i++) {
    advantage = advantage ?? await chooseAdvantage();
    actor    = await findRoller(i);
    if (!actor) return;

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
        "pCheck",
        findOwner(actor).id,
        actor.id,
        `(${stat[1]}d6cs>=${5-advantage})`,
        stat[0],
        advantage,
        actor.getRollData()
      );
      continue;
    }

    // Otherwise roll here
    const formula = `(${stat[1]}d6cs>=${5-advantage})`;
    const data    = actor.getRollData();
    const roll    = new Roll(formula, data);
    await roll.evaluate({ async: true });
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  `★ <em>${stat[0]}</em> Challenge ★<br>Advantage: <strong>${advantage}</strong>`
    });
    rollSum += roll.total;
  }
  const ownerIds = game.users
  .filter(u => actor.testUserPermission(u, "OWNER"))
  .map(u => u.id);

  const DC = convDC(rollSum);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `Total: ${rollSum}! ${DC}`,
    whisper: ownerIds
  });
}


// Helper to find a non-GM owner or fallback to GM
function findOwner(actor) {
  return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
      || game.users.find(u => u.isGM);
}

// modules/migration.js

// 1) Register the world-setting as soon as possible
Hooks.once("init", () => {
  game.settings.register("bizarre-adventures-d6", "migrationVersion", {
    name:    "Last migration version",
    scope:   "world",
    config:  false,
    type:    String,
    default: "0.0.0"
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

  const isNewer = (a, b) => {
    const [A,B,C] = a.split(".").map(Number);
    const [X,Y,Z] = b.split(".").map(Number);
    return A> X || (A===X && (B>Y || (B===Y && C>Z)));
  };

  // — First ever world load —
  if ( previous === "0.0.0" ) {
    ChatMessage.create({
      user:    game.user.id,
      speaker: { alias: game.system.title },
      content: `<h2>Welcome to BAD6!</h2>
      <p> Controls: </p>
        <ul>
          <li>🎲 The macro is no longer functional. Instead, use the "D6 Roller" in token controls.</li>
          <li>🎲 As a GM, highlight up to 2 tokens then run the roller to roll their stats.</li>
          <li>🎲 As a player, select from your owned tokens for each roll.</li>
          <li>🔧 Hue Shift - Within Lighting controls, click the "Hue Shift Canvas" button to shift the hue 30 degrees. By default, use ctrl+h to reset the hue</li>
          <li>🌟 To Be Continued - Click the button to place the animation over all screens, turning off all current music. Create a Scene called "Outro" and it will automatically switch to it afterwards.</li>
        </ul>
        <p> This product is unfinished! Certain features are not yet implemented such as...</p>
        <ul>
          <li> Dark Determination </li>
          <li> Full Type Support </li>
          <li> Custom Combat Implementation </li>
        </ul>
        <p> Please report any bugs, ideas, or comments to itpart on Discord. I would love to make this the perfect system with your help! </p>`,
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  // — 0.9.1 migration: “Learning” → “Luck” —
  if ( isNewer(current, previous)
    && isNewer("0.9.1", previous)
    && !isNewer("0.9.1", current)
  ) {
    for ( const actor of game.actors.filter(a => a.type === "user") ) {
      if ( actor.system.attributes.stats.luck?.label === "Learning" ) {
        await actor.update({ "system.attributes.stats.luck.label": "Luck" });
      }
    }
    console.log("BAD6 | Applied 0.9.1 migration (Luck label fixed from Learning → Luck).");
  }

    // — 0.9.2 migration: “min 0” → “min -2” —
    if ( isNewer("0.9.2", previous) && !isNewer("0.9.2", current) ) {
        const updates = [];
        for ( const actor of game.actors.filter(a => a.type === "user") ) {
            if ((actor.system.health.min ?? 0) === 0) {
            updates.push(actor.update({ "system.health.min": -2 }));
            }
        }
        await Promise.all(updates);
        console.log("BAD6 | Applied 0.9.2 migration (user minimum health → –2).");
    }

  // — Record that we’re now at `current` —
  await game.settings.set("bizarre-adventures-d6", "migrationVersion", current);
});

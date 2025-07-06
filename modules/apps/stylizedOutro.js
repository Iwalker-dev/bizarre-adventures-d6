// outro.js
let socket;

// 1) Register your socket handler
Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerSystem("bizarre-adventures-d6");
  socket.register("triggerOutroEffect", triggerOutroEffect);
});

// 2) Wire up your scene button on init
Hooks.once("init", () => {
  outroControl();
});

export function outroControl() {
  console.log("Setting up JJBA Outro…");
  Hooks.on("getSceneControlButtons", (controls) => {
    const lighting = controls.lighting;
    if (!lighting) return;

    lighting.tools["triggerOutro"] = {
      name:    "triggerOutro",
      title:   "Trigger Outro",
      icon:    "fas fa-play-circle",
      visible: game.user.isGM,
      button:  true,
      order:   100,
      onClick: () => sendOutroEffect(25, 200)
    };
  });
}

// 3) Send the outro effect (GM → everyone) and switch scene after delay
function sendOutroEffect(wiggleAmount, wiggleDuration) {
  console.log("Stopping all playlists");
  for ( let pl of game.playlists ) pl.stopAll();

  if (socket) {
    console.log("Broadcasting outro effect to all clients…");
    socket.executeForEveryone("triggerOutroEffect", wiggleAmount, wiggleDuration);
  } else {
    console.error("Socketlib is not initialized!");
  }

  // Delay scene switch until after the arrow animation
  setTimeout(() => {
    const outroScene = game.scenes.find(s => s.name === "Outro");
    if (outroScene) {
      console.log("Switching to Outro scene…");
      outroScene.activate();
    } else {
      console.warn("No scene named 'Outro' found.");
    }
  }, 2500);
}

// 4) Client-side effect: tint, arrow, shake
function triggerOutroEffect(wiggleAmount, wiggleDuration) {
  console.log("Outro received, everybody freeze!");

  // Create screen tint
  const tint = document.createElement("div");
  tint.id = "screen-tint";
  Object.assign(tint.style, {
    position:   "fixed",
    top:        "0",
    left:       "0",
    width:      "100%",
    height:     "100%",
    background: "rgba(255,215,0,0.17)",
    zIndex:     "1000"
  });
  document.body.appendChild(tint);

  // Create "To Be Continued" arrow
  const arrow = document.createElement("img");
  arrow.id  = "tbc-arrow";
  arrow.src = "https://i.imgur.com/Wfb38uh.png";
  Object.assign(arrow.style, {
    position:   "fixed",
    bottom:     "10px",
    left:       "100vw",
    width:      "500px",
    height:     "auto",
    opacity:    "0",
    transition: "left 1.4s ease-out, opacity 2s ease-in",
    zIndex:     "2000"
  });
  document.body.appendChild(arrow);

  // Kick off the arrow animation
  requestAnimationFrame(() => {
    arrow.style.left    = "0";
    arrow.style.opacity = "1";

    // After the arrow finishes, do the shake + cleanup
    setTimeout(() => {
      const originalPan = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };
      const shakeEnd    = Date.now() + wiggleDuration;

      (function shake() {
        if (Date.now() >= shakeEnd) {
          canvas.pan(originalPan);
          setTimeout(() => {
            arrow.remove();
            tint.remove();
            console.log("Outro cleanup complete.");
          }, 500);
          return;
        }
        const xOff = (Math.random() - 0.5) * wiggleAmount;
        const yOff = (Math.random() - 0.5) * wiggleAmount;
        canvas.pan({ x: originalPan.x + xOff, y: originalPan.y + yOff, duration: 50 });
        requestAnimationFrame(shake);
      })();
    }, 1400);  // start shake after arrow has moved on-screen
  });
}

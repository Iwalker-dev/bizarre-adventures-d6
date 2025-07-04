// hue-shift.js
let socket;
let hueFilter;
let currentHue = 0;
let targetHue  = 0;
let animTicker = null;

// 1) Register your socket handler
Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerSystem("bizarre-adventures-d6");
  socket.register("stepHueShift", stepHueShift);
});

// 2) Ensure your control hooks are bound on init
Hooks.once("init", () => {
  HueShiftControl();
});

export function HueShiftControl() {
  // Add a “Hue Shift” tool to the lighting controls
  Hooks.on("getSceneControlButtons", (controls) => {
    const lightingControls = controls.lighting;
    if (!lightingControls) return;

    lightingControls.tools["hueShift"] = {
      name:   "hueShift",
      title:  "Hue Shift Canvas",
      icon:   "fas fa-adjust",
      visible: game.user.isGM,
      button:  true,
      toggle:  true,
      active:  targetHue !== 0,
      order:   100,
      onClick: () => {
        socket.executeForEveryone("stepHueShift", 30);
        ui.controls.render();
      }
    };
  });

/* TODO: Uncomment this section to add a right-click reset option

  Hooks.on("renderSceneControls", (_controls, html) => {
    // Find our tool each render
    const toolEl = html.querySelector('li.control-tool[data-tool="hueShift"]');
    if (!toolEl) return;

    // Avoid double-binding
    if (toolEl._hueListener) return;
    toolEl._hueListener = true;

    // Catch the right-click on mousedown, in capture phase
    toolEl.addEventListener("mousedown", event => {
      if (event.button !== 2) return;      // only right-click
      event.stopImmediatePropagation();    // kill Foundry’s listener
      event.preventDefault();              // no browser menu

      // Reset hue and refresh the controls
      socket.executeForEveryone("stepHueShift", -targetHue);
      ui.controls.render();
    }, { capture: true });
  });

*/
}

// Core hue-shifting logic, run via socket on everyone
function stepHueShift(step = 30) {
  if (!canvas.scene) return;

  // Create & attach the filter if needed
  if (!hueFilter) {
    hueFilter = new PIXI.filters.ColorMatrixFilter();
    canvas.app.stage.filters = [...(canvas.app.stage.filters || []), hueFilter];
  }

  // Update target and start the animation ticker if not already running
  targetHue = (targetHue + step + 360) % 360;
  if (animTicker) return;

  animTicker = delta => {
    // Gradually move currentHue toward targetHue
    const speed = delta;
    const diff  = ((targetHue - currentHue + 540) % 360) - 180;
    currentHue = Math.abs(diff) < speed
      ? targetHue
      : (currentHue + Math.sign(diff) * speed + 360) % 360;

    // Apply the hue
    hueFilter.hue(currentHue, false);

    // Update the button glow if the Lighting tab is open
    if (ui.controls.control?.name === "lighting") {
      const tool = ui.controls.control.tools?.["hueShift"];
      if (tool) tool.active = (targetHue !== 0);
      ui.controls.render();
    }

    // Stop when done
    if (currentHue === targetHue) {
      PIXI.Ticker.shared.remove(animTicker);
      animTicker = null;
    }
  };

  PIXI.Ticker.shared.add(animTicker);
}

// Re-apply filter & ticker if you reload the canvas
Hooks.on("canvasReady", () => {
  if (currentHue === 0 && targetHue === 0) return;

  // Recreate the filter
  hueFilter = new PIXI.filters.ColorMatrixFilter();
  hueFilter.hue(currentHue, false);
  canvas.app.stage.filters = [...(canvas.app.stage.filters || []), hueFilter];

  // Restart the ticker if needed
  if (!animTicker && currentHue !== targetHue) {
    animTicker = delta => {
      const speed = delta;
      const diff  = ((targetHue - currentHue + 540) % 360) - 180;
      currentHue = Math.abs(diff) < speed
        ? targetHue
        : (currentHue + Math.sign(diff) * speed + 360) % 360;

      hueFilter.hue(currentHue, false);

      if (ui.controls.control?.name === "lighting") {
        const tool = ui.controls.control.tools?.["hueShift"];
        if (tool) tool.active = (targetHue !== 0);
        ui.controls.render();
      }

      if (currentHue === targetHue) {
        PIXI.Ticker.shared.remove(animTicker);
        animTicker = null;
      }
    };
    PIXI.Ticker.shared.add(animTicker);
  }
});

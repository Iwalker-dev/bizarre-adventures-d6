let socket;
let hueFilter;
let currentHue = 0;
let targetHue = 0;
let animTicker = null;

// Register socketlib functions
Hooks.once("socketlib.ready", () => {
  socket = socketlib.registerSystem('bizarre-adventures-d6');
  socket.register("stepHueShift", stepHueShift);
});
export function HueShiftControl() {
    // Add the Lighting Control button
    Hooks.on("getSceneControlButtons", (controls) => {
    const lightingControls = controls.find(c => c.name === "lighting");
    if (!lightingControls) return;

    lightingControls.tools.push({
        name: "hueShift",
        title: "Hue Shift Canvas",
        icon: "fas fa-adjust",
        visible: game.user.isGM,
        button: true,
        toggle: true,
        active: targetHue !== 0,
        onClick: () => {
        socket.executeForEveryone("stepHueShift", 30);
        ui.controls.render(); // Ensure the glow updates immediately
        }
    });
    });


  // Handle right-click context menu to reset hue shift
  Hooks.once("renderSceneControls", (_controls, html) => {
    // Avoid adding the listener more than once
    if (window._hueResetListenerAdded) return;
    window._hueResetListenerAdded = true;

    document.addEventListener("pointerdown", event => {
      // Only care about right-clicks
      if (event.button !== 2) return;
      // See if the click happened inside our hueShift tool
      const toolLi = event.target.closest('li.control-tool[data-tool="hueShift"]');
      if (!toolLi) return;

      // Stop Foundry’s context-menu suppression and normal processing
      event.preventDefault();
      event.stopPropagation();

      // Reset to zero by sending −targetHue
      const resetStep = -targetHue;
      socket.executeForEveryone("stepHueShift", resetStep);
      ui.controls.render();
    }, /* useCapture */ true);
  });
}

// Main function that handles hue shifting
function stepHueShift(step = 30) {
  if (!canvas?.scene) return;

  // Set up filter if not already
  if (!hueFilter) {
    hueFilter = new PIXI.filters.ColorMatrixFilter();
    canvas.app.stage.filters = [...(canvas.app.stage.filters || []), hueFilter];
  }

  // Update the target hue
  targetHue = (targetHue + step) % 360;

  // Start animating if not already
  if (!animTicker) {
    animTicker = (delta) => {
      const speed = 1 * delta;
      const diff = ((targetHue - currentHue + 540) % 360) - 180; // shortest path
      if (Math.abs(diff) < speed) {
        currentHue = targetHue;
      } else {
        currentHue += Math.sign(diff) * speed;
        currentHue = (currentHue + 360) % 360;
      }

      hueFilter.hue(currentHue, false);

      // Update glow state
      const toolName = "hueShift";
      const shouldGlow = targetHue !== 0;

      if (ui.controls.control?.name === "lighting") {
        const lighting = ui.controls.controls.find(c => c.name === "lighting");
        if (lighting) {
          const tool = lighting.tools.find(t => t.name === toolName);
          if (tool) tool.active = shouldGlow;
        }
        ui.controls.render();
      }

      // Stop animating if target reached
      if (currentHue === targetHue) {
        PIXI.Ticker.shared.remove(animTicker);
        animTicker = null;
      }
    };

    PIXI.Ticker.shared.add(animTicker);
  }
}

Hooks.on("canvasReady", () => {
  if (targetHue !== 0 || currentHue !== 0) {
    // Recreate and apply filter
    hueFilter = new PIXI.filters.ColorMatrixFilter();
    hueFilter.hue(currentHue, false);
    canvas.app.stage.filters = [...(canvas.app.stage.filters || []), hueFilter];

    // Restart animation if needed
    if (currentHue !== targetHue && !animTicker) {
      animTicker = (delta) => {
        const speed = 1 * delta;
        const diff = ((targetHue - currentHue + 540) % 360) - 180;
        if (Math.abs(diff) < speed) {
          currentHue = targetHue;
        } else {
          currentHue += Math.sign(diff) * speed;
          currentHue = (currentHue + 360) % 360;
        }

        hueFilter.hue(currentHue, false);

        // Update glow state
        const toolName = "hueShift";
        const shouldGlow = targetHue !== 0;
        if (ui.controls.control?.name === "lighting") {
          const lighting = ui.controls.controls.find(c => c.name === "lighting");
          if (lighting) {
            const tool = lighting.tools.find(t => t.name === toolName);
            if (tool) tool.active = shouldGlow;
          }
          ui.controls.render();
        }

        if (currentHue === targetHue) {
          PIXI.Ticker.shared.remove(animTicker);
          animTicker = null;
        }
      };

      PIXI.Ticker.shared.add(animTicker);
    }
  }
});

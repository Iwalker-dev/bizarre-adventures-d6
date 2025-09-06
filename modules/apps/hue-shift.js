// hue-shift.js
let socket;
let hueFilter;
let currentHue = 0;
let targetHue = 0;
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

	// —— A) Register the Reset-Hue keybinding here ——
	game.keybindings.register("bizarre-adventures-d6", "resetHue", {
		name: "Reset Canvas Hue"
		, hint: "Zero out the current scene hue filter"
		, editable: [
			{
				key: "KeyH"
				, modifiers: ["Control"]
			} // default Ctrl+H
    ]
		, restricted: true, // GMs only
		onDown: () => {
			if (!game.user.isGM) return false;
			socket.executeForEveryone("stepHueShift", -targetHue);
			ui.controls.render();
			return false; // Prevent browser reload
		}
	});
	// 1) Left–click via onChange (no deprecation warnings)
	Hooks.on("getSceneControlButtons", (controls) => {
		const lighting = controls.lighting;
		if (!lighting) return;
		lighting.tools.hueShift = {
			name: "hueShift"
			, title: "Hue Shift Canvas"
			, icon: "fas fa-adjust"
			, visible: game.user.isGM
			, button: true
			, toggle: false
			, active: targetHue !== 0
			, order: 100
			, onChange: (_value, event) => {
				if (event.shiftKey) {
					// Shift+click resets
					socket.executeForEveryone("stepHueShift", -targetHue);
				} else {
					// Normal click advances
					socket.executeForEveryone("stepHueShift", 30);
				}
				ui.controls.render();
			}
		};
	});


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
		const diff = ((targetHue - currentHue + 540) % 360) - 180;
		currentHue = Math.abs(diff) < speed ?
			targetHue :
			(currentHue + Math.sign(diff) * speed + 360) % 360;

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
			const diff = ((targetHue - currentHue + 540) % 360) - 180;
			currentHue = Math.abs(diff) < speed ?
				targetHue :
				(currentHue + Math.sign(diff) * speed + 360) % 360;

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

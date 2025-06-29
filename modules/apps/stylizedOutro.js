let socket;
/*
Uses code from https://github.com/edgedoggo/fvtt-earthquake/ (removable upon request)
Uses arrow from https://imgur.com/Wfb38uh (removable upon request)
*/

Hooks.once("socketlib.ready", () => {
	socket = socketlib.registerSystem('bizarre-adventures-d6');
	socket.register("triggerOutroEffect", triggerOutroEffect);
});

export async function outroControl() {
    console.log("Setting up JJBA Outro...");
	Hooks.on("getSceneControlButtons", (controls) => {
		// Add the control under an existing section (e.g., "token")
		const tokenControls = controls.find(control => control.name === "lighting");

		if (tokenControls) {
			tokenControls.tools.push({
				name: "triggerOutro",
				title: "Trigger Outro",
				icon: "fas fa-play-circle",
				visible: game.user.isGM,
				onClick: () => sendOutroEffect(50, 2000), // Broadcast to all users
				button: true
			});
		}
	});
//	ui.controls.render(true);
}

// Send the outro effect to all connected users
function sendOutroEffect(wiggleAmount, wiggleDuration) {
	// Stop all currently playing music
	console.log("Stopping all playlists");
	game.playlists.contents.forEach(playlist => {
		console.log(`Stopping playlist: ${playlist.name}`);
		playlist.stopAll();
	});
	if (socket) {
		console.log("Broadcasting outro effect to all clients...");
		socket.executeForEveryone("triggerOutroEffect", wiggleAmount, wiggleDuration);
	} else {
		console.error("Socketlib is not initialized. Cannot broadcast outro effect.");
	}
	setTimeout(() => {
		// Switch to "Outro" scene if it exists
		const outroScene = game.scenes.find(scene => scene.name === "Outro");
		if (outroScene) {
			console.log("Switching to Outro scene...");
			outroScene.activate();
		} else {
			console.log("Outro scene not found. Please create a scene named 'Outro' to use this feature.");
		}
	}, 2500);
}

function triggerOutroEffect(wiggleAmount, wiggleDuration) {
	console.log("Outro received, everybody freeze!");

	// Screen tint HTML
	console.log("to-be-continued Client-Side: Setting up screen tint HTML");
	let tintHtml = `<div id="screen-tint" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 215, 0, 0.17); z-index: 1000;"></div>`;

	// Create To Be Continued Arrow
	let arrow = document.createElement('img');
	arrow.id = 'tbc-arrow';
	arrow.src = 'https://i.imgur.com/Wfb38uh.png';
	arrow.style.cssText = `
		position: fixed;
		bottom: 10px;
		left: 100vw;
		width: 500px;
		height: auto;
		border: none;
		opacity: 0;
		transition: left 1.4s, opacity 2s;
		z-index: 2000;
	`;

	// Append arrow to body and start the arrow animation
	console.log("to-be-continued Client-Side: Appending HTML elements to body");
	document.body.appendChild(arrow);
	$("body").append(tintHtml);

	console.log("to-be-continued Client-Side: Starting arrow animation");
	setTimeout(() => {
		$("#tbc-arrow").css({
			"left": "0",
			"opacity": "1"
		});
		console.log("to-be-continued Client-Side: Arrow animation started");

		// Delay for the arrow animation to finish
		setTimeout(() => {
			// Start screen shake for half a second
			console.log("Starting screen shake...");
			const originalPosition = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y };
			const shakeEnd = Date.now() + 500; // Shake duration of half a second

			function shake() {
				const currentTime = Date.now();
				if (currentTime >= shakeEnd) {
					// Restore the original position and end shaking
					canvas.pan(originalPosition);
					console.log("Screen shake ended.");

					// Remove the arrow and screen tint after half a second delay
					setTimeout(() => {
						$("#tbc-arrow").remove();
						$("#screen-tint").remove();
						console.log("Arrow and screen tint removed.");
					}, 500);
					return;
				}

				// Apply random shake offsets
				const xOffset = Math.floor(Math.random() * wiggleAmount - wiggleAmount / 2);
				const yOffset = Math.floor(Math.random() * wiggleAmount - wiggleAmount / 2);
				canvas.pan({
					x: originalPosition.x + xOffset,
					y: originalPosition.y + yOffset,
					duration: 50
				});

				requestAnimationFrame(shake);
			}
			shake();
		}, 1300); // Adjust this delay to match the end of the arrow's animation
	}, 500);
}
import { renderStars } from "./objects/stat-star-render.js";
import { renderStatChart } from "./objects/stat-chart-render.js";

export function setupStats() {
	Hooks.on("renderActorSheet", (app, html, data) => {
		console.log("Actor sheet rendered. Updating UI and background...");

		// Star + Chart rendering
		renderStars(html, app.actor);
		renderStatChart(app, html, data);

		// Tab rendering
		if (!app.activeTab) app.activeTab = "stats";

		html.find(".tabs a").removeClass("active");
		html.find(`.tabs a[data-tab='${app.activeTab}']`).addClass("active");
		html.find(".tab").hide();
		html.find(`.tab[data-tab='${app.activeTab}']`).show();

		html.find(".tabs a").on("click", (event) => {
			event.preventDefault();
			const clickedTab = $(event.currentTarget).data("tab");
			app.activeTab = clickedTab;

			html.find(".tabs a").removeClass("active");
			$(event.currentTarget).addClass("active");

			html.find(".tab").hide();
			html.find(`.tab[data-tab='${clickedTab}']`).show();

			html.find(".tabs .button-container").removeClass("active");
			html.find(`.tabs .button-container:has(a[data-tab='${clickedTab}'])`).addClass("active");
		});

		html.find(".tabs .button-container").removeClass("active");
		html.find(`.tabs .button-container:has(a[data-tab='${app.activeTab}'])`).addClass("active");

		// Color theming
		let userColor;
		const ownerUser = game.users.players.find(u => app.actor.testUserPermission(u, "OWNER"));
		if (ownerUser?.color) {
			userColor = `${ownerUser.color.toString(16).padStart(6, "0")}`;
		} else {
			const gmUser = game.users.find(u => u.isGM && u.active && u.color);
			userColor = gmUser ? `${gmUser.color.toString(16).padStart(6, "0")}` : "#ffffff";
		}

		const lightColor = lightenColor(userColor, 30);
		const darkColor = lightenColor(userColor, -30);

		const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>
        <rect width='40' height='40' fill='#000000'/>
        <path d='M20 0 L40 20 L20 40 L0 20 Z' fill='${userColor}'/>
        <path d='M20 10 L30 20 L20 30 L10 20 Z' fill='${lightColor}'/>
      </svg>`;

		const encodedSvg = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
		const sheetRoot = html[0];
		sheetRoot.style.setProperty("--jojo-sheet-background", encodedSvg);
		sheetRoot.style.setProperty("--accent-color", userColor);
		sheetRoot.style.setProperty("--accent-light", lightColor);
		sheetRoot.style.setProperty("--accent-dark", darkColor);

		// Cutsom Button Handling
		const bioButton = html.find(".tabs a[data-tab='bio']");
		const hitButton = html.find(".tabs a[data-tab='hit']");
		const hitTabContent = html.find(".tab[data-tab='hit']");

		bioButton.on("click", (event) => {
			event.preventDefault();
			html.find(".tabs a").removeClass("active");
			bioButton.addClass("active");
			html.find(".tab").hide();
			html.find(".tab[data-tab='bio']").show();
		});

		hitButton.on("click", (event) => {
			event.preventDefault();
			html.find(".tabs a").removeClass("active");
			hitButton.addClass("active");
			html.find(".tab").hide();
			hitTabContent.show();
		});
	});

	Hooks.on("preCreateItem", (item, options, userId) => {
		if (!item.type) throw new Error("Item validation error: type may not be undefined");
	});
}

function lightenColor(hex, percent) {
	const num = parseInt(hex.slice(1), 16);
	const amt = Math.round(2.55 * percent);
	const R = Math.min(255, (num >> 16) + amt);
	const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
	const B = Math.min(255, (num & 0x0000FF) + amt);
	return `rgb(${R}, ${G}, ${B})`;
}

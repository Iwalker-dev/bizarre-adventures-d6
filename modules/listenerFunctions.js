import { renderStars } from "./objects/stat-star-render.js";
import { renderStatChart } from "./objects/stat-chart-render.js";
import { isDebugEnabled } from "./config.js";

export function setupStats() {
	Hooks.on("renderActorSheet", (app, html, data) => {
		if (isDebugEnabled()) {
			console.log("Actor sheet rendered. Updating UI and background...");
		}

		// Star + Chart rendering
		renderStars(html, app.actor);
		renderStatChart(app, html, data);

		// Tab rendering
		if (!app.activeTab) app.activeTab = "stats";

		const activateTab = (tabName) => {
			if (!tabName) return;

			app.activeTab = tabName;
			html.find(".tabs a, .tabs .button-container").removeClass("active").attr("aria-selected", "false");
			html.find(`.tabs a[data-tab='${tabName}']`).addClass("active").attr("aria-selected", "true");
			html.find(`.tabs .button-container:has(a[data-tab='${tabName}'])`).addClass("active").attr("aria-selected", "true");

			html.find(".tab").hide();
			html.find(`.tab[data-tab='${tabName}']`).show();
		};

		html.find(".tabs .button-container")
			.attr("tabindex", "0")
			.attr("role", "button")
			.attr("aria-selected", "false")
			.on("click keydown", (event) => {
				if (event.type === "keydown" && !["Enter", " ", "Spacebar"].includes(event.key)) return;
				event.preventDefault();
				const clickedTab = $(event.currentTarget).find("a[data-tab]").data("tab");
				activateTab(clickedTab);
			});

		html.find(".tabs a")
			.attr("role", "tab")
			.attr("aria-selected", "false")
			.on("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				activateTab($(event.currentTarget).data("tab"));
			});

		activateTab(app.activeTab);

		// Color theming
		let userColor;
		const ownerUser = game.users.players.find(u => app.actor.testUserPermission(u, "OWNER"));
		if (ownerUser?.color) {
			userColor = normalizeHexColor(ownerUser.color.css ?? ownerUser.color.toString());
		} else {
			const gmUser = game.users.find(u => u.isGM && u.active && u.color);
			userColor = gmUser ? normalizeHexColor(gmUser.color.css ?? gmUser.color.toString()) : "#ffffff";
		}

		const lightColor = shiftColor(userColor, 30);
		const darkColor = shiftColor(userColor, -30);
		const accentContrast = getContrastTextColor(userColor);
		const accentDarkContrast = getContrastTextColor(darkColor);

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
		sheetRoot.style.setProperty("--accent-contrast", accentContrast);
		sheetRoot.style.setProperty("--accent-dark-contrast", accentDarkContrast);

		setupPortraitRibbonLoops(html[0]);

		// Cutsom Button Handling
		const bioButton = html.find(".tabs a[data-tab='bio']");
		const hitButton = html.find(".tabs a[data-tab='hit']");

		bioButton.on("click", (event) => {
			event.preventDefault();
			activateTab("bio");
		});

		hitButton.on("click", (event) => {
			event.preventDefault();
			activateTab("hit");
		});
	});

	Hooks.on("preCreateItem", (item, options, userId) => {
		if (!item.type) throw new Error("Item validation error: type may not be undefined");
	});
}

function shiftColor(hex, percent) {
	const normalizedHex = normalizeHexColor(hex);
	const num = parseInt(normalizedHex.slice(1), 16);
	const amt = Math.round(2.55 * percent);
	const r = clampColorChannel((num >> 16) + amt);
	const g = clampColorChannel(((num >> 8) & 0x00FF) + amt);
	const b = clampColorChannel((num & 0x0000FF) + amt);
	return `#${[r, g, b].map(value => value.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeHexColor(color) {
	if (!color) return "#ffffff";
	if (color.startsWith("#")) return color;
	if (color.startsWith("rgb")) {
		const channels = color.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
		return `#${channels.slice(0, 3).map(value => clampColorChannel(value).toString(16).padStart(2, "0")).join("")}`;
	}
	return `#${color.replace(/^#/, "")}`;
}

function clampColorChannel(value) {
	return Math.max(0, Math.min(255, value));
}

function getContrastTextColor(color) {
	const normalizedHex = normalizeHexColor(color);
	const num = parseInt(normalizedHex.slice(1), 16);
	const channels = [num >> 16, (num >> 8) & 0x00FF, num & 0x0000FF].map(channel => {
		const normalized = channel / 255;
		return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	const luminance = (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
	return luminance > 0.45 ? "#111111" : "#f5f5f5";
}

function setupPortraitRibbonLoops(sheetRoot) {
	if (!sheetRoot) return;

	const buildLoops = () => {
		sheetRoot.querySelectorAll(".jojo-portrait-ribbon").forEach((ribbon) => {
			const scroll = ribbon.querySelector(".jojo-portrait-scroll");
			if (!scroll) return;

			const seed = scroll.querySelector("span");
			const phrase = (seed?.textContent ?? "").replace(/\s+/g, " ").trim();
			if (!phrase) return;

			const isVertical = ribbon.classList.contains("jojo-portrait-ribbon--vertical");
			const measureSpan = document.createElement("span");
			measureSpan.textContent = phrase;
			scroll.replaceChildren(measureSpan);

			const tokenSize = isVertical ? measureSpan.getBoundingClientRect().height : measureSpan.getBoundingClientRect().width;
			const trackSize = isVertical ? ribbon.clientHeight : ribbon.clientWidth;
			if (!tokenSize || !trackSize) return;

			const minCount = Math.max(4, Math.ceil((trackSize * 1.5) / tokenSize) + 1);
			const fragment = document.createDocumentFragment();

			for (let index = 0; index < minCount * 2; index += 1) {
				const span = document.createElement("span");
				span.textContent = phrase;
				fragment.appendChild(span);
			}

			scroll.replaceChildren(fragment);
		});
	};

	requestAnimationFrame(() => {
		buildLoops();
		setTimeout(buildLoops, 80);
	});
}

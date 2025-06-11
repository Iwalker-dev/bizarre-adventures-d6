import { BAD6 } from "./modules/config.js";

// Dynamically load Chart.js from the CDN
async function loadChartJS() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/chart.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Wait for Chart.js to load before initializing the system
Hooks.once("init", async () => {
    console.log("BAD6 Core System is Initializing");

    // Load Chart.js
    await loadChartJS();
    console.log("Chart.js has been loaded");

    // Dynamically import UserSheet and StandSheet after Chart.js is loaded
    const { UserSheet } = await import("./modules/sheets/user-actor-sheet.js");
    const { StandSheet } = await import("./modules/sheets/stand-actor-sheet.js");
    const { PowerSheet } = await import("./modules/sheets/power-actor-sheet.js");
    const { HitItemSheet } = await import("./modules/sheets/hit-item-sheet.js");
    const { DefaultItemSheet } = await import("./modules/sheets/default-item-sheet.js");

    // Global Configuration Object Setup
    CONFIG.BAD6 = BAD6;
    CONFIG.INIT = true;

    // Unregister core sheets
    Items.unregisterSheet("core", ItemSheet);
    Actors.unregisterSheet("core", ActorSheet);

    // Register custom sheets
    Actors.registerSheet("bizarre-adventures-d6", UserSheet, {
        types: ["user"],
        makeDefault: true
    });
    Actors.registerSheet("bizarre-adventures-d6", StandSheet, {
        types: ["stand"],
        makeDefault: true
    });
    Actors.registerSheet("bizarre-adventures-d6", PowerSheet, {
        types: ["power"],
        makeDefault: true
    });
    Items.registerSheet("bizarre-adventures-d6", HitItemSheet, {
        types: ["hit"],
        makeDefault: true
    });
    Items.registerSheet("bizarre-adventures-d6", DefaultItemSheet, {
        types: ["item"],
        makeDefault: true
    });

    // Register item types in the system
    CONFIG.Item.documentClasses = {
        hit: HitItemSheet,
        item: DefaultItemSheet
    };

    // Load Partial-Handlebar Files
    preloadHandlebarsTemplates();

    // Register Additional Handlebar Helpers
    registerHandlebarsHelpers();
});

Hooks.once("ready", async () => {
    // Release Initialization Lock
    CONFIG.INIT = false;

    // Only Run as GM
    if (!game.user.isGM) return;
});

function preloadHandlebarsTemplates() {
    const templatePaths = [
        "systems/bizarre-adventures-d6/templates/sheets/user-actor-sheet.hbs",
        "systems/bizarre-adventures-d6/templates/sheets/stand-actor-sheet.hbs"
       //"/templates/actor-sheet-item.hbs",
    ];

    return loadTemplates(templatePaths);
}

function registerHandlebarsHelpers() {
    Handlebars.registerHelper("equals", function (v1, v2) { return (v1 === v2) });
    Handlebars.registerHelper("ifEquals", function (arg1, arg2, options) { return (arg1 == arg2) ? options.fn(this) : options.inverse(this); });
    Handlebars.registerHelper("contains", function (element, search) { return (v1 === v2) });
    Handlebars.registerHelper("concat", function (s1, s2, s3 = "") { return s1 + s2 + s3; });
    Handlebars.registerHelper("isGreater", function (p1, p2) { return (p1 > p2) });
    Handlebars.registerHelper("isEqualORGreater", function (p1, p2) { return (p1 >= p2) });
    Handlebars.registerHelper("ifOR", function (conditional1, conditional2) { return (conditional1 || conditional2) });
    Handlebars.registerHelper("doLog", function (value) { console.log(value) });
    Handlebars.registerHelper("toBoolean", function (string) { return (string === "true") });
    Handlebars.registerHelper('for', function (from, to, incr, content) {
        let result = "";
        for (let i = from; i < to; i += incr)
            result += content.fn(i);
        return result;
    });

    Handlebars.registerHelper("times", function (n, content) {
        let result = "";
        for (let i = 0; i < n; i++)
            result += content.fn(i);
        return result;
    });

    Handlebars.registerHelper("notEmpty", function (value) {
        if (value == 0 || value == "0") return true;
        if (value == null || value == "") return false;
        return true;
    });

    Handlebars.registerHelper('range', function (start, end) {
        const range = [];
        for (let i = start; i < end; i++) {
            range.push(i);
        }
        return range;
    });
}

// Define a centralized state object for stats
const statData = {};

// Function to render stars dynamically based on statData
function renderStars() {
  document.querySelectorAll(".stat-stars").forEach(container => {
    const statKey = container.dataset.stat;
    container.innerHTML = "";
    const value = statData[statKey] || 0;

    // Add stars dynamically
    for (let i = 1; i <= 6; i++) {
      const star = document.createElement("span");
      star.classList.add("stat-star");
      if (i <= value) star.classList.add("filled");
      star.textContent = (i === 6 ? "✶" : "★");

      // Add title for accessibility
      star.title = (i === 6)
        ? "∞ / Unmeasurable"
        : `Rank ${["E","D","C","B","A"][i - 1]}`;

      // Add click event listener to toggle star value
      star.addEventListener("click", () => {
        statData[statKey] = (statData[statKey] === i) ? i - 1 : i;
        renderStars();
      });

      container.appendChild(star);
    }

    // Add red class if the sixth star is active
    container.classList.toggle("infinite", value === 6);
  });
}

// Initialize statData and render stars
Hooks.on("renderActorSheet", (app, html, data) => {
  // Populate statData from actor system attributes
  Object.keys(data.actor.system.attributes.stats).forEach(statKey => {
    statData[statKey] = data.actor.system.attributes.stats[statKey]?.value || 0;
  });

  // Render stars
  renderStars();

  // Update actor stats when stars are clicked
  document.querySelectorAll(".stat-stars").forEach(container => {
    const statKey = container.dataset.stat;
    container.addEventListener("click", () => {
      const actor = app.actor;
      actor.update({ [`system.attributes.stats.${statKey}.value`]: statData[statKey] });
    });
  });
});

Hooks.on("renderActorSheet", (app, html, data) => {
    console.log("Actor sheet rendered. Updating background...");

    // Initialize the activeTab property for this specific sheet if it doesn't exist
    if (!app.activeTab) {
        app.activeTab = "stats"; // Default to the "Stats" tab
    }

    // Restore the active tab for this specific sheet
    html.find(".tabs a").removeClass("active");
    html.find(`.tabs a[data-tab='${app.activeTab}']`).addClass("active");

    html.find(".tab").hide(); // Hide all tabs
    html.find(`.tab[data-tab='${app.activeTab}']`).show(); // Show the active tab

    // Add click event listeners for tabs
    html.find(".tabs a").on("click", (event) => {
        event.preventDefault();
        const clickedTab = $(event.currentTarget).data("tab");

        // Update the active tab for this specific sheet
        app.activeTab = clickedTab;

        // Activate the clicked tab
        html.find(".tabs a").removeClass("active");
        $(event.currentTarget).addClass("active");

        // Show the corresponding tab content
        html.find(".tab").hide();
        html.find(`.tab[data-tab='${clickedTab}']`).show();

        // Ensure the active class is applied to the correct button container
        html.find(".tabs .button-container").removeClass("active");
        html.find(`.tabs .button-container:has(a[data-tab='${clickedTab}'])`).addClass("active");
    });

    // Ensure the active class is applied to the correct button container on initial render
    html.find(".tabs .button-container").removeClass("active");
    html.find(`.tabs .button-container:has(a[data-tab='${app.activeTab}'])`).addClass("active");

    // Debugging: Log the active tab
    console.log("Active tab set to:", app.activeTab);

// Extract the actor owner's color, falling back to the GM's color, and then white
let userColor;

// Try to use the actor owner's color first
const ownerId = Object.keys(app.actor.ownership).find(userId => app.actor.ownership[userId] === 3); // 3 = owner level
const ownerUser = game.users.get(ownerId);

if (ownerUser && ownerUser.color) {
  userColor = `${ownerUser.color.toString(16).padStart(6, "0")}`; // Convert numeric value to hex. Use the owner's color
  console.log("Using owner's color:", userColor);
} else {
  console.warn("No valid owner color found. Trying GM's color...");

  // If no owner's color is available, try to use the GM's color
  const gmUser = game.users.find(user => user.isGM && user.active);
  if (gmUser && gmUser.color) {
    userColor = gmUser.color; // Use the GM's color
    console.log("Using GM's color:", userColor);
  } else {
    // If no GM color is available, default to white
    console.warn("No valid GM color found. Defaulting to white.");
    userColor = "#ffffff";
  }
}

    // Generate lighter and darker versions of the user's color
    const lightColor = lightenColor(userColor, 30);
    const darkColor = lightenColor(userColor, -30);

    // Dynamically generate the SVG with the user's color
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'>
        <rect width='40' height='40' fill='#000000'/>
        <path d='M20 0 L40 20 L20 40 L0 20 Z' fill='${userColor}'/>
        <path d='M20 10 L30 20 L20 30 L10 20 Z' fill='${lightColor}'/>
      </svg>
    `;

    // Encode the SVG as a data URL
    const encodedSvg = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

    // Apply the background and accent colors to CSS variables
    const style = document.documentElement.style;
    style.setProperty("--jojo-sheet-background", encodedSvg);
    style.setProperty("--accent-color", userColor);
    style.setProperty("--accent-light", lightColor);
    style.setProperty("--accent-dark", darkColor);

    console.log("Updated background and accent colors:", { userColor, lightColor, darkColor });
    // Debugging: Check if the Biography button exists
    const bioButton = html.find(".tabs a[data-tab='bio']");
    if (bioButton.length === 0) {
      console.warn("Biography button not found in the tabs.");
      return;
    }

    // Add click event listener for the Biography button
      bioButton.on("click", (event) => {
      event.preventDefault();

      // Activate the Biography tab
      html.find(".tabs a").removeClass("active");
      bioButton.addClass("active");

      // Show the Biography tab content
      html.find(".tab").hide(); // Hide all tabs
      html.find(".tab[data-tab='bio']").show(); // Show the Biography tab
      });


    // Debugging: Check if the Hit button exists
    const hitButton = html.find(".tabs a[data-tab='hit']");
    if (hitButton.length === 0) {
      console.warn("Hit button not found in the tabs.");
      return;
    }

    // Add click event listener for the Hit button
    hitButton.on("click", (event) => {
      event.preventDefault();
      console.warn("Hit button clicked.");
      // Activate the Hit tab
      html.find(".tabs a").removeClass("active");
      hitButton.addClass("active");

      // Debugging: Check if the Hit tab content exists
      const hitTabContent = html.find(".tab[data-tab='hit']");
      if (hitTabContent.length === 0) {
        console.warn("Hit tab content not found.");
      } else {
        console.log("Hit tab content found:", hitTabContent);
      }

      // Debugging: Log visibility state of Hit tab content
      console.log("Hit tab visibility before show():", hitTabContent.is(":visible"));

      // Show the Hit tab content
      html.find(".tab").hide(); // Hide all tabs
      hitTabContent.show(); // Show the Hit tab

      // Debugging: Log visibility state of Hit tab content after show()
      console.log("Hit tab visibility after show():", hitTabContent.is(":visible"));
  });
});

Hooks.on("renderActorSheet", (app, html, data) => {
  // Define the mapping of types to stat labels
  const statLabels = {
    Hamon: ['Strength', 'Accuracy', 'Agility', 'Conduction', 'Blocking', 'Learning'],
    Vampire: ['Strength', 'Senses', 'Reflex', 'Bodily Control', 'Resilience', 'Learning'],
    'Pillar Man': ['Strength', 'Senses', 'Reflexes', 'Bodily Control', 'Resilience', 'Learning'],
    Spin: ['Mass', 'Control', 'Velocity', 'RPM', 'Sturdiness', 'Learning'],
    'Armed Phenomenon': ['Strength', 'Accuracy', 'Agility', 'Evolution', 'Endurance', 'Learning'],
    Cyborg: ['Tech Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning'],
    Other: ['Power', 'Precision', 'Speed', 'Range', 'Durability', 'Learning']
  };

  // Function to update stat labels based on the selected type
  const updateStatLabels = (type) => {
    const labels = statLabels[type] || statLabels.Other;
    html.find('[data-stat="power"] label').text(labels[0]);
    html.find('[data-stat="precision"] label').text(labels[1]);
    html.find('[data-stat="speed"] label').text(labels[2]);
    html.find('[data-stat="range"] label').text(labels[3]);
    html.find('[data-stat="durability"] label').text(labels[4]);
    html.find('[data-stat="learning"] label').text(labels[5]);
  };

  // Listen for changes in the dropdown
  html.find('#stand-type').on('change', (event) => {
    const selectedType = event.target.value;
    updateStatLabels(selectedType);
  });

  // Initialize labels on render
  const initialType = html.find('#stand-type').val();
  updateStatLabels(initialType);
});

Hooks.on("preCreateItem", (item, options, userId) => {
    // Ensure the item type is defined
    if (!item.type) {
        throw new Error("Item validation error: type may not be undefined");
    }

    // Optionally log the creation for debugging
    console.log(`Creating item of type: ${item.type}`);
});

// Helper function to lighten a color
function lightenColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}
// TODO: Implement DTypes, specifically burn-type stats
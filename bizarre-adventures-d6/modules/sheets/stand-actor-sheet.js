export class StandSheet extends ActorSheet {
  static statData = {
    power:     0,
    speed:      0,
    precision: 0,
    range:   0,
    durability: 0,
    learning:    0,
    luck:     0
  };
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["bizarre-adventures-d6", "sheet", "actor", "stand"],
      template: "systems/bizarre-adventures-d6/templates/sheets/stand-actor-sheet.hbs",
      width: 800,
      height: 800,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;

    // Add a helper to resolve the selected value for Burn-type stats
    data.getSelectedValue = (stat) => {
      const statData = this.actor.system.attributes.stats[stat];
      return statData[statData.selected] || 0;
    };

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Add event listeners for Burn-type stat switchers
    html.find(".switch-value").click(ev => {
      const button = ev.currentTarget;
      const stat = button.dataset.stat;
      const valueType = button.dataset.value;

      // Update the selected stat type and refresh the display
      this.actor.update({[`system.attributes.stats.${stat}.selected`]: valueType});
    });
  }

  renderStars(html) {
    html.find(".stat-stars").each((_, container) => {
      const statKey = container.dataset.stat;
      container.innerHTML = "";
      const value = StandSheet.statData[statKey] || 0;

      container.classList.toggle("infinite", value === 6);

      for (let i = 1; i <= 6; i++) {
        const star = document.createElement("span");
        star.classList.add("stat-star");
        if (i <= value) star.classList.add("filled");
        star.textContent = (i === 6 ? "✶" : "★");

        star.title = (i === 6)
          ? "∞ / Unmeasurable"
          : `Rank ${["E", "D", "C", "B", "A"][i - 1]}`;

        star.addEventListener("click", () => {
          StandSheet.statData[statKey] = (StandSheet.statData[statKey] === i) ? i - 1 : i;
          this.renderStars(html); // Re-render stars
        });

        container.appendChild(star);
      }
    });
  }

}

// ─────────────────────────────────────────────────────
// Tabs click‐to‐show logic
// ─────────────────────────────────────────────────────
document.querySelectorAll(".tabs button").forEach(button => {
  button.addEventListener("click", () => {
    // Deactivate all buttons + hide all contents
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(tab => (tab.style.display = "none"));

    // Activate this tab
    button.classList.add("active");
    const tabId = button.getAttribute("data-tab");
    document.getElementById(tabId).style.display = "block";

    // If switching to Stats, re-render based on current Type
    if (tabId === "stats") {
      renderStatsTab();
    }
  });
});

// ─────────────────────────────────────────────────────
// Data & State
// ─────────────────────────────────────────────────────
const baseStats = ["Power", "Speed", "Range", "Durability", "Precision", "Learning"];
const independentExtraStats = ["Wit", "Menacing", "Other"];
let currentType = "Natural"; // default
let standInfo = {
  name: "",
  master: "",
  type: "Natural",
  design: "",
  ability: "",
  cost: ""
};

// Store chart instances (one or multiple for Act)
let chartInstances = [];

// ─────────────────────────────────────────────────────
// Register plugin to draw inner + outer circles on each radar
// ─────────────────────────────────────────────────────
Chart.register({
  id: "circlePlugin",
  afterDraw(chart) {
    const { ctx, scales } = chart;
    const rScale = scales.r;
    const x = rScale.xCenter;
    const y = rScale.yCenter;
    const outerRadius = rScale.drawingArea;
    const innerRadius = outerRadius / 2;

    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement)
                        .getPropertyValue("--accent-color").trim();
    ctx.lineWidth = 2;

    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
});

// ─────────────────────────────────────────────────────
// Utility: lighten or darken hex color by a percentage
// ─────────────────────────────────────────────────────
function lightenColor(hex, percent) {
  if (typeof hex !== "string" || !hex.startsWith("#")) {
    console.warn("Invalid hex color provided:", hex);
    hex = "#ffffff"; // Default to white if the color is invalid
  }

  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return `rgb(${R}, ${G}, ${B})`;
}

// Wait for Foundry to fully initialize before accessing game.user.color
Hooks.once("ready", () => {
  // Convert game.user.color to a hex string
  const baseAccent = game.user?.color?.toString() || "#ffffff"; // Convert Color object to hex string
  const lightAccent = lightenColor(baseAccent, 30);
  const darkAccent = lightenColor(baseAccent, -20);

  document.documentElement.style.setProperty("--accent-color", baseAccent);
  document.documentElement.style.setProperty("--accent-light", lightAccent);
  document.documentElement.style.setProperty("--accent-dark", darkAccent);
});
// ─────────────────────────────────────────────────────
// Stand Info: hook form fields & handle Type changes
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const nameInput     = document.getElementById("stand-name");
  const masterInput   = document.getElementById("stand-master");
  const typeSelect    = document.getElementById("stand-type");
  const designInput   = document.getElementById("stand-design");
  const abilityInput  = document.getElementById("stand-ability");
  const costInput     = document.getElementById("stand-cost");

  // Update standInfo when fields change
  nameInput.addEventListener("input",   () => standInfo.name   = nameInput.value);
  masterInput.addEventListener("input", () => standInfo.master = masterInput.value);
  designInput.addEventListener("input", () => standInfo.design = designInput.value);
  abilityInput.addEventListener("input",() => standInfo.ability= abilityInput.value);

  // Update the actor's system data when type changes
  typeSelect.addEventListener("change", async () => {
    currentType = typeSelect.value;
    standInfo.type = currentType;
    standInfo.cost = computeCostForType(currentType);
    costInput.value = standInfo.cost;

    // Update the actor's data
    await this.actor.update({
      "system.info.type": currentType
    });

    // If switching to Stats right now, re-render immediately
    if (document.querySelector(".tabs button.active").getAttribute("data-tab") === "stats") {
      renderStatsTab();
    }
  });

  // Initialize cost field
  standInfo.cost = computeCostForType(currentType);
  costInput.value = standInfo.cost;

  // Initial render of Stats
  renderStatsTab();
});

// ─────────────────────────────────────────────────────
// Compute Cost string based on Type
// ─────────────────────────────────────────────────────
function computeCostForType(type) {
  switch(type) {
    case "Automatic":
      return "Loss of Control";
    case "Independent":
      return "Double Learning Costs";
    case "Act":
      return "Lower point pool, Minimum B in Learning";
    default:
      return ""; // no cost for Natural, Artificial, Object, Bound, Wearable, Swarm, Integrated, Detached, Other
  }
}

// ─────────────────────────────────────────────────────
// Render Stats tab based on currentType
// ─────────────────────────────────────────────────────
function renderStatsTab() {
  const statsDiv = document.getElementById("stats");
  statsDiv.innerHTML = "";
  chartInstances.forEach(c => c.destroy?.());
  chartInstances = [];

  // Determine which stat labels to use
  let labels = [...baseStats];
  if (currentType === "Independent") {
    labels = labels.concat(independentExtraStats);
  }

  // ACT case: three separate wrappers (unchanged)
  if (currentType === "Act") {
    for (let actNum = 1; actNum <= 3; actNum++) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("chart-wrapper");

      const title = document.createElement("h3");
      title.textContent = `Act ${actNum} Stats`;
      title.style.color = "var(--accent-light)";
      wrapper.appendChild(title);

      // Stat lines
      const statContainer = document.createElement("div");
      statContainer.classList.add("stat-container");
      labels.forEach(statKey => {
        const line = document.createElement("div");
        line.classList.add("stat-line");
        line.dataset.stat = statKey.toLowerCase();

        const lbl = document.createElement("label");
        lbl.textContent = statKey;
        line.appendChild(lbl);

        const starsDiv = document.createElement("div");
        starsDiv.classList.add("stat-stars");
        starsDiv.dataset.stat = statKey.toLowerCase();
        line.appendChild(starsDiv);

        statContainer.appendChild(line);
      });
      wrapper.appendChild(statContainer);

      // Canvas + container
      const chartContainer = document.createElement("div");
      chartContainer.classList.add("chart-container");
      const canvas = document.createElement("canvas");
      canvas.id = `stand-chart-act${actNum}`;
      canvas.width = 350;
      canvas.height = 350;
      chartContainer.appendChild(canvas);
      wrapper.appendChild(chartContainer);

      statsDiv.appendChild(wrapper);
      setupStatStarsAndChart(labels, canvas.id);
    }
  } else {
    // NON‐ACT case: wrap both statContainer and chartContainer
    const wrapper = document.createElement("div");
    wrapper.classList.add("chart-wrapper");

    // Stat lines
    const statContainer = document.createElement("div");
    statContainer.classList.add("stat-container");
    labels.forEach(statKey => {
      const line = document.createElement("div");
      line.classList.add("stat-line");
      line.dataset.stat = statKey.toLowerCase();

      const lbl = document.createElement("label");
      lbl.textContent = statKey;
      line.appendChild(lbl);

      const starsDiv = document.createElement("div");
      starsDiv.classList.add("stat-stars");
      starsDiv.dataset.stat = statKey.toLowerCase();
      line.appendChild(starsDiv);

      statContainer.appendChild(line);
    });
    wrapper.appendChild(statContainer);

    // Single canvas + container
    const chartContainer = document.createElement("div");
    chartContainer.classList.add("chart-container");
    const canvas = document.createElement("canvas");
    canvas.id = "stand-chart";
    canvas.width = 350;
    canvas.height = 350;
    chartContainer.appendChild(canvas);
    wrapper.appendChild(chartContainer);

    statsDiv.appendChild(wrapper);
    setupStatStarsAndChart(labels, "stand-chart");
  }
}

// ─────────────────────────────────────────────────────
// For a given list of stat labels and a canvas ID, 
// render clickable stars and a radar chart.
// ─────────────────────────────────────────────────────
function setupStatStarsAndChart(labels, canvasId) {
  // 1) Build a local statData object
  const localStatData = {};
  labels.forEach(stat => { localStatData[stat.toLowerCase()] = 0; });

  // 2) Find the wrapper that contains this canvas
  const wrapper = document.getElementById(canvasId).closest(".chart-wrapper");
  if (!wrapper) return; // should never happen, because we always create .chart-wrapper now

  // 3) Populate stars inside that wrapper
  wrapper.querySelectorAll(".stat-stars").forEach(container => {
    const statKey = container.dataset.stat;
    container.innerHTML = "";
    container.classList.toggle("infinite", localStatData[statKey] === 6);

    for (let i = 1; i <= 6; i++) {
      const star = document.createElement("span");
      star.classList.add("stat-star");
      if (i <= localStatData[statKey]) star.classList.add("filled");
      star.textContent = (i === 6 ? "✶" : "★");

      star.title = (i === 6)
        ? "∞ / Unmeasurable"
        : `Rank ${["E","D","C","B","A"][i - 1]}`;

      star.addEventListener("click", () => {
        localStatData[statKey] = (localStatData[statKey] === i) ? i - 1 : i;
        renderStarsInWrapper(wrapper, localStatData);
        updateChartData(chartInstances.find(c => c.canvas.id === canvasId), localStatData);
      });

      container.appendChild(star);
    }
  });

  // 4) Create the Chart.js radar
  const ctx = document.getElementById(canvasId).getContext("2d");
  const chart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: labels,
      datasets: [{
        label: "Stand Stats",
        data: labels.map(stat => localStatData[stat.toLowerCase()]),
        backgroundColor: "rgba(252, 163, 17, 0.3)",
        borderColor: "var(--accent-color)",
        pointBackgroundColor: "var(--accent-color)",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: false,
      layout: { padding: 20 },
      scales: {
        r: {
          min: 0,
          max: 6,
          ticks: { stepSize: 1, color: "#fff", backdropColor: "transparent", display: false },
          grid: { color: "#666" },
          angleLines: { color: "#444" },
          pointLabels: {
            color: "#fff",
            font: { family: "Verdana, sans-serif", size: 16, weight: "bold" },
            padding: 30
          }
        }
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false }, circlePlugin: {} }
    }
  });

  chartInstances.push(chart);
}

// ─────────────────────────────────────────────────────
// Rerender all stars in a given wrapper (container) 
// whenever stat values change
// ─────────────────────────────────────────────────────
function renderStarsInWrapper(wrapper, statData) {
  wrapper.querySelectorAll(".stat-stars").forEach(container => {
    const statKey = container.dataset.stat;
    const value = statData[statKey];
    container.classList.toggle("infinite", value === 6);
    container.querySelectorAll(".stat-star").forEach((star, idx) => {
      if (idx < value) star.classList.add("filled");
      else star.classList.remove("filled");
    });
  });
}

// ─────────────────────────────────────────────────────
// Update a specific Chart.js instance’s data & redraw
// ─────────────────────────────────────────────────────
function updateChartData(chart, statData) {
  if (!chart) return;
  chart.data.datasets[0].data = chart.data.labels.map(label => statData[label.toLowerCase()] || 0);
  chart.update();
}

// ─────────────────────────────────────────────────────
// Initial render when page loads
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Show Stats tab first
  renderStatsTab();
});

import { loadChartJS } from "./stat-chart-loader.js";

export function colorToRGBA(input, alpha = 1) {
	let r, g, b;

	if (input.startsWith("#")) {
		// Hex input
		input = input.slice(1);
		if (input.length === 3) input = input.split('').map(c => c + c).join('');
		if (input.length !== 6) return `rgba(0, 0, 0, ${alpha})`;

		r = parseInt(input.slice(0, 2), 16);
		g = parseInt(input.slice(2, 4), 16);
		b = parseInt(input.slice(4, 6), 16);

	} else if (input.startsWith("rgb")) {
		// Already a CSS rgb string like "rgb(255, 0, 0)"
		const matches = input.match(/rgb.*?\(([^)]+)\)/);
		if (!matches) return `rgba(0, 0, 0, ${alpha})`;

    [r, g, b] = matches[1].split(',').map(n => parseInt(n.trim()));
		r = Math.max(0, r);
		g = Math.max(0, g);
		b = Math.max(0, b);
	} else {
		console.error("Invalid color input:", input);
		return `rgba(0, 0, 0, ${alpha})`;
	}

	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}




export function renderStatChart(app, html, data) {
	const styles = getComputedStyle(document.documentElement);
	const canvas = html.find("[data-stat-chart]")[0] ?? html.find("#stand-stat-chart")[0];
	if (!canvas) return;

	const statsObj = data.actor?.system?.attributes?.stats ?? {};
	const dataStats = Array.isArray(data.stats) ? data.stats : Object.entries(statsObj).map(([key, stat]) => ({ key, ...stat }));
	if (!dataStats.length) return;

	const statLabels = dataStats.map(stat => String(stat.label || stat.key || "").trim());
	const statValues = dataStats.map(stat => {
		if (stat.dtype === "Burn") {
			const burnOriginal = Number(stat.original ?? stat.orig ?? stat.value ?? 0);
			return Number.isFinite(burnOriginal) ? burnOriginal : 0;
		}
		const numeric = Number(stat.value ?? 0);
		return Number.isFinite(numeric) ? numeric : 0;
	});
	const actorType = data.actor?.type;
	const chartLabel = actorType === "user"
		? "User Stats"
		: actorType === "power"
			? "Power Stats"
			: "Stand Stats";
	const computedMax = Math.max(6, ...statValues, 1);
	const chartMax = Math.ceil(computedMax);
	const renderChart = () => {
		const accentLight = getComputedStyle(document.documentElement)
			.getPropertyValue('--accent-light')
			.trim() || '#ffcc00';
		const accentDark = getComputedStyle(document.documentElement)
			.getPropertyValue('--accent-dark')
			.trim() || '#ffcc00';

		if (app._chartInstance) {
			try { app._chartInstance.destroy(); } catch (e) { }
		}

		const chart = new Chart(canvas, {
			type: "radar"
			, data: {
				labels: statLabels
				, datasets: [{
					label: chartLabel
					, data: statValues
					, backgroundColor: colorToRGBA(accentDark, 0.4)
					, borderColor: accentDark
					, borderWidth: 2
					, pointBackgroundColor: colorToRGBA(accentDark, 0.4)
      }]
			}
			, options: {
				responsive: true
				, maintainAspectRatio: true
				, plugins: {
					legend: {
						labels: {
							color: "#ffffff"
						}
					}
				}
				, scales: {
					r: {
						angleLines: {
							color: "rgba(255,255,255,0.3)"
						}
						, grid: {
							color: "rgba(255,255,255,0.2)"
						}
						, pointLabels: {
							color: "#ffffff"
							, font: {
								size: 14
								, weight: "bold"
							}
						}
						, ticks: {
							display: false
						}
						, min: 0
						, max: chartMax
						, stepSize: 1
					}
				}
			}
		});
		app._chartInstance = chart;
	};

	if (!globalThis.Chart) {
		loadChartJS().then(() => requestAnimationFrame(renderChart));
		return;
	}
	requestAnimationFrame(renderChart);
}

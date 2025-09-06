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
	const canvas = html.find("#stand-stat-chart")[0];
	if (!canvas) return;

	const stats = data.actor.system.attributes.stats;
	const statLabels = ["Power", "Speed", "Precision", "Range", "Durability", "Learning"];

	const statValues = [
    stats.power?.value ?? 0
    , stats.speed?.value ?? 0
    , stats.precision?.value ?? 0
    , stats.range?.value ?? 0
    , stats.durability?.value ?? 0
    , stats.learning?.temp ?? 0 // default to temp view for chart
  ];
	requestAnimationFrame(() => {
		const accentLight = getComputedStyle(document.documentElement)
			.getPropertyValue('--accent-light')
			.trim() || '#ffcc00';
		const accentDark = getComputedStyle(document.documentElement)
			.getPropertyValue('--accent-dark')
			.trim() || '#ffcc00';

		const chart = new Chart(canvas, {
			type: "radar"
			, data: {
				labels: statLabels
				, datasets: [{
					label: "Stand Stats"
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
						, max: 6
						, stepSize: 1
					}
				}
			}
		});
		app._chartInstance = chart;
	});
}

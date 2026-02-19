let chartLoadPromise;

export async function loadChartJS() {
	if (globalThis.Chart) return globalThis.Chart;
	if (chartLoadPromise) return chartLoadPromise;
	chartLoadPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "systems/bizarre-adventures-d6/modules/objects/chart.umd.js";
		script.onload = () => resolve(globalThis.Chart);
		script.onerror = reject;
		document.head.appendChild(script);
	});
	return chartLoadPromise;
}

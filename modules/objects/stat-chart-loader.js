export async function loadChartJS() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "systems/bizarre-adventures-d6/modules/objects/chart.umd.js";
    script.onload = () => {
      console.log("Chart.js successfully loaded:", Chart);
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

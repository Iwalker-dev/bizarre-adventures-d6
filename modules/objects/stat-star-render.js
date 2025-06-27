export function renderStars(html, actor) {
  html.find(".stat-stars").each((_, container) => {
    const $container = $(container);
    const statKey = $container.data("stat");
    const [statName, valueType = "value"] = statKey.split("-");

    const statData = actor.system.attributes.stats?.[statName];
    if (!statData) return;

    const isBurn = statData.dtype === "Burn";
    const finalValueType = isBurn ? valueType : "value";

    let value = statData?.[finalValueType];
    if (typeof value !== "number") value = 0;

    $container.empty().toggleClass("infinite", value === 6);

    for (let i = 1; i <= 6; i++) {
      const star = document.createElement("span");
      star.classList.add("stat-star");
      if (i <= value) star.classList.add("filled");
      star.textContent = (i === 6 ? "✦" : "★");
      star.title = (i === 6)
        ? "∞ / Unmeasurable"
        : `Rank ${["E", "D", "C", "B", "A"][i - 1]}`;

      star.addEventListener("click", async () => {
        const newValue = (value === i) ? i - 1 : i;
        const path = `system.attributes.stats.${statName}.${finalValueType}`;
        await actor.update({ [path]: newValue });
      });

      $container[0].appendChild(star);
    }
  });
}
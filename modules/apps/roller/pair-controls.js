export function getPairedQuadrantNum(quadrantNum) {
    const quadrantNumber = Number(quadrantNum);
    const pairMap = { 1: 2, 2: 1, 3: 4, 4: 3 };
    return pairMap[quadrantNumber] ?? null;
}

export function getAdvantagePairKey(quadrantNum) {
    const quadrantNumber = Number(quadrantNum);
    if (quadrantNumber === 1 || quadrantNumber === 2) return "action";
    if (quadrantNumber === 3 || quadrantNumber === 4) return "reaction";
    return null;
}

export function getLegacyQuadrantAdvantage(message, quadrantNum) {
    const own = Number(message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`)?.advantage);
    if (Number.isFinite(own)) return Math.max(0, Math.min(3, own));

    const pairedQuadrantNum = getPairedQuadrantNum(quadrantNum);
    const pair = Number(message?.getFlag("bizarre-adventures-d6", `quadrant${pairedQuadrantNum}`)?.advantage);
    if (Number.isFinite(pair)) return Math.max(0, Math.min(3, pair));

    return undefined;
}

export function getPairAdvantage(message, quadrantNum) {
    const key = getAdvantagePairKey(quadrantNum);
    if (!key) return undefined;

    const pairAdvantage = message?.getFlag("bizarre-adventures-d6", "pairAdvantage") || {};
    const shared = Number(pairAdvantage[key]);
    if (Number.isFinite(shared)) return Math.max(0, Math.min(3, shared));

    return getLegacyQuadrantAdvantage(message, quadrantNum);
}

export function getPairReckless(message, quadrantNum) {
    const key = getAdvantagePairKey(quadrantNum);
    if (key !== "reaction") return false;

    const pairReckless = message?.getFlag("bizarre-adventures-d6", "pairReckless") || {};
    return !!pairReckless[key];
}

export async function setPairAdvantage(message, quadrantNum, advantage) {
    const key = getAdvantagePairKey(quadrantNum);
    if (!message || !key) return;

    const numeric = Number(advantage);
    const safeAdvantage = Number.isFinite(numeric) ? Math.max(0, Math.min(3, numeric)) : 0;
    const pairAdvantage = message.getFlag("bizarre-adventures-d6", "pairAdvantage") || {};

    await message.setFlag("bizarre-adventures-d6", "pairAdvantage", {
        ...pairAdvantage,
        [key]: safeAdvantage
    });
}

export async function setPairReckless(message, quadrantNum, reckless) {
    const key = getAdvantagePairKey(quadrantNum);
    if (!message || key !== "reaction") return;

    const pairReckless = message.getFlag("bizarre-adventures-d6", "pairReckless") || {};
    await message.setFlag("bizarre-adventures-d6", "pairReckless", {
        ...pairReckless,
        [key]: !!reckless
    });
}

export function getPairQuadrantNumbers(quadrantNum) {
    const key = getAdvantagePairKey(quadrantNum);
    if (key === "action") return [1, 2];
    if (key === "reaction") return [3, 4];
    return [];
}

export function getPairMulliganBonus(message, quadrantNum) {
    const pairQuadrants = getPairQuadrantNumbers(quadrantNum);
    return pairQuadrants.reduce((total, index) => {
        const data = message?.getFlag("bizarre-adventures-d6", `quadrant${index}`) || {};
        const luck = Number(data?.luckCounts?.mulligan || 0);
        const gambit = Number(data?.gambitCounts?.mulligan || 0);
        return total + Math.max(0, luck + gambit);
    }, 0);
}

export function getPairFudgeBonus(message, quadrantNum) {
    const pairQuadrants = getPairQuadrantNumbers(quadrantNum);
    return pairQuadrants.reduce((total, index) => {
        const data = message?.getFlag("bizarre-adventures-d6", `quadrant${index}`) || {};
        const luck = Number(data?.luckCounts?.fudge || 0);
        const gambit = Number(data?.gambitCounts?.fudge || 0);
        return total + Math.max(0, luck + gambit);
    }, 0);
}

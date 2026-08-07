export function withCurrentMessageMode(chatData = {}) { // Consider moving to utils.js
    const data = foundry.utils.deepClone(chatData);
    // Foundry's applyMode path may read speaker.actor for IC mode.
    // Ensure speaker always exists to avoid undefined access.
    if (!data.speaker || typeof data.speaker !== "object") {
        data.speaker = ChatMessage.getSpeaker();
    }
    const messageMode = String(game.settings.get("core", "messageMode") || "public");
    ChatMessage.applyMode(data, messageMode);
    return data;
}

export function shouldApplyVisibilityForAction(actionType = "", actionArg = "") { // Consider moving to permissions.js once cleaned
    return actionType === "luck" && actionArg === "flashback";
}

export function canViewerSeeQuadrant({ visibility, playerId, isGM = false }) { // Consider moving to quadrants.js
    if (!visibility) return true;

    const visibilityMode = visibility?.messageMode || null;
    const isSelf = visibility?.playerId === playerId;

    switch (visibilityMode) {
        case "public":
            return true;
        case "gm":
            return isSelf || !!isGM;
        case "blind":
            return !!isGM;
        case "self":
            return isSelf;
        case "ic":
            return true;
        default:
            return true;
    }
}

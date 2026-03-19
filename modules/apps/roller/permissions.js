import { resolveActorFromSource } from "./actors.js";

export function getQuadrantOwnerState(message, quadrantNum) {
    const flagData = message?.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`);
    const actor = flagData ? resolveActorFromSource(flagData) : null;
    const isOwner = game.user.isGM || !actor || !!actor?.isOwner;
    return { actor, isOwner, flagData };
}

export function canUserResolveMessage(message) {
    if (!message) return false;
    if (game.user.isGM) return true;

    const type = message.getFlag("bizarre-adventures-d6", "type") || "action";
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    return required.every((quadrantNum) => {
        const { actor } = getQuadrantOwnerState(message, quadrantNum);
        return !actor || !!actor?.isOwner;
    });
}

export function isMessageLocked(message) {
    return !!message?.getFlag("bizarre-adventures-d6", "Locked");
}

export function isMessageResolved(message) {
    if (!message) return false;
    const type = message.getFlag("bizarre-adventures-d6", "type") || "action";
    const required = type === "action" ? [1, 2] : [1, 2, 3, 4];
    return required.every((quadrantNum) => !!message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`)?.rolled);
}

function isPostResolveAllowedAction(actionType, actionArg) {
    return actionType === "luck" && (actionArg === "persist" || actionArg === "mulligan" || actionArg === "flashback");
}

export function canUserExecuteAction(messageId, actionType, quadrantNum, actionArg = "") {
    const message = game.messages.get(messageId);
    if (!message) return false;
    if (isMessageLocked(message)) return false;
    if (isMessageResolved(message) && !isPostResolveAllowedAction(actionType, actionArg)) return false;

    if (actionType === "resolve") {
        return canUserResolveMessage(message);
    }

    if (actionType === "prepare") {
        return true;
    }

    if (actionType === "unready" || actionType === "luck") {
        const quadrantNumber = Number(quadrantNum);
        if (!Number.isInteger(quadrantNumber)) return false;
        return getQuadrantOwnerState(message, quadrantNumber).isOwner;
    }

    return true;
}

export function setButtonDisabledState(buttonEl, disabled, tooltip) {
    const button = buttonEl instanceof HTMLElement ? buttonEl : buttonEl?.[0];
    if (!button) return;
    button.disabled = !!disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.classList.toggle("is-disabled", !!disabled);
    if (tooltip && disabled) {
        button.dataset.tooltip = tooltip;
    } else {
        delete button.dataset.tooltip;
    }
}

export function applyChatButtonPermissions(message, html) {
    const root = html?.[0] || html;
    if (!message || !root) return;

    const noOwnershipTip = "You do not own the actor required for this action.";
    const noResolveTip = "You must own all actors in this roll to resolve.";
    const lockedTip = "This roll is currently locked.";
    const resolvedTip = "This roll is resolved. Only Persist, Mulligan, and Flashback remain available.";

    if (isMessageLocked(message)) {
        root.querySelectorAll(".select-stat").forEach((button) => {
            setButtonDisabledState(button, true, lockedTip);
        });
        return;
    }

    if (isMessageResolved(message)) {
        root.querySelectorAll(".select-stat").forEach((button) => {
            const action = String(button.dataset.action || "");
            const [actionType, actionArg] = action.split("-", 2);
            const postResolveAllowed = isPostResolveAllowedAction(actionType, actionArg);
            if (!postResolveAllowed) {
                setButtonDisabledState(button, true, resolvedTip);
                return;
            }

            const quadrantNumber = Number(button.dataset.quadrant);
            const isOwned = Number.isInteger(quadrantNumber)
                ? getQuadrantOwnerState(message, quadrantNumber).isOwner
                : false;
            setButtonDisabledState(button, !isOwned, noOwnershipTip);
        });
        return;
    }

    root.querySelectorAll('.select-stat[data-action="prepare"]').forEach((button) => {
        setButtonDisabledState(button, false, noOwnershipTip);
    });

    root.querySelectorAll('.select-stat[data-quadrant]').forEach((button) => {
        const action = String(button.dataset.action || "");
        if (!(action === "unready" || action.startsWith("luck-"))) return;
        const quadrantNumber = Number(button.dataset.quadrant);
        const isOwned = Number.isInteger(quadrantNumber)
            ? getQuadrantOwnerState(message, quadrantNumber).isOwner
            : false;
        setButtonDisabledState(button, !isOwned, noOwnershipTip);
    });

    root.querySelectorAll('.select-stat[data-action="resolve"]').forEach((button) => {
        setButtonDisabledState(button, !canUserResolveMessage(message), noResolveTip);
    });
}

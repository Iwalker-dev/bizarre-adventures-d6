import { resetQuadrant, rerenderMessage, rollAll, updateToContest, applySetPairAdvantage, applySetPairReckless, setFlag } from "./apps/bad6-roller.js";
import { updateQuadrant } from "./apps/roller/quadrants.js";
import { executeLuckMove } from "./luck-moves.js";
import { getRollableActorSources } from "./apps/roller/actors.js";
let rollerSocket = null;

export function getRollerSocket() {
    return rollerSocket;
}

export function registerSockets() {
    rollerSocket = socketlib.registerSystem("bizarre-adventures-d6");
    rollerSocket.register("rollerApplyPreparedQuadrant", socketApplyPreparedQuadrant);
    rollerSocket.register("rollerResetQuadrant", socketResetQuadrant);
    rollerSocket.register("rollerExecuteLuckMove", socketExecuteLuckMove);
    rollerSocket.register("rollerRollAll", socketRollAll);
    rollerSocket.register("rollerUpdateToContest", socketUpdateToContest);
    rollerSocket.register("rollerFlashbackCreate", socketFlashbackCreate);
    rollerSocket.register("rollerFlashbackRequest", socketFlashbackRequest);
    rollerSocket.register("rollerSetPairAdvantage", socketSetPairAdvantage);
    rollerSocket.register("rollerSetPairReckless", socketSetPairReckless);
    rollerSocket.register("warnOwners", socketWarnOwners);
    rollerSocket.register("setFlag", socketSetFlag);
    rollerSocket.register("getUserActors", socketGetUserActors);
}

export async function socketApplyPreparedQuadrant(messageId, quadrantNum, preparedData) {
    return await updateQuadrant(messageId, quadrantNum, preparedData);
}

export async function socketResetQuadrant(messageId, quadrantNum, refundLuck = true) {
    return await resetQuadrant(messageId, quadrantNum, refundLuck);
}

export async function socketExecuteLuckMove(messageId, spenders, quadrantNum, move, isGambit = false, sender = game.user.id) {
    await executeLuckMove(messageId, spenders, quadrantNum, move, isGambit, sender);
    const message = game.messages.get(messageId);
    if (message) {
        await rerenderMessage(message);
    }
}

export async function socketRollAll(messageId) {
    return await rollAll(messageId);
}

export async function socketUpdateToContest(messageId) {
    return await updateToContest(messageId);
}

export async function socketSetPairAdvantage(messageId, quadrantNum, advantage) {
    return await applySetPairAdvantage(messageId, quadrantNum, advantage);
}

export async function socketSetPairReckless(messageId, quadrantNum, reckless) {
    return await applySetPairReckless(messageId, quadrantNum, reckless);
}
export async function socketFlashbackCreate(requesterName) {
	const flashbackText = await new Promise((resolve) => {
        // TODO: Move to dialog.js
		new Dialog({
			title: "Flashback",
			content: `<p>Describe the retcon you want to make:</p><textarea id="flashback-input" rows="4" style="width: 100%;"></textarea>`,
			buttons: {
				ok: { label: "Send to GM", callback: (html) => resolve(html.find("#flashback-input").val().trim()) },
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			close: () => resolve(null)
		}).render(true);
	});
    return flashbackText;
}
export async function socketFlashbackRequest(requesterName, flashbackText) {
    const approved = await new Promise((resolve) => {
        // TODO: Move to dialog.js
        new Dialog({
            title: "Flashback Request",
            content: `<p><strong>${requesterName ?? "A player"}</strong> wants to use a Flashback:</p><blockquote>${flashbackText}</blockquote><p>Approve?</p>`,
            buttons: {
                yes: { label: "Approve", callback: () => resolve(true) },
                no:  { label: "Deny",    callback: () => resolve(false) }
            },
            close: () => resolve(false)
        }).render(true);
    });
    if (!approved) return false;
    await ChatMessage.create({
        content: `<div class="bad6-flashback-message"><strong>\u26a1 Flashback (${requesterName ?? "Unknown"})</strong><p>${flashbackText}</p></div>`,
        flags: { "bizarre-adventures-d6": { type: "flashback" } }
    });
    return true;
}
// Takes in the actor object and a string. Sends a warning if the current user owns the actor.
export async function socketWarnOwners(actor, warning) {
    if (actor.isOwner) ui.notifications.warn(warning);
}

export async function socketSetFlag(message, flag, value) {
    return await setFlag(message, flag, value)
}

export async function socketGetUserActors(sender) {
    return getRollableActorSources(sender);
}
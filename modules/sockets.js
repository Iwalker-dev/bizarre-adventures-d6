import { updateQuadrant, resetQuadrant, rerenderMessage, rollAll, updateToContest, applySetPairAdvantage, applySetPairReckless, stampClickMetaAuthoritative } from "./apps/bad6-roller.js";
import { executeLuckMove } from "./luck-moves.js";
let rollerSocket = null;

export function getRollerSocket() {
    return rollerSocket;
}

export function registerSockets() {
    rollerSocket = socketlib.registerSystem("bizarre-adventures-d6");
    rollerSocket.register("rollerStampClickMeta", socketStampClickMeta);
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
}

export async function socketStampClickMeta(messageId, clickMeta = null) {
    if (!clickMeta) return;
    await stampClickMetaAuthoritative(messageId, clickMeta);
}

export async function socketApplyPreparedQuadrant(messageId, quadrantNum, preparedData, clickMeta = null) {
    return await updateQuadrant(messageId, quadrantNum, preparedData);
}

export async function socketResetQuadrant(messageId, quadrantNum, refundLuck = true, _clickMeta = null) {
    return await resetQuadrant(messageId, quadrantNum, refundLuck);
}

export async function socketExecuteLuckMove(messageId, spenders, quadrantNum, move, isGambit = false, sender = game.user.id, clickMeta = null) {
    await executeLuckMove(messageId, spenders, quadrantNum, move, isGambit, sender, clickMeta);
    const message = game.messages.get(messageId);
    if (message) {
        await rerenderMessage(message);
    }
}

export async function socketRollAll(messageId, clickMeta = null) {
    return await rollAll(messageId, clickMeta);
}

export async function socketUpdateToContest(messageId) {
    return await updateToContest(messageId);
}

export async function socketSetPairAdvantage(messageId, quadrantNum, advantage, _clickMeta = null) {
    return await applySetPairAdvantage(messageId, quadrantNum, advantage);
}

export async function socketSetPairReckless(messageId, quadrantNum, reckless, _clickMeta = null) {
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

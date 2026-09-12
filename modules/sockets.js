import { resetQuadrant, rerenderMessage, rollAll, updateToContest, applySetPairAdvantage, applySetPairReckless, setFlag, createActionMessage, createContestMessage, recalculateQuadrantFormula, reevaluatePairRollResults } from "./apps/bad6-roller.js";
import { updateQuadrant } from "./apps/roller/quadrants.js";
import { executeLuckMove, trySpendLuck, LUCK_MOVES, revealGambit } from "./luck-moves.js";
import { getRollableActorSources } from "./apps/roller/actors.js";
import { withCurrentMessageMode } from "./apps/roller/chat.js";
import { renderDialog } from "./dialog.js";
import { applyChatButtonPermissions } from "./apps/roller/permissions.js";
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
    // rollerSocket.register("rollerFlashbackCreate", socketFlashbackCreate);
    rollerSocket.register("rollerFlashbackRequest", socketFlashbackRequest);
    rollerSocket.register("rollerSetPairAdvantage", socketSetPairAdvantage);
    rollerSocket.register("rollerSetPairReckless", socketSetPairReckless);
    rollerSocket.register("warnOwners", socketWarnOwners);
    rollerSocket.register("setFlag", socketSetFlag);
    rollerSocket.register("getUserActors", socketGetUserActors);
    rollerSocket.register("createActionMessage", socketCreateActionMessage);
    rollerSocket.register("createContestMessage", socketCreateContestMessage);
    // rollerSocker.register("updateDisplay", socketUpdateDisplay);
    // rollerSocket.register("applyChatButtonPermissions", socketApplyChatButtonPermissions);
    rollerSocket.register("rerenderMessage", socketRerenderMessage);
    rollerSocket.register("renderDialog", socketRenderDialog);
    rollerSocket.register("resolveExecuteLuckMove", socketresolveExecuteLuckMove);
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
/*
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
    */
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
    await ChatMessage.create(withCurrentMessageMode({
        content: `<div class="bad6-flashback-message"><strong>⚡ Flashback (${requesterName ?? "Unknown"})</strong><p>${flashbackText}</p></div>`,
        flags: { "bizarre-adventures-d6": { type: "flashback" } }
    }));
    return true;
}
// Takes in the actor object and a string. Sends a warning if the current user owns the actor.
export async function socketWarnOwners(actor, warning) {
    if (actor.isOwner) ui.notifications.warn(warning);
}
// Socket sends the object, not the live document. This strips it of its functions, meaning DO NOT TRY TO CHANGE MESSAGEID TO MESSAGE OBJECT
export async function socketSetFlag(messageId, flag, value) {
    const message = game.messages.get(messageId);
    return await setFlag(message, flag, value);
}

export async function socketGetUserActors(sender) {
    return getRollableActorSources(sender);
}

export async function socketCreateActionMessage(senderName) {
    return createActionMessage(senderName);
}

export async function socketCreateContestMessage(alias) {
    return createContestMessage(alias);
}
/*
export async function socketUpdateDisplay(messageId, html) {
    const message = game.messages.get(messageId);
    applyChatButtonPermissions(message, html);
}
*/
/*
export async function socketApplyChatButtonPermissions(messageId, html) {
    console.log("[BAD6 Socket]", messageId, html);
    const message = game.messages.get(messageId);
    applyChatButtonPermissions(message, html);

    rerenderMessage()
}
*/
export async function socketRerenderMessage(messageId) {
    const message = game.messages.get(messageId);
    rerenderMessage(message);
}

export async function socketRenderDialog(dialog, args) {
    return await renderDialog(dialog, args);
}

export async function socketresolveExecuteLuckMove(messageId, spender, quadrantNum, moveType, isRefund, isGambit, spenderKey, gambitActor, gambitId, existing) {
    const spent = await trySpendLuck(spender, LUCK_MOVES[moveType].name, isRefund, isGambit);
		if (!spent) return;

		const message = game.messages.get(messageId); // Refetch message to ensure we have the latest flags after move execution
		// Prepare existing data
		const countType = isGambit ? "gambitCounts" : "luckCounts";
		const latest = message.getFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`) || {};
		const lastLuckSpenders = latest.luckSpenders || existing.luckSpenders || {};
		const lastLuckMoveSpenders = lastLuckSpenders[moveType] || {};
		const lastGambitSpenders = latest.gambitSpenders || existing.gambitSpenders || {};
		const lastGambitMoveSpenders = lastGambitSpenders[moveType] || {};

		// Create the update data
		const updateData = {
			...latest,
			luckCounts: { ...(latest.luckCounts || existing.luckCounts || {}) },
			gambitCounts: { ...(latest.gambitCounts || existing.gambitCounts || {}) }
		};
		// luckSpenders are default cost. gambitSpenders are half cost.
		updateData[countType][moveType] = (updateData[countType][moveType] || 0) + 1;
		if (spenderKey) {
			if (!isGambit) {
				updateData.luckSpenders = {
					...lastLuckSpenders,
					[moveType]: {
						...lastLuckMoveSpenders,
						[spenderKey]: (lastLuckMoveSpenders[spenderKey] || 0) + 1
					}
				};
			} else {
				updateData.gambitSpenders = {
					...lastGambitSpenders,
					[moveType]: {
						...lastGambitMoveSpenders,
						[spenderKey]: (lastGambitMoveSpenders[spenderKey] || 0) + 1
					}
				};
			}
		}

		// Update the message flags with the new data
		await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, updateData);

		if (moveType === "fudge") {
			const quadrantNumber = Number(quadrantNum);
			const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
			for (const pairQuadrant of pairQuadrants) {
				await recalculateQuadrantFormula(messageId, pairQuadrant);
			}
		} else if (moveType === "mulligan") {
			const quadrantNumber = Number(quadrantNum);
			const pairQuadrants = (quadrantNumber === 1 || quadrantNumber === 2) ? [1, 2] : [3, 4];
			for (const pairQuadrant of pairQuadrants) {
				await recalculateQuadrantFormula(messageId, pairQuadrant, { includeMulligan: true });
			}
			await reevaluatePairRollResults(messageId, quadrantNum);
		}

		// Reveal and delete gambit document (After spending for it)
		if (isGambit) {
			const isRevealed = revealGambit(gambitActor, gambitId);
			if (isRevealed) gambitActor.deleteEmbeddedDocuments("gambit", [gambitId]);
		}
}
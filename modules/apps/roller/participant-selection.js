/**
 * Actor and participant selection helpers for BAD6 roller flows.
 */

import { DIALOG_MESSAGES, NOTIFICATION_MESSAGES } from "./constants.js";
import { showChoiceDialog, getActorDisplayName, showStatDialog } from "../../dialog.js";
import { isDebugEnabled } from "../../config.js";

/**
 * Helper to find a non-GM owner or fallback to GM.
 * @param {Actor} actor
 * @returns {User|undefined}
 */
export function findOwner(actor) {
	return game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ||
		game.users.find(u => u.isGM);
}

/**
 * Request a stat selection from the user.
 * @param {Actor} actor
 * @param {Object} [options]
 * @returns {Promise<Object|null>}
 */
export function requestStat(actor, options = {}) {
	return showStatDialog(actor, options);
}

/**
 * Resolve which actor will roll, with linked-actor selection as needed.
 * @param {number} i
 * @param {boolean} [reaction=false]
 * @returns {Promise<Actor|null>}
 */
export async function findRoller(i, reaction = false) {
	if (game.user.isGM) {
		if (isDebugEnabled()) {
			console.warn("BAD6 | reaction:", reaction);
		}
		let token;
		let roller;
		if (canvas.tokens.controlled.length === 1) i = 0;
		token = canvas.tokens.controlled[i];
		if (!token) {
			ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
			return null;
		}
		roller = token.actor;
		if (reaction) {
			if (game.user.targets.size > 0) {
				if (game.user.targets.size === 1) i = 0;
				token = Array.from(game.user.targets)[i];
				if (!token) {
					ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
					return null;
				}
				roller = token.actor;
			} else {
				if (canvas.tokens.controlled.length === 1) i = 0;
				token = canvas.tokens.controlled[i];
				if (!token) {
					ui.notifications.warn(NOTIFICATION_MESSAGES.NO_TOKEN_SELECTED);
					return null;
				}
				roller = token.actor;
			}
		}
		if (isDebugEnabled()) {
			console.warn("BAD6 | Roller chosen:", roller.name);
		}
		return new Promise(async (resolve) => {
			const linkedActors = roller.system.bio.linkedActors?.value || [];
			if (isDebugEnabled()) {
				console.warn("BAD6 | Linked actors:", linkedActors);
			}
			if (linkedActors.length === 0) {
				ui.notifications.warn(NOTIFICATION_MESSAGES.NO_LINKED_ABILITIES);
				return resolve(roller);
			}
			const rollerDisplayName = getActorDisplayName(roller);
			const buttons = {
				[roller.id]: {
					label: rollerDisplayName,
					callback: () => roller
				}
			};
			for (const linked of linkedActors) {
				const actor = await fromUuid(linked.uuid);
				if (actor) {
					const displayName = getActorDisplayName(actor);
					buttons[linked.uuid] = {
						label: `${displayName} (${linked.type})`,
						callback: () => actor
					};
				}
			}
			const choice = await showChoiceDialog({
				title: DIALOG_MESSAGES.PARTICIPANT_SELECTION.CHOOSE_ROLLER_TITLE,
				content: DIALOG_MESSAGES.PARTICIPANT_SELECTION.CHOOSE_ROLLER_CONTENT,
				buttons,
				defaultId: Object.keys(buttons)[0],
				closeValue: null
			});
			resolve(choice || null);
		});
	}

	const owned = game.actors.filter(a => a.isOwner);
	if (owned.length === 0) {
		ui.notifications.warn(NOTIFICATION_MESSAGES.NO_OWNED_ACTORS);
		return null;
	}
	if (owned.length === 1) return owned[0];

	return new Promise(async resolve => {
		const buttons = {};
		for (const actor of owned) {
			const displayName = getActorDisplayName(actor);
			buttons[actor.id] = {
				label: displayName,
				callback: () => actor
			};
		}
		const choice = await showChoiceDialog({
			title: DIALOG_MESSAGES.PARTICIPANT_SELECTION.CHOOSE_ACTOR_TITLE,
			content: DIALOG_MESSAGES.PARTICIPANT_SELECTION.CHOOSE_ACTOR_CONTENT,
			buttons,
			defaultId: Object.keys(buttons)[0],
			closeValue: null
		});
		resolve(choice || null);
	});
}

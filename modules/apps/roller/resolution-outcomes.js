/**
 * Post-resolution outcome helpers.
 */

import { SYSTEM_ID, CONTEST_FLAG } from "./constants.js";
import { getRollOrder, createContestState, resetPairState } from "./state.js";
import { buildContestHtml } from "./render.js";
import { escapeHtml } from "../../dialog.js";

/**
 * Apply Persist reset outcome and publish updates.
 * @param {Object} params
 * @returns {Promise<void>}
 */
export async function applyPersistResetOutcome(params) {
	const {
		state,
		side,
		pair,
		persistActorName,
		actorForSpeaker,
		message,
		updateContestMessage
	} = params;

	if (side === "action") {
		resetPairState(state.action);
		resetPairState(state.reaction);
		state.result = null;
		state.nextStep = getRollOrder(state.hasReaction)[0];
	} else {
		resetPairState(pair);
		state.result = null;
		state.nextStep = "reaction-1";
	}

	if (persistActorName) {
		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: actorForSpeaker || undefined }),
			content: `✨ Persist used by <strong>${escapeHtml(persistActorName)}</strong>`
		});
	}

	state.isResolving = false;
	await updateContestMessage(message, state);
}

/**
 * Apply clash outcome and spawn follow-up clash message.
 * @param {Object} params
 * @returns {Promise<boolean>}
 */
export async function applyClashOutcome(params) {
	const { state, message, updateContestMessage } = params;
	if (state.result?.type !== "clash") return false;

	const nextState = createContestState(state.hasReaction);
	nextState.action.persistCount = state.action.persistCount;
	nextState.action.persistNote = state.action.persistNote;
	nextState.reaction.persistCount = state.reaction.persistCount;
	nextState.reaction.persistNote = state.reaction.persistNote;
	nextState.nextStep = getRollOrder(nextState.hasReaction)[0];

	await updateContestMessage(message, state);

	const speakerActorUuid = state.action.rolls[1]?.actorUuid || state.reaction.rolls[1]?.actorUuid;
	const speakerActor = speakerActorUuid ? await fromUuid(speakerActorUuid) : null;

	await ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor: speakerActor || undefined }),
		content: buildContestHtml(nextState),
		flags: {
			[SYSTEM_ID]: {
				[CONTEST_FLAG]: nextState
			}
		}
	});

	state.isResolving = false;
	return true;
}

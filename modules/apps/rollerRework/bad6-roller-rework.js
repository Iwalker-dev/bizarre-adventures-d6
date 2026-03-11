/*
    Import Luck logic from luckMoves.js
    Import actionTemplate, contestTemplate from rollTemplates
    Import formulaRequest from dialog.js


    hook on sidebar
        create roller button
            execute createAction on click

    const chatMessageID

    createAction() {
        template = actionTemplate
        if(doubleclick){
            template = contestTemplate
        }
        post template as actor
    }

    prepareQuadrant() {

        if you are a gm with highlighted actors:
            rollableActors = array of highlighted actors and linked actors
        else warn and return

        if you are a player with owned actors
            rollableActors = array of owned and linked actors
        else warn and return

        lockButton(quadrent, button, "Preparing...")

        sort rollabelActors
            user types
            stand types
            power types

        formula = await renderPreparePrompt(rollableActors)
        await update(chatmessageid, new message) // Consider only moving the updated quadrant for optimization
    }

    update(messageID, newMessage) {
        await lock untrue for chatmessageid
        lock chat message
        replace chat message with newMessage
        unlock chat message
    }

    lockButton(quadrant, buttonID, lockLabel) {
        await lock untrue for chatMessageID
        broadcast lock(chatMessageID)
        parse template of chatMessageID
            parse quadrant info
                buttonID = unclickable and labeled lockLabel

        copy and recreate message
        broadcast unlock(chatMessageID)
    }

    lock(messageID) {
        set attribute locked to true //consider instead adding locks, so if there are multiple locks a conflict is obvious and resolvable
    }

    unlock(messageID) {
        set attribute locked to false
    }

    renderPreparePrompt(rollableActors) {
        render formulaRequest
        luckActors = chooseLuckSpender(rollableActors)
            set[quadrant, buttonid, value] on chatID per button
        on full completion
            subtract luck from relevant actor in luckActors

        combine for original formula
            modify with custom modifiers in order for prepared formula
        return preparedFormula
    }

    chooseLuckSpender(rollableActors) {
        actorArray
        for each user type actor:
            if they have the highest temp luck, [0] = id
            if they have the highest permanent luck so far, [1] = id
            if they have the highest original luck so far, [2] = id
        return actorArray
    }

    resetQuadrant(quadrant) {
        set all attributes set by the quadrant to their defaults
    }

    resolve() {
    //Runs when clicking Resolve
    rolls Reactions, then Actions
        Incase of persist, only rolls if they arent rolled already
    Difference (or 0 if it's bigger) becomes result
        Display DC if action
        Display HitDC and example if contest
        //There will be a table for each to reference
        //Currently HTML should render luck buttons based on attributes
    }

    performMulligan(chatid, quadrant) {
        reevaluate roll results with +1 advantage. Do nothing if advantage would exceed 3.
    }

    performPersist(chatid, quadrant) {
        create new contest with opposing rolls filled in and rolled.
    }
    performFudge(chatid, quadrant) {
        increases advantage by 1
    }
    performFeint(chatid, quadrant) {
        resets quadrant, ignores advantage lock
    }

    addGambit(luckMove) {
        overrides instance of luck cost
    }

*/
// import "./templates/chat/action.hbs";
import { actionLabels } from "./constants.js";
import { renderDialog } from "./dialog.js";
import { LUCK_MOVES } from "./luck-moves.js";
import { isDebugEnabled } from "../../config.js";

async function renderAction(data = {}) {

    const quadrants = data.quadrants
        ? [data.quadrants[1], data.quadrants[2]] // ensure order for actions
        : [
            { quadrantNum: 1, label: actionLabels[0].label, prepared: false }
            , { quadrantNum: 2, label: actionLabels[1].label, prepared: false }
        ];

  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/action.hbs",
    { quadrants}
  );
}
async function renderContest(data = {}) {
    const quadrants = data.quadrants; // array literal

  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/contest.hbs",
    {
            actionSide: {
                quadrants: [
                    quadrants[1] || { quadrantNum: 1, label: actionLabels[0].label, prepared: false },
                    quadrants[2] || { quadrantNum: 2, label: actionLabels[1].label, prepared: false }
                ]
            },
            reactionSide: {
                quadrants: [
                    quadrants[3] || { quadrantNum: 3, label: actionLabels[2].label, prepared: false },
                    quadrants[4] || { quadrantNum: 4, label: actionLabels[3].label, prepared: false }
                ]
            }
    }
  );
}
let rollerClickTimer = null;
let lastActionMessageId = null;
let lastActionMessageAt = 0;
const DOUBLE_CLICK_WINDOW_MS = 250;
const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;
/**
 * Register the scene control button for the D6 Roller.
 * @returns {void}
 */
export function rollerControl() {
	Hooks.on("getSceneControlButtons", (controls) => {
		const tokenControls = controls.tokens;
		if (!tokenControls) return;

			tokenControls.tools["rollerButton"] = {
			name: "rollerButton"
			, title: "D6 Roller"
			, icon: "fas fa-dice-d6"
			, visible: true
			, button: true
			, order: 50
				, onChange: async () => {
					if (rollerClickTimer) {
						clearTimeout(rollerClickTimer);
						rollerClickTimer = null;
						const now = Date.now();
						const priorId = lastActionMessageId;
						const isDouble = priorId && (now - lastActionMessageAt) <= DOUBLE_CLICK_WINDOW_MS;
						lastActionMessageId = null;
						lastActionMessageAt = 0;
						if (isDouble && priorId) {
							const prior = game.messages.get(priorId);
							if (prior) {
                                updateToContest(priorId);
								return;
							} else {
                                updateToContest(null);
                            }
						}
						return;
					}
                    lastActionMessageAt = Date.now();
					rollerClickTimer = setTimeout(() => {
						rollerClickTimer = null;
						lastActionMessageId = null;
						lastActionMessageAt = 0;
					}, DOUBLE_CLICK_WINDOW_MS);
					const msg = await createActionMessage();
					lastActionMessageId = msg?.id || null;
				}
		};
	});
}

async function createActionMessage() { 
    const message = await ChatMessage.create({
        content: await renderAction()
    });
    await message.setFlag("bizarre-adventures-d6", "type", "action");
    return message;
}

async function updateToContest(messageId) {
    let message = game.messages.get(messageId);

    if (message?.isOwner) {
        await message.setFlag("bizarre-adventures-d6", "type", "contest");
        const quadrants = {
            1: message.getFlag("bizarre-adventures-d6", "quadrant1"),
            2: message.getFlag("bizarre-adventures-d6", "quadrant2")
        };
        const content = await renderContest({ quadrants });
        await message.update({ content });   // keeps same message id
        return message;
    }

    const msg = await ChatMessage.create({ content: await renderContest() });
    await msg.setFlag("bizarre-adventures-d6", "type", "contest");
    return msg;
}

// Prepare Phase ----------------------------------------------------------------------------------------------

export function registerChatListeners() {
        $(document).on("click", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            
            const prepare = await renderStatSelectionDialog(quadrantNum);
            if (!prepare) return;

            await updateQuadrant( messageId, quadrantNum, prepare);




        });
}

async function renderStatSelectionDialog(quadrantNum) {
    const actorSources = getRollableActorSources();
    if (!actorSources.length) return;
    // Create map of sources
    const actors = actorSources.map(source => {
        // Resolve actor from sourceUuid or actorId
        const actor = resolveActorFromSource(source);
        if (!actor) return null;
        // Extract the number type stats of the actor, specifically the key, actor name, and stat value
        const statsArray = Object.entries(actor.system.attributes.stats)
            .filter(([, stat]) => String(stat?.dtype || "").toLowerCase() === "number")
            .map(([key, stat]) => ({
                key,
                name: stat.label || key,
                value: stat.value ?? 0
        }));
        return {
            sourceUuid: source.sourceUuid,
            actorId: source.actorId,
            name: source.name,
            stats: statsArray
        };
    }).filter(a => a);

    // Create dialog
    const statDialogResult = await renderDialog('statAndAdvantage', { actors, quadrantNum });
    if (!statDialogResult) return;

    const { stat, advantage, sourceUuid, actorId } = statDialogResult;
    if (!stat || advantage === undefined) return;
    if (!sourceUuid && !actorId) return;

    const actor = resolveActorFromSource({ sourceUuid, actorId });
    if (!actor) return;

    const specialArray = Array.isArray(actor.system.attributes.stats?.[stat]?.special)
        ? actor.system.attributes.stats[stat].special
        : [];
    let statValue = actor.system.attributes.stats[stat].value;
    let selectedSpecial = null;
    if (isDebugEnabled()) {
        console.log(`[Rework] Selected stat: "${stat}", Actor: ${actor.name}`
        , {
            hasSpecialProperty: !!actor.system.attributes.stats?.[stat]?.special,
            specialArray: specialArray,
            length: specialArray.length
        });
    }

    if (specialArray.length > 0) {
        const specialWithStat = [stat, ...specialArray];
        const specialStat = await renderDialog("special", { specialArray: specialWithStat });
        if (!specialStat) return;

        if (specialStat != stat) {
            const selected = specialArray.find(s => {
                const key = (s?.key ?? s?.name ?? "").toString();
                return key === specialStat;
            });
            const selectedValue = Number(selected?.value ?? selected?.points ?? statValue);
            statValue = Number.isFinite(selectedValue) ? selectedValue : statValue;
            selectedSpecial = selected;
        }
    } else {
        if (isDebugEnabled()) {
        console.log(`[Rework] No specials found for stat "${stat}"`);
        }
    }

  return { stat, advantage, sourceUuid, actorId, statValue, selectedSpecial };
    
};


function getRollableActorSources(user = game.user) {
    // TODO: Add setting to manipulate the roles which can highlight tokens.
    // Also, look into the extend of flatMaps and if they can be optimized
    if (user.isGM) {
        // Pull highlighted token's related actors and their linked actors, then create a list of sources
        const highlighted = canvas.tokens.controlled
            .map(t => {
                const actor = t.actor;
                if (!actor) return null;
                return {
                    sourceUuid: t.document.uuid,
                    actorId: actor.id,
                    name: t.name
                };
            })
            .filter(s => s);

        if (!highlighted.length) {
            ui.notifications.warn("No tokens highlighted. Please highlight tokens to prepare rolls.");
            return [];
        }
        const linked = highlighted.flatMap((source) => {
            const actor = resolveActorFromSource(source);
            if (!actor) return [];
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    const doc = fromUuidSync(uuid);
                    if (!doc) return null;

                    let actorId;
                    if (doc.documentName === "Actor") {
                        actorId = doc.id;
                    } else if (doc.actor) {
                        actorId = doc.actor.id;
                    } else {
                        return null;
                    }

                    return {
                        sourceUuid: uuid,
                        actorId,
                        name: entry.name || doc.name
                    };
                })
                .filter(s => s);
        });
        // Deduplicate by sourceUuid
        const all = [...highlighted, ...linked];
        const seen = new Set();
        return all.filter(s => {
            if (seen.has(s.sourceUuid)) return false;
            seen.add(s.sourceUuid);
            return true;
        });
    } else {
        // Pull owned actors and their linked actors, then create a list of sources
        const owned = game.actors.filter(a => a.isOwner).map(a => ({
            sourceUuid: a.uuid,
            actorId: a.id,
            name: a.name
        }));
        if (!owned.length) {
            ui.notifications.warn("No owned actors. Please ask your GM to assign you ownership of an actor to prepare rolls.");
            return [];
        }
        const linked = owned.flatMap((source) => {
            const actor = game.actors.get(source.actorId);
            if (!actor) return [];
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    const doc = fromUuidSync(uuid);
                    if (!doc) return null;

                    let actorId;
                    if (doc.documentName === "Actor") {
                        actorId = doc.id;
                    } else if (doc.actor) {
                        actorId = doc.actor.id;
                    } else {
                        return null;
                    }

                    return {
                        sourceUuid: uuid,
                        actorId,
                        name: entry.name || doc.name
                    };
                })
                .filter(s => s);
        });
        // Deduplicate by sourceUuid
        const all = [...owned, ...linked];
        const seen = new Set();
        return all.filter(s => {
            if (seen.has(s.sourceUuid)) return false;
            seen.add(s.sourceUuid);
            return true;
        });
    }
}

async function updateQuadrant(messageId, quadrantNum, { sourceUuid, actorId, stat, advantage, statValue }) {

    let message = game.messages.get(messageId);

    if (!message) {
        ui.notifications.error("Could not find message to update with prepared roll.");
        return;
    }

    if (message.getFlag("bizarre-adventures-d6", `Locked`)) {
        ui.notifications.warn("Previous update for message still processing. Please wait...");
        const unlocked = await waitForUnlock(message)
        if (!unlocked) {
            ui.notifications.error("Message is still locked. Cannot update.");
            return;
        }
        message = game.messages.get(messageId); // refetch to ensure we have the latest state after unlocking
    }

    if (!message) return;

    await message.setFlag("bizarre-adventures-d6", `Locked`, true);
    message = game.messages.get(messageId); // refetch to ensure we have the latest state after locking
    await message.setFlag("bizarre-adventures-d6", `quadrant${quadrantNum}`, {
        sourceUuid,
        actorId,
        stat,
        advantage,
        statValue
    });

    await rerenderMessage(message);

    await message.setFlag("bizarre-adventures-d6", `Locked`, false);
}

/**
 * Resolve actor from sourceUuid+actorId with priority fallback.
 * @param {Object} source - { sourceUuid?, actorId? }
 * @returns {Actor|null}
 */
function resolveActorFromSource({ sourceUuid, actorId }) {
    if (sourceUuid) {
        const doc = fromUuidSync(sourceUuid);
        if (doc) {
            if (doc.actor) return doc.actor;
            if (doc.documentName === "Actor") return doc;
        }
    }
    if (actorId) {
        return game.actors.get(actorId);
    }
    return null;
}

async function waitForUnlock(message, maxWaitMs = 5000) {
    const startTime = Date.now();
    while (message.getFlag("bizarre-adventures-d6", `Locked`)) {
        if (Date.now() - startTime > maxWaitMs) {
            return false; // timeout
        }
        await new Promise(resolve => setTimeout(resolve, 100)); // wait 100ms
        message = game.messages.get(message.id); // refetch to get updated flags
    }
    return true;
}

async function rerenderMessage(message) {
    const type = message.getFlag("bizarre-adventures-d6", "type") || "action";
    const quadrants = {};
    let count = 4; // default for contests
    let allPrepared = true;

    if (type === "action") {
        count = 2;
    }
    
    // Read all quadrant flags
    for (let i = 1; i <= count; i++) {
        const flagData = message.getFlag("bizarre-adventures-d6", `quadrant${i}`);
        if (flagData) {
            const actor = resolveActorFromSource(flagData);
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: true,
                actorName: actor?.name || "Unknown",
                statLabel: flagData.stat || "",
                statValue: flagData.statValue || 0,
                advantage: flagData.advantage || 0,
                specialLabel: null, // TODO: resolve from stat special key
                rolled: false,
                rollHtml: null,
                lock: false
            };
        } else {
            // Unprepared quadrant
            allPrepared = false;
            quadrants[i] = {
                quadrantNum: i,
                label: actionLabels[i - 1].label,
                prepared: false,
                lock: false
            };
        }
    }
    
    // Add allPrepared flag to each quadrant
    Object.values(quadrants).forEach(q => q.allPrepared = allPrepared);
    
    if (type == "action") {
        await message.update({ content: await renderAction({ quadrants }) });
    } else { //its a contest
        await message.update({ content: await renderContest({ quadrants }) });
    }
}
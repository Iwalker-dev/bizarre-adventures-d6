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

async function renderAction(data) {
    data = {
        actionSide: {
            quadrants: [
                { index: 1, label: actionLabels[0].label },
                { index: 2, label: actionLabels[1].label }
            ]
        }
    }
  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/action.hbs",
    data
  );
}
async function renderContest(data) {
    data = {
        actionSide: {
            quadrants: [
                { index: 1, label: actionLabels[0].label },
                { index: 2, label: actionLabels[1].label }
            ]
        },
        reactionSide: {
            quadrants: [
                { index: 1, label: actionLabels[2].label },
                { index: 2, label: actionLabels[3].label }
            ]
        }
    }
  return await renderTemplateV1(
    "systems/bizarre-adventures-d6/templates/chat/contest.hbs",
    data
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
    let roll = new Roll("2d6 + 3");
    // await roll.evaluate();
    return ChatMessage.create({
        content: await renderAction({ rollHtml: await roll.render() })
    });
}

async function updateToContest(messageId) {
    const content = await renderContest();
    const message = game.messages.get(messageId);

    if (message?.isOwner) {
        await message.update({ content });   // keeps same message id
        return message;
    }

    return ChatMessage.create({ content }); // fallback if missing/uneditable
}

// Prepare Phase ----------------------------------------------------------------------------------------------

export function registerChatListeners() {
        $(document).on("click", ".chat-message .select-stat", async (event) => {
            event.preventDefault();
            const button = event.currentTarget;
            const quadrantNum = button.dataset.quadrant;
            const messageId = $(button).closest(".chat-message").data("messageId");
            
            await renderStatSelectionDialog(quadrantNum);


        });
}

async function renderStatSelectionDialog(quadrantNum) {
    const actorIds = getRollableActorIds();
    if (!actorIds.length) return;
    // Create map of ids
    const actors = actorIds.map(id => {
        // For each id, find the actor
        const actor = game.actors.get(id);
        // Extract the number type stats of the actor, specifically the key, actor name, and stat value
        const statsArray = Object.entries(actor.system.attributes.stats)
            .filter(([, stat]) => String(stat?.dtype || "").toLowerCase() === "number")
            .map(([key, stat]) => ({
                key,
                name: stat.label || key,
                value: stat.value ?? 0
        }));
        return {
            id: actor.id,
            name: actor.name,
            stats: statsArray
        };
    });

    // Create dialog
    const statDialogResult = await renderDialog('statAndAdvantage', { actors, quadrantNum });
    if (!statDialogResult) return;

    const { stat, advantage, actorId } = statDialogResult;
    if (!stat || advantage === undefined || !actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const specialArray = Array.isArray(actor.system.attributes.stats?.[stat]?.special)
        ? actor.system.attributes.stats[stat].special
        : [];
    let statValue = actor.system.attributes.stats[stat].value;

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
        }
    }
    
};


function getRollableActorIds(user = game.user) {
    // TODO: Add setting to manipulate the roles which can highlight tokens.
    // Also, use highlighted tokens instead of their actors incase they're unlinked
    // Also, look into the extend of flatMaps and if they can be optimized
    if (user.isGM) {
        // Pull highlighted token's related actors and their linked actors, then create a list of their ids
        const highlighted = canvas.tokens.controlled
            .map(t => {
                const actor = t.actor;
                return actor?.isToken ? (t.document?.baseActor || actor) : actor;
            })
            .filter(a => a)
            .map(a => a.id);

        if (!highlighted.length) {
            ui.notifications.warn("No tokens highlighted. Please highlight tokens to prepare rolls.");
            return [];
        }
        const linked = highlighted.flatMap((actorid) => {
            const actor = game.actors.get(actorid);
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    if (uuid.startsWith("Actor.")) {
                        return uuid.split(".")[1] || null;
                    }

                    const linkedDocument = fromUuidSync(uuid);
                    return linkedDocument?.id || null;   
                })
                .filter(id => !!id);
        });
        return [...new Set([...highlighted, ...linked])];
    } else {
        // Pull owned actors and their linked actors, then create a list of their ids
        const owned = game.actors.filter(a => a.isOwner).map(a => a.id);
        if (!owned.length) {
            ui.notifications.warn("No owned actors. Please ask your GM to assign you ownership of an actor to prepare rolls.");
            return [];
        }
        const linked = owned.flatMap((actorid) => {
            const actor = game.actors.get(actorid);
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;

                    if (uuid.startsWith("Actor.")) {
                        return uuid.split(".")[1] || null;
                    }

                    const linkedDocument = fromUuidSync(uuid);
                    return linkedDocument?.id || null;   
                })
                .filter(id => !!id);
        });
        return [...new Set([...owned, ...linked])];
    }
}
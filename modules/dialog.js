import { actionLabels } from "./constants.js";
import { getScope } from "./dice.js";
import { LUCK_MOVES } from "./luck-moves.js";
import { resolveActorFromSource } from "./apps/roller/actors.js";
const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;

function capitalizeFirst(text) {
    const s = String(text ?? "").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
// TODO: Move to utils/actors
function isActorLike(value) {
    if (!value || typeof value !== "object") return false;
    return value.documentName === "Actor"
        || Object.prototype.hasOwnProperty.call(value, "items")
        || Object.prototype.hasOwnProperty.call(value, "system")
        || Object.prototype.hasOwnProperty.call(value, "type");
}
// TODO: Move to luck moves
export function buildGambitDialogEntries(actorEntries = []) {
    return (actorEntries ?? [])
        .map((entry) => {
            const resolvedActor = isActorLike(entry)
                ? entry
                : resolveActorFromSource({
                    sourceUuid: typeof entry?.sourceUuid === "string" ? entry.sourceUuid : entry?.uuid,
                    actorId: entry?.actorId || entry?.id || entry?._id
                });

            if (!resolvedActor) return null;

            const actorId = resolvedActor?.id || entry?.actorId || entry?.id || null;
            const sourceUuid = resolvedActor?.uuid || entry?.sourceUuid || entry?.uuid || null;
            const name = resolvedActor?.name ?? entry?.name ?? "";
            const items = (resolvedActor.items ?? []).filter((item) => item?.type === "gambit");

            return {
                actor: {
                    ...resolvedActor,
                    name,
                    items
                },
                actorId,
                sourceUuid,
                name
            };
        })
        .filter(Boolean);
}

export async function renderDialog(dialog, dialogData = {}) {
    // Requires actor object
    if (dialog === "gambit") {
        const luckMoves = Object.fromEntries(
                        Object.entries(LUCK_MOVES)
                    );
        const gambitsByActor = buildGambitDialogEntries(dialogData.actors).map(({ actor, actorId, sourceUuid }) => ({
            actor,
            actorId,
            sourceUuid
        }));
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/gambit.hbs",
            { gambitsByActor, luckMoves, quadrantNum: dialogData.quadrantNum }
        );
        return await new Promise((resolve) => {
            new Dialog({
                title: `Select a Gambit for ${actionLabels[dialogData.quadrantNum - 1].label} (CANNOT BE UNDONE ONCE REVEALED)`,
                content,
                buttons: {
                    confirm: {
                        label: "Confirm",
                        callback: (html) => { 

                            const selectedGambitName = html.find(".gambit-option.selected").data("gambitName") || null;
                            // const selectedSourceUuid = html.find(".gambit-option.selected").data("sourceUuid");
                            const selectedGambitedMove =  html.find(".gambit-option.selected").data("gambitMove")
                            const selectedActorId = html.find(".gambit-option.selected").data("actorId");
                            const selectedItemId = html.find(".gambit-option.selected").data("itemId");

                            if (!selectedGambitName) {
                                ui.notifications.warn("Pick a Gambit first.");
                                return;
                            }

                            resolve({
                                gambit: {
                                    name: selectedGambitName,
                                    move: selectedGambitedMove,
                                    actorId: selectedActorId,
                                    itemId: selectedItemId
                                },
                                // sourceUuid: selectedSourceUuid,
                                itemId: selectedItemId,
                                actorId: selectedActorId
                            });
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                render: (html) => {
                    const dialogApp = html.closest(".app");
                    const dialogButtons = dialogApp.find(".dialog-buttons");
                    const confirmBtn = dialogButtons.find('button[data-button="confirm"]');

                    const isReady = () => html.find(".gambit-option.selected").length > 0;

                    const triggerInvalidConfirmFeedback = () => {
                        confirmBtn.removeClass("bad6-invalid-shake");
                        void confirmBtn[0]?.offsetWidth;
                        confirmBtn.addClass("bad6-invalid-shake");
                        window.setTimeout(() => confirmBtn.removeClass("bad6-invalid-shake"), 220);
                    };

                    const updateConfirmState = () => {
                        const enabled = isReady();
                        confirmBtn
                            .prop("disabled", !enabled)
                            .attr("title", enabled ? "" : "Pick a Gambit first.")
                            .attr("aria-disabled", !enabled)
                            .toggleClass("is-disabled", !enabled);
                    };

                    const onConfirmAttemptCapture = (event) => {
                        if (isReady()) return;
                        triggerInvalidConfirmFeedback();
                        ui.notifications.warn("Pick a Gambit first.");
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    };

                    confirmBtn[0]?.addEventListener("click", onConfirmAttemptCapture, true);

                    html.find(".gambit-option").on("click", function () {
                        html.find(".gambit-option").removeClass("selected");
                        $(this).addClass("selected");
                        updateConfirmState();
                    });

                    updateConfirmState();
                },
                close: () => resolve(null),
                default: "confirm"
            }, { width: 560, height: "auto", resizable: true }).render(true);
        });

    }

    if (dialog === "stat") {
        const luckMoves = Object.fromEntries( //TODO: Add logic to fail luck buttons you cannot use. Base this off of highlighted token for gm, and owned actors for player.
                                Object.entries(LUCK_MOVES).filter(([key]) => key !== "gambit") // Cannot save a gambit with a gambit
                            );
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/stat.hbs",
            { actors: dialogData.actors, quadrantNum: dialogData.quadrantNum, currentAdvantage: dialogData.currentAdvantage, luckMoves }
        );

        return await new Promise((resolve) => {
            new Dialog({
                title: `Select Stat and Gambit for ${actionLabels[dialogData.quadrantNum - 1].label}`,
                content,
                buttons: {
                    confirm: {
                        label: "Confirm",
                        callback: (html) => { 
                            const gambitName =  html.find("#gambit-name").val() || null;
                            const gambitTrigger =  html.find("#gambit-trigger").val()|| null;
                            const gambitMove = html.find(".gambit-option.selected").data("stat")|| null;

                            const selectedStat = html.find(".stat-option.selected").data("stat");
                            const selectedSourceUuid = html.find(".stat-option.selected").data("sourceUuid");
                            const selectedActorId = html.find(".stat-option.selected").data("actorId");
                            const selectedModifierIds = html.find(".custom-modifier-option:checked")
                                .map((_, el) => String(el.value))
                                .get();

                            if (!selectedStat) {
                                ui.notifications.warn("Pick a Stat first.");
                                return;
                            }
                            
                            if (gambitMove || gambitTrigger || gambitName) {
                                if (!gambitMove) {
                                    ui.notifications.warn("Incomplete Gambit: Gambit requires a luck move.");
                                    return;
                                }
                                if (!gambitTrigger) {
                                    ui.notifications.warn("Incomplete Gambit: Gambit requires a trigger.");
                                    return;
                                }
                                if (!gambitName) {
                                    ui.notifications.warn("Incomplete Gambit: Gambit requires a name.");
                                    return;
                                }
                            }

                            resolve({
                                stat: selectedStat,
                                sourceUuid: selectedSourceUuid,
                                actorId: selectedActorId,
                                selectedModifierIds,
                                gambit: {
                                    name: gambitName,
                                    trigger: gambitTrigger,
                                    luckMove: gambitMove
                                }
                            });
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                render: (html) => {
                    const dialogApp = html.closest(".app");
                    const dialogButtons = dialogApp.find(".dialog-buttons");
                    const confirmBtn = dialogButtons.find('button[data-button="confirm"]');

                    const isReady = () => html.find(".stat-option.selected").length > 0;

                    const triggerInvalidConfirmFeedback = () => {
                        confirmBtn.removeClass("bad6-invalid-shake");
                        void confirmBtn[0]?.offsetWidth;
                        confirmBtn.addClass("bad6-invalid-shake");
                        window.setTimeout(() => confirmBtn.removeClass("bad6-invalid-shake"), 220);
                    };

                    const updateConfirmState = () => {
                        const enabled = isReady();
                        confirmBtn
                            .prop("disabled", !enabled)
                            .attr("title", enabled ? "" : "Pick a Stat first.")
                            .attr("aria-disabled", !enabled)
                            .toggleClass("is-disabled", !enabled);
                    };

                    const onConfirmAttemptCapture = (event) => {
                        if (isReady()) return;
                        triggerInvalidConfirmFeedback();
                        ui.notifications.warn("Pick a Stat first.");
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    };

                    confirmBtn[0]?.addEventListener("click", onConfirmAttemptCapture, true);

                    const parseSelectedModifiers = () => {
                        const selectedButton = html.find(".stat-option.selected");
                        if (!selectedButton.length) return [];
                        const encoded = selectedButton.attr("data-modifiers") || "";
                        if (!encoded) return [];
                        try {
                            const parsed = JSON.parse(decodeURIComponent(encoded));
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (_error) {
                            return [];
                        }
                    };

                    const formatModifierLabel = (line) => {
                        const variable = capitalizeFirst(line.variable || "modifier");
                        const sourceName = line.sourceName || "Custom";
                        const lineValue = Number(line.value ?? 0);
                        const perPairBadge = line.unique
                            ? (line.unavailable ? " [Per-pair: used]" : " [Per-pair]")
                            : "";
                        return `${variable} ${line.operand || "+"} ${lineValue} (${sourceName})${perPairBadge}`;
                    };

                    const renderCustomModifierChoices = () => {
                        const container = html.find(".custom-modifier-list");
                        if (!container.length) return;

                        const selectedButton = html.find(".stat-option.selected");
                        if (!selectedButton.length) {
                            container.html("<em>Select a stat to view custom modifiers.</em>");
                            return;
                        }

                        const existingChecked = new Set(
                            container.find(".custom-modifier-option:checked").map((_, el) => String(el.value)).get()
                        );

                        const selectedStat = String(selectedButton.data("stat") || "").trim().toLowerCase();
                        const allLines = parseSelectedModifiers();
                        const scope = getScope(selectedStat);
                        const filtered = allLines.filter((line) => {
                            const lineStat = String(line?.stat || "").trim().toLowerCase();
                            return !lineStat || lineStat === selectedStat || lineStat === scope;
                        });

                        const required = filtered.filter((line) => !line.optional);
                        const optional = filtered.filter((line) => !!line.optional);
                        
                        if (!required.length && !optional.length) {
                            container.html("<em>No custom modifiers for this stat.</em>");
                            return;
                        }

                        const chunks = [];
                        if (required.length) {
                            chunks.push('<div class="custom-modifier-group"><strong>Auto-applied</strong></div>');
                            for (const line of required) {
                                const unavailableClass = line.unavailable ? " is-unavailable" : "";
                                const reason = line.unavailable && line.unavailableReason ? ` — ${line.unavailableReason}` : "";
                                chunks.push(`<div class="custom-modifier-auto${unavailableClass}">• ${formatModifierLabel(line)}${reason}</div>`);
                            }
                        }

                        if (optional.length) {
                            chunks.push('<div class="custom-modifier-group"><strong>Optional</strong></div>');
                            for (const line of optional) {
                                const lineId = String(line.id || "");
                                const isUnavailable = !!line.unavailable;
                                const checked = !isUnavailable && existingChecked.has(lineId) ? "checked" : "";
                                const disabled = isUnavailable ? "disabled" : "";
                                const unavailableClass = isUnavailable ? " is-unavailable" : "";
                                const reason = isUnavailable && line.unavailableReason ? ` — ${line.unavailableReason}` : "";
                                chunks.push(
                                    `<label class="custom-modifier-option-row${unavailableClass}">` +
                                    `<input class="custom-modifier-option" type="checkbox" value="${lineId}" ${checked} ${disabled} /> ` +
                                    `${formatModifierLabel(line)}${reason}` +
                                    `</label>`
                                );
                            }
                        }

                        container.html(chunks.join(""));
                    };

                    html.find(".stat-option").on("click", function () {
                        html.find(".stat-option").removeClass("selected");
                        $(this).addClass("selected");
                        renderCustomModifierChoices();
                        updateConfirmState();
                    });

                    html.find(".gambit-option").on("click", function () {
                        html.find(".gambit-option").removeClass("selected");
                        $(this).addClass("selected");
                    });

                    renderCustomModifierChoices();
                    updateConfirmState();
                },
                close: () => resolve(null),
                default: "confirm"
            }, { width: 560, height: "auto", resizable: true }).render(true);
        });
    }

    if (dialog === "advantage") {
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/advantage.hbs",
            { currentAdvantage: dialogData.currentAdvantage }
        );

        const rawQuadrant = Number(dialogData.quadrantNum);
        const pairedEvenQuadrant = Number.isInteger(rawQuadrant)
            ? (rawQuadrant % 2 === 0 ? rawQuadrant : rawQuadrant + 1)
            : null;
        const pairLabel = actionLabels[(pairedEvenQuadrant ?? 0) - 1]?.label ?? "Pair";

        return await new Promise((resolve) => {
            let settled = false;
            const settle = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };

            const dialogApp = new Dialog({
                title: `Select Advantage for ${pairLabel}`,
                content,
                buttons: {
                    cancel: {
                        label: "Cancel",
                        callback: () => settle(null)
                    }
                },
                render: (html) => {
                    const currentAdvantage = Number(dialogData.currentAdvantage);
                    if (Number.isInteger(currentAdvantage) && currentAdvantage >= 0 && currentAdvantage <= 3) {
                        html.find(`.advantage-option[data-advantage="${currentAdvantage}"]`).addClass("is-current");
                    }

                    html.find(".advantage-option").on("click", (event) => {
                        const selected = Number($(event.currentTarget).data("advantage"));
                        const safeAdvantage = Number.isFinite(selected)
                            ? Math.max(0, Math.min(3, Math.floor(selected)))
                            : 0;

                        settle(safeAdvantage);
                        dialogApp.close();
                    });
                },
                close: () => settle(null),
                default: "cancel"
            }, { width: 360, height: "auto", resizable: false });

            dialogApp.render(true);
        });
    }

    if (dialog === "special") {
        const specialArray = dialogData.specialArray;
        const baseStat = specialArray[0];
        const baseStatKey = typeof baseStat === "string" ? baseStat : baseStat.key;
        const baseStatLabel = capitalizeFirst(typeof baseStat === "string" ? baseStat : baseStat.label);
        const baseStatValue = typeof baseStat === "string" ? null : baseStat.value;

        const specials = specialArray.slice(1).map((special, index) => {
            const fallbackKey = (`special-${index}`).toString().trim();
            const specialLabel = capitalizeFirst(special?.label ?? special?.key ?? fallbackKey).toString();
            return {
                key: (special?.key ?? fallbackKey).toString(),
                label: `${baseStatLabel} (${specialLabel})`,
                value: Number(special?.value ?? 0)
            };
        });

        const stats = [{ key: baseStatKey, label: baseStatLabel, value: baseStatValue }, ...specials];

        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/special.hbs",
            { key: baseStatKey, label: baseStatLabel, stats }
        );

        return await new Promise((resolve) => {
            new Dialog({
                title: "Select a Special",
                content,
                buttons: {
                    confirm: {
                        label: "Confirm",
                        callback: (html) => {
                            const selectedSpecial = html.find(".special-option.selected").data("stat");
                            if (!selectedSpecial) {
                                ui.notifications.warn("Pick a Special first.");
                                return;
                            }
                            resolve(selectedSpecial);
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                render: (html) => {
                    const dialogApp = html.closest(".app");
                    const dialogButtons = dialogApp.find(".dialog-buttons");
                    const confirmBtn = dialogButtons.find('button[data-button="confirm"]');

                    const isReady = () => html.find(".special-option.selected").length > 0;

                    const triggerInvalidConfirmFeedback = () => {
                        confirmBtn.removeClass("bad6-invalid-shake");
                        void confirmBtn[0]?.offsetWidth;
                        confirmBtn.addClass("bad6-invalid-shake");
                        window.setTimeout(() => confirmBtn.removeClass("bad6-invalid-shake"), 220);
                    };

                    const updateConfirmState = () => {
                        const enabled = isReady();
                        confirmBtn
                            .prop("disabled", !enabled)
                            .attr("title", enabled ? "" : "Pick a Stat first.")
                            .attr("aria-disabled", !enabled)
                            .toggleClass("is-disabled", !enabled);
                    };

                    const onConfirmAttemptCapture = (event) => {
                        if (isReady()) return;
                        triggerInvalidConfirmFeedback();
                        ui.notifications.warn("Pick a Stat first.");
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    };

                    confirmBtn[0]?.addEventListener("click", onConfirmAttemptCapture, true);

                    html.find(".special-option").on("click", function () {
                        html.find(".special-option").removeClass("selected");
                        $(this).addClass("selected");
                        updateConfirmState();
                    });

                    updateConfirmState();
                },
                close: () => resolve(null),
                default: "confirm"
            }).render(true);
        });
    }

    if (dialog === "burn") {
        const initialValue = String(dialogData.value ?? "");
        const inputName = "burn-value";
        const content = `
            <div class="form-group">
                <label for="${inputName}">Value</label>
                <input id="${inputName}" name="${inputName}" type="number" value="${initialValue}" placeholder="Enter value" />
            </div>
        `;

        return await new Promise((resolve) => {
            new Dialog({
                title: `Change ${dialogData.type} Value`,
                content,
                buttons: {
                    confirm: {
                        label: "Confirm",
                        callback: (html) => {
                            const value = html.find(`input[name="${inputName}"]`).val()?.trim() ?? "";
                            resolve(value);
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                render: (html) => {
                    html.find(`input[name="${inputName}"]`).focus();
                },
                close: () => resolve(null),
                default: "confirm"
            }).render(true);
        });
    }

    return null;
}

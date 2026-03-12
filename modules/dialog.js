import { actionLabels } from "./constants.js";
const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;

function capitalizeFirst(text) {
    const s = String(text ?? "").trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export async function renderDialog(dialog, dialogData = {}) {
    if (dialog == 'statAndAdvantage') {
        // Render template
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/statAndAdvantage.hbs"
            , { actors: dialogData.actors, quadrantNum: dialogData.quadrantNum, currentAdvantage: dialogData.currentAdvantage }
        );
        return await new Promise((resolve) => {
            new Dialog({
                title: `Select Stat and Advantage for ${actionLabels[dialogData.quadrantNum - 1].label}`,
                content: content,
                buttons: {
                    confirm: {
                        label: "Confirm",
                        callback: (html) => {
                            const selectedAdvantage = html.find('input[name="advantage"]:checked').val();
                            const selectedStat = html.find(".stat-option.selected").data("stat");
                            const selectedSourceUuid = html.find(".stat-option.selected").data("sourceUuid");
                            const selectedActorId = html.find(".stat-option.selected").data("actorId");
                            const selectedModifierIds = html.find(".custom-modifier-option:checked")
                                .map((_, el) => String(el.value))
                                .get();

                            // Block if either missing
                            if (selectedAdvantage === undefined || !selectedStat) {
                                ui.notifications.warn("Pick both a Stat and an Advantage first.");
                                return;
                            }

                            resolve({
                                advantage: parseInt(selectedAdvantage, 10) // allows 0
                                ,stat: selectedStat
                                ,sourceUuid: selectedSourceUuid
                                ,actorId: selectedActorId
                                ,selectedModifierIds
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

                    const isReady = () => {
                        const hasAdvantage = html.find('input[name="advantage"]:checked').length > 0;
                        const hasStat = html.find(".stat-option.selected").length > 0;
                        return hasAdvantage && hasStat;
                    };

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
                                .attr("title", enabled ? "" : "Pick both a Stat and an Advantage first.")
                                .attr("aria-disabled", !enabled)
                                .toggleClass("is-disabled", !enabled);
                    };

                    // Capture phase: intercept before Dialog's own click handler
                    const onConfirmAttemptCapture = (event) => {
                        if (isReady()) return;
                        triggerInvalidConfirmFeedback();
                        ui.notifications.warn("Pick both a Stat and an Advantage first.");
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
                        return `${variable} ${line.operand || "+"} ${lineValue} (${sourceName})`;
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
                        const filtered = allLines.filter((line) => {
                            const lineStat = String(line?.stat || "").trim().toLowerCase();
                            return !lineStat || lineStat === selectedStat;
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
                                chunks.push(`<div class="custom-modifier-auto">• ${formatModifierLabel(line)}</div>`);
                            }
                        }

                        if (optional.length) {
                            chunks.push('<div class="custom-modifier-group"><strong>Optional</strong></div>');
                            for (const line of optional) {
                                const lineId = String(line.id || "");
                                const checked = existingChecked.has(lineId) ? "checked" : "";
                                chunks.push(
                                    `<label class="custom-modifier-option-row">` +
                                    `<input class="custom-modifier-option" type="checkbox" value="${lineId}" ${checked} /> ` +
                                    `${formatModifierLabel(line)}` +
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

                const currentAdvantage = Number(dialogData.currentAdvantage);
                if (Number.isInteger(currentAdvantage) && currentAdvantage >= 0 && currentAdvantage <= 3) {
                    html.find(`input[name="advantage"][value="${currentAdvantage}"]`).prop("checked", true);
                }

                html.find('input[name="advantage"]').on("change", updateConfirmState);
                renderCustomModifierChoices();
                updateConfirmState(); // IMPORTANT: start disabled
            },
            close: () => resolve(null),
            default: "confirm"
        }).render(true);
    });
    }
    else if (dialog == "special") {
        const specialArray = dialogData.specialArray;
        const baseStat = specialArray[0];
        const baseStatKey = typeof baseStat === "string" ? baseStat : baseStat.key;
        const baseStatLabel = capitalizeFirst(typeof baseStat === "string" ? baseStat : baseStat.label);
        const baseStatValue = typeof baseStat === "string" ? null : baseStat.value;

        const specials = specialArray.slice(1).map((special, index) => {
            const fallbackKey = (`special-${index}`).toString().trim();
            const specialLabel = capitalizeFirst(special?.label ?? special?.key ?? fallbackKey).toString()
            return {
                key: (special?.key ?? fallbackKey).toString(),
                label: `${baseStatLabel} (${specialLabel})`,
                value: Number(special?.value ?? 0)
            };
        });

        const stats = [{ key: baseStatKey, label: baseStatLabel, value: baseStatValue }, ...specials];
        


        // Render template
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/special.hbs"
            , { key: baseStatKey
                , label: baseStatLabel
                , stats: stats
             }
        );
        return await new Promise((resolve) => {
            new Dialog({
                title: "Select a Special",
                content: content,
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
                                .attr("title", enabled ? "" : "Pick both a Stat first.")
                                .attr("aria-disabled", !enabled)
                                .toggleClass("is-disabled", !enabled);
                    };

                    // Capture phase: intercept before Dialog's own click handler
                    const onConfirmAttemptCapture = (event) => {
                        if (isReady()) return;
                        triggerInvalidConfirmFeedback();
                        ui.notifications.warn("Pick both a Stat first.");
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
                updateConfirmState(); // IMPORTANT: start disabled
                },
                close: () => resolve(null),
                default: "confirm"
            }).render(true);
        });
    }
}
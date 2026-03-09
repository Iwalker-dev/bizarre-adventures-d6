import { actionLabels } from "./constants.js";
const renderTemplateV1 = foundry.applications.handlebars.renderTemplate;

export async function renderDialog(dialog, dialogData = {}) {
    if (dialog == 'statAndAdvantage') {
        // Render template
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/statAndAdvantage.hbs"
            , { actors: dialogData.actors, quadrantNum: dialogData.quadrantNum }
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

                            // Block if either missing
                            if (selectedAdvantage === undefined || !selectedStat) {
                                ui.notifications.warn("Pick both a Stat and an Advantage first.");
                                return;
                            }

                            resolve({
                                advantage: parseInt(selectedAdvantage, 10) // allows 0
                                ,stat: selectedStat
                                ,actorId: html.find(".stat-option.selected").data("actorId")
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

                    html.find(".stat-option").on("click", function () {
                        html.find(".stat-option").removeClass("selected");
                        $(this).addClass("selected");
                        updateConfirmState();
                    });

                html.find('input[name="advantage"]').on("change", updateConfirmState);
                updateConfirmState(); // IMPORTANT: start disabled
            },
            close: () => resolve(null),
            default: "confirm"
        }).render(true);
    });
    }
    else if (dialog == "special") {
        const specialArray = dialogData.specialArray;
        const baseStat = dialogData.specialArray[0];
        const baseStatKey = typeof baseStat === "string" ? baseStat : baseStat.key;
        const baseStatLabel = typeof baseStat === "string" ? baseStat : baseStat.label || baseStat?.key;

        const specials = specialArray.slice(1).map((special, index) => {
            const fallbackKey = (special?.name ?? `special-${index}`).toString().trim();
            return {
            key: (special?.key ?? fallbackKey).toString()
            ,label: (special?.label ?? special?.name ?? special?.key ?? fallbackKey).toString()
            ,value: Number(special?.value ?? special?.points ?? 0)
        };
        }));


        // Render template
        const content = await renderTemplateV1(
            "systems/bizarre-adventures-d6/templates/dialog/special.hbs"
            , { key: baseStatKey
                , label: baseStatLabel
                , stats: specials
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
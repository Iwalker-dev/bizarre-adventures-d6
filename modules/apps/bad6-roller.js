let socket;
export function setupRollerSocket() {
    Hooks.on("getSceneControlButtons", (controls) => {
        console.log("Injecting BAD6 Roller Button");
        const tokenControls = controls.find(c => c.name === "token");
        if (tokenControls) {
            tokenControls.tools.push({
                name: "rollerButton",
                title: "D6 Roller",
                icon: "fas fa-dice-d6",
                visible: true,
                onClick: () => {
                    main();
                },
                button: true
            });
        }
    });
}
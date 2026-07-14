// Opens when interacting with a formula item, allowing compact editing of its modifiers.

/*
Requires:
    Unique Formulas
        - Can only be used once per pair
            - If Optional, appears grayed out if visible and used
    Option to add default persistent formulas (For Pillarmen)
    Optional Bonuses (pre-existing)
    User Friendly Formula Editing
    Theming similar to character sheets
     - (Must be different to item sheets but still similar)
Related files:
    modules\apps\bad6-roller.js
        - Must be edited to support re/action and actor restrictions
            - Likely use chat flags to store formula IDs
                - Allows direct checking for owning actor
                    existence means you can check for it when checking to make sure its unique to the re/action
    modules\dice.js
        - Holds the Current Formula logic
Optionally:
    Make into an item for automatic IDs (can create them otherwise)
     - May make creating themes slightly easier or harder
        - depends on expected level of customization
*/

/*
Suggestion added by GitHub Copilot (GPT-5.3-Codex) on 2026-07-11

Goal:
    Keep formula controls compact on actor sheets while making editing clearer and faster.

Updated UI direction (based on your notes):
    - Formula entries should be shown as compact labels/chips on sheets.
    - Clicking a formula label opens a focused edit window/dialog.
    - Formula lists should be displayed similarly to item/hit rows on sheets because that pattern is already user-friendly.

Small implementation plan:
    1) Display mode on sheets
        - Render each formula as a row/label with:
            - name
            - quick badges (Optional, Once/Actor, Once/Action, persistent defaults)
            - enabled/disabled state
        - Keep row height small to avoid overflow in current sheet layouts.

    2) Click-to-edit dialog
        - Open a compact modal when a label is clicked.
        - Modal fields:
            - formula name
            - optional toggle
            - unique scope (none, actor, pair action, pair reaction)
            - force-eligible toggle
            - variable/operand/value line editor
        - Save writes back to item system data and refreshes the row label.

    3) Restriction enforcement model
        - Keep selectedModifierIds flow for optional selection.
        - Add uniqueness checks before applyFormulaLines:
            - Once/Actor: same formula id can apply once per actor owner in this message context.
            - Once/Action or Once/Reaction: same formula id can apply once per lane pair (1/2 or 3/4).
        - Store usage state in chat flags for the roll message so checks are deterministic per roll context.

    4) Force behavior
        - If formula is force-eligible and user enables force for that roll, bypass uniqueness blocking for that formula.
        - Record that forced state in flags/tooltips for auditability.

    5) Feedback clarity
        - Tooltip/result text should show per formula line:
            - applied (and why)
            - skipped (optional not selected, actor-unique blocked, lane-unique blocked)
        - This reduces confusion during prepare and resolve.

Why this fits the current codebase:
    - modules/dice.js already supports line-based application and optional selection.
    - modules/apps/roller/quadrants.js already persists selectedModifierIds and custom line metadata in chat flags.
    - The proposal adds minimal new concepts while aligning with existing item/hit visual patterns.
*/

// It may be better to use the existing held info, like actor id. Use actor id and formula index to detect states.


/* CURRENT FOCUS
Unique Modifiers added along with user/stand specific modifiers, but unique modifiers aren't visually obvious to end user
Requires
    - Action Dialog must know the state of the formula when rendering
Add
    - Gray out when it wont be calculated
    - Prepend "[Used]" to it when active
    - Remove checkbox from optional while true
Then
    - Add functionality so pillarmen automatically gain a formula
    - Figure out why the welcome message isnt triggering
    - Release

*/
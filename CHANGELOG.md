# Changelog – BAD6 System


## [0.9.4] – 2025-09-06

## Readability fixes
- Beautified All (owned) JS.

### Notifications
- Hue shift now reminds you of its keybind, and warns when it will reset.

### Optimization
- Cleaned up bad6.js
- Cleaned up utils.js

### Automation
- FoundryVTT Release 

## [0.9.5] - 2025-10-10

#### Actor Sheet Functionality
- Added Images to sheets

### - 2025-11-28
#### Bug Fixes
- Fixed an error with user input rendering

#### Features
- Added basic direct Actor name changing support for owners (Click the name)

#### Optimization
- Moved actor-configs.js to config.js

### - 2025-12-3

#### Features
- Added custom default images for Power types

### - 2025-12-6
#### Features
- Added fields for Freak types
- Added scalability for future types

### - 2026-1-31
#### Features
- GM Controlled contests (your targets become the reactors when rolling)
- Added user-ability linking

### - 2026-2-3
#### Features
- Added simple formula customization based on items

### - 2026-2-8
#### Fixes
Fix issue with sidebar buttons appearing as "SIDEBAR.ACTIONS.CREATE"
(When it tried to concatenate that object, it got coerced to [object Object])
#### Features
Added Luck Automation (Requires more testing)
Allow clicking a linked actor to open their sheet (also create css for linked actors)

## [0.9.6] - 2026-2-9


### - 2026-2-9
#### Features
- Contest roller overhaul: single-roll flow with chat-message quadrant buttons
- Action/Reaction contest layout with in-message results and separators
- Dice So Nice animation support via direct roll animation
- Luck automation expanded: Feint, Fudge (applies to next roll), Mulligan, Persist
- Fudge/Modifier dialog now appears even with no optional formula lines
- Linked actor quality-of-life: open sheets on click, reciprocal linking, and sheet UI

#### Fixes
- Persist now replays roll pair correctly
- Fudge cancel now aborts roll

### - 2026-2-11
#### Features
- Contest roller order updated to Reaction 1 → Reaction 2 → Action 1 → Action 2
- Contest roll buttons now stay visible; order enforced on stat selection with warnings
- Feint available for all rolls; roll 2 allows Feint/Fudge only for same/linked actors

#### Fixes
- Closing stat dialog (X) now behaves like Cancel and clears Feint state

### - 2026-2-17
#### Features
- Double-click the D6 Roller scene control to create a contest in chat
## [0.9.7] - 2026-2-17
### - 2026-2-18
#### Fixes
- Migrations now take advantage of foundry migration hooks.

# What's left?
- Create different backgrounds for all user types
- Use Lancer as the default combat option
- Clean up code
- Make more User-Friendly
- Remove Depreciated methods
- Add to FoundryVTT browser
- Add custom images for user and stand type actors
- Implement Learning automation


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
## [0.9.8] - 2026-2-26
### - 2026-2-26
#### Fixes
- Migrations *now* take advantage of foundry migration hooks.
- Attempted fix on actor images failing to save
- Fixed costs using the old/raw actor data for type-based configs
- migration no longer runs twice
- migration now runs later to avoid setting conflicts
- defined single universal init for readability
- toggleable debug log option added to settings
- moved duplicate cost logic to base actor
### - 2026-2-27
- Added Special stat handling
## [0.9.8.1] - 2026-2-28
#### Fixes
- Fixed 'infinite' roll logic
- Attempted fix for potential syncing issues during rolls
## [0.9.8.2] - 2026-3-2
#### Fixes
- Welcome doesnt occur every boot.
## [0.9.8.3] - 2026-3-3
#### Fixes
- Simplified birthday field to avoid bug with saving year
- Added Function field for Vampires
## [0.9.8.4] - 2026-3-3
- Altered contest and roll flow for better user-friendliness
- Added proper feint logic
- Replaced depreciating functions
- Optimized roller for organization, performance, readability, etc.
## [0.9.8.5] - 2026-3-6
### Added
- Roller modularity
- Luck chips per roll
- Gambit indicator on luck chips (gold outline)
### Fixed
- Feint logic
- Unready logic
### Optimizations
- Single overhead message handler instead of per-message handler
- message-store state sync
- Centralized remaining roller user-facing text into `modules/apps/roller/constants.js` (notifications, participant dialogs, status labels, result labels/messages)
## [0.9.9] - 2026-3-9
### Features
- Reworked roller for optimization, readability and simplicity
- Reworked dialogs for simplicity
- Added all luck moves
### Fixes
- Standardized special stats to `key`, `label`, and `value`.
- Added world migration to convert older special entries (`name`/`points`) to the new schema.
- Retuned actor migrator functionality outside of per-version migrations.
- Set flashback to be always useable
- Allow privatizing of roll formula through game settings
- Allow privitizing of actor names through game settings
- Override through actor owner
## [0.9.9.1] - 2026-3-12
- updated user-facing instructions
- updated me-facing instructions
## [0.9.9.2] - 2026-3-12
### Fixes
- Gave "Unready" a clarifying tooltip
### Features
- Added Property fields to stand types
- Increased double click intercept time
## [0.9.10] - 2026-3-15
### Features
#### Sheet Overhaul
- More informative first page
- Better use of space
- Gave chart to all actors
- Normalized field names for modularity
### Fixes
- Mulligan properly applies at <=2 rather than < 2
- Mulligan/Fudge functionality revaluates roll
- Advantage syncs for entire pair
- Linked actors are considered when showing custom modifiers
## [0.9.10.1] - 2026-3-16
- Readded infinite stat logic (lost during overhaul)
## [0.9.10.2] - 2026-3-17
- Blind fix for worldbuilding actors not being migrated on reload attempted
## [0.9.11] - 2026-3-17
- Changed order of sheet ribbon information
- Added Draggable strip to top of sheets (Known issue: Slightly clips into tabs.)
- Split character-actor-sheet.css into base-actor folder
- Split BAD6 Roller for readability
- Seperated Advantage and Stat dialogs
- Added gradient to sheets
- Added Reckless Reactions
- Made advantage per re/action more clear
- Fix for chat permissions not being recalculated on reload
## [0.9.11.1] -  3/19/26
- Quick fix for drag strip blocking interaction
## [0.9.11.2] - 3/20/26
- Another fix for adding images (to user actor sheets)
- Gave Armed Phenomena its stage fields (Still need to add user stats)
## [0.9.11.3] - 3/21/26
- Fix for players triggering luck moves.
- Created small warning for Armed Phenomena users.
- Fixed tooltip being altered by locking the message for Resolution
- Simplified resolve message to look better
- Fixed non-buttons gaining the lock tooltip
## [0.9.11.4] - 3/21/26
- Fixed changelog dating
## [0.9.12] - 5/1/26
- Verified basic functionality with V14
## [0.9.13] - 2026-5-19
- Pre allowed use in V15
- Added User stat group and Stand stat group to formulas
- Added Unique Per-pair modifiers
- Added Pillarman boosts
- Fixed Phenomena fields
- Fixed depreciated methods preventing stat list manipulation (ex for Independent and Armed Phenomenon users)
- Added Armed Phenomena Support (The placeholder will be removed once Im sure)
- Fixed Flashbacks only appearing for GM
## [0.9.13.1] - 2026-7-15
- Simplified reused migration logic
- Setup System Discord and Official Discord Links
- Setup System Discord
## [0.9.13.2] - 2026-7-15
- Removed pre-allowed use in v15 (Won't allow publishing in such a state)
## [0.9.14] - 2026-8-6
- Reworked Privacy Settings to be based on messageMode. "In Character" currently has no effect (message mode uses current speaker context as default)
- Changing version semantics. "0.9" is the doc version. "14" is the system version. Not intended, but seems like the least confusing solution
- Gambits reworked to doc v0.9
- Luck updated to use 15 at infinite value. Right clicking the 'infinite' star allows editing of the exact value.

## [0.9.14.1] - 2026-8-15
- Fixed bug with message mode update failing entire actions due to socket restrictions.
- Updated hamon and cyborg descriptions

## [0.9.14.3] - 2026-8-24
- Gambit execution properly extracts the luck move
- Gambit dialog request is returned to correct sender
- It has been noted that game.messages.contents.at(-x) can expose any hidden message, overhaul of security considered
- Small patch for error emitted by action on creation
- Removed access to the reckless button
- Fixed advantage applying its visibility to first quadrant
- Fixed gambits not checking if you could afford them
- Fixed gambit dialog breaking due to async promise within confirmation dialog
- Fixed being unable to unselect a gambit
- Began standardized locations of gambit logic
- Rough patch for gambit warning in getLuckMoveExecutionContext

## [0.9.14.4] - 2026-8-24
- Added small warning when running on foundry versions below v14

# What's left? (Ordered By Priority)
- Setup tests to avoid unexpectedly causing things to stop functioning
- 
- Give Cyborg a more comfortable upgrade space
- Switch to V2 framework before V15
- Implement Learning automation (Once added will set the system to 1.0.0)
- update RenderChatMessage hook to RenderChatMessageHTML before v16
- Create different backgrounds for all user types
- Add custom images for default user and stand type actors
- Resolve gated by permissions
- Actor gate by permissions
- Make more User-Friendly
- Backup actors to compendium when transferring







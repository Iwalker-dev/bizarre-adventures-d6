# Changelog – BAD6 System

## [0.6.X] – 2025-06-27
### Added
- **Stat Radar Chart Integration**:
  - Implemented radar chart rendering for Stand stats using Chart.js (`chart.umd.js`).
  - Charts use actor-specific stats and auto-render on sheet open.
  - Color-coded with `--accent-light` and `--accent-dark` variables.
- **Interactive Star Stat Editor**:
  - Stat ranks now appear as clickable star icons.
  - Clicking updates the actor’s `system.attributes.stats.[stat].value`.
  - Infinite rank displays as ✶ with hover tooltip support.

### Global Theming
- Each actor sheet now dynamically sets:
  - `--accent-color`
  - `--accent-light`
  - `--accent-dark`
- These are used to theme the stat chart per sheet.
- Chart text and grid use bright white for dark theme readability.

### Optimization
- Refactored `renderStars()` and `renderStatChart()` into modular files under `/objects`.
- Simplified stat update flow by removing `statData` and updating actor data directly.
- Moved all color theming logic to sheet-level render hook.
- Default color fallback is now `#ffcc00` if CSS variables are missing.
- Removed large blocks of unnecessary code
- Simplified the look of hit and item renders

### Fixes
- Fixed Chart.js loading issue (MIME type error) by switching to local `chart.umd.js` file.
- Prevented invalid `rgb(..., -n, -n)` parsing by validating hex format before conversion.
- Removed accidental creation of keys like `learning-original`.
- Fixed global color overrides affecting all sheets when opening a new one.
- Fixed hit damage calculation

### 🔧 Misc
- Used `requestAnimationFrame()` to ensure chart renders after DOM paint.
# Factory expansion integration

This branch adds an isolated factory expansion module and its tests. It does not change the current 4-bay game, the economy, the order market, machine breakdowns, game.js, or index.html. The existing 4-bay hall remains the baseline. During integration, empty level 2 and level 3 hall artwork was added as SVG. No machines are part of either hall background.

## New files

- factory-expansion.js — browser global CNCModules.factoryExpansion and CommonJS export for tests.
- tests/factory-expansion.test.js — dependency-free Node tests.
- INTEGRATION-FACTORY-EXPANSION.md — this integration and asset brief.

Run tests with:

    node tests/factory-expansion.test.js

## State structure and migration

The module writes only this subobject:

    state.factoryExpansion = {
      level: 1,
      unlockedBays: 4
    };

init(state) is safe to call repeatedly. Older saves without factoryExpansion migrate to level 1 with four bays. If a partial expansion record has a valid level, that level is authoritative and unlockedBays is rebuilt as 4, 6, or 8. The early prototype shape containing only unlockedBays is also accepted.

The existing game's current save has at most four machine records, so this migration preserves all existing machines and their bay numbers. Machine occupancy uses the stable machine.bay value; an array index must never be used as a slot number.

## Module API

- init(state) normalizes or migrates the expansion state.
- getUnlockedBays(state) returns 4, 6, or 8.
- getExpansionCost(state) returns 40000 at level 1, 90000 at level 2, and null at level 3.
- canExpand(state) checks only whether the factory is below level 3; it deliberately does not check money.
- expand(state) changes the level and returns {success, newLevel, newBays, cost}. It does not debit money.
- getBayLayout(state) returns the currently unlocked slots.
- getLayoutConfig(state) also returns the hall asset name, aspect ratio and target dimensions.
- getFactoryLayouts() returns copies of all three layout definitions.
- getFreeBays(state) and getFirstFreeBay(state) calculate open slots using stable bay IDs.
- installMachine(state, machine) adds a machine to the first free unlocked slot without charging money.
- uninstallMachine(state, bay) removes only the machine in that slot and leaves every other bay unchanged.

The Economy integration should check canExpand(state), read getExpansionCost(state), verify state.money >= cost, then book the cost in the economy layer and call expand(state). The returned cost is the agreed expansion price for the transaction. Keep those steps in one game-level transaction so a failed balance check cannot unlock the hall.

Machine purchase should likewise check the machine's own price in the economy layer, then use installMachine(state, freshMachine); this assigns the first free bay from 1 through the current unlocked maximum. Selling should perform its resale transaction in the game/economy layer and call uninstallMachine(state, selectedBay). Do not compact or renumber state.machines.

## Layout data

Coordinates are percentages of the matching hall image canvas. x and y are the rectangle's top-left corner; width and height define both the clickable bay and the independent machine overlay region. The same source geometry can scale in desktop, phone portrait, and landscape as long as the image and overlays use one shared aspect-preserving container.

| Level | Bays | Hall asset | Canvas / aspect | Layout |
|---|---:|---|---|---|
| 1 | 4 | hall-empty-four-bays.webp | Existing square map, 1:1 | Existing positions retained |
| 2 | 6 | hall-level-2.svg | 1920 × 1200, 16:10 | 3 columns × 2 rows |
| 3 | 8 | hall-level-3.svg | 1920 × 1200, 16:10 | 4 columns × 2 rows |

The module stores every rectangle centrally. The 4-bay layout matches the current map: bays 1–2 occupy the upper row and bays 3–4 the lower row. The 6-bay plan uses rectangles (x, y, width, height) of (4,14,29,32), (35.5,14,29,32), (67,14,29,32), (4,54,29,32), (35.5,54,29,32), (67,54,29,32). The 8-bay plan uses four columns at x = 3, 27, 51, 75, each 22 wide; rows start at y = 14 and y = 54, each 33 high.

For portrait phones, fit the full background inside the available stage and scale overlays with it; do not use object-fit: cover, which crops away bays. The 16:10 plans use the same image aspect ratio at all device orientations. Keep each hit target at least 44 CSS pixels high when possible. Machine labels and running/waiting/fault status badges belong in the bay overlay, never in the hall artwork. Tapping a bay should select its stable bay ID and open the existing machine near view; use that same ID to locate the machine, label and status.

## Hall assets to create

hall-level-2.svg and hall-level-3.svg were created during integration as 1920 × 1200 SVG hall backgrounds (16:10). The backgrounds may include architecture, floor markings, walkways and fixed building details. They must not contain CNC machines, machine silhouettes, machine labels, machine status, purchase UI or any purchased-machine artwork. Machine images remain independent overlays rendered by the game per bay.

The level 2 artwork should provide three clearly separated bays in each of two rows. The level 3 artwork should provide four clearly separated bays in each of two rows. Keep clear foreground space inside every slot for machine sprite overlays and labels. The SVG backgrounds are committed together with the integration and are used for levels 2 and 3.

## UI and game integration points

This module is not loaded by the current page yet. When the feature is integrated:

1. Add <script src="factory-expansion.js"></script> in index.html before game.js.
2. In game.js, call CNCModules.factoryExpansion.init(state) after new-game defaults and save restoration; call it again after legacy save migration if that path replaces state.
3. Replace fixed 4 limits in machine validation, shop capacity, machine counts and bay listeners with getUnlockedBays(state). Preserve stable bay IDs during save, sale, selection and reload.
4. Create/update bay buttons from getBayLayout(state) and apply each definition's x, y, width, and height as percentage styles. Render purchased machines as separate image layers inside those buttons. Leave hall-empty-four-bays.webp untouched and use the configured level asset only after its empty image exists.
5. Add the later Halle erweitern card under Betrieb: current bay count, next bay count, expansion price, and a Halle erweitern button. At level 3 show 8 / 8 Plätze and Maximale Hallengröße erreicht. The button should use the Economy transaction described above.
6. Rebuild bay hit areas after a successful level change. On portrait and landscape screens, scale the image and all overlays together. Continue using the selected bay ID for the machine near view and status HUD.

The current 4-bay UI has hard-coded DOM elements and limits in game.js plus percentage positioning in index.html. Those exact sites are listed so a later integration can replace them in one focused pass without changing the order, breakdown or inventory/economy feature modules.


## Integration on integration/game-systems

The game now initializes the expansion state before validating saved machines so that bays 5–8 survive reload. The existing four-bay empty hall artwork remains in use at level 1. Levels 2 and 3 use the new machine-free SVG bases with the worker's 16:10 bay rectangles. The bay buttons and machine images are rendered separately; they share the aspect-preserving hall container at all orientations. Machine sales remove exactly one bay and purchases use the first free unlocked bay. Staff limits grow with unlocked capacity. Both upgrade prices are booked once through Economy before saving, with the expansion rolled back if booking fails. Older saves receive level 1 without changing their occupied bays. The existing standalone CNC artwork is placed in each occupied bay; the rendering and mobile legibility require the user's published-page visual check.

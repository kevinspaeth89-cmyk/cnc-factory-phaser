# Integration: Economy and Inventory

## Files

- `systems/economy.js` exposes `CNCModules.inventory` and `CNCModules.economy` in the browser. It also exports both APIs for Node tests.
- `tests/economy.test.js` covers inventory limits, finance summaries, and JSON save/reload behavior.
- `index.html` loads the module before `game.js`; existing gameplay and root-level money fields are not migrated yet.

## State shape

Call `CNCModules.economy.ensureState(state)` once after restoring or creating the game state. It initializes only `state.inventory` and `state.finance`.

```js
state.inventory = {
  rawMaterial: { steel: 0, stainless: 0, aluminium: 0 }, // kg
  finishedParts: [], // { id, quantity, meta }
  tools: { turningInsert: 0, millingInsert: 0 },
  capacities: { raw: 500, finished: 300, tools: 50 }
};

state.finance = {
  currentTime: null, // UTC Unix milliseconds; set by the game clock
  transactions: [] // { time, category, amount, text, meta }
};
```

Both objects contain ordinary JSON data and can be stored with the existing local-storage save. Inventory quantities and capacities cannot be negative. Material/tool additions and finished-part production fail atomically when capacity would be exceeded; removals fail without changing stock when there is not enough available.

## API

### Inventory

- `CNCModules.inventory.addMaterial(state, materialType, quantityKg)`
- `CNCModules.inventory.removeMaterial(state, materialType, quantityKg)`
- `CNCModules.inventory.addTool(state, toolType, quantity)`
- `CNCModules.inventory.consumeTool(state, toolType, quantity)`
- `CNCModules.inventory.addFinishedParts(state, partId, quantity, meta)`
- `CNCModules.inventory.removeFinishedParts(state, partId, quantity)`
- `CNCModules.inventory.getUsage(state)` returns usage, capacities, remaining room, and over-capacity flags.
- `CNCModules.inventory.expandCapacity(state, storageType, additionalCapacity, cost)` increases `raw`, `finished`, or `tools` capacity and returns the cost for the caller to book. It does not debit money or add a finance entry.

Mutation methods return `{ ok, code, ... }`. A failed addition or removal leaves the stock unchanged. New material and tool keys are accepted when they are safe identifier strings, so more kinds can be added later.

### Finance

- `CNCModules.economy.record(state, category, amount, description, meta)` appends one signed transaction. Income is positive and expenditure is negative. `tool` and `repair` are accepted aliases for `tools` and `repairs`.
- `CNCModules.economy.setTime(state, utcTimestamp)` sets the timestamp used by subsequent records and summary defaults.
- `CNCModules.economy.getDailySummary(state, at?)` and `getMonthlySummary(state, at?)` return category totals, profit, period bounds, and the matching transactions. Period boundaries use UTC; `at` is an optional `Date`, timestamp, or parseable date string.
- `CNCModules.economy.getProfit(state, from?, to?)` sums signed transactions in an inclusive time range. Omitted bounds include all transactions.
- `CNCModules.economy.getCategoryTotals(state, from?, to?)` returns totals for the standard categories plus any added category.

The standard categories are `income`, `material`, `wages`, `energy`, `tools`, `maintenance`, `repairs`, `storage`, `machine_purchase`, `machine_sale`, `factory_expansion`, and `other`.

Example repair booking:

```js
CNCModules.economy.record(
  state,
  'repairs',
  -850,
  'Reparatur Veltron VX-500',
  { bay: 2 }
);
```

The game should update `finance.currentTime` from its simulation clock so daily and monthly summaries follow game time. In the current `game.js`, simulation minutes start at 2026-01-05 06:00 UTC:

```js
const gameStart = Date.UTC(2026, 0, 5, 6);
CNCModules.economy.setTime(state, gameStart + state.gameMinutes * 60_000);
```

Run the clock update before calling `record`. If no game time is set, `record` uses the real UTC timestamp.

## Hooks needed in `game.js`

No gameplay or existing `state.money` flows have been switched in this branch. When integrating:

1. Include `inventory` and `finance` in `defaults()` or call `ensureState(state)` after the existing save restore/migration logic. Call it after `newGame()` replaces `state` too.
2. Keep saving the full state through the existing `JSON.stringify(state)` save function; the two new objects are JSON-compatible.
3. Update finance time from `gameMinutes` before recording time-based charges.
4. Add finished-part quantities when a machine completes its final operation. If a production step consumes raw stock, reserve/consume the matching `rawMaterial` key when accepting the order.
5. For future orders, add explicit fields such as `materialType: 'stainless'`, `materialAmountKg: 72`, `finishedPartId: 'shaft-A12'`, and `finishedQuantity: 50`. The current `material` display strings and `kg` field are not reliable canonical inventory keys/types.
6. Check the returned `ok` value before starting production. A full finished-parts store should pause or block completion until parts can be removed or capacity is expanded.

## Existing money movements to migrate later

The current `game.js` directly changes `state.money`. Each movement should eventually call `record` once, next to the existing balance change; keep the old balance logic until the finance UI and migration are ready.

| Current movement | Finance category | Current location |
| --- | --- | --- |
| Order payout, including late-order reduced payout | `income` | `tick()` when `m.progress >= 100` |
| Material purchase (€2,200 for 100 kg) | `material` | `buy-material` click handler |
| Tool change (€650) | `tools` | `change-tool` click handler |
| Maintenance (€1,200) | `maintenance` | `maintenance` click handler |
| Machine upgrade (`€9,000 × level`) | `machine_purchase` or `other` | `upgrade` click handler |
| Staff hire (€150) | `wages` or `other` | `hire-1` / `hire-2` click handlers |
| Machine purchase by catalog price | `machine_purchase` | `buyMachine()` |
| Machine resale proceeds | `machine_sale` as positive income | `sellMachine()` |
| Storage capacity upgrade (€4,000) | `storage` or `factory_expansion` | `storage-upgrade` click handler |
| Wages paid at month rollover | `wages` | `tick()` at month change |
| Storage carrying charge (€0.08/kg/game day) | `storage` | `tick()` each simulation slice |
| Electricity cost (€3.92 per active machine/game hour) | `energy` | `tick()` for each running machine |

For recurring charges, aggregate each game tick to a reasonable interval (for example, one transaction per game day or monthly payroll debit), rather than appending one transaction per rendered frame. Decide whether hiring/setup fees and machine upgrades need their own categories before building the finance screen; the standard list has no dedicated setup/upgrade category.

## Breakdown module hook

After the breakdown system resolves repair cost and the repair is paid, it can report the transaction through the shared API:

```js
CNCModules.economy.record(
  state,
  'repairs',
  -850,
  'Reparatur Veltron VX-500',
  { bay: 2, breakdownId: 'coolant-pressure' }
);
```

The breakdown system should not write a parallel finance list. Set current finance time from the game clock before recording, and debit `state.money` separately until the legacy balance is migrated.

## Checks

Run the module tests with `node --test tests/economy.test.js` from the repository root.

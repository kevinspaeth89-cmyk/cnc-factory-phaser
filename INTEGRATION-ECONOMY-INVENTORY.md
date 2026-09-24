# Economy and inventory integration

## Integrated state

`systems/economy.js` loads before `game.js` and exposes `CNCModules.inventory` and `CNCModules.economy` in the browser. Both APIs are also exported for Node tests.

The game calls `economy.ensureState(state)` after restoring a save and after starting a new game. It preserves the existing `state.money` balance and `cnc_factory_save_v3` save key. Old saves without `state.inventory` migrate their generic `state.material` quantity into `inventory.rawMaterial.legacy`; the material remains available to existing orders. `state.material` and `state.capacity` remain compatibility mirrors of total raw stock and raw capacity. Existing typed inventory is authoritative, so migration does not add the old mirror a second time.

The finance ledger starts empty for older saves because the previous game did not record transaction history. Loading a save does not change its cash balance. New purchases, payouts, wages, recurring charges, and machine transactions are recorded from the point of integration onward.

## Balance and finance hooks

Use `CNCModules.economy.book(state, category, signedAmount, description, meta?, aggregateKey?)` for a game transaction. It updates `state.money` and the finance ledger together. Income is positive; expenditure is negative. Do not also debit or credit `state.money` for a transaction already passed to `book`.

Existing movements are connected as follows:

| Movement | Category |
| --- | --- |
| Completed and late order payouts | `income` |
| Material purchases | `material` |
| Monthly payroll | `wages` |
| Electricity | `energy` |
| Tool changes | `tools` |
| Maintenance | `maintenance` |
| Machine purchases and sales | `machine_purchase`, `machine_sale` |
| Raw storage carrying charge and capacity upgrade | `storage` |
| One-time hiring fee and machine upgrades | `other` |

Storage and energy continue to affect cash at the existing simulation rate. Their ledger entries aggregate by in-game date to avoid creating a transaction for every simulation tick. Each transaction uses a stable aggregation key, so loading and continuing the same day updates that day's entry instead of duplicating it.

`economy.record(...)` remains available when another system has already changed the balance and only needs to report a transaction. Prefer `book(...)` when the economy layer owns the cash movement.

## Material compatibility

The legacy game has one generic raw-material quantity and order definitions do not contain a canonical material type. Those orders consume available stock atomically, using `legacy` stock first. Orders that provide `materialType` and `materialAmountKg` consume only that type and quantity. The `inventory` API also supports typed stock, tools, finished parts, and capacity limits.

The current production flow pays and delivers an order at completion, and tool condition is a wear percentage rather than a counted insert stock. Therefore, finished-part stock and tool quantities are initialized and saved but are not yet populated by gameplay. A later delivery flow should define how finished parts leave storage before adding a capacity block to production.

## State shape

```js
state.inventory = {
  rawMaterial: { steel: 0, stainless: 0, aluminium: 0 },
  finishedParts: [],
  tools: { turningInsert: 0, millingInsert: 0 },
  capacities: { raw: 300, finished: 300, tools: 50 }
};

state.finance = {
  currentTime: null,
  transactions: []
};
```

Inventory mutation methods return `{ ok, code, ... }`; a failed addition or removal leaves stock unchanged. Finance transactions and inventory state use ordinary JSON and are saved with the existing local-storage save.

The game simulation clock sets `finance.currentTime` from `START + state.gameMinutes * 60_000`. Daily and monthly summaries use UTC boundaries.

## API

### Inventory

- `CNCModules.inventory.addMaterial(state, materialType, quantityKg)`
- `CNCModules.inventory.removeMaterial(state, materialType, quantityKg)`
- `CNCModules.inventory.addTool(state, toolType, quantity)`
- `CNCModules.inventory.consumeTool(state, toolType, quantity)`
- `CNCModules.inventory.addFinishedParts(state, partId, quantity, meta)`
- `CNCModules.inventory.removeFinishedParts(state, partId, quantity)`
- `CNCModules.inventory.getUsage(state)`
- `CNCModules.inventory.expandCapacity(state, storageType, additionalCapacity, cost)`

### Finance

- `CNCModules.economy.ensureState(state)` initializes inventory and finance and migrates the legacy material mirror.
- `CNCModules.economy.book(state, category, signedAmount, description, meta?, aggregateKey?)` changes the balance and records the same transaction.
- `CNCModules.economy.record(state, category, signedAmount, description, meta?)` records without changing the balance.
- `CNCModules.economy.setTime(state, utcTimestamp)`
- `CNCModules.economy.getDailySummary(state, at?)`
- `CNCModules.economy.getMonthlySummary(state, at?)`
- `CNCModules.economy.getProfit(state, from?, to?)`
- `CNCModules.economy.getCategoryTotals(state, from?, to?)`

Standard categories include `income`, `material`, `wages`, `energy`, `tools`, `maintenance`, `repairs`, `storage`, `machine_purchase`, `machine_sale`, `factory_expansion`, and `other`. `tool` and `repair` are accepted aliases.

## Future breakdown hook

The breakdown module should use `economy.book` once for `repair`, `repair_scheduled`, or `major_failure` events, for example:

```js
CNCModules.economy.book(
  state,
  'repairs',
  -event.cost,
  `Reparatur ${machineName}`,
  { bay: event.bay, breakdownId: event.fault }
);
```

`repair_started` reports zero cost because scheduled repair cost was already booked. It must not create another balance change.

## Checks

Run the inventory and finance tests from the repository root:

```sh
node --test tests/economy.test.js
```

## Materialeinkauf nach dem LIVE-Feedback

Neue Spiele beginnen mit 0 kg Rohmaterial. Der Spieler kauft 25 oder 100 kg
einer bestimmten Sorte; alle Sorten teilen sich die ausbaubare Lagerkapazität.
Die Preise für 100 kg sind C45 € 1.800, 42CrMo4 € 2.500,
1.4301 € 3.400, 1.4404 € 4.000, EN AW-6082 € 2.700 und
EN-GJS-400 € 1.600. Kleinere Mengen kosten anteilig.
`systems/materials.js` ordnet dynamische und ältere gespeicherte Angebote
den Sorten zu. Nur die geforderte Sorte wird bei Auftragsannahme entnommen.

Spielstände mit bereits vorhandenem allgemeinem `legacy`-Material behalten
diesen Vorrat. Er kann für jede Sorte verwendet werden, wird dabei aber nur
als Restmenge nach passendem spezifischem Material verbraucht. Frühere
typisierte Sammelbestände (steel, stainless, aluminium, castiron) bleiben
ebenfalls für die jeweils passende Sorte verwendbar. So geht kein
vorhandener Lagerbestand beim Update verloren. Alle Einkäufe werden genau
einmal in `finance` gebucht und fehlgeschlagene Buchungen setzen den Zugang
zum Lager zurück. Die Modul- und Simulationsprüfungen decken Sorten,
Preise, Kapazität, Kosten, Reload und fehlende Bestände ab.

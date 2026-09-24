# Dynamic order market integration

## Integrated behavior

`systems/orderMarket.js` loads before `game.js`. The game initializes `state.orderMarket` after restoring a save or starting a new game, advances the market with absolute `state.gameMinutes`, and saves the market with the existing local-storage state. Old saves without market data receive six initial offers; saves with market data keep their offers, counters, follow-ups, and random state.

The former static list is retained only to resolve active static jobs already present in older saves. New offers come from the market module. Offers expire by simulation time and the market replenishes to at least four and at most eight visible offers. The UI shows customer profile, difficulty, material, quantity, price, deadline, and remaining validity.

An accepted order is removed from `state.orderMarket.available`. The game stores the complete accepted order object on the machine as `activeOrder`, alongside the stable `activeId` used by the existing production code. This lets a running order finish after a reload even though it no longer appears in the market. `activeOrderSource` distinguishes a market order from an older static job during completion migration.

Machine compatibility remains based on `order.kind` (`Drehen` or `Fräsen`). A market order cannot be accepted without a machine, and its required generic material is reserved from inventory immediately. Existing material purchases remain compatible with the legacy generic stock. If a future order provides `materialType` and `materialAmountKg`, the inventory adapter reserves only that stock type.

Completed market orders book their payout through `CNCModules.economy.book(state, 'income', ...)` and call `orderMarket.onCompleted` once. The market tracks completed IDs to avoid duplicate customer completion and follow-up scheduling. Existing static jobs loaded from old saves still finish and pay through the same finance hook, but do not create new market follow-ups.

## Save compatibility

The `cnc_factory_save_v3` key is unchanged. Market state, accepted order snapshots, production progress, finance entries, and inventory remain plain JSON. Legacy active jobs without `activeOrder` are rebuilt from the retained static-order definitions. An accepted market order saves its complete order record on its machine before the next autosave.

## Module API

- `CNCModules.orderMarket.init(state, options?)`
- `CNCModules.orderMarket.tick(state, absoluteGameMinutes)`
- `CNCModules.orderMarket.getAvailable(state)`
- `CNCModules.orderMarket.accept(state, orderId)`
- `CNCModules.orderMarket.onCompleted(state, order)`

`accept` returns a copy of the accepted order or `null` if it has expired or is no longer available. `tick` uses simulation minutes, not a delta. Follow-ups preserve the customer and operation kind, wait for their ready time, and are protected from duplicate completion calls.

## Automated checks

From the repository root:

```sh
node --test tests/orderMarket.test.js
node --test tests/economy.test.js
```

The tests cover market balance, offers expiring and replenishing, acceptance removal, follow-up scheduling, duplicate completion handling, save/reload of market progression, inventory capacity, legacy-material migration, finance summaries, and aggregated daily charges.

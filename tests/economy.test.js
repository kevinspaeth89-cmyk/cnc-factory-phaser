'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const CNCModules = require('../systems/economy.js');
const { inventory, economy } = CNCModules;

const makeState = () => ({ money: 1000, material: 120 });
const utc = (day, hour = 12) => Date.UTC(2026, 0, day, hour);

test('adds and removes material without allowing negative stock', () => {
  const state = makeState();
  assert.equal(inventory.addMaterial(state, 'steel', 120).ok, true);
  assert.equal(state.inventory.rawMaterial.steel, 120);
  assert.equal(inventory.removeMaterial(state, 'steel', 45).ok, true);
  assert.equal(state.inventory.rawMaterial.steel, 75);
  const failedRemoval = inventory.removeMaterial(state, 'steel', 76);
  assert.equal(failedRemoval.code, 'insufficient_stock');
  assert.equal(state.inventory.rawMaterial.steel, 75);
  assert.equal(inventory.addMaterial(state, 'steel', -1).code, 'invalid_amount');
  assert.ok(Object.values(state.inventory.rawMaterial).every(value => value >= 0));
});

test('enforces raw material capacity across material types and allows expansion', () => {
  const state = makeState();
  assert.equal(inventory.addMaterial(state, 'steel', 400).ok, true);
  assert.equal(inventory.addMaterial(state, 'stainless', 100).ok, true);
  const full = inventory.addMaterial(state, 'aluminium', 1);
  assert.equal(full.code, 'capacity_exceeded');
  assert.equal(full.available, 0);
  const expansion = inventory.expandCapacity(state, 'raw', 100, 2500);
  assert.equal(expansion.ok, true);
  assert.equal(expansion.capacity, 600);
  assert.equal(expansion.cost, 2500);
  assert.equal(inventory.addMaterial(state, 'aluminium', 50).ok, true);
});

test('returns a quote while expanding finished-parts and tool storage', () => {
  const state = makeState();
  const parts = inventory.expandCapacity(state, 'finishedParts', 25, 900);
  const tools = inventory.expandCapacity(state, 'tools', 10, 300);
  assert.equal(parts.capacity, 325);
  assert.equal(parts.cost, 900);
  assert.equal(tools.capacity, 60);
  assert.equal(tools.cost, 300);
  assert.equal(inventory.expandCapacity(state, '__proto__', 10, 0).code, 'invalid_storage');
});

test('tracks tool stock, capacity, and consumption separately from raw material', () => {
  const state = makeState();
  assert.equal(inventory.addTool(state, 'turningInsert', 12).ok, true);
  assert.equal(inventory.addTool(state, 'millingInsert', 8).ok, true);
  assert.equal(inventory.consumeTool(state, 'turningInsert', 3).ok, true);
  assert.equal(state.inventory.tools.turningInsert, 9);
  assert.equal(inventory.consumeTool(state, 'turningInsert', 10).code, 'insufficient_stock');
  assert.equal(inventory.getUsage(state).usage.tools, 17);
  assert.equal(inventory.addTool(state, 'drill', 34).code, 'capacity_exceeded');
});

test('stores finished parts up to capacity and removes completed deliveries safely', () => {
  const state = makeState();
  assert.equal(inventory.addFinishedParts(state, 'shaft-A12', 299, { orderId: 'A12' }).ok, true);
  assert.equal(inventory.addFinishedParts(state, 'shaft-A12', 2).code, 'capacity_exceeded');
  assert.equal(inventory.getUsage(state).usage.finished, 299);
  assert.equal(inventory.removeFinishedParts(state, 'shaft-A12', 30).ok, true);
  assert.equal(state.inventory.finishedParts[0].quantity, 269);
  assert.equal(inventory.removeFinishedParts(state, 'shaft-A12', 270).code, 'insufficient_stock');
  assert.ok(state.inventory.finishedParts.every(part => part.quantity >= 0));
});

test('records income and expenses with standard categories', () => {
  const state = makeState();
  economy.setTime(state, utc(5));
  const income = economy.record(state, 'income', 8400, 'Auftrag A12 abgeschlossen', { orderId: 'A12' });
  const expense = economy.record(state, 'tool', -650, 'Werkzeugwechsel Nexora NX-350', { bay: 2 });
  assert.equal(income.ok, true);
  assert.equal(expense.transaction.category, 'tools');
  assert.equal(state.finance.transactions.length, 2);
  assert.equal(state.finance.transactions[0].amount, 8400);
  assert.equal(state.finance.transactions[1].amount, -650);
  assert.equal(economy.record(state, 'repairs', 0, 'No-op').code, 'invalid_amount');
  assert.equal(economy.record(state, 'constructor', -1, 'Invalid category').code, 'invalid_category');
});

test('daily and monthly summaries aggregate by UTC calendar periods', () => {
  const state = makeState();
  economy.setTime(state, utc(5));
  economy.record(state, 'income', 8400, 'Auftrag');
  economy.setTime(state, utc(5, 13));
  economy.record(state, 'material', -1250, 'Material');
  economy.setTime(state, utc(5, 14));
  economy.record(state, 'wages', -420, 'Löhne');
  economy.setTime(state, utc(6));
  economy.record(state, 'energy', -112, 'Strom');

  const daily = economy.getDailySummary(state, utc(5));
  assert.equal(daily.transactionCount, 3);
  assert.equal(daily.categoryTotals.income, 8400);
  assert.equal(daily.categoryTotals.material, -1250);
  assert.equal(daily.categoryTotals.wages, -420);
  assert.equal(daily.profit, 6730);

  const monthly = economy.getMonthlySummary(state, utc(5));
  assert.equal(monthly.transactionCount, 4);
  assert.equal(monthly.categoryTotals.energy, -112);
  assert.equal(monthly.profit, 6618);
});

test('calculates range profit and category totals inclusively', () => {
  const state = makeState();
  economy.setTime(state, utc(5));
  economy.record(state, 'income', 8400, 'Auftrag');
  economy.setTime(state, utc(6));
  economy.record(state, 'material', -1250, 'Material');
  economy.setTime(state, utc(7));
  economy.record(state, 'repairs', -850, 'Reparatur');
  const from = Date.UTC(2026, 0, 5);
  const throughDaySix = Date.UTC(2026, 0, 7) - 1;
  assert.equal(economy.getProfit(state, from, throughDaySix), 7150);
  assert.equal(economy.getProfit(state), 6300);
  const totals = economy.getCategoryTotals(state, Date.UTC(2026, 0, 6), Date.UTC(2026, 0, 8) - 1);
  assert.equal(totals.material, -1250);
  assert.equal(totals.repairs, -850);
  assert.equal(totals.income, 0);
});

test('serializes and reloads state with its inventory and finance records intact', () => {
  const state = makeState();
  economy.setTime(state, 0);
  inventory.addMaterial(state, 'aluminium', 52.5);
  inventory.addTool(state, 'millingInsert', 4);
  inventory.addFinishedParts(state, 'plate-M14', 3, { source: 'order' });
  economy.record(state, 'income', 9800, 'Auftrag M14', { orderId: 'M14' });

  const reloaded = JSON.parse(JSON.stringify(state));
  assert.equal(economy.ensureState(reloaded).ok, true);
  assert.equal(reloaded.inventory.rawMaterial.aluminium, 52.5);
  assert.equal(reloaded.inventory.tools.millingInsert, 4);
  assert.equal(reloaded.inventory.finishedParts[0].quantity, 3);
  assert.equal(reloaded.finance.transactions[0].time, 0);
  assert.equal(reloaded.finance.transactions[0].meta.orderId, 'M14');
});

test('inventory operations do not modify legacy root-level money or material fields', () => {
  const state = makeState();
  inventory.addMaterial(state, 'steel', 2);
  inventory.addTool(state, 'turningInsert', 1);
  assert.equal(state.money, 1000);
  assert.equal(state.material, 120);
  assert.deepEqual(Object.keys(state).sort(), ['inventory', 'material', 'money']);
});

test('migrates an older generic material balance without losing its amount or capacity', () => {
  const oldSave = { money: 14000, material: 120, capacity: 300, machines: [] };
  const result = economy.ensureState(oldSave);
  assert.equal(result.ok, true);
  assert.equal(oldSave.inventory.rawMaterial.legacy, 120);
  assert.equal(oldSave.material, 120);
  assert.equal(oldSave.capacity, 300);
  assert.equal(oldSave.inventory.capacities.raw, 300);
  assert.deepEqual(oldSave.finance.transactions, []);

  const reloaded = JSON.parse(JSON.stringify(oldSave));
  economy.ensureState(reloaded);
  assert.equal(reloaded.inventory.rawMaterial.legacy, 120);
  assert.equal(reloaded.material, 120);
  assert.equal(reloaded.money, 14000);
});

test('uses existing typed inventory as the source instead of duplicating its legacy mirror', () => {
  const state = {
    money: 5000,
    material: 40,
    capacity: 200,
    inventory: { rawMaterial: { steel: 40 }, capacities: { raw: 200 } }
  };
  economy.ensureState(state);
  assert.equal(state.inventory.rawMaterial.steel, 40);
  assert.equal(state.inventory.rawMaterial.legacy, undefined);
  assert.equal(state.material, 40);
  assert.equal(state.inventory.capacities.raw, 200);
});

test('books balance changes once and aggregates frequent recurring charges', () => {
  const state = makeState();
  economy.ensureState(state);
  economy.setTime(state, utc(5));

  const purchase = economy.book(state, 'material', -2200, '100 kg Material', { quantityKg: 100 });
  assert.equal(purchase.ok, true);
  assert.equal(state.money, -1200);

  const key = 'daily:storage:2026-01-05';
  economy.book(state, 'storage', -0.002, 'Lagerkosten', {}, key);
  economy.book(state, 'storage', -0.002, 'Lagerkosten', {}, key);
  const reloaded = JSON.parse(JSON.stringify(state));
  economy.ensureState(reloaded);
  economy.setTime(reloaded, utc(5, 13));
  economy.book(reloaded, 'storage', -0.002, 'Lagerkosten', {}, key);
  assert.equal(reloaded.money, -1200.006);
  assert.equal(reloaded.finance.transactions.length, 2);
  assert.equal(reloaded.finance.transactions[1].amount, -0.006);
  assert.equal(reloaded.finance.transactions[1].meta.aggregateKey, key);

  const invalid = economy.book(reloaded, 'material', 0, 'No-op');
  assert.equal(invalid.code, 'invalid_amount');
  assert.equal(reloaded.money, -1200.006);
});

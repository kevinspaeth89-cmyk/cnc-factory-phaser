'use strict';

var assert = require('node:assert/strict');
var factoryExpansion = require('../factory-expansion.js');
assert.equal(globalThis.CNCModules.factoryExpansion, factoryExpansion);

function makeState() {
  return { machines: [] };
}

function testStartAndMigration() {
  var oldSave = { money: 14000, machines: [] };
  var expansion = factoryExpansion.init(oldSave);
  assert.deepEqual(expansion, { level: 1, unlockedBays: 4 });
  assert.equal(factoryExpansion.getUnlockedBays(oldSave), 4);
  assert.equal(factoryExpansion.getExpansionCost(oldSave), 40000);
  assert.equal(factoryExpansion.canExpand(oldSave), true);
  assert.deepEqual(factoryExpansion.getFreeBays(oldSave), [1, 2, 3, 4]);
}

function testLockedSlotsAndNoFinanceMutation() {
  var state = { money: 12345, machines: [] };
  for (var i = 0; i < 4; i += 1) {
    assert.equal(factoryExpansion.installMachine(state, { name: 'M' + i }).bay, i + 1);
  }
  assert.equal(factoryExpansion.installMachine(state, { name: 'M5' }).reason, 'no-free-bay');

  var expansion = factoryExpansion.expand(state);
  assert.equal(expansion.newBays, 6);
  assert.equal(state.money, 12345);
  assert.equal(factoryExpansion.installMachine(state, { name: 'M5' }).bay, 5);
}

function testExpansionTiersAndCosts() {
  var state = makeState();
  var first = factoryExpansion.expand(state);
  assert.deepEqual(first, { success: true, newLevel: 2, newBays: 6, cost: 40000 });
  assert.equal(factoryExpansion.getExpansionCost(state), 90000);
  assert.deepEqual(factoryExpansion.getFreeBays(state), [1, 2, 3, 4, 5, 6]);

  var second = factoryExpansion.expand(state);
  assert.deepEqual(second, { success: true, newLevel: 3, newBays: 8, cost: 90000 });
  assert.equal(factoryExpansion.getUnlockedBays(state), 8);
  assert.equal(factoryExpansion.getExpansionCost(state), null);
  assert.equal(factoryExpansion.canExpand(state), false);

  var atMaximum = factoryExpansion.expand(state);
  assert.deepEqual(atMaximum, {
    success: false,
    newLevel: 3,
    newBays: 8,
    cost: null,
    reason: 'max-level'
  });
}

function testStableHolesAndFirstFreePurchase() {
  var state = makeState();
  factoryExpansion.expand(state);
  factoryExpansion.installMachine(state, { type: 'turning', name: 'A' });
  factoryExpansion.installMachine(state, { type: 'turning', name: 'B' });
  factoryExpansion.installMachine(state, { type: 'turning', name: 'C' });
  assert.deepEqual(state.machines.map(function (machine) { return machine.bay; }), [1, 2, 3]);

  var removed = factoryExpansion.uninstallMachine(state, 2);
  assert.equal(removed.name, 'B');
  assert.deepEqual(state.machines.map(function (machine) { return machine.bay; }), [1, 3]);
  assert.deepEqual(factoryExpansion.getFreeBays(state), [2, 4, 5, 6]);

  var next = factoryExpansion.installMachine(state, { type: 'milling', name: 'D' });
  assert.equal(next.success, true);
  assert.equal(next.bay, 2);
  assert.deepEqual(state.machines.map(function (machine) { return machine.bay; }), [1, 3, 2]);
}

function testExampleOccupancyAndCapacity() {
  var state = { machines: [{ bay: 1 }, { bay: 3 }, { bay: 6 }] };
  factoryExpansion.expand(state);
  assert.deepEqual(factoryExpansion.getFreeBays(state), [2, 4, 5]);
  assert.equal(factoryExpansion.installMachine(state, { type: 'turning' }).bay, 2);

  factoryExpansion.expand(state);
  while (factoryExpansion.getFirstFreeBay(state) !== null) {
    var result = factoryExpansion.installMachine(state, { type: 'turning' });
    assert.equal(result.success, true);
  }
  assert.equal(state.machines.length, 8);
  assert.equal(factoryExpansion.getFirstFreeBay(state), null);
  assert.equal(factoryExpansion.installMachine(state, { type: 'turning' }).reason, 'no-free-bay');
}

function testReloadAndLayoutData() {
  var state = makeState();
  factoryExpansion.expand(state);
  factoryExpansion.installMachine(state, { type: 'turning', name: 'A' });
  factoryExpansion.installMachine(state, { type: 'turning', name: 'B' });
  factoryExpansion.installMachine(state, { type: 'turning', name: 'C' });
  factoryExpansion.uninstallMachine(state, 2);
  var reloaded = JSON.parse(JSON.stringify(state));
  factoryExpansion.init(reloaded);
  assert.deepEqual(reloaded.factoryExpansion, { level: 2, unlockedBays: 6 });
  assert.deepEqual(reloaded.machines.map(function (machine) { return machine.bay; }), [1, 3]);
  assert.deepEqual(factoryExpansion.getFreeBays(reloaded), [2, 4, 5, 6]);

  var layouts = factoryExpansion.getFactoryLayouts();
  assert.equal(layouts[1].bays.length, 4);
  assert.equal(layouts[2].bays.length, 6);
  assert.equal(layouts[3].bays.length, 8);
  assert.equal(layouts[2].targetDimensions.width, 1920);
  assert.equal(layouts[3].targetDimensions.height, 1200);
  Object.keys(layouts).forEach(function (level) {
    var bays = layouts[level].bays;
    assert.equal(new Set(bays.map(function (bay) { return bay.bay; })).size, bays.length);
    bays.forEach(function (bay) {
      assert.ok(bay.x >= 0 && bay.y >= 0);
      assert.ok(bay.width > 0 && bay.height > 0);
      assert.ok(bay.x + bay.width <= 100);
      assert.ok(bay.y + bay.height <= 100);
    });
  });
  layouts[2].bays[0].x = -100;
  assert.equal(factoryExpansion.getLayoutDefinition(2).bays[0].x, 4);
}

testStartAndMigration();
testLockedSlotsAndNoFinanceMutation();
testExpansionTiersAndCosts();
testStableHolesAndFirstFreePurchase();
testExampleOccupancyAndCapacity();
testReloadAndLayoutData();

console.log('factory-expansion: all tests passed');

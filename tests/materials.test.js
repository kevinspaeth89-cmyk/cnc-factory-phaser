'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const materials = require('../systems/materials.js');
const inventory = require('../systems/economy.js').inventory;
const economy = require('../systems/economy.js').economy;

function state(stock = {}) {
  const result = { money: 10000, material: 0, capacity: 300 };
  economy.ensureState(result);
  for (const [type, amount] of Object.entries(stock)) inventory.addMaterial(result, type, amount);
  return result;
}

test('old and new orders resolve to their precise raw material', () => {
  for (const [label, type] of [
    ['1.4301 Edelstahl', 'stainless14301'], ['1.4404 Edelstahl', 'stainless14404'],
    ['C45 Stahl', 'c45'], ['42CrMo4 Stahl', 'steel42crmo4'],
    ['EN AW-6082 Aluminium', 'aluminium6082'], ['EN-GJS-400', 'castiron400']
  ]) assert.equal(materials.typeForOrder({ material: label }), type);
  assert.equal(materials.typeForOrder({ materialType: 'c45', material: 'legacy title' }), 'c45');
  assert.equal(materials.typeForOrder({ material: 'unknown' }), null);
});

test('different material prices and amounts use the same typed warehouse capacity', () => {
  assert.equal(materials.quote('c45', 25), 450);
  assert.equal(materials.quote('steel42crmo4', 100), 2500);
  assert.equal(materials.quote('stainless14301', 100), 3400);
  assert.equal(materials.quote('stainless14404', 100), 4000);
  assert.equal(materials.quote('aluminium6082', 100), 2700);
  assert.equal(materials.quote('castiron400', 100), 1600);
  assert.equal(materials.quote('c45', -25), null);
});

test('material rates vary by type and game day, while saves get the same quote', () => {
  const day = 1440;
  const steel = materials.quote('c45', 100, day);
  const aluminium = materials.quote('aluminium6082', 100, day);
  assert.equal(materials.quote('c45', 100, day + 500), steel);
  assert.equal(materials.quote('c45', 100, day * 2), materials.quote('c45', 100, day * 2 + 50));
  assert.notEqual(steel, materials.quote('c45', 100, 0));
  assert.notEqual(steel / materials.catalog.c45.pricePer100Kg, aluminium / materials.catalog.aluminium6082.pricePer100Kg);
  for (const type of Object.keys(materials.catalog)) {
    const rate = materials.marketMultiplier(type, day);
    assert.ok(rate >= .8 && rate <= 1.2);
  }
});

test('a steel order cannot consume aluminium and a failed reservation never makes stock negative', () => {
  const saved = state({ aluminium6082: 100, steel42crmo4: 100, c45: 20 });
  const order = { material: 'C45 Stahl', kg: 25 };
  assert.equal(materials.available(saved, order), 20);
  assert.equal(materials.reserve(saved, inventory, order).code, 'insufficient_stock');
  assert.equal(saved.inventory.rawMaterial.c45, 20);
  assert.equal(saved.inventory.rawMaterial.steel42crmo4, 100);
  assert.equal(saved.inventory.rawMaterial.aluminium6082, 100);
});

test('older generic stock remains usable without converting other types', () => {
  const saved = state({ stainless14301: 15, legacy: 20, aluminium6082: 50 });
  const order = { material: '1.4301 Edelstahl', kg: 25 };
  const result = materials.reserve(saved, inventory, order);
  assert.equal(result.ok, true);
  assert.deepEqual(result.consumed, { stainless14301: 15, legacy: 10 });
  assert.equal(saved.inventory.rawMaterial.stainless14301, 0);
  assert.equal(saved.inventory.rawMaterial.legacy, 10);
  assert.equal(saved.inventory.rawMaterial.aluminium6082, 50);
  assert.equal(saved.money, 10000);
  assert.equal(materials.reserve(saved, inventory, { material: 'unknown', kg: 1 }).code, 'unknown_material');
});

test('older typed category stock is still available for matching saved orders', () => {
  const saved = state({ steel: 25 });
  const result = materials.reserve(saved, inventory, { material: '42CrMo4 Stahl', kg: 20 });
  assert.deepEqual(result.consumed, { steel: 20 });
  assert.equal(saved.inventory.rawMaterial.steel, 5);
});

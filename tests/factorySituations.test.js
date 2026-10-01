'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const factorySituations = require('../systems/factorySituations.js');

function stateWithSeed(seed, gameMinutes = 0) {
  const state = { gameMinutes };
  factorySituations.ensureState(state, { seed });
  return state;
}

test('special orders combine exactly two or three controlled mechanics for each customer profile', () => {
  const profiles = [
    { key: 'standard', customer: 'Veltraxis Mobility' },
    { key: 'premium', customer: 'Orionis Fluidics' },
    { key: 'series', customer: 'Kaeldor Components' },
    { key: 'express', customer: 'Asteron Robotics' }
  ];
  const result = profiles.map((profile, index) => {
    const state = stateWithSeed(`special-order-${index}`);
    const order = factorySituations.generateSpecialOrder(state, profile);
    assert.equal(order.specialOrder, true);
    assert.equal(order.customer, profile.customer);
    assert.ok(order.mechanics.length === 2 || order.mechanics.length === 3);
    assert.equal(new Set(order.mechanicIds).size, order.mechanics.length);
    assert.ok(order.mechanics.every(item => factorySituations.catalogs.specialties.some(entry => entry.id === item.id)));
    assert.equal(order.explanation.length, order.mechanics.length);
    assert.ok(order.qty > 0 && order.reward > 0 && order.duration > 0 && order.deadlineHours > 0);
    assert.match(order.id, /^FS-ORDER-\d{4}$/);
    return order;
  });
  assert.ok(result.find(order => order.customerProfile === 'express').qty <= 28);
  assert.ok(result.find(order => order.customerProfile === 'series').difficulty >= 5);
  assert.ok(result.find(order => order.customerProfile === 'premium').qty <= 42);
  assert.ok(result.find(order => order.customerProfile === 'standard').qty >= 36);
});

test('fixed seeds reproduce generated order mechanics and seed progression across reload', () => {
  const first = stateWithSeed('repeatable-specials');
  const second = stateWithSeed('repeatable-specials');
  const profile = { customer: 'Asteron Robotics', key: 'express' };
  assert.deepEqual(factorySituations.generateSpecialOrder(first, profile), factorySituations.generateSpecialOrder(second, profile));

  const restored = JSON.parse(JSON.stringify(first));
  factorySituations.ensureState(restored);
  assert.deepEqual(
    factorySituations.generateSpecialOrder(first, profile),
    factorySituations.generateSpecialOrder(restored, profile)
  );
  assert.doesNotThrow(() => JSON.stringify(restored));
});

test('generated special orders always have a usable base or complex route', () => {
  for (let seed = 1; seed <= 24; seed += 1) {
    const state = stateWithSeed(seed);
    const order = factorySituations.generateSpecialOrder(state, { key: 'standard', customer: 'Veltraxis Mobility' });
    assert.ok(order.routing.length >= 1 && order.routing.length <= 4, `seed ${seed} route length`);
    if (order.mechanicIds.includes('complex-route')) {
      assert.deepEqual(order.routing.map(step => step.type), ['turning', 'milling', 'quality']);
    } else {
      assert.equal(order.routing.length, 1);
      assert.equal(order.routing[0].type, order.kind === 'Drehen' ? 'turning' : 'milling');
      assert.equal(order.routing[0].requiredMachineKind, order.kind);
    }
  }
});

test('situation checks are rare by default and event chance is bounded', () => {
  const quiet = stateWithSeed('quiet-market');
  assert.equal(factorySituations.tick(quiet, 365 * 1440, { situationChancePerDay: 0 }).ok, true);
  assert.equal(quiet.factorySituations.scheduled.length, 0);
  assert.equal(quiet.factorySituations.active.length, 0);

  const forced = stateWithSeed(7);
  factorySituations.tick(forced, 1440, { situationChancePerDay: 10 });
  assert.equal(forced.factorySituations.scheduled.length, 1);
});

test('situation event catalog covers material, tooling, demand, and staff effects', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 80; seed += 1) {
    const state = stateWithSeed(seed);
    factorySituations.tick(state, 1440, { situationChancePerDay: 1 });
    const event = state.factorySituations.scheduled[0];
    if (event) seen.add(event.type);
  }
  assert.deepEqual([...seen].sort(), [
    'demand-boom', 'material-price-spike', 'staff-absence', 'tooling-shortage'
  ]);
  for (const event of factorySituations.catalogs.situations) {
    assert.ok(Object.values(event.effects).every(value => typeof value === 'string' || (Number.isFinite(value) && value >= 0.8 && value <= 1.2)));
  }
});

test('events have a visible preview, multi-day duration, exact start and end boundaries', () => {
  const state = stateWithSeed(7);
  factorySituations.tick(state, 1440, { situationChancePerDay: 0.1, previewLeadMinutes: 360, minimumDurationDays: 4, maximumDurationDays: 4 });
  const event = state.factorySituations.scheduled[0];
  assert.ok(event);
  assert.equal(event.startAtMinute, 1800);
  assert.equal(event.endAtMinute - event.startAtMinute, 4 * 1440);
  assert.equal(factorySituations.getActiveModifiers(state, event.startAtMinute - 1).length, 0);
  assert.equal(factorySituations.getSnapshot(state, event.startAtMinute - 1).scheduled[0].preview, true);

  factorySituations.tick(state, event.startAtMinute);
  assert.equal(state.factorySituations.active[0].id, event.id);
  assert.equal(factorySituations.getActiveModifiers(state, event.startAtMinute).length, 1);
  assert.equal(factorySituations.getSnapshot(state, event.startAtMinute).active[0].remainingMinutes, 4 * 1440);
  assert.equal(factorySituations.getActiveModifiers(state, event.endAtMinute - 1).length, 1);
  factorySituations.tick(state, event.endAtMinute);
  assert.equal(factorySituations.getActiveModifiers(state, event.endAtMinute).length, 0);
  assert.equal(state.factorySituations.active.length, 0);
  assert.equal(state.factorySituations.history.at(-1).status, 'ended');
});

test('repeated ticks and save reload do not duplicate or replay event transitions', () => {
  const state = stateWithSeed(7);
  factorySituations.tick(state, 1440, { situationChancePerDay: 0.1 });
  const start = state.factorySituations.scheduled[0].startAtMinute;
  factorySituations.tick(state, start);
  const savedAtStart = JSON.stringify(state.factorySituations);
  factorySituations.tick(state, start);
  assert.equal(JSON.stringify(state.factorySituations), savedAtStart);

  const restored = JSON.parse(JSON.stringify(state));
  factorySituations.ensureState(restored);
  const saved = JSON.stringify(restored.factorySituations);
  factorySituations.tick(restored, start);
  assert.equal(JSON.stringify(restored.factorySituations), saved);
  const event = restored.factorySituations.active[0];
  factorySituations.tick(restored, event.endAtMinute);
  assert.equal(restored.factorySituations.history.filter(item => item.id === event.id).length, 1);
});

test('applyModifiers copies the full order, preserves unknown fields, bounds effects, and ignores unknown modifiers', () => {
  const order = { id: 'order-1', customField: { keep: true }, reward: 1234, situationEffects: { old: true } };
  const before = JSON.stringify(order);
  const result = factorySituations.applyModifiers(order, [
    { id: 'spike', type: 'material-price-spike', effects: { materialCostFactor: 9, warning: 'price' } },
    { id: 'unknown', type: 'future-feature', effects: { materialCostFactor: 0.1 } },
    { id: 'tools', type: 'tooling-shortage', effects: { durationFactor: 1.12, capacityFactor: 0.88, warning: 'tools' } }
  ]);
  assert.notEqual(result, order);
  assert.equal(JSON.stringify(order), before);
  assert.deepEqual(result.customField, { keep: true });
  assert.equal(result.reward, 1234);
  assert.deepEqual(result.activeSituationModifierIds, ['spike', 'tools']);
  assert.equal(result.situationEffects.materialCostFactor, 1.25);
  assert.equal(result.situationEffects.durationFactor, 1.12);
  assert.deepEqual(result.situationEffects.warnings, ['price', 'tools']);

  const ignored = factorySituations.applyModifiers(order, [{ type: 'not-known', effects: { durationFactor: 1.2 } }]);
  assert.equal(ignored.situationEffects.durationFactor, 1);
  assert.deepEqual(ignored.activeSituationModifierIds, []);
  assert.deepEqual(factorySituations.applyModifiers(null, []), { ok: false, code: 'INVALID_ORDER' });
});

test('invalid or backwards ticks fail without advancing state', () => {
  const state = stateWithSeed('invalid-tick');
  const before = JSON.stringify(state.factorySituations);
  assert.deepEqual(factorySituations.tick(state, -1), { ok: false, code: 'INVALID_GAME_MINUTE' });
  assert.equal(JSON.stringify(state.factorySituations), before);
  factorySituations.tick(state, 10);
  assert.deepEqual(factorySituations.tick(state, 9), { ok: false, code: 'TIME_REVERSED' });
  assert.notEqual(JSON.stringify(state.factorySituations), before);
});

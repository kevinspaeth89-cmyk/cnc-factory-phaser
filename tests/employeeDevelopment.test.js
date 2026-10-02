'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const development = require('../systems/employeeDevelopment.js');

test('ensureState creates a versioned top-level state and is idempotent', () => {
  const state = { money: 123, employeeDevelopment: { version: 0, custom: 'kept' } };
  assert.equal(development.ensureState(state).ok, true);
  assert.equal(development.ensureState(state).ok, true);
  assert.deepEqual(state.employeeDevelopment, { version: 1, custom: 'kept' });
  assert.equal(state.money, 123);
});

test('personality constrains choices and legacy skills still derive a personality', () => {
  const careful = { personality: ['gruendlich'], skills: { turning: 5, milling: 5, precision: 9, learning: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(careful, { xp: 240 }), ['precision']);
  const adaptable = { personality: ['anpassungsfaehig'], skills: { turning: 5, milling: 5, precision: 5, learning: 6 } };
  assert.deepEqual(development.getAvailableSpecializations(adaptable, { xp: 240 }), ['turning', 'milling', 'learning']);
});

test('first and second unlocks are separated and no employee receives more than two', () => {
  const employee = { personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee, { xp: 239 }), []);
  assert.equal(development.assignSpecialization(employee, 'turning', { xp: 239 }).code, 'progression_locked');
  assert.equal(development.assignSpecialization(employee, 'turning', { xp: 240 }).ok, true);
  assert.equal(development.assignSpecialization(employee, 'turning', { xp: 1920 }).code, 'already_assigned');
  assert.deepEqual(development.getAvailableSpecializations(employee, { xp: 1919 }), []);
  assert.equal(development.assignSpecialization(employee, 'milling', { xp: 1920 }).ok, true);
  assert.equal(development.assignSpecialization(employee, 'precision', { xp: 10000 }).code, 'specialization_limit');
  assert.deepEqual(employee.specializations, ['turning', 'milling']);
});

test('effects are bounded, route-aware, and leave a useful general benefit', () => {
  const employee = { specializations: ['turning', 'precision'] };
  const turning = development.getEffects(employee, { kind: 'Drehen' });
  assert.equal(turning.turningSpeed, 0.12);
  assert.equal(turning.qualityRisk, -0.12);
  assert.equal(turning.generalSpeed, 0.05);
  assert.deepEqual(turning.applied, ['turning', 'precision']);
  const milling = development.getEffects(employee, { kind: 'Fräsen' });
  assert.equal(milling.turningSpeed, 0);
  assert.equal(milling.qualityRisk, -0.12);
  assert.ok(milling.generalSpeed > 0);
});

test('invalid state and employee inputs return structured errors or empty results', () => {
  assert.deepEqual(development.ensureState(null), { ok: false, code: 'invalid_state' });
  assert.deepEqual(development.getAvailableSpecializations(null, 1000), []);
  assert.equal(development.assignSpecialization(null, 'turning', 1000).code, 'invalid_employee');
  assert.equal(development.assignSpecialization({ skills: {} }, 'unknown', 1000).code, 'unknown_specialization');
});

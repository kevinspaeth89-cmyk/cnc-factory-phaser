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

test('new hires start without a specialization choice', () => {
  const employee = { xp: 0, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.getProgress(employee).careerLevel, 1);
  assert.equal(development.getProgress(employee).pendingChoices, 0);
  assert.equal(development.assignSpecialization(employee, 'turning').code, 'progression_locked');
});

test('personality constrains level-up choices and legacy skills still derive a personality', () => {
  const careful = { xp: development.FIRST_UNLOCK_XP, personality: ['gruendlich'], skills: { turning: 5, milling: 5, precision: 9, learning: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(careful), ['precision']);
  const adaptable = { xp: development.FIRST_UNLOCK_XP, personality: ['anpassungsfaehig'], skills: { turning: 5, milling: 5, precision: 5, learning: 6 } };
  assert.deepEqual(development.getAvailableSpecializations(adaptable), ['turning', 'milling', 'learning']);
});

test('experience level-ups are earned at separate long-term milestones and each choice is consumed once', () => {
  const employee = { xp: development.FIRST_UNLOCK_XP - 1, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.assignSpecialization(employee, 'turning').code, 'progression_locked');
  employee.xp = development.FIRST_UNLOCK_XP;
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
  assert.equal(development.assignSpecialization(employee, 'turning').ok, true);
  assert.equal(development.getProgress(employee).pendingChoices, 0);
  employee.xp = development.SECOND_UNLOCK_XP - 1;
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.assignSpecialization(employee, 'milling').code, 'progression_locked');
  employee.xp = development.SECOND_UNLOCK_XP;
  assert.deepEqual(development.getAvailableSpecializations(employee), ['milling']);
  assert.equal(development.assignSpecialization(employee, 'milling').ok, true);
  assert.equal(development.assignSpecialization(employee, 'precision').code, 'specialization_limit');
  assert.deepEqual(employee.specializations, ['turning', 'milling']);
  assert.equal(development.getProgress(employee).careerLevel, 3);
});

test('a notable successful repair can grant one additional level-up after substantial work', () => {
  const employee = { xp: development.SPECIAL_EVENT_XP - 1, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.awardSpecialEvent(employee, 'successful_self_repair').code, 'experience_locked');
  employee.xp = development.SPECIAL_EVENT_XP;
  const award = development.awardSpecialEvent(employee, 'successful_self_repair');
  assert.equal(award.ok, true);
  assert.equal(award.careerLevel, 2);
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
  assert.equal(development.assignSpecialization(employee, 'turning').ok, true);
  assert.equal(development.awardSpecialEvent(employee, 'successful_self_repair').code, 'event_already_awarded');
  assert.equal(development.getProgress(employee).pendingChoices, 0);
});

test('a special event does not stack on top of an unspent level-up choice', () => {
  const employee = { xp: development.FIRST_UNLOCK_XP, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.awardSpecialEvent(employee, 'successful_self_repair').code, 'level_up_pending');
  assert.equal(employee.development.specialEventRewardClaimed, false);
  assert.equal(development.getProgress(employee).pendingChoices, 1);
});

test('legacy assigned specializations are preserved and migrated idempotently', () => {
  const employee = { xp: development.SECOND_UNLOCK_XP, specializations: ['turning'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.ensureEmployee(employee).ok, true);
  assert.equal(development.getProgress(employee).pendingChoices, 1);
  assert.deepEqual(employee.specializations, ['turning']);
  const saved = JSON.stringify(employee);
  development.getProgress(employee);
  assert.equal(JSON.stringify(employee), saved);
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
  assert.equal(development.awardSpecialEvent(null, 'successful_self_repair').code, 'invalid_employee');
  assert.equal(development.awardSpecialEvent({ skills: {} }, 'unknown').code, 'unknown_event');
});

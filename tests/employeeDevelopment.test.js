'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const development = require('../systems/employeeDevelopment.js');
const recruitment = require('../systems/recruitment.js');

test('ensureState creates a versioned top-level state and is idempotent', () => {
  const state = { money: 123, employeeDevelopment: { version: 0, custom: 'kept' } };
  assert.equal(development.ensureState(state).ok, true);
  assert.equal(development.ensureState(state).ok, true);
  assert.deepEqual(state.employeeDevelopment, { version: 1, custom: 'kept' });
  assert.equal(state.money, 123);
});

test('new hires start without a specialization choice', () => {
  const employee = { xp: 0, productionMinutes: 0, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.getProgress(employee).careerLevel, 1);
  assert.equal(development.getProgress(employee).pendingChoices, 0);
  assert.equal(development.assignSpecialization(employee, 'turning').code, 'progression_locked');
});

test('personality constrains earned choices and legacy skills still derive a personality', () => {
  const careful = { productionMinutes: development.FIRST_UNLOCK_MINUTES, personality: ['gruendlich'], skills: { turning: 5, milling: 5, precision: 9, learning: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(careful), ['precision']);
  const adaptable = { productionMinutes: development.FIRST_UNLOCK_MINUTES, personality: ['anpassungsfaehig'], skills: { turning: 5, milling: 5, precision: 5, learning: 6 } };
  assert.deepEqual(development.getAvailableSpecializations(adaptable), ['turning', 'milling', 'learning']);
});

test('milestones use staffed production minutes, not learning-boosted XP', () => {
  const employee = { xp: 8500, productionMinutes: development.FIRST_UNLOCK_MINUTES - 1, development: { version: development.EMPLOYEE_VERSION }, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  employee.productionMinutes = development.FIRST_UNLOCK_MINUTES;
  employee.xp += 1.2;
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
});

test('experience level-ups are earned at separate work milestones and each choice is consumed once', () => {
  const employee = { xp: 0, productionMinutes: development.FIRST_UNLOCK_MINUTES - 1, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.assignSpecialization(employee, 'turning').code, 'progression_locked');
  employee.productionMinutes = development.FIRST_UNLOCK_MINUTES;
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
  assert.equal(development.assignSpecialization(employee, 'turning').ok, true);
  assert.equal(development.getProgress(employee).pendingChoices, 0);
  employee.productionMinutes = development.SECOND_UNLOCK_MINUTES - 1;
  assert.deepEqual(development.getAvailableSpecializations(employee), []);
  assert.equal(development.assignSpecialization(employee, 'milling').code, 'progression_locked');
  employee.productionMinutes = development.SECOND_UNLOCK_MINUTES;
  assert.deepEqual(development.getAvailableSpecializations(employee), ['milling']);
  assert.equal(development.assignSpecialization(employee, 'milling').ok, true);
  assert.equal(development.assignSpecialization(employee, 'precision').code, 'specialization_limit');
  assert.deepEqual(employee.specializations, ['turning', 'milling']);
  assert.equal(development.getProgress(employee).careerLevel, 3);
});

test('a notable successful repair can grant one additional level-up after substantial staffed work', () => {
  const employee = { xp: 10000, productionMinutes: development.SPECIAL_EVENT_MINUTES - 1, personality: ['flexibel'], skills: { turning: 5, milling: 5 }, development: { version: 2 } };
  assert.equal(development.awardSpecialEvent(employee, 'successful_self_repair').code, 'experience_locked');
  employee.productionMinutes = development.SPECIAL_EVENT_MINUTES;
  const award = development.awardSpecialEvent(employee, 'successful_self_repair');
  assert.equal(award.ok, true);
  assert.equal(award.careerLevel, 2);
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
  const normalized = recruitment.normalizeEmployee(JSON.parse(JSON.stringify(employee)), 12);
  assert.equal(normalized.development.specialEventRewardClaimed, true);
  assert.equal(normalized.development.pendingSpecializationChoices, 1);
  assert.equal(development.awardSpecialEvent(normalized, 'successful_self_repair').code, 'event_already_awarded');
  assert.equal(development.assignSpecialization(normalized, 'turning').ok, true);
  assert.equal(development.getProgress(normalized).pendingChoices, 0);
});

test('a special event does not stack on top of an unspent level-up choice', () => {
  const employee = { productionMinutes: development.FIRST_UNLOCK_MINUTES, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.awardSpecialEvent(employee, 'successful_self_repair').code, 'level_up_pending');
  assert.equal(employee.development.specialEventRewardClaimed, false);
  assert.equal(development.getProgress(employee).pendingChoices, 1);
});

test('legacy earned but unspent choices migrate from the old 240/1920 XP thresholds', () => {
  const employee = { xp: 1920, productionMinutes: 1920, specializations: [], personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.getProgress(employee).pendingChoices, 2);
  assert.deepEqual(development.getAvailableSpecializations(employee), ['turning', 'milling']);
  const saved = JSON.stringify(employee);
  development.getProgress(employee);
  assert.equal(JSON.stringify(employee), saved);
  const oneAssigned = { xp: 1920, productionMinutes: 1920, specializations: ['turning'], personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.getProgress(oneAssigned).pendingChoices, 1);
  const belowSecond = { xp: 1919, productionMinutes: 1919, specializations: ['turning'], personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.getProgress(belowSecond).pendingChoices, 0);
  const firstOnly = { xp: 240, productionMinutes: 240, personality: ['flexibel'], skills: { turning: 5, milling: 5 } };
  assert.equal(development.getProgress(firstOnly).pendingChoices, 1);
});

test('legacy assigned specializations and progression migration survive JSON reload', () => {
  const employee = { xp: 10000, productionMinutes: 7300, specializations: ['turning'], skills: { turning: 5, milling: 5 }, development: { version: 1, experienceMilestonesAwarded: 1, pendingSpecializationChoices: 0 } };
  development.getProgress(employee);
  const saved = JSON.parse(JSON.stringify(employee));
  const progress = development.getProgress(saved);
  assert.deepEqual(saved.specializations, ['turning']);
  assert.equal(progress.pendingChoices, 0);
  assert.equal(progress.experienceMilestonesAwarded, 1);
  assert.equal(saved.development.version, development.EMPLOYEE_VERSION);
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

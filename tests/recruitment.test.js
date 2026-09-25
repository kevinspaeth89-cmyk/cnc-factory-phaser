'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recruitment = require('../systems/recruitment.js');

test('creates persistent fantasy applicant profiles with bounded, useful skills', () => {
  const first = [1, 2, 3, 4, 5].map(id => recruitment.generateApplicant(id));
  const second = [1, 2, 3, 4, 5].map(id => recruitment.generateApplicant(id));
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map(candidate => candidate.name)).size, first.length);
  for (const candidate of first) {
    assert.match(candidate.name, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
    assert.ok(['Drehtechnik', 'Frästechnik', 'Allround'].includes(candidate.specialty));
    assert.deepEqual(Object.keys(candidate.skills).sort(), ['learning', 'milling', 'precision', 'turning']);
    assert.ok(Object.values(candidate.skills).every(value => value >= 1 && value <= 5));
  }
  assert.ok(first.some(candidate => candidate.specialty === 'Drehtechnik'));
  assert.ok(first.some(candidate => candidate.specialty === 'Frästechnik'));
});

test('fills missing recruitment data for old saves and preserves offers after reload', () => {
  const oldSave = { money: 4000, staff: { shift1: 1, shift2: 0 } };
  assert.equal(recruitment.ensureState(oldSave).ok, true);
  assert.equal(oldSave.recruitment.applicants.length, recruitment.APPLICANT_COUNT);
  const offers = JSON.parse(JSON.stringify(oldSave.recruitment));
  const reloaded = { ...oldSave, recruitment: offers };
  recruitment.ensureState(reloaded);
  assert.deepEqual(reloaded.recruitment, offers);
});

test('hiring one applicant refills one stable offer without duplicating ids', () => {
  const state = {};
  recruitment.ensureState(state);
  const hiredId = state.recruitment.applicants[1].id;
  const otherIds = state.recruitment.applicants.filter(candidate => candidate.id !== hiredId).map(candidate => candidate.id);
  const employeeData = recruitment.takeApplicant(state, hiredId);
  assert.equal(employeeData.id, hiredId);
  assert.equal(state.recruitment.applicants.length, recruitment.APPLICANT_COUNT);
  assert.equal(state.recruitment.applicants.some(candidate => candidate.id === hiredId), false);
  assert.equal(new Set(state.recruitment.applicants.map(candidate => candidate.id)).size, recruitment.APPLICANT_COUNT);
  assert.ok(otherIds.every(id => state.recruitment.applicants.some(candidate => candidate.id === id)));
  assert.equal(recruitment.takeApplicant(state, hiredId), null);
});

test('candidate skills affect the matching machine, learning speed, and tool wear', () => {
  const novice = { profileVersion: 1, skills: { turning: 1, milling: 1, precision: 1, learning: 1 } };
  const expert = { profileVersion: 1, skills: { turning: 5, milling: 3, precision: 5, learning: 5 } };
  assert.equal(recruitment.productionMultiplier(novice, 'Drehen'), 1);
  assert.equal(recruitment.productionMultiplier(expert, 'Drehen'), 1.1);
  assert.equal(recruitment.productionMultiplier(expert, 'Fräsen'), 1.05);
  assert.ok(Math.abs(recruitment.learningMultiplier(expert) - 1.2) < 1e-12);
  assert.equal(recruitment.toolWearMultiplier(expert), 0.9);
  assert.equal(recruitment.productionMultiplier({ profileVersion: 0 }, 'Drehen'), 1);
  assert.equal(recruitment.learningMultiplier({ profileVersion: 0 }), 1);
  assert.equal(recruitment.toolWearMultiplier({ profileVersion: 0 }), 1);
});

test('normalizes old anonymous staff without changing their existing progression', () => {
  const migrated = recruitment.normalizeEmployee({ id: 7, xp: 950, trained: 2, assignedBay: 3 }, 7);
  assert.equal(migrated.profileVersion, 0);
  assert.equal(migrated.name, recruitment.legacyProfile(7).name);
  assert.equal(migrated.xp, 950);
  assert.equal(migrated.trained, 2);
  assert.equal(migrated.assignedBay, 3);
  assert.deepEqual(migrated.skills, { turning: 0, milling: 0, precision: 0, learning: 0 });
});

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
    assert.ok(Object.values(candidate.skills).every(value => value >= 1 && value <= 10));
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
  const novice = { profileVersion: 2, skills: { turning: 1, milling: 1, precision: 1, learning: 1 } };
  const expert = { profileVersion: 2, skills: { turning: 10, milling: 5, precision: 10, learning: 10 } };
  assert.equal(recruitment.productionMultiplier(novice, 'Drehen'), 1);
  assert.equal(recruitment.productionMultiplier(expert, 'Drehen'), 1.1);
  assert.ok(Math.abs(recruitment.productionMultiplier(expert, 'Fräsen') - 1.0444444444444445) < 1e-12);
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


test('profile ratings use all four skills and portraits remain stable per employee id', () => {
  assert.equal(recruitment.ratingFromSkills({ turning: 1, milling: 1, precision: 1, learning: 1 }), 1);
  assert.equal(recruitment.ratingFromSkills({ turning: 10, milling: 10, precision: 10, learning: 10 }), 10);
  assert.notEqual(recruitment.portraitFor(1), recruitment.portraitFor(2));
  assert.equal(recruitment.portraitFor(1), recruitment.portraitFor(9));
});

test('generated applicants and legacy identities use matching portrait groups', () => {
  const femalePortraits = new Set([4, 5, 6, 7]);
  const malePortraits = new Set([1, 2, 3, 8]);
  for (let id = 1; id <= 100; id += 1) {
    const candidate = recruitment.generateApplicant(id);
    const portraitId = Number(candidate.portrait.match(/employee-portrait-(\d+)/)[1]);
    assert.equal(candidate.gender, recruitment.genderForName(candidate.name));
    assert.ok(candidate.gender === 'female' ? femalePortraits.has(portraitId) : malePortraits.has(portraitId));
  }
  assert.equal(recruitment.legacyProfile(1).gender, 'female');
  assert.equal(recruitment.legacyProfile(2).gender, 'male');
  assert.ok(femalePortraits.has(Number(recruitment.legacyProfile(1).portrait.match(/employee-portrait-(\d+)/)[1])));
  assert.ok(malePortraits.has(Number(recruitment.legacyProfile(2).portrait.match(/employee-portrait-(\d+)/)[1])));
});

test('corrects a saved applicant portrait from the name when an old save mismatches', () => {
  const state = { recruitment: { nextId: 2, applicants: [{
    id: 1, name: 'Tarek Stahlwind', gender: 'female', portrait: recruitment.portraitFor(1, 'female'), skillScale: 2,
    skills: { turning: 5, milling: 5, precision: 5, learning: 5 }
  }] } };
  recruitment.ensureState(state);
  assert.equal(state.recruitment.applicants[0].gender, 'male');
  assert.equal(state.recruitment.applicants[0].portrait, recruitment.portraitFor(1, 'male'));
  const employee = recruitment.normalizeEmployee({
    id: 1, profileVersion: 2, name: 'Tarek Stahlwind', gender: 'female',
    portrait: recruitment.portraitFor(1, 'female'),
    skills: { turning: 5, milling: 5, precision: 5, learning: 5 }
  }, 1);
  assert.equal(employee.gender, 'male');
  assert.equal(employee.portrait, recruitment.portraitFor(1, 'male'));
});

test('migrates saved five-point applicant and employee skills to the ten-point scale', () => {
  const state = { recruitment: { nextId: 2, applicants: [{
    id: 1, name: 'Mira Stahlwind', skills: { turning: 1, milling: 2, precision: 4, learning: 5 }
  }] } };
  recruitment.ensureState(state);
  assert.deepEqual(state.recruitment.applicants[0].skills, { turning: 1, milling: 3, precision: 8, learning: 10 });
  assert.equal(state.recruitment.applicants[0].skillScale, 2);
  const employee = recruitment.normalizeEmployee({
    id: 1, profileVersion: 1, name: 'Mira Stahlwind', skills: { turning: 1, milling: 2, precision: 4, learning: 5 }
  }, 1);
  assert.equal(employee.profileVersion, 2);
  assert.deepEqual(employee.skills, { turning: 1, milling: 3, precision: 8, learning: 10 });
});

test('profile descriptions identify the strongest skill and match its stored value', () => {
  for (const id of [1, 2, 3, 4, 5]) {
    const candidate = recruitment.generateApplicant(id);
    const strongest = Math.max(...Object.values(candidate.skills));
    assert.equal(candidate.rating, recruitment.ratingFromSkills(candidate.skills));
    assert.match(candidate.about, new RegExp('\\(' + strongest + '/10\\)'));
    assert.match(candidate.about, /Stärkster Wert:/);
    assert.match(candidate.portrait, /employee-portrait-\d{2}\.webp/);
  }
});

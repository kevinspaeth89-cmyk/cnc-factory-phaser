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

test('derives two coherent personality traits from existing employee skills', () => {
  const carefulLearner = recruitment.derivePersonality({
    turning: 8, milling: 4, precision: 9, learning: 9
  });
  assert.deepEqual(carefulLearner.map(trait => trait.id), ['gruendlich', 'neugierig']);

  const pragmaticRoutineWorker = recruitment.derivePersonality({
    turning: 7, milling: 3, precision: 2, learning: 2
  });
  assert.deepEqual(pragmaticRoutineWorker.map(trait => trait.id), ['pragmatisch', 'routineorientiert']);

  const balancedAllrounder = recruitment.derivePersonality({
    turning: 7, milling: 6, precision: 6, learning: 4
  });
  assert.deepEqual(balancedAllrounder.map(trait => trait.id), ['bedacht', 'flexibel']);

  for (const trait of balancedAllrounder) {
    assert.equal(typeof trait.label, 'string');
    assert.equal(typeof trait.icon, 'string');
    assert.equal(typeof trait.about, 'string');
  }
});

test('generated applicants expose personality without changing legacy specialty traits', () => {
  const candidate = recruitment.generateApplicant(1);
  assert.equal(candidate.personality.length, 2);
  assert.ok(candidate.trait);
  assert.ok(candidate.specialty);
  const employee = recruitment.createEmployee(candidate, 99);
  assert.deepEqual(employee.personality, recruitment.derivePersonality(employee.skills));
});

test('personality changes quality risk and incident learning in a predictable way', () => {
  const careful = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    personality: recruitment.derivePersonality({ turning: 8, milling: 4, precision: 9, learning: 9 })
  };
  const pragmatic = {
    profileVersion: 2,
    name: 'Tarek Test',
    skills: { turning: 7, milling: 3, precision: 2, learning: 2 },
    personality: recruitment.derivePersonality({ turning: 7, milling: 3, precision: 2, learning: 2 })
  };

  assert.equal(recruitment.qualityRiskModifier(careful), -2);
  assert.equal(recruitment.qualityRiskModifier(pragmatic), 1);
  assert.ok(recruitment.incidentExperience(careful, 'repairSelf') > recruitment.incidentExperience(pragmatic, 'repairSelf'));
  assert.equal(recruitment.breakdownAdvice(careful, 'warning').action, 'repairSelf');
  assert.equal(recruitment.breakdownAdvice(pragmatic, 'warning').action, 'continueRisky');
  assert.equal(recruitment.breakdownAdvice(pragmatic, 'major_failure').action, 'repairTechnician');
});

test('machine experience follows the machine type across different hall bays', () => {
  const employee = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    personality: recruitment.derivePersonality({ turning: 8, milling: 4, precision: 9, learning: 9 }),
    machineHistory: {}
  };

  recruitment.recordMachineIncident(employee, {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    action: 'repairSelf',
    fault: 'sensor_error',
    gameMinutes: 120,
    bay: 2
  });
  recruitment.recordMachineIncident(employee, {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    action: 'repairTechnician',
    fault: 'tool_break',
    gameMinutes: 360,
    bay: 7
  });

  const sameType = recruitment.machineExperience(employee, 'standard');
  assert.equal(sameType.incidents, 2);
  assert.equal(sameType.selfRepairs, 1);
  assert.equal(sameType.technicianRepairs, 1);
  assert.equal(sameType.lastBay, 7);
  assert.equal(Object.keys(employee.machineHistory).length, 1);

  const advice = recruitment.breakdownAdvice(employee, 'warning', {
    machineType: 'standard',
    machineName: 'Nexora NX-350'
  });
  assert.match(advice.text, /Nexora NX-350/);
  assert.match(advice.text, /2 Störungen/);

  recruitment.recordMachineIncident(employee, {
    machineType: 'rapid',
    machineName: 'Nexora NX-420',
    action: 'continueRisky',
    gameMinutes: 500,
    bay: 2
  });
  assert.equal(Object.keys(employee.machineHistory).length, 2);
  assert.equal(recruitment.machineExperience(employee, 'rapid').incidents, 1);
});

test('employee normalization preserves machine-type experience in saved games', () => {
  const normalized = recruitment.normalizeEmployee({
    profileVersion: 2,
    name: 'Mira Stahlwind',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    machineHistory: {
      standard: {
        machineName: 'Nexora NX-350',
        incidents: 3,
        selfRepairs: 2,
        technicianRepairs: 1,
        riskyContinues: 0,
        firstAt: 100,
        lastAt: 900,
        lastBay: 8
      }
    }
  }, 12);
  assert.equal(normalized.machineHistory.standard.incidents, 3);
  assert.equal(normalized.machineHistory.standard.machineType, 'standard');
  assert.equal(normalized.machineHistory.standard.lastBay, 8);
});

test('employee memories keep only five important entries and merge repeats', () => {
  const employee = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    memories: []
  };

  recruitment.recordMemory(employee, {
    id: 'machine_incident:standard:sensor_error:repairSelf',
    type: 'machine_incident',
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'sensor_error',
    faultLabel: 'Sensorfehler',
    action: 'repairSelf',
    importance: 6,
    gameMinutes: 100,
    bay: 2
  });
  recruitment.recordMemory(employee, {
    id: 'machine_incident:standard:sensor_error:repairSelf',
    type: 'machine_incident',
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'sensor_error',
    faultLabel: 'Sensorfehler',
    action: 'repairSelf',
    importance: 7,
    gameMinutes: 200,
    bay: 7
  });

  assert.equal(employee.memories.length, 1);
  assert.equal(employee.memories[0].count, 2);
  assert.equal(employee.memories[0].lastBay, 7);
  assert.equal(employee.memories[0].importance, 7);

  for (let i = 0; i < 7; i += 1) {
    recruitment.recordMemory(employee, {
      id: 'event:' + i,
      type: 'event',
      machineType: i % 2 ? 'rapid' : 'standard',
      machineName: i % 2 ? 'Nexora NX-420' : 'Nexora NX-350',
      importance: i + 1,
      gameMinutes: 300 + i
    });
  }

  assert.equal(employee.memories.length, recruitment.MAX_MEMORIES);
  assert.equal(Math.min(...employee.memories.map(memory => memory.importance)), 4);
});

test('breakdown advice recalls a concrete prior event on the same machine type', () => {
  const employee = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    personality: recruitment.derivePersonality({ turning: 8, milling: 4, precision: 9, learning: 9 }),
    machineHistory: {},
    memories: []
  };

  recruitment.recordMemory(employee, {
    id: 'machine_incident:standard:sensor_error:repairSelf',
    type: 'machine_incident',
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'sensor_error',
    faultLabel: 'Sensorfehler',
    action: 'repairSelf',
    importance: 6,
    gameMinutes: 100,
    bay: 2
  });

  const sameType = recruitment.breakdownAdvice(employee, 'warning', {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'sensor_error'
  });
  assert.match(sameType.text, /letzten Sensorfehler/);
  assert.match(sameType.text, /selbst nachgesehen/);

  const otherType = recruitment.breakdownAdvice(employee, 'warning', {
    machineType: 'rapid',
    machineName: 'Nexora NX-420',
    fault: 'sensor_error'
  });
  assert.doesNotMatch(otherType.text, /letzten Sensorfehler/);
});

test('risky escalation becomes a high-priority memory with a clear later warning', () => {
  const employee = {
    profileVersion: 2,
    name: 'Tarek Test',
    skills: { turning: 7, milling: 3, precision: 2, learning: 2 },
    personality: recruitment.derivePersonality({ turning: 7, milling: 3, precision: 2, learning: 2 }),
    memories: []
  };

  recruitment.recordMemory(employee, {
    id: 'major_failure:standard:tool_break:after_risky',
    type: 'major_failure',
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'tool_break',
    faultLabel: 'Werkzeugbruch erkannt',
    outcome: 'after_risky',
    importance: 10,
    gameMinutes: 700,
    bay: 5
  });

  const memory = recruitment.latestMachineMemory(employee, 'standard', 'tool_break');
  assert.equal(memory.importance, 10);
  assert.match(recruitment.memoryTitle(memory), /eskaliert/);

  const advice = recruitment.breakdownAdvice(employee, 'warning', {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    fault: 'tool_break'
  });
  assert.match(advice.text, /weitergefahren und sie ist eskaliert/);
});


test('machine familiarity grows from normal work on the same type across bays', () => {
  const employee = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    machineHistory: {}
  };

  let result = recruitment.recordMachineWork(employee, {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    minutes: 240,
    partsProduced: 30,
    gameMinutes: 240,
    bay: 2
  });
  assert.equal(result.level, 0);
  assert.equal(result.label, 'Neu');

  result = recruitment.recordMachineWork(employee, {
    machineType: 'standard',
    machineName: 'Nexora NX-350',
    minutes: 240,
    partsProduced: 25,
    gameMinutes: 480,
    bay: 7
  });
  assert.equal(result.level, 1);
  assert.equal(result.label, 'Eingearbeitet');
  assert.equal(result.leveledUp, true);
  assert.equal(result.workMinutes, 480);
  assert.equal(result.partsProduced, 55);
  assert.equal(employee.machineHistory.standard.lastBay, 7);
  assert.equal(Object.keys(employee.machineHistory).length, 1);

  recruitment.recordMachineWork(employee, {
    machineType: 'rapid',
    machineName: 'Nexora NX-420',
    minutes: 120,
    partsProduced: 12,
    gameMinutes: 600,
    bay: 3
  });
  assert.equal(recruitment.familiarityFor(employee, 'rapid').level, 0);
  assert.equal(Object.keys(employee.machineHistory).length, 2);
});

test('familiarity tiers give small capped production and quality advantages', () => {
  const employee = {
    profileVersion: 2,
    name: 'Mira Test',
    skills: { turning: 8, milling: 4, precision: 9, learning: 9 },
    machineHistory: {
      standard: {
        machineType: 'standard',
        machineName: 'Nexora NX-350',
        workMinutes: 18000,
        partsProduced: 2200
      }
    }
  };

  const familiarity = recruitment.familiarityFor(employee, 'standard');
  assert.equal(familiarity.level, 4);
  assert.equal(familiarity.label, 'Spezialist');
  assert.equal(recruitment.familiarityProductionMultiplier(employee, 'standard'), 1.04);
  assert.equal(recruitment.familiarityQualityRiskModifier(employee, 'standard'), -1.5);
  assert.equal(recruitment.familiarityProductionMultiplier(employee, 'rapid'), 1);
  assert.equal(recruitment.familiarityQualityRiskModifier(employee, 'rapid'), 0);
});

test('machine familiarity thresholds represent 8, 40, 120, and 300 work hours', () => {
  assert.deepEqual(
    recruitment.FAMILIARITY_LEVELS.map(level => level.minMinutes),
    [0, 480, 2400, 7200, 18000]
  );
  assert.deepEqual(
    recruitment.FAMILIARITY_LEVELS.map(level => level.label),
    ['Neu', 'Eingearbeitet', 'Vertraut', 'Erfahren', 'Spezialist']
  );
});


test('wage expectations vary by profile and remain stable for the same applicant', () => {
  const first = recruitment.generateApplicant(1);
  const second = recruitment.generateApplicant(2);
  const firstAgain = recruitment.generateApplicant(1);

  assert.equal(first.baseHourlyWage, firstAgain.baseHourlyWage);
  assert.ok(first.baseHourlyWage >= 20 && first.baseHourlyWage <= 31);
  assert.ok(second.baseHourlyWage >= 20 && second.baseHourlyWage <= 31);
  assert.equal(recruitment.hourlyWage(first, 2), recruitment.hourlyWage(first, 1) + 2);

  const junior = recruitment.wageExpectation({ turning: 2, milling: 2, precision: 2, learning: 2 }, 10);
  const expert = recruitment.wageExpectation({ turning: 9, milling: 8, precision: 9, learning: 8 }, 10);
  assert.ok(expert > junior);
});

test('employees keep the negotiated wage when hired and reloaded', () => {
  const candidate = recruitment.generateApplicant(7);
  const employee = recruitment.createEmployee(candidate, 77);
  assert.equal(employee.baseHourlyWage, candidate.baseHourlyWage);

  const restored = recruitment.normalizeEmployee(JSON.parse(JSON.stringify(employee)), employee.id);
  assert.equal(restored.baseHourlyWage, employee.baseHourlyWage);
  assert.equal(recruitment.hourlyWage(restored, 1), employee.baseHourlyWage);
  assert.equal(recruitment.hourlyWage(restored, 2), employee.baseHourlyWage + 2);
});


test('QS applicants have a dedicated non-machining profile', () => {
  const first = recruitment.generateQualityApplicant(101);
  const second = recruitment.generateQualityApplicant(101);
  assert.deepEqual(first, second);
  assert.equal(first.profileType, 'quality');
  assert.equal(first.specialty, 'Qualitätssicherung');
  assert.deepEqual(Object.keys(first.qualitySkills).sort(), ['analysis', 'documentation', 'inspection', 'measurement']);
  assert.ok(Object.values(first.qualitySkills).every(value => value >= 1 && value <= 10));
  assert.equal(Object.hasOwn(first.qualitySkills, 'turning'), false);
  assert.equal(Object.hasOwn(first.qualitySkills, 'milling'), false);
  assert.match(first.about, /Stärkster QS-Wert:/);
});

test('recruitment keeps separate operator and QS applicant pools', () => {
  const state = {};
  recruitment.ensureState(state);
  assert.equal(state.recruitment.applicants.length, recruitment.APPLICANT_COUNT);
  assert.equal(state.recruitment.qualityApplicants.length, recruitment.QUALITY_APPLICANT_COUNT);
  assert.ok(state.recruitment.applicants.every(candidate => candidate.profileType !== 'quality'));
  assert.ok(state.recruitment.qualityApplicants.every(candidate => candidate.profileType === 'quality'));

  const allIds = [
    ...state.recruitment.applicants.map(candidate => candidate.id),
    ...state.recruitment.qualityApplicants.map(candidate => candidate.id)
  ];
  assert.equal(new Set(allIds).size, allIds.length);
});

test('hiring a QS applicant preserves QS skills and refills only the QS pool', () => {
  const state = {};
  recruitment.ensureState(state);
  const operatorIds = state.recruitment.applicants.map(candidate => candidate.id);
  const candidate = state.recruitment.qualityApplicants[0];
  const taken = recruitment.takeQualityApplicant(state, candidate.id);

  assert.equal(taken.id, candidate.id);
  assert.deepEqual(state.recruitment.applicants.map(person => person.id), operatorIds);
  assert.equal(state.recruitment.qualityApplicants.length, recruitment.QUALITY_APPLICANT_COUNT);
  assert.equal(state.recruitment.qualityApplicants.some(person => person.id === candidate.id), false);

  const employee = recruitment.createQualityEmployee(taken, 500);
  assert.equal(employee.profileType, 'quality');
  assert.equal(employee.specialty, 'Qualitätssicherung');
  assert.deepEqual(employee.qualitySkills, taken.qualitySkills);
  assert.equal(recruitment.qualityInspectionPrecision(employee) >= 1, true);
  assert.equal(recruitment.hourlyWage(employee, 2), recruitment.hourlyWage(employee, 1) + 2);
});

test('QS precision comes from measurement and inspection, not machining skills', () => {
  const low = recruitment.createQualityEmployee({
    ...recruitment.generateQualityApplicant(201),
    qualitySkills: { measurement: 2, inspection: 2, analysis: 8, documentation: 8 }
  }, 601);
  const high = recruitment.createQualityEmployee({
    ...recruitment.generateQualityApplicant(202),
    qualitySkills: { measurement: 10, inspection: 10, analysis: 2, documentation: 2 }
  }, 602);

  assert.ok(recruitment.qualityInspectionPrecision(high) > recruitment.qualityInspectionPrecision(low));
  assert.equal(low.skills.turning, 1);
  assert.equal(low.skills.milling, 1);
});

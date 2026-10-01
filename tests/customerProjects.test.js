'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const customerProjects = require('../systems/customerProjects.js');

const profile = {
  key: 'series', customer: 'Kaeldor Components', sector: 'Luftfahrt & Präzision',
  playStyle: 'Hohe Präzision · anspruchsvolle Teile', reputation: 72
};

function newState(seed = 12345) {
  const state = { gameMinutes: 0 };
  customerProjects.ensureState(state, { seed });
  return state;
}

function makeProject(size, seed = 12345) {
  const state = newState(seed);
  const project = customerProjects.create(state, profile, { size, atMinute: 0 });
  return { state, project };
}

function finishPrototype(state, projectId, minute = 60) {
  return customerProjects.completePhase(state, projectId, 'prototype', { performance: 0.5 }, minute);
}

test('creates visible main phases and keeps future branches undisclosed', () => {
  const { state, project } = makeProject('large');

  assert.deepEqual(project.phases.map(item => [item.id, item.name, item.visible]), [
    ['prototype', 'Prototyp', true], ['pilot', 'Vorserie', true], ['series', 'Serie', true]
  ]);
  assert.equal(customerProjects.getAvailableDecision(state, project.id), null);
  assert.equal(project.customerProfile.sector, profile.sector);
  assert.equal(project.playStyle, profile.playStyle);
  assert.equal(JSON.stringify(state).includes('Sonderauftrag'), false);
});

test('small projects run automatically through prototype, pilot and series', () => {
  const { state, project } = makeProject('small', 42);

  const result = customerProjects.tick(state, 2000);

  assert.equal(result.ok, true);
  assert.equal(result.completed.length, 3);
  assert.equal(customerProjects.getById(state, project.id).status, 'completed');
  assert.equal(customerProjects.getAvailableDecision(state, project.id), null);
  assert.equal(customerProjects.tick(state, 2000).completed.length, 0);
});

test('one tick can advance small projects created at different times in event-time order', () => {
  const state = newState(43);
  const first = customerProjects.create(state, profile, { size: 'small', atMinute: 0 });
  const second = customerProjects.create(state, profile, { size: 'small', atMinute: 500 });
  const result = customerProjects.tick(state, 2000);
  assert.equal(result.ok, true);
  assert.equal(result.completed.length, 6);
  assert.equal(customerProjects.getById(state, first.id).status, 'completed');
  assert.equal(customerProjects.getById(state, second.id).status, 'completed');
  assert.equal(state.customerProjects.now, 2000);
});

test('large projects offer meaningful decisions and record their advertised effects', () => {
  const { state, project } = makeProject('large', 901);
  const completed = finishPrototype(state, project.id);
  assert.equal(completed.ok, true);
  assert.equal(completed.resultDescriptor.phaseId, 'prototype');
  const decision = customerProjects.getAvailableDecision(state, project.id);
  assert.ok(decision);
  assert.equal(decision.phaseId, 'prototype');
  assert.match(decision.options[1].description, /risiko/i);

  const before = customerProjects.getById(state, project.id).metrics;
  const chosen = customerProjects.chooseDecision(state, project.id, 'ambitious-pilot', 70);
  assert.equal(chosen.ok, true);
  assert.ok(chosen.decision.quantityAfter > before.quantity);
  assert.ok(chosen.decision.expectedProfitAfter > before.expectedProfit);
  assert.ok(chosen.decision.riskAfter > before.risk);
  assert.equal(customerProjects.getAvailableDecision(state, project.id), null);
  assert.equal(customerProjects.completePhase(state, project.id, 'prototype', {}, 71).code, 'phase-not-active');
});

test('medium projects have one decision and continue through the standard phase path', () => {
  const { state, project } = makeProject('medium', 77);
  finishPrototype(state, project.id);
  const decision = customerProjects.getAvailableDecision(state, project.id);
  assert.ok(decision);
  assert.equal(customerProjects.chooseDecision(state, project.id, 'steady-pilot', 61).ok, true);
  assert.equal(customerProjects.getById(state, project.id).currentPhaseId, 'pilot');
  assert.equal(customerProjects.completePhase(state, project.id, 'pilot', {}, 100).ok, true);
  assert.equal(customerProjects.getById(state, project.id).currentPhaseId, 'series');
  assert.equal(customerProjects.completePhase(state, project.id, 'series', {}, 140).project.status, 'completed');
});

test('decision and phase timestamps cannot be older than the current project clock', () => {
  const decisionCase = makeProject('large', 18);
  finishPrototype(decisionCase.state, decisionCase.project.id, 60);
  const decision = customerProjects.getAvailableDecision(decisionCase.state, decisionCase.project.id);
  assert.equal(customerProjects.tick(decisionCase.state, 120).ok, true);
  const beforeDecision = JSON.stringify(decisionCase.state);
  assert.equal(customerProjects.chooseDecision(decisionCase.state, decisionCase.project.id, decision.options[0].id, 61).code, 'invalid-time');
  assert.equal(JSON.stringify(decisionCase.state), beforeDecision);

  const phaseCase = makeProject('medium', 19);
  finishPrototype(phaseCase.state, phaseCase.project.id, 60);
  assert.equal(customerProjects.chooseDecision(phaseCase.state, phaseCase.project.id, 'steady-pilot', 61).ok, true);
  assert.equal(customerProjects.tick(phaseCase.state, 120).ok, true);
  const beforePhase = JSON.stringify(phaseCase.state);
  assert.equal(customerProjects.completePhase(phaseCase.state, phaseCase.project.id, 'pilot', {}, 100).code, 'invalid-time');
  assert.equal(JSON.stringify(phaseCase.state), beforePhase);
});

test('probabilities stay inside documented bounds and equal seeds reproduce project outcomes', () => {
  const traces = seed => {
    const { state, project } = makeProject('large', seed);
    const prototype = finishPrototype(state, project.id, 60);
    const decision = customerProjects.getAvailableDecision(state, project.id);
    customerProjects.chooseDecision(state, project.id, decision.options[0].id, 61);
    const pilot = customerProjects.completePhase(state, project.id, 'pilot', { performance: 1 }, 120);
    return [prototype.resultDescriptor, pilot.resultDescriptor, customerProjects.getById(state, project.id)];
  };
  const first = traces('fixed-project-seed');
  const second = traces('fixed-project-seed');
  assert.deepEqual(first, second);
  for (const result of first.slice(0, 2)) {
    assert.ok(result.probability >= customerProjects.limits.probabilityMin);
    assert.ok(result.probability <= customerProjects.limits.probabilityMax);
  }
  if (first[1].branchProbability !== undefined) {
    assert.ok(first[1].branchProbability >= customerProjects.limits.probabilityMin);
    assert.ok(first[1].branchProbability <= customerProjects.limits.probabilityMax);
  }
});

test('a failed pilot can reveal a revision phase, while a successful one may reveal a special order', () => {
  function pilotPath(seed, performance) {
    const { state, project } = makeProject('large', seed);
    finishPrototype(state, project.id, 10);
    const decision = customerProjects.getAvailableDecision(state, project.id);
    customerProjects.chooseDecision(state, project.id, decision.options[0].id, 11);
    const result = customerProjects.completePhase(state, project.id, 'pilot', { performance }, 20);
    return { result, project: customerProjects.getById(state, project.id) };
  }

  const revision = pilotPath(5, -1);
  assert.equal(revision.result.resultDescriptor.quality, 'needs-attention');
  if (revision.result.resultDescriptor.branch === 'revision') {
    assert.equal(revision.project.phases.find(item => item.id === 'revision').visible, true);
  }
  const successful = pilotPath(1, 1);
  assert.equal(successful.result.resultDescriptor.quality, 'good');
  if (successful.result.resultDescriptor.branch === 'special-order') {
    assert.equal(successful.project.phases.find(item => item.id === 'special-order').visible, true);
  }
});

test('rejects unknown projects, phases, unavailable choices and duplicate events without mutation', () => {
  const { state, project } = makeProject('large', 100);
  assert.equal(customerProjects.getById(state, 'missing'), null);
  assert.equal(customerProjects.completePhase(state, 'missing', 'prototype', {}, 1).code, 'unknown-project');
  assert.equal(customerProjects.completePhase(state, project.id, 'missing', {}, 1).code, 'unknown-phase');

  finishPrototype(state, project.id, 10);
  const before = JSON.stringify(state);
  assert.equal(customerProjects.chooseDecision(state, project.id, 'not-an-option', 11).code, 'unknown-decision-option');
  assert.equal(JSON.stringify(state), before);

  customerProjects.chooseDecision(state, project.id, 'steady-pilot', 11);
  const afterChoice = JSON.stringify(state);
  assert.equal(customerProjects.chooseDecision(state, project.id, 'steady-pilot', 12).code, 'decision-not-available');
  assert.equal(JSON.stringify(state), afterChoice);
  assert.equal(customerProjects.completePhase(state, project.id, 'prototype', {}, 12).code, 'phase-not-active');
});

test('ensureState applies a seed only when initializing random state', () => {
  const state = newState('initial-project-seed');
  const initialRandomState = state.customerProjects.randomState;
  const project = customerProjects.create(state, profile, { size: 'large' });
  assert.equal(customerProjects.completePhase(state, project.id, 'prototype', {}, 10).ok, true);
  const persistedRandomState = state.customerProjects.randomState;
  assert.notEqual(persistedRandomState, initialRandomState);

  customerProjects.ensureState(state, { seed: 'different-seed' });
  assert.equal(state.customerProjects.randomState, persistedRandomState);
});

test('ensuring state is idempotent and a JSON reload can resume a project', () => {
  const { state, project } = makeProject('large', 'reload-seed');
  finishPrototype(state, project.id, 300);
  customerProjects.chooseDecision(state, project.id, 'ambitious-pilot', 301);
  const before = JSON.stringify(state);
  customerProjects.ensureState(state);
  customerProjects.ensureState(state);
  assert.equal(JSON.stringify(state), before);

  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(customerProjects.getById(restored, project.id).currentPhaseId, 'pilot');
  assert.equal(customerProjects.getAvailableDecision(restored, project.id), null);
  assert.equal(customerProjects.completePhase(restored, project.id, 'pilot', {}, 360).ok, true);
  assert.ok(customerProjects.getAvailableDecision(restored, project.id));
});

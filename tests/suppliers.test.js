'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const suppliers = require('../systems/suppliers.js');
const DAY = 1440;

function stateWithReputation(value = 0) {
  const state = { reputation: value, gameMinutes: 0, money: 1000 };
  assert.equal(suppliers.ensureState(state, { seed: 'supplier-tests' }).ok, true);
  return state;
}

function request(orderId = 'OM-1', overrides = {}) {
  return {
    id: orderId,
    qty: 20,
    routing: [{ id: 'step-mill', type: 'milling' }],
    ...overrides
  };
}

test('legacy migration is idempotent, JSON-safe, and reputation unlocks providers', () => {
  const state = { reputation: 24, money: 1000, orders: [{ id: 'old-order' }] };
  const first = suppliers.ensureState(state, { seed: 42 });
  assert.equal(first.ok, true);
  assert.equal(state.suppliers.version, 1);
  assert.equal(suppliers.ensureState(state).ok, true);
  assert.equal(state.suppliers.providers.length, 4);
  assert.deepEqual(suppliers.listProviders(state, 'quality').providers, []);
  state.reputation = 25;
  const available = suppliers.listProviders(state, 'quality');
  assert.equal(available.ok, true);
  assert.deepEqual(available.providers.map(provider => provider.id), ['supplier-precision']);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(suppliers.ensureState(restored).ok, true);
  assert.deepEqual(restored.suppliers, state.suppliers);
  assert.equal(restored.orders[0].id, 'old-order');
});

test('provider list exposes stable operations and reliability bands for known and unknown suppliers', () => {
  const state = stateWithReputation(80);
  const all = suppliers.listProviders(state);
  assert.equal(all.ok, true);
  assert.equal(all.providers.length, 4);
  const local = all.providers.find(provider => provider.id === 'supplier-local-machining');
  const precision = all.providers.find(provider => provider.id === 'supplier-precision');
  assert.deepEqual(local.operations, ['turning', 'milling']);
  assert.equal(local.reliabilityRange.confidence, 'high');
  assert.deepEqual(precision.reliabilityRange, { min: 0.62, max: 0.88, confidence: 'low' });
  assert.ok(precision.reliabilityRange.min < precision.reliabilityRange.max);
});

test('quotes repeat from seed and request data and include cost, lead time, risk and expiry', () => {
  const state = stateWithReputation(25);
  const order = request('OM-22');
  const options = { routeStepId: 'step-mill', lotId: 'lot-3', atMinute: 120, seed: 'fixed' };
  const first = suppliers.quote(state, 'supplier-precision', order, options);
  const second = suppliers.quote(state, 'supplier-precision', order, options);
  assert.equal(first.ok, true);
  for (const field of ['totalCost', 'leadTimeMinutes', 'dueAtMinute', 'expiresAtMinute', 'qualityRisk', 'reliabilityRange', 'quoteId']) {
    assert.deepEqual(first[field], second[field]);
  }
  assert.equal(first.orderId, 'OM-22');
  assert.equal(first.lotId, 'lot-3');
  assert.equal(first.dueAtMinute, first.quotedAtMinute + first.leadTimeMinutes);
  assert.ok(first.totalCost > 0);
  assert.ok(first.qualityRisk > 0 && first.qualityRisk < 1);
  assert.equal(suppliers.quote(state, 'supplier-precision', order, { operationType: 'assembly' }).code, 'unsupported_operation');
});

test('outsourcing creates one referenced job; invalid and duplicate requests do not consume another job', () => {
  const state = stateWithReputation(0);
  const order = request('OM-31');
  const offer = suppliers.quote(state, 'supplier-local-machining', order, { routeStepId: 'step-mill', lotId: 'lot-1', atMinute: 50 });
  assert.equal(offer.ok, true);
  const beforeInvalid = JSON.stringify(state.suppliers.jobs);
  assert.equal(suppliers.outsource(state, 'supplier-local-machining', 'OM-31', 'step-mill', 0, 50).code, 'invalid_amount');
  assert.equal(JSON.stringify(state.suppliers.jobs), beforeInvalid);
  const accepted = suppliers.outsource(state, 'supplier-local-machining', 'OM-31', 'step-mill', 20, 50);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.job.orderId, 'OM-31');
  assert.equal(accepted.job.routeStepId, 'step-mill');
  assert.equal(accepted.job.lotId, 'lot-1');
  assert.equal(accepted.job.status, 'in_progress');
  assert.equal(suppliers.outsource(state, 'supplier-local-machining', 'OM-31', 'step-mill', 20, 50).code, 'already_outsourced');
  assert.equal(state.suppliers.jobs.length, 1);
  assert.equal(state.money, 1000);
});

test('external route operations can be quoted and separate lots of one step get separate jobs', () => {
  const state = stateWithReputation(0);
  const externalOrder = request('OM-EXT', { routing: [
    { id: 'step-external-mill', type: 'external', operationType: 'milling', requiredMachineKind: null }
  ] });
  const firstQuote = suppliers.quote(state, 'supplier-local-machining', externalOrder, {
    routeStepId: 'step-external-mill', operationType: 'milling', lotId: 'OM-EXT-lot-1', atMinute: 30
  });
  const secondQuote = suppliers.quote(state, 'supplier-local-machining', externalOrder, {
    routeStepId: 'step-external-mill', operationType: 'milling', lotId: 'OM-EXT-lot-2', atMinute: 30
  });
  assert.equal(firstQuote.ok, true);
  assert.equal(firstQuote.operationType, 'milling');
  assert.equal(secondQuote.ok, true);
  assert.notEqual(firstQuote.quoteId, secondQuote.quoteId);

  const first = suppliers.outsource(state, 'supplier-local-machining', 'OM-EXT', 'step-external-mill', 20,
    30, { quoteId: firstQuote.quoteId });
  const second = suppliers.outsource(state, 'supplier-local-machining', 'OM-EXT', 'step-external-mill', 20,
    30, { quoteId: secondQuote.quoteId });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.job.id, second.job.id);
  assert.equal(first.job.lotId, 'OM-EXT-lot-1');
  assert.equal(second.job.lotId, 'OM-EXT-lot-2');
  assert.equal(suppliers.outsource(state, 'supplier-local-machining', 'OM-EXT', 'step-external-mill', 20,
    30, { quoteId: firstQuote.quoteId }).code, 'already_outsourced');

  const completed = suppliers.completeJob(state, first.job.id, { deliveredAtMinute: first.job.dueAtMinute });
  assert.equal(completed.ok, true);
  assert.equal(completed.job.lotId, 'OM-EXT-lot-1');
  assert.equal(suppliers.completeJob(state, second.job.id, { deliveredAtMinute: second.job.dueAtMinute }).ok, true);
});

test('absolute-time tick is idempotent and marks due then overdue jobs', () => {
  const state = stateWithReputation();
  const offer = suppliers.quote(state, 'supplier-local-machining', request('OM-41'), {
    routeStepId: 'step-mill', atMinute: 0, seed: 3
  });
  const created = suppliers.outsource(state, 'supplier-local-machining', 'OM-41', 'step-mill', 20, 0);
  assert.equal(created.job.dueAtMinute, offer.dueAtMinute);
  assert.equal(suppliers.tick(state, offer.dueAtMinute).changed, 1);
  assert.equal(state.suppliers.jobs[0].status, 'due');
  assert.equal(suppliers.tick(state, offer.dueAtMinute).changed, 0);
  assert.equal(suppliers.tick(state, offer.dueAtMinute + 30).changed, 1);
  assert.equal(state.suppliers.jobs[0].status, 'overdue');
  assert.equal(state.suppliers.jobs[0].lateMinutes, 30);
  assert.equal(suppliers.tick(state, offer.dueAtMinute + 30).changed, 0);
  assert.equal(suppliers.tick(state, offer.dueAtMinute + 90).changed, 0);
  assert.equal(state.suppliers.jobs[0].status, 'overdue');
  assert.equal(state.suppliers.jobs[0].lateMinutes, 90);
  const overdueState = JSON.stringify(state.suppliers);
  assert.equal(suppliers.tick(state, offer.dueAtMinute + 90).changed, 0);
  assert.equal(JSON.stringify(state.suppliers), overdueState);
  assert.equal(suppliers.tick(state, offer.dueAtMinute - 1).code, 'time_reversed');
});

test('completion controls due date and outcomes learn reliability and retain quality problems', () => {
  const state = stateWithReputation(0);
  const firstOffer = suppliers.quote(state, 'supplier-local-machining', request('OM-51'), { routeStepId: 'step-mill', atMinute: 0 });
  const first = suppliers.outsource(state, 'supplier-local-machining', 'OM-51', 'step-mill', 20, 0).job;
  assert.equal(suppliers.completeJob(state, first.id, { deliveredAtMinute: first.dueAtMinute - 1 }).code, 'not_due');
  const result = suppliers.completeJob(state, first.id, { deliveredAtMinute: first.dueAtMinute + DAY, quality: 'rework' });
  assert.equal(result.ok, true);
  assert.equal(result.job.timing, 'late');
  assert.equal(result.job.outcome.quality, 'rework');
  const provider = state.suppliers.providers.find(item => item.id === first.providerId);
  assert.equal(provider.jobsCompleted, 1);
  assert.equal(provider.successfulJobs, 0);
  const learned = result.reliabilityRange;
  assert.ok(learned.max - learned.min < firstOffer.reliabilityRange.max - firstOffer.reliabilityRange.min);
  assert.equal(suppliers.recordOutcome(state, first.id, { deliveredAtMinute: first.dueAtMinute }).code, 'already_completed');
});

test('successful and early outcomes are recorded, without changing caller reputation or finances', () => {
  const state = stateWithReputation(37);
  const offer = suppliers.quote(state, 'supplier-local-machining', request('OM-61'), { routeStepId: 'step-mill', atMinute: 10 });
  const job = suppliers.outsource(state, 'supplier-local-machining', 'OM-61', 'step-mill', 20, 10).job;
  const result = suppliers.recordOutcome(state, job.id, { deliveredAtMinute: offer.dueAtMinute - 20, quality: 'accepted' });
  assert.equal(result.ok, true);
  assert.equal(result.job.timing, 'on_time');
  assert.equal(state.reputation, 37);
  assert.equal(state.money, 1000);
  assert.equal(state.suppliers.providers.find(item => item.id === job.providerId).successfulJobs, 1);
});

test('rejections for inaccessible providers, missing quotes, and invalid inputs leave jobs untouched', () => {
  const state = stateWithReputation(0);
  const before = JSON.stringify(state.suppliers.jobs);
  assert.equal(suppliers.outsource(state, 'supplier-precision', 'OM-71', 'step-mill', 20, 0).code, 'provider_locked');
  assert.equal(suppliers.outsource(state, 'supplier-local-machining', 'OM-71', 'step-mill', 20, 0).code, 'quote_required');
  assert.equal(suppliers.outsource(state, 'supplier-local-machining', '', 'step-mill', 20, 0).code, 'invalid_reference');
  assert.equal(JSON.stringify(state.suppliers.jobs), before);
  assert.equal(state.suppliers.jobs.length, 0);
});

test('browser global and CommonJS expose the same public API', () => {
  assert.deepEqual(Object.keys(suppliers).sort(), [
    'completeJob', 'ensureState', 'listProviders', 'outsource', 'quote', 'recordOutcome', 'tick'
  ]);
  assert.equal(globalThis.CNCModules.suppliers, suppliers);
});

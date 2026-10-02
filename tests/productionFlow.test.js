'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const productionFlow = require('../systems/productionFlow.js');

function makeOrder(overrides = {}) {
  return {
    id: 'OM-0042', customer: 'Kaeldor Components', part: 'Spannprisma', partKey: 'mill-prism',
    kind: 'Fräsen', qty: 120, duration: 150, reward: 24000, deadlineHours: 64,
    materialType: 'aluminium6082', materialAmountKg: 72,
    routing: [
      { id: 'step-turn', type: 'turning', requiredMachineKind: 'Drehen', setupMinutes: 20 },
      { id: 'step-mill', type: 'milling', requiredMachineKind: 'Fräsen', setupMinutes: 40 },
      { id: 'step-qa', type: 'quality', requiredMachineKind: null, setupMinutes: 10 }
    ],
    batchMode: 'auto', priority: 'normal', interruptionSensitivity: 0.5, ...overrides
  };
}

function queuedState(order = makeOrder(), options = {}) {
  const state = { gameMinutes: 10 };
  const result = productionFlow.addOrder(state, order, options);
  assert.equal(result.ok, true);
  return state;
}

test('createPlan deterministically splits quantities and preserves the input order', () => {
  const order = makeOrder();
  const before = JSON.stringify(order);
  const planA = productionFlow.createPlan(order, { capacity: 40 });
  const planB = productionFlow.createPlan(order, { capacity: 40 });

  assert.equal(JSON.stringify(order), before);
  assert.deepEqual(planA, planB);
  assert.equal(planA.route.length, 3);
  assert.equal(planA.lots.reduce((sum, lot) => sum + lot.qty, 0), order.qty);
  assert.equal(planA.lots.at(-1).sequence, planA.lots.length);
  assert.ok(planA.lots.every(lot => lot.routeStepId === 'step-turn' && lot.status === 'waiting'));
  assert.equal(planA.order.materialAmountKg, 72);
  assert.equal(planA.order.reward, 24000);
});

test('manual and automatic batch modes are distinct, valid, and balance exactly', () => {
  const order = makeOrder();
  const plans = ['auto', 'small', 'normal', 'large'].map(batchMode =>
    productionFlow.createPlan(order, { batchMode, capacity: 40 }));
  const counts = plans.map(plan => plan.lots.length);
  assert.equal(new Set(counts).size, 4);
  for (const plan of plans) {
    assert.ok(plan.lots.every(lot => lot.qty > 0));
    assert.equal(plan.lots.reduce((sum, lot) => sum + lot.qty, 0), order.qty);
  }
});

test('accepts routes of one to four steps and rejects five without mutating the order', () => {
  const base = makeOrder();
  const fourStepRoute = [...base.routing, { id: 'step-assembly', type: 'assembly', requiredMachineKind: 'Montage' }];
  for (let length = 1; length <= 4; length += 1) {
    const plan = productionFlow.createPlan({ ...base, routing: fourStepRoute.slice(0, length) });
    assert.equal(plan.ok, true);
    assert.equal(plan.route.length, length);
  }
  const invalid = { ...base, routing: [...fourStepRoute, { id: 'step-5', type: 'external', requiredMachineKind: null }] };
  const snapshot = JSON.stringify(invalid);
  assert.deepEqual(productionFlow.createPlan(invalid), { ok: false, code: 'ROUTE_TOO_LONG' });
  assert.equal(JSON.stringify(invalid), snapshot);
});

test('legacy orders without routing get a compatible single-step production plan', () => {
  const legacy = { id: 'legacy-1', customer: 'Alt', kind: 'Drehen', qty: 7, reward: 3000, customField: { keep: true } };
  const result = productionFlow.createPlan(legacy);
  assert.equal(result.ok, true);
  assert.equal(result.route.length, 1);
  assert.equal(result.route[0].type, 'turning');
  assert.equal(result.route[0].requiredMachineKind, 'Drehen');
  assert.deepEqual(result.order.customField, { keep: true });
  assert.equal(result.order.reward, 3000);
});

test('queue sorting applies priority and stable FIFO order, without disturbing running work', () => {
  const state = { gameMinutes: 0 };
  const first = makeOrder({ id: 'A', qty: 4, routing: [{ id: 'a1', type: 'turning', requiredMachineKind: 'Drehen' }] });
  const second = makeOrder({ id: 'B', qty: 4, routing: [{ id: 'b1', type: 'turning', requiredMachineKind: 'Drehen' }] });
  const third = makeOrder({ id: 'C', qty: 4, routing: [{ id: 'c1', type: 'turning', requiredMachineKind: 'Drehen' }] });
  productionFlow.addOrder(state, first, { batchMode: 'large' });
  productionFlow.addOrder(state, second, { batchMode: 'large' });
  productionFlow.addOrder(state, third, { batchMode: 'large' });
  const running = productionFlow.startNext(state, 'machine-1', 'Drehen', 1).lot;
  productionFlow.setPriority(state, 'B', 'high');
  productionFlow.setPriority(state, 'C', 'high');
  const queue = productionFlow.getSnapshot(state).queues.Drehen;
  assert.deepEqual(queue, ['B-lot-2', 'C-lot-3']);
  assert.equal(state.productionFlow.lots.find(lot => lot.id === running.id).status, 'running');
  assert.equal(state.productionFlow.lots.find(lot => lot.id === running.id).priority, 'normal');
});

test('completed steps release the same lot to the next station queue in route order', () => {
  const state = queuedState(makeOrder({ qty: 10 }), { batchMode: 'large' });
  const started = productionFlow.startNext(state, 'turn-1', 'Drehen', 12);
  assert.equal(started.ok, true);
  const moved = productionFlow.completeStep(state, started.lot.id, 'step-turn', 30);
  assert.equal(moved.ok, true);
  assert.equal(moved.lot.status, 'queued');
  assert.equal(moved.lot.routeStepId, 'step-mill');
  assert.deepEqual(productionFlow.getSnapshot(state).queues.Fräsen, [started.lot.id]);
  assert.equal(productionFlow.completeStep(state, started.lot.id, 'step-qa', 31).ok, false);
});

test('null-machine quality steps remain visible through reload, start and completion at QS', () => {
  const route = [
    { id: 'step-turn', type: 'turning', requiredMachineKind: 'Drehen' },
    { id: 'step-qa', type: 'quality', requiredMachineKind: null }
  ];
  const state = queuedState(makeOrder({ id: 'turn-then-qa', qty: 1, routing: route }), { batchMode: 'large' });
  const started = productionFlow.startNext(state, 'turn-1', 'Drehen', 12);
  assert.equal(started.ok, true);
  const handoff = productionFlow.completeStep(state, started.lot.id, 'step-turn', 20);
  assert.equal(handoff.ok, true);
  assert.equal(handoff.lot.requiredMachineKind, null);
  assert.deepEqual(productionFlow.getSnapshot(state).queues.QS, [started.lot.id]);

  const restored = JSON.parse(JSON.stringify(state));
  productionFlow.ensureState(restored);
  assert.deepEqual(productionFlow.getSnapshot(restored).queues.QS, [started.lot.id]);
  const quality = productionFlow.startNext(restored, 'inspector-1', 'QS', 25);
  assert.equal(quality.ok, true);
  assert.equal(quality.lot.routeStepId, 'step-qa');
  const completed = productionFlow.completeStep(restored, quality.lot.id, 'step-qa', 30);
  assert.equal(completed.ok, true);
  assert.equal(completed.lot.status, 'completed');
});

test('external route lots hand off to suppliers and return to the next local queue', () => {
  const route = [
    { id: 'step-turn', type: 'turning', requiredMachineKind: 'Drehen' },
    { id: 'step-vendor-mill', type: 'external', operationType: 'milling', requiredMachineKind: null },
    { id: 'step-qa', type: 'quality', requiredMachineKind: null }
  ];
  assert.equal(productionFlow.createPlan(makeOrder({ id: 'invalid-external', routing: [
    { id: 'step-vendor-unknown', type: 'external', operationType: 'painting', requiredMachineKind: null }
  ] })).code, 'INVALID_ROUTE');
  const state = queuedState(makeOrder({ id: 'external-flow', qty: 6, routing: route }), { batchMode: 'large' });
  const first = productionFlow.startNext(state, 'turn-1', 'Drehen', 12);
  assert.equal(first.ok, true);
  const toVendor = productionFlow.completeStep(state, first.lot.id, 'step-turn', 20);
  assert.equal(toVendor.ok, true);
  assert.equal(toVendor.lot.status, 'waiting');
  assert.equal(toVendor.lot.routeStepType, 'external');
  assert.equal(productionFlow.startNext(state, 'fake-vendor-machine', 'External', 21).code, 'NO_QUEUED_LOT');

  const handedOff = productionFlow.outsourceLot(state, first.lot.id, 'SJ-external-flow-1', 22);
  assert.equal(handedOff.ok, true);
  assert.equal(handedOff.lot.status, 'outsourced');
  assert.equal(productionFlow.getSnapshot(state).outsourcedLots[0].supplierJobId, 'SJ-external-flow-1');
  const restored = JSON.parse(JSON.stringify(state));
  productionFlow.ensureState(restored);
  assert.equal(restored.productionFlow.lots[0].status, 'outsourced');

  const returned = productionFlow.completeOutsourcedStep(restored, first.lot.id, 'step-vendor-mill', 'SJ-external-flow-1', 60);
  assert.equal(returned.ok, true);
  assert.equal(returned.lot.status, 'queued');
  assert.equal(returned.lot.routeStepId, 'step-qa');
  assert.deepEqual(productionFlow.getSnapshot(restored).queues.QS, [first.lot.id]);
  assert.equal(productionFlow.completeOutsourcedStep(restored, first.lot.id, 'step-vendor-mill', 'SJ-wrong', 61).ok, false);
});

test('interrupt and resume preserve machine, quantity, time, and bounded restart setup', () => {
  const state = queuedState(makeOrder({ qty: 12, setupMinutes: 40 }), { batchMode: 'large' });
  const lot = productionFlow.startNext(state, 'machine-a', 'Drehen', 20).lot;
  assert.equal(productionFlow.estimateRestartSetup(state, lot.id).estimatedRestartSetupMinutes, 10);
  const interrupted = productionFlow.interrupt(state, lot.id, 'machine-a', 27);
  assert.equal(interrupted.ok, true);
  assert.equal(interrupted.estimatedRestartSetupMinutes, 10);
  assert.equal(interrupted.lot.interrupted.machineId, 'machine-a');
  assert.equal(interrupted.lot.interrupted.remainingQty, lot.qty);
  const resumed = productionFlow.resume(state, lot.id, 'machine-b', 45);
  assert.equal(resumed.ok, true);
  assert.equal(resumed.restartSetupMinutes, 10);
  assert.equal(resumed.lot.machineId, 'machine-b');
  assert.equal(resumed.lot.restartSetupMinutes, 10);

  const maxSensitive = queuedState(makeOrder({ id: 'MAX', qty: 8, setupMinutes: 40, interruptionSensitivity: 1 }),
    { batchMode: 'large', restartSetupFraction: 0.9 });
  const maxLot = productionFlow.startNext(maxSensitive, 'machine-c', 'Drehen', 1).lot;
  const maxInterrupt = productionFlow.interrupt(maxSensitive, maxLot.id, 'machine-c', 2);
  assert.equal(maxInterrupt.estimatedRestartSetupMinutes, 20);
  assert.ok(maxInterrupt.estimatedRestartSetupMinutes <= maxLot.setupMinutes * 0.5);
});

test('invalid requests return errors without partially mutating state', () => {
  const pristine = { gameMinutes: 0, legacy: { untouched: true } };
  const before = JSON.stringify(pristine);
  assert.equal(productionFlow.setPriority(pristine, 'missing', 'high').ok, false);
  assert.equal(productionFlow.interrupt(pristine, 'missing', 'M1', 1).ok, false);
  assert.equal(productionFlow.resume(pristine, 'missing', 'M1', 1).ok, false);
  assert.equal(productionFlow.completeStep(pristine, 'missing', 'step', 1).ok, false);
  assert.equal(productionFlow.tick(pristine, -1).ok, false);
  assert.equal(JSON.stringify(pristine), before);
  const invalidPriority = queuedState(makeOrder({ qty: 5 }), { batchMode: 'large' });
  const unchanged = JSON.stringify(invalidPriority);
  assert.deepEqual(productionFlow.setPriority(invalidPriority, 'OM-0042', 'urgent'), { ok: false, code: 'INVALID_PRIORITY' });
  assert.equal(JSON.stringify(invalidPriority), unchanged);
});

test('ensureState is idempotent and JSON saves can be restored and continued', () => {
  const state = queuedState(makeOrder({ qty: 18 }), { batchMode: 'normal' });
  productionFlow.ensureState(state);
  const once = JSON.stringify(state.productionFlow);
  productionFlow.ensureState(state);
  assert.equal(JSON.stringify(state.productionFlow), once);
  assert.equal(new Set(state.productionFlow.lots.map(lot => lot.id)).size, state.productionFlow.lots.length);

  const restored = JSON.parse(JSON.stringify(state));
  const started = productionFlow.startNext(restored, 'restored-machine', 'Drehen', 22);
  assert.equal(started.ok, true);
  const result = productionFlow.completeStep(restored, started.lot.id, 'step-turn', 40);
  assert.equal(result.ok, true);
  assert.equal(productionFlow.getSnapshot(restored).queueSizes.Fräsen, 1);
  assert.doesNotThrow(() => JSON.stringify(restored));
});

test('getSnapshot is read-only and browser global exposes the same module API', () => {
  const state = { gameMinutes: 0 };
  const before = JSON.stringify(state);
  assert.deepEqual(productionFlow.getSnapshot(state).waitingLots, []);
  assert.equal(JSON.stringify(state), before);

  const source = fs.readFileSync(path.join(__dirname, '../systems/productionFlow.js'), 'utf8');
  const browser = { globalThis: null };
  browser.globalThis = browser;
  vm.runInNewContext(source, browser);
  assert.equal(typeof browser.CNCModules.productionFlow.createPlan, 'function');
  assert.equal(browser.CNCModules.productionFlow.createPlan(makeOrder()).ok, true);
});

test('ensureState repairs an incomplete saved running lot before completion', () => {
  const state = {
    productionFlow: {
      version: 1,
      lots: [{
        id: 'DAMAGED-lot-1', orderId: 'DAMAGED', routeStepId: 'step-turn',
        routeStepType: 'turning', requiredMachineKind: 'Drehen',
        sequence: 1, qty: 5, qtyCompleted: 2, status: 'running',
        machineId: '1', routePosition: 0
      }],
      queues: {}, events: [],
      orders: {
        DAMAGED: makeOrder({ id: 'DAMAGED', qty: 5, routing: [
          { id: 'step-turn', type: 'turning', requiredMachineKind: 'Drehen' },
          { id: 'step-qa', type: 'quality', requiredMachineKind: null }
        ] })
      },
      machineAssignments: { '1': 'DAMAGED-lot-1' },
      nextLotNumber: 2
    }
  };

  productionFlow.ensureState(state);
  const lot = state.productionFlow.lots[0];
  assert.deepEqual(lot.stepStatuses, ['running', 'blocked']);
  assert.equal(lot.qtyCompleted, 2);
  assert.doesNotThrow(() => productionFlow.completeStep(state, lot.id, 'step-turn', 45));
  assert.equal(state.productionFlow.lots[0].status, 'queued');
  assert.equal(state.productionFlow.lots[0].routeStepId, 'step-qa');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const breakdowns = require('../systems/breakdowns.js');

function makeState(options = {}) {
  const machines = options.machines || [{
    bay: 1,
    type: 'standard',
    maintenance: options.maintenance ?? 90,
    tool: options.tool ?? 82,
    operatingHours: options.operatingHours,
    activeId: options.activeId ?? null,
    produced: options.produced ?? 0
  }];
  const state = { gameMinutes: 1240, paused: false, machines };
  breakdowns.init(state, { random: options.random || (() => 0.999999) });
  return state;
}

const running = { operatingBays: [1] };

test('healthy running machine stays clear when the random roll is above its hazard', () => {
  const state = makeState();
  assert.deepEqual(breakdowns.tick(state, 60, running), []);
  assert.equal(breakdowns.getStatus(state, 1), 'ok');
  assert.equal(breakdowns.getFault(state, 1), null);
  assert.equal(breakdowns.getRecord(state, 1).operatingHours, 1);
});

test('poor maintenance, worn tooling, and accumulated runtime raise warning risk', () => {
  const good = makeState({ maintenance: 90, tool: 90, random: () => 0.01 });
  const poor = makeState({
    maintenance: 10,
    tool: 10,
    random: () => 0.01,
    machines: [{ bay: 1, maintenance: 10, tool: 10, activeId: null }]
  });
  poor.breakdowns.machines['1'].operatingHours = 220;

  const goodProfile = breakdowns.getRiskProfile(good, 1);
  const poorProfile = breakdowns.getRiskProfile(poor, 1);
  assert.ok(poorProfile.warningRatePerHour > goodProfile.warningRatePerHour * 50);
  assert.deepEqual(breakdowns.tick(good, 60, running), []);
  assert.equal(breakdowns.tick(poor, 60, running)[0].event, 'warning');
});

test('a warning can be created and repaired without changing the central money field', () => {
  const state = makeState({ random: () => 0 });
  state.money = 5000;
  const warning = breakdowns.tick(state, 1, running)[0];
  assert.equal(warning.event, 'warning');
  assert.equal(breakdowns.getStatus(state, 1), 'warning');
  assert.equal(breakdowns.getFault(state, 1), warning.fault);

  const repair = breakdowns.repairNow(state, 1);
  assert.equal(repair.event, 'repair');
  assert.ok(repair.cost > 0);
  assert.ok(repair.downtime > 0);
  assert.equal(state.money, 5000);
  assert.equal(breakdowns.getStatus(state, 1), 'repairing');
  assert.equal(breakdowns.canContinueProduction(state, 1), false);

  const completion = breakdowns.tick(state, repair.downtime, { operatingBays: [] });
  assert.equal(completion[0].event, 'repair_complete');
  assert.equal(breakdowns.getStatus(state, 1), 'ok');
  assert.equal(breakdowns.getFault(state, 1), null);
});

test('risky continuation can escalate into a costly major failure and report scrap', () => {
  const state = makeState({ random: () => 0, produced: 3 });
  state.money = 1000;
  breakdowns.tick(state, 1, running);
  const decision = breakdowns.continueRisky(state, 1);
  assert.equal(decision.event, 'continue_risky');
  assert.equal(breakdowns.canContinueProduction(state, 1), true);

  const failure = breakdowns.tick(state, 1, running)[0];
  assert.equal(failure.event, 'major_failure');
  assert.ok(failure.cost > 0);
  assert.ok(failure.downtime > 0);
  assert.equal(failure.scrapParts, 1);
  assert.equal(breakdowns.getStatus(state, 1), 'major_failure');
  assert.equal(breakdowns.canContinueProduction(state, 1), false);
  assert.equal(state.money, 1000);
});

test('scheduled repair lets the active job finish, then starts cheaper maintenance', () => {
  const state = makeState({ random: () => 0, activeId: 'A12' });
  breakdowns.tick(state, 1, running);
  const info = breakdowns.getFaultInfo(breakdowns.getFault(state, 1));
  const scheduled = breakdowns.scheduleRepair(state, 1);

  assert.equal(scheduled.event, 'repair_scheduled');
  assert.equal(scheduled.scheduledAfterJob, true);
  assert.ok(scheduled.cost < info.baseCost);
  assert.equal(breakdowns.canContinueProduction(state, 1), true);

  state.machines[0].activeId = null;
  const started = breakdowns.tick(state, 1, { operatingBays: [] });
  assert.equal(started[0].event, 'repair_started');
  assert.equal(started[0].cost, 0); // The scheduled event already reported the cost.
  assert.equal(breakdowns.getStatus(state, 1), 'repairing');
  assert.equal(breakdowns.canContinueProduction(state, 1), false);

  assert.equal(breakdowns.tick(state, scheduled.downtime, { operatingBays: [] })[0].event, 'repair_complete');
});

test('several machines can receive independent faults in one tick', () => {
  const state = makeState({
    random: () => 0,
    machines: [
      { bay: 1, maintenance: 90, tool: 82 },
      { bay: 2, maintenance: 45, tool: 35 }
    ]
  });
  const events = breakdowns.tick(state, 60, { operatingBays: [1, 2] });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map(event => event.bay), [1, 2]);
  assert.equal(breakdowns.getStatus(state, 1), 'warning');
  assert.equal(breakdowns.getStatus(state, 2), 'warning');
});

test('an absent machine cannot fault or be repaired', () => {
  const state = makeState({ machines: [], random: () => 0 });
  assert.deepEqual(breakdowns.tick(state, 600, { operatingBays: [7] }), []);
  assert.equal(breakdowns.getStatus(state, 7), null);
  assert.equal(breakdowns.getFault(state, 7), null);
  assert.equal(breakdowns.repairNow(state, 7), null);
  assert.equal(breakdowns.continueRisky(state, 7), null);
  assert.equal(breakdowns.scheduleRepair(state, 7), null);
});

test('breakdown state survives JSON serialization for LocalStorage', () => {
  const state = makeState({ random: () => 0 });
  breakdowns.tick(state, 1, running);
  state.breakdowns.machines['1'].operatingHours = 12.5;
  const restored = JSON.parse(JSON.stringify(state));
  breakdowns.init(restored, { random: () => 0.999999 });

  assert.equal(breakdowns.getStatus(restored, 1), 'warning');
  assert.equal(breakdowns.getRecord(restored, 1).operatingHours, 12.5);
  assert.equal(typeof JSON.stringify(restored.breakdowns), 'string');
  assert.deepEqual(Object.keys(restored.breakdowns), ['machines']);
});

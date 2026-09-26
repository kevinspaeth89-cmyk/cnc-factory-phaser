'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const orderMarket = require('../systems/orderMarket.js');

function newState(seed) {
  const state = { gameMinutes: 0 };
  orderMarket.init(state, { seed });
  return state;
}

test('initializes a balanced, varied market with serializable order data', () => {
  const state = newState(12345);
  const offers = orderMarket.getAvailable(state);

  assert.equal(offers.length, orderMarket.limits.startOffers);
  assert.equal(offers.filter(order => order.kind === 'Drehen').length, 2);
  assert.equal(offers.filter(order => order.kind === 'Fräsen').length, 2);
  assert.equal(new Set(offers.map(order => order.customer)).size, 4);
  for (const order of offers) {
    assert.ok(order.qty > 0);
    assert.ok(order.reward > 0);
    assert.ok(order.duration > 0);
    assert.ok(order.deadlineHours > 0);
    assert.ok(order.expiresAt > order.createdAt);
    assert.match(order.partKey, order.kind === 'Drehen' ? /^turn-/ : /^mill-/);
  }
  assert.doesNotThrow(() => JSON.stringify(state));
});

test('slows the offer cycle while keeping several choices visible', () => {
  const state = newState(32123);
  assert.equal(orderMarket.limits.minOffers, 3);
  assert.equal(orderMarket.limits.maxOffers, 6);
  assert.ok(state.orderMarket.nextRefreshAt >= 240);
  assert.ok(state.orderMarket.nextRefreshAt <= 360);
  for (const order of orderMarket.getAvailable(state)) {
    assert.ok(order.duration >= 44);
    assert.ok(order.expiresAt - order.createdAt >= 960);
  }
});

test('migrates offers from older saves to the slower, lower reward balance', () => {
  const state = newState(8891);
  state.orderMarket.version = 1;
  state.orderMarket.now = 0;
  state.orderMarket.nextRefreshAt = 1;
  state.gameMinutes = 10;
  const before = orderMarket.getAvailable(state).map(order => ({ ...order }));
  before.forEach(order => {
    order.duration = 5;
    order.deadlineHours = 2;
    order.reward *= 5;
    order.expiresAt = 1;
  });
  state.orderMarket.available = before;

  orderMarket.init(state);

  assert.equal(state.orderMarket.version, 2);
  assert.deepEqual(orderMarket.getAvailable(state).map(order => order.id), before.map(order => order.id));
  for (const order of orderMarket.getAvailable(state)) {
    assert.ok(order.duration >= 44);
    assert.ok(order.deadlineHours >= 10);
    assert.ok(order.reward < before.find(previous => previous.id === order.id).reward);
    assert.ok(order.expiresAt > state.gameMinutes);
  }
  assert.ok(state.orderMarket.nextRefreshAt >= state.gameMinutes + 240);
});

test('expires offers over time and supplies new orders while retaining several choices', () => {
  const state = newState(67890);
  const originalIds = new Set(orderMarket.getAvailable(state).map(order => order.id));
  const lastInitialExpiry = Math.max(...state.orderMarket.available.map(order => order.expiresAt));

  orderMarket.tick(state, lastInitialExpiry + 1);
  const offers = orderMarket.getAvailable(state);

  assert.ok(offers.length >= orderMarket.limits.minOffers);
  assert.ok(offers.length <= orderMarket.limits.maxOffers);
  assert.ok(offers.every(order => !originalIds.has(order.id)));
  assert.ok(offers.some(order => order.createdAt > 0));
});

test('accept removes an offer and returns the full order record', () => {
  const state = newState(24680);
  const before = orderMarket.getAvailable(state);
  const selected = before[0];

  const accepted = orderMarket.accept(state, selected.id);

  assert.equal(accepted.id, selected.id);
  assert.equal(orderMarket.getAvailable(state).some(order => order.id === selected.id), false);
  assert.equal(orderMarket.accept(state, 'missing-order'), null);
});

test('completion can schedule a same-customer, same-kind follow-up offer', () => {
  const state = newState(13579);
  const first = orderMarket.getAvailable(state)[0];
  const accepted = orderMarket.accept(state, first.id);
  accepted.followUpChance = 1;

  const result = orderMarket.onCompleted(state, accepted);
  assert.equal(result.processed, true);
  assert.equal(result.followUpScheduled, true);
  assert.equal(state.orderMarket.pendingFollowUps.length, 1);

  const restored = JSON.parse(JSON.stringify(state));
  orderMarket.init(restored);
  orderMarket.tick(restored, result.readyAt + 1);
  const followUp = orderMarket.getAvailable(restored).find(order => order.parentOrderId === accepted.id);
  assert.ok(followUp);
  assert.equal(followUp.customer, accepted.customer);
  assert.equal(followUp.kind, accepted.kind);
  assert.equal(followUp.isFollowUp, true);

  const duplicate = orderMarket.onCompleted(restored, accepted);
  assert.equal(duplicate.processed, false);
  assert.equal(restored.orderMarket.completedCustomers[accepted.customer], 1);
  assert.equal(orderMarket.getReputation(restored)[accepted.customer],54);
});

test('customer reputation changes only once and affects future offers, not accepted payouts', () => {
  const fresh=newState('reputation-seed');
  const better=newState('reputation-seed');
  const baseOffers=orderMarket.getAvailable(fresh);
  assert.deepEqual(baseOffers.map(x=>x.id),orderMarket.getAvailable(better).map(x=>x.id));
  const oldOrder=orderMarket.accept(better,baseOffers[0].id);
  const oldReward=oldOrder.reward;
  const customer=oldOrder.customer;
  orderMarket.onCompleted(better,oldOrder,{late:false});
  assert.equal(orderMarket.getReputation(better)[customer],54);
  orderMarket.onCompleted(better,oldOrder,{late:true});
  assert.equal(orderMarket.getReputation(better)[customer],54);
  assert.equal(oldOrder.reward,oldReward);
  const late=newState('late-reputation');
  const lateOrder=orderMarket.accept(late,orderMarket.getAvailable(late)[0].id);
  orderMarket.onCompleted(late,lateOrder,{late:true});
  assert.equal(orderMarket.getReputation(late)[lateOrder.customer],44);

  const premium=newState('premium-seed');
  const neutral=newState('premium-seed');
  for(const name of Object.keys(premium.customerReputation))premium.customerReputation[name]=100;
  const next=neutral.orderMarket.nextRefreshAt;
  orderMarket.tick(premium,next+1);
  orderMarket.tick(neutral,next+1);
  const boosted=orderMarket.getAvailable(premium).find(x=>x.createdAt>=next);
  const baseline=orderMarket.getAvailable(neutral).find(x=>x.id===boosted?.id);
  assert.ok(boosted&&baseline);
  assert.equal(boosted.reputationBonusPct,15);
  assert.ok(boosted.reward>=baseline.reward);
});

test('saved market reload preserves offers, counters, and random progression', () => {
  const original = newState('reload-seed');
  const originalIds = orderMarket.getAvailable(original).map(order => order.id);
  const restored = JSON.parse(JSON.stringify(original));

  orderMarket.init(restored);
  assert.deepEqual(orderMarket.getAvailable(restored).map(order => order.id), originalIds);

  const nextRefresh = restored.orderMarket.nextRefreshAt;
  orderMarket.tick(restored, nextRefresh + 1);
  assert.ok(orderMarket.getAvailable(restored).some(order => !originalIds.includes(order.id)));
  assert.doesNotThrow(() => JSON.stringify(restored));
});

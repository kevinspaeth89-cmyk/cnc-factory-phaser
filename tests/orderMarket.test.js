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
  assert.ok(state.orderMarket.nextRefreshAt >= 720);
  assert.ok(state.orderMarket.nextRefreshAt <= 1080);
  for (const order of orderMarket.getAvailable(state)) {
    assert.ok(order.duration >= 66);
    assert.ok(order.expiresAt - order.createdAt >= 1680);
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

  assert.equal(state.orderMarket.version, 4);
  assert.deepEqual(orderMarket.getAvailable(state).map(order => order.id), before.map(order => order.id));
  for (const order of orderMarket.getAvailable(state)) {
    assert.ok(order.duration >= 44);
    assert.ok(order.deadlineHours >= 10);
    assert.ok(order.reward < before.find(previous => previous.id === order.id).reward);
    assert.ok(order.expiresAt > state.gameMinutes);
  }
  assert.ok(state.orderMarket.nextRefreshAt >= state.gameMinutes + 720);
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

test('withdraws an accepted rush offer once and reverses the promise', () => {
  const state=newState('rush-withdrawal');
  const base=orderMarket.getAvailable(state)[0];
  const rush={...base,id:'RUSH-WITHDRAW',isRushOrder:true,acceptedRushAt:state.gameMinutes};
  assert.ok(orderMarket.acceptRushOffer(state,rush));
  orderMarket.recordRushDecision(state,rush,true);
  assert.equal(orderMarket.getReputation(state)[rush.customer],56);
  assert.equal(orderMarket.withdrawRushOffer(state,base.id),null);
  assert.equal(orderMarket.withdrawRushOffer(state,rush.id).id,rush.id);
  assert.equal(orderMarket.getReputation(state)[rush.customer],40);
  assert.equal(orderMarket.getAvailable(state).some(order=>order.id===rush.id),false);
  assert.equal(orderMarket.withdrawRushOffer(state,rush.id),null);
  assert.equal(orderMarket.getReputation(state)[rush.customer],40);
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


test('customer history turns repeat business into a persistent relationship', () => {
  const state = newState('customer-history');
  const firstOffer = orderMarket.getAvailable(state)[0];
  const first = orderMarket.accept(state, firstOffer.id);
  const customer = first.customer;

  orderMarket.onCompleted(state, first, { late: false, payout: 4200, qualityDefectParts: 0 });
  let history = orderMarket.getCustomerHistory(state)[customer];
  assert.equal(history.completed, 1);
  assert.equal(history.onTime, 1);
  assert.equal(history.late, 0);
  assert.equal(history.revenue, 4200);
  assert.equal(history.topPart, first.part);
  assert.equal(history.punctualityPct, 100);
  assert.equal(history.relationship, 'Wiederkehrender Kunde');

  const second = {
    ...first,
    id: first.id + '-RETURN',
    createdAt: first.createdAt + 100,
    expiresAt: first.expiresAt + 100,
    isRushOrder: true
  };
  orderMarket.onCompleted(state, second, { late: true, payout: 3000, qualityDefectParts: 2 });
  orderMarket.recordComplaint(state, customer, 'rework');
  history = orderMarket.getCustomerHistory(state)[customer];

  assert.equal(history.completed, 2);
  assert.equal(history.onTime, 1);
  assert.equal(history.late, 1);
  assert.equal(history.revenue, 7200);
  assert.equal(history.rushOrders, 1);
  assert.equal(history.qualityIssues, 1);
  assert.equal(history.complaints, 1);
  assert.equal(history.punctualityPct, 50);
  assert.equal(history.lastComplaintOutcome, 'rework');

  const duplicate = orderMarket.onCompleted(state, second, { late: false, payout: 9999 });
  assert.equal(duplicate.processed, false);
  assert.equal(orderMarket.getCustomerHistory(state)[customer].completed, 2);
  assert.equal(orderMarket.getCustomerHistory(state)[customer].revenue, 7200);
});

test('legacy completed-customer counts migrate into customer history without inventing punctuality', () => {
  const state = newState('customer-history-migration');
  const customer = orderMarket.getAvailable(state)[0].customer;
  state.orderMarket.completedCustomers[customer] = 4;
  delete state.orderMarket.customerHistory;

  orderMarket.init(state);

  const history = orderMarket.getCustomerHistory(state)[customer];
  assert.equal(history.completed, 4);
  assert.equal(history.relationship, 'Bekannter Kunde');
  assert.equal(history.punctualityPct, null);
  assert.equal(history.revenue, 0);
});


test('customers expose stable fantasy brand identities and industrial sectors', () => {
  const expected = {
    'Veltraxis Mobility': 'Automobil & E-Mobility',
    'Orionis Fluidics': 'Lebensmittel-, Pharma- & Fluidtechnik',
    'Kaeldor Components': 'Luftfahrt & Präzisionskomponenten',
    'Asteron Robotics': 'Robotik & Automation'
  };

  for (const [customer, sector] of Object.entries(expected)) {
    const identity = orderMarket.getCustomerIdentity(customer);
    assert.equal(identity.customer, customer);
    assert.equal(identity.sector, sector);
    assert.ok(identity.brandClass);
    assert.ok(identity.logoMark);
    assert.ok(identity.slogan);
    assert.ok(Array.isArray(identity.specialties));
    assert.ok(identity.specialties.length >= 3);
  }

  const classes = Object.keys(expected).map(customer => orderMarket.getCustomerIdentity(customer).brandClass);
  assert.equal(new Set(classes).size, classes.length);
});

test('generated orders carry customer sector metadata while old orders can still derive identity by customer', () => {
  const state = newState('customer-brand-metadata');
  const orders = orderMarket.getAvailable(state);
  assert.ok(orders.every(order => order.customerSector === orderMarket.getCustomerIdentity(order.customer).sector));
  assert.ok(orders.every(order => order.customerBrandClass === orderMarket.getCustomerIdentity(order.customer).brandClass));

  const legacy = { ...orders[0] };
  delete legacy.customerSector;
  delete legacy.customerBrandClass;
  const identity = orderMarket.getCustomerIdentity(legacy.customer);
  assert.ok(identity.sector);
  assert.ok(identity.brandClass);
});

test('customer history snapshots include brand identity', () => {
  const state = newState('customer-brand-history');
  const customer = orderMarket.getAvailable(state)[0].customer;
  const history = orderMarket.getCustomerHistory(state)[customer];
  assert.equal(history.identity.customer, customer);
  assert.equal(history.identity.sector, orderMarket.getCustomerIdentity(customer).sector);
});


test('sector profiles create visibly different order shapes', () => {
  const state = newState('sector-shapes');
  const offers = Object.fromEntries(orderMarket.getAvailable(state).map(order => [order.customer, order]));

  assert.ok(offers['Veltraxis Mobility'].qty >= 40);
  assert.ok(offers['Asteron Robotics'].qty <= 30);
  assert.ok(offers['Kaeldor Components'].difficulty >= 4);
  assert.match(offers['Orionis Fluidics'].customerPlayStyle, /qualitätssensibel/i);
  assert.match(offers['Veltraxis Mobility'].customerPlayStyle, /Größere Serien/);
  assert.match(offers['Asteron Robotics'].customerPlayStyle, /Eilaufträge/);
});

test('customer part preferences bias repeat generation without making it exclusive', () => {
  const preferred = {
    'Veltraxis Mobility': new Set(['turn-flange','turn-spacer','turn-sleeve','mill-plate']),
    'Orionis Fluidics': new Set(['turn-valve','turn-flange','mill-pump']),
    'Kaeldor Components': new Set(['mill-prism','mill-plate','turn-sleeve']),
    'Asteron Robotics': new Set(['mill-bracket','turn-spacer','turn-flange'])
  };
  const hits = Object.fromEntries(Object.keys(preferred).map(customer=>[customer,0]));
  const totals = Object.fromEntries(Object.keys(preferred).map(customer=>[customer,0]));

  for (let seed = 1; seed <= 120; seed += 1) {
    const state = newState('sector-parts-' + seed);
    for (const order of orderMarket.getAvailable(state)) {
      totals[order.customer] += 1;
      if (preferred[order.customer].has(order.partKey)) hits[order.customer] += 1;
    }
  }

  for (const customer of Object.keys(preferred)) {
    assert.ok(hits[customer] / totals[customer] > 0.45, customer + ' should prefer sector-fitting parts');
  }
});

test('robotics customer is more likely to generate rush work than low-rush sectors', () => {
  const state = newState('sector-rush-affinity');
  for (const customer of Object.keys(orderMarket.getReputation(state))) {
    state.orderMarket.completedCustomers[customer] = 5;
    state.customerReputation[customer] = 50;
  }

  const counts = {
    'Veltraxis Mobility': 0,
    'Orionis Fluidics': 0,
    'Kaeldor Components': 0,
    'Asteron Robotics': 0
  };
  for (let index = 0; index < 500; index += 1) {
    const rush = orderMarket.createRushOrder(state, ['Drehen','Fräsen']);
    assert.ok(rush);
    counts[rush.customer] += 1;
  }

  assert.ok(counts['Asteron Robotics'] > counts['Veltraxis Mobility']);
  assert.ok(counts['Asteron Robotics'] > counts['Orionis Fluidics']);
  assert.ok(counts['Asteron Robotics'] > counts['Kaeldor Components']);
});

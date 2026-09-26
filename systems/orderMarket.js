(function attachOrderMarket(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.orderMarket = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createOrderMarket() {
  'use strict';

  const VERSION = 2;
  const MIN_OFFERS = 3;
  const START_OFFERS = 4;
  const MAX_OFFERS = 6;
  const REFRESH_MINUTES = [240, 360];
  const FOLLOW_UP_DELAY_MIN = 120;
  const FOLLOW_UP_DELAY_MAX = 360;
  const FOLLOW_UP_RETRY_MINUTES = 60;
  const MAX_COMPLETED_IDS = 500;
  const KINDS = ['Drehen', 'Fräsen'];

  const profiles = [
    {
      key: 'standard', customer: 'Veltraxis Mobility', label: 'Standardkunde', weight: 42,
      qty: [25, 55], rewardPerPart: [135, 185], duration: [50, 82], deadline: [14, 24],
      difficulty: [1, 3], lifetime: [1680, 2880], followUpChance: 0.18
    },
    {
      key: 'premium', customer: 'Orionis Fluidics', label: 'Premiumkunde', weight: 22,
      qty: [20, 45], rewardPerPart: [185, 255], duration: [62, 100], deadline: [20, 34],
      difficulty: [3, 5], lifetime: [1440, 2520], followUpChance: 0.30
    },
    {
      key: 'series', customer: 'Kaeldor Components', label: 'Serienkunde', weight: 21,
      qty: [60, 100], rewardPerPart: [85, 125], duration: [62, 105], deadline: [30, 48],
      difficulty: [2, 4], lifetime: [2160, 3600], followUpChance: 0.34
    },
    {
      key: 'express', customer: 'Asteron Robotics', label: 'Expresskunde', weight: 15,
      qty: [15, 32], rewardPerPart: [220, 300], duration: [44, 70], deadline: [10, 17],
      difficulty: [2, 4], lifetime: [960, 1680], followUpChance: 0.16
    }
  ];

  const parts = [
    { key: 'turn-flange', name: 'Wellenflansch', kind: 'Drehen', material: '1.4301 Edelstahl', materialType: 'stainless14301', kgPerPart: 1.45 },
    { key: 'turn-valve', name: 'Ventilbuchse', kind: 'Drehen', material: '1.4404 Edelstahl', materialType: 'stainless14404', kgPerPart: 2.1 },
    { key: 'turn-spacer', name: 'Distanzring', kind: 'Drehen', material: 'C45 Stahl', materialType: 'c45', kgPerPart: 0.65 },
    { key: 'turn-sleeve', name: 'Spindelhülse', kind: 'Drehen', material: '42CrMo4 Stahl', materialType: 'steel42crmo4', kgPerPart: 1.8 },
    { key: 'mill-plate', name: 'Grundplatte', kind: 'Fräsen', material: 'EN AW-6082 Aluminium', materialType: 'aluminium6082', kgPerPart: 1.6 },
    { key: 'mill-prism', name: 'Spannprisma', kind: 'Fräsen', material: '42CrMo4 Stahl', materialType: 'steel42crmo4', kgPerPart: 2.45 },
    { key: 'mill-pump', name: 'Pumpengehäuse', kind: 'Fräsen', material: 'EN-GJS-400', materialType: 'castiron400', kgPerPart: 3.3 },
    { key: 'mill-bracket', name: 'Sensorhalter', kind: 'Fräsen', material: 'EN AW-6082 Aluminium', materialType: 'aluminium6082', kgPerPart: 0.85 }
  ];

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toSeed(value) {
    if (typeof value === 'string') {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0 || 0x6d2b79f5;
    }
    const numeric = Number.isFinite(value) ? Math.floor(value) >>> 0 : 0;
    return numeric || 0x6d2b79f5;
  }

  function freshSeed() {
    return toSeed(Math.floor(Math.random() * 0xffffffff));
  }

  function integer(market, min, max) {
    return min + Math.floor(random(market) * (max - min + 1));
  }

  function random(market) {
    market.rngState = (market.rngState + 0x6d2b79f5) >>> 0;
    let value = market.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function range(market, bounds) {
    return integer(market, bounds[0], bounds[1]);
  }

  function isValidKind(kind) {
    return KINDS.includes(kind);
  }

  function validOrder(order) {
    return order && typeof order.id === 'string' && order.id.length > 0 &&
      isValidKind(order.kind) && typeof order.customer === 'string' &&
      typeof order.part === 'string' && Number.isFinite(order.createdAt) &&
      Number.isFinite(order.expiresAt) && order.expiresAt > order.createdAt;
  }

  function emptyMarket(now, seed) {
    return {
      version: VERSION,
      initialized: false,
      now,
      available: [],
      pendingFollowUps: [],
      completedCustomers: {},
      completedOrderIds: [],
      nextRefreshAt: now,
      nextOrderNumber: 1,
      nextKind: 'Drehen',
      rngState: seed
    };
  }

  function rebalanceLegacyOffer(order, now) {
    const profile = profiles.find(item => item.key === order.customerProfile) || profiles[0];
    const midpoint = bounds => Math.round((bounds[0] + bounds[1]) / 2);
    const difficulty = finite(order.difficulty, midpoint(profile.difficulty));
    const reputationBonusPct = finite(order.reputationBonusPct, 0);
    const rewardFactor = (1 + (difficulty - 1) * 0.035) * (1 + reputationBonusPct / 100);
    const maxReward = Number.isFinite(order.qty)
      ? Math.max(100, Math.round((order.qty * midpoint(profile.rewardPerPart) * rewardFactor) / 100) * 100)
      : finite(order.reward, 100);
    const offerLifetime = midpoint(profile.lifetime);
    return {
      ...order,
      reward: Math.max(100, Math.round(Math.min(finite(order.reward, maxReward), maxReward) / 100) * 100),
      duration: Math.max(finite(order.duration, 0), midpoint(profile.duration)),
      deadlineHours: Math.max(finite(order.deadlineHours, 0), midpoint(profile.deadline)),
      offerLifetimeMinutes: offerLifetime,
      expiresAt: Math.max(finite(order.expiresAt, now), now + offerLifetime)
    };
  }

  function normalizeMarket(market, now) {
    const previousVersion = Math.max(0, Math.floor(finite(market.version, 0)));
    market.version = VERSION;
    market.initialized = true;
    market.now = Math.max(0, finite(market.now, now));
    market.available = Array.isArray(market.available)
      ? market.available.filter(validOrder).map(order => previousVersion < VERSION ? rebalanceLegacyOffer(order, now) : ({ ...order }))
      : [];
    market.pendingFollowUps = Array.isArray(market.pendingFollowUps)
      ? market.pendingFollowUps.filter(item => item && Number.isFinite(item.readyAt) && validOrder(item.order))
        .map(item => ({ readyAt: item.readyAt, order: previousVersion < VERSION ? rebalanceLegacyOffer(item.order, now) : ({ ...item.order }) }))
      : [];
    market.completedCustomers = market.completedCustomers && typeof market.completedCustomers === 'object' && !Array.isArray(market.completedCustomers)
      ? market.completedCustomers
      : {};
    market.completedOrderIds = Array.isArray(market.completedOrderIds)
      ? market.completedOrderIds.filter(id => typeof id === 'string').slice(-MAX_COMPLETED_IDS)
      : [];
    market.rngState = toSeed(market.rngState);
    market.nextOrderNumber = Math.max(1, Math.floor(finite(market.nextOrderNumber, 1)));
    market.nextKind = isValidKind(market.nextKind) ? market.nextKind : 'Drehen';
    market.nextRefreshAt = finite(market.nextRefreshAt, market.now + integer(market, REFRESH_MINUTES[0], REFRESH_MINUTES[1]));
    if (previousVersion < VERSION) {
      market.nextRefreshAt = Math.max(market.nextRefreshAt, now + integer(market, REFRESH_MINUTES[0], REFRESH_MINUTES[1]));
    }
    return market;
  }

  function assertState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('orderMarket expects a mutable game state object.');
    }
  }
  function ensureReputation(state) {
    if (!state.customerReputation || typeof state.customerReputation !== 'object' || Array.isArray(state.customerReputation)) {
      state.customerReputation = {};
    }
    for (const profile of profiles) {
      const score = state.customerReputation[profile.customer];
      state.customerReputation[profile.customer] = Number.isFinite(score) ? clamp(Math.round(score), 0, 100) : 50;
    }
    return state.customerReputation;
  }

  function init(state, options) {
    assertState(state);
    ensureReputation(state);
    const opts = options && typeof options === 'object' ? options : {};
    const now = Math.max(0, finite(state.gameMinutes, finite(opts.now, 0)));
    const wasFresh = !state.orderMarket || typeof state.orderMarket !== 'object' || Array.isArray(state.orderMarket);

    if (wasFresh) {
      const seed = opts.seed === undefined ? freshSeed() : toSeed(opts.seed);
      state.orderMarket = emptyMarket(now, seed);
      for (let i = 0; i < START_OFFERS; i += 1) {
        addGeneratedOffer(state, now);
      }
      state.orderMarket.initialized = true;
      state.orderMarket.nextRefreshAt = now + integer(state.orderMarket, REFRESH_MINUTES[0], REFRESH_MINUTES[1]);
    } else {
      const previouslyInitialized = state.orderMarket.initialized === true;
      normalizeMarket(state.orderMarket, now);
      if (!previouslyInitialized) {
        while (state.orderMarket.available.length < MIN_OFFERS) {
          addGeneratedOffer(state, state.orderMarket.now);
        }
      }
      state.orderMarket.initialized = true;
      advance(state, now);
    }
    return state.orderMarket;
  }

  function ensureMarket(state) {
    assertState(state);
    if (!state.orderMarket || typeof state.orderMarket !== 'object' || !state.orderMarket.initialized) {
      init(state);
    }
    return state.orderMarket;
  }

  function chooseKind(market) {
    const turning = market.available.filter(order => order.kind === 'Drehen').length;
    const milling = market.available.filter(order => order.kind === 'Fräsen').length;
    if (turning < milling) return 'Drehen';
    if (milling < turning) return 'Fräsen';
    const kind = market.nextKind;
    market.nextKind = kind === 'Drehen' ? 'Fräsen' : 'Drehen';
    return kind;
  }

  function chooseProfile(market) {
    const counts = Object.create(null);
    market.available.forEach(order => {
      counts[order.customerProfile] = (counts[order.customerProfile] || 0) + 1;
    });
    market.pendingFollowUps.forEach(item => {
      counts[item.order.customerProfile] = (counts[item.order.customerProfile] || 0) + 1;
    });

    let pool = profiles;
    if (market.available.length < profiles.length) {
      const unused = profiles.filter(profile => !counts[profile.key]);
      if (unused.length) pool = unused;
    }
    const weighted = pool.map(profile => ({
      profile,
      weight: profile.weight / (1 + (counts[profile.key] || 0) * 1.4)
    }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let draw = random(market) * total;
    for (const item of weighted) {
      draw -= item.weight;
      if (draw < 0) return item.profile;
    }
    return weighted[weighted.length - 1].profile;
  }

  function choosePart(market, kind, requestedPartKey) {
    if (requestedPartKey) {
      const requested = parts.find(part => part.key === requestedPartKey && part.kind === kind);
      if (requested) return requested;
    }
    const used = new Set(market.available.filter(order => order.kind === kind).map(order => order.partKey));
    let candidates = parts.filter(part => part.kind === kind && !used.has(part.key));
    if (!candidates.length) candidates = parts.filter(part => part.kind === kind);
    return candidates[integer(market, 0, candidates.length - 1)];
  }

  function addGeneratedOffer(state, createdAt, overrides) {
    const market = state.orderMarket;
    const opts = overrides && typeof overrides === 'object' ? overrides : {};
    if (market.available.length >= MAX_OFFERS && !opts.defer) return null;

    const kind = isValidKind(opts.kind) ? opts.kind : chooseKind(market);
    const profile = profiles.find(item => item.key === opts.profileKey) || chooseProfile(market);
    const part = choosePart(market, kind, opts.partKey);
    const number = market.nextOrderNumber;
    market.nextOrderNumber += 1;
    const id = `OM-${String(number).padStart(4, '0')}`;
    const qty = range(market, profile.qty);
    const difficulty = range(market, profile.difficulty);
    const duration = range(market, profile.duration);
    const baseDeadline = range(market, profile.deadline);
    const deadlineHours = Math.max(3, Math.round(baseDeadline - Math.max(0, difficulty - 3) * 0.5));
    const rewardPerPart = range(market, profile.rewardPerPart);
    const reputationBonusPct = Math.round((ensureReputation(state)[profile.customer] - 50) * 0.3);
    const rewardFactor = (1 + (difficulty - 1) * 0.035) * (1 + reputationBonusPct / 100);
    const reward = Math.max(100, Math.round((qty * rewardPerPart * rewardFactor) / 100) * 100);
    const lifetime = range(market, profile.lifetime);
    const isFollowUp = !!opts.isFollowUp;
    const partSuffix = String(number).padStart(4, '0');
    const partName = isFollowUp ? `${part.name} · Folgeauftrag ${partSuffix}` : `${part.name} ${partSuffix}`;
    const order = {
      id,
      customer: profile.customer,
      customerType: profile.label,
      customerProfile: profile.key,
      part: partName,
      partKey: part.key,
      kind,
      qty,
      duration,
      material: part.material,
      materialType: part.materialType,
      kg: Math.max(1, Math.round(qty * part.kgPerPart)),
      reward,
      reputationBonusPct,
      deadlineHours,
      difficulty,
      createdAt,
      expiresAt: createdAt + lifetime,
      offerLifetimeMinutes: lifetime,
      followUpChance: profile.followUpChance,
      isFollowUp,
      parentOrderId: typeof opts.parentOrderId === 'string' ? opts.parentOrderId : null
    };
    if (!opts.defer) market.available.push(order);
    return order;
  }

  function expireAt(market, at) {
    const before = market.available.length;
    market.available = market.available.filter(order => order.expiresAt > at);
    return before - market.available.length;
  }

  function earliestExpiry(market) {
    return market.available.reduce((earliest, order) => Math.min(earliest, order.expiresAt), Infinity);
  }

  function earliestFollowUp(market) {
    return market.pendingFollowUps.reduce((earliest, item) => Math.min(earliest, item.readyAt), Infinity);
  }

  function activateDueFollowUps(state, at) {
    const market = state.orderMarket;
    const remaining = [];
    for (const item of market.pendingFollowUps) {
      if (item.readyAt > at) {
        remaining.push(item);
        continue;
      }
      if (market.available.length >= MAX_OFFERS) {
        remaining.push({ ...item, readyAt: at + FOLLOW_UP_RETRY_MINUTES });
        continue;
      }
      const order = { ...item.order, createdAt: at };
      order.expiresAt = at + Math.max(60, finite(order.offerLifetimeMinutes, 720));
      market.available.push(order);
    }
    market.pendingFollowUps = remaining;
  }

  function fillMinimum(state, at) {
    const market = state.orderMarket;
    while (market.available.length < MIN_OFFERS) {
      addGeneratedOffer(state, at);
    }
  }

  function advance(state, targetMinute) {
    const market = state.orderMarket;
    const target = Math.max(market.now, finite(targetMinute, market.now));
    let guard = 0;

    while (guard < 50000) {
      guard += 1;
      const eventAt = Math.min(market.nextRefreshAt, earliestExpiry(market), earliestFollowUp(market));
      if (!Number.isFinite(eventAt) || eventAt > target) break;

      market.now = Math.max(market.now, eventAt);
      expireAt(market, market.now);
      activateDueFollowUps(state, market.now);
      if (market.nextRefreshAt <= market.now) {
        if (market.available.length < MAX_OFFERS) addGeneratedOffer(state, market.now);
        market.nextRefreshAt = market.now + integer(market, REFRESH_MINUTES[0], REFRESH_MINUTES[1]);
      }
      fillMinimum(state, market.now);
    }

    market.now = target;
    expireAt(market, target);
    activateDueFollowUps(state, target);
    fillMinimum(state, target);
    return market;
  }

  function tick(state, gameMinutes) {
    const market = ensureMarket(state);
    advance(state, finite(gameMinutes, finite(state.gameMinutes, market.now)));
    return market;
  }

  function getAvailable(state) {
    const market = ensureMarket(state);
    return market.available
      .filter(order => order.expiresAt > market.now)
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map(order => ({ ...order }));
  }

  function accept(state, orderId) {
    const market = ensureMarket(state);
    const index = market.available.findIndex(order => order.id === orderId && order.expiresAt > market.now);
    if (index < 0) return null;
    const [order] = market.available.splice(index, 1);
    return { ...order };
  }

  function onCompleted(state, order, options = {}) {
    const market = ensureMarket(state);
    if (!order || typeof order.id !== 'string' || !order.id) {
      return { processed: false, followUpScheduled: false, followUpOrder: null };
    }
    if (market.completedOrderIds.includes(order.id)) {
      return { processed: false, followUpScheduled: false, followUpOrder: null };
    }

    market.completedOrderIds.push(order.id);
    if (market.completedOrderIds.length > MAX_COMPLETED_IDS) {
      market.completedOrderIds.splice(0, market.completedOrderIds.length - MAX_COMPLETED_IDS);
    }
    const customer = typeof order.customer === 'string' && order.customer ? order.customer : 'Unbekannter Kunde';
    market.completedCustomers[customer] = Math.max(0, finite(market.completedCustomers[customer], 0)) + 1;
    const reputation=ensureReputation(state);
    if(Object.hasOwn(reputation,customer))reputation[customer]=clamp(reputation[customer]+(options.late?-6:4),0,100);

    const profile = profiles.find(item => item.key === order.customerProfile) ||
      profiles.find(item => item.customer === customer);
    const chance = clamp(finite(order.followUpChance, profile ? profile.followUpChance : 0.18) +
      ((reputation[customer] ?? 50) - 50) * .004, 0, 1);
    if (random(market) >= chance) {
      return { processed: true, followUpScheduled: false, followUpOrder: null };
    }

    const sourceProfileKey = profile ? profile.key : 'standard';
    const readyAt = market.now + integer(market, FOLLOW_UP_DELAY_MIN, FOLLOW_UP_DELAY_MAX);
    const followUp = addGeneratedOffer(state, readyAt, {
      kind: isValidKind(order.kind) ? order.kind : undefined,
      profileKey: sourceProfileKey,
      partKey: typeof order.partKey === 'string' ? order.partKey : undefined,
      isFollowUp: true,
      defer: true,
      parentOrderId: order.id
    });

    if (!followUp) {
      return { processed: true, followUpScheduled: false, followUpOrder: null };
    }

    market.pendingFollowUps.push({ readyAt, order: { ...followUp } });
    return {
      processed: true,
      followUpScheduled: true,
      readyAt,
      followUpOrder: { ...followUp, createdAt: readyAt, expiresAt: readyAt + followUp.offerLifetimeMinutes }
    };
  }

  return Object.freeze({
    init,
    tick,
    getAvailable,
    accept,
    onCompleted,
    getReputation: state => ({ ...ensureReputation(state) }),
    limits: Object.freeze({ minOffers: MIN_OFFERS, startOffers: START_OFFERS, maxOffers: MAX_OFFERS })
  });
});

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

  const VERSION = 4;
  const MIN_OFFERS = 3;
  const START_OFFERS = 4;
  const MAX_OFFERS = 6;
  const REFRESH_MINUTES = [720, 1080];
  const FOLLOW_UP_DELAY_MIN = 360;
  const FOLLOW_UP_DELAY_MAX = 720;
  const FOLLOW_UP_RETRY_MINUTES = 60;
  const MAX_COMPLETED_IDS = 500;
  const GAME_START = Date.UTC(2026, 0, 5, 6);
  const KINDS = ['Drehen', 'Fräsen'];

  const profiles = [
    {
      key: 'standard', customer: 'Veltraxis Mobility', label: 'Standardkunde', weight: 42,
      sector: 'Automobil & E-Mobility', district: 'Mobilitätspark', brandClass: 'veltraxis', logoMark: 'V',
      slogan: 'Motion, machined.', specialties: ['Wellenflansche','Distanzringe','Antriebsteile'],
      playStyle: 'Größere Serien · planbare Abrufe', preferredParts: ['turn-flange','turn-spacer','turn-sleeve'], partBias: 3,
      rushAffinity: 0.8,
      qty: [40, 78], rewardPerPart: [128, 176], duration: [112, 178], deadline: [30, 52],
      difficulty: [1, 3], lifetime: [2880, 4320], followUpChance: 0.22
    },
    {
      key: 'premium', customer: 'Orionis Fluidics', label: 'Premiumkunde', weight: 22,
      sector: 'Lebensmittel-, Pharma- & Fluidtechnik', district: 'Clean Process Campus', brandClass: 'orionis', logoMark: 'O',
      slogan: 'Clean flow. Precise parts.', specialties: ['Ventilbuchsen','Pumpengehäuse','Edelstahlteile'],
      playStyle: 'Saubere Prozesse · qualitätssensibel', preferredParts: ['turn-valve','turn-flange','mill-pump'], partBias: 4,
      rushAffinity: 0.7,
      qty: [20, 44], rewardPerPart: [190, 265], duration: [128, 204], deadline: [40, 68],
      difficulty: [3, 5], lifetime: [2520, 4320], followUpChance: 0.32
    },
    {
      key: 'series', customer: 'Kaeldor Components', label: 'Serienkunde', weight: 21,
      sector: 'Luftfahrt & Präzisionskomponenten', district: 'Aero Industrial Park', brandClass: 'kaeldor', logoMark: 'K',
      slogan: 'Built light. Built exact.', specialties: ['Spannprismen','Leichtbauteile','Serienkomponenten'],
      playStyle: 'Hohe Präzision · anspruchsvolle Teile', preferredParts: ['mill-prism','mill-plate','turn-sleeve'], partBias: 3,
      rushAffinity: 0.55,
      qty: [28, 58], rewardPerPart: [175, 245], duration: [142, 220], deadline: [54, 88],
      difficulty: [4, 5], lifetime: [3360, 5280], followUpChance: 0.30
    },
    {
      key: 'express', customer: 'Asteron Robotics', label: 'Expresskunde', weight: 15,
      sector: 'Robotik & Automation', district: 'Technologiepark', brandClass: 'asteron', logoMark: 'A',
      slogan: 'Precision in motion.', specialties: ['Sensorhalter','Robotikbauteile','Eilserien'],
      playStyle: 'Kleine Lose · kurze Termine · Eilaufträge', preferredParts: ['mill-bracket','turn-spacer','turn-flange'], partBias: 4,
      rushAffinity: 2.2,
      qty: [12, 30], rewardPerPart: [225, 310], duration: [82, 136], deadline: [18, 32],
      difficulty: [2, 4], lifetime: [1560, 2640], followUpChance: 0.18
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

  function workingDeadlineAt(startAt, workingHours) {
    let remaining = Math.max(1, finite(workingHours, 1)) * 60;
    let minute = Math.max(0, startAt);
    for (let dayIndex = 0; dayIndex < 366; dayIndex += 1) {
      const date = new Date(GAME_START + Math.floor(minute) * 60000);
      const dayStart = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - GAME_START) / 60000;
      const weekday = date.getUTCDay();
      if (weekday >= 1 && weekday <= 5) {
        const workStart = Math.max(minute, dayStart + 360);
        const worked = Math.min(remaining, Math.max(0, dayStart + 1320 - workStart));
        if (worked > 0) {
          minute = workStart + worked;
          remaining -= worked;
          if (remaining <= 1e-8) return minute;
        }
      }
      minute = dayStart + 1440;
    }
    return Infinity;
  }

  function preserveOrSetDeadline(order, referenceAt) {
    const deadlineAt = Number.isFinite(order.deadlineAt)
      ? order.deadlineAt : workingDeadlineAt(referenceAt, order.deadlineHours);
    const expiresAt = order.isRushOrder && Number.isFinite(order.acceptedRushAt)
      ? order.expiresAt : Math.min(order.expiresAt, deadlineAt - 60);
    return { ...order, deadlineAt, expiresAt, offerLifetimeMinutes: expiresAt - order.createdAt };
  }

  function emptyMarket(now, seed) {
    return {
      version: VERSION,
      initialized: false,
      now,
      available: [],
      pendingFollowUps: [],
      completedCustomers: {},
      customerHistory: {},
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

  function normalizeCustomerHistoryRecord(record, completedFallback = 0) {
    const source = record && typeof record === 'object' && !Array.isArray(record) ? record : {};
    const partCounts = source.partCounts && typeof source.partCounts === 'object' && !Array.isArray(source.partCounts)
      ? Object.fromEntries(Object.entries(source.partCounts)
        .filter(([part,count])=>typeof part === 'string' && part && Number.isFinite(count) && count > 0)
        .map(([part,count])=>[part,Math.max(0,Math.floor(count))]))
      : {};
    const completed = Math.max(Math.floor(finite(source.completed, 0)), Math.floor(finite(completedFallback, 0)));
    return {
      completed,
      onTime: Math.max(0, Math.floor(finite(source.onTime, 0))),
      late: Math.max(0, Math.floor(finite(source.late, 0))),
      revenue: Math.max(0, finite(source.revenue, 0)),
      rushOrders: Math.max(0, Math.floor(finite(source.rushOrders, 0))),
      qualityIssues: Math.max(0, Math.floor(finite(source.qualityIssues, 0))),
      complaints: Math.max(0, Math.floor(finite(source.complaints, 0))),
      partCounts,
      firstCompletedAt: Number.isFinite(source.firstCompletedAt) ? source.firstCompletedAt : null,
      lastCompletedAt: Number.isFinite(source.lastCompletedAt) ? source.lastCompletedAt : null,
      lastPart: typeof source.lastPart === 'string' && source.lastPart ? source.lastPart : null,
      lastOrderId: typeof source.lastOrderId === 'string' && source.lastOrderId ? source.lastOrderId : null,
      lastComplaintOutcome: typeof source.lastComplaintOutcome === 'string' && source.lastComplaintOutcome ? source.lastComplaintOutcome : null
    };
  }

  function customerHistoryRecord(market, customer) {
    const completedFallback = Math.max(0, finite(market.completedCustomers?.[customer], 0));
    const current = normalizeCustomerHistoryRecord(market.customerHistory?.[customer], completedFallback);
    market.customerHistory = market.customerHistory && typeof market.customerHistory === 'object' && !Array.isArray(market.customerHistory)
      ? market.customerHistory : {};
    market.customerHistory[customer] = current;
    return current;
  }

  function relationshipLabel(completed) {
    const count = Math.max(0, Math.floor(finite(completed, 0)));
    if (count >= 10) return 'Langjähriger Stammkunde';
    if (count >= 6) return 'Stammkunde';
    if (count >= 3) return 'Bekannter Kunde';
    if (count >= 1) return 'Wiederkehrender Kunde';
    return 'Neuer Kunde';
  }

  function historySnapshot(customer, record) {
    const normalized = normalizeCustomerHistoryRecord(record, 0);
    const entries = Object.entries(normalized.partCounts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'));
    const trackedDeadlines = normalized.onTime + normalized.late;
    return {
      customer,
      ...normalized,
      relationship: relationshipLabel(normalized.completed),
      topPart: entries[0]?.[0] || null,
      topPartCount: entries[0]?.[1] || 0,
      punctualityPct: trackedDeadlines > 0 ? Math.round(normalized.onTime / trackedDeadlines * 100) : null,
      identity: customerIdentity(customer)
    };
  }

  function normalizeMarket(market, now) {
    const previousVersion = Math.max(0, Math.floor(finite(market.version, 0)));
    market.version = VERSION;
    market.initialized = true;
    market.now = Math.max(0, finite(market.now, now));
    market.available = Array.isArray(market.available)
      ? market.available.filter(validOrder).map(order => preserveOrSetDeadline(previousVersion < 3 ? rebalanceLegacyOffer(order, now) : order, now))
      : [];
    market.pendingFollowUps = Array.isArray(market.pendingFollowUps)
      ? market.pendingFollowUps.filter(item => item && Number.isFinite(item.readyAt) && validOrder(item.order))
        .map(item => ({ readyAt: item.readyAt, order: preserveOrSetDeadline(previousVersion < 3 ? rebalanceLegacyOffer(item.order, now) : item.order, item.readyAt) }))
      : [];
    market.completedCustomers = market.completedCustomers && typeof market.completedCustomers === 'object' && !Array.isArray(market.completedCustomers)
      ? market.completedCustomers
      : {};
    market.customerHistory = market.customerHistory && typeof market.customerHistory === 'object' && !Array.isArray(market.customerHistory)
      ? market.customerHistory
      : {};
    for (const [customer,count] of Object.entries(market.completedCustomers)) {
      market.customerHistory[customer] = normalizeCustomerHistoryRecord(market.customerHistory[customer], count);
    }
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

  function changeReputation(state, customer, delta) {
    const reputation = ensureReputation(state);
    if (!Object.hasOwn(reputation, customer)) return null;
    reputation[customer] = clamp(Math.round(reputation[customer] + delta), 0, 100);
    return reputation[customer];
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

  function choosePart(market, kind, requestedPartKey, profile = null) {
    if (requestedPartKey) {
      const requested = parts.find(part => part.key === requestedPartKey && part.kind === kind);
      if (requested) return requested;
    }
    const used = new Set(market.available.filter(order => order.kind === kind).map(order => order.partKey));
    let candidates = parts.filter(part => part.kind === kind && !used.has(part.key));
    if (!candidates.length) candidates = parts.filter(part => part.kind === kind);

    const preferred = new Set(Array.isArray(profile?.preferredParts) ? profile.preferredParts : []);
    const preferredCandidates = candidates.filter(part => preferred.has(part.key));
    if (preferredCandidates.length && random(market) < 0.72) {
      return preferredCandidates[integer(market, 0, preferredCandidates.length - 1)];
    }

    const weighted = candidates.map(part => ({
      part,
      weight: preferred.has(part.key) ? Math.max(1, finite(profile?.partBias, 2)) : 1
    }));
    const total = weighted.reduce((sum,item)=>sum+item.weight,0);
    let draw=random(market)*total;
    for(const item of weighted){
      draw-=item.weight;
      if(draw<0)return item.part;
    }
    return weighted[weighted.length-1].part;
  }

  function addGeneratedOffer(state, createdAt, overrides) {
    const market = state.orderMarket;
    const opts = overrides && typeof overrides === 'object' ? overrides : {};
    if (market.available.length >= MAX_OFFERS && !opts.defer) return null;

    const kind = isValidKind(opts.kind) ? opts.kind : chooseKind(market);
    const profile = profiles.find(item => item.key === opts.profileKey) || chooseProfile(market);
    const part = choosePart(market, kind, opts.partKey, profile);
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
    const deadlineAt = workingDeadlineAt(createdAt, deadlineHours);
    const expiresAt = Math.min(createdAt + lifetime, deadlineAt - 60);
    const isFollowUp = !!opts.isFollowUp;
    const partSuffix = String(number).padStart(4, '0');
    const partName = isFollowUp ? `${part.name} · Folgeauftrag ${partSuffix}` : `${part.name} ${partSuffix}`;
    const order = {
      id,
      customer: profile.customer,
      customerType: profile.label,
      customerProfile: profile.key,
      customerSector: profile.sector,
      customerBrandClass: profile.brandClass,
      customerPlayStyle: profile.playStyle,
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
      deadlineAt,
      difficulty,
      createdAt,
      expiresAt,
      offerLifetimeMinutes: expiresAt - createdAt,
      followUpChance: profile.followUpChance,
      isFollowUp,
      parentOrderId: typeof opts.parentOrderId === 'string' ? opts.parentOrderId : null
    };
    if (!opts.defer) market.available.push(order);
    return order;
  }

  function expireAt(state, at) {
    const market = state.orderMarket;
    const expired = market.available.filter(order => order.expiresAt <= at);
    market.available = market.available.filter(order => order.expiresAt > at);
    expired.filter(order => order.isRushOrder).forEach(order => changeReputation(state, order.customer, -6));
    return expired.length;
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
      order.deadlineAt = workingDeadlineAt(at, order.deadlineHours);
      order.expiresAt = Math.min(at + Math.max(60, finite(order.offerLifetimeMinutes, 720)), order.deadlineAt - 60);
      order.offerLifetimeMinutes = order.expiresAt - at;
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
      expireAt(state, market.now);
      activateDueFollowUps(state, market.now);
      if (market.nextRefreshAt <= market.now) {
        if (market.available.length < MAX_OFFERS) addGeneratedOffer(state, market.now);
        market.nextRefreshAt = market.now + integer(market, REFRESH_MINUTES[0], REFRESH_MINUTES[1]);
      }
      fillMinimum(state, market.now);
    }

    market.now = target;
    expireAt(state, target);
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

  function createRushOrder(state, compatibleKinds) {
    const market = ensureMarket(state);
    if (market.available.length >= MAX_OFFERS) return null;
    const kinds = Array.isArray(compatibleKinds) ? compatibleKinds.filter(isValidKind) : [];
    if (!kinds.length) return null;

    const eligible = profiles.filter(profile => finite(market.completedCustomers[profile.customer], 0) > 0);
    if (!eligible.length) return null;
    const weighted = eligible.map(profile => {
      const completed = finite(market.completedCustomers[profile.customer], 0);
      const reputation = ensureReputation(state)[profile.customer];
      return { profile, weight: Math.max(1, completed) * (0.5 + reputation / 100) * Math.max(0.25, finite(profile.rushAffinity, 1)) };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    let draw = random(market) * totalWeight;
    let profile = weighted[weighted.length - 1].profile;
    for (const item of weighted) {
      draw -= item.weight;
      if (draw < 0) {
        profile = item.profile;
        break;
      }
    }
    const kind = kinds[integer(market, 0, kinds.length - 1)];
    const order = addGeneratedOffer(state, market.now, { kind, profileKey: profile.key, defer: true });
    if (!order) return null;

    const rushBonusPct = 20;
    const reward = Math.round(order.reward * (1 + rushBonusPct / 100) / 100) * 100;
    const offerLifetimeMinutes = 24 * 60;
    const baseDeadlineHours = order.deadlineHours;
    const deadlineHours = Math.max(8, Math.round(baseDeadlineHours * 0.6));
    const deadlineAt = workingDeadlineAt(market.now, deadlineHours);
    const expiresAt = Math.min(market.now + offerLifetimeMinutes, deadlineAt - 60);
    return {
      ...order,
      reward,
      baseReward: order.reward,
      rushBonus: reward - order.reward,
      rushBonusPct,
      baseDeadlineHours,
      deadlineHours,
      deadlineAt,
      offerLifetimeMinutes: expiresAt - market.now,
      expiresAt,
      isRushOrder: true
    };
  }

  function acceptRushOffer(state, order) {
    const market = ensureMarket(state);
    if (!order || !order.isRushOrder || !validOrder(order) || order.expiresAt <= market.now ||
      market.available.length >= MAX_OFFERS || market.available.some(item => item.id === order.id)) return null;
    const accepted = { ...order };
    market.available.push(accepted);
    return { ...accepted };
  }

  function recordRushDecision(state, order, accepted) {
    if (!order || !order.isRushOrder || typeof order.customer !== 'string') return null;
    return changeReputation(state, order.customer, accepted ? 6 : -10);
  }

  function withdrawRushOffer(state, orderId) {
    const market = ensureMarket(state);
    const index = market.available.findIndex(order => order.id === orderId &&
      order.isRushOrder && Number.isFinite(order.acceptedRushAt));
    if (index < 0) return null;
    const [order] = market.available.splice(index, 1);
    // The original +6 for accepting is reversed, then the usual -10 for declining applies.
    changeReputation(state, order.customer, -16);
    return { ...order };
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
    const history = customerHistoryRecord(market, customer);
    history.completed = market.completedCustomers[customer];
    if (options.late) history.late += 1; else history.onTime += 1;
    const realizedRevenue = Number.isFinite(options.payout) ? Math.max(0, options.payout) : Math.max(0, finite(order.reward, 0));
    history.revenue += realizedRevenue;
    if (order.isRushOrder) history.rushOrders += 1;
    if (Math.max(0, Math.floor(finite(options.qualityDefectParts, 0))) > 0) history.qualityIssues += 1;
    if (typeof order.part === 'string' && order.part) {
      history.partCounts[order.part] = Math.max(0, finite(history.partCounts[order.part], 0)) + 1;
      history.lastPart = order.part;
    }
    history.firstCompletedAt = Number.isFinite(history.firstCompletedAt) ? history.firstCompletedAt : market.now;
    history.lastCompletedAt = market.now;
    history.lastOrderId = order.id;
    changeReputation(state,customer,order.isRushOrder?(options.late?-12:8):(options.late?-6:4));

    const profile = profiles.find(item => item.key === order.customerProfile) ||
      profiles.find(item => item.customer === customer);
    const chance = clamp(finite(order.followUpChance, profile ? profile.followUpChance : 0.18) +
      ((ensureReputation(state)[customer] ?? 50) - 50) * .004, 0, 1);
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

  function recordComplaint(state, customer, outcome = null) {
    const market = ensureMarket(state);
    if (typeof customer !== 'string' || !customer) return null;
    const history = customerHistoryRecord(market, customer);
    history.complaints += 1;
    history.lastComplaintOutcome = typeof outcome === 'string' && outcome ? outcome : null;
    return historySnapshot(customer, history);
  }

  function customerIdentity(customer) {
    const profile = profiles.find(item => item.customer === customer);
    if (!profile) return {
      customer: typeof customer === 'string' && customer ? customer : 'Unbekannter Kunde',
      sector: 'Industrie',
      district: 'Gewerbegebiet',
      brandClass: 'generic',
      logoMark: '?',
      slogan: 'Industrial partner',
      playStyle: 'Allgemeine Industrie',
      specialties: []
    };
    return {
      customer: profile.customer,
      sector: profile.sector,
      district: profile.district,
      brandClass: profile.brandClass,
      logoMark: profile.logoMark,
      slogan: profile.slogan,
      playStyle: profile.playStyle,
      specialties: [...profile.specialties]
    };
  }

  function getCustomerHistory(state) {
    const market = ensureMarket(state);
    const names = new Set([
      ...profiles.map(profile=>profile.customer),
      ...Object.keys(market.completedCustomers || {}),
      ...Object.keys(market.customerHistory || {})
    ]);
    return Object.fromEntries([...names].map(customer=>[
      customer,
      historySnapshot(customer, customerHistoryRecord(market, customer))
    ]));
  }

  return Object.freeze({
    init,
    tick,
    getAvailable,
    accept,
    createRushOrder,
    acceptRushOffer,
    recordRushDecision,
    withdrawRushOffer,
    onCompleted,
    recordComplaint,
    getCustomerHistory,
    getCustomerIdentity: customer => customerIdentity(customer),
    adjustReputation: (state, customer, delta) => changeReputation(state, customer, delta),
    getReputation: state => ({ ...ensureReputation(state) }),
    limits: Object.freeze({ minOffers: MIN_OFFERS, startOffers: START_OFFERS, maxOffers: MAX_OFFERS })
  });
});

(function attachFactorySituations(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.factorySituations = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createFactorySituations() {
  'use strict';

  const VERSION = 1;
  const DAY = 1440;
  const MAX_EVENTS_PER_TICK = 10000;
  const SPECIALTIES = Object.freeze([
    { id: 'complex-route', label: 'Komplexe Route', description: 'Drehen und Fräsen mit zusätzlicher Qualitätsprüfung.', route: ['turning', 'milling', 'quality'], durationFactor: 1.18 },
    { id: 'precision', label: 'Präzisionsprüfung', description: 'Enge Toleranzen erfordern eine sorgfältige Qualitätsprüfung.', qualityRisk: 0.12, durationFactor: 1.1 },
    { id: 'small-lots', label: 'Kleine Lose', description: 'Die Lieferung erfolgt in mehreren kleinen Losen.', batchMode: 'small', interruptionSensitivity: 0.78 },
    { id: 'short-deadline', label: 'Kurze Frist', description: 'Der Kunde erwartet eine beschleunigte Lieferung.', deadlineFactor: 0.72, rush: true },
    { id: 'missing-machine', label: 'Fehlende Maschine', description: 'Ein Arbeitsschritt benötigt eine Maschine, die nicht in der Standardroute liegt.', requiresExternalCapability: true },
    { id: 'material-sensitive', label: 'Materialpreisrisiko', description: 'Der Auftrag reagiert besonders auf Änderungen des Materialpreises.', materialSensitivity: 0.8 },
    { id: 'first-article', label: 'Erstmusterfreigabe', description: 'Vor der Serie ist ein zusätzliches Erstmuster freizugeben.', firstArticle: true, durationFactor: 1.08 }
  ]);

  const SITUATIONS = Object.freeze([
    { type: 'material-price-spike', label: 'Materialpreissprung', description: 'Beschaffungspreise für Rohmaterial steigen vorübergehend.', effects: { materialCostFactor: 1.18, warning: 'Materialpreise sind erhöht.' } },
    { type: 'tooling-shortage', label: 'Werkzeugengpass', description: 'Ein Engpass bei Werkzeugen verlängert die Bearbeitung und senkt die verfügbare Kapazität.', effects: { durationFactor: 1.12, capacityFactor: 0.88, warning: 'Werkzeugverfügbarkeit ist eingeschränkt.' } },
    { type: 'demand-boom', label: 'Nachfrageboom', description: 'Die Nachfrage nach kurzfristigen Fertigungskapazitäten steigt.', effects: { demandFactor: 1.16, warning: 'Zusätzliche Nachfrage ist zu erwarten.' } },
    { type: 'staff-absence', label: 'Personalausfall', description: 'Ein kurzfristiger Personalausfall verringert die verfügbare Betriebskapazität.', effects: { capacityFactor: 0.86, durationFactor: 1.08, warning: 'Die verfügbare Personalkapazität ist reduziert.' } }
  ]);

  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const integer = (rng, min, max) => min + Math.floor(random(rng) * (max - min + 1));

  function toSeed(value) {
    if (typeof value === 'string') {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0 || 0x6d2b79f5;
    }
    return (Number.isFinite(value) ? Math.floor(value) >>> 0 : 0) || 0x6d2b79f5;
  }

  function freshSeed() {
    return toSeed(Math.floor(Math.random() * 0xffffffff));
  }

  function random(situations) {
    situations.randomState = (situations.randomState + 0x6d2b79f5) >>> 0;
    let value = situations.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function normalizeSituation(item) {
    const template = SITUATIONS.find(entry => entry.type === item?.type);
    if (!template || typeof item.id !== 'string' || !Number.isFinite(item.startAtMinute) || !Number.isFinite(item.endAtMinute) || item.endAtMinute <= item.startAtMinute) return null;
    const status = ['scheduled', 'active', 'ended'].includes(item.status) ? item.status : 'scheduled';
    return {
      ...item,
      type: template.type,
      label: typeof item.label === 'string' ? item.label : template.label,
      description: typeof item.description === 'string' ? item.description : template.description,
      effects: { ...template.effects },
      status
    };
  }

  function ensureState(state, options = {}) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('factorySituations expects a mutable game state object.');
    const now = Math.max(0, finite(state.gameMinutes, finite(options.now, 0)));
    const fresh = !state.factorySituations || typeof state.factorySituations !== 'object' || Array.isArray(state.factorySituations);
    if (fresh) {
      state.factorySituations = {
        version: VERSION,
        randomState: options.seed === undefined ? freshSeed() : toSeed(options.seed),
        nextSpecialOrderNumber: 1,
        nextSituationNumber: 1,
        nextSituationCheckAtMinute: now + DAY,
        lastTickAtMinute: now,
        scheduled: [],
        active: [],
        history: []
      };
    }
    const data = state.factorySituations;
    data.version = VERSION;
    data.randomState = toSeed(data.randomState === undefined ? (options.seed === undefined ? freshSeed() : options.seed) : data.randomState);
    data.nextSpecialOrderNumber = Math.max(1, Math.floor(finite(data.nextSpecialOrderNumber, 1)));
    data.nextSituationNumber = Math.max(1, Math.floor(finite(data.nextSituationNumber, 1)));
    data.lastTickAtMinute = Math.max(0, finite(data.lastTickAtMinute, now));
    data.nextSituationCheckAtMinute = Math.max(0, finite(data.nextSituationCheckAtMinute, now + DAY));
    data.scheduled = (Array.isArray(data.scheduled) ? data.scheduled : []).map(normalizeSituation).filter(Boolean).filter(item => item.status === 'scheduled');
    data.active = (Array.isArray(data.active) ? data.active : []).map(normalizeSituation).filter(Boolean).filter(item => item.status === 'active');
    data.history = (Array.isArray(data.history) ? data.history : []).map(normalizeSituation).filter(Boolean).filter(item => item.status === 'ended').slice(-200);
    return data;
  }

  function profileInfo(customerProfile) {
    const profile = asObject(customerProfile);
    const text = [profile.key, profile.type, profile.customerType, profile.customer, profile.label, profile.sector, profile.playStyle]
      .filter(value => typeof value === 'string').join(' ').toLowerCase();
    let key = 'standard';
    if (/asteron|express|robot|eil/.test(text)) key = 'express';
    else if (/kaeldor|serie|luftfahrt|präzision|precision/.test(text)) key = 'precision';
    else if (/orionis|premium|fluid|pharma|qualität|quality/.test(text)) key = 'premium';
    else if (/veltraxis|standard|automobil|mobilität/.test(text)) key = 'standard';
    const known = {
      standard: { customer: 'Veltraxis Mobility', profileKey: 'standard', qty: [36, 72], reward: [150, 210], duration: [90, 150], deadline: [48, 84], difficulty: 2, preferred: ['complex-route', 'small-lots', 'material-sensitive', 'first-article'] },
      premium: { customer: 'Orionis Fluidics', profileKey: 'premium', qty: [18, 42], reward: [220, 310], duration: [120, 195], deadline: [36, 68], difficulty: 4, preferred: ['precision', 'first-article', 'complex-route', 'short-deadline'] },
      precision: { customer: 'Kaeldor Components', profileKey: 'series', qty: [24, 54], reward: [205, 295], duration: [135, 210], deadline: [48, 84], difficulty: 5, preferred: ['precision', 'complex-route', 'first-article', 'missing-machine'] },
      express: { customer: 'Asteron Robotics', profileKey: 'express', qty: [10, 28], reward: [260, 360], duration: [75, 125], deadline: [18, 36], difficulty: 3, preferred: ['short-deadline', 'small-lots', 'missing-machine', 'complex-route'] }
    }[key];
    return { ...known, ...profile, profileKey: known.profileKey, customer: typeof profile.customer === 'string' ? profile.customer : known.customer,
      qty: known.qty, reward: known.reward, duration: known.duration, deadline: known.deadline, difficulty: known.difficulty, preferred: known.preferred };
  }

  function generateSpecialOrder(state, customerProfile, options = {}) {
    const data = ensureState(state, options);
    const profile = profileInfo(customerProfile);
    const now = Math.max(0, finite(options.atMinute, finite(state.gameMinutes, 0)));
    const id = `FS-ORDER-${String(data.nextSpecialOrderNumber).padStart(4, '0')}`;
    data.nextSpecialOrderNumber += 1;
    const catalog = SPECIALTIES.map(item => item.id);
    const count = integer(data, 2, 3);
    const chosen = [];
    const preferred = profile.preferred.filter(idValue => catalog.includes(idValue));
    while (chosen.length < count) {
      const pool = preferred.filter(idValue => !chosen.includes(idValue));
      const usePreferred = pool.length && random(data) < (profile.profileKey === 'standard' ? 0.58 : 0.76);
      const candidates = usePreferred ? pool : catalog.filter(idValue => !chosen.includes(idValue));
      chosen.push(candidates[integer(data, 0, candidates.length - 1)]);
    }
    const mechanics = chosen.map(idValue => {
      const item = SPECIALTIES.find(entry => entry.id === idValue);
      const copy = { ...item };
      if (item.route) copy.route = [...item.route];
      return copy;
    });
    const qty = integer(data, profile.qty[0], profile.qty[1]);
    const duration = integer(data, profile.duration[0], profile.duration[1]);
    const deadlineHours = integer(data, profile.deadline[0], profile.deadline[1]);
    const operation = random(data) < 0.5 ? 'Drehen' : 'Fräsen';
    const routeTypes = mechanics.find(item => item.route)?.route;
    const routing = routeTypes
      ? routeTypes.map((type, index) => ({ id: `${id}-step-${index + 1}`, type, requiredMachineKind: type === 'turning' ? 'Drehen' : type === 'milling' ? 'Fräsen' : null, status: index === 0 ? 'queued' : 'blocked' }))
      : [{ id: `${id}-step-1`, type: operation === 'Drehen' ? 'turning' : 'milling', requiredMachineKind: operation, status: 'queued' }];
    return {
      id,
      customer: profile.customer,
      customerProfile: profile.profileKey,
      customerSector: typeof profile.sector === 'string' ? profile.sector : null,
      kind: operation,
      part: operation === 'Drehen' ? 'Spezialwelle' : 'Präzisionshalter',
      partKey: operation === 'Drehen' ? 'turn-special-shaft' : 'mill-special-bracket',
      qty,
      duration,
      reward: qty * integer(data, profile.reward[0], profile.reward[1]),
      deadlineHours,
      materialType: operation === 'Drehen' ? 'steel42crmo4' : 'aluminium6082',
      materialAmountKg: Number((qty * (operation === 'Drehen' ? 1.4 : 1.1)).toFixed(2)),
      createdAtMinute: now,
      specialOrder: true,
      difficulty: clamp(profile.difficulty + Math.max(0, count - 2), 1, 5),
      mechanics,
      mechanicIds: [...chosen],
      explanation: mechanics.map(item => item.description),
      routing,
      batchMode: mechanics.some(item => item.batchMode === 'small') ? 'small' : 'auto',
      interruptionSensitivity: mechanics.some(item => item.id === 'small-lots') ? 0.78 : 0.42,
      modifiers: []
    };
  }

  function eventTemplate(type) {
    return SITUATIONS.find(item => item.type === type);
  }

  function createSituation(data, startAtMinute, options) {
    const template = SITUATIONS[integer(data, 0, SITUATIONS.length - 1)];
    const minDays = Math.max(3, Math.floor(finite(options.minimumDurationDays, 4)));
    const maxDays = Math.max(minDays, Math.floor(finite(options.maximumDurationDays, 8)));
    const durationDays = integer(data, minDays, maxDays);
    const id = `FS-EVENT-${String(data.nextSituationNumber).padStart(4, '0')}`;
    data.nextSituationNumber += 1;
    return {
      id, type: template.type, label: template.label, description: template.description,
      status: 'scheduled', scheduledAtMinute: startAtMinute - 360, startAtMinute,
      endAtMinute: startAtMinute + durationDays * DAY, durationMinutes: durationDays * DAY,
      effects: { ...template.effects }, preview: true
    };
  }

  function transitionEvents(data, minute) {
    const stillScheduled = [];
    for (const event of data.scheduled) {
      if (minute >= event.startAtMinute) {
        event.status = 'active';
        event.preview = false;
        data.active.push(event);
      } else stillScheduled.push(event);
    }
    data.scheduled = stillScheduled;
    const stillActive = [];
    for (const event of data.active) {
      if (minute >= event.endAtMinute) {
        event.status = 'ended';
        event.endedAtMinute = event.endAtMinute;
        data.history.push(event);
      } else stillActive.push(event);
    }
    data.active = stillActive;
    if (data.history.length > 200) data.history.splice(0, data.history.length - 200);
  }

  function tick(state, absoluteGameMinutes, context = {}) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('factorySituations expects a mutable game state object.');
    if (!Number.isFinite(absoluteGameMinutes) || absoluteGameMinutes < 0) return { ok: false, code: 'INVALID_GAME_MINUTE' };
    if (state.factorySituations && Number.isFinite(state.factorySituations.lastTickAtMinute) && absoluteGameMinutes < state.factorySituations.lastTickAtMinute) {
      return { ok: false, code: 'TIME_REVERSED' };
    }
    const data = ensureState(state, context);
    if (absoluteGameMinutes < data.lastTickAtMinute) return { ok: false, code: 'TIME_REVERSED' };
    const target = absoluteGameMinutes;
    const chance = clamp(finite(context.situationChancePerDay, 0.025), 0, 0.1);
    let processed = 0;
    while (data.nextSituationCheckAtMinute <= target && processed < MAX_EVENTS_PER_TICK) {
      const checkAt = data.nextSituationCheckAtMinute;
      transitionEvents(data, checkAt);
      if (!data.active.length && !data.scheduled.length && random(data) < chance) {
        const lead = Math.max(0, finite(context.previewLeadMinutes, 360));
        data.scheduled.push(createSituation(data, checkAt + lead, context));
      }
      data.nextSituationCheckAtMinute += DAY;
      processed += 1;
    }
    transitionEvents(data, target);
    data.lastTickAtMinute = target;
    return { ok: true, processedChecks: processed, active: data.active.length, scheduled: data.scheduled.length };
  }

  function getActiveModifiers(state, atMinute) {
    const data = ensureState(state);
    const minute = finite(atMinute, finite(state.gameMinutes, 0));
    const events = [...data.scheduled, ...data.active].filter(event => event.startAtMinute <= minute && minute < event.endAtMinute);
    return events.map(event => ({
      id: event.id,
      type: event.type,
      label: event.label,
      description: event.description,
      startAtMinute: event.startAtMinute,
      endAtMinute: event.endAtMinute,
      effects: { ...event.effects },
      warning: event.effects.warning
    }));
  }

  function applyModifiers(order, modifiers) {
    if (!order || typeof order !== 'object' || Array.isArray(order)) return { ok: false, code: 'INVALID_ORDER' };
    const copy = { ...order };
    const safeModifiers = (Array.isArray(modifiers) ? modifiers : []).filter(item => item && typeof item === 'object' && !Array.isArray(item));
    const recognized = safeModifiers.filter(item => eventTemplate(item.type) && item.effects && typeof item.effects === 'object');
    const result = { materialCostFactor: 1, durationFactor: 1, capacityFactor: 1, demandFactor: 1, warnings: [] };
    const ids = [];
    for (const modifier of recognized) {
      ids.push(typeof modifier.id === 'string' ? modifier.id : modifier.type);
      const effect = modifier.effects;
      result.materialCostFactor *= clamp(finite(effect.materialCostFactor, 1), 0.8, 1.25);
      result.durationFactor *= clamp(finite(effect.durationFactor, 1), 0.85, 1.2);
      result.capacityFactor *= clamp(finite(effect.capacityFactor, 1), 0.8, 1.1);
      result.demandFactor *= clamp(finite(effect.demandFactor, 1), 0.85, 1.2);
      if (typeof effect.warning === 'string' && effect.warning) result.warnings.push(effect.warning);
    }
    result.materialCostFactor = clamp(result.materialCostFactor, 0.8, 1.3);
    result.durationFactor = clamp(result.durationFactor, 0.8, 1.3);
    result.capacityFactor = clamp(result.capacityFactor, 0.75, 1.1);
    result.demandFactor = clamp(result.demandFactor, 0.8, 1.3);
    copy.activeSituationModifierIds = ids;
    copy.situationEffects = result;
    return copy;
  }

  function getSnapshot(state, atMinute) {
    const data = ensureState(state);
    const minute = finite(atMinute, finite(state.gameMinutes, 0));
    const toView = event => ({
      id: event.id, type: event.type, label: event.label, description: event.description,
      status: event.status, startAtMinute: event.startAtMinute, endAtMinute: event.endAtMinute,
      durationMinutes: event.durationMinutes,
      remainingMinutes: event.status === 'active' ? Math.max(0, event.endAtMinute - minute) : Math.max(0, event.endAtMinute - Math.max(minute, event.startAtMinute)),
      startsInMinutes: event.status === 'scheduled' ? Math.max(0, event.startAtMinute - minute) : 0,
      preview: event.status === 'scheduled', effects: { ...event.effects }, warning: event.effects.warning
    });
    return {
      version: data.version,
      atMinute: minute,
      scheduled: data.scheduled.filter(event => event.endAtMinute > minute).map(toView),
      active: data.active.filter(event => event.startAtMinute <= minute && minute < event.endAtMinute).map(toView),
      history: data.history.slice(-20).map(toView),
      modifiers: getActiveModifiers(state, minute),
      nextSituationCheckAtMinute: data.nextSituationCheckAtMinute
    };
  }

  return Object.freeze({
    ensureState,
    generateSpecialOrder,
    tick,
    getActiveModifiers,
    applyModifiers,
    getSnapshot,
    catalogs: Object.freeze({ specialties: SPECIALTIES, situations: SITUATIONS })
  });
});

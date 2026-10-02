(function attachCustomerProjects(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.customerProjects = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCustomerProjects() {
  'use strict';

  const VERSION = 1;
  // Every project branch roll is clamped to this documented interval.
  const PROBABILITY_MIN = 0.15;
  const PROBABILITY_MAX = 0.85;
  const BASE_SUCCESS_CHANCE = 0.65;
  const SIZE_CONFIG = Object.freeze({
    small: { quantity: 24, expectedProfit: 7200, risk: 0.18, autoMinutes: 360, decisions: 0 },
    medium: { quantity: 80, expectedProfit: 26000, risk: 0.32, autoMinutes: 0, decisions: 1 },
    large: { quantity: 240, expectedProfit: 88000, risk: 0.48, autoMinutes: 0, decisions: 2 }
  });

  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const copy = value => JSON.parse(JSON.stringify(value));
  const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

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

  function random(data) {
    data.randomState = (data.randomState + 0x6d2b79f5) >>> 0;
    let value = data.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  function normalizeProject(project) {
    if (!isRecord(project) || typeof project.id !== 'string' || typeof project.customer !== 'string') return null;
    const phases = Array.isArray(project.phases) ? project.phases.filter(phase =>
      isRecord(phase) && typeof phase.id === 'string' && typeof phase.name === 'string'
    ) : [];
    return {
      ...project,
      size: SIZE_CONFIG[project.size] ? project.size : 'medium',
      status: ['active', 'completed', 'failed'].includes(project.status) ? project.status : 'active',
      phases,
      decisions: Array.isArray(project.decisions) ? project.decisions.filter(isRecord) : [],
      currentPhaseId: typeof project.currentPhaseId === 'string' ? project.currentPhaseId : null,
      availableDecision: isRecord(project.availableDecision) ? project.availableDecision : null,
      metrics: isRecord(project.metrics) ? project.metrics : { quantity: 0, expectedProfit: 0, risk: 0, relationship: 0 },
      createdAtMinute: Math.max(0, finite(project.createdAtMinute, 0))
    };
  }

  function ensureState(state, options = {}) {
    if (!isRecord(state)) return null;
    const existing = isRecord(state.customerProjects) ? state.customerProjects : {};
    const projects = Array.isArray(existing.projects) ? existing.projects.map(normalizeProject).filter(Boolean) : [];
    const decisions = Array.isArray(existing.decisions) ? existing.decisions.filter(isRecord) : [];
    const randomState = existing.randomState === undefined || existing.randomState === null
      ? (options.seed ?? 1)
      : existing.randomState;
    state.customerProjects = {
      ...existing,
      version: VERSION,
      projects,
      decisions,
      nextProjectNumber: Math.max(1, Math.floor(finite(existing.nextProjectNumber, 1))),
      randomState: toSeed(randomState),
      now: Math.max(0, finite(existing.now, finite(state.gameMinutes, 0)))
    };
    return state.customerProjects;
  }

  function phase(id, name, status, visible, extra = {}) {
    return { id, name, status, visible, startedAtMinute: null, completedAtMinute: null, ...extra };
  }

  function create(state, customerProfile, options = {}) {
    const data = ensureState(state, options);
    if (!data) return { ok: false, code: 'invalid-state' };
    if (!isRecord(customerProfile)) return { ok: false, code: 'invalid-customer-profile' };
    const customer = customerProfile.customer || customerProfile.name;
    if (typeof customer !== 'string' || !customer.trim()) return { ok: false, code: 'invalid-customer-profile' };
    const size = SIZE_CONFIG[options.size] ? options.size : 'medium';
    const config = SIZE_CONFIG[size];
    const now = Math.max(data.now, finite(options.atMinute, finite(state.gameMinutes, 0)));
    const id = `CP-${String(data.nextProjectNumber).padStart(4, '0')}`;
    const reputation = clamp(finite(customerProfile.reputation ?? customerProfile.reputationScore, 50), 0, 100);
    const project = {
      id, customer: customer.trim(), customerProfile: copy(customerProfile),
      sector: customerProfile.sector || customerProfile.industry || null,
      playStyle: customerProfile.playStyle || customerProfile.playstyle || null,
      size, status: 'active', phaseStatus: 'active', currentPhaseId: 'prototype',
      createdAtMinute: now, completedAtMinute: null,
      phases: [
        phase('prototype', 'Prototyp', 'active', true, { startedAtMinute: now }),
        phase('pilot', 'Vorserie', 'locked', true),
        phase('series', 'Serie', 'locked', true)
      ],
      availableDecision: null, decisions: [],
      metrics: { quantity: config.quantity, expectedProfit: config.expectedProfit, risk: config.risk, relationship: 0 },
      reputationAtStart: reputation,
      autoMinutes: config.autoMinutes,
      decisionCount: 0,
      phaseResults: []
    };
    data.nextProjectNumber += 1;
    data.projects.push(project);
    data.now = now;
    return copy(project);
  }

  function findProject(state, projectId) {
    const data = state.customerProjects;
    return data && data.projects.find(project => project.id === projectId) || null;
  }

  function getById(state, projectId) {
    const project = findProject(state, projectId);
    return project ? copy(project) : null;
  }

  function decisionFor(project) {
    const large = project.size === 'large';
    const first = project.currentPhaseId === 'prototype';
    if (project.size === 'small' || project.currentPhaseId === 'series') return null;
    if (first) return {
      id: `decision-${project.id}-prototype`, phaseId: 'prototype',
      prompt: 'Wie soll die Vorserie vorbereitet werden?',
      options: [
        { id: 'steady-pilot', label: 'Planbare Vorserie', description: 'Eine kompakte Vorserie hält Termin- und Qualitätsrisiko niedrig; Menge und erwartete Marge wachsen moderat.', effects: { quantity: 1.1, profit: 1.08, risk: -0.06, relationship: 2 } },
        { id: 'ambitious-pilot', label: 'Vorserie ausweiten', description: 'Mehr Teile und Marge, verbunden mit höherem Termin- und Qualitätsrisiko.', effects: { quantity: 1.35, profit: 1.22, risk: 0.12, relationship: 1 } }
      ]
    };
    if (large && project.currentPhaseId === 'pilot' && project.decisionCount < 2) return {
      id: `decision-${project.id}-pilot`, phaseId: 'pilot',
      prompt: 'Welchen Weg soll das Serienprojekt nehmen?',
      options: [
        { id: 'steady-series', label: 'Stabile Serie', description: 'Eine kleinere Serie verbessert Planbarkeit und Kundenbeziehung bei solider Marge.', effects: { quantity: 1.1, profit: 1.12, risk: -0.1, relationship: 4 } },
        { id: 'expand-series', label: 'Großserie anbieten', description: 'Deutlich mehr Produktionsmenge und Gewinnchance, aber mehr Termin- und Qualitätsrisiko.', effects: { quantity: 1.7, profit: 1.5, risk: 0.18, relationship: -1 } }
      ]
    };
    return null;
  }

  function getAvailableDecision(state, projectId) {
    const project = findProject(state, projectId);
    if (!project || !project.availableDecision) return null;
    return copy(project.availableDecision);
  }

  function chooseDecision(state, projectId, decisionId, atMinute) {
    const project = findProject(state, projectId);
    if (!project) return { ok: false, code: 'unknown-project' };
    const available = project.availableDecision;
    if (!available) return { ok: false, code: 'decision-not-available' };
    const minute = finite(atMinute, NaN);
    const data = state.customerProjects;
    const earliestMinute = Math.max(finite(available.availableAtMinute, project.createdAtMinute), finite(data.now, project.createdAtMinute));
    if (!Number.isFinite(minute) || minute < earliestMinute) return { ok: false, code: 'invalid-time' };
    const chosen = available.options.find(item => item.id === decisionId);
    if (!chosen) return { ok: false, code: 'unknown-decision-option' };
    const effects = chosen.effects;
    const descriptor = {
      decisionId: available.id, optionId: chosen.id, label: chosen.label,
      quantityBefore: project.metrics.quantity,
      expectedProfitBefore: project.metrics.expectedProfit,
      riskBefore: project.metrics.risk,
      relationshipBefore: project.metrics.relationship,
      effects: copy(effects), atMinute: minute
    };
    project.metrics.quantity = Math.round(project.metrics.quantity * effects.quantity);
    project.metrics.expectedProfit = Math.round(project.metrics.expectedProfit * effects.profit);
    project.metrics.risk = clamp(project.metrics.risk + effects.risk, 0, 1);
    project.metrics.relationship = clamp(project.metrics.relationship + effects.relationship, -100, 100);
    descriptor.quantityAfter = project.metrics.quantity;
    descriptor.expectedProfitAfter = project.metrics.expectedProfit;
    descriptor.riskAfter = project.metrics.risk;
    descriptor.relationshipAfter = project.metrics.relationship;
    project.decisions.push(descriptor);
    project.availableDecision = null;
    project.decisionCount += 1;
    const next = project.phases.find(item => item.id === project.currentPhaseId);
    if (next) {
      next.decision = copy(descriptor);
      next.status = 'active';
      next.startedAtMinute = minute;
    }
    data.decisions.push({ projectId, ...copy(descriptor) });
    data.now = Math.max(data.now, minute);
    return { ok: true, project: copy(project), decision: copy(descriptor) };
  }

  function advanceTo(project, phaseId, atMinute) {
    project.currentPhaseId = phaseId;
    const next = project.phases.find(item => item.id === phaseId);
    if (next) {
      next.status = 'active';
      next.startedAtMinute = atMinute;
    }
  }

  function completePhase(state, projectId, phaseId, result = {}, atMinute) {
    const project = findProject(state, projectId);
    if (!project) return { ok: false, code: 'unknown-project' };
    const current = project.phases.find(item => item.id === phaseId);
    if (!current) return { ok: false, code: 'unknown-phase' };
    if (project.status !== 'active' || project.currentPhaseId !== phaseId || current.status !== 'active') return { ok: false, code: 'phase-not-active' };
    if (project.availableDecision) return { ok: false, code: 'decision-required' };
    const minute = finite(atMinute, NaN);
    const data = state.customerProjects;
    const earliestMinute = Math.max(finite(current.startedAtMinute, project.createdAtMinute), finite(data.now, project.createdAtMinute));
    if (!Number.isFinite(minute) || minute < earliestMinute) return { ok: false, code: 'invalid-time' };
    const performance = clamp(finite(result.performance, result.quality === 'good' ? 1 : result.quality === 'poor' ? -1 : 0), -1, 1);
    const goodChance = clamp(BASE_SUCCESS_CHANCE + performance * 0.12 + (project.reputationAtStart - 50) * 0.002, PROBABILITY_MIN, PROBABILITY_MAX);
    const success = random(data) < goodChance;
    const phaseResult = {
      phaseId, completedAtMinute: minute, success,
      quality: success ? 'good' : 'needs-attention',
      probability: goodChance,
      performance,
      qualityDefectParts: Math.max(0, Math.floor(finite(result.qualityDefectParts, 0))),
      late: result.late === true,
      payout: Math.max(0, finite(result.payout, 0)),
      quantity: project.metrics.quantity,
      expectedProfit: project.metrics.expectedProfit,
      risk: project.metrics.risk,
      relationship: project.metrics.relationship
    };
    current.status = 'completed';
    current.completedAtMinute = minute;
    project.phaseResults.push(phaseResult);
    if (success) {
      project.metrics.risk = clamp(project.metrics.risk - 0.025, 0, 1);
      project.metrics.relationship = clamp(project.metrics.relationship + 2, -100, 100);
    } else {
      project.metrics.risk = clamp(project.metrics.risk + 0.05, 0, 1);
      project.metrics.relationship = clamp(project.metrics.relationship - 2, -100, 100);
    }

    if (phaseId === 'series') {
      project.status = 'completed';
      project.phaseStatus = 'completed';
      project.completedAtMinute = minute;
      project.currentPhaseId = null;
    } else {
      const nextId = phaseId === 'prototype' ? 'pilot' : 'series';
      if (phaseId === 'pilot' && project.size === 'large' && success) {
        const branchChance = clamp(0.25 + performance * 0.1, PROBABILITY_MIN, PROBABILITY_MAX);
        phaseResult.branchProbability = branchChance;
        if (random(data) < branchChance) {
          project.phases.splice(project.phases.findIndex(item => item.id === 'series'), 0,
            phase('special-order', 'Sonderauftrag', 'locked', true));
          project.branch = 'special-order';
          phaseResult.branch = 'special-order';
        }
      } else if (phaseId === 'pilot' && project.size === 'large' && !success) {
        const branchChance = clamp(0.35 + project.metrics.risk * 0.2, PROBABILITY_MIN, PROBABILITY_MAX);
        phaseResult.branchProbability = branchChance;
        if (random(data) < branchChance) {
          project.phases.splice(project.phases.findIndex(item => item.id === 'series'), 0,
            phase('revision', 'Änderungswunsch', 'locked', true));
          project.branch = 'revision';
          phaseResult.branch = 'revision';
        }
      }
      const progression = project.phases.filter(item => item.visible || item.id === project.branch);
      const currentIndex = progression.findIndex(item => item.id === phaseId);
      const nextPhase = progression[currentIndex + 1];
      if (nextPhase) {
        if (nextPhase.id === 'pilot' || nextPhase.id === 'series' || nextPhase.id === 'special-order' || nextPhase.id === 'revision') {
          project.availableDecision = decisionFor({ ...project, currentPhaseId: phaseId });
          if (project.size === 'small' || !project.availableDecision) advanceTo(project, nextPhase.id, minute);
          else {
            project.availableDecision.availableAtMinute = minute;
            nextPhase.status = 'available';
            project.currentPhaseId = nextPhase.id;
          }
        } else advanceTo(project, nextPhase.id, minute);
      }
    }
    phaseResult.metricsAfter = copy(project.metrics);
    data.now = Math.max(data.now, minute);
    return { ok: true, project: copy(project), resultDescriptor: copy(phaseResult) };
  }

  function tick(state, absoluteGameMinutes, context = {}) {
    const data = ensureState(state);
    if (!data) return { ok: false, code: 'invalid-state' };
    const minute = finite(absoluteGameMinutes, NaN);
    if (!Number.isFinite(minute) || minute < data.now) return { ok: false, code: 'invalid-time' };
    data.now = minute;
    const completed = [];
    const blockedProjectIds = new Set(Array.isArray(context.blockedProjectIds)
      ? context.blockedProjectIds.filter(id => typeof id === 'string') : []);
    for (const initial of data.projects) {
      let guard = 0;
      while (guard < 3) {
        const project = findProject(state, initial.id);
        if (!project || blockedProjectIds.has(project.id) || project.status !== 'active' || project.size !== 'small' || !project.currentPhaseId) break;
        const current = project.phases.find(item => item.id === project.currentPhaseId);
        if (!current || minute < current.startedAtMinute + project.autoMinutes) break;
        const completionMinute = current.startedAtMinute + project.autoMinutes;
        const targetMinute = data.now;
        data.now = completionMinute;
        const outcome = completePhase(state, project.id, current.id, {}, completionMinute);
        data.now = targetMinute;
        if (!outcome.ok) break;
        completed.push(outcome.resultDescriptor);
        guard += 1;
      }
    }
    return { ok: true, now: data.now, completed };
  }

  return Object.freeze({ ensureState, create, getById, getAvailableDecision, chooseDecision, completePhase, tick,
    limits: Object.freeze({ probabilityMin: PROBABILITY_MIN, probabilityMax: PROBABILITY_MAX, baseSuccessChance: BASE_SUCCESS_CHANCE }) });
});

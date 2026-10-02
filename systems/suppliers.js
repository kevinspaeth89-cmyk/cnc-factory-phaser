/* Suppliers and outsourcing. Pure game-time logic; safe to load in browser or Node. */
(function attachSuppliers(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.suppliers = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createSuppliers() {
  'use strict';

  const VERSION = 2;
  const DAY = 1440;
  const OPERATIONS = new Set(['turning', 'milling', 'quality', 'assembly']);
  const DEFAULT_PROVIDERS = [
    { id: 'supplier-local-machining', name: 'Werkverbund Süd', operations: ['turning', 'milling'], reputationRequired: 0, basePrice: 85, pricePerUnit: 2.4, leadTimeMinutes: 720, qualityRisk: 0.08, reliability: 0.88, known: true },
    { id: 'supplier-precision', name: 'Präzisionstechnik Nord', operations: ['turning', 'milling', 'quality'], reputationRequired: 25, basePrice: 190, pricePerUnit: 4.2, leadTimeMinutes: 1440, qualityRisk: 0.035, reliability: 0.95, known: false },
    { id: 'supplier-assembly', name: 'Montagewerk Rhein', operations: ['assembly', 'quality'], reputationRequired: 45, basePrice: 140, pricePerUnit: 3.1, leadTimeMinutes: 2160, qualityRisk: 0.06, reliability: 0.9, known: false },
    { id: 'supplier-express', name: 'Expressfertigung 24', operations: ['turning', 'milling', 'assembly'], reputationRequired: 70, basePrice: 320, pricePerUnit: 6.8, leadTimeMinutes: 360, qualityRisk: 0.12, reliability: 0.84, known: false }
  ];
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const positive = value => finite(value) && value > 0;
  const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const reputation = state => finite(state?.reputation) ? state.reputation : 0;

  function ensureState(state, options = {}) {
    if (!record(state)) return { ok: false, code: 'invalid_state' };
    const previous = record(state.suppliers) ? state.suppliers : {};
    const saved = new Map((Array.isArray(previous.providers) ? previous.providers : [])
      .filter(provider => record(provider) && typeof provider.id === 'string')
      .map(provider => [provider.id, provider]));
    const providers = DEFAULT_PROVIDERS.map(definition => {
      const old = saved.get(definition.id) || {};
      return {
        ...definition,
        ...old,
        operations: definition.operations.slice(),
        jobsCompleted: Number.isInteger(old.jobsCompleted) && old.jobsCompleted >= 0 ? old.jobsCompleted : 0,
        successfulJobs: Number.isInteger(old.successfulJobs) && old.successfulJobs >= 0 ? old.successfulJobs : 0,
        onTimeJobs: Number.isInteger(old.onTimeJobs) && old.onTimeJobs >= 0 ? old.onTimeJobs : 0,
        status: reputation(state) >= definition.reputationRequired && old.status !== 'suspended' ? 'available'
          : old.status === 'suspended' ? 'suspended' : 'unknown'
      };
    });
    state.suppliers = {
      ...previous,
      version: VERSION,
      providers,
      jobs: Array.isArray(previous.jobs) ? previous.jobs : [],
      history: Array.isArray(previous.history) ? previous.history : [],
      quotes: previous.version===VERSION&&record(previous.quotes) ? previous.quotes : {},
      randomState: previous.randomState ?? options.seed ?? 1,
      lastTickAtMinute: finite(previous.lastTickAtMinute) ? previous.lastTickAtMinute : null
    };
    return { ok: true, suppliers: state.suppliers };
  }

  function providerFor(state, providerId) {
    const result = ensureState(state);
    if (!result.ok) return { error: result };
    const provider = result.suppliers.providers.find(item => item.id === providerId);
    if (!provider) return { error: { ok: false, code: 'unknown_provider' } };
    return { provider, suppliers: result.suppliers };
  }

  function listProviders(state, operationType) {
    const result = ensureState(state);
    if (!result.ok) return result;
    if (operationType !== undefined && !OPERATIONS.has(operationType)) return { ok: false, code: 'invalid_operation' };
    const providers = result.suppliers.providers
      .filter(provider => provider.status === 'available' && (!operationType || provider.operations.includes(operationType)))
      .map(provider => ({ ...provider, operations: provider.operations.slice(), reliabilityRange: getReliabilityRange(provider) }));
    return { ok: true, providers };
  }

  function getReliabilityRange(provider) {
    if (provider.jobsCompleted === 0 && provider.known) {
      return { min: round(provider.reliability - 0.03), max: round(provider.reliability + 0.03), confidence: 'high' };
    }
    if (provider.jobsCompleted === 0) return { min: 0.62, max: 0.88, confidence: 'low' };
    const estimate = (provider.successfulJobs + 2) / (provider.jobsCompleted + 4);
    const initialMargin = provider.known ? 0.03 : 0.13;
    const margin = Math.max(0.015, initialMargin / Math.sqrt(provider.jobsCompleted + 1));
    return {
      min: round(Math.max(0.5, estimate - margin)),
      max: round(Math.min(0.99, estimate + margin)),
      confidence: provider.jobsCompleted >= 8 ? 'high' : provider.jobsCompleted >= 3 ? 'medium' : 'low'
    };
  }

  function hash(value) {
    let result = 2166136261;
    for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
    return result >>> 0;
  }

  function normalizeOperation(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (OPERATIONS.has(normalized)) return normalized;
    return ({
      'drehen': 'turning', 'fräsen': 'milling', 'frasen': 'milling',
      'qs': 'quality', 'qualitätsprüfung': 'quality', 'qualitaetspruefung': 'quality',
      'montage': 'assembly'
    })[normalized] || null;
  }

  function operationOf(order, options) {
    const suppliedStep = options.routeStep || order.routeStep;
    const direct = normalizeOperation(options.operationType || options.externalOperationType ||
      suppliedStep?.operationType || suppliedStep?.externalOperationType || order.operationType);
    if (direct) return direct;
    const stepId = options.routeStepId || order.routeStepId;
    const step = suppliedStep || (Array.isArray(order.routing) && order.routing.find(item => item?.id === stepId));
    if (!step) return null;
    if (step.type === 'external') return normalizeOperation(step.operationType || step.externalOperationType || step.requiredMachineKind);
    return normalizeOperation(step.type || step.requiredMachineKind);
  }

  function quote(state, providerId, order, options = {}) {
    if (!record(order)) return { ok: false, code: 'invalid_order' };
    if (!record(options)) return { ok: false, code: 'invalid_options' };
    const found = providerFor(state, providerId);
    if (found.error) return found.error;
    const { provider, suppliers } = found;
    const qty = options.qty ?? order.qty;
    const operationType = operationOf(order, options);
    const atMinute = options.atMinute ?? state.gameMinutes ?? 0;
    const lotId = options.lotId ?? order.lotId ?? null;
    if (provider.status !== 'available') return { ok: false, code: 'provider_locked' };
    if (!operationType || !provider.operations.includes(operationType)) return { ok: false, code: 'unsupported_operation' };
    if (!positive(qty)) return { ok: false, code: 'invalid_amount' };
    if (!finite(atMinute) || atMinute < 0) return { ok: false, code: 'invalid_time' };
    if (lotId !== null && (typeof lotId !== 'string' || !lotId.trim())) return { ok: false, code: 'invalid_reference' };
    const seed = options.seed ?? suppliers.randomState;
    const variation = (hash(`${seed}|${providerId}|${order.id ?? ''}|${lotId ?? ''}|${operationType}|${qty}`) % 101) / 1000;
    const leadTimeMinutes = Math.max(60, Math.round(provider.leadTimeMinutes * (1 + variation - 0.05)));
    const machiningSteps=Math.max(1,(order.routing||[]).filter(step=>['turning','milling'].includes(step.type==='external'?step.operationType:step.type)).length);
    const share=operationType==='quality'?0.18:0.8/machiningSteps;
    const providerFactor=provider.id==='supplier-express'?1.5:provider.id==='supplier-precision'?1.2:1;
    const valueCost=Math.max(0,Number(order.reward)||0)*qty/Math.max(1,Number(order.qty)||qty)*share*providerFactor;
    const totalCost = round(Math.max((provider.basePrice + provider.pricePerUnit * qty)*8,valueCost)*(1+variation));
    const dueAtMinute = atMinute + leadTimeMinutes;
    const reliabilityRange = getReliabilityRange(provider);
    const quoteResult = {
      ok: true,
      providerId,
      orderId: typeof order.id === 'string' ? order.id : null,
      routeStepId: options.routeStepId ?? order.routeStepId ?? null,
      lotId,
      operationType,
      qty,
      totalCost,
      leadTimeMinutes,
      quotedAtMinute: atMinute,
      dueAtMinute,
      expiresAtMinute: atMinute + Math.min(720, leadTimeMinutes),
      qualityRisk: round(provider.qualityRisk + (1 - reliabilityRange.min) * 0.2),
      reliabilityRange,
      quoteId: `Q-${hash(`${providerId}|${order.id ?? 'order'}|${options.routeStepId ?? order.routeStepId ?? 'step'}|${lotId ?? ''}|${qty}|${atMinute}|${seed}`).toString(36)}`
    };
    suppliers.quotes[quoteResult.quoteId] = { ...quoteResult };
    suppliers.lastQuoteId = quoteResult.quoteId;
    return quoteResult;
  }

  /**
   * Adapter contract: quote external steps with their underlying operationType and lotId,
   * then accept the exact quote with `outsource(..., atMinute, { quoteId })`. The returned
   * job carries lotId/routeStepId; pass its id to productionFlow.outsourceLot. After
   * completeJob succeeds, pass the same job references to productionFlow.completeOutsourcedStep.
   */
  function outsource(state, providerId, orderId, routeStepId, qty, atMinute, options = {}) {
    const result = ensureState(state);
    if (!result.ok) return result;
    if (!record(options)) return { ok: false, code: 'invalid_options' };
    if (typeof orderId !== 'string' || !orderId.trim() || typeof routeStepId !== 'string' || !routeStepId.trim()) {
      return { ok: false, code: 'invalid_reference' };
    }
    if (!positive(qty)) return { ok: false, code: 'invalid_amount' };
    if (!finite(atMinute) || atMinute < 0) return { ok: false, code: 'invalid_time' };
    const { suppliers } = result;
    const found = providerFor(state, providerId);
    if (found.error) return found.error;
    const provider = found.provider;
    if (provider.status !== 'available') return { ok: false, code: 'provider_locked' };
    const quoteId = typeof options.quoteId === 'string' ? options.quoteId : null;
    const requestedLotId = options.lotId ?? null;
    if (requestedLotId !== null && (typeof requestedLotId !== 'string' || !requestedLotId.trim())) return { ok: false, code: 'invalid_reference' };
    if (suppliers.jobs.some(job => job.orderId === orderId && job.routeStepId === routeStepId &&
        (job.lotId ?? null) === requestedLotId)) return { ok: false, code: 'already_outsourced' };
    const matchingQuotes = Object.values(suppliers.quotes).filter(item => item.providerId === providerId && item.orderId === orderId &&
      item.routeStepId === routeStepId && item.qty === qty && (requestedLotId === null || item.lotId === requestedLotId));
    let selectedQuote = quoteId ? suppliers.quotes[quoteId] : null;
    if (quoteId && !selectedQuote) return { ok: false, code: 'quote_not_found' };
    if (selectedQuote && (selectedQuote.providerId !== providerId || selectedQuote.orderId !== orderId ||
        selectedQuote.routeStepId !== routeStepId || selectedQuote.qty !== qty ||
        (requestedLotId !== null && selectedQuote.lotId !== requestedLotId))) return { ok: false, code: 'quote_mismatch' };
    if (!selectedQuote) {
      const validQuotes = matchingQuotes.filter(item => item.expiresAtMinute >= atMinute);
      if (validQuotes.length > 1) return { ok: false, code: 'ambiguous_quote' };
      selectedQuote = validQuotes[0];
    }
    if (!selectedQuote) {
      const operationType = normalizeOperation(routeStepId);
      if (!operationType || !provider.operations.includes(operationType)) return { ok: false, code: 'quote_required' };
      const fallback = quote(state, providerId, { id: orderId, qty, operationType, routeStepId, lotId: requestedLotId },
        { qty, atMinute, operationType, routeStepId, lotId: requestedLotId });
      if (!fallback.ok) return fallback;
      selectedQuote = suppliers.quotes[fallback.quoteId];
    }
    const lotId = selectedQuote.lotId ?? null;
    if (requestedLotId !== null && lotId !== requestedLotId) return { ok: false, code: 'quote_mismatch' };
    if (suppliers.jobs.some(job => job.orderId === orderId && job.routeStepId === routeStepId && (job.lotId ?? null) === lotId)) {
      return { ok: false, code: 'already_outsourced' };
    }
    if (!provider.operations.includes(selectedQuote.operationType)) return { ok: false, code: 'unsupported_operation' };
    if (selectedQuote.expiresAtMinute < atMinute) return { ok: false, code: 'quote_expired' };
    const job = {
      id: `SJ-${hash(`${providerId}|${orderId}|${routeStepId}|${lotId ?? ''}`).toString(36)}`,
      providerId,
      orderId,
      routeStepId,
      lotId,
      qty,
      operationType: selectedQuote.operationType,
      quoteId: selectedQuote.quoteId,
      cost: selectedQuote.totalCost,
      qualityRisk: selectedQuote.qualityRisk,
      reliabilityRange: { ...selectedQuote.reliabilityRange },
      status: 'in_progress',
      outsourcedAtMinute: atMinute,
      dueAtMinute: atMinute + selectedQuote.leadTimeMinutes,
      completedAtMinute: null,
      timing: null,
      outcome: null
    };
    suppliers.jobs.push(job);
    return { ok: true, job: { ...job, reliabilityRange: { ...job.reliabilityRange } } };
  }

  function tick(state, absoluteGameMinutes) {
    const result = ensureState(state);
    if (!result.ok) return result;
    if (!finite(absoluteGameMinutes) || absoluteGameMinutes < 0) return { ok: false, code: 'invalid_time' };
    const suppliers = result.suppliers;
    if (suppliers.lastTickAtMinute !== null && absoluteGameMinutes < suppliers.lastTickAtMinute) return { ok: false, code: 'time_reversed' };
    let changed = 0;
    for (const job of suppliers.jobs) {
      if (!['in_progress', 'due', 'overdue'].includes(job.status)) continue;
      if (absoluteGameMinutes > job.dueAtMinute) {
        if (job.status !== 'overdue') changed += 1;
        job.status = 'overdue';
        job.lateMinutes = absoluteGameMinutes - job.dueAtMinute;
      } else if (absoluteGameMinutes === job.dueAtMinute && job.status !== 'due') {
        job.status = 'due';
        changed += 1;
      }
    }
    suppliers.lastTickAtMinute = absoluteGameMinutes;
    return { ok: true, gameMinutes: absoluteGameMinutes, changed };
  }

  function recordOutcome(state, jobId, outcome = {}) {
    const result = ensureState(state);
    if (!result.ok) return result;
    if (!record(outcome)) return { ok: false, code: 'invalid_outcome' };
    const suppliers = result.suppliers;
    const job = suppliers.jobs.find(item => item.id === jobId);
    if (!job) return { ok: false, code: 'unknown_job' };
    if (job.status === 'completed') return { ok: false, code: 'already_completed' };
    const provider = suppliers.providers.find(item => item.id === job.providerId);
    const deliveredAtMinute = outcome.deliveredAtMinute ?? outcome.completedAtMinute ?? state.gameMinutes ?? job.dueAtMinute;
    if (!finite(deliveredAtMinute) || deliveredAtMinute < job.outsourcedAtMinute) return { ok: false, code: 'invalid_time' };
    const quality = outcome.quality || (outcome.defective ? 'rework' : 'accepted');
    if (!['accepted', 'rework', 'rejected'].includes(quality)) return { ok: false, code: 'invalid_quality' };
    const timing = deliveredAtMinute <= job.dueAtMinute ? 'on_time' : 'late';
    const normalizedOutcome = {
      deliveredAtMinute,
      timing,
      quality,
      defective: quality !== 'accepted',
      notes: typeof outcome.notes === 'string' ? outcome.notes : null
    };
    job.status = 'completed';
    job.completedAtMinute = deliveredAtMinute;
    job.timing = timing;
    job.outcome = normalizedOutcome;
    provider.jobsCompleted += 1;
    if (quality === 'accepted') provider.successfulJobs += 1;
    if (timing === 'on_time') provider.onTimeJobs += 1;
    if (provider.jobsCompleted >= 3) provider.known = true;
    suppliers.history.push({ jobId, providerId: job.providerId, ...normalizedOutcome });
    return { ok: true, job: { ...job, outcome: { ...normalizedOutcome } }, reliabilityRange: getReliabilityRange(provider) };
  }

  function completeJob(state, jobId, outcome = {}) {
    const result = ensureState(state);
    if (!result.ok) return result;
    const job = result.suppliers.jobs.find(item => item.id === jobId);
    if (!job) return { ok: false, code: 'unknown_job' };
    if (!record(outcome)) return { ok: false, code: 'invalid_outcome' };
    const deliveredAtMinute = outcome.deliveredAtMinute ?? outcome.completedAtMinute ?? state.gameMinutes ?? job.dueAtMinute;
    if (!finite(deliveredAtMinute) || deliveredAtMinute < job.outsourcedAtMinute) return { ok: false, code: 'invalid_time' };
    if (deliveredAtMinute < job.dueAtMinute) return { ok: false, code: 'not_due' };
    return recordOutcome(state, jobId, { ...outcome, deliveredAtMinute });
  }

  return Object.freeze({ ensureState, listProviders, quote, outsource, tick, completeJob, recordOutcome });
});

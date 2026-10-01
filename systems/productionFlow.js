(function attachProductionFlow(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.productionFlow = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProductionFlow() {
  'use strict';

  const VERSION = 1;
  const PRIORITIES = Object.freeze({ low: 1, normal: 2, high: 3 });
  const ROUTE_TYPES = new Set(['turning', 'milling', 'quality', 'assembly', 'external']);
  const EXTERNAL_OPERATIONS = new Set(['turning', 'milling', 'quality', 'assembly']);
  const ROUTE_STATUSES = new Set(['blocked', 'queued', 'running', 'completed', 'cancelled']);
  const BATCH_MODES = new Set(['auto', 'small', 'normal', 'large']);
  const DEFAULT_RESTART_SETUP_FRACTION = 0.5;

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function nonNegative(value, fallback = 0) {
    return Math.max(0, finite(value, fallback));
  }

  function emptyState() {
    return { version: VERSION, lots: [], queues: {}, events: [], orders: {}, machineAssignments: {}, nextLotNumber: 1 };
  }

  function assertGameState(state) {
    if (!isRecord(state)) throw new TypeError('productionFlow expects a mutable game state object.');
  }

  function ensureState(state) {
    assertGameState(state);
    if (!isRecord(state.productionFlow)) state.productionFlow = emptyState();
    const flow = state.productionFlow;
    flow.version = VERSION;
    flow.lots = Array.isArray(flow.lots) ? flow.lots.filter(isRecord) : [];
    flow.queues = isRecord(flow.queues) ? flow.queues : {};
    flow.events = Array.isArray(flow.events) ? flow.events.filter(isRecord) : [];
    flow.orders = isRecord(flow.orders) ? flow.orders : {};
    flow.machineAssignments = isRecord(flow.machineAssignments) ? flow.machineAssignments : {};
    flow.nextLotNumber = Math.max(1, Math.floor(finite(flow.nextLotNumber,
      flow.lots.reduce((n, lot) => Math.max(n, parseLotNumber(lot.id) + 1), 1))));

    // Repair queue indexes from the authoritative lot records. This also makes migration idempotent.
    const queues = {};
    for (const lot of flow.lots) {
      lot.qty = Math.max(0, Math.floor(finite(lot.qty, 0)));
      lot.qtyCompleted = Math.min(lot.qty, Math.max(0, Math.floor(finite(lot.qtyCompleted, 0))));
      lot.priority = PRIORITIES[lot.priority] ? lot.priority : 'normal';
      lot.sequence = Math.max(1, Math.floor(finite(lot.sequence, 1)));
      lot.status = ['waiting', 'queued', 'running', 'completed', 'outsourced', 'cancelled'].includes(lot.status)
        ? lot.status : (lot.status === 'blocked' ? 'waiting' : 'waiting');
      const order = flow.orders[lot.orderId];
      const currentStep = order && Array.isArray(order.routing) ? order.routing[lot.routePosition] : null;
      if (currentStep && typeof lot.routeStepType !== 'string') lot.routeStepType = currentStep.type;
      if (lot.status === 'queued') {
        if (currentStep?.type === 'external') lot.status = 'waiting';
        else (queues[queueKeyForLot(flow, lot)] ||= []).push(lot.id);
      }
      if (lot.status === 'running' && typeof lot.machineId === 'string') flow.machineAssignments[lot.machineId] = lot.id;
    }
    flow.queues = queues;
    for (const [id, order] of Object.entries(flow.orders)) {
      if (!isRecord(order) || order.id !== id) delete flow.orders[id];
    }
    for (const key of Object.keys(flow.machineAssignments)) {
      if (!flow.lots.some(lot => lot.id === flow.machineAssignments[key] && lot.status === 'running')) delete flow.machineAssignments[key];
    }
    sortAllQueues(flow);
    return flow;
  }

  function parseLotNumber(id) {
    const match = typeof id === 'string' && id.match(/-(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function queueKeyForLot(flow, lot) {
    if (typeof lot.requiredMachineKind === 'string' && lot.requiredMachineKind.trim()) return lot.requiredMachineKind;
    const orders = isRecord(flow.orders) ? flow.orders : {};
    const order = orders[lot.orderId];
    const step = order && Array.isArray(order.routing) ? order.routing[lot.routePosition] : null;
    return step?.type === 'quality' ? 'QS' : step?.type === 'external' ? 'External' : 'Unassigned';
  }

  function normalizeRoute(order) {
    let source = order.routing;
    if (source === undefined || source === null) {
      const type = /fräs/i.test(String(order.kind || '')) ? 'milling' : 'turning';
      source = [{ id: `${order.id}-step-1`, type, requiredMachineKind: order.kind || (type === 'milling' ? 'Fräsen' : 'Drehen') }];
    }
    if (!Array.isArray(source) || source.length < 1 || source.length > 4) return null;
    const seenIds = new Set();
    const route = [];
    for (let index = 0; index < source.length; index += 1) {
      const step = source[index];
      if (!isRecord(step)) return null;
      const id = typeof step.id === 'string' && step.id.trim() ? step.id : `${order.id}-step-${index + 1}`;
      const type = step.type;
      const requiredMachineKind = step.requiredMachineKind === null ? null : step.requiredMachineKind;
      if (!ROUTE_TYPES.has(type) || seenIds.has(id) ||
          !(requiredMachineKind === null || (typeof requiredMachineKind === 'string' && requiredMachineKind.trim()))) return null;
      if (type !== 'quality' && type !== 'external' && !requiredMachineKind) return null;
      if (type === 'external' && !EXTERNAL_OPERATIONS.has(step.operationType)) return null;
      if (step.status !== undefined && !ROUTE_STATUSES.has(step.status)) return null;
      seenIds.add(id);
      route.push({ ...clone(step), id, type, requiredMachineKind,
        status: index === 0 ? 'queued' : 'blocked' });
    }
    return route;
  }

  function resolveBatch(order, options) {
    const requested = BATCH_MODES.has(options.batchMode) ? options.batchMode
      : (BATCH_MODES.has(order.batchMode) ? order.batchMode : 'auto');
    const qty = Math.floor(order.qty);
    const capacity = Math.max(1, Math.floor(finite(options.capacity, 40)));
    let effective = requested;
    let target;
    if (requested === 'auto') {
      target = Math.min(qty, Math.max(1, Math.floor(capacity / 2)));
      effective = target <= Math.max(1, Math.ceil(qty / 10)) ? 'small'
        : (target <= Math.max(1, Math.ceil(qty / 4)) ? 'normal' : 'large');
    } else {
      const fraction = requested === 'small' ? 0.1 : requested === 'normal' ? 0.25 : 0.5;
      target = Math.max(1, Math.ceil(qty * fraction));
    }
    if (Number.isFinite(options.batchSize) && options.batchSize > 0 && requested === 'auto') {
      target = Math.max(1, Math.floor(options.batchSize));
    }
    return { requested, effective, target };
  }

  function createPlan(order, options = {}) {
    if (!isRecord(order) || typeof order.id !== 'string' || !order.id.trim() ||
        !Number.isSafeInteger(order.qty) || order.qty <= 0) return { ok: false, code: 'INVALID_ORDER' };
    if (!isRecord(options)) options = {};
    const route = normalizeRoute(order);
    if (!route) return { ok: false, code: Array.isArray(order.routing) && order.routing.length > 4 ? 'ROUTE_TOO_LONG' : 'INVALID_ROUTE' };
    const batch = resolveBatch(order, options);
    const count = Math.ceil(order.qty / batch.target);
    const base = Math.floor(order.qty / count);
    const remainder = order.qty - base * count;
    const setupMinutes = Math.max(0, finite(options.setupMinutes, finite(order.setupMinutes, 0)));
    const lots = [];
    for (let index = 0; index < count; index += 1) {
      const qty = base + (index === count - 1 ? remainder : 0);
      lots.push({ id: `${order.id}-lot-${index + 1}`, orderId: order.id,
        routeStepId: route[0].id, sequence: index + 1, qty, qtyCompleted: 0,
        status: 'waiting', priority: PRIORITIES[order.priority] ? order.priority : 'normal',
        queueEnteredAtMinute: null, startedAtMinute: null, completedAtMinute: null,
        setupMinutes, restartSetupMinutes: 0,
        interruptionSensitivity: Math.min(1, Math.max(0, finite(order.interruptionSensitivity, 0.25))),
        requiredMachineKind: route[0].requiredMachineKind,
        routeStepType: route[0].type,
        routePosition: 0, stepStatuses: route.map((step, i) => i === 0 ? 'queued' : 'blocked'),
        interrupted: null });
    }
    return { ok: true, order: { ...clone(order), routing: route,
      priority: PRIORITIES[order.priority] ? order.priority : 'normal',
      interruptionSensitivity: Math.min(1, Math.max(0, finite(order.interruptionSensitivity, 0.25))),
      batchMode: batch.requested, effectiveBatchMode: batch.effective }, route, lots,
      batchMode: batch.requested, effectiveBatchMode: batch.effective, batchSize: batch.target };
  }

  function priorityRank(priority) { return PRIORITIES[priority] || PRIORITIES.normal; }

  function compareLots(a, b) {
    return priorityRank(b.priority) - priorityRank(a.priority) ||
      finite(a.queueEnteredAtMinute, 0) - finite(b.queueEnteredAtMinute, 0) ||
      finite(a.routePosition, 0) - finite(b.routePosition, 0) ||
      String(a.id).localeCompare(String(b.id));
  }

  function sortAllQueues(flow) {
    for (const [kind, ids] of Object.entries(flow.queues)) {
      flow.queues[kind] = [...new Set((Array.isArray(ids) ? ids : []).filter(id =>
        flow.lots.some(lot => lot.id === id && lot.status === 'queued' && queueKeyForLot(flow, lot) === kind)))];
      flow.queues[kind].sort((left, right) => compareLots(
        flow.lots.find(lot => lot.id === left), flow.lots.find(lot => lot.id === right)));
      if (!flow.queues[kind].length) delete flow.queues[kind];
    }
  }

  function queueLot(flow, lot, atMinute) {
    const order = flow.orders[lot.orderId];
    const step = order && Array.isArray(order.routing) ? order.routing[lot.routePosition] : null;
    lot.status = step?.type === 'external' ? 'waiting' : 'queued';
    lot.queueEnteredAtMinute = atMinute;
    if (lot.status === 'waiting') return;
    const kind = queueKeyForLot(flow, lot);
    (flow.queues[kind] ||= []).push(lot.id);
    sortAllQueues(flow);
  }

  function removeFromQueues(flow, lot) {
    for (const [kind, ids] of Object.entries(flow.queues)) {
      flow.queues[kind] = ids.filter(id => id !== lot.id);
      if (!flow.queues[kind].length) delete flow.queues[kind];
    }
  }

  function addOrder(state, order, options = {}) {
    if (!isRecord(options)) options = {};
    if (!isRecord(state) || !isRecord(order) || typeof order.id !== 'string' ||
        (isRecord(state.productionFlow) && isRecord(state.productionFlow.orders) && state.productionFlow.orders[order.id])) {
      return { ok: false, code: 'DUPLICATE_OR_INVALID_ORDER' };
    }
    const plan = createPlan(order, options);
    if (!plan.ok) return plan;
    const flow = ensureState(state);
    if (Number.isFinite(options.restartSetupFraction)) flow.restartSetupFraction = Math.min(0.5, Math.max(0, options.restartSetupFraction));
    const now = Math.max(0, finite(state.gameMinutes, 0));
    flow.orders[order.id] = plan.order;
    for (const plannedLot of plan.lots) {
      const lot = { ...plannedLot, id: `${order.id}-lot-${flow.nextLotNumber++}` };
      flow.lots.push(lot);
      queueLot(flow, lot, now);
    }
    return { ok: true, order: clone(plan.order), lots: flow.lots.filter(lot => lot.orderId === order.id).map(clone) };
  }

  function setPriority(state, orderId, priority) {
    if (!PRIORITIES[priority]) return { ok: false, code: 'INVALID_PRIORITY' };
    if (!isRecord(state) || typeof orderId !== 'string' || !isRecord(state.productionFlow) ||
        !isRecord(state.productionFlow.orders) || !state.productionFlow.orders[orderId]) return { ok: false, code: 'ORDER_NOT_FOUND' };
    const flow = ensureState(state);
    const order = flow.orders[orderId];
    if (!order) return { ok: false, code: 'ORDER_NOT_FOUND' };
    order.priority = priority;
    for (const lot of flow.lots) {
      if (lot.orderId === orderId && (lot.status === 'queued' || lot.status === 'waiting')) lot.priority = priority;
    }
    sortAllQueues(flow);
    return { ok: true, order: clone(order) };
  }

  function getLot(flow, lotId) { return flow.lots.find(lot => lot.id === lotId); }

  function estimateRestartSetup(state, lotId) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    const lot = rawFlow && Array.isArray(rawFlow.lots) ? rawFlow.lots.find(item => item && item.id === lotId) : null;
    if (!lot || lot.status !== 'running') return { ok: false, code: 'LOT_NOT_RUNNING' };
    const fraction = Math.min(0.5, Math.max(0, finite(rawFlow.restartSetupFraction, DEFAULT_RESTART_SETUP_FRACTION)));
    return { ok: true, lotId, setupMinutes: finite(lot.setupMinutes, 0),
      interruptionSensitivity: Math.min(1, Math.max(0, finite(lot.interruptionSensitivity, 0.25))),
      restartSetupFraction: fraction,
      estimatedRestartSetupMinutes: finite(lot.setupMinutes, 0) *
        Math.min(1, Math.max(0, finite(lot.interruptionSensitivity, 0.25))) * fraction };
  }

  function interrupt(state, lotId, machineId, atMinute) {
    const existing = isRecord(state) && isRecord(state.productionFlow) && Array.isArray(state.productionFlow.lots)
      ? state.productionFlow.lots.find(item => item && item.id === lotId) : null;
    if (!existing || existing.status !== 'running' || !machineId || existing.machineId !== machineId || !Number.isFinite(atMinute) || atMinute < 0) {
      return { ok: false, code: 'INVALID_INTERRUPT' };
    }
    const flow = ensureState(state);
    const lot = getLot(flow, lotId);
    const estimate = estimateRestartSetup(state, lotId);
    const estimated = estimate.estimatedRestartSetupMinutes;
    lot.interrupted = { machineId, qtyCompleted: lot.qtyCompleted, atMinute,
      restartSetupMinutes: estimated, remainingQty: Math.max(0, lot.qty - lot.qtyCompleted) };
    lot.status = 'waiting';
    lot.machineId = null;
    lot.interruptedAtMinute = atMinute;
    flow.machineAssignments[machineId] = null;
    delete flow.machineAssignments[machineId];
    flow.events.push({ type: 'interrupted', lotId, orderId: lot.orderId, machineId, atMinute,
      remainingQty: lot.interrupted.remainingQty, restartSetupMinutes: estimated });
    return { ok: true, lot: clone(lot), estimatedRestartSetupMinutes: estimated };
  }

  function resume(state, lotId, machineId, atMinute) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    const existing = rawFlow && Array.isArray(rawFlow.lots) ? rawFlow.lots.find(item => item && item.id === lotId) : null;
    if (!existing || existing.status !== 'waiting' || !existing.interrupted || !machineId ||
        (isRecord(rawFlow.machineAssignments) && Object.hasOwn(rawFlow.machineAssignments, machineId)) || !Number.isFinite(atMinute) || atMinute < 0) {
      return { ok: false, code: 'INVALID_RESUME' };
    }
    const flow = ensureState(state);
    const lot = getLot(flow, lotId);
    if (!lot || lot.status !== 'waiting' || !lot.interrupted || !machineId ||
        Object.hasOwn(flow.machineAssignments, machineId) || !Number.isFinite(atMinute) || atMinute < 0) {
      return { ok: false, code: 'INVALID_RESUME' };
    }
    removeFromQueues(flow, lot);
    lot.restartSetupMinutes += lot.interrupted.restartSetupMinutes;
    lot.lastResumedAtMinute = atMinute;
    lot.machineId = machineId;
    lot.status = 'running';
    lot.startedAtMinute = Number.isFinite(lot.startedAtMinute) ? lot.startedAtMinute : atMinute;
    lot.stepStatuses[lot.routePosition] = 'running';
    flow.machineAssignments[machineId] = lot.id;
    const resumed = { ...lot.interrupted, resumedAtMinute: atMinute };
    lot.interrupted = null;
    flow.events.push({ type: 'resumed', lotId, orderId: lot.orderId, machineId, atMinute,
      restartSetupMinutes: resumed.restartSetupMinutes });
    return { ok: true, lot: clone(lot), restartSetupMinutes: resumed.restartSetupMinutes };
  }

  function completeStep(state, lotId, routeStepId, atMinute) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    const existing = rawFlow && Array.isArray(rawFlow.lots) ? rawFlow.lots.find(item => item && item.id === lotId) : null;
    const existingOrder = existing && isRecord(rawFlow.orders) ? rawFlow.orders[existing.orderId] : null;
    if (!existing || existing.status !== 'running' || !Number.isFinite(atMinute) || atMinute < 0 ||
        !existingOrder || !existingOrder.routing || existingOrder.routing[existing.routePosition]?.id !== routeStepId) {
      return { ok: false, code: 'INVALID_COMPLETION' };
    }
    const flow = ensureState(state);
    const lot = getLot(flow, lotId);
    if (!lot || lot.status !== 'running' || !Number.isFinite(atMinute) || atMinute < 0) return { ok: false, code: 'INVALID_COMPLETION' };
    const order = flow.orders[lot.orderId];
    const step = order && order.routing[lot.routePosition];
    if (!step || step.id !== routeStepId) return { ok: false, code: 'ROUTE_STEP_MISMATCH' };
    const machineId = lot.machineId;
    if (machineId && flow.machineAssignments[machineId] === lot.id) delete flow.machineAssignments[machineId];
    lot.qtyCompleted = lot.qty;
    lot.stepStatuses[lot.routePosition] = 'completed';
    lot.completedAtMinute = atMinute;
    lot.machineId = null;
    if (lot.routePosition + 1 >= order.routing.length) {
      lot.status = 'completed';
      flow.events.push({ type: 'lot-completed', lotId, orderId: lot.orderId, routeStepId, atMinute, qty: lot.qty });
      return { ok: true, lot: clone(lot), orderCompleted: flow.lots.filter(item => item.orderId === lot.orderId).every(item => item.status === 'completed') };
    }
    lot.routePosition += 1;
    lot.routeStepId = order.routing[lot.routePosition].id;
    lot.routeStepType = order.routing[lot.routePosition].type;
    lot.requiredMachineKind = order.routing[lot.routePosition].requiredMachineKind;
    lot.qtyCompleted = 0;
    lot.completedAtMinute = null;
    lot.stepStatuses[lot.routePosition] = 'queued';
    queueLot(flow, lot, atMinute);
    flow.events.push({ type: 'step-completed', lotId, orderId: lot.orderId, routeStepId, nextRouteStepId: lot.routeStepId, atMinute, qty: lot.qty });
    return { ok: true, lot: clone(lot), orderCompleted: false };
  }

  /**
   * Adapter contract for external route steps: after suppliers.outsource(...) returns a job,
   * call outsourceLot(state, job.lotId, job.id, atMinute). On successful supplier delivery,
   * call completeOutsourcedStep(state, job.lotId, job.routeStepId, job.id, deliveredAtMinute).
   * The latter releases this same lot to its next local station queue (or completes its order).
   */
  function outsourceLot(state, lotId, supplierJobId, atMinute) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    const existing = rawFlow && Array.isArray(rawFlow.lots) ? rawFlow.lots.find(item => item && item.id === lotId) : null;
    const order = existing && isRecord(rawFlow.orders) ? rawFlow.orders[existing.orderId] : null;
    const step = order && Array.isArray(order.routing) ? order.routing[existing.routePosition] : null;
    if (!existing || !['waiting', 'queued'].includes(existing.status) || step?.type !== 'external' ||
        typeof supplierJobId !== 'string' || !supplierJobId.trim() || !Number.isFinite(atMinute) || atMinute < 0 ||
        (Number.isFinite(existing.queueEnteredAtMinute) && atMinute < existing.queueEnteredAtMinute) ||
        rawFlow.lots.some(lot => lot && lot.id !== lotId && lot.supplierJobId === supplierJobId)) {
      return { ok: false, code: 'INVALID_OUTSOURCING' };
    }
    const flow = ensureState(state);
    const lot = getLot(flow, lotId);
    removeFromQueues(flow, lot);
    lot.status = 'outsourced';
    lot.supplierJobId = supplierJobId;
    lot.outsourcedAtMinute = atMinute;
    lot.machineId = null;
    flow.events.push({ type: 'lot-outsourced', lotId, orderId: lot.orderId,
      routeStepId: lot.routeStepId, supplierJobId, atMinute });
    return { ok: true, lot: clone(lot) };
  }

  function completeOutsourcedStep(state, lotId, routeStepId, supplierJobId, atMinute) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    const existing = rawFlow && Array.isArray(rawFlow.lots) ? rawFlow.lots.find(item => item && item.id === lotId) : null;
    const order = existing && isRecord(rawFlow.orders) ? rawFlow.orders[existing.orderId] : null;
    const step = order && Array.isArray(order.routing) ? order.routing[existing.routePosition] : null;
    if (!existing || existing.status !== 'outsourced' || existing.supplierJobId !== supplierJobId ||
        !step || step.type !== 'external' || step.id !== routeStepId || existing.routeStepId !== routeStepId ||
        !Number.isFinite(atMinute) || atMinute < 0 || atMinute < existing.outsourcedAtMinute) {
      return { ok: false, code: 'INVALID_OUTSOURCED_COMPLETION' };
    }
    const flow = ensureState(state);
    const lot = getLot(flow, lotId);
    const activeOrder = flow.orders[lot.orderId];
    lot.qtyCompleted = lot.qty;
    lot.stepStatuses[lot.routePosition] = 'completed';
    lot.completedAtMinute = atMinute;
    lot.supplierJobId = null;
    lot.outsourcedAtMinute = null;
    if (lot.routePosition + 1 >= activeOrder.routing.length) {
      lot.status = 'completed';
      flow.events.push({ type: 'outsourced-lot-completed', lotId, orderId: lot.orderId,
        routeStepId, supplierJobId, atMinute, qty: lot.qty });
      return { ok: true, lot: clone(lot), orderCompleted: flow.lots
        .filter(item => item.orderId === lot.orderId).every(item => item.status === 'completed') };
    }
    lot.routePosition += 1;
    lot.routeStepId = activeOrder.routing[lot.routePosition].id;
    lot.routeStepType = activeOrder.routing[lot.routePosition].type;
    lot.requiredMachineKind = activeOrder.routing[lot.routePosition].requiredMachineKind;
    lot.qtyCompleted = 0;
    lot.completedAtMinute = null;
    lot.stepStatuses[lot.routePosition] = 'queued';
    queueLot(flow, lot, atMinute);
    flow.events.push({ type: 'outsourced-step-completed', lotId, orderId: lot.orderId,
      routeStepId, nextRouteStepId: lot.routeStepId, supplierJobId, atMinute, qty: lot.qty });
    return { ok: true, lot: clone(lot), orderCompleted: false };
  }

  function startNext(state, machineId, requiredMachineKind, atMinute) {
    const rawFlow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : null;
    if (!rawFlow || !Array.isArray(rawFlow.lots) || typeof machineId !== 'string' || !machineId ||
        typeof requiredMachineKind !== 'string' || !requiredMachineKind || !Number.isFinite(atMinute) || atMinute < 0 ||
        (isRecord(rawFlow.machineAssignments) && Object.hasOwn(rawFlow.machineAssignments, machineId))) {
      return { ok: false, code: 'INVALID_START' };
    }
    const candidate = rawFlow.lots.filter(lot => {
      if (!lot || lot.status !== 'queued' || queueKeyForLot(rawFlow, lot) !== requiredMachineKind) return false;
      const order = rawFlow.orders?.[lot.orderId];
      return order?.routing?.[lot.routePosition]?.type !== 'external';
    })
      .sort(compareLots)[0];
    if (!candidate) return { ok: false, code: 'NO_QUEUED_LOT' };
    const flow = ensureState(state);
    const lotId = flow.queues[requiredMachineKind]?.[0];
    const lot = lotId && getLot(flow, lotId);
    if (!lot) return { ok: false, code: 'NO_QUEUED_LOT' };
    removeFromQueues(flow, lot);
    lot.status = 'running';
    lot.machineId = machineId;
    lot.startedAtMinute = atMinute;
    lot.stepStatuses[lot.routePosition] = 'running';
    flow.machineAssignments[machineId] = lot.id;
    flow.events.push({ type: 'started', lotId: lot.id, orderId: lot.orderId, routeStepId: lot.routeStepId, machineId, atMinute });
    return { ok: true, lot: clone(lot) };
  }

  function tick(state, absoluteGameMinutes) {
    if (!Number.isFinite(absoluteGameMinutes) || absoluteGameMinutes < 0) return { ok: false, code: 'INVALID_TIME' };
    const flow = ensureState(state);
    flow.lastTickAtMinute = Math.max(finite(flow.lastTickAtMinute, 0), absoluteGameMinutes);
    sortAllQueues(flow);
    return { ok: true, atMinute: flow.lastTickAtMinute };
  }

  function getSnapshot(state) {
    const flow = isRecord(state) && isRecord(state.productionFlow) ? state.productionFlow : emptyState();
    const lots = Array.isArray(flow.lots) ? flow.lots : [];
    const waitingLots = lots.filter(lot => lot && (lot.status === 'queued' || lot.status === 'waiting'))
      .map(lot => clone(lot)).sort(compareLots);
    const queues = {};
    for (const lot of waitingLots) if (lot.status === 'queued') {
      (queues[queueKeyForLot(flow, lot)] ||= []).push(lot.id);
    }
    for (const ids of Object.values(queues)) ids.sort((a, b) => compareLots(waitingLots.find(lot => lot.id === a), waitingLots.find(lot => lot.id === b)));
    const queueSizes = Object.fromEntries(Object.entries(queues).map(([kind, ids]) => [kind, ids.length]));
    return { version: finite(flow.version, VERSION), queueSizes, queues, waitingLots,
      runningLots: lots.filter(lot => lot && lot.status === 'running').map(lot => ({ ...clone(lot),
        estimatedRestartSetupMinutes: finite(lot.setupMinutes, 0) *
          Math.min(1, Math.max(0, finite(lot.interruptionSensitivity, 0.25))) *
          Math.min(0.5, Math.max(0, finite(flow.restartSetupFraction, DEFAULT_RESTART_SETUP_FRACTION))) })),
      completedLots: lots.filter(lot => lot && lot.status === 'completed').map(clone),
      outsourcedLots: lots.filter(lot => lot && lot.status === 'outsourced').map(clone) };
  }

  return Object.freeze({ ensureState, createPlan, addOrder, setPriority, startNext, estimateRestartSetup, interrupt, resume, completeStep,
    outsourceLot, completeOutsourcedStep, tick, getSnapshot,
    limits: Object.freeze({ maxRouteSteps: 4, restartSetupFraction: DEFAULT_RESTART_SETUP_FRACTION }) });
});

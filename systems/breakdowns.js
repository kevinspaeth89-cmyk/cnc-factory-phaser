(function (root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.breakdowns = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MINUTES_PER_HOUR = 60;
  const BASE_WARNING_RATE_PER_HOUR = 0.006;
  const BASE_ESCALATION_RATE_PER_HOUR = 0.04;
  const BASE_SUDDEN_FAILURE_RATE_PER_HOUR = 0.00035;
  const COMPLEX_SELF_REPAIR_FAULTS = new Set(['voltage_problem', 'sensor_error', 'magazine_fault', 'spindle_temperature']);
  const VALID_STATUSES = new Set(['ok', 'warning', 'major_failure', 'repairing']);
  const randomSources = new WeakMap();

  const faults = Object.freeze({
    coolant_pressure: Object.freeze({ label: 'Kühlmitteldruck niedrig', cost: 520, downtime: 24, scrapChance: 0.18 }),
    tool_break: Object.freeze({ label: 'Werkzeugbruch erkannt', cost: 440, downtime: 20, scrapChance: 0.35 }),
    chip_conveyor: Object.freeze({ label: 'Späneförderer blockiert', cost: 680, downtime: 34, scrapChance: 0.16 }),
    voltage_problem: Object.freeze({ label: 'Spannungsproblem', cost: 860, downtime: 42, scrapChance: 0.28 }),
    sensor_error: Object.freeze({ label: 'Sensorfehler', cost: 610, downtime: 28, scrapChance: 0.12 }),
    lubrication_check: Object.freeze({ label: 'Schmierung prüfen', cost: 760, downtime: 36, scrapChance: 0.18 }),
    magazine_fault: Object.freeze({ label: 'Werkzeugmagazin Störung', cost: 940, downtime: 44, scrapChance: 0.28 }),
    spindle_temperature: Object.freeze({ label: 'Spindeltemperatur erhöht', cost: 1020, downtime: 48, scrapChance: 0.32 })
  });

  const emptyRecord = () => ({
    status: 'ok',
    fault: null,
    severity: 0,
    since: null,
    riskyContinue: false,
    scheduledRepair: false,
    operatingHours: 0,
    warningAgeMinutes: 0,
    repairRemainingMinutes: 0,
    technicianArrivalRemainingMinutes: 0,
    technicianRepairMinutes: 0,
    repairEmployeeId: null,
    plannedRepair: false,
    repairMethod: null,
    repairWillFail: false,
    selfRepairFailed: false
  });

  function machineList(state) {
    if (Array.isArray(state && state.machines)) return state.machines;
    if (state && state.machines && typeof state.machines === 'object') return Object.values(state.machines);
    return [];
  }

  function bayOf(machine) {
    return machine && Number.isInteger(machine.bay) && machine.bay >= 1 ? machine.bay : null;
  }

  function machineAt(state, bay) {
    if (!Number.isInteger(bay) || bay < 1) return null;
    return machineList(state).find(machine => bayOf(machine) === bay) || null;
  }

  function normalizeRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    let status = VALID_STATUSES.has(source.status) ? source.status : 'ok';
    let fault = Object.prototype.hasOwnProperty.call(faults, source.fault) ? source.fault : null;
    if (status !== 'ok' && !fault) status = 'ok';
    if (status === 'ok') fault = null;
    return {
      status,
      fault,
      severity: status === 'ok' ? 0 : Math.max(1, Math.floor(Number(source.severity) || 1)),
      since: Number.isFinite(source.since) ? source.since : null,
      riskyContinue: status === 'warning' && source.riskyContinue === true,
      scheduledRepair: status === 'warning' && source.scheduledRepair === true,
      operatingHours: Math.max(0, Number(source.operatingHours) || 0),
      warningAgeMinutes: Math.max(0, Number(source.warningAgeMinutes) || 0),
      repairRemainingMinutes: status === 'repairing' ? Math.max(0, Number(source.repairRemainingMinutes) || 0) : 0,
      technicianArrivalRemainingMinutes: status === 'repairing' && source.repairMethod === 'technician'
        ? Math.max(0, Number(source.technicianArrivalRemainingMinutes) || 0) : 0,
      technicianRepairMinutes: status === 'repairing' && source.repairMethod === 'technician'
        ? Math.max(0, Number(source.technicianRepairMinutes) || 0) : 0,
      repairEmployeeId: status === 'repairing' && Number.isInteger(source.repairEmployeeId) ? source.repairEmployeeId : null,
      plannedRepair: status === 'repairing' && source.plannedRepair === true,
      repairMethod: status === 'repairing' && ['self', 'technician', 'planned'].includes(source.repairMethod) ? source.repairMethod : null,
      repairWillFail: status === 'repairing' && source.repairMethod === 'self' && source.repairWillFail === true,
      selfRepairFailed: status !== 'ok' && source.selfRepairFailed === true
    };
  }

  function syncMachines(state) {
    const previous = state.breakdowns.machines;
    const current = {};
    for (const machine of machineList(state)) {
      const bay = bayOf(machine);
      if (bay === null) continue;
      const key = String(bay);
      current[key] = Object.prototype.hasOwnProperty.call(previous, key)
        ? normalizeRecord(previous[key])
        : emptyRecord();
    }
    state.breakdowns.machines = current;
  }

  function init(state, options) {
    if (!state || typeof state !== 'object') return null;
    if (!state.breakdowns || typeof state.breakdowns !== 'object') state.breakdowns = { machines: {} };
    if (!state.breakdowns.machines || typeof state.breakdowns.machines !== 'object' || Array.isArray(state.breakdowns.machines)) {
      state.breakdowns.machines = {};
    }
    syncMachines(state);
    if (options && typeof options.random === 'function') randomSources.set(state, options.random);
    else randomSources.delete(state);
    return state.breakdowns;
  }

  function ensureReady(state) {
    if (!state || typeof state !== 'object') return false;
    if (!state.breakdowns || !state.breakdowns.machines || typeof state.breakdowns.machines !== 'object') init(state);
    syncMachines(state);
    return true;
  }

  function recordAt(state, bay) {
    if (!ensureReady(state) || !machineAt(state, bay)) return null;
    return state.breakdowns.machines[String(bay)] || null;
  }

  function getStatus(state, bay) {
    const record = recordAt(state, bay);
    return record ? record.status : null;
  }

  function getFault(state, bay) {
    const record = recordAt(state, bay);
    return record ? record.fault : null;
  }

  function getFaultInfo(fault) {
    const info = Object.prototype.hasOwnProperty.call(faults, fault) ? faults[fault] : null;
    return info ? { id: fault, label: info.label, baseCost: info.cost, baseDowntime: info.downtime } : null;
  }

  function getRecord(state, bay) {
    const record = recordAt(state, bay);
    return record ? { ...record } : null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function conditionFactors(state, machine, record, context) {
    const maintenance = clamp(Number.isFinite(machine.maintenance) ? machine.maintenance : 100, 0, 100);
    const tool = clamp(Number.isFinite(machine.tool) ? machine.tool : 100, 0, 100);
    const maintenanceFactor = maintenance >= 80 ? 0.25 : maintenance >= 50 ? 0.7 : maintenance >= 20 ? 1.7 : 3.5;
    const toolFactor = 0.7 + (100 - tool) / 100 * 1.5;
    const runtimeFactor = record.operatingHours >= 200 ? 2.2 : record.operatingHours >= 80 ? 1.65 : record.operatingHours >= 24 ? 1.25 : 1;
    let reliability = machine.reliability;
    if (!Number.isFinite(reliability) && state.catalog && state.catalog[machine.type]) {
      reliability = state.catalog[machine.type].reliability;
    }
    if (context && typeof context.reliabilityForMachine === 'function') {
      const supplied = context.reliabilityForMachine(machine, state);
      if (Number.isFinite(supplied)) reliability = supplied;
    }
    const reliabilityFactor = Number.isFinite(reliability) && reliability > 0
      ? 1 / clamp(reliability, 0.5, 1.5)
      : 1;
    return { maintenance, tool, maintenanceFactor, toolFactor, runtimeFactor, reliabilityFactor };
  }

  function getRiskProfile(state, bay) {
    const machine = machineAt(state, bay);
    const record = recordAt(state, bay);
    if (!machine || !record) return null;
    const factors = conditionFactors(state, machine, record);
    return {
      ...factors,
      operatingHours: record.operatingHours,
      warningRatePerHour: BASE_WARNING_RATE_PER_HOUR * factors.maintenanceFactor * factors.toolFactor * factors.runtimeFactor * factors.reliabilityFactor
    };
  }

  function machineHasJob(machine) {
    return machine.activeId !== null && machine.activeId !== undefined && machine.activeId !== '' ||
      machine.jobActive === true || machine.hasActiveJob === true;
  }

  function technicianTravelRange(record) {
    const major = record.severity >= 2 || record.status === 'major_failure';
    return major ? { min: 90, max: 180 } : { min: 45, max: 120 };
  }

  function repairNumbers(record, method) {
    const info = faults[record.fault];
    const major = record.severity >= 2 || record.status === 'major_failure';
    if (method === 'planned') {
      const factor = major ? 1.45 : 0.72;
      const timeFactor = major ? 1.65 : 0.8;
      return { cost: Math.round(info.cost * factor), downtime: Math.max(1, Math.round(info.downtime * timeFactor)) };
    }
    if (method === 'technician') {
      const repairMinutes = Math.max(1, Math.round(info.downtime * (major ? 2.15 : 1.15) + (major ? 35 : 12)));
      const arrivalRange = technicianTravelRange(record);
      return {
        cost: Math.round(info.cost * (major ? 3.1 : 1.65) + (major ? 900 : 250)),
        repairMinutes,
        arrivalRange,
        downtime: repairMinutes + Math.round((arrivalRange.min + arrivalRange.max) / 2)
      };
    }
    if (method === 'self') {
      const complex = COMPLEX_SELF_REPAIR_FAULTS.has(record.fault);
      const factor = complex ? (major ? 4.4 : 2.1) : (major ? 3.6 : 0.6);
      const extra = complex ? (major ? 70 : 18) : (major ? 55 : 10);
      return {
        cost: Math.round(info.cost * (major ? 1.8 : 0.55) + (major ? 350 : 0)),
        downtime: Math.max(1, Math.round(info.downtime * factor + extra))
      };
    }
    return {
      cost: Math.round(info.cost * (major ? 1.8 : 0.55) + (major ? 350 : 0)),
      downtime: Math.max(1, Math.round(info.downtime * (major ? 2.8 : 0.48) + (major ? 40 : 0)))
    };
  }

  function selfRepairFailureChance(state, bay, record, context = {}) {
    const machine = machineAt(state, bay);
    if (!machine || !record) return 0;
    const factors = conditionFactors(state, machine, record);
    let chance = record.severity >= 2 || record.status === 'major_failure' ? 0.62 : 0.38;
    if (COMPLEX_SELF_REPAIR_FAULTS.has(record.fault)) chance += 0.12;
    if (factors.maintenance < 20) chance += 0.16;
    else if (factors.maintenance < 50) chance += 0.1;
    else if (factors.maintenance < 80) chance += 0.04;
    if (factors.tool < 20) chance += 0.1;
    else if (factors.tool < 50) chance += 0.04;
    if (factors.runtimeFactor >= 2.2) chance += 0.08;
    else if (factors.runtimeFactor >= 1.65) chance += 0.05;
    else if (factors.runtimeFactor >= 1.25) chance += 0.02;
    chance += clamp((factors.reliabilityFactor - 1) * 0.08, -0.05, 0.08);
    const baseChance = clamp(chance, 0.25, 0.88);
    const successBonus = clamp(Number(context.selfRepairSuccessBonus) || 0, 0, 0.32);
    return clamp(baseChance - successBonus, 0.08, 0.88);
  }

  function selfRepairFailureRange(state, bay, record, context = {}) {
    const expected = selfRepairFailureChance(state, bay, record, context);
    return {
      min: clamp(expected - 0.12, 0.05, 0.92),
      max: clamp(expected + 0.12, 0.05, 0.92)
    };
  }

  function startRepair(record, downtime, planned, method, willFail, context = {}) {
    record.status = 'repairing';
    record.riskyContinue = false;
    record.scheduledRepair = false;
    record.repairRemainingMinutes = downtime;
    record.plannedRepair = planned;
    record.repairMethod = method || (planned ? 'planned' : 'technician');
    record.repairWillFail = willFail === true;
    record.repairEmployeeId = Number.isInteger(context.employeeId) ? context.employeeId : null;
    record.technicianArrivalRemainingMinutes = Math.max(0, Number(context.technicianArrivalMinutes) || 0);
    record.technicianRepairMinutes = Math.max(0, Number(context.technicianRepairMinutes) || 0);
  }

  function repairNow(state, bay) {
    return repairSelf(state, bay);
  }

  function getRepairOptions(state, bay, context = {}) {
    const record = recordAt(state, bay);
    if (!record || !record.fault || !['warning', 'major_failure'].includes(record.status)) return null;
    const failureChance = selfRepairFailureChance(state, bay, record, context);
    return {
      self: { ...repairNumbers(record, 'self'), failureChance, failureRange: selfRepairFailureRange(state, bay, record, context), allowed: !record.selfRepairFailed },
      technician: repairNumbers(record, 'technician'),
      planned: repairNumbers(record, 'planned')
    };
  }

  function repairSelf(state, bay, context = {}) {
    const machine = machineAt(state, bay);
    const record = recordAt(state, bay);
    if (!machine || !record || record.selfRepairFailed || !record.fault || !['warning', 'major_failure'].includes(record.status)) return null;
    const { cost, downtime } = repairNumbers(record, 'self');
    const failureChance = selfRepairFailureChance(state, bay, record, context);
    const failureRange = selfRepairFailureRange(state, bay, record, context);
    const attemptFailureChance = failureRange.min + randomValue(state) * (failureRange.max - failureRange.min);
    const willFail = randomValue(state) < attemptFailureChance;
    const fault = record.fault;
    startRepair(record, downtime, false, 'self', willFail, context);
    return { event: 'repair', method: 'self', bay, fault, cost, downtime, failureChance, failureRange, planned: false, blocksProduction: true };
  }

  function repairTechnician(state, bay, context = {}) {
    const machine = machineAt(state, bay);
    const record = recordAt(state, bay);
    if (!machine || !record || !record.fault || !['warning', 'major_failure'].includes(record.status)) return null;
    const numbers = repairNumbers(record, 'technician');
    const arrivalRange = numbers.arrivalRange;
    const arrivalMinutes = Math.round(arrivalRange.min + randomValue(state) * (arrivalRange.max - arrivalRange.min));
    const downtime = arrivalMinutes + numbers.repairMinutes;
    const fault = record.fault;
    startRepair(record, downtime, false, 'technician', false, {
      ...context,
      technicianArrivalMinutes: arrivalMinutes,
      technicianRepairMinutes: numbers.repairMinutes
    });
    return {
      event: 'repair', method: 'technician', bay, fault, cost: numbers.cost, downtime,
      arrivalMinutes, arrivalRange, repairMinutes: numbers.repairMinutes,
      planned: false, blocksProduction: true
    };
  }

  function continueRisky(state, bay) {
    const record = recordAt(state, bay);
    if (!record || record.status !== 'warning' || record.scheduledRepair || record.riskyContinue) return null;
    record.riskyContinue = true;
    return { event: 'continue_risky', bay, fault: record.fault, severity: record.severity, riskFactor: 1.5 };
  }

  function scheduleRepair(state, bay) {
    const machine = machineAt(state, bay);
    const record = recordAt(state, bay);
    if (!machine || machineHasJob(machine) || !record || !record.fault || !['warning', 'major_failure'].includes(record.status) || record.scheduledRepair) return null;
    const { cost, downtime } = repairNumbers(record, 'planned');
    record.riskyContinue = false;
    record.scheduledRepair = false;
    startRepair(record, downtime, true, 'planned', false, {});
    return {
      event: 'repair_scheduled', bay, fault: record.fault, cost, downtime,
      planned: true, scheduledAfterJob: false, blocksProduction: true
    };
  }

  function isOperating(machine, bay, state, context) {
    if (state.paused) return false;
    if (context && Array.isArray(context.operatingBays)) return context.operatingBays.includes(bay);
    if (context && context.operatingBays instanceof Set) return context.operatingBays.has(bay);
    if (context && typeof context.isOperating === 'function') return context.isOperating(machine, state) === true;
    return machine.operating === true || machine.isOperating === true || machine.running === true;
  }

  function randomValue(state) {
    const source = randomSources.get(state);
    const value = (source || Math.random)();
    return Number.isFinite(value) ? clamp(value, 0, 0.999999999999) : Math.random();
  }

  function probabilityFor(ratePerHour, minutes) {
    if (!(ratePerHour > 0) || !(minutes > 0)) return 0;
    return clamp(1 - Math.exp(-ratePerHour * minutes / MINUTES_PER_HOUR), 0, 1);
  }

  function eventTime(state, dt) {
    return (Number.isFinite(state.gameMinutes) ? state.gameMinutes : 0) + dt;
  }

  function makeWarning(state, machine, record, bay, dt) {
    const ids = Object.keys(faults);
    const fault = ids[Math.floor(randomValue(state) * ids.length)];
    const info = faults[fault];
    record.status = 'warning';
    record.fault = fault;
    record.severity = 1;
    record.since = eventTime(state, dt);
    record.riskyContinue = false;
    record.scheduledRepair = false;
    record.selfRepairFailed = false;
    record.warningAgeMinutes = 0;
    return {
      event: 'warning', bay, fault, faultLabel: info.label, severity: 1,
      since: record.since, costEstimate: info.cost, downtimeEstimate: info.downtime
    };
  }

  function makeMajorFailure(state, machine, record, bay, dt) {
    const info = faults[record.fault];
    const fromRiskyContinue = record.riskyContinue === true;
    record.status = 'major_failure';
    record.severity = Math.max(2, record.severity + 1);
    record.since = eventTime(state, dt);
    record.riskyContinue = false;
    record.scheduledRepair = false;
    const cost = Math.round(info.cost * 2.25 + 600);
    const downtime = Math.round(info.downtime * 3 + 50);
    const hasProducedParts = Number.isFinite(machine.produced) && machine.produced > 0;
    const scrapParts = hasProducedParts && randomValue(state) < info.scrapChance ? 1 : 0;
    return {
      event: 'major_failure', bay, fault: record.fault, faultLabel: info.label,
      severity: record.severity, since: record.since, cost, downtime, scrapParts,
      fromRiskyContinue, blocksProduction: true
    };
  }

  function makeSuddenFailure(state, machine, record, bay, dt) {
    const ids = Object.keys(faults);
    record.fault = ids[Math.floor(randomValue(state) * ids.length)];
    const info = faults[record.fault];
    record.status = 'major_failure';
    record.severity = 2;
    record.since = eventTime(state, dt);
    record.riskyContinue = false;
    record.scheduledRepair = false;
    record.selfRepairFailed = false;
    record.warningAgeMinutes = 0;
    const cost = Math.round(info.cost * 2.6 + 750);
    const downtime = Math.round(info.downtime * 3.6 + 55);
    const hasProducedParts = Number.isFinite(machine.produced) && machine.produced > 0;
    const scrapParts = hasProducedParts && randomValue(state) < info.scrapChance ? 1 : 0;
    return {
      event: 'major_failure', sudden: true, bay, fault: record.fault, faultLabel: info.label,
      severity: 2, since: record.since, cost, downtime, scrapParts, blocksProduction: true
    };
  }

  function canContinueProduction(state, bay) {
    const machine = machineAt(state, bay);
    const record = recordAt(state, bay);
    if (!machine) return false;
    if (!record || record.status === 'ok') return true;
    return record.status === 'warning' && (record.riskyContinue || record.scheduledRepair);
  }

  function tick(state, dt, context) {
    if (!ensureReady(state)) return [];
    const minutes = Number.isFinite(dt) && dt > 0 ? dt : 0;
    const events = [];
    const now = eventTime(state, minutes);

    for (const machine of machineList(state)) {
      const bay = bayOf(machine);
      if (bay === null) continue;
      const record = state.breakdowns.machines[String(bay)];
      if (!record) continue;

      if (record.status === 'repairing') {
        const arrivalBefore = record.technicianArrivalRemainingMinutes;
        record.repairRemainingMinutes = Math.max(0, record.repairRemainingMinutes - minutes);
        if (record.repairMethod === 'technician' && arrivalBefore > 0) {
          record.technicianArrivalRemainingMinutes = Math.max(0, arrivalBefore - minutes);
          if (record.technicianArrivalRemainingMinutes <= 0 && record.repairRemainingMinutes > 0) {
            events.push({
              event: 'technician_arrived', bay, fault: record.fault,
              repairMinutes: record.technicianRepairMinutes,
              blocksProduction: true
            });
          }
        }
        if (record.repairRemainingMinutes <= 0) {
          const fault = record.fault;
          const completedMethod = record.repairMethod;
          const repairEmployeeId = record.repairEmployeeId;
          const selfRepairFailed = completedMethod === 'self' && record.repairWillFail;
          record.riskyContinue = false;
          record.scheduledRepair = false;
          record.warningAgeMinutes = 0;
          record.repairRemainingMinutes = 0;
          record.plannedRepair = false;
          record.repairMethod = null;
          record.repairWillFail = false;
          record.technicianArrivalRemainingMinutes = 0;
          record.technicianRepairMinutes = 0;
          record.repairEmployeeId = null;
          if (selfRepairFailed) {
            record.selfRepairFailed = true;
            record.status = record.severity >= 2 ? 'major_failure' : 'warning';
            record.since = now;
            events.push({
              event: record.status === 'major_failure' ? 'major_failure' : 'warning',
              selfRepairFailed: true, repairEmployeeId, bay, fault, severity: record.severity, since: now,
              blocksProduction: true
            });
          } else {
            record.selfRepairFailed = false;
            record.status = 'ok';
            record.fault = null;
            record.severity = 0;
            record.since = null;
            events.push({ event: 'repair_complete', bay, fault, method: completedMethod, repairEmployeeId, blocksProduction: false });
          }
        }
        continue;
      }

      if (record.scheduledRepair && !machineHasJob(machine)) {
        const { downtime } = repairNumbers(record, 'planned');
        const fault = record.fault;
        startRepair(record, downtime, true, 'planned', false);
        events.push({ event: 'repair_started', bay, fault, downtime, planned: true, cost: 0, blocksProduction: true });
        continue;
      }

      if (!minutes || !isOperating(machine, bay, state, context)) continue;
      const hours = minutes / MINUTES_PER_HOUR;
      const factors = conditionFactors(state, machine, record, context);
      record.operatingHours += hours;

      if (record.status === 'ok') {
        const rate = BASE_WARNING_RATE_PER_HOUR * factors.maintenanceFactor * factors.toolFactor * factors.runtimeFactor * factors.reliabilityFactor;
        if (randomValue(state) < probabilityFor(rate, minutes)) events.push(makeWarning(state, machine, record, bay, minutes));
        else {
          const crashRate = BASE_SUDDEN_FAILURE_RATE_PER_HOUR * factors.maintenanceFactor * factors.toolFactor * factors.runtimeFactor * factors.reliabilityFactor;
          if (randomValue(state) < probabilityFor(crashRate, minutes)) events.push(makeSuddenFailure(state, machine, record, bay, minutes));
        }
      } else if (record.status === 'warning' && record.riskyContinue) {
        record.warningAgeMinutes += minutes;
        const continuedRiskFactor = 1.5 + Math.min(1.5, record.warningAgeMinutes / 120);
        const rate = BASE_ESCALATION_RATE_PER_HOUR * factors.maintenanceFactor * factors.toolFactor * factors.runtimeFactor * factors.reliabilityFactor * continuedRiskFactor;
        if (randomValue(state) < probabilityFor(rate, minutes)) events.push(makeMajorFailure(state, machine, record, bay, minutes));
      }
    }
    return events;
  }

  return Object.freeze({
    init,
    tick,
    getStatus,
    getFault,
    getFaultInfo,
    getRecord,
    getRiskProfile,
    getRepairOptions,
    canContinueProduction,
    repairNow,
    repairSelf,
    repairTechnician,
    continueRisky,
    scheduleRepair
  });
});

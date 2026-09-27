(function attachProgrammingQuality(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.programmingQuality = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createProgrammingQuality() {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function programKey(order) {
    if (!order || typeof order !== 'object') return null;
    const part = typeof order.partKey === 'string' && order.partKey
      ? order.partKey
      : typeof order.part === 'string' ? order.part.trim().toLocaleLowerCase('de-DE') : '';
    return part ? `${order.kind || 'Drehen'}:${part}` : null;
  }

  function programmingMinutes(order, method = 'programmer') {
    const difficulty = clamp(Math.floor(Number(order?.difficulty) || 1), 1, 5);
    const quantity = Math.max(1, Number(order?.qty) || 1);
    const duration = Math.max(0, Number(order?.duration) || 0);
    const base = 60 + (difficulty - 1) * 24 + (order?.kind === 'Fräsen' ? 30 : 0) +
      Math.min(60, quantity * .5) + Math.min(45, duration * .1);
    const multiplier = method === 'operator' ? 1.25 : 1;
    return Math.min(method === 'operator' ? 300 : 240, Math.ceil(base * multiplier / 15) * 15);
  }

  function toleranceClass(order) {
    const difficulty = clamp(Math.floor(Number(order?.difficulty) || 1), 1, 5);
    return ['IT11', 'IT10', 'IT9', 'IT8', 'IT7'][difficulty - 1];
  }

  function riskPercent({ order, machine, precision = 5, trained = 0, timePressure = 0 } = {}) {
    const difficulty = clamp(Math.floor(Number(order?.difficulty) || 1), 1, 5);
    const tool = clamp(Number(machine?.tool) || 0, 0, 100);
    const maintenance = clamp(Number(machine?.maintenance) || 0, 0, 100);
    let risk = 4 + (difficulty - 1) * 2.6 + (order?.kind === 'Fräsen' ? 1.5 : 0);
    risk += Math.max(0, 70 - tool) * .12;
    risk += Math.max(0, 75 - maintenance) * .09;
    risk -= (clamp(Number(precision) || 5, 1, 10) - 5) * .75;
    risk -= clamp(Number(trained) || 0, 0, 3) * .6;
    risk += clamp(Number(timePressure) || 0, 0, 5);
    return Math.round(clamp(risk, 2, 28));
  }

  function defectParts(order, risk, randomValue = Math.random()) {
    if (!order || randomValue >= clamp(Number(risk) || 0, 0, 100) / 100) return 0;
    const quantity = Math.max(1, Math.floor(Number(order.qty) || 1));
    const fraction = Math.min(.1, .015 + clamp(Number(risk) || 0, 0, 100) / 800);
    return Math.min(quantity, Math.max(1, Math.ceil(quantity * fraction)));
  }

  return Object.freeze({ programKey, programmingMinutes, toleranceClass, riskPercent, defectParts });
});

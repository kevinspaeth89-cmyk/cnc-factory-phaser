/* Material catalogue and compatibility for orders saved before typed stock. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.materials = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const catalog = Object.freeze({
    c45: Object.freeze({ label: 'C45 Stahl', pricePer100Kg: 1800, oldCategory: 'steel' }),
    steel42crmo4: Object.freeze({ label: '42CrMo4 Stahl', pricePer100Kg: 2500, oldCategory: 'steel' }),
    stainless14301: Object.freeze({ label: '1.4301 Edelstahl', pricePer100Kg: 3400, oldCategory: 'stainless' }),
    stainless14404: Object.freeze({ label: '1.4404 Edelstahl', pricePer100Kg: 4000, oldCategory: 'stainless' }),
    aluminium6082: Object.freeze({ label: 'EN AW-6082 Aluminium', pricePer100Kg: 2700, oldCategory: 'aluminium' }),
    castiron400: Object.freeze({ label: 'EN-GJS-400 Gusseisen', pricePer100Kg: 1600, oldCategory: 'castiron' })
  });
  function typeForOrder(order) {
    if (order && Object.hasOwn(catalog, order.materialType)) return order.materialType;
    const name = String(order?.material || '');
    if (/1\.4301/i.test(name)) return 'stainless14301';
    if (/1\.4404/i.test(name)) return 'stainless14404';
    if (/42crmo4/i.test(name)) return 'steel42crmo4';
    if (/c45/i.test(name)) return 'c45';
    if (/en aw-6082/i.test(name)) return 'aluminium6082';
    if (/en-gjs-400/i.test(name)) return 'castiron400';
    return null;
  }
  const requiredKg = order => Number.isFinite(order?.materialAmountKg) ? order.materialAmountKg : order?.kg;
  function available(state, order) {
    const stock = state?.inventory?.rawMaterial || {};
    const type = typeForOrder(order);
    return type ? (stock[type] || 0) + (stock[catalog[type].oldCategory] || 0) + (stock.legacy || 0) : (stock.legacy || 0);
  }
  function marketMultiplier(type, gameMinutes = 0) {
    if (!Object.hasOwn(catalog, type)) return null;
    const day = Math.max(0, Math.floor((Number(gameMinutes) || 0) / 1440));
    if (!day) return 1;
    const index = Object.keys(catalog).indexOf(type) + 1;
    const hash = (Math.imul(day, 1664525) ^ Math.imul(index, 1013904223)) >>> 0;
    return (80 + hash % 41) / 100;
  }
  function quote(type, quantityKg, gameMinutes = 0) {
    if (!Object.hasOwn(catalog, type) || ![25, 100].includes(quantityKg)) return null;
    return Math.round(catalog[type].pricePer100Kg * quantityKg / 100 * marketMultiplier(type, gameMinutes));
  }
  function reserve(state, inventory, order) {
    const quantity = requiredKg(order),type = typeForOrder(order);
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, code: 'invalid_amount' };
    if (!type) return { ok: false, code: 'unknown_material' };
    if (available(state,order) + 1e-9 < quantity) return { ok: false, code: 'insufficient_stock' };
    const stock = state.inventory.rawMaterial,consumed = {};
    let remaining = quantity;
    for (const source of [type,catalog[type].oldCategory,'legacy']) {
      const take = Math.min(stock[source] || 0, remaining);
      if (take <= 0) continue;
      const removed = inventory.removeMaterial(state,source,take);
      if (!removed.ok) {
        for (const [savedType,amount] of Object.entries(consumed)) inventory.addMaterial(state,savedType,amount);
        return removed;
      }
      consumed[source] = take;
      remaining = Math.max(0,remaining-take);
      if (remaining <= 1e-9) break;
    }
    return { ok: true, code: 'ok', consumed };
  }
  return Object.freeze({ catalog, typeForOrder, requiredKg, available, marketMultiplier, quote, reserve });
});

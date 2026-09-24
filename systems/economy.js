/* CNC Factory economy and inventory foundation.
 * Works in the browser as CNCModules.economy / CNCModules.inventory and in Node tests.
 */
(function attachCncModules(root, factory) {
  const modules = root.CNCModules || (root.CNCModules = {});
  const api = factory();
  modules.inventory = api.inventory;
  modules.economy = api.economy;
  if (typeof module === 'object' && module.exports) module.exports = modules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createApi() {
  'use strict';

  const DEFAULT_CAPACITIES = Object.freeze({ raw: 500, finished: 300, tools: 50 });
  const DEFAULT_MATERIALS = Object.freeze({ steel: 0, stainless: 0, aluminium: 0 });
  const DEFAULT_TOOLS = Object.freeze({ turningInsert: 0, millingInsert: 0 });
  const CATEGORIES = Object.freeze([
    'income', 'material', 'wages', 'energy', 'tools', 'maintenance', 'repairs',
    'storage', 'machine_purchase', 'machine_sale', 'factory_expansion', 'other'
  ]);
  const CATEGORY_ALIASES = Object.freeze({ tool: 'tools', repair: 'repairs' });
  const STORAGE_ALIASES = Object.freeze({
    raw: 'raw', rawMaterial: 'raw',
    finished: 'finished', finishedParts: 'finished',
    tools: 'tools'
  });
  const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isValidKey = key => typeof key === 'string' && /^[a-z][a-z0-9_-]{0,39}$/i.test(key) && !RESERVED_KEYS.has(key);
  const roundStock = value => Math.round((value + Number.EPSILON) * 1e6) / 1e6;
  const positiveNumber = value => Number.isFinite(value) && value > 0;
  const nonNegativeNumber = value => Number.isFinite(value) && value >= 0;

  function cloneJsonObject(value) {
    if (value === undefined || value === null) return { ok: true, value: {} };
    if (!isRecord(value)) return { ok: false, value: null };
    try {
      const cloned = JSON.parse(JSON.stringify(value));
      return isRecord(cloned) ? { ok: true, value: cloned } : { ok: false, value: null };
    } catch (_) {
      return { ok: false, value: null };
    }
  }

  function ensureStateObject(state, property) {
    if (!isRecord(state)) return null;
    if (!isRecord(state[property])) state[property] = {};
    return state[property];
  }

  function ensureInventory(state) {
    const inventory = ensureStateObject(state, 'inventory');
    if (!inventory) return null;

    if (!isRecord(inventory.rawMaterial)) inventory.rawMaterial = {};
    for (const [key, amount] of Object.entries(DEFAULT_MATERIALS)) {
      if (!nonNegativeNumber(inventory.rawMaterial[key])) inventory.rawMaterial[key] = amount;
    }
    normalizeStockMap(inventory.rawMaterial);

    if (!Array.isArray(inventory.finishedParts)) inventory.finishedParts = [];
    inventory.finishedParts = normalizeFinishedParts(inventory.finishedParts);

    if (!isRecord(inventory.tools)) inventory.tools = {};
    for (const [key, amount] of Object.entries(DEFAULT_TOOLS)) {
      if (!nonNegativeNumber(inventory.tools[key])) inventory.tools[key] = amount;
    }
    normalizeStockMap(inventory.tools);

    if (!isRecord(inventory.capacities)) inventory.capacities = {};
    for (const [key, amount] of Object.entries(DEFAULT_CAPACITIES)) {
      if (!nonNegativeNumber(inventory.capacities[key])) inventory.capacities[key] = amount;
    }
    for (const key of ['raw', 'finished', 'tools']) {
      inventory.capacities[key] = roundStock(inventory.capacities[key]);
    }
    return inventory;
  }

  function normalizeStockMap(map) {
    for (const key of Object.keys(map)) {
      if (!isValidKey(key) || !nonNegativeNumber(map[key])) {
        delete map[key];
      } else {
        map[key] = roundStock(map[key]);
      }
    }
  }

  function normalizeFinishedParts(parts) {
    const normalized = [];
    const byId = new Map();
    for (const entry of parts) {
      if (!isRecord(entry)) continue;
      const id = entry.id ?? entry.partId;
      if (!isValidKey(id) || !positiveNumber(entry.quantity)) continue;
      const quantity = roundStock(entry.quantity);
      const meta = cloneJsonObject(entry.meta);
      const cleanMeta = meta.ok ? meta.value : {};
      if (byId.has(id)) {
        const previous = normalized[byId.get(id)];
        previous.quantity = roundStock(previous.quantity + quantity);
        if (!Object.keys(previous.meta).length && Object.keys(cleanMeta).length) previous.meta = cleanMeta;
      } else {
        byId.set(id, normalized.length);
        normalized.push({ id, quantity, meta: cleanMeta });
      }
    }
    return normalized;
  }

  function ensureFinance(state) {
    const finance = ensureStateObject(state, 'finance');
    if (!finance) return null;
    if (!Array.isArray(finance.transactions)) finance.transactions = [];
    if (finance.currentTime !== undefined && finance.currentTime !== null) {
      finance.currentTime = toTimestamp(finance.currentTime);
    }
    return finance;
  }

  function ensureState(state) {
    if (!isRecord(state)) return { ok: false, code: 'invalid_state' };
    const inventory = ensureInventory(state);
    const finance = ensureFinance(state);
    return { ok: true, inventory, finance };
  }

  function getGroup(inventory, category) {
    const canonical = STORAGE_ALIASES[category];
    if (!canonical) return null;
    if (canonical === 'raw') return { key: 'raw', map: inventory.rawMaterial };
    if (canonical === 'tools') return { key: 'tools', map: inventory.tools };
    return { key: 'finished', list: inventory.finishedParts };
  }

  function currentUsage(inventory, category) {
    if (category === 'raw') return roundStock(Object.values(inventory.rawMaterial).reduce((sum, qty) => sum + qty, 0));
    if (category === 'tools') return roundStock(Object.values(inventory.tools).reduce((sum, qty) => sum + qty, 0));
    return roundStock(inventory.finishedParts.reduce((sum, part) => sum + part.quantity, 0));
  }

  function stockResult(ok, code, category, type, amount, inventory, extra = {}) {
    const usage = category ? currentUsage(inventory, category) : 0;
    const capacity = category ? inventory.capacities[category] : 0;
    const stock = category === 'finished'
      ? (inventory.finishedParts.find(part => part.id === type)?.quantity || 0)
      : (category && inventory[category === 'raw' ? 'rawMaterial' : 'tools'][type]) || 0;
    return { ok, code, category, type, amount, stock, usage, capacity, ...extra };
  }

  function changeCount(state, groupName, type, amount, direction) {
    const inventory = ensureInventory(state);
    if (!inventory) return { ok: false, code: 'invalid_state' };
    const group = getGroup(inventory, groupName);
    if (!group || group.key === 'finished') return { ok: false, code: 'invalid_storage' };
    if (!isValidKey(type)) return stockResult(false, 'invalid_type', group.key, type, amount, inventory);
    if (!positiveNumber(amount)) return stockResult(false, 'invalid_amount', group.key, type, amount, inventory);

    const oldAmount = group.map[type] || 0;
    if (direction < 0) {
      if (oldAmount + 1e-9 < amount) {
        return stockResult(false, 'insufficient_stock', group.key, type, amount, inventory, { available: oldAmount });
      }
      group.map[type] = roundStock(Math.max(0, oldAmount - amount));
      return stockResult(true, 'ok', group.key, type, amount, inventory);
    }

    const used = currentUsage(inventory, group.key);
    const available = Math.max(0, roundStock(inventory.capacities[group.key] - used));
    if (amount > available + 1e-9) {
      return stockResult(false, 'capacity_exceeded', group.key, type, amount, inventory, { available });
    }
    group.map[type] = roundStock(oldAmount + amount);
    return stockResult(true, 'ok', group.key, type, amount, inventory);
  }

  function addFinishedParts(state, partId, quantity = 1, meta = {}) {
    const inventory = ensureInventory(state);
    if (!inventory) return { ok: false, code: 'invalid_state' };
    if (!isValidKey(partId)) return stockResult(false, 'invalid_type', 'finished', partId, quantity, inventory);
    if (!positiveNumber(quantity)) return stockResult(false, 'invalid_amount', 'finished', partId, quantity, inventory);
    const clonedMeta = cloneJsonObject(meta);
    if (!clonedMeta.ok) return stockResult(false, 'invalid_meta', 'finished', partId, quantity, inventory);
    const used = currentUsage(inventory, 'finished');
    const available = Math.max(0, roundStock(inventory.capacities.finished - used));
    if (quantity > available + 1e-9) {
      return stockResult(false, 'capacity_exceeded', 'finished', partId, quantity, inventory, { available });
    }
    const entry = inventory.finishedParts.find(part => part.id === partId);
    if (entry) {
      entry.quantity = roundStock(entry.quantity + quantity);
      if (!Object.keys(entry.meta).length && Object.keys(clonedMeta.value).length) entry.meta = clonedMeta.value;
    } else {
      inventory.finishedParts.push({ id: partId, quantity: roundStock(quantity), meta: clonedMeta.value });
    }
    return stockResult(true, 'ok', 'finished', partId, quantity, inventory);
  }

  function removeFinishedParts(state, partId, quantity = 1) {
    const inventory = ensureInventory(state);
    if (!inventory) return { ok: false, code: 'invalid_state' };
    if (!isValidKey(partId)) return stockResult(false, 'invalid_type', 'finished', partId, quantity, inventory);
    if (!positiveNumber(quantity)) return stockResult(false, 'invalid_amount', 'finished', partId, quantity, inventory);
    const entry = inventory.finishedParts.find(part => part.id === partId);
    const available = entry?.quantity || 0;
    if (available + 1e-9 < quantity) {
      return stockResult(false, 'insufficient_stock', 'finished', partId, quantity, inventory, { available });
    }
    entry.quantity = roundStock(Math.max(0, entry.quantity - quantity));
    if (entry.quantity <= 0) inventory.finishedParts.splice(inventory.finishedParts.indexOf(entry), 1);
    return stockResult(true, 'ok', 'finished', partId, quantity, inventory);
  }

  function expandCapacity(state, storageType, additionalCapacity, cost = 0) {
    const inventory = ensureInventory(state);
    if (!inventory) return { ok: false, code: 'invalid_state' };
    const category = Object.hasOwn(STORAGE_ALIASES, storageType) ? STORAGE_ALIASES[storageType] : null;
    if (!category) return { ok: false, code: 'invalid_storage', storageType };
    if (!positiveNumber(additionalCapacity)) return { ok: false, code: 'invalid_amount', storageType, additionalCapacity };
    if (!nonNegativeNumber(cost)) return { ok: false, code: 'invalid_cost', storageType, cost };
    inventory.capacities[category] = roundStock(inventory.capacities[category] + additionalCapacity);
    return {
      ok: true,
      code: 'ok',
      storageType: category,
      additionalCapacity: roundStock(additionalCapacity),
      capacity: inventory.capacities[category],
      cost: roundStock(cost)
    };
  }

  function getInventoryUsage(state) {
    const inventory = ensureInventory(state);
    if (!inventory) return { ok: false, code: 'invalid_state' };
    const usage = {
      raw: currentUsage(inventory, 'raw'),
      finished: currentUsage(inventory, 'finished'),
      tools: currentUsage(inventory, 'tools')
    };
    return {
      ok: true,
      usage,
      capacities: { ...inventory.capacities },
      remaining: {
        raw: roundStock(Math.max(0, inventory.capacities.raw - usage.raw)),
        finished: roundStock(Math.max(0, inventory.capacities.finished - usage.finished)),
        tools: roundStock(Math.max(0, inventory.capacities.tools - usage.tools))
      },
      overCapacity: {
        raw: usage.raw > inventory.capacities.raw,
        finished: usage.finished > inventory.capacities.finished,
        tools: usage.tools > inventory.capacities.tools
      }
    };
  }

  function toTimestamp(value) {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return Number.isFinite(value) ? value : null;
  }

  function normalizeCategory(category) {
    if (typeof category !== 'string') return null;
    const trimmed = category.trim();
    const aliased = Object.hasOwn(CATEGORY_ALIASES, trimmed) ? CATEGORY_ALIASES[trimmed] : trimmed;
    return isValidKey(aliased) && /^[a-z][a-z0-9_]{0,39}$/i.test(aliased) ? aliased : null;
  }

  function setTime(state, time) {
    const finance = ensureFinance(state);
    if (!finance) return { ok: false, code: 'invalid_state' };
    const timestamp = toTimestamp(time);
    if (timestamp === null) return { ok: false, code: 'invalid_time' };
    finance.currentTime = timestamp;
    return { ok: true, time: timestamp };
  }

  function record(state, category, amount, description, meta = {}) {
    const finance = ensureFinance(state);
    if (!finance) return { ok: false, code: 'invalid_state' };
    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) return { ok: false, code: 'invalid_category' };
    if (!Number.isFinite(amount) || amount === 0) return { ok: false, code: 'invalid_amount' };
    if (typeof description !== 'string' || !description.trim()) return { ok: false, code: 'invalid_description' };
    const clonedMeta = cloneJsonObject(meta);
    if (!clonedMeta.ok) return { ok: false, code: 'invalid_meta' };
    const time = finance.currentTime ?? Date.now();
    const transaction = {
      time,
      category: normalizedCategory,
      amount: roundStock(amount),
      text: description.trim(),
      meta: clonedMeta.value
    };
    finance.transactions.push(transaction);
    return { ok: true, transaction: { ...transaction, meta: { ...transaction.meta } } };
  }

  function validTransactions(state) {
    const finance = ensureFinance(state);
    if (!finance) return [];
    return finance.transactions.filter(transaction => isRecord(transaction) &&
      toTimestamp(transaction.time) !== null && Number.isFinite(transaction.amount) &&
      normalizeCategory(transaction.category) !== null);
  }

  function transactionTime(transaction) {
    return toTimestamp(transaction.time);
  }

  function rangeTotals(state, from, to) {
    const fromTime = from === undefined || from === null ? -Infinity : toTimestamp(from);
    const toTime = to === undefined || to === null ? Infinity : toTimestamp(to);
    if (fromTime === null || toTime === null || fromTime > toTime) return { transactions: [], from: fromTime, to: toTime };
    const transactions = validTransactions(state).filter(transaction => {
      const time = transactionTime(transaction);
      return time >= fromTime && time <= toTime;
    });
    return { transactions, from: fromTime, to: toTime };
  }

  function getProfit(state, from, to) {
    const { transactions } = rangeTotals(state, from, to);
    return roundStock(transactions.reduce((sum, transaction) => sum + transaction.amount, 0));
  }

  function getCategoryTotals(state, from, to) {
    const totals = Object.fromEntries(CATEGORIES.map(category => [category, 0]));
    const { transactions } = rangeTotals(state, from, to);
    for (const transaction of transactions) {
      const category = normalizeCategory(transaction.category);
      totals[category] = roundStock((totals[category] || 0) + transaction.amount);
    }
    return totals;
  }

  function referenceTime(state, at) {
    const explicit = at === undefined || at === null ? null : toTimestamp(at);
    if (explicit !== null) return explicit;
    const finance = ensureFinance(state);
    if (!finance) return Date.now();
    if (finance.currentTime !== null && finance.currentTime !== undefined) return finance.currentTime;
    const transactions = validTransactions(state);
    return transactions.length ? transactionTime(transactions[transactions.length - 1]) : Date.now();
  }

  function periodSummary(state, at, mode) {
    const time = referenceTime(state, at);
    const date = new Date(time);
    const start = mode === 'day'
      ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      : Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const next = mode === 'day'
      ? start + 24 * 60 * 60 * 1000
      : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    const from = start;
    const to = next - 1;
    const { transactions } = rangeTotals(state, from, to);
    const categoryTotals = getCategoryTotals(state, from, to);
    return {
      period: mode,
      from,
      to,
      transactionCount: transactions.length,
      categoryTotals,
      profit: roundStock(transactions.reduce((sum, transaction) => sum + transaction.amount, 0)),
      transactions: transactions.map(transaction => ({ ...transaction, meta: { ...(transaction.meta || {}) } }))
    };
  }

  const inventory = Object.freeze({
    ensure: ensureInventory,
    addMaterial: (state, materialType, quantityKg) => changeCount(state, 'raw', materialType, quantityKg, 1),
    removeMaterial: (state, materialType, quantityKg) => changeCount(state, 'raw', materialType, quantityKg, -1),
    addTool: (state, toolType, quantity) => changeCount(state, 'tools', toolType, quantity, 1),
    consumeTool: (state, toolType, quantity) => changeCount(state, 'tools', toolType, quantity, -1),
    addFinishedParts,
    removeFinishedParts,
    expandCapacity,
    getUsage: getInventoryUsage
  });

  const economy = Object.freeze({
    categories: CATEGORIES,
    ensure: ensureFinance,
    ensureState,
    setTime,
    record,
    getDailySummary: (state, at) => periodSummary(state, at, 'day'),
    getMonthlySummary: (state, at) => periodSummary(state, at, 'month'),
    getProfit,
    getCategoryTotals
  });

  return { inventory, economy };
});

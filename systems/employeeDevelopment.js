(function (root) {
  'use strict';

  const VERSION = 1;
  const FIRST_UNLOCK_XP = 240;
  const SECOND_UNLOCK_XP = 1920;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const SPECS = Object.freeze({
    turning: { label: 'Drehtechnik', traits: ['pragmatisch', 'routineorientiert', 'anpassungsfaehig', 'flexibel'], effects: { turningSpeed: 0.12, generalSpeed: 0.025 } },
    milling: { label: 'Frästechnik', traits: ['pragmatisch', 'neugierig', 'anpassungsfaehig', 'flexibel'], effects: { millingSpeed: 0.12, generalSpeed: 0.025 } },
    precision: { label: 'Präzisionsarbeit', traits: ['gruendlich', 'bedacht'], effects: { qualityRisk: -0.12, generalSpeed: 0.025 } },
    learning: { label: 'Prozesslernen', traits: ['neugierig', 'anpassungsfaehig'], effects: { learning: 0.2, generalSpeed: 0.025 } }
  });

  function ensureState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, code: 'invalid_state' };
    const old = state.employeeDevelopment;
    state.employeeDevelopment = old && typeof old === 'object' && !Array.isArray(old)
      ? { ...old, version: VERSION }
      : { version: VERSION };
    return { ok: true, value: state.employeeDevelopment };
  }

  function personalityIds(employee) {
    if (Array.isArray(employee?.personality) && employee.personality.length) {
      return employee.personality.map(trait => typeof trait === 'string' ? trait : trait?.id).filter(Boolean);
    }
    const skills = employee?.skills || {};
    const precision = clamp(Math.round(Number(skills.precision) || 1), 1, 10);
    const turning = clamp(Math.round(Number(skills.turning) || 1), 1, 10);
    const milling = clamp(Math.round(Number(skills.milling) || 1), 1, 10);
    const learning = clamp(Math.round(Number(skills.learning) || 1), 1, 10);
    return [precision >= 8 ? 'gruendlich' : precision <= 3 ? 'pragmatisch' : 'bedacht',
      Math.abs(turning - milling) <= 1 && Math.min(turning, milling) >= 5 ? 'flexibel' : learning >= 8 ? 'neugierig' : learning <= 3 ? 'routineorientiert' : 'anpassungsfaehig'];
  }

  function progressionXp(progression) {
    if (Number.isFinite(progression)) return Math.max(0, progression);
    if (progression && typeof progression === 'object') {
      return Math.max(0, Number(progression.xp ?? progression.experience) || 0);
    }
    return 0;
  }

  function getAvailableSpecializations(employee, progression) {
    if (!employee || typeof employee !== 'object' || employee.profileType === 'quality' || !employee.skills) return [];
    const xp = progressionXp(progression);
    const assigned = Array.isArray(employee.specializations) ? employee.specializations : [];
    if (assigned.length >= 2) return [];
    if (assigned.length === 0 && xp < FIRST_UNLOCK_XP || assigned.length === 1 && xp < SECOND_UNLOCK_XP) return [];
    const traits = new Set(personalityIds(employee));
    return Object.entries(SPECS)
      .filter(([id, spec]) => !assigned.includes(id) && spec.traits.some(trait => traits.has(trait)))
      .map(([id]) => id);
  }

  function assignSpecialization(employee, specializationId, progression) {
    if (!employee || typeof employee !== 'object') return { ok: false, code: 'invalid_employee' };
    if (!Object.hasOwn(SPECS, specializationId)) return { ok: false, code: 'unknown_specialization' };
    const current = Array.isArray(employee.specializations) ? [...employee.specializations] : [];
    if (current.includes(specializationId)) return { ok: false, code: 'already_assigned' };
    if (current.length >= 2) return { ok: false, code: 'specialization_limit' };
    if (!getAvailableSpecializations(employee, progression).includes(specializationId)) {
      const xp = progressionXp(progression);
      return { ok: false, code: xp < FIRST_UNLOCK_XP ? 'progression_locked' : 'specialization_unavailable' };
    }
    current.push(specializationId);
    employee.specializations = current;
    return { ok: true, specialization: specializationId, specializations: [...current] };
  }

  function getEffects(employee, context = {}) {
    const effects = { turningSpeed: 0, millingSpeed: 0, qualityRisk: 0, learning: 0, generalSpeed: 0 };
    const applied = [];
    for (const id of Array.isArray(employee?.specializations) ? employee.specializations.slice(0, 2) : []) {
      const spec = SPECS[id];
      if (!spec) continue;
      const matches = id === 'turning' ? !context.kind || context.kind === 'Drehen'
        : id === 'milling' ? !context.kind || context.kind === 'Fräsen' : true;
      if (!matches) continue;
      applied.push(id);
      for (const [key, amount] of Object.entries(spec.effects)) effects[key] += amount;
    }
    effects.turningSpeed = clamp(effects.turningSpeed, 0, 0.15);
    effects.millingSpeed = clamp(effects.millingSpeed, 0, 0.15);
    effects.qualityRisk = clamp(effects.qualityRisk, -0.15, 0);
    effects.learning = clamp(effects.learning, 0, 0.25);
    effects.generalSpeed = clamp(effects.generalSpeed, 0, 0.05);
    return { ...effects, applied };
  }

  const api = { VERSION, FIRST_UNLOCK_XP, SECOND_UNLOCK_XP, ensureState, getAvailableSpecializations, assignSpecialization, getEffects };
  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.employeeDevelopment = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

(function (root) {
  'use strict';

  const VERSION = 1;
  const EMPLOYEE_VERSION = 1;
  const FIRST_UNLOCK_XP = 7200; // 120 production hours
  const SECOND_UNLOCK_XP = 18000; // 300 production hours
  const SPECIAL_EVENT_XP = 3600; // 60 production hours
  const MAX_SPECIALIZATIONS = 2;
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

  function ensureEmployee(employee) {
    if (!employee || typeof employee !== 'object' || Array.isArray(employee)) return { ok: false, code: 'invalid_employee' };
    const old = employee.development && typeof employee.development === 'object' && !Array.isArray(employee.development)
      ? employee.development : {};
    const assigned = Array.isArray(employee.specializations) ? employee.specializations.length : 0;
    employee.development = {
      ...old,
      version: EMPLOYEE_VERSION,
      experienceMilestonesAwarded: clamp(Math.floor(Number(old.experienceMilestonesAwarded) || 0), 0, 2),
      eventPromotionsAwarded: clamp(Math.floor(Number(old.eventPromotionsAwarded) || 0), 0, 1),
      pendingSpecializationChoices: clamp(Math.floor(Number(old.pendingSpecializationChoices) || 0), 0, Math.max(0, MAX_SPECIALIZATIONS - assigned)),
      specialEventRewardClaimed: !!old.specialEventRewardClaimed
    };
    return { ok: true, value: employee.development };
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
      const value = progression.xp ?? progression.experience;
      if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
    }
    return undefined;
  }

  function getProgress(employee, progression) {
    if (!employee || typeof employee !== 'object' || Array.isArray(employee)) return null;
    const ensured = ensureEmployee(employee);
    const development = ensured.value;
    const xp = progressionXp(progression) ?? Math.max(0, Number(employee.xp) || 0);
    const targetMilestones = xp >= SECOND_UNLOCK_XP ? 2 : xp >= FIRST_UNLOCK_XP ? 1 : 0;
    if (targetMilestones > development.experienceMilestonesAwarded) {
      const newlyEarned = targetMilestones - development.experienceMilestonesAwarded;
      const assigned = Array.isArray(employee.specializations) ? employee.specializations.length : 0;
      const availableSlots = Math.max(0, MAX_SPECIALIZATIONS - assigned - development.pendingSpecializationChoices);
      development.pendingSpecializationChoices += Math.min(newlyEarned, availableSlots);
      development.experienceMilestonesAwarded = targetMilestones;
    }
    const nextMilestoneXp = development.experienceMilestonesAwarded === 0 ? FIRST_UNLOCK_XP
      : development.experienceMilestonesAwarded === 1 ? SECOND_UNLOCK_XP : null;
    return {
      xp,
      productionHours: xp / 60,
      careerLevel: 1 + development.experienceMilestonesAwarded + development.eventPromotionsAwarded,
      experienceMilestonesAwarded: development.experienceMilestonesAwarded,
      pendingChoices: development.pendingSpecializationChoices,
      nextMilestoneXp,
      specialEventAvailable: xp >= SPECIAL_EVENT_XP && !development.specialEventRewardClaimed
        && development.pendingSpecializationChoices === 0
        && (Array.isArray(employee.specializations) ? employee.specializations.length : 0) < MAX_SPECIALIZATIONS
    };
  }

  function getAvailableSpecializations(employee, progression) {
    if (!employee || typeof employee !== 'object' || employee.profileType === 'quality' || !employee.skills) return [];
    const progress = getProgress(employee, progression);
    if (!progress || progress.pendingChoices <= 0) return [];
    const assigned = Array.isArray(employee.specializations) ? employee.specializations : [];
    if (assigned.length >= MAX_SPECIALIZATIONS) return [];
    const traits = new Set(personalityIds(employee));
    return Object.entries(SPECS)
      .filter(([id, spec]) => !assigned.includes(id) && spec.traits.some(trait => traits.has(trait)))
      .map(([id]) => id);
  }

  function awardSpecialEvent(employee, eventType, progression) {
    if (!employee || typeof employee !== 'object' || Array.isArray(employee)) return { ok: false, code: 'invalid_employee' };
    if (eventType !== 'successful_self_repair') return { ok: false, code: 'unknown_event' };
    const progress = getProgress(employee, progression);
    const development = employee.development;
    if (progress.xp < SPECIAL_EVENT_XP) return { ok: false, code: 'experience_locked' };
    if (development.specialEventRewardClaimed) return { ok: false, code: 'event_already_awarded' };
    if (progress.pendingChoices > 0) return { ok: false, code: 'level_up_pending' };
    const assigned = Array.isArray(employee.specializations) ? employee.specializations.length : 0;
    if (assigned >= MAX_SPECIALIZATIONS) return { ok: false, code: 'specialization_limit' };
    development.specialEventRewardClaimed = true;
    development.eventPromotionsAwarded = 1;
    development.pendingSpecializationChoices += 1;
    return { ok: true, event: eventType, careerLevel: 1 + development.experienceMilestonesAwarded + development.eventPromotionsAwarded, pendingChoices: development.pendingSpecializationChoices };
  }

  function assignSpecialization(employee, specializationId, progression) {
    if (!employee || typeof employee !== 'object') return { ok: false, code: 'invalid_employee' };
    if (!Object.hasOwn(SPECS, specializationId)) return { ok: false, code: 'unknown_specialization' };
    const current = Array.isArray(employee.specializations) ? [...employee.specializations] : [];
    if (current.includes(specializationId)) return { ok: false, code: 'already_assigned' };
    if (current.length >= MAX_SPECIALIZATIONS) return { ok: false, code: 'specialization_limit' };
    const progress = getProgress(employee, progression);
    if (!progress || progress.pendingChoices <= 0) return { ok: false, code: 'progression_locked' };
    if (!getAvailableSpecializations(employee, progression).includes(specializationId)) {
      return { ok: false, code: 'specialization_unavailable' };
    }
    current.push(specializationId);
    employee.specializations = current;
    employee.development.pendingSpecializationChoices = Math.max(0, employee.development.pendingSpecializationChoices - 1);
    return { ok: true, specialization: specializationId, specializations: [...current], careerLevel: progress.careerLevel, pendingChoices: employee.development.pendingSpecializationChoices };
  }

  function getEffects(employee, context = {}) {
    const effects = { turningSpeed: 0, millingSpeed: 0, qualityRisk: 0, learning: 0, generalSpeed: 0 };
    const applied = [];
    for (const id of Array.isArray(employee?.specializations) ? employee.specializations.slice(0, MAX_SPECIALIZATIONS) : []) {
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

  const api = { VERSION, FIRST_UNLOCK_XP, SECOND_UNLOCK_XP, SPECIAL_EVENT_XP, MAX_SPECIALIZATIONS, ensureState, ensureEmployee, getProgress, getAvailableSpecializations, awardSpecialEvent, assignSpecialization, getEffects };
  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.employeeDevelopment = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

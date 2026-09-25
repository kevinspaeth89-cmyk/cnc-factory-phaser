(function attachRecruitment(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.recruitment = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createRecruitment() {
  'use strict';

  const APPLICANT_COUNT = 3;
  const FIRST_NAMES = ['Mira', 'Tarek', 'Elira', 'Joren', 'Vaska', 'Neris', 'Kael', 'Zora', 'Fenja', 'Orin', 'Tavik', 'Sera', 'Kiro', 'Liora', 'Bran', 'Yuna', 'Darek', 'Aven', 'Tyra', 'Eron'];
  const FAMILY_NAMES = ['Stahlwind', 'Spindelruh', 'Kupferhand', 'Funkenfels', 'Drehkamm', 'Eisenherz', 'Maßstern', 'Werkfink', 'Schneidorn', 'Spanlauf', 'Feilensang', 'Fräsborn', 'Bohrhain', 'Zirkelkind', 'Taktvoll', 'Kühlwasser', 'Zahnrad', 'Stahlfeder', 'Kantenschliff', 'Werkglanz'];
  const PORTRAIT_COUNT = 8;
  const QUALITY = {
    turning: { label: 'Drehen', trait: 'Späneflüsterer', about: 'erkennt am Schnittgeräusch, wenn die Drehbearbeitung sauber läuft' },
    milling: { label: 'Fräsen', trait: 'Werkstatt-Tüftler', about: 'findet sichere Wege für anspruchsvolle Fräsaufgaben' },
    precision: { label: 'Präzision', trait: 'Maßhüter', about: 'prüft Maße sorgfältig und hält enge Toleranzen' },
    learning: { label: 'Lerntempo', trait: 'Tempo im Blut', about: 'eignet sich neue Abläufe schnell an' }
  };
  const LEGACY_NAMES = ['Mira Altspan', 'Tarek Stahlwind', 'Elira Kupferhand', 'Joren Maßstern', 'Vaska Spindelruh', 'Neris Werkfink', 'Kael Eisenherz', 'Zora Fräsborn'];
  const clampSkill = value => Number.isInteger(value) ? Math.min(5, Math.max(1, value)) : 1;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function portraitFor(id) {
    const safeId = Number.isInteger(id) && id > 0 ? id : 1;
    const index = ((safeId - 1) % PORTRAIT_COUNT) + 1;
    return 'assets/employee-portrait-' + String(index).padStart(2, '0') + '.webp?v=1';
  }

  function deriveProfile(skills) {
    const normalized = {
      turning: clampSkill(skills?.turning),
      milling: clampSkill(skills?.milling),
      precision: clampSkill(skills?.precision),
      learning: clampSkill(skills?.learning)
    };
    const order = ['turning', 'milling', 'precision', 'learning'];
    const strongest = order.reduce((best, key) => normalized[key] > normalized[best] ? key : best, order[0]);
    const average = order.reduce((sum, key) => sum + normalized[key], 0) / order.length;
    const rating = clamp(Math.round(1 + ((average - 1) / 4) * 9), 1, 10);
    const quality = QUALITY[strongest];
    const specialty = normalized.turning >= normalized.milling + 2 ? 'Drehtechnik' :
      normalized.milling >= normalized.turning + 2 ? 'Frästechnik' : 'Allround';
    return {
      specialty,
      trait: quality.trait,
      about: 'Stärkster Wert: ' + quality.label + ' (' + normalized[strongest] + '/5) – ' + quality.about + '.',
      rating
    };
  }

  function ratingFromSkills(skills) {
    return deriveProfile(skills).rating;
  }

  function randomFor(id) {
    let seed = Math.imul(id >>> 0, 0x9e3779b1) >>> 0;
    return () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generateApplicant(id) {
    if (!Number.isInteger(id) || id < 1) return null;
    const random = randomFor(id);
    const focus = id % 3;
    const turning = focus === 1 ? 3 + Math.floor(random() * 3) : focus === 2 ? 1 + Math.floor(random() * 3) : 2 + Math.floor(random() * 3);
    const milling = focus === 2 ? 3 + Math.floor(random() * 3) : focus === 1 ? 1 + Math.floor(random() * 3) : 2 + Math.floor(random() * 3);
    const name = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)] + ' ' + FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)];
    const skills = {
      turning,
      milling,
      precision: 1 + Math.floor(random() * 5),
      learning: 1 + Math.floor(random() * 5)
    };
    return { id, name, ...deriveProfile(skills), portrait: portraitFor(id), skills };
  }

  function validApplicant(value) {
    return value && Number.isInteger(value.id) && value.id > 0 &&
      typeof value.name === 'string' && value.name.trim().length > 0 &&
      value.skills && ['turning', 'milling', 'precision', 'learning'].every(key =>
        Number.isInteger(value.skills[key]) && value.skills[key] >= 1 && value.skills[key] <= 5);
  }

  function ensureState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return { ok: false, code: 'invalid_state' };
    const old = state.recruitment && typeof state.recruitment === 'object' && !Array.isArray(state.recruitment)
      ? state.recruitment
      : {};
    const applicants = [];
    const seen = new Set();
    for (const candidate of Array.isArray(old.applicants) ? old.applicants : []) {
      if (!validApplicant(candidate) || seen.has(candidate.id) || applicants.length >= APPLICANT_COUNT) continue;
      const generated = generateApplicant(candidate.id);
      const skills = {
        turning: clampSkill(candidate.skills.turning),
        milling: clampSkill(candidate.skills.milling),
        precision: clampSkill(candidate.skills.precision),
        learning: clampSkill(candidate.skills.learning)
      };
      applicants.push({
        ...generated,
        name: candidate.name.trim().slice(0, 80),
        ...deriveProfile(skills),
        portrait: portraitFor(candidate.id),
        skills
      });
      seen.add(candidate.id);
    }
    const largestId = applicants.reduce((max, candidate) => Math.max(max, candidate.id), 0);
    let nextId = Number.isInteger(old.nextId) && old.nextId > largestId ? old.nextId : largestId + 1;
    while (applicants.length < APPLICANT_COUNT) {
      if (!seen.has(nextId)) {
        applicants.push(generateApplicant(nextId));
        seen.add(nextId);
      }
      nextId += 1;
    }
    state.recruitment = { applicants, nextId };
    return { ok: true, value: state.recruitment };
  }

  function takeApplicant(state, id) {
    const ensured = ensureState(state);
    if (!ensured.ok || !Number.isInteger(id)) return null;
    const index = state.recruitment.applicants.findIndex(candidate => candidate.id === id);
    if (index < 0) return null;
    const [candidate] = state.recruitment.applicants.splice(index, 1);
    while (state.recruitment.applicants.length < APPLICANT_COUNT) {
      state.recruitment.applicants.push(generateApplicant(state.recruitment.nextId));
      state.recruitment.nextId += 1;
    }
    return { ...candidate, skills: { ...candidate.skills } };
  }

  function createEmployee(candidate, id) {
    if (!validApplicant(candidate) || !Number.isInteger(id) || id < 1) return null;
    return {
      id,
      xp: 0,
      trained: 0,
      assignedBay: null,
      profileVersion: 1,
      name: candidate.name,
      ...deriveProfile(candidate.skills),
      portrait: portraitFor(id),
      skills: { ...candidate.skills }
    };
  }

  function legacyProfile(id) {
    const index = Number.isInteger(id) && id > 0 ? (id - 1) % LEGACY_NAMES.length : 0;
    return {
      profileVersion: 0,
      name: LEGACY_NAMES[index],
      specialty: 'Altes Profil',
      trait: 'Langjährige Besetzung',
      about: 'Aus einem älteren Spielstand übernommen; bisherige Werte bleiben erhalten.',
      rating: 5,
      portrait: portraitFor(id),
      skills: { turning: 0, milling: 0, precision: 0, learning: 0 }
    };
  }

  function normalizeEmployee(entry, id) {
    const legacy = legacyProfile(id);
    const validProfile = entry && entry.profileVersion === 1 && typeof entry.name === 'string' && entry.name.trim() &&
      entry.skills && ['turning', 'milling', 'precision', 'learning'].every(key => Number.isInteger(entry.skills[key]) && entry.skills[key] >= 1 && entry.skills[key] <= 5);
    const skills = validProfile ? {
      turning: clampSkill(entry.skills.turning),
      milling: clampSkill(entry.skills.milling),
      precision: clampSkill(entry.skills.precision),
      learning: clampSkill(entry.skills.learning)
    } : null;
    const profile = validProfile ? {
      profileVersion: 1,
      name: entry.name.trim().slice(0, 80),
      ...deriveProfile(skills),
      portrait: portraitFor(id),
      skills
    } : legacy;
    return {
      id,
      xp: Number.isFinite(entry?.xp) ? Math.max(0, entry.xp) : 0,
      trained: Number.isInteger(entry?.trained) ? clamp(entry.trained, 0, 3) : 0,
      assignedBay: Number.isInteger(entry?.assignedBay) ? entry.assignedBay : null,
      ...profile
    };
  }

  function productionMultiplier(employee, kind) {
    if (employee?.profileVersion !== 1) return 1;
    const stat = kind === 'Drehen' ? employee.skills?.turning : employee.skills?.milling;
    return 1 + Math.max(0, clampSkill(stat) - 1) * 0.025;
  }

  function learningMultiplier(employee) {
    if (employee?.profileVersion !== 1) return 1;
    return 0.8 + (clampSkill(employee.skills?.learning) - 1) * 0.1;
  }

  function toolWearMultiplier(employee) {
    if (employee?.profileVersion !== 1) return 1;
    return 1 - (clampSkill(employee.skills?.precision) - 1) * 0.025;
  }

  return {
    APPLICANT_COUNT,
    PORTRAIT_COUNT,
    portraitFor,
    ratingFromSkills,
    deriveProfile,
    ensureState,
    generateApplicant,
    takeApplicant,
    createEmployee,
    legacyProfile,
    normalizeEmployee,
    productionMultiplier,
    learningMultiplier,
    toolWearMultiplier
  };
});

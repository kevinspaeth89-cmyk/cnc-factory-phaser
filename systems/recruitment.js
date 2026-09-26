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
  const FIRST_NAMES = Object.freeze({
    female: ['Mira', 'Elira', 'Vaska', 'Neris', 'Zora', 'Fenja', 'Sera', 'Liora', 'Yuna', 'Tyra'],
    male: ['Tarek', 'Joren', 'Kael', 'Orin', 'Tavik', 'Kiro', 'Bran', 'Darek', 'Aven', 'Eron']
  });
  const FIRST_NAME_GENDER = Object.freeze(Object.fromEntries(
    Object.entries(FIRST_NAMES).flatMap(([gender, names]) => names.map(name => [name.toLocaleLowerCase('de-DE'), gender]))
  ));
  const PORTRAITS_BY_GENDER = Object.freeze({ female: [4, 5, 6, 7], male: [1, 2, 3, 8] });
  const FAMILY_NAMES = ['Stahlwind', 'Spindelruh', 'Kupferhand', 'Funkenfels', 'Drehkamm', 'Eisenherz', 'Maßstern', 'Werkfink', 'Schneidorn', 'Spanlauf', 'Feilensang', 'Fräsborn', 'Bohrhain', 'Zirkelkind', 'Taktvoll', 'Kühlwasser', 'Zahnrad', 'Stahlfeder', 'Kantenschliff', 'Werkglanz'];
  const PORTRAIT_COUNT = 8;
  const QUALITY = {
    turning: { label: 'Drehen', trait: 'Späneflüsterer', about: 'erkennt am Schnittgeräusch, wenn die Drehbearbeitung sauber läuft' },
    milling: { label: 'Fräsen', trait: 'Werkstatt-Tüftler', about: 'findet sichere Wege für anspruchsvolle Fräsaufgaben' },
    precision: { label: 'Präzision', trait: 'Maßhüter', about: 'prüft Maße sorgfältig und hält enge Toleranzen' },
    learning: { label: 'Lerntempo', trait: 'Tempo im Blut', about: 'eignet sich neue Abläufe schnell an' }
  };
  const LEGACY_NAMES = ['Mira Altspan', 'Tarek Stahlwind', 'Elira Kupferhand', 'Joren Maßstern', 'Vaska Spindelruh', 'Neris Werkfink', 'Kael Eisenherz', 'Zora Fräsborn'];
  const SKILL_SCALE = 2;
  const clampSkill = value => Number.isInteger(value) ? Math.min(10, Math.max(1, value)) : 1;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const legacySkill = value => Number.isInteger(value) ? clamp(Math.round(1 + ((clamp(value, 1, 5) - 1) / 4) * 9), 1, 10) : 1;

  function genderForName(name) {
    const firstName = typeof name === 'string' ? name.trim().split(/\s+/)[0].toLocaleLowerCase('de-DE') : '';
    return FIRST_NAME_GENDER[firstName] || null;
  }

  function portraitFor(id, gender) {
    const safeId = Number.isInteger(id) && id > 0 ? id : 1;
    const pool = PORTRAITS_BY_GENDER[gender];
    const index = pool ? pool[(safeId - 1) % pool.length] : ((safeId - 1) % PORTRAIT_COUNT) + 1;
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
    const rating = clamp(Math.round(average), 1, 10);
    const quality = QUALITY[strongest];
    const specialty = normalized.turning >= normalized.milling + 2 ? 'Drehtechnik' :
      normalized.milling >= normalized.turning + 2 ? 'Frästechnik' : 'Allround';
    return {
      specialty,
      trait: quality.trait,
      about: 'Stärkster Wert: ' + quality.label + ' (' + normalized[strongest] + '/10) – ' + quality.about + '.',
      rating,
      skillScale: SKILL_SCALE
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
    const gender = random() < 0.5 ? 'female' : 'male';
    const focus = id % 3;
    const turning = focus === 1 ? 6 + Math.floor(random() * 5) : focus === 2 ? 1 + Math.floor(random() * 6) : 3 + Math.floor(random() * 6);
    const milling = focus === 2 ? 6 + Math.floor(random() * 5) : focus === 1 ? 1 + Math.floor(random() * 6) : 3 + Math.floor(random() * 6);
    const firstNames = FIRST_NAMES[gender];
    const name = firstNames[Math.floor(random() * firstNames.length)] + ' ' + FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)];
    const skills = {
      turning,
      milling,
      precision: 1 + Math.floor(random() * 10),
      learning: 1 + Math.floor(random() * 10)
    };
    return { id, name, gender, ...deriveProfile(skills), portrait: portraitFor(id, gender), skills };
  }

  function validApplicant(value) {
    return value && Number.isInteger(value.id) && value.id > 0 &&
      typeof value.name === 'string' && value.name.trim().length > 0 &&
      value.skills && ['turning', 'milling', 'precision', 'learning'].every(key =>
        Number.isInteger(value.skills[key]) && value.skills[key] >= 1 && value.skills[key] <= (value.skillScale === SKILL_SCALE ? 10 : 5));
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
      const migrate = candidate.skillScale === SKILL_SCALE ? clampSkill : legacySkill;
      const skills = {
        turning: migrate(candidate.skills.turning),
        milling: migrate(candidate.skills.milling),
        precision: migrate(candidate.skills.precision),
        learning: migrate(candidate.skills.learning)
      };
      const name = candidate.name.trim().slice(0, 80);
      const gender = genderForName(name) || (candidate.gender === 'female' || candidate.gender === 'male' ? candidate.gender : generated.gender);
      applicants.push({
        ...generated,
        name,
        gender,
        ...deriveProfile(skills),
        portrait: portraitFor(candidate.id, gender),
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
    const gender = genderForName(candidate.name) || (candidate.gender === 'female' || candidate.gender === 'male' ? candidate.gender : null);
    return {
      id,
      xp: 0,
      trained: 0,
      assignedBay: null,
      profileVersion: 2,
      name: candidate.name,
      gender,
      ...deriveProfile(candidate.skills),
      portrait: portraitFor(id, gender),
      skills: { ...candidate.skills }
    };
  }

  function legacyProfile(id) {
    const index = Number.isInteger(id) && id > 0 ? (id - 1) % LEGACY_NAMES.length : 0;
    const name = LEGACY_NAMES[index];
    const gender = genderForName(name);
    return {
      profileVersion: 0,
      name,
      gender,
      specialty: 'Altes Profil',
      trait: 'Langjährige Besetzung',
      about: 'Aus einem älteren Spielstand übernommen; bisherige Werte bleiben erhalten.',
      rating: 5,
      portrait: portraitFor(id, gender),
      skills: { turning: 0, milling: 0, precision: 0, learning: 0 }
    };
  }

  function normalizeEmployee(entry, id) {
    const legacy = legacyProfile(id);
    const validProfile = entry && [1, 2].includes(entry.profileVersion) && typeof entry.name === 'string' && entry.name.trim() &&
      entry.skills && ['turning', 'milling', 'precision', 'learning'].every(key => Number.isInteger(entry.skills[key]) && entry.skills[key] >= 1 && entry.skills[key] <= (entry.profileVersion === 2 ? 10 : 5));
    const migrate = entry?.profileVersion === 2 ? clampSkill : legacySkill;
    const skills = validProfile ? {
      turning: migrate(entry.skills.turning),
      milling: migrate(entry.skills.milling),
      precision: migrate(entry.skills.precision),
      learning: migrate(entry.skills.learning)
    } : null;
    const profile = validProfile ? {
      gender: genderForName(entry.name) || (entry.gender === 'female' || entry.gender === 'male' ? entry.gender : null),
      profileVersion: 2,
      name: entry.name.trim().slice(0, 80),
      ...deriveProfile(skills),
      portrait: portraitFor(id, genderForName(entry.name) || (entry.gender === 'female' || entry.gender === 'male' ? entry.gender : null)),
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
    if (employee?.profileVersion !== 2) return 1;
    const stat = kind === 'Drehen' ? employee.skills?.turning : employee.skills?.milling;
    return 1 + (clampSkill(stat) - 1) * (0.1 / 9);
  }

  function learningMultiplier(employee) {
    if (employee?.profileVersion !== 2) return 1;
    return 0.8 + (clampSkill(employee.skills?.learning) - 1) * (0.4 / 9);
  }

  function toolWearMultiplier(employee) {
    if (employee?.profileVersion !== 2) return 1;
    return 1 - (clampSkill(employee.skills?.precision) - 1) * (0.1 / 9);
  }

  return {
    APPLICANT_COUNT,
    PORTRAIT_COUNT,
    genderForName,
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

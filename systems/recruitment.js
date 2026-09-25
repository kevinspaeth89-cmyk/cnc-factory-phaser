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
  const TRAITS = [
    { name: 'Ruhige Hand', about: 'Bleibt auch bei engen Toleranzen gelassen.' },
    { name: 'Späneflüsterer', about: 'Liest am Klang, ob ein Schnitt sauber läuft.' },
    { name: 'Nachtfunke', about: 'Mag den gleichmäßigen Rhythmus der Spätschicht.' },
    { name: 'Maßhüter', about: 'Prüft lieber zweimal, bevor ein Teil weitergeht.' },
    { name: 'Werkstatt-Tüftler', about: 'Findet gern clevere Wege für knifflige Aufspannungen.' },
    { name: 'Tempo im Blut', about: 'Arbeitet zügig und lernt gern an neuen Teilen.' },
    { name: 'Leiser Profi', about: 'Wenig Worte, dafür saubere Abläufe.' },
    { name: 'Funkenfänger', about: 'Hat ein gutes Auge für Werkzeug und Schnitt.' }
  ];
  const LEGACY_NAMES = ['Mira Altspan', 'Tarek Stahlwind', 'Elira Kupferhand', 'Joren Maßstern', 'Vaska Spindelruh', 'Neris Werkfink', 'Kael Eisenherz', 'Zora Fräsborn'];
  const clampSkill = value => Number.isInteger(value) ? Math.min(5, Math.max(1, value)) : 1;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    const trait = TRAITS[Math.floor(random() * TRAITS.length)];
    const name = `${FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)]} ${FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)]}`;
    const specialty = turning >= milling + 2 ? 'Drehtechnik' : milling >= turning + 2 ? 'Frästechnik' : 'Allround';
    return {
      id,
      name,
      specialty,
      trait: trait.name,
      about: trait.about,
      skills: {
        turning,
        milling,
        precision: 1 + Math.floor(random() * 5),
        learning: 1 + Math.floor(random() * 5)
      }
    };
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
      applicants.push({
        ...generated,
        name: candidate.name.trim().slice(0, 80),
        specialty: typeof candidate.specialty === 'string' ? candidate.specialty.slice(0, 40) : generated.specialty,
        trait: typeof candidate.trait === 'string' ? candidate.trait.slice(0, 50) : generated.trait,
        about: typeof candidate.about === 'string' ? candidate.about.slice(0, 120) : generated.about,
        skills: {
          turning: clampSkill(candidate.skills.turning),
          milling: clampSkill(candidate.skills.milling),
          precision: clampSkill(candidate.skills.precision),
          learning: clampSkill(candidate.skills.learning)
        }
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
      specialty: candidate.specialty,
      trait: candidate.trait,
      about: candidate.about,
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
      skills: { turning: 0, milling: 0, precision: 0, learning: 0 }
    };
  }

  function normalizeEmployee(entry, id) {
    const legacy = legacyProfile(id);
    const validProfile = entry && entry.profileVersion === 1 && typeof entry.name === 'string' && entry.name.trim() &&
      entry.skills && ['turning', 'milling', 'precision', 'learning'].every(key => Number.isInteger(entry.skills[key]) && entry.skills[key] >= 1 && entry.skills[key] <= 5);
    const profile = validProfile ? {
      profileVersion: 1,
      name: entry.name.trim().slice(0, 80),
      specialty: typeof entry.specialty === 'string' ? entry.specialty.slice(0, 40) : 'Allround',
      trait: typeof entry.trait === 'string' ? entry.trait.slice(0, 50) : 'Allrounder',
      about: typeof entry.about === 'string' ? entry.about.slice(0, 120) : '',
      skills: {
        turning: clampSkill(entry.skills.turning),
        milling: clampSkill(entry.skills.milling),
        precision: clampSkill(entry.skills.precision),
        learning: clampSkill(entry.skills.learning)
      }
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

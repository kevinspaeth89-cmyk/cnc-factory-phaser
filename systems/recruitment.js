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
  const QUALITY_APPLICANT_COUNT = 2;
  const FIRST_NAMES = Object.freeze({
    female: ['Mira', 'Elira', 'Vaska', 'Neris', 'Zora', 'Fenja', 'Sera', 'Liora', 'Yuna', 'Tyra'],
    male: ['Tarek', 'Joren', 'Kael', 'Orin', 'Tavik', 'Kiro', 'Bran', 'Darek', 'Aven', 'Eron']
  });
  const FIRST_NAME_GENDER = Object.freeze(Object.fromEntries(
    Object.entries(FIRST_NAMES).flatMap(([gender, names]) => names.map(name => [name.toLocaleLowerCase('de-DE'), gender]))
  ));
  const PORTRAITS_BY_GENDER = Object.freeze({
    female: [4, 5, 6, 7, 9, 10, 11, 12],
    male: [1, 2, 3, 8, 13, 14, 15, 16]
  });
  const FAMILY_NAMES = ['Stahlwind', 'Spindelruh', 'Kupferhand', 'Funkenfels', 'Drehkamm', 'Eisenherz', 'Maßstern', 'Werkfink', 'Schneidorn', 'Spanlauf', 'Feilensang', 'Fräsborn', 'Bohrhain', 'Zirkelkind', 'Taktvoll', 'Kühlwasser', 'Zahnrad', 'Stahlfeder', 'Kantenschliff', 'Werkglanz'];
  const PORTRAIT_COUNT = 16;
  const QUALITY = {
    turning: { label: 'Drehen', trait: 'Späneflüsterer', about: 'erkennt am Schnittgeräusch, wenn die Drehbearbeitung sauber läuft' },
    milling: { label: 'Fräsen', trait: 'Werkstatt-Tüftler', about: 'findet sichere Wege für anspruchsvolle Fräsaufgaben' },
    precision: { label: 'Präzision', trait: 'Maßhüter', about: 'prüft Maße sorgfältig und hält enge Toleranzen' },
    learning: { label: 'Lerntempo', trait: 'Tempo im Blut', about: 'eignet sich neue Abläufe schnell an' }
  };
  const PERSONALITY = Object.freeze({
    gruendlich: Object.freeze({
      id: 'gruendlich',
      label: 'Gründlich',
      icon: '🔍',
      about: 'prüft lieber einmal mehr und entdeckt Qualitätsabweichungen früh'
    }),
    pragmatisch: Object.freeze({
      id: 'pragmatisch',
      label: 'Pragmatisch',
      icon: '⚙️',
      about: 'entscheidet zügig und verlässt sich stärker auf Erfahrung als auf Zusatzkontrollen'
    }),
    bedacht: Object.freeze({
      id: 'bedacht',
      label: 'Bedacht',
      icon: '🧭',
      about: 'wägt Tempo und Sorgfalt meist ausgewogen gegeneinander ab'
    }),
    neugierig: Object.freeze({
      id: 'neugierig',
      label: 'Neugierig',
      icon: '💡',
      about: 'probiert neue Abläufe gern aus und nimmt neues Wissen schnell auf'
    }),
    routineorientiert: Object.freeze({
      id: 'routineorientiert',
      label: 'Routineorientiert',
      icon: '🔁',
      about: 'arbeitet besonders sicher mit bekannten Abläufen und bewährten Verfahren'
    }),
    anpassungsfaehig: Object.freeze({
      id: 'anpassungsfaehig',
      label: 'Anpassungsfähig',
      icon: '🛠️',
      about: 'kommt mit neuen Aufgaben zurecht, ohne ständig den vertrauten Ablauf zu brauchen'
    }),
    flexibel: Object.freeze({
      id: 'flexibel',
      label: 'Flexibel',
      icon: '↔️',
      about: 'fühlt sich sowohl beim Drehen als auch beim Fräsen wohl'
    })
  });
  const LEGACY_NAMES = ['Mira Altspan', 'Tarek Stahlwind', 'Elira Kupferhand', 'Joren Maßstern', 'Vaska Spindelruh', 'Neris Werkfink', 'Kael Eisenherz', 'Zora Fräsborn'];
  const QUALITY_PROFILE_VERSION = 1;
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
    return portraitPath(index);
  }

  function portraitPath(id) {
    return 'assets/employee-portrait-' + String(id).padStart(2, '0') + '.webp?v=1';
  }

  function portraitId(value) {
    if (Number.isInteger(value) && value >= 1 && value <= PORTRAIT_COUNT) return value;
    const match = typeof value === 'string' ? value.match(/employee-portrait-(\d{2})\.webp(?:\?.*)?$/) : null;
    const id = match ? Number(match[1]) : 0;
    return Number.isInteger(id) && id >= 1 && id <= PORTRAIT_COUNT ? id : null;
  }

  function portraitIdsForGender(gender) {
    return PORTRAITS_BY_GENDER[gender] || Array.from({ length: PORTRAIT_COUNT }, (_, index) => index + 1);
  }

  function uniquePortraitFor(gender, usedPortraits = [], preferredPortrait = null) {
    const pool = portraitIdsForGender(gender);
    const used = new Set((Array.isArray(usedPortraits) ? usedPortraits : [])
      .map(portraitId)
      .filter(id => id !== null));
    const preferredId = portraitId(preferredPortrait);
    const id = preferredId && pool.includes(preferredId) && !used.has(preferredId)
      ? preferredId
      : pool.find(candidateId => !used.has(candidateId));
    return id ? portraitPath(id) : null;
  }

  function ensureUniquePortraits(employees) {
    if (!Array.isArray(employees)) return { ok: false, code: 'invalid_employees' };
    const entries = employees.filter(employee => employee && typeof employee === 'object');
    if (entries.length !== employees.length) return { ok: false, code: 'invalid_employees' };

    const genders = entries.map(employee => genderForName(employee.name) || employee.gender || null);
    const totals = new Map();
    genders.forEach(gender => totals.set(gender, (totals.get(gender) || 0) + 1));
    for (const [gender, count] of totals) {
      const capacity = portraitIdsForGender(gender).length;
      if (count > capacity) {
        return { ok: false, code: 'portrait_pool_exhausted', gender, count, capacity };
      }
    }

    const used = new Set();
    const assignments = entries.map((employee, index) => {
      const gender = genders[index];
      const pool = portraitIdsForGender(gender);
      const savedId = portraitId(employee.portrait);
      const id = savedId && pool.includes(savedId) && !used.has(savedId)
        ? savedId
        : pool.find(candidateId => !used.has(candidateId));
      used.add(id);
      return { employee, id };
    });
    assignments.forEach(({ employee, id }) => { employee.portrait = portraitPath(id); });
    return { ok: true, count: assignments.length };
  }

  function derivePersonality(skills) {
    const normalized = {
      turning: clampSkill(skills?.turning),
      milling: clampSkill(skills?.milling),
      precision: clampSkill(skills?.precision),
      learning: clampSkill(skills?.learning)
    };

    // Achse 1: Arbeitsstil. Präzision bestimmt, wie kontrolliert jemand vorgeht.
    const workStyle = normalized.precision >= 8
      ? PERSONALITY.gruendlich
      : normalized.precision <= 3
        ? PERSONALITY.pragmatisch
        : PERSONALITY.bedacht;

    // Achse 2: Umgang mit neuen Aufgaben. Ein echter Allrounder bekommt bewusst
    // "Flexibel", ansonsten prägt vor allem das Lerntempo diesen Teil der Persönlichkeit.
    const balancedMachining = Math.abs(normalized.turning - normalized.milling) <= 1 &&
      Math.min(normalized.turning, normalized.milling) >= 5;
    const adaptability = balancedMachining
      ? PERSONALITY.flexibel
      : normalized.learning >= 8
        ? PERSONALITY.neugierig
        : normalized.learning <= 3
          ? PERSONALITY.routineorientiert
          : PERSONALITY.anpassungsfaehig;

    return [workStyle, adaptability].map(trait => ({ ...trait }));
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
      personality: derivePersonality(normalized),
      rating,
      skillScale: SKILL_SCALE
    };
  }

  function deriveQualityProfile(qualitySkills) {
    const normalized = {
      measurement: clampSkill(qualitySkills?.measurement),
      inspection: clampSkill(qualitySkills?.inspection),
      analysis: clampSkill(qualitySkills?.analysis),
      documentation: clampSkill(qualitySkills?.documentation)
    };
    const labels = {
      measurement: ['Messtechnik', 'Messprofi', 'beherrscht Messmittel sicher und wählt passende Prüfmethoden'],
      inspection: ['Prüfgenauigkeit', 'Maßwächter', 'arbeitet bei Prüfungen sehr genau und erkennt kleine Abweichungen'],
      analysis: ['Fehleranalyse', 'Ursachenfinder', 'ordnet Abweichungen schnell ein und erkennt wiederkehrende Fehlerbilder'],
      documentation: ['Dokumentation', 'Prüfplaner', 'dokumentiert Ergebnisse sauber und hält Prüfabläufe nachvollziehbar']
    };
    const order = ['measurement', 'inspection', 'analysis', 'documentation'];
    const strongest = order.reduce((best, key) => normalized[key] > normalized[best] ? key : best, order[0]);
    const average = order.reduce((sum, key) => sum + normalized[key], 0) / order.length;
    const [label, trait, about] = labels[strongest];
    return {
      profileType: 'quality',
      specialty: 'Qualitätssicherung',
      trait,
      about: 'Stärkster QS-Wert: ' + label + ' (' + normalized[strongest] + '/10) – ' + about + '.',
      rating: clamp(Math.round(average), 1, 10),
      qualityProfileVersion: QUALITY_PROFILE_VERSION,
      qualitySkills: normalized,
      skillScale: SKILL_SCALE
    };
  }

  function qualityWageExpectation(qualitySkills, id = 1) {
    const normalized = {
      measurement: clampSkill(qualitySkills?.measurement),
      inspection: clampSkill(qualitySkills?.inspection),
      analysis: clampSkill(qualitySkills?.analysis),
      documentation: clampSkill(qualitySkills?.documentation)
    };
    const average = Object.values(normalized).reduce((sum, value) => sum + value, 0) / 4;
    const personalVariance = ((Math.max(1, Number(id) || 1) * 11) % 3) - 1;
    return clamp(Math.round(20 + average * 0.85 + normalized.inspection * 0.2 + normalized.measurement * 0.15 + personalVariance), 23, 34);
  }

  function qualityInspectionPrecision(person) {
    if (person?.profileType === 'quality' && person.qualitySkills) {
      const measurement = clampSkill(person.qualitySkills.measurement);
      const inspection = clampSkill(person.qualitySkills.inspection);
      return clamp(Math.round(inspection * .65 + measurement * .35), 1, 10);
    }
    return clampSkill(person?.skills?.precision);
  }

  function qualityLearningMultiplier(person) {
    if (person?.profileType === 'quality' && person.qualitySkills) {
      return 0.8 + (clampSkill(person.qualitySkills.analysis) - 1) * (0.4 / 9);
    }
    return learningMultiplier(person);
  }

  function wageExpectation(skills, id = 1) {
    const normalized = {
      turning: clampSkill(skills?.turning),
      milling: clampSkill(skills?.milling),
      precision: clampSkill(skills?.precision),
      learning: clampSkill(skills?.learning)
    };
    const values = Object.values(normalized);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const strongestTechnical = Math.max(normalized.turning, normalized.milling);
    // Kleine deterministische individuelle Streuung von -1 bis +1 €/h.
    const personalVariance = ((Math.max(1, Number(id) || 1) * 7) % 3) - 1;
    return clamp(Math.round(18 + average * 0.75 + strongestTechnical * 0.25 + normalized.precision * 0.15 + personalVariance), 20, 31);
  }

  function hourlyWage(person, shift = 1) {
    const base = Number.isFinite(person?.baseHourlyWage)
      ? clamp(Math.round(person.baseHourlyWage), person?.profileType === 'quality' ? 23 : 20, person?.profileType === 'quality' ? 34 : 31)
      : person?.profileVersion === 0
        ? 24
        : wageExpectation(person?.skills, person?.id);
    return base + (shift === 2 ? 2 : 0);
  }

  function personalityIds(employee) {
    if (!employee || typeof employee !== 'object') return [];
    const traits = Array.isArray(employee.personality) && employee.personality.length
      ? employee.personality
      : employee.skills ? derivePersonality(employee.skills) : [];
    return traits.map(trait => typeof trait === 'string' ? trait : trait?.id).filter(Boolean);
  }

  function qualityRiskModifier(employee) {
    if (employee?.profileVersion !== 2) return 0;
    const ids = personalityIds(employee);
    let modifier = 0;
    if (ids.includes('gruendlich')) modifier -= 2;
    else if (ids.includes('bedacht')) modifier -= 0.75;
    else if (ids.includes('pragmatisch')) modifier += 1;
    if (ids.includes('flexibel')) modifier -= 0.5;
    return modifier;
  }

  function incidentExperience(employee, action) {
    if (employee?.profileVersion !== 2) return 0;
    const ids = personalityIds(employee);
    let bonus = ids.includes('neugierig') ? 24 :
      ids.includes('anpassungsfaehig') ? 14 :
      ids.includes('flexibel') ? 12 :
      ids.includes('routineorientiert') ? 6 : 10;
    if (action === 'repairSelf') bonus += ids.includes('neugierig') ? 8 : 4;
    if (action === 'continueRisky' && ids.includes('gruendlich')) bonus = Math.max(4, bonus - 4);
    return bonus;
  }

  function normalizeMachineHistory(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [machineType, entry] of Object.entries(value)) {
      if (!machineType || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      result[machineType] = {
        machineType,
        machineName: typeof entry.machineName === 'string' && entry.machineName.trim() ? entry.machineName.trim().slice(0, 80) : machineType,
        incidents: Math.max(0, Math.floor(Number(entry.incidents) || 0)),
        selfRepairs: Math.max(0, Math.floor(Number(entry.selfRepairs) || 0)),
        technicianRepairs: Math.max(0, Math.floor(Number(entry.technicianRepairs) || 0)),
        riskyContinues: Math.max(0, Math.floor(Number(entry.riskyContinues) || 0)),
        workMinutes: Math.max(0, Number(entry.workMinutes) || 0),
        partsProduced: Math.max(0, Math.floor(Number(entry.partsProduced) || 0)),
        firstAt: Number.isFinite(entry.firstAt) ? entry.firstAt : null,
        lastAt: Number.isFinite(entry.lastAt) ? entry.lastAt : null,
        lastFault: typeof entry.lastFault === 'string' ? entry.lastFault : null,
        lastAction: typeof entry.lastAction === 'string' ? entry.lastAction : null,
        lastBay: Number.isInteger(entry.lastBay) ? entry.lastBay : null
      };
    }
    return result;
  }

  function machineExperience(employee, machineType) {
    if (!employee || typeof machineType !== 'string' || !machineType) return null;
    const history = normalizeMachineHistory(employee.machineHistory);
    return history[machineType] || null;
  }

  const FAMILIARITY_LEVELS = Object.freeze([
    Object.freeze({ level: 0, minMinutes: 0, label: 'Neu', productionMultiplier: 1, qualityRiskModifier: 0 }),
    Object.freeze({ level: 1, minMinutes: 480, label: 'Eingearbeitet', productionMultiplier: 1.01, qualityRiskModifier: -0.25 }),
    Object.freeze({ level: 2, minMinutes: 2400, label: 'Vertraut', productionMultiplier: 1.02, qualityRiskModifier: -0.5 }),
    Object.freeze({ level: 3, minMinutes: 7200, label: 'Erfahren', productionMultiplier: 1.03, qualityRiskModifier: -1 }),
    Object.freeze({ level: 4, minMinutes: 18000, label: 'Spezialist', productionMultiplier: 1.04, qualityRiskModifier: -1.5 })
  ]);

  function familiarityFor(employee, machineType) {
    const history = machineExperience(employee, machineType);
    const workMinutes = Math.max(0, Number(history?.workMinutes) || 0);
    let tier = FAMILIARITY_LEVELS[0];
    for (const candidate of FAMILIARITY_LEVELS) {
      if (workMinutes + 1e-9 >= candidate.minMinutes) tier = candidate;
      else break;
    }
    const next = FAMILIARITY_LEVELS.find(candidate => candidate.level === tier.level + 1) || null;
    return {
      ...tier,
      workMinutes,
      partsProduced: Math.max(0, Math.floor(Number(history?.partsProduced) || 0)),
      machineName: history?.machineName || machineType || 'Maschine',
      nextLevelMinutes: next?.minMinutes ?? null,
      minutesToNext: next ? Math.max(0, next.minMinutes - workMinutes) : 0
    };
  }

  function recordMachineWork(employee, context = {}) {
    if (!employee || employee.profileVersion !== 2 || typeof context.machineType !== 'string' || !context.machineType) return null;
    employee.machineHistory = normalizeMachineHistory(employee.machineHistory);
    const type = context.machineType;
    const previousLevel = familiarityFor(employee, type).level;
    const previous = employee.machineHistory[type] || {
      machineType: type,
      machineName: typeof context.machineName === 'string' && context.machineName.trim() ? context.machineName.trim().slice(0, 80) : type,
      incidents: 0,
      selfRepairs: 0,
      technicianRepairs: 0,
      riskyContinues: 0,
      workMinutes: 0,
      partsProduced: 0,
      firstAt: Number.isFinite(context.gameMinutes) ? context.gameMinutes : null,
      lastAt: null,
      lastFault: null,
      lastAction: null,
      lastBay: null
    };
    previous.machineName = typeof context.machineName === 'string' && context.machineName.trim()
      ? context.machineName.trim().slice(0, 80)
      : previous.machineName;
    previous.workMinutes = Math.max(0, previous.workMinutes + Math.max(0, Number(context.minutes) || 0));
    previous.partsProduced = Math.max(0, previous.partsProduced + Math.max(0, Math.floor(Number(context.partsProduced) || 0)));
    previous.lastAt = Number.isFinite(context.gameMinutes) ? context.gameMinutes : previous.lastAt;
    previous.lastBay = Number.isInteger(context.bay) ? context.bay : previous.lastBay;
    employee.machineHistory[type] = previous;
    const familiarity = familiarityFor(employee, type);
    return {
      ...familiarity,
      previousLevel,
      leveledUp: familiarity.level > previousLevel
    };
  }

  function familiarityProductionMultiplier(employee, machineType) {
    return familiarityFor(employee, machineType).productionMultiplier;
  }

  function familiarityQualityRiskModifier(employee, machineType) {
    return familiarityFor(employee, machineType).qualityRiskModifier;
  }

  function recordMachineIncident(employee, context = {}) {
    if (!employee || employee.profileVersion !== 2 || typeof context.machineType !== 'string' || !context.machineType) return null;
    employee.machineHistory = normalizeMachineHistory(employee.machineHistory);
    const type = context.machineType;
    const previous = employee.machineHistory[type] || {
      machineType: type,
      machineName: typeof context.machineName === 'string' && context.machineName.trim() ? context.machineName.trim().slice(0, 80) : type,
      incidents: 0,
      selfRepairs: 0,
      technicianRepairs: 0,
      riskyContinues: 0,
      workMinutes: 0,
      partsProduced: 0,
      firstAt: Number.isFinite(context.gameMinutes) ? context.gameMinutes : null,
      lastAt: null,
      lastFault: null,
      lastAction: null,
      lastBay: null
    };
    previous.machineName = typeof context.machineName === 'string' && context.machineName.trim()
      ? context.machineName.trim().slice(0, 80)
      : previous.machineName;
    previous.incidents += 1;
    if (context.action === 'repairSelf') previous.selfRepairs += 1;
    if (context.action === 'repairTechnician') previous.technicianRepairs += 1;
    if (context.action === 'continueRisky') previous.riskyContinues += 1;
    previous.lastAt = Number.isFinite(context.gameMinutes) ? context.gameMinutes : previous.lastAt;
    previous.lastFault = typeof context.fault === 'string' ? context.fault : previous.lastFault;
    previous.lastAction = typeof context.action === 'string' ? context.action : previous.lastAction;
    // Hallenplatz is only historical context. Recognition is keyed exclusively by machineType.
    previous.lastBay = Number.isInteger(context.bay) ? context.bay : previous.lastBay;
    employee.machineHistory[type] = previous;
    return { ...previous };
  }

  const MAX_MEMORIES = 5;

  function normalizeMemory(memory) {
    if (!memory || typeof memory !== 'object' || Array.isArray(memory)) return null;
    const type = typeof memory.type === 'string' && memory.type ? memory.type : 'event';
    const machineType = typeof memory.machineType === 'string' && memory.machineType ? memory.machineType : null;
    const fault = typeof memory.fault === 'string' && memory.fault ? memory.fault : null;
    const action = typeof memory.action === 'string' && memory.action ? memory.action : null;
    const orderId = typeof memory.orderId === 'string' && memory.orderId ? memory.orderId : null;
    const fallbackId = [type, machineType || 'none', fault || orderId || 'general', action || memory.outcome || 'event'].join(':');
    return {
      id: typeof memory.id === 'string' && memory.id ? memory.id : fallbackId,
      type,
      machineType,
      machineName: typeof memory.machineName === 'string' && memory.machineName.trim() ? memory.machineName.trim().slice(0, 80) : null,
      fault,
      faultLabel: typeof memory.faultLabel === 'string' && memory.faultLabel.trim() ? memory.faultLabel.trim().slice(0, 100) : null,
      action,
      outcome: typeof memory.outcome === 'string' && memory.outcome ? memory.outcome : null,
      orderId,
      orderPart: typeof memory.orderPart === 'string' && memory.orderPart.trim() ? memory.orderPart.trim().slice(0, 100) : null,
      defectParts: Math.max(0, Math.floor(Number(memory.defectParts) || 0)),
      importance: clamp(Math.floor(Number(memory.importance) || 5), 1, 10),
      count: Math.max(1, Math.floor(Number(memory.count) || 1)),
      firstAt: Number.isFinite(memory.firstAt) ? memory.firstAt : Number.isFinite(memory.gameMinutes) ? memory.gameMinutes : null,
      lastAt: Number.isFinite(memory.lastAt) ? memory.lastAt : Number.isFinite(memory.gameMinutes) ? memory.gameMinutes : null,
      lastBay: Number.isInteger(memory.lastBay) ? memory.lastBay : Number.isInteger(memory.bay) ? memory.bay : null
    };
  }

  function normalizeMemories(value) {
    if (!Array.isArray(value)) return [];
    const merged = new Map();
    for (const source of value) {
      const memory = normalizeMemory(source);
      if (!memory) continue;
      const previous = merged.get(memory.id);
      if (!previous) {
        merged.set(memory.id, memory);
        continue;
      }
      previous.count += memory.count;
      previous.importance = Math.max(previous.importance, memory.importance);
      if (memory.lastAt !== null && (previous.lastAt === null || memory.lastAt >= previous.lastAt)) {
        previous.lastAt = memory.lastAt;
        previous.lastBay = memory.lastBay;
        previous.outcome = memory.outcome || previous.outcome;
        previous.machineName = memory.machineName || previous.machineName;
        previous.faultLabel = memory.faultLabel || previous.faultLabel;
        previous.orderPart = memory.orderPart || previous.orderPart;
        previous.defectParts = memory.defectParts || previous.defectParts;
      }
      if (previous.firstAt === null || (memory.firstAt !== null && memory.firstAt < previous.firstAt)) previous.firstAt = memory.firstAt;
    }
    return [...merged.values()]
      .sort((a,b)=>b.importance-a.importance||(b.lastAt??-1)-(a.lastAt??-1))
      .slice(0,MAX_MEMORIES);
  }

  function recordMemory(employee, source = {}) {
    if (!employee || employee.profileVersion !== 2) return null;
    const memory = normalizeMemory(source);
    if (!memory) return null;
    employee.memories = normalizeMemories(employee.memories);
    const existing = employee.memories.find(item => item.id === memory.id);
    if (existing) {
      existing.count += 1;
      existing.importance = Math.max(existing.importance, memory.importance);
      existing.lastAt = memory.lastAt ?? existing.lastAt;
      existing.lastBay = memory.lastBay ?? existing.lastBay;
      existing.outcome = memory.outcome || existing.outcome;
      existing.machineName = memory.machineName || existing.machineName;
      existing.faultLabel = memory.faultLabel || existing.faultLabel;
      existing.orderPart = memory.orderPart || existing.orderPart;
      existing.defectParts = memory.defectParts || existing.defectParts;
    } else {
      employee.memories.push(memory);
    }
    employee.memories = normalizeMemories(employee.memories);
    return employee.memories.find(item => item.id === memory.id) || memory;
  }

  function memoryTitle(memory) {
    const item = normalizeMemory(memory);
    if (!item) return '';
    const machine = item.machineName || item.machineType || 'Maschine';
    const fault = item.faultLabel || 'Störung';
    if (item.type === 'major_failure') {
      return item.outcome === 'after_risky'
        ? `💥 ${fault} an ${machine} nach Weiterfahrt eskaliert`
        : `💥 Schweren Schaden an ${machine} erlebt`;
    }
    if (item.type === 'quality_issue') {
      const part = item.orderPart || 'Bauteil';
      return item.action === 'ship'
        ? `⚠️ ${part} trotz Maßfehler ausgeliefert`
        : `📏 Maßfehler bei ${part} vor Auslieferung nachgearbeitet`;
    }
    if (item.type === 'machine_incident') {
      if (item.action === 'repairSelf') return `🔧 ${fault} an ${machine} selbst geprüft`;
      if (item.action === 'repairTechnician') return `🧰 ${fault} an ${machine}: Monteur gerufen`;
      if (item.action === 'continueRisky') return `⚠️ ${fault} an ${machine}: weiterproduziert`;
    }
    return `• Erfahrung an ${machine}`;
  }

  function latestMachineMemory(employee, machineType, fault = null) {
    if (!employee || typeof machineType !== 'string' || !machineType) return null;
    const memories = normalizeMemories(employee.memories)
      .filter(memory => memory.machineType === machineType && (!fault || memory.fault === fault))
      .sort((a,b)=>(b.lastAt??-1)-(a.lastAt??-1));
    return memories[0] || null;
  }

  function memoryReference(employee, context = {}) {
    const exact = latestMachineMemory(employee, context.machineType, context.fault);
    const memory = exact || latestMachineMemory(employee, context.machineType);
    if (!memory) return '';
    const machine = context.machineName || memory.machineName || 'diesem Maschinentyp';
    const fault = memory.faultLabel || 'Störung';
    if (memory.type === 'major_failure') {
      return memory.outcome === 'after_risky'
        ? `Bei der ${fault} an ${machine} sind wir damals weitergefahren und sie ist eskaliert. `
        : `An ${machine} hatten wir schon einmal einen schweren Schaden. `;
    }
    if (memory.type === 'machine_incident') {
      if (memory.action === 'repairSelf') return `Bei der letzten ${fault} an ${machine} habe ich selbst nachgesehen. `;
      if (memory.action === 'repairTechnician') return `Bei der letzten ${fault} an ${machine} haben wir den Monteur geholt. `;
      if (memory.action === 'continueRisky') return `Bei der letzten ${fault} an ${machine} sind wir zunächst weitergefahren. `;
    }
    if (memory.type === 'quality_issue') {
      return `Mit ${machine} hatten wir schon einmal ein Qualitätsproblem bei ${memory.orderPart || 'einem Auftrag'}. `;
    }
    return '';
  }

  function breakdownAdvice(employee, eventType = 'warning', context = {}) {
    if (employee?.profileVersion !== 2) return null;
    const ids = personalityIds(employee);
    const name = typeof employee.name === 'string' && employee.name.trim() ? employee.name.trim() : 'Bediener';
    const major = eventType === 'major_failure';
    const selfRepairFailed = context.selfRepairFailed === true;
    const experience = machineExperience(employee, context.machineType);
    const machineName = typeof context.machineName === 'string' && context.machineName.trim() ? context.machineName.trim() : experience?.machineName;
    const specificMemory = memoryReference(employee, context);
    const memoryLead = specificMemory || (experience?.incidents > 0
      ? experience.incidents === 1
        ? `Mit ${machineName || 'diesem Maschinentyp'} hatten wir schon einmal eine Störung. `
        : `Mit ${machineName || 'diesem Maschinentyp'} hatten wir schon ${experience.incidents} Störungen. `
      : '');

    if (selfRepairFailed) {
      return {
        employeeName: name,
        action: 'repairTechnician',
        text: ids.includes('neugierig')
          ? 'Ich habe es selbst versucht, aber die Störung sitzt tiefer als gedacht. Bevor wir noch mehr Zeit verlieren oder etwas beschädigen, sollten wir jetzt den Monteur holen.'
          : ids.includes('routineorientiert')
            ? 'Mein Selbstversuch hat die Störung nicht behoben. Ich würde jetzt nach Verfahren weitermachen und den Monteur beauftragen.'
            : 'Leider hat mein Selbstversuch nicht funktioniert. Ich würde jetzt den Monteur beauftragen, damit die Störung fachgerecht behoben wird.'
      };
    }

    if (major) {
      return {
        employeeName: name,
        action: 'repairTechnician',
        text: memoryLead + (ids.includes('neugierig')
          ? 'Die Maschine steht. Ich würde die Ursache dokumentieren und den Monteur dazuholen – dabei kann ich mir den Fehler genau ansehen.'
          : ids.includes('routineorientiert')
            ? 'Das ist kein normaler Ablauf mehr. Ich würde den Monteur holen und nach bewährtem Verfahren reparieren lassen.'
            : 'Bei einem schweren Schaden würde ich nichts erzwingen und den Monteur holen.')
      };
    }

    if (ids.includes('gruendlich')) {
      return {
        employeeName: name,
        action: 'repairSelf',
        text: memoryLead + (ids.includes('neugierig')
          ? 'Ich würde sofort stoppen und selbst nachsehen. So finden wir die Ursache, bevor daraus ein größerer Schaden wird.'
          : 'Ich würde die Maschine stoppen und die Ursache erst prüfen, bevor wir weiterproduzieren.')
      };
    }
    if (ids.includes('pragmatisch')) {
      return {
        employeeName: name,
        action: 'continueRisky',
        text: memoryLead + (ids.includes('routineorientiert')
          ? 'Wenn Lauf und Maß noch stimmen, würde ich den Auftrag erst weiterfahren und die Störung danach angehen.'
          : 'Wenn die Maschine noch sauber läuft, würde ich den Auftrag erstmal weiterfahren und die Störung beobachten.')
      };
    }
    return {
      employeeName: name,
      action: 'repairSelf',
      text: memoryLead + (ids.includes('neugierig')
        ? 'Ich würde kurz stoppen und selbst prüfen. Vielleicht sehen wir direkt, was sich verändert hat.'
        : 'Ich würde kurz prüfen, bevor wir entscheiden, ob die Maschine sicher weiterlaufen kann.')
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

  function generateQualityApplicant(id) {
    if (!Number.isInteger(id) || id < 1) return null;
    const random = randomFor(id * 17 + 7001);
    const gender = random() < 0.5 ? 'female' : 'male';
    const firstNames = FIRST_NAMES[gender];
    const name = firstNames[Math.floor(random() * firstNames.length)] + ' ' + FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)];
    const qualitySkills = {
      measurement: 3 + Math.floor(random() * 8),
      inspection: 3 + Math.floor(random() * 8),
      analysis: 2 + Math.floor(random() * 9),
      documentation: 2 + Math.floor(random() * 9)
    };
    const profile = deriveQualityProfile(qualitySkills);
    return {
      id,
      name,
      gender,
      ...profile,
      baseHourlyWage: qualityWageExpectation(qualitySkills, id),
      portrait: portraitFor(id, gender)
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
    return { id, name, gender, ...deriveProfile(skills), baseHourlyWage: wageExpectation(skills, id), portrait: portraitFor(id, gender), skills };
  }

  function validQualityApplicant(value) {
    return value && Number.isInteger(value.id) && value.id > 0 &&
      typeof value.name === 'string' && value.name.trim().length > 0 &&
      value.qualitySkills && ['measurement', 'inspection', 'analysis', 'documentation'].every(key =>
        Number.isInteger(value.qualitySkills[key]) && value.qualitySkills[key] >= 1 && value.qualitySkills[key] <= 10);
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
    const qualityApplicants = [];
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
        baseHourlyWage: Number.isFinite(candidate.baseHourlyWage)
          ? clamp(Math.round(candidate.baseHourlyWage), 20, 31)
          : wageExpectation(skills, candidate.id),
        portrait: portraitFor(candidate.id, gender),
        skills
      });
      seen.add(candidate.id);
    }
    for (const candidate of Array.isArray(old.qualityApplicants) ? old.qualityApplicants : []) {
      if (!validQualityApplicant(candidate) || seen.has(candidate.id) || qualityApplicants.length >= QUALITY_APPLICANT_COUNT) continue;
      const generated = generateQualityApplicant(candidate.id);
      const qualitySkills = {
        measurement: clampSkill(candidate.qualitySkills.measurement),
        inspection: clampSkill(candidate.qualitySkills.inspection),
        analysis: clampSkill(candidate.qualitySkills.analysis),
        documentation: clampSkill(candidate.qualitySkills.documentation)
      };
      const name = candidate.name.trim().slice(0, 80);
      const gender = genderForName(name) || (candidate.gender === 'female' || candidate.gender === 'male' ? candidate.gender : generated.gender);
      qualityApplicants.push({
        ...generated,
        name,
        gender,
        ...deriveQualityProfile(qualitySkills),
        baseHourlyWage: Number.isFinite(candidate.baseHourlyWage)
          ? clamp(Math.round(candidate.baseHourlyWage), 23, 34)
          : qualityWageExpectation(qualitySkills, candidate.id),
        portrait: portraitFor(candidate.id, gender)
      });
      seen.add(candidate.id);
    }
    const largestId = [...applicants, ...qualityApplicants].reduce((max, candidate) => Math.max(max, candidate.id), 0);
    let nextId = Number.isInteger(old.nextId) && old.nextId > largestId ? old.nextId : largestId + 1;
    while (applicants.length < APPLICANT_COUNT) {
      if (!seen.has(nextId)) {
        applicants.push(generateApplicant(nextId));
        seen.add(nextId);
      }
      nextId += 1;
    }
    while (qualityApplicants.length < QUALITY_APPLICANT_COUNT) {
      if (!seen.has(nextId)) {
        qualityApplicants.push(generateQualityApplicant(nextId));
        seen.add(nextId);
      }
      nextId += 1;
    }
    state.recruitment = { applicants, qualityApplicants, nextId };
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

  function takeQualityApplicant(state, id) {
    const ensured = ensureState(state);
    if (!ensured.ok || !Number.isInteger(id)) return null;
    const index = state.recruitment.qualityApplicants.findIndex(candidate => candidate.id === id);
    if (index < 0) return null;
    const [candidate] = state.recruitment.qualityApplicants.splice(index, 1);
    const used = new Set([
      ...state.recruitment.applicants.map(person => person.id),
      ...state.recruitment.qualityApplicants.map(person => person.id)
    ]);
    while (state.recruitment.qualityApplicants.length < QUALITY_APPLICANT_COUNT) {
      while (used.has(state.recruitment.nextId)) state.recruitment.nextId += 1;
      state.recruitment.qualityApplicants.push(generateQualityApplicant(state.recruitment.nextId));
      used.add(state.recruitment.nextId);
      state.recruitment.nextId += 1;
    }
    return { ...candidate, qualitySkills: { ...candidate.qualitySkills } };
  }

  function createQualityEmployee(candidate, id) {
    if (!validQualityApplicant(candidate) || !Number.isInteger(id) || id < 1) return null;
    const gender = genderForName(candidate.name) || (candidate.gender === 'female' || candidate.gender === 'male' ? candidate.gender : null);
    const profile = deriveQualityProfile(candidate.qualitySkills);
    return {
      id,
      xp: 0,
      trained: 0,
      assignedBay: null,
      assignedRole: null,
      machineHistory: {},
      memories: [],
      baseHourlyWage: Number.isFinite(candidate.baseHourlyWage)
        ? clamp(Math.round(candidate.baseHourlyWage), 23, 34)
        : qualityWageExpectation(candidate.qualitySkills, candidate.id),
      profileVersion: 2,
      profileType: 'quality',
      name: candidate.name,
      gender,
      ...profile,
      portrait: portraitFor(id, gender),
      // Compatibility values for existing persistence/XP helpers. QS UI and
      // gameplay use qualitySkills, never turning/milling.
      skills: {
        turning: 1,
        milling: 1,
        precision: qualityInspectionPrecision(profile),
        learning: clampSkill(candidate.qualitySkills.analysis)
      }
    };
  }

  function createEmployee(candidate, id) {
    if (!validApplicant(candidate) || !Number.isInteger(id) || id < 1) return null;
    const gender = genderForName(candidate.name) || (candidate.gender === 'female' || candidate.gender === 'male' ? candidate.gender : null);
    return {
      id,
      xp: 0,
      trained: 0,
      assignedBay: null,
      assignedRole: null,
      machineHistory: {},
      memories: [],
      baseHourlyWage: Number.isFinite(candidate.baseHourlyWage)
        ? clamp(Math.round(candidate.baseHourlyWage), 20, 31)
        : wageExpectation(candidate.skills, candidate.id),
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
      baseHourlyWage: 24,
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
    const qualityProfile = entry?.profileType === 'quality' && entry?.qualitySkills
      ? deriveQualityProfile(entry.qualitySkills)
      : null;
    const profileGender = profile.gender;
    const savedPortraitId = portraitId(entry?.portrait);
    const savedPortrait = savedPortraitId && portraitIdsForGender(profileGender).includes(savedPortraitId)
      ? portraitPath(savedPortraitId)
      : profile.portrait;
    return {
      id,
      xp: Number.isFinite(entry?.xp) ? Math.max(0, entry.xp) : 0,
      trained: Number.isInteger(entry?.trained) ? clamp(entry.trained, 0, 3) : 0,
      assignedBay: Number.isInteger(entry?.assignedBay) ? entry.assignedBay : null,
      assignedRole: entry?.assignedRole === 'quality' ? 'quality' : null,
      machineHistory: normalizeMachineHistory(entry?.machineHistory),
      memories: normalizeMemories(entry?.memories),
      baseHourlyWage: Number.isFinite(entry?.baseHourlyWage)
        ? clamp(Math.round(entry.baseHourlyWage), qualityProfile ? 23 : 20, qualityProfile ? 34 : 31)
        : qualityProfile
          ? qualityWageExpectation(qualityProfile.qualitySkills, id)
          : profile.profileVersion === 0
            ? 24
            : wageExpectation(skills, id),
      ...profile,
      portrait: savedPortrait,
      ...(qualityProfile || {})
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
    QUALITY_APPLICANT_COUNT,
    PORTRAIT_COUNT,
    MAX_MEMORIES,
    genderForName,
    portraitFor,
    portraitId,
    portraitIdsForGender,
    uniquePortraitFor,
    ensureUniquePortraits,
    ratingFromSkills,
    deriveQualityProfile,
    qualityWageExpectation,
    qualityInspectionPrecision,
    qualityLearningMultiplier,
    wageExpectation,
    hourlyWage,
    derivePersonality,
    personalityIds,
    qualityRiskModifier,
    incidentExperience,
    normalizeMachineHistory,
    machineExperience,
    FAMILIARITY_LEVELS,
    familiarityFor,
    recordMachineWork,
    familiarityProductionMultiplier,
    familiarityQualityRiskModifier,
    recordMachineIncident,
    normalizeMemories,
    recordMemory,
    memoryTitle,
    latestMachineMemory,
    memoryReference,
    breakdownAdvice,
    deriveProfile,
    ensureState,
    generateApplicant,
    generateQualityApplicant,
    takeApplicant,
    takeQualityApplicant,
    createEmployee,
    createQualityEmployee,
    legacyProfile,
    normalizeEmployee,
    productionMultiplier,
    learningMultiplier,
    toolWearMultiplier
  };
});

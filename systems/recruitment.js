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
  const WORKPLACE_ITEMS = Object.freeze({
    mug: Object.freeze({ id: 'mug', label: 'Thermobecher', about: 'steht bei fast jeder Schicht griffbereit am Arbeitsplatz' }),
    notebook: Object.freeze({ id: 'notebook', label: 'Mess- & Notizheft', about: 'enthält eigene Notizen zu Maßen, Werkzeugen und Abläufen' }),
    gloves: Object.freeze({ id: 'gloves', label: 'Eigene Arbeitshandschuhe', about: 'liegen immer am vertrauten Platz neben der Maschine' }),
    toolbox: Object.freeze({ id: 'toolbox', label: 'Kleine Werkzeugtasche', about: 'ein paar persönliche Helfer für die tägliche Arbeit' }),
    photo: Object.freeze({ id: 'photo', label: 'Kleines Foto', about: 'ein persönliches Detail zwischen all der Technik' }),
    sticker: Object.freeze({ id: 'sticker', label: 'Glücksaufkleber', about: 'ein kleiner Wiedererkennungsmarker am eigenen Platz' }),
    bottle: Object.freeze({ id: 'bottle', label: 'Trinkflasche', about: 'wandert bei einem dauerhaften Maschinenwechsel mit' }),
    marker: Object.freeze({ id: 'marker', label: 'Stift & Prüfzettel', about: 'für schnelle Notizen direkt an der Maschine' })
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
    const allPortraits = Array.from({ length: PORTRAIT_COUNT }, (_, index) => index + 1);
    const used = new Set((Array.isArray(usedPortraits) ? usedPortraits : [])
      .map(portraitId)
      .filter(id => id !== null));
    const preferredId = portraitId(preferredPortrait);
    const id = preferredId && !used.has(preferredId)
      ? preferredId
      : pool.find(candidateId => !used.has(candidateId))
        || allPortraits.find(candidateId => !used.has(candidateId));
    return id ? portraitPath(id) : null;
  }

  function ensureUniquePortraits(employees) {
    if (!Array.isArray(employees)) return { ok: false, code: 'invalid_employees' };
    const entries = employees.filter(employee => employee && typeof employee === 'object');
    if (entries.length !== employees.length) return { ok: false, code: 'invalid_employees' };

    if (entries.length > PORTRAIT_COUNT) {
      return { ok: false, code: 'portrait_pool_exhausted', count: entries.length, capacity: PORTRAIT_COUNT };
    }

    const used = new Set();
    const allPortraits = Array.from({ length: PORTRAIT_COUNT }, (_, index) => index + 1);
    const assignments = entries.map(employee => {
      const gender = genderForName(employee.name) || employee.gender || null;
      const pool = portraitIdsForGender(gender);
      const savedId = portraitId(employee.portrait);
      const id = savedId && !used.has(savedId)
        ? savedId
        : pool.find(candidateId => !used.has(candidateId))
          || allPortraits.find(candidateId => !used.has(candidateId));
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

  function workplaceItems(employee) {
    if (!employee || employee.profileVersion !== 2 || employee.profileType === 'quality') return [];
    const ids = personalityIds(employee);
    const preferred = [];
    if (ids.includes('gruendlich')) preferred.push('notebook','marker');
    if (ids.includes('pragmatisch')) preferred.push('gloves','toolbox');
    if (ids.includes('bedacht')) preferred.push('mug','notebook');
    if (ids.includes('neugierig')) preferred.push('notebook','sticker');
    if (ids.includes('routineorientiert')) preferred.push('mug','gloves');
    if (ids.includes('anpassungsfaehig')) preferred.push('bottle','toolbox');
    if (ids.includes('flexibel')) preferred.push('toolbox','sticker');
    const all = Object.keys(WORKPLACE_ITEMS);
    const pool = [...new Set([...preferred,...all])];
    let seed = Math.max(1,Number(employee.id)||1) * 97;
    const name = String(employee.name || '');
    for (let index=0;index<name.length;index+=1) seed = Math.imul(seed ^ name.charCodeAt(index), 16777619);
    const firstIndex = Math.abs(seed) % pool.length;
    const first = pool[firstIndex];
    let second = pool[(firstIndex + 1 + Math.abs(seed >>> 3) % Math.max(1,pool.length-1)) % pool.length];
    if (second === first) second = pool[(firstIndex + 1) % pool.length];
    return [first,second].filter(Boolean).map(id=>({ ...WORKPLACE_ITEMS[id] }));
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

  function normalizeRepairExperience(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      if (!key || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      result[key] = {
        successes: Math.max(0, Math.floor(Number(entry.successes) || 0)),
        failures: Math.max(0, Math.floor(Number(entry.failures) || 0)),
        lastAt: Number.isFinite(entry.lastAt) ? entry.lastAt : null
      };
    }
    return result;
  }

  function repairExperienceKey(machineType, fault) {
    return String(machineType || 'unknown') + ':' + String(fault || 'unknown');
  }

  function repairExpertise(employee, machineType, fault) {
    const history = normalizeRepairExperience(employee?.repairExperience);
    const entry = history[repairExperienceKey(machineType, fault)] || { successes: 0, failures: 0, lastAt: null };
    const bonusSuccessChance = Math.min(0.32, entry.successes * 0.08);
    return {
      ...entry,
      bonusSuccessChance,
      label: entry.successes >= 4 ? 'Störungsspezialist' : entry.successes >= 2 ? 'Erfahren mit dieser Störung' : entry.successes >= 1 ? 'Schon einmal erfolgreich behoben' : 'Noch keine erfolgreiche Reparatur'
    };
  }

  function recordRepairResult(employee, context = {}) {
    if (!employee || employee.profileVersion !== 2 || typeof context.machineType !== 'string' || !context.machineType ||
      typeof context.fault !== 'string' || !context.fault) return null;
    employee.repairExperience = normalizeRepairExperience(employee.repairExperience);
    const key = repairExperienceKey(context.machineType, context.fault);
    const entry = employee.repairExperience[key] || { successes: 0, failures: 0, lastAt: null };
    if (context.success === true) entry.successes += 1;
    else entry.failures += 1;
    entry.lastAt = Number.isFinite(context.gameMinutes) ? context.gameMinutes : entry.lastAt;
    employee.repairExperience[key] = entry;
    return repairExpertise(employee, context.machineType, context.fault);
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
      customer: typeof memory.customer === 'string' && memory.customer.trim() ? memory.customer.trim().slice(0, 100) : null,
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
        previous.customer = memory.customer || previous.customer;
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
      existing.customer = memory.customer || existing.customer;
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
    if (item.type === 'rush_order') {
      const part = item.orderPart || 'Eilauftrag';
      const customer = item.customer ? ' für ' + item.customer : '';
      return item.outcome === 'late'
        ? '⏱️ ' + part + customer + ' zu spät abgeschlossen'
        : '⚡ ' + part + customer + ' pünktlich geschafft';
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

  function relevantMemory(employee, trigger, context = {}) {
    if (!employee || employee.profileVersion !== 2 || employee.profileType === 'quality') return null;
    const memories = normalizeMemories(employee.memories);
    if (!memories.length) return null;
    const machineType = typeof context.machineType === 'string' ? context.machineType : null;
    const fault = typeof context.fault === 'string' ? context.fault : null;
    const part = typeof context.part === 'string' ? context.part : typeof context.orderPart === 'string' ? context.orderPart : null;
    const customer = typeof context.customer === 'string' ? context.customer : null;
    const scored = memories.map(memory => {
      let score = memory.importance;
      if (trigger === 'machine_warning') {
        if (!['major_failure','machine_incident'].includes(memory.type) || !machineType || memory.machineType !== machineType) return null;
        score += 8;
        if (fault && memory.fault === fault) score += 6;
        if (memory.type === 'major_failure') score += 4;
        if (memory.outcome === 'after_risky') score += 5;
      } else if (trigger === 'quality_issue') {
        if (memory.type !== 'quality_issue') return null;
        if (part && memory.orderPart === part) score += 9;
        else if (machineType && memory.machineType === machineType) score += 4;
        else return null;
      } else if (trigger === 'rush_order') {
        if (memory.type !== 'rush_order') return null;
        if (customer && memory.customer === customer) score += 8;
        if (part && memory.orderPart === part) score += 6;
        if ((!customer || memory.customer !== customer) && (!part || memory.orderPart !== part)) return null;
      } else return null;
      return { memory, score };
    }).filter(Boolean).sort((a,b)=>b.score-a.score||(b.memory.lastAt??-1)-(a.memory.lastAt??-1));
    return scored[0]?.memory || null;
  }

  function recallRemark(employee, trigger, context = {}) {
    const memory = relevantMemory(employee, trigger, context);
    if (!memory) return '';
    const ids = personalityIds(employee);
    const machine = context.machineName || memory.machineName || 'der Maschine';
    const part = context.part || context.orderPart || memory.orderPart || 'dem Teil';
    if (trigger === 'machine_warning') {
      const fault = memory.faultLabel || 'Störung';
      if (memory.type === 'major_failure' && memory.outcome === 'after_risky')
        return 'Die Meldung kenne ich noch. Bei der ' + fault + ' an ' + machine + ' sind wir damals weitergefahren – das ist eskaliert.';
      if (memory.type === 'major_failure')
        return 'An ' + machine + ' hatten wir schon einmal einen schweren Schaden. Die Warnung nehme ich diesmal ernst.';
      if (memory.action === 'repairSelf')
        return 'Die ' + fault + ' hatten wir an ' + machine + ' schon einmal. Damals habe ich selbst nachgesehen.';
      if (memory.action === 'repairTechnician')
        return 'Die ' + fault + ' kenne ich noch. Letztes Mal haben wir an ' + machine + ' den Monteur geholt.';
      return 'Die Warnung hatten wir an ' + machine + ' schon einmal. Ich behalte genau im Auge, ob sie sich wieder gleich verhält.';
    }
    if (trigger === 'quality_issue') {
      if (memory.action === 'ship')
        return 'Bei ' + part + ' hatten wir schon einmal Maßprobleme und haben trotzdem ausgeliefert. Das würde ich diesmal nicht einfach abhaken.';
      if (ids.includes('gruendlich'))
        return 'Bei ' + part + ' hatten wir schon einmal ein Qualitätsproblem. Ich würde diesmal direkt die gleichen Stellen mitprüfen.';
      return 'Das kommt mir bekannt vor: Bei ' + (memory.orderPart || part) + ' hatten wir schon einmal Qualitätsprobleme.';
    }
    if (trigger === 'rush_order') {
      const customer = context.customer || memory.customer || 'dem Kunden';
      if (memory.outcome === 'late')
        return 'Für ' + customer + ' hatten wir schon einmal so einen Eilauftrag. Damals waren wir zu spät – diesmal sollten wir früher Luft schaffen.';
      if (ids.includes('routineorientiert'))
        return 'Für ' + customer + ' hatten wir schon einmal einen Eilauftrag. Der Ablauf hat funktioniert – daran würde ich mich wieder orientieren.';
      if (ids.includes('pragmatisch'))
        return 'Den Stress mit ' + customer + ' kenne ich. Letztes Mal haben wir den Eilauftrag pünktlich durchgezogen.';
      return 'Für ' + customer + ' hatten wir schon einmal einen Eilauftrag. Den haben wir pünktlich geschafft – das kriegen wir wieder hin.';
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
    const expertise = repairExpertise(employee, context.machineType, context.fault);
    const selfSuccessChance = Number(context.selfSuccessChance);
    const experienceLead = expertise.successes > 0
      ? `Ich habe genau diese Störung schon ${expertise.successes}× erfolgreich selbst behoben. `
      : '';
    const memoryLead = experienceLead + (specificMemory || (experience?.incidents > 0
      ? experience.incidents === 1
        ? `Mit ${machineName || 'diesem Maschinentyp'} hatten wir schon einmal eine Störung. `
        : `Mit ${machineName || 'diesem Maschinentyp'} hatten wir schon ${experience.incidents} Störungen. `
      : ''));

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

    if (!major && Number.isFinite(selfSuccessChance)) {
      const pct = Math.round(selfSuccessChance * 100);
      const learned = expertise.successes > 0
        ? ` Durch meine ${expertise.successes} ${expertise.successes===1?'erfolgreiche Reparatur':'erfolgreichen Reparaturen'} liegt meine Chance diesmal bei etwa ${pct} %.`
        : ` Meine geschätzte Erfolgschance liegt bei etwa ${pct} %.`;
      if (selfSuccessChance >= 0.68 || (expertise.successes > 0 && selfSuccessChance >= 0.58)) {
        return {
          employeeName: name,
          action: 'repairSelf',
          confidence: selfSuccessChance,
          expertiseSuccesses: expertise.successes,
          text: memoryLead + 'Ich würde sie selbst reparieren.' + learned
        };
      }
      if (selfSuccessChance < 0.48) {
        return {
          employeeName: name,
          action: 'repairTechnician',
          confidence: 1 - selfSuccessChance,
          expertiseSuccesses: expertise.successes,
          text: memoryLead + 'Diesmal würde ich den Monteur holen.' + learned
        };
      }
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


  function flavorChoice(items, employee, context = {}) {
    if (!Array.isArray(items) || !items.length) return '';
    let seed = Math.floor(Number(context.timeBucket) || 0) + Math.max(1, Number(employee?.id) || 1) * 31;
    const token = String(context.machineType || context.machineName || '');
    for (let index = 0; index < token.length; index += 1) seed = Math.imul(seed ^ token.charCodeAt(index), 16777619);
    return items[Math.abs(seed) % items.length];
  }

  function workRemark(employee, context = {}) {
    if (!employee || employee.profileVersion !== 2 || employee.profileType === 'quality') return '';
    const ids = personalityIds(employee);
    const machine = typeof context.machineName === 'string' && context.machineName.trim() ? context.machineName.trim() : 'die Maschine';
    const tool = Number(context.tool);
    const maintenance = Number(context.maintenance);
    const produced = Math.max(0, Math.floor(Number(context.produced) || 0));
    const quantity = Math.max(0, Math.floor(Number(context.quantity) || 0));
    const remaining = quantity > 0 ? Math.max(0, quantity - produced) : null;
    const familiarity = typeof context.machineType === 'string' && context.machineType
      ? familiarityFor(employee, context.machineType)
      : null;

    if (Number.isFinite(tool) && tool <= 12) {
      const lines = ids.includes('gruendlich')
        ? ['Die Schneide gefällt mir nicht mehr. Die würde ich bald wechseln.', 'Das Werkzeug ist ziemlich weit runter. Ich behalte das Maß im Auge.']
        : ids.includes('pragmatisch')
          ? ['Das Werkzeug hat nicht mehr viel Reserve, aber ich beobachte es.', 'Die Schneide ist bald fällig. Solange Maß und Oberfläche stimmen, läuft sie noch.']
          : ['Das Werkzeug wird knapp. Beim nächsten Wechsel schaue ich genauer hin.', 'Die Schneide nähert sich dem Ende.'];
      return flavorChoice(lines, employee, context);
    }

    if (Number.isFinite(maintenance) && maintenance <= 12) {
      const lines = ids.includes('routineorientiert')
        ? ['Die klingt nicht mehr ganz wie sonst. Nach der Serie würde ich Wartung machen.', 'Die kenne ich anders. Da kündigt sich etwas an.']
        : ids.includes('neugierig')
          ? ['Da ist ein anderes Geräusch drin. Würde mich interessieren, woher das kommt.', 'Irgendwas hat sich verändert. Nach dem Auftrag schaue ich mir das genauer an.']
          : ['Die Maschine fühlt sich heute nicht ganz sauber an.', 'Nach dem Auftrag wäre eine Wartung keine schlechte Idee.'];
      return flavorChoice(lines, employee, context);
    }

    if (remaining !== null && remaining > 0 && remaining <= Math.max(3, Math.ceil(quantity * 0.12))) {
      return flavorChoice([
        `Noch ${remaining} Teile, dann ist die Serie durch.`,
        `Endspurt. Noch ${remaining} Stück.`,
        `Fast geschafft – ${remaining} Teile fehlen noch.`
      ], employee, context);
    }

    if (familiarity && familiarity.level >= 3) {
      return flavorChoice([
        `${machine} kenne ich inzwischen ziemlich gut.`,
        `Bei ${machine} höre ich mittlerweile sofort, wenn etwas nicht stimmt.`,
        `Die hier und ich kennen uns inzwischen.`
      ], employee, context);
    }

    const lines = [];
    if (ids.includes('gruendlich')) lines.push('Wenn das Maß stimmt, läuft der Rest.', 'Lieber einmal mehr prüfen als später nacharbeiten.');
    if (ids.includes('pragmatisch')) lines.push('Läuft. Nicht unnötig dran herumstellen.', 'Solange Späne und Maß passen, fasse ich nichts an.');
    if (ids.includes('bedacht')) lines.push('So kann sie weiterlaufen.', 'Tempo ist gut, aber sauber muss es bleiben.');
    if (ids.includes('neugierig')) lines.push('Da wäre bestimmt noch ein bisschen Zykluszeit drin.', 'Ich will nachher mal schauen, warum der Schnitt so ruhig läuft.');
    if (ids.includes('routineorientiert')) lines.push('Bekannter Ablauf. Genau so mag ich das.', 'Wenn alles seinen Platz hat, läuft die Schicht.');
    if (ids.includes('anpassungsfaehig')) lines.push('Andere Maschine, gleicher Job. Kriegen wir hin.', 'Passt. Ich komme mit dem Ablauf klar.');
    if (ids.includes('flexibel')) lines.push('Drehen oder Fräsen – Hauptsache, die Serie läuft.', 'Heute hier, morgen woanders. Passt für mich.');
    if (!lines.length) lines.push('Die Serie läuft sauber.', 'Heute macht die Maschine, was sie soll.');
    return flavorChoice(lines, employee, context);
  }

  function eventRemark(employee, eventType, context = {}) {
    if (!employee || employee.profileVersion !== 2 || employee.profileType === 'quality') return '';
    const ids = personalityIds(employee);
    const machine = typeof context.machineName === 'string' && context.machineName.trim() ? context.machineName.trim() : 'die Maschine';
    const shift = Number(context.shift) === 2 ? 2 : 1;
    let lines = [];

    if (eventType === 'shift_start') {
      lines = shift === 2
        ? ['Moin, ich übernehme.', 'Spätschicht. Mal sehen, was noch anliegt.', 'Alles klar, ich bin dran.']
        : ['Morgen. Mal sehen, was heute anliegt.', 'Erstmal schauen, wie die Maschinen heute dastehen.', 'Los geht’s.'];
      if (ids.includes('gruendlich')) lines.push('Ich prüfe erstmal kurz, ob alles so steht wie gestern.');
      if (ids.includes('neugierig')) lines.push('Mal sehen, ob heute irgendwas Interessantes dabei ist.');
      if (ids.includes('routineorientiert')) lines.push('Erst der gewohnte Rundgang, dann kann es losgehen.');
    } else if (eventType === 'shift_end') {
      lines = ['Für heute reicht’s. Bis morgen.', 'Schicht durch. Morgen geht’s weiter.', 'So, Feierabend.'];
      if (ids.includes('gruendlich')) lines.push('Ich schreibe noch kurz auf, was auffällig war. Dann Feierabend.');
      if (ids.includes('pragmatisch')) lines.push('Läuft. Den Rest macht die nächste Schicht.');
      if (ids.includes('routineorientiert')) lines.push('Alles sauber übergeben. Jetzt ist Feierabend.');
    } else if (eventType === 'machine_purchase') {
      lines = ['Neue ' + machine + '. Bin gespannt, wie die sich im Alltag schlägt.'];
      if (ids.includes('neugierig')) lines.push('Die neue ' + machine + '? Die will ich mir nachher genauer ansehen.');
      if (ids.includes('routineorientiert')) lines.push('Neu ist neu. Mal sehen, ob die ' + machine + ' so zuverlässig läuft wie die alten.');
      if (ids.includes('pragmatisch')) lines.push('Wenn die ' + machine + ' Teile macht, ist sie willkommen.');
      if (ids.includes('gruendlich')) lines.push('Bei der neuen ' + machine + ' würde ich am Anfang lieber ein paar Maße mehr prüfen.');
    } else if (eventType === 'robot_purchase') {
      lines = ['Okay, jetzt lädt also der Roboter.', 'Dann übernimmt die Automatik künftig einen Teil der Arbeit.'];
      if (ids.includes('neugierig')) lines.push('Den Roboter würde ich gern mal im Ablauf beobachten.');
      if (ids.includes('routineorientiert')) lines.push('Mal sehen, ob der Roboter so zuverlässig lädt wie ein Mensch.');
      if (ids.includes('pragmatisch')) lines.push('Wenn der die Spätschicht sauber übernimmt, spart uns das einiges.');
      if (ids.includes('bedacht')) lines.push('Automatik ist gut. Solange wir trotzdem merken, wenn etwas nicht stimmt.');
    } else if (eventType === 'training') {
      lines = ['Gut, das kann ich direkt gebrauchen.', 'Schulung genommen. Jetzt muss ich es nur noch sauber anwenden.'];
      if (ids.includes('neugierig')) lines.push('Gut. Genau sowas wollte ich mal lernen.');
      if (ids.includes('routineorientiert')) lines.push('Schulung ist okay. Hauptsache, ich kann es danach direkt anwenden.');
      if (ids.includes('gruendlich')) lines.push('Gut, dann kann ich das künftig noch sauberer beurteilen.');
      if (ids.includes('pragmatisch')) lines.push('Wenn es mir an der Maschine hilft, hat sich die Schulung gelohnt.');
    } else if (eventType === 'rush_order') {
      const part = typeof context.part === 'string' && context.part.trim() ? context.part.trim() : 'den Eilauftrag';
      lines = ['Eilauftrag für ' + part + '? Dann legen wir los.'];
      if (ids.includes('gruendlich')) lines.push('Schnell ja – aber die Maße prüfe ich trotzdem.');
      if (ids.includes('pragmatisch')) lines.push('Eilauftrag? Dann machen wir Platz und ziehen den durch.');
      if (ids.includes('bedacht')) lines.push('Kriegen wir hin. Aber nicht auf Kosten der Qualität.');
      if (ids.includes('neugierig')) lines.push('Mal sehen, wie viel wir aus dem Ablauf noch rausholen können.');
      if (ids.includes('routineorientiert')) lines.push('Eilauftrag ist okay. Hauptsache, die Reihenfolge bleibt klar.');
    } else if (eventType === 'continue_risky') {
      lines = ['Okay. Dann behalten wir die Maschine genau im Auge.'];
      if (ids.includes('gruendlich')) lines.push('Ich würde lieber stoppen. Wenn wir weiterfahren, kontrolliere ich umso genauer.');
      if (ids.includes('pragmatisch')) lines.push('Okay. Wir beobachten sie und ziehen die Reißleine, wenn sich etwas ändert.');
      if (ids.includes('bedacht')) lines.push('Weiterfahren geht. Aber nur solange Lauf, Geräusch und Maß stabil bleiben.');
      if (ids.includes('routineorientiert')) lines.push('Gefällt mir nicht ganz. Aber ich weiß, wie sie normalerweise klingt.');
    } else if (eventType === 'maintenance_deferred') {
      lines = ['Dann ziehen wir die Serie noch durch. Danach sollte die Wartung aber dran sein.'];
      if (ids.includes('gruendlich')) lines.push('Noch eine Serie geht. Danach würde ich die Wartung nicht weiter schieben.');
      if (ids.includes('pragmatisch')) lines.push('Okay. Auftrag zuerst, Wartung danach. Solange sie sauber läuft, passt das.');
      if (ids.includes('bedacht')) lines.push('Können wir machen. Aber danach braucht die Maschine wirklich ihre Wartung.');
      if (ids.includes('routineorientiert')) lines.push('Die Wartung ist bald fällig. Nach der Serie würde ich sie fest einplanen.');
    } else if (eventType === 'repair_scheduled') {
      lines = ['Gut, dann machen wir die Reparatur nach der Serie.', 'Reparatur ist eingeplant. Bis dahin beobachte ich sie.'];
      if (ids.includes('gruendlich')) lines.push('Okay. Dann kontrolliere ich bis zur Reparatur lieber einmal mehr.');
      if (ids.includes('pragmatisch')) lines.push('Passt. Erst den Auftrag fertig, dann ran an die Reparatur.');
      if (ids.includes('routineorientiert')) lines.push('Gut. Dann weiß ich, wann die Maschine rausgeht.');
    } else {
      return '';
    }

    return flavorChoice(lines, employee, {
      ...context,
      machineType: context.machineType || eventType,
      timeBucket: Number.isFinite(Number(context.timeBucket)) ? Number(context.timeBucket) : 0
    });
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
    const savedPortraitId = portraitId(entry?.portrait);
    const savedPortrait = savedPortraitId
      ? portraitPath(savedPortraitId)
      : profile.portrait;
    return {
      id,
      xp: Number.isFinite(entry?.xp) ? Math.max(0, entry.xp) : 0,
      trained: Number.isInteger(entry?.trained) ? clamp(entry.trained, 0, 3) : 0,
      assignedBay: Number.isInteger(entry?.assignedBay) ? entry.assignedBay : null,
      assignedRole: entry?.assignedRole === 'quality' ? 'quality' : null,
      machineHistory: normalizeMachineHistory(entry?.machineHistory),
      repairExperience: normalizeRepairExperience(entry?.repairExperience),
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
    workplaceItems,
    qualityRiskModifier,
    incidentExperience,
    normalizeMachineHistory,
    normalizeRepairExperience,
    repairExpertise,
    recordRepairResult,
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
    relevantMemory,
    recallRemark,
    breakdownAdvice,
    workRemark,
    eventRemark,
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

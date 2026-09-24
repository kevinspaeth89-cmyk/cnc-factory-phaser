(function attachFactoryExpansion(root, createModule) {
  'use strict';

  var api = createModule();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.CNCModules = root.CNCModules || {};
    root.CNCModules.factoryExpansion = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createFactoryExpansion() {
  'use strict';

  var maxLevel = 3;
  var knownLevels = { 1: 4, 2: 6, 3: 8 };

  // Geometry is stored as percentages of the matching empty hall image.
  // Level 1 matches the current 4-bay hall map in index.html.
  var factoryLayouts = {
    1: {
      level: 1,
      unlockedBays: 4,
      asset: 'hall-empty-four-bays.webp',
      assetStatus: 'existing',
      aspectRatio: 1,
      targetDimensions: null,
      bays: [
        { bay: 1, x: 9, y: 18, width: 41, height: 29 },
        { bay: 2, x: 53, y: 18, width: 39, height: 29 },
        { bay: 3, x: 7, y: 51, width: 43, height: 36 },
        { bay: 4, x: 53, y: 51, width: 40, height: 36 }
      ]
    },
    2: {
      level: 2,
      unlockedBays: 6,
      asset: 'hall-level-2.svg',
      assetStatus: 'existing',
      aspectRatio: 1.6,
      targetDimensions: { width: 1920, height: 1200 },
      bays: [
        { bay: 1, x: 4, y: 14, width: 29, height: 32 },
        { bay: 2, x: 35.5, y: 14, width: 29, height: 32 },
        { bay: 3, x: 67, y: 14, width: 29, height: 32 },
        { bay: 4, x: 4, y: 54, width: 29, height: 32 },
        { bay: 5, x: 35.5, y: 54, width: 29, height: 32 },
        { bay: 6, x: 67, y: 54, width: 29, height: 32 }
      ]
    },
    3: {
      level: 3,
      unlockedBays: 8,
      asset: 'hall-level-3.svg',
      assetStatus: 'existing',
      aspectRatio: 1.6,
      targetDimensions: { width: 1920, height: 1200 },
      bays: [
        { bay: 1, x: 3, y: 14, width: 22, height: 33 },
        { bay: 2, x: 27, y: 14, width: 22, height: 33 },
        { bay: 3, x: 51, y: 14, width: 22, height: 33 },
        { bay: 4, x: 75, y: 14, width: 22, height: 33 },
        { bay: 5, x: 3, y: 54, width: 22, height: 33 },
        { bay: 6, x: 27, y: 54, width: 22, height: 33 },
        { bay: 7, x: 51, y: 54, width: 22, height: 33 },
        { bay: 8, x: 75, y: 54, width: 22, height: 33 }
      ]
    }
  };

  var expansionCosts = { 1: 40000, 2: 90000, 3: null };

  function copyBay(bay) {
    return {
      bay: bay.bay,
      x: bay.x,
      y: bay.y,
      width: bay.width,
      height: bay.height
    };
  }

  function copyLayout(layout) {
    return {
      level: layout.level,
      unlockedBays: layout.unlockedBays,
      asset: layout.asset,
      assetStatus: layout.assetStatus,
      aspectRatio: layout.aspectRatio,
      targetDimensions: layout.targetDimensions
        ? { width: layout.targetDimensions.width, height: layout.targetDimensions.height }
        : null,
      bays: layout.bays.map(copyBay)
    };
  }

  function readLevel(rawExpansion) {
    if (!rawExpansion || typeof rawExpansion !== 'object') {
      return 1;
    }

    var level = Number(rawExpansion.level);
    if (Number.isInteger(level) && knownLevels[level]) {
      return level;
    }

    // Accept the early prototype shape containing unlockedBays only.
    var bays = Number(rawExpansion.unlockedBays);
    var levels = Object.keys(knownLevels);
    for (var i = 0; i < levels.length; i += 1) {
      var candidate = Number(levels[i]);
      if (knownLevels[candidate] === bays) {
        return candidate;
      }
    }

    return 1;
  }

  function init(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('factoryExpansion.init expects a state object');
    }

    var level = readLevel(state.factoryExpansion);
    state.factoryExpansion = {
      level: level,
      unlockedBays: knownLevels[level]
    };
    return state.factoryExpansion;
  }

  function getUnlockedBays(state) {
    return init(state).unlockedBays;
  }

  function getExpansionCost(state) {
    return expansionCosts[init(state).level];
  }

  function canExpand(state) {
    return init(state).level < maxLevel;
  }

  function expand(state) {
    var current = init(state);
    var cost = expansionCosts[current.level];

    if (current.level >= maxLevel) {
      return {
        success: false,
        newLevel: current.level,
        newBays: current.unlockedBays,
        cost: null,
        reason: 'max-level'
      };
    }

    var newLevel = current.level + 1;
    var newBays = knownLevels[newLevel];
    state.factoryExpansion = {
      level: newLevel,
      unlockedBays: newBays
    };

    return {
      success: true,
      newLevel: newLevel,
      newBays: newBays,
      cost: cost
    };
  }

  function getLayoutDefinition(level) {
    var requestedLevel = Number(level);
    if (!Number.isInteger(requestedLevel) || !factoryLayouts[requestedLevel]) {
      throw new RangeError('Factory level must be 1, 2 or 3');
    }
    return copyLayout(factoryLayouts[requestedLevel]);
  }

  function getFactoryLayouts() {
    return {
      1: copyLayout(factoryLayouts[1]),
      2: copyLayout(factoryLayouts[2]),
      3: copyLayout(factoryLayouts[3])
    };
  }

  function getLayoutConfig(state) {
    return getLayoutDefinition(init(state).level);
  }

  function getBayLayout(state) {
    return getLayoutConfig(state).bays;
  }

  function getFreeBays(state, machines) {
    var unlockedBays = getUnlockedBays(state);
    var inventory = Array.isArray(machines)
      ? machines
      : (Array.isArray(state.machines) ? state.machines : []);
    var occupied = new Set();

    inventory.forEach(function (machine) {
      if (machine && Number.isInteger(machine.bay) &&
          machine.bay >= 1 && machine.bay <= unlockedBays) {
        occupied.add(machine.bay);
      }
    });

    return getBayLayout(state)
      .map(function (bay) { return bay.bay; })
      .filter(function (bay) { return !occupied.has(bay); });
  }

  function getFirstFreeBay(state, machines) {
    var free = getFreeBays(state, machines);
    return free.length ? free[0] : null;
  }

  // Assigns a stable bay number without charging or renumbering machines.
  function installMachine(state, machine) {
    init(state);
    if (!machine || typeof machine !== 'object' || Array.isArray(machine)) {
      return { success: false, bay: null, reason: 'invalid-machine' };
    }

    if (!Array.isArray(state.machines)) {
      state.machines = [];
    }

    var bay = getFirstFreeBay(state);
    if (bay === null) {
      return { success: false, bay: null, reason: 'no-free-bay' };
    }

    var installed = Object.assign({}, machine, { bay: bay });
    state.machines.push(installed);
    return { success: true, bay: bay, machine: installed };
  }

  // Selling is settled by the game/economy layer; only the exact bay is freed.
  function uninstallMachine(state, bay) {
    init(state);
    if (!Array.isArray(state.machines)) {
      return null;
    }

    var index = state.machines.findIndex(function (machine) {
      return machine && machine.bay === bay;
    });
    return index < 0 ? null : state.machines.splice(index, 1)[0];
  }

  return {
    init: init,
    getUnlockedBays: getUnlockedBays,
    getExpansionCost: getExpansionCost,
    canExpand: canExpand,
    expand: expand,
    getBayLayout: getBayLayout,
    getLayoutConfig: getLayoutConfig,
    getLayoutDefinition: getLayoutDefinition,
    getFactoryLayouts: getFactoryLayouts,
    getFreeBays: getFreeBays,
    getFirstFreeBay: getFirstFreeBay,
    installMachine: installMachine,
    uninstallMachine: uninstallMachine,
    maxLevel: maxLevel
  };
});

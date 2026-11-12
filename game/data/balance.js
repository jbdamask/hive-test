/*
 * Every balance number in the game. The rules (game/sim/) and the drawing
 * (game/ui/) read them from here and hold none of their own. Starting values
 * come from docs/game-design.md "Starting balance numbers"; when the two
 * differ, this file is right. Module pattern: see the header of game/sim/sim.js.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};

  BeeGame.balance = {
    // Time.
    ticksPerDay: 200,
    daysPerSeason: 60,
    ticksPerSecond: { normal: 10, fast: 30 },

    // The four ready-made mixes: one whole-number share per caste.
    startMix: 'Grow',
    mixes: {
      Grow: { builder: 6, nurse: 6, forager: 4, honeymaker: 2, scout: 1, defender: 1 },
      Gather: { builder: 2, nurse: 3, forager: 7, honeymaker: 5, scout: 2, defender: 1 },
      Defend: { builder: 1, nurse: 3, forager: 2, honeymaker: 1, scout: 1, defender: 12 },
      Balanced: { builder: 3, nurse: 4, forager: 4, honeymaker: 3, scout: 2, defender: 4 }
    },

    // The colony at the start of a game.
    start: {
      bees: { builder: 3, nurse: 4, forager: 5, honeymaker: 3, scout: 2, defender: 3 },
      maxAgeDays: 10, // starting adults are 0 to this many days old, drawn from the seed
      honey: 60,
      pollen: 30,
      nectar: 0,
      wax: 0,
      chambers: 1,
      cells: 40
    },

    // The queen and her eggs. layTicks is the fastest she can lay, kept fast
    // enough (66 eggs a day) that clean empty cells, honey and pollen usually
    // stop her first, so colony size follows the player's choices; at 2 she
    // takes the honey builders need and the hive stops growing (bead hive-test-qlq).
    queen: { layTicks: 3, eggHoney: 2, eggPollen: 1 },

    // Egg, larva, adult.
    brood: { eggTicks: 600, larvaTicks: 1000, feedsNeeded: 2, larvaMaxTicks: 2400 },
    adult: { lifeDays: 20 },

    // The hive.
    hive: {
      cellsPerChamber: 60,
      cellCapacity: 10, // units of honey, nectar or pollen one cell holds
      storeSlackCells: 1 // empty store cells kept before one is let go (and turns dirty)
    },

    // What each caste's work costs and how long it takes, in ticks.
    builder: {
      waxTicks: 20, honeyPerWax: 1, honeyReserve: 30,
      cellTicks: 30, waxPerCell: 2,
      chamberTicks: 100, waxPerChamber: 10
    },
    nurse: { feedTicks: 10, feedHoney: 1, feedPollen: 1, cleanTicks: 15 },
    forager: { baseTripTicks: 20, tripTicksPerDistance: 2, nectarLoad: 4, pollenLoad: 2 },
    honeymaker: { ticks: 10, nectarPerHoney: 2 },
    scout: { searchTicks: 50, findChance: 0.3 },
    defender: { guardTicks: 50 },
    idleTicks: 5,

    // Murder hornets. Tuned on seeds 1 to 20 (bead hive-test-hi1): the first
    // wave is small enough that Grow usually lives through it and loses the
    // queen to a later one.
    hornets: {
      // `day` counts from 0 (arrives at tick day * ticksPerDay); the screen
      // and the runner count from 1, so these show as days 16, 31 and 46.
      waves: [ // each larger than the one before
        { day: 15, size: 3 },
        { day: 30, size: 10 },
        { day: 45, size: 20 }
      ],
      warnDays: 2, // how far ahead a scout can see a wave
      roundTicks: 10, // ticks between rounds of the fight
      defenderWinChance: 0.5, // a defender against one hornet: the chance the hornet dies
      reachQueenChance: 0.05, // each round, the chance a hornet inside reaches the queen
      honeyPerRound: 2, // honey one hornet inside takes each round
      carry: 10 // honey a hornet carries before it flies off
    },

    // The meadow, laid out from the seed.
    meadow: {
      patches: 12,
      knownAtStart: 2, // the nearest patches, known to the starting scouts
      minDistance: 5,
      maxDistance: 40,
      nectarMin: 80,
      nectarMax: 200,
      pollenMin: 40,
      pollenMax: 120,
      regrowPerTick: 0.2
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.balance;
})(typeof globalThis !== 'undefined' ? globalThis : this);

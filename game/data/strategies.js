/*
 * Stored strategies: what game/sim/run.js plays when given --strategy <name>.
 * Module pattern: see the header of game/sim/sim.js.
 *
 * A strategy is data in the same form as a game record (game/sim/record.js):
 * a list of choices, each with the tick it takes effect, plus a rule for
 * answering hornet warnings:
 *   { name, description, choices: [{ tick, choice }], warnings: 'defend' | 'keep' }
 * The record carries no seed; the seed is given on the command line.
 *
 * Choices that depend on a mix's shares (for example taking every share to 0)
 * are worked out here from game/data/balance.js, so the strategies still mean
 * what their description says after the balance is tuned.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./balance.js');
  }
  var balance = BeeGame.balance;

  // The adjustShare choices at `tick` that take `caste`'s share in the start
  // mix down to 0.
  function shareToZero(tick, caste) {
    var out = [];
    var n = balance.mixes[balance.startMix][caste] || 0;
    for (var i = 0; i < n; i += 1) {
      out.push({ tick: tick, choice: { type: 'adjustShare', caste: caste, delta: -1 } });
    }
    return out;
  }

  function everyShareToZero(tick) {
    var castes = Object.keys(balance.mixes[balance.startMix]);
    return castes.reduce(function (all, caste) { return all.concat(shareToZero(tick, caste)); }, []);
  }

  BeeGame.strategies = [
    {
      name: 'no-defenders',
      description: 'Takes the start mix\'s defender share to 0 at the start and keeps it there all season; every warning Keep my mix.',
      choices: shareToZero(0, 'defender'),
      warnings: 'keep'
    },
    {
      name: 'balanced',
      description: 'Sets the Balanced mix at the start; every warning Defend, and lets the mix go back after each wave.',
      choices: [{ tick: 0, choice: { type: 'setMix', mix: 'Balanced' } }],
      warnings: 'defend'
    },
    {
      name: 'gather',
      description: 'Sets the Gather mix at the start; every warning Defend, and lets the mix go back after each wave.',
      choices: [{ tick: 0, choice: { type: 'setMix', mix: 'Gather' } }],
      warnings: 'defend'
    },
    {
      name: 'change-nothing',
      description: 'Grow throughout: no choices, no hand-picked eggs; every warning Keep my mix.',
      choices: [],
      warnings: 'keep'
    },
    {
      name: 'lay-nothing',
      description: 'Sets every share to 0 at the start, so the queen lays nothing after it; every warning Keep my mix.',
      choices: everyShareToZero(0),
      warnings: 'keep'
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.strategies;
})(typeof globalThis !== 'undefined' ? globalThis : this);

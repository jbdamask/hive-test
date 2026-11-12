// A full season at normal speed lasts 15 to 25 minutes, not counting time
// paused (bead hive-test-hi1; spec 1 acceptance check 20). Speed never changes
// what happens in a tick, so the season's length in seconds is its ticks over
// the ticks run each second at normal speed.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const balance = require('../data/balance.js');
const sim = require('../sim/sim.js');

const MIN_SECONDS = 15 * 60; // the spec's 15 minutes
const MAX_SECONDS = 25 * 60; // the spec's 25 minutes

test('a full season at normal speed lasts between 900 and 1500 seconds', () => {
  const ticks = balance.daysPerSeason * balance.ticksPerDay;
  const seconds = ticks / balance.ticksPerSecond.normal;
  assert.ok(seconds >= MIN_SECONDS && seconds <= MAX_SECONDS, `a season lasts ${seconds} seconds`);
});

test('the game ends on the season\'s last tick when the queen lives', () => {
  const game = sim.createGame(1, balance);
  assert.strictEqual(game.seasonTicks(), balance.daysPerSeason * balance.ticksPerDay);
});

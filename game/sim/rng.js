/*
 * The game's one source of chance: a small seeded random number generator
 * (mulberry32). Its state is a plain object kept inside the game state, so a
 * saved state carries its place in the sequence. Module pattern: see the
 * header of game/sim/sim.js.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};

  // Turns a seed (a number or a string) into a 32-bit starting state.
  function seedState(seed) {
    var text = String(seed);
    var h = 0x811c9dc5; // not balance: FNV-1a offset basis
    for (var i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 0x01000193); // not balance: FNV-1a prime
    }
    return { a: h | 0 };
  }

  // A number in [0, 1), advancing the state.
  function next(s) {
    var t = (s.a = (s.a + 0x6d2b79f5) | 0); // not balance: mulberry32 increment
    t = Math.imul(t ^ (t >>> 15), t | 1); // not balance: mulberry32 shift
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); // not balance: mulberry32 shift and multiplier
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // not balance: mulberry32 shift, divided by 2^32
  }

  // A whole number from 0 to n - 1.
  function int(s, n) {
    return Math.floor(next(s) * n);
  }

  // A whole number from lo to hi, both included.
  function range(s, lo, hi) {
    return lo + int(s, hi - lo + 1);
  }

  BeeGame.rng = { seedState: seedState, next: next, int: int, range: range };
  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.rng;
})(typeof globalThis !== 'undefined' ? globalThis : this);

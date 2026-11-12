/*
 * The game record: a game's seed and every choice, each with the tick it took
 * effect, as plain text, and back. Replaying the text into a new game gives
 * the same state at every tick. Module pattern: see the header of
 * game/sim/sim.js.
 *
 * The text:
 *   bee-colony game record
 *   seed <seed>
 *   <tick> <the choice as JSON>
 *   ...
 * Blank lines and lines starting with # are skipped.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./sim.js');
  }

  var HEADER = 'bee-colony game record';

  function toText(game) {
    var lines = [HEADER, 'seed ' + game.state.seed];
    game.choices.forEach(function (c) {
      lines.push(c.tick + ' ' + JSON.stringify(c.choice));
    });
    return lines.join('\n') + '\n';
  }

  function fromText(text) {
    var seed = null;
    var choices = [];
    String(text).split(/\r?\n/).forEach(function (raw, i) {
      var line = raw.trim();
      if (line === '' || line === HEADER || line.charAt(0) === '#') return;
      var m = /^seed\s+(.+)$/.exec(line);
      if (m) {
        seed = /^-?\d+$/.test(m[1]) ? Number(m[1]) : m[1];
        return;
      }
      var c = /^(\d+)\s+(\{.*\})$/.exec(line);
      if (!c) throw new Error('Game record line ' + (i + 1) + ' is not a choice: ' + line);
      choices.push({ tick: Number(c[1]), choice: JSON.parse(c[2]) }); // not balance: regex group 2
    });
    if (seed === null) throw new Error('The game record has no seed line');
    for (var k = 1; k < choices.length; k += 1) {
      if (choices[k].tick < choices[k - 1].tick) throw new Error('Game record choices are out of tick order');
    }
    return { seed: seed, choices: choices };
  }

  // Plays a record into a new game. Stops at the end of the game, or before
  // the step at opts.untilTick when given.
  function replay(text, balance, opts) {
    var rec = typeof text === 'string' ? fromText(text) : text;
    var until = opts && typeof opts.untilTick === 'number' ? opts.untilTick : Infinity;
    var game = BeeGame.sim.createGame(rec.seed, balance);
    var next = 0;
    while (!game.state.over && game.state.tick < until) {
      while (next < rec.choices.length && rec.choices[next].tick === game.state.tick) {
        game.choose(rec.choices[next].choice);
        next += 1;
      }
      if (game.state.paused) throw new Error('The game is paused at tick ' + game.state.tick + ' with no answer in the record');
      game.step();
    }
    return game;
  }

  BeeGame.record = { toText: toText, fromText: fromText, replay: replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.record;
})(typeof globalThis !== 'undefined' ? globalThis : this);

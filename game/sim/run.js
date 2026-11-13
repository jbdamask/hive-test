/*
 * Plays a whole season with no browser, for an assistant and for the checks.
 * Module pattern: see the header of game/sim/sim.js. This file is for node
 * only; the browser never loads it.
 *
 *   node game/sim/run.js --seed <n> --strategy <name> [--log]
 *   node game/sim/run.js --record <file> [--log]
 *   node game/sim/run.js --list-strategies
 *
 * Prints how the game ended, the four score parts and the total. --log first
 * prints, for each day: the warnings, the answer given, each wave's outcome,
 * mix changes, hand-picked eggs, laying-stopped notices and the eggs laid of
 * each caste; then the eggs laid of each caste over the season. The same
 * input gives the same output, byte for byte.
 *
 * Strategies live in game/data/strategies.js. A game record is the text that
 * game/sim/record.js writes.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('../data/balance.js');
    require('../data/strategies.js');
    require('./sim.js');
    require('./record.js');
  }
  var CASTES = BeeGame.sim.CASTES;

  var USAGE = [
    'Usage:',
    '  node game/sim/run.js --seed <n> --strategy <name> [--log]',
    '  node game/sim/run.js --record <file> [--log]',
    '  node game/sim/run.js --list-strategies'
  ].join('\n') + '\n';

  function findStrategy(name) {
    var list = BeeGame.strategies;
    for (var i = 0; i < list.length; i += 1) if (list[i].name === name) return list[i];
    return null;
  }

  function parseSeed(text) {
    return /^-?\d+$/.test(String(text)) ? Number(text) : String(text);
  }

  // ---- the log ----

  function sharesText(shares) {
    return CASTES.map(function (c) { return c + ' ' + shares[c]; }).join(', ');
  }

  function castesText(counts) {
    var total = CASTES.reduce(function (t, c) { return t + counts[c]; }, 0);
    return CASTES.map(function (c) { return c + ' ' + counts[c]; }).join(', ') + ' (total ' + total + ')';
  }

  function zeroCounts() {
    var out = {};
    CASTES.forEach(function (c) { out[c] = 0; });
    return out;
  }

  function choiceText(choice) {
    switch (choice.type) {
      case 'setMix': return 'choice: set the mix to ' + choice.mix;
      case 'adjustShare': return 'choice: ' + choice.caste + ' share ' + (choice.delta > 0 ? '+1' : '-1');
      case 'nextEgg': return choice.caste ? 'choice: hand-pick the next egg as ' + choice.caste : 'choice: cancel the hand-picked next egg';
      case 'matchMix': return 'choice: Match the mix now' + (choice.mix ? ' (' + choice.mix + ')' : '');
      case 'fixNotice': return 'choice: the notice\'s fix';
      case 'answerWarning': return 'answer: ' + (choice.answer === 'defend' ? 'Defend' : 'Keep my mix');
      case 'keepDefend': return 'choice: Keep Defend';
      default: return 'choice: ' + JSON.stringify(choice);
    }
  }

  // The day the browser shows for a tick: days count from 1, and the last
  // tick of the season still shows the last day (game/ui/main.js).
  function dayShown(tick, b) {
    return Math.min(Math.floor(tick / b.ticksPerDay) + 1, b.daysPerSeason);
  }

  function waveName(index) {
    return 'wave ' + (index + 1);
  }

  function eventText(e, b) {
    switch (e.type) {
      case 'eggLaid':
        return e.handPicked ? 'hand-picked egg laid: ' + e.caste : null;
      case 'noticeShown':
        return 'laying stopped: ' + e.notice.text;
      case 'noticeCleared':
        return 'laying started again';
      case 'warningRaised': {
        var w = e.warning;
        return 'warning: ' + waveName(w.wave) + ', about ' + w.size + ' hornets, arrives day ' +
          dayShown(w.arrivesTick, b) + ' (in ' + w.daysUntil + ' days); ' +
          w.defenders + ' defenders at arrival (' + w.defendersNow + ' now); Defend would move ' + w.defendMoves + ' bees';
      }
      case 'beesMoved':
        return 'bees moved: ' + e.text;
      case 'waveArrived':
        return waveName(e.wave) + ' arrived: ' + e.size + ' hornets, ' +
          (e.warned ? 'warned, answered ' + (e.answer === 'defend' ? 'Defend' : 'Keep my mix') : 'no warning');
      case 'waveOver':
        return waveName(e.wave) + ' over: ' + (e.outcome === 'beaten' ? 'beaten' : 'the hornets have gone') +
          '; hornets killed ' + e.hornetsKilled + ', hornets gone ' + e.gone + ', defenders lost ' + e.defendersLost +
          ', bees lost ' + e.beesLost + ', brood eaten ' + e.broodEaten + ', honey taken ' + e.honeyTaken;
      case 'mixRestored':
        return 'notice: ' + e.notice.text;
      case 'queenDied':
        return 'the hornets of ' + waveName(e.wave) + ' killed the queen';
      default:
        return null;
    }
  }

  function makeLog(game) {
    var b = game.balance;
    var days = [];
    var lastMix = JSON.stringify(game.state.mix);
    function day(tick) {
      var d = Math.floor(tick / b.ticksPerDay);
      while (days.length <= d) days.push({ lines: [], eggs: zeroCounts() });
      return days[d];
    }
    function mixCheck(tick, how) {
      var now = JSON.stringify(game.state.mix);
      if (now === lastMix) return;
      lastMix = now;
      day(tick).lines.push('mix ' + how + ' ' + game.state.mix.name + ' (' + sharesText(game.state.mix.shares) + ')');
    }
    function events(list) {
      list.forEach(function (e) {
        if (e.type === 'gameOver') return;
        if (e.type === 'eggLaid') day(e.tick).eggs[e.caste] += 1;
        var text = eventText(e, b);
        if (text) day(e.tick).lines.push(text);
      });
    }
    return {
      days: days,
      choice: function (tick, choice, ev) {
        day(tick).lines.push(choiceText(choice));
        events(ev);
        mixCheck(tick, 'now');
      },
      step: function (tick, ev) {
        events(ev);
        mixCheck(tick, 'went back to');
      },
      end: function (tick) {
        if (tick > 0) day(tick - 1);
      }
    };
  }

  // ---- playing ----

  // Plays the game to its end. source(game) gives the choices to make at the
  // current tick, in order; it is asked again after they are made, until it
  // gives none.
  function drive(game, source) {
    var log = makeLog(game);
    while (!game.state.over) {
      var choices = source(game);
      while (choices.length > 0) {
        choices.forEach(function (choice) {
          var before = game.events.length;
          game.choose(choice);
          log.choice(game.state.tick, choice, game.events.slice(before));
        });
        choices = game.state.over ? [] : source(game);
      }
      if (game.state.warning) throw new Error('The game is paused at tick ' + game.state.tick + ' on a warning with no answer');
      var tick = game.state.tick;
      log.step(tick, game.step());
    }
    log.end(game.state.over.tick);
    return { game: game, days: log.days };
  }

  function timedSource(list, warningRule) {
    var next = 0;
    return function (game) {
      var out = [];
      while (next < list.length && list[next].tick === game.state.tick) {
        out.push(list[next].choice);
        next += 1;
      }
      if (out.length === 0 && warningRule && game.state.warning) {
        out.push({ type: 'answerWarning', answer: warningRule });
      }
      return out;
    };
  }

  function runStrategy(seed, name, balance) {
    var strategy = findStrategy(name);
    if (!strategy) throw new Error('No stored strategy called ' + name + '; try --list-strategies');
    var game = BeeGame.sim.createGame(seed, balance || BeeGame.balance);
    return drive(game, timedSource(strategy.choices, strategy.warnings));
  }

  function runRecord(text, balance) {
    var rec = BeeGame.record.fromText(text);
    var game = BeeGame.sim.createGame(rec.seed, balance || BeeGame.balance);
    return drive(game, timedSource(rec.choices, null));
  }

  // ---- the output ----

  function report(run, heading, withLog) {
    var game = run.game;
    var b = game.balance;
    var lines = heading.slice();
    if (withLog) {
      var season = zeroCounts();
      run.days.forEach(function (d, i) {
        lines.push('day ' + dayShown(i * b.ticksPerDay, b));
        d.lines.forEach(function (l) { lines.push('  ' + l); });
        lines.push('  eggs laid: ' + castesText(d.eggs));
        CASTES.forEach(function (c) { season[c] += d.eggs[c]; });
      });
      lines.push('eggs laid over the season: ' + castesText(season));
    }
    var over = game.state.over;
    var s = game.score();
    lines.push('ending: ' + over.ending + ' at tick ' + over.tick + ' (day ' + dayShown(over.tick, b) + ')');
    lines.push('colony size (living bees): ' + s.livingBees);
    lines.push('honey made: ' + s.honeyMade);
    lines.push('honeycomb (comb cells): ' + s.combCells);
    lines.push('hive size (chambers): ' + s.chambers);
    lines.push('total: ' + s.total);
    return lines.join('\n') + '\n';
  }

  function listStrategies() {
    return BeeGame.strategies.map(function (s) { return s.name + ': ' + s.description; }).join('\n') + '\n';
  }

  // Returns { out, err, code } for the command-line arguments (without node
  // and the script name). readFile(path) gives a file's text.
  function main(args, readFile) {
    var opts = { log: false };
    for (var i = 0; i < args.length; i += 1) {
      var a = args[i];
      if (a === '--log') opts.log = true;
      else if (a === '--list-strategies') opts.list = true;
      else if (a === '--help' || a === '-h') return { out: USAGE, err: '', code: 0 };
      else if ((a === '--seed' || a === '--strategy' || a === '--record') && i + 1 < args.length) {
        opts[a.slice('--'.length)] = args[i + 1];
        i += 1;
      } else {
        return { out: '', err: 'Unknown or incomplete argument: ' + a + '\n' + USAGE, code: 1 };
      }
    }
    try {
      if (opts.list) return { out: listStrategies(), err: '', code: 0 };
      if (opts.record !== undefined) {
        if (opts.seed !== undefined || opts.strategy !== undefined) {
          return { out: '', err: '--record takes no --seed or --strategy: the record holds the seed and the choices\n' + USAGE, code: 1 };
        }
        var rec = BeeGame.record.fromText(readFile(opts.record));
        var fromRecord = runRecord(readFile(opts.record));
        return { out: report(fromRecord, ['seed ' + rec.seed, 'record ' + opts.record], opts.log), err: '', code: 0 };
      }
      if (opts.seed === undefined || opts.strategy === undefined) {
        return { out: '', err: 'Give --seed and --strategy, or --record, or --list-strategies\n' + USAGE, code: 1 };
      }
      var seed = parseSeed(opts.seed);
      var run = runStrategy(seed, opts.strategy);
      return { out: report(run, ['seed ' + seed, 'strategy ' + opts.strategy], opts.log), err: '', code: 0 };
    } catch (e) {
      return { out: '', err: e.message + '\n', code: 1 };
    }
  }

  BeeGame.run = {
    runStrategy: runStrategy, runRecord: runRecord, report: report,
    listStrategies: listStrategies, main: main
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeeGame.run;
    if (typeof require === 'function' && require.main === module) {
      var fs = require('fs');
      var result = main(process.argv.slice(['node', 'script'].length), function (p) { return fs.readFileSync(p, 'utf8'); });
      process.stdout.write(result.out);
      process.stderr.write(result.err);
      process.exitCode = result.code;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

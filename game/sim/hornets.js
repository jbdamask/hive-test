/*
 * Murder hornets: the waves, the scout's warning and its two answers, the
 * fight at the entrance, hornets inside the hive, and the mix going back after
 * a wave answered with Defend. Module pattern: see the header of
 * game/sim/sim.js. Load this file before sim/sim.js; sim.js calls it and
 * passes in the few helpers it needs (`h`), so the two never require each other.
 *
 * Each wave in st.waves:
 *   { index, size, arriveTick, warned, answer: null|'defend'|'keep',
 *     mixBefore, arrived, over, outcome, atEntrance, inside: [{ load }],
 *     hornetsKilled, gone, defendersLost, beesLost, broodEaten, honeyTaken,
 *     nextRoundTick }
 *
 * st.warning, while a warning waits for its answer:
 *   { wave, tick, size, arrivesTick, ticksUntil, daysUntil, defenders,
 *     defendMoves, defendText }
 * The game is paused and step() does not advance until the warning is
 * answered with { type: 'answerWarning', answer: 'defend' | 'keep' }.
 *
 * st.waveNotice, after a Defend wave is over:
 *   { wave, tick, text, defendersLost, restoredMix, offer: 'Keep Defend' }
 * answered, if the player wants, with { type: 'keepDefend' }.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./rng.js');
  }
  var rng = BeeGame.rng;

  function initWaves(b) {
    var hb = b.hornets;
    return hb.waves.map(function (w, i) {
      return {
        index: i, size: w.size, arriveTick: w.day * b.ticksPerDay,
        warned: false, answer: null, mixBefore: null,
        arrived: false, over: false, outcome: null,
        atEntrance: 0, inside: [],
        hornetsKilled: 0, gone: 0, defendersLost: 0, beesLost: 0, broodEaten: 0, honeyTaken: 0,
        nextRoundTick: 0
      };
    });
  }

  function adultsOfCaste(st, caste) {
    return st.bees.filter(function (bee) { return bee.stage === 'adult' && bee.caste === caste; });
  }

  function countDefenders(st) {
    return adultsOfCaste(st, 'defender').length;
  }

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  // ---- the warning ----

  // Called at the end of a tick, after the clock has moved on, so the warning
  // and its answer carry the same tick and a replay meets them in order.
  function watch(game, ev, h) {
    var st = game.state;
    var b = game.balance;
    if (st.warning || st.over) return;
    var warnTicks = b.hornets.warnDays * b.ticksPerDay;
    var scouts = adultsOfCaste(st, 'scout').length;
    if (scouts === 0) return;
    for (var i = 0; i < st.waves.length; i += 1) {
      var w = st.waves[i];
      if (w.warned || w.arrived || st.tick < w.arriveTick - warnTicks || st.tick >= w.arriveTick) continue;
      var proposal = h.proposeMatch(game, 'Defend');
      w.warned = true;
      st.warning = {
        wave: w.index, tick: st.tick, size: w.size,
        arrivesTick: w.arriveTick,
        ticksUntil: w.arriveTick - st.tick,
        daysUntil: (w.arriveTick - st.tick) / b.ticksPerDay,
        defenders: countDefenders(st),
        defendMoves: proposal.moved,
        defendText: proposal.text
      };
      st.waveNotice = null;
      st.paused = true;
      ev.push({ type: 'warningRaised', tick: st.tick, warning: h.clone(st.warning) });
      return;
    }
  }

  function answerWarning(game, choice, ev, h) {
    var st = game.state;
    if (!st.warning) throw new Error('No hornet warning is waiting for an answer');
    if (choice.answer !== 'defend' && choice.answer !== 'keep') throw new Error('A warning is answered defend or keep');
    var warning = st.warning;
    var w = st.waves[warning.wave];
    w.answer = choice.answer;
    var result = { answer: choice.answer, wave: w.index, warningTick: warning.tick };
    if (choice.answer === 'defend') {
      w.mixBefore = { name: st.mix.name, shares: h.clone(st.mix.shares) };
      h.setShares(st, 'Defend', game.balance.mixes.Defend);
      result.match = h.applyMatch(game, 'Defend', ev);
    }
    st.warning = null;
    st.paused = false;
    ev.push({ type: 'warningAnswered', tick: st.tick, wave: w.index, answer: choice.answer, warningTick: warning.tick });
    return result;
  }

  function keepDefend(game, ev, h) {
    var st = game.state;
    if (!st.waveNotice) throw new Error('No after-wave notice is showing');
    h.setShares(st, 'Defend', game.balance.mixes.Defend);
    ev.push({ type: 'keptDefend', tick: st.tick, wave: st.waveNotice.wave });
    st.waveNotice = null;
    return { mix: 'Defend' };
  }

  // ---- the fight ----

  function pick(st, list) {
    return list[rng.int(st.rng, list.length)];
  }

  // One defender against one hornet: true if the hornet dies, else the defender does.
  function duel(game, w, defender) {
    if (rng.next(game.state.rng) < game.balance.hornets.defenderWinChance) {
      w.hornetsKilled += 1;
      return true;
    }
    defender.stage = 'dead';
    w.defendersLost += 1;
    return false;
  }

  function round(game, w, ev, h) {
    var st = game.state;
    var hb = game.balance.hornets;
    var before = { killed: w.hornetsKilled, lost: w.defendersLost, bees: w.beesLost, brood: w.broodEaten, honey: w.honeyTaken };
    var defenders = adultsOfCaste(st, 'defender');
    var d = 0;
    // At the entrance: each defender takes on one hornet.
    var engaged = Math.min(w.atEntrance, defenders.length);
    var unengaged = w.atEntrance - engaged;
    var survivors = 0;
    for (var i = 0; i < engaged; i += 1) {
      if (!duel(game, w, defenders[d])) survivors += 1;
      d += 1;
    }
    // Defenders left over go after the hornets already inside.
    var inside = [];
    w.inside.forEach(function (hornet) {
      if (d < defenders.length) {
        var killed = duel(game, w, defenders[d]);
        d += 1;
        if (killed) return;
      }
      inside.push(hornet);
    });
    // Hornets no defender took on get in.
    for (var k = 0; k < unengaged; k += 1) inside.push({ load: 0 });
    w.atEntrance = survivors;
    if (unengaged > 0 || before.killed !== w.hornetsKilled || before.lost !== w.defendersLost) {
      ev.push({
        type: 'fight', tick: st.tick, wave: w.index,
        hornetsKilled: w.hornetsKilled - before.killed, defendersLost: w.defendersLost - before.lost,
        gotIn: unengaged, atEntrance: w.atEntrance, inside: inside.length
      });
    }
    // Inside: each hornet kills a bee, eats brood, takes honey, and may reach the queen.
    var left = [];
    for (var j = 0; j < inside.length; j += 1) {
      var hornet = inside[j];
      var bees = st.bees.filter(function (bee) { return bee.stage === 'adult' && bee.caste !== 'defender'; });
      if (bees.length > 0) {
        pick(st, bees).stage = 'dead';
        w.beesLost += 1;
      }
      var brood = st.bees.filter(function (bee) { return bee.stage === 'egg' || bee.stage === 'larva'; });
      if (brood.length > 0) {
        var eaten = pick(st, brood);
        h.freeBroodCell(st, eaten);
        eaten.stage = 'dead';
        w.broodEaten += 1;
      }
      var take = Math.min(hb.honeyPerRound, Math.max(0, Math.floor(st.resources.honey)));
      st.resources.honey -= take;
      hornet.load += take;
      w.honeyTaken += take;
      if (rng.next(st.rng) < hb.reachQueenChance) {
        st.queen.alive = false;
        ev.push({ type: 'queenDied', tick: st.tick, wave: w.index });
        left = left.concat(inside.slice(j));
        break;
      }
      if (hornet.load >= hb.carry) w.gone += 1;
      else left.push(hornet);
    }
    w.inside = left;
    if (w.beesLost !== before.bees || w.broodEaten !== before.brood || w.honeyTaken !== before.honey) {
      ev.push({
        type: 'beesLost', tick: st.tick, wave: w.index,
        bees: w.beesLost - before.bees, brood: w.broodEaten - before.brood, honey: w.honeyTaken - before.honey
      });
    }
  }

  function endWave(game, w, ev, h) {
    var st = game.state;
    w.over = true;
    w.outcome = w.gone > 0 ? 'gone' : 'beaten';
    ev.push({
      type: 'waveOver', tick: st.tick, wave: w.index, outcome: w.outcome,
      hornetsKilled: w.hornetsKilled, gone: w.gone, defendersLost: w.defendersLost,
      beesLost: w.beesLost, broodEaten: w.broodEaten, honeyTaken: w.honeyTaken
    });
    if (w.answer !== 'defend' || !w.mixBefore) return;
    h.setShares(st, w.mixBefore.name, w.mixBefore.shares);
    var opening = w.outcome === 'beaten' ? 'Wave beaten.' : 'The hornets have gone.';
    st.waveNotice = {
      wave: w.index, tick: st.tick,
      text: opening + ' ' + plural(w.defendersLost, 'defender', 'defenders') + ' lost. Your mix is back to ' + w.mixBefore.name + '.',
      defendersLost: w.defendersLost, restoredMix: w.mixBefore.name, offer: 'Keep Defend'
    };
    ev.push({ type: 'mixRestored', tick: st.tick, wave: w.index, mix: w.mixBefore.name, defendersLost: w.defendersLost, notice: h.clone(st.waveNotice) });
  }

  // Called each tick after the bees have worked: waves arrive and fight.
  function act(game, ev, h) {
    var st = game.state;
    var hb = game.balance.hornets;
    for (var i = 0; i < st.waves.length && st.queen.alive; i += 1) {
      var w = st.waves[i];
      if (w.over) continue;
      if (!w.arrived) {
        if (st.tick < w.arriveTick) continue;
        w.arrived = true;
        w.atEntrance = w.size;
        w.nextRoundTick = st.tick;
        ev.push({ type: 'waveArrived', tick: st.tick, wave: w.index, size: w.size, warned: w.warned, answer: w.answer });
      }
      if (st.tick < w.nextRoundTick) continue;
      w.nextRoundTick = st.tick + hb.roundTicks;
      round(game, w, ev, h);
      if (st.queen.alive && w.atEntrance === 0 && w.inside.length === 0) endWave(game, w, ev, h);
    }
  }

  BeeGame.hornets = {
    initWaves: initWaves, watch: watch, act: act,
    answerWarning: answerWarning, keepDefend: keepDefend
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.hornets;
})(typeof globalThis !== 'undefined' ? globalThis : this);

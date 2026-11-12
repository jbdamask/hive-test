/*
 * The rules of the bee colony game: no drawing, no input, no real time.
 *
 * MODULE PATTERN (every file under game/sim/ and game/data/ follows it).
 * Chrome blocks ES modules on file://, so each file is a classic script
 * wrapped in a function that is called at once with the global object:
 *
 *   (function (root) {
 *     'use strict';
 *     var BeeGame = root.BeeGame = root.BeeGame || {};
 *     ... BeeGame.<name> = { ... };
 *     if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.<name>;
 *   })(typeof globalThis !== 'undefined' ? globalThis : this);
 *
 * Each file sets one property on the global object BeeGame. The browser
 * loads the files with <script> tags, dependencies first
 * (data/balance.js, sim/rng.js, sim/hornets.js, sim/sim.js, sim/record.js);
 * node loads them
 * with require, and a file that needs another requires it when `require`
 * exists.
 *
 * NUMBERS. Every balance number comes from game/data/balance.js. A number
 * literal other than 0 or 1 in game/sim/ or game/ui/ needs a comment on its
 * line containing "not balance" and saying why
 * (game/tests/no-tuned-numbers.test.js checks this).
 *
 * THE GAME. createGame(seed, balance) returns a game. game.step() advances
 * one tick and returns that tick's events (also kept in game.events).
 * game.choose(choice) applies a player choice at the current tick and appends
 * { tick, choice } to game.choices; the same seed and the same choices at the
 * same ticks give the same game.state at every tick. game.proposeMatch(mix)
 * says what Match the mix now would do without doing it. game.score() gives
 * the four score parts and the total. game.state.over, once the game ends,
 * is { reason: 'season' | 'queen', ending: 'season over' | 'queen died', tick }.
 *
 * Hornets (game/sim/hornets.js): a scout that sees a coming wave sets
 * game.state.warning and pauses the game; step() does not advance until the
 * warning is answered. After a wave answered with Defend, the mix goes back
 * and game.state.waveNotice offers Keep Defend.
 *
 * Choices:
 *   { type: 'setMix', mix: 'Gather' }            set one of the four mixes
 *   { type: 'adjustShare', caste, delta: 1|-1 }  plus or minus one share
 *   { type: 'nextEgg', caste }                   hand-pick the next egg (null cancels)
 *   { type: 'matchMix', mix?: 'Defend' }         confirm Match the mix now
 *   { type: 'fixNotice' }                        the laying-stopped notice's fix
 *   { type: 'answerWarning', answer: 'defend'|'keep' }  answer a hornet warning
 *   { type: 'keepDefend' }                       after a wave, put the Defend mix back
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    require('./rng.js');
    require('./hornets.js');
    require('../data/balance.js');
  }
  var rng = BeeGame.rng;
  var hornets = BeeGame.hornets;

  var CASTES = ['builder', 'nurse', 'forager', 'honeymaker', 'scout', 'defender'];
  var WORDS = {
    builder: { one: 'builder', many: 'builders', job: 'building', fix: 'Add builders' },
    nurse: { one: 'nurse', many: 'nurses', job: 'nursing', fix: 'Add nurses' },
    forager: { one: 'forager', many: 'foragers', job: 'foraging', fix: 'Add foragers' },
    honeymaker: { one: 'honeymaker', many: 'honeymakers', job: 'honeymaking', fix: 'Add honeymakers' },
    scout: { one: 'scout', many: 'scouts', job: 'scouting', fix: 'Add scouts' },
    defender: { one: 'defender', many: 'defenders', job: 'defence', fix: 'Add defenders' }
  };
  var STORES = ['honey', 'nectar', 'pollen'];
  var NOTICES = {
    cleanCells: { caste: 'nurse', text: 'The queen has stopped laying: no clean cells. More nurses would clean them.' },
    emptyCells: { caste: 'builder', text: 'The queen has stopped laying: no empty cells. More builders would build comb.' },
    honey: { caste: 'honeymaker', text: 'The queen has stopped laying: not enough honey. More honeymakers would make it.' },
    pollen: { caste: 'forager', text: 'The queen has stopped laying: not enough pollen. More foragers would bring it.' }
  };

  function zeroShares() {
    var out = {};
    CASTES.forEach(function (c) { out[c] = 0; });
    return out;
  }

  function copyShares(shares) {
    var out = {};
    CASTES.forEach(function (c) { out[c] = shares[c] || 0; });
    return out;
  }

  function sumShares(shares) {
    return CASTES.reduce(function (t, c) { return t + shares[c]; }, 0);
  }

  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function isCaste(c) {
    return CASTES.indexOf(c) >= 0;
  }

  function newId(st) {
    var id = st.nextId;
    st.nextId += 1;
    return id;
  }

  // ---- setting up a game ----

  function layMeadow(st, b) {
    var m = b.meadow;
    var patches = [];
    for (var i = 0; i < m.patches; i += 1) {
      var angle = rng.next(st.rng) * Math.PI * 2; // not balance: a full turn, for drawing only
      var distance = rng.range(st.rng, m.minDistance, m.maxDistance);
      var nectar = rng.range(st.rng, m.nectarMin, m.nectarMax);
      var pollen = rng.range(st.rng, m.pollenMin, m.pollenMax);
      patches.push({
        id: i, distance: distance, angle: angle,
        nectar: nectar, nectarMax: nectar, pollen: pollen, pollenMax: pollen,
        found: false
      });
    }
    var nearest = patches.slice().sort(function (p, q) { return p.distance - q.distance || p.id - q.id; });
    for (var k = 0; k < m.knownAtStart && k < nearest.length; k += 1) nearest[k].found = true;
    return patches;
  }

  function addCell(st, chamber) {
    var cell = { id: newId(st), chamber: chamber.id, content: 'empty', bee: null };
    st.cells.push(cell);
    chamber.cells += 1;
    return cell;
  }

  function addChamber(st) {
    var chamber = { id: st.chambers.length, cells: 0 };
    st.chambers.push(chamber);
    return chamber;
  }

  function makeAdult(st, caste, adultTick) {
    return {
      id: newId(st), caste: caste, stage: 'adult', cell: null,
      laidTick: adultTick, stageTick: adultTick, fed: 0, handPicked: false,
      task: null, target: null, left: 0
    };
  }

  function initialState(seed, b) {
    var s = b.start;
    var st = {
      seed: seed,
      tick: 0,
      rng: rng.seedState(seed),
      paused: false,
      over: null,
      nextId: 1,
      mix: { name: b.startMix, shares: copyShares(b.mixes[b.startMix]) },
      laidSinceMix: zeroShares(),
      laid: zeroShares(),
      handPickedLaid: 0,
      nextEggCaste: null,
      queen: { alive: true, nextLayTick: 0 },
      notice: null,
      resources: { nectar: s.nectar, pollen: s.pollen, honey: s.honey, wax: s.wax },
      honeyMade: 0,
      chambers: [],
      cells: [],
      bees: [],
      patches: [],
      waves: hornets.initWaves(b),
      warning: null,
      waveNotice: null
    };
    st.patches = layMeadow(st, b);
    var left = s.cells;
    for (var c = 0; c < s.chambers; c += 1) {
      var chamber = addChamber(st);
      while (left > 0 && chamber.cells < b.hive.cellsPerChamber) {
        addCell(st, chamber);
        left -= 1;
      }
    }
    var maxAge = s.maxAgeDays * b.ticksPerDay;
    CASTES.forEach(function (caste) {
      for (var i = 0; i < (s.bees[caste] || 0); i += 1) {
        st.bees.push(makeAdult(st, caste, -rng.int(st.rng, maxAge + 1)));
      }
    });
    reconcileStores(st, b, []);
    return st;
  }

  // ---- laying ----

  // The caste furthest below its share of the eggs laid since the mix was set.
  function mixCaste(st) {
    var shares = st.mix.shares;
    var total = sumShares(shares);
    if (total === 0) return null;
    var n = sumShares(st.laidSinceMix) + 1;
    var best = null;
    var bestGap = -Infinity;
    CASTES.forEach(function (c) {
      var gap = (shares[c] * n) / total - st.laidSinceMix[c];
      if (shares[c] > 0 && gap > bestGap) {
        best = c;
        bestGap = gap;
      }
    });
    return best;
  }

  function firstCell(st, content) {
    for (var i = 0; i < st.cells.length; i += 1) {
      if (st.cells[i].content === content) return st.cells[i];
    }
    return null;
  }

  function showNotice(st, cause, ev) {
    if (st.notice && st.notice.cause === cause) return;
    var n = NOTICES[cause];
    st.notice = {
      kind: 'layingStopped', cause: cause, text: n.text,
      fix: { caste: n.caste, label: WORDS[n.caste].fix }, tick: st.tick
    };
    ev.push({ type: 'noticeShown', tick: st.tick, notice: clone(st.notice) });
  }

  function queenLays(game, ev) {
    var st = game.state;
    var b = game.balance;
    if (!st.queen.alive || st.tick < st.queen.nextLayTick) return;
    st.queen.nextLayTick = st.tick + b.queen.layTicks;
    var picked = st.nextEggCaste;
    var caste = picked || mixCaste(st);
    if (!caste) return;
    var cell = firstCell(st, 'empty');
    var cause = null;
    if (!cell) cause = firstCell(st, 'dirty') ? 'cleanCells' : 'emptyCells';
    else if (st.resources.honey < b.queen.eggHoney) cause = 'honey';
    else if (st.resources.pollen < b.queen.eggPollen) cause = 'pollen';
    if (cause) {
      showNotice(st, cause, ev);
      return;
    }
    if (st.notice && st.notice.kind === 'layingStopped') {
      st.notice = null;
      ev.push({ type: 'noticeCleared', tick: st.tick });
    }
    st.resources.honey -= b.queen.eggHoney;
    st.resources.pollen -= b.queen.eggPollen;
    var egg = {
      id: newId(st), caste: caste, stage: 'egg', cell: cell.id,
      laidTick: st.tick, stageTick: st.tick, fed: 0, handPicked: !!picked,
      task: null, target: null, left: 0
    };
    st.bees.push(egg);
    cell.content = 'brood';
    cell.bee = egg.id;
    st.laid[caste] += 1;
    if (picked) {
      st.nextEggCaste = null;
      st.handPickedLaid += 1;
    } else {
      st.laidSinceMix[caste] += 1;
    }
    ev.push({ type: 'eggLaid', tick: st.tick, beeId: egg.id, caste: caste, cell: cell.id, handPicked: !!picked });
  }

  // ---- brood and ageing ----

  function cellById(st, id) {
    for (var i = 0; i < st.cells.length; i += 1) if (st.cells[i].id === id) return st.cells[i];
    return null;
  }

  function freeBroodCell(st, bee) {
    var cell = cellById(st, bee.cell);
    if (cell) {
      cell.content = 'dirty';
      cell.bee = null;
    }
    bee.cell = null;
  }

  function growBrood(game, ev) {
    var st = game.state;
    var br = game.balance.brood;
    st.bees.forEach(function (bee) {
      var age = st.tick - bee.stageTick;
      if (bee.stage === 'egg' && age >= br.eggTicks) {
        bee.stage = 'larva';
        bee.stageTick = st.tick;
        ev.push({ type: 'larvaHatched', tick: st.tick, beeId: bee.id, caste: bee.caste, cell: bee.cell });
      } else if (bee.stage === 'larva') {
        if (age >= br.larvaTicks && bee.fed >= br.feedsNeeded) {
          var cell = bee.cell;
          freeBroodCell(st, bee);
          bee.stage = 'adult';
          bee.stageTick = st.tick;
          ev.push({ type: 'adultEmerged', tick: st.tick, beeId: bee.id, caste: bee.caste, cell: cell });
        } else if (age >= br.larvaMaxTicks) {
          var deadCell = bee.cell;
          freeBroodCell(st, bee);
          bee.stage = 'dead';
          ev.push({ type: 'larvaDied', tick: st.tick, beeId: bee.id, caste: bee.caste, cell: deadCell });
        }
      }
    });
  }

  function ageAdults(game, ev) {
    var st = game.state;
    var life = game.balance.adult.lifeDays * game.balance.ticksPerDay;
    st.bees.forEach(function (bee) {
      if (bee.stage === 'adult' && st.tick - bee.stageTick >= life) {
        bee.stage = 'dead';
        ev.push({ type: 'beeDied', tick: st.tick, beeId: bee.id, caste: bee.caste });
      }
    });
    st.bees = st.bees.filter(function (bee) { return bee.stage !== 'dead'; });
  }

  // ---- the bees' work ----

  function key(target) {
    return target ? target.kind + ':' + target.id : '';
  }

  // What every adult is already working on, so two bees never take one target.
  function takenTargets(st) {
    var taken = {};
    st.bees.forEach(function (bee) {
      if (bee.stage === 'adult' && bee.target) taken[key(bee.target)] = (taken[key(bee.target)] || 0) + 1;
    });
    return taken;
  }

  function begin(bee, task, target, ticks, taken) {
    bee.task = task;
    bee.target = target;
    bee.left = ticks;
    if (target) taken[key(target)] = (taken[key(target)] || 0) + 1;
  }

  function chamberWithRoom(st, b, taken) {
    for (var i = 0; i < st.chambers.length; i += 1) {
      var ch = st.chambers[i];
      if (ch.cells + (taken['chamber:' + ch.id] || 0) < b.hive.cellsPerChamber) return ch;
    }
    return null;
  }

  function startBuilder(game, bee, taken) {
    var st = game.state;
    var b = game.balance;
    var bb = b.builder;
    var r = st.resources;
    var room = chamberWithRoom(st, b, taken);
    if (room && r.wax >= bb.waxPerCell) {
      r.wax -= bb.waxPerCell;
      return begin(bee, 'buildCell', { kind: 'chamber', id: room.id }, bb.cellTicks, taken);
    }
    if (!room && !taken['hive:new-chamber'] && r.wax >= bb.waxPerChamber) {
      r.wax -= bb.waxPerChamber;
      return begin(bee, 'addChamber', { kind: 'hive', id: 'new-chamber' }, bb.chamberTicks, taken);
    }
    var waxWanted = room ? bb.waxPerCell : bb.waxPerChamber;
    if (r.wax < waxWanted && r.honey - bb.honeyPerWax >= bb.honeyReserve) {
      r.honey -= bb.honeyPerWax;
      return begin(bee, 'makeWax', null, bb.waxTicks, taken);
    }
    return begin(bee, 'idle', null, b.idleTicks, taken);
  }

  function startNurse(game, bee, taken) {
    var st = game.state;
    var b = game.balance;
    var r = st.resources;
    if (r.honey >= b.nurse.feedHoney && r.pollen >= b.nurse.feedPollen) {
      for (var i = 0; i < st.bees.length; i += 1) {
        var larva = st.bees[i];
        if (larva.stage === 'larva' && larva.fed < b.brood.feedsNeeded && !taken['larva:' + larva.id]) {
          r.honey -= b.nurse.feedHoney;
          r.pollen -= b.nurse.feedPollen;
          return begin(bee, 'feedLarva', { kind: 'larva', id: larva.id, cell: larva.cell }, b.nurse.feedTicks, taken);
        }
      }
    }
    for (var j = 0; j < st.cells.length; j += 1) {
      var cell = st.cells[j];
      if (cell.content === 'dirty' && !taken['cell:' + cell.id]) {
        return begin(bee, 'cleanCell', { kind: 'cell', id: cell.id }, b.nurse.cleanTicks, taken);
      }
    }
    return begin(bee, 'idle', null, b.idleTicks, taken);
  }

  function tripTicks(b, patch) {
    return b.forager.baseTripTicks + patch.distance * b.forager.tripTicksPerDistance;
  }

  function startForager(game, bee, taken) {
    var st = game.state;
    var b = game.balance;
    var best = null;
    var bestValue = 0;
    st.patches.forEach(function (p) {
      if (!p.found) return;
      var value = (p.nectar + p.pollen) / tripTicks(b, p);
      if (value > bestValue) {
        best = p;
        bestValue = value;
      }
    });
    if (best) return begin(bee, 'forage', { kind: 'patch', id: best.id }, tripTicks(b, best), taken);
    return begin(bee, 'idle', null, b.idleTicks, taken);
  }

  function startHoneymaker(game, bee, taken) {
    var r = game.state.resources;
    var h = game.balance.honeymaker;
    if (r.nectar >= h.nectarPerHoney) {
      r.nectar -= h.nectarPerHoney;
      return begin(bee, 'makeHoney', null, h.ticks, taken);
    }
    return begin(bee, 'idle', null, game.balance.idleTicks, taken);
  }

  function startScout(game, bee, taken) {
    var unfound = game.state.patches.some(function (p) { return !p.found; });
    if (unfound) return begin(bee, 'search', null, game.balance.scout.searchTicks, taken);
    return begin(bee, 'idle', null, game.balance.idleTicks, taken);
  }

  function startDefender(game, bee, taken) {
    return begin(bee, 'guard', { kind: 'entrance', id: 0 }, game.balance.defender.guardTicks, taken);
  }

  var STARTERS = {
    builder: startBuilder, nurse: startNurse, forager: startForager,
    honeymaker: startHoneymaker, scout: startScout, defender: startDefender
  };

  function finishTask(game, bee, ev) {
    var st = game.state;
    var b = game.balance;
    var r = st.resources;
    var t = st.tick;
    var base = { tick: t, beeId: bee.id, caste: bee.caste };
    function emit(type, extra) {
      var e = { type: type };
      Object.keys(base).forEach(function (k) { e[k] = base[k]; });
      Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
      ev.push(e);
    }
    switch (bee.task) {
      case 'makeWax':
        r.wax += 1;
        emit('waxMade');
        break;
      case 'buildCell': {
        var chamber = st.chambers[bee.target.id];
        var cell = addCell(st, chamber);
        emit('cellBuilt', { cell: cell.id, chamber: chamber.id });
        break;
      }
      case 'addChamber': {
        var ch = addChamber(st);
        emit('chamberAdded', { chamber: ch.id });
        break;
      }
      case 'feedLarva': {
        var larva = null;
        for (var i = 0; i < st.bees.length; i += 1) if (st.bees[i].id === bee.target.id) larva = st.bees[i];
        if (larva && larva.stage === 'larva') {
          larva.fed += 1;
          emit('larvaFed', { larva: larva.id, cell: larva.cell });
        }
        break;
      }
      case 'cleanCell': {
        var dirty = cellById(st, bee.target.id);
        if (dirty && dirty.content === 'dirty') {
          dirty.content = 'empty';
          emit('cellCleaned', { cell: dirty.id });
        }
        break;
      }
      case 'forage': {
        var p = st.patches[bee.target.id];
        var nectar = Math.min(b.forager.nectarLoad, Math.floor(p.nectar));
        var pollen = Math.min(b.forager.pollenLoad, Math.floor(p.pollen));
        p.nectar -= nectar;
        p.pollen -= pollen;
        r.nectar += nectar;
        r.pollen += pollen;
        if (nectar > 0) emit('nectarDelivered', { patch: p.id, amount: nectar });
        if (pollen > 0) emit('pollenDelivered', { patch: p.id, amount: pollen });
        break;
      }
      case 'makeHoney':
        r.honey += 1;
        st.honeyMade += 1;
        emit('honeyMade');
        break;
      case 'search': {
        if (rng.next(st.rng) < b.scout.findChance) {
          var unfound = st.patches.filter(function (q) { return !q.found; });
          if (unfound.length > 0) {
            var found = unfound[rng.int(st.rng, unfound.length)];
            found.found = true;
            emit('patchFound', { patch: found.id });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function work(game, ev) {
    var st = game.state;
    var taken = takenTargets(st);
    st.bees.forEach(function (bee) {
      if (bee.stage !== 'adult') return;
      if (bee.task) {
        bee.left -= 1;
        if (bee.left > 0) return;
        if (bee.target) taken[key(bee.target)] -= 1;
        if (bee.target && !taken[key(bee.target)]) delete taken[key(bee.target)];
        finishTask(game, bee, ev);
        bee.task = null;
        bee.target = null;
      }
      STARTERS[bee.caste](game, bee, taken);
    });
  }

  // ---- the meadow and the stores ----

  function regrow(game) {
    var g = game.balance.meadow.regrowPerTick;
    game.state.patches.forEach(function (p) {
      p.nectar = Math.min(p.nectarMax, p.nectar + g);
      p.pollen = Math.min(p.pollenMax, p.pollen + g);
    });
  }

  // Each store takes as many cells as it needs; a store that can find no cell
  // loses what does not fit, and a cell whose store is used up turns dirty.
  function reconcileStores(st, b, ev) {
    var cap = b.hive.cellCapacity;
    STORES.forEach(function (kind) {
      var mine = st.cells.filter(function (c) { return c.content === kind; });
      var need = Math.ceil(st.resources[kind] / cap);
      if (mine.length > need + b.hive.storeSlackCells) {
        for (var i = mine.length - 1; i >= need; i -= 1) mine[i].content = 'dirty';
      } else if (mine.length < need) {
        var have = mine.length;
        for (var j = 0; j < st.cells.length && have < need; j += 1) {
          if (st.cells[j].content === 'empty') {
            st.cells[j].content = kind;
            have += 1;
          }
        }
        if (have < need) {
          var lost = st.resources[kind] - have * cap;
          st.resources[kind] = have * cap;
          ev.push({ type: 'storeFull', tick: st.tick, store: kind, lost: lost });
        }
      }
    });
  }

  // ---- Match the mix now ----

  function adultsOf(st) {
    return st.bees.filter(function (bee) { return bee.stage === 'adult'; });
  }

  function listWords(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  function matchText(moves) {
    if (moves.length === 0) return 'Your bees already fit the mix.';
    var clauses = [];
    CASTES.forEach(function (to) {
      var parts = moves.filter(function (m) { return m.to === to; }).map(function (m) {
        return m.count + ' ' + (m.count === 1 ? WORDS[m.from].one : WORDS[m.from].many);
      });
      if (parts.length > 0) clauses.push(listWords(parts) + ' to ' + WORDS[to].job);
    });
    var text = clauses.length === 1 ? clauses[0]
      : clauses.slice(0, -1).join(', ') + ', and ' + clauses[clauses.length - 1];
    return 'Move ' + text + '.';
  }

  function proposeMatch(game, mixName) {
    var st = game.state;
    if (mixName && !game.balance.mixes[mixName]) throw new Error('No mix called ' + mixName);
    var shares = mixName ? copyShares(game.balance.mixes[mixName]) : st.mix.shares;
    var total = sumShares(shares);
    var adults = adultsOf(st);
    var n = adults.length;
    var have = zeroShares();
    adults.forEach(function (bee) { have[bee.caste] += 1; });
    if (total === 0 || n === 0) return { mix: mixName || st.mix.name, moves: [], moved: 0, text: matchText([]) };
    // Largest remainder: each caste gets the whole part of its share, and the
    // bees left over go to the largest fractions, in caste order on a tie.
    var want = zeroShares();
    var placed = 0;
    var fractions = CASTES.map(function (c, i) {
      var exact = (shares[c] * n) / total;
      want[c] = Math.floor(exact);
      placed += want[c];
      return { caste: c, frac: exact - want[c], order: i };
    });
    fractions.sort(function (p, q) { return q.frac - p.frac || p.order - q.order; });
    for (var k = 0; placed < n; k += 1) {
      want[fractions[k].caste] += 1;
      placed += 1;
    }
    var surplus = CASTES.filter(function (c) { return have[c] > want[c]; })
      .map(function (c) { return { caste: c, n: have[c] - want[c] }; });
    var deficit = CASTES.filter(function (c) { return have[c] < want[c]; })
      .map(function (c) { return { caste: c, n: want[c] - have[c] }; });
    var moves = [];
    var s = 0;
    var d = 0;
    while (s < surplus.length && d < deficit.length) {
      var count = Math.min(surplus[s].n, deficit[d].n);
      moves.push({ from: surplus[s].caste, to: deficit[d].caste, count: count });
      surplus[s].n -= count;
      deficit[d].n -= count;
      if (surplus[s].n === 0) s += 1;
      if (deficit[d].n === 0) d += 1;
    }
    var moved = moves.reduce(function (t, m) { return t + m.count; }, 0);
    return { mix: mixName || st.mix.name, moves: moves, moved: moved, text: matchText(moves) };
  }

  function applyMatch(game, mixName, ev) {
    var plan = proposeMatch(game, mixName);
    var adults = adultsOf(game.state);
    plan.moves.forEach(function (m) {
      var left = m.count;
      adults.forEach(function (bee) {
        if (left > 0 && bee.caste === m.from && !bee.movedNow) {
          bee.caste = m.to;
          bee.task = null;
          bee.target = null;
          bee.left = 0;
          bee.movedNow = true;
          left -= 1;
        }
      });
    });
    adults.forEach(function (bee) { delete bee.movedNow; });
    ev.push({ type: 'beesMoved', tick: game.state.tick, moves: clone(plan.moves), text: plan.text });
    return plan;
  }

  // ---- choices ----

  function setShares(st, name, shares) {
    st.mix = { name: name, shares: copyShares(shares) };
    st.laidSinceMix = zeroShares();
  }

  // What game/sim/hornets.js may use from here.
  var HELPERS = {
    clone: clone, setShares: setShares, freeBroodCell: freeBroodCell,
    proposeMatch: proposeMatch, applyMatch: applyMatch
  };

  function choose(game, choice) {
    var st = game.state;
    var b = game.balance;
    if (st.over) throw new Error('The game is over');
    if (!choice || typeof choice.type !== 'string') throw new Error('A choice needs a type');
    var ev = [];
    var result = null;
    switch (choice.type) {
      case 'setMix':
        if (!b.mixes[choice.mix]) throw new Error('No mix called ' + choice.mix);
        setShares(st, choice.mix, b.mixes[choice.mix]);
        break;
      case 'adjustShare': {
        if (!isCaste(choice.caste)) throw new Error('No caste called ' + choice.caste);
        if (choice.delta !== 1 && choice.delta !== -1) throw new Error('A share changes by 1 or -1');
        var shares = copyShares(st.mix.shares);
        shares[choice.caste] = Math.max(0, shares[choice.caste] + choice.delta);
        setShares(st, 'Custom', shares);
        break;
      }
      case 'nextEgg':
        if (choice.caste !== null && !isCaste(choice.caste)) throw new Error('No caste called ' + choice.caste);
        st.nextEggCaste = choice.caste;
        break;
      case 'matchMix':
        result = applyMatch(game, choice.mix || null, ev);
        break;
      case 'fixNotice': {
        if (!st.notice || !st.notice.fix) throw new Error('No notice with a fix is showing');
        var fixed = copyShares(st.mix.shares);
        fixed[st.notice.fix.caste] += 1;
        setShares(st, 'Custom', fixed);
        result = { caste: st.notice.fix.caste, shares: copyShares(fixed) };
        break;
      }
      case 'answerWarning':
        result = hornets.answerWarning(game, choice, ev, HELPERS);
        break;
      case 'keepDefend':
        result = hornets.keepDefend(game, ev, HELPERS);
        break;
      default:
        throw new Error('Unknown choice ' + choice.type);
    }
    game.choices.push({ tick: st.tick, choice: clone(choice) });
    game.events = game.events.concat(ev);
    return result;
  }

  // ---- the tick ----

  function seasonTicks(b) {
    return b.daysPerSeason * b.ticksPerDay;
  }

  function step(game) {
    var st = game.state;
    var ev = [];
    if (st.paused || st.over || st.warning) {
      game.events = ev;
      return ev;
    }
    queenLays(game, ev);
    growBrood(game, ev);
    work(game, ev);
    hornets.act(game, ev, HELPERS);
    ageAdults(game, ev);
    regrow(game);
    reconcileStores(st, game.balance, ev);
    st.tick += 1;
    if (!st.queen.alive) {
      st.over = { reason: 'queen', ending: 'queen died', tick: st.tick };
      ev.push({ type: 'gameOver', tick: st.tick, reason: 'queen', ending: 'queen died' });
    } else if (st.tick >= seasonTicks(game.balance)) {
      st.over = { reason: 'season', ending: 'season over', tick: st.tick };
      ev.push({ type: 'gameOver', tick: st.tick, reason: 'season', ending: 'season over' });
    } else {
      hornets.watch(game, ev, HELPERS);
    }
    game.events = ev;
    return ev;
  }

  function score(game) {
    var st = game.state;
    var parts = {
      livingBees: adultsOf(st).length,
      honeyMade: st.honeyMade,
      combCells: st.cells.length,
      chambers: st.chambers.length
    };
    parts.total = parts.livingBees + parts.honeyMade + parts.combCells + parts.chambers;
    return parts;
  }

  function createGame(seed, balance) {
    var b = balance || BeeGame.balance;
    if (seed === undefined || seed === null || seed === '') throw new Error('createGame needs a seed');
    var game = {
      balance: b,
      state: initialState(seed, b),
      choices: [],
      events: []
    };
    game.step = function () { return step(game); };
    game.choose = function (choice) { return choose(game, choice); };
    game.proposeMatch = function (mixName) { return proposeMatch(game, mixName); };
    game.score = function () { return score(game); };
    game.day = function () { return Math.floor(game.state.tick / b.ticksPerDay); };
    game.seasonTicks = function () { return seasonTicks(b); };
    Object.defineProperty(game, 'paused', {
      get: function () { return game.state.paused; },
      set: function (v) { game.state.paused = !!v; }
    });
    return game;
  }

  BeeGame.sim = { createGame: createGame, CASTES: CASTES, WORDS: WORDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.sim;
})(typeof globalThis !== 'undefined' ? globalThis : this);

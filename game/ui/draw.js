/*
 * Drawing the game on the canvas: shapes and colour only. Reads the game
 * state and the tick's events and never changes the game. Every size,
 * place and colour comes from game/data/layout.js; numbers the rules use come
 * from game/data/balance.js. Module pattern: see the header of game/sim/sim.js.
 *
 * The meadow is on the left: the hive in the middle, flower patches around it,
 * foragers flying out and back, scouts searching, defenders at the entrance
 * and hornets attacking it. The hive's inside is on the right: its chambers,
 * each with its comb cells coloured by what they hold, and the bees working
 * inside, each placed at the cell or chamber its task is about.
 *
 *   BeeGame.draw.setup(canvas)              sizes the canvas, returns its 2D context
 *   BeeGame.draw.frame(ctx, game, fx, now)  draws one frame
 *   BeeGame.draw.addEvents(fx, events, game, now)  turns a tick's events into flashes
 *   BeeGame.draw.feedLine(event)            one line for "What just happened", or null
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};
  var L = BeeGame.layout;
  var C = L.colours;
  var TURN = Math.PI * 2; // not balance: a full turn in radians
  var HALF = 0.5; // not balance: a half, for centring

  // ---- places ----

  // A stable number in [0, 1) from a whole number, so a bee keeps its place
  // from frame to frame. It never touches the game's own random numbers.
  function spread(n, salt) {
    var x = Math.sin(n * 12.9898 + (salt || 0) * 78.233) * 43758.5453; // not balance: a common shader hash
    return x - Math.floor(x);
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function meadowCentre() {
    var m = L.meadow;
    return { x: m.x + m.width * HALF, y: m.y + m.height * HALF };
  }

  function meadowScale(b) {
    var m = L.meadow;
    var radius = Math.min(m.width, m.height) * HALF - m.margin;
    return radius / b.meadow.maxDistance;
  }

  function patchPlace(p, b) {
    var c = meadowCentre();
    var r = p.distance * meadowScale(b) + L.hiveRadius;
    return { x: c.x + Math.cos(p.angle) * r, y: c.y + Math.sin(p.angle) * r };
  }

  // Where each chamber's box and each comb cell sit in the hive panel.
  // `boxes` is one more than the chambers when a builder is adding one.
  function scene(game) {
    var st = game.state;
    var b = game.balance;
    var h = L.hive;
    var adding = st.bees.some(function (bee) { return bee.stage === 'adult' && bee.task === 'addChamber'; });
    var n = st.chambers.length + (adding ? 1 : 0);
    var cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    var rows = Math.max(1, Math.ceil(n / cols));
    var boxW = (h.width - h.gap * (cols - 1)) / cols;
    var boxH = (h.height - h.gap * (rows - 1)) / rows;
    var cellRows = Math.ceil(b.hive.cellsPerChamber / L.cellColumns);
    var size = Math.min((boxW - h.padding * 2) / (L.cellColumns + HALF), (boxH - h.padding * 2) / cellRows); // not balance: padding on both sides
    var boxes = [];
    for (var i = 0; i < n; i += 1) {
      boxes.push({
        x: h.x + (i % cols) * (boxW + h.gap),
        y: h.y + Math.floor(i / cols) * (boxH + h.gap),
        w: boxW, h: boxH, planned: i >= st.chambers.length
      });
    }
    function slot(chamberId, index) {
      var box = boxes[chamberId];
      var row = Math.floor(index / L.cellColumns);
      var col = index % L.cellColumns;
      var shift = row % 2 ? size * HALF : 0; // not balance: every other row shifts half a cell, like comb
      return {
        x: box.x + h.padding + shift + (col + HALF) * size,
        y: box.y + h.padding + (row + HALF) * size,
        s: size
      };
    }
    var cellPlace = {};
    var counts = {};
    st.cells.forEach(function (cell) {
      var k = counts[cell.chamber] || 0;
      counts[cell.chamber] = k + 1;
      cellPlace[cell.id] = slot(cell.chamber, k);
    });
    return { boxes: boxes, slot: slot, cellPlace: cellPlace, size: size };
  }

  function restPlace(id) {
    var h = L.hive;
    var edge = (1 - L.restSpread) * HALF;
    return {
      x: h.x + h.width * (edge + spread(id, 1) * L.restSpread),
      y: h.y + h.height * (edge + spread(id, 2) * L.restSpread) // not balance: a second salt for y
    };
  }

  // Where a bee is drawn, from its task and target; meadow: true for the left side.
  function beePlace(game, sc, bee, honeyCells) {
    var st = game.state;
    var b = game.balance;
    var t = bee.target;
    var c = meadowCentre();
    switch (bee.task) {
      case 'forage': {
        var p = st.patches[t.id];
        var total = b.forager.baseTripTicks + p.distance * b.forager.tripTicksPerDistance;
        var done = clamp01(1 - bee.left / total);
        var out = done < HALF;
        var along = out ? done / HALF : (1 - done) / HALF;
        var pp = patchPlace(p, b);
        return {
          meadow: true, x: c.x + (pp.x - c.x) * along, y: c.y + (pp.y - c.y) * along,
          carrying: !out
        };
      }
      case 'search': {
        var phase = clamp01(1 - bee.left / b.scout.searchTicks);
        var angle = spread(bee.id, 3) * TURN + phase * L.scoutTurnsPerTrip * TURN; // not balance: a salt
        var r = L.scoutRingMin + (L.scoutRingMax - L.scoutRingMin) * Math.sin(phase * Math.PI);
        return { meadow: true, x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r };
      }
      case 'guard': {
        var a = spread(bee.id, 4) * TURN; // not balance: a salt
        return { meadow: true, x: c.x + Math.cos(a) * L.entranceRing, y: c.y + Math.sin(a) * L.entranceRing };
      }
      case 'buildCell': {
        var ch = st.chambers[t.id];
        if (ch && ch.cells < b.hive.cellsPerChamber) return sc.slot(ch.id, ch.cells);
        break;
      }
      case 'addChamber': {
        var box = sc.boxes[sc.boxes.length - 1];
        return { x: box.x + box.w * HALF, y: box.y + box.h * HALF };
      }
      case 'feedLarva':
        if (sc.cellPlace[t.cell]) return sc.cellPlace[t.cell];
        break;
      case 'cleanCell':
        if (sc.cellPlace[t.id]) return sc.cellPlace[t.id];
        break;
      case 'makeHoney':
        if (honeyCells.length > 0) return sc.cellPlace[honeyCells[bee.id % honeyCells.length].id];
        break;
      default:
        break;
    }
    return restPlace(bee.id);
  }

  // ---- shapes ----

  function hexPath(ctx, x, y, r) {
    ctx.beginPath();
    for (var k = 0; k < 6; k += 1) { // not balance: a hexagon has six corners
      var a = (Math.PI / 3) * k + Math.PI / 6; // not balance: sixty degrees a side, pointy top
      if (k === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
      else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    ctx.closePath();
  }

  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TURN);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawBee(ctx, x, y, caste, carrying) {
    var r = L.beeRadius;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1 + HALF), r, 0, 0, TURN);
    ctx.fillStyle = C.castes[caste];
    ctx.fill();
    ctx.strokeStyle = C.hornetStripe;
    ctx.lineWidth = HALF;
    ctx.stroke();
    ctx.lineWidth = 1;
    if (carrying) {
      circle(ctx, x - r, y + r * HALF, r * HALF, C.carryPollen, null);
      circle(ctx, x + r, y + r * HALF, r * HALF, C.carryNectar, null);
    }
  }

  function drawHornet(ctx, x, y) {
    var r = L.hornetRadius;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1 + HALF), r, 0, 0, TURN);
    ctx.fillStyle = C.hornet;
    ctx.fill();
    ctx.fillStyle = C.hornetStripe;
    ctx.fillRect(x - r * HALF, y - r, r * HALF, r * (1 + 1));
  }

  // ---- the meadow ----

  function drawMeadow(ctx, game) {
    var st = game.state;
    var b = game.balance;
    var m = L.meadow;
    ctx.fillStyle = C.meadow;
    ctx.fillRect(m.x, m.y, m.width, m.height);
    ctx.strokeStyle = C.meadowEdge;
    ctx.strokeRect(m.x, m.y, m.width, m.height);
    st.patches.forEach(function (p) {
      var pl = patchPlace(p, b);
      var full = clamp01((p.nectar + p.pollen) / (p.nectarMax + p.pollenMax));
      var r = L.patchMinRadius + (L.patchMaxRadius - L.patchMinRadius) * full;
      if (!p.found) {
        circle(ctx, pl.x, pl.y, L.patchMaxRadius, C.patchUnknown, null);
        return;
      }
      circle(ctx, pl.x, pl.y, L.patchMaxRadius, null, C.patchEmpty);
      circle(ctx, pl.x, pl.y, r, C.patchKnown, null);
      circle(ctx, pl.x, pl.y, r * HALF, C.carryPollen, null);
    });
    var c = meadowCentre();
    hexPath(ctx, c.x, c.y, L.hiveRadius);
    ctx.fillStyle = C.hiveBody;
    ctx.fill();
    ctx.strokeStyle = C.hiveEdge;
    ctx.stroke();
  }

  function drawWaves(ctx, game, sc) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.meadow.x, L.meadow.y, L.meadow.width, L.meadow.height);
    ctx.rect(L.hive.x, L.hive.y, L.hive.width, L.hive.height);
    ctx.clip(); // hornets still on their way stay inside the meadow
    drawHornets(ctx, game, sc);
    ctx.restore();
  }

  function drawHornets(ctx, game, sc) {
    var st = game.state;
    var b = game.balance;
    var c = meadowCentre();
    var warnTicks = b.hornets.warnDays * b.ticksPerDay;
    st.waves.forEach(function (w) {
      var base = spread(w.index, 5) * TURN; // not balance: a salt
      if (w.warned && !w.arrived) {
        var far = clamp01((w.arriveTick - st.tick) / warnTicks);
        var dist = L.hornetRing + (L.approachFar - L.hornetRing) * far;
        for (var i = 0; i < w.size; i += 1) {
          var a = base + (spread(i, w.index) - HALF) * HALF;
          var d = dist + spread(i, w.index + TURN) * L.hornetRing;
          drawHornet(ctx, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d);
        }
      }
      if (!w.arrived || w.over) return;
      for (var j = 0; j < w.atEntrance; j += 1) {
        var ang = base + (j / Math.max(1, w.atEntrance)) * TURN;
        drawHornet(ctx, c.x + Math.cos(ang) * L.hornetRing, c.y + Math.sin(ang) * L.hornetRing);
      }
      w.inside.forEach(function (hornet, k) {
        var pl = restPlace(-(w.index * w.size + k + 1)); // negative, so a hornet never takes a bee's place
        drawHornet(ctx, pl.x, pl.y);
      });
    });
  }

  // ---- the hive ----

  function drawHive(ctx, game, sc) {
    var st = game.state;
    var b = game.balance;
    var h = L.hive;
    ctx.fillStyle = C.hivePanel;
    ctx.fillRect(h.x - h.padding, h.y - h.padding, h.width + h.padding * 2, h.height + h.padding * 2); // not balance: both sides
    sc.boxes.forEach(function (box, i) {
      ctx.fillStyle = C.chamber;
      ctx.strokeStyle = box.planned ? C.chamberPlanned : C.chamberEdge;
      if (box.planned) ctx.setLineDash([L.beeRadius, L.beeRadius]);
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.setLineDash([]);
      if (box.planned) return;
      for (var k = st.chambers[i].cells; k < b.hive.cellsPerChamber; k += 1) {
        var s = sc.slot(i, k);
        hexPath(ctx, s.x, s.y, s.s * HALF - L.cellGap);
        ctx.strokeStyle = C.slot;
        ctx.stroke();
      }
    });
    var beeById = {};
    st.bees.forEach(function (bee) { beeById[bee.id] = bee; });
    st.cells.forEach(function (cell) {
      var p = sc.cellPlace[cell.id];
      var colour = C.cells[cell.content];
      if (cell.content === 'brood') {
        var young = beeById[cell.bee];
        colour = young && young.stage === 'larva' ? C.cells.larva : C.cells.egg;
      }
      hexPath(ctx, p.x, p.y, p.s * HALF - L.cellGap);
      ctx.fillStyle = colour || C.cells.empty;
      ctx.fill();
      ctx.strokeStyle = C.chamberEdge;
      ctx.lineWidth = HALF;
      ctx.stroke();
      ctx.lineWidth = 1;
      if (cell.content === 'brood' && beeById[cell.bee]) {
        circle(ctx, p.x, p.y, p.s * HALF * HALF * HALF, C.castes[beeById[cell.bee].caste], null);
      }
    });
  }

  // ---- bees ----

  function drawBees(ctx, game, sc) {
    var st = game.state;
    var honeyCells = st.cells.filter(function (c) { return c.content === 'honey'; });
    st.bees.forEach(function (bee) {
      if (bee.stage !== 'adult') return;
      var p = beePlace(game, sc, bee, honeyCells);
      var jitter = L.beeRadius * HALF;
      drawBee(ctx, p.x + (spread(bee.id, 6) - HALF) * jitter, p.y + (spread(bee.id, 7) - HALF) * jitter, bee.caste, p.carrying); // not balance: salts
    });
  }

  // ---- flashes for the tick's events ----

  function hiveDoor() {
    return meadowCentre();
  }

  function effectFor(e, game, sc) {
    var st = game.state;
    var b = game.balance;
    var cp = function (id) { return sc.cellPlace[id]; };
    switch (e.type) {
      case 'cellBuilt': return { at: cp(e.cell), colour: C.castes.builder };
      case 'chamberAdded': {
        var box = sc.boxes[e.chamber];
        return box ? { at: { x: box.x + box.w * HALF, y: box.y + box.h * HALF }, colour: C.castes.builder, text: 'New chamber', big: true } : null;
      }
      case 'larvaFed': return { at: cp(e.cell), colour: C.castes.nurse };
      case 'cellCleaned': return { at: cp(e.cell), colour: C.effect };
      case 'nectarDelivered': return { at: hiveDoor(), colour: C.carryNectar };
      case 'pollenDelivered': return { at: hiveDoor(), colour: C.carryPollen };
      case 'honeyMade': {
        var honey = st.cells.filter(function (c) { return c.content === 'honey'; });
        return honey.length ? { at: cp(honey[e.beeId % honey.length].id), colour: C.castes.honeymaker } : null;
      }
      case 'patchFound':
        return { at: patchPlace(st.patches[e.patch], b), colour: C.castes.scout, text: 'New patch found', big: true };
      case 'fight':
        if (e.hornetsKilled + e.defendersLost === 0) return { at: hiveDoor(), colour: C.fight, big: true };
        return { at: hiveDoor(), colour: C.fight, text: 'Defenders fight hornets', big: true, dy: -1 };
      case 'waveArrived':
        return { at: hiveDoor(), colour: C.hornet, text: e.size + ' hornets attack!', big: true, dy: 1 };
      case 'queenDied':
        return { at: hiveDoor(), colour: C.hornet, text: 'The queen is dead', big: true };
      default: return null;
    }
  }

  function addEvents(fx, events, game, now) {
    if (!events || events.length === 0) return;
    var sc = scene(game);
    events.forEach(function (e) {
      var f = effectFor(e, game, sc);
      if (!f || !f.at) return;
      // The same words already showing are shown again, not stacked on top.
      for (var k = 0; f.text && k < fx.length; k += 1) {
        if (fx[k].text === f.text) {
          fx[k].born = now;
          return;
        }
      }
      f.born = now;
      f.ms = f.text ? L.textEffectMs : L.effectMs;
      fx.push(f);
    });
    // Rings are many; text is rare, so drop the oldest rings first.
    while (fx.length > L.maxEffects) {
      var i = 0;
      while (i < fx.length - 1 && fx[i].text) i += 1;
      fx.splice(i, 1);
    }
  }

  function drawEffects(ctx, fx, now) {
    for (var i = fx.length - 1; i >= 0; i -= 1) {
      var f = fx[i];
      var age = (now - f.born) / f.ms;
      if (age >= 1) {
        fx.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - age;
      ctx.lineWidth = f.big ? L.cellGap * (1 + 1) : L.cellGap;
      circle(ctx, f.at.x, f.at.y, L.effectRing * (f.big ? 1 + 1 : 1) * (HALF + age), null, f.colour);
      if (f.text) {
        ctx.font = L.bigFont;
        ctx.fillStyle = C.effectText;
        ctx.textAlign = 'center';
        var rise = L.effectRing * (1 + 1) * age;
        ctx.fillText(f.text, f.at.x, f.at.y - L.effectRing * (1 + 1) + (f.dy || 0) * L.effectRing - rise);
      }
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }
  }

  // ---- labels ----

  function drawLabels(ctx) {
    ctx.font = L.bigFont;
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.fillText('The meadow', L.meadow.x + L.hive.padding, L.meadow.y + L.hive.padding * (1 + 1)); // not balance: a line down from the corner
    ctx.fillText('Inside the hive', L.hive.x, L.hive.y - L.hive.padding * HALF * (1 + HALF));
  }

  // ---- the frame ----

  function setup(canvas) {
    var ratio = root.devicePixelRatio || 1;
    canvas.width = L.canvas.width * ratio;
    canvas.height = L.canvas.height * ratio;
    canvas.style.width = L.canvas.width + 'px'; // the page's CSS shrinks it, keeping its shape, on a narrow window
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return ctx;
  }

  function frame(ctx, game, fx, now) {
    ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    var sc = scene(game);
    drawMeadow(ctx, game);
    drawHive(ctx, game, sc);
    drawBees(ctx, game, sc);
    drawWaves(ctx, game, sc);
    drawEffects(ctx, fx, now);
    drawLabels(ctx);
  }

  // ---- the "What just happened" list ----

  function feedLine(e) {
    switch (e.type) {
      case 'chamberAdded': return 'Builders added a new chamber to the hive.';
      case 'patchFound': return 'A scout found a new flower patch.';
      case 'warningRaised': return 'A scout saw ' + e.warning.size + ' hornets coming.';
      case 'warningAnswered': return e.answer === 'defend' ? 'You answered Defend.' : 'You answered Keep my mix.';
      case 'waveArrived': return e.size + ' hornets are attacking the entrance.';
      case 'waveOver':
        return (e.outcome === 'beaten' ? 'The wave is beaten: ' : 'The hornets have gone: ')
          + e.hornetsKilled + ' killed, ' + e.defendersLost + ' defenders lost, ' + e.beesLost + ' other bees lost.';
      case 'queenDied': return 'The hornets reached the queen.';
      case 'beesMoved': return e.text;
      default: return null;
    }
  }

  BeeGame.draw = { setup: setup, frame: frame, addEvents: addEvents, feedLine: feedLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.draw;
})(typeof globalThis !== 'undefined' ? globalThis : this);

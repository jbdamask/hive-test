/*
 * The browser page: the title screen, the help screen, the game loop, the
 * live score and the end screen. The rules are game/sim/; this file only
 * runs them in real time and shows them. Module pattern: see the header of
 * game/sim/sim.js.
 *
 * Time. The loop runs balance.ticksPerSecond.normal or .fast ticks a second.
 * Space pauses, 1 and 2 set the speed. Pause and speed live here, never in
 * the game, so they never reach the game record. When the game itself is
 * paused (a hornet warning waits for its answer), no tick runs.
 *
 * For a checker: window.beeGame is the running game (beeGame.state.tick,
 * beeGame.score(), beeGame.choices, beeGame.choose(...)), and window.beeUI
 * says the screen, speed and pause.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame;
  var L = BeeGame.layout;
  var B = BeeGame.balance;
  var CASTES = BeeGame.sim.CASTES;
  var WORDS = BeeGame.sim.WORDS;
  var MS_PER_SECOND = 1000; // not balance: milliseconds in a second
  var PARTS = ['livingBees', 'honeyMade', 'combCells', 'chambers', 'total'];
  var STORES = ['honey', 'nectar', 'pollen', 'wax'];
  var TODAY = [
    { key: 'cellBuilt', label: 'Comb cells built' },
    { key: 'chamberAdded', label: 'Chambers added' },
    { key: 'larvaFed', label: 'Larvae fed' },
    { key: 'cellCleaned', label: 'Dirty cells cleaned' },
    { key: 'nectarDelivered', label: 'Nectar carried in' },
    { key: 'pollenDelivered', label: 'Pollen carried in' },
    { key: 'honeyMade', label: 'Honey made' },
    { key: 'patchFound', label: 'Flower patches found' },
    { key: 'hornetsKilled', label: 'Hornets killed' }
  ];
  var CELL_KEY = [
    { key: 'empty', label: 'Empty and clean' },
    { key: 'dirty', label: 'Dirty (needs a nurse)' },
    { key: 'egg', label: 'Egg' },
    { key: 'larva', label: 'Larva' },
    { key: 'honey', label: 'Honey' },
    { key: 'nectar', label: 'Nectar' },
    { key: 'pollen', label: 'Pollen' }
  ];

  var doc = root.document;
  function $(id) { return doc.getElementById(id); }

  var ui = {
    screen: 'title', // 'title' | 'play' | 'end'
    speed: 'normal', // 'normal' | 'fast'
    paused: false, // the player's own pause (Space)
    helpOpen: false,
    game: null,
    titleSeed: null,
    fx: [],
    feed: [],
    today: null,
    todayDay: -1,
    carry: 0,
    last: null
  };
  var ctx = BeeGame.draw.setup($('board'));

  // ---- seeds ----

  // A seed is a whole number, from the player, the page address or a random draw.
  function parseSeed(text) {
    var t = String(text === null || text === undefined ? '' : text).trim();
    if (t === '') return null;
    if (!/^\d+$/.test(t)) return undefined;
    return Number(t);
  }

  function newSeed() {
    return Math.floor(Math.random() * L.seedRange);
  }

  function showSeedInAddress(seed) {
    try {
      var url = new root.URL(root.location.href);
      url.searchParams.set('seed', String(seed));
      root.history.replaceState(null, '', url.href);
    } catch (e) {
      // Some browsers refuse to change a file:// address; the seed is still on screen.
    }
  }

  // ---- screens ----

  function show(id, on) {
    $(id).hidden = !on;
  }

  function setScreen(name) {
    ui.screen = name;
    show('title', name === 'title');
    show('end', name === 'end');
  }

  function openHelp(on) {
    ui.helpOpen = on;
    show('help', on);
    if (on) $('help-close').focus();
  }

  function startGame(seed) {
    var game = BeeGame.sim.createGame(seed, B);
    // A choice's own events (an answered warning, bees moved) reach the page
    // too, whoever makes the choice: a button or the console.
    var choose = game.choose;
    game.choose = function (choice) {
      var before = game.events.length;
      var result = choose(choice);
      var events = game.events.slice(before);
      if (events.length > 0 && ui.game === game) {
        count(events);
        BeeGame.draw.addEvents(ui.fx, events, game, root.performance.now());
      }
      return result;
    };
    ui.game = game;
    root.beeGame = game;
    ui.fx = [];
    ui.feed = [];
    ui.today = null;
    ui.todayDay = -1;
    ui.carry = 0;
    ui.paused = false;
    $('copy-status').textContent = '';
    showSeedInAddress(seed);
    setScreen('play');
    $('board').focus();
    render();
  }

  // ---- the loop ----

  function canStep() {
    var g = ui.game;
    return !!g && ui.screen === 'play' && !ui.paused && !ui.helpOpen &&
      !g.state.paused && !g.state.warning && !g.state.over;
  }

  function resetToday(day) {
    ui.today = {};
    TODAY.forEach(function (t) { ui.today[t.key] = 0; });
    ui.todayDay = day;
  }

  function count(events) {
    var day = ui.game.day();
    if (day !== ui.todayDay) resetToday(day);
    events.forEach(function (e) {
      if (e.type === 'nectarDelivered' || e.type === 'pollenDelivered') ui.today[e.type] += e.amount;
      else if (e.type === 'fight') ui.today.hornetsKilled += e.hornetsKilled;
      else if (ui.today[e.type] !== undefined) ui.today[e.type] += 1;
      var line = BeeGame.draw.feedLine(e);
      if (line) ui.feed.push('Day ' + (day + 1) + ': ' + line);
    });
    if (ui.feed.length > L.feedLines) ui.feed = ui.feed.slice(-L.feedLines);
  }

  function runTicks(ms, now) {
    if (!canStep()) {
      ui.carry = 0;
      return;
    }
    ui.carry += (ms / MS_PER_SECOND) * B.ticksPerSecond[ui.speed];
    var events = [];
    while (ui.carry >= 1 && canStep()) {
      ui.carry -= 1;
      var ev = ui.game.step();
      for (var i = 0; i < ev.length; i += 1) events.push(ev[i]);
    }
    if (events.length > 0) {
      count(events);
      BeeGame.draw.addEvents(ui.fx, events, ui.game, now);
    }
    if (ui.game.state.over) showEnd();
  }

  function loop(now) {
    var ms = ui.last === null ? 0 : Math.min(now - ui.last, L.maxFrameMs);
    ui.last = now;
    if (ui.game) {
      runTicks(ms, now);
      if (ui.game.state.over) showEnd(); // also when the console stepped the game to its end
      BeeGame.draw.frame(ctx, ui.game, ui.fx, now);
    }
    render();
    root.requestAnimationFrame(loop);
  }

  // ---- what the page shows ----

  function rows(tableId, list) {
    var t = $(tableId);
    var html = list.map(function (r) {
      return '<tr><td>' + (r.swatch || '') + r.label + '</td><td class="n">' + r.value + '</td></tr>';
    }).join('');
    if (t.innerHTML !== html) t.innerHTML = html;
  }

  function swatch(colour, hex) {
    return '<span class="swatch' + (hex ? ' hex' : '') + '" style="background:' + colour + '"></span>';
  }

  function capital(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function status(g) {
    if (ui.screen === 'end') return 'Game over';
    if (g.state.warning) return 'Paused: hornet warning';
    if (ui.helpOpen) return 'Paused: reading how to play';
    if (ui.paused) return 'Paused (Space resumes)';
    return '';
  }

  function warningLine(g) {
    var w = g.state.warning;
    if (!w) return '';
    return 'A scout sees about ' + w.size + ' hornets arriving in ' + w.daysUntil + ' days. You have ' +
      w.defenders + ' defenders. The game waits for your answer.';
  }

  function render() {
    var g = ui.game;
    $('hud-speed').textContent = ui.speed === 'fast' ? 'Fast speed' : 'Normal speed';
    if (!g) return;
    var st = g.state;
    var score = g.score();
    PARTS.forEach(function (p) { $('score-' + p).textContent = score[p]; });
    $('hud-seed').textContent = st.seed;
    $('hud-day').textContent = 'Day ' + Math.min(g.day() + 1, B.daysPerSeason) + ' of ' + B.daysPerSeason;
    $('status').textContent = status(g);
    $('warning-line').textContent = warningLine(g);

    var adults = {};
    var young = 0;
    CASTES.forEach(function (c) { adults[c] = 0; });
    st.bees.forEach(function (bee) {
      if (bee.stage === 'adult') adults[bee.caste] += 1;
      else young += 1;
    });
    var casteRows = CASTES.map(function (c) {
      return { swatch: swatch(L.colours.castes[c]), label: capital(WORDS[c].many), value: adults[c] };
    });
    casteRows.push({ label: 'Eggs and larvae', value: young });
    rows('castes', casteRows);
    rows('stores', STORES.map(function (s) {
      return { label: capital(s), value: Math.floor(st.resources[s]) };
    }));
    if (!ui.today || g.day() !== ui.todayDay) resetToday(g.day());
    if (ui.today) {
      $('today-title').textContent = 'Day ' + Math.min(ui.todayDay + 1, B.daysPerSeason) + ' so far';
      rows('today', TODAY.map(function (t) { return { label: t.label, value: ui.today[t.key] }; }));
    }
    var feedHtml = ui.feed.map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('');
    if ($('feed').innerHTML !== feedHtml) $('feed').innerHTML = feedHtml;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- the end screen ----

  function showEnd() {
    if (ui.screen === 'end') return;
    var g = ui.game;
    var over = g.state.over;
    var score = g.score();
    var day = Math.min(Math.floor(over.tick / B.ticksPerDay) + 1, B.daysPerSeason);
    $('end-heading').textContent = over.reason === 'queen' ? 'The queen is dead' : 'The season is over';
    $('end-ending').textContent = over.reason === 'queen'
      ? 'The hornets killed the queen on day ' + day + ' of ' + B.daysPerSeason + '.'
      : 'The season ended after ' + B.daysPerSeason + ' days with the queen alive.';
    PARTS.forEach(function (p) { $('end-' + p).textContent = score[p]; });
    $('end-seed').textContent = g.state.seed;
    $('record-text').value = BeeGame.record.toText(g);
    setScreen('end');
  }

  function copyRecord() {
    var text = $('record-text').value;
    function fallback() {
      var area = $('record-text');
      area.focus();
      area.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      $('copy-status').textContent = ok ? 'Copied.' : 'Select the text below and copy it.';
    }
    if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
      root.navigator.clipboard.writeText(text).then(function () {
        $('copy-status').textContent = 'Copied.';
      }, fallback);
    } else {
      fallback();
    }
  }

  // ---- input ----

  function startFromTitle() {
    var typed = parseSeed($('seed-input').value);
    if (typed === undefined) {
      $('seed-error').textContent = 'A seed is a whole number.';
      return;
    }
    startGame(typed === null ? ui.titleSeed : typed);
  }

  $('start-button').addEventListener('click', startFromTitle);
  $('seed-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') startFromTitle();
  });
  $('seed-input').addEventListener('input', function () {
    var typed = parseSeed($('seed-input').value);
    $('seed-error').textContent = typed === undefined ? 'A seed is a whole number.' : '';
    $('title-seed').textContent = typed === null || typed === undefined ? ui.titleSeed : typed;
  });
  $('title-help-button').addEventListener('click', function () { openHelp(true); });
  $('help-button').addEventListener('click', function () { openHelp(!ui.helpOpen); });
  $('help-close').addEventListener('click', function () { openHelp(false); });
  $('copy-record').addEventListener('click', copyRecord);
  $('play-again').addEventListener('click', function () { startGame(newSeed()); });
  $('replay-seed').addEventListener('click', function () { startGame(ui.game.state.seed); });

  doc.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H' || e.key === '?') {
      openHelp(!ui.helpOpen);
      e.preventDefault();
    } else if (e.key === 'Escape' && ui.helpOpen) {
      openHelp(false);
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (ui.screen === 'play') ui.paused = !ui.paused;
    } else if (e.key === '1') {
      ui.speed = 'normal';
    } else if (e.key === '2') {
      ui.speed = 'fast';
    }
  });

  // ---- the checker's view ----

  root.beeUI = {
    get screen() { return ui.screen; },
    get speed() { return ui.speed; },
    get paused() { return ui.paused; },
    get helpOpen() { return ui.helpOpen; },
    start: startGame
  };

  // ---- the first screen ----

  var cellRows = CELL_KEY.map(function (k) {
    return { swatch: swatch(L.colours.cells[k.key], true), label: k.label, value: '' };
  });
  rows('cell-key', cellRows);

  var fromAddress = parseSeed(new root.URLSearchParams(root.location.search).get('seed'));
  if (typeof fromAddress === 'number') {
    startGame(fromAddress);
  } else {
    ui.titleSeed = newSeed();
    $('title-seed').textContent = ui.titleSeed;
    setScreen('title');
    $('start-button').focus();
  }
  root.requestAnimationFrame(loop);
})(typeof globalThis !== 'undefined' ? globalThis : this);

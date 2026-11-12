/*
 * The player's controls: the colony mix, the next egg, Match the mix now,
 * the hornet warning prompt and the two notices (laying stopped, after a
 * wave). Every control calls window.beeGame.choose(...), so each choice goes
 * into the game record with its tick. The rules are game/sim/; this file
 * only shows them and passes the player's clicks on. Module pattern: see the
 * header of game/sim/sim.js. Load it after ui/main.js, which makes the game.
 *
 * The page asks for nothing the game does not need: the mix buttons set all
 * six shares, plus and minus change one, a caste's Egg button picks the next
 * egg, and Match the mix now names every move in one line before anything
 * happens. The warning prompt is the only thing that answers a warning, and
 * the game stays paused until one of its two buttons is clicked.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame;
  var L = BeeGame.layout;
  var B = BeeGame.balance;
  var CASTES = BeeGame.sim.CASTES;
  var WORDS = BeeGame.sim.WORDS;
  var doc = root.document;

  function $(id) { return doc.getElementById(id); }

  function el(tag, attrs, text) {
    var e = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'className') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function capital(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function setHidden(node, hidden) {
    if (node.hidden !== hidden) node.hidden = hidden;
  }

  // The running game, if the player can make choices in it now.
  function liveGame() {
    var g = root.beeGame;
    if (!g || g.state.over) return null;
    if (root.beeUI && root.beeUI.screen !== 'play') return null;
    return g;
  }

  var ui = {
    matchOpen: false,
    dismissedWave: null, // the after-wave notice the player closed
    warningShown: null, // the warning the prompt last showed, to focus Defend once
    game: null
  };

  function choose(choice) {
    var g = liveGame();
    if (!g) return null;
    var result = g.choose(choice);
    render();
    return result;
  }

  // ---- building the panel, once ----

  var box = $('controls');
  box.appendChild(el('h2', {}, ''));
  var heading = box.lastChild;

  var mixRow = el('div', { className: 'ctl-row', role: 'group', 'aria-label': 'Ready-made mixes' });
  var mixButtons = {};
  Object.keys(B.mixes).forEach(function (name) {
    var b = el('button', { type: 'button', 'data-mix': name, title: 'Set all six shares to the ' + name + ' mix' }, name);
    b.addEventListener('click', function () { choose({ type: 'setMix', mix: name }); });
    mixButtons[name] = b;
    mixRow.appendChild(b);
  });
  box.appendChild(mixRow);

  var table = el('table', { className: 'ctl-mix', 'aria-label': 'Colony mix' });
  var head = el('tr');
  ['Caste', 'Share', '', 'Next egg'].forEach(function (h, i) {
    head.appendChild(el('th', { className: i === 1 ? 'n' : '' }, h));
  });
  table.appendChild(head);
  var cells = {};
  CASTES.forEach(function (c) {
    var tr = el('tr', { 'data-caste': c });
    var name = el('td');
    var sw = el('span', { className: 'swatch' });
    sw.style.background = L.colours.castes[c];
    name.appendChild(sw);
    name.appendChild(doc.createTextNode(capital(WORDS[c].one)));
    var share = el('td', { className: 'n' }, '0');
    var pm = el('td', { className: 'ctl-pm' });
    var minus = el('button', { type: 'button', 'aria-label': 'One share fewer ' + WORDS[c].many, title: 'One share fewer' }, '−');
    var plus = el('button', { type: 'button', 'aria-label': 'One share more ' + WORDS[c].many, title: 'One share more' }, '+');
    minus.addEventListener('click', function () { choose({ type: 'adjustShare', caste: c, delta: -1 }); });
    plus.addEventListener('click', function () { choose({ type: 'adjustShare', caste: c, delta: 1 }); });
    pm.appendChild(minus);
    pm.appendChild(plus);
    var eggTd = el('td');
    var egg = el('button', { type: 'button', className: 'ctl-egg', title: 'The next egg becomes a ' + WORDS[c].one + '; then the mix again' }, 'Egg');
    egg.addEventListener('click', function () {
      var g = liveGame();
      if (!g) return;
      choose({ type: 'nextEgg', caste: g.state.nextEggCaste === c ? null : c });
    });
    eggTd.appendChild(egg);
    [name, share, pm, eggTd].forEach(function (td) { tr.appendChild(td); });
    table.appendChild(tr);
    cells[c] = { share: share, minus: minus, plus: plus, egg: egg };
  });
  box.appendChild(table);

  var eggLine = el('div', { className: 'ctl-line', id: 'next-egg-line' });
  var eggText = el('span');
  var eggCancel = el('button', { type: 'button' }, 'Cancel');
  eggCancel.addEventListener('click', function () { choose({ type: 'nextEgg', caste: null }); });
  eggLine.appendChild(eggText);
  eggLine.appendChild(doc.createTextNode(' '));
  eggLine.appendChild(eggCancel);
  box.appendChild(eggLine);

  var matchButton = el('button', { type: 'button', id: 'match-button', title: 'Move grown bees between castes to fit the mix' }, 'Match the mix now');
  matchButton.addEventListener('click', function () { ui.matchOpen = !ui.matchOpen; render(); });
  var matchRow = el('div', { className: 'ctl-row' });
  matchRow.appendChild(matchButton);
  box.appendChild(matchRow);

  var matchLine = el('div', { className: 'ctl-line ctl-notice', id: 'match-line', hidden: '' });
  var matchText = el('span');
  var matchMove = el('button', { type: 'button', className: 'primary' }, 'Move');
  var matchCancel = el('button', { type: 'button' }, 'Cancel');
  matchMove.addEventListener('click', function () {
    ui.matchOpen = false;
    choose({ type: 'matchMix' });
  });
  matchCancel.addEventListener('click', function () { ui.matchOpen = false; render(); });
  matchLine.appendChild(matchText);
  matchLine.appendChild(doc.createTextNode(' '));
  matchLine.appendChild(matchMove);
  matchLine.appendChild(doc.createTextNode(' '));
  matchLine.appendChild(matchCancel);
  box.appendChild(matchLine);

  var layingLine = el('div', { className: 'ctl-line ctl-notice', id: 'laying-notice', role: 'status', hidden: '' });
  var layingText = el('span');
  var layingFix = el('button', { type: 'button', className: 'primary' }, '');
  layingFix.addEventListener('click', function () { choose({ type: 'fixNotice' }); });
  layingLine.appendChild(layingText);
  layingLine.appendChild(doc.createTextNode(' '));
  layingLine.appendChild(layingFix);
  box.appendChild(layingLine);

  var waveLine = el('div', { className: 'ctl-line ctl-notice', id: 'wave-notice', role: 'status', hidden: '' });
  var waveText = el('span');
  var waveKeep = el('button', { type: 'button', className: 'primary' }, 'Keep Defend');
  var waveClose = el('button', { type: 'button', title: 'Close this notice' }, 'OK');
  waveKeep.addEventListener('click', function () { choose({ type: 'keepDefend' }); });
  waveClose.addEventListener('click', function () {
    var g = liveGame();
    if (g && g.state.waveNotice) ui.dismissedWave = g.state.waveNotice;
    render();
  });
  waveLine.appendChild(waveText);
  waveLine.appendChild(doc.createTextNode(' '));
  waveLine.appendChild(waveKeep);
  waveLine.appendChild(doc.createTextNode(' '));
  waveLine.appendChild(waveClose);
  box.appendChild(waveLine);

  // The warning prompt is its own overlay in game/index.html.
  $('warning-defend').addEventListener('click', function () { choose({ type: 'answerWarning', answer: 'defend' }); });
  $('warning-keep').addEventListener('click', function () { choose({ type: 'answerWarning', answer: 'keep' }); });

  // ---- what the panel shows ----

  function days(n) {
    var shown = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return shown + (n === 1 ? ' day' : ' days');
  }

  function bees(n, caste) {
    return n + ' ' + (n === 1 ? WORDS[caste].one : WORDS[caste].many);
  }

  function renderWarning(g) {
    var w = g && !g.state.over ? g.state.warning : null;
    setHidden($('warning'), !w);
    if (!w) {
      ui.warningShown = null;
      return;
    }
    setText($('warning-size'), 'Hornets in ' + days(w.daysUntil) + ': about ' + w.size + '. You have ' +
      bees(w.defenders, 'defender') + '.');
    setText($('warning-defend-text'), 'lays defenders first and moves ' + (w.defendMoves === 1 ? '1 bee' : w.defendMoves + ' bees') +
      ' to defence now.');
    setText($('warning-defend-moves'), w.defendMoves > 0 ? w.defendText : '');
    if (ui.warningShown !== w) {
      ui.warningShown = w;
      $('warning-defend').focus();
    }
  }

  function render() {
    var g = liveGame();
    if (g !== ui.game) {
      ui.game = g;
      ui.matchOpen = false;
    }
    var live = !!g;
    var st = g ? g.state : null;
    setHidden(box, !root.beeGame);
    renderWarning(g);
    if (!root.beeGame) return;
    var shown = st || root.beeGame.state;

    setText(heading, 'Colony mix: ' + shown.mix.name);
    Object.keys(mixButtons).forEach(function (name) {
      mixButtons[name].disabled = !live;
      mixButtons[name].classList.toggle('on', shown.mix.name === name);
    });
    CASTES.forEach(function (c) {
      var row = cells[c];
      setText(row.share, String(shown.mix.shares[c]));
      row.minus.disabled = !live || shown.mix.shares[c] === 0;
      row.plus.disabled = !live;
      row.egg.disabled = !live;
      row.egg.classList.toggle('on', shown.nextEggCaste === c);
      row.egg.setAttribute('aria-pressed', shown.nextEggCaste === c ? 'true' : 'false');
    });

    var picked = shown.nextEggCaste;
    setText(eggText, picked ? 'Next egg: ' + WORDS[picked].one + ', then the mix again.' : 'Next egg: by the mix.');
    setHidden(eggCancel, !picked || !live);

    matchButton.disabled = !live;
    if (!live) ui.matchOpen = false;
    setHidden(matchLine, !ui.matchOpen);
    if (ui.matchOpen) {
      var plan = g.proposeMatch();
      setText(matchText, plan.text);
      setHidden(matchMove, plan.moves.length === 0);
      setText(matchCancel, plan.moves.length === 0 ? 'Close' : 'Cancel');
    }

    var notice = shown.notice;
    var laying = live && notice && notice.kind === 'layingStopped' ? notice : null;
    setHidden(layingLine, !laying);
    if (laying) {
      setText(layingText, laying.text);
      setText(layingFix, laying.fix.label);
    }

    var wave = live ? shown.waveNotice : null;
    var showWave = !!wave && ui.dismissedWave !== wave;
    setHidden(waveLine, !showWave);
    if (showWave) setText(waveText, wave.text);
  }

  function loop() {
    render();
    root.requestAnimationFrame(loop);
  }

  // For a checker: what the controls show.
  root.beeControls = {
    get matchOpen() { return ui.matchOpen; },
    render: render
  };

  render();
  root.requestAnimationFrame(loop);
})(typeof globalThis !== 'undefined' ? globalThis : this);

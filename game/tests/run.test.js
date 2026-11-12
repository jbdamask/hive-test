// The command-line runner game/sim/run.js and the stored strategies
// (bead hive-test-2hi; spec 1 acceptance checks 4, 14 and 21).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sim = require('../sim/sim.js');
const record = require('../sim/record.js');
const balance = require('../data/balance.js');
const strategies = require('../data/strategies.js');

const RUN = path.join(__dirname, '..', 'sim', 'run.js');
const CASTES = sim.CASTES;

function run(...args) {
  const r = spawnSync(process.execPath, [RUN, ...args], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `run.js ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function tempRecord(text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-run-test-'));
  const file = path.join(dir, 'game.txt');
  fs.writeFileSync(file, text);
  return file;
}

// "builder 3, nurse 2, ... (total n)" -> { builder: 3, ..., total: n }
function parseCastes(text) {
  const out = {};
  for (const c of CASTES) out[c] = Number(new RegExp(`\\b${c} (\\d+)`).exec(text)[1]);
  out.total = Number(/\(total (\d+)\)/.exec(text)[1]);
  return out;
}

function assertScore(out) {
  assert.match(out, /^ending: (season over|queen died) at tick \d+ \(day \d+\)$/m);
  for (const label of ['colony size \\(living bees\\)', 'honey made', 'honeycomb \\(comb cells\\)', 'hive size \\(chambers\\)', 'total']) {
    assert.match(out, new RegExp(`^${label}: \\d+$`, 'm'));
  }
}

test('--list-strategies names every stored strategy, one line each', () => {
  const out = run('--list-strategies');
  const lines = out.trimEnd().split('\n');
  for (const name of ['no-defenders', 'balanced', 'change-nothing', 'lay-nothing']) {
    assert.strictEqual(lines.filter((l) => l.startsWith(name + ': ')).length, 1, name);
  }
  assert.strictEqual(lines.length, strategies.length);
});

test('a seed and a strategy print the ending, the four score parts and the total, the same twice', () => {
  const a = run('--seed', '7', '--strategy', 'balanced');
  const b = run('--seed', '7', '--strategy', 'balanced');
  assertScore(a);
  assert.strictEqual(a, b);
});

test('--record replays a record written by record.js, the same twice, matching record.replay', () => {
  const game = sim.createGame(11, balance);
  while (!game.state.over) {
    const t = game.state.tick;
    if (t === 0) game.choose({ type: 'setMix', mix: 'Gather' });
    if (t === balance.ticksPerDay) game.choose({ type: 'nextEgg', caste: 'scout' });
    if (t === balance.ticksPerDay * 2) game.choose({ type: 'adjustShare', caste: 'defender', delta: 1 });
    if (game.state.warning) game.choose({ type: 'answerWarning', answer: 'defend' });
    if (game.state.waveNotice && game.state.waveNotice.wave === 0) game.choose({ type: 'keepDefend' });
    game.step();
  }
  const file = tempRecord(record.toText(game));
  const a = run('--record', file);
  const b = run('--record', file);
  assertScore(a);
  assert.strictEqual(a, b);
  const s = record.replay(fs.readFileSync(file, 'utf8'), balance).score();
  assert.match(a, new RegExp(`^total: ${s.total}$`, 'm'));
  assert.match(a, new RegExp(`^honey made: ${s.honeyMade}$`, 'm'));

  const log = run('--record', file, '--log');
  assert.strictEqual(log, run('--record', file, '--log'));
  assert.match(log, /^ {2}choice: set the mix to Gather$/m);
  assert.match(log, /^ {2}mix now Gather \(/m);
  assert.match(log, /^ {2}choice: hand-pick the next egg as scout$/m);
  assert.match(log, /^ {2}hand-picked egg laid: scout$/m);
  assert.match(log, /^ {2}answer: Defend$/m);
  assert.match(log, /^ {2}choice: Keep Defend$/m);
});

test('--log prints each day: warnings, answers, wave outcomes, notices and eggs laid of each caste', () => {
  const out = run('--seed', '7', '--strategy', 'change-nothing', '--log');
  assert.strictEqual(out, run('--seed', '7', '--strategy', 'change-nothing', '--log'));
  assertScore(out);
  const days = out.split('\n').filter((l) => /^day \d+$/.test(l)).map((l) => Number(l.split(' ')[1]));
  const lastDay = Number(/\(day (\d+)\)$/m.exec(out)[1]);
  assert.ok(days.length > 0);
  days.forEach((d, i) => assert.strictEqual(d, i, 'days are printed in order with none missing'));
  assert.ok(days[days.length - 1] >= lastDay - 1);
  assert.strictEqual(out.split('\n').filter((l) => l.startsWith('  eggs laid: ')).length, days.length);
  assert.match(out, /^ {2}warning: wave 1, about \d+ hornets, arrives day \d+/m);
  assert.match(out, /^ {2}answer: Keep my mix$/m);
  assert.match(out, /^ {2}wave 1 arrived: /m);
  assert.match(out, /^ {2}laying stopped: The queen has stopped laying/m);

  const balanced = run('--seed', '7', '--strategy', 'balanced', '--log');
  assert.match(balanced, /^ {2}wave 1 over: (beaten|the hornets have gone);/m);
  assert.match(balanced, /^ {2}mix went back to Balanced \(/m);
});

test('change-nothing on seed 7 lays each caste within one egg of Grow\'s share (spec check 4)', () => {
  const out = run('--seed', '7', '--strategy', 'change-nothing', '--log');
  const season = parseCastes(/^eggs laid over the season: (.*)$/m.exec(out)[1]);
  const perDay = out.split('\n').filter((l) => l.startsWith('  eggs laid: ')).map(parseCastes);
  for (const c of [...CASTES, 'total']) {
    assert.strictEqual(perDay.reduce((t, d) => t + d[c], 0), season[c], `the days add up for ${c}`);
  }
  assert.ok(season.total > 0, 'eggs were laid');
  const grow = balance.mixes.Grow;
  const shares = CASTES.reduce((t, c) => t + grow[c], 0);
  for (const c of CASTES) {
    const want = (grow[c] * season.total) / shares;
    assert.ok(Math.abs(season[c] - want) <= 1, `${c}: laid ${season[c]}, Grow's share ${want}`);
  }
});

test('lay-nothing lays no egg after the start, and no-defenders keeps a zero defender share', () => {
  const none = run('--seed', '7', '--strategy', 'lay-nothing', '--log');
  assert.strictEqual(parseCastes(/^eggs laid over the season: (.*)$/m.exec(none)[1]).total, 0);
  const run2 = require('../sim/run.js').runStrategy(7, 'no-defenders');
  assert.strictEqual(run2.game.state.mix.shares.defender, 0);
  assert.strictEqual(run2.game.state.laid.defender, 0);
});

test('bad arguments fail with a message', () => {
  const r = spawnSync(process.execPath, [RUN, '--seed', '7', '--strategy', 'no-such'], { encoding: 'utf8' });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /No stored strategy called no-such/);
  const r2 = spawnSync(process.execPath, [RUN, '--bogus'], { encoding: 'utf8' });
  assert.notStrictEqual(r2.status, 0);
});

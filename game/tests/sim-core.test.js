// The simulation core: seeded rules, the colony mix, the player's choices and
// the game record (bead hive-test-xne). These tests run on the balance with
// no hornet waves, so the core rules are checked on their own; hornets are
// checked in hornets.test.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../sim/sim.js');
const record = require('../sim/record.js');
const fullBalance = require('../data/balance.js');
const balance = { ...fullBalance, hornets: { ...fullBalance.hornets, waves: [] } };

const CASTES = sim.CASTES;

// Plays a game to the end, applying each planned choice at its tick.
function play(seed, plan) {
  const game = sim.createGame(seed, balance);
  const byTick = new Map();
  for (const p of plan) {
    if (!byTick.has(p.tick)) byTick.set(p.tick, []);
    byTick.get(p.tick).push(p.choice);
  }
  while (!game.state.over) {
    for (const c of byTick.get(game.state.tick) || []) game.choose(c);
    game.step();
  }
  return game;
}

const PLAN = [
  { tick: 100, choice: { type: 'setMix', mix: 'Gather' } },
  { tick: 500, choice: { type: 'nextEgg', caste: 'scout' } },
  { tick: 1200, choice: { type: 'adjustShare', caste: 'defender', delta: 1 } },
  { tick: 1200, choice: { type: 'adjustShare', caste: 'forager', delta: -1 } },
  { tick: 2500, choice: { type: 'matchMix' } },
  { tick: 4000, choice: { type: 'matchMix', mix: 'Defend' } },
  { tick: 6000, choice: { type: 'setMix', mix: 'Balanced' } }
];

function stepUntil(game, pred, limit) {
  for (let i = 0; i < limit && !game.state.over; i += 1) {
    const ev = game.step();
    const hit = ev.find(pred);
    if (hit) return hit;
  }
  return null;
}

test('balance defines the four mixes with six shares each, and both speeds', () => {
  for (const name of ['Grow', 'Gather', 'Defend', 'Balanced']) {
    const mix = balance.mixes[name];
    assert.ok(mix, name);
    assert.deepStrictEqual(Object.keys(mix).sort(), CASTES.slice().sort(), name);
    for (const c of CASTES) assert.ok(Number.isInteger(mix[c]) && mix[c] >= 0, `${name} ${c}`);
  }
  assert.ok(balance.ticksPerSecond.normal > 0);
  assert.ok(balance.ticksPerSecond.fast > balance.ticksPerSecond.normal);
  assert.ok(balance.mixes.Grow.defender < balance.mixes.Defend.defender, 'Grow lays few defenders');
});

test('a new game starts on the Grow mix', () => {
  const game = sim.createGame(7, balance);
  assert.strictEqual(game.state.mix.name, 'Grow');
  assert.deepStrictEqual(game.state.mix.shares, balance.mixes.Grow);
});

test('the same seed and the same choices at the same ticks give equal state after a full season', () => {
  const a = play(48213, PLAN);
  const b = play(48213, PLAN);
  assert.ok(a.state.over && a.state.over.reason === 'season');
  assert.strictEqual(a.state.tick, balance.daysPerSeason * balance.ticksPerDay);
  assert.strictEqual(JSON.stringify(a.state), JSON.stringify(b.state));
  assert.deepStrictEqual(a.choices, b.choices);
  const c = play(48214, PLAN);
  assert.notStrictEqual(JSON.stringify(a.state), JSON.stringify(c.state), 'a different seed gives a different game');
});

test('the meadow is laid out from the seed', () => {
  const a = sim.createGame(1, balance).state.patches;
  const b = sim.createGame(1, balance).state.patches;
  const c = sim.createGame(2, balance).state.patches;
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
  assert.strictEqual(a.filter((p) => p.found).length, balance.meadow.knownAtStart);
});

test('with one mix held for a season and no hand-picked eggs, each caste is within one egg of its share', () => {
  for (const name of ['Grow', 'Gather', 'Defend', 'Balanced']) {
    const game = play(2026, [{ tick: 0, choice: { type: 'setMix', mix: name } }]);
    const laid = game.state.laid;
    const n = CASTES.reduce((t, c) => t + laid[c], 0);
    const shares = balance.mixes[name];
    const total = CASTES.reduce((t, c) => t + shares[c], 0);
    assert.ok(n > total * 4, `${name}: enough eggs were laid to mean something (${n})`);
    for (const c of CASTES) {
      const want = (shares[c] * n) / total;
      assert.ok(Math.abs(laid[c] - want) <= 1, `${name} ${c}: laid ${laid[c]}, share ${want.toFixed(2)} of ${n}`);
    }
  }
});

test('a hand-picked egg becomes the chosen caste and the next egg follows the mix again', () => {
  const picked = sim.createGame(31, balance);
  const plain = sim.createGame(31, balance);
  // Lay a few eggs first, the same in both games.
  for (let i = 0; i < balance.queen.layTicks * 3; i += 1) {
    picked.step();
    plain.step();
  }
  picked.choose({ type: 'nextEgg', caste: 'scout' });
  const isEgg = (e) => e.type === 'eggLaid';
  const first = stepUntil(picked, isEgg, balance.ticksPerDay);
  const second = stepUntil(picked, isEgg, balance.ticksPerDay);
  const mixEgg = stepUntil(plain, isEgg, balance.ticksPerDay);
  assert.ok(first && second && mixEgg);
  assert.strictEqual(first.caste, 'scout');
  assert.strictEqual(first.handPicked, true);
  assert.notStrictEqual(mixEgg.caste, 'scout', 'the mix would not have laid a scout here');
  assert.strictEqual(second.caste, mixEgg.caste, 'the egg after it is the one the mix would have laid');
  assert.strictEqual(second.handPicked, false);
  assert.strictEqual(picked.state.nextEggCaste, null);
});

function adultCounts(game) {
  const have = Object.fromEntries(CASTES.map((c) => [c, 0]));
  for (const bee of game.state.bees) if (bee.stage === 'adult') have[bee.caste] += 1;
  return have;
}

function assertFitsMix(game, shares, label) {
  const have = adultCounts(game);
  const n = CASTES.reduce((t, c) => t + have[c], 0);
  const total = CASTES.reduce((t, c) => t + shares[c], 0);
  for (const c of CASTES) {
    const want = (shares[c] * n) / total;
    assert.ok(Math.abs(have[c] - want) <= 1, `${label} ${c}: ${have[c]} adults, share ${want.toFixed(2)} of ${n}`);
  }
}

test('Match the mix now names every move, then the adults fit the mix within one', () => {
  for (const [label, choice, shares] of [
    ['current mix', { type: 'matchMix' }, balance.mixes.Defend],
    ['named mix', { type: 'matchMix', mix: 'Gather' }, balance.mixes.Gather]
  ]) {
    const game = sim.createGame(77, balance);
    for (let i = 0; i < balance.ticksPerDay * 12; i += 1) game.step();
    if (label === 'current mix') game.choose({ type: 'setMix', mix: 'Defend' });
    const before = JSON.stringify(game.state);
    const proposal = game.proposeMatch(choice.mix);
    assert.strictEqual(JSON.stringify(game.state), before, 'proposing changes nothing');
    assert.ok(proposal.moves.length > 0, label);
    assert.strictEqual(proposal.moved, proposal.moves.reduce((t, m) => t + m.count, 0));
    assert.match(proposal.text, /^Move .+\.$/);
    for (const m of proposal.moves) {
      const noun = m.count === 1 ? sim.WORDS[m.from].one : sim.WORDS[m.from].many;
      assert.ok(proposal.text.includes(`${m.count} ${noun}`), `${label}: "${proposal.text}" names ${m.count} ${noun}`);
      assert.ok(proposal.text.includes(`to ${sim.WORDS[m.to].job}`), `${label}: "${proposal.text}" names ${m.to}`);
    }
    const done = game.choose(choice);
    assert.deepStrictEqual(done.moves, proposal.moves);
    assertFitsMix(game, shares, label);
    assert.deepStrictEqual(game.choices.at(-1), { tick: game.state.tick, choice });
  }
});

test('the proposal text reads as one line', () => {
  const game = sim.createGame(5, balance);
  const p = game.proposeMatch('Defend');
  assert.ok(!p.text.includes('\n'));
  assert.match(p.text, /to defence/);
});

test('when laying stops for want of honey, the notice names the cause and its fix adds one honeymaker share', () => {
  const game = sim.createGame(11, balance);
  game.state.resources.honey = 0;
  const shown = stepUntil(game, (e) => e.type === 'noticeShown', balance.queen.layTicks);
  assert.ok(shown);
  assert.strictEqual(game.state.notice.cause, 'honey');
  assert.match(game.state.notice.text, /stopped laying: not enough honey/);
  assert.match(game.state.notice.text, /honeymakers/);
  assert.strictEqual(game.state.notice.fix.caste, 'honeymaker');
  const before = { ...game.state.mix.shares };
  const result = game.choose({ type: 'fixNotice' });
  assert.strictEqual(result.caste, 'honeymaker');
  for (const c of CASTES) {
    assert.strictEqual(game.state.mix.shares[c], before[c] + (c === 'honeymaker' ? 1 : 0), c);
  }
  // Minus undoes it.
  game.choose({ type: 'adjustShare', caste: 'honeymaker', delta: -1 });
  assert.deepStrictEqual(game.state.mix.shares, before);
});

test('when laying stops for want of clean cells, the notice names nurses and its fix adds a nurse share', () => {
  const game = sim.createGame(12, balance);
  for (const cell of game.state.cells) if (cell.content === 'empty') cell.content = 'dirty';
  stepUntil(game, (e) => e.type === 'noticeShown', balance.queen.layTicks);
  assert.strictEqual(game.state.notice.cause, 'cleanCells');
  assert.match(game.state.notice.text, /no clean cells\. More nurses would clean them\./);
  assert.strictEqual(game.state.notice.fix.label, 'Add nurses');
  const nurses = game.state.mix.shares.nurse;
  game.choose({ type: 'fixNotice' });
  assert.strictEqual(game.state.mix.shares.nurse, nurses + 1);
});

test('when every share is 0 the queen lays no eggs', () => {
  const game = sim.createGame(13, balance);
  for (const c of CASTES) {
    while (game.state.mix.shares[c] > 0) game.choose({ type: 'adjustShare', caste: c, delta: -1 });
  }
  const egg = stepUntil(game, (e) => e.type === 'eggLaid', balance.ticksPerDay);
  assert.strictEqual(egg, null);
});

test('each caste is seen at work through its events, and every adult has a task', () => {
  const game = sim.createGame(99, balance);
  const seen = new Set();
  // The whole season: on Grow the queen now competes with the builders for
  // honey, so the first new chamber can come after day 15 (bead hive-test-qlq).
  while (!game.state.over) for (const e of game.step()) seen.add(e.type);
  for (const t of ['eggLaid', 'cellBuilt', 'chamberAdded', 'larvaFed', 'cellCleaned',
    'nectarDelivered', 'pollenDelivered', 'honeyMade', 'patchFound']) {
    assert.ok(seen.has(t), t);
  }
  for (const bee of game.state.bees.filter((b) => b.stage === 'adult')) {
    assert.ok(CASTES.includes(bee.caste));
    assert.ok(typeof bee.task === 'string', `bee ${bee.id} has a task`);
    assert.ok('target' in bee);
  }
});

test('adults die after their lifetime', () => {
  const game = sim.createGame(3, balance);
  const first = game.state.bees[0].id;
  while (game.state.tick < balance.adult.lifeDays * balance.ticksPerDay + 1) game.step();
  assert.ok(!game.state.bees.some((b) => b.id === first));
});

test('a game replayed from its record text has the same score parts, ending and state', () => {
  const original = play(4242, PLAN);
  const text = record.toText(original);
  assert.match(text, /^bee-colony game record\nseed 4242\n/);
  const replayed = record.replay(text, balance);
  assert.deepStrictEqual(replayed.score(), original.score());
  assert.deepStrictEqual(replayed.state.over, original.state.over);
  assert.strictEqual(JSON.stringify(replayed.state), JSON.stringify(original.state));
  assert.strictEqual(record.toText(replayed), text);
});

test('a replay matches the original at every tick, not only at the end', () => {
  const original = sim.createGame(808, balance);
  const plan = new Map(PLAN.map((p) => [p.tick, p.choice]));
  const states = [];
  while (original.state.tick < 3000) {
    if (plan.has(original.state.tick)) original.choose(plan.get(original.state.tick));
    original.step();
    states.push(JSON.stringify(original.state));
  }
  const text = record.toText(original);
  for (const at of [1, 101, 501, 1201, 2501, 3000]) {
    const replayed = record.replay(text, balance, { untilTick: at });
    assert.strictEqual(JSON.stringify(replayed.state), states[at - 1], `tick ${at}`);
  }
});

test('the record rejects text that is not a record', () => {
  assert.throws(() => record.fromText('hello'));
  assert.throws(() => record.fromText('seed 1\n5 {"type":"setMix","mix":"Grow"}\n3 {"type":"setMix","mix":"Grow"}\n'));
});

// Murder hornets: waves, the scout's warning, Defend and Keep my mix, the mix
// going back after a wave, and the queen's death (bead hive-test-lha; spec 1
// acceptance checks 8 to 10 and 13, simulation side).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../sim/sim.js');
const record = require('../sim/record.js');
const balance = require('../data/balance.js');

const CASTES = sim.CASTES;

// Plays to the end. setup(game) runs at tick 0; answer(warning, game) gives
// 'defend' or 'keep'; afterWave(game) runs whenever a wave notice is showing.
function play(seed, { setup, answer, afterWave } = {}) {
  const game = sim.createGame(seed, balance);
  if (setup) setup(game);
  const events = [];
  while (!game.state.over) {
    if (game.state.warning) game.choose({ type: 'answerWarning', answer: answer ? answer(game.state.warning, game) : 'keep' });
    if (afterWave && game.state.waveNotice) afterWave(game);
    events.push(...game.step());
  }
  return { game, events };
}

function stepToWarning(game) {
  while (!game.state.warning && !game.state.over) game.step();
  assert.ok(game.state.warning, 'a warning was raised');
  return game.state.warning;
}

function adultCounts(game) {
  const have = Object.fromEntries(CASTES.map((c) => [c, 0]));
  for (const bee of game.state.bees) if (bee.stage === 'adult') have[bee.caste] += 1;
  return have;
}

function noDefenders(game) {
  while (game.state.mix.shares.defender > 0) game.choose({ type: 'adjustShare', caste: 'defender', delta: -1 });
  game.choose({ type: 'matchMix' });
}

test('balance has at least three waves, each larger than the one before, at set days', () => {
  const waves = balance.hornets.waves;
  assert.ok(waves.length >= 3);
  for (let i = 1; i < waves.length; i += 1) {
    assert.ok(waves[i].size > waves[i - 1].size, `wave ${i} is larger`);
    assert.ok(waves[i].day > waves[i - 1].day, `wave ${i} comes later`);
  }
  assert.ok(waves.at(-1).day < balance.daysPerSeason);
});

test('seed 1: at least three waves arrive in a full season, each larger, with a warning before at least one', () => {
  const { game, events } = play(1, {
    setup: (g) => g.choose({ type: 'setMix', mix: 'Balanced' }),
    answer: () => 'defend'
  });
  assert.strictEqual(game.state.over.ending, 'season over');
  const arrived = events.filter((e) => e.type === 'waveArrived');
  assert.ok(arrived.length >= 3, `${arrived.length} waves arrived`);
  for (let i = 1; i < arrived.length; i += 1) assert.ok(arrived[i].size > arrived[i - 1].size);
  const warned = arrived.filter((a) => events.some((e) => e.type === 'warningRaised' && e.warning.wave === a.wave && e.tick < a.tick));
  assert.ok(warned.length >= 1, 'a warning came before at least one wave');
  for (const a of arrived) {
    const over = events.find((e) => e.type === 'waveOver' && e.wave === a.wave);
    assert.ok(over && over.tick >= a.tick, `wave ${a.wave} ended`);
    assert.ok(events.some((e) => e.type === 'fight' && e.wave === a.wave), `wave ${a.wave} was fought`);
  }
});

// The defenders who meet a wave's first round: adults alive as the arrival
// tick's step starts, plus defenders that emerge in that step (growBrood runs
// before the fight). `game` stands just before that step; it is stepped once.
function defendersMeetingWave(game) {
  const before = adultCounts(game).defender;
  const emerged = game.step().filter((e) => e.type === 'adultEmerged' && e.caste === 'defender').length;
  return before + emerged;
}

// Defender brood the forecast counted on emerging by the arrival tick. Only
// these can make the forecast miss: a larva the nurses feed late emerges late.
function broodForecast(game, at) {
  const br = balance.brood;
  return game.state.bees.filter((bee) => bee.caste === 'defender' && (
    (bee.stage === 'larva' && bee.stageTick + br.larvaTicks <= at) ||
    (bee.stage === 'egg' && bee.stageTick + br.eggTicks + br.larvaTicks <= at))).length;
}

// Red-team finding 1 (bead hive-test-4pb.4): on seed 81234 the wave 2 warning
// said 22 defenders, but 17 died of old age before the wave came and 5 met it.
// The record is the red team's browser game (hive-test-nlw).
const RED_TEAM_81234 = [
  'bee-colony game record',
  'seed 81234',
  '49 {"type":"setMix","mix":"Gather"}',
  '50 {"type":"nextEgg","caste":"scout"}',
  '412 {"type":"fixNotice"}',
  '2600 {"type":"answerWarning","answer":"defend"}',
  '5600 {"type":"answerWarning","answer":"keep"}'
].join('\n');

test('seed 81234: the wave 2 warning shows the defenders that will meet the wave, not those alive now', () => {
  const atWarning = record.replay(RED_TEAM_81234, balance, { untilTick: 5600 });
  const warning = atWarning.state.warning;
  assert.ok(warning && warning.wave === 1, 'the wave 2 warning is up at tick 5600');
  const margin = broodForecast(atWarning, warning.arrivesTick);
  const atArrival = record.replay(RED_TEAM_81234, balance, { untilTick: warning.arrivesTick });
  const met = defendersMeetingWave(atArrival);
  assert.ok(met <= warning.defenders && met >= warning.defenders - margin,
    `warning said ${warning.defenders}, ${met} met the wave, brood margin ${margin}`);
  assert.ok(warning.defendersNow - met > 10, `the old count (${warning.defendersNow}) was far off (${met})`); // not balance: the size of the red team's miss
});

test('the warning forecast matches the defenders meeting each warned wave, on Keep, seeds 1 to 3', () => {
  for (let seed = 1; seed <= 3; seed += 1) { // not balance: a handful of seeds
    for (const mix of ['Balanced', 'Gather']) {
      const game = sim.createGame(seed, balance);
      game.choose({ type: 'setMix', mix });
      const forecast = new Map();
      while (!game.state.over) {
        const w = game.state.warning;
        if (w) {
          forecast.set(w.arrivesTick, { said: w.defenders, margin: broodForecast(game, w.arrivesTick) });
          game.choose({ type: 'answerWarning', answer: 'keep' });
        }
        const f = forecast.get(game.state.tick);
        if (f) {
          const met = defendersMeetingWave(game);
          assert.ok(met <= f.said && met >= f.said - f.margin,
            `seed ${seed} ${mix}: warning said ${f.said}, ${met} met the wave, brood margin ${f.margin}`);
        } else {
          game.step();
        }
      }
      assert.ok(forecast.size > 0, `seed ${seed} ${mix}: a warning came`);
    }
  }
});

test('an unanswered warning pauses the game and carries size, arrival, defenders and the Defend move count', () => {
  const game = sim.createGame(1, balance);
  const warning = stepToWarning(game);
  const wave = balance.hornets.waves[warning.wave];
  const tick = game.state.tick;
  assert.strictEqual(warning.tick, tick);
  assert.strictEqual(warning.size, wave.size);
  assert.strictEqual(warning.arrivesTick, wave.day * balance.ticksPerDay);
  assert.strictEqual(warning.ticksUntil, warning.arrivesTick - tick);
  assert.strictEqual(warning.daysUntil, warning.ticksUntil / balance.ticksPerDay);
  assert.ok(warning.ticksUntil > 0 && warning.daysUntil <= balance.hornets.warnDays);
  assert.strictEqual(warning.defendersNow, adultCounts(game).defender);
  assert.ok(Number.isInteger(warning.defenders) && warning.defenders >= 0);
  const proposal = game.proposeMatch('Defend');
  assert.strictEqual(warning.defendMoves, proposal.moved);
  assert.ok(warning.defendMoves > 0);
  assert.strictEqual(warning.defendText, proposal.text);
  assert.strictEqual(game.paused, true);
  const before = JSON.stringify(game.state);
  for (let i = 0; i < 50; i += 1) assert.deepStrictEqual(game.step(), []); // not balance: any number of steps
  assert.strictEqual(JSON.stringify(game.state), before, 'nothing moved while paused');
  game.paused = false; // a resume key does not get past the warning
  game.step();
  assert.strictEqual(game.state.tick, tick);
  game.choose({ type: 'answerWarning', answer: 'keep' });
  assert.strictEqual(game.state.warning, null);
  assert.strictEqual(game.paused, false);
  assert.deepStrictEqual(game.state.mix.shares, balance.mixes.Grow, 'Keep my mix changes nothing');
  game.step();
  assert.strictEqual(game.state.tick, tick + 1);
});

test('Defend sets the Defend mix and matches the adults to it in the same tick', () => {
  const game = sim.createGame(1, balance);
  const warning = stepToWarning(game);
  const result = game.choose({ type: 'answerWarning', answer: 'defend' });
  assert.strictEqual(game.state.tick, warning.tick);
  assert.deepStrictEqual(game.choices.at(-1), { tick: warning.tick, choice: { type: 'answerWarning', answer: 'defend' } });
  assert.strictEqual(game.state.mix.name, 'Defend');
  assert.deepStrictEqual(game.state.mix.shares, balance.mixes.Defend);
  assert.strictEqual(result.match.moved, warning.defendMoves);
  const have = adultCounts(game);
  const n = CASTES.reduce((t, c) => t + have[c], 0);
  const total = CASTES.reduce((t, c) => t + balance.mixes.Defend[c], 0);
  for (const c of CASTES) {
    const want = (balance.mixes.Defend[c] * n) / total;
    assert.ok(Math.abs(have[c] - want) <= 1, `${c}: ${have[c]} adults, share ${want.toFixed(2)}`);
  }
});

test('after a Defend wave the mix goes back at the tick the last hornet is gone, and Keep Defend puts Defend back', () => {
  const game = sim.createGame(1, balance);
  game.choose({ type: 'setMix', mix: 'Gather' });
  const warning = stepToWarning(game);
  game.choose({ type: 'answerWarning', answer: 'defend' });
  let restored = null;
  let overEvent = null;
  while (!restored && !game.state.over) {
    const tickBefore = game.state.tick;
    const ev = game.step();
    const wave = game.state.waves[warning.wave];
    overEvent = ev.find((e) => e.type === 'waveOver');
    restored = ev.find((e) => e.type === 'mixRestored');
    if (!restored) {
      assert.strictEqual(game.state.mix.name, 'Defend', `still Defend at tick ${tickBefore}`);
      assert.strictEqual(wave.over, false);
    } else {
      assert.ok(overEvent && overEvent.tick === restored.tick, 'the mix goes back in the tick the wave ends');
      assert.strictEqual(wave.atEntrance, 0);
      assert.strictEqual(wave.inside.length, 0);
      assert.ok(!ev.some((e) => e.type === 'beesMoved'), 'bees are not moved back');
    }
  }
  assert.ok(restored, 'the mix went back');
  assert.strictEqual(game.state.mix.name, 'Gather');
  assert.deepStrictEqual(game.state.mix.shares, balance.mixes.Gather);
  const notice = game.state.waveNotice;
  assert.strictEqual(notice.offer, 'Keep Defend');
  assert.strictEqual(notice.restoredMix, 'Gather');
  assert.strictEqual(notice.defendersLost, overEvent.defendersLost);
  const lost = notice.defendersLost === 1 ? '1 defender lost' : `${notice.defendersLost} defenders lost`;
  assert.ok(notice.text.includes(lost), notice.text);
  assert.match(notice.text, /^(Wave beaten|The hornets have gone)\. .* Your mix is back to Gather\.$/);
  game.choose({ type: 'keepDefend' });
  assert.strictEqual(game.state.mix.name, 'Defend');
  assert.deepStrictEqual(game.state.mix.shares, balance.mixes.Defend);
  assert.strictEqual(game.state.waveNotice, null);
  assert.throws(() => game.choose({ type: 'keepDefend' }));
});

test('Keep my mix leaves the mix alone after the wave', () => {
  const { events } = play(1, { setup: (g) => g.choose({ type: 'setMix', mix: 'Balanced' }), answer: () => 'keep' });
  assert.ok(events.some((e) => e.type === 'waveOver'));
  assert.ok(!events.some((e) => e.type === 'mixRestored'));
});

test('a game with no defenders ends with the queen dead', () => {
  const { game, events } = play(1, { setup: noDefenders });
  assert.strictEqual(adultCounts(sim.createGame(1, balance)).defender > 0, true);
  assert.strictEqual(game.state.over.ending, 'queen died');
  assert.strictEqual(game.state.over.reason, 'queen');
  assert.ok(game.state.over.tick < balance.daysPerSeason * balance.ticksPerDay);
  assert.ok(events.some((e) => e.type === 'queenDied'));
  assert.ok(events.some((e) => e.type === 'beesLost'), 'hornets inside killed bees, ate brood or took honey');
  assert.strictEqual(events.at(-1).type, 'gameOver');
});

test('a colony with no scouts gets no warning', () => {
  const { events } = play(2, {
    setup: (g) => {
      while (g.state.mix.shares.scout > 0) g.choose({ type: 'adjustShare', caste: 'scout', delta: -1 });
      g.choose({ type: 'matchMix' });
    }
  });
  assert.ok(events.some((e) => e.type === 'waveArrived'));
  assert.ok(!events.some((e) => e.type === 'warningRaised'));
});

test('a game with warning answers, replayed from its record text, has the same ending and score parts', () => {
  let n = 0;
  const { game, events } = play(7, {
    setup: (g) => g.choose({ type: 'setMix', mix: 'Balanced' }),
    answer: () => (n++ % 2 === 0 ? 'defend' : 'keep'), // not balance: alternate the two answers
    afterWave: (g) => g.choose({ type: 'keepDefend' })
  });
  const text = record.toText(game);
  assert.match(text, /"answerWarning","answer":"defend"/);
  assert.match(text, /"answerWarning","answer":"keep"/);
  assert.match(text, /"keepDefend"/);
  const answers = game.choices.filter((x) => x.choice.type === 'answerWarning').map((x) => x.tick);
  const raised = events.filter((e) => e.type === 'warningRaised').map((e) => e.tick);
  assert.deepStrictEqual(answers, raised, 'each answer carries the tick of its warning');
  const replayed = record.replay(text, balance);
  assert.deepStrictEqual(replayed.state.over, game.state.over);
  assert.deepStrictEqual(replayed.score(), game.score());
  assert.strictEqual(JSON.stringify(replayed.state), JSON.stringify(game.state));
});

// The tuned balance meets the spec's marks on the 20 held-out seeds in
// heldout-seeds-v2.json (beads hive-test-eyv, hive-test-4pb.2; spec 1
// acceptance checks 8, 18 and 19). The seeds were drawn at random after the
// last change to game/data/balance.js (check 17). Never change the seeds, the
// marks or game/data/balance.js to make this pass; a retune needs a fresh seed
// file drawn after it, under a new file name, because check 17 reads the
// commit that first added the file.
// Every result is read from `node game/sim/run.js --seed <n> --strategy <name>`.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RUN = path.join(__dirname, '..', 'sim', 'run.js');
const SEEDS = require('./heldout-seeds-v2.json');
const AT_LEAST = 15; // the spec's "in at least 15 of the 20"

function run(...args) {
  const r = spawnSync(process.execPath, [RUN, ...args], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, `run.js ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

function play(seed, strategy, withLog) {
  const out = run('--seed', String(seed), '--strategy', strategy, ...(withLog ? ['--log'] : []));
  return {
    out,
    ending: /^ending: (season over|queen died) /m.exec(out)[1],
    total: Number(/^total: (\d+)$/m.exec(out)[1])
  };
}

function results(strategy, withLog) {
  return SEEDS.map((seed) => ({ seed, ...play(seed, strategy, withLog) }));
}

function count(list, ending) {
  return list.filter((r) => r.ending === ending).length;
}

test('the held-out seed file holds 20 distinct seeds, none of them the tuning seeds 1 to 20', () => {
  assert.strictEqual(SEEDS.length, 20);
  assert.strictEqual(new Set(SEEDS).size, 20);
  for (const s of SEEDS) {
    assert.ok(Number.isInteger(s) && s >= 0, `seed ${s} is not a whole number`);
    assert.ok(s < 1 || s > 20, `seed ${s} is a tuning seed`);
  }
});

const balanced = results('balanced', true);

test('no-defenders loses the queen before the season ends on at least 15 of the held-out seeds', () => {
  const n = count(results('no-defenders'), 'queen died');
  assert.ok(n >= AT_LEAST, `no-defenders lost the queen on ${n} of 20`);
});

test('balanced survives the season on at least 15 of the held-out seeds', () => {
  const n = count(balanced, 'season over');
  assert.ok(n >= AT_LEAST, `balanced survived on ${n} of 20`);
});

test('change-nothing loses the queen on at least 15 of the held-out seeds', () => {
  const n = count(results('change-nothing'), 'queen died');
  assert.ok(n >= AT_LEAST, `change-nothing lost the queen on ${n} of 20`);
});

test('balanced scores higher than lay-nothing on every one of the held-out seeds', () => {
  const layNothing = results('lay-nothing');
  SEEDS.forEach((seed, i) => {
    assert.ok(balanced[i].total > layNothing[i].total,
      `seed ${seed}: balanced ${balanced[i].total}, lay-nothing ${layNothing[i].total}`);
  });
});

test('a full season on a held-out seed has at least three waves, each larger than the last, with a warning before at least one', () => {
  const full = balanced.filter((r) => r.ending === 'season over');
  assert.ok(full.length > 0, 'no balanced game lasted the season');
  for (const r of full) {
    const sizes = [...r.out.matchAll(/^ {2}wave \d+ arrived: (\d+) hornets, (warned|no warning)/gm)];
    assert.ok(sizes.length >= 3, `seed ${r.seed}: ${sizes.length} waves arrived`);
    for (let i = 1; i < sizes.length; i += 1) {
      assert.ok(Number(sizes[i][1]) > Number(sizes[i - 1][1]), `seed ${r.seed}: wave ${i + 1} is not larger than wave ${i}`);
    }
    assert.ok(/^ {2}warning: wave \d+/m.test(r.out), `seed ${r.seed}: no warning in the log`);
    assert.ok(sizes.some((m) => m[2] === 'warned'), `seed ${r.seed}: no wave arrived warned`);
  }
});

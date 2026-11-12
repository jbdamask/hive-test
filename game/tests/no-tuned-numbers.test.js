// Spec "Checks every feature passes" 1: no tuned number in the rules or the
// drawing. Every number literal other than 0 or 1 in a file under game/sim/ or
// game/ui/ must have a comment on its line containing "not balance" and saying
// why. Numbers in game/data/ are allowed. Set NO_TUNED_NUMBERS_ROOT to scan
// another tree (it must hold game/sim/ or game/ui/).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.env.NO_TUNED_NUMBERS_ROOT || path.resolve(__dirname, '..', '..');
const DIRS = [path.join('game', 'sim'), path.join('game', 'ui')];
const NUMBER = /(^|[^\w$.])(0[xX][0-9a-fA-F]+|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/g;

function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(p));
    else if (/\.(js|html)$/.test(entry.name)) out.push(p);
  }
  return out.sort();
}

function stripStrings(line) {
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// Returns "file:line: text" for each line with an unexplained number.
function findTunedNumbers(root) {
  const found = [];
  for (const dir of DIRS) {
    for (const file of filesUnder(path.join(root, dir))) {
      let inBlock = false;
      fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
        let line = raw;
        if (inBlock) {
          const end = line.indexOf('*/');
          if (end < 0) return;
          line = line.slice(end + 2);
          inBlock = false;
        }
        line = stripStrings(line);
        line = line.replace(/\/\*.*?\*\//g, ' ');
        const open = line.indexOf('/*');
        if (open >= 0) {
          inBlock = true;
          line = line.slice(0, open);
        }
        const slash = line.indexOf('//');
        const comment = slash >= 0 ? line.slice(slash) : '';
        const code = slash >= 0 ? line.slice(0, slash) : line;
        if (/not balance/i.test(comment)) return;
        for (const m of code.matchAll(NUMBER)) {
          const value = Number(m[2]);
          if (value !== 0 && value !== 1) {
            found.push(`${path.relative(root, file)}:${i + 1}: ${raw.trim()}`);
            break;
          }
        }
      });
    }
  }
  return found;
}

test('no number other than 0 or 1 in game/sim/ or game/ui/ without a "not balance" comment', () => {
  assert.deepStrictEqual(findTunedNumbers(ROOT), []);
});

test('the check catches a tuned number and accepts an explained one', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'no-tuned-numbers-'));
  try {
    fs.mkdirSync(path.join(tmp, 'game', 'sim'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'game', 'sim', 'tmp.js'),
      "x = 7;\ny = 7; // not balance: a test\nz = 'day 7';\nw = 0 + 1;\n");
    assert.deepStrictEqual(findTunedNumbers(tmp), [path.join('game', 'sim', 'tmp.js') + ':1: x = 7;']);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

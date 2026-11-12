// Loads every *.test.js file beside this one. On node 24, `node --test game/tests/`
// treats the directory as a module and runs this file, so this is what makes
// that command run the game's tests. Add a *.test.js file; never edit this one.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

for (const name of fs.readdirSync(__dirname).filter((n) => n.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, name));
}

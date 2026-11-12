/*
 * Every layout and drawing number the browser page uses: sizes, places,
 * colours, how long a flash lasts. None of these change what happens in the
 * game; they change only what the player sees. Balance numbers live in
 * game/data/balance.js. Module pattern: see the header of game/sim/sim.js.
 */
(function (root) {
  'use strict';
  var BeeGame = root.BeeGame = root.BeeGame || {};

  BeeGame.layout = {
    // The canvas, in CSS pixels. The meadow is on the left, the hive on the right.
    canvas: { width: 1200, height: 620 },
    meadow: { x: 0, y: 0, width: 600, height: 620, margin: 40 },
    hive: { x: 610, y: 30, width: 580, height: 560, gap: 12, padding: 8 },

    // A chamber holds its cells in this many columns.
    cellColumns: 10,
    cellGap: 1.5,

    // Bees, hornets and flower patches, in pixels.
    beeRadius: 4,
    hornetRadius: 6,
    hiveRadius: 26, // the hive drawn in the meadow
    entranceRing: 38, // where defenders stand guard, around the hive in the meadow
    hornetRing: 54, // where hornets at the entrance gather
    scoutRingMin: 60,
    scoutRingMax: 240,
    scoutTurnsPerTrip: 1.5,
    patchMinRadius: 7,
    patchMaxRadius: 20,
    approachFar: 280, // a coming wave is drawn this far out when warned
    restSpread: 0.9, // idle bees spread over this part of the hive panel

    // Flashes for the tick's events.
    effectMs: 900,
    textEffectMs: 2200,
    effectRing: 14,
    maxEffects: 300,
    feedLines: 6, // lines in the "What just happened" list

    // The loop.
    maxFrameMs: 250, // a longer gap (a hidden tab) counts as this long
    seedRange: 100000, // a new seed is a whole number below this

    font: '12px system-ui, sans-serif',
    bigFont: 'bold 13px system-ui, sans-serif',

    colours: {
      meadow: '#cfe8b0',
      meadowEdge: '#a9cf86',
      hivePanel: '#f6e7c1',
      hiveEdge: '#c79a3a',
      hiveBody: '#e0a72e',
      chamber: '#f2d999',
      chamberEdge: '#b98a2c',
      chamberPlanned: '#b98a2c',
      slot: 'rgba(185, 138, 44, 0.25)',
      text: '#3a2c10',
      cells: {
        empty: '#fff6dc',
        dirty: '#8a7a5a',
        honey: '#f2a900',
        nectar: '#bfe3f5',
        pollen: '#f5d33b',
        egg: '#ffffff',
        larva: '#f4c7b8'
      },
      castes: {
        builder: '#8d5a2b',
        nurse: '#e46aa6',
        forager: '#2b8bd6',
        honeymaker: '#f08c00',
        scout: '#20a36b',
        defender: '#6b2fb5'
      },
      patchKnown: '#d94f8a',
      patchUnknown: 'rgba(120, 120, 120, 0.35)',
      patchEmpty: '#9c7b8a',
      carryNectar: '#7fc4ec',
      carryPollen: '#f5d33b',
      hornet: '#c0281e',
      hornetStripe: '#1e1a12',
      fight: '#ff3b2f',
      effect: '#ffffff',
      effectText: '#3a2c10'
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BeeGame.layout;
})(typeof globalThis !== 'undefined' ? globalThis : this);

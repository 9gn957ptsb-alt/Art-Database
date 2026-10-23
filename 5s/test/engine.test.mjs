// Tests for src/engine.js (node --test). The deck is the synthetic fixture: warm cards (odd ids
// x001, x003 …) carry biomorphic/organic genes and warm colours; cool cards (x002, x004 …) carry
// geometric/hard-edge/minimalism genes and cool colours; x010 is geometric with neutral colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ENGINE = join(here, '..', 'src', 'engine.js');
let FiveS = require(ENGINE);
if (!FiveS || typeof FiveS.judge !== 'function') FiveS = globalThis.FiveS; // if a package.json ever makes .js ESM
const F = FiveS;
const loadDeck = () => JSON.parse(readFileSync(join(here, 'fixture', 'deck.json'), 'utf8'));
const deck = loadDeck();

// Local-time timestamps, so dayOf() is the same date in every time zone.
const at = (y, m, d, hh = 12, mm = 0, ss = 0) => new Date(y, m - 1, d, hh, mm, ss).getTime();
const NOW = at(2026, 10, 21, 12);
const TODAY = '2026-10-21';
const DAY_MS = 86400000;
const S = (ms) => Math.floor(ms / 1000);

const byId = new Map(deck.cards.map((c) => [c.id, c]));
const kindOf = (id) => byId.get(id).kind;
const LETTER = { image: 'i', object: 'o', space: 's', surface: 'u', colour: 'c' };
const id = (kind, n) => LETTER[kind] + String(n).padStart(3, '0');
const PUSH = Math.log(0.7 / 0.3); // the features must move the log-odds at least this far for a turn

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) deepFreeze(o[k]);
  }
  return o;
}

// Judge a list of [cardId, keep] one after another, a few seconds apart.
function judgeAll(state, list, start = NOW - 3600000, d = deck) {
  let st = state, t = start;
  const turns = [];
  for (const [cid, keep] of list) {
    t += 4000;
    const r = F.judge(st, d, cid, keep, 1500, t);
    st = r.state;
    turns.push(r.turn);
  }
  return { state: st, turns, t };
}

// 20 judgments: keep warm x001/x003, pass cool x002/x004, interleaved across the five kinds.
function warmCoolTwenty() {
  const list = [];
  for (const [nw, nc] of [[1, 2], [3, 4]]) {
    for (const k of F.KINDS) { list.push([id(k, nw), 1]); list.push([id(k, nc), 0]); }
  }
  return list;
}

// Finish a five by judging every card (keeping warm cards and brought things).
function finishFive(st, t) {
  let s = st;
  let cid;
  while ((cid = F.currentCard(s)) !== null) {
    t += 3000;
    const keep = cid.charAt(0) === 'y' ? 1 : (byId.get(cid).genes.includes('biomorphic') ? 1 : 0);
    s = F.judge(s, deck, cid, keep, 1200, t).state;
  }
  return s;
}

// --------------------------------------------------------------- API

test('API: every function and constant in SPEC.md is there', () => {
  const fns = ['hexToHsl', 'colourName', 'chord', 'features', 'featureLabel', 'featureGroup', 'newState', 'judge', 'undo',
    'model', 'predict', 'nextFive', 'profile', 'philosophy', 'setCandidates', 'seedCode', 'prng', 'exportSeed',
    'exampleState', 'dayOf', 'startFive', 'currentCard', 'fiveDone', 'streak', 'pinSet', 'unpinSet', 'card', 'bring',
    'removeOwn', 'addNote', 'removeNote', 'markSeen', 'path', 'isRevisit'];
  for (const f of fns) assert.equal(typeof F[f], 'function', f);
  assert.deepEqual(F.KINDS, ['image', 'object', 'space', 'surface', 'colour']);
  assert.deepEqual(F.ERAS, ['Before 1800', '1800s', '1900–45', '1945–69', '1970–99', '2000s', '2010s–now']);
  assert.ok(Object.isFrozen(F));
});

test('engine source: no clock, no Math.random, no DOM, no network', () => {
  const src = readFileSync(ENGINE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const bad of [/Math\.random\s*\(/, /Date\.now\s*\(/, /new Date\(\s*\)/, /performance\.now/, /\bdocument\./, /\bwindow\./,
    /\bfetch\s*\(/, /XMLHttpRequest/, /localStorage/]) {
    assert.ok(!bad.test(src), 'found ' + bad);
  }
});

test('newState matches the State shape', () => {
  const s = F.newState();
  assert.deepEqual(s, { v: 1, j: [], five: null, sets: [], days: [], own: [], notes: [], seen: { path: [] }, opts: { ring: true },
    assoc: [], saga: { stars: [], best: [], boost: { pass: 1, turn: 1, more: 1 }, plays: 0, day: null, time: [], built: [] }, paintings: [] });
  assert.notEqual(F.newState(), F.newState());
});

// --------------------------------------------------------------- purity

test('no function mutates its inputs (deep-frozen state and deck)', () => {
  const d = deepFreeze(loadDeck());
  const ex = deepFreeze(F.exampleState(d, NOW));
  const fresh = deepFreeze(F.newState());
  const started = deepFreeze(F.startFive(fresh, d, NOW));
  const cur = F.currentCard(started);
  const own = ex.own[0];
  const calls = [
    () => F.judge(started, d, cur, 1, 1200, NOW + 5000),
    () => F.judge(ex, d, 'i002', 1, 1200, NOW),
    () => F.judge(ex, d, own.id, 0, 1200, NOW),
    () => F.undo(ex), () => F.undo(started), () => F.undo(F.judge(started, d, cur, 1, 1200, NOW).state),
    () => F.model(ex, d), () => F.predict(F.model(ex, d), d.cards[0]),
    () => F.nextFive(ex, d, NOW), () => F.startFive(ex, d, NOW), () => F.currentCard(ex), () => F.fiveDone(ex),
    () => F.profile(ex, d, NOW), () => F.philosophy(deepFreeze(F.profile(ex, d, NOW)), d),
    () => F.setCandidates(ex, d, 'wall', 0), () => F.setCandidates(ex, d, 'object', 1),
    () => F.seedCode(ex), () => F.exportSeed(ex, d, NOW), () => F.streak(ex, NOW),
    () => F.pinSet(ex, deepFreeze({ wall: 'c001', name: 'x' }), NOW), () => F.unpinSet(ex, 0),
    () => F.card(ex, d, own.id), () => F.card(ex, d, 'o001'),
    () => F.bring(ex, deepFreeze({ id: 'ynew', kind: 'object', name: 'Cup', source: 'Pinterest', colours: ['#aa5533'] }), NOW),
    () => F.bring(ex, deepFreeze({ id: own.id, name: 'Renamed' }), NOW),
    () => F.removeOwn(ex, own.id), () => F.addNote(ex, deepFreeze({ q: 'free', text: 'hello', ref: null }), NOW),
    () => F.removeNote(ex, 0), () => F.markSeen(ex, 'seed'), () => F.markSeen(ex, 'path:seed'),
    () => F.path(ex, d, NOW), () => F.isRevisit(ex, own.id), () => F.features(d.cards[3]),
    () => F.exampleState(d, NOW),
  ];
  for (const c of calls) c(); // strict-mode writes to frozen objects throw
  const r = F.judge(started, d, cur, 1, 1200, NOW + 5000);
  assert.notEqual(r.state, started);
  assert.equal(started.j.length, 0);
  assert.equal(started.five.i, 0);
});

// --------------------------------------------------------------- determinism

test('determinism: nextFive, seedCode, prng and exampleState', () => {
  const st = judgeAll(F.newState(), warmCoolTwenty()).state;
  assert.deepEqual(F.nextFive(st, deck, NOW), F.nextFive(st, deck, NOW));
  assert.deepEqual(F.nextFive(st, deck, at(2026, 10, 21, 8)), F.nextFive(st, deck, at(2026, 10, 21, 22)), 'same day, same five');
  assert.equal(F.seedCode(st), F.seedCode(JSON.parse(JSON.stringify(st))));
  assert.match(F.seedCode(st), /^5S-[0-9A-F]{4}-[0-9A-F]{4}$/);
  assert.notEqual(F.seedCode(st), F.seedCode(F.newState()));
  // the code depends on the judgments, not on when or how fast they were made
  const slow = judgeAll(F.newState(), warmCoolTwenty(), NOW - 9 * DAY_MS).state;
  assert.equal(F.seedCode(slow), F.seedCode(st));
  const a = F.prng('5S-1234-ABCD'), b = F.prng('5S-1234-ABCD'), c = F.prng('5S-1234-ABCE');
  const xs = Array.from({ length: 20 }, () => a());
  assert.deepEqual(Array.from({ length: 20 }, () => b()), xs);
  assert.notDeepEqual(Array.from({ length: 20 }, () => c()), xs);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.deepEqual(F.exampleState(deck, at(2026, 10, 21, 9)), F.exampleState(deck, at(2026, 10, 21, 21)));
  assert.notDeepEqual(F.exampleState(deck, at(2026, 10, 21)), F.exampleState(deck, at(2026, 10, 22)));
});

test('dayOf gives the local date', () => {
  assert.equal(F.dayOf(NOW), TODAY);
  assert.equal(F.dayOf(at(2026, 1, 5, 0, 0, 1)), '2026-01-05');
  assert.equal(F.dayOf(at(2026, 12, 31, 23, 59, 59)), '2026-12-31');
});

// --------------------------------------------------------------- the five

test('nextFive: one card per kind, before and after the model kicks in, and with a brought thing', () => {
  const check = (ids) => {
    assert.equal(ids.length, 5);
    assert.equal(new Set(ids).size, 5);
    assert.deepEqual(ids.map((x) => (x.charAt(0) === 'y' ? 'object' : kindOf(x))).sort(), [...F.KINDS].sort());
  };
  check(F.nextFive(F.newState(), deck, NOW));
  const st = judgeAll(F.newState(), warmCoolTwenty()).state;
  const ids = F.nextFive(st, deck, NOW);
  check(ids);
  for (const x of ids) assert.ok(!st.j.some((e) => e[0] === x), 'unseen cards first');
  // after many fives every kind still gets one (falls back to the least recently seen)
  let s = F.newState(), t = NOW - 30 * DAY_MS;
  for (let k = 0; k < 14; k++) { s = F.startFive(s, deck, t); s = finishFive(s, t); t += DAY_MS / 2; check(s.five.ids); }
  const withOwn = F.bring(st, { id: 'ycup', kind: 'object', name: 'Cup', source: 'Your photos', colours: ['#aa6633'] }, NOW - 7200000);
  const five = F.nextFive(withOwn, deck, NOW);
  check(five);
  assert.ok(five.includes('ycup'));
  // the early fives spread across chords, eras and places
  const first = F.nextFive(F.newState(), deck, NOW).map((x) => byId.get(x));
  assert.ok(new Set(first.map((c) => c.era)).size >= 4);
  assert.ok(new Set(first.map((c) => c.place)).size >= 3);
});

test('the five progresses; finishing it adds today to days once', () => {
  let st = F.startFive(F.newState(), deck, NOW);
  assert.equal(st.five.day, TODAY);
  assert.equal(st.five.n, 1);
  assert.equal(st.five.i, 0);
  assert.deepEqual(st.five.ids, F.nextFive(F.newState(), deck, NOW));
  assert.equal(F.fiveDone(st), false);
  for (let k = 0; k < 5; k++) {
    const cur = F.currentCard(st);
    assert.equal(cur, st.five.ids[k]);
    st = F.judge(st, deck, cur, k % 2, 1000 + k, NOW + k * 5000).state;
    assert.equal(st.five.i, k + 1);
    assert.deepEqual(st.days, k < 4 ? [] : [TODAY]);
  }
  assert.equal(F.fiveDone(st), true);
  assert.equal(F.currentCard(st), null);
  // judging something outside the five does not move it
  const off = F.judge(st, deck, 'c010', 1, 900, NOW + 60000).state;
  assert.equal(off.five.i, 5);
  // another five the same day: n = 2, days unchanged
  st = F.startFive(st, deck, NOW + 120000);
  assert.equal(st.five.n, 2);
  st = finishFive(st, NOW + 120000);
  assert.deepEqual(st.days, [TODAY]);
  // tomorrow starts again at n = 1
  const tomorrow = F.startFive(st, deck, NOW + DAY_MS);
  assert.equal(tomorrow.five.n, 1);
  assert.equal(tomorrow.five.day, '2026-10-22');
  assert.equal(F.fiveDone(F.newState()), false);
  assert.equal(F.currentCard(F.newState()), null);
});

test('undo restores exactly', () => {
  let st = F.startFive(judgeAll(F.newState(), warmCoolTwenty()).state, deck, NOW);
  const snaps = [];
  for (let k = 0; k < 5; k++) {
    snaps.push(st);
    st = F.judge(st, deck, F.currentCard(st), 1, 1500, NOW + k * 4000).state;
  }
  assert.deepEqual(st.days, [TODAY]);
  for (let k = 4; k >= 0; k--) {
    st = F.undo(st);
    assert.deepEqual(st, snaps[k]);
  }
  // a turn undone
  const base = judgeAll(F.newState(), warmCoolTwenty()).state;
  const r = F.judge(base, deck, 'i006', 1, 3000, NOW);
  assert.ok(r.turn);
  assert.deepEqual(F.undo(r.state), base);
  // a let-go undone
  const withOwn = F.bring(base, { id: 'ybowl', kind: 'object', name: 'Bowl', source: 'Your photos', colours: ['#aa6633'] }, NOW - DAY_MS);
  const kept = F.judge(withOwn, deck, 'ybowl', 1, 2000, NOW).state;
  const gone = F.judge(kept, deck, 'ybowl', 0, 2000, NOW + 3 * DAY_MS).state;
  assert.ok(gone.own[0].let);
  assert.deepEqual(F.undo(gone), kept);
  assert.deepEqual(F.undo(kept), withOwn);
  // nothing to undo
  assert.deepEqual(F.undo(F.newState()), F.newState());
});

// --------------------------------------------------------------- the taste model and turns

test('a turn: keeping a cool geometric card after ~20 warm keeps and cool passes', () => {
  const { state, turns } = judgeAll(F.newState(), warmCoolTwenty());
  assert.ok(turns.slice(0, 12).every((t) => t === null), 'no turns before 12 judgments');
  const pred = F.predict(F.model(state, deck), byId.get('i006'));
  assert.ok(pred.p <= 0.3, 'predicted pass, p=' + pred.p);
  assert.ok(pred.confidence > 0.3);
  const r = F.judge(state, deck, 'i006', 1, 3200, NOW);
  assert.ok(r.turn, 'turn flagged');
  assert.equal(r.turn.dir, 1);
  assert.ok(r.turn.because.length >= 1 && r.turn.because.length <= 2);
  const cool = /^(gene:(geometric|hard-edge|minimalism)|hue:(blue|teal|cyan|indigo|violet))$/;
  assert.ok(r.turn.because.some((b) => cool.test(b.key)), JSON.stringify(r.turn.because));
  assert.ok(r.turn.because.some((b) => b.key === 'gene:geometric' || /^hue:/.test(b.key)), 'names geometric or a cool hue');
  for (const b of r.turn.because) { assert.ok(b.kept / b.n < 0.5); assert.equal(typeof b.label, 'string'); }
  assert.deepEqual(r.state.j.at(-1).slice(0, 2), ['i006', 1]);
  assert.equal(r.state.j.at(-1)[4], 1);
  // passing a warm organic card is a turn the other way
  const r2 = F.judge(state, deck, 'i005', 0, 3200, NOW);
  assert.equal(r2.turn && r2.turn.dir, -1);
  assert.ok(r2.turn.because.some((b) => /^(gene:(biomorphic|organic)|hue:(orange|red|yellow))$/.test(b.key)));
  // going with the pattern is not a turn
  assert.equal(F.judge(state, deck, 'i006', 0, 900, NOW).turn, null);
  assert.equal(F.judge(state, deck, 'i005', 1, 900, NOW).state.j.at(-1)[4], 0);
});

test('a high keep rate alone is not a confident prediction: the features must point that way', () => {
  // keep all twenty: p for an ordinary card is high from the base rate, but no feature says "keep this one"
  const { state } = judgeAll(F.newState(), warmCoolTwenty().map(([c]) => [c, 1]));
  const pr = F.predict(F.model(state, deck), byId.get('i005'));
  assert.ok(pr.p >= 0.7, 'p=' + pr.p);
  assert.ok(pr.push < Math.log(0.7 / 0.3));
  assert.equal(F.judge(state, deck, 'i005', 0, 2000, NOW).turn, null);
});

test('no turn under 12 judgments, however strong the pattern', () => {
  const eleven = warmCoolTwenty().slice(0, 11);
  const { state } = judgeAll(F.newState(), eleven);
  assert.equal(state.j.length, 11);
  const r = F.judge(state, deck, 'i006', 1, 3000, NOW);
  assert.equal(r.turn, null);
  assert.equal(r.state.j.at(-1)[4], 0);
});

test('model and predict: Beta counts per feature; warm predicted keep, cool predicted pass', () => {
  const st = judgeAll(F.newState(), warmCoolTwenty()).state;
  const m = F.model(st, deck);
  assert.equal(m.n, 20);
  assert.equal(m.k, 10);
  assert.deepEqual(m.f['gene:biomorphic'], { k: 6, n: 6 });
  assert.deepEqual(m.f['gene:geometric'], { k: 0, n: 6 });
  assert.ok(F.predict(m, byId.get('o005')).p > 0.7);
  assert.ok(F.predict(m, byId.get('o006')).p < 0.3);
  const empty = F.predict(F.model(F.newState(), deck), byId.get('o005'));
  assert.equal(empty.p, 0.5);
  assert.equal(empty.confidence, 0);
  assert.deepEqual(empty.because, []);
});

// --------------------------------------------------------------- features and labels

test('features: colour cards carry colour only; surfaces colour + material + texture + kind', () => {
  const colourKeys = (f) => Object.keys(f).every((k) => /^(hue|value|chroma|chord):/.test(k));
  const c = F.features(byId.get('c001'));
  assert.ok(colourKeys(c));
  assert.equal(c['hue:orange'], 1);
  assert.equal(c['chord:monochrome'], 0.5, 'context features weigh half');
  assert.equal(c['value:mid'], 0.5);
  const u = F.features(byId.get('u001'));
  assert.deepEqual(Object.keys(u).filter((k) => !/^(hue|value|chroma|chord):/.test(k)).sort(), ['kind:surface', 'mat:oil', 'texture:fine']);
  const o = F.features(byId.get('o001'));
  const o1 = byId.get('o001');
  assert.equal(o['gene:biomorphic'], 1);
  assert.equal(o['mat:wood'], 1);
  assert.equal(o['kind:object'], 0.5);
  for (const k of ['kind:object', 'cat:Design/Decorative Art', 'mat:wood', 'gene:biomorphic', 'gene:organic', 'era:' + o1.era, 'place:' + o1.place]) assert.ok(k in o, k);
  const own = F.card(F.bring(F.newState(), { id: 'yx', kind: 'space', colours: ['#336699', '#ddeeff'], crop: [0.1, 0.1, 0.2, 0.2], texture: 0.7 }, NOW), deck, 'yx');
  const of = F.features(own);
  assert.deepEqual(Object.keys(of).filter((k) => !/^(hue|value|chroma|chord):/.test(k)).sort(), ['kind:space', 'texture:coarse']);
  // hue weights follow the 3:2:1 bands
  const mixed = F.features({ kind: 'colour', colours: ['#c4622d', '#2f5d8a', '#bbbbbb'] });
  assert.equal(mixed['hue:orange'], 0.5);
  assert.equal(mixed['hue:blue'], 0.33);
  assert.equal(mixed['hue:neutral'], 0.17);
});

test('featureLabel and featureGroup', () => {
  const cases = [
    ['gene:biomorphic', 'Biomorphic', 'Qualities'], ['gene:handmade', 'Handcrafted Furniture and Design', 'Qualities'],
    ['gene:minimalism', 'Minimalism', 'Movements'], ['gene:interiors', 'Interiors', 'Subjects'],
    ['gene:not-in-deck', 'Not In Deck', 'Qualities'], ['mat:wood', 'Wood', 'Materials'], ['mat:found objects', 'Found objects', 'Materials'],
    ['era:1970–99', '1970–99', 'Eras'], ['place:Japan', 'Japan', 'Places'], ['hue:orange', 'Orange', 'Colours'],
    ['hue:neutral', 'Neutral', 'Colours'], ['chroma:muted', 'Muted', 'Colours'], ['value:mid', 'Mid-tone', 'Colours'],
    ['chord:analogous', 'Analogous', 'Colours'], ['texture:fine', 'Fine texture', 'Textures'], ['kind:object', 'Object', 'Kinds'],
    ['cat:Sculpture', 'Sculpture', 'Kinds'],
  ];
  for (const [k, label, group] of cases) {
    assert.equal(F.featureLabel(k, deck), label, k);
    assert.equal(F.featureGroup(k, deck), group, k);
  }
});

test('colourName: plain words for known colours, never more than three', () => {
  const known = {
    '#bbbbbb': 'pale grey', '#8c8a85': 'grey', '#3a3936': 'charcoal', '#ffffff': 'white', '#000000': 'black',
    '#e9e6df': 'off-white', '#0f3532': 'deep teal', '#b5452a': 'brick red', '#b5803a': 'warm ochre', '#c4622d': 'terracotta',
    '#132a40': 'navy', '#d2b48c': 'tan', '#9caf88': 'sage', '#708090': 'blue-grey', '#800000': 'maroon', '#e2725b': 'coral',
    '#9cc3e4': 'sky blue', '#2a7f7a': 'teal',
  };
  for (const [hex, name] of Object.entries(known)) assert.equal(F.colourName(hex), name, hex);
  assert.equal(F.colourName('#BBB'), 'pale grey');
  assert.equal(typeof F.colourName('not a colour'), 'string');
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const n = F.colourName(hex);
    assert.ok(n && n.split(' ').length <= 3, hex + ' -> ' + n);
  }
});

test('hexToHsl', () => {
  assert.deepEqual(F.hexToHsl('#ff0000'), { h: 0, s: 1, l: 0.5 });
  const x = F.hexToHsl('#2f5d8a');
  assert.ok(Math.abs(x.h - 209.7) < 0.5 && Math.abs(x.s - 0.492) < 0.01 && Math.abs(x.l - 0.363) < 0.01);
  assert.deepEqual(F.hexToHsl('#808080'), { h: 0, s: 0, l: 128 / 255 });
});

test('chord: all six, with Neutral and Accent checked before the hue tests', () => {
  assert.equal(F.chord(['#bbbbbb', '#808080', '#333333']), 'neutral');
  assert.equal(F.chord(['#bbbbbb', '#808080', '#c4622d']), 'accent');
  assert.equal(F.chord(['#ff0000', '#999999', '#aaaaaa']), 'accent');
  assert.equal(F.chord(['#c4622d', '#e8b07a', '#5a2e1a']), 'monochrome');
  assert.equal(F.chord(['#ff0000', '#ff8000', '#ffd000']), 'analogous');
  assert.equal(F.chord(['#ff0000', '#40ff00', '#888888']), 'split');
  assert.equal(F.chord(['#2f5d8a', '#d9822b', '#eeeeee']), 'complementary');
  assert.equal(F.chord(['#ff0000', '#00ffff', '#ffff00']), 'complementary');
  assert.equal(F.chord(['#f00a0a', '#0af00a']), 'split'); // 120° apart
  assert.equal(F.chord([]), 'neutral');
});

// --------------------------------------------------------------- profile

test('profile numbers add up and the leanings make sense', () => {
  let st = judgeAll(F.newState(), warmCoolTwenty()).state;
  st = judgeAll(st, [['i005', 1], ['o005', 1], ['s006', 0], ['u006', 0], ['c005', 1]], NOW - 1800000).state;
  st = F.bring(st, { id: 'ymug', kind: 'object', name: 'Mug', source: 'Your photos', colours: ['#c4622d', '#e8b07a', '#5a2e1a'] }, NOW - 600000);
  const P = F.profile(st, deck, NOW);
  assert.equal(P.judged, 26);
  assert.equal(P.kept, 14);
  assert.equal(P.passed, 12);
  assert.equal(P.kept + P.passed, P.judged);
  assert.equal(P.keepRate, Math.round((14 / 26) * 100) / 100);
  assert.equal(P.medianMs, 1500);
  assert.equal(P.speed, 'gut');
  const keptIds = Object.values(P.keptByKind).flat();
  assert.equal(keptIds.length, 13 + 1, 'distinct kept cards plus the brought thing');
  assert.ok(P.keptByKind.object.includes('ymug'));
  for (const [k, ids] of Object.entries(P.keptByKind)) for (const x of ids) if (x[0] !== 'y') assert.equal(kindOf(x), k);
  for (const g of ['Qualities', 'Movements', 'Subjects', 'Materials', 'Eras', 'Places', 'Kinds', 'Colours', 'Textures']) {
    assert.ok(Array.isArray(P.groups[g]), g);
    for (const e of P.groups[g]) { assert.ok(e.kept <= e.n); assert.equal(F.featureGroup(e.key, deck), g); }
  }
  const bio = P.groups.Qualities.find((e) => e.key === 'gene:biomorphic');
  assert.deepEqual([bio.kept, bio.n], [8, 8]);
  assert.ok(P.positive.length > 0 && P.positive.length <= 10);
  assert.ok(P.negative.length > 0 && P.negative.length <= 10);
  assert.ok(P.positive.every((e, i, a) => e.lift > 0 && e.n >= 3 && (!i || a[i - 1].lift >= e.lift)));
  assert.ok(P.negative.every((e, i, a) => e.lift < 0 && e.n >= 3 && (!i || a[i - 1].lift <= e.lift)));
  const pos = P.positive.map((e) => e.key), neg = P.negative.map((e) => e.key);
  assert.ok(pos.includes('gene:biomorphic') && pos.includes('hue:orange'));
  assert.ok(neg.includes('gene:geometric') && neg.includes('hue:blue'));
  assert.ok(!pos.some((k) => neg.includes(k)));
  assert.ok(P.keptColours.includes('#c4622d') && P.passedColours.includes('#2f5d8a'));
  assert.equal(P.drift, null, 'drift needs 30 judgments');
  assert.equal(P.brought, 1);
  assert.equal(P.letGo, 0);
  assert.deepEqual(P.sources, [{ source: "The artist's database (Artsy)", n: 13 }, { source: 'Your photos', n: 1 }]);
  assert.equal(P.notes, 0);
  assert.equal(P.turns.length, st.j.filter((e) => e[4]).length);
  assert.equal(P.lean.warm.kept / P.lean.warm.n > P.lean.cool.kept / P.lean.cool.n, true);
});

test('profile: turns newest first with reasons; drift from 30 judgments', () => {
  let { state } = judgeAll(F.newState(), warmCoolTwenty());
  state = judgeAll(state, [['i006', 1], ['o005', 1], ['o006', 0], ['s005', 1], ['s006', 0], ['u005', 1], ['u006', 0],
    ['c005', 1], ['c006', 0], ['i007', 1], ['i008', 0], ['o008', 1]], NOW - 1800000).state;
  const P = F.profile(state, deck, NOW);
  assert.ok(P.turns.length >= 2);
  assert.ok(P.turns.every((t, i, a) => !i || a[i - 1].at >= t.at));
  const first = P.turns.at(-1);
  assert.equal(first.card, 'i006');
  assert.equal(first.dir, 1);
  assert.ok(first.because.length >= 1 && first.because.every((b) => 'key' in b && 'kept' in b && 'n' in b));
  assert.ok(P.drift && P.drift.then.length > 0 && P.drift.now.length > 0);
});

test('profile streak and todayDone; streak across days', () => {
  const st = { ...F.newState(), days: ['2026-10-18', '2026-10-19', '2026-10-20'] };
  assert.equal(F.streak(st, NOW), 3); // ending yesterday still counts
  assert.equal(F.streak(st, at(2026, 10, 20, 9)), 3);
  assert.equal(F.streak(st, at(2026, 10, 22, 9)), 0);
  const st2 = { ...st, days: ['2026-10-15', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'] };
  assert.equal(F.streak(st2, NOW), 5);
  const cross = { ...F.newState(), days: ['2026-12-30', '2026-12-31', '2027-01-01'] };
  assert.equal(F.streak(cross, at(2027, 1, 1)), 3);
  assert.equal(F.streak(F.newState(), NOW), 0);
  const P = F.profile(st2, deck, NOW);
  assert.equal(P.streak, 5);
  assert.equal(P.todayDone, true);
  assert.equal(F.profile(st, deck, NOW).todayDone, false);
});

// --------------------------------------------------------------- brought things

test('brought things: kept, in sources, revisited only under the rule, let go, removed', () => {
  const base = judgeAll(F.newState(), warmCoolTwenty()).state;
  const t0 = NOW - 5 * DAY_MS;
  let st = F.bring(base, { id: 'ybowl', kind: 'object', name: "  Grandmother's   bowl ", source: 'Your photos',
    colours: ['#C4622D', '#e8b07a', 'nope', '#5a2e1a', '#000'], crop: [0.4, 0.3, 0.25, 0.25], texture: 0.4, w: 720, h: 540 }, t0);
  assert.deepEqual(st.own[0], { id: 'ybowl', kind: 'object', name: "Grandmother's bowl", source: 'Your photos',
    colours: ['#c4622d', '#e8b07a', '#5a2e1a'], crop: [0.4, 0.3, 0.25, 0.25], texture: 0.4, w: 720, h: 540, at: S(t0), let: null, seenAt: null });
  const c = F.card(st, deck, 'ybowl');
  assert.equal(c.own, true);
  assert.equal(c.title, "Grandmother's bowl");
  assert.equal(c.artist, 'You');
  assert.equal(c.img, null);
  assert.deepEqual([c.materials, c.genes, c.era, c.place], [[], [], null, null]);
  assert.equal(F.card(F.bring(F.newState(), { id: 'yz', kind: 'image' }, NOW), deck, 'yz').title, 'Untitled');
  assert.equal(F.card(st, deck, 'ynope'), null);
  assert.equal(F.card(st, deck, 'zzz'), null);

  // counts as kept, appears in sources
  let P = F.profile(st, deck, NOW);
  assert.equal(P.kept, 11);
  assert.equal(P.brought, 1);
  assert.ok(P.keptByKind.object.includes('ybowl'));
  assert.deepEqual(P.sources.map((s) => s.source), ["The artist's database (Artsy)", 'Your photos']);
  assert.equal(F.model(st, deck).n, 21);

  // revisit rule: brought before this five started, not revisited in the last 2 days
  assert.ok(!F.nextFive(st, deck, t0).includes('ybowl'), 'not in a five started the moment it was brought');
  const t1 = t0 + 3600000;
  const five = F.nextFive(st, deck, t1);
  assert.ok(five.includes('ybowl'));
  assert.equal(F.isRevisit(st, 'ybowl'), true);
  assert.equal(F.isRevisit(st, 'o001'), false);
  st = F.startFive(st, deck, t1);
  st = finishFive(st, t1); // keeps it: "Still yours?" Keep
  const kept = st.own[0];
  assert.equal(kept.let, null);
  assert.ok(kept.seenAt > S(t1));
  assert.ok(!F.nextFive(st, deck, kept.seenAt * 1000 + DAY_MS).includes('ybowl'), 'not within 2 days');
  assert.ok(!F.nextFive(st, deck, kept.seenAt * 1000 + 2 * DAY_MS - 5000).includes('ybowl'));
  assert.ok(F.nextFive(st, deck, kept.seenAt * 1000 + 2 * DAY_MS + 1000).includes('ybowl'), 'back after 2 days');
  assert.equal(F.profile(st, deck, NOW).kept, P.kept + st.j.slice(20).filter((e) => e[1] && e[0][0] !== 'y').length);

  // letting go: recorded like a pass; leaves kept, sources; never comes back
  const before = F.profile(st, deck, NOW);
  const tLet = kept.seenAt * 1000 + 3 * DAY_MS;
  st = F.judge(st, deck, 'ybowl', 0, 2400, tLet).state;
  assert.equal(st.own[0].let, S(tLet));
  assert.deepEqual(st.j.at(-1).slice(0, 2), ['ybowl', 0]);
  P = F.profile(st, deck, NOW);
  assert.equal(P.kept, before.kept - 1);
  assert.equal(P.judged, before.judged, 'a revisit is not counted twice');
  assert.equal(P.letGo, 1);
  assert.ok(!P.keptByKind.object.includes('ybowl'));
  assert.ok(!P.sources.some((s) => s.source === 'Your photos'));
  assert.ok(!F.nextFive(st, deck, tLet + 10 * DAY_MS).includes('ybowl'));
  assert.ok(!F.setCandidates(st, deck, 'object', 0).includes('ybowl'));

  // at most one brought thing per five, the least recently revisited
  let many = F.bring(base, { id: 'ya', kind: 'image', colours: ['#aa3300'] }, t0);
  many = F.bring(many, { id: 'yb', kind: 'space', colours: ['#336699'] }, t0 + 1000);
  many = F.bring(many, { id: 'yc', kind: 'object', colours: ['#998877'] }, t0 + 2000);
  const ids = F.nextFive(many, deck, NOW);
  assert.deepEqual(ids.filter((x) => x[0] === 'y'), ['ya']);
  // bringing the same id again updates its details
  const renamed = F.bring(many, { id: 'ya', name: 'Renamed', kind: 'space' }, NOW);
  assert.equal(renamed.own.length, 3);
  assert.deepEqual([renamed.own[0].name, renamed.own[0].kind, renamed.own[0].at, renamed.own[0].colours], ['Renamed', 'space', S(t0), ['#aa3300']]);
  // an id is made when none is given, starting with "y"
  const auto = F.bring(F.newState(), { kind: 'image', name: 'x' }, NOW);
  assert.match(auto.own[0].id, /^y[0-9a-z]+$/);
});

test('removeOwn drops the thing, its judgments, the notes about it and its place in sets', () => {
  let st = F.bring(F.newState(), { id: 'ybowl', kind: 'object', name: 'Bowl', source: 'Pinterest', colours: ['#c4622d'] }, NOW - 3 * DAY_MS);
  st = F.addNote(st, { q: 'bring', text: 'Why I saved it', ref: 'ybowl' }, NOW - 3 * DAY_MS);
  st = F.addNote(st, { q: 'free', text: 'Something else', ref: null }, NOW - 2 * DAY_MS);
  st = F.startFive(st, deck, NOW - DAY_MS);
  assert.ok(st.five.ids.includes('ybowl'));
  st = finishFive(st, NOW - DAY_MS);
  st = F.pinSet(st, { wall: 'ybowl', object: 'ybowl', picture: 'i001', name: 'Mine' }, NOW);
  const r = F.removeOwn(st, 'ybowl');
  assert.deepEqual(r.own, []);
  assert.ok(!r.j.some((e) => e[0] === 'ybowl'));
  assert.equal(r.j.length, st.j.length - 1);
  assert.deepEqual(r.notes.map((n) => n.text), ['Something else']);
  assert.deepEqual([r.sets[0].wall, r.sets[0].object, r.sets[0].picture, r.sets[0].name], [null, null, 'i001', 'Mine']);
  assert.ok(!r.five.ids.includes('ybowl'));
  assert.equal(r.five.i, r.five.ids.length);
  assert.deepEqual(F.removeOwn(st, 'ymissing'), st);
});

// --------------------------------------------------------------- notes, seen, sets

test('notes: add and remove', () => {
  let st = F.addNote(F.newState(), { q: 'turn', text: "  I didn't expect to like steel. ", ref: 'o002' }, NOW);
  assert.deepEqual(st.notes, [{ at: S(NOW), q: 'turn', ref: 'o002', text: "I didn't expect to like steel." }]);
  st = F.addNote(st, { q: 'five', text: 'Earthy' }, NOW + 5000);
  st = F.addNote(st, { q: 'whatever', text: 'Free one' }, NOW + 9000);
  assert.deepEqual(st.notes.map((n) => [n.q, n.ref]), [['turn', 'o002'], ['five', null], ['free', null]]);
  assert.equal(F.addNote(st, { q: 'free', text: '   ' }, NOW).notes.length, 3, 'empty text adds nothing');
  assert.equal(F.addNote(st, { q: 'free', text: 'x'.repeat(900) }, NOW).notes.at(-1).text.length, 500);
  assert.deepEqual(F.removeNote(st, 1).notes.map((n) => n.text), ["I didn't expect to like steel.", 'Free one']);
  assert.deepEqual(F.removeNote(st, S(NOW + 9000)).notes.map((n) => n.q), ['turn', 'five']);
  assert.equal(F.removeNote(st, 7).notes.length, 3);
  assert.equal(F.profile(st, deck, NOW).notes, 3);
});

test('markSeen and pinSet / unpinSet', () => {
  let st = F.markSeen(F.newState(), 'intro');
  st = F.markSeen(st, 'seed');
  st = F.markSeen(st, 'path:sort');
  st = F.markSeen(st, 'path:sort');
  st = F.markSeen(st, 'path:bring');
  assert.deepEqual(st.seen, { path: ['sort', 'bring'], intro: 1, seed: 1 });
  st = F.pinSet(st, { wall: 'c001', window: 's001', picture: 'i001', floor: 'u001', object: 'o001', name: '  A room for slow mornings ' }, NOW);
  st = F.pinSet(st, { wall: 'c003', picture: 'i003', name: 'y'.repeat(120) }, NOW + 1000);
  st = F.pinSet(st, { wall: 'c005' }, NOW + 2000);
  assert.deepEqual(st.sets[0], { at: S(NOW), wall: 'c001', window: 's001', picture: 'i001', floor: 'u001', object: 'o001', name: 'A room for slow mornings' });
  assert.equal(st.sets[1].window, null);
  assert.equal(st.sets[1].name.length, 80);
  assert.ok(!('name' in st.sets[2]));
  const un = F.unpinSet(st, 1);
  assert.deepEqual(un.sets.map((s) => s.wall), ['c001', 'c005']);
  assert.deepEqual(F.unpinSet(st, 9).sets, st.sets);
});

test('setCandidates: only kept things for the slot, three at a time, paging', () => {
  let st = judgeAll(F.newState(), [['i001', 1], ['i002', 0], ['i003', 1], ['i004', 0], ['i005', 1], ['i007', 1], ['i009', 1],
    ['s001', 1], ['s002', 0], ['o002', 0], ['u001', 1], ['c002', 0]]).state;
  const keptImages = ['i001', 'i003', 'i005', 'i007', 'i009'];
  const p0 = F.setCandidates(st, deck, 'picture', 0), p1 = F.setCandidates(st, deck, 'picture', 1);
  assert.equal(p0.length, 3);
  assert.equal(p1.length, 2);
  assert.deepEqual([...p0, ...p1].sort(), keptImages);
  assert.deepEqual(F.setCandidates(st, deck, 'picture', 2), p0, 'wraps round');
  assert.deepEqual(F.setPool(st, deck, 'picture'), [...p0, ...p1]);
  assert.deepEqual(F.setCandidates(st, deck, 'window', 0), ['s001']);
  assert.deepEqual(F.setCandidates(st, deck, 'object', 0), [], 'no kept object yet');
  assert.deepEqual(F.setCandidates(st, deck, 'floor', 0), ['u001']);
  assert.deepEqual(F.setCandidates(st, deck, 'nowhere', 0), []);
  // the wall falls back to the colours of kept works until a Colour card is kept
  const wall = F.setCandidates(st, deck, 'wall', 0);
  assert.ok(wall.length > 0 && wall.every((x) => !x.startsWith('c')));
  st = judgeAll(st, [['c001', 1], ['c003', 0]], NOW - 1000000).state;
  assert.deepEqual(F.setCandidates(st, deck, 'wall', 0), ['c001']);
  // a kept card later passed is no longer a candidate
  st = judgeAll(st, [['i001', 0]], NOW - 900000).state;
  assert.ok(!F.setPool(st, deck, 'picture').includes('i001'));
  // brought things: their kind's slot, the wall (colours) and the floor (crop)
  st = F.bring(st, { id: 'yob', kind: 'object', colours: ['#aa6633'], crop: [0.1, 0.1, 0.3, 0.3] }, NOW - 800000);
  st = F.bring(st, { id: 'yim', kind: 'image', colours: ['#bb7744'] }, NOW - 700000);
  assert.deepEqual(F.setCandidates(st, deck, 'object', 0), ['yob']);
  assert.ok(F.setPool(st, deck, 'picture').includes('yim'));
  assert.ok(F.setPool(st, deck, 'wall').includes('yob') && F.setPool(st, deck, 'wall').includes('yim'));
  assert.ok(F.setPool(st, deck, 'floor').includes('yob') && !F.setPool(st, deck, 'floor').includes('yim'));
  const P = F.profile(st, deck, NOW);
  const keptNow = new Set(Object.values(P.keptByKind).flat());
  for (const slot of F.SLOT_NAMES) {
    for (let page = 0; page < 4; page++) {
      const ids = F.setCandidates(st, deck, slot, page);
      assert.ok(ids.length <= 3);
      for (const x of ids) {
        assert.ok(keptNow.has(x), slot + ' ' + x + ' is kept');
        const c = F.card(st, deck, x);
        assert.ok(c.kind === F.SLOTS[slot] || (c.own && (slot === 'wall' || slot === 'floor')), slot + ' ' + x);
      }
    }
  }
});

// --------------------------------------------------------------- the path

test('path: milestones flip as the state grows; exactly one is next', () => {
  const keys = ['sort', 'bring', 'kinds', 'set', 'turn', 'note', 'seed', 'habit'];
  // Your hub (SPEC.md): the four hub milestones follow the eight, which are unchanged.
  const all = keys.concat(['github', 'hub', 'saved', 'opened']);
  const check = (st, expectDone) => {
    const p = F.path(st, deck, NOW);
    assert.deepEqual(p.slice(0, 8).map((m) => m.key), keys);
    assert.deepEqual(p.map((m) => m.key), all);
    for (const m of p) for (const f of ['key', 'step', 'label', 'why', 'done', 'next']) assert.ok(f in m, f);
    assert.deepEqual(p.filter((m) => m.done).map((m) => m.key), expectDone);
    const nexts = p.filter((m) => m.next);
    if (expectDone.length < all.length) {
      assert.equal(nexts.length, 1);
      assert.equal(nexts[0].key, all.find((k) => !expectDone.includes(k)));
    } else assert.equal(nexts.length, 0);
    return p;
  };
  const p0 = check(F.newState(), []);
  assert.deepEqual(p0.slice(0, 8).map((m) => m.step), ['Sort', 'Split', 'Split', 'Set', 'See', 'See', 'Seed', 'Sort']);
  assert.equal(p0[0].label, 'Sort your first five');
  assert.equal(p0[1].why, 'The artist brought 5,021 works saved on Artsy home into one database.');
  assert.equal(p0[3].label, "Pin a set and say what it's for");
  assert.equal(p0[4].why, 'The artist: real transformation happens at the moments you defy your own judgments.');
  assert.equal(p0[7].label, 'Five days in a row');

  let st = F.startFive(F.newState(), deck, NOW - 4 * DAY_MS);
  st = finishFive(st, NOW - 4 * DAY_MS);
  check(st, ['sort']);
  st = F.addNote(st, { q: 'five', text: 'Warm' }, NOW - 4 * DAY_MS);
  check(st, ['sort', 'note']);
  st = F.bring(st, { id: 'yb', kind: 'object', colours: ['#aa5500'] }, NOW - 4 * DAY_MS);
  check(st, ['sort', 'bring', 'note']);
  st = judgeAll(st, F.KINDS.map((k) => [id(k, 1), 1]).concat(F.KINDS.map((k) => [id(k, 3), 1])), NOW - 3 * DAY_MS).state;
  check(st, ['sort', 'bring', 'kinds', 'note']);
  st = F.pinSet(st, { wall: 'c001' }, NOW - 3 * DAY_MS);
  check(st, ['sort', 'bring', 'kinds', 'note']);
  st = F.pinSet(st, { wall: 'c001', name: 'For slow mornings' }, NOW - 3 * DAY_MS);
  check(st, ['sort', 'bring', 'kinds', 'set', 'note']);
  st = judgeAll(st, F.KINDS.map((k) => [id(k, 2), 0]).concat(F.KINDS.map((k) => [id(k, 4), 0])), NOW - 2 * DAY_MS).state;
  st = F.judge(st, deck, 'i006', 1, 3000, NOW - DAY_MS).state;
  check(st, ['sort', 'bring', 'kinds', 'set', 'turn', 'note']);
  st = F.markSeen(st, 'seed');
  check(st, ['sort', 'bring', 'kinds', 'set', 'turn', 'note', 'seed']);
  st = { ...st, days: ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'] };
  const done = check(st, keys);
  assert.ok(done.every((m) => m.announced === false));
  st = F.markSeen(st, 'path:habit');
  assert.equal(F.path(st, deck, NOW).find((m) => m.key === 'habit').announced, true);
});

// --------------------------------------------------------------- the seed

test('exportSeed: works by slug, brought things by name; no ids, images or account details; counts match', () => {
  const ex = F.exampleState(deck, NOW);
  const seed = F.exportSeed(ex, deck, NOW);
  const P = F.profile(ex, deck, NOW);
  assert.equal(seed.format, '5s-seed');
  assert.equal(seed.version, 1);
  assert.equal(seed.code, F.seedCode(ex));
  assert.equal(seed.made, TODAY);
  assert.deepEqual(seed.counts, { judged: P.judged, kept: P.kept, passed: P.passed, turns: P.turns.length });
  const deckKept = Object.values(P.keptByKind).flat().filter((x) => x[0] !== 'y');
  assert.equal(seed.kept.length, deckKept.length);
  assert.deepEqual(seed.kept.map((k) => k.work).sort(), deckKept.map((x) => byId.get(x).work).sort());
  const ownKept = ex.own.filter((o) => o.let == null).length, ownLet = ex.own.length - ownKept;
  assert.equal(seed.counts.judged, P.judged);
  assert.equal(seed.own.length, ex.own.length);
  assert.equal(seed.own.filter((o) => o.let).length, ownLet);
  assert.ok(seed.kept.every((k) => k.work.startsWith('fixture-') && F.KINDS.includes(k.kind) && Number.isInteger(k.ms)));
  assert.ok(seed.passed.every((k) => k.work.startsWith('fixture-') && F.KINDS.includes(k.kind)));
  assert.deepEqual(seed.palette, { kept: P.keptColours, passed: P.passedColours });
  assert.equal(seed.turns.length, P.turns.length);
  assert.equal(seed.sets.length, 2);
  assert.equal(seed.sets[0].name, 'A room for slow mornings');
  assert.equal(seed.sets[0].object, "Grandmother's bowl");
  assert.equal(seed.notes.length, 4);
  assert.ok(seed.notes.some((n) => n.q === 'bring' && n.about === "Grandmother's bowl"));
  assert.ok(seed.notes.some((n) => n.q === 'set' && n.about === 'A room for slow mornings'));
  assert.ok(seed.notes.every((n) => /^\d{4}-\d{2}-\d{2}$/.test(n.at)));
  assert.deepEqual(seed.speed, { medianMs: P.medianMs });
  // nothing that identifies a card, an image or a person
  const ids = new Set([...deck.cards.map((c) => c.id), ...ex.own.map((o) => o.id)]);
  // The one exception (Your hub): a kept work's public Artsy addresses, seed.kept[i].image and .url.
  const publicAddress = (keyPath) => /^seed\.kept\[\d+\]\.(image|url)$/.test(keyPath);
  const walk = (v, keyPath) => {
    if (typeof v === 'string') {
      assert.ok(!ids.has(v), 'id leaked at ' + keyPath + ': ' + v);
      if (publicAddress(keyPath)) { assert.match(v, /^https:\/\/[^@\s]+$/); return; }
      assert.ok(!/^data:|^img\/|https?:|@/.test(v), 'leak at ' + keyPath + ': ' + v);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, keyPath + '[' + i + ']'));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        assert.ok(publicAddress(keyPath + '.' + k) || !['id', 'img', 'imgFrom', 'thumb', 'url', 'email', 'user', 'uid', 'account'].includes(k), 'key ' + k);
        walk(x, keyPath + '.' + k);
      }
    }
  };
  walk(seed, 'seed');
  // with no repeats, the counts are exactly the lists
  const st = F.bring(judgeAll(F.newState(), warmCoolTwenty()).state, { id: 'yq', kind: 'image', name: '', colours: ['#aa5500'] }, NOW);
  const s2 = F.exportSeed(st, deck, NOW);
  assert.equal(s2.counts.kept, s2.kept.length + s2.own.filter((o) => !o.let).length);
  assert.equal(s2.counts.passed, s2.passed.length + s2.own.filter((o) => o.let).length);
  assert.equal(s2.counts.judged, s2.counts.kept + s2.counts.passed);
  assert.equal(s2.own[0].name, 'Untitled');
  assert.ok(s2.surfaces.every((s) => s.work && Array.isArray(s.crop)));
  assert.deepEqual(s2.leanings.positive[0].length, 2);
  // an empty state still exports
  const e = F.exportSeed(F.newState(), deck, NOW);
  assert.deepEqual(e.counts, { judged: 0, kept: 0, passed: 0, turns: 0 });
});

// --------------------------------------------------------------- the example taste

test('exampleState: a believable person, built by the engine itself', () => {
  const ex = F.exampleState(deck, NOW);
  const P = F.profile(ex, deck, NOW);
  // ~60 judgments over the 9 days before today, realistic decision times
  assert.ok(ex.j.length >= 50 && ex.j.length <= 70, 'judgments: ' + ex.j.length);
  const first = ex.j[0][3] * 1000, last = ex.j.at(-1)[3] * 1000;
  assert.ok(F.dayOf(first) >= '2026-10-12' && F.dayOf(last) <= '2026-10-20');
  assert.ok(ex.j.every((e, i, a) => !i || a[i - 1][3] <= e[3]), 'in time order');
  const ms = ex.j.map((e) => e[2]);
  assert.ok(ms.every((x) => x >= 600 && x <= 6000));
  assert.ok(ms.filter((x) => x >= 1000 && x <= 3000).length / ms.length >= 0.55);
  // keeps warm, organic, handmade, earthy; passes cool, hard-edged, glossy
  const pos = P.positive.map((e) => e.key), neg = P.negative.map((e) => e.key);
  assert.ok(pos.includes('gene:biomorphic') || pos.includes('gene:organic'));
  assert.ok(neg.includes('gene:geometric') || neg.includes('gene:hard-edge'));
  assert.ok(P.lean.warm.kept / P.lean.warm.n > 0.7 && P.lean.cool.kept / P.lean.cool.n < 0.3);
  // at least two genuine turns: every flag is what judge() would say from the judgments before it
  const turns = ex.j.filter((e) => e[4]);
  assert.ok(turns.length >= 2, 'turns: ' + turns.length);
  assert.ok(turns.some((e) => e[4] === 1));
  ex.j.forEach((e, i) => {
    if (e[0][0] === 'y' || i < 12) { assert.equal(e[4], 0); return; }
    const t = e[3];
    const before = { ...ex, j: ex.j.slice(0, i), own: ex.own.filter((o) => o.at <= t).map((o) => ({ ...o, let: o.let != null && o.let <= t ? o.let : null })) };
    const pr = F.predict(F.model(before, deck), byId.get(e[0]));
    let expected = e[1] && pr.p <= 0.3 && pr.push <= -PUSH ? 1 : !e[1] && pr.p >= 0.7 && pr.push >= PUSH ? -1 : 0;
    const lead = pr.because.find((b) => (expected > 0 ? b.delta < 0 : b.delta > 0));
    if (expected && !(lead && lead.n >= 3)) expected = 0;
    assert.equal(e[4], expected, 'judgment ' + i + ' ' + e[0] + ' p=' + pr.p);
  });
  // three brought things standing in with deck images of their kind; one let go on a revisit
  assert.equal(ex.own.length, 3);
  for (const o of ex.own) {
    assert.ok(o.id.startsWith('y'));
    assert.equal(kindOf(o.imgFrom), o.kind);
    assert.equal(o.colours.length, 3);
  }
  assert.deepEqual([...new Set(ex.own.map((o) => o.source))].sort(), ['Pinterest', 'Your photos']);
  const gone = ex.own.filter((o) => o.let != null);
  assert.equal(gone.length, 1);
  assert.ok(ex.j.some((e) => e[0] === gone[0].id && e[1] === 0 && e[3] === gone[0].let), 'let go through a revisit');
  assert.ok(ex.j.some((e) => e[0] === gone[0].id && e[1] === 1 && e[3] < gone[0].let), 'kept once before');
  assert.equal(P.letGo, 1);
  assert.deepEqual(P.sources.map((s) => s.source), ["The artist's database (Artsy)", 'Your photos']);
  // four notes, one per kind of question that matters
  assert.deepEqual(ex.notes.map((n) => n.q).sort(), ['bring', 'five', 'set', 'turn']);
  const turnNote = ex.notes.find((n) => n.q === 'turn');
  assert.ok(ex.j.some((e) => e[0] === turnNote.ref && e[4] !== 0));
  assert.equal(ex.notes.find((n) => n.q === 'set').ref, 'set:' + ex.sets[0].at);
  assert.ok(ex.own.some((o) => o.id === ex.notes.find((n) => n.q === 'bring').ref));
  // two named sets, made of things kept before they were pinned
  assert.equal(ex.sets.length, 2);
  for (const s of ex.sets) {
    assert.ok(s.name && s.name.length <= 80);
    for (const slot of F.SLOT_NAMES) {
      const x = s[slot];
      assert.ok(x, slot + ' filled');
      if (x[0] === 'y') assert.ok(ex.own.some((o) => o.id === x && o.at <= s.at));
      else assert.ok(ex.j.some((e) => e[0] === x && e[1] === 1 && e[3] <= s.at), x + ' was kept');
    }
  }
  // days and streak agree with the judgments
  assert.deepEqual(ex.days, [...new Set(ex.days)].sort());
  for (const d of ex.days) assert.ok(ex.j.some((e) => F.dayOf(e[3] * 1000) === d));
  assert.equal(F.streak(ex, NOW), 4);
  assert.equal(P.streak, 4);
  assert.equal(P.todayDone, false);
  assert.equal(F.fiveDone(ex), true);
  // about six of the eight milestones, announced already
  const p = F.path(ex, deck, NOW);
  assert.equal(p.filter((m) => m.done).length, 6);
  assert.equal(p.find((m) => m.next).key, 'seed');
  assert.ok(p.filter((m) => m.done).every((m) => m.announced));
  assert.equal(ex.seen.intro, 1);
});

test('philosophy: 4–6 plain second-person lines, true of the profile; one line when there is too little', () => {
  const ex = F.exampleState(deck, NOW);
  const P = F.profile(ex, deck, NOW);
  const lines = F.philosophy(P, deck);
  assert.ok(lines.length >= 4 && lines.length <= 6, lines.join('\n'));
  for (const l of lines) {
    assert.equal(typeof l, 'string');
    assert.ok(/\byou/i.test(l), 'second person: ' + l);
    assert.ok(!/\b(he|she|his|her|him|hers)\b/i.test(l), 'no gendered pronouns: ' + l);
    assert.ok(l.length <= 140, 'short: ' + l);
  }
  assert.ok(lines[0].includes(String(P.kept)) && lines[0].includes(String(P.judged)));
  assert.ok(lines.some((l) => l.includes('warm colours more than cool')));
  assert.ok(lines.some((l) => /pattern/.test(l) && l.includes(P.turns.length + ' times')));
  assert.ok(lines.some((l) => l.includes('brought in 3 things') && l.includes('let 1 go')));
  assert.deepEqual(F.philosophy(P, deck), lines, 'deterministic');
  // too few judgments: one plain line that says so and suggests sorting more
  const few = F.philosophy(F.profile(judgeAll(F.newState(), warmCoolTwenty().slice(0, 4)).state, deck, NOW), deck);
  assert.equal(few.length, 1);
  assert.match(few[0], /4 things/);
  assert.match(few[0], /[Ss]ort/);
  assert.equal(F.philosophy(F.profile(F.newState(), deck, NOW), deck).length, 1);
  // a modest profile still gets at least four true lines
  const mid = F.philosophy(F.profile(judgeAll(F.newState(), warmCoolTwenty().slice(0, 12)).state, deck, NOW), deck);
  assert.ok(mid.length >= 4 && mid.length <= 6, mid.join('\n'));
  assert.ok(mid.some((l) => l.includes("haven't gone against your own pattern")));
});

test('philosophy: process materials read as things, and one brought thing is "it"', () => {
  // Real decks are full of photographs and prints: "works in photograph" read badly (integration fix).
  const base = F.profile(judgeAll(F.newState(), warmCoolTwenty()).state, deck, NOW);
  const P = Object.assign({}, base, {
    negative: [
      { key: 'mat:photograph', label: 'Photograph', kept: 0, n: 4, lift: -0.5 },
      { key: 'mat:etching', label: 'Etching', kept: 1, n: 5, lift: -0.3 },
    ],
    brought: 1, letGo: 0, judged: base.judged + 1, kept: base.kept + 1,
  });
  const lines = F.philosophy(P, deck);
  assert.ok(lines.some((l) => l === 'What you keep least: photographs (0 of 4), then etchings (1 of 5).'), lines.join('\n'));
  assert.ok(lines.some((l) => l === "You've brought in 1 thing of your own and kept it."), lines.join('\n'));
  const two = F.philosophy(Object.assign({}, P, { brought: 2, judged: base.judged + 2, kept: base.kept + 2 }), deck);
  assert.ok(two.some((l) => l === "You've brought in 2 things of your own and kept them all."), two.join('\n'));
  // other materials keep the "works in" form
  const wood = F.philosophy(Object.assign({}, P, { negative: [{ key: 'mat:wood', label: 'Wood', kept: 0, n: 4, lift: -0.5 }] }), deck);
  assert.ok(wood.some((l) => l === 'What you keep least: works in wood (0 of 4).'), wood.join('\n'));
});

// --------------------------------------------------------------- your hub (SPEC.md "Your hub")

const HUB_KEYS = ['github', 'hub', 'saved', 'opened'];

test('hub API: setHub and the hub milestones are exported; newState stays as it was', () => {
  assert.equal(typeof F.setHub, 'function');
  assert.ok(Object.isFrozen(F));
  assert.equal(F.MILESTONES.length, 8, 'the eight are unchanged');
  assert.deepEqual(F.HUB_MILESTONES.map((m) => m.key), HUB_KEYS);
  assert.deepEqual(F.HUB_MODES, ['links', 'api']);
  assert.ok(Object.isFrozen(F.HUB_MILESTONES) && F.HUB_MILESTONES.every(Object.isFrozen));
  assert.ok(!('hub' in F.newState()), 'state.hub is absent until the first setHub');
});

test('setHub: tidies each field, stamps times, records the saved seed code; never mutates', () => {
  const base = deepFreeze(judgeAll(F.newState(), warmCoolTwenty()).state);
  const t = NOW + 7000;
  let st = F.setHub(base, { user: '  @ada-lovelace ', mode: 'links' }, t);
  assert.notEqual(st, base);
  assert.equal(base.hub, undefined);
  assert.deepEqual(st.hub, { user: 'ada-lovelace', name: null, private: false, mode: 'links', madeAt: null, savedAt: null, savedCode: null });
  // nothing else in the state changes
  const { hub, ...rest } = st;
  assert.deepEqual(rest, base);
  st = F.setHub(deepFreeze(st), { name: ' ada-lovelace.github.io ', private: true, mode: 'api', madeAt: true }, t);
  assert.equal(st.hub.user, 'ada-lovelace', 'fields the patch leaves out are kept');
  assert.equal(st.hub.name, 'ada-lovelace.github.io');
  assert.equal(st.hub.private, true);
  assert.equal(st.hub.mode, 'api');
  assert.equal(st.hub.madeAt, S(t));
  // an unknown mode is ignored; long values are cut to GitHub's limits
  st = F.setHub(st, { mode: 'git', user: 'x'.repeat(60), name: 'n'.repeat(140) }, t);
  assert.equal(st.hub.mode, 'api');
  assert.equal(st.hub.user.length, 39);
  assert.equal(st.hub.name.length, 100);
  // savedAt: true records now and the seed code that was saved
  st = F.setHub(st, { user: 'ada', name: 'ada.github.io', savedAt: true }, t + 1000);
  assert.equal(st.hub.savedAt, S(t + 1000));
  assert.equal(st.hub.savedCode, F.seedCode(base));
  // a millisecond timestamp is taken as milliseconds; seconds as seconds
  assert.equal(F.setHub(st, { madeAt: NOW }, t).hub.madeAt, S(NOW));
  assert.equal(F.setHub(st, { madeAt: S(NOW) - 60 }, t).hub.madeAt, S(NOW) - 60);
  // an explicit savedCode wins; null and '' clear
  assert.equal(F.setHub(st, { savedAt: true, savedCode: '5S-0000-0001' }, t).hub.savedCode, '5S-0000-0001');
  const cleared = F.setHub(st, { user: '', name: null, madeAt: null, savedAt: null }, t);
  assert.deepEqual(cleared.hub, { user: null, name: null, private: true, mode: 'api', madeAt: null, savedAt: null, savedCode: null });
  // an empty or missing patch changes nothing but still returns a new state
  const same = F.setHub(st, null, t);
  assert.notEqual(same, st);
  assert.deepEqual(same.hub, st.hub);
  // it survives migrate (saved JSON round trip) and leaves the seed code alone
  assert.deepEqual(F.migrate(JSON.parse(JSON.stringify(st))).hub, st.hub);
  assert.equal(F.seedCode(st), F.seedCode(base));
});

test('path: twelve milestones, the hub four after the eight with their exact words', () => {
  const p = F.path(F.newState(), deck, NOW);
  assert.equal(p.length, 12);
  assert.deepEqual(p.slice(8).map((m) => [m.key, m.step, m.label, m.why]), [
    ['github', 'Seed', 'Have a GitHub account', 'The artist kept everything in one GitHub repository from the first evening.'],
    ['hub', 'Seed', 'Make your hub', "The artist's repository was made in four minutes, before the first session."],
    ['saved', 'Seed', 'Save your seed to your hub', "The artist's database grew by saving to it, every day."],
    ['opened', 'Seed', "Open your hub's address", "The artist's site went live on GitHub Pages on 14 Sep."],
  ]);
  for (const m of p) assert.ok(!/\b(he|she|his|her|him|hers)\b/i.test(m.label + ' ' + m.why), m.key);
  // the eight are exactly the old eight
  assert.deepEqual(p.slice(0, 8).map((m) => ({ key: m.key, step: m.step, label: m.label, why: m.why })),
    F.MILESTONES.map((m) => ({ key: m.key, step: m.step, label: m.label, why: m.why })));
  // they flip with setHub and markSeen("hub-opened"), in any order, independently of the eight
  const hubDone = (st) => F.path(st, deck, NOW).slice(8).filter((m) => m.done).map((m) => m.key);
  let st = F.newState();
  assert.deepEqual(hubDone(st), []);
  st = F.setHub(st, { user: 'ada' }, NOW);
  assert.deepEqual(hubDone(st), ['github']);
  st = F.setHub(st, { name: 'ada.github.io', madeAt: true }, NOW);
  assert.deepEqual(hubDone(st), ['github', 'hub']);
  st = F.markSeen(st, 'hub-opened');
  assert.deepEqual(hubDone(st), ['github', 'hub', 'opened']);
  st = F.setHub(st, { savedAt: true }, NOW);
  assert.deepEqual(hubDone(st), HUB_KEYS);
  // the next is still the first not done of all twelve: here the eight come first
  assert.equal(F.path(st, deck, NOW).find((m) => m.next).key, 'sort');
  st = F.markSeen(st, 'path:saved');
  assert.equal(F.path(st, deck, NOW).find((m) => m.key === 'saved').announced, true);
  // clearing the user undoes the first step
  assert.deepEqual(hubDone(F.setHub(st, { user: null }, NOW)), ['hub', 'saved', 'opened']);
  // the example taste has no hub: six of twelve done, the seed next, no hub milestone done
  const ex = F.exampleState(deck, NOW);
  const pe = F.path(ex, deck, NOW);
  assert.equal(pe.filter((m) => m.done).length, 6);
  assert.equal(pe.find((m) => m.next).key, 'seed');
  assert.ok(pe.slice(8).every((m) => !m.done && !m.next && !m.announced));
  assert.equal(ex.hub, undefined);
});

test('exportSeed: kept works carry their Artsy image and page; passed works do not; the hub never goes in', () => {
  const ex = F.exampleState(deck, NOW);
  const seed = F.exportSeed(ex, deck, NOW);
  const byWork = new Map(deck.cards.map((c) => [c.work, c]));
  assert.ok(seed.kept.length > 10);
  for (const k of seed.kept) {
    const c = byWork.get(k.work);
    assert.deepEqual(Object.keys(k), ['work', 'kind', 'ms', 'image', 'url']);
    assert.equal(k.image, c.cdn);
    assert.equal(k.url, c.url);
    assert.match(k.image, /^https:\/\/images\.example\.org\/fixture\//);
    assert.match(k.url, /^https:\/\/www\.artsy\.net\/artwork\//);
  }
  for (const k of seed.passed) assert.deepEqual(Object.keys(k), ['work', 'kind']);
  // a deck without image addresses gives null, not a made-up address
  const bare = { ...deck, cards: deck.cards.map(({ cdn, ...c }) => c) };
  const s0 = F.exportSeed(ex, bare, NOW);
  assert.ok(s0.kept.every((k) => k.image === null && /^https:\/\/www\.artsy\.net\//.test(k.url)));
  // with a hub set (a GitHub username, a hub name), the seed is exactly the same
  const withHub = F.setHub(F.markSeen(ex, 'hub-opened'), { user: 'secret-handle', name: 'secret-handle.github.io', madeAt: true, savedAt: true }, NOW);
  const s1 = F.exportSeed(withHub, deck, NOW);
  assert.deepEqual(s1, seed);
  assert.ok(!JSON.stringify(s1).includes('secret-handle'));
});

// --------------------------------------------------------------- a brought thing's definition (Links out and in)

test('bring keeps a definition: the optional fields, tidied, only when given', () => {
  const item = {
    id: 'ydef', kind: 'object', name: 'Equivocal rug', source: 'Artsy', colours: ['#c8a24a'],
    link: 'https://www.artsy.net/artwork/josef-albers-equivocal-rug', image: 'https://cdn.example.org/rug.jpg', thumb: 'https://cdn.example.org/rug-t.jpg',
    maker: '  Josef\nAlbers ', date: 'c. 1960–65', year: '1960', medium: 'Wool, hand-knotted', place: 'Germany', about: 'A wool rug\twoven after a painting',
    category: 'Design/Decorative Art', era: '1945–69', genes: ['geometric', 'geometric', 'Not A Slug', 'hard-edge'], materials: ['Wool', 'wool', ' Linen '],
    coloursEstimated: true, definedBy: 'claude', confidence: 'high', recognised: true, polluted: 'x',
  };
  const st = F.bring(F.newState(), deepFreeze(JSON.parse(JSON.stringify(item))), NOW);
  assert.deepEqual(st.own[0], {
    id: 'ydef', kind: 'object', name: 'Equivocal rug', source: 'Artsy', colours: ['#c8a24a'], crop: null, texture: null, w: null, h: null,
    at: S(NOW), let: null, seenAt: null,
    link: 'https://www.artsy.net/artwork/josef-albers-equivocal-rug', image: 'https://cdn.example.org/rug.jpg', thumb: 'https://cdn.example.org/rug-t.jpg',
    maker: 'Josef Albers', date: 'c. 1960–65', year: '1960', medium: 'Wool, hand-knotted', place: 'Germany', about: 'A wool rug woven after a painting',
    category: 'Design/Decorative Art', era: '1945–69', genes: ['geometric', 'hard-edge'], materials: ['wool', 'linen'], coloursEstimated: true, definedBy: 'claude',
  });
  assert.equal(F.checkOwnFields(st.own[0]), '');
  // limits: text cut to its length, lists to their count; wrong kinds ignored
  const long = F.bring(F.newState(), {
    id: 'ylong', kind: 'image', maker: 'm'.repeat(300), medium: 'x'.repeat(500), about: 'a'.repeat(500), place: 'p'.repeat(100), date: 'd'.repeat(50),
    year: 'around nineteen sixty', era: '1960s', genes: Array.from({ length: 20 }, (_, i) => 'g' + i), materials: Array.from({ length: 12 }, (_, i) => 'm' + i + 'y'.repeat(60)),
    link: 'http://example.com/x', image: 'javascript:alert(1)', thumb: 'https://user:pw@example.com/x', definedBy: 'robot', coloursEstimated: 'yes',
  }, NOW).own[0];
  assert.deepEqual([long.maker.length, long.medium.length, long.about.length, long.place.length, long.date.length], [120, 200, 200, 60, 40]);
  assert.equal(long.genes.length, 12);
  assert.ok(long.materials.length === 8 && long.materials.every((m) => m.length === 40));
  for (const k of ['year', 'era', 'link', 'image', 'thumb', 'definedBy', 'coloursEstimated']) assert.ok(!(k in long), k);
  assert.equal(F.checkOwnFields(long), '');
  // with the deck: category, era and genes must be the deck's own words
  const d = F.bring(F.newState(), { id: 'yd', kind: 'object', category: 'Textile Arts', era: '1945–69', genes: ['geometric', 'pop-art'] }, NOW, deck).own[0];
  assert.ok(!('category' in d));
  assert.equal(d.era, '1945–69');
  assert.deepEqual(d.genes, ['geometric']);
  assert.equal(F.bring(F.newState(), { id: 'ye', kind: 'object', category: 'Painting' }, NOW, deck).own[0].category, 'Painting');
});

test('bring updates a definition: the person edits it, clears a field, leaves the rest', () => {
  let st = F.bring(F.newState(), { id: 'ydef', kind: 'object', name: 'Rug', maker: 'Josef Albers', date: '1960', genes: ['geometric'], materials: ['wool'],
    coloursEstimated: true, colours: ['#aa5533'], definedBy: 'claude' }, NOW);
  st = F.bring(st, { id: 'ydef', maker: 'Anni Albers', date: null, genes: [], coloursEstimated: false, definedBy: 'person' }, NOW + 1000);
  const o = st.own[0];
  assert.deepEqual([o.name, o.maker, o.materials, o.definedBy, o.at], ['Rug', 'Anni Albers', ['wool'], 'person', S(NOW)]);
  for (const k of ['date', 'genes', 'coloursEstimated']) assert.ok(!(k in o), k + ' cleared');
  // a value of the wrong kind changes nothing
  const same = F.bring(st, { id: 'ydef', maker: { x: 1 }, genes: 'geometric', materials: 7, definedBy: 'robot' }, NOW + 2000).own[0];
  assert.deepEqual([same.maker, same.materials, same.definedBy, same.genes], ['Anni Albers', ['wool'], 'person', undefined]);
  // migrate keeps a defined thing as it is
  assert.deepEqual(F.migrate(JSON.parse(JSON.stringify(st))).own[0], o);
});

test('a defined thing feeds the taste model as a judged deck card does; an undefined one as before', () => {
  const plain = F.card(F.bring(F.newState(), { id: 'yp', kind: 'object', colours: ['#aa5533'] }, NOW), deck, 'yp');
  assert.deepEqual([plain.materials, plain.genes, plain.era, plain.place, plain.category, plain.maker, plain.link, plain.definedBy, plain.coloursEstimated],
    [[], [], null, null, null, null, null, null, false]);
  const pf = Object.keys(F.features(plain));
  assert.ok(pf.includes('kind:object') && pf.includes('hue:orange'));
  assert.deepEqual(pf.filter((k) => /^(?:gene|cat|era|place|mat):/.test(k)), [], 'colour and kind only, as before');
  // the same thing, defined like card o002 (geometric, hard-edge, minimalism)
  const o2 = byId.get('o002');
  let st = F.bring(F.newState(), { id: 'yg', kind: 'object', name: 'Like o002', colours: o2.colours, category: o2.category, era: o2.era, place: o2.place,
    genes: o2.genes, materials: o2.materials, date: o2.date, maker: 'Someone', definedBy: 'claude' }, NOW, deck);
  const c = F.card(st, deck, 'yg');
  assert.deepEqual([c.title, c.artist, c.maker, c.year, c.date], ['Like o002', 'You', 'Someone', 2005, '2005']);
  const fo = F.features(c), fd = F.features(o2);
  for (const k of Object.keys(fd)) assert.equal(fo[k], fd[k], k);
  const m = F.model(st, deck);
  for (const g of o2.genes) assert.deepEqual(m.f['gene:' + g], { k: 1, n: 1 }, g);
  assert.deepEqual(m.f['cat:' + o2.category], { k: 1, n: 1 });
  // and it moves a prediction: a geometric deck card scores higher than it does without the thing
  const base = judgeAll(F.newState(), warmCoolTwenty()).state;
  const withThing = F.bring(base, { id: 'yg2', kind: 'object', colours: o2.colours, genes: o2.genes, materials: o2.materials, definedBy: 'claude' }, NOW, deck);
  const plainThing = F.bring(base, { id: 'yg2', kind: 'object', colours: o2.colours }, NOW, deck);
  assert.ok(F.predict(F.model(withThing, deck), byId.get('o004')).p > F.predict(F.model(plainThing, deck), byId.get('o004')).p);
  assert.equal(F.profile(withThing, deck, NOW).defined, 1);
  assert.equal(F.profile(plainThing, deck, NOW).defined, 0);
  assert.equal(F.profile(F.newState(), deck, NOW).defined, 0);
});

test('checkOwnFields: refuses a definition of the wrong kind, plainly', () => {
  assert.equal(F.checkOwnFields({}), '');
  assert.equal(F.checkOwnFields({ id: 'y1', kind: 'image', name: 'x' }), '', 'an old brought thing');
  const bad = [
    [{ link: 'http://example.com' }, /link/], [{ image: 'x'.repeat(10) }, /image/], [{ maker: 'a\nb' }, /maker/], [{ maker: 'm'.repeat(121) }, /maker/],
    [{ about: 5 }, /about/], [{ year: 'x'.repeat(11) }, /year/], [{ era: '1960s' }, /era/], [{ genes: ['Not A Slug'] }, /genes/],
    [{ genes: Array(13).fill('a') }, /genes/], [{ materials: 'wool' }, /materials/], [{ materials: ['x'.repeat(41)] }, /materials/],
    [{ coloursEstimated: 'yes' }, /coloursEstimated/], [{ definedBy: 'robot' }, /definedBy/], [{ category: 'c'.repeat(61) }, /category/],
  ];
  for (const [o, re] of bad) assert.match(F.checkOwnFields(o), re, JSON.stringify(o).slice(0, 40));
  assert.equal(F.checkOwnFields(null), 'is not an object');
  assert.deepEqual(F.DEFINED_BY, ['page', 'claude', 'address', 'person']);
  assert.ok(Object.isFrozen(F.OWN_LIMITS));
});

test('exportSeed: a defined thing says what it is and where it lives, and nothing else of the person\'s', () => {
  const base = judgeAll(F.newState(), warmCoolTwenty()).state;
  let st = F.bring(base, { id: 'ydef', kind: 'object', name: 'Equivocal rug', source: 'Artsy', colours: ['#c8a24a', '#7a5a2a'],
    link: 'https://www.artsy.net:8443/artwork/equivocal-rug?utm_source=ig&fbclid=x&email=me%40mail.com&session=abc&id=7#access_token=t',
    image: 'https://cdn.example.org/rug.jpg', thumb: 'https://cdn.example.org/rug-t.jpg', maker: 'Josef Albers', date: '1960', year: '1960', medium: 'Wool',
    place: 'Germany', about: 'A wool rug', category: 'Design/Decorative Art', era: '1945–69', genes: ['geometric'], materials: ['wool'],
    coloursEstimated: true, definedBy: 'claude' }, NOW - 5000, deck);
  assert.ok(!('link' in F.bring(st, { id: 'ycred', kind: 'image', link: 'https://me:pw@www.artsy.net/artwork/x' }, NOW).own.at(-1)), 'a user name and password are never kept');
  st = F.bring(st, { id: 'ytok', kind: 'image', name: 'A video', source: 'TikTok', link: 'https://www.tiktok.com/@me/video/7300000000000000000' }, NOW - 4000);
  st = F.bring(st, { id: 'ymine', kind: 'image', name: 'My window', source: 'Your photos', colours: ['#336699'] }, NOW - 3000);
  const seed = F.exportSeed(st, deck, NOW);
  assert.deepEqual(seed.own[0], { name: 'Equivocal rug', kind: 'object', source: 'Artsy', colours: ['#c8a24a', '#7a5a2a'], let: false,
    maker: 'Josef Albers', date: '1960', medium: 'Wool', place: 'Germany', about: 'A wool rug', category: 'Design/Decorative Art', era: '1945–69',
    genes: ['geometric'], materials: ['wool'], coloursEstimated: true, link: 'https://www.artsy.net/artwork/equivocal-rug?id=7' });
  assert.deepEqual(seed.own[1], { name: 'A video', kind: 'image', source: 'TikTok', colours: [], let: false }, 'an address naming an @account stays out');
  assert.deepEqual(seed.own[2], { name: 'My window', kind: 'image', source: 'Your photos', colours: ['#336699'], let: false }, 'as it always was');
  const text = JSON.stringify(seed), ownText = JSON.stringify(seed.own);
  for (const no of ['ydef', 'ytok', 'ymine', 'cdn.example.org', 'utm_', 'fbclid', 'mail.com', 'session', 'access_token', 'me:pw', '8443', '"definedBy":', '"cid":', '"id":']) {
    assert.ok(!text.includes(no), no);
  }
  for (const no of ['"image":', '"thumb":', '"url":']) assert.ok(!ownText.includes(no), no);
  // a definition never changes the seed code (the same judgments, the same code and ground)
  const undefinedSt = F.bring(base, { id: 'ydef', kind: 'object', name: 'Equivocal rug', source: 'Artsy', colours: ['#c8a24a', '#7a5a2a'] }, NOW - 5000);
  assert.equal(F.seedCode(F.bring(F.bring(undefinedSt, { id: 'ytok', kind: 'image', name: 'A video', source: 'TikTok' }, NOW - 4000),
    { id: 'ymine', kind: 'image', name: 'My window', source: 'Your photos', colours: ['#336699'] }, NOW - 3000)), seed.code);
  // the example taste's seed is unchanged in shape: brought things carry only their five fields
  const ex = F.exportSeed(F.exampleState(deck, NOW), deck, NOW);
  assert.ok(ex.own.every((o) => Object.keys(o).join() === 'name,kind,source,colours,let'));
});

// The artist's Architectural Authority bookmarks: deck cards that say their source (synthetic here, as the fixture is).
test('Sources: deck cards counted by their source; a card with no source counts as Artsy', () => {
  const bld = (cid, from) => ({ ...byId.get(from), id: cid, work: 'fixture-building', source: 'Architectural Authority',
    url: 'https://www.thearchitecturalauthority.com/article/fixture-building' });
  const d = { ...deck, cards: deck.cards.concat([bld('b001', 's001'), bld('m001', 'u001')]) };
  const st = judgeAll(F.newState(), [['i001', true], ['b001', true], ['m001', true], ['o001', false]], NOW - 3600000, d).state;
  assert.deepEqual(F.profile(st, d, NOW).sources, [
    { source: "The artist's database (Artsy)", n: 1 }, { source: "The artist's bookmarks (Architectural Authority)", n: 2 }]);
  assert.equal(F.deckSource(byId.get('i001')), F.DECK_SOURCES.Artsy, 'the fixture says no source: Artsy');
  assert.deepEqual({ ...F.deckSource(d.cards.at(-1)) }, { site: 'The Architectural Authority', maker: 'Architect', sources: "The artist's bookmarks (Architectural Authority)" });
  assert.deepEqual({ ...F.deckSource({ source: 'Artsy' }) }, { site: 'Artsy', maker: 'Artist', sources: F.DECK_SOURCE });
  for (const odd of [null, {}, { source: 'constructor' }, { source: 'Elsewhere' }]) assert.equal(F.deckSource(odd), F.DECK_SOURCES.Artsy);
  // the seed names a bookmark by its slug and carries its own page
  const seed = F.exportSeed(st, d, NOW);
  assert.deepEqual(seed.kept.filter((k) => k.work === 'fixture-building').map((k) => k.kind + ' ' + k.url).sort(),
    ['space', 'surface'].map((k) => k + ' https://www.thearchitecturalauthority.com/article/fixture-building'));
});

// Set's game (SPEC "Set: the board and the game", "Data"): its state fields, added by the engine.
test('Set\'s game: old states gain its fields, removeOwn drops its pairs, a five sorted gives one Pass a day, the caps fit the store', () => {
  const old = F.migrate({ v: 1, j: [['i001', 1, 900, S(NOW), 0]], opts: { ring: false } });
  assert.deepEqual([old.assoc, old.paintings, old.saga.boost, old.saga.plays, old.opts.ring], [[], [], { pass: 1, turn: 1, more: 1 }, 0, false]);
  const odd = F.migrate({ assoc: 'x', saga: [1], paintings: {} });
  assert.deepEqual([odd.assoc, odd.paintings, odd.saga.stars], [[], [], []], 'wrong shapes become the defaults');
  const kept = { stars: [3], best: [9000], boost: { pass: 0, turn: 2, more: 0 }, plays: 4, day: null, time: [41], built: ['b001'] };
  assert.deepEqual(F.migrate({ saga: kept }).saga, kept, 'a saga is kept as it is');
  // A hand-edited state: what the board, the map's HTML and the game would trip on is dropped or defaulted.
  const good = ['i001', 'o001', 2, 1, 5], pic = { at: 1, n: 6, cols: 2, rows: 1, c: 'ff8800------' };
  const bad = F.migrate({
    assoc: [null, 7, ['a'], good, ['i001', 'o002', 'x', 0, 1]],
    paintings: [null, pic, { ...pic, n: '<img>' }, { ...pic, cols: 3000, rows: 3000 }],
    saga: { stars: ['<img>', 2], best: null, boost: 'x', plays: -1, day: '2026-10-22' },
  });
  assert.deepEqual([bad.assoc, bad.paintings], [[good], [pic]]);
  assert.deepEqual(bad.saga, { stars: [1, 2], best: [], boost: { pass: 1, turn: 1, more: 1 }, plays: 0, day: '2026-10-22', time: [], built: [] });
  assert.deepEqual(F.migrate({ saga: {} }).saga, F.newState().saga);
  assert.equal(F.migrate({ saga: { stars: Array(5000).fill(3) } }).saga.stars.length, 999, 'at most 999 levels');

  let st = F.bring(F.newState(), { id: 'yabc12', kind: 'object', name: 'Bowl', source: 'Your photos', colours: ['#aa3311'] }, NOW);
  st = { ...st, assoc: [['i001', 'yabc12', 2, 1, 1], ['i001', 'o001', 1, 0, 1]] };
  assert.deepEqual(F.removeOwn(st, 'yabc12').assoc, [['i001', 'o001', 1, 0, 1]]);
  // Set, inside out: a note on a pair (Note why on a turn) goes with the thing; one on another pair stays
  const pn = { ...st, notes: [{ at: 1, q: 'set', ref: 'pair:i001|yabc12', text: 'a held breath' }, { at: 2, q: 'set', ref: 'pair:i001|o001', text: 'still' }] };
  assert.deepEqual(F.removeOwn(pn, 'yabc12').notes.map((n) => n.ref), ['pair:i001|o001']);

  let s = F.startFive(F.newState(), deck, NOW);
  assert.equal(F.fivePass(s, NOW).saga.boost.pass, 1, 'nothing before the five is sorted');
  for (const cid of s.five.ids) s = F.judge(s, deck, cid, true, 900, NOW).state;
  const p1 = F.fivePass(s, NOW);
  assert.deepEqual([p1.saga.boost, p1.saga.day], [{ pass: 2, turn: 1, more: 1 }, TODAY]);
  assert.equal(F.fivePass(p1, NOW + 60000).saga.boost.pass, 2, 'once a day');
  assert.equal(F.fivePass(p1, NOW + DAY_MS).saga.boost.pass, 3, 'the next day, another');
  assert.equal(F.fivePass({ ...p1, saga: { ...p1.saga, day: null, boost: { pass: 9, turn: 0, more: 0 } } }, NOW).saga.boost.pass, 9, 'at most 9');

  // At their caps (400 pairings of the longest ids the app makes, each said unlike in the last word, 60 words of
  // 24 three-byte characters, 24 nine-by-nine paintings, 999 levels) the game's fields fit beside the most the app
  // lets the rest of the state hold (STATE_MAX).
  const yid = (i) => 'y' + i.toString(36).padStart(5, '0');
  const game = {
    assoc: Array.from({ length: 400 }, (_, i) => [yid(i), yid(i + 400), 99, 1, 1761100000, -1, F.WORD0 + F.WORDS_MAX - 1]),
    saga: { stars: Array(999).fill(3), best: Array(999).fill(9999999), boost: { pass: 9, turn: 9, more: 9 }, plays: 999999, day: TODAY,
      time: Array(999).fill(9999), built: Array(999).fill('y123456789'),   // the clock and the kingdom: a best time and an id a level
      words: Array.from({ length: F.WORDS_MAX }, () => '語'.repeat(F.WORD_LEN)) },   // Set, inside out: the person's words
    paintings: Array.from({ length: 24 }, () => ({ at: 1761100000, n: 999, cols: 9, rows: 9, c: 'f28a3c'.repeat(81) })),
  };
  const bytes = Buffer.byteLength(JSON.stringify(game));
  const max = /const STATE_MAX = (\d+) \* 1024;/.exec(readFileSync(join(here, '..', 'src', 'app.js'), 'utf8'));
  assert.ok(max, 'app.js says STATE_MAX');
  assert.ok(Number(max[1]) * 1024 + bytes <= 256 * 1024, 'STATE_MAX + ' + bytes + ' bytes is over the store\'s 256 KiB');
});

test('Set\'s game: norm holds a hand-edited state to the game\'s caps and the connector\'s shapes', () => {
  const pair = (i) => ['a' + String(i).padStart(4, '0'), 'b', 1, 1, i];
  const pic = { at: 1, n: 6, cols: 2, rows: 1, c: 'ff8800------' };
  const st = F.migrate({
    assoc: Array.from({ length: 5000 }, (_, i) => pair(i)).concat([['o001', 'i001', 1, 0, 1], ['i001', 'o001', 0, 0, 1], ['i001', 'o001', 1, 2, 1]]),
    paintings: [{ ...pic, c: 'f'.repeat(500000) }, { ...pic, c: 'FF8800------' }].concat(Array.from({ length: 200 }, () => pic)),
    saga: { best: [-5, 10], day: 'x'.repeat(10000) },
  });
  assert.deepEqual(st.assoc, Array.from({ length: 400 }, (_, i) => pair(i)), 'at most 400; out of order, n 0 or a heart of 2 is dropped');
  assert.deepEqual(st.paintings, Array(24).fill(pic), 'at most 24; cells that are not six lowercase hex digits each are dropped');
  assert.deepEqual([st.saga.best, st.saga.day], [[0, 10], null]);
});

// The clock and the kingdom (SPEC "Set: the clock and the kingdom", "Data"): additive fields, held to the connector's shapes.
test('Set\'s clock and kingdom: norm caps saga.time and saga.built, drops a wrong opts.clock; removeOwn takes down what a thing built', () => {
  const st = F.migrate({
    saga: { stars: [3, 2, 1], time: [41, -1, 1.5, 10000, '9', 0].concat(Array(2000).fill(7)), built: ['b001', null, 'x'.repeat(11), 7, '<img>', 'o017'].concat(Array(2000).fill('i001')) },
    opts: { ring: true, clock: 7 },
  });
  assert.deepEqual(st.saga.time.slice(0, 6), [41, 0, 0, 0, 0, 0], 'whole seconds 0 to 9999; a wrong one is 0');
  assert.deepEqual(st.saga.built.slice(0, 6), ['b001', null, null, null, null, 'o017'], 'ids of 1 to 10 characters, or null');
  assert.deepEqual([st.saga.time.length, st.saga.built.length], [999, 999], 'at most 999 of each');
  assert.deepEqual(st.opts, { ring: true }, 'a clock that is not 0, 5 or 10 is dropped: it follows the ring again');
  for (const c of [0, 5, 10]) assert.equal(F.migrate({ opts: { clock: c } }).opts.clock, c);
  assert.equal('clock' in F.migrate({ opts: { ring: false } }).opts, false, 'missing stays missing');

  let s = F.bring(F.newState(), { id: 'yabc12', kind: 'object', name: 'Bowl', source: 'Your photos', colours: ['#aa3311'] }, NOW);
  s = { ...s, saga: { ...s.saga, stars: [3, 2, 1], built: ['yabc12', 'b001', 'yabc12'] } };
  assert.deepEqual(F.removeOwn(s, 'yabc12').saga.built, [null, 'b001', null], 'a plain house stands where it was');
  assert.deepEqual(F.removeOwn(s, 'yabc12').saga.stars, [3, 2, 1], 'the levels stay won');
});

// The game "let's play fives" deals (src/game.js), on the fixture deck with a small made-up catalogue: five rounds,
// each round five things together, answered in any order; a round dealt from what was kept and passed before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameDeck, AppEngine as F, at, DAY } from './helpers.mjs';
import { open, answer, thing, kindAt, roundOf, gameOf, mark, KINDS, OF } from '../src/game.js';
import { checkState, LIMITS } from '../src/validate.js';
import { safe, madeLine, MADE } from '../src/lines.js';

const deck = gameDeck();
const NOW = at(2026, 10, 24, 9);

/** Play n answers, a round at a time; rule(id, i) -> keep. order(ids) -> the order a round is answered in. */
function play(rule, st = F.newState(), now = NOW, n = OF, order = (xs) => xs) {
  const log = [];
  while (log.length < n) {
    st = open(st, deck, now).state;
    const start = st.game.ids.length - 5;
    for (const i of order([0, 1, 2, 3, 4].map((k) => start + k))) {
      if (log.length >= n) break;
      const id = st.game.ids[i];
      const r = answer(st, deck, id, rule(id, i), 0, now);
      log.push({ id, i, kind: kindAt(i), from: st.game.from[i] || null });
      st = r.state;
    }
  }
  return { st, log };
}

test('a game is 25 things: five rounds of a picture, a line, a space, a page and a word, dealt five at a time', () => {
  const { st, log } = play(() => true);
  assert.equal(st.game.ids.length, OF);
  assert.deepEqual(st.game.ids.map((id, i) => kindAt(i)), Array.from({ length: 5 }, () => KINDS).flat());
  assert.deepEqual(st.game.ids.filter((id, i) => kindAt(i) === 'picture').map((id) => F.card(st, deck, id).kind), F.KINDS, 'the pictures are Sort\'s five kinds, one a round');
  assert.equal(new Set(st.game.ids).size, OF, 'nothing twice in a game');
  assert.ok(st.game.ids.every((id) => /^[a-z][a-z0-9]{1,24}$/.test(id)), 'every id is one judge takes');
  assert.ok(log.every((x) => thing(st, deck, x.id)), 'every thing is in the catalogue or the deck');
  assert.equal(st.j.length, 10, 'pictures and spaces go into j, as Sort\'s judgments');
  assert.deepEqual([...new Set(Object.keys(st.things).map((id) => id[0]))].sort(), ['l', 'p', 'w'], 'lines, pages and words go into things');
  assert.equal(st.game.k, '1'.repeat(OF));
  assert.equal(st.five, null, 'Sort\'s five is left alone');
});

test('the five of a round come together, answered in any order; the next round waits until all five are answered', () => {
  let st = open(F.newState(), deck, NOW).state;
  assert.equal(st.game.ids.length, 5, 'a whole round at once');
  assert.equal(st.game.k, '-----');
  for (const i of [4, 2, 0, 3]) st = answer(st, deck, st.game.ids[i], i % 2 === 0, 0, NOW).state;
  assert.equal(st.game.k, '1-101', 'each answer in its own place');
  const again = open(st, deck, NOW);
  assert.deepEqual([again.changed, again.state.game.ids.length], [false, 5], 'four of five: the same round is on show');
  st = answer(st, deck, st.game.ids[1], true, 0, NOW).state;
  const next = open(st, deck, NOW);
  assert.deepEqual([next.dealt, next.state.game.ids.length, next.state.game.k.slice(5)], [true, 10, '-----']);
  assert.ok(next.state.game.at >= st.game.at);
});

test('a repeat answer records nothing; only things in the game can be answered', () => {
  let st = open(F.newState(), deck, NOW).state;
  const id = st.game.ids[1];
  st = answer(st, deck, id, true, 0, NOW).state;
  const r = answer(st, deck, id, false, 0, NOW);
  assert.deepEqual([r.repeat, r.kept], [true, true], 'the first answer stands');
  assert.deepEqual(r.state, st, 'nothing changed');
  const other = deck.things.words.find((w) => !st.game.ids.includes(w.id)).id;
  assert.equal(answer(st, deck, other, true, 0, NOW), null, 'a word of the catalogue not in the game');
  assert.equal(answer(st, deck, 'lzz001', true, 0, NOW), null);
});

test('a game waits: another day it goes on where it stopped; a finished game starts the next', () => {
  const { st } = play(() => true, F.newState(), NOW, 7);
  const later = open(st, deck, NOW + 5 * DAY);
  assert.deepEqual([later.started, later.changed, later.state.game.k], [false, false, st.game.k]);
  assert.equal(later.state.game.day, F.dayOf(NOW), 'still the game of the day it started');
  const done = play(() => true).st;
  const fresh = open(done, deck, NOW + DAY);
  assert.deepEqual([fresh.started, fresh.state.game.k, fresh.state.game.day], [true, '-----', F.dayOf(NOW + DAY)]);
});

test('the same state and day deal the same game', () => {
  const rule = (id, i) => i % 3 !== 0;
  assert.deepEqual(play(rule).st.game, play(rule).st.game);
});

test('within a round, nothing follows its answers: the round is dealt before any of it is answered', () => {
  const a = play(() => true, F.newState(), NOW, 5).st, b = play(() => false, F.newState(), NOW, 5, (xs) => xs.reverse()).st;
  assert.deepEqual(a.game.ids, b.game.ids);
});

test('inside out: a picture kept in round 1 makes round 2\'s line, safe to paste and made again from its id', () => {
  const { st } = play((id, i) => i === 0, F.newState(), NOW, 5);   // round 1: keep the picture alone
  assert.match(st.game.ids[1], /^l\d{3}$/, 'round 1\'s line is curated: nothing kept before it');
  const s = open(st, deck, NOW).state, line = s.game.ids[6], pic = st.game.ids[0];
  assert.match(line, new RegExp('^l[a-z]{2}' + pic + '$'), 'made from the picture kept');
  assert.equal(s.game.from[6], pic);
  const l = thing(s, deck, line);
  assert.equal(safe(l.line), null, 'safe to paste');
  assert.deepEqual(madeLine(line, (x) => F.card(s, deck, x)), l);
});

test('inside out: a kept word leads to its neighbour, and to a page that holds it, the next round', () => {
  const { st, log } = play((id) => id[0] === 'w');   // keep only words
  const words = log.filter((x) => x.kind === 'word');
  const W = (id) => deck.things.words.find((w) => w.id === id);
  let followed = 0;
  for (let r = 1; r < 5; r++) {
    const prev = words[r - 1].id, open = W(prev).leads.filter((n) => !st.game.ids.slice(0, 5 * r).includes(n));
    if (open.length) { assert.equal(words[r].from, prev, 'round ' + (r + 1) + ': a neighbour of the word kept'); followed++; }
  }
  assert.ok(followed >= 1, 'at least one round followed a kept word');
  const pages = log.filter((x) => x.kind === 'page' && x.from);
  assert.ok(pages.length >= 1, 'a page came from a kept word');
  for (const p of pages) assert.ok(deck.things.pages.find((x) => x.id === p.id).words.includes(p.from), 'its from is a word it holds');
});

test('across games: a word and a page follow what was kept before', () => {
  let s = open({ ...F.newState(), things: { wattention: 1, wcanopy: 1 } }, deck, NOW).state;
  assert.deepEqual([s.game.ids[3], s.game.from[3]], ['p2', 'wcanopy'], 'the page holding a word kept before comes first');
  assert.ok(['wintend', 'wparadise'].includes(s.game.ids[4]) && ['wattention', 'wcanopy'].includes(s.game.from[4]), 'a neighbour of a word kept before');
  s = play(() => false, s, NOW, 5).st;
  assert.equal(open(s, deck, NOW).state.game.ids[8] !== 'p2', true, 'a page is not dealt twice in a game');
});

test('passing everything: lines are curated, and nothing says it came from anything', () => {
  const { st, log } = play(() => false);
  assert.ok(log.filter((x) => x.kind === 'line').every((x) => /^l\d{3}$/.test(x.id)));
  assert.ok(st.game.from.every((x) => x === ''));
});

test('spaces: rooms first while one is left, then one sharing a material with a kept picture', () => {
  const { st } = play(() => true, F.newState(), NOW, 10);
  assert.deepEqual([st.game.ids[2], st.game.ids[7]].sort(), ['s004', 's007'], 'the two rooms, in the first two rounds');
  const third = open(st, deck, NOW).state;
  const sp = F.card(third, deck, third.game.ids[12]), src = third.game.from[12] && F.card(third, deck, third.game.from[12]);
  assert.ok(src && sp.materials.some((m) => src.materials.includes(m)), 'round 3: a space that shares a material with a kept card');
});

test('new players don\'t all meet the same first space', () => {
  const first = new Set(Array.from({ length: 12 }, (_, d) => open(F.newState(), deck, NOW + d * DAY).state.game.ids[2]));
  assert.ok(first.size >= 2, [...first].join(' '));
});

test('a round sorted counts the day once for the streak; four answers do not', () => {
  assert.deepEqual(play(() => true, F.newState(), NOW, 4).st.days, []);
  const { st } = play(() => true, F.newState(), NOW, 10);
  assert.deepEqual(st.days, [F.dayOf(NOW)]);
  assert.equal(F.streak(st, NOW), 1);
});

test('things keeps 1,000 answers: past that the oldest is dropped', () => {
  const t = Object.fromEntries(Array.from({ length: LIMITS.things }, (_, i) => ['wx' + i, 1]));
  const m = mark(t, 'l001', false);
  assert.equal(Object.keys(m).length, LIMITS.things);
  assert.deepEqual([m.wx0, m.wx1, m.l001], [undefined, 1, 0], 'the oldest went; the newest is last');
  assert.deepEqual(Object.keys(mark(m, 'wx1', true)).slice(-1), ['wx1'], 'an answer again moves to the end');
});

test('put_state takes every state a game writes, and refuses a malformed game or things', () => {
  let st = F.newState();
  for (let n = 1; n <= OF; n++) {
    st = play((id, i) => i % 2 === 0, F.newState(), NOW, n).st;
    assert.equal(checkState(st, deck), '', 'after ' + n);
  }
  assert.equal(checkState(open(st, deck, NOW + DAY).state, deck), '', 'a new game');
  const g = { day: '2026-10-24', at: 1, ids: ['i001', 'l001'], k: '1-', from: ['', 'i001'] };
  assert.equal(checkState({ game: g }), '');
  const bad = [
    { ids: 'not a list', k: '' }, { ...g, k: '11-' }, { ...g, k: '1x' }, { ...g, ids: Array(26).fill('i001'), k: '-'.repeat(26), from: Array(26).fill('') },
    { ...g, ids: ['../x', 'l001'] }, { ...g, from: ['<b>', ''] }, { ...g, from: [''] }, { ...g, day: 5 }, [],
  ];
  for (const x of bad) assert.match(checkState({ game: x }), /^state\.game/, JSON.stringify(x));
  for (const t of [{ i001: 1 }, { wattention: 2 }, { '<script>': 'x' }, [], Object.fromEntries(Array.from({ length: LIMITS.things + 1 }, (_, i) => ['w' + i, 1]))]) {
    assert.match(checkState({ things: t }), /^state\.things/);
  }
});

test('an unanswered thing that left the catalogue is dealt again; the answers so far stay', () => {
  let s = open(F.newState(), deck, NOW).state;
  s = answer(s, deck, s.game.ids[0], true, 0, NOW).state;
  const gone = { ...deck, things: { ...deck.things, lines: deck.things.lines.filter((l) => l.id !== s.game.ids[1]) } };
  const o = open(s, gone, NOW);
  assert.equal(o.changed, true);
  assert.notEqual(o.state.game.ids[1], s.game.ids[1]);
  assert.deepEqual([o.state.game.ids.length, o.state.game.k, o.state.game.ids[0]], [5, '1----', s.game.ids[0]]);
});

test('the app: norm keeps the game and things as they are, and Sort deals the same five beside them', () => {
  const { st } = play(() => true, F.newState(), NOW, 8);
  const m = F.migrate(JSON.parse(JSON.stringify(st)));
  assert.deepEqual([m.game, m.things], [st.game, st.things]);
  assert.deepEqual(F.nextFive(st, deck, NOW), F.nextFive({ ...st, game: undefined, things: undefined }, deck, NOW));
});

test('a made line\'s id says how to make it again, and fits judge and put_state', () => {
  const { st } = play(() => true);
  for (const id of st.game.ids.filter((x) => MADE.test(x))) {
    assert.ok(id.length <= 25 && /^[A-Za-z0-9_-]{1,40}$/.test(id), id);
    assert.ok(thing(st, deck, id), id);
  }
  assert.equal(gameOf({ game: { ids: ['i001'], k: '' } }), null, 'a malformed game is no game');
  assert.equal(roundOf(24), 4);
});

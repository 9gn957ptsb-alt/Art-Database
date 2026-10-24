// Tests for src/relate.js (node --test): Set, inside out, on the fixture's synthetic other eyes (never data/5s).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const F = require(join(here, '..', 'src', 'engine.js'));
const MX = require(join(here, '..', 'src', 'match.js'));
const RL = require(join(here, '..', 'src', 'relate.js'));
const deck = JSON.parse(readFileSync(join(here, 'fixture', 'deck.json'), 'utf8'));
const NOW = Date.UTC(2026, 9, 24, 12);
const W = (st, word) => { const a = RL.addWord(st.saga.words, word); st.saga.words = a.words; return a.w; };

// keeps the pictures named (or every second one), and passes the rest; returns a state
function keeping(ids) {
  let st = F.newState(), t = NOW;
  for (const c of deck.cards) { st = F.judge(st, deck, c.id, ids ? ids.includes(c.id) : c.kind !== 'colour' && +c.id.slice(1) % 2 === 1, 900, t).state; t += 60000; }
  return st;
}
const keyOf = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
function playOut(g, T, st, say) {   // plays a level to its end with say(g) -> [x, y, s, w]
  while (g.state === 'play') {
    const [x, y, s, w] = say(g);
    const r = RL.say(g, T, x, y, s, w);
    g = r.game;
    st.assoc = RL.relate(st.assoc, x, y, s, w, Math.floor(NOW / 1000));
  }
  return g;
}

test('table: only kept pictures, one card a work, the fixture\'s other eyes among them', () => {
  const st = keeping();
  const T = RL.table(st, deck, []);
  const kept = new Set(Object.values(F.profile(st, deck).keptByKind).flat());
  assert.ok(T.pool.length >= 6 && T.pool.every((id) => kept.has(id) && !id.startsWith('c')), 'kept pictures, no colours');
  assert.ok(Object.keys(T.look).length > 0 && Object.keys(T.look).every((k) => k.split('|').every((id) => T.pool.includes(id))), 'lookers\' pairs only among kept things');
  assert.deepEqual(T.words.i001, ['a round heart', 'soft curls', 'sunny']);
  assert.deepEqual(RL.table(st, Object.assign({}, deck, { rhymes: undefined }), []).look, {}, 'no deck.rhymes: no lookers');
});

test('level, leads and the deal: kept things only, one card a work, the same seed the same board', () => {
  assert.deepEqual([1, 7, 30, 31, 999].map((n) => RL.level(n).moves), [5, 7, 11, 11, 11].map((x, i) => (i > 2 ? Math.min(11, x) : x)));
  const st = keeping(), T = RL.table(st, deck, []);
  const L = RL.leads(T, 1);
  assert.ok(L.length === 3 && L.every((x) => T.pool.includes(x.id)), 'three ways in');
  assert.equal(L[0].why, 'fresh', 'a newcomer\'s board is led by something kept, not set yet');
  for (let n = 1; n <= 30; n++) {
    const g = RL.newGame(RL.level(n), T, '5s:' + n + ':0');
    assert.deepEqual(RL.newGame(RL.level(n), T, '5s:' + n + ':0'), g, 'same seed, same board');
    assert.equal(g.slots.length, 6);
    assert.equal(new Set(g.used.map((id) => T.work[id])).size, g.used.length, 'one card a work');
    assert.ok(g.slots.every((id) => T.pool.includes(id)));
    assert.equal(g.moves, 5 + g.pile);
  }
  const other = L[1].id, g = RL.newGame(RL.level(3), T, 's', other);
  assert.ok(g.slots.includes(other) && g.lead === other, 'Or start from: the chosen way leads');
  assert.equal(RL.newGame(RL.level(1), RL.table(keeping(['i001', 'i003', 'o001']), deck, []), 's'), null, 'under six: no level, the first board');
});

test('a level: every move a relation, the carried one is set, one stays, the board gets smaller', () => {
  const st = keeping(), T = RL.table(st, deck, []);
  let g = RL.newGame(RL.level(7), T, 'seven');
  const moves = g.moves;
  let shrank = false;
  while (g.state === 'play') {
    const [x, y] = g.slots.filter(Boolean);
    const before = g.slots.filter(Boolean).length, pile = g.pile;
    const r = RL.say(g, T, x, y, 1, 2);
    assert.ok(!r.game.slots.includes(x) && r.game.slots.includes(y), 'x is set, y stays');
    assert.ok(r.answer && typeof r.answer.line === 'string' && !/wrong|miss/i.test(r.answer.line), 'every pairing is answered, never wrong');
    if (pile > 0) assert.ok(r.arrival && T.pool.includes(r.arrival.id) && r.game.slots[r.arrival.place] === r.arrival.id);
    else { assert.equal(r.arrival, null); assert.equal(r.game.slots.filter(Boolean).length, before - 1); shrank = true; }
    g = r.game;
  }
  assert.ok(shrank);
  assert.equal(g.made.length, moves);
  const res = RL.result(g, T);
  assert.equal(res.won, true);
  assert.equal(res.stayed, g.slots.filter(Boolean)[0]);
  assert.deepEqual(res.groups[0].ids, [g.made[g.made.length - 1].x, g.made[g.made.length - 1].y], 'groups newest first');
  const rec = MX.recordLevel({}, Object.assign({}, res, { n: 1, secs: 20, clock: 35 }));   // a first level: the saga records it
  assert.deepEqual([rec.saga.stars, rec.inTime], [[res.stars], true]);
  assert.equal(RL.ways(st, deck, res, null)[0], res.stayed, 'a first win builds what stayed');
  assert.deepEqual(RL.ways(st, deck, res, 'i009').slice(0, 2), ['i009', res.stayed], 'a replay keeps its building first');
  assert.deepEqual([RL.saidText([], {}, 1, 2), RL.saidText(['a held breath'], {}, -1, 10), RL.saidText(['sunny'], T.aspectOf, 1, 10), RL.saidText([], {}, -1, 0)],
    ['Alike in line.', 'Unlike: ‘a held breath’.', 'Alike: sunny.', 'Unlike.']);
});

test('the answers: the person first, then other eyes; again, turn, shared, apart, agree, yours, first, brought', () => {
  const st = keeping(), T = RL.table(st, deck, []);
  const A = (x, y, s, w, g) => RL.answer(T, g || null, x, y, s, w);
  assert.equal(A('i001', 's001', 1, 0).kind, 'shared');
  assert.match(A('i001', 's001', 1, 0).line, /^Someone else put these two together too: a round heart, soft curls · sunny\.$/);
  assert.equal(A('i001', 's001', -1, 0).kind, 'apart');
  assert.match(A('i001', 's001', -1, 0).line, /You see them apart\.$/);
  assert.deepEqual([A('i001', 'i003', 1, 0).kind, A('i001', 'i003', -1, 0).kind], ['agree', 'yours'], 'both warm: alike agrees, unlike is your own eye');
  assert.deepEqual([A('i001', 'i003', 1, 3).kind], ['first'], 'in light: neither has a word for light');
  // said before, this level: the same way holds, the other way is a turn
  const g = { made: [{ x: 'i001', y: 'i003', s: 1, w: 2 }] };
  assert.equal(A('i003', 'i001', 1, 0, g).kind, 'again');
  assert.deepEqual(A('i003', 'i001', -1, 0, g), { kind: 'turn', line: 'A turn. Last time you saw them alike in line.' });
  // said before, saved on the pairing
  st.assoc = RL.relate(st.assoc, 'i001', 'i003', -1, W(st, 'a held breath'), 100);
  assert.equal(RL.answer(RL.table(st, deck, []), null, 'i001', 'i003', 1, 0).line, 'A turn. Last time you saw them unlike: ‘a held breath’.');
});

test('no stars: a set board is a won level; its building is as tall as its thing\'s relations; a turn is noticed, never rewarded', () => {
  const st = F.migrate(keeping()), T = RL.table(st, deck, []);
  const g0 = RL.newGame(RL.level(1), T, 'one');
  assert.deepEqual([RL.result(g0, T).won, RL.result(g0, T).stars], [false, 0], 'not set yet: not won');
  const done = playOut(g0, T, st, (g) => { const [x, y] = g.slots.filter(Boolean); return [x, y, T.look[keyOf(x, y)] ? -1 : 1, 0]; });
  const res = RL.result(done, T);
  assert.deepEqual([res.won, res.stars], [true, 1], 'the board set: won; the marker is 1 whatever was said');
  // a turn (and seeing it otherwise than others) is noticed in words and earns nothing
  const g = { n: 1, state: 'done', slots: ['i001', null], used: [], made: [{ x: 'a', y: 'b', s: 1, w: 0, kind: 'yours', line: 'x' }, { x: 'c', y: 'b', s: -1, w: 2, kind: 'turn', line: 'A turn. Last time you saw them alike in line.' }] };
  const rt = RL.result(g, T);
  assert.deepEqual([rt.stars, rt.made[1].kind, rt.made[1].line], [1, 'turn', 'A turn. Last time you saw them alike in line.']);
  // the saga keeps a won level's marker; an old higher value stands; boosters are earned only as v12 earns them without stars
  const old = { stars: [3, 2], best: [9000, 6000], boost: { pass: 2, turn: 0, more: 4 }, plays: 7, day: null, time: [0, 40], built: ['i001', null] };
  const replay = MX.recordLevel(old, Object.assign({}, res, { n: 1, secs: 99, clock: 25 })).saga;
  assert.deepEqual([replay.stars, replay.best, replay.time, replay.built, replay.boost], [[3, 2], [9000, 6000], [0, 40], ['i001', null], old.boost], 'a replay changes nothing it had');
  const third = MX.recordLevel(old, Object.assign({}, res, { n: 3, secs: 20, clock: 35 }));
  assert.deepEqual([third.saga.stars, third.inTime, third.earned], [[3, 2, 1], true, { pass: 0, turn: 0, more: 0 }]);
  // storeys: the relations the built thing has gathered (v12 pairings are not relations), 1 to 3; old buildings keep theirs
  const [p, q, r, s] = T.pool;
  let S = F.migrate(Object.assign({}, st, { assoc: [], saga: Object.assign({}, st.saga, { stars: [3, 1, 1], built: [p, q, null] }) }));
  S.assoc = MX.addAssociations(S.assoc, [q, s], 10);   // a v12 pairing
  assert.deepEqual([1, 2, 3].map((n) => RL.storeys(S, n)), [3, 1, 1], 'old heights stand; no relations yet: one storey');
  S.assoc = RL.relate(S.assoc, q, r, 1, 2, 11);
  S.assoc = RL.relate(S.assoc, s, q, -1, 0, 12);
  assert.equal(RL.storeys(S, 2), 2, 'two relations: two storeys');
  for (const x of T.pool.slice(4, 8)) S.assoc = RL.relate(S.assoc, q, x, 1, 0, 13);
  assert.equal(RL.storeys(S, 2), 3, 'at most three');
  assert.deepEqual([RL.storeys(S, 3, q), RL.storeys(S, 3, null), RL.storeys(S, 9)], [3, 1, 1], 'another way: its own thing; a plain house: one');
  assert.equal(RL.storeys(st, 1, res.stayed), Math.min(3, st.assoc.filter((e) => e.length === 7 && e.includes(res.stayed)).length), 'what stayed: its relations');
});

test('what arrives follows from what was said, and leans to the person as their relations grow', () => {
  const st = keeping(), T0 = RL.table(st, deck, []);
  let g = RL.newGame(RL.level(2), T0, 'grow');   // Sort's area: extend, extend, test; level 2 has one to come in
  const [x, y] = g.slots.filter(Boolean);
  const r = RL.say(g, T0, x, y, 1, 2);
  assert.equal(r.arrival.mode, 'extend');
  assert.ok(r.arrival.line === null || /^Here (because|to test)/.test(r.arrival.line));
  assert.ok([null, 'Here because of what you just said.', 'Here because it is not set yet.'].includes(r.arrival.line));
  // a person with many relations of their own: more of the deal is theirs
  const many = F.migrate(st), T = RL.table(many, deck, []);
  for (let i = 0; i + 1 < T.pool.length; i++) for (let j = i + 1; j < Math.min(T.pool.length, i + 4); j++) many.assoc = RL.relate(many.assoc, T.pool[i], T.pool[j], (i + j) % 2 ? 1 : -1, 2, 100 + i);
  const share = (S) => { const T = RL.table(S, deck, []); let own = 0, oth = 0; for (let k = 0; k < 40; k++) { const g = RL.newGame(RL.level(3), T, 'm' + k); for (const id in g.by) { if (g.by[id] === 'own') own++; if (g.by[id] === 'others') oth++; } } return own / (own + oth || 1); };
  assert.ok(share(many) > share(st) + 0.3, 'own relations take over the deal');
});

test('relate, words and the connector\'s shapes: relations ride on the pairing; norm keeps them; v12 pairings stay', () => {
  const st = keeping();
  st.assoc = [['i001', 'o001', 3, 1, 50]];   // a v12 pairing, hearted
  const w = W(st, '  a held   breath ');
  assert.deepEqual([w, st.saga.words], [10, ['a held breath']], 'trimmed, spaces folded');
  assert.equal(RL.addWord(st.saga.words, 'A HELD BREATH').w, 10, 'the same word again');
  assert.equal(RL.addWord(st.saga.words, '\u0007').w, null);
  assert.equal(RL.addWord(Array.from({ length: 60 }, (_, i) => 'w' + i), 'one more').w, null, 'sixty words: no more');
  assert.equal(RL.addWord([], 'x'.repeat(40)).words[0].length, 24);
  assert.deepEqual(RL.addWord([], 'x'.repeat(23) + ' tail').words, ['x'.repeat(23)], 'cut at 24: no space at the end (norm would make it "?")');
  assert.deepEqual(RL.addWord([], 'x'.repeat(23) + '\u{1F600}').words, ['x'.repeat(23)], 'cut at 24: no half a character');
  assert.deepEqual(RL.addWord([], 'a\ud800b').words, ['ab'], 'no lone half of a character');
  st.assoc = RL.relate(st.assoc, 'o001', 'i001', -1, w, 200);
  st.assoc = RL.relate(st.assoc, 'i003', 'i001', 1, 2, 201);
  assert.deepEqual(st.assoc, [['i001', 'o001', 4, 1, 200, -1, 10], ['i001', 'i003', 1, 0, 201, 1, 2]]);
  const back = F.migrate(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back.assoc, st.assoc, 'norm keeps relations');
  assert.deepEqual(MX.heart(back.assoc, ['i001', 'i003'], true)[1], ['i001', 'i003', 1, 1, 201, 1, 2], 'heart keeps the relation');
  assert.deepEqual(MX.addAssociations(back.assoc, ['i001', 'i003'], 300)[1], ['i001', 'i003', 2, 0, 300, 1, 2], 'a v12 pairing call keeps it');
  assert.equal(RL.wordOf(back.saga.words, 10), 'a held breath');
  assert.equal(RL.wordOf(back.saga.words, 3), 'light');
  const bad = F.migrate({ assoc: [['a', 'b', 1, 0, 1, 2, 0], ['a', 'b', 1, 0, 1, 1, 7], ['a', 'b', 1, 0, 1, 1], ['a', 'b', 1, 0, 1, -1, 69], ['a b', 'c', 1, 0, 1], [1, 'c', 1, 0, 1]], saga: { words: ['ok', '', 5, 'x\udc00'] } });
  assert.deepEqual(bad.assoc, [['a', 'b', 1, 0, 1, -1, 69]], 'ids as put_state takes them');
  assert.deepEqual(bad.saga.words, ['ok', '?', '?', '?'], 'a bad word keeps its place');
  assert.equal('words' in F.migrate({ saga: { stars: [3] } }).saga, false, 'an old saga is kept as it is');
});

test('back into Sort: ask follows the latest relations, one slot of the next five, nothing without relations', () => {
  let st = F.newState();
  for (const id of ['i001', 'i003', 'i005', 'o003', 's005', 'u003', 'u005']) st = F.judge(st, deck, id, true, 900, NOW).state;   // the rest never judged
  assert.deepEqual(RL.ask(st, deck), [], 'no relations: no ask');
  const five0 = F.nextFive(st, deck, NOW);
  st.assoc = RL.relate(st.assoc, 'i003', 'i005', 1, 2, 300);
  const ask = RL.ask(st, deck);
  assert.ok(ask.length && ask[0].with && !st.j.some((e) => e[0] === ask[0].id), 'never judged');
  assert.ok(['s003', 'o005'].includes(ask[0].id) || ask[0].word, 'the lookers\' partner of a thing just related');
  const five = F.nextFive(st, deck, NOW, ask);
  assert.equal(five.filter((id) => !five0.includes(id)).length <= 1, true, 'one slot changes at most');
  assert.ok(five.includes(ask[0].id) || five.includes(ask[1] && ask[1].id));
  assert.deepEqual(F.nextFive(st, deck, NOW), five0, 'without ask, the five is as before');
  assert.equal(new Set(five.map((id) => deck.cards.find((c) => c.id === id).kind)).size, 5, 'still one of each kind');
  const w = RL.why(st, deck, 's003');
  assert.deepEqual(w, { with: 'i003', line: 'a round heart, soft curls · sunny' });
});

test('the kingdom from what they related: storeys, ties between buildings, island lines in their words, the mist', () => {
  const st = F.migrate(keeping()), T = RL.table(st, deck, []), [a, b, c, d, e, q, r] = T.pool;
  st.saga = Object.assign({}, st.saga, { stars: [3, 1, 1, 1, 1, 1], built: [a, b, null, c, d, e] });
  const none = RL.kingdom(st, deck, []), standing = new Set([a, b, c, d, e]), unbuilt = T.pool.filter((id) => !standing.has(id));
  assert.deepEqual(none, { storeys: [3, 1, 1, 1, 1, 1], ties: [], said: {}, mist: { n: unbuilt.length, ids: unbuilt.slice(0, 3) } }, 'no relations: old heights, nothing tied, all but the buildings in the mist');
  st.assoc = MX.addAssociations(st.assoc, [a, c], 5);   // a v12 pairing: not a relation
  st.assoc = RL.relate(st.assoc, b, c, 1, 2, 10);
  st.assoc = RL.relate(st.assoc, d, a, -1, 0, 11);
  st.assoc = RL.relate(st.assoc, b, q, 1, 2, 12);
  st.assoc = RL.relate(st.assoc, e, r, -1, RL.addWord(st.saga.words, 'a held breath').w, 13);
  st.saga.words = ['a held breath'];
  const K = RL.kingdom(st, deck, []);
  assert.deepEqual(K.storeys, [3, 2, 1, 1, 1, 1], 'level 2: two relations; old level 1 keeps three; a plain house, one');
  assert.deepEqual(K.ties, [[1, 5, -1], [2, 4, 1]], 'plot to plot: unlike, alike');
  assert.deepEqual(K.said, { 0: 'Mostly alike in line', 1: 'Mostly unlike: ‘a held breath’' });
  const set = new Set([a, b, c, d, e, q, r]);
  assert.deepEqual(K.mist, { n: T.pool.length - set.size, ids: T.pool.filter((id) => !set.has(id)).slice(0, 3) }, 'what is not set yet');
  assert.deepEqual(K.storeys, [1, 2, 3, 4, 5, 6].map((n) => RL.storeys(st, n)), 'the same rule as storeys');
});

// v12 built in the shape game, with five-long pairings only: its buildings are set, though not related.
test('a v12 saga\'s buildings are set: out of the mist, and never a way in "not set yet"', () => {
  const st = F.migrate(keeping()), T0 = RL.table(st, deck, []), [a, b] = T0.pool;   // the newest kept, built
  st.assoc = MX.addAssociations(st.assoc, [a, b], 5);
  st.saga = Object.assign({}, st.saga, { stars: [3, 2], best: [9000, 6000], time: [0, 0], built: [a, b] });
  const rest = T0.pool.filter((id) => id !== a && id !== b);
  assert.deepEqual(RL.kingdom(st, deck, []).mist, { n: rest.length, ids: rest.slice(0, 3) }, 'what stands is not under the mist');
  const T = RL.table(st, deck, []), fresh = (id, why) => (id === a || id === b) && why === 'fresh';
  for (const n of [1, 2, 3]) assert.ok(!RL.leads(T, n).some((l) => fresh(l.id, l.why)), 'level ' + n + ': no building is "Kept, not set yet."');
});

test('Sort from Set: one card a five, named in five.ask; without pairings made in Set every five is as before', () => {
  let st = F.newState(), t = NOW;
  for (const c of deck.cards.filter((x) => x.kind !== 'colour').slice(0, 14)) { st = F.judge(st, deck, c.id, +c.id.slice(1) % 2 === 1, 900, t).state; t += 60000; }   // past the first ten: match slots
  const sortFives = (S, rounds, each) => {
    for (let k = 0; k < rounds; k++) {
      const ask = RL.ask(S, deck), a = F.startFive(S, deck, t, ask), b = F.startFive(S, deck, t);
      each(a, b, ask, S);
      S = a;
      for (const id of a.five.ids) { S = F.judge(S, deck, id, true, 900, t).state; t += 60000; }
    }
  };
  // the shape game's pairings (v12, five long) are not Set's: every five exactly as before, none named
  const v12 = Object.assign({}, st, { assoc: MX.addAssociations(MX.addAssociations([], ['i001', 'i003'], 100), ['i003', 'o003'], 101) });
  sortFives(v12, 5, (a, b, ask) => { assert.deepEqual(ask, []); assert.deepEqual(a, b); assert.equal('ask' in a.five, false); });
  // relations made in Set: at most one card of each five differs, and five.ask names the one that came from Set
  const set = Object.assign({}, st, { assoc: RL.relate(RL.relate([], 'i001', 'i003', 1, 2, 100), 'i003', 'i005', -1, 0, 101) });
  let named = 0;
  sortFives(set, 5, (a, b, ask, S) => {
    const diff = a.five.ids.filter((id) => !b.five.ids.includes(id));
    assert.ok(diff.length <= 1, 'one card a five');
    if (diff.length) assert.equal(diff[0], a.five.ask, 'the card that changed is the one named');
    if (!a.five.ask) return;
    named++;
    assert.ok(a.five.ids.includes(a.five.ask) && ask.some((x) => x.id === a.five.ask) && !S.j.some((e) => e[0] === a.five.ask), 'from the ask, never judged before');
    assert.ok(RL.why(S, deck, a.five.ask), 'Sort can say why, after the decision');
    assert.equal(F.migrate(JSON.parse(JSON.stringify(a))).five.ask, a.five.ask, 'saved and read back');
  });
  assert.ok(named >= 1, 'Set reached Sort');
  assert.equal('ask' in F.migrate({ five: { ids: ['i001'], ask: 'not an id!' } }).five, false, 'a malformed ask is dropped');
});

test('an old saved state (v12, before Set inside out) loads with nothing lost, and Set plays on it', () => {
  let st = F.newState(), t = NOW;
  for (const c of deck.cards.slice(0, 30)) { st = F.judge(st, deck, c.id, c.kind !== 'colour' && +c.id.slice(1) % 2 === 1, 900, t).state; t += 60000; }
  st = F.bring(st, { id: 'yabc12', kind: 'object', name: 'Bowl', source: 'Your photos', colours: ['#aa3311'] }, t);
  const v12 = JSON.parse(JSON.stringify(Object.assign({}, st, {
    notes: [{ at: 5, q: 'turn', ref: 'i003', text: 'the light' }],
    assoc: [['i001', 'i003', 3, 1, 50], ['i003', 'o001', 1, 0, 60]],
    opts: { ring: true, clock: 10, sound: false, hints: true },
    saga: { stars: [3, 2, 1], best: [9000, 6000, 3000], boost: { pass: 2, turn: 0, more: 4 }, plays: 7, day: '2026-10-22', time: [31, 0, 40], built: ['i001', null, 'o003'] },
    paintings: [{ at: 1761100000, n: 2, cols: 1, rows: 1, c: 'f28a3c' }],
  })));
  const back = F.migrate(JSON.parse(JSON.stringify(v12)));
  assert.deepEqual(back, v12, 'every field as it was: kept things, notes, pairings and hearts, stars, best, time, built, boosters, paintings, opts');
  assert.equal('words' in back.saga, false);
  assert.deepEqual([1, 2, 3].map((n) => RL.storeys(back, n)), [3, 2, 1], 'old buildings keep their heights');
  const T = RL.table(back, deck, []);
  assert.ok(T.pool.length >= 6 && RL.newGame(RL.level(4), T, '5s:4:7'), 'Set deals its next level');
  // a relation on an old hearted pairing keeps its count and its heart
  assert.deepEqual(RL.relate(back.assoc, 'i003', 'i001', -1, 0, 70)[0], ['i001', 'i003', 4, 1, 70, -1, 0]);
});

test('Turn brings back an earlier relation; Pass sets one beside nothing; unsetShare counts what is left', () => {
  const st = keeping(), T0 = RL.table(st, deck, []);
  assert.equal(RL.back(RL.newGame(RL.level(2), T0, 'b'), T0), null, 'nothing said before');
  st.assoc = RL.relate(st.assoc, T0.pool[0], T0.pool[1], 1, 2, 50);
  const T = RL.table(st, deck, []);
  let g = RL.newGame(RL.level(2), T, 'b');
  const b = RL.back(g, T);
  assert.deepEqual([b.a, b.b, b.s, b.w].slice(2), [1, 2]);
  const r = RL.say(g, T, b.a, b.b, -1, 0);
  assert.equal(r.answer.kind, 'turn');
  assert.deepEqual(r.game.slots, g.slots, 'the board is as it was');
  const on = g.slots.filter(Boolean), off = T.pool.filter((id) => !on.includes(id)), S2 = F.migrate(st);
  S2.assoc = RL.relate(RL.relate([], on[0], on[1], 1, 0, 1), on[2], off[0], -1, 3, 2);   // the oldest has both on the board
  assert.deepEqual(RL.back(g, RL.table(S2, deck, [])), { a: off[0], b: on[2], s: -1, w: 3 }, 'the one that comes back is never on the board');
  assert.deepEqual(RL.say(g, RL.table(S2, deck, []), off[0], on[2], 1, 3).game.slots, g.slots, 'so the board is as it was');
  const p = RL.pass(g, T, 0);
  assert.ok(p.game.passed.includes(g.slots[0]) && !p.game.made.length);
  assert.ok(RL.unsetShare(T) < 1 && RL.unsetShare(T) > 0.9);
});

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

test('stars are the moments they defy: against others, against themselves; a brought thing alone earns neither', () => {
  const st = keeping(), T = RL.table(st, deck, []);
  const g0 = RL.newGame(RL.level(1), T, 'one');
  const same = playOut(g0, T, F.migrate(st), (g) => { const [x, y] = g.slots.filter(Boolean); return [x, y, T.look[keyOf(x, y)] || RL.answer(T, g, x, y, 1, 0).kind !== 'yours' ? 1 : -1, 0]; });
  const kinds = same.made.map((m) => m.kind);
  assert.equal(RL.result(same, T).stars, 1 + (kinds.includes('apart') || kinds.includes('yours') ? 1 : 0) + (kinds.includes('turn') ? 1 : 0));
  const g = { n: 1, state: 'done', slots: ['i001', null], used: [], made: [{ x: 'yb', y: 'i001', kind: 'brought' }, { x: 'i003', y: 'i001', kind: 'first' }] };
  assert.equal(RL.result(g, T).stars, 1, 'brought and first: set the board');
  assert.equal(RL.result(Object.assign({}, g, { made: [{ x: 'a', y: 'b', kind: 'yours' }, { x: 'c', y: 'b', kind: 'turn' }] }), T).stars, 3);
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
  st.assoc = RL.relate(st.assoc, 'o001', 'i001', -1, w, 200);
  st.assoc = RL.relate(st.assoc, 'i003', 'i001', 1, 2, 201);
  assert.deepEqual(st.assoc, [['i001', 'o001', 4, 1, 200, -1, 10], ['i001', 'i003', 1, 0, 201, 1, 2]]);
  const back = F.migrate(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back.assoc, st.assoc, 'norm keeps relations');
  assert.deepEqual(MX.heart(back.assoc, ['i001', 'i003'], true)[1], ['i001', 'i003', 1, 1, 201, 1, 2], 'heart keeps the relation');
  assert.deepEqual(MX.addAssociations(back.assoc, ['i001', 'i003'], 300)[1], ['i001', 'i003', 2, 0, 300, 1, 2], 'a v12 pairing call keeps it');
  assert.equal(RL.wordOf(back.saga.words, 10), 'a held breath');
  assert.equal(RL.wordOf(back.saga.words, 3), 'light');
  const bad = F.migrate({ assoc: [['a', 'b', 1, 0, 1, 2, 0], ['a', 'b', 1, 0, 1, 1, 7], ['a', 'b', 1, 0, 1, 1], ['a', 'b', 1, 0, 1, -1, 69]], saga: { words: ['ok', '', 5] } });
  assert.deepEqual(bad.assoc, [['a', 'b', 1, 0, 1, -1, 69]]);
  assert.deepEqual(bad.saga.words, ['ok', '?', '?'], 'a bad word keeps its place');
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
  const p = RL.pass(g, T, 0);
  assert.ok(p.game.passed.includes(g.slots[0]) && !p.game.made.length);
  assert.ok(RL.unsetShare(T) < 1 && RL.unsetShare(T) > 0.9);
});

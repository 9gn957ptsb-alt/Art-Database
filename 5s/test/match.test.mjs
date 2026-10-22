// Tests for src/match.js (node --test). Hand-made boards use six suits (0..5) on a background with no
// runs; suit 0 never appears in the background, so 0-runs are only where a test puts them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const F = require(join(here, '..', 'src', 'engine.js'));
const M = require(join(here, '..', 'src', 'match.js'));
const deck = JSON.parse(readFileSync(join(here, 'fixture', 'deck.json'), 'utf8'));
const NOW = new Date(2026, 9, 22, 12).getTime();

const KINDS3 = ['image', 'object', 'space'];
const PIECES = {
  suits: M.TOKENS.map((t, s) => ({ key: 'mat:m' + s, label: 'S' + s, token: t.name, hex: t.hex, shape: t.shape,
    ids: ['s' + s + 'a', 's' + s + 'b', 's' + s + 'c'], kinds: KINDS3, firsts: ['#1' + s + '2030', '#4' + s + '5060', '#7' + s + '8090'], swatches: [] })),
  passed: ['p1', 'p2'], out: [],
};
const BG = ['1 2 3 4 5 1', '3 4 5 1 2 3', '5 1 2 3 4 5', '2 3 4 5 1 2', '4 5 1 2 3 4', '1 2 3 4 5 1', '3 4 5 1 2 3'];

// A game from rows of tokens: 0-5 a plain tile; 0r 0c 0b a row stripe, column stripe, burst; 0h held;
// M the mark; . a hole; p P a pass of 1 or 2 layers; _ the background's tile. coats: rows of # o O.
function board(rows, opts = {}) {
  const toks = rows.map((r, ri) => r.trim().split(/\s+/).map((t, ci) => (t === '_' ? BG[ri].split(' ')[ci] : t)));
  const R = toks.length, C = toks[0].length;
  const grid = toks.map((r, ri) => r.map((t, ci) => ('.pP'.includes(t) ? t : t.endsWith('h') ? 'h' : opts.coats ? opts.coats[ri][ci] : '#')).join(''));
  const lv = { n: 1, cols: C, rows: R, grid, suits: 6, moves: opts.moves || 10, goals: opts.goals || [{ type: 'score', n: 1e9 }], stars: opts.stars || [1e9, 2e9, 3e9], coach: null };
  const g = M.newGame(lv, PIECES, 'test');
  toks.forEach((r, ri) => r.forEach((t, ci) => {
    const i = ri * C + ci, c = g.cells[i];
    if ('.pP'.includes(t)) { c.t = null; return; }
    if (t === 'M') { c.t = { k: g.k++, s: -1, o: null, sw: null, sp: 'mark', held: false, armed: false }; return; }
    const s = Number(t[0]), mod = t.slice(1);
    c.t = { k: g.k++, s, o: PIECES.suits[s].ids[i % 3], sw: null, sp: { r: 'row', c: 'col', b: 'burst' }[mod] || null, held: mod === 'h', armed: false };
  }));
  return g;
}
const at = (g, r, c) => r * g.cols + c;
const wave = (steps, n) => {   // the steps of wave n
  const i = steps.findIndex((s) => s.e === 'wave' && s.n === n);
  if (i < 0) return [];
  const j = steps.findIndex((s, k) => k > i && s.e === 'wave');
  return steps.slice(i + 1, j < 0 ? steps.length : j);
};
const of = (steps, e) => steps.filter((s) => s.e === e);
const sorted = (xs) => xs.slice().sort((a, b) => a - b);
const tiles = (g, pred) => g.cells.map((c, i) => (c.t && pred(c.t) ? i : -1)).filter((i) => i >= 0);
function hasRun(g) {
  const S = g.cells.map((c) => (c.t && c.t.s >= 0 ? c.t.s : -1));
  for (let i = 0; i < S.length; i++) {
    const r = Math.floor(i / g.cols), c = i % g.cols;
    if (S[i] < 0) continue;
    if (c + 2 < g.cols && S[i + 1] === S[i] && S[i + 2] === S[i]) return true;
    if (r + 2 < g.rows && S[i + g.cols] === S[i] && S[i + 2 * g.cols] === S[i]) return true;
  }
  return false;
}
const mid = (a, b) => '#' + [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');

test('the board helper starts with no runs', () => {
  assert.equal(hasRun(board(BG)), false);
  assert.equal(M.moves(board(BG)).length, 0);
});

test('all 30 levels expand to the table’s cell counts', () => {
  const count = (lv, chs) => lv.grid.join('').split('').filter((c) => chs.includes(c)).length;
  // n: [playable, paint, two coats, pass cells, held]
  const want = {
    1: [49, 0, 0, 0, 0], 5: [64, 0, 0, 0, 0], 6: [49, 25, 0, 0, 0], 7: [49, 49, 0, 0, 0], 9: [64, 36, 0, 0, 0], 10: [64, 64, 16, 0, 0],
    11: [64, 0, 0, 8, 0], 12: [64, 0, 0, 8, 0], 13: [64, 52, 0, 12, 0], 14: [64, 0, 0, 8, 0], 15: [81, 69, 0, 12, 0],
    16: [64, 0, 0, 0, 8], 17: [81, 71, 0, 0, 10], 18: [81, 0, 0, 0, 9], 19: [81, 0, 0, 10, 9], 20: [81, 73, 9, 0, 8],
    21: [41, 41, 0, 0, 0], 22: [72, 0, 0, 0, 0], 23: [69, 25, 0, 10, 0], 24: [72, 72, 0, 0, 0], 25: [53, 53, 28, 0, 0],
    26: [81, 0, 0, 0, 0], 27: [81, 81, 25, 0, 0], 28: [45, 0, 0, 12, 6], 29: [81, 25, 0, 18, 6], 30: [61, 61, 0, 0, 0],
  };
  for (let n = 1; n <= 30; n++) {
    const lv = M.level(n), rec = M.LEVELS[n - 1];
    assert.equal(lv.grid.length, lv.rows);
    assert.ok(lv.grid.every((r) => r.length === lv.cols));
    assert.equal(lv.moves, rec.moves);
    assert.deepEqual(lv.stars, rec.stars);
    if (want[n]) assert.deepEqual([count(lv, '#oOpPh'), count(lv, 'oO'), count(lv, 'O'), count(lv, 'pP'), count(lv, 'h')], want[n], 'level ' + n);
  }
  assert.equal(count(M.level(14), 'P'), 8);
  assert.equal(M.level(12).grid[7], 'pppppppp');
  assert.equal(M.level(13).grid[6], 'oppppooo');   // bottom: centre column 3, then 2, 4, 1
  assert.equal(M.level(18).grid[4], '###hhh###');
  assert.equal(M.level(1).episode, 'Sort');
  assert.equal(M.level(30).episode, 'Another five');
  assert.equal(M.level(21).grid.join('\n'), M.MASKS.diamond.map((r) => r.replace(/#/g, 'o')).join('\n'));
  // scatter (passes on 11, 14, 15 and 19, held tiles on the rest): never the top row, never next to another
  // blocker, never in the centre square
  for (const n of [11, 14, 15, 16, 17, 19, 20, 28, 29]) {
    const lv = M.level(n), g = lv.grid.join(''), C = lv.cols, inside = (i) => Math.abs(Math.floor(i / C) - 4) <= (n === 20 ? 1 : 2) && Math.abs((i % C) - 4) <= (n === 20 ? 1 : 2);
    for (let i = 0; i < g.length; i++) {
      if (!(n === 28 || n === 29 ? 'h' : 'pPh').includes(g[i])) continue;
      assert.ok(i >= C, 'top row, level ' + n);
      if (n === 20 || n === 29) assert.ok(!inside(i), 'centre square, level ' + n);
      for (const j of [i - C, i + C, i % C ? i - 1 : -1, i % C < C - 1 ? i + 1 : -1]) if (j >= 0 && j < g.length) assert.ok(!'pPh'.includes(g[j]), 'next to a blocker, level ' + n);
    }
  }
  assert.deepEqual(M.level(31).stars, [0, 26400, 34100]);
  assert.equal(M.level(31).moves, M.LEVELS[25].moves + 2);
  assert.equal(M.level(36).moves, M.LEVELS[25].moves + 4);
});

test('newGame: deterministic, no starting runs, at least three ways to go', () => {
  const ex = F.exampleState(deck, NOW);
  for (let n = 1; n <= 30; n++) {
    const lv = M.level(n), pc = M.pieces(ex, deck, lv.suits);
    for (let s = 0; s < 4; s++) {
      const g = M.newGame(lv, pc, '5s:' + n + ':' + s);
      assert.equal(hasRun(g), false, 'level ' + n);
      assert.ok(M.moves(g).length >= 3, 'level ' + n);
      assert.equal(g.state, 'play');
      g.cells.forEach((c, i) => {
        assert.equal(!!c.t, !c.hole && !c.pass);
        assert.equal(!!(c.t && c.t.held), lv.grid.join('')[i] === 'h');
      });
      if (s === 0) assert.deepEqual(M.newGame(lv, pc, '5s:' + n + ':0'), g);
    }
  }
  const a = M.newGame(M.level(7), M.pieces(ex, deck, 4), 'a'), b = M.newGame(M.level(7), M.pieces(ex, deck, 4), 'b');
  assert.notDeepEqual(a.cells, b.cells);
});

test('coach levels start with a swap that makes the special they teach', () => {
  const ex = F.exampleState(deck, NOW);
  for (const [n, want] of [[3, 'stripe'], [5, 'burst'], [8, 'mark']]) {
    for (let s = 0; s < 5; s++) {
      const lv = M.level(n), g = M.newGame(lv, M.pieces(ex, deck, lv.suits), '5s:' + n + ':' + s);
      const [a, b] = M.hint(g, want);
      const made = of(wave(M.swap(g, a, b).steps, 1), 'make').map((x) => x.tile.sp);
      assert.ok(made.some((sp) => (want === 'stripe' ? sp === 'row' || sp === 'col' : sp === want)), n + ' ' + made);
    }
  }
});

test('same game and same swaps give the same steps', () => {
  const ex = F.exampleState(deck, NOW), lv = M.level(13), pc = M.pieces(ex, deck, lv.suits);
  const play = () => {
    let g = M.newGame(lv, pc, '5s:13:2'); const all = [];
    for (let i = 0; i < 10 && g.state === 'play'; i++) { const [a, b] = M.hint(g); const r = M.swap(g, b, a); all.push(r.steps); g = r.game; }
    return { g, all };
  };
  assert.deepEqual(play(), play());
});

test('a bounce changes nothing and spends no move', () => {
  const g = board(BG), before = JSON.stringify(g);
  for (const [a, b] of [[0, 1], [0, 7], [0, 2], [5, 6], [-1, 0]]) {
    const r = M.swap(g, a, b);
    assert.equal(r.valid, false);
    assert.deepEqual(r.steps, [{ e: 'bounce', a, b }]);
    assert.equal(r.game, g);
  }
  assert.equal(JSON.stringify(g), before);
  // a held tile cannot be swapped, even into a line
  const h = board(['0 0 _ _ _ _', '_ _ 0h _ _ _', '_ _ _ _ _ _', '_ _ _ _ _ _', '_ _ _ _ _ _', '_ _ _ _ _ _']);
  assert.equal(M.canSwap(h, at(h, 1, 2), at(h, 0, 2)), false);
  assert.equal(M.swap(h, at(h, 1, 2), at(h, 0, 2)).valid, false);
});

test('a valid swap spends one move', () => {
  const g = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)]);
  const r = M.swap(g, at(g, 1, 2), at(g, 0, 2));
  assert.equal(r.valid, true);
  assert.equal(r.game.moves, g.moves - 1);
  assert.equal(r.game.used, 1);
  assert.equal(g.moves, 10);   // the input is untouched
  assert.deepEqual(r.steps[0], { e: 'swap', a: 8, b: 2 });
});
function _rest(from) { return BG.slice(from, 6).map((r) => r.split(' ').map(() => '_').join(' ')); }

test('four in a row makes a column stripe in the cell dragged into; four in a column a row stripe', () => {
  let g = board(['0 0 _ 0 _ _', '_ _ 0 _ _ _', ..._rest(2)]);
  let w = wave(M.swap(g, at(g, 1, 2), at(g, 0, 2)).steps, 1);
  assert.deepEqual(of(w, 'match').map((m) => m.cells), [[0, 1, 2, 3]]);
  assert.deepEqual(of(w, 'make').map((m) => [m.cell, m.tile.sp, m.tile.s]), [[2, 'col', 0]]);
  assert.deepEqual(sorted(of(w, 'clear').map((x) => x.cell)), [0, 1, 3]);

  g = board(['0 _ _ _ _ _', '0 _ _ _ _ _', '_ 0 _ _ _ _', '0 _ _ _ _ _', ..._rest(4)]);
  w = wave(M.swap(g, at(g, 2, 1), at(g, 2, 0)).steps, 1);
  assert.deepEqual(of(w, 'make').map((m) => [m.cell, m.tile.sp]), [[12, 'row']]);
  // dragged the other way: the cell dragged into is not in the line, so the other swapped cell is
  w = wave(M.swap(g, at(g, 2, 0), at(g, 2, 1)).steps, 1);
  assert.deepEqual(of(w, 'make').map((m) => [m.cell, m.tile.sp]), [[12, 'row']]);
});

test('an L or a T makes a burst at the crossing; five in a line makes the mark', () => {
  let g = board(['_ 0 _ _ _ _', '_ 0 _ _ _ _', '0 _ 0 _ _ _', '_ 0 _ _ _ _', ..._rest(4)]);   // T
  let r = M.swap(g, at(g, 3, 1), at(g, 2, 1)), w = wave(r.steps, 1);
  assert.deepEqual(of(w, 'match').map((m) => m.cells), [[1, 7, 12, 13, 14]]);
  assert.deepEqual(of(w, 'make').map((m) => [m.cell, m.tile.sp]), [[13, 'burst']]);
  assert.equal(r.game.made.burst, 1);

  g = board(['0 _ _ _ _ _', '0 _ _ _ _ _', '_ 0 0 _ _ _', '0 _ _ _ _ _', ..._rest(4)]);   // L
  w = wave(M.swap(g, at(g, 3, 0), at(g, 2, 0)).steps, 1);
  assert.deepEqual(of(w, 'make').map((m) => [m.cell, m.tile.sp]), [[12, 'burst']]);

  g = board(['0 0 _ 0 0 _', '_ _ 0 _ _ _', ..._rest(2)]);
  r = M.swap(g, at(g, 1, 2), at(g, 0, 2)); w = wave(r.steps, 1);
  const make = of(w, 'make')[0];
  assert.deepEqual([make.cell, make.tile.sp, make.tile.s, make.tile.o], [2, 'mark', -1, null]);
  assert.ok(of(w, 'word').some((x) => x.text === 'The mark.'));
  assert.equal(r.game.made.mark, 1);
});

test('a cascade makes its special at the runs’ crossing, and records nothing', () => {
  // Wave 1 clears column 1, rows 2-4; (1,1) falls to (4,1) and makes an L with row 4 and column 1 below.
  const g = board([
    '2 2 _ _ _ _',
    '_ 1 _ _ _ _',
    '_ 3 0 _ _ _',
    '_ 0 _ _ _ _',
    '1 0 1 3 _ _',
    '_ 1 _ _ _ _',
    '_ 1 _ _ _ _',
  ]);
  const r = M.swap(g, at(g, 2, 2), at(g, 2, 1));
  const w1 = wave(r.steps, 1), w2 = wave(r.steps, 2);
  assert.deepEqual(of(w1, 'match').map((m) => [m.cells, m.by]), [[[13, 19, 25], 'you']]);
  const crossing = at(g, 4, 1);
  assert.ok(of(w2, 'match').some((m) => m.by === 'cascade' && m.cells.includes(crossing)));
  assert.ok(of(w2, 'make').some((m) => m.cell === crossing && m.tile.sp === 'burst'));
  assert.equal(r.game.groups.length, 1);   // only the swap's own group
});

test('two lines from one swap are two juxtapositions', () => {
  const g = board(['0 0 1 _ _ _', '_ _ 0 1 1 _', ..._rest(2)]);
  const r = M.swap(g, at(g, 1, 2), at(g, 0, 2)), w = wave(r.steps, 1);
  const ms = of(w, 'match');
  assert.deepEqual(ms.map((m) => [m.cells, m.suit, m.by]), [[[0, 1, 2], 0, 'you'], [[8, 9, 10], 1, 'you']]);
  assert.deepEqual(ms[0].ids, ['s0a', 's0b', 's0c']);
  assert.deepEqual(r.game.groups, [{ ids: ['s0a', 's0b', 's0c'], suit: 0 }, { ids: ['s1c', 's1a', 's1b'], suit: 1 }]);
  const res = M.result(r.game);
  assert.deepEqual(res.groups.map((x) => [x.key, x.label]), [['mat:m1', 'S1'], ['mat:m0', 'S0']]);   // newest first
  // the same thing three times is no juxtaposition
  const one = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)]);
  for (const c of [0, 1, 8]) one.cells[c].t.o = 's0a';
  assert.equal(M.swap(one, 8, 2).game.groups.length, 0);
});

test('every combo', () => {
  const blank = (r1, r2) => board(['_ _ _ _ _ _', '_ _ _ _ _ _', r1, r2 || '_ _ _ _ _ _', '_ _ _ _ _ _', '_ _ _ _ _ _']);
  const fire = (g, a, b) => { const r = M.swap(g, a, b); return { r, w: wave(r.steps, 1), f: of(wave(r.steps, 1), 'fire') }; };
  const A = 14, B = 15;   // (2,2) dragged into (2,3)
  const live = (g) => tiles(g, () => true);

  let g = blank('_ _ 0r 1c _ _'), x = fire(g, A, B);
  assert.equal(x.f[0].sp, 'stripe+stripe');
  assert.deepEqual(x.f[0].cells, sorted([12, 13, 14, 15, 16, 17, 3, 9, 21, 27, 33]));
  assert.deepEqual(sorted(of(x.w, 'clear').map((c) => c.cell)), x.f[0].cells);

  g = blank('_ _ 0r 1b _ _'); x = fire(g, A, B);
  assert.equal(x.f[0].sp, 'stripe+burst');
  const rc = live(g).filter((i) => Math.abs(Math.floor(i / 6) - 2) <= 1 || Math.abs((i % 6) - 3) <= 1);
  assert.deepEqual(x.f[0].cells, rc);

  g = blank('_ _ 0b 1b _ _'); x = fire(g, A, B);
  assert.equal(x.f[0].sp, 'burst+burst');
  assert.equal(x.f[0].cells.length, 24);   // the 5×5 round (2,3), less itself
  const w2 = of(wave(x.r.steps, 2), 'fire');
  assert.ok(w2.some((f) => f.sp === 'burst2' && f.cells.length >= 20));   // it fell, then cleared again

  g = blank('_ _ M 1 _ _'); x = fire(g, A, B);
  assert.equal(x.f[0].sp, 'mark+tile');
  assert.deepEqual(x.f[0].cells, sorted(tiles(g, (t) => t.s === 1).filter((i) => i !== B).concat(A)));   // after the swap
  assert.deepEqual(sorted(of(x.w, 'clear').map((c) => c.cell)), sorted(tiles(g, (t) => t.s === 1).concat(A)));
  assert.equal(x.r.game.groups.length, 0);   // the mark records nothing

  g = blank('_ _ M 1r _ _'); x = fire(g, A, B);
  const plain1 = tiles(g, (t) => t.s === 1 && !t.sp);
  const made = of(x.w, 'make');
  assert.deepEqual(made.map((m) => m.cell), plain1);
  assert.ok(made.every((m) => m.tile.sp === 'row' || m.tile.sp === 'col'));
  assert.equal(x.f[0].sp, 'mark+stripe');
  for (const c of plain1.concat(A)) assert.ok(x.f.some((f) => f.cell === c && (f.sp === 'row' || f.sp === 'col')));

  g = blank('_ _ M 1b _ _'); x = fire(g, A, B);
  const conv = of(x.w, 'make').map((m) => m.cell);
  assert.ok(conv.length >= 4);
  const bursts = of(x.r.steps, 'fire').filter((f) => f.sp === 'burst');
  for (const c of conv.concat(A)) assert.ok(of(x.w, 'fire').some((f) => f.cell === c && f.sp === 'burst'));
  assert.ok(bursts.length >= 2 * (conv.length + 1));   // every burst fires twice

  g = board(['_ _ _ _ _ _', '_ p _ _ _ _', '_ _ M M _ _', '_ _ _ 2h _ _', '_ _ P _ _ _', '_ _ _ _ _ _']);
  x = fire(g, A, B);
  assert.equal(x.f[0].sp, 'mark+mark');
  assert.ok(of(x.w, 'word').some((s) => s.text === 'Clean slate.'));
  assert.equal(of(x.w, 'clear').length, live(g).length - 1);
  assert.deepEqual(of(x.w, 'free').map((s) => s.cell), [21]);
  assert.deepEqual(of(x.w, 'block').map((s) => [s.cell, s.left]), [[7, 0], [26, 1]]);
});

test('gravity: tiles stop at holes, passes and held tiles; the cell under each is a source', () => {
  const g = board(['1 2 3', 'p . 2h', '3 1 4', '4 2 5', '0 0 1', '2 3 0']);
  const r = M.swap(g, at(g, 5, 2), at(g, 4, 2)), w = wave(r.steps, 1);
  assert.deepEqual(of(w, 'match').map((m) => m.cells), [[12, 13, 14]]);
  assert.deepEqual(of(w, 'fall').map((f) => [f.from, f.to]).sort((a, b) => a[0] - b[0]), [[6, 9], [7, 10], [8, 11], [9, 12], [10, 13], [11, 14]]);
  assert.deepEqual(of(w, 'drop').map((d) => [d.cell, d.n]).sort((a, b) => a[0] - b[0]), [[6, 1], [7, 1], [8, 1]]);
  assert.equal(r.game.cells[5].t.held, true);
  assert.equal(r.game.cells[4].t, null);
  assert.ok(r.game.cells.every((c) => c.hole || c.pass || c.t));
});

test('passes lose one layer a wave to a match beside them; held tiles are freed and stay', () => {
  const g = board(['0 _ _ _ _ _', '0 P _ _ _ _', '_ 0 0 _ _ _', '0 _ _ _ _ _', ..._rest(4)], { goals: [{ type: 'clear' }] });
  assert.deepEqual(g.goals, [{ type: 'clear', n: 2, have: 0 }]);
  let r = M.swap(g, at(g, 3, 0), at(g, 2, 0));
  assert.deepEqual(of(wave(r.steps, 1), 'block'), [{ e: 'block', cell: 7, left: 1, id: 'p1' }]);   // beside two matched cells: one layer
  assert.deepEqual(of(wave(r.steps, 1), 'goal'), [{ e: 'goal', i: 0, have: 1 }]);

  const h = board(['0 0h _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)], { goals: [{ type: 'collect', suit: 0, n: 9 }] });
  const k = h.cells[1].t.k;
  r = M.swap(h, at(h, 1, 2), at(h, 0, 2));
  const w = wave(r.steps, 1);
  assert.deepEqual(of(w, 'free').map((s) => s.cell), [1]);
  assert.deepEqual(sorted(of(w, 'clear').map((s) => s.cell)), [0, 2]);
  assert.equal(of(w, 'goal')[0].have, 2);   // a freed tile is not collected
  assert.ok(!of(w, 'fall').some((f) => f.k === k));   // it stays where it is, free (a reshuffle may move it later)
  assert.equal(r.game.cells.find((c) => c.t && c.t.k === k).t.held, false);
});

test('the reshuffle: no move spent, no ready-made run, three ways to go', () => {
  const rows = [0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3, 4, 5].map((c) => String(1 + ((2 * r + c) % 4))).join(' '));
  const g = board(rows);
  assert.equal(M.moves(g).length, 0);
  const r = M.boost(g, 'turn', [0, 1]);
  assert.equal(r.ok, true);
  assert.ok(of(r.steps, 'shuffle').length === 1);
  assert.ok(of(r.steps, 'word').some((s) => s.text === 'Shuffled: always three ways to go.'));
  assert.equal(hasRun(r.game), false);
  assert.ok(M.moves(r.game).length >= 3);
  assert.equal(r.game.moves, g.moves);
  const ks = (x) => x.cells.map((c) => c.t.k).sort((a, b) => a - b);
  assert.deepEqual(ks(r.game), ks(g));   // the same tiles, moved
});

test('coats and the middle colour; a painted cell keeps its colour; the mark paints Iris', () => {
  const coats = ['OOo###', '######', '######', '######', '######', '######'];
  const g = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)], { coats, goals: [{ type: 'paint' }] });
  assert.deepEqual(g.goals, [{ type: 'paint', n: 3, have: 0 }]);
  const firstOf = (t) => PIECES.suits[t.s].firsts[PIECES.suits[t.s].ids.indexOf(t.o)];
  const c0 = firstOf(g.cells[0].t), c2 = firstOf(g.cells[8].t);
  let r = M.swap(g, 8, 2);
  const p = of(wave(r.steps, 1), 'paint');
  assert.deepEqual(p.map((x) => [x.cell, x.left]), [[0, 1], [1, 1], [2, 0]]);
  assert.equal(p[0].colour, c0);
  assert.equal(r.game.cells[2].colour, c2);
  assert.equal(r.game.goals[0].have, 1);
  // a second coat on cell 0 (the Pass booster): the middle of the two colours
  const t = r.game.cells[0].t, second = t.sp === 'mark' ? '#7350ee' : firstOf(t);
  const b = M.boost(r.game, 'pass', 0);
  assert.equal(b.ok, true);
  assert.equal(b.game.cells[0].colour, mid(c0, second));
  assert.equal(b.game.moves, r.game.moves);
  const kept = b.game.cells[0].colour;
  const again = M.boost(b.game, 'pass', 0);
  assert.equal(of(again.steps, 'paint').filter((x) => x.cell === 0).length, 0);
  assert.equal(again.game.cells[0].colour, kept);

  const m = board(['M _ _ _ _ _', ..._rest(1)], { coats: ['o#####', '######', '######', '######', '######', '######'] });
  const mr = M.boost(m, 'pass', 0);
  assert.equal(mr.game.cells[0].colour, '#7350ee');
  assert.ok(of(mr.steps, 'fire').some((f) => f.cell === 0 && f.sp === 'mark'));
});

test('goals, the finale and stars', () => {
  // a paint level is won once the board settles with every cell painted, then the finale
  const coats = ['ooo###', '######', '######', '######', '######', '######'];
  const g = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)], { coats, goals: [{ type: 'paint' }], moves: 5, stars: [0, 500, 1e9] });
  const r = M.swap(g, 8, 2);
  assert.equal(r.game.state, 'won');
  assert.deepEqual(r.steps[r.steps.length - 1], { e: 'end', state: 'won' });
  assert.equal(M.swap(r.game, 0, 1).valid, false);   // no more swaps
  const f = M.finale(r.game);
  assert.equal(f.game.state, 'done');
  assert.equal(f.game.moves, 0);
  assert.ok(of(f.steps, 'make').slice(0, 4).every((m) => m.tile.sp === 'row' || m.tile.sp === 'col'));
  assert.equal(of(f.steps, 'score').filter((x) => x.add === 1000).length, 4);   // +1,000 a move left
  assert.equal(f.steps[0].text, 'All set.');
  assert.ok(f.game.score >= r.game.score + 4000);
  assert.equal(f.game.groups.length, r.game.groups.length);   // the finale records nothing
  assert.deepEqual(M.finale(f.game).steps, []);   // once
  const res = M.result(f.game);
  assert.equal(res.won, true);
  assert.equal(res.stars, 2);
  assert.equal(res.movesLeft, 0);
  assert.equal(res.used, 1);
  assert.equal(res.painting.c.length, 36 * 6);
  assert.equal(res.painting.c.slice(0, 18), [0, 1, 2].map((c) => f.game.cells[c].colour.slice(1)).join(''));
  assert.equal(res.painting.c.slice(18, 24), '------');

  // a score-only level plays out all its moves
  let s = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)], { goals: [{ type: 'score', n: 10 }], moves: 2, stars: [10, 1e8, 1e9] });
  s = M.swap(s, 8, 2).game;
  assert.equal(s.state, 'play');
  const [a, b] = M.hint(s);
  s = M.swap(s, a, b).game;
  assert.equal(s.state, 'won');
  assert.equal(M.result(M.finale(s).game).stars, 1);

  // out of moves, then Five more, once
  const o = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', ..._rest(2)], { coats: ['######', '######', '######', '######', '######', 'oooooo'], goals: [{ type: 'paint' }], moves: 1 });
  const out = M.swap(o, 8, 2).game;
  assert.equal(out.state, 'out');
  assert.equal(M.result(out).won, false);
  assert.equal(M.result(out).stars, 0);
  const more = M.boost(out, 'more');
  assert.equal(more.ok, true);
  assert.equal(more.game.state, 'play');
  assert.equal(more.game.moves, 5);
  assert.equal(M.boost(more.game, 'more').ok, false);
  assert.equal(M.boost(out, 'pass', 0).ok, false);   // only Five more works when out
});

test('kind goals scale to the person’s things', () => {
  const pc = { suits: PIECES.suits.slice(0, 4).map((s, i) => Object.assign({}, s, i === 0 ? { ids: ['a', 'b'], kinds: ['image', 'object'] }
    : { ids: ['c', 'd'], kinds: ['object', 'object'] })), passed: [] };
  const lv = Object.assign(M.level(1), { goals: [{ type: 'collect', kind: 'image', n: 12 }, { type: 'collect', kind: 'space', n: 10 }] });
  const g = M.newGame(lv, pc, 'k');
  assert.deepEqual(g.goals, [{ type: 'collect', kind: 'image', n: 6, have: 0 }, { type: 'collect', suit: 0, n: 10, have: 0 }]);   // share 0.125; share 0
});

test('pieces on the example taste: threads, one suit a thing, tokens by family', () => {
  const ex = F.exampleState(deck, NOW), prof = F.profile(ex, deck);
  const kept = [].concat(...F.KINDS.map((k) => prof.keptByKind[k]));
  for (const n of [4, 5, 6]) {
    const p = M.pieces(ex, deck, n);
    assert.equal(p.suits.length, n);
    assert.equal(new Set(p.suits.map((s) => s.token)).size, n);
    const ids = [].concat(...p.suits.map((s) => s.ids));
    assert.equal(new Set(ids).size, ids.length);   // one suit per thing
    assert.deepEqual(ids.concat(p.out).sort(), kept.slice().sort());
    for (const s of p.suits) {
      const t = M.TOKENS.find((x) => x.name === s.token);
      assert.equal(s.hex, t.hex);
      assert.equal(s.shape, t.shape);
      assert.equal(s.kinds.length, s.ids.length);
      assert.ok(s.ids.length || s.swatches.length);
      if (s.key) assert.equal(s.label, F.featureLabel(s.key, deck));
    }
    assert.ok(p.suits[0].ids.length >= 2);
    assert.deepEqual(M.pieces(ex, deck, n), p);
  }
  const p = M.pieces(ex, deck, 5);
  const latestPass = new Map();
  for (const e of ex.j) latestPass.set(e[0], !e[1]);
  assert.ok(p.passed.length > 0 && p.passed.every((id) => latestPass.get(id) || ex.own.some((o) => o.id === id && o.let != null)));
  assert.ok(p.passed.includes('yex2'));
});

test('pieces with nothing kept: swatch suits in the frame colours', () => {
  const p = M.pieces(F.newState(), deck, 5);
  assert.deepEqual(p.suits.map((s) => [s.key, s.label, s.token, s.ids.length]), M.TOKENS.slice(0, 5).map((t) => [null, t.word, t.name, 0]));
  assert.deepEqual(p.suits[1].swatches, [['#FF9B55', '#feb787', '#fcd3b9']]);
  assert.deepEqual(p, M.pieces(null, deck, 5));
  const g = M.newGame(M.level(1), p, 's');
  assert.ok(g.cells.every((c) => c.t.o === null && c.t.sw === 0));
  assert.ok(M.moves(g).length >= 3);
});

test('addAssociations: pairs, n up to 99, the cap of 400; hearts', () => {
  let a = M.addAssociations([], ['c', 'a', 'b', 'a'], 100);
  assert.deepEqual(a, [['a', 'b', 1, 0, 100], ['a', 'c', 1, 0, 100], ['b', 'c', 1, 0, 100]]);
  a = M.addAssociations(a, ['a', 'b'], 200);
  assert.deepEqual(a[0], ['a', 'b', 2, 0, 200]);
  assert.equal(M.addAssociations([['a', 'b', 99, 0, 1]], ['a', 'b'], 2)[0][2], 99);
  const full = [];
  for (let i = 0; i < 400; i++) full.push(['x' + String(i).padStart(3, '0'), 'y', i < 2 ? 1 : 5, i === 0 ? 1 : 0, 1000 + i]);
  const capped = M.addAssociations(full, ['p', 'q'], 5000);
  assert.equal(capped.length, 400);
  assert.ok(capped.some((e) => e[0] === 'x000'));   // hearted, n 1: never goes
  assert.ok(!capped.some((e) => e[0] === 'x001'));  // the unhearted lowest n, oldest, goes
  assert.ok(capped.some((e) => e[0] === 'p'));      // the new pair (n 1, newest) stays
  assert.equal(full.length, 400);                   // the input is untouched
  let h = M.heart(a, ['a', 'b', 'd'], true);
  assert.deepEqual(h.find((e) => e[0] === 'a' && e[1] === 'b').slice(0, 4), ['a', 'b', 2, 1]);
  assert.deepEqual(h.find((e) => e[0] === 'b' && e[1] === 'd').slice(0, 4), ['b', 'd', 1, 1]);
  h = M.heart(h, ['a', 'b'], false);
  assert.equal(h.find((e) => e[0] === 'a' && e[1] === 'b')[3], 0);
  assert.equal(M.heart([], ['a', 'b'], false).length, 0);
});

test('clusters: by kind before any associations; merged up to the cap', () => {
  const ex = F.exampleState(deck, NOW), prof = F.profile(ex, deck);
  const kept = [].concat(...F.KINDS.map((k) => prof.keptByKind[k]));
  assert.deepEqual(M.clusters(ex, deck), { clusters: [], rest: kept });
  let assoc = [];
  for (let i = 0; i + 1 < 10; i++) assoc = M.addAssociations(assoc, [kept[i], kept[i + 1]], 100 + i);
  assoc = M.addAssociations(assoc, [kept[20], kept[21]], 50);
  assoc = M.heart(assoc, [kept[20], kept[21]], true);
  assoc.push(['zzz-not-kept', kept[0], 9, 0, 1]);
  const c = M.clusters(Object.assign({}, ex, { assoc }), deck);
  // the chain 0-1-…-9 is taken newest first: 2..9 make 8, so 1-2 is refused and 0-1 is a pair of its own
  assert.deepEqual(c.clusters.map((x) => x.ids.slice().sort()), [kept.slice(2, 10).sort(), [kept[20], kept[21]].sort(), [kept[0], kept[1]].sort()]);
  assert.deepEqual(c.clusters.map((x) => [x.times, x.hearts]), [[7, 0], [1, 1], [1, 0]]);
  assert.ok([kept[2], kept[9]].indexOf(c.clusters[0].ids[0]) < 0);   // the most connected first, not an end of the chain
  assert.ok(c.clusters.every((x) => typeof x.label === 'string' && x.label.length > 0));
  const all = [].concat(...c.clusters.map((x) => x.ids)).concat(c.rest);
  assert.deepEqual(all.slice().sort(), kept.slice().sort());
  const small = M.clusters(Object.assign({}, ex, { assoc }), deck, 3).clusters;
  assert.ok(small.every((x) => x.ids.length <= 3) && small.some((x) => x.ids.length === 3));
});

test('the saga: plays, stars and best, boosters earned, used and capped; paintings capped at 24', () => {
  let { saga, earned } = M.recordLevel(undefined, { n: 1, won: true, stars: 3, score: 9000 }, 1);
  assert.deepEqual(saga, { stars: [3], best: [9000], boost: { pass: 2, turn: 1, more: 1 }, plays: 1, day: null });
  assert.deepEqual(earned, { pass: 1, turn: 0, more: 0 });
  ({ saga, earned } = M.recordLevel(saga, { n: 1, won: true, stars: 3, score: 100 }, 2));
  assert.deepEqual([saga.stars, saga.best, earned.pass], [[3], [9000], 0]);   // 3 stars only once
  ({ saga } = M.recordLevel(saga, { n: 2, won: false, stars: 0, score: 100 }, 3));
  assert.deepEqual([saga.stars, saga.plays], [[3], 3]);
  for (const n of [2, 3, 4]) ({ saga } = M.recordLevel(saga, { n, won: true, stars: 1, score: 10 }, 4));
  ({ saga, earned } = M.recordLevel(saga, { n: 5, won: true, stars: 1, score: 10 }, 5));
  assert.deepEqual(earned, { pass: 1, turn: 1, more: 1 });
  assert.equal(saga.stars.length, 5);
  ({ saga } = M.recordLevel(saga, { n: 9, won: true, stars: 3, score: 1 }, 6));
  assert.equal(saga.stars.length, 5);   // a level not yet unlocked records only the play
  let s = { boost: { pass: 9, turn: 0, more: 1 } };
  assert.equal(M.useBoost(s, 'turn'), null);
  s = M.useBoost(s, 'pass');
  assert.equal(s.boost.pass, 8);
  assert.equal(M.recordLevel({ stars: [], best: [], boost: { pass: 9, turn: 9, more: 9 }, plays: 0 }, { n: 1, won: true, stars: 3, score: 1 }).saga.boost.pass, 9);
  const res = { n: 7, painting: { cols: 1, rows: 1, c: 'abcdef' } };
  let ps = [];
  for (let i = 0; i < 24; i++) ps = M.keepPainting(ps, res, i);
  assert.equal(ps.length, 24);
  assert.deepEqual(ps[0], { at: 0, n: 7, cols: 1, rows: 1, c: 'abcdef' });
  assert.equal(M.keepPainting(ps, res, 99), null);
  assert.equal(M.keepPainting([], { n: 1, painting: null }, 1), null);
});

test('boosters: Turn needs no line and its lines are yours; Pass clears a tile, fires a special, wears a pass', () => {
  const g = board(['0 0 _ _ _ _', '_ _ 0 _ _ _', '_ p _ _ _ _', '_ _ 1r _ _ _', ..._rest(4)]);
  let r = M.boost(g, 'turn', [8, 2]);
  assert.deepEqual([r.ok, r.game.moves, r.game.used], [true, g.moves, 0]);
  assert.equal(of(wave(r.steps, 1), 'match')[0].by, 'you');
  assert.equal(r.game.groups.length, 1);
  r = M.boost(g, 'turn', [30, 31]);   // no line: the two just trade places
  assert.equal(r.ok, true);
  assert.deepEqual(r.steps.slice(0, 2), [{ e: 'boost', kind: 'turn' }, { e: 'swap', a: 30, b: 31 }]);
  assert.equal(of(r.steps, 'wave').length, 0);
  assert.equal(M.boost(g, 'turn', [0, 2]).ok, false);   // not neighbours
  r = M.boost(g, 'pass', 13);
  assert.deepEqual(of(r.steps, 'block')[0], { e: 'block', cell: 13, left: 0, id: 'p1' });
  r = M.boost(g, 'pass', 20);
  assert.deepEqual(of(wave(r.steps, 1), 'fire')[0], { e: 'fire', cell: 20, sp: 'row', cells: [18, 19, 20, 21, 22, 23] });
  assert.equal(r.game.groups.length, 0);
  assert.equal(M.boost(g, 'pass', -1).ok, false);
});

test('hint: the swap that clears most; the special it is asked for', () => {
  const g = board(['0 0 _ 0 0 _', '_ _ 0 _ _ _', ..._rest(2)]);
  assert.deepEqual(M.hint(g), [2, 8]);
  assert.deepEqual(M.hint(g, 'mark'), [2, 8]);
  assert.equal(M.hint(board(BG)), null);
});

test('a move and its cascades take well under 2 ms', () => {
  const ex = F.exampleState(deck, NOW);
  let total = 0, n = 0;
  for (const lvl of [7, 19, 29]) {
    const lv = M.level(lvl);
    let g = M.newGame(lv, M.pieces(ex, deck, lv.suits), 'perf');
    for (let i = 0; i < 60 && g.state === 'play'; i++) {
      const [a, b] = M.hint(g);
      const t = process.hrtime.bigint();
      g = M.swap(g, a, b).game;
      total += Number(process.hrtime.bigint() - t) / 1e6; n++;
    }
  }
  assert.ok(total / n < 2, (total / n).toFixed(3) + ' ms');
});

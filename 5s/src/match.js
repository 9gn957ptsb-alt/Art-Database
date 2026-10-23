/* 5s match: Set's game (SPEC.md, "Set: the board and the game"). Candy Crush Saga's rules played with
 * the person's own things: a suit is one of their threads, three in a line is a juxtaposition.
 *
 * Pure and deterministic: no DOM, no clock, no Math.random. Every draw comes from the game's own PRNG
 * state (game.r), so the same game and the same swaps give the same boards and the same steps. Nothing
 * mutates its input. Browser: window.FiveSMatch (load after engine.js). Node: module.exports.
 *
 * API CHANGES (all additive; everything else is as the brief states):
 * - A Suit also carries kinds[] and firsts[]: each thing's kind and first colour, parallel to ids.
 *   newGame has no deck, and needs them for kind goals and paint.
 * - In a Game, suits[i].ids/kinds/firsts are in ring order (`at` indexes them; a swatch suit's `at`
 *   indexes its swatches). A Game also has used (moves spent), stars ([s1, s2, s3]) and coach.
 * - tile.armed is true for a burst that has fired once (3×3), or 2 for burst + burst (5×5).
 * - fire.sp is the special that fired ('row' 'col' 'burst' 'burst2' 'mark') or a combo
 *   ('stripe+stripe' 'stripe+burst' 'burst+burst' 'mark+tile' 'mark+stripe' 'mark+burst' 'mark+mark').
 * - drop.n: how many cells the new tile falls (it starts n cells above its cell; 0 on a reshuffle).
 * - match.ids: the group's distinct things. A match with by 'you' and 2+ ids is a juxtaposition
 *   (FiveSPlay's onAssociate); the same group is in game.groups.
 * - score.cell is null for a finale move with no plain tile left to stripe.
 * - keepPainting also returns null when the result has no painting.
 * - Tests are test/match.test.mjs (node --test, like engine.test.mjs), not .cjs.
 */
(function (root) {
  'use strict';
  const FiveS = root.FiveS || (typeof require === 'function' ? require('./engine.js') : null);

  // ---------------------------------------------------------------- constants

  const TOKENS = Object.freeze([
    { name: 'flare', hex: '#FF6B4D', shape: 'circle', word: 'Red' },
    { name: 'ember', hex: '#FF9B55', shape: 'petal', word: 'Orange' },
    { name: 'sun', hex: '#FFD54A', shape: 'arch', word: 'Yellow' },
    { name: 'fern', hex: '#4FD18B', shape: 'hexagon', word: 'Green' },
    { name: 'cobalt', hex: '#6C9DFF', shape: 'square', word: 'Blue' },
    { name: 'iris', hex: '#A78BFF', shape: 'diamond', word: 'Violet' },
  ]);
  const HUE_TOKEN = { red: 'flare', rose: 'flare', orange: 'ember', yellow: 'sun', lime: 'sun', green: 'fern', teal: 'fern',
    cyan: 'cobalt', blue: 'cobalt', indigo: 'cobalt', violet: 'iris', magenta: 'iris' };
  const HUE_DEG = { flare: 10, ember: 25, sun: 46, fern: 148, cobalt: 220, iris: 255 };   // the frame colours' hues
  const PAPER = '#FAF9FC';       // the app's light --paper, for frame-colour swatches
  const MARK_PAINT = '#7350EE';  // what the mark paints when it leaves
  const THREAD_GROUPS = ['Materials', 'Qualities', 'Movements', 'Textures'];
  const SPECIAL_POINTS = { row: 60, col: 60, burst: 100, mark: 200 };
  const MOVE_LEFT = 1000;   // the finale, a move left (the playtest: finishing early must outscore farming cascades)
  const BOOSTS = ['pass', 'turn', 'more'];

  const EPISODES = Object.freeze([
    { name: 'Sort', line: 'Line things up.', from: 1, to: 5 },
    { name: 'Split', line: 'Paint with their colours.', from: 6, to: 10 },
    { name: 'Set', line: 'Clear what you passed.', from: 11, to: 15 },
    { name: 'See', line: 'Free what’s held.', from: 16, to: 20 },
    { name: 'Seed', line: 'Boards in new shapes.', from: 21, to: 25 },
    { name: 'Another five', line: 'All of it, together.', from: 26, to: 30 },
  ]);

  const MASKS = Object.freeze({
    diamond: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '...###...', '....#....'],
    ring: ['#########', '#########', '#########', '###...###', '###...###', '###...###', '#########', '#########', '#########'],
    island: ['..#####..', '.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.', '..#####..'],
    halves: ['####.####', '####.####', '####.####', '####.####', '####.####', '####.####', '####.####', '####.####', '####.####'],
    house: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '.#######.', '.#######.', '.#######.'],
    cross: ['...###...', '...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...', '...###...'],
    five: ['#########', '#########', '###......', '###......', '########.', '#########', '......###', '#########', '########.'],
  });

  const WORDS = Object.freeze({ 2: 'Good eye.', 3: 'Together.', 4: 'In tune.', 5: 'Composed.', 6: 'Sublime.', mark: 'The mark.',
    slate: 'Clean slate.', finale: 'All set.', shuffle: 'Shuffled: always three ways to go.' });

  const sc = (n) => ({ type: 'score', n }), col = (suit, n) => ({ type: 'collect', suit, n });
  const kd = (kind, n) => ({ type: 'collect', kind, n }), PAINT = { type: 'paint' }, CLEAR = { type: 'clear' };
  const bottom = (n, layers) => ({ n, layers: layers || 1, at: 'bottom' });
  function L(n, board, suits, moves, goals, stars, x) {
    return Object.assign({ n, size: Array.isArray(board) ? board : null, mask: typeof board === 'string' ? board : null,
      suits, moves, goals, paint: null, coats2: null, passes: [], held: null, stars, coach: null }, x);
  }
  // The 30, as tuned by the playtest (SPEC.md "Levels 1–30": budgets and stars from test/sim.mjs).
  const LEVELS = [
    L(1, [7, 7], 4, 15, [sc(3500)], [3500, 19000, 35000], { coach: 'swap' }),
    L(2, [7, 7], 4, 14, [col(0, 30)], [0, 21000, 31000]),
    L(3, [7, 7], 4, 18, [sc(8500)], [8500, 24000, 40000], { coach: 'stripe' }),
    L(4, [7, 7], 5, 17, [col(0, 12), col(1, 12)], [0, 13000, 17000]),
    L(5, [8, 8], 5, 20, [sc(4000)], [4000, 12000, 19000], { coach: 'burst' }),
    L(6, [7, 7], 4, 15, [PAINT], [0, 24000, 33000], { paint: 'centre:5', coach: 'paint' }),
    L(7, [7, 7], 4, 23, [PAINT], [0, 35000, 44000], { paint: 'all' }),
    L(8, [8, 8], 5, 19, [kd('image', 40)], [0, 17000, 24000], { coach: 'mark' }),
    L(9, [8, 8], 4, 14, [PAINT], [0, 35000, 56000], { paint: 'centre:6' }),
    L(10, [8, 8], 4, 18, [PAINT], [0, 50000, 71000], { paint: 'all', coats2: 'centre:4' }),
    L(11, [8, 8], 5, 22, [CLEAR], [0, 21000, 26000], { passes: [{ n: 8, layers: 1, at: 'scatter' }], coach: 'pass' }),
    L(12, [8, 8], 5, 32, [CLEAR, sc(4000)], [0, 27000, 34000], { passes: [bottom(8)] }),
    L(13, [8, 8], 4, 19, [PAINT, CLEAR], [0, 48000, 75000], { paint: 'all', passes: [bottom(12)] }),
    L(14, [8, 8], 5, 29, [CLEAR], [0, 24000, 30000], { passes: [{ n: 8, layers: 2, at: 'scatter' }] }),
    L(15, [9, 9], 4, 16, [PAINT, CLEAR], [0, 77000, 109000], { paint: 'all', passes: [{ n: 12, layers: 2, at: 'scatter' }] }),
    L(16, [8, 8], 5, 20, [col(0, 25)], [0, 16000, 22000], { held: { n: 8, at: 'scatter' }, coach: 'held' }),
    L(17, [9, 9], 4, 14, [PAINT], [0, 75000, 113000], { paint: 'all', held: { n: 10, at: 'scatter' } }),
    L(18, [9, 9], 5, 25, [sc(8000)], [8000, 17000, 25000], { held: { n: 9, at: 'centre:3' } }),
    L(19, [9, 9], 5, 31, [CLEAR], [0, 30000, 36000], { passes: [{ n: 10, layers: 1, at: 'scatter' }], held: { n: 9, at: 'scatter' } }),
    L(20, [9, 9], 4, 13, [PAINT], [0, 78000, 109000], { paint: 'all', coats2: 'centre:3', held: { n: 8, at: 'scatter' } }),
    L(21, 'diamond', 4, 17, [PAINT], [0, 23000, 29000], { paint: 'all' }),
    L(22, 'ring', 5, 20, [col(0, 20), col(1, 20), col(2, 20)], [0, 12000, 16000]),
    L(23, 'island', 5, 33, [PAINT, CLEAR], [0, 31000, 36000], { paint: 'centre:5', passes: [{ n: 10, layers: 1, at: 'sides' }] }),
    L(24, 'halves', 4, 28, [PAINT], [0, 35000, 42000], { paint: 'all' }),
    L(25, 'house', 4, 19, [PAINT], [0, 38000, 46000], { paint: 'all', coats2: 'rows:5-8' }),
    L(26, [9, 9], 5, 22, [kd('space', 60), kd('object', 60)], [0, 24000, 31000]),
    L(27, [9, 9], 4, 12, [PAINT], [0, 73000, 106000], { paint: 'all', coats2: 'centre:5' }),
    L(28, 'cross', 4, 29, [CLEAR], [0, 25000, 29000], { passes: [bottom(12, 2)], held: { n: 6, at: 'scatter' } }),
    L(29, [9, 9], 5, 36, [PAINT, CLEAR], [0, 35000, 38000], { paint: 'centre:5', passes: [bottom(18)], held: { n: 6, at: 'scatter' } }),
    L(30, 'five', 4, 50, [PAINT], [0, 36000, 37000], { paint: 'all' }),
  ];

  // ---------------------------------------------------------------- small helpers

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const isHue = (key) => typeof key === 'string' && key.indexOf('hue:') === 0;

  /** prng(seed) -> () => [0, 1): FiveS.prng (mulberry32 over its string hash). */
  function prng(seed) { return FiveS.prng(String(seed)); }

  // One mulberry32 step on the game's own state, so a Game stays plain JSON.
  function rand(g) {
    const a = (g.r + 0x6d2b79f5) | 0;
    g.r = a >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function shuffle(arr, g) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); const x = arr[i]; arr[i] = arr[j]; arr[j] = x; }
    return arr;
  }

  const rgb = (hex) => { const h = String(hex).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0); };
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  // Color Middling: each channel averaged and rounded.
  const middle = (a, b) => mix(a, b, 0.5);

  function hueOf(hex) {
    const k = Object.keys(FiveS.features({ kind: 'colour', colours: [hex] })).find(isHue);
    return k ? k.slice(4) : null;
  }

  // ---------------------------------------------------------------- levels

  function region(spec, cols, rows) {   // 'all' | 'centre:K' | 'rows:A-B' -> (r, c) => inside
    if (!spec) return () => false;
    if (spec === 'all') return () => true;
    const [type, v] = String(spec).split(':');
    if (type === 'rows') { const [a, b] = v.split('-').map(Number); return (r) => r >= a && r <= b; }
    const K = Number(v), r0 = Math.floor((rows - K) / 2), c0 = Math.floor((cols - K) / 2);
    return (r, c) => r >= r0 && r < r0 + K && c >= c0 && c < c0 + K;
  }

  const lapOf = (n) => (n > 30 ? Math.floor((n - 26) / 5) : 0);

  /** level(n) -> {n, episode, cols, rows, grid, suits, moves, goals, stars, coach}. Past 30 the 26–30
   *  recipes come round again, each lap with 2 more moves and its thresholds × 1.1. */
  function level(n) {
    n = Math.max(1, Math.floor(Number(n)) || 1);
    const lap = lapOf(n);
    const rec = LEVELS[n > 30 ? 25 + ((n - 26) % 5) : n - 1];
    const [cols, rows] = rec.mask ? [9, 9] : rec.size;
    const g = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) g.push(rec.mask && MASKS[rec.mask][r][c] !== '#' ? '.' : '#');
    const near = (i) => [i - cols, i + cols, i % cols ? i - 1 : -1, i % cols < cols - 1 ? i + 1 : -1].filter((j) => j >= 0 && j < g.length);
    // bottom: lowest row first, each row from the centre column outward; sides: each row's ends.
    const mid = Math.floor((cols - 1) / 2), outward = [mid];
    for (let d = 1; d < cols; d++) { if (mid - d >= 0) outward.push(mid - d); if (mid + d < cols) outward.push(mid + d); }
    const lists = { bottom: [], sides: [] }, ptr = { bottom: 0, sides: 0 };
    for (let r = rows - 1; r >= 0; r--) {
      for (const c of outward) if (g[r * cols + c] !== '.') lists.bottom.push(r * cols + c);
      const row = [];
      for (let c = 0; c < cols; c++) if (g[r * cols + c] !== '.') row.push(r * cols + c);
      if (row.length) lists.sides.push(row[0]);
      if (row.length > 1) lists.sides.push(row[row.length - 1]);
    }
    const rnd = prng('layout:' + n);
    const sq = (spec) => (spec && String(spec).indexOf('centre:') === 0 ? region(spec, cols, rows) : () => false);
    const keepClear = (r, c) => sq(rec.paint)(r, c) || sq(rec.coats2)(r, c);
    function place(count, ch, at) {
      if (at === 'bottom' || at === 'sides') {
        const list = lists[at];
        while (count > 0 && ptr[at] < list.length) { const i = list[ptr[at]++]; if (g[i] === '#') { g[i] = ch; count--; } }
      } else if (at === 'scatter') {
        for (; count > 0; count--) {
          const free = [];
          for (let i = cols; i < g.length; i++) {
            if (g[i] !== '#' || keepClear(Math.floor(i / cols), i % cols)) continue;
            if (near(i).some((j) => 'pPh'.indexOf(g[j]) >= 0)) continue;
            free.push(i);
          }
          if (!free.length) break;
          g[free[Math.floor(rnd() * free.length)]] = ch;
        }
      } else {
        const inside = region(at, cols, rows);
        for (let i = 0; i < g.length && count > 0; i++) if (g[i] === '#' && inside(Math.floor(i / cols), i % cols)) { g[i] = ch; count--; }
      }
    }
    for (const p of rec.passes) place(p.n, p.layers === 2 ? 'P' : 'p', p.at);
    if (rec.held) place(rec.held.n, 'h', rec.held.at);
    const paintIn = region(rec.paint, cols, rows), twoIn = region(rec.coats2, cols, rows);
    for (let i = 0; i < g.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      if (g[i] === '#' && paintIn(r, c)) g[i] = twoIn(r, c) ? 'O' : 'o';
    }
    const grid = [];
    for (let r = 0; r < rows; r++) grid.push(g.slice(r * cols, (r + 1) * cols).join(''));
    const k = Math.pow(1.1, lap);
    return {
      n, episode: (EPISODES.find((e) => n >= e.from && n <= e.to) || EPISODES[EPISODES.length - 1]).name,
      cols, rows, grid, suits: rec.suits, moves: rec.moves + 2 * lap,
      goals: rec.goals.map((x) => Object.assign({}, x)),
      stars: rec.stars.map((s) => (lap ? Math.round((s * k) / 100) * 100 : s)),
      coach: lap ? null : rec.coach,
    };
  }

  /** area(k) -> {k, name, line, from, to}: the kingdom's areas, the episodes' order; past the sixth, Another five 2, 3, … */
  function areaOf(k) {
    k = Math.max(0, Math.floor(Number(k)) || 0);
    const e = EPISODES[k] || { name: 'Another five ' + (k - 4), line: EPISODES[5].line };
    return { k, name: e.name, line: e.line, from: 5 * k + 1, to: 5 * k + 5 };
  }

  // ---------------------------------------------------------------- pieces: your threads as suits

  const threadGroup = (key, deck) => (isHue(key) ? 'Colours' : FiveS.featureGroup(key, deck));
  function threadsOf(card, deck) {   // {key: weight}: the thing's thread keys with weight >= 0.3
    const f = FiveS.features(card), out = {};
    for (const k in f) if (f[k] >= 0.3 && (isHue(k) || THREAD_GROUPS.indexOf(FiveS.featureGroup(k, deck)) >= 0)) out[k] = f[k];
    return out;
  }
  function keptCards(st, deck, prof) {   // kind order, newest first within a kind
    const out = [];
    for (const kind of FiveS.KINDS) for (const id of prof.keptByKind[kind] || []) { const c = FiveS.card(st, deck, id); if (c) out.push(c); }
    return out;
  }
  function chunks(pool, rot) {   // three at a time, the last padded from the start; rotated by rot
    const out = [];
    for (let i = 0; i < pool.length; i += 3) out.push([0, 1, 2].map((j) => pool[(i + j) % pool.length]));
    const r = out.length ? rot % out.length : 0;
    return out.slice(r).concat(out.slice(0, r));
  }

  /** pieces(state, deck, n) -> {suits:[Suit × n], passed:[id], out:[id]} (SPEC.md "Choosing the threads"). */
  function pieces(state, deck, n) {
    n = Math.max(1, Math.min(TOKENS.length, Math.floor(n) || 1));
    const st = FiveS.migrate(state || FiveS.newState());
    const prof = FiveS.profile(st, deck);
    const lift = {};
    for (const grp in prof.groups) for (const e of prof.groups[grp]) if (e.n >= 3) lift[e.key] = Math.max(0, e.lift);
    const things = keptCards(st, deck, prof);
    const th = things.map((c) => threadsOf(c, deck));
    const members = {};
    th.forEach((t, i) => { for (const k in t) (members[k] = members[k] || []).push(i); });
    const cands = Object.keys(members)
      .filter((k) => members[k].length >= 3 && new Set(members[k].map((i) => things[i].kind)).size >= 2)
      .map((k) => ({ key: k, m: members[k], group: threadGroup(k, deck), score: Math.min(members[k].length, 12) * (1 + (lift[k] || 0)) }))
      .sort((a, b) => b.score - a.score || cmp(a.key, b.key));
    const jaccard = (a, b) => { const s = new Set(a.m); const i = b.m.filter((x) => s.has(x)).length; return i / (a.m.length + b.m.length - i); };
    const pick = [];
    for (const cap of [2, Infinity]) for (const c of cands) {
      if (pick.length >= n) break;
      if (pick.indexOf(c) >= 0 || pick.filter((p) => p.group === c.group).length >= cap || pick.some((p) => jaccard(p, c) >= 0.6)) continue;
      pick.push(c);
    }
    // Each thing to the picked thread where weight × (1 + lift) is largest; ties to the earlier pick.
    const suitOf = things.map((c, i) => {
      let best = -1, bv = 0;
      pick.forEach((p, j) => { const v = (th[i][p.key] || 0) * (1 + (lift[p.key] || 0)); if (th[i][p.key] && v >= 0.3 && v > bv) { bv = v; best = j; } });
      return best;
    });
    const size = (j) => suitOf.filter((x) => x === j).length;
    pick.forEach((p, j) => {   // a thread left with < 2 takes back its own from threads holding >= 4
      const back = p.m.filter((i) => suitOf[i] !== j).sort((a, b) => th[b][p.key] - th[a][p.key] || a - b);
      for (const i of back) { if (size(j) >= 2) break; if (suitOf[i] >= 0 && size(suitOf[i]) >= 4) suitOf[i] = j; }
    });
    const suits = pick.map((p) => ({ key: p.key }));
    const hues = FiveS.HUES.map((h) => 'hue:' + h).concat('hue:neutral');
    while (suits.length < n) {   // hue families by members, taking only things not yet in a suit
      let best = null, bm = [];
      for (const k of hues) {
        if (suits.some((s) => s.key === k)) continue;
        const m = things.map((c, i) => i).filter((i) => suitOf[i] < 0 && th[i][k]);
        if (m.length > bm.length) { best = k; bm = m; }
      }
      if (!best) break;
      for (const i of bm) suitOf[i] = suits.length;
      suits.push({ key: best });
    }
    while (suits.length < n) suits.push({ key: null });
    // Tokens: a hue thread takes its family's (first come), every other suit the free ones in order.
    const free = TOKENS.map((t) => t.name), token = [];
    suits.forEach((s, j) => {
      const h = isHue(s.key) ? HUE_TOKEN[s.key.slice(4)] : null;
      if (h && free.indexOf(h) >= 0) { token[j] = h; free.splice(free.indexOf(h), 1); }
    });
    // The rest take the free token farthest in hue from those taken (the playtest: red, orange and yellow frames
    // side by side read as one at a glance); ties: table order.
    const gap = (x, y) => { const d = Math.abs(HUE_DEG[x] - HUE_DEG[y]); return Math.min(d, 360 - d); };
    const near = (t) => Math.min(360, ...token.filter(Boolean).map((u) => gap(t, u)));
    suits.forEach((s, j) => {
      if (token[j]) return;
      token[j] = free.reduce((best, t) => (near(t) > near(best) ? t : best));
      free.splice(free.indexOf(token[j]), 1);
    });
    const kept = prof.keptColours || [];
    let swatchSuits = 0;
    const out = suits.map((s, j) => {
      const t = TOKENS.find((x) => x.name === token[j]);
      const mine = things.filter((c, i) => suitOf[i] === j);
      let swatches = [];
      if (!mine.length) {
        const hue = isHue(s.key) ? s.key.slice(4) : null;
        swatches = chunks(hue ? kept.filter((h) => hueOf(h) === hue) : kept, hue ? 0 : swatchSuits++);
        if (!swatches.length) swatches = [[t.hex, mix(t.hex, PAPER, 0.3), mix(t.hex, PAPER, 0.6)]];
      }
      return {
        key: s.key, label: s.key ? FiveS.featureLabel(s.key, deck) : t.word, token: t.name, hex: t.hex, shape: t.shape,
        ids: mine.map((c) => c.id), kinds: mine.map((c) => c.kind), firsts: mine.map((c) => FiveS.normHex((c.colours || [])[0])), swatches,   // #rrggbb: a painting's cells are six hex digits
      };
    });
    // Passed: deck cards whose latest judgment is a pass, then let-go brought things; newest first.
    const inDeck = new Set(((deck && deck.cards) || []).map((c) => c.id));
    const last = new Map();
    for (const e of st.j) if (Array.isArray(e) && inDeck.has(e[0])) { last.delete(e[0]); last.set(e[0], e); }
    const passed = Array.from(last.values()).filter((e) => !(e[1] === 1 || e[1] === true)).sort((a, b) => b[3] - a[3]).map((e) => e[0])
      .concat(st.own.filter((o) => o && o.let != null).sort((a, b) => b.let - a.let).map((o) => o.id));
    return { suits: out, passed, out: things.filter((c, i) => suitOf[i] < 0).map((c) => c.id) };
  }

  // ---------------------------------------------------------------- the board

  function newTile(g, s) {
    const u = g.suits[s], len = u.ids.length || u.swatches.length || 1, at = (u.at || 0) % len;
    u.at = (at + 1) % len;
    return { k: g.k++, s, o: u.ids.length ? u.ids[at] : null, sw: !u.ids.length && u.swatches.length ? at : null, sp: null, held: false, armed: false };
  }
  // The ring: kinds interleaved (image, object, space, surface, colour, again), shuffled within a kind.
  function ring(g, s) {
    const kinds = s.kinds || [], by = {}, order = [];
    s.ids.forEach((id, i) => { const k = kinds[i] || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(i); });
    const rank = (k) => { const i = FiveS.KINDS.indexOf(k); return i < 0 ? 99 : i; };
    order.sort((a, b) => rank(a) - rank(b) || cmp(a, b));
    for (const k of order) shuffle(by[k], g);
    const idx = [];
    for (let round = 0; idx.length < s.ids.length; round++) for (const k of order) if (round < by[k].length) idx.push(by[k][round]);
    return Object.assign({}, s, {
      ids: idx.map((i) => s.ids[i]), kinds: idx.map((i) => kinds[i] || null), firsts: idx.map((i) => (s.firsts || [])[i] || null),
      swatches: (s.swatches || []).map((x) => x.slice()), at: 0,
    });
  }

  function suitArr(g) {
    const S = new Int8Array(g.cells.length);
    for (let i = 0; i < S.length; i++) { const t = g.cells[i].t; S[i] = t && t.s >= 0 ? t.s : -1; }
    return S;
  }
  function lineAt(S, cols, rows, i) {
    const s = S[i];
    if (s < 0) return false;
    const r = (i / cols) | 0, c = i % cols;
    let n = 1;
    for (let q = c - 1; q >= 0 && S[r * cols + q] === s; q--) n++;
    for (let q = c + 1; q < cols && S[r * cols + q] === s; q++) n++;
    if (n >= 3) return true;
    n = 1;
    for (let q = r - 1; q >= 0 && S[q * cols + c] === s; q--) n++;
    for (let q = r + 1; q < rows && S[q * cols + c] === s; q++) n++;
    return n >= 3;
  }
  // Runs of 3+ of one suit (held tiles count, the mark never does); runs sharing a tile are one group.
  function findGroups(S, cols, rows) {
    const runs = [];
    const scan = (outer, inner, at, h) => {
      for (let a = 0; a < outer; a++) for (let b = 0; b < inner;) {
        const s = S[at(a, b)];
        let e = b + 1;
        while (s >= 0 && e < inner && S[at(a, e)] === s) e++;
        if (s >= 0 && e - b >= 3) { const cells = []; for (let q = b; q < e; q++) cells.push(at(a, q)); runs.push({ h, cells }); }
        b = e;
      }
    };
    scan(rows, cols, (r, c) => r * cols + c, true);
    scan(cols, rows, (c, r) => r * cols + c, false);
    if (!runs.length) return [];
    const parent = runs.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const owner = new Int16Array(S.length).fill(-1);
    runs.forEach((run, i) => { for (const c of run.cells) { if (owner[c] >= 0) parent[find(i)] = find(owner[c]); else owner[c] = i; } });
    const by = new Map();
    runs.forEach((run, i) => { const r = find(i); if (!by.has(r)) by.set(r, { runs: [], cells: [], suit: S[run.cells[0]] }); by.get(r).runs.push(run); });
    const out = Array.from(by.values());
    for (const grp of out) grp.cells = Array.from(new Set([].concat(...grp.runs.map((r) => r.cells)))).sort((a, b) => a - b);
    return out.sort((a, b) => a.cells[0] - b.cells[0]);
  }
  function specialOf(grp) {
    const long = Math.max(...grp.runs.map((r) => r.cells.length));
    if (long >= 5) return 'mark';
    if (grp.runs.some((r) => r.h) && grp.runs.some((r) => !r.h)) return 'burst';
    if (long === 4) return grp.runs[0].h ? 'col' : 'row';   // a horizontal four makes a column stripe
    return null;
  }
  function placeOf(g, grp, sp, swap) {
    const has = (c) => c != null && grp.cells.indexOf(c) >= 0;
    let at;
    if (swap && has(swap.b)) at = swap.b;
    else if (swap && has(swap.a)) at = swap.a;
    else if (sp === 'burst') {
      const h = new Set([].concat(...grp.runs.filter((r) => r.h).map((r) => r.cells)));
      at = grp.cells.find((c) => h.has(c) && grp.runs.some((r) => !r.h && r.cells.indexOf(c) >= 0));
    } else {
      const run = grp.runs.reduce((a, r) => (r.cells.length > a.cells.length ? r : a));
      const L = run.cells.length;
      at = run.cells[L % 2 ? (L - 1) / 2 : run.h ? L / 2 - 1 : L / 2];   // the left / lower middle
    }
    const t = g.cells[at].t;
    return t && t.held ? grp.cells.find((c) => !g.cells[c].t.held) ?? at : at;
  }

  const movable = (t) => !!t && !t.held;
  const tiles = (g, pred) => g.cells.reduce((out, c, i) => (c.t && pred(c.t, i) ? out.concat(i) : out), []);
  function adjacent(g, a, b) {
    const N = g.cells.length;
    if (!(a >= 0 && b >= 0 && a < N && b < N)) return false;
    const d = Math.abs(a - b);
    return d === g.cols || (d === 1 && Math.floor(a / g.cols) === Math.floor(b / g.cols));
  }
  function counted(g, S, a, b) {
    const ta = g.cells[a].t, tb = g.cells[b].t;
    if (!movable(ta) || !movable(tb)) return false;
    if ((ta.sp && tb.sp) || ta.sp === 'mark' || tb.sp === 'mark') return true;
    S[a] = tb.s; S[b] = ta.s;
    const ok = lineAt(S, g.cols, g.rows, a) || lineAt(S, g.cols, g.rows, b);
    S[a] = ta.s; S[b] = tb.s;
    return ok;
  }
  function listMoves(g, stop) {
    const out = [], S = suitArr(g), N = g.cells.length;
    for (let a = 0; a < N; a++) {
      const right = a % g.cols < g.cols - 1 ? a + 1 : -1, down = a + g.cols < N ? a + g.cols : -1;
      for (const b of [right, down]) {
        if (b >= 0 && counted(g, S, a, b)) { out.push([a, b]); if (stop && out.length >= stop) return out; }
      }
    }
    return out;
  }
  function swapTiles(g, a, b) { const t = g.cells[a].t; g.cells[a].t = g.cells[b].t; g.cells[b].t = t; }

  // What wave 1 of the swap a -> b would do: {n: cells it clears (combos and the mark: 10), makes: [sp]}.
  function preview(g, a, b) {
    const ta = g.cells[a].t, tb = g.cells[b].t;
    if ((ta.sp && tb.sp) || ta.sp === 'mark' || tb.sp === 'mark') return { n: 10, makes: [] };
    const S = suitArr(g);
    S[a] = tb.s; S[b] = ta.s;
    const groups = findGroups(S, g.cols, g.rows).filter((x) => x.cells.indexOf(a) >= 0 || x.cells.indexOf(b) >= 0);
    return { n: groups.reduce((s, x) => s + x.cells.length, 0), makes: groups.map(specialOf).filter(Boolean) };
  }
  const makesKind = (sp) => (sp === 'row' || sp === 'col' ? 'stripe' : sp);

  function fill(g, held) {
    g.k = 0;
    for (const u of g.suits) u.at = 0;
    const S = new Int8Array(g.cells.length).fill(-1), { cols } = g;
    g.cells.forEach((c, i) => {
      c.t = null;
      if (c.hole || c.pass) return;
      const r = Math.floor(i / cols), col = i % cols;
      let s;
      do s = Math.floor(rand(g) * g.suits.length);
      while ((col >= 2 && S[i - 1] === s && S[i - 2] === s) || (r >= 2 && S[i - cols] === s && S[i - 2 * cols] === s));
      S[i] = s;
      c.t = newTile(g, s);
      c.t.held = held[i];
    });
  }

  /** newGame(level, pieces, seed) -> Game: no runs, >= 3 counted swaps, and on a coach level a swap
   *  that makes its special (<= 200 boards). pieces must hold at least level.suits suits. */
  function newGame(lv, pc, seed) {
    const g = {
      v: 1, n: lv.n, cols: lv.cols, rows: lv.rows, r: Math.floor(prng(seed)() * 4294967296) >>> 0,
      suits: [], cells: [], moves: lv.moves, score: 0, k: 0, goals: [], groups: [],
      made: { stripe: 0, burst: 0, mark: 0 }, more: false, state: 'play', used: 0, stars: lv.stars.slice(), coach: lv.coach || null,
    };
    g.suits = pc.suits.slice(0, lv.suits).map((s) => ring(g, s));
    const passed = pc.passed || [], held = [];
    let pi = 0;
    for (const row of lv.grid) for (const ch of row) {
      const pass = ch === 'p' ? 1 : ch === 'P' ? 2 : 0;
      g.cells.push({ hole: ch === '.', coats: ch === 'o' ? 1 : ch === 'O' ? 2 : 0, first: null, colour: null, pass,
        pid: pass && passed.length ? passed[pi++ % passed.length] : null, t: null });
      held.push(ch === 'h');
    }
    g.goals = lv.goals.map((x) => {
      if (x.type === 'paint') return { type: 'paint', n: g.cells.filter((c) => c.coats).length, have: 0 };
      if (x.type === 'clear') return { type: 'clear', n: g.cells.reduce((s, c) => s + c.pass, 0), have: 0 };
      if (x.type === 'collect' && x.kind) {
        const share = g.suits.reduce((s, u) => s + (u.ids.length ? u.kinds.filter((k) => k === x.kind).length / u.ids.length : 0), 0) / g.suits.length;
        if (!share) return { type: 'collect', suit: 0, n: x.n, have: 0 };
        return { type: 'collect', kind: x.kind, n: Math.max(4, Math.round(x.n * Math.min(1, share / 0.25))), have: 0 };
      }
      return Object.assign({}, x, { have: 0 });
    });
    const want = { stripe: 'stripe', burst: 'burst', mark: 'mark' }[g.coach];
    let keep = null;
    for (let tries = 0; tries < 200; tries++) {
      fill(g, held);
      const ms = listMoves(g, want ? 0 : 3);
      if (ms.length < 3) continue;
      if (!want || ms.some(([a, b]) => preview(g, a, b).makes.some((sp) => makesKind(sp) === want))) { keep = null; break; }
      if (!keep) keep = JSON.stringify({ cells: g.cells, suits: g.suits, k: g.k });
    }
    if (keep) Object.assign(g, JSON.parse(keep));   // no board taught the special: the first with three ways
    reshuffle(g, []);   // only if no board gave three ways
    return g;
  }

  // ---------------------------------------------------------------- resolving

  const stopper = (c) => c.hole || c.pass > 0 || (c.t && c.t.held);
  // Straight gravity; the top cell of every column segment (under the edge, a hole, a pass or a held
  // tile) is a source, so each segment refills from its top.
  function gravity(g, ws) {
    const { cols, rows, cells } = g;
    for (let c = 0; c < cols; c++) {
      for (let r = rows - 1; r >= 0;) {
        if (stopper(cells[r * cols + c])) { r--; continue; }
        let top = r;
        while (top > 0 && !stopper(cells[(top - 1) * cols + c])) top--;
        let wr = r;
        for (let q = r; q >= top; q--) {
          const t = cells[q * cols + c].t;
          if (!t) continue;
          if (q !== wr) { cells[wr * cols + c].t = t; cells[q * cols + c].t = null; ws.push({ e: 'fall', k: t.k, from: q * cols + c, to: wr * cols + c }); }
          wr--;
        }
        const n = wr - top + 1;
        for (let q = wr; q >= top; q--) {
          const t = newTile(g, Math.floor(rand(g) * g.suits.length));
          cells[q * cols + c].t = t;
          ws.push({ e: 'drop', cell: q * cols + c, tile: Object.assign({}, t), n });
        }
        r = top - 1;
      }
    }
  }

  function area(g, cell, shape, radius) {   // playable cells, row-major
    const R = Math.floor(cell / g.cols), C = cell % g.cols, out = [];
    for (let i = 0; i < g.cells.length; i++) {
      if (g.cells[i].hole) continue;
      const dr = Math.abs(Math.floor(i / g.cols) - R), dc = Math.abs((i % g.cols) - C);
      if (shape === 'row' ? dr === 0 : shape === 'col' ? dc === 0 : shape === 'cross' ? dr === 0 || dc === 0
        : shape === 'cross3' ? dr <= 1 || dc <= 1 : shape === 'all' ? true : Math.max(dr, dc) <= radius) out.push(i);
    }
    return out;
  }
  function tileColour(g, t) {
    if (t.sp === 'mark') return MARK_PAINT;
    const u = g.suits[t.s];
    if (t.o != null) return u.firsts[u.ids.indexOf(t.o)] || u.hex;
    return (t.sw != null && u.swatches[t.sw] && u.swatches[t.sw][0]) || u.hex;
  }
  const kindOf = (g, t) => { const u = t.s >= 0 && t.o != null ? g.suits[t.s] : null; return u ? u.kinds[u.ids.indexOf(t.o)] : null; };
  const met = (x, g) => (x.type === 'score' ? g.score >= x.n : x.have >= x.n);

  // Resolves waves until nothing moves. first: {a, b} for a swap (b: the cell dragged into), {cell}
  // for the Pass booster, null for the finale. by: 'you' (a swap or Turn), 'pass' or 'finale'.
  function resolve(g, steps, first, by) {
    const { cols, cells } = g, N = cells.length, fin = by === 'finale';
    let deep = 0;
    for (let w = 1; w <= 200; w++) {
      const mult = Math.min(w, 5);
      const inClear = new Uint8Array(N), blast = new Uint8Array(N), matched = new Int16Array(N).fill(-1);
      const protect = new Uint8Array(N), stay = new Uint8Array(N), fired = new Uint8Array(N), src = new Int16Array(N).fill(-1);
      const queue = [], sources = [], makes = [], ws = [{ e: 'wave', n: w }];
      const source = (cell) => sources.push({ cell, add: 0 }) - 1;
      const add = (i, si, isBlast) => {
        if (cells[i].hole || protect[i]) return;
        if (isBlast) blast[i] = 1;
        if (inClear[i]) return;
        inClear[i] = 1; src[i] = si;
        const t = cells[i].t;
        if (t && t.sp && !fired[i]) queue.push(i);
      };
      const swap = w === 1 && first && first.a != null ? first : null;
      const ta = swap && cells[swap.b].t, tb = swap && cells[swap.a].t;   // after the swap: a's tile is at b
      let groups = [];
      if (w === 1 && first && first.cell != null) add(first.cell, source(first.cell), true);
      else if (swap && ((ta.sp && tb.sp) || ta.sp === 'mark' || tb.sp === 'mark')) combo(g, swap, ta, tb);
      else groups = findGroups(suitArr(g), cols, g.rows);
      for (const grp of groups) {
        const sp = specialOf(grp), at = sp ? placeOf(g, grp, sp, swap) : -1, si = source(at >= 0 ? at : grp.cells[grp.cells.length >> 1]);
        if (sp) { protect[at] = 1; makes.push({ cell: at, sp, si }); if (cells[at].t.sp) queue.push(at); }
        const ids = Array.from(new Set(grp.cells.map((c) => cells[c].t.o).filter((o) => o != null)));
        const mine = w === 1 && by === 'you';
        ws.push({ e: 'match', cells: grp.cells, suit: grp.suit, ids, by: mine ? 'you' : 'cascade' });
        if (mine && ids.length >= 2) g.groups.push({ ids, suit: grp.suit });
        for (const c of grp.cells) { matched[c] = si; add(c, si, false); }
      }
      if (w > 1 || fin) for (let i = 0; i < N; i++) { const t = cells[i].t; if (t && t.sp && (fin || t.armed)) add(i, source(i), true); }
      while (queue.length) fire(queue.shift());
      if (!inClear.some((x) => x) && !makes.length) break;
      deep = w;

      // Apply, row-major.
      const before = g.goals.map((x) => x.have);
      const credit = (si, pts) => { if (si >= 0) sources[si].add += pts; };
      const goal = (pred) => g.goals.forEach((x) => { if (pred(x)) x.have = Math.min(x.n, x.have + 1); });
      for (let i = 0; i < N; i++) {
        const c = cells[i], t = c.t;
        if (inClear[i] && t && !stay[i]) {
          if (t.held) { t.held = false; ws.push({ e: 'free', cell: i }); credit(src[i], 50); }
          else {
            c.t = null;
            ws.push({ e: 'clear', cell: i, k: t.k });
            credit(src[i], 20 * mult);
            const kind = kindOf(g, t);
            goal((x) => x.type === 'collect' && (x.kind ? x.kind === kind : t.s === x.suit));
            if (c.coats && !c.colour) {
              const hex = tileColour(g, t);
              if (c.coats === 2 && !c.first) c.first = hex.toLowerCase();
              else { c.colour = c.coats === 2 ? middle(c.first, hex) : hex.toLowerCase(); if (!c.first) c.first = c.colour; goal((x) => x.type === 'paint'); }
              ws.push({ e: 'paint', cell: i, colour: c.colour || c.first, left: c.colour ? 0 : 1 });
              credit(src[i], 50);
            }
          }
        }
        if (c.pass > 0) {
          let si = blast[i] ? src[i] : -1;
          if (si < 0) for (const j of [i - cols, i + cols, i % cols ? i - 1 : -1, i % cols < cols - 1 ? i + 1 : -1]) if (j >= 0 && j < N && matched[j] >= 0) { si = matched[j]; break; }
          if (si >= 0 || blast[i]) {
            c.pass--;
            ws.push({ e: 'block', cell: i, left: c.pass, id: c.pid });
            credit(si, 50);
            goal((x) => x.type === 'clear');
          }
        }
      }
      for (const m of makes) {
        const t = cells[m.cell].t;
        if (!t) continue;
        const nt = m.sp === 'mark' ? { k: t.k, s: -1, o: null, sw: null, sp: 'mark', held: false, armed: false }
          : Object.assign({}, t, { sp: m.sp, held: false, armed: false });
        cells[m.cell].t = nt;
        g.made[makesKind(m.sp)]++;
        credit(m.si, SPECIAL_POINTS[m.sp]);
        ws.push({ e: 'make', cell: m.cell, tile: Object.assign({}, nt) });
        if (m.sp === 'mark' && !fin) ws.push({ e: 'word', text: WORDS.mark });
      }
      for (const s of sources) if (s.add) { g.score += s.add; ws.push({ e: 'score', add: s.add, total: g.score, cell: s.cell }); }
      g.goals.forEach((x, i) => { if (x.type === 'score') x.have = Math.min(x.n, g.score); if (x.have !== before[i]) ws.push({ e: 'goal', i, have: x.have }); });
      gravity(g, ws);
      for (const s of ws) steps.push(s);

      function fire(cell) {
        if (fired[cell]) return;
        fired[cell] = 1;
        const t = cells[cell].t;
        if (!t || !t.sp) return;
        let sp = t.sp, hit;
        if (sp === 'mark') {   // hit by a blast: the most common suit (ties: the lowest)
          const n = g.suits.map(() => 0);
          cells.forEach((c, i) => { if (c.t && c.t.s >= 0 && !inClear[i]) n[c.t.s]++; });
          const s = n.indexOf(Math.max(...n));
          hit = [];
          cells.forEach((c, i) => { if (c.t && c.t.s === s && !inClear[i]) hit.push(i); });
        } else if (sp === 'burst') {
          const again = !!t.armed, r = t.armed === 2 ? 2 : 1;
          if (r === 2) sp = 'burst2';
          hit = area(g, cell, 'square', r).filter((i) => again || i !== cell);
          if (!again) { stay[cell] = 1; t.armed = true; }   // a burst that fires for the first time stays, armed
        } else hit = area(g, cell, sp);
        ws.push({ e: 'fire', cell, sp, cells: hit });
        const si = source(cell);
        for (const i of hit) add(i, si, true);
      }

      // Two specials swapped, or the mark: centred on the cell the tile was dragged into (b).
      function combo(g2, sw, x, y) {   // x: the tile now at b, y: the tile now at a
        const { a, b } = sw, kinds = [x.sp, y.sp], si = source(b);
        const stripe = (sp) => sp === 'row' || sp === 'col';
        const blastAll = (sp, centre, hit) => { ws.push({ e: 'fire', cell: centre, sp, cells: hit }); for (const i of hit) add(i, si, true); };
        if (x.sp === 'mark' && y.sp === 'mark') {
          for (let i = 0; i < N; i++) fired[i] = 1;   // every tile clears, every pass loses a layer, every held tile is freed
          ws.push({ e: 'word', text: WORDS.slate });
          blastAll('mark+mark', b, area(g2, b, 'all'));
          return;
        }
        if (x.sp === 'mark' || y.sp === 'mark') {
          const mc = x.sp === 'mark' ? b : a, oc = mc === b ? a : b, o = cells[oc].t;
          fired[mc] = 1;
          add(mc, si, true);
          if (!o.sp) { blastAll('mark+tile', mc, tiles(g2, (t) => t.s === o.s)); return; }
          const conv = tiles(g2, (t, i) => i !== oc && t.s === o.s && !t.sp && !t.held);
          ws.push({ e: 'fire', cell: mc, sp: o.sp === 'burst' ? 'mark+burst' : 'mark+stripe', cells: [oc].concat(conv).sort((p, q) => p - q) });
          for (const i of conv) {   // the ribbon reaches each, which becomes the special, then all fire
            cells[i].t.sp = o.sp === 'burst' ? 'burst' : rand(g2) < 0.5 ? 'row' : 'col';
            ws.push({ e: 'make', cell: i, tile: Object.assign({}, cells[i].t) });
          }
          add(oc, si, true);
          for (const i of conv) add(i, si, true);
          return;
        }
        fired[a] = fired[b] = 1;
        add(a, si, true); add(b, si, true);
        if (stripe(x.sp) && stripe(y.sp)) blastAll('stripe+stripe', b, area(g2, b, 'cross'));
        else if (kinds.indexOf('burst') >= 0 && kinds.some(stripe)) blastAll('stripe+burst', b, area(g2, b, 'cross3'));
        else {   // burst + burst: the 5×5 clears, the burst falls, the 5×5 clears again
          stay[b] = 1; x.armed = 2;
          blastAll('burst+burst', b, area(g2, b, 'square', 2).filter((i) => i !== b));
        }
      }
    }
    if (!fin && deep >= 2) steps.push({ e: 'word', text: WORDS[Math.min(deep, 6)] });
  }

  // Three ways, always: fewer than 3 counted swaps -> permute the movable tiles (<= 100 tries), then
  // draw their suits afresh. No move is spent.
  function reshuffle(g, steps) {
    if (listMoves(g, 3).length >= 3) return;
    const mov = tiles(g, (t) => !t.held);
    if (mov.length < 2) return;
    const orig = mov.map((i) => g.cells[i].t);
    const ok = () => !findGroups(suitArr(g), g.cols, g.rows).length && listMoves(g, 3).length >= 3;
    for (let tries = 0; tries < 100; tries++) {
      const ts = shuffle(orig.slice(), g);
      mov.forEach((i, j) => { g.cells[i].t = ts[j]; });
      if (ok()) { steps.push({ e: 'shuffle', moves: mov.map((i) => [g.cells[i].t.k, i]) }, { e: 'word', text: WORDS.shuffle }); return; }
    }
    mov.forEach((i, j) => { g.cells[i].t = orig[j]; });
    const fresh = [];
    for (let tries = 0; tries < 100 && !ok(); tries++) {
      for (const i of mov) {
        if (g.cells[i].t.sp) continue;
        const S = suitArr(g);
        let s = 0;
        for (let d = 0; d < 8; d++) { s = Math.floor(rand(g) * g.suits.length); S[i] = s; if (!lineAt(S, g.cols, g.rows, i)) break; }
        if (!fresh.some((f) => f.cell === i)) fresh.push({ cell: i, k: g.cells[i].t.k });
        g.cells[i].t = newTile(g, s);
      }
    }
    for (const f of fresh) steps.push({ e: 'clear', cell: f.cell, k: f.k }, { e: 'drop', cell: f.cell, tile: Object.assign({}, g.cells[f.cell].t), n: 0 });
    steps.push({ e: 'shuffle', moves: [] }, { e: 'word', text: WORDS.shuffle });
  }

  function endCheck(g, steps) {
    if (g.state !== 'play') return;
    const scoreOnly = g.goals.every((x) => x.type === 'score');
    if (scoreOnly ? g.moves <= 0 && g.goals.every((x) => met(x, g)) : g.goals.every((x) => met(x, g))) g.state = 'won';
    else if (g.moves <= 0) g.state = 'out';
    if (g.state !== 'play') steps.push({ e: 'end', state: g.state });
  }
  function settle(g, steps) { reshuffle(g, steps); endCheck(g, steps); }

  // ---------------------------------------------------------------- moves

  /** canSwap(game, a, b) -> whether swapping a into b counts (spends a move). */
  function canSwap(game, a, b) {
    return !!game && game.state === 'play' && adjacent(game, a, b) && counted(game, suitArr(game), a, b);
  }

  /** swap(game, a, b) -> {game, valid, steps}: a is the pressed tile, b the neighbour it was dragged into. */
  function swap(game, a, b) {
    if (!canSwap(game, a, b)) return { game, valid: false, steps: [{ e: 'bounce', a, b }] };
    const g = clone(game), steps = [{ e: 'swap', a, b }];
    swapTiles(g, a, b);
    g.moves--; g.used++;
    resolve(g, steps, { a, b }, 'you');
    settle(g, steps);
    return { game: g, valid: true, steps };
  }

  /** moves(game) -> every counted swap [a, b], a < b. */
  function moves(game) { return game && game.state === 'play' ? listMoves(game, 0) : []; }

  /** hint(game, prefer?) -> [a, b] | null: the swap whose wave 1 clears most (combos and the mark count
   *  10; ties: the lowest cells); with prefer ('stripe' | 'burst' | 'mark'), one that makes it, if any. */
  function hint(game, prefer) {
    let best = null, bn = -1, pref = null, pn = -1;
    for (const [a, b] of moves(game)) {
      const p = preview(game, a, b);
      if (p.n > bn) { bn = p.n; best = [a, b]; }
      if (prefer && p.makes.some((sp) => makesKind(sp) === prefer) && p.n > pn) { pn = p.n; pref = [a, b]; }
    }
    return pref || best;
  }

  /** boost(game, 'pass', cell) | (game, 'turn', [a, b]) | (game, 'more') -> {game, ok, steps}. None spends a move. */
  function boost(game, kind, arg) {
    const no = { game, ok: false, steps: [] };
    if (!game) return no;
    if (kind === 'more') {
      if (game.more || (game.state !== 'play' && game.state !== 'out')) return no;
      const g = clone(game);
      g.moves += 5; g.more = true; g.state = 'play';
      return { game: g, ok: true, steps: [{ e: 'boost', kind }] };
    }
    if (game.state !== 'play') return no;
    if (kind === 'pass') {
      const c = game.cells[arg];
      if (!c || c.hole || !(c.t || c.pass > 0)) return no;
      const g = clone(game), steps = [{ e: 'boost', kind }];
      resolve(g, steps, { cell: arg }, 'pass');
      settle(g, steps);
      return { game: g, ok: true, steps };
    }
    if (kind === 'turn') {
      const [a, b] = Array.isArray(arg) ? arg : [];
      if (!adjacent(game, a, b) || !movable(game.cells[a].t) || !movable(game.cells[b].t)) return no;
      const counts = counted(game, suitArr(game), a, b);
      const g = clone(game), steps = [{ e: 'boost', kind }, { e: 'swap', a, b }];
      swapTiles(g, a, b);
      if (counts) resolve(g, steps, { a, b }, 'you');
      settle(g, steps);
      return { game: g, ok: true, steps };
    }
    return no;
  }

  /** finale(game) -> {game, steps}: "All set." Each move left stripes a random plain tile (+1,000), then
   *  every special fires, in waves; nothing is recorded and nothing repainted. Once, from 'won'; then 'done'. */
  function finale(game) {
    if (!game || game.state !== 'won') return { game, steps: [] };
    const g = clone(game), steps = [{ e: 'word', text: WORDS.finale }];
    for (; g.moves > 0; g.moves--) {
      const plain = tiles(g, (t) => !t.sp && !t.held && t.s >= 0);
      let cell = null;
      if (plain.length) {
        cell = plain[Math.floor(rand(g) * plain.length)];
        const t = g.cells[cell].t;
        t.sp = rand(g) < 0.5 ? 'row' : 'col';
        steps.push({ e: 'make', cell, tile: Object.assign({}, t) });
      }
      g.score += MOVE_LEFT;
      steps.push({ e: 'score', add: MOVE_LEFT, total: g.score, cell });
    }
    resolve(g, steps, null, 'finale');
    g.goals.forEach((x) => { if (x.type === 'score') x.have = Math.min(x.n, g.score); });
    g.state = 'done';
    steps.push({ e: 'end', state: 'done' });
    return { game: g, steps };
  }

  /** result(game) -> {n, won, stars, score, movesLeft, used, goals, groups, painting, made}. */
  function result(game) {
    const g = game, won = g.state === 'won' || g.state === 'done', s = g.stars || [0, 0, 0];
    const scoreOnly = g.goals.every((x) => x.type === 'score');
    const stars = !won ? 0 : scoreOnly ? s.filter((t) => t > 0 && g.score >= t).length : 1 + (g.score >= s[1] ? 1 : 0) + (g.score >= s[2] ? 1 : 0);
    const seen = new Set(), groups = [];
    for (let i = g.groups.length - 1; i >= 0 && groups.length < 12; i--) {
      const x = g.groups[i], key = x.ids.slice().sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const u = g.suits[x.suit] || {};
      groups.push({ ids: x.ids.slice(), key: u.key || null, label: u.label || null });
    }
    const painting = g.cells.some((c) => c.coats)
      ? { cols: g.cols, rows: g.rows, c: g.cells.map((c) => (c.colour ? c.colour.slice(1).toLowerCase() : '------')).join('') } : null;
    return { n: g.n, won, stars, score: g.score, movesLeft: g.moves, used: g.used || 0, goals: clone(g.goals), groups, painting, made: Object.assign({}, g.made) };
  }

  // ---------------------------------------------------------------- what you put together, the saga

  const ASSOC_CAP = 400;
  function pairsOf(ids) {
    const u = Array.from(new Set((ids || []).filter((x) => typeof x === 'string' && x))).sort(cmp), out = [];
    for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) out.push([u[i], u[j]]);
    return out;
  }
  function capAssoc(list) { // in place: the unhearted with the lowest n, then the oldest (ties: the first), go; hearted never
    const over = list.length - ASSOC_CAP;
    if (over <= 0) return list;
    const go = new Set(list.map((e, i) => i).filter((i) => !list[i][3]).sort((x, y) => list[x][2] - list[y][2] || list[x][4] - list[y][4] || x - y).slice(0, over));
    const keep = list.filter((e, i) => !go.has(i));
    list.length = 0;
    for (const e of keep) list.push(e);
    return list;
  }
  /** addAssociations(assoc, ids, nowSec) -> assoc: every pair of distinct ids n + 1 (<= 99), at = now; then the cap. */
  function addAssociations(assoc, ids, nowSec) {
    const list = (assoc || []).map((e) => e.slice());
    for (const [a, b] of pairsOf(ids)) {
      const e = list.find((x) => x[0] === a && x[1] === b);
      if (e) { e[2] = Math.min(99, e[2] + 1); e[4] = nowSec; } else list.push([a, b, 1, 0, nowSec]);
    }
    return capAssoc(list);
  }
  /** heart(assoc, ids, on) -> assoc: every pair among ids hearted (1) or not (0); a missing pair is added with n 1. */
  function heart(assoc, ids, on) {
    const list = (assoc || []).map((e) => e.slice());
    const at = list.reduce((m, e) => Math.max(m, e[4] || 0), 0);
    for (const [a, b] of pairsOf(ids)) {
      const e = list.find((x) => x[0] === a && x[1] === b);
      if (e) e[3] = on ? 1 : 0;
      else if (on) { list.push([a, b, 1, 1, at]); capAssoc(list); if (list.length > ASSOC_CAP) list.pop(); } // 400 hearted: a new pair is not added (hearted entries never go)
    }
    return capAssoc(list);
  }

  const newSaga = () => ({ stars: [], best: [], boost: { pass: 1, turn: 1, more: 1 }, plays: 0, day: null, time: [], built: [] });
  function sagaOf(saga) {
    const s = Object.assign(newSaga(), clone(saga || {}));
    s.boost = Object.assign({ pass: 1, turn: 1, more: 1 }, s.boost);
    if (!Array.isArray(s.time)) s.time = [];
    if (!Array.isArray(s.built)) s.built = [];
    return s;
  }
  /** recordLevel(saga, result, nowSec) -> {saga, earned, first, inTime}: plays + 1; a win extends or maxes stars and
   *  best; the first 3 stars on a level earn one booster, the first win of every fifth level one of each.
   *  The clock (SPEC "Set: the clock and the kingdom"): result.secs (the person's own seconds, passed in) and
   *  result.clock (the seconds the clock gave; 0 off). A win in 0 < secs <= clock is in time: the best is kept
   *  in time[n − 1] (0: never in time), and it earns nothing else. */
  function recordLevel(saga, res) {
    const s = sagaOf(saga), earned = { pass: 0, turn: 0, more: 0 };
    let first = false, inTime = false;
    s.plays++;
    const i = res && res.n - 1;
    if (res && res.won && i >= 0 && i <= s.stars.length && i < 999) {
      first = i === s.stars.length;
      const prev = first ? 0 : s.stars[i];
      if (first) { s.stars.push(res.stars); s.best.push(res.score); } else { s.stars[i] = Math.max(prev, res.stars); s.best[i] = Math.max(s.best[i] || 0, res.score); }
      if (prev < 3 && res.stars >= 3) earned[BOOSTS[i % 3]]++;
      if (first && res.n % 5 === 0) for (const k of BOOSTS) earned[k]++;
      for (const k of BOOSTS) s.boost[k] = Math.min(9, s.boost[k] + earned[k]);
      const secs = Math.min(9999, Math.ceil(Number(res.secs) || 0));
      inTime = res.clock > 0 && secs > 0 && secs <= res.clock;
      if (inTime) {
        while (s.time.length < i) s.time.push(0);
        s.time[i] = Math.min(s.time[i] || Infinity, secs);
      }
    }
    return { saga: s, earned, first, inTime };
  }

  // The kingdom (SPEC "The kingdom: built by playing"): one thing a won level, by id; null is a plain house.
  const BUILD_ID = /^[A-Za-z0-9_-]{1,10}$/;
  /** build(saga, n, id) -> saga: built[n − 1] = id (or null when it is not a valid id), for a won level only. */
  function build(saga, n, id) {
    const s = sagaOf(saga), i = Math.floor(Number(n)) - 1;
    if (!(i >= 0 && i < s.stars.length)) return s;
    while (s.built.length < i) s.built.push(null);
    s.built[i] = typeof id === 'string' && BUILD_ID.test(id) ? id : null;
    return s;
  }
  /** buildChoices(state, deck, result, current) -> [id] (<= 3, distinct; [] is a plain house): Irwin's three ways.
   *  The building as it stands first; then the things in the win's juxtapositions, by the number of groups they
   *  are in, the artist's buildings first at an equal count, then the newest (result.groups is newest first). */
  function buildChoices(state, deck, res, current) {
    const cards = new Map();
    const cardOf = (id) => { if (!cards.has(id)) cards.set(id, typeof id === 'string' && BUILD_ID.test(id) ? FiveS.card(state, deck, id) : null); return cards.get(id); };
    const count = new Map();
    for (const g of (res && res.groups) || []) for (const id of new Set(g.ids || [])) if (cardOf(id)) count.set(id, (count.get(id) || 0) + 1);
    const seen = Array.from(count.keys());
    const aa = (id) => (cardOf(id).source === 'Architectural Authority' ? 1 : 0);
    const ranked = seen.slice().sort((a, b) => count.get(b) - count.get(a) || aa(b) - aa(a) || seen.indexOf(a) - seen.indexOf(b));
    return (cardOf(current) ? [current] : []).concat(ranked.filter((id) => id !== current)).slice(0, 3);
  }
  /** useBoost(saga, kind) -> saga | null (none held). */
  function useBoost(saga, kind) {
    const s = sagaOf(saga);
    if (BOOSTS.indexOf(kind) < 0 || !(s.boost[kind] > 0)) return null;
    s.boost[kind]--;
    return s;
  }
  /** keepPainting(paintings, result, nowSec) -> paintings | null (the board holds 24, or no painting). */
  function keepPainting(paintings, res, nowSec) {
    const list = (paintings || []).map((p) => Object.assign({}, p));
    if (list.length >= 24 || !res || !res.painting) return null;
    list.push({ at: nowSec, n: res.n, cols: res.painting.cols, rows: res.painting.rows, c: res.painting.c });
    return list;
  }

  /** clusters(state, deck, max = 8) -> {clusters:[{ids, keys, label, times, hearts}], rest:[id]}. */
  function clusters(state, deck, max) {
    max = max || 8;
    const st = FiveS.migrate(state || FiveS.newState());
    const things = keptCards(st, deck, FiveS.profile(st, deck));
    const order = new Map(things.map((c, i) => [c.id, i]));
    const edges = ((state && state.assoc) || []).filter((e) => Array.isArray(e) && order.has(e[0]) && order.has(e[1]))
      .map((e) => ({ a: e[0], b: e[1], n: e[2] || 0, h: e[3] ? 1 : 0, at: e[4] || 0, w: (e[2] || 0) + 2 * (e[3] ? 1 : 0) }))
      .sort((x, y) => y.w - x.w || y.h - x.h || y.at - x.at || cmp(x.a, y.a) || cmp(x.b, y.b));
    const parent = new Map(), size = new Map();
    const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
    for (const c of things) { parent.set(c.id, c.id); size.set(c.id, 1); }
    for (const e of edges) {
      const ra = find(e.a), rb = find(e.b);
      if (ra === rb || size.get(ra) + size.get(rb) > max) continue;
      parent.set(rb, ra); size.set(ra, size.get(ra) + size.get(rb));
    }
    const by = new Map();
    for (const c of things) { const r = find(c.id); if (!by.has(r)) by.set(r, []); by.get(r).push(c); }
    const out = [];
    for (const members of by.values()) {
      if (members.length < 2) continue;
      const ids = new Set(members.map((c) => c.id)), inside = edges.filter((e) => ids.has(e.a) && ids.has(e.b));
      const link = (id) => inside.reduce((s, e) => s + (e.a === id || e.b === id ? e.w : 0), 0);
      members.sort((x, y) => link(y.id) - link(x.id) || order.get(x.id) - order.get(y.id));
      const count = {};
      for (const c of members) for (const k in threadsOf(c, deck)) count[k] = (count[k] || 0) + 1;
      const keys = Object.keys(count).filter((k) => count[k] >= 2).sort((x, y) => count[y] - count[x] || cmp(x, y)).slice(0, 2);
      out.push({
        ids: members.map((c) => c.id), keys, label: keys.length ? keys.map((k) => FiveS.featureLabel(k, deck)).join(' · ') : 'Put together',
        times: inside.reduce((s, e) => s + e.n, 0), hearts: inside.filter((e) => e.h).length, w: inside.reduce((s, e) => s + e.w, 0),
      });
    }
    out.sort((x, y) => y.w - x.w || y.ids.length - x.ids.length || cmp(x.ids[0], y.ids[0]));
    const inCluster = new Set([].concat(...out.map((c) => c.ids)));
    return { clusters: out.map(({ w, ...c }) => c), rest: things.filter((c) => !inCluster.has(c.id)).map((c) => c.id) };
  }

  // ---------------------------------------------------------------- export

  const FiveSMatch = Object.freeze({
    version: 1, TOKENS, LEVELS, EPISODES, MASKS, WORDS,
    prng, level, pieces, newGame, canSwap, swap, moves, hint, boost, finale, result,
    addAssociations, heart, recordLevel, useBoost, keepPainting, clusters,
    area: areaOf, build, buildChoices,
  });

  if (typeof module === 'object' && module.exports) module.exports = FiveSMatch;
  else root.FiveSMatch = FiveSMatch;
})(typeof self !== 'undefined' ? self : globalThis);

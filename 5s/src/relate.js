/* 5s relate: Set's game, inside out (SPEC.md, "Set, inside out").
 *
 * Sort chooses what a person likes; Set relates what they chose. A board is six of their own kept pictures,
 * each whole. A move carries one onto another, and the person says how the two go: alike or unlike, and in
 * what (an aspect, one of their words, or a word of others they make theirs). The carried one is set; the
 * other stays. What arrives next follows from what they said, or tests it. One left: the level is done, and
 * that one is built in the kingdom. Nothing is right or wrong, so no level is lost; the race is the clock.
 *
 * Other eyes: the lookers' pairs (deck.rhymes) and the composition words (card.comp, card.feel). They speak
 * only after the person has said, weigh the deal less as the person's own relations grow
 * (alpha = 12 / (12 + relations)), and propose one card of Sort's next five (ask). Never a verdict.
 *
 * A relation is saved on its pairing (match.js assoc): [a, b, n, heart, at, s, w], s 1 alike or -1 unlike,
 * w 0 not said, 1-5 an aspect (FiveS.ASPECTS), 10 + i the person's word saga.words[i].
 *
 * Pure and deterministic: no DOM, no clock, no Math.random (the game's PRNG state is game.r). Nothing
 * mutates its input. Browser: window.FiveSRelate (load after engine.js and match.js). Node: module.exports.
 */
(function (root) {
  'use strict';
  const FiveS = root.FiveS || (typeof require === 'function' ? require('./engine.js') : null);
  const MX = root.FiveSMatch || (typeof require === 'function' ? require('./match.js') : null);

  const ASPECTS = FiveS.ASPECTS;                  // ['layout', 'line', 'light', 'mass', 'mood'], w 1..5
  const W0 = FiveS.WORD0;                         // w 10 + i: saga.words[i]
  const PICS = ['image', 'object', 'space', 'surface'];   // Colour cards stay on the mood board, out of play

  // The six areas (match.js EPISODES' names and lines): which way arrivals lean, in turn (1 tests, 0 extends).
  const AREAS = Object.freeze([
    { test: [0, 0, 1] },                  // Sort: what you kept
    { test: [1, 0] },                     // Split: alike and unlike
    { test: [0, 0, 1], mine: 2 },         // Set: one thing follows another (their own chains count twice)
    { test: [0, 1], across: 3 },          // See: buildings and artworks (a different source, three times)
    { test: [0, 1], brought: 4 },         // Seed: your own things (brought things lead, four times)
    { test: [1, 0], reask: 2 },           // Another five: old pairs come back the other way, twice
  ]);
  const COACH = {
    1: 'Carry one of your things onto another. Then say how they go together, or how they don’t.',
    2: 'The one you carry is set. The one you carry it onto stays.',
    3: 'No word fits? Say it your own way.',
    6: 'Unlike counts as much as alike.',
    16: 'A building beside an artwork: what do they share, what don’t they?',
    21: 'Your own things first. Only you can say what they go with.',
    26: 'Old pairs come back. You may see them differently now.',
  };

  // ---------------------------------------------------------------- small helpers
  const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function rand(g) {   // one mulberry32 step on the game's own state (as match.js), so a Game stays plain JSON
    const a = (g.r + 0x6d2b79f5) | 0;
    g.r = a >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(g, list, weight) {
    const ws = list.map(weight), tot = ws.reduce((s, x) => s + x, 0);
    let x = rand(g) * tot;
    for (let i = 0; i < list.length; i++) { x -= ws[i]; if (x <= 0) return list[i]; }
    return list[list.length - 1];
  }
  const isWord = (w) => Number.isInteger(w) && w >= W0;
  // why a picture was dealt (game.by, for the level end's "why" and the tests): the other eyes, the person's own, not set yet, chance
  const byOf = (t, fr) => (t.others + t.own >= 0.25 ? (t.own > t.others ? 'own' : 'others') : fr > 1 ? 'fresh' : 'chance');

  // ---------------------------------------------------------------- the levels
  /** level(n) -> {n, k, pile, moves, coach}: area k (0..5), pile = what comes in after the six. */
  function level(n) {
    n = Math.max(1, Math.floor(n) || 1);
    const lap = n > 30 ? Math.floor((n - 26) / 5) : 0, k = n > 30 ? 5 : Math.floor((n - 1) / 5), i = (n - 1) % 5;
    const pile = Math.min(6, [0, 1, 1, 2, 3][i] + k + lap);
    return { n, k, pile, moves: 5 + pile, coach: lap ? null : COACH[n] || null };
  }

  // ---------------------------------------------------------------- the table: what the person has, as plain JSON
  // own: the ids of brought things the app holds a picture for (a brought thing without one sits out).
  function table(state, deck, own) {
    const st = FiveS.migrate(state);
    const P = FiveS.profile(st, deck);
    const hasPic = new Set(own || []);
    const pool = [], work = {}, src = {}, words = {}, at = {};
    const idx = new Map(((deck && deck.cards) || []).map((c) => [c.id, c]));
    for (const kind of PICS) for (const id of P.keptByKind[kind] || []) {
      const c = idx.get(id), mine = id.charAt(0) === 'y';
      if (mine ? !hasPic.has(id) : !(c && c.img)) continue;
      pool.push(id);
      // one card a work: a building's photo and its surface share one; so do two saves of one artwork
      work[id] = mine ? id : c.source !== 'Architectural Authority' && c.title && !/^untitled$/i.test(c.title) ? 'w:' + c.artist + '|' + c.title : 'w:' + c.work;
      src[id] = mine ? 'own' : c.source === 'Architectural Authority' ? 'aa' : 'artsy';
      words[id] = mine ? [] : (c.comp || []).concat(c.feel || []);
    }
    // newest kept first (keptByKind is newest first within a kind)
    const t = new Map();
    for (const e of st.j) if (Array.isArray(e)) t.set(e[0], e[3] || 0);
    for (const o of st.own) if (o) t.set(o.id, o.seenAt || o.at || 0);
    pool.sort((a, b) => (t.get(b) || 0) - (t.get(a) || 0) || (a < b ? -1 : 1));
    pool.forEach((id, i) => { at[id] = i; });
    const inPool = new Set(pool);
    const look = {};
    for (const r of deck.rhymes || []) if (inPool.has(r[0]) && inPool.has(r[1]) && work[r[0]] !== work[r[1]]) look[key(r[0], r[1])] = { v: r[2] ? 2 : 1, line: r[3] };
    const rel = {};
    for (const e of st.assoc) if (e.length === 7 && inPool.has(e[0]) && inPool.has(e[1])) rel[e[0] + '|' + e[1]] = { s: e[5], w: e[6], at: e[4] };
    return {
      pool, work, src, words, rank: at, look, rel,
      aspectOf: Object.assign({}, deck.words || {}),   // a word of others -> its aspect (the deck build's)
      vocab: (st.saga.words || []).slice(),
      turns: P.turns.filter((x) => x.dir > 0 && inPool.has(x.card)).map((x) => x.card),
      built: st.saga.built.slice(), done: st.saga.stars.length,
      others: !!(deck.rhymes || (deck.cards || []).some((c) => c.comp)),
    };
  }

  // ---------------------------------------------------------------- what is known of two things
  const lookOf = (T, a, b) => T.look[key(a, b)] || null;
  const lookV = (T, a, b) => (T.look[key(a, b)] || { v: 0 }).v;
  function relOf(T, g, a, b) {   // the newest relation of a and b: said this level, else before
    if (g) for (let i = g.made.length - 1; i >= 0; i--) { const m = g.made[i]; if (key(m.x, m.y) === key(a, b)) return m; }
    return T.rel[key(a, b)] || null;
  }
  function rels(T, g) {   // every relation, before and this level: [{a, b, s, w}]
    const out = new Map();
    for (const k in T.rel) out.set(k, Object.assign({ a: k.split('|')[0], b: k.split('|')[1] }, T.rel[k]));
    if (g) for (const m of g.made) out.set(key(m.x, m.y), { a: m.x, b: m.y, s: m.s, w: m.w });
    return Array.from(out.values());
  }
  const nbrs = (R, id) => new Set(R.filter((r) => r.a === id || r.b === id).map((r) => (r.a === id ? r.b : r.a)));
  function saidOf(R, id) {   // the words the person has said alike of a thing
    const out = new Set();
    for (const r of R) if (r.s === 1 && isWord(r.w) && (r.a === id || r.b === id)) out.add(r.w);
    return out;
  }
  const linkWords = (T, id) => T.words[id].filter((w) => w !== 'allover');   // allover links 132 pictures: a wall, not a relation
  const shared = (T, a, b) => { const B = linkWords(T, b); return linkWords(T, a).filter((w) => B.indexOf(w) >= 0); };
  const inAspect = (T, id, A) => T.words[id].filter((w) => T.aspectOf[w] === A);
  function aspectOfW(T, w) {   // an aspect said, or the aspect of one of others' words the person made theirs; an own word has none
    if (w >= 1 && w <= 5) return ASPECTS[w - 1];
    return isWord(w) ? T.aspectOf[T.vocab[w - W0]] || null : null;
  }
  /** wordOf(vocab, w) -> what w says: '', an aspect, or one of the person's words. */
  function wordOf(vocab, w) {
    if (w >= 1 && w <= 5) return ASPECTS[w - 1];
    return isWord(w) ? (vocab || [])[w - W0] || '' : '';
  }
  // what the person said, in their words: "alike", "alike in line", "alike: airy" (others' word made theirs), "unlike: ‘a held breath’"
  const said = (T, s, w) => { const t = wordOf(T.vocab, w); return (s > 0 ? 'alike' : 'unlike') + (!t ? '' : w <= 5 ? ' in ' + t : T.aspectOf[t] ? ': ' + t : ': ‘' + t + '’'); };
  const alpha = (T, g) => 12 / (12 + rels(T, g).length);

  // ---------------------------------------------------------------- the deal
  function okWork(T, g, id) { return !g.used.some((x) => T.work[x] === T.work[id]); }
  function fresh(T, g, id) { return rels(T, g).some((r) => r.a === id || r.b === id) ? 1 : 2; }   // not set yet: twice
  function areaX(T, g, id, Y) {
    const A = AREAS[g.k];
    let x = 1;
    if (A.across && (Y ? [Y] : g.slots.filter(Boolean)).some((b) => T.src[b] !== T.src[id])) x *= A.across;
    if (A.brought && T.src[id] === 'own') x *= A.brought;
    return x;
  }
  // why c would join the board B: the other eyes (lookers, words) and the person's own (pairs, two steps, words)
  function boardTerms(T, g, c, B) {
    const R = rels(T, g), nc = nbrs(R, c), pc = saidOf(R, c);
    let L = 0, W = 0, O = 0, O2 = 0, PW = 0;
    for (const x of B) {
      L += lookV(T, c, x); W += shared(T, c, x).length; O += relOf(T, g, c, x) ? 1 : 0;
      for (const z of nbrs(R, x)) if (nc.has(z)) { O2++; break; }
      for (const w of saidOf(R, x)) if (pc.has(w)) PW++;
    }
    const a = alpha(T, g);
    return { others: a * (2 * L + 0.6 * W), own: (1 - a) * (3 * O + O2 + 0.6 * PW) };
  }
  /** leads(table, n) -> [{id, why}] (<= 3): Irwin's three ways in; [0] leads unless the person chooses another.
   *  why: brought (Seed's levels) | turn (a keep against their pattern, not set yet) | fresh (kept, not set yet) |
   *  stayed (last level's building: what stayed, or what Another way or v12 built) | thin (set beside the fewest). Things built in the last three levels rest. */
  function leads(T, n) {
    const R = rels(T, null), deg = (id) => R.filter((r) => r.a === id || r.b === id).length;
    const rest = new Set([T.built[n - 2], T.built[n - 3], T.built[n - 4]].filter(Boolean));
    const ok = (id) => !rest.has(id), set = (id) => deg(id) > 0 || T.built.indexOf(id) >= 0;   // a building (v12's too) is set, though not related
    const list = [];
    if (Math.floor((n - 1) / 5) === 4) T.pool.filter((id) => T.src[id] === 'own').sort((a, b) => deg(a) - deg(b)).forEach((id) => list.push({ id, why: 'brought' }));
    T.turns.filter((id) => ok(id) && !set(id)).forEach((id) => list.push({ id, why: 'turn' }));
    T.pool.filter((id) => ok(id) && !set(id)).forEach((id) => list.push({ id, why: 'fresh' }));
    const st = T.built[n - 2];
    if (st && T.pool.indexOf(st) >= 0) list.push({ id: st, why: 'stayed' });
    T.pool.filter((id) => ok(id) && set(id)).sort((a, b) => deg(a) - deg(b) || T.rank[a] - T.rank[b]).forEach((id) => list.push({ id, why: 'thin' }));
    if (!list.length) T.pool.forEach((id) => list.push({ id, why: 'thin' }));   // everything rests: anything leads
    const out = [];
    const add = (x) => { if (x && out.length < 3 && !out.some((y) => y.id === x.id)) out.push(x); };
    add(list[0]);
    for (const x of list) if (!out.some((y) => y.why === x.why)) add(x);   // three different ways in where there are
    for (const x of list) add(x);
    return out;
  }
  /** newGame(level, table, seed, lead?) -> Game | null (fewer than six pictures: the first board, not a level). */
  function newGame(lv, T, seed, lead) {
    if (T.pool.length < 6) return null;
    const g = { v: 1, n: lv.n, k: lv.k, r: Math.floor(FiveS.prng(String(seed))() * 4294967296) >>> 0,
      slots: [], used: [], by: {}, pile: Math.min(lv.pile, T.pool.length - 6), moves: lv.moves, arrivals: 0, made: [], passed: [], more: false, state: 'play' };
    const first = T.pool.indexOf(lead) >= 0 ? lead : leads(T, lv.n)[0].id;
    g.lead = first;
    const board = [first];
    g.used.push(first); g.by[first] = 'lead';
    while (board.length < 6) {
      const cand = T.pool.filter((id) => okWork(T, g, id));
      if (!cand.length) break;
      const TT = new Map(cand.map((c) => [c, boardTerms(T, g, c, board)]));
      const id = pick(g, cand, (c) => { const t = TT.get(c); return fresh(T, g, c) * (1 + t.others + t.own) * areaX(T, g, c); });
      board.push(id); g.used.push(id); g.by[id] = byOf(TT.get(id), fresh(T, g, id));
    }
    const order = board.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); const x = order[i]; order[i] = order[j]; order[j] = x; }
    g.slots = order.map((i) => board[i]);
    g.moves = g.slots.length - 1 + g.pile;
    return g;
  }

  // An arrival into the place X left, after X was carried onto Y and said s in w: it extends what was said, or tests it.
  function arrival(T, g, X, Y, s, w) {
    if (g.pile <= 0) return null;
    const cand = T.pool.filter((id) => okWork(T, g, id));
    if (!cand.length) return null;
    const A = AREAS[g.k], mode = A.test[g.arrivals % A.test.length] ? 'test' : 'extend';
    const like = mode === 'extend' ? s : -s, asp = aspectOfW(T, w), own = isWord(w) && !asp;
    const R = rels(T, g), pY = saidOf(R, Y), a = alpha(T, g);
    const terms = (c) => {
      let wd = 0;
      if (asp) {
        const x = inAspect(T, c, asp), y = inAspect(T, Y, asp);
        const exact = isWord(w) && T.words[c].indexOf(T.vocab[w - W0]) >= 0 && T.words[Y].indexOf(T.vocab[w - W0]) >= 0;
        wd = like === 1 ? (x.some((v) => v !== 'allover' && y.indexOf(v) >= 0) ? 1 : 0) + (exact ? 1.5 : 0) : x.length && y.length && !x.some((v) => y.indexOf(v) >= 0) ? 1.2 : 0;
      } else if (!own) wd = like === 1 ? 0.6 * shared(T, c, Y).length : linkWords(T, c).length && !shared(T, c, Y).length ? 0.8 : 0;
      const pc = saidOf(R, c);
      let yours = 0.6 * Array.from(pc).filter((x) => pY.has(x)).length;
      if (own && pc.has(w) && like === 1) yours += 1.5;
      const prior = relOf(T, g, c, Y);
      if (prior) yours += mode === 'test' ? (prior.s !== s ? 2 * (A.reask || 1) : 0.5) : prior.s === s ? 2 : 0.5;
      return { others: a * (2 * lookV(T, c, mode === 'test' ? X : Y) + wd), own: (1 - a) * yours * (A.mine || 1) };
    };
    const TT = new Map(cand.map((c) => [c, terms(c)]));
    const id = pick(g, cand, (c) => { const t = TT.get(c); return fresh(T, g, c) * (1 + t.others + t.own) * areaX(T, g, c, Y); });
    const why = byOf(TT.get(id), fresh(T, g, id));
    g.by[id] = why;
    const line = why === 'fresh' ? 'Here because it is not set yet.' : why === 'chance' ? null
      : mode === 'extend' ? 'Here because of what you just said.' : 'Here to test what you just said.';
    return { id, mode, why, line };
  }

  // ---------------------------------------------------------------- how the game answers (after the person has said)
  /** answer(table, game | null, x, y, s, w) -> {kind, line}: the first other eye with something to say.
   *  kind: again | turn (said the other way from before) | brought | shared | apart (someone else saw them alike; the
   *  person, apart) | agree | yours (others' words see it otherwise than the person) | first (nothing to compare). */
  function answer(T, g, x, y, s, w) {
    const prior = relOf(T, g, x, y);
    if (prior) return prior.s === s ? { kind: 'again', line: 'You said this before. It holds.' }
      : { kind: 'turn', line: 'A turn. Last time you saw them ' + said(T, prior.s, prior.w) + '.' };
    if (T.src[x] === 'own' || T.src[y] === 'own') return { kind: 'brought', line: 'Only you have this one, so only you can say.' };
    const L = lookOf(T, x, y);
    if (L) return s === 1 ? { kind: 'shared', line: 'Someone else put these two together too: ' + L.line + '.' }
      : { kind: 'apart', line: 'Someone else saw them ' + (L.v === 2 ? 'alike' : 'partly alike') + ': ' + L.line + '. You see them apart.' };
    const A = aspectOfW(T, w), where = A ? ' in ' + A : '';
    const xs = A ? inAspect(T, x, A) : linkWords(T, x), ys = A ? inAspect(T, y, A) : linkWords(T, y);
    if (!xs.length || !ys.length) return { kind: 'first', line: s === 1 ? 'No one has said this of these two. You’re the first.' : 'No one has set these two apart' + where + '. You’re the first.' };
    const sh = xs.filter((v) => v !== 'allover' && ys.indexOf(v) >= 0);
    if (s === 1) return sh.length ? { kind: 'agree', line: 'Others’ words for both: ' + sh.slice(0, 3).join(', ') + '.' }
      : { kind: 'yours', line: 'Others’ words set them apart' + where + ': ' + xs[0] + ' · ' + ys[0] + '. You see them alike.' };
    return sh.length ? { kind: 'yours', line: 'Others’ words call both ' + sh[0] + '. You see them apart.' }
      : { kind: 'agree', line: 'Others’ words set them apart too: ' + xs[0] + ' · ' + ys[0] + '.' };
  }

  /** chips(table, game | null, a, b, s) -> {mine: [w], aspects: [1..5], others: [word]}: the "in what" row.
   *  The person's own words first (most said), then the aspects, then others' words drawn from the two. */
  function chips(T, g, a, b, s) {
    const n = new Map();
    for (const r of rels(T, g)) if (isWord(r.w)) n.set(r.w, (n.get(r.w) || 0) + 1);
    const mine = Array.from(n.keys()).sort((x, y) => n.get(y) - n.get(x) || x - y).slice(0, 3);
    const taken = new Set(mine.map((w) => wordOf(T.vocab, w)));
    let others;
    if (s === 1) others = shared(T, a, b).concat(T.words[a].indexOf('allover') >= 0 && T.words[b].indexOf('allover') >= 0 ? ['allover'] : []);
    else {
      const A = T.words[a].filter((v) => T.words[b].indexOf(v) < 0), B = T.words[b].filter((v) => T.words[a].indexOf(v) < 0);
      others = [];
      for (let i = 0; i < Math.max(A.length, B.length); i++) { if (A[i]) others.push(A[i]); if (B[i]) others.push(B[i]); }
    }
    return { mine, aspects: [1, 2, 3, 4, 5], others: others.filter((v) => !taken.has(v)).slice(0, 3) };
  }

  /** say(game, table, x, y, s, w) -> {game, answer, arrival}: x (the carried one) is set beside y, said s in w.
   *  x leaves its place and y stays; an arrival takes x's place while the pile lasts, else the board gets smaller.
   *  With x not on the board (the Turn booster brings back an earlier pair), nothing on the board changes. */
  function say(game, T, x, y, s, w) {
    const g = clone(game);
    if (g.state !== 'play' || x === y || !(s === 1 || s === -1)) return { game: g, answer: null, arrival: null };
    w = Number.isInteger(w) ? w : 0;
    const ans = answer(T, g, x, y, s, w);
    const i = g.slots.indexOf(x), back = i < 0;
    g.made.push({ x, y, s, w, kind: ans.kind, line: ans.line, back });
    let arr = null;
    if (!back) {
      g.slots[i] = null;
      arr = arrival(T, g, x, y, s, w);
      if (arr) { g.slots[i] = arr.id; g.used.push(arr.id); g.pile--; g.arrivals++; arr.place = i; }
      if (g.slots.filter(Boolean).length <= 1) g.state = 'done';
    }
    return { game: g, answer: ans, arrival: arr };
  }
  /** pass(game, table, place) -> {game, arrival}: Pass, the negation: the picture leaves set beside nothing. */
  function pass(game, T, place) {
    const g = clone(game), id = g.slots[place];
    if (g.state !== 'play' || !id || g.slots.filter(Boolean).length <= 1) return { game: g, arrival: null };
    g.slots[place] = null; g.passed.push(id);
    let arr = null;
    const cand = g.pile > 0 ? T.pool.filter((c) => okWork(T, g, c)) : [];
    if (cand.length) {
      const B = g.slots.filter(Boolean);
      const TT = new Map(cand.map((c) => [c, boardTerms(T, g, c, B)]));
      const c = pick(g, cand, (c) => { const t = TT.get(c); return fresh(T, g, c) * (1 + t.others + t.own) * areaX(T, g, c); });
      g.slots[place] = c; g.used.push(c); g.pile--; g.by[c] = byOf(TT.get(c), fresh(T, g, c)); arr = { id: c, place, line: null };
    }
    g.moves--;
    if (g.slots.filter(Boolean).length <= 1) g.state = 'done';
    return { game: g, arrival: arr };
  }
  /** back(game, table) -> {a, b, s, w} | null: Turn: the person's oldest relation from before this level comes back to be said
   *  again, a never on the board (so say(game, table, a, b, ...) leaves the board as it is); a pair both on the board waits. */
  function back(game, T) {
    const done = new Set(game.made.map((m) => key(m.x, m.y))), on = new Set(game.slots.filter(Boolean));
    let best = null;
    for (const k in T.rel) {
      const [a, b] = k.split('|');
      if (done.has(k) || (on.has(a) && on.has(b))) continue;
      if (!best || T.rel[k].at < best.at || (T.rel[k].at === best.at && k < best.k)) best = Object.assign({ k, a, b }, T.rel[k]);
    }
    return !best ? null : on.has(best.a) ? { a: best.b, b: best.a, s: best.s, w: best.w } : { a: best.a, b: best.b, s: best.s, w: best.w };
  }

  /** result(game, table) -> what recordLevel and buildChoices take, and the level end's lists.
   *  No stars (the artist, 23 Oct 2026): a level is done when the board is set. `stars` is only the won-level marker
   *  recordLevel keeps in saga.stars (1 won, 0 not; an old higher value stands); it is never shown. A turn is noticed
   *  in words (made[].kind 'turn') and rewards nothing. */
  function result(g, T) {
    const stayed = g.slots.filter(Boolean)[0] || null;
    const stars = g.state === 'done' ? 1 : 0;
    const made = new Set(g.made.map((m) => key(m.x, m.y))), others = [];
    for (let i = 0; i < g.used.length; i++) for (let j = i + 1; j < g.used.length; j++) {
      const L = lookOf(T, g.used[i], g.used[j]);
      if (L && !made.has(key(g.used[i], g.used[j])) && others.length < 4) others.push({ a: g.used[i], b: g.used[j], line: L.line });
    }
    return {
      n: g.n, won: g.state === 'done', stars, score: 1000 * g.made.length, used: g.made.length, goals: [],
      groups: g.made.slice().reverse().map((m) => ({ ids: [m.x, m.y], key: null, label: m.line })),
      painting: null, made: g.made.map((m) => Object.assign({}, m)), stayed, others,
    };
  }

  /** ways(state, deck, result, current) -> [id] (<= 3): what a win builds, Irwin's three: the building as it stands (a
   *  replay), what stayed (everything else was set beside it), then buildChoices' most related things. */
  function ways(state, deck, res, current) {
    const all = [current, res && res.stayed].concat(MX.buildChoices(state, deck, res, null));
    return all.filter((id, i) => id && all.indexOf(id) === i && FiveS.card(state, deck, id)).slice(0, 3);
  }

  // ---------------------------------------------------------------- the kingdom, grown from what the person related
  // level i + 1's building: the relations its thing has gathered, 1 to 3; the one standing never under the height v12 gave it (saga.stars[i])
  const tall = (st, i, thing) => Math.max(1, Math.min(3, Math.max(thing ? st.assoc.filter((e) => e.length === 7 && (e[0] === thing || e[1] === thing)).length : 0, thing === (st.saga.built[i] ?? null) ? st.saga.stars[i] | 0 : 0)));
  /** storeys(state, n, id?) -> 1..3: level n's building as id (else saga.built[n − 1]) would stand: the relations that
   *  thing has gathered, 1 to 3. The building that stands keeps its height: never under saga.stars[n − 1] as v12 wrote it. */
  function storeys(state, n, id) { const st = FiveS.migrate(state); return tall(st, n - 1, id === undefined ? st.saga.built[n - 1] : id); }
  /** build(saga, n, id, before) -> saga: MX.build, and the height v12 gave level n (saga.stars[n − 1] over 1) stays only
   *  with v12's building: another thing built there drops it to 1, the won marker, and stands as its relations; Another
   *  way round to the old building brings it back. before: the saga as the level opened. */
  function build(saga, n, id, before) {
    const s = MX.build(saga, n, id), i = n - 1;
    if (i >= 0 && i < s.stars.length) s.stars[i] = s.built[i] === (before.built[i] ?? null) ? Math.max(s.stars[i], before.stars[i] | 0) : Math.min(s.stars[i], 1);
    return s;
  }
  /** kingdom(state, deck, own) -> {storeys, ties, said, mist}: what the kingdom map draws from the person's relations.
   *  storeys: [1..3] a won level; ties: [[n, m, s]] two levels whose buildings they related (s 1 alike, -1 unlike);
   *  said: {k: 'Mostly alike in line'} what they said most about island k's buildings, in their words, never the lookers';
   *  mist: {n, ids} the kept pictures not set beside anything yet nor built (ids: the newest three), each a way into the next level. */
  function kingdom(state, deck, own) {
    const st = FiveS.migrate(state), won = st.saga.stars.length, bl = st.saga.built.slice(0, won);
    const R = st.assoc.filter((e) => e.length === 7), at = {}, ties = [], lines = {};
    bl.forEach((id, i) => { if (id) (at[id] = at[id] || []).push(i + 1); });
    for (const e of R) for (const n of at[e[0]] || []) for (const m of at[e[1]] || []) ties.push(n < m ? [n, m, e[5]] : [m, n, e[5]]);
    ties.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const T = { vocab: st.saga.words || [], aspectOf: (deck && deck.words) || {} };
    for (let k = 0; 5 * k < won; k++) {
      const things = new Set(bl.slice(5 * k, 5 * k + 5).filter(Boolean)), cnt = {};
      for (const e of R) if (things.has(e[0]) || things.has(e[1])) { const x = said(T, e[5], e[6]); cnt[x] = (cnt[x] || 0) + 1; }
      const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1))[0];
      if (top) lines[k] = 'Mostly ' + top;
    }
    const related = new Set(R.map((e) => e[0]).concat(R.map((e) => e[1])));
    const unset = table(st, deck, own).pool.filter((id) => !related.has(id) && bl.indexOf(id) < 0);   // a building (v12's too) is set
    return { storeys: st.saga.stars.map((_, i) => tall(st, i, bl[i] || null)), ties, said: lines, mist: { n: unset.length, ids: unset.slice(0, 3) } };
  }

  /** saidText(vocab, s, w) -> the person's words for a relation, as the answer leads with them: "Alike in line." */
  function saidText(vocab, aspectOf, s, w) { const t = said({ vocab, aspectOf: aspectOf || {} }, s, w); return t.charAt(0).toUpperCase() + t.slice(1) + '.'; }

  // ---------------------------------------------------------------- saving, and the person's words
  /** relate(assoc, a, b, s, w, nowSec) -> assoc: the pairing counted (addAssociations) and its relation said on it; at 400 it stays and another goes. */
  function relate(assoc, a, b, s, w, nowSec) {
    const x = a < b ? a : b, y = a < b ? b : a, is = (e) => e[0] === x && e[1] === y, had = (assoc || []).find(is);
    // the pairing just said never goes at the cap: a heart holds it while the cap runs (a new one comes in at n 0; the count makes it 1)
    const list = MX.addAssociations((assoc || []).map((e) => (is(e) ? [x, y, e[2], 1, e[4]] : e)).concat(had || x === y ? [] : [[x, y, 0, 1, nowSec]]), [x, y], nowSec);
    if (list.length > 400) { const old = list.filter((e) => !is(e)).reduce((m, e) => (e[4] < m[4] ? e : m)); list.splice(list.indexOf(old), 1); }   // every other one hearted: the oldest goes
    const e = list.find(is);
    if (e) { e[3] = had ? had[3] : 0; e.length = 5; e.push(s === 1 ? 1 : -1, Number.isInteger(w) && w >= 0 ? w : 0); }
    return list;
  }
  /** addWord(words, text) -> {words, w} | {words, w: null}: a word the person says (theirs, or one of others' made
   *  theirs); the same word again is the same w. At most 60 words, each up to 24 characters; a 61st is refused.
   *  The app saves words to saga.words and sets the level's table.vocab to them, so the game knows the new word. */
  function addWord(words, text) {
    const list = (words || []).slice();
    const tidy = (s) => s.replace(/[\u0000-\u001f\u007f]|\p{Cs}/gu, '').replace(/\s+/g, ' ').trim();   // \p{Cs}: half a character
    const t = tidy(tidy(String(text == null ? '' : text)).slice(0, FiveS.WORD_LEN));   // again after the cut: no space or half a character at the end
    if (!t) return { words: list, w: null };
    const i = list.findIndex((x) => x.toLowerCase() === t.toLowerCase());
    if (i >= 0) return { words: list, w: W0 + i };
    if (list.length >= FiveS.WORDS_MAX) return { words: list, w: null };
    list.push(t);
    return { words: list, w: W0 + list.length - 1 };
  }

  // ---------------------------------------------------------------- back into Sort
  const lookCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function lookAll(deck) {   // every lookers' pair in the deck: id -> [{id, v, line}]
    if (lookCache && lookCache.has(deck)) return lookCache.get(deck);
    const m = new Map();
    for (const r of deck.rhymes || []) for (const [a, b] of [[r[0], r[1]], [r[1], r[0]]]) { if (!m.has(a)) m.set(a, []); m.get(a).push({ id: b, v: r[2] ? 2 : 1, line: r[3] }); }
    if (lookCache) lookCache.set(deck, m);
    return m;
  }
  /** ask(state, deck) -> [{id, with, line} | {id, with, word}] (<= 5, best first): deck pictures never judged that
   *  follow from the person's latest relations: the lookers put them with a thing just related, or they carry a
   *  word just said alike. engine.nextFive gives the first that fits one slot. [] with no relations or no other eyes. */
  function ask(state, deck) {
    const st = FiveS.migrate(state);
    if (!deck || !(deck.rhymes || (deck.cards || []).some((c) => c.comp))) return [];
    const R = st.assoc.filter((e) => e.length === 7).sort((x, y) => y[4] - x[4]).slice(0, 12);
    if (!R.length) return [];
    const judged = new Set(st.j.map((e) => e[0])), L = lookAll(deck), vocab = st.saga.words || [];
    const kept = new Set(), works = new Set(), idx = new Map(deck.cards.map((c) => [c.id, c]));
    for (const e of st.j) if (e[1]) kept.add(e[0]);
    for (const id of kept) if (idx.get(id)) works.add(idx.get(id).work);
    const score = new Map();
    const add = (id, s, why) => { const x = score.get(id) || { s: 0, why: null }; x.s += s; x.why = x.why || why; score.set(id, x); };
    R.forEach((e, i) => {
      const f = 1 / (1 + 0.2 * i);   // the latest count most
      for (const t of [e[0], e[1]]) for (const p of L.get(t) || []) add(p.id, 2 * p.v * f, { with: t, line: p.line });
      const word = e[5] === 1 && isWord(e[6]) ? vocab[e[6] - W0] : null;
      if (word) for (const c of deck.cards) if ((c.comp || []).concat(c.feel || []).indexOf(word) >= 0) add(c.id, f, { with: e[1], word });
    });
    return Array.from(score.entries())
      .filter(([id]) => { const c = idx.get(id); return c && PICS.indexOf(c.kind) >= 0 && c.img && !judged.has(id) && !works.has(c.work); })
      .sort((x, y) => y[1].s - x[1].s || (x[0] < y[0] ? -1 : 1)).slice(0, 5)
      .map(([id, x]) => Object.assign({ id }, x.why));
  }
  /** why(state, deck, id) -> {with, line} | {with, word} | null: Sort's reveal line for a card just judged, when the
   *  lookers put it with one of the person's related things, or it carries a word they said alike. */
  function why(state, deck, id) {
    const st = FiveS.migrate(state);
    const R = st.assoc.filter((e) => e.length === 7).sort((x, y) => y[4] - x[4]);
    const L = lookAll(deck).get(id) || [];
    for (const e of R) for (const t of [e[0], e[1]]) { const p = L.find((q) => q.id === t); if (p) return { with: t, line: p.line }; }
    const c = (deck.cards || []).find((x) => x.id === id), ws = c ? (c.comp || []).concat(c.feel || []) : [];
    for (const e of R) { const word = e[5] === 1 && isWord(e[6]) ? (st.saga.words || [])[e[6] - W0] : null; if (word && ws.indexOf(word) >= 0) return { with: e[1], word }; }
    return null;
  }
  /** unsetShare(table) -> the share of pairs of kept pictures not yet related (the level end offers Sort a five under 0.5). */
  function unsetShare(T) {
    const n = T.pool.length, all = (n * (n - 1)) / 2;
    return all ? Math.max(0, all - Object.keys(T.rel).length) / all : 1;
  }

  const FiveSRelate = Object.freeze({
    version: 1, AREAS, COACH,
    level, table, leads, newGame, chips, answer, say, pass, back, result, ways, storeys, build, kingdom, saidText,
    relate, addWord, wordOf, ask, why, unsetShare,
  });
  if (typeof module === 'object' && module.exports) module.exports = FiveSRelate;
  else root.FiveSRelate = FiveSRelate;
})(typeof self !== 'undefined' ? self : globalThis);

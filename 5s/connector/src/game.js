/* Fives through the connector ("let's play fives"): five rounds; a round is five things shown together, one of each
 * kind in the artist's order (a picture, a line of code, a space, a Picture Poetry page, a word), answered in any order.
 * Inside out: a round is dealt from what was kept and passed before it (earlier rounds, earlier games), never from
 * answers in the round itself. Pure: no clock but `now`, no network, no Math.random; the same state and day deal the same.
 *
 *   state.game   = {day, at, ids: [dealt, a round at a time, ≤ 25], k: '1' kept, '0' passed, '-' not yet, one per id,
 *                   from: [the id each thing came from, or '']}
 *   state.things = {id: 1 kept | 0 passed}: the latest answer on each line, page and word; newest last; ≤ LIMITS.things
 * Pictures and spaces are deck cards: judged with the engine into state.j, exactly as Sort judges them.
 * The catalogue is deck.things (data/5s/things.json, git-ignored; scripts/build-things.mjs).
 */
import FiveS from './engine.js';
import { lineFor, madeLine, TEMPLATES, MADE } from './lines.js';
import { LIMITS } from './validate.js';

export const KINDS = Object.freeze(['picture', 'line', 'space', 'page', 'word']);
export const OF = 25;
export const kindAt = (i) => KINDS[i % 5];
export const roundOf = (i) => Math.floor(i / 5);   // 0..4
/** 'line', 'page' or 'word' for the game's own things; null for a deck card (or a brought thing). */
export const thingKind = (id) => ({ l: 'line', p: 'page', w: 'word' })[String(id)[0]] || null;

// ---------------------------------------------------------------- the catalogue

const cats = new WeakMap();
export function cat(deck) {
  if (!deck || !deck.things) return null;
  let c = cats.get(deck);
  if (!c) {
    const T = deck.things;
    const by = (xs) => new Map((xs || []).map((x) => [x.id, x]));
    c = { lines: T.lines || [], words: T.words || [], pages: T.pages || [], spaces: T.spaces || [], rooms: new Set(T.rooms || []),
      pics: T.pics || {}, line: by(T.lines), word: by(T.words), page: by(T.pages) };
    cats.set(deck, c);
  }
  return c;
}

/** True when the deck carries a catalogue with something of every kind to deal. */
export function ready(deck) {
  const C = cat(deck);
  return !!C && ['lines', 'words', 'pages', 'spaces'].every((k) => C[k].length > 0);
}

/** The thing behind an id (a curated or made line, a page, a word, a deck card), or null when it is not there now. */
export function thing(st, deck, id) {
  const k = thingKind(id), C = cat(deck);
  if (!k) return FiveS.card(st, deck, id);
  if (!C) return null;
  if (k === 'page') return C.page.get(id) || null;
  if (k === 'word') return C.word.get(id) || null;
  return C.line.get(id) || madeLine(id, (x) => (thingKind(x) === 'word' ? C.word.get(x) : FiveS.card(st, deck, x))) || null;
}

// ---------------------------------------------------------------- reading the state

/** The game in the state, or null when there is none (or it is malformed). */
export function gameOf(st) {
  const g = st && st.game;
  if (!g || !Array.isArray(g.ids) || typeof g.k !== 'string' || g.k.length !== g.ids.length) return null;
  return Array.isArray(g.from) && g.from.length === g.ids.length ? g : Object.assign({}, g, { from: g.ids.map(() => '') });
}
export const isDone = (g) => g.ids.length >= OF && g.k.indexOf('-') < 0;
const roundDone = (g, r) => g.ids.length >= r * 5 + 5 && g.k.slice(r * 5, r * 5 + 5).indexOf('-') < 0;

// What a deal reads: the answers before the round (newest first), what was judged before, and a seed.
function seen(st, deck, g, start) {
  const kept = [], passed = new Set();
  for (let i = start - 1; i >= 0; i--) (g.k[i] === '1' ? kept.push(g.ids[i]) : passed.add(g.ids[i]));
  const at = new Map();
  st.j.forEach((e, i) => { if (Array.isArray(e)) at.set(e[0], i); });
  const cards = kept.filter((id) => !thingKind(id)).map((id) => FiveS.card(st, deck, id)).filter((c) => c && !c.own);
  return { kept, passed, cards, words: kept.filter((id) => thingKind(id) === 'word'), in: new Set(g.ids), at, things: st.things || {},
    rng: FiveS.prng('game|' + g.day + '|' + g.ids.length + '|' + st.j.length) };
}
const shuffled = (xs, rng) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// The first of xs by score, highest first; equal scores keep the seeded order.
const best = (xs, rng, score) => shuffled(xs, rng).map((x) => [x, score(x)]).sort((a, b) => b[1] - a[1])[0][0];

// ---------------------------------------------------------------- dealing: [id, the id it came from or null]

const DEAL = {
  // Sort's own five, one kind a round (image, object, space, surface, colour): the taste model and "Still yours?" as in the app.
  picture(st, deck, s, i, now) {
    const want = FiveS.KINDS[roundOf(i)], ids = FiveS.nextFive(st, deck, now);
    const kind = (id) => (FiveS.card(st, deck, id) || {}).kind;
    return [ids.find((id) => kind(id) === want && !s.in.has(id)) || ids.find((id) => !s.in.has(id)) || ids[0], null];
  },
  // Made from what was kept in earlier rounds: a word kept after the newest picture or space is its root acted out (in a
  // kept colour); else that card's colours, composition or feel. Templates kept before first; each once a game; never a
  // made line seen before. Nothing kept yet in this game: a curated line not seen before.
  line(st, deck, s) {
    const C = cat(deck), card = s.cards[0] || null, word = s.words[0] ? C.word.get(s.words[0]) : null;
    const keptT = {};
    for (const id of Object.keys(s.things)) if (s.things[id] === 1 && MADE.test(id)) keptT[id.slice(1, 3)] = (keptT[id.slice(1, 3)] || 0) + 1;
    const usedT = new Set([...s.in].filter((id) => MADE.test(id)).map((id) => id.slice(1, 3)));
    const order = shuffled(TEMPLATES.filter((t) => t !== 'wv'), s.rng).sort((a, b) => (keptT[b] || 0) - (keptT[a] || 0));
    const tries = [];
    const wordFirst = word && (!card || s.kept.indexOf(word.id) < s.kept.indexOf(card.id));
    if (wordFirst) tries.push(['wv', card, word]);
    for (const c of s.cards) for (const t of order) tries.push([t, c, null]);
    if (word && !wordFirst) tries.push(['wv', card, word]);
    for (const [t, c, w] of tries) {
      const l = lineFor(t, c, w);
      if (l && !usedT.has(t) && s.things[l.id] === undefined && !s.in.has(l.id)) return [l.id, w ? w.id : c.id];
    }
    const lines = shuffled(C.lines, s.rng), out = (l) => !s.in.has(l.id);
    const pick = lines.find((l) => out(l) && s.things[l.id] === undefined) || lines.find((l) => out(l) && s.things[l.id] !== 0) || lines.find(out) || lines[0];
    return [pick.id, null];
  },
  // A bookmark building not judged before: a room you can stand in first, while one is left; then one sharing a material
  // with the newest picture or space kept in this game; then the one the taste model is least sure of; ties by the seed.
  space(st, deck, s) {
    const C = cat(deck);
    const all = C.spaces.map((id) => FiveS.card(st, deck, id)).filter((c) => c && !s.in.has(c.id));
    if (!all.length) return [C.spaces[0], null];
    let pool = all.filter((c) => !s.at.has(c.id));
    // shortcut: once every space is judged, the oldest third comes again (29 spaces: about six games); add spaces to grow it
    if (!pool.length) pool = all.slice().sort((a, b) => s.at.get(a.id) - s.at.get(b.id)).slice(0, Math.max(1, Math.ceil(all.length / 3)));
    const src = s.cards.find((c) => (c.materials || []).length) || null;
    const shares = (c) => !!src && (c.materials || []).some((m) => src.materials.includes(m));
    const m = FiveS.model(st, deck);
    const pick = best(pool, s.rng, (c) => (C.rooms.has(c.id) && !s.at.has(c.id) ? 4 : 0) + (shares(c) ? 2 : 0) - Math.abs(FiveS.predict(m, c).p - 0.5));
    return [pick.id, shares(pick) ? src.id : null];
  },
  // A page not in this game: one holding words kept (this game's count twice, earlier ones once); never seen before seen;
  // passed before goes last. Six pages, five a game: from the second game they repeat.
  page(st, deck, s) {
    const C = cat(deck);
    const kept = new Set(Object.keys(s.things).filter((id) => thingKind(id) === 'word' && s.things[id] === 1));
    const rest = C.pages.filter((p) => !s.in.has(p.id));
    const pick = best(rest.length ? rest : C.pages, s.rng, (p) => (p.words || []).reduce((n, w) => n + (s.words.includes(w) ? 2 : kept.has(w) ? 1 : 0), 0)
      + (s.things[p.id] === undefined ? 0.5 : s.things[p.id] === 0 ? -3 : 0));
    const holds = (w) => (pick.words || []).includes(w);
    return [pick.id, s.words.find(holds) || [...kept].reverse().find(holds) || null];
  },
  // A word never met: a neighbour of the newest word kept in this game; else the word a kept picture's composition or feel
  // leads to; else a neighbour of a word kept before; else any, away from the family of a word passed in this game.
  // Only once every word is met: the same three ways, then any, to a word not passed (80 words: about 16 games).
  word(st, deck, s) {
    const C = cat(deck);
    const fresh = (id) => C.word.has(id) && !s.in.has(id) && s.things[id] !== 0;
    const unmet = (id) => fresh(id) && s.things[id] === undefined;
    const before = Object.keys(s.things).filter((id) => thingKind(id) === 'word' && s.things[id] === 1).reverse();
    const near = (ok) => {
      for (const k of s.words) for (const n of (C.word.get(k) || {}).leads || []) if (ok(n)) return [n, k];
      for (const c of s.cards) for (const w of (c.comp || []).concat(c.feel || [])) if (ok(C.pics[w])) return [C.pics[w], c.id];
      for (const k of before) for (const n of (C.word.get(k) || {}).leads || []) if (ok(n)) return [n, k];
      return null;
    };
    const close = near(unmet);
    if (close) return close;
    const away = new Set([...s.passed].filter((id) => C.word.has(id)).flatMap((id) => C.word.get(id).families || []));
    const words = shuffled(C.words, s.rng), unseen = (w) => unmet(w.id);
    const pick = words.find((w) => unseen(w) && !(w.families || []).some((f) => away.has(f))) || words.find(unseen);
    if (pick) return [pick.id, null];
    return near(fresh) || [(words.find((w) => fresh(w.id)) || words.find((w) => !s.in.has(w.id)) || words[0]).id, null];
  },
};

// Deal position i (in place when i is already dealt: its thing left the catalogue).
function dealAt(st, deck, g, i, now) {
  const [id, from] = DEAL[kindAt(i)](st, deck, seen(st, deck, g, roundOf(i) * 5), i, now);
  const put = (xs, x) => xs.slice(0, i).concat([x], xs.slice(i + 1));
  return Object.assign({}, g, { ids: put(g.ids, id), k: g.k.slice(0, i) + '-' + g.k.slice(i + 1), from: put(g.from, from || '') });
}

// ---------------------------------------------------------------- the two moves

/** open(state, deck, now) -> {state, started, dealt, changed}: the round on show, dealing the next round (or a new game)
 *  when the last is sorted. A game started on another day waits; an unanswered thing that left the catalogue is dealt again. */
export function open(state, deck, now) {
  const st = FiveS.migrate(state);
  let g = gameOf(st);
  // at is the card's seq: a later round, even of a new game in the same second, always has a larger one.
  const at = Math.max(Math.floor(now / 1000), ((g && Number(g.at)) || 0) + 1);
  const started = !g || isDone(g);
  if (started) g = { day: FiveS.dayOf(now), at, ids: [], k: '', from: [] };
  const start = Math.floor(g.ids.length / 5) * 5;
  const dealt = g.ids.length === start && (start === 0 || roundDone(g, roundOf(start - 1)));
  let changed = started || dealt;
  if (dealt || g.ids.length > start) {
    // a new round, or the rest of one cut short
    for (let i = g.ids.length; i < start + 5; i++) g = dealAt(st, deck, g, i, now);
    g = Object.assign({}, g, { at });
    changed = true;
  } else {
    for (let i = start - 5; i < start; i++) if (g.k[i] === '-' && !thing(st, deck, g.ids[i])) { g = dealAt(st, deck, g, i, now); changed = true; }
  }
  return { state: changed ? Object.assign({}, st, { game: g }) : st, started, dealt: dealt || started, changed };
}

/** answer(state, deck, id, keep, ms, now) -> null when id is not in the game (or has left the catalogue), else
 *  {state, pos, kept, repeat, turn, roundDone, gameDone}. A thing already answered records nothing (repeat: true). */
export function answer(state, deck, id, keep, ms, now) {
  let st = FiveS.migrate(state);
  const g = gameOf(st);
  const pos = g ? g.ids.lastIndexOf(id) : -1;
  if (pos < 0) return null;
  if (g.k[pos] !== '-') return { state: st, pos, kept: g.k[pos] === '1', repeat: true, turn: null, roundDone: false, gameDone: false };
  if (!thing(st, deck, id)) return null;
  let turn = null;
  if (thingKind(id)) st = Object.assign({}, st, { things: mark(st.things, id, keep) });
  else ({ state: st, turn } = FiveS.judge(st, deck, id, keep, ms, now));
  const next = Object.assign({}, g, { k: g.k.slice(0, pos) + (keep ? '1' : '0') + g.k.slice(pos + 1) });
  st = Object.assign({}, st, { game: next });
  const rd = roundDone(next, roundOf(pos)), day = FiveS.dayOf(now);
  // A round sorted counts the day for the streak, as a sorted five does.
  if (rd && st.days.indexOf(day) < 0) st = Object.assign({}, st, { days: st.days.concat([day]).sort() });
  return { state: st, pos, kept: !!keep, repeat: false, turn, roundDone: rd, gameDone: isDone(next) };
}

/** things with id's answer as the newest; past LIMITS.things the oldest answers are dropped. */
export function mark(t, id, keep) {
  const o = Object.assign({}, t);
  delete o[id];
  o[id] = keep ? 1 : 0;
  for (const k of Object.keys(o).slice(0, Math.max(0, Object.keys(o).length - LIMITS.things))) delete o[k];
  return o;
}

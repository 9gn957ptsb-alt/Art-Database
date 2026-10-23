/* What put_state accepts: the shape of a 5s state (SPEC "State"), checked field by field, so that
 * no state the connector keeps can make a tool fail later. The engine fills in what is missing
 * (FiveS.migrate) and keeps unknown fields; this only refuses values of the wrong type, and lists
 * longer than any person makes. Limits are generous: the app's own fields are shorter (a note is at
 * most 500 characters, a set's name 80, a brought thing's name 60).
 */
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const optNum = (x) => x == null || isNum(x);
const isStr = (x, max) => typeof x === 'string' && x.length <= max;
const optStr = (x, max) => x == null || isStr(x, max);
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SLOTS = ['wall', 'window', 'picture', 'floor', 'object'];

export const LIMITS = Object.freeze({ judgments: 50000, sets: 500, own: 1000, notes: 5000, days: 5000, text: 2000, name: 200, url: 2048,
  assoc: 400, levels: 999, paintings: 24 });   // Set's game (SPEC "Set: the board and the game", "Data"): the app's own caps

/**
 * What a brought-in thing may say about itself (SPEC "Connect your apps": a thing defined from a
 * pasted link, by the page, by Claude, from its address alone, or by the person), all optional and
 * the same in the app, the engine and here. Lengths in characters.
 */
export const OWN_FACTS = Object.freeze({ maker: 120, date: 40, year: 10, medium: 200, place: 60, about: 200, genes: 12, materials: 8, material: 40 });
export const DEFINED_BY = Object.freeze(['page', 'claude', 'address', 'person']);

const vocabs = new WeakMap();
/** The deck's own words for category, era and genes (deck.json cards and top-level genes). */
export function deckVocab(deck) {
  if (!deck || typeof deck !== 'object') return null;
  let v = vocabs.get(deck);
  if (!v) {
    const categories = new Set(), eras = new Set();
    for (const c of deck.cards || []) {
      if (c && typeof c.category === 'string' && c.category) categories.add(c.category);
      if (c && typeof c.era === 'string' && c.era) eras.add(c.era);
    }
    v = { categories, eras, genes: new Set(Object.keys(deck.genes || {})) };
    vocabs.set(deck, v);
  }
  return v;
}

const oneLine = (x, max) => isStr(x, max) && !/[\r\n\u2028\u2029]/.test(x);
const GENE = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** The new facts of one brought-in thing: '' when fine, else what is wrong. vocab: deckVocab(deck) or null. */
function ownFacts(o, vocab) {
  for (const k of ['maker', 'date', 'year', 'medium', 'place']) if (!(o[k] == null || isStr(o[k], OWN_FACTS[k]))) return 'has a ' + k + ' that is not text of at most ' + OWN_FACTS[k] + ' characters';
  if (!(o.about == null || oneLine(o.about, OWN_FACTS.about))) return 'has an about that is not one line of at most ' + OWN_FACTS.about + ' characters';
  if (o.category != null && !(typeof o.category === 'string' && (vocab ? vocab.categories.has(o.category) : isStr(o.category, 80)))) return 'has a category that is not one of the deck\'s categories';
  if (o.era != null && !(typeof o.era === 'string' && (vocab ? vocab.eras.has(o.era) : isStr(o.era, 40)))) return 'has an era that is not one of the deck\'s eras';
  if (o.genes != null) {
    if (!Array.isArray(o.genes) || o.genes.length > OWN_FACTS.genes) return 'has genes that are not a list of at most ' + OWN_FACTS.genes;
    if (!o.genes.every((g) => typeof g === 'string' && GENE.test(g) && (!vocab || vocab.genes.has(g)))) return 'has a gene that is not one of the deck\'s genes';
  }
  if (o.materials != null && !(Array.isArray(o.materials) && o.materials.length <= OWN_FACTS.materials && o.materials.every((m) => isStr(m, OWN_FACTS.material)))) {
    return 'has materials that are not a list of at most ' + OWN_FACTS.materials + ' words of at most ' + OWN_FACTS.material + ' characters';
  }
  if (!(o.coloursEstimated == null || typeof o.coloursEstimated === 'boolean')) return 'has a coloursEstimated that is not true or false';
  if (!(o.definedBy == null || DEFINED_BY.includes(o.definedBy))) return 'has a definedBy that is not one of ' + DEFINED_BY.join(', ');
  return '';
}

function judgment(e) {
  if (!Array.isArray(e) || e.length < 4 || e.length > 8) return 'is not [card, keep, ms, time, turn]';
  if (typeof e[0] !== 'string' || !ID.test(e[0])) return 'does not start with a card id';
  if (![0, 1, true, false].includes(e[1])) return 'has a keep that is not 1 or 0';
  if (!optNum(e[2])) return 'has a time to decide that is not a number';
  if (!isNum(e[3])) return 'has a time that is not a number';
  if (e[4] != null && ![-1, 0, 1].includes(e[4])) return 'has a turn that is not -1, 0 or 1';
  return '';
}

function own(o, vocab) {
  if (!isObj(o)) return 'is not an object';
  if (typeof o.id !== 'string' || !ID.test(o.id)) return 'has no id';
  if (!optStr(o.kind, 20) || !optStr(o.name, LIMITS.name) || !optStr(o.source, LIMITS.name)) return 'has a kind, name or source that is not short text';
  if (o.colours != null && !(Array.isArray(o.colours) && o.colours.length <= 16 && o.colours.every((h) => typeof h === 'string' && HEX.test(h)))) return 'has colours that are not hex colours';
  if (o.crop != null && !(Array.isArray(o.crop) && o.crop.length === 4 && o.crop.every(isNum))) return 'has a crop that is not four numbers';
  for (const k of ['texture', 'w', 'h', 'at', 'let', 'seenAt']) if (!optNum(o[k])) return 'has a ' + k + ' that is not a number';
  // Brought in through the connector (bring_in): the picture's address, a smaller copy's, the page it
  // came from, and whether its colours are still to be read. Addresses are checked again before any
  // tool reads them (web.js), so here they need only be short text.
  for (const k of ['image', 'thumb', 'link']) if (!optStr(o[k], LIMITS.url)) return 'has a ' + k + ' that is not an address of at most ' + LIMITS.url + ' characters';
  if (!(o.coloursPending == null || typeof o.coloursPending === 'boolean')) return 'has a coloursPending that is not true or false';
  return ownFacts(o, vocab);
}

function set(s) {
  if (!isObj(s)) return 'is not an object';
  if (!optNum(s.at) || !optStr(s.name, LIMITS.name)) return 'has a time or name of the wrong kind';
  for (const k of SLOTS) if (!(s[k] == null || (typeof s[k] === 'string' && ID.test(s[k])))) return 'has a ' + k + ' that is not a card id';
  return '';
}

function note(n) {
  if (!isObj(n)) return 'is not an object';
  if (!optNum(n.at) || !optStr(n.q, 20) || !optStr(n.text, LIMITS.text) || !optStr(n.ref, 100)) return 'has a time, question, text or reference of the wrong kind';
  return '';
}

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const PAINT = /^(?:[0-9a-f]{6}|------)*$/;

// [a, b (a < b), n 1..99, heart 0|1, last unix seconds]
function pairing(e) {
  if (!Array.isArray(e) || e.length !== 5) return 'is not [a, b, times, heart, time]';
  if (typeof e[0] !== 'string' || typeof e[1] !== 'string' || !ID.test(e[0]) || !ID.test(e[1]) || !(e[0] < e[1])) return 'does not name two things in order';
  if (!isInt(e[2], 1, 99) || ![0, 1].includes(e[3]) || !isNum(e[4])) return 'has times, heart or time of the wrong kind';
  return '';
}

// {at, n (the level), cols, rows, c: 6 hex a cell, "------" outside the painting}
function painting(p) {
  if (!isObj(p)) return 'is not an object';
  if (!isNum(p.at) || !isInt(p.n, 1, 1e6) || !isInt(p.cols, 1, 16) || !isInt(p.rows, 1, 16)) return 'has a time, level or size of the wrong kind';
  if (typeof p.c !== 'string' || p.c.length !== p.cols * p.rows * 6 || !PAINT.test(p.c)) return 'has cells that are not six hex digits each';
  return '';
}

function saga(g) {
  if (!isObj(g)) return 'state.saga must be an object.';
  for (const k of ['stars', 'best']) {
    const xs = g[k];
    if (xs == null) continue;
    if (!Array.isArray(xs) || xs.length > LIMITS.levels) return 'state.saga.' + k + ' must be a list of at most ' + LIMITS.levels + '.';
    if (!xs.every((x) => (k === 'stars' ? isInt(x, 0, 3) : isNum(x) && x >= 0))) return 'state.saga.' + k + (k === 'stars' ? ' must hold 0 to 3 stars a level.' : ' must hold scores.');
  }
  if (g.boost != null && !(isObj(g.boost) && ['pass', 'turn', 'more'].every((k) => g.boost[k] == null || isInt(g.boost[k], 0, 9)))) return 'state.saga.boost must hold 0 to 9 of each booster.';
  if (!(g.plays == null || isInt(g.plays, 0, Number.MAX_SAFE_INTEGER)) || !optStr(g.day, 20)) return 'state.saga has plays or a day of the wrong kind.';
  return '';
}

function list(s, key, max, each) {
  const xs = s[key];
  if (xs === undefined) return '';
  if (!Array.isArray(xs)) return 'state.' + key + ' must be a list.';
  if (xs.length > max) return 'state.' + key + ' has more than ' + max + ' entries.';
  for (let i = 0; i < xs.length; i++) {
    const why = each(xs[i]);
    if (why) return 'state.' + key + '[' + i + '] ' + why + '.';
  }
  return '';
}

/**
 * checkState(s, deck?) -> '' when the state is fine, else one plain sentence saying what is wrong.
 * With the deck, a brought-in thing's category, era and genes must be the deck's own words.
 */
export function checkState(s, deck) {
  if (!isObj(s)) return 'The state must be an object.';
  const vocab = deckVocab(deck);
  const why = list(s, 'j', LIMITS.judgments, judgment) ||
    list(s, 'sets', LIMITS.sets, set) ||
    list(s, 'days', LIMITS.days, (d) => (isStr(d, 20) ? '' : 'is not a date')) ||
    list(s, 'own', LIMITS.own, (o) => own(o, vocab)) ||
    list(s, 'notes', LIMITS.notes, note) ||
    list(s, 'assoc', LIMITS.assoc, pairing) ||
    list(s, 'paintings', LIMITS.paintings, painting) ||
    (s.saga != null ? saga(s.saga) : '');
  if (why) return why;
  if (s.five != null) {
    const f = s.five;
    if (!isObj(f) || !Array.isArray(f.ids) || f.ids.length > 10 || !f.ids.every((id) => typeof id === 'string' && ID.test(id))) return 'state.five must have ids: a list of card ids.';
    if (f.i != null && !(Number.isInteger(f.i) && f.i >= 0 && f.i <= f.ids.length)) return 'state.five.i must count the cards judged so far.';
    if (!optStr(f.day, 20) || !(f.n == null || (Number.isInteger(f.n) && f.n >= 1))) return 'state.five has a day or number of the wrong kind.';
  }
  if (s.seen != null && !isObj(s.seen)) return 'state.seen must be an object.';
  if (s.seen && s.seen.path != null && !(Array.isArray(s.seen.path) && s.seen.path.every((k) => isStr(k, 40)))) return 'state.seen.path must be a list of milestone names.';
  if (s.opts != null && !isObj(s.opts)) return 'state.opts must be an object.';
  if (s.opts && ['sound', 'hints'].some((k) => !(s.opts[k] == null || typeof s.opts[k] === 'boolean'))) return 'state.opts.sound and state.opts.hints must be true or false.';
  if (s.hub != null) {
    const h = s.hub;
    if (!isObj(h)) return 'state.hub must be an object.';
    // The engine's setHub keeps whatever was typed (trimmed, at most 100 and 39 characters), so any
    // short text is kept here too; the tools check GitHub's rules before using or repeating it.
    if (!optStr(h.name, 100)) return 'state.hub.name must be text of at most 100 characters.';
    if (!optStr(h.user, 39)) return 'state.hub.user must be text of at most 39 characters.';
    if (!(h.private == null || typeof h.private === 'boolean') || !optStr(h.mode, 10) || !optStr(h.savedCode, 40)) return 'state.hub has a field of the wrong kind.';
    for (const k of ['madeAt', 'savedAt']) if (!optNum(h[k])) return 'state.hub.' + k + ' must be a time.';
  }
  return '';
}

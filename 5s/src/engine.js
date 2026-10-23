/* 5s engine: the pure logic behind the five tabs (SPEC.md, "engine.js — the API").
 *
 * No DOM, no network, no clock, no Math.random. `now` is always passed in as a millisecond
 * timestamp; every random choice comes from a PRNG seeded by the day, the state or the seed code,
 * so the same inputs always give the same outputs. Every function returns new objects and never
 * mutates what it is given, so Undo and Example mode are cheap.
 *
 * Browser: window.FiveS. Node: module.exports (tests load it with createRequire).
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- constants

  const KINDS = Object.freeze(['image', 'object', 'space', 'surface', 'colour']);
  const ERAS = Object.freeze(['Before 1800', '1800s', '1900–45', '1945–69', '1970–99', '2000s', '2010s–now']);
  // Set: each place in the room takes one kind of card.
  const SLOTS = Object.freeze({ wall: 'colour', window: 'space', picture: 'image', floor: 'surface', object: 'object' });
  const SLOT_NAMES = Object.freeze(['wall', 'window', 'picture', 'floor', 'object']);
  // What a person can say a brought-in thing is, and where it came from.
  const OWN_KINDS = Object.freeze(['image', 'object', 'space']);
  const SOURCES = Object.freeze(['Your photos', 'Pinterest', 'Instagram', 'Artsy', 'Are.na', 'The web', 'Somewhere else']);
  const DECK_SOURCE = "The artist's database (Artsy)";
  // Where a deck card comes from, by its "source": the site that holds its page, what its maker is
  // called, and its line in Sources. A card with no source is from Artsy (older decks, the fixture).
  const DECK_SOURCES = Object.freeze({
    Artsy: Object.freeze({ site: 'Artsy', maker: 'Artist', sources: DECK_SOURCE }),
    'Architectural Authority': Object.freeze({ site: 'The Architectural Authority', maker: 'Architect', sources: "The artist's bookmarks (Architectural Authority)" }),
  });
  /** deckSource(card) -> its DECK_SOURCES entry ({site, maker, sources}). */
  const deckSource = (c) => DECK_SOURCES[c && hasOwn(DECK_SOURCES, c.source) ? c.source : 'Artsy'];
  const NOTE_QS = Object.freeze(['turn', 'five', 'set', 'bring', 'free']);
  const GROUPS = Object.freeze(['Qualities', 'Movements', 'Subjects', 'Materials', 'Eras', 'Places', 'Kinds', 'Colours', 'Textures']);
  // The twelve hue names used as features (degrees: upper bound of each band).
  const HUE_BANDS = [[12, 'red'], [40, 'orange'], [65, 'yellow'], [90, 'lime'], [150, 'green'], [185, 'teal'],
    [200, 'cyan'], [240, 'blue'], [260, 'indigo'], [290, 'violet'], [325, 'magenta'], [350, 'rose'], [360, 'red']];
  const HUES = Object.freeze(['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta', 'rose']);
  const WARM_HUES = Object.freeze(['red', 'orange', 'yellow', 'rose']);
  const COOL_HUES = Object.freeze(['teal', 'cyan', 'blue', 'indigo', 'violet']);
  const KIND_LABEL = { image: 'Image', object: 'Object', space: 'Space', surface: 'Surface', colour: 'Colour' };
  const GENE_FAMILY_GROUP = {
    'Visual Qualities': 'Qualities',
    'Design Concepts and Techniques': 'Qualities',
    'Styles and Movements': 'Movements',
    'Subject Matter': 'Subjects',
  };
  const COLOUR_SHARE = [0.5, 0.33, 0.17]; // the 3:2:1 bands of a Colour card
  // Feature weights: what a person reacts to (qualities, materials, hues, texture) counts fully;
  // context (kind, category, era, place) and the overall cast of the colours (value, chroma, chord)
  // count half, so incidental patterns do not make the model sure of itself too early.
  const W_CONTEXT = 0.5;
  const DAY_S = 86400;
  const TURN_MIN = 12; // judgments the model must have seen before anything counts as a turn
  const TURN_HI = 0.7;
  const TURN_LO = 0.3;
  // A prediction is only "confident" when the evidence itself points that way: the card's features
  // must move the log-odds at least as far as 0.5 -> 0.7 (or 0.3), so a high or low overall keep
  // rate alone never makes an ordinary pass or keep a turn. Set to 0 for SPEC.md's bare thresholds.
  const TURN_PUSH = Math.log(0.7 / 0.3);
  // …and the feature that moved it most must rest on at least this many judgments ("kept 0 of 3"),
  // so a chance pattern in two cards is not called a turn. Set to 0 for SPEC.md's bare thresholds.
  const TURN_EVIDENCE = 3;
  const REVISIT_GAP_S = 2 * DAY_S;
  const MAX_NOTE = 500;
  const MAX_SET_NAME = 80;
  const MAX_OWN_NAME = 60;
  // A brought thing's definition (SPEC.md "Links out and in"): optional fields, the same in the app,
  // here and in the connector's validation. Text is one line; lists are the deck's own words.
  const DEFINED_BY = Object.freeze(['page', 'claude', 'address', 'person']);
  const OWN_LIMITS = Object.freeze({
    url: 2048, maker: 120, date: 40, year: 10, medium: 200, place: 60, about: 200, category: 60,
    genes: 12, gene: 80, materials: 8, material: 40,
  });
  const OWN_TEXT = Object.freeze(['maker', 'date', 'medium', 'place', 'about']);
  const OWN_LINKS = Object.freeze(['link', 'image', 'thumb']);
  // The order the definition's fields take in a brought thing, after the fields every thing has.
  const OWN_DEFINED = Object.freeze(['link', 'image', 'thumb', 'maker', 'date', 'year', 'medium', 'place', 'about',
    'category', 'era', 'genes', 'materials', 'coloursEstimated', 'definedBy']);
  const GENE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const YEAR_TEXT = /^(?:c\.\s?)?-?\d{1,4}s?$/i;

  // The month, as eight milestones (SPEC.md "The Path").
  const MILESTONES = Object.freeze([
    { key: 'sort', step: 'Sort', label: 'Sort your first five', why: 'The artist started by looking: thousands of works, saved one at a time.' },
    { key: 'bring', step: 'Split', label: 'Bring in something of your own', why: 'The artist brought 5,021 works saved on Artsy home into one database.' },
    { key: 'kinds', step: 'Split', label: 'Keep one of each kind', why: 'The artist split every work into its colours, kind, material, date and place.' },
    { key: 'set', step: 'Set', label: "Pin a set and say what it's for", why: "The artist made new things from the parts and named each one's job in one line." },
    { key: 'turn', step: 'See', label: 'Find a turn', why: 'The artist: real transformation happens at the moments you defy your own judgments.' },
    { key: 'note', step: 'See', label: 'Write a note', why: 'The artist kept a journal of notes, one entry per question.' },
    { key: 'seed', step: 'Seed', label: 'Take your seed', why: 'The artist grew a world from the database: a game where your information is your world.' },
    { key: 'habit', step: 'Sort', label: 'Five days in a row', why: 'The artist came back to it every day.' },
  ].map(Object.freeze));

  // Your hub: four more milestones after the eight (SPEC.md "Your hub"). path() returns all twelve.
  const HUB_MILESTONES = Object.freeze([
    { key: 'github', step: 'Seed', label: 'Have a GitHub account', why: 'The artist kept everything in one GitHub repository from the first evening.' },
    { key: 'hub', step: 'Seed', label: 'Make your hub', why: "The artist's repository was made in four minutes, before the first session." },
    { key: 'saved', step: 'Seed', label: 'Save your seed to your hub', why: "The artist's database grew by saving to it, every day." },
    { key: 'opened', step: 'Seed', label: "Open your hub's address", why: "The artist's site went live on GitHub Pages on 14 Sep." },
  ].map(Object.freeze));
  const HUB_MODES = Object.freeze(['links', 'api']);
  const MAX_HUB_USER = 39;  // GitHub's longest username
  const MAX_HUB_NAME = 100; // GitHub's longest repository name

  // ---------------------------------------------------------------- small helpers

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const round = (x, d) => { const m = Math.pow(10, d || 0); return Math.round(x * m) / m; };
  const toSec = (now) => Math.floor(Number(now) / 1000);
  const logit = (p) => Math.log(p / (1 - p));
  const sigmoid = (x) => 1 / (1 + Math.exp(-x));
  const isOwnId = (id) => typeof id === 'string' && id.charAt(0) === 'y';
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const pad2 = (n) => (n < 10 ? '0' : '') + n;
  const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const assign = (...xs) => Object.assign({}, ...xs);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  const article = (w) => (/^[aeiou]/i.test(String(w)) ? 'an ' : 'a ') + w;
  const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const hasOwn = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  // One line of text: control, zero-width and bidi characters gone, whitespace collapsed.
  const oneLine = (x) => (typeof x === 'string' || isNum(x)
    ? String(x).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g, ' ').replace(/\s+/g, ' ').trim() : '');
  // An https address of at most OWN_LIMITS.url characters with no spaces, or ''.
  const httpsAddr = (x) => (typeof x === 'string' && x.length <= OWN_LIMITS.url && /^https:\/\/[^\s/?#@]+(?:[/?#]\S*)?$/i.test(x) ? x : '');

  // FNV-1a, then the murmur3 finaliser so near-identical strings spread over all 32 bits.
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** prng(code) -> () => number in [0, 1): mulberry32 seeded by a hash of the code. */
  function prng(code) { return mulberry32(hash32(String(code))); }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[k]; a[k] = t; }
    return a;
  }

  /** dayOf(now) -> "2026-10-21", the local date of a millisecond timestamp. */
  function dayOf(now) {
    const d = new Date(Number(now));
    if (isNaN(d.getTime())) return '1970-01-01';
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // Calendar arithmetic on "YYYY-MM-DD" strings (UTC maths, so no daylight-saving surprises).
  function addDays(day, n) {
    const p = String(day).split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function longestRun(days) {
    const set = new Set(days);
    let best = 0;
    for (const d of set) {
      if (set.has(addDays(d, -1))) continue; // not the start of a run
      let n = 0, x = d;
      while (set.has(x)) { n++; x = addDays(x, 1); }
      if (n > best) best = n;
    }
    return best;
  }

  // ---------------------------------------------------------------- colour

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function normHex(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') : null;
  }

  // HSL plus chroma (max - min, 0..1), the part of a colour that is not grey.
  function hslc(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return { h: 0, s: 0, l: 0, c: 0 };
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h % 360, s, l, c: d };
  }

  /** hexToHsl(hex) -> {h, s, l}: h 0..360, s and l 0..1. */
  function hexToHsl(hex) { const x = hslc(hex); return { h: x.h, s: x.s, l: x.l }; }

  // A colour reads as a hue (not a grey) when it carries real chroma.
  const isChromatic = (x) => x.s >= 0.15 && x.c >= 0.07 && x.l >= 0.08 && x.l <= 0.96;

  function hueBand(h) {
    for (const [to, name] of HUE_BANDS) if (h < to) return name;
    return 'red';
  }

  function neutralName(l) {
    if (l >= 0.95) return 'white';
    if (l >= 0.86) return 'off-white';
    if (l >= 0.7) return 'pale grey';
    if (l >= 0.58) return 'light grey';
    if (l >= 0.4) return 'grey';
    if (l >= 0.24) return 'dark grey';
    if (l >= 0.12) return 'charcoal';
    return 'black';
  }

  // Low-chroma colours with a lean: the browns, beiges, sages and slates people name by warmth.
  function tintedName(h, l, c) {
    if (h >= 15 && h < 65) { // warm: the beige and brown family
      if (l >= 0.86) return c < 0.06 ? 'off-white' : 'cream';
      if (c < 0.06) return l >= 0.3 ? 'warm grey' : 'dark brown';
      if (l >= 0.74) return 'beige';
      if (l >= 0.58) return 'sand';
      if (l >= 0.4) return 'taupe';
      if (l >= 0.24) return 'dark taupe';
      return 'dark brown';
    }
    if (h < 15 || h >= 330) { // red lean
      if (l >= 0.78) return 'blush';
      if (c < 0.06) return l >= 0.3 ? 'warm grey' : 'dark brown';
      if (l >= 0.48) return 'mauve';
      if (l >= 0.26) return 'dark mauve';
      return 'dark brown';
    }
    if (h < 170) { // green lean
      if (l >= 0.75) return 'pale sage';
      if (l >= 0.48) return 'sage';
      if (l >= 0.28) return 'grey-green';
      return 'dark grey-green';
    }
    if (h < 260) { // blue lean
      if (c < 0.06 && l >= 0.3 && l < 0.86) return 'cool grey';
      if (l >= 0.78) return 'pale blue-grey';
      if (l >= 0.5) return 'blue-grey';
      if (l >= 0.25) return 'slate';
      return 'dark slate';
    }
    // violet lean
    if (l >= 0.75) return 'pale lilac';
    if (l >= 0.48) return 'dusty lilac';
    if (l >= 0.26) return 'dusky purple';
    return 'aubergine';
  }

  // Each family: [hue upper bound, deep (l<.2), dark (l<.33), mid, light (l<.8), pale].
  const FAMILIES = [
    [10, 'maroon', 'maroon', 'red', 'pink', 'pale pink'],
    [34, 'dark brown', 'brown', 'orange', 'peach', 'pale peach'],
    [50, 'dark brown', 'brown', 'amber', 'light gold', 'cream'],
    [66, 'dark olive', 'olive', 'yellow', 'light yellow', 'pale yellow'],
    [90, 'dark olive', 'olive', 'lime', 'light lime', 'pale lime'],
    [155, 'deep green', 'forest green', 'green', 'light green', 'mint'],
    [195, 'deep teal', 'dark teal', 'teal', 'aqua', 'pale aqua'],
    [245, 'navy', 'navy', 'blue', 'sky blue', 'pale blue'],
    [265, 'deep indigo', 'indigo', 'indigo', 'periwinkle', 'pale periwinkle'],
    [290, 'deep purple', 'purple', 'violet', 'lavender', 'pale lavender'],
    [330, 'deep plum', 'plum', 'magenta', 'orchid', 'pale pink'],
    [348, 'burgundy', 'burgundy', 'rose', 'pink', 'pale pink'],
    [360, 'maroon', 'maroon', 'red', 'pink', 'pale pink'],
  ];

  function chromaticNameSpecial(h, s, l, c) {
    if ((h < 18 || h >= 355) && l >= 0.28 && l < 0.52 && c >= 0.3 && c < 0.75) return 'brick red';
    if ((h < 20 || h >= 350) && l >= 0.55 && l < 0.75 && s >= 0.5) return 'coral';
    if (h >= 18 && h < 30 && l >= 0.33 && l < 0.45 && c >= 0.3) return 'rust';
    if (h >= 18 && h < 27 && l >= 0.45 && l < 0.56 && c >= 0.3 && c < 0.7) return 'terracotta';
    if (h >= 10 && h < 50 && l >= 0.33 && l < 0.75 && s < 0.5) return l >= 0.45 ? 'tan' : 'brown';
    if (h >= 34 && h < 58 && l >= 0.3 && l < 0.5 && s >= 0.35 && s < 0.8) return h < 42 ? 'warm ochre' : 'ochre';
    if (h >= 45 && h < 70 && l >= 0.45 && l < 0.75 && s < 0.5) return 'khaki';
    if (h >= 50 && h < 66 && l >= 0.3 && l < 0.55 && c < 0.75) return 'mustard';
    return null;
  }

  function chromaticName(h, s, l, c) {
    // Named in-between colours people actually say, then family + lightness.
    const special = chromaticNameSpecial(h, s, l, c);
    if (special) return special;
    let fam = FAMILIES[FAMILIES.length - 1];
    for (const f of FAMILIES) if (h < f[0]) { fam = f; break; }
    if (l < 0.2) return fam[1];
    if (l < 0.33) return fam[2];
    if (l >= 0.8) return fam[5];
    if (l >= 0.62) return fam[4];
    const base = fam[3];
    if (c >= 0.8) return 'bright ' + base;
    if (c < 0.3) return 'dusty ' + base;
    return base;
  }

  /** colourName(hex) -> plain words people use ("pale grey", "deep teal", "brick red"), at most 3 words. */
  function colourName(hex) {
    if (!hexToRgb(hex)) return 'grey';
    const x = hslc(hex);
    if (x.l < 0.09) return 'black';
    if (x.l >= 0.97 && x.c < 0.1) return 'white';
    if (x.c < 0.035) return neutralName(x.l);
    if (x.c < 0.06 || x.s < 0.22 || (x.c < 0.16 && x.s < 0.3) || (x.l >= 0.86 && x.c < 0.12 && x.s < 0.58)) return tintedName(x.h, x.l, x.c);
    return chromaticName(x.h, x.s, x.l, x.c);
  }

  function arc(a, b) { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }

  /** chord(hexes) -> how a work's colours relate (the art database's six chords). */
  function chord(hexes) {
    const hs = (Array.isArray(hexes) ? hexes : []).filter((x) => hexToRgb(x)).map(hslc);
    const chromatic = hs.filter((x) => x.s >= 0.15);
    if (!chromatic.length) return 'neutral';
    if (chromatic.length === 1) return 'accent';
    let spread = 0;
    for (let i = 0; i < chromatic.length; i++) {
      for (let k = i + 1; k < chromatic.length; k++) spread = Math.max(spread, arc(chromatic[i].h, chromatic[k].h));
    }
    if (spread <= 25) return 'monochrome';
    if (spread <= 70) return 'analogous';
    if (spread >= 140) return 'complementary';
    return 'split';
  }

  // Neutrals first (light to dark), then round the wheel.
  function sortColours(hexes) {
    return hexes.slice().sort((a, b) => {
      const x = hslc(a), y = hslc(b);
      const cx = isChromatic(x), cy = isChromatic(y);
      if (cx !== cy) return cx ? 1 : -1;
      if (!cx) return y.l - x.l || cmpStr(a, b);
      return x.h - y.h || x.l - y.l || cmpStr(a, b);
    });
  }

  // ---------------------------------------------------------------- features

  function colourFeatures(colours, f) {
    const hexes = (Array.isArray(colours) ? colours : []).map(normHex).filter(Boolean).slice(0, 3);
    if (!hexes.length) return;
    const shares = COLOUR_SHARE.slice(0, hexes.length);
    const total = shares.reduce((a, b) => a + b, 0);
    let meanL = 0, meanC = 0;
    hexes.forEach((hex, i) => {
      const w = shares[i] / total;
      const x = hslc(hex);
      const key = 'hue:' + (isChromatic(x) ? hueBand(x.h) : 'neutral');
      f[key] = round((f[key] || 0) + w, 2);
      meanL += w * x.l;
      meanC += w * x.c;
    });
    f['value:' + (meanL < 0.36 ? 'dark' : meanL > 0.64 ? 'light' : 'mid')] = W_CONTEXT;
    f['chroma:' + (meanC >= 0.3 ? 'vivid' : 'muted')] = W_CONTEXT;
    f['chord:' + chord(hexes)] = W_CONTEXT;
  }

  function computeFeatures(card) {
    const f = {};
    if (!card || typeof card !== 'object') return f;
    const kind = card.kind;
    if (kind !== 'colour') {
      if (kind) f['kind:' + kind] = W_CONTEXT;
      if (kind !== 'surface') {
        if (card.category) f['cat:' + card.category] = W_CONTEXT;
        if (card.era) f['era:' + card.era] = W_CONTEXT;
        if (card.place) f['place:' + card.place] = W_CONTEXT;
        for (const g of card.genes || []) f['gene:' + g] = 1;
      }
      for (const m of card.materials || []) f['mat:' + m] = 1;
      if ((kind === 'surface' || card.own) && isNum(card.texture)) f['texture:' + (card.texture < 0.5 ? 'fine' : 'coarse')] = 1;
    }
    colourFeatures(card.colours, f);
    return f;
  }

  const featureCache = new WeakMap();
  function featuresOf(card) {
    if (!card || typeof card !== 'object') return {};
    if (card.own) return computeFeatures(card);
    let f = featureCache.get(card);
    if (!f) { f = computeFeatures(card); featureCache.set(card, f); }
    return f;
  }

  /** features(card) -> {[feature]: weight}. Colour cards carry colour features only; Surface cards
   *  colour + material + texture + kind; brought things colour + kind (+ texture). */
  function features(card) { return assign(featuresOf(card)); }

  function splitKey(key) {
    const s = String(key);
    const i = s.indexOf(':');
    return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 1)];
  }

  function geneGroup(slug, genes) {
    const g = genes && genes[slug];
    return (g && GENE_FAMILY_GROUP[g.family]) || 'Qualities';
  }

  function groupOf(key, genes) {
    const [type, v] = splitKey(key);
    switch (type) {
      case 'gene': return geneGroup(v, genes);
      case 'mat': return 'Materials';
      case 'era': return 'Eras';
      case 'place': return 'Places';
      case 'kind': case 'cat': return 'Kinds';
      case 'hue': case 'value': case 'chroma': case 'chord': return 'Colours';
      case 'texture': return 'Textures';
      default: return 'Qualities';
    }
  }

  /** featureGroup(key, deck) -> the Split/See section a feature belongs to. */
  function featureGroup(key, deck) { return groupOf(key, deck && deck.genes); }

  /** featureLabel(key, deck) -> "Biomorphic" | "Wood" | "1970–99" | "Orange" | "Fine texture" … */
  function featureLabel(key, deck) {
    const [type, v] = splitKey(key);
    switch (type) {
      case 'kind': return KIND_LABEL[v] || capital(v);
      case 'cat': case 'era': case 'place': return v;
      case 'mat': return capital(v);
      case 'gene': {
        const g = deck && deck.genes && deck.genes[v];
        if (g && g.name) return g.name;
        return v.split('-').map(capital).join(' ');
      }
      case 'hue': return capital(v);
      case 'value': return { light: 'Light', mid: 'Mid-tone', dark: 'Dark' }[v] || capital(v);
      case 'chroma': return { muted: 'Muted', vivid: 'Vivid' }[v] || capital(v);
      case 'chord': return capital(v);
      case 'texture': return { fine: 'Fine texture', coarse: 'Coarse texture' }[v] || capital(v) + ' texture';
      default: return String(key);
    }
  }

  // ---------------------------------------------------------------- deck and cards

  const deckIndexes = new WeakMap();
  function indexOf(deck) {
    if (!deck || typeof deck !== 'object') return new Map();
    let m = deckIndexes.get(deck);
    if (!m) {
      m = new Map();
      for (const c of deck.cards || []) if (c && c.id) m.set(c.id, c);
      deckIndexes.set(deck, m);
    }
    return m;
  }

  // A brought thing's definition as card fields: what it is (maker, date, medium, place, about), the
  // deck's words for it (category, era, genes, materials: these feed features() as a deck card's do),
  // and where it lives (link, image, thumb). A thing with no definition gets [] and null, as before.
  function ownDefinition(o) {
    const str = (k) => (typeof o[k] === 'string' && o[k] ? o[k] : null);
    const list = (k) => (Array.isArray(o[k]) ? o[k].filter((x) => typeof x === 'string' && x) : []);
    // The year as a number, as a deck card has it: from `year`, else the first year in `date`.
    const y = typeof o.year === 'string' || isNum(o.year) ? /(-?\d{1,4})/.exec(String(o.year))
      : typeof o.date === 'string' ? /\b(\d{3,4})\b/.exec(o.date) : null;
    return {
      materials: list('materials'), genes: list('genes').filter((g) => GENE_SLUG.test(g)),
      era: ERAS.indexOf(o.era) >= 0 ? o.era : null, place: str('place'),
      date: str('date') || (typeof o.year === 'string' && o.year ? o.year : null), year: y ? Number(y[1]) : null,
      category: str('category'), maker: str('maker'), medium: str('medium'), about: str('about'),
      link: httpsAddr(o.link) || null, image: httpsAddr(o.image) || null, thumb: httpsAddr(o.thumb) || null,
      coloursEstimated: o.coloursEstimated === true, definedBy: DEFINED_BY.indexOf(o.definedBy) >= 0 ? o.definedBy : null,
    };
  }

  function ownCard(o) {
    return assign({
      id: o.id, kind: o.kind, own: true, source: o.source || 'Somewhere else',
      title: o.name || 'Untitled', artist: 'You',
      colours: Array.isArray(o.colours) ? o.colours.slice() : [],
      crop: Array.isArray(o.crop) ? o.crop.slice() : null,
      texture: isNum(o.texture) ? o.texture : null,
      w: o.w == null ? null : o.w, h: o.h == null ? null : o.h,
      materials: [], genes: [], era: null, place: null, img: null,
      work: null, url: null, date: null, year: null, category: null,
      at: o.at == null ? null : o.at, let: o.let == null ? null : o.let, seenAt: o.seenAt == null ? null : o.seenAt,
      imgFrom: o.imgFrom || null,
    }, ownDefinition(o));
  }

  function cardOf(st, deck, id) {
    if (isOwnId(id)) {
      const o = st.own.find((x) => x && x.id === id);
      return o ? ownCard(o) : null;
    }
    return indexOf(deck).get(id) || null;
  }

  /** card(state, deck, id) -> a deck card, a brought-in thing shaped as a card, or null. */
  function card(state, deck, id) { return cardOf(norm(state), deck, id); }

  // ---------------------------------------------------------------- state

  /** newState() -> an empty State (SPEC.md "State"). */
  function newState() {
    return { v: 1, j: [], five: null, sets: [], days: [], own: [], notes: [], seen: { path: [] }, opts: { ring: true }, assoc: [], saga: newSaga(), paintings: [] };
  }
  // Set's game (SPEC "Set: the board and the game", "Data"): the saga's progress; the first play holds one of each booster.
  const newSaga = () => ({ stars: [], best: [], boost: { pass: 1, turn: 1, more: 1 }, plays: 0, day: null });
  // The game's fields as its modules read them (a hand-edited or foreign state reaches the board, the map's
  // HTML and the game): a malformed pairing or painting is dropped; a wrong part of the saga is its default.
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  // As the game writes them and the connector's put_state takes them, so a state read back can be put back.
  const isPair = (e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string' && e[0] < e[1] && isInt(e[2], 1, 99) && (e[3] === 0 || e[3] === 1) && Number.isFinite(e[4]);
  const isPainting = (p) => isObj(p) && isInt(p.n, 1, 1e6) && Number.isFinite(p.at) && isInt(p.cols, 1, 16) && isInt(p.rows, 1, 16) &&
    typeof p.c === 'string' && p.c.length === p.cols * p.rows * 6 && /^(?:[0-9a-f]{6}|------)*$/.test(p.c);
  function normSaga(g) {
    if (!isObj(g)) return newSaga();
    const b = isObj(g.boost) ? g.boost : {}, held = (x) => (isInt(x, 0, 9) ? x : 1);
    const list = (xs, ok, d) => (Array.isArray(xs) ? xs.slice(0, 999).map((x) => (ok(x) ? x : d)) : []);
    return assign(g, {
      stars: list(g.stars, (x) => isInt(x, 0, 3), 1), best: list(g.best, (x) => Number.isFinite(x) && x >= 0, 0),
      boost: assign(b, { pass: held(b.pass), turn: held(b.turn), more: held(b.more) }),
      plays: isInt(g.plays, 0, Number.MAX_SAFE_INTEGER) ? g.plays : 0, day: typeof g.day === 'string' && g.day.length <= 20 ? g.day : null,
    });
  }

  // Fill in whatever an older or partial saved state is missing, without touching it.
  function norm(s) {
    const x = s && typeof s === 'object' ? s : {};
    const seen = x.seen && typeof x.seen === 'object' ? x.seen : {};
    return assign(x, {
      v: 1,
      j: Array.isArray(x.j) ? x.j : [],
      five: x.five && Array.isArray(x.five.ids) ? x.five : null,
      sets: Array.isArray(x.sets) ? x.sets : [],
      days: Array.isArray(x.days) ? x.days : [],
      own: Array.isArray(x.own) ? x.own : [],
      notes: Array.isArray(x.notes) ? x.notes : [],
      seen: Array.isArray(seen.path) ? seen : assign(seen, { path: [] }),
      opts: x.opts && typeof x.opts === 'object' ? x.opts : { ring: true },
      // the game's caps (400 pairings, 24 paintings) also hold for a state edited by hand: it stays under the store's limit
      assoc: Array.isArray(x.assoc) ? x.assoc.filter(isPair).slice(0, 400) : [],
      saga: normSaga(x.saga),
      paintings: Array.isArray(x.paintings) ? x.paintings.filter(isPainting).slice(0, 24) : [],
    });
  }

  /** migrate(saved) -> a well-formed State from saved JSON (fills defaults; keeps unknown fields). */
  function migrate(saved) { return norm(saved); }

  /** setOpt(state, key, value) -> State with opts[key] = value (e.g. "ring"). */
  function setOpt(state, key, value) {
    const st = norm(state);
    return assign(st, { opts: assign(st.opts, { [key]: value }) });
  }

  // ---------------------------------------------------------------- the taste model

  // What the model has seen: deck judgments (revisits of brought things are not counted twice),
  // plus every brought thing as one keep, or one pass once it is let go. `upto` and `tSec` replay
  // the state as it was just before judgment `upto`.
  function observations(st, deck, upto, tSec) {
    const idx = indexOf(deck);
    const out = [];
    const end = upto == null ? st.j.length : upto;
    for (let i = 0; i < end; i++) {
      const e = st.j[i];
      if (!Array.isArray(e) || isOwnId(e[0])) continue;
      const c = idx.get(e[0]);
      if (c) out.push({ card: c, kept: e[1] === 1 || e[1] === true, t: e[3], i });
    }
    for (const o of st.own) {
      if (!o || (tSec != null && o.at > tSec)) continue;
      const gone = o.let != null && (tSec == null || o.let <= tSec);
      out.push({ card: ownCard(o), kept: !gone, t: o.at, own: true });
    }
    return out;
  }

  function buildModel(st, deck, upto, tSec) {
    const f = {};
    let n = 0, k = 0;
    for (const ob of observations(st, deck, upto, tSec)) {
      n++;
      if (ob.kept) k++;
      const fs = featuresOf(ob.card);
      for (const key in fs) {
        const c = f[key] || (f[key] = { k: 0, n: 0 });
        c.n++;
        if (ob.kept) c.k++;
      }
    }
    return { n, k, base: (k + 2) / (n + 4), f, genes: (deck && deck.genes) || {} };
  }

  /** model(state, deck) -> {n, k, base, f: {[feature]: {k, n}}, genes}: Beta counts per feature. */
  function model(state, deck) { return buildModel(norm(state), deck, null, null); }

  function predictRaw(m, c) {
    const mm = m && m.f ? m : { n: 0, k: 0, base: 0.5, f: {}, genes: {} };
    const l0 = logit(mm.base);
    const fs = featuresOf(c);
    const keys = Object.keys(fs);
    const inGroup = {};
    for (const key of keys) { const g = groupOf(key, mm.genes); inGroup[g] = (inGroup[g] || 0) + 1; }
    let x = l0;
    const because = [];
    for (const key of keys) {
      const cnt = mm.f[key];
      if (!cnt || cnt.n < 2) continue;
      const d = fs[key] * (logit((cnt.k + 1) / (cnt.n + 2)) - l0) / Math.sqrt(inGroup[groupOf(key, mm.genes)]);
      x += d;
      because.push({ key, kept: cnt.k, n: cnt.n, keptRate: round(cnt.k / cnt.n, 2), delta: d });
    }
    because.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || cmpStr(a.key, b.key));
    const p = sigmoid(x);
    return { p, push: x - l0, confidence: Math.abs(2 * p - 1) * mm.n / (mm.n + 10), because };
  }

  /** predict(model, card) -> {p, push, confidence, because: [{key, keptRate, kept, n, delta}]} (≤ 5, biggest first).
   *  push = how far the card's features move the log-odds from the overall keep rate. */
  function predict(m, c) {
    const r = predictRaw(m, c);
    return {
      p: round(r.p, 4),
      push: round(r.push, 3),
      confidence: round(r.confidence, 3),
      because: r.because.slice(0, 5).map((b) => assign(b, { delta: round(b.delta, 3) })),
    };
  }

  // The one or two features that pushed the prediction the way the person went against.
  function turnBecause(pr, dir, deck) {
    const list = pr.because.filter((b) => (dir > 0 ? b.delta < 0 : b.delta > 0));
    const out = list.slice(0, 1);
    if (list[1] && Math.abs(list[1].delta) >= 0.5 * Math.abs(list[0].delta)) out.push(list[1]);
    return out.map((b) => ({ key: b.key, label: featureLabel(b.key, deck), kept: b.kept, n: b.n, keptRate: b.keptRate, delta: round(b.delta, 3) }));
  }

  // ---------------------------------------------------------------- judging

  /** judge(state, deck, cardId, keep, ms, now) -> {state, turn}. The prediction is made before the
   *  judgment is counted; a turn is a judgment against a confident prediction (≥ 12 judgments,
   *  p ≥ 0.70 but passed, or p ≤ 0.30 but kept, with the features themselves pushing that way and
   *  the leading reason seen at least 3 times: see TURN_PUSH, TURN_EVIDENCE). turn = {dir, p, because} or null. */
  function judge(state, deck, cardId, keep, ms, now) {
    const st = norm(state);
    const t = toSec(now);
    const kept = keep ? 1 : 0;
    const c = cardOf(st, deck, cardId);
    let turn = null, dir = 0;
    if (c && !c.own && st.j.length >= TURN_MIN) {
      const pr = predictRaw(buildModel(st, deck, null, null), c);
      if (kept && pr.p <= TURN_LO && pr.push <= -TURN_PUSH) dir = 1;
      else if (!kept && pr.p >= TURN_HI && pr.push >= TURN_PUSH) dir = -1;
      const because = dir ? turnBecause(pr, dir, deck) : [];
      if (dir && (!because.length || because[0].n < TURN_EVIDENCE)) dir = 0;
      if (dir) turn = { dir, p: round(pr.p, 3), because };
    }
    const j = st.j.concat([[cardId, kept, Math.round(clamp(Number(ms) || 0, 0, 600000)), t, dir]]);
    let five = st.five, days = st.days;
    if (five && five.i < five.ids.length && five.ids[five.i] === cardId) {
      five = assign(five, { i: five.i + 1 });
      if (five.i >= five.ids.length) {
        const d = dayOf(now);
        if (days.indexOf(d) < 0) { days = days.concat([d]).sort(); five.added = d; }
      }
    }
    let own = st.own;
    if (isOwnId(cardId) && own.some((o) => o && o.id === cardId)) {
      own = own.map((o) => (o && o.id === cardId ? assign(o, { seenAt: t, let: kept ? null : t }) : o));
    }
    return { state: assign(st, { j, five, days, own }), turn };
  }

  /** undo(state) -> State without the last judgment (and the five, days and brought thing as before it). */
  function undo(state) {
    const st = norm(state);
    if (!st.j.length) return assign(st);
    const last = st.j[st.j.length - 1];
    const j = st.j.slice(0, -1);
    let five = st.five, days = st.days;
    if (five && five.i > 0 && five.ids[five.i - 1] === last[0]) {
      five = assign(five, { i: five.i - 1 });
      if (five.added) { days = days.filter((d) => d !== five.added); delete five.added; }
    }
    let own = st.own;
    if (isOwnId(last[0])) {
      const mine = j.filter((e) => e[0] === last[0]);
      const prev = mine[mine.length - 1];
      own = own.map((o) => (o && o.id === last[0]
        ? assign(o, { seenAt: prev ? prev[3] : null, let: prev && !prev[1] ? prev[3] : null })
        : o));
    }
    return assign(st, { j, five, days, own });
  }

  // ---------------------------------------------------------------- the five

  function fiveIsDone(five) { return !!five && five.i >= five.ids.length; }

  function fiveNumber(st, day) {
    const prev = st.five;
    if (!prev || prev.day !== day) return 1;
    const n = prev.n || 1;
    return fiveIsDone(prev) ? n + 1 : n;
  }

  // The brought thing that comes back as "Still yours?", if any: brought before this five started,
  // not let go, not revisited in the last 2 days; the least recently revisited first.
  function revisitFor(st, t) {
    const ok = st.own.filter((o) => o && OWN_KINDS.indexOf(o.kind) >= 0 && o.let == null && isNum(o.at) && o.at < t &&
      (o.seenAt == null || t - o.seenAt >= REVISIT_GAP_S));
    ok.sort((a, b) => {
      const sa = a.seenAt == null ? -Infinity : a.seenAt, sb = b.seenAt == null ? -Infinity : b.seenAt;
      return sa - sb || a.at - b.at || cmpStr(a.id, b.id);
    });
    return ok[0] || null;
  }

  function spreadKeys(c) {
    return Object.keys(featuresOf(c)).filter((k) => k.indexOf('chord:') === 0 || k.indexOf('era:') === 0 || k.indexOf('place:') === 0);
  }

  /** nextFive(state, deck, now) -> [cardId × 5]: one per kind, shuffled; deterministic for (state, day). */
  function nextFive(state, deck, now) {
    const st = norm(state);
    const day = dayOf(now);
    const t = toSec(now);
    const n = fiveNumber(st, day);
    const rng = prng('five|' + day + '|' + n + '|' + st.j.length);
    const idx = indexOf(deck);
    const cards = (deck && deck.cards) || [];
    const byKind = {};
    for (const k of KINDS) byKind[k] = [];
    for (const c of cards) if (c && byKind[c.kind]) byKind[c.kind].push(c);

    const lastSeen = new Map(); // id -> index of its latest judgment
    let judged = 0;
    st.j.forEach((e, i) => {
      if (!Array.isArray(e)) return;
      lastSeen.set(e[0], i);
      if (!isOwnId(e[0]) && idx.has(e[0])) judged++;
    });

    const modes = {};
    if (judged < 10) {
      for (const k of KINDS) modes[k] = 'spread';
    } else {
      const order = shuffle(['match', 'match', 'match', 'explore', 'dare'], rng);
      KINDS.forEach((k, i) => { modes[k] = order[i]; });
    }
    const m = judged < 10 ? null : buildModel(st, deck, null, null);

    // For the first fives: spread across chords, eras and places.
    const usage = {};
    if (!m) {
      for (const e of st.j) {
        const c = Array.isArray(e) && idx.get(e[0]);
        if (c) for (const k of spreadKeys(c)) usage[k] = (usage[k] || 0) + 0.25;
      }
    }

    const picks = [];
    for (const kind of KINDS) {
      const all = byKind[kind];
      if (!all.length) continue;
      let pool = all.filter((c) => !lastSeen.has(c.id));
      if (!pool.length) {
        const oldest = all.slice().sort((a, b) => lastSeen.get(a.id) - lastSeen.get(b.id));
        pool = oldest.slice(0, Math.max(1, Math.ceil(oldest.length / 3)));
      }
      let best = null, bestScore = -Infinity;
      for (const c of pool) {
        let score;
        if (!m) {
          score = -spreadKeys(c).reduce((a, k) => a + (usage[k] || 0), 0) + 1.5 * rng();
        } else {
          const p = predictRaw(m, c).p;
          if (modes[kind] === 'match') score = p + 0.3 * (rng() - 0.5);
          else if (modes[kind] === 'dare') score = -p + 0.1 * rng();
          else {
            const keys = Object.keys(featuresOf(c));
            const novelty = keys.length ? keys.reduce((a, k) => a + 1 / (1 + ((m.f[k] && m.f[k].n) || 0)), 0) / keys.length : 0;
            score = -Math.abs(p - 0.5) + 0.5 * novelty + 0.1 * rng();
          }
        }
        if (score > bestScore) { best = c; bestScore = score; }
      }
      if (!m) for (const k of spreadKeys(best)) usage[k] = (usage[k] || 0) + 1;
      picks.push({ kind, id: best.id });
    }

    const back = revisitFor(st, t);
    if (back) {
      const slot = picks.find((p) => p.kind === back.kind);
      if (slot) slot.id = back.id;
      else picks.push({ kind: back.kind, id: back.id });
    }
    return shuffle(picks.map((p) => p.id), rng);
  }

  /** isRevisit(state, id) -> true when the card is one of the person's own things ("Still yours?"). */
  function isRevisit(state, id) {
    const st = norm(state);
    return isOwnId(id) && st.own.some((o) => o && o.id === id);
  }

  /** startFive(state, deck, now) -> State with five = {ids: nextFive(...), day, n, i: 0}. */
  function startFive(state, deck, now) {
    const st = norm(state);
    const day = dayOf(now);
    return assign(st, { five: { ids: nextFive(st, deck, now), day, n: fiveNumber(st, day), i: 0 } });
  }

  /** currentCard(state) -> the id to judge now, or null when the five is done (or none is started). */
  function currentCard(state) {
    const five = norm(state).five;
    return five && five.i < five.ids.length ? five.ids[five.i] : null;
  }

  /** fiveDone(state) -> true when the five in progress has been judged to the end. */
  function fiveDone(state) { return fiveIsDone(norm(state).five); }

  /** fivePass(state, now) -> State: a five sorted gives Set's game one Pass, once a day (at most 9 held). */
  function fivePass(state, now) {
    const st = norm(state);
    const day = dayOf(now);
    if (!fiveIsDone(st.five) || st.saga.day === day) return st;
    const boost = assign({ pass: 1, turn: 1, more: 1 }, st.saga.boost);
    return assign(st, { saga: assign(st.saga, { day, boost: assign(boost, { pass: Math.min(9, (boost.pass | 0) + 1) }) }) });
  }

  /** streak(state, now) -> consecutive days in state.days ending today or yesterday. */
  function streak(state, now) {
    const set = new Set(norm(state).days);
    let d = dayOf(now);
    if (!set.has(d)) { d = addDays(d, -1); if (!set.has(d)) return 0; }
    let n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  // ---------------------------------------------------------------- sets

  /** pinSet(state, {wall, window, picture, floor, object, name?}, now) -> State. */
  function pinSet(state, set, now) {
    const st = norm(state);
    const s = { at: toSec(now) };
    for (const slot of SLOT_NAMES) s[slot] = set && typeof set[slot] === 'string' ? set[slot] : null;
    const name = set && typeof set.name === 'string' ? set.name.replace(/\s+/g, ' ').trim().slice(0, MAX_SET_NAME) : '';
    if (name) s.name = name;
    return assign(st, { sets: st.sets.concat([s]) });
  }

  /** unpinSet(state, index) -> State without that pinned set. */
  function unpinSet(state, index) {
    const st = norm(state);
    return assign(st, { sets: st.sets.filter((_, i) => i !== index) });
  }

  // Latest judgment per deck card, oldest first.
  function latestJudgments(st, deck) {
    const idx = indexOf(deck);
    const last = new Map();
    for (const e of st.j) {
      if (!Array.isArray(e) || isOwnId(e[0]) || !idx.has(e[0])) continue;
      last.delete(e[0]);
      last.set(e[0], e);
    }
    return Array.from(last.values());
  }

  // Everything currently in the person's database: kept deck cards and brought things not let go.
  function keptThings(st, deck) {
    const idx = indexOf(deck);
    const out = [];
    for (const e of latestJudgments(st, deck)) if (e[1] === 1 || e[1] === true) out.push({ id: e[0], kind: idx.get(e[0]).kind, t: e[3], card: idx.get(e[0]) });
    for (const o of st.own) if (o && o.let == null && OWN_KINDS.indexOf(o.kind) >= 0) out.push({ id: o.id, kind: o.kind, t: o.seenAt || o.at || 0, card: ownCard(o), own: true });
    out.sort((a, b) => b.t - a.t || cmpStr(a.id, b.id));
    return out;
  }

  function slotPool(st, deck, slot) {
    const kind = SLOTS[slot];
    if (!kind) return [];
    const kept = keptThings(st, deck);
    let pool = kept.filter((x) => x.kind === kind ||
      (x.own && slot === 'wall' && x.card.colours.length) ||
      (x.own && slot === 'floor' && x.card.crop));
    if (!pool.length && slot === 'wall') pool = kept.filter((x) => (x.card.colours || []).length); // colours of kept works
    const m = buildModel(st, deck, null, null);
    const scored = pool.map((x) => ({ id: x.id, t: x.t, p: predictRaw(m, x.card).p }));
    scored.sort((a, b) => b.p - a.p || b.t - a.t || cmpStr(a.id, b.id));
    return scored.map((x) => x.id);
  }

  /** setPool(state, deck, slot) -> every candidate for a slot, best first (setCandidates pages it). */
  function setPool(state, deck, slot) { return slotPool(norm(state), deck, slot); }

  /** setCandidates(state, deck, slot, page) -> [cardId × ≤ 3]: three kept things for the slot;
   *  page 1 is the next three ("Three more"), wrapping round to the first page at the end. */
  function setCandidates(state, deck, slot, page) {
    const pool = slotPool(norm(state), deck, slot);
    if (!pool.length) return [];
    const pages = Math.ceil(pool.length / 3);
    const p = (((Math.floor(Number(page)) || 0) % pages) + pages) % pages;
    return pool.slice(p * 3, p * 3 + 3);
  }

  // ---------------------------------------------------------------- brought things and notes

  function cleanOwn(item, base, deck) {
    const o = assign(base);
    if (item.kind != null || !base.kind) o.kind = OWN_KINDS.indexOf(item.kind) >= 0 ? item.kind : (base.kind || 'image');
    if (item.name != null || base.name == null) o.name = typeof item.name === 'string' ? item.name.replace(/\s+/g, ' ').trim().slice(0, MAX_OWN_NAME) : (base.name || '');
    if (item.source != null || !base.source) o.source = typeof item.source === 'string' && item.source.trim() ? item.source.trim().slice(0, 40) : (base.source || 'Somewhere else');
    if (item.colours != null || !base.colours) o.colours = (Array.isArray(item.colours) ? item.colours : []).map(normHex).filter(Boolean).slice(0, 3);
    if (item.crop != null || base.crop === undefined) {
      o.crop = Array.isArray(item.crop) && item.crop.length === 4 && item.crop.every(isNum) ? item.crop.map((x) => round(clamp(x, 0, 1), 4)) : null;
    }
    if (item.texture != null || base.texture === undefined) o.texture = isNum(item.texture) ? round(clamp(item.texture, 0, 1), 3) : null;
    for (const k of ['w', 'h']) if (item[k] != null || base[k] === undefined) o[k] = isNum(item[k]) && item[k] > 0 ? Math.round(item[k]) : null;
    if (typeof item.imgFrom === 'string') o.imgFrom = item.imgFrom;
    defineOwn(o, item, deck);
    return o;
  }

  // The deck's own words for a definition: its cards' categories and eras, and its genes (null without a deck).
  const deckWords = new WeakMap();
  function wordsOfDeck(deck) {
    if (!deck || typeof deck !== 'object') return null;
    let w = deckWords.get(deck);
    if (!w) {
      const cats = new Set(), eras = new Set();
      for (const c of deck.cards || []) {
        if (c && typeof c.category === 'string' && c.category) cats.add(c.category);
        if (c && ERAS.indexOf(c.era) >= 0) eras.add(c.era);
      }
      w = { cats, eras, genes: deck.genes && typeof deck.genes === 'object' ? deck.genes : {} };
      deckWords.set(deck, w);
    }
    return w;
  }

  // Applies the definition fields an item carries to o (a brought thing being made or updated).
  // A field the item does not mention is left as it is; null or '' (or [] or false) clears it; a value
  // of the wrong kind is ignored. Text is one line and cut to its limit (as a name is); with a deck,
  // category, era and genes must be the deck's own.
  function defineOwn(o, item, deck) {
    const words = wordsOfDeck(deck);
    const set = (k, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete o[k]; else o[k] = v; };
    const cleared = (v) => v === null || v === '' || v === false || (Array.isArray(v) && !v.length);
    for (const k of OWN_LINKS) {
      if (!hasOwn(item, k) || item[k] === undefined) continue;
      if (cleared(item[k])) set(k, null); else if (httpsAddr(item[k])) set(k, item[k]);
    }
    for (const k of OWN_TEXT) {
      if (!hasOwn(item, k) || item[k] === undefined) continue;
      if (cleared(item[k])) { set(k, null); continue; }
      const t = oneLine(item[k]).slice(0, OWN_LIMITS[k]).trim();
      if (t) set(k, t);
    }
    if (hasOwn(item, 'year') && item.year !== undefined) {
      const t = oneLine(item.year);
      if (cleared(item.year)) set('year', null); else if (t.length <= OWN_LIMITS.year && YEAR_TEXT.test(t)) set('year', t);
    }
    if (hasOwn(item, 'category') && item.category !== undefined) {
      const t = oneLine(item.category).slice(0, OWN_LIMITS.category);
      if (cleared(item.category)) set('category', null); else if (t && (!words || words.cats.has(t))) set('category', t);
    }
    if (hasOwn(item, 'era') && item.era !== undefined) {
      if (cleared(item.era)) set('era', null); else if (ERAS.indexOf(item.era) >= 0 && (!words || words.eras.has(item.era))) set('era', item.era);
    }
    if (hasOwn(item, 'genes') && item.genes !== undefined) {
      if (cleared(item.genes)) set('genes', null);
      else if (Array.isArray(item.genes)) {
        const gs = [];
        for (const g of item.genes.slice(0, 100)) {
          if (typeof g !== 'string' || g.length > OWN_LIMITS.gene || !GENE_SLUG.test(g) || gs.indexOf(g) >= 0) continue;
          if (words && !hasOwn(words.genes, g)) continue;
          gs.push(g);
        }
        set('genes', gs.slice(0, OWN_LIMITS.genes));
      }
    }
    if (hasOwn(item, 'materials') && item.materials !== undefined) {
      if (cleared(item.materials)) set('materials', null);
      else if (Array.isArray(item.materials)) {
        const ms = [];
        for (const m of item.materials.slice(0, 100)) {
          const t = oneLine(m).toLowerCase().slice(0, OWN_LIMITS.material).trim();
          if (t && ms.indexOf(t) < 0) ms.push(t);
        }
        set('materials', ms.slice(0, OWN_LIMITS.materials));
      }
    }
    if (hasOwn(item, 'coloursEstimated') && item.coloursEstimated !== undefined) set('coloursEstimated', item.coloursEstimated === true ? true : null);
    if (hasOwn(item, 'definedBy') && item.definedBy !== undefined) {
      if (cleared(item.definedBy)) set('definedBy', null); else if (DEFINED_BY.indexOf(item.definedBy) >= 0) set('definedBy', item.definedBy);
    }
  }

  /** checkOwnFields(o) -> '' when a brought thing's definition fields (all optional) have the right
   *  kinds and sizes, else one plain sentence saying which does not ("has a maker that is not one line
   *  of at most 120 characters"). For a state check such as the connector's put_state: it refuses,
   *  where bring() tidies. Fields: link, image, thumb (https, ≤2048), maker ≤120, date ≤40, year ≤10,
   *  medium ≤200, place ≤60, about ≤200 (one line each), category (≤60), era (one of ERAS), genes
   *  (≤12 gene slugs), materials (≤8 words, ≤40 each), coloursEstimated (boolean), definedBy
   *  ('page' | 'claude' | 'address' | 'person'). */
  function checkOwnFields(o) {
    if (!o || typeof o !== 'object') return 'is not an object';
    for (const k of OWN_LINKS) if (o[k] != null && !httpsAddr(o[k])) return 'has a ' + k + ' that is not an https address of at most ' + OWN_LIMITS.url + ' characters';
    for (const k of OWN_TEXT.concat(['category'])) {
      if (o[k] == null) continue;
      if (typeof o[k] !== 'string' || o[k].length > OWN_LIMITS[k] || /[\r\n]/.test(o[k])) return 'has a ' + k + ' that is not one line of at most ' + OWN_LIMITS[k] + ' characters';
    }
    if (o.year != null && !(typeof o.year === 'string' && o.year.length <= OWN_LIMITS.year)) return 'has a year that is not text of at most ' + OWN_LIMITS.year + ' characters';
    if (o.era != null && ERAS.indexOf(o.era) < 0) return 'has an era that is not one of the deck\'s eras';
    if (o.genes != null && !(Array.isArray(o.genes) && o.genes.length <= OWN_LIMITS.genes && o.genes.every((g) => typeof g === 'string' && g.length <= OWN_LIMITS.gene && GENE_SLUG.test(g)))) return 'has genes that are not at most ' + OWN_LIMITS.genes + ' gene names';
    if (o.materials != null && !(Array.isArray(o.materials) && o.materials.length <= OWN_LIMITS.materials && o.materials.every((m) => typeof m === 'string' && m.length <= OWN_LIMITS.material))) return 'has materials that are not at most ' + OWN_LIMITS.materials + ' short words';
    if (o.coloursEstimated != null && typeof o.coloursEstimated !== 'boolean') return 'has a coloursEstimated that is not true or false';
    if (o.definedBy != null && DEFINED_BY.indexOf(o.definedBy) < 0) return 'has a definedBy that is not page, claude, address or person';
    return '';
  }

  /** bring(state, {id, kind, name, source, colours, crop, texture, w, h, …definition}, now, deck?) -> State.
   *  Bringing an id that is already there updates its details (kind, name, source…).
   *  The definition (all optional; see defineOwn and checkOwnFields): link, image, thumb, maker, date,
   *  year, medium, place, about, category, era, genes, materials, coloursEstimated, definedBy. Only
   *  the fields given are kept (a thing brought without them looks as it always has); with `deck`,
   *  category, era and genes must be the deck's own words. */
  function bring(state, item, now, deck) {
    const st = norm(state);
    if (!item || typeof item !== 'object') return assign(st);
    const t = toSec(now);
    let id = isOwnId(item.id) ? item.id : null;
    if (!id) {
      id = 'y' + hash32(t + '|' + st.own.length + '|' + (item.name || '') + '|' + JSON.stringify(item.colours || [])).toString(36);
      while (st.own.some((o) => o && o.id === id)) id = 'y' + hash32(id).toString(36);
    }
    const existing = st.own.find((o) => o && o.id === id);
    if (existing) return assign(st, { own: st.own.map((o) => (o === existing ? cleanOwn(item, existing, deck) : o)) });
    const o = cleanOwn(item, { id }, deck);
    const ordered = { id, kind: o.kind, name: o.name, source: o.source, colours: o.colours, crop: o.crop, texture: o.texture,
      w: o.w, h: o.h, at: t, let: null, seenAt: null };
    if (o.imgFrom) ordered.imgFrom = o.imgFrom;
    for (const k of OWN_DEFINED) if (hasOwn(o, k)) ordered[k] = o[k];
    return assign(st, { own: st.own.concat([ordered]) });
  }

  /** removeOwn(state, id) -> State without the brought thing, its judgments, the notes about it and the pairings that name it. */
  function removeOwn(state, id) {
    const st = norm(state);
    if (!st.own.some((o) => o && o.id === id)) return assign(st);
    const own = st.own.filter((o) => !(o && o.id === id));
    const j = st.j.filter((e) => !(Array.isArray(e) && e[0] === id));
    const notes = st.notes.filter((n) => !(n && n.ref === id));
    const sets = st.sets.map((s) => {
      if (!SLOT_NAMES.some((k) => s[k] === id)) return s;
      const c = assign(s);
      for (const k of SLOT_NAMES) if (c[k] === id) c[k] = null;
      return c;
    });
    let five = st.five;
    if (five && five.ids.indexOf(id) >= 0) {
      const at = five.ids.indexOf(id);
      five = assign(five, { ids: five.ids.filter((x) => x !== id), i: at < five.i ? five.i - 1 : five.i });
    }
    const assoc = st.assoc.filter((e) => !(Array.isArray(e) && (e[0] === id || e[1] === id)));
    return assign(st, { own, j, notes, sets, five, assoc });
  }

  /** addNote(state, {q, text, ref}, now) -> State. q: turn | five | set | bring | free; ref: a card id,
   *  a brought thing's id, "set:<at>" for a pinned set, or null. Empty text changes nothing. */
  function addNote(state, note, now) {
    const st = norm(state);
    const text = note && typeof note.text === 'string' ? note.text.trim().slice(0, MAX_NOTE) : '';
    if (!text) return assign(st);
    const q = NOTE_QS.indexOf(note.q) >= 0 ? note.q : 'free';
    const ref = typeof note.ref === 'string' && note.ref ? note.ref : null;
    return assign(st, { notes: st.notes.concat([{ at: toSec(now), q, ref, text }]) });
  }

  /** removeNote(state, at) -> State without one note: `at` is its index in state.notes, or its `at`
   *  timestamp in seconds (the latest note with that time). */
  function removeNote(state, at) {
    const st = norm(state);
    let i = -1;
    if (Number.isInteger(at) && at >= 0 && at < st.notes.length && at < 1e6) i = at;
    else if (isNum(at)) for (let k = st.notes.length - 1; k >= 0; k--) if (st.notes[k] && st.notes[k].at === at) { i = k; break; }
    return assign(st, { notes: i < 0 ? st.notes : st.notes.filter((_, k) => k !== i) });
  }

  /** markSeen(state, key) -> State with seen[key] = 1 ("intro", "seed" = seed taken, "about"…);
   *  "path:<milestone>" records that milestone as announced (seen.path). */
  function markSeen(state, key) {
    const st = norm(state);
    if (typeof key !== 'string' || !key) return assign(st);
    if (key.indexOf('path:') === 0) {
      const k = key.slice(5);
      const path = st.seen.path.indexOf(k) >= 0 ? st.seen.path : st.seen.path.concat([k]);
      return assign(st, { seen: assign(st.seen, { path }) });
    }
    if (key === 'path') return assign(st);
    return assign(st, { seen: assign(st.seen, { [key]: 1 }) });
  }

  // ---------------------------------------------------------------- your hub

  // A timestamp for state.hub: true = now; a number = unix seconds (a millisecond timestamp, anything
  // past 1e11, is taken as milliseconds); anything else clears it.
  function hubStamp(v, now) {
    if (v === true) return toSec(now);
    if (!isNum(v) || v < 0) return null;
    return v > 1e11 ? Math.floor(v / 1000) : Math.floor(v);
  }

  /** setHub(state, patch, now) -> State with state.hub = {user, name, private, mode, madeAt, savedAt, savedCode}
   *  updated from the fields the patch carries (undefined = unchanged, null or '' = cleared):
   *    user        GitHub username: trimmed, a leading "@" dropped, ≤ 39 characters (check it first
   *                with FiveSHub.rules.user; the engine only tidies it)
   *    name        the hub's name: trimmed, ≤ 100 characters (check it with FiveSHub.rules.repo)
   *    private     boolean
   *    mode        "links" (the artifact's bridge, the default) or "api" (the standalone app); others ignored
   *    madeAt      true = now, or unix seconds (ms accepted), or null
   *    savedAt     the same; setting it also records savedCode = seedCode(state) unless the patch names one
   *    savedCode   the seed code that was saved
   *  state.hub is absent until the first setHub; nothing else in the state changes. The hub never goes
   *  into exportSeed (no account details in a seed). */
  function setHub(state, patch, now) {
    const st = norm(state);
    const p = patch && typeof patch === 'object' ? patch : {};
    const old = st.hub && typeof st.hub === 'object' ? st.hub : {};
    const h = assign({ user: null, name: null, private: false, mode: 'links', madeAt: null, savedAt: null, savedCode: null }, old);
    if (p.user !== undefined) h.user = typeof p.user === 'string' ? p.user.trim().replace(/^@+/, '').trim().slice(0, MAX_HUB_USER) || null : null;
    if (p.name !== undefined) h.name = typeof p.name === 'string' ? p.name.trim().slice(0, MAX_HUB_NAME) || null : null;
    if (p.private !== undefined) h.private = !!p.private;
    if (p.mode !== undefined && HUB_MODES.indexOf(p.mode) >= 0) h.mode = p.mode;
    if (p.madeAt !== undefined) h.madeAt = hubStamp(p.madeAt, now);
    if (p.savedAt !== undefined) {
      h.savedAt = hubStamp(p.savedAt, now);
      if (p.savedCode === undefined) h.savedCode = h.savedAt == null ? null : seedCode(st);
    }
    if (p.savedCode !== undefined) h.savedCode = typeof p.savedCode === 'string' && p.savedCode.trim() ? p.savedCode.trim().slice(0, 40) : null;
    return assign(st, { hub: h });
  }

  // ---------------------------------------------------------------- profile

  function median(xs) {
    if (!xs.length) return 0;
    const a = xs.slice().sort((x, y) => x - y);
    const h = Math.floor(a.length / 2);
    return a.length % 2 ? a[h] : Math.round((a[h - 1] + a[h]) / 2);
  }

  function lastActivityMs(st) {
    let t = 0;
    for (const e of st.j) if (Array.isArray(e) && isNum(e[3])) t = Math.max(t, e[3]);
    for (const o of st.own) if (o && isNum(o.at)) t = Math.max(t, o.at, isNum(o.seenAt) ? o.seenAt : 0);
    for (const n of st.notes) if (n && isNum(n.at)) t = Math.max(t, n.at);
    for (const s of st.sets) if (s && isNum(s.at)) t = Math.max(t, s.at);
    return t * 1000;
  }

  function featureEntry(key, c, rate, deck) {
    return { key, label: featureLabel(key, deck), kept: c.k, n: c.n, lift: round(c.k / c.n - rate, 2) };
  }

  // Top features of a run of judgments, by how much more often they were kept than the run overall.
  function topOf(obs, deck, howMany) {
    if (!obs.length) return [];
    const f = {};
    let k = 0;
    for (const ob of obs) {
      if (ob.kept) k++;
      for (const key in featuresOf(ob.card)) {
        const c = f[key] || (f[key] = { k: 0, n: 0 });
        c.n++;
        if (ob.kept) c.k++;
      }
    }
    const rate = k / obs.length;
    return Object.keys(f).filter((key) => f[key].n >= 2 && f[key].k >= 2 && !/^(place|era|kind|cat):/.test(key))
      .map((key) => featureEntry(key, f[key], rate, deck))
      .filter((e) => e.lift > 0)
      .sort((a, b) => b.lift - a.lift || b.kept - a.kept || cmpStr(a.key, b.key))
      .slice(0, howMany);
  }

  function warmth(fs) {
    let w = 0, c = 0;
    for (const h of WARM_HUES) w += fs['hue:' + h] || 0;
    for (const h of COOL_HUES) c += fs['hue:' + h] || 0;
    if (w >= 0.4 && w > c) return 'warm';
    if (c >= 0.4 && c > w) return 'cool';
    return null;
  }

  /** profile(state, deck, now?) -> Profile (SPEC.md "Profile"). `now` sets streak/todayDone; without it
   *  they are taken at the state's latest activity. */
  function profile(state, deck, now) {
    const st = norm(state);
    const idx = indexOf(deck);
    const nowMs = isNum(now) ? now : lastActivityMs(st);
    const obs = observations(st, deck, null, null);
    const m = buildModel(st, deck, null, null);
    const judged = m.n, kept = m.k, passed = judged - kept;
    const keepRate = judged ? round(kept / judged, 2) : 0;
    const rate = judged ? kept / judged : 0;

    const times = st.j.filter((e) => Array.isArray(e) && isNum(e[2]) && e[2] > 0).map((e) => e[2]);
    const medianMs = median(times);
    const speed = medianMs < 2000 ? 'gut' : medianMs < 4000 ? 'considered' : 'slow';

    // Turns, newest first, each explained by replaying the model as it stood just before.
    const turns = [];
    st.j.forEach((e, i) => {
      if (!Array.isArray(e) || !e[4] || isOwnId(e[0])) return;
      const c = idx.get(e[0]);
      const because = c ? turnBecause(predictRaw(buildModel(st, deck, i, e[3]), c), e[4], deck) : [];
      turns.push({ card: e[0], dir: e[4], at: e[3], because: because.map((b) => ({ key: b.key, label: b.label, kept: b.kept, n: b.n })) });
    });
    turns.reverse();

    const groups = {};
    for (const g of GROUPS) groups[g] = [];
    const all = [];
    for (const key of Object.keys(m.f)) {
      const e = featureEntry(key, m.f[key], rate, deck);
      groups[groupOf(key, m.genes)].push(e);
      all.push(e);
    }
    for (const g of GROUPS) groups[g].sort((a, b) => b.kept - a.kept || b.lift - a.lift || cmpStr(a.key, b.key));
    const positive = all.filter((e) => e.n >= 3 && e.lift >= 0.05)
      .sort((a, b) => b.lift - a.lift || b.n - a.n || cmpStr(a.key, b.key)).slice(0, 10);
    const negative = all.filter((e) => e.n >= 3 && e.lift <= -0.05)
      .sort((a, b) => a.lift - b.lift || b.n - a.n || cmpStr(a.key, b.key)).slice(0, 10);

    const things = keptThings(st, deck);
    const keptByKind = {};
    for (const k of KINDS) keptByKind[k] = [];
    for (const x of things) if (keptByKind[x.kind]) keptByKind[x.kind].push(x.id);

    const keptSet = new Set(), passedSet = new Set();
    for (const x of things) for (const h of x.card.colours || []) { const n = normHex(h); if (n) keptSet.add(n); }
    for (const e of latestJudgments(st, deck)) {
      if (e[1] === 1 || e[1] === true) continue;
      for (const h of idx.get(e[0]).colours || []) { const n = normHex(h); if (n) passedSet.add(n); }
    }
    for (const o of st.own) if (o && o.let != null) for (const h of o.colours || []) { const n = normHex(h); if (n) passedSet.add(n); }

    const deckObs = obs.filter((o) => !o.own);
    let drift = null;
    if (deckObs.length >= 30) {
      const third = Math.floor(deckObs.length / 3);
      drift = { then: topOf(deckObs.slice(0, third), deck, 3), now: topOf(deckObs.slice(deckObs.length - third), deck, 3) };
    }

    const lean = { warm: { kept: 0, n: 0 }, cool: { kept: 0, n: 0 }, light: { kept: 0, n: 0 }, dark: { kept: 0, n: 0 } };
    for (const ob of obs) {
      const fs = featuresOf(ob.card);
      const bucket = [warmth(fs), fs['value:light'] ? 'light' : fs['value:dark'] ? 'dark' : null];
      for (const b of bucket) if (b) { lean[b].n++; if (ob.kept) lean[b].kept++; }
    }

    const bySource = {};
    for (const o of st.own) if (o && o.let == null) bySource[o.source || 'Somewhere else'] = (bySource[o.source || 'Somewhere else'] || 0) + 1;
    const sources = [];
    for (const k of Object.keys(DECK_SOURCES)) {
      const n = things.filter((x) => !x.own && deckSource(x.card) === DECK_SOURCES[k]).length;
      if (n) sources.push({ source: DECK_SOURCES[k].sources, n });
    }
    Object.keys(bySource).sort((a, b) => bySource[b] - bySource[a] || cmpStr(a, b)).forEach((s) => sources.push({ source: s, n: bySource[s] }));

    return {
      judged, kept, passed, keepRate, medianMs, speed, turns, groups, positive, negative,
      keptColours: sortColours(Array.from(keptSet)),
      passedColours: sortColours(Array.from(passedSet)),
      keptByKind, drift,
      streak: streak(st, nowMs), todayDone: st.days.indexOf(dayOf(nowMs)) >= 0,
      brought: st.own.length, letGo: st.own.filter((o) => o && o.let != null).length,
      defined: st.own.filter((o) => o && DEFINED_BY.indexOf(o.definedBy) >= 0).length,
      sources, notes: st.notes.length, lean,
    };
  }

  // ---------------------------------------------------------------- philosophy

  const fmtSec = (ms) => (Math.round(ms / 100) / 10).toFixed(1);

  // Process materials are things in themselves: "photographs", not "works in photograph".
  const MAT_NOUN = { photograph: 'photographs', screenprint: 'screenprints', lithograph: 'lithographs', etching: 'etchings', woodcut: 'woodcuts' };

  // A feature as a plural noun phrase for sentences: "Geometric works", "blue colours", "works in wood".
  function prose(key, deck) {
    const [type, v] = splitKey(key);
    const label = featureLabel(key, deck);
    switch (type) {
      case 'gene': case 'cat': return label + ' works';
      case 'mat': return MAT_NOUN[v] || 'works in ' + label.toLowerCase();
      case 'hue': case 'value': case 'chroma': return label.toLowerCase() + ' colours';
      case 'chord': return v + ' palettes';
      case 'texture': return v + ' textures';
      case 'place': case 'era': return 'works from ' + (/^Before/.test(label) ? 'b' + label.slice(1) : label);
      case 'kind': return label + ' cards';
      default: return label;
    }
  }
  const listWords = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

  /** philosophy(profile, deck) -> 4–6 plain second-person lines, each true of the profile
   *  (or one line saying there is too little to go on yet). */
  function philosophy(prof, deck) {
    const P = prof || {};
    const judged = P.judged || 0, kept = P.kept || 0, brought = P.brought || 0, letGo = P.letGo || 0;
    const sorted = judged - brought;
    if (sorted < 10) {
      if (sorted <= 0) return ["You haven't judged anything yet. Sort a few fives and this will fill in."];
      return ['You have judged ' + plural(sorted, 'thing') + ' so far, too few to say how you go about things. Sort a few more fives and this will fill in.'];
    }
    const groups = P.groups || {};
    const lines = [];

    // Keep rate and speed.
    lines.push("You've kept " + kept + ' of the ' + judged + " things you've judged, and you usually decide in " + fmtSec(P.medianMs || 0) + ' seconds.');

    // Warm or cool, light or dark.
    const lean = P.lean || {};
    const parts = [];
    const cmp = (a, b, aw, bw, unit) => {
      if (!a || !b || a.n < 3 || b.n < 3) return null;
      const ra = a.kept / a.n, rb = b.kept / b.n;
      const counts = ' (' + a.kept + ' of ' + a.n + ' against ' + b.kept + ' of ' + b.n + ')';
      if (ra - rb >= 0.2) return aw + ' ' + unit + ' more than ' + bw + ' ones' + counts;
      if (rb - ra >= 0.2) return bw + ' ' + unit + ' more than ' + aw + ' ones (' + b.kept + ' of ' + b.n + ' against ' + a.kept + ' of ' + a.n + ')';
      return null;
    };
    const wc = cmp(lean.warm, lean.cool, 'warm', 'cool', 'colours');
    const ld = cmp(lean.light, lean.dark, 'light', 'dark', 'colours');
    if (wc) parts.push(wc);
    if (ld) parts.push(wc ? ld.replace(' colours more than', ' more than').replace(/ ones \(.*\)$/, '') : ld);
    const colourLine = parts.length ? 'You keep ' + parts.join(', and ') + '.' : null;

    // What you keep most: a quality and the materials.
    const best = (g, minKept) => (groups[g] || []).filter((e) => e.n >= 3 && e.lift >= 0.1 && e.kept >= minKept)
      .sort((a, b) => b.lift - a.lift || b.kept - a.kept || cmpStr(a.key, b.key));
    const q = best('Qualities', 2)[0];
    const mats = best('Materials', 2).slice(0, 2).map((e) => e.label.toLowerCase());
    let keepLine = null;
    if (q && mats.length) keepLine = 'Of the qualities, you keep ' + q.label + ' works most (' + q.kept + ' of ' + q.n + '); of the materials, ' + listWords(mats) + '.';
    else if (q) keepLine = 'Of the qualities, you keep ' + q.label + ' works most: ' + q.kept + ' of ' + q.n + '.';
    else if (mats.length) keepLine = 'Of the materials, you keep ' + listWords(mats) + ' most.';

    // The negative space.
    const aesthetic = (e) => !/^(place|era|kind|cat):/.test(e.key);
    const negAll = P.negative || [];
    const neg = (negAll.some(aesthetic) ? negAll.filter(aesthetic) : negAll).slice(0, 2);
    let negLine = null;
    if (neg.length) {
      negLine = 'What you keep least: ' + prose(neg[0].key, deck) + ' (' + neg[0].kept + ' of ' + neg[0].n + ')' +
        (neg[1] ? ', then ' + prose(neg[1].key, deck) + ' (' + neg[1].kept + ' of ' + neg[1].n + ')' : '') + '.';
    }

    // Turns.
    const turns = P.turns || [];
    let turnLine;
    if (!turns.length) turnLine = "You haven't gone against your own pattern yet.";
    else {
      const t = turns[0], b = t.because && t.because[0];
      turnLine = "You've gone against your own pattern " + (turns.length === 1 ? 'once' : turns.length + ' times') + '.';
      if (b) {
        turnLine += ' The latest: you ' + (t.dir > 0 ? 'kept' : 'passed') + ' one of the ' + prose(b.key, deck) +
          ', after keeping ' + b.kept + ' of ' + b.n + ' before.';
      }
    }

    // Drift.
    let driftLine = null;
    const d = P.drift;
    if (d && d.then && d.then[0] && d.now && d.now[0]) {
      driftLine = d.then[0].key === d.now[0].key
        ? capital(prose(d.now[0].key, deck)) + ' have led what you keep from the start.'
        : 'At first you kept ' + prose(d.then[0].key, deck) + ' most; lately, ' + prose(d.now[0].key, deck) + '.';
    }

    // Brought in and let go.
    const broughtLine = brought
      ? "You've brought in " + plural(brought, 'thing') + ' of your own' + (letGo ? ' and let ' + letGo + ' go.' : brought === 1 ? ' and kept it.' : ' and kept them all.')
      : "Everything you've judged so far came from the artist's database; you haven't brought in anything of your own.";

    for (const l of [colourLine, keepLine, negLine, turnLine]) if (l) lines.push(l);
    for (const l of [broughtLine, driftLine]) if (l && lines.length < 6) lines.push(l);
    if (lines.length < 4) { // rate, turns and brought are always there, so this makes four
      lines.push(P.speed === 'gut' ? 'At least half your judgments take under two seconds.'
        : P.speed === 'slow' ? 'At least half your judgments take four seconds or more.'
          : 'At least half your judgments take two seconds or more.');
    }
    return lines.slice(0, 6);
  }

  // ---------------------------------------------------------------- seed

  /** seedCode(state) -> "5S-XXXX-XXXX": the same judgments (and sets and brought things) give the same code. */
  function seedCode(state) {
    const st = norm(state);
    const parts = [];
    for (const e of st.j) if (Array.isArray(e) && !isOwnId(e[0])) parts.push(e[0] + (e[1] ? '+' : '-'));
    parts.push('|');
    for (const s of st.sets) parts.push(SLOT_NAMES.map((k) => (isOwnId(s[k]) ? 'own' : s[k] || '')).join(','));
    parts.push('|');
    for (const o of st.own) if (o) parts.push(o.kind + ':' + (o.colours || []).join(',') + (o.let != null ? 'x' : ''));
    const hex = hash32(parts.join(' ')).toString(16).toUpperCase().padStart(8, '0');
    return '5S-' + hex.slice(0, 4) + '-' + hex.slice(4);
  }

  // Parameters that only say who shared it or how it was found, or could carry something of the
  // person's (an email, a token, a session): never in a seed. The same lists as FiveSLinks.cleanUrl.
  const SEED_DROP = /^(?:utm_[a-z0-9_]*|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|msclkid|yclid|twclid|ttclid|li_fat_id|mc_cid|mc_eid|_ga|_gl|_hsenc|_hsmi|igshid|igsh|si|ref|ref_|ref_src|ref_url|mibextid|spm|scm|share_id|share_source|feature|pp|_r|_t|click_key|click_sum|_trkparms|_trksid|smid|cid|e?mail|email_?address|e|token|access_?token|id_?token|refresh_?token|auth|auth_?key|auth_?token|key|api_?key|session|session_?id|sid|password|passwd|pwd|pass|code|state|signature|sig|secret|login|user|username|user_?id|uid|account|phone|tel|first_?name|last_?name|invite|invite_?code)$/i;

  // A brought thing's link as a seed may carry it: https, a public host, no user name, password or
  // port, no fragment, none of SEED_DROP's parameters, nothing with an "@" in it; else null.
  function publicLink(x) {
    const a = httpsAddr(x);
    if (!a || typeof URL !== 'function') return null;
    let u;
    try { u = new URL(a); } catch (e) { return null; }
    if (u.protocol !== 'https:' || !/\./.test(u.hostname) || /^[0-9.]+$|^\[/.test(u.hostname) || /(?:^|\.)(?:localhost|local|internal)$/i.test(u.hostname)) return null;
    const keep = [];
    u.searchParams.forEach((v, k) => { if (!SEED_DROP.test(k) && !/@|%40/.test(v)) keep.push([k, v]); });
    u.search = '';
    for (const [k, v] of keep) u.searchParams.append(k, v);
    u.username = ''; u.password = ''; u.port = ''; u.hash = '';
    const out = u.toString();
    return out.length <= OWN_LIMITS.url && out.indexOf('@') < 0 ? out : null;
  }

  // A brought thing in a seed: its name, kind, source, colours and whether it was let go, as always;
  // then, once it is defined, what it is (maker, date, medium, place, about, the deck's words for it)
  // and the public address it came from. Never its picture or thumbnail (someone else's, or private),
  // its id or its connector id.
  function seedOwn(o, name) {
    const e = { name, kind: o.kind, source: o.source, colours: (o.colours || []).slice(), let: o.let != null };
    const d = ownDefinition(o);
    for (const k of ['maker', 'date', 'medium', 'place', 'about', 'category', 'era']) if (d[k]) e[k] = d[k];
    if (d.genes.length) e.genes = d.genes.slice();
    if (d.materials.length) e.materials = d.materials.slice();
    if (d.coloursEstimated && e.colours.length) e.coloursEstimated = true;
    const link = publicLink(o.link);
    if (link) e.link = link;
    return e;
  }

  /** exportSeed(state, deck, now) -> the 5s-seed JSON: works by their slug (Artsy's, or a bookmark's on
   *  The Architectural Authority), brought things by name; no card ids, no images, no account details
   *  (state.hub never goes in). Kept works also carry their public addresses: `image` (the deck's "cdn")
   *  and `url` (the work's own page). */
  function exportSeed(state, deck, now) {
    const st = norm(state);
    const idx = indexOf(deck);
    const P = profile(st, deck, now);
    const ownById = new Map(st.own.filter(Boolean).map((o) => [o.id, o]));
    const nameOf = (o) => (o.name && o.name.trim()) || 'Untitled';
    const refOf = (id) => {
      if (typeof id !== 'string') return null;
      if (ownById.has(id)) return nameOf(ownById.get(id));
      const c = idx.get(id);
      return c ? c.work || null : null;
    };
    const kept = [], passed = [], surfaces = [];
    for (const e of latestJudgments(st, deck)) {
      const c = idx.get(e[0]);
      if (e[1] === 1 || e[1] === true) {
        // image: the work's own image (deck "cdn": Artsy's CDN, or a bookmark's photo); url: its page. Both public.
        kept.push({ work: c.work, kind: c.kind, ms: e[2], image: c.cdn || null, url: c.url || null });
        if (c.kind === 'surface' && Array.isArray(c.crop)) surfaces.push({ work: c.work, crop: c.crop.slice() });
      } else passed.push({ work: c.work, kind: c.kind });
    }
    for (const o of st.own) if (o && o.let == null && Array.isArray(o.crop)) surfaces.push({ name: nameOf(o), crop: o.crop.slice() });
    const aboutOf = (ref) => {
      if (typeof ref !== 'string') return null;
      if (ref.indexOf('set:') === 0) {
        const s = st.sets.find((x) => String(x.at) === ref.slice(4));
        return s ? s.name || 'a set' : null;
      }
      return refOf(ref);
    };
    return {
      format: '5s-seed', version: 1, code: seedCode(st), made: dayOf(now),
      counts: { judged: P.judged, kept: P.kept, passed: P.passed, turns: P.turns.length },
      kept, passed,
      palette: { kept: P.keptColours.slice(), passed: P.passedColours.slice() },
      surfaces,
      leanings: { positive: P.positive.map((e) => [e.key, e.lift]), negative: P.negative.map((e) => [e.key, e.lift]) },
      turns: P.turns.map((t) => ({ work: refOf(t.card), dir: t.dir, because: t.because.map((b) => b.key) })),
      sets: st.sets.map((s) => {
        const o = { name: s.name || null };
        for (const k of SLOT_NAMES) o[k] = refOf(s[k]);
        return o;
      }),
      own: st.own.filter(Boolean).map((o) => seedOwn(o, nameOf(o))),
      notes: st.notes.filter(Boolean).map((n) => ({ q: n.q, text: n.text, about: aboutOf(n.ref), at: dayOf(n.at * 1000) })),
      speed: { medianMs: P.medianMs },
    };
  }

  // ---------------------------------------------------------------- the path

  /** path(state, deck, now) -> the twelve milestones, in order: {key, step, label, why, done, next, announced}:
   *  the eight of the month (unchanged), then the hub's four (github, hub, saved, opened: done when
   *  state.hub has a user, a madeAt, a savedAt, and seen "hub-opened" is marked).
   *  Exactly one is `next` (the first not done) until all are done. */
  function path(state, deck, now) {
    const st = norm(state);
    const kinds = new Set(keptThings(st, deck).map((x) => x.kind));
    const hub = st.hub && typeof st.hub === 'object' ? st.hub : {};
    const done = {
      github: !!hub.user,
      hub: !!hub.madeAt,
      saved: !!hub.savedAt,
      opened: !!st.seen['hub-opened'],
      sort: st.days.length > 0,
      bring: st.own.length > 0,
      kinds: KINDS.every((k) => kinds.has(k)),
      set: st.sets.some((s) => s && typeof s.name === 'string' && s.name.trim()),
      turn: st.j.some((e) => Array.isArray(e) && e[4]),
      note: st.notes.length > 0,
      seed: !!st.seen.seed,
      habit: longestRun(st.days) >= 5,
    };
    let nextGiven = false;
    return MILESTONES.concat(HUB_MILESTONES).map((m) => {
      const isNext = !done[m.key] && !nextGiven;
      if (isNext) nextGiven = true;
      return { key: m.key, step: m.step, label: m.label, why: m.why, done: done[m.key], next: isNext, announced: st.seen.path.indexOf(m.key) >= 0 };
    });
  }

  // ---------------------------------------------------------------- example taste

  // The example person: keeps warm, organic, handmade, earthy things; passes cool, hard-edged, glossy ones.
  const EX_LIKE = /biomorph|organic|curvilinear|hand|craft|natur|earth|rustic|folk|weav|textile|fib(er|re)|ceramic|potter|clay|botanic|flora|vernacular|texture/i;
  const EX_DISLIKE = /geometr|hard.?edge|minimal|grid|op art|optical|digital|futur|industrial|machine|gloss|pop art|neon|chrome|cyber|synthetic|plastic/i;
  const EX_EARTHY = ['wood', 'ceramic', 'porcelain', 'stone', 'marble', 'linen', 'textile', 'wool', 'silk', 'cotton', 'felt', 'leather',
    'paper', 'plaster', 'tempera', 'watercolour', 'charcoal', 'woodcut'];
  const EX_GLOSSY = ['steel', 'aluminium', 'glass', 'plastic', 'resin', 'neon', 'video'];

  function exampleTaste(c, deck, adjust) {
    const fs = featuresOf(c);
    let s = 0;
    for (const key in fs) {
      const w = fs[key];
      const [type, v] = splitKey(key);
      if (type === 'hue') {
        if (WARM_HUES.indexOf(v) >= 0) s += 1.2 * w;
        else if (COOL_HUES.indexOf(v) >= 0) s -= 1.2 * w;
      } else if (type === 'gene') {
        const g = deck && deck.genes && deck.genes[v];
        const words = v + ' ' + ((g && g.name) || '');
        if (EX_LIKE.test(words)) s += 0.8;
        else if (EX_DISLIKE.test(words)) s -= 0.8;
        else s += (prng('5s-example-gene|' + v)() - 0.5) * 0.8; // a settled opinion on everything else
      } else if (type === 'mat') {
        if (EX_EARTHY.indexOf(v) >= 0) s += 0.6;
        if (EX_GLOSSY.indexOf(v) >= 0) s -= 0.7;
      } else if (key === 'chroma:muted' || key === 'texture:coarse') s += 0.2;
      if (adjust[key]) s += adjust[key] * w;
    }
    return s;
  }

  /** exampleState(deck, now) -> a believable example taste: ~60 judgments over the 9 days before
   *  today, real turns found by judge(), 3 brought things (one let go), 4 notes, 2 named sets.
   *  Deterministic for (deck, day). Never saved. */
  function exampleState(deck, now) {
    const today = dayOf(now);
    const rng = prng('5s-example|' + today);
    const ymd = today.split('-').map(Number);
    const at = (back, minutes) => new Date(ymd[0], ymd[1] - 1, ymd[2] - back, 0, 0, 0, 0).getTime() + Math.round(minutes * 60000);
    const cards = (deck && deck.cards) || [];
    const adjust = {};
    const PLAN = [[9, 2], [8, 2], [7, 1], [4, 2], [3, 2], [2, 1], [1, 2]]; // [days before today, fives]
    const TURN_PLAN = { 3: [1, -1], 7: [1] }; // five number -> turns the person is ready to make from then on
    const pending = [];
    // A choosy person: in each kind, keeps a little over half of what the deck offers.
    const bar = {};
    for (const k of KINDS) {
      const scores = cards.filter((c) => c.kind === k).map((c) => exampleTaste(c, deck, {})).sort((a, b) => a - b);
      bar[k] = scores.length ? clamp(scores[Math.floor(scores.length * 0.45)], -0.5, 1) : 0;
    }

    // The three things this person brings in, each standing in with a deck image of its kind.
    const standIn = (kind, skip) => cards.filter((c) => c.kind === kind && skip.indexOf(c.id) < 0)
      .map((c) => ({ c, s: exampleTaste(c, deck, {}) }))
      .sort((a, b) => b.s - a.s || cmpStr(a.c.id, b.c.id))[0];
    const used = [];
    const OWN = [
      { id: 'yex1', kind: 'object', name: "Grandmother's bowl", source: 'Your photos', after: 0, texture: 0.42,
        note: "It was my grandmother's. I want a room that starts from it." },
      { id: 'yex2', kind: 'image', name: 'A plaster wall I pinned', source: 'Pinterest', after: 1, texture: 0.61 },
      { id: 'yex3', kind: 'space', name: 'Kitchen window, morning', source: 'Your photos', after: 4, texture: 0.35 },
    ].map((o) => {
      const pick = standIn(o.kind, used);
      if (pick) used.push(pick.c.id);
      return assign(o, { imgFrom: pick ? pick.c.id : null, card: pick ? pick.c : null });
    });
    const revisits = {};

    let st = assign(newState(), { seen: { intro: 1, path: [] } });
    let fiveNo = 0, firstTurnNoted = false, t = 0;
    PLAN.forEach(([back, fives], dayNo) => {
      t = at(back, rng() < 0.55 ? 440 + rng() * 80 : 1140 + rng() * 150);
      for (let f = 0; f < fives; f++) {
        if (TURN_PLAN[fiveNo]) pending.push(...TURN_PLAN[fiveNo]);
        st = startFive(st, deck, t);
        let id;
        while ((id = currentCard(st)) !== null) {
          let keep, ms;
          if (isOwnId(id)) {
            revisits[id] = (revisits[id] || 0) + 1;
            keep = !(id === 'yex2' && revisits[id] >= 2); // the pinned wall is let go on its second return
            ms = Math.round((1500 + 2500 * rng()) / 10) * 10;
          } else {
            const c = indexOf(deck).get(id);
            keep = exampleTaste(c, deck, adjust) + (rng() - 0.5) * 0.5 > bar[c.kind];
            const u = rng();
            ms = Math.round((u < 0.12 ? 600 + 400 * rng() : u < 0.86 ? 1000 + 2000 * rng() : 3000 + 3000 * rng()) / 10) * 10;
          }
          t += ms;
          let res = null;
          const want = keep ? -1 : 1;
          if (!isOwnId(id) && pending.indexOf(want) >= 0) {
            // A moment the person is ready to go against the pattern: it is a turn only if judge() says so.
            const tms = Math.round((3200 + 2400 * rng()) / 10) * 10;
            const tried = judge(st, deck, id, !keep, tms, t + tms - ms);
            if (tried.turn && tried.turn.dir === want) {
              res = tried;
              t += tms - ms;
              pending.splice(pending.indexOf(want), 1);
              // a turn shifts the person a little: the feature they went against weighs less from now on
              const b0 = tried.turn.because[0];
              if (b0) adjust[b0.key] = (adjust[b0.key] || 0) + (tried.turn.dir > 0 ? 0.5 : -0.4);
            }
          }
          if (!res) res = judge(st, deck, id, keep, ms, t);
          st = res.state;
          if (res.turn && !firstTurnNoted) {
            firstTurnNoted = true;
            const text = res.turn.dir > 0 ? 'I usually pass this kind of thing. This one I kept looking at.'
              : 'I usually keep this kind of thing. This time it felt like more of the same.';
            st = addNote(st, { q: 'turn', ref: id, text }, t + 25000);
            t += 25000;
          }
          t += 2500 + 2500 * rng();
        }
        if (fiveNo === 1) { st = addNote(st, { q: 'five', ref: null, text: 'Earthy' }, t + 8000); t += 8000; }
        fiveNo++;
        t += 40000 + 80000 * rng();
      }
      for (const o of OWN) {
        if (o.after !== dayNo) continue;
        t += 60000;
        st = bring(st, {
          id: o.id, kind: o.kind, name: o.name, source: o.source, imgFrom: o.imgFrom || undefined,
          colours: o.card ? o.card.colours : [], crop: [0.375, 0.3, 0.25, 0.25], texture: o.texture,
          w: (o.card && o.card.w) || 720, h: (o.card && o.card.h) || 540,
        }, t);
        if (o.note) { t += 30000; st = addNote(st, { q: 'bring', ref: o.id, text: o.note }, t); }
      }
      const SETS = { 4: { name: 'A room for slow mornings', choice: 0, first: true }, 6: { name: 'Somewhere to read in winter', choice: 1 } };
      const plan = SETS[dayNo];
      if (plan) {
        t += 90000;
        const spec = { name: plan.name };
        for (const slot of SLOT_NAMES) {
          const pool = slotPool(st, deck, slot);
          spec[slot] = slot === 'object' && plan.first && pool.indexOf('yex1') >= 0 ? 'yex1' : pool[plan.choice] || pool[0] || null;
        }
        st = pinSet(st, spec, t);
        if (plan.first) { t += 20000; st = addNote(st, { q: 'set', ref: 'set:' + toSec(t - 20000), text: spec.name }, t); }
      }
    });
    for (const m of path(st, deck, now)) if (m.done) st = markSeen(st, 'path:' + m.key);
    return st;
  }

  // ---------------------------------------------------------------- export

  const FiveS = Object.freeze({
    version: 1,
    ERAS, KINDS, SLOTS, SLOT_NAMES, OWN_KINDS, SOURCES, DECK_SOURCE, DECK_SOURCES, deckSource, NOTE_QS, GROUPS, HUES, MILESTONES,
    HUB_MILESTONES, HUB_MODES, setHub,
    DEFINED_BY, OWN_LIMITS, checkOwnFields,
    hexToHsl, normHex, colourName, chord, features, featureLabel, featureGroup,
    newState, migrate, setOpt, judge, undo, model, predict,
    nextFive, isRevisit, startFive, currentCard, fiveDone, fivePass, streak, dayOf,
    profile, philosophy,
    setCandidates, setPool, pinSet, unpinSet,
    seedCode, prng, exportSeed, exampleState,
    card, bring, removeOwn, addNote, removeNote, markSeen, path,
  });

  if (typeof module === 'object' && module.exports) module.exports = FiveS;
  else root.FiveS = FiveS;
})(typeof self !== 'undefined' ? self : globalThis);

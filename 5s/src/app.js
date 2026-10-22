/* 5s app: the UI (SPEC.md "The tabs", "Persistence (app.js)", "Accessibility").
 *
 * Reads the deck, keeps one State (engine.js) and draws the five views around it:
 * Sort -> Split -> Set -> See -> Seed, plus the sheets (Path, About, Bring in your own, notes,
 * details, the Set chooser, Your hub). The engine is pure; everything with a clock, the DOM, storage or a
 * capability lives here. Plain script, no modules, no libraries.
 */
(function () {
  'use strict';

  const F = window.FiveS;
  const B = window.FiveSBring || null;
  const G = window.FiveSGround || null;
  const HUB = window.FiveSHub || null;          // Your hub: GitHub's naming rules and filled-in links
  const HUBPAGE = window.FiveSHubPage || null;  // Your hub: the hub page built from the seed
  const CX = window.FiveSConnect || null;       // Connect your apps: data files read here, the 5s connector
  const LK = window.FiveSLinks || null;         // Links out (Where it lives) and in (Paste a link)
  const doc = document;
  const $ = (sel, root) => (root || doc).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || doc).querySelectorAll(sel));

  const VIEWS = ['sort', 'split', 'set', 'see', 'seed'];
  const TITLES = { sort: 'Sort', split: 'Split', set: 'Set', see: 'See', seed: 'Seed' };
  const KIND_LABEL = { image: 'Image', object: 'Object', space: 'Space', surface: 'Surface', colour: 'Colour' };
  const SLOT_LABEL = { wall: 'Wall', window: 'Window', picture: 'Picture', floor: 'Floor', object: 'Object' };
  const SLOTS = ['wall', 'window', 'picture', 'floor', 'object'];
  const OWN_KINDS = (F && F.OWN_KINDS) || ['image', 'object', 'space'];
  const SOURCES = (F && F.SOURCES) || ['Your photos', 'Pinterest', 'Instagram', 'Artsy', 'Are.na', 'The web', 'Somewhere else'];
  const NOTE_Q = {
    turn: 'You went against your own pattern. What changed?',
    five: 'One word for this five',
    set: 'What is this set for?',
    bring: 'Why did you save it?',
    free: 'What are you looking for?',
  };
  const LS_KEY = '5s.state.v1';
  const STRIP_MS = 2500;
  const STRIP_TURN_MS = 9000;
  const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const mqDark = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() {} };
  const reduced = () => !!mqReduce.matches;
  const now = () => Date.now();

  // ---------------------------------------------------------------- small helpers

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const listWords = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  const uniq = (xs) => Array.from(new Set(xs));
  const secs = (ms) => (Math.round((ms || 0) / 100) / 10).toFixed(1);
  const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
  // WCAG relative luminance of a hex colour (0 black .. 1 white).
  function lum(h) {
    if (!isHex(h)) return 0.5;
    const f = (i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
  }
  const icon = (id, cls) => '<svg class="' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#i-' + id + '"/></svg>';

  function fmtDate(sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000);
    const opts = { day: 'numeric', month: 'short' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    try { return d.toLocaleDateString(undefined, opts); } catch (e) { return F.dayOf(sec * 1000); }
  }

  function lsGet() { try { return window.localStorage.getItem(LS_KEY); } catch (e) { return null; } }
  function lsSet(v) { try { window.localStorage.setItem(LS_KEY, v); } catch (e) { /* storage blocked: the visit still works */ } }
  function parseState(json) {
    if (!json) return null;
    try { const o = JSON.parse(json); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; }
  }
  const hasContent = (st) => !!(st && (st.j.length || st.own.length || st.notes.length || st.sets.length));

  // ---------------------------------------------------------------- app state

  let deck = null;
  let atlasRows = 1;
  let S = F.migrate(parseState(lsGet()) || F.newState());
  let EX = null;
  let exDay = null;
  let example = false;
  let view = 'sort';

  const ui = {
    shownAt: 0, topId: null, counterKey: '', strip: null, stripTimer: 0, stripHold: false,
    room: null, roomKey: null, chooserPage: {}, chooserSlot: null,
    bring: { items: [], adding: false, msg: '' },
    splitAll: {}, swatch: null, confirm: null,
    seedKey: null, seedGrown: false, seedRO: null, seedT: 0, seedSave: '', copyOpen: false,
    sample: null, downloads: null, claude: { busy: false, text: '', status: '', hidden: false, ctl: null },
    sheet: null, sheetRender: null, sheetTitle: '', opener: null, noteCtx: null, detailId: null, removeAsk: false, sheetMsg: '',
    detailBack: null, whereLinks: [],
    deckError: '', logoOk: null, drag: null,
  };

  const profCache = new WeakMap();
  function prof(st) {
    let p = profCache.get(st);
    if (!p) { p = F.profile(st, deck, now()); profCache.set(st, p); }
    return p;
  }

  const active = () => (example && view !== 'sort' && EX ? EX : S);
  const readOnly = () => example && view !== 'sort';
  const cardOf = (id, st) => (deck && id ? F.card(st || active(), deck, id) : null);
  const deckCard = (id) => (deck && id ? F.card(F.newState(), deck, id) : null);

  // ---------------------------------------------------------------- the live region and the footer

  const live = $('#live');
  let sayT = 0;
  let sayBuf = [];
  function say(msg) {
    if (!msg) return;
    sayBuf.push(msg);
    clearTimeout(sayT);
    sayT = setTimeout(() => {
      const text = sayBuf.join(' ');
      sayBuf = [];
      live.textContent = '';
      setTimeout(() => { live.textContent = text; }, 40);
    }, 80);
  }

  const footSaid = new Set();
  function footer(msg) {
    if (!msg || footSaid.has(msg)) return;
    footSaid.add(msg);
    const el = $('#savenote');
    el.textContent = Array.from(footSaid).join(' ');
    el.hidden = false;
  }

  // ---------------------------------------------------------------- persistence (SPEC "Persistence (app.js)")

  // ready: the store has answered once (a definitive snapshot). Nothing is written before that, so
  // judgments made while it loads can't overwrite a state saved on another device.
  const P = { ref: null, ready: false, unsub: null, localOnly: false, written: null, timer: 0, pending: false, inflight: false, again: false, retried: false };

  // JSON with object keys sorted: the store may hand a document back with its keys in another order.
  function canon(v) {
    return JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)
      ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  }

  function persist() {
    lsSet(JSON.stringify(S));
    if (P.ref && P.ready && !P.localOnly && canon(S) !== P.written) {
      clearTimeout(P.timer);
      P.pending = true;
      P.timer = setTimeout(() => { P.pending = false; flush(); }, 800);
    }
  }

  async function flush() {
    if (!P.ref || !P.ready || P.localOnly) return;
    if (P.inflight) { P.again = true; return; }
    const json = JSON.stringify(S);
    const key = canon(S);
    if (key === P.written) return;
    P.inflight = true;
    try {
      await P.ref.set(JSON.parse(json));
      P.written = key;
      P.retried = false;
    } catch (e) {
      const code = e && e.code;
      const transient = !code || code === 'unavailable' || code === 'resource_exhausted' ||
        ['invalid_argument', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'transform_error'].indexOf(code) < 0;
      P.inflight = false;
      if (transient && !P.retried) { P.retried = true; setTimeout(flush, 1200); return; }
      goLocal();
      return;
    }
    P.inflight = false;
    if (P.again) { P.again = false; flush(); }
  }

  function goLocal() {
    P.localOnly = true;
    clearTimeout(P.timer);
    if (P.unsub) { try { P.unsub(); } catch (e) { /* already gone */ } P.unsub = null; }
    footer('Saved in this browser only.');
  }

  function connectDb(db, uid) {
    let ref;
    try { ref = db.doc('data/users/' + uid + '/state'); } catch (e) { return; }
    P.ref = ref;
    let first = true;
    try {
      P.unsub = ref.onSnapshot((snap) => {
        if (P.localOnly) return;
        if (first) {
          // A first delivery from cache isn't the server's answer yet: "absent" there may not be.
          if (!snap.exists && snap.metadata && snap.metadata.fromCache) return;
          first = false;
          P.ready = true;
          if (!snap.exists) { if (hasContent(S)) flush(); return; }
          let remote = null;
          try { remote = F.migrate(JSON.parse(JSON.stringify(snap.data()))); } catch (e) { remote = null; }
          if (!remote) return;
          // Judgments made here before the store answered, on top of what it holds: keep them.
          const prefix = remote.j.length <= S.j.length && JSON.stringify(S.j.slice(0, remote.j.length)) === JSON.stringify(remote.j);
          if (prefix && S.j.length > remote.j.length) { P.written = canon(remote); flush(); return; }
          adopt(remote);
          return;
        }
        if (!snap.exists || (snap.metadata && snap.metadata.hasPendingWrites)) return;
        if (P.inflight || P.pending) return;
        let remote = null;
        try { remote = F.migrate(JSON.parse(JSON.stringify(snap.data()))); } catch (e) { return; }
        adopt(remote);
      }, () => { goLocal(); });
    } catch (e) { goLocal(); }
  }

  function adopt(remote) {
    const key = canon(remote);
    if (key === canon(S)) { P.written = key; return; }
    S = remote;
    P.written = key;
    lsSet(JSON.stringify(remote));
    ui.room = null;
    ui.topId = null;
    if (deck) { ensureFive(); checkPath(); renderView(); updateChrome(); }
  }

  // ---------------------------------------------------------------- brought-in images

  let imgStore = null;
  try { imgStore = B ? B.store({ db: null, uid: null }) : null; } catch (e) { imgStore = null; }
  const ownImgs = new Map();
  const ownLoading = new Map();

  function watchStore(st) {
    if (!st || !st.onKind) return;
    st.onKind((k) => {
      if (k === 'visit') footer('Images you bring in last for this visit only.');
      else if (k === 'device') footer('Images are saved in this browser only.');
      if (ui.sheet === 'bring') refreshSheet();
    });
  }
  watchStore(imgStore);

  function ownGet(id) {
    if (ownImgs.has(id)) return ownImgs.get(id);
    if (!imgStore) { ownImgs.set(id, null); return null; }
    if (!ownLoading.has(id)) {
      ownLoading.set(id, imgStore.get(id).then((v) => {
        ownImgs.set(id, v && v.img ? v : null);
        ownLoading.delete(id);
        hydrate();
      }, () => { ownImgs.set(id, null); ownLoading.delete(id); hydrate(); }));
    }
    return undefined;
  }

  // An own thing's image: the example's stand-in, or the stored image (undefined while loading).
  function ownSrc(c, what) {
    if (c.imgFrom) { const d = deckCard(c.imgFrom); return d && d.img ? d.img : null; }
    const v = ownGet(c.id);
    if (v === undefined) return undefined;
    return v ? (v[what] || v.img) : null;
  }

  const tileCache = new Map();
  function cropTile(src, crop) {
    const key = src.length > 200 ? src.slice(0, 64) + src.length + src.slice(-64) : src;
    const k = key + '|' + crop.join(',');
    if (tileCache.has(k)) return tileCache.get(k);
    const p = new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        try {
          const cv = doc.createElement('canvas');
          cv.width = 256; cv.height = 256;
          const sx = crop[0] * im.naturalWidth, sy = crop[1] * im.naturalHeight;
          const sw = Math.max(1, crop[2] * im.naturalWidth), sh = Math.max(1, crop[3] * im.naturalHeight);
          cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, 256, 256);
          resolve(cv.toDataURL('image/jpeg', 0.86));
        } catch (e) { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
    tileCache.set(k, p);
    return p;
  }

  // Fill in the own images that have arrived (thumbnails, card art, room parts).
  function hydrate(root) {
    $$('[data-own]', root || doc).forEach((el) => {
      const id = el.getAttribute('data-own');
      const what = el.getAttribute('data-what') || 'img';
      const v = ownGet(id);
      if (v === undefined) return;
      el.removeAttribute('data-own');
      if (!v) { el.classList.add('missing'); const m = el.parentElement && el.parentElement.querySelector('.ownmissing'); if (m) m.hidden = false; return; }
      const src = v[what === 'thumb' ? 'thumb' : 'img'] || v.img;
      paintSrc(el, src);
    });
    $$('[data-src-crop]', root || doc).forEach((el) => {
      const src = el.getAttribute('data-src-crop');
      el.removeAttribute('data-src-crop');
      paintSrc(el, src);
    });
  }

  function paintSrc(el, src) {
    if (!src) return;
    if (el.tagName === 'IMG') { el.src = src; return; }
    const crop = (el.getAttribute('data-crop') || '').split(',').map(Number);
    if (el.hasAttribute('data-tile') && crop.length === 4 && crop.every(isFinite)) {
      cropTile(src, crop).then((url) => { if (url) el.style.backgroundImage = 'url("' + url + '")'; });
    } else {
      el.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
    }
  }

  // ---------------------------------------------------------------- pictures of cards

  function bandsHTML(colours) {
    const cs = (colours || []).filter(isHex);
    const list = cs.length ? cs : ['#888888'];
    return '<span class="bands" aria-hidden="true">' + [0, 1, 2].map((i) => '<i style="background:' + (list[i] || list[list.length - 1]) + '"></i>').join('') + '</span>';
  }

  function atlasStyle(i) {
    const A = deck && deck.atlas;
    if (!A || !isFinite(i)) return '';
    const cols = A.cols || 1, rows = atlasRows || 1;
    const x = i % cols, y = Math.floor(i / cols);
    return 'background-image:url(&quot;' + esc(A.src) + '&quot;);background-size:' + (cols * 100) + '% ' + (rows * 100) + '%;background-position:' +
      (cols > 1 ? (x / (cols - 1)) * 100 : 0).toFixed(3) + '% ' + (rows > 1 ? (y / (rows - 1)) * 100 : 0).toFixed(3) + '%';
  }

  function cropBgStyle(crop) {
    if (!Array.isArray(crop) || crop.length !== 4) return 'background-size:cover;background-position:50% 50%';
    const [x, y, w, h] = crop;
    const px = w < 1 ? (x / (1 - w)) * 100 : 0, py = h < 1 ? (y / (1 - h)) * 100 : 0;
    return 'background-size:' + (100 / w).toFixed(2) + '% ' + (100 / h).toFixed(2) + '%;background-position:' + px.toFixed(2) + '% ' + py.toFixed(2) + '%';
  }

  // A small picture of a card. mode "judged": what the person saw (bands, the crop); "work": the work.
  function thumbHTML(c, mode, cls) {
    const k = 'th ' + (cls || '');
    if (!c) return '<span class="' + k + '"></span>';
    const bg = (c.colours && isHex(c.colours[0])) ? c.colours[0] : '';
    const bgs = bg ? 'background-color:' + bg + ';' : '';
    if (c.own) {
      // Brought in from another app (a link, a file): its picture, or its source's letter until one comes.
      if (mode !== 'crop' && fromApps(ownRec(c.id))) {
        const src = ownSrc(c, 'thumb');
        if (src) return '<span class="' + k + '" style="' + bgs + '"><img src="' + esc(src) + '" alt=""></span>';
        return '<span class="' + k + ' ph" style="' + phStyle(c) + '">' + phMark(c) + (src === undefined ? '<img data-own="' + esc(c.id) + '" data-what="thumb" alt="">' : '') + '</span>';
      }
      if (mode === 'crop') {
        const src = ownSrc(c, 'img');
        const crop = c.crop || [0.375, 0.375, 0.25, 0.25];
        if (src) return '<span class="' + k + '" style="' + bgs + cropBgStyle(crop) + '" data-src-crop="' + esc(src) + '"></span>';
        return '<span class="' + k + '" style="' + bgs + cropBgStyle(crop) + '" data-own="' + esc(c.id) + '" data-what="img"></span>';
      }
      const src = ownSrc(c, 'thumb');
      if (src) return '<span class="' + k + '" style="' + bgs + '"><img src="' + esc(src) + '" alt=""></span>';
      if (src === null) return '<span class="' + k + '" style="' + bgs + '">' + bandsHTML(c.colours) + '</span>';
      return '<span class="' + k + '" style="' + bgs + '"><img data-own="' + esc(c.id) + '" data-what="thumb" alt=""></span>';
    }
    if (mode === 'judged' && c.kind === 'colour') return '<span class="' + k + '">' + bandsHTML(c.colours) + '</span>';
    if ((mode === 'judged' || mode === 'crop') && c.kind === 'surface' && c.img) {
      return '<span class="' + k + '" style="' + bgs + '"><img src="' + esc(c.img) + '" alt="" loading="lazy"></span>';
    }
    if (deck && deck.atlas && isFinite(c.thumb)) return '<span class="' + k + '" style="' + bgs + atlasStyle(c.thumb) + '"></span>';
    if (c.img) return '<span class="' + k + '" style="' + bgs + '"><img src="' + esc(c.img) + '" alt="" loading="lazy"></span>';
    return '<span class="' + k + '">' + bandsHTML(c.colours) + '</span>';
  }

  // The engine sorts neutrals first; real decks are mostly greys and browns, so lead with the hues.
  function isHue(h) {
    const x = F.hexToHsl(h);
    const c = x.s * (1 - Math.abs(2 * x.l - 1));
    return x.s >= 0.15 && c >= 0.07 && x.l >= 0.08 && x.l <= 0.96;
  }
  function huesFirst(hexes) { return hexes.filter(isHue).concat(hexes.filter((h) => !isHue(h))); }

  function colourWords(c) { return uniq((c.colours || []).filter(isHex).map((h) => F.colourName(h))); }

  // Before a judgment: kind, colour names and material words only (never the title or artist).
  function describeBefore(c) {
    if (!c) return '';
    const kind = KIND_LABEL[c.kind] || 'Card';
    const cols = colourWords(c);
    let s = c.own ? 'Still yours? Your ' + kind.toLowerCase() + (c.title && c.title !== 'Untitled' ? ', ' + c.title : '') + '.' : kind + '.';
    if (c.kind === 'surface') s += ' A detail, at its own scale.';
    if (cols.length) s += ' Colours: ' + listWords(cols) + '.';
    const mats = c.kind === 'colour' ? [] : (c.materials || []);
    if (mats.length) s += ' Materials: ' + listWords(mats) + '.';
    return s;
  }

  // Dates arrive as written on Artsy: "Executed in 2002.", "(Date unknown)", "Undated". Say the date, or nothing.
  function dateText(d) {
    const t = String(d == null ? '' : d).replace(/\s+/g, ' ').trim();
    if (/^\(?\s*(date\s+)?(unknown|undated|n\.\s?d\.|n\/?a|no date)(\s+date)?\s*\)?\.?$/i.test(t)) return '';
    return t.replace(/^executed in\s+/i, '').replace(/(\d)\.$/, '$1');
  }
  // A medium worth showing has words in it (one real record's medium is just its year).
  const mediumText = (m) => (/[a-z]{3,}/i.test(String(m || '')) ? String(m).trim() : '');

  function nameLine(c) {
    if (!c) return '';
    if (c.own) return (c.title || 'Untitled') + ', from ' + fromWords(c.source);
    return [c.title, c.artist, dateText(c.date)].map((x) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
  }

  // A source inside a sentence: "from your photos", "from Pinterest", "from the web".
  function fromWords(src) {
    const t = String(src || 'Somewhere else');
    return /^(Your|The|Somewhere)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  }

  // Real titles can run to two hundred characters (credit lines and all). Where space is short,
  // show the start of the title; the detail sheet always has all of it.
  function shortTitle(t, n) {
    const x = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    const max = n || 90;
    if (x.length <= max) return x;
    const cut = x.slice(0, max - 1);
    const sp = cut.lastIndexOf(' ');
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:\-–—/(]+$/, '') + '…';
  }
  function nameLineShort(c) {
    if (!c || c.own) return nameLine(c);
    return nameLine(Object.assign({}, c, { title: shortTitle(c.title) }));
  }

  function describeAfter(c) {
    if (!c) return '';
    return nameLine(c) + '. ' + (KIND_LABEL[c.kind] || '') + (c.kind === 'surface' ? ' (a detail)' : c.kind === 'colour' ? ' (its colours)' : '') + '.';
  }

  const MAT_NOUN = { photograph: 'photographs', screenprint: 'screenprints', lithograph: 'lithographs', etching: 'etchings', woodcut: 'woodcuts' };

  // A feature as a chip label. Bare engine labels like "Split", "Dark" or "Image" are ambiguous
  // next to the tab names, so colour and card features say what they are.
  function chipLabel(e) {
    const key = String(e.key || ''), i = key.indexOf(':');
    const type = key.slice(0, i), v = key.slice(i + 1);
    const label = e.label || F.featureLabel(key, deck);
    switch (type) {
      case 'chord': return label + ' palettes';
      case 'hue': return v === 'neutral' ? 'Neutral colours' : label;
      case 'value': return ({ light: 'Light tones', mid: 'Mid-tones', dark: 'Dark tones' }[v] || label);
      case 'chroma': return label + ' colours';
      case 'kind': return label + ' cards';
      default: return label;
    }
  }

  // A feature as a noun phrase: "Geometric works", "works in wood", "orange works".
  function featureNoun(key) {
    const i = String(key).indexOf(':');
    const type = key.slice(0, i), v = key.slice(i + 1);
    const label = F.featureLabel(key, deck);
    switch (type) {
      case 'gene': case 'cat': return label + ' works';
      case 'mat': return MAT_NOUN[v] || 'works in ' + label.toLowerCase();
      case 'hue': return label.toLowerCase() + ' works';
      case 'value': return ({ light: 'light', mid: 'mid-tone', dark: 'dark' }[v] || v) + ' works';
      case 'chroma': return v + ' works';
      case 'chord': return v + ' palettes';
      case 'texture': return v + '-textured surfaces';
      case 'era': return 'works from ' + (/^Before/.test(label) ? 'b' + label.slice(1) : label);
      case 'place': return 'works from ' + label;
      case 'kind': return label + ' cards';
      default: return label;
    }
  }

  function turnSentence(dir, because, what) {
    const b = because && because[0];
    if (!b) return 'You ' + (dir > 0 ? 'kept' : 'passed') + ' ' + what + ' against your own pattern.';
    return 'You ' + (dir > 0 ? 'kept' : 'passed') + ' ' + what + ' though you ' + (dir > 0 ? 'pass' : 'keep') + ' most ' + featureNoun(b.key) +
      ' (kept ' + b.kept + ' of ' + b.n + ').';
  }

  // ---------------------------------------------------------------- the five

  function ensureFive() {
    if (!deck) return;
    const day = F.dayOf(now());
    const five = S.five;
    const broken = five && five.ids.some((id) => !F.card(S, deck, id));
    if (!five || broken || five.day !== day) {
      S = F.startFive(S, deck, now());
      persist();
    }
  }

  function lastJudgment(id) {
    for (let i = S.j.length - 1; i >= 0; i--) if (S.j[i][0] === id) return S.j[i];
    return null;
  }

  function canUndo() {
    const f = S.five;
    if (!f || f.i <= 0 || !S.j.length) return false;
    return S.j[S.j.length - 1][0] === f.ids[f.i - 1];
  }

  // ---------------------------------------------------------------- committing changes

  function commit(next, opts) {
    S = next;
    persist();
    checkPath();
    updateChrome();
    if (!(opts && opts.noRender)) renderView();
  }

  function checkPath() {
    if (!deck) return;
    let st = S;
    const msgs = [];
    for (const m of F.path(S, deck, now())) {
      if (m.done && !m.announced) { st = F.markSeen(st, 'path:' + m.key); msgs.push('Path: ' + m.label + '. Done.'); }
    }
    if (st !== S) { S = st; persist(); msgs.forEach(say); }
  }

  // ---------------------------------------------------------------- chrome: path chip, banner, step line

  function updateChrome() {
    const items = deck ? F.path(S, deck, now()) : [];
    const done = items.filter((m) => m.done).length;
    const total = items.length || F.MILESTONES.length + (F.HUB_MILESTONES || []).length;
    $('#path-n').textContent = done + '/' + total;
    $('#pathchip').setAttribute('aria-label', 'Path, ' + done + ' of ' + total + ' done');
    $('#exbanner').hidden = !(example && view !== 'sort');
    $('#bar-step').innerHTML = VIEWS.map((v) => (v === view ? '<b>' + TITLES[v] + '</b>' : TITLES[v])).join(' <i>→</i> ');
  }

  function currentTheme() {
    const t = doc.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return mqDark.matches ? 'dark' : 'light';
  }

  // ---------------------------------------------------------------- views

  function showView(v, opts) {
    if (VIEWS.indexOf(v) < 0) v = 'sort';
    const changed = v !== view;
    view = v;
    for (const x of VIEWS) {
      $('#view-' + x).hidden = x !== v;
      const tab = $('#tab-' + x);
      tab.setAttribute('aria-selected', x === v ? 'true' : 'false');
      tab.tabIndex = x === v ? 0 : -1;
    }
    doc.title = TITLES[v] + ' · 5s';
    if (location.hash !== '#' + v) {
      try { history.replaceState(null, '', '#' + v); } catch (e) { try { location.hash = v; } catch (e2) { /* no hash here */ } }
    }
    if (changed) {
      $('#main').scrollTop = 0;
      ui.confirm = null;
      $$('#fly-layer > *').forEach((n) => { try { n.getAnimations().forEach((a) => a.finish()); } catch (e) { /* done */ } n.remove(); });
    }
    updateChrome();
    renderView();
    if (v === 'sort') { ui.shownAt = performance.now(); restartRing(); }
    if (opts && opts.focus) {
      const h = $('#view-' + v + ' h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  function renderView() {
    if (view === 'sort') renderSort();
    else if (view === 'split') renderSplit();
    else if (view === 'set') renderSet();
    else if (view === 'see') renderSee();
    else if (view === 'seed') renderSeed();
    hydrate();
  }

  function notReady(el) {
    el.innerHTML = '<div class="wrap"><div class="view-head"><h1 class="h1" tabindex="-1">' + esc(TITLES[view]) + '</h1>' +
      '<p class="lede loading">' + (ui.deckError ? esc(ui.deckError) : 'Loading the cards…') + '</p></div></div>';
  }

  function exampleButton(st) {
    if (example || hasContent(st)) return '';
    return '<button type="button" class="btn btn-iris" data-act="example-on">See an example</button>';
  }

  function emptyBox(text, withExample) {
    return '<div class="empty"><span class="ghosts" aria-hidden="true"><i></i><i></i><i></i></span><p>' + esc(text) + '</p>' +
      (withExample ? exampleButton(active()) : '') + '</div>';
  }

  // ================================================================ SORT

  function renderSort() {
    const el = $('#view-sort');
    if (!deck) { el.removeAttribute('data-built'); notReady(el); return; }
    ensureFive();
    if (!el.getAttribute('data-built')) {
      el.setAttribute('data-built', '1');
      el.innerHTML =
        '<div class="sort-wrap">' +
          '<div class="sort-head">' +
            '<h1 class="h1" id="sort-h1" tabindex="-1">Today’s five</h1>' +
            '<p class="counter" id="counter"></p>' +
            '<button type="button" class="iconbtn info" data-act="about" aria-haspopup="dialog" aria-label="About 5s">i</button>' +
            '<p class="sort-sub"><span>Keep what you like. Names come after.</span><span class="streak" id="streak"></span></p>' +
          '</div>' +
          '<p class="revisit" id="revisit" hidden></p>' +
          '<div class="stack" id="stack" aria-label="Today’s cards"></div>' +
          '<div class="intro" id="intro" hidden></div>' +
          '<div class="summary" id="summary" hidden tabindex="-1"></div>' +
          '<div class="strip" id="strip"></div>' +
          '<div class="controls" id="controls">' +
            '<button type="button" class="btn btn-pass btn-big" id="btn-pass" data-act="pass">' + icon('left') + '<span>Pass</span></button>' +
            '<button type="button" class="iconbtn" id="btn-undo" data-act="undo" aria-label="Undo the last judgment">' + icon('undo') + '</button>' +
            '<button type="button" class="iconbtn" id="btn-closer" data-act="closer" aria-haspopup="dialog" aria-label="Look closer">' + icon('closer') + '</button>' +
            '<button type="button" class="btn btn-keep btn-big" id="btn-keep" data-act="keep"><span>Keep</span>' + icon('right') + '</button>' +
          '</div>' +
        '</div>';
      const strip = $('#strip');
      strip.addEventListener('mouseenter', () => { ui.stripHold = true; });
      strip.addEventListener('mouseleave', () => { ui.stripHold = false; if (ui.strip) scheduleStripHide(STRIP_MS); });
      strip.addEventListener('focusin', () => { ui.stripHold = true; });
      strip.addEventListener('focusout', (e) => { if (!strip.contains(e.relatedTarget)) { ui.stripHold = false; if (ui.strip) scheduleStripHide(STRIP_MS); } });
    }
    const intro = !S.seen.intro;
    const done = F.fiveDone(S);
    $('#sort-h1').textContent = S.five && S.five.n > 1 ? 'Another five' : 'Today’s five';
    const st = F.streak(S, now());
    const streak = $('#streak');
    streak.innerHTML = st > 0 ? icon('streak') + '<span>' + plural(st, 'day') + '</span>' : '';
    streak.setAttribute('aria-label', st > 0 ? 'Streak: ' + plural(st, 'day') + ' in a row' : '');
    updateCounter();
    $('#intro').hidden = !intro;
    if (intro) renderIntro();
    $('#stack').hidden = intro || done;
    $('#summary').hidden = intro || !done;
    $('#controls').hidden = intro || done;
    if (!intro && !done) updateStack();
    else { $$('#stack .card:not(.flying)').forEach((n) => n.remove()); ui.topId = null; $('#revisit').hidden = true; }
    if (!intro && done) renderSummary();
    updateControls();
    renderStrip();
  }

  function updateCounter() {
    const five = S.five;
    const n = five ? five.ids.length : 5;
    const done = F.fiveDone(S);
    const i = five ? (done ? n : five.i + 1) : 0;
    const ringOn = S.opts.ring !== false && !reduced() && !done && S.seen.intro;
    const label = S.opts.ring !== false && reduced() ? '<span class="fivesec" aria-hidden="true">5 s</span>' : '';
    const key = i + '/' + n + '|' + ringOn + '|' + label + '|' + (ui.topId || '');
    const c = $('#counter');
    if (!c || key === ui.counterKey) return;
    ui.counterKey = key;
    const text = '<span class="counter-text"><span class="visually-hidden">Card </span><b>' + i + '</b> <span>of ' + n + '</span></span>';
    c.className = 'counter' + (ringOn ? '' : ' plain');
    c.innerHTML = (ringOn ? '<svg class="ring" viewBox="0 0 56 56" aria-hidden="true"><circle class="track" cx="28" cy="28" r="24"/><circle class="fill" cx="28" cy="28" r="24"/></svg>' : '') + text + (ringOn ? '' : label);
    restartRing();
  }

  function restartRing() {
    const r = $('#counter .ring');
    if (!r) return;
    r.classList.remove('run');
    void r.getBoundingClientRect();
    if (S.seen.intro && !F.fiveDone(S) && !$('#view-sort').hidden) r.classList.add('run');
  }

  function renderIntro() {
    const logo = ui.logoOk === false
      ? '<span class="brand-mark" style="width:72px;height:72px;font-size:30px;border-radius:18px;border-width:3px" aria-hidden="true">5s</span>'
      : '<img class="intro-logo" src="logo.webp" alt="" width="72" height="72">';
    $('#intro').innerHTML = logo +
      '<h2 class="h1">Five quick judgments a day build your own aesthetic database.</h2>' +
      '<ul>' +
        '<li>' + icon('keep', 'k') + '<span>Drag right or press <b>Keep</b> for what you like.</span></li>' +
        '<li>' + icon('pass', 'p') + '<span>Drag left or press <b>Pass</b> for the rest. The arrow keys work too.</span></li>' +
        '<li>' + icon('closer', 'i') + '<span>Names come after you decide.</span></li>' +
        '<li>' + icon('letgo', 'i') + '<span>No account details. Only your judgments.</span></li>' +
      '</ul>' +
      '<div class="actions">' +
        '<button type="button" class="btn btn-keep btn-big" data-act="start" id="btn-start">Start</button>' +
        '<button type="button" class="btn btn-big" data-act="bring" aria-haspopup="dialog">Bring in your own</button>' +
        '<button type="button" class="btn btn-big" data-act="connect" aria-haspopup="dialog">Connect your apps</button>' +
      '</div>';
  }

  function makeCard(id) {
    const c = cardOf(id, S);
    const n = doc.createElement('div');
    n.className = 'card k-' + (c ? c.kind : 'image') + (c && c.own ? ' own' : '');
    n.setAttribute('data-id', id);
    n.setAttribute('role', 'img');
    n.setAttribute('aria-label', describeBefore(c));
    if (c && isHex(c.colours[0])) n.style.setProperty('--cbg', c.colours[0]);
    let art = '';
    if (!c) art = '';
    else if (c.kind === 'colour') art = bandsHTML(c.colours);
    else if (c.own && fromApps(ownRec(c.id, S))) {
      // From another app: its picture once it has one; until then its source's letter, and why.
      const src = ownSrc(c, 'img');
      if (!isHex(c.colours[0])) n.classList.add('paper');
      art = '<span class="ph-art" style="' + phStyle(c) + '" aria-hidden="true">' + phMark(c) + '</span>' +
        (src ? '<img class="art" src="' + esc(src) + '" alt="" draggable="false">' : src === undefined ? '<img class="art" data-own="' + esc(c.id) + '" data-what="img" alt="" draggable="false">' : '') +
        '<p class="ownmissing"' + (src === null ? '' : ' hidden') + '><span>' + esc(waitWords(ownRec(c.id, S))) + '</span></p>';
      if (src === null) n.setAttribute('aria-label', describeBefore(c) + ' ' + waitWords(ownRec(c.id, S)));
    } else if (c.own) {
      const src = ownSrc(c, 'img');
      art = (src ? '<img class="art" src="' + esc(src) + '" alt="" draggable="false">' : src === null ? bandsHTML(c.colours) : '<img class="art" data-own="' + esc(c.id) + '" data-what="img" alt="" draggable="false">') +
        '<p class="ownmissing"' + (src === null ? '' : ' hidden') + '><span>This image isn’t on this device. Its colours stand in.</span></p>';
    } else if (c.img) art = '<img class="art" src="' + esc(c.img) + '" alt="" draggable="false" decoding="async">';
    n.innerHTML = art +
      '<span class="kindtag" aria-hidden="true">' + (c && c.own ? 'Yours · ' : '') + esc(c ? KIND_LABEL[c.kind] : '') + '</span>' +
      '<span class="stamp stamp-pass" aria-hidden="true">' + icon('left') + (c && c.own ? 'Let go' : 'Pass') + '</span>' +
      '<span class="stamp stamp-keep" aria-hidden="true">Keep' + icon('right') + '</span>';
    attachDrag(n);
    return n;
  }

  function preload(id) {
    const c = id && cardOf(id, S);
    if (!c) return;
    if (c.own) { ownGet(c.id); return; }
    if (c.img) { const im = new Image(); im.decoding = 'async'; im.src = c.img; }
  }

  function updateStack() {
    const stack = $('#stack');
    const five = S.five;
    const rest = five ? five.ids.slice(five.i) : [];
    const want = rest.slice(0, 2);
    const have = new Map($$('.card:not(.flying)', stack).map((n) => [n.getAttribute('data-id'), n]));
    have.forEach((n, id) => { if (want.indexOf(id) < 0) n.remove(); });
    want.slice().reverse().forEach((id, k) => {
      const i = want.length - 1 - k;
      let n = have.get(id);
      if (!n) { n = makeCard(id); stack.insertBefore(n, stack.firstChild); }
      n.classList.toggle('is-top', i === 0);
      n.classList.toggle('is-under', i === 1);
      if (i === 1) { n.setAttribute('aria-hidden', 'true'); n.style.transform = ''; }
      else n.removeAttribute('aria-hidden');
    });
    preload(rest[1]);
    preload(rest[2]);
    const top = want[0] || null;
    const tc = top && cardOf(top, S);
    const rv = $('#revisit');
    if (tc && tc.own) {
      rv.hidden = false;
      rv.innerHTML = icon('letgo') + '<span>Still yours?</span> <span class="src">' + esc((tc.title || 'Untitled') + ' · ' + (tc.source || '')) + '</span>' + whereBtn(tc, 'linkbtn');
    } else { rv.hidden = true; rv.textContent = ''; }
    if (top !== ui.topId) {
      ui.topId = top;
      ui.shownAt = performance.now();
      ui.counterKey = '';
      updateCounter();
    }
    hydrate(stack);
  }

  function updateControls() {
    const id = F.currentCard(S);
    const c = id && cardOf(id, S);
    const pass = $('#btn-pass span');
    if (pass) pass.textContent = c && c.own ? 'Let go' : 'Pass';
    const u = $('#btn-undo');
    if (u) u.disabled = !canUndo();
    const cl = $('#btn-closer');
    if (cl) cl.disabled = !id;
  }

  // -- the drag

  function attachDrag(n) {
    n.addEventListener('pointerdown', (e) => {
      if (!n.classList.contains('is-top') || n.classList.contains('flying')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ui.drag = { n, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, axis: null, w: n.offsetWidth || 300, hist: [[e.timeStamp, e.clientX]] };
      try { n.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
    });
    n.addEventListener('pointermove', (e) => {
      const d = ui.drag;
      if (!d || d.n !== n || e.pointerId !== d.pid) return;
      d.dx = e.clientX - d.x0;
      d.dy = e.clientY - d.y0;
      if (!d.axis) {
        if (Math.abs(d.dx) < 6 && Math.abs(d.dy) < 6) return;
        d.axis = Math.abs(d.dx) > Math.abs(d.dy) ? 'x' : 'y';
        if (d.axis === 'x') n.style.transition = 'none';
      }
      if (d.axis !== 'x') return;
      e.preventDefault();
      d.hist.push([e.timeStamp, e.clientX]);
      if (d.hist.length > 6) d.hist.shift();
      setDrag(n, d.dx, d.w);
    });
    const end = (e, cancelled) => {
      const d = ui.drag;
      if (!d || d.n !== n || e.pointerId !== d.pid) return;
      ui.drag = null;
      try { n.releasePointerCapture(e.pointerId); } catch (err) { /* released */ }
      if (d.axis !== 'x') return;
      const h = d.hist, a = h[0], b = h[h.length - 1];
      const v = b[0] - a[0] > 0 ? (b[1] - a[1]) / (b[0] - a[0]) : 0;
      const far = Math.abs(d.dx) >= 0.3 * d.w;
      const flick = Math.abs(v) > 0.55 && Math.abs(d.dx) > 24 && Math.sign(v) === Math.sign(d.dx);
      if (!cancelled && (far || flick)) { n._dx = d.dx; decide(d.dx > 0, 'drag'); } else springBack(n);
    };
    n.addEventListener('pointerup', (e) => end(e, false));
    n.addEventListener('pointercancel', (e) => end(e, true));
    n.addEventListener('lostpointercapture', (e) => { if (ui.drag && ui.drag.n === n && e.pointerId === ui.drag.pid) end(e, true); });
  }

  function setDrag(n, dx, w) {
    const rot = reduced() ? 0 : Math.max(-9, Math.min(9, dx / 24));
    n.style.transform = 'translateX(' + dx + 'px) rotate(' + rot + 'deg)';
    const a = Math.min(1, Math.abs(dx) / (0.3 * w));
    const k = $('.stamp-keep', n), p = $('.stamp-pass', n);
    if (k) k.style.opacity = dx > 0 ? a : 0;
    if (p) p.style.opacity = dx < 0 ? a : 0;
  }

  function springBack(n) {
    n.style.transition = '';
    n.style.transform = '';
    $$('.stamp', n).forEach((s) => { s.style.opacity = 0; });
  }

  function flyOff(n, keep) {
    if (!n) return;
    n.classList.add('flying');
    n.classList.remove('is-top', 'is-under');
    n.setAttribute('aria-hidden', 'true');
    if (reduced()) { n.remove(); return; }
    const dir = keep ? 1 : -1;
    const w = n.offsetWidth || 300;
    const dx = n._dx || 0;
    const st = $(keep ? '.stamp-keep' : '.stamp-pass', n);
    if (st) st.style.opacity = 1;
    n.style.transition = 'none';
    n.style.transform = 'translateX(' + dx + 'px) rotate(' + Math.max(-9, Math.min(9, dx / 24)) + 'deg)';
    void n.offsetWidth;
    n.style.transition = 'transform 300ms cubic-bezier(.4,.1,.7,.6), opacity 300ms ease-in';
    n.style.transform = 'translateX(' + (dir * w * 1.35) + 'px) rotate(' + (dir * 16) + 'deg)';
    n.style.opacity = '0';
    setTimeout(() => n.remove(), 340);
  }

  // -- deciding

  function decide(keep, how) {
    if (!deck || view !== 'sort' || !S.seen.intro) return;
    const id = F.currentCard(S);
    if (!id) return;
    const c = cardOf(id, S);
    const ms = Math.max(0, Math.round(performance.now() - ui.shownAt));
    const res = F.judge(S, deck, id, !!keep, ms, now());
    const top = $('#stack .card.is-top');
    const rect = top ? top.getBoundingClientRect() : null;
    if (top && how !== 'drag') top._dx = 0;
    flyOff(top, keep);
    commit(res.state, { noRender: true });
    renderSort();
    showStrip({ id, keep: !!keep, turn: res.turn });
    if (keep && c && !c.own) flyParts(c, rect);
    let msg = c && c.own ? (keep ? 'Still yours: ' + (c.title || 'Untitled') + '.' : 'Let go: ' + (c.title || 'Untitled') + '. It moves to Let go in Split.')
      : (keep ? 'Kept: ' : 'Passed: ') + nameLine(c) + '.';
    if (res.turn) msg += ' A turn. ' + turnSentence(res.turn.dir, res.turn.because, 'this');
    if (F.fiveDone(S)) {
      const js = S.five.ids.map(lastJudgment).filter(Boolean);
      msg += ' Five sorted. You kept ' + js.filter((e) => e[1]).length + ' of ' + js.length + '.';
    } else {
      const next = cardOf(F.currentCard(S), S);
      if (next) msg += ' Next: ' + describeBefore(next);
    }
    say(msg);
    if (F.fiveDone(S)) {
      const ae = doc.activeElement;
      if (!ae || ae === doc.body || ae.closest('#controls')) { const s = $('#summary h2'); if (s) { s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); } }
    }
  }

  function doUndo() {
    if (!canUndo()) return;
    const last = S.j[S.j.length - 1];
    const ae = doc.activeElement;
    const fromStrip = ae && ae.closest && ae.closest('#strip, #summary');
    $$('#stack .card.flying').forEach((n) => n.remove());
    commit(F.undo(S), { noRender: true });
    hideStrip();
    renderSort();
    const top = $('#stack .card.is-top');
    if (top && !reduced()) {
      const dir = last[1] ? 1 : -1;
      top.style.transition = 'none';
      top.style.transform = 'translateX(' + (dir * (top.offsetWidth || 300) * 1.2) + 'px) rotate(' + (dir * 14) + 'deg)';
      void top.offsetWidth;
      top.style.transition = '';
      top.style.transform = '';
    }
    const c = cardOf(last[0], S);
    say('Undone. The ' + (c ? KIND_LABEL[c.kind].toLowerCase() + ' ' : '') + 'card is back.');
    if (fromStrip || !ae || !ae.isConnected || ae === doc.body) { const b = $('#btn-keep'); if (b) b.focus({ preventScroll: true }); }
  }

  // -- the reveal strip

  function showStrip(info) {
    ui.strip = info;
    renderStrip();
    scheduleStripHide(info.turn ? STRIP_TURN_MS : STRIP_MS);
  }
  function scheduleStripHide(ms) {
    clearTimeout(ui.stripTimer);
    ui.stripTimer = setTimeout(() => { if (ui.stripHold) return; hideStrip(); }, ms);
  }
  function hideStrip() {
    clearTimeout(ui.stripTimer);
    ui.strip = null;
    ui.stripHold = false;
    renderStrip();
  }

  function partsOf(c) {
    if (!c) return [];
    const out = (c.colours || []).filter(isHex).slice(0, 3).map((h) => ({ sw: h }));
    if (c.kind !== 'colour') {
      (c.materials || []).slice(0, 2).forEach((m) => out.push({ t: F.featureLabel('mat:' + m, deck) }));
      if (c.kind !== 'surface') {
        (c.genes || []).filter((g) => F.featureGroup('gene:' + g, deck) === 'Qualities').slice(0, 2)
          .forEach((g) => out.push({ t: F.featureLabel('gene:' + g, deck) }));
      }
    }
    return out;
  }

  function renderStrip() {
    const el = $('#strip');
    if (!el) return;
    const had = el.contains(doc.activeElement);
    const info = ui.strip;
    const c = info && cardOf(info.id, S);
    if (!info || !c) { el.innerHTML = ''; el.classList.remove('is-turn'); return; }
    const own = !!c.own;
    const verb = own ? (info.keep ? 'Still yours' : 'Let go') : (info.keep ? 'Kept' : 'Passed');
    let html = '<div class="strip-in" role="group" aria-label="Your last judgment">' +
      '<p class="strip-text"><span class="' + (info.keep ? 'kept' : 'passed') + '">' + icon(info.keep ? 'keep' : (own ? 'letgo' : 'pass')) + '</span>' +
      '<span><b>' + verb + ':</b> ' + esc(nameLineShort(c)) + '</span></p>';
    if (info.turn) {
      html += '<p class="strip-text">' + icon('turn') + '<span><b>A turn.</b> ' + esc(turnSentence(info.turn.dir, info.turn.because, 'this')) + '</span></p>';
    }
    if (info.keep && !own && reduced()) {
      html += '<p class="parts" aria-label="Parts added to Split">' + partsOf(c).map((p) => (p.sw ? '<span class="sw" style="background:' + p.sw + '"></span>' : '<span class="pt">' + esc(p.t) + '</span>')).join('') + '</p>';
    }
    html += '<div class="strip-btns">' +
      (info.turn ? '<button type="button" class="btn" data-act="note-turn" data-id="' + esc(info.id) + '" aria-haspopup="dialog">Note why</button>' : '') +
      (canUndo() && S.j.length && S.j[S.j.length - 1][0] === info.id ? '<button type="button" class="btn" data-act="undo">Undo</button>' : '') +
      '<button type="button" class="btn" data-act="detail" data-id="' + esc(info.id) + '" aria-haspopup="dialog">Look closer</button>' +
      whereBtn(c, 'btn') +
      '</div></div>';
    el.innerHTML = html;
    el.classList.toggle('is-turn', !!info.turn);
    if (had) { const b = $('button', el); if (b) b.focus({ preventScroll: true }); }
  }

  // -- the parts flying to Split

  function flyParts(c, rect) {
    if (reduced() || !rect) return;
    const tab = $('#tab-split');
    if (!tab) return;
    const tr = tab.getBoundingClientRect();
    const tx = tr.left + tr.width / 2, ty = tr.top + 12;
    const layer = $('#fly-layer');
    const parts = partsOf(c);
    parts.forEach((p, i) => {
      const el = doc.createElement('span');
      el.className = 'flypart ' + (p.sw ? 'sw' : 'pt');
      if (p.sw) { el.style.background = p.sw; el.style.width = '22px'; el.style.height = '22px'; } else el.textContent = p.t;
      layer.appendChild(el);
      const sx = rect.left + rect.width * (0.2 + 0.6 * (((i * 37) % 100) / 100));
      const sy = rect.top + rect.height * (0.25 + 0.5 * (((i * 61) % 100) / 100));
      if (!el.animate) { el.remove(); return; }
      const a = el.animate([
        { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 0 },
        { transform: 'translate(' + sx + 'px,' + (sy - 18) + 'px) scale(1)', opacity: 1, offset: 0.22 },
        { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(0.35)', opacity: 0.15 },
      ], { duration: 760, delay: i * 55, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'both' });
      a.onfinish = () => el.remove();
      a.oncancel = () => el.remove();
    });
    setTimeout(() => { tab.classList.remove('got'); void tab.offsetWidth; tab.classList.add('got'); }, 760 + parts.length * 55);
  }

  // -- Five sorted

  function renderSummary() {
    const five = S.five;
    const el = $('#summary');
    const js = five.ids.map((id) => [id, lastJudgment(id)]);
    const total = js.reduce((a, [, e]) => a + (e ? e[2] : 0), 0);
    const turns = js.filter(([, e]) => e && e[4]).length;
    const parts = new Set();
    js.forEach(([id, e]) => {
      if (!e || !e[1]) return;
      const c = cardOf(id, S);
      if (!c) return;
      (c.colours || []).forEach((h) => parts.add('c' + h));
      if (c.kind !== 'colour') (c.materials || []).forEach((m) => parts.add('m' + m));
      if (c.kind !== 'colour' && c.kind !== 'surface') (c.genes || []).forEach((g) => parts.add('g' + g));
    });
    const endAt = js.reduce((a, [, e]) => Math.max(a, e ? e[3] : 0), 0);
    const word = S.notes.filter((n) => n.q === 'five' && n.at >= endAt).pop();
    const tiles = js.map(([id, e]) => {
      const c = cardOf(id, S);
      const k = !!(e && e[1]);
      const verdict = c && c.own ? (k ? 'Kept' : 'Let go') : (k ? 'Kept' : 'Passed');
      return '<li class="tile5 ' + (k ? 'kept' : 'passed') + '"><button type="button" class="tilebtn" data-act="detail" data-id="' + esc(id) + '" aria-haspopup="dialog" aria-label="' + esc(verdict + ': ' + nameLine(c)) + '">' +
        thumbHTML(c, 'judged') + '</button><span class="verdict">' + icon(k ? 'keep' : (c && c.own ? 'letgo' : 'pass')) + verdict + '</span></li>';
    }).join('');
    el.innerHTML =
      '<h2>Five sorted</h2>' +
      '<ul class="tiles5">' + tiles + '</ul>' +
      '<dl class="stats">' +
        '<div><dt>Total time</dt><dd>' + secs(total) + '<span class="unit">s</span></dd></div>' +
        '<div><dt>Turns</dt><dd>' + turns + '</dd></div>' +
        '<div><dt>Parts gained</dt><dd>' + parts.size + '</dd></div>' +
      '</dl>' +
      (word
        ? '<div class="oneword"><span class="small">Your word for this five</span><p class="said">' + esc(word.text) + '</p></div>'
        : '<form class="oneword" data-form="oneword"><label class="small" for="oneword-in">One word for this five (optional)</label>' +
          '<div class="row"><input type="text" id="oneword-in" maxlength="40" autocomplete="off" placeholder="Earthy"><button type="submit" class="btn">Save</button></div></form>') +
      '<div class="actions">' +
        '<button type="button" class="btn btn-keep btn-big wide" data-act="another">Another five</button>' +
        '<button type="button" class="btn btn-big" data-act="goto" data-view="set">Set what you kept</button>' +
        (S.own.length ? '' : '<button type="button" class="btn btn-big" data-act="bring" aria-haspopup="dialog">Bring in your own</button>') +
        (S.own.length ? '' : '<button type="button" class="btn btn-big" data-act="connect" aria-haspopup="dialog">Connect your apps</button>') +
      '</div>';
    hydrate(el);
  }

  // ================================================================ SPLIT

  const SPLIT_GROUPS = [
    ['Materials', 'Materials', 'Oil, wood, steel: the materials of what you keep gather here.'],
    ['Qualities', 'Qualities', 'Qualities like Biomorphic or Geometric, from the works you keep.'],
    ['Movements', 'Movements', 'The styles and movements behind what you keep.'],
    ['Subjects', 'Subjects', 'What the works you keep are about.'],
    ['Eras', 'Eras', 'When the things you keep were made.'],
    ['Places', 'Places', 'Where the things you keep come from.'],
    ['Kinds', 'Kinds', 'Images, objects, spaces, surfaces and colours, as you keep them.'],
  ];

  function chipsHTML(list, key, cls, word) {
    const all = !!ui.splitAll[key];
    const shown = all ? list : list.slice(0, 12);
    let html = '<ul class="chips">' + shown.map((e) => '<li class="chip ' + (cls || '') + '">' + esc(chipLabel(e)) +
      ' <span class="n">' + (word === 'passed' ? 'passed ' + (e.n - e.kept) : 'kept ' + e.kept) + ' of ' + e.n + '</span></li>').join('') + '</ul>';
    if (list.length > 12) html += '<button type="button" class="linkbtn more" data-act="split-all" data-key="' + esc(key) + '">' + (all ? 'Show fewer' : 'Show all ' + list.length) + '</button>';
    return html;
  }

  function sec(title, count, body, cls) {
    const id = 'sec-' + title.toLowerCase().replace(/[^a-z]+/g, '-');
    return '<section class="sec ' + (cls || '') + '" aria-labelledby="' + id + '"><div class="sec-head"><h2 class="sec-title" id="' + id + '">' + esc(title) + '</h2>' +
      (count != null ? '<span class="sec-count">' + count + '</span>' : '') + '</div>' + body + '</section>';
  }

  function renderSplit() {
    const el = $('#view-split');
    if (!deck) { notReady(el); return; }
    const st = active();
    const P = prof(st);
    const ro = readOnly();
    let html = '<div class="wrap"><div class="view-head"><h1 class="h1" tabindex="-1">Split</h1>' +
      '<p class="lede">Everything you kept, broken into its parts.</p>' +
      '<div class="actions">' + (ro ? '' : '<button type="button" class="btn btn-keep btn-big" data-act="bring" aria-haspopup="dialog">' + icon('plus') + 'Bring in your own</button>') +
      (ro ? '' : '<button type="button" class="btn btn-big" data-act="paste" aria-haspopup="dialog" id="split-paste">' + icon('link') + 'Paste a link</button>') +
      (ro ? '' : '<button type="button" class="btn btn-big" data-act="connect" aria-haspopup="dialog">' + icon('link') + 'Connect your apps</button>') + exampleButton(st) + '</div></div>';
    html += '<div class="split-grid">';
    // Colours: the hues first, so the first rows show the spectrum of what you keep; neutrals after.
    const cols = huesFirst(P.keptColours);
    const all = !!ui.splitAll.colours;
    // Folded, show forty spread evenly along the hue order, so the preview spans all of it.
    const shownCols = all || cols.length <= 40 ? cols : uniq(Array.from({ length: 40 }, (_, i) => cols[Math.round((i * (cols.length - 1)) / 39)]));
    html += sec('Colours', cols.length || null, cols.length
      ? '<ul class="swatches">' + shownCols.map((h) => '<li><button type="button" class="swatch" style="--c:' + h + '" data-act="swatch" data-hex="' + h + '" aria-pressed="' + (ui.swatch === h ? 'true' : 'false') + '" aria-label="' + esc(F.colourName(h)) + '"></button></li>').join('') + '</ul>' +
        '<p class="swatch-out" id="swatch-out">' + (ui.swatch && cols.indexOf(ui.swatch) >= 0 ? '<span class="sw" style="background:' + ui.swatch + '"></span> <span class="mono">' + ui.swatch.toUpperCase() + '</span> ' + esc(F.colourName(ui.swatch)) : '<span class="small">Press a colour for its name and hex.</span>') + '</p>' +
        (cols.length > 40 ? '<button type="button" class="linkbtn more" data-act="split-all" data-key="colours">' + (all ? 'Show fewer' : 'Show all ' + cols.length) + '</button>' : '')
      : emptyBox('The colours of everything you keep gather here, sorted by hue.'), 'span2');
    // Surfaces
    const surf = P.keptByKind.surface.map((id) => cardOf(id, st)).filter(Boolean);
    const ownSurf = st.own.filter((o) => o.let == null && Array.isArray(o.crop)).map((o) => cardOf(o.id, st)).filter(Boolean);
    const surfAll = surf.concat(ownSurf);
    html += sec('Surfaces', surfAll.length || null, surfAll.length
      ? '<ul class="tilegrid big">' + surfAll.map((c) => '<li><button type="button" class="tilebtn" data-act="detail" data-id="' + esc(c.id) + '" aria-haspopup="dialog" aria-label="' + esc((c.own ? 'Surface of ' : 'Surface: ') + nameLine(c)) + '">' + thumbHTML(c, 'crop') + '</button></li>').join('') + '</ul>'
      : emptyBox('Keep a Surface card, or bring in a photo, and its texture lands here.'));
    // Things
    const things = [];
    for (const k of F.KINDS) for (const id of P.keptByKind[k]) if (id.charAt(0) !== 'y') { const c = cardOf(id, st); if (c) things.push(c); }
    html += sec('Things', things.length || null, things.length
      ? '<ul class="tilegrid">' + things.map((c) => '<li><button type="button" class="tilebtn" data-act="detail" data-id="' + esc(c.id) + '" aria-haspopup="dialog" aria-label="' + esc(nameLine(c)) + '">' + thumbHTML(c, 'work') + '</button></li>').join('') + '</ul>'
      : emptyBox('Every work you keep, as a thumbnail you can open.'));
    for (const [g, title, empty] of SPLIT_GROUPS) {
      const list = (P.groups[g] || []).filter((e) => e.kept > 0);
      html += sec(title, list.length || null, list.length ? chipsHTML(list, g) : emptyBox(empty));
    }
    // Brought in, Sources, Let go
    const brought = st.own.filter((o) => o.let == null).map((o) => cardOf(o.id, st)).filter(Boolean).reverse();
    // A data file can bring in a couple of hundred things: folded, the newest 24 show (Connect your apps).
    const broughtAll = !!ui.splitAll.brought || brought.length <= 24;
    html += sec('Brought in', brought.length || null, brought.length
      ? '<ul class="rows">' + (broughtAll ? brought : brought.slice(0, 24)).map((c) => '<li><button type="button" class="rowbtn" data-act="detail" data-id="' + esc(c.id) + '" aria-haspopup="dialog">' + thumbHTML(c, 'work') +
        '<span><span class="t">' + esc(c.title || 'Untitled') + '</span><br><span class="s">' + esc(KIND_LABEL[c.kind] + ' · ' + c.source + waitTag(ownRec(c.id, st))) + '</span></span><span class="r">' + esc(fmtDate(c.at)) + '</span></button></li>').join('') + '</ul>' +
        (brought.length > 24 ? '<button type="button" class="linkbtn more" data-act="split-all" data-key="brought">' + (ui.splitAll.brought ? 'Show fewer' : 'Show all ' + brought.length) + '</button>' : '')
      : emptyBox('Photos, pins and saves you bring in appear here. They count as kept, and their colours and textures join your parts.'));
    html += sec('Sources', null, P.sources.length
      ? '<ul class="sources">' + P.sources.map((s) => '<li><span>' + esc(String(s.source).replace(/'/g, '’')) + '</span><span class="n">' + s.n + '</span></li>').join('') + '</ul>' +
        '<p class="sec-note">Where the things in your database come from.</p>'
      : emptyBox('Where your things come from: the artist’s database, your photos, your pins.'));
    const gone = st.own.filter((o) => o.let != null).map((o) => cardOf(o.id, st)).filter(Boolean);
    html += sec('Let go', gone.length || null, gone.length
      ? '<ul class="rows letgo">' + gone.map((c) => '<li><button type="button" class="rowbtn" data-act="detail" data-id="' + esc(c.id) + '" aria-haspopup="dialog">' + thumbHTML(c, 'work') +
        '<span><span class="t">' + esc(c.title || 'Untitled') + '</span><br><span class="s">' + esc(c.source) + '</span></span><span class="r">let go ' + esc(fmtDate(c.let)) + '</span></button></li>').join('') + '</ul>'
      : emptyBox('When a “Still yours?” card comes back and you let it go, it rests here.'));
    html += '</div></div>';
    el.innerHTML = html;
  }

  // ================================================================ SET

  function ensureRoom(st) {
    const key = example ? 'ex' : 'me';
    const pools = {};
    for (const s of SLOTS) pools[s] = F.setPool(st, deck, s);
    if (!ui.room || ui.roomKey !== key) {
      ui.roomKey = key;
      ui.room = {};
      for (const s of SLOTS) ui.room[s] = pools[s][0] || null;
      ui.chooserPage = {};
      return;
    }
    for (const s of SLOTS) {
      if (ui.room[s] && pools[s].indexOf(ui.room[s]) < 0) ui.room[s] = pools[s][0] || null;
      if (!ui.room[s] && pools[s][0]) ui.room[s] = pools[s][0];
    }
  }

  function slotImg(c, cls) {
    if (!c) return '';
    if (c.own && fromApps(ownRec(c.id))) {
      const src = ownSrc(c, 'img');
      if (src) return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="">';
      return '<span class="ph ph-slot" style="' + phStyle(c) + '">' + phMark(c) + (src === undefined ? '<img class="' + (cls || '') + '" data-own="' + esc(c.id) + '" data-what="img" alt="">' : '') + '</span>';
    }
    if (c.own) {
      const src = ownSrc(c, 'img');
      if (src) return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="">';
      if (src === null) return '';
      return '<img class="' + (cls || '') + '" data-own="' + esc(c.id) + '" data-what="img" alt="">';
    }
    return c.img ? '<img class="' + (cls || '') + '" src="' + esc(c.img) + '" alt="" loading="lazy">' : '';
  }

  // The room's elevation. set: {wall, window, picture, floor, object}; interactive: slots are buttons.
  function roomHTML(set, st, interactive) {
    const get = (s) => (set && set[s] ? cardOf(set[s], st) : null);
    const wall = get('wall'), win = get('window'), pic = get('picture'), floor = get('floor'), obj = get('object');
    const wc = wall ? (wall.colours || []).filter(isHex) : [];
    let style = '';
    if (wc[0]) style += '--wall:' + wc[0] + ';--trim:' + (wc[1] || wc[0]) + ';--accent:' + (wc[2] || wc[1] || wc[0]) + ';';
    // Multiply drops a white studio ground into the wall; it only helps on a light ground and a wall that isn't dark.
    const blend = !!(obj && isHex((obj.colours || [])[0]) && lum(obj.colours[0]) > 0.55 && (!wc[0] || lum(wc[0]) >= 0.18));
    // floor
    let floorHTML = '<div class="floor"></div>';
    if (floor) {
      const fc = (floor.colours || []).find(isHex);
      if (fc) style += '--floorc:' + fc + ';';
      if (floor.own) {
        const crop = (floor.crop || [0.375, 0.375, 0.25, 0.25]).join(',');
        const src = ownSrc(floor, 'img');
        floorHTML = src
          ? '<div class="floor" data-tile data-crop="' + crop + '" data-src-crop="' + esc(src) + '"></div>'
          : '<div class="floor" data-tile data-crop="' + crop + '" data-own="' + esc(floor.id) + '" data-what="img"></div>';
      } else if (floor.img) {
        floorHTML = '<div class="floor" style="background-image:url(&quot;' + esc(floor.img) + '&quot;)"></div>';
      }
    }
    const slot = (s, inner, label) => {
      const c = get(s);
      const kind = KIND_LABEL[F.SLOTS[s]];
      if (!interactive) return '<div class="slot slot-' + s + '" aria-hidden="true">' + inner + '</div>';
      if (!c && s !== 'wall' && s !== 'floor') {
        return '<button type="button" class="slot slot-' + s + '" data-act="goto" data-view="sort" aria-label="' + esc(SLOT_LABEL[s] + ': empty. Keep ' + (/^[aeiou]/i.test(kind) ? 'an ' : 'a ') + kind + ' to fill this. Go to Sort.') + '">' +
          '<span class="slot-empty">Keep ' + (/^[aeiou]/i.test(kind) ? 'an ' : 'a ') + esc(kind) + ' to fill this</span></button>';
      }
      if (!c) {
        return '<button type="button" class="slot slot-' + s + '" data-act="goto" data-view="sort" aria-label="' + esc(SLOT_LABEL[s] + ': empty. Keep a ' + kind + ' to fill this. Go to Sort.') + '">' +
          '<span class="slot-empty">Keep a ' + esc(kind) + ' to fill this</span></button>';
      }
      return '<button type="button" class="slot slot-' + s + '" data-act="chooser" data-slot="' + s + '" aria-haspopup="dialog" aria-label="' + esc(SLOT_LABEL[s] + ': ' + label + '. Choose another.') + '">' + inner + '</button>';
    };
    const wallLabel = wc.length ? listWords(uniq(wc.map((h) => F.colourName(h)))) : 'empty';
    let picInner = '';
    if (pic) {
      const ar = pic.w && pic.h ? pic.w / pic.h : 1;
      const box = 0.963;
      const w = ar >= box ? 100 : (ar / box) * 100, h = ar >= box ? (box / ar) * 100 : 100;
      picInner = '<span class="frame" style="width:' + w.toFixed(1) + '%;height:' + h.toFixed(1) + '%">' + slotImg(pic) + '</span>';
    }
    return '<div class="room' + (interactive ? '' : ' mini') + (blend ? ' blend' : '') + '" style="' + style + '">' +
      slot('wall', '', wallLabel) +
      '<div class="trim" aria-hidden="true"></div>' +
      '<div class="floorwrap" aria-hidden="true">' + floorHTML + '<div class="floorshade"></div></div>' +
      '<div class="skirt" aria-hidden="true"></div>' +
      slot('floor', '', floor ? nameLine(floor) : 'empty') +
      slot('window', win ? '<span class="win">' + slotImg(win) + '</span>' : '', win ? nameLine(win) : 'empty') +
      slot('picture', picInner, pic ? nameLine(pic) : 'empty') +
      slot('object', obj ? '<span class="obj">' + slotImg(obj) + '</span>' : '', obj ? nameLine(obj) : 'empty') +
      '</div>';
  }

  function roomWords(set, st) {
    const get = (s) => (set && set[s] ? cardOf(set[s], st) : null);
    return SLOTS.map((s) => {
      const c = get(s);
      let t;
      if (!c) { const kd = KIND_LABEL[F.SLOTS[s]]; t = 'Empty. Keep ' + (/^[aeiou]/i.test(kd) ? 'an ' : 'a ') + kd + ' to fill this.'; }
      else if (s === 'wall') { const w = uniq((c.colours || []).filter(isHex).map((h) => F.colourName(h))); t = (w[0] || 'plain') + ' walls' + (w[1] ? ', ' + w[1] + ' trim' : '') + (w[2] ? ', ' + w[2] + ' skirting' : '') + (c.own ? ' (the colours of your ' + (c.title || 'thing') + ')' : c.kind === 'colour' ? ' (the colours of ' + nameLineShort(c) + ')' : ' (from ' + nameLineShort(c) + ')'); }
      else if (s === 'floor') t = (c.own ? 'a detail of ' : '') + nameLineShort(c) + ', tiled';
      else t = nameLineShort(c);
      return '<li><b>' + SLOT_LABEL[s] + '</b><span>' + esc(t) + (c ? ' ' + whereBtn(c, 'linkbtn') : '') + '</span></li>';
    }).join('');
  }

  function renderSet() {
    const el = $('#view-set');
    if (!deck) { notReady(el); return; }
    const st = active();
    const ro = readOnly();
    ensureRoom(st);
    const filled = SLOTS.some((s) => ui.room[s]);
    let html = '<div class="wrap wrap-narrow"><div class="view-head"><h1 class="h1" tabindex="-1">Set</h1>' +
      '<p class="lede">Put your parts together. Every place in the room offers three; choose one.</p>' +
      (hasContent(st) ? '' : '<div class="actions">' + exampleButton(st) + '</div>') + '</div>';
    if (!filled) html += emptyBox('Your room is built from what you keep: a Colour for the wall, a Space for the window, an Image for the picture, a Surface for the floor and an Object to stand in it.', false);
    html += '<section class="sec" aria-labelledby="room-h"><h2 class="visually-hidden" id="room-h">The room</h2>' + roomHTML(ui.room, st, true) +
      '<ul class="room-key">' + roomWords(ui.room, st) + '</ul></section>';
    if (!ro) {
      html += '<div class="set-actions"><button type="button" class="btn btn-keep btn-big" data-act="pin" aria-haspopup="dialog"' + (filled ? '' : ' disabled') + '>Pin this set</button>' +
        '<span class="small">Press any part of the room to choose another.</span></div>';
    } else html += '<p class="small">Press any part of the room to see what else this example kept.</p>';
    const sets = st.sets.map((s, i) => ({ s, i })).reverse();
    html += sec('Pinned sets', sets.length || null, sets.length
      ? '<ul class="pinned">' + sets.map(({ s, i }) => {
        const confirm = ui.confirm === 'set:' + i;
        return '<li>' + roomHTML(s, st, false) + '<p class="name">' + esc(s.name || 'Untitled set') + '</p><p class="when">' + esc(fmtDate(s.at)) + '</p>' +
          (confirm
            ? '<div class="confirm" role="group" aria-label="Remove this set?"><span>Remove this set?</span><button type="button" class="btn btn-quiet" data-act="unpin" data-i="' + i + '">Remove</button><button type="button" class="btn btn-quiet" data-act="confirm-no">Keep it</button></div>'
            : '<div class="row"><button type="button" class="btn btn-quiet" data-act="open-set" data-i="' + i + '">Open</button>' +
              (ro ? '' : '<button type="button" class="btn btn-quiet" data-act="confirm" data-key="set:' + i + '">Remove</button>') + '</div>') + '</li>';
      }).join('') + '</ul>'
      : emptyBox('Pin a room you like and say what it’s for. Your pinned sets wait here.'));
    html += '</div>';
    el.innerHTML = html;
  }

  // ================================================================ SEE

  function summarySentence(P) {
    if (!P.judged) return 'Nothing judged yet. Sort a five and your taste starts to show.';
    const t = P.turns.length;
    return 'You kept ' + P.kept + ' of ' + P.judged + '. You decide in ' + secs(P.medianMs) + ' seconds. ' + (t ? plural(t, 'turn') + '.' : 'No turns yet.');
  }

  function noteAbout(n, st) {
    if (!n.ref) return { th: '', text: '' };
    if (n.ref.indexOf('set:') === 0) {
      const s = st.sets.find((x) => String(x.at) === n.ref.slice(4));
      // The answer to "What is this set for?" is usually the set's name: don't say it twice.
      return { th: '', text: s && s.name && s.name !== n.text ? 'Set: ' + s.name : s ? 'A set you pinned' : 'A set you removed' };
    }
    const c = cardOf(n.ref, st);
    if (!c) return { th: '', text: '' };
    return { th: '<button type="button" class="tilebtn" data-act="detail" data-id="' + esc(c.id) + '" aria-haspopup="dialog" aria-label="' + esc('About: ' + nameLine(c)) + '">' + thumbHTML(c, 'work') + '</button>', text: nameLine(c) };
  }

  function renderSee() {
    const el = $('#view-see');
    if (!deck) { notReady(el); return; }
    const st = active();
    const P = prof(st);
    const ro = readOnly();
    let html = '<div class="wrap"><div class="view-head"><h1 class="h1" tabindex="-1">See</h1><p class="summaryline">' + esc(summarySentence(P)) + '</p>' +
      (hasContent(st) ? '' : '<div class="actions">' + exampleButton(st) + '</div>') + '</div>';
    html += '<div class="see-grid">';
    html += sec('Positive space', P.positive.length || null, P.positive.length
      ? chipsHTML(P.positive, 'pos', 'filled') + '<p class="cap">' + icon('keep') + 'Filled: what you keep more often than you keep overall.</p>'
      : emptyBox('What you keep most will fill this in, once a feature has come up three times.'));
    html += sec('Negative space', P.negative.length || null, (P.negative.length
      ? chipsHTML(P.negative, 'neg', 'hollow', 'passed') + '<p class="cap">' + icon('pass') + 'Hollow: what you pass more often than you pass overall.</p>'
      : emptyBox('What you pass most will outline itself here.')) + '<p class="sec-note">What you pass shapes you as much as what you keep.</p>');
    // colour field
    const kc = P.keptColours, pc = P.passedColours;
    html += sec('Colour field', null, (kc.length || pc.length)
      ? '<div class="field2"><div>' + (kc.length ? '<ul class="mosaic" aria-label="' + esc('Kept colours: ' + listWords(uniq(kc.map((h) => F.colourName(h))).slice(0, 12))) + '">' + kc.map((h) => '<li style="--c:' + h + '"></li>').join('') + '</ul>' : '') +
        '<p class="cap">' + icon('keep') + 'Kept, solid · ' + kc.length + '</p></div>' +
        '<div>' + (pc.length ? '<ul class="mosaic hollow" aria-label="' + esc('Passed colours: ' + listWords(uniq(pc.map((h) => F.colourName(h))).slice(0, 12))) + '">' + pc.map((h) => '<li style="--c:' + h + '"></li>').join('') + '</ul>' : '') +
        (pc.length ? '' : '<p class="small">Nothing passed yet.</p>') +
        '<p class="cap">' + icon('pass') + 'Passed, hollow · ' + pc.length + '</p></div></div>'
      : emptyBox('Your kept colours as a solid field, your passed colours as a hollow one.'), 'span2');
    // turns
    html += sec('Turns', P.turns.length || null, (P.turns.length
      ? '<ul class="turns">' + P.turns.map((t) => {
        const c = cardOf(t.card, st);
        const title = c ? shortTitle(c.title) : 'a work';
        return '<li><button type="button" class="rowbtn" data-act="detail" data-id="' + esc(t.card) + '" aria-haspopup="dialog">' + thumbHTML(c, 'work') +
          '<span class="t">' + esc(turnSentence(t.dir, t.because, '“' + title + '”')) + '</span><span class="r">' + esc(fmtDate(t.at)) + '</span></button></li>';
      }).join('') + '</ul>'
      : emptyBox('No turns yet. A turn comes once you have a pattern to go against.')) +
      '<p class="sec-note">A turn is where you went against your own pattern. That’s where taste changes.</p>');
    // drift
    if (P.drift && (P.drift.then.length || P.drift.now.length)) {
      const col = (xs) => '<ul class="chips">' + xs.map((e) => '<li class="chip">' + esc(chipLabel(e)) + '</li>').join('') + '</ul>';
      html += sec('Drift', null, '<div class="drift"><div><p class="small">Your first third</p>' + col(P.drift.then) + '</div><span class="arrow" aria-label="then">' + icon('right') + '</span><div><p class="small">Your last third</p>' + col(P.drift.now) + '</div></div>');
    }
    // notes
    const notes = st.notes.map((n, i) => ({ n, i })).reverse();
    html += sec('Your notes', notes.length || null, '<p class="sec-note">Your own words, next to your judgments.</p>' +
      (notes.length ? '<ul class="notes">' + notes.map(({ n, i }) => {
        const ab = noteAbout(n, st);
        const confirm = ui.confirm === 'note:' + i;
        return '<li class="note"><p class="q">' + esc(NOTE_Q[n.q] || NOTE_Q.free) + '</p><p class="a">' + esc(n.text) + '</p>' +
          '<p class="meta"><span>' + esc(fmtDate(n.at)) + '</span>' + (ab.text ? '<span>' + esc(ab.text) + '</span>' : '') + '</p>' +
          '<div class="side">' + ab.th + (ro || confirm ? '' : '<button type="button" class="linkbtn" data-act="confirm" data-key="note:' + i + '" aria-label="Remove this note">Remove</button>') + '</div>' +
          (confirm ? '<div class="confirm" role="group" aria-label="Remove this note?"><span>Remove this note?</span><button type="button" class="btn btn-quiet" data-act="del-note" data-i="' + i + '">Remove</button><button type="button" class="btn btn-quiet" data-act="confirm-no">Keep it</button></div>' : '') +
          '</li>';
      }).join('') + '</ul>' : emptyBox('Notes you write at a turn, after a five, for a set or for something you bring in collect here.')) +
      (ro ? '' : '<div class="row-gap"><button type="button" class="btn" data-act="note-free" aria-haspopup="dialog">' + icon('plus') + 'Write a note</button></div>'), 'span2');
    // philosophy
    const lines = F.philosophy(P, deck);
    const cl = ui.claude;
    const canAsk = !!ui.sample && !cl.hidden && !ro && P.judged - P.brought >= 10;
    html += sec('Your philosophy', null, '<ul class="philo">' + lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>' +
      (canAsk ? '<div class="row-gap">' + (cl.busy
        ? '<button type="button" class="btn" data-act="claude-stop">Stop</button>'
        : '<button type="button" class="btn btn-iris" data-act="claude">Ask Claude to write it</button>') + '</div>' : '') +
      ((cl.busy || cl.text || cl.status) && !cl.hidden && !ro
        ? '<div class="claude-out"><p class="by">Written by Claude from your judgments and notes</p><p class="text" id="claude-text">' + esc(cl.text || (cl.busy ? 'Thinking…' : '')) + '</p>' +
          (cl.status ? '<p class="small" id="claude-status">' + esc(cl.status) + '</p>' : '') + '</div>'
        : ''), 'span2');
    html += '</div></div>';
    el.innerHTML = html;
  }

  function claudePrompt(st, P) {
    const data = {
      judged: P.judged, kept: P.kept, passed: P.passed, keepRate: P.keepRate,
      medianSecondsToDecide: Number(secs(P.medianMs)), speed: P.speed,
      keepsMoreOften: P.positive.map((e) => chipLabel(e) + ' (kept ' + e.kept + ' of ' + e.n + ')'),
      passesMoreOften: P.negative.map((e) => chipLabel(e) + ' (kept ' + e.kept + ' of ' + e.n + ')'),
      turns: P.turns.slice(0, 8).map((t) => {
        const c = cardOf(t.card, st);
        return {
          work: c ? c.title + (c.artist ? ' by ' + c.artist : '') : null,
          what: t.dir > 0 ? 'kept it though the pattern said pass' : 'passed it though the pattern said keep',
          pattern: t.because.map((b) => chipLabel(b) + ' (kept ' + b.kept + ' of ' + b.n + ' before)'),
        };
      }),
      drift: P.drift ? { atFirst: P.drift.then.map(chipLabel), lately: P.drift.now.map(chipLabel) } : null,
      keptColours: uniq(P.keptColours.map((h) => F.colourName(h))).slice(0, 14),
      broughtInOfTheirOwn: P.brought, letGo: P.letGo,
      sources: P.sources.map((s) => s.source + ': ' + s.n),
      pinnedSets: st.sets.map((s) => s.name).filter(Boolean),
    };
    const notes = st.notes.map((n) => ({ question: NOTE_Q[n.q] || NOTE_Q.free, answer: n.text }));
    return 'Write a short piece, 5 to 7 sentences, to one person about how they go about things, from their own aesthetic judgments in an app called 5s. ' +
      'They sorted cards from an artist\'s database of saved works (keep or pass, a few seconds each) and brought in some saved things of their own.\n\n' +
      'Rules: second person ("you"). Plain, specific sentences that a friend who looked closely would say. It is a map of how they decide, not a horoscope: ' +
      'no flattery, no mysticism, no predictions, no advice lists, no headings, no bullet points. Name their turns (the works where they went against their own pattern) by title. ' +
      'Use their own words from the notes where they fit. Say only what the data supports.\n\n' +
      'Their judgments, summarised:\n' + JSON.stringify(data, null, 1) + '\n\nTheir notes:\n' + JSON.stringify(notes, null, 1);
  }

  function claudeCopy(code) {
    switch (code) {
      case 'rate_limited': return 'Claude is busy for you right now. Try again in a minute.';
      case 'session_expired': return 'Your session has ended. Reload the page and try again.';
      case 'sampling_disabled': return 'Asking Claude is turned off here.';
      case 'refused': return 'Claude didn’t write this one.';
      case 'prompt_too_large': return 'There’s too much to send. Remove a few notes and try again.';
      case 'empty_completion': return 'Claude sent back nothing. Try again.';
      default: return 'Couldn’t reach Claude just now. Try again in a moment.';
    }
  }

  async function askClaude() {
    const sample = ui.sample;
    const cl = ui.claude;
    if (!sample || cl.busy) return;
    const st = S;
    const P = prof(st);
    const ctl = new AbortController();
    cl.busy = true; cl.text = ''; cl.status = ''; cl.ctl = ctl;
    renderSee();
    const stopBtn = $('[data-act="claude-stop"]');
    if (stopBtn) stopBtn.focus();
    say('Asking Claude. Thinking…');
    try {
      const r = await sample(claudePrompt(st, P), {
        signal: ctl.signal,
        onText: (u) => { cl.text = u && typeof u.text === 'string' ? u.text : cl.text; const t = $('#claude-text'); if (t) t.textContent = cl.text; },
      });
      if (r && typeof r.text === 'string') cl.text = r.text;
      cl.status = r && r.truncated ? 'Cut short.' : '';
      say('Claude has written it.');
    } catch (e) {
      const code = e && e.code;
      if (e && typeof e.text === 'string' && e.text) cl.text = e.text;
      if (code === 'not_granted' || code === 'sampling_disabled') { cl.hidden = true; cl.text = ''; }
      else if (code === 'refused') { cl.text = ''; cl.status = claudeCopy(code); }
      else if (code === 'cancelled') cl.status = 'Stopped.';
      else cl.status = claudeCopy(code);
      if (!cl.hidden) say(cl.status);
    }
    cl.busy = false; cl.ctl = null;
    if (view === 'see') {
      const had = doc.activeElement && doc.activeElement.getAttribute('data-act') === 'claude-stop';
      renderSee();
      if (had) { const b = $('[data-act="claude"]'); if (b) b.focus(); }
    }
  }

  // ================================================================ SEED

  function groundSize(judged) { return judged < 20 ? 7 : judged < 50 ? 9 : judged < 100 ? 11 : 13; }

  function latestHouse(st) {
    const s = st.sets[st.sets.length - 1];
    if (!s || !s.wall) return null;
    const c = cardOf(s.wall, st);
    const cs = c ? (c.colours || []).filter(isHex) : [];
    if (!cs.length) return null;
    return { set: s, house: { wall: cs[0], trim: cs[1] || cs[0], accent: cs[2] || cs[1] || cs[0] } };
  }

  function renderSeed() {
    const el = $('#view-seed');
    if (!deck) { notReady(el); return; }
    const st = active();
    const P = prof(st);
    const ro = readOnly();
    const code = F.seedCode(st);
    let html = '<div class="wrap wrap-narrow"><div class="view-head"><h1 class="h1" tabindex="-1">Seed</h1><p class="lede">Your ground, grown from your judgments.</p></div>';
    if (!P.judged) {
      html += emptyBox('Your ground grows from what you keep and pass. Sort a five and it starts.', true) + '</div>';
      el.innerHTML = html;
      ui.seedKey = null;
      return;
    }
    html += '<section class="sec" aria-labelledby="code-h"><h2 class="sec-title" id="code-h">Seed code</h2><div class="code-row"><p class="code" id="seed-code">' + esc(code) + '</p>' +
      '<button type="button" class="btn btn-quiet" data-act="copy-code">Copy code</button></div>' +
      '<p class="small">The same judgments always give the same code and the same ground.</p></section>';
    html += '<section class="sec" aria-labelledby="ground-h"><h2 class="sec-title" id="ground-h">Your ground</h2>' +
      '<div class="ground-box"><canvas class="ground" id="ground" role="img" aria-label="Your ground, being drawn."></canvas></div>' +
      '<p class="ground-words" id="ground-words">Drawing your ground…</p></section>';
    if (!ro) {
      html += '<section class="sec" aria-labelledby="take-h"><h2 class="sec-title" id="take-h">Take your seed</h2><div class="row-gap">' +
        (ui.downloads ? '<button type="button" class="btn btn-keep btn-big" data-act="save-seed">Save your seed</button>' : '') +
        '<button type="button" class="btn btn-big" data-act="copy-seed">Copy seed</button></div>' +
        '<p class="small" id="seed-status">' + esc(ui.seedSave) + '</p>' +
        (ui.copyOpen ? '<label class="field"><span>Your seed, selected. Copy it from here.</span><textarea class="seedjson" id="seed-json" readonly></textarea></label>' : '') +
        '</section>';
    } else html += '<p class="small">Back to yours to take your own seed.</p>';
    html += '<p class="privacy">Your seed holds no name, no email, no card. Only what you kept, passed and set.</p>' +
      '<p class="privacy">Holographic Mr Pearl builds worlds from a person’s information. This seed is yours, ready for it.</p>' +
      hubCardHTML() + '</div>';
    el.innerHTML = html;
    if (ui.copyOpen) {
      const ta = $('#seed-json');
      if (ta) { ta.value = JSON.stringify(F.exportSeed(S, deck, now()), null, 2); }
    }
    ui.seedKey = null;
    drawGround();
    const cv = $('#ground');
    if (cv && window.ResizeObserver) {
      if (ui.seedRO) ui.seedRO.disconnect();
      ui.seedRO = new ResizeObserver(() => { clearTimeout(ui.seedT); ui.seedT = setTimeout(() => drawGround(), 200); });
      ui.seedRO.observe(cv);
    }
  }

  async function drawGround(force) {
    const cv = $('#ground');
    if (!cv || !G || view !== 'seed') return;
    const st = active();
    const P = prof(st);
    const code = F.seedCode(st);
    const theme = currentTheme();
    const key = code + '|' + theme + '|' + cv.clientWidth + '|' + (example ? 'ex' : 'me');
    if (!force && key === ui.seedKey) return;
    ui.seedKey = key;
    const surfaces = [];
    for (const id of P.keptByKind.surface) { const c = cardOf(id, st); if (c && c.img) surfaces.push({ src: c.img, crop: null }); }
    for (const o of st.own) {
      if (o.let != null || !Array.isArray(o.crop)) continue;
      let src = null;
      if (o.imgFrom) { const d = deckCard(o.imgFrom); src = d && d.img; }
      else if (imgStore) { try { const v = await imgStore.get(o.id); src = v && v.img; } catch (e) { src = null; } }
      if (src) surfaces.push({ src, crop: o.crop });
    }
    if (ui.seedKey !== key) return;
    const h = latestHouse(st);
    const grow = !ui.seedGrown && !reduced();
    ui.seedGrown = true;
    let res;
    try {
      res = await G.render(cv, {
        rand: F.prng(code), surfaces, kept: P.keptColours, passed: P.passedColours,
        house: h ? h.house : null, size: groundSize(P.judged), grow, theme,
      });
    } catch (e) { res = null; }
    if (ui.seedKey !== key || !res) return;
    let words = res.description || '';
    if (h) words += ' The house is your latest set' + (h.set.name ? ', “' + h.set.name + '”' : '') + '.';
    cv.setAttribute('aria-label', words);
    const w = $('#ground-words');
    if (w) w.textContent = words;
  }

  function takeSeed() {
    if (example) return;
    if (!S.seen.seed) commit(F.markSeen(S, 'seed'), { noRender: true });
  }

  async function saveSeed() {
    const d = ui.downloads;
    if (!d || readOnly()) return;
    const seed = F.exportSeed(S, deck, now());
    try {
      await d.save({ filename: '5s-seed-' + seed.code + '.json', data: JSON.stringify(seed, null, 2) });
      ui.seedSave = 'Seed saved.';
      takeSeed();
      say('Seed saved.');
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') ui.seedSave = '';
      else if (code === 'rate_limited') ui.seedSave = 'Another save is waiting. Try again in a moment.';
      else if (['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].indexOf(code) >= 0 || !code) { ui.downloads = null; ui.seedSave = 'Saving isn’t available here. Use Copy seed.'; }
      else ui.seedSave = 'Couldn’t save the seed. Use Copy seed instead.';
      if (ui.seedSave) say(ui.seedSave);
    }
    if (view === 'seed') { const s = $('#seed-status'); if (s) s.textContent = ui.seedSave; if (!ui.downloads) { const b = $('[data-act="save-seed"]'); if (b) b.remove(); } }
  }

  function copySeed() {
    if (readOnly()) return;
    const text = JSON.stringify(F.exportSeed(S, deck, now()), null, 2);
    const fallback = () => {
      ui.copyOpen = true;
      ui.seedSave = 'Copy it from the box below.';
      renderSeed();
      const ta = $('#seed-json');
      if (ta) { ta.focus(); ta.select(); ta.addEventListener('copy', () => { takeSeed(); say('Seed copied.'); }, { once: true }); }
    };
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
      navigator.clipboard.writeText(text).then(() => {
        ui.seedSave = 'Seed copied.';
        takeSeed();
        const s = $('#seed-status'); if (s) s.textContent = ui.seedSave;
        say('Seed copied.');
      }, fallback);
    } catch (e) { fallback(); }
  }

  function copyCode() {
    const code = F.seedCode(active());
    const done = () => say('Code copied: ' + code.split('').join(' ') + '.');
    try {
      navigator.clipboard.writeText(code).then(done, () => {
        const el = $('#seed-code');
        if (el) { const r = doc.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        say('Select the code and copy it.');
      });
    } catch (e) { say('Select the code and copy it.'); }
  }

  // ================================================================ SHEETS

  const dlg = $('#sheet');

  function openSheet(kind, title, render, opener, opts) {
    const wasOpen = dlg.open;
    ui.sheet = kind;
    ui.sheetTitle = title;
    ui.sheetRender = render;
    if (!wasOpen) {
      ui.opener = opener || doc.activeElement;
      ui.openerSig = sigOf(ui.opener);
    }
    $('#sheet-title').textContent = title;
    $('#sheet-body').innerHTML = safeRender(render, title);
    dlg.classList.toggle('wide', !!(opts && opts.wide));
    if (!wasOpen) { try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); dlg.classList.add('fallback'); problem('The panel opened another way (' + errText(e) + ').'); } }
    $('#sheet-body').scrollTop = 0;
    const af = $('[data-autofocus]', dlg);
    try { (af || $('.sheet-head .iconbtn', dlg)).focus(); } catch (e) { /* focus is a nicety */ }
    try { hydrate(dlg); } catch (e) { problem(errText(e)); }
    if (!wasOpen) requestAnimationFrame(keepSheetOnScreen);
  }

  // A panel never opens empty or out of sight: what failed is said in it, and one that lands off the
  // screen (some phone browsers place a modal panel differently) is moved back into view.
  function safeRender(render, title) {
    try { return render(); } catch (e) {
      problem(errText(e));
      return '<p class="err" role="alert">' + esc((title || 'This') + ' didn’t open properly. Close it and try again.') + '</p>' +
        '<p class="small">What went wrong: ' + esc(errText(e)) + '</p>';
    }
  }
  function keepSheetOnScreen() {
    if (!dlg.open) return;
    const r = dlg.getBoundingClientRect();
    const vh = window.innerHeight || doc.documentElement.clientHeight;
    if (r.height < 40 || r.bottom <= 8 || r.top >= vh - 8) {
      dlg.classList.add('fallback');
      const r2 = dlg.getBoundingClientRect();
      if (r2.height < 40 || r2.bottom <= 8 || r2.top >= vh - 8) problem('The panel opened out of sight (' + [r.top, r.bottom, r.height, vh].map(Math.round).join(', ') + ').');
    }
  }
  function errText(e) { return String((e && (e.message || e.name)) || e || 'unknown').slice(0, 200); }
  // A small, closable line at the top of the page, so a screenshot shows what broke on a device we can't see.
  const problemsSeen = new Set();
  function problem(text) {
    try {
      const t = String(text || '').slice(0, 240);
      if (!t || problemsSeen.has(t)) return;
      problemsSeen.add(t);
      let bar = doc.getElementById('problem');
      if (!bar) {
        bar = doc.createElement('div');
        bar.id = 'problem'; bar.className = 'problem'; bar.setAttribute('role', 'alert');
        bar.innerHTML = '<p></p><button type="button" class="linkbtn" aria-label="Close this note">Close</button>';
        bar.querySelector('button').addEventListener('click', () => { bar.hidden = true; });
        doc.body.appendChild(bar);
      }
      bar.querySelector('p').textContent = '5s hit a problem: ' + t + ' A screenshot of this helps fix it.';
      bar.hidden = false;
    } catch (e) { /* the note itself must never break the page */ }
  }
  window.addEventListener('error', (e) => { if (e && (e.message || e.error)) problem(errText(e.error || e)); });
  window.addEventListener('unhandledrejection', (e) => { if (e && e.reason) problem(errText(e.reason)); });

  function refreshSheet() {
    if (!dlg.open || !ui.sheetRender) return;
    const ae = doc.activeElement;
    const id = ae && dlg.contains(ae) ? ae.id || null : null;
    const act = ae && dlg.contains(ae) ? ae.getAttribute('data-act') : null;
    $('#sheet-title').textContent = ui.sheetTitle;
    $('#sheet-body').innerHTML = safeRender(ui.sheetRender, ui.sheetTitle);
    try { hydrate(dlg); } catch (e) { problem(errText(e)); }
    let back = id ? doc.getElementById(id) : null;
    if (!back && act) back = $('[data-act="' + act + '"]', dlg);
    if (!back) back = $('[data-autofocus]', dlg) || $('.sheet-head .iconbtn', dlg);
    if (back) back.focus({ preventScroll: true });
  }

  function closeSheet() { if (dlg.open) dlg.close(); }

  // A selector that finds a control again after its view is redrawn.
  function sigOf(el) {
    if (!el || !el.getAttribute) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    const act = el.getAttribute('data-act');
    if (!act) return null;
    let q = '[data-act="' + act + '"]';
    for (const a of ['data-id', 'data-slot', 'data-key', 'data-view']) { const v = el.getAttribute(a); if (v) q += '[' + a + '="' + CSS.escape(v) + '"]'; }
    return '#main ' + q;
  }

  dlg.addEventListener('close', () => {
    // The close event comes a task later; if another sheet opened in between, it is that sheet's now.
    if (dlg.open) return;
    const kind = ui.sheet;
    ui.sheet = null; ui.sheetRender = null; ui.noteCtx = null; ui.removeAsk = false; ui.sheetMsg = ''; ui.detailBack = null;
    $('#sheet-body').innerHTML = '';
    let o = ui.opener;
    const sig = ui.openerSig;
    ui.opener = null; ui.openerSig = null;
    // The view may have been redrawn while the sheet was open: find the same control again.
    if ((!o || !o.isConnected) && sig) { try { o = $(sig); } catch (e) { o = null; } }
    if (o && o.isConnected && !o.closest('[hidden]')) o.focus({ preventScroll: true });
    else { const h = $('#view-' + view + ' h1'); if (h) h.focus({ preventScroll: true }); }
    if (kind === 'closer' || kind === 'detail') { ui.shownAt = ui.shownAt || performance.now(); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSheet(); });
  dlg.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg)
      .filter((x) => x.offsetParent !== null || x === doc.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // -- Path

  function openPath(opener) {
    openSheet('path', 'The Path', () => {
      const items = F.path(S, deck, now());
      const done = items.filter((m) => m.done).length;
      return '<p class="lede">The month the artist spent organizing a digital aesthetic, as eight steps, then four for your hub. ' + done + ' of ' + items.length + ' done.</p>' +
        '<ol class="path">' + items.map((m, i) => {
          const cls = m.done ? 'done' : m.next ? 'next' : 'notyet';
          const word = m.done ? 'Done' : m.next ? 'Next' : 'Not yet';
          const v = m.step.toLowerCase();
          const hubKey = HUB_KEYS.indexOf(m.key) >= 0;
          return '<li class="' + cls + '"><span class="mk" aria-hidden="true">' + (i + 1) + '</span>' +
            '<p class="lbl"><span>' + esc(m.label) + '</span><span class="state">' + word + '</span></p>' +
            '<p class="why">' + esc(hubKey ? hubWords(m.why) : m.why) + '</p>' +
            '<p class="step">In ' + esc(m.step) + (hubKey ? ', under Your hub' : '') + '</p>' +
            (m.next ? '<button type="button" class="btn btn-quiet go" data-act="goto" data-view="' + esc(v) + '"' + (hubKey ? ' data-focus="hub-h"' : '') + '>Go to ' + esc(m.step) + '</button>' : '') + '</li>';
        }).join('') + '</ol>';
    }, opener);
  }

  // -- About

  function openAbout(opener) {
    openSheet('about', 'About 5s', () => {
      const on = S.opts.ring !== false;
      return '<div class="about" style="display:grid;gap:14px">' +
        '<p>5s is five quick judgments a day. They build your own aesthetic database, which you split into parts, set into rooms, see as a whole and grow into a world.</p>' +
        '<p>The cards come from an artist’s database of saved works. What you bring in is yours.</p>' +
        '<ul><li>Drag right or press Keep (→) for what you like; drag left or press Pass (←) for the rest.</li>' +
        '<li>Names come after you decide. Enter or Space looks closer; U undoes.</li>' +
        '<li>Five cards a round, one of each kind: Image, Object, Space, Surface, Colour.</li></ul>' +
        '<p>No account details. Only your judgments.</p>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-act="ring" id="ring-switch">' +
          '<span><b>Five-second ring</b><br><span class="small">A soft ring around the counter. It never makes you choose.</span></span><span class="track" aria-hidden="true"></span></button>' +
        '<div class="actions"><button type="button" class="btn" data-act="replay-intro">Show the welcome card again</button></div>' +
        '</div>';
    }, opener);
  }

  // -- Notes

  function openNote(ctx, opener) {
    ui.noteCtx = ctx;
    const c = ctx.ref && ctx.ref.indexOf('set:') !== 0 ? cardOf(ctx.ref, S) : null;
    openSheet('note', ctx.q === 'turn' ? 'Note why' : 'Write a note', () =>
      '<form class="field" data-form="note" style="gap:12px">' +
        (c ? '<p class="small">About: ' + esc(nameLine(c)) + '</p>' : '') +
        '<label for="note-text" style="font:500 18px/1.35 var(--font-body)">' + esc(NOTE_Q[ctx.q] || NOTE_Q.free) + '</label>' +
        '<textarea id="note-text" maxlength="500" data-autofocus></textarea>' +
        '<div class="actions"><button type="submit" class="btn btn-ink">Save note</button><button type="button" class="btn" data-act="close-sheet">Cancel</button></div>' +
      '</form>', opener);
  }

  // -- Pin

  function openPin(opener) {
    openSheet('pin', 'Pin this set', () =>
      '<form class="field" data-form="pin" style="gap:12px">' +
        '<label for="pin-name" style="font:500 18px/1.35 var(--font-body)">What is this set for?</label>' +
        '<input type="text" id="pin-name" maxlength="80" autocomplete="off" placeholder="A room for slow mornings" data-autofocus>' +
        '<p class="small">One line, the way you’d say what a room is for. You can leave it blank.</p>' +
        '<div class="actions"><button type="submit" class="btn btn-keep">Pin</button><button type="button" class="btn" data-act="close-sheet">Cancel</button></div>' +
      '</form>', opener);
  }

  // -- Look closer (before the judgment: no names)

  function openCloser(opener) {
    const id = F.currentCard(S);
    const c = id && cardOf(id, S);
    if (!c) return;
    openSheet('closer', 'Look closer', () => {
      let art;
      if (c.kind === 'colour') art = bandsHTML(c.colours);
      else if (c.own) art = slotImg(c);
      else art = c.img ? '<img src="' + esc(c.img) + '" alt="">' : '';
      return '<div class="detail-art' + (c.kind === 'surface' ? ' full' : '') + '" style="--cbg:' + esc(c.colours[0] || '') + '" role="img" aria-label="' + esc(describeBefore(c)) + '">' + art + '</div>' +
        '<p>' + esc(describeBefore(c)) + '</p><p class="small">Names come after you decide.</p>' +
        '<div class="actions"><button type="button" class="btn btn-pass btn-big" data-act="closer-pass">' + icon('left') + (c.own ? 'Let go' : 'Pass') + '</button>' +
        '<button type="button" class="btn btn-keep btn-big" data-act="closer-keep">Keep' + icon('right') + '</button></div>';
    }, opener, { wide: true });
  }

  // -- Detail (after the judgment)

  function openDetail(id, opener, where) {
    const st = active();
    const c = cardOf(id, st);
    if (!c) return;
    // Opened from inside another sheet (the Set chooser, Paste a link): a way back to it.
    ui.detailBack = !dlg.open ? null : ui.sheet === 'chooser' ? { act: 'chooser', slot: ui.chooserSlot, label: 'Back to the three' }
      : ui.sheet === 'connect' ? { act: 'paste', label: 'Back to Paste a link' } : ui.sheet === 'detail' ? ui.detailBack : null;
    ui.detailId = id;
    ui.removeAsk = false;
    ui.sheetMsg = '';
    openSheet('detail', c.own ? (c.title || 'Untitled') : (c.title || 'Untitled'), () => detailHTML(id), opener, { wide: true });
    const h = where && $('#where-h');
    if (h) { h.focus(); h.scrollIntoView({ block: 'start' }); }
  }

  // -- Where it lives (links out: the artist, 22 Oct 2026, "copy something that I find in the 5s app that
  // I want to learn more about through another platform that hosts that actual object")

  function whereLinks(c) {
    if (!LK || !c) return [];
    try { return LK.whereItLives(c, deck); } catch (e) { return []; }
  }
  // The one small way in, wherever an object shows (the reveal, Still yours?, the Set chooser, a set's pieces).
  function whereBtn(c, cls) {
    if (!c || !whereLinks(c).length) return '';
    return '<button type="button" class="' + cls + ' where-btn" data-act="where" data-id="' + esc(c.id) + '" aria-haspopup="dialog"' +
      (cls === 'btn' ? '' : ' aria-label="' + esc('Where it lives: ' + (c.title || 'Untitled')) + '"') + '>' + (cls === 'btn' ? icon('link') : '') + 'Where it lives</button>';
  }
  function whereHTML(c) {
    const links = whereLinks(c);
    ui.whereLinks = links;
    if (!links.length) return '';
    // Its own place first, then its styles, its maker, and the searches elsewhere.
    const groups = [['', []], ['Its styles', []], ['', []], ['Look it up elsewhere', []]];
    links.forEach((l, i) => {
      groups[l.kind === 'gene' ? 1 : l.kind === 'maker' ? 2 : l.kind === 'elsewhere' ? 3 : 0][1].push(
        '<li class="wl"><span class="wl-t"><span class="t">' + esc(l.label) + '</span><span class="u" id="wl-u' + i + '">' + esc(l.url) + '</span></span>' +
        '<a class="btn btn-quiet" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">Open<span class="visually-hidden">: ' + esc(l.label) + ' (opens in a new tab)</span></a>' +
        '<button type="button" class="btn btn-quiet" data-act="where-copy" data-i="' + i + '" aria-label="' + esc('Copy: ' + l.label) + '">Copy</button></li>');
    });
    return '<section class="where" aria-labelledby="where-h"><h3 class="where-h" id="where-h" tabindex="-1">Where it lives</h3>' +
      groups.filter((g) => g[1].length).map((g) => (g[0] ? '<h4 class="where-sub">' + g[0] + '</h4>' : '') + '<ul class="where-list">' + g[1].join('') + '</ul>').join('') +
      '<div class="actions"><button type="button" class="btn" data-act="where-all" id="where-all-btn">Copy all</button></div>' +
      '<textarea class="where-all" id="where-all" readonly rows="6" hidden aria-label="All its links">' + esc(LK.copyAll(c, deck)) + '</textarea></section>';
  }
  function whereCopy(t) {
    const l = ui.whereLinks[Number(t.getAttribute('data-i'))];
    if (l) hubCopy(l.url, $('#wl-u' + t.getAttribute('data-i')), 'The link (' + l.label + ')', t);
  }

  function detailHTML(id) {
    const st = active();
    const c = cardOf(id, st);
    if (!c) return '<p>This is no longer in your database.</p>';
    let art;
    if (c.kind === 'colour') art = bandsHTML(c.colours);
    else if (c.own) art = slotImg(c);
    else art = c.img ? '<img src="' + esc(c.img) + '" alt="">' : '';
    const e = c.own ? null : (() => { for (let i = st.j.length - 1; i >= 0; i--) if (st.j[i][0] === id) return st.j[i]; return null; })();
    const facts = [];
    if (c.own) {
      facts.push(['Kind', KIND_LABEL[c.kind]], ['From', c.source]);
      // What it is, once it has been defined (Paste a link)
      facts.push(['Maker', c.maker], ['Date', c.date], ['Medium', c.medium], ['Category', c.category], ['Era', c.era], ['Place', c.place], ['About', c.about],
        ['Styles', (c.genes || []).map((g) => F.featureLabel('gene:' + g, deck)).join(', ')], ['Materials', (c.materials || []).join(', ')]);
      facts.push(['Brought in', fmtDate(c.at)]);
      if (c.let != null) facts.push(['Let go', fmtDate(c.let)]);
    } else {
      if (String(c.title || '').length > 60) facts.push(['Title', c.title]);
      facts.push(['Artist', c.artist], ['Date', dateText(c.date)], ['Medium', mediumText(c.medium)], ['Category', c.category], ['Place', c.place], ['Era', c.era], ['Card', KIND_LABEL[c.kind] + (c.kind === 'surface' ? ' (a detail)' : c.kind === 'colour' ? ' (its three colours)' : '')]);
    }
    const notes = st.notes.filter((n) => n.ref === id);
    const b = ui.detailBack;
    let html = b ? '<button type="button" class="linkbtn back" data-act="' + b.act + '"' + (b.slot ? ' data-slot="' + esc(b.slot) + '"' : '') + '>' + icon('left') + esc(b.label) + '</button>' : '';
    html += '<div class="detail-art' + (c.kind === 'surface' ? ' full' : '') + '" style="--cbg:' + esc((c.colours || [])[0] || '') + '" role="img" aria-label="' + esc(describeAfter(c)) + '">' + art + '</div>';
    if (e) html += '<p class="verdict-line ' + (e[1] ? 'kept' : 'passed') + '">' + icon(e[1] ? 'keep' : 'pass') + (e[1] ? 'You kept this' : 'You passed this') + ' · ' + esc(fmtDate(e[3])) + (e[4] ? ' · a turn' : '') + '</p>';
    if (c.own) html += '<p class="verdict-line ' + (c.let == null ? 'kept' : 'passed') + '">' + icon(c.let == null ? 'keep' : 'letgo') + (c.let == null ? 'In your database' : 'Let go') + '</p>';
    html += '<dl class="facts">' + facts.filter((f) => f[1]).map((f) => '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>').join('') + '</dl>';
    html += '<ul class="colours-list" aria-label="Colours">' + (c.colours || []).filter(isHex).map((h) => '<li><span class="sw" style="background:' + h + '"></span>' + esc(F.colourName(h)) + ' <span class="mono">' + h.toUpperCase() + '</span></li>').join('') + '</ul>';
    if (c.coloursEstimated && (c.colours || []).length) html += '<p class="small">These colours are estimated until its picture is read.</p>';
    if (c.own) html += fromAppsHTML(ownRec(id, st));
    if (notes.length) html += '<div class="notes">' + notes.map((n) => '<div class="note"><p class="q">' + esc(NOTE_Q[n.q] || NOTE_Q.free) + '</p><p class="a">' + esc(n.text) + '</p></div>').join('') + '</div>';
    if (!c.own && c.url && /^https:\/\//.test(c.url)) html += '<div class="actions"><a class="btn" href="' + esc(c.url) + '" target="_blank" rel="noopener">View on Artsy' + icon('out') + '</a></div>';
    html += whereHTML(c);
    if (c.own && !readOnly()) {
      html += ui.removeAsk
        ? '<div class="confirm" role="group" aria-label="Remove from my database?"><span>Remove “' + esc(c.title || 'Untitled') + '” and its image? Its judgments and notes go too.</span>' +
          '<button type="button" class="btn btn-quiet" data-act="remove-own" data-id="' + esc(id) + '" id="remove-yes">Remove</button><button type="button" class="btn btn-quiet" data-act="remove-no">Keep it</button></div>'
        : '<div class="actions"><button type="button" class="btn" data-act="remove-ask" id="remove-ask">Remove from my database</button></div>';
      if (ui.sheetMsg) html += '<p class="small" role="alert">' + esc(ui.sheetMsg) + '</p>';
    }
    return html;
  }

  // -- Set chooser

  function openChooser(slot, opener) {
    ui.chooserSlot = slot;
    openSheet('chooser', SLOT_LABEL[slot], () => chooserHTML(slot), opener, { wide: true });
  }

  function chooserHTML(slot) {
    const st = active();
    const pool = F.setPool(st, deck, slot);
    const kind = KIND_LABEL[F.SLOTS[slot]];
    if (!pool.length) {
      return '<p>Keep ' + (/^[aeiou]/i.test(kind) ? 'an ' : 'a ') + esc(kind) + ' to fill this.</p><div class="actions"><button type="button" class="btn btn-keep" data-act="goto" data-view="sort">Go to Sort</button></div>';
    }
    const page = ui.chooserPage[slot] || 0;
    const ids = F.setCandidates(st, deck, slot, page);
    const pages = Math.ceil(pool.length / 3);
    const pg = ((page % pages) + pages) % pages;
    return '<p class="lede">Choose one of three' + (pool.length > 3 ? ' (' + (pg + 1) + ' of ' + pages + ')' : '') + '.</p>' +
      '<ul class="choices">' + ids.map((id) => {
        const c = cardOf(id, st);
        let th;
        if (slot === 'wall') th = '<span class="th">' + bandsHTML(c.colours) + '</span>';
        else if (slot === 'floor') th = thumbHTML(c, 'crop');
        else th = thumbHTML(c, c.own ? 'work' : 'judged');
        const t = slot === 'wall' ? listWords(colourWords(c)) : (c.title || 'Untitled');
        const s = slot === 'wall' ? (c.own ? 'from ' + c.title : (c.kind === 'colour' ? 'the colours of ' + (c.title || 'a work') : 'from ' + (c.title || 'a work'))) : (c.own ? 'Yours · ' + c.source : c.artist);
        return '<li><button type="button" class="choice" data-act="pick" data-slot="' + slot + '" data-id="' + esc(id) + '" aria-pressed="' + (ui.room && ui.room[slot] === id ? 'true' : 'false') + '">' +
          th + '<span class="t">' + esc(t) + '</span><span class="s">' + esc(s || '') + '</span></button>' + whereBtn(c, 'linkbtn') + '</li>';
      }).join('') + '</ul>' +
      '<div class="actions">' + (pool.length > 3 ? '<button type="button" class="btn" data-act="three-more" data-slot="' + slot + '">Three more</button>' : '') + '</div>';
  }

  // -- Bring in your own

  let itemSeq = 0;
  function storeWhere() {
    const k = imgStore ? imgStore.kind : 'visit';
    if (k === 'private') return 'Your images are kept privately, for you only.';
    if (k === 'device') return 'Your images are saved in this browser only.';
    return 'Your images last for this visit only.';
  }

  function openBring(opener) {
    if (readOnly()) setExample(false);
    openSheet('bring', 'Bring in your own', bringHTML, opener, { wide: true });
  }

  function bringHTML() {
    const b = ui.bring;
    const ready = b.items.filter((i) => i.status === 'ready').length;
    const reading = b.items.filter((i) => i.status === 'reading').length;
    return '<p class="lede">Bring in things you’ve saved elsewhere: photos, screenshots, pins, saves. They stay private to you.</p>' +
      '<div class="drop" id="drop">' +
        '<p>Drop images here, paste one, or</p>' +
        '<label class="btn btn-ink" for="bring-file" id="bring-pick">' + icon('plus') + 'Choose images</label>' +
        '<input type="file" id="bring-file" accept="image/*" multiple class="visually-hidden">' +
        '<p class="where">' + esc(storeWhere()) + ' Nothing is uploaded anywhere else.</p>' +
      '</div>' +
      '<ul class="items" id="bring-items">' + b.items.map(itemHTML).join('') + '</ul>' +
      '<p class="progress" id="bring-progress">' + esc(b.msg || (reading ? 'Reading ' + plural(reading, 'image') + '…' : '')) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-keep btn-big" data-act="bring-add" id="bring-add"' + (ready && !b.adding ? '' : ' disabled') + '>' +
        (b.adding ? 'Adding…' : 'Add to my database' + (ready > 1 ? ' (' + ready + ')' : '')) + '</button></div>';
  }

  function itemHTML(it) {
    const k = esc(it.key);
    let th = '<span class="th"></span>';
    if (it.data) th = '<span class="th" style="background-color:' + esc(it.data.colours[0] || '') + '"><img src="' + esc(it.data.thumb) + '" alt=""></span>';
    let body = '<div class="top"><span class="fname">' + esc(it.fname) + '</span><button type="button" class="linkbtn" data-act="bring-drop" data-key="' + k + '" aria-label="' + esc('Remove ' + it.fname + ' from this list') + '">Remove</button></div>';
    if (it.status === 'reading') body += '<p class="state">Reading…</p>';
    else if (it.status === 'error' && !it.data) body += '<p class="err">' + esc(it.error) + '</p>';
    else {
      body +=
        '<fieldset class="fieldset-seg"><legend>Kind</legend><div class="seg">' + OWN_KINDS.map((kd) =>
          '<label' + (it.kind === kd ? ' class="on"' : '') + '><input type="radio" name="kind-' + k + '" value="' + kd + '" data-key="' + k + '" data-field="kind"' + (it.kind === kd ? ' checked' : '') + '>' + KIND_LABEL[kd] + '</label>').join('') + '</div></fieldset>' +
        '<label class="field"><span>From</span><select id="from-' + k + '" data-key="' + k + '" data-field="source">' + SOURCES.map((s) => '<option' + (it.source === s ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Name (optional)</span><input type="text" id="name-' + k + '" maxlength="60" autocomplete="off" data-key="' + k + '" data-field="name" value="' + esc(it.name) + '"></label>' +
        '<label class="field"><span>Why did you save it? (optional)</span><input type="text" id="why-' + k + '" maxlength="500" autocomplete="off" data-key="' + k + '" data-field="why" value="' + esc(it.why) + '"></label>' +
        (it.colours ? '' : '') +
        '<p class="small">' + (it.data ? it.data.colours.map((h) => '<span class="sw" style="background:' + esc(h) + '"></span>').join(' ') + ' ' + esc(listWords(uniq(it.data.colours.map((h) => F.colourName(h))))) : '') + '</p>' +
        (it.status === 'adding' ? '<p class="state">Adding…</p>' : '') +
        (it.error ? '<p class="err" role="alert">' + esc(it.error) + '</p>' : '');
    }
    return '<li class="item" id="item-' + k + '">' + th + '<div class="fields">' + body + '</div></li>';
  }

  function cleanName(fname) {
    let n = String(fname || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ');
    if (!/\s/.test(n)) n = n.replace(/-+/g, ' ');
    n = n.replace(/\s+/g, ' ').trim();
    if (!n || /^(image|img|pasted|screenshot|photo|dsc|pxl)[\s\-_\d]*$/i.test(n) || /^[\d\s\-_]+$/.test(n)) return '';
    n = n.charAt(0).toUpperCase() + n.slice(1);
    if (n.length <= 60) return n;
    const cut = n.slice(0, 60), sp = cut.lastIndexOf(' ');
    return (sp > 30 ? cut.slice(0, sp) : cut).trim();
  }

  function addFiles(files) {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    for (const f of list) {
      const it = { key: 'b' + (++itemSeq), fname: f.name || 'Pasted image', status: 'reading', data: null, kind: 'image', source: 'Your photos', name: cleanName(f.name), why: '', error: '' };
      ui.bring.items.push(it);
      if (!B) { it.status = 'error'; it.error = 'Bringing things in isn’t available in this browser.'; continue; }
      B.process(f).then((d) => {
        it.data = d;
        it.status = 'ready';
        if (OWN_KINDS.indexOf(d.kindGuess) >= 0) it.kind = d.kindGuess;
        updateBring();
        const left = ui.bring.items.filter((i) => i.status === 'reading').length;
        if (!left) say('Ready to add. Set each one’s kind and where it’s from, then Add to my database.');
      }, (e) => {
        it.status = 'error';
        it.error = (e && e.message) || 'This file isn’t an image we can read.';
        updateBring();
        say(it.fname + ': ' + it.error);
      });
    }
    updateBring();
  }

  // Update the bring sheet without disturbing a field being typed in.
  function updateBring() {
    if (ui.sheet !== 'bring') return;
    const ul = $('#bring-items');
    if (!ul) return;
    const b = ui.bring;
    const have = new Map($$('li.item', ul).map((li) => [li.id.slice(5), li]));
    have.forEach((li, key) => { if (!b.items.some((i) => i.key === key)) li.remove(); });
    b.items.forEach((it) => {
      const li = have.get(it.key);
      const sig = it.status + '|' + it.error + '|' + it.kind;
      if (li && li.getAttribute('data-sig') === sig) return;
      const tmp = doc.createElement('ul');
      tmp.innerHTML = itemHTML(it);
      const fresh = tmp.firstChild;
      fresh.setAttribute('data-sig', sig);
      if (li) {
        const focusId = li.contains(doc.activeElement) ? doc.activeElement.id : null;
        li.replaceWith(fresh);
        if (focusId) { const f = doc.getElementById(focusId); if (f) f.focus(); }
      } else ul.appendChild(fresh);
    });
    const ready = b.items.filter((i) => i.status === 'ready').length;
    const reading = b.items.filter((i) => i.status === 'reading').length;
    const btn = $('#bring-add');
    if (btn) { btn.disabled = !ready || b.adding; btn.textContent = b.adding ? 'Adding…' : 'Add to my database' + (ready > 1 ? ' (' + ready + ')' : ''); }
    const p = $('#bring-progress');
    if (p) p.textContent = b.msg || (reading ? 'Reading ' + plural(reading, 'image') + '…' : '');
  }

  async function addBrought() {
    const b = ui.bring;
    if (b.adding || !imgStore) return;
    const ready = b.items.filter((i) => i.status === 'ready');
    if (!ready.length) return;
    b.adding = true;
    let added = 0;
    for (let k = 0; k < ready.length; k++) {
      const it = ready[k];
      it.status = 'adding'; it.error = '';
      b.msg = 'Adding ' + (k + 1) + ' of ' + ready.length + '…';
      updateBring();
      const id = B.newId();
      const t = now();
      const at = Math.floor(t / 1000);
      try {
        await imgStore.put(id, { img: it.data.img, thumb: it.data.thumb, at });
        ownImgs.set(id, { img: it.data.img, thumb: it.data.thumb, at });
        let st = F.bring(S, { id, kind: it.kind, name: it.name, source: it.source, colours: it.data.colours, crop: it.data.crop, texture: it.data.texture, w: it.data.w, h: it.data.h }, t);
        if (it.why && it.why.trim()) st = F.addNote(st, { q: 'bring', ref: id, text: it.why }, t);
        commit(st, { noRender: true });
        it.status = 'added';
        added++;
      } catch (e) {
        it.status = 'ready';
        it.error = (e && e.message) || 'Couldn’t save this image just now. Try again in a moment.';
      }
    }
    b.adding = false;
    b.items = b.items.filter((i) => i.status !== 'added');
    b.msg = added && b.items.length ? 'Added ' + plural(added, 'thing') + '. The rest are below.' : '';
    if (added) say('Added ' + plural(added, 'thing') + ' to your database. They’re in Split under Brought in.');
    if (added && !b.items.length) {
      closeSheet();
      showView('split', { focus: true });
      const h = $('#sec-brought-in');
      if (h) h.scrollIntoView({ block: 'start' });
    } else { updateBring(); renderView(); }
  }

  async function removeOwn(id) {
    try { if (imgStore) await imgStore.remove(id); } catch (e) {
      ui.sheetMsg = (e && e.message) || 'Couldn’t remove this just now. Try again in a moment.';
      refreshSheet();
      return;
    }
    const c = cardOf(id, S);
    ownImgs.delete(id);
    commit(F.removeOwn(S, id), { noRender: true });
    closeSheet();
    renderView();
    say('Removed ' + (c ? '“' + (c.title || 'Untitled') + '”' : 'it') + ' from your database.');
  }

  // ================================================================ CONNECT YOUR APPS (SPEC "Connect your apps")
  //
  // Five doors for the taste people already keep in other apps, simplest first. Two work in the page
  // itself: Your data file (an app's "download your data" file, read on this device by FiveSConnect)
  // and Bring in images (the sheet above, unchanged). Paste a link and Ask Claude go through the 5s
  // connector, reached with the artifact's mcp capability (FiveSConnect.connector, server "5s"); Sign
  // in to the app waits for each app's approval. The page works without the connector: until
  // claude.use("mcp") resolves to a namespace that lists the "5s" server, those doors say what opens
  // them. Whatever comes in becomes a brought thing (FiveS.bring), kept by definition, carrying its
  // addresses (image, link) and, until its picture arrives through the connector's item_image,
  // coloursPending. A picture that arrives is kept like a person's own image (imgStore) and measured
  // on the canvas (FiveSBring.process). `cid` is the thing's id in the connector, when it has one.

  const PER_FILE = 200;              // things one file adds at a time
  const STATE_MAX = 200 * 1024;      // the state stays well under the db's document limit (256 KiB)
  const PICS_PER_VISIT = 24;         // pictures fetched without asking, a visit (the connector reads 30 a minute)
  const FILE_SOURCES = ['Instagram', 'Pinterest', 'Google Takeout', 'X', 'TikTok', 'Are.na', 'Flickr', 'Tumblr', 'Your file'];
  const FILE_ACCEPT = '.json,.js,.html,.htm,.csv,.tsv,.txt,.zip,application/json,text/html,text/csv,text/plain,application/zip';
  const CX_LINE = CX ? CX.CONNECT_LINE : 'Connect 5s to Claude (Settings → Connectors → Add custom connector) to open this door.';

  // The doors that work today come first; nothing here asks anyone to add a connector to use 5s.
  const DOORS = [
    { key: 'link', icon: 'link', name: 'Paste a link',
      does: 'A link to one thing you found, or its picture: 5s works out what it is, and you add it to your database.',
      works: 'Artsy, museums, shops, Pinterest, Instagram, Are.na, any web page' },
    { key: 'file', icon: 'file', name: 'Your data file',
      does: 'The “download your data” file an app gives you, read on this device. Nothing is uploaded.',
      works: 'Instagram saved posts, Pinterest, Google Takeout, TikTok favourites, X bookmarks and likes' },
    { key: 'images', icon: 'image', name: 'Bring in images',
      does: 'Photos, screenshots and pins as pictures. Their colours are read on this device.',
      works: 'Everything' },
    { key: 'signin', icon: 'signin', name: 'Sign in to the app', needs: true,
      does: 'Sign in once, read-only, and 5s brings in your saves.',
      works: 'Pinterest, Are.na, Spotify (album covers), Flickr' },
    { key: 'ask', icon: 'chat', name: 'Ask Claude', needs: true,
      does: 'In any chat with 5s connected, ask in your own words.',
      works: 'Anything Claude can reach: web pages, other connectors' },
  ];
  const DOOR_BY = {};
  DOORS.forEach((d) => { DOOR_BY[d.key] = d; });

  const cx = {
    conn: null, status: 'checking',      // "checking" until use("mcp") answers; then "connected", "reauth" or "none"
    door: null,                          // null: the five doors; "link", "file" or "ask"
    link: { url: '', busy: false, found: null, sel: new Set(), kind: 'image', err: null, done: null,
      // the paste box: what the address is, its definition and the person's edits, a picture, the page's facts
      rec: null, def: null, edits: {}, deckId: null, page: null, pageImage: null, pic: null, picBusy: false, picErr: '', defNote: '', ctl: null },
    file: { busy: false, name: '', found: null, sel: new Set(), have: new Set(), room: PER_FILE, kind: 'image', source: 'Your file', err: null, shown: 50 },
    ask: { link: '' },
    over: { busy: false, err: null },
    pics: { running: false, tried: new Set(), got: 0, paused: false, err: null },
  };

  // -- the person's own record of a brought thing (the engine's card() leaves addresses out)

  function ownRec(id, st) {
    const list = (st || active()).own || [];
    return list.find((o) => o && o.id === id) || (st ? null : S.own.find((o) => o && o.id === id)) || null;
  }
  // Brought in from another app (a link or a data file): it has addresses, and its picture may not be here.
  const fromApps = (o) => !!(o && (typeof o.link === 'string' || typeof o.image === 'string'));

  function withOwn(st, id, patch) {
    return Object.assign({}, st, { own: st.own.map((o) => {
      if (!o || o.id !== id) return o;
      const x = Object.assign({}, o);
      for (const k of Object.keys(patch)) { if (patch[k] === undefined) delete x[k]; else x[k] = patch[k]; }
      return x;
    }) });
  }

  function freshOwnId(st) {
    for (let i = 0; i < 1000; i++) {
      const id = B ? B.newId() : 'y' + Math.floor(Math.random() * 60466176).toString(36).padStart(5, '0');
      if (!st.own.some((o) => o && o.id === id)) return id;
    }
    return 'y' + Date.now().toString(36);
  }

  // -- the designed placeholder: the source's letter, on the thing's colour or on paper

  function phStyle(c) {
    const h = c && isHex((c.colours || [])[0]) ? c.colours[0] : null;
    if (!h) return '';
    const L = lum(h);
    const ink = (L + 0.05) / 0.0578 >= 1.05 / (L + 0.05) ? '#16131F' : '#FFFFFF';
    return '--phc:' + h + ';--phi:' + ink + ';';
  }
  function phMark(c) {
    const ch = CX ? CX.sourceInitial(c && c.source) : String((c && c.source) || '•').charAt(0).toUpperCase();
    return '<b class="ph-i" aria-hidden="true">' + esc(ch) + '</b>';
  }

  function waitWords(rec) {
    if (!rec) return '';
    if (!rec.image) return 'A link you saved, with no picture.';
    if (rec.noPicture) return 'Its picture couldn’t be brought over.';
    if (cx.status === 'connected') return rec.cid ? 'Its picture is on its way through 5s.' : 'Its picture comes through 5s: open Connect your apps to bring it over.';
    return 'Its picture comes when 5s is connected in Claude.';
  }
  function waitTag(rec) {
    if (!fromApps(rec)) return '';
    if (!rec.image) return ' · Link only';
    if (rec.noPicture) return ' · No picture';
    return rec.coloursPending || ownImgs.get(rec.id) === null ? ' · Picture to come' : '';
  }
  function fromAppsHTML(rec) {
    if (!fromApps(rec)) return '';
    let h = '';
    if (!ownImgs.get(rec.id)) h += '<p class="small">' + esc(waitWords(rec)) + '</p>';
    const href = rec.link || rec.image;
    if (typeof href === 'string' && /^https:\/\//.test(href)) {
      h += '<div class="actions"><a class="btn" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">Open where it came from' + icon('out') +
        '<span class="visually-hidden"> (opens in a new tab)</span></a></div>';
    }
    return h;
  }

  const hostOf = (href) => { try { return new URL(href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  // A name for a thing whose file gave none: what it is, where it lives.
  function linkName(href) {
    let u;
    try { u = new URL(href); } catch (e) { return ''; }
    const h = u.hostname, p = u.pathname;
    if (/instagram\.com$/.test(h) && /^\/(p|reel|tv)\//.test(p)) return 'Instagram post';
    if (/pinterest\./.test(h) && /^\/pin\//.test(p)) return 'Pinterest pin';
    if (/(^|\.)(twitter|x)\.com$/.test(h) && /\/status(es)?\//.test(p)) return 'X post';
    if (/tiktok/.test(h)) return 'TikTok video';
    if (/are\.na$/.test(h) && /\/block\//.test(p)) return 'Are.na block';
    return h.replace(/^www\./, '');
  }

  // -- the sheet

  function openConnect(opener) {
    if (readOnly()) setExample(false);
    cx.door = null;
    openSheet('connect', 'Connect your apps', connectHTML, opener, { wide: true });
  }

  function openDoor(key) {
    const prev = cx.door;
    cx.door = key && DOOR_BY[key] ? key : null;
    ui.sheetTitle = cx.door ? DOOR_BY[cx.door].name : 'Connect your apps';
    refreshSheet();
    $('#sheet-body').scrollTop = 0;
    if (!cx.door && prev) { const b = $('[data-act="door"][data-door="' + prev + '"]', dlg) || $('#door-' + prev + ' .door-name', dlg); if (b) b.focus(); }
  }

  function updateConnectSheet() { if (ui.sheet === 'connect') refreshSheet(); }

  function connectHTML() {
    if (cx.door === 'link') return linkDoorHTML();
    if (cx.door === 'file') return fileDoorHTML();
    if (cx.door === 'ask') return askDoorHTML();
    return doorsHTML();
  }

  function doorState(d) {
    if (d.key === 'signin') return ['later', 'Coming soon'];
    if (!d.needs || cx.status === 'connected') return ['open', 'Open'];
    if (cx.status === 'checking') return ['wait', 'Checking'];
    return d.key === 'ask' ? ['wait', 'Only in Claude'] : ['wait', 'Coming next'];
  }
  function opensLine(d) {
    if (!d.needs) return '';
    if (cx.status === 'reauth') return 'Reconnect 5s in Claude (Settings → Connectors) to open this door.';
    if (d.key === 'signin') return 'Coming with 5s’s own website: sign in to each app right here, with nothing to add anywhere. Until then, use your data file.';
    if (cx.status === 'connected') return '';
    if (d.key === 'ask') return 'Only if you use Claude: add 5s there (Settings → Connectors → Add custom connector), then ask in any chat. Nothing else in 5s needs it.';
    return '';
  }
  // What the 5s connector adds to Paste a link, said only where it is there.
  const PASTE_MORE = 'With 5s connected, it also reads the page’s own picture and facts, and whole boards and channels.';

  function doorRow(d) {
    const [cls, word] = doorState(d);
    const opens = opensLine(d);
    let btn = '';
    if (d.key === 'link') btn = '<button type="button" class="btn btn-ink" data-act="door" data-door="link">Paste a link</button>';
    else if (d.key === 'file') btn = '<button type="button" class="btn btn-ink" data-act="door" data-door="file">Choose your data file</button>';
    else if (d.key === 'images') btn = '<button type="button" class="btn" data-act="bring" aria-haspopup="dialog">Bring in images</button>';
    else if (d.key === 'ask') btn = '<button type="button" class="btn" data-act="door" data-door="ask">' + (cls === 'open' ? 'Ask Claude' : 'See what to say') + '</button>';
    return '<li class="door is-' + cls + '" id="door-' + d.key + '">' +
      '<span class="door-ic" aria-hidden="true">' + icon(d.icon) + '</span>' +
      '<div class="door-body">' +
        '<div class="door-top"><h3 class="door-name" tabindex="-1">' + esc(d.name) + '</h3><span class="state">' + esc(word) + '</span></div>' +
        '<p class="door-does">' + esc(d.does) + '</p>' +
        '<p class="door-for"><b>Works for</b> ' + esc(d.works) + '</p>' +
        (opens ? '<p class="door-opens">' + esc(opens) + '</p>' : '') +
        (d.key === 'link' && cx.status === 'connected' ? '<p class="door-for">' + esc(PASTE_MORE) + '</p>' : '') +
        btn +
      '</div></li>';
  }

  function doorsHTML() {
    let h = '<p class="lede">Bring in what you’ve already saved in other apps. Nothing to install, and 5s never asks for a password.</p>';
    if (cx.status === 'connected') h += '<p class="cx-on">' + icon('keep') + '<span>5s is connected in Claude.</span></p>';
    h += overHTML();
    h += '<ol class="doors">' + DOORS.map(doorRow).join('') + '</ol>';
    return h;
  }

  // Things from files that wait for their pictures, and pictures on their way (only with the connector).
  function overHTML() {
    if (cx.status !== 'connected') return '';
    const waiting = S.own.filter((o) => o && o.image && !o.cid && !o.noPicture).length;
    let h = '';
    if (cx.over.busy) h += '<p class="progress">Bringing pictures over…</p>';
    else if (waiting) {
      h += '<div class="cx-over"><p>' + esc(plural(waiting, 'thing') + ' from your files ' + (waiting === 1 ? 'is' : 'are') + ' waiting for ' + (waiting === 1 ? 'its picture' : 'their pictures') + '.') + '</p>' +
        '<button type="button" class="btn btn-iris" data-act="cx-over" id="cx-over">Bring the pictures over</button></div>';
    }
    if (cx.over.err) h += errHTML(cx.over.err);
    if (cx.pics.running) h += '<p class="progress">Pictures are coming in.</p>';
    else if (cx.pics.paused) h += '<div class="cx-over"><p>More pictures are waiting.</p><button type="button" class="btn btn-iris" data-act="cx-pictures" id="cx-pictures">Bring the rest of the pictures</button></div>';
    if (cx.pics.err && !cx.pics.running) h += errHTML(cx.pics.err);
    return h;
  }

  function errHTML(e) {
    return '<div class="cx-err" role="alert"><p class="err">' + esc(e.why || 'That didn’t work.') + '</p>' + (e.resolution ? '<p>' + esc(e.resolution) + '</p>' : '') + '</div>';
  }

  function backHTML(focus) {
    return '<button type="button" class="linkbtn back" data-act="doors"' + (focus ? ' data-autofocus' : '') + '>' + icon('left') + 'All five doors</button>';
  }

  function kindSeg(which, kind) {
    return '<fieldset class="fieldset-seg cx-kind"><legend>Kind, for all of them</legend><div class="seg">' + OWN_KINDS.map((kd) =>
      '<label' + (kind === kd ? ' class="on"' : '') + '><input type="radio" name="cx-kind-' + which + '" value="' + kd + '"' + (kind === kd ? ' checked' : '') + '>' + KIND_LABEL[kd] + '</label>').join('') + '</div></fieldset>';
  }

  function selbar(which, k, n) {
    return '<div class="selbar"><span class="small" id="cx-count-' + which + '">' + k + ' of ' + n + ' chosen</span>' +
      '<button type="button" class="linkbtn" data-act="cx-all" data-which="' + which + '">Choose all</button>' +
      '<button type="button" class="linkbtn" data-act="cx-none" data-which="' + which + '">Choose none</button></div>';
  }

  function pickRow(which, key, it, on, source, note) {
    const title = it.title || (it.link ? linkName(it.link) : '') || 'Untitled';
    const what = note || ((it.image ? 'With a picture' : 'Link only') + ' · ' + hostOf(it.link || it.image));
    return '<li><label class="pick"><input type="checkbox" data-pick="' + which + '" value="' + esc(key) + '"' + (on ? ' checked' : '') + (note ? ' disabled' : '') + '>' +
      '<span class="th ph">' + phMark({ source }) + '</span>' +
      '<span class="pick-t"><span class="t">' + esc(title) + '</span><span class="s">' + esc(what) + '</span></span></label></li>';
  }

  // -- Paste a link

  // One box for one thing (SPEC "Connect your apps", the paste box; the artist, 22 Oct 2026: "a paste
  // section that is able to define a particular object or thing in a pasted link and catalog it in someone's
  // digital database"). It works with nothing connected: the address is read here (FiveSLinks.recognise),
  // a deck card is offered as itself, and anything else is defined from the address's words, then, when the
  // person presses Define, by the sample capability (the first call asks them). A picture pasted, dropped or
  // chosen is measured on this device as Bring in your own does. With the 5s connector, read_link adds the
  // page's own facts and picture (fetched after adding, through bring_in and item_image), and a board or
  // channel goes to the pictures list below, as before.
  function linkDoorHTML() {
    const L = cx.link;
    let h = backHTML(false) + '<p class="lede">Paste a link to something you found, or its picture. 5s works out what it is; you check it and add it to your database.</p>';
    h += '<form class="linkform" data-form="connect-link" novalidate><label class="field" for="cx-url"><span>A link</span></label>' +
      '<div class="row"><input type="text" id="cx-url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" value="' + esc(L.url) + '" data-autofocus>' +
      '<button type="submit" class="btn btn-ink" id="cx-read"' + (L.busy ? ' disabled' : '') + '>' + (L.busy === 'read' ? 'Looking…' : 'Look it up') + '</button></div></form>';
    if (!L.def) h += pasteDropHTML();
    if (cx.status === 'connected' && cx.conn) h += '<p class="small">' + esc(PASTE_MORE) + '</p>';
    if (L.err) h += errHTML(L.err);
    if (L.done) h += linkDoneHTML(L.done);
    else if (L.found) h += linkFoundHTML();
    else if (L.deckId) h += deckOfferHTML();
    else if (L.def) h += defineHTML();
    return h;
  }

  function pasteDropHTML() {
    const L = cx.link;
    return '<div class="drop pdrop" id="cx-pic-drop">' +
      (L.picBusy ? '<p class="progress">Reading the picture…</p>' : '<p>Paste or drop its picture here, or</p>' +
        '<input type="file" id="cx-pic" accept="image/*" class="visually-hidden"><label class="btn" for="cx-pic">' + icon('image') + 'Choose a picture</label>' +
        '<p class="small">On a phone: press and hold the picture in Messages, choose Copy, then press and hold the link box and choose Paste.</p>') +
      (L.picErr ? '<p class="err" role="alert">' + esc(L.picErr) + '</p>' : '') + '</div>';
  }

  // A deck card: it is already in 5s, so the person keeps the card itself.
  function deckOfferHTML() {
    const id = cx.link.deckId, c = cardOf(id, S), e = lastJudgment(id);
    if (!c) return '';
    return '<div class="cx-done" role="status"><h3 class="found-h" id="def-h" tabindex="-1">Already in 5s</h3>' +
      '<p>' + esc(nameLine(c)) + ' is one of 5s’s own cards.</p>' +
      (e ? '<p>' + esc((e[1] ? 'You kept it' : 'You passed it') + ' · ' + fmtDate(e[3]) + '.') + '</p>' : '') + '</div>' +
      '<div class="actions">' + (e && e[1] ? '' : '<button type="button" class="btn btn-keep btn-big" data-act="def-keep-card" data-id="' + esc(id) + '" id="def-keep">Keep this card</button>') +
      '<button type="button" class="btn' + (e && e[1] ? ' btn-big' : '') + '" data-act="detail" data-id="' + esc(id) + '" aria-haspopup="dialog" id="def-open">Open it</button></div>';
  }

  const defFields = () => Object.assign({}, cx.link.def.fields, cx.link.edits);
  function defChips(f) {
    const out = [];
    if (f.category) out.push(['category', f.category, f.category]);
    if (f.era) out.push(['era', f.era, f.era]);
    (f.genes || []).forEach((g) => out.push(['genes', g, F.featureLabel('gene:' + g, deck)]));
    (f.materials || []).forEach((m) => out.push(['materials', m, F.featureLabel('mat:' + m, deck)]));
    return out;
  }
  function sureWords(d) {
    if (d.by === 'picture') return 'From your picture. Give it a name, and add it.';
    if (d.by === 'claude') {
      const w = d.recognised && d.confidence === 'high' ? '5s knows this one.' : d.recognised && d.confidence === 'medium' ? '5s is fairly sure what this is.'
        : 'A best guess: 5s doesn’t know this exact thing, so it keeps to what the address says.';
      return w + (d.dropped.length ? ' Some of what came back didn’t fit 5s’s words and was left out.' : '');
    }
    if (d.by === 'page') return 'What its page says about itself. Check it before you add it.';
    return 'Only what the address says, so check the name.' + (ui.sample && cx.link.rec ? ' Define fills in more.' : '');
  }

  function defineHTML() {
    const L = cx.link, d = L.def, f = defFields();
    const cols = L.pic ? L.pic.colours : (f.colours || []);
    const src = L.rec ? L.rec.platform : 'Your photos';
    const kind = OWN_KINDS.indexOf(f.kind) >= 0 ? f.kind : 'image';
    const pic = L.pic
      ? '<div class="def-pic th"><img src="' + esc(L.pic.thumb) + '" alt="The picture you gave"></div>'
      : '<div class="def-pic th ph" style="' + phStyle({ colours: cols }) + '">' + phMark({ source: src }) + '</div>';
    const chips = defChips(f);
    let h = '<section class="define" aria-labelledby="def-h"><h3 class="found-h" id="def-h" tabindex="-1">Is this it?</h3>' +
      '<p class="def-sure" id="def-sure">' + esc(sureWords(d)) + '</p>' +
      (L.defNote ? '<p class="small" role="status">' + esc(L.defNote) + '</p>' : '') +
      '<div class="def-top">' + pic + '<div class="def-fields">' +
        '<label class="field"><span>Name</span><input type="text" id="def-name" data-def="name" maxlength="60" autocomplete="off" placeholder="What is it called?" value="' + esc(f.name || '') + '"></label>' +
        '<label class="field"><span>Maker</span><input type="text" id="def-maker" data-def="maker" maxlength="120" autocomplete="off" value="' + esc(f.maker || '') + '"></label>' +
        '<label class="field"><span>Date</span><input type="text" id="def-date" data-def="date" maxlength="40" autocomplete="off" value="' + esc(f.date || '') + '"></label>' +
      '</div></div>';
    if (!L.pic) {
      h += L.pageImage ? '<p class="small">Its picture comes over from its page when you add it, and its colours are read then.</p>' : pasteDropHTML();
    }
    h += '<fieldset class="fieldset-seg"><legend>Kind</legend><div class="seg">' + OWN_KINDS.map((kd) =>
      '<label' + (kind === kd ? ' class="on"' : '') + '><input type="radio" name="def-kind" value="' + kd + '"' + (kind === kd ? ' checked' : '') + '>' + KIND_LABEL[kd] + '</label>').join('') + '</div></fieldset>';
    if (f.medium || f.place || f.about) h += '<dl class="facts">' + [['Medium', f.medium], ['Place', f.place], ['About', f.about]].filter((x) => x[1]).map((x) => '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>').join('') + '</dl>';
    if (chips.length) {
      h += '<div class="def-words"><p class="small" id="def-words-h">What it is, in 5s’s words. Remove any that are wrong.</p><ul class="chips" aria-labelledby="def-words-h">' + chips.map(([k, v, label]) =>
        '<li class="chip def-chip">' + esc(label) + '<button type="button" class="chip-x" data-act="def-drop" data-k="' + k + '" data-v="' + esc(v) + '" aria-label="' + esc('Remove ' + label) + '">' + icon('close') + '</button></li>').join('') + '</ul></div>';
    }
    if (cols.length) {
      h += '<p class="def-cols">' + cols.map((x) => '<span class="sw" style="background:' + esc(x) + '"></span>').join('') + ' ' + esc(listWords(uniq(cols.map((x) => F.colourName(x))))) +
        (L.pic ? ' <span class="small">· read from its picture</span>' : f.coloursEstimated ? ' <span class="tag">estimated</span>' : '') + '</p>';
    }
    h += '<div class="actions">' +
      '<button type="button" class="btn btn-keep btn-big" data-act="def-add" id="def-add"' + (L.busy ? ' disabled' : '') + '>' + (L.busy === 'add' ? 'Adding…' : 'Add to my database') + '</button>' +
      (ui.sample && L.rec && d.by !== 'claude' ? (L.busy === 'define'
        ? '<button type="button" class="btn btn-iris" disabled id="def-define">Defining…</button><button type="button" class="btn" data-act="def-stop" id="def-stop">Stop</button>'
        : '<button type="button" class="btn btn-iris" data-act="def-define" id="def-define"' + (L.busy ? ' disabled' : '') + '>Define</button>') : '') +
      '</div>' + (ui.sample && L.rec && d.by !== 'claude' ? '<p class="small">Define fills in its maker, date and styles, as far as they are known.</p>' : '') + '</section>';
    return h;
  }

  function linkFoundHTML() {
    const L = cx.link, f = L.found, n = f.items.length;
    if (!n) {
      return '<div class="cx-err" role="alert"><p class="err">' + esc(f.why || 'Nothing at that link offers a picture 5s can read.') + '</p>' + (f.resolution ? '<p>' + esc(f.resolution) + '</p>' : '') + '</div>';
    }
    const k = L.sel.size;
    return '<h3 class="found-h" id="cx-found-h" tabindex="-1">' + esc(plural(n, 'picture') + ' from ' + f.source) + '</h3>' +
      (f.title || f.more ? '<p class="small">' + esc((f.title ? '“' + f.title + '”' : '') + (f.title && f.more ? ' · ' : '') + (f.more ? 'the first ' + n + '; there are more' : '')) + '</p>' : '') +
      kindSeg('link', L.kind) + selbar('link', k, n) +
      '<ul class="found">' + f.items.map((it, i) => pickRow('link', String(i), it, L.sel.has(String(i)), f.source)).join('') + '</ul>' +
      '<p class="small">Their pictures come over through 5s after you add them, and their colours are read here.</p>' +
      '<div class="actions"><button type="button" class="btn btn-keep btn-big" data-act="cx-link-add" id="cx-link-add"' + (k && !L.busy ? '' : ' disabled') + '>' +
        (L.busy === 'add' ? 'Adding…' : 'Add to my database (' + k + ')') + '</button></div>';
  }

  function linkDoneHTML(d) {
    const whys = uniq(d.skipped.map((s) => s.why).filter(Boolean)).slice(0, 3);
    return '<div class="cx-done" role="status"><p><b>' + esc(d.added ? 'Added ' + plural(d.added, 'thing') + ' to your database.' : 'Nothing was added.') + '</b>' +
      (d.added ? ' ' + esc('Their pictures are on their way.') : '') + '</p>' +
      (d.skipped.length ? '<p>' + esc(plural(d.skipped.length, 'picture') + ' left out: ' + whys.join(' ')) + '</p>' : '') +
      (d.err ? '<p>' + esc(d.err.why + ' ' + (d.err.resolution || '')) + '</p>' : '') + '</div>' +
      '<div class="actions">' + (d.added ? '<button type="button" class="btn btn-keep" data-act="cx-split" data-autofocus>See them in Split</button>' : '') +
      '<button type="button" class="btn" data-act="cx-again"' + (d.added ? '' : ' data-autofocus') + '>Read another link</button></div>';
  }

  function cxErr(e) {
    if (CX && e instanceof CX.ConnectError) {
      if (e.connect && cx.status === 'connected') { cx.status = 'none'; }
      return e;
    }
    return { why: 'Something didn’t work just now.', resolution: 'Try again in a moment.' };
  }

  function pasteReset(keepUrl) {
    Object.assign(cx.link, { rec: null, def: null, edits: {}, page: null, pageImage: null, deckId: null, err: null, defNote: '', found: null, done: null });
    if (!keepUrl) Object.assign(cx.link, { url: '', pic: null, picErr: '' });
  }

  // What the address (and the page's own facts, when the connector read them) say.
  function addressDef() {
    const L = cx.link, pg = L.page;
    const r = LK.fromAddress(L.rec, deck, pg ? { title: pg.name || pg.title } : null);
    const f = Object.assign({}, r.fields);
    if (pg) {
      for (const k of ['maker', 'date', 'medium']) if (!f[k] && typeof pg[k] === 'string' && pg[k].trim()) f[k] = pg[k].trim();
      if (f.maker || f.date || f.medium) f.definedBy = 'page';
    }
    return { fields: f, confidence: r.confidence, recognised: r.recognised, dropped: [], by: f.definedBy || 'address' };
  }
  const pageForPrompt = (pg) => (pg ? { title: pg.name || pg.title, description: pg.description, siteName: pg.site, author: pg.maker || pg.author, date: pg.date } : null);

  async function cxReadLink() {
    const L = cx.link;
    const input = $('#cx-url');
    if (input) L.url = input.value;
    const text = String(L.url || '').trim();
    if (!text) { if (input) input.focus(); return; }
    if (L.busy) return;
    pasteReset(true);
    const rec = LK ? LK.recognise(text, deck) : { ok: false, why: 'Links can’t be read in this browser.' };
    const done = (msg, focusId) => {
      L.busy = false;
      if (ui.sheet !== 'connect' || cx.door !== 'link') return;
      refreshSheet();
      const h = $('#' + (focusId || 'def-h'));
      if (h) h.focus();
      if (msg) say(msg);
    };
    if (!rec.ok) { L.err = { why: rec.why }; done(rec.why, 'cx-url'); return; }
    L.rec = rec;
    if (rec.deckCard && cardOf(rec.deckCard.id, S)) { L.deckId = rec.deckCard.id; done('Already in 5s: ' + nameLine(cardOf(L.deckId, S)) + '.'); return; }
    const have = S.own.find((o) => o && LK.cleanUrl(o.link) === rec.url);
    if (have) {
      say('Already in your database: ' + (have.name || 'Untitled') + '.');
      openDetail(have.id, null);
      return;
    }
    if (cx.status === 'connected' && cx.conn) {
      L.busy = 'read';
      refreshSheet();
      say('Reading the link…');
      try {
        const r = await cx.conn.readLink(rec.url);
        const items = (Array.isArray(r.items) ? r.items : []).filter((it) => it && typeof it.image === 'string');
        if (!r.page && items.length > 1) {
          // A board, channel or feed: its pictures to choose from (the list below, as before).
          L.found = { source: r.source || 'The web', title: r.title || null, more: !!r.more, items, why: r.why || '', resolution: r.resolution || '' };
          L.sel = new Set(items.map((_, i) => String(i)));
          done(plural(items.length, 'picture') + ' found on ' + L.found.source + '. All are chosen.', 'cx-found-h');
          return;
        }
        L.page = r.page && typeof r.page === 'object' ? r.page : null;
        L.pageImage = [L.page && L.page.image, items[0] && items[0].image].find((x) => typeof x === 'string' && /^https:\/\//.test(x)) || null;
      } catch (e) {
        // The paste box works without the connector: a refusal is said; a connector that stopped answering is not.
        const ce = cxErr(e);
        if (ce.kind === 'refused') L.err = ce;
      }
    }
    L.def = addressDef();
    done('Is this it? ' + (L.def.fields.name || 'It has no name yet') + '. ' + sureWords(L.def));
  }

  // A picture pasted, dropped or chosen: measured here, as Bring in your own does.
  function pastePicture(file) {
    const L = cx.link;
    if (!file || L.picBusy) return;
    if (!B) { L.picErr = 'Pictures can’t be read in this browser.'; refreshSheet(); return; }
    L.picBusy = true; L.picErr = '';
    refreshSheet();
    say('Reading the picture…');
    B.process(file).then((d) => {
      L.picBusy = false;
      L.pic = d;
      if (!L.def) L.def = { fields: { name: cleanName(file.name), kind: OWN_KINDS.indexOf(d.kindGuess) >= 0 ? d.kindGuess : 'image', definedBy: 'person' }, confidence: 'low', recognised: false, dropped: [], by: 'picture' };
      if (ui.sheet === 'connect' && cx.door === 'link') { refreshSheet(); const h = $('#def-h'); if (h) h.focus(); }
      say('Picture read. Its colours: ' + listWords(uniq(d.colours.map((x) => F.colourName(x)))) + '.');
    }, (e) => {
      L.picBusy = false;
      L.picErr = (e && e.message) || 'That file isn’t a picture 5s can read.';
      refreshSheet();
      say(L.picErr);
    });
  }

  function defineCopy(code) {
    if (code === 'not_granted') return 'Define wasn’t allowed, so this is what the address says.';
    if (code === 'cancelled') return 'Stopped. This is what the address says.';
    if (code === 'rate_limited' || code === 'queue_overflow') return 'Too many at once. Try Define again in a minute.';
    return 'Define didn’t work just now, so this is what the address says. Try again in a moment.';
  }

  async function pasteDefine() {
    const L = cx.link;
    if (!ui.sample || !L.rec || !L.def || L.busy || !LK) return;
    L.busy = 'define'; L.defNote = ''; L.ctl = new AbortController();
    refreshSheet();
    say('Defining…');
    const page = pageForPrompt(L.page);
    const prompt = LK.definePrompt({ recognised: L.rec, page, deck });
    const opts = { signal: L.ctl.signal };
    try {
      const ans = await (typeof ui.sample.json === 'function' ? ui.sample.json(prompt, opts) : ui.sample(prompt, opts).then((r) => r && r.text));
      const p = LK.parseDefinition(ans, deck, { recognised: L.rec, page });
      if (!p.ok) throw { code: 'invalid_json' };
      const base = addressDef().fields;
      L.def = { fields: Object.assign({}, base, p.fields), confidence: p.confidence, recognised: p.recognised, dropped: p.dropped, by: 'claude' };
    } catch (e) {
      L.defNote = defineCopy(e && e.code);
    }
    L.busy = false; L.ctl = null;
    if (ui.sheet !== 'connect' || cx.door !== 'link') return;
    refreshSheet();
    const h = $('#def-h'); if (h) h.focus();
    say(L.defNote || ('Defined: ' + (defFields().name || 'Untitled') + '. ' + sureWords(L.def)));
  }

  async function pasteAdd() {
    const L = cx.link;
    if (L.busy || !L.def || !imgStore) return;
    const f = defFields();
    const id = freshOwnId(S);
    const t = now();
    const item = Object.assign({}, f, { id, kind: OWN_KINDS.indexOf(f.kind) >= 0 ? f.kind : 'image', name: String(f.name || '').trim(), source: L.rec ? L.rec.platform : 'Your photos', colours: f.colours || [] });
    // A picture here wins; else the page's own picture comes over through the connector after adding.
    if (L.pic) Object.assign(item, { colours: L.pic.colours, crop: L.pic.crop, texture: L.pic.texture, w: L.pic.w, h: L.pic.h, coloursEstimated: null });
    else if (L.pageImage && cx.status === 'connected') item.image = L.pageImage;
    L.busy = 'add';
    refreshSheet();
    try {
      if (L.pic) {
        const at = Math.floor(t / 1000);
        await imgStore.put(id, { img: L.pic.img, thumb: L.pic.thumb, at });
        ownImgs.set(id, { img: L.pic.img, thumb: L.pic.thumb, at });
      }
      let st = F.bring(S, item, t, deck);
      if (item.image && !item.colours.length) st = withOwn(st, id, { coloursPending: true });
      commit(st, { noRender: true });
    } catch (e) {
      L.busy = false;
      L.err = { why: 'Couldn’t add it just now.', resolution: 'Try again in a moment.' };
      refreshSheet();
      say(L.err.why + ' ' + L.err.resolution);
      return;
    }
    L.busy = false;
    const name = item.name || 'Untitled';
    pasteReset(false);
    if (item.image) cxBringOver([id]);
    closeSheet();
    showView('split', { focus: true });
    const h = $('#sec-brought-in');
    if (h) h.scrollIntoView({ block: 'start' });
    say('Added “' + name + '” to your database. It’s in Split under Brought in.');
  }

  function pasteDrop(k, v) {
    const f = cx.link.def && cx.link.def.fields;
    if (!f) return;
    const label = k === 'genes' ? F.featureLabel('gene:' + v, deck) : k === 'materials' ? F.featureLabel('mat:' + v, deck) : v;
    if (Array.isArray(f[k])) { f[k] = f[k].filter((x) => x !== v); if (!f[k].length) delete f[k]; } else delete f[k];
    refreshSheet();
    const next = $('.def-chip .chip-x', dlg) || $('#def-name', dlg);
    if (next) next.focus();
    say('Removed ' + label + '.');
  }

  function keepDeckCard(id) {
    const c = cardOf(id, S);
    if (!c || !deck) return;
    commit(F.judge(S, deck, id, true, 0, now()).state);
    refreshSheet();
    const o = $('#def-open'); if (o) o.focus();
    say('Kept: ' + nameLine(c) + '. It’s in your database, in Split.');
  }

  function openPaste(opener) {
    if (readOnly()) setExample(false);
    cx.door = 'link';
    openSheet('connect', DOOR_BY.link.name, connectHTML, opener, { wide: true });
  }

  // The things bring_in added, kept here too: same id (unless this device already uses it), cid the connector's.
  function mirrorAdded(added, given) {
    const thumbs = new Map();
    for (const g of given || []) if (g && g.image && g.thumb) { try { thumbs.set(new URL(g.image).href, g.thumb); } catch (e) { /* not an address */ } }
    let st = S;
    const t = now();
    const ids = [];
    for (const a of added) {
      if (!a || typeof a.id !== 'string' || typeof a.image !== 'string') continue;
      const same = st.own.find((o) => o && (o.cid === a.id || (o.image && o.image === a.image)));
      if (same) { st = withOwn(st, same.id, { cid: a.id }); ids.push(same.id); continue; }
      const id = st.own.some((o) => o && o.id === a.id) ? freshOwnId(st) : a.id;
      const hexes = (Array.isArray(a.colours) ? a.colours : []).map((c) => (c && typeof c === 'object' ? c.hex : c)).filter(isHex);
      st = F.bring(st, { id, kind: a.kind, name: a.name || '', source: a.source || 'The web', colours: hexes, crop: a.crop || null, texture: a.texture == null ? null : a.texture, w: null, h: null }, t);
      const extra = { image: a.image, cid: a.id };
      if (typeof a.link === 'string' && a.link) extra.link = a.link;
      const th = thumbs.get(a.image);
      if (th) extra.thumb = th;
      if (a.colours_pending || !hexes.length) extra.coloursPending = true;
      st = withOwn(st, id, extra);
      ids.push(id);
    }
    if (st !== S) commit(st, { noRender: true });
    return ids;
  }

  async function cxAddLink() {
    const L = cx.link;
    if (L.busy || !L.found || !cx.conn) return;
    const chosen = L.found.items.filter((_, i) => L.sel.has(String(i)));
    if (!chosen.length) return;
    L.busy = 'add'; L.err = null;
    updateLinkButtons();
    say('Adding ' + plural(chosen.length, 'picture') + '…');
    const added = [], skipped = [];
    let err = null;
    try {
      let queue = chosen.slice();
      for (let round = 0; queue.length && round < 8; round++) {
        const batch = queue.slice(0, 60);
        const r = await cx.conn.bringIn(batch, L.kind);
        const got = Array.isArray(r.added) ? r.added : [];
        added.push(...got);
        (Array.isArray(r.skipped) ? r.skipped : []).forEach((s) => skipped.push(s));
        const rest = Array.isArray(r.remaining) ? r.remaining : [];
        if (!got.length && rest.length >= batch.length) break; // no progress this round: leave the rest
        queue = rest.concat(queue.slice(60));
      }
    } catch (e) { err = cxErr(e); }
    L.busy = false;
    const ids = added.length ? mirrorAdded(added, chosen) : [];
    if (!ids.length && err) { L.err = err; refreshSheet(); say(err.why + ' ' + (err.resolution || '')); return; }
    const src = L.found.source;
    L.found = null; L.sel = new Set(); L.url = '';
    if (ids.length) fetchPictures();
    if (ids.length && !skipped.length && !err) {
      closeSheet();
      showView('split', { focus: true });
      const h = $('#sec-brought-in');
      if (h) h.scrollIntoView({ block: 'start' });
      say('Added ' + plural(ids.length, 'thing') + ' from ' + src + '. They’re in Split under Brought in. Their pictures are on their way.');
      return;
    }
    L.done = { added: ids.length, skipped, err };
    refreshSheet();
    say((ids.length ? 'Added ' + plural(ids.length, 'thing') + '.' : 'Nothing was added.') + (skipped.length ? ' ' + plural(skipped.length, 'picture') + ' left out.' : ''));
  }

  function updateLinkButtons() {
    const L = cx.link;
    const add = $('#cx-link-add');
    if (add) { add.disabled = !L.sel.size || !!L.busy; add.textContent = L.busy === 'add' ? 'Adding…' : 'Add to my database (' + L.sel.size + ')'; }
    const c = $('#cx-count-link');
    if (c && L.found) c.textContent = L.sel.size + ' of ' + L.found.items.length + ' chosen';
  }

  // -- Your data file

  function foundWords(f) {
    return plural(f.links, 'link') + ' found, ' + (f.pictures === 0 ? 'none with pictures' : f.pictures === 1 ? '1 with a picture' : f.pictures + ' with pictures') + '.';
  }

  function stateBytes(st) {
    const s = JSON.stringify(st);
    try { return new TextEncoder().encode(s).length; } catch (e) { return s.length * 2; }
  }
  // About what one thing from a file adds to the saved state (its record, its addresses, its name).
  const itemBytes = (it, source) => 210 + (it.image ? it.image.length + 40 : 0) + (it.link ? it.link.length + 10 : 0) + Math.min(180, (it.title || '').length * 3) + String(source || '').length;
  function roomLeft(items, source) {
    let left = STATE_MAX - stateBytes(S);
    let n = 0;
    for (const it of items) {
      if (n >= PER_FILE) break;
      const b = itemBytes(it, source);
      if (left < b) break;
      left -= b;
      n++;
    }
    return n;
  }

  function fileDoorHTML() {
    const D = cx.file;
    let h = backHTML(!D.found) + '<p class="lede">Most apps let you download your data. Drop the file they give you here, as it is: 5s reads it on this device and shows you what it found before adding anything.</p>' +
      '<div class="drop" id="cx-drop"><p>Drop the file here, or</p>' +
        '<input type="file" id="cx-file" class="visually-hidden" accept="' + FILE_ACCEPT + '">' +
        '<label class="btn btn-ink" for="cx-file" id="cx-pick">' + icon('file') + 'Choose a file</label>' +
        '<p class="where">Nothing leaves this device.</p></div>' +
      '<p class="small">Where to find it: in the app’s settings, look for “Download your data” or “Download your information”. Apps can take a day to send it.</p>';
    if (D.busy) h += '<p class="progress">Reading ' + esc(D.name) + '…</p>';
    if (D.err) h += errHTML(D.err);
    if (D.found) h += fileFoundHTML();
    return h;
  }

  function fileFoundHTML() {
    const D = cx.file, f = D.found;
    const fresh = f.items.filter((it) => !D.have.has(it.key));
    let h = '<h3 class="found-h" id="cx-found-h" tabindex="-1">' + esc(f.name) + '</h3>' +
      '<p class="found-sum" id="cx-found-sum">' + esc(foundWords(f)) + '</p>';
    const notes = [];
    if (D.have.size) notes.push(D.have.size === 1 ? 'One is already in your 5s.' : D.have.size + ' are already in your 5s.');
    if (fresh.length > D.room) {
      notes.push(D.room < PER_FILE
        ? 'Your 5s has room for ' + D.room + ' more, so the first ' + D.room + ' are chosen.'
        : 'One file adds up to ' + PER_FILE + ' at a time, so the first ' + PER_FILE + ' are chosen. Add the same file again for the next ones.');
    }
    notes.push(...(f.notes || []));
    if (notes.length) h += '<p class="small" id="cx-file-notes">' + esc(notes.join(' ')) + '</p>';
    if (!f.items.length) {
      return h + '<p>Nothing in this file links to a post, a pin or a picture. Try another file from the same download.</p>';
    }
    if (!fresh.length) return h + '<p>Everything in it is already in your 5s.</p>';
    const k = Math.min(D.sel.size, D.room);
    const shown = f.items.slice(0, D.shown);
    h += '<label class="field cx-from"><span>From</span><select id="cx-file-source">' + uniq(FILE_SOURCES.concat([D.source])).map((s) => '<option' + (s === D.source ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>' +
      kindSeg('file', D.kind) + selbar('file', D.sel.size, fresh.length) +
      '<ul class="found">' + shown.map((it) => pickRow('file', it.key, it, D.sel.has(it.key), D.source, D.have.has(it.key) ? 'Already in your 5s' : '')).join('') + '</ul>' +
      (f.items.length > D.shown ? '<button type="button" class="btn btn-quiet" data-act="cx-more" id="cx-more">Show ' + Math.min(50, f.items.length - D.shown) + ' more</button>' : '') +
      '<p class="small">' + esc(f.pictures
        ? (cx.status === 'connected' ? 'Pictures come over through 5s after you add them. ' : '5s can’t show pictures from other sites here: they come over once 5s is connected in Claude. ') + 'Links without pictures stay links.'
        : 'These are links without pictures: they stay links, with the source’s letter where a picture would be.') + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-keep btn-big" data-act="cx-file-add" id="cx-file-add"' + (k ? '' : ' disabled') + '>' + esc(fileAddLabel()) + '</button></div>';
    return h;
  }

  function fileAddLabel() {
    const D = cx.file, n = D.sel.size;
    return n > D.room ? 'Add ' + D.room + ' of the ' + n + ' chosen' : 'Add to my database (' + n + ')';
  }

  function updateFileButtons() {
    const D = cx.file;
    if (!D.found) return;
    const add = $('#cx-file-add');
    if (add) { add.disabled = !Math.min(D.sel.size, D.room); add.textContent = fileAddLabel(); }
    const c = $('#cx-count-file');
    if (c) c.textContent = D.sel.size + ' of ' + D.found.items.filter((it) => !D.have.has(it.key)).length + ' chosen';
  }

  async function cxReadFile(file) {
    if (!file || !CX) return;
    const D = cx.file;
    if (D.busy) return;
    D.busy = true; D.err = null; D.found = null; D.name = file.name || 'Your file';
    if (ui.sheet === 'connect' && cx.door === 'file') refreshSheet();
    say('Reading ' + D.name + '…');
    try {
      const f = await CX.readFile(file);
      const have = new Set();
      for (const o of S.own) {
        if (o && o.link) have.add('l' + CX.keyOf(o.link));
        if (o && o.image) have.add('i' + CX.keyOf(o.image));
      }
      D.have = new Set(f.items.filter((it) => (it.link && have.has('l' + CX.keyOf(it.link))) || (it.image && have.has('i' + CX.keyOf(it.image)))).map((it) => it.key));
      D.source = f.source;
      const fresh = f.items.filter((it) => !D.have.has(it.key));
      D.room = roomLeft(fresh, D.source);
      D.sel = new Set(fresh.slice(0, D.room).map((it) => it.key));
      D.shown = 50;
      D.kind = 'image';
      D.found = f;
      say(foundWords(f) + (fresh.length ? ' ' + D.sel.size + ' chosen.' : ''));
    } catch (e) {
      D.err = { why: CX && e instanceof CX.FileError ? e.message : 'This file couldn’t be read.', resolution: CX && e instanceof CX.FileError ? '' : 'Drop the file the app gave you, as it is.' };
      say(D.err.why);
    }
    D.busy = false;
    if (ui.sheet === 'connect' && cx.door === 'file') {
      refreshSheet();
      const h = $('#cx-found-h');
      if (h) h.focus();
    }
  }

  function cxAddFile() {
    const D = cx.file;
    if (!D.found || D.busy) return;
    const chosen = D.found.items.filter((it) => D.sel.has(it.key) && !D.have.has(it.key));
    const room = roomLeft(chosen, D.source);
    const take = chosen.slice(0, room);
    if (!take.length) {
      D.err = { why: 'Your 5s has no room for more things from files.', resolution: 'Let some go on a “Still yours?” card, or remove some in Split, then add again.' };
      refreshSheet();
      return;
    }
    let st = S;
    const t = now();
    const ids = [];
    for (const it of take) {
      const id = freshOwnId(st);
      st = F.bring(st, { id, kind: D.kind, name: it.title || (it.link ? linkName(it.link) : ''), source: D.source, colours: [], crop: null, texture: null, w: null, h: null }, t);
      const extra = {};
      if (it.link) extra.link = it.link;
      if (it.image) { extra.image = it.image; extra.coloursPending = true; }
      st = withOwn(st, id, extra);
      ids.push(id);
    }
    commit(st, { noRender: true });
    const pics = take.filter((it) => it.image).length;
    const left = chosen.length - take.length;
    const src = D.source;
    D.found = null; D.sel = new Set(); D.have = new Set();
    closeSheet();
    showView('split', { focus: true });
    const h = $('#sec-brought-in');
    if (h) h.scrollIntoView({ block: 'start' });
    say('Added ' + plural(ids.length, 'thing') + ' from ' + src + '. They’re in Split under Brought in.' +
      (pics ? (cx.status === 'connected' ? ' Their pictures are on their way.' : ' Their pictures come once 5s is connected in Claude.') : '') +
      (left ? ' ' + left + ' more didn’t fit this time: add the same file again for them.' : ''));
    if (pics && cx.status === 'connected') cxBringOver(ids);
  }

  // -- pictures: things from files go to the connector (bring_in), then every picture comes back (item_image)

  async function cxBringOver(only) {
    const O = cx.over;
    if (O.busy || !cx.conn || cx.status !== 'connected') return;
    const want = S.own.filter((o) => o && o.image && !o.cid && !o.noPicture && (!only || only.indexOf(o.id) >= 0));
    if (!want.length) return;
    O.busy = true; O.err = null;
    updateConnectSheet();
    let mapped = 0;
    const already = [];
    try {
      let queue = want.slice();
      for (let round = 0; queue.length && round < 12; round++) {
        const batch = queue.slice(0, 60);
        const r = await cx.conn.bringIn(batch.map((o) => ({ image: o.image, link: o.link, title: o.name, source: o.source, kind: o.kind })));
        const byImage = new Map(batch.map((o) => [o.image, o]));
        let st = S;
        for (const a of Array.isArray(r.added) ? r.added : []) {
          const o = byImage.get(a.image);
          if (!o) continue;
          const patch = { cid: a.id };
          const hexes = (Array.isArray(a.colours) ? a.colours : []).map((c) => (c && typeof c === 'object' ? c.hex : c)).filter(isHex);
          if (!a.colours_pending && hexes.length) Object.assign(patch, { colours: hexes, crop: a.crop || null, texture: a.texture == null ? null : a.texture, coloursPending: undefined, coloursEstimated: undefined });
          st = withOwn(st, o.id, patch);
          mapped++;
        }
        for (const s of Array.isArray(r.skipped) ? r.skipped : []) {
          const o = batch[s.item];
          if (!o) continue;
          if (/already/i.test(s.why || '')) already.push(o);
          else st = withOwn(st, o.id, { noPicture: true });
        }
        if (st !== S) commit(st, { noRender: true });
        const rest = new Set((Array.isArray(r.remaining) ? r.remaining : []).map((x) => x && x.image));
        const left = batch.filter((o) => rest.has(o.image));
        if (!(r.added || []).length && left.length >= batch.length) break;
        queue = left.concat(queue.slice(60));
      }
      // Already in the connector (brought over before, or from a chat): find their ids there.
      if (already.length) {
        try {
          const g = await cx.conn.getState();
          const there = g && g.state && Array.isArray(g.state.own) ? g.state.own : [];
          let st = S;
          for (const o of already) { const m = there.find((x) => x && x.image === o.image); if (m && typeof m.id === 'string') { st = withOwn(st, o.id, { cid: m.id }); mapped++; } }
          if (st !== S) commit(st, { noRender: true });
        } catch (e) { /* their pictures stay to come */ }
      }
    } catch (e) { O.err = cxErr(e); }
    O.busy = false;
    softRender();
    updateConnectSheet();
    if (mapped) fetchPictures();
  }

  async function havePicture(id) {
    if (ownImgs.get(id)) return true;
    if (!imgStore) return false;
    try { const v = await imgStore.get(id); if (v && v.img) { ownImgs.set(id, v); return true; } } catch (e) { /* not there */ }
    return false;
  }

  async function nextWithoutPicture() {
    for (const o of S.own) {
      if (!o || !o.cid || !o.image || o.noPicture || cx.pics.tried.has(o.id)) continue;
      if (await havePicture(o.id)) continue;
      return o;
    }
    return null;
  }

  // Fetch the pictures of things the connector knows, a few a visit unless asked for more.
  async function fetchPictures(more) {
    const Q = cx.pics;
    if (Q.running || cx.status !== 'connected' || !cx.conn || !B || !imgStore || !CX) return;
    Q.running = true; Q.paused = false; Q.err = null;
    if (more) Q.got = 0;
    updateConnectSheet();
    try {
      for (;;) {
        const next = await nextWithoutPicture();
        if (!next) break;
        if (Q.got >= PICS_PER_VISIT) { Q.paused = true; break; }
        Q.tried.add(next.id);
        let p;
        try { p = await cx.conn.itemImage(next.cid); } catch (e) {
          const ce = cxErr(e);
          // A picture that is gone, private or too large stays a link; a busy moment or a limit stops for now.
          const lasting = ce.kind === 'refused' && ce.error !== 'limit' && ['busy', 'timeout', 'unreachable', 'dns', 'budget'].indexOf(ce.code) < 0;
          if (lasting) { commit(withOwn(S, next.id, { noPicture: true }), { noRender: true }); continue; }
          Q.err = ce;
          break;
        }
        Q.got++;
        let d = null;
        try { d = await B.process(CX.dataUrlBlob(p.image)); } catch (e) { commit(withOwn(S, next.id, { noPicture: true }), { noRender: true }); continue; }
        const at = Math.floor(now() / 1000);
        try { await imgStore.put(next.id, { img: d.img, thumb: d.thumb, at }); } catch (e) { Q.err = { why: 'A picture couldn’t be kept just now.', resolution: 'Try again in a moment.' }; break; }
        ownImgs.set(next.id, { img: d.img, thumb: d.thumb, at });
        const rec = S.own.find((o) => o && o.id === next.id);
        if (rec) {
          const patch = { w: d.w, h: d.h };
          if (rec.coloursPending || rec.coloursEstimated || !(rec.colours || []).length) Object.assign(patch, { colours: d.colours, crop: d.crop, texture: d.texture, coloursPending: undefined, coloursEstimated: undefined });
          commit(withOwn(S, next.id, patch), { noRender: true });
        }
        pictureArrived(next.id);
      }
    } finally { Q.running = false; }
    softRender();
    updateConnectSheet();
    if (Q.got) say(Q.paused ? 'Pictures came in. More are waiting: open Connect your apps for the rest.' : 'The pictures came in.');
  }

  // Redraw the view only when nothing in it has the keyboard's focus (focus is never pulled away).
  function softRender() {
    if (!deck) return;
    const v = $('#view-' + view);
    if (view === 'sort') { if (!ui.drag) updateStack(); return; }
    const ae = doc.activeElement;
    const onHeading = !!(ae && v && v.contains(ae) && ae.tagName === 'H1');
    if (v && v.contains(ae) && !onHeading) return false;
    renderView();
    if (onHeading) { const h = $('#view-' + view + ' h1'); if (h) h.focus({ preventScroll: true }); }
    return true;
  }

  function pictureArrived(id) {
    const c = cardOf(id, S);
    if (!c) return;
    $$('[data-id="' + CSS.escape(id) + '"] .th.ph').forEach((th) => {
      const tmp = doc.createElement('span');
      tmp.innerHTML = thumbHTML(c, 'work');
      if (tmp.firstChild) th.replaceWith(tmp.firstChild);
    });
    if (view === 'sort' && !ui.drag) {
      const n = $('#stack .card[data-id="' + CSS.escape(id) + '"]:not(.flying)');
      if (n) { n.remove(); updateStack(); }
    } else if (softRender() === false) {
      // A control in the view has the focus, so the view stays as it is: its Brought in row says what changed.
      $$('#view-split section[aria-labelledby="sec-brought-in"] .rowbtn[data-id="' + CSS.escape(id) + '"] .s').forEach((x) => {
        x.textContent = KIND_LABEL[c.kind] + ' · ' + c.source + waitTag(ownRec(id, S));
      });
    }
    if (ui.sheet === 'detail' && ui.detailId === id) refreshSheet();
  }

  // -- Ask Claude

  function askDoorHTML() {
    const on = cx.status === 'connected';
    const s = CX ? CX.askSentence(cx.ask.link) : '';
    return backHTML(false) +
      '<p class="lede">' + (on ? 'In any chat with Claude, say:' : 'Once 5s is connected in Claude, say this in any chat:') + '</p>' +
      '<p class="ask-line" id="cx-ask-line">' + esc(s) + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-ink" data-act="cx-copy" id="cx-copy" data-autofocus>Copy</button></div>' +
      '<label class="field"><span>Your link (optional)</span><input type="text" id="cx-ask-link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…" value="' + esc(cx.ask.link) + '"></label>' +
      '<p class="small">Claude shows you the pictures first and adds only the ones you pick. It works with anything Claude can reach: web pages, other connectors.</p>' +
      (on ? '' : '<p class="door-opens">' + esc(opensLine(DOOR_BY.ask)) + '</p>');
  }

  function cxCopyAsk(btn) {
    if (!CX) return;
    hubCopy(CX.askSentence(cx.ask.link), $('#cx-ask-line'), 'The sentence', btn);
  }

  // -- choosing

  function cxSelect(which, all) {
    const box = which === 'file' ? cx.file : cx.link;
    if (!box.found) return;
    if (!all) box.sel = new Set();
    else if (which === 'file') box.sel = new Set(box.found.items.filter((it) => !box.have.has(it.key)).slice(0, box.room).map((it) => it.key));
    else box.sel = new Set(box.found.items.map((_, i) => String(i)));
    $$('input[data-pick="' + which + '"]', dlg).forEach((cb) => { if (!cb.disabled) cb.checked = box.sel.has(cb.value); });
    if (which === 'file') updateFileButtons(); else updateLinkButtons();
    say(box.sel.size + ' chosen.');
  }

  function cxMore() {
    const D = cx.file;
    if (!D.found) return;
    const was = D.shown;
    D.shown += 50;
    refreshSheet();
    const cbs = $$('input[data-pick="file"]', dlg);
    if (cbs[was]) cbs[was].focus();
  }

  function lightConnect() {
    if (!CX) { cx.status = 'none'; return; }
    use('mcp').then(async (m) => {
      cx.conn = CX.connector(m);
      let st = 'none';
      try { st = await cx.conn.status(); } catch (e) { st = 'none'; }
      cx.status = st;
      updateConnectSheet();
      if (st === 'connected') fetchPictures();
    });
  }

  function wireConnect() {
    doc.addEventListener('change', (e) => {
      const t = e.target;
      if (!t || !t.getAttribute || ui.sheet !== 'connect') return;
      if (t.id === 'cx-file') { const f = t.files && t.files[0]; t.value = ''; if (f) cxReadFile(f); return; }
      if (t.id === 'cx-pic') { const f = t.files && t.files[0]; t.value = ''; if (f) pastePicture(f); return; }
      if (t.name === 'def-kind') {
        cx.link.edits.kind = t.value;
        $$('input[name="def-kind"]', dlg).forEach((r) => r.parentElement.classList.toggle('on', r.checked));
        return;
      }
      const which = t.getAttribute('data-pick');
      if (which === 'link' || which === 'file') {
        const box = cx[which];
        if (t.checked) box.sel.add(t.value); else box.sel.delete(t.value);
        if (which === 'file') updateFileButtons(); else updateLinkButtons();
        return;
      }
      if (t.name === 'cx-kind-link' || t.name === 'cx-kind-file') {
        cx[t.name.slice(8)].kind = t.value;
        $$('input[name="' + t.name + '"]', dlg).forEach((r) => r.parentElement.classList.toggle('on', r.checked));
        return;
      }
      if (t.id === 'cx-file-source') cx.file.source = t.value;
    });
    doc.addEventListener('input', (e) => {
      const t = e.target;
      if (!t || ui.sheet !== 'connect') return;
      if (t.id === 'cx-url') cx.link.url = t.value;
      else if (t.getAttribute && t.getAttribute('data-def')) cx.link.edits[t.getAttribute('data-def')] = t.value;
      else if (t.id === 'cx-ask-link') {
        cx.ask.link = t.value;
        const l = $('#cx-ask-line');
        if (l && CX) l.textContent = CX.askSentence(t.value);
      }
    });
    const onFileDoor = () => ui.sheet === 'connect' && cx.door === 'file';
    const onLinkDoor = () => ui.sheet === 'connect' && cx.door === 'link';
    // Paste a link takes a picture too: pasted (anywhere in the sheet), dropped, or chosen.
    doc.addEventListener('paste', (e) => {
      if (!onLinkDoor()) return;
      for (const it of Array.from((e.clipboardData && e.clipboardData.items) || [])) {
        if (it.kind === 'file' && /^image\//.test(it.type)) { const f = it.getAsFile(); if (f) { e.preventDefault(); pastePicture(f); return; } }
      }
    });
    dlg.addEventListener('dragover', (e) => { if (!onLinkDoor()) return; e.preventDefault(); const d = $('#cx-pic-drop'); if (d) d.classList.add('over'); });
    dlg.addEventListener('dragleave', (e) => { if (!onLinkDoor() || dlg.contains(e.relatedTarget)) return; const d = $('#cx-pic-drop'); if (d) d.classList.remove('over'); });
    dlg.addEventListener('drop', (e) => {
      if (!onLinkDoor()) return;
      e.preventDefault();
      const dt = e.dataTransfer;
      const f = dt && Array.from(dt.files || []).find((x) => /^image\//.test(x.type));
      if (f) { pastePicture(f); return; }
      const u = dt && (dt.getData('text/uri-list') || dt.getData('text/plain'));
      if (u) { cx.link.url = u.split('\n')[0]; cxReadLink(); }
    });
    dlg.addEventListener('dragover', (e) => { if (!onFileDoor()) return; e.preventDefault(); const d = $('#cx-drop'); if (d) d.classList.add('over'); });
    dlg.addEventListener('dragleave', (e) => { if (!onFileDoor() || dlg.contains(e.relatedTarget)) return; const d = $('#cx-drop'); if (d) d.classList.remove('over'); });
    dlg.addEventListener('drop', (e) => {
      if (!onFileDoor()) return;
      e.preventDefault();
      const d = $('#cx-drop'); if (d) d.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) cxReadFile(f);
    });
  }

  // ================================================================ YOUR HUB (SPEC "Your hub")
  //
  // The person's own GitHub repository ("your hub") and its website, made from inside 5s through the
  // links bridge: an artifact cannot call GitHub (its frame blocks other sites), so 5s fills in
  // GitHub's own pages and opens them in a new tab; the person presses one button there and comes
  // back. Seed's last section is the card (a stepper of the four steps); the Hub sheet walks them.
  // Words: 5s says hub, save and address. GitHub's own words appear only as the labels of buttons and
  // choices the person must press on GitHub's pages, each quoted in a <q class="gh">.
  // State: state.hub (FiveS.setHub, mode "links") and seen["hub-opened"]; the Path reads both.

  const HUB_KEYS = ['github', 'hub', 'saved', 'opened'];
  const HUB_TITLES = ['Your GitHub account', 'Make your hub', 'Save your seed to your hub', 'Your hub’s address'];
  const HUB_NAV = ['Account', 'Make', 'Save', 'Address'];
  const HUB_GO = ['Start my hub', 'Make my hub', 'Save my seed to my hub', 'Go to my hub’s address'];
  const HUB_DESC = 'My taste, sorted five at a time in 5s.';
  const HUB_LEDE = 'Your taste as a page of its own, at your own web address, kept in your own GitHub account. ' +
    '5s fills everything in; on GitHub you only press a couple of buttons.';
  const NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>';
  ui.hub = { step: 0, have: false, user: '', choice: 'site', other: '', priv: false, notes: false, own: false, busy: false, msg: '', text: null, done: false };
  let hubToken = 0;

  // The Path's four hub milestones keep SPEC's words in the engine; 5s shows them in its own words.
  function hubWords(s) {
    return String(s || '').replace(/GitHub repository/g, 'hub on GitHub').replace(/\brepository\b/g, 'hub')
      .replace(/ on GitHub Pages\b/g, ' at its own address').replace(/GitHub Pages/g, 'its own address');
  }

  function hubOf(st) { const h = st && st.hub; return h && typeof h === 'object' ? h : {}; }

  // The four steps as the Path reads them, each with the hub's own Next (the first of the four not done).
  function hubSteps(st) {
    const items = F.path(st, deck, now()).filter((m) => HUB_KEYS.indexOf(m.key) >= 0);
    let given = false;
    return items.map((m) => { const next = !m.done && !given; if (next) given = true; return { key: m.key, label: m.label, done: !!m.done, next }; });
  }
  // The furthest step the sheet opens at: the first not done (all done: the last).
  function hubReach(st) { const i = hubSteps(st).findIndex((s) => !s.done); return i < 0 ? 3 : i; }
  function hubWhen(sec) { return !sec ? '' : F.dayOf(sec * 1000) === F.dayOf(now()) ? 'today' : fmtDate(sec); }

  // An ordered list, each step's state in words (never colour alone).
  function hubStepperHTML(steps, details) {
    return '<ol class="hubsteps">' + steps.map((s, i) => {
      const cls = s.done ? 'done' : s.next ? 'next' : 'notyet';
      const word = s.done ? 'Done' : s.next ? 'Next' : 'Not yet';
      return '<li class="' + cls + '"><span class="mk" aria-hidden="true">' + (i + 1) + '</span><span class="body">' +
        '<span class="lbl">' + esc(s.label) + '</span><span class="visually-hidden">: </span><span class="state">' + word + '</span>' +
        (details[i] ? '<span class="det">' + details[i] + '</span>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }

  // -- the card (Seed's last section)

  function hubCardHTML() {
    if (!HUB || !deck) return '';
    if (readOnly()) return hubExampleHTML();
    const h = hubOf(S);
    const steps = hubSteps(S);
    if (steps.length !== 4) return ''; // an engine without the hub's milestones: no card
    const nextI = steps.findIndex((s) => s.next);
    const made = !!(h.madeAt && h.user && h.name);
    const changed = !!h.savedAt && h.savedCode !== F.seedCode(S);
    const details = [
      steps[0].done ? '<span class="mono">' + esc(h.user) + '</span>' : '',
      steps[1].done && h.name ? '<span class="mono">' + esc(h.name) + '</span>' + (h.private ? ' · private' : '') : '',
      '', '',
    ];
    let html = '<section class="sec hub" id="hub-sec" aria-labelledby="hub-h"><div class="hubcard">' +
      '<h2 class="sec-title hub-title" id="hub-h" tabindex="-1">Your hub</h2>' +
      '<p class="sec-note">' + esc(HUB_LEDE) + '</p>' + hubStepperHTML(steps, details);
    if (made && h.private) {
      html += '<p class="hub-addr"><span class="small">Your hub is private, so it has no address.</span>' +
        '<a href="' + esc(HUB.links.repo(h.user, h.name)) + '" target="_blank" rel="noopener" data-act="hub-out" data-say="Your hub opened in a new tab.">Open it on GitHub' + NEW_TAB + '</a></p>';
    } else if (made) {
      const a = HUB.links.site(h.user, h.name);
      html += '<p class="hub-addr"><span class="small">Your hub’s address</span>' +
        '<a href="' + esc(a) + '" target="_blank" rel="noopener" data-act="hub-out" data-say="Your hub opened in a new tab.">' + esc(a) + NEW_TAB + '</a></p>';
    }
    if (h.savedAt) html += '<p class="small hub-saved">Last saved ' + esc(hubWhen(h.savedAt)) + '.</p>';
    else if (made) html += '<p class="small hub-saved">Not saved to your hub yet.</p>';
    if (changed) html += '<p class="hub-changed">Your seed has changed since you last saved it to your hub.</p>';
    html += '<div class="row-gap">' +
      (changed ? '<button type="button" class="btn btn-keep btn-big" id="hub-again" data-act="hub" data-step="2" aria-haspopup="dialog">Save to my hub again</button>' : '') +
      (nextI >= 0
        ? '<button type="button" class="btn ' + (changed ? '' : 'btn-keep ') + 'btn-big" id="hub-go" data-act="hub" data-step="' + nextI + '" aria-haspopup="dialog">' + HUB_GO[nextI] + '</button>'
        : '<button type="button" class="btn btn-big" id="hub-go" data-act="hub" data-step="3" aria-haspopup="dialog">See the four steps</button>') +
      '</div></div></section>';
    return html;
  }

  // Example mode: a finished example hub, clearly marked; nothing in it opens GitHub.
  function hubExampleHTML() {
    const user = 'example', name = 'example.github.io';
    const steps = HUB_KEYS.map((k, i) => {
      const m = (F.HUB_MILESTONES || []).find((x) => x.key === k);
      return { key: k, label: m ? m.label : HUB_TITLES[i], done: true, next: false };
    });
    return '<section class="sec hub" id="hub-sec" aria-labelledby="hub-h"><div class="hubcard ex">' +
      '<p class="hub-exmark"><strong>Example hub.</strong> Not yours.</p>' +
      '<h2 class="sec-title hub-title" id="hub-h" tabindex="-1">Your hub</h2>' +
      '<p class="sec-note">' + esc(HUB_LEDE) + '</p>' +
      hubStepperHTML(steps, ['<span class="mono">' + user + '</span>', '<span class="mono">' + name + '</span>', '', '']) +
      '<p class="hub-addr"><span class="small">Its address</span><span class="mono">' + esc(HUB.links.site(user, name)) + '</span></p>' +
      '<p class="small hub-saved">Last saved today.</p>' +
      '<p class="small">Back to yours to make your own hub.</p></div></section>';
  }

  // Redraw only the card (not the ground) after a hub change.
  function updateHubCard() {
    if (view !== 'seed') return;
    const sec = $('#hub-sec');
    if (!sec) return;
    const tmp = doc.createElement('div');
    tmp.innerHTML = hubCardHTML();
    if (tmp.firstElementChild) sec.replaceWith(tmp.firstElementChild);
    // the sheet's opener may be gone (Save to my hub again, once saved): land on the card's own button
    if (ui.sheet === 'hub' && ui.openerSig) { let o = null; try { o = $(ui.openerSig); } catch (e) { o = null; } if (!o) ui.openerSig = '#hub-go'; }
  }

  function hubCommit(patch) {
    commit(F.setHub(S, patch, now()), { noRender: true });
    updateHubCard();
  }

  // -- the Hub sheet

  function openHub(step, opener) {
    if (!HUB || !deck || readOnly() || hubSteps(S).length !== 4) return;
    const h = hubOf(S);
    const hs = ui.hub;
    hs.step = Math.max(0, Math.min(hubReach(S), step | 0));
    hs.user = h.user || '';
    hs.have = !!h.user;
    hs.choice = h.name && !HUB.isSiteRepo(h.user, h.name) ? 'other' : 'site';
    hs.other = hs.choice === 'other' ? h.name : '';
    hs.priv = !!h.private;
    hs.notes = false; hs.own = false; hs.busy = false; hs.msg = ''; hs.text = null; hs.done = false;
    hubToken++;
    openSheet('hub', 'Your hub', hubHTML, opener, { wide: true });
    hubAfterRender();
    say('Your hub. Step ' + (hs.step + 1) + ' of 4: ' + HUB_TITLES[hs.step] + '.');
  }

  function hubRefresh() {
    if (ui.sheet !== 'hub') return;
    refreshSheet();
    hubAfterRender();
  }

  function hubAfterRender() {
    const ta = $('#hub-text');
    if (ta && ui.hub.text != null) ta.value = ui.hub.text;
    hubSync();
  }

  function hubGo(i) {
    if (ui.sheet !== 'hub') return;
    const hs = ui.hub;
    hs.step = Math.max(0, Math.min(hubReach(S), i | 0));
    hs.msg = ''; hs.text = null; hs.busy = false; hs.done = false;
    hubToken++;
    hubRefresh();
    $('#sheet-body').scrollTop = 0;
    const hd = $('#hub-step-h');
    if (hd) hd.focus({ preventScroll: true });
    say('Step ' + (hs.step + 1) + ' of 4: ' + HUB_TITLES[hs.step] + '.');
  }

  function hubHTML() {
    const hs = ui.hub;
    const steps = hubSteps(S);
    const reach = hubReach(S);
    const nav = '<nav aria-label="The four steps"><ol class="hubnav">' + steps.map((s, i) => {
      const word = s.done ? 'Done' : s.next ? 'Next' : 'Not yet';
      const cls = (s.done ? 'done' : s.next ? 'next' : 'notyet') + (i === hs.step ? ' cur' : '');
      const seen = '<span class="mk">' + (i + 1) + '</span><span class="t">' + HUB_NAV[i] + '</span><span class="st">' + word + '</span>';
      const said = 'Step ' + (i + 1) + ', ' + HUB_TITLES[i] + ': ' + word + (i === hs.step ? ', this step' : '');
      const inner = '<span aria-hidden="true" class="hubnav-in">' + seen + '</span><span class="visually-hidden">' + esc(said) + '</span>';
      if (i === hs.step) return '<li class="' + cls + '" aria-current="step"><span class="hubnav-b">' + inner + '</span></li>';
      if (i <= reach) return '<li class="' + cls + '"><button type="button" class="hubnav-b" data-act="hub-step" data-step="' + i + '">' + inner + '</button></li>';
      return '<li class="' + cls + '"><span class="hubnav-b off">' + inner + '</span></li>';
    }).join('') + '</ol></nav>';
    const body = [hubStep1, hubStep2, hubStep3, hubStep4][hs.step]();
    return nav + '<section class="hubstep" aria-labelledby="hub-step-h">' +
      '<h3 class="hubstep-h" id="hub-step-h" tabindex="-1" data-autofocus>Step ' + (hs.step + 1) + ' of 4 · ' + HUB_TITLES[hs.step] + '</h3>' + body + '</section>';
  }

  // A link to one of GitHub's pages, opened in a new tab; data-say is announced when it is pressed.
  function hubLink(id, cls, href, text, sayText, act) {
    return '<a class="btn ' + cls + '" id="' + id + '" href="' + esc(href) + '" target="_blank" rel="noopener" data-act="' + (act || 'hub-out') + '"' +
      (sayText ? ' data-say="' + esc(sayText) + '"' : '') + '>' + text + icon('out') + NEW_TAB + '</a>';
  }

  // One choice (a radio or a checkbox) with its words beside it; the whole row is the target.
  function hubOpt(type, name, value, on, title, small) {
    return '<label class="opt"><input type="' + type + '" ' + (type === 'radio' ? 'name="' + name + '" value="' + value + '"' : 'id="' + name + '"') + (on ? ' checked' : '') + '>' +
      '<span><b>' + title + '</b><span class="small">' + small + '</span></span></label>';
  }

  // Step 1: a GitHub account, and the username (checked against GitHub's rules as it is typed).
  function hubStep1() {
    const hs = ui.hub;
    const signup = hubLink('hub-signup', hs.have ? 'btn-quiet' : 'btn-keep btn-big', HUB.links.signup(), 'Make a GitHub account',
      'GitHub’s sign-up opened in a new tab. Come back here once you’re in.');
    let html = '<p>Your hub lives in your own GitHub account: free, and yours to keep. 5s fills in everything on GitHub for you; you only press its buttons.</p>';
    if (!hs.have) {
      html += '<div class="hubguide">' + signup +
        '<ol class="guide3"><li>Pick a username you like: it becomes your hub’s address, username.github.io.</li>' +
        '<li>Use an email you can open now: GitHub sends you a code to type in.</li>' +
        '<li>Once you’re in, come back to this tab.</li></ol>' +
        '<div class="actions"><button type="button" class="btn" data-act="hub-have" id="hub-have">I have one</button></div></div>';
    } else {
      html += '<div class="row-gap hub-alt"><span class="small">No account yet?</span>' + signup +
        '<span class="small">Signed out?</span>' + hubLink('hub-login', 'btn-quiet', HUB.links.login(), 'Sign in to GitHub', 'GitHub’s sign-in opened in a new tab.') + '</div>';
    }
    return html + '<form class="field hubform" data-form="hub-user">' +
      '<label for="hub-user">Your GitHub username</label>' +
      '<input type="text" id="hub-user" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="120" value="' + esc(hs.user) + '" aria-describedby="hub-user-msg hub-user-note">' +
      '<p class="hubmsg" id="hub-user-msg"></p>' +
      '<p class="small" id="hub-user-note">It’s public on GitHub already. 5s keeps it only to fill in GitHub’s forms for you; it never goes in your seed.</p>' +
      '<div class="actions"><button type="submit" class="btn btn-ink btn-big" id="hub-user-go">Use this username</button></div></form>';
  }

  function hubUserCheck(v) {
    const t = String(v || '').trim();
    if (!t) return { ok: false, bad: false, html: 'Letters, numbers and single hyphens, as on GitHub.' };
    const r = HUB.rules.user(t);
    if (r.ok) return { ok: true, bad: false, html: '<span>That works. Your hub’s address can be <b class="mono">' + esc(HUB.links.site(r.fixed, '')) + '</b></span>' };
    return {
      ok: false, bad: true,
      html: '<span>' + esc(r.reason) + '</span>' +
        (r.fixed && r.fixed !== t ? '<button type="button" class="btn btn-quiet" data-act="hub-fix-user" data-fix="' + esc(r.fixed) + '">Use “' + esc(r.fixed) + '”</button>' : ''),
    };
  }

  // Step 2: the hub's name and who can see it, then GitHub's "new" page, filled in.
  function hubStep2() {
    const hs = ui.hub;
    const user = hubOf(S).user || '';
    const n = hubName();
    return '<p>Your hub is your own place on GitHub, made to hold your seed. 5s fills in GitHub’s form; you press one button there.</p>' +
      '<fieldset class="hubset"><legend>Your hub’s name</legend>' +
        hubOpt('radio', 'hub-name', 'site', hs.choice === 'site', '<span class="mono">' + esc(HUB.suggest(user).site) + '</span>', 'Becomes a website by itself.') +
        hubOpt('radio', 'hub-name', 'other', hs.choice === 'other', 'Another name', 'One more tap at the end makes it a website.') +
        '<div class="field hub-other" id="hub-other-w"' + (hs.choice === 'other' ? '' : ' hidden') + '><label for="hub-other">Your hub’s other name</label>' +
          '<input type="text" id="hub-other" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="120" placeholder="' + esc(HUB.suggest(user).plain) + '" value="' + esc(hs.other) + '" aria-describedby="hub-name-msg"></div>' +
        '<p class="hubmsg" id="hub-name-msg"></p>' +
      '</fieldset>' +
      '<fieldset class="hubset"><legend>Who can see it</legend>' +
        hubOpt('radio', 'hub-vis', 'public', !hs.priv, 'Public', 'Anyone can see it, and it becomes a website.') +
        hubOpt('radio', 'hub-vis', 'private', hs.priv, 'Private', 'Only you can see it; it won’t be a website.') +
      '</fieldset>' +
      '<div class="hubdo">' +
        hubLink('hub-new', 'btn-keep btn-big', hubNewHref(), 'Make my hub on GitHub',
          'GitHub opened in a new tab, filled in. Press the green Create repository button there, then come back.', 'hub-new') +
        '<p class="hubsay">Press the green <q class="gh">Create repository</q> button, then come back.</p>' +
        '<p class="small hubcopy"><span>GitHub’s form should already say <b class="mono" id="hub-name-text">' + esc(n.fixed) + '</b>. If it doesn’t, copy the name and paste it in.</span>' +
        '<button type="button" class="btn btn-quiet" data-act="hub-copy-name" id="hub-copy-name">Copy name</button></p>' +
      '</div>' +
      '<div class="actions"><button type="button" class="btn btn-ink btn-big" data-act="hub-made" id="hub-made">I made it</button></div>';
  }

  // The hub's name as chosen now.
  function hubName() {
    const hs = ui.hub;
    const raw = String((hs.choice === 'other' ? hs.other : HUB.suggest(hubOf(S).user || '').site) || '').trim();
    const r = HUB.rules.repo(raw);
    return { raw, fixed: r.fixed, ok: r.ok, reason: r.reason };
  }

  function hubNameCheck() {
    if (ui.hub.choice !== 'other') return { ok: true, bad: false, html: '' };
    const n = hubName();
    const user = hubOf(S).user || '';
    if (!n.raw) return { ok: false, bad: false, html: 'Letters, numbers, hyphens, underscores and full stops.' };
    if (n.ok) {
      return { ok: true, bad: false, html: '<span>That works. ' + (HUB.isSiteRepo(user, n.fixed) ? 'It becomes a website by itself, at ' : 'Once its address is turned on, it will be ') +
        '<b class="mono">' + esc(HUB.links.site(user, n.fixed)) + '</b></span>' };
    }
    return {
      ok: false, bad: true,
      html: '<span>' + esc(n.reason) + '</span>' +
        (n.fixed && n.fixed !== n.raw ? '<button type="button" class="btn btn-quiet" data-act="hub-fix-name" data-fix="' + esc(n.fixed) + '">Use “' + esc(n.fixed) + '”</button>' : ''),
    };
  }

  function hubNewHref() { return HUB.links.newRepo({ name: hubName().fixed, description: HUB_DESC, private: ui.hub.priv }); }

  // Step 3: the hub file (built here from the seed), then GitHub's upload page.
  function hubStep3() {
    const hs = ui.hub;
    const h = hubOf(S);
    let file = '<button type="button" class="btn btn-keep btn-big" data-act="hub-file" id="hub-file"' + (hs.busy ? ' aria-disabled="true"' : '') + '>' +
      (hs.busy ? 'Making your hub file…' : 'Save my hub file') + '</button>' +
      (ui.downloads ? '' : '<p class="small">This view can’t save files, so 5s shows the file’s text for you to copy.</p>') +
      '<p class="hubmsg" id="hub-file-msg">' + esc(hs.msg) + '</p>';
    let where;
    if (hs.text != null) {
      file += '<label class="field hubfile"><span>Your hub file, index.html</span><textarea id="hub-text" readonly spellcheck="false"></textarea></label>' +
        '<div class="row-gap"><button type="button" class="btn" data-act="hub-copy-file" id="hub-copy-file">Copy</button></div>';
      // No file to drag: GitHub's own editor takes the text, filled in with the file's name.
      where = h.savedAt
        ? hubLink('hub-paste', 'btn-big', HUB.links.repo(h.user, h.name) + '/edit/main/index.html', 'Open my hub file on GitHub', 'GitHub opened in a new tab.') +
          '<p class="hubsay">Select all of its text, paste yours over it, and press <q class="gh">Commit changes</q>.</p>'
        : hubLink('hub-paste', 'btn-big', HUB.links.repo(h.user, h.name) + '/new/main?filename=index.html', 'Open a new file in my hub', 'GitHub opened in a new tab.') +
          '<p class="hubsay">Paste the text in and press <q class="gh">Commit changes</q>.</p>';
    } else {
      where = hubLink('hub-upload', 'btn-big', HUB.links.upload(h.user, h.name), 'Open the upload page', 'GitHub’s upload page opened in a new tab.') +
        '<p class="hubsay">Drag the file in and press <q class="gh">Commit changes</q>.</p>' +
        '<p class="small">If GitHub shows its quick setup instead, press <q class="gh">uploading an existing file</q>.</p>';
    }
    return '<p>5s makes your hub file: one page with your seed code, your philosophy, what you keep and pass, your colours, your rooms and your ground. Then you drop it into your hub.</p>' +
      '<fieldset class="hubset"><legend>What goes on it</legend>' +
        hubOpt('checkbox', 'hub-notes', '', hs.notes, 'Include my notes', 'Off: your notes stay private to you.') +
        hubOpt('checkbox', 'hub-own', '', hs.own, 'Include my own images', 'Off: the pictures you brought in stay private.') +
      '</fieldset>' +
      '<ol class="hubdo3">' +
        '<li><div class="hubdo">' + file + '</div></li>' +
        '<li><div class="hubdo">' + where + '</div></li>' +
        '<li><div class="hubdo"><button type="button" class="btn btn-ink btn-big" data-act="hub-saved" id="hub-saved">I saved it</button></div></li>' +
      '</ol>';
  }

  // Step 4: the address; for a hub with another name, the one choice on GitHub that turns it on.
  function hubStep4() {
    const hs = ui.hub;
    const h = hubOf(S);
    let html = '';
    if (hs.done) {
      html += '<div class="hubdone" id="hub-done" tabindex="-1"><p><b>Your hub is open.</b> When your seed changes, Seed offers <b>Save to my hub again</b>.</p>' +
        '<div class="actions"><button type="button" class="btn" data-act="close-sheet">Close</button></div></div>';
    }
    if (h.private) {
      html += '<p>Your hub is private, so it has no address: only you can see it, on GitHub.</p>' +
        '<div class="actions">' + hubLink('hub-open', 'btn-keep btn-big', HUB.links.repo(h.user, h.name), 'Open my hub on GitHub', 'Your hub opened in a new tab.') + '</div>' +
        '<p class="small">To give it an address, make it public on GitHub, then come back here.</p>';
    } else {
      const addr = HUB.links.site(h.user, h.name);
      if (!HUB.isSiteRepo(h.user, h.name)) {
        html += '<div class="hubonce"><p><b>One more tap first.</b> A hub with another name needs its address turned on, once.</p>' +
          '<div class="actions">' + hubLink('hub-turnon', 'btn-big', HUB.links.pagesSettings(h.user, h.name), 'Turn on my hub’s address', 'GitHub opened in a new tab.') + '</div>' +
          '<p>On that GitHub page, make one choice:</p>' +
          '<ol class="guide3"><li>Under <q class="gh">Source</q>, choose <q class="gh">Deploy from a branch</q>.</li>' +
          '<li>Under <q class="gh">Branch</q>, choose <q class="gh">main</q> and <q class="gh">/ (root)</q>.</li>' +
          '<li>Press <q class="gh">Save</q>.</li></ol></div>';
      }
      html += '<p class="hub-addr big"><span class="small">Your hub’s address</span>' +
        '<a id="hub-addr" href="' + esc(addr) + '" target="_blank" rel="noopener" data-act="hub-out" data-say="Your hub opened in a new tab.">' + esc(addr) + NEW_TAB + '</a></p>' +
        '<div class="actions">' + hubLink('hub-open', 'btn-keep btn-big', addr, 'Open my hub', 'Your hub opened in a new tab.') + '</div>' +
        '<p class="small">It can take a minute to appear. If GitHub says <q class="gh">404</q>, wait a minute and open it again.</p>';
    }
    return html + '<div class="actions"><button type="button" class="btn btn-ink btn-big" data-act="hub-opened" id="hub-opened">I opened it</button></div>';
  }

  // Keep the live parts of the sheet in step with what is typed and chosen, without redrawing it.
  function hubSync() {
    if (ui.sheet !== 'hub' || !HUB) return;
    const hs = ui.hub;
    const um = $('#hub-user-msg');
    if (um) {
      const r = hubUserCheck(hs.user);
      um.innerHTML = r.html;
      um.className = 'hubmsg' + (r.bad ? ' bad' : r.ok ? ' good' : '');
      const i = $('#hub-user');
      if (i) i.setAttribute('aria-invalid', r.bad ? 'true' : 'false');
    }
    const nm = $('#hub-name-msg');
    if (nm) {
      const w = $('#hub-other-w');
      if (w) w.hidden = hs.choice !== 'other';
      const r = hubNameCheck();
      nm.innerHTML = r.html;
      nm.className = 'hubmsg' + (r.bad ? ' bad' : r.ok && hs.choice === 'other' ? ' good' : '');
      const oi = $('#hub-other');
      if (oi) oi.setAttribute('aria-invalid', r.bad ? 'true' : 'false');
      const a = $('#hub-new');
      if (a) a.setAttribute('href', hubNewHref());
      const nt = $('#hub-name-text');
      if (nt) nt.textContent = hubName().fixed || '…';
    }
  }

  function hubInput(t) {
    if (t.id === 'hub-user') ui.hub.user = t.value;
    else if (t.id === 'hub-other') ui.hub.other = t.value;
    hubSync();
  }

  function hubChange(t) {
    const hs = ui.hub;
    if (t.name === 'hub-name') {
      hs.choice = t.value === 'other' ? 'other' : 'site';
      if (hs.choice === 'other' && !hs.other.trim()) {
        hs.other = HUB.suggest(hubOf(S).user || '').plain;
        const i = $('#hub-other');
        if (i) i.value = hs.other;
      }
    } else if (t.name === 'hub-vis') {
      hs.priv = t.value === 'private';
    } else if (t.id === 'hub-notes' || t.id === 'hub-own') {
      if (t.id === 'hub-notes') hs.notes = t.checked; else hs.own = t.checked;
      // a file already made no longer matches what goes on it
      if (hs.text != null || hs.msg) { hs.text = null; hs.msg = ''; hubToken++; hs.busy = false; hubRefresh(); }
      return;
    }
    hubSync();
  }

  function hubFix(sel, v) {
    const i = $(sel);
    if (!i || v == null) return;
    i.value = v;
    hubInput(i);
    i.focus();
    say('Changed to ' + v + '.');
  }

  function hubOut(t) { const m = t && t.getAttribute('data-say'); if (m) say(m); }

  function hubHave() {
    ui.hub.have = true;
    hubRefresh();
    const i = $('#hub-user');
    if (i) i.focus();
    say('Type your GitHub username.');
  }

  function hubUseUser() {
    const inp = $('#hub-user');
    if (!inp || !HUB) return;
    ui.hub.user = inp.value;
    hubSync();
    const r = HUB.rules.user(inp.value);
    if (!r.ok) {
      inp.focus();
      say(r.reason + (r.fixed && r.fixed !== inp.value.trim() ? ' Or use ' + r.fixed + '.' : ''));
      return;
    }
    const h = hubOf(S);
    const patch = { user: r.fixed, mode: 'links' };
    if (h.user && h.user.toLowerCase() !== r.fixed.toLowerCase()) {
      // another account: a hub named after the old username isn't this one's, and nothing is made here yet
      if (h.name && HUB.isSiteRepo(h.user, h.name)) patch.name = null;
      if (h.madeAt) { patch.madeAt = null; patch.savedAt = null; patch.savedCode = null; }
    }
    hubCommit(patch);
    hubGo(1);
  }

  // The name and visibility are kept as soon as GitHub's page is opened, so a reload while the
  // person is over there loses nothing. A new name means a new hub: it is still to be made and saved.
  function hubCommitMake() {
    const n = hubName();
    const h = hubOf(S);
    const patch = { private: ui.hub.priv, mode: 'links' };
    if (n.fixed) patch.name = n.fixed;
    if (h.madeAt && patch.name && h.name !== patch.name) { patch.madeAt = null; patch.savedAt = null; patch.savedCode = null; }
    const next = F.setHub(S, patch, now());
    if (JSON.stringify(next.hub) === JSON.stringify(S.hub)) return;
    hubCommit(patch);
    if (patch.madeAt === null) hubRefresh();
  }

  function hubMade() {
    const n = hubName();
    if (!n.ok) {
      hubSync();
      const i = ui.hub.choice === 'other' ? $('#hub-other') : null;
      if (i) i.focus();
      say(n.reason || 'Give your hub a name.');
      return;
    }
    const h = hubOf(S);
    const patch = { name: n.fixed, private: ui.hub.priv, mode: 'links', madeAt: true };
    if (h.madeAt && h.name && h.name !== n.fixed) { patch.savedAt = null; patch.savedCode = null; }
    hubCommit(patch);
    hubGo(2);
  }

  async function hubSaveFile() {
    const hs = ui.hub;
    if (hs.busy || readOnly() || !HUBPAGE || ui.sheet !== 'hub') return;
    const token = ++hubToken;
    hs.busy = true; hs.msg = ''; hs.text = null;
    const b = $('#hub-file');
    if (b) { b.textContent = 'Making your hub file…'; b.setAttribute('aria-disabled', 'true'); }
    const m = $('#hub-file-msg');
    if (m) m.textContent = '';
    say('Making your hub file.');
    let html = null;
    try { html = await hubBuildFile(hs.notes, hs.own); } catch (e) { html = null; }
    if (token !== hubToken || ui.sheet !== 'hub') return;
    let showText = false;
    if (!html) {
      hs.msg = 'Couldn’t make your hub file. Try again.';
    } else if (!ui.downloads) {
      showText = true;
    } else {
      try {
        await ui.downloads.save({ filename: 'index.html', data: html });
        hs.msg = 'Saved your hub file, index.html. Next, open the upload page and drag it in.';
      } catch (e) {
        const code = e && e.code;
        if (code === 'declined') hs.msg = 'Not saved. Press Save my hub file to try again.';
        else if (code === 'rate_limited') hs.msg = 'Another save is waiting. Try again in a moment.';
        else {
          // the file can't be saved in this view: its text, to copy, does the same job
          if (!code || ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].indexOf(code) >= 0) ui.downloads = null;
          showText = true;
        }
      }
      if (token !== hubToken || ui.sheet !== 'hub') return;
    }
    hs.busy = false;
    if (showText) { hs.text = html; hs.msg = 'Here is your hub file. Copy all of it, then paste it into a new file in your hub.'; }
    hubRefresh();
    const f = showText ? $('#hub-copy-file') : $('#hub-file');
    if (f) f.focus({ preventScroll: !showText });
    say(hs.msg);
  }

  // The hub page, built from the current seed (FiveSHubPage.build), with the ground drawn here.
  async function hubBuildFile(includeNotes, includeOwn) {
    const st = S;
    const t = now();
    const P = prof(st);
    const seed = F.exportSeed(st, deck, t);
    const ground = await hubGround(st, P, includeOwn);
    const own = st.own.filter(Boolean);
    let ownThumbs = null;
    if (includeOwn && own.length) {
      // In seed.own order. The page finds a thumbnail by name first; a name two things share (often
      // "Untitled") is given by position only, so one thing's picture never stands in for another's.
      const names = own.map((o) => (o.name && o.name.trim()) || 'Untitled');
      const count = new Map();
      names.forEach((n) => count.set(n, (count.get(n) || 0) + 1));
      ownThumbs = await Promise.all(own.map(async (o, i) => {
        if (fromApps(o)) return null; // a picture from another site is someone else's: never on the person's public hub
        let src = null;
        if (imgStore) { try { const v = await imgStore.get(o.id); src = v ? v.thumb || null : null; } catch (e) { src = null; } }
        if (!src) return null;
        return count.get(names[i]) === 1 ? { name: names[i], src } : src;
      }));
    }
    // Rooms by card id (exact, where a work slug may name more than one card); brought things by what they are.
    const slotRef = (id) => {
      const c = id ? cardOf(id, st) : null;
      if (!c) return null;
      return c.own ? { own: true, kind: c.kind, title: c.title, colours: c.colours, source: c.source } : id;
    };
    const sets = st.sets.map((s) => { const o = { name: s.name || null }; for (const k of SLOTS) o[k] = slotRef(s[k]); return o; });
    const labelled = (list) => list.map((e) => Object.assign({}, e, { label: chipLabel(e) }));
    return HUBPAGE.build({
      seed, deck, sets,
      profile: Object.assign({}, P, { positive: labelled(P.positive), negative: labelled(P.negative) }),
      philosophy: F.philosophy(P, deck),
      groundPng: ground ? ground.png : null, groundAlt: ground ? ground.words : '',
      includeNotes: !!includeNotes, includeOwnImages: !!includeOwn, ownThumbs, generatedAt: t,
    });
  }

  // The ground as a PNG: drawn on a canvas of its own, off the page, from the deck's own images (same
  // origin, so the canvas stays readable). Brought-in surfaces are drawn only with "Include my own images".
  async function hubGround(st, P, includeOwn) {
    if (!G) return null;
    const surfaces = [];
    for (const id of P.keptByKind.surface) { const c = cardOf(id, st); if (c && c.img && !c.own) surfaces.push({ src: c.img, crop: null }); }
    if (includeOwn) {
      for (const o of st.own) {
        if (!o || o.let != null || !Array.isArray(o.crop)) continue;
        if (fromApps(o)) continue; // someone else's picture (from a link or a data file): not on a public page
        let src = null;
        if (imgStore) { try { const v = await imgStore.get(o.id); src = v && v.img; } catch (e) { src = null; } }
        if (src) surfaces.push({ src, crop: o.crop });
      }
    }
    const h = latestHouse(st);
    const cv = doc.createElement('canvas');
    cv.width = 800; cv.height = 640; // off the page, the renderer keeps this size (the hub page shows it up to 760 px wide)
    let res = null;
    try {
      res = await G.render(cv, {
        rand: F.prng(F.seedCode(st)), surfaces, kept: P.keptColours, passed: P.passedColours,
        house: h ? h.house : null, size: groundSize(P.judged), grow: false, theme: 'light',
      });
    } catch (e) { res = null; }
    if (!res) return null;
    let png = null;
    try { png = cv.toDataURL('image/png'); } catch (e) { png = null; } // a tainted canvas can't be read: no ground then
    if (!png || png.length < 200) return null;
    // the page is read by others too: "surfaces kept", not "surfaces you kept"
    let words = String(res.description || '').replace(/ you (kept|passed)/g, ' $1');
    if (h) words += ' The house is the latest set' + (h.set.name ? ', “' + h.set.name + '”' : '') + '.';
    return { png, words };
  }

  function hubCopy(text, el, what, btn) {
    const done = () => {
      say(what + ' copied.');
      if (btn) { const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { if (btn.isConnected) btn.textContent = was; }, 2000); }
    };
    const fallback = () => {
      if (!el) return;
      el.hidden = false;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') { el.focus(); el.select(); }
      else { const r = doc.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      say('Selected. Copy it from there.');
    };
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) { fallback(); return; }
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) { fallback(); }
  }

  function hubCopyName() { const n = hubName(); if (n.fixed) hubCopy(n.fixed, $('#hub-name-text'), 'The name ' + n.fixed, $('#hub-copy-name')); }
  function hubCopyFile() { if (ui.hub.text != null) hubCopy(ui.hub.text, $('#hub-text'), 'Your hub file', $('#hub-copy-file')); }

  function hubSaved() {
    hubCommit({ savedAt: true });
    hubGo(3);
  }

  function hubOpened() {
    commit(F.markSeen(S, 'hub-opened'), { noRender: true });
    updateHubCard();
    ui.hub.done = true;
    hubRefresh();
    const d = $('#hub-done');
    if (d) d.focus();
    say('Your hub is open.');
  }

  // ================================================================ EXAMPLE MODE

  function setExample(on) {
    if (!deck) return;
    if (on) {
      const day = F.dayOf(now());
      if (!EX || exDay !== day) { EX = F.exampleState(deck, now()); exDay = day; }
    }
    example = !!on;
    ui.room = null; ui.roomKey = null; ui.seedKey = null; ui.confirm = null; ui.swatch = null; ui.splitAll = {};
    updateChrome();
    renderView();
    say(on ? 'Showing an example taste. It isn’t yours and is never saved.' : 'Back to your own taste.');
    const h = $('#view-' + view + ' h1');
    if (h && on) h.focus({ preventScroll: true });
  }

  // ================================================================ EVENTS

  function onAct(t, e) {
    const act = t.getAttribute('data-act');
    const id = t.getAttribute('data-id');
    switch (act) {
      case 'keep': decide(true, 'button'); break;
      case 'pass': decide(false, 'button'); break;
      case 'undo': doUndo(); break;
      case 'closer': openCloser(t); break;
      case 'closer-keep': closeSheet(); decide(true, 'button'); break;
      case 'closer-pass': closeSheet(); decide(false, 'button'); break;
      case 'detail': openDetail(id, t); break;
      case 'start':
        commit(F.markSeen(S, 'intro'), { noRender: true });
        renderSort();
        ui.shownAt = performance.now(); ui.counterKey = ''; updateCounter();
        { const k = $('#btn-keep'); if (k) k.focus({ preventScroll: true }); }
        say('Today’s five. ' + describeBefore(cardOf(F.currentCard(S), S)));
        break;
      case 'replay-intro':
        closeSheet();
        S = Object.assign({}, S, { seen: Object.assign({}, S.seen, { intro: 0 }) });
        persist();
        showView('sort');
        { const b = $('#btn-start'); if (b) b.focus(); }
        break;
      case 'another':
        commit(F.startFive(S, deck, now()), { noRender: true });
        hideStrip();
        renderSort();
        { const k = $('#btn-keep'); if (k) k.focus({ preventScroll: true }); }
        say('Another five. ' + describeBefore(cardOf(F.currentCard(S), S)));
        break;
      case 'goto': {
        // data-focus: a part of the view to land on (the Path's hub milestones land on Your hub)
        const f = t.getAttribute('data-focus');
        ui.opener = null; ui.openerSig = f ? '#' + f : null;
        closeSheet();
        showView(t.getAttribute('data-view'), { focus: true });
        const el = f ? doc.getElementById(f) : null;
        if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'start' }); }
        break;
      }
      case 'about': openAbout(t); break;
      case 'path': openPath(t); break;
      case 'close-sheet': closeSheet(); break;
      case 'ring': {
        const on = S.opts.ring === false;
        commit(F.setOpt(S, 'ring', on), { noRender: true });
        t.setAttribute('aria-checked', on ? 'true' : 'false');
        ui.counterKey = '';
        if (view === 'sort') updateCounter();
        say(on ? 'Five-second ring on.' : 'Five-second ring off.');
        break;
      }
      case 'bring': openBring(t); break;
      case 'bring-add': addBrought(); break;
      case 'bring-drop': ui.bring.items = ui.bring.items.filter((i) => i.key !== t.getAttribute('data-key')); updateBring(); { const p = $('#bring-pick'); if (p) p.focus(); } break;
      case 'note-turn': openNote({ q: 'turn', ref: id }, t); break;
      case 'note-free': openNote({ q: 'free', ref: null }, t); break;
      case 'example-on': setExample(true); break;
      case 'example-off': setExample(false); break;
      case 'split-all': ui.splitAll[t.getAttribute('data-key')] = !ui.splitAll[t.getAttribute('data-key')]; renderView(); { const b = $('[data-act="split-all"][data-key="' + t.getAttribute('data-key') + '"]'); if (b) b.focus(); } break;
      case 'swatch': {
        const h = t.getAttribute('data-hex');
        ui.swatch = ui.swatch === h ? null : h;
        $$('.swatch').forEach((s) => s.setAttribute('aria-pressed', s.getAttribute('data-hex') === ui.swatch ? 'true' : 'false'));
        const out = $('#swatch-out');
        if (out) out.innerHTML = ui.swatch ? '<span class="sw" style="background:' + ui.swatch + '"></span> <span class="mono">' + ui.swatch.toUpperCase() + '</span> ' + esc(F.colourName(ui.swatch)) : '<span class="small">Press a colour for its name and hex.</span>';
        if (ui.swatch) say(F.colourName(ui.swatch) + ', ' + ui.swatch.toUpperCase().split('').join(' '));
        break;
      }
      case 'chooser': openChooser(t.getAttribute('data-slot'), t); break;
      case 'three-more': { const s = t.getAttribute('data-slot'); ui.chooserPage[s] = (ui.chooserPage[s] || 0) + 1; refreshSheet(); say('Three more.'); break; }
      case 'pick': {
        const s = t.getAttribute('data-slot');
        ui.room = Object.assign({}, ui.room, { [s]: id });
        const c = cardOf(id);
        ui.openerSig = '#main .slot-' + s;
        ui.opener = null;
        closeSheet();
        renderView();
        say(SLOT_LABEL[s] + ': ' + (s === 'wall' ? listWords(colourWords(c)) : nameLine(c)) + '.');
        const b = $('.slot-' + s);
        if (b) b.focus({ preventScroll: true });
        break;
      }
      case 'pin': if (!readOnly()) openPin(t); break;
      case 'open-set': {
        const s = active().sets[Number(t.getAttribute('data-i'))];
        if (s) { ui.room = { wall: s.wall, window: s.window, picture: s.picture, floor: s.floor, object: s.object }; renderView(); $('#main').scrollTop = 0; say('Opened ' + (s.name || 'the set') + ' in the room.'); const b = $('.slot-wall'); if (b) b.focus({ preventScroll: true }); }
        break;
      }
      case 'confirm': ui.confirm = t.getAttribute('data-key'); renderView(); { const y = $('.confirm .btn'); if (y) y.focus(); } break;
      case 'confirm-no': ui.confirm = null; renderView(); break;
      case 'unpin': {
        if (readOnly()) break;
        const i = Number(t.getAttribute('data-i'));
        ui.confirm = null;
        commit(F.unpinSet(S, i));
        say('Set removed.');
        break;
      }
      case 'del-note': {
        if (readOnly()) break;
        ui.confirm = null;
        commit(F.removeNote(S, Number(t.getAttribute('data-i'))));
        say('Note removed.');
        { const b = $('[data-act="note-free"]'); if (b) b.focus(); }
        break;
      }
      case 'remove-ask': ui.removeAsk = true; refreshSheet(); { const y = $('#remove-yes'); if (y) y.focus(); } break;
      case 'remove-no': ui.removeAsk = false; refreshSheet(); { const y = $('#remove-ask'); if (y) y.focus(); } break;
      case 'remove-own': removeOwn(id); break;
      case 'claude': askClaude(); break;
      case 'claude-stop': if (ui.claude.ctl) ui.claude.ctl.abort(); break;
      case 'save-seed': saveSeed(); break;
      case 'copy-seed': copySeed(); break;
      case 'copy-code': copyCode(); break;
      // Your hub
      case 'hub': openHub(Number(t.getAttribute('data-step')) || 0, t); break;
      case 'hub-step': hubGo(Number(t.getAttribute('data-step')) || 0); break;
      case 'hub-have': hubHave(); break;
      case 'hub-fix-user': hubFix('#hub-user', t.getAttribute('data-fix')); break;
      case 'hub-fix-name': hubFix('#hub-other', t.getAttribute('data-fix')); break;
      case 'hub-out': hubOut(t); break;
      case 'hub-new': hubCommitMake(); hubOut(t); break;
      case 'hub-copy-name': hubCopyName(); break;
      case 'hub-made': hubMade(); break;
      case 'hub-file': hubSaveFile(); break;
      case 'hub-copy-file': hubCopyFile(); break;
      case 'hub-saved': hubSaved(); break;
      case 'hub-opened': hubOpened(); break;
      // Connect your apps
      case 'connect': openConnect(t); break;
      case 'door': openDoor(t.getAttribute('data-door')); break;
      case 'doors': openDoor(null); break;
      case 'cx-all': cxSelect(t.getAttribute('data-which'), true); break;
      case 'cx-none': cxSelect(t.getAttribute('data-which'), false); break;
      case 'cx-more': cxMore(); break;
      case 'cx-link-add': cxAddLink(); break;
      case 'cx-file-add': cxAddFile(); break;
      case 'cx-copy': cxCopyAsk(t); break;
      case 'cx-over': cxBringOver(); break;
      case 'cx-pictures': fetchPictures(true); break;
      case 'cx-again': cx.link.done = null; refreshSheet(); { const u = $('#cx-url'); if (u) u.focus(); } break;
      // Where it lives, and Paste a link
      case 'where': openDetail(id, t, true); break;
      case 'where-copy': whereCopy(t); break;
      case 'where-all': { const c = cardOf(ui.detailId, active()); if (c && LK) hubCopy(LK.copyAll(c, deck), $('#where-all'), 'All its links', t); break; }
      case 'paste': openPaste(t); break;
      case 'def-define': pasteDefine(); break;
      case 'def-stop': if (cx.link.ctl) cx.link.ctl.abort(); break;
      case 'def-add': pasteAdd(); break;
      case 'def-drop': pasteDrop(t.getAttribute('data-k'), t.getAttribute('data-v')); break;
      case 'def-keep-card': keepDeckCard(id); break;
      case 'cx-split':
        cx.link.done = null;
        closeSheet();
        showView('split', { focus: true });
        { const h = $('#sec-brought-in'); if (h) h.scrollIntoView({ block: 'start' }); }
        break;
      default: break;
    }
    void e;
  }

  function onForm(form) {
    const kind = form.getAttribute('data-form');
    if (kind === 'oneword') {
      const v = ($('#oneword-in').value || '').trim();
      if (!v) return;
      commit(F.addNote(S, { q: 'five', ref: null, text: v }, now()), { noRender: true });
      renderSummary();
      say('Saved as a note: ' + v + '.');
      const b = $('#summary [data-act="another"]');
      if (b) b.focus({ preventScroll: true });
    } else if (kind === 'note') {
      const ctx = ui.noteCtx || { q: 'free', ref: null };
      const v = ($('#note-text').value || '').trim();
      if (!v) { $('#note-text').focus(); return; }
      commit(F.addNote(S, { q: ctx.q, ref: ctx.ref || null, text: v }, now()));
      closeSheet();
      say('Note saved. It’s in See under Your notes.');
    } else if (kind === 'pin') {
      const name = ($('#pin-name').value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      const t = now();
      let st = F.pinSet(S, Object.assign({}, ui.room, { name }), t);
      if (name) st = F.addNote(st, { q: 'set', ref: 'set:' + Math.floor(t / 1000), text: name }, t);
      commit(st);
      closeSheet();
      say('Set pinned' + (name ? ': ' + name : '') + '.');
    } else if (kind === 'hub-user') {
      hubUseUser();
    } else if (kind === 'connect-link') {
      cxReadLink();
    }
  }

  function wire() {
    doc.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) { showView(tab.getAttribute('data-view')); return; }
      const t = e.target.closest('[data-act]');
      if (t && !t.disabled) onAct(t, e);
    });
    doc.addEventListener('submit', (e) => { e.preventDefault(); onForm(e.target); });
    wireConnect();
    doc.addEventListener('input', (e) => {
      const t = e.target;
      if (t && (t.id === 'hub-user' || t.id === 'hub-other')) { hubInput(t); return; }
      const key = t.getAttribute && t.getAttribute('data-key');
      const field = t.getAttribute && t.getAttribute('data-field');
      if (!key || !field) return;
      const it = ui.bring.items.find((i) => i.key === key);
      if (it) it[field] = t.value;
    });
    doc.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'bring-file') { addFiles(t.files); t.value = ''; return; }
      if (t.name === 'hub-name' || t.name === 'hub-vis' || t.id === 'hub-notes' || t.id === 'hub-own') { hubChange(t); return; }
      const key = t.getAttribute && t.getAttribute('data-key');
      const field = t.getAttribute && t.getAttribute('data-field');
      if (!key || !field) return;
      const it = ui.bring.items.find((i) => i.key === key);
      if (it) it[field] = t.value;
      if (field === 'kind') $$('input[name="' + t.name + '"]').forEach((r) => r.parentElement.classList.toggle('on', r.checked));
    });
    doc.addEventListener('paste', (e) => {
      if (ui.sheet !== 'bring') return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      const files = [];
      for (const it of Array.from(items)) if (it.kind === 'file' && /^image\//.test(it.type)) { const f = it.getAsFile(); if (f) files.push(f); }
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
    // drag and drop onto the sheet
    dlg.addEventListener('dragover', (e) => { if (ui.sheet !== 'bring') return; e.preventDefault(); const d = $('#drop'); if (d) d.classList.add('over'); });
    dlg.addEventListener('dragleave', (e) => { if (ui.sheet !== 'bring' || dlg.contains(e.relatedTarget)) return; const d = $('#drop'); if (d) d.classList.remove('over'); });
    dlg.addEventListener('drop', (e) => {
      if (ui.sheet !== 'bring') return;
      e.preventDefault();
      const d = $('#drop'); if (d) d.classList.remove('over');
      addFiles(e.dataTransfer && e.dataTransfer.files);
    });
    // the keyboard on Sort
    doc.addEventListener('keydown', (e) => {
      if (dlg.open || view !== 'sort' || !deck) return;
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.altKey) return;
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey) {
        if (t && t.closest && t.closest('[role="tablist"]')) return;
        if (!S.seen.intro || F.fiveDone(S)) return;
        e.preventDefault();
        decide(e.key === 'ArrowRight', 'key');
      } else if ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); doUndo();
      } else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); doUndo();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (t && t.closest && t.closest('button, a, [role="button"], [role="tab"], summary, label')) return;
        if (!S.seen.intro || F.fiveDone(S) || !F.currentCard(S)) return;
        e.preventDefault();
        openCloser($('#btn-closer'));
      }
    });
    // the tablist
    $('.tablist').addEventListener('keydown', (e) => {
      const cur = e.target.closest && e.target.closest('.tab');
      const i = VIEWS.indexOf(cur ? cur.getAttribute('data-view') : view);
      let n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % VIEWS.length;
      else if (e.key === 'ArrowLeft') n = (i + VIEWS.length - 1) % VIEWS.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = VIEWS.length - 1;
      if (n < 0) return;
      e.preventDefault();
      showView(VIEWS[n]);
      $('#tab-' + VIEWS[n]).focus();
    });
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.indexOf(v) >= 0 && v !== view) showView(v); });
    // theme and motion changes
    const onTheme = () => { if (view === 'seed') drawGround(true); };
    try { mqDark.addEventListener('change', onTheme); } catch (e) { /* old Safari */ }
    try { new MutationObserver(onTheme).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* no observer */ }
    try { mqReduce.addEventListener('change', () => { ui.counterKey = ''; if (view === 'sort') { updateCounter(); renderStrip(); } }); } catch (e) { /* old Safari */ }
    doc.addEventListener('visibilitychange', () => { if (!doc.hidden && view === 'sort' && deck) { ensureFive(); renderSort(); } });
    // the logo, or its stand-in
    const logo = $('#brand-logo');
    const noLogo = () => { ui.logoOk = false; logo.hidden = true; $('#brand-mark').hidden = false; if (view === 'sort' && !S.seen.intro && deck) renderIntro(); };
    logo.addEventListener('error', noLogo);
    logo.addEventListener('load', () => { ui.logoOk = true; });
    if (logo.complete) { if (logo.naturalWidth) ui.logoOk = true; else noLogo(); }
  }

  // ================================================================ BOOT

  function use(name) {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return Promise.resolve(null);
      return Promise.resolve(c.use(name)).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  }

  async function lightUp() {
    lightConnect();
    use('sample').then((s) => { if (typeof s === 'function') { ui.sample = s; if (view === 'see' && deck) renderSee(); } });
    use('downloads').then((d) => { if (d && typeof d.save === 'function') { ui.downloads = d; if (view === 'seed' && deck) renderSeed(); if (ui.sheet === 'hub') hubRefresh(); } });
    const pair = await Promise.all([use('db'), use('user')]);
    const db = pair[0], user = pair[1];
    if (!db || !user || typeof user.id !== 'function') return;
    let uid = null;
    try { uid = await user.id(); } catch (e) { uid = null; }
    if (!uid) return;
    connectDb(db, uid);
    if (B) {
      try {
        const priv = B.store({ db, uid });
        if (priv.kind === 'private') {
          const old = imgStore;
          imgStore = priv;
          watchStore(priv);
          // Images this device didn't have may be in the private store: look again.
          for (const [k, v] of Array.from(ownImgs)) if (!v) ownImgs.delete(k);
          if (deck && S.own.length) renderView();
          const ids = S.own.map((o) => o.id);
          if (old && ids.length) priv.migrateFrom(old, ids).catch(() => { /* the device copies still show */ });
        }
      } catch (e) { /* stay on the device store */ }
    }
  }

  async function loadDeck() {
    try {
      const r = await fetch('deck.json');
      if (!r.ok) throw new Error('status ' + r.status);
      const d = await r.json();
      if (!d || !Array.isArray(d.cards) || !d.cards.length) throw new Error('empty deck');
      deck = d;
      const A = d.atlas;
      if (A && A.cols) {
        let max = 0;
        for (const c of d.cards) if (isFinite(c.thumb)) max = Math.max(max, c.thumb);
        atlasRows = Math.max(1, Math.ceil((max + 1) / A.cols));
        const im = new Image();
        im.onload = () => {
          const rows = A.cell ? Math.round(im.naturalHeight / A.cell) : atlasRows;
          if (rows && rows !== atlasRows) { atlasRows = rows; if (view !== 'sort') renderView(); }
        };
        im.src = A.src;
      }
    } catch (e) {
      ui.deckError = 'Couldn’t load the cards. Reload the page to try again.';
    }
  }

  async function start(data) {
    if (!F) return;
    if (data && data.state && typeof data.state === 'object') S = F.migrate(data.state);
    wire();
    const h = (location.hash || '').slice(1);
    view = VIEWS.indexOf(h) >= 0 ? h : 'sort';
    showView(view);
    lightUp();
    await loadDeck();
    if (deck) { ensureFive(); checkPath(); }
    updateChrome();
    renderView();
    if (view === 'sort') { ui.shownAt = performance.now(); restartRing(); }
  }

  // Updates published while the page is open keep the state (the viewer's own hook; absent elsewhere).
  const hot = window.claude && window.claude.hot;
  try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ state: S })); } catch (e) { /* no hot updates here */ }
  if (hot && typeof hot.ready === 'function') { try { hot.ready(start); } catch (e) { start({}); } }
  else start((hot && hot.data) || {});
})();

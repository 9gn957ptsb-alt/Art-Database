/* 5s hub page: the person's hub as one standalone HTML document (SPEC.md "Your hub", "The hub page").
 *
 * The page lives on github.io, not in an artifact, so it has its own doctype and head and may show the
 * works' images from Artsy's CDN (the deck's "cdn", carried in the seed as kept[].image). It needs no
 * script: everything is HTML and one inline style, and it works offline except for images and fonts.
 * The seed rides along in <script type="application/json" id="seed">, so the page is also the data.
 *
 * Privacy: nothing beyond what the seed holds. Notes appear (on the page and in the embedded seed)
 * only with includeNotes; brought-in images only with includeOwnImages. Every piece of text that
 * comes from the deck, the person or anyone else is escaped; every address must be https (images may
 * also be data:image); colours must be hex. No name or account appears unless it is in the seed.
 *
 * Pure string building, no DOM, no clock: the same inputs give the same document.
 * Browser: window.FiveSHubPage. Node and Workers: module.exports (or self.FiveSHubPage).
 */
(function (root) {
  'use strict';

  const KINDS = ['image', 'object', 'space', 'surface', 'colour'];
  const KIND_LABEL = { image: 'Image', object: 'Object', space: 'Space', surface: 'Surface', colour: 'Colour' };
  const SLOTS = ['wall', 'window', 'picture', 'floor', 'object'];
  const SLOT_LABEL = { wall: 'Wall', window: 'Window', picture: 'Picture', floor: 'Floor', object: 'Object' };
  const NOTE_Q = {
    turn: 'A turn: what changed?', five: 'One word for a five', set: 'What a set is for',
    bring: 'Why it was saved', free: 'A note',
  };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const FONTS = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Martian+Mono:wght@400;500&family=Unbounded:wght@500;700&display=swap';
  const MAX_SWATCHES = 160;
  const MAX_OWN = 48;

  // ---------------------------------------------------------------- safety

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape text for HTML content and quoted attributes. */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const text = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : typeof s === 'number' && isFinite(s) ? String(s) : '');
  /** An https address with nothing that could break out of an attribute, or null. */
  const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>`\\]+$/i.test(u.trim()) ? u.trim() : null);
  /** An image source: https, or a base64 data:image (png, jpeg, webp, gif), or null. */
  const imgSrc = (u) => {
    if (typeof u !== 'string') return null;
    const s = u.trim();
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s.replace(/\s+/g, '');
    return https(s);
  };
  const hex = (h) => {
    if (typeof h !== 'string') return null;
    let x = h.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(x)) x = x.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(x) ? '#' + x.toLowerCase() : null;
  };
  const hexes = (xs) => (Array.isArray(xs) ? xs.map(hex).filter(Boolean) : []);
  const num = (x, d) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString();
  const lum = (h) => {
    const x = hex(h);
    if (!x) return 0.5;
    const c = [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  /** JSON for a <script type="application/json">: nothing in it can close the script or open a comment. */
  function scriptJson(obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }

  // ---------------------------------------------------------------- words

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const listWords = (xs) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

  // The engine's labels when it is loaded (the app), else the same rules here (Node, the connector).
  function featureLabel(key, deck) {
    const F = root.FiveS;
    if (F && typeof F.featureLabel === 'function') return F.featureLabel(key, deck);
    const s = String(key), i = s.indexOf(':');
    const type = i < 0 ? '' : s.slice(0, i), v = i < 0 ? s : s.slice(i + 1);
    switch (type) {
      case 'kind': return KIND_LABEL[v] || cap(v);
      case 'cat': case 'era': case 'place': return v;
      case 'gene': {
        const g = deck && deck.genes && deck.genes[v];
        return (g && g.name) || v.split('-').map(cap).join(' ');
      }
      case 'value': return { light: 'Light', mid: 'Mid-tone', dark: 'Dark' }[v] || cap(v);
      case 'texture': return { fine: 'Fine texture', coarse: 'Coarse texture' }[v] || cap(v) + ' texture';
      default: return cap(v);
    }
  }

  function dayWords(x) {
    if (typeof x === 'number' && isFinite(x)) {
      const d = new Date(x);
      if (!isNaN(d.getTime())) return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof x === 'string' ? x : '');
    return m && +m[2] >= 1 && +m[2] <= 12 ? +m[3] + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : '';
  }

  // ---------------------------------------------------------------- the seed as published

  /** publicSeed(seed, {includeNotes}) -> the seed as it goes on the hub: notes only when included. */
  function publicSeed(seed, opts) {
    const s = seed && typeof seed === 'object' ? seed : {};
    return opts && opts.includeNotes ? s : Object.assign({}, s, { notes: [] });
  }

  // ---------------------------------------------------------------- resolving works

  function indexDeck(deck) {
    const byWork = new Map(), byId = new Map();
    for (const c of (deck && Array.isArray(deck.cards) ? deck.cards : [])) {
      if (!c || typeof c !== 'object') continue;
      if (c.id) byId.set(c.id, c);
      if (c.work && !byWork.has(c.work)) byWork.set(c.work, c);
    }
    return { byWork, byId };
  }

  // A thumbnail for a brought-in thing, by its name (or its place in seed.own).
  function ownThumbOf(ownThumbs, name, index) {
    if (!ownThumbs) return null;
    if (Array.isArray(ownThumbs)) {
      const hit = ownThumbs.find((t) => t && typeof t === 'object' && t.name === name);
      if (hit) return imgSrc(hit.src || hit.thumb);
      return typeof ownThumbs[index] === 'string' ? imgSrc(ownThumbs[index]) : null;
    }
    return typeof ownThumbs === 'object' ? imgSrc(ownThumbs[name]) : null;
  }

  // Anything a set or a list can point at, as one shape: {kind, title, artist, date, colours, image, url, crop, w, h, own}.
  function resolver(seed, deck, o) {
    const ix = indexDeck(deck);
    const own = Array.isArray(seed.own) ? seed.own : [];
    const fromCard = (c, extra) => ({
      kind: KINDS.indexOf(c.kind) >= 0 ? c.kind : null,
      title: text(c.title), artist: text(c.artist), date: text(c.date),
      colours: hexes(c.colours), image: https(c.cdn || c.image), url: https(c.url),
      crop: Array.isArray(c.crop) && c.crop.length === 4 && c.crop.every((x) => typeof x === 'number' && isFinite(x)) ? c.crop : null,
      w: c.w > 0 ? c.w : null, h: c.h > 0 ? c.h : null, own: false, ...extra,
    });
    const fromOwn = (x, i) => ({
      kind: KINDS.indexOf(x.kind) >= 0 ? x.kind : 'image', title: text(x.name) || 'Untitled', artist: '', date: '',
      colours: hexes(x.colours), image: o.includeOwnImages ? ownThumbOf(o.ownThumbs, x.name, i) : null, url: null,
      crop: null, w: null, h: null, own: true, source: text(x.source),
    });
    return function resolve(ref) {
      if (!ref) return null;
      if (typeof ref === 'object') {
        if (ref.own) return fromOwn({ kind: ref.kind, name: ref.title || ref.name, colours: ref.colours, source: ref.source }, -1);
        const c = (ref.work && ix.byWork.get(ref.work)) || null;
        return fromCard(c ? Object.assign({}, c, ref) : ref);
      }
      if (typeof ref !== 'string') return null;
      const c = ix.byWork.get(ref) || ix.byId.get(ref);
      if (c) return fromCard(c);
      const i = own.findIndex((x) => x && x.name === ref);
      if (i >= 0) return fromOwn(own[i], i);
      if (/^y[0-9a-z]+$/.test(ref)) return null; // an internal id of a brought thing: never shown
      return { kind: null, title: text(ref), artist: '', date: '', colours: [], image: null, url: null, crop: null, w: null, h: null, own: false };
    };
  }

  // What a note is about, in words: a work's title (not its slug), a set's or a thing's name.
  function aboutWords(about, deck) {
    const a = text(about);
    if (!a) return '';
    const c = indexDeck(deck).byWork.get(a);
    return c && text(c.title) ? text(c.title) : a;
  }

  // ---------------------------------------------------------------- pieces

  // The detail of a work at its own scale: the crop window of the full image, by percentages.
  function cropStyle(crop) {
    const [x, y, w, h] = crop.map((v) => Math.min(1, Math.max(0, v)));
    if (w <= 0 || h <= 0) return '';
    return 'width:' + num(100 / w, 3) + '%;height:' + num(100 / h, 3) + '%;left:' + num(-100 * x / w, 3) + '%;top:' + num(-100 * y / h, 3) + '%';
  }

  function bands(colours) {
    const share = [3, 2, 1];
    return colours.slice(0, 3).map((c, i) => '<i style="background:' + c + ';flex:' + share[i] + '"></i>').join('');
  }

  function workTile(w) {
    const kind = w.kind || 'image';
    const bg = w.colours[0] ? ' style="background:' + w.colours[0] + '"' : '';
    let pic;
    if (kind === 'colour' && w.colours.length) pic = '<span class="pic bands">' + bands(w.colours) + '</span>';
    else if (w.image && kind === 'surface' && w.crop) pic = '<span class="pic crop"' + bg + '><img src="' + esc(w.image) + '" alt="" loading="lazy" decoding="async" style="' + cropStyle(w.crop) + '"></span>';
    else if (w.image) pic = '<span class="pic"' + bg + '><img src="' + esc(w.image) + '" alt="" loading="lazy" decoding="async"></span>';
    else pic = '<span class="pic bands">' + bands(w.colours.length ? w.colours : ['#d8d4e0']) + '</span>';
    const title = w.title || 'Untitled';
    const by = [w.artist, w.date].filter(Boolean).join(', ');
    const caption = '<span class="cap"><span class="k">' + esc(KIND_LABEL[kind] || 'Work') + '</span>' +
      '<span class="t">' + esc(kind === 'colour' ? 'Colours of ' + title : kind === 'surface' ? 'A detail of ' + title : title) + '</span>' +
      (by ? '<span class="a">' + esc(by) + '</span>' : '') + '</span>';
    const inner = pic + caption;
    return '<li class="work k-' + kind + '">' + (w.url ? '<a href="' + esc(w.url) + '">' + inner + '</a>' : '<div>' + inner + '</div>') + '</li>';
  }

  function chips(list, cls) {
    return '<ul class="chips">' + list.map((e) => '<li class="chip ' + cls + '">' + esc(e.label) +
      (e.counts ? ' <span class="n">' + esc(e.counts) + '</span>' : '') + '</li>').join('') + '</ul>';
  }

  function mosaic(colours, cls, nameOf) {
    const shown = colours.slice(0, MAX_SWATCHES);
    const more = colours.length - shown.length;
    return '<ul class="mosaic ' + cls + '">' + shown.map((c) => {
      const words = nameOf ? nameOf(c) + ' ' + c : c;
      return '<li style="' + (cls === 'hollow' ? 'border-color:' : 'background:') + c + '" title="' + esc(words) + '"><span class="vh">' + esc(words) + '</span></li>';
    }).join('') + '</ul>' + (more > 0 ? '<p class="small">And ' + more + ' more.</p>' : '');
  }

  function room(set, resolve, nameOf) {
    const get = {};
    for (const s of SLOTS) get[s] = resolve(set ? set[s] : null);
    const wall = get.wall, win = get.window, pic = get.picture, floor = get.floor, obj = get.object;
    const wc = wall ? wall.colours : [];
    let style = '';
    if (wc[0]) style += '--wall:' + wc[0] + ';--trim:' + (wc[1] || wc[0]) + ';--accent:' + (wc[2] || wc[1] || wc[0]) + ';';
    if (floor && floor.colours[0]) style += '--floorc:' + floor.colours[0] + ';';
    const blend = !!(obj && obj.colours[0] && lum(obj.colours[0]) > 0.55 && (!wc[0] || lum(wc[0]) >= 0.18));
    const img = (x, extra) => '<img src="' + esc(x.image) + '" alt="" loading="lazy" decoding="async"' + (extra || '') + '>';
    let floorHtml = '';
    if (floor && floor.image) floorHtml = floor.crop ? '<div class="tile">' + img(floor, ' style="' + cropStyle(floor.crop) + '"') + '</div>' : '<div class="tile">' + img(floor, ' class="cover"') + '</div>';
    let picHtml = '';
    if (pic && pic.image) {
      const ar = pic.w && pic.h ? pic.w / pic.h : 1, box = 0.963;
      const w = ar >= box ? 100 : (ar / box) * 100, h = ar >= box ? (box / ar) * 100 : 100;
      picHtml = '<div class="slot picture"><span class="frame" style="width:' + num(w, 1) + '%;height:' + num(h, 1) + '%">' + img(pic) + '</span></div>';
    }
    const drawn = '<div class="room' + (blend ? ' blend' : '') + '"' + (style ? ' style="' + style + '"' : '') + ' aria-hidden="true">' +
      '<div class="trim"></div><div class="floorwrap"><div class="floor">' + floorHtml + '</div><div class="floorshade"></div></div><div class="skirt"></div>' +
      (win && win.image ? '<div class="slot window"><span class="win">' + img(win) + '</span></div>' : '') +
      picHtml +
      (obj && obj.image ? '<div class="slot object"><span class="obj">' + img(obj) + '</span></div>' : '') +
      '</div>';
    const who = (x) => (x.own ? x.title + ' (brought in)' : [x.title || 'Untitled', x.artist].filter(Boolean).join(', '));
    const key = SLOTS.map((s) => {
      const x = get[s];
      let t;
      if (!x) t = 'Empty';
      else if (s === 'wall') {
        const words = x.colours.slice(0, 3).map((c) => (nameOf ? nameOf(c) : c));
        t = (words.length ? listWords(words) + ', the colours of ' : 'The colours of ') + who(x);
      } else if (s === 'floor') t = 'A detail of ' + who(x) + ', laid as the floor';
      else t = who(x);
      return '<li><b>' + SLOT_LABEL[s] + '</b> <span>' + esc(t) + '</span></li>';
    }).join('');
    return drawn + '<ul class="key">' + key + '</ul>';
  }

  // ---------------------------------------------------------------- the style (the 5s look)

  const CSS = `
:root {
  --paper: #FAF9FC; --paper-2: #F1EEF6; --raised: #FFFFFF; --ink: #16131F; --ink-2: #57516A;
  --line: #E2DEEA; --hair: rgba(22, 19, 31, 0.16);
  --ember-mark: #DE6A24; --flare: #E5482B; --iris: #7350EE; --cobalt: #2F6BE0;
  --keep-ink: #C2361A; --keep-tint: #FCE4D6; --pass-ink: #2A5FCC; --iris-ink: #5B3BD6; --iris-tint: #EEE8FE;
  --frame-mat: #F7F5F0; --frame-edge: #2A2420; --edge: rgba(0, 0, 0, 0.12); --edge-strong: rgba(0, 0, 0, 0.45);
  --floor-shade: rgba(0, 0, 0, 0.22);
  --font-display: "Unbounded", "Arial Black", "Helvetica Neue", system-ui, sans-serif;
  --font-body: "Figtree", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "Martian Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #100E18; --paper-2: #191624; --raised: #1F1B2D; --ink: #EEEBF5; --ink-2: #ABA5BD;
    --line: #2D2840; --hair: rgba(238, 235, 245, 0.22);
    --ember-mark: #FF9B55; --flare: #FF6B4D; --iris: #A78BFF; --cobalt: #6C9DFF;
    --keep-ink: #FF8A6A; --keep-tint: #3A1F18; --pass-ink: #8DB2FF; --iris-ink: #BCA8FF; --iris-tint: #261D48;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --paper: #100E18; --paper-2: #191624; --raised: #1F1B2D; --ink: #EEEBF5; --ink-2: #ABA5BD;
  --line: #2D2840; --hair: rgba(238, 235, 245, 0.22);
  --ember-mark: #FF9B55; --flare: #FF6B4D; --iris: #A78BFF; --cobalt: #6C9DFF;
  --keep-ink: #FF8A6A; --keep-tint: #3A1F18; --pass-ink: #8DB2FF; --iris-ink: #BCA8FF; --iris-tint: #261D48;
  color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 16px/1.55 var(--font-body); }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
a { color: inherit; }
a:focus-visible { outline: 2px solid var(--iris); outline-offset: 2px; border-radius: 8px; }
.vh { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.small { font-size: 13px; color: var(--ink-2); margin: 8px 0 0; }
.top { padding-top: 40px; padding-bottom: 28px; }
.mark { margin: 0; font: 700 30px/1 var(--font-display); letter-spacing: -0.02em; color: var(--flare);
  background: linear-gradient(100deg, var(--ember-mark), var(--flare) 70%, var(--iris)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
h1 { margin: 14px 0 10px; font: 700 clamp(26px, 6vw, 42px)/1.1 var(--font-display); letter-spacing: -0.01em; overflow-wrap: anywhere; }
h2 { margin: 0 0 6px; font: 700 20px/1.25 var(--font-display); }
h3 { margin: 18px 0 8px; font: 600 14px/1.3 var(--font-body); color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.06em; }
.lede { margin: 0 0 14px; max-width: 62ch; color: var(--ink-2); }
.code { display: inline-flex; align-items: baseline; gap: 10px; margin: 6px 0 0; padding: 8px 14px; border-radius: 999px; background: var(--iris-tint); color: var(--iris-ink); font-size: 13px; font-weight: 600; }
.code b { font: 500 15px/1 var(--font-mono); letter-spacing: 0.02em; }
.counts { margin: 12px 0 0; font: 400 13px/1.6 var(--font-mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
section { padding: 30px 0; border-top: 1px solid var(--line); }
.lines { display: grid; gap: 12px; max-width: 68ch; margin: 14px 0 0; padding: 0; list-style: none; }
.lines li { padding-left: 14px; border-left: 3px solid var(--iris); font-size: 18px; line-height: 1.45; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.chip { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; }
.chip.pos { background: var(--keep-tint); border: 1.5px solid var(--keep-ink); }
.chip.neg { background: transparent; border: 1.5px dashed var(--pass-ink); }
.chip .n { font: 400 12px/1 var(--font-mono); color: var(--ink-2); }
.works { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 18px 14px; margin: 16px 0 0; padding: 0; list-style: none; }
.work > a, .work > div { display: grid; gap: 8px; text-decoration: none; }
.pic { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: 14px; background: var(--paper-2); }
.pic img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.pic.crop img { inset: auto; max-width: none; max-height: none; object-fit: fill; }
.pic.bands { display: flex; flex-direction: column; box-shadow: inset 0 0 0 1px var(--hair); }
.pic.bands i { display: block; min-height: 0; }
.cap { display: grid; gap: 2px; }
.cap .k { font: 500 10px/1.4 var(--font-mono); color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.08em; }
.cap .t { font-size: 14px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cap .a { font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
.work > a:hover .t { text-decoration: underline; }
.credit { margin: 4px 0 0; font-size: 13px; color: var(--ink-2); }
.mosaic { display: grid; grid-template-columns: repeat(auto-fill, minmax(26px, 1fr)); gap: 4px; margin: 0; padding: 0; list-style: none; }
.mosaic li { aspect-ratio: 1; border-radius: 6px; box-shadow: inset 0 0 0 1px var(--hair); }
.mosaic.hollow li { border: 4px solid; box-shadow: none; }
.rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px 20px; margin: 16px 0 0; padding: 0; list-style: none; }
.rooms .name { margin: 10px 0 6px; font-weight: 700; font-size: 16px; overflow-wrap: anywhere; }
.room { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; isolation: isolate; border-radius: 12px; background: var(--wall, var(--paper-2)); }
.room .trim { position: absolute; left: 0; right: 0; top: 0; height: 7%; background: var(--trim, var(--line)); box-shadow: 0 2px 0 var(--edge); }
.room .skirt { position: absolute; left: 0; right: 0; top: 66%; height: 3.4%; background: var(--accent, var(--line)); z-index: 2; }
.room .floorwrap { position: absolute; left: 0; right: 0; top: 69%; bottom: 0; overflow: hidden; perspective: 260px; perspective-origin: 50% 0; background: var(--floorc, var(--paper-2)); }
.room .floor { position: absolute; left: -60%; right: -60%; top: 0; height: 420%; transform-origin: 50% 0; transform: rotateX(68deg); }
.room .tile { position: absolute; left: 25%; width: 50%; top: 0; aspect-ratio: 1; overflow: hidden; opacity: 0.92; }
.room .tile img { position: absolute; display: block; max-width: none; }
.room .tile img.cover { inset: 0; width: 100%; height: 100%; object-fit: cover; }
.room .floorshade { position: absolute; inset: 0; background: linear-gradient(to bottom, var(--floor-shade), transparent 55%); }
.room .slot { position: absolute; }
.room .window { left: 8%; top: 17%; width: 27%; height: 40%; z-index: 3; }
.room .picture { left: 43%; top: 16%; width: 26%; height: 36%; z-index: 3; display: grid; place-items: center; }
.room .object { left: 72%; width: 24%; top: 30%; height: 41%; z-index: 4; }
.room.blend .object { mix-blend-mode: multiply; }
.win { position: absolute; inset: 0; overflow: hidden; background: var(--raised); border: 3px solid var(--trim, var(--raised)); box-shadow: inset 0 0 0 2px var(--edge), 0 2px 0 var(--edge); }
.win img { display: block; width: 100%; height: 100%; object-fit: cover; }
.win::before, .win::after { content: ""; position: absolute; z-index: 1; background: var(--trim, var(--raised)); }
.win::before { left: 50%; top: 0; bottom: 0; width: 3px; margin-left: -1.5px; }
.win::after { top: 45%; left: 0; right: 0; height: 3px; }
.frame { position: relative; max-width: 100%; max-height: 100%; padding: 7%; background: var(--frame-mat); border: 2px solid var(--frame-edge); box-shadow: 0 6px 14px -6px var(--edge-strong); }
.frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
.obj { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: center; }
.obj img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; object-position: 50% 100%; }
.key { display: grid; gap: 3px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.key li { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; }
.key span { color: var(--ink-2); overflow-wrap: anywhere; }
.ground img { display: block; width: 100%; max-width: 760px; height: auto; margin: 16px auto 0; }
.notes { display: grid; gap: 18px; margin: 16px 0 0; padding: 0; list-style: none; max-width: 68ch; }
.notes .q { margin: 0; font-size: 13px; color: var(--ink-2); }
.notes .a { margin: 4px 0 2px; font-size: 20px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.notes .when { margin: 0; font: 400 12px/1.4 var(--font-mono); color: var(--ink-2); }
.own { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 14px; margin: 16px 0 0; padding: 0; list-style: none; }
.own figure { margin: 0; display: grid; gap: 6px; }
.own img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: var(--paper-2); }
.own figcaption { font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
.own figcaption b { display: block; color: var(--ink); font-weight: 600; }
footer { padding-top: 0; padding-bottom: 56px; font-size: 14px; color: var(--ink-2); }
footer::before { content: ""; display: block; margin-bottom: 28px; border-top: 1px solid var(--line); }
footer p { margin: 0 0 8px; max-width: 68ch; }
@media (max-width: 420px) { .works { grid-template-columns: repeat(2, minmax(0, 1fr)); } .lines li { font-size: 17px; } }
`;

  // ---------------------------------------------------------------- build

  /** build({seed, profile, philosophy, deck, sets, groundPng, groundAlt, title, includeNotes,
   *         includeOwnImages, ownThumbs, generatedAt, colourName}) -> a complete HTML document.
   *   seed        FiveS.exportSeed(...) (required): code, counts, kept (with image and url), palette,
   *               leanings, sets, own, notes
   *   profile     FiveS.profile(...) (optional): positive/negative with labels and counts
   *   philosophy  FiveS.philosophy(...) lines (optional)
   *   deck        the deck (optional): titles, artists, dates, colours and crops of the kept works
   *   sets        rooms to draw (optional; default the seed's sets): [{name, wall, window, picture,
   *               floor, object}], each slot a card-like object, a card id, a work slug or an own name
   *   groundPng   the ground as a data:image/png (or https) address; groundAlt its words
   *   ownThumbs   brought-in thumbnails, used only with includeOwnImages: [{name, src}], {name: src}
   *               or an array of srcs in seed.own order (data:image or https only)
   *   generatedAt a millisecond timestamp or "YYYY-MM-DD" (default the seed's "made")
   *   colourName  (hex) -> words (default FiveS.colourName when the engine is loaded) */
  function build(opts) {
    const o = opts || {};
    const seed = o.seed;
    if (!seed || typeof seed !== 'object') throw new TypeError('FiveSHubPage.build needs a seed (FiveS.exportSeed)');
    const deck = o.deck || null;
    const F = root.FiveS;
    const nameOf = typeof o.colourName === 'function' ? o.colourName : F && typeof F.colourName === 'function' ? F.colourName : null;
    const resolve = resolver(seed, deck, o);
    const title = text(o.title) || 'A 5s hub';
    const made = dayWords(o.generatedAt != null ? o.generatedAt : seed.made);
    const counts = seed.counts && typeof seed.counts === 'object' ? seed.counts : {};
    const n = (x) => (typeof x === 'number' && isFinite(x) ? Math.max(0, Math.round(x)) : 0);
    const out = [];
    const put = (s) => out.push(s);

    put('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n');
    put('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n');
    put('<title>' + esc(title) + '</title>\n');
    put('<meta name="description" content="A taste sorted five at a time in 5s: what was kept and passed, its colours, its rooms and its ground.">\n');
    put('<meta name="generator" content="5s">\n<meta name="color-scheme" content="light dark">\n');
    put('<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n');
    put('<link rel="stylesheet" href="' + esc(FONTS) + '">\n');
    put('<style>' + CSS + '</style>\n</head>\n<body>\n');

    // the seed code
    const code = text(seed.code);
    put('<header class="top wrap">\n<p class="mark">5s</p>\n<h1>' + esc(title) + '</h1>\n');
    put('<p class="lede">A taste, sorted five quick judgments at a time: what was kept, what was passed, and what grew from it.</p>\n');
    if (code) put('<p class="code">Seed <b>' + esc(code) + '</b></p>\n');
    put('<p class="counts">Judged ' + n(counts.judged) + ' · kept ' + n(counts.kept) + ' · passed ' + n(counts.passed) + ' · ' +
      n(counts.turns) + (n(counts.turns) === 1 ? ' turn' : ' turns') + '</p>\n</header>\n<main class="wrap">\n');

    // philosophy
    const lines = (Array.isArray(o.philosophy) ? o.philosophy : []).map(text).filter(Boolean).slice(0, 8);
    if (lines.length) {
      put('<section id="philosophy" aria-labelledby="philosophy-h">\n<h2 id="philosophy-h">Philosophy</h2>\n');
      put('<p class="lede">How this taste goes about things, in the lines 5s wrote from the judgments.</p>\n');
      put('<ul class="lines">' + lines.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>\n</section>\n');
    }

    // positive and negative space
    const fromProfile = (list) => (Array.isArray(list) ? list : []).filter((e) => e && e.key).slice(0, 10)
      .map((e) => ({ label: text(e.label) || featureLabel(e.key, deck), counts: typeof e.kept === 'number' && typeof e.n === 'number' ? 'kept ' + e.kept + ' of ' + e.n : '' }));
    const fromSeed = (list) => (Array.isArray(list) ? list : []).filter((e) => Array.isArray(e) && typeof e[0] === 'string').slice(0, 10)
      .map((e) => ({ label: featureLabel(e[0], deck), counts: '' }));
    const P = o.profile && typeof o.profile === 'object' ? o.profile : null;
    const lean = seed.leanings && typeof seed.leanings === 'object' ? seed.leanings : {};
    const pos = P ? fromProfile(P.positive) : fromSeed(lean.positive);
    const neg = P ? fromProfile(P.negative) : fromSeed(lean.negative);
    if (pos.length || neg.length) {
      put('<section id="space" aria-labelledby="space-h">\n<h2 id="space-h">Positive and negative space</h2>\n');
      put('<p class="lede">What is kept most, and what is passed most. What is passed shapes a taste as much as what is kept.</p>\n');
      if (pos.length) put('<h3>Kept most</h3>\n' + chips(pos, 'pos') + '\n');
      if (neg.length) put('<h3>Passed most</h3>\n' + chips(neg, 'neg') + '\n');
      put('</section>\n');
    }

    // kept works
    const kept = (Array.isArray(seed.kept) ? seed.kept : []).filter((k) => k && typeof k === 'object').map((k) => {
      // the seed's addresses win; a missing one falls back to the deck's
      const ref = { work: k.work, kind: k.kind };
      if (https(k.image)) ref.cdn = k.image;
      if (https(k.url)) ref.url = k.url;
      const w = resolve(ref);
      if (!w.url && typeof k.work === 'string' && k.work) w.url = 'https://www.artsy.net/artwork/' + encodeURIComponent(k.work);
      if (!w.title && typeof k.work === 'string') w.title = 'A work on Artsy';
      w.kind = KINDS.indexOf(k.kind) >= 0 ? k.kind : w.kind || 'image';
      return w;
    });
    kept.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
    const ownKept = (Array.isArray(seed.own) ? seed.own : []).filter((x) => x && !x.let).length;
    put('<section id="kept" aria-labelledby="kept-h">\n<h2 id="kept-h">Kept works</h2>\n');
    put('<p class="lede">' + (kept.length ? kept.length + (kept.length === 1 ? ' work' : ' works') + ' kept from an artist’s database of saved works.' : 'Nothing kept yet.') +
      (ownKept ? ' And ' + ownKept + (ownKept === 1 ? ' thing' : ' things') + ' brought in from elsewhere' + (o.includeOwnImages ? ', below.' : ', kept private.') : '') + '</p>\n');
    if (kept.length) put('<p class="credit">Images and pages on Artsy</p>\n<ul class="works">' + kept.map(workTile).join('') + '</ul>\n');
    put('</section>\n');

    // colours
    const pal = seed.palette && typeof seed.palette === 'object' ? seed.palette : {};
    const kc = hexes(pal.kept), pc = hexes(pal.passed);
    if (kc.length || pc.length) {
      put('<section id="colours" aria-labelledby="colours-h">\n<h2 id="colours-h">Colours</h2>\n');
      put('<p class="lede">The colours of what was kept, as a solid field; the colours of what was passed, hollow beside them.</p>\n');
      if (kc.length) put('<h3>Kept · ' + kc.length + '</h3>\n' + mosaic(kc, 'solid', nameOf) + '\n');
      if (pc.length) put('<h3>Passed · ' + pc.length + '</h3>\n' + mosaic(pc, 'hollow', nameOf) + '\n');
      put('</section>\n');
    }

    // pinned sets as rooms
    const sets = (Array.isArray(o.sets) ? o.sets : Array.isArray(seed.sets) ? seed.sets : []).filter((s) => s && typeof s === 'object');
    if (sets.length) {
      put('<section id="rooms" aria-labelledby="rooms-h">\n<h2 id="rooms-h">Rooms</h2>\n');
      put('<p class="lede">Sets pinned from the parts: a wall in a kept chord, a window, a picture, a floor and an object, each named for what it is for.</p>\n');
      put('<ul class="rooms">' + sets.map((s) => '<li><p class="name">' + esc(text(s.name) || 'A set') + '</p>' + room(s, resolve, nameOf) + '</li>').join('') + '</ul>\n</section>\n');
    }

    // the ground
    const ground = imgSrc(o.groundPng);
    if (ground) {
      const alt = text(o.groundAlt) || 'The ground: an island grown from these judgments. Land from the kept surfaces, tinted toward the kept colours; water in the passed colours.';
      put('<section id="ground" class="ground" aria-labelledby="ground-h">\n<h2 id="ground-h">The ground</h2>\n');
      put('<p class="lede">' + esc(alt) + '</p>\n<img src="' + esc(ground) + '" alt="' + esc(alt) + '">\n</section>\n');
    }

    // notes, only when included
    const notes = o.includeNotes && Array.isArray(seed.notes) ? seed.notes.filter((x) => x && text(x.text)).slice().reverse() : [];
    if (notes.length) {
      put('<section id="notes" aria-labelledby="notes-h">\n<h2 id="notes-h">Notes</h2>\n<p class="lede">In their own words, next to the judgments.</p>\n<ul class="notes">');
      put(notes.map((x) => '<li><p class="q">' + esc((NOTE_Q[x.q] || NOTE_Q.free) + (aboutWords(x.about, deck) ? ' · about ' + aboutWords(x.about, deck) : '')) + '</p>' +
        '<p class="a">' + esc(text(x.text)) + '</p>' + (dayWords(x.at) ? '<p class="when">' + esc(dayWords(x.at)) + '</p>' : '') + '</li>').join(''));
      put('</ul>\n</section>\n');
    }

    // brought-in images, only when included
    if (o.includeOwnImages) {
      const own = (Array.isArray(seed.own) ? seed.own : []).map((x, i) => ({ x, i })).filter(({ x }) => x && !x.let)
        .map(({ x, i }) => ({ name: text(x.name) || 'Untitled', source: text(x.source), src: ownThumbOf(o.ownThumbs, x.name, i) }))
        .filter((t) => t.src).slice(0, MAX_OWN);
      if (own.length) {
        put('<section id="own" aria-labelledby="own-h">\n<h2 id="own-h">Brought in</h2>\n<p class="lede">Things saved elsewhere and brought into 5s.</p>\n<ul class="own">');
        put(own.map((t) => '<li><figure><img src="' + esc(t.src) + '" alt="' + esc(t.name) + '" loading="lazy" decoding="async"><figcaption><b>' + esc(t.name) + '</b>' + esc(t.source) + '</figcaption></figure></li>').join(''));
        put('</ul>\n</section>\n');
      }
    }

    put('</main>\n<footer class="wrap">\n');
    put('<p>' + (made ? 'Made in 5s on ' + esc(made) + '. ' : 'Made in 5s. ') + 'Five quick judgments a day build an aesthetic database; this page grew from one.</p>\n');
    put('<p>The works come from an artist’s database of saved works. Images and pages on Artsy.</p>\n');
    put('<p>This page holds no name, no email and no account details: only what was kept, passed and set. The seed is in its source (format 5s-seed).</p>\n');
    put('</footer>\n');
    put('<script type="application/json" id="seed">' + scriptJson(publicSeed(seed, o)) + '</script>\n');
    put('</body>\n</html>\n');
    return out.join('');
  }

  /** readme({title, site}) -> a short README.md for the hub. */
  function readme(opts) {
    const o = opts || {};
    const title = text(o.title) || 'A 5s hub';
    const site = https(o.site);
    return '# ' + title.replace(/[\r\n]+/g, ' ') + '\n\n' +
      'Made with 5s: five quick judgments a day build an aesthetic database, and this hub grew from one.\n\n' +
      (site ? 'Open it at ' + site + '\n\n' : '') +
      '- `index.html` is the hub page.\n' +
      '- `seed.json` is the 5s seed (format `5s-seed`): what was kept, passed and set. It holds no name, no email and no account details.\n\n' +
      'Images and pages of the works are on Artsy.\n';
  }

  /** files(opts) -> [{path, text}] for a hub: index.html (build(opts)), seed.json (the seed as
   *  published), README.md, and an empty .nojekyll so the page is served exactly as written. */
  function files(opts) {
    const o = opts || {};
    return [
      { path: 'index.html', text: build(o) },
      { path: 'seed.json', text: JSON.stringify(publicSeed(o.seed, o), null, 2) + '\n' },
      { path: 'README.md', text: readme(o) },
      { path: '.nojekyll', text: '' },
    ];
  }

  const FiveSHubPage = Object.freeze({ version: 1, build, readme, files, publicSeed, escape: esc });

  if (typeof module === 'object' && module.exports) module.exports = FiveSHubPage;
  else root.FiveSHubPage = FiveSHubPage;
})(typeof self !== 'undefined' ? self : globalThis);

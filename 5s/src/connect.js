/* 5s Connect your apps: what the page needs to bring in the taste people already keep in other apps
 * (SPEC.md "Connect your apps"). Plain script, no DOM, no UI, no library.
 *
 * Browser: window.FiveSConnect. Node: module.exports (test/connect.test.mjs).
 *
 * Two parts:
 *
 * 1. Your data file (works now, on the device, nothing uploaded):
 *    readFile(file) -> Promise<Found>   an app's "download your data" file: .json, .js, .html, .csv, .txt,
 *                                        or a .zip holding them (read here: deflate through the browser's
 *                                        own DecompressionStream, no library).
 *    harvestText(name, text) -> Found    one text file's picture addresses and post/pin links.
 *    unzip(blob) -> Promise<[Entry]>     the files inside a .zip (zip64 too), each read on demand.
 *    Found = {name, source, items: [{key, image, link, title}], links, pictures, files, notes: [string]}
 *      items are de-duplicated; `image` is a picture's https address (or null), `link` the post, pin or
 *      page it came from (or null), `title` other people's text, one line (or null).
 *
 * 2. The 5s connector, reached through the artifact's `mcp` capability (SPEC "5s as a Claude
 *    connector"); its name in Claude is the one constant SERVER ("5s"):
 *    connector(mcp) -> {status(), readLink(url), bringIn(items, kind), itemImage(id), getState()}
 *      status() -> Promise<"connected" | "reauth" | "none">
 *      the others resolve to the tool's JSON (`payload`) or reject with a ConnectError
 *      {kind: "closed" | "refused" | "busy" | "failed", code, why, resolution, connect?: true, data?}.
 *    bringItem(it) -> the item exactly as the connector's bring_in takes it (no nulls, no extra keys).
 *    dataUrlBlob(url) -> Blob            item_image's picture, ready for FiveSBring.process.
 */
(function (root) {
  'use strict';

  const SERVER = '5s';
  const CONNECT_LINE = 'Connect 5s to Claude (Settings → Connectors → Add custom connector) to open this door.';

  // What one file may cost this device: plenty for any app's export of saves, never the whole of a
  // multi-gigabyte archive (only its list of contents and the files that hold saves are read).
  const LIMITS = Object.freeze({
    fileText: 48 * 1024 * 1024,     // a single text file read whole
    entryBytes: 24 * 1024 * 1024,   // one file inside a .zip, unpacked
    totalBytes: 96 * 1024 * 1024,   // every file read from one .zip, unpacked
    entries: 400,                   // files read from one .zip
    directory: 64 * 1024 * 1024,    // a .zip's list of contents
    items: 20000,                   // things found in one file (the page offers a few hundred at a time)
    url: 2048,                      // the connector's own cap on an address
    title: 120,
  });

  // ---------------------------------------------------------------- addresses

  const IMG_EXT = /\.(?:jpe?g|png|gif|webp|avif)$/i;
  // Hosts that serve only pictures, often without a file extension.
  const IMG_HOST = /(?:^|\.)(?:pinimg\.com|cdninstagram\.com|fbcdn\.net|twimg\.com|staticflickr\.com|media\.tumblr\.com|googleusercontent\.com|ggpht\.com|scdn\.co|spotifycdn\.com|tiktokcdn\.com|tiktokcdn-us\.com|d2w9rnfcy7mm78\.cloudfront\.net|images\.are\.na)$/i;
  // Never a save: help and policy pages, the account's own settings, and the plumbing of a web page.
  const JUNK_HOST = /^(?:help|support|privacycenter|accountscenter|about|policies|transparency|developers?|status|legal)\.|(?:^|\.)(?:w3\.org|schema\.org|googleapis\.com|gstatic\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net)$/i;
  const JUNK_PATH = /^\/(?:help|legal|privacy|terms|policies|about|accounts?|settings|login|signup|logout|download)(?:[/?#.]|$)|^\/explore\/?$|\.(?:css|js|mjs|json|xml|ico|svg|woff2?|ttf|zip)$/i;
  const TRACKING = /^(?:utm_\w+|fbclid|gclid|igshid|igsh|si|ref_src|ref_url|mibextid)$/i;

  /** A raw address from a file as 5s keeps it: https, no port, a public name, no tracking, or null. */
  function cleanUrl(raw) {
    let s = String(raw == null ? '' : raw).trim().replace(/[.,;:!?)\]}'"*>]+$/, '');
    if (!/^https?:\/\//i.test(s)) return null;
    s = s.replace(/^http:\/\//i, 'https://');
    if (s.length > LIMITS.url) return null;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    const host = u.hostname.toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null; // a public name: never an IP or a bare word
    if (JUNK_HOST.test(host) || JUNK_PATH.test(u.pathname)) return null;
    if ((u.pathname === '/' || u.pathname === '') && !u.search) return null; // a site's front page is not a save
    u.hash = '';
    for (const k of Array.from(u.searchParams.keys())) if (TRACKING.test(k)) u.searchParams.delete(k);
    const out = u.href;
    return out.length > LIMITS.url ? null : out;
  }

  function isPicture(href) {
    try { const u = new URL(href); return IMG_EXT.test(u.pathname) || IMG_HOST.test(u.hostname); } catch (e) { return false; }
  }

  /** The key two addresses share when they are the same thing (www., a trailing slash, case of the host). */
  function keyOf(href) {
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase().replace(/^(?:www|m|mobile)\./, '');
      const path = u.pathname.replace(/\/+$/, '') || '/';
      const q = Array.from(u.searchParams.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map((p) => p.join('=')).join('&');
      return host + path + (q ? '?' + q : '');
    } catch (e) { return String(href); }
  }

  // A link to one post, pin or block beats a link to a profile or a list.
  function linkScore(href) {
    try {
      const u = new URL(href);
      const segs = u.pathname.split('/').filter(Boolean);
      let s = Math.min(segs.length, 3);
      if (/\/(?:p|reel|tv|pin|status|statuses|video|videos|block|photos?|post|posts|watch|album|track|artwork|item)\//i.test(u.pathname + '/')) s += 3;
      if (/\d{5,}/.test(u.pathname)) s += 1;
      return s;
    } catch (e) { return 0; }
  }

  // ---------------------------------------------------------------- text

  // Instagram's export writes each byte of a UTF-8 character as its own \u00XX: put the characters back.
  function fixMojibake(s) {
    if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(s) || /[^\u0000-\u00ff]/.test(s)) return s;
    try {
      const bytes = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) { return s; }
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  function decodeEntities(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      const k = e.toLowerCase();
      return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : m;
    });
  }

  /** Other people's text as one plain line, or null when it says nothing (an address, a number, a date). */
  function cleanTitle(t) {
    if (t == null || typeof t !== 'string') return null;
    let s = fixMojibake(t).replace(/https?:\/\/\S+/gi, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s || !/[\p{L}]/u.test(s)) return null;
    if (/^\d{4}-\d\d-\d\d/.test(s)) return null;
    if (s.length > LIMITS.title) {
      const cut = s.slice(0, LIMITS.title - 1), sp = cut.lastIndexOf(' ');
      s = (sp > LIMITS.title * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:\-–—]+$/, '') + '…';
    }
    return s;
  }

  // ---------------------------------------------------------------- owners: the things a file lists

  // Keys whose text names a thing; the lower the rank, the better the name.
  const TITLE_KEYS = { title: 0, name: 1, caption: 2, alt: 3, alt_text: 3, description: 4, full_text: 5, fulltext: 5, text: 6, note: 7, comment: 8, value: 9 };
  function titleRank(key) {
    const k = String(key || '').toLowerCase().replace(/[^a-z_]/g, '');
    return Object.prototype.hasOwnProperty.call(TITLE_KEYS, k) ? TITLE_KEYS[k] : -1;
  }

  // Where an export keeps saves (keys inside a file, folders and file names inside a .zip).
  const SAVES = /(?:^|[^a-z])(?:saved?|saves|bookmark(?:s|ed)?|favou?rites?|favou?rited|likes?|liked|pins?|boards?|collections?)(?:[^a-z]|$)/i;

  function newOwner(parent) { return { urls: [], titles: [], parent: parent || null }; }

  // Owners become items: one item per owner (its best picture and its best link), unless the owner is
  // really a list of many (then each address is its own item).
  function ownersToItems(owners) {
    const out = [];
    for (const o of owners) {
      if (!o.urls.length) continue;
      if (o.urls.length > 6) { for (const u of o.urls) out.push(isPicture(u) ? { image: u, link: null, title: null } : { image: null, link: u, title: null }); continue; }
      const pics = o.urls.filter(isPicture);
      const links = o.urls.filter((u) => !isPicture(u)).map((u, i) => [u, linkScore(u), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map((x) => x[0]);
      // Its own name, else the name of what holds it (Instagram puts the poster's name one level up).
      const pick = (ts) => ts.slice().sort((a, b) => a[0] - b[0]).map((x) => cleanTitle(x[1])).find(Boolean) || null;
      let t = pick(o.titles);
      for (let p = o.parent; !t && p; p = p.parent) t = pick(p.titles);
      out.push({ image: pics[0] || null, link: links[0] || null, title: t });
    }
    return out;
  }

  const looksUrl = (s) => typeof s === 'string' && /^\s*https?:\/\//i.test(s);

  function hasUrl(node, budget) {
    const stack = [node];
    while (stack.length && budget.n-- > 0) {
      const v = stack.pop();
      if (looksUrl(v)) return true;
      if (v && typeof v === 'object') for (const k in v) stack.push(v[k]);
    }
    return false;
  }

  /** The values a JSON export keeps saves under ("saved_saved_media", "Favorite Videos", "like" …). */
  function findSaves(rootNode) {
    const out = [];
    const budget = { n: 2000000 };
    const stack = [rootNode];
    while (stack.length && budget.n-- > 0) {
      const v = stack.pop();
      if (!v || typeof v !== 'object') continue;
      if (Array.isArray(v)) { for (let i = v.length - 1; i >= 0; i--) stack.push(v[i]); continue; }
      const keys = Object.keys(v);
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i], x = v[k];
        if (x && typeof x === 'object' && SAVES.test(k.replace(/([a-z])([A-Z])/g, '$1 $2')) && hasUrl(x, { n: 200000 })) out.push(x);
        else stack.push(x);
      }
    }
    return out;
  }

  function harvestJSON(data) {
    const saves = findSaves(data);
    const roots = saves.length ? saves : [data];
    const owners = [];
    let visited = 0;
    function walk(node, owner, key, depth) {
      if (++visited > 3000000 || depth > 60) return;
      if (typeof node === 'string') {
        if (looksUrl(node)) {
          const u = cleanUrl(node);
          if (!u) return;
          if (owner) owner.urls.push(u);
          else { const o = newOwner(null); o.urls.push(u); owners.push(o); }
        } else if (owner && key != null) {
          const r = titleRank(key);
          if (r >= 0) owner.titles.push([r, node]);
        }
        return;
      }
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const el of node) {
          if (el && typeof el === 'object' && !Array.isArray(el)) { const o = newOwner(owner); owners.push(o); walk(el, o, null, depth + 1); }
          else if (looksUrl(el)) { const o = newOwner(owner); owners.push(o); walk(el, o, null, depth + 1); }
          else walk(el, owner, key, depth + 1);
        }
        return;
      }
      for (const k of Object.keys(node)) walk(node[k], owner, k, depth + 1);
    }
    for (const r of roots) {
      if (r && typeof r === 'object' && !Array.isArray(r)) { const o = newOwner(null); owners.push(o); walk(r, o, null, 0); }
      else walk(r, null, null, 0);
    }
    return ownersToItems(owners);
  }

  // HTML, read as text (no page is built from it, so nothing in it runs): links and pictures, a picture
  // inside a link going with it.
  function attr(tag, name) {
    const m = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(tag);
    return m ? decodeEntities(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null;
  }
  const stripTags = (s) => decodeEntities(String(s).replace(/<[^>]*>/g, ' '));

  function harvestHTML(html) {
    const text = String(html).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, ' ');
    const owners = [];
    const covered = [];
    const A_RE = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
    const IMG_RE = /<img\b([^>]*)>/gi;
    let m;
    while ((m = A_RE.exec(text))) {
      const o = newOwner(null);
      const href = attr(m[1], 'href');
      if (looksUrl(href)) { const u = cleanUrl(href); if (u) o.urls.push(u); }
      let im;
      IMG_RE.lastIndex = 0;
      while ((im = IMG_RE.exec(m[2]))) {
        const src = attr(im[1], 'src') || attr(im[1], 'data-src');
        if (looksUrl(src)) { const u = cleanUrl(src); if (u) o.urls.push(u); }
        const alt = attr(im[1], 'alt');
        if (alt) o.titles.push([0, alt]);
      }
      const t = attr(m[1], 'title');
      if (t) o.titles.push([1, t]);
      o.titles.push([2, stripTags(m[2])]);
      if (o.urls.length) owners.push(o);
      covered.push([m.index, m.index + m[0].length]);
      if (owners.length > LIMITS.items) break;
    }
    IMG_RE.lastIndex = 0;
    while ((m = IMG_RE.exec(text))) {
      if (covered.some((c) => m.index >= c[0] && m.index < c[1])) continue;
      const src = attr(m[1], 'src') || attr(m[1], 'data-src');
      if (!looksUrl(src)) continue;
      const u = cleanUrl(src);
      if (!u) continue;
      const o = newOwner(null);
      o.urls.push(u);
      const alt = attr(m[1], 'alt') || attr(m[1], 'title');
      if (alt) o.titles.push([0, alt]);
      owners.push(o);
      if (owners.length > LIMITS.items) break;
    }
    return ownersToItems(owners);
  }

  // A spreadsheet's rows (comma, semicolon or tab, quotes as spreadsheets write them).
  function parseCSV(text) {
    const first = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
    const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length]);
    const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
        if (rows.length > LIMITS.items * 2) break;
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const URL_RE = /https?:\/\/[^\s"'<>()[\]{}|\\^`]+/gi;

  function harvestCSV(text) {
    const rows = parseCSV(text).filter((r) => r.some((c) => c.trim()));
    if (!rows.length) return [];
    let header = null;
    if (!rows[0].some(looksUrl) && rows[0].some((c) => /[a-z]/i.test(c))) header = rows.shift().map((h) => h.trim());
    const owners = rows.map((r) => {
      const o = newOwner(null);
      r.forEach((c, i) => {
        const found = c.match(URL_RE);
        if (found) for (const f of found) { const u = cleanUrl(f); if (u) o.urls.push(u); }
        else if (c.trim()) {
          const rank = header ? titleRank(header[i]) : -1;
          o.titles.push([rank >= 0 ? rank : 20 + i, c]);
        }
      });
      return o;
    });
    return ownersToItems(owners);
  }

  function harvestLines(text) {
    const owners = String(text).split(/\r?\n/).map((line) => {
      const o = newOwner(null);
      const found = line.match(URL_RE) || [];
      for (const f of found) { const u = cleanUrl(f); if (u) o.urls.push(u); }
      if (o.urls.length) o.titles.push([0, line]);
      return o;
    });
    return ownersToItems(owners);
  }

  function typeOf(name, text) {
    const ext = (/\.([a-z0-9]+)$/i.exec(name || '') || [])[1];
    const e = ext ? ext.toLowerCase() : '';
    if (e === 'json' || e === 'js') return 'json';
    if (e === 'html' || e === 'htm') return 'html';
    if (e === 'csv' || e === 'tsv') return 'csv';
    const head = String(text).slice(0, 400).trimStart();
    if (/^[[{]/.test(head) || /^window\.YTD\./.test(head)) return 'json';
    if (/^<(?:!doctype|html|head|body|dl|a\s)/i.test(head)) return 'html';
    return 'text';
  }

  /** The things one text file lists: [{image, link, title}] (not yet de-duplicated). */
  function harvestItems(name, text) {
    const kind = typeOf(name, text);
    if (kind === 'json') {
      // X's archive wraps its JSON in a line of script ("window.YTD.like.part0 = [ … ]").
      const body = String(text).replace(/^\uFEFF/, '').replace(/^\s*[A-Za-z_$][\w$.]*\s*=\s*/, '');
      try { return harvestJSON(JSON.parse(body)); } catch (e) { return harvestLines(text); }
    }
    if (kind === 'html') return harvestHTML(text);
    if (kind === 'csv') return harvestCSV(text);
    return harvestLines(text);
  }

  // ---------------------------------------------------------------- where it came from

  const BY_HOST = [
    [/(?:^|\.)(?:instagram\.com|cdninstagram\.com)$/, 'Instagram'],
    [/(?:^|\.)(?:pinterest\.[a-z.]+|pin\.it|pinimg\.com)$/, 'Pinterest'],
    [/(?:^|\.)(?:twitter\.com|x\.com|twimg\.com|t\.co)$/, 'X'],
    [/(?:^|\.)(?:tiktok\.com|tiktokv\.com|tiktokcdn\.com)$/, 'TikTok'],
    [/(?:^|\.)(?:are\.na)$/, 'Are.na'],
    [/(?:^|\.)(?:flickr\.com|staticflickr\.com|flic\.kr)$/, 'Flickr'],
    [/(?:^|\.)(?:tumblr\.com)$/, 'Tumblr'],
  ];

  /** Where a file came from, by its name, the names inside it, its markers, then where its links point. */
  function guessSource(name, paths, items, hints) {
    const hay = [name].concat(paths || [], hints || []).join(' ').toLowerCase();
    if (/instagram/.test(hay)) return 'Instagram';
    if (/pinterest/.test(hay)) return 'Pinterest';
    if (/takeout/.test(hay)) return 'Google Takeout';
    if (/tiktok/.test(hay)) return 'TikTok';
    if (/twitter|tweet|window\.ytd/.test(hay)) return 'X';
    const n = {};
    let total = 0;
    for (const it of items || []) {
      const href = it.link || it.image;
      let host = '';
      try { host = new URL(href).hostname.toLowerCase(); } catch (e) { continue; }
      total++;
      for (const [re, src] of BY_HOST) if (re.test(host)) { n[src] = (n[src] || 0) + 1; break; }
    }
    const top = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    return top && n[top] > total / 2 ? top : 'Your file';
  }

  // ---------------------------------------------------------------- the found list

  /** De-duplicate items (a picture or a link seen before is the same thing), keeping the fullest. */
  function mergeItems(lists) {
    const out = [];
    const byKey = new Map();
    for (const list of lists) {
      for (const it of list) {
        const ki = it.image ? keyOf(it.image) : null, kl = it.link ? keyOf(it.link) : null;
        const hit = (ki && byKey.get('i:' + ki)) || (kl && byKey.get('l:' + kl));
        if (hit) {
          if (!hit.image && it.image) { hit.image = it.image; byKey.set('i:' + ki, hit); }
          if (!hit.link && it.link) { hit.link = it.link; byKey.set('l:' + kl, hit); }
          if (!hit.title && it.title) hit.title = it.title;
          continue;
        }
        if (out.length >= LIMITS.items) continue;
        const x = { key: 'f' + out.length, image: it.image || null, link: it.link || null, title: it.title || null };
        out.push(x);
        if (ki) byKey.set('i:' + ki, x);
        if (kl) byKey.set('l:' + kl, x);
      }
    }
    return out;
  }

  function found(name, items, files, notes, paths, hints) {
    return {
      name, items, files,
      links: items.length,
      pictures: items.filter((i) => i.image).length,
      source: guessSource(name, paths, items, hints),
      notes: notes || [],
    };
  }

  /** One text file's links and pictures. */
  function harvestText(name, text) {
    const hints = /^\s*window\.YTD\./.test(String(text).slice(0, 200)) ? ['window.ytd'] : [];
    return found(name, mergeItems([harvestItems(name, text)]), 1, [], [], hints);
  }

  // ---------------------------------------------------------------- reading files

  class FileError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const TEXT_FILE = /\.(?:json|js|html?|csv|tsv|txt)$/i;

  async function readCapped(stream, max) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0, truncated = false;
    try {
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        const c = r.value;
        if (total + c.length > max) { chunks.push(c.subarray(0, max - total)); total = max; truncated = true; break; }
        chunks.push(c);
        total += c.length;
      }
    } finally {
      if (truncated) { try { await reader.cancel(); } catch (e) { /* already closed */ } }
      try { reader.releaseLock(); } catch (e) { /* released */ }
    }
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunks) { out.set(c, p); p += c.length; }
    return { bytes: out, truncated };
  }

  const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());
  const u64 = (dv, p) => dv.getUint32(p, true) + dv.getUint32(p + 4, true) * 4294967296;

  function decodeName(bytes, utf8) {
    try { return new TextDecoder('utf-8', { fatal: !utf8 }).decode(bytes); } catch (e) {
      let s = ''; for (const b of bytes) s += String.fromCharCode(b); return s;
    }
  }

  /** The files inside a .zip: [{name, size, method, encrypted, read(max) -> Promise<{bytes, truncated}>}]. */
  async function unzip(blob) {
    const size = blob.size;
    if (size < 22) throw new FileError('not a zip', 'This file is empty or cut short.');
    const tailLen = Math.min(size, 22 + 65535);
    const tailStart = size - tailLen;
    const tail = new DataView((await bytesOf(blob.slice(tailStart))).buffer);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new FileError('not a zip', 'This file is cut short or isn’t what it says it is.');
    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOff = tail.getUint32(eocd + 16, true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
      // zip64: a locator just before the end record says where the bigger record is.
      const loc = eocd - 20;
      if (loc >= 0 && tail.getUint32(loc, true) === 0x07064b50) {
        const at = u64(tail, loc + 8);
        const rec = new DataView((await bytesOf(blob.slice(at, at + 56))).buffer);
        if (rec.getUint32(0, true) === 0x06064b50) { count = u64(rec, 32); cdSize = u64(rec, 40); cdOff = u64(rec, 48); }
      }
    }
    if (cdSize > LIMITS.directory || cdOff + cdSize > size) throw new FileError('not a zip', 'This file is cut short or too large to read here.');
    const cd = new DataView((await bytesOf(blob.slice(cdOff, cdOff + cdSize))).buffer);
    const entries = [];
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true);
      let csize = cd.getUint32(p + 20, true), usize = cd.getUint32(p + 24, true);
      const nlen = cd.getUint16(p + 28, true), xlen = cd.getUint16(p + 30, true), clen = cd.getUint16(p + 32, true);
      let lho = cd.getUint32(p + 42, true);
      if (p + 46 + nlen > cd.byteLength) break;
      const name = decodeName(new Uint8Array(cd.buffer, p + 46, nlen), !!(flags & 0x800));
      let q = p + 46 + nlen;
      const xend = Math.min(q + xlen, cd.byteLength);
      while (q + 4 <= xend) {
        const id = cd.getUint16(q, true), sz = cd.getUint16(q + 2, true);
        if (id === 1) {
          let r = q + 4;
          if (usize === 0xffffffff && r + 8 <= xend) { usize = u64(cd, r); r += 8; }
          if (csize === 0xffffffff && r + 8 <= xend) { csize = u64(cd, r); r += 8; }
          if (lho === 0xffffffff && r + 8 <= xend) { lho = u64(cd, r); r += 8; }
        }
        q += 4 + sz;
      }
      p = p + 46 + nlen + xlen + clen;
      if (/\/$/.test(name)) continue; // a folder
      const e = { name, size: usize, csize, method, encrypted: !!(flags & 1), lho };
      e.read = (max) => readEntry(blob, e, max);
      entries.push(e);
    }
    return entries;
  }

  async function readEntry(blob, e, max) {
    const lh = new DataView((await bytesOf(blob.slice(e.lho, e.lho + 30))).buffer);
    if (lh.byteLength < 30 || lh.getUint32(0, true) !== 0x04034b50) throw new FileError('bad entry', 'Part of this file is damaged.');
    const start = e.lho + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const raw = blob.slice(start, start + e.csize);
    if (e.encrypted) throw new FileError('locked', 'Part of this file is locked with a password.');
    if (e.method === 0) { const b = await bytesOf(raw.slice(0, max)); return { bytes: b, truncated: e.csize > max }; }
    if (e.method === 8) {
      if (typeof DecompressionStream !== 'function') throw new FileError('no unpack', 'This browser can’t open this kind of file. Open it on your computer first and drop what’s inside.');
      let ds;
      try { ds = new DecompressionStream('deflate-raw'); } catch (err) { throw new FileError('no unpack', 'This browser can’t open this kind of file. Open it on your computer first and drop what’s inside.'); }
      return readCapped(raw.stream().pipeThrough(ds), max);
    }
    throw new FileError('method', 'Part of this file is packed in a way 5s can’t open.');
  }

  const isZipHead = (b) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5) && (b[3] === 4 || b[3] === 6);
  const looksBinary = (s) => /\u0000/.test(s.slice(0, 2000));
  const utf8 = (bytes) => new TextDecoder('utf-8').decode(bytes);

  /** Read an app's "download your data" file on this device: Found (see the top of this file). */
  async function readFile(file) {
    const name = (file && file.name) || 'Your file';
    if (!file || typeof file.slice !== 'function') throw new FileError('unreadable', 'That isn’t a file 5s can read.');
    const head = await bytesOf(file.slice(0, 4));
    if (isZipHead(head)) {
      const entries = await unzip(file);
      const texts = entries.filter((e) => TEXT_FILE.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name));
      // Saves first: when an export names its saves (saved, liked, favourites, bookmarks, pins…), read those.
      const saves = texts.filter((e) => SAVES.test(e.name.toLowerCase().replace(/[/._-]+/g, ' ')));
      const pick = (saves.length ? saves : texts).slice(0, LIMITS.entries);
      const notes = [];
      if ((saves.length ? saves : texts).length > LIMITS.entries) notes.push('Only the first ' + LIMITS.entries + ' files inside were read.');
      const lists = [];
      const hints = [];
      let total = 0, skipped = 0;
      for (const e of pick) {
        if (total >= LIMITS.totalBytes) { skipped++; continue; }
        let r;
        try { r = await e.read(Math.min(LIMITS.entryBytes, LIMITS.totalBytes - total)); } catch (err) {
          if (err && err.code === 'no unpack') throw err;
          skipped++;
          continue;
        }
        total += r.bytes.length;
        const text = utf8(r.bytes);
        if (looksBinary(text)) continue;
        if (/^\s*window\.YTD\./.test(text.slice(0, 200))) hints.push('window.ytd');
        lists.push(harvestItems(e.name, text));
      }
      if (skipped) notes.push(skipped === 1 ? 'One file inside couldn’t be read.' : skipped + ' files inside couldn’t be read.');
      if (!texts.length) notes.push('Nothing inside this file lists links. Look for a version of the download that does (some apps offer a choice).');
      return found(name, mergeItems(lists), pick.length, notes, entries.map((e) => e.name), hints);
    }
    if (file.size > LIMITS.fileText) throw new FileError('too large', 'This file is too large to read here. If the app offers a smaller download (only your saves), use that.');
    const text = utf8(await bytesOf(file));
    if (looksBinary(text)) throw new FileError('unreadable', 'This isn’t a file 5s can read. Drop the file the app gave you, as it is.');
    return harvestText(name, text);
  }

  // ---------------------------------------------------------------- the 5s connector (mcp)

  class ConnectError extends Error {
    constructor(kind, code, why, resolution, extra) {
      super(why);
      this.kind = kind; this.code = code; this.why = why; this.resolution = resolution || '';
      if (extra) Object.assign(this, extra);
    }
  }

  // What the page says for each way a call can fail before the tool answers (mcp.d.ts McpErrorCode).
  const CLOSED = {
    server_not_connected: [CONNECT_LINE, true],
    server_not_found: [CONNECT_LINE, true],
    not_granted: [CONNECT_LINE, true],
    capability_disabled: [CONNECT_LINE, true],
    capability_removed: [CONNECT_LINE, true],
    not_in_manifest: ['This page isn’t allowed to use 5s in Claude. Allow it when Claude asks, then try again.', false],
    needs_reauth: ['Reconnect 5s in Claude (Settings → Connectors), then try again.', false],
    selection_required: ['Claude has more than one 5s. Choose one when it asks, then try again.', false],
    blocked_by_policy: ['Your organisation doesn’t allow 5s here.', false],
    approval_required: ['Allow 5s for this page when Claude asks, then try again.', false],
    consent_required: ['Allow 5s for this page when Claude asks, then try again.', false],
  };

  function structuredOf(result) {
    if (!result || typeof result !== 'object') return null;
    if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
    const blocks = Array.isArray(result.content) ? result.content : [];
    for (const b of blocks) {
      if (b && b.type === 'text' && /^\s*\{/.test(b.text || '')) { try { const o = JSON.parse(b.text); if (o && typeof o === 'object') return o; } catch (e) { /* not JSON */ } }
    }
    return null;
  }

  function toConnectError(e) {
    if (e instanceof ConnectError) return e;
    const code = e && typeof e.code === 'string' ? e.code : 'upstream_error';
    if (CLOSED[code]) {
      const c = CLOSED[code];
      return new ConnectError('closed', code, c[0], '', c[1] ? { connect: true } : null);
    }
    if (code === 'tool_error') {
      const s = structuredOf(e.result);
      if (s && s.ok === false && (s.why || s.error)) {
        return new ConnectError('refused', s.code || s.error || 'refused', s.why || '5s couldn’t do that.', s.resolution || '', { data: s, error: s.error || null });
      }
      return new ConnectError('failed', code, '5s in Claude didn’t answer as expected.', 'Try again in a moment.');
    }
    if (code === 'server_unavailable' || code === 'rate_limited' || (e && e.retryable)) {
      return new ConnectError('busy', code, '5s in Claude didn’t answer just now.', 'Try again in a moment.', { retryAfterMs: e && e.retryAfterMs });
    }
    if (code === 'cancelled') return new ConnectError('busy', code, 'That was stopped before it finished.', 'Try again.');
    if (code === 'user_changed') return new ConnectError('closed', code, 'Someone else is signed in now.', 'Reload the page.');
    return new ConnectError('failed', code, '5s in Claude didn’t answer as expected.', 'Try again in a moment.');
  }

  /** The tool's JSON from a call's result (`payload`, else structuredContent, else its text as JSON). */
  function payloadOf(r) {
    if (r && r.payload && typeof r.payload === 'object') return r.payload;
    const s = structuredOf(r);
    if (s) return s;
    throw new ConnectError('failed', 'no payload', '5s in Claude didn’t answer as expected.', 'Try again in a moment.');
  }

  /** The 5s connector through the artifact's mcp capability (null: this view has none). */
  function connector(mcp) {
    const has = !!(mcp && typeof mcp.callTool === 'function');
    async function call(tool, input) {
      if (!has) throw new ConnectError('closed', 'no mcp', CONNECT_LINE, '', { connect: true });
      let r;
      try { r = await mcp.callTool(SERVER, tool, input === undefined ? {} : input); } catch (e) { throw toConnectError(e); }
      const p = payloadOf(r);
      if (p && p.ok === false) throw toConnectError({ code: 'tool_error', result: { structuredContent: p } });
      return p;
    }
    return Object.freeze({
      server: SERVER,
      available: has,
      /** "connected", "reauth" (Claude needs it reconnected) or "none". Never calls a tool. */
      async status() {
        if (!has || typeof mcp.listTools !== 'function') return has ? 'connected' : 'none';
        let list;
        try { list = await mcp.listTools(SERVER); } catch (e) { return 'none'; }
        const s = list && Array.isArray(list.servers) ? list.servers.find((x) => x && x.server === SERVER) : null;
        if (!s) return 'none';
        if (s.authStatus === 'needs_reauth') return 'reauth';
        return Array.isArray(s.tools) && s.tools.length ? 'connected' : 'none';
      },
      readLink: (url) => call('read_link', { url: String(url || '').trim() }),
      bringIn: (items, kind) => call('bring_in', kind ? { items: items.map(bringItem), kind } : { items: items.map(bringItem) }),
      itemImage: (id) => call('item_image', { id }),
      getState: () => call('get_state', {}),
    });
  }

  /** An item as bring_in takes it: {image, source, title?, link?, thumb?, kind?}, nothing null. */
  function bringItem(it) {
    const o = { image: String(it.image || '').trim().slice(0, LIMITS.url), source: String(it.source || 'The web').trim().slice(0, 60) || 'The web' };
    if (typeof it.title === 'string' && it.title.trim()) o.title = it.title.trim().slice(0, 300);
    if (typeof it.link === 'string' && /^https:\/\//i.test(it.link) && it.link.length <= LIMITS.url) o.link = it.link;
    if (typeof it.thumb === 'string' && /^https:\/\//i.test(it.thumb) && it.thumb.length <= LIMITS.url) o.thumb = it.thumb;
    if (it.kind === 'image' || it.kind === 'object' || it.kind === 'space') o.kind = it.kind;
    return o;
  }

  /** item_image's data: URL as a Blob (no network: the bytes are in the address). */
  function dataUrlBlob(url) {
    const m = /^data:([\w.+-]+\/[\w.+-]+)?(;base64)?,(.*)$/s.exec(String(url || ''));
    if (!m) throw new ConnectError('failed', 'bad picture', 'That picture didn’t come through.', 'Try again in a moment.');
    const type = m[1] || 'application/octet-stream';
    let bytes;
    if (m[2]) {
      const bin = atob(m[3]);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
    return new Blob([bytes], { type });
  }

  // ---------------------------------------------------------------- words

  /** The letter that stands for a source where there is no picture ("Instagram" -> "I", "The web" -> "W"). */
  function sourceInitial(source) {
    const s = String(source || '').replace(/^(?:the|your)\s+/i, '').trim();
    const m = /[\p{L}\p{N}]/u.exec(s);
    return m ? m[0].toUpperCase() : '•';
  }

  /** What to say to Claude, in any chat with 5s connected. */
  function askSentence(link) {
    const l = String(link || '').trim();
    return 'Show me the pictures at this link, then add the ones I pick to my 5s: ' + (l || '[paste your link]');
  }

  const FiveSConnect = Object.freeze({
    SERVER, CONNECT_LINE, LIMITS,
    readFile, harvestText, unzip,
    cleanUrl, isPicture, keyOf, guessSource,
    connector, bringItem, dataUrlBlob, ConnectError, FileError,
    sourceInitial, askSentence,
    _internals: Object.freeze({ harvestJSON, harvestHTML, harvestCSV, harvestLines, parseCSV, fixMojibake, cleanTitle, mergeItems, toConnectError }),
  });

  if (typeof module === 'object' && module && module.exports) module.exports = FiveSConnect;
  else root.FiveSConnect = FiveSConnect;
})(typeof self !== 'undefined' ? self : globalThis);

/* read_link's reading: a public board, channel, feed or page, made into the pictures it offers
 * (SPEC "Connect your apps", the Paste a link door). Nothing is added here; bring_in adds.
 *
 *   Are.na     a channel (are.na/<user>/<channel>): its public API, api.are.na/v2/channels/<slug>/contents
 *   Pinterest  a board (pinterest.<tld>/<user>/<board>/): the board's public RSS feed, …/<board>.rss;
 *              a profile: …/<user>/feed.rss
 *   Flickr     a person's photos or favourites, by the public feeds (photos_public.gne, photos_faves.gne;
 *              a page that names no NSID is read for the feed it links to)
 *   Tumblr     a blog (<blog>.tumblr.com or tumblr.com/<blog>): its RSS feed, <blog>.tumblr.com/rss
 *   a feed     any RSS or Atom address: media:content, enclosures, or the first picture in each entry
 *   a picture  an address that is itself a picture
 *   any page   its og:image / twitter:image (each one), else its first large <img>
 *
 * Every picture and link offered is an https address that web.js would read (a page pointing at a
 * private address offers nothing there). Titles are other people's text: decoded, stripped of tags
 * and quoted to one line by the caller; they never reach a summary.
 */
import { checkAddress, readableAddress, textOf, typeWord, WebError, WEB_LIMITS } from './web.js';
import { sniff, dimensions } from './pixels.js';

export const MAX_ITEMS = 60;

const DOC_ACCEPT = 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,application/json;q=0.9,*/*;q=0.5';
// Pictures as JPEG or PNG where a site can choose (those are what the connector can read for colours).
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/*;q=0.5';

// ------------------------------------------------------------------ scanning, in one pass

// The parsers find tags, comments and blocks exactly where the lazy patterns /<!--[\s\S]*?-->/,
// /<item\b[\s\S]*?<\/item>/, /<meta\b[^>]*>/ and /<[^>]*>/ would, without their cost on a hostile
// body: on one full of openers that never close, such a pattern scans from every opener to the end
// (a page of 1.5 MB, under the read cap, took minutes of CPU). Here each search runs from an opener
// to the first closer after it, and an opener with no closer after it means no later opener has one
// either, so the search stops there: one pass over the text, whatever is in it.

/** [[start, end], …] of each match of /OPEN[\s\S]*?CLOSE/ in s (open and close are pattern sources). */
function spans(s, open, close, flags = 'gi') {
  const o = new RegExp(open, flags), c = new RegExp(close, flags), out = [];
  for (let m; (m = o.exec(s));) {
    c.lastIndex = o.lastIndex;
    const e = c.exec(s);
    if (!e) break;
    out.push([m.index, c.lastIndex]);
    o.lastIndex = c.lastIndex;
  }
  return out;
}

/** s with each span replaced by keep(start, end), or by a space. */
function cut(s, list, keep) {
  const parts = [];
  let at = 0;
  for (const [a, b] of list) { parts.push(s.slice(at, a), keep ? keep(a, b) : ' '); at = b; }
  parts.push(s.slice(at));
  return parts.join('');
}

/** What the first /<name\b[^>]*>([\s\S]*?)<\/name>/i in s captures, or undefined. */
function inner(s, name) {
  const o = new RegExp('<' + name + '\\b', 'gi');
  if (!o.exec(s)) return undefined;
  const gt = s.indexOf('>', o.lastIndex);
  if (gt < 0) return undefined;
  const c = new RegExp('<\\/' + name + '>', 'gi');
  c.lastIndex = gt + 1;
  const e = c.exec(s);
  return e ? s.slice(gt + 1, e.index) : undefined;
}

/** Whether /<name\b[^>]*href=/i matches in s. */
function tagWithHref(s, name) {
  const o = new RegExp('<' + name + '\\b', 'gi');
  while (o.exec(s)) {
    const gt = s.indexOf('>', o.lastIndex);
    if (/href=/i.test(s.slice(o.lastIndex, gt < 0 ? s.length : gt))) return true;
    if (gt < 0) return false;
    o.lastIndex = gt + 1;
  }
  return false;
}

/** Each match of /<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi: to the closer of its own name. */
function rawBlocks(s) {
  const o = /<(script|style|noscript|template)\b/gi, unclosed = new Set(), out = [];
  for (let m; (m = o.exec(s));) {
    const name = m[1].toLowerCase();
    if (unclosed.has(name)) continue;
    const c = new RegExp('<\\/' + name + '>', 'gi');
    c.lastIndex = o.lastIndex;
    const e = c.exec(s);
    if (!e) { unclosed.add(name); continue; }
    out.push([m.index, c.lastIndex]);
    o.lastIndex = c.lastIndex;
  }
  return out;
}

/** decodeURIComponent, or the text as it is when its escapes are broken (%E0%A4%A). */
const safeDecode = (p) => { try { return decodeURIComponent(p); } catch { return p; } };

// ------------------------------------------------------------------ text

const NAMED ={ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', copy: '©' };

/** HTML and XML entities to characters (named, decimal and hex); unknown ones are left as they are. */
export function decodeEntities(s) {
  return String(s == null ? '' : s).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  });
}

// As s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'), in one pass.
const unCdata = (x) => { const s = String(x || ''); return cut(s, spans(s, '<!\\[CDATA\\[', '\\]\\]>', 'g'), (a, b) => s.slice(a + 9, b - 3)); };

/** Plain text from a bit of markup: CDATA opened, tags dropped, entities decoded, spaces folded. */
export function plainText(s) {
  const t = unCdata(s);
  return decodeEntities(cut(t, spans(t, '<', '>'))).replace(/\s+/g, ' ').trim();
}

/** The attributes of one tag (names lower case, values entity-decoded). */
export function attrsOf(tag) {
  const out = {};
  const inner = String(tag).replace(/^<\s*[a-z0-9:_-]+/i, '').replace(/\/?>$/, '');
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(inner))) {
    const name = m[1].toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : '');
  }
  return out;
}

// Each /<name\b[^>]*>/gi in html, in one pass.
const tags = (html, name) => { const s = String(html); return spans(s, '<' + name + '\\b', '>').map(([a, b]) => s.slice(a, b)); };

// ------------------------------------------------------------------ addresses

/** An https address 5s would read, resolved against `base`; http is upgraded; else null. */
export function pictureAddress(raw, base) {
  if (raw == null) return null;
  let s = decodeEntities(String(raw)).trim();
  if (!s || /^(data|javascript|blob|about):/i.test(s)) return null;
  if (s.startsWith('//')) s = 'https:' + s;
  let u;
  try { u = new URL(s, base); } catch { return null; }
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.protocol !== 'https:') return null;
  return readableAddress(u.href) && u.href.length <= WEB_LIMITS.maxUrl ? checkAddress(u.href).href : null;
}

// ------------------------------------------------------------------ what a link is

const PINTEREST = /^(?:[a-z]{2,3}\.|www\.)?pinterest\.(?:com|ca|co\.uk|com\.au|de|fr|es|it|pt|com\.mx|at|ch|ie|nz|jp|kr|ph|cl|co\.kr|se|dk|nl|ru|in)$/;
const PINTEREST_NOT_BOARDS = new Set(['pin', 'ideas', 'search', 'today', 'settings', 'business', 'categories', 'topics', 'explore', 'login', 'about', 'news_hub', '_']);

/**
 * whatLink(url: URL) -> {source, kind, fetch, upgrade?, slug?} describing how to read it.
 * kind: 'arena' (JSON from the API), 'feed' (RSS/Atom), 'flickr-json', 'flickr-page', 'page'.
 */
export function whatLink(u) {
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean).map(safeDecode);
  if (host === 'are.na' || host === 'api.are.na') {
    let slug = null;
    if (host === 'api.are.na') { const i = parts.indexOf('channels'); slug = i >= 0 ? parts[i + 1] : null; }
    else if (parts[0] === 'channel' || parts[0] === 'channels') slug = parts[1];
    else if (parts.length >= 2 && parts[0] !== 'block') slug = parts[1];
    if (slug && /^[a-z0-9_-]{1,120}$/i.test(slug)) {
      return { source: 'Are.na', kind: 'arena', slug,
        fetch: 'https://api.are.na/v2/channels/' + encodeURIComponent(slug) + '/contents?per=' + MAX_ITEMS + '&page=1&sort=position&direction=desc' };
    }
    return { source: 'Are.na', kind: 'page', fetch: u.href };
  }
  if (PINTEREST.test(u.hostname)) {
    const user = parts[0], board = parts[1];
    const ok = (s) => s && /^[A-Za-z0-9_.-]{1,100}$/.test(s);
    if (ok(user) && !PINTEREST_NOT_BOARDS.has(user.toLowerCase())) {
      if (board && /\.rss$/i.test(board)) return { source: 'Pinterest', kind: 'feed', fetch: 'https://www.pinterest.com/' + user + '/' + board };
      if (ok(board) && parts.length <= 3 && !/^(_|pins|boards|following|followers|created|saved)$/i.test(board)) {
        return { source: 'Pinterest', kind: 'feed', fetch: 'https://www.pinterest.com/' + user + '/' + board + '.rss' };
      }
      if (!board || /^(_saved|boards|saved|pins)$/i.test(board)) return { source: 'Pinterest', kind: 'feed', fetch: 'https://www.pinterest.com/' + user + '/feed.rss' };
    }
    return { source: 'Pinterest', kind: 'page', fetch: u.href };
  }
  if (host === 'flickr.com' || host === 'm.flickr.com') {
    if (/^\/services\/feeds\//.test(u.pathname)) {
      const f = new URL(u.href);
      f.hostname = 'www.flickr.com';
      f.searchParams.set('format', 'json');
      f.searchParams.set('nojsoncallback', '1');
      return { source: 'Flickr', kind: 'flickr-json', fetch: f.href };
    }
    if (parts[0] === 'photos' && parts[1]) {
      const faves = /^favou?rites$/i.test(parts[2] || '');
      if (/^\d+@N\d{2}$/.test(parts[1])) {
        return { source: 'Flickr', kind: 'flickr-json',
          fetch: 'https://www.flickr.com/services/feeds/' + (faves ? 'photos_faves.gne' : 'photos_public.gne') + '?id=' + encodeURIComponent(parts[1]) + '&format=json&nojsoncallback=1' };
      }
      return { source: 'Flickr', kind: 'flickr-page', faves, fetch: 'https://www.flickr.com/photos/' + encodeURIComponent(parts[1]) + '/' + (faves ? 'favorites/' : '') };
    }
    return { source: 'Flickr', kind: 'page', fetch: u.href };
  }
  const tumblrBlog = /^([a-z0-9-]{1,63})\.tumblr\.com$/.exec(host);
  if (tumblrBlog && tumblrBlog[1] !== 'www' && tumblrBlog[1] !== 'assets') {
    return { source: 'Tumblr', kind: 'feed', fetch: 'https://' + tumblrBlog[1] + '.tumblr.com/rss' };
  }
  if (host === 'tumblr.com' && parts[0] && /^[a-z0-9-]{1,63}$/i.test(parts[0]) && !/^(dashboard|explore|tagged|search|settings|login|register|blog)$/i.test(parts[0])) {
    return { source: 'Tumblr', kind: 'feed', fetch: 'https://' + parts[0].toLowerCase() + '.tumblr.com/rss' };
  }
  const source = /(^|\.)instagram\.com$/.test(host) ? 'Instagram' : /(^|\.)artsy\.net$/.test(host) ? 'Artsy' : 'The web';
  return { source, kind: /\.(rss|atom)$|\/(feed|rss)\/?$/i.test(u.pathname) ? 'feed' : 'page', fetch: u.href };
}

// ------------------------------------------------------------------ parsers

function offer(list, seen, it) {
  if (!it || !it.image || seen.has(it.image) || list.length >= MAX_ITEMS + 1) return;
  seen.add(it.image);
  list.push(it);
}

/** Are.na: a channel's contents (v2). Blocks with a picture: images, links, media; not text or channels. */
export function parseArena(json, base) {
  const contents = Array.isArray(json) ? json : json && Array.isArray(json.contents) ? json.contents : [];
  const items = [], seen = new Set();
  for (const blk of contents) {
    if (!blk || typeof blk !== 'object' || blk.class === 'Channel' || blk.class === 'Text' || !blk.image) continue;
    const im = blk.image;
    const pick = (k) => (im[k] && typeof im[k] === 'object' ? im[k].url : null);
    const image = pictureAddress(pick('display') || pick('large') || pick('original'), base);
    const thumb = pictureAddress(pick('thumb') || pick('square'), base);
    const id = Number.isInteger(blk.id) ? blk.id : /^\d{1,12}$/.test(String(blk.id)) ? String(blk.id) : null;
    offer(items, seen, image && {
      image, thumb: thumb !== image ? thumb : null,
      title: plainText(blk.title || blk.generated_title || ''),
      link: id != null ? 'https://www.are.na/block/' + id : null,
    });
  }
  const ch = json && !Array.isArray(json) ? json.channel || json : null;
  const title = ch && typeof ch.title === 'string' ? plainText(ch.title) : null;
  return { title, items };
}

const firstImgSrc = (html, base) => {
  for (const t of tags(html, 'img')) {
    const a = attrsOf(t);
    const src = pictureAddress(a.src || a['data-src'], base);
    if (src) return src;
  }
  return null;
};

/** RSS 2.0 or Atom: each item's picture (media:content, enclosure, or the first <img> in it). */
export function parseFeed(xml, base) {
  const s = String(xml);
  const itemSpans = spans(s, '<item\\b', '<\\/item>');
  const blocks = (itemSpans.length ? itemSpans : spans(s, '<entry\\b', '<\\/entry>')).map(([a, z]) => s.slice(a, z));
  const head = s.slice(0, Math.max(0, s.search(/<item\b|<entry\b/i)) || s.length);
  const feedTitle = inner(head, 'title');
  const items = [], seen = new Set();
  for (const b of blocks) {
    const field = (name) => inner(b, name);
    let image = null;
    for (const t of tags(b, 'media:content').concat(tags(b, 'enclosure'))) {
      const a = attrsOf(t);
      if (a.medium === 'image' || /^image\//i.test(a.type || '') || (!a.type && !a.medium && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(a.url || ''))) {
        image = pictureAddress(a.url, base);
        if (image) break;
      }
    }
    let thumb = null;
    for (const t of tags(b, 'media:thumbnail')) { thumb = pictureAddress(attrsOf(t).url, base); if (thumb) break; }
    if (!image) {
      for (const f of ['description', 'content:encoded', 'content', 'summary']) {
        const html = decodeEntities(unCdata(field(f) || ''));
        image = firstImgSrc(html, base);
        if (image) break;
      }
    }
    if (!image) image = thumb;
    let link = null;
    const rssLink = field('link');
    if (rssLink && !tagWithHref(rssLink, 'link')) link = pictureAddress(plainText(rssLink), base);
    if (!link) {
      for (const t of tags(b, 'link')) {
        const a = attrsOf(t);
        if (a.href && (!a.rel || a.rel === 'alternate')) { link = pictureAddress(a.href, base); if (link) break; }
      }
    }
    offer(items, seen, image && { image, thumb: thumb && thumb !== image ? thumb : null, title: plainText(field('title') || ''), link });
  }
  return { title: feedTitle ? plainText(feedTitle) : null, items };
}

/** Flickr's JSON feed (it escapes ' as \', which JSON does not allow: undone first). */
export function parseFlickrJson(text, base) {
  const json = JSON.parse(String(text).replace(/\\'/g, "'"));
  const items = [], seen = new Set();
  for (const it of Array.isArray(json.items) ? json.items : []) {
    const m = it && it.media && typeof it.media.m === 'string' ? it.media.m : null;
    const thumb = pictureAddress(m, base);
    const image = thumb ? pictureAddress(thumb.replace(/_m\.(jpg|png)$/, '_b.$1'), base) : null;
    offer(items, seen, image && { image, thumb: thumb !== image ? thumb : null, title: plainText(it.title || ''), link: pictureAddress(it.link, base) });
  }
  return { title: typeof json.title === 'string' ? plainText(json.title) : null, items };
}

const ICONISH = /(^|[/_.-])(icon|logo|sprite|avatar|favicon|spacer|pixel|badge|emoji|1x1|blank|tracking|ads?)([/_.-]|$)/i;

// ------------------------------------------------------------------ what a page says it is

const LD_MAX_BLOCKS = 6;          // JSON-LD blocks read on one page
const LD_MAX_CHARS = 256 * 1024;  // characters of JSON-LD read in all
const LD_MAX_NODES = 2000;        // objects walked in them
const FACT_CHARS = 300;           // each fact: one line of at most this many characters

/** The JSON-LD blocks of a page (<script type="application/ld+json">), parsed; unreadable ones skipped. */
function ldBlocks(s) {
  const out = [];
  let chars = 0;
  for (const [a, b] of rawBlocks(s)) {
    if (out.length >= LD_MAX_BLOCKS) break;
    const open = s.slice(a, s.indexOf('>', a) + 1);
    if (!/^<script\b/i.test(open) || !/application\/ld\+json/i.test(attrsOf(open).type || '')) continue;
    const body = s.slice(a + open.length, s.lastIndexOf('<', b - 1));
    if (chars + body.length > LD_MAX_CHARS) break;
    chars += body.length;
    try { out.push(JSON.parse(unCdata(body).trim())); } catch { /* not JSON: skipped */ }
  }
  return out;
}

const THING_TYPES = /^(VisualArtwork|Painting|Sculpture|Photograph|Drawing|CreativeWork|Product|IndividualProduct|ProductModel|Book|MusicAlbum|Movie|Place|LandmarksOrHistoricalBuildings|House|Accommodation|ImageObject|Article|NewsArticle|BlogPosting|WebPage|ItemPage|ProductGroup|ArchiveComponent|Collection)$/;

/** The first schema.org thing in the JSON-LD (an artwork or product before a page or article). */
function ldThing(blocks) {
  const found = [];
  let seen = 0;
  const walk = (x, depth) => {
    if (!x || typeof x !== 'object' || depth > 6 || seen > LD_MAX_NODES) return;
    seen++;
    if (Array.isArray(x)) { for (const y of x) walk(y, depth + 1); return; }
    const types = [].concat(x['@type'] || []).map(String);
    if (types.some((t) => THING_TYPES.test(t))) found.push({ x, types });
    if (x['@graph']) walk(x['@graph'], depth + 1);
    if (x.mainEntity) walk(x.mainEntity, depth + 1);
  };
  for (const b of blocks) walk(b, 0);
  const rank = (t) => (t.types.some((y) => /Artwork|Painting|Sculpture|Photograph|Drawing/.test(y)) ? 0 : t.types.some((y) => /Product|Book|Album|Movie|Place|Landmark|House|Accommodation|Archive|Collection/.test(y)) ? 1 : t.types.some((y) => /CreativeWork/.test(y)) ? 2 : 3);
  found.sort((p, q) => rank(p) - rank(q));
  return found.length ? found[0].x : null;
}

/** A schema.org value as plain text: a string, a number, {name}, or a list of them (joined). */
function ldText(v, depth) {
  if (v == null || (depth || 0) > 3) return '';
  if (typeof v === 'string' || typeof v === 'number') return plainText(String(v));
  if (Array.isArray(v)) return v.slice(0, 6).map((y) => ldText(y, (depth || 0) + 1)).filter(Boolean).join(', ');
  if (typeof v === 'object') return ldText(v.name || v['@value'] || v.value || '', (depth || 0) + 1);
  return '';
}

const fact = (t) => {
  const v = String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!v) return null;
  return v.length > FACT_CHARS ? v.slice(0, FACT_CHARS - 1).trimEnd() + '…' : v;
};

/**
 * What a single page says the thing on it is: read_link's data.page. Every value is the page's own
 * text, one line of at most 300 characters (or null): quoted data, never instructions, never in a summary.
 *   title (og:title, else <title>) · description (og:description, else meta description) · site
 *   (og:site_name) · type (og:type) · image (og:image) · author (meta author, article:author, JSON-LD
 *   author) · maker (JSON-LD creator, else brand: product:brand, JSON-LD brand) · name, date
 *   (dateCreated), material, medium (artMedium) from schema.org JSON-LD when the page has it.
 */
export function pageFacts(metas, s, ldSource, base, title) {
  const metaOf = (...names) => { for (const a of metas) if (names.includes(String(a.property || a.name || a.itemprop || '').toLowerCase()) && a.content) return a.content; return null; };
  const thing = ldThing(ldBlocks(ldSource)) || {};
  const image = pictureAddress(metaOf('og:image:secure_url', 'og:image', 'og:image:url'), base);
  return {
    title: fact(plainText(metaOf('og:title') || '') || title || ''),
    description: fact(plainText(metaOf('og:description') || metaOf('description') || metaOf('twitter:description') || '')),
    site: fact(plainText(metaOf('og:site_name') || '')),
    type: fact(plainText(metaOf('og:type') || '')),
    image,
    author: fact(plainText(metaOf('author', 'article:author') || '') || ldText(thing.author)),
    maker: fact(ldText(thing.creator) || ldText(thing.artist) || plainText(metaOf('product:brand', 'og:brand') || '') || ldText(thing.brand) || ldText(thing.manufacturer)),
    name: fact(ldText(thing.name)),
    date: fact(ldText(thing.dateCreated)),
    material: fact(ldText(thing.material)),
    medium: fact(ldText(thing.artMedium) || ldText(thing.artform)),
  };
}

/** A page: its og:image / twitter:image (each one), else its first large <img>; its title; and what it says it is (facts). */
export function parsePage(html, base) {
  const noComments = cut(String(html), spans(String(html), '<!--', '-->'));
  const s = cut(noComments, rawBlocks(noComments));
  const metas = tags(s, 'meta').map(attrsOf);
  const metaOf = (...names) => metas.filter((a) => names.includes(String(a.property || a.name || '').toLowerCase())).map((a) => a.content);
  let baseHref = base;
  const baseTag = tags(s, 'base').map(attrsOf).find((a) => a.href);
  if (baseTag) { try { baseHref = new URL(baseTag.href, base).href; } catch { /* keep */ } }
  const title = plainText(metaOf('og:title')[0] || metaOf('twitter:title')[0] || inner(s, 'title') || '');
  const items = [], seen = new Set();
  const shared = metaOf('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src');
  for (const t of tags(s, 'link').map(attrsOf)) if (String(t.rel || '').toLowerCase() === 'image_src') shared.push(t.href);
  for (const raw of shared) offer(items, seen, (() => { const image = pictureAddress(raw, baseHref); return image && { image, thumb: null, title, link: base }; })());
  if (!items.length) {
    for (const t of tags(s, 'img')) {
      const a = attrsOf(t);
      let src = a.src || a['data-src'];
      if (a.srcset) {
        const best = a.srcset.split(',').map((x) => x.trim().split(/\s+/)).filter((x) => x[0])
          .map(([u, d]) => ({ u, n: parseFloat(d) || 1 })).sort((p, q) => q.n - p.n)[0];
        if (best && best.n >= 300) src = best.u;
      }
      const image = pictureAddress(src, baseHref);
      if (!image || /\.svg(\?|$)/i.test(image) || ICONISH.test(new URL(image).pathname)) continue;
      const w = parseInt(a.width, 10), h = parseInt(a.height, 10);
      if ((w && w < 200) || (h && h < 150)) continue;   // declared small: an icon, a button
      offer(items, seen, { image, thumb: null, title: plainText(a.alt || '') || title, link: base });
      break;
    }
  }
  const feed = tags(s, 'link').map(attrsOf).find((a) => /alternate/i.test(a.rel || '') && /(rss|atom)\+xml/i.test(a.type || '') && a.href);
  const titleTag = plainText(inner(s, 'title') || '');
  return { title: title || null, items, feed: feed ? pictureAddress(feed.href, baseHref) : null, facts: pageFacts(metas, s, noComments, baseHref, titleTag) };
}

// ------------------------------------------------------------------ reading

const looksJson = (b) => /^\s*[[{]/.test(textOf(b.subarray(0, 64)));
// It was /…(<!--[\s\S]*?-->\s*)*<(rss|…: a run of k comments could be split 2^k ways, all tried on a
// page that is not a feed (28 empty comments, 296 bytes, took 14 s). A run of comments is itself one
// "<!--", anything, "-->", so this matches exactly the same texts, with one way to split them.
const looksFeed = (t) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*-->\s*)?<(rss|feed|rdf:RDF)\b/i.test(t);

function notReadable(what) {
  return new WebError('not readable', 'That address is ' + what + ', not a readable page or picture.', 'Use the address of the board, channel or page that shows the pictures.');
}

/**
 * readLink(web, url) -> {source, title, url, items: [{image, thumb, title, link}], more}
 * web is a createWeb() reader; url has passed checkAddress. Throws WebError.
 */
export async function readLink(web, url) {
  const what = whatLink(url);
  // Read at most the cap, never more: a page's preview picture is in its head, so a page cut short is
  // still read; data and feeds cut short can't be, and are refused as too large.
  const doc = await web.get(what.fetch, { accept: DOC_ACCEPT, maxBytes: WEB_LIMITS.pageBytes, partial: true });
  const text = () => textOf(doc.bytes);
  const whole = () => { if (doc.truncated) throw tooLargeDoc(); };
  let out;
  const kindOfBytes = sniff(doc.bytes);
  if (kindOfBytes || /^image\//.test(doc.type)) {
    // The address is itself a picture.
    // The site's Content-Type is its own text: named only when it is a type 5s knows (web.js typeWord).
    if (!kindOfBytes) throw notReadable('a kind of picture that is not supported' + (typeWord(doc.type) ? ' (' + typeWord(doc.type) + ')' : ''));
    const name = safeDecode((new URL(doc.url).pathname.split('/').pop() || '').replace(/\.[a-z0-9]{2,5}$/i, '')).replace(/[_-]+/g, ' ');
    out = { title: null, items: [{ image: doc.url, thumb: null, title: plainText(name), link: url.href }] };
  } else if (what.kind === 'arena') {
    whole();
    let json;
    try { json = JSON.parse(text()); } catch { throw notReadable('an answer from Are.na that could not be read'); }
    out = parseArena(json, doc.url);
    if (!out.title) out.title = what.slug.replace(/-+/g, ' ');
  } else if (what.kind === 'flickr-json' || (doc.type === 'application/json' && /flickr\.com$/.test(new URL(doc.url).hostname))) {
    whole();
    try { out = parseFlickrJson(text(), doc.url); } catch { throw notReadable('an answer from Flickr that could not be read'); }
  } else if (/(rss|atom)\+xml|^(application|text)\/xml$/.test(doc.type) || looksFeed(text().slice(0, 4096))) {
    whole();
    out = parseFeed(text(), doc.url);
  } else if (/html/.test(doc.type) || /<html\b|<head\b|<meta\b/i.test(text().slice(0, 4096))) {
    const page = parsePage(text(), doc.url);
    out = page;
    // A single page (not a board, channel, blog or feed): what it says the thing on it is.
    if (what.kind === 'page') out = Object.assign({}, page, { page: page.facts });
    // A Flickr or Tumblr page that names its public feed: read the feed for all of its pictures.
    if ((what.kind === 'flickr-page' || what.source === 'Tumblr') && page.feed) {
      const f = new URL(page.feed);
      if (/flickr\.com$/.test(f.hostname) && /\/services\/feeds\//.test(f.pathname)) { f.searchParams.set('format', 'json'); f.searchParams.set('nojsoncallback', '1'); }
      const feedDoc = await web.get(f.href, { accept: DOC_ACCEPT, maxBytes: WEB_LIMITS.pageBytes });   // refused whole if over the cap
      const ft = textOf(feedDoc.bytes);
      let fed = null;
      try { fed = looksJson(feedDoc.bytes) ? parseFlickrJson(ft, feedDoc.url) : parseFeed(ft, feedDoc.url); } catch { fed = null; }
      if (fed && fed.items.length) out = { title: fed.title || page.title, items: fed.items };
    }
  } else if (looksJson(doc.bytes)) {
    whole();
    throw notReadable('data (JSON) from an unknown site');
  } else {
    throw notReadable(typeWord(doc.type) ? 'a file of type ' + typeWord(doc.type) : 'a file');
  }
  if (what.source === 'Pinterest') out.items = out.items.map(pinterestSizes);
  const more = out.items.length > MAX_ITEMS;
  const read = { source: what.source, title: out.title || null, url: doc.url, items: out.items.slice(0, MAX_ITEMS), more };
  if (out.page) read.page = out.page;
  return read;
}

/** Pinterest's feed gives each pin at 236 px: offer the 736 px picture, and keep the 236 px one as
 *  the smaller copy bring_in measures. */
function pinterestSizes(it) {
  const m = /^https:\/\/i\.pinimg\.com\/(?:236x|474x)\/(.+)$/.exec(it.image);
  if (!m) return it;
  return Object.assign({}, it, { image: 'https://i.pinimg.com/736x/' + m[1], thumb: it.thumb || it.image });
}

function tooLargeDoc() {
  return new WebError('too large', 'That is too big to read (over ' + Math.round(WEB_LIMITS.pageBytes / 1024) + ' KB).', 'Use the address of a single board, channel or page.');
}

/** For the tests: the one-pass scanners and looksFeed, each checked against the pattern it stands in for. */
export const scan = Object.freeze({ spans, cut, inner, tagWithHref, rawBlocks, tags, unCdata, looksFeed, safeDecode });

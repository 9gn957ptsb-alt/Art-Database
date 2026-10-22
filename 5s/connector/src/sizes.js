/* A smaller copy of a picture, asked of the picture's own site (item_image on Workers Free).
 *
 * On the free plan the connector decodes no picture (COLOUR_BUDGET_PX "0": a Worker gets 10 ms of
 * CPU, and decoding takes far longer), so it cannot shrink a picture that is over item_image's byte
 * cap. Most sites that hold pictures already keep smaller copies at addresses that follow a known
 * pattern, and making them costs 5s nothing: it asks for one. smallerCopies(address, dim) lists the
 * copies to try, smallest first, each expected to be at least MIN_EDGE px on its long edge (enough for
 * the app to read colours, surface and texture), and none bigger than the picture itself:
 *
 *   Pinterest   i.pinimg.com/<size>/…           236x · 474x · 564x · 736x (widths)
 *   Artsy       d32dm0rphc51dk.cloudfront.net/<token>/<version>.jpg   medium · large · larger
 *   Are.na      d2w9rnfcy7mm78.cloudfront.net/<id>/<version>_<file>   thumb_ · display_
 *   Flickr      live.staticflickr.com/…/<id>_<secret>[_<suffix>].jpg  z (640) · c (800) · b (1024)
 *   Tumblr      64.media.tumblr.com/…/s<w>x<h>/… and tumblr_…_<w>.jpg  540 · 640 · 1280
 *   Wikimedia   upload.wikimedia.org/…/thumb/…/<w>px-<file>           500 · 960 · 1280 (its standard widths)
 *   Unsplash, imgix   ?w= / ?h=                                        the long edge at MIN_EDGE
 *   Cloudinary  res.cloudinary.com/…/upload/…                          c_limit,w_<n>,h_<n> added last
 *   Shopify     cdn.shopify.com/…/<file>_<w>x<h>.<ext>                 _<n>x<n>
 *
 * item_image reads each one only up to its byte cap and keeps the first that is a picture, under the
 * cap and (when its size can be told) at least MIN_EDGE px on its long edge; then it says plainly why
 * none would do. Every address made here goes through web.js's checks like any other.
 */

export const MIN_EDGE = 512;

const long = (w, h) => Math.max(w, h);

/** The long edge of a copy `width` px wide of a picture of dim (unknown dim: as if landscape). */
function longAtWidth(width, dim) {
  if (!dim || !dim.w || !dim.h) return width;
  return Math.round(long(width, (width * dim.h) / dim.w));
}

/** The long edge of a copy that fits a w × h box. */
function longInBox(bw, bh, dim) {
  if (!dim || !dim.w || !dim.h) return Math.min(bw, bh);
  const s = Math.min(bw / dim.w, bh / dim.h, 1);
  return Math.round(long(dim.w * s, dim.h * s));
}

/** Widths in order: those whose copy would be at least MIN_EDGE on its long edge, never larger than the picture. */
function byWidth(widths, dim) {
  return widths.filter((w) => longAtWidth(w, dim) >= MIN_EDGE && (!dim || !dim.w || w < dim.w));
}

const RULES = [
  {
    name: 'Pinterest',
    test: (u) => u.hostname === 'i.pinimg.com' && /^\/(?:originals|\d{2,4}x(?:\d{2,4})?)\//.test(u.pathname),
    copies(u, dim) {
      const rest = u.pathname.replace(/^\/[^/]+\//, '/');
      return byWidth([236, 474, 564, 736], dim).map((w) => 'https://i.pinimg.com/' + w + 'x' + rest);
    },
  },
  {
    name: 'Artsy',
    test: (u) => u.hostname === 'd32dm0rphc51dk.cloudfront.net' && /^\/[A-Za-z0-9_-]{10,40}\/[a-z_]+\.(?:jpg|jpeg|png)$/i.test(u.pathname),
    copies(u, dim) {
      // Artsy's versions: medium (about 260 px tall), large (about 640 px on its long edge), larger (1024).
      const [, token, version] = /^\/([^/]+)\/([a-z_]+)\./i.exec(u.pathname);
      const sizes = [['medium', 260], ['large', 640], ['larger', 1024]];
      return sizes.filter(([v, edge]) => v !== version && edge >= MIN_EDGE && (!dim || !dim.w || edge < long(dim.w, dim.h)))
        .map(([v]) => 'https://' + u.hostname + '/' + token + '/' + v + '.jpg');
    },
  },
  {
    name: 'Are.na',
    test: (u) => u.hostname === 'd2w9rnfcy7mm78.cloudfront.net' && /^\/\d+\/(?:original|large|display|thumb|square)_[^/]+$/.test(u.pathname),
    copies(u, dim) {
      // Are.na keeps thumb (about 400 px wide: tall pictures reach MIN_EDGE) and display (about 1200 px).
      const m = /^\/(\d+)\/([a-z]+)_(.+)$/.exec(u.pathname);
      const sizes = [['thumb', 400], ['display', 1200]];
      return sizes.filter(([v, w]) => v !== m[2] && longAtWidth(w, dim) >= MIN_EDGE && (!dim || !dim.w || w < dim.w))
        .map(([v]) => 'https://' + u.hostname + '/' + m[1] + '/' + v + '_' + m[3] + u.search);
    },
  },
  {
    name: 'Flickr',
    test: (u) => /(^|\.)staticflickr\.com$/.test(u.hostname) && /\/\d+_[0-9a-f]+(?:_[a-z0-9])?\.(?:jpg|png)$/i.test(u.pathname),
    copies(u, dim) {
      const m = /^(.*\/\d+_[0-9a-f]+)(?:_[a-z0-9])?\.(jpg|png)$/i.exec(u.pathname);
      const sizes = [['z', 640], ['c', 800], ['b', 1024]];
      return sizes.filter(([, edge]) => edge >= MIN_EDGE && (!dim || !dim.w || edge < long(dim.w, dim.h)))
        .map(([s]) => 'https://' + u.hostname + m[1] + '_' + s + '.' + m[2]);
    },
  },
  {
    name: 'Tumblr',
    test: (u) => /^\d+\.media\.tumblr\.com$/.test(u.hostname) && (/\/s\d{2,4}x\d{2,4}(?:_[a-z0-9]+)?\//.test(u.pathname) || /_\d{2,4}\.(?:jpg|png|gif)$/i.test(u.pathname)),
    copies(u, dim) {
      const boxes = [[540, 810], [640, 960], [1280, 1920]].filter(([w, h]) => longInBox(w, h, dim) >= MIN_EDGE && (!dim || !dim.w || w < dim.w));
      if (/\/s\d{2,4}x\d{2,4}(?:_[a-z0-9]+)?\//.test(u.pathname)) {
        return boxes.map(([w, h]) => 'https://' + u.hostname + u.pathname.replace(/\/s\d{2,4}x\d{2,4}(_[a-z0-9]+)?\//, '/s' + w + 'x' + h + '$1/'));
      }
      return boxes.map(([w]) => 'https://' + u.hostname + u.pathname.replace(/_\d{2,4}(\.[a-z]+)$/i, '_' + w + '$1'));
    },
  },
  {
    name: 'Wikimedia',
    test: (u) => u.hostname === 'upload.wikimedia.org' && /^\/wikipedia\/[^/]+\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/[^/]+/.test(u.pathname),
    copies(u, dim) {
      const m = /^\/wikipedia\/([^/]+)\/(?:thumb\/)?([0-9a-f])\/([0-9a-f]{2})\/([^/]+)/.exec(u.pathname);
      const file = m[4];
      // Wikimedia's standard thumbnail widths (other widths are slower, or refused).
      const out = byWidth([500, 960, 1280], dim).map((w) => 'https://upload.wikimedia.org/wikipedia/' + m[1] + '/thumb/' + m[2] + '/' + m[3] + '/' + file + '/' + w + 'px-' + file + (/\.(svg|tiff?)$/i.test(file) ? '.jpg' : ''));
      return out;
    },
  },
  {
    name: 'imgix',
    test: (u) => u.hostname === 'images.unsplash.com' || /\.imgix\.net$/.test(u.hostname),
    copies(u, dim) {
      const c = new URL(u.href);
      for (const k of ['w', 'h', 'width', 'height', 'max-w', 'max-h', 'dpr', 'fit', 'crop', 'q', 'fm', 'auto']) c.searchParams.delete(k);
      const tall = dim && dim.h > dim.w;
      c.searchParams.set(tall ? 'h' : 'w', String(MIN_EDGE));
      c.searchParams.set('fit', 'max');
      c.searchParams.set('fm', 'jpg');
      c.searchParams.set('q', '75');
      return [c.href];
    },
  },
  {
    name: 'Cloudinary',
    test: (u) => u.hostname === 'res.cloudinary.com' && /^\/[^/]+\/image\/upload\//.test(u.pathname),
    copies(u) {
      const m = /^(\/[^/]+\/image\/upload)\/(.*)$/.exec(u.pathname);
      const parts = m[2].split('/');
      let k = 0;
      // Transformations already there (w_300,c_fill …) stay; ours goes after them, so it is the last word.
      while (k < parts.length - 1 && /^[a-z]{1,4}_[^/]*$/.test(parts[k]) && !/^v\d+$/.test(parts[k])) k++;
      const ours = 'c_limit,w_' + MIN_EDGE + ',h_' + MIN_EDGE + ',q_auto,f_jpg';
      return ['https://res.cloudinary.com' + m[1] + '/' + parts.slice(0, k).concat([ours], parts.slice(k)).join('/') + u.search];
    },
  },
  {
    name: 'Shopify',
    test: (u) => u.hostname === 'cdn.shopify.com' && /\.(?:jpe?g|png|webp)$/i.test(u.pathname),
    copies(u) {
      const p = u.pathname.replace(/_(?:\d{1,4}x\d{0,4}|x\d{1,4}|pico|icon|thumb|small|compact|medium|large|grande|original|master)(?=\.[a-z]+$)/i, '');
      const c = new URL(u.href);
      c.pathname = p.replace(/(\.[a-z]+)$/i, '_' + MIN_EDGE + 'x' + MIN_EDGE + '$1');
      c.searchParams.delete('width');
      c.searchParams.delete('height');
      return [c.href];
    },
  },
];

/**
 * smallerCopies(address, dim?) -> {site, copies: [address, …]} (copies smallest first; empty when
 * 5s knows no pattern for that site). dim: the picture's own {w, h}, when its first bytes told it.
 */
export function smallerCopies(address, dim) {
  let u;
  try { u = new URL(address); } catch { return { site: null, copies: [] }; }
  if (u.protocol !== 'https:') return { site: null, copies: [] };
  const rule = RULES.find((r) => r.test(u));
  if (!rule) return { site: null, copies: [] };
  const copies = rule.copies(u, dim && dim.w && dim.h ? dim : null).filter((c) => c !== u.href);
  return { site: rule.name, copies: Array.from(new Set(copies)) };
}

/** The sites smallerCopies knows, for the README and the tests. */
export const SIZED_SITES = Object.freeze(RULES.map((r) => r.name));

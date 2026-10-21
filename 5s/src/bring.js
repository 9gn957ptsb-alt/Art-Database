/* 5s bring-in: a person's own image files made into 5s things, their images kept privately.
 * (SPEC.md "Bring in your own" and "Persistence (app.js)".)
 *
 * Plain script, no modules, no UI. Everything happens in this browser, on canvases: nothing is
 * uploaded anywhere except the viewer's own private documents in the artifact's db.
 * Exposes one frozen global, `FiveSBring`:
 *
 * FiveSBring.process(fileOrBlob) -> Promise<{img, thumb, w, h, colours, crop, texture, kindGuess}>
 *   img        data URL, WebP (JPEG where the browser cannot encode WebP; then flattened on white),
 *              at most 720 px on the long edge, quality stepped 0.82 -> 0.5 (then the size stepped
 *              down) so the data URL stays under 180,000 characters. Alpha is kept in WebP.
 *   thumb      data URL, the 128 x 128 centre square.
 *   w, h       pixel size of img (after EXIF orientation).
 *   colours    ["#rrggbb" x 3]: k-means (k = 5, k-means++ seeded from the pixels: deterministic) on a
 *              96 px downsample of the opaque pixels; clusters closer than 12 (RGB) merged, and so
 *              are touching pieces of one smooth gradient (within 36, spreads overlapping); ordered
 *              by share, each at least 36 from those before it (nearer tones only pad); padded to
 *              3 with the merged-away tones, else by repeating the first.
 *   crop       [x, y, w, h] fractions of the image: the square window (side = 1/4 of the shorter edge)
 *              with the most gradient energy, scored as build_deck.py scores the deck's Surfaces
 *              (its second-weakest of 4 x 4 cells, damped when uneven, so all-over texture beats a
 *              single line); kept off the outer 4 %; near-uniform windows skipped, and transparent
 *              areas and their outlines too; the centre window when every window is near uniform.
 *   texture    0..1: edge density of that window, cut from the original pixels and measured at
 *              512 px exactly as build_deck.py measures the deck's Surfaces, on the deck's 0..1 scale.
 *   kindGuess  "image".
 *   Calls run one at a time (a second call waits for the first). Rejects with an Error whose
 *   `message` is plain and whose `code` is "unreadable" ("This file isn't an image we can read.")
 *   or "too_large" (a file over 60 MB).
 *
 * FiveSBring.newId() -> "y" + 5 base36 characters, from crypto.getRandomValues (unbiased).
 *
 * FiveSBring.store({db, uid}) -> Store
 *   db: the resolved `await claude.use("db")` namespace, or null; uid: the awaited
 *   `user.id()`, or null. With both, images are private documents
 *   `data/users/<uid>/own-<id>` = {img, thumb, at}; otherwise IndexedDB (database "5s", store
 *   "own"); otherwise a Map that lasts this visit.
 *   Store.kind        "private" | "device" | "visit". A getter: it can step down during a visit
 *                     (a rejected db write -> "device"; IndexedDB failing -> "visit"), never up.
 *   Store.ready       Promise<kind>, settled once the backing is known to open (IndexedDB is
 *                     probed asynchronously; until then `kind` reads "device").
 *   Store.onKind(fn)  -> unsubscribe. fn(kind) after each step down (e.g. to say "Saved in this
 *                     browser only." or "Images last for this visit only.").
 *   Store.put(id, {img, thumb, at}) -> Promise<void>. One write at a time per document (later puts
 *                     and removes for the same id queue and coalesce). Rejects with a plain Error:
 *                     code "full" (quota_exceeded / QuotaExceededError), "retry" (the store stayed
 *                     unavailable after one retry), "too_large" (document over ~250 KB), "invalid".
 *                     db invalid_argument (and revoked / not_granted / capability_*) switch the rest
 *                     of the visit to "device" and the write is redone there.
 *   Store.get(id)     -> Promise<{img, thumb, at} | null>. Never rejects. Reads the current backing,
 *                     then the ones below it (so images not yet migrated still show), then the
 *                     private documents if this store stepped down from them and they are readable.
 *   Store.thumb(id)   -> Promise<string | null>, cached.
 *   Store.remove(id)  -> Promise<void>. Deletes the image here and any copy in the stores below.
 *   Store.migrateFrom(otherStore, ids) -> Promise<number>: copies the images of `ids` found in
 *                     `otherStore` (a "device" or "visit" store) and not already here, one at a time;
 *                     resolves with how many were copied. The source keeps its copies (a signed-out
 *                     visit still shows them); `remove()` clears both. On a write error it stops and
 *                     rejects with that plain Error, carrying `copied`.
 *   Stores share one IndexedDB connection and one visit Map per page, and their read caches, so a
 *   removal through one Store is seen by the others.
 *
 * Typical use (app.js): render at once with `store({db: null, uid: null})` (the device); when db and
 * the user id resolve, make `store({db, uid})`, call `migrateFrom(deviceStore, ids of state.own)`,
 * and use the private store from then on, listening with onKind for a step down.
 *
 * FiveSBring._internals: helpers exposed for tests only (not part of the contract).
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------ constants

  const MAX_EDGE = 720;
  const MIN_EDGE = 240;                 // never shrink below this to meet the size cap
  const THUMB = 128;
  const IMG_CAP = 180000;               // characters of the img data URL (~180 KB)
  const THUMB_CAP = 20000;
  const QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5];
  const MAX_FILE_BYTES = 60 * 1024 * 1024;
  const COLOUR_EDGE = 96;
  const K = 5;
  const MERGE_DIST = 12;
  const DISTINCT = 36;                  // the three colours given are this far apart when they can be
  const KMEANS_ITERS = 30;
  const ANALYSIS_SHORT = 128;           // the surface search runs on a copy this tall (shorter edge)
  const MARGIN = 0.04;
  const FLAT_STD = 0.012;               // a window whose RGB std (0..1) is below this is near uniform
  const TEX_SIDE = 512;
  // build_deck.py scales each Surface's edge density by the deck's own range; these are that range
  // (measured on the built deck), so a brought thing's texture reads on the same 0..1 scale.
  const TEX_LO = 0.117;
  const TEX_HI = 0.684;
  const DOC_CAP = 250000;               // a db document holds at most 256 KiB

  const MSG = Object.freeze({
    unreadable: "This file isn't an image we can read.",
    tooLargeFile: 'This image is too large to bring in.',
    tooLargeDoc: 'This image is too large to save.',
    full: "There's no room left to keep more images. Remove something you've brought in, then try again.",
    retry: "Couldn't save this image just now. Try again in a moment.",
    retryRemove: "Couldn't remove this image just now. Try again in a moment.",
    invalidId: "This image can't be saved: its id isn't valid.",
    noImage: 'There is no image to save.',
  });

  function plainError(message, code) {
    const e = new Error(message);
    e.code = code;
    return e;
  }

  // ------------------------------------------------------------------ small helpers

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function round(v, dp) { const f = Math.pow(10, dp); return Math.round(v * f) / f; }
  function hex2(v) { const s = clamp(Math.round(v), 0, 255).toString(16); return s.length < 2 ? '0' + s : s; }
  function toHex(c) { return '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]); }

  // mulberry32, as in engine.js
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // FNV-1a over bytes: the seed of the colour clustering, so the same pixels give the same colours
  function hashBytes(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }

  // ------------------------------------------------------------------ ids

  const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  let idFallback = 0;

  /** newId() -> "y" + 5 base36 characters. */
  function newId() {
    let out = 'y';
    const c = root.crypto;
    if (c && typeof c.getRandomValues === 'function') {
      while (out.length < 6) {
        const buf = c.getRandomValues(new Uint8Array(8));
        for (let i = 0; i < buf.length && out.length < 6; i++) {
          if (buf[i] < 252) out += B36[buf[i] % 36];   // 252 = 7 x 36: no modulo bias
        }
      }
      return out;
    }
    // No Web Crypto (very old browsers only): time and a counter, still 5 base36 characters.
    let x = (Date.now() * 31 + (++idFallback) * 7919) % 60466176;   // 36^5
    for (let i = 0; i < 5; i++) { out += B36[x % 36]; x = Math.floor(x / 36); }
    return out;
  }

  // ------------------------------------------------------------------ canvas

  function makeCanvas(w, h) {
    const c = root.document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function context(canvas, read) {
    const g = canvas.getContext('2d', read ? { willReadFrequently: true } : undefined);
    if (!g) throw plainError(MSG.unreadable, 'unreadable');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    return g;
  }

  function release(canvas) { if (canvas && canvas.width) { canvas.width = 0; canvas.height = 0; } }

  /** Fit (w, h) inside a long edge. */
  function fit(w, h, edge) {
    const s = Math.min(1, edge / Math.max(w, h));
    return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
  }

  /** Draw a region of `source` into a new tw x th canvas, stepping down by halves (at most 4x the
   *  target first) so a large photo does not alias. `read` asks for a CPU-backed canvas. */
  function drawScaled(source, sx, sy, sw, sh, tw, th, read) {
    const sizes = [];
    for (let f = 2; f <= 4 && tw * f < sw && th * f < sh; f *= 2) sizes.unshift([Math.round(tw * f), Math.round(th * f)]);
    sizes.push([tw, th]);
    let cur = source, rx = sx, ry = sy, rw = sw, rh = sh, prev = null;
    for (let i = 0; i < sizes.length; i++) {
      const last = i === sizes.length - 1;
      const c = makeCanvas(sizes[i][0], sizes[i][1]);
      const g = context(c, last && read);
      g.drawImage(cur, rx, ry, rw, rh, 0, 0, c.width, c.height);
      if (prev) release(prev);
      prev = c; cur = c; rx = 0; ry = 0; rw = c.width; rh = c.height;
    }
    return cur;
  }

  function pixels(canvas) {
    return context(canvas, true).getImageData(0, 0, canvas.width, canvas.height).data;
  }

  /** A copy flattened onto white, for JPEG (which has no alpha). */
  function flattened(canvas) {
    const c = makeCanvas(canvas.width, canvas.height);
    const g = context(c, false);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(canvas, 0, 0);
    return c;
  }

  let webpOK = null;
  function canEncodeWebP() {
    if (webpOK === null) {
      try { webpOK = makeCanvas(2, 2).toDataURL('image/webp', 0.8).indexOf('data:image/webp') === 0; }
      catch (e) { webpOK = false; }
    }
    return webpOK;
  }

  function toBlob(canvas, type, q) {
    return new Promise((resolve) => {
      if (typeof canvas.toBlob !== 'function') { resolve(null); return; }
      try { canvas.toBlob((b) => resolve(b || null), type, q); } catch (e) { resolve(null); }
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new root.FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error || new Error('read'));
      r.readAsDataURL(blob);
    });
  }

  /** Encode at quality q; null when the data URL would be over `cap` characters. */
  async function encodeOne(canvas, type, q, cap) {
    const b = await toBlob(canvas, type, q);
    if (b && b.size) {
      const t = b.type || type;
      const est = 13 + t.length + 4 * Math.ceil(b.size / 3);   // "data:" + type + ";base64," + payload
      if (est > cap) return null;
      return blobToDataURL(b);
    }
    const u = canvas.toDataURL(type, q);
    return u.length <= cap ? u : null;
  }

  async function encodeCapped(canvas, type, cap, qualities) {
    for (const q of qualities) {
      const u = await encodeOne(canvas, type, q, cap);
      if (u) return u;
    }
    return null;
  }

  // ------------------------------------------------------------------ decode

  /** Decode a Blob or File, oriented by its EXIF. -> {source, w, h, close()} */
  async function decode(blob) {
    if (!blob || typeof blob.size !== 'number' || typeof blob.slice !== 'function' || blob.size === 0) {
      throw plainError(MSG.unreadable, 'unreadable');
    }
    if (blob.size > MAX_FILE_BYTES) throw plainError(MSG.tooLargeFile, 'too_large');
    // Clearly not a picture (by its declared type): no need to try the decoders. Anything else,
    // an empty or generic type included, is tried, since the decoders read the bytes themselves.
    const type = String(blob.type || '').toLowerCase();
    if (/^(text\/(plain|html|csv|css|javascript)|audio\/|video\/|application\/(pdf|json|zip|msword|vnd\.))/.test(type)) {
      throw plainError(MSG.unreadable, 'unreadable');
    }
    if (typeof root.createImageBitmap === 'function') {
      try {
        const bmp = await root.createImageBitmap(blob, { imageOrientation: 'from-image' });
        if (bmp.width > 0 && bmp.height > 0) {
          return { source: bmp, w: bmp.width, h: bmp.height, close() { if (bmp.close) bmp.close(); } };
        }
        if (bmp.close) bmp.close();
      } catch (e) { /* not decodable this way (or an older browser): try an <img> */ }
    }
    if (typeof root.Image !== 'function' || !root.URL || typeof root.URL.createObjectURL !== 'function') {
      throw plainError(MSG.unreadable, 'unreadable');
    }
    const url = root.URL.createObjectURL(blob);
    try {
      const img = new root.Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      if (typeof img.decode === 'function') { try { await img.decode(); } catch (e) { /* loaded is enough */ } }
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!(w > 0 && h > 0)) throw new Error('empty');
      return { source: img, w, h, close() { root.URL.revokeObjectURL(url); } };
    } catch (e) {
      root.URL.revokeObjectURL(url);
      throw plainError(MSG.unreadable, 'unreadable');
    }
  }

  // ------------------------------------------------------------------ colours

  /** Three dominant colours of RGBA pixels, as #rrggbb, by share. */
  function dominantColours(data) {
    const total = data.length >> 2;
    let n = 0;
    for (let i = 0; i < total; i++) if (data[i * 4 + 3] >= 128) n++;
    const useAll = n < 16;              // nearly all transparent: read every pixel, on white
    if (useAll) n = total;
    if (!n) return ['#ffffff', '#ffffff', '#ffffff'];
    const p = new Float64Array(n * 3);
    for (let i = 0, j = 0; i < total; i++) {
      const a = data[i * 4 + 3];
      if (!useAll && a < 128) continue;
      const f = useAll ? a / 255 : 1;
      p[j++] = data[i * 4] * f + 255 * (1 - f);
      p[j++] = data[i * 4 + 1] * f + 255 * (1 - f);
      p[j++] = data[i * 4 + 2] * f + 255 * (1 - f);
    }
    const rnd = mulberry32(hashBytes(data));
    const d2 = (i, c) => {
      const dr = p[i * 3] - c[0], dg = p[i * 3 + 1] - c[1], db = p[i * 3 + 2] - c[2];
      return dr * dr + dg * dg + db * db;
    };
    // k-means++ initialisation, drawn from the seeded PRNG
    const first = Math.min(n - 1, Math.floor(rnd() * n));
    const centres = [[p[first * 3], p[first * 3 + 1], p[first * 3 + 2]]];
    const near = new Float64Array(n).fill(Infinity);
    while (centres.length < K) {
      const c = centres[centres.length - 1];
      let sum = 0;
      for (let i = 0; i < n; i++) { const d = d2(i, c); if (d < near[i]) near[i] = d; sum += near[i]; }
      if (sum <= 0) break;              // fewer distinct colours than K
      let r = rnd() * sum, pick = n - 1;
      for (let i = 0; i < n; i++) { r -= near[i]; if (r <= 0) { pick = i; break; } }
      centres.push([p[pick * 3], p[pick * 3 + 1], p[pick * 3 + 2]]);
    }
    // Lloyd iterations
    const k = centres.length;
    const assign = new Int32Array(n).fill(-1);
    const counts = new Float64Array(k);
    for (let it = 0; it < KMEANS_ITERS; it++) {
      let changed = 0;
      const sums = new Float64Array(k * 3);
      counts.fill(0);
      for (let i = 0; i < n; i++) {
        let best = 0, bd = Infinity;
        for (let c = 0; c < k; c++) { const d = d2(i, centres[c]); if (d < bd) { bd = d; best = c; } }
        if (assign[i] !== best) { assign[i] = best; changed++; }
        counts[best]++;
        sums[best * 3] += p[i * 3]; sums[best * 3 + 1] += p[i * 3 + 1]; sums[best * 3 + 2] += p[i * 3 + 2];
      }
      for (let c = 0; c < k; c++) {
        if (counts[c]) centres[c] = [sums[c * 3] / counts[c], sums[c * 3 + 1] / counts[c], sums[c * 3 + 2] / counts[c]];
      }
      if (!changed) break;
    }
    let clusters = [];
    for (let c = 0; c < k; c++) if (counts[c]) clusters.push({ c: centres[c], n: counts[c], label: c });
    const tones = clusters.slice().sort((a, b) => b.n - a.n);
    // Spread of a cluster along the line to another (its points' standard deviation on that axis).
    const spread = (A, u) => {
      let s = 0;
      for (let i = 0; i < n; i++) {
        if (assign[i] !== A.label) continue;
        const t = (p[i * 3] - A.c[0]) * u[0] + (p[i * 3 + 1] - A.c[1]) * u[1] + (p[i * 3 + 2] - A.c[2]) * u[2];
        s += t * t;
      }
      return Math.sqrt(s / A.n);
    };
    // Merge clusters closer than MERGE_DIST. K-means also cuts one smooth gradient (light falling
    // across a wall) into touching pieces: neighbours within 3 x MERGE_DIST whose spreads along the
    // line between them overlap (centres closer than twice the summed spread) are one colour too.
    // Closest (relative to its threshold) first.
    for (;;) {
      let best = null;
      for (let a = 0; a < clusters.length; a++) {
        for (let b = a + 1; b < clusters.length; b++) {
          const A = clusters[a], B = clusters[b];
          const d = Math.hypot(A.c[0] - B.c[0], A.c[1] - B.c[1], A.c[2] - B.c[2]);
          let limit = MERGE_DIST;
          if (d >= MERGE_DIST && d < 3 * MERGE_DIST) {
            const u = [(B.c[0] - A.c[0]) / d, (B.c[1] - A.c[1]) / d, (B.c[2] - A.c[2]) / d];
            limit = Math.min(3 * MERGE_DIST, Math.max(MERGE_DIST, 2 * (spread(A, u) + spread(B, u))));
          }
          if (d < limit && (!best || d / limit < best.r)) best = { a, b, r: d / limit };
        }
      }
      if (!best) break;
      const A = clusters[best.a], B = clusters[best.b], m = A.n + B.n;
      for (let i = 0; i < n; i++) if (assign[i] === B.label) assign[i] = A.label;
      const merged = { c: [0, 1, 2].map((i) => (A.c[i] * A.n + B.c[i] * B.n) / m), n: m, label: A.label };
      clusters = clusters.filter((_, i) => i !== best.a && i !== best.b).concat([merged]);
    }
    clusters.sort((a, b) => b.n - a.n);
    // By share, each at least DISTINCT from those before it, so a second tone of the paper or the
    // wall does not push out the next real colour (as the deck's Artsy colours are distinct too);
    // nearer tones fill in only when there are not three distinct colours.
    const far = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) >= DISTINCT;
    const picked = [];
    for (const c of clusters) if (picked.length < 3 && picked.every((o) => far(o.c, c.c))) picked.push(c);
    const out = picked.map((c) => toHex(c.c));
    for (const t of clusters.concat(tones)) {   // pad with the nearer tones, then the merged-away ones…
      if (out.length >= 3) break;
      const h = toHex(t.c);
      if (out.indexOf(h) < 0) out.push(h);
    }
    while (out.length < 3) out.push(out[0]);   // …or repeat: the picture is one colour
    return out;
  }

  // ------------------------------------------------------------------ surface

  function integral(src, w, h) {
    const W = w + 1, I = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += src[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; }
    }
    return I;
  }

  function boxSum(I, w, x, y, bw, bh) {
    const W = w + 1;
    return I[(y + bh) * W + x + bw] - I[y * W + x + bw] - I[(y + bh) * W + x] + I[y * W + x];
  }

  /** The square window (side 1/4 of the shorter edge) with the most (and most even) gradient energy.
   *  -> {x, y, s} in pixels of the analysed copy, or null when every window is near uniform. */
  function findSurface(data, w, h) {
    const N = w * h, s = Math.max(1, Math.round(Math.min(w, h) / 4));
    if (Math.min(w, h) < 16) return null;
    const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), L = new Float32Array(N);
    const V = new Float32Array(N);       // transparent pixels: a void, not a surface
    for (let i = 0; i < N; i++) {
      const a = data[i * 4 + 3] / 255;
      const r = (data[i * 4] * a + 255 * (1 - a)) / 255;
      const g = (data[i * 4 + 1] * a + 255 * (1 - a)) / 255;
      const b = (data[i * 4 + 2] * a + 255 * (1 - a)) / 255;
      R[i] = r; G[i] = g; B[i] = b;
      L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      V[i] = a < 0.5 ? 1 : 0;
    }
    // gradient energy: lightness gradient, or colour gradient where lightness is level
    const E = new Float32Array(N);
    const grad = (A, x, y) => {
      const i = y * w + x;
      const gx = x === 0 ? A[i + 1] - A[i] : x === w - 1 ? A[i] - A[i - 1] : (A[i + 1] - A[i - 1]) / 2;
      const gy = y === 0 ? A[i + w] - A[i] : y === h - 1 ? A[i] - A[i - w] : (A[i + w] - A[i - w]) / 2;
      return Math.hypot(gx, gy);
    };
    // a silhouette (where the picture meets transparency) is an outline, not a surface: no energy
    const nearVoid = (x, y) => {
      for (let j = Math.max(0, y - 1); j <= Math.min(h - 1, y + 1); j++) {
        for (let i = Math.max(0, x - 1); i <= Math.min(w - 1, x + 1); i++) if (V[j * w + i]) return true;
      }
      return false;
    };
    let anyVoid = false;
    for (let i = 0; i < N; i++) if (V[i]) { anyVoid = true; break; }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (anyVoid && nearVoid(x, y)) continue;
        const cg = (grad(R, x, y) + grad(G, x, y) + grad(B, x, y)) / 3;
        E[y * w + x] = Math.max(grad(L, x, y), 0.7 * cg);
      }
    }
    const sq = (A) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = A[i] * A[i]; return o; };
    const IE = integral(E, w, h), IV = integral(V, w, h);
    const IR = integral(R, w, h), IG = integral(G, w, h), IB = integral(B, w, h);
    const IR2 = integral(sq(R), w, h), IG2 = integral(sq(G), w, h), IB2 = integral(sq(B), w, h);
    const mx = Math.ceil(MARGIN * w), my = Math.ceil(MARGIN * h);
    const stride = Math.max(1, Math.round(s / 8)), n = s * s;
    const cut = [0, 1, 2, 3, 4].map((i) => Math.round(i * s / 4));   // a 4 x 4 grid of cells
    const cells = new Float64Array(16);
    let best = null, bestLoose = null;
    for (let y = my; y + s <= h - my; y += stride) {
      for (let x = mx; x + s <= w - mx; x += stride) {
        const vr = boxSum(IR2, w, x, y, s, s) / n - Math.pow(boxSum(IR, w, x, y, s, s) / n, 2);
        const vg = boxSum(IG2, w, x, y, s, s) / n - Math.pow(boxSum(IG, w, x, y, s, s) / n, 2);
        const vb = boxSum(IB2, w, x, y, s, s) / n - Math.pow(boxSum(IB, w, x, y, s, s) / n, 2);
        if (Math.sqrt(Math.max(0, (vr + vg + vb) / 3)) < FLAT_STD) continue;
        const mean = boxSum(IE, w, x, y, s, s) / n;
        // As build_deck.py scores the deck's Surfaces: a window is as textured as its second-weakest
        // cell (one soft cell is fine), damped when its energy is uneven (one line, an edge between
        // two flat fields, a lone mark), so an all-over texture beats a single strong line.
        for (let j = 0; j < 4; j++) {
          for (let i = 0; i < 4; i++) {
            const cw = Math.max(1, cut[i + 1] - cut[i]), ch = Math.max(1, cut[j + 1] - cut[j]);
            cells[j * 4 + i] = boxSum(IE, w, x + Math.min(cut[i], s - 1), y + Math.min(cut[j], s - 1), cw, ch) / (cw * ch);
          }
        }
        const sorted = Array.from(cells).sort((a, b) => a - b);
        const weak = sorted[1];
        const even = Math.min(1, weak / (mean + 1e-9));
        // a slight pull to the centre settles ties in even patterns
        const off = Math.hypot((x + s / 2) / w - 0.5, (y + s / 2) / h - 0.5);
        const score = (weak * (0.5 + 0.5 * even) + 1e-6 * mean) * (1 - 0.05 * off);
        const voids = boxSum(IV, w, x, y, s, s) / n;
        if (voids <= 0.01) { if (!best || score > best.score) best = { x, y, s, score }; }
        else if (voids <= 0.5) { if (!bestLoose || score > bestLoose.score) bestLoose = { x, y, s, score }; }
      }
    }
    return best || bestLoose;
  }

  /** Edge density of an RGBA square, measured as build_deck.py does: grey, Gaussian blur (sigma 1),
   *  share of pixels whose gradient exceeds 0.03. Raw, 0..1. */
  function edgeDensity(data, w, h) {
    const N = w * h, a = new Float32Array(N), t = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const al = data[i * 4 + 3] / 255;
      const r = data[i * 4] * al + 255 * (1 - al), g = data[i * 4 + 1] * al + 255 * (1 - al), b = data[i * 4 + 2] * al + 255 * (1 - al);
      a[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    const ker = [];
    for (let k = -3; k <= 3; k++) ker.push(Math.exp(-k * k / 2));
    const ks = ker.reduce((x, y) => x + y, 0);
    for (let k = 0; k < ker.length; k++) ker[k] /= ks;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -3; k <= 3; k++) v += ker[k + 3] * a[y * w + clamp(x + k, 0, w - 1)];
        t[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (let k = -3; k <= 3; k++) v += ker[k + 3] * t[clamp(y + k, 0, h - 1) * w + x];
        a[y * w + x] = Math.round(v) / 255;
      }
    }
    let count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const gx = w < 2 ? 0 : x === 0 ? a[i + 1] - a[i] : x === w - 1 ? a[i] - a[i - 1] : (a[i + 1] - a[i - 1]) / 2;
        const gy = h < 2 ? 0 : y === 0 ? a[i + w] - a[i] : y === h - 1 ? a[i] - a[i - w] : (a[i + w] - a[i - w]) / 2;
        if (Math.hypot(gx, gy) > 0.03) count++;
      }
    }
    return count / N;
  }

  function textureScale(raw) { return round(clamp((raw - TEX_LO) / (TEX_HI - TEX_LO), 0, 1), 2); }

  // ------------------------------------------------------------------ process

  let line = Promise.resolve();

  /** process(fileOrBlob) -> Promise<{img, thumb, w, h, colours, crop, texture, kindGuess}> */
  function process(fileOrBlob) {
    const run = line.then(() => processNow(fileOrBlob));
    line = run.catch(() => {});
    return run;
  }

  async function processNow(blob) {
    if (!root.document) throw plainError(MSG.unreadable, 'unreadable');
    const src = await decode(blob);
    const made = [];
    try {
      // 1. the working copy: 720 px on the long edge
      let [w, h] = fit(src.w, src.h, MAX_EDGE);
      let work;
      try { work = drawScaled(src.source, 0, 0, src.w, src.h, w, h, true); }
      catch (e) { throw plainError(MSG.unreadable, 'unreadable'); }
      made.push(work);
      const webp = canEncodeWebP();
      const type = webp ? 'image/webp' : 'image/jpeg';
      const prep = (c) => { if (webp) return c; const f = flattened(c); made.push(f); return f; };

      // 2. colours, on a 96 px copy
      const [cw, ch] = fit(w, h, COLOUR_EDGE);
      const small = drawScaled(work, 0, 0, w, h, cw, ch, true);
      made.push(small);
      const colours = dominantColours(pixels(small));

      // 3. the surface: search a copy 128 px on its shorter edge, measure at 512 from the original
      const as = Math.min(1, ANALYSIS_SHORT / Math.min(w, h));
      const aw = Math.max(1, Math.round(w * as)), ah = Math.max(1, Math.round(h * as));
      const an = drawScaled(work, 0, 0, w, h, aw, ah, true);
      made.push(an);
      const win = findSurface(pixels(an), aw, ah);
      let cx, cy, cs;
      if (win) { cx = win.x / aw; cy = win.y / ah; cs = win.s; }
      else {                              // every window near uniform: the centre one
        cs = Math.max(1, Math.round(Math.min(aw, ah) / 4));
        cx = (aw - cs) / 2 / aw; cy = (ah - cs) / 2 / ah;
      }
      const fw = round(cs / aw, 4), fh = round(cs / ah, 4);
      const crop = [round(clamp(cx, 0, 1 - fw), 4), round(clamp(cy, 0, 1 - fh), 4), fw, fh];
      const tex = drawScaled(src.source, crop[0] * src.w, crop[1] * src.h, crop[2] * src.w, crop[3] * src.h, TEX_SIDE, TEX_SIDE, true);
      made.push(tex);
      const texture = textureScale(edgeDensity(pixels(tex), TEX_SIDE, TEX_SIDE));

      // 4. the thumbnail: the centre square at 128 px
      const side = Math.min(w, h);
      const th = drawScaled(work, (w - side) / 2, (h - side) / 2, side, side, THUMB, THUMB, false);
      made.push(th);
      const thumb = await encodeCapped(prep(th), type, THUMB_CAP, [0.72, 0.6, 0.5, 0.4]) ||
        prep(th).toDataURL(type, 0.4);

      // 5. the image, under the cap: quality first, then size
      let img = await encodeCapped(prep(work), type, IMG_CAP, QUALITIES);
      while (!img && Math.max(w, h) > MIN_EDGE) {
        [w, h] = fit(w, h, Math.max(MIN_EDGE, Math.round(Math.max(w, h) * 0.8)));
        const smaller = drawScaled(src.source, 0, 0, src.w, src.h, w, h, false);
        made.push(smaller);
        img = await encodeCapped(prep(smaller), type, IMG_CAP, QUALITIES);
      }
      if (!img) throw plainError(MSG.tooLargeFile, 'too_large');
      return { img, thumb, w, h, colours, crop, texture, kindGuess: 'image' };
    } finally {
      for (const c of made) release(c);
      try { src.close(); } catch (e) { /* already closed */ }
    }
  }

  // ------------------------------------------------------------------ storage backends

  // db path grammar: letters, digits and _ - . ~ : @ + ; never "." or ".." alone; <= 200 bytes
  const SEG_RE = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
  function okSegment(s) { return typeof s === 'string' && SEG_RE.test(s) && s !== '.' && s !== '..'; }
  function okId(id) { return okSegment(id) && okSegment('own-' + id); }

  const FALLBACK_CODES = ['invalid_argument', 'transform_error', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'];
  const DEAD_CODES = ['revoked', 'not_granted', 'capability_disabled', 'capability_removed'];
  const KNOWN_CODES = FALLBACK_CODES.concat(['resource_exhausted', 'quota_exceeded', 'unavailable']);

  function codeOf(e) {
    if (e instanceof TypeError) return 'invalid_argument';   // a path the builder refused
    const c = e && typeof e.code === 'string' ? e.code : '';
    return KNOWN_CODES.indexOf(c) >= 0 ? c : 'unavailable';  // unknown codes count as unavailable
  }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /** One retry after a short randomized pause, for transient db conditions. */
  async function withRetry(fn) {
    try { return await fn(); }
    catch (e) {
      const c = codeOf(e);
      if (c !== 'unavailable' && c !== 'resource_exhausted') throw e;
      await delay(250 + Math.floor(Math.random() * 500));
      return fn();
    }
  }

  function dbBackend(db, uid) {
    const path = (id) => 'data/users/' + uid + '/own-' + id;
    return {
      async get(id) { const snap = await db.doc(path(id)).get(); return snap && snap.exists ? snap.data() : null; },
      async put(id, v) { await db.doc(path(id)).set(v); },
      async del(id) { await db.doc(path(id)).delete(); },
    };
  }

  const IDB_NAME = '5s', IDB_STORE = 'own';

  function hasIDB() {
    try { return !!root.indexedDB && typeof root.indexedDB.open === 'function'; } catch (e) { return false; }
  }

  function idbBackend() {
    let opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise((resolve, reject) => {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('IndexedDB did not open')); } }, 6000);
        const finish = (fn, v) => { if (!done) { done = true; clearTimeout(timer); fn(v); } };
        const attempt = (version) => {
          let req;
          try { req = version ? root.indexedDB.open(IDB_NAME, version) : root.indexedDB.open(IDB_NAME); }
          catch (e) { finish(reject, e); return; }
          req.onupgradeneeded = () => {
            try { const d = req.result; if (!d.objectStoreNames.contains(IDB_STORE)) d.createObjectStore(IDB_STORE); }
            catch (e) { /* reported by onerror */ }
          };
          req.onsuccess = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains(IDB_STORE)) { const v = d.version + 1; d.close(); attempt(v); return; }
            d.onversionchange = () => { try { d.close(); } catch (e) { /* closing */ } opening = null; };
            if (done) { d.close(); return; }
            finish(resolve, d);
          };
          req.onerror = () => finish(reject, req.error || new Error('IndexedDB failed'));
        };
        attempt(0);
      });
      opening.catch(() => { opening = null; });
      return opening;
    }
    async function tx(mode, fn, again) {
      const d = await open();
      return new Promise((resolve, reject) => {
        let t, result;
        try { t = d.transaction(IDB_STORE, mode); }
        catch (e) {
          // the connection was closed under us (another tab upgrading the database): reopen once
          if (!again && e && e.name === 'InvalidStateError') { opening = null; tx(mode, fn, true).then(resolve, reject); }
          else reject(e);
          return;
        }
        try {
          const req = fn(t.objectStore(IDB_STORE));
          req.onsuccess = () => { result = req.result; };
        } catch (e) { reject(e); return; }
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error || new Error('IndexedDB failed'));
        t.onabort = () => reject(t.error || new Error('IndexedDB aborted'));
      });
    }
    return {
      open,
      async get(id) { const v = await tx('readonly', (s) => s.get(id)); return v === undefined ? null : v; },
      async put(id, v) { await tx('readwrite', (s) => s.put(v, id)); },
      async del(id) { await tx('readwrite', (s) => s.delete(id)); },
    };
  }

  function memBackend() {
    const m = new Map();
    return {
      async get(id) { return m.has(id) ? m.get(id) : null; },
      async put(id, v) { m.set(id, v); },
      async del(id) { m.delete(id); },
    };
  }

  function isQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 'quota_exceeded');
  }

  /** A stored body, checked: data:image URLs only (anything else reads as missing). */
  function clean(v) {
    if (!v || typeof v !== 'object' || typeof v.img !== 'string' || v.img.indexOf('data:image/') !== 0) return null;
    return {
      img: v.img,
      thumb: typeof v.thumb === 'string' && v.thumb.indexOf('data:image/') === 0 ? v.thumb : null,
      at: typeof v.at === 'number' && isFinite(v.at) ? v.at : null,
    };
  }

  /** A backend with its reads cached: every thumbnail, and the last few whole bodies. Shared by
   *  every Store over the same backing, so one Store's write or removal is seen by the others. */
  function cached(raw) {
    const docs = new Map(), thumbs = new Map(), gen = new Map();
    const keep = (id, v) => {
      docs.delete(id); docs.set(id, v);
      while (docs.size > 8) docs.delete(docs.keys().next().value);
      if (v.thumb) thumbs.set(id, v.thumb); else thumbs.delete(id);
    };
    const drop = (id) => { docs.delete(id); thumbs.delete(id); gen.set(id, (gen.get(id) || 0) + 1); };
    return {
      open: raw.open,
      peekThumb(id) { return thumbs.has(id) ? thumbs.get(id) : null; },
      async get(id) {
        if (docs.has(id)) { const v = docs.get(id); keep(id, v); return v; }
        const g = gen.get(id) || 0;
        const v = clean(await raw.get(id));
        if (v && (gen.get(id) || 0) === g) keep(id, v);   // not if it was removed meanwhile
        return v;
      },
      async put(id, v) { drop(id); await raw.put(id, v); keep(id, v); },
      async del(id) { drop(id); try { await raw.del(id); } finally { drop(id); } },
    };
  }

  // The device and the visit are one each per page, whichever Store reaches them.
  let sharedDevice;                     // undefined: not made yet; null: unusable this visit
  let sharedVisit = null;
  function device() {
    if (sharedDevice === undefined) sharedDevice = hasIDB() ? cached(idbBackend()) : null;
    return sharedDevice;
  }
  function visit() { return sharedVisit || (sharedVisit = cached(memBackend())); }

  // ------------------------------------------------------------------ the store

  const LEVELS = ['private', 'device', 'visit'];

  /** store({db, uid}) -> Store */
  function store(opts) {
    const o = opts || {};
    const uid = o.uid == null ? null : String(o.uid);
    const priv = o.db && typeof o.db.doc === 'function' && uid && okSegment(uid) ? cached(dbBackend(o.db, uid)) : null;
    let mode = priv ? 'private' : device() ? 'device' : 'visit';
    let dbReadable = !!priv;
    const listeners = new Set();
    const queues = new Map();             // id -> {busy, next}: the write queue of each document
    const pending = new Map();            // id -> the body being written (null: being removed)

    function backend(level) { return level === 'private' ? priv : level === 'device' ? device() : visit(); }

    function stepDown(from) {
      if (LEVELS.indexOf(mode) > LEVELS.indexOf(from)) return;   // already lower
      let next = LEVELS[LEVELS.indexOf(from) + 1];
      if (next === 'device' && !device()) next = 'visit';
      if (!next || next === mode) return;
      mode = next;
      listeners.forEach((fn) => { try { fn(mode); } catch (e) { /* a listener's own problem */ } });
    }
    function deviceDead() {
      sharedDevice = null;
      if (mode === 'device') stepDown('device');
    }

    const ready = (async () => {
      if (mode === 'device') {
        try { await device().open(); } catch (e) { deviceDead(); }
      }
      return mode;
    })();

    // ---- writes: one at a time per document; a write queued behind another replaces any
    // write still waiting there (last writer wins, as in the db), and all their callers settle
    function enqueue(id, op, value) {
      pending.set(id, op === 'put' ? value : null);
      return new Promise((resolve, reject) => {
        let q = queues.get(id);
        if (!q) { q = { busy: false, next: null }; queues.set(id, q); }
        if (q.next) { q.next.op = op; q.next.value = value; q.next.waiters.push({ resolve, reject }); }
        else q.next = { op, value, waiters: [{ resolve, reject }] };
        if (!q.busy) pump(id, q);
      });
    }
    async function pump(id, q) {
      q.busy = true;
      while (q.next) {
        const job = q.next;
        q.next = null;
        try {
          if (job.op === 'put') await writePut(id, job.value);
          else await writeDel(id);
          job.waiters.forEach((w) => w.resolve());
        } catch (e) {
          job.waiters.forEach((w) => w.reject(e));
        }
      }
      q.busy = false;
      queues.delete(id);
      pending.delete(id);
    }

    async function writePut(id, v) {
      for (;;) {
        const m = mode;
        try {
          if (m === 'private') await withRetry(() => priv.put(id, v));
          else if (m === 'device') {
            const d = device();
            if (!d) { stepDown('device'); continue; }
            await d.put(id, v);
          } else await visit().put(id, v);
          return;
        } catch (e) {
          if (m === 'private') {
            const c = codeOf(e);
            if (c === 'quota_exceeded') throw plainError(MSG.full, 'full');
            if (FALLBACK_CODES.indexOf(c) < 0) throw plainError(MSG.retry, 'retry');
            if (DEAD_CODES.indexOf(c) >= 0) dbReadable = false;
            stepDown('private');          // and redo the write on this device
          } else if (m === 'device') {
            if (isQuota(e)) throw plainError(MSG.full, 'full');
            deviceDead();                 // and redo it for this visit
          } else {
            throw plainError(MSG.retry, 'retry');
          }
        }
      }
    }

    async function writeDel(id) {
      const m = mode;
      try {
        if (m === 'private') await withRetry(() => priv.del(id));
        else if (m === 'device') { if (device()) await device().del(id); }
        else await visit().del(id);
      } catch (e) {
        if (m === 'private') {
          const c = codeOf(e);
          if (FALLBACK_CODES.indexOf(c) < 0) throw plainError(MSG.retryRemove, 'retry');
          if (DEAD_CODES.indexOf(c) >= 0) dbReadable = false;
          stepDown('private');
        } else if (m === 'device') {
          deviceDead();
        }
      }
      // the copies below: images brought in before the db lit up, or written after a step down
      if (m === 'private' && device()) { try { await device().del(id); } catch (e) { /* best effort */ } }
      if (m !== 'visit') await visit().del(id);
    }

    // ---- reads
    async function readFrom(level, id) {
      const b = backend(level);
      if (!b || (level === 'private' && !dbReadable)) return null;
      try {
        return level === 'private' ? await withRetry(() => b.get(id)) : await b.get(id);
      } catch (e) {
        if (level === 'private') {
          if (FALLBACK_CODES.indexOf(codeOf(e)) >= 0) { dbReadable = false; stepDown('private'); }
        } else if (level === 'device') {
          deviceDead();
        }
        return null;
      }
    }
    function readOrder() {
      const order = LEVELS.slice(LEVELS.indexOf(mode));
      if (mode !== 'private' && priv && dbReadable) order.push('private');
      return order;
    }
    async function get(id) {
      if (!okId(id)) return null;
      if (pending.has(id)) { const v = pending.get(id); return v ? Object.assign({}, v) : null; }
      for (const level of readOrder()) {
        const v = await readFrom(level, id);
        if (v) return Object.assign({}, v);
      }
      return null;
    }

    const api = {
      get kind() { return mode; },
      ready,
      onKind(fn) {
        if (typeof fn !== 'function') return () => {};
        listeners.add(fn);
        return () => { listeners.delete(fn); };
      },

      /** put(id, {img, thumb, at}) -> Promise<void> */
      put(id, value) {
        if (!okId(id)) return Promise.reject(plainError(MSG.invalidId, 'invalid'));
        const v = clean(value);
        if (!v) return Promise.reject(plainError(MSG.noImage, 'invalid'));
        if (v.at === null) v.at = Math.floor(Date.now() / 1000);
        if (JSON.stringify(v).length > DOC_CAP) return Promise.reject(plainError(MSG.tooLargeDoc, 'too_large'));
        return enqueue(id, 'put', v);
      },

      /** get(id) -> Promise<{img, thumb, at} | null>; never rejects */
      get,

      /** thumb(id) -> Promise<string | null>, cached */
      async thumb(id) {
        if (!okId(id)) return null;
        if (pending.has(id)) { const v = pending.get(id); return (v && v.thumb) || null; }
        for (const level of readOrder()) {
          const b = backend(level);
          const t = b && b.peekThumb(id);
          if (t) return t;
        }
        const v = await get(id);
        return (v && v.thumb) || null;
      },

      /** remove(id) -> Promise<void> */
      remove(id) {
        if (!okId(id)) return Promise.resolve();
        return enqueue(id, 'del', null);
      },

      /** migrateFrom(otherStore, ids) -> Promise<number> */
      async migrateFrom(other, ids) {
        if (!other || other === api || typeof other.get !== 'function') return 0;
        const list = Array.from(new Set(Array.isArray(ids) ? ids : [])).filter(okId);
        let copied = 0;
        for (const id of list) {
          if (other.kind === mode && mode !== 'visit') break;   // the same backing: nothing to copy
          if (await readFrom(mode, id)) continue;               // already here
          let v = null;
          try { v = clean(await other.get(id)); } catch (e) { v = null; }
          if (!v) continue;
          try { await api.put(id, v); }
          catch (e) { e.copied = copied; throw e; }
          copied++;
        }
        return copied;
      },
    };
    return Object.freeze(api);
  }

  // ------------------------------------------------------------------ export

  const FiveSBring = Object.freeze({
    process,
    newId,
    store,
    _internals: Object.freeze({ dominantColours, findSurface, edgeDensity, textureScale, mulberry32, MSG }),
  });
  root.FiveSBring = FiveSBring;
  if (typeof module === 'object' && module && module.exports) module.exports = FiveSBring;
})(typeof window !== 'undefined' ? window : globalThis);

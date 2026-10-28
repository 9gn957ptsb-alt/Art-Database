/* 5s room: See it as a room, with a kept interior's own photograph as the room (SPEC-room-from-structure §4, §7.2).
 *
 * The person's other kept things are placed in the photograph by what they are: the picture hung on its wall in
 * the wall's perspective, the view through its glass (or hung beside it), the colour painted on its plaster
 * (multiplied, so the photograph's own light stays) or as its light, a Surface laid as its floor when they choose
 * it, and the object standing, set, laid or lighting it at its marked spot.
 *
 * A marked room (card.room, from the deck build) gives planes as quads in percent of the photo with their real
 * size in cm. One CSS matrix3d per plane (Heckbert's square-to-quad homography) puts anything placed inside it in
 * cm into the photo's perspective. An unmarked room, or a photo of the person's own room, gets a guessed box.
 *
 * Pure (Node): sq2quad, apply, inv, m3d, planeOf, boxFromGuess, howIn, words.
 * Canvas: likeMask, softShade, cutOut, guessFloor. DOM: mount, release.
 * Browser: window.FiveSRoom (load before app.js). Node: module.exports.
 */
(function (root) {
  'use strict';

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const num = (x, d) => (typeof x === 'number' && isFinite(x) ? x : d);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------- perspective (pure)

  /** sq2quad(q) -> H: the homography taking the unit square (0,0) (1,0) (1,1) (0,1) onto the quad q's corners. */
  function sq2quad(q) {
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    let g = 0, h = 0;
    if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
      const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, den = dx1 * dy2 - dx2 * dy1;
      g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
    }
    return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
  }
  /** apply(H, u, v) -> [x, y]. */
  const apply = (H, u, v) => { const [a, b, c, d, e, f, g, h] = H, w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
  /** inv(H) -> (x, y) => [u, v]. */
  function inv(H) {
    const [a, b, c, d, e, f, g, h] = H;
    const A = e - f * h, B = -(d - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    const m = [A, -(b - c * h), b * f - c * e, B, a - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
    return (x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
  }
  /** m3d(H, W, Hh) -> the CSS matrix3d putting a W x Hh box (top left at 0 0) onto H's quad. */
  const m3d = (H, W, Hh) => { const [a, b, c, d, e, f, g, h] = H; return 'matrix3d(' + [a / W, d / W, 0, g / W, b / Hh, e / Hh, 0, h / Hh, 0, 0, 1, 0, c, f, 0, 1].join(',') + ')'; };

  /** planeOf(room, id, w, h) -> {W, Hh, H, toPx(xCm, yCm), toCm(px, py), scale(xCm, yCm)}, or null: a marked plane in a
   *  w x h px photo. scale is the px per cm across the view at a point (the plane's direction that stays level in the
   *  picture, from the homography's Jacobian): it sizes what stands upright there. */
  function planeOf(R, id, w, h) {
    const P = R && R.planes && R.planes[id];
    if (!P) return null;
    const H = sq2quad(P.q.map(([x, y]) => [x / 100 * w, y / 100 * h])), I = inv(H), [W, Hh] = P.size;
    const toPx = (x, y) => apply(H, x / W, y / Hh);
    const toCm = (px, py) => { const [u, v] = I(px, py); return [u * W, v * Hh]; };
    const scale = (x, y) => {
      const p = toPx(x, y), px = toPx(x + 1, y), py = toPx(x, y + 1);
      const J = [[px[0] - p[0], py[0] - p[0]], [px[1] - p[1], py[1] - p[1]]], d = [J[1][1], -J[1][0]], n = Math.hypot(d[0], d[1]) || 1;
      return Math.abs((J[0][0] * d[0] + J[0][1] * d[1]) / n);
    };
    return { W, Hh, H, toPx, toCm, scale };
  }

  /** boxFromGuess({vp, floor}, w, h) -> a room in the marked shape (planes w1 and f, spots, the floor's outline,
   *  paint null, sun, guess: true) from where the room points and where its floor meets the far wall (percent).
   *  A level camera: its focal length 0.75 of the width, held at 140 cm, the far wall 270 cm tall. */
  function boxFromGuess(g, w, h) {
    const vx = clamp(num(g && g.vp && g.vp[0], 50), 0, 100) / 100 * w;
    const vy = clamp(num(g && g.vp && g.vp[1], 45), 15, 75) / 100 * h;
    const fy = clamp(num(g && g.floor, 63) / 100 * h, vy + 0.08 * h, 0.96 * h);
    const f = 0.75 * w, cam = 140, wallH = 270;
    const zn = f * cam / (h - vy), zf = f * cam / (fy - vy), D = zf - zn, W = w * zn / f;
    const t = (h - fy) / (h - vy), xl = vx * t, xr = w + (vx - w) * t;   // the lines from the bottom corners to vp, at the floor line
    const yt = fy - wallH * f / zf;
    const P = (x, y) => [x / w * 100, y / h * 100];
    const R = {
      inside: true, guess: true,
      planes: { w1: { q: [P(xl, yt), P(xr, yt), P(xr, fy), P(xl, fy)], size: [W, wallH] },
        f: { q: [P(xl, fy), P(xr, fy), P(w, h), P(0, h)], size: [W, D] } },
      paint: null,
      floor: { outline: [P(xl, fy), P(xr, fy), P(w, h), P(0, h)], band: (fy / h + 1) / 2 },
    };
    const Fp = planeOf(R, 'f', w, h), Wp = planeOf(R, 'w1', w, h);
    const on = (pl, x, y) => P(...pl.toPx(x, y)).map((v) => clamp(v, 0, 100));
    const zAt = (v) => zf - D * v;   // depth of the floor at plane y = v * D
    R.sun = on(Wp, W / 2, 0);
    R.spots = {
      hang: { plane: 'w1', at: on(Wp, W / 2, wallH - 150), name: 'on the far wall' },
      hang2: { plane: 'w1', at: on(Wp, W * 0.82, wallH - 150), name: 'beside it' },
      stand: { plane: 'f', at: on(Fp, W * 0.72, D * 0.7), name: 'on the right' },
      lay: { plane: 'f', at: on(Fp, W * 0.45, D * 0.55), name: 'on the floor' },
      light: { plane: 'f', at: on(Fp, W / 2, D * 0.45), top: clamp((vy - (wallH - cam) * f / zAt(0.45)) / h * 100, 0, 100), name: 'from the ceiling' },
      paint: { at: on(Wp, W * 0.2, wallH * 0.3) },
      floor: { at: on(Fp, W * 0.25, D * 0.8) },
    };
    return R;
  }

  // A marking the page can draw: its floor and a picture's wall. Anything less is drawn from the guess.
  const usable = (m) => !!(m && m.planes && m.planes.f && m.spots && m.spots.hang && m.planes[m.spots.hang.plane]);
  const roomOf = (m, w, h) => (usable(m) ? m : m && Array.isArray(m.vp) ? boxFromGuess(m, w, h) : null);
  const GUESS = boxFromGuess(null, 400, 300);   // the guess's words, which are the same for every guessed room

  // ---------------------------------------------------------------- what goes where, and the words for it (pure)

  const HOWS = ['lay', 'light', 'set', 'stand'];
  const has = (t, r) => !!(t && Array.isArray(t.roles) && t.roles.indexOf(r) >= 0);
  /** howIn(key, thing) -> how a thing goes in that place, said by the place it is in: a two-role card in the object
   *  place goes by its other role ('paint' 'lay' 'hang' 'see' 'light' 'set' 'stand'). */
  function howIn(key, t) {
    if (key === 'wall') return 'paint';
    if (key === 'floor') return 'lay';
    if (key === 'picture') return 'hang';
    if (key === 'window') return 'see';
    if (t && HOWS.indexOf(t.how) >= 0) return t.how;
    return has(t, 'light') || has(t, 'ceiling') ? 'light' : has(t, 'floor') ? 'lay' : 'stand';
  }
  // Its size in cm, as the deck has none: whatIs's own when it goes as whatIs says, else by how it goes here.
  const sizeOf = (how, t, ar) => (t && t.how === how && t.cm > 0 ? t.cm
    : how === 'lay' ? 200 : how === 'light' ? 112 : how === 'set' ? 40 : how === 'hang' ? 100 : ar > 1 ? 90 : 120);
  // The object's spot: a hanging lamp hangs from the light spot; a rug lies at lay; a vase is set on the marked top.
  function spotFor(R, how, t) {
    const S = R.spots;
    if (how === 'lay') return S.lay || S.stand;
    if (how === 'light' && has(t, 'ceiling') && S.light) return S.light;
    if (how === 'set' && S.set) return S.set;
    return S.stand || S.lay || NOWHERE;
  }
  const NOWHERE = { plane: 'f', at: [50, 88], name: 'in the room' };   // a marking that lost its floor spots
  // Where the view hangs in a room with no window: its marked hang2, else beside the picture on the same wall.
  function besideSpot(R) {
    const S = R.spots, P = S.hang2 || !S.hang ? null : planeOf(R, S.hang.plane, 100, 100);
    if (!P) return S.hang2 || null;
    const [cx, cy] = P.toCm(...S.hang.at), off = (S.hang.box ? S.hang.box[0] / 2 : 50) + 60;
    const at = P.toPx(cx + off + 30 <= P.W ? cx + off : cx - off, cy).map((v) => clamp(v, 0, 100));
    return { plane: S.hang.plane, at, name: 'beside it' };
  }
  const asOf = (R, as) => ({
    wall: as && ['paint', 'light', 'own'].indexOf(as.wall) >= 0 ? as.wall : R.paint ? 'paint' : 'light',
    floor: as && ['own', 'laid', 'wall'].indexOf(as.floor) >= 0 ? as.floor : 'own',
  });
  // A Surface On a wall goes on the painted plaster of one wall, the picture's (or the first wall with paint on it); a wall
  // carries one finish, so the paint stays on the other painted walls, or becomes the light when there are none (photo.md §4).
  function wallSplit(R) {
    const polys = R.paint ? R.paint.polys : [], first = R.spots && R.spots.hang ? R.spots.hang.plane : 'w1';
    const ids = [first].concat(Object.keys(R.planes || {}).filter((k) => k !== 'f' && k !== first));
    for (const id of ids) {
      const P = planeOf(R, id, 100, 100);
      if (!P) continue;
      const on = polys.filter((p) => {
        const [u, v] = P.toCm(p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length);
        return u >= -0.05 * P.W && u <= 1.05 * P.W && v >= -0.05 * P.Hh && v <= 1.05 * P.Hh;
      });
      if (on.length) return { plane: id, on, rest: polys.filter((p) => on.indexOf(p) < 0) };
    }
    return { plane: first, on: polys, rest: [] };
  }
  // How the walls show: painted where plaster is marked (on the other walls when a surface is laid on one); else the colour is its light.
  const wallMode = (R, a) => (a.wall === 'own' ? 'own' : a.wall === 'paint' && R.paint && (a.floor !== 'wall' || wallSplit(R).rest.length) ? 'paint' : 'light');
  const floorMode = (R, a) => (a.floor === 'laid' ? 'laid' : a.floor === 'wall' && R.paint ? 'wall' : 'own');

  /** words(marks, key, thing, as) -> {rel, line}: the relation in plain words, from the room's own names ("hung over
   *  the fireplace"), and the key row's line ("A print, hung over the fireplace"; null for an empty picture, window or
   *  object). marks is card.room as mount takes it; an unmarked or brought room says the guess's words. */
  function words(marks, key, t, as) {
    const R = usable(marks) ? marks : GUESS, S = R.spots, a = asOf(R, as);
    const what = t && typeof t.what === 'string' && t.what ? t.what : '';
    const line = (rel) => ({ rel, line: t && what ? cap(what) + ', ' + rel : null });
    const own = (x, of) => 'Its own' + (x ? ': ' + x : ' ' + of);
    if (key === 'picture') return line('hung ' + S.hang.name);
    if (key === 'window') return line(R.opening ? 'seen ' + R.opening.name : 'hung ' + (besideSpot(R) || { name: 'beside it' }).name);
    if (key === 'object') {
      const how = howIn(key, t), sp = spotFor(R, how, t);
      return line(how === 'lay' ? 'laid ' + sp.name : how === 'light' ? 'lighting the room, ' + sp.name
        : how === 'set' && sp === S.set ? 'set ' + sp.name : 'standing ' + sp.name);
    }
    const split = R.paint && a.floor === 'wall' && wallSplit(R).rest.length > 0;   // a surface on the picture's wall, the paint on the others
    if (key === 'wall') {
      const walls = own(R.walls, 'walls'), m = t ? wallMode(R, a) : 'own';
      const first = what.split(/,\s*|\s+and\s+/)[0] || 'colour', on = split ? 'the other walls' : m === 'paint' ? R.paint.name : '';
      return m === 'paint' ? { rel: 'painted on ' + on, line: cap(first) + ', painted on ' + on }
        : m === 'light' ? { rel: 'its light', line: walls + '. Your ' + first + ' is its light' } : { rel: 'its own', line: walls };
    }
    if (key === 'floor') {
      const m = t ? floorMode(R, a) : 'own';
      return m === 'laid' ? line('laid as its floor') : m === 'wall' ? line('laid on ' + (split ? 'the picture’s wall' : R.paint.name))
        : { rel: 'its own', line: own(R.floor && R.floor.what, 'floor') };
    }
    return { rel: '', line: null };
  }

  // ---------------------------------------------------------------- measured on the device (canvas)

  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function pixels(img, w, h) { const c = cnv(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; }
  function polyAlpha(polys, w, h) {
    const c = cnv(w, h), x = c.getContext('2d');
    x.fillStyle = '#000';
    for (const p of polys) { x.beginPath(); p.forEach(([u, v], k) => (k ? x.lineTo : x.moveTo).call(x, u / 100 * w, v / 100 * h)); x.closePath(); x.fill(); }
    return x.getImageData(0, 0, w, h).data;
  }
  const histMed = (hist, n) => { let c = 0; for (let v = 0; v < hist.length; v++) { c += hist[v]; if (c > n >> 1) return v; } return 0; };
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const MASK_MAX = 720;   // masks are measured on at most 720 px; the box stretches them to the photo

  /** likeMask(img, polys, band) -> a canvas: inside the polygons (percent), where the photo is still the wall (or the
   *  floor), close in colour to the area's own median, so what stands in front stays as photographed. Its alpha is that
   *  likeness, its grey the photo's light there. band: the median is taken below band of the height. Throws when the
   *  image cannot be read (another origin). */
  function likeMask(img, polys, band) {
    const k = Math.min(1, MASK_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k), N = w * h, px = pixels(img, w, h), inside = polyAlpha(polys, w, h);
    const hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256);   // medians from histograms: no sorting
    let n = 0;
    for (let i = band ? Math.ceil(band * h * w) : 0; i < N; i++) if (inside[i * 4 + 3] > 128) { hr[px[i * 4]]++; hg[px[i * 4 + 1]]++; hb[px[i * 4 + 2]]++; n++; }
    const ref = [histMed(hr, n), histMed(hg, n), histMed(hb, n)];
    const d2 = (i) => { const r = px[i * 4] - ref[0], g = px[i * 4 + 1] - ref[1], b = px[i * 4 + 2] - ref[2]; return r * r + g * g + b * b; };
    const hd = new Uint32Array(443);
    let m = 0;
    for (let i = 0; i < N; i += 7) if (inside[i * 4 + 3] > 128) { hd[Math.round(Math.sqrt(d2(i)))]++; m++; }
    const t0 = Math.min(90, histMed(hd, m) * 2.2 + 14), t1 = t0 + 26, q0 = t0 * t0, q1 = t1 * t1;
    const c = cnv(w, h), x = c.getContext('2d'), out = x.createImageData(w, h), o = out.data, refL = Math.max(1, lum(...ref));
    for (let i = 0; i < N; i++) {
      if (inside[i * 4 + 3] < 8) continue;
      const q = d2(i), a = q <= q0 ? 1 : q >= q1 ? 0 : (t1 - Math.sqrt(q)) / (t1 - t0);
      o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = Math.min(255, 255 * lum(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) / refL);
      o[i * 4 + 3] = a * inside[i * 4 + 3];
    }
    x.putImageData(out, 0, 0);
    return c;
  }
  /** softShade(mask) -> a canvas: the mask's light, blurred by a tenfold down-and-up scale so the old floor's grain
   *  does not print through a new one (ctx.filter is not used: older Safari lacks it). */
  function softShade(m) {
    const w = m.width, h = m.height, s = cnv(Math.ceil(w / 10), Math.ceil(h / 10));
    s.getContext('2d').drawImage(m, 0, 0, s.width, s.height);
    const o = cnv(w, h), ox = o.getContext('2d');
    ox.imageSmoothingQuality = 'high'; ox.drawImage(s, 0, 0, w, h);
    ox.globalCompositeOperation = 'destination-in'; ox.drawImage(m, 0, 0);
    return o;
  }
  /** cutOut(img) -> a canvas of the thing cut from its studio ground (a flood from the border while neighbours stay
   *  alike, on at most 420 px), or null when under 8 % or over 96 % of the picture remains: then it stands whole. Its
   *  fill is the share of its own box the thing fills (near 1 for a rug shot from above, about 0.5 for one shot at an
   *  angle); whole is true when that box spans the picture, as when a rug fills its photo and only its pattern was cut. */
  function cutOut(img) {
    const k = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = cnv(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h), p = d.data, seen = new Uint8Array(w * h), q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    const push = (i) => { if (!seen[i]) { seen[i] = 1; q[qt++] = i; } };
    for (let i = 0; i < w; i++) { push(i); push((h - 1) * w + i); }
    for (let j = 0; j < h; j++) { push(j * w); push(j * w + w - 1); }
    const alike = (n, i) => { if (!seen[n] && Math.abs(p[n * 4] - p[i * 4]) + Math.abs(p[n * 4 + 1] - p[i * 4 + 1]) + Math.abs(p[n * 4 + 2] - p[i * 4 + 2]) <= 11) push(n); };
    while (qh < qt) {
      const i = q[qh++], X = i % w;
      if (X > 0) alike(i - 1, i);
      if (X < w - 1) alike(i + 1, i);
      if (i >= w) alike(i - w, i);
      if (i < (h - 1) * w) alike(i + w, i);
    }
    let x0 = w, y0 = h, x1 = 0, y1 = 0, kept = 0;
    for (let i = 0; i < w * h; i++) {
      if (seen[i]) { p[i * 4 + 3] = 0; continue; }
      kept++;
      const X = i % w, Y = (i / w) | 0;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    const share = kept / (w * h);
    if (share < 0.08 || share > 0.96) return null;
    x.putImageData(d, 0, 0);
    const o = cnv(x1 - x0 + 1, y1 - y0 + 1);
    o.getContext('2d').drawImage(c, -x0, -y0);
    o.fill = kept / (o.width * o.height);
    o.whole = o.width >= 0.95 * w && o.height >= 0.95 * h;
    return o;
  }

  /** guessFloor(img) -> {vp: [x, y], floor: y} (percent, as F.bring stores own.room): where the room points and where
   *  its floor meets the far wall. On a 320 px copy: straight edges as runs of pixels whose edge points the same way;
   *  every pair of runs that is neither level nor upright proposes a point in the middle band (a phone held level) and
   *  every run votes with its length; the floor line is the longest level run below that point. Weak on two-point
   *  corner shots, which is why a person checks their own room and the deck's rooms are marked by eye. Throws when the
   *  image cannot be read. */
  function guessFloor(img) {
    const k = 320 / Math.max(img.naturalWidth, img.naturalHeight), w = Math.max(3, Math.round(img.naturalWidth * k)), h = Math.max(3, Math.round(img.naturalHeight * k));
    const p = pixels(img, w, h), g = new Float32Array(w * h), mag = new Float32Array(w * h), bin = new Int8Array(w * h).fill(-1);
    for (let i = 0; i < w * h; i++) g[i] = lum(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]);
    const ms = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
      mag[i] = Math.hypot(gx, gy); ms.push(mag[i]);
      bin[i] = Math.floor((((Math.atan2(gy, gx) * 180 / Math.PI) + 360) % 180) / 11.25);   // 16 directions
    }
    const T = Math.max(40, Float64Array.from(ms).sort()[Math.floor(ms.length * 0.85)] || 0);
    const seen = new Uint8Array(w * h), segs = [], diag = Math.hypot(w, h);
    for (let s = 0; s < w * h; s++) {
      if (seen[s] || mag[s] < T) continue;
      const st = [s], pts = []; seen[s] = 1;
      while (st.length) {
        const i = st.pop(); pts.push(i);
        const X = i % w, Y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const n = (Y + dy) * w + X + dx;
          if (X + dx < 0 || X + dx >= w || Y + dy < 0 || Y + dy >= h || seen[n] || mag[n] < T) continue;
          const db = Math.abs(bin[n] - bin[s]); if (Math.min(db, 16 - db) > 1) continue;
          seen[n] = 1; st.push(n);
        }
      }
      if (pts.length < 12) continue;
      let mx = 0, my = 0; for (const i of pts) { mx += i % w; my += (i / w) | 0; } mx /= pts.length; my /= pts.length;
      let sxx = 0, syy = 0, sxy = 0; for (const i of pts) { const dx = i % w - mx, dy = ((i / w) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      const a = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(a), uy = Math.sin(a);
      let lo = 1e9, hi = -1e9, tl = 1e9, th = -1e9;
      for (const i of pts) { const dx = i % w - mx, dy = ((i / w) | 0) - my, t = dx * ux + dy * uy, n = -dx * uy + dy * ux; lo = Math.min(lo, t); hi = Math.max(hi, t); tl = Math.min(tl, n); th = Math.max(th, n); }
      const len = hi - lo;
      if (len < 0.06 * diag || len < 5 * (th - tl + 1)) continue;
      segs.push({ mx, my, ux, uy, len, deg: Math.abs(Math.atan2(uy, ux) * 180 / Math.PI) % 180 });
    }
    const level = segs.filter((s) => Math.min(s.deg, 180 - s.deg) < 4);
    const into = segs.filter((s) => Math.min(s.deg, 180 - s.deg) >= 4 && Math.abs(90 - s.deg) >= 8).sort((a, b) => b.len - a.len).slice(0, 40);
    let best = null;
    for (let i = 0; i < into.length; i++) for (let j = i + 1; j < into.length; j++) {
      const A = into[i], B = into[j], det = A.ux * B.uy - A.uy * B.ux;
      if (Math.abs(det) < 0.05) continue;
      const t = ((B.mx - A.mx) * B.uy - (B.my - A.my) * B.ux) / det, X = A.mx + t * A.ux, Y = A.my + t * A.uy;
      if (X < -0.25 * w || X > 1.25 * w || Y < 0.2 * h || Y > 0.68 * h) continue;
      let score = 0;
      for (const S of into) { const vx = X - S.mx, vy = Y - S.my, d = Math.hypot(vx, vy) || 1; if (Math.abs(vx * S.uy - vy * S.ux) / d < Math.sin(2 * Math.PI / 180)) score += S.len; }
      if (!best || score > best[0]) best = [score, X, Y];
    }
    const vp = best ? [clamp(best[1] / w * 100, 0, 100), best[2] / h * 100] : [50, 45];
    const below = level.filter((s) => s.my > (vp[1] / 100 + 0.06) * h && s.my < 0.95 * h).sort((a, b) => b.len - a.len);
    const floor = below.length ? below[0].my / h * 100 : Math.min(90, vp[1] + 18);
    const r1 = (x) => Math.round(x * 10) / 10;
    return { vp: vp.map(r1), floor: r1(floor) };
  }

  // ---------------------------------------------------------------- caches for the visit (never stored)

  const images = new Map(), masks = new Map(), cuts = new Map(), guesses = new Map(), urls = new Set();
  const keyOf = (src) => (src.length > 200 ? src.slice(0, 64) + src.length + src.slice(-64) : src);   // a brought picture can be a long data URL
  function load(src) {
    const key = keyOf(String(src));
    if (!images.has(key)) {
      images.set(key, new Promise((ok, no) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => { images.delete(key); no(new Error('no image')); };
        i.src = src;
      }));
    }
    return images.get(key);
  }
  const toUrl = (c) => new Promise((ok) => {
    const done = (b) => { if (!b) { ok(c.toDataURL()); return; } const u = URL.createObjectURL(b); urls.add(u); ok(u); };
    if (c.toBlob) c.toBlob(done); else done(null);
  });
  // A mask and its light, as blob URLs for CSS; null when the photo cannot be read (then the outline clips instead).
  function maskFor(src, img, polys, band) {
    const key = keyOf(src) + '|' + JSON.stringify(polys) + '|' + (band || 0);
    if (!masks.has(key)) {
      masks.set(key, (async () => {
        try { const m = likeMask(img, polys, band); return { mask: await toUrl(m), shade: await toUrl(softShade(m)) }; } catch (e) { return null; }
      })());
    }
    return masks.get(key);
  }
  function cutFor(src, img) {
    const key = keyOf(src);
    if (!cuts.has(key)) cuts.set(key, (async () => { try { const c = cutOut(img); return c ? { url: await toUrl(c), ar: c.width / c.height, fill: c.fill, whole: c.whole } : null; } catch (e) { return null; } })());
    return cuts.get(key);
  }
  // An unmarked room's guess, once a visit (release keeps it).
  function guessFor(id, img) {
    if (!guesses.has(id)) { let g; try { g = guessFloor(img); } catch (e) { g = { vp: [50, 45], floor: 63 }; } guesses.set(id, g); }
    return guesses.get(id);
  }
  /** brightest(img) -> [x, y]: the brightest blurred region of the photo (percent), where a guessed room's daylight
   *  comes from (photo.md §4). Blurred by drawing it small twice. Throws when the image cannot be read. */
  function brightest(img) {
    const a = cnv(48, Math.max(1, Math.round(48 * img.naturalHeight / img.naturalWidth)));
    a.getContext('2d').drawImage(img, 0, 0, a.width, a.height);
    const b = cnv(12, Math.max(1, Math.round(a.height / 4))), x = b.getContext('2d', { willReadFrequently: true });
    x.drawImage(a, 0, 0, b.width, b.height);
    const d = x.getImageData(0, 0, b.width, b.height).data;
    let best = -1, at = 0;
    for (let i = 0; i < b.width * b.height; i++) { const l = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); if (l > best) { best = l; at = i; } }
    return [((at % b.width) + 0.5) / b.width * 100, (((at / b.width) | 0) + 0.5) / b.height * 100].map((v) => Math.round(v * 10) / 10);
  }
  /** release(): revoke every mask and cut-out URL and drop the images, when Set closes. Guesses stay for the visit. */
  function release() {
    for (const u of urls) URL.revokeObjectURL(u);
    urls.clear(); masks.clear(); cuts.clear(); images.clear();
  }
  let gl = null;   // can this phone make a WebGL context (Step in)? Asked once, and the context let go.
  function webgl() {
    if (gl === null) {
      try {
        const x = document.createElement('canvas').getContext('webgl');
        gl = !!x;
        const lose = x && x.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (e) { gl = false; }
    }
    return gl;
  }

  // ---------------------------------------------------------------- the room in the page

  const KEYS = ['floor', 'wall', 'window', 'picture', 'object'];   // drawn in this order: later ones lie over earlier ones
  const HIT_ORDER = ['wall', 'floor', 'window', 'picture', 'object'];   // the object's button lies on top
  const HEX = /^#[0-9a-f]{6}$/i;
  const rgba = (hex, a) => 'rgba(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',') + ',' + a + ')';
  const polyCss = (p) => 'polygon(' + p.map(([x, y]) => x + '% ' + y + '%').join(',') + ')';
  function add(el, tag, cls, css) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (css) Object.assign(n.style, css);
    el.appendChild(n);
    return n;
  }
  function maskTo(d, url) {
    const v = 'url("' + url + '")';
    d.style.setProperty('-webkit-mask-image', v); d.style.setProperty('mask-image', v);
    d.style.setProperty('-webkit-mask-size', '100% 100%'); d.style.setProperty('mask-size', '100% 100%');
    d.style.setProperty('-webkit-mask-repeat', 'no-repeat'); d.style.setProperty('mask-repeat', 'no-repeat');
  }

  /** mount(el, {id, src, w, h, marks, things, as, interactive, name, label, onPick, onFail, stepIn}) -> handle
   *  ({ready, room, update(key, thing), destroy()}): draws the room's photo in el (a div.proom) with the five things in
   *  it. See room-api.md. */
  function mount(el, o) {
    o = o || {};
    const live = o.interactive !== false;
    const things = Object.assign({}, o.things);
    const wraps = {}, hits = {}, seq = {};
    let as = o.as || {}, R = null, w = o.w || 0, h = o.h || 0, ro = null, gone = false, stage = null;
    const planes = new Map();
    const plane = (id) => { if (!planes.has(id)) planes.set(id, planeOf(R, id, w, h)); return planes.get(id); };
    const pt = (at) => [at[0] / 100 * w, at[1] / 100 * h];

    el.textContent = '';
    el.classList.add('proom');
    delete el.dataset.ready;
    if (!live) el.setAttribute('aria-hidden', 'true');
    if (w && h) el.style.aspectRatio = w + ' / ' + h;

    // A plane's div, sized in its own cm (k cm a px for a big one, so its layer stays small), on its quad.
    function planeDiv(P, parent, cls) {
      const k = Math.max(1, Math.max(P.W, P.Hh) / 1600);
      const d = add(parent, 'div', 'plane' + (cls ? ' ' + cls : ''), { width: P.W / k + 'px', height: P.Hh / k + 'px' });
      d.style.transform = m3d(P.H, P.W / k, P.Hh / k);
      return { d, k };
    }
    // The box a set of plane points covers, in stage px.
    const boxOf = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const around = (at) => { const [x, y] = pt(at); return [x, y, x, y]; };

    // One pointer button over where a thing is drawn: untransformed, at least 44 x 44, for pointers only (the key rows
    // below are the accessible way to every place).
    function hit(key, box) {
      if (!live) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'rhit'; b.dataset.key = key; b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
      if (box) {
        const x0 = clamp(box[0], 0, w), y0 = clamp(box[1], 0, h), x1 = clamp(box[2], 0, w), y1 = clamp(box[3], 0, h);
        Object.assign(b.style, { left: (x0 + x1) / 2 / w * 100 + '%', top: (y0 + y1) / 2 / h * 100 + '%',
          width: 'max(44px, ' + (x1 - x0) / w * 100 + '%)', height: 'max(44px, ' + (y1 - y0) / h * 100 + '%)' });
      } else b.hidden = true;
      b.addEventListener('click', () => { if (o.onPick) o.onPick(key); });
      const old = hits[key];
      if (old && old.parentNode) old.replaceWith(b);
      else {
        const next = HIT_ORDER.slice(HIT_ORDER.indexOf(key) + 1).map((k) => hits[k]).find((n) => n && n.parentNode);
        el.insertBefore(b, next || null);
      }
      hits[key] = b;
    }

    // Hung on a wall: a child of the wall's plane, so the perspective comes free. Returns the box it covers.
    function hang(wrap, t, img, sp, frame, cm) {
      const P = sp && plane(sp.plane);
      if (!P) return null;
      const [cx, cy] = P.toCm(...pt(sp.at)), ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      let fw = ar >= 1 ? cm : cm * ar, fh = ar >= 1 ? cm / ar : cm;
      if (sp.box) { const s = Math.min(sp.box[0] / fw, sp.box[1] / fh); fw *= s; fh *= s; }   // it takes the place of the photo's own picture
      const { d, k } = planeDiv(P, wrap);
      const fr = add(d, 'div', 'hung ' + frame, { left: (cx - fw / 2) / k + 'px', top: (cy - fh / 2) / k + 'px', width: fw / k + 'px', height: fh / k + 'px' });
      if (frame !== 'bare') fr.style.borderWidth = (frame === 'photo' ? 0 : Math.max(1.5, Math.min(fw, fh) * 0.03)) / k + 'px';
      const im = add(fr, 'img'); im.src = t.src; im.alt = '';
      return boxOf([[cx - fw / 2, cy - fh / 2], [cx + fw / 2, cy - fh / 2], [cx + fw / 2, cy + fh / 2], [cx - fw / 2, cy + fh / 2]].map(([x, y]) => P.toPx(x, y)));
    }

    // What each place needs before it is drawn: its picture, a mask, a cut-out (all cached for the visit).
    async function prep(key) {
      const t = things[key];
      const img = t && t.src ? await load(t.src).catch(() => null) : null;
      const a = asOf(R, as), S = R.spots;
      if (key === 'wall') {
        const m = wallMode(R, a), polys = m !== 'paint' ? null : a.floor === 'wall' ? wallSplit(R).rest : R.paint.polys;
        return { t, m, polys, mask: polys && t ? await maskFor(o.src, photo, polys) : null };
      }
      if (key === 'floor') {
        const m = t && img ? floorMode(R, a) : 'own', split = m === 'wall' ? wallSplit(R) : null;
        const polys = m === 'laid' ? (R.floor && R.floor.outline ? [R.floor.outline] : null) : split ? split.on : null;
        return { t, img, m: polys ? m : 'own', polys, on: split ? split.plane : 'f', mask: polys ? await maskFor(o.src, photo, polys, m === 'laid' ? R.floor.band : 0) : null };
      }
      if (key === 'object') {
        const how = howIn(key, t);
        return { t, img, how, sp: spotFor(R, how, t), cut: img ? await cutFor(t.src, img) : null };
      }
      return { t, img, S };
    }

    function draw(key, p, fade) {
      const wrap = wraps[key], t = p.t, S = R.spots;
      wrap.textContent = '';
      let box = null;
      if (key === 'wall') {
        const c = (t && t.colours ? t.colours : []).filter((x) => HEX.test(x));
        if (c.length && p.m === 'paint') {
          if (p.mask) maskTo(add(wrap, 'div', 'paint', { background: c[0] }), p.mask.mask);
          else for (const poly of p.polys) add(wrap, 'div', 'paint', { background: c[0], clipPath: polyCss(poly), webkitClipPath: polyCss(poly) });
        } else if (c.length && p.m === 'light') {
          const s = R.sun || [50, 10];
          add(wrap, 'div', 'lightwash').style.background = 'radial-gradient(120% 110% at ' + s[0] + '% ' + s[1] + '%, ' +
            rgba(c[0], 0.8) + ', ' + rgba(c[2] || c[1] || c[0], 0.33) + ' 55%, transparent 85%)';
        }
        box = S.paint ? around(S.paint.at) : null;
      } else if (key === 'floor') {
        if (p.m !== 'own') {
          const P = plane(p.on);
          for (const poly of p.mask ? [null] : p.polys) {   // the mask covers every polygon; when the photo cannot be read, one clip each
            const laid = add(wrap, 'div', 'laid');
            if (poly) { laid.style.clipPath = polyCss(poly); laid.style.webkitClipPath = polyCss(poly); } else maskTo(laid, p.mask.mask);
            const { d, k } = planeDiv(P, laid, 'tiles');
            d.style.backgroundImage = 'url("' + t.src + '")';
            d.style.backgroundSize = 75 / k + 'px ' + 75 / k + 'px';   // tiled at 75 cm
          }
          if (p.mask) { const sh = add(wrap, 'img', 'shade'); sh.src = p.mask.shade; sh.alt = ''; }
        }
        box = S.floor ? around(S.floor.at) : null;
      } else if (key === 'window') {
        if (R.opening) {
          const all = [].concat(...R.opening.polys);
          const b = all.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [100, 100, 0, 0]);
          if (p.img) {
            for (const poly of R.opening.polys) {   // one scene behind all its panes
              const v = add(wrap, 'div', 'viewclip', { clipPath: polyCss(poly), webkitClipPath: polyCss(poly) });
              const vi = add(v, 'img', '', { left: b[0] + '%', top: b[1] + '%', width: (b[2] - b[0]) + '%', height: (b[3] - b[1]) + '%' });
              vi.src = t.src; vi.alt = '';
              add(v, 'div', 'glass');
            }
          }
          box = [b[0] / 100 * w, b[1] / 100 * h, b[2] / 100 * w, b[3] / 100 * h];
        } else {
          const sp = besideSpot(R);   // no window here: it hangs beside the picture
          if (sp) box = (p.img && hang(wrap, t, p.img, sp, 'photo', 60)) || around(sp.at);
        }
      } else if (key === 'picture') {
        const frame = has(t, 'textile') ? 'bare' : t && /photograph/.test(t.what || '') ? 'photo' : 'framed';
        box = (p.img && hang(wrap, t, p.img, S.hang, frame, sizeOf('hang', t))) || around(S.hang.at);
      } else if (key === 'object') {
        box = p.sp ? around(p.sp.at) : null;
        const F = plane('f');
        if (p.img && p.sp && F) box = placeObject(wrap, p, F) || box;
      }
      if (fade) for (const n of wrap.children) n.classList.add('rfade');
      hit(key, box);
    }

    // The thing in it, by what it is: laid flat, lighting it from above, set on a top, or standing on the floor.
    function placeObject(wrap, p, F) {
      const { t, img, how, sp } = p, S = R.spots;
      const cut = how === 'lay' && p.cut && p.cut.whole ? null : p.cut;   // a rug that fills its photo is all rug: the whole photo lies
      const [fx, fy] = F.toCm(...pt(sp.at)), ar = cut ? cut.ar : (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const cm = sizeOf(how, t, ar);
      if (how === 'lay' && cut && cut.fill < 0.7) {   // a rug shot at an angle is already in perspective: its cut-out lies centred on the spot
        const s = F.scale(fx, fy), wpx = cm * s, hpx = wpx / ar, c = F.toPx(fx, fy);
        const up = add(wrap, 'img', 'upright', { left: c[0] - wpx / 2 + 'px', top: c[1] - hpx / 2 + 'px', width: wpx + 'px', height: hpx + 'px' });
        up.src = cut.url; up.alt = '';
        return [c[0] - wpx / 2, c[1] - hpx / 2, c[0] + wpx / 2, c[1] + hpx / 2];
      }
      if (how === 'lay') {   // a rug: flat, a child of the floor's plane
        const rw = cm, rh = cm / ar, { d, k } = planeDiv(F, wrap);
        const rug = add(d, 'div', 'rug', { left: (fx - rw / 2) / k + 'px', top: (fy - rh / 2) / k + 'px', width: rw / k + 'px', height: rh / k + 'px' });
        rug.style.backgroundImage = 'url("' + (cut ? cut.url : t.src) + '")';
        return boxOf([[fx - rw / 2, fy - rh / 2], [fx + rw / 2, fy - rh / 2], [fx + rw / 2, fy + rh / 2], [fx - rw / 2, fy + rh / 2]].map(([x, y]) => F.toPx(x, y)));
      }
      const s = F.scale(fx, fy), hpx = cm * s, wpx = hpx * ar, foot = F.toPx(fx, fy);
      const hangs = how === 'light' && sp === S.light, set = how === 'set' && sp === S.set && sp.top != null;
      const bottom = set ? sp.top / 100 * h : foot[1], top = hangs ? sp.top / 100 * h : bottom - hpx;
      if (!hangs && !set) {   // its contact shadow, lying in the floor's perspective
        const sw = Math.max(30, cm * ar * 0.9), { d, k } = planeDiv(F, wrap);
        add(d, 'div', 'foot', { left: (fx - sw / 2) / k + 'px', top: (fy - sw * 0.18) / k + 'px', width: sw / k + 'px', height: sw * 0.36 / k + 'px' });
      }
      const up = add(wrap, 'img', 'upright' + (cut ? '' : ' whole'), { left: foot[0] - wpx / 2 + 'px', top: top + 'px', width: wpx + 'px', height: hpx + 'px' });
      up.src = cut ? cut.url : t.src; up.alt = '';
      if (!cut && !hangs) add(wrap, 'div', 'base', { left: foot[0] - wpx * 0.54 + 'px', top: top + hpx + 'px', width: wpx * 1.08 + 'px', height: Math.max(2, hpx * 0.035) + 'px' });   // stands whole, on a small base
      if (how === 'light') {   // a warm glow under it
        const gx = foot[0] / w * 100, gy = (hangs ? top + hpx * 1.05 : top + hpx * 0.25) / h * 100;
        add(wrap, 'div', 'glow').style.background = 'radial-gradient(circle at ' + gx + '% ' + gy + '%, rgba(255,206,150,.42), rgba(255,206,150,.14) 16%, rgba(255,206,150,0) 34%)';
      }
      return [foot[0] - wpx / 2, top, foot[0] + wpx / 2, top + hpx];
    }

    function fit() {
      const bw = el.clientWidth;
      if (!bw || !w || !stage) return;
      stage.style.transform = 'scale(' + bw / w + ')';
      const bh = bw * h / w;
      if (Math.abs(el.clientHeight - bh) > 0.5) el.style.height = bh + 'px';
    }

    let photo = null;
    async function redo(key) {
      if (!(await handle.ready) || gone) return;
      const n = seq[key] = (seq[key] || 0) + 1;
      const p = await prep(key);
      if (!gone && n === seq[key]) draw(key, p, true);   // a later pick wins
    }
    const handle = {
      room: null, ready: null,
      update(key, val) {
        if (key === 'as') { as = val || {}; return Promise.all([redo('wall'), redo('floor')]); }
        if (KEYS.indexOf(key) < 0) return Promise.resolve();
        things[key] = val || null;
        return redo(key);
      },
      destroy() {
        gone = true;
        if (ro) ro.disconnect(); else root.removeEventListener('resize', fit);
        el.textContent = '';
        delete el.dataset.ready;
      },
    };
    handle.ready = (async () => {
      try { photo = await load(o.src); } catch (e) { photo = null; }
      if (gone) return false;
      if (!photo) { el.dataset.ready = 'fail'; if (o.onFail) o.onFail(); return false; }
      w = photo.naturalWidth; h = photo.naturalHeight;
      R = roomOf(o.marks, w, h) || boxFromGuess(guessFor(o.id, photo), w, h);
      if (R.guess) try { R.sun = brightest(photo); } catch (e) { /* another origin: the far wall's top */ }
      handle.room = R;
      const parts = await Promise.all(KEYS.map(prep));   // everything measured first, then drawn at once
      if (gone) return false;
      el.style.aspectRatio = w + ' / ' + h;
      stage = add(el, 'div', 'rstage', { width: w + 'px', height: h + 'px' });
      const ph = add(stage, 'img', 'photo');
      ph.src = o.src; ph.draggable = false;
      if (live) {
        ph.alt = o.label || (o.name || 'This room') + ': your room' + (R.say ? ', ' + R.say : '') + '.';
        ph.setAttribute('role', 'img');
      } else { ph.alt = ''; ph.setAttribute('aria-hidden', 'true'); }
      for (const k of KEYS) { wraps[k] = add(stage, 'div', 'rlayer'); wraps[k].setAttribute('aria-hidden', 'true'); }
      KEYS.forEach((k, i) => draw(k, parts[i], false));
      if (live && o.name) { const n = add(el, 'span', 'rname'); n.textContent = o.name; n.setAttribute('aria-hidden', 'true'); }
      if (live && typeof o.stepIn === 'function' && webgl()) {   // the second step (spec 7.7): only where the app passes it
        const b = add(el, 'button', 'stepin'); b.type = 'button'; b.textContent = 'Step in';
        b.addEventListener('click', () => o.stepIn());
      }
      fit();
      if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(fit); ro.observe(el); } else root.addEventListener('resize', fit);
      el.dataset.ready = '1';
      return true;
    })();
    return handle;
  }

  const FiveSRoom = Object.freeze({
    version: 1,
    sq2quad, apply, inv, m3d, planeOf, boxFromGuess, howIn, words,
    likeMask, softShade, cutOut, guessFloor,
    mount, release,
  });
  if (typeof module === 'object' && module.exports) module.exports = FiveSRoom;
  else root.FiveSRoom = FiveSRoom;
})(typeof self !== 'undefined' ? self : globalThis);

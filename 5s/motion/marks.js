/* 5s Motion Lab: marks.js
 *
 * The 5s mark as centerline strokes, the engine every motion family draws with, and the
 * registry the families join. A plain script: it defines two frozen globals, `Marks` and
 * `Motion` (on window in a page, on globalThis in Node via vm). No lab code lives here, so the
 * app can lift this file as is.
 *
 * Mark space is 1000 x 1000, y down: the logo's rounded square (its frame's outer edge) fills it.
 * The 5 is two strokes (`bar`, `body`), the s one (`s`); each is a cubic Bezier centerline drawn
 * with a width and round caps, traced over logo-source.jpg (see SPEC.md "The mark").
 *
 *   Marks.W                         1000
 *   Marks.paths                     {bar, body, s, ribbon, d1, d2, d3, d4, frame}: SVG path strings
 *   Marks.widths                    stroke width per path in mark units (bar 138, body 130, s 102 ...)
 *   Marks.points(name|d, n=128)     [[x,y] x n] evenly spaced by arc length (fresh arrays)
 *   Marks.length(name|d)            arc length
 *   Marks.resample(pts, n)          any polyline -> n points evenly spaced by arc length
 *   Marks.morph(a, b, t)            pointwise lerp (unequal lists are resampled to the longer n)
 *   Marks.stroke(ctx, pts, {width, from, to, colours, cap, alpha, shift})
 *                                   thick stroke from fraction `from` to `to` of its length, coloured by
 *                                   a gradient ALONG the whole stroke, so a partial stroke keeps its colours;
 *                                   colours: '#hex' | ['#a', '#b', ...] | [[u, '#a'], ...]; cap: round | butt | square;
 *                                   shift slides the gradient toward the end by that fraction (end colours extend)
 *   Marks.ribbon(ctx, t, {phase, width, alpha, colours, along, strands, twist, pts})
 *                                   the logo's glassy ribbon: a twisting band of thin translucent strands;
 *                                   t in [0,1] turns it once (seamless loop); along = end fraction or [from, to]
 *   Marks.mark(ctx, {palette, theme, weight, ribbon, frame, alpha, t, n})
 *                                   the whole still logo, crisp: ribbon, 5, s (and frame if asked)
 *   Marks.palette(name, theme)      {five, bar, body, s, ribbon, frame, bg, ink, paper, ember, flare, iris, cobalt}
 *   Marks.ease                      {linear, inQuad, outQuad, inOutQuad, inCubic, outCubic, inOutCubic, outQuint,
 *                                    inOutQuint, inOutSine, outExpo, outBack(k), outElastic(k), spring(stiffness,
 *                                    damping), steps(n)}; Marks.easing(name) resolves a name to a function
 *   Marks.rng(seed)                 () => [0,1), mulberry32 from a string or number
 *   Marks.mix(hexA, hexB, t)        '#rrggbb'
 *   Marks.fit(ctx, w, h, pad=0)     applies (and returns) the transform placing mark space centred in a w x h box
 *   Marks.layer(ctx, {alpha, composite, filter, blur, resolution}, c => ...)   a group composited once
 *   helpers: Marks.at, Marks.transform, Marks.bbox, Marks.colourAt, Marks.rgba, Marks.clamp,
 *            Marks.lerp, Marks.smoothstep, Marks.anchors, Marks.PALETTES, Marks.EASES
 *
 *   Motion.register(def)            validates and adds a family (see SPEC.md "Families")
 *   Motion.families                 the registered families, in the spec's order
 *   Motion.get(id) / Motion.defaults(id) / Motion.resolve(id, params) / Motion.forMoment(moment)
 *   Motion.render(ctx, id, t, params, env)   one frame, deterministic
 *   Motion.MOMENTS, Motion.ORDER, Motion.SHARED
 */
(function (root) {
  'use strict';

  const W = 1000;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------------------------------
   * The mark: traced over the logo (5s/logo-source.jpg) with the frame's outer edge at 0..1000.
   * ---------------------------------------------------------------------------------------- */
  const PATHS = {
    // the 5's top bar, left (where it meets the stem) to its bright tip on the right
    bar: 'M 326 231 C 422 231 520 230 616 229',
    // the 5's body: down the leaning stem to the foot, a turn, then round the bowl to its lower-left terminal
    body: 'M 311 231 C 262 318 211 404 160 491 C 226 452 312 422 404 421 C 484 420 541.4 476 540 548 ' +
          'C 538 650 448 754 300 759 C 245 761 196 756 154 749',
    // the s, from its top terminal (right) round the upper curve, down the spine, round and out to the left
    s: 'M 870 514 C 840 503 802 501 770 507 C 738 513 721 547 720 583 C 718.9 624 764 646 804 667 ' +
       'C 846 689.05 862 718 858 752 C 852.1 802 800 830 740 831 C 690 831.8 650 826 610 824',
    // the ribbon's spine: out from under the bowl's terminal on the left, under the bowl, up between the
    // bowl and the s (behind the s), and over the top of the bowl to the foot of the bar
    ribbon: 'M 112 750 C 180 840 310 892 480 878 C 620 866 676 770 680 624 C 684 476 632 368 534 330 ' +
            'C 470 306 396 310 336 334',
    // digits in the same stroke language (lean, width, round caps), in the 5's place
    d1: 'M 352 332 C 406 309 462 274 506 232 C 445 407 383 583 322 758',
    d2: 'M 262 330 C 290 262 370 226 450 226 C 545 226 600 282 590 350 C 580 420 520 470 440 530 ' +
        'C 360 590 280 660 214 754 C 330 754 445 754 560 754',
    d3: 'M 270 290 C 330 245 400 226 470 228 C 552 230 600 278 588 340 C 576 405 500 452 400 466 ' +
        'C 500 468 556 520 552 590 C 546 690 450 758 320 760 C 260 761 205 756 160 750',
    d4: 'M 372 758 C 430 583 488 407 545 232 C 430 355 315 477 200 600 C 335 600 470 600 606 600',
    // the rounded square: the frame's centerline (outer edge 0..1000, radius 256, 42 thick)
    frame: 'M 256 21 L 744 21 C 873.8 21 979 126.2 979 256 L 979 744 C 979 873.8 873.8 979 744 979 ' +
           'L 256 979 C 126.2 979 21 873.8 21 744 L 21 256 C 21 126.2 126.2 21 256 21 Z'
  };

  const WIDTHS = { bar: 138, body: 130, s: 102, ribbon: 190, d1: 130, d2: 130, d3: 130, d4: 130, frame: 42 };

  // useful centres (mark units): scale or turn parts about these
  const ANCHORS = {
    mark: [500, 500],     // the square's centre
    five: [400, 490],     // the 5's visual centre
    bowl: [370, 588],     // centre of the 5's bowl (its counter)
    s: [785, 668],        // the s's centre
    letters: [505, 495],  // the 5s pair's centre of mass
    frame: [500, 500]
  };

  /* ------------------------------------------------------------------------------------------
   * small maths
   * ---------------------------------------------------------------------------------------- */
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /* ------------------------------------------------------------------------------------------
   * paths: parse SVG path data (M L H V C S Q T Z, absolute and relative) into cubic segments,
   * flatten densely, measure, resample by arc length. One continuous stroke per path: a second
   * M joins the previous point with a straight segment.
   * ---------------------------------------------------------------------------------------- */
  function parsePath(d) {
    const re = /([MmLlHhVvCcSsQqTtZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
    const toks = [];
    let m;
    while ((m = re.exec(d))) toks.push(m[1] ? m[1] : parseFloat(m[2]));
    const segs = [];
    let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, started = false;
    let pcx = null, pcy = null, pqx = null, pqy = null;
    const bad = () => { throw new Error('Marks: cannot read path data near "' + String(d).slice(0, 48) + '"'); };
    const n = () => { const v = toks[i++]; if (typeof v !== 'number') bad(); return v; };
    const cubic = (x1, y1, x2, y2, x3, y3) => { segs.push([x, y, x1, y1, x2, y2, x3, y3]); x = x3; y = y3; };
    const line = (x3, y3) => cubic(x + (x3 - x) / 3, y + (y3 - y) / 3, x + (2 * (x3 - x)) / 3, y + (2 * (y3 - y)) / 3, x3, y3);
    while (i < toks.length) {
      if (typeof toks[i] === 'string') cmd = toks[i++];
      else if (!cmd) bad();
      const rel = cmd !== cmd.toUpperCase();
      const C = cmd.toUpperCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      let keepC = false, keepQ = false;
      if (C === 'M') {
        const nx = n() + ox, ny = n() + oy;
        if (started) line(nx, ny); else { x = nx; y = ny; }
        sx = x; sy = y; started = true;
        cmd = rel ? 'l' : 'L';
      } else if (C === 'L') { line(n() + ox, n() + oy); }
      else if (C === 'H') { line(n() + ox, y); }
      else if (C === 'V') { line(x, n() + oy); }
      else if (C === 'C') {
        const x1 = n() + ox, y1 = n() + oy, x2 = n() + ox, y2 = n() + oy, x3 = n() + ox, y3 = n() + oy;
        cubic(x1, y1, x2, y2, x3, y3); pcx = x2; pcy = y2; keepC = true;
      } else if (C === 'S') {
        const x1 = pcx == null ? x : 2 * x - pcx, y1 = pcy == null ? y : 2 * y - pcy;
        const x2 = n() + ox, y2 = n() + oy, x3 = n() + ox, y3 = n() + oy;
        cubic(x1, y1, x2, y2, x3, y3); pcx = x2; pcy = y2; keepC = true;
      } else if (C === 'Q' || C === 'T') {
        let qx, qy;
        if (C === 'Q') { qx = n() + ox; qy = n() + oy; }
        else { qx = pqx == null ? x : 2 * x - pqx; qy = pqy == null ? y : 2 * y - pqy; }
        const x3 = n() + ox, y3 = n() + oy;
        cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3), x3, y3);
        pqx = qx; pqy = qy; keepQ = true;
      } else if (C === 'Z') {
        if (Math.abs(x - sx) > 1e-9 || Math.abs(y - sy) > 1e-9) line(sx, sy);
        x = sx; y = sy;
      } else bad();
      if (!keepC) { pcx = null; pcy = null; }
      if (!keepQ) { pqx = null; pqy = null; }
    }
    if (!started) bad();
    return { segs, x0: segs.length ? segs[0][0] : x, y0: segs.length ? segs[0][1] : y };
  }

  const dense = new Map();   // path data -> {xs, ys, cum, L}
  function flatten(d) {
    let f = dense.get(d);
    if (f) return f;
    const { segs, x0, y0 } = parsePath(d);
    const xs = [x0], ys = [y0];
    for (const s of segs) {
      const poly = Math.hypot(s[2] - s[0], s[3] - s[1]) + Math.hypot(s[4] - s[2], s[5] - s[3]) + Math.hypot(s[6] - s[4], s[7] - s[5]);
      const steps = Math.max(4, Math.ceil(poly / 1.25));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, e = t * t * t;
        xs.push(a * s[0] + b * s[2] + c * s[4] + e * s[6]);
        ys.push(a * s[1] + b * s[3] + c * s[5] + e * s[7]);
      }
    }
    const cum = new Float64Array(xs.length);
    for (let k = 1; k < xs.length; k++) cum[k] = cum[k - 1] + Math.hypot(xs[k] - xs[k - 1], ys[k] - ys[k - 1]);
    f = { xs: Float64Array.from(xs), ys: Float64Array.from(ys), cum, L: cum[cum.length - 1] };
    dense.set(d, f);
    return f;
  }

  function pathData(name) {
    if (typeof name === 'string') {
      if (Object.prototype.hasOwnProperty.call(PATHS, name)) return PATHS[name];
      if (/^\s*[Mm]/.test(name)) return name;
    }
    throw new Error('Marks: unknown path "' + name + '" (one of ' + Object.keys(PATHS).join(', ') + ', or SVG path data)');
  }

  // n points evenly spaced by arc length along xs/ys with cumulative lengths cum
  function sampleEven(xs, ys, cum, n) {
    const L = cum[cum.length - 1], out = new Array(n), last = xs.length - 1;
    if (n === 1) return [[xs[0], ys[0]]];
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (i === n - 1) { out[i] = [xs[last], ys[last]]; break; }
      const s = (L * i) / (n - 1);
      while (j < last - 1 && cum[j + 1] < s) j++;
      const seg = cum[j + 1] - cum[j];
      const f = seg > 0 ? clamp01((s - cum[j]) / seg) : 0;
      out[i] = [xs[j] + (xs[j + 1] - xs[j]) * f, ys[j] + (ys[j + 1] - ys[j]) * f];
    }
    return out;
  }

  function points(name, n) {
    n = Math.max(1, Math.round(num(n, 128)));
    const f = flatten(pathData(name));
    if (f.xs.length < 2) { const out = []; for (let i = 0; i < n; i++) out.push([f.xs[0], f.ys[0]]); return out; }
    return sampleEven(f.xs, f.ys, f.cum, n);
  }

  function length(name) { return flatten(pathData(name)).L; }

  function resample(pts, n) {
    n = Math.max(1, Math.round(num(n, pts.length)));
    if (!pts || !pts.length) return [];
    if (pts.length === 1) { const out = []; for (let i = 0; i < n; i++) out.push([pts[0][0], pts[0][1]]); return out; }
    const xs = new Float64Array(pts.length), ys = new Float64Array(pts.length), cum = new Float64Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      xs[i] = pts[i][0]; ys[i] = pts[i][1];
      if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    return sampleEven(xs, ys, cum, n);
  }

  function morph(a, b, t) {
    if (a.length !== b.length) { const n = Math.max(a.length, b.length); a = resample(a, n); b = resample(b, n); }
    const out = new Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = [a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t];
    return out;
  }

  // the point and direction at fraction u of a polyline's length: {x, y, angle} (angle in radians)
  function at(pts, u) {
    if (typeof pts === 'string') pts = points(pts, 256);
    const n = pts.length;
    if (!n) return { x: 0, y: 0, angle: 0 };
    if (n === 1) return { x: pts[0][0], y: pts[0][1], angle: 0 };
    let L = 0; const cum = [0];
    for (let i = 1; i < n; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(L); }
    const s = clamp01(u) * L;
    let j = 0;
    while (j < n - 2 && cum[j + 1] < s) j++;
    // skip zero-length segments for the direction
    let k = j;
    while (k < n - 2 && cum[k + 1] - cum[k] < 1e-9) k++;
    const seg = cum[j + 1] - cum[j], f = seg > 0 ? (s - cum[j]) / seg : 0;
    return {
      x: pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f,
      y: pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f,
      angle: Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0])
    };
  }

  // move a point list: {x, y} translate, {scale | sx, sy} and {rotate} (radians) about {origin: [ox, oy]}
  function transform(pts, o) {
    o = o || {};
    const org = o.origin || ANCHORS.mark;
    const sx = num(o.sx, num(o.scale, 1)), sy = num(o.sy, num(o.scale, 1));
    const r = num(o.rotate, 0), c = Math.cos(r), s = Math.sin(r);
    const tx = num(o.x, 0), ty = num(o.y, 0), skew = num(o.skew, 0);
    return pts.map((p) => {
      let dx = (p[0] - org[0]) * sx, dy = (p[1] - org[1]) * sy;
      dx += skew * dy;
      return [org[0] + dx * c - dy * s + tx, org[1] + dx * s + dy * c + ty];
    });
  }

  // bounds of a path (by name) or polyline, padded by half the stroke width: [x0, y0, x1, y1]
  function bbox(what, width) {
    const pts = typeof what === 'string' ? points(what, 256) : what;
    const w = num(width, typeof what === 'string' && WIDTHS[what] ? WIDTHS[what] : 0) / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    return [x0 - w, y0 - w, x1 + w, y1 + w];
  }

  /* ------------------------------------------------------------------------------------------
   * colour
   * ---------------------------------------------------------------------------------------- */
  const rgbCache = new Map();
  function toRgb(c) {
    if (Array.isArray(c)) return c;
    let v = rgbCache.get(c);
    if (v) return v;
    const s = String(c).trim();
    let r = 0, g = 0, b = 0, mm;
    if ((mm = /^#([0-9a-f]{3})$/i.exec(s))) {
      r = parseInt(mm[1][0] + mm[1][0], 16); g = parseInt(mm[1][1] + mm[1][1], 16); b = parseInt(mm[1][2] + mm[1][2], 16);
    } else if ((mm = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) {
      r = parseInt(mm[1].slice(0, 2), 16); g = parseInt(mm[1].slice(2, 4), 16); b = parseInt(mm[1].slice(4, 6), 16);
    } else if ((mm = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s))) {
      r = +mm[1]; g = +mm[2]; b = +mm[3];
    }
    v = [r, g, b];
    rgbCache.set(c, v);
    return v;
  }
  const hex2 = (v) => { const h = Math.round(clamp(v, 0, 255)).toString(16); return h.length < 2 ? '0' + h : h; };
  const toHex = (rgb) => '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]);
  const css = (rgb) => 'rgb(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ')';

  function mix(a, b, t) {
    const A = toRgb(a), B = toRgb(b), k = clamp01(num(t, 0.5));
    return toHex([A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k]);
  }

  function rgba(c, a) { const v = toRgb(c); return 'rgba(' + Math.round(v[0]) + ',' + Math.round(v[1]) + ',' + Math.round(v[2]) + ',' + clamp01(num(a, 1)) + ')'; }

  // colour stops: '#hex' | ['#a', '#b', ...] (even spacing) | [[pos, '#a'], ...]
  function parseStops(colours) {
    if (colours == null) colours = '#16131F';
    if (!Array.isArray(colours)) return [[0, toRgb(colours)]];
    if (!colours.length) return [[0, toRgb('#16131F')]];
    const n = colours.length;
    const stops = colours.map((c, i) => (Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && typeof c[1] === 'string')
      ? [clamp01(c[0]), toRgb(c[1])]
      : [n === 1 ? 0 : i / (n - 1), toRgb(c)]);
    stops.sort((p, q) => p[0] - q[0]);
    return stops;
  }
  function stopsAt(stops, u) {
    if (stops.length === 1) return stops[0][1];
    u = clamp01(u);
    if (u <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (u <= stops[i][0]) {
        const a = stops[i - 1], b = stops[i], span = b[0] - a[0];
        const k = span > 0 ? (u - a[0]) / span : 1;
        return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k];
      }
    }
    return stops[stops.length - 1][1];
  }
  const isSolid = (stops) => stops.every((s) => s[1][0] === stops[0][1][0] && s[1][1] === stops[0][1][1] && s[1][2] === stops[0][1][2]);
  function colourAt(colours, u) { return toHex(stopsAt(parseStops(colours), u)); }

  /* ------------------------------------------------------------------------------------------
   * palettes: from the logo and the app's tokens
   * ---------------------------------------------------------------------------------------- */
  const TOKENS = {
    light: { paper: '#FAF9FC', ink: '#16131F', ember: '#F28A3C', flare: '#E5482B', iris: '#7350EE', cobalt: '#2F6BE0' },
    dark: { paper: '#100E18', ink: '#EEEBF5', ember: '#FF9B55', flare: '#FF6B4D', iris: '#A78BFF', cobalt: '#6C9DFF' }
  };
  // sampled from logo-source.jpg along each stroke
  const LOGO = {
    bar: [[0, '#ED8F37'], [0.5, '#EF9F3D'], [1, '#F7D161']],
    body: [[0, '#ED8C37'], [0.12, '#EB7A34'], [0.24, '#EA6C32'], [0.45, '#EB7234'], [0.62, '#EA7336'], [0.76, '#E95836'], [0.87, '#E6403C'], [0.95, '#DD3C68'], [1, '#B64CD6']],
    s: [[0, '#F6D66A'], [0.12, '#F0AD44'], [0.3, '#EA622E'], [0.5, '#EC6B32'], [0.65, '#EB7338'], [0.82, '#E8452E'], [0.93, '#E23A48'], [1, '#CF3776']],
    five: ['#F7D161', '#EE9038', '#EA6B32', '#E6403C'],
    ribbon: ['#A763E8', '#673DE7', '#3F5CF0', '#AFA0F7'],
    frame: [[0, '#3577EC'], [0.07, '#3575EC'], [0.196, '#2E67EA'], [0.32, '#4B5FF1'], [0.446, '#795BF2'], [0.571, '#3C7DF3'],
            [0.696, '#2553D9'], [0.82, '#2759DB'], [0.946, '#3678EC'], [1, '#3577EC']]
  };
  const lift = (stops, k) => stops.map((s) => (Array.isArray(s) ? [s[0], mix(s[1], '#FFFFFF', k)] : mix(s, '#FFFFFF', k)));
  const PALETTES = ['logo', 'keep', 'pass', 'turn', 'ink', 'paper', 'inverse'];
  const palCache = new Map();

  function buildPalette(name, theme) {
    const T = TOKENS[theme];
    const base = { name, theme, bg: T.paper, ink: T.ink, paper: T.paper, ember: T.ember, flare: T.flare, iris: T.iris, cobalt: T.cobalt };
    const dark = theme === 'dark';
    const one = (c) => ({ five: [c], bar: [c], body: [c], s: [c], ribbon: [c], frame: [c] });
    switch (name) {
      case 'logo':
        return Object.assign(base, dark
          ? { five: lift(LOGO.five, 0.08), bar: lift(LOGO.bar, 0.08), body: lift(LOGO.body, 0.1), s: lift(LOGO.s, 0.1), ribbon: lift(LOGO.ribbon, 0.2), frame: lift(LOGO.frame, 0.18) }
          : { five: LOGO.five, bar: LOGO.bar, body: LOGO.body, s: LOGO.s, ribbon: LOGO.ribbon, frame: LOGO.frame });
      case 'keep': {
        const e = T.ember, f = T.flare;
        return Object.assign(base, {
          five: [mix(e, '#FFD27A', 0.35), e, f], bar: [e, mix(e, '#FFD27A', 0.45)], body: [e, mix(e, f, 0.55), f],
          s: [mix(e, '#FFD27A', 0.3), e, f], ribbon: [mix(e, '#FFFFFF', 0.35), e, mix(f, '#FFFFFF', 0.45)], frame: [e, f, e]
        });
      }
      case 'pass': {
        const c = T.cobalt;
        return Object.assign(base, {
          five: [mix(c, '#FFFFFF', 0.3), c, mix(c, '#0B1E5C', dark ? 0 : 0.2)], bar: [c, mix(c, '#FFFFFF', 0.3)],
          body: [mix(c, '#FFFFFF', 0.15), c, mix(c, '#0B1E5C', dark ? 0.05 : 0.22)], s: [mix(c, '#FFFFFF', 0.3), c, mix(c, '#0B1E5C', dark ? 0.05 : 0.22)],
          ribbon: [mix(c, '#FFFFFF', 0.45), c, mix(c, '#FFFFFF', 0.65)], frame: [c]
        });
      }
      case 'turn': {
        const v = T.iris;
        return Object.assign(base, {
          five: [mix(v, '#FFFFFF', 0.3), v, mix(v, '#2A1170', dark ? 0 : 0.2)], bar: [v, mix(v, '#FFFFFF', 0.3)],
          body: [mix(v, '#FFFFFF', 0.15), v, mix(v, '#2A1170', dark ? 0.05 : 0.22)], s: [mix(v, '#FFFFFF', 0.3), v, mix(v, '#2A1170', dark ? 0.05 : 0.22)],
          ribbon: dark ? lift(LOGO.ribbon, 0.2) : LOGO.ribbon, frame: [v, T.cobalt, v]
        });
      }
      case 'ink': return Object.assign(base, one(T.ink));
      case 'paper': return Object.assign(base, one(T.paper), { bg: T.iris, ink: T.paper });
      case 'inverse': {
        const other = dark ? 'light' : 'dark';
        const p = buildPalette('logo', other);
        return Object.assign(p, { name, theme, bg: TOKENS[other].paper, ink: TOKENS[other].ink, paper: TOKENS[other].paper });
      }
      default: return null;
    }
  }

  function freezeDeep(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) freezeDeep(o[k]); }
    return o;
  }

  function palette(name, theme) {
    if (!PALETTES.includes(name)) name = 'logo';
    theme = theme === 'dark' ? 'dark' : 'light';
    const key = name + ':' + theme;
    let p = palCache.get(key);
    if (!p) { p = freezeDeep(buildPalette(name, theme)); palCache.set(key, p); }
    return p;
  }

  /* ------------------------------------------------------------------------------------------
   * easing: every curve maps 0 -> 0 and 1 -> 1 exactly; inputs are clamped to [0, 1]
   * ---------------------------------------------------------------------------------------- */
  const ease = {
    linear: (t) => clamp01(t),
    inQuad: (t) => { t = clamp01(t); return t * t; },
    outQuad: (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); },
    inOutQuad: (t) => { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inCubic: (t) => { t = clamp01(t); return t * t * t; },
    outCubic: (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 3); },
    inOutCubic: (t) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outQuint: (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 5); },
    inOutQuint: (t) => { t = clamp01(t); return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; },
    inOutSine: (t) => { t = clamp01(t); return t <= 0 ? 0 : t >= 1 ? 1 : -(Math.cos(Math.PI * t) - 1) / 2; },
    outExpo: (t) => { t = clamp01(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    // overshoots then settles; k = how far (1.70158 is the classic)
    outBack: (k) => { const c = num(k, 1.70158), c3 = c + 1; return (t) => { t = clamp01(t); return t >= 1 ? 1 : 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }; },
    // springs past and rings down; k = number of half-swings (default 3)
    outElastic: (k) => {
      const swings = num(k, 3), w = (swings * Math.PI) - Math.PI / 2;
      return (t) => { t = clamp01(t); if (t <= 0) return 0; if (t >= 1) return 1; return 1 - Math.pow(2, -10 * t) * Math.cos(w * t); };
    },
    // a damped spring (mass 1) released at 0, aiming at 1; [0,1] spans its settling time
    spring: (stiffness, damping) => {
      const k = Math.max(1, num(stiffness, 170)), c = Math.max(0.1, num(damping, 18));
      const w0 = Math.sqrt(k), z = c / (2 * w0);
      const T = Math.log(1000) / Math.max(1e-3, (z < 1 ? z * w0 : (z - Math.sqrt(z * z - 1)) * w0));
      const x = (tau) => {
        if (z < 1) {
          const wd = w0 * Math.sqrt(1 - z * z);
          return 1 - Math.exp(-z * w0 * tau) * (Math.cos(wd * tau) + (z * w0 / wd) * Math.sin(wd * tau));
        }
        if (z === 1) return 1 - Math.exp(-w0 * tau) * (1 + w0 * tau);
        const r1 = -w0 * (z - Math.sqrt(z * z - 1)), r2 = -w0 * (z + Math.sqrt(z * z - 1));
        return 1 - (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r2 - r1);
      };
      const end = x(T);
      return (t) => { t = clamp01(t); if (t <= 0) return 0; if (t >= 1) return 1; return x(t * T) + t * (1 - end); };
    },
    steps: (n) => { const k = Math.max(1, Math.round(num(n, 5))); return (t) => { t = clamp01(t); return t >= 1 ? 1 : Math.floor(t * k) / k; }; }
  };
  const EASES = ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'inCubic', 'outCubic', 'inOutCubic', 'outQuint', 'inOutQuint',
                 'inOutSine', 'outExpo', 'outBack', 'outElastic', 'spring', 'steps'];
  const FACTORIES = { outBack: 1, outElastic: 1, spring: 1, steps: 1 };
  const easeCache = new Map();
  // a name ('outBack', 'spring', 'steps', ...) or a function -> an easing function (factories with their defaults)
  function easing(name) {
    if (typeof name === 'function') return name;
    if (!Object.prototype.hasOwnProperty.call(ease, name)) return ease.outCubic;
    if (!FACTORIES[name]) return ease[name];
    let f = easeCache.get(name);
    if (!f) { f = ease[name](); easeCache.set(name, f); }
    return f;
  }

  /* ------------------------------------------------------------------------------------------
   * randomness: deterministic
   * ---------------------------------------------------------------------------------------- */
  function hashSeed(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
    const s = String(seed == null ? '' : seed);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function rng(seed) {
    let a = hashSeed(seed);
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------------------------------
   * placing mark space in a box
   * ---------------------------------------------------------------------------------------- */
  function fit(ctx, w, h, pad) {
    pad = Math.max(0, num(pad, 0));
    const side = Math.max(1e-6, Math.min(w, h) - 2 * pad);
    const scale = side / W;
    const ox = (w - W * scale) / 2, oy = (h - W * scale) / 2;
    if (ctx) { ctx.translate(ox, oy); ctx.scale(scale, scale); }
    return { scale, ox, oy };
  }

  /* ------------------------------------------------------------------------------------------
   * scratch canvases (a small pool, one per nesting depth) for translucent groups
   * ---------------------------------------------------------------------------------------- */
  const pool = [];
  let depth = 0;
  function makeCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return null;
  }
  function scratch(w, h) {
    let c = pool[depth];
    if (!c) { c = makeCanvas(Math.max(1, w), Math.max(1, h)); if (!c) return null; pool[depth] = c; }
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    return c;
  }
  const getT = (ctx) => (ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

  // draw(c) into a scratch layer of the same canvas, then composite it once with
  // {alpha, composite, filter, blur, resolution}: a translucent group without darker overlaps where its own
  // strokes cross. blur (device px) is done cheaply: the layer is drawn at reduced resolution (0.5 from a
  // 6 px blur, 0.25 from 20 px; or `resolution`), blurred there and scaled up, where the blur hides it.
  let blurCanvas = null;
  function layer(ctx, o, draw) {
    if (typeof o === 'function') { draw = o; o = {}; }
    o = o || {};
    const alpha = clamp01(num(o.alpha, 1));
    const blur = Math.max(0, num(o.blur, 0));
    if (alpha <= 0) return;
    if (alpha >= 0.999 && !o.composite && !o.filter && !blur) { draw(ctx); return; }
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    const r = clamp(num(o.resolution, blur >= 20 ? 0.25 : blur >= 6 ? 0.5 : 1), 0.05, 1);
    const lw = Math.max(1, Math.ceil(cw * r)), lh = Math.max(1, Math.ceil(ch * r));
    const sc = scratch(lw, lh);
    if (!sc) { ctx.save(); ctx.globalAlpha *= alpha; draw(ctx); ctx.restore(); return; }
    const s = sc.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'; s.filter = 'none';
    s.clearRect(0, 0, lw, lh);
    const m = getT(ctx);
    s.setTransform(m.a * r, m.b * r, m.c * r, m.d * r, m.e * r, m.f * r);
    depth++;
    try { s.save(); draw(s); s.restore(); } finally { depth--; }
    let src = sc, sw = lw, sh = lh;
    if (blur > 0) {
      if (!blurCanvas) blurCanvas = makeCanvas(lw, lh);
      if (blurCanvas) {
        if (blurCanvas.width < lw || blurCanvas.height < lh) { blurCanvas.width = Math.max(blurCanvas.width, lw); blurCanvas.height = Math.max(blurCanvas.height, lh); }
        const b = blurCanvas.getContext('2d');
        b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, lw, lh);
        if (canFilter(b)) {
          b.filter = 'blur(' + (blur * r).toFixed(2) + 'px)';
          b.drawImage(sc, 0, 0, lw, lh, 0, 0, lw, lh);
          b.filter = 'none';
        } else {
          // no canvas filters (Safari before 18): blur by resampling, down to about one pixel per blur radius
          // here, and the smooth scale-up below spreads it back out
          const k = clamp(blur * r / 1.5, 1, 32);
          sw = Math.max(1, Math.round(lw / k)); sh = Math.max(1, Math.round(lh / k));
          b.imageSmoothingEnabled = true; b.imageSmoothingQuality = 'high';
          b.drawImage(sc, 0, 0, lw, lh, 0, 0, sw, sh);
        }
        src = blurCanvas;
      }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = ctx.globalAlpha * alpha;
    if (o.composite) ctx.globalCompositeOperation = o.composite;
    if (o.filter) ctx.filter = o.filter;
    if (sw !== lw) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    ctx.drawImage(src, 0, 0, sw, sh, 0, 0, cw, ch);
    ctx.restore();
  }
  // whether this browser's 2D canvas applies ctx.filter (Chromium and Firefox do; Safari only from 18)
  let filterOk = null;
  function canFilter(c) {
    if (filterOk === null) {
      try { c.filter = 'blur(1px)'; filterOk = c.filter === 'blur(1px)'; c.filter = 'none'; } catch (e) { filterOk = false; }
    }
    return filterOk;
  }

  /* ------------------------------------------------------------------------------------------
   * strokes
   * ---------------------------------------------------------------------------------------- */
  // paint a polyline X/Y (u = fraction of the full stroke at each point). One colour: a single stroked path.
  // A gradient: consecutive pieces whose colour (within 2 levels) and width agree are stroked as one round-
  // jointed path with butt ends; each such run overlaps the next by a device pixel (no seams), the outside
  // of the bend between runs is filled with a wedge, and the ends get caps. So every point of the stroke takes
  // the colour of the nearest place on its centerline (round caps per piece would smear colours forward), in
  // a few dozen draw calls per stroke. colourAt(u) returns [r, g, b].
  function paint(c, X, Y, U, widthAt, colourAt, cap, solid, px) {
    const m = X.length;
    c.lineJoin = 'round';
    if (solid) {
      c.strokeStyle = solid; c.lineWidth = widthAt(0.5); c.lineCap = cap;
      c.beginPath(); c.moveTo(X[0], Y[0]);
      for (let i = 1; i < m; i++) c.lineTo(X[i], Y[i]);
      c.stroke();
      return;
    }
    const ext = px || 0.5;
    // the non-degenerate pieces: [i, dx, dy] (unit direction), with their colour and width
    const P = [];
    for (let i = 0; i < m - 1; i++) {
      const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], d = Math.hypot(dx, dy);
      if (d > 1e-9) { const um = (U[i] + U[i + 1]) / 2; P.push({ i, dx: dx / d, dy: dy / d, col: colourAt(um), w: widthAt(um) }); }
    }
    if (!P.length) return;
    X = X.slice(); Y = Y.slice();
    const f0 = P[0], f1 = P[P.length - 1];
    if (cap === 'square') {   // square caps: extend the ends, then paint as butt
      X[f0.i] -= f0.dx * f0.w / 2; Y[f0.i] -= f0.dy * f0.w / 2;
      X[f1.i + 1] += f1.dx * f1.w / 2; Y[f1.i + 1] += f1.dy * f1.w / 2;
    }
    const tolW = Math.max(ext * 0.4, 0);
    const near = (a, b) => Math.abs(a[0] - b[0]) <= 2 && Math.abs(a[1] - b[1]) <= 2 && Math.abs(a[2] - b[2]) <= 2;
    const capAt = (i, dx, dy, sign) => {   // a half disc beyond point i, facing sign * (dx, dy)
      const a = Math.atan2(sign * dy, sign * dx);
      c.fillStyle = css(colourAt(U[i]));
      c.beginPath(); c.moveTo(X[i] - sign * dx * ext, Y[i] - sign * dy * ext);
      c.arc(X[i], Y[i], widthAt(U[i]) / 2, a - Math.PI / 2 - 0.02, a + Math.PI / 2 + 0.02);
      c.closePath(); c.fill();
    };
    const wedge = (i, a, b) => {   // fill the outside of the bend at point i between pieces a and b
      const cr = a.dx * b.dy - a.dy * b.dx, dot = a.dx * b.dx + a.dy * b.dy;
      if (Math.abs(cr) <= 1e-6 && dot > 0) return;
      const side = cr > 0 ? -1 : 1;
      const a0 = Math.atan2(side * a.dx, -side * a.dy), a1 = Math.atan2(side * b.dx, -side * b.dy);
      let sweep = a1 - a0;
      while (sweep > Math.PI) sweep -= TAU;
      while (sweep < -Math.PI) sweep += TAU;
      const pad = 0.03 * Math.sign(sweep || 1);
      c.fillStyle = css(colourAt(U[i]));
      c.beginPath(); c.moveTo(X[i], Y[i]);
      c.arc(X[i], Y[i], widthAt(U[i]) / 2, a0 - pad, a0 + sweep + pad, sweep < 0);
      c.closePath(); c.fill();
    };
    if (cap === 'round') capAt(f0.i, f0.dx, f0.dy, -1);
    c.lineCap = 'butt';
    let g = 0;
    while (g < P.length) {
      // grow a run of pieces that look alike
      let h = g + 1;
      while (h < P.length && P[h].i === P[h - 1].i + 1 && near(P[h].col, P[g].col) && Math.abs(P[h].w - P[g].w) <= Math.max(tolW, P[g].w * 0.015)) h++;
      const first = P[g], last = P[h - 1];
      if (g > 0) wedge(first.i, P[g - 1], first);
      const mid = (U[first.i] + U[last.i + 1]) / 2;
      const e = h < P.length ? ext : 0;
      c.strokeStyle = css(colourAt(mid));
      c.lineWidth = widthAt(mid);
      c.beginPath(); c.moveTo(X[first.i], Y[first.i]);
      for (let k = g; k < h - 1; k++) c.lineTo(X[P[k].i + 1], Y[P[k].i + 1]);
      c.lineTo(X[last.i + 1] + last.dx * e, Y[last.i + 1] + last.dy * e);
      c.stroke();
      g = h;
    }
    if (cap === 'round') capAt(f1.i + 1, f1.dx, f1.dy, 1);
  }

  // draw a prepared band (X/Y/U arrays) at alpha, through a scratch layer clipped to its bounds when translucent
  function drawBand(ctx, X, Y, U, widthAt, colourAt, cap, solid, alpha, maxW) {
    const eff = ctx.globalAlpha * alpha;
    const m = getT(ctx);
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, px = 1 / sc;
    if (solid || eff >= 0.999) {
      ctx.save(); ctx.globalAlpha = eff;
      paint(ctx, X, Y, U, widthAt, colourAt, cap, solid, px);
      ctx.restore();
      return;
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < X.length; i++) {
      const dx = m.a * X[i] + m.c * Y[i] + m.e, dy = m.b * X[i] + m.d * Y[i] + m.f;
      if (dx < x0) x0 = dx; if (dx > x1) x1 = dx; if (dy < y0) y0 = dy; if (dy > y1) y1 = dy;
    }
    const pad = maxW * sc * (cap === 'square' ? 0.75 : 0.5) + 2;
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
    x1 = Math.min(cw, Math.ceil(x1 + pad)); y1 = Math.min(ch, Math.ceil(y1 + pad));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;
    const can = scratch(bw, bh);
    if (!can) {   // no canvas to layer on: paint directly (overlaps show)
      ctx.save(); ctx.globalAlpha = eff; paint(ctx, X, Y, U, widthAt, colourAt, cap, solid, px); ctx.restore();
      return;
    }
    const s = can.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'; s.filter = 'none';
    s.clearRect(0, 0, bw, bh);
    s.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    depth++;
    try { paint(s, X, Y, U, widthAt, colourAt, cap, solid, px); } finally { depth--; }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = eff;
    ctx.drawImage(can, 0, 0, bw, bh, x0, y0, bw, bh);
    ctx.restore();
  }

  // cut [s0, s1] (arc lengths) out of a polyline; returns X, Y and U (fraction of the full length)
  function cut(pts, cum, L, s0, s1, maxPiece) {
    const X = [], Y = [], U = [];
    const n = pts.length;
    const push = (x, y, s) => {
      if (X.length && maxPiece > 0) {   // subdivide long pieces so the gradient stays smooth
        const px = X[X.length - 1], py = Y[Y.length - 1], ps = U[U.length - 1] * L;
        const d = Math.hypot(x - px, y - py), k = Math.floor(d / maxPiece);
        for (let i = 1; i <= k; i++) { const f = i / (k + 1); X.push(px + (x - px) * f); Y.push(py + (y - py) * f); U.push((ps + (s - ps) * f) / L); }
      }
      X.push(x); Y.push(y); U.push(L > 0 ? s / L : 0);
    };
    let j = 0;
    while (j < n - 2 && cum[j + 1] < s0) j++;
    const seg0 = cum[j + 1] - cum[j], f0 = seg0 > 0 ? (s0 - cum[j]) / seg0 : 0;
    push(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f0, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f0, s0);
    let k = j + 1;
    while (k < n && cum[k] < s1) { push(pts[k][0], pts[k][1], cum[k]); k++; }
    const e = Math.min(k, n - 1), b = Math.max(0, e - 1);
    const seg1 = cum[e] - cum[b], f1 = seg1 > 0 ? (s1 - cum[b]) / seg1 : 1;
    push(pts[b][0] + (pts[e][0] - pts[b][0]) * f1, pts[b][1] + (pts[e][1] - pts[b][1]) * f1, s1);
    return { X, Y, U };
  }

  function cumulative(pts) {
    const cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return cum;
  }

  function stroke(ctx, pts, o) {
    o = o || {};
    if (!ctx || !pts || !pts.length) return;
    if (typeof pts === 'string') pts = points(pts, 160);
    const width = num(o.width, 100);
    const from = clamp01(num(o.from, 0)), to = clamp01(num(o.to, 1));
    const alpha = clamp01(num(o.alpha, 1));
    if (!(to > from) || !(width > 0) || alpha <= 0) return;
    const cap = o.cap === 'butt' || o.cap === 'square' ? o.cap : 'round';
    const stops = parseStops(o.colours != null ? o.colours : o.colors);
    const shift = num(o.shift, 0);
    const solid = isSolid(stops) ? css(stops[0][1]) : null;
    const colourAt = (u) => stopsAt(stops, u - shift);   // stopsAt clamps: end colours extend
    const widthAt = () => width;
    const cum = cumulative(pts), L = cum[cum.length - 1];
    if (pts.length < 2 || L < 1e-9) {   // a collapsed stroke is a dot
      if (cap !== 'round') return;
      ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = solid || css(colourAt((from + to) / 2));
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], width / 2, 0, TAU); ctx.fill(); ctx.restore();
      return;
    }
    const { X, Y, U } = cut(pts, cum, L, from * L, to * L, solid ? 0 : Math.max(2, L / 160));
    drawBand(ctx, X, Y, U, widthAt, colourAt, cap, solid, alpha, width);
  }

  /* ------------------------------------------------------------------------------------------
   * the ribbon: a flat band of thin strands that twists along the ribbon path; t turns it
   * ---------------------------------------------------------------------------------------- */
  let ribbonBase = null;
  function frameOf(pts) {
    const n = pts.length, nx = new Float64Array(n), ny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      nx[i] = -dy / d; ny[i] = dx / d;
    }
    return { nx, ny };
  }

  function ribbon(ctx, t, o) {
    o = o || {};
    t = num(t, 0);
    let pts = o.pts;
    if (!pts) { if (!ribbonBase) ribbonBase = points('ribbon', 220); pts = ribbonBase; }
    const n = pts.length;
    if (n < 2) return;
    const spread = num(o.width, WIDTHS.ribbon);
    const alpha = clamp01(num(o.alpha, 1));
    const strands = clamp(Math.round(num(o.strands, 4)), 2, 6);
    const twist = num(o.twist, 0.5);
    const phase = num(o.phase, 0);
    const stops = parseStops(o.colours != null ? o.colours : (o.colors != null ? o.colors : LOGO.ribbon));
    let a0 = 0, a1 = 1;
    if (Array.isArray(o.along)) { a0 = clamp01(num(o.along[0], 0)); a1 = clamp01(num(o.along[1], 1)); }
    else if (o.along != null) a1 = clamp01(num(o.along, 1));
    if (!(a1 > a0) || alpha <= 0 || spread <= 0) return;
    const { nx, ny } = frameOf(pts);
    const cum = cumulative(pts), L = cum[n - 1] || 1;
    // the visible stretch [a0, a1] as point indices plus exact end points
    const U = [];
    for (let i = 0; i < n; i++) U.push(cum[i] / L);
    const idx = [];
    for (let i = 0; i < n; i++) if (U[i] > a0 && U[i] < a1) idx.push(i);
    const lerpAt = (u) => {   // centre point and normal at fraction u
      let j = 0;
      while (j < n - 2 && U[j + 1] < u) j++;
      const f = U[j + 1] > U[j] ? (u - U[j]) / (U[j + 1] - U[j]) : 0;
      return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f, nx[j] + (nx[j + 1] - nx[j]) * f, ny[j] + (ny[j + 1] - ny[j]) * f];
    };
    const C = [lerpAt(a0)].concat(idx.map((i) => [pts[i][0], pts[i][1], nx[i], ny[i]]), [lerpAt(a1)]);
    const CU = [a0].concat(idx.map((i) => U[i]), [a1]);
    // the band is pinched at both ends and widest after the middle (where the logo's ribbon fans out)
    const taper = (u) => smoothstep(0, 0.14, u) * smoothstep(1, 0.88, u);
    const envelope = (u) => (0.18 + 0.82 * taper(u)) * (0.6 + 0.4 * Math.sin(Math.PI * clamp01(1.3 * u - 0.35)));
    // the band's turn about its spine: face-on in the middle at rest, edge-on near the ends; t turns it once
    const angle = (u) => TAU * (phase + t + twist * (u - 0.5));
    const lane = (k) => k / (strands - 1) - 0.5;
    const offsetOf = (k, u) => spread * envelope(u) * (lane(k) * Math.cos(angle(u)) + 0.035 * Math.sin(TAU * (1.5 * u + 0.29 * k + t)));
    const strandPts = (k) => {
      const X = [], Y = [];
      for (let i = 0; i < C.length; i++) { const off = offsetOf(k, CU[i]); X.push(C[i][0] + C[i][2] * off); Y.push(C[i][1] + C[i][3] * off); }
      return { X, Y };
    };
    const tint = (c, w) => [c[0] + (255 - c[0]) * w, c[1] + (255 - c[1]) * w, c[2] + (255 - c[2]) * w];
    // 1. the glass: one translucent fill between the two edge strands, tinted along its length
    const ea = strandPts(0), eb = strandPts(strands - 1);
    const a = C[0], b = C[C.length - 1];
    ctx.save();
    ctx.globalAlpha *= alpha * 0.22;
    let fill = css(tint(stopsAt(stops, 0.6), 0.12));
    if (ctx.createLinearGradient && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) {
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, css(tint(stopsAt(stops, a0 + ((a1 - a0) * i) / 4), 0.12)));
      fill = g;
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(ea.X[0], ea.Y[0]);
    for (let i = 1; i < ea.X.length; i++) ctx.lineTo(ea.X[i], ea.Y[i]);
    for (let i = eb.X.length - 1; i >= 0; i--) ctx.lineTo(eb.X[i], eb.Y[i]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 2. the strands: a strong violet band on one edge, paler and thinner across to a bright glass edge
    const sw = num(o.strand, spread * 0.17);
    for (let k = 0; k < strands; k++) {
      const ck = k / (strands - 1), edge = k === strands - 1;
      const { X, Y } = strandPts(k);
      const size = edge ? 0.2 : 1 - 0.6 * Math.pow(ck, 1.3);
      const widthAt = (u) => sw * size * (0.2 + 0.8 * taper(u)) * (0.45 + 0.55 * Math.abs(Math.cos(angle(u))));
      const colourAt = (u) => {
        const c = stopsAt(stops, clamp01(0.12 + 0.78 * ck + 0.2 * (u - 0.5)));
        const away = 0.5 - 0.5 * Math.cos(angle(u) + lane(k) * 1.2);   // paler where the band turns away
        return tint(c, edge ? 0.5 + 0.3 * away : 0.06 + 0.3 * away);
      };
      drawBand(ctx, X, Y, CU.slice(), widthAt, colourAt, 'round', null, alpha * (edge ? 0.85 : 0.72 - 0.3 * ck), sw);
    }
  }

  /* ------------------------------------------------------------------------------------------
   * the whole still mark
   * ---------------------------------------------------------------------------------------- */
  const markPts = new Map();
  function cachedPoints(name, n) {
    const key = name + ':' + n;
    let p = markPts.get(key);
    if (!p) { p = points(name, n); markPts.set(key, p); }
    return p;
  }
  function mark(ctx, o) {
    o = o || {};
    const pal = o.palette && typeof o.palette === 'object' ? o.palette : palette(o.palette || 'logo', o.theme);
    const k = num(o.weight, 1), n = Math.round(num(o.n, 160)), alpha = clamp01(num(o.alpha, 1));
    const draw = (c) => {
      if (o.frame) stroke(c, cachedPoints('frame', 256), { width: WIDTHS.frame * k, colours: pal.frame });
      if (o.ribbon !== false) ribbon(c, num(o.t, 0), { colours: pal.ribbon, alpha: num(o.ribbonAlpha, 1) });
      stroke(c, cachedPoints('body', n), { width: WIDTHS.body * k, colours: pal.body });
      stroke(c, cachedPoints('bar', n), { width: WIDTHS.bar * k, colours: pal.bar });
      stroke(c, cachedPoints('s', n), { width: WIDTHS.s * k, colours: pal.s });
    };
    if (alpha < 0.999) layer(ctx, { alpha }, draw); else draw(ctx);
  }

  const Marks = {
    W,
    paths: Object.freeze(Object.assign({}, PATHS)),
    widths: Object.freeze(Object.assign({}, WIDTHS)),
    anchors: freezeDeep(JSON.parse(JSON.stringify(ANCHORS))),
    points, length, resample, morph, at, transform, bbox,
    stroke, ribbon, mark, layer,
    palette, PALETTES: Object.freeze(PALETTES.slice()),
    ease: Object.freeze(ease), EASES: Object.freeze(EASES.slice()), easing,
    rng, mix, rgba, colourAt, fit,
    clamp, lerp, smoothstep
  };
  Object.freeze(Marks);

  /* ==========================================================================================
   * Motion: the family registry
   * ======================================================================================== */
  const MOMENTS = freezeDeep([
    { id: 'launch', name: 'Opening 5s', feel: 'arrival, recognition', where: 'splash', length: '1.2–2 s', loop: false },
    { id: 'load', name: 'Waiting for the deck', feel: "patience; it's alive", where: 'loading', length: 'loop', loop: true },
    { id: 'five-start', name: "Today's five begins", feel: 'readiness', where: 'Sort, first card', length: '0.6–1.2 s', loop: false },
    { id: 'keep', name: 'Keep', feel: 'a small yes, warmth', where: 'Sort, card flies right', length: '0.3–0.7 s', loop: false },
    { id: 'pass', name: 'Pass', feel: 'a light no, clean', where: 'Sort, card flies left', length: '0.3–0.7 s', loop: false },
    { id: 'undo', name: 'Undo', feel: 'taking it back', where: 'Sort', length: '0.3–0.6 s', loop: false },
    { id: 'turn', name: 'A turn', feel: 'surprise; transformation', where: 'Sort, the reveal strip', length: '1–2 s', loop: false },
    { id: 'five-done', name: 'Five sorted', feel: 'completion', where: 'Sort, the summary', length: '0.8–1.6 s', loop: false },
    { id: 'streak', name: 'Days in a row', feel: 'habit, pride', where: 'Sort, the header', length: '0.6–1.2 s', loop: false },
    { id: 'split', name: 'Parts flying to Split', feel: 'taking apart, curiosity', where: 'Sort → Split', length: '0.5–1 s', loop: false },
    { id: 'bring', name: 'Bringing in your own', feel: 'making it yours', where: 'the Bring sheet, processing', length: 'loop or 1–2 s', loop: true },
    { id: 'set-pin', name: 'Pin a set', feel: 'settling, making', where: 'Set', length: '0.6–1.2 s', loop: false },
    { id: 'tab', name: 'Moving between tabs', feel: 'orientation', where: 'the tab bar', length: '0.25–0.5 s', loop: false },
    { id: 'path', name: 'A milestone on the Path', feel: 'progress', where: 'the Path chip', length: '0.8–1.4 s', loop: false },
    { id: 'seed', name: 'Growing your ground', feel: 'creation, a world', where: 'Seed', length: '1.5–3 s', loop: false },
    { id: 'empty', name: 'Nothing here yet', feel: 'invitation', where: 'empty states', length: 'loop', loop: true }
  ]);
  const MOMENT_IDS = MOMENTS.map((m) => m.id);
  const ORDER = Object.freeze(['swipe', 'pulse', 'fill', 'negative', 'rewind', 'flip', 'draw', 'count', 'ring', 'stack', 'echo',
                               'path', 'split', 'collage', 'morph', 'three', 'pin', 'grow', 'ribbon',
                               'phases', 'stamp', 'dive', 'neon', 'tiles', 'swarm', 'cast']);
  // options every family honours; a family may re-declare one to change its default or range
  const SHARED = freezeDeep({
    palette: { default: 'logo', options: PALETTES.slice() },
    ribbon: { default: true },
    weight: { default: 0.75, min: 0.6, max: 1.4, step: 0.05 },   // the artist's standard weight (23 Oct 2026)
    intensity: { default: 0.6, min: 0, max: 1, step: 0.05 },
    easing: { default: 'outCubic', options: EASES.slice() }
  });
  const REDUCED = ['fade', 'cut', 'still'];

  const registry = new Map();
  let ordered = [];

  function fail(id, msg) { throw new Error('Motion.register(' + (id ? '"' + id + '"' : '?') + '): ' + msg); }

  function checkParam(id, key, p) {
    if (!p || typeof p !== 'object' || !('default' in p)) fail(id, 'param "' + key + '" needs {default, ...}');
    if (Array.isArray(p.options)) {
      if (!p.options.length) fail(id, 'param "' + key + '" has no options');
      if (!p.options.includes(p.default)) fail(id, 'param "' + key + '" default ' + JSON.stringify(p.default) + ' is not one of its options');
    } else if (typeof p.default === 'number') {
      for (const f of ['min', 'max', 'step']) if (typeof p[f] !== 'number' || !isFinite(p[f])) fail(id, 'param "' + key + '" needs a numeric ' + f);
      if (!(p.min <= p.max)) fail(id, 'param "' + key + '" has min > max');
      if (!(p.step > 0)) fail(id, 'param "' + key + '" needs step > 0');
      if (p.default < p.min || p.default > p.max) fail(id, 'param "' + key + '" default ' + p.default + ' is outside ' + p.min + '..' + p.max);
    } else if (typeof p.default !== 'boolean') {
      fail(id, 'param "' + key + '" must be a number (min/max/step), a boolean, or a list of options');
    }
  }

  function register(def) {
    if (!def || typeof def !== 'object') fail(null, 'needs a definition object');
    const id = def.id;
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id)) fail(id, 'id must be a lowercase slug');
    if (registry.has(id)) fail(id, 'a family with this id is already registered');
    for (const f of ['name', 'idea', 'why']) if (typeof def[f] !== 'string' || !def[f].trim()) fail(id, f + ' must be a non-empty string');
    if (!Array.isArray(def.moments) || !def.moments.length) fail(id, 'moments must be a non-empty list');
    for (const m of def.moments) if (!MOMENT_IDS.includes(m)) fail(id, 'unknown moment "' + m + '" (one of ' + MOMENT_IDS.join(', ') + ')');
    if (!Array.isArray(def.styles) || !def.styles.length) fail(id, 'styles must be a non-empty list');
    if (def.styles.some((s) => typeof s !== 'string' || !s) || new Set(def.styles).size !== def.styles.length) fail(id, 'styles must be distinct non-empty strings');
    if (!REDUCED.includes(def.reduced)) fail(id, 'reduced must be one of ' + REDUCED.join(', '));
    if (typeof def.loop !== 'boolean') fail(id, 'loop must be true or false');
    if (typeof def.draw !== 'function') fail(id, 'draw must be a function (ctx, t, p, env)');
    if (!def.params || typeof def.params !== 'object') fail(id, 'params must be an object');
    const params = {};
    for (const key of Object.keys(SHARED)) params[key] = Object.assign({}, SHARED[key], def.params[key] || {});
    for (const key of Object.keys(def.params)) if (!(key in SHARED)) params[key] = Object.assign({}, def.params[key]);
    if (!def.params.style) params.style = { default: def.styles[0], options: def.styles.slice() };
    const so = params.style.options;
    if (!Array.isArray(so) || so.length !== def.styles.length || def.styles.some((s) => !so.includes(s))) fail(id, 'params.style.options must list exactly the styles');
    if (!def.params.duration || typeof def.params.duration.default !== 'number') fail(id, 'params.duration {default, min, max, step} (ms) is required');
    for (const key of Object.keys(params)) checkParam(id, key, params[key]);
    const fam = Object.assign({}, def, { params, moments: def.moments.slice(), styles: def.styles.slice() });
    freezeDeep(fam.params); Object.freeze(fam.moments); Object.freeze(fam.styles); Object.freeze(fam);
    registry.set(id, fam);
    const rank = (f) => { const i = ORDER.indexOf(f.id); return i < 0 ? ORDER.length : i; };
    ordered = Array.from(registry.values()).map((f, i) => [f, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
    Object.freeze(ordered);
    return fam;
  }

  function get(id) { return registry.get(id) || null; }

  function defaults(id) {
    const f = get(id);
    if (!f) return null;
    const out = {};
    for (const k of Object.keys(f.params)) out[k] = f.params[k].default;
    return out;
  }

  // defaults merged with params, each value checked against its spec (numbers clamped, unknown options dropped)
  function resolve(id, params) {
    const f = get(id);
    if (!f) throw new Error('Motion: unknown family "' + id + '"');
    const out = defaults(id);
    params = params || {};
    for (const k of Object.keys(params)) {
      const spec = f.params[k], v = params[k];
      if (!spec) { out[k] = v; continue; }
      if (Array.isArray(spec.options)) { if (spec.options.includes(v)) out[k] = v; }
      else if (typeof spec.default === 'number') { const x = typeof v === 'string' ? parseFloat(v) : v; if (typeof x === 'number' && isFinite(x)) out[k] = clamp(x, spec.min, spec.max); }
      else if (typeof spec.default === 'boolean') { out[k] = v === true || v === 'true' || v === 1 || v === '1'; }
    }
    return out;
  }

  function forMoment(moment) { return ordered.filter((f) => f.moments.includes(moment)); }

  /* render one frame of a family into the box (0, 0, env.w, env.h) of ctx's current transform.
   * env: {w, h, dpr, theme, seed, direction, pad, transparent, reduced, clip}
   *   w, h      the box in the current transform's units (default: the canvas size / dpr)
   *   seed      the variant's seed: env.rng is a fresh Marks.rng(seed) on every frame, so frames repeat
   *   reduced   true: play what the family's `reduced` says instead (fade / cut / still)
   *   transparent  true: draw over what is there (no background)
   */
  function render(ctx, id, t, params, env) {
    const fam = get(id);
    if (!fam) throw new Error('Motion: unknown family "' + id + '"');
    const p = resolve(id, params);
    env = env || {};
    const dpr = num(env.dpr, 1);
    const w = num(env.w, ctx.canvas.width / dpr), h = num(env.h, ctx.canvas.height / dpr);
    const theme = env.theme === 'dark' ? 'dark' : 'light';
    const pal = palette(p.palette, theme);
    t = clamp01(num(t, 0));
    const seed = env.seed == null ? id : env.seed;
    const pad = num(env.pad, Math.round(Math.min(w, h) * 0.04));
    ctx.save();
    try {
      if (env.clip !== false) { ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); }
      if (!env.transparent) { ctx.clearRect(0, 0, w, h); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h); }
      const f = fit(ctx, w, h, pad);
      const view = { x0: -f.ox / f.scale, y0: -f.oy / f.scale, x1: (w - f.ox) / f.scale, y1: (h - f.oy) / f.scale };
      const e = Object.assign({}, env, {
        w, h, dpr, theme, palette: pal, bg: pal.bg, rng: rng(seed), seed,
        direction: env.direction === 'left' ? 'left' : 'right', size: Math.min(w, h), scale: f.scale, view, Marks
      });
      let tt = t, a = 1;
      if (env.reduced) {
        if (fam.reduced === 'still') tt = 1;
        else if (fam.reduced === 'cut') tt = t < 0.5 ? 0 : 1;
        else { tt = 1; a = ease.inOutSine(t); }
      }
      if (a > 0) {
        if (a < 1) layer(ctx, { alpha: a }, (c) => fam.draw(c, tt, p, e));
        else fam.draw(ctx, tt, p, e);
      }
    } finally {
      ctx.restore();
    }
  }

  const Motion = {
    register, get, defaults, resolve, forMoment, render,
    get families() { return ordered; },
    MOMENTS, ORDER, SHARED, REDUCED: Object.freeze(REDUCED.slice())
  };
  Object.freeze(Motion);

  root.Marks = Marks;
  root.Motion = Motion;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* 5s Motion Lab: Phases (22 Oct 2026, the hybrid of the artist's favorites).
 *
 * The mark changes form, and every stage it passes through stays behind as a trace, so the whole
 * transformation is visible at once; then the traces fold back into the finished mark. It fuses the two
 * threads in the stars: the mark seen through time (Echo Depth and Ripple, Rewind Retrace) and one shape
 * becoming another (Morph Exchange, Count Morph), on a counted beat.
 *
 * Styles (each starts and ends exactly on the still mark)
 *   chrono     Exchange stepped on the beat: the 5 and the s swing round each other and trade identities, and
 *              each stage is left behind as one of Depth's die-cut cards (the pair's silhouette on a rim of
 *              background, in a flat tone from the ribbon's violet to cobalt), pushed back up and to the right
 *              by the next. With every stage stacked behind the finished mark the change reads like a
 *              chronophotograph; then the cards slide forward into the mark, re-forming as they come, and it
 *              lands with Depth's pop. Paper and Ink: the cards are tints of the one colour.
 *   countdown  Count's morph (5, 4, 3, 2, 1, 5) with Ripple's rings: the 5 drains hollow as it becomes the 4,
 *              and every digit, as it lands, sheds an outline of itself that ripples outward and fades in the
 *              palette's ring colours, so the count's history spreads round it. Each landing fills the digit a
 *              little more; back at 5 it lands solid with Ripple's last, biggest ring, and the s (waiting as
 *              Count's ticking ball) lands last.
 *   onion      Retrace's onion skins of Merge: the mark clicks out along a short S toward env.direction, one
 *              step a beat, melting into one s as it goes, and leaves the outline of every stage in place; then
 *              it glides home through its own skins, re-forming into 5s, and each skin it passes shrinks into
 *              it.
 *
 * Params: stages (3-8: how many traces), spread (how far apart they sit), and the shared options. Intensity
 * runs wide: at 0 the gesture is small and the traces close; at 1 the swing nearly turns the pair over, the
 * cards pop with a big overshoot, the rings travel far and the S bends hard.
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const span = (t, a, b) => clamp01((t - a) / (b - a));
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };
  const hump = (x) => Math.sin(Math.PI * clamp01(x));

  // is a colour dark (relative luminance)? Colour choices follow the actual background, so the paper and
  // inverse palettes read right too
  const isDark = (hex) => {
    const h = M.mix(hex, hex, 0), r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.25;
  };
  const flatPal = (pal) => pal.name === 'paper' || pal.name === 'ink';
  const logoLike = (pal) => pal.name === 'logo' || pal.name === 'inverse' || pal.name === 'turn';
  // a hairline in mark units that stays at least about a device pixel at any size
  const hair = (env, units) => Math.max(units, 1.25 / ((env.scale || 1) * (env.dpr || 1)));
  const still = (ctx, p, env) => M.mark(ctx, { palette: env.palette, weight: p.weight, ribbon: p.ribbon });

  function about(ctx, origin, s, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(s, s);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }

  /* --- the 5 and the s, point for point (Morph's construction) ----------------------------------------
   * Traced from the bright tip of its bar the 5 is the s with corners, so the two morph point for point: the
   * 5 as one line (the bar backwards, then the body) and the s split at the same share of its length. */
  const NB = 160, NBODY = 160, N = NB + NBODY;
  const L_BAR = M.length('bar'), L_BODY = M.length('body');
  const FB = L_BAR / (L_BAR + L_BODY);
  const FIVE = M.points('bar', NB).reverse().concat(M.points('body', NBODY));
  const KB = NB - 1;
  const S_D = M.points('s', 600);
  function sub(pts, a, b, n) {   // the stretch [a, b] of a polyline as n points
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1], s0 = a * L, s1 = b * L;
    const at = (s) => {
      let j = 0;
      while (j < pts.length - 2 && cum[j + 1] < s) j++;
      const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
    };
    const out = [at(s0)];
    for (let i = 0; i < pts.length; i++) if (cum[i] > s0 && cum[i] < s1) out.push(pts[i]);
    out.push(at(s1));
    return M.resample(out, n);
  }
  const S = sub(S_D, 0, FB, NB).concat(sub(S_D, FB, 1, NBODY));
  const centre = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of pts) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  };
  const C5 = centre(FIVE), CS = centre(S), MID = [(C5[0] + CS[0]) / 2, (C5[1] + CS[1]) / 2];
  // Merge's one s: at the centre, as big as the 5
  const MERGE_SCALE = 1.62;
  const S_MID = S.map((q) => [505 + (q[0] - CS[0]) * MERGE_SCALE, 515 + (q[1] - CS[1]) * MERGE_SCALE]);

  // lerp two point lists with a lag along the line (lag(f) in [0, 1]: 0 leads); exact at m = 0 and m = 1
  function blend(a, b, m, lag, dx, dy, L) {
    const n = a.length, out = new Array(n), LAG = L == null ? 0.6 : L;
    for (let i = 0; i < n; i++) {
      const k = !lag || m <= 0 || m >= 1 ? m : clamp01(m * (1 + LAG) - LAG * lag(i / (n - 1)));
      out[i] = [a[i][0] + (b[i][0] - a[i][0]) * k + (dx || 0), a[i][1] + (b[i][1] - a[i][1]) * k + (dy || 0)];
    }
    return out;
  }

  /* --- colour: exact stretches of the logo's gradients, and mixes of two ------------------------------ */
  function stretch(colours, a, b) {
    const list = Array.isArray(colours) ? colours : [colours];
    const n = list.length, us = list.map((c, i) => (Array.isArray(c) && typeof c[0] === 'number' ? c[0] : (n === 1 ? 0 : i / (n - 1))));
    const lo = Math.min(a, b), hi = Math.max(a, b), out = [[0, M.colourAt(colours, a)], [1, M.colourAt(colours, b)]];
    for (const u of us) if (u > lo && u < hi) out.push([(u - a) / (b - a), M.colourAt(colours, u)]);
    return out.sort((x, y) => x[0] - y[0]);
  }
  function mixList(P, Q, m) {
    m = clamp01(m);
    if (m <= 0) return P;
    if (m >= 1) return Q;
    const us = Array.from(new Set(P.map((x) => x[0]).concat(Q.map((x) => x[0])))).sort((x, y) => x - y);
    return us.map((u) => [u, M.mix(M.colourAt(P, u), M.colourAt(Q, u), m)]);
  }
  const colourCache = new Map();
  function colourSets(pal) {
    const key = pal.name + ':' + pal.theme;
    let c = colourCache.get(key);
    if (!c) {
      c = { fiveBar: stretch(pal.bar, 1, 0), fiveBody: stretch(pal.body, 0, 1), sBar: stretch(pal.s, 0, FB), sBody: stretch(pal.s, FB, 1), s: stretch(pal.s, 0, 1) };
      colourCache.set(key, c);
    }
    return c;
  }

  // a 5-like glyph: the bar stretch [0, KB] and the body stretch [KB + 1, N)
  function glyph5(ctx, pts, wBar, wBody, colBar, colBody) {
    M.stroke(ctx, pts.slice(KB + 1), { width: wBody, colours: colBody });
    M.stroke(ctx, pts.slice(0, KB + 1), { width: wBar, colours: colBar });
  }

  /* ======================================================================================================
   * chrono: Exchange stepped on the beat, each stage left behind as one of Depth's die-cut cards
   * ==================================================================================================== */
  // the pair part way through Exchange (m: 0 is 5s, 1 is 5s again with the letters traded): the 5 becomes the
  // s and the s the 5 while their centres swing round their midpoint (dir: which way; I: how far)
  function pairAt(m, I, dir) {
    const ang = Math.PI * clamp01(m) * dir * (0.32 + 0.6 * I);
    const cs = Math.cos(ang), sn = Math.sin(ang), w = hump(m);
    const swing = (pts, from, to) => {
      const lx = from[0] + (to[0] - from[0]) * m, ly = from[1] + (to[1] - from[1]) * m;
      const rx = from[0] - MID[0], ry = from[1] - MID[1];
      const dx = (MID[0] + rx * cs - ry * sn - lx) * w, dy = (MID[1] + rx * sn + ry * cs - ly) * w;
      return pts.map((q) => [q[0] + dx, q[1] + dy]);
    };
    return { a: swing(blend(FIVE, S, m, (f) => 1 - f), C5, CS), b: swing(blend(S, FIVE, m, (f) => f), CS, C5), m: clamp01(m) };
  }
  const widthsA = (k, mc) => [M.lerp(M.widths.bar * k, M.widths.s * k, mc), M.lerp(M.widths.body * k, M.widths.s * k, mc)];
  const widthsB = (k, mc) => [M.lerp(M.widths.s * k, M.widths.bar * k, mc), M.lerp(M.widths.s * k, M.widths.body * k, mc)];
  // the pair in one flat colour, each stroke widened by grow on both sides (a die-cut silhouette)
  function pairFlat(ctx, P, k, grow, colour) {
    const wa = widthsA(k, P.m), wb = widthsB(k, P.m);
    glyph5(ctx, P.a, wa[0] + 2 * grow, wa[1] + 2 * grow, colour, colour);
    glyph5(ctx, P.b, wb[0] + 2 * grow, wb[1] + 2 * grow, colour, colour);
  }
  // the pair in its own colours, each letter passing its gradient to the other (Exchange's drawing order: the
  // s in front at first, the hand-over a cross-fade where the two are farthest apart)
  function pairColour(ctx, P, k, col) {
    const mc = P.m, wa = widthsA(k, mc), wb = widthsB(k, mc);
    const drawA = (c) => glyph5(c, P.a, wa[0], wa[1], mixList(col.fiveBar, col.sBar, mc), mixList(col.fiveBody, col.sBody, mc));
    const drawB = (c) => glyph5(c, P.b, wb[0], wb[1], mixList(col.sBar, col.fiveBar, mc), mixList(col.sBody, col.fiveBody, mc));
    const front = M.smoothstep(0.4, 0.6, mc);
    if (front < 0.999) drawA(ctx);
    drawB(ctx);
    if (front >= 0.999) drawA(ctx);
    else if (front > 0.001) M.layer(ctx, { alpha: front }, drawA);
  }
  // a card's tone at depth d (1 just behind the mark, n at the back): violet to cobalt, fainter further back
  function cardTone(pal, d, n, dark) {
    const u = clamp01((d - 1) / Math.max(1, n - 1));
    if (flatPal(pal)) return M.mix(pal.bg, pal.ink, M.lerp(0.74, 0.3, u));
    const stops = logoLike(pal) ? [M.colourAt(pal.ribbon, 0.15), pal.cobalt] : [M.colourAt(pal.ribbon, 0.12), M.colourAt(pal.ribbon, 0.74)];
    return M.mix(M.colourAt(stops, u), dark ? pal.bg : '#FFFFFF', 0.36 * clamp01(d / Math.max(4, n)));
  }

  function chrono(ctx, t, p, env) {
    const pal = env.palette, col = colourSets(pal), k = p.weight, I = p.intensity;
    const ease = M.easing(p.easing), dir = env.direction === 'left' ? -1 : 1;
    const n = Math.round(p.stages), dark = isDark(pal.bg);
    // n + 1 steps from 5s to 5s (each a quick move, then a hold); the stage the mark leaves on step i (i >= 1)
    // stays behind as card i and is pushed back one place on every later step
    const T0 = 0.05, T1 = 0.64, STEP = (T1 - T0) / (n + 0.7), MOVE = 0.7 * STEP;
    const FOLD = [0.69, 0.87];
    const at = (j) => span(t, T0 + j * STEP, T0 + j * STEP + MOVE);
    const push = M.ease.outBack(0.6 + 2.6 * I);
    let m = 0;
    for (let j = 0; j <= n; j++) m += ease(at(j)) / (n + 1);
    const fold = M.ease.inOutCubic(span(t, FOLD[0], FOLD[1]));
    // the cards: depth (eased, overshooting on each push), and the stack's depth so far
    const cards = [];
    for (let i = 1; i <= n; i++) {
      if (t < T0 + i * STEP) break;
      let d = 0;
      for (let j = i; j <= n; j++) d += push(at(j));
      cards.push({ i, d, m0: i / (n + 1) });
    }
    const deep = cards.length ? Math.max(0, cards[0].d) : 0;
    // the cards step back up and to the right like Depth's, by a little: the swing itself spreads the stages
    const len = (4 + 26 * p.spread) * (0.7 + 0.6 * I) * 5 / Math.max(5, n);
    const V = [len, -0.74 * len];
    const shift = [-0.5 * V[0] * deep * (1 - fold), -0.5 * V[1] * deep * (1 - fold)];
    const Ssc = 1 - (0.08 * M.smoothstep(0, 1, span(t, 0.02, T0 + STEP)) + 0.1 * clamp01(deep / n)) * (1 - fold);
    // the mark: a tick on each step, a dip as the cards fold into it, then Depth's pop
    let tick = 0;
    for (let j = 0; j <= n; j++) { const e = T0 + j * STEP + MOVE; tick = Math.max(tick, bump(t, e - 0.01, e + 0.06)); }
    const dip = 0.05 + 0.07 * I;
    const land = span(t, FOLD[1], 0.995);
    const pop = land > 0 ? 1 - dip * (1 - M.ease.outBack(1.4 + 2 * I)(land)) : 1 - dip * M.ease.inCubic(fold);
    const sc = pop * (1 + (0.015 + 0.03 * I) * tick);
    const rim = hair(env, 11 * k);

    about(ctx, A.letters, Ssc, (c) => {
      // back to front: the oldest card first; each re-forms toward the finished mark as it folds forward
      for (const card of cards) {
        const d = card.d * (1 - fold);
        const alpha = 1 - span(fold, 0.86, 1);
        if (alpha <= 0.003) continue;
        const P = pairAt(M.lerp(card.m0, 1, fold), I, dir);
        const tone = cardTone(pal, Math.max(1, card.d), n, dark);
        const draw = (cc) => { pairFlat(cc, P, k, rim, pal.bg); pairFlat(cc, P, k, 0, tone); };
        c.save();
        c.translate(shift[0] + V[0] * d, shift[1] + V[1] * d);
        if (alpha >= 0.999) draw(c); else M.layer(c, { alpha }, draw);
        c.restore();
      }
      c.save();
      c.translate(shift[0], shift[1]);
      about(c, A.letters, sc, (cm) => {
        const P = pairAt(m, I, dir);
        // its own rim of background separates it from the cards (gone once they have folded in)
        if (cards.length && fold < 1) M.layer(cm, { alpha: 1 - fold, composite: 'source-over' }, (cc) => pairFlat(cc, P, k, rim, pal.bg));
        if (p.ribbon) M.ribbon(cm, clamp01(m) * dir, { colours: pal.ribbon, alpha: 1 - 0.45 * hump(m) });
        pairColour(cm, P, k, col);
      });
      c.restore();
    });
  }

  /* ======================================================================================================
   * countdown: Count's morph, each landing digit sheds a Ripple ring of its own shape
   * ==================================================================================================== */
  const NC = 200;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 260), s: M.points('s', 180) };
  const FIVE_C = M.resample(PTS.bar.slice().reverse().concat(PTS.body), NC);
  const SHARE_BAR = L_BAR / (L_BAR + L_BODY);
  const dist = (a, b) => a.reduce((s, q, i) => s + Math.hypot(q[0] - b[i][0], q[1] - b[i][1]), 0) / a.length;
  // every digit straightens into this line on its way to the next (Count's shared lean), so no change tangles
  const LINE = M.resample([[500, 236], [330, 756]], NC);
  const LINE_R = LINE.slice().reverse();
  const lineFor = (d) => (dist(d, LINE) <= dist(d, LINE_R) ? LINE : LINE_R);
  // 5, then the last c - 1 of 4, 3, 2, 1, then 5: c changes (3: 5 2 1 5, 4: 5 3 2 1 5, 5: 5 4 3 2 1 5)
  const SEQS = new Map();
  function seqFor(c) {
    let s = SEQS.get(c);
    if (!s) {
      s = [FIVE_C];
      for (const name of ['d4', 'd3', 'd2', 'd1'].slice(5 - c)) {
        const f = M.points(name, NC), r = f.slice().reverse(), prev = s[s.length - 1];
        s.push(dist(prev, f) <= dist(prev, r) ? f : r);
      }
      s.push(FIVE_C);
      SEQS.set(c, s);
    }
    return s;
  }
  function norm(colours) {
    if (!Array.isArray(colours)) return [[0, colours], [1, colours]];
    const n = colours.length;
    return colours.map((c, i) => (Array.isArray(c) ? [c[0], c[1]] : [n === 1 ? 0 : i / (n - 1), c]));
  }
  const fiveStops = new Map();
  function stopsFive(pal) {   // the 5's own colours along FIVE_C: the bar's backwards, then the body's
    const key = pal.name + ':' + pal.theme;
    let s = fiveStops.get(key);
    if (!s) {
      s = norm(pal.bar).map(([u, c]) => [SHARE_BAR * (1 - u), c])
        .concat(norm(pal.body).map(([u, c]) => [SHARE_BAR + (1 - SHARE_BAR) * u, c]))
        .sort((x, y) => x[0] - y[0]);
      fiveStops.set(key, s);
    }
    return s;
  }
  // a digit's colours: the logo's warm fall from top to bottom, blended by w toward the 5's own (w = 1 at the 5)
  function tone(pts, w, pal, c5) {
    const out = [], n = pts.length;
    for (let j = 0; j <= 20; j++) {
      const i = Math.round((j * (n - 1)) / 20), u = i / (n - 1);
      const cy = M.colourAt(pal.five, M.clamp((pts[i][1] - 210) / 580, 0, 1));
      out.push([u, w >= 1 ? M.colourAt(c5, u) : w <= 0 ? cy : M.mix(cy, M.colourAt(c5, u), w)]);
    }
    return out;
  }
  // Ripple's ring colours
  function ringColour(pal, i) {
    if (pal.name === 'logo' || pal.name === 'inverse') return [pal.iris, pal.cobalt, pal.flare, pal.ember][i % 4];
    return M.colourAt(pal.five, 0.2 + 0.15 * (i % 5));
  }

  function countdown(ctx, t, p, env) {
    const pal = env.palette, I = p.intensity, k = p.weight, ease = M.easing(p.easing);
    const n = Math.round(p.stages), c = Math.min(5, n), seq = seqFor(c);
    const W = M.widths.body * k, WS = M.widths.s * k;
    const c5 = stopsFive(pal);
    // c changes, each a quick morph then a hold; the s lands after the last
    const T0 = 0.08, TEND = 0.66, STEP = (TEND - T0) / (c - 1 + 0.65), MLEN = 0.65 * STEP;
    const ch = (j) => [T0 + j * STEP, T0 + j * STEP + MLEN];
    const LAND = 0.84;
    let a = 0, q = 0;
    for (let j = 0; j < c; j++) { const w = ch(j); if (t >= w[0]) { a = j; q = span(t, w[0], w[1]); } }
    const counting = t > ch(0)[0] && t < ch(c - 1)[1];
    // how full the digit is: it drains hollow on the first change, then fills a step on every landing after
    let fill = 1 - ease(span(t, ch(0)[0], ch(0)[1]));
    for (let j = 1; j < c; j++) fill += ease(span(t, ch(j)[0], ch(j)[1])) / (c - 1);
    fill = clamp01(fill);

    // the ribbon turns once behind the count, dimmer while the digits are hollow (drawn
    // first: everything after it is composited through scratch layers)
    if (p.ribbon) {
      const r = M.ease.inOutSine(span(t, 0.06, 0.94));
      M.ribbon(ctx, r, { colours: pal.ribbon, alpha: (1 - 0.35 * bump(t, 0.04, 0.98)) * (0.55 + 0.45 * fill) });
    }
    // the rings: each landing digit's outline (the last, the 5 back home, bigger; with more than five stages the
    // last landing sends a burst of them), growing outward and fading
    const reach = (110 + 300 * p.spread) * (0.45 + 0.75 * I);
    const line = hair(env, 15 * k);
    const rings = [];
    for (let j = 0; j < c; j++) rings.push({ P: seq[j + 1], born: ch(j)[1] - 0.01, big: j === c - 1, i: j });
    for (let e = 0; e < n - c; e++) rings.push({ P: FIVE_C, born: ch(c - 1)[1] + 0.03 * (e + 1), big: true, i: c + e });
    const fadeAll = 1 - span(t, 0.9, 0.985);
    // newest last, so a fresh ring lies over the older ones
    for (const r of rings) {
      const life = Math.min(0.46, 0.975 - r.born);
      const age = span(t, r.born, r.born + life);
      if (age <= 0 || age >= 1) continue;
      const d = 8 + reach * (r.big ? 1.25 : 1) * M.ease.outCubic(age);
      const w = line * (1.35 - 0.75 * age);
      const al = 0.95 * Math.pow(1 - age, 1.3) * fadeAll;
      if (al < 0.01) continue;
      M.layer(ctx, { alpha: al, composite: 'source-over' }, (cc) => {
        M.stroke(cc, r.P, { width: W + 2 * (d + w / 2), colours: ringColour(pal, r.i) });
        cc.globalCompositeOperation = 'destination-out';
        M.stroke(cc, r.P, { width: Math.max(0.5, W + 2 * (d - w / 2)), colours: '#000000' });
      });
    }

    // the digit: a beat on each landing (a small gather, then a pop; the last the biggest)
    let beat = 0;
    for (let j = 0; j < c; j++) {
      const e = ch(j)[1];
      beat += bump(t, e - 0.015, e + 0.1) * (j === c - 1 ? 1.7 : 1) - 0.4 * bump(t, e - 0.06, e);
    }
    const sc = 1 + (0.025 + 0.06 * I) * beat;
    about(ctx, A.five, sc, (cx) => {
      if (!counting && fill >= 0.999) {
        M.stroke(cx, PTS.body, { width: W, colours: pal.body });
        M.stroke(cx, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
        return;
      }
      const A0 = seq[a], B0 = seq[a + 1], e = ease(q);
      const w5 = (A0 === FIVE_C ? 1 - Math.min(1, 2 * e) : 0) + (B0 === FIVE_C ? Math.max(0, 2 * e - 1) : 0);
      const pts = q <= 0 ? A0 : q >= 1 ? B0 : e < 0.5 ? M.morph(A0, lineFor(A0), e * 2) : M.morph(lineFor(B0), B0, e * 2 - 1);
      const inside = 0.15 + 0.85 * fill * fill;
      M.layer(cx, { composite: 'source-over' }, (cc) => {
        M.stroke(cc, pts, { width: W, colours: tone(pts, w5, pal, c5) });
        if (inside < 0.999) {
          cc.globalCompositeOperation = 'destination-out';
          M.stroke(cc, pts, { width: Math.max(0.5, W - 2 * line * 0.9), colours: '#000000', alpha: 1 - inside });
        }
      });
    });

    // the s: it gathers into a ball that hops once per change and lands on each, then a last long hop; it opens
    // back into the s as it lands
    const ends = [];
    for (let j = 0; j < c; j++) ends.push(ch(j)[1]);
    const hopAt = (tt) => {
      const starts = [0.03].concat(ends.slice(0, c - 1));
      for (let j = 0; j < c; j++) if (tt >= starts[j] && tt < ends[j]) { const x = (tt - starts[j]) / (ends[j] - starts[j]); return 4 * x * (1 - x) * (140 + 60 * j / Math.max(1, c - 1)) * (0.35 + I); }
      if (tt >= ends[c - 1] && tt < LAND) { const x = (tt - ends[c - 1]) / (LAND - ends[c - 1]); return 4 * x * (1 - x) * 260 * (0.35 + I); }
      return 0;
    };
    let tick = 0;
    for (const e of ends) tick = Math.max(tick, bump(t, e - 0.01, e + 0.07));
    const gather = M.ease.inOutCubic(span(t, 0, T0));
    const open = span(t, LAND - 0.06, LAND + 0.05);
    const h = hopAt(t);
    const squash = 0.14 * I * bump(t, LAND - 0.02, LAND + 0.07);
    if (gather < 1 || open > 0) {
      const g = open > 0 ? M.ease.outBack(1.8)(open) : 1 - gather;
      ctx.save();
      ctx.translate(785, 830); ctx.scale(1 + squash, 1 - squash); ctx.translate(-785, -830);
      ctx.translate(0, -h);
      const s = 0.04 + 0.96 * g, w = M.lerp(1.15 * WS, WS, g) / s;
      about(ctx, A.s, s, (cs) => M.stroke(cs, PTS.s, { width: w, colours: pal.s }));
      ctx.restore();
    } else {
      const ballR = WS * 0.5, v = Math.min(1, h / 60);
      const sx = 1 + 0.25 * I * tick - 0.08 * I * v, sy = 1 - 0.22 * I * tick + 0.12 * I * v;
      ctx.save();
      ctx.translate(785, 668 + ballR * (1 - sy) - h);
      ctx.scale(sx, sy);
      M.stroke(ctx, [[0, 0]], { width: ballR * 2 * 1.15, colours: M.colourAt(pal.s, 0.45) });
      ctx.restore();
    }
  }

  /* ======================================================================================================
   * onion: Retrace's onion skins of Merge, clicked out along a short S and gathered back in
   * ==================================================================================================== */
  // the S (as in Swipe and Rewind): offsets from rest for a gesture to the right; x mirrors for left
  function sCurve(D, depth) {
    const P = [[0, 0], [0.28 * D, 0.95 * depth], [0.5 * D, -0.6 * depth], [D, -0.9 * depth]];
    const out = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, v = 1 - u;
      out.push([v * v * v * P[0][0] + 3 * v * v * u * P[1][0] + 3 * v * u * u * P[2][0] + u * u * u * P[3][0],
                v * v * v * P[0][1] + 3 * v * v * u * P[1][1] + 3 * v * u * u * P[2][1] + u * u * u * P[3][1]]);
    }
    return M.resample(out, 65);
  }
  // pose on the S at q (q < 0: past rest along the first tangent, for an overshoot home)
  function poseAt(curve, q, dir, I) {
    let x, y, ang;
    if (q >= 0) { const a = M.at(curve, Math.min(1, q)); x = a.x; y = a.y; ang = a.angle; }
    else { const a = M.at(curve, 0), L = Math.hypot(curve[64][0], curve[64][1]); x = Math.cos(a.angle) * q * L; y = Math.sin(a.angle) * q * L; ang = a.angle; }
    const lift = M.smoothstep(0.1, 0.9, Math.abs(q)) * Math.sign(q);
    return { x: dir * x, y, r: dir * ((0.05 + 0.2 * I) * lift + 0.3 * ang * M.smoothstep(0, 0.4, Math.abs(q)) * Math.sign(q)), k: 1 - 0.08 * Math.max(0, lift) };
  }
  function place(ctx, P, draw) {
    const C = A.letters;
    ctx.save();
    ctx.translate(C[0] + P.x, C[1] + P.y);
    if (P.r) ctx.rotate(P.r);
    if (P.k !== 1) ctx.scale(P.k, P.k);
    ctx.translate(-C[0], -C[1]);
    draw(ctx);
    ctx.restore();
  }
  // Merge's shapes at m: the 5 melting into one s at the centre (its bowl leading), the s growing into it on an arc
  function mergeAt(m, I, dir) {
    const arc = 90 * (0.4 + I) * hump(m);
    return {
      five: blend(FIVE, S_MID, m, (f) => 1 - f, 0, 0, 0.25),
      s: blend(S, S_MID, m, null, -arc * 0.35 * dir, -arc),
      m: clamp01(m)
    };
  }
  // draw Merge's pair: grow widens every stroke (negative narrows), solid: one colour for all
  // (tint, tk: pull every colour toward one colour by tk)
  const toward = (list, c, tk) => (!c || tk <= 0.001 ? list : mixList(list, [[0, c], [1, c]], tk));
  function mergeDraw(ctx, G, k, col, grow, solid, tint, tk) {
    const wMid = 128 * k, mc = G.m;
    const g2 = 2 * (grow || 0);
    glyph5(ctx, G.five, Math.max(0.5, M.lerp(M.widths.bar * k, wMid, mc) + g2), Math.max(0.5, M.lerp(M.widths.body * k, wMid, mc) + g2),
      solid || toward(mixList(col.fiveBar, col.sBar, mc), tint, tk), solid || toward(mixList(col.fiveBody, col.sBody, mc), tint, tk));
    M.stroke(ctx, G.s, { width: Math.max(0.5, M.lerp(M.widths.s * k, wMid, mc) + g2), colours: solid || toward(col.s, tint, tk) });
  }

  function onion(ctx, t, p, env) {
    const pal = env.palette, col = colourSets(pal), k = p.weight, I = p.intensity;
    const ease = M.easing(p.easing), dir = env.direction === 'left' ? -1 : 1;
    const n = Math.round(p.stages);
    const vw = env.view.x1 - env.view.x0;
    const curve = sCurve((0.12 + 0.16 * p.spread) * vw * (0.85 + 0.3 * I), 50 + 130 * I);
    // out: n clicks along the S (each a quick move, then a hold), melting a step each; a hang at the far end;
    // home: one glide with the chosen easing
    const T0 = 0.04, T1 = 0.5, STEP = (T1 - T0) / (n - 1 + 0.6), MOVE = 0.6 * STEP;
    const BACK = [0.57, 0.86];
    let qOut = 0;
    for (let j = 0; j < n; j++) qOut += ease(span(t, T0 + j * STEP, T0 + j * STEP + MOVE)) / n;
    const back = span(t, BACK[0], BACK[1]);
    const q = t < BACK[0] ? qOut : 1 - ease(back);
    const m = clamp01(q);
    // the hang: the merged s swells a little, a held breath
    const hang = 1 + (0.02 + 0.05 * I) * bump(t, T1 - 0.02, BACK[0] + 0.04);
    // and a tick as each click lands
    let tick = 0;
    for (let j = 0; j < n; j++) { const e = T0 + j * STEP + MOVE; tick = Math.max(tick, bump(t, e - 0.01, e + 0.06)); }
    const live = poseAt(curve, q, dir, I);
    live.k *= hang * (1 + (0.015 + 0.035 * I) * tick);
    // the skins are coloured by age, like a long exposure: the oldest in the ribbon's violet, the newest in the
    // letters' own colours (one colour in the flat palettes, where age shows as paleness alone)
    const tint = flatPal(pal) ? null : M.colourAt(pal.ribbon, logoLike(pal) ? 0.25 : 0.2);
    // when the glide home passes stage j (q = j / n), by the chosen easing: the first time 1 - ease(x) <= j / n
    const passAt = (qj) => {
      let lo = 0, hi = 1;
      if (1 - ease(1) > qj) return BACK[1];
      for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (1 - ease(mid) <= qj) hi = mid; else lo = mid; }
      return M.lerp(BACK[0], BACK[1], hi);
    };
    // the skins: the stage the mark leaves on each click, older ones paler; each, once the mark has passed back
    // through it, shrinks into the mark
    for (let j = 0; j < n; j++) {
      const born = T0 + j * STEP;
      if (t < born) break;
      const qj = j / n;
      const grab = M.ease.inOutCubic(span(t, passAt(qj) - 0.01, passAt(qj) + 0.11));
      const al = (0.32 + 0.5 * (j + 1) / n) * (1 - grab) * M.clamp((t - born) / (0.3 * MOVE), 0, 1);
      if (al < 0.01) continue;
      const P0 = poseAt(curve, qj, dir, I);
      const P = { x: M.lerp(P0.x, live.x, grab), y: M.lerp(P0.y, live.y, grab), r: M.lerp(P0.r, live.r, grab), k: M.lerp(P0.k, live.k, grab) * (1 - 0.3 * grab) };
      const G = mergeAt(M.lerp(qj, m, grab), I, dir);
      const line = hair(env, (8 + 8 * (j + 1) / n) * k);   // older skins finer as well as paler
      M.layer(ctx, { alpha: al, composite: 'source-over' }, (c) => {
        place(c, P, (cc) => {
          mergeDraw(cc, G, k, col, 0, null, tint, 0.9 * (1 - j / Math.max(1, n - 1)));
          cc.globalCompositeOperation = 'destination-out';
          mergeDraw(cc, G, k, col, -line / P.k, '#000000');
        });
      });
    }
    // the mark
    const G = mergeAt(q, I, dir);
    place(ctx, live, (c) => {
      if (p.ribbon) {
        const g = m, bx = A.bowl[0], by = A.bowl[1], s = 1 - 0.12 * g * (0.5 + I);
        c.save();
        c.translate(bx + 70 * g, by - 20 * g); c.scale(s, s); c.translate(-bx, -by);
        M.ribbon(c, 0.18 * g * (0.4 + I) * dir, { colours: pal.ribbon, alpha: 1 - 0.35 * g });
        c.restore();
      }
      mergeDraw(c, G, k, col, 0);
    });
  }

  Motion.register({
    id: 'phases',
    name: 'Phases',
    idea: 'The mark changes form and every stage it passes through stays behind as a trace, so the whole transformation is visible at once; then the traces fold back into the finished mark.',
    why: 'A turn is a change you can see: the moment a pattern breaks, every step of it stays in view for a beat, then it settles into the mark you know. Familiar, and new.',
    moments: ['turn', 'five-done', 'tab', 'undo', 'streak'],
    styles: ['chrono', 'countdown', 'onion'],
    params: {
      duration: { default: 900, min: 250, max: 3000, step: 10 },
      style: { default: 'chrono', options: ['chrono', 'countdown', 'onion'] },
      stages: { default: 5, min: 3, max: 8, step: 1 },              // how many traces are left
      spread: { default: 0.5, min: 0, max: 1, step: 0.05 }           // how far apart they sit
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      if (t <= 0 || t >= 1) { still(ctx, p, env); return; }
      if (p.style === 'countdown') countdown(ctx, t, p, env);
      else if (p.style === 'onion') onion(ctx, t, p, env);
      else chrono(ctx, t, p, env);
    }
  });
})();

/* 5s Motion Lab: Draw (Time & structure).
 *
 * The mark is written: the 5 in one stroke, then the s, and the ribbon after. Arrival is a hand making
 * the mark, so the pen behaves like one: it touches down, runs fast on the straights and slows into the
 * turns (its speed is weighted by the curvature of the route), carries a small light at its tip, and the
 * s starts before the 5 is quite finished (overlap). Every style ends on the still logo, crisp and centred.
 *
 * Styles
 *   one-stroke     the 5 as one line: in at the bar's bright tip, left along the bar, down the stem, round the
 *                  bowl and out at the terminal; then the s from its top; then the ribbon sweeps in under them
 *   hand           the order a hand writes a 5: stem and bowl first, the pen lifts and flicks the bar across
 *                  last; then the s; then the ribbon
 *   ribbon-first   the ribbon sweeps in first and the letters grow back along its route: the 5 from its
 *                  terminal round the bowl, up the stem and out along the bar; the s from its tail up
 *   sketch         a quick ink underdrawing of the centrelines, then colour floods along each line from thin to
 *                  full weight (the artist: "don't try to draw every line perfectly the first time")
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;

  /* --- geometry, computed once ------------------------------------------------------------------- */
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 260), s: M.points('s', 180) };
  // the 5 as one continuous line: the bar backwards (tip to corner), then the body (stem, bowl, terminal)
  const FIVE = M.resample(PTS.bar.slice().reverse().concat(PTS.body), 360);
  const L_BAR = M.length('bar'), L_BODY = M.length('body');
  const SHARE_BAR = L_BAR / (L_BAR + L_BODY);
  const RIB = M.points('ribbon', 320);

  // cumulative arc length of a polyline (fractions 0..1)
  function arcU(pts) {
    const u = [0];
    for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = u[u.length - 1] || 1;
    return u.map((x) => x / L);
  }

  // a pen's timing along a route: time spent per unit length grows with how sharply the route turns there
  // (turning smoothed over a window, so corners slow the pen without a stall). Returns f -> u, both 0..1.
  function penTiming(pts, turnCost) {
    const n = pts.length, u = arcU(pts);
    const turn = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      const b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
      let d = b - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      turn[i] = Math.abs(d);
    }
    const R = 9, sm = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, w = 0;
      for (let k = -R; k <= R; k++) { const j = i + k; if (j < 0 || j >= n) continue; const g = Math.exp(-(k * k) / (2 * 16)); s += turn[j] * g; w += g; }
      sm[i] = s / w;
    }
    const cost = [0];
    for (let i = 1; i < n; i++) cost.push(cost[i - 1] + (u[i] - u[i - 1]) + turnCost * sm[i]);
    const C = cost[n - 1];
    for (let i = 0; i < n; i++) cost[i] /= C;
    return (f) => {
      f = M.clamp(f, 0, 1);
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cost[mid] <= f) lo = mid; else hi = mid; }
      const span = cost[hi] - cost[lo];
      return M.lerp(u[lo], u[hi], span > 0 ? (f - cost[lo]) / span : 0);
    };
  }
  // the turn cost is the extra time per radian turned, as a share of the route's length: at the default
  // intensity the pen goes round the bowl about 1.5x slower than down the stem, and eases through the corner
  const TIMING = {};
  function timing(name, pts, I) {
    const key = name + ':' + Math.round(I * 20);
    if (!TIMING[key]) TIMING[key] = penTiming(pts, 0.025 + 0.055 * I);
    return TIMING[key];
  }

  // the first `a` of a polyline (by length), resampled to n points
  function head(pts, a, n) {
    const u = arcU(pts), out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (u[i] <= a) { out.push(pts[i]); continue; }
      const f = (a - u[i - 1]) / (u[i] - u[i - 1] || 1);
      out.push([M.lerp(pts[i - 1][0], pts[i][0], f), M.lerp(pts[i - 1][1], pts[i][1], f)]);
      break;
    }
    return M.resample(out, n);
  }

  /* --- colour ------------------------------------------------------------------------------------- */
  // colours in any of Marks' forms -> positioned stops [[u, hex], ...]
  function norm(colours) {
    if (!Array.isArray(colours)) return [[0, colours], [1, colours]];
    const n = colours.length;
    return colours.map((c, i) => (Array.isArray(c) ? [c[0], c[1]] : [n === 1 ? 0 : i / (n - 1), c]));
  }
  const fiveStops = new Map();
  // the 5's stops along FIVE: the bar's own colours backwards, then the body's
  function stopsFive(pal) {
    const key = pal.name + ':' + pal.theme;
    let s = fiveStops.get(key);
    if (!s) {
      s = norm(pal.bar).map(([u, c]) => [SHARE_BAR * (1 - u), c])
        .concat(norm(pal.body).map(([u, c]) => [SHARE_BAR + (1 - SHARE_BAR) * u, c]))
        .sort((a, b) => a[0] - b[0]);
      fiveStops.set(key, s);
    }
    return s;
  }
  /* --- drawing helpers ---------------------------------------------------------------------------- */
  function about(ctx, origin, scale, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(scale, scale);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }

  // a written stroke: from `a` to `b` of pts, with the pen's tip at `tip` (a or b) carrying a light while `on`
  // (glow.swell: the pen touching down, a width factor that rises from 0 with a little overshoot)
  function written(ctx, pts, colours, width, a, b, tip, glow, I, lightOnly) {
    if (!(glow.swell > 0)) return;
    width *= glow.swell;
    if (b <= a + 1e-4) {   // not moved yet: a dot
      if (lightOnly) return;
      const p = M.at(pts, tip);
      M.stroke(ctx, [[p.x, p.y]], { width, colours: M.colourAt(colours, tip) });
      return;
    }
    if (!lightOnly) M.stroke(ctx, pts, { width, from: a, to: b, colours });
    if (glow.on > 0.002) {
      // the light: a narrower core inside the stroke, from nothing behind the tip to bright at it, like a
      // highlight on wet paint travelling with the pen
      const h = 0.06 + 0.04 * I, dir = tip >= b - 1e-6 ? -1 : 1;
      const from = dir < 0 ? Math.max(a, tip - h) : tip, to = dir < 0 ? tip : Math.min(b, tip + h);
      if (to > from + 1e-4) {
        const out = [];
        for (let i = 0; i <= 8; i++) {
          const u = M.lerp(from, to, i / 8), x = dir < 0 ? (u - from) / (to - from) : (to - u) / (to - from);
          out.push([u, M.mix(M.colourAt(colours, u), glow.light, glow.on * x * x)]);
        }
        M.stroke(ctx, pts, { width: width * 0.42, from, to, colours: out });
      }
    }
  }

  // a stroke whose width varies along it (width(u) in mark units), drawn as short round-capped pieces:
  // the full-width stretch [0, full] in one Marks.stroke, the rest piece by piece
  function swelling(ctx, pts, colours, widthAt, full, end) {
    if (full > 0.001) M.stroke(ctx, pts, { width: widthAt(0), from: 0, to: Math.min(full, end), colours });
    if (end <= full) return;
    const u = arcU(pts), n = pts.length;
    ctx.save();
    ctx.lineCap = 'round';
    let i = 0;
    while (i < n - 1 && u[i + 1] <= full) i++;
    for (; i < n - 1 && u[i] < end; i++) {
      const um = (u[i] + u[i + 1]) / 2, w = widthAt(um);
      if (w <= 0.5) continue;
      ctx.strokeStyle = M.colourAt(colours, um);
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the 5 in the Iterations look, FIVE's [a, b] (the pen's tip at `tip`): the bar's stretch on the bar (it runs
  // backwards), the body's on the body, both arrays straight from Marks.points, so the engine draws them as the sheet's
  // letters at their landed weight; the pen's light on whichever letter the tip is in
  function lookFive(c, pal, W5, WB, a, b, tip, g, I) {
    const sw = g.swell == null ? 1 : g.swell;
    if (!(sw > 0)) return;
    const blo = Math.max(a, 0), bhi = Math.min(b, SHARE_BAR);
    if (bhi > blo + 1e-4) M.stroke(c, PTS.bar, { width: WB * sw, colours: pal.bar, from: 1 - bhi / SHARE_BAR, to: 1 - blo / SHARE_BAR });
    const lo = Math.max(a, SHARE_BAR), hi = Math.min(b, 1), toB = (x) => (x - SHARE_BAR) / (1 - SHARE_BAR);
    if (hi > lo + 1e-4) M.stroke(c, PTS.body, { width: W5 * sw, colours: pal.body, from: toB(lo), to: toB(hi) });
    if (!(g.on > 0.002)) return;
    if (tip < SHARE_BAR) written(c, PTS.bar, pal.bar, WB, 1 - bhi / SHARE_BAR, 1 - blo / SHARE_BAR, 1 - tip / SHARE_BAR, g, I, true);
    else written(c, PTS.body, pal.body, W5, toB(lo), toB(hi), toB(tip), g, I, true);
  }

  // window of t -> 0..1
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  // a soft rise and fall inside [a, b] (0 outside): for lights and settles
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };

  function ribbonIn(ctx, a, turn, pal, alpha) {
    if (a <= 0.004) return;
    if (a >= 0.999) { M.ribbon(ctx, turn, { colours: pal.ribbon, alpha }); return; }
    // the ribbon grows along its own route, pinched at both ends as it comes, so it is always a whole ribbon
    M.ribbon(ctx, turn, { colours: pal.ribbon, alpha, pts: head(RIB, a, 200), width: M.widths.ribbon * (0.55 + 0.45 * a) });
  }

  Motion.register({
    id: 'draw',
    name: 'Draw',
    idea: 'The mark is written: the 5 in one stroke, then the s, and the ribbon sweeps in after them.',
    why: 'Arrival: the mark comes into being the way a hand would make it, the first gesture of a habit you make yourself.',
    moments: ['launch', 'five-start'],
    styles: ['one-stroke', 'hand', 'ribbon-first', 'sketch'],
    params: {
      duration: { default: 1200, min: 600, max: 4000, step: 50 },   // 1.2 s: inside both launch (1.2-2 s) and five-start (0.6-1.2 s)
      style: { default: 'one-stroke', options: ['one-stroke', 'hand', 'ribbon-first', 'sketch'] },
      overlap: { default: 0.5, min: 0, max: 1, step: 0.05 },     // how early the s (and ribbon) start while the 5 is still being written
      pen: { default: true },                                     // the light at the pen's tip
      easing: { default: 'inOutSine', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, k = p.weight;
      const ov = p.overlap;
      const W5 = M.widths.body * k, WB = M.widths.bar * k, WS = M.widths.s * k;
      const c5 = stopsFive(pal);
      const light = env.theme === 'dark' ? '#FFFFFF' : '#FFF3DA';
      const glowK = p.pen ? 0.35 + 0.5 * I : 0;
      const T5 = timing('five', FIVE, I), TS = timing('s', PTS.s, I), TB = timing('body', PTS.body, I);

      // the settle: a small breath of scale once everything has landed (follow-through), back to exactly 1
      const settle = 1 + 0.03 * I * bump(t, 0.8, 1);

      if (p.style === 'sketch') {
        // 1. the underdrawing: a thin ink line runs the 5 then the s, fast
        const sk5 = ease(span(t, 0, 0.3)), skS = ease(span(t, 0.16 + 0.08 * (1 - ov), 0.42));
        const inkA = 0.6 * (1 - span(t, 0.62, 0.95));
        // 2. the flood: colour runs along each line from thin to full weight
        const q5 = ease(span(t, 0.26, 0.78)), qS = ease(span(t, 0.4 + 0.1 * (1 - ov), 0.9));
        const rib = ease(span(t, 0.6, 0.98));
        about(ctx, A.letters, settle, (c) => {
          if (p.ribbon && rib > 0) M.ribbon(c, 0.18 * I * (1 - rib), { colours: pal.ribbon, alpha: rib });
          const flood = (pts, colours, W, q, wave) => {
            // width along the line: full behind the flood's front, thinning to the sketch line ahead of it
            // (W: a number, or a function of u: the 5's bar is a little heavier than its body)
            const front = q * (1 + wave);
            const full = typeof W === 'function' ? W : () => W;
            const widthAt = (u) => {
              const x = M.clamp((front - u) / wave, 0, 1);
              return M.lerp(10 * k, full(u), M.ease.inOutSine(x));
            };
            swelling(c, pts, colours, widthAt, Math.max(0, front - wave), M.clamp(front, 0, 1));
          };
          if (inkA > 0.01) {
            M.stroke(c, FIVE, { width: 10 * k, to: T5(sk5), colours: pal.ink, alpha: inkA });
            M.stroke(c, PTS.s, { width: 10 * k, to: TS(skS), colours: pal.ink, alpha: inkA });
          }
          // the 5's bar and body flood as the one line FIVE (bar backwards) so the flood runs like the pen did
          // (the Iterations look: along the sheet's own letters at their landed weight, so nothing changes when they land)
          if (q5 > 0 && q5 < 1) {
            if (pal.look) lookFive(c, pal, W5, WB, 0, q5, q5, { on: 0, swell: 1 }, I);
            else flood(FIVE, c5, (u) => M.lerp(WB, W5, M.smoothstep(SHARE_BAR - 0.02, SHARE_BAR + 0.02, u)), q5, 0.28);
          }
          if (qS > 0 && qS < 1) {
            if (pal.look) M.stroke(c, PTS.s, { width: WS, colours: pal.s, to: qS });
            else flood(PTS.s, pal.s, WS, qS, 0.35);
          }
          if (q5 >= 1) {   // landed: the real strokes, so the bar keeps its own weight and the rest pose is exact
            M.stroke(c, PTS.body, { width: W5, colours: pal.body });
            M.stroke(c, PTS.bar, { width: WB, colours: pal.bar });
          }
          if (qS >= 1) M.stroke(c, PTS.s, { width: WS, colours: pal.s });
        });
        return;
      }

      // timelines (fractions of t) per style: [start, end] for the 5 (or its parts), the s and the ribbon
      let five, bodyW, barW, sW, ribW, reverse = false;
      const late = 0.12 * (1 - ov);   // less overlap: the s and the ribbon wait longer
      if (p.style === 'hand') {
        bodyW = [0, 0.4]; barW = [0.34 + late * 0.5, 0.54 + late * 0.5]; sW = [0.44 + late, 0.8]; ribW = [0.56 + late, 0.96];
      } else if (p.style === 'ribbon-first') {
        ribW = [0, 0.5]; five = [0.18 + late * 0.5, 0.74]; sW = [0.34 + late, 0.86]; reverse = true;
      } else {   // one-stroke
        five = [0, 0.56]; sW = [0.38 + late, 0.8]; ribW = [0.5 + late, 0.96];
      }
      const dot = (x) => (x <= 0 ? 0 : M.ease.outBack(1.6)(M.clamp(x / 0.08, 0, 1)));

      about(ctx, A.letters, settle, (c) => {
        // the ribbon (behind the letters): it arrives turning and settles flat
        if (p.ribbon) {
          const r = ease(span(t, ribW[0], ribW[1]));
          ribbonIn(c, r, -0.06 * I * (1 - r), pal, 1);
        }
        if (p.style === 'hand') {
          // stem and bowl, then the bar flicked across left to right (faster, out-eased: a flick)
          const fb = span(t, bodyW[0], bodyW[1]), ub = TB(ease(fb));
          const fr = span(t, barW[0], barW[1]), ur = M.ease.outCubic(fr);
          written(c, PTS.body, pal.body, W5, 0, ub, ub, { on: glowK * (1 - span(fb, 0.85, 1)), light, swell: dot(fb) }, I);
          written(c, PTS.bar, pal.bar, WB, 0, ur, ur, { on: glowK * (1 - span(fr, 0.7, 1)), light, swell: dot(fr) }, I);
        } else {
          const f5 = span(t, five[0], five[1]), u5 = T5(ease(f5));
          const on = glowK * (1 - span(f5, 0.85, 1));
          if (f5 < 1) {
            const g = { on, light, swell: dot(f5) };
            // the bar's stretch of the line is drawn with the bar's own (heavier) stroke, so nothing changes
            // when the real strokes take over; the pen's light is drawn last, over it
            const barPart = (a, b) => {   // FIVE's [a, b] inside the bar, in the bar's own u (it runs backwards)
              const lo = Math.max(a, 0), hi = Math.min(b, SHARE_BAR);
              if (hi > lo + 1e-4) M.stroke(c, PTS.bar, { width: WB * g.swell, colours: pal.bar, from: 1 - hi / SHARE_BAR, to: 1 - lo / SHARE_BAR });
            };
            if (pal.look) {
              // the Iterations look: the bar and the body are the sheet's own letters from the first frame, at the
              // landed weight, so the 5 never changes shape or weight when it lands (the artist, 23 Oct 2026)
              const a = reverse ? 1 - u5 : 0, b = reverse ? 1 : u5, tip = reverse ? 1 - u5 : u5;
              lookFive(c, pal, W5, WB, a, b, tip, g, I);
            } else if (reverse) { written(c, FIVE, c5, W5, 1 - u5, 1, 1 - u5, Object.assign({}, g, { on: 0 }), I); barPart(1 - u5, 1); written(c, FIVE, c5, W5, 1 - u5, 1, 1 - u5, g, I, true); }
            else { written(c, FIVE, c5, W5, 0, u5, u5, Object.assign({}, g, { on: 0 }), I); barPart(0, u5); written(c, FIVE, c5, W5, 0, u5, u5, g, I, true); }
          } else {   // landed: the real strokes (the bar keeps its own weight and colours)
            M.stroke(c, PTS.body, { width: W5, colours: pal.body });
            M.stroke(c, PTS.bar, { width: WB, colours: pal.bar });
          }
        }
        // the s
        const fs = span(t, sW[0], sW[1]), us = TS(ease(fs));
        if (fs > 0) {
          const g = { on: glowK * (1 - span(fs, 0.85, 1)), light, swell: dot(fs) };
          if (reverse) written(c, PTS.s, pal.s, WS, 1 - us, 1, 1 - us, g, I);
          else written(c, PTS.s, pal.s, WS, 0, us, us, g, I);
        }
      });
    }
  });
})();

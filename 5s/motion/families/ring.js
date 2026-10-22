/* 5s Motion Lab: Ring (Time & structure).
 *
 * The bowl of the 5 is already most of a circle. Here it opens out into the app's five-second ring (the soft
 * ring that fills while a person judges a card), the ring closes, and it folds back into the bowl; the s
 * waits in the ring's centre like the "5 s" label of the timer, and drops back into its nest as the 5 comes
 * back. The frame at t = 0 and t = 1 is the still mark, so it also loops without a seam (for load).
 *
 * Styles
 *   open    the bowl opens into one ring, a light runs once round it as its gap closes (the five seconds),
 *           then it folds back into the bowl
 *   tick    the ring opens as five arcs, one per card in a five; they light one by one, join, and fold back
 *   orbit   the 5 stays; the s leaves the bowl and travels once round the mark, the ring filling behind it like
 *           the timer, then drops back in and the ring lets go
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const N = 180;

  /* --- geometry ---------------------------------------------------------------------------------- */
  const BODY = M.points('body', 600);
  let footI = 0;
  for (let i = 0; i < 300; i++) if (BODY[i][0] < BODY[footI][0]) footI = i;
  const U_FOOT = footI / (BODY.length - 1);
  const STEM = M.resample(BODY.slice(0, footI + 1), 60);           // the stem, top to foot
  const BOWL = M.resample(BODY.slice(footI), N);                   // the bowl, foot to terminal
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 260), s: M.points('s', 180) };
  // the bowl is nearly a circle: centre (340, 589), radius 186, from -151 deg clockwise to 139 deg
  const BOWL_A0 = -151 * DEG, BOWL_SPAN = 290 * DEG;
  const RING = { c: [500, 500], r: 330 };   // the five-second ring, centred in the square

  function arc(c, r, a0, sweep, n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) { const a = a0 + (sweep * i) / (n - 1); out[i] = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; }
    return out;
  }
  // a piece [u0, u1] of a polyline, resampled to n points
  function piece(pts, u0, u1, n) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1], out = [];
    const at = (s) => {
      let j = 0;
      while (j < pts.length - 2 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      return [M.lerp(pts[j][0], pts[j + 1][0], f), M.lerp(pts[j][1], pts[j + 1][1], f)];
    };
    for (let i = 0; i < n; i++) out.push(at(L * (u0 + ((u1 - u0) * i) / (n - 1))));
    return out;
  }
  const FIFTHS = [0, 1, 2, 3, 4].map((i) => piece(BOWL, i / 5, (i + 1) / 5, 40));

  /* --- colour ------------------------------------------------------------------------------------- */
  function norm(colours) {
    if (!Array.isArray(colours)) return [[0, colours], [1, colours]];
    const n = colours.length;
    return colours.map((c, i) => (Array.isArray(c) ? [c[0], c[1]] : [n === 1 ? 0 : i / (n - 1), c]));
  }
  const cache = new Map();
  // the bowl's own colours (the body's stops from the foot on), as stops over the bowl alone
  function bowlStops(pal) {
    const key = pal.name + ':' + pal.theme;
    let s = cache.get(key);
    if (!s) {
      const st = norm(pal.body);
      s = [[0, M.colourAt(pal.body, U_FOOT)]];
      for (const [u, c] of st) if (u > U_FOOT) s.push([(u - U_FOOT) / (1 - U_FOOT), c]);
      cache.set(key, s);
    }
    return s;
  }
  const sub = (stops, u0, u1) => {   // the stops of [u0, u1] of a gradient, as their own 0..1
    const out = [];
    for (let i = 0; i <= 6; i++) out.push([i / 6, M.colourAt(stops, M.lerp(u0, u1, i / 6))]);
    return out;
  };

  /* --- helpers ------------------------------------------------------------------------------------ */
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };
  function about(ctx, origin, s, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(s, s);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }
  // a light running along a stroke: a narrower core inside it whose colours rise to `light` in a smooth bump
  // around u = c and fall back to the stroke's own at both ends (so it has no edge), like a highlight on glass
  function glint(ctx, pts, colours, width, c, h, light, k) {
    const a = Math.max(0, c - h), b = Math.min(1, c + h);
    if (b <= a + 1e-4 || k <= 0) return;
    const stops = [];
    for (let i = 0; i <= 12; i++) {
      const u = M.lerp(a, b, i / 12), d = (u - c) / h, w = Math.abs(d) >= 1 ? 0 : Math.cos((Math.PI / 2) * d) ** 2;
      stops.push([u, M.mix(M.colourAt(colours, u), light, k * w)]);
    }
    M.stroke(ctx, pts, { width: width * 0.45, from: a, to: b, colours: stops });
  }

  // the s at a place and size (its own centre moved to `at`), with an optional squash about its foot
  function sAt(ctx, pal, w, at, scale, squash) {
    ctx.save();
    ctx.translate(at[0], at[1]);
    if (squash) { ctx.translate(0, 160 * scale); ctx.scale(1 + squash, 1 - squash); ctx.translate(0, -160 * scale); }
    ctx.scale(scale, scale);
    ctx.translate(-A.s[0], -A.s[1]);
    M.stroke(ctx, PTS.s, { width: w, colours: pal.s });
    ctx.restore();
  }

  // the 5's stem retracting into the foot, and its bar into the stem's top (r: 0 whole .. 1 gone), the foot
  // moved by `off` (it rides the start of the ring)
  function stem(ctx, pal, k, r, off) {
    if (r >= 1) return;
    ctx.save();
    ctx.translate(off[0], off[1]);
    M.stroke(ctx, STEM, { width: M.widths.body * k, colours: sub(pal.body, 0, U_FOOT), from: r, to: 1 });
    ctx.restore();
  }
  function bar(ctx, pal, k, rStem, rBar, off) {
    if (rBar >= 1) return;
    ctx.save();
    // the bar's left end stays on the stem's (retracting) top
    const top = M.at(STEM, rStem), dx = top.x - STEM[0][0], dy = top.y - STEM[0][1];
    ctx.translate(off[0] + dx, off[1] + dy);
    M.stroke(ctx, PTS.bar, { width: M.widths.bar * k, colours: pal.bar, from: 0, to: 1 - rBar });
    ctx.restore();
  }

  Motion.register({
    id: 'ring',
    name: 'Ring',
    idea: 'The bowl of the 5 opens into the five-second ring, the ring closes, and it folds back into the bowl as the s drops into its place.',
    why: 'Five seconds a judgment: the timer every card is judged in is already inside the 5, ready to start.',
    moments: ['five-start', 'load'],
    styles: ['open', 'tick', 'orbit'],
    params: {
      duration: { default: 1200, min: 600, max: 6000, step: 100 },
      style: { default: 'open', options: ['open', 'tick', 'orbit'] },
      size: { default: 0.66, min: 0.45, max: 0.8, step: 0.01 },       // the ring's diameter as a share of the square
      thin: { default: 0.55, min: 0.3, max: 1, step: 0.05 },          // the ring's weight against the bowl's
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, k = p.weight;
      const W = M.widths.body * k, WS = M.widths.s * k;
      const bs = bowlStops(pal);
      const light = env.theme === 'dark' ? '#FFFFFF' : '#FFF6E0';
      const R = RING.r * (p.size / 0.66), C = RING.c;
      const a0 = BOWL_A0;
      const wRing = W * p.thin;

      if (p.style === 'orbit') {
        // the 5 steps back into the middle of the ring (smaller, centred) and the s leaves its nest, goes once
        // round the ring like a second hand, the ring filling behind it, then comes home as the 5 steps forward
        const out = ease(span(t, 0.05, 0.25)), round = span(t, 0.16, 0.8), back = ease(span(t, 0.74, 0.94));
        const away = out * (1 - back);
        const lap = M.ease.inOutSine(round);
        const Ro = R + 40;
        const s5 = M.lerp(1, 0.7, away);
        const c5 = [M.lerp(A.five[0], C[0], away), M.lerp(A.five[1], C[1], away)];
        // the s: from its nest out to the ring, round once (starting where it sits, at about 4 o'clock), home
        const home = A.s, sA0 = Math.atan2(home[1] - C[1], home[0] - C[0]);
        const ang = sA0 + TAU * lap;
        const onRing = [C[0] + Ro * Math.cos(ang), C[1] + Ro * Math.sin(ang)];
        const reach = ease(span(t, 0.08, 0.24)) * (1 - ease(span(t, 0.76, 0.94)));
        const pos = [M.lerp(home[0], onRing[0], reach), M.lerp(home[1], onRing[1], reach)];
        const scale = M.lerp(1, 0.5, reach);
        // the ring fills behind the s (from where it left), then lets go from its start as the s comes home
        const fillTo = lap, letGo = ease(span(t, 0.72, 0.96));
        const ringA = ease(span(t, 0.1, 0.3));
        const lean = 0.03 * I * Math.sin(TAU * lap) * away;   // the 5 turns a little after the s (follow-through)
        const flash = bump(t, 0.72, 0.86);
        if (p.ribbon) {
          ctx.save();
          ctx.translate(c5[0], c5[1]); ctx.rotate(lean); ctx.scale(s5, s5); ctx.translate(-A.five[0], -A.five[1]);
          M.ribbon(ctx, lap, { colours: pal.ribbon, alpha: 1 - 0.3 * away });
          ctx.restore();
        }
        if (fillTo > letGo && ringA > 0) {
          const ring = arc(C, Ro, sA0, TAU, N);
          M.stroke(ctx, ring, { width: wRing * 0.5, colours: pal.ink, alpha: 0.07 * ringA * (1 - letGo) });
          M.stroke(ctx, ring, { width: wRing * 0.6 * (1 + 0.25 * I * flash), colours: bs, from: letGo, to: fillTo, alpha: ringA });
        }
        ctx.save();
        ctx.translate(c5[0], c5[1]); ctx.rotate(lean); ctx.scale(s5, s5); ctx.translate(-A.five[0], -A.five[1]);
        M.stroke(ctx, PTS.body, { width: W, colours: pal.body });
        M.stroke(ctx, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
        ctx.restore();
        const squash = 0.14 * I * bump(t, 0.9, 1) - 0.08 * I * bump(t, 0.02, 0.1);
        sAt(ctx, pal, WS, pos, scale, squash);
        return;
      }

      // open / tick: the bowl opens into the ring (o: 0..1), the ring does its work, then folds back (f: 0..1)
      const o = ease(span(t, 0.07, 0.34));
      const f = ease(span(t, 0.66, 0.9));
      const m = o * (1 - f);                            // how far toward the ring the bowl is
      const ringC = [M.lerp(340, C[0], m), M.lerp(589, C[1], m)], ringR = M.lerp(186, R, m);
      const gather = 1 - 0.035 * I * bump(t, 0, 0.12);  // anticipation: the mark draws in a little first
      const flash = bump(t, 0.6, 0.74);                 // the ring closing
      const width = M.lerp(W, wRing, m) * (1 + 0.18 * I * flash);

      // the ring's sweep: the bowl's 290 deg, closing to a full turn while the ring is open
      const close = ease(span(t, 0.34, 0.64));
      const sweepNow = BOWL_SPAN + (TAU - BOWL_SPAN) * close * (1 - f);

      // the stem and bar: they retract into the foot as the bowl opens and grow back out of it after
      const rStem = Math.max(ease(span(t, 0.1, 0.26)), 0) * (1 - ease(span(t, 0.7, 0.86)));
      const rBar = ease(span(t, 0.06, 0.18)) * (1 - ease(span(t, 0.78, 0.94)));
      // the foot rides the start of the ring (the morph's first point)
      const ring0 = [ringC[0] + ringR * Math.cos(a0), ringC[1] + ringR * Math.sin(a0)];
      const off = [m * (ring0[0] - BOWL[0][0]), m * (ring0[1] - BOWL[0][1])];

      // the s: up into the middle of the ring, smaller (the timer's "5 s"), then down into its nest
      const sUp = ease(span(t, 0.1, 0.36)), sDown = span(t, 0.7, 0.93);
      const dropY = sDown > 0 ? -170 * Math.sin(Math.PI * Math.min(1, sDown * 1.25)) * (1 - sDown) : 0;
      const sm = sUp * (1 - M.ease.inOutSine(sDown));
      const sPos = [M.lerp(A.s[0], C[0], sm), M.lerp(A.s[1], C[1] + 8, sm) + dropY];
      const sScale = M.lerp(1, 0.62, sm);
      const sSquash = 0.16 * I * bump(t, 0.9, 1) - 0.06 * I * bump(t, 0.03, 0.12);

      about(ctx, A.letters, gather, (c) => {
        if (p.ribbon) {
          // the ribbon turns once with the ring and steps back while the ring is open
          const rt = M.ease.inOutSine(span(t, 0.08, 0.92));
          about(c, A.bowl, 1 + 0.18 * m, (cr) => M.ribbon(cr, rt, { colours: pal.ribbon, alpha: 1 - 0.55 * m }));
        }
        const rest = m <= 0 && rStem <= 0 && rBar <= 0;
        if (rest) M.stroke(c, PTS.body, { width: W, colours: pal.body });
        else stem(c, pal, k, rStem, off);

        if (p.style === 'tick') {
          // five arcs: they part as the ring opens (pale, waiting), light one by one, and join as it closes
          const gapA = 16 * DEG * m * (1 - flash * 0) * (1 - ease(span(t, 0.56, 0.66)));
          for (let i = 0; i < 5; i++) {
            const lightAt = 0.33 + 0.055 * i;
            const lit = ease(span(t, lightAt, lightAt + 0.05));
            const pop = bump(t, lightAt, lightAt + 0.1);
            const seg = (TAU / 5);
            const s0 = a0 + i * seg + gapA / 2, sw = seg - gapA;
            const target = arc(ringC, ringR, s0, sw, 40);
            const pts = M.morph(FIFTHS[i], target, m);
            const cols = sub(bs, i / 5, (i + 1) / 5);
            const wait = 0.62 * m * (1 - lit);   // pale while waiting for its turn
            const colours = wait > 0.001 ? cols.map(([u, col]) => [u, M.mix(col, env.bg, wait)]) : cols;
            M.stroke(c, pts, { width: width * (1 + 0.22 * I * pop), colours });
          }
        } else if (!rest) {
          // one ring: the bowl's line, morphed onto a circle whose sweep closes to a full turn
          const target = arc(ringC, ringR, a0, sweepNow, N);
          const pts = m > 0 ? M.morph(BOWL, target, m) : BOWL;
          M.stroke(c, pts, { width, colours: bs });
          // the light: once round while the gap closes
          if (close > 0 && close < 1 && f < 1) glint(c, pts, bs, width, -0.1 + 1.2 * close, 0.12, light, (0.35 + 0.5 * I) * (1 - f));
        }
        if (rest) M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
        else bar(c, pal, k, rStem, rBar, off);
        sAt(c, pal, WS, sPos, sScale, sSquash);
      });
    }
  });
})();

/* 5s Motion Lab: Count (Time & structure).
 *
 * Five seconds, counted: the 5 becomes 4, 3, 2, 1 along its own strokes and comes back to 5, and then the s
 * lands beside it. While the digits count, the s waits as a small ball that ticks once per digit (a
 * metronome, the seconds), then takes a last, bigger hop and opens back into the s. The ribbon turns once
 * behind the count, like a hand round a clock. The frame at t = 0 and t = 1 is the still mark, so the
 * count loops without a seam (for load, at a slower duration: 5000 ms is one digit a second).
 *
 * Styles
 *   morph   each digit melts into the next along the strokes (the line is one stroke throughout)
 *   flap    a split-flap board: the top half of each digit folds down over the hinge to show the next
 *   write   each digit is un-written from its start while the next is written on, as a hand counting
 *   drop    each digit drops in from above and lands with a small squash; the one before falls away below
 *   tally   a count up instead of down, the way days are scratched on a wall: the 5 unravels (through Count's
 *           straight line) into one upright tally stroke, then a second, third and fourth are scratched on,
 *           one per beat, and the fifth beat is the gate stroke across them; then the five strokes build the 5
 *           (the gate rises into the bar, each upright bends into a quarter of the body, one after another)
 *           and the s lands. For five-done, streak: completion counted.
 *   dial    the digits melt into one another as in morph, but each change is also a fifth of a turn about the
 *           bowl's centre: mid-change the digit curls into an open ring (a ring has no up, so the turn carries
 *           on through it) whose gap, the dial's index, steps a fifth per digit, so 5, 4, 3, 2, 1, 5 is one
 *           revolution and every digit lands upright. The ribbon ratchets round behind as the dial's face; the
 *           ball rides the rim a stop ahead, like the dial's pointer, and drops back into place on the last stop.
 *           env.direction: right turns clockwise, left counter-clockwise; intensity: each fifth-turn's overshoot.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const N = 200;

  /* --- the digits, as single strokes of N points ----------------------------------------------- */
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 260), s: M.points('s', 180) };
  const FIVE = M.resample(PTS.bar.slice().reverse().concat(PTS.body), N);   // bar backwards, then the body
  const L_BAR = M.length('bar'), L_BODY = M.length('body');
  const SHARE_BAR = L_BAR / (L_BAR + L_BODY);
  const dist = (a, b) => a.reduce((s, p, i) => s + Math.hypot(p[0] - b[i][0], p[1] - b[i][1]), 0) / a.length;
  // 5, 4, 3, 2, 1, 5: each digit turned whichever way lies closest to the one before (less travel in a morph)
  const SEQ = [FIVE];
  for (const name of ['d4', 'd3', 'd2', 'd1']) {
    const f = M.points(name, N), r = f.slice().reverse(), prev = SEQ[SEQ.length - 1];
    SEQ.push(dist(prev, f) <= dist(prev, r) ? f : r);
  }
  SEQ.push(FIVE);
  // the stroke every digit straightens into on its way to the next (the digits' shared lean): a morph goes
  // A -> line -> B, so a change never passes through a tangle. Each digit has the line turned its own way
  // (whichever way is closer), and the digits' colours are by height, so the two turns look the same.
  const LINE = M.resample([[500, 236], [330, 756]], N);
  const LINE_R = LINE.slice().reverse();
  const lineFor = (d) => (dist(d, LINE) <= dist(d, LINE_R) ? LINE : LINE_R);
  // the same digits the way a hand writes them (for the write style)
  const HAND = [FIVE].concat(['d4', 'd3', 'd2', 'd1'].map((n) => M.points(n, N)), [FIVE]);

  /* --- colour ------------------------------------------------------------------------------------ */
  function norm(colours) {
    if (!Array.isArray(colours)) return [[0, colours], [1, colours]];
    const n = colours.length;
    return colours.map((c, i) => (Array.isArray(c) ? [c[0], c[1]] : [n === 1 ? 0 : i / (n - 1), c]));
  }
  const fiveStops = new Map();
  function stopsFive(pal) {   // the 5's own colours along FIVE: the bar's backwards, then the body's
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

  // a digit's colours: the logo's warm fall from top to bottom (yellow bar to red bowl), so every digit reads
  // as the 5 transformed; w blends toward the 5's own colours along its line (w = 1 at the 5 itself)
  function tone(pts, w, pal, c5) {
    const out = [], n = pts.length;
    for (let j = 0; j <= 20; j++) {
      const i = Math.round((j * (n - 1)) / 20), u = i / (n - 1);
      const cy = M.colourAt(pal.five, M.clamp((pts[i][1] - 210) / 580, 0, 1));
      out.push([u, w >= 1 ? M.colourAt(c5, u) : w <= 0 ? cy : M.mix(cy, M.colourAt(c5, u), w)]);
    }
    return out;
  }

  /* --- helpers ----------------------------------------------------------------------------------- */
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };
  function about(ctx, origin, sx, sy, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(sx, sy);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }

  // the timeline: five changes (5>4, 4>3, 3>2, 2>1, 1>5), each `m` long, starting every `step`
  const T0 = 0.1, STEP = 0.155, MLEN = 0.1;
  const change = (k) => [T0 + STEP * k, T0 + STEP * k + MLEN];
  const LAND = [0.8, 0.93];   // the s's last hop and landing

  // the ball's height above its rest (0 on the ground): it lands on every change's end, the last hop is
  // longer and higher and ends where the s lands
  function hop(t, I) {
    const ends = [0, 1, 2, 3, 4].map((k) => change(k)[1]);
    const starts = [0.04].concat(ends.slice(0, 4));
    for (let k = 0; k < 5; k++) {
      if (t >= starts[k] && t < ends[k]) { const x = (t - starts[k]) / (ends[k] - starts[k]); return 4 * x * (1 - x) * (150 + 50 * k / 4) * (0.4 + I); }
    }
    if (t >= ends[4] && t < LAND[1]) { const x = (t - ends[4]) / (LAND[1] - ends[4]); return 4 * x * (1 - x) * 260 * (0.4 + I); }
    return 0;
  }

  /* --- shared by the tally and dial styles ------------------------------------------------------ */
  const rotAbout = (pts, c, ang) => {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    return pts.map((q) => { const x = q[0] - c[0], y = q[1] - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; });
  };
  const rev = (pts) => pts.slice().reverse();
  // a lerp with a lag along the line (lag(f) in [0, 1]: 0 leads); every point is at a for m = 0 and at b for m = 1
  function lagMorph(a, b, m, lag, L) {
    const n = a.length, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const q = m <= 0 || m >= 1 ? M.clamp(m, 0, 1) : M.clamp(m * (1 + L) - L * lag(i / (n - 1)), 0, 1);
      out[i] = [a[i][0] + (b[i][0] - a[i][0]) * q, a[i][1] + (b[i][1] - a[i][1]) * q];
    }
    return out;
  }
  // the s while the count runs: it gathers into a ball (or, with tick off, lifts away), the ball rides
  // `place(t)` -> {x, y, h, sx, sy} (h: height above where the s sits, sx/sy: squash), then it opens back
  // into the s as it lands at land[1]
  function sAndBall(ctx, t, p, pal, I, WS, o) {
    const gather = M.ease.inOutCubic(span(t, 0, o.gatherEnd));
    const open = span(t, o.land[1] - 0.06, o.land[1] + 0.05);
    const squash = 0.14 * I * bump(t, o.land[1] - 0.02, o.land[1] + 0.07);
    if (p.tick) {
      const at = o.place(t);
      if (gather < 1 || open > 0) {
        const g = open > 0 ? M.ease.outBack(1.8)(open) : 1 - gather;
        about(ctx, [785, 830], 1 + squash, 1 - squash, (c) => {
          c.save();
          c.translate(at.x - A.s[0], at.y - A.s[1] - at.h);
          const s = 0.04 + 0.96 * g, w = M.lerp(1.15 * WS, WS, g) / s;
          about(c, A.s, s, s, (cs) => M.stroke(cs, PTS.s, { width: w, colours: pal.s }));
          c.restore();
        });
      } else {
        const ballR = WS * 0.5;
        ctx.save();
        ctx.translate(at.x, at.y + ballR * (1 - at.sy) - at.h);
        if (at.rot) ctx.rotate(at.rot);
        ctx.scale(at.sx, at.sy);
        if (at.rot) ctx.rotate(-at.rot);
        M.stroke(ctx, [[0, 0]], { width: ballR * 2 * 1.15, colours: M.colourAt(pal.s, 0.45) });
        ctx.restore();
      }
    } else {
      const away = M.ease.inCubic(span(t, 0.02, o.gatherEnd + 0.02)), back2 = span(t, o.land[0], o.land[1]);
      let y = 0, alpha = 1;
      if (t < o.land[0]) { y = -700 * away; alpha = 1 - away; }
      else { y = -700 * (1 - M.ease.inQuad(back2)); alpha = M.clamp(back2 * 3, 0, 1); }
      if (alpha > 0) about(ctx, [785, 830], 1 + squash, 1 - squash, (c) => { c.save(); c.translate(0, y); M.stroke(c, PTS.s, { width: WS, colours: pal.s, alpha }); c.restore(); });
    }
  }

  /* --- tally: counting up to five the way days are scratched on a wall -------------------------- */
  // four uprights leaning forward like a hand's, and the gate stroke across them, in the 5's place
  const T_TOP = 296, T_BOT = 716, T_LEAN = 0.17, T_X = [236, 359, 482, 605];
  // (heavier weights spread them a little, so the gaps between the scratches stay open)
  const uprightsAt = (k) => T_X.map((x) => {
    const d = T_LEAN * (T_BOT - T_TOP) / 2, xx = 420 + (x - 420) * (1 + 0.35 * (k - 1));
    return M.resample([[xx + d, T_TOP], [xx - d, T_BOT]], N);
  });
  const UPRIGHTS = uprightsAt(1);
  const UP_BY_K = new Map([[1, UPRIGHTS]]);
  const uprightsFor = (k) => { let u = UP_BY_K.get(k); if (!u) { u = uprightsAt(k); if (UP_BY_K.size > 32) UP_BY_K.clear(); UP_BY_K.set(k, u); } return u; };
  const SLASH = M.resample([[148, 618], [676, 392]], N);
  const BAR_N = M.points('bar', N), BODY_D = M.points('body', 4 * N);
  // the five strokes build the 5: the gate becomes the bar and each upright one quarter of the body (the stem,
  // the turn, the bowl's side, the tail), whichever upright lies nearest its quarter, turned whichever way is closer
  const QUARTERS = [0, 1, 2, 3].map((q) => M.resample(BODY_D.slice(q * N, (q + 1) * N + (q < 3 ? 1 : 0)), N));
  const T_PLAN = (() => {
    const perms = [];
    const go = (pre, rest) => { if (!rest.length) perms.push(pre); rest.forEach((x, i) => go(pre.concat([x]), rest.slice(0, i).concat(rest.slice(i + 1)))); };
    go([], [0, 1, 2, 3]);
    let best = null;
    for (const pm of perms) {   // pm[i]: the quarter upright i becomes
      let cost = 0;
      const ends = pm.map((q, i) => { const a = dist(UPRIGHTS[i], QUARTERS[q]), b = dist(UPRIGHTS[i], rev(QUARTERS[q])); cost += Math.min(a, b); return a <= b ? QUARTERS[q] : rev(QUARTERS[q]); });
      if (!best || cost < best.cost) best = { cost, pm, ends };
    }
    return best;
  })();
  // the beats: 5 -> one upright, then the second, third and fourth, then the gate; then the five strokes merge
  const T_BEATS = [[0.06, 0.18], [0.21, 0.27], [0.33, 0.39], [0.45, 0.51], [0.57, 0.65]];
  const T_MERGE = [0.69, 0.87], T_LAND = [0.65, 0.89];

  function tally(ctx, t, p, env) {
    const pal = env.palette, ease = M.easing(p.easing);
    const I = p.intensity, k = p.weight;
    const W = M.widths.body * k, WS = M.widths.s * k, WU = M.widths.body * 0.66 * (1 + 0.5 * (k - 1));
    const c5 = stopsFive(pal);
    const counting = t > T_BEATS[0][0] && t < T_MERGE[1];
    const UPS = uprightsFor(k);

    // a tick of scale as each stroke lands; the gate, the fifth, lands harder
    let tick = 0;
    T_BEATS.forEach((b, i) => { tick = Math.max(tick, (i === 4 ? 1.6 : 1) * bump(t, b[1] - 0.01, b[1] + 0.07)); });
    tick = Math.max(tick, 0.8 * bump(t, T_MERGE[1] - 0.02, T_MERGE[1] + 0.07));

    if (p.ribbon) {
      const r = M.ease.inOutSine(span(t, 0.04, 0.96));
      M.ribbon(ctx, r, { colours: pal.ribbon, alpha: 1 - 0.4 * bump(t, 0.02, 0.98) });
    }
    const sc = 1 + (0.02 + 0.08 * I) * tick;
    about(ctx, A.five, sc, sc, (c) => {
      if (!counting) {
        M.stroke(c, PTS.body, { width: W, colours: pal.body });
        M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
        return;
      }
      const up = (pts, to) => M.stroke(c, pts, { width: WU, colours: tone(pts, 0, pal, c5), to: to == null ? 1 : to });
      if (t < T_BEATS[0][1]) {
        // the 5 unravels: it straightens into the digits' line, which shortens into the first upright
        const e = ease(span(t, T_BEATS[0][0], T_BEATS[0][1]));
        const L = lineFor(FIVE), U0 = L === LINE ? UPS[0] : rev(UPS[0]);
        const pts = e < 0.5 ? M.morph(FIVE, L, e * 2) : M.morph(L, U0, e * 2 - 1);
        const w = Math.max(0, 1 - 2 * e);
        M.stroke(c, pts, { width: M.lerp(W, WU, Math.max(0, e * 2 - 1)), colours: tone(pts, w, pal, c5) });
        return;
      }
      if (t < T_MERGE[0]) {
        // the count up: each upright is scratched on from the top, then the gate from lower left to upper right
        for (let i = 0; i < 4; i++) {
          if (i === 0) { up(UPS[0]); continue; }
          const d = ease(span(t, T_BEATS[i][0], T_BEATS[i][1]));
          if (d > 0) up(UPS[i], d);
        }
        const g = ease(span(t, T_BEATS[4][0], T_BEATS[4][1]));
        if (g > 0) M.stroke(c, SLASH, { width: WU * 1.08, colours: tone(SLASH, 0, pal, c5), to: g });
        return;
      }
      // the five strokes build the 5, one after another: the gate rises into the bar, then each upright bends
      // into its quarter of the body (the quarter's own stretch of the 5's colours)
      const dur = T_MERGE[1] - T_MERGE[0], each = dur * 0.52, gap = (dur - each) / 4;
      for (let i = 0; i < 4; i++) {
        const q = T_PLAN.pm[i], s0 = T_MERGE[0] + gap * (1 + q);
        const m = ease(span(t, s0, s0 + each));
        const pts = lagMorph(UPS[i], T_PLAN.ends[i], m, (f) => f, 0.35);
        const fwd = T_PLAN.ends[i] === QUARTERS[q];
        M.stroke(c, pts, { width: M.lerp(WU, W, m), colours: mixStops(tone(UPS[i], 0, pal, c5), part(pal.body, fwd ? q / 4 : (q + 1) / 4, fwd ? (q + 1) / 4 : q / 4), m) });
      }
      const m = ease(span(t, T_MERGE[0], T_MERGE[0] + each));
      const bar = lagMorph(SLASH, BAR_N, m, (f) => 1 - f, 0.35);
      M.stroke(c, bar, { width: M.lerp(WU * 1.08, M.widths.bar * k, m), colours: mixStops(tone(SLASH, 0, pal, c5), pal.bar, m) });
    });

    // the s: the ball ticks once per stroke, then a last long hop as the strokes merge, and it opens into the s
    const ends = T_BEATS.map((b) => b[1]);
    sAndBall(ctx, t, p, pal, I, WS, {
      gatherEnd: T_BEATS[0][0] + 0.02, land: T_LAND,
      place(tt) {
        let h = 0;
        const starts = [0.04].concat(ends.slice(0, 4));
        for (let i = 0; i < 5; i++) if (tt >= starts[i] && tt < ends[i]) { const x = (tt - starts[i]) / (ends[i] - starts[i]); h = 4 * x * (1 - x) * (130 + 60 * i / 4) * (0.35 + I); }
        if (tt >= ends[4] && tt < T_LAND[1]) { const x = (tt - ends[4]) / (T_LAND[1] - ends[4]); h = 4 * x * (1 - x) * 300 * (0.35 + I); }
        const v = Math.min(1, h / 60);
        return { x: A.s[0], y: A.s[1], h, sx: 1 + 0.25 * I * Math.min(1, tick) - 0.08 * I * v, sy: 1 - 0.22 * I * Math.min(1, tick) + 0.12 * I * v };
      }
    });
  }

  // the stretch [a, b] of a gradient (a > b runs it backwards) as stops on [0, 1]
  function part(colours, a, b) {
    const st = norm(colours), lo = Math.min(a, b), hi = Math.max(a, b);
    const out = [[0, M.colourAt(st, a)], [1, M.colourAt(st, b)]];
    for (const [u] of st) if (u > lo && u < hi) out.push([(u - a) / (b - a), M.colourAt(st, u)]);
    return out.sort((x, y) => x[0] - y[0]);
  }
  // two colour lists mixed by m (at every stop of either), as stops
  function mixStops(a, b, m) {
    const A2 = norm(a), B2 = norm(b);
    if (m <= 0) return A2;
    if (m >= 1) return B2;
    const us = Array.from(new Set(A2.map((x) => x[0]).concat(B2.map((x) => x[0])))).sort((x, y) => x - y);
    return us.map((u) => [u, M.mix(M.colourAt(A2, u), M.colourAt(B2, u), m)]);
  }

  /* --- dial: each change is a fifth of a turn of a dial about the bowl ---------------------------- */
  // mid-change every digit curls into an open ring about the bowl's centre (a ring has no up, so the turn can
  // carry on through it); the ring's gap is the dial's index and steps a fifth of a turn per digit, so 5, 4,
  // 3, 2, 1, 5 is one revolution. In its own upright frame digit j curls onto the ring with its gap at
  // g0 + j fifths (g0 chosen once so the digits travel least), and the whole change turns a fifth about the bowl.
  const BOWL = A.bowl, R_RING = 258, GAP = 1.25, FIFTH = (Math.PI * 2) / 5;
  const ringAt = (gap) => {
    const out = [];
    for (let i = 0; i < N; i++) { const a = gap + GAP / 2 + (i / (N - 1)) * (Math.PI * 2 - GAP); out.push([BOWL[0] + R_RING * Math.cos(a), BOWL[1] + R_RING * Math.sin(a)]); }
    return out;
  };
  const DIAL = new Map();
  function dialFor(sgn) {   // sgn 1: clockwise (on screen, y down), -1: counter-clockwise
    let d = DIAL.get(sgn);
    if (d) return d;
    const digits = SEQ.slice(0, 5);
    let best = null;
    for (let g = 0; g < 72; g++) {
      const g0 = (g / 72) * Math.PI * 2;
      let cost = 0;
      const rings = digits.map((D, j) => {
        const r = ringAt(g0 + sgn * FIFTH * j), rr = rev(r), a = dist(D, r), b = dist(D, rr);
        cost += Math.min(a, b);
        return a <= b ? r : rr;
      });
      if (!best || cost < best.cost) best = { cost, rings };
    }
    d = { rings: best.rings.concat([best.rings[0]]) };
    DIAL.set(sgn, d);
    return d;
  }
  const D_CH = (k) => [0.1 + 0.155 * k, 0.1 + 0.155 * k + 0.1];   // Count's own beat
  const D_LAND = [0.8, 0.93];
  const R_RIM = 345, TH_S = Math.atan2(A.s[1] - BOWL[1], A.s[0] - BOWL[0]), R_S = Math.hypot(A.s[1] - BOWL[1], A.s[0] - BOWL[0]);

  function dial(ctx, t, p, env) {
    const pal = env.palette, ease = M.easing(p.easing);
    const I = p.intensity, k = p.weight;
    const W = M.widths.body * k, WS = M.widths.s * k;
    const c5 = stopsFive(pal);
    const sgn = env.direction === 'left' ? -1 : 1;
    const { rings } = dialFor(sgn);
    const turn = M.ease.outBack(0.4 + 2.6 * I);   // each fifth-turn overshoots by intensity and settles
    const SETTLE = 0.012;

    // which change (a: digit a -> a + 1), its morph progress e and its turn r (0..1, overshooting)
    let a = 0, e = 0, r = 0;
    for (let i = 0; i < 5; i++) {
      const [s0, s1] = D_CH(i);
      if (t >= s0) { a = i; e = ease(span(t, s0, s1 - 0.012)); r = turn(span(t, s0, s1 + SETTLE)); }
    }
    const busy = t > D_CH(0)[0] && t < D_CH(4)[1] + SETTLE;
    let tick = 0;
    for (let i = 0; i < 5; i++) tick = Math.max(tick, bump(t, D_CH(i)[1] - 0.01, D_CH(i)[1] + 0.07));

    // the ribbon is the dial's face: it ratchets round a fifth per digit, one revolution in all
    if (p.ribbon) {
      const face = busy ? sgn * FIFTH * (a + r) : 0;
      ctx.save();
      ctx.translate(BOWL[0], BOWL[1]); ctx.rotate(face); ctx.translate(-BOWL[0], -BOWL[1]);
      M.ribbon(ctx, 0, { colours: pal.ribbon, alpha: 1 - 0.3 * bump(t, 0.06, 0.97) });
      ctx.restore();
    }
    const sc = 1 + (0.02 + 0.06 * I) * tick;
    about(ctx, A.five, sc, sc, (c) => {
      if (!busy) {
        M.stroke(c, PTS.body, { width: W, colours: pal.body });
        M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
        return;
      }
      const A0 = SEQ[a], B0 = SEQ[a + 1];
      // in the change's own frame: A curls onto its ring, which uncurls into B set back a fifth; the frame turns a fifth
      const local = e < 0.5 ? M.morph(A0, rings[a], e * 2) : M.morph(rotAbout(rings[a + 1], BOWL, -sgn * FIFTH), rotAbout(B0, BOWL, -sgn * FIFTH), e * 2 - 1);
      const pts = rotAbout(local, BOWL, sgn * FIFTH * r);
      const w = (A0 === FIVE ? 1 - Math.min(1, 2 * e) : 0) + (B0 === FIVE ? Math.max(0, 2 * e - 1) : 0);
      M.stroke(c, pts, { width: W, colours: tone(pts, w, pal, c5) });
    });

    // the s: the ball rides the dial's rim a stop ahead of the digits, a fifth of the way round per digit, and on
    // the last stop it drops back into place and opens
    const step = (i) => [D_CH(i)[0] - 0.035, D_CH(i)[0] + 0.065];
    sAndBall(ctx, t, p, pal, I, WS, {
      gatherEnd: 0.065, land: D_LAND,
      place(tt) {
        if (tt >= step(4)[1]) return { x: A.s[0], y: A.s[1], h: 0, sx: 1, sy: 1 };   // home
        let j = 0, q = 0;
        for (let i = 0; i < 5; i++) { const [s0, s1] = step(i); if (tt >= s0) { j = i; q = span(tt, s0, s1); } }
        if (tt < step(0)[0]) { j = 0; q = 0; }
        const qe = M.ease.inOutCubic(q);
        const ang = TH_S + sgn * FIFTH * (j + qe);
        // out from the s's place onto the rim on the first stop, back to it on the last
        const rad = j === 0 ? M.lerp(R_S, R_RIM, qe) : j === 4 ? M.lerp(R_RIM, R_S, qe) : R_RIM;
        const fly = bump(q, 0, 1), land = bump(q, 0.82, 1.18);
        // stretched along the way it travels, squashed against the rim as it lands on a stop
        const sx = 1 + 0.28 * I * fly - 0.1 * I * land, sy = 1 - 0.12 * I * fly + 0.24 * I * land;
        const lift = 36 * (0.3 + I) * fly;   // it hops outward off the rim between stops
        return { x: BOWL[0] + (rad + lift) * Math.cos(ang), y: BOWL[1] + (rad + lift) * Math.sin(ang), h: 0, sx, sy, rot: ang + Math.PI / 2 };
      }
    });
  }

  Motion.register({
    id: 'count',
    name: 'Count',
    idea: 'The 5 counts down, 4, 3, 2, 1, along its own strokes and comes back as 5; the s, waiting as a ticking ball, lands last.',
    why: 'Five seconds, five cards: the count says how long a judgment takes and that today\'s five is about to begin.',
    moments: ['five-start', 'load'],
    styles: ['morph', 'flap', 'write', 'drop', 'tally', 'dial'],
    params: {
      duration: { default: 1200, min: 600, max: 6000, step: 100 },   // 5000: one digit a second, for load
      style: { default: 'morph', options: ['morph', 'flap', 'write', 'drop', 'tally', 'dial'] },
      tick: { default: true },                                         // the s waits as a ticking ball (off: it lifts away and drops back)
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      if (p.style === 'tally') { tally(ctx, t, p, env); return; }
      if (p.style === 'dial') { dial(ctx, t, p, env); return; }
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, k = p.weight;
      const W = M.widths.body * k, WS = M.widths.s * k;
      const c5 = stopsFive(pal);

      // which change is under way (or just done): digit index a -> a + 1 with progress q
      let a = 0, q = 0;
      for (let i = 0; i < 5; i++) {
        const [s0, s1] = change(i);
        if (t >= s0) { a = i; q = span(t, s0, s1); }
      }
      const counting = t > change(0)[0] && t < change(4)[1];
      // a small tick of scale as each digit arrives
      let tick = 0;
      for (let i = 0; i < 5; i++) tick = Math.max(tick, bump(t, change(i)[1] - 0.01, change(i)[1] + 0.07));

      // the ribbon turns once behind the whole count and is still again at the end
      if (p.ribbon) {
        const r = M.ease.inOutSine(span(t, 0.06, 0.96));
        const dim = 1 - 0.35 * bump(t, 0.04, 0.98);
        M.ribbon(ctx, r, { colours: pal.ribbon, alpha: dim });
      }

      // a digit: w is how much of the 5's own colouring it carries (1 for the 5, 0 for 4..1)
      const digit = (c, pts, from, to, alpha, w) => M.stroke(c, pts, {
        width: W, colours: tone(pts, w == null ? (pts === FIVE ? 1 : 0) : w, pal, c5),
        from: from == null ? 0 : from, to: to == null ? 1 : to, alpha: alpha == null ? 1 : alpha
      });
      const five = (c) => {   // the 5 at rest: its real strokes
        M.stroke(c, PTS.body, { width: W, colours: pal.body });
        M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
      };
      const sc = 1 + 0.05 * I * tick;

      about(ctx, A.five, sc, sc, (c) => {
        if (!counting) { five(c); return; }
        const A0 = SEQ[a], B0 = SEQ[a + 1];
        const e = ease(q);
        if (p.style === 'flap') {
          // split-flap: hinge across the middle of the digits. First half: the top of A folds down (it
          // narrows toward the hinge, darkening) over B's top; second half: B's bottom unfolds over A's.
          const hy = 492, view = env.view;
          // the digits are clipped into bands (no card is drawn, so the ribbon behind stays whole): the flap
          // covers [hy - HT * sy, hy] on the way down, then [hy, hy + HB * sy] as it unfolds
          const HT = hy - 140, HB = 860 - hy, gap = 6 * Math.sin(Math.PI * q);
          const band = (y0, y1, draw) => {
            if (y1 <= y0) return;
            c.save();
            c.beginPath();
            c.rect(view.x0, y0, view.x1 - view.x0, y1 - y0);
            c.clip();
            draw();
            c.restore();
          };
          const dark = env.theme === 'dark' ? '#000000' : '#16131F';
          const shaded = (cc, pts, k) => {
            digit(cc, pts);
            if (k > 0.01) M.stroke(cc, pts, { width: W, colours: dark, alpha: k });
          };
          if (q <= 0 || q >= 1) digit(c, q >= 1 ? B0 : A0);
          else if (e < 0.5) {
            const sy = Math.cos(Math.PI * e);   // the top flap (A's top) folding down: 1 -> 0
            band(view.y0, hy - HT * sy - gap, () => digit(c, B0));          // the next digit's top, uncovered
            band(hy + gap, view.y1, () => digit(c, A0));                    // the current digit's bottom
            band(hy - HT * sy, hy - gap, () => about(c, [500, hy], 1, Math.max(0.001, sy), (cc) => shaded(cc, A0, 0.45 * (1 - sy))));
          } else {
            const sy = -Math.cos(Math.PI * e);  // the flap (now B's bottom) unfolding below the hinge: 0 -> 1
            band(view.y0, hy - gap, () => digit(c, B0));
            band(hy + HB * sy + gap, view.y1, () => digit(c, A0));          // the current digit's bottom, being covered
            band(hy + gap, hy + HB * sy, () => about(c, [500, hy], 1, Math.max(0.001, sy), (cc) => shaded(cc, B0, 0.45 * (1 - sy))));
          }
        } else if (p.style === 'write') {
          // un-write A from its start while B is written from its start; they overlap in the middle
          const out = ease(span(q, 0, 0.72)), inn = ease(span(q, 0.18, 1));
          if (out < 1) digit(c, HAND[a], out, 1);
          if (inn > 0) digit(c, HAND[a + 1], 0, inn);
        } else if (p.style === 'drop') {
          // A falls away below (accelerating, fading), B drops in from above and lands with a squash
          const fall = M.ease.inCubic(span(q, 0, 0.55)), fallIn = span(q, 0.25, 1);
          if (fall < 1) {
            c.save(); c.translate(0, 520 * fall); digit(c, A0, 0, 1, 1 - fall); c.restore();
          }
          if (fallIn > 0) {
            const y = -560 * (1 - M.ease.inQuad(span(fallIn, 0, 0.62)));
            const squash = bump(fallIn, 0.6, 1) * 0.12 * (0.4 + I);
            c.save(); c.translate(0, y);
            about(c, [400, 800], 1 + squash * 0.6, 1 - squash, (cc) => digit(cc, B0, 0, 1, M.clamp(fallIn / 0.2, 0, 1)));
            c.restore();
          }
        } else {   // morph
          // A straightens into the line, then the line bends into B (the easing is over the whole change, so it is
          // fastest as it passes the line)
          // the 5's own colouring fades out on the way to the line and back in after it, so the line itself is
          // coloured by height only (the same whichever way round it is)
          const w = (A0 === FIVE ? 1 - Math.min(1, 2 * e) : 0) + (B0 === FIVE ? Math.max(0, 2 * e - 1) : 0);
          const pts = e < 0.5 ? M.morph(A0, lineFor(A0), e * 2) : M.morph(lineFor(B0), B0, e * 2 - 1);
          digit(c, pts, 0, 1, 1, w);
        }
      });

      // the s: it gathers into a ball, the ball ticks with the count, then it hops and opens back into the s
      const gather = M.ease.inOutCubic(span(t, 0.0, 0.1));     // s -> ball
      const open = span(t, LAND[1] - 0.06, LAND[1] + 0.05);     // ball -> s, as it lands
      const sAt = A.s, ground = [785, 668];
      if (p.tick) {
        const h = hop(t, I);
        const ballR = WS * 0.5;
        if (gather < 1 || open > 0) {
          // the s itself, scaled toward the ball (shrinking into it, or opening out of it on landing)
          const g = open > 0 ? M.ease.outBack(1.8)(open) : 1 - gather;
          const squash = 0.14 * I * bump(t, LAND[1] - 0.02, LAND[1] + 0.07);
          about(ctx, [785, 830], 1 + squash, 1 - squash, (c) => {
            c.save();
            c.translate(0, -h);
            const s = 0.04 + 0.96 * g, w = M.lerp(1.15 * WS, WS, g) / s;
            about(c, sAt, s, s, (cs) => M.stroke(cs, PTS.s, { width: w, colours: pal.s }));
            c.restore();
          });
        } else {
          // the ball: squashes a little on each landing and stretches in flight
          const v = Math.min(1, h / 60);   // stretched in flight, eased in and out with the height
          const land = tick;
          const sx = 1 + 0.25 * I * land - 0.08 * I * v, sy = 1 - 0.22 * I * land + 0.12 * I * v;
          const y = ground[1] + ballR * (1 - sy) - h;
          ctx.save();
          ctx.translate(ground[0], y);
          ctx.scale(sx, sy);
          M.stroke(ctx, [[0, 0]], { width: ballR * 2 * 1.15, colours: M.colourAt(pal.s, 0.45) });
          ctx.restore();
        }
      } else {
        // no ball: the s lifts away at the start and drops back in at the end
        const away = M.ease.inCubic(span(t, 0.02, 0.12)), back2 = span(t, LAND[0], LAND[1]);
        let y = 0, alpha = 1;
        if (t < LAND[0]) { y = -700 * away; alpha = 1 - away; }
        else { y = -700 * (1 - M.ease.inQuad(back2)); alpha = M.clamp(back2 * 3, 0, 1); }
        const squash = 0.14 * I * bump(t, LAND[1] - 0.02, LAND[1] + 0.07);
        if (alpha > 0) about(ctx, [785, 830], 1 + squash, 1 - squash, (c) => { c.save(); c.translate(0, y); M.stroke(c, PTS.s, { width: WS, colours: pal.s, alpha }); c.restore(); });
      }
    }
  });
})();

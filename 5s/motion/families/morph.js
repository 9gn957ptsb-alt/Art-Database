/* 5s Motion Lab: Morph (Decomposition & making).
 *
 * The 5 melts into the s through their shared bowl, and back. Traced from the bright tip of its bar,
 * the 5 is the same gesture as the s with corners: in from the upper right, left along the top, down,
 * round the bowl and out to the left. So the two letters morph point for point (the bar onto the s's top
 * terminal, the stem onto its upper curve, the bowl onto its lower bowl), and in between is a glyph that
 * is both. Each letter keeps its own gradient and passes it to the other as it goes.
 *
 * Styles
 *   merge     the 5 and the s melt into one s at the centre, at the 5's weight, then part and become 5s
 *             again (the 5 re-forms bar first, the corner snapping back last)
 *   exchange  the 5 and the s swing round each other and trade places, the 5 becoming the s and the s the
 *             5; the swing turns with env.direction (right: clockwise), so a tab move has a way
 *   melt      both letters drain down their strokes into their shared bowls, two swollen bowls side by
 *             side for a beat, then fill back up into 5 and s ("taking it back")
 *   revolve   Exchange as a revolving door: the 5 and the s are its two wings on a vertical axis between them;
 *             at the quarter-turn both are edge-on slivers, and while edge-on each morphs into the other, so at
 *             the half-turn they have traded sides and read 5s. The near wing is larger and in front, the far one
 *             sinks toward the ribbon's violet (toward the ground in one-colour palettes). Intensity 0.75 and up
 *             turns the door a full turn (two trades); env.direction sets which way it turns.
 *   doubles   a typographic joke in three beats: 5s, ss, 55, 5s. The 5 becomes an s at its own size, then both
 *             become 5s, then the small 5 becomes the s again; each change lands with a kick of scale.
 *   shell     a shell game: they trade places three times in quick arcs (over, under, over), the one passing in
 *             front larger, each pass faster than the last (40, 33, 27 % of the move) and each a morph, so every
 *             landing reads 5s; the last settles. env.direction: the first arc's way; intensity: arc height.
 *   (revolve, doubles and shell start and end exactly on the still mark)
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);
  const bump = (x) => Math.sin(Math.PI * clamp01(x));

  /* --- geometry, computed once ------------------------------------------------------------------- */
  // the 5 as one line: the bar backwards (tip -> corner, NB points) then the body (NBODY points), each
  // sampled exactly as its own stroke, so at rest the two pieces are the 5's own bar and body
  const NB = 160, NBODY = 160, N = NB + NBODY;                 // each sampled as Marks.mark samples it
  const L_BAR = M.length('bar'), L_BODY = M.length('body');
  const FB = L_BAR / (L_BAR + L_BODY);                      // the bar's share of the 5's one line
  const FIVE = M.points('bar', NB).reverse().concat(M.points('body', NBODY));
  const KB = NB - 1;                                         // the bar is FIVE[0..KB], the body FIVE[KB+1..]
  const BODY_D = M.points('body', 600), S_D = M.points('s', 600);

  // the stretch [a, b] of a polyline as n points
  function sub(pts, a, b, n) {
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
  // a line of N points split like FIVE: its first NB points cover [a, m], the rest [m, b]
  const splitLike = (pts, a, b) => { const m = a + (b - a) * FB; return sub(pts, a, m, NB).concat(sub(pts, m, b, NBODY)); };
  const S = splitLike(S_D, 0, 1);                            // the s, point for point with FIVE
  const centre = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); } return [(x0 + x1) / 2, (y0 + y1) / 2]; };
  const C5 = centre(FIVE), CS = centre(S);

  // merge: one s at the centre, as big as the 5 (both letters land on it)
  const MERGE_SCALE = 1.62;
  const S_MID = S.map((p) => [505 + (p[0] - CS[0]) * MERGE_SCALE, 515 + (p[1] - CS[1]) * MERGE_SCALE]);
  // melt: each letter drains into its own bowl: the 5 onto its bowl past the foot, the s onto its lower bowl
  const U_FOOT = M.length('M 311 231 C 262 318 211 404 160 491') / L_BODY;
  const BOWL5 = splitLike(BODY_D, U_FOOT + 0.05, 1);
  const BOWLS = sub(S_D, 0.4, 1, N);
  const S_WHOLE = M.points('s', N);                          // the s on its own, evenly sampled (melt drains it)

  /* --- colour: exact stretches of the logo's gradients, and mixes of two of them ----------------- */
  // the stops of `colours` over [a, b] (a > b runs it backwards), remapped to [0, 1]: the original stops that
  // fall inside, plus both ends, so the stretch is exactly that part of the gradient
  function stretch(colours, a, b) {
    const list = Array.isArray(colours) ? colours : [colours];
    const n = list.length, us = list.map((c, i) => (Array.isArray(c) && typeof c[0] === 'number' ? c[0] : (n === 1 ? 0 : i / (n - 1))));
    const lo = Math.min(a, b), hi = Math.max(a, b), out = [[0, M.colourAt(colours, a)], [1, M.colourAt(colours, b)]];
    for (const u of us) if (u > lo && u < hi) out.push([(u - a) / (b - a), M.colourAt(colours, u)]);
    return out.sort((p, q) => p[0] - q[0]);
  }
  // A and B mixed by m, at every stop of either (so m = 0 is exactly A and m = 1 exactly B)
  function mixList(A, B, m) {
    m = clamp01(m);
    if (m <= 0) return A;
    if (m >= 1) return B;
    const us = Array.from(new Set(A.map((x) => x[0]).concat(B.map((x) => x[0])))).sort((p, q) => p - q);
    return us.map((u) => [u, M.mix(M.colourAt(A, u), M.colourAt(B, u), m)]);
  }
  const colourCache = new Map();
  function colourSets(pal) {
    const key = pal.name + pal.theme;
    let c = colourCache.get(key);
    if (c) return c;
    const b0 = U_FOOT + 0.05, bm = b0 + (1 - b0) * FB;
    c = {
      fiveBar: stretch(pal.bar, 1, 0), fiveBody: stretch(pal.body, 0, 1),
      sBar: stretch(pal.s, 0, FB), sBody: stretch(pal.s, FB, 1), s: stretch(pal.s, 0, 1),
      bowlBar: stretch(pal.body, b0, bm), bowlBody: stretch(pal.body, bm, 1), sBowl: stretch(pal.s, 0.4, 1)
    };
    colourCache.set(key, c);
    return c;
  }

  // lerp two point lists with a lag along the line: lag(f) in [0, 1] (0 leads, 1 trails). Every point is at
  // a when m = 0 and at b when m = 1; outside [0, 1] (anticipation, settle) all points extrapolate together
  const LAG = 0.6;
  function blend(a, b, m, lag, dx, dy) {
    const n = a.length, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const k = !lag || m <= 0 || m >= 1 ? m : clamp01(m * (1 + LAG) - LAG * lag(i / (n - 1)));
      out[i] = [a[i][0] + (b[i][0] - a[i][0]) * k + (dx || 0), a[i][1] + (b[i][1] - a[i][1]) * k + (dy || 0)];
    }
    return out;
  }

  // draw a 5-like glyph (the bar stretch [0, KB] and the body stretch [KB + 1, N)) with its widths and colours
  function glyph5(ctx, pts, wBar, wBody, colBar, colBody) {
    M.stroke(ctx, pts.slice(KB + 1), { width: wBody, colours: colBody });
    M.stroke(ctx, pts.slice(0, KB + 1), { width: wBar, colours: colBar });
  }

  /* --- timing ----------------------------------------------------------------------------------- */
  // there and back: 0 -> 1 (with a small lean back first) -> hold -> 0, a little past 0 on the way home
  // (the 5's corners snap back slightly sharper than rest, then settle)
  function thereAndBack(t, ease, I) {
    const go = ease(M.smoothstep(0, 1, win(t, 0.05, 0.4)));
    const back = ease(M.smoothstep(0, 1, win(t, 0.53, 0.4)));
    const lean = -0.06 * bump(t / 0.12);
    const u = win(t, 0.86, 0.14);
    const settle = 0.05 * (0.4 + 0.6 * I) * Math.sin(TAU * u) * (1 - u);
    return go * (1 - back) + lean - settle;
  }

  /* --- styles ----------------------------------------------------------------------------------- */
  function merge(ctx, t, p, env, I, ease) {
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const m = thereAndBack(t, ease, I);
    const dir = env.direction === 'left' ? -1 : 1;
    // the s travels in on an arc (up and over), a beat behind the 5: overlap
    const mS = thereAndBack(clamp01((t - 0.03) / 0.97), ease, I);   // lagged, and still home by t = 1
    const wMid = 128 * k;
    const ribbon = () => {
      if (!p.ribbon) return;
      const g = clamp01(m);
      ctx.save();
      const bx = M.anchors.bowl[0], by = M.anchors.bowl[1];
      ctx.translate(bx + 70 * g, by - 20 * g);
      ctx.scale(1 - 0.12 * g * (0.5 + I), 1 - 0.12 * g * (0.5 + I));
      ctx.translate(-bx, -by);
      M.ribbon(ctx, 0.18 * g * (0.4 + I) * dir, { colours: pal.ribbon, alpha: 1 - 0.35 * g });
      ctx.restore();
    };
    ribbon();
    // the 5: tip-first lag (its bowl leads into the s, the bar follows)
    const lag5 = (f) => 1 - f;
    const five = blend(FIVE, S_MID, m, lag5, 0, 0);
    const mc = clamp01(m);
    glyph5(ctx, five, M.lerp(M.widths.bar * k, wMid, mc), M.lerp(M.widths.body * k, wMid, mc),
      mixList(col.fiveBar, col.sBar, mc), mixList(col.fiveBody, col.sBody, mc));
    // the s: grows into the centre on an arc
    const arc = 90 * (0.4 + I) * bump(clamp01(mS));
    const sPts = blend(S, S_MID, mS, null, -arc * 0.35 * dir, -arc);
    M.stroke(ctx, sPts, { width: M.lerp(M.widths.s * k, wMid, clamp01(mS)), colours: col.s });
  }

  function exchange(ctx, t, p, env, I, ease) {
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const dir = env.direction === 'left' ? -1 : 1;
    // one way only: the 5 becomes the s and the s the 5, so the last frame is the first
    const run = (d) => {
      const u = win(t, 0.05 + d, 0.8);
      const s = M.smoothstep(0, 1, u);
      const lean = -0.05 * bump(t / 0.1);
      const v = win(t, 0.8 + d * 0.5, 0.2 - d * 0.5);
      const settle = 0.035 * (0.4 + 0.6 * I) * Math.sin(TAU * v) * (1 - v);
      // half the chosen easing, half a plain in-out, so the swing fills the time instead of front-loading it
      return 0.5 * (ease(s) + s) + lean - settle;
    };
    const m5 = run(0), mS = run(0.04);
    // the swing: both centres turn half a turn about their midpoint (dir sets which way)
    const mid = [(C5[0] + CS[0]) / 2, (C5[1] + CS[1]) / 2];
    const swing = (pts, from, to, m) => {
      const ang = Math.PI * clamp01(m) * dir * (0.5 + 0.38 * I);
      // where the centre would be on a straight line, and where it is on the swing
      const lx = from[0] + (to[0] - from[0]) * m, ly = from[1] + (to[1] - from[1]) * m;
      const rx = from[0] - mid[0], ry = from[1] - mid[1];
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const sx = mid[0] + rx * cs - ry * sn, sy = mid[1] + rx * sn + ry * cs;
      const w = bump(clamp01(m));
      return pts.map((q) => [q[0] + (sx - lx) * w, q[1] + (sy - ly) * w]);
    };
    const mc5 = clamp01(m5), mcS = clamp01(mS);
    if (p.ribbon) {
      const g = bump(clamp01(m5));
      M.ribbon(ctx, clamp01((m5 + mS) / 2) * dir, { colours: pal.ribbon, alpha: 1 - 0.45 * g });   // one whole turn: its rest again
    }
    // the 5 turning into an s (its colours into the s's)
    const a = swing(blend(FIVE, S, m5, (f) => 1 - f, 0, 0), C5, CS, m5);
    const drawA = () => glyph5(ctx, a, M.lerp(M.widths.bar * k, M.widths.s * k, mc5), M.lerp(M.widths.body * k, M.widths.s * k, mc5),
      mixList(col.fiveBar, col.sBar, mc5), mixList(col.fiveBody, col.sBody, mc5));
    // the s turning into a 5 (bar out first)
    const b = swing(blend(S, FIVE, mS, (f) => f, 0, 0), CS, C5, mS);
    const drawB = () => glyph5(ctx, b, M.lerp(M.widths.s * k, M.widths.bar * k, mcS), M.lerp(M.widths.s * k, M.widths.body * k, mcS),
      mixList(col.sBar, col.fiveBar, mcS), mixList(col.sBody, col.fiveBody, mcS));
    // the bigger letter stays behind: the s (b) starts in front and ends behind; the hand-over is a
    // cross-fade of the front copy around the middle, where the two are smallest and farthest apart
    const front = M.smoothstep(0.4, 0.6, (m5 + mS) / 2);
    if (front < 0.999) drawA();
    drawB();
    if (front >= 0.999) drawA();
    else if (front > 0.001) M.layer(ctx, { alpha: front }, () => drawA());
  }

  function melt(ctx, t, p, env, I, ease) {
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const m = thereAndBack(t, ease, I);
    const mS = thereAndBack(clamp01((t - 0.035) / 0.965), ease, I);
    const swell = 1 + (0.18 + 0.22 * I);
    if (p.ribbon) {
      const g = clamp01(m);
      ctx.save();
      const bx = M.anchors.bowl[0], by = M.anchors.bowl[1];
      ctx.translate(bx, by + 40 * g * I); ctx.scale(1, 1 - 0.18 * g * I); ctx.translate(-bx, -by);
      M.ribbon(ctx, 0.12 * g * I, { colours: pal.ribbon, alpha: 1 - 0.2 * g });
      ctx.restore();
    }
    // drain: the far end of each line slides furthest; the tip lags so the bar pours down the stem
    const mc = clamp01(m), mcs = clamp01(mS);
    // and slump: everything sinks toward the baseline and spreads a little, like something warm
    const slump = (pts, mm, cx) => {
      const g = clamp01(mm) * (0.5 + 0.5 * I), base = 860;
      return pts.map((q) => [cx + (q[0] - cx) * (1 + 0.08 * g), base + (q[1] - base) * (1 - 0.22 * g)]);
    };
    const five = slump(blend(FIVE, BOWL5, m, (f) => 1 - f, 0, 0), m, 380);
    glyph5(ctx, five, M.lerp(M.widths.bar * k, M.widths.body * k * swell, mc), M.widths.body * k * M.lerp(1, swell, mc),
      mixList(col.fiveBar, col.bowlBar, mc), mixList(col.fiveBody, col.bowlBody, mc));
    const sPts = slump(blend(S_WHOLE, BOWLS, mS, (f) => 1 - f, 0, 0), mS, 760);
    M.stroke(ctx, sPts, { width: M.widths.s * k * M.lerp(1, swell, mcs), colours: mixList(col.s, col.sBowl, mcs) });
  }

  /* --- revolve, doubles and shell ----------------------------------------------------------------- */
  const AXIS = (C5[0] + CS[0]) / 2, MIDY = (C5[1] + CS[1]) / 2, HALF = Math.hypot(CS[0] - C5[0], CS[1] - C5[1]) / 2;
  const mirrorX = (pts) => pts.map((q) => [2 * AXIS - q[0], q[1]]);
  const S_M = mirrorX(S), FIVE_M = mirrorX(FIVE);           // each letter's shape seen from behind, in the other's place
  const at = (pts, from, to, k) => pts.map((q) => [to[0] + (q[0] - from[0]) * k, to[1] + (q[1] - from[1]) * k]);
  const S_BIG = at(S, CS, C5, MERGE_SCALE);                  // the s at the 5's size and place
  const FIVE_SMALL = at(FIVE, C5, CS, 1 / MERGE_SCALE);      // the 5 at the s's size and place
  const still = (ctx, p, env) => M.mark(ctx, { palette: env.palette, weight: p.weight, ribbon: p.ribbon });
  // a colour list pulled toward one colour by k
  const toward = (list, c, k) => (k <= 0.001 ? list : mixList(list, [[0, c], [1, c]], k));
  // where depth sinks to: the ribbon's violet, or the ground when the letters are already that colour (flat palettes)
  function depthColour(pal) {
    const v = M.colourAt(pal.ribbon, 0.3);
    return v.toLowerCase() === M.colourAt(pal.s, 0.5).toLowerCase() ? pal.bg : v;
  }
  // a letter morphing from the 5 (m = 0) to the s (m = 1), or back, with its widths and colours
  function letter(ctx, pts, m, k, col, tint, tk) {
    const mc = clamp01(m);
    glyph5(ctx, pts, M.lerp(M.widths.bar * k, M.widths.s * k, mc), M.lerp(M.widths.body * k, M.widths.s * k, mc),
      toward(mixList(col.fiveBar, col.sBar, mc), tint, tk), toward(mixList(col.fiveBody, col.sBody, mc), tint, tk));
  }
  const aboutPt = (ctx, c, sx, sy, draw) => { ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(sx, sy); ctx.translate(-c[0], -c[1]); draw(); ctx.restore(); };

  // revolve: a revolving door. The 5 and the s are its two wings, on a vertical axis between them; each wing's x
  // is scaled by cos(theta) about the axis, so at the quarter-turn both are edge-on slivers and at the half-turn
  // they have traded sides, each seen from behind: so while edge-on each morphs into the other mirrored, and
  // lands reading true. The near wing is larger and in front (seen from a little to one side, so the two slivers
  // part); the far one sinks toward the ribbon's violet.
  function revolve(ctx, t, p, env, I, ease) {
    if (t <= 0 || t >= 1) { still(ctx, p, env); return; }
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const dir = env.direction === 'left' ? -1 : 1;
    const turns = I >= 0.75 ? 2 : 1;                         // half a turn, or (intense) a full turn
    const u0 = win(t, 0.04, 0.84), s = M.smoothstep(0, 1, u0);
    const lean = -0.04 * bump(t / 0.1);
    const v = win(t, 0.84, 0.16), settle = 0.03 * (0.4 + 0.6 * I) * Math.sin(TAU * v) * (1 - v);
    const phase = turns * (0.5 * (ease(s) + s) + lean - settle);   // half-turns done
    const th = Math.PI * phase;
    const depth = 0.16 + 0.2 * I, cam = AXIS - dir * 170, sink = depthColour(pal);
    const cs = Math.cos(th), sn = Math.sin(th);
    const sx = (cs < 0 ? -1 : 1) * Math.max(0.1, Math.abs(cs));
    // which shape each wing shows: it changes while edge-on, lagging along the line
    const shapeAt = (from, to, lag) => {
      const h = Math.max(0, Math.floor(clamp01(phase / turns) * turns - 1e-9)), x = phase - h;   // this half-turn and how far into it
      const m = M.smoothstep(0.3, 0.7, x);
      return h % 2 === 0 ? { pts: blend(from, to, m, lag), m } : { pts: blend(to, from, m, (f) => 1 - lag(f)), m: 1 - m };
    };
    const wings = [
      { c: C5, sh: shapeAt(FIVE, S_M, (f) => 1 - f), five: true },
      { c: CS, sh: shapeAt(S, FIVE_M, (f) => f), five: false }
    ].map((w) => {
      const z = -dir * (w.c[0] - AXIS) * sn / HALF;           // -1 far .. 1 near
      return Object.assign(w, { z, sc: 1 + depth * z });
    });
    // the ribbon stays behind the door and turns once with it
    if (p.ribbon) M.ribbon(ctx, clamp01(phase / turns) * dir, { colours: pal.ribbon, alpha: 1 - 0.4 * bump(clamp01(phase / turns)) });
    // near wing last (at rest the s is on top)
    wings.sort((a, b) => (Math.abs(a.z - b.z) < 1e-6 ? (a.five ? -1 : 1) : a.z - b.z));
    for (const w of wings) {
      ctx.save();
      ctx.translate(cam, MIDY); ctx.scale(w.sc, w.sc); ctx.translate(-cam, -MIDY);   // perspective: about the eye
      ctx.translate(AXIS, 0); ctx.scale(sx, 1); ctx.translate(-AXIS, 0);              // the turn: x about the axis
      const m = w.five ? w.sh.m : 1 - w.sh.m;
      letter(ctx, w.sh.pts, m, k, col, sink, 0.35 * Math.max(0, -w.z));
      ctx.restore();
    }
  }

  // doubles: three beats, 5s -> ss -> 55 -> 5s: the 5 becomes a big s, then both become 5s, then the small 5 the s
  function doubles(ctx, t, p, env, I, ease) {
    if (t <= 0 || t >= 1) { still(ctx, p, env); return; }
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const dir = env.direction === 'left' ? -1 : 1;
    const B = [[0.06, 0.22], [0.38, 0.54], [0.7, 0.86]];
    // a beat's progress: a little lean back, the move, and a small settle past the end
    const beat = (b, d) => {
      const s = M.smoothstep(0, 1, win(t, b[0] + d, b[1] - b[0]));
      const lean = -0.06 * bump(win(t, b[0] + d - 0.02, 0.07));
      const v = win(t, b[1] + d, 0.08), settle = 0.06 * (0.4 + 0.6 * I) * Math.sin(TAU * v) * (1 - v);
      return 0.5 * (ease(s) + s) + lean - settle;
    };
    const kick = (b, d) => (0.06 + 0.16 * I) * bump(win(t, b[1] + d - 0.04, 0.12));
    const m1 = beat(B[0], 0), m2 = beat(B[1], 0), m2s = beat(B[1], 0.02), m3 = beat(B[2], 0);
    if (p.ribbon) {
      const r = (clamp01(m1) + clamp01(m2) + clamp01(m3)) / 3;
      M.ribbon(ctx, r * dir, { colours: pal.ribbon, alpha: 1 - 0.3 * bump(win(t, 0.03, 0.92)) });
    }
    // the big letter: 5 -> s (beat 1), s -> 5 (beat 2)
    let big, bm, bk;
    if (t < B[1][0] - 0.02) { big = blend(FIVE, S_BIG, m1, (f) => 1 - f); bm = m1; bk = kick(B[0], 0); }
    else { big = blend(S_BIG, FIVE, m2, (f) => f); bm = 1 - m2; bk = kick(B[1], 0); }
    // the small letter: s -> 5 (beat 2), 5 -> s (beat 3)
    let small, sm, sk;
    if (t < B[2][0] - 0.02) { small = blend(S, FIVE_SMALL, m2s, (f) => f); sm = 1 - m2s; sk = kick(B[1], 0.02); }
    else { small = blend(FIVE_SMALL, S, m3, (f) => 1 - f); sm = m3; sk = kick(B[2], 0); }
    const bigW = (m) => [M.lerp(M.widths.bar * k, 128 * k, clamp01(m)), M.lerp(M.widths.body * k, 128 * k, clamp01(m))];
    aboutPt(ctx, C5, 1 + bk, 1 + bk, () => {
      const [wb, wy] = bigW(bm), mc = clamp01(bm);
      glyph5(ctx, big, wb, wy, mixList(col.fiveBar, col.sBar, mc), mixList(col.fiveBody, col.sBody, mc));
    });
    aboutPt(ctx, CS, 1 + sk, 1 + sk, () => {
      const mc = clamp01(sm), w5 = M.widths.s * k;
      glyph5(ctx, small, M.lerp(w5 * 1.05, w5, mc), w5, mixList(col.fiveBar, col.sBar, mc), mixList(col.fiveBody, col.sBody, mc));
    });
  }

  // shell: a shell game. They trade places three times in quick arcs, each faster than the last, the one passing
  // in front larger; every pass is a morph, so each landing reads 5s again, and the last settles
  function shell(ctx, t, p, env, I, ease) {
    if (t <= 0 || t >= 1) { still(ctx, p, env); return; }
    const pal = env.palette, col = colourSets(pal), k = p.weight;
    const dir = env.direction === 'left' ? -1 : 1;
    const T0 = 0.04, MOVE = 0.8, SHARE = [0.4, 0.33, 0.27];
    const wins = [];
    let a = T0;
    for (const f of SHARE) { wins.push([a, a + MOVE * f]); a += MOVE * f; }
    let j = 0;
    for (let i = 0; i < 3; i++) if (t >= wins[i][0]) j = i;
    const s = M.smoothstep(0, 1, win(t, wins[j][0], wins[j][1] - wins[j][0]));
    let u = 0.5 * (ease(s) + s);
    if (j === 2) { const v = win(t, wins[2][1], 1 - wins[2][1] - 0.02); u -= 0.04 * (0.4 + 0.6 * I) * Math.sin(TAU * v) * (1 - v); }
    // the letters: A starts as the 5 on the left, B as the s on the right; on even passes A goes left to right
    const aGoesRight = j % 2 === 0;
    const L2R = aGoesRight ? 'A' : 'B';
    // the arc: perpendicular to the line between the places; over (up) on passes 1 and 3, under on 2; dir flips it
    const nx = -(CS[1] - C5[1]) / (2 * HALF), ny = (CS[0] - C5[0]) / (2 * HALF);   // unit normal, pointing down-left
    const h = HALF * (0.3 + 0.75 * I) * Math.sin(Math.PI * clamp01(u)) * dir * (j === 1 ? 1 : -1);
    const sink = depthColour(pal);
    const one = (who) => {
      const goesRight = who === L2R;
      const isFiveNow = who === 'A' ? j % 2 === 0 : j % 2 === 1;   // the 5 at the start of this pass
      const from = isFiveNow ? FIVE : S, to = isFiveNow ? S : FIVE;
      const lag = isFiveNow ? (f) => 1 - f : (f) => f;
      const sign = goesRight ? 1 : -1;
      const pts = blend(from, to, u, lag, nx * h * sign, ny * h * sign);
      const m = isFiveNow ? u : 1 - u;
      const c = [M.lerp(isFiveNow ? C5[0] : CS[0], isFiveNow ? CS[0] : C5[0], u) + nx * h * sign, M.lerp(isFiveNow ? C5[1] : CS[1], isFiveNow ? CS[1] : C5[1], u) + ny * h * sign];
      return { pts, m, c, front: goesRight };
    };
    const A = one('A'), Bq = one('B');
    if (p.ribbon) {
      const r = (j + clamp01(u)) / 3;
      M.ribbon(ctx, r * dir, { colours: pal.ribbon, alpha: 1 - 0.4 * bump(win(t, 0.02, 0.9)) });
    }
    const pass = Math.sin(Math.PI * clamp01(u));
    const draw = (q) => {
      const g = q.front ? 1 + 0.06 * pass : 1 - 0.03 * pass;
      aboutPt(ctx, q.c, g, g, () => letter(ctx, q.pts, q.m, k, col, sink, q.front ? 0 : 0.22 * pass));
    };
    // the one passing behind first; at the landings, the s on top (as at rest)
    const back = A.front ? Bq : A, fore = A.front ? A : Bq;
    if (pass > 0.02) { draw(back); draw(fore); }
    else { const five = A.m < 0.5 ? A : Bq, sl = five === A ? Bq : A; draw(five); draw(sl); }
  }

  Motion.register({
    id: 'morph',
    name: 'Morph',
    idea: 'The 5 melts into the s through their shared bowl, and back: traced from the tip of its bar, the 5 is the s with corners.',
    why: 'Moving between tabs, or taking a judgment back, is a change you can undo: the mark shows that the 5 and the s are one gesture, familiar and new.',
    moments: ['tab', 'undo'],
    styles: ['merge', 'exchange', 'melt', 'revolve', 'doubles', 'shell'],
    params: {
      duration: { default: 480, min: 250, max: 2000, step: 10 },
      style: { default: 'merge', options: ['merge', 'exchange', 'melt', 'revolve', 'doubles', 'shell'] },
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      const ease = M.easing(p.easing);
      const I = p.intensity;
      if (p.style === 'revolve') revolve(ctx, t, p, env, I, ease);
      else if (p.style === 'doubles') doubles(ctx, t, p, env, I, ease);
      else if (p.style === 'shell') shell(ctx, t, p, env, I, ease);
      else if (p.style === 'exchange') exchange(ctx, t, p, env, I, ease);
      else if (p.style === 'melt') melt(ctx, t, p, env, I, ease);
      else merge(ctx, t, p, env, I, ease);
    }
  });
})();

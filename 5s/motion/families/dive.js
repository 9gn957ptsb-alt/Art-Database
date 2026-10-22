/* 5s Motion Lab: Dive (22 Oct 2026, new).
 *
 * The view dives into the mark. The hollow of the 5's bowl rushes toward you until it fills the screen, you
 * pass through it, and on the other side the same 5s comes forward to rest: an endless mark. It is the only
 * family that moves the viewer instead of the mark: scale and passage, a camera going through the 5 into the
 * next place. One continuous move, no traces and no counted beats.
 *
 * Styles
 *   bowl    the camera dives into the counter of the 5's bowl. The counter fills with the bowl's own colour as
 *           it comes, the stroke sweeps past the frame edges and for a moment the screen is the bowl's colour.
 *           Then a window (the logo's rounded square) punches open in that field with the next mark inside it,
 *           tiny; the window rushes out past the edges and the mark comes forward to rest. The next mark is the
 *           same picture one level down (scale s / zoom about the dive's fixed point), so the two zooms are one
 *           move. The ribbon passes the camera as a violet blur.
 *   ess     down the s like a slide: the camera dives onto the s's top terminal and rides its curve down the
 *           spine into the lower bowl, turning as it goes (spin turns, the way env.direction says). For a beat
 *           the stroke is the whole frame, and the camera pulls back out of the s of a new mark, still turning
 *           the same way, to rest.
 *   tunnel  a Droste loop for waiting: the 5's counter holds a smaller 5s, whose counter holds another, and so
 *           on (levels stop below 2 px). Each level sits a spin turn round from the last. Over the duration the
 *           nest zooms in by exactly one level, so t = 0 and t = 1 are the same frame. Deeper levels are paler
 *           and tinted toward the ribbon's violet, so the depth reads.
 *
 * bowl and ess start and end on the crisp still mark. tunnel starts and ends on the mark with its nest inside.
 *
 * Params
 *   zoom       how far in the camera goes before the next mark takes over. bowl: how many times smaller the next
 *              mark starts (the depth of the dive); ess: how deep into the stroke the camera goes at the deepest
 *              beat (at least far enough for the stroke to fill the frame); tunnel: how much smaller each level is
 *              than the one around it (4.6x at zoom 4, 5x at 16, 6x at 40: it has to fit the counter)
 *   spin       turns of roll over the move, the way env.direction says (tunnel: per level, a spiral)
 *   intensity  how hard it hits. bowl: the passing ribbon's blur, the next mark's ribbon turning as it comes, the
 *              landing's pop; ess: how close the ride runs to the stroke and the blur; tunnel: how deep the levels
 *              sink into the violet, and the blur of the level passing the camera
 *   palette, ribbon, weight and easing as every family (the easing shapes the whole dive in bowl and tunnel, and
 *   the pull-back in ess, whose ride down the s keeps a steady pace so it can be read)
 *
 * Only the camera moves: no layer of translucent copies anywhere. The colour floods, the window and the levels are
 * all flat, so every style holds in one colour (paper, ink) as well as in the logo's gradients.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;

  // the strokes, resampled finely: the camera goes deep, and a coarse polyline would show its facets up close
  // (at rest and up to 2x, the same 160 points Marks.mark uses, so the still mark at either end is the engine's own
  // still mark, pixel for pixel)
  const PTS = { bar: M.points('bar', 160), body: M.points('body', 480), s: M.points('s', 360) };
  const PTS0 = { bar: M.points('bar', 160), body: M.points('body', 160), s: M.points('s', 160) };
  const FRAME = M.points('frame', 256);
  const S_CUM = (() => { const p = PTS.s, c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; })();

  const C = A.bowl;      // the counter of the 5's bowl: the next mark's letters sit centred on it
  const LET = A.letters; // the letters' centre
  const MID = [500, 500];

  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  // an easing with its ends pinned: some curves (outBack) land a hair off 0 at t = 0, and the ends must be exact
  const eased = (ease, t) => (t <= 0 ? 0 : t >= 1 ? 1 : ease(t));
  const sstep = (t, a, b) => { const x = span(t, a, b); return x * x * (3 - 2 * x); };

  // the s's direction along its length (radians, unwrapped, relative to its top terminal), 64 samples
  const S_TURN = (() => {
    const out = [], n = 64;
    let prev = null, acc = 0;
    for (let i = 0; i <= n; i++) {
      const a = M.at(PTS.s, Math.min(0.999, Math.max(0.001, i / n))).angle;
      if (prev != null) { let d = a - prev; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; acc += d; }
      prev = a; out.push(acc);
    }
    return out;
  })();
  const sTurn = (u) => { const x = M.clamp(u, 0, 1) * (S_TURN.length - 1), i = Math.min(S_TURN.length - 2, Math.floor(x)); return M.lerp(S_TURN[i], S_TURN[i + 1], x - i); };

  // a point on the s at fraction u of its length
  function sAt(u) {
    const p = PTS.s, L = S_CUM[S_CUM.length - 1], s = M.clamp(u, 0, 1) * L;
    let j = 0;
    while (j < p.length - 2 && S_CUM[j + 1] < s) j++;
    const seg = S_CUM[j + 1] - S_CUM[j], f = seg > 0 ? (s - S_CUM[j]) / seg : 0;
    return [p[j][0] + (p[j + 1][0] - p[j][0]) * f, p[j][1] + (p[j + 1][1] - p[j][1]) * f];
  }

  // colours: the palette's stops (plain list or [u, hex] pairs) pulled toward one colour by k
  function tint(stops, colour, k) {
    if (!(k > 0.001)) return stops;
    return stops.map((s) => (Array.isArray(s) ? [s[0], M.mix(s[1], colour, k)] : M.mix(s, colour, k)));
  }
  const flatPal = (pal) => pal.name === 'paper' || pal.name === 'ink';
  // the colour of the bowl (the flood): the body's gradient where it rounds the bowl
  const bowlColour = (pal) => M.colourAt(pal.body, 0.7);
  // the violet the deep levels sink into (one colour on the flat palettes: the ink, a little toward the ground)
  const deepColour = (pal) => (flatPal(pal) ? M.mix(pal.five[0], pal.bg, 0.55) : M.colourAt(pal.ribbon, 0.3));

  // the counter of the bowl as a closed shape: the body's centreline from the foot of the stem round the bowl
  // to its terminal, closed across the mouth (drawn under the strokes, so only the mouth's chord shows)
  const BOWL = (() => {
    const b = PTS.body;
    let i0 = 0, best = Infinity;
    for (let i = 0; i < b.length; i++) { const d = Math.hypot(b[i][0] - 160, b[i][1] - 491); if (d < best) { best = d; i0 = i; } }
    return b.slice(i0);
  })();
  function counterPath(c) {
    c.beginPath();
    c.moveTo(BOWL[0][0], BOWL[0][1]);
    for (let i = 1; i < BOWL.length; i++) c.lineTo(BOWL[i][0], BOWL[i][1]);
    c.closePath();
  }

  // one whole mark (ribbon, 5, s) in the current transform.
  // o: {scale (on screen, picks the sampling), ribbonT, ribbonBlur, ribbonAlpha, tintK, tintTo (pull every colour toward one), fadeK (and then toward
  // the ground: a level seen through depth, without the cost of a translucent layer)}
  function mark(ctx, pal, p, o) {
    o = o || {};
    const k = p.weight, tk = o.tintK || 0, to = o.tintTo, fk = o.fadeK || 0;
    const P = o.scale > 2 ? PTS : PTS0;
    const col = (stops, kk) => tint(tint(stops, to, kk), pal.bg, fk);
    const ra = o.ribbonAlpha == null ? 1 : o.ribbonAlpha;
    if (p.ribbon && ra > 0.01) {
      const rib = (r) => M.ribbon(r, o.ribbonT || 0, { colours: col(pal.ribbon, tk * 0.5), alpha: ra });
      // (blurred at half or quarter resolution: the soft ribbon loses nothing, and a full-size blur is costly)
      const b = Math.min(60, o.ribbonBlur || 0);
      if (b > 3) M.layer(ctx, { blur: b, resolution: b >= 12 ? 0.25 : 0.5 }, rib); else rib(ctx);
    }
    M.stroke(ctx, P.body, { width: M.widths.body * k, colours: col(pal.body, tk) });
    M.stroke(ctx, P.bar, { width: M.widths.bar * k, colours: col(pal.bar, tk) });
    M.stroke(ctx, P.s, { width: M.widths.s * k, colours: col(pal.s, tk) });
  }

  // run draw(ctx) with mark space mapped by x -> F + scale * Rot(rot) * (x - F)
  function about(ctx, F, scale, rot, draw) {
    if (scale === 1 && !rot) { draw(ctx); return; }   // at rest: no transform at all, so the still mark is exact
    ctx.save();
    ctx.translate(F[0], F[1]);
    if (rot) ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.translate(-F[0], -F[1]);
    draw(ctx);
    ctx.restore();
  }

  // the corners of the visible box (mark units, the canvas's own frame)
  const corners = (v) => [[v.x0, v.y0], [v.x1, v.y0], [v.x1, v.y1], [v.x0, v.y1]];
  const farthest = (v, F) => Math.max(...corners(v).map((q) => Math.hypot(q[0] - F[0], q[1] - F[1])));

  // how near the letters' edges come to F (mark units, at stroke weight k)
  const clearCache = new Map();
  function clearance(F, k) {
    const key = F[0].toFixed(1) + ',' + F[1].toFixed(1) + ',' + k.toFixed(3);
    let m = clearCache.get(key);
    if (m == null) {
      m = Infinity;
      for (const n of ['bar', 'body', 's']) {
        const w = (M.widths[n] * k) / 2;
        for (const q of PTS[n]) m = Math.min(m, Math.hypot(q[0] - F[0], q[1] - F[1]) - w);
      }
      m = Math.max(20, m);
      if (clearCache.size > 64) clearCache.clear();
      clearCache.set(key, m);
    }
    return m;
  }

  // the logo's rounded square (outer edge 0..1000, corner radius 256), scaled by h about its centre
  function tilePath(c, h) {
    const a = 500 * h, r = 256 * h, x0 = 500 - a, y0 = 500 - a, x1 = 500 + a, y1 = 500 + a;
    c.beginPath();
    c.moveTo(x0 + r, y0);
    c.arcTo(x1, y0, x1, y1, r);
    c.arcTo(x1, y1, x0, y1, r);
    c.arcTo(x0, y1, x0, y0, r);
    c.arcTo(x0, y0, x1, y0, r);
    c.closePath();
  }
  // is the point q (in the tile's own units, before scaling by h) inside the rounded square scaled by h?
  function inTile(q, h) {
    const dx = Math.max(0, Math.abs(q[0] - 500) - 244 * h), dy = Math.max(0, Math.abs(q[1] - 500) - 244 * h);
    if (Math.abs(q[0] - 500) > 500 * h || Math.abs(q[1] - 500) > 500 * h) return false;
    return dx * dx + dy * dy <= 256 * h * 256 * h;
  }
  // the smallest h for which the rounded square covers every point in qs
  function coverH(qs) {
    let lo = 0, hi = 1;
    while (!qs.every((q) => inTile(q, hi))) hi *= 2;
    for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (qs.every((q) => inTile(q, m))) hi = m; else lo = m; }
    return hi;
  }
  // a point of the canvas (mark units) in the coordinates of a level drawn at x -> F + s Rot(r) (x - F)
  function toLevel(q, F, s, r) {
    const dx = q[0] - F[0], dy = q[1] - F[1], c = Math.cos(-r), n = Math.sin(-r);
    return [F[0] + (dx * c - dy * n) / s, F[1] + (dx * n + dy * c) / s];
  }

  /* ---------------------------------------------------------------------------------------------------------
   * bowl: through the counter into the next mark
   * ------------------------------------------------------------------------------------------------------- */
  const LO = 0.4;                // the outer mark has passed the camera by this much of the move
  const LA = 0.38, LB = 0.8;     // the window opens (as the last of the stroke sweeps off), and has passed the frame's edges

  function bowl(ctx, t, p, env, pal) {
    const ease = M.easing(p.easing), I = p.intensity, k = p.weight;
    const K = p.zoom, dir = env.direction === 'left' ? -1 : 1, R = p.spin * TAU * dir;
    const lam = eased(ease, t);
    // the dive's fixed point: the next mark (scale 1/K, letters centred on the counter) maps onto itself
    const F = [(K * C[0] - LET[0]) / (K - 1), (K * C[1] - LET[1]) / (K - 1)];
    const v = env.view;
    const Vmax = farthest(v, F);
    const clear = clearance(F, k);
    const G = 1.12 * Vmax / clear;                          // the outer mark's scale when its counter clears the frame
    const outerScale = (l) => Math.exp(Math.log(G) * l / LO);
    const roll = R * lam;
    const flood = flatPal(pal) ? pal.five[0] : bowlColour(pal);

    // the next mark: one level down, rolled back by the spin it will turn through
    // (an easing that overshoots, like outBack, carries the landing past rest: kept to a pop whatever the zoom)
    let sIn = lam <= 1 ? Math.pow(K, lam - 1) : 1 + 0.8 * (lam - 1);
    const land = span(t, 0.5, 1);
    sIn *= 1 + 0.09 * I * Math.sin(Math.PI * land) * Math.pow(1 - land, 1.5);   // the landing's pop
    const rIn = roll - R;

    // the window: the next mark's rounded square, opening from a point and rushing out past the frame
    const qs = corners(v).map((q) => toLevel(q, F, sIn, rIn));
    let covered = false;
    let h = 0;
    if (lam > LA) {
      const sB = Math.pow(K, LB - 1);
      const hB = 1.06 * coverH(corners(v).map((q) => toLevel(q, F, sB, R * LB - R)));
      const x = (lam - LA) / (LB - LA);
      h = hB * Math.pow(x, 2.2);
      covered = qs.every((q) => inTile(q, h));
    }

    if (!covered) {
      // the flood: the counter fills with the bowl's colour (from its centre out, in a blink), then rides the
      // dive until it is the whole frame
      const fill = sstep(lam, 0.015, 0.11);
      if (fill > 0) {
        ctx.save();
        ctx.fillStyle = flood;
        if (lam >= LO) ctx.fillRect(v.x0 - 2, v.y0 - 2, v.x1 - v.x0 + 4, v.y1 - v.y0 + 4);
        else {
          about(ctx, F, outerScale(lam), roll, (c) => {
            if (fill < 1) { c.beginPath(); c.arc(F[0], F[1], 20 + 260 * fill, 0, TAU); c.clip(); }
            counterPath(c);
            c.fill();
          });
        }
        ctx.restore();
      }
      if (h > 0) {
        about(ctx, F, sIn, rIn, (c) => {
          c.save();
          tilePath(c, h);
          c.fillStyle = pal.bg;
          c.fill();
          c.clip();
          mark(c, pal, p, { scale: sIn, ribbonT: 0.15 * I * (1 - lam) });
          c.restore();
          // the window's edge: the logo's frame
          c.save();
          c.translate(500, 500); c.scale(h, h); c.translate(-500, -500);
          M.stroke(c, FRAME, { width: M.widths.frame * k, colours: pal.frame });
          c.restore();
        });
      }
    } else {
      about(ctx, F, sIn, rIn, (c) => mark(c, pal, p, { scale: sIn, ribbonT: 0.15 * I * (1 - lam) }));
    }

    // the outer mark, racing past the camera; the ribbon, nearest the lens, goes soft with the speed
    if (lam < LO) {
      const so = outerScale(lam);
      const blur = (4 + 14 * I) * Math.max(0, so - 1) * (env.scale || 1) * (env.dpr || 1);
      about(ctx, F, so, roll, (c) => mark(c, pal, p, { scale: so, ribbonBlur: blur }));
    }
  }

  /* ---------------------------------------------------------------------------------------------------------
   * ess: down the s like a slide
   * ------------------------------------------------------------------------------------------------------- */
  const US = 0.66;            // where on the s (fraction of its length) the camera is at its deepest
  const TA = 0.5, TB = 0.56;  // the deepest beat: the frame is all stroke from TA to TB, then the pull-back

  function ess(ctx, t, p, env, pal) {
    const ease = M.easing(p.easing), I = p.intensity, k = p.weight;
    const dir = env.direction === 'left' ? -1 : 1, R = p.spin * TAU * dir;
    const v = env.view;
    const diag = Math.hypot(v.x1 - v.x0, v.y1 - v.y0);
    const Zs = Math.max(p.zoom, 1.15 * diag / (M.widths.s * k));   // deep enough that the stroke fills the frame
    let u, attach, z, roll;
    if (t < TB) {
      // in and down: the camera drops onto the s's top terminal, then rides the curve down the spine into
      // the lower bowl, going deeper until the stroke is the frame (a steady ride: the easing is the landing's)
      const a = Math.min(1, t / TA);
      attach = M.ease.outCubic(span(a, 0, 0.3));
      u = US * M.ease.inOutSine(span(a, 0.12, 1));
      z = (0.42 + 0.1 * I) * M.ease.outCubic(span(a, 0, 0.3)) + (0.58 - 0.1 * I) * M.ease.inOutCubic(span(a, 0.62, 1));
      roll = 0.5 * R * M.ease.inOutSine(a);
    } else {
      // out of a new mark's s: the mark was swapped at the deepest beat for one rolled back by the turn still
      // to come, so the camera keeps turning the same way and lands upright
      const b = eased(ease, span(t, TB, 1));
      attach = 1 - b;
      u = US + (1 - US) * M.ease.outCubic(span(t, TB, 1));
      z = 1 - b;
      roll = -0.5 * R * (1 - b);
    }
    // the camera also turns with the s's own curve as it rides it (more of it with more spin), so the slide
    // swings left and right under it
    const follow = Math.min(1, 2.5 * p.spin);
    roll -= follow * attach * sTurn(u);
    const Z = Math.exp(Math.log(Zs) * z);
    const P = sAt(u);
    const cx = MID[0] + (P[0] - MID[0]) * attach, cy = MID[1] + (P[1] - MID[1]) * attach;
    ctx.save();
    if (Z !== 1 || roll || cx !== MID[0] || cy !== MID[1]) ctx.translate(MID[0], MID[1]);   // (at rest: untouched)
    else { mark(ctx, pal, p, { scale: 1 }); ctx.restore(); return; }
    if (roll) ctx.rotate(roll);
    ctx.scale(Z, Z);
    ctx.translate(-cx, -cy);
    const blur = (3 + 8 * I) * Math.max(0, Z - 1) * (env.scale || 1) * (env.dpr || 1) * 0.5;
    mark(ctx, pal, p, { scale: Z, ribbonT: t > 0 && t < 1 ? 0.25 * I * Math.sin(Math.PI * t) : 0, ribbonBlur: blur });
    ctx.restore();
  }

  /* ---------------------------------------------------------------------------------------------------------
   * tunnel: the nest, one level a loop
   * ------------------------------------------------------------------------------------------------------- */
  function tunnel(ctx, t, p, env, pal) {
    const ease = M.easing(p.easing), I = p.intensity, k = p.weight;
    const KN = 4.4 + 0.04 * p.zoom;   // each level is this many times smaller than the one around it (it fits the counter)
    const dir = env.direction === 'left' ? -1 : 1, R = p.spin * TAU * dir;
    const lam = eased(ease, t);
    // the nest map T: x -> C + Rot(-R) (x - LET) / KN; its fixed point F is where the tunnel goes
    const c = Math.cos(-R) / KN, s = Math.sin(-R) / KN;
    const bx = C[0] - (c * LET[0] - s * LET[1]), by = C[1] - (s * LET[0] + c * LET[1]);
    const a11 = 1 - c, a12 = s, a21 = -s, a22 = 1 - c, det = a11 * a22 - a12 * a21;
    const F = [(bx * a22 - a12 * by) / det, (a11 * by - a21 * bx) / det];
    // the level passing the camera is nearer than the rest, so it races ahead (parallax) and clears the frame
    // by the time the next level is at rest: no fade, it simply leaves
    const Gt = Math.max(KN * 1.01, 1.12 * farthest(env.view, F) / clearance(F, k));
    const cpass = Math.log(Gt / KN);
    const deep = deepColour(pal);
    const px = env.scale || 1;
    for (let i = 7; i >= -1; i--) {
      const d = i - lam;                          // depth: 0 is the resting mark, -1 has passed
      if (d <= -1) continue;
      let sc = Math.pow(KN, -d);
      if (d < 0) sc *= Math.exp(cpass * d * d);
      const size = sc * 1000 * px;                // the level's size on screen, px
      if (size < 2) continue;                     // below 2 px: stop
      const fadeK = d <= 0 ? 0 : 1 - Math.pow(1 - (0.1 + 0.12 * I), d);
      const tk = d <= 0 ? 0 : Math.min(0.9, (0.3 + 0.4 * I) * Math.pow(d, 0.8));
      const blur = d < 0 ? (4 + 14 * I) * Math.max(0, sc - 1) * px * (env.dpr || 1) : 0;
      const ribbonAlpha = sstep(size, 14, 36);    // a level too small to show its ribbon's strands leaves it out
      about(ctx, F, sc, -R * d, (cc) => mark(cc, pal, p, { scale: sc, fadeK, tintK: tk, tintTo: deep, ribbonBlur: blur, ribbonAlpha }));
    }
  }

  Motion.register({
    id: 'dive',
    name: 'Dive',
    idea: 'The view dives into the mark: the hollow of the 5\'s bowl rushes toward you until it fills the screen, you pass through it, and on the other side the same 5s comes forward to rest.',
    why: 'Changing place is what a transition is: a dive through the bowl goes somewhere (one tab into another, the splash into the app, a card into Split), and the mark at the end is the one you started with: familiar, and new.',
    moments: ['tab', 'launch', 'split', 'path', 'turn'],
    styles: ['bowl', 'ess', 'tunnel'],
    params: {
      duration: { default: 700, min: 250, max: 3000, step: 50 },
      style: { default: 'bowl', options: ['bowl', 'ess', 'tunnel'] },
      zoom: { default: 16, min: 4, max: 40, step: 1 },        // how far in the camera goes before the next mark takes over
      spin: { default: 0.1, min: 0, max: 0.5, step: 0.01 }    // turns of roll over the move (tunnel: per level)
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      if (p.style === 'ess') ess(ctx, t, p, env, pal);
      else if (p.style === 'tunnel') tunnel(ctx, t, p, env, pal);
      else bowl(ctx, t, p, env, pal);
    }
  });
})();

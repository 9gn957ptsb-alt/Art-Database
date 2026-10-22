/* 5s Motion Lab: Swipe (Gesture & judgment).
 *
 * The s is the swipe. A judgment in Sort is a drag right (Keep) or left (Pass); here the mark makes that
 * gesture: it rides an S-curve off to the side and leaves a trail of its own colours that fades, and the
 * next mark comes up from underneath, the way the next card is waiting under the one you just judged.
 *
 * env.direction says which way: 'right' for keep, 'left' for pass (the lab sets it from the moment).
 * With trail 'auto' a keep leaves the letters' warm colours and a pass leaves a clean cobalt.
 *
 * Styles
 *   ride     the whole mark leans back, then rides a long S out of the frame (the s leads, the ribbon
 *            drags); three streaks (bar, bowl, s) stay behind and fade, and the next mark rises
 *   s-trail  only the s goes: it peels out of the bowl and swoops along an S, stretching into its own
 *            trail; the 5 leans after it, then the s is written back into the bowl
 *   flick    a small yes / a light no: the mark nods along a short S toward the side, smearing into
 *            ghosts, and swings back past centre before it settles
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only; t = 1 is the still mark, centred.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const C = A.letters;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const inOf = (e) => (x) => 1 - e(1 - x);                 // an easing's "in" mirror: what settles also launches
  const antic = (x) => (x <= 0 || x >= 1 ? 0 : 6.75 * x * (1 - x) * (1 - x));   // 0 -> 1 (at 1/3) -> 0, flat at 1

  // move a drawing: translate (x, y), then rotate r and scale k about origin o
  function place(ctx, o, x, y, r, k, draw) {
    ctx.save();
    ctx.translate(o[0] + x, o[1] + y);
    if (r) ctx.rotate(r);
    if (k !== 1) ctx.scale(k, k);
    ctx.translate(-o[0], -o[1]);
    draw(ctx);
    ctx.restore();
  }
  // the same transform applied to a point
  function placed(pt, o, x, y, r, k) {
    const dx = (pt[0] - o[0]) * k, dy = (pt[1] - o[1]) * k, c = Math.cos(r), s = Math.sin(r);
    return [o[0] + x + dx * c - dy * s, o[1] + y + dx * s + dy * c];
  }

  function five(ctx, p, pal, o) {
    o = o || {};
    M.stroke(ctx, PTS.body, { width: M.widths.body * p.weight, colours: pal.body, to: o.to });
    M.stroke(ctx, PTS.bar, { width: M.widths.bar * p.weight, colours: pal.bar, to: o.to });
  }
  function ess(ctx, p, pal, o) {
    o = o || {};
    M.stroke(ctx, PTS.s, { width: M.widths.s * p.weight, colours: pal.s, to: o.to == null ? 1 : o.to });
  }
  function ribbon(ctx, p, pal, rt, alpha) {
    if (p.ribbon) M.ribbon(ctx, rt || 0, { colours: pal.ribbon, alpha: alpha == null ? 1 : alpha });
  }
  // the mark with its parts staggered: f = {x, y, r, k} for the 5, s = the s's own, rb = the ribbon's
  function mark(ctx, p, pal, f, s, rb) {
    place(ctx, C, rb.x, rb.y, rb.r, rb.k, (c) => ribbon(c, p, pal, rb.t, rb.alpha));
    place(ctx, C, f.x, f.y, f.r, f.k, (c) => five(c, p, pal));
    place(ctx, C, s.x, s.y, s.r, s.k, (c) => ess(c, p, pal));
  }
  function still(ctx, p, pal) {
    ribbon(ctx, p, pal, 0, 1); five(ctx, p, pal); ess(ctx, p, pal);
  }

  /* the S the mark rides, as offsets from rest for a swipe to the right (x is mirrored for left):
   * a dip (the weight going in), an inflection, then a lift and out. Built once per (D, depth). */
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
  // for an s leaving to the left: down and under the bowl (behind the 5), then up and out past its terminal
  function swoop(D, depth) {
    const P = [[0, 0], [0.06 * D, 1.05 * depth], [0.55 * D, 1.25 * depth], [D, 0.25 * depth]];
    const out = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, v = 1 - u;
      out.push([v * v * v * P[0][0] + 3 * v * v * u * P[1][0] + 3 * v * u * u * P[2][0] + u * u * u * P[3][0],
                v * v * v * P[0][1] + 3 * v * v * u * P[1][1] + 3 * v * u * u * P[2][1] + u * u * u * P[3][1]]);
    }
    return M.resample(out, 65);
  }
  // position and heading at progress q (q < 0 backs up along the first tangent: the anticipation)
  function along(curve, q) {
    if (q >= 0) return M.at(curve, Math.min(1, q));
    const a = M.at(curve, 0), end = curve[curve.length - 1], L = Math.hypot(end[0] - curve[0][0], end[1] - curve[0][1]);
    return { x: Math.cos(a.angle) * q * L, y: Math.sin(a.angle) * q * L, angle: a.angle };
  }

  // a tapered streak along a polyline: zero width and clear at its tail (first point), w and alpha a at its head
  function streak(ctx, pts, w, colour, a, glow) {
    const n = pts.length;
    if (n < 2 || a <= 0.002) return;
    let L = 0;
    for (let i = 1; i < n; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (L < 2) return;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1;
      const u = i / (n - 1), hw = (w / 2) * Math.pow(Math.min(1, u / 0.55), 0.85);   // a comet: thin tail, full body
      left.push([pts[i][0] - (dy / d) * hw, pts[i][1] + (dx / d) * hw]);
      right.push([pts[i][0] + (dy / d) * hw, pts[i][1] - (dx / d) * hw]);
    }
    const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[n - 1][0], pts[n - 1][1]);
    g.addColorStop(0, M.rgba(colour, 0));
    g.addColorStop(0.35, M.rgba(colour, a * 0.7));
    g.addColorStop(0.7, M.rgba(colour, a));
    g.addColorStop(1, M.rgba(colour, a));
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    const hp = pts[n - 1], hd = Math.atan2(hp[1] - pts[n - 2][1], hp[0] - pts[n - 2][0]);
    ctx.arc(hp[0], hp[1], w / 2, hd - Math.PI / 2, hd + Math.PI / 2);   // a round head
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
    if (glow) {   // a thin bright core along the streak: light caught in the swipe
      const g2 = ctx.createLinearGradient(pts[0][0], pts[0][1], hp[0], hp[1]);
      g2.addColorStop(0, M.rgba(glow, 0));
      g2.addColorStop(1, M.rgba(glow, a * 0.7));
      ctx.strokeStyle = g2; ctx.lineWidth = Math.max(2, w * 0.12); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pts[Math.floor(n * 0.25)][0], pts[Math.floor(n * 0.25)][1]);
      for (let i = Math.floor(n * 0.25) + 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the trail's colours: the letters' own, or a judgment's (keep warm, pass cool)
  function trailColours(p, pal, dir) {
    const letters = { bar: M.colourAt(pal.bar, 0.8), body: M.colourAt(pal.body, 0.55), s: M.colourAt(pal.s, 0.6), glow: M.mix(M.colourAt(pal.bar, 1), '#FFFFFF', 0.5) };
    const warm = { bar: M.mix(pal.ember, '#FFD27A', 0.4), body: pal.ember, s: pal.flare, glow: M.mix(pal.ember, '#FFFFFF', 0.6) };
    const cool = { bar: M.mix(pal.cobalt, '#FFFFFF', 0.35), body: pal.cobalt, s: M.mix(pal.cobalt, pal.iris, 0.45), glow: M.mix(pal.cobalt, '#FFFFFF', 0.7) };
    let mode = p.trail;
    if (mode === 'auto') mode = (pal.name === 'logo' || pal.name === 'inverse') ? (dir > 0 ? 'letters' : 'cool') : 'letters';
    return mode === 'warm' ? warm : mode === 'cool' ? cool : letters;
  }

  // where each letter's streak starts, in mark space: the bar's middle, the foot of the bowl, the s's spine
  const SEEDS = { bar: [470, 231], body: [430, 728], s: [800, 668] };   // each on its own stroke

  /* ---------------------------------------------------------------------------------------------- */

  function ride(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const v = env.view;
    const span = (v.x1 - v.x0);
    const D = span * 1.05 + 120 * I;                        // far enough that the whole mark leaves
    const depth = 50 + 110 * I;
    const curve = sCurve(D, depth);
    const OUT = 0.46;                                        // the ride ends (off frame) at t = 0.46
    // overlap: the letter at the front of the motion leads (the s going right, the 5 going left), the ribbon drags
    const lead = 0.03 * dir, drag = 0.035;
    const prog = (x) => { x = M.clamp(x, 0, 1); return 0.8 * M.ease.inCubic(x) + 0.2 * M.ease.inQuad(x) - (0.03 + 0.03 * I) * antic(Math.min(1, x * 1.6)); };
    const pose = (tt) => {
      const x = seg(tt, 0, OUT), q = prog(x), a = along(curve, q);
      const lift = M.smoothstep(0.15, 0.9, q);
      return {
        x: dir * a.x, y: a.y, q,
        r: dir * ((0.05 + 0.2 * I) * lift + 0.35 * a.angle * M.smoothstep(0, 0.4, q)) - dir * (0.04 + 0.05 * I) * antic(x),
        k: 1 - 0.1 * lift + 0.03 * antic(x)
      };
    };
    // the s's lead grows in over the first instant, so t = 0 is exactly the still mark (no pop as it starts)
    const P5 = pose(t), PS = pose(t + lead * M.smoothstep(0, 0.1, t)), PR = pose(t - drag);
    const tc = trailColours(p, pal, dir);

    // the trail: one streak per letter, from where it started to where it is now; it fades and pulls away
    const fade = 1 - M.smoothstep(0.5, 0.96, t);
    if (fade > 0.002 && P5.q > 0.02) {
      const head = Math.min(1.12, P5.q), len = (0.5 + 0.35 * I) * (1 - 0.9 * M.ease.inOutSine(seg(t, 0.46, 0.96)));
      const tail = Math.max(0, head - len);
      const parts = [['body', P5, M.widths.body], ['bar', P5, M.widths.bar], ['s', PS, M.widths.s]];
      for (const [name, P, w] of parts) {
        const pts = [];
        for (let i = 0; i <= 28; i++) {
          const q = tail + ((Math.min(head, name === 's' ? PS.q : head) - tail) * i) / 28;
          const a = along(curve, q), lift = M.smoothstep(0.15, 0.9, q);
          const r = dir * ((0.05 + 0.2 * I) * lift + 0.35 * a.angle * M.smoothstep(0, 0.4, q));
          pts.push(placed(SEEDS[name], C, dir * a.x, a.y, r, 1 - 0.1 * lift));
        }
        streak(ctx, pts, w * p.weight * (0.62 + 0.3 * I), tc[name], (0.7 + 0.3 * I) * fade, name === 'bar' ? tc.glow : null);
      }
    }

    // the next mark comes up from underneath
    const x2 = seg(t, 0.36, 1);
    if (x2 > 0) {
      const a2 = M.smoothstep(0, 0.12, x2), k2 = 0.7 + 0.3 * e(x2);
      const rib = seg(t, 0.55, 1);
      M.layer(ctx, { alpha: a2 }, (c) => {
        place(c, C, 0, 26 * (1 - e(rib)), 0, 0.88 + 0.12 * e(rib), (cr) => ribbon(cr, p, pal, -0.12 * (1 - e(rib)), M.smoothstep(0, 0.6, rib)));
        place(c, C, 0, 30 * (1 - e(x2)), 0, k2, (cl) => { five(cl, p, pal); ess(cl, p, pal); });
      });
    }

    // the mark riding out (drawn last: it is the card on top)
    if (P5.q < 1.05) {
      mark(ctx, p, pal,
        { x: P5.x, y: P5.y, r: P5.r, k: P5.k },
        { x: PS.x, y: PS.y, r: PS.r, k: PS.k },
        { x: PR.x, y: PR.y, r: PR.r, k: PR.k, t: 0.25 * I * PR.q, alpha: 1 });
    }
  }

  function sTrail(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const v = env.view;
    const OUT = 0.52;
    // the s's own S: it dips out of the bowl, then lifts away; to the left it passes in front of the 5
    const D = dir > 0 ? (v.x1 - 600) + 260 + 120 * I : (980 - v.x0) + 120 * I;
    // to the right a shallow S; to the left a deep one that ducks under the bowl, behind the 5
    const curve = dir > 0 ? sCurve(D, 70 + 90 * I) : swoop(D, 230 + 40 * I);
    const x = seg(t, 0, OUT);
    const q = 0.75 * M.ease.inCubic(x) + 0.25 * M.ease.inQuad(x) - (0.025 + 0.03 * I) * antic(Math.min(1, x * 1.5));
    const a = along(curve, q);
    const lift = M.smoothstep(0.1, 0.8, q);
    const sr = dir * ((0.1 + 0.3 * I) * lift + 0.3 * a.angle * M.smoothstep(0, 0.3, q)) - dir * 0.08 * antic(x);
    const sk = 1 - (dir > 0 ? 0.12 : 0.34) * lift + 0.06 * antic(x);
    const tc = trailColours(p, pal, dir);

    // the 5 leans after the s, then settles with a little follow-through
    const lean = Math.sin(Math.PI * seg(t, 0.06, 0.55)) * (1 - seg(t, 0.55, 0.94));
    const back = seg(t, 0.5, 0.94);
    const fiveR = dir * (0.035 + 0.05 * I) * (lean - 0.35 * Math.sin(Math.PI * back) * (1 - back));
    const fiveX = dir * (10 + 18 * I) * lean;

    // the ribbon turns as the s leaves, and turns back as it returns
    const rt = 0.18 * I * Math.sin(Math.PI * seg(t, 0.05, 0.94));
    place(ctx, A.bowl, fiveX * 0.5, 0, fiveR * 0.6, 1, (c) => ribbon(c, p, pal, rt, 1));

    // the trail the s leaves: its own centreline, stretched out along the S behind it
    const fade = 1 - M.smoothstep(0.42, 0.86, t);
    if (q > 0.02 && fade > 0.002) {
      const len = (0.5 + 0.3 * I) * (1 - 0.8 * seg(t, 0.46, 0.9)), tail = Math.max(0, q - len);
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const qq = tail + ((Math.min(1, q) - tail) * i) / 30, aa = along(curve, qq), l2 = M.smoothstep(0.1, 0.8, qq);
        const r2 = dir * ((0.1 + 0.3 * I) * l2 + 0.3 * aa.angle * M.smoothstep(0, 0.3, qq));
        pts.push(placed(A.s, A.s, dir * aa.x, aa.y, r2, 1 - (dir > 0 ? 0.12 : 0.34) * l2));
      }
      streak(ctx, pts, M.widths.s * p.weight * (1.1 + 0.5 * I), tc.s, (0.38 + 0.4 * I) * fade, tc.glow);
    }

    // the s riding out: to the right in front, to the left it slips behind the 5 (as the ribbon does)
    const sOut = () => { if (q < 1) place(ctx, A.s, dir * a.x, a.y, sr, sk, (c) => ess(c, p, pal)); };
    if (dir < 0) sOut();
    place(ctx, A.bowl, fiveX, 0, fiveR, 1, (c) => five(c, p, pal));
    if (dir > 0) sOut();

    // and the s written back into the bowl, from its top terminal, settling as it is drawn
    const x2 = seg(t, 0.5, 0.97);
    if (x2 > 0) {
      const d = e(x2);
      place(ctx, A.s, -dir * 14 * (1 - d), -10 * (1 - d), -dir * 0.12 * (1 - d), 0.9 + 0.1 * d,
        (c) => ess(c, p, pal, { to: M.clamp(M.ease.inOutSine(seg(x2, 0, 0.8)) * 1.0001, 0, 1) }));
    }
  }

  function flick(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const D = 90 + 230 * I, curve = sCurve(D, 22 + 40 * I);
    const PEAK = 0.34;
    // out along the S fast, then back past centre (the user's easing) and settle
    const d = (tt) => {
      if (tt <= 0) return 0;
      if (tt < PEAK) { const x = tt / PEAK; return M.ease.inOutSine(x) * 0.25 + M.ease.outCubic(x) * 0.75 - 0.08 * antic(x); }
      return 1 - e(seg(tt, PEAK, 0.85));   // home by 0.85, so the ribbon (0.06 behind) and the smear are still by the end
    };
    const pose = (tt, k) => {
      const q = d(tt), a = along(curve, q);
      return { x: dir * a.x, y: a.y, r: dir * (0.06 + 0.16 * I) * q + dir * 0.2 * a.angle * q, k: 1 - 0.03 * q * k, q };
    };
    const tc = trailColours(p, pal, dir);
    const now = pose(t, 1);
    // the smear: ghosts of the last few instants, fainter the older they are, only where the mark moved
    const ghosts = 5;
    for (let g = ghosts; g >= 1; g--) {
      const tg = t - g * 0.026;
      const pg = pose(tg, 1);
      const moved = Math.min(1, Math.abs(now.q - pg.q) * 6);
      const al = 0.32 * (1 - g / (ghosts + 1)) * moved * (0.5 + 0.5 * I);
      if (al < 0.01) continue;
      M.layer(ctx, { alpha: al }, (c) => place(c, C, pg.x, pg.y, pg.r, pg.k, (cc) => {
        M.stroke(cc, PTS.body, { width: M.widths.body * p.weight, colours: tc.body });
        M.stroke(cc, PTS.bar, { width: M.widths.bar * p.weight, colours: tc.bar });
        M.stroke(cc, PTS.s, { width: M.widths.s * p.weight, colours: tc.s });
      }));
    }
    const ps = pose(t + 0.03 * M.smoothstep(0, 0.1, t), 1), pr = pose(t - 0.06, 1);   // the lead grows in: t = 0 is the still mark
    mark(ctx, p, pal,
      { x: now.x, y: now.y, r: now.r, k: now.k },
      { x: ps.x, y: ps.y, r: ps.r * 1.15, k: ps.k },
      { x: pr.x, y: pr.y, r: pr.r, k: pr.k, t: 0.12 * I * pr.q, alpha: 1 });
  }

  Motion.register({
    id: 'swipe',
    name: 'Swipe',
    idea: 'The s is the swipe: the mark rides an S-curve off to the right for a keep or the left for a pass, leaving a trail of its colours that fades, and the next mark comes up from underneath.',
    why: 'A judgment is a gesture. The mark makes the same one the hand just made, warm for a keep and clean for a pass, and the next one is already waiting, the way the next card is.',
    moments: ['keep', 'pass'],
    styles: ['ride', 's-trail', 'flick'],
    params: {
      duration: { default: 560, min: 250, max: 1600, step: 10 },
      style: { default: 'ride', options: ['ride', 's-trail', 'flick'] },
      trail: { default: 'auto', options: ['auto', 'letters', 'warm', 'cool'] },   // auto: keep warm, pass cobalt
      easing: { default: 'outBack', options: M.EASES.slice() },
      intensity: { default: 0.6, min: 0, max: 1, step: 0.05 }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const dir = env.direction === 'left' ? -1 : 1;
      if (t >= 1) { still(ctx, p, pal); return; }
      if (p.style === 's-trail') sTrail(ctx, t, p, env, pal, dir);
      else if (p.style === 'flick') flick(ctx, t, p, env, pal, dir);
      else ride(ctx, t, p, env, pal, dir);
    }
  });
})();

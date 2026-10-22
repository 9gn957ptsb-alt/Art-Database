/* 5s Motion Lab: Rewind (Gesture & judgment).
 *
 * Undo: the last gesture plays backwards. The mark comes back the way it went, through ghosts of the
 * instants it passes (time showing as a trail), and settles where it was, a touch past and back.
 *
 * env.direction is the side the undone gesture went to: 'right' (a keep, the default) or 'left' (a pass);
 * the mark comes back from there.
 *
 * Styles
 *   retrace  back along the swipe's S from the edge of the frame, unturning as it comes, the s arriving a
 *            beat after the 5; ghosts of the last instants trail it, paler the older they are
 *   reel     the gesture laid out as a strip of ghosts along the S, which reels in: the furthest ghost
 *            slides into the next, and the next, until the last one lands and turns solid
 *   unwind   the undo turn: the mark spins back against the clock out of a tilt, a bright arc winding
 *            back round it like the undo sign, and ghosts at the angles it just left
 *   boomerang  (22 Oct, from Retrace) from rest out along the S toward env.direction, a hang at the far end, and
 *            straight back with the chosen easing; onion skins on both legs (outward in the logo's colours,
 *            homeward violet), gone by t = 0.95. Starts and ends on the still mark, so it loops (t = 0 is t = 1)
 *   spool    (22 Oct, from Retrace) the path is visible: a violet thread from the edge of the view to the tip of
 *            the 5's bar, the onion skins threaded on it like beads; it reels in behind the mark as it retraces,
 *            then what is left winds into the ribbon (ribbon off: it reels into the bar's tip and is gone)
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only; t = 1 is the still mark, centred.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const C = A.letters;
  const TAU = Math.PI * 2;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);

  function place(ctx, o, x, y, r, k, draw) {
    ctx.save();
    ctx.translate(o[0] + x, o[1] + y);
    if (r) ctx.rotate(r);
    if (k !== 1) ctx.scale(k, k);
    ctx.translate(-o[0], -o[1]);
    draw(ctx);
    ctx.restore();
  }
  function five(c, p, cols) {
    M.stroke(c, PTS.body, { width: M.widths.body * p.weight, colours: cols.body });
    M.stroke(c, PTS.bar, { width: M.widths.bar * p.weight, colours: cols.bar });
  }
  function ess(c, p, cols) { M.stroke(c, PTS.s, { width: M.widths.s * p.weight, colours: cols.s }); }
  function ribbon(c, p, pal, rt, alpha) { if (p.ribbon) M.ribbon(c, rt || 0, { colours: pal.ribbon, alpha: alpha == null ? 1 : alpha }); }
  function still(ctx, p, pal) { ribbon(ctx, p, pal, 0, 1); five(ctx, p, pal); ess(ctx, p, pal); }

  // a ghost: an onion skin (the letters' outline, as an animator's onion-skinned frames), a blur (a pale filled
  // copy, a motion smear) or a violet onion skin
  function ghostColours(p, pal) {
    const pale = (stops, k) => stops.map((s) => (Array.isArray(s) ? [s[0], M.mix(s[1], pal.bg, k)] : M.mix(s, pal.bg, k)));
    if (p.ghost === 'violet') { const v = pal.name === 'ink' || pal.name === 'paper' ? pal.ink : pal.iris; return { bar: [v], body: [v], s: [v] }; }
    if (p.ghost === 'blur') return { bar: pale(pal.bar, 0.25), body: pale(pal.body, 0.25), s: pale(pal.s, 0.25) };
    return { bar: pal.bar, body: pal.body, s: pal.s };
  }
  // P: {x, y, r, k} for the 5 and {sx, sy, sr, sk} for the s
  function ghost(ctx, p, pal, P, alpha, colours) {
    const gc = colours || ghostColours(p, pal);
    if (p.ghost === 'blur') {
      M.layer(ctx, { alpha }, (c) => {
        place(c, C, P.x, P.y, P.r, P.k, (cc) => five(cc, p, gc));
        place(c, C, P.sx, P.sy, P.sr, P.sk, (cc) => ess(cc, p, gc));
      });
      return;
    }
    const line = 9;
    const thin = { weight: p.weight };
    M.layer(ctx, { alpha, composite: 'source-over' }, (c) => {
      place(c, C, P.x, P.y, P.r, P.k, (cc) => five(cc, p, gc));
      place(c, C, P.sx, P.sy, P.sr, P.sk, (cc) => ess(cc, p, gc));
      c.globalCompositeOperation = 'destination-out';
      place(c, C, P.x, P.y, P.r, P.k, (cc) => {
        M.stroke(cc, PTS.body, { width: M.widths.body * thin.weight - 2 * line / P.k, colours: '#000' });
        M.stroke(cc, PTS.bar, { width: M.widths.bar * thin.weight - 2 * line / P.k, colours: '#000' });
      });
      place(c, C, P.sx, P.sy, P.sr, P.sk, (cc) => M.stroke(cc, PTS.s, { width: M.widths.s * thin.weight - 2 * line / P.sk, colours: '#000' }));
    });
  }

  // the S the gesture rode (as in Swipe): offsets from rest for a gesture to the right; x mirrors for left
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
  // pose on the S at progress q (q < 0: past rest, along the first tangent, for the overshoot)
  function poseAt(curve, q, dir, I) {
    let x, y, ang;
    if (q >= 0) { const a = M.at(curve, Math.min(1, q)); x = a.x; y = a.y; ang = a.angle; }
    else { const a = M.at(curve, 0), L = Math.hypot(curve[64][0], curve[64][1]); x = Math.cos(a.angle) * q * L; y = Math.sin(a.angle) * q * L; ang = a.angle; }
    const lift = M.smoothstep(0.1, 0.9, Math.abs(q)) * Math.sign(q);
    return { x: dir * x, y, r: dir * ((0.05 + 0.2 * I) * lift + 0.3 * ang * M.smoothstep(0, 0.4, Math.abs(q)) * Math.sign(q)), k: 1 - 0.1 * Math.max(0, lift) };
  }

  // ghosts of the instants just left behind, spaced along the way back and closing up as the mark lands
  function ghostsAt(ctx, p, pal, n, pose, alphaOf) {
    for (let g = n; g >= 1; g--) {
      const P = pose(g);
      if (!P) continue;
      const al = alphaOf(g);
      if (al >= 0.01) ghost(ctx, p, pal, P, al);
    }
  }

  function retrace(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.3 + 0.2 * I), 40 + 80 * I);
    // back from the edge (q = 1) to rest (q = 0); the user's easing shapes the return, overshoot included
    // the 5 is home by t = 0.8, the s a beat later (0.86), the ribbon last (0.92): then it holds, still
    const x = seg(t, 0, 0.8), xs = seg(t, 0.06, 0.86), xr = seg(t, 0.12, 0.92);
    const q = (xx) => 1 - e(M.clamp(xx, 0, 1));
    const n = Math.round(p.ghosts), gap = 0.15 + 0.05 * I;
    const close = Math.pow(1 - x, 0.6);
    ghostsAt(ctx, p, pal, n, (g) => {
      const qg = q(x) + g * gap * close, qs = q(xs) + g * gap * close;
      if (qg > 1.25) return null;
      const P = poseAt(curve, qg, dir, I), S = poseAt(curve, qs, dir, I);
      return { x: P.x, y: P.y, r: P.r, k: P.k, sx: S.x, sy: S.y, sr: S.r, sk: S.k };
    }, (g) => (0.7 - 0.5 * (g / (n + 1))) * close);
    const P5 = poseAt(curve, q(x), dir, I), PS = poseAt(curve, q(xs), dir, I), PR = poseAt(curve, q(xr), dir, I);
    place(ctx, C, PR.x, PR.y, PR.r, PR.k, (c) => ribbon(c, p, pal, -0.2 * I * (1 - e(xr)), 1));
    place(ctx, C, P5.x, P5.y, P5.r, P5.k, (c) => five(c, p, pal));
    place(ctx, C, PS.x, PS.y, PS.r, PS.k, (c) => ess(c, p, pal));
  }

  // reel: the gesture played back frame by frame, like film wound back by hand: the mark clicks back along
  // the S in n steps (each a short eased move, then a hold), each frame it leaves stays a moment as a ghost
  function reel(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.34 + 0.2 * I), 40 + 80 * I);
    const n = Math.max(2, Math.round(p.ghosts));
    const END = 0.72;
    const stepOf = (tt) => {   // position after the clicks so far: 1 (the edge) -> 0 (rest)
      const x = M.clamp(tt / END, 0, 1) * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
      const move = M.ease.inOutCubic(M.clamp(f / 0.45, 0, 1));
      return 1 - (k + (x >= n ? 1 : move)) / n;
    };
    const qNow = t < END ? stepOf(t) : 0;
    // the frames left behind: one at each step already passed, fading over about two steps
    const stepT = END / n;
    for (let k = n; k >= 1; k--) {
      const qk = k / n, leftAt = (n - k) * stepT + 0.45 * stepT * 0.5;
      const age = (t - leftAt) / (2.2 * stepT);
      if (age <= 0 || age >= 1 || qk <= qNow + 1e-6) continue;
      const al = 0.5 * (1 - age) * (1 - age);
      const P = poseAt(curve, qk, dir, I);
      ghost(ctx, p, pal, { x: P.x, y: P.y, r: P.r, k: P.k, sx: P.x, sy: P.y, sr: P.r, sk: P.k }, al * 1.4);
    }
    // after the last click the user's easing settles it (a touch past and back for outBack)
    const settle = seg(t, END, 1);
    // the landing: a small bounce in scale shaped by the user's easing (outBack: up a touch and back)
    const P = poseAt(curve, qNow, dir, I);
    const land = seg(settle, 0, 0.85);
    const k5 = t < END ? 1 : 1 + (0.035 + 0.035 * I) * (1 - e(land)) * Math.sin(Math.PI * Math.min(1, land * 2.2));
    const rt = -0.18 * I * qNow;
    place(ctx, C, P.x, P.y, P.r, P.k * k5, (c) => { ribbon(c, p, pal, rt, 1); five(c, p, pal); ess(c, p, pal); });
  }

  function unwind(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const turn = dir * (0.35 + 0.6 * I);                // how far the gesture had turned it (clockwise for right)
    const x = seg(t, 0, 0.8), xs = seg(t, 0.05, 0.85), xr = seg(t, 0.1, 0.9);   // the 5, the s, the ribbon
    const ang = (xx) => turn * (1 - e(M.clamp(xx, 0, 1)));
    const scl = (xx) => 1 - (0.08 + 0.08 * I) * Math.sin(Math.PI * M.clamp(xx, 0, 1));
    const o = A.letters;
    const n = Math.round(p.ghosts), gap = dir * (0.12 + 0.06 * I), close = Math.pow(1 - x, 0.6);
    ghostsAt(ctx, p, pal, n, (g) => {
      const a = ang(x) + g * gap * close, as = ang(xs) + g * gap * close, k = scl(x);
      return { x: 0, y: 0, r: a, k, sx: 0, sy: 0, sr: as, sk: k };
    }, (g) => (0.6 - 0.45 * (g / (n + 1))) * close);
    // the undo arc: a bright stroke winding back round the mark, its head leading the turn home
    const a1 = ang(x), arcA = 1 - M.smoothstep(0.5, 0.88, t);
    if (arcA > 0.01) {
      const R = 480 + 20 * I, base = -Math.PI / 2 - 0.5 * dir;
      const from = base + a1, to = base + a1 + (0.9 + 1.2 * I) * dir * (0.4 + 0.6 * close);
      const pts = [];
      for (let i = 0; i <= 48; i++) { const a = M.lerp(from, to, i / 48); pts.push([o[0] + R * Math.cos(a), o[1] + R * Math.sin(a)]); }
      const col = pal.name === 'ink' || pal.name === 'paper' ? pal.ink : pal.iris;
      M.stroke(ctx, pts.reverse(), { width: 24 + 10 * I, colours: [[0, M.mix(col, pal.bg, 0.92)], [0.6, M.mix(col, pal.bg, 0.4)], [1, col]], alpha: arcA * (0.55 + 0.4 * I) });
    }
    place(ctx, o, 0, 0, ang(xr), scl(xr), (c) => ribbon(c, p, pal, -0.25 * I * (1 - e(xr)), 1));
    place(ctx, o, 0, 0, a1, scl(x), (c) => five(c, p, pal));
    place(ctx, o, 0, 0, ang(xs), scl(xs), (c) => ess(c, p, pal));
  }

  /* ---------------------------------------------------------------------------------------------------------
   * The refinements (22 Oct): boomerang and spool. Retrace was starred; these keep its S, its onion skins and its
   * outBack settle, and make it fit any moment (boomerang starts and ends on the still mark) or show the path
   * itself (spool: the trace becomes the ribbon).
   * ------------------------------------------------------------------------------------------------------- */
  const flatPal = (pal) => pal.name === 'ink' || pal.name === 'paper';
  const violetOf = (pal) => (flatPal(pal) ? pal.ink : pal.iris);
  // the homeward ghosts: the same kind of ghost as the param asks for, in violet
  function violetGhosts(p, pal) {
    const v = violetOf(pal), c = p.ghost === 'blur' ? M.mix(v, pal.bg, 0.25) : v;
    return { bar: [c], body: [c], s: [c] };
  }
  // the thread's violet: the ribbon's own (logo, inverse, turn) or the iris; one colour in the flat palettes
  const threadColour = (pal) => (flatPal(pal) ? pal.ink : pal.name === 'logo' || pal.name === 'inverse' || pal.name === 'turn' ? M.colourAt(pal.ribbon, 0.28) : pal.iris);

  // boomerang: from rest, out along the S toward env.direction (a small wind-up first), a hang at the far end,
  // then straight back along the same S with the chosen easing. Onion skins sampled evenly in time, so they
  // spread where it is fast and bunch where it hangs: the outward ones in the logo's colours, the homeward violet.
  const BOUT = 0.4, BHANG = 0.47, BHOME = 0.86;
  function boomerang(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.3 + 0.2 * I), 40 + 80 * I);
    const qAt = (tt) => {
      if (tt <= 0 || tt >= 1) return 0;
      if (tt < BOUT) return M.ease.outCubic(seg(tt, 0.05, BOUT)) - (0.05 + 0.07 * I) * Math.sin(Math.PI * seg(tt, 0, 0.1));
      if (tt < BHANG) return 1;
      return 1 - e(seg(tt, BHANG, BHOME));
    };
    // at the far end it hangs and rocks a little, as a thrown thing does at the top of its arc
    const rock = (tt) => dir * (0.06 + 0.12 * I) * Math.sin(Math.PI * seg(tt, BOUT - 0.04, BHANG + 0.04));
    const pose = (tt) => { const P = poseAt(curve, qAt(tt), dir, I); P.r += rock(tt); return P; };
    const LAG = 0.04;
    const n = Math.round(p.ghosts), dt = 0.034 + 0.012 * I;
    const fade = 1 - M.smoothstep(0.84, 0.95, t);
    if (fade > 0.001) {
      const outward = ghostColours(p, pal), home = violetGhosts(p, pal), now = pose(t);
      for (let g = n; g >= 1; g--) {
        const tg = t - g * dt;
        if (tg <= 0) continue;
        const P = pose(tg), S = pose(tg - LAG);
        // a ghost that sits on the mark shows nothing: skip it rather than draw it under the mark
        if (Math.hypot(P.x - now.x, P.y - now.y) < 4 && Math.abs(P.r - now.r) < 0.01) continue;
        const al = (0.72 - 0.5 * (g / (n + 1))) * fade;
        ghost(ctx, p, pal, { x: P.x, y: P.y, r: P.r, k: P.k, sx: S.x, sy: S.y, sr: S.r, sk: S.k }, al, tg < BHANG ? outward : home);
      }
    }
    const P5 = pose(t), PS = pose(t - LAG), PR = pose(t - 2 * LAG);
    place(ctx, C, PR.x, PR.y, PR.r, PR.k, (c) => ribbon(c, p, pal, -0.2 * I * qAt(t - 2 * LAG), 1));
    place(ctx, C, P5.x, P5.y, P5.r, P5.k, (c) => five(c, p, pal));
    place(ctx, C, PS.x, PS.y, PS.r, PS.k, (c) => ess(c, p, pal));
  }

  // spool: the gesture's path is visible. A thread (the path the mark's end travelled, in the ribbon's violet)
  // runs from the edge of the view to the mark, with the onion skins threaded on it like beads. As the mark
  // retraces home the thread reels in behind it and the beads slide along it into the mark; then what is left
  // of the thread winds into the ribbon itself (ribbon off: it reels into the mark's end and is gone).
  const BAR = M.points('bar', 2);
  function spool(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.3 + 0.2 * I), 40 + 80 * I);
    const end = curve[64], pre = curve[62], el = Math.hypot(end[0] - pre[0], end[1] - pre[1]) || 1;
    const ext = [(end[0] - pre[0]) / el, (end[1] - pre[1]) / el];
    const reach = Math.hypot(end[0], end[1]);
    // a pose anywhere along the S, continued straight on past its far end (the thread runs out of the view)
    const poseX = (q) => {
      if (q <= 1) return poseAt(curve, q, dir, I);
      const P = poseAt(curve, 1, dir, I);
      P.x += dir * ext[0] * (q - 1) * reach; P.y += ext[1] * (q - 1) * reach;
      return P;
    };
    // the thread is tied to the end of the 5's bar on the side the gesture went (its bright tip for a right):
    // the open space beside the bar keeps the path in view, and the ribbon ends at the bar's foot, so the thread
    // winds into the ribbon from its own end
    const tie = dir > 0 ? BAR[1] : BAR[0];
    const tieAt = (P) => {
      const dx = tie[0] - C[0], dy = tie[1] - C[1], c = Math.cos(P.r), sn = Math.sin(P.r);
      return [C[0] + P.x + P.k * (c * dx - sn * dy), C[1] + P.y + P.k * (sn * dx + c * dy)];
    };
    const x = seg(t, 0, 0.72), xs = seg(t, 0.05, 0.78);
    const q = (xx) => 1 - e(M.clamp(xx, 0, 1));
    const q5 = q(x), qs = q(xs), qTie = q5;
    // the thread's far end reels in: from past the view's edge to a stretch of the S (ribbon on), or to the mark
    const keep = p.ribbon ? 0.55 : 0;
    const qTail = M.lerp(1.9, keep, M.ease.inOutCubic(seg(t, 0.02, p.ribbon ? 0.78 : 0.9)));
    const width = Math.max((10 + 4 * I) * p.weight, 1.3 / (env.scale || 1));   // at least a device pixel or so
    const col = threadColour(pal);
    const wind = M.ease.inOutCubic(seg(t, 0.78, 0.94));
    const lo = Math.max(0, qTie), hi = Math.max(lo, qTail);
    let rev = true;   // which end of the ribbon the thread's tied end winds onto (the nearer one)
    if (hi - lo > 1e-3 && wind < 1) {
      let pts = [];
      for (let i = 0; i <= 90; i++) pts.push(tieAt(poseX(M.lerp(lo, hi, i / 90))));
      pts = M.resample(pts, 120);
      let alpha = 1;
      if (wind > 0 && p.ribbon) {
        // wind into the ribbon: the thread's points travel onto the ribbon's spine, from whichever end is nearer
        let rib = RIB;
        const d1 = Math.hypot(pts[0][0] - rib[0][0], pts[0][1] - rib[0][1]) + Math.hypot(pts[119][0] - rib[119][0], pts[119][1] - rib[119][1]);
        const d2 = Math.hypot(pts[0][0] - rib[119][0], pts[0][1] - rib[119][1]) + Math.hypot(pts[119][0] - rib[0][0], pts[119][1] - rib[0][1]);
        rev = d2 < d1;
        if (rev) rib = RIB_REV;
        pts = M.morph(pts, rib, wind);
        alpha = 1 - M.smoothstep(0.55, 1, wind);
      }
      M.stroke(ctx, pts, { width, colours: [[0, col], [1, M.mix(col, pal.bg, 0.35)]], alpha });
    }
    // the beads: onion skins threaded on the thread, sliding along it into the mark
    const n = Math.round(p.ghosts), close = Math.pow(1 - x, 0.6), gap = (hi - lo) / (n + 1), beads = [];
    if (close > 0.001) {
      for (let g = n; g >= 1; g--) {
        const qg = qTie + g * Math.min(gap, 0.16 + 0.04 * I) * close;
        if (qg > hi + 1e-6) continue;
        const P = poseX(qg), S = poseX(qg + (qs - q5));
        const al = (0.7 - 0.45 * (g / (n + 1))) * close;
        if (al >= 0.01) ghost(ctx, p, pal, { x: P.x, y: P.y, r: P.r, k: P.k, sx: S.x, sy: S.y, sr: S.r, sk: S.k }, al);
        beads.push({ at: tieAt(P), al });
      }
    }
    // and the beads themselves: a bright dot where each skin is threaded, counted along the thread
    for (const b of beads) {
      ctx.save();
      ctx.globalAlpha *= M.clamp(b.al * 1.5, 0, 1);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.at[0], b.at[1], width * 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // the ribbon is born from the thread
    if (p.ribbon && wind > 0) {
      // drawn on from the end the thread arrives at, a little behind it
      const a = M.ease.inOutCubic(seg(wind, 0.1, 1));
      if (a > 0) M.ribbon(ctx, 0.25 * I * (1 - wind), { colours: pal.ribbon, along: rev ? [1 - a, 1] : [0, a] });
    }
    const P5 = poseAt(curve, q5, dir, I), PS = poseAt(curve, qs, dir, I);
    place(ctx, C, P5.x, P5.y, P5.r, P5.k, (c) => five(c, p, pal));
    place(ctx, C, PS.x, PS.y, PS.r, PS.k, (c) => ess(c, p, pal));
  }
  const RIB = M.points('ribbon', 120), RIB_REV = RIB.slice().reverse();

  Motion.register({
    id: 'rewind',
    name: 'Rewind',
    idea: 'The last gesture plays backwards: the mark comes back the way it went through a ghosted trail of the instants it passes, and settles.',
    why: 'Taking it back is allowed. A judgment is light enough to undo, and the mark shows time running backwards for a moment, then it is simply there again, unhurt.',
    moments: ['undo'],
    styles: ['retrace', 'reel', 'unwind', 'boomerang', 'spool'],
    params: {
      duration: { default: 520, min: 250, max: 1600, step: 10 },
      style: { default: 'retrace', options: ['retrace', 'reel', 'unwind', 'boomerang', 'spool'] },
      ghosts: { default: 4, min: 2, max: 8, step: 1 },
      ghost: { default: 'onion', options: ['onion', 'blur', 'violet'] },   // outlines, pale smears, or violet outlines
      easing: { default: 'outBack', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const dir = env.direction === 'left' ? -1 : 1;
      if (t >= 1) { still(ctx, p, pal); return; }
      if (p.style === 'boomerang') boomerang(ctx, t, p, env, pal, dir);
      else if (p.style === 'spool') spool(ctx, t, p, env, pal, dir);
      else if (p.style === 'reel') reel(ctx, t, p, env, pal, dir);
      else if (p.style === 'unwind') unwind(ctx, t, p, env, pal, dir);
      else retrace(ctx, t, p, env, pal, dir);
    }
  });
})();

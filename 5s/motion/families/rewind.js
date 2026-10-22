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
  function ghost(ctx, p, pal, P, alpha) {
    const gc = ghostColours(p, pal);
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

  Motion.register({
    id: 'rewind',
    name: 'Rewind',
    idea: 'The last gesture plays backwards: the mark comes back the way it went through a ghosted trail of the instants it passes, and settles.',
    why: 'Taking it back is allowed. A judgment is light enough to undo, and the mark shows time running backwards for a moment, then it is simply there again, unhurt.',
    moments: ['undo'],
    styles: ['retrace', 'reel', 'unwind'],
    params: {
      duration: { default: 520, min: 250, max: 1600, step: 10 },
      style: { default: 'retrace', options: ['retrace', 'reel', 'unwind'] },
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
      if (p.style === 'reel') reel(ctx, t, p, env, pal, dir);
      else if (p.style === 'unwind') unwind(ctx, t, p, env, pal, dir);
      else retrace(ctx, t, p, env, pal, dir);
    }
  });
})();

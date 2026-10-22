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

  // a ghost's colours: the letters' own, paled toward the background (or one tint)
  function ghostColours(p, pal) {
    const pale = (stops, k) => stops.map((s) => (Array.isArray(s) ? [s[0], M.mix(s[1], pal.bg, k)] : M.mix(s, pal.bg, k)));
    if (p.ghost === 'violet') { const v = M.mix(pal.iris, pal.bg, 0.15); return { bar: [v], body: [v], s: [v] }; }
    if (p.ghost === 'ink') { const v = M.mix(pal.ink, pal.bg, 0.25); return { bar: [v], body: [v], s: [v] }; }
    return { bar: pale(pal.bar, 0.25), body: pale(pal.body, 0.25), s: pale(pal.s, 0.25) };
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

  function retrace(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.55 + 0.35 * I), 50 + 100 * I);
    // back from the edge (q = 1) to rest (q = 0); the user's easing shapes the return, overshoot included
    const q = (tt) => 1 - e(seg(tt, 0, 0.82));
    const lagS = 0.06;
    const gc = ghostColours(p, pal);
    const n = Math.round(p.ghosts);
    for (let g = n; g >= 1; g--) {   // ghosts of the instants just passed: further out, paler, older
      const tg = t - g * 0.045;
      if (tg < -0.2) continue;
      const qg = q(Math.max(0, tg)) + (tg < 0 ? -tg * 0.6 : 0), now = q(t);
      const spread = Math.min(1, Math.abs(qg - now) * 5);
      const al = (0.42 - 0.3 * (g / (n + 1))) * spread * (1 - M.smoothstep(0.7, 0.95, t));
      if (al < 0.01) continue;
      const P5 = poseAt(curve, qg, dir, I), PS = poseAt(curve, q(Math.max(0, tg - lagS)) + (tg < lagS ? (lagS - tg) * 0.6 : 0), dir, I);
      M.layer(ctx, { alpha: al }, (c) => {
        place(c, C, P5.x, P5.y, P5.r, P5.k, (cc) => five(cc, p, gc));
        place(c, C, PS.x, PS.y, PS.r, PS.k, (cc) => ess(cc, p, gc));
      });
    }
    const P5 = poseAt(curve, q(t), dir, I), PS = poseAt(curve, q(t - lagS) + (t < lagS ? (lagS - t) * 0.6 : 0), dir, I);
    const PR = poseAt(curve, q(t - 2 * lagS) + (t < 2 * lagS ? (2 * lagS - t) * 0.6 : 0), dir, I);
    place(ctx, C, PR.x, PR.y, PR.r, PR.k, (c) => ribbon(c, p, pal, -0.2 * I * (1 - e(seg(t, 0.1, 1))), 1));
    place(ctx, C, P5.x, P5.y, P5.r, P5.k, (c) => five(c, p, pal));
    place(ctx, C, PS.x, PS.y, PS.r, PS.k, (c) => ess(c, p, pal));
  }

  function reel(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const span = env.view.x1 - env.view.x0;
    const curve = sCurve(span * (0.5 + 0.3 * I), 40 + 90 * I);
    const n = Math.max(2, Math.round(p.ghosts));
    const gc = ghostColours(p, pal);
    // frame i sits at q_i = i / n along the gesture; the strip reels in from the far end, each frame
    // sliding into its neighbour's place, overlapping, until frame 0 (the mark) is all that is left
    const reelIn = (tt) => M.ease.inOutSine(seg(tt, 0.04, 0.78));
    const head = reelIn(t) * n;   // how many frames have been reeled in
    for (let i = n; i >= 1; i--) {
      const base = i / n;
      const pull = M.clamp(head - (n - i), 0, 1);           // this frame's slide toward rest
      const qi = base * (1 - e(M.clamp(head / n, 0, 1)));   // the whole strip shortens as it is reeled
      const al = (0.55 - 0.35 * base) * (1 - pull) * (1 - M.smoothstep(0.75, 0.95, t));
      if (al < 0.01) continue;
      const P = poseAt(curve, qi, dir, I * 0.7);
      M.layer(ctx, { alpha: al }, (c) => place(c, C, P.x, P.y, P.r, P.k, (cc) => { five(cc, p, gc); ess(cc, p, gc); }));
    }
    // the mark itself: present from the start, nudged out along the S, pulled home as the strip reels
    const qm = 0.18 * (1 - e(seg(t, 0.1, 1)));
    const P = poseAt(curve, qm, dir, I * 0.7), PS = poseAt(curve, 0.18 * (1 - e(seg(t, 0.16, 1))), dir, I * 0.7);
    place(ctx, C, P.x, P.y, P.r, P.k, (c) => ribbon(c, p, pal, -0.15 * I * (1 - e(seg(t, 0.2, 1))), M.smoothstep(0.2, 0.7, t) * 0.7 + 0.3));
    place(ctx, C, P.x, P.y, P.r, P.k, (c) => five(c, p, pal));
    place(ctx, C, PS.x, PS.y, PS.r, PS.k, (c) => ess(c, p, pal));
  }

  function unwind(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const turn = dir * (0.7 + 1.6 * I);                  // how far the gesture had turned it (clockwise for right)
    const ang = (tt) => turn * (1 - e(seg(tt, 0, 0.85)));
    const scl = (tt) => 1 - (0.1 + 0.08 * I) * Math.sin(Math.PI * seg(tt, 0, 0.85));
    const o = A.letters;
    const gc = ghostColours(p, pal);
    const n = Math.round(p.ghosts);
    for (let g = n; g >= 1; g--) {
      const tg = t - g * 0.035;
      const ag = tg < 0 ? turn - tg * turn * 0.5 : ang(tg);
      const spread = Math.min(1, Math.abs(ag - ang(t)) * 3);
      const al = (0.36 - 0.26 * (g / (n + 1))) * spread;
      if (al < 0.01) continue;
      M.layer(ctx, { alpha: al }, (c) => place(c, o, 0, 0, ag, scl(Math.max(0, tg)), (cc) => { five(cc, p, gc); ess(cc, p, gc); }));
    }
    // the undo arc: a bright stroke winding back round the mark, its head where the mark's turn is
    const a1 = ang(t), arcA = 1 - M.smoothstep(0.55, 0.9, t);
    if (arcA > 0.01 && Math.abs(turn) > 0.01) {
      const R = 470 + 30 * I, base = -Math.PI / 2 - 0.4 * dir;
      const from = base + a1, to = base + a1 + Math.min(Math.abs(turn - a1) + 0.5, 2.6) * dir;
      const pts = [];
      for (let i = 0; i <= 48; i++) { const a = M.lerp(from, to, i / 48); pts.push([o[0] + R * Math.cos(a), o[1] + R * Math.sin(a)]); }
      const col = pal.name === 'ink' || pal.name === 'paper' ? pal.ink : pal.iris;
      M.stroke(ctx, pts.reverse(), { width: 26 + 10 * I, colours: [[0, M.mix(col, pal.bg, 0.9)], [0.6, M.mix(col, pal.bg, 0.4)], [1, col]], alpha: arcA * (0.5 + 0.4 * I) });
    }
    const aS = ang(t - 0.05), aR = ang(t - 0.1);
    place(ctx, o, 0, 0, aR, scl(Math.max(0, t - 0.1)), (c) => ribbon(c, p, pal, -0.25 * I * (1 - e(seg(t, 0.1, 1))), 1));
    place(ctx, o, 0, 0, a1, scl(t), (c) => five(c, p, pal));
    place(ctx, o, 0, 0, aS, scl(Math.max(0, t - 0.05)), (c) => ess(c, p, pal));
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
      ghosts: { default: 5, min: 2, max: 8, step: 1 },
      ghost: { default: 'mark', options: ['mark', 'violet', 'ink'] },
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

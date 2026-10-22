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

  Motion.register({
    id: 'count',
    name: 'Count',
    idea: 'The 5 counts down, 4, 3, 2, 1, along its own strokes and comes back as 5; the s, waiting as a ticking ball, lands last.',
    why: 'Five seconds, five cards: the count says how long a judgment takes and that today\'s five is about to begin.',
    moments: ['five-start', 'load'],
    styles: ['morph', 'flap', 'write', 'drop'],
    params: {
      duration: { default: 1200, min: 600, max: 6000, step: 100 },   // 5000: one digit a second, for load
      style: { default: 'morph', options: ['morph', 'flap', 'write', 'drop'] },
      tick: { default: true },                                         // the s waits as a ticking ball (off: it lifts away and drops back)
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
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

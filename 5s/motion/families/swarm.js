/* 5s Motion Lab: Swarm (22 Oct 2026, new).
 *
 * The mark is a flock. Hundreds of small specks in its colours sit along the strokes of the 5 and the s (and the
 * ribbon, as a stream of violet specks). Something startles them: they burst up, wheel round the field together and
 * settle back into the 5 and the s. Particles moving like living things: the mark leaves its footprint entirely,
 * becomes a crowd and comes back. No outlines, no copies, no single body.
 *
 * Styles
 *   murmur   the whole flock lifts and wheels in one sweeping S across the field (the s's own centreline, scaled up
 *            to fill the view; keep, env.direction right, runs it backwards so the sweep ends to the right). Each
 *            speck rides the S a little ahead of or behind the flock's centre, so the flock bends with the path,
 *            stretches and bunches, and a fold runs through it; the ribbon's specks trail it as a violet stream.
 *            It lands back on the strokes, the 5's specks first and the s's last.
 *   scatter  a burst from the bowl (offset toward env.direction). The specks fly outward on seeded headings,
 *            slowed by drag, curl round the way env.direction turns, and are pulled home on springs that overshoot
 *            and land with a shiver. The mark re-forms in the last 20%.
 *   gather   arrival. The specks start as dust over the whole field and stream in along curling paths (a swirl and
 *            two seeded sines per speck), land on the strokes and the strokes go solid as they land, the 5 first.
 *
 * murmur and scatter start and end on the crisp still mark; gather ends on it.
 *
 * Params
 *   count      specks (150-800; a fifth of them are the ribbon's when it is on). Fewer specks are bigger, so the
 *              mark still reads at rest.
 *   scatter    how far they fly: the size of the S, the reach of the burst, how wide the dust starts
 *   shape      'dash' (a short stroke along its flight, like a bird, lengthening with speed; at rest it lies along
 *              its stroke like a bird on a wire) or 'dot'
 *   intensity  how alive the flock is: its size, the stretch and fold of the murmuration, the burst's reach and
 *              curl, the swirl and wander of the dust, the landing's shiver
 *   easing     shapes the flock's sweep along the S (murmur), the burst (scatter), each speck's approach (gather)
 *   palette, ribbon, weight (strokes, speck size and how wide the specks sit) as every family; duration 300-4000 ms
 *
 * Pure: a speck's position is its home plus a closed-form offset at t from its own seeded numbers (env.rng, fresh
 * every frame), with no simulation state. Each speck takes its stroke's colour at its place along the stroke and is
 * at least 1.25 device px, so 64 px still shows them. The specks are drawn as one path per colour (16 colours per
 * stroke), so a frame is a few dozen draw calls whatever the count (about 2 ms a frame at 400 px in headless
 * Chromium, against Echo's 3-16). At the end each stroke fuses back out of its specks, swelling from its spine to full
 * width (and thins back into them at the start), and the last frame is Marks.mark's still mark exactly.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;

  // the letters at 160 points, as Marks.mark draws them, so the still mark at either end is the engine's own
  const PTS = { body: M.points('body', 160), bar: M.points('bar', 160), s: M.points('s', 160) };
  const LETTERS = ['body', 'bar', 's'];               // Marks.mark's order
  const GROUPS = ['ribbon', 'body', 'bar', 's'];      // the order the specks are drawn in (the ribbon underneath)
  const BINS = 16;                                    // colours per group

  // an evenly spaced polyline with unit tangents, for a point and a direction at any u without measuring again
  function line(pts) {
    const n = pts.length, tx = new Float64Array(n), ty = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      tx[i] = dx / d; ty[i] = dy / d;
    }
    return { pts, tx, ty, n };
  }
  const LINE = { ribbon: line(M.points('ribbon', 220)), body: line(PTS.body), bar: line(PTS.bar), s: line(PTS.s) };
  const AREA = { body: M.length('body') * M.widths.body, bar: M.length('bar') * M.widths.bar, s: M.length('s') * M.widths.s };
  const S_LEN = M.length('s');
  const S_BOX = M.bbox('s', 0);

  // [x, y, tx, ty] at fraction u (clamped)
  function on(l, u) {
    const x = M.clamp(u, 0, 1) * (l.n - 1), i = Math.min(l.n - 2, Math.floor(x)), f = x - i;
    const a = l.pts[i], b = l.pts[i + 1];
    const tx = l.tx[i] + (l.tx[i + 1] - l.tx[i]) * f, ty = l.ty[i] + (l.ty[i + 1] - l.ty[i]) * f, d = Math.hypot(tx, ty) || 1;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, tx / d, ty / d];
  }

  // the ribbon's half-width at rest, where Marks.ribbon lays its strands at t = 0 (pinched ends, edge-on near them)
  function ribbonHalf(u) {
    const taper = M.smoothstep(0, 0.14, u) * M.smoothstep(1, 0.88, u);
    return 0.5 * M.widths.ribbon * (0.18 + 0.82 * taper) * (0.6 + 0.4 * Math.sin(Math.PI * M.clamp(1.3 * u - 0.35, 0, 1))) *
      Math.abs(Math.cos(Math.PI * (u - 0.5)));
  }

  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const BACK = M.ease.spring(190, 15);                // scatter's pull home: overshoots about 12%, then settles
  const back = (y) => BACK(Math.pow(y, 1.25));         // on a clock that lands them about 0.68 and settles them by 0.8

  // the flock, from env.rng: every speck's home (stratified along its stroke, spread across its width), the tangent
  // there, its colour bin and ten numbers of its own
  function flock(p, env) {
    const r = env.rng;
    const total = Math.round(p.count), nr = p.ribbon ? Math.round(total * 0.2) : 0;
    const sum = AREA.body + AREA.bar + AREA.s;
    const n = { ribbon: nr, body: Math.round((total - nr) * AREA.body / sum), bar: Math.round((total - nr) * AREA.bar / sum) };
    n.s = total - nr - n.body - n.bar;
    const out = [];
    GROUPS.forEach((g, gi) => {
      for (let k = 0; k < n[g]; k++) {
        const u = (k + r()) / n[g], v = 2 * r() - 1;
        const c = on(LINE[g], u);
        const half = g === 'ribbon' ? ribbonHalf(u) : 0.5 * M.widths[g] * p.weight * 0.8;
        // the ribbon's colour runs across its strands (Marks.ribbon), the letters' along their strokes
        const cu = g === 'ribbon' ? M.clamp(0.12 + 0.39 * (v + 1) + 0.2 * (u - 0.5), 0, 1) : u;
        const q = [];
        for (let j = 0; j < 10; j++) q.push(r());
        out.push({ g, u, v, half, hx: c[0] - c[3] * v * half, hy: c[1] + c[2] * v * half, tx: c[2], ty: c[3],
          bin: gi * BINS + Math.min(BINS - 1, Math.floor(cu * BINS)), r: q });
      }
    });
    return out;
  }

  // a landing tremble along the stroke's normal, over z in [0, 1] (none outside it)
  function shiver(sp, z, amp, cycles) {
    if (z <= 0 || z >= 1) return 0;
    return amp * sp.half * (1 - z) * (1 - z) * Math.sin(TAU * cycles * z) * (sp.r[9] < 0.5 ? -1 : 1);
  }

  /* each style: setup(p, env, list) -> {place(sp, t) -> [x, y], solid(t) -> alpha per group} */

  function murmur(p, env, list) {
    const I = p.intensity, X = p.scatter, ease = M.easing(p.easing);
    const fwd = env.direction === 'left';               // pass runs the s as it is written; keep runs it backwards
    const v = env.view, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const reach = 0.45 + 0.55 * X;
    const ky = (v.y1 - v.y0) * 0.68 * reach / (S_BOX[3] - S_BOX[1]);
    const kx = Math.min((v.x1 - v.x0) * 0.72 * reach / (S_BOX[2] - S_BOX[0]), ky * 1.5);
    const PL = S_LEN * (kx + ky) / 2;
    const path = (tau) => {                              // [x, y, tx, ty] on the big S, extended straight past its ends
      const c = on(LINE.s, fwd ? tau : 1 - tau), sg = fwd ? 1 : -1;
      let tx = c[2] * kx * sg, ty = c[3] * ky * sg;
      const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const e = tau < 0 ? tau : tau > 1 ? tau - 1 : 0;
      return [cx + (c[0] - A.s[0]) * kx + tx * e * PL, cy + (c[1] - A.s[1]) * ky + ty * e * PL, tx, ty];
    };
    const R = (60 + 80 * I) * (0.55 + 0.45 * reach) * (kx + ky) / 4.4;   // the flock's half-width
    const ph = TAU * env.rng();
    const P0 = path(0), P1 = path(1);
    const cycles = M.clamp(p.duration / 500, 1, 3);
    const lo = { body: 0.47, bar: 0.47, ribbon: 0.52, s: 0.57 };
    for (const sp of list) {
      const q = sp.r;
      const rad = Math.sqrt(q[0]), ang = TAU * q[1];      // an even cloud with a soft edge
      sp.fa = 2.4 * rad * Math.cos(ang);                 // place along the flock (ahead of or behind its centre)
      sp.fb = 1.3 * rad * Math.sin(ang) * (1 - 0.35 * Math.abs(Math.cos(ang)) * rad);   // across it, thinner at the ends
      if (sp.g === 'ribbon') { sp.fa = -1.7 - 1.5 * q[0]; sp.fb *= 0.35; }   // the violet stream trails behind
      // the specks nearest the start of the S lift first, those nearest its end land first
      sp.up = 0.015 + 0.08 * M.clamp(Math.hypot(sp.hx - P0[0], sp.hy - P0[1]) / 1100, 0, 1) + 0.03 * q[4];
      sp.down = lo[sp.g] + 0.06 * M.clamp(Math.hypot(sp.hx - P1[0], sp.hy - P1[1]) / 1100, 0, 1) + 0.03 * q[5];
      sp.f1 = 0.7 + 1.3 * q[6]; sp.f2 = 0.7 + 1.3 * q[7]; sp.p1 = q[8]; sp.p2 = q[6] + q[9];
      sp.curl = (fwd ? -1 : 1) * (0.2 + 0.8 * q[8]) * (0.4 + 0.6 * I);
    }
    return {
      place(sp, t) {
        const tc = ease(span(t, 0.04, 0.76));
        const st = 1 + 0.7 * I * Math.sin(TAU * 1.15 * tc + ph);          // the flock stretches and bunches as it wheels
        const lag = sp.fa * 0.055 * (0.75 + 0.5 * X) * st + 0.05 * I * Math.sin(TAU * 1.8 * tc + 2.3 * sp.fb + ph);   // a fold runs through it
        const P = path(tc + lag);
        const across = sp.fb * R / Math.sqrt(st) * (1 + 0.3 * I * Math.sin(TAU * 1.4 * tc + sp.fa));
        const wob = R * 0.22 * I;
        const fx = P[0] - P[3] * across + wob * Math.sin(TAU * (sp.f1 * t + sp.p1));
        const fy = P[1] + P[2] * across + wob * Math.sin(TAU * (sp.f2 * t + sp.p2));
        const up = M.smoothstep(sp.up, sp.up + 0.14, t), x = span(t, sp.down, sp.down + 0.22);
        const w = up * (1 - x) * (1 - x) * (1 - x);
        const dx = fx - sp.hx, dy = fy - sp.hy, bend = sp.curl * 0.24 * Math.sin(Math.PI * w);
        const sh = shiver(sp, span(t, sp.down + 0.22, sp.down + 0.32), 0.35 * I, cycles);
        return [sp.hx + dx * w - dy * bend - sp.ty * sh, sp.hy + dy * w + dx * bend + sp.tx * sh];
      },
      solid(t) {
        const gone = 1 - M.smoothstep(0, 0.07, t);
        const five = Math.max(gone, M.smoothstep(0.8, 0.92, t));
        return { body: five, bar: five, ribbon: Math.max(gone, M.smoothstep(0.84, 0.96, t)), s: Math.max(gone, M.smoothstep(0.88, 1, t)) };
      }
    };
  }

  function scatter(p, env, list) {
    const I = p.intensity, X = p.scatter, ease = M.easing(p.easing);
    const sg = env.direction === 'left' ? -1 : 1;
    const B = [A.bowl[0] + 90 * sg, A.bowl[1] - 10];
    const cycles = M.clamp(p.duration / 500, 1, 3);
    for (const sp of list) {
      const q = sp.r, hx = sp.hx - B[0], hy = sp.hy - B[1], d0 = Math.hypot(hx, hy);
      // the ribbon's specks whip out along the ribbon, both ways from its middle; the letters' fly away from the burst
      sp.ang = sp.g === 'ribbon'
        ? Math.atan2(sp.ty, sp.tx) + (sp.u < 0.5 ? Math.PI : 0) + (q[0] - 0.5) * 0.7
        : Math.atan2(hy, hx) + (q[0] - 0.5) * 1.1;
      sp.dist = (110 + 560 * Math.pow(q[1], 0.8)) * (0.2 + 0.8 * X) * (0.55 + 0.45 * I);
      sp.d = 0.01 + 0.07 * M.clamp(d0 / 650, 0, 1) + 0.012 * q[2];   // the shock reaches the far specks a moment later
      sp.e = 0.54 + 0.06 * q[3];                                    // when the pull home wins
      sp.spin = sg * (0.35 + 0.65 * q[4]) * (0.4 + 0.9 * I) + (q[5] - 0.5) * 0.3;
    }
    return {
      place(sp, t) {
        const u = span(t, sp.d, 0.98);
        const f = ease(span(t, sp.d, sp.d + 0.28)) - back(span(t, sp.e, 0.98));   // out with drag, a hang, home on a spring
        const th = sp.ang + sp.spin * Math.sin(Math.PI * u);         // the path curls out one way and home the other
        const drift = sg * 150 * X * I * Math.pow(Math.sin(Math.PI * u), 2);
        const sh = shiver(sp, span(t, sp.e + 0.2, sp.e + 0.34), 0.3 * I, cycles);
        return [sp.hx + Math.cos(th) * sp.dist * f + drift - sp.ty * sh, sp.hy + Math.sin(th) * sp.dist * f + sp.tx * sh];
      },
      solid(t) {
        const gone = 1 - M.smoothstep(0, 0.05, t);
        const five = Math.max(gone, M.smoothstep(0.84, 0.95, t));
        return { body: five, bar: five, ribbon: Math.max(gone, M.smoothstep(0.86, 0.97, t)), s: Math.max(gone, M.smoothstep(0.88, 1, t)) };
      }
    };
  }

  function gather(p, env, list) {
    const I = p.intensity, X = p.scatter, ease = M.easing(p.easing);
    const sg = env.direction === 'left' ? -1 : 1;
    const v = env.view, cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const k = 0.4 + 0.75 * X;                               // how much of the field the dust covers
    const W = 20 + 60 * I;                                  // the curls' size
    const cycles = M.clamp(p.duration / 500, 1, 3);
    const win = { body: [0.36, 0.76], bar: [0.4, 0.78], ribbon: [0.34, 0.8], s: [0.46, 0.84] };
    for (const sp of list) {
      const q = sp.r, w = win[sp.g];
      sp.sx = cx + (q[0] - 0.5) * (v.x1 - v.x0) * k;
      sp.sy = cy + (q[1] - 0.5) * (v.y1 - v.y0) * k;
      sp.s0 = 0.22 * q[2];
      sp.a = w[0] + (w[1] - w[0]) * (0.5 * sp.u + 0.5 * q[3]);   // loosely in the order the stroke is written
      sp.curl = sg * (0.3 + 0.7 * q[4]) * (0.3 + 0.9 * I);
      sp.f1 = 0.5 + 1.1 * q[5]; sp.f2 = 1.4 + 1.6 * q[6]; sp.p1 = q[7]; sp.p2 = q[8];
    }
    return {
      place(sp, t) {
        const e = ease(span(t, sp.s0, sp.a));
        const dx = sp.hx - sp.sx, dy = sp.hy - sp.sy, d = Math.hypot(dx, dy) || 1;
        const bend = sp.curl * 0.42 * Math.sin(Math.PI * e);           // a swirl in
        const wig = (1 - e) * W * (Math.sin(TAU * (sp.f1 * t + sp.p1)) + 0.6 * Math.sin(TAU * (sp.f2 * t + sp.p2)));   // and curls
        const sh = shiver(sp, span(t, sp.a, sp.a + 0.1), 0.4 * I, cycles);
        return [sp.sx + dx * e - dy * bend - (dy / d) * wig - sp.ty * sh, sp.sy + dy * e + dx * bend + (dx / d) * wig + sp.tx * sh];
      },
      solid(t) {
        const five = M.smoothstep(0.74, 0.88, t);
        return { body: five, bar: five, ribbon: M.smoothstep(0.78, 0.92, t), s: M.smoothstep(0.86, 1, t) };
      }
    };
  }

  const STYLES = { murmur, scatter, gather };

  function specks(ctx, list, t, p, env, place, S) {
    const pal = env.palette;
    const unit = 1 / (env.scale * env.dpr);                 // one device pixel in mark units
    const th0 = 8 * p.weight * M.clamp(Math.sqrt(400 / p.count), 0.75, 1.6);
    const dot = p.shape === 'dot';
    const th = Math.max(dot ? th0 * 1.9 : th0, 1.25 * unit);
    const rest = dot ? th * 0.02 : Math.max(th0 * 2.5, th + unit);     // a dash's length at rest
    const fly = dot ? 0 : th0 * 3.4;                                   // and how much it lengthens at speed
    const eps = 0.004, still = 300;                                    // below about this speed the stroke's direction shows
    const buckets = [];
    for (const sp of list) {
      if (S[sp.g] >= 0.999) continue;
      const P = place(sp, t), Q = place(sp, t + eps);
      const vx = (Q[0] - P[0]) / eps, vy = (Q[1] - P[1]) / eps, speed = Math.hypot(vx, vy);
      const s = vx * sp.tx + vy * sp.ty < 0 ? -still : still;
      const dx = vx + sp.tx * s, dy = vy + sp.ty * s, d = Math.hypot(dx, dy) || 1;
      const h = (rest + fly * Math.min(1, speed / 2500)) / 2 / d;
      (buckets[sp.bin] || (buckets[sp.bin] = [])).push(P[0] - dx * h, P[1] - dy * h, P[0] + dx * h, P[1] + dy * h);
    }
    ctx.save();
    const base = ctx.globalAlpha;
    ctx.lineCap = 'round';
    GROUPS.forEach((g, gi) => {
      const a = 1 - S[g];
      if (a <= 0.001) return;
      ctx.globalAlpha = base * a;
      ctx.lineWidth = g === 'ribbon' ? th * 0.85 : th;
      for (let b = 0; b < BINS; b++) {
        const seg = buckets[gi * BINS + b];
        if (!seg) continue;
        ctx.strokeStyle = M.colourAt(pal[g], (b + 0.5) / BINS);
        ctx.beginPath();
        for (let i = 0; i < seg.length; i += 4) { ctx.moveTo(seg[i], seg[i + 1]); ctx.lineTo(seg[i + 2], seg[i + 3]); }
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  Motion.register({
    id: 'swarm',
    name: 'Swarm',
    idea: 'The mark is a flock: hundreds of specks in its colours sit along its strokes, something startles them, they burst up and wheel round the frame together, and settle back into the 5 and the s.',
    why: 'Many small things you collect becoming one shape that is you: the mark leaves its footprint entirely, becomes a living crowd and comes home.',
    moments: ['split', 'bring', 'launch', 'empty', 'pass'],
    styles: ['murmur', 'scatter', 'gather'],
    params: {
      duration: { default: 1400, min: 300, max: 4000, step: 50 },
      style: { default: 'murmur', options: ['murmur', 'scatter', 'gather'] },
      count: { default: 400, min: 150, max: 800, step: 10 },
      scatter: { default: 0.6, min: 0, max: 1, step: 0.05 },
      shape: { default: 'dash', options: ['dash', 'dot'] },
      easing: { default: 'inOutSine', options: M.EASES.slice() }   // a steady sweep reads best as a flock
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const list = flock(p, env);
      const st = (STYLES[p.style] || murmur)(p, env, list);
      const S = st.solid(t);
      if (!p.ribbon) S.ribbon = 1;
      if (S.body >= 0.999 && S.bar >= 0.999 && S.s >= 0.999 && S.ribbon >= 0.999) {   // at rest: the still mark itself
        M.mark(ctx, { palette: env.palette, weight: p.weight, ribbon: p.ribbon });
        return;
      }
      const pal = env.palette;
      // the specks fuse: each stroke swells out from its spine to full width, opaque early, so the change never
      // shows as a see-through stroke (which reads muddy on the dark ground)
      const fuse = (k) => ({ width: 0.25 + 0.75 * k, alpha: M.smoothstep(0, 0.25, k) });
      if (p.ribbon && S.ribbon > 0) { const f = fuse(S.ribbon); M.ribbon(ctx, 0, { colours: pal.ribbon, alpha: f.alpha, width: M.widths.ribbon * f.width }); }
      for (const g of LETTERS) if (S[g] > 0) { const f = fuse(S[g]); M.stroke(ctx, PTS[g], { width: M.widths[g] * p.weight * f.width, colours: pal[g], alpha: f.alpha }); }
      specks(ctx, list, t, p, env, st.place, S);
    }
  });
})();

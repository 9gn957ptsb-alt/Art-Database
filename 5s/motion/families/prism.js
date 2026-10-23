/* 5s Motion Lab: Prism (added 23 Oct 2026, from the artist's sheet of twenty iterations, reference/iterations.png).
 *
 * Light passes through the glass. A bar of light crosses the mark; where it goes through the glass's fold it splits
 * into cyan, blue and violet fringes, it throws bright caustics onto the 5 and the s, and it leaves the glass glowing
 * before the mark comes to rest. Discovery as light: what you had not seen comes through and lights up what you have.
 *
 * Styles
 *   sweep    a leaning bar of light (it leans with the 5) crosses from left to right: white on the letters, split
 *            into cyan, blue and violet fringes as it goes through the glass, a spark at the bar's blade as it
 *            passes; the glass it has crossed keeps glowing, then fades
 *   caustic  light falls through the glass and its folds focus it into a net of bright caustic lines that plays
 *            over the 5 and the s (warm) and over the glass (cool), swells and fades
 *   flare    a glint runs along the bar's top to its blade and flares there: a star, a long streak, ghosts in the
 *            glass's colours along the line through the mark; the light spreads through the glass from the tip
 *            in a spectral ring
 *   split    one white beam comes in at the glass's top right corner and divides into three, cyan, blue and violet,
 *            that land one after another on the bar, the bowl and the s (Irwin's three ways); one of them (the
 *            seed's) stays lit longest
 *
 * The mark is drawn as Marks.mark draws it (glass or ribbon, body, bar, s), so both looks come through the engine:
 * in the Iterations look (params.look = 'iterations') the sheet's letters and glass, in the classic look the classic
 * letters and ribbon (the ribbon is the glass then; with ribbon off the light has nothing to split in and stays white).
 * While light is on, the glass and the letters are each drawn into one Marks.layer and the light is put on them
 * source-atop, so it never lands on the ground; light in the air (the beams, the flare) is drawn over the ground in
 * colour on a light field and added ('lighter') on a dark one. Flat palettes (Ink, Paper) keep their one colour.
 * t = 1 is exactly the still mark (Marks.mark).
 *
 * Params: spread (how far the light fans out into its fringes), glow (how bright and how long the glass glows after
 * the light). Shared: palette, ribbon, weight, intensity (how strong and wide the light is), easing (the light's
 * travel), duration. env.rng (the seed) picks which of split's three beams stays lit.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const N = 160;   // as Marks.mark: the same letters at rest
  const PTS = { body: M.points('body', N), bar: M.points('bar', N), s: M.points('s', N) };
  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (x) => Math.sin(Math.PI * M.clamp(x, 0, 1)) ** 2;   // 0 -> 1 -> 0, flat at both ends
  const lum = (hex) => { const v = parseInt(String(hex).slice(1, 7), 16); return ((v >> 16) * 0.2126 + ((v >> 8) & 255) * 0.7152 + (v & 255) * 0.0722) / 255; };

  const WARM = '#FFF6DE', WHITE = '#FFFFFF';
  const SPECTRUM = ['#5CE1FF', '#3D7BFF', '#9B5CFF'];   // cyan, blue, violet
  const LEAN = 0.36;                                   // the bar of light leans with the 5 (radians from vertical)
  const NRM = [Math.cos(LEAN), Math.sin(LEAN)];        // across the bar, left to right
  const E = [872, 304];                                // where split's beam enters the glass (its top right)
  const TARGETS = [[470, 236], [300, 724], [800, 700]]; // the bar, the bowl, the s

  // a band of light across the plane along `n`: profile [[d, colour, alpha], ...] (d from `centre`, increasing;
  // alpha 0 at both ends), one gradient fill
  function band(c, n, centre, profile) {
    const d0 = profile[0][0], d1 = profile[profile.length - 1][0];
    const P = (d) => [500 + n[0] * (centre + d), 500 + n[1] * (centre + d)];
    const a = P(d0), b = P(d1), g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (const [d, col, al] of profile) g.addColorStop(M.clamp((d - d0) / (d1 - d0), 0, 1), M.rgba(col, al));
    c.fillStyle = g;
    c.fillRect(-1000, -1000, 3000, 3000);
  }
  function spot(c, x, y, r, col, a) {
    if (!(a > 0.002) || !(r > 1)) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, M.rgba(col, a)); g.addColorStop(0.4, M.rgba(col, a * 0.5)); g.addColorStop(1, M.rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  // a four-point spark: two thin crossed rays and a glow
  function spark(c, x, y, r, col, a) {
    if (!(a > 0.002)) return;
    spot(c, x, y, r * 0.5, col, a);
    c.save();
    c.lineCap = 'round';
    for (const [dx, dy, k] of [[1, 0, 1], [0, 1, 0.7], [0.7, 0.7, 0.35], [0.7, -0.7, 0.35]]) {
      const g = c.createLinearGradient(x - dx * r * k, y - dy * r * k, x + dx * r * k, y + dy * r * k);
      g.addColorStop(0, M.rgba(col, 0)); g.addColorStop(0.5, M.rgba(col, a)); g.addColorStop(1, M.rgba(col, 0));
      c.strokeStyle = g; c.lineWidth = 5;
      c.beginPath(); c.moveTo(x - dx * r * k, y - dy * r * k); c.lineTo(x + dx * r * k, y + dy * r * k); c.stroke();
    }
    c.restore();
  }

  // caustics: two crossing families of wavering lines, a wide soft pass and a thin bright one; they drift with t
  function caustics(c, t, col, a, I) {
    if (!(a > 0.002)) return;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, k] of [[26, 0.28], [8, 1]]) {
      c.strokeStyle = M.rgba(col, a * k); c.lineWidth = w * (0.7 + 0.6 * I);
      for (let f = 0; f < 2; f++) {
        const ang = f ? 0.5 : -1.05, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const off = -520 + i * 190 + 80 * f + 120 * t;
          for (let j = 0; j <= 26; j++) {
            const u = -650 + j * 50;
            const wv = 46 * Math.sin(u * 0.0105 + TAU * 0.9 * t + i * 1.7 + 2 * f) + 20 * Math.sin(u * 0.026 - TAU * 1.3 * t + i * 2.3);
            const x = 500 + dx * u + nx * (off + wv), y = 500 + dy * u + ny * (off + wv);
            if (j) c.lineTo(x, y); else c.moveTo(x, y);
          }
        }
        c.stroke();
      }
    }
    c.restore();
  }

  // the mark as Marks.mark draws it, the glass and the letters each with their light (fx: source-atop, or null)
  function glassOf(ctx, pal, gt, fx) {
    const draw = (c) => {
      M.ribbon(c, gt, { colours: pal.ribbon });
      if (fx) { c.save(); c.globalCompositeOperation = 'source-atop'; fx(c); c.restore(); }
    };
    if (fx) M.layer(ctx, { composite: 'source-over' }, draw); else draw(ctx);
  }
  function lettersOf(ctx, pal, k, fx) {
    const draw = (c) => {
      M.stroke(c, PTS.body, { width: M.widths.body * k, colours: pal.body });
      M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
      M.stroke(c, PTS.s, { width: M.widths.s * k, colours: pal.s });
      if (fx) { c.save(); c.globalCompositeOperation = 'source-atop'; fx(c); c.restore(); }
    };
    if (fx) M.layer(ctx, { composite: 'source-over' }, draw); else draw(ctx);
  }
  // light in the air, over the ground: coloured on a light field, added on a dark one
  function air(ctx, dark, draw) {
    ctx.save();
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    draw(ctx);
    ctx.restore();
  }

  Motion.register({
    id: 'prism',
    name: 'Prism',
    idea: 'Light passes through the glass: a bright bar of light sweeps across the mark, splits in the fold into cyan, blue and violet fringes, throws caustic highlights onto the 5 and the s, and leaves the glass glowing.',
    why: "Discovery, the app's 'automated exposure to the forefront' as light: the moment something you had not seen comes through and lights up what you already have. The split style divides into three beams that land on the bar, the bowl and the s, after Irwin's three ways.",
    moments: ['turn', 'launch', 'set-pin', 'path', 'five-start'],
    styles: ['sweep', 'caustic', 'flare', 'split'],
    params: {
      duration: { default: 1500, min: 500, max: 4000, step: 50 },
      style: { default: 'sweep', options: ['sweep', 'caustic', 'flare', 'split'] },
      spread: { default: 0.5, min: 0, max: 1, step: 0.05 },   // how far the light fans out into its fringes
      glow: { default: 0.5, min: 0, max: 1, step: 0.05 },     // how bright and how long the glass glows after
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette, I = p.intensity, ease = M.easing(p.easing);
      const dark = lum(pal.bg) < 0.45;
      const flat = pal.ribbon.length < 2 || (pal.look && pal.look.mono);
      const light = flat ? M.mix(pal.five[0], WHITE, dark ? 0.6 : 0.75) : WARM;
      const FR = flat ? [light, light, light] : SPECTRUM;
      const k = p.weight, A = 0.45 + 0.5 * I;   // the light's strength
      // the glass's glow after the light: up to t0, then fading out by the end (later with more glow)
      const afterglow = (t0) => p.glow * M.smoothstep(t0 - 0.3, t0, t) * (1 - M.smoothstep(t0, M.lerp(0.85, 1, p.glow), t));
      let gfx = null, lfx = null, airFx = null, between = null, gt = 0;

      if (p.style === 'sweep') {
        const run = ease(seg(t, 0.02, 0.8)), c0 = -760 + 1520 * run, w = 60 + 70 * I;
        const on = 1 - seg(t, 0.8, 0.86);                      // the bar of light leaves the frame
        const split = M.smoothstep(-420, 160, c0);             // it splits as it goes into the fold
        const gap = (24 + 120 * p.spread) * split * (0.6 + 0.4 * I);
        const glowA = afterglow(0.55) * (0.5 + 0.5 * I);
        gt = 0.08 * I * bump(seg(t, 0.1, 1));
        lfx = (c) => {
          band(c, NRM, c0, [[-2.6 * w, light, 0], [-w, light, 0.22 * A * on], [-0.3 * w, light, 0.85 * A * on], [0.25 * w, WHITE, A * on], [0.55 * w, light, 0]]);
        };
        gfx = (c) => {
          if (glowA > 0.002) band(c, NRM, c0, [[-1800, FR[0], 0], [-900, FR[0], 0.28 * glowA], [-0.6 * w, FR[0], 0.4 * glowA], [0, FR[0], 0]]);
          const g = [[-0.35 * w - 4 * gap - 0.8 * w, FR[2], 0]];
          for (let i = 2; i >= 0; i--) g.push([-0.35 * w - (i + 1) * gap, FR[i], 0.8 * A * on * Math.max(split, 0.25)]);
          g.push([-0.3 * w, WHITE, 0.9 * A * on], [0.25 * w, WHITE, A * on], [0.6 * w, WHITE, 0]);
          band(c, NRM, c0, g);
        };
        // a spark at the bar's blade as the light passes it
        const tip = pal.look ? pal.look.cut[0] : [616, 229];
        const sT = (tip[0] - 500) * NRM[0] + (tip[1] - 500) * NRM[1];
        const sa = A * Math.exp(-(((c0 - sT) / (w * 1.2)) ** 2)) * on;
        if (sa > 0.01) airFx = (c) => spark(c, tip[0], tip[1], 120 + 90 * I, dark ? light : WHITE, sa);
        if (dark && on > 0) {
          const air0 = airFx;
          airFx = (c) => { band(c, NRM, c0, [[-1.8 * w, light, 0], [0, light, 0.07 * A * on], [0.5 * w, light, 0]]); if (air0) air0(c); };
        }
      } else if (p.style === 'caustic') {
        const L = M.smoothstep(0, 0.28, t) * (1 - M.smoothstep(0.6, 0.97, t));
        const ct = ease(seg(t, 0, 1));
        const glowA = afterglow(0.5) * (0.5 + 0.5 * I) * (1 - L);
        gt = 0.12 * I * bump(seg(t, 0.05, 1));
        if (L > 0.002) lfx = (c) => caustics(c, ct, light, 0.75 * A * L, I);
        if (L > 0.002 || glowA > 0.002) {
          gfx = (c) => {
            if (glowA > 0.002) { c.fillStyle = M.rgba(FR[0], 0.3 * glowA); c.fillRect(-1000, -1000, 3000, 3000); }
            caustics(c, ct, WHITE, 0.7 * A * L, I);
            c.save(); c.translate(10 + 26 * p.spread, 6 + 12 * p.spread); caustics(c, ct, FR[0], 0.55 * A * L, I); c.restore();
          };
        }
      } else if (p.style === 'flare') {
        const tip = pal.look ? pal.look.cut[0] : [616, 229];
        const run = ease(seg(t, 0, 0.32)), gx = M.lerp(250, tip[0], run), gy = M.lerp(tip[1] + 20, tip[1], run);
        const glint = A * seg(t, 0, 0.08) * (1 - seg(t, 0.3, 0.4));
        const F = A * seg(t, 0.26, 0.36) * Math.exp(-3.2 * seg(t, 0.36, 1)) * (1 - seg(t, 0.85, 0.98));
        const r = 1150 * ease(seg(t, 0.3, 0.9)), ring = (1 - seg(t, 0.72, 0.95)) * seg(t, 0.3, 0.36);
        const glowA = afterglow(0.6) * (0.5 + 0.5 * I);
        gt = 0.1 * I * bump(seg(t, 0.3, 1));
        lfx = (c) => {
          spot(c, gx, gy, 110 + 60 * I, light, glint);
          spot(c, tip[0], tip[1], 260 + 200 * I, light, 0.9 * F);
        };
        gfx = (c) => {
          if (glowA > 0.002) spot(c, tip[0], tip[1], 900, FR[0], 0.45 * glowA);
          if (ring > 0.002 && r > 40) {
            const sp = 40 + 90 * p.spread, g = c.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], r);
            const at = (d) => M.clamp(1 - d / r, 0, 1);
            g.addColorStop(0, M.rgba(WHITE, 0));
            g.addColorStop(at(3 * sp + 160), M.rgba(WHITE, 0.15 * ring * A));
            g.addColorStop(at(3 * sp), M.rgba(FR[0], 0.7 * ring * A));
            g.addColorStop(at(2 * sp), M.rgba(FR[1], 0.7 * ring * A));
            g.addColorStop(at(sp), M.rgba(FR[2], 0.6 * ring * A));
            g.addColorStop(1, M.rgba(FR[2], 0));
            c.fillStyle = g; c.fillRect(tip[0] - r, tip[1] - r, 2 * r, 2 * r);
          }
          spot(c, tip[0], tip[1], 300 + 200 * I, WHITE, F);
        };
        if (F > 0.002) {
          airFx = (c) => {
            spark(c, tip[0], tip[1], 260 + 260 * I, dark ? light : WHITE, F);
            // the streak: long and thin, along the bar
            const g = c.createLinearGradient(tip[0] - 700, 0, tip[0] + 700, 0);
            g.addColorStop(0, M.rgba(FR[0], 0)); g.addColorStop(0.5, M.rgba(dark ? WHITE : FR[0], 0.7 * F)); g.addColorStop(1, M.rgba(FR[0], 0));
            c.fillStyle = g; c.fillRect(tip[0] - 700, tip[1] - 4, 1400, 8);
            // ghosts down the line from the tip through the mark's centre
            const cx = 505 - tip[0], cy = 495 - tip[1], drift = 0.12 * (t - 0.4);
            [[0.55, 46, 2], [0.95, 26, 0], [1.3, 70, 1], [1.62, 36, 2]].forEach(([f, rad, ci]) => {
              const q = f + drift * f;
              spot(c, tip[0] + cx * q, tip[1] + cy * q, rad * (0.8 + 0.6 * I), FR[ci], (dark ? 0.35 : 0.28) * F);
            });
          };
        }
      } else {   // split
        const chosen = Math.floor(env.rng() * 3);
        const inA = ease(seg(t, 0.02, 0.22));                  // the white beam comes in to the corner
        const S0 = [E[0] + 520, E[1] - 520 * 0.7];
        const head = [M.lerp(S0[0], E[0], inA), M.lerp(S0[1], E[1], inA)];
        const inFade = 1 - seg(t, 0.62, 0.8);
        const beams = TARGETS.map((q, i) => {
          const go = ease(seg(t, 0.2 + 0.07 * i, 0.42 + 0.07 * i));
          const land = seg(t, 0.36 + 0.07 * i, 0.46 + 0.07 * i);
          const end = i === chosen ? [0.82, 0.97] : [0.6, 0.78];
          const fade = 1 - seg(t, end[0], end[1]);
          return { q, i, go, land: land * fade, fade };
        });
        const flash = A * seg(t, 0.17, 0.22) * (1 - seg(t, 0.22, 0.5));
        const glowA = afterglow(0.55) * (0.5 + 0.5 * I);
        gt = 0.08 * I * bump(seg(t, 0.15, 1));
        const w0 = 14, w1 = 70 + 60 * I + 40 * p.spread;
        // the beams, between the glass and the letters: coloured shafts that pass behind the letters to land on them
        between = (c) => air(c, dark, (a) => {
          if (inA > 0 && inFade > 0) shaft(a, S0, head, 30, 22, light, (dark ? 0.35 : 0.5) * A * inFade, 1);
          for (const b of beams) {
            if (!(b.go > 0) || !(b.fade > 0)) continue;
            const tipq = [M.lerp(E[0], b.q[0], b.go), M.lerp(E[1], b.q[1], b.go)];
            shaft(a, E, tipq, w0, M.lerp(w0, w1, b.go), FR[b.i], (dark ? 0.45 : 0.42) * A * b.fade * (b.i === chosen ? 1 : 0.85), b.go);
          }
        });
        lfx = (c) => { for (const b of beams) spot(c, b.q[0], b.q[1], 120 + 70 * I, light, 0.85 * A * b.land * (b.i === chosen ? 1 : 0.8)); };
        gfx = (c) => {
          if (glowA > 0.002) spot(c, E[0], E[1], 700, FR[0], 0.5 * glowA);
          spot(c, E[0], E[1], 220, WHITE, 0.8 * flash);
        };
        if (flash > 0.01) airFx = (c) => spark(c, E[0], E[1], 150 + 100 * I, dark ? light : WHITE, flash);
      }

      if (p.ribbon) glassOf(ctx, pal, gt, gfx);
      if (between) between(ctx);
      lettersOf(ctx, pal, k, lfx);
      if (airFx) air(ctx, dark, airFx);
    }
  });

  // a shaft of light from a to b, w0 wide at a and w1 at b, fading toward its soft tip (go: how far it has come)
  function shaft(c, a, b, w0, w1, col, al, go) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (!(L > 1) || !(al > 0.002)) return;
    const nx = -dy / L, ny = dx / L;
    const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, M.rgba(col, al)); g.addColorStop(0.8, M.rgba(col, al * 0.8)); g.addColorStop(1, M.rgba(col, al * (go >= 1 ? 0.6 : 0)));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2); c.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
    c.lineTo(b[0] - nx * w1 / 2, b[1] - ny * w1 / 2); c.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
    c.closePath(); c.fill();
  }
})();

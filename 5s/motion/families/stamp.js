/* 5s Motion Lab: Stamp (Gesture & judgment; added 22 Oct 2026).
 *
 * The mark is a rubber stamp. It lifts toward you, slams down onto the screen as if it were paper, ink squeezes
 * out round its edges and the frame jolts; then it lifts away and leaves the print, which dries crisp.
 *
 * Nothing else in the library hits. Echo, Count, Rewind and Morph (the artist's stars) build up through time in
 * counted beats; Stamp decides in one blow, along the axis toward the viewer: snap, pressure and ink. A stamp is a
 * verdict, and 5s is a judgment app: keep, pass, approved, done.
 *
 * Styles
 *   press    one hard hit: the mark rises toward you (its shadow grows below and to the right, so it reads as
 *            height; in the dark it brightens instead), hangs for an instant, slams down in two frames to a
 *            squash, the frame jolts, and the print is there: wet ink squeezed past the edge in a ragged, deeper
 *            rim, droplets flung off it, and the rubber stamp's grain (worn patches where the ink did not take);
 *            the shadow spreads and fades as the stamp leaves, and the print dries back to the crisp mark. The
 *            ribbon prints a beat later, like a second, lighter stamp
 *   double   a clerk's rhythm, two hits: the 5 stamps first, then the s (lighter, a hair off-register: turned a
 *            few degrees and shifted), which is then nudged home; at 0.3 s a quick ba-dum, at 1.5 s a ritual
 *   seal     a wax seal: the ribbon (which wraps the 5's bowl) thickens into a ring of wax that fills into a disc
 *            under the rising mark; the mark comes down into it, the wax squeezes out past the die in a lumpy,
 *            ringing rim, the die's circle is pressed into it, and the letters stand embossed (a light edge upper
 *            left, a dark edge lower right); then the wax draws back to the ribbon's loop round the bowl and
 *            hollows out into the ribbon again. Without the ribbon it pools from the bowl and drains back into it.
 *            The wax is the turn's violet (cobalt in Turn; in Ink and Paper, the palette's one colour, where the
 *            letters show only by their relief, and a die-cut rim of background parts them while they are lifted)
 *
 * Every style starts and ends on the still mark (exactly Marks.mark at t = 0 and t = 1), so it can sit anywhere.
 * Params: lift (how far it rises before the hit, times intensity), ink (how far the ink squeezes past the edge,
 * and how rough the edge is while wet), jolt (the frame shakes on impact). The slam and the jolt are timed in
 * real milliseconds from p.duration, so the hit stays a snap from 250 ms to 2 s.
 *
 * Chance (the rough edge, the grain, the droplets, the jolt's direction, the off-register turn, the wax rim) comes
 * from env.rng, drawn in the same order on every frame, so a seed always stamps the same print.
 *
 * Soft shadows use the canvas's own shadowBlur inside a full-resolution layer, not Marks.layer's blur: that path
 * draws at reduced resolution and, in the strip check, its pooled scratch canvas leaked stale pixels at the edge
 * of the region it used, so the same t gave different frames.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;

  // the still mark's own resolution (Marks.mark draws 160 points), so the frame at rest is the still mark exactly
  const N = 160;
  const NAMES = ['body', 'bar', 's'];
  const PTS = { body: M.points('body', N), bar: M.points('bar', N), s: M.points('s', N) };
  const W = { body: M.widths.body, bar: M.widths.bar, s: M.widths.s };
  const FRAC = {};   // each point's fraction of its stroke's length (for the gradient along the stroke)
  const LEN = {};
  for (const name of NAMES) {
    LEN[name] = M.length(name);
    const pts = PTS[name], cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    FRAC[name] = cum.map((c) => c / L);
  }
  const PART = { five: ['body', 'bar'], s: ['s'] };

  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);

  // is a colour dark? (relative luminance), so shadows and wet ink follow the real background (paper, inverse)
  const isDark = (hex) => {
    const h = M.mix(hex, hex, 0), r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.25;
  };
  const flat = (pal) => pal.name === 'ink' || pal.name === 'paper';
  // a gradient's stops, each mixed toward `to` by w (stops may be '#hex' or [u, '#hex'])
  const tint = (stops, to, w) => (w <= 0.001 ? stops : stops.map((s) => (Array.isArray(s) ? [s[0], M.mix(s[1], to, w)] : M.mix(s, to, w))));

  /* ---------------------------------------------------------------------------------------------------------
   * chance, drawn in a fixed order every frame (env.rng is reseeded per frame)
   * ------------------------------------------------------------------------------------------------------- */
  function chance(rng) {
    const r = () => rng() * 2 - 1;
    const noise = {};
    for (const name of NAMES) {
      // a smooth wobble (a control value every ~44 mark units, cosine-interpolated) plus a fine grain per point
      const L = LEN[name], K = Math.ceil(L / 44) + 2, ctl = [];
      for (let j = 0; j < K; j++) ctl.push(r());
      const smooth = new Float64Array(N), fine = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const x = (FRAC[name][i] * L) / 44, j = Math.min(K - 2, Math.floor(x)), f = (1 - Math.cos(Math.PI * (x - j))) / 2;
        smooth[i] = ctl[j] + (ctl[j + 1] - ctl[j]) * f;
        fine[i] = r();
      }
      noise[name] = { smooth, fine };
    }
    // droplets flung from the edge at the hit: where along which stroke, which side, how far, how big
    const drops = [];
    for (let d = 0; d < 14; d++) {
      const pick = rng(), name = pick < 0.5 ? 'body' : pick < 0.62 ? 'bar' : 's';
      drops.push({ name, at: 0.04 + 0.92 * rng(), side: rng() < 0.5 ? -1 : 1, far: 0.35 + 0.65 * rng(), size: 0.45 + 0.55 * rng(), lag: 0.4 * rng() });
    }
    // the grain of a rubber stamp: specks where the ink did not take, in worn patches (clusters along the
    // strokes), small ones mostly, stretched a little along the stroke like dry-brush streaks
    const specks = [];
    for (let g = 0; g < 22; g++) {
      const pick = rng(), name = pick < 0.55 ? 'body' : pick < 0.67 ? 'bar' : 's';
      const at = rng(), across = 0.7 * (rng() - 0.5), spread = 0.012 + 0.03 * rng();
      for (let q = 0; q < 11; q++) {
        specks.push({ name, at: M.clamp(at + spread * r() * (q < 3 ? 2.2 : 1), 0, 1), across: M.clamp(across + 0.22 * r(), -0.44, 0.44), size: Math.pow(rng(), 2.2), long: 1.3 + 1.8 * rng() });
      }
    }
    const joltAngle = Math.PI / 2 + 0.45 * r();             // mostly down, the way the hit pushes the screen
    const joltAngle2 = Math.PI / 2 + 0.6 * r();
    const offSign = rng() < 0.5 ? -1 : 1;                   // double: which way the second hit slips
    const offAngle = TAU * rng();
    const offAmt = rng();
    const rim = [];                                          // seal: the wax rim's harmonics
    for (let k = 2; k <= 7; k++) rim.push({ k, a: (0.4 + 0.6 * rng()) / k, ph: TAU * rng() });
    return { noise, drops, specks, joltAngle, joltAngle2, offSign, offAngle, offAmt, rim };
  }

  /* ---------------------------------------------------------------------------------------------------------
   * the hit, as curves of t
   * ------------------------------------------------------------------------------------------------------- */
  // one stamp: rest -> lift (eased by p.easing) to the top -> a small creeping wind-up -> the slam (accelerating,
  // a few real frames) through contact into a squash -> a damped rebound back to rest. Returns the scale's
  // excess over 1 (lift > 0, squash < 0) and the hit time.
  function blow(t, o) {
    // o: {t0, top, hang, slam, lift, squash, settle, ease}
    const { t0, top, hang, slam, lift, squash, settle, ease } = o;
    const H = hang + slam;
    if (t <= t0) return { s: 0, H, h: 0 };
    if (t < top) { const e = ease(span(t, t0, top)); return { s: lift * e, H, h: e }; }
    const wind = 1 + 0.05 * Math.sin((Math.PI / 2) * span(t, top, hang));
    if (t < hang) return { s: lift * wind, H, h: wind };
    if (t < H) {
      const x = span(t, hang, H), e = x * x * x;              // falling faster and faster
      const s = M.lerp(lift * 1.05, -squash, e);
      return { s, H, h: Math.max(0, s / Math.max(1e-6, lift)) };
    }
    const x = span(t, H, H + settle);
    if (x >= 1) return { s: 0, H, h: 0 };
    // the squash recovers with one small rebound, exactly 0 at x = 1
    const f = Math.exp(-4.2 * x) * Math.cos(2.6 * Math.PI * x) * (1 - x * x);
    return { s: -squash * f, H, h: 0 };
  }

  // the frame's jolt after a hit at H: a decaying shake timed in real ms, gone before the end
  function shake(t, H, dur, amp, angle) {
    const ms = (t - H) * dur;
    if (ms <= 0 || amp <= 0) return [0, 0];
    const v = amp * Math.exp(-ms / 75) * Math.sin(TAU * ms / 62) * (1 - M.smoothstep(0.82, 0.96, t));
    return [Math.cos(angle) * v, Math.sin(angle) * v];
  }

  // wet ink after a hit at H: squeeze (ink pushed past the edge) peaks just after contact, then dries back by `end`
  // (0.9 unless a style dries a print sooner); swell (the strokes' width) pulls back over 20% of t
  function wetness(t, H, end) {
    if (t < H) return { squeeze: 0, swell: 0, wet: 0, fly: 0, grain: 0 };
    end = end || 0.9;
    const a = M.ease.outCubic(span(t, H, H + 0.035));
    const dry = M.ease.inOutCubic(span(t, H + 0.05, end));
    return { squeeze: a * (1 - dry), swell: 1 - M.ease.outCubic(span(t, H, H + 0.2)), wet: 1 - M.ease.inOutSine(span(t, H, end)), fly: span(t, H, H + 0.09),
      grain: M.ease.outCubic(span(t, H - 0.005, H + 0.02)) * (1 - M.ease.inOutCubic(span(t, H + 0.08, end - 0.04))) };
  }

  /* ---------------------------------------------------------------------------------------------------------
   * drawing
   * ------------------------------------------------------------------------------------------------------- */
  function place(ctx, tr, draw) {
    ctx.save();
    ctx.translate(tr.o[0] + (tr.dx || 0), tr.o[1] + (tr.dy || 0));
    if (tr.r) ctx.rotate(tr.r);
    if (tr.s != null && tr.s !== 1) ctx.scale(tr.s, tr.s);
    ctx.translate(-tr.o[0], -tr.o[1]);
    draw(ctx);
    ctx.restore();
  }

  // the letters of a part in one flat colour (for shadows and emboss edges): one canvas stroke per path
  function solid(ctx, names, k, colour, grow) {
    ctx.save();
    ctx.strokeStyle = colour; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const name of names) {
      const pts = PTS[name];
      ctx.lineWidth = Math.max(0.5, W[name] * k + 2 * (grow || 0));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  // squeezed ink: dabs along the stroke whose radii pass the crisp edge by `grow` (wobbling with the smooth noise)
  // and `rough` (the fine grain); coloured along the stroke in a few runs, so it keeps the gradient
  function inkRim(ctx, name, width, colours, grow, rough, nz) {
    const pts = PTS[name], fr = FRAC[name], r0 = width / 2;
    const runs = Array.isArray(colours) && colours.length > 1 ? 18 : 1;
    let run = -1, open = false;
    const flush = () => { if (open) { ctx.fill(); open = false; } };
    for (let i = 0; i < pts.length; i++) {
      const r = r0 + grow * (0.62 + 0.38 * nz.smooth[i]) + rough * nz.fine[i];
      const b = Math.min(runs - 1, Math.floor(fr[i] * runs));
      if (b !== run) {
        flush();
        run = b;
        ctx.fillStyle = M.colourAt(colours, (b + 0.5) / runs);
        ctx.beginPath();
      }
      if (r > r0 + 0.25) { ctx.moveTo(pts[i][0] + r, pts[i][1]); ctx.arc(pts[i][0], pts[i][1], r, 0, TAU); open = true; }
    }
    flush();
  }

  // droplets of ink flung from the edge at the hit (teardrops in flight, round once landed); they soak away as the
  // print dries
  function droplets(ctx, names, pal, k, w, ch, look, n) {
    const D = look.fling, fly = w.fly, keep = w.squeeze;
    if (D <= 0 || keep <= 0.002 || n <= 0) return;
    for (let d = 0; d < n && d < ch.drops.length; d++) {
      const dr = ch.drops[d];
      if (!names.includes(dr.name)) continue;
      const pts = PTS[dr.name], i = Math.round(dr.at * (pts.length - 1));
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / len) * dr.side, ny = ((b[0] - a[0]) / len) * dr.side;
      const r0 = (W[dr.name] * k) / 2;
      const m = M.ease.outCubic(M.clamp(fly * (1.15 - 0.3 * dr.lag), 0, 1));
      const dist = r0 + D * dr.far * m;
      const rad = look.drop * dr.size * (0.75 + 0.25 * Math.min(1, keep * 1.4)) * (0.6 + 0.4 * m);
      const fade = Math.min(1, keep * 1.6);   // dried into the paper: it fades rather than shrinking to a crumb
      if (rad < 0.4 || fade < 0.01) continue;
      const x = pts[i][0] + nx * dist, y = pts[i][1] + ny * dist;
      ctx.fillStyle = M.colourAt(tint(pal[dr.name], look.deep, look.rimDeep * 0.5 * w.wet), dr.at);
      // in flight it is a teardrop stretched along its path (the faster, the longer), round once it lands
      const stretch = 1 + 2.6 * (1 - m) * Math.min(1, fly * 8);
      ctx.save();
      ctx.globalAlpha *= fade;
      ctx.beginPath();
      ctx.ellipse(x - nx * rad * (stretch - 1), y - ny * rad * (stretch - 1), rad * stretch, rad / Math.sqrt(stretch), Math.atan2(ny, nx), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // the stamp's grain: specks knocked out of the fresh print (inside an isolated layer, so only the print is cut);
  // they close up as the print dries
  function grain(ctx, names, k, w, ch, look) {
    // the specks fill in as the print dries: they fade (and narrow a little) rather than shrink to crumbs
    if (w.grain < 0.01 || look.grain <= 0) return;
    const g = look.grain * (0.6 + 0.4 * w.grain);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha *= Math.min(1, w.grain * 1.15);
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    for (let q = 0; q < look.specks && q < ch.specks.length; q++) {
      const sp = ch.specks[q];
      if (!names.includes(sp.name)) continue;
      const pts = PTS[sp.name], f = sp.at * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const off = sp.across * W[sp.name] * k;
      const x = a[0] + (b[0] - a[0]) * u - ((b[1] - a[1]) / len) * off, y = a[1] + (b[1] - a[1]) * u + ((b[0] - a[0]) / len) * off;
      const r = g * (0.2 + 1.3 * sp.size), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.moveTo(x + Math.cos(ang) * r * sp.long, y + Math.sin(ang) * r * sp.long);
      ctx.ellipse(x, y, r * sp.long, r, ang, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }

  // a part ('five' or 's') as a print: crisp strokes, over a rough rim of squeezed ink while it is wet
  function print(ctx, part, pal, k, w, ch, look) {
    // w: {squeeze, swell, wet, fly, grain, lit}; look: {grow, rough, swellBy, deep, rimDeep, wetDeep, fling, drop, drops}
    const names = PART[part];
    const width = (name) => W[name] * k * (1 + look.swellBy * w.swell);
    const grow = look.grow * w.squeeze, rough = look.rough * w.squeeze;
    if (grow > 0.3 || rough > 0.3) {
      droplets(ctx, names, pal, k, w, ch, look, look.drops);
      for (const name of names) inkRim(ctx, name, width(name), tint(pal[name], look.deep, look.rimDeep * w.wet), grow, rough, ch.noise[name]);
    }
    // lifted toward the light it is a touch brighter (most in the dark, where its shadow cannot show the height)
    const lit = w.lit || 0;
    const colours = (name) => {
      let cs = pal[name];
      if (w.wet > 0.001) cs = tint(cs, look.deep, look.wetDeep * w.wet);
      if (lit > 0.001) cs = tint(cs, '#FFFFFF', lit);
      return cs;
    };
    for (const name of names) M.stroke(ctx, PTS[name], { width: width(name), colours: colours(name) });
  }

  // the soft shadow of a lifted part on the paper: below and to the right, the higher the further and softer
  function shadow(ctx, env, names, k, h, look) {
    // look: {colour, alpha, dx, dy, blur (mark units), tr}
    if (look.alpha <= 0.003) return;
    // The blur is the canvas's own shadowBlur (device pixels, deterministic): the letters are drawn far off the
    // canvas and only their shadow lands, offset back into place. It sits in a full-resolution layer (alpha only,
    // no layer blur), so overlapping strokes do not darken twice and no reduced-resolution scratch is resampled.
    M.layer(ctx, { alpha: look.alpha, composite: 'source-over' }, (c) => {
      const m = c.getTransform(), FAR = 4 * Math.max(c.canvas.width, c.canvas.height) + 2000;
      c.save();
      c.setTransform(m.a, m.b, m.c, m.d, m.e + FAR, m.f);
      c.shadowColor = look.colour;
      c.shadowBlur = Math.max(0, 2 * look.blur * env.scale * env.dpr);
      c.shadowOffsetX = -FAR;
      c.shadowOffsetY = 0;
      place(c, look.tr, (cc) => { cc.translate(look.dx, look.dy); solid(cc, names, k, look.colour, 0); });
      c.restore();
    });
  }

  // how far a stamp rises (scale excess): a soft cap keeps the lifted letters inside the view (1.29 at most)
  const liftOf = (p) => 0.02 + 0.27 * (1 - Math.exp(-1.6 * p.intensity * p.lift)) / (1 - Math.exp(-1.6));

  function common(p, env) {
    const pal = env.palette;
    const dark = isDark(pal.bg);
    return {
      pal, dark, k: p.weight, I: p.intensity, ease: M.easing(p.easing), ch: chance(env.rng),
      // slam: a few real frames whatever the duration (about 50 ms), as a share of t
      slam: M.clamp(50 / p.duration, 0.025, 0.07),
      shadowCol: dark ? '#000000' : M.mix(pal.ink, '#0B0820', 0.4),
      shadowK: dark ? 2.2 : 1,
      lit: flat(pal) ? 0 : dark ? 0.5 : 0.25,                    // brightening per unit of lift (scale excess)
      look: {
        grow: (3 + 16 * p.ink) * (0.6 + 0.7 * p.intensity),    // how far ink passes the edge, mark units
        rough: (2 + 9 * p.ink) * (0.6 + 0.6 * p.intensity),     // the ragged grain of the wet edge
        grain: 3 + 9 * p.ink,                                    // the speck size of the fresh print
        specks: Math.round(242 * Math.min(1, 0.15 + 1.4 * p.ink)),
        swellBy: 0.14 * p.ink,                                   // up to 14% wider at the hit
        fling: (24 + 90 * p.ink) * (0.5 + 0.8 * p.intensity),    // how far droplets fly past the edge
        drop: 5 + 12 * p.ink,                                    // droplet radius
        drops: Math.round(14 * Math.min(1, p.ink * 1.4) * (0.35 + 0.65 * p.intensity)),
        deep: flat(pal) ? pal.five[0] : (dark ? '#2A0A12' : '#5A1020'),
        rimDeep: flat(pal) ? 0 : 0.3,                            // the rim of squeezed ink is deeper, as wet ink is
        wetDeep: flat(pal) ? 0 : 0.07
      }
    };
  }

  // a shadow look for a lift of height h (0..1+) and lift scale excess s; after the hit the shadow snaps under
  // the print and then spreads and fades, as the stamp leaves it
  function shadowLook(c, h, sx, t, H, tr) {
    const base = 0.2 + 0.1 * Math.min(1, h);
    if (t < H) {
      return { colour: c.shadowCol, alpha: c.shadowK * base * M.clamp(h * 6, 0, 1), dx: sx * 300, dy: sx * 420, blur: 6 + sx * 260, tr };
    }
    const x = span(t, H, H + 0.16);
    return { colour: c.shadowCol, alpha: c.shadowK * 0.3 * (1 - M.ease.inQuad(x)), dx: 34 * M.ease.outCubic(x), dy: 48 * M.ease.outCubic(x), blur: 5 + 70 * M.ease.outCubic(x), tr };
  }

  /* ---------------------------------------------------------------------------------------------------------
   * press: one hard hit; the ribbon prints a beat later
   * ------------------------------------------------------------------------------------------------------- */
  function press(ctx, t, p, env) {
    const c = common(p, env), { pal, k, I } = c;
    const lift = liftOf(p);
    const squash = 0.012 + 0.045 * I;
    const o = { t0: 0, top: 0.4, hang: 0.45, slam: c.slam, lift, squash, settle: 0.3, ease: c.ease };
    const L = blow(t, o), H = L.H;
    const beat = 0.08;                                        // the ribbon follows a beat later, lighter
    const R = blow(t, Object.assign({}, o, { t0: beat, top: 0.4 + beat, hang: 0.45 + beat, lift: lift * 0.75, squash: squash * 0.5 }));
    const j1 = p.jolt ? shake(t, H, p.duration, 3 + 11 * I, c.ch.joltAngle) : [0, 0];
    const j2 = p.jolt ? shake(t, R.H, p.duration, (3 + 11 * I) * 0.35, c.ch.joltAngle2) : [0, 0];
    const tr = { o: A.letters, s: 1 + L.s };
    const w = Object.assign(wetness(t, H), { lit: c.lit * Math.max(0, L.s) });

    ctx.save();
    ctx.translate(j1[0] + j2[0], j1[1] + j2[1]);
    shadow(ctx, env, PART.five.concat(PART.s), k, L.h, shadowLook(c, L.h, Math.max(0, L.s), t, H, { o: A.letters, s: 1 + 0.25 * Math.max(0, L.s) }));
    if (p.ribbon) {
      // lifted, it is fainter (it has left the paper); it prints a beat after the letters, a second, lighter stamp
      place(ctx, { o: A.letters, s: 1 + R.s }, (cr) => M.ribbon(cr, 0, { colours: pal.ribbon, alpha: 1 - 0.3 * Math.min(1, R.h) }));
    }
    const letters = (cx) => place(cx, tr, (cl) => {
      print(cl, 'five', pal, k, w, c.ch, c.look); print(cl, 's', pal, k, w, c.ch, c.look);
      grain(cl, NAMES, k, w, c.ch, c.look);
    });
    if (w.grain >= 0.01 && c.look.grain > 0) M.layer(ctx, { composite: 'source-over' }, letters); else letters(ctx);
    ctx.restore();
  }

  /* ---------------------------------------------------------------------------------------------------------
   * double: the 5, then the s (lighter, off-register, nudged home)
   * ------------------------------------------------------------------------------------------------------- */
  function double(ctx, t, p, env) {
    const c = common(p, env), { pal, k, I, ch } = c;
    const lift = liftOf(p);
    const squash = 0.012 + 0.045 * I;
    const o5 = { t0: 0, top: 0.17, hang: 0.2, slam: c.slam, lift: lift * 1.1, squash, settle: 0.22, ease: c.ease };
    const F = blow(t, o5);
    const t0 = F.H + 0.07;
    const oS = { t0, top: t0 + 0.15, hang: t0 + 0.18, slam: c.slam, lift: lift * 1.3, squash: squash * 0.6, settle: 0.22, ease: c.ease };   // the s is small: it rises further to read
    const S = blow(t, oS);
    // off-register: the s comes down turned 3-6 degrees and 10-20 units off, holds, then is nudged home
    const deg = (3 + 3 * I) * ch.offSign, dist = 10 + 10 * (0.4 * I + 0.6 * ch.offAmt);
    const slip = M.ease.inOutSine(span(t, t0, S.H)) * (1 - M.ease.outBack(2.2)(span(t, S.H + 0.1, S.H + 0.24)));
    const trS = { o: A.s, s: 1 + S.s, r: (deg * Math.PI / 180) * slip, dx: Math.cos(ch.offAngle) * dist * slip, dy: Math.sin(ch.offAngle) * dist * slip };
    const tr5 = { o: A.five, s: 1 + F.s };
    const j1 = p.jolt ? shake(t, F.H, p.duration, 3 + 11 * I, ch.joltAngle) : [0, 0];
    const j2 = p.jolt ? shake(t, S.H, p.duration, (3 + 11 * I) * 0.55, ch.joltAngle2) : [0, 0];
    // the 5's print dries before the s comes down, so the second hit lands as fresh ink beside a dry print
    const w5 = Object.assign(wetness(t, F.H, Math.min(0.9, F.H + 0.36)), { lit: c.lit * Math.max(0, F.s) }), wS = Object.assign(wetness(t, S.H), { lit: c.lit * Math.max(0, S.s) });
    const lookS = Object.assign({}, c.look, { grow: c.look.grow * 0.7, rough: c.look.rough * 0.8 });

    ctx.save();
    ctx.translate(j1[0] + j2[0], j1[1] + j2[1]);
    shadow(ctx, env, PART.five, k, F.h, shadowLook(c, F.h, Math.max(0, F.s), t, F.H, { o: A.five, s: 1 + 0.25 * Math.max(0, F.s) }));
    shadow(ctx, env, PART.s, k, S.h, shadowLook(c, S.h, Math.max(0, S.s), t, S.H, { o: A.s, s: 1 + 0.25 * Math.max(0, S.s), r: trS.r, dx: trS.dx, dy: trS.dy }));
    if (p.ribbon) place(ctx, { o: A.letters, s: 1 + 0.6 * S.s }, (cr) => M.ribbon(cr, 0, { colours: pal.ribbon, alpha: 1 - 0.25 * Math.min(1, S.h) }));
    const letters = (cx) => {
      place(cx, tr5, (cl) => { print(cl, 'five', pal, k, w5, ch, c.look); grain(cl, PART.five, k, w5, ch, c.look); });
      place(cx, trS, (cl) => { print(cl, 's', pal, k, wS, ch, lookS); grain(cl, PART.s, k, wS, ch, lookS); });
    };
    if (Math.max(w5.grain, wS.grain) >= 0.01 && c.look.grain > 0) M.layer(ctx, { composite: 'source-over' }, letters); else letters(ctx);
    ctx.restore();
  }

  /* ---------------------------------------------------------------------------------------------------------
   * seal: the ribbon melts into wax, the mark presses in and stands embossed, the wax draws back into the ribbon
   * ------------------------------------------------------------------------------------------------------- */
  const SEAL_C = [505, 528];     // the seal's centre: the letters' middle, a little low (the bowl is heavy)
  const SEAL_R = 405;
  const LOOP_C = [398, 597];     // the ribbon wraps the bowl in about this circle (under, up past the s, over)
  const LOOP_R = 282;

  function waxColour(pal) {
    if (pal.name === 'ink' || pal.name === 'paper') return pal.five[0];
    if (pal.name === 'turn') return pal.cobalt;
    return pal.iris;
  }

  // the wax's outline: a circle with a few slow harmonics (a liquid, lumpy rim), turning with t
  function waxPath(ctx, cx, cy, R, wob, ch, t, hole) {
    ctx.beginPath();
    const n = 128;
    for (let i = 0; i <= n; i++) {
      const th = (TAU * i) / n;
      let d = 0;
      for (const h of ch.rim) d += h.a * Math.sin(h.k * th + h.ph + (h.k % 2 ? 1.3 : -1.1) * t);
      const r = Math.max(0, R * (1 + wob * d));
      const x = cx + r * Math.cos(th), y = cy + r * Math.sin(th);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (hole > 0.5) { ctx.moveTo(cx + hole, cy); ctx.arc(cx, cy, hole, 0, TAU, true); }
  }

  function seal(ctx, t, p, env) {
    const c = common(p, env), { pal, k, I, ch, dark } = c;
    const lift = liftOf(p) + 0.01;
    const squash = 0.015 + 0.04 * I;
    const o = { t0: 0.08, top: 0.36, hang: 0.4, slam: c.slam, lift, squash, settle: 0.28, ease: c.ease };
    const L = blow(t, o), H = L.H;
    const j = p.jolt ? shake(t, H, p.duration, 2 + 9 * I, ch.joltAngle) : [0, 0];
    const rib = p.ribbon;

    // the wax's life: the ribbon's loop thickens into a ring and fills into a disc (melt); the disc swells toward
    // the seal as the mark rises (grow); the hit squeezes it out past the die (bulge, a lumpy rim); it holds, then
    // draws back to the loop (back) and hollows out into the ribbon again (hollow). Without the ribbon it pools
    // from the bowl and drains back into it.
    const melt = M.ease.inOutSine(span(t, 0, 0.16));
    const grow = M.ease.outCubic(span(t, 0.1, H));
    const back = M.ease.inOutCubic(span(t, 0.62, 0.8));
    const hollow = M.ease.inOutSine(span(t, 0.78, 0.96));
    const after = t >= H;
    const x = span(t, H, 1);
    const ring = after ? Math.exp(-x * 10) * Math.cos(TAU * 2.2 * x) : 0;     // the rim's ring-down after the hit
    const squeeze = after ? M.ease.outCubic(span(t, H, H + 0.04)) : 0;
    const C0 = rib ? LOOP_C : A.bowl, R0 = rib ? LOOP_R : 0;
    const Rpre = M.lerp(rib ? LOOP_R : 0, SEAL_R * 0.9, grow) * (rib ? 1 : M.ease.outCubic(span(t, 0, 0.25)));
    const Rhit = SEAL_R * (1 + (0.04 + 0.07 * I) * squeeze + (0.05 + 0.06 * I) * ring);
    const R = M.lerp(after ? Rhit : Rpre, R0, back);
    const cg = after ? 1 : grow;
    const cx = M.lerp(M.lerp(C0[0], SEAL_C[0], cg), C0[0], back), cy = M.lerp(M.lerp(C0[1], SEAL_C[1], cg), C0[1], back);
    const wob = M.lerp(0.035 + 0.03 * (1 - grow) + (0.07 + 0.08 * I) * squeeze + (0.04 + 0.05 * I) * Math.abs(ring), 0.012, back);
    // with the ribbon the wax is a ring on the loop (its band) whose inside fills in, and at the end empties out
    // again: ring and inside fade separately, so no hole ever opens from a point
    const band = rib ? Math.max(0, R - 46) : 0;
    const ringA = rib ? Math.min(1, 2.2 * melt) * (1 - span(hollow, 0.35, 1)) : 1;
    const innerA = rib ? span(melt, 0.25, 1) * (1 - span(hollow, 0, 0.65)) : 1;
    const wax = waxColour(pal);
    const waxDeep = M.mix(wax, '#000000', dark ? 0.38 : 0.28), waxLight = M.mix(wax, '#FFFFFF', dark ? 0.35 : 0.42);
    const emb = after ? 1 - back : 0;                              // the relief holds while the seal does

    ctx.save();
    ctx.translate(j[0], j[1]);
    // the ribbon: melts into the wax at the start (its tail drawing into the loop), comes back out at the end
    if (rib) {
      const rIn = 1 - melt, rOut = hollow;
      if (rIn > 0.002) M.ribbon(ctx, 0.08 * melt, { colours: pal.ribbon, alpha: rIn, along: [0.25 * melt, 1] });
      if (rOut > 0.002) M.ribbon(ctx, 0.08 * (1 - rOut), { colours: pal.ribbon, alpha: rOut, along: [0.25 * (1 - rOut), 1] });
    }
    if (R > 1 && Math.max(ringA, innerA) > 0.002) {
      const body = (cw, hole) => {
        // a flat drop shadow, the wax's bead (a darker rim), its face, a highlight on the bead upper left
        cw.save();
        cw.globalAlpha *= dark ? 0.55 : 0.16;
        cw.fillStyle = c.shadowCol;
        waxPath(cw, cx + 10, cy + 16, R, wob, ch, t, hole); cw.fill('evenodd');
        cw.restore();
        cw.fillStyle = waxDeep; waxPath(cw, cx, cy, R, wob, ch, t, hole); cw.fill('evenodd');
        const fr = R * 0.93, fh = Math.max(0, hole - R * 0.05);
        cw.fillStyle = wax; waxPath(cw, cx - 0.012 * R, cy - 0.02 * R, fr, wob * 0.85, ch, t, fh); cw.fill('evenodd');
        cw.save();
        cw.globalAlpha *= 0.6;
        cw.strokeStyle = waxLight; cw.lineWidth = Math.max(4, 0.022 * R); cw.lineCap = 'round';
        cw.beginPath(); cw.arc(cx - 0.012 * R, cy - 0.02 * R, fr * 0.95, Math.PI * 1.02, Math.PI * 1.42); cw.stroke();
        cw.restore();
        // the die's impression: a pressed-in circle round the letters (dark edge upper left, light lower right)
        if (emb > 0.003) {
          const rd = SEAL_R * 0.86 * (R / Math.max(1, Rhit)), gw = Math.max(1.6 / env.scale, 0.022 * SEAL_R);
          cw.save();
          cw.lineWidth = gw;
          cw.globalAlpha *= emb * M.ease.outCubic(span(t, H, H + 0.03));
          cw.strokeStyle = waxDeep; cw.beginPath(); cw.arc(cx - gw * 0.5, cy - gw * 0.5, rd, 0, TAU); cw.stroke();
          cw.strokeStyle = waxLight; cw.beginPath(); cw.arc(cx + gw * 0.5, cy + gw * 0.5, rd, 0, TAU); cw.stroke();
          cw.restore();
        }
      };
      if (!rib) body(ctx, 0);
      else {
        if (ringA > 0.002) M.layer(ctx, { alpha: ringA, composite: 'source-over' }, (cw) => body(cw, band));
        if (innerA > 0.002 && band > 0.5) {
          M.layer(ctx, { alpha: innerA, composite: 'source-over' }, (cw) => {
            cw.beginPath(); cw.arc(cx, cy, band + 0.6, 0, TAU); cw.clip();
            body(cw, 0);
          });
        }
      }
    }
    const tr = { o: A.letters, s: 1 + L.s };
    shadow(ctx, env, NAMES, k, L.h, shadowLook(c, L.h, Math.max(0, L.s), t, H, { o: A.letters, s: 1 + 0.25 * Math.max(0, L.s) }));
    place(ctx, tr, (cl) => {
      // in one flat colour the lifted letters are the wax's colour too: a die-cut rim of background keeps them apart
      const cut = flat(pal) ? M.clamp(Math.min(innerA, R / SEAL_R) * 1.4, 0, 1) * (1 - span(t, H - 0.035, H)) * (1 - back) : 0;
      if (cut > 0.003) M.layer(cl, { alpha: cut }, (cc) => solid(cc, NAMES, k, pal.bg, Math.max(10, 1.5 / env.scale)));
      if (emb > 0.003) {
        // embossed: a dark edge lower right, a light edge upper left (at least 2 px), then the face
        const off = Math.max(9, 2 / env.scale) * (flat(pal) ? 1.6 : 1) * emb;   // in one colour the relief is all there is
        cl.save(); cl.translate(off, off);
        for (const name of NAMES) M.stroke(cl, PTS[name], { width: W[name] * k, colours: tint(pal[name], dark ? '#000000' : '#12051E', 0.55), alpha: emb });
        cl.restore();
        cl.save(); cl.translate(-off, -off);
        for (const name of NAMES) M.stroke(cl, PTS[name], { width: W[name] * k, colours: tint(pal[name], '#FFFFFF', 0.72), alpha: emb });
        cl.restore();
      }
      const w = { squeeze: 0, swell: after ? 1 - M.ease.outCubic(span(t, H, H + 0.2)) : 0, wet: 0, fly: 0, grain: 0, lit: c.lit * Math.max(0, L.s) };
      print(cl, 'five', pal, k, w, ch, c.look);
      print(cl, 's', pal, k, w, ch, c.look);
    });
    ctx.restore();
  }

  Motion.register({
    id: 'stamp',
    name: 'Stamp',
    idea: 'The mark is a rubber stamp: it lifts toward you, slams down onto the screen as if it were paper, ink squeezes out round its edges and the frame jolts; then it lifts away and leaves the print, which dries crisp.',
    why: 'A stamp is a verdict, and 5s is a judgment app: keep, pass, approved, done. Where the other families build up through time, Stamp decides in one blow.',
    moments: ['keep', 'five-done', 'set-pin', 'streak'],
    styles: ['press', 'double', 'seal'],
    params: {
      duration: { default: 600, min: 250, max: 2000, step: 50 },
      style: { default: 'press', options: ['press', 'double', 'seal'] },
      lift: { default: 0.6, min: 0, max: 1, step: 0.05 },     // how far it rises before the hit (times intensity)
      ink: { default: 0.5, min: 0, max: 1, step: 0.05 },      // how far the ink squeezes past the edge, how rough it is
      jolt: { default: true }                                 // the frame shakes on impact
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      if (p.style === 'double') double(ctx, t, p, env);
      else if (p.style === 'seal') seal(ctx, t, p, env);
      else press(ctx, t, p, env);
    }
  });
})();

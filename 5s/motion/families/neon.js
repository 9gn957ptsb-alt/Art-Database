/* 5s Motion Lab: Neon (Time & structure; added 22 Oct 2026).
 *
 * The mark is a neon sign. The tubes buzz, stutter and catch; light blooms out of them and spills across
 * the field in their colours; then the sign holds, humming.
 *
 * Nothing else in the library gives off light. Every other family moves the letters or draws on them. Here
 * the letters never move: they switch on. The glow, the halo and the colour on the field all come from the
 * mark itself, and the rhythm is an irregular electric stutter, not an eased glide. A sign coming on is the
 * oldest way a place says "open", and the stutter makes you wait for it to catch. At 64 px, on and off is
 * the most legible change there is; at full screen in the dark, the spill warms the whole screen.
 *
 * The sign has five tubes: the bar, the stem, the bowl, the s and the ribbon. A lit tube is three layers:
 *  - the stroke in its own colours;
 *  - a thin bright core, the stroke's colours mixed 60% toward white, stopping short of the electrodes;
 *  - a halo: the same stroke about 2.2 times as wide, in one blurred Marks.layer.
 * An unlit tube is cold glass: an outline of the stroke 6-10 units wide (never under about 1.3 px), in a
 * grey mixed from ink and background, with a faint glass fill and dark electrode caps at the free ends.
 * Halos and spill composite by the field they fall on:
 *  - 'lighter' on a dark field (dark theme, or the Paper palette's violet field);
 *  - 'multiply' where the tubes are darker than the field (the light theme), so there they are soft tints.
 *
 * Styles
 *   ignite  from cold glass to lit, in five catches. The bar sparks first: it stutters on and off on a seeded,
 *           irregular rhythm, then catches. The stem follows, then the bowl, then the s, and the ribbon glows
 *           last. Each catch blooms its halo (p.easing shapes the bloom; outBack makes it pop) and warms the
 *           field in its own colour. Ends on the still mark: the glow crossfades out over the last 10%.
 *   surge   there and back, a blink of power. From the still mark the glow rises and the sign takes a surge:
 *           the cores go white-hot and the halo swells for a couple of frames. Then it cuts out for a beat:
 *           the tubes go to cold glass, and a faint afterimage of the halo hangs in the complementary tint.
 *           It relights in one clean go, with a small flicker, and settles on the still mark.
 *   buzz    an idle loop, seamless at t = 0 and 1, which are the still mark. The halo breathes slowly in and
 *           out. Near the top of the breath one tube (seeded: the bar, the s or the bowl) stutters twice and
 *           recovers.
 *
 * Params
 *   flicker  0-1: how many stutters (blinks before a catch in ignite, dips after the relight in surge, blinks
 *            per cycle in buzz). Flicker is held to WCAG 2.3.1 (three flashes) at every duration, see below.
 *   glow     0-1: the halo's width and strength, and how far the spill reaches.
 *   spill    the light tints the field.
 *   Shared options: palette, ribbon, weight (the tube width), intensity (how big the bloom, the surge and the
 *   spill are), easing (the bloom after each catch and the warm-up of surge), duration (250-4000 ms).
 *
 * Flash safety (WCAG 2.3.1: nothing flashes more than three times in any one second)
 *   A flash is a pair of opposing changes in brightness. The sign is counted as one region, whatever tube
 *   blinks. Everything is timed in real milliseconds from p.duration.
 *   - ignite: at most two full blinks in any 1000 ms. Catches only ever add light, and the end fade takes it
 *     away once, so the sign changes direction at most six times in any second: three flashes.
 *   - surge: the surge, the cut, the relight and the fade make four changes. One dip is allowed below 2.4 s
 *     and two above it (they are then far enough apart): never more than six changes in a second.
 *   - buzz: the stutter gets two blinks a cycle only from 1200 ms, one from 1000 ms, none below that. The
 *     breath's depth shrinks below 700 ms, so a short loop cannot pulse the glow.
 *   - The spill never follows a blink. It rises and falls smoothly, and its strongest tint adds less than
 *     0.1 relative luminance to the field, so it can never become a full-frame flash.
 *
 * Every frame is a pure function of (t, p, env). The stutter's rhythm, the tube that buzzes and the dips come
 * from env.rng, drawn in the same order and the same number of times on every frame, so a seed always gives
 * the same sign.
 *
 * The halo's blur goes through Marks.layer at full resolution (resolution: 1), and the layer wipes its whole
 * scratch canvas first. At reduced resolution the scaled-up copy can sample stale pixels left by an earlier
 * layer just past the edge of the region it used, so the same t could give different frames.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;

  // the still mark's own resolution (Marks.mark draws 160 points), so a fully lit, glow-free frame is it exactly
  const N = 160;
  const PTS = { bar: M.points('bar', N), body: M.points('body', N), s: M.points('s', N) };
  const RIB = M.points('ribbon', 200);
  const WID = { bar: M.widths.bar, body: M.widths.body, s: M.widths.s };
  const LEN = { bar: M.length('bar'), body: M.length('body'), s: M.length('s') };

  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const span = (t, a, b) => (b > a ? c01((t - a) / (b - a)) : t >= b ? 1 : 0);
  const lerp = (a, b, t) => a + (b - a) * t;

  // the stem ends and the bowl begins at the 5's foot (the turn at 160, 491)
  const FOOT = (() => {
    let best = 0, d = Infinity;
    PTS.body.forEach((q, i) => { const e = Math.hypot(q[0] - 160, q[1] - 491); if (e < d) { d = e; best = i; } });
    return best / (N - 1);
  })();

  // the four letter tubes: which stroke, which stretch of it, which ends are free (electrodes), where it shines
  const TUBES = [
    { id: 'bar', path: 'bar', from: 0, to: 1, free: [1], at: [470, 232] },
    { id: 'stem', path: 'body', from: 0, to: FOOT, free: [], at: [236, 362] },
    { id: 'bowl', path: 'body', from: FOOT, to: 1, free: [1], at: [392, 612] },
    { id: 's', path: 's', from: 0, to: 1, free: [0, 1], at: [790, 668] }
  ];
  const RIB_AT = [520, 790];
  const ORDER = ['bar', 'stem', 'bowl', 's', 'rib'];   // ignite's five catches, in order

  /* ---------------------------------------------------------------------------------------------------------
   * colour
   * ------------------------------------------------------------------------------------------------------- */
  const rgb = (hex) => { const h = M.mix(hex, hex, 0); return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; };
  const lum = (hex) => {
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const [r, g, b] = rgb(hex);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  // the complementary hue at the same lightness and saturation (HSL): each channel reflected through max + min
  const complement = (hex) => {
    const c = rgb(hex), hi = Math.max(c[0], c[1], c[2]), lo = Math.min(c[0], c[1], c[2]);
    const h2 = (v) => { const s = Math.round(Math.max(0, Math.min(255, v))).toString(16); return s.length < 2 ? '0' + s : s; };
    return '#' + h2(hi + lo - c[0]) + h2(hi + lo - c[1]) + h2(hi + lo - c[2]);
  };
  // colour stops ('#a' | ['#a', ...] | [[u, '#a'], ...]) mixed toward one colour
  const toward = (cols, c, k) => {
    if (!(k > 0.001)) return cols;
    if (!Array.isArray(cols)) return M.mix(cols, c, k);
    return cols.map((s) => (Array.isArray(s) ? [s[0], M.mix(s[1], c, k)] : M.mix(s, c, k)));
  };

  // how this palette and field take light: cached per palette object (palettes are frozen and cached)
  const looks = new Map();
  function lookOf(pal) {
    let L = looks.get(pal);
    if (L) return L;
    const fieldLum = lum(pal.bg), dark = fieldLum < 0.25;
    // white or black tubes (the Ink and Paper palettes) glow in the turn's iris, as a white neon glows cool,
    // so the glow never matches the tube and the letters keep their edges
    const c = rgb(M.colourAt(pal.body, 0.45));
    const neutral = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 24;
    const light = (cols) => (neutral ? toward(cols, pal.iris, 0.5) : cols);
    const tube = light(M.colourAt(pal.body, 0.45));
    const emit = lum(tube) > fieldLum;
    // a near-black field takes the light additively; a lighter field is lifted (screen) where the tubes are
    // lighter than it and tinted (multiply) where they are darker
    const mode = fieldLum < 0.05 ? 'lighter' : emit ? 'screen' : 'multiply';
    L = {
      dark, mode, light,
      glass: M.mix(pal.bg, pal.ink, dark ? 0.36 : 0.24),
      glassHi: M.mix(pal.bg, pal.ink, dark ? 0.2 : 0.12),
      fill: M.mix(pal.bg, pal.ink, dark ? 0.08 : 0.035),
      electrode: M.mix(pal.bg, pal.ink, dark ? 0.24 : 0.34),
      // the halo may lift (or tint) the field at most 40% of the way to the tube's own brightness, so the
      // letters keep their edges inside their glow, even white tubes on the violet field
      haloA: Math.min(dark ? 1 : 0.8, haloCap(tube, pal.bg, mode)),
      afterA: dark ? 0.55 : 0.4
    };
    looks.set(pal, L);
    return L;
  }

  /* ---------------------------------------------------------------------------------------------------------
   * the sign's state at t: {tube: {lit, halo, core, hot}, rib: {lit, halo, hot}, spill: {tube: level}, after,
   * spark}. lit 0 is cold glass, 1 the tube in its colours; halo and core scale the glow; hot (0-1) whitens.
   * ------------------------------------------------------------------------------------------------------- */
  const dark0 = () => ({ lit: 0, halo: 0, core: 0, hot: 0 });

  // ignite: where each of the five tubes catches, and its blinks before that ([start, end, brightness] in t)
  function igniteLayout(n, D, R, ribbon) {
    const A = 0.05, B = 0.74;
    const w = { bar: 1.3 + n.bar, stem: 0.85 + n.stem, bowl: 0.75 + n.bowl, s: 0.9 + n.s, rib: ribbon ? 0.85 : 0 };
    const total = ORDER.reduce((x, id) => x + w[id], 0);
    const plan = {};
    let t = A;
    ORDER.forEach((id, ui) => {
      const a = t, b = t + ((B - A) * w[id]) / total;
      const blinks = [];
      const slot = (b - a) / (n[id] + 0.7);
      for (let i = 0; i < n[id]; i++) {
        const r = (c) => R[(ui * 6 + i) * 3 + c];
        const on = Math.min(slot * 0.42, (34 + 46 * r(0)) / D);        // 34-80 ms on, never most of its slot
        const s0 = a + slot * (i + 0.2 + 0.45 * r(1));                  // irregular: each blink jitters in its slot
        blinks.push([s0, s0 + on, 0.5 + 0.5 * r(2)]);
      }
      plan[id] = { a, catch: b, blinks };
      t = b;
    });
    return plan;
  }

  function ignitePlan(p, D, R) {
    const f = p.flicker;
    const n = {
      bar: Math.round(4 * f), stem: Math.round(1.6 * f), bowl: Math.round(Math.max(0, f - 0.4) * 2.5),
      s: Math.round(Math.max(0, f - 0.25) * 2.4), rib: 0
    };
    let plan = igniteLayout(n, D, R, p.ribbon);
    for (let iter = 0; iter < 16; iter++) {
      // a blink must be seen (at least 28 ms on), and the sign gets at most two blinks in any 1000 ms
      let drop = null;
      const all = [];
      for (const id of ORDER) for (const b of plan[id].blinks) {
        if ((b[1] - b[0]) * D < 28) { drop = drop || id; }
        all.push([b[0] * D, id]);
      }
      if (!drop) {
        all.sort((x, y) => x[0] - y[0]);
        const kept = [];
        for (const [ms, id] of all) {
          if (kept.filter((x) => ms - x < 1000).length >= 2) { drop = id; break; }
          kept.push(ms);
        }
      }
      if (!drop) break;
      n[drop] -= 1;
      plan = igniteLayout(n, D, R, p.ribbon);
    }
    return plan;
  }

  function ignite(t, p, D, R) {
    const plan = ignitePlan(p, D, R);
    const ease = M.easing(p.easing);
    const I = p.intensity;
    const bloomT = Math.max(0.06, Math.min(0.2, 160 / D));
    const neon = 1 - M.ease.inOutSine(span(t, 0.9, 1));        // the glow crossfades out over the last 10%
    const spillOut = 1 - M.ease.inOutSine(span(t, 0.8, 1));
    const S = { tubes: {}, rib: dark0(), spill: {}, after: 0, spark: null };
    for (const id of ORDER) {
      const pl = plan[id];
      const st = dark0();
      if (t >= pl.catch) {
        const bl = ease(span(t, pl.catch, pl.catch + bloomT));
        st.lit = id === 'rib' ? M.ease.outCubic(span(t, pl.catch, pl.catch + Math.min(0.05, 60 / D))) : 1;
        st.halo = lerp(0.35, 1 + 0.25 * I, bl) * neon;
        st.core = neon;
        // the moment of catching runs hot for a frame or two, more with intensity (a brightening, not a flash)
        st.hot = 0.35 * I * (1 - span(t, pl.catch, pl.catch + Math.min(0.06, 70 / D)));
        S.spill[id] = M.ease.outCubic(span(t, pl.catch, pl.catch + 0.2)) * spillOut;
      } else {
        for (const b of pl.blinks) if (t >= b[0] && t < b[1]) { st.lit = b[2]; st.halo = 0.55 * b[2]; st.core = 0.8 * b[2]; }
        S.spill[id] = 0;
      }
      if (id === 'rib') S.rib = st; else S.tubes[id] = st;
    }
    // the first blink sparks at the bar's electrode
    const b0 = plan.bar.blinks[0];
    if (b0 && t >= b0[0] && t < b0[1]) S.spark = { at: 'bar', a: 0.6 + 0.4 * I };
    return S;
  }

  // surge: still mark, glow rises, white-hot surge, cut to glass (afterimage), relight with a flicker, still mark
  function surge(t, p, D, R) {
    const ease = M.easing(p.easing);
    const I = p.intensity;
    const warm = 0.17;
    const sl = Math.max(0.035, Math.min(0.12, 55 / D));            // the surge itself: about three frames
    const c0 = warm + sl, r0 = c0 + 0.24, fadeA = 0.86;
    const dipsWanted = Math.round(2 * p.flicker);
    const dips = Math.min(dipsWanted, D >= 2400 ? 2 : 1);
    const dipLen = Math.max(0.02, Math.min(0.07, 48 / D));
    const dipAt = [r0 + Math.max(0.035, 60 / D) + 0.03 * R[0], r0 + 0.15 + 0.05 * R[1]];
    const neonOut = 1 - M.ease.inOutSine(span(t, fadeA, 1));
    const S = { tubes: {}, rib: null, spill: {}, after: 0, spark: null };
    let st, spill;
    if (t < c0) {
      const w = ease(span(t, 0, warm));
      const hot = M.ease.inCubic(span(t, warm - 0.05, c0));
      st = { lit: 1, halo: w * (1 + (0.4 + 0.8 * I) * hot), core: w, hot };
      spill = M.ease.outCubic(span(t, 0, warm + 0.04));
    } else if (t < r0) {
      st = dark0();
      // the afterimage: the halo's shape in the complementary tint, fading through the dark beat
      S.after = Math.pow(1 - span(t, c0, r0), 1.6) * (0.4 + 0.6 * I);
      spill = lerp(1, 0.45, M.ease.outCubic(span(t, c0, r0)));      // the room's light lingers; no full-frame flash
    } else {
      const bl = ease(span(t, r0, r0 + Math.max(0.08, 120 / D)));
      st = { lit: 1, halo: lerp(0.45, 1 + 0.2 * I, bl) * neonOut, core: neonOut, hot: 0 };
      for (let i = 0; i < dips; i++) {
        if (t >= dipAt[i] && t < dipAt[i] + dipLen) { st = { lit: 0.22 + 0.15 * R[2 + i], halo: 0.25, core: 0.2, hot: 0 }; }
      }
      spill = lerp(0.45, 1, M.ease.inOutSine(span(t, r0, r0 + 0.14))) * (1 - M.ease.inOutSine(span(t, 0.8, 1)));
    }
    for (const tb of TUBES) { S.tubes[tb.id] = Object.assign({}, st); S.spill[tb.id] = spill; }
    S.rib = Object.assign({}, st);
    S.spill.rib = spill;
    return S;
  }

  // buzz: the still mark at the seam; the glow breathes in and out; one tube stutters near the top of the breath
  function buzz(t, p, D, R) {
    const I = p.intensity;
    const depth = Math.max(0.15, Math.min(1, (D - 250) / 450));       // a short loop must not pulse the glow
    const breath = Math.pow(Math.sin(Math.PI * t), 2) * depth;
    const which = ['bar', 's', 'bowl'][Math.min(2, Math.floor(R[0] * 3))];
    const allowed = D >= 1200 ? 2 : D >= 1000 ? 1 : 0;
    const nb = Math.min(allowed, Math.round(4 * p.flicker));
    const S = { tubes: {}, rib: null, spill: {}, after: 0, spark: null };
    const base = { lit: 1, halo: breath * (0.85 + 0.25 * I), core: breath, hot: 0 };
    for (const tb of TUBES) { S.tubes[tb.id] = Object.assign({}, base); S.spill[tb.id] = breath; }
    S.rib = Object.assign({}, base);
    S.spill.rib = breath;
    // the stutter: off (cold glass), back on, off, back on, with a little extra bloom as it recovers
    let at = 0.4 + 0.12 * R[1];
    for (let i = 0; i < nb; i++) {
      const off = Math.max(0.02, (40 + 40 * R[2 + 2 * i]) / D), on = Math.max(0.03, (55 + 50 * R[3 + 2 * i]) / D);
      const st = S.tubes[which];
      if (t >= at && t < at + off) { st.lit = 0.04; st.halo = 0; st.core = 0; }
      at += off + on;
    }
    if (nb > 0) {
      const rec = span(t, at - 0.02, at + 0.12);
      if (rec > 0 && rec < 1) S.tubes[which].halo *= 1 + 0.35 * I * Math.sin(Math.PI * rec);
    }
    return S;
  }

  /* ---------------------------------------------------------------------------------------------------------
   * painting a state
   * ------------------------------------------------------------------------------------------------------- */
  // clear the whole scratch canvas a layer hands us (not only the region it cleared): see the header
  function wipe(c) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.restore();
  }

  function sameState(a, b) {
    return Math.abs(a.lit - b.lit) < 1e-4 && Math.abs(a.hot - b.hot) < 1e-4 && Math.abs(a.core - b.core) < 1e-4;
  }

  // the most of `colour` the field can take (alpha) before it gains or loses 0.085 relative luminance, in the
  // field's blend mode: whatever the palette, the spill alone can never make a flash-sized change
  const caps = new Map();
  function spillCap(colour, bg, mode) { return blendCap(colour, bg, mode, () => 0.085); }
  function haloCap(colour, bg, mode) { return blendCap(colour, bg, mode, (l0, l1) => 0.4 * Math.abs(l1 - l0)); }
  function blendCap(colour, bg, mode, limit) {
    const key = colour + bg + mode + limit.length;
    let a = caps.get(key);
    if (a != null) return a;
    const c = rgb(colour), f = rgb(bg);
    const lin = (v) => { v = Math.max(0, Math.min(255, v)) / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (q) => 0.2126 * lin(q[0]) + 0.7152 * lin(q[1]) + 0.0722 * lin(q[2]);
    const blend = (x) => f.map((b, i) => {
      const top = mode === 'lighter' ? b + c[i] : mode === 'screen' ? 255 - ((255 - b) * (255 - c[i])) / 255 : (b * c[i]) / 255;
      return mode === 'lighter' ? b + c[i] * x : b + (top - b) * x;
    });
    const lim = limit(L(f), L(blend(1)));
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (Math.abs(L(blend(m)) - L(f)) <= lim) lo = m; else hi = m; }
    caps.set(key, lo);
    return lo;
  }

  // the light on the field: one soft glow filling the room (to the box's edges), and a pool round each tube in
  // its own colour as it catches. Every ellipse fades out before the nearest edge of the box, so an app canvas
  // drawn over its own surface never shows its border.
  function spillOn(ctx, env, pal, L, S, p) {
    const v = env.view;
    const I = p.intensity, g = p.glow;
    const amt = (0.45 + 0.55 * g) * (0.6 + 0.4 * I);              // 1 at glow 1 and intensity 1
    const R0 = (300 + 360 * g) * (0.8 + 0.4 * I);
    const pools = TUBES.map((tb) => [tb.at, S.spill[tb.id], L.light(M.colourAt(pal[tb.path], (tb.from + tb.to) / 2))]);
    if (p.ribbon) pools.push([RIB_AT, S.spill.rib, L.light(M.colourAt(pal.ribbon, 0.35))]);
    let room = 0;
    for (const q of pools) room += q[1] / pools.length;
    const roomCol = L.light(M.mix(M.colourAt(pal.body, 0.5), p.ribbon ? M.colourAt(pal.ribbon, 0.3) : M.colourAt(pal.s, 0.5), 0.35));
    const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    const glowAt = (at, rx, ry, colour, a, mid) => {
      if (!(a > 0.002)) return;
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.scale(Math.max(1, rx), Math.max(1, ry));
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, M.rgba(colour, a));
      gr.addColorStop(mid, M.rgba(colour, a * 0.62));
      gr.addColorStop(0.72, M.rgba(colour, a * 0.26));
      gr.addColorStop(1, M.rgba(colour, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
      ctx.restore();
    };
    ctx.save();
    ctx.globalCompositeOperation = L.mode;
    glowAt([cx, cy], (v.x1 - v.x0) / 2, (v.y1 - v.y0) / 2, roomCol, 0.9 * amt * room * spillCap(roomCol, pal.bg, L.mode), 0.4);
    for (const [at, level, colour] of pools) {
      const rx = Math.min(R0 * 1.2, at[0] - v.x0, v.x1 - at[0]), ry = Math.min(R0, at[1] - v.y0, v.y1 - at[1]);
      glowAt(at, rx, ry, colour, 0.55 * amt * level * spillCap(colour, pal.bg, L.mode), 0.35);
    }
    ctx.restore();
  }

  // a cold tube's electrode: its rounded tip, blacked out (a D shape: the end's half disc and a short neck)
  function electrode(c, pts, end, r, neck, colour, alpha) {
    const q = end ? pts[pts.length - 1] : pts[0], o = end ? pts[pts.length - 2] : pts[1];
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const a = Math.atan2(dy, dx), nx = dy, ny = -dx;
    c.save();
    c.globalAlpha *= alpha;
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(q[0] + nx * r - dx * neck, q[1] + ny * r - dy * neck);
    c.lineTo(q[0] + nx * r, q[1] + ny * r);
    c.arc(q[0], q[1], r, a - Math.PI / 2, a + Math.PI / 2);
    c.lineTo(q[0] - nx * r - dx * neck, q[1] - ny * r - dy * neck);
    c.closePath();
    c.fill();
    c.restore();
  }

  function paint(ctx, p, env, S) {
    const pal = env.palette, L = lookOf(pal);
    const k = p.weight, I = p.intensity, g = p.glow;
    const px = 1 / Math.max(1e-6, env.scale || 1);                   // one CSS pixel in mark units
    const dpx = (env.scale || 1) * (env.dpr || 1);                   // device pixels per mark unit
    const T = S.tubes;

    // 1. the light on the field
    if (p.spill) spillOn(ctx, env, pal, L, S, p);

    // 2. the halo (and the afterimage) in one blurred layer under the ribbon and the letters, composited by the field
    const hw = (1.45 + 1.25 * g) * (0.9 + 0.25 * I);                 // halo width over stroke width (2.2 at defaults)
    const hA = Math.min(1, (0.3 + 0.6 * g) * (0.75 + 0.45 * I)) * L.haloA;
    const blur = (12 + 44 * g) * (0.8 + 0.5 * I);
    const anyHalo = TUBES.some((tb) => T[tb.id].halo > 0.002) || (p.ribbon && S.rib.halo > 0.002);
    if (anyHalo && hA > 0.002) {
      M.layer(ctx, { composite: L.mode, blur: Math.max(0.5, blur * dpx) }, (h) => {
        wipe(h);
        if (p.ribbon && S.rib.halo > 0.002) {
          M.stroke(h, RIB, { width: 120 * (0.8 + 0.4 * g) * (1 + 0.4 * S.rib.hot), colours: L.light(pal.ribbon), alpha: c01(S.rib.halo * hA * 0.6) });
        }
        for (const tb of TUBES) {
          const st = T[tb.id];
          if (st.halo <= 0.002) continue;
          M.stroke(h, PTS[tb.path], {
            from: tb.from, to: tb.to, width: WID[tb.path] * k * hw * (1 + 0.5 * st.hot),
            colours: toward(L.light(pal[tb.path]), '#FFFFFF', 0.3 * st.hot), alpha: c01(st.halo * hA)
          });
        }
      });
    }
    if (S.after > 0.002) {
      M.layer(ctx, { composite: L.mode, blur: Math.max(0.5, blur * 1.3 * dpx), alpha: c01(S.after * L.afterA) }, (h) => {
        wipe(h);
        for (const tb of TUBES) {
          M.stroke(h, PTS[tb.path], { from: tb.from, to: tb.to, width: WID[tb.path] * k * hw * 1.1, colours: complement(L.light(M.colourAt(pal[tb.path], 0.5))) });
        }
        if (p.ribbon) M.stroke(h, RIB, { width: 130, colours: complement(L.light(M.colourAt(pal.ribbon, 0.35))) });
      });
    }

    // 3. the ribbon: cold glass, crossfading to its colours as it catches
    if (p.ribbon) {
      const r = S.rib.lit;
      if (r < 0.999) M.ribbon(ctx, 0, { colours: [L.glass, L.glassHi, L.glass], alpha: (1 - r) * 0.42 });
      if (r > 0.001) M.ribbon(ctx, 0, { colours: toward(pal.ribbon, '#FFFFFF', 0.4 * S.rib.hot), alpha: r });
    }

    // 4. cold glass: an outline round each unlit tube (the 5's tubes outlined as one), a faint fill, electrodes
    const glassy = TUBES.filter((tb) => T[tb.id].lit < 0.999);
    if (glassy.length) {
      M.layer(ctx, { composite: 'source-over' }, (c) => {
        const ow = Math.max(8 * k, 1.3 * px);
        for (const tb of glassy) {
          M.stroke(c, PTS[tb.path], { from: tb.from, to: tb.to, width: WID[tb.path] * k + ow, colours: L.glass, alpha: 1 - T[tb.id].lit });
        }
        c.save();
        c.globalCompositeOperation = 'destination-out';
        for (const tb of TUBES) M.stroke(c, PTS[tb.path], { from: tb.from, to: tb.to, width: Math.max(0.5, WID[tb.path] * k - ow), colours: '#000000' });
        c.restore();
        for (const tb of glassy) {
          const ga = 1 - T[tb.id].lit;
          M.stroke(c, PTS[tb.path], { from: tb.from, to: tb.to, width: Math.max(0.5, WID[tb.path] * k - ow), colours: L.fill, alpha: ga });
          for (const e of tb.free) electrode(c, PTS[tb.path], e, Math.max(0.25, (WID[tb.path] * k - ow) / 2), 16 * k, L.electrode, ga);
        }
      });
    }

    // 5. the lit tubes, in Marks.mark's order (body, bar, s); the body in one stroke when stem and bowl agree
    const lit = (pts, cols, w, st, from, to) => {
      if (st.lit <= 0.001) return;
      M.stroke(ctx, pts, { width: w, colours: toward(cols, '#FFFFFF', 0.4 * st.hot), alpha: st.lit, from, to });
    };
    if (sameState(T.stem, T.bowl)) lit(PTS.body, pal.body, WID.body * k, T.stem, 0, 1);
    else { lit(PTS.body, pal.body, WID.body * k, T.stem, 0, FOOT); lit(PTS.body, pal.body, WID.body * k, T.bowl, FOOT, 1); }
    lit(PTS.bar, pal.bar, WID.bar * k, T.bar, 0, 1);
    lit(PTS.s, pal.s, WID.s * k, T.s, 0, 1);

    // 6. the cores: thin and bright, stopping short of the electrodes; white-hot in a surge
    const core = (tb, from, to, st) => {
      if (st.core <= 0.002 || st.lit <= 0.001) return;
      const inset = 30 / LEN[tb.path];
      const f = from + (from === 0 && tb.free.includes(0) ? inset : 0), e = to - (to === 1 && tb.free.includes(1) ? inset : 0);
      M.stroke(ctx, PTS[tb.path], {
        from: f, to: e, width: Math.max(1.1 * px, WID[tb.path] * k * (0.2 + 0.3 * st.hot)),
        colours: toward(pal[tb.path], '#FFFFFF', 0.6 + 0.4 * st.hot), alpha: c01(st.core * Math.min(1, st.lit * 1.25))
      });
    };
    const TB = {};
    for (const tb of TUBES) TB[tb.id] = tb;
    if (sameState(T.stem, T.bowl)) core({ path: 'body', free: [1] }, 0, 1, T.stem);
    else { core(TB.stem, 0, FOOT, T.stem); core(TB.bowl, FOOT, 1, T.bowl); }
    core(TB.bar, 0, 1, T.bar);
    core(TB.s, 0, 1, T.s);

    // 7. a spark at the bar's electrode on its first blink
    if (S.spark) {
      const q = PTS.bar[N - 1];
      const r = (10 + 16 * I) * k;
      ctx.save();
      if (L.dark) ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], r * 3.2);
      gr.addColorStop(0, M.rgba('#FFFFFF', S.spark.a));
      gr.addColorStop(0.3, M.rgba(M.mix(M.colourAt(pal.bar, 1), '#FFFFFF', 0.5), S.spark.a * 0.6));
      gr.addColorStop(1, M.rgba(M.colourAt(pal.bar, 1), 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(q[0], q[1], r * 3.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  Motion.register({
    id: 'neon',
    name: 'Neon',
    idea: 'The mark is a neon sign: the tubes buzz, stutter and catch, light blooms out of them and spills across the field in their colours, and the sign holds, humming.',
    why: 'A sign coming on is the oldest way a place says "open". The letters do not move; they switch on, and the stutter makes you wait for them to catch. The light comes from the mark itself.',
    moments: ['launch', 'load', 'empty', 'turn', 'five-start'],
    styles: ['ignite', 'surge', 'buzz'],
    params: {
      duration: { default: 1200, min: 250, max: 4000, step: 50 },
      style: { default: 'ignite', options: ['ignite', 'surge', 'buzz'] },
      flicker: { default: 0.5, min: 0, max: 1, step: 0.05 },   // how many stutters (always within three flashes a second)
      glow: { default: 0.6, min: 0, max: 1, step: 0.05 },      // the halo's width and strength
      spill: { default: true }                                 // the light tints the field
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      // chance, drawn the same way on every frame: the stutter's rhythm, the buzzing tube, the dips
      const R = [];
      for (let i = 0; i < 96; i++) R.push(env.rng());
      const D = p.duration;
      const S = p.style === 'surge' ? surge(t, p, D, R) : p.style === 'buzz' ? buzz(t, p, D, R) : ignite(t, p, D, R);
      paint(ctx, p, env, S);
    }
  });
})();

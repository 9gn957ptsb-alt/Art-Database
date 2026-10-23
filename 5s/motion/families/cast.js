/* 5s Motion Lab: Cast (a new family, 22 Oct 2026; the brief: 5s/handoff/motion-brief.json, new_families).
 *
 * The 5s stands up off the page like an object in a room, seen from above. It never moves: the light
 * does. A light crosses over it and its long shadow sweeps round the floor like the hand of a sundial,
 * then tucks back under it. The first family about a room rather than a sign: light, shadow, a floor,
 * a time of day.
 *
 * The shadow
 *   The letters stand `height` tall. Under a light from direction u (on the floor) the shadow of a stroke
 *   is that stroke swept along u by its length: the strip its centreline sweeps (one fill), thickened by
 *   the stroke width along the strip's outline (one stroke). Under the lamp the letters are a
 *   cut-out held off the floor, so the shadow is the mark itself scaled up about the lamp: a shadow play.
 *   Sharp by the letters, it crosses into a blurred copy toward its far end (soft) and fades.
 * The room
 *   On a light field the shadow is a cool ink at 16-28% and the light a faint warm tint (multiply). On a dark
 *   field (the dark theme, or Inverse) the light is what you see: a warm pool of the palette's ember and
 *   iris, added ('lighter'), with the shadow cut out of it. On a mid-tone field (Paper's violet) the light
 *   is screened and the shadow is a deep violet cut. Flat palettes (Ink, Paper) keep their one colour.
 *
 * Styles
 *   sundial  the light circles (sweep turns of compass) and dips lowest mid-cycle, so the shadow grows,
 *            swings round and is longest then, and tucks back under. The letters catch a thin rim of
 *            light on the side that faces it.
 *   window   morning light through a window: a leaning patch of four panes slides across the floor and
 *            over the mark, the mark's long shadow inside it. In the dark the patch is the only light and
 *            the letters are lit where it falls. The patch starts and ends off-frame.
 *   lamp     a pendant lamp swings in close above the mark: its shadow stretches huge across the floor
 *            (up to 2.5 times the mark at intensity 1), sways with the lamp's damped pendulum and shrinks
 *            back under the mark as the lamp settles overhead.
 * Every style is a seamless loop whose t = 0 and t = 1 are exactly the still mark (Marks.mark).
 *
 * Params: sweep (turns of the light, sundial), height (how tall the mark stands: the shadow's length; the
 * lamp's reach), soft (blur of the shadow's far end; for the window, of the sunbeam's edges). Shared:
 * palette, ribbon, weight (the letters and their shadow), intensity (how low the light goes and how strong
 * it is), easing (the light's travel through the cycle; linear by default: a clock keeps even time),
 * duration (one cycle). env.rng (the seed) picks where the sundial's light starts and the lamp's swing.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const C = M.anchors.letters;
  const SHADOW = '#16131F';   // the light theme's ink: a shadow darkens whatever field it falls on
  const RIM = '#FFF4DC';      // warm white: the edge of a letter that faces the light
  // the letters' centrelines, coarse (points at most ~18 units apart): a shadow needs only the silhouette
  const SIL = [['body', M.points('body', 90)], ['bar', M.points('bar', 18)], ['s', M.points('s', 80)]];

  const isDark = (pal) => lum(pal.bg) < 0.3;   // a dark field: the light is what you see
  const lum = (hex) => { const v = parseInt(hex.slice(1, 7), 16); return (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255; };

  // the letters' outline strokes (strokeStyle set by the caller), widths times k
  function outline(c, k) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [name, pts] of SIL) {
      c.lineWidth = M.widths[name] * k;
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.stroke();
    }
  }

  // the letters swept along d: the strip each centreline sweeps (one quad per segment, all wound the same way
  // so they fill as one), thickened by the stroke's width along that strip's outline: the centreline at both
  // ends of the sweep, and the sides where the centreline turns back across d (and at its two ends)
  const swept = (d, k) => (c) => {
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [name, pts] of SIL) {
      const n = pts.length, sides = [pts[0], pts[n - 1]];
      c.beginPath();
      let prev = 0;
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const cr = (b[0] - a[0]) * d[1] - (b[1] - a[1]) * d[0];
        if (i && (cr > 0) !== (prev > 0)) sides.push(a);
        prev = cr;
        const [e, f] = cr >= 0 ? [a, b] : [b, a];
        c.moveTo(e[0], e[1]); c.lineTo(f[0], f[1]); c.lineTo(f[0] + d[0], f[1] + d[1]); c.lineTo(e[0] + d[0], e[1] + d[1]); c.closePath();
      }
      c.fill();
      c.lineWidth = M.widths[name] * k;
      c.beginPath();
      for (const o of [[0, 0], d]) pts.forEach((q, i) => (i ? c.lineTo(q[0] + o[0], q[1] + o[1]) : c.moveTo(q[0] + o[0], q[1] + o[1])));
      for (const q of sides) { c.moveTo(q[0], q[1]); c.lineTo(q[0] + d[0], q[1] + d[1]); }
      c.stroke();
    }
  };

  // the letters scaled by s about o (a shadow play)
  const scaled = (o, s, k) => (c) => {
    c.save(); c.translate(o[0], o[1]); c.scale(s, s); c.translate(-o[0], -o[1]);
    outline(c, k);
    c.restore();
  };

  function fillView(c, v, style) { c.fillStyle = style; c.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); }

  // the shadow, opaque in col: sharp at P0 (by the letters), crossing to a blurred copy toward P1 (its far
  // end) and fading to `fade` there. Draws into its own layer (it masks with destination-in).
  function shade(c, shape, col, P0, P1, blur, fade, v) {
    const ramp = (g, w) => {
      const lg = g.createLinearGradient(P0[0], P0[1], P1[0], P1[1]);
      for (let i = 0; i <= 4; i++) lg.addColorStop(i / 4, 'rgba(0,0,0,' + w(i / 4).toFixed(3) + ')');
      g.save(); g.globalCompositeOperation = 'destination-in'; fillView(g, v, lg); g.restore();
    };
    const f = (u) => 1 - (1 - fade) * u;
    c.fillStyle = c.strokeStyle = col; shape(c);
    if (blur > 0.5) {   // sharp * (1 - u) + blurred * u, added: the same colour, so the sum is exact
      ramp(c, (u) => (1 - u) * f(u));
      M.layer(c, { blur, composite: 'lighter' }, (b) => { b.fillStyle = b.strokeStyle = col; shape(b); ramp(b, (u) => u * f(u)); });
    } else if (fade < 1) ramp(c, f);
  }

  // a pool of warm light round P: ember at the heart, iris at the rim, gone by R
  function pool(c, P, R, pal, a, v) {
    const g = c.createRadialGradient(P[0], P[1], 0, P[0], P[1], R);
    g.addColorStop(0, M.rgba(M.mix(pal.ember, '#FFD88A', 0.35), a));
    g.addColorStop(0.5, M.rgba(pal.ember, a * 0.6));
    g.addColorStop(0.8, M.rgba(M.mix(pal.ember, pal.iris, 0.6), a * 0.22));
    g.addColorStop(1, M.rgba(pal.iris, 0));
    fillView(c, v, g);
  }

  // the room's light and the shadow in it. light(c, dark) paints the light: added ('lighter') on a dark field,
  // with the shadow cut out of it; on a light field a multiplied tint, on a mid-tone one (Paper's violet)
  // screened, and the shadow ink at alpha sa, or (inLight: the window) ink painted only where the light falls
  function room(ctx, env, o) {
    const v = env.view, L = lum(env.palette.bg);
    const lift = (c) => { if (o.lift) { c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#000'; outline(c, o.lift); } };
    const ink = M.mix(SHADOW, env.palette.iris, 0.3);   // a cool shadow under a warm light
    const cast = (c) => { shade(c, o.shape, ink, o.P0, o.P1, o.blur, o.fade, v); lift(c); };
    if (isDark(env.palette)) {
      M.layer(ctx, { composite: 'lighter' }, (c) => { o.light(c, true); M.layer(c, { composite: 'destination-out' }, cast); });
      return true;
    }
    const mode = L < 0.75 ? 'screen' : 'multiply';
    if (o.inLight) M.layer(ctx, { composite: mode }, (c) => { o.light(c, false); M.layer(c, { composite: 'source-atop', alpha: o.sa }, cast); });
    else {
      ctx.save(); ctx.globalCompositeOperation = mode; o.light(ctx, false); ctx.restore();   // one fill: no layer needed
      M.layer(ctx, { alpha: o.sa }, cast);
    }
    return false;
  }

  // a thin rim of light on the side of each letter that faces it: the letters, minus themselves moved away
  // from the light by `by`
  function rim(ctx, u, by, a, k) {
    if (a < 0.01 || by < 0.5) return;
    M.layer(ctx, { alpha: a }, (c) => {
      c.strokeStyle = RIM; outline(c, k);
      c.globalCompositeOperation = 'destination-out';
      c.translate(u[0] * by, u[1] * by); outline(c, k);
    });
  }

  // where the letters reach along a unit direction u, measured from C
  function extent(u) {
    let lo = Infinity, hi = -Infinity;
    for (const [, pts] of SIL) for (const q of pts) { const s = (q[0] - C[0]) * u[0] + (q[1] - C[1]) * u[1]; if (s < lo) lo = s; if (s > hi) hi = s; }
    return [lo - 70, hi + 70];
  }
  const along = (u, s) => [C[0] + u[0] * s, C[1] + u[1] * s];

  // how long the shadow gets at the light's lowest: height sets how tall the mark stands, intensity how low the light goes
  const reach = (p) => (80 + 360 * p.height) * (0.5 + 0.8 * p.intensity);
  const shadowAlpha = (env, I) => (0.16 + 0.12 * I) * (lum(env.palette.bg) < 0.75 ? 1.5 : 1);
  const blurPx = (env, p, len) => p.soft * len * 0.1 * env.scale * env.dpr;

  function still(ctx, p, env) { M.mark(ctx, { palette: env.palette, weight: p.weight, ribbon: p.ribbon }); }

  function sundial(ctx, t, p, env) {
    const u = M.easing(p.easing)(t), I = p.intensity;
    const low = Math.abs(Math.sin(Math.PI * u)) ** 1.5;   // 0 with the light overhead (t = 0 and 1), 1 at its lowest
    if (low < 1e-4) return still(ctx, p, env);
    const a = env.rng() * TAU + TAU * p.sweep * u;
    const dir = [Math.cos(a), Math.sin(a)];            // the way the shadow points: away from the light
    const len = reach(p) * low;
    const d = [dir[0] * len, dir[1] * len];
    const [lo, hi] = extent(dir);
    const pal = env.palette, v = env.view;
    room(ctx, env, {
      shape: swept(d, p.weight),
      P0: along(dir, lo + 0.7 * (hi - lo)), P1: along(dir, hi + len),
      blur: blurPx(env, p, len), fade: 0.4, sa: shadowAlpha(env, I) * Math.min(1, low * 3),
      light: (c, dark) => pool(c, along(dir, -0.3 * len), 700 + 0.6 * len, pal, (dark ? 0.32 + 0.25 * I : 0.14 + 0.12 * I) * low, v)
    });
    still(ctx, p, env);
    rim(ctx, dir, (6 + 14 * I) * low, (0.45 + 0.4 * I) * low, p.weight);
  }

  function windowLight(ctx, t, p, env) {
    const u = M.easing(p.easing)(t), I = p.intensity, v = env.view, pal = env.palette;
    // the sun crosses: the shadow, up and to the right into the open corner of the mark, swings a little
    // while the patch slides left to right
    const a = -0.85 + 0.45 * (u - 0.5);
    const dir = [Math.cos(a), Math.sin(a)];
    const len = reach(p) * 0.7;
    const d = [dir[0] * len, dir[1] * len];
    // the patch: a window of 2 x 2 panes cast along dir; its sill and lintel stay level, its jambs lean with the light
    const Wd = 600, Ld = 1250, bar = 30;
    const half = Wd / 2 + Math.abs(dir[0]) * Ld / 2 + 90;
    const cx = M.lerp(v.x0 - half, v.x1 + half, u), cy = 470;
    const O = [cx - Wd / 2 - dir[0] * Ld / 2, cy - dir[1] * Ld / 2];
    const q = (x, y) => [O[0] + x * Wd + y * dir[0] * Ld, O[1] + y * dir[1] * Ld];
    const g = bar / 2 / Wd, gy = bar / 2 / Ld;
    const panes = (c) => {
      c.beginPath();
      for (const [x0, x1] of [[0, 0.5 - g], [0.5 + g, 1]]) for (const [y0, y1] of [[0, 0.5 - gy], [0.5 + gy, 1]]) {
        const A = q(x0, y0), B = q(x1, y0), Cc = q(x1, y1), D = q(x0, y1);
        c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(Cc[0], Cc[1]); c.lineTo(D[0], D[1]); c.closePath();
      }
    };
    const soft = 12 * p.soft * env.scale * env.dpr;
    const patch = (c, dark) => {
      const lg = c.createLinearGradient(q(0, 0)[0], q(0, 0)[1], q(0, 1)[0], q(0, 1)[1]);   // warmer by the window
      const k = dark ? 0.26 + 0.3 * I : 0.3 + 0.2 * I;
      lg.addColorStop(0, M.rgba(M.mix(pal.ember, '#FFE2A8', 0.4), k));
      lg.addColorStop(1, M.rgba(pal.ember, k * 0.7));
      M.layer(c, { blur: soft }, (b) => { panes(b); b.fillStyle = lg; b.fill(); });   // soft 0: crisp, no blur
    };
    const [lo, hi] = extent(dir);
    // in the dark the letters dim while the sun is in and the patch is added over them, so they are lit only
    // where it falls (their own footprint is lifted out of the shadow); on a light field the letters sit on top
    const dark = isDark(pal), dim = 0.4 * (0.5 + 0.5 * I) * Math.sin(Math.PI * t) ** 2;
    if (dark) { still(ctx, p, env); ctx.save(); ctx.globalAlpha *= dim; fillView(ctx, v, pal.bg); ctx.restore(); }   // a veil of the field: one fill
    room(ctx, env, {
      shape: swept(d, p.weight), inLight: true, sa: 0.6, lift: dark ? p.weight : 0,
      P0: along(dir, lo + 0.7 * (hi - lo)), P1: along(dir, hi + len),
      blur: 0, fade: 0.2,   // a short shadow in a sunbeam: soft blurs the beam's edges instead (one blur a frame)
      light: patch
    });
    if (!dark) still(ctx, p, env);
    rim(ctx, dir, 6 + 10 * I, 0.5 * Math.sin(Math.PI * t) ** 2, p.weight);
  }

  function lamp(ctx, t, p, env) {
    const u = M.easing(p.easing)(t), I = p.intensity, v = env.view, pal = env.palette;
    // the lamp drops in close and swings (a damped pendulum, two and a half swings), then settles and rises
    const close = M.smoothstep(0, 0.16, u) * (1 - M.smoothstep(0.58, 1, u));
    if (close < 1e-4) return still(ctx, p, env);
    const ax = env.rng() * Math.PI, axis = [Math.cos(ax), Math.sin(ax)], side = [-axis[1], axis[0]];
    const amp = (160 + 260 * I) * Math.exp(-2.2 * u) * (1 - Math.exp(-12 * u));
    const x = amp * Math.sin(5 * Math.PI * u), y = 0.28 * amp * Math.sin(5 * Math.PI * u + 1.3);
    const L = [C[0] + axis[0] * x + side[0] * y, C[1] + axis[1] * x + side[1] * y];
    const s = 1 + (0.25 + 1.25 * I) * (0.5 + p.height) * close;   // the shadow's size, the mark's times
    const dir = [C[0] - L[0], C[1] - L[1]], dl = Math.hypot(dir[0], dir[1]);
    const away = dl > 1 ? [dir[0] / dl, dir[1] / dl] : axis;   // a gradient needs two distinct ends
    const blur = p.soft * (s - 1) * 40 * env.scale * env.dpr;
    room(ctx, env, {
      shape: scaled(L, s, p.weight),
      // a shadow play is soft all over (the penumbra grows with its size); P0 -> P1 runs away from the lamp
      P0: L, P1: [L[0] + away[0] * 900 * s, L[1] + away[1] * 900 * s],
      blur, fade: 0.55, sa: shadowAlpha(env, I) * Math.min(1, close * 3),
      light: (c, dark) => pool(c, L, 420 + 320 * close, pal, (dark ? 0.55 + 0.35 * I : 0.1 + 0.1 * I) * close, v)
    });
    still(ctx, p, env);
    rim(ctx, away, Math.min(18, dl * 0.08) * close, 0.6 * close, p.weight);
  }

  Motion.register({
    id: 'cast',
    name: 'Cast',
    idea: 'The 5s stands up off the page like an object in a room; a light crosses over it, and its long shadow sweeps round the floor like the hand of a sundial, then tucks back under it.',
    why: 'Light moving through a room is how a space feels lived in, and 5s is heading for your house: a shadow turning round the mark is a clock anyone can read, a dark hand at 64 px and architecture at full screen, calm enough to wait with.',
    moments: ['seed', 'load', 'empty', 'launch', 'five-start'],
    styles: ['sundial', 'window', 'lamp'],
    params: {
      duration: { default: 2400, min: 300, max: 6000, step: 50 },
      style: { default: 'sundial', options: ['sundial', 'window', 'lamp'] },
      sweep: { default: 1, min: 0.25, max: 1, step: 0.05 },     // turns the light makes round the mark (sundial)
      height: { default: 0.5, min: 0, max: 1, step: 0.05 },     // how tall the mark stands: the shadow's length
      soft: { default: 0.5, min: 0, max: 1, step: 0.05 },       // blur of the shadow's far end
      easing: { default: 'linear', options: M.EASES.slice() }   // a clock and a pendulum keep even time
    },
    reduced: 'still',
    loop: true,

    draw(ctx, t, p, env) {
      if (p.style === 'window') windowLight(ctx, t, p, env);
      else if (p.style === 'lamp') lamp(ctx, t, p, env);
      else sundial(ctx, t, p, env);
    }
  });
})();

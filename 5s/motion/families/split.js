/* 5s Motion Lab: Split (Decomposition & making).
 *
 * The 5 breaks into its parts, the bar, the stem and the bowl, with the s and the ribbon, and they fly
 * apart and come back. It is the Split tab in one gesture: "Everything you kept, broken into its parts."
 * Each part keeps its own stretch of the logo's gradient (the stem and the bowl are two pieces of the
 * 5's one body stroke), so a part in flight is still recognisably that piece of the mark.
 *
 * Styles
 *   chips      the parts fly out along arcs and straighten into five colour chips in a row, sorted by hue
 *              like the Split tab's swatches (bar, stem, s, bowl, ribbon), bob once, then curl back home
 *   burst      the mark gathers, bursts apart, each part turning as it goes; the parts drift and turn
 *              while they hang apart (curiosity), then snap home in the reverse order with a small click
 *   exploded   an exploded diagram: parts slide straight out along their own axes, no spin, leaving a
 *              faint ghost and a dotted leader line back to where they belong, then slide home
 *   orbit      the parts lift off and circle the centre at their own speeds, a slow whirl of pieces being
 *              sorted (bringing in your own), and land home together
 *
 * The motion starts and ends on the still mark, so it also repeats cleanly for the Bring sheet's loop.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);       // progress of t through [a, a + len]
  const bump = (x) => Math.sin(Math.PI * clamp01(x));       // 0 -> 1 -> 0

  /* --- the parts, computed once ------------------------------------------------------------------ */

  // the stretch [a, b] (fractions of length) of a polyline, as n points evenly spaced
  function sub(pts, a, b, n) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = cum[cum.length - 1], s0 = a * L, s1 = b * L;
    const at = (s) => {
      let j = 0;
      while (j < pts.length - 2 && cum[j + 1] < s) j++;
      const f = cum[j + 1] > cum[j] ? (s - cum[j]) / (cum[j + 1] - cum[j]) : 0;
      return [pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f];
    };
    const out = [at(s0)];
    for (let i = 0; i < pts.length; i++) if (cum[i] > s0 && cum[i] < s1) out.push(pts[i]);
    out.push(at(s1));
    return M.resample(out, n);
  }
  const centroid = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };

  const RIB = M.points('ribbon', 220);   // the same spine Marks.ribbon uses by default
  // draw order is the mark's: ribbon under, then the 5 (bowl, stem, bar), then the s. The classic letters, or (look)
  // the Iterations look's, cut the same way from the sheet's centrelines; each part says which stretch of which letter
  // it is (M.stroke's letter), so in the look it flies as the sheet's
  function partsOf(look) {
    const P = look ? (k) => M.paths5s[k] : (k) => k;
    // the body's first segment: the stem to the foot
    const U_STEM = M.length(look ? 'M 274 233 C 248 309 222 386 190 466' : 'M 311 231 C 262 318 211 404 160 491') / M.length(P('body'));
    const BODY = M.points(P('body'), 640);
    const parts = [
      { id: 'ribbon', pts: RIB },
      { id: 'bowl', pts: sub(BODY, U_STEM, 1, 160), key: 'body', a: U_STEM, b: 1, letter: ['body', U_STEM, 1] },
      { id: 'stem', pts: sub(BODY, 0, U_STEM, 70), key: 'body', a: 0, b: U_STEM, letter: ['body', 0, U_STEM] },
      { id: 'bar', pts: M.points(P('bar'), 160), key: 'bar', a: 0, b: 1, letter: 'bar' },
      { id: 's', pts: M.points(P('s'), 160), key: 's', a: 0, b: 1, letter: 's' }
    ];
    for (const p of parts) p.c = centroid(p.pts);
    return parts;
  }
  const LOOKS = { classic: partsOf(false), look: null };
  let PARTS = LOOKS.classic;
  const CENTRE = M.anchors.letters;

  // a part's own colours: its stretch of the whole stroke's gradient, as positioned stops
  const stopCache = new Map();
  function partColours(pal, part) {
    const key = pal.name + pal.theme + part.id;
    let s = stopCache.get(key);
    if (!s) {
      // the original stops that fall inside [a, b], remapped, plus the colours at a and b: exactly the stretch
      const src = pal[part.key], a = part.a, b = part.b;
      const n = Array.isArray(src) ? src.length : 1;
      const us = [];
      if (Array.isArray(src)) src.forEach((c, i) => us.push(Array.isArray(c) && typeof c[0] === 'number' ? c[0] : (n === 1 ? 0 : i / (n - 1))));
      s = [[0, M.colourAt(src, a)]];
      for (const u of us) if (u > a && u < b) s.push([(u - a) / (b - a), M.colourAt(src, u)]);
      s.push([1, M.colourAt(src, b)]);
      stopCache.set(key, s);
    }
    return s;
  }

  // draw one part: xf = {x, y, rot, scale} about the part's centroid; shape = points to use instead (same n)
  function drawPart(ctx, part, pal, p, xf, shape, alpha, ribbonT) {
    const k = p.weight;
    ctx.save();
    ctx.translate(part.c[0] + (xf.x || 0), part.c[1] + (xf.y || 0));
    if (xf.rot) ctx.rotate(xf.rot);
    if (xf.scale != null && xf.scale !== 1) ctx.scale(xf.scale, xf.scale);
    ctx.translate(-part.c[0], -part.c[1]);
    if (part.id === 'ribbon') {
      M.ribbon(ctx, ribbonT || 0, { colours: pal.ribbon, pts: shape || RIB, alpha: alpha == null ? 1 : alpha, width: xf.ribbonWidth || M.widths.ribbon });
    } else {
      M.stroke(ctx, shape || part.pts, { width: M.widths[part.key] * k * (xf.thin || 1), colours: partColours(pal, part), alpha: alpha == null ? 1 : alpha, letter: xf.letter || part.letter });
    }
    ctx.restore();
  }

  /* --- per-style choreography -------------------------------------------------------------------- */
  // how far each part flies (mark units, scaled by 0.3 + 0.75 x intensity) and how far it turns (radians)
  const BURST = {
    bar: { v: [70, -180], r: -0.42, out: 0.0, back: 0.07 },
    stem: { v: [-170, -60], r: 0.55, out: 0.03, back: 0.05 },
    bowl: { v: [-120, 150], r: -0.32, out: 0.05, back: 0.03 },
    s: { v: [150, 110], r: 0.62, out: 0.02, back: 0.1 },
    ribbon: { v: [30, 170], r: -0.18, out: 0.08, back: 0.0 }
  };
  // exploded: straight out along each part's own axis, no turning
  const EXPLODE = {
    bar: { v: [60, -150], out: 0.0, back: 0.06 },
    stem: { v: [-150, -50], out: 0.03, back: 0.04 },
    bowl: { v: [-50, 150], out: 0.06, back: 0.02 },
    s: { v: [170, 70], out: 0.04, back: 0.08 },
    ribbon: { v: [80, 130], out: 0.09, back: 0.0 }
  };
  // chips: a row sorted by hue, yellow to violet
  const CHIP_ORDER = ['bar', 'stem', 's', 'bowl', 'ribbon'];

  // the away curve: 0 at rest, ~1 apart. A small gather before the burst (anticipation), a slow drift while
  // apart (nothing stops dead), and a little past home on landing (the parts click together), back to 0 at t=1
  function away(t, ease, outAt, outLen, backAt, backLen, I) {
    const out = ease(win(t, outAt, outLen));
    const back = ease(win(t, backAt, backLen));
    const drift = 0.1 * M.smoothstep(outAt + outLen * 0.6, backAt + 0.04, t);
    const gather = 0.07 * bump(t / Math.max(0.02, outAt + 0.03)) * (t < outAt + 0.03 ? 1 : 0);
    const click = 0.05 * (0.4 + 0.6 * I) * bump((win(t, backAt, backLen) - 0.78) / 0.22);
    return out * (1 + drift) * (1 - back) - gather - click;
  }

  function ribbonPhase(t, I) { return 0.12 * I * Math.sin(Math.PI * t); }   // the ribbon turns a little while apart

  // while the parts are apart the whole view pulls back a little, so they stay inside the frame
  function pullBack(ctx, amount, draw) {
    ctx.save();
    ctx.translate(CENTRE[0], CENTRE[1]);
    ctx.scale(1 - amount, 1 - amount);
    ctx.translate(-CENTRE[0], -CENTRE[1]);
    draw();
    ctx.restore();
  }
  const apartness = (t) => M.smoothstep(0.04, 0.3, t) * (1 - M.smoothstep(0.58, 0.92, t));

  function burst(ctx, t, p, env, I, ease) {
    const pal = env.palette, D = 0.3 + 0.75 * I;
    pullBack(ctx, 0.18 * I * apartness(t), () => {
      for (const part of PARTS) {
        if (part.id === 'ribbon' && !p.ribbon) continue;
        const b = BURST[part.id];
        const backAt = 0.54 + b.back;
        const a = away(t, ease, 0.05 + b.out, 0.3, backAt, 0.36, I);
        // the turn keeps going while the part hangs apart (it is being looked at), and unwinds on the way home
        const hang = M.smoothstep(0.2, 0.6, t) * (1 - ease(win(t, backAt, 0.36)));
        const rot = b.r * (0.35 + 0.65 * I) * (a + 0.55 * hang);
        drawPart(ctx, part, pal, p, { x: b.v[0] * D * a, y: b.v[1] * D * a, rot, scale: 1 - 0.07 * Math.max(0, a) }, null, 1, ribbonPhase(t, I));
      }
    });
  }

  // the outline of the whole 5 and s where the parts belong (the negative space they leave), drawn as one
  // layer: every part's stroke in a quiet ink, then the same strokes a little thinner cut out of it
  function ghost(ctx, pal, p, alpha) {
    if (alpha <= 0.01) return;
    const line = M.mix(pal.bg, pal.ink, 0.32);
    // composite is given so Marks.layer always uses its scratch canvas (the cut-out must never reach the page)
    M.layer(ctx, { alpha: Math.min(alpha, 0.99), composite: 'source-over' }, (g) => {
      for (const part of PARTS) if (part.id !== 'ribbon') M.stroke(g, part.pts, { width: M.widths[part.key] * p.weight + 6, colours: line, letter: part.letter });
      g.save();
      g.globalCompositeOperation = 'destination-out';
      for (const part of PARTS) if (part.id !== 'ribbon') M.stroke(g, part.pts, { width: M.widths[part.key] * p.weight - 6, colours: '#000', letter: part.letter });
      g.restore();
    });
  }

  function exploded(ctx, t, p, env, I, ease) {
    const pal = env.palette, D = 0.45 + 1.0 * I;
    const lineCol = M.mix(pal.bg, pal.ink, 0.5);
    const placed = [];
    for (const part of PARTS) {
      if (part.id === 'ribbon' && !p.ribbon) continue;
      const b = EXPLODE[part.id];
      // a mechanical slide: out, a held beat apart, back; no spin, no drift
      const out = ease(win(t, 0.06 + b.out, 0.28)), back = ease(win(t, 0.58 + b.back, 0.3));
      const a = out * (1 - back);
      placed.push({ part, a, x: b.v[0] * D * a, y: b.v[1] * D * a });
    }
    const open = Math.max(...placed.map((q) => q.a));
    pullBack(ctx, 0.2 * I * apartness(t), () => {
      ghost(ctx, pal, p, 0.9 * M.smoothstep(0.05, 0.5, open));
      for (const q of placed) drawPart(ctx, q.part, pal, p, { x: q.x, y: q.y }, null, 1, ribbonPhase(t, I) * 0.5);
      // leader lines: dotted, from home to the part, with a small ring at home and a dot on the part
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = lineCol; ctx.fillStyle = lineCol;
      for (const q of placed) {
        const len = Math.hypot(q.x, q.y);
        if (len < 24) continue;
        const g = M.smoothstep(24, 80, len);
        const hx = q.part.c[0], hy = q.part.c[1], px = hx + q.x, py = hy + q.y;
        ctx.globalAlpha = g;
        ctx.lineWidth = 11;
        ctx.setLineDash([0.1, 26]);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(hx, hy, 17, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 13, 0, TAU); ctx.fill();
      }
      ctx.restore();
    });
  }

  // chips: each part flies out of the mark, shrinking as it goes but keeping its shape (still legibly the
  // bar, the stem, the bowl...), swings into its slot in a row sorted by hue, and there rolls up into a fat
  // swatch of its own colours, like the Split tab's chips; the chips bob once in a wave, then unroll and fly
  // home in the reverse order
  const CHIP_SCALE = { bar: 0.42, stem: 0.5, bowl: 0.3, s: 0.42, ribbon: 0.3 };
  function chips(ctx, t, p, env, I, ease) {
    const pal = env.palette;
    const used = CHIP_ORDER.filter((id) => id !== 'ribbon' || p.ribbon);
    const n = used.length, gap = n === 5 ? 184 : 206, x0 = 500 - (gap * (n - 1)) / 2;
    const chipLen = 48 * (0.8 + 0.2 * p.weight), chipW = 112 * (0.8 + 0.2 * p.weight), rowY = 505;
    for (const part of PARTS) {
      if (part.id === 'ribbon' && !p.ribbon) continue;
      const slot = used.indexOf(part.id);
      const d = 0.03 * slot;                                     // out in hue order, home in reverse
      const go = ease(M.smoothstep(0, 1, win(t, 0.03 + d, 0.4)));
      const home = ease(M.smoothstep(0, 1, win(t, 0.55 + (0.03 * (n - 1) - d), 0.45 - 0.03 * (n - 1))));   // all home by t = 1
      const m = go * (1 - home);                                 // 0 = the part at home, 1 = the chip in its slot
      const target = [x0 + gap * slot, rowY];
      // the route: first out, away from the centre (the mark breaking apart), then a swing into the row
      const c = part.c;
      let ox = c[0] - CENTRE[0], oy = c[1] - CENTRE[1];
      const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
      const reach = 60 + 200 * I;
      const c1 = [c[0] + ox * reach, c[1] + oy * reach];
      const c2 = [target[0] + ox * reach * 0.4, target[1] + (c1[1] < rowY ? -1 : 1) * (50 + 120 * I)];
      const u = m, v = 1 - u;
      const pos = [
        v * v * v * c[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * target[0],
        v * v * v * c[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * target[1]
      ];
      // shrink in flight (shape kept), then roll up into the chip at the end of the flight, head first
      const sc = M.lerp(1, CHIP_SCALE[part.id], M.smoothstep(0, 0.8, m));
      const roll = M.smoothstep(0.55, 1, m);
      const src = part.pts, N = src.length;
      const shape = new Array(N);
      for (let i = 0; i < N; i++) {
        const f = i / (N - 1);
        const mi = M.smoothstep(0, 1, M.clamp(roll * 1.35 - 0.35 * f, 0, 1));
        const px = (src[i][0] - c[0]) * sc, py = (src[i][1] - c[1]) * sc;
        const qx = (f - 0.5) * chipLen, qy = 0;
        shape[i] = [c[0] + px + (qx - px) * mi, c[1] + py + (qy - py) * mi];
      }
      const spin = (slot % 2 ? -1 : 1) * 0.5 * I * bump(m) * (1 - roll);   // a toss in flight, level on landing
      const bob = -24 * I * bump((t - 0.42 - 0.026 * slot) / 0.14);
      const xf = { x: pos[0] - c[0], y: pos[1] - c[1] + bob, rot: spin };
      if (part.id === 'ribbon') {
        // the ribbon's glass gathers into a translucent violet swatch
        if (roll < 0.98) drawPart(ctx, part, pal, p, Object.assign({ ribbonWidth: M.widths.ribbon * sc }, xf), shape, 1 - roll, 0.25 * m);
        if (roll > 0.02) {
          ctx.save();
          ctx.translate(pos[0], pos[1] + bob);
          M.stroke(ctx, [[-chipLen / 2, 0], [0, 0], [chipLen / 2, 0]], { width: chipW * (0.5 + 0.5 * roll), colours: pal.ribbon.slice(0, 3), alpha: 0.88 * roll });
          ctx.restore();
        }
        continue;
      }
      const w0 = M.widths[part.key] * p.weight;
      xf.thin = M.lerp(sc, chipW / w0, roll);
      xf.letter = [part.letter, null, roll];   // the look: the sheet's letter in flight, a plain chip once rolled up
      drawPart(ctx, part, pal, p, xf, shape, 1, 0);
    }
  }

  // orbit: the parts ride round the centre like the cars of a wheel, upright, each at its own pace, lifted
  // out on the way round; one full turn brings each home
  const ORBIT = { ribbon: 0.0, bowl: 0.05, stem: 0.09, bar: 0.13, s: 0.17 };
  function orbit(ctx, t, p, env, I, ease) {
    const pal = env.palette;
    pullBack(ctx, 0.16 * I * apartness(t), () => {
      for (const part of PARTS) {
        if (part.id === 'ribbon' && !p.ribbon) continue;
        const d = ORBIT[part.id];
        const u = win(t, 0.03 + d * 0.55, 0.86);
        const phi = TAU * ease(u);                                   // always one whole turn
        const r = 1 + (0.2 + 0.36 * I) * bump(u);
        const dx = part.c[0] - CENTRE[0], dy = part.c[1] - CENTRE[1];
        const cs = Math.cos(phi), sn = Math.sin(phi);
        const nx = CENTRE[0] + (dx * cs - dy * sn) * r, ny = CENTRE[1] + (dx * sn + dy * cs) * r;
        // upright, with a little sway from the swing of the wheel (lagging the turn)
        const sway = -0.22 * I * Math.sin(TAU * ease(win(t, 0.06 + d * 0.55, 0.86))) * bump(u);
        drawPart(ctx, part, pal, p, { x: nx - part.c[0], y: ny - part.c[1], rot: sway, scale: 1 - 0.14 * bump(u) }, null, 1, ease(u));   // the ribbon turns once: a whole turn is its rest
      }
    });
  }

  Motion.register({
    id: 'split',
    name: 'Split',
    idea: 'The 5 breaks into its parts (the bar, the stem, the bowl; the s; the ribbon), which fly apart as chips and come back together.',
    why: 'Split is "everything you kept, broken into its parts": the mark takes itself apart with curiosity, shows its pieces, and is whole again.',
    moments: ['split', 'bring'],
    styles: ['chips', 'burst', 'exploded', 'orbit'],
    params: {
      duration: { default: 900, min: 400, max: 2400, step: 50 },
      style: { default: 'chips', options: ['chips', 'burst', 'exploded', 'orbit'] },
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: false,

    draw(ctx, t, p, env) {
      const ease = M.easing(p.easing);
      const I = p.intensity;
      PARTS = env.palette.look ? LOOKS.look || (LOOKS.look = partsOf(true)) : LOOKS.classic;
      // in the look, the ends are the still mark itself
      if (env.palette.look && (t <= 0 || t >= 1)) { M.mark(ctx, { palette: env.palette, weight: p.weight, ribbon: p.ribbon }); return; }
      if (p.style === 'burst') burst(ctx, t, p, env, I, ease);
      else if (p.style === 'exploded') exploded(ctx, t, p, env, I, ease);
      else if (p.style === 'orbit') orbit(ctx, t, p, env, I, ease);
      else chips(ctx, t, p, env, I, ease);
    }
  });
})();

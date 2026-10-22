/* 5s Motion Lab: Pulse, the reference family.
 *
 * The mark breathes: it swells and settles while its colour flows along the strokes, a heartbeat
 * for waiting (load, empty). It is written to show the other families the pattern:
 *
 *  - one Motion.register({...}) call in an IIFE; nothing global but what Marks and Motion give
 *  - draw(ctx, t, p, env) is pure: the frame is a function of t, p and env only (no clock, no
 *    Math.random; env.rng is there, freshly seeded per frame, if a family needs chance)
 *  - ctx arrives already in mark space (1000 x 1000, y down, background filled by Motion.render)
 *  - a loop (loop: true) is periodic: everything is built from functions with f(0) = f(1), so
 *    t = 1 is the rest pose and the frame at t = 0; a one-shot ends crisp and centred at t = 1
 *  - the shared options are honoured: p.palette (via env.palette), p.ribbon, p.weight (stroke
 *    scale), p.intensity (how big the gesture is), p.easing (Marks.easing(name)); env.theme is
 *    already in env.palette
 *  - strokes are drawn with Marks.stroke (gradient ALONG the stroke, partial strokes with
 *    from/to, positioned stops [[u, '#hex'], ...]); the ribbon with Marks.ribbon; translucent
 *    groups through Marks.layer so their own overlaps do not darken
 *  - overlap and follow-through: the s and the ribbon run a little behind the 5 (p.lag)
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const A = M.anchors;

  // the strokes, resampled once (points() returns fresh arrays; these are never mutated)
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };

  const wrap = (x) => x - Math.floor(x);   // keep a lagged phase inside [0, 1) so loops stay seamless

  // scale (and turn) a drawing about a point in mark space
  function about(ctx, origin, scale, rotate, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    if (rotate) ctx.rotate(rotate);
    ctx.scale(scale, scale);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }

  /* breath curves: periodic in t, 0 at rest (t = 0 and t = 1), peak 1 */

  // breathe: a slow inhale, a short hold, a longer exhale
  function breath(t, ease) {
    if (t < 0.42) return ease(t / 0.42);
    if (t < 0.5) return 1;
    return 1 - ease((t - 0.5) / 0.5);
  }

  // heartbeat: a small gather (anticipation), a strong beat, a softer echo, then rest
  function beat(t, ease) {
    const pulse = (x, at, rise, fall) => {
      if (x < at || x > at + rise + fall) return 0;
      if (x < at + rise) return ease((x - at) / rise);
      return 1 - M.ease.inOutSine((x - at - rise) / fall);
    };
    const gather = Math.sin(Math.PI * M.clamp((t - 0.0) / 0.06, 0, 1));   // 0 -> 1 -> 0 over 0..0.06
    return Math.max(pulse(t, 0.06, 0.05, 0.2), 0.62 * pulse(t, 0.24, 0.05, 0.24)) - 0.18 * gather * (t < 0.06 ? 1 : 0);
  }

  // the current's route through the letters, as one continuous line where it can be: in at the bar's bright
  // tip, left along the bar (backwards: dir -1), down the stem and round the bowl, then the s from its top
  const ROUTE = [['bar', -1], ['body', 1], ['s', 1]];
  const LEN = ROUTE.map((r) => M.length(r[0]));
  const TOTAL = LEN.reduce((x, y) => x + y, 0);

  function letters(ctx, p, pal, o) {
    // o: {scale5, scaleS, tiltS, nestS: [dx, dy], weight, shift, glint, halo, haloWidth, blur}
    const k = p.weight * o.weight;
    const parts = [
      ['body', pal.body, M.widths.body],
      ['bar', pal.bar, M.widths.bar]
    ];
    about(ctx, A.letters, o.scale5, 0, (c) => {
      if (o.halo > 0.002) {   // a warm glow behind the letters on each beat: one translucent, blurred layer
        M.layer(c, { alpha: o.halo, blur: o.blur }, (h) => {
          for (const [name, , w] of parts) M.stroke(h, PTS[name], { width: w * k + o.haloWidth, colours: pal.five });
          about(h, A.s, o.scaleS, o.tiltS, (hs) => M.stroke(hs, PTS.s, { width: M.widths.s * k + o.haloWidth, colours: pal.five }));
        });
      }
      for (const [name, colours, w] of parts) {
        M.stroke(c, PTS[name], { width: w * k, colours, shift: o.shift });
        if (o.glint) glint(c, name, colours, w * k, o.glint);
      }
      const nest = o.nestS || [0, 0];
      c.save();
      c.translate(nest[0], nest[1]);
      about(c, A.s, o.scaleS, o.tiltS, (cs) => {
        M.stroke(cs, PTS.s, { width: M.widths.s * k, colours: pal.s, shift: o.shift * 0.8 });
        if (o.glint) glint(cs, 's', pal.s, M.widths.s * k, o.glint);
      });
      c.restore();
    });
  }

  // a travelling light: a partial stroke whose colours are the stroke's own, brightened by a smooth bump
  // (cos^2) around the light's centre, so it fades in and out with no edge, even where it runs off an end
  function glint(ctx, name, colours, width, g) {
    const i = ROUTE.findIndex((r) => r[0] === name), dir = ROUTE[i][1];
    const start = LEN.slice(0, i).reduce((x, y) => x + y, 0) / TOTAL, span = LEN[i] / TOTAL;
    let centre = (g.pos - start) / span;               // the light's centre in this stroke's own u
    if (dir < 0) centre = 1 - centre;
    const half = g.len / span / 2;
    const a = Math.max(0, centre - half), b = Math.min(1, centre + half);
    if (b <= a + 1e-4) return;
    const stops = [];
    for (let k = 0; k <= 10; k++) {
      const u = M.lerp(a, b, k / 10), d = (u - centre) / half;
      const w = Math.abs(d) >= 1 ? 0 : Math.cos((Math.PI / 2) * d) ** 2;
      stops.push([u, M.mix(M.colourAt(colours, u), g.light, g.strength * w)]);
    }
    M.stroke(ctx, PTS[name], { width, from: a, to: b, colours: stops });
  }

  Motion.register({
    id: 'pulse',
    name: 'Pulse',
    idea: 'The mark breathes: it swells and settles while its colour flows along the strokes, the s a beat behind the 5.',
    why: 'Waiting with a pulse: while the deck loads, or a page is still empty, the mark is alive and patient, a held breath before five quick judgments.',
    moments: ['load', 'empty'],
    styles: ['breathe', 'heartbeat', 'current'],
    params: {
      duration: { default: 2600, min: 800, max: 6000, step: 100 },   // one breath (the loop's period), ms
      style: { default: 'breathe', options: ['breathe', 'heartbeat', 'current'] },
      flow: { default: 0.5, min: 0, max: 1, step: 0.05 },             // how far the colour travels along the strokes
      lag: { default: 0.06, min: 0, max: 0.2, step: 0.01 },           // how far the s and the ribbon trail the 5
      frame: { default: false },                                      // draw the logo's rounded square too
      easing: { default: 'inOutSine', options: M.EASES.slice() },     // a shared option with this family's default
      intensity: { default: 0.5, min: 0, max: 1, step: 0.05 }
    },
    reduced: 'still',
    loop: true,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity;
      const t5 = t, tS = wrap(t - p.lag), tR = wrap(t - 2 * p.lag);   // overlap: the s and the ribbon follow

      let o, ribbonT, ribbonScale, ribbonAlpha = 1;
      if (p.style === 'heartbeat') {
        const b5 = beat(t5, ease), bS = beat(tS, ease), bR = beat(tR, ease), bH = beat(wrap(t - 0.5 * p.lag), ease);
        o = {
          scale5: 1 + 0.075 * I * b5, scaleS: 1 + 0.05 * I * bS, tiltS: -0.05 * I * (b5 - bS),
          weight: 1 + 0.04 * I * b5, shift: 0.12 * p.flow * Math.max(0, b5),
          // the glow blooms just after each beat and fades with it
          halo: 0.6 * I * Math.max(0, bH), haloWidth: 40 + 70 * Math.max(0, bH), blur: (18 + 26 * Math.max(0, bH)) * env.scale * env.dpr
        };
        ribbonT = 0.05 * I * bR;
        ribbonScale = 1 + 0.06 * I * bR;
        ribbonAlpha = 0.85 + 0.15 * Math.max(0, bR);
      } else if (p.style === 'current') {
        // a light runs through the strokes in the order a hand writes them, then rests
        const run = M.clamp(t / 0.78, 0, 1);
        const pos = -0.12 + 1.24 * ease(run);
        const swell = 0.5 - 0.5 * Math.cos(TAU * t);
        o = {
          scale5: 1 + 0.018 * I * swell, scaleS: 1, tiltS: 0, weight: 1, shift: 0,
          halo: 0, haloWidth: 0,
          glint: { pos, len: 0.1 + 0.16 * p.flow, light: '#FFF3DA', strength: 0.3 + 0.45 * I }
        };
        // the ribbon turns a little as the light passes behind the s, and settles back
        ribbonT = 0.14 * I * Math.sin(Math.PI * M.clamp((t - 0.45) / 0.55, 0, 1)) ** 2;
        ribbonScale = 1;
      } else {   // breathe
        const b5 = breath(t5, ease), bS = breath(tS, ease), bR = breath(tR, ease);
        o = {
          scale5: 1 + 0.09 * I * b5, scaleS: 1 + 0.05 * I * bS, tiltS: -0.08 * I * (b5 - bS),
          nestS: [-16 * I * bS, -8 * I * bS],   // on the inhale the s settles into the bowl, on the exhale it lets go
          weight: 1 + 0.07 * I * b5, shift: 0.12 * p.flow * b5, halo: 0, haloWidth: 0
        };
        ribbonT = 0.09 * I * bR;
        ribbonScale = 1 + 0.07 * I * bR;
      }

      if (p.frame) M.stroke(ctx, M.points('frame', 256), { width: M.widths.frame * p.weight, colours: pal.frame });
      if (p.ribbon) {   // the ribbon rides the letters' breath and adds its own, a little later
        about(ctx, A.letters, o.scale5, 0, (c) =>
          about(c, A.bowl, ribbonScale, 0, (cr) => M.ribbon(cr, ribbonT, { colours: pal.ribbon, alpha: ribbonAlpha })));
      }
      letters(ctx, p, pal, o);
    }
  });
})();

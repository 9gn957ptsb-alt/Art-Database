/* 5s Motion Lab: Fill (Gesture & judgment).
 *
 * The letters are glass: an empty outline at first, then colour rises inside them like a level, from the
 * bottom of the bowl, with a bright meniscus on its surface. A keep fills the mark (a small yes, warmth);
 * a streak fills it day by day; a wait is a tide that ebbs and comes back.
 *
 * Styles
 *   level   one calm rise from the bottom of the bowl; the surface tilts as it climbs and settles flat
 *   pour    colour pours in at the bar's bright tip, runs along the bar and down the stem, and pools
 *           into a level that fills the bowl and the s
 *   steps   five rises, one for each day in a row, each with a small slosh and a flash at its rim
 *   tide    starts full, ebbs to half with a rolling surface and floods back (t = 0 and t = 1 are both
 *           the full mark, so it loops cleanly while the deck loads)
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only (bubbles come from env.rng, reseeded every
 * frame); t = 1 is the still mark.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };
  const BOTTOM = 905, TOP = 150;          // the level's travel: just under the lowest ink, just over the bar
  const BOWL_X = 360;                     // the surface tilts about the bowl

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);

  function letters(c, p, pal, widthAdd, colour) {
    const k = p.weight;
    const col = (stops) => (colour ? colour : stops);
    M.stroke(c, PTS.body, { width: M.widths.body * k + widthAdd, colours: col(pal.body) });
    M.stroke(c, PTS.bar, { width: M.widths.bar * k + widthAdd, colours: col(pal.bar) });
    M.stroke(c, PTS.s, { width: M.widths.s * k + widthAdd, colours: col(pal.s) });
  }
  function ribbon(c, p, pal, rt, alpha) { if (p.ribbon) M.ribbon(c, rt, { colours: pal.ribbon, alpha }); }
  function still(ctx, p, pal) { ribbon(ctx, p, pal, 0, 1); letters(ctx, p, pal, 0); }

  // the liquid's surface across the view: y = level + tilt (about the bowl) + a travelling wave
  function surface(env, y, tilt, amp, phase) {
    const v = env.view, pts = [];
    const x0 = v.x0 - 40, x1 = v.x1 + 40, n = 40;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push([x, y + tilt * (x - BOWL_X) + amp * (Math.sin(x * 0.0105 + phase) * 0.7 + Math.sin(x * 0.023 - phase * 1.7) * 0.3)]);
    }
    return pts;
  }
  // fill everything below the surface (used with destination-in to cut a layer to the liquid)
  function below(c, env, pts) {
    c.fillStyle = "#000";
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.lineTo(pts[pts.length - 1][0], env.view.y1 + 60);
    c.lineTo(pts[0][0], env.view.y1 + 60);
    c.closePath();
    c.fill();
  }

  // the empty glass: a thin outline of the letters with a faint tint inside, and a ghost of the ribbon
  function vessel(ctx, p, pal, env, alpha) {
    if (alpha <= 0.002) return;
    const line = 9 / Math.max(0.6, p.weight * 0.5 + 0.5);
    const tone = pal.name === 'ink' || pal.name === 'paper' ? pal.ink : M.mix(M.colourAt(pal.body, 0.45), pal.bg, 0.25);
    if (p.ribbon) M.layer(ctx, { alpha: 0.2 * alpha }, (c) => M.ribbon(c, 0, { colours: pal.ribbon }));
    M.layer(ctx, { alpha: 0.13 * alpha }, (c) => letters(c, p, pal, 0));
    M.layer(ctx, { alpha: 0.75 * alpha, composite: 'source-over' }, (c) => {
      letters(c, p, pal, 0, tone);
      c.globalCompositeOperation = 'destination-out';
      letters(c, p, pal, -2 * line, '#000000');
    });
  }

  /* the liquid: the letters (and the ribbon) below the surface, then a bright meniscus just under the
   * surface and a few bubbles rising, both kept inside the letters */
  function liquid(ctx, p, pal, env, o) {
    const pts = surface(env, o.y, o.tilt, o.amp, o.phase);
    const light = pal.name === 'ink' ? pal.bg : M.mix(M.colourAt(pal.bar, 1), '#FFFFFF', 0.55);
    // composite 'source-over' forces a real scratch layer (alpha 1 alone would draw straight onto ctx)
    M.layer(ctx, { alpha: 1, composite: 'source-over' }, (c) => {
      ribbon(c, p, pal, o.rt || 0, 1);
      letters(c, p, pal, 0);
      c.globalCompositeOperation = 'destination-in';
      below(c, env, pts);
      c.globalCompositeOperation = 'source-over';
      if (o.stream) o.stream(c);   // the pour is whole wherever it has reached
    });
    if (o.rim > 0.002 || o.bubbles.length) {
      M.layer(ctx, { alpha: Math.min(1, 0.85 * Math.max(o.rim, 0.6)), composite: 'source-over' }, (c) => {
        c.lineJoin = 'round'; c.lineCap = 'round';
        if (o.rim > 0.002) {
          c.save();
          c.globalAlpha = Math.min(1, o.rim);
          c.strokeStyle = light; c.lineWidth = 20;
          c.beginPath();
          pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1] + 10) : c.moveTo(q[0], q[1] + 10)));
          c.stroke();
          c.restore();
        }
        c.fillStyle = light;
        for (const b of o.bubbles) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, TAU); c.fill(); }
        c.globalCompositeOperation = 'destination-in';
        below(c, env, pts);
        // and only inside the letters: their union as one mask, composited once
        M.layer(c, { composite: 'destination-in' }, (m) => letters(m, p, pal, -10, '#000000'));
      });
    }
  }

  Motion.register({
    id: 'fill',
    name: 'Fill',
    idea: 'The letters are glass: colour rises inside them like a level, from the bottom of the bowl, with a bright meniscus on its surface.',
    why: 'A keep adds to you. The mark fills up the way a person\'s database does, one judgment at a time; a streak fills it day by day, and a wait is a tide that always comes back.',
    moments: ['keep', 'streak', 'load'],
    styles: ['level', 'pour', 'steps', 'tide'],
    params: {
      duration: { default: 700, min: 300, max: 4000, step: 50 },
      style: { default: 'level', options: ['level', 'pour', 'steps', 'tide'] },
      wave: { default: 0.5, min: 0, max: 1, step: 0.05 },       // how much the surface moves
      bubbles: { default: true },
      easing: { default: 'inOutSine', options: M.EASES.slice() }   // a level that starts and stops softly
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      if (t >= 1) { still(ctx, p, pal); return; }
      const I = p.intensity, W = p.wave, e = M.easing(p.easing);
      let lvl, tilt, amp, phase = TAU * 1.6 * t, rim = 1, stream = null, vesselA = 1, flash = 0;

      if (p.style === 'pour') {
        // the stream: along the bar from its tip (0..0.24), down the stem (0.18..0.36); the level after
        const xb = M.ease.inOutSine(seg(t, 0, 0.24)), xs = M.ease.inQuad(seg(t, 0.17, 0.36));
        const sw = 0.5 + 0.2 * I;
        stream = (c) => {
          if (xb > 0) M.stroke(c, PTS.bar, { width: M.widths.bar * p.weight * sw, colours: pal.bar, from: 1 - xb, to: 1 });
          if (xs > 0) M.stroke(c, PTS.body, { width: M.widths.body * p.weight * sw, colours: pal.body, from: 0, to: 0.36 * xs });
        };
        const xl = seg(t, 0.3, 1);
        lvl = e(xl);
        tilt = (0.06 + 0.1 * I) * W * Math.sin(TAU * 1.2 * xl) * Math.exp(-2.2 * xl);
        amp = (6 + 16 * I) * W * (1 - xl) * M.smoothstep(0, 0.1, xl);
      } else if (p.style === 'steps') {
        // five rises, one per day; each settles before the next
        lvl = 0; flash = 0; tilt = 0;
        for (let i = 0; i < 5; i++) {
          const a = 0.02 + i * 0.18, x = seg(t, a, a + 0.15);
          lvl += e(x) / 5;
          const after = seg(t, a + 0.06, a + 0.3);
          tilt += (i % 2 ? -1 : 1) * (0.04 + 0.08 * I) * W * Math.sin(TAU * after) * (1 - after) * (x > 0 ? 1 : 0);
          flash = Math.max(flash, Math.sin(Math.PI * seg(t, a + 0.08, a + 0.26)));
        }
        amp = (4 + 10 * I) * W * (1 - seg(t, 0.85, 1));
        rim = 0.7 + 0.6 * flash;
      } else if (p.style === 'tide') {
        // full -> ebb (to about half) -> flood back, with the surface rolling all the while
        const depth = 0.38 + 0.3 * I;
        const ebb = M.ease.inOutSine(seg(t, 0, 0.48)), flood = e(seg(t, 0.48, 1));
        lvl = 1 - depth * ebb * (1 - flood);
        tilt = (0.05 + 0.08 * I) * W * Math.sin(TAU * t) * Math.sin(Math.PI * t);
        amp = (8 + 18 * I) * W * Math.sin(Math.PI * t);
        phase = TAU * 2 * t;
        vesselA = M.smoothstep(0, 0.2, t) * (1 - M.smoothstep(0.8, 1, t));
      } else {   // level
        const x = seg(t, 0, 0.9);
        lvl = e(x);
        tilt = (0.05 + 0.12 * I) * W * Math.sin(TAU * 1.25 * x) * Math.exp(-2.4 * x);
        amp = (6 + 18 * I) * W * (1 - x) * M.smoothstep(0, 0.08, x);
      }
      // the surface settles flat at the top; overshoot (outBack, spring...) is let through as a slosh
      const y = M.lerp(BOTTOM, TOP - 30, lvl) - 90 * M.smoothstep(0.9, 1, t);
      tilt *= 1 - M.smoothstep(0.85, 1, t);
      amp *= 1 - M.smoothstep(0.85, 1, t);

      // bubbles: a few rising through the liquid (deterministic: env.rng is reseeded each frame)
      const bubbles = [];
      if (p.bubbles) {
        const n = Math.round(4 + 8 * I);
        for (let i = 0; i < n; i++) {
          const bx = 120 + 780 * env.rng(), sp = 0.6 + 0.8 * env.rng(), ph = env.rng(), r = 7 + 9 * env.rng();
          const life = (ph + t * sp) % 1;
          const by = M.lerp(BOTTOM - 20, y + 30, life) + 10 * Math.sin(TAU * (life * 2 + ph));
          const show = Math.sin(Math.PI * life) * (1 - M.smoothstep(0.8, 1, t));
          if (show > 0.05 && by > y + 20) bubbles.push([bx + 12 * Math.sin(TAU * (life + ph)), by, r * show]);
        }
      }

      vessel(ctx, p, pal, env, vesselA * (1 - M.smoothstep(0.75, 1, lvl)) * (1 - M.smoothstep(0.9, 1, t)));
      liquid(ctx, p, pal, env, { y, tilt, amp, phase, rim: rim * (1 - M.smoothstep(0.85, 1, t)), bubbles, stream, rt: 0.06 * Math.sin(Math.PI * t) * I });
    }
  });
})();

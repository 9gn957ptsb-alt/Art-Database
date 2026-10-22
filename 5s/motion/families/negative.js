/* 5s Motion Lab: Negative (Gesture & judgment).
 *
 * The mark is cut out of a field of colour: at first it exists only as negative space, paper showing
 * through a tile of the logo's blue. Then the field goes, and the hole is what is left: the letters take
 * their colour where the field has been. "It's a lot easier to see the negative space when there's a big
 * object in the room" (CONCEPT.md); a pass is subtraction, and what you pass shapes you too.
 *
 * env.direction: the field leaves to the left for a pass (the default for 'right' mirrors it).
 *
 * Styles
 *   slide   the field gives a small push the other way, then slides off; behind its trailing edge the
 *           letters colour in, like ink catching where a stencil lifts
 *   lift    the field is lifted off like a sheet of paper: it swells toward you, turns a little and
 *           clears, its holes drifting off the letters as the mark comes up underneath
 *   iris    the holes open outward from the letters until the field is only a band at the edge: the
 *           field becomes the logo's frame and the mark is left inside it
 *   sweep   the mark is there, a field passes across it (inverting it to negative space as it goes)
 *           and leaves it as it was: t = 0 and t = 1 are the same, so it loops for an empty state
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only; t = 1 is the still mark (with the frame for
 * iris, where the field has become it).
 */
(function () {
  'use strict';
  const M = Marks;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };
  const FRAME = M.points('frame', 256);

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const antic = (x) => (x <= 0 || x >= 1 ? 0 : 6.75 * x * (1 - x) * (1 - x));

  function letters(c, p, pal, widthAdd, colour) {
    const k = p.weight;
    M.stroke(c, PTS.body, { width: M.widths.body * k + widthAdd, colours: colour || pal.body });
    M.stroke(c, PTS.bar, { width: M.widths.bar * k + widthAdd, colours: colour || pal.bar });
    M.stroke(c, PTS.s, { width: M.widths.s * k + widthAdd, colours: colour || pal.s });
  }
  function ribbon(c, p, pal, rt, alpha) { if (p.ribbon) M.ribbon(c, rt || 0, { colours: pal.ribbon, alpha: alpha == null ? 1 : alpha }); }
  function mark(c, p, pal, rt) { ribbon(c, p, pal, rt, 1); letters(c, p, pal, 0); }
  function frameStroke(c, p, pal) { M.stroke(c, FRAME, { width: M.widths.frame * p.weight, colours: pal.frame }); }

  function rounded(c, x0, y0, x1, y1, r) {
    c.beginPath();
    c.moveTo(x0 + r, y0);
    c.lineTo(x1 - r, y0); c.arcTo(x1, y0, x1, y0 + r, r);
    c.lineTo(x1, y1 - r); c.arcTo(x1, y1, x1 - r, y1, r);
    c.lineTo(x0 + r, y1); c.arcTo(x0, y1, x0, y1 - r, r);
    c.lineTo(x0, y0 + r); c.arcTo(x0, y0, x0 + r, y0, r);
    c.closePath();
  }

  // the field's colour: the logo's frame (blue to violet), a judgment's (cobalt for a pass, ember for a keep), or ink
  function fieldPaint(c, p, pal, dir) {
    let stops;
    if (p.field === 'judgment') stops = dir < 0 ? [M.mix(pal.cobalt, '#FFFFFF', 0.12), pal.cobalt, M.mix(pal.cobalt, pal.iris, 0.5)] : [M.mix(pal.ember, '#FFD27A', 0.3), pal.ember, pal.flare];
    else if (p.field === 'ink' || pal.name === 'ink' || pal.name === 'paper') stops = [pal.ink, pal.ink];
    else stops = [M.colourAt(pal.frame, 0.05), M.colourAt(pal.frame, 0.32), M.colourAt(pal.frame, 0.45), M.colourAt(pal.frame, 0.7)];
    const g = c.createLinearGradient(80, 60, 940, 960);
    stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
    return g;
  }

  // the field: the logo's tile filled with colour, the letters cut out of it (at their place in the mark)
  // f: {x, y, r, k, alpha, holes: {x, y, r, k}} the field's own move, and the holes' (by default the field's)
  function field(ctx, p, pal, dir, f) {
    if (f.alpha <= 0.002) return;
    M.layer(ctx, { alpha: f.alpha, composite: 'source-over' }, (c) => {
      c.save();
      c.translate(500 + f.x, 500 + f.y); c.rotate(f.r || 0); c.scale(f.k, f.k); c.translate(-500, -500);
      c.fillStyle = fieldPaint(c, p, pal, dir);
      rounded(c, 0, 0, 1000, 1000, 256);
      c.fill();
      c.restore();
      c.globalCompositeOperation = 'destination-out';
      const h = f.holes || f;
      c.save();
      c.translate(500 + h.x, 500 + h.y); c.rotate(h.r || 0); c.scale(h.k, h.k); c.translate(-500, -500);
      letters(c, p, pal, f.grow || 0, '#000000');
      c.restore();
    });
  }

  // the mark, kept only on the far side of a vertical edge (soft over `soft` units): where the field has gone
  function markBehind(ctx, p, pal, edge, side, soft, rt) {
    M.layer(ctx, { alpha: 1, composite: 'source-over' }, (c) => {
      mark(c, p, pal, rt);
      c.globalCompositeOperation = 'destination-in';
      const g = c.createLinearGradient(edge, 0, edge + side * soft, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = g;
      c.fillRect(-2000, -2000, 5000, 5000);
    });
  }

  function slide(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const v = env.view, span = v.x1 - v.x0;
    // hold, a push the other way, then away (accelerating), out of the frame by t = 0.72
    const x = seg(t, 0.05, 0.68);
    const q = 0.75 * M.ease.inCubic(x) + 0.25 * M.ease.inQuad(x) - (0.035 + 0.045 * I) * antic(Math.min(1, x * 1.5));
    const D = span + 260;
    const fx = dir * q * D;
    const lean = dir * (0.02 + 0.05 * I) * M.ease.inQuad(x);
    // the trailing edge (the field's far side, the one the letters see last)
    const edge = dir < 0 ? 1000 + fx : fx;
    const settle = seg(t, 0.5, 1);
    const pop = 1 + (0.025 + 0.03 * I) * Math.sin(Math.PI * e(settle)) * (1 - settle);
    M.layer(ctx, { alpha: 1, composite: 'source-over' }, (c) => {
      c.save();
      c.translate(505, 495); c.scale(pop, pop); c.translate(-505, -495);
      markBehind(c, p, pal, edge, -dir, 160 + 60 * I, 0.1 * I * (1 - e(settle)));
      c.restore();
    });
    field(ctx, p, pal, dir, { x: fx, y: -30 * I * M.ease.inQuad(x), r: lean, k: 1, alpha: 1, holes: { x: 0, y: 0, r: 0, k: 1 } });
  }

  function lift(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    // the sheet is peeled up toward you and carried off: it swells, turns, rises and leaves the frame
    const x = seg(t, 0.04, 0.62);
    const up = M.ease.inCubic(x) * 0.8 + M.ease.inQuad(x) * 0.2;
    const k = 1 + (0.5 + 0.6 * I) * up - 0.03 * antic(x);
    const r = dir * (0.08 + 0.16 * I) * up;
    const fx = dir * (260 + 260 * I) * up, fy = -(380 + 200 * I) * up + 12 * antic(x);
    const alpha = 1 - M.smoothstep(0.7, 1, x);
    // the mark underneath: there as soon as the sheet moves, settling up into place as it clears
    const m = seg(t, 0.06, 0.95);
    const ma = M.smoothstep(0, 0.12, m), mk = 0.95 + 0.05 * e(seg(m, 0.15, 1));
    if (ma > 0) {
      M.layer(ctx, { alpha: ma }, (c) => {
        c.save(); c.translate(505, 495); c.scale(mk, mk); c.translate(-505, -495);
        mark(c, p, pal, -0.12 * I * (1 - e(m)));
        c.restore();
      });
    }
    // the sheet's shadow on the mark, softer and further off as it rises
    if (alpha > 0.01 && up > 0.005) {
      M.layer(ctx, { alpha: 0.22 * alpha * (1 - 0.6 * up), blur: (8 + 30 * up) * env.scale * env.dpr }, (c) => {
        c.save(); c.translate(500 + fx * 0.6, 500 + fy * 0.6 + 50 * up); c.rotate(r * 0.8); c.scale(1 + (k - 1) * 0.6, 1 + (k - 1) * 0.6); c.translate(-500, -500);
        c.fillStyle = pal.name === 'paper' ? '#000' : pal.ink; rounded(c, 0, 0, 1000, 1000, 256); c.fill(); c.restore();
      });
    }
    field(ctx, p, pal, dir, { x: fx, y: fy, r, k, alpha });
  }

  function iris(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0.08, 0.9);
    const g = Math.pow(e(x), 1.8);
    const grow = (820 + 200 * I) * g - (16 + 24 * I) * antic(Math.min(1, x * 2.5));   // a small tighten first
    // the mark inside the opening: it gathers colour as the hole widens
    const ma = M.smoothstep(2, 70, grow);
    if (ma > 0) M.layer(ctx, { alpha: ma }, (c) => mark(c, p, pal, 0.12 * I * (1 - e(x))));
    // the field: the opening is cut out of it inside the frame's inner edge; the band at the edge stays
    const band = M.widths.frame * p.weight;
    const fa = 1 - M.smoothstep(0.75, 1, x);   // the band hands over to the logo's own frame
    if (fa > 0.002) {
      M.layer(ctx, { alpha: fa, composite: 'source-over' }, (c) => {
        c.fillStyle = fieldPaint(c, p, pal, dir);
        rounded(c, 0, 0, 1000, 1000, 256);
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        c.save();
        rounded(c, band, band, 1000 - band, 1000 - band, 256 - band);
        c.clip();
        letters(c, p, pal, Math.max(0, grow), '#000000');
        c.restore();
      });
    }
    const frameA = M.smoothstep(0.35, 0.9, x);
    if (frameA > 0) M.layer(ctx, { alpha: frameA }, (c) => frameStroke(c, p, pal));
  }

  function sweep(ctx, t, p, env, pal, dir) {
    const I = p.intensity, e = M.easing(p.easing);
    const v = env.view;
    // a band of field, as wide as the tile, crosses from one side to the other
    const x = M.ease.inOutSine(seg(t, 0.05, 0.95));
    // the logo's tile passes across: halfway, it sits exactly on the mark and the mark is all negative space
    const startX = dir < 0 ? v.x1 + 40 : v.x0 - 1040;
    const endX = dir < 0 ? v.x0 - 1040 : v.x1 + 40;
    const fx = x < 0.5 ? M.lerp(startX, 0, 1 - Math.pow(1 - 2 * x, 1.6)) : M.lerp(0, endX, Math.pow(2 * x - 1, 1.6));
    const fy = -(20 + 40 * I) * Math.sin(Math.PI * x) * (x < 0.5 ? -1 : 1) * Math.abs(Math.sin(2 * Math.PI * x));
    const tilt = dir * (0.03 + 0.05 * I) * Math.sin(2 * Math.PI * x);
    const tile = (c) => { c.translate(500 + fx, 500 + fy); c.rotate(tilt); c.translate(-500, -500); rounded(c, 0, 0, 1000, 1000, 256); };
    // the mark is whole except where the tile is; there, it is a hole in the tile
    M.layer(ctx, { alpha: 1, composite: 'source-over' }, (c) => {
      mark(c, p, pal, 0.1 * I * Math.sin(Math.PI * x));
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000';
      c.save(); tile(c); c.fill(); c.restore();
    });
    M.layer(ctx, { alpha: 1, composite: 'source-over' }, (c) => {
      c.save();
      tile(c);
      c.fillStyle = fieldPaint(c, p, pal, dir);
      c.fill();
      c.restore();
      c.globalCompositeOperation = 'destination-out';
      // the hole bulges slightly where the band is, as if the letters were pressed through it
      const k = 1 + (0.02 + 0.03 * I) * Math.sin(Math.PI * x);
      c.save(); c.translate(505, 495); c.scale(k, k); c.translate(-505, -495);
      letters(c, p, pal, 0, '#000000');
      c.restore();
    });
  }

  Motion.register({
    id: 'negative',
    name: 'Negative',
    idea: 'The mark is cut out of a field of colour; the field slides away and leaves the hole, and the letters take their colour where it has been.',
    why: 'A pass is subtraction, and 5s is "a game of subtraction and negation": what you let go of shapes you as much as what you keep, the way the negative space shows the room.',
    moments: ['pass', 'empty'],
    styles: ['slide', 'lift', 'iris', 'sweep'],
    params: {
      duration: { default: 650, min: 300, max: 4000, step: 50 },
      style: { default: 'slide', options: ['slide', 'lift', 'iris', 'sweep'] },
      field: { default: 'frame', options: ['frame', 'judgment', 'ink'] },   // the field's colour
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const dir = env.direction === 'left' ? -1 : 1;
      if (t >= 1) {
        if (p.style === 'iris') { mark(ctx, p, pal, 0); frameStroke(ctx, p, pal); }
        else mark(ctx, p, pal, 0);
        return;
      }
      if (p.style === 'lift') lift(ctx, t, p, env, pal, dir);
      else if (p.style === 'iris') iris(ctx, t, p, env, pal, dir);
      else if (p.style === 'sweep') sweep(ctx, t, p, env, pal, dir);
      else slide(ctx, t, p, env, pal, dir);
    }
  });
})();

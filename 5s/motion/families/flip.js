/* 5s Motion Lab: Flip (Gesture & judgment).
 *
 * The turn, literally. In 5s a turn is the moment a person goes against their own pattern ("that's where
 * real transformation happens", CONCEPT.md), the biggest moment in the app. Here the mark turns over in
 * 3-D about an axis with the 5's own forward lean; its back is the turn's violet; the ribbon, which is not
 * part of the plate, passes through the letters as they turn, half in front and half behind, twisting.
 *
 * The plate is drawn with the canvas transform (a squash across the leaning axis, so the strokes
 * foreshorten like a flat sheet), a little perspective per letter (the near side swells), a thickness
 * (an extruded edge, so it never vanishes edge-on) and a sheen that crosses it as it turns.
 *
 * Styles
 *   turn     a wind-up the other way, then one full turn (or `turns`), landing a touch past and back
 *   reveal   it starts face down, its violet back to you (mirrored), lifts and turns over to show the mark
 *   tumble   the 5 turns about its lean while the s falls on its back (about its baseline) a beat later
 *            and springs up again; the ribbon threads between them
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only; t = 1 is the still mark, facing you.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  // the turn accelerates out of its wind-up (an ease-in) and the user's easing shapes how it lands
  const inSine = (x) => 1 - Math.cos((Math.PI / 2) * M.clamp(x, 0, 1));
  const antic = (x) => (x <= 0 || x >= 1 ? 0 : 6.75 * x * (1 - x) * (1 - x));
  const PHI = Math.atan2(260, -151);                     // the stem's lean: the axis of the turn
  const FOCAL = 3000;                                    // the camera's distance, for perspective

  function still(ctx, p, pal) {
    if (p.ribbon) M.ribbon(ctx, 0, { colours: pal.ribbon });
    drawPart(ctx, p, 'five', pal); drawPart(ctx, p, 's', pal);
  }
  function drawPart(c, p, part, cols) {
    if (part === 'five') {
      M.stroke(c, PTS.body, { width: M.widths.body * p.weight, colours: cols.body });
      M.stroke(c, PTS.bar, { width: M.widths.bar * p.weight, colours: cols.bar });
    } else M.stroke(c, PTS.s, { width: M.widths.s * p.weight, colours: cols.s });
  }
  const one = (c) => ({ body: c, bar: c, s: c });

  // the mark's other side: the turn's violet (or the logo's colours when the palette is already the turn's)
  function backOf(pal, theme) {
    if ((pal.base || pal.name) === 'ink' || (pal.base || pal.name) === 'paper') return one(M.mix(pal.ink, pal.bg, 0.45));
    return M.palette((pal.base || pal.name) === 'turn' ? 'logo' : 'turn', theme, pal.iteration);   // (a look palette: the same look's)
  }

  /* one letter as a turned slab.
   * o: a point on the axis, phi: the axis direction, th: the turn (0 = facing you), lift: extra depth toward
   * you (the whole plate rising as it turns). The front face is drawn with the palette, the back with backOf.
   */
  function slab(ctx, p, env, pal, part, o, phi, th, lift, centre) {
    const cs = Math.cos(th), sn = Math.sin(th);
    const csC = (cs < 0 ? -1 : 1) * Math.max(0.035, Math.abs(cs));
    const n = [-Math.sin(phi), Math.cos(phi)];
    const d = (centre[0] - o[0]) * n[0] + (centre[1] - o[1]) * n[1];   // the letter's distance from the axis
    const z = d * sn + lift;                                           // its depth toward the camera
    const k = FOCAL / (FOCAL - z);
    const front = cs >= 0;
    const face = front ? pal : backOf(pal, env.theme);
    const thick = 34 * p.weight;
    const off = thick * sn;   // the screen offset between the two faces, across the axis
    const squash = (c, shift) => {
      c.translate(o[0] + n[0] * shift, o[1] + n[1] * shift);
      c.scale(k, k);
      c.rotate(phi); c.scale(1, csC); c.rotate(-phi);
      c.translate(-o[0], -o[1]);
    };
    // the edge: the slab's side, as copies stepping from the far face to the near one, in a deep tone
    if (Math.abs(off) > 0.5) {
      // the side is the face's deepest colour, a little darker: a solid candy edge, not a grey one
      const deep = M.colourAt(part === 's' ? face.s : face.body, 0.92);
      const edge = M.mix(deep, env.theme === 'dark' ? '#000000' : '#3A0D2E', 0.22);
      // enough copies that they touch even when the face is seen edge-on (each copy is then a hairline)
      const w = (part === 's' ? M.widths.s : M.widths.body) * p.weight * Math.abs(csC) * k;
      const steps = Math.min(22, Math.max(2, Math.ceil(Math.abs(off) / Math.max(1.5, 0.6 * w))));
      for (let j = 0; j < steps; j++) {
        const f = -0.5 + j / steps;
        ctx.save(); squash(ctx, off * f); drawPart(ctx, p, part, one(edge)); ctx.restore();
      }
    }
    // the near face, shaded as it turns away and crossed by a sheen
    const dark = 0.26 * (1 - Math.abs(cs));
    const glint = Math.pow(Math.max(0, Math.sin(2 * th)), 6) * (0.45 + 0.3 * p.intensity);
    const plain = dark < 0.01 && glint < 0.01;
    M.layer(ctx, plain ? { alpha: 1 } : { alpha: 1, composite: 'source-over' }, (c) => {
      c.save(); squash(c, off * 0.5); drawPart(c, p, part, face); c.restore();
      if (plain) return;
      c.globalCompositeOperation = 'source-atop';
      if (dark > 0.01) { c.fillStyle = M.rgba(env.theme === 'dark' ? '#000000' : '#3A0D2E', dark); c.fillRect(-2000, -2000, 5000, 5000); }
      if (glint > 0.01) {
        // a soft band of light across the letter, parallel to the axis, travelling as it turns
        const pos = 520 * Math.cos(th) * (front ? 1 : -1), cx = o[0] + n[0] * pos, cy = o[1] + n[1] * pos;
        const g = c.createLinearGradient(cx - n[0] * 240, cy - n[1] * 240, cx + n[0] * 240, cy + n[1] * 240);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, M.rgba('#FFFFFF', glint)); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(-2000, -2000, 5000, 5000);
      }
    });
  }

  // the ribbon threading the plate: the part the plate is in front of is drawn first, the rest after it
  function ribbonThrough(ctx, p, pal, o, phi, th, rt, behind) {
    if (!p.ribbon) return;
    const n = [-Math.sin(phi), Math.cos(phi)], sn = Math.sin(th), eps = 120;   // the ribbon sits a little behind the plate
    // in front where the plate's depth d * sin(th) is below the ribbon's own (-eps): d * sn < -eps
    const draw = (c, inFront) => {
      c.save();
      if (Math.abs(sn) > 1e-3) {
        const dB = -eps / sn;   // the boundary's distance from the axis
        const sideFront = sn > 0 ? -1 : 1;   // the side (sign of d - dB) where the ribbon is in front
        const side = inFront ? sideFront : -sideFront;
        const px = o[0] + n[0] * dB, py = o[1] + n[1] * dB, ux = Math.cos(phi), uy = Math.sin(phi), B = 4000;
        c.beginPath();
        c.moveTo(px + ux * B, py + uy * B); c.lineTo(px - ux * B, py - uy * B);
        c.lineTo(px - ux * B + side * n[0] * B, py - uy * B + side * n[1] * B);
        c.lineTo(px + ux * B + side * n[0] * B, py + uy * B + side * n[1] * B);
        c.closePath(); c.clip();
      } else if (inFront) { c.restore(); return; }
      M.ribbon(c, rt, { colours: pal.ribbon });
      c.restore();
    };
    if (behind) draw(ctx, false); else draw(ctx, true);
  }

  function turnStyle(ctx, t, p, env, pal, reveal) {
    const I = p.intensity, e = M.easing(p.easing);
    const o = A.letters, phi = PHI;
    const x = seg(t, 0, 0.94);
    let th, lift;
    if (reveal) {
      // face down, a lift toward you (and a small dip back first), then over
      const m = e(inSine(seg(x, 0.14, 1)));
      th = Math.PI * (1 + m) + (0.12 + 0.12 * I) * antic(Math.min(1, x / 0.3));
      lift = (60 + 100 * I) * Math.sin(Math.PI * Math.min(1, x / 0.9)) * (1 - 0.3 * m);
    } else {
      const turns = Math.round(p.turns);
      const wind = (0.2 + 0.25 * I) * M.smoothstep(0, 0.14, x);
      const m = e(inSine(seg(x, 0.12, 1)));
      th = -wind * (1 - m) + TAU * turns * m;
      lift = (40 + 90 * I) * Math.sin(Math.PI * M.clamp(seg(x, 0.1, 0.95), 0, 1));
    }
    const rt = M.ease.inOutSine(seg(t, 0.08, 0.95));   // the ribbon twists through once (a whole turn: it ends as it began)
    ribbonThrough(ctx, p, pal, o, phi, th, rt, true);
    const sn = Math.sin(th);
    // draw the far letter first: the one whose side of the axis is further from you
    const parts = [['five', A.five], ['s', A.s]];
    const n = [-Math.sin(phi), Math.cos(phi)];
    parts.sort((a, b) => ((a[1][0] - o[0]) * n[0] + (a[1][1] - o[1]) * n[1]) * sn - ((b[1][0] - o[0]) * n[0] + (b[1][1] - o[1]) * n[1]) * sn);
    for (const [part, centre] of parts) slab(ctx, p, env, pal, part, o, phi, th, lift, centre);
    ribbonThrough(ctx, p, pal, o, phi, th, rt, false);
  }

  function tumble(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0, 0.94);
    // the 5: a wind-up, then a full turn about its own lean
    const o5 = A.five;
    const wind = (0.2 + 0.2 * I) * M.smoothstep(0, 0.12, x);
    const m5 = e(inSine(seg(x, 0.1, 0.9)));
    const th5 = -wind * (1 - m5) + TAU * m5;
    const lift5 = (40 + 80 * I) * Math.sin(Math.PI * seg(x, 0.1, 0.85));
    // the s: falls back onto its back (about its baseline) as the 5 passes edge-on, and springs up after
    const oS = [A.s[0], 882 * 1], fall = seg(x, 0.2, 0.55), rise = seg(x, 0.5, 1);
    const thS = (Math.PI / 2) * (0.75 + 0.2 * I) * (M.ease.inCubic(fall) * (1 - e(rise)));   // top away from you
    const rt = M.ease.inOutSine(seg(t, 0.1, 0.95));
    // the ribbon threads the 5's turn; the s, lying back, is behind everything while it is down
    ribbonThrough(ctx, p, pal, o5, PHI, th5, rt, true);
    const sDown = Math.abs(thS) > 0.6;
    if (sDown) slab(ctx, p, env, pal, 's', oS, 0, thS, 0, A.s);
    slab(ctx, p, env, pal, 'five', o5, PHI, th5, lift5, A.five);
    ribbonThrough(ctx, p, pal, o5, PHI, th5, rt, false);
    if (!sDown) slab(ctx, p, env, pal, 's', oS, 0, thS, 0, A.s);
  }

  Motion.register({
    id: 'flip',
    name: 'Flip',
    idea: 'The mark turns over in 3-D about the 5\'s leaning axis: its back is the turn\'s violet, and the ribbon passes through the letters as they turn.',
    why: 'A turn is where a person goes against their own pattern, the moment the app exists for. The mark does what they did: it turns over, shows its other side for an instant, and comes back itself.',
    moments: ['turn'],
    styles: ['turn', 'reveal', 'tumble'],
    params: {
      duration: { default: 1500, min: 600, max: 4000, step: 50 },
      style: { default: 'turn', options: ['turn', 'reveal', 'tumble'] },
      turns: { default: 1, min: 1, max: 3, step: 1 },              // full turns for 'turn'
      easing: { default: 'outBack', options: M.EASES.slice() },     // how the turn lands: outBack goes a touch past and back
      intensity: { default: 0.6, min: 0, max: 1, step: 0.05 }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      if (t >= 1) { still(ctx, p, pal); return; }
      if (p.style === 'tumble') tumble(ctx, t, p, env, pal);
      else turnStyle(ctx, t, p, env, pal, p.style === 'reveal');
    }
  });
})();

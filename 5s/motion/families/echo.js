/* 5s Motion Lab: Echo (Time & structure).
 *
 * Five beats, one per card in a five (or per day in a streak): the first four are echoes that leave the mark,
 * the fifth is the mark itself, solid. Echo is repetition made visible, the habit of it: the same gesture
 * again and again until it is yours.
 *
 * Styles
 *   ripple   the mark beats five times; each beat sends a contour of the 5s rippling outward like a ring on water,
 *            and fills the hollow mark a fifth more, until the fifth beat lands it solid
 *   trail    the mark slides in and leaves four exposures behind it in a row, like a stroboscopic photograph;
 *            the fifth is the mark, and the four fade in order
 *   depth    five copies stack up in depth, back to front, one a beat; the front one is solid and the four
 *            behind slide forward into it
 *   extrude  (22 Oct, from Depth) the stack becomes one solid block, like 1970s poster type: the side thickens on
 *            the beats (5, 10, 20, 30 copies) in bands of flat tone, swings from lower-left to upper-right as if the
 *            light moved (40 copies), and retracts into the face, which lands with Depth's pop
 *   strata   (22 Oct, from Ripple + Depth) the mark bursts into a nest of five solid bands that follow its outline,
 *            like a topographic map or stacked cut paper; the outermost snaps inward on each beat until the fifth
 *            lands the plain mark
 *   riso     (22 Oct, from Depth in Paper) three flat ink plates overprint (multiply on light, screen on dark),
 *            out of register; they jump a fifth closer on each beat, a step and a hold, lock on the fifth and the
 *            inks become the logo's mark
 *
 * extrude and strata start and end on the still mark; riso starts on its plates out of register (seeded by env.rng).
 *
 * Outlines are made by knocking a narrower copy of the letters out of a wider one inside one isolated layer
 * (Marks.layer), and every group of outlines shares one layer, so a frame costs a few layers at most.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 240), s: M.points('s', 170) };
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };
  const BEAT = [0.06, 0.2, 0.34, 0.48, 0.62];   // five beats; the fifth lands the mark

  // is a colour dark? (relative luminance): colour choices follow the actual background, not only the theme,
  // so the paper and inverse palettes read right too
  const isDark = (hex) => {
    const h = M.mix(hex, hex, 0), r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.25;
  };

  function about(ctx, origin, s, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(s, s);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }

  // the letters (5 and s) in their own colours (or one colour), each stroke widened by `grow` on both sides
  function letters(ctx, pal, k, grow, solid, alpha) {
    const o = (name, w, cols) => ({ width: Math.max(0.5, w * k + 2 * grow), colours: solid || cols, alpha: alpha == null ? 1 : alpha });
    M.stroke(ctx, PTS.body, o('body', M.widths.body, pal.body));
    M.stroke(ctx, PTS.bar, o('bar', M.widths.bar, pal.bar));
    M.stroke(ctx, PTS.s, o('s', M.widths.s, pal.s));
  }
  // inside an isolated layer: erase the letters' shape grown by `grow` (alpha: how much is erased). A partial
  // erase goes through its own layer so the strokes' overlaps (the bar on the stem) are erased once, not twice.
  function erase(c, pal, k, grow, alpha) {
    if (alpha >= 0.999) {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      letters(c, pal, k, grow, '#000000');
      c.restore();
    } else if (alpha > 0.001) {
      M.layer(c, { alpha, composite: 'destination-out' }, (e) => letters(e, pal, k, grow, '#000000'));
    }
  }
  // an isolated layer (composite 'source-over' keeps it a layer even at alpha 1, so erasing only cuts it)
  const group = (ctx, alpha, draw) => M.layer(ctx, { alpha: M.clamp(alpha, 0, 1), composite: 'source-over' }, draw);

  // the ribbon's colours, from violet to blue: the colour of the echoes (the turn's colour is the past here)
  const echoTone = (pal, i, n) => M.colourAt(pal.ribbon, 0.12 + (0.62 * i) / Math.max(1, n - 1));

  /* ---------------------------------------------------------------------------------------------------------
   * The refinements (22 Oct): extrude, strata, riso. They push Depth and Ripple (both starred) further: the
   * mark seen through time as solid, flat, layered copies, landing in five counted beats. Each starts and ends
   * on the still mark (riso starts on its plates out of register), and each holds up in one flat colour.
   * ------------------------------------------------------------------------------------------------------- */
  const flatPal = (pal) => (pal.base || pal.name) === 'paper' || (pal.base || pal.name) === 'ink';
  const VIOLET = (pal) => ((pal.base || pal.name) === 'logo' || (pal.base || pal.name) === 'inverse' || (pal.base || pal.name) === 'turn' ? M.colourAt(pal.ribbon, 0.3) : pal.iris);

  // copies of the letters in one flat colour, one path per stroke for all of them (offsets in mark units)
  function flatCopies(c, offs, k, grow, colour) {
    c.save();
    c.strokeStyle = colour; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [name, w] of [['body', M.widths.body], ['bar', M.widths.bar], ['s', M.widths.s]]) {
      const pts = PTS[name];
      c.lineWidth = Math.max(0.5, w * k + 2 * grow);
      c.beginPath();
      for (const [ox, oy] of offs) {
        c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] + ox, pts[i][1] + oy);
      }
      c.stroke();
    }
    c.restore();
  }

  // extrude: Depth's die-cut copies pushed into one solid block, like 1970s poster type. The side thickens on
  // beats one to four (5, 10, 20, 30 copies), swings from lower-left to upper-right on beat four as if the light
  // moved (reaching 40 copies), and retracts into the front face on beat five, which lands with Depth's pop.
  const XBEAT = [0.05, 0.15, 0.25, 0.35, 0.64];
  const XCOPIES = [0, 5, 10, 20, 30];
  const XA0 = Math.atan2(0.72, -1), XA1 = Math.atan2(-0.72, 1);   // lower-left, upper-right
  function extrude(ctx, t, p, env, pal) {
    const I = p.intensity, k = p.weight, ease = M.easing(p.easing);
    const flat = flatPal(pal);
    const L = 60 + 140 * p.spread, gap = L / 40;
    let n = 0;
    for (let i = 0; i < 4; i++) n += (XCOPIES[i + 1] - XCOPIES[i]) * ease(span(t, XBEAT[i], XBEAT[i] + 0.07));
    const sw = span(t, XBEAT[3], XBEAT[3] + 0.24);
    n += 10 * M.ease.inOutCubic(sw);
    const retract = M.ease.inCubic(span(t, XBEAT[4], XBEAT[4] + 0.1));
    n *= 1 - retract;
    const ang = M.lerp(XA0, XA1, M.ease.outBack(0.6 + 2.2 * I)(M.ease.inOutSine(sw)));
    const dir = [Math.cos(ang), Math.sin(ang)];
    // the block is kept centred on the view: the face sits half the extrusion away from home
    const sh = -0.5 * gap * n;
    const fx = dir[0] * sh, fy = dir[1] * sh;
    // the face: squeezed a touch as the side retracts into it, then Depth's pop
    const land = span(t, XBEAT[4] + 0.1, XBEAT[4] + 0.28);
    const pop = M.ease.outBack(1.4 + 1.2 * I)(land);
    const S = land > 0 ? (1 - (0.04 + 0.05 * I)) + (0.04 + 0.05 * I) * pop : 1 - (0.04 + 0.05 * I) * retract;
    const rim = 1.6, faceRim = Math.max(5 * k, 1.1 / (env.scale || 1));
    const N = Math.ceil(n - 1e-6);
    // the ribbon stays in the face's plane but behind the block, so the side reads solid over it
    if (p.ribbon) {
      ctx.save(); ctx.translate(fx, fy);
      about(ctx, A.letters, S, (c) => M.ribbon(c, 0.1 * I * Math.sin(Math.PI * sw), { colours: pal.ribbon }));
      ctx.restore();
    }
    if (N > 0) {
      const back = flat ? M.mix(pal.bg, pal.ink, 0.25) : VIOLET(pal);
      const front = flat ? M.mix(pal.bg, pal.ink, 0.45) : pal.cobalt;
      group(ctx, 1, (c) => {
        about(c, A.letters, S, (cc) => {
          // copies in bands of five, one flat tone a band (cobalt at the front to violet at the back); the back
          // copy of each band is cut out by a hairline rim, so the bands read as ridges
          // (a band's five copies share one colour, so each band is one path per stroke: cheap at 40 copies)
          const bands = Math.ceil(N / 5);
          const at = (j) => { const d = gap * Math.min(j, n); return [fx + dir[0] * d, fy + dir[1] * d]; };
          for (let b = bands; b >= 1; b--) {
            const j0 = Math.min(N, 5 * b), offs = [];
            for (let j = j0; j > 5 * (b - 1); j--) offs.push(at(j));
            cc.save(); cc.globalCompositeOperation = 'destination-out';
            flatCopies(cc, [at(j0)], k, rim, '#000000');
            cc.restore();
            flatCopies(cc, offs, k, 0, M.mix(front, back, bands > 1 ? (b - 1) / (bands - 1) : 0));
          }
          cc.save(); cc.translate(fx, fy); erase(cc, pal, k, faceRim, 1); cc.restore();
        });
      });
    }
    ctx.save();
    ctx.translate(fx, fy);
    about(ctx, A.letters, S, (c) => letters(c, pal, k, 0));
    ctx.restore();
  }

  // strata: Ripple's contours made solid and Depth's rims made concentric. On beat one the mark bursts into a
  // nest of five solid bands that follow its outline, like a topographic map or stacked cut paper; on each later
  // beat the outermost band snaps inward onto the next, and the fifth lands the plain mark.
  const SBEAT = [0.06, 0.22, 0.36, 0.5, 0.64];
  function strataTones(pal) {
    if (flatPal(pal)) return [0.12, 0.25, 0.38, 0.51, 0.64].map((x) => M.mix(pal.bg, pal.ink, x));   // band 5 .. band 1
    let stops;
    if ((pal.base || pal.name) === 'pass') stops = [pal.iris, pal.cobalt];
    else if ((pal.base || pal.name) === 'turn') stops = [pal.cobalt, pal.iris];
    else stops = [VIOLET(pal), M.mix('#B64CD6', pal.bg, pal.theme === 'dark' ? 0.08 : 0), pal.flare, M.mix(pal.flare, pal.ember, 0.6)];
    return [0, 1, 2, 3, 4].map((i) => M.colourAt(stops, i / 4));
  }
  function strata(ctx, t, p, env, pal) {
    const I = p.intensity, k = p.weight;
    const g = 30 + 30 * p.spread, hair = Math.max(5, 1.1 / (env.scale || 1));   // at least a device pixel or so
    const tones = strataTones(pal);
    // how many bands are still out (5 -> 0): one snaps in on each of beats two to four, the last two on beat five
    const snap = M.ease.outBack(0.8 + 2.4 * I);
    const top = 5 - snap(span(t, SBEAT[1], SBEAT[1] + 0.07)) - snap(span(t, SBEAT[2], SBEAT[2] + 0.07))
      - snap(span(t, SBEAT[3], SBEAT[3] + 0.07)) - 2 * M.ease.outBack(1 + 1.2 * I)(span(t, SBEAT[4], SBEAT[4] + 0.1));
    const R = [0];
    for (let i = 1; i <= 5; i++) {
      // beat one: the bands burst out of the mark, the outer ones a moment later
      const out = M.ease.outBack(1 + 1.6 * I)(span(t, SBEAT[0] + 0.014 * (i - 1), SBEAT[0] + 0.1 + 0.014 * (i - 1)));
      R.push(g * Math.min(i * out, top));
    }
    // the nest is drawn a little smaller while it is wide, so it stays inside the view; back to full as it tightens
    const S = 1 - 0.18 * M.clamp(R[5] / (5 * g), 0, 1);
    let beat = 0;
    for (let i = 0; i < 5; i++) beat += bump(t, SBEAT[i] - 0.015, SBEAT[i] + 0.09) * (i === 4 ? 1.6 : 1) - 0.4 * bump(t, SBEAT[i] - 0.06, SBEAT[i]);
    const sc = S * (1 + 0.05 * I * beat);
    about(ctx, A.letters, sc, (c) => {
      if (p.ribbon) M.ribbon(c, 0.12 * I * M.clamp(R[5] / (5 * g), 0, 1), { colours: pal.ribbon });
      if (R[5] > 0.5) {
        group(c, 1, (cc) => {
          for (let i = 5; i >= 1; i--) {
            if (R[i] <= R[i - 1] + hair) continue;          // snapped in: nothing of it shows
            letters(cc, pal, k, R[i], tones[5 - i]);
            erase(cc, pal, k, R[i - 1] + hair, 1);
          }
        });
      }
      letters(c, pal, k, 0);
    });
  }

  // riso: the mark printed as three flat ink plates that find their register on the beats. They overprint
  // (multiply on a light ground, screen on a dark one), start out of register along three seeded angles and
  // jump a fifth closer on each beat, a step and a hold; on the fifth they lock and the inks become the mark.
  const RBEAT = [0.1, 0.25, 0.4, 0.55, 0.7];
  function riso(ctx, t, p, env, pal) {
    const I = p.intensity, k = p.weight;
    const dark = isDark(pal.bg);
    const inks = flatPal(pal) ? [0.5, 0.68, 0.86].map((x) => M.mix(pal.bg, pal.ink, x))
      : (pal.base || pal.name) === 'pass' ? [M.mix(pal.cobalt, '#FFFFFF', 0.35), pal.cobalt, pal.iris]
      : (pal.base || pal.name) === 'turn' ? [M.mix(pal.iris, '#FFFFFF', 0.35), pal.iris, pal.cobalt]
      : dark ? [pal.ember, pal.flare, pal.iris].map((c) => M.mix(c, pal.bg, 0.2))
      : [M.mix(pal.ember, '#FFFFFF', 0.25), M.mix(pal.flare, '#FFFFFF', 0.3), M.mix(pal.iris, '#FFFFFF', 0.35)];
    const rnd = env.rng;
    const a0 = rnd() * Math.PI * 2, reach = 40 + 80 * p.spread;
    const plates = inks.map((ink, i) => {
      const a = a0 + (i * Math.PI * 2) / 3 + (rnd() - 0.5) * 0.9, d = reach * (0.8 + 0.4 * rnd());
      const r = (rnd() < 0.5 ? -1 : 1) * (2 + 4 * rnd()) * Math.PI / 180;
      return { ink, x: Math.cos(a) * d, y: Math.sin(a) * d, r };
    });
    const jump = M.ease.outBack(4 * I);
    let m = 1;
    for (let i = 0; i < 5; i++) m -= 0.2 * jump(span(t, RBEAT[i], RBEAT[i] + 0.045));
    const fade = M.ease.inOutCubic(span(t, 0.82, 0.94));
    // the press: a small thump as the plates lock
    const sc = 1 + 0.05 * I * bump(t, RBEAT[4], RBEAT[4] + 0.1);
    about(ctx, A.letters, sc, (cx) => {
      // once locked, the logo's mark is printed underneath and the inks lift off it: the shape never thins
      if (fade > 0) { if (p.ribbon) M.ribbon(cx, 0, { colours: pal.ribbon }); letters(cx, pal, k, 0); }
      if (fade >= 1) return;
      const comp = dark ? 'screen' : 'multiply';
      M.layer(cx, { alpha: 1 - fade, composite: 'source-over' }, (c) => {
        plates.forEach((pl, i) => {
          M.layer(c, { composite: i === 0 ? 'source-over' : comp }, (cc) => {
            cc.translate(A.letters[0] + pl.x * m, A.letters[1] + pl.y * m);
            cc.rotate(pl.r * m);
            cc.translate(-A.letters[0], -A.letters[1]);
            if (p.ribbon && i === 2) M.ribbon(cc, 0.1 * I * m, { colours: [pl.ink] });
            letters(cc, pal, k, 0, pl.ink);
          });
        });
      });
    });
  }

  Motion.register({
    id: 'echo',
    name: 'Echo',
    idea: 'Five echoes of the mark, one a beat: four leave it and ripple away, the fifth is the mark itself, solid.',
    why: 'Five in a row: five cards sorted, five days kept, the same small gesture repeated until it becomes a habit.',
    moments: ['five-done', 'streak', 'path'],
    styles: ['ripple', 'trail', 'depth', 'extrude', 'strata', 'riso'],
    params: {
      duration: { default: 1000, min: 500, max: 3000, step: 50 },
      style: { default: 'ripple', options: ['ripple', 'trail', 'depth', 'extrude', 'strata', 'riso'] },
      spread: { default: 0.5, min: 0, max: 1, step: 0.05 },      // how far the echoes travel from the mark
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, k = p.weight;
      const dark = isDark(pal.bg);

      if (p.style === 'extrude') { extrude(ctx, t, p, env, pal); return; }
      if (p.style === 'strata') { strata(ctx, t, p, env, pal); return; }
      if (p.style === 'riso') { riso(ctx, t, p, env, pal); return; }

      if (p.style === 'trail') {
        // the mark slides in from the left (decelerating), leaning into the move and righting itself at the end
        const travel = 420 + 380 * p.spread;
        const mv = ease(span(t, 0.02, 0.7));
        const speed = (ease(span(t + 0.01, 0.02, 0.7)) - ease(span(t - 0.01, 0.02, 0.7))) / 0.02;
        const lean = -0.2 * I * Math.min(1.5, speed * 0.6) + 0.06 * I * bump(t, 0.66, 0.86);
        const x = -travel * (1 - mv);
        // four exposures, evenly spaced, each left as the mark passes it: an outline over a faint fill, violet
        // to blue, newer ones lying over older ones; they fade oldest first
        const shots = [];
        for (let i = 0; i < 4; i++) {
          const xi = -travel * (1 - (i + 1) / 5);
          if (x < xi - 1e-6) continue;
          const a = span(x, xi, xi + 50) * (1 - ease(span(t, 0.6 + 0.06 * i, 0.78 + 0.06 * i)));
          if (a > 0.003) shots.push({ xi, a, tone: echoTone(pal, 3 - i, 4) });
        }
        if (shots.length) {
          group(ctx, 1, (c) => {
            const line = 11 * k;
            for (const s of shots) {
              c.save();
              c.translate(s.xi, 0);
              erase(c, pal, k, 0, 1);                                  // it lies over the older ones
              letters(c, pal, k, 0, s.tone, 0.85 * s.a);                // the shape at the outline's strength,
              erase(c, pal, k, -line, 1 - 0.14 / 0.85);                 // its inside thinned to a faint fill
              c.restore();
            }
          });
        }
        ctx.save();
        ctx.translate(x, 0);
        ctx.translate(A.letters[0], 880);
        ctx.transform(1, 0, lean, 1, 0, 0);
        ctx.translate(-A.letters[0], -880);
        if (p.ribbon) M.ribbon(ctx, 0.12 * I * (1 - mv), { colours: pal.ribbon });
        letters(ctx, pal, k, 0);
        ctx.restore();
        return;
      }

      if (p.style === 'depth') {
        // five copies stepping back up and to the right; they arrive back to front, one a beat, then the four
        // behind slide forward into the front one. The copies behind are opaque, like die-cut cards, violet
        // to blue, each with a rim of background so the stack reads as layers.
        // the stack is drawn a little smaller while it builds, centred on its middle copy, so the five sit apart
        // and inside the view; it grows back to full size as it folds into the front one
        const step = [44 + 40 * p.spread, -(32 + 30 * p.spread)];
        const fold = M.ease.inOutCubic(span(t, 0.7, 0.92));
        const rim = 11 * k;
        for (let j = 4; j >= 0; j--) {          // j = depth: 4 is the back, 0 the front (the mark)
          const at = BEAT[4 - j];
          const arrive = span(t, at, at + 0.12);
          if (arrive <= 0) continue;
          const pop = M.ease.outBack(1.4 + 1.2 * I)(arrive);
          const d = (j - 2) * (1 - fold);
          // each lands from a little further back and higher (it drops into its place in the stack)
          const fall = 1 - M.ease.outCubic(arrive);
          const s = 0.94 + 0.06 * pop;
          const S = M.lerp(0.8, 1, fold);
          ctx.save();
          ctx.translate(A.letters[0], A.letters[1]); ctx.scale(S, S); ctx.translate(-A.letters[0], -A.letters[1]);
          ctx.translate(step[0] * d + step[0] * 1.5 * fall, step[1] * d + step[1] * 1.5 * fall);
          if (j === 0) {
            // the front one arrives quickly but not in a single frame: it fades up over its first third
            const a0 = M.clamp(arrive * 3, 0, 1);
            about(ctx, A.letters, s, (c) => {
              if (fold < 1) group(c, a0 * (1 - fold), (cc) => letters(cc, pal, k, rim, pal.bg));
              if (p.ribbon) M.ribbon(c, 0.1 * I * (1 - arrive), { colours: pal.ribbon, alpha: arrive });
              if (a0 >= 0.999) letters(c, pal, k, 0); else group(c, a0, (cc) => letters(cc, pal, k, 0));
            });
          } else {
            const tone = M.mix(echoTone(pal, j - 1, 4), dark ? pal.bg : '#FFFFFF', 0.1 * j);   // further back, fainter (aerial perspective)
            const a = M.clamp(arrive * 3, 0, 1) * (1 - span(fold, 0.88, 1));
            if (a > 0.003) {
              about(ctx, A.letters, s, (c) => {
                const draw = (cc) => { letters(cc, pal, k, rim, pal.bg); letters(cc, pal, k, 0, tone); };
                if (a >= 0.999) draw(c); else group(c, a, draw);
              });
            }
          }
          ctx.restore();
        }
        return;
      }

      // ripple: a contour leaves the mark on each beat (all of them in one layer, the widest first, each
      // erasing its own inside); the hollow mark fills a fifth more each time
      const reach = (140 + 260 * p.spread) * (0.6 + 0.4 * I);
      const line = 14 * k;
      const ringCols = p.palette === 'logo' || p.palette === 'inverse'
        ? [pal.iris, pal.cobalt, pal.flare, pal.ember, pal.iris]
        : [0, 1, 2, 3, 4].map((i) => M.colourAt(pal.five, 0.2 + 0.15 * i));
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const age = span(t, BEAT[i], BEAT[i] + (i === 4 ? 0.34 : 0.3));
        if (age <= 0 || age >= 1) continue;
        rings.push({ d: 10 + reach * (i === 4 ? 1.25 : 1) * ease(age), w: line * (1 - 0.55 * age), a: 0.95 * (1 - age) ** 1.4, c: ringCols[i] });
      }
      if (rings.length) {
        rings.sort((a, b) => b.d - a.d);
        group(ctx, 1, (c) => {
          for (const r of rings) {
            letters(c, pal, k, r.d + r.w / 2, r.c, r.a);
            erase(c, pal, k, r.d - r.w / 2, 1);
          }
        });
      }
      // the mark: a beat of scale on each pulse (a small gather, then a pop; the fifth the biggest)
      let beat = 0;
      for (let i = 0; i < 5; i++) beat += bump(t, BEAT[i] - 0.015, BEAT[i] + 0.09) * (i === 4 ? 1.6 : 1) - 0.4 * bump(t, BEAT[i] - 0.06, BEAT[i]);
      const sc = 1 + 0.035 * I * beat;
      let fill = 0;   // 0 .. 1 in fifths, each eased in on its beat
      for (let i = 0; i < 5; i++) fill += 0.2 * ease(span(t, BEAT[i], BEAT[i] + 0.1));
      about(ctx, A.letters, sc, (c) => {
        if (p.ribbon && fill > 0.001) M.ribbon(c, 0.08 * I * (1 - fill), { colours: pal.ribbon, alpha: fill });
        if (fill < 0.999) {
          // hollow: the letters with their inside erased down to the level reached so far (the outline stays)
          const inside = 0.15 + 0.85 * fill * fill;
          group(c, 1, (cc) => { letters(cc, pal, k, 0); erase(cc, pal, k, -line * 0.9, 1 - inside); });
        } else letters(c, pal, k, 0);
      });
    }
  });
})();

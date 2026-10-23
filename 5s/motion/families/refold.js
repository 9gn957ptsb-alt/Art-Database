/* 5s Motion Lab: Refold (the artist's sheet of twenty iterations, 23 Oct 2026: reference/iterations.png).
 *
 * The mark holds still while its glass refolds through the sheet's twenty iterations: soft cloth tightens
 * into a sail, the sail breaks into crystal facets, the facets melt into a wave, and the colours wash
 * between pastel and vivid, before it settles back on the chosen iteration (params.iteration).
 *
 * Styles
 *   cycle     one continuous refold through the next `stops` iterations of a ring of the twenty (cloth, sail,
 *             crystal, now and then a wave; vivid and pastel taking turns) and back: each one rises through the
 *             last from under the bowl to the glass's top-right corner, as the glass rises (a soft front with a
 *             crest of light), carrying its glass, its letters' colours and its blade, the sheets rippling once
 *   flipbook  the same ring, cell by cell: a crease leaning with the 5's stem sweeps across the mark from the
 *             right and leaves the next iteration behind it, as if turning the pages of the sheet
 *   pair      the chosen iteration and its foil (the one most unlike it): the crease turns the page to the
 *             foil, holds it, and turns it back the way it came
 *   breathe   the chosen iteration alone, keeping its fold: on the inhale it leans toward its foil (a vivid one
 *             washes pastel, a pastel one comes vivid), its glass reaching a little further
 *
 * Every rest is the engine's still mark (Marks.mark) of an iteration; a loop: t = 0 and t = 1 are the chosen one.
 * The classic look (no params.look) honours it: the classic letters stay still and their ribbon turns over
 * once per refold, in the same timing. Pure: draw(ctx, t, p, env) depends on t, p and env only.
 */
(function () {
  'use strict';
  const M = Marks;
  const IT = M.ITERATIONS;

  // the twenty as a ring: the fold changes at every step (cloth, sail, crystal, a wave now and then) and
  // vivid and pastel take turns, so any `stops` in a row show the sheet's range
  const RING = [1, 12, 13, 4, 5, 20, 15, 11, 6, 18, 10, 19, 2, 7, 17, 8, 14, 3, 16, 9];
  if (RING.length !== IT.length || RING.some((n, i) => !IT[n - 1] || RING.indexOf(n) !== i)) throw new Error('Refold: RING must hold each of the sheet\'s iterations once');
  // each iteration's foil: the one furthest from it in colour and fold
  const FOIL = IT.map((a) => {
    const d = (b) => Math.abs(a.params.vivid - b.params.vivid) + Math.abs(a.params.cyan - b.params.cyan) +
      0.5 * Math.abs(a.params.depth - b.params.depth) + (a.params.fold !== b.params.fold ? 0.5 : 0);
    return IT.reduce((best, b) => (d(b) > d(best) ? b : best), a).n;
  });

  // the letters as the look draws them: body and s straight from points() (the look swaps in the sheet's
  // letters), the sheet's bar untagged so its blade can be cut between two iterations' blades
  const PTS = { body: M.points('body', 160), s: M.points('s', 160), bar: M.points(M.paths5s.bar, 160) };
  const BAR5S = 150;   // the sheet's bar width at the standard weight 0.75 (marks.js LETTERS5S.bar)
  // where each letter's colour stops sit (the sheet's centrelines), for the refold's front to reach them
  const AT = { bar: PTS.bar, body: M.points(M.paths5s.body, 160), s: M.points(M.paths5s.s, 160) };

  const wrap = (x) => x - Math.floor(x);
  const lerp2 = (a, b, k) => [M.lerp(a[0], b[0], k), M.lerp(a[1], b[1], k)];

  // cycle's front: the next iteration rises through the mark from under the bowl's terminal (P0) to the
  // glass's top-right corner (P1), as the glass rises; w(q) is how far it has come over q (0..1), soft over SOFT
  const P0 = [200, 900], P1 = [900, 200], SOFT = 0.25, GRID = Array.from({ length: 21 }, (_, j) => j / 20);
  const along = (s) => [M.lerp(P0[0], P1[0], s), M.lerp(P0[1], P1[1], s)];
  const reach = (q, F) => M.clamp((F - ((q[0] - P0[0]) - (q[1] - P0[1])) / 1400) / SOFT, 0, 1);
  function mixStops(a, b, name, w) {   // a letter's stops, a mixed toward b by w(q) where each stop sits
    if (a === b) return a;
    const pos = (c) => (Array.isArray(c[0]) ? c.map((q) => q[0]) : []);
    const us = Array.from(new Set(pos(a).concat(pos(b), GRID))).sort((x, y) => x - y);
    const ws = us.map((u) => w(AT[name][Math.round(u * 159)]));
    if (ws.every((x) => x < 1e-4)) return a;   // untouched (or wholly turned) letters keep their exact stops
    if (ws.every((x) => x > 1 - 1e-4)) return b;
    return us.map((u, j) => [u, M.mix(M.colourAt(a, u), M.colourAt(b, u), ws[j])]);
  }
  // one iteration's glass, kept to one side of the front (ahead: where it has not come yet); the new one
  // carries a crest of light on its leading edge, as bright as the gesture is big (crest)
  function sideOf(ctx, pal, g, F, ahead, crest) {
    M.layer(ctx, { composite: 'source-over' }, (c) => {
      M.glass(c, g, { palette: pal });
      const a = along(F - SOFT), b = along(F), gr = c.createLinearGradient(a[0], a[1], b[0], b[1]);
      gr.addColorStop(0, ahead ? 'rgba(0,0,0,0)' : '#000'); gr.addColorStop(1, ahead ? '#000' : 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = gr; c.fillRect(-500, -500, 2000, 2000);
      if (ahead || crest <= 0.01) return;
      const l = c.createLinearGradient(a[0], a[1], b[0], b[1]);
      l.addColorStop(0, M.rgba('#FFFFFF', 0)); l.addColorStop(0.6, M.rgba('#FFFFFF', crest)); l.addColorStop(1, M.rgba('#FFFFFF', 0));
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = l; c.fillRect(-500, -500, 2000, 2000);
    });
  }

  // the route: which iterations, in order, from the chosen one (n0) back to it
  function route(style, n0, stops) {
    if (style === 'pair') return [n0, FOIL[n0 - 1], n0];
    const j = RING.indexOf(n0), seq = [n0];
    for (let i = 1; i <= stops; i++) seq.push(RING[(j + i) % RING.length]);
    return seq.concat([n0]);
  }
  // step i of n refolds seq[i] -> seq[i + 1]: half the hold resting before it, half after; k is its progress
  function step(t, n, hold) {
    const x = t * n, i = Math.min(n - 1, Math.floor(x));
    return { i, k: M.clamp((x - i - hold / 2) / (1 - hold), 0, 1) };
  }

  const still = (ctx, pal, p, ribbon) => M.mark(ctx, { palette: pal, weight: p.weight, ribbon: ribbon == null ? p.ribbon : ribbon });

  // cycle: iteration b rises through a (m 0..1): its glass, its letters' colours and its blade, the sheets
  // rippling once as the front passes
  function refold(ctx, PA, PB, m, i, p) {
    if (m <= 0 || m >= 1) { still(ctx, m <= 0 ? PA : PB, p); return; }
    const F = m * (1 + SOFT), g = wrap(i + m);
    if (p.ribbon) { sideOf(ctx, PA, g, F, true); sideOf(ctx, PB, g, F, false, 0.7 * p.intensity * Math.sin(Math.PI * m)); }
    letters(ctx, PA, PB, (q) => reach(q, F), p);
  }
  // the look's letters with a's colours mixed toward b's by w(q), the bar's blade turning from a's to b's
  function letters(ctx, PA, PB, w, p) {
    const k = p.weight, kc = w(PTS.bar[159]);
    const cut = [lerp2(PA.look.cut[0], PB.look.cut[0], kc), lerp2(PA.look.cut[1], PB.look.cut[1], kc), M.lerp(PA.look.cut[2], PB.look.cut[2], kc)];
    M.stroke(ctx, PTS.body, { width: M.widths.body * k, colours: mixStops(PA.body, PB.body, 'body', w) });
    M.stroke(ctx, PTS.bar, { width: BAR5S * k / 0.75, colours: mixStops(PA.bar, PB.bar, 'bar', w), caps: ['butt', 'butt'], cut });
    M.stroke(ctx, PTS.s, { width: M.widths.s * k, colours: mixStops(PA.s, PB.s, 's', w) });
  }

  // flipbook and pair: a crease leaning with the 5's stem sweeps across the mark like a page turning, right to left
  // (dir 1) or back (dir -1), and leaves b behind it; light catches on the fold
  const LEAN = [-84 / 247.7, 233 / 247.7], NORM = [LEAN[1], -LEAN[0]];   // along the stem, and across it (to the right)
  function crease(ctx, PA, PB, m, dir, p, env) {
    if (m <= 0 || m >= 1) { still(ctx, m <= 0 ? PA : PB, p); return; }
    const d = dir > 0 ? M.lerp(1180, 200, m) : M.lerp(200, 1180, m);   // the crease's offset across the mark (just off it at both ends)
    const o = [NORM[0] * d, NORM[1] * d], e0 = [o[0] - 2000 * LEAN[0], o[1] - 2000 * LEAN[1]], e1 = [o[0] + 2000 * LEAN[0], o[1] + 2000 * LEAN[1]];
    const part = (c, pal, side) => {   // the half-plane on one side of the crease
      c.save(); c.beginPath(); c.moveTo(e0[0], e0[1]); c.lineTo(e1[0], e1[1]);
      c.lineTo(e1[0] + side * 3000 * NORM[0], e1[1] + side * 3000 * NORM[1]); c.lineTo(e0[0] + side * 3000 * NORM[0], e0[1] + side * 3000 * NORM[1]);
      c.closePath(); c.clip(); still(c, pal, p); c.restore();
    };
    M.layer(ctx, { composite: 'source-over' }, (c) => {
      part(c, PB, dir); part(c, PA, -dir);
      // the fold's light, only where the mark is (source-atop in its own layer), as bright as the gesture is big
      c.save(); c.globalCompositeOperation = 'source-atop'; c.strokeStyle = '#FFFFFF'; c.lineCap = 'butt';
      const a = Math.sin(Math.PI * m) * (0.45 + 0.55 * p.intensity) * (env.theme === 'dark' ? 0.75 : 1);
      for (const [lw, al] of [[60, 0.12], [22, 0.3], [5, 0.9]]) {
        c.globalAlpha = a * al; c.lineWidth = lw;
        c.beginPath(); c.moveTo(e0[0], e0[1]); c.lineTo(e1[0], e1[1]); c.stroke();
      }
      c.restore();
    });
  }

  // breathe: on the inhale (b 0..1) the chosen iteration leans toward its foil, glass and letters, keeping its fold,
  // and its glass reaches a little further; its sheets breathe once
  function breathe(ctx, pal, b, t, p, env) {
    if (b <= 0) { still(ctx, pal, p); return; }
    const Q = M.palette(pal.base, env.theme, FOIL[pal.look.n - 1]), P = pal.look.P, R = Q.look.P, k = M.clamp(p.intensity * b, 0, 1);
    if (p.ribbon) {
      const o = { palette: pal, reach: M.lerp(P.reach, R.reach, k) + 0.5 * k, core: M.mix(P.core, R.core, k), lobeTint: M.mix(P.lobeTint, R.lobeTint, k) };
      for (const key of ['vivid', 'cyan', 'depth', 'lobe']) o[key] = M.lerp(P[key], R[key], k);
      M.glass(ctx, t, o);
    }
    letters(ctx, pal, Q, () => k, p);
  }

  // the classic look: the classic letters still, their ribbon turning over once per refold (g), drawn in as it turns
  function classic(ctx, pal, g, m, p) {
    if (p.ribbon) M.ribbon(ctx, g, { colours: pal.ribbon, width: M.widths.ribbon * (1 - 0.1 * p.intensity * Math.sin(Math.PI * m)) });
    still(ctx, pal, p, false);
  }

  Motion.register({
    id: 'refold',
    name: 'Refold',
    idea: 'The mark holds still while its glass refolds through the sheet\'s twenty iterations: soft cloth tightens into a sail, the sail breaks into crystal facets, the facets melt into a wave, and the colours wash between pastel and vivid before it settles back on the chosen iteration.',
    why: 'Twenty takes on one mark is what the artist did with the sheet, and what 5s asks of everyone: look at many versions, judge, keep yours. Each time it folds it is familiar and new at once.',
    moments: ['load', 'empty', 'turn', 'tab', 'launch'],
    styles: ['cycle', 'flipbook', 'pair', 'breathe'],
    params: {
      duration: { default: 4000, min: 600, max: 12000, step: 100 },   // the whole round, ms (the loop's period)
      stops: { default: 4, min: 1, max: 19, step: 1 },                 // cycle, flipbook: iterations passed through before settling back
      hold: { default: 0.35, min: 0, max: 0.8, step: 0.05 },           // share of each step resting on an iteration
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'still',
    loop: true,

    draw(ctx, t, p, env) {
      const pal = env.palette, look = pal.look, ease = M.easing(p.easing);
      if (p.style === 'breathe') {
        const b = Math.sin(Math.PI * ease(t));
        if (look) breathe(ctx, pal, b, t, p, env); else classic(ctx, pal, wrap(ease(t)), b, p);
        return;
      }
      const seq = route(p.style, look ? look.n : 1, Math.round(p.stops));
      const { i, k } = step(t, seq.length - 1, p.hold), m = M.clamp(ease(k), 0, 1);
      // classic: a full turn per refold; a pair turns the ribbon half over (its foil is its own back) and back
      if (!look) { classic(ctx, pal, p.style === 'pair' ? 0.5 * (i ? 1 - m : m) : wrap(i + m), m, p); return; }
      const PA = M.palette(pal.base, env.theme, seq[i]), PB = M.palette(pal.base, env.theme, seq[i + 1]);
      if (p.style === 'cycle') refold(ctx, PA, PB, m, i, p);
      else crease(ctx, PA, PB, m, p.style === 'pair' && i === 1 ? -1 : 1, p, env);
    }
  });
})();

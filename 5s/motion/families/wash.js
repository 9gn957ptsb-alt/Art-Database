/* 5s Motion Lab: Wash (added 23 Oct 2026, from the artist's sheet of twenty iterations, reference/iterations.png).
 *
 * Colour washes over the mark. It arrives as the sheet's palest take (iteration 11: washed peach and lilac on white),
 * then a tide of saturation runs along the strokes, from the bar's bright tip down the stem, round the bowl and
 * through the s to its tail, and the glass deepens from a lilac film to its indigo core last. The sheet itself runs
 * from washed-out to vivid: a keep is the small yes that turns a pale possibility into colour you own.
 *
 * Styles
 *   flood    the tide runs the strokes in the order a hand writes them, a wet edge on its front; the glass deepens
 *            last, with a small swell as it lands
 *   bloom    colour blooms out of the glass's core between the bowl and the s: the glass first, then the letters,
 *            nearest first, while the mark swells and settles
 *   develop  a print in the tray: a ghost comes up out of the blank ground and the darks develop first (the core, the
 *            red foot, the magenta), the yellows last, while the tray rocks
 *   drain    flood played backwards, for a pass: the glass pales first, then the colour ebbs from the s's tail back
 *            to the bar's tip, and the mark rests in its palest take
 *
 * In the Iterations look (params.look = 'iterations') the pale take is the sheet's own (iteration 11's letters and
 * glass) and the vivid one the chosen iteration's; the glass's preset numbers are eased from one to the other
 * (Marks.glass). In the classic look the palette is washed toward white (paper: toward its ground) and the ribbon
 * thins and pales. intensity: how pale the start is (1: the palest take) and how big the swell. t = 1 is the still
 * mark (drain: the still mark in its palest take).
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const NAMES = ['body', 'bar', 's'];   // drawing order, as Marks.mark
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };
  const N = 20;                         // colour stops per stroke
  const PALEST = 11;                    // the sheet's most washed-out cell
  const CORE = [650, 600];              // the glass's core, between the bowl and the s
  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (x) => Math.sin(Math.PI * M.clamp(x, 0, 1)) ** 2;   // 0 -> 1 -> 0, flat at both ends

  // per stroke, per stop: where it sits on the tide's route (the bar from its tip leftwards, the body, the s: 0..1)
  // and how far it is from the core (0..1)
  const LEN = { bar: M.length('bar'), body: M.length('body'), s: M.length('s') };
  const TOTAL = LEN.bar + LEN.body + LEN.s;
  const START = { bar: 0, body: LEN.bar, s: LEN.bar + LEN.body };
  const STOPS = {};
  for (const name of NAMES) {
    STOPS[name] = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, q = M.at(PTS[name], u);
      STOPS[name].push({
        u,
        route: (START[name] + (name === 'bar' ? 1 - u : u) * LEN[name]) / TOTAL,
        near: Math.min(1, Math.hypot(q.x - CORE[0], q.y - CORE[1]) / 540)
      });
    }
  }
  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const lum = (hex) => { const c = rgbOf(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  // a richer pigment: a pushed away from its pale take b (the colour that gathers on a wash's wet edge)
  const away = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b); return '#' + A.map((v, i) => Math.round(M.clamp(v + (v - B[i]) * k, 0, 255)).toString(16).padStart(2, '0')).join(''); };

  // the stroke's stops at this frame: its own colour where the tide has been (k = 1), the pale take ahead (k = 0),
  // a wet edge on the front; its own stops untouched once the tide has passed everywhere
  function coloursOf(name, pal, pale, to, w, kOf, edge, thin) {
    const out = [];
    let all = true;
    for (const s of STOPS[name]) {
      const target = M.colourAt(pal[name], s.u), k = kOf(s, target);
      if (k < 0.9999) all = false;
      const washed = pale ? M.mix(M.colourAt(pale[name], s.u), to, thin) : M.mix(target, to, 0.6);
      let c = M.mix(target, washed, w * (1 - k));
      const f = 4 * k * (1 - k);
      if (edge > 0 && f > 0.01) c = M.mix(c, away(target, washed, 1), 0.8 * edge * f);
      out.push([s.u, c]);
    }
    return all ? pal[name] : out;
  }

  // the glass (or, in the classic look, the ribbon) a share a of the way back to its pale take
  // (a little smaller while pale: it fills out as it deepens; film: how much fainter the pale glass is than the sheet's
  // palest, for dark, where the look's glass never washes, and for pastel iterations)
  function glass(ctx, pal, a, to, gt, shrink, film) {
    if (a <= 1e-4) { M.ribbon(ctx, gt, { colours: pal.ribbon }); return; }
    const width = M.widths.ribbon * (1 - shrink * a);
    if (pal.look) {
      const P = pal.look.P, Q = M.ITERATIONS[PALEST - 1].params;
      const o = { width, core: M.mix(P.core, Q.core, a), lobeTint: M.mix(P.lobeTint, Q.lobeTint, a) };
      for (const key of ['vivid', 'cyan', 'depth', 'reach', 'lobe']) o[key] = M.lerp(P[key], Q[key], a);
      M.glass(ctx, gt, Object.assign(o, { alpha: 1 - film * a }));
    } else {
      M.ribbon(ctx, gt, { width, colours: pal.ribbon.map((c) => M.mix(c, to, 0.6 * a)), alpha: 1 - 0.55 * a });
    }
  }

  Motion.register({
    id: 'wash',
    name: 'Wash',
    idea: "Colour washes over the mark: it arrives as the sheet's palest take, a tide of saturation runs along the strokes from the bar's bright tip to the s's tail, and the glass deepens from lilac film to indigo last.",
    why: 'A keep is a small yes that makes something vivid: judging turns a pale possibility into colour you own. The sheet itself spreads from washed-out to vivid, and the drain style plays it backwards for a pass.',
    moments: ['keep', 'launch', 'five-done', 'streak', 'seed', 'pass'],
    styles: ['flood', 'bloom', 'develop', 'drain'],
    params: {
      duration: { default: 1400, min: 300, max: 4000, step: 50 },
      style: { default: 'flood', options: ['flood', 'bloom', 'develop', 'drain'] },
      soft: { default: 0.25, min: 0.05, max: 0.8, step: 0.05 },        // how soft the tide's front is (share of the route)
      edge: { default: 0.6, min: 0, max: 1, step: 0.05 },             // the wet edge on the front, as watercolour dries
      easing: { default: 'inOutSine', options: M.EASES.slice() },
      intensity: { default: 0.8, min: 0, max: 1, step: 0.05 }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette, I = p.intensity, ease = M.easing(p.easing);
      const base = pal.base || pal.name;
      const pale = pal.look && (base === 'logo' || base === 'inverse') ? M.palette(base, env.theme, PALEST) : null;
      const to = base === 'paper' ? pal.bg : '#FFFFFF';
      const w = 0.3 + 0.7 * I, soft = p.soft;
      const thin = pal.look ? 0.4 * (1 - pal.look.P.vivid) : 0;   // a pastel iteration starts paler still, so its tide shows
      const front = (x) => -soft / 2 + (1 + soft) * x;   // the tide's front, from before the first stop to past the last
      const reach = (x, f) => M.smoothstep(x - soft / 2, x + soft / 2, f);
      let kOf, g, arrive = 1, scale = 1, about = M.anchors.letters, dx = 0;
      if (p.style === 'bloom') {
        const f = front(ease(seg(t, 0.14, 0.9)));
        kOf = (s) => reach(s.near, f);
        g = ease(seg(t, 0.02, 0.55));
        arrive = M.ease.outCubic(seg(t, 0, 0.1));
        scale = 1 + 0.06 * I * bump(seg(t, 0.04, 0.96));
        about = CORE;
      } else if (p.style === 'develop') {
        const run = ease(seg(t, 0.04, 1));
        kOf = (s, c) => { const lag = M.clamp(0.75 * (lum(c) - 0.28), 0, 0.45); return M.smoothstep(lag, lag + 0.55, run); };
        g = ease(seg(t, 0.08, 0.7));
        arrive = M.ease.inOutSine(seg(t, 0, 0.32));
        dx = 8 * I * Math.sin(TAU * 1.5 * t) * (1 - t) ** 2;
      } else if (p.style === 'drain') {
        const f = front(ease(seg(t, 0.22, 0.97)));
        kOf = (s) => 1 - reach(1 - s.route, f);
        g = 1 - ease(seg(t, 0, 0.5));
        scale = 1 - 0.03 * I * bump(t);
      } else {   // flood
        const f = front(ease(seg(t, 0.06, 0.76)));
        kOf = (s) => reach(s.route, f);
        g = ease(seg(t, 0.46, 1));
        arrive = M.ease.outCubic(seg(t, 0, 0.1));
        scale = 1 + 0.035 * I * bump(seg(t, 0.5, 1));
      }
      const gt = 0.08 * I * Math.sin(Math.PI * g);   // the glass breathes once as it deepens (0 at both ends)
      const paint = (c) => {
        c.save();
        c.translate(about[0] + dx, about[1]); c.scale(scale, scale); c.translate(-about[0], -about[1]);
        if (p.ribbon) glass(c, pal, w * (1 - g), to, gt, 0.05 * I, pal.look && pal.look.theme === 'dark' ? 0.45 : thin);
        for (const name of NAMES) {
          M.stroke(c, PTS[name], { width: M.widths[name] * p.weight, colours: coloursOf(name, pal, pale, to, w, kOf, p.edge, thin) });
        }
        c.restore();
      };
      M.layer(ctx, { alpha: arrive }, paint);
    }
  });
})();

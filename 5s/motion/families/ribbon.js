/* 5s Motion Lab: Ribbon (Gesture & judgment).
 *
 * Only the ribbon moves. The 5 and the s stay perfectly still, and the logo's glassy violet band sweeps
 * through them: out from under the bowl's terminal, under the bowl, up between the bowl and the s, to
 * the foot of the bar, tightening as it goes. The ribbon is the turn's colour, so this is the turn told
 * quietly: the letters do not change, the thing running through them does.
 *
 * Styles
 *   sweep    the ribbon is drawn on along its path, a bright head leading, the band wide and loose at
 *            first and tightening behind the head as it settles into place
 *   tighten  it is all there but slack (a bigger, looser loop, wide and pale); it is pulled taut into
 *            its place, twisting once, a touch past and back
 *   thread   it weaves: its head runs over the bowl and in front of the s, then the band lies back down
 *            behind the letters, where it rests
 *   whip     a quick one for a tab change: the band turns over once along its length, a glint running
 *            through it, and is still again
 *
 * Pure: draw(ctx, t, p, env) depends on t, p and env only; t = 1 is the still mark.
 * With ribbon: false there is no band, so a light alone runs the ribbon's path through the still letters.
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const PTS = { bar: M.points('bar', 120), body: M.points('body', 220), s: M.points('s', 170) };
  const SPINE = M.points('ribbon', 220);
  // the slack ribbon: a bigger loop, turned back a little, with a sag in the middle
  const SLACK = M.transform(SPINE, { scale: 1.28, rotate: -0.22, origin: A.bowl }).map((q, i, a) => {
    const u = i / (a.length - 1);
    return [q[0] - 40 * Math.sin(Math.PI * u), q[1] + 70 * Math.sin(Math.PI * u)];
  });

  const seg = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);

  function letters(c, p, pal) {
    M.stroke(c, PTS.body, { width: M.widths.body * p.weight, colours: pal.body });
    M.stroke(c, PTS.bar, { width: M.widths.bar * p.weight, colours: pal.bar });
    M.stroke(c, PTS.s, { width: M.widths.s * p.weight, colours: pal.s });
  }
  function still(ctx, p, pal) { if (p.ribbon) M.ribbon(ctx, 0, { colours: pal.ribbon }); letters(ctx, p, pal); }

  // the ribbon's glow: a soft violet light under the band while it moves (one solid stroke along the spine,
  // blurred: no strands needed in a glow, and no nested scratch band inside the blurred layer)
  function glow(ctx, env, pal, o, a) {
    if (a <= 0.01) return;
    const col = (pal.base || pal.name) === 'ink' || (pal.base || pal.name) === 'paper' ? pal.ink : pal.iris;
    const along = o.along || [0, 1];
    M.layer(ctx, { alpha: a * 0.7, blur: 26 * env.scale * env.dpr }, (c) =>
      M.stroke(c, o.pts || SPINE, { width: (o.width || M.widths.ribbon) * 0.8, colours: col, from: along[0], to: along[1] }));
  }
  // a bright head: a soft round light at a point on the spine
  function head(ctx, pal, pt, r, a) {
    if (a <= 0.01) return;
    const col = M.mix((pal.base || pal.name) === 'ink' ? pal.ink : pal.iris, '#FFFFFF', 0.55);
    const g = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], r);
    g.addColorStop(0, M.rgba('#FFFFFF', a)); g.addColorStop(0.35, M.rgba(col, a * 0.7)); g.addColorStop(1, M.rgba(col, 0));
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function sweep(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0, 0.88);
    const a1 = e(x);                                       // how far along the head has come
    const settle = seg(t, 0.25, 1);
    // behind the head the band is loose (wide, turned) and tightens into its rest as it settles
    const width = M.widths.ribbon * (1 + (0.35 + 0.4 * I) * (1 - M.ease.inOutSine(settle)));
    const rt = -(0.3 + 0.35 * I) * (1 - M.ease.outCubic(settle));
    const pts = M.morph(SLACK, SPINE, M.ease.outCubic(seg(t, 0.05, 0.95)) * 0.85 + 0.15);
    glow(ctx, env, pal, { pts, width, t: rt, along: [0, Math.max(0.001, a1)] }, (0.3 + 0.3 * I) * Math.sin(Math.PI * Math.min(1, t * 1.1)));
    if (a1 > 0.001) M.ribbon(ctx, rt, { colours: pal.ribbon, width, pts, along: [0, a1] });
    letters(ctx, p, pal);
    const hp = M.at(pts, a1);
    head(ctx, pal, [hp.x, hp.y], 60 + 50 * I, (0.85 - 0.3 * a1) * (1 - M.smoothstep(0.75, 0.95, t)) * M.smoothstep(0, 0.05, t));
  }

  function tighten(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0.06, 0.92);
    const pull = e(x);                                     // 0 slack -> 1 taut (overshoot lets it pass taut)
    const slack = M.morph(SLACK, M.transform(SLACK, { scale: 1 + 0.06 * I, origin: A.bowl }), 0.5 + 0.5 * Math.sin(Math.PI * seg(t, 0, 0.12)));
    const pts = M.morph(slack, SPINE, pull);
    const width = M.widths.ribbon * (1.7 + 0.5 * I - (0.7 + 0.5 * I) * pull);
    const rt = (1 - pull) * (0.9 + 0.3 * I);               // a full twist as it is pulled in
    const alpha = 0.55 + 0.45 * M.clamp(pull, 0, 1);
    glow(ctx, env, pal, { pts, width, t: rt }, (0.25 + 0.3 * I) * Math.sin(Math.PI * M.clamp(x, 0, 1)));
    M.ribbon(ctx, rt, { colours: pal.ribbon, width, pts, alpha, twist: 0.5 + 0.5 * (1 - M.clamp(pull, 0, 1)) });
    letters(ctx, p, pal);
  }

  function thread(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0, 0.8);
    const a1 = e(x);
    const rt = -(0.4 + 0.3 * I) * (1 - M.ease.outCubic(seg(t, 0.2, 1)));
    const width = M.widths.ribbon * (1 + (0.25 + 0.3 * I) * (1 - seg(t, 0.3, 1)));
    // the band behind the letters, all of it that has arrived
    glow(ctx, env, pal, { width, t: rt, along: [0, Math.max(0.001, a1)] }, (0.3 + 0.25 * I) * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    if (a1 > 0.001) M.ribbon(ctx, rt, { colours: pal.ribbon, width, along: [0, a1] });
    letters(ctx, p, pal);
    // the head in front: the last stretch behind the head lies over the letters, and lies down as it lands
    const over = (0.2 + 0.12 * I) * (1 - M.smoothstep(0.55, 0.95, t));
    const lift = 1 - M.smoothstep(0.6, 0.98, t);
    if (over > 0.01 && a1 > 0.02 && lift > 0.01) {
      const f0 = Math.max(0, a1 - over);
      M.ribbon(ctx, rt, { colours: pal.ribbon, width: width * (1 + 0.12 * lift), along: [f0, a1], alpha: lift });
    }
    const hp = M.at(SPINE, a1);
    head(ctx, pal, [hp.x, hp.y], 55 + 45 * I, 0.8 * lift * M.smoothstep(0, 0.05, t));
  }

  function whip(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0, 0.9);
    const turn = e(x);                                     // one full turn of the band: seamless at 1
    const swell = Math.sin(Math.PI * x);
    const width = M.widths.ribbon * (1 + (0.12 + 0.2 * I) * swell);
    glow(ctx, env, pal, { t: turn, width }, (0.25 + 0.35 * I) * swell);
    M.ribbon(ctx, turn, { colours: pal.ribbon, width, twist: 0.5 + (0.4 + 0.4 * I) * swell });
    letters(ctx, p, pal);
    const hp = M.at(SPINE, M.ease.inOutSine(x));
    head(ctx, pal, [hp.x, hp.y], 45 + 40 * I, 0.6 * swell);
  }

  // with the ribbon switched off there is no band to move, so its path is shown by a light alone: a soft
  // glow runs the ribbon's way behind the letters (in front of them for thread) and goes out
  function lightOnly(ctx, t, p, env, pal) {
    const I = p.intensity, e = M.easing(p.easing);
    const x = seg(t, 0, p.style === 'whip' ? 0.9 : 0.85);
    const a1 = M.clamp(e(x), 0, 1), a0 = Math.max(0, a1 - (0.25 + 0.15 * I));
    const fade = Math.sin(Math.PI * Math.min(1, x)) * (1 - M.smoothstep(0.85, 0.97, t));
    const front = p.style === 'thread';
    if (!front) glow(ctx, env, pal, { along: [a0, Math.max(a0 + 0.001, a1)], width: M.widths.ribbon * 0.7 }, (0.5 + 0.3 * I) * fade);
    letters(ctx, p, pal);
    if (front) glow(ctx, env, pal, { along: [a0, Math.max(a0 + 0.001, a1)], width: M.widths.ribbon * 0.5 }, (0.4 + 0.3 * I) * fade);
    const hp = M.at(SPINE, a1);
    head(ctx, pal, [hp.x, hp.y], 50 + 40 * I, 0.75 * fade);
  }

  Motion.register({
    id: 'ribbon',
    name: 'Ribbon',
    idea: 'Only the ribbon moves: the glassy violet band sweeps through the still 5 and s, under the bowl and up behind the s, tightening as it settles.',
    why: 'The letters stay what they are and what runs through them changes: the turn told quietly, in its own violet, and a small sign of life when a person moves between tabs or opens the app.',
    moments: ['turn', 'tab', 'launch'],
    styles: ['sweep', 'tighten', 'thread', 'whip'],
    params: {
      duration: { default: 1400, min: 250, max: 4000, step: 50 },
      style: { default: 'sweep', options: ['sweep', 'tighten', 'thread', 'whip'] },
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      if (t >= 1) { still(ctx, p, pal); return; }
      if (!p.ribbon) { lightOnly(ctx, t, p, env, pal); return; }
      if (p.style === 'tighten') tighten(ctx, t, p, env, pal);
      else if (p.style === 'thread') thread(ctx, t, p, env, pal);
      else if (p.style === 'whip') whip(ctx, t, p, env, pal);
      else sweep(ctx, t, p, env, pal);
    }
  });
})();

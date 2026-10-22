/* 5s Motion Lab: Stack (Time & structure).
 *
 * Five cards make the 5. The mark is cut into five horizontal cards (one per card in a five); they fall in
 * and stack up, bottom card first, until the stack is the 5s; then the stack fans open once from its left
 * edge like a deck riffled under a thumb, and closes. The cards' backs fade as they close, leaving the mark
 * whole, crisp and centred.
 *
 * Styles
 *   fall    the cards drop in from above one after another, bottom first, each landing with a small bounce
 *   deal    the cards are dealt in from the sides, alternating left and right, overshooting a little and settling
 *   pile    the five land as a loose pile (each a little turned and off, seeded), then square up into the 5
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const DEG = Math.PI / 180;
  const PTS = { bar: M.points('bar', 140), body: M.points('body', 260), s: M.points('s', 180) };

  // the five cards: horizontal bands of the mark, top (0) to bottom (4)
  const TOP = 140, BOTTOM = 920, X0 = 58, X1 = 942;
  // the first cut sits just under the bar, so the top card carries the whole bar; the rest are even
  const EDGES = [TOP, 306, 459, 612, 766, BOTTOM];
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // the whole mark is drawn once per frame into a scratch canvas at the target's own resolution, and each card
  // shows its slice of that picture: five cards cost one mark, not five (the ribbon's glass is not cheap)
  let scratch = null;
  function canvas(w, h) {
    if (!scratch) {
      if (typeof document !== 'undefined' && document.createElement) scratch = document.createElement('canvas');
      else if (typeof OffscreenCanvas !== 'undefined') scratch = new OffscreenCanvas(1, 1);
      else return null;
    }
    if (scratch.width < w || scratch.height < h) { scratch.width = Math.max(scratch.width, w); scratch.height = Math.max(scratch.height, h); }
    return scratch;
  }
  function picture(ctx, p, pal, view) {
    if (!ctx.getTransform) return null;
    const B = ctx.getTransform();
    // the device box of the view (axis-aligned: Motion.render only scales and translates)
    const x0 = Math.floor(B.a * view.x0 + B.c * view.y0 + B.e) - 2, y0 = Math.floor(B.b * view.x0 + B.d * view.y0 + B.f) - 2;
    const x1 = Math.ceil(B.a * view.x1 + B.c * view.y1 + B.e) + 2, y1 = Math.ceil(B.b * view.x1 + B.d * view.y1 + B.f) + 2;
    const w = x1 - x0, h = y1 - y0;
    if (!(w > 0 && h > 0) || w > 8192 || h > 8192) return null;
    const c = canvas(w, h);
    if (!c) return null;
    const s = c.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'; s.filter = 'none';
    s.clearRect(0, 0, w, h);
    s.setTransform(B.a, B.b, B.c, B.d, B.e - x0, B.f - y0);
    mark(s, p, pal);
    return { canvas: c, x: x0, y: y0, w, h, inv: B.inverse() };
  }

  function mark(ctx, p, pal) {
    const k = p.weight;
    if (p.ribbon) M.ribbon(ctx, 0, { colours: pal.ribbon });
    M.stroke(ctx, PTS.body, { width: M.widths.body * k, colours: pal.body });
    M.stroke(ctx, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
    M.stroke(ctx, PTS.s, { width: M.widths.s * k, colours: pal.s });
  }

  Motion.register({
    id: 'stack',
    name: 'Stack',
    idea: 'Five cards fall into a stack that is the 5s, fan open once like a riffled deck, and close into the mark.',
    why: 'Five sorted: the five cards a person just judged come together and are the 5, a small, complete thing.',
    moments: ['five-done'],
    styles: ['fall', 'deal', 'pile'],
    params: {
      duration: { default: 1400, min: 600, max: 3200, step: 50 },
      style: { default: 'fall', options: ['fall', 'deal', 'pile'] },
      cards: { default: true },                                  // show the cards' backs (off: bare slices of the mark)
      fan: { default: 0.6, min: 0, max: 1, step: 0.05 },        // how far the stack fans open
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const I = p.intensity;
      const ease = M.easing(p.easing);
      const view = env.view;
      const dark = env.theme === 'dark';
      const face = dark ? M.mix(pal.bg, pal.ink, 0.08) : M.mix(pal.bg, '#FFFFFF', 0.85);
      const edge = M.mix(pal.bg, pal.ink, dark ? 0.2 : 0.11);
      const rng = env.rng;
      // seeded looseness for the pile (fresh rng each frame: the same numbers every frame)
      const loose = [0, 1, 2, 3, 4].map(() => ({ x: rng() * 2 - 1, y: rng() * 2 - 1, r: rng() * 2 - 1 }));

      // the order the cards arrive in: bottom first
      const ORDER = [4, 3, 2, 1, 0];
      const each = (j) => [0.02 + 0.085 * j, 0.02 + 0.085 * j + 0.17];

      // the fan: from the stack's left edge, the top card turns most; it opens, holds a breath, and springs shut
      const fanOpen = ease(span(t, 0.56, 0.7)), fanShut = M.ease.spring(170, 16)(span(t, 0.72, 0.98));
      const fanK = p.fan * (0.4 + 0.6 * I) * fanOpen * (1 - fanShut);
      // the cards' backs fade out as the stack closes, leaving the mark
      const backs = p.cards ? 1 - M.ease.inOutSine(span(t, 0.78, 0.97)) : 0;
      const gap = 7 * (1 - span(t, 0.8, 0.95));

      const pic = picture(ctx, p, pal, view);
      const cards = [];
      for (let j = 0; j < 5; j++) {
        const i = ORDER[j];
        const [a, b] = each(j);
        const x = span(t, a, b);
        const yTop = EDGES[i], h = EDGES[i + 1] - EDGES[i];
        let dx = 0, dy = 0, rot = 0, sq = 0, alpha = 1;
        if (p.style === 'deal') {
          // in from the side, alternating, with a small overshoot (outBack) and a turn that straightens
          const side = j % 2 === 0 ? -1 : 1;
          const e = M.ease.outBack(1.2 + 0.8 * I)(x);
          dx = side * 1200 * (1 - e);
          rot = side * 9 * DEG * (1 - M.ease.outCubic(x));
          dy = -40 * (1 - M.ease.outCubic(x));
          alpha = M.clamp(x * 4, 0, 1);
        } else if (p.style === 'pile') {
          // tossed in: they fall onto a loose pile in the middle (turned, off-centre), then square up in turn
          const fall = M.ease.inQuad(span(x, 0, 0.55));
          const pileY = 530 - (yTop + h / 2) - j * 8;               // all five land around the middle
          const sq0 = ease(span(t, 0.36 + 0.045 * j, 0.52 + 0.045 * j));
          const off = { x: loose[j].x * 90, y: loose[j].y * 50, r: loose[j].r * 14 * DEG + (j % 2 ? 6 : -6) * DEG };
          dy = M.lerp(-1100, pileY + off.y, fall) * (1 - sq0);
          dx = off.x * (1 - sq0);
          rot = M.lerp(off.r * 1.8, off.r, fall) * (1 - sq0);
          alpha = M.clamp(x * 5, 0, 1);
          sq = 0.06 * I * bump(span(x, 0.5, 0.75), 0, 1);
        } else {
          // fall: dropped from above the view, accelerating, a squash on landing and a small bounce
          const fallX = span(x, 0, 0.62);
          const from = view.y0 - (yTop + h) - 40;
          dy = from * (1 - fallX * fallX);
          const after = span(x, 0.62, 1);
          dy -= 26 * I * Math.sin(Math.PI * after) * (1 - after);
          rot = (j % 2 ? 1 : -1) * 4 * DEG * (1 - fallX);
          sq = 0.1 * I * bump(after, 0, 0.45);
        }
        // the fan: about the stack's lower-left corner, the higher the card the further it turns
        const fanRot = -fanK * (4 - i) * 5.5 * DEG;
        cards.push({ i, x, yTop, h, dx, dy, rot, sq, alpha, fanRot, started: t > a });
      }

      // draw bottom card first so the higher ones lie on top when they overlap (the pile, the fan)
      for (const c of cards) {
        if (!c.started) continue;
        const cx = 500, cy = c.yTop + c.h / 2;
        ctx.save();
        ctx.globalAlpha *= c.alpha;
        // the fan's pivot: the stack's lower-left corner
        if (c.fanRot) { ctx.translate(X0, BOTTOM); ctx.rotate(c.fanRot); ctx.translate(-X0, -BOTTOM); }
        ctx.translate(c.dx, c.dy);
        ctx.translate(cx, c.yTop + c.h);
        ctx.rotate(c.rot);
        ctx.scale(1 + c.sq * 0.5, 1 - c.sq);
        ctx.translate(-cx, -(c.yTop + c.h));
        const y0 = c.yTop + gap / 2, y1 = c.yTop + c.h - gap / 2;
        if (backs > 0.002) {
          ctx.save();
          ctx.globalAlpha *= backs;
          // a soft shadow under the card, then its back
          ctx.fillStyle = M.rgba(dark ? '#000000' : pal.ink, dark ? 0.4 : 0.1);
          roundRect(ctx, X0 + 4, y0 + 7, X1 - X0 - 8, y1 - y0, 24);
          ctx.fill();
          ctx.fillStyle = face;
          roundRect(ctx, X0, y0, X1 - X0, y1 - y0, 24);
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = edge;
          ctx.stroke();
          ctx.restore();
        }
        // the card's slice of the mark (the outermost cards reach to the view's edge so nothing is cut off)
        ctx.beginPath();
        const top = c.i === 0 ? view.y0 - 200 : c.yTop;
        const bot = c.i === 4 ? view.y1 + 200 : c.yTop + c.h;
        if (backs > 0.002 && gap > 0.5) { ctx.rect(view.x0 - 200, Math.max(top, y0), view.x1 - view.x0 + 400, Math.min(bot, y1) - Math.max(top, y0)); }
        else ctx.rect(view.x0 - 200, top, view.x1 - view.x0 + 400, bot - top);
        ctx.clip();
        if (pic) {
          const v = pic.inv;
          ctx.transform(v.a, v.b, v.c, v.d, v.e, v.f);
          ctx.drawImage(pic.canvas, 0, 0, pic.w, pic.h, pic.x, pic.y, pic.w, pic.h);
        } else mark(ctx, p, pal);
        ctx.restore();
      }
    }
  });
})();

/* 5s Motion Lab: Tiles (new, 22 Oct 2026: "very different, but just as potent and exciting").
 *
 * The mark is printed across a board of cards. The cards turn, slide or swing, each showing its piece of
 * the mark, until the seams close and the board is the plain mark. A grid cuts the mark with no regard for
 * its letters, and the motion is a sequence over space (many small hinged cards across the whole field)
 * rather than over time: paper instead of line. A board of cards is 5s itself: five cards a day, a mood
 * board, a way of organising space; the mark assembling from its squares says your pieces make a whole.
 *
 * The board: about `grid` cards across the mark (3, 5 or 7), square, filling the whole view (a stadium card
 * stunt at full screen, a 3 x 3 shimmer at 64 px). With env.transparent (the mark over an app surface)
 * the board is only the mark's own square, so it never covers the app around it.
 *
 * Styles
 *   wave     a diagonal wave from the top-left (mirrored for env.direction 'left') turns every card over
 *            about its vertical axis, in perspective, lifting toward you as it goes edge-on: the backs are
 *            swatches of the palette, seeded per card like a mood board, the faces the mark
 *   shuffle  a sliding puzzle solved: the board starts scrambled (the mark's squares displaced) and the
 *            pieces slide home in five counted rounds of swaps, rows then columns, each landing with a click
 *   blinds   venetian blinds: vertical slats swing about their long axes, in a ripple, from the mark's
 *            negative (the 5s cut out of a field of iris) to the mark on paper
 *
 * `from`: 'board' starts on the board (the backs, the scramble, the negative) and lands on the mark;
 * 'mark' starts on the still mark too and goes all the way round (cards turn a full turn, the puzzle is
 * scrambled and solved, the slats go through the negative and back), so it can sit anywhere.
 *
 * Shared options: palette (the swatches and the field follow it; flat palettes give a two-tone board),
 * ribbon, weight, intensity (overshoot, lift toward you, perspective, how far the pieces travel), easing
 * (each card's turn or slide), both themes. Pure: everything is a function of (t, p, env); the seeded
 * choices (swatches, the scramble) come from env.seed. At t = 1 (and from the moment every seam has closed)
 * the frame is the plain mark, drawn directly.
 *
 * Cost: the mark is drawn once per frame into a scratch picture at the target's resolution and every
 * moving card shows its slice of that picture (a few drawImage strips for perspective), so a 100-card
 * board costs one mark, not a hundred. Resting cards are drawn directly, under one clip.
 */
(function () {
  'use strict';
  const M = Marks;
  const PI = Math.PI;
  const SQUARE = Object.freeze({ x0: 0, y0: 0, x1: 1000, y1: 1000 });
  const SHADE = '#120C24';                       // what a card darkens toward as it turns away from the light
  const SHADOW = '#2A1170';                      // a lifted card's flat shadow: deep violet, not grey
  const HOLES = { bar: M.points('bar', 160), body: M.points('body', 160), s: M.points('s', 160) };
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const smooth = (t, a, b) => M.smoothstep(a, b, t);

  const isDark = (hex) => {
    const h = String(hex).replace('#', '');
    const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2] < 0.2;
  };

  /* ------------------------------------------------------------------------------------------
   * the board
   * ---------------------------------------------------------------------------------------- */
  // square-ish cards, about `grid` across the mark's 1000 units, filling the region exactly (no slivers)
  const layouts = new Map();
  function layout(region, grid) {
    const key = [region.x0, region.y0, region.x1, region.y1].map((v) => v.toFixed(2)).join(',') + ':' + grid;
    let L = layouts.get(key);
    if (L) return L;
    const vw = region.x1 - region.x0, vh = region.y1 - region.y0, cell = 1000 / grid;
    const cols = Math.max(1, Math.round(vw / cell)), rows = Math.max(1, Math.round(vh / cell));
    const cw = vw / cols, ch = vh / rows, cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = region.x0 + c * cw, y = region.y0 + r * ch;
        cells.push({ i: r * cols + c, c, r, x, y, cx: x + cw / 2, cy: y + ch / 2 });
      }
    }
    L = Object.freeze({ key, region, cols, rows, cw, ch, cells });
    if (layouts.size > 48) layouts.clear();
    layouts.set(key, L);
    return L;
  }

  // the cards' backs: swatches of the palette, like a mood board (a blank card now and then)
  function swatchSet(pal, on) {
    const bg = pal.bg, ink = pal.ink, mix = M.mix;
    if (!on) return [mix(bg, ink, 0.07), mix(bg, ink, 0.11), mix(bg, ink, 0.15)];
    switch (pal.base || pal.name) {   // (base: a look palette's own)
      case 'keep': return [pal.ember, pal.flare, mix(pal.ember, '#FFD27A', 0.5), mix(pal.flare, '#5A1208', 0.28), mix(pal.ember, bg, 0.45)];
      case 'pass': return [pal.cobalt, mix(pal.cobalt, '#FFFFFF', 0.38), mix(pal.cobalt, '#0B1E5C', 0.38), mix(pal.cobalt, pal.iris, 0.45), mix(pal.cobalt, bg, 0.6)];
      case 'turn': return [pal.iris, mix(pal.iris, '#FFFFFF', 0.38), mix(pal.iris, '#2A1170', 0.38), mix(pal.iris, pal.cobalt, 0.5), mix(pal.iris, bg, 0.6)];
      case 'ink': return [ink, mix(ink, bg, 0.28), mix(ink, bg, 0.55), mix(ink, bg, 0.8)];
      case 'paper': return [ink, mix(ink, bg, 0.35), mix(bg, '#1A0B4A', 0.35), mix(bg, '#FFFFFF', 0.18)];
      default: return [pal.ember, pal.flare, pal.iris, pal.cobalt, M.colourAt(pal.bar, 1), M.colourAt(pal.ribbon, 1)];
    }
  }
  const backsCache = new Map();
  function backs(L, pal, on, seed) {
    const key = L.key + '|' + pal.name + pal.theme + '|' + on + '|' + seed;
    let out = backsCache.get(key);
    if (out) return out;
    const set = swatchSet(pal, on);
    out = L.cells.map((cell) => {
      const R = M.rng('tiles:' + seed + ':' + cell.c + ',' + cell.r);
      const blank = R() < 0.1 && on;
      return blank ? M.mix(pal.bg, pal.ink, 0.05) : set[Math.floor(R() * set.length) % set.length];
    });
    if (backsCache.size > 48) backsCache.clear();
    backsCache.set(key, out);
    return out;
  }

  // which cards carry ink (any stroke within its half-width of the card), for the puzzle to move
  const inkCache = new Map();
  function inked(L, p) {
    const key = L.key + '|' + p.weight + '|' + p.ribbon;
    let has = inkCache.get(key);
    if (has) return has;
    has = new Uint8Array(L.cells.length);
    const runs = [[HOLES.bar, M.widths.bar * p.weight / 2], [HOLES.body, M.widths.body * p.weight / 2], [HOLES.s, M.widths.s * p.weight / 2]];
    if (p.ribbon) runs.push([M.points('ribbon', 160), 70]);
    const { x0, y0 } = L.region;
    for (const [pts, hw] of runs) {
      for (const [px, py] of pts) {
        const c0 = Math.max(0, Math.floor((px - hw - x0) / L.cw)), c1 = Math.min(L.cols - 1, Math.floor((px + hw - x0) / L.cw));
        const r0 = Math.max(0, Math.floor((py - hw - y0) / L.ch)), r1 = Math.min(L.rows - 1, Math.floor((py + hw - y0) / L.ch));
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const cell = L.cells[r * L.cols + c];
            const dx = Math.max(cell.x - px, 0, px - (cell.x + L.cw)), dy = Math.max(cell.y - py, 0, py - (cell.y + L.ch));
            if (dx * dx + dy * dy < hw * hw * 0.9) has[cell.i] = 1;
          }
        }
      }
    }
    if (inkCache.size > 48) inkCache.clear();
    inkCache.set(key, has);
    return has;
  }

  /* ------------------------------------------------------------------------------------------
   * pictures: the mark (or its negative) drawn once per frame at the target's resolution
   * ---------------------------------------------------------------------------------------- */
  const pool = {};
  function canvasFor(key, w, h) {
    let c = pool[key];
    if (!c) {
      if (typeof document !== 'undefined' && document.createElement) c = document.createElement('canvas');
      else if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(1, 1);
      else return null;
      pool[key] = c;
    }
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    return c;
  }
  function picture(ctx, key, region, paint) {
    if (!ctx.getTransform || !ctx.canvas) return null;
    const B = ctx.getTransform();
    if (Math.abs(B.b) > 1e-9 || Math.abs(B.c) > 1e-9 || !(B.a > 0) || !(B.d > 0)) return null;
    const x0 = Math.max(0, Math.floor(B.a * region.x0 + B.e) - 2), y0 = Math.max(0, Math.floor(B.d * region.y0 + B.f) - 2);
    const x1 = Math.min(ctx.canvas.width, Math.ceil(B.a * region.x1 + B.e) + 2), y1 = Math.min(ctx.canvas.height, Math.ceil(B.d * region.y1 + B.f) + 2);
    const w = x1 - x0, h = y1 - y0;
    if (!(w > 0 && h > 0) || w > 8192 || h > 8192) return null;
    const c = canvasFor(key, w, h);
    if (!c) return null;
    const s = c.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1; s.globalCompositeOperation = 'source-over'; s.filter = 'none';
    s.clearRect(0, 0, c.width, c.height);
    s.setTransform(B.a, 0, 0, B.d, B.e - x0, B.f - y0);
    s.save();
    paint(s);
    s.restore();
    return { canvas: c, a: B.a, d: B.d, ex: B.e - x0, fy: B.f - y0, ox: x0, oy: y0, w, h };
  }

  // copy a picture back 1:1 (it was drawn in this canvas's own pixels), under whatever clip is set
  function copy(ctx, pic) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pic.canvas, 0, 0, pic.w, pic.h, pic.ox, pic.oy, pic.w, pic.h);
    ctx.restore();
  }
  function facePicture(ctx, p, pal, region, transparent) {
    return picture(ctx, 'face', region, (s) => {
      if (!transparent) { s.fillStyle = pal.bg; s.fillRect(region.x0 - 2, region.y0 - 2, region.x1 - region.x0 + 4, region.y1 - region.y0 + 4); }
      plainMark(s, p, pal);
    });
  }

  function plainMark(c, p, pal) { M.mark(c, { palette: pal, weight: p.weight, ribbon: p.ribbon }); }

  // the negative: a field with the 5s cut out of it (holes, so whatever is beneath shows through); the
  // ribbon runs across the field as a paler glass
  function fieldColour(pal) { return (pal.base || pal.name) === 'ink' || (pal.base || pal.name) === 'paper' ? pal.ink : pal.iris; }
  function negative(c, p, pal, region) {
    const field = fieldColour(pal);
    c.fillStyle = field;
    c.fillRect(region.x0 - 2, region.y0 - 2, region.x1 - region.x0 + 4, region.y1 - region.y0 + 4);
    if (p.ribbon) {
      const glass = isDark(field) ? '#FFFFFF' : pal.bg;
      M.ribbon(c, 0, { colours: [M.mix(field, glass, 0.32), M.mix(field, glass, 0.5), M.mix(field, glass, 0.7)], alpha: 0.9 });
    }
    c.globalCompositeOperation = 'destination-out';
    const k = p.weight;
    M.stroke(c, HOLES.body, { width: M.widths.body * k, colours: '#000000' });
    M.stroke(c, HOLES.bar, { width: M.widths.bar * k, colours: '#000000' });
    M.stroke(c, HOLES.s, { width: M.widths.s * k, colours: '#000000' });
    c.globalCompositeOperation = 'source-over';
  }

  /* ------------------------------------------------------------------------------------------
   * a card turning about its vertical axis, in perspective
   *   o: {cx, cy, w, h, theta, spin, persp, lift}; theta 0 = face up, PI = back up
   * ---------------------------------------------------------------------------------------- */
  function turned(o) {
    const cos = Math.cos(o.theta), sin = Math.sin(o.theta);
    const face = cos >= 0;
    const f = (x) => 1 / (1 + o.persp * (x / o.w) * sin * o.spin);       // nearer: larger
    const X = (x) => o.cx + x * cos * f(x) * o.lift;
    const H = (x) => (o.h / 2) * f(x) * o.lift;
    const lx = (s) => (face ? -o.w / 2 + s * o.w : o.w / 2 - s * o.w);    // screen-left to screen-right, unmirrored
    const xl = lx(0), xr = lx(1);
    return { face, cos, sin, f, X, H, lx, XL: X(xl), XR: X(xr), HL: H(xl), HR: H(xr) };
  }
  function quad(ctx, g, cy, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    ctx.beginPath();
    ctx.moveTo(g.XL + dx, cy - g.HL + dy);
    ctx.lineTo(g.XR + dx, cy - g.HR + dy);
    ctx.lineTo(g.XR + dx, cy + g.HR + dy);
    ctx.lineTo(g.XL + dx, cy + g.HL + dy);
    ctx.closePath();
  }
  // a slice of a picture (the mark-space rect sx, sy, sw, sh) shown on a turned card, in vertical strips
  function strips(ctx, pic, g, cy, sx, sy, sw, sh, px) {
    const width = Math.abs(g.XR - g.XL);
    const n = M.clamp(Math.round(width / (px * 22)), 1, 8);
    const SX = pic.a * sx + pic.ex, SY = pic.d * sy + pic.fy, SW = pic.a * sw, SH = pic.d * sh;
    for (let k = 0; k < n; k++) {
      const s0 = k / n, s1 = (k + 1) / n;
      const xa = g.X(g.lx(s0)), xb = g.X(g.lx(s1));
      const hh = Math.max(g.H(g.lx(s0)), g.H(g.lx(s1)));
      const over = k < n - 1 ? px * 0.8 : 0;                                // overlap a hair: no seams between strips
      const srcW = (s1 - s0) * SW * (1 + over / Math.max(1e-6, xb - xa));
      ctx.drawImage(pic.canvas, SX + s0 * SW, SY, Math.max(0.01, srcW), SH, xa, cy - hh, xb - xa + over, 2 * hh);
    }
  }
  // the card's edge (its thickness), seen beside its nearer side while it is turned
  function edge(ctx, g, cy, thick, colour) {
    const a = Math.abs(g.sin), w = thick * a * M.smoothstep(0.12, 0.45, a);   // no hairlines on a card that is nearly flat
    if (w < 1e-3) return;
    const nearLeft = g.HL >= g.HR;
    const x = nearLeft ? g.XL : g.XR, hh = nearLeft ? g.HL : g.HR;
    ctx.fillStyle = colour;
    ctx.fillRect(nearLeft ? x - w : x, cy - hh, w, 2 * hh);
  }

  // a back as it turns: a glint as it tips toward the light, then darker as it goes edge-on
  function backTone(colour, away) {
    if (away < 0.3) return M.mix(colour, '#FFFFFF', 0.42 * Math.sin(PI * away / 0.3));
    return M.mix(colour, SHADE, 0.62 * (away - 0.3) / 0.7);
  }

  function clipRects(ctx, rects) {
    ctx.beginPath();
    for (const r of rects) ctx.rect(r[0], r[1], r[2], r[3]);
    ctx.clip();
  }

  /* ------------------------------------------------------------------------------------------
   * wave
   * ---------------------------------------------------------------------------------------- */
  function wave(ctx, t, p, env, ctxs) {
    const { pal, L, region, px, ease, I, full, transparent, dir } = ctxs;
    const back = backs(L, pal, p.swatches, env.seed);
    const nd = Math.max(1, L.cols + L.rows - 2);
    const stagger = full ? 0.5 : 0.56, len = full ? 0.38 : 0.34, t0 = full ? 0.06 : 0.02;
    const over = M.ease.outBack(0.5 + 1.9 * I);
    const lift = 0.05 + 0.27 * I, persp = 0.2 + 0.4 * I, thick = L.cw * (0.03 + 0.05 * I);
    const seam = full ? smooth(t, 0, 0.1) * (1 - smooth(t, 0.8, 0.93)) : 1 - smooth(t, 0.76, 0.93);
    const inset = p.gap * 0.085 * seam;
    const restBack = [], restFace = [], moving = [];
    for (const cell of L.cells) {
      const k = (dir > 0 ? cell.c : L.cols - 1 - cell.c) + cell.r;
      const a = t0 + (k / nd) * stagger;
      const u = span(t, a, a + len);
      const pr = u <= 0 ? 0 : u >= 1 ? 1 : over(ease(u));
      const theta = full ? 2 * PI * pr : PI * (1 - pr);
      const up = 1 + lift * Math.abs(Math.sin(theta));               // a card lifts toward you as it goes edge-on
      const ix = inset * L.cw, iy = inset * L.ch;
      const rect = [cell.x + ix, cell.y + iy, L.cw - 2 * ix, L.ch - 2 * iy];
      const settled = u <= 0 || u >= 1;
      if (settled && Math.cos(theta) < 0) restBack.push([rect, back[cell.i]]);
      else if (settled) restFace.push(rect);
      else moving.push({ cell, theta, up, rect, colour: back[cell.i] });
    }
    // resting backs: flat swatches (a hair larger when the seams are shut, so neighbours never show a hairline)
    const grow = inset * L.cw < px ? px * 0.5 : 0;
    for (const [r, colour] of restBack) { ctx.fillStyle = colour; ctx.fillRect(r[0] - grow, r[1] - grow, r[2] + 2 * grow, r[3] + 2 * grow); }
    // the mark, drawn once: resting faces copy it 1:1 under one clip, turning cards show their slices of it
    const pic = restFace.length || moving.some((m) => Math.cos(m.theta) >= 0) ? facePicture(ctx, p, pal, region, transparent) : null;
    if (restFace.length) {
      ctx.save();
      clipRects(ctx, restFace);
      if (pic) copy(ctx, pic); else plainMark(ctx, p, pal);
      ctx.restore();
    }
    if (!moving.length) return;
    moving.sort((x, y) => x.up - y.up || x.cell.i - y.cell.i);
    const shadow = M.rgba(SHADOW, isDark(pal.bg) ? 0.55 : 0.2);
    for (const m of moving) {
      const { cell, theta, up, rect } = m;
      const g = turned({ cx: cell.cx, cy: cell.cy, w: rect[2], h: rect[3], theta, spin: dir, persp, lift: up });
      const away = 1 - Math.abs(g.cos);
      // a hard, flat shadow under a lifted card, like cut paper
      const off = (up - 1) * L.cw * 0.42;
      if (off > px * 0.3) { ctx.fillStyle = shadow; quad(ctx, g, cell.cy, off * 0.6, off); ctx.fill(); }
      const rim = M.mix(m.colour, SHADE, 0.35);                      // the card is its colour all through: its edge flashes it
      if (!g.face) {
        ctx.fillStyle = backTone(m.colour, away);
        quad(ctx, g, cell.cy); ctx.fill();
        edge(ctx, g, cell.cy, thick, rim);
        continue;
      }
      ctx.save();
      quad(ctx, g, cell.cy); ctx.clip();
      if (pic) {
        if (transparent) ctx.globalAlpha *= 1 - 0.45 * away;
        strips(ctx, pic, g, cell.cy, rect[0], rect[1], rect[2], rect[3], px);
      } else {
        // no scratch canvas here: draw the mark itself, squeezed into the card
        if (!transparent) { ctx.fillStyle = pal.bg; ctx.fill(); }
        ctx.translate(cell.cx, cell.cy); ctx.scale(Math.max(1e-3, Math.abs(g.XR - g.XL) / rect[2]), up); ctx.translate(-cell.cx, -cell.cy);
        plainMark(ctx, p, pal);
      }
      ctx.restore();
      if (!transparent && away > 0.002) { ctx.fillStyle = M.rgba(SHADE, 0.35 * away); quad(ctx, g, cell.cy); ctx.fill(); }
      edge(ctx, g, cell.cy, thick, rim);
    }
  }

  /* ------------------------------------------------------------------------------------------
   * shuffle: a sliding puzzle, scrambled by five rounds of swaps (rows, columns, rows ...) and solved by
   * undoing them, last first
   * ---------------------------------------------------------------------------------------- */
  const plans = new Map();
  function plan(L, has, seed, I) {
    const reach = 1 + Math.floor(2.2 * I);                     // how far a swap can reach: 1, 2 or 3 cards
    const nInk = has.reduce((x, y) => x + y, 0);
    const per = Math.max(1, Math.round(nInk * (0.1 + 0.16 * I)));   // swaps per round
    const key = L.key + '|' + seed + '|' + reach + '|' + per + '|' + Array.prototype.join.call(has, '');
    let P = plans.get(key);
    if (P) return P;
    const R = M.rng('tiles-shuffle:' + seed + ':' + L.cols + 'x' + L.rows);
    const n = L.cells.length, at = [];
    for (let i = 0; i < n; i++) at.push(i);                      // slot -> piece
    const rounds = [];
    for (let r = 0; r < 5; r++) {
      const across = r % 2 === 0;
      const cand = [];
      for (const cell of L.cells) {
        for (let d = 1; d <= reach; d++) {
          const c2 = across ? cell.c + d : cell.c, r2 = across ? cell.r : cell.r + d;
          if (c2 >= L.cols || r2 >= L.rows) continue;
          const b = r2 * L.cols + c2;
          if (has[at[cell.i]] || has[at[b]]) cand.push([cell.i, b, has[at[cell.i]] && has[at[b]] ? 0 : 1]);
        }
      }
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = cand[i]; cand[i] = cand[j]; cand[j] = x; }
      cand.sort((x, y) => x[2] - y[2]);                         // swaps that move two inked pieces first
      const used = new Uint8Array(n), pairs = [];
      for (const [a, b] of cand) {
        if (pairs.length >= per) break;
        if (used[a] || used[b]) continue;
        used[a] = used[b] = 1;
        pairs.push([a, b]);
      }
      for (const [a, b] of pairs) { const x = at[a]; at[a] = at[b]; at[b] = x; }
      rounds.push(pairs);
    }
    P = { rounds, scrambled: at.slice() };
    if (plans.size > 48) plans.clear();
    plans.set(key, P);
    return P;
  }

  function shuffle(ctx, t, p, env, ctxs) {
    const { pal, L, region, px, ease, I, full, transparent } = ctxs;
    const has = inked(L, p);
    const P = plan(L, has, env.seed, I);
    // the steps: [pairs, start, end]; the board is solved from the scramble, or scrambled from the mark first
    const steps = [];
    if (full) {
      for (let k = 0; k < 5; k++) steps.push([P.rounds[k], 0.05 + k * 0.078, 0.05 + k * 0.078 + 0.064]);
      for (let k = 0; k < 5; k++) steps.push([P.rounds[4 - k], 0.48 + k * 0.078, 0.48 + k * 0.078 + 0.064]);
    } else {
      for (let k = 0; k < 5; k++) steps.push([P.rounds[4 - k], 0.04 + k * 0.164, 0.04 + k * 0.164 + 0.128]);
    }
    const at = full ? L.cells.map((c) => c.i) : P.scrambled.slice();
    const pos = new Map();                                        // piece -> {from, to, e, u}
    const landed = new Map();                                     // piece -> when it last arrived
    for (const [pairs, a, b] of steps) {
      if (t <= a) break;
      if (t >= b) {
        for (const [x, y] of pairs) { const q = at[x]; at[x] = at[y]; at[y] = q; landed.set(at[x], b); landed.set(at[y], b); }
        continue;
      }
      const u = span(t, a, b), e = ease(u);
      for (const [x, y] of pairs) { pos.set(at[x], { from: x, to: y, e, u }); pos.set(at[y], { from: y, to: x, e, u }); }
    }
    const seam = full ? smooth(t, 0, 0.06) * (1 - smooth(t, 0.86, 0.94)) : 1 - smooth(t, 0.86, 0.94);
    const inset = p.gap * 0.085 * seam;
    const ix = inset * L.cw, iy = inset * L.ch;
    const lift = 0.04 + 0.14 * I, click = 0.04 + 0.1 * I, clickLen = full ? 0.05 : 0.07;
    // the board shows: on a light ground the cards are the ground and the tray under them (the seams, the
    // slot a piece has left) a shade darker; on a dark ground the cards are a shade lighter. Both melt into
    // the ground as the seams close.
    const darkGround = isDark(pal.bg);
    const card = transparent ? null : darkGround ? M.mix(pal.bg, pal.ink, 0.08 * seam) : pal.bg;
    if (!transparent && !darkGround && seam > 0) {
      ctx.fillStyle = M.mix(pal.bg, pal.ink, 0.085 * seam);
      ctx.fillRect(region.x0, region.y0, region.x1 - region.x0, region.y1 - region.y0);
    }
    const rest = [], displaced = [], moving = [];
    for (let slot = 0; slot < at.length; slot++) {
      const piece = at[slot];
      if (pos.has(piece)) continue;
      const since = landed.has(piece) ? t - landed.get(piece) : 1;
      const v = span(since, 0, clickLen);
      const sc = v > 0 && v < 1 ? 1 - click * Math.sin(PI * v) * (1 - v) * 1.6 : 1;
      if (piece === slot && sc === 1) { rest.push([L.cells[slot].x + ix, L.cells[slot].y + iy, L.cw - 2 * ix, L.ch - 2 * iy]); continue; }
      if (!has[piece] && transparent) continue;
      displaced.push({ piece, x: L.cells[slot].cx, y: L.cells[slot].cy, sc });
    }
    for (const [piece, m] of pos) {
      if (!has[piece] && transparent) continue;
      const A = L.cells[m.from], Bc = L.cells[m.to];
      moving.push({ piece, x: M.lerp(A.cx, Bc.cx, m.e), y: M.lerp(A.cy, Bc.cy, m.e), sc: 1 + lift * Math.sin(PI * m.u), inked: has[piece] });
    }
    const pic = picture(ctx, 'face', region, (s) => {
      if (card) { s.fillStyle = card; s.fillRect(region.x0 - 2, region.y0 - 2, region.x1 - region.x0 + 4, region.y1 - region.y0 + 4); }
      plainMark(s, p, pal);
    });
    if (rest.length) {
      ctx.save();
      clipRects(ctx, rest);
      if (pic) copy(ctx, pic);
      else { if (card) { ctx.fillStyle = card; for (const r of rest) ctx.fillRect(r[0], r[1], r[2], r[3]); } plainMark(ctx, p, pal); }
      ctx.restore();
    }
    if (!displaced.length && !moving.length) return;
    const shadow = M.rgba(SHADOW, isDark(pal.bg) ? 0.55 : 0.2);
    const piece = (o, lifted) => {
      const home = L.cells[o.piece];
      const w = (L.cw - 2 * ix) * o.sc, h = (L.ch - 2 * iy) * o.sc;
      const x = o.x - w / 2, y = o.y - h / 2;
      if (lifted) {
        const off = (o.sc - 1) * L.cw * 0.42;
        if (off > px * 0.3) { ctx.fillStyle = shadow; ctx.fillRect(x + off * 0.6, y + off, w, h); }
      }
      if (!has[o.piece]) { if (card) { ctx.fillStyle = card; ctx.fillRect(x, y, w, h); } return; }
      const sx = home.x + ix, sy = home.y + iy, sw = L.cw - 2 * ix, sh = L.ch - 2 * iy;
      if (pic) {
        ctx.drawImage(pic.canvas, pic.a * sx + pic.ex, pic.d * sy + pic.fy, pic.a * sw, pic.d * sh, x, y, w, h);
      } else {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        if (card) { ctx.fillStyle = card; ctx.fillRect(x, y, w, h); }
        ctx.translate(x, y); ctx.scale(w / sw, h / sh); ctx.translate(-sx, -sy);
        plainMark(ctx, p, pal);
        ctx.restore();
      }
    };
    for (const o of displaced) piece(o, false);
    moving.sort((a, b) => a.inked - b.inked || a.sc - b.sc || a.piece - b.piece);
    for (const o of moving) piece(o, true);
  }

  /* ------------------------------------------------------------------------------------------
   * blinds
   * ---------------------------------------------------------------------------------------- */
  function blinds(ctx, t, p, env, ctxs) {
    const { pal, L, region, px, ease, I, full, transparent, dir } = ctxs;
    const n = L.cols;
    const stagger = full ? 0.36 : 0.45, len = full ? 0.52 : 0.42, t0 = full ? 0.05 : 0.03;
    const over = M.ease.outBack(0.8 + 2.4 * I);
    const persp = 0.1 + 0.2 * I, thick = L.cw * (0.05 + 0.07 * I);
    const seam = full ? smooth(t, 0, 0.1) * (1 - smooth(t, 0.82, 0.94)) : 1 - smooth(t, 0.78, 0.94);
    const ix = p.gap * 0.06 * seam * L.cw;
    const H = region.y1 - region.y0, cy = (region.y0 + region.y1) / 2;
    const restFace = [], restBack = [], moving = [];
    for (let j = 0; j < n; j++) {
      const k = dir > 0 ? j : n - 1 - j;
      const a = t0 + (n > 1 ? k / (n - 1) : 0) * stagger;
      const u = span(t, a, a + len);
      let theta;
      if (full) {
        // a half turn to the negative, a held beat, and on round to the mark
        const pr = 0.5 * ease(span(u, 0, 0.42)) + 0.5 * (u >= 1 ? 1 : over(ease(span(u, 0.58, 1))));
        theta = 2 * PI * pr;
      } else {
        theta = PI * (1 - (u <= 0 ? 0 : u >= 1 ? 1 : over(ease(u))));
      }
      const x = region.x0 + j * L.cw;
      const rect = [x + ix, region.y0, L.cw - 2 * ix, H];
      const settled = u <= 0 || u >= 1 || (full && Math.abs(Math.sin(theta)) < 1e-6);
      if (settled && Math.cos(theta) < 0) restBack.push(rect);
      else if (settled) restFace.push(rect);
      else moving.push({ j, theta, rect, cx: x + L.cw / 2 });
    }
    const needBack = restBack.length > 0 || moving.some((m) => Math.cos(m.theta) < 0);
    const needFace = restFace.length > 0 || moving.some((m) => Math.cos(m.theta) >= 0);
    const face = needFace ? facePicture(ctx, p, pal, region, transparent) : null;
    const neg = needBack ? picture(ctx, 'negative', region, (s) => negative(s, p, pal, region)) : null;
    if (restFace.length) {
      ctx.save();
      clipRects(ctx, restFace);
      if (face) copy(ctx, face); else plainMark(ctx, p, pal);
      ctx.restore();
    }
    if (restBack.length) {
      ctx.save();
      clipRects(ctx, restBack);
      if (neg) copy(ctx, neg);
      else if (!transparent) {
        // no scratch canvas: paint the negative straight onto the board (holes in the paper colour)
        ctx.fillStyle = fieldColour(pal); ctx.fillRect(region.x0, region.y0, region.x1 - region.x0, H);
        const k = p.weight;
        for (const name of ['body', 'bar', 's']) M.stroke(ctx, HOLES[name], { width: M.widths[name] * k, colours: pal.bg });
      }
      ctx.restore();
    }
    if (!moving.length) return;
    const field = fieldColour(pal);
    const slatEdge = M.mix(field, SHADE, 0.45);
    // the slats nearest edge-on are drawn last (they stand out of the window's plane)
    moving.sort((a, b) => Math.abs(Math.cos(b.theta)) - Math.abs(Math.cos(a.theta)) || a.j - b.j);
    for (const m of moving) {
      const g = turned({ cx: m.cx, cy, w: m.rect[2], h: H, theta: m.theta, spin: dir, persp, lift: 1 });
      const away = 1 - Math.abs(g.cos);
      const pic = g.face ? face : neg;
      ctx.save();
      quad(ctx, g, cy); ctx.clip();
      if (pic) strips(ctx, pic, g, cy, m.rect[0], m.rect[1], m.rect[2], m.rect[3], px);
      else { ctx.fillStyle = g.face ? pal.bg : field; ctx.fill(); }
      ctx.restore();
      if (away > 0.002 && !(transparent && g.face)) { ctx.fillStyle = M.rgba(SHADE, (g.face ? 0.32 : 0.5) * away); quad(ctx, g, cy); ctx.fill(); }
      edge(ctx, g, cy, thick, slatEdge);
    }
  }

  Motion.register({
    id: 'tiles',
    name: 'Tiles',
    idea: 'The mark is printed across a board of cards: a wave turns them over one by one, each showing its piece of the mark, until the seams close and the board is the plain mark.',
    why: 'A board of cards is 5s itself (five cards a day, a mood board, a way of organising space); every turn flashes the app\'s colours, and the mark assembling from its squares says your pieces make a whole.',
    moments: ['tab', 'five-start', 'five-done', 'set-pin', 'bring'],
    styles: ['wave', 'shuffle', 'blinds'],
    params: {
      duration: { default: 900, min: 250, max: 3000, step: 50 },
      style: { default: 'wave', options: ['wave', 'shuffle', 'blinds'] },
      grid: { default: 5, min: 3, max: 7, step: 2 },               // about how many cards across the mark
      gap: { default: 0.4, min: 0, max: 1, step: 0.05 },           // the rim between cards while they move
      swatches: { default: true },                                 // the backs in the palette's colours (off: a tint of the ground)
      from: { default: 'board', options: ['board', 'mark'] },      // start on the board, or on the still mark and go all the way round
      easing: { default: 'inOutCubic', options: M.EASES.slice() }  // each card's turn or slide (an overshoot is added)
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const full = p.from === 'mark';
      const end = p.style === 'blinds' ? 0.95 : 0.95;
      if (t >= end || (full && t <= 0)) { plainMark(ctx, p, pal); return; }
      const transparent = !!env.transparent;
      const region = transparent ? SQUARE : env.view;
      const grid = M.clamp(Math.round(p.grid), 1, 15);
      const L = layout(region, grid);
      const px = 1 / Math.max(1e-6, (env.scale || 1) * (env.dpr || 1));   // one device pixel in mark units
      const ctxs = { pal, L, region, px, ease: M.easing(p.easing), I: p.intensity, full, transparent, dir: env.direction === 'left' ? -1 : 1 };
      if (p.style === 'shuffle') shuffle(ctx, t, p, env, ctxs);
      else if (p.style === 'blinds') blinds(ctx, t, p, env, ctxs);
      else wave(ctx, t, p, env, ctxs);
    }
  });
})();

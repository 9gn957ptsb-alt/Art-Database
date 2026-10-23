/* 5s Motion Lab: Collage (Decomposition & making).
 *
 * The mark arrives as torn paper fragments that settle into place, slightly off-register, like the
 * artist's collages. The pieces are torn scraps of one printed sheet: Voronoi cells around seeds on the
 * letters, every tear jagged, the same tear shared by the two scraps it separates (so they fit), each
 * scrap with a white fringe of paper fibre along its torn edges and a shadow on the table. They land and
 * settle a few units off from perfect: the seams stay visible, the mark is whole.
 *
 * Styles
 *   drop    the scraps fall onto the table from above, turning as they come, and land one after another
 *           with a small slap (their shadows snap in under them), then settle
 *   slide   the scraps are pushed in across the table from the edges, as a hand moves paper about, and get
 *           a last small nudge into place
 *   paste   a paste-up: one scrap at a time, from the bottom layer up, is lifted over its place and pressed
 *           down, so the mark builds up the way a collage is made
 *   gather  the scraps start as a loose pile in the middle and are dealt out to their places
 *
 * `register` sets how far off-register the scraps settle (0 = exactly the mark). The variant's seed
 * (env.rng) moves the tears, so every seed is torn differently; the same seed tears the same way.
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);
  const bump = (x) => Math.sin(Math.PI * clamp01(x));

  /* --- the sheet and its tears ------------------------------------------------------------------- */
  // the printed sheet's outline: loosely around the 5, the s and the ribbon (mark units)
  const SHEET = [[236, 136], [724, 132], [736, 318], [700, 404], [930, 432], [958, 566], [912, 650], [958, 770],
    [944, 904], [540, 954], [250, 936], [56, 840], [52, 640], [78, 470], [182, 296]];
  // where the scraps are centred: on the bar, stem, bowl, terminal, the s, and under the bowl
  const SEEDS = [[322, 214], [566, 214], [196, 388], [420, 446], [590, 610], [170, 766], [430, 836], [810, 520], [790, 790]];
  // the order the scraps land in (the paste-up's layering, bottom first)
  const ORDER = [6, 5, 2, 3, 4, 0, 1, 8, 7];

  // keep the part of polygon P on the side n . x <= c (Sutherland-Hodgman, one half-plane)
  function clipHalf(P, nx, ny, c) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const f = da / (da - db); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
    }
    return out;
  }

  // a deterministic hash in [0,1) from numbers (for tears both scraps must agree on)
  function hash(a, b, c) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x7f4a7c15, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // tear the straight edge a -> b: jagged points between them, the same for b -> a (reversed)
  function tear(a, b, salt) {
    const ka = Math.round(a[0] * 4) * 7919 + Math.round(a[1] * 4), kb = Math.round(b[0] * 4) * 7919 + Math.round(b[1] * 4);
    const flip = ka > kb;
    const p = flip ? b : a, q = flip ? a : b;
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    if (len < 1e-6) return [];
    const nx = -dy / len, ny = dx / len;
    const k = Math.max(2, Math.ceil(len / 13));
    const key = (Math.min(ka, kb) * 31 + Math.max(ka, kb)) | 0;
    const pts = [];
    let drift = 0;
    for (let i = 1; i < k; i++) {
      const f = i / k;
      drift = drift * 0.55 + (hash(key, i, salt) - 0.5) * 2;           // a wandering tear, not a zigzag
      const fine = (hash(key, i + 999, salt) - 0.5) * 6;              // the fibres
      const off = (drift * 9 + fine) * Math.sin(Math.PI * f) ** 0.35;  // pinned at the corners
      pts.push([p[0] + dx * f + nx * off, p[1] + dy * f + ny * off]);
    }
    return flip ? pts.reverse() : pts;
  }

  // the scraps for a seed: [{poly, c}], cached per seed (the tears are a function of the seed only)
  const scrapCache = new Map();
  function scraps(seed) {
    const key = String(seed);
    let s = scrapCache.get(key);
    if (s) return s;
    const r = M.rng('collage:' + key);
    const salt = Math.floor(r() * 1e6);
    const seeds = SEEDS.map((p) => [p[0] + (r() - 0.5) * 70, p[1] + (r() - 0.5) * 70]);
    s = seeds.map((si, i) => {
      let poly = SHEET.slice();
      seeds.forEach((sj, j) => {
        if (j === i) return;
        const nx = sj[0] - si[0], ny = sj[1] - si[1];
        const mx = (si[0] + sj[0]) / 2, my = (si[1] + sj[1]) / 2;
        poly = clipHalf(poly, nx, ny, nx * mx + ny * my);
      });
      // round the corners to the grid tear() keys on, then tear every edge
      poly = poly.map((p) => [Math.round(p[0] * 4) / 4, Math.round(p[1] * 4) / 4]);
      const torn = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], b = poly[(k + 1) % poly.length];
        torn.push(a);
        for (const q of tear(a, b, salt)) torn.push(q);
      }
      let cx = 0, cy = 0;
      for (const p of poly) { cx += p[0]; cy += p[1]; }
      const c = [cx / poly.length, cy / poly.length];
      // how this scrap comes in: a direction, a turn, a lift (all from the seed)
      const ang = TAU * r(), turn = (r() - 0.5) * 2, lift = r(), off = [(r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2];
      return { poly: torn, c, ang, turn, lift, off, i };
    });
    if (scrapCache.size > 24) scrapCache.delete(scrapCache.keys().next().value);
    scrapCache.set(key, s);
    return s;
  }

  /* --- the printed sheet, rendered once per size into a cached canvas ---------------------------- */
  const printCache = new Map();
  function makeCanvas(w, h) {
    if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    return null;
  }
  function print(ctx, pal, p) {
    const m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, c: 0, d: 1 };
    const sc = Math.max(0.05, Math.min(4, Math.round(Math.hypot(m.a, m.b) * 100) / 100));
    const key = [pal.name, pal.theme, p.weight, p.ribbon, sc].join('|');
    let c = printCache.get(key);
    if (c) return c;
    const size = Math.ceil(1000 * sc);
    const cv = makeCanvas(size, size);
    if (!cv) return null;
    const g = cv.getContext('2d');
    g.setTransform(sc, 0, 0, sc, 0, 0);
    M.mark(g, { palette: pal, weight: p.weight, ribbon: p.ribbon });
    c = { canvas: cv, size, sc };
    if (printCache.size > 12) printCache.delete(printCache.keys().next().value);
    printCache.set(key, c);
    return c;
  }

  function polyPath(ctx, poly) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }

  // one scrap: its shadow on the table, the paper, the print clipped to it, the white fibre along its tears
  function drawScrap(ctx, s, xf, look, sheet) {
    const h = xf.h;   // height above the table, 0..1
    ctx.save();
    ctx.translate(s.c[0] + xf.x, s.c[1] + xf.y);
    // the shadow, cast down-right, farther and fainter the higher the scrap is (three soft rings)
    const so = 5 + 70 * h, sa = look.shadow * (1 - 0.55 * h) * xf.alpha;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(so * (0.55 + 0.25 * k) * 0.7, so * (0.55 + 0.25 * k));
      ctx.rotate(xf.rot);
      const grow = xf.scale * (1 + (0.006 + 0.03 * h) * k);
      ctx.scale(grow, grow);
      ctx.translate(-s.c[0], -s.c[1]);
      ctx.globalAlpha = sa / 3;
      ctx.fillStyle = look.shade;
      polyPath(ctx, s.poly); ctx.fill();
      ctx.restore();
    }
    ctx.rotate(xf.rot);
    ctx.scale(xf.scale, xf.scale);
    ctx.translate(-s.c[0], -s.c[1]);
    ctx.globalAlpha = xf.alpha;
    polyPath(ctx, s.poly);
    ctx.fillStyle = look.paper;
    ctx.fill();
    ctx.save();
    polyPath(ctx, s.poly);
    ctx.clip();
    if (sheet) ctx.drawImage(sheet.canvas, 0, 0, sheet.size, sheet.size, 0, 0, sheet.size / sheet.sc, sheet.size / sheet.sc);
    // the torn edge: a band of bare paper fibre just inside the edge (the clip keeps the inner half)
    ctx.lineJoin = 'round';
    ctx.strokeStyle = look.fibre;
    ctx.lineWidth = 9;
    polyPath(ctx, s.poly); ctx.stroke();
    ctx.restore();
    // a hairline edge so the scrap reads on paper-coloured ground
    ctx.strokeStyle = look.edge;
    ctx.lineWidth = 1.6;
    polyPath(ctx, s.poly); ctx.stroke();
    ctx.restore();
  }

  function looks(pal) {
    const dark = pal.theme === 'dark' && (pal.base || pal.name) !== 'inverse' || ((pal.base || pal.name) === 'inverse' && pal.theme === 'light');
    const onColour = (pal.base || pal.name) === 'paper';
    if (onColour) return { paper: M.mix(pal.bg, '#FFFFFF', 0.14), fibre: M.mix(pal.bg, '#FFFFFF', 0.3), edge: M.rgba('#FFFFFF', 0.25), shade: '#1A0F45', shadow: 0.5 };
    if (dark) return { paper: M.mix(pal.bg, '#FFFFFF', 0.05), fibre: M.mix(pal.bg, '#FFFFFF', 0.34), edge: M.rgba('#FFFFFF', 0.08), shade: '#000000', shadow: 0.85 };
    return { paper: '#FFFFFF', fibre: '#FFFFFF', edge: M.rgba(pal.ink, 0.07), shade: M.mix(pal.ink, '#3A2E6E', 0.5), shadow: 0.3 };
  }

  /* --- choreography: each style gives every scrap {x, y, rot, scale, h, alpha} at t ------------- */
  // the residue: where a scrap settles, a few units off (register)
  const settleOf = (s, R) => ({ x: s.off[0] * 9 * R, y: s.off[1] * 9 * R, rot: s.off[2] * 0.035 * R });

  function landing(t, at, len, ease) {
    const u = win(t, at, len);
    return { u, e: ease(u) };
  }

  function styleDrop(s, rank, n, t, I, R, ease) {
    const at = 0.02 + rank * (0.5 / n), len = 0.34;
    const { u, e } = landing(t, at, len, ease);
    const fin = settleOf(s, R);
    const D = 140 + 260 * I;
    const fromX = Math.cos(s.ang) * D, fromY = Math.sin(s.ang) * D * 0.6 - 120 * I;
    const k = 1 - e;
    // the slap: a quick dip under 1 as the scrap lands, and a wobble that dies away
    const slap = -0.035 * bump((u - 0.86) / 0.14) * (0.5 + I);
    const wob = 0.05 * I * Math.sin(TAU * 1.5 * win(t, at + len * 0.9, 0.22)) * (1 - win(t, at + len * 0.9, 0.22));
    return {
      x: fin.x + fromX * k, y: fin.y + fromY * k,
      rot: fin.rot + s.turn * (0.5 + 0.8 * I) * k + wob,
      scale: 1 + (0.25 + 0.35 * I) * k + slap,
      h: k, alpha: M.smoothstep(0, 0.09, u)
    };
  }

  function styleSlide(s, rank, n, t, I, R, ease) {
    const at = 0.02 + rank * (0.42 / n), len = 0.4;
    const { u, e } = landing(t, at, len, ease);
    const fin = settleOf(s, R);
    // from the nearest edge of the view, along the scrap's own direction outward from the centre
    let dx = s.c[0] - 500, dy = s.c[1] - 500;
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const span = 520 + 380 * I;
    const k = 1 - e;
    // the nudge: a last small push after the slide stops (a hand squaring it up)
    const nudge = bump((t - (at + len) + 0.02) / 0.16);
    return {
      x: fin.x + dx * span * k - fin.x * 2.2 * nudge * (1 - k), y: fin.y + dy * span * k - fin.y * 2.2 * nudge * (1 - k),
      rot: fin.rot + s.turn * 0.7 * I * k + fin.rot * -1.5 * nudge,
      scale: 1 + 0.02 * bump(u),
      h: 0.12 * bump(u), alpha: M.smoothstep(0, 0.12, u)
    };
  }

  function stylePaste(s, rank, n, t, I, R, ease) {
    const at = 0.02 + rank * (0.66 / n), len = 0.2;
    const fin = settleOf(s, R);
    const appear = M.smoothstep(at, at + 0.06, t);
    const { u, e } = landing(t, at + 0.04, len, ease);
    const k = 1 - e;
    const press = -0.025 * bump((u - 0.7) / 0.3);
    return {
      x: fin.x + s.off[1] * 30 * I * k, y: fin.y - 60 * I * k,
      rot: fin.rot + s.turn * 0.18 * I * k,
      scale: 1 + (0.06 + 0.1 * I) * k + press,
      h: 0.55 * k, alpha: appear
    };
  }

  function styleGather(s, rank, n, t, I, R, ease) {
    const at = 0.18 + rank * (0.36 / n), len = 0.42;
    const fin = settleOf(s, R);
    // the pile: every scrap stacked loosely over the centre, a little turned, before it is dealt out
    const pileX = 500 - s.c[0] + (s.off[0] * 40 + (rank - n / 2) * 6) * (0.4 + I), pileY = 500 - s.c[1] + (s.off[1] * 40 - rank * 4) * (0.4 + I);
    const intro = M.smoothstep(0, 0.16, t);
    const { u, e } = landing(t, at, len, ease);
    const k = 1 - e;
    // dealt along an arc: the scrap lifts as it travels
    return {
      x: fin.x + pileX * k, y: fin.y + pileY * k - 50 * I * bump(u),
      rot: fin.rot + (s.turn * 0.9 + 0.12 * rank) * k,
      scale: (0.62 + 0.38 * e) * (0.92 + 0.08 * intro) + 0.06 * bump(u),
      h: 0.08 + 0.45 * bump(u) - 0.08 * e, alpha: intro
    };
  }

  Motion.register({
    id: 'collage',
    name: 'Collage',
    idea: 'The mark arrives as torn paper fragments that settle into place, slightly off-register, like the artist\'s collages.',
    why: '5s is a linear version of the artist\'s collaging: things put on the table and played with until they make one thing, familiar and new, the seams left showing.',
    moments: ['launch', 'bring', 'set-pin'],
    styles: ['drop', 'slide', 'paste', 'gather'],
    params: {
      duration: { default: 1500, min: 600, max: 3600, step: 50 },
      style: { default: 'drop', options: ['drop', 'slide', 'paste', 'gather'] },
      register: { default: 0.45, min: 0, max: 1, step: 0.05 },     // how far off-register the scraps settle
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, R = p.register;
      const list = scraps(env.seed);
      const sheet = print(ctx, pal, p);
      const look = looks(pal);
      const n = list.length;
      const states = ORDER.map((idx, rank) => {
        const s = list[idx];
        let xf;
        if (p.style === 'slide') xf = styleSlide(s, rank, n, t, I, R, ease);
        else if (p.style === 'paste') xf = stylePaste(s, rank, n, t, I, R, ease);
        else if (p.style === 'gather') xf = styleGather(s, rank, n, t, I, R, ease);
        else xf = styleDrop(s, rank, n, t, I, R, ease);
        return { s, xf, rank };
      });
      // scraps on the table first, the ones still in the air over them (highest last)
      const z = (st) => (st.xf.h > 0.02 ? 100 + st.xf.h * 10 : 0) + st.rank * 0.001;
      states.sort((a, b) => z(a) - z(b));
      for (const st of states) if (st.xf.alpha > 0.001) drawScrap(ctx, st.s, st.xf, look, sheet);
    }
  });
})();

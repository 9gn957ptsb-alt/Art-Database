/* 5s Motion Lab: Grow (Decomposition & making).
 *
 * The mark is extruded in true isometry and rises from a ground plane like a building; a seed of the s
 * sprouts first. It is the Seed tab's moment, "your ground, grown from your judgments": the same true-
 * isometric ground (edges at 30 degrees, all axes equal) the Seed tab draws its island on.
 *
 * It is drawn with a real orthographic camera (yaw psi, pitch phi): true isometry is psi = 45 degrees,
 * phi = 35.264 degrees; facing front is psi = phi = 0; looking straight down is phi = 90 degrees. The
 * letters are extruded by drawing their strokes as solid slices back to front (or bottom to top), the
 * face last in the logo's gradients, which is the right painter's order for an extrusion seen from above.
 * When `face` is on (the default) the camera comes round at the end, the depth folds away behind the
 * face, the ground drops out of view and the last frame is the flat mark, crisp and centred. With `face`
 * off it ends on the isometric world, the 5s standing on its ground.
 *
 * Styles
 *   sprout   a ground tile; a seed falls on it and the s sprouts from it, curling up from its tail and
 *            thickening into a solid; then the 5 rises out of the ground beside it like a building going
 *            up, the ribbon sweeps in behind, and the camera turns to face the mark
 *   extrude  the flat mark turns into isometry and is extruded as it turns, the ground sliding in under
 *            it: the logo becomes an object, then turns back to face you
 *   plan     the 5s lies on the ground as a plan (the s first, the ribbon a river through it); its walls
 *            go up stroke by stroke like a city, and the camera rises overhead until the roofs are the mark
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);
  const bump = (x) => Math.sin(Math.PI * clamp01(x));

  const ISO_PSI = Math.PI / 4, ISO_PHI = Math.atan(1 / Math.SQRT2);   // 45 degrees, 35.264 degrees
  const YG = 892;                                                     // the ground line under the letters
  const STROKES = [
    { key: 'body', pts: M.points('body', 160) },   // sampled as Marks.mark samples them
    { key: 'bar', pts: M.points('bar', 160) },
    { key: 's', pts: M.points('s', 160) }
  ];
  const IDX = { body: 0, bar: 1, s: 2 };

  /* --- the camera --------------------------------------------------------------------------------- */
  // c = {psi, phi, sg, ox, oy}; world: X right, Y up, Z toward the viewer
  // facade: letter (x, y) at depth z behind the face (X = x - 500, Y = YG - y, Z = -z)
  function facadeT(c, z) {
    const cp = Math.cos(c.psi), sp = Math.sin(c.psi), cf = Math.cos(c.phi), sf = Math.sin(c.phi);
    return [c.sg * cp, -c.sg * sp * sf, 0, c.sg * cf,
      c.ox + c.sg * (-500 * cp - z * sp), c.oy + c.sg * (-YG * cf + 500 * sp * sf - z * cp * sf)];
  }
  // plan: letter (x, y) lying on the ground at height h (X = x - 500, Z = y - 500, Y = h)
  function planT(c, h) {
    const cp = Math.cos(c.psi), sp = Math.sin(c.psi), cf = Math.cos(c.phi), sf = Math.sin(c.phi);
    return [c.sg * cp, -c.sg * sp * sf, c.sg * sp, c.sg * cp * sf,
      c.ox + c.sg * (-500 * cp - 500 * sp), c.oy + c.sg * (-h * cf + 500 * sp * sf - 500 * cp * sf)];
  }
  // a world point (X, Y, Z) to the screen
  function proj(c, X, Y, Z) {
    const cp = Math.cos(c.psi), sp = Math.sin(c.psi), cf = Math.cos(c.phi), sf = Math.sin(c.phi);
    return [c.ox + c.sg * (X * cp + Z * sp), c.oy + c.sg * (-Y * cf + (-X * sp + Z * cp) * sf)];
  }
  const lerpCam = (a, b, k) => ({ psi: M.lerp(a.psi, b.psi, k), phi: M.lerp(a.phi, b.phi, k), sg: M.lerp(a.sg, b.sg, k), ox: M.lerp(a.ox, b.ox, k), oy: M.lerp(a.oy, b.oy, k) });

  // the isometric camera that fits a set of world points into the view, centred
  function fitIso(points, margin) {
    const c0 = { psi: ISO_PSI, phi: ISO_PHI, sg: 1, ox: 0, oy: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of points) { const s = proj(c0, q[0], q[1], q[2]); x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); }
    const sg = (1000 - 2 * margin) / Math.max(x1 - x0, y1 - y0);
    return { psi: ISO_PSI, phi: ISO_PHI, sg, ox: 500 - sg * (x0 + x1) / 2, oy: 500 - sg * (y0 + y1) / 2 };
  }

  /* --- the ground --------------------------------------------------------------------------------- */
  // facade ground: x across, z in depth; plan ground: x across, y (toward the viewer)
  function groundQuads(mode, D) {
    if (mode === 'plan') return { x: [30, 970], z: [40, 990], cols: 4, rows: 4 };
    return { x: [70, 940], z: [-150, D + 130], cols: 4, rows: 3 };
  }
  function groundWorld(mode, gx, gz, Y) {
    return mode === 'plan' ? [gx - 500, Y, gz - 500] : [gx - 500, Y, -gz];
  }

  function drawGround(ctx, c, mode, D, look, alpha, grow) {
    if (alpha <= 0.002) return;
    const G = groundQuads(mode, D), T = 44;
    const cx = (G.x[0] + G.x[1]) / 2, cz = (G.z[0] + G.z[1]) / 2;
    const at = (gx, gz, Y) => {   // grow from the centre of the tile
      const p = groundWorld(mode, cx + (gx - cx) * grow, cz + (gz - cz) * grow, Y * grow);
      return proj(c, p[0], p[1], p[2]);
    };
    const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
    ctx.save();
    ctx.globalAlpha *= alpha;
    // the slab's two visible sides: the near edge and the right edge (the sides facing the viewer)
    const nearZ = mode === 'plan' ? G.z[1] : G.z[0];
    poly([at(G.x[0], nearZ, 0), at(G.x[1], nearZ, 0), at(G.x[1], nearZ, -T), at(G.x[0], nearZ, -T)]);
    ctx.fillStyle = look.sideA; ctx.fill();
    poly([at(G.x[1], G.z[0], 0), at(G.x[1], G.z[1], 0), at(G.x[1], G.z[1], -T), at(G.x[1], G.z[0], -T)]);
    ctx.fillStyle = look.sideB; ctx.fill();
    // the top: tiles, each a rhombus in true isometry, alternately a shade apart
    for (let i = 0; i < G.cols; i++) {
      for (let j = 0; j < G.rows; j++) {
        const xa = M.lerp(G.x[0], G.x[1], i / G.cols), xb = M.lerp(G.x[0], G.x[1], (i + 1) / G.cols);
        const za = M.lerp(G.z[0], G.z[1], j / G.rows), zb = M.lerp(G.z[0], G.z[1], (j + 1) / G.rows);
        poly([at(xa, za, 0), at(xb, za, 0), at(xb, zb, 0), at(xa, zb, 0)]);
        ctx.fillStyle = (i + j) % 2 ? look.tileA : look.tileB; ctx.fill();
      }
    }
    // the tile joints
    ctx.strokeStyle = look.joint;
    ctx.lineWidth = 3;
    for (let i = 0; i <= G.cols; i++) { const x = M.lerp(G.x[0], G.x[1], i / G.cols); const a = at(x, G.z[0], 0), b = at(x, G.z[1], 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    for (let j = 0; j <= G.rows; j++) { const z = M.lerp(G.z[0], G.z[1], j / G.rows); const a = at(G.x[0], z, 0), b = at(G.x[1], z, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.restore();
  }

  function looks(pal) {
    const dark = pal.theme === 'dark' ? (pal.base || pal.name) !== 'inverse' : (pal.base || pal.name) === 'inverse';
    const land = (pal.base || pal.name) === 'paper' ? '#FFFFFF' : pal.iris;
    const shade = dark ? '#05030B' : '#1E1236';
    return {
      dark, shade,
      tileA: M.mix(pal.bg, land, dark ? 0.16 : 0.1), tileB: M.mix(pal.bg, land, dark ? 0.22 : 0.15),
      joint: M.mix(pal.bg, land, dark ? 0.3 : 0.24),
      sideA: M.mix(M.mix(pal.bg, land, dark ? 0.22 : 0.28), shade, dark ? 0.45 : 0.22),
      sideB: M.mix(M.mix(pal.bg, land, dark ? 0.22 : 0.28), shade, dark ? 0.3 : 0.12)
    };
  }

  // the side colour of a stroke: its own middle colour in shade, deeper further back
  function sideColour(pal, look, key, f) {
    // the warmer, deeper end of the stroke's gradient, in shade (so the walls glow rather than go brown)
    const deep = M.mix(M.colourAt(pal[key], 0.4), M.colourAt(pal[key], 0.92), 0.6);
    return M.mix(deep, look.shade, (look.dark ? 0.3 : 0.2) + 0.2 * f);
  }

  // device pixels per mark unit at the current transform
  function devScale(ctx) { const m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 }; return Math.hypot(m.a, m.b) || 1; }

  /* --- extruded letters ---------------------------------------------------------------------------- */
  // items: [{key, depth, sink (letter units pushed down into the ground), from, to, wk (width factor), alpha}]
  // mode 'facade' (depth behind the face, clipped at the ground) or 'plan' (height above the ground)
  function extruded(ctx, c, mode, items, pal, p, look) {
    const ds = devScale(ctx);
    const cp = Math.cos(c.psi), sp = Math.sin(c.psi), cf = Math.cos(c.phi), sf = Math.sin(c.phi);
    // projected length of one unit of depth (facade) or height (plan), in device pixels
    const unit = mode === 'plan' ? c.sg * cf * ds : c.sg * Math.hypot(sp, cp * sf) * ds;
    const ops = [];
    items.forEach((it, k) => {
      if (!(it.to > it.from) || it.alpha <= 0) return;
      const px = it.depth * unit;
      const n = px < 0.6 ? 0 : Math.min(64, Math.ceil(px / 1.6));
      for (let i = n; i >= 1; i--) ops.push({ k, z: (it.depth * i) / n, f: i / n, roof: false });
      ops.push({ k, z: mode === 'plan' ? it.depth : 0, f: 0, roof: true });
    });
    // facade: back to front (deepest first); plan: bottom to top; faces/roofs after the sides at the same level
    if (mode === 'plan') {
      for (const o of ops) if (o.roof) o.z = items[o.k].depth;
      ops.forEach((o) => { if (!o.roof) o.z = items[o.k].depth - o.z; });
      ops.sort((a, b) => a.z - b.z || (a.roof ? 1 : 0) - (b.roof ? 1 : 0) || a.k - b.k);
    } else {
      ops.sort((a, b) => b.z - a.z || (a.roof ? 1 : 0) - (b.roof ? 1 : 0) || a.k - b.k);
    }
    for (const o of ops) {
      const it = items[o.k], s = STROKES[IDX[it.key]];
      const T = mode === 'plan' ? planT(c, o.z) : facadeT(c, o.z);
      ctx.save();
      ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
      // while a letter is still coming up out of the ground, the ground hides what is below it
      if (mode !== 'plan' && it.sink > 0.01) { ctx.beginPath(); ctx.rect(-3000, -3000, 7000, 3000 + YG); ctx.clip(); }
      if (it.sink) ctx.translate(0, it.sink);
      const width = M.widths[it.key] * p.weight * (it.wk == null ? 1 : it.wk);
      const colours = o.roof ? pal[it.key] : sideColour(pal, look, it.key, mode === 'plan' ? 1 - o.z / Math.max(1, it.depth) : o.f);
      M.stroke(ctx, s.pts, { width, from: it.from, to: it.to, colours, alpha: it.alpha });
      ctx.restore();
    }
  }

  function ribbonIn(ctx, c, mode, D, pal, along, t, alpha) {
    if (along <= 0.001 || alpha <= 0.001) return;
    const T = mode === 'plan' ? planT(c, 0) : facadeT(c, D + 40);
    ctx.save();
    ctx.transform(T[0], T[1], T[2], T[3], T[4], T[5]);
    M.ribbon(ctx, t, { colours: pal.ribbon, along, alpha });
    ctx.restore();
  }

  /* --- the cameras each style moves between -------------------------------------------------------- */
  const fitCache = new Map();
  function isoFor(mode, D) {
    const key = mode + D;
    let c = fitCache.get(key);
    if (c) return c;
    const G = groundQuads(mode, D), pts = [];
    for (const gx of G.x) for (const gz of G.z) for (const Y of [0, -44]) pts.push(groundWorld(mode, gx, gz, Y));
    if (mode === 'plan') { for (const gx of [90, 920]) for (const gy of [160, 930]) pts.push([gx - 500, D, gy - 500]); }
    else { for (const x of [90, 921]) for (const z of [0, D]) pts.push([x - 500, YG - 160, -z]); }
    c = fitIso(pts, 56);
    fitCache.set(key, c);
    return c;
  }
  const FRONT = { psi: 0, phi: 0, sg: 1, ox: 500, oy: YG };     // the flat mark, exactly
  const TOP = { psi: 0, phi: Math.PI / 2, sg: 1, ox: 500, oy: 500 };

  /* --- styles -------------------------------------------------------------------------------------- */
  function sprout(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, D = p.depth;
    const iso = isoFor('facade', D);
    const turn = p.face ? ease(M.smoothstep(0, 1, win(t, 0.7, 0.28))) : 0;
    const c = lerpCam(iso, FRONT, turn);
    // the ground: grows in, and drops away as the camera comes round
    const g = ease(M.smoothstep(0, 1, win(t, 0, 0.16)));
    drawGround(ctx, c, 'facade', D, look, (1 - M.smoothstep(0.1, 0.75, turn)) * Math.min(1, g * 3), 0.6 + 0.4 * g);
    // the seed: falls onto the ground at the s's foot, and is taken into the sprout
    const seedAt = [640, D * 0.5];
    const fall = win(t, 0.08, 0.12);
    const seedA = M.smoothstep(0.06, 0.1, t) * (1 - M.smoothstep(0.22, 0.3, t));
    if (seedA > 0.002) {
      const h = (1 - fall * fall) * 260, sq = 0.3 * bump((t - 0.2) / 0.05);
      const q = proj(c, seedAt[0] - 500, h, -seedAt[1]);
      ctx.save(); ctx.globalAlpha *= seedA;
      ctx.fillStyle = M.colourAt(pal.s, 0.85);
      ctx.beginPath(); ctx.ellipse(q[0], q[1] - 26 * c.sg, 32 * c.sg * (1 + sq), 32 * c.sg * (1 - sq), 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // the ribbon sweeps in behind
    if (p.ribbon) ribbonIn(ctx, c, 'facade', D, pal, ease(M.smoothstep(0.5, 0.85, t)), 0.15 * (1 - turn), 1);
    // the s sprouts: drawn up from its tail (thin, then full), and gains its depth as it matures
    const grow = ease(M.smoothstep(0, 1, win(t, 0.18, 0.3)));
    const mature = ease(M.smoothstep(0, 1, win(t, 0.3, 0.25)));
    // the 5 rises out of the ground: bowl first; a little past its height, then settles
    const r5 = ease(M.smoothstep(0, 1, win(t, 0.34, 0.34)));
    const over = 26 * (0.4 + I) * bump((win(t, 0.34, 0.34) - 0.6) / 0.4);
    const sink5 = (1 - r5) * 780 + over * -1;
    const items = [
      { key: 'body', depth: D * (0.3 + 0.7 * r5), sink: sink5, from: 0, to: 1, alpha: r5 > 0 ? 1 : 0 },
      { key: 'bar', depth: D * (0.3 + 0.7 * r5), sink: sink5 + 40 * (1 - r5), from: 0, to: 1, alpha: r5 > 0 ? 1 : 0 },
      { key: 's', depth: D * mature, sink: 0, from: 1 - grow, to: 1, wk: 0.35 + 0.65 * M.smoothstep(0, 1, grow), alpha: grow > 0 ? 1 : 0 }
    ];
    extruded(ctx, c, 'facade', items, pal, p, look);
  }

  function extrude(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, D = p.depth;
    const iso = isoFor('facade', D);
    // into isometry, a hold to see the object turn a touch further, then back to face you (or stay)
    const into = ease(M.smoothstep(0, 1, win(t, 0.04, 0.38)));
    const back = p.face ? ease(M.smoothstep(0, 1, win(t, 0.6, 0.36))) : 0;
    const drift = 0.2 * I * M.smoothstep(0.25, 0.65, t) * (1 - back);   // a slow turntable while it is an object
    let c = lerpCam(FRONT, iso, into);
    c = Object.assign({}, c, { psi: c.psi + drift });
    c = lerpCam(c, FRONT, back);
    const depth = D * (0.15 + 0.85 * into) * (1 + 0.1 * I * bump((win(t, 0.04, 0.38) - 0.55) / 0.45));
    drawGround(ctx, c, 'facade', D, look, into * (1 - M.smoothstep(0.05, 0.7, back)), 0.75 + 0.25 * into);
    if (p.ribbon) ribbonIn(ctx, c, 'facade', D, pal, 1, 0.2 * into * (1 - back), 1);
    // a touch of lift off the ground while it is an object
    const lift = -40 * I * bump(into * (1 - back));
    extruded(ctx, c, 'facade', ['body', 'bar', 's'].map((key) => ({ key, depth, sink: lift, from: 0, to: 1, alpha: 1 })), pal, p, look);
  }

  function plan(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, H = p.depth * 1.15;
    const iso = isoFor('plan', H);
    const up = p.face ? ease(M.smoothstep(0, 1, win(t, 0.68, 0.3))) : 0;
    const c = lerpCam(iso, TOP, up);
    const g = ease(M.smoothstep(0, 1, win(t, 0, 0.16)));
    drawGround(ctx, c, 'plan', H, look, (1 - M.smoothstep(0.2, 0.85, up)) * Math.min(1, g * 3), 0.6 + 0.4 * g);
    // the river first: the ribbon drawn along the ground
    if (p.ribbon) ribbonIn(ctx, c, 'plan', H, pal, ease(M.smoothstep(0.1, 0.5, t)), 0.1 * (1 - up), 1);
    // the plan drawn on the ground (the s first), then the walls go up stroke by stroke, a little past
    const drawn = (a) => ease(M.smoothstep(0, 1, win(t, a, 0.2)));
    const wall = (a) => { const u = win(t, a, 0.28); return ease(M.smoothstep(0, 1, u)) + 0.08 * (0.4 + I) * bump((u - 0.55) / 0.45); };
    const items = [
      { key: 'body', depth: H * Math.max(0, wall(0.4)), from: 0, to: drawn(0.16), alpha: 1 },
      { key: 'bar', depth: H * Math.max(0, wall(0.46)), from: 1 - drawn(0.22), to: 1, alpha: 1 },
      { key: 's', depth: H * Math.max(0, wall(0.32)), from: 0, to: drawn(0.08), alpha: 1 }
    ];
    extruded(ctx, c, 'plan', items, pal, p, look);
  }

  Motion.register({
    id: 'grow',
    name: 'Grow',
    idea: 'The mark is extruded in true isometry and rises from a ground plane like a building; a seed of the s sprouts first.',
    why: 'Seed is a world grown from a person\'s judgments: the mark plants itself, grows into something you could walk round, and turns back into the mark.',
    moments: ['seed'],
    styles: ['sprout', 'extrude', 'plan'],
    params: {
      duration: { default: 2400, min: 1000, max: 5000, step: 100 },
      style: { default: 'sprout', options: ['sprout', 'extrude', 'plan'] },
      depth: { default: 120, min: 40, max: 220, step: 10 },          // how deep the letters are extruded (mark units)
      face: { default: true },                                       // end facing front: the flat mark
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const ease = M.easing(p.easing);
      const I = p.intensity;
      const look = looks(env.palette);
      if (p.style === 'extrude') extrude(ctx, t, p, env, I, ease, look);
      else if (p.style === 'plan') plan(ctx, t, p, env, I, ease, look);
      else sprout(ctx, t, p, env, I, ease, look);
    }
  });
})();

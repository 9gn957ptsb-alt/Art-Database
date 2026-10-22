/* 5s Motion Lab: Path (Time & structure).
 *
 * The Path is the artist's month as eight milestones. Here the mark travels a dotted route of eight stops
 * and lights the next one: progress you can see, one stop at a time. `stop` is the milestone being reached
 * (1..8); the stops before it are already lit.
 *
 * Styles
 *   frame   the route is the logo's own rounded square: eight stops round the frame; a light runs from the last
 *           stop to the next, drawing the frame solid behind it, the stop lights, and the mark nods
 *   hop     the route is a winding road shaped like the s; the mark, small, hops from its stop to the next one,
 *           lands, lights it, then grows back to its place in the middle as the road fades
 *   trace   the route is the mark itself: eight stops along the 5 and the s; the colour runs on from the last
 *           stop to the next, and the rest of the mark waits in a pale tint, whole and legible
 */
(function () {
  'use strict';
  const M = Marks;
  const A = M.anchors;
  const TAU = Math.PI * 2;
  const span = (t, a, b) => M.clamp((t - a) / (b - a), 0, 1);
  const bump = (t, a, b) => { const x = span(t, a, b); return x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) ** 2; };

  const PTS = { bar: M.points('bar', 120), body: M.points('body', 260), s: M.points('s', 180) };

  /* --- the three routes ------------------------------------------------------------------------- */
  // frame: from the middle of the top edge, clockwise; stops at every eighth of the way round
  const FRAME = M.points('frame', 480);
  const F0 = 244 / M.length('frame');                          // the top edge's middle (the path starts at x 256)
  const FRAME_ROUTE = M.resample(FRAME.slice(Math.round(F0 * 479)).concat(FRAME.slice(1, Math.round(F0 * 479) + 1)), 480);
  // hop: the s, backwards (from its tail at the lower left up to its top at the right) and stretched to fill the
  // square: a winding road that climbs
  const S_ROUTE = M.resample(M.points('s', 200).slice().reverse().map(([x, y]) => [140 + ((x - 610) / 260) * 720, 300 + ((y - 504) / 327) * 585]), 300);
  // trace: the mark's own strokes, the 5 (bar backwards, then the body) and then the s
  const L_BAR = M.length('bar'), L_BODY = M.length('body'), L_S = M.length('s'), L_ALL = L_BAR + L_BODY + L_S;
  const FIVE = M.resample(PTS.bar.slice().reverse().concat(PTS.body), 360);
  const U5 = (L_BAR + L_BODY) / L_ALL;                          // where the 5 ends on the trace route

  // stops: frame at every eighth; the road and the trace evenly between a little in from each end
  const stopU = (style, i) => (style === 'frame' ? i / 8 : style === 'trace' ? (i + 1) / 8 : 0.04 + (0.92 * i) / 7);

  /* --- colour ------------------------------------------------------------------------------------- */
  function norm(colours) {
    if (!Array.isArray(colours)) return [[0, colours], [1, colours]];
    const n = colours.length;
    return colours.map((c, i) => (Array.isArray(c) ? [c[0], c[1]] : [n === 1 ? 0 : i / (n - 1), c]));
  }
  const fiveStops = new Map();
  function stopsFive(pal) {   // the 5's own colours along FIVE
    const key = pal.name + ':' + pal.theme;
    let s = fiveStops.get(key);
    if (!s) {
      const share = L_BAR / (L_BAR + L_BODY);
      s = norm(pal.bar).map(([u, c]) => [share * (1 - u), c]).concat(norm(pal.body).map(([u, c]) => [share + (1 - share) * u, c])).sort((a, b) => a[0] - b[0]);
      fiveStops.set(key, s);
    }
    return s;
  }
  // the route's colour: the frame's (blue to violet for the logo), shifted so it starts at the frame's top
  const routeColours = (pal) => pal.frame;

  /* --- drawing helpers ---------------------------------------------------------------------------- */
  // is a colour dark? (relative luminance): colour choices follow the actual background, not only the theme,
  // so the paper and inverse palettes read right too
  const isDark = (hex) => {
    const h = M.mix(hex, hex, 0), r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.25;
  };

  function disc(ctx, x, y, r, colour, alpha) {
    if (r <= 0.2 || alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function ring(ctx, x, y, r, w, colour, alpha) {
    if (r <= 0.2 || alpha <= 0.003 || w <= 0.2) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = colour; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // the dotted route: small dots every `gap` units of length, from u0 to u1
  function dots(ctx, pts, u0, u1, gap, r, colour, alpha) {
    const n = pts.length;
    let cum = 0, next = 0;
    const total = (() => { let s = 0; for (let i = 1; i < n; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; })();
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      while (next <= cum + d) {
        const f = (next - cum) / (d || 1), u = next / total;
        if (u >= u0 - 1e-6 && u <= u1 + 1e-6) {
          const x = M.lerp(pts[i - 1][0], pts[i][0], f), y = M.lerp(pts[i - 1][1], pts[i][1], f);
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
        }
        next += gap;
      }
      cum += d;
    }
    ctx.fill();
    ctx.restore();
  }
  function about(ctx, origin, sx, sy, draw) {
    ctx.save();
    ctx.translate(origin[0], origin[1]);
    ctx.scale(sx, sy);
    ctx.translate(-origin[0], -origin[1]);
    draw(ctx);
    ctx.restore();
  }
  function mark(ctx, p, pal, ribbonT) {
    const k = p.weight;
    if (p.ribbon) M.ribbon(ctx, ribbonT || 0, { colours: pal.ribbon });
    M.stroke(ctx, PTS.body, { width: M.widths.body * k, colours: pal.body });
    M.stroke(ctx, PTS.bar, { width: M.widths.bar * k, colours: pal.bar });
    M.stroke(ctx, PTS.s, { width: M.widths.s * k, colours: pal.s });
  }

  Motion.register({
    id: 'path',
    name: 'Path',
    idea: 'The mark travels a dotted route of eight stops and lights the next one.',
    why: 'Progress on the Path: the artist\'s month as eight milestones, reached one stop at a time, each one lit.',
    moments: ['path'],
    styles: ['frame', 'hop', 'trace'],
    params: {
      duration: { default: 1200, min: 600, max: 3000, step: 50 },
      style: { default: 'frame', options: ['frame', 'hop', 'trace'] },
      stop: { default: 3, min: 1, max: 8, step: 1 },             // the milestone being reached (the ones before are lit)
      easing: { default: 'inOutCubic', options: M.EASES.slice() }
    },
    reduced: 'cut',
    loop: false,

    draw(ctx, t, p, env) {
      const pal = env.palette;
      const ease = M.easing(p.easing);
      const I = p.intensity, k = p.weight;
      const dark = isDark(pal.bg);
      const n = Math.round(M.clamp(p.stop, 1, 8));                 // reaching stop n (1-based); 1..n-1 are lit
      const dim = M.mix(pal.ink, pal.bg, dark ? 0.55 : 0.62);
      const rc = routeColours(pal);
      const light = dark ? '#FFFFFF' : '#FFF6E0';

      if (p.style === 'trace') {
        // the mark in a pale tint, whole; colour up to the last stop; the colour runs on to the next one
        const u0 = stopU('trace', n - 2 < 0 ? -1 : n - 2), u1 = stopU('trace', n - 1);
        const from = n === 1 ? 0 : u0;
        const run = ease(span(t, 0.08, 0.62));
        const reach = M.lerp(from, u1, run);
        const W = M.widths.body * k, WS = M.widths.s * k;
        // the part still ahead: a pale, quieter tint of its own colours (in the dark, toward the ink first, so it
        // reads as a light tone and not a muddy one)
        const pale = (cols) => norm(cols).map(([u, c]) => [u, dark ? M.mix(M.mix(c, pal.ink, 0.5), pal.bg, 0.74) : M.mix(c, pal.bg, 0.74)]);
        const c5 = stopsFive(pal);
        const nod = 1 + 0.03 * I * bump(t, 0.58, 0.82) - 0.012 * I * bump(t, 0, 0.1);
        about(ctx, A.letters, nod, nod, (c) => {
          if (p.ribbon) M.ribbon(c, 0, { colours: pal.ribbon, alpha: 0.25 + 0.75 * (n === 8 ? span(t, 0.6, 0.9) : (n - 1 + run) / 8) });
          // pale first (the whole mark), then the coloured part over it
          M.stroke(c, PTS.body, { width: W, colours: pale(pal.body) });
          M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pale(pal.bar) });
          M.stroke(c, PTS.s, { width: WS, colours: pale(pal.s) });
          const f5 = Math.min(1, reach / U5), fs = M.clamp((reach - U5) / (1 - U5), 0, 1);
          if (f5 > 0) {
            if (f5 >= 1) { M.stroke(c, PTS.body, { width: W, colours: pal.body }); M.stroke(c, PTS.bar, { width: M.widths.bar * k, colours: pal.bar }); }
            else M.stroke(c, FIVE, { width: W, colours: c5, to: f5 });
          }
          if (fs > 0) M.stroke(c, PTS.s, { width: WS, colours: pal.s, to: fs });
          // the stops: small marks on the line; lit ones bright, the next one ringing when reached
          const at = (u) => (u <= U5 ? M.at(FIVE, u / U5) : M.at(PTS.s, (u - U5) / (1 - U5)));
          for (let i = 0; i < 8; i++) {
            const q = at(Math.min(stopU('trace', i), 0.9999));
            const lit = i < n - 1 || (i === n - 1 && run >= 1);
            const pop = i === n - 1 ? bump(t, 0.6, 0.8) : 0;
            disc(c, q.x, q.y, (lit ? 15 : 10) * k * (1 + 0.6 * I * pop), lit ? '#FFFFFF' : M.mix(pal.bg, pal.ink, 0.25), lit ? 0.95 : 0.8);
            if (i === n - 1) {
              const burst = span(t, 0.6, 0.95);
              if (burst > 0 && burst < 1) ring(c, q.x, q.y, (20 + 110 * ease(burst)) * (0.6 + 0.6 * I), 8 * (1 - burst), light === '#FFFFFF' ? pal.iris : pal.flare, 0.9 * (1 - burst));
            }
          }
          // the light at the front of the colour while it runs
          if (run > 0 && run < 1) {
            const q = at(Math.min(reach, 0.9999));
            disc(c, q.x, q.y, 22 * k, light, 0.75 * Math.sin(Math.PI * run));
          }
        });
        return;
      }

      if (p.style === 'hop') {
        const route = S_ROUTE;
        const uA = n === 1 ? 0 : stopU('hop', n - 2), uB = stopU('hop', n - 1);
        const pA = M.at(route, uA), pB = M.at(route, uB);
        // timeline: crouch, hop, land and light, then grow back into the middle as the road fades
        const crouch = bump(t, 0.0, 0.12), fly = span(t, 0.08, 0.38), land = bump(t, 0.36, 0.5);
        const grow = M.ease.inOutCubic(span(t, 0.5, 0.9));
        const fade = 1 - ease(span(t, 0.52, 0.86));
        const flyE = M.ease.inOutSine(fly);
        const hx = M.lerp(pA.x, pB.x, flyE), hy0 = M.lerp(pA.y, pB.y, flyE);
        // the hop's height, kept low enough that the small mark never leaves the top of the view
        const room = Math.max(0, Math.min(pA.y, pB.y) - (880 - 160) * 0.24 - env.view.y0 - 20);
        const height = Math.min(120 + 120 * I, room) * 4 * fly * (1 - fly);
        const small = 0.24;
        // the road: dots, the walked part solid, the stops
        if (fade > 0.003) {
          const walked = n === 1 ? 0 : uA, walkedNow = n === 1 ? 0 : M.lerp(uA, uB, ease(span(t, 0.12, 0.42)));
          dots(ctx, route, walkedNow, 1, 26, 6.5 * k, dim, fade);
          if (walkedNow > 0.001) M.stroke(ctx, route, { width: 16 * k, colours: rc, to: walkedNow, alpha: fade });
          void walked;
          for (let i = 0; i < 8; i++) {
            const q = M.at(route, stopU('hop', i));
            const lit = i < n - 1 || (i === n - 1 && t >= 0.4);
            const pop = i === n - 1 ? bump(t, 0.38, 0.56) : 0;
            const r = (24 + 14 * I * pop) * k;
            if (lit) disc(ctx, q.x, q.y, r, M.colourAt(rc, stopU('hop', i)), fade);
            else { disc(ctx, q.x, q.y, r, pal.bg, fade); ring(ctx, q.x, q.y, r - 4 * k, 7 * k, dim, fade); }
            if (i === n - 1) {
              const burst = span(t, 0.38, 0.72);
              if (burst > 0 && burst < 1) ring(ctx, q.x, q.y, r + 130 * ease(burst) * (0.5 + 0.5 * I), 9 * (1 - burst) * k, M.colourAt(rc, stopU('hop', i)), fade * (1 - burst));
            }
          }
        }
        // the mark: small, standing on its stop (its foot on the road), hopping, then growing to its place
        const footY = 880, sc = M.lerp(small, 1, grow);
        const stand = [hx, hy0 - height];
        const pos = [M.lerp(stand[0], A.letters[0], grow), M.lerp(stand[1] - (footY - A.letters[1]) * small, A.letters[1], grow)];
        // squash and stretch: crouch before, stretch in flight, squash on landing, and a last settle
        const sq = 0.16 * I * (crouch + land) * (1 - grow) - 0.1 * I * Math.sin(Math.PI * fly) * (fly > 0 && fly < 1 ? 1 : 0);
        const settle = 0.025 * I * bump(t, 0.86, 1);
        ctx.save();
        ctx.translate(pos[0], pos[1] + (footY - A.letters[1]) * sc);
        ctx.scale(sc * (1 + sq * 0.7 + settle), sc * (1 - sq + settle));
        ctx.translate(-A.letters[0], -footY);
        mark(ctx, p, pal, 0);
        ctx.restore();
        return;
      }

      // frame: eight stops round the logo's rounded square
      const route = FRAME_ROUTE;
      // reaching the first stop, the light runs once round the whole frame first: the path ahead, shown once
      const uA = n === 1 ? -1 : stopU('frame', n - 2), uB = stopU('frame', n - 1);
      const run = ease(span(t, 0.08, 0.6));
      const head = M.lerp(uA, uB, run);
      const lit = (i) => i < n - 1 || (i === n - 1 && run >= 1);
      // the frame's colours start at its top-middle here, so take them along the route
      const fw = M.widths.frame * k;
      const solid = n === 1 ? 0 : head;
      dots(ctx, route, Math.max(0, solid), 1, 3429 / 72, 8 * k, dim, 1);
      if (solid > 0) M.stroke(ctx, route, { width: fw, colours: rc, to: Math.min(1, solid) });
      // the light at the head as it runs: a bright bead with a comet's tail along the frame
      if (run > 0 && run < 1) {
        const h = head < 0 ? head + 1 : head;                     // the first stop's lap wraps round
        const q = M.at(route, h);
        const tail = Math.max(0, h - 0.06);
        const glow = Math.sin(Math.PI * run) ** 0.5;
        if (h > tail + 1e-4) {
          const stops = [];
          for (let i = 0; i <= 8; i++) { const u = M.lerp(tail, h, i / 8); stops.push([u, M.mix(M.colourAt(rc, u), light, 0.85 * (i / 8) ** 2)]); }
          M.stroke(ctx, route, { width: fw * (n === 1 ? 0.8 : 0.55), colours: stops, from: tail, to: h, alpha: n === 1 ? glow : 1 });
        }
        disc(ctx, q.x, q.y, fw * 0.62, M.colourAt(rc, h), glow);
        disc(ctx, q.x, q.y, fw * 0.36, light, glow);
      }
      for (let i = 0; i < 8; i++) {
        const q = M.at(route, stopU('frame', i));
        const pop = i === n - 1 ? bump(t, 0.58, 0.78) : 0;
        const r = (36 + 16 * I * pop) * k;
        if (lit(i)) {
          disc(ctx, q.x, q.y, r, M.colourAt(rc, stopU('frame', i)), 1);
          disc(ctx, q.x, q.y, r * 0.38, pal.bg, 1);
        } else {
          disc(ctx, q.x, q.y, r, pal.bg, 1);
          ring(ctx, q.x, q.y, r - 5 * k, 8 * k, dim, 1);
        }
        if (i === n - 1) {
          const burst = span(t, 0.58, 0.92);
          if (burst > 0 && burst < 1) ring(ctx, q.x, q.y, r + 120 * ease(burst) * (0.5 + 0.5 * I), 10 * (1 - burst) * k, M.colourAt(rc, stopU('frame', i)), 1 - burst);
        }
      }
      // the mark: it leans a little toward the light as it runs, and nods when the stop lights
      const q = M.at(route, M.clamp(head, 0, 1));
      const lean = 0.035 * I * Math.sin(Math.PI * run) * Math.sign(q.x - 500 || 1);
      const nod = 1 + 0.04 * I * bump(t, 0.6, 0.86) - 0.015 * I * bump(t, 0, 0.12);
      ctx.save();
      ctx.translate(A.letters[0], 880);
      ctx.rotate(lean);
      ctx.scale(nod, nod);
      ctx.translate(-A.letters[0], -880);
      mark(ctx, p, pal, 0.1 * I * Math.sin(Math.PI * run));
      ctx.restore();
    }
  });
})();

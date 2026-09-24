// ---- wanderers: after the digital animations that walk --------------------------------------------------
// Four kinds of life cross DIRT's plane on its surface, over everything, drawn a pixel a cell into the life layer
// like the forest's creatures, each wearing a saved painting's colours (on paper, the artist's inks) and naming it:
//
//  the procession   after Universal Everything's Infinity and Transfiguration: an endless line of walkers, each
//                   one generated anew (its build, its gait, its head), whose material changes as it walks: paint,
//                   chalk, soil, bubbles, smoke, flowers, data, drips
//  migrations       after Universal Everything's Migrations: herds of invented creatures moving with real animals'
//                   gaits (a kangaroo's hop, an elephant's stomp, an ostrich's run, a caterpillar's crawl, a bird's
//                   swoop), under an artificial day and night
//  the walking city after Universal Everything's Walking City: a tower of pasted plates on long legs, stepping
//  primitives       after Radiohead and Universal Everything's PolyFauna and David OReilly's The External World:
//                   crude flat-shaded polyhedral organisms that twitch, glitch and wander
//
// They keep to the plane (not the Earth) and are still under reduced motion (they do not appear).

const WANDER = { walkers: [], herd: [], city: null, prims: [], bits: [], nextProcession: 0, nextHerd: 610, nextCity: 1597 };
/** Colours for a wanderer: on paper, one of the artist's works' inks; else the painting under it. */
function wanderInks(x, y, seed) {
  if (typeof ON_PAPER !== "undefined" && ON_PAPER && ART && ART.works.length) {
    const w = ART.works[seed % ART.works.length], rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const inks = w.inks.map(([h]) => rgb(h)).sort((a, b) => lum(a) - lum(b));
    while (inks.length < 3) inks.push(rgb(w.paper).map((v) => v * 0.618));
    return { cols: inks, dark: inks[0], mid: inks[inks.length >> 1], light: inks[inks.length - 1], vivid: [...inks].sort((a, b) => chroma(b) - chroma(a))[0], w: Math.max(0, workAt(x, y)) };
  }
  const wk = Math.max(0, workAt(x, y)), P = paletteOf(wk, 0);
  return { cols: P.cols.map(pop), dark: P.dark, mid: pop(P.mid), light: pop(P.light), vivid: pop(P.vivid), w: wk };
}
// Drawing, a cell at a time.
function capsule(x0, y0, x1, y1, r, rgb, a, w) {
  const xa = Math.floor(Math.min(x0, x1) - r), xb = Math.ceil(Math.max(x0, x1) + r), ya = Math.floor(Math.min(y0, y1) - r), yb = Math.ceil(Math.max(y0, y1) + r);
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2));
    if (Math.hypot(x + 0.5 - x0 - dx * t, y + 0.5 - y0 - dy * t) <= r) put(x, y, typeof rgb === "function" ? rgb(x, y) : rgb, a, w);
  }
}
function ellipse(cx, cy, rx, ry, rgb, a, w, ring) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const e = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    if (ring ? Math.abs(e - 1) * Math.min(rx, ry) < 0.7 : e <= 1) put(x, y, typeof rgb === "function" ? rgb(x, y) : rgb, a, w);
  }
}
function triangle(ax, ay, bx, by, cx, cy, rgb, a, w) {
  const xa = Math.floor(Math.min(ax, bx, cx)), xb = Math.ceil(Math.max(ax, bx, cx)), ya = Math.floor(Math.min(ay, by, cy)), yb = Math.ceil(Math.max(ay, by, cy));
  const e = (px, py, x0, y0, x1, y1) => (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0);
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const px = x + 0.5, py = y + 0.5, e0 = e(px, py, ax, ay, bx, by), e1 = e(px, py, bx, by, cx, cy), e2 = e(px, py, cx, cy, ax, ay);
    if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) put(x, y, rgb, a, w);
  }
}
const onPlane = () => typeof MODE === "undefined" || MODE === "plane";

// ---- the procession ---------------------------------------------------------------------------------------
const MATERIALS = ["paint", "chalk", "soil", "bubbles", "smoke", "flowers", "data", "drips"];
function newWalker(k, lane, dir, x) {
  const h = mix(k * 2654435761 + lane.seed);
  const u = (n) => unitOf(h + n * 40503);
  return { k, x, y: lane.y + (u(1) - 0.5) * 8, dir, lane, seed: h,
           H: 21 + 13 * u(2), head: 0.1 + 0.08 * u(3), legs: 0.42 + 0.14 * u(4), arms: 0.3 + 0.14 * u(5), wide: 0.06 + 0.07 * u(6),
           speed: 0.38 + 0.3 * u(7), swing: 0.35 + 0.35 * u(8), hat: u(9) < 0.3, lean: (u(10) - 0.5) * 0.3, phase: u(11) * TAU,
           inks: wanderInks(x, lane.y, h) };
}
/** Which material a walker is made of where it stands: bands 144 cells wide along its way, each a material. */
function materialAt(W, x) {
  const f = x / 144 + W.lane.seed % 8, i = Math.floor(f), t = f - i;
  return [MATERIALS[mod(i, 8)], MATERIALS[mod(i + 1, 8)], t];
}
function drawWalker(W, t) {
  const c = W.inks, H = W.H, sway = Math.sin(W.phase), sway2 = Math.sin(W.phase + Math.PI);
  const hipX = W.x, hipY = W.y - H * W.legs, shX = hipX + W.lean * H * 0.3, shY = hipY - H * (1 - W.legs - W.head * 2);
  const [m0, m1, blend] = materialAt(W, W.x);
  // each cell of the body takes one material or the next, by a dither that moves as the walker crosses the band
  const fill = (x, y) => {
    const m = unitOf(Math.floor(x) * 73856093 ^ Math.floor(y) * 19349663) < blend ? m1 : m0;
    const g = unitOf(Math.floor(x) * 83492791 ^ Math.floor(y) * 2971215073 ^ (t >> 3));
    switch (m) {
      case "paint": return g < 0.5 ? c.vivid : c.mid;
      case "chalk": return g < 0.7 ? [236, 234, 228] : [150, 150, 152];
      case "soil": return c.cols[Math.floor(g * c.cols.length)];
      case "bubbles": return g < 0.2 ? [245, 248, 252] : c.light;
      case "smoke": return lift(c.mid, 0.5 + 0.3 * g);
      case "flowers": return g < 0.15 ? c.vivid : g < 0.3 ? [245, 235, 120] : c.dark.map((v) => v * 0.8 + 30);
      case "data": return ((Math.floor(x) + Math.floor(y) + (t >> 2)) & 1) ? [240, 240, 240] : [8, 8, 8];
      default: return c.dark;
    }
  };
  const lw = Math.max(1, H * W.wide), w = c.w;
  const leg = (s) => {
    const kx = hipX + s * H * 0.12, ky = hipY + H * W.legs * 0.5, fx = hipX + s * H * 0.22, fy = W.y - Math.max(0, -s) * H * 0.06;
    capsule(hipX, hipY, kx, ky, lw * 0.55, fill, 1, w); capsule(kx, ky, fx, fy, lw * 0.5, fill, 1, w);
  };
  leg(sway * W.swing); leg(sway2 * W.swing);
  capsule(hipX, hipY, shX, shY, lw, fill, 1, w);                                   // the body
  const arm = (s) => { const ex = shX + s * H * 0.1, ey = shY + H * W.arms * 0.5; capsule(shX, shY, ex, ey, lw * 0.45, fill, 1, w); capsule(ex, ey, ex + s * H * 0.06, shY + H * W.arms, lw * 0.4, fill, 1, w); };
  arm(sway2 * W.swing); arm(sway * W.swing);
  const hr = H * W.head;
  ellipse(shX + W.lean * 2, shY - hr * 1.2, hr, hr * 1.1, fill, 1, w);
  if (W.hat) capsule(shX - hr * 1.2, shY - hr * 2.2, shX + hr * 1.2, shY - hr * 2.2, 0.8, c.dark, 1, w);
  // what a material gives off: bubbles rise, smoke drifts, drips fall, flowers drop petals
  const m = blend < 0.5 ? m0 : m1;
  if ((t & 7) === 0 && WANDER.bits.length < 987) {
    const bx = hipX + (rnd() - 0.5) * H * 0.3, by = shY + rnd() * H * 0.6;
    if (m === "bubbles") WANDER.bits.push({ x: bx, y: by, vx: 0, vy: -0.25, life: 89, kind: "ring", r: 1 + rnd() * 2, c: [240, 244, 250], w });
    else if (m === "smoke") WANDER.bits.push({ x: bx, y: by, vx: -W.dir * 0.1, vy: -0.15, life: 89, kind: "puff", r: 1.5 + rnd() * 2, c: lift(c.mid, 0.6), w });
    else if (m === "drips") WANDER.bits.push({ x: bx, y: W.y - 2, vx: 0, vy: 0.6, life: 34, kind: "drop", r: 0.5, c: c.dark, w });
    else if (m === "flowers") WANDER.bits.push({ x: bx, y: by, vx: -W.dir * 0.05, vy: 0.2, life: 55, kind: "drop", r: 0.6, c: c.vivid, w });
  }
}
function stepProcession(t) {
  const P = WANDER;
  if (!P.lane && t >= P.nextProcession) {
    const dir = rnd() < 0.5 ? 1 : -1;
    P.lane = { y: vy + VH * (0.3 + 0.5 * rnd()), dir, seed: (rnd() * 2 ** 31) | 0, n: 8 + Math.floor(rnd() * 13), made: 0, next: 0 };
  }
  const L = P.lane;
  if (L && L.made < L.n && t >= L.next) {
    const x = L.dir > 0 ? vx - 21 : vx + VW + 21;
    P.walkers.push(newWalker(L.made++, L, L.dir, x));
    L.next = t + 34 + Math.floor(rnd() * 21);
  }
  for (const W of P.walkers) { W.x += W.dir * W.speed; W.phase += W.speed * 0.19; }
  P.walkers = P.walkers.filter((W) => W.x > vx - 89 && W.x < vx + VW + 89);
  if (L && L.made >= L.n && !P.walkers.length) { P.lane = null; P.nextProcession = t + 610 + Math.floor(rnd() * 987); }
}

// ---- migrations -------------------------------------------------------------------------------------------
const GAITS = ["hop", "stomp", "run", "crawl", "swoop"];
function newBeast(gait, x, y, dir, seed) {
  const u = (n) => unitOf(seed + n * 2246822519);
  const size = { hop: 13, stomp: 21, run: 11, crawl: 8, swoop: 10 }[gait] * (0.8 + 0.5 * u(1));
  const blobs = Array.from({ length: 2 + Math.floor(u(2) * 3) }, (_, i) => ({ dx: (u(3 + i) - 0.5) * size * 0.8, dy: (u(8 + i) - 0.5) * size * 0.4, rx: size * (0.3 + 0.3 * u(13 + i)), ry: size * (0.2 + 0.2 * u(18 + i)) }));
  return { gait, x, y, dir, seed, size, blobs, phase: u(23) * TAU, speed: { hop: 0.9, stomp: 0.3, run: 1.1, crawl: 0.2, swoop: 1.0 }[gait] * (0.8 + 0.4 * u(24)), inks: wanderInks(x, y, seed) };
}
function drawBeast(B, t) {
  const c = B.inks, s = B.size, w = c.w, ph = B.phase;
  let bx = B.x, by = B.y;
  if (B.gait === "hop") by -= Math.max(0, Math.sin(ph)) * s * 1.2;
  if (B.gait === "swoop") by -= s * 1.5 + Math.sin(ph * 0.3) * s;
  if (B.gait === "run") by -= s * 1.6 + Math.abs(Math.sin(ph)) * 1.5;
  if (B.gait === "stomp") by -= s * 0.9;
  // legs, as the animal moves them
  const legs = (n, len, lift) => {
    for (let i = 0; i < n; i++) {
      const lx = bx + (i / Math.max(1, n - 1) - 0.5) * s * 0.9, a = Math.sin(ph + (i % 2) * Math.PI);
      const fx = lx + a * len * 0.35 * B.dir, fy = B.y - Math.max(0, a) * lift;
      capsule(lx, by + s * 0.2, fx, fy, B.gait === "stomp" ? s * 0.12 : 0.6, c.dark, 1, w);
    }
  };
  if (B.gait === "stomp") legs(4, s * 0.6, s * 0.15);
  if (B.gait === "run") legs(2, s * 1.4, s * 0.4);
  if (B.gait === "hop") { const k = Math.max(0, Math.sin(ph)); capsule(bx, by + s * 0.2, bx - B.dir * s * (0.2 + 0.4 * k), B.y, 1, c.dark, 1, w); }
  if (B.gait === "crawl") {
    for (let i = 0; i < 8; i++) {
      const ox = bx - B.dir * i * s * 0.35, oy = B.y - s * 0.3 - Math.max(0, Math.sin(ph - i * 0.8)) * s * 0.5;
      ellipse(ox, oy, s * 0.3, s * 0.3, i % 2 ? c.vivid : c.mid, 1, w);
    }
    return;
  }
  for (const b of B.blobs) ellipse(bx + b.dx * B.dir, by + b.dy, b.rx, b.ry, b === B.blobs[0] ? c.vivid : c.mid, 1, w);
  if (B.gait === "swoop") { const f = Math.sin(ph * 2) * s * 0.8; capsule(bx, by, bx - B.dir * s * 0.4, by - f, 0.8, c.dark, 1, w); capsule(bx, by, bx + B.dir * s * 0.2, by - f * 0.8, 0.8, c.dark, 1, w); }
  if (B.gait === "run") capsule(bx + B.dir * s * 0.3, by, bx + B.dir * s * 0.6, by - s * (0.9 + 0.2 * Math.sin(ph * 2)), 0.8, c.dark, 1, w);   // the neck
  put(bx + B.dir * s * 0.45, by - s * 0.1, [12, 12, 12], 1, w);                                 // an eye
}
function stepHerd(t) {
  const P = WANDER;
  if (!P.herd.length && t >= P.nextHerd) {
    const gait = GAITS[Math.floor(rnd() * GAITS.length)], dir = rnd() < 0.5 ? 1 : -1, y = vy + VH * (0.35 + 0.5 * rnd()), n = 3 + Math.floor(rnd() * 6), seed = (rnd() * 2 ** 31) | 0;
    for (let i = 0; i < n; i++) P.herd.push(newBeast(gait, (dir > 0 ? vx - 34 : vx + VW + 34) - dir * i * 21 * (0.7 + 0.6 * rnd()), y + (rnd() - 0.5) * 34, dir, seed + i * 7919));
  }
  for (const B of P.herd) { B.x += B.dir * B.speed; B.phase += B.speed * 0.21; }
  P.herd = P.herd.filter((B) => B.dir > 0 ? B.x < vx + VW + 89 : B.x > vx - 89);
  if (!P.herd.length && t >= P.nextHerd) P.nextHerd = t + 377 + Math.floor(rnd() * 610);
}

// ---- the walking city -------------------------------------------------------------------------------------
function stepCity(t) {
  const P = WANDER;
  if (!P.city && t >= P.nextCity) {
    const dir = rnd() < 0.5 ? 1 : -1, seed = (rnd() * 2 ** 31) | 0;
    const floors = Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => ({ w: 21 + rnd() * 34, h: 8 + rnd() * 13, dx: (rnd() - 0.5) * 13 }));
    P.city = { x: dir > 0 ? vx - 55 : vx + VW + 55, y: vy + VH * (0.6 + 0.3 * rnd()), dir, seed, floors, phase: 0, legs: 6, inks: wanderInks(vx, vy, seed) };
  }
  const C = P.city;
  if (!C) return;
  C.x += C.dir * 0.22; C.phase += 0.05;
  if (C.dir > 0 ? C.x > vx + VW + 89 : C.x < vx - 89) { P.city = null; P.nextCity = t + 1597 + Math.floor(rnd() * 1597); }
}
function drawCity(C) {
  const c = C.inks, w = c.w, legH = 34, baseY = C.y - legH;
  for (let i = 0; i < C.legs; i++) {
    const lx = C.x + (i / (C.legs - 1) - 0.5) * 34, a = Math.sin(C.phase + i * 2.1), kx = lx + C.dir * 5 + a * 3, ky = baseY + legH * 0.45 - Math.max(0, a) * 4;
    capsule(lx, baseY, kx, ky, 0.7, c.dark, 1, w); capsule(kx, ky, lx + a * 8 * C.dir, C.y - Math.max(0, a) * 5, 0.7, c.dark, 1, w);
  }
  let top = baseY;
  for (const f of C.floors) {
    const x0 = C.x + f.dx - f.w / 2, y0 = top - f.h, paper = typeof VEIL !== "undefined" ? VEIL : [230, 226, 216];
    for (let y = Math.floor(y0); y < top; y++) for (let x = Math.floor(x0); x < x0 + f.w; x++) {
      const edge = y === Math.floor(y0) || x === Math.floor(x0) || x >= Math.floor(x0 + f.w) - 1;
      const win = (x - Math.floor(x0)) % 4 === 2 && (y - Math.floor(y0)) % 4 === 2;
      put(x, y, edge ? c.dark : win ? c.dark.map((v) => v * 0.6) : paper.map((v, n) => v * 0.8 + c.light[n] * 0.2), 1, w);
    }
    top = y0;
  }
  capsule(C.x - 3, top, C.x - 3, top - 13, 0.5, c.vivid, 1, w);                                   // a mast, flying a red flag
  triangle(C.x - 3, top - 13, C.x + 5, top - 11, C.x - 3, top - 9, [197, 60, 50], 1, w);
}

// ---- primitives ---------------------------------------------------------------------------------------------
function stepPrims(t) {
  const P = WANDER;
  while (P.prims.length < 5 && rnd() < 0.02) {
    const seed = (rnd() * 2 ** 31) | 0, a = rnd() * TAU, r = Math.max(VW, VH) * 0.6;
    P.prims.push({ x: vx + VW / 2 + Math.cos(a) * r, y: vy + VH / 2 + Math.sin(a) * r, a: a + Math.PI + (rnd() - 0.5), speed: 0.3 + rnd() * 0.4, seed,
                   pts: Array.from({ length: 5 }, () => [(rnd() - 0.5) * 13, (rnd() - 0.5) * 13]), next: t + 89, inks: wanderInks(vx, vy, seed) });
  }
  for (const Q of P.prims) {
    if (t >= Q.next) { Q.a += (rnd() - 0.5) * 2.5; Q.next = t + 34 + Math.floor(rnd() * 144); }   // an abrupt turn, now and then
    if (rnd() < 0.02) Q.pts[Math.floor(rnd() * 5)] = [(rnd() - 0.5) * 17, (rnd() - 0.5) * 17];    // a glitch: a vertex jumps
    Q.x += Math.cos(Q.a) * Q.speed; Q.y += Math.sin(Q.a) * Q.speed;
  }
  P.prims = P.prims.filter((Q) => inView(Q.x, Q.y, 144));
}
function drawPrim(Q, t) {
  const p = Q.pts.map(([x, y]) => [Q.x + x, Q.y + y + Math.sin(t * 0.3 + x) * 0.8]), w = Q.inks.w;
  const shades = [[214, 210, 204], [168, 164, 160], [120, 118, 116]], tint = Q.inks.vivid;
  for (let i = 0; i < 3; i++) triangle(p[0][0], p[0][1], p[i + 1][0], p[i + 1][1], p[i + 2][0], p[i + 2][1], shades[i].map((v, n) => v * 0.8 + tint[n] * 0.2), 1, w);
  put(p[0][0] - 1, p[0][1] - 2, [10, 10, 10], 1, w); put(p[0][0] + 1, p[0][1] - 2, [10, 10, 10], 1, w);   // eyes
  for (let i = 0; i < 2; i++) capsule(p[3 + i][0], p[3 + i][1], p[3 + i][0] + Math.sin(t * 0.4 + i) * 3, p[3 + i][1] + 5, 0.4, [60, 58, 56], 1, w);   // stick legs
}

LIFE.wanderers = {
  list: [],
  step(t) {
    if (!onPlane()) { WANDER.walkers = []; WANDER.herd = []; WANDER.city = null; WANDER.prims = []; WANDER.lane = null; return; }
    stepProcession(t); stepHerd(t); stepCity(t); stepPrims(t);
    for (const b of WANDER.bits) { b.x += b.vx; b.y += b.vy; b.life--; }
    WANDER.bits = WANDER.bits.filter((b) => b.life > 0);
  },
  draw(t) {
    if (!onPlane()) return;
    if (WANDER.city) drawCity(WANDER.city);
    for (const Q of WANDER.prims) drawPrim(Q, t);
    for (const B of WANDER.herd) drawBeast(B, t);
    for (const W of WANDER.walkers) drawWalker(W, t);
    for (const b of WANDER.bits) {
      const a = Math.min(1, b.life / 21);
      if (b.kind === "ring") ellipse(b.x, b.y, b.r, b.r, b.c, a, b.w, true);
      else if (b.kind === "puff") ellipse(b.x, b.y, b.r, b.r, b.c, a * 0.5, b.w);
      else put(b.x, b.y, b.c, a, b.w);
    }
  },
};
LIFE_ORDER.push("wanderers");

// ---- the cast: Falling Like Leaves (dirt/artists/cast.json) -----------------------------------------------------
// DRIFT's garden as a film. In each artist's garden one plant has its character beside it, walking round it and doing
// what it does in its scene: Rosa's petals fall, Selene's and Sievers's flashes go off, Wallera flings, Ajisai is
// rained on, Acantha cuts paper leaves, Bunga Raya changes colour, Drummond glows at dusk, Rajah stands over a void,
// Iris leans into the mistral, Nymphe walks in ripples. Plectra, the coleus, the protagonist, crosses the gardens and
// takes each one's colours as she passes; she loves the heat but keeps to the shade, slowing under the canopy and
// hurrying across the open. Each character's title card, with the place on Earth where its plant thrives, is glued
// into the collage by drift.js. Drawn into the life layer a pixel a cell, like the wanderers; not under reduced motion.
const CASTED = new Map(((typeof CAST !== "undefined" && CAST && CAST.cast) || []).map((c) => [c.plant, c]));
const STAR = { list: [], bits: [], plectra: null, nextPlectra: 377 };

/** A figure H cells tall standing at (x, y): its body dithered in a coleus's colours, its head its flower. */
function drawFigure(F, t) {
  const H = F.H, s1 = Math.sin(F.phase), s2 = -s1, w = F.w, lean = F.lean || 0;
  const hipX = F.x, hipY = F.y - H * 0.45, shX = hipX + lean * H * 0.3, shY = hipY - H * 0.36, lw = Math.max(1, H * 0.08);
  const cols = F.cols, fill = (x, y) => cols[mix(Math.floor(x) * 73856093 ^ Math.floor(y) * 19349663 ^ F.seed) % cols.length];
  const leg = (s) => { const kx = hipX + s * H * 0.1, ky = hipY + H * 0.22, fx = hipX + s * H * 0.18; capsule(hipX, hipY, kx, ky, lw * 0.55, fill, F.a, w); capsule(kx, ky, fx, F.y, lw * 0.5, fill, F.a, w); };
  leg(s1 * 0.6); leg(s2 * 0.6);
  capsule(hipX, hipY, shX, shY, lw, fill, F.a, w);
  const arm = (s, up) => { const ex = shX + s * H * 0.12, ey = shY + (up ? -H * 0.05 : H * 0.15); capsule(shX, shY, ex, ey, lw * 0.45, fill, F.a, w); capsule(ex, ey, ex + s * H * 0.08 * F.dir, ey + (up ? -H * 0.12 : H * 0.14), lw * 0.4, fill, F.a, w); };
  arm(s2 * 0.5, F.reach); arm(s1 * 0.5, false);
  const hr = H * 0.11, hx = shX + lean * 2, hy = shY - hr * 1.3;               // the head: the flower, its heart and petals
  ellipse(hx, hy, hr * 1.25, hr * 1.25, F.flower[2], F.a, w); ellipse(hx, hy, hr, hr, F.flower[1], F.a, w); put(hx, hy, F.flower[0], F.a, w);
  return [hx, hy, shX, shY];
}
function castStep(t) {
  if (!onPlane() || REDUCED) { STAR.list = []; STAR.bits = []; STAR.plectra = null; return; }
  // One character a garden, beside its first plant in view (hybrids have no part of their own).
  if (t % 34 === 0) {
    const plants = LIFE.garden.list, keep = new Set(plants), have = new Map(), first = new Map();
    STAR.list = STAR.list.filter((C) => keep.has(C.g));
    const cast = new Set(STAR.list.map((C) => C.c.name));               // each character once at a time: they are people
    for (const C of STAR.list) have.set(C.g.gi + "," + C.g.gj, C);
    for (const g of plants) {
      if (g.hybrid || !CASTED.has(g.plant) || !inView(g.x, g.y, 89)) continue;
      const k = g.gi + "," + g.gj, f = first.get(k);
      if (!have.has(k) && (!f || g.x + g.y * 7 < f.x + f.y * 7)) first.set(k, g);
    }
    for (const g of first.values()) {
      const c = CASTED.get(g.plant);
      if (cast.has(c.name)) continue;
      cast.add(c.name);
      const seed = mix(Math.floor(g.x) * 2654435761 ^ Math.floor(g.y));
      STAR.list.push({ g, c, seed, w: g.w, H: 21 + 8 * unitOf(seed), r: 15 + 8 * unitOf(seed + 1), ang: unitOf(seed + 2) * TAU, sp: 0.18 + 0.12 * unitOf(seed + 3),
                       phase: 0, x: g.x, y: g.y, dir: 1, a: 1, cols: g.leaf, flower: g.pal.slice(0, 3), act: c.action });
    }
  }
  for (const C of STAR.list) {
    C.ang += C.sp / C.r; C.phase += C.sp * 0.6;
    const nx = C.g.x + Math.cos(C.ang) * C.r, ny = C.g.y + Math.sin(C.ang) * C.r * 0.55 + 4;
    C.dir = nx >= C.x ? 1 : -1; C.x = nx; C.y = ny;
    C.lean = C.act === "wind" ? 0.5 + 0.2 * Math.sin(t * 0.05) : 0;
    C.reach = C.act === "flash" || C.act === "fling" || C.act === "cut";
    if (C.act === "swap") { const sw = C.g.swap || [C.flower[1]]; C.cols = [sw[Math.floor(t / 89) % sw.length], C.g.leaf[1], sw[(Math.floor(t / 89) + 1) % sw.length]]; }
  }
  // Plectra: now and then she crosses the view, in the colours of the garden she is in.
  if (!STAR.plectra && t > STAR.nextPlectra && CASTED.has("coleus") && PLANT.length) {
    const dir = rnd() < 0.5 ? 1 : -1;
    STAR.plectra = { x: dir > 0 ? vx - 21 : vx + VW + 21, y: vy + VH * (0.3 + 0.5 * rnd()), dir, H: 29, phase: 0, seed: 7, w: -1, a: 1, flower: [[250, 240, 120], [170, 60, 140], [90, 30, 90]], cols: PLANT[0].leaf, c: CASTED.get("coleus") };
  }
  const P = STAR.plectra;
  if (P) {
    const shade = heightAt(P.x, P.y) > 0.2, sp = shade ? 0.16 : 0.62;     // she lingers in the shade and hurries through the sun
    P.x += P.dir * sp; P.phase += sp * 0.6; P.a = shade ? 1 : 0.62;
    P.cols = PLANT[(h3(Math.floor(P.x / GARDEN), Math.floor(P.y / GARDEN), 359) >>> 0) % PLANT.length].leaf;
    if (P.x < vx - 55 || P.x > vx + VW + 55) { STAR.plectra = null; STAR.nextPlectra = t + 987 + Math.floor(rnd() * 1597); }
  }
  for (const b of STAR.bits) { b.x += b.vx; b.y += b.vy; b.vy += b.g || 0; b.life--; }
  STAR.bits = STAR.bits.filter((b) => b.life > 0);
}
function castDraw(t) {
  if (!onPlane() || REDUCED) return;
  for (const C of STAR.list) {
    if (!inView(C.x, C.y, 34)) continue;
    const [hx, hy] = drawFigure(C, t), w = C.w, fx = hx + C.dir * C.H * 0.22, fy = hy + C.H * 0.05, k = (t + (C.seed & 255)) % 233, add = STAR.bits.length < 610;
    switch (C.act) {
      case "petals": if (add && t % 13 === 0) STAR.bits.push({ x: hx + (rnd() - 0.5) * 4, y: hy, vx: (rnd() - 0.5) * 0.2, vy: 0.25, life: 55, c: C.flower[1], w }); break;
      case "cut": if (add && t % 21 === 0) STAR.bits.push({ x: fx, y: fy, vx: (rnd() - 0.5) * 0.3, vy: 0.2, life: 89, c: C.cols[t % C.cols.length], w, leaf: true }); break;
      case "flash": capsule(fx - 1, fy, fx + 1, fy, 1, [24, 22, 20], 1, w);              // the camera, and once in a while its flash
        if (k < 13) ellipse(fx + C.dir * 2, fy, 1 + k, 1 + k, [255, 252, 236], 1 - k / 13, w); break;
      case "fling": if (add && t % 5 === 0) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4; STAR.bits.push({ x: fx, y: fy, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 1.1, g: 0.05, life: 55, c: C.cols[t % C.cols.length], w }); } break;
      case "rain": for (let i = 0; i < 8; i++) { const rx = C.x + ((mix(i * 7919 + C.seed) % 29) - 14), ry = C.y - 34 + ((t * 1.3 + i * 11) % 34); capsule(rx, ry, rx - 0.5, ry + 2, 0.4, [150, 176, 230], 0.7, w); } break;
      case "glow": ellipse(hx, hy, 6, 6, [255, 196, 90], 0.25 + 0.15 * Math.sin(t * 0.05), w); break;
      case "void": ellipse(C.x + C.dir * 6, C.y, 4 + Math.sin(t * 0.03), 2.2, [6, 2, 10], 0.9, w); break;
      case "wind": if (t % 3 === 0) for (let i = 0; i < 3; i++) { const ry = C.y - (mix(t * 31 + i) % C.H); capsule(C.x - 13 + (t * 0.7 + i * 9) % 26, ry, C.x - 9 + (t * 0.7 + i * 9) % 26, ry, 0.35, [236, 232, 220], 0.5, w); } break;
      case "ripple": for (let i = 0; i < 2; i++) { const q = ((t + i * 55) % 110) / 110; ellipse(C.x, C.y, 2 + 9 * q, 1 + 4 * q, [210, 226, 240], 0.6 * (1 - q), w, true); } break;
    }
  }
  if (STAR.plectra) drawFigure(STAR.plectra, t);
  for (const b of STAR.bits) {
    const a = Math.min(1, b.life / 21);
    if (b.leaf) { put(b.x, b.y, b.c, a, b.w); put(b.x + 1, b.y, b.c, a, b.w); put(b.x, b.y + 1, b.c, a * 0.7, b.w); }
    else put(b.x, b.y, b.c, a, b.w);
  }
}
LIFE.cast = { list: [], step: castStep, draw: castDraw };
LIFE_ORDER.push("cast");

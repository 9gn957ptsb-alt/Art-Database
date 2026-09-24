// ---- DIRT Earth: the plane is the Earth ----------------------------------------------------------
// Shared by the page and the workers. A quarter-degree cell of the atlas is 233 cells of the plane, a
// passage's width, so a degree is 932 cells. x runs east from the date line and the Earth repeats every
// 360 degrees of it (with other trees each time round, since everything else is hashed from x itself);
// y runs south from the North Pole, and past either pole the plane goes on as the polar row does.

const E_CELL = 233, E_DEG = 4 * E_CELL, E_W = 360 * E_DEG, E_H = 180 * E_DEG;
const AW = 1440, AH = 720, MW = 720, MH = 360, M_CELL = 2 * E_CELL;      // the atlas, and its months at half a degree
let EARTH = null;                                                          // the atlas and the grammar, once Earth has begun
const lonOfX = (x) => mod(x, E_W) / E_DEG - 180;
const latOfY = (y) => Math.max(-90, Math.min(90, 90 - y / E_DEG));
const xOfLon = (lon) => (lon + 180) * E_DEG;
const yOfLat = (lat) => (90 - lat) * E_DEG;
const tempOf = (v) => (v / 255) * 127.5 - 60;                              // the atlas's codes, decoded
const rainOf = (v) => Math.expm1((v / 255) * Math.log1p(60));             // mm a day
const aridOf = (v) => Math.exp((v / 255) * (Math.log(30) - Math.log(1e-3)) + Math.log(1e-3));
const reliefOf = (v) => Math.expm1((v / 255) * Math.log1p(8000));
const viewOf = (v) => Math.exp((v / 255) * (Math.log(300) - Math.log(0.05)) + Math.log(0.05));
const SEA = 255, LAKE = 254;
const W_RIVER = 2, W_GLACIER = 4, W_SALT = 8, W_REEF = 16, W_SHELF_ICE = 32, W_WETLAND = 64;

// ---- where one place gives way to another ----------------------------------------------------------
// Its edge wanders by up to 144 cells, smooth over 377, and 55 more over 89; and it is dithered across
// 13 cells, so two places meet as two sprayed colours do.
const eWarpX = (x, y) => 144 * (2 * vnoise(x, y, 377, 911) - 1) + 55 * (2 * vnoise(x, y, 89, 913) - 1);
const eWarpY = (x, y) => 144 * (2 * vnoise(x, y, 377, 917) - 1) + 55 * (2 * vnoise(x, y, 89, 919) - 1);
const E_DITHER = 13;
/** The atlas cell that plane cell (x, y) belongs to, its edge wandered by (wx, wy) and dithered. */
function eIndex(x, y, wx, wy) {
  const fx = Math.floor(x), fy = Math.floor(y);
  const qx = x + wx + (u3(fx, fy, 921) - 0.5) * 2 * E_DITHER, qy = y + wy + (u3(fx, fy, 923) - 0.5) * 2 * E_DITHER;
  return Math.min(AH - 1, Math.max(0, Math.floor(qy / E_CELL))) * AW + Math.floor(mod(qx, E_W) / E_CELL);
}
// The warp itself is worked out every 8 cells on the plane's own grid and eased between, here and in the
// worker's chunks alike, with the same arithmetic, so a plant and the ground under it always agree on
// where they are, and so do two neighbouring chunks.
const eWG = new Map();
function eWarpCorner(gx, gy) {
  const k = (gx + 1048576) * 2097152 + (gy + 1048576);
  let w = eWG.get(k);
  if (!w) {
    w = [eWarpX(gx * 8, gy * 8), eWarpY(gx * 8, gy * 8)];
    if (eWG.size >= 46368) eWG.clear();
    eWG.set(k, w);
  }
  return w;
}
const bil = (a, b, c, d, tx, ty) => (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
let EWX = 0, EWY = 0;
/** The atlas cell of integer plane cell (fx, fy). Sets EWX, EWY to the warp there. */
function eCellK(fx, fy) {
  const px = (fx + 0.5) / 8, py = (fy + 0.5) / 8, gx = Math.floor(px), gy = Math.floor(py), tx = px - gx, ty = py - gy;
  const a = eWarpCorner(gx, gy), b = eWarpCorner(gx + 1, gy), c = eWarpCorner(gx, gy + 1), d = eWarpCorner(gx + 1, gy + 1);
  EWX = bil(a[0], b[0], c[0], d[0], tx, ty); EWY = bil(a[1], b[1], c[1], d[1], tx, ty);
  return eIndex(fx + 0.5, fy + 0.5, EWX, EWY);
}
/** A field sampled at cell centres (w by h, `cell` plane cells a sample), eased between them at (x, y). */
function eBilin(arr, w, h, cell, x, y) {
  const fx = mod(x, E_W) / cell - 0.5, fy = Math.min(h - 1, Math.max(0, y / cell - 0.5));
  const i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
  const ia = (i0 + w) % w, ib = (i0 + 1) % w, j1 = Math.min(h - 1, j0 + 1);
  return (arr[j0 * w + ia] * (1 - tx) + arr[j0 * w + ib] * tx) * (1 - ty) + (arr[j1 * w + ia] * (1 - tx) + arr[j1 * w + ib] * tx) * ty;
}

// ---- seasons ----------------------------------------------------------------------------------------
const P_GREEN = 0, P_FRESH = 1, P_TURNING = 2, P_BARE = 3, P_DRY = 4, P_BLOOM = 5;
const PHASE_NAMES = ["green", "fresh", "turning", "bare", "dry", "bloom"];
const PHEN = { evergreen: 0, deciduous: 1, boreal: 1, "wet-dry": 2, mediterranean: 3, tundra: 4, desert: 5, ice: 6, grassland: 7 };
/** The phase a month is in, for a phenology, from its mean temperature (and last month's), and its rain (and next month's, and the year's mean). */
function ePhase(ph, T, Tp, P, Pn, Pm) {
  switch (ph) {
    case 0: return P_GREEN;
    case 1: return T >= 10 ? P_GREEN : T < 5 ? P_BARE : T > Tp ? P_FRESH : P_TURNING;
    case 2: return P >= 3 ? P_GREEN : P < 1 ? P_DRY : Pn > P ? P_GREEN : P_DRY;
    case 3: return P >= 1.5 && T < 20 ? P_GREEN : P_DRY;
    case 4: return T > 3 ? P_GREEN : P_BARE;
    case 5: return P >= 1 && P >= 2 * Pm ? P_BLOOM : P_BARE;
    case 7: return T < 5 ? P_BARE : P < 1.5 ? P_DRY : T < 10 && T > Tp ? P_FRESH : P_GREEN;
    default: return P_BARE;
  }
}

// ---- the atlas and the grammar ------------------------------------------------------------------------
/** Take up the Earth: the atlas's static layers (typed arrays), the month's layers, and the grammar. */
function earthSetup(E) {
  EARTH = E;
  const G = E.grammar;
  E.lookNames = Object.keys(G.looks);
  E.lookIdx = Object.fromEntries(E.lookNames.map((n, i) => [n, i]));
  E.lookRGB = E.lookNames.map((n) => G.looks[n].map(hexRGB));
  E.biome = [];
  for (let b = 1; b <= 15; b++) {
    const B = G.biomes[b];
    const look = PHASE_NAMES.map((ph) => E.lookIdx[B.looks[ph] || B.looks.green || B.looks.bare]);
    E.biome[b] = { ...B, ph: PHEN[B.phenology], look, typical: B["typical canopy m"], trees: [1, 2, 3, 4, 5, 6, 14].includes(b) };
  }
  E.marineNames = E.marineList.map((m) => m.name);
  E.soilRGB = E.soils.map((s) => hexRGB(s.colour));
  eLattices(G);
  E.palettes = new Map();
  ePaintings();
}
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** The month's conditions, decoded: temperature, last month's, rain, next month's, the year's mean rain, snow or sea ice. */
function earthMonth(M) {
  Object.assign(EARTH, M);
  for (const L of EL) L.cache.clear();
}

const REALM_OF = (E, r) => E.realms[r] || "";
/** Everything the atlas says about plane cell (x, y) that a plant or a creature needs, into `o`. */
function eSite(x, y, o = {}, month = true) {
  const E = EARTH, fx = Math.floor(x), fy = Math.floor(y), k = eCellK(fx, fy);
  o.k = k; o.surf = E.surf[k]; o.soil = E.soil[k]; o.realm = E.realm[k]; o.canopy = (E.canopy[k] * 45) / 255;
  o.arid = aridOf(E.arid[k]); o.wbits = E.wbits[k]; o.zone = E.marine[k] & 15; o.warmth = E.marine[k] >> 4;
  const B = o.surf <= 15 ? E.biome[o.surf] : null;
  o.bare = B ? eBare(B, o.canopy, o.arid) : 0;
  o.lat = latOfY(y);
  if (month) {
    const X = fx + 0.5 + EWX, Y = fy + 0.5 + EWY;
    o.T = eBilin(E.T, MW, MH, M_CELL, X, Y); o.Tp = eBilin(E.Tp, MW, MH, M_CELL, X, Y);
    o.P = eBilin(E.P, MW, MH, M_CELL, X, Y); o.Pn = eBilin(E.Pn, MW, MH, M_CELL, X, Y); o.Pm = eBilin(E.Pm, MW, MH, M_CELL, X, Y);
    o.snow = eBilin(E.SN, MW, MH, M_CELL, X, Y);
    o.phase = B ? ePhase(B.ph, o.T, o.Tp, o.P, o.Pn, o.Pm) : P_GREEN;
  }
  return o;
}
/** How bare the ground of a place is, 0 to 1: forests by their canopy height over the biome's typical one, the rest by aridity. */
function eBare(B, canopy, arid) {
  if (!B.typical) return 1;
  return B.trees ? 1 - smooth(0, 1, canopy / B.typical) : 1 - smooth(PHI ** -8, PHI ** -1.5, arid);
}

// ---- the colours each place wears ------------------------------------------------------------------
// A look is three colours, dark to light. The paintings are ranked by how near their three colours come to
// it once DIRT has turned them toward it (by the hue their colours agree on, at most the golden angle, as
// the outskirts turn colours) and brought their colourfulness toward it (by phi^-1 to phi); a turn costs a
// little, and costs more at sea and on snow, where the collection's own blue-greys and pale colours are
// nearer the truth than a brown turned blue. Each place wears one of the five nearest.
function labOf(c) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  const L = 116 * Y - 16, A = 500 * (X - Y), B2 = 200 * (Y - Z);
  return [L, Math.hypot(A, B2), Math.atan2(B2, A)];                 // lightness, chroma, hue
}
const uvHue = (c) => { const u = (2 * c[0] - c[1] - c[2]) / Math.sqrt(6), v = (c[1] - c[2]) / Math.SQRT2; return [Math.atan2(v, u), Math.hypot(u, v)]; };
const lumE = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const TURN_SIGN = (() => { const a = [200, 100, 50]; return uvHue(turnRGB(a[0], a[1], a[2], 0.1))[0] > uvHue(a)[0] ? 1 : -1; })();
function lchDist(t, p) {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const [L1, C1, H1] = t[i], [L2, C2, H2] = p[i], dh = 2 * Math.sqrt(C1 * C2) * Math.sin((H1 - H2) / 2), w = i === 1 ? 1.3 : 1;
    s += w * Math.sqrt((L1 - L2) ** 2 + (C1 - C2) ** 2 + (dh / PHI) ** 2);
  }
  return s / 3.3;
}
/** A painting's colours turned toward a look and brought toward its colourfulness; and how far they were turned. */
function aimAt(t, p) {
  let sx = 0, sy = 0, ws = 0, ct = 0;
  for (let i = 0; i < 3; i++) {
    const [ha, ca] = uvHue(t[i]), [hb, cb] = uvHue(p[i]), w = ca * cb;
    sx += w * Math.cos(ha - hb); sy += w * Math.sin(ha - hb); ws += w; ct += ca / 3;
  }
  const agree = ws ? Math.hypot(sx, sy) / ws : 0;
  const turn = ws ? Math.max(-GOLDEN_ANGLE, Math.min(GOLDEN_ANGLE, Math.atan2(sy, sx))) * agree * Math.min(1, ct / 21) : 0;
  const out = p.map((c) => turnRGB(c[0], c[1], c[2], TURN_SIGN * turn, [0, 0, 0]));
  const cp = out.reduce((s, c) => s + uvHue(c)[1], 0) / 3 || 1, k = Math.max(1 / PHI, Math.min(PHI, ct / cp));
  return { pal: out.map((c) => { const l = lumE(c); return c.map((v) => Math.max(0, Math.min(255, l + (v - l) * k))); }), turn };
}
let PAINT = [];
function ePaintings() {
  PAINT = TOKENS.map((cols) => {
    const c = cols.map((v) => v.slice());
    while (c.length < 3) c.push(c[c.length - 1].slice());
    c.sort((a, b) => labOf(a)[0] - labOf(b)[0]);
    return c;
  });
}
function hlsOf(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, L, 0];
  const S = d / (1 - Math.abs(2 * L - 1));
  const H = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [H * 60, L, S];
}
const isWaterColour = (c) => { const [H, L, S] = hlsOf(c); return H >= 170 && H <= 250 && S >= 0.1 && L >= 0.1 && L <= 0.65; };
/**
 * Water wears the blue out of a painting, as the Artist Website's sea does: of the paintings with a water colour,
 * the five whose water colour is nearest the look's middle one, each as three colours made from it (it darkened,
 * itself, and the painting's palest cool colour, or it lightened), turned a little toward the look.
 */
function eRankWater(target) {
  const tl = target.map(labOf), mid = tl[1], out = [];
  for (let w = 0; w < PAINT.length; w++) {
    const wet = PAINT[w].filter(isWaterColour);
    if (!wet.length) continue;
    let c = wet[0], bd = Infinity;
    for (const q of wet) { const L = labOf(q), d = Math.hypot(L[0] - mid[0], L[1] - mid[1], Math.sin((L[2] - mid[2]) / 2) * 2 * Math.sqrt(L[1] * mid[1])); if (d < bd) { bd = d; c = q; } }
    const pale = PAINT[w][2], hp = hlsOf(pale), cool = (hp[0] >= 150 && hp[0] <= 260) || hp[2] < 0.15;
    const base = [c.map((v) => v / PHI), c, cool && lumE(pale) > lumE(c) ? pale : c.map((v) => v + (255 - v) / PHI)];
    const { pal, turn } = aimAt(target, base);
    out.push({ w, pal, score: lchDist(tl, pal.map(labOf)) + 8 * Math.abs(turn) });
  }
  if (out.length < 5) return null;
  out.sort((a, b) => a.score - b.score);
  return out.slice(0, 5).map(eStops);
}
function eStops(o) {
  const pal = o.pal.slice().sort((a, b) => lumE(a) - lumE(b));
  const stops = [pal[0].map((v) => v * PHI ** -2), pal[0], pal[1], pal[2], pal[2].map((v) => v + (255 - v) / PHI)];
  return { w: o.w, pal, stops, at: stops.map((c, n) => (n === 0 ? 0 : n === 4 ? 255 : lumE(c))) };
}
/** The five paintings nearest a look's three colours, each as DIRT wears it there. */
function eRank(target, strict) {
  const tl = target.map(labOf), out = [];
  for (let w = 0; w < PAINT.length; w++) {
    const { pal, turn } = aimAt(target, PAINT[w]);
    out.push({ w, pal, score: lchDist(tl, pal.map(labOf)) + (strict ? 8 : 2) * Math.abs(turn) });
  }
  out.sort((a, b) => a.score - b.score);
  return out.slice(0, 5).map(eStops);
}
// A place's look key: the look, and for land the soil it is drawn toward and how far (bare in thirds).
const L_SNOW = () => EARTH.lookIdx.snow, L_ICE = () => EARTH.lookIdx.ice, L_SALT = () => EARTH.lookIdx.salt, L_LAKE = () => EARTH.lookIdx.lake;
const lookKey = (look, soil, bare) => look * 64 + (soil < 0 ? 63 : soil * 3 + Math.min(2, Math.floor(bare * 3)));
const STRICT = new Set(["lake", "ice", "snow", "salt"]);
/** The five palettes a look key's places wear. */
function eLookPalettes(key) {
  let v = EARTH.palettes.get(key);
  if (!v) {
    const look = Math.floor(key / 64), rest = key % 64, name = EARTH.lookNames[look];
    let t = EARTH.lookRGB[look];
    if (rest !== 63) {
      const soil = Math.floor(rest / 3), a = [0, PHI ** -2, PHI ** -1][rest % 3], s = EARTH.soilRGB[soil];
      const sp = [s.map((q) => q / PHI), s, s.map((q) => q + (255 - q) * PHI ** -2)];
      t = t.map((c, i) => c.map((q, j) => q + (sp[i][j] - q) * a));
    }
    v = (name.startsWith("sea") || name === "lake" ? eRankWater(t) : null) || eRank(t, name.startsWith("sea") || STRICT.has(name));
    EARTH.palettes.set(key, v);
  }
  return v;
}
/** The look key of a sea cell, by its zone and warmth. */
function seaLook(zone, warmth) {
  const E = EARTH, m = E.grammar.marine[E.marineNames[zone]];
  if (m && m.look) return E.lookIdx[m.look];
  const name = E.marineNames[zone];
  if (warmth === 0) return E.lookIdx[name === "shelf" ? "sea, tropical shallows" : "sea, tropical"];
  return E.lookIdx[["sea, tropical", "sea, subtropical", "sea, temperate", "sea, polar"][warmth]];
}

// ---- plants: crowns of every shape, on lattices shared by every biome -----------------------------
// Every stratum of every biome grows on the lattice of its spacing (Fibonacci numbers from 3 to 233). A
// crown is kept where the ground under its middle belongs to a biome with a stratum on that lattice whose
// plants live in the realm there, by that stratum's cover, thinned where the canopy is low (trees) or the
// ground dry (grass and shrubs).
const SHAPES = { lobed: 0, cone: 1, umbrella: 2, palm: 3, column: 4, tussock: 5, cushion: 6, rosette: 7, reed: 8, mangrove: 9 };
const SHAPE_REACH = [1 + PHI ** -3, 1 + PHI ** -3, 1 + PHI ** -4, 1, 1, 1, 1 + PHI ** -4, 1, 1, 1 + PHI ** -3];
let EL = [];
function eLattices(G) {
  const gs = [...new Set(Object.values(G.biomes).flatMap((b) => b.strata.map((s) => s.g)))].sort((a, b) => a - b);
  EL = gs.map((g, n) => ({ g, n, salt: 700 + 10 * n, cache: new Map(), byBiome: new Array(16).fill(null), top: 0, reach: 0 }));
  for (const [bk, b] of Object.entries(G.biomes)) b.strata.forEach((s, si) => {
    const L = EL.find((l) => l.g === s.g);
    (L.byBiome[+bk] ||= []).push({ ...s, si, biome: +bk, shapeId: SHAPES[s.shape] });
    L.top = Math.max(L.top, s.height[1]);
    L.reach = Math.max(L.reach, s.r * PHI ** 0.5 * SHAPE_REACH[SHAPES[s.shape]]);
  });
}
/** The stratum a crown's height puts it in: 0 ground cover (under 3 cells), 1 low, 2 canopy, 3 above it. */
const eBand = (top) => (top < PHI ** -5 ? 0 : top <= PHI ** -2 ? 1 : top <= PHI ** -1 + PHI ** -4 ? 2 : 3);
function eVeg(st, B, pr) {
  // Trees in a forest biome stand as tall as the atlas's canopy lets them (so farmland and towns thin them);
  // elsewhere trees, like grass and shrubs, thin with aridity alone, since the canopy there is mostly grass.
  if (st.height[1] >= PHI ** -2 && B.trees) return B.typical ? smooth(0, 1, pr.canopy / B.typical) ** (1 / PHI) : 0;
  return smooth(PHI ** -8, PHI ** -1.5, pr.arid);
}
const ESITE = {};
// While the worker grows a chunk it lends the atlas cells it has already worked out for the ground, which
// are the same as eCellK's, so small plants need not work them out again.
let E_FAST = null;
/** The static part of eSite for the atlas cell of plane cell (x, y), into ESITE. */
function eStatic(x, y) {
  const E = EARTH, fx = Math.floor(x), fy = Math.floor(y), F = E_FAST;
  let k;
  if (F && fx >= F.X0 && fy >= F.Y0 && fx < F.X0 + F.W && fy < F.Y0 + F.W) k = F.k[(fy - F.Y0) * F.W + fx - F.X0];
  else k = eCellK(fx, fy);
  const o = ESITE;
  o.k = k; o.surf = E.surf[k]; o.soil = E.soil[k]; o.realm = E.realm[k]; o.canopy = (E.canopy[k] * 45) / 255;
  o.arid = aridOf(E.arid[k]); o.wbits = E.wbits[k];
  const B = o.surf <= 15 ? E.biome[o.surf] : null;
  o.bare = B ? eBare(B, o.canopy, o.arid) : 0;
  return o;
}
/** The crown in square (i, j) of lattice L, or null. */
function crownOfE(L, i, j) {
  const key = (i + 1048576) * 2097152 + (j + 1048576);
  let c = L.cache.get(key);
  if (c !== undefined) return c;
  c = null;
  const x = (i + u3(i, j, L.salt)) * L.g, y = (j + u3(i, j, L.salt + 1)) * L.g, pr = eStatic(x, y);
  const list = pr.surf <= 15 ? L.byBiome[pr.surf] : null;
  if (list && !(pr.wbits & (W_GLACIER | W_SALT))) {
    let st = list[0];
    if (list.length > 1) {
      let u = u3(i, j, L.salt + 2) * list.reduce((s, q) => s + q.cover, 0);
      for (const q of list) { u -= q.cover; if (u < 0) { st = q; break; } }
    }
    const B = EARTH.biome[pr.surf], plants = st.plants[REALM_OF(EARTH, pr.realm)] || st.plants["*"];
    if (plants && u3(i, j, L.salt + 3) < st.cover * eVeg(st, B, pr)) {
      const top = st.height[0] + (st.height[1] - st.height[0]) * u3(i, j, L.salt + 5), a5 = u3(i, j, L.salt + 6) * 2 * Math.PI, a8 = u3(i, j, L.salt + 7) * 2 * Math.PI;
      c = { x, y, r: st.r * PHI ** (u3(i, j, L.salt + 4) - 0.5), top, L: eBand(top), shape: st.shapeId, st, biome: pr.surf, soil: pr.soil, bare: pr.bare,
            turns: !!st.turns, plant: plants[h3(i, j, L.salt + 8) % plants.length], tint: null, key: -1, phase: -1,
            c5: Math.cos(a5), s5: Math.sin(a5), c8: Math.cos(a8), s8: Math.sin(a8) };
      if (st.shapeId === SHAPES.reed) { const a = eWindAngle(x, y); c.cw = Math.cos(a); c.sw = Math.sin(a); }
    }
  }
  if (L.cache.size >= 28657) L.cache.clear();
  L.cache.set(key, c);
  return c;
}
/**
 * A crown's height at (x, y), 0 off it, by its shape seen from above. Directions come as powers of the unit
 * vector (cos a, sin a), so no angle is ever taken.
 */
function crownHeightE(c, x, y) {
  const dx = x - c.x, dy = y - c.y, d2 = dx * dx + dy * dy, reach = c.r * SHAPE_REACH[c.shape];
  if (d2 >= reach * reach) return 0;
  const d = Math.sqrt(d2) || 1, ca = dx / d, sa = dy / d;
  const r2 = ca * ca - sa * sa, i2 = 2 * ca * sa, r4 = r2 * r2 - i2 * i2, i4 = 2 * r2 * i2;
  switch (c.shape) {
    case 0: case 9: {                                                          // lobed; mangrove, lower and denser
      const r5 = r4 * ca - i4 * sa, i5 = r4 * sa + i4 * ca, r8 = r4 * r4 - i4 * i4, i8 = 2 * r4 * i4;
      const r = c.r * (1 + PHI ** -4 * (i5 * c.c5 + r5 * c.s5) + PHI ** -5 * (i8 * c.c8 + r8 * c.s8)), t = d2 / (r * r);
      return t < 1 ? c.top * (1 - (c.shape ? PHI ** -3 : PHI ** -2) * t) : 0;
    }
    case 1: {                                                                  // cone: a point, eight branches
      const r8 = r4 * r4 - i4 * i4, i8 = 2 * r4 * i4, r = c.r * (1 + PHI ** -3 * (i8 * c.c8 + r8 * c.s8)), t = d / r;
      return t < 1 ? c.top * (1 - t) ** (1 / PHI) : 0;
    }
    case 2: {                                                                  // umbrella: flat, crisp, a little lobed
      const r5 = r4 * ca - i4 * sa, i5 = r4 * sa + i4 * ca, r = c.r * (1 + PHI ** -4 * (i5 * c.c5 + r5 * c.s5)), t = d2 / (r * r);
      return t < 1 ? c.top * (1 - PHI ** -4 * t) : 0;
    }
    case 3: {                                                                  // palm: eight deep fronds
      const f = Math.abs(r4 * c.c8 - i4 * c.s8), r = c.r * (PHI ** -3 + (1 - PHI ** -3) * f ** PHI), t = d / r;
      return t < 1 ? c.top * (1 - PHI ** -2 * t) : 0;
    }
    case 4: return d2 < c.r * c.r ? c.top : 0;                                 // column: all shadow
    case 5: return d < c.r ? c.top * (1 - d / c.r) : 0;                        // tussock
    case 6: {                                                                  // cushion: a low, dense mat
      const r5 = r4 * ca - i4 * sa, i5 = r4 * sa + i4 * ca, r = c.r * (1 + PHI ** -4 * (i5 * c.c5 + r5 * c.s5)), t = d2 / (r * r);
      return t < 1 ? c.top * Math.sqrt(1 - t) : 0;
    }
    case 7: {                                                                  // rosette: a star of thirteen leaves
      const r5 = r4 * ca - i4 * sa, i5 = r4 * sa + i4 * ca, r8 = r4 * r4 - i4 * i4, i8 = 2 * r4 * i4;
      const r13 = r8 * r5 - i8 * i5, i13 = r8 * i5 + i8 * r5, f = (1 + r13 * c.c8 + i13 * c.s8) / 2, r = c.r * (PHI ** -2 + (1 - PHI ** -2) * f), t = d / r;
      return t < 1 ? c.top * (1 - PHI ** -2 * t) : 0;
    }
    case 8: {                                                                  // reed: long along the wind
      const u = dx * c.cw + dy * c.sw, v = -dx * c.sw + dy * c.cw, t = (u / c.r) ** 2 + (v / (c.r * PHI ** -2)) ** 2;
      return t < 1 ? c.top * (1 - t) : 0;
    }
  }
  return 0;
}
/** How high the plants stand at (x, y), and which crown is on top there (E_TOP). */
let E_TOP = null;
function canopyAtE(x, y) {
  let h = 0;
  E_TOP = null;
  for (const L of EL) {
    const i0 = Math.floor(x / L.g), j0 = Math.floor(y / L.g);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const c = crownOfE(L, i, j);
      if (!c) continue;
      const v = crownHeightE(c, x, y);
      if (v > h) { h = v; E_TOP = c; }
    }
  }
  return h;
}
/** The crowns of band minBand or above whose middles lie within rad of (x, y). */
function crownsNearE(minBand, x, y, rad) {
  const out = [];
  for (const L of EL) {
    if (eBand(L.top) < minBand) continue;
    for (let j = Math.floor((y - rad) / L.g); j <= Math.floor((y + rad) / L.g); j++)
      for (let i = Math.floor((x - rad) / L.g); i <= Math.floor((x + rad) / L.g); i++) {
        const c = crownOfE(L, i, j);
        if (c && c.L >= minBand && Math.hypot(c.x - x, c.y - y) <= rad) out.push(c);
      }
  }
  return out;
}

// ---- the wind, which lays dunes, swell and reeds ----------------------------------------------------
// The atlas's mean wind, taken once for each 610-cell region of the plane (its middle jittered), so every
// dune field and swell has one heading, and where two regions meet their edge is dithered.
const WREG = 610;
const windCache = new Map();
function windRegion(i, j) {
  const k = (i + 32768) * 65536 + (j + 32768);
  let w = windCache.get(k);
  if (!w) {
    const x = (i + 0.5 + (u3(i, j, 971) - 0.5) / PHI) * WREG, y = (j + 0.5 + (u3(i, j, 973) - 0.5) / PHI) * WREG;
    const U = eBilin(EARTH.U, MW, MH, M_CELL, x, y), V = eBilin(EARTH.V, MW, MH, M_CELL, x, y);
    const a = Math.atan2(-V, U) + (u3(i, j, 977) - 0.5) * PHI ** -2, sp = Math.hypot(U, V);
    w = { x, y, a, c: Math.cos(a), s: Math.sin(a), sp, ph: u3(i, j, 979) };
    if (windCache.size >= 4181) windCache.clear();
    windCache.set(k, w);
  }
  return w;
}
/** The wind region (x, y) belongs to, its edge dithered. */
function windAt(x, y) {
  const fx = Math.floor(x), fy = Math.floor(y);
  const qx = x + (u3(fx, fy, 981) - 0.5) * 2 * 21, qy = y + (u3(fx, fy, 983) - 0.5) * 2 * 21;
  const i0 = Math.floor(qx / WREG), j0 = Math.floor(qy / WREG);
  let best = null, bd = Infinity;
  for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
    const w = windRegion(i, j), d = (qx - w.x) ** 2 + (qy - w.y) ** 2;
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
const eWindAngle = (x, y) => windAt(x, y).a;

// ---- the sun --------------------------------------------------------------------------------------------
/** The sun's declination at the middle of month m (0-11), in degrees. */
const declination = (m) => -23.44 * Math.cos(((2 * Math.PI) / 365) * (15 + 30.44 * m + 10));
/** The sun's height at noon, in degrees, at latitude lat in month m. */
const noonSun = (lat, m) => 90 - Math.abs(lat - declination(m));
/** Hours of daylight at latitude lat in month m. */
function dayHours(lat, m) {
  const t = -Math.tan((lat * Math.PI) / 180) * Math.tan((declination(m) * Math.PI) / 180);
  return t >= 1 ? 0 : t <= -1 ? 24 : (24 / Math.PI) * Math.acos(t);
}

// ---- who lives where, and when -----------------------------------------------------------------------
/** The species list for a kind at a place, and the height it lives at there; or null. */
function eSpecies(kind, pr, lat) {
  const E = EARTH, G = E.grammar;
  if (pr.surf === SEA) {
    const m = G.marine[E.marineNames[pr.zone]], by = m && m.life[kind];
    if (!by) return null;
    const list = by[lat >= 0 ? "north" : "south"] || by["*"];
    return list ? { list, level: "sea" } : null;
  }
  if (pr.surf > 15) return null;
  const B = E.biome[pr.surf], realm = REALM_OF(E, pr.realm);
  for (const level of ["floor", "understory", "crowns", "above"]) {
    const by = B.life[level] && B.life[level][kind];
    if (!by) continue;
    const list = by[realm] || by["*"];
    return list ? { list, level } : null;
  }
  return null;
}
/** Does the month suit a kind at a place? */
function eWhen(kind, pr, month) {
  const w = EARTH.grammar.when[kind];
  if (!w) return true;
  if (w.temp_min !== undefined && pr.T < w.temp_min) return false;
  if (w.rain_max !== undefined && pr.P > w.rain_max) return false;
  if (w.snow_max !== undefined && pr.surf <= 15 && pr.snow > w.snow_max) return false;
  if (w.ice_max !== undefined && pr.surf === SEA && pr.snow > w.ice_max) return false;
  if (w.phases && !w.phases.includes(PHASE_NAMES[pr.phase])) return false;
  if (w.months && !w.months.includes(month)) return false;
  return true;
}

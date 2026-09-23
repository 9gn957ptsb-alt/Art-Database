// ---- DIRT Earth in the worker: a chunk of the Earth -------------------------------------------------------
// The same stages as chunk(), with the Earth's own shapes: every biome's plants on their lattices; the ground's
// own texture (dunes, salt, ice-wedge polygons, scree, crevasses, tidal mud, swell); rivers, lakes, sea and
// sea ice; snow lying where the month has it; shadows as long as the month's noon sun makes them, and night
// where it does not rise; and each cell wearing the paintings nearest its place's look.

let EARTH_ON = false, E_M = 0;
const FME = 55, FWE = N + 2 * FME, FWE2 = FWE * FWE;               // a wider margin: low suns cast long shadows
const eh = new Float32Array(FWE2), ev = new Float32Array(FWE2), ez = new Float32Array(FWE2), eA = new Float32Array(FWE2), eB = new Float32Array(FWE2);
const eLv = new Uint8Array(FWE2), eCr = new Int32Array(FWE2), eK = new Int32Array(FWE2), eG = new Uint8Array(FWE2), eWet = new Uint8Array(FWE2);
const eSn = new Float32Array(FWE2), eTm = new Float32Array(FWE2), ePh = new Uint8Array(FWE2), eSnowy = new Uint8Array(FWE2), eHill = new Float32Array(FWE2), eCrest = new Uint8Array(FWE2);
const ecs = [];
const G_LITTER = 0, G_GRASS = 1, G_SAND = 2, G_PAVE = 3, G_SALT = 4, G_POLY = 5, G_MOSS = 6, G_SCREE = 7, G_ICE = 8, G_WATER = 9, G_MUD = 10;
const G_SEA = 11, G_LAKE = 12, G_FLOE = 13, G_RIVER = 14, G_REEF = 16;
// Grounds that are even in themselves (sand, snow, ice, salt and water): the soil's dots vary less there, so
// their own relief (dunes, sastrugi, swell) shows.
const EVEN = new Set([G_SAND, G_SALT, G_ICE, G_SEA, G_LAKE, G_FLOE, G_RIVER, G_WATER, G_REEF]);
const GROUND_ID = { litter: 0, grass: 1, sand: 2, pavement: 3, salt: 4, polygons: 5, moss: 6, scree: 7, ice: 8, water: 9, mud: 10 };
const WET_LAND = 0, WET_FRESH = 1, WET_SEA = 2, WET_ICE = 3;

function boxBlurE(src, dst, tmp, rad) {
  const n = 2 * rad + 1, W = FWE;
  for (let y = 0; y < W; y++) {
    let s = 0;
    for (let x = -rad; x <= rad; x++) s += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) { tmp[y * W + x] = s / n; s += src[y * W + Math.min(W - 1, x + rad + 1)] - src[y * W + Math.max(0, x - rad)]; }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -rad; y <= rad; y++) s += tmp[Math.min(W - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < W; y++) { dst[y * W + x] = s / n; s += tmp[Math.min(W - 1, y + rad + 1) * W + x] - tmp[Math.max(0, y - rad) * W + x]; }
  }
}

/** Voronoi cells on a jittered lattice g: returns how far (x, y) lies inside its cell from the edge; VID its cell's hash, VD1 the distance to its middle. */
let VD1 = 0, VID = 0;
function vor(x, y, g, salt) {
  const i0 = Math.floor(x / g), j0 = Math.floor(y / g);
  let d1 = Infinity, d2 = Infinity, id = 0;
  for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
    const px = (i + u3(i, j, salt)) * g, py = (j + u3(i, j, salt + 1)) * g, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < d1) { d2 = d1; d1 = d; id = h3(i, j, salt + 2); } else if (d < d2) d2 = d;
  }
  VD1 = Math.sqrt(d1); VID = id;
  return (Math.sqrt(d2) - VD1) / 2;
}

/** The rivers near a chunk: segments joining the middles of neighbouring river cells of the atlas, in plane cells. */
function riversNear(X0, Y0, W) {
  const E = EARTH, segs = [];
  const isR = (i, j) => { if (j < 0 || j >= AH) return false; const k = j * AW + mod(i, AW); return (E.wbits[k] & W_RIVER) && E.surf[k] <= 15; };
  const ia = Math.floor((X0 - 2 * E_CELL) / E_CELL), ib = Math.floor((X0 + W + 2 * E_CELL) / E_CELL);
  const ja = Math.floor((Y0 - 2 * E_CELL) / E_CELL), jb = Math.floor((Y0 + W + 2 * E_CELL) / E_CELL);
  for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
    if (!isR(i, j)) continue;
    const join = (di, dj) => segs.push((i + 0.5) * E_CELL, (j + 0.5) * E_CELL, (i + di + 0.5) * E_CELL, (j + dj + 0.5) * E_CELL);
    if (isR(i + 1, j)) join(1, 0);
    if (isR(i, j + 1)) join(0, 1);
    if (isR(i + 1, j + 1) && !isR(i + 1, j) && !isR(i, j + 1)) join(1, 1);        // diagonals only where no step joins them
    if (isR(i - 1, j + 1) && !isR(i - 1, j) && !isR(i, j + 1)) join(-1, 1);
  }
  return segs;
}
function segDist(px, py, s, o) {
  const ax = s[o], ay = s[o + 1], bx = s[o + 2], by = s[o + 3], dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** The ground's own height at (x, y), a little of TALL, by its kind, with w the wind there. Sets CREST where a dune's crest is. */
let CREST = false;
function groundHeight(G, x, y, w) {
  CREST = false;
  switch (G) {
    case G_SAND: {                                                        // dunes across the wind: gentle up, a slip face down
      const lam = 55 + 34 * vnoise(x, y, 610, 933);
      const s = (x - w.x) * w.c + (y - w.y) * w.s + 34 * (2 * vnoise(x, y, 233, 931) - 1);
      const p = mod(s / lam + w.ph, 1), up = 1 - PHI ** -3;
      CREST = p < up && p > up - 0.02;
      return PHI ** -3 * (p < up ? p / up : (1 - p) / PHI ** -3);
    }
    case G_PAVE: return u3(x, y, 941) < PHI ** -3 ? PHI ** -7 : 0;       // pebbles
    case G_SALT: return vor(x, y, 13, 943) < 1 ? PHI ** -7 : 0;           // raised rims round salt polygons
    case G_POLY: return PHI ** -6 * smooth(0, 3, vor(x, y, 21, 945));    // ice-wedge polygons, their troughs low
    case G_MOSS: return PHI ** -6 * vnoise(x, y, 5, 947);
    case G_SCREE: { vor(x, y, 5, 949); return PHI ** -6 * Math.max(0, 1 - (VD1 / 3) ** 2); }   // boulders
    case G_ICE: {                                                         // crevasse fields, and sastrugi along the wind
      const s = (x - w.x) * w.s - (y - w.y) * w.c, t = (x - w.x) * w.c + (y - w.y) * w.s;
      const crev = vnoise(x, y, 233, 955) > PHI ** -1 && mod(s + 8 * vnoise(x, y, 55, 957), 13) < 1.5;
      const sas = Math.sin((2 * Math.PI * (t + 8 * vnoise(x, y, 21, 958))) / (5 + 3 * vnoise(x, y, 55, 960)));
      return crev ? 0 : PHI ** -6 + PHI ** -8 * (0.5 + 0.5 * sas) * vnoise(x, y, 34, 962);
    }
    case G_MUD: return Math.abs(2 * vnoise(x, y, 34, 959) - 1) < PHI ** -4 ? 0 : PHI ** -7;   // tidal channels
    case G_SEA: {                                                         // swell along the wind, and a cross chop
      const s = (x - w.x) * w.c + (y - w.y) * w.s + 21 * (2 * vnoise(x, y, 144, 951) - 1);
      const s2 = (x - w.x) * w.s - (y - w.y) * w.c;
      return PHI ** -7 * (0.5 + 0.5 * Math.sin((2 * Math.PI * s) / 21 + w.ph * 6.28)) + PHI ** -8 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (s + s2 * PHI ** -1)) / 8));
    }
    case G_FLOE: return PHI ** -6;
    case G_REEF: { vor(x, y, 8, 997); return VD1 < 3 ? PHI ** -6 * (1 - (VD1 / 3) ** 2) : PHI ** -9; }   // coral heads in the shallows
    case G_LAKE: return PHI ** -9 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (x + y)) / 8));
  }
  return 0;
}

/** Is there snow on the land cell (x, y), with the month's snow cover s? It lies in drifts. */
const snowLies = (x, y, s) => s > 0.02 && vnoise(x, y, 21, 961) * PHI ** -1 + u3(x, y, 963) * (1 - PHI ** -1) < s;

/**
 * The Earth's plants and ground over the chunk at (x0, y0): the light each cell gets, the crowns over it, its
 * ground, and its place in the atlas.
 */
const E_T = {};                                                   // how long each stage took, for profiling
const lap = (k, t0) => { const t = performance.now(); E_T[k] = (E_T[k] || 0) + t - t0; return t; };
function forestE(x0, y0) {
  const E = EARTH, X0 = x0 - FME, Y0 = y0 - FME;
  let t0 = performance.now();
  // A. The warp and the atlas's smooth fields, every 8 cells on the plane's grid, at the wandered points.
  const gx0 = Math.floor(X0 / 8), gy0 = Math.floor(Y0 / 8), GW = Math.floor((X0 + FWE) / 8) - gx0 + 2, GH = Math.floor((Y0 + FWE) / 8) - gy0 + 2, GN = GW * GH;
  const gWX = new Float32Array(GN), gWY = new Float32Array(GN), gEl = new Float32Array(GN), gRl = new Float32Array(GN);
  const gS = new Float32Array(GN), gT = new Float32Array(GN), gTp = new Float32Array(GN), gP = new Float32Array(GN), gPn = new Float32Array(GN), gPm = new Float32Array(GN);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const g = gy * GW + gx, w = eWarpCorner(gx0 + gx, gy0 + gy), X = (gx0 + gx) * 8 + w[0], Y = (gy0 + gy) * 8 + w[1];
    gWX[g] = w[0]; gWY[g] = w[1];
    gEl[g] = eBilin(E.elev, AW, AH, E_CELL, X, Y); gRl[g] = reliefOf(eBilin(E.reliefC, AW, AH, E_CELL, X, Y));
    gS[g] = eBilin(E.SN, MW, MH, M_CELL, X, Y); gT[g] = eBilin(E.T, MW, MH, M_CELL, X, Y); gTp[g] = eBilin(E.Tp, MW, MH, M_CELL, X, Y);
    gP[g] = eBilin(E.P, MW, MH, M_CELL, X, Y); gPn[g] = eBilin(E.Pn, MW, MH, M_CELL, X, Y); gPm[g] = eBilin(E.Pm, MW, MH, M_CELL, X, Y);
  }
  const rivers = riversNear(X0, Y0, FWE);
  t0 = lap("grid", t0);
  // B. Each cell's atlas cell, its ground and how high the ground stands. The wind that lays dunes and swell is
  // looked up once for each block of 4 by 4 cells.
  const WB = Math.ceil(FWE / 4), winds = new Array(WB);
  for (let yy = 0; yy < FWE; yy++) {
    const fy = Y0 + yy, py = (fy + 0.5) / 8, gyi = Math.floor(py), ty = py - gyi;
    if (!(yy & 3)) for (let b = 0; b < WB; b++) winds[b] = null;
    for (let xx = 0; xx < FWE; xx++) {
      const fx = X0 + xx, px = (fx + 0.5) / 8, gxi = Math.floor(px), tx = px - gxi, g = (gyi - gy0) * GW + gxi - gx0, c = yy * FWE + xx;
      const wx = bil(gWX[g], gWX[g + 1], gWX[g + GW], gWX[g + GW + 1], tx, ty), wy = bil(gWY[g], gWY[g + 1], gWY[g + GW], gWY[g + GW + 1], tx, ty);
      const k = eIndex(fx + 0.5, fy + 0.5, wx, wy), surf = E.surf[k], wb = E.wbits[k];
      eK[c] = k;
      const sn = bil(gS[g], gS[g + 1], gS[g + GW], gS[g + GW + 1], tx, ty), T = bil(gT[g], gT[g + 1], gT[g + GW], gT[g + GW + 1], tx, ty);
      eSn[c] = sn; eTm[c] = T;
      // The ground's slope from the atlas's elevation, for hill shading: rising toward the lower right faces the light.
      const dEx = ((gEl[g + 1] - gEl[g]) * (1 - ty) + (gEl[g + GW + 1] - gEl[g + GW]) * ty) / 8;
      const dEy = ((gEl[g + GW] - gEl[g]) * (1 - tx) + (gEl[g + GW + 1] - gEl[g + 1]) * tx) / 8;
      eHill[c] = Math.max(-1, Math.min(1, (dEx + dEy) * PHI ** -2));
      let G, wet = WET_LAND;
      if (surf === SEA) {
        G = wb & W_REEF ? G_REEF : G_SEA; wet = WET_SEA;
        if (sn > 0.02) { const e = vor(fx, fy, 34, 995); if (unitOf(VID) < sn && e > 1.5 - sn) { G = G_FLOE; wet = WET_ICE; } }
      } else if (surf === LAKE) { G = G_LAKE; wet = T < -3 ? WET_ICE : WET_FRESH; }
      else {
        const B = E.biome[surf];
        if (wb & (W_GLACIER | W_SHELF_ICE) || surf === 15) { G = G_ICE; wet = WET_ICE; }
        else if (wb & W_SALT) G = G_SALT;
        else {
          G = GROUND_ID[B.ground];
          const soil = E.soil[k];
          if (surf === 13) G = soil === 4 ? G_SAND : soil === 1 ? G_SCREE : G_PAVE;
          else if (soil === 1 && G !== G_WATER && G !== G_MUD) G = G_SCREE;
          if (rivers.length) {
            const qx = fx + 0.5 + wx + 21 * (2 * vnoise(fx, fy, 89, 991) - 1), qy = fy + 0.5 + wy + 21 * (2 * vnoise(fx, fy, 89, 993) - 1);
            for (let o = 0; o < rivers.length; o += 4) if (segDist(qx, qy, rivers, o) < 3) { G = G_RIVER; wet = T < -3 ? WET_ICE : WET_FRESH; break; }
          }
          if (G === G_MUD && Math.abs(2 * vnoise(fx, fy, 34, 959) - 1) < PHI ** -4) wet = WET_FRESH;
        }
        if (B) ePh[c] = ePhase(B.ph, T, bil(gTp[g], gTp[g + 1], gTp[g + GW], gTp[g + GW + 1], tx, ty), bil(gP[g], gP[g + 1], gP[g + GW], gP[g + GW + 1], tx, ty),
                                bil(gPn[g], gPn[g + 1], gPn[g + GW], gPn[g + GW + 1], tx, ty), bil(gPm[g], gPm[g + 1], gPm[g + GW], gPm[g + GW + 1], tx, ty));
      }
      eG[c] = G; eWet[c] = wet;
      let wnd = null;
      if (G === G_SAND || G === G_SEA || G === G_ICE) wnd = winds[xx >> 2] || (winds[xx >> 2] = windAt(X0 + (xx & ~3) + 2, Y0 + (yy & ~3) + 2));
      let h = groundHeight(G, fx, fy, wnd);
      eCrest[c] = CREST ? 1 : 0;
      if (surf <= 15 && G !== G_RIVER) {                                  // mountains: ridges as far as the relief runs
        const rl = bil(gRl[g], gRl[g + 1], gRl[g + GW], gRl[g + GW + 1], tx, ty), A = PHI ** -3 * smooth(300, 3000, rl);
        if (A > 0.001) h += A * ((1 - Math.abs(2 * vnoise(fx, fy, 144, 953) - 1)) ** PHI * (1 - PHI ** -2) + (1 - Math.abs(2 * vnoise(fx, fy, 55, 957) - 1)) ** PHI * PHI ** -2);
      }
      eh[c] = h;
      eSnowy[c] = wet === WET_LAND && surf <= 15 && G !== G_ICE && snowLies(fx, fy, sn) ? 1 : 0;
    }
  }
  t0 = lap("ground", t0);
  // C. The plants, every biome's on the lattices of their spacing.
  ev.fill(0); eLv.fill(0); eCr.fill(-1); ecs.length = 0;
  E_FAST = { X0, Y0, W: FWE, k: eK };
  for (const L of EL) {
    const reach = L.reach;
    for (let j = Math.floor((Y0 - reach) / L.g); j <= Math.floor((Y0 + FWE + reach) / L.g); j++)
      for (let i = Math.floor((X0 - reach) / L.g); i <= Math.floor((X0 + FWE + reach) / L.g); i++) {
        const c = crownOfE(L, i, j);
        if (!c) continue;
        const n = ecs.push(c) - 1, cr = c.r * SHAPE_REACH[c.shape];
        const ya = Math.max(0, Math.floor(c.y - cr) - Y0), yb = Math.min(FWE - 1, Math.ceil(c.y + cr) - Y0);
        const xa = Math.max(0, Math.floor(c.x - cr) - X0), xb = Math.min(FWE - 1, Math.ceil(c.x + cr) - X0);
        for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) {
          const k = yy * FWE + xx, v = crownHeightE(c, X0 + xx + 0.5, Y0 + yy + 0.5);
          if (v > ev[k]) { ev[k] = v; eLv[k] = c.L; eCr[k] = n; }
        }
      }
  }
  E_FAST = null;
  // Snow buries what grows lowest.
  for (let k = 0; k < FWE2; k++) if (eSnowy[k] && ev[k] > 0 && ev[k] < PHI ** -4) { ev[k] = 0; eLv[k] = 0; eCr[k] = -1; }
  t0 = lap("crowns", t0);
  // D. Shadows, from a sun as high as the month's noon sun at each row's latitude; and the sky each place sees.
  const fh = eB;
  for (let k = 0; k < FWE2; k++) fh[k] = eh[k] + ev[k];
  const fall = new Float32Array(FWE);
  for (let yy = 0; yy < FWE; yy++) fall[yy] = Math.SQRT2 * Math.max(PHI ** -1, Math.min(PHI ** 2, Math.tan((noonSun(latOfY(Y0 + yy), E_M) * Math.PI) / 180)));
  for (let yy = 0; yy < FWE; yy++) for (let xx = 0; xx < FWE; xx++) {
    const k = yy * FWE + xx;
    ez[k] = yy && xx ? Math.max(ez[k - FWE - 1] - fall[yy], fh[k - FWE - 1] * TALL) : 0;
  }
  const sky = new Float32Array(FWE2);
  boxBlurE(fh, sky, eA, 13);
  const light = new Float32Array(N * N), hl = new Uint8Array(N * N), lean = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const night = dayHours(latOfY(y0 + y), E_M), dark = night < 1 ? PHI ** -2 : night < 3 ? PHI ** -1 : 1;
    for (let x = 0; x < N; x++) {
      const k = (y + FME) * FWE + x + FME, h = fh[k];
      const slope = ((fh[k + 1] - fh[k - 1]) + (fh[k + FWE] - fh[k - FWE])) * TALL / 2;
      const ln = Math.max(-1, Math.min(1, slope * PHI));
      const shade = Math.min(1, Math.max(0, (ez[k] - h * TALL) / PHI));
      const sk = Math.max(0, sky[k] - h);
      const rim = eLv[k] && Math.min(fh[k - 1], fh[k + 1], fh[k - FWE], fh[k + FWE]) < h - PHI ** -4 ? PHI ** -2 : 1;
      let f = rim * (1 + PHI ** -2 * ln) * (1 - (1 - PHI ** -2) * shade) * (1 - (1 - PHI ** -3) * Math.min(1, sk * PHI * PHI)) * (1 + PHI ** -2 * eHill[k]);
      if (eWet[k] === WET_SEA || eWet[k] === WET_FRESH) f = 1 + (f - 1) * PHI ** -1;          // water lies flat
      light[y * N + x] = f * dark;
      lean[y * N + x] = ln;
      hl[y * N + x] = (eLv[k] << 6) | Math.round(Math.min(1, ev[k]) * 63);
    }
  }
  lap("light", t0);
  return { light, hl, lean };
}

// Where the soil's dots fall in a place's palette: its lightness, from the darkest tenth of its dots to the
// lightest (34 to 178), laid across the palette's five stops, so a place takes its own lights and darks,
// bright sand and snow and dark forest, and the soil decides only where each dot falls among them.
const E_L0 = 34, E_L1 = 178, E_AT = [0, PHI ** -4, 0.42, 1 - PHI ** -4, 1];     // the median dot (0.42) wears the middle colour
function mappedPos(p, t, out) {
  let n = 0;
  while (n < 3 && t > E_AT[n + 1]) n++;
  const a = p.stops[n], b = p.stops[n + 1], u = Math.min(1, Math.max(0, (t - E_AT[n]) / (E_AT[n + 1] - E_AT[n])));
  out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
  return out;
}

/** A passage's palette for a look key: one of the five nearest the look, by the passage's own hash. */
function passLook(P, key) {
  let m = P.el;
  if (!m) m = P.el = new Map();
  let e = m.get(key);
  if (!e) {
    const c = eLookPalettes(key);
    e = c[h3(Math.floor(P.x), Math.floor(P.y), key) % c.length];
    m.set(key, e);
  }
  return e;
}
/** The look key of the place under a crown this month. */
function crownKey(c) {
  if (c.key < 0) {
    const pr = eSite(c.x, c.y, {}, true), B = EARTH.biome[c.biome];
    c.phase = pr.phase;
    c.key = lookKey(B.look[pr.phase], c.soil, c.bare);
  }
  return c.key;
}
/** A crown's own colour: conifers the dark of their palette, broadleaves any of its three, the turning ones its brightest. */
function crownTintE(c) {
  if (!c.tint) {
    const key = crownKey(c);
    nearestPassages(c.x + wanderX(c.x, c.y), c.y + wanderY(c.x, c.y));
    const pal = passLook(PA, key).pal, h = h3(Math.floor(c.x), Math.floor(c.y), 541);
    c.tint = c.shape === SHAPES.cone || c.shape === SHAPES.column ? pal[h & 1] : c.turns && c.phase === P_TURNING ? pal[2] : pal[h % 3];
  }
  return c.tint;
}
/** Is a crown leafless this month, a winter broadleaf? */
function crownBare(c) {
  crownKey(c);
  const B = EARTH.biome[c.biome];
  return c.phase === P_BARE && B.ph === 1 && (c.shape === SHAPES.lobed) && (c.biome !== 6 || c.turns);
}

// ---- life's sites on the Earth ----------------------------------------------------------------------------
// As in the rainforest, each kind keeps a lattice with one candidate site a square. A site is kept when its
// place's biome (or sea zone) has that kind at some height, in the realm (or hemisphere) there, with a
// species; when the month's conditions suit it (the grammar's WHEN); and when a cell of the right height and
// ground lies within 21 cells. It wears the painting its passage wears there, in the painting's own colours.
const MED_LAND = 1, MED_FRESH = 2, MED_SEA = 4, MED_ICE = 8;
const WET_MED = [MED_LAND, MED_FRESH, MED_SEA, MED_ICE];
const E_HABITATS = [
  // kind              lattice  salt  odds        bands  media
  ["ants",             144,     1301, PHI ** -2,  1,     MED_LAND],
  ["mould",            233,     1307, PHI ** -1,  3,     MED_LAND],
  ["frogs",            89,      1311, PHI ** -2,  3,     MED_LAND | MED_FRESH],
  ["ferns",            89,      1313, PHI ** -1,  1,     MED_LAND],
  ["snakes",           233,     1317, PHI ** -1,  3,     MED_LAND | MED_FRESH | MED_SEA],
  ["fireflies",        233,     1319, PHI ** -1,  6,     MED_LAND],
  ["morphos",          144,     1321, PHI ** -1,  3,     MED_LAND],
  ["blooms",           89,      1327, PHI ** -1,  7,     MED_LAND],
  ["hummers",          377,     1329, PHI ** -1,  6,     MED_LAND],
  ["troops",           377,     1331, PHI ** -1,  12,    MED_LAND],
  ["herds",            377,     1337, PHI ** -1,  3,     MED_LAND],
  ["hunters",          610,     1339, PHI ** -1,  3,     MED_LAND | MED_ICE],
  ["colonies",         377,     1343, PHI ** -2,  3,     MED_LAND | MED_ICE],
  ["swarms",           233,     1347, PHI ** -2,  7,     MED_LAND | MED_FRESH],
  ["waders",           233,     1349, PHI ** -1,  3,     MED_FRESH | MED_SEA],
  ["schools",          233,     1351, PHI ** -1,  3,     MED_FRESH | MED_SEA],
  ["whales",           610,     1353, PHI ** -2,  1,     MED_SEA],
  ["floes",            377,     1357, PHI ** -2,  1,     MED_SEA | MED_ICE],
  ["bioluminescence",  233,     1359, PHI ** -2,  1,     MED_SEA],
  ["fire",             987,     1361, PHI ** -2,  3,     MED_LAND],
  ["dust",             610,     1363, PHI ** -2,  1,     MED_LAND],
];
const ESP = {};
function habitatsE(x0, y0, hl, dd, off, wet, pp, lk, oc, os) {
  const sites = [];
  const inChunk = (x, y) => x >= x0 && y >= y0 && x < x0 + N && y < y0 + N;
  for (const [kind, g, salt, odds, bands, media] of E_HABITATS) {
    for (let j = Math.floor(y0 / g); j <= Math.floor((y0 + N - 1) / g); j++)
      for (let i = Math.floor(x0 / g); i <= Math.floor((x0 + N - 1) / g); i++) {
        let sx = Math.floor((i + u3(i, j, salt)) * g), sy = Math.floor((j + u3(i, j, salt + 1)) * g);
        if (!inChunk(sx, sy) || u3(i, j, salt + 2) >= odds) continue;
        const pr = eSite(sx, sy, ESP, true), sp = eSpecies(kind, pr, pr.lat);
        if (!sp || !eWhen(kind, pr, E_M)) continue;
        let found = false;
        const bandsHere = sp.level === "crowns" ? bands & 14 : sp.level === "floor" ? bands & 3 : bands;
        for (const [dx, dy] of SEEK) {
          const x = sx + dx, y = sy + dy;
          if (!inChunk(x, y)) continue;
          const c = (y - y0) * N + x - x0;
          if (!((bandsHere >> (hl[c] >> 6)) & 1) || !(WET_MED[wet[c]] & media)) continue;
          sx = x; sy = y; found = true; break;
        }
        if (!found) continue;
        const c = (sy - y0) * N + sx - x0, k = off + c, P = pp[k], ent = passLook(P, lk[k]);
        const site = { kind, x: sx + 0.5, y: sy + 0.5, seed: h3(i, j, salt + 3), w: ent.w, turn: 0, d: dd[k], h: (hl[c] & 63) / 63,
                       sp: sp.list[h3(i, j, salt + 4) % sp.list.length], level: sp.level, biome: pr.surf, phase: pr.phase, T: pr.T, gl: lumE(ent.pal[1]) };
        if (kind === "mould") {
          // Food, as in the rainforest: the brightest dots low down within 55 cells, which the mould will join up.
          const lum = [];
          for (let y = Math.max(y0, sy - 55); y < Math.min(y0 + N, sy + 56); y++)
            for (let x = Math.max(x0, sx - 55); x < Math.min(x0 + N, sx + 56); x++) {
              const kk = (y - y0) * N + x - x0;
              if ((hl[kk] >> 6) > 1 || !os[off + kk] || Math.hypot(x - sx, y - sy) > 55) continue;
              lum.push([0.3 * oc[(off + kk) * 3] + 0.59 * oc[(off + kk) * 3 + 1] + 0.11 * oc[(off + kk) * 3 + 2], x + 0.5, y + 0.5]);
            }
          lum.sort((a, b) => b[0] - a[0]);
          const food = [];
          for (const [, x, y] of lum) {
            if (food.length >= 2 * 8) break;
            let near = false;
            for (let f = 0; f < food.length; f += 2) if (Math.hypot(food[f] - x, food[f + 1] - y) < 13) near = true;
            if (!near) food.push(x, y);
          }
          site.food = food;
        }
        sites.push(site);
      }
  }
  return sites;
}

/** Grow the chunk of the Earth covering tile (ci, cj). */
function earthChunk(ci, cj) {
  const E = EARTH, x0 = ci * N, y0 = cj * N, X0 = x0 - FME, Y0 = y0 - FME;
  const s0 = Math.floor(y0 / SEG) * SEG, s1 = (Math.floor((y0 + N - 1) / SEG) + 1) * SEG, HH = s1 - s0;
  const oc = new Uint8Array(N * HH * 3), os = new Uint8Array(N * HH), ow = new Uint16Array(N * HH), dd = new Float32Array(N * HH);
  const pp = new Array(N * HH), ps = new Float32Array(N * HH), dk = new Uint8Array(N * HH), lk = new Int32Array(N * HH), crownHere = new Int32Array(N * HH);

  // A. The Earth over this ground; and the passages' wandering edges, as in chunk().
  const { light, hl, lean } = forestE(x0, y0);
  const gx0 = x0 / 8 - 1, gy0 = Math.floor(s0 / 8) - 1, GW = N / 8 + 3, GH = Math.ceil(HH / 8) + 3;
  const WX = new Float32Array(GW * GH), WY = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    WX[gy * GW + gx] = wanderX((gx0 + gx) * 8, (gy0 + gy) * 8); WY[gy * GW + gx] = wanderY((gx0 + gx) * 8, (gy0 + gy) * 8);
  }
  const snowKey = lookKey(L_SNOW(), -1, 0), iceKey = lookKey(L_ICE(), -1, 0), saltKey = lookKey(L_SALT(), -1, 0), lakeKey = lookKey(L_LAKE(), -1, 0);

  let t1 = performance.now();
  // B. Where each cell takes its soil from, as in chunk(); and which of the Earth's looks it wears.
  for (let yy = 0; yy < HH; yy++) {
    const y = s0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = yy * N + xx, d = depth(x, y), fk = (y - Y0) * FWE + (x - X0);
      dd[k] = d;
      const fx = x / 8 - gx0, fy = y / 8 - gy0, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, g = iy * GW + ix;
      nearestPassages(x + (WX[g] * (1 - tx) + WX[g + 1] * tx) * (1 - ty) + (WX[g + GW] * (1 - tx) + WX[g + GW + 1] * tx) * ty,
                      y + (WY[g] * (1 - tx) + WY[g + 1] * tx) * (1 - ty) + (WY[g + GW] * (1 - tx) + WY[g + GW + 1] * tx) * ty);
      const P = u3(x, y, 523) < 0.5 + 0.5 * PE * PE * (3 - 2 * PE) ? PA : PB, st = smooth(PHI ** -3, PHI ** -1, d);
      pp[k] = P; ps[k] = st;
      dk[k] = d >= (P.kind === DRIP ? PHI ** -3 : PHI ** -1) ? 1 : 0;
      // The look: water, ice and salt their own; snow where it lies and nothing stands; else the biome's for the month.
      const ak = eK[fk], G = eG[fk], surf = E.surf[ak], cn = eCr[fk];
      let crown = cn >= 0 && ev[fk] > 0 ? ecs[cn] : null;
      if (crown && crownBare(crown) && u3(x, y, 1003) > PHI ** -2) crown = null;       // a bare crown: twigs, and the ground through them
      crownHere[k] = crown ? cn : -1;
      let key;
      if (G === G_SEA || G === G_REEF) key = lookKey(G === G_REEF ? E.lookIdx["sea, tropical shallows"] : seaLook(E.marine[ak] & 15, E.marine[ak] >> 4), -1, 0);
      else if (G === G_FLOE || G === G_ICE) key = iceKey;
      else if (G === G_LAKE || G === G_RIVER) key = eTm[fk] < -3 ? iceKey : lakeKey;
      else if (G === G_SALT) key = saltKey;
      else {
        const B = E.biome[surf];
        if (!crown && eSnowy[fk]) key = snowKey;
        else if (!crown && (G === G_WATER || (G === G_MUD && eWet[fk] === WET_FRESH))) key = eTm[fk] < -3 ? iceKey : lakeKey;
        else key = lookKey(B.look[ePh[fk]], E.soil[ak], eBare(B, (E.canopy[ak] * 45) / 255, aridOf(E.arid[ak])));
      }
      lk[k] = key;
      const band = crown ? eLv[fk] : 0;
      const b = Math.min(blockOf(d), st > 0 && P.kind === MOSAIC ? 8 : COARSEST[band], st > 0 ? KIND_CAP[P.kind] : 8);
      const bx = x - mod(x, b), by = y - mod(y, b);
      let qx = bx, qy = by;
      if (P.kind === SPRAY && st > 0) {
        const a = u3(x, y, 531) * 2 * Math.PI, r = 8 * st * Math.sqrt(u3(x, y, 533));
        qx += Math.round(Math.cos(a) * r); qy += Math.round(Math.sin(a) * r);
      }
      sourceOf(qx, qy, b === 1 ? d : depth(bx, by));
      const t = sampleAt(QX, QY), sz = t.size[SI];
      oc[k * 3] = t.col[SI * 3]; oc[k * 3 + 1] = t.col[SI * 3 + 1]; oc[k * 3 + 2] = t.col[SI * 3 + 2];
      ow[k] = t.work[SI];
      os[k] = b === 1 ? sz : (x - bx === b - 1 || y - by === b - 1 || !sz) ? 0 : 3;
      if (P.kind === SPRAY && st > 0 && os[k]) os[k] = u3(x, y, 537) < PHI ** -3 * st ? 0 : u3(x, y, 539) < PHI ** -1 ? 1 : 3;
    }
  }

  t1 = lap("cells", t1);
  // C. Drips, as in chunk().
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
  for (let xx = 0; xx < N; xx++) {
    const x = x0 + xx, down = u3(x, 0, 29) < 0.5;
    for (let seg = 0; seg < HH; seg += SEG) {
      let yy = seg;
      while (yy < seg + SEG) {
        const k = yy * N + xx;
        if (!os[k] || !dk[k] || (pp[k].kind !== DRIP && vnoise(x, s0 + yy, 55, 2) < PHI ** -2)) { yy++; continue; }
        const run = [];
        while (yy < seg + SEG && os[yy * N + xx] && dk[yy * N + xx]) { run.push(yy * N + xx); yy++; }
        if (run.length < 2) continue;
        const items = run.map((j) => [lum(oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2]), oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2], ow[j]]);
        items.sort((a, b) => (down ? a[0] - b[0] : b[0] - a[0]));
        run.forEach((j, n) => { oc[j * 3] = items[n][1]; oc[j * 3 + 1] = items[n][2]; oc[j * 3 + 2] = items[n][3]; ow[j] = items[n][4]; });
      }
    }
  }

  t1 = lap("drips", t1);
  // D. Each cell in its place's paintings, lit by the Earth over it, two pixels a cell.
  const T = N * R, px = new Uint8ClampedArray(T * T * 4);
  for (let j = 0; j < px.length; j += 4) { px[j] = GROUND[0]; px[j + 1] = GROUND[1]; px[j + 2] = GROUND[2]; px[j + 3] = 255; }
  const work = new Uint16Array(N * N), dgrid = new Float32Array(32 * 32), wet = new Uint8Array(N * N), off = (y0 - s0) * N, gm = [0, 0, 0];
  const birds = [], glints = [], sway = [], crests = [], coast = [], sea = [], leaves = [];
  const plant = new Uint16Array(N * N).fill(65535), ground = new Uint8Array(N * N);
  const q0 = 1 - PHI ** -4;
  for (let yy = 0; yy < N; yy++) {
    const y = y0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = off + yy * N + xx, c = yy * N + xx, d = dd[k], fk = (y - Y0) * FWE + (x - X0);
      work[c] = ow[k];
      const wt = eWet[fk];
      wet[c] = wt; ground[c] = eSnowy[fk] && crownHere[k] < 0 ? 15 : eG[fk];
      if (crownHere[k] >= 0) plant[c] = ecs[crownHere[k]].plant;
      let r = oc[k * 3], g = oc[k * 3 + 1], b = oc[k * 3 + 2];
      const P = pp[k], st = ps[k], ent = passLook(P, lk[k]);
      {
        // The place's painting laid over the cell, the soil's lightness choosing where in it the cell falls: nearly all
        // the way on calm ground, all the way out in the outskirts. Nocturnes sink as in chunk().
        let tl = Math.min(1, Math.max(0, (0.3 * r + 0.59 * g + 0.11 * b - E_L0) / (E_L1 - E_L0)));
        if (EVEN.has(eG[fk]) || eSnowy[fk]) tl = 0.42 + (tl - 0.42) * PHI ** -1;
        const m = mappedPos(ent, tl, gm), q = q0 + (1 - q0) * st;
        r += (m[0] - r) * q; g += (m[1] - g) * q; b += (m[2] - b) * q;
        if (P.kind === NOCTURNE && st > 0) {
          if (0.3 * r + 0.59 * g + 0.11 * b < 144) { const f2 = 1 - (1 - PHI ** -4) * st; r *= f2; g *= f2; b *= f2; }
          else { const k2 = PHI ** -2 * st; r += (255 - r) * k2; g += (255 - g) * k2; b += (255 - b) * k2; }
        }
      }
      oc[k * 3] = r; oc[k * 3 + 1] = g; oc[k * 3 + 2] = b;
      let s = os[k];
      const cn = crownHere[k], L = cn >= 0 ? eLv[fk] : 0;
      if (s && KAPPA && L >= CANOPY && u3(x, y, 37) < (smooth(PHI ** -2, 1, d) / PHI) * KAPPA * KIND_BIRDS[P.kind]) { birds.push(x + 0.5, y + 0.5, r, g, b, ow[k]); s = 0; }
      if (!s) {
        // A gap in the soil's weave shows the place's own darkest colour, not the bare ground under the plane.
        const dk2 = ent.pal[0], f0 = light[c];
        for (let dy = 0; dy < R; dy++) for (let dx = 0; dx < R; dx++) {
          const j = ((yy * R + dy) * T + xx * R + dx) * 4;
          px[j] = dk2[0] * f0; px[j + 1] = dk2[1] * f0; px[j + 2] = dk2[2] * f0;
        }
        continue;
      }
      if (L >= CANOPY && u3(x, y, 401) < PHI ** -5 && glints.length < 6 * 987) glints.push(x + 0.5, y + 0.5, r + (255 - r) / PHI, g + (255 - g) / PHI, b + (255 - b) / PHI, ow[k]);
      const f = light[c] * KIND_KEY[P.kind] ** st * (1 + PHI ** -1 * (1 - smooth(0, PHI ** -1, d))), w = s === 3 ? R : 1;
      let pr = r, pg = g, pb = b;
      if (cn >= 0) {
        const cr = ecs[cn], tc = crownTintE(cr), q = TINT[Math.max(1, L)];
        pr += (tc[0] - r) * q; pg += (tc[1] - g) * q; pb += (tc[2] - b) * q;
        // Snow on the sunward side of evergreen crowns.
        if (eSnowy[fk] || eSn[fk] > PHI ** -2) if (lean[c] > 0 && u3(x, y, 1001) < eSn[fk] * PHI ** -1) { const sp = passLook(P, snowKey).pal[2]; pr = sp[0]; pg = sp[1]; pb = sp[2]; }
        if ((cr.shape === SHAPES.tussock || cr.shape === SHAPES.reed || cr.shape === SHAPES.cushion) && u3(x, y, 1005) < PHI ** -4 && sway.length < 6 * 987)
          sway.push(x + 0.5, y + 0.5, pr + (255 - pr) * PHI ** -2, pg + (255 - pg) * PHI ** -2, pb + (255 - pb) * PHI ** -2, ow[k]);
        if (cr.phase === P_TURNING && L >= 1 && u3(x, y, 1007) < PHI ** -6 && leaves.length < 6 * 377) leaves.push(x + 0.5, y + 0.5, tc[0], tc[1], tc[2], ow[k]);
      } else if (wt === WET_SEA) {
        if (lean[c] > PHI ** -2 && u3(x, y, 1009) < PHI ** -4 && sea.length < 6 * 987) sea.push(x + 0.5, y + 0.5, r + (255 - r) / PHI, g + (255 - g) / PHI, b + (255 - b) / PHI, ow[k]);
        if (u3(x, y, 1011) < PHI ** -2 && coast.length < 6 * 987) {
          let land = false;
          for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const w2 = eWet[fk + oy * FWE + ox]; if (w2 === WET_LAND || w2 === WET_ICE) { land = true; break; } }
          if (land) coast.push(x + 0.5, y + 0.5, r + (255 - r) / PHI, g + (255 - g) / PHI, b + (255 - b) / PHI, ow[k]);
        }
      }
      if (eCrest[fk] && u3(x, y, 1013) < PHI ** -3 && crests.length < 5 * 987) crests.push(x + 0.5, y + 0.5, pr + (255 - pr) * PHI ** -2, pg + (255 - pg) * PHI ** -2, pb + (255 - pb) * PHI ** -2);
      for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
        const j = ((yy * R + dy) * T + xx * R + dx) * 4;
        px[j] = pr * f; px[j + 1] = pg * f; px[j + 2] = pb * f;
      }
    }
  }
  for (let by = 0; by < 32; by++) for (let bx = 0; bx < 32; bx++) dgrid[by * 32 + bx] = dd[off + (by * 8 + 4) * N + bx * 8 + 4];
  t1 = lap("paint", t1);
  const sites = habitatsE(x0, y0, hl, dd, off, wet, pp, lk, oc, os);
  lap("sites", t1);
  const tall = [];
  for (const c of ecs) if (c.L >= 2 && c.x >= x0 && c.y >= y0 && c.x < x0 + N && c.y < y0 + N) tall.push(c.x, c.y, c.r, c.top, c.L, c.shape, c.c5, c.s5, c.c8, c.s8, c.plant);
  const F = (a) => Float32Array.from(a);
  return { type: "chunk", ci, cj, px, work, dgrid, birds: F(birds), hl, sites, glints: F(glints), wet, sway: F(sway), crests: F(crests), coast: F(coast), sea: F(sea), leaves: F(leaves), plant, ground, tall: F(tall), month: E_M };
}

{
  // The worker takes up the Earth when the page sends it, and a new month whenever the page turns one.
  const plain = onmessage;
  onmessage = (e) => {
    const m = e.data;
    if (m.type === "earth") {
      if (!EARTH && m.earth) earthSetup(m.earth);
      if (EARTH) { earthMonth(m.month); E_M = m.month.m; EARTH_ON = true; }
      return;
    }
    if (m.type === "plane") { EARTH_ON = false; return; }
    if (m.type === "month") { earthMonth(m.data); E_M = m.data.m; return; }
    if (m.type === "chunk" && EARTH_ON) {
      const out = earthChunk(m.ci, m.cj);
      postMessage(out, [out.px.buffer, out.work.buffer, out.dgrid.buffer, out.birds.buffer, out.hl.buffer, out.glints.buffer, out.wet.buffer,
                        out.sway.buffer, out.crests.buffer, out.coast.buffer, out.sea.buffer, out.leaves.buffer, out.plant.buffer, out.ground.buffer, out.tall.buffer]);
      return;
    }
    plain(e);
  };
}

/**
 * dirt.js — procedural dirt, built by stacking layers of different digital functions.
 *
 * Every layer is a different generator (gradient noise, cellular noise, reaction-diffusion,
 * random walks, stamped particles …) and they are composited with W3C blend modes into one
 * RGBA image. Any layer can be given `relief`, which treats its alpha (or its own height field)
 * as a bump map and lights it from the top-left, so grit and clumps read as physical matter.
 *
 * Pure JavaScript, no DOM and no dependencies: it runs in the browser and in Node alike.
 * With `tile: true` (the default) the output wraps seamlessly, so a small tile can be used as
 * a repeating CSS background.
 *
 *   import { generateDirt, PRESETS } from './dirt.js';
 *   const img = generateDirt({ ...PRESETS['potting-soil'], width: 512, height: 512, seed: 7 });
 *   // img.data is a Uint8ClampedArray of straight-alpha RGBA, ready for new ImageData(...)
 */

// ---------------------------------------------------------------------------------------------
// Randomness and hashing
// ---------------------------------------------------------------------------------------------

/** Seeded PRNG (mulberry32). Returns a function yielding floats in [0, 1). */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

const hashFloat = (x, y, s) => hash3(x, y, s) / 4294967296;
const mod = (a, n) => ((a % n) + n) % n;

// 256 unit gradients for Perlin noise.
const GX = new Float32Array(256);
const GY = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  GX[i] = Math.cos((i / 256) * Math.PI * 2);
  GY[i] = Math.sin((i / 256) * Math.PI * 2);
}

// ---------------------------------------------------------------------------------------------
// Noise functions. All take a period (px, py) in lattice units so the result tiles.
// ---------------------------------------------------------------------------------------------

/** Periodic 2D gradient (Perlin) noise, roughly in [-1, 1]. */
export function perlin(x, y, px, py, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ix0 = mod(x0, px);
  const iy0 = mod(y0, py);
  const ix1 = (ix0 + 1) % px;
  const iy1 = (iy0 + 1) % py;

  const g00 = hash3(ix0, iy0, seed) & 255;
  const g10 = hash3(ix1, iy0, seed) & 255;
  const g01 = hash3(ix0, iy1, seed) & 255;
  const g11 = hash3(ix1, iy1, seed) & 255;

  const n00 = GX[g00] * fx + GY[g00] * fy;
  const n10 = GX[g10] * (fx - 1) + GY[g10] * fy;
  const n01 = GX[g01] * fx + GY[g01] * (fy - 1);
  const n11 = GX[g11] * (fx - 1) + GY[g11] * (fy - 1);

  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = n00 + (n10 - n00) * u;
  const b = n01 + (n11 - n01) * u;
  return (a + (b - a) * v) * 1.41421356;
}

/** Fractal Brownian motion: octaves of Perlin noise at doubling frequency. */
export function fbm(x, y, px, py, seed, octaves = 5, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin(x * f, y * f, px * f, py * f, seed + i * 101);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Ridged multifractal: sharp creases where fBm crosses zero. Range [0, 1]. */
export function ridged(x, y, px, py, seed, octaves = 5, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(perlin(x * f, y * f, px * f, py * f, seed + i * 131));
    sum += amp * n * n;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Periodic Worley (cellular) noise. Writes F1, F2 and the nearest cell's id into `out`. */
export function worley(x, y, px, py, seed, jitter, out) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let f1 = 1e9;
  let f2 = 1e9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox;
      const gy = cy + oy;
      const wx = mod(gx, px);
      const wy = mod(gy, py);
      const h = hash3(wx, wy, seed);
      const jx = gx + 0.5 + (((h & 0xffff) / 65535) - 0.5) * jitter;
      const jy = gy + 0.5 + (((h >>> 16) / 65535) - 0.5) * jitter;
      const dx = jx - x;
      const dy = jy - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = h;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  out.f1 = f1;
  out.f2 = f2;
  out.id = id;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** '#rrggbb' or '#rgb' → [r, g, b] in 0..1. */
export function parseColor(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Number of whole noise periods across `size` pixels for features of `scalePx` pixels. */
const period = (size, scalePx) => Math.max(1, Math.round(size / Math.max(1, scalePx)));

/**
 * A layer's working surface: straight-alpha colour plus an optional height field used by
 * `relief`. Renderers either fill it pixel by pixel or stamp shapes into it.
 */
class Surface {
  constructor(w, h, tile) {
    this.w = w;
    this.h = h;
    this.tile = tile;
    this.r = new Float32Array(w * h);
    this.g = new Float32Array(w * h);
    this.b = new Float32Array(w * h);
    this.a = new Float32Array(w * h);
    this.height = null;
  }

  /** Map a possibly out-of-range pixel to an index (wrapping when tiling), or -1. */
  index(x, y) {
    if (this.tile) {
      x = mod(x, this.w);
      y = mod(y, this.h);
    } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      return -1;
    }
    return y * this.w + x;
  }

  /** Source-over a colour with coverage `alpha` onto pixel i. */
  over(i, c, alpha) {
    if (alpha <= 0) return;
    const a0 = this.a[i];
    const ao = alpha + a0 * (1 - alpha);
    const k = alpha / ao;
    this.r[i] += (c[0] - this.r[i]) * k;
    this.g[i] += (c[1] - this.g[i]) * k;
    this.b[i] += (c[2] - this.b[i]) * k;
    this.a[i] = ao;
  }

  /** Keep the stronger of two coverages; stops strokes from building up where stamps overlap. */
  max(i, c, alpha) {
    if (alpha <= this.a[i]) return;
    this.r[i] = c[0];
    this.g[i] = c[1];
    this.b[i] = c[2];
    this.a[i] = alpha;
  }

  heightField() {
    if (!this.height) this.height = new Float32Array(this.w * this.h);
    return this.height;
  }
}

/** Fake bump lighting: shade colour by the slope of the height field (or alpha). */
function applyRelief(s, relief, bump = 6) {
  if (!relief) return;
  const H = s.height || s.a;
  const { w, h } = s;
  // Light from the upper left, a little above the surface.
  let lx = -0.55;
  let ly = -0.65;
  let lz = 0.52;
  const ll = Math.hypot(lx, ly, lz);
  lx /= ll;
  ly /= ll;
  lz /= ll;
  for (let y = 0; y < h; y++) {
    const yu = s.tile ? mod(y - 1, h) : Math.max(0, y - 1);
    const yd = s.tile ? mod(y + 1, h) : Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s.a[i] <= 0) continue;
      const xl = s.tile ? mod(x - 1, w) : Math.max(0, x - 1);
      const xr = s.tile ? mod(x + 1, w) : Math.min(w - 1, x + 1);
      const dx = (H[y * w + xr] - H[y * w + xl]) * bump;
      const dy = (H[yd * w + x] - H[yu * w + x]) * bump;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const shade = ((-dx * lx - dy * ly + lz) * inv) / lz; // 1 on flat ground
      const f = Math.max(0, 1 + relief * (shade - 1));
      s.r[i] = clamp01(s.r[i] * f);
      s.g[i] = clamp01(s.g[i] * f);
      s.b[i] = clamp01(s.b[i] * f);
    }
  }
}

/** Anti-aliased round stamp at (cx, cy) — the brush used by strokes (scratches, fibres). */
function stampDisc(s, cx, cy, radius, color, strength) {
  const r = radius + 1;
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const cov = clamp01(radius + 0.5 - d);
      if (cov <= 0) continue;
      const i = s.index(x, y);
      if (i >= 0) s.max(i, color, cov * strength);
    }
  }
}

/** A wandering line built by a random walk with drifting curvature. */
function stroke(s, rand, o) {
  let x = rand() * s.w;
  let y = rand() * s.h;
  let ang = o.angle ?? rand() * Math.PI * 2;
  let turn = (rand() - 0.5) * o.curl;
  const len = o.length * (0.4 + rand() * 0.9);
  const width = o.width * (0.5 + rand());
  const color = o.color;
  const steps = Math.ceil(len / 0.6);
  for (let k = 0; k < steps; k++) {
    const t = k / steps;
    // Taper both ends and let the pressure flicker along the way.
    const env = Math.pow(Math.sin(Math.PI * t), 0.6) * (0.55 + 0.45 * Math.sin(t * 17 + o.phase));
    stampDisc(s, x, y, (width / 2) * (0.6 + 0.4 * env), color, o.strength * env);
    turn += (rand() - 0.5) * o.curl * 0.3;
    turn *= 0.98;
    ang += turn * 0.6;
    x += Math.cos(ang) * 0.6;
    y += Math.sin(ang) * 0.6;
  }
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const palette = (list) => list.map(parseColor);

// ---------------------------------------------------------------------------------------------
// Layers. Each takes (surface, params, rand, seed) and fills the surface.
// ---------------------------------------------------------------------------------------------

export const LAYERS = {
  /** Warped fBm wash: the base film of soil or grime. */
  wash(s, p, rand, seed) {
    const scale = p.scale ?? 180;
    const px = period(s.w, scale);
    const py = period(s.h, scale);
    const cA = parseColor(p.colors?.[0] ?? '#4a3527');
    const cB = parseColor(p.colors?.[1] ?? '#2a1d14');
    const coverage = p.coverage ?? 0.5;
    const soft = p.softness ?? 0.25;
    const warp = p.warp ?? 0.8;
    const oct = p.octaves ?? 6;
    const c = [0, 0, 0];
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const u = ((x + 0.5) / s.w) * px;
        const v = ((y + 0.5) / s.h) * py;
        const wx = fbm(u + 5.2, v + 1.3, px, py, seed + 7, 4) * warp;
        const wy = fbm(u + 1.7, v + 9.2, px, py, seed + 11, 4) * warp;
        const n = fbm(u + wx, v + wy, px, py, seed, oct) * 0.5 + 0.5;
        const t = 1 - coverage;
        const alpha = smoothstep(t - soft, t + soft, n);
        if (alpha <= 0) continue;
        const mixT = clamp01(fbm(u * 3 + wy, v * 3 + wx, px * 3, py * 3, seed + 3, 3) * 0.8 + 0.5);
        c[0] = cA[0] + (cB[0] - cA[0]) * mixT;
        c[1] = cA[1] + (cB[1] - cA[1]) * mixT;
        c[2] = cA[2] + (cB[2] - cA[2]) * mixT;
        const i = y * s.w + x;
        s.r[i] = c[0];
        s.g[i] = c[1];
        s.b[i] = c[2];
        s.a[i] = alpha;
      }
    }
  },

  /** Soil aggregates: Worley cells turned into lumpy domes, gathered into patches by fBm. */
  clumps(s, p, rand, seed) {
    const size = p.size ?? 14;
    const px = period(s.w, size);
    const py = period(s.h, size);
    const patch = p.patchScale ?? 160;
    const qx = period(s.w, patch);
    const qy = period(s.h, patch);
    const coverage = p.coverage ?? 0.55;
    const cols = palette(p.colors ?? ['#3b2a1d', '#5a3f2a', '#6e5238', '#2b1f16', '#7d6246']);
    const H = s.heightField();
    const cell = { f1: 0, f2: 0, id: 0 };
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const u = (x + 0.5) / s.w;
        const v = (y + 0.5) / s.h;
        const m = fbm(u * qx, v * qy, qx, qy, seed + 5, 4) * 0.5 + 0.5;
        const mask = smoothstep(1 - coverage - 0.04, 1 - coverage + 0.04, m);
        if (mask <= 0) continue;
        const rx = fbm(u * px * 2, v * py * 2, px * 2, py * 2, seed + 9, 3) * 0.3;
        const ry = fbm(u * px * 2 + 4.3, v * py * 2 + 1.9, px * 2, py * 2, seed + 13, 3) * 0.3;
        worley(u * px + rx, v * py + ry, px, py, seed, 1, cell);
        // Radii past 0.5 let neighbouring lumps merge into irregular aggregates.
        const radius = 0.35 + ((cell.id >>> 8) & 255) / 255 * 0.45;
        const hgt = smoothstep(radius, radius * 0.15, cell.f1) * mask;
        if (hgt <= 0) continue;
        const i = y * s.w + x;
        const c = cols[cell.id % cols.length];
        s.r[i] = c[0];
        s.g[i] = c[1];
        s.b[i] = c[2];
        s.a[i] = smoothstep(0.02, 0.2, hgt);
        H[i] = hgt;
      }
    }
  },

  /** Dried-mud cracks from the gap between Worley F1 and F2, in two generations. */
  cracks(s, p, rand, seed) {
    const size = p.size ?? 90;
    const width = p.width ?? 2.2;
    const coverage = p.coverage ?? 0.8;
    const col = parseColor(p.color ?? '#1d140d');
    const H = s.heightField();
    const cell = { f1: 0, f2: 0, id: 0 };
    const gens = [
      { sz: size, w: width, sd: seed },
      { sz: size / 2.3, w: width * 0.55, sd: seed + 17 },
    ];
    const mx = period(s.w, size * 2.5);
    const my = period(s.h, size * 2.5);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const u = (x + 0.5) / s.w;
        const v = (y + 0.5) / s.h;
        const m = fbm(u * mx, v * my, mx, my, seed + 3, 4) * 0.5 + 0.5;
        const mask = smoothstep(1 - coverage - 0.1, 1 - coverage + 0.1, m);
        if (mask <= 0) continue;
        let line = 0;
        let plate = 1;
        for (const g of gens) {
          const px = period(s.w, g.sz);
          const py = period(s.h, g.sz);
          const wx = fbm(u * px * 2, v * py * 2, px * 2, py * 2, g.sd + 1, 3) * 0.15;
          const wy = fbm(u * px * 2 + 3.1, v * py * 2 + 7.7, px * 2, py * 2, g.sd + 5, 3) * 0.15;
          worley(u * px + wx, v * py + wy, px, py, g.sd, 1, cell);
          const edgePx = ((cell.f2 - cell.f1) / 2) * g.sz;
          const w = g.w * (0.35 + 0.9 * (fbm(u * px, v * py, px, py, g.sd + 2, 2) * 0.5 + 0.5));
          line = Math.max(line, smoothstep(w + 1, w * 0.3, edgePx));
          plate = Math.min(plate, smoothstep(0, g.sz * 0.25, edgePx));
        }
        const i = y * s.w + x;
        s.r[i] = col[0];
        s.g[i] = col[1];
        s.b[i] = col[2];
        s.a[i] = line * mask;
        // Plates curl up at their edges; the crack floor sits low.
        H[i] = (1 - line) * (0.4 + 0.6 * (1 - plate)) * mask;
      }
    }
  },

  /** Grit: irregular specks with a power-law size spread — many crumbs, a few pebbles. */
  grit(s, p, rand) {
    const count = Math.round((p.density ?? 6) * (s.w * s.h) / 10000);
    const rMin = p.minSize ?? 0.5;
    const rMax = p.maxSize ?? 5;
    const bias = p.bias ?? 3;
    const cols = palette(p.colors ?? ['#2b1f16', '#3f2e20', '#5b4431', '#8b7358', '#c2ae92']);
    const H = s.heightField();
    for (let n = 0; n < count; n++) {
      const cx = rand() * s.w;
      const cy = rand() * s.h;
      const r = rMin * Math.pow(rMax / rMin, Math.pow(rand(), bias));
      const c = pick(rand, cols);
      const alpha = 0.55 + rand() * 0.45;
      const h1 = rand() * 0.35;
      const h2 = rand() * 0.2;
      const p1 = rand() * 6.28;
      const p2 = rand() * 6.28;
      const ext = Math.ceil(r * 1.6 + 1);
      for (let y = Math.floor(cy - ext); y <= Math.ceil(cy + ext); y++) {
        for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          const th = Math.atan2(dy, dx);
          const rr = r * (1 + h1 * Math.sin(2 * th + p1) + h2 * Math.sin(3 * th + p2));
          const cov = clamp01(rr + 0.5 - d);
          if (cov <= 0) continue;
          const i = s.index(x, y);
          if (i < 0) continue;
          s.over(i, c, cov * alpha);
          const dome = Math.sqrt(Math.max(0, 1 - (d / rr) * (d / rr))) * Math.min(1, r / 3);
          if (dome > H[i]) H[i] = dome;
        }
      }
    }
  },

  /** Water/coffee stains: noisy rings with a dark coffee-ring rim and faint tide lines. */
  stains(s, p, rand, seed) {
    const count = Math.max(1, Math.round((p.count ?? 1) * (s.w * s.h) / (512 * 512)));
    const rMin = p.minSize ?? 40;
    const rMax = p.maxSize ?? 160;
    const cols = palette(p.colors ?? ['#6b4a2b', '#5a4632', '#4a3a2c']);
    const rim = p.rim ?? 0.8;
    const fill = p.fill ?? 0.18;
    const tides = p.tides ?? 2;
    for (let n = 0; n < count; n++) {
      const cx = rand() * s.w;
      const cy = rand() * s.h;
      const R = rMin + (rMax - rMin) * rand();
      const c = pick(rand, cols);
      const irr = 0.08 + rand() * 0.12;
      const sd = seed + n * 31;
      const rimW = Math.max(1.2, R * 0.025);
      const tideAt = Array.from({ length: tides }, () => 0.55 + rand() * 0.35);
      const ext = Math.ceil(R * (1 + irr * 2) + rimW * 3);
      for (let y = Math.floor(cy - ext); y <= Math.ceil(cy + ext); y++) {
        for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          const th = Math.atan2(dy, dx);
          // Noise sampled around a circle keeps the rim's wobble continuous.
          const wob = fbm(Math.cos(th) * 3 + 50, Math.sin(th) * 3 + 50, 256, 256, sd, 5);
          const rt = R * (1 + irr * wob);
          const sN = d / rt;
          if (sN > 1 + (rimW * 3) / rt) continue;
          let a = 0;
          if (sN < 1) a += fill * (0.5 + 0.5 * sN * sN);
          const e = ((sN - 1) * rt) / rimW;
          a += rim * Math.exp(-e * e) * (e < 0 ? 1 : 0.6);
          for (const ta of tideAt) {
            const et = ((sN - ta) * rt) / (rimW * 0.7);
            a += rim * 0.3 * Math.exp(-et * et);
          }
          const grain = 0.75 + 0.25 * perlin(x * 0.15, y * 0.15, 4096, 4096, sd + 1);
          const i = s.index(x, y);
          if (i >= 0) s.over(i, c, clamp01(a * grain));
        }
      }
    }
  },

  /** Greasy fingerprints: warped concentric ridges inside a ragged oval. */
  smudges(s, p, rand, seed) {
    const count = Math.max(1, Math.round((p.count ?? 1) * (s.w * s.h) / (512 * 512)));
    const size = p.size ?? 55;
    const spacing = p.spacing ?? 3.4;
    const cols = palette(p.colors ?? ['#6d6258', '#57493c']);
    for (let n = 0; n < count; n++) {
      const cx = rand() * s.w;
      const cy = rand() * s.h;
      const sx = size * (0.8 + rand() * 0.4);
      const sy = sx * (1.25 + rand() * 0.2);
      const rot = rand() * Math.PI * 2;
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      const c = pick(rand, cols);
      const pressure = 0.5 + rand() * 0.5;
      const sd = seed + n * 53;
      const ext = Math.ceil(sy * 1.2);
      for (let y = Math.floor(cy - ext); y <= Math.ceil(cy + ext); y++) {
        for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const lx = dx * cr + dy * sr;
          const ly = -dx * sr + dy * cr;
          const ex = lx / sx;
          const ey = ly / sy;
          const edge = fbm(ex * 2 + 9, ey * 2 + 9, 256, 256, sd, 3) * 0.25;
          const mask = smoothstep(1 + edge, 0.55 + edge, Math.sqrt(ex * ex + ey * ey));
          if (mask <= 0) continue;
          const warp = fbm(lx * 0.03, ly * 0.03, 256, 256, sd + 4, 3) * 6;
          const ring = Math.sqrt(lx * lx + (ly * 0.8 - sy * 0.15) ** 2) + warp;
          const ridge = Math.pow(0.5 + 0.5 * Math.cos((ring / spacing) * Math.PI * 2), 2);
          // Parts of a real print are skipped where the finger barely touched.
          const touch = smoothstep(-0.3, 0.3, fbm(lx * 0.04, ly * 0.04, 256, 256, sd + 8, 2) + pressure - 0.5);
          const i = s.index(x, y);
          if (i >= 0) s.over(i, c, ridge * mask * touch * 0.8);
        }
      }
    }
  },

  /** Hairline scratches: long, nearly straight random walks. */
  scratches(s, p, rand) {
    const count = Math.round((p.count ?? 14) * (s.w * s.h) / (512 * 512));
    const cols = palette(p.colors ?? ['#e9e2d6', '#2a211a']);
    const dir = p.direction;
    for (let n = 0; n < count; n++) {
      stroke(s, rand, {
        angle: dir == null ? undefined : dir + (rand() - 0.5) * (p.spread ?? 0.4),
        curl: p.curl ?? 0.02,
        length: p.length ?? 160,
        width: p.width ?? 0.9,
        color: pick(rand, cols),
        strength: 0.4 + rand() * 0.5,
        phase: rand() * 10,
      });
    }
  },

  /** Dust: sparse light specks, a thin haze and curly fibres. */
  dust(s, p, rand, seed) {
    const haze = p.haze ?? 0.18;
    const specks = p.specks ?? 0.004;
    const hazeCol = parseColor(p.color ?? '#d8d2c6');
    const hs = p.hazeScale ?? 220;
    const px = period(s.w, hs);
    const py = period(s.h, hs);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const u = ((x + 0.5) / s.w) * px;
        const v = ((y + 0.5) / s.h) * py;
        const i = y * s.w + x;
        const n = fbm(u, v, px, py, seed, 5) * 0.5 + 0.5;
        const a = haze * smoothstep(0.3, 0.8, n);
        if (a > 0) s.over(i, hazeCol, a);
        const hsh = hashFloat(x, y, seed + 99);
        if (hsh < specks * (0.5 + n)) s.over(i, hazeCol, 0.5 + hashFloat(x, y, seed + 7) * 0.5);
      }
    }
    const fibres = Math.round((p.fibres ?? 5) * (s.w * s.h) / (512 * 512));
    const fibreCols = palette(p.fibreColors ?? ['#5c5751', '#8a847b', '#3e3a36']);
    for (let n = 0; n < fibres; n++) {
      stroke(s, rand, {
        curl: p.curl ?? 0.5,
        length: p.fibreLength ?? 50,
        width: 0.8,
        color: pick(rand, fibreCols),
        strength: 0.5 + rand() * 0.4,
        phase: rand() * 10,
      });
    }
  },

  /** Mould: Gray-Scott reaction-diffusion grown only where a noise field feeds it. */
  mold(s, p, rand, seed) {
    const cellPx = p.cell ?? 2;
    const gw = Math.min(320, Math.max(16, Math.round(s.w / cellPx)));
    const gh = Math.min(320, Math.max(16, Math.round(s.h / cellPx)));
    const iters = p.iterations ?? 2400;
    const F = p.feed ?? 0.0545;
    const K = p.kill ?? 0.062;
    const coverage = p.coverage ?? 0.45;
    const cols = palette(p.colors ?? ['#4d5340', '#1d2118']);
    const N = gw * gh;
    let U = new Float32Array(N).fill(1);
    let V = new Float32Array(N);
    let U2 = new Float32Array(N);
    let V2 = new Float32Array(N);
    const feed = new Float32Array(N);
    const mp = p.patchScale ?? 200;
    const qx = period(s.w, mp);
    const qy = period(s.h, mp);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const m = fbm(((x + 0.5) / gw) * qx, ((y + 0.5) / gh) * qy, qx, qy, seed + 1, 4) * 0.5 + 0.5;
        const mask = smoothstep(1 - coverage - 0.08, 1 - coverage + 0.08, m);
        feed[y * gw + x] = F * mask;
      }
    }
    // Spores: small square seeds (single cells die out before the reaction takes hold).
    const spores = Math.round(gw * gh * (p.spores ?? 0.02));
    for (let n = 0; n < spores; n++) {
      const sx = Math.floor(rand() * gw);
      const sy = Math.floor(rand() * gh);
      if (feed[sy * gw + sx] < F * 0.5) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const i = mod(sy + dy, gh) * gw + mod(sx + dx, gw);
          U[i] = 0.5;
          V[i] = 0.25;
        }
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let y = 0; y < gh; y++) {
        const yu = ((y - 1 + gh) % gh) * gw;
        const yd = ((y + 1) % gh) * gw;
        const yc = y * gw;
        for (let x = 0; x < gw; x++) {
          const xl = (x - 1 + gw) % gw;
          const xr = (x + 1) % gw;
          const i = yc + x;
          const u = U[i];
          const v = V[i];
          const lu = U[yc + xl] + U[yc + xr] + U[yu + x] + U[yd + x] - 4 * u;
          const lv = V[yc + xl] + V[yc + xr] + V[yu + x] + V[yd + x] - 4 * v;
          const uvv = u * v * v;
          const f = feed[i];
          U2[i] = u + 0.2 * lu - uvv + f * (1 - u);
          V2[i] = v + 0.1 * lv + uvv - (f + K) * v;
        }
      }
      [U, U2] = [U2, U];
      [V, V2] = [V2, V];
    }
    // Bilinear, wrapping upsample of V onto the pixel grid.
    const H = s.heightField();
    for (let y = 0; y < s.h; y++) {
      const gy = ((y + 0.5) / s.h) * gh - 0.5;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const r0 = mod(y0, gh) * gw;
      const r1 = mod(y0 + 1, gh) * gw;
      for (let x = 0; x < s.w; x++) {
        const gx = ((x + 0.5) / s.w) * gw - 0.5;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const c0 = mod(x0, gw);
        const c1 = mod(x0 + 1, gw);
        const top = V[r0 + c0] + (V[r0 + c1] - V[r0 + c0]) * fx;
        const bot = V[r1 + c0] + (V[r1 + c1] - V[r1 + c0]) * fx;
        const v = top + (bot - top) * fy;
        // Dense colony plus a faint fuzzy fringe where the reactant has only just diffused.
        const a = Math.max(smoothstep(0.12, 0.3, v), 0.3 * smoothstep(0.01, 0.12, v));
        if (a <= 0) continue;
        const i = y * s.w + x;
        const t = clamp01((v - 0.1) * 3);
        s.r[i] = cols[0][0] + (cols[1][0] - cols[0][0]) * t;
        s.g[i] = cols[0][1] + (cols[1][1] - cols[0][1]) * t;
        s.b[i] = cols[0][2] + (cols[1][2] - cols[0][2]) * t;
        s.a[i] = a;
        H[i] = v;
      }
    }
  },

  /** Grime that collects along edges and in corners. Needs tile: false (a framed image). */
  edges(s, p, rand, seed) {
    if (s.tile) return;
    const spread = p.spread ?? 60;
    const col = parseColor(p.color ?? '#231911');
    const px = period(s.w, 90);
    const py = period(s.h, 90);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const dx = Math.min(x, s.w - 1 - x);
        const dy = Math.min(y, s.h - 1 - y);
        const e = Math.exp(-dx / spread) + Math.exp(-dy / spread);
        const n = fbm(((x + 0.5) / s.w) * px, ((y + 0.5) / s.h) * py, px, py, seed, 5) * 0.5 + 0.5;
        const i = y * s.w + x;
        s.r[i] = col[0];
        s.g[i] = col[1];
        s.b[i] = col[2];
        s.a[i] = clamp01(e * (0.2 + n * 1.2) - 0.1);
      }
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Compositing
// ---------------------------------------------------------------------------------------------

function hardLight(b, s) {
  return s <= 0.5 ? b * 2 * s : 1 - (1 - b) * (1 - (2 * s - 1));
}

function softLight(b, s) {
  if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
}

const BLEND = {
  normal: (b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => hardLight(s, b),
  'hard-light': hardLight,
  'soft-light': softLight,
  darken: Math.min,
  lighten: Math.max,
};

export const BLEND_MODES = Object.keys(BLEND);

/** W3C separable compositing of a layer surface onto a straight-alpha accumulator. */
function composite(acc, s, mode, opacity) {
  const fn = BLEND[mode] || BLEND.normal;
  const n = s.w * s.h;
  for (let i = 0; i < n; i++) {
    const as = s.a[i] * opacity;
    if (as <= 0) continue;
    const j = i * 4;
    const ab = acc[j + 3];
    const ao = as + ab * (1 - as);
    const cs = [s.r[i], s.g[i], s.b[i]];
    for (let k = 0; k < 3; k++) {
      const cb = acc[j + k];
      const mixed = (1 - ab) * cs[k] + ab * fn(cb, cs[k]);
      acc[j + k] = (as * mixed + ab * cb * (1 - as)) / ao;
    }
    acc[j + 3] = ao;
  }
}

/**
 * Render a dirt image.
 *
 * @param {object}  o
 * @param {number}  o.width, o.height  Output size in pixels.
 * @param {number}  [o.seed=1]         Same seed + settings → same dirt.
 * @param {boolean} [o.tile=true]      Seamless wrap-around (the `edges` layer needs false).
 * @param {string}  [o.base]           Optional opaque backdrop colour; otherwise transparent.
 * @param {number}  [o.amount=1]       Master "how dirty" multiplier on every layer's opacity.
 * @param {number}  [o.grain=0.03]     Per-pixel luminance jitter to break up banding.
 * @param {Array}   o.layers           [{ type, blend, opacity, relief, enabled, ...params }]
 * @param {function} [o.onLayer]       Called as (index, layer) before each layer renders.
 * @returns {{width:number, height:number, data:Uint8ClampedArray}}
 */
export function generateDirt(o) {
  const w = Math.max(1, Math.round(o.width));
  const h = Math.max(1, Math.round(o.height));
  const seed = (o.seed ?? 1) >>> 0;
  const tile = o.tile ?? true;
  const amount = o.amount ?? 1;
  const acc = new Float32Array(w * h * 4);
  if (o.base) {
    const c = parseColor(o.base);
    for (let i = 0; i < w * h; i++) {
      acc[i * 4] = c[0];
      acc[i * 4 + 1] = c[1];
      acc[i * 4 + 2] = c[2];
      acc[i * 4 + 3] = 1;
    }
  }

  (o.layers || []).forEach((layer, idx) => {
    if (layer.enabled === false) return;
    const fn = LAYERS[layer.type];
    if (!fn) throw new Error(`Unknown dirt layer type: ${layer.type}`);
    o.onLayer?.(idx, layer);
    const layerSeed = hash3(seed, idx, 0x5eed) & 0x7fffffff;
    const s = new Surface(w, h, tile);
    fn(s, layer, rng(layerSeed), layerSeed);
    applyRelief(s, layer.relief ?? 0, layer.bump ?? 6);
    composite(acc, s, layer.blend ?? 'normal', clamp01((layer.opacity ?? 1) * amount));
  });

  const grain = o.grain ?? 0.03;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    const g = grain ? (hashFloat(i % w, (i / w) | 0, seed + 4242) - 0.5) * 2 * grain : 0;
    out[j] = (acc[j] + g) * 255 + 0.5;
    out[j + 1] = (acc[j + 1] + g) * 255 + 0.5;
    out[j + 2] = (acc[j + 2] + g) * 255 + 0.5;
    out[j + 3] = acc[j + 3] * 255 + 0.5;
  }
  return { width: w, height: h, data: out };
}

// ---------------------------------------------------------------------------------------------
// Presets — starting points; every number can be changed.
// ---------------------------------------------------------------------------------------------

export const PRESETS = {
  'potting-soil': {
    description: 'Dark, crumbly earth: a warped wash, lit clumps and plenty of grit.',
    layers: [
      { type: 'wash', blend: 'normal', opacity: 0.95, scale: 220, coverage: 0.95, softness: 0.25, warp: 1.2, colors: ['#4b3526', '#241810'], relief: 0.4 },
      { type: 'clumps', blend: 'normal', opacity: 1, size: 16, coverage: 0.6, relief: 1, bump: 5 },
      { type: 'grit', blend: 'normal', opacity: 1, density: 14, minSize: 0.5, maxSize: 4, relief: 1 },
      { type: 'dust', blend: 'screen', opacity: 0.25, haze: 0.05, specks: 0.006, fibres: 2 },
    ],
  },
  'dried-mud': {
    description: 'Cracked ochre mud with curling plates and loose crumbs.',
    layers: [
      { type: 'wash', blend: 'normal', opacity: 0.85, scale: 260, coverage: 0.85, softness: 0.3, warp: 0.6, colors: ['#8a6b47', '#6b5035'], relief: 0.5 },
      { type: 'cracks', blend: 'multiply', opacity: 1, size: 110, width: 2.4, coverage: 0.85, relief: 1.2, bump: 3 },
      { type: 'grit', blend: 'normal', opacity: 0.8, density: 3, maxSize: 3, colors: ['#a0825d', '#6e5238', '#c9b28c'], relief: 1 },
    ],
  },
  'gallery-dust': {
    description: 'A light film for glass or glossy prints: haze, specks, fibres, prints, hairlines.',
    layers: [
      { type: 'dust', blend: 'screen', opacity: 0.9, haze: 0.22, specks: 0.01, fibres: 6 },
      { type: 'smudges', blend: 'multiply', opacity: 0.3, count: 1, size: 50 },
      { type: 'scratches', blend: 'screen', opacity: 0.5, count: 8, length: 220, colors: ['#f2ede4'] },
      { type: 'grit', blend: 'normal', opacity: 0.7, density: 0.6, maxSize: 2, colors: ['#3b342d', '#6d655c'] },
    ],
  },
  'cellar-grime': {
    description: 'Damp neglect: dark wash, water stains, mould blooms and edge build-up. Framed, not tiled.',
    tile: false,
    layers: [
      { type: 'wash', blend: 'multiply', opacity: 0.8, scale: 300, coverage: 0.6, colors: ['#5b5140', '#2f2a20'] },
      { type: 'stains', blend: 'multiply', opacity: 0.9, count: 2, minSize: 50, maxSize: 200, colors: ['#6a5638', '#5a5040'] },
      { type: 'mold', blend: 'normal', opacity: 0.85, coverage: 0.4, relief: 0.8, bump: 4 },
      { type: 'edges', blend: 'multiply', opacity: 0.9, spread: 70 },
      { type: 'grit', blend: 'normal', opacity: 0.8, density: 2, maxSize: 3, relief: 1 },
    ],
  },
  'coffee-table': {
    description: 'Mug rings, greasy prints and crumbs on a used surface.',
    layers: [
      { type: 'stains', blend: 'multiply', opacity: 1, count: 3, minSize: 45, maxSize: 90, rim: 0.9, fill: 0.12 },
      { type: 'smudges', blend: 'multiply', opacity: 0.5, count: 2, size: 45 },
      { type: 'grit', blend: 'normal', opacity: 0.9, density: 1.2, maxSize: 3.5, colors: ['#c49a64', '#8a5f35', '#e0c9a0'], relief: 1 },
      { type: 'scratches', blend: 'multiply', opacity: 0.25, count: 10, colors: ['#5a4a3a'] },
    ],
  },
  'everything': {
    description: 'Every generator stacked at once — the full mash.',
    layers: [
      { type: 'wash', blend: 'normal', opacity: 0.6, scale: 240, coverage: 0.55, colors: ['#5a4330', '#2a1d14'], relief: 0.4 },
      { type: 'cracks', blend: 'multiply', opacity: 0.7, size: 120, coverage: 0.45, relief: 1, bump: 3 },
      { type: 'clumps', blend: 'normal', opacity: 1, size: 14, coverage: 0.3, relief: 1, bump: 5 },
      { type: 'mold', blend: 'normal', opacity: 0.7, coverage: 0.3, relief: 0.8, bump: 4 },
      { type: 'stains', blend: 'multiply', opacity: 0.8, count: 1.5 },
      { type: 'smudges', blend: 'multiply', opacity: 0.35, count: 1 },
      { type: 'grit', blend: 'normal', opacity: 1, density: 5, maxSize: 4, relief: 1 },
      { type: 'scratches', blend: 'screen', opacity: 0.4, count: 8 },
      { type: 'dust', blend: 'screen', opacity: 0.5, haze: 0.12, fibres: 4 },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Browser helpers (no-ops in Node)
// ---------------------------------------------------------------------------------------------

/** Render into a <canvas>, resizing it to the requested size. */
export function renderToCanvas(canvas, options) {
  const img = generateDirt(options);
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return canvas;
}

/**
 * Lay a repeating dirt tile over an element without touching its content: adds an
 * absolutely-positioned, click-through <div> whose background is the rendered tile.
 * Returns a function that removes it again.
 */
export function dirtOverlay(element, options = {}) {
  const preset = PRESETS[options.preset] || {};
  const opts = { tile: true, width: 512, height: 512, ...preset, ...options };
  const canvas = renderToCanvas(document.createElement('canvas'), opts);
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    backgroundImage: `url(${canvas.toDataURL('image/png')})`,
    backgroundRepeat: opts.tile ? 'repeat' : 'no-repeat',
    backgroundSize: opts.tile ? `${opts.width / (opts.pixelRatio || 1)}px` : '100% 100%',
    mixBlendMode: opts.blend || 'normal',
    opacity: String(opts.opacity ?? 1),
  });
  if (getComputedStyle(element).position === 'static') element.style.position = 'relative';
  element.appendChild(layer);
  return () => layer.remove();
}

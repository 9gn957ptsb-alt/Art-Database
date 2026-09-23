#!/usr/bin/env python3
"""Build DIRT: an infinite plane of collection soil to swipe through, under a rainforest.

soil_tiles.py writes the plane's ingredients: corner, join and middle soils made from the saved
paintings, and the fields that shape each tile's zones. This page carries them, and worker threads
assemble tiles from them wherever the viewer goes. Every join on the plane takes its colour from its
own position, so any tile can be built anywhere and its edges always meet its neighbours'. The plane
has no edge and no start.

Calm ground lies in islands, one to each 1,597-cell square of the plane, each with a reach of its own.
Between them, the farther a place is from the nearest island, the more digital processes take hold
of it. Every threshold and amount is a power of the golden ratio or a Fibonacci number:

  from the start   more of each straddling object's shards sink back into the dirt (phi^-3 to phi^-1)
  phi^-3           the colours turn, by up to the golden angle
  phi^-2 onward    the dots fuse into pixel blocks of 2, 3, 5 and then 8 cells
  phi^-2 + phi^-4  rows tear sideways, like torn scanlines
  phi^-1           columns pixel-sort by lightness into drips
  phi^-1/2         the ground folds into a five-fold kaleidoscope about its island

Out from the islands the ground also falls into passages about 233 cells across, as an abstract painting
falls into passages, so that any window onto the plane holds a few: big shapes of light and dark, each
passage in the palette of one painting (its three colours laid over the ground's lights and darks), and
each of one character: a bright mosaic of fused blocks, a nocturne sunk nearly to black with its
brightest dots shining out, an airbrushed spray, a fine weave, or pixel-sorted drips. Their edges wander,
and where two meet, each cell belongs to one or the other by chance: an overspray.

Where the browser has WebGL2 the page paints the ground on the GPU (engine/ground-gl.js) from what each cell is
made of, and each passage's colours change as they are watched, about every 55 seconds: its painting's colours
turned by the golden angle and laid on fully, another painting's, two colours, lights and darks swapped, or as
grown. Each change sweeps across its passage in shapes of its character that build up and break down.

A rainforest stands over the ground. Crowns of three heights (shrubs, the canopy, and emergents above
it) grow on lattices of their own, the calm islands are clearings, and the forest closes in and rises
toward the outskirts. It lights the ground from the upper left, with shadows and dark gaps between
crowns; each crown leans toward a colour of its own; and dots fuse into blocks only as far as the forest
stands tall, so the nearer the eye, the coarser the pixel. Life keeps to its niche and is seen only
where nothing taller stands over it:

  the floor        leaf-cutter ants carrying painting pieces home, poison frogs, ferns unrolling from
                   fiddleheads, and far out, slime mould pouring from the brightest dots in soft,
                   luminous forms, like sprayed paint
  the understory   coral snakes ringed in a painting's colours, fireflies that fall into flashing as
                   one, blue morphos
  the crowns       flowers opening florets by the golden angle, hummingbirds darting between them,
                   monkey troops leaping crown to crown, wind turning the leaves pale in passing bands
  above            flocks of data pigment, loose dots from the canopy flying as kin, wheeling in the
                   eddies of a slow current, with three unseen hawks; macaw pairs crossing between
                   emergents; a harpy eagle seen only as its shadow

Every creature wears a painting's colours, turned as the ground where it lives is turned. Everything in
the ground is a function of position, so no seams show and going back finds the same ground and the
same homes. Swiping, a trackpad or the arrow keys move through it, and a swipe glides on after the hand
lets go. Pointing names the saved painting underneath, or the one a creature wears; clicking or tapping
picks it out by darkening everything else, and clicking it again, Escape or "Show all" brings the whole
plane back. The page embeds the cutouts, so it is written to dirt/private/ and never committed.

    python3 dirt/build_soil_viewer.py [--private dirt/private]
"""

import argparse
import base64
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

PAGE = r"""<meta charset="utf-8">
<title>DIRT</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@1,6..72,400&display=swap">
<style>
  :root {
    color-scheme: dark;
    --ground: __GROUND__;
    --line: #3a2a1d;
    --ink: #eadfcd;
    --muted: #a8927a;
    --serif: "Newsreader", Georgia, "Times New Roman", serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    background: var(--ground); color: var(--ink); font: 12px/1.5 var(--mono); margin: 0; padding: 16px;
    display: flex; flex-direction: column; gap: 13px;
  }
  .bar { flex: none; display: flex; gap: 21px; align-items: baseline; min-height: 34px; }
  button {
    font: inherit; color: var(--ink); background: transparent; border: 1px solid var(--line);
    padding: 5px 13px; cursor: pointer; letter-spacing: 0.06em; text-transform: uppercase; font-size: 11px;
  }
  button:hover { border-color: var(--muted); }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .art { display: flex; gap: 13px; align-items: baseline; min-width: 0; flex: 1; white-space: nowrap; }
  .title { font: italic 400 19px/1.2 var(--serif); overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .who { color: var(--muted); }
  a { color: var(--ink); text-underline-offset: 3px; }
  .stage { flex: 1; min-height: 0; position: relative; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
  canvas.dragging { cursor: grabbing; }
</style>

<div class="bar">
  <button id="show-all" hidden>Show all</button>
  <div class="art" aria-live="polite">
    <span class="title" id="c-title"></span>
    <span class="who" id="c-who"></span>
    <span id="c-link"></span>
  </div>
</div>
<div class="stage" id="stage">
  <canvas id="field" aria-label="An endless plane of soil made from saved paintings: swipe, scroll or use the arrow keys to move through it; point at it to name the painting underneath, and click or tap a painting to pick it out"></canvas>
</div>

<script id="common">
// ---- shared by the page and the worker that grows the ground -----------------------------------

const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = (2 * Math.PI) / (PHI * PHI);          // 137.5 degrees
const N = 256;                                              // cells a tile
const ISLE = 1597, ISLE_R = 610;                            // calm islands: one a 1597-cell square, reaching about 610 cells
const SEG = 21;                                             // drips are sorted within 21-cell segments

function mix(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}
/** A hash of a lattice position: the plane decides everything by where it is. */
function h3(x, y, s) { return mix(Math.imul(x | 0, 0x27d4eb2d) ^ mix((Math.imul(y | 0, 0x165667b1) + (s | 0)) | 0)); }
const u3 = (x, y, s) => h3(x, y, s) / 4294967296;
const unitOf = (h) => mix(h >>> 0) / 4294967296;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

/** Smooth value noise over the plane, lattice spacing g cells, in [0, 1]. */
function vnoise(x, y, g, s) {
  const fx = x / g, fy = y / g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = u3(x0, y0, s), b = u3(x0 + 1, y0, s), c = u3(x0, y0 + 1, s), d = u3(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

// Calm islands: one in each 1597-cell square, placed within the square's middle 1/phi, each with a
// reach of 610 cells times phi^(-1/2 .. 1/2) and a turn of its own for its kaleidoscope.
const isleCache = new Map();
function isle(i, j) {
  const k = (i + 32768) * 65536 + (j + 32768);
  let c = isleCache.get(k);
  if (!c) {
    c = { x: (i + 0.5 + (u3(i, j, 41) - 0.5) / PHI) * ISLE, y: (j + 0.5 + (u3(i, j, 43) - 0.5) / PHI) * ISLE,
          r: ISLE_R * PHI ** (u3(i, j, 47) - 0.5), th: u3(i, j, 53) * 2 * Math.PI };
    isleCache.set(k, c);
  }
  return c;
}
let NEAR_D = 0, nineI = NaN, nineJ = NaN;
const nine = new Array(9);
/** The island nearest (x, y) in reaches, among the 3 by 3 squares around it. Sets NEAR_D. */
function nearIsle(x, y) {
  const i0 = Math.floor(x / ISLE), j0 = Math.floor(y / ISLE);
  if (i0 !== nineI || j0 !== nineJ) {
    let n = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) nine[n++] = isle(i, j);
    nineI = i0; nineJ = j0;
  }
  let best = nine[0], bd = Infinity;
  for (let n = 0; n < 9; n++) {
    const c = nine[n], d = Math.hypot(x - c.x, y - c.y) / c.r;
    if (d < bd) { bd = d; best = c; }
  }
  NEAR_D = bd;
  return best;
}
/** How far out a cell is: 0 on an island's calm ground, 1 out where everything happens. */
function depth(x, y) {
  nearIsle(x, y);
  return Math.min(1, Math.max(0, NEAR_D + (vnoise(x, y, 34, 1) - 0.5) * 2 * PHI ** -3));
}

/** How far the colours turn at (x, y), at depth d: by up to the golden angle, either way. */
const turnAt = (x, y, d) => smooth(PHI ** -3, 1, d) * (vnoise(x, y, 21, 3) * 2 - 1) * GOLDEN_ANGLE;
/** A colour turned about the grey axis by t radians. */
function turnRGB(r, g, b, t, out = [0, 0, 0]) {
  if (Math.abs(t) < 0.01) { out[0] = r; out[1] = g; out[2] = b; return out; }
  const c = Math.cos(t), s = Math.sin(t), k = (1 - c) / 3, q = Math.sqrt(1 / 3) * s, cl = (v) => Math.max(0, Math.min(255, v));
  out[0] = cl(r * (c + k) + g * (k - q) + b * (k + q)); out[1] = cl(r * (k + q) + g * (c + k) + b * (k - q)); out[2] = cl(r * (k - q) + g * (k + q) + b * (c + k));
  return out;
}

// ---- the forest ---------------------------------------------------------------------------------
// Crowns of three heights stand over the plane: shrubs and understory trees, the canopy, and the
// emergents standing clear above it. Heights run from 0, the forest floor, to 1, the top of the
// tallest emergent. Each stratum is a jittered lattice of round crowns; a crown grows or not by its
// square's hash and the depth at its middle, so the calm islands are clearings, and the forest closes
// over and rises toward the outskirts.
const FLOOR = 0, SHRUB = 1, CANOPY = 2, EMERGENT = 3, TALL = 34;    // strata; cells tall at height 1
const STRATA = [
  { g: 21, r: 13, lo: PHI ** -3, hi: PHI ** -2, salt: 200, odds: (d) => PHI ** -1 * smooth(0, PHI ** -2, d) },
  { g: 55, r: 34, lo: PHI ** -1 - PHI ** -4, hi: PHI ** -1 + PHI ** -4, salt: 210, odds: (d) => (1 - PHI ** -3) * smooth(PHI ** -3, 1, d) },
  { g: 233, r: 55, lo: 1 - PHI ** -4, hi: 1, salt: 220, odds: (d) => PHI ** -1 * smooth(PHI ** -2, 1, d) },
];
const crownCache = STRATA.map(() => new Map());
/** The crown of stratum L (0 shrubs, 1 canopy, 2 emergents) in lattice square (i, j), or null. */
function crownOf(L, i, j) {
  const m = crownCache[L], k = (i + 32768) * 65536 + (j + 32768);
  let c = m.get(k);
  if (c === undefined) {
    const S = STRATA[L], x = (i + u3(i, j, S.salt)) * S.g, y = (j + u3(i, j, S.salt + 1)) * S.g;
    c = u3(i, j, S.salt + 2) < S.odds(depth(x, y))
      ? { x, y, r: S.r * PHI ** (u3(i, j, S.salt + 3) - 0.5), top: S.lo + (S.hi - S.lo) * u3(i, j, S.salt + 4), L: L + 1,
          c5: Math.cos(u3(i, j, S.salt + 5) * 2 * Math.PI), s5: Math.sin(u3(i, j, S.salt + 5) * 2 * Math.PI),
          c8: Math.cos(u3(i, j, S.salt + 6) * 2 * Math.PI), s8: Math.sin(u3(i, j, S.salt + 6) * 2 * Math.PI) }
      : null;
    if (m.size >= 28657) m.clear();
    m.set(k, c);
  }
  return c;
}
/**
 * A crown's height at (x, y): a low dome whose rim stands at 1/phi of its top, 0 off the crown. Its
 * outline swells in five lobes and eight smaller ones, as a crown of leaves seen from above does.
 */
function crownHeight(c, x, y) {
  const dx = x - c.x, dy = y - c.y, d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r * (1 + PHI ** -3) ** 2) return 0;
  // sin(5a + p) and sin(8a + q) for the direction a, from powers of the unit vector (cos a, sin a).
  const d = Math.sqrt(d2) || 1, ca = dx / d, sa = dy / d;
  const r2 = ca * ca - sa * sa, i2 = 2 * ca * sa, r4 = r2 * r2 - i2 * i2, i4 = 2 * r2 * i2;
  const r5 = r4 * ca - i4 * sa, i5 = r4 * sa + i4 * ca, r8 = r4 * r4 - i4 * i4, i8 = 2 * r4 * i4;
  const r = c.r * (1 + PHI ** -4 * (i5 * c.c5 + r5 * c.s5) + PHI ** -5 * (i8 * c.c8 + r8 * c.s8)), t = d2 / (r * r);
  return t < 1 ? c.top * (1 - PHI ** -2 * t) : 0;
}
let CANOPY_L = FLOOR;
/** How high the forest stands at (x, y). Sets CANOPY_L to the stratum on top there. */
function canopyAt(x, y) {
  let h = 0;
  CANOPY_L = FLOOR;
  for (let L = 0; L < STRATA.length; L++) {
    const g = STRATA[L].g, i0 = Math.floor(x / g), j0 = Math.floor(y / g);
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) {
      const c = crownOf(L, i, j);
      if (!c) continue;
      const v = crownHeight(c, x, y);
      if (v > h) { h = v; CANOPY_L = c.L; }
    }
  }
  return h;
}
/** The crowns of stratum L whose middles lie within rad of (x, y). */
function crownsNear(L, x, y, rad) {
  const g = STRATA[L].g, out = [];
  for (let j = Math.floor((y - rad) / g); j <= Math.floor((y + rad) / g); j++)
    for (let i = Math.floor((x - rad) / g); i <= Math.floor((x + rad) / g); i++) {
      const c = crownOf(L, i, j);
      if (c && Math.hypot(c.x - x, c.y - y) <= rad) out.push(c);
    }
  return out;
}
</script>
<script id="earth-common">__EARTH_COMMON__</script>

<script id="worker-src" type="text/plain">
// ---- the worker: assembles tiles and grows processed ground, a tile-sized chunk at a time -------

let S = [], CORN = [], VERT = [], HORZ = [], MIDS = [], AF = [], BF = [], CN = null, TOKENS = [];
let K = 5, ZA = 13, ZD = 8, CZ = 21, CZW = 5, GROUND = [0, 0, 0], R = 2, KAPPA = 0;
const tileCache = new Map(), TILE_CAP = 55;
const key2 = (i, j) => (i + 32768) * 65536 + (j + 32768);
const sinkAt = (x, y) => PHI ** -3 + (PHI ** -1 - PHI ** -3) * depth(x, y);

/**
 * The tile at (ti, tj). Its four joins take their colours from their own positions, its middle soil
 * and mirroring from its position, and each corner soil from its grid point, so every neighbour
 * agrees with it along every edge. `from` records which soil each cell came from.
 */
function composeTile(ti, tj) {
  const west = h3(ti, tj, 101) % K, east = h3(ti + 1, tj, 101) % K;
  const north = h3(ti, tj, 103) % K, south = h3(ti, tj + 1, 103) % K;
  const mid = MIDS[h3(ti, tj, 107) % MIDS.length], mirror = h3(ti, tj, 109) & 1;
  const corner = (i, j) => CORN[h3(i, j, 113) % CORN.length];
  const cTL = corner(ti, tj), cTR = corner(ti + 1, tj), cBL = corner(ti, tj + 1), cBR = corner(ti + 1, tj + 1);
  const vW = VERT[west], vE = VERT[east], hN = HORZ[north], hS = HORZ[south];
  // Each join has a seed of its own, and a share of its object's shards sinks there, more the farther
  // out the join lies. Both tiles on a join work out the same seed and the same odds.
  const sW = h3(ti, tj, 127), sE = h3(ti + 1, tj, 127), sN = h3(ti, tj, 131), sS = h3(ti, tj + 1, 131);
  const pW = sinkAt(ti * N, tj * N + N / 2), pE = sinkAt((ti + 1) * N, tj * N + N / 2);
  const pN = sinkAt(ti * N + N / 2, tj * N), pS = sinkAt(ti * N + N / 2, (tj + 1) * N);
  const col = new Uint8Array(N * N * 3), size = new Uint8Array(N * N), work = new Uint16Array(N * N), from = new Uint8Array(N * N);
  const sunk = PHI ** -2, half = N / 2;
  for (let y = 0; y < N; y++) {
    const Y = Math.min(y, N - 1 - y), top = y < half;
    for (let x = 0; x < N; x++) {
      const X = Math.min(x, N - 1 - x), left = x < half, i = y * N + x;
      let sid, si = i, seed = 0, p = 0, axis = 0;
      const cz = CZ + CZW * CN[Y * N + X];
      if (X + 0.5 < cz && Y + 0.5 < cz) sid = left ? (top ? cTL : cBL) : (top ? cTR : cBR);
      else {
        const hs = top ? hN : hS, b = ZA + ZD * (2 * (top ? BF[north] : BF[south])[Y * N + x] - 1);
        if (Y + 0.5 < b || S[hs].zone[i]) { sid = hs; seed = top ? sN : sS; p = top ? pN : pS; axis = 2; }
        else {
          const vs = left ? vW : vE, a = ZA + ZD * (2 * (left ? AF[west] : AF[east])[y * N + X] - 1);
          if (X + 0.5 < a || S[vs].zone[i]) { sid = vs; seed = left ? sW : sE; p = left ? pW : pE; axis = 1; }
          else { sid = mid; if (mirror) si = y * N + (N - 1 - x); }
        }
      }
      const s = S[sid], lab = s.lab[si];
      const f = axis && s.axis[lab] === axis && unitOf(seed ^ s.hash[lab]) < p ? sunk : 1;
      col[i * 3] = s.col[si * 3] * f; col[i * 3 + 1] = s.col[si * 3 + 1] * f; col[i * 3 + 2] = s.col[si * 3 + 2] * f;
      size[i] = s.size[si]; work[i] = s.work[lab]; from[i] = sid;
    }
  }
  return { col, size, work, from };
}

function tileAt(ti, tj) {
  const k = key2(ti, tj);
  let t = tileCache.get(k);
  if (t) { tileCache.delete(k); tileCache.set(k, t); return t; }
  t = composeTile(ti, tj);
  tileCache.set(k, t);
  if (tileCache.size > TILE_CAP) tileCache.delete(tileCache.keys().next().value);
  return t;
}

let lastKey = NaN, lastTile = null, SI = 0;
function sampleAt(qx, qy) {
  const ti = Math.floor(qx / N), tj = Math.floor(qy / N), k = key2(ti, tj);
  if (k !== lastKey) { lastTile = tileAt(ti, tj); lastKey = k; }
  SI = (qy - tj * N) * N + (qx - ti * N);
  return lastTile;
}

const COARSEST = [1, 3, 5, 8];                       // the largest block each stratum fuses into
const blockOf = (d) => (d < PHI ** -2 ? 1 : d < PHI ** -2 + PHI ** -4 ? 2 : d < PHI ** -2 + 2 * PHI ** -4 ? 3 : d < PHI ** -2 + 3 * PHI ** -4 ? 5 : 8);

// ---- passages -----------------------------------------------------------------------------------
// Out from the calm islands the ground falls into passages about 233 cells across, as an abstract
// painting falls into passages. Each has a character of its own and the palette of one painting: the
// three colours of the painting at its middle, turned as the ground there is turned, laid over the
// ground's lights and darks as a gradient map. The passages' edges wander, and where two meet, each
// cell belongs to one or the other by chance, the likelier the nearer: an overspray, as where two
// sprayed colours meet.
const PASS = 233, OVERSPRAY = 55, WANDER = 55;
const MOSAIC = 0, NOCTURNE = 1, SPRAY = 2, WEAVE = 3, DRIP = 4;
// Their shares: mosaic phi^-2, nocturne phi^-3, spray and weave phi^-4 each, drip phi^-5. They sum to 1.
const KIND_UPTO = [PHI ** -2, PHI ** -1, PHI ** -1 + PHI ** -4, 1 - PHI ** -5, 1];
const KIND_CAP = [8, 2, 1, 1, 2];                    // the largest block each character lets dots fuse into
const KIND_KEY = [PHI ** 0.5, 1, PHI ** 0.5, 1, 1];  // how brightly each character is lit: mosaic and spray are high-keyed
const KIND_BIRDS = [1, PHI, 0, 0, PHI ** -1];        // how readily each character's canopy takes flight
const lumOf = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const passCache = new Map();
/** The passage of lattice square (i, j): its middle, its character, its painting and palette. */
function passage(i, j) {
  const k = key2(i, j);
  let p = passCache.get(k);
  if (!p) {
    const x = (i + u3(i, j, 501)) * PASS, y = (j + u3(i, j, 503)) * PASS, u = u3(i, j, 509);
    let kind = 0;
    while (u >= KIND_UPTO[kind]) kind++;
    const cx = Math.floor(x), cy = Math.floor(y), d = depth(cx, cy);
    sourceOf(cx, cy, d);
    const w = sampleAt(QX, QY).work[SI], turn = turnAt(cx, cy, d);
    // Its palette: the painting's colours, turned, and phi times as saturated.
    const pal = (TOKENS[w] || TOKENS[0]).map((c) => {
      const t = turnRGB(c[0], c[1], c[2], turn, [0, 0, 0]), l = lumOf(t);
      return t.map((v) => Math.max(0, Math.min(255, l + (v - l) * PHI)));
    }).sort((a, b) => lumOf(a) - lumOf(b));
    while (pal.length < 3) pal.push(pal[pal.length - 1]);
    // The gradient map's stops: its darkest colour sunk, its three colours, its lightest lifted.
    const stops = [pal[0].map((v) => v * PHI ** -2), pal[0], pal[1], pal[2], pal[2].map((v) => v + (255 - v) / PHI)];
    p = { x, y, kind, pal, stops, at: stops.map((c, n) => (n === 0 ? 0 : n === 4 ? 255 : lumOf(c))), w, i, j, turn };
    if (passCache.size >= 4181) passCache.clear();
    passCache.set(k, p);
  }
  return p;
}
/** The colour at lightness l in a passage's gradient map, into out. */
function mapped(p, l, out) {
  const at = p.at, st = p.stops;
  let n = 0;
  while (n < 3 && l > at[n + 1]) n++;
  const a = st[n], b = st[n + 1], t = Math.min(1, Math.max(0, (l - at[n]) / Math.max(1, at[n + 1] - at[n])));
  out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
/** How the passages' edges wander: up to 55 cells, smooth over 144. */
const wanderX = (x, y) => WANDER * (2 * vnoise(x, y, 144, 7) - 1), wanderY = (x, y) => WANDER * (2 * vnoise(x, y, 144, 11) - 1);
let PA = null, PB = null, PE = 0, pI = NaN, pJ = NaN;
const pNine = new Array(9);
/** The two passages nearest the wandered point (wx, wy). PE: how far into the nearer it lies, 1 from 55 cells in. */
function nearestPassages(wx, wy) {
  const i0 = Math.floor(wx / PASS), j0 = Math.floor(wy / PASS);
  if (i0 !== pI || j0 !== pJ) {
    let n = 0;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) pNine[n++] = passage(i, j);
    pI = i0; pJ = j0;
  }
  let d1 = Infinity, d2 = Infinity;
  for (let n = 0; n < 9; n++) {
    const p = pNine[n], d = (wx - p.x) ** 2 + (wy - p.y) ** 2;
    if (d < d1) { d2 = d1; PB = PA; d1 = d; PA = p; } else if (d < d2) { d2 = d; PB = p; }
  }
  PE = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / (2 * OVERSPRAY));
}

/** Torn rows: bands 5 rows tall and 233 cells long, a phi^-2 share of them pulled sideways. */
function tearAt(x, y) {
  const band = Math.floor(y / 5), span = Math.floor(x / 233);
  return u3(band, span, 19) < PHI ** -2 ? u3(band, span, 23) * 2 - 1 : 0;
}

let QX = 0, QY = 0;
/** Where the cell (x, y), at depth d, takes its soil from: folded about its island, and torn. */
function sourceOf(x, y, d) {
  let qx = x, qy = y;
  if (u3(x, y, 17) < smooth(PHI ** -0.5, 1, d)) {
    const c = nearIsle(x, y), vx = x - c.x, vy = y - c.y, rr = Math.hypot(vx, vy), wedge = (2 * Math.PI) / 5;
    let a = Math.atan2(vy, vx) - c.th;
    a = ((a % wedge) + wedge) % wedge;
    if (a > wedge / 2) a = wedge - a;
    qx = Math.round(c.x + rr * Math.cos(a + c.th)); qy = Math.round(c.y + rr * Math.sin(a + c.th));
  }
  QX = qx + Math.round(tearAt(qx, qy) * 13 * smooth(PHI ** -2 + PHI ** -4, 1, d));
  QY = qy;
}

// ---- the forest over the ground: its heights, and the light and shade they make -----------------

const FM = 34, FW = N + 2 * FM;                      // a margin for the shadows cast in from outside
const fh = new Float32Array(FW * FW), fl = new Uint8Array(FW * FW), fz = new Float32Array(FW * FW), fk = new Int32Array(FW * FW);
const fcs = [];                                      // the crowns over the chunk being grown; fk indexes them
const fa = new Float32Array(FW * FW), fb = new Float32Array(FW * FW);

/** A box blur of `src` into `dst`, `rad` cells each way, through `tmp`. */
function boxBlur(src, dst, tmp, rad) {
  const n = 2 * rad + 1;
  for (let y = 0; y < FW; y++) {
    let s = 0;
    for (let x = -rad; x <= rad; x++) s += src[y * FW + Math.min(FW - 1, Math.max(0, x))];
    for (let x = 0; x < FW; x++) {
      tmp[y * FW + x] = s / n;
      s += src[y * FW + Math.min(FW - 1, x + rad + 1)] - src[y * FW + Math.max(0, x - rad)];
    }
  }
  for (let x = 0; x < FW; x++) {
    let s = 0;
    for (let y = -rad; y <= rad; y++) s += tmp[Math.min(FW - 1, Math.max(0, y)) * FW + x];
    for (let y = 0; y < FW; y++) {
      dst[y * FW + x] = s / n;
      s += tmp[Math.min(FW - 1, y + rad + 1) * FW + x] - tmp[Math.max(0, y - rad) * FW + x];
    }
  }
}

/**
 * The forest over the chunk at (x0, y0): how much light each cell gets, and per cell its stratum and
 * height packed in a byte (stratum << 6 | height in 63rds). Sunlight comes from the upper left, high
 * enough that a crown's shadow is 1/phi of its height long. A cell is lit or shaded by its slope,
 * darkened in the shadow of taller crowns, and darkened more the lower it lies than the forest round it.
 */
function forest(x0, y0) {
  const X0 = x0 - FM, Y0 = y0 - FM;
  fh.fill(0); fl.fill(0); fcs.length = 0;
  for (let L = 0; L < STRATA.length; L++) {
    const St = STRATA[L], reach = St.r * PHI ** 0.5 * (1 + PHI ** -3);
    for (let j = Math.floor((Y0 - reach) / St.g); j <= Math.floor((Y0 + FW + reach) / St.g); j++)
      for (let i = Math.floor((X0 - reach) / St.g); i <= Math.floor((X0 + FW + reach) / St.g); i++) {
        const c = crownOf(L, i, j);
        if (!c) continue;
        const n = fcs.push(c) - 1, cr = c.r * (1 + PHI ** -3);   // the lobes reach out this far
        const ya = Math.max(0, Math.floor(c.y - cr) - Y0), yb = Math.min(FW - 1, Math.ceil(c.y + cr) - Y0);
        const xa = Math.max(0, Math.floor(c.x - cr) - X0), xb = Math.min(FW - 1, Math.ceil(c.x + cr) - X0);
        for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) {
          const v = crownHeight(c, X0 + xx + 0.5, Y0 + yy + 0.5), k = yy * FW + xx;
          if (v > fh[k]) { fh[k] = v; fl[k] = c.L; fk[k] = n; }
        }
      }
  }
  // Shadows: a running horizon down each diagonal from the upper left, falling phi*sqrt(2) cells a step.
  const fall = PHI * Math.SQRT2;
  for (let yy = 0; yy < FW; yy++) for (let xx = 0; xx < FW; xx++) {
    const k = yy * FW + xx;
    fz[k] = yy && xx ? Math.max(fz[k - FW - 1] - fall, fh[k - FW - 1] * TALL) : 0;
  }
  // The sky a place sees: how much lower it lies than the forest within 13 cells of it.
  boxBlur(fh, fa, fb, 13);
  const light = new Float32Array(N * N), hl = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y + FM) * FW + x + FM, h = fh[k];
    const slope = ((fh[k + 1] - fh[k - 1]) + (fh[k + FW] - fh[k - FW])) * TALL / 2;
    const lean = Math.max(-1, Math.min(1, slope * PHI));
    const shade = Math.min(1, Math.max(0, (fz[k] - h * TALL) / PHI));
    const sky = Math.max(0, fa[k] - h);
    // A crown's rim, where it stands over lower ground, is drawn dark: the gaps between crowns.
    const rim = fl[k] && Math.min(fh[k - 1], fh[k + 1], fh[k - FW], fh[k + FW]) < h - PHI ** -4 ? PHI ** -2 : 1;
    light[y * N + x] = rim * (1 + PHI ** -2 * lean) * (1 - (1 - PHI ** -2) * shade) * (1 - (1 - PHI ** -3) * Math.min(1, sky * PHI * PHI));
    hl[y * N + x] = (fl[k] << 6) | Math.round(h * 63);
  }
  return { light, hl };
}

/**
 * A crown's own colour: one of the three colours of the passage it stands in. Seen from above, a
 * rainforest's crowns are a mosaic of colours, a few in flower; each crown here leans its dots toward
 * its colour, emergents most.
 */
function crownTint(c) {
  if (!c.tint) {
    nearestPassages(c.x + wanderX(c.x, c.y), c.y + wanderY(c.x, c.y));
    c.ti = h3(Math.floor(c.x), Math.floor(c.y), 541) % 3; c.tp = PA;     // which colour, of which passage
    c.tint = PA.pal[c.ti];
  }
  return c.tint;
}
const TINT = [0, PHI ** -3, PHI ** -2, PHI ** -1];       // how far each stratum's dots lean to their crown's colour

// ---- where life settles -------------------------------------------------------------------------
// Each kind keeps a lattice of its own with one candidate site a square. A site is kept when the
// square's hash allows it and it lies deep enough out, and it moves to the nearest cell of its kind's
// strata within 21 cells, or is dropped. Strata are bits: 1 floor, 2 shrubs, 4 canopy, 8 emergents.
const HABITATS = [
  // kind         lattice  salt  odds        strata  from depth
  ["ants",        144,     301,  PHI ** -2,  1,      0],
  ["mould",       233,     307,  PHI ** -1,  3,      PHI ** -2],
  ["frogs",       89,      311,  PHI ** -2,  1,      0],
  ["ferns",       89,      313,  PHI ** -1,  1,      0],
  ["snakes",      233,     317,  PHI ** -1,  3,      PHI ** -3],
  ["fireflies",   233,     331,  PHI ** -1,  2,      PHI ** -3],
  ["morphos",     144,     337,  PHI ** -1,  3,      0],
  ["blooms",      89,      347,  PHI ** -1,  6,      0],
  ["hummers",     377,     349,  PHI ** -1,  6,      0],
  ["troops",      377,     353,  PHI ** -1,  12,     PHI ** -3],
];
/** n points in a sunflower spiral out to rad cells, nearest first. */
const spiral = (n, rad) => Array.from({ length: n }, (_, k) => [Math.round(Math.sqrt(k / (n - 1)) * rad * Math.cos(k * GOLDEN_ANGLE)),
                                                              Math.round(Math.sqrt(k / (n - 1)) * rad * Math.sin(k * GOLDEN_ANGLE))]);
const SEEK = spiral(89, 21), LOOK = spiral(89, 34);
const chroma = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);

/** Life's sites in the chunk at (x0, y0), from its cells' strata, depths, colours and paintings. */
function habitats(x0, y0, hl, dd, off, oc, os, ow) {
  const sites = [];
  const inChunk = (x, y) => x >= x0 && y >= y0 && x < x0 + N && y < y0 + N;
  for (const [kind, g, salt, odds, strata, dmin] of HABITATS) {
    for (let j = Math.floor(y0 / g); j <= Math.floor((y0 + N - 1) / g); j++)
      for (let i = Math.floor(x0 / g); i <= Math.floor((x0 + N - 1) / g); i++) {
        let sx = Math.floor((i + u3(i, j, salt)) * g), sy = Math.floor((j + u3(i, j, salt + 1)) * g);
        if (!inChunk(sx, sy) || u3(i, j, salt + 2) >= odds) continue;
        let found = false;
        for (const [dx, dy] of SEEK) {
          const x = sx + dx, y = sy + dy;
          if (!inChunk(x, y) || !((strata >> (hl[(y - y0) * N + x - x0] >> 6)) & 1)) continue;
          sx = x; sy = y; found = true; break;
        }
        const k = (sy - y0) * N + sx - x0, d = dd[off + k];
        if (!found || d < dmin) continue;
        // The painting it wears: the most colourful among the dots within 34 cells.
        let w = ow[off + k], best = -1;
        for (const [dx, dy] of LOOK) {
          const x = sx + dx, y = sy + dy;
          if (!inChunk(x, y)) continue;
          const kk = off + (y - y0) * N + x - x0;
          if (!os[kk] || !TOKENS[ow[kk]]) continue;
          const c = Math.max(...TOKENS[ow[kk]].map(chroma));
          if (c > best) { best = c; w = ow[kk]; }
        }
        const site = { kind, x: sx + 0.5, y: sy + 0.5, seed: h3(i, j, salt + 3), w, turn: turnAt(sx, sy, d), d, h: (hl[k] & 63) / 63 };
        if (kind === "mould") {
          // Food: the brightest dots under the canopy within 55 cells, which the mould will join up.
          const lum = [];
          for (let y = Math.max(y0, sy - 55); y < Math.min(y0 + N, sy + 56); y++)
            for (let x = Math.max(x0, sx - 55); x < Math.min(x0 + N, sx + 56); x++) {
              const kk = (y - y0) * N + x - x0;
              if ((hl[kk] >> 6) > SHRUB || !os[off + kk] || Math.hypot(x - sx, y - sy) > 55) continue;
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

// ---- what each cell is made of, for the page's GPU ------------------------------------------------
// Where the page has WebGL2 it paints the ground itself, every frame, so that its colours can change as they are
// watched; a chunk then sends what each cell is made of instead of its pixels. Three words a cell:
//   its soil's colour (turned, before any palette), and its dot's size, stratum, crown colour and flags;
//   its palette entry, its crown's entry, its depth in 255ths and its light in 127.5ths;
//   the entry of the passage it lies nearer (not always its own, in an overspray), and how far into it, in 255ths.
// An entry is 32 texels: up to five palettes of five stops (the plane's one carries its stops' lightness), then
// texel 25 its passage's middle, character, and painting or count of palettes, and texel 26 which palette it
// wears, its passage's lattice square and its turn.
let GLDATA = false;
const ENT_W = 32, ENT_MAX = 256;
function entryTable() {
  const buf = new Float32Array(ENT_MAX * ENT_W * 4), byPass = new Map();
  let n = 0;
  const put = (e, t, c, a) => { const o = (e * ENT_W + t) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = a; };
  const head = (e, P, count, chosen) => {
    put(e, 25, [P.x, P.y, P.kind], count); put(e, 26, [chosen, P.i, P.j], P.turn || 0);
    put(e, 27, [P.dm === undefined ? (P.dm = depth(Math.floor(P.x), Math.floor(P.y))) : P.dm, 0, 0], 0);   // how far out its middle lies
  };
  return {
    rows: () => buf.slice(0, n * ENT_W * 4),
    /** The plane's entry for passage P: its gradient map. */
    plane(P) {
      let e = byPass.get(P);
      if (e === undefined) {
        if (n >= ENT_MAX) return 0;
        byPass.set(P, (e = n++));
        P.stops.forEach((c, t) => put(e, t, c, P.at[t]));
        head(e, P, P.w, 0);
      }
      return e;
    },
    /** The Earth's entry for passage P wearing look key `key`: the look's palettes, and which of them the passage wears. */
    earth(P, key) {
      let m = byPass.get(P);
      if (!m) byPass.set(P, (m = new Map()));
      let e = m.get(key);
      if (e === undefined) {
        if (n >= ENT_MAX) return 0;
        m.set(key, (e = n++));
        const cands = eLookPalettes(key);
        cands.forEach((q, c) => q.stops.forEach((st, t) => put(e, c * 5 + t, st, q.w)));
        head(e, P, cands.length, h3(Math.floor(P.x), Math.floor(P.y), key) % cands.length);
      }
      return e;
    },
  };
}
/** A cell's words: its soil's colour and dot flags; its entries, depth and light. */
const cellWord = (r, g, b, flags) => (Math.round(r) | (Math.round(g) << 8) | (Math.round(b) << 16) | (flags << 24)) >>> 0;
const cellWord2 = (e, d, light) => (e | (Math.round(d * 255) << 16) | (Math.min(255, Math.round(light * 127.5)) << 24)) >>> 0;
/** The buffers of a chunk's typed arrays, to hand over to the page. */
const buffersOf = (o) => Object.values(o).filter((v) => ArrayBuffer.isView(v)).map((v) => v.buffer);

/** Grow the chunk of ground covering tile (ci, cj): its pixels (or cells), painting per cell, depths and birds. */
function chunk(ci, cj) {
  const x0 = ci * N, y0 = cj * N;
  // Drips are sorted within 21-cell segments fixed on the plane, so rows are grown for whole segments.
  const s0 = Math.floor(y0 / SEG) * SEG, s1 = (Math.floor((y0 + N - 1) / SEG) + 1) * SEG, HH = s1 - s0;
  const oc = new Uint8Array(N * HH * 3), os = new Uint8Array(N * HH), ow = new Uint16Array(N * HH), dd = new Float32Array(N * HH);
  const pp = new Array(N * HH), ps = new Float32Array(N * HH), dk = new Uint8Array(N * HH);   // passage, its strength, drips
  const pn = new Array(N * HH), pe = new Float32Array(N * HH);    // the nearer passage, and how far into it (for the GPU)

  // A. The forest over this ground, and a margin round it; and the passages' wandering edges, sampled
  //    every 8 cells on the plane's own grid and eased between.
  const { light, hl } = forest(x0, y0);
  const gx0 = x0 / 8 - 1, gy0 = Math.floor(s0 / 8) - 1, GW = N / 8 + 3, GH = Math.ceil(HH / 8) + 3;
  const WX = new Float32Array(GW * GH), WY = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    WX[gy * GW + gx] = wanderX((gx0 + gx) * 8, (gy0 + gy) * 8); WY[gy * GW + gx] = wanderY((gx0 + gx) * 8, (gy0 + gy) * 8);
  }

  // B. Where each cell takes its soil from: folded, torn and fused, more so the farther out it is. Dots
  //    fuse into blocks only as far as the forest there stands tall: nearer the eye, coarser the pixel,
  //    so the floor keeps its fine dots, shrubs fuse to 3 cells at most, the canopy to 5, emergents to 8.
  for (let yy = 0; yy < HH; yy++) {
    const y = s0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = yy * N + xx, d = depth(x, y);
      dd[k] = d;
      // The passage this cell belongs to, and how strongly: not at all on calm ground, fully from phi^-1 out.
      const fx = x / 8 - gx0, fy = y / 8 - gy0, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, g = iy * GW + ix;
      nearestPassages(x + (WX[g] * (1 - tx) + WX[g + 1] * tx) * (1 - ty) + (WX[g + GW] * (1 - tx) + WX[g + GW + 1] * tx) * ty,
                      y + (WY[g] * (1 - tx) + WY[g + 1] * tx) * (1 - ty) + (WY[g + GW] * (1 - tx) + WY[g + GW + 1] * tx) * ty);
      const P = u3(x, y, 523) < 0.5 + 0.5 * PE * PE * (3 - 2 * PE) ? PA : PB, st = smooth(PHI ** -3, PHI ** -1, d);
      pp[k] = P; ps[k] = st; pn[k] = PA; pe[k] = PE;
      dk[k] = d >= (P.kind === DRIP ? PHI ** -3 : PHI ** -1) ? 1 : 0;
      // A mosaic passage fuses its dots as far as its depth allows, whatever stands over it; elsewhere the
      // forest sets how far they fuse.
      const b = Math.min(blockOf(d), st > 0 && P.kind === MOSAIC ? 8 : COARSEST[fl[(y - y0 + FM) * FW + x - x0 + FM]], st > 0 ? KIND_CAP[P.kind] : 8);
      const bx = x - mod(x, b), by = y - mod(y, b);
      // A spray passage takes each cell's soil from a spot up to 8 cells off: an airbrushed speckle.
      let qx = bx, qy = by;
      if (P.kind === SPRAY && st > 0) {
        const a = u3(x, y, 531) * 2 * Math.PI, r = 8 * st * Math.sqrt(u3(x, y, 533));
        qx += Math.round(Math.cos(a) * r); qy += Math.round(Math.sin(a) * r);
      }
      sourceOf(qx, qy, b === 1 ? d : depth(bx, by));
      const t = sampleAt(QX, QY), sz = t.size[SI];
      oc[k * 3] = t.col[SI * 3]; oc[k * 3 + 1] = t.col[SI * 3 + 1]; oc[k * 3 + 2] = t.col[SI * 3 + 2];
      ow[k] = t.work[SI];
      // A fused block is one square dot, with a one-cell gap on its far sides.
      os[k] = b === 1 ? sz : (x - bx === b - 1 || y - by === b - 1 || !sz) ? 0 : 3;
      if (P.kind === SPRAY && st > 0 && os[k]) os[k] = u3(x, y, 537) < PHI ** -3 * st ? 0 : u3(x, y, 539) < PHI ** -1 ? 1 : 3;
    }
  }

  // C. Drips: past phi^-1 (past phi^-3 in a drip passage), runs of lit cells in a column are sorted by
  //    lightness, within their segment.
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

  // D. The colours turn by up to the golden angle; some dots come loose as birds and leave pores; what
  //    stays is lit by the forest and painted, two pixels a cell. A share of the dots on the canopy
  //    can catch the wind and show pale.
  const T = N * R, px = GLDATA ? null : new Uint8ClampedArray(T * T * 4), cells = GLDATA ? new Uint32Array(N * N * 3) : null, ents = GLDATA ? entryTable() : null;
  if (px) for (let j = 0; j < px.length; j += 4) { px[j] = GROUND[0]; px[j + 1] = GROUND[1]; px[j + 2] = GROUND[2]; px[j + 3] = 255; }
  const work = new Uint16Array(N * N), dgrid = new Float32Array(32 * 32), birds = [], glints = [], off = (y0 - s0) * N, rgb = [0, 0, 0], gm = [0, 0, 0];
  for (let yy = 0; yy < N; yy++) {
    const y = y0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = off + yy * N + xx, c = yy * N + xx, d = dd[k];
      work[c] = ow[k];
      let [r, g, b] = turnRGB(oc[k * 3], oc[k * 3 + 1], oc[k * 3 + 2], turnAt(x, y, d), rgb);
      const P = pp[k], st = ps[k];
      if (cells) { cells[3 * c] = cellWord(r, g, b, 0); cells[3 * c + 1] = cellWord2(ents.plane(P), d, light[c]); cells[3 * c + 2] = ents.plane(pn[k]) | (Math.round(pe[k] * 255) << 8); }
      {
        // The passage's palette laid over this cell: the colour its lightness maps to, brought back to
        // that lightness, so the palette gives the hue and the ground keeps its lights and darks. Calm
        // ground takes a wash of it, phi^-3 of the way; the outskirts phi^-1 of the way. In a nocturne all
        // but the brightest sink nearly to black, and those shine out like stars.
        const l = 0.3 * r + 0.59 * g + 0.11 * b, m = mapped(P, l, gm), f = l / Math.max(1, lumOf(m)), q = PHI ** -1 * (PHI ** -2 + (1 - PHI ** -2) * st);
        r += (Math.min(255, m[0] * f) - r) * q; g += (Math.min(255, m[1] * f) - g) * q; b += (Math.min(255, m[2] * f) - b) * q;
        if (P.kind === NOCTURNE && st > 0) {
          if (0.3 * r + 0.59 * g + 0.11 * b < 144) { const f = 1 - (1 - PHI ** -4) * st; r *= f; g *= f; b *= f; }
          else { const k2 = PHI ** -2 * st; r += (255 - r) * k2; g += (255 - g) * k2; b += (255 - b) * k2; }
        }
      }
      oc[k * 3] = r; oc[k * 3 + 1] = g; oc[k * 3 + 2] = b;
      let s = os[k];
      if (s && KAPPA && (hl[c] >> 6) >= CANOPY && u3(x, y, 37) < (smooth(PHI ** -2, 1, d) / PHI) * KAPPA * KIND_BIRDS[P.kind]) { birds.push(x + 0.5, y + 0.5, r, g, b, ow[k]); s = 0; }
      if (!s) continue;
      if ((hl[c] >> 6) >= CANOPY && u3(x, y, 401) < PHI ** -5 && glints.length < 6 * 987)
        glints.push(x + 0.5, y + 0.5, r + (255 - r) / PHI, g + (255 - g) / PHI, b + (255 - b) / PHI, ow[k]);
      // Lit by the forest, keyed by the passage, and sunlit in a clearing, most at its heart.
      const f = light[c] * KIND_KEY[P.kind] ** st * (1 + PHI ** -1 * (1 - smooth(0, PHI ** -1, d))), w = s === 3 ? R : 1, fk_ = (yy + FM) * FW + xx + FM, L = fl[fk_];
      let pr = r, pg = g, pb = b;
      if (L) { const cr = fcs[fk[fk_]], tc = crownTint(cr), q = TINT[L]; pr += (tc[0] - r) * q; pg += (tc[1] - g) * q; pb += (tc[2] - b) * q; }
      if (cells) {
        const cr = L ? fcs[fk[fk_]] : null;
        cells[3 * c] |= (s | (L << 2) | ((cr ? cr.ti : 0) << 4)) << 24;
        if (cr) cells[3 * c + 1] |= ents.plane(cr.tp) << 8;
        continue;
      }
      for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
        const j = ((yy * R + dy) * T + xx * R + dx) * 4;
        px[j] = pr * f; px[j + 1] = pg * f; px[j + 2] = pb * f;
      }
    }
  }
  for (let by = 0; by < 32; by++) for (let bx = 0; bx < 32; bx++) dgrid[by * 32 + bx] = dd[off + (by * 8 + 4) * N + bx * 8 + 4];
  const sites = habitats(x0, y0, hl, dd, off, oc, os, ow);
  return { type: "chunk", ci, cj, px, cells, ents: ents && ents.rows(), work, dgrid, birds: Float32Array.from(birds), hl, sites, glints: Float32Array.from(glints) };
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    S = m.sources; CORN = m.corners; VERT = m.vertical; HORZ = m.horizontal; MIDS = m.middles;
    AF = m.a; BF = m.b; CN = m.corner; K = m.colours;
    ({ A: ZA, D: ZD, CZ, CZ_WANDER: CZW } = m.zone);
    GROUND = m.ground; R = m.R; KAPPA = m.kappa; TOKENS = m.tokens; GLDATA = !!m.gl;
    postMessage({ type: "ready" });
  } else if (m.type === "chunk") {
    const out = chunk(m.ci, m.cj);
    postMessage(out, buffersOf(out));
  }
};
</script>
<script id="earth-worker" type="text/plain">__EARTH_WORKER__</script>
<script id="ground-gl">__GROUND_GL__</script>

<script>
const PL = __PLANE__;
const ART = __ART__;                                            // the artist DIRT is drawn after, as measured (dirt/artists/)
const TOKENS = PL.works.map((w) => w.colors.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))));   // each painting's colours
const R = 2;                                                    // canvas pixels a cell
const GROUND = [1, 3, 5].map((i) => parseInt(PL.ground.hex.slice(i, i + 2), 16));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FADE = 377;                                               // ms for new ground to come in (Fibonacci)
const GLIDE = 1 - PHI ** -6;                                    // how long a swipe glides on
const MARGIN = 89, KEEP = 55, ASKING = 2;                       // cells kept live round the view; chunks kept; asks in flight a worker

const stage = document.getElementById("stage"), cv = document.getElementById("field"), cx = cv.getContext("2d");
const showAll = document.getElementById("show-all");
// The ground painted on the GPU, where there is WebGL2, so its colours can change (see ground-gl.js); else by the canvas.
const GLG = /nogl/.test(location.hash) ? null
  : groundGL(stage, cv, { tokens: TOKENS, ground: GROUND, reduced: REDUCED, hold: /hold/.test(location.hash), force: /forcegl/.test(location.hash),
                           art: /noart/.test(location.hash) ? null : ART });
// Drawn after the artist, the plane is paper: the page round it is a graphite wall, and picking a painting out fades
// the rest into the paper rather than into the dark.
const ON_PAPER = !!GLG && !/noart/.test(location.hash);
const VEIL = ON_PAPER ? [236, 232, 222] : GROUND;
if (ON_PAPER) document.documentElement.style.setProperty("--ground", "#1c1b19");

function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function loadImage(src) { return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; }); }
function pixels(img, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, w, h).data;
}

// ---- the worker that grows the ground ---------------------------------------------------------

// Two workers where the device has the cores for them, each growing a chunk at a time.
const workerUrl = URL.createObjectURL(new Blob(
  [document.getElementById("common").textContent, "\n", document.getElementById("earth-common").textContent, "\n",
   document.getElementById("worker-src").textContent, "\n", document.getElementById("earth-worker").textContent],
  { type: "text/javascript" }));
const workers = Array.from({ length: (navigator.hardwareConcurrency || 1) > 2 ? 2 : 1 }, () => ({ w: new Worker(workerUrl), ready: false, busy: 0 }));
const chunks = new Map(), asked = new Set();
const ck = (i, j) => (i + 32768) * 65536 + (j + 32768);
let nextId = 1;
// Whether a chunk that has come back is still wanted, and whether one held has gone stale: always and never,
// until the Earth (which regrows its ground each month) says otherwise.
let chunkWanted = (m) => true, chunkStale = (c) => false;

for (const wk of workers) wk.w.onmessage = (e) => {
  const m = e.data;
  if (m.type === "ready") { wk.ready = true; return; }
  if (m.type !== "chunk") return;
  wk.busy--;
  const k = ck(m.ci, m.cj);
  asked.delete(k);
  if (!chunkWanted(m)) return;
  let c = null;
  if (m.px) {                                                     // pixels grown by the worker; else cells for the GPU
    c = document.createElement("canvas");
    c.width = c.height = N * R;
    c.getContext("2d").putImageData(new ImageData(m.px, N * R, N * R), 0, 0);
  }
  const old = chunks.get(k);                                      // the same ground in another month: it gives way
  if (old && old.spawned) { despawn(old); despawnLife(old); }
  if (old) old.was = null;
  chunks.set(k, { i: m.ci, j: m.cj, canvas: c, cells: m.cells, ents: m.ents, was: m.cells ? old || null : undefined,
                  work: m.work, dgrid: m.dgrid, birds: m.birds, hl: m.hl, sites: m.sites, glints: m.glints,
                  born: performance.now(), id: nextId++, spawned: false, shade: null, shadeSel: null, prev: old && old.canvas ? old.canvas : null,
                  wet: m.wet, sway: m.sway, crests: m.crests, coast: m.coast, sea: m.sea, leaves: m.leaves, month: m.month });
};

/** Decode the plane's ingredients into typed arrays for the worker. */
async function ingredients() {
  const sources = await Promise.all(PL.sources.map(async (s) => {
    const [ci, mi] = await Promise.all([loadImage(s.colour), loadImage(s.meta)]);
    const cp = pixels(ci, N, N), mp = pixels(mi, N, N);
    const col = new Uint8Array(N * N * 3), size = new Uint8Array(N * N), lab = new Uint16Array(N * N), zone = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      col[i * 3] = cp[i * 4]; col[i * 3 + 1] = cp[i * 4 + 1]; col[i * 3 + 2] = cp[i * 4 + 2];
      lab[i] = mp[i * 4] + 256 * mp[i * 4 + 1]; size[i] = mp[i * 4 + 2] & 3; zone[i] = (mp[i * 4 + 2] >> 2) & 1;
    }
    const work = Uint16Array.from(s.clods, (c) => Math.max(0, c[0]));
    const hash = Uint32Array.from(s.clods, (c) => (c[2] ? hash32(c[2]) : 0));
    const axis = Uint8Array.from(s.clods, (c) => (c[2] ? (c[2][0] === "v" ? 1 : 2) : 0));
    return { col, size, lab, zone, work, hash, axis };
  }));
  const fields = [];
  for (const src of PL.fields) {
    const p = pixels(await loadImage(src), N, N);
    for (let ch = 0; ch < 3; ch++) fields.push(Float32Array.from({ length: N * N }, (_, i) => p[i * 4 + ch] / 255));
  }
  const K = PL.colours, transfer = [];
  for (const s of sources) transfer.push(s.col.buffer, s.size.buffer, s.lab.buffer, s.zone.buffer, s.work.buffer, s.hash.buffer, s.axis.buffer);
  for (const f of fields) transfer.push(f.buffer);
  const msg = { type: "init", sources, corners: PL.corners, vertical: PL.vertical, horizontal: PL.horizontal, middles: PL.middles,
                a: fields.slice(0, K), b: fields.slice(K, 2 * K), corner: fields[2 * K], colours: K, zone: PL.zone,
                ground: GROUND, R, kappa: REDUCED ? 0 : PHI ** -5, tokens: TOKENS, gl: !!GLG };
  return { msg, transfer };
}
ingredients().then(({ msg, transfer }) => {
  for (let n = workers.length - 1; n > 0; n--) workers[n].w.postMessage(msg);     // copies for all but the first,
  workers[0].w.postMessage(msg, transfer);                                        // which takes the originals
});

// ---- the view ---------------------------------------------------------------------------------

let VW = 0, VH = 0, vx = 0, vy = 0, velX = 0, velY = 0, placed = false, tick = 0;

function fit() {
  const r = stage.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (placed && w === cv.width && h === cv.height) return;
  const midX = vx + VW / 2, midY = vy + VH / 2;
  cv.width = w; cv.height = h; VW = w / R; VH = h / R;
  if (placed) { vx = midX - VW / 2; vy = midY - VH / 2; }
  else { const c = isle(0, 0); vx = c.x - VW / 2; vy = c.y - VH / 2; placed = true; }   // begin on calm ground
  sizeTrail();
}
new ResizeObserver(fit).observe(stage);

/** The chunks the view needs, nearest its middle first. */
function wanted() {
  const i0 = Math.floor((vx - MARGIN) / N), i1 = Math.floor((vx + VW + MARGIN) / N);
  const j0 = Math.floor((vy - MARGIN) / N), j1 = Math.floor((vy + VH + MARGIN) / N);
  const mx = vx + VW / 2, my = vy + VH / 2, list = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) list.push({ i, j, k: ck(i, j), d: Math.hypot((i + 0.5) * N - mx, (j + 0.5) * N - my) });
  list.sort((a, b) => a.d - b.d);
  list.box = { x0: i0 * N, y0: j0 * N, x1: (i1 + 1) * N, y1: (j1 + 1) * N };
  return list;
}

/** Ask for missing ground, launch and ground the birds, and forget ground far behind. */
function tend(list) {
  const want = new Set(list.map((w) => w.k));
  for (const w of list) {
    if ((chunks.has(w.k) && !chunkStale(chunks.get(w.k))) || asked.has(w.k)) continue;
    const wk = workers.filter((o) => o.ready && o.busy < ASKING).sort((a, b) => a.busy - b.busy)[0];
    if (!wk) break;
    asked.add(w.k); wk.busy++; wk.w.postMessage({ type: "chunk", ci: w.i, cj: w.j });
  }
  for (const [k, c] of chunks) {
    const on = want.has(k);
    if (on && !c.spawned) { spawn(c); spawnLife(c); }
    else if (!on && c.spawned) { despawn(c); despawnLife(c); }
  }
  if (chunks.size > KEEP) {
    const mx = vx + VW / 2, my = vy + VH / 2;
    const far = [...chunks.entries()].filter(([k]) => !want.has(k))
      .sort((a, b) => Math.hypot((b[1].i + 0.5) * N - mx, (b[1].j + 0.5) * N - my) - Math.hypot((a[1].i + 0.5) * N - mx, (a[1].j + 0.5) * N - my));
    for (const [k] of far) { if (chunks.size <= KEEP) break; chunks.delete(k); }
  }
}

// ---- the birds --------------------------------------------------------------------------------

const CAP = 10946, HAWKS = 3;                                   // birds at most, and unseen hawks (Fibonacci)
const SEE = 8, NEAR = 3, FEAR = 21, LOOK = 13;                  // cells: sight, personal space, fear; neighbours heeded
const VMAX = 2, VMIN = 1 / PHI, PANIC = VMAX * PHI;             // cells a frame
const BX = new Float32Array(CAP), BY = new Float32Array(CAP), BVX = new Float32Array(CAP), BVY = new Float32Array(CAP);
const BHX = new Float32Array(CAP), BHY = new Float32Array(CAP), BRGB = new Uint8Array(CAP * 3), BKIN = new Uint16Array(CAP), BHOME = new Int32Array(CAP);
const next = new Int32Array(CAP);
let nb = 0, head = new Int32Array(1);
const hawks = Array.from({ length: HAWKS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, prey: 0, until: 0, placed: false }));
// The slow current: a stream function of five travelling waves, Fibonacci wavelengths, so it swirls.
const waves = [89, 144, 233, 377, 610].map((lambda) => {
  const a = Math.random() * 2 * Math.PI, k = (2 * Math.PI) / lambda;
  return { kx: k * Math.cos(a), ky: k * Math.sin(a), amp: lambda / (2 * Math.PI), w: (Math.random() - 0.5) * PHI ** -5, ph: Math.random() * 2 * Math.PI };
});
{ const norm = waves.reduce((s, v) => s + v.amp * Math.hypot(v.kx, v.ky), 0); waves.forEach((v) => (v.amp /= norm)); }
// And eddies: one in each 377-cell square, 89 cells across, turning one way or the other as it drifts,
// at most phi times as fast as the waves flow, so the flocks wheel. The whole current is worked out on
// a grid 21 cells apart over the live ground each frame, and eased between.
const EDDY = 377, EDDY_R = 89, CG = 21, SPIN = PHI * EDDY_R * Math.sqrt(Math.E / 2);   // eddies are 89 cells across times phi^+-1/2
let curU = new Float32Array(0), curV = new Float32Array(0), cgx0 = 0, cgy0 = 0, CGW = 0;
function currentField(t, box) {
  cgx0 = Math.floor(box.x0 / CG); cgy0 = Math.floor(box.y0 / CG);
  CGW = Math.ceil((box.x1 - box.x0) / CG) + 2;
  const CGH = Math.ceil((box.y1 - box.y0) / CG) + 2, far = 3 * EDDY_R, eddies = [];
  if (curU.length < CGW * CGH) { curU = new Float32Array(CGW * CGH); curV = new Float32Array(CGW * CGH); }
  for (let j = Math.floor((box.y0 - far) / EDDY); j <= Math.floor((box.y1 + far) / EDDY); j++)
    for (let i = Math.floor((box.x0 - far) / EDDY); i <= Math.floor((box.x1 + far) / EDDY); i++) {
      const a = u3(i, j, 603) * 2 * Math.PI + t * PHI ** -8, r = EDDY_R * PHI ** (u3(i, j, 605) - 0.5);   // each its own size and strength
      eddies.push((i + 0.5 + (u3(i, j, 601) - 0.5) / PHI) * EDDY + Math.cos(a) * 55, (j + 0.5 + (u3(i, j, 602) - 0.5) / PHI) * EDDY + Math.sin(a) * 55,
                  (u3(i, j, 607) < 0.5 ? -1 : 1) * (PHI ** -1 + (1 - PHI ** -1) * u3(i, j, 609)) * SPIN * (r / EDDY_R) * 2 / (r * r), r * r);
    }
  for (let gy = 0; gy < CGH; gy++) for (let gx = 0; gx < CGW; gx++) {
    const x = (cgx0 + gx) * CG, y = (cgy0 + gy) * CG;
    let u = 0, v = 0;
    for (const w of waves) { const c = w.amp * Math.cos(w.kx * x + w.ky * y + w.w * t + w.ph); u += w.ky * c; v -= w.kx * c; }
    for (let e = 0; e < eddies.length; e += 4) {
      const dx = x - eddies[e], dy = y - eddies[e + 1], r2 = dx * dx + dy * dy;
      if (r2 > far * far) continue;
      const q = eddies[e + 2] * Math.exp(-r2 / eddies[e + 3]);
      u -= dy * q; v += dx * q;
    }
    curU[gy * CGW + gx] = u; curV[gy * CGW + gx] = v;
  }
}

function spawn(c) {
  const b = c.birds;
  for (let o = 0; o + 5 < b.length && nb < CAP; o += 6) {
    BX[nb] = BHX[nb] = b[o]; BY[nb] = BHY[nb] = b[o + 1];
    BRGB[nb * 3] = b[o + 2]; BRGB[nb * 3 + 1] = b[o + 3]; BRGB[nb * 3 + 2] = b[o + 4];
    BKIN[nb] = b[o + 5]; BHOME[nb] = c.id;
    const a = Math.random() * 2 * Math.PI;
    BVX[nb] = Math.cos(a) * VMIN; BVY[nb] = Math.sin(a) * VMIN;
    nb++;
  }
  c.spawned = true;
}
function despawn(c) {
  let w = 0;
  for (let r = 0; r < nb; r++) {
    if (BHOME[r] === c.id) continue;
    if (w !== r) {
      BX[w] = BX[r]; BY[w] = BY[r]; BVX[w] = BVX[r]; BVY[w] = BVY[r]; BHX[w] = BHX[r]; BHY[w] = BHY[r];
      BRGB[w * 3] = BRGB[r * 3]; BRGB[w * 3 + 1] = BRGB[r * 3 + 1]; BRGB[w * 3 + 2] = BRGB[r * 3 + 2];
      BKIN[w] = BKIN[r]; BHOME[w] = BHOME[r];
    }
    w++;
  }
  nb = w;
  c.spawned = false;
}

/** How far out a place is, from the grown ground's depth grid (8 cells a sample). */
let dKey = NaN, dGrid = null;
function dAt(x, y) {
  const k = ck(Math.floor(x / N), Math.floor(y / N));
  if (k !== dKey || !dGrid) { const c = chunks.get(k); dGrid = c ? c.dgrid : null; dKey = k; }
  return dGrid ? dGrid[Math.floor(mod(y, N) / 8) * 32 + Math.floor(mod(x, N) / 8)] : 1;
}

// The trails: one pixel a cell, fixed to the plane, shifted as the view moves.
const trailCv = document.createElement("canvas"), trailCtx = trailCv.getContext("2d");
let TW = 0, TH = 0, trailImg = null, trailPx = null, trailTmp = null, tox = 0, toy = 0;
function sizeTrail() {
  TW = Math.ceil(VW) + 2; TH = Math.ceil(VH) + 2;
  trailCv.width = TW; trailCv.height = TH;
  trailImg = trailCtx.createImageData(TW, TH); trailPx = trailImg.data; trailTmp = new Uint8ClampedArray(trailPx.length);
  tox = Math.floor(vx); toy = Math.floor(vy);
  sizeLife();
}
function shiftTrail(nx, ny) {
  const dx = nx - tox, dy = ny - toy;
  if (!dx && !dy) return;
  if (Math.abs(dx) >= TW || Math.abs(dy) >= TH) trailPx.fill(0);
  else {
    trailTmp.fill(0);
    const xs = Math.max(0, dx), xe = Math.min(TW, TW + dx);
    for (let y = 0; y < TH; y++) {
      const sy = y + dy;
      if (sy < 0 || sy >= TH) continue;
      trailTmp.set(trailPx.subarray((sy * TW + xs) * 4, (sy * TW + xe) * 4), (y * TW + xs - dx) * 4);
    }
    trailPx.set(trailTmp);
  }
  tox = nx; toy = ny;
}

function flow(t, box) {
  // Long, soft trails, fading by phi^-6 a frame: every other row each frame, by the square of that.
  const fade = (1 - PHI ** -6) ** 2, row = TW * 4;
  for (let y = t & 1; y < TH; y += 2) for (let j = y * row + 3, e = j + row; j < e; j += 4) if (trailPx[j]) trailPx[j] = trailPx[j] * fade;
  currentField(t, box);

  // Where everyone is: a bucket grid a sight-length across over the live ground, rebuilt each frame.
  const gx0 = Math.floor(box.x0 / SEE), gy0 = Math.floor(box.y0 / SEE);
  const GXn = Math.ceil((box.x1 - box.x0) / SEE) + 1, GYn = Math.ceil((box.y1 - box.y0) / SEE) + 1;
  if (head.length < GXn * GYn) head = new Int32Array(GXn * GYn);
  head.fill(-1, 0, GXn * GYn);
  for (let k = 0; k < nb; k++) {
    if (BX[k] < box.x0 || BY[k] < box.y0 || BX[k] >= box.x1 || BY[k] >= box.y1) { BX[k] = BHX[k]; BY[k] = BHY[k]; }  // strayed: back to its pore
    const b = (Math.floor(BY[k] / SEE) - gy0) * GXn + (Math.floor(BX[k] / SEE) - gx0);
    next[k] = head[b]; head[b] = k;
  }

  // The hawks hunt wherever the viewer is: each chases a bird of its choosing for a while, then turns
  // to another. They are never drawn; they are seen only in what the flocks do.
  for (const hk of hawks) {
    if (!nb) break;
    const lost = hk.x < box.x0 || hk.y < box.y0 || hk.x >= box.x1 || hk.y >= box.y1;
    if (!hk.placed || lost || hk.prey >= nb || t >= hk.until) {
      hk.prey = Math.floor(Math.random() * nb); hk.until = t + 144 + Math.floor(Math.random() * 233);
      if (!hk.placed || lost) { hk.x = BX[hk.prey] + (Math.random() - 0.5) * 89; hk.y = BY[hk.prey] + (Math.random() - 0.5) * 89; hk.placed = true; }
    }
    const dx = BX[hk.prey] - hk.x, dy = BY[hk.prey] - hk.y, d = Math.hypot(dx, dy) || 1, hs = VMAX * PHI ** 0.5;
    hk.vx += ((dx / d) * hs - hk.vx) * PHI ** -4; hk.vy += ((dy / d) * hs - hk.vy) * PHI ** -4;
    hk.x += hk.vx; hk.y += hk.vy;
  }

  for (let k = 0; k < nb; k++) {
    const x = BX[k], y = BY[k];
    let ax = 0, ay = 0, cx0 = 0, cy0 = 0, sx = 0, sy = 0, wsum = 0, seen = 0;
    const bx = Math.floor(x / SEE) - gx0, by = Math.floor(y / SEE) - gy0;
    for (let gy = by - 1; gy <= by + 1 && seen < LOOK; gy++) {
      if (gy < 0 || gy >= GYn) continue;
      for (let gx = bx - 1; gx <= bx + 1 && seen < LOOK; gx++) {
        if (gx < 0 || gx >= GXn) continue;
        for (let o = head[gy * GXn + gx]; o !== -1 && seen < LOOK; o = next[o]) {
          if (o === k) continue;
          const dx = BX[o] - x, dy = BY[o] - y, d2 = dx * dx + dy * dy;
          if (d2 > SEE * SEE) continue;
          seen++;
          const w = BKIN[o] === BKIN[k] ? PHI : 1;                  // kin pull harder
          ax += BVX[o] * w; ay += BVY[o] * w; cx0 += dx * w; cy0 += dy * w; wsum += w;
          if (d2 < NEAR * NEAR) { const d = Math.sqrt(d2) || 0.1; sx -= dx / d / d; sy -= dy / d / d; }
        }
      }
    }
    let vx_ = BVX[k], vy_ = BVY[k];
    if (wsum) {
      vx_ += (ax / wsum - vx_) * PHI ** -2; vy_ += (ay / wsum - vy_) * PHI ** -2;    // alignment
      vx_ += (cx0 / wsum) * PHI ** -5; vy_ += (cy0 / wsum) * PHI ** -5;              // cohesion
    }
    vx_ += sx * PHI ** -1; vy_ += sy * PHI ** -1;                                      // separation
    const fx = x / CG - cgx0, fy = y / CG - cgy0, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, gk = iy * CGW + ix;
    const u = (curU[gk] * (1 - tx) + curU[gk + 1] * tx) * (1 - ty) + (curU[gk + CGW] * (1 - tx) + curU[gk + CGW + 1] * tx) * ty;   // the current,
    const v = (curV[gk] * (1 - tx) + curV[gk + 1] * tx) * (1 - ty) + (curV[gk + CGW] * (1 - tx) + curV[gk + CGW + 1] * tx) * ty;   // a thermal to ride
    vx_ += u * PHI ** -3 * 21; vy_ += v * PHI ** -3 * 21;
    let fled = false;                                                                   // fear
    for (const hk of hawks) {
      const dx = x - hk.x, dy = y - hk.y, d2 = dx * dx + dy * dy;
      if (d2 < FEAR * FEAR) { const d = Math.sqrt(d2) || 0.1, f = (1 - d / FEAR) * PHI; vx_ += (dx / d) * f; vy_ += (dy / d) * f; fled = true; }
    }
    for (const e of LIFE.eagles.list) {                                                 // and the eagle, farther off
      const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy, far = FEAR * PHI;
      if (d2 < far * far) { const d = Math.sqrt(d2) || 0.1, f = (1 - d / far) * PHI; vx_ += (dx / d) * f; vy_ += (dy / d) * f; fled = true; }
    }
    const d = dAt(x, y);                                                                // calm ground is land: turn back outward
    if (d < PHI ** -2) {
      const c = nearIsle(x, y), ox = x - c.x, oy = y - c.y, dist = Math.hypot(ox, oy) || 1, depthIn = (PHI ** -2 - d) / PHI ** -2;
      vx_ += (ox / dist) * depthIn * PHI ** -1; vy_ += (oy / dist) * depthIn * PHI ** -1;
    }
    const sp = Math.hypot(vx_, vy_) || 1, top = fled ? PANIC : VMAX;
    if (sp > top) { vx_ = (vx_ / sp) * top; vy_ = (vy_ / sp) * top; }
    else if (sp < VMIN) { vx_ = (vx_ / sp) * VMIN; vy_ = (vy_ / sp) * VMIN; }
    BVX[k] = vx_; BVY[k] = vy_; BX[k] = x + vx_; BY[k] = y + vy_;

    // Each bird is a short stroke along its heading.
    const f = selWork !== null && BKIN[k] !== selWork ? PHI ** -2 : 1;
    const r = BRGB[k * 3] * f, g = BRGB[k * 3 + 1] * f, b = BRGB[k * 3 + 2] * f, s = Math.hypot(vx_, vy_) || 1;
    for (let q = 0; q < 2; q++) {
      const px = Math.floor(BX[k] - (vx_ / s) * q) - tox, py = Math.floor(BY[k] - (vy_ / s) * q) - toy;
      if (px < 0 || py < 0 || px >= TW || py >= TH) continue;
      const j = (py * TW + px) * 4;
      trailPx[j] = r; trailPx[j + 1] = g; trailPx[j + 2] = b; trailPx[j + 3] = 255;
    }
  }
}

// ---- the forest's life ------------------------------------------------------------------------
// Life keeps to its niche. Each kind settles in the strata it lives in, and a creature is seen only
// where nothing taller stands over it: ants go under a shrub and come out the other side, and a
// butterfly passes beneath a canopy crown. Every creature wears the colours of a painting from the
// ground where it lives, all three of them, turned as the ground there is turned, and pointing at
// one names its painting.

const TAU = 2 * Math.PI, rnd = Math.random;
const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const chroma = (c) => Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
const lift = (c, k) => c.map((v) => v + (255 - v) * k);
const mixRGB = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const turnTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const dim = (c, k) => c.map((v) => v * k);
/** A colour made to stand out from the soil, as the forest's creatures do: phi^2 times as saturated, and lit. */
function pop(c) {
  const g = lum(c), s = c.map((v) => Math.max(0, Math.min(255, g + (v - g) * PHI * PHI)));
  const l = lum(s);
  return l >= 144 ? s : lift(s, (144 - l) / (255 - l));
}

/** A painting's colours as a creature wears them, turned as the ground where it lives is turned. */
function paletteOf(w, turn) {
  const cols = (TOKENS[w] || TOKENS[0]).map((c) => turnRGB(c[0], c[1], c[2], turn));
  const byL = [...cols].sort((a, b) => lum(a) - lum(b));
  return { w, cols, byL, dark: byL[0], mid: byL[byL.length >> 1], light: byL[byL.length - 1],
           vivid: [...cols].sort((a, b) => chroma(b) - chroma(a))[0],
           blue: [...cols].sort((a, b) => b[2] - b[0] - (a[2] - a[0]))[0] };
}

// The life layer: one pixel a cell over the ground, drawn afresh each frame. Each pixel remembers
// the painting its creature wears, for naming.
const lifeCv = document.createElement("canvas"), lifeCtx = lifeCv.getContext("2d");
let lifeImg = null, lifePx = null, lifeW = null, lifeS = null, lifeDirty = null, nDirty = 0;
let CUR_SP = -1;                                                // the species being drawn, where the Earth names one
function sizeLife() {
  lifeCv.width = TW; lifeCv.height = TH;
  lifeImg = lifeCtx.createImageData(TW, TH); lifePx = lifeImg.data;
  lifeW = new Int32Array(TW * TH).fill(-1); lifeS = new Int32Array(TW * TH).fill(-1); lifeDirty = new Int32Array(TW * TH); nDirty = 0;
}
function clearLife() {
  for (let d = 0; d < nDirty; d++) { const i = lifeDirty[d]; lifePx[i * 4 + 3] = 0; lifeW[i] = -1; lifeS[i] = -1; }
  nDirty = 0;
}
/** Lay a pixel of life at (x, y) with opacity a, over whatever life is there already. */
function put(x, y, rgb, a, w) {
  if (a * 255 < 1) return;
  const px = Math.floor(x) - tox, py = Math.floor(y) - toy;
  if (!(px >= 0 && py >= 0 && px < TW && py < TH)) return;
  const i = py * TW + px, j = i * 4, f = selWork !== null && w !== selWork ? PHI ** -2 : 1, da = lifePx[j + 3] / 255;
  if (a > 1) a = 1;
  if (!da) {
    lifeDirty[nDirty++] = i;
    lifePx[j] = rgb[0] * f; lifePx[j + 1] = rgb[1] * f; lifePx[j + 2] = rgb[2] * f; lifePx[j + 3] = a * 255;
  } else {
    const oa = a + da * (1 - a), k = a / oa;
    lifePx[j] += (rgb[0] * f - lifePx[j]) * k; lifePx[j + 1] += (rgb[1] * f - lifePx[j + 1]) * k; lifePx[j + 2] += (rgb[2] * f - lifePx[j + 2]) * k;
    lifePx[j + 3] = oa * 255;
  }
  if (a >= PHI ** -1 && w >= 0) lifeW[i] = w;
  if (a >= PHI ** -1 && CUR_SP >= 0) lifeS[i] = CUR_SP;
}
/** A shadow at (x, y) with depth a: it darkens the life drawn there, or else the ground. */
function shadowAt(x, y, a) {
  const px = Math.floor(x) - tox, py = Math.floor(y) - toy;
  if (!(px >= 0 && py >= 0 && px < TW && py < TH)) return;
  const i = py * TW + px, j = i * 4, da = lifePx[j + 3] / 255;
  if (!da) { lifeDirty[nDirty++] = i; lifePx[j] = lifePx[j + 1] = lifePx[j + 2] = 0; lifePx[j + 3] = a * 255; }
  else { lifePx[j] *= 1 - a; lifePx[j + 1] *= 1 - a; lifePx[j + 2] *= 1 - a; lifePx[j + 3] = (a + da * (1 - a)) * 255; }
}

let hlKey = NaN, hlArr = null;
/** The forest over a cell of grown ground: stratum << 6 | height in 63rds; 255 where none is grown. */
function forestAt(x, y) {
  const k = ck(Math.floor(x / N), Math.floor(y / N));
  if (k !== hlKey || !hlArr) { const c = chunks.get(k); hlArr = c ? c.hl : null; hlKey = k; }
  return hlArr ? hlArr[mod(Math.floor(y), N) * N + mod(Math.floor(x), N)] : 255;
}
const heightAt = (x, y) => (forestAt(x, y) & 63) / 63;
/** Is something at height z seen at (x, y)? Only where nothing stands taller over it. */
const seen = (x, y, z) => heightAt(x, y) <= z;
/** Is anything within r cells of (x, y) in view? */
const inView = (x, y, r) => x > vx - r && x < vx + VW + r && y > vy - r && y < vy + VH + r;
/** The painting under (x, y), where the ground is grown; otherwise -1. */
function workAt(x, y) {
  const c = chunks.get(ck(Math.floor(x / N), Math.floor(y / N)));
  return c ? c.work[mod(Math.floor(y), N) * N + mod(Math.floor(x), N)] : -1;
}
/** The canopy or emergent crown standing highest over (x, y), if any. */
function crownUnder(x, y) {
  let best = null, bh = 0;
  for (const L of [1, 2]) for (const c of crownsNear(L, x, y, STRATA[L].r * PHI)) {
    const h = crownHeight(c, x, y);
    if (h > bh) { bh = h; best = c; }
  }
  return best;
}

// Heights creatures live at: on the floor, just above it, in the understory, above the canopy.
const ON_FLOOR = PHI ** -5, LOW = PHI ** -4, UNDER = PHI ** -2, HIGH = PHI ** -1 + PHI ** -4;
const LIFE = {};

// Leaf-cutter ants, on the forest floor. Trails run out from each nest to where the plants begin; the
// ants go out bare and come home each holding up a piece of a painting cut from where the trail ends.
LIFE.ants = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), trails = [], a0 = unitOf(s.seed) * TAU, n = s.seed & 1 ? 5 : 3;
    for (let t = 0; t < n; t++) {
      const a = a0 + t * GOLDEN_ANGLE, ca = Math.cos(a), sa = Math.sin(a);
      let reach = 0;
      for (let r = 13; r <= 144; r += 2) if (canopyAt(s.x + ca * r, s.y + sa * r) > 0) { reach = r + 3; break; }
      if (!reach) continue;
      // A meandering way, pinned at both ends.
      const p1 = rnd() * TAU, p2 = rnd() * TAU, amp = reach * PHI ** -3, pts = new Float32Array((reach + 1) * 2);
      for (let q = 0; q <= reach; q++) {
        const u = q / reach, bend = amp * Math.sin(Math.PI * u) * (Math.sin(TAU * u + p1) + PHI ** -1 * Math.sin(3 * Math.PI * u + p2));
        pts[q * 2] = s.x + ca * q - sa * bend; pts[q * 2 + 1] = s.y + sa * q + ca * bend;
      }
      const tx = pts[reach * 2], ty = pts[reach * 2 + 1], leaves = [];
      for (let q = 0; q < 5; q++) {
        const x = tx + (rnd() - 0.5) * 8, y = ty + (rnd() - 0.5) * 8, w = workAt(x, y);
        if (w < 0) continue;
        const L = paletteOf(w, turnAt(x, y, depth(x, y)));
        leaves.push({ c: pop(L.vivid), w }, { c: pop(L.light), w });
      }
      if (!leaves.length) leaves.push({ c: pop(P.vivid), w: P.w });
      const ants = [], many = Math.round(reach / PHI);        // a column: an ant every 1.6 cells or so
      for (let k = 0; k < many; k++) {
        const back = k & 1;
        ants.push({ s: ((k + rnd() * PHI ** -1) / many) * reach, dir: back ? -1 : 1, wait: 0, load: back ? leaves[k % leaves.length] : null });
      }
      trails.push({ pts, len: reach, ants, leaves });
    }
    return trails.length ? { x: s.x, y: s.y, P, body: dim(pop(P.dark), PHI ** -1), trails } : null;
  },
  step() {
    for (const n of this.list) for (const tr of n.trails) for (const a of tr.ants) {
      if (a.wait > 0) { a.wait--; continue; }
      a.s += a.dir * (a.load ? PHI ** -3 : PHI ** -2);
      if (a.s >= tr.len) { a.s = tr.len; a.dir = -1; a.load = tr.leaves[Math.floor(rnd() * tr.leaves.length)]; a.wait = 21 + rnd() * 34; }
      else if (a.s <= 0) { a.s = 0; a.dir = 1; a.load = null; a.wait = rnd() * 13; }
    }
  },
  draw() {
    for (const n of this.list) {
      if (!inView(n.x, n.y, 144)) continue;
      for (let k = 1; k < 13; k++) {                     // the nest: soil brought up from below
        const a = k * GOLDEN_ANGLE, r = PHI + Math.sqrt(k) * PHI;
        put(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r, n.P.light, PHI ** -1, n.P.w);
      }
      for (const tr of n.trails) for (const a of tr.ants) {
        const q = Math.min(tr.len - 1, Math.floor(a.s)), f = a.s - q, p = tr.pts;
        const x = p[q * 2] + (p[q * 2 + 2] - p[q * 2]) * f, y = p[q * 2 + 1] + (p[q * 2 + 3] - p[q * 2 + 1]) * f;
        if (!seen(x, y, ON_FLOOR)) continue;
        if (a.load) {
          const c = a.load.c, w = a.load.w;
          put(x, y, c, 1, w); put(x + 1, y, c, 1, w); put(x, y - 1, c, 1, w); put(x + 1, y - 1, c, 1, w);
        } else put(x, y, n.body, 1, n.P.w);
      }
    }
  },
};

// Slime mould, far out on the low ground under the canopy: 987 cells, each following the scent the
// others leave (Physarum, after Jeff Jones's model). It pours out of the brightest dots in its gap in
// thick, soft, luminous forms, like paint sprayed from a can, and keeps joining them up and reshaping.
LIFE.mould = {
  list: [],
  spawn(s) {
    const RP = 55, D = 2 * RP + 1, P = paletteOf(s.w, s.turn);
    return { s, x: s.x, y: s.y, x0: Math.floor(s.x) - RP, y0: Math.floor(s.y) - RP, D, wall: null, glow: lift(P.light, PHI ** -2), w: s.w, live: false };
  },
  /** Lay the patch out once the ground all round it has grown: walls wherever the canopy stands over it. */
  settle(m) {
    const { D, x0, y0, s } = m, RP = (D - 1) / 2;
    for (const [dx, dy] of [[0, 0], [D, 0], [0, D], [D, D]]) if (!chunks.has(ck(Math.floor((x0 + dx) / N), Math.floor((y0 + dy) / N)))) return false;
    const wall = new Uint8Array(D * D);
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const edge = RP * (1 - PHI ** -2 * vnoise(x0 + i, y0 + j, 13, 5));
      wall[j * D + i] = Math.hypot(i - RP, j - RP) >= edge || forestAt(x0 + i, y0 + j) >> 6 >= CANOPY ? 1 : 0;
    }
    const food = [];
    for (let f = 0; f < s.food.length; f += 2) {
      const i = Math.floor(s.food[f]) - x0, j = Math.floor(s.food[f + 1]) - y0;
      if (i >= 0 && j >= 0 && i < D && j < D && !wall[j * D + i]) food.push(j * D + i);
    }
    if (!food.length && !wall[RP * D + RP]) food.push(RP * D + RP);
    const A = food.length ? 987 : 0, ax = new Float32Array(A), ay = new Float32Array(A), ah = new Float32Array(A);
    for (let a = 0; a < A; a++) { const f = food[a % food.length]; ax[a] = (f % D) + rnd(); ay[a] = Math.floor(f / D) + rnd(); ah[a] = rnd() * TAU; }
    Object.assign(m, { wall, food, A, ax, ay, ah, trail: new Float32Array(D * D), tmp: new Float32Array(D * D) });
    return true;
  },
  step() {
    // Only the patches nearest the middle of the view grow, five at most.
    const mx = vx + VW / 2, my = vy + VH / 2, near = this.list
      .filter((m) => m.x > vx - 55 && m.x < vx + VW + 55 && m.y > vy - 55 && m.y < vy + VH + 55)
      .sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)).slice(0, 5);
    for (const m of this.list) m.live = near.includes(m) && (m.wall !== null || this.settle(m));
    for (const m of near) if (m.live) this.grow(m);
  },
  grow(m) {
    const { D, wall, trail, tmp, ax, ay, ah } = m, SO = 8, SA = GOLDEN_ANGLE / 3, RA = GOLDEN_ANGLE / 5, SS = PHI ** -1;
    const sense = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return i < 0 || j < 0 || i >= D || j >= D || wall[j * D + i] ? -1 : trail[j * D + i]; };
    for (let a = 0; a < m.A; a++) {
      const x = ax[a], y = ay[a];
      let h = ah[a];
      const F = sense(x + Math.cos(h) * SO, y + Math.sin(h) * SO);
      const L = sense(x + Math.cos(h - SA) * SO, y + Math.sin(h - SA) * SO), Rt = sense(x + Math.cos(h + SA) * SO, y + Math.sin(h + SA) * SO);
      if (F < L || F < Rt) h += F < L && F < Rt ? (rnd() < 0.5 ? -RA : RA) : L > Rt ? -RA : RA;
      const nx = x + Math.cos(h) * SS, ny = y + Math.sin(h) * SS, i = Math.floor(nx), j = Math.floor(ny);
      if (i < 0 || j < 0 || i >= D || j >= D || wall[j * D + i]) { ah[a] = rnd() * TAU; continue; }
      ax[a] = nx; ay[a] = ny; ah[a] = h; trail[j * D + i] += 1;
    }
    for (const f of m.food) trail[f] += PHI ** 3;
    // The scent spreads to the eight cells round each and fades.
    const keep = (1 - PHI ** -5) / 9;
    for (let j = 1; j < D - 1; j++) for (let i = 1; i < D - 1; i++) {
      const k = j * D + i;
      tmp[k] = wall[k] ? 0 : (trail[k - D - 1] + trail[k - D] + trail[k - D + 1] + trail[k - 1] + trail[k] + trail[k + 1] + trail[k + D - 1] + trail[k + D] + trail[k + D + 1]) * keep;
    }
    m.trail = tmp; m.tmp = trail;
  },
  draw() {
    // Solid where the scent is strong, and a speckle of overspray where it thins: spray paint.
    for (const m of this.list) {
      if (!m.live) continue;
      const { D, trail } = m;
      for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
        const v = trail[j * D + i];
        if (v < PHI ** -2) continue;
        const a = Math.min(1, v / PHI ** 4) ** PHI ** -1, x = m.x0 + i, y = m.y0 + j;
        if (a >= PHI ** -1) put(x, y, m.glow, a, m.w);
        else if (u3(x, y, 547) < a * PHI) put(x, y, m.glow, PHI ** -1, m.w);
      }
    }
  },
};

// Poison frogs on the floor. They sit, hop, and call, each frog holding its call back a little when
// a neighbour is about to call, so that they take turns.
LIFE.frogs = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), n = s.seed & 1 ? 5 : 3, frogs = [];
    for (let k = 0; k < n; k++) {
      const a = unitOf(s.seed + k) * TAU, r = PHI + k * PHI;
      frogs.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, fx: 0, fy: 0, tx: 0, ty: 0, hop: 0, wait: rnd() * 233, call: rnd(), voice: 0 });
    }
    return { x: s.x, y: s.y, P, frogs, skin: pop(P.vivid) };
  },
  step() {
    for (const g of this.list) for (const f of g.frogs) {
      if (f.hop) {
        f.hop += 1 / 8;
        if (f.hop >= 1) { f.hop = 0; f.x = f.tx; f.y = f.ty; f.wait = 34 + rnd() * 377; }
        else { f.x = f.fx + (f.tx - f.fx) * f.hop; f.y = f.fy + (f.ty - f.fy) * f.hop; }
      } else if (--f.wait <= 0) {
        f.wait = 21;
        for (let q = 0; q < 5; q++) {
          const a = rnd() * TAU, r = 5 + rnd() * 8, tx = f.x + Math.cos(a) * r, ty = f.y + Math.sin(a) * r;
          if (Math.hypot(tx - g.x, ty - g.y) > 21 || heightAt(tx, ty) > 0) continue;
          f.fx = f.x; f.fy = f.y; f.tx = tx; f.ty = ty; f.hop = PHI ** -8;
          break;
        }
      }
      f.call += 1 / 89;
      if (f.call >= 1) {
        f.call -= 1; f.voice = 1;
        for (const o of g.frogs) if (o !== f && o.call > 1 - PHI ** -3) o.call -= PHI ** -3;
      }
      f.voice = Math.max(0, f.voice - 1 / 21);
    }
  },
  draw() {
    for (const g of this.list) for (const f of g.frogs) {
      if (!inView(f.x, f.y, 8) || !seen(f.x, f.y, ON_FLOOR)) continue;
      const up = f.hop ? Math.sin(Math.PI * f.hop) : 0, w = g.P.w;
      if (up > PHI ** -2) {                                  // in the air: its shadow falls below and right
        const o = up * 3;
        shadowAt(f.x + o, f.y + o, PHI ** -2);
        put(f.x, f.y, g.skin, 1, w); put(f.x + 1, f.y, g.skin, 1, w); put(f.x, f.y + 1, g.skin, 1, w); put(f.x + 1, f.y + 1, g.P.dark, 1, w);
      } else {                                               // sitting: a body two cells square, legs tucked at its corners
        put(f.x, f.y, g.skin, 1, w); put(f.x + 1, f.y, g.skin, 1, w); put(f.x, f.y + 1, g.skin, 1, w); put(f.x + 1, f.y + 1, g.skin, 1, w);
        for (const [a, b] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) put(f.x + a, f.y + b, g.skin, PHI ** -1, w);
      }
      if (f.voice > 0) {                                     // the call carries out in a ring
        const r = (1 - f.voice) * 8;
        for (let k = 0; k < 13; k++) put(f.x + Math.cos((k * TAU) / 13) * r, f.y + Math.sin((k * TAU) / 13) * r, g.P.light, f.voice * PHI ** -2, w);
      }
    }
  },
};

// Ferns on the floor, their fronds unrolling from fiddleheads. A frond coils in a spiral that tightens
// toward its tip and unrolls from the base out, opening its leaflets as it goes; it stands a while,
// withers, and in time a new one comes.
const UNROLL = 987, STAND = 1597, WITHER = 144;
LIFE.ferns = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), n = s.seed & 1 ? 5 : 3, a0 = unitOf(s.seed) * TAU, fronds = [];
    for (let k = 0; k < n; k++)
      fronds.push({ a: a0 + k * GOLDEN_ANGLE, len: (s.seed >> (k + 1)) & 1 ? 21 : 13, side: (s.seed >> (k + 8)) & 1 ? 1 : -1,
                    age: REDUCED ? UNROLL : Math.floor(rnd() * (610 + UNROLL + STAND)) - 610 });   // anywhere in its life
    return { x: s.x, y: s.y, w: s.w, fronds, stem: pop(P.light), leaf: pop(P.vivid) };
  },
  step() { for (const g of this.list) for (const f of g.fronds) if (++f.age > UNROLL + STAND + WITHER) f.age = -Math.floor(rnd() * 987); },
  draw() {
    for (const g of this.list) for (const f of g.fronds) {
      if (f.age < 0 || !inView(g.x, g.y, 34)) continue;
      const u = Math.min(1, f.age / UNROLL), m = u * f.len, fade = f.age > UNROLL + STAND ? 1 - (f.age - UNROLL - STAND) / WITHER : 1;
      let x = g.x, y = g.y, th = f.a;
      for (let i = 0; i < f.len; i++) {
        th += f.side * (i < m ? PHI ** -5 : Math.min(GOLDEN_ANGLE / 4, PHI ** -5 * PHI ** ((i - m) / PHI)));
        x += Math.cos(th); y += Math.sin(th);
        if (!seen(x, y, LOW)) continue;
        put(x, y, g.stem, fade, g.w);
        if (i > 1 && i < m - 1 && i % 2 === 0) {           // leaflets open along what has unrolled
          const l = Math.max(1, Math.round((1 - i / f.len) * 3 * u)), nx = -Math.sin(th), ny = Math.cos(th);
          for (let q = 1; q <= l; q++) {
            put(x + nx * q, y + ny * q, g.leaf, fade * PHI ** -0.5, g.w);
            put(x - nx * q, y - ny * q, g.leaf, fade * PHI ** -0.5, g.w);
          }
        }
      }
    }
  },
};

// Coral snakes below the canopy, ringed in their painting's three colours, winding as they go.
LIFE.snakes = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), a = unitOf(s.seed) * TAU, black = dim(P.dark, PHI ** -2), bright = pop(P.vivid), pale = pop(P.light);
    // Coral rings: three of the painting's brightest colour, one pale, three near black, one pale.
    const rings = [bright, bright, bright, pale, black, black, black, pale];
    const path = [];
    for (let k = 0; k < 2 * 34; k++) path.push(s.x - (Math.cos(a) * k) / 2, s.y - (Math.sin(a) * k) / 2);
    return { hx: s.x, hy: s.y, x: s.x, y: s.y, base: a, th: a, wave: rnd() * TAU, path, moved: 0, rings, head: dim(P.dark, PHI ** -1), tongue: 0, tip: pop(P.vivid), w: s.w };
  },
  step() {
    for (const k of this.list) {
      k.wave += TAU / 55;
      k.base += (rnd() - 0.5) * PHI ** -4;
      const dx = k.hx - k.x, dy = k.hy - k.y;
      if (dx * dx + dy * dy > 55 * 55) k.base += turnTo(k.base, Math.atan2(dy, dx)) * PHI ** -5;
      k.th = k.base + Math.sin(k.wave) * PHI ** -1;
      const v = PHI ** -3;
      k.x += Math.cos(k.th) * v; k.y += Math.sin(k.th) * v; k.moved += v;
      if (k.moved >= 0.5) { k.moved -= 0.5; k.path.unshift(k.x, k.y); k.path.length = 2 * 2 * 34; }
      if (k.tongue > 0) k.tongue--;
      else if (rnd() < PHI ** -8) k.tongue = 8;
    }
  },
  draw() {
    for (const k of this.list) {
      if (!inView(k.x, k.y, 34)) continue;
      for (let s = 33; s >= 0; s--) {                        // tail to head, two cells thick, tapering at the tail
        const x = k.path[s * 4], y = k.path[s * 4 + 1], c = s ? k.rings[s % k.rings.length] : k.head;
        if (!seen(x, y, UNDER)) continue;
        const nx = k.path[s * 4 + 1] - k.path[s * 4 + 5], ny = k.path[s * 4 + 4] - k.path[s * 4], l = Math.hypot(nx, ny) || 1;
        put(x, y, c, 1, k.w);
        if (s < 29) put(x + nx / l, y + ny / l, c, 1, k.w);
      }
      if (k.tongue > 4) for (let q = 1; q <= 2; q++) {
        const x = k.x + Math.cos(k.th) * q, y = k.y + Math.sin(k.th) * q;
        if (seen(x, y, UNDER)) put(x, y, k.tip, PHI ** -1, k.w);
      }
    }
  },
};

// Fireflies among the shrubs, far enough out. Each flashes by its own clock; a flash nudges the
// fireflies near it on toward their own, so flashes gather into waves that sweep the swarm, and at
// times much of it flashes as one (pulse-coupled oscillators, after Mirollo and Strogatz).
LIFE.fireflies = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), fl = [];
    for (let k = 0; k < 144; k++) {
      const r = 34 * Math.sqrt(rnd()), a = rnd() * TAU, x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r;
      fl.push({ x, y, hx: x, hy: y, vx: 0, vy: 0, p: rnd(), T: 55 * PHI ** ((rnd() - 0.5) * PHI ** -3), glow: 0 });
    }
    return { x: s.x, y: s.y, fl, glow: lift(pop(P.vivid), PHI ** -1), w: s.w };
  },
  step() {
    for (const sw of this.list) {
      const fl = sw.fl, lit = [];
      for (const f of fl) {
        f.p += 1 / f.T;
        if (f.p >= 1) { f.p = 0; f.glow = 1; lit.push(f); }
        else f.glow *= 1 - PHI ** -4;
        if (rnd() < PHI ** -13) f.p = rnd();                  // now and then one loses the beat
        f.vx = f.vx * (1 - PHI ** -3) + (rnd() - 0.5) * PHI ** -5 + (f.hx - f.x) * PHI ** -10;
        f.vy = f.vy * (1 - PHI ** -3) + (rnd() - 0.5) * PHI ** -5 + (f.hy - f.y) * PHI ** -10;
        f.x += f.vx; f.y += f.vy;
      }
      while (lit.length) {
        const f = lit.pop();
        for (const o of fl) {
          if (o.p < PHI ** -2) continue;                      // too soon after its own flash to be moved
          const dx = o.x - f.x, dy = o.y - f.y;
          if (dx * dx + dy * dy > 13 * 13) continue;
          o.p += PHI ** -5;
          if (o.p >= 1) { o.p = 0; o.glow = 1; lit.push(o); }
        }
      }
    }
  },
  draw() {
    for (const sw of this.list) {
      if (!inView(sw.x, sw.y, 55)) continue;
      for (const f of sw.fl) {
      if (f.glow < PHI ** -5 || !seen(f.x, f.y, UNDER)) continue;
      const h = f.glow * PHI ** -1, e = f.glow * PHI ** -3;
      put(f.x, f.y, sw.glow, f.glow, sw.w);
      put(f.x + 1, f.y, sw.glow, h, sw.w); put(f.x - 1, f.y, sw.glow, h, sw.w); put(f.x, f.y + 1, sw.glow, h, sw.w); put(f.x, f.y - 1, sw.glow, h, sw.w);
      put(f.x + 1, f.y + 1, sw.glow, e, sw.w); put(f.x - 1, f.y - 1, sw.glow, e, sw.w); put(f.x - 1, f.y + 1, sw.glow, e, sw.w); put(f.x + 1, f.y - 1, sw.glow, e, sw.w);
      put(f.x + 2, f.y, sw.glow, e, sw.w); put(f.x - 2, f.y, sw.glow, e, sw.w); put(f.x, f.y + 2, sw.glow, e, sw.w); put(f.x, f.y - 2, sw.glow, e, sw.w);
      }
    }
  },
};

// Morpho butterflies in the understory: an erratic, bobbing flight, flashing the painting's bluest
// colour each time the wings open and showing only their dark undersides as they close.
LIFE.morphos = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), bs = [];
    for (let k = 0; k <= s.seed % 3; k++) bs.push({ x: s.x + (rnd() - 0.5) * 13, y: s.y + (rnd() - 0.5) * 13, th: rnd() * TAU, om: 0, flap: rnd() * TAU });
    return { x: s.x, y: s.y, bs, open: pop(P.blue), shut: dim(P.dark, PHI ** -1), under: P.mid, w: s.w };
  },
  step() {
    for (const g of this.list) for (const b of g.bs) {
      b.om = b.om * (1 - PHI ** -3) + (rnd() - 0.5) * PHI ** -3;
      const dx = g.x - b.x, dy = g.y - b.y;
      if (dx * dx + dy * dy > 89 * 89) b.om += turnTo(b.th, Math.atan2(dy, dx)) * PHI ** -5;
      b.th += b.om; b.flap += TAU / 8;
      const v = PHI ** -1 * (1 + PHI ** -1 * Math.sin(b.flap));
      b.x += Math.cos(b.th) * v; b.y += Math.sin(b.th) * v;
    }
  },
  draw() {
    for (const g of this.list) for (const b of g.bs) {
      if (!inView(b.x, b.y, 5) || !seen(b.x, b.y, UNDER)) continue;
      const open = Math.sin(b.flap), fx = Math.cos(b.th), fy = Math.sin(b.th), nx = -fy, ny = fx;
      for (let q = -1; q <= 1; q++) put(b.x + fx * q, b.y + fy * q, g.shut, 1, g.w);       // the body
      if (open > 0) {
        const a = PHI ** -1 + (1 - PHI ** -1) * open;
        for (const side of [-1, 1]) for (let q = 1; q <= 4; q++) {
          put(b.x + nx * q * side + fx * PHI ** -1, b.y + ny * q * side + fy * PHI ** -1, g.open, a, g.w);          // forewings
          put(b.x + nx * q * side + fx * PHI ** -1 * 2.5, b.y + ny * q * side + fy * PHI ** -1 * 2.5, g.open, q < 4 ? a : 0, g.w);
          if (q < 4) put(b.x + nx * q * side - fx, b.y + ny * q * side - fy, g.open, a * PHI ** -0.5, g.w);         // hindwings
        }
      } else for (const side of [-1, 1]) for (let q = 1; q <= 2; q++) put(b.x + nx * q * side, b.y + ny * q * side, g.under, PHI ** -1, g.w);
    }
  },
};

// Wind over the canopy: gusts cross the treetops in bands, and where one passes, the leaves turn up
// their pale undersides, as Cecropia leaves flash silver.
LIFE.wind = {
  list: [],
  draw(t) {
    const a = PHI + PHI ** -2 * Math.sin((t * TAU) / 1597), ca = Math.cos(a), sa = Math.sin(a), v = PHI, lam = 233, col = [0, 0, 0];
    for (const c of chunks.values()) {
      if (!c.glints.length || (c.i + 1) * N < vx || c.i * N > vx + VW || (c.j + 1) * N < vy || c.j * N > vy + VH) continue;
      const g = c.glints;
      for (let o = 0; o < g.length; o += 6) {
        const x = g[o], y = g[o + 1], along = (x * ca + y * sa - t * v) / lam, ph = along - Math.floor(along);
        if (ph > PHI ** -3) continue;
        const f = Math.sin((Math.PI * ph) / PHI ** -3) * smooth(PHI ** -2, 1, vnoise(x - t * v * ca, y - t * v * sa, 89, 5));
        if (f < PHI ** -4) continue;
        col[0] = g[o + 2]; col[1] = g[o + 3]; col[2] = g[o + 4];
        put(x, y, col, f, g[o + 5]);
      }
    }
  },
};

// Flowers opening on the crowns of shrubs and trees, their florets set by the golden angle as a
// sunflower's are, in the painting's three colours from a dark heart to a bright rim. They open,
// stand, drop their florets from the rim in, rest, and open again.
const OPEN = 233, BLOOM = 1597, DROP = 144;
LIFE.blooms = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn), n = [55, 89, 144][s.seed % 3], th = unitOf(s.seed) * TAU;
    const heart = P.byL[0], mid = pop(P.byL[P.byL.length >> 1]), rim = pop(P.byL[P.byL.length - 1]);
    const at = new Float32Array(n * 2), col = [];
    for (let k = 0; k < n; k++) {
      const u = k / n, r = PHI * Math.sqrt(k), a = k * GOLDEN_ANGLE + th;
      at[k * 2] = s.x + Math.cos(a) * r; at[k * 2 + 1] = s.y + Math.sin(a) * r;
      col.push(u < 0.5 ? mixRGB(heart, mid, u * 2) : mixRGB(mid, rim, u * 2 - 1));
    }
    return { x: s.x, y: s.y, z: s.h + PHI ** -5, n, at, col, w: s.w, age: REDUCED ? OPEN : Math.floor(rnd() * (987 + OPEN + BLOOM)) - 987 };
  },
  step() { for (const b of this.list) if (++b.age > OPEN + BLOOM + DROP) b.age = -Math.floor(610 + rnd() * 987); },
  isOpen: (b) => b.age > OPEN / PHI && b.age < OPEN + BLOOM,
  draw() {
    for (const b of this.list) {
      if (b.age <= 0 || !inView(b.x, b.y, 21)) continue;
      const shown = b.n * Math.min(1, b.age / OPEN), kept = b.age > OPEN + BLOOM ? b.n * (1 - (b.age - OPEN - BLOOM) / DROP) : b.n;
      for (let k = 0; k < Math.min(shown, kept); k++) {
        const x = b.at[k * 2], y = b.at[k * 2 + 1];
        if (seen(x, y, b.z)) put(x, y, b.col[k], Math.min(1, shown - k), b.w);
      }
    }
  },
};

// Hummingbirds, which hover at the open flowers in a small figure of eight and dart between them.
LIFE.hummers = {
  list: [],
  spawn(s) {
    const P = paletteOf(s.w, s.turn);
    return { x: s.x, y: s.y, hx: s.x, hy: s.y, ax: s.x, ay: s.y, bx: s.x, by: s.y, th: rnd() * TAU, dart: 0, len: 1, wait: 34, at: null,
             body: pop(P.vivid), beak: dim(P.dark, PHI ** -1), w: s.w };
  },
  step(t) {
    const open = LIFE.blooms.list.filter(LIFE.blooms.isOpen);
    for (const h of this.list) {
      if (h.dart) {
        h.dart = Math.min(1, h.dart + PHI ** 2 / h.len);
        const u = h.dart, e = u * u * (3 - 2 * u), bend = Math.sin(Math.PI * u) * h.len * PHI ** -4, dx = (h.bx - h.ax) / h.len, dy = (h.by - h.ay) / h.len;
        h.x = h.ax + (h.bx - h.ax) * e - dy * bend; h.y = h.ay + (h.by - h.ay) * e + dx * bend;
        if (u >= 1) { h.dart = 0; h.wait = 34 + rnd() * 89; if (h.at) h.th = Math.atan2(h.at.y - h.by, h.at.x - h.bx); }
        continue;
      }
      h.x = h.bx + Math.sin(t * PHI ** -1) * PHI ** -1; h.y = h.by + Math.sin(t * PHI ** -1 * 2) * PHI ** -2;
      if (--h.wait > 0) continue;
      const near = open.filter((b) => b !== h.at && Math.hypot(b.x - h.x, b.y - h.y) < 233);
      let tx, ty;
      h.at = near.length ? near[Math.floor(rnd() * near.length)] : null;
      if (h.at) { const a = rnd() * TAU, r = PHI * Math.sqrt(h.at.n) + 2; tx = h.at.x + Math.cos(a) * r; ty = h.at.y + Math.sin(a) * r; }
      else { const a = rnd() * TAU; tx = h.hx + Math.cos(a) * 21; ty = h.hy + Math.sin(a) * 21; }
      h.ax = h.x; h.ay = h.y; h.bx = tx; h.by = ty; h.len = Math.max(1, Math.hypot(tx - h.x, ty - h.y));
      h.th = Math.atan2(ty - h.y, tx - h.x); h.dart = PHI ** -8;
    }
  },
  draw(t) {
    for (const h of this.list) {
      if (!seen(h.x, h.y, HIGH)) continue;
      const c = Math.cos(h.th), s = Math.sin(h.th);
      if (h.dart) for (let q = 1; q <= 5; q++) put(h.x - c * q * PHI, h.y - s * q * PHI, h.body, PHI ** -q, h.w);
      put(h.x, h.y, h.body, 1, h.w); put(h.x + c, h.y + s, h.beak, 1, h.w); put(h.x + 2 * c, h.y + 2 * s, h.beak, PHI ** -1, h.w);
      if (t & 1) { put(h.x - s, h.y + c, h.body, PHI ** -1, h.w); put(h.x + s, h.y - c, h.body, PHI ** -1, h.w); }
    }
  },
};

// Monkeys in the canopy, bright as golden tamarins. A troop follows its leader across the crowns: it
// feeds a while on each crown, spread about it, then crosses to the next, leaping the gap one after
// another, each seen apart from its shadow for the length of the leap.
const LAG = 8;
LIFE.troops = {
  list: [],
  spawn(s) {
    const crown = crownUnder(s.x, s.y);
    if (!crown) return null;
    const P = paletteOf(s.w, s.turn), n = [5, 8, 13][s.seed % 3];
    return { n, crown, x: s.x, y: s.y, up: 0, hx: s.x, hy: s.y, state: "feed", timer: 55, gx: s.x, gy: s.y, next: null,
             lx: 0, ly: 0, ltx: 0, lty: 0, u: 0, dur: 1, rise: 0, been: [crown], way: [], fur: pop(P.vivid), face: dim(P.dark, PHI ** -1), w: s.w };
  },
  step() {
    for (const tr of this.list) {
      const c = tr.crown;
      if (tr.state === "feed") {
        if (Math.hypot(tr.gx - tr.x, tr.gy - tr.y) < 1) {
          const a = rnd() * TAU, r = c.r * PHI ** -1 * Math.sqrt(rnd());
          tr.gx = c.x + Math.cos(a) * r; tr.gy = c.y + Math.sin(a) * r;
        }
        this.walk(tr, tr.gx, tr.gy, PHI ** -3);
        if (--tr.timer <= 0) {
          const far = Math.hypot(tr.x - tr.hx, tr.y - tr.hy) > 377;
          let opts = [];
          for (const L of [1, 2]) for (const o of crownsNear(L, c.x, c.y, c.r + 89)) {
            const d = Math.hypot(o.x - c.x, o.y - c.y);
            if (o !== c && d - o.r - c.r <= 13 && !tr.been.includes(o)) opts.push(o);
          }
          if (far && opts.length) opts = [opts.reduce((a, b) => (Math.hypot(a.x - tr.hx, a.y - tr.hy) < Math.hypot(b.x - tr.hx, b.y - tr.hy) ? a : b))];
          if (!opts.length) { tr.timer = 89; tr.been = [c]; continue; }
          const o = opts[Math.floor(rnd() * opts.length)], d = Math.hypot(o.x - c.x, o.y - c.y), ux = (o.x - c.x) / d, uy = (o.y - c.y) / d;
          tr.next = o; tr.state = "walk";
          tr.gx = c.x + ux * (c.r - 2); tr.gy = c.y + uy * (c.r - 2);
          tr.ltx = o.x - ux * (o.r - 2); tr.lty = o.y - uy * (o.r - 2);
        }
      } else if (tr.state === "walk") {
        if (this.walk(tr, tr.gx, tr.gy, PHI ** -2)) {
          tr.state = "leap"; tr.lx = tr.x; tr.ly = tr.y; tr.u = 0;
          const gap = Math.hypot(tr.ltx - tr.x, tr.lty - tr.y);
          tr.dur = Math.max(8, gap * PHI ** -1); tr.rise = gap * PHI ** -2 + 2;
        }
      } else {
        tr.u = Math.min(1, tr.u + 1 / tr.dur);
        tr.x = tr.lx + (tr.ltx - tr.lx) * tr.u; tr.y = tr.ly + (tr.lty - tr.ly) * tr.u; tr.up = Math.sin(Math.PI * tr.u) * tr.rise;
        if (tr.u >= 1) {
          tr.up = 0; tr.crown = tr.next; tr.state = "feed"; tr.timer = 89 + rnd() * 377; tr.gx = tr.x; tr.gy = tr.y;
          tr.been.push(tr.next); if (tr.been.length > 5) tr.been.shift();
        }
      }
      tr.way.push(tr.x, tr.y, tr.up);
      if (tr.way.length > 3 * (tr.n * LAG + 1)) tr.way.splice(0, 3);
    }
  },
  walk(tr, gx, gy, v) {
    const dx = gx - tr.x, dy = gy - tr.y, d = Math.hypot(dx, dy);
    if (d <= v) { tr.x = gx; tr.y = gy; return true; }
    tr.x += (dx / d) * v; tr.y += (dy / d) * v;
    return false;
  },
  draw(t) {
    for (const tr of this.list) {
      const z = tr.crown.top + PHI ** -5, W = tr.way;
      for (let k = 0; k < tr.n; k++) {
        const o = W.length - 3 * (1 + k * LAG);
        if (o < 0) break;
        let x = W[o], y = W[o + 1];
        const up = W[o + 2];
        if (k && !up) { const a = k * GOLDEN_ANGLE, r = PHI * Math.sqrt(k); x += Math.cos(a) * r; y += Math.sin(a) * r; }  // spread about
        if (!seen(x, y, z + up / TALL)) continue;
        if (up > 1) {
          shadowAt(x + up / PHI, y + up / PHI, PHI ** -2); shadowAt(x + 1 + up / PHI, y + up / PHI, PHI ** -2);
          put(x - 1, y, tr.fur, 1, tr.w); put(x + 1, y, tr.fur, 1, tr.w); put(x, y - 1, tr.fur, 1, tr.w);   // limbs flung wide
        }
        put(x, y, tr.fur, 1, tr.w); put(x + 1, y, tr.fur, 1, tr.w); put(x, y + 1, tr.fur, 1, tr.w); put(x + 1, y + 1, tr.fur, 1, tr.w);
        put(x + 2, y, tr.face, 1, tr.w);
        const curl = Math.sin(t / 13 + k);                    // the tail
        put(x - 1, y + 1 + curl, tr.fur, PHI ** -1, tr.w); put(x - 2, y + 2 + curl, tr.fur, PHI ** -2, tr.w);
      }
    }
  },
};

// Macaws above the emergents: now and then a pair crosses from one emergent to another, side by side
// with long tails streaming, their shadows racing over the crowns below.
LIFE.macaws = {
  list: [],
  wait: 377,
  step() {
    if (--this.wait <= 0) {
      this.wait = 89;                                         // try again soon unless a pair sets off
      const em = crownsNear(2, vx + VW / 2, vy + VH / 2, Math.max(VW, VH)).filter((c) => workAt(c.x, c.y) >= 0);
      if (em.length > 1) {
        const a = em[Math.floor(rnd() * em.length)];
        let b = null, bd = 0;
        for (const c of em) { const d = Math.hypot(c.x - a.x, c.y - a.y); if (d > bd) { bd = d; b = c; } }
        const w = workAt(a.x, a.y);
        if (bd > 233 && w >= 0) {
          this.wait = 610 + rnd() * 1597;
          const P = paletteOf(w, turnAt(a.x, a.y, depth(a.x, a.y))), byC = [...P.cols].sort((p, q) => chroma(q) - chroma(p));
          this.list.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len: bd, u: 0, flap: rnd() * TAU,
                           body: pop(byC[0]), tail: pop(byC[1] || byC[0]), w });
        }
      }
    }
    for (const m of this.list) { m.u += PHI ** 2 / m.len; m.flap += TAU / 13; }
    this.list = this.list.filter((m) => m.u < 1);
  },
  draw() {
    for (const m of this.list) {
      const dx = (m.bx - m.ax) / m.len, dy = (m.by - m.ay) / m.len, weave = Math.sin((m.u * m.len) / 34) * 3;
      for (const side of [-1, 1]) {
        const x = m.ax + (m.bx - m.ax) * m.u - dy * (side * 5 + weave), y = m.ay + (m.by - m.ay) * m.u + dx * (side * 5 + weave);
        for (let q = 0; q < 5; q++) shadowAt(x + 13 - dx * q, y + 13 - dy * q, PHI ** -2);
        for (let q = 0; q < 3; q++) put(x - dx * q, y - dy * q, m.body, 1, m.w);
        for (let q = 3; q < 8; q++) put(x - dx * q, y - dy * q, m.tail, 1 - (q - 3) * PHI ** -3, m.w);   // the long tail
        const wing = Math.sin(m.flap + side);
        if (wing > 0) for (let q = 1; q <= 3; q++) {
          put(x - dx - dy * q, y - dy + dx * q, m.body, wing, m.w); put(x - dx + dy * q, y - dy - dx * q, m.body, wing, m.w);
        }
      }
    }
  },
};

// A harpy eagle circling high over the emergents. It is never seen, only its shadow crossing the
// forest, and the flocks scatter from it.
function eagleShape(u, v) {
  const av = Math.abs(v);
  if (av <= 1 && u >= -5 && u <= 3) return true;                                   // body and head
  if (u < -5 && u >= -8 && av <= 1 + (-5 - u) * PHI ** -1) return true;            // the tail, fanned
  if (av > 21 / 2) return false;
  const lead = PHI - av * PHI ** -3, chord = 3 * (1 - (av / 21) * PHI ** -1 * 2); // wings swept a little back
  return u <= lead && u >= lead - chord;
}
LIFE.eagles = {
  list: [],
  wait: 144,
  step() {
    // It keeps near the viewer: when its tree falls out of the view, it glides to an emergent in view.
    const mx = vx + VW / 2, my = vy + VH / 2, reach = Math.max(VW, VH) / 2;
    this.list = this.list.filter((e) => Math.hypot(e.x - mx, e.y - my) < 1597);
    if (!this.list.length && --this.wait <= 0) {
      this.wait = 89;
      const em = crownsNear(2, mx, my, reach);
      if (em.length) {
        const c = em[Math.floor(rnd() * em.length)], a = rnd() * TAU;
        this.list.push({ c, x: c.x + Math.cos(a) * 610, y: c.y + Math.sin(a) * 610, th: a + Math.PI, ang: 0, rad: 55 + rnd() * 34, glide: true, timer: 987 + rnd() * 1597 });
      }
    }
    for (const e of this.list) {
      if (!e.glide && Math.hypot(e.c.x - mx, e.c.y - my) > reach) {
        const em = crownsNear(2, mx, my, reach);
        if (em.length) { e.c = em[Math.floor(rnd() * em.length)]; e.glide = true; }
      }
      if (e.glide) {
        e.th += turnTo(e.th, Math.atan2(e.c.y - e.y, e.c.x - e.x)) * PHI ** -4;
        if (Math.hypot(e.c.x - e.x, e.c.y - e.y) < e.rad) { e.glide = false; e.ang = Math.atan2(e.y - e.c.y, e.x - e.c.x); }
      } else {
        e.ang += PHI / e.rad;
        e.th += turnTo(e.th, Math.atan2(e.c.y + Math.sin(e.ang) * e.rad - e.y, e.c.x + Math.cos(e.ang) * e.rad - e.x)) * PHI ** -3;
        if (--e.timer <= 0) {
          const em = crownsNear(2, mx, my, 610).filter((c) => c !== e.c);
          if (em.length) { e.c = em[Math.floor(rnd() * em.length)]; e.glide = true; }
          e.timer = 987 + rnd() * 1597;
        }
      }
      e.x += Math.cos(e.th) * PHI; e.y += Math.sin(e.th) * PHI;
    }
  },
  draw() {
    for (const e of this.list) {
      const sx = e.x + 34, sy = e.y + 34, c = Math.cos(e.th), s = Math.sin(e.th);   // the shadow falls to the lower right
      for (let y = -21; y <= 21; y++) for (let x = -21; x <= 21; x++)                 // its wings span 34 cells
        if (eagleShape((x * c + y * s) / PHI, (-x * s + y * c) / PHI)) shadowAt(sx + x, sy + y, 1 - PHI ** -3);
    }
  },
};

const LIFE_ORDER = ["mould", "ants", "frogs", "ferns", "snakes", "fireflies", "morphos", "wind", "blooms", "troops", "hummers", "macaws", "eagles"];
const STILL = new Set(["blooms", "ferns"]);                     // with reduced motion: only plants, full grown
function spawnLife(c) {
  for (const s of c.sites) {
    const g = LIFE[s.kind];
    if (!g || (REDUCED && !STILL.has(s.kind))) continue;
    const o = g.spawn(s);
    if (o) { o.home = c.id; g.list.push(o); }
  }
}
function despawnLife(c) {
  for (const k of LIFE_ORDER) { const g = LIFE[k]; if (g.list.length && g.spawn) g.list = g.list.filter((o) => o.home !== c.id); }
}
/** Move the forest's life on a frame and draw it into the life layer. */
function live(t) {
  clearLife();
  for (const k of LIFE_ORDER) {
    const g = LIFE[k];
    if (!REDUCED && g.step) g.step(t);
    if (!REDUCED || STILL.has(k)) g.draw(t);
  }
}

// ---- drawing ----------------------------------------------------------------------------------

let selWork = null;
function shadeOf(c) {
  if (c.shadeSel !== selWork) {
    if (!c.shade) { c.shade = document.createElement("canvas"); c.shade.width = c.shade.height = N; }
    const g = c.shade.getContext("2d"), im = g.createImageData(N, N), a = Math.round(255 / PHI);
    for (let i = 0; i < N * N; i++) {
      if (c.work[i] === selWork) continue;
      const j = i * 4;
      im.data[j] = VEIL[0]; im.data[j + 1] = VEIL[1]; im.data[j + 2] = VEIL[2]; im.data[j + 3] = a;
    }
    g.putImageData(im, 0, 0);
    c.shadeSel = selWork;
  }
  return c.shade;
}

let down = null;
function frame(now) {
  requestAnimationFrame(frame);
  if (!placed) return;
  if (!down && (velX || velY)) {                                 // a swipe glides on after letting go
    vx += velX; vy += velY; velX *= GLIDE; velY *= GLIDE;
    if (Math.abs(velX) < 0.02 && Math.abs(velY) < 0.02) velX = velY = 0;
  }
  const list = wanted();
  tend(list);
  cx.globalAlpha = 1;
  if (GLG) { GLG.draw(now); cx.clearRect(0, 0, cv.width, cv.height); }   // the ground is painted under this canvas
  else { cx.fillStyle = `rgb(${GROUND})`; cx.fillRect(0, 0, cv.width, cv.height); }
  cx.imageSmoothingEnabled = false;
  const T = N * R;
  for (const w of list) {
    const c = chunks.get(w.k);
    if (!c) continue;
    const px = Math.round((c.i * N - vx) * R), py = Math.round((c.j * N - vy) * R);
    if (px >= cv.width || py >= cv.height || px + T <= 0 || py + T <= 0) continue;
    if (c.canvas) {
      const fade = REDUCED ? 1 : Math.min(1, (now - c.born) / FADE);       // new ground comes in
      if (c.prev) { if (fade < 1) cx.drawImage(c.prev, px, py); else c.prev = null; }   // over the old, when there was one
      cx.globalAlpha = fade;
      cx.drawImage(c.canvas, px, py);
    }
    if (selWork !== null) cx.drawImage(shadeOf(c), px, py, T, T);
  }
  cx.globalAlpha = 1;
  shiftTrail(Math.floor(vx), Math.floor(vy));
  live(tick);
  if (nDirty) {
    lifeCtx.putImageData(lifeImg, 0, 0);
    cx.drawImage(lifeCv, Math.round((tox - vx) * R), Math.round((toy - vy) * R), TW * R, TH * R);
  }
  if (nb) {
    flow(tick, list.box);
    trailCtx.putImageData(trailImg, 0, 0);
    cx.drawImage(trailCv, Math.round((tox - vx) * R), Math.round((toy - vy) * R), TW * R, TH * R);
  }
  tick++;
}
requestAnimationFrame(frame);

// ---- moving, pointing and picking out ---------------------------------------------------------
// Dragging moves through the plane, and a swipe glides on. Pointing names the painting underneath.
// A click or tap that does not move picks a painting out, darkening everything else; clicking it
// again, pressing Escape or "Show all" lets it go.

const cellsPerCss = () => cv.width / cv.getBoundingClientRect().width / R;
function worldAt(clientX, clientY) {
  const r = cv.getBoundingClientRect(), s = cv.width / r.width / R;
  return [vx + (clientX - r.left) * s, vy + (clientY - r.top) * s];
}
function birdAt(x, y) {
  let best = -1, bd = 2.25;
  for (let k = 0; k < nb; k++) { const dx = BX[k] - x, dy = BY[k] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
  return best;
}
function workUnder(clientX, clientY) {
  const [x, y] = worldAt(clientX, clientY), b = birdAt(x, y);
  if (b >= 0) return BKIN[b];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {        // a creature within a cell
    const lx = Math.floor(x) + dx - tox, ly = Math.floor(y) + dy - toy;
    if (lifeW && lx >= 0 && ly >= 0 && lx < TW && ly < TH && lifeW[ly * TW + lx] >= 0) return lifeW[ly * TW + lx];
  }
  const c = chunks.get(ck(Math.floor(x / N), Math.floor(y / N)));
  return c ? c.work[mod(Math.floor(y), N) * N + mod(Math.floor(x), N)] : -1;
}

let shown = -1, hoverPending = null;
function name(wi) {
  shown = wi;
  const w = PL.works[wi];
  document.getElementById("c-title").textContent = w.title || "Untitled";
  document.getElementById("c-who").textContent = [w.artist, w.date].filter(Boolean).join(", ");
  document.getElementById("c-link").replaceChildren(Object.assign(document.createElement("a"), { href: w.url, target: "_blank", rel: "noopener", textContent: "See it on Artsy" }));
}
function pickOut(wi) { selWork = wi; name(wi); showAll.hidden = false; }
function letGo() { selWork = null; showAll.hidden = true; }

cv.addEventListener("pointerdown", (ev) => {
  if (ev.button > 0) return;
  cv.setPointerCapture(ev.pointerId);
  down = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, lt: ev.timeStamp, moved: false };
  velX = velY = 0;
});
cv.addEventListener("pointermove", (ev) => {
  if (down && ev.pointerId === down.id) {
    const dx = ev.clientX - down.lx, dy = ev.clientY - down.ly, dt = Math.max(1, ev.timeStamp - down.lt);
    down.lx = ev.clientX; down.ly = ev.clientY; down.lt = ev.timeStamp;
    if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) { down.moved = true; cv.classList.add("dragging"); }
    if (down.moved) {
      const s = cellsPerCss(), k = PHI ** -1;
      vx -= dx * s; vy -= dy * s;
      velX = velX * (1 - k) + ((-dx * s * 16.7) / dt) * k;       // the hand's speed, in cells a frame
      velY = velY * (1 - k) + ((-dy * s * 16.7) / dt) * k;
    }
    return;
  }
  if (ev.pointerType !== "mouse" || selWork !== null || hoverPending !== null) return;
  const cxp = ev.clientX, cyp = ev.clientY;
  hoverPending = requestAnimationFrame(() => {
    hoverPending = null;
    if (selWork !== null) return;
    const wi = workUnder(cxp, cyp);
    if (wi >= 0 && wi !== shown) name(wi);
  });
});
function release(ev, cancelled) {
  if (!down || ev.pointerId !== down.id) return;
  const moved = down.moved, still = ev.timeStamp - down.lt > 89;
  down = null;
  cv.classList.remove("dragging");
  if (!moved) {
    velX = velY = 0;
    if (!cancelled) {
      const wi = workUnder(ev.clientX, ev.clientY);
      if (wi >= 0) { if (wi === selWork) letGo(); else pickOut(wi); }
    }
  } else if (REDUCED || still) velX = velY = 0;                   // a hand that stopped before letting go does not glide
}
cv.addEventListener("pointerup", (ev) => release(ev, false));
cv.addEventListener("pointercancel", (ev) => release(ev, true));
cv.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? cv.getBoundingClientRect().height : 1, s = cellsPerCss();
  vx += ev.deltaX * unit * s; vy += ev.deltaY * unit * s;
  velX = velY = 0;
}, { passive: false });
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") { letGo(); return; }
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
  if (!step) return;
  ev.preventDefault();
  if (REDUCED) { vx += step[0] * 89; vy += step[1] * 89; return; }
  velX = Math.max(-34, Math.min(34, velX + step[0] * 13)); velY = Math.max(-34, Math.min(34, velY + step[1] * 13));
});
showAll.addEventListener("click", letGo);
</script>
<script id="wanderers">__WANDERERS__</script>
<script id="earth-main">__EARTH_MAIN__</script>
"""


def data_uri(path):
    kind = "webp" if str(path).endswith(".webp") else "png"
    return f"data:image/{kind};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def plane(folder):
    """The plane's ingredients from soil_tiles.py, with their images inlined."""
    m = json.loads((folder / "plane.json").read_text())
    for sid, s in enumerate(m["sources"]):
        s["colour"] = data_uri(folder / f"s{sid}-colour.webp")
        s["meta"] = data_uri(folder / f"s{sid}-meta.png")
    m["fields"] = [data_uri(folder / f) for f in m["fields"]]
    return m


def earth_scripts(atlas, priv):
    """DIRT Earth's scripts, and its files beside the page (see dirt/earth/page_files.py)."""
    sys.path.insert(0, str(HERE / "earth"))
    import page_files
    files = page_files.write(atlas, priv / "earth")
    src = {n: (HERE / "earth" / "engine" / f"{n}.js").read_text().replace("</script", "<\\/script") for n in ("earth-common", "earth-worker", "earth-main")}
    return src, files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--private", default=str(HERE / "private"))
    ap.add_argument("--earth", help="the Earth atlas's folder (dirt/earth/build_atlas.py --out), to build DIRT Earth into the page")
    args = ap.parse_args()
    priv = Path(args.private)
    pl = plane(priv / "plane")
    src, files = earth_scripts(Path(args.earth), priv) if args.earth else ({}, [])
    gpu = (HERE / "engine" / "ground-gl.js").read_text().replace("</script", "<\\/script")
    page = (PAGE.replace("__GROUND__", pl["ground"]["hex"])
                .replace("__GROUND_GL__", gpu)
                .replace("__WANDERERS__", (HERE / "engine" / "wanderers.js").read_text().replace("</script", "<\\/script"))
                .replace("__ART__", (HERE / "artists" / "twombly.json").read_text().replace("</", "<\\/"))
                .replace("__PLANE__", json.dumps(pl, ensure_ascii=False).replace("</", "<\\/"))
                .replace("__EARTH_COMMON__", src.get("earth-common", ""))
                .replace("__EARTH_WORKER__", src.get("earth-worker", ""))
                .replace("__EARTH_MAIN__", src.get("earth-main", "")))
    target = priv / "collection-soil.html"
    target.write_text(page)
    print(target, f"{len(page) / 1e6:.1f} MB", f"and {len(files)} Earth files in {priv / 'earth'}" if files else "")


if __name__ == "__main__":
    main()

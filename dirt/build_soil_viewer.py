#!/usr/bin/env python3
"""Build DIRT: a field of edge-matched collection-soil tiles that grows stranger as it tiles out.

Each Shuffle deals a new field of tiles from soil_tiles.py and picks a point of origin. The tiles are
laid out from it in a spiral, and the farther a place is from the origin, the more digital processes
take hold of the soil there. Every threshold and amount is a power of the golden ratio or a
Fibonacci number:

  from the start   more of each straddling object's shards sink back into the dirt (phi^-3 to phi^-1)
  phi^-3           the colours turn, by up to the golden angle
  phi^-2 onward    the dots fuse into pixel blocks of 2, 3, 5 and then 8 cells
  phi^-2 + phi^-4  rows tear sideways, like torn scanlines
  phi^-1           columns pixel-sort by lightness into drips
  phi^-1/2         the field folds into a five-fold kaleidoscope about the origin
  phi^-2 onward    data pigment: up to 1/phi of the dots come loose and take flight as a flock, birds of
                   one painting flying as kin, riding a slow current and scattering from three unseen
                   hawks that hunt the far ground; over the calm soil they turn back outward

The processes act on the whole field, never on single tiles, so no joins show. Every cell keeps a
note of where it came from, so pointing anywhere still names the saved painting underneath, and
clicking or tapping a painting picks it out by darkening everything else. Clicking it again,
pressing Escape or "Show all" brings the whole field back. The page
embeds the tile cutouts, so it is written to dirt/private/ and never committed.

    python3 dirt/build_soil_viewer.py [--private dirt/private]
"""

import argparse
import base64
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

PAGE = r"""<title>DIRT</title>
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
  body { background: var(--ground); color: var(--ink); font: 12px/1.5 var(--mono); margin: 0; padding: 16px 16px 24px; }
  .bar { display: flex; flex-wrap: nowrap; gap: 8px 21px; align-items: baseline; margin-bottom: 13px; min-height: 34px; }
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
  canvas { width: 100%; height: auto; display: block; cursor: crosshair; touch-action: manipulation; }
</style>

<div class="bar">
  <button id="shuffle">Shuffle</button>
  <button id="show-all" hidden>Show all</button>
  <div class="art" aria-live="polite">
    <span class="title" id="c-title"></span>
    <span class="who" id="c-who"></span>
    <span id="c-link"></span>
  </div>
</div>
<canvas id="field" aria-label="A field of soil tiles laid out from a point, growing stranger with distance; point at it to name the painting underneath; click or tap a painting to pick it out, and again to let it go"></canvas>

<script>
const TS = __TILES__;
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLDEN_ANGLE = (2 * Math.PI) / (PHI * PHI);          // 137.5 degrees
const N = TS.grid, CELL = TS.cell, COLS = 5, ROWS = 3;     // a Fibonacci field, 5 by 3 tiles
const W = COLS * N, H = ROWS * N;
const R = 2;                                                // screen pixels a cell: the field fits a screen without aliasing
const GROUND = [1, 3, 5].map((i) => parseInt(TS.ground.hex.slice(i, i + 2), 16));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

const cv = document.getElementById("field"), cx = cv.getContext("2d");
cv.width = W * R; cv.height = H * R;
const off = document.createElement("canvas");               // the finished field, revealed tile by tile
off.width = cv.width; off.height = cv.height;

// ---- small tools ------------------------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function unit(a, b) { let h = Math.imul(a ^ Math.imul(b, 2654435761), 1597334677); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lumOf = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;

/** Smooth value noise over the field, lattice spacing `g` cells, in [0, 1]. */
function noise(rand, g) {
  const gw = Math.ceil(W / g) + 2, gh = Math.ceil(H / g) + 2, lat = Float32Array.from({ length: gw * gh }, rand);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = y / g, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
    for (let x = 0; x < W; x++) {
      const fx = x / g, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
      const a = lat[y0 * gw + x0], b = lat[y0 * gw + x0 + 1], c = lat[(y0 + 1) * gw + x0], d = lat[(y0 + 1) * gw + x0 + 1];
      out[y * W + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

// ---- the tiles, read back to one colour and one dot size a cell ---------------------------------

const tiles = [];
const shardAxis = TS.tiles.map((t) => Uint8Array.from(t.clods, (c) => (c[4] ? (c[4][0] === "v" ? 1 : 2) : 0)));
const shardHash = TS.tiles.map((t) => Uint32Array.from(t.clods, (c) => (c[4] ? hash32(c[4]) : 0)));
const byEdges = new Map(TS.tiles.map((t, i) => [t.west * 8 + t.north, i]));

function loadImage(src) { return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; }); }
function pixels(img, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, w, h).data;
}
const ready = Promise.all(TS.tiles.map(async (t, i) => {
  const [im, li] = await Promise.all([loadImage(t.cutout), loadImage(t.labels)]);
  const px = pixels(im, N * CELL, N * CELL), lp = pixels(li, N, N);
  const col = new Uint8Array(N * N * 3), size = new Uint8Array(N * N), lab = new Uint16Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = y * N + x;
    let lit = 0;
    for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) {
      const j = ((y * CELL + dy) * N * CELL + x * CELL + dx) * 4;
      if (px[j] !== GROUND[0] || px[j + 1] !== GROUND[1] || px[j + 2] !== GROUND[2]) lit++;
    }
    size[c] = lit >= 9 ? 3 : lit >= 4 ? 2 : lit >= 1 ? 1 : 0;
    const j = (y * CELL * N * CELL + x * CELL) * 4;
    col[c * 3] = px[j]; col[c * 3 + 1] = px[j + 1]; col[c * 3 + 2] = px[j + 2];
    lab[c] = lp[c * 4] + 256 * lp[c * 4 + 1];
  }
  tiles[i] = { col, size, lab };
}));

// ---- a field ----------------------------------------------------------------------------------

let layout = [], outSrc = new Int32Array(W * H), order = [], origin = [0, 0];
let Dg = null, P = null, waves = [];
const BUDGET = 17711;                                           // birds at most (Fibonacci)
const HAWKS = 3;                                                // unseen predators (Fibonacci)
const SEE = 8, NEAR = 3, FEAR = 21, LOOK = 13;                  // cells: sight, personal space, fear; neighbours heeded (Fibonacci)
const VMAX = 2, VMIN = 1 / PHI, PANIC = VMAX * PHI;             // cells a frame
const GX = Math.ceil(W / SEE), GY = Math.ceil(H / SEE);
const head = new Int32Array(GX * GY), next = new Int32Array(BUDGET);
let hawks = [];
const trail = document.createElement("canvas");                 // the flowing pigment, one pixel a cell
trail.width = W; trail.height = H;
const trailCtx = trail.getContext("2d"), trailImg = trailCtx.createImageData(W, H), trailPx = trailImg.data;

function deal(seed) {
  const rand = rng(seed);
  // Left to right, top to bottom: each place takes the tile whose west and north edges match.
  layout = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const west = c ? TS.tiles[layout[r * COLS + c - 1]].east : Math.floor(rand() * TS.colours);
    const north = r ? TS.tiles[layout[(r - 1) * COLS + c]].south : Math.floor(rand() * TS.colours);
    layout.push(byEdges.get(west * 8 + north));
  }
  origin = [Math.floor(rand() * W), Math.floor(rand() * H)];
  const [ox, oy] = origin;
  const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - ox, y - oy)));

  // How far each cell is from the origin, 0 to 1, with its edges roughened by phi^-3 so the stages
  // do not arrive as clean rings.
  const n1 = noise(rand, 34), n2 = noise(rand, 55), n3 = noise(rand, 21);
  const D = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    D[i] = Math.min(1, Math.max(0, Math.hypot(x - ox, y - oy) / far + (n1[i] - 0.5) * PHI ** -3 * 2));
  }

  // A. The tiles as dealt. At each join a share of the straddling object's shards sinks, growing
  //    from phi^-3 near the origin to phi^-1 at the far edge; both sides of a join agree.
  const bc = new Uint8Array(W * H * 3), bs = new Uint8Array(W * H), bsrc = new Int32Array(W * H);
  const joinSeed = () => (rand() * 4294967296) >>> 0;
  const vSeed = Array.from({ length: ROWS }, () => Array.from({ length: COLS + 1 }, joinSeed));
  const hSeed = Array.from({ length: ROWS + 1 }, () => Array.from({ length: COLS }, joinSeed));
  const sinkAt = (x, y) => PHI ** -3 + (PHI ** -1 - PHI ** -3) * D[Math.min(H - 1, y) * W + Math.min(W - 1, x)];
  const sunk = PHI ** -2;
  layout.forEach((t, k) => {
    const r = Math.floor(k / COLS), c = k % COLS, T0 = tiles[t], axis = shardAxis[t], hs = shardHash[t];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const s = y * N + x, i = (r * N + y) * W + c * N + x, ci = T0.lab[s];
      let f = 1;
      if (axis[ci] === 1) {
        const line = x < N / 2 ? c : c + 1;
        if (unit(vSeed[r][line], hs[ci]) < sinkAt(line * N, r * N + N / 2)) f = sunk;
      } else if (axis[ci] === 2) {
        const line = y < N / 2 ? r : r + 1;
        if (unit(hSeed[line][c], hs[ci]) < sinkAt(c * N + N / 2, line * N)) f = sunk;
      }
      bc[i * 3] = T0.col[s * 3] * f; bc[i * 3 + 1] = T0.col[s * 3 + 1] * f; bc[i * 3 + 2] = T0.col[s * 3 + 2] * f;
      bs[i] = T0.size[s];
      bsrc[i] = k * 65536 + s;
    }
  });

  // B. Where each cell takes its soil from: folded, torn and fused, more so the farther out it is.
  const theta0 = rand() * 2 * Math.PI, wedge = (2 * Math.PI) / 5;
  const tear = new Float32Array(H);                           // bands of 3 to 8 rows, a phi^-2 share torn
  for (let y = 0; y < H;) {
    const band = [3, 5, 8][Math.floor(rand() * 3)], v = rand() < PHI ** -2 ? rand() * 2 - 1 : 0;
    for (let k = 0; k < band && y < H; k++, y++) tear[y] = v;
  }
  const reflect = (v, n) => { v = ((v % (2 * n)) + 2 * n) % (2 * n); return v < n ? v : 2 * n - 1 - v; };
  const blockOf = (d) => (d < PHI ** -2 ? 1 : d < PHI ** -2 + PHI ** -4 ? 2 : d < PHI ** -2 + 2 * PHI ** -4 ? 3 : d < PHI ** -2 + 3 * PHI ** -4 ? 5 : 8);
  const source = (x, y) => {
    const i = y * W + x, d = D[i];
    let qx = x, qy = y;
    if (unit(i, seed) < smooth(PHI ** -0.5, 1, d)) {          // the five-fold kaleidoscope
      const vx = x - ox, vy = y - oy, rr = Math.hypot(vx, vy);
      let a = Math.atan2(vy, vx) - theta0;
      a = ((a % wedge) + wedge) % wedge;
      if (a > wedge / 2) a = wedge - a;
      qx = Math.round(ox + rr * Math.cos(a + theta0)); qy = Math.round(oy + rr * Math.sin(a + theta0));
    }
    qx += Math.round(tear[reflect(qy, H)] * 13 * smooth(PHI ** -2 + PHI ** -4, 1, d));
    return reflect(qy, H) * W + reflect(qx, W);
  };
  const oc = new Uint8Array(W * H * 3), os = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, b = blockOf(D[i]);
    const x0 = x - (x % b), y0 = y - (y % b);
    const q = source(x0, y0);
    oc[i * 3] = bc[q * 3]; oc[i * 3 + 1] = bc[q * 3 + 1]; oc[i * 3 + 2] = bc[q * 3 + 2];
    outSrc[i] = bsrc[q];
    // A fused block is one square dot, with a one-cell gap on its far sides.
    os[i] = b === 1 ? bs[q] : (x - x0 === b - 1 || y - y0 === b - 1 || !bs[q]) ? 0 : 3;
  }

  // C. Pixel sorting: past phi^-1, runs of lit cells in a column are sorted by lightness into drips,
  //    up to 21 cells long, where a slow noise lets it happen.
  for (let x = 0; x < W; x++) {
    const down = unit(x, seed + 7) < 0.5;
    let y = 0;
    while (y < H) {
      const i = y * W + x;
      if (!os[i] || D[i] < PHI ** -1 || n2[i] < PHI ** -2) { y++; continue; }
      const run = [];
      while (y < H && run.length < 21 && os[y * W + x] && D[y * W + x] >= PHI ** -1) { run.push(y * W + x); y++; }
      const items = run.map((j) => [lumOf(oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2]), oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2], outSrc[j]]);
      items.sort((a, b) => (down ? a[0] - b[0] : b[0] - a[0]));
      run.forEach((j, k) => { oc[j * 3] = items[k][1]; oc[j * 3 + 1] = items[k][2]; oc[j * 3 + 2] = items[k][3]; outSrc[j] = items[k][4]; });
    }
  }

  // D. The colours turn: past phi^-3, by up to the golden angle, one way or the other by region.
  for (let i = 0; i < W * H; i++) {
    const t = smooth(PHI ** -3, 1, D[i]) * (n3[i] * 2 - 1) * GOLDEN_ANGLE;
    if (Math.abs(t) < 0.01) continue;
    const c = Math.cos(t), s = Math.sin(t), k = (1 - c) / 3, q = Math.sqrt(1 / 3) * s;
    const r = oc[i * 3], g = oc[i * 3 + 1], b = oc[i * 3 + 2];
    oc[i * 3] = Math.max(0, Math.min(255, r * (c + k) + g * (k - q) + b * (k + q)));
    oc[i * 3 + 1] = Math.max(0, Math.min(255, r * (k + q) + g * (c + k) + b * (k - q)));
    oc[i * 3 + 2] = Math.max(0, Math.min(255, r * (k - q) + g * (k + q) + b * (c + k)));
  }

  // E. Data pigment: past phi^-2 a growing share of the lit cells, up to 1/phi of them, comes loose
  //    from the ground and flows. Where one leaves, its pore opens to the dark.
  Dg = D;
  const picks = [];
  if (!REDUCED) {
    for (let i = 0; i < W * H; i++) {
      if (os[i] && unit(i, seed + 13) < smooth(PHI ** -2, 1, D[i]) / PHI) picks.push(i);
    }
    for (let k = picks.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [picks[k], picks[j]] = [picks[j], picks[k]]; }
    picks.length = Math.min(picks.length, BUDGET);
  }
  const n = picks.length;
  P = { n, x: new Float32Array(n), y: new Float32Array(n), hx: new Float32Array(n), hy: new Float32Array(n),
        rgb: new Uint8Array(n * 3), src: new Int32Array(n), slot: new Uint8Array(n),
        vx: new Float32Array(n), vy: new Float32Array(n), kin: new Int32Array(n) };
  picks.forEach((i, k) => {
    const x = i % W, y = (i / W) | 0;
    P.x[k] = P.hx[k] = x + 0.5; P.y[k] = P.hy[k] = y + 0.5;
    P.rgb[k * 3] = oc[i * 3]; P.rgb[k * 3 + 1] = oc[i * 3 + 1]; P.rgb[k * 3 + 2] = oc[i * 3 + 2];
    P.src[k] = outSrc[i];
    P.slot[k] = Math.floor(y / N) * COLS + Math.floor(x / N);
    P.kin[k] = workOf(outSrc[i]);                              // birds of one painting are kin
    const a = rand() * 2 * Math.PI;
    P.vx[k] = Math.cos(a) * VMIN; P.vy[k] = Math.sin(a) * VMIN;
    os[i] = 0;
  });
  // The current: a stream function of five travelling waves, Fibonacci wavelengths, so the flow is
  // divergence-free and swirls like a liquid rather than scattering.
  waves = [89, 144, 233, 377, 610].map((lambda) => {
    const a = rand() * 2 * Math.PI, k = (2 * Math.PI) / lambda;
    return { kx: k * Math.cos(a), ky: k * Math.sin(a), amp: lambda / (2 * Math.PI), w: (rand() - 0.5) * PHI ** -5, ph: rand() * 2 * Math.PI };
  });
  const norm = waves.reduce((sum, v) => sum + v.amp * Math.hypot(v.kx, v.ky), 0);
  waves.forEach((v) => (v.amp /= norm));
  trailPx.fill(0);
  // Hawks start somewhere out in the far ground, each after a bird of its own choosing.
  hawks = Array.from({ length: HAWKS }, () => {
    const k = Math.floor(rand() * Math.max(1, n));
    return { x: n ? P.x[k] : W / 2, y: n ? P.y[k] : H / 2, vx: 0, vy: 0, prey: k, until: 0 };
  });

  // F. Paint the ground that stays, two pixels a cell: a full dot fills its cell, the weave's smaller
  //    dots are one pixel with the dark around them.
  const g = off.getContext("2d"), im = g.createImageData(off.width, off.height), px = im.data, PW = off.width;
  for (let j = 0; j < px.length; j += 4) { px[j] = GROUND[0]; px[j + 1] = GROUND[1]; px[j + 2] = GROUND[2]; px[j + 3] = 255; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, s = os[i] === 3 ? R : os[i] ? 1 : 0;
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) {
      const j = ((y * R + dy) * PW + x * R + dx) * 4;
      px[j] = oc[i * 3]; px[j + 1] = oc[i * 3 + 1]; px[j + 2] = oc[i * 3 + 2];
    }
  }
  g.putImageData(im, 0, 0);

  // The order the tiles are laid in: a spiral out from the origin.
  const oxT = ox / N, oyT = oy / N;
  order = layout.map((_, k) => k).sort((a, b) => {
    const da = Math.hypot((a % COLS) + 0.5 - oxT, Math.floor(a / COLS) + 0.5 - oyT);
    const db = Math.hypot((b % COLS) + 0.5 - oxT, Math.floor(b / COLS) + 0.5 - oyT);
    return da - db || Math.atan2(Math.floor(a / COLS) - oyT, (a % COLS) - oxT) - Math.atan2(Math.floor(b / COLS) - oyT, (b % COLS) - oxT);
  });
}

// ---- the pigment in motion --------------------------------------------------------------------

function flow(tick) {
  const fade = 1 - PHI ** -6;                                     // long, soft trails
  for (let j = 3; j < trailPx.length; j += 4) if (trailPx[j]) trailPx[j] = trailPx[j] * fade;
  const n = P.n, X = P.x, Y = P.y, VX = P.vx, VY = P.vy;

  // Where everyone is: a bucket grid a sight-length across, rebuilt every frame.
  head.fill(-1);
  for (let k = 0; k < n; k++) {
    const b = Math.min(GY - 1, (Y[k] / SEE) | 0) * GX + Math.min(GX - 1, (X[k] / SEE) | 0);
    next[k] = head[b]; head[b] = k;
  }

  // The hawks: each chases its chosen bird for a while, then turns to another. They are never drawn;
  // they are seen only in what the flocks do.
  for (const hk of hawks) {
    if (tick >= hk.until || hk.prey >= n) { hk.prey = Math.floor(Math.random() * n); hk.until = tick + 144 + Math.floor(Math.random() * 233); }
    const dx = X[hk.prey] - hk.x, dy = Y[hk.prey] - hk.y, d = Math.hypot(dx, dy) || 1;
    const hs = VMAX * PHI ** 0.5;                                 // quicker than a bird, slower than a panicked one
    hk.vx += (dx / d * hs - hk.vx) * PHI ** -4; hk.vy += (dy / d * hs - hk.vy) * PHI ** -4;
    hk.x += hk.vx; hk.y += hk.vy;
  }

  for (let k = 0; k < n; k++) {
    if (revealed[P.slot[k]] < 1) continue;
    const x = X[k], y = Y[k];
    let ax = 0, ay = 0, cx0 = 0, cy0 = 0, sx = 0, sy = 0, wsum = 0, seen = 0;
    const bx = Math.min(GX - 1, (x / SEE) | 0), by = Math.min(GY - 1, (y / SEE) | 0);
    for (let gy = by - 1; gy <= by + 1 && seen < LOOK; gy++) {
      if (gy < 0 || gy >= GY) continue;
      for (let gx = bx - 1; gx <= bx + 1 && seen < LOOK; gx++) {
        if (gx < 0 || gx >= GX) continue;
        for (let o = head[gy * GX + gx]; o !== -1 && seen < LOOK; o = next[o]) {
          if (o === k) continue;
          const dx = X[o] - x, dy = Y[o] - y, d2 = dx * dx + dy * dy;
          if (d2 > SEE * SEE) continue;
          seen++;
          const w = P.kin[o] === P.kin[k] ? PHI : 1;                // kin pull harder
          ax += VX[o] * w; ay += VY[o] * w; cx0 += dx * w; cy0 += dy * w; wsum += w;
          if (d2 < NEAR * NEAR) { const d = Math.sqrt(d2) || 0.1; sx -= dx / d / d; sy -= dy / d / d; }
        }
      }
    }
    let vx = VX[k], vy = VY[k];
    if (wsum) {
      vx += (ax / wsum - vx) * PHI ** -2;                         // alignment: fly as the others fly
      vy += (ay / wsum - vy) * PHI ** -2;
      vx += (cx0 / wsum) * PHI ** -5;                             // cohesion: drift toward the middle of the flock
      vy += (cy0 / wsum) * PHI ** -5;
    }
    vx += sx * PHI ** -1; vy += sy * PHI ** -1;                   // separation: keep a wingspan apart

    // The slow current still moves under them, a thermal to ride.
    let u = 0, v = 0;
    for (const w of waves) {
      const c = w.amp * Math.cos(w.kx * x + w.ky * y + w.w * tick + w.ph);
      u += w.ky * c; v -= w.kx * c;
    }
    vx += u * PHI ** -3 * 21; vy += v * PHI ** -3 * 21;

    // Fear: a hawk within reach and the bird bolts away from it; the flock reads the bolt and turns.
    let fled = false;
    for (const hk of hawks) {
      const dx = x - hk.x, dy = y - hk.y, d2 = dx * dx + dy * dy;
      if (d2 < FEAR * FEAR) {
        const d = Math.sqrt(d2) || 0.1, f = (1 - d / FEAR) * PHI;
        vx += (dx / d) * f; vy += (dy / d) * f; fled = true;
      }
    }

    // Home range: the far ground is their sky. Over the calm soil they turn back outward.
    const i = Math.min(H - 1, y | 0) * W + Math.min(W - 1, x | 0);
    if (Dg[i] < PHI ** -2) {
      const ox = x - origin[0], oy = y - origin[1], d = Math.hypot(ox, oy) || 1;
      const depth = (PHI ** -2 - Dg[i]) / PHI ** -2;              // the deeper over the soil, the harder the turn
      vx += (ox / d) * depth * PHI ** -1; vy += (oy / d) * depth * PHI ** -1;
    }
    const m = 13;                                                 // and they bank away from the edges
    if (x < m) vx += PHI ** -4; if (x > W - m) vx -= PHI ** -4;
    if (y < m) vy += PHI ** -4; if (y > H - m) vy -= PHI ** -4;

    // Speed: never stalling, never past a panicked burst.
    const sp = Math.hypot(vx, vy) || 1, top = fled ? PANIC : VMAX;
    if (sp > top) { vx = vx / sp * top; vy = vy / sp * top; }
    else if (sp < VMIN) { vx = vx / sp * VMIN; vy = vy / sp * VMIN; }
    VX[k] = vx; VY[k] = vy;
    X[k] = Math.min(W - 1, Math.max(0, x + vx)); Y[k] = Math.min(H - 1, Math.max(0, y + vy));

    // Each bird is a short stroke along its heading.
    const f = selWork !== null && P.kin[k] !== selWork ? PHI ** -2 : 1;
    const r = P.rgb[k * 3] * f, g = P.rgb[k * 3 + 1] * f, b = P.rgb[k * 3 + 2] * f;
    const s = Math.hypot(vx, vy) || 1;
    for (let t = 0; t < 2; t++) {
      const px = (X[k] - (vx / s) * t) | 0, py = (Y[k] - (vy / s) * t) | 0;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const j = (py * W + px) * 4;
      trailPx[j] = r; trailPx[j + 1] = g; trailPx[j + 2] = b; trailPx[j + 3] = 255;
    }
  }
  trailCtx.putImageData(trailImg, 0, 0);
}

// ---- laying it out ----------------------------------------------------------------------------

let started = 0, selWork = null, anim = 0, tick = 0;
const STEP = 144, FADE = 377;                                   // milliseconds, Fibonacci
const revealed = new Float32Array(COLS * ROWS);

function frame(now) {
  const t = REDUCED ? Infinity : now - started;
  cx.fillStyle = `rgb(${GROUND})`;
  cx.fillRect(0, 0, cv.width, cv.height);
  cx.imageSmoothingEnabled = false;
  const T = N * R;
  order.forEach((k, n) => {
    const a = Math.min(1, Math.max(0, (t - n * STEP) / FADE));
    revealed[k] = a;
    if (a <= 0) return;
    cx.globalAlpha = a;
    const sx = (k % COLS) * T, sy = Math.floor(k / COLS) * T;
    cx.drawImage(off, sx, sy, T, T, sx, sy, T, T);
  });
  cx.globalAlpha = 1;
  if (selWork !== null) cx.drawImage(shade, 0, 0, cv.width, cv.height);
  if (P && P.n) {
    flow(tick++);
    cx.drawImage(trail, 0, 0, cv.width, cv.height);
  }
  const moving = P && P.n && !REDUCED;
  const done = revealed.every((a) => a >= 1);
  anim = moving || !done ? requestAnimationFrame(frame) : 0;
}

function lay() {
  cancelAnimationFrame(anim);
  selWork = null;
  shown = -1;
  showAll.hidden = true;
  for (const id of ["c-title", "c-who", "c-link"]) document.getElementById(id).replaceChildren();
  revealed.fill(0);
  deal((Math.random() * 4294967296) >>> 0);
  started = performance.now();
  anim = requestAnimationFrame(frame);
}

// ---- what is underneath -----------------------------------------------------------------------

function workOf(src) {
  const k = src >> 16, s = src & 65535, t = layout[k];
  return TS.tiles[t].clods[tiles[t].lab[s]][0];
}
const workAt = (i) => workOf(outSrc[i]);

/** The pigment particle nearest (x, y), within a cell and a half, or -1. */
function particleAt(x, y) {
  if (!P) return -1;
  let best = -1, bd = 2.25;
  for (let k = 0; k < P.n; k++) {
    if (revealed[P.slot[k]] < 1) continue;
    const dx = P.x[k] - x, dy = P.y[k] - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = k; }
  }
  return best;
}

const shade = document.createElement("canvas");
shade.width = W; shade.height = H;
function makeShade() {
  const g = shade.getContext("2d"), im = g.createImageData(W, H), a = Math.round(255 / PHI);
  for (let i = 0; i < W * H; i++) {
    if (workAt(i) === selWork) continue;
    const j = i * 4;
    im.data[j] = GROUND[0]; im.data[j + 1] = GROUND[1]; im.data[j + 2] = GROUND[2]; im.data[j + 3] = a;
  }
  g.putImageData(im, 0, 0);
}

// ---- pointing and picking out ------------------------------------------------------------------
// Pointing at the field names the painting underneath and darkens nothing. Clicking or tapping a
// painting picks it out: everything else darkens, and it stays picked out while the pointer goes
// elsewhere, to the Artsy link say. Clicking it again, pressing Escape or "Show all" lets it go.

const showAll = document.getElementById("show-all");
let shown = -1, pending = null;

function workUnder(ev) {
  if (!layout.length) return -1;
  const r = cv.getBoundingClientRect();
  const fx = ((ev.clientX - r.left) / r.width) * W, fy = ((ev.clientY - r.top) / r.height) * H;
  const x = Math.floor(fx), y = Math.floor(fy);
  if (x < 0 || y < 0 || x >= W || y >= H) return -1;
  const pk = particleAt(fx, fy);
  return pk >= 0 ? P.kin[pk] : workAt(y * W + x);
}

function name(wi) {
  shown = wi;
  const w = TS.works[wi];
  document.getElementById("c-title").textContent = w.title || "Untitled";
  document.getElementById("c-who").textContent = [w.artist, w.date].filter(Boolean).join(", ");
  document.getElementById("c-link").replaceChildren(Object.assign(document.createElement("a"), { href: w.url, target: "_blank", rel: "noopener", textContent: "See it on Artsy" }));
}

const redraw = () => { if (!anim) frame(Infinity); };

function pickOut(wi) {
  selWork = wi;
  makeShade();
  name(wi);
  showAll.hidden = false;
  redraw();
}

function letGo() {
  if (selWork === null) return;
  selWork = null;
  showAll.hidden = true;
  redraw();
}

cv.addEventListener("pointermove", (ev) => {
  // Only a mouse hovers; and a painting that has been picked out holds still until it is let go.
  if (ev.pointerType !== "mouse" || selWork !== null || pending !== null) return;
  const wi = workUnder(ev);
  if (wi < 0 || wi === shown) return;
  pending = requestAnimationFrame(() => { pending = null; if (selWork === null) name(wi); });
});
cv.addEventListener("click", (ev) => {
  const wi = workUnder(ev);
  if (wi < 0) return;
  if (wi === selWork) letGo(); else pickOut(wi);
});
showAll.addEventListener("click", letGo);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") letGo(); });

document.getElementById("shuffle").onclick = () => ready.then(lay);
ready.then(lay);
</script>
"""


def data_uri(path):
    kind = "webp" if str(path).endswith(".webp") else "png"
    return f"data:image/{kind};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def tile_set(folder):
    """The edge-matched tiles from soil_tiles.py, with their works pulled into one table."""
    m = json.loads((folder / "tiles.json").read_text())
    works, index = [], {}
    for t in m["tiles"]:
        rows = []
        for c in t["clods"]:
            w = c["work"]
            if w["id"] not in index:
                index[w["id"]] = len(works)
                works.append(w)
            rows.append([index[w["id"]], c["hex"], c["glint"], c["kind"], c.get("key")])
        t["clods"] = rows
        t["cutout"] = data_uri(folder / f"{t['name']}-cutout.webp")
        t["labels"] = data_uri(folder / f"{t['name']}-labels.png")
    m["works"] = works
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--private", default=str(HERE / "private"))
    ap.add_argument("--out", help="unused; kept so older invocations still run")
    args = ap.parse_args()
    priv = Path(args.private)
    ts = tile_set(priv / "tiles")
    page = (PAGE.replace("__GROUND__", ts["ground"]["hex"])
                .replace("__TILES__", json.dumps(ts, ensure_ascii=False).replace("</", "<\\/")))
    target = priv / "collection-soil.html"
    target.write_text(page)
    print(target)


if __name__ == "__main__":
    main()

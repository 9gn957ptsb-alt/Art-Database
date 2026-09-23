#!/usr/bin/env python3
"""Build DIRT: an infinite plane of collection soil to swipe through.

soil_tiles.py writes the plane's ingredients: corner, join and middle soils made from the saved
paintings, and the fields that shape each tile's zones. This page carries them, and a worker thread
assembles tiles from them wherever the viewer goes. Every join on the plane takes its colour from its
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
  phi^-2 onward    data pigment: some of the dots come loose and take flight as flocks, birds of one
                   painting flying as kin, riding a slow current and scattering from three unseen
                   hawks that hunt wherever the viewer is; over calm ground they turn back outward

Everything is a function of position, so no seams show and going back finds the same ground. Swiping,
a trackpad or the arrow keys move through it, and a swipe glides on after the hand lets go. Pointing
names the saved painting underneath; clicking or tapping picks it out by darkening everything else,
and clicking it again, Escape or "Show all" brings the whole plane back. The page embeds the cutouts,
so it is written to dirt/private/ and never committed.

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
</script>

<script id="worker-src" type="text/plain">
// ---- the worker: assembles tiles and grows processed ground, a tile-sized chunk at a time -------

let S = [], CORN = [], VERT = [], HORZ = [], MIDS = [], AF = [], BF = [], CN = null;
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

const blockOf = (d) => (d < PHI ** -2 ? 1 : d < PHI ** -2 + PHI ** -4 ? 2 : d < PHI ** -2 + 2 * PHI ** -4 ? 3 : d < PHI ** -2 + 3 * PHI ** -4 ? 5 : 8);

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

/** Grow the chunk of ground covering tile (ci, cj): its pixels, painting per cell, depths and birds. */
function chunk(ci, cj) {
  const x0 = ci * N, y0 = cj * N;
  // Drips are sorted within 21-cell segments fixed on the plane, so rows are grown for whole segments.
  const s0 = Math.floor(y0 / SEG) * SEG, s1 = (Math.floor((y0 + N - 1) / SEG) + 1) * SEG, HH = s1 - s0;
  const oc = new Uint8Array(N * HH * 3), os = new Uint8Array(N * HH), ow = new Uint16Array(N * HH), dd = new Float32Array(N * HH);

  // B. Where each cell takes its soil from: folded, torn and fused, more so the farther out it is.
  for (let yy = 0; yy < HH; yy++) {
    const y = s0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = yy * N + xx, d = depth(x, y);
      dd[k] = d;
      const b = blockOf(d), bx = x - mod(x, b), by = y - mod(y, b);
      sourceOf(bx, by, b === 1 ? d : depth(bx, by));
      const t = sampleAt(QX, QY), sz = t.size[SI];
      oc[k * 3] = t.col[SI * 3]; oc[k * 3 + 1] = t.col[SI * 3 + 1]; oc[k * 3 + 2] = t.col[SI * 3 + 2];
      ow[k] = t.work[SI];
      // A fused block is one square dot, with a one-cell gap on its far sides.
      os[k] = b === 1 ? sz : (x - bx === b - 1 || y - by === b - 1 || !sz) ? 0 : 3;
    }
  }

  // C. Drips: past phi^-1, runs of lit cells in a column are sorted by lightness, within their segment.
  const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b, lim = PHI ** -1;
  for (let xx = 0; xx < N; xx++) {
    const x = x0 + xx, down = u3(x, 0, 29) < 0.5;
    for (let seg = 0; seg < HH; seg += SEG) {
      let yy = seg;
      while (yy < seg + SEG) {
        const k = yy * N + xx;
        if (!os[k] || dd[k] < lim || vnoise(x, s0 + yy, 55, 2) < PHI ** -2) { yy++; continue; }
        const run = [];
        while (yy < seg + SEG && os[yy * N + xx] && dd[yy * N + xx] >= lim) { run.push(yy * N + xx); yy++; }
        if (run.length < 2) continue;
        const items = run.map((j) => [lum(oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2]), oc[j * 3], oc[j * 3 + 1], oc[j * 3 + 2], ow[j]]);
        items.sort((a, b) => (down ? a[0] - b[0] : b[0] - a[0]));
        run.forEach((j, n) => { oc[j * 3] = items[n][1]; oc[j * 3 + 1] = items[n][2]; oc[j * 3 + 2] = items[n][3]; ow[j] = items[n][4]; });
      }
    }
  }

  // D, E. The colours turn by up to the golden angle; some dots come loose as birds and leave pores;
  //       what stays is painted, two pixels a cell.
  const T = N * R, px = new Uint8ClampedArray(T * T * 4);
  for (let j = 0; j < px.length; j += 4) { px[j] = GROUND[0]; px[j + 1] = GROUND[1]; px[j + 2] = GROUND[2]; px[j + 3] = 255; }
  const work = new Uint16Array(N * N), dgrid = new Float32Array(32 * 32), birds = [], off = (y0 - s0) * N;
  for (let yy = 0; yy < N; yy++) {
    const y = y0 + yy;
    for (let xx = 0; xx < N; xx++) {
      const x = x0 + xx, k = off + yy * N + xx, d = dd[k];
      work[yy * N + xx] = ow[k];
      let r = oc[k * 3], g = oc[k * 3 + 1], b = oc[k * 3 + 2];
      const t = smooth(PHI ** -3, 1, d) * (vnoise(x, y, 21, 3) * 2 - 1) * GOLDEN_ANGLE;
      if (Math.abs(t) >= 0.01) {
        const c = Math.cos(t), s = Math.sin(t), kk = (1 - c) / 3, q = Math.sqrt(1 / 3) * s;
        const r2 = r * (c + kk) + g * (kk - q) + b * (kk + q), g2 = r * (kk + q) + g * (c + kk) + b * (kk - q), b2 = r * (kk - q) + g * (kk + q) + b * (c + kk);
        r = Math.max(0, Math.min(255, r2)); g = Math.max(0, Math.min(255, g2)); b = Math.max(0, Math.min(255, b2));
      }
      let s = os[k];
      if (s && KAPPA && u3(x, y, 37) < (smooth(PHI ** -2, 1, d) / PHI) * KAPPA) { birds.push(x + 0.5, y + 0.5, r, g, b, ow[k]); s = 0; }
      if (!s) continue;
      const w = s === 3 ? R : 1;
      for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) {
        const j = ((yy * R + dy) * T + xx * R + dx) * 4;
        px[j] = r; px[j + 1] = g; px[j + 2] = b;
      }
    }
  }
  for (let by = 0; by < 32; by++) for (let bx = 0; bx < 32; bx++) dgrid[by * 32 + bx] = dd[off + (by * 8 + 4) * N + bx * 8 + 4];
  return { type: "chunk", ci, cj, px, work, dgrid, birds: Float32Array.from(birds) };
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    S = m.sources; CORN = m.corners; VERT = m.vertical; HORZ = m.horizontal; MIDS = m.middles;
    AF = m.a; BF = m.b; CN = m.corner; K = m.colours;
    ({ A: ZA, D: ZD, CZ, CZ_WANDER: CZW } = m.zone);
    GROUND = m.ground; R = m.R; KAPPA = m.kappa;
    postMessage({ type: "ready" });
  } else if (m.type === "chunk") {
    const out = chunk(m.ci, m.cj);
    postMessage(out, [out.px.buffer, out.work.buffer, out.dgrid.buffer, out.birds.buffer]);
  }
};
</script>

<script>
const PL = __PLANE__;
const R = 2;                                                    // canvas pixels a cell
const GROUND = [1, 3, 5].map((i) => parseInt(PL.ground.hex.slice(i, i + 2), 16));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FADE = 377;                                               // ms for new ground to come in (Fibonacci)
const GLIDE = 1 - PHI ** -6;                                    // how long a swipe glides on
const MARGIN = 89, KEEP = 55, ASKING = 2;                       // cells kept live round the view; chunks kept; asks in flight

const stage = document.getElementById("stage"), cv = document.getElementById("field"), cx = cv.getContext("2d");
const showAll = document.getElementById("show-all");

function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function loadImage(src) { return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; }); }
function pixels(img, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, w, h).data;
}

// ---- the worker that grows the ground ---------------------------------------------------------

const worker = new Worker(URL.createObjectURL(new Blob(
  [document.getElementById("common").textContent, "\n", document.getElementById("worker-src").textContent],
  { type: "text/javascript" })));
const chunks = new Map(), asked = new Set();
const ck = (i, j) => (i + 32768) * 65536 + (j + 32768);
let ready = false, nextId = 1;

worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === "ready") { ready = true; return; }
  if (m.type !== "chunk") return;
  const k = ck(m.ci, m.cj);
  asked.delete(k);
  const c = document.createElement("canvas");
  c.width = c.height = N * R;
  c.getContext("2d").putImageData(new ImageData(m.px, N * R, N * R), 0, 0);
  chunks.set(k, { i: m.ci, j: m.cj, canvas: c, work: m.work, dgrid: m.dgrid, birds: m.birds,
                  born: performance.now(), id: nextId++, spawned: false, shade: null, shadeSel: null });
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
                ground: GROUND, R, kappa: REDUCED ? 0 : PHI ** -5 };
  return { msg, transfer };
}
ingredients().then(({ msg, transfer }) => worker.postMessage(msg, transfer));

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
  if (ready) for (const w of list) {
    if (asked.size >= ASKING) break;
    if (!chunks.has(w.k) && !asked.has(w.k)) { asked.add(w.k); worker.postMessage({ type: "chunk", ci: w.i, cj: w.j }); }
  }
  for (const [k, c] of chunks) {
    const on = want.has(k);
    if (on && !c.spawned) spawn(c);
    else if (!on && c.spawned) despawn(c);
  }
  if (chunks.size > KEEP) {
    const mx = vx + VW / 2, my = vy + VH / 2;
    const far = [...chunks.entries()].filter(([k]) => !want.has(k))
      .sort((a, b) => Math.hypot((b[1].i + 0.5) * N - mx, (b[1].j + 0.5) * N - my) - Math.hypot((a[1].i + 0.5) * N - mx, (a[1].j + 0.5) * N - my));
    for (const [k] of far) { if (chunks.size <= KEEP) break; chunks.delete(k); }
  }
}

// ---- the birds --------------------------------------------------------------------------------

const CAP = 17711, HAWKS = 3;                                   // birds at most, and unseen hawks (Fibonacci)
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
function dAt(x, y) {
  const c = chunks.get(ck(Math.floor(x / N), Math.floor(y / N)));
  return c ? c.dgrid[Math.floor(mod(y, N) / 8) * 32 + Math.floor(mod(x, N) / 8)] : 1;
}

// The trails: one pixel a cell, fixed to the plane, shifted as the view moves.
const trailCv = document.createElement("canvas"), trailCtx = trailCv.getContext("2d");
let TW = 0, TH = 0, trailImg = null, trailPx = null, trailTmp = null, tox = 0, toy = 0;
function sizeTrail() {
  TW = Math.ceil(VW) + 2; TH = Math.ceil(VH) + 2;
  trailCv.width = TW; trailCv.height = TH;
  trailImg = trailCtx.createImageData(TW, TH); trailPx = trailImg.data; trailTmp = new Uint8ClampedArray(trailPx.length);
  tox = Math.floor(vx); toy = Math.floor(vy);
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
  const fade = 1 - PHI ** -6;                                     // long, soft trails
  for (let j = 3; j < trailPx.length; j += 4) if (trailPx[j]) trailPx[j] = trailPx[j] * fade;

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
    let u = 0, v = 0;                                                                   // the current, a thermal to ride
    for (const w of waves) { const c = w.amp * Math.cos(w.kx * x + w.ky * y + w.w * t + w.ph); u += w.ky * c; v -= w.kx * c; }
    vx_ += u * PHI ** -3 * 21; vy_ += v * PHI ** -3 * 21;
    let fled = false;                                                                   // fear
    for (const hk of hawks) {
      const dx = x - hk.x, dy = y - hk.y, d2 = dx * dx + dy * dy;
      if (d2 < FEAR * FEAR) { const d = Math.sqrt(d2) || 0.1, f = (1 - d / FEAR) * PHI; vx_ += (dx / d) * f; vy_ += (dy / d) * f; fled = true; }
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

// ---- drawing ----------------------------------------------------------------------------------

let selWork = null;
function shadeOf(c) {
  if (c.shadeSel !== selWork) {
    if (!c.shade) { c.shade = document.createElement("canvas"); c.shade.width = c.shade.height = N; }
    const g = c.shade.getContext("2d"), im = g.createImageData(N, N), a = Math.round(255 / PHI);
    for (let i = 0; i < N * N; i++) {
      if (c.work[i] === selWork) continue;
      const j = i * 4;
      im.data[j] = GROUND[0]; im.data[j + 1] = GROUND[1]; im.data[j + 2] = GROUND[2]; im.data[j + 3] = a;
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
  cx.fillStyle = `rgb(${GROUND})`;
  cx.fillRect(0, 0, cv.width, cv.height);
  cx.imageSmoothingEnabled = false;
  const T = N * R;
  for (const w of list) {
    const c = chunks.get(w.k);
    if (!c) continue;
    const px = Math.round((c.i * N - vx) * R), py = Math.round((c.j * N - vy) * R);
    if (px >= cv.width || py >= cv.height || px + T <= 0 || py + T <= 0) continue;
    cx.globalAlpha = REDUCED ? 1 : Math.min(1, (now - c.born) / FADE);   // new ground comes in
    cx.drawImage(c.canvas, px, py);
    if (selWork !== null) cx.drawImage(shadeOf(c), px, py, T, T);
  }
  cx.globalAlpha = 1;
  if (nb) {
    shiftTrail(Math.floor(vx), Math.floor(vy));
    flow(tick++, list.box);
    trailCtx.putImageData(trailImg, 0, 0);
    cx.drawImage(trailCv, Math.round((tox - vx) * R), Math.round((toy - vy) * R), TW * R, TH * R);
  }
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--private", default=str(HERE / "private"))
    args = ap.parse_args()
    priv = Path(args.private)
    pl = plane(priv / "plane")
    page = (PAGE.replace("__GROUND__", pl["ground"]["hex"])
                .replace("__PLANE__", json.dumps(pl, ensure_ascii=False).replace("</", "<\\/")))
    target = priv / "collection-soil.html"
    target.write_text(page)
    print(target, f"{len(page) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

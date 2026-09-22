#!/usr/bin/env python3
"""Flatten both collection-soil versions, the edge-matched tile set and their manifests into one page.

Hovering (or tapping) a clod names the painting it came from. The page embeds the cutout image,
so it is written to dirt/private/ and never committed.

    python3 dirt/build_soil_viewer.py [--out dirt/out] [--private dirt/private]
"""

import argparse
import base64
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

PAGE = r"""<title>DIRT</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400;1,6..72,500&display=swap">
<style>
  :root {
    color-scheme: dark;
    --ground: __GROUND__;
    --soil: #241911;
    --line: #3a2a1d;
    --ink: #eadfcd;
    --muted: #a8927a;
    --serif: "Newsreader", Georgia, "Times New Roman", serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body { background: var(--ground); color: var(--ink); font: 12px/1.5 var(--mono); padding: 22px 16px 40px; margin: 0; }
  .wrap { max-width: 1240px; margin: 0 auto; display: grid; gap: 18px; }
  header { display: flex; flex-wrap: wrap; gap: 6px 22px; align-items: baseline; }
  h1 { font: italic 500 clamp(30px, 4.4vw, 46px)/1 var(--serif); margin: 0; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--muted); max-width: 66ch; }
  .bench { display: grid; grid-template-columns: minmax(0, 768px) minmax(260px, 1fr); gap: 22px; align-items: start; }
  @media (max-width: 900px) { .bench { grid-template-columns: 1fr; } }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .tabs button {
    font: inherit; color: var(--muted); background: transparent; border: 1px solid var(--line);
    padding: 5px 10px; cursor: pointer; letter-spacing: 0.06em; text-transform: uppercase; font-size: 11px;
  }
  .tabs button[aria-pressed="true"] { color: var(--ground); background: var(--ink); border-color: var(--ink); }
  :focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .stage { display: grid; gap: 10px; }
  canvas { width: 100%; max-width: 768px; height: auto; image-rendering: pixelated; display: block; cursor: crosshair; touch-action: manipulation; }
  #grid { cursor: crosshair; }
  .caption { color: var(--muted); margin: 0; max-width: 70ch; }
  aside { display: grid; gap: 18px; position: sticky; top: calc(env(safe-area-inset-top, 0px) + 16px); }
  .card { border-top: 1px solid var(--line); padding-top: 14px; display: grid; gap: 8px; min-height: 180px; }
  .label { color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; }
  .swatches { display: flex; gap: 4px; }
  .swatches span { width: 34px; height: 34px; display: block; }
  .title { font: italic 400 24px/1.15 var(--serif); margin: 0; text-wrap: balance; }
  .who { margin: 0; }
  .meta { color: var(--muted); margin: 0; font-variant-numeric: tabular-nums; }
  a { color: var(--ink); text-underline-offset: 3px; }
  .index { display: grid; grid-template-columns: repeat(auto-fill, minmax(14px, 1fr)); gap: 2px; }
  .index button { aspect-ratio: 1; border: 0; padding: 0; cursor: pointer; }
  .index button.on { outline: 2px solid var(--ink); outline-offset: 1px; }
</style>

<div class="wrap">
  <header>
    <h1>DIRT</h1>
    <p>Two hundred and twenty saved paintings, broken down to their colours and woven back into dirt. Each clod is one painting; the dark between the dots is one more.</p>
  </header>
  <div class="bench">
    <div class="stage">
      <div class="tabs" role="group" aria-label="Version">
        <button id="t-colour" aria-pressed="true">Colours</button>
        <button id="t-cutout" aria-pressed="false">Cutouts</button>
        <button id="t-tile" aria-pressed="false">Lay tiles</button>
        <button id="t-shuffle" hidden>Shuffle</button>
      </div>
      <canvas id="soil" width="768" height="768" aria-label="The soil texture; hover or tap a clod to see its painting"></canvas>
      <canvas id="grid" width="2304" height="2304" hidden aria-label="Nine different tiles whose edges line up; hover or tap a clod to see its painting"></canvas>
      <p class="caption" id="cap"></p>
    </div>
    <aside>
      <section class="card" aria-live="polite">
        <span class="label" id="c-label">Hover a clod</span>
        <div class="swatches" id="c-sw"></div>
        <p class="title" id="c-title">Every clod is one painting.</p>
        <p class="who" id="c-who"></p>
        <p class="meta" id="c-meta"></p>
        <p class="meta" id="c-link"></p>
      </section>
      <section style="display:grid; gap:8px">
        <span class="label">All 220, darkest to lightest</span>
        <div class="index" id="index"></div>
      </section>
    </aside>
  </div>
</div>

<script>
const M = __MANIFEST__;
const SRC = { colour: "__IMG_A__", cutout: "__IMG_B__" };
const TS = __TILES__;
const N = M.grid, CELL = M.cell;
const labels = Uint8Array.from(atob(M.labels), (c) => c.charCodeAt(0));
const imgs = {};
let mode = "colour", sel = -1, tiled = false;

const cv = document.getElementById("soil"), cx = cv.getContext("2d");
const CAP = {
  colour: "Colours: each clod wears one of its painting's three dominant colours, in the chocolate range. Pale glints are the same painting's lightest warm colour.",
  cutout: "Cutouts: the same clods, each a pixelated window into its painting, centred where that painting is most like the colour it gave.",
};

function draw() {
  cx.imageSmoothingEnabled = false;
  cx.drawImage(imgs[mode], 0, 0);
  if (sel >= 0) {
    cx.fillStyle = "rgba(15,10,7,0.5)";
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
      if (labels[y * N + x] !== sel) cx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
  const g = M.ground;
  document.getElementById("cap").textContent = `${tiled ? TILE_CAP : CAP[mode]} The dark between the dots is ${g.hex}, from ${g.work.title || "Untitled"} by ${g.work.artist}.`;
  gv.hidden = !tiled; cv.hidden = tiled;
  document.getElementById("t-shuffle").hidden = !tiled;
  if (tiled) drawGrid();
}

/* ---- the tiles: sixteen different squares whose edges line up ---------------------------- */

const gv = document.getElementById("grid"), gx = gv.getContext("2d");
const ROWS = 3, COLS = 3, TP = TS.tile;
const byEdges = new Map(TS.tiles.map((t, i) => [t.west * 8 + t.north, i]));
const tileImgs = { colour: [], cutout: [] }, tileLabels = [];
let layout = [], selWork = null;
const edgeNames = (list) => list.map((e) => `${e.artist}'s ${e.kind === "face" ? "face" : e.kind}`).join(", ");
const TILE_CAP = `Tiles: sixteen different squares, laid so every edge matches. Faces sit across the vertical joins, split down the middle (${edgeNames(TS.edges.vertical)}); the horizontal joins carry ${edgeNames(TS.edges.horizontal)}.`;

function deal() {
  // Left to right, top to bottom: each place takes the tile whose west and north edges match.
  layout = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const west = c ? TS.tiles[layout[r * COLS + c - 1]].east : Math.floor(Math.random() * TS.colours);
    const north = r ? TS.tiles[layout[(r - 1) * COLS + c]].south : Math.floor(Math.random() * TS.colours);
    layout.push(byEdges.get(west * 8 + north));
  }
}

const shadeCv = document.createElement("canvas");
shadeCv.width = COLS * N; shadeCv.height = ROWS * N;
function drawGrid() {
  if (layout.some((t) => !tileImgs[mode][t] || !tileLabels[t])) return;
  gx.imageSmoothingEnabled = false;
  layout.forEach((t, k) => gx.drawImage(tileImgs[mode][t], (k % COLS) * TP, Math.floor(k / COLS) * TP));
  if (selWork === null) return;
  // Dim everything that is not the chosen painting, at one pixel a cell, then scale up.
  const sc = shadeCv.getContext("2d"), im = sc.createImageData(COLS * N, ROWS * N);
  layout.forEach((t, k) => {
    const lab = tileLabels[t], clods = TS.tiles[t].clods, ox = (k % COLS) * N, oy = Math.floor(k / COLS) * N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (clods[lab[y * N + x]][0] === selWork) continue;
      const j = ((oy + y) * COLS * N + ox + x) * 4;
      im.data[j] = 15; im.data[j + 1] = 10; im.data[j + 2] = 7; im.data[j + 3] = 128;
    }
  });
  sc.putImageData(im, 0, 0);
  gx.drawImage(shadeCv, 0, 0, gv.width, gv.height);
}

function showTileClod(t, ci) {
  const [wi, hex, glint, kind] = TS.tiles[t].clods[ci];
  const w = TS.works[wi];
  selWork = wi; sel = -1;
  document.getElementById("c-label").textContent = kind && kind.startsWith("across:")
    ? `Across a join · ${kind.slice(7)}` : kind === "face" ? "A clod centred on a face" : "A clod";
  document.getElementById("c-sw").replaceChildren(...[hex, glint].filter(Boolean).map((h) => Object.assign(document.createElement("span"), { title: h, style: `background:${h}` })));
  document.getElementById("c-title").textContent = w.title || "Untitled";
  document.getElementById("c-who").textContent = [w.artist, w.date].filter(Boolean).join(", ");
  document.getElementById("c-meta").textContent = glint ? `${hex} · glint ${glint}` : hex;
  document.getElementById("c-link").replaceChildren(Object.assign(document.createElement("a"), { href: w.url, target: "_blank", rel: "noopener", textContent: "See it on Artsy" }));
  document.querySelectorAll(".index button").forEach((b) => b.classList.remove("on"));
  drawGrid();
}

function pickGrid(ev) {
  const r = gv.getBoundingClientRect();
  const fx = ((ev.clientX - r.left) / r.width) * COLS, fy = ((ev.clientY - r.top) / r.height) * ROWS;
  if (fx < 0 || fy < 0 || fx >= COLS || fy >= ROWS) return;
  const k = Math.floor(fy) * COLS + Math.floor(fx), t = layout[k];
  const x = Math.floor((fx % 1) * N), y = Math.floor((fy % 1) * N);
  const ci = tileLabels[t][y * N + x];
  if (TS.tiles[t].clods[ci][0] !== selWork) showTileClod(t, ci);
}
gv.addEventListener("pointermove", pickGrid);
gv.addEventListener("pointerdown", pickGrid);

function loadImage(src) {
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
}
const tilesReady = Promise.all(TS.tiles.map(async (t, i) => {
  [tileImgs.colour[i], tileImgs.cutout[i]] = await Promise.all([loadImage(t.colour), loadImage(t.cutout)]);
  const li = await loadImage(t.labels), c = document.createElement("canvas");
  c.width = N; c.height = N;
  const lc = c.getContext("2d");
  lc.drawImage(li, 0, 0);
  const d = lc.getImageData(0, 0, N, N).data, lab = new Uint16Array(N * N);
  for (let j = 0; j < N * N; j++) lab[j] = d[j * 4] + 256 * d[j * 4 + 1];
  tileLabels[i] = lab;
}));
deal();

function show(i) {
  sel = i;
  const c = M.clods[i], w = c.work;
  document.getElementById("c-label").textContent = `Clod ${i + 1} · ${c.cells} cells`;
  const sw = document.getElementById("c-sw");
  sw.replaceChildren(...[c.hex, c.glint].filter(Boolean).map((h) => Object.assign(document.createElement("span"), { title: h, style: `background:${h}` })));
  document.getElementById("c-title").textContent = w.title || "Untitled";
  document.getElementById("c-who").textContent = [w.artist, w.date].filter(Boolean).join(", ");
  document.getElementById("c-meta").textContent = c.glint ? `${c.hex} · glint ${c.glint}` : c.hex;
  const a = Object.assign(document.createElement("a"), { href: w.url, target: "_blank", rel: "noopener", textContent: "See it on Artsy" });
  document.getElementById("c-link").replaceChildren(a);
  document.querySelectorAll(".index button").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
  draw();
}

function pick(ev) {
  const r = cv.getBoundingClientRect();
  const x = Math.floor(((ev.clientX - r.left) / r.width) * N), y = Math.floor(((ev.clientY - r.top) / r.height) * N);
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = labels[y * N + x];
  if (i !== sel) show(i);
}
cv.addEventListener("pointermove", pick);
cv.addEventListener("pointerdown", pick);

const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255); };
const idx = document.getElementById("index");
M.clods.map((c, i) => i).sort((a, b) => lum(M.clods[a].hex) - lum(M.clods[b].hex)).forEach((i) => {
  const b = document.createElement("button");
  b.dataset.i = i; b.style.background = M.clods[i].hex;
  b.setAttribute("aria-label", `${M.clods[i].work.title} by ${M.clods[i].work.artist}`);
  b.onclick = () => { if (tiled) setTile(false); show(i); };
  idx.append(b);
});

function press(id, on) { document.getElementById(id).setAttribute("aria-pressed", on); }
function setMode(m) { mode = m; press("t-colour", m === "colour"); press("t-cutout", m === "cutout"); draw(); }
function setTile(on) {
  tiled = on; press("t-tile", on);
  if (on) tilesReady.then(draw); else { selWork = null; draw(); }
}
document.getElementById("t-colour").onclick = () => setMode("colour");
document.getElementById("t-cutout").onclick = () => setMode("cutout");
document.getElementById("t-tile").onclick = () => setTile(!tiled);
document.getElementById("t-shuffle").onclick = () => { deal(); drawGrid(); };

let pending = 2;
for (const k of ["colour", "cutout"]) {
  imgs[k] = new Image();
  imgs[k].onload = () => { if (--pending === 0) show(M.clods.reduce((b, c, i) => (c.cells > M.clods[b].cells ? i : b), 0)); };
  imgs[k].src = SRC[k];
}
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
            rows.append([index[w["id"]], c["hex"], c["glint"], c["kind"]])
        t["clods"] = rows
        for mode in ("colour", "cutout"):
            t[mode] = data_uri(folder / f"{t['name']}-{mode}.webp")
        t["labels"] = data_uri(folder / f"{t['name']}-labels.png")
    m["works"] = works
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--private", default=str(HERE / "private"))
    args = ap.parse_args()
    out, priv = Path(args.out), Path(args.private)
    manifest = json.loads((priv / "collection-soil-cutouts.json").read_text())
    for c in manifest["clods"]:
        c.pop("crop", None)
    page = (PAGE.replace("__GROUND__", manifest["ground"]["hex"])
                .replace("__MANIFEST__", json.dumps(manifest, ensure_ascii=False).replace("</", "<\\/"))
                .replace("__IMG_A__", data_uri(out / "collection-soil.png"))
                .replace("__IMG_B__", data_uri(priv / "collection-soil-cutouts.png"))
                .replace("__TILES__", json.dumps(tile_set(priv / "tiles"), ensure_ascii=False).replace("</", "<\\/")))
    target = priv / "collection-soil.html"
    target.write_text(page)
    print(target)


if __name__ == "__main__":
    main()

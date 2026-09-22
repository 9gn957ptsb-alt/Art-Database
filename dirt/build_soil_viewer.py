#!/usr/bin/env python3
"""Flatten both collection-soil versions and their manifest into one viewer page.

Hovering (or tapping) a clod names the painting it came from. The page embeds the cutout image,
so it is written to dirt/private/ and never committed.

    python3 dirt/build_soil_viewer.py [--out dirt/out] [--private dirt/private]
"""

import argparse
import base64
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

PAGE = r"""<title>Collection Soil</title>
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
  .tiled { width: 100%; aspect-ratio: 2 / 1; background-size: 384px; image-rendering: pixelated; }
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
    <h1>Collection Soil</h1>
    <p>Two hundred and twenty saved paintings, broken down to their colours and woven back into dirt. Each clod is one painting; the dark between the dots is one more.</p>
  </header>
  <div class="bench">
    <div class="stage">
      <div class="tabs" role="group" aria-label="Version">
        <button id="t-colour" aria-pressed="true">Colours</button>
        <button id="t-cutout" aria-pressed="false">Cutouts</button>
        <button id="t-tile" aria-pressed="false">Repeat as tile</button>
      </div>
      <canvas id="soil" width="768" height="768" aria-label="The soil texture; hover or tap a clod to see its painting"></canvas>
      <div id="tiled" class="tiled" hidden></div>
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
  document.getElementById("cap").textContent = `${CAP[mode]} The dark between the dots is ${g.hex}, from ${g.work.title || "Untitled"} by ${g.work.artist}.`;
  const t = document.getElementById("tiled");
  t.hidden = !tiled; cv.hidden = tiled;
  t.style.backgroundImage = `url(${SRC[mode]})`;
}

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
function setTile(on) { tiled = on; press("t-tile", on); draw(); }
document.getElementById("t-colour").onclick = () => setMode("colour");
document.getElementById("t-cutout").onclick = () => setMode("cutout");
document.getElementById("t-tile").onclick = () => setTile(!tiled);

let pending = 2;
for (const k of ["colour", "cutout"]) {
  imgs[k] = new Image();
  imgs[k].onload = () => { if (--pending === 0) show(M.clods.reduce((b, c, i) => (c.cells > M.clods[b].cells ? i : b), 0)); };
  imgs[k].src = SRC[k];
}
</script>
"""


def data_uri(path):
    return "data:image/png;base64," + base64.b64encode(Path(path).read_bytes()).decode()


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
                .replace("__IMG_B__", data_uri(priv / "collection-soil-cutouts.png")))
    target = priv / "collection-soil.html"
    target.write_text(page)
    print(target)


if __name__ == "__main__":
    main()

/* The buildings pass's check on the site (docs/v2/models/REFINE.md, step 9): open buildings in headless
   Chromium and, for each, confirm that it

     rises      — the clod is drawn in steps up to shown >= 1, the last drawing a fully risen one (a frame that
                  came late once left the tallest crown's top storey missing: a tree drawn as a ring, 15 Oct 2026);
     turns      — a drag on it changes the drawing, and a drag is not a tap;
     swaps      — a tap swaps the building for the ground it stands in, and a second tap swaps back;
     leaves     — Land.up() goes back to the world;

   and that the page threw no error through any of it (NASA, Artsy's picture store and Google Fonts are stood in
   for, or refused, as everywhere).

     cd docs && python3 -m http.server 8921 &
     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_buildings.js [--port 8921]
         [--slugs a,b,museum-c]       buildings by slug: an Architectural Authority one, or a museum's ("museum-…")
         [--today | --since 2026-10-10]   the ledger's buildings refined (or first modelled) on that day, or since
         [--max 4]                    at most so many, the kinds taken in turn (default: all)
         [--sizes 1440x900,390x844]   a mouse at the first, touch at the second; default both
         [--shots DIR]                a screenshot of each building standing and each ground

   Software GL draws a frame a second, so a building takes about a minute: pick a few. Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
function flag(name) { return args.indexOf("--" + name) >= 0; }
const PORT = +arg("port", 8921);
const SIZES = String(arg("sizes", "1440x900,390x844")).split(",");
const SHOTS = arg("shots", null);
const MAX = +arg("max", 0);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#6b5f50"/></svg>';

// Which buildings: given, or the ledger's of a day.
function pick() {
  let slugs = String(arg("slugs", "")).split(",").filter(Boolean);
  if (!slugs.length) {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs/v2/models/ledger.json"), "utf8"));
    const since = flag("today") ? new Date().toISOString().slice(0, 10) : arg("since", null);
    if (!since) { console.error("which buildings? --slugs a,b, --today or --since YYYY-MM-DD"); process.exit(2); }
    const kinds = {};
    Object.keys(ledger).forEach((s) => { if (ledger[s].refined >= since) { (kinds[ledger[s].kind || "architecture"] = kinds[ledger[s].kind || "architecture"] || []).push(s); } });
    const order = [];
    for (let i = 0; Object.keys(kinds).some((k) => kinds[k][i]); i++) { Object.keys(kinds).sort().forEach((k) => { if (kinds[k][i]) { order.push(kinds[k][i]); } }); }
    slugs = order;
  }
  return MAX ? slugs.slice(0, MAX) : slugs;
}

const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How much is drawn on the clod's canvas, and a checksum of it (to tell one frame from another).
const INK = () => {
  const c = document.querySelector("#building-map canvas.building-clod");
  if (!c) { return null; }
  const g = c.getContext("2d");
  if (!g) { return { w: c.width, h: c.height, n: -1, sum: 0 }; }
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, sum = 0;
  for (let i = 3; i < d.length; i += 4) { if (d[i] > 8) { n += 1; sum = (sum * 31 + d[i - 3] + 7 * d[i - 2] + 13 * d[i - 1] + i) | 0; } }
  return { w: c.width, h: c.height, n, sum };
};
const STATE = () => {
  const b = document.getElementById("building");
  const note = document.querySelector(".building-note");
  return { air: b && b.dataset.air, view: b && b.dataset.view, museum: b && b.dataset.museum || null, hidden: b && b.hidden,
           note: note ? note.textContent.slice(0, 140) : "", where: Land.where() };
};

async function until(P, fn, ms, step) {
  const t0 = Date.now();
  for (;;) {
    if (await P.evaluate(fn)) { return true; }
    if (Date.now() - t0 > ms) { return false; }
    await sleep(step || 250);
  }
}

async function one(P, tag, slug, shots, name) {
  const museum = /^museum-/.test(slug);
  const errBefore = P.__errors.length;
  await P.evaluate(() => { window.__draws.length = 0; });
  const started = await P.evaluate(([s, m]) => (m ? (Land.museum(s), true) : Land.open("building-" + s)), [slug, museum]);
  check(tag, started !== false, "opened (" + (museum ? "museum" : "building") + ")", started);
  const there = await until(P, () => { const w = Land.where(); return (w.at === "building" || w.at === "museum") && !w.flying; }, 90000);
  check(tag, there, "flown down to it", await P.evaluate(() => Land.where()));
  const up = await until(P, () => { const b = document.getElementById("building"); return b && !b.hidden && b.dataset.air === "up"; }, 60000);
  check(tag, up, "the building view is up", await P.evaluate(STATE));
  if (!up) { return; }
  // It rises: drawn in steps, and the last drawing is a risen one (shown 1 or more) however slowly the frames come.
  const rose = await until(P, () => window.__draws.some((d) => d.s >= 1), 30000, 200);
  const ds = await P.evaluate(() => window.__draws.slice(0, 14));
  check(tag, rose, "rises and stands (a drawing at shown >= 1)", ds.map((d) => d.s));
  const stands = await P.evaluate(INK);
  check(tag, stands && stands.n > 0, "dots are on the canvas", stands && stands.n);
  const st = await P.evaluate(STATE);
  check(tag, st.view === "building" || st.view === "ground", "first view", st.view);
  if (shots) { await P.screenshot({ path: shots + "/" + name + "-1-stands.png" }); }

  const box = await P.evaluate(() => { const r = document.getElementById("building-map").getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  const cx = box.x + box.w * 0.5, cy = box.y + box.h * 0.45;
  // Turns by hand.
  const before = await P.evaluate(INK);
  await P.mouse.move(cx, cy);
  await P.mouse.down();
  for (let k = 1; k <= 8; k++) { await P.mouse.move(cx + k * 12, cy); await sleep(30); }
  await P.mouse.up();
  await sleep(500);
  const turned = await P.evaluate(INK);
  check(tag, turned && before && turned.sum !== before.sum, "turns when dragged (the drawing changes)", { before: before && before.n, after: turned && turned.n });
  const still = await P.evaluate(STATE);
  check(tag, still.view === st.view, "a drag does not swap the view", still.view);
  await sleep(1500);

  // Swaps to its ground on a tap, and back.
  const v0 = (await P.evaluate(STATE)).view;
  await P.mouse.click(cx, cy);
  await sleep(300);
  const v1 = (await P.evaluate(STATE)).view;
  const other = v0 === "building" ? "ground" : "building";
  check(tag, v1 === other, "a tap swaps " + v0 + " -> " + other, v1);
  await sleep(2200);
  const swapped = await P.evaluate(INK);
  check(tag, swapped && swapped.n > 0, "the other view is drawn", swapped && swapped.n);
  if (shots) { await P.screenshot({ path: shots + "/" + name + "-2-" + v1 + ".png" }); }
  await P.mouse.click(cx, cy);
  await sleep(300);
  const v2 = (await P.evaluate(STATE)).view;
  check(tag, v2 === v0, "a second tap swaps back", v2);
  await sleep(1800);
  const back = await P.evaluate(INK);
  check(tag, back && back.n > 0, "and it is drawn again", back && back.n);

  // And up.
  await P.evaluate(() => Land.up());
  // A building inside a city (a museum) leaves to its town first, so go up again until the world.
  const gone = await until(P, () => { const w = Land.where(); if (w.at !== "world" && !w.flying) { Land.up(); } return w.at === "world" && !w.flying; }, 60000, 400);
  check(tag, gone, "back up to the world", await P.evaluate(() => Land.where()));
  const errs = P.__errors.slice(errBefore);
  check(tag, errs.length === 0, "no page errors", errs);
}

async function run(size, slugs) {
  const [w, h] = size.split("x").map(Number), touch = w <= 720;
  const browser = await chromium.launch({ args: (process.env.CHROMIUM_ARGS || "").split(" ").filter(Boolean) });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("globe-layer", "architecture"); } catch (e) {} });
  const P = await ctx.newPage();
  P.__errors = [];
  P.on("pageerror", (e) => P.__errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); }
  await P.goto("http://localhost:" + PORT + "/v2/", { waitUntil: "load" });
  await P.waitForFunction(() => window.Land && Land.where && window.Models, null, { timeout: 60000 });
  await sleep(6000);
  check(size, P.__errors.length === 0, "the front page loads without page errors", P.__errors);
  // Record every drawing of a clod: how far it had risen (shown), how many dots, which heading.
  await P.evaluate(() => {
    const orig = Models.draw;
    window.__draws = [];
    Models.draw = function (c, dots, h, s) {
      if (c && c.classList && c.classList.contains("building-clod")) { window.__draws.push({ s: +s.toFixed(3), n: dots.count, h: +h.toFixed(3) }); }
      return orig.apply(this, arguments);
    };
  });
  for (const slug of slugs) {
    const tag = size + " " + slug.slice(0, 44);
    try { await one(P, tag, slug, SHOTS, size + "-" + slug.slice(0, 36)); } catch (e) { check(tag, false, "threw: " + e.message); }
    // The next one opens from the world.
    await P.evaluate(() => { try { if (Land.where().at !== "world") { Land.up(); } } catch (e) {} });
    await until(P, () => Land.where().at === "world" && !Land.where().flying, 60000, 400);
    await sleep(800);
  }
  await browser.close();
}

(async () => {
  const slugs = pick();
  if (!slugs.length) { console.log("no buildings to check"); return; }
  console.log(slugs.length + " building(s): " + slugs.join(", "));
  for (const s of SIZES) { await run(s, slugs); }
  console.log(fails.length ? "\n" + fails.length + " FAILED:\n  " + fails.join("\n  ") : "\nall passed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

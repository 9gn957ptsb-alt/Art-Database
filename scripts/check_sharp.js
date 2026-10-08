/* The globe is never blurry, and the same in every place (artist, 8 Oct 2026,
   of the small globe beside a life's dial: "The globe is blurry for some
   reason. Make sure the globe is never blurry and consistently the same
   across all places").

   Opens every place a globe of the body of works is drawn — the front globe,
   a work's history, a life (Picasso's, and Richard Renaldi's, the one the
   artist sent), a movement, a thread, a town's "Born here" (Memphis), the
   reading's globe grown, the globe swapped into the big place (the flat map),
   and a city (Rome, no skyline) — at a phone's size (390×844, three device
   pixels to one, touch) and a desktop's (1440×900, two), and checks:

     resolution: the body's canvas is backed at its CSS size × the screen's
       density (±1 px), and shown (never the fallback globe);
     cells: the level it draws has cells of three device pixels or more at
       the middle (EarthBody.levelFor: coarser crisp cells, never averaged);
     sharpness: of the body alone (everything else hidden for the shot), over
       the disc on the screen (inside 0.9 of its radius), the normalised edge
       sharpness F: for every run of three device pixels whose ends differ by
       8/255 or more in luminance (both axes), the share of that change made
       in its single biggest step, F = mean(max step / whole change). An edge
       one pixel wide scores 1, an edge smeared over three 1/3 — the share,
       not the size, so it does not depend on the land's contrast or on how
       many edges there are (the size of the cells). Measured: crisp globes
       0.60–0.87, the same globe stretched ×1.5 bilinear about 0.50, ×3 (the
       artist's screenshot: drawn at one to one on a three-to-one phone) 0.41.
       F rises with the cells' size, so every place is compared with the front
       globe brought by the wheel to the same radius (cells the same size) and
       must be within TOL (0.08) of its F. A place with under 400 such runs is
       not judged; a city's ground (no front globe that near) is reported only.
     the flat map: backed at its CSS size × the screen's density.

   Headless Chromium draws WebGL on the CPU at 1–4 frames a second, which a
   phone does not; left alone, the page's frame-rate watch (sharpen() in
   land.js) would step a large globe's density down. So the main pass holds
   the watch (Land.pace(false)) and stands for a real GPU. A second, shorter
   pass ("live") lets it run at headless speed and checks what the page
   promises even then: a small globe (the lens) stays at the screen's full
   density, the body is never dropped, and a large globe stepped down is at
   a whole divisor of the density, shown pixelated (crisp squares).

     cd docs && python3 -m http.server 8911 &
     NODE_PATH=$(npm root -g) node scripts/check_sharp.js [--port 8911] [--sizes 390x844x3,1440x900x2]
         [--tol 0.08] [--shots DIR] [--before]   (--before: a page without Land.pace; document.hidden stands in)

   Artsy's pictures, Commons and NASA are stood in for (page.route). Exits 1
   on any failure or page error. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8911);
const SIZES = String(arg("sizes", "390x844x3,1440x900x2")).split(",");
const TOL = +arg("tol", 0.08);
const SHOTS = arg("shots", null);
const BEFORE = args.includes("--before");
const LIVE = !args.includes("--no-live");
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#7a6a55"/></svg>';

const fails = [];
const REF = {};          // the front globe's sharpness, per size, from the held pass
const rows = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}

// The sharpness of a PNG's luminance, in the page (no image library here).
async function sharpness(P, png, disc) {
  return P.evaluate(async ([b64, disc]) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
    const L = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { L[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255; }
    let sum = 0, n = 0;
    const at = (x, y) => L[y * w + x];
    // Only the Earth: inside 0.9 of the disc (its air and the sky left out), in the shot's pixels.
    const inside = (x, y) => !disc || (x - disc.x) * (x - disc.x) + (y - disc.y) * (y - disc.y) < disc.r * disc.r;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          if (x + 3 * dx >= w || y + 3 * dy >= h) { continue; }
          const d3 = at(x + 3 * dx, y + 3 * dy) - at(x, y);
          if (Math.abs(d3) < 8 / 255 || !inside(x, y) || !inside(x + 3 * dx, y + 3 * dy)) { continue; }
          let big = -1;
          for (let k = 0; k < 3; k++) {
            const d1 = (at(x + (k + 1) * dx, y + (k + 1) * dy) - at(x + k * dx, y + k * dy)) * Math.sign(d3);
            if (d1 > big) { big = d1; }
          }
          sum += Math.max(0, Math.min(1, big / Math.abs(d3))); n++;
        }
      }
    }
    return { N: n ? +(sum / n).toFixed(3) : 0, edges: n, w, h };
  }, [png.toString("base64"), disc]);
}

async function run(size, live) {
  const [w, h, dsf] = size.split("x").map(Number), touch = w <= 720;
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: dsf });
  await ctx.addInitScript(() => { try { localStorage.setItem("globe-layer", "museums"); localStorage.removeItem("dial.place.phone"); localStorage.removeItem("dial.place.desk"); } catch (e) {} });
  if (BEFORE && !live) {
    // An older page has no Land.pace: document.hidden gates its frame-rate watch (and the swing) instead.
    await ctx.addInitScript(() => { Object.defineProperty(Document.prototype, "hidden", { get: () => true, configurable: true }); });
  }
  const P = await ctx.newPage();
  const cdp = await ctx.newCDPSession(P);
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org|artsy\.net/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const touchAt = (pts, type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const pinch = async (cx, cy, d0, d1) => {
    const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
    await touchAt([pts(d0)[0]], "touchStart");
    await touchAt(pts(d0), "touchStart");
    for (let i = 1; i <= 12; i++) { await touchAt(pts(d0 + (d1 - d0) * i / 12), "touchMove"); await P.waitForTimeout(25); }
    await touchAt([], "touchEnd");
  };
  const mode = live ? "live" : "held";

  await P.goto("http://localhost:" + PORT + "/v2/", { waitUntil: "load" });
  await P.waitForFunction(() => window.Land && document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  const hasPace = await P.evaluate(() => typeof Land.pace === "function");
  if (!live && hasPace) { await P.evaluate(() => Land.pace(false)); }
  await P.waitForFunction(() => window.EarthBody && EarthBody.ready(), null, { timeout: 60000 }).catch(() => {});
  await P.waitForTimeout(live ? 9000 : 2500);

  const density = () => P.evaluate(() => (Land.density ? Land.density() : null));
  const state = () => P.evaluate(() => Land.reading && Land.reading());
  const settle = async () => { for (let i = 0; i < 40; i++) { const r = await state(); if (r && !r.flying && !r.snapping && !r.travelling) { return r; } await P.waitForTimeout(250); } return state(); };

  // One place: its body measured and shot alone.
  async function measure(name, opts) {
    opts = opts || {};
    const tag = size + " " + mode + " " + name;
    await P.waitForTimeout(opts.wait || 1500);
    const g = await P.evaluate(() => {
      const r = Land.reading && Land.reading();
      const d = Land.density ? Land.density() : null;
      const b = window.EarthBody && EarthBody.canvas && EarthBody.canvas();
      const R = d ? d.R : r ? r.R : 0, cx = d ? d.cx : r ? r.cx : 0, cy = d ? d.cy : r ? r.cy : 0;
      return { d, R, cx, cy, b: b ? { w: b.width, h: b.height, cw: b.clientWidth, ch: b.clientHeight,
               shown: getComputedStyle(b).display !== "none" && !!b.parentNode, ir: getComputedStyle(b).imageRendering } : null };
    });
    const row = { size, mode, place: name, R: Math.round(g.R) };
    if (!g.b) { check(tag, false, "the body of works is there"); rows.push(row); return; }
    const ratio = g.b.w / Math.max(1, g.b.cw);
    row.backing = g.b.w + "x" + g.b.h + " / " + g.b.cw + "x" + g.b.ch;
    row.density = +ratio.toFixed(2);
    const full = Math.abs(g.b.w - Math.round(g.b.cw * dsf)) <= 1 && Math.abs(g.b.h - Math.round(g.b.ch * dsf)) <= 1;
    check(tag, g.b.shown, "the body of works is shown (never the fallback globe)");
    const small = g.d ? g.d.small : g.R * g.R * Math.PI < 0.35 * w * h;
    row.small = small;
    if (!live || small) {
      check(tag, full, "backed at the screen's full density (" + dsf + ")", row.backing);
    } else {
      // A large globe on software GL may be stepped down: a whole divisor, shown pixelated.
      const div = dsf / ratio;
      check(tag, Math.abs(div - Math.round(div)) < 0.02 && (full || /pixelated/.test(g.b.ir)),
            "stepped down only by a whole divisor, shown crisp", { ratio: row.density, rendering: g.b.ir });
    }
    if (g.d && g.d.level) {
      const cell = g.d.level.drawn * ratio;
      row.cellDev = +cell.toFixed(2);
      row.level = g.d.level.k;
      check(tag, cell >= 2.99, "its cells are three device pixels or more", row.cellDev);
    }
    // The body alone, in a square inside the disc (or the middle of the window, for a near ground).
    // The whole of the disc that is on the screen, masked to 0.9 of its radius; a near ground: the window's middle.
    const rr = g.R * 0.9;
    let x0 = Math.max(2, g.cx - rr), y0 = Math.max(2, g.cy - rr), x1 = Math.min(w - 2, g.cx + rr), y1 = Math.min(h - 2, g.cy + rr);
    let disc = { x: (g.cx - x0) * dsf, y: (g.cy - y0) * dsf, r: rr * dsf };
    if (g.R > 4 * Math.max(w, h) || x1 - x0 < 16 || y1 - y0 < 16) { x0 = w / 2 - 120; x1 = w / 2 + 120; y0 = h * 0.3; y1 = y0 + 240; disc = null; }
    await P.addStyleTag({ content: "body * { visibility: hidden !important; } canvas.world-body { visibility: visible !important; }" }).then((s) => P.evaluate((e) => e.id = "__sharp", s));
    await P.waitForTimeout(150);
    const png = await P.screenshot({ clip: { x: x0, y: y0, width: Math.max(8, x1 - x0), height: Math.max(8, y1 - y0) } });
    await P.evaluate(() => { const s = document.getElementById("__sharp"); if (s) { s.remove(); } });
    if (SHOTS) { fs.writeFileSync(SHOTS + "/" + (size + "-" + mode + "-" + name).replace(/\W+/g, "-") + ".png", png); }
    const s = await sharpness(P, png, disc);
    row.N = s.N; row.edges = s.edges;
    rows.push(row);
    return row;
  }

  await measure("front globe", { wait: 500 });
  const places = [];
  const vs = (row) => { if (row) { places.push(row); } };
  /* The reference: the front globe brought (by the wheel, as a visitor would) to the same radius as
     the place's globe, so its cells are the same size, and read the same way. F rises with the size
     of the cells (more of the change is at their edges), so a lens is only ever compared with the
     front globe at the lens's size. Live, a large globe may be stepped down (pixelated): only the
     small ones are held to it, against the held pass's references. */
  const frontAt = async (target) => {
    await P.mouse.move(w / 2, h / 2);
    for (let i = 0; i < 40; i++) {
      const R = await P.evaluate(() => Land.density().R);
      if (Math.abs(R / target - 1) < 0.1) { break; }
      await P.mouse.wheel(0, R > target ? 120 : -120);
      await P.waitForTimeout(350);
    }
    return measure("front globe at R " + Math.round(target), { wait: 600 });
  };
  const judge = async () => {
    if (!live) {
      const want = [];
      places.forEach((row) => { if (row.R < 4 * Math.max(w, h) && !want.some((x) => Math.abs(x / row.R - 1) < 0.1)) { want.push(row.R); } });
      REF[size] = [];
      for (const t of want) { const f = await frontAt(t); if (f) { REF[size].push({ R: f.R, F: f.N, edges: f.edges }); } }
    }
    places.forEach((row) => {
      if (row.R >= 4 * Math.max(w, h)) { console.log("  --   " + size + " " + mode + " " + row.place + " · a city's ground: no front globe at its size; F " + row.N + " reported"); return; }
      if (row.edges < 400) { console.log("  --   " + size + " " + mode + " " + row.place + " · too few edges to judge its sharpness · " + row.edges); return; }
      if (live && !row.small) { return; }
      const refs = (REF[size] || []).filter((x) => x.edges >= 400);
      if (!refs.length) { check(size + " " + mode + " " + row.place, false, "a front globe to compare with"); return; }
      const ref = refs.reduce((a, b) => (Math.abs(Math.log(b.R / row.R)) < Math.abs(Math.log(a.R / row.R)) ? b : a));
      row.ref = ref.F;
      check(size + " " + mode + " " + row.place, row.N >= ref.F - TOL, "as sharp as the front globe at its size (R " + ref.R + ", F " + ref.F + " - " + TOL + ")", row.N);
    });
  };
  const open = async (fn, kind) => {
    let r = null;
    // Software GL is slow to fly: wait a minute, and ask once more if it has not opened.
    for (let tries = 0; tries < 2 && !(r && (!kind || r.kind === kind)); tries++) {
      await P.evaluate(fn);
      for (let i = 0; i < 200 && !(r && (!kind || r.kind === kind) && !r.flying); i++) { await P.waitForTimeout(300); r = await state(); }
    }
    if (r && r.look === "plate") {
      if (touch) { await touchAt([{ x: w - 30, y: h - 30, id: 1 }], "touchStart"); await touchAt([], "touchEnd"); } else { await P.mouse.click(w - 30, h - 30); }
    }
    await P.waitForTimeout(4000);
    return settle();
  };
  const up = async () => {
    for (let i = 0; i < 40 && (await P.evaluate(() => Land.where().flying)); i++) { await P.waitForTimeout(400); }
    for (let i = 0; i < 6; i++) { if (await P.evaluate(() => Land.where().at === "world")) { break; } await P.evaluate(() => Land.up()); await P.waitForTimeout(2600); }
  };

  const READINGS = live
    ? [["life (Renaldi)", () => Lives.open("richard-renaldi"), "life"]]
    : [["work", () => Land.work("516cc063fdc441ac440001af"), "work"],
       ["life (Picasso)", () => Lives.open("pablo-picasso"), "life"],
       ["life (Renaldi)", () => Lives.open("richard-renaldi"), "life"],
       ["movement", () => Movements.open("mv-new-york-1948"), "movement"],
       ["thread", () => Land.thread("019ad704"), "thread"],
       ["born here (Memphis)", () => fetch("lives.json").then((r) => r.json()).then((d) => Lives.openMark(d.marks.find((m) => m[7] === "Memphis"))), "life"]];
  for (const [name, fn, kind] of READINGS) {
    const r = await open(fn, kind);
    if (!r) { check(size + " " + mode + " " + name, false, "opened"); await up(); continue; }
    vs(await measure(name + ", the lens"));
    if (name === "life (Renaldi)" || name === "work") {
      // Grown: two fingers outside the rim (touch), a wheel beside it (desktop).
      const L = r.at;
      if (touch) { await pinch(L.x, L.y - L.r - 24, 60, 260); }
      else { await P.mouse.move(L.x + L.r * 0.2, L.y); for (let i = 0; i < 7; i++) { await P.mouse.wheel(0, -100); await P.waitForTimeout(40); } }
      await P.waitForTimeout(1200);
      for (let i = 0; i < 4 && (await P.evaluate((r0) => !!Land.density && Land.density().R < r0 * 1.5, L.r)); i++) { await P.keyboard.press("+"); await P.waitForTimeout(500); }
      vs(await measure(name + ", grown"));
      await P.keyboard.press("Escape");
      await P.waitForTimeout(1200);
      if (!live) {
        // Swapped into the big place: the flat map, at the screen's density.
        await P.evaluate(() => Land.swap(true));
        let f = null;
        for (let i = 0; i < 12 && !f; i++) {
          await P.waitForTimeout(500);
          f = await P.evaluate(() => { const c = document.querySelector(".flat-map"); return c && !c.hidden && c.clientWidth ? { w: c.width, cw: c.clientWidth, h: c.height, ch: c.clientHeight } : null; });
        }
        check(size + " " + mode + " " + name + ", swapped", !!f && Math.abs(f.w - Math.round(f.cw * dsf)) <= 1, "the flat map at the screen's full density", f);
        rows.push({ size, mode, place: name + ", swapped (flat map)", backing: f && f.w + "x" + f.h + " / " + f.cw + "x" + f.ch, density: f && +(f.w / f.cw).toFixed(2) });
        await P.keyboard.press("Escape");
        await P.waitForTimeout(1200);
      }
    }
    await up();
  }
  if (!live) {
    await P.evaluate(() => Land.town("rome-it"));
    for (let i = 0; i < 60 && (await P.evaluate(() => Land.where().flying || Land.where().at === "world")); i++) { await P.waitForTimeout(400); }
    vs(await measure("city (Rome)", { wait: 2500 }));
    await up();
  }
  await judge();
  const d = await density();
  if (d) { console.log("  " + size + " " + mode + " density at the end: " + JSON.stringify({ dpr: d.dpr, densDiv: d.densDiv, bodyDiv: d.bodyDiv, bodyGone: d.bodyGone })); check(size + " " + mode, !d.bodyGone, "the body is never dropped"); }
  errors.forEach((e) => check(size + " " + mode, false, "page error", e));
  await browser.close();
}

(async () => {
  for (const s of SIZES) {
    await run(s, false);
    if (LIVE) { await run(s, true); }
  }
  console.log("\nsize        mode  place                               R      level cell(dev px)  density  F      front F");
  rows.forEach((r) => console.log([r.size.padEnd(11), r.mode.padEnd(5), r.place.padEnd(35), String(r.R === undefined ? "" : r.R).padEnd(6),
    String(r.level === undefined ? "" : r.level).padEnd(5), String(r.cellDev === undefined ? "" : r.cellDev).padEnd(13),
    String(r.density === undefined ? "" : r.density).padEnd(8), String(r.N === undefined ? "" : r.N).padEnd(6), r.ref === undefined ? "" : r.ref].join(" ")));
  if (process.env.SHARP_JSON) { fs.writeFileSync(process.env.SHARP_JSON, JSON.stringify(rows, null, 1)); }
  console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

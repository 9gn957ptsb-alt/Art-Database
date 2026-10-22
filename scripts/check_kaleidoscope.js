// Frames of a kaleidoscope on the Artist Website, with the page's clock slowed so each held frame can be seen.
//
//   python3 -m http.server 8863 --directory docs &      (serve the site first)
//   NODE_PATH=$(npm root -g) node scripts/check_kaleidoscope.js --port 8863 --out <dir> [--work <id>] [--arrival kaleidoscope] [--slow 0.08]
//   NODE_PATH=$(npm root -g) node scripts/check_kaleidoscope.js --port 8863 --out <dir> --ring [--city florence-it] [--hold 3000] [--after 10] [--at 0.4,0.5] [--only 1440] [--dsf 1] [--size 900x600]
//
// Opens /v2/ at 390x844 (touch, 3x) and 1440x900 (2x), makes the next photograph to arrive come by the arrival
// named (Land.arrival), opens the work (Land.work) and photographs the art plate's veil every moment it is
// there, the page's clock running at `slow` of real time (performance.now and requestAnimationFrame, wrapped
// before the page loads). The work's picture is fetched from Artsy's CDN with curl, through the session's
// proxy (headless Chromium does not use it), and served to the page in its place. Writes <w>-<n>-<ms>.png
// (ms of page time since the veil appeared) and <w>-after.png; exits 1 on a page error or no frame.
//
// --pointed <name> sees a pointed effect (Land.pointed) the same way (13 Oct 2026, "kaleidoscope").
//
// --ring (14 Oct 2026, the rosette a held press opens): the clock is stopped and stepped one held frame (42 ms)
// at a time, so no frame is missed. Opens a city that is a map (a skyline takes the press itself, and a collage's
// reading covers the window with its own: neither draws a ring), presses and holds on the ground at --at (fractions of the window; a mouse on the desktop, a touch through
// the DevTools protocol on the phone), photographs a square of the window round the point at every held frame
// for --hold ms, lets go, and photographs --after more frames (the pulse going out on the same mirrors). Writes
// <w>-before.png, <w>-ring-<n>-<ms>.png and <w>-release-<n>-<ms>.png, and ring.json: how many tiles the rosette lights
// and the most times any one tile lights in a second (WCAG 2.3.1: three at most; Land.rosette gives the tiles,
// 8 s of hold at a frame a step). Exits 1 on a page error, a press that lands on something other than the stage (a column's
// text takes it: no ring opens there), no rosette, or a tile that lights more than 3 times a second.
//
// --scope (20 Oct 2026, a telescope photograph the pointer drops in the far views lands through the telescope's two
// mirrors): NASA's real search answer and thumbnails are fetched once with curl (headless Chromium does not use the
// session's proxy) and served to the page in place of the live ones, so the page measures and keeps them as it does.
// The world is brought far off (Land.globeAt) so the telescope is out, the clock is stopped and stepped a held frame
// at a time, and Land.shot drops one photograph through the mirrors; the CSS fade (a document animation, not
// on the page's clock) is held to the same time. Writes <w>-scope-<n>-<ms>.png round the photograph at every held frame,
// <w>-sky.png (the whole window with one landed), and scope.json: the photograph's size, how many different drawings the
// held frames made (4 steps of mirrors and the photograph), and the shots that came by the real route (the pointer moved
// across the sky at real speed: how many came through the mirrors and how many plain; one in phi^3 should be through).
// Exits 1 on a page error, no photograph, too few drawings, or no kaleidoscopic or no plain shot by the real route.
//
// --sweep (22 Oct 2026, the sweep of cells as a pentagram, going down into a city or coming up): the clock is stopped and
// stepped a held frame at a time, Land.sweep("rosette") begins one from the middle and one from a point pressed, and the whole
// window is photographed at every held frame (<w>-<middle|pressed>-<n>-<ms>.png). The #sweep canvas is read at each frame: how
// much of the window the squares cover (WCAG 2.3.1: one wave up and down, never three a second), and how long it lasts (a picture
// is never hidden over 1.5 s). Then, with #sweep made to take the pointer, what lies over it where the globe's own words, a
// city's column and a work's label and dial stand (nothing may be under the sweep), and last the real route: --trips trips down
// into a city and up again at real speed, counting which sweeps came (the star should come now and then, not every time), with a
// photograph of one when it does (<w>-wild.png). Writes sweep.json. Exits 1 on a page error, too few or too many frames, a sweep
// that covers more than a half of the window or turns about more than twice, anything over a thing it must not be, or no sweep
// at all on the real route (the star is expected on about one in five descents and ascents, so --trips 6 may show none: run again).
// docs/v2/KALEIDOSCOPE.md: a new kaleidoscope adds its own way of being seen here.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { openWindow, nasaStandIns, routeNasa, skySpots } = require("./nasa_standins");

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const PORT = arg("port", "8863");
const OUT = arg("out", fs.mkdtempSync(path.join(os.tmpdir(), "kal-")));
const WORK = arg("work", "4f9bcc20aa99be0001000727");          // Monet, The Japanese Footbridge (NGA)
const ARRIVAL = arg("arrival", "kaleidoscope");
const POINTED = arg("pointed", "");   // --pointed kaleidoscope: see the fold a mouse-over makes (13 Oct 2026)
const RING = process.argv.includes("--ring");
const SCOPE = process.argv.includes("--scope");
const SWEEP = process.argv.includes("--sweep");
const TRIPS = parseInt(arg("trips", "6"), 10);
const FROM = arg("from", "rosette");   // --sweep --from edges: another sweep, for comparison
const CITY = arg("city", "florence-it");
const HOLD = parseInt(arg("hold", "3000"), 10);
const AFTER = parseInt(arg("after", "10"), 10);
const AT = arg("at", "");             // x,y as fractions of the window; the default is each window's own
const SLOW = parseFloat(arg("slow", "0.08"));
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const ROOT = path.join(__dirname, "..");
const ONLY = arg("only", "");         // --only 1440: just that window
const DSF = arg("dsf", "");           // --dsf 1: a lighter density (a busy page is slow to draw on software GL)
const SIZE = arg("size", "");         // --size 900x600: one window of that size with a mouse
const WINDOWS = SIZE ? [[parseInt(SIZE.split("x")[0], 10), parseInt(SIZE.split("x")[1], 10), false, parseFloat(DSF || "1")]]
  : [[390, 844, true, 3], [1440, 900, false, 2]]
    .filter(w => !ONLY || String(w[0]) === ONLY)
    .map(w => DSF ? [w[0], w[1], w[2], parseFloat(DSF)] : w);

function picture() {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/v2/histories", WORK + ".json"), "utf8"));
  if (!h.image) { throw new Error("work " + WORK + " has no image"); }
  const file = path.join(OUT, "work.jpg");
  execFileSync("curl", ["-sS", "--max-time", "60", "-o", file, "https://d32dm0rphc51dk.cloudfront.net/" + h.image + "/large.jpg"]);
  return fs.readFileSync(file);
}

// The held ring (--ring): press, hold, let go, one held frame at a time.
async function ringFrames(browser, w, h, touch, dsf) {
  const { ctx, page, errors } = await openWindow(browser, w, h, touch, dsf);
  await page.route(/nasa\.gov|metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)|cloudfront/, r => r.abort());
  await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  await page.evaluate(() => Land.pace(false));
  await page.evaluate(k => Land.town(k), CITY);
  await page.waitForFunction(() => { const x = Land.where(); return x.at === "town" && !x.flying; }, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const fr = AT ? AT.split(",").map(parseFloat) : (touch ? [0.5, 0.39] : [0.36, 0.5]);
  const px = Math.round(w * fr[0]), py = Math.round(h * fr[1]);
  // What the press lands on: the stage (a canvas of the world, or the stage itself) takes it; anything else is that element's.
  const under = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? { name: e.id || String(e.className) || e.tagName, stage: e.tagName === "CANVAS" || e.id === "stage" } : null; }, [px, py]);
  const half = touch ? 200 : 300;
  const clip = { x: Math.max(0, px - half), y: Math.max(0, py - half), width: Math.min(w, 2 * half), height: Math.min(h - Math.max(0, py - half), 2 * half) };
  await page.screenshot({ path: path.join(OUT, `${w}-before.png`) });

  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const finger = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const step = async (name, n, t0) => {
    await page.evaluate(() => window.__advance(42));
    await settle();
    const ms = Math.round(await page.evaluate(() => performance.now()) - t0);
    await page.screenshot({ path: path.join(OUT, `${w}-${name}-${String(n).padStart(2, "0")}-${ms}.png`), clip });
  };

  await page.evaluate(() => window.__setSlow(0));
  const t0 = await page.evaluate(() => performance.now());
  if (touch) { await finger("touchStart", [{ x: px, y: py, id: 1, radiusX: 6, radiusY: 6, force: 1 }]); }
  else { await page.mouse.move(px, py); await page.mouse.down(); }
  let n = 0;
  for (let ms = 0; ms < HOLD; ms += 42) { await step("ring", n, t0); n += 1; }
  if (touch) { await finger("touchEnd", []); } else { await page.mouse.up(); }
  const t1 = await page.evaluate(() => performance.now());
  for (let m = 0; m < AFTER; m += 1) { await step("release", m, t1); }
  await page.evaluate(() => window.__setSlow(1));

  // What the rosette lights, and how often any one tile lights in a second.
  const stats = await page.evaluate(([x, y]) => {
    const states = [];
    const count = [];
    for (let held = 0; held <= 8000; held += 42) {
      const m = new Map();
      Land.rosette(held, x, y, 0.4).forEach(([i, j, tone, level]) => m.set(j * 8192 + i, tone + "|" + level));
      states.push(m);
      count.push(m.size);
    }
    const tiles = new Set();
    states.forEach(m => m.forEach((v, k) => tiles.add(k)));
    let maxOn = 0, maxChange = 0, worst = null;
    tiles.forEach(k => {
      const on = [], change = [];
      for (let f = 0; f < states.length; f += 1) {
        const now = states[f].get(k), was = f ? states[f - 1].get(k) : undefined;
        on.push(now !== undefined && was === undefined ? 1 : 0);
        change.push(now !== was ? 1 : 0);
      }
      for (let f = 0; f + 24 <= states.length; f += 1) {
        let a = 0, c = 0;
        for (let q = f; q < f + 24; q += 1) { a += on[q]; c += change[q]; }
        if (a > maxOn) { maxOn = a; worst = k; }
        if (c > maxChange) { maxChange = c; }
      }
    });
    return { lit: { at1s: count[24], at2s: count[48], at3s: count[72], at6s: count[143], max: Math.max.apply(null, count) },
             maxLightingsPerSecond: maxOn, maxChangesPerSecond: maxChange, worstTile: worst, tilesEverLit: tiles.size };
  }, [px, py]);

  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${w}-after.png`) });
  const out = { window: [w, h], city: CITY, press: [px, py], under, frames: n, after: AFTER, errors: errors.slice(0, 3), stats };
  console.log(w, JSON.stringify(out));
  await ctx.close();
  return { out, bad: errors.length > 0 || n === 0 || !(under && under.stage) || stats.lit.max < 10 || stats.maxLightingsPerSecond > 3 };
}

// The telescope's photograph through its mirrors (--scope): held frame by held frame, and by the real route.
async function scopeFrames(browser, w, h, touch, dsf, stand) {
  const { ctx, page, errors } = await openWindow(browser, w, h, touch, dsf);
  await routeNasa(page, stand);
  await page.addInitScript(() => {
    window.__added = { canvas: 0, img: 0 };
    window.__drawn = 0;
    // The shot's own 2.4 s clean-up runs on the real clock; held, it would take the shot away mid-sequence.
    const later = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) => later(fn, ms === 2400 ? 600000 : ms, ...a);
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...a) {
      if (this.canvas && this.canvas.classList && this.canvas.classList.contains("trail-shot")) { window.__drawn += 1; }
      return clear.apply(this, a);
    };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.classList && n.classList.contains("trail-shot")) { window.__added[n.tagName.toLowerCase()] += 1; }
    }))).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  await page.evaluate(() => Land.pace(false));
  // The world far off, so the telescope is out; the photographs measured.
  await page.evaluate(() => Land.globeAt(20, 10, 0.4));
  await page.waitForFunction(() => { const x = Land.shot(5, 5, "plain"); return x.tokens > 0 && x.shown; }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => { const d = Land.density(); return { R: d.R, cx: d.cx, cy: d.cy, W: d.W, H: d.H }; });
  // A point in the sky where a photograph lies wholly on the black (land.js onTheBlack), its clip on the window.
  const room = await skySpots(page, w, h);
  const far = room.filter(p => p[0] >= 110 && p[0] <= w - 110 && p[1] >= 110 && p[1] <= h - 110);
  const [px, py] = (far.length ? far : room).slice(-1)[0] || [110, 110];
  const half = 110;
  const clip = { x: Math.max(0, px - half), y: Math.max(0, py - half), width: 2 * half, height: 2 * half };
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => document.querySelectorAll(".trail-shot").length === 0, null, { timeout: 8000 }).catch(() => {});

  // 1. Held frame by held frame: the clock stopped, the photograph dropped through the mirrors.
  await page.evaluate(() => window.__setSlow(0));
  const dropped = await page.evaluate(([x, y]) => Land.shot(x, y, "through"), [px, py]);
  await page.waitForSelector("canvas.trail-shot", { timeout: 8000 }).catch(() => {});
  const t0 = await page.evaluate(() => performance.now());
  const sizes = await page.evaluate(() => { const c = document.querySelector("canvas.trail-shot"); if (!c) { return null; } const b = c.getBoundingClientRect(); return { cssW: Math.round(b.width), cssH: Math.round(b.height), px: c.width + "x" + c.height }; });
  let n = 0;
  for (let ms = 0; ms <= 1050 && n < 40; ms += 42) {
    if (ms) { await page.evaluate(() => window.__advance(42)); }
    await settle();
    const vms = Math.round(await page.evaluate(() => performance.now()) - t0);
    await page.evaluate(m => document.querySelectorAll(".trail-shot").forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = m; })), vms);
    await page.screenshot({ path: path.join(OUT, `${w}-scope-${String(n).padStart(2, "0")}-${vms}.png`), clip });
    n += 1;
  }
  await page.evaluate(() => window.__setSlow(1));
  // The drawings the shot's canvas was given (each held step clears it once): four of the mirrors and the photograph.
  const drawn = await page.evaluate(() => window.__drawn);

  // 2. The real route: the pointer across the sky at real speed; how many shots come through the mirrors, how many plain.
  await page.waitForFunction(() => document.querySelectorAll(".trail-shot").length === 0, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { window.__added.canvas = 0; window.__added.img = 0; });
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const finger = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const sky = [];
  for (let i = 0; i < 70; i += 1) {   // a zigzag along the top and bottom of the window, clear of the world
    const x = 40 + (i * 131) % (w - 80), y = i % 2 ? Math.max(40, info.cy - info.R * 1.5) : Math.min(h - 40, info.cy + info.R * 1.5);
    sky.push([Math.max(10, Math.min(w - 10, x)), Math.max(10, Math.min(h - 10, y))]);
  }
  if (touch) { await finger("touchStart", [{ x: sky[0][0], y: sky[0][1], id: 1, radiusX: 4, radiusY: 4, force: 1 }]); }
  else { await page.mouse.move(sky[0][0], sky[0][1]); await page.mouse.down(); }
  for (const [x, y] of sky) {
    if (touch) { await finger("touchMove", [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]); } else { await page.mouse.move(x, y, { steps: 2 }); }
    await page.waitForTimeout(90);
  }
  if (touch) { await finger("touchEnd", []); } else { await page.mouse.up(); }
  await page.waitForTimeout(600);
  const added = await page.evaluate(() => Object.assign({}, window.__added));
  // The whole window with a photograph that has just landed, for the eye.
  await page.evaluate(([x, y]) => { Land.shot(x, y, "through"); }, [px, py]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${w}-sky.png`) });

  const out = { window: [w, h], at: [Math.round(px), Math.round(py)], photograph: sizes, dropped, frames: n, drawings: drawn,
                steps: "5, 3.1, 1.9, 1.2 images, then the photograph (wedges 72, 116, 188, 305 deg)", realRoute: added, errors: errors.slice(0, 3) };
  console.log(w, JSON.stringify(out));
  await ctx.close();
  return { out, bad: errors.length > 0 || !sizes || n < 20 || drawn !== 5 || added.canvas < 1 || added.img < 1 };
}

// What the sweep lies over (--sweep): with #sweep made to take the pointer, the elements of `sels` that are visible and have
// the sweep above them at their middle (an element wholly under another is "hidden", not over). Nothing may be listed.
const overWhat = (page, sels) => page.evaluate(sels => {
  const sw = document.getElementById("sweep"), was = sw.style.pointerEvents, out = [], seen = [];
  sw.style.pointerEvents = "auto";
  sels.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height || b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight || el.closest("[hidden]")) { return; }
    if (!(el.textContent || "").trim() && !/^(IMG|CANVAS|INPUT)$/.test(el.tagName)) { return; }
    const list = document.elementsFromPoint(Math.min(innerWidth - 1, b.left + b.width / 2), Math.min(innerHeight - 1, b.top + b.height / 2));
    const s = list.indexOf(sw), e = list.findIndex(n => el.contains(n));
    seen.push(sel);
    if (e < 0) { return; }
    if (s >= 0 && s < e) { out.push(sel + (el.id ? "#" + el.id : "")); }
  }));
  sw.style.pointerEvents = was;
  return { over: out, looked: seen.length };
}, sels);

// The sweep as a pentagram (--sweep): held frame by held frame from the middle and from a point pressed, what it lies over,
// and the real route (trips down into a city and up again).
async function sweepFrames(browser, w, h, touch, dsf, jpg) {
  const { ctx, page, errors } = await openWindow(browser, w, h, touch, dsf);
  await page.route(/d32dm0rphc51dk\.cloudfront\.net/, r => r.fulfill({ status: 200, contentType: "image/jpeg", body: jpg }));
  await page.route(/nasa\.gov|metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)/, r => r.abort());
  await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  await page.evaluate(() => Land.pace(false));
  await page.waitForTimeout(2000);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // What the squares cover now, read off the #sweep canvas: the share of the window, and the pixels of them that lie over the
  // globe's dial's words, its names and the words at the world's foot (land.js starKept keeps the star off them: none may).
  const covered = () => page.evaluate(() => {
    const c = document.getElementById("sweep"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, k = c.width / innerWidth;
    let n = 0, over = 0;
    for (let i = 3; i < d.length; i += 4) { if (d[i]) { n += 1; } }
    const box = el => { const b = el.getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }; };
    const names = [...document.querySelectorAll('.city[data-named="true"]')].filter(el => el.style.visibility === "visible")
      .map(el => el.querySelector(".city-name")).filter(Boolean).map(box);
    const boxes = (window.GlobeDial && GlobeDial.boxes ? GlobeDial.boxes() : []).concat(names, ["#art-find", ".guide-world", "#filter", "#banner"]
      .map(s => document.querySelector(s)).filter(el => el && !el.hidden).map(box));
    boxes.forEach(b => {
      for (let y = Math.max(0, Math.floor(b.y0 * k)); y < Math.min(c.height, Math.ceil(b.y1 * k)); y += 1) {
        for (let x = Math.max(0, Math.floor(b.x0 * k)); x < Math.min(c.width, Math.ceil(b.x1 * k)); x += 1) { if (d[(y * c.width + x) * 4 + 3]) { over += 1; } }
      }
    });
    return { share: n / (c.width * c.height), over, boxes: boxes.length };
  });
  const out = { window: [w, h], runs: {}, layers: {}, errors: [] };
  let bad = false;

  // 1. Held frame by held frame: the clock stopped, the star begun from the middle and from a point pressed.
  for (const [name, fx, fy] of [["middle", 0.5, 0.5], ["pressed", 0.3, 0.38]]) {
    await page.evaluate(() => window.__setSlow(0));
    const began = await page.evaluate(([f, x, y]) => Land.sweep(f, x, y), [FROM, Math.round(w * fx), Math.round(h * fy)]);
    const t0 = await page.evaluate(() => performance.now());
    const series = [];
    let over = 0, boxes = 0;
    for (let n = 0; n < 60; n += 1) {
      if (n) { await page.evaluate(() => window.__advance(42)); }
      await settle();
      const live = await page.evaluate(() => !!Land.sweep());
      const ms = Math.round(await page.evaluate(() => performance.now()) - t0);
      if (!live) { break; }
      const c = await covered();
      series.push(c.share);
      over += c.over;
      boxes = Math.max(boxes, c.boxes);
      await page.screenshot({ path: path.join(OUT, `${w}-${name}-${String(n).padStart(2, "0")}-${ms}.png`) });
    }
    await page.evaluate(() => window.__setSlow(1));
    // Reversals of the share covered, ignoring wobbles under a fifth of its height: the wave coming up and going down is one.
    let turns = 0, dir = 0, from = series[0], top = Math.max(...series);
    series.forEach(c => {
      if (dir >= 0 && c < from - top * 0.2) { if (dir > 0) { turns += 1; } dir = -1; from = c; }
      else if (dir <= 0 && c > from + top * 0.2) { if (dir < 0) { turns += 1; } dir = 1; from = c; }
      else if ((dir > 0 && c > from) || (dir < 0 && c < from)) { from = c; }
    });
    const r = { origin: [Math.round(w * fx), Math.round(h * fy)], began, frames: series.length, seconds: +(series.length * 0.042).toFixed(2),
                drawings: new Set(series.map(c => c.toFixed(4))).size, mostCovered: +Math.max(...series).toFixed(3), turns,
                overTheirWords: over, wordBoxes: boxes };
    out.runs[name] = r;
    if (series.length < 14 || series.length > 36 || r.mostCovered > 0.5 || r.turns > 2 || r.drawings < series.length * 0.7 || over) { bad = true; }
    await page.waitForFunction(() => !Land.sweep(), null, { timeout: 5000 }).catch(() => {});
  }

  // 2. What it lies over, in a city and at a work (on the globe the cells keep clear of its words, above; in a city and at a work
  // the sweep's canvas lies under the column, the label and the dial's readout, as it does under whatever is dealt).
  const words = ["#finder", ".creature", ".say"];
  const city = ["#banner", "#art-col", "#art-time-year", "#building-time", ".art *", ".here *", "#deck *"];
  await page.evaluate(k => Land.town(k), CITY);
  await page.waitForFunction(() => { const x = Land.where(); return x.at === "town" && !x.flying; }, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  out.layers.town = await overWhat(page, words.concat(city));
  await page.evaluate(id => Land.work(id), WORK);
  await page.waitForFunction(() => { const x = Land.where(); return x.at === "work" && !x.flying; }, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  out.layers.work = await overWhat(page, words.concat(city, ["#art-plate *", "#art [class*=label]", "#art [class*=wall]"]));
  Object.values(out.layers).forEach(l => { if (l.over.length || !l.looked) { bad = true; } });
  await page.evaluate(() => Land.up());
  await page.waitForFunction(() => { const x = Land.where(); return x.at === "town" && !x.flying; }, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => Land.up());
  await page.waitForFunction(() => { const x = Land.where(); return x.at === "world" && !x.flying; }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 3. The real route: down into a city and up again at real speed, a poll every 30 ms for the sweeps that come.
  await page.evaluate(() => {
    window.__seen = {};
    window.__poll = setInterval(() => { const s = Land.sweep(); if (s && !window.__seen[s.at]) { window.__seen[s.at] = s.from; } }, 30);
  });
  let wild = false;
  // A photograph of the star if one is on within the second after a move (the screenshot is slower than the sweep: it may miss).
  const snap = async () => {
    for (let k = 0; k < 40 && !wild; k += 1) {
      if (await page.evaluate(() => { const s = Land.sweep(); return !!s && s.from === "rosette"; })) { await page.screenshot({ path: path.join(OUT, `${w}-wild.png`) }); wild = true; }
      await page.waitForTimeout(25);
    }
  };
  for (let t = 0; t < TRIPS; t += 1) {
    await page.evaluate(k => Land.town(k), CITY);
    await snap();
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "town" && !x.flying; }, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => Land.up());
    await snap();
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "world" && !x.flying; }, null, { timeout: 60000 });
    await page.waitForTimeout(800);
  }
  const seen = await page.evaluate(() => { clearInterval(window.__poll); return Object.values(window.__seen); });
  const kinds = {};
  seen.forEach(k => { kinds[k] = (kinds[k] || 0) + 1; });
  out.route = { trips: TRIPS, sweeps: seen.length, kinds, photographed: wild };
  if (!seen.length) { bad = true; }
  out.errors = errors.slice(0, 3);
  if (errors.length) { bad = true; }
  console.log(w, JSON.stringify(out));
  await ctx.close();
  return { out, bad };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jpg = (RING || SCOPE) ? null : picture();
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  let bad = 0;
  if (SWEEP) {
    const all = [];
    for (const [w, h, touch, dsf] of WINDOWS) {
      const r = await sweepFrames(browser, w, h, touch, dsf, jpg);
      all.push(r.out);
      if (r.bad) { bad += 1; }
    }
    fs.writeFileSync(path.join(OUT, "sweep.json"), JSON.stringify(all, null, 1));
    await browser.close();
    console.log("frames in", OUT);
    process.exit(bad ? 1 : 0);
  }
  if (SCOPE) {
    const stand = nasaStandIns(OUT);
    const all = [];
    for (const [w, h, touch, dsf] of WINDOWS) {
      const r = await scopeFrames(browser, w, h, touch, dsf, stand);
      all.push(r.out);
      if (r.bad) { bad += 1; }
    }
    fs.writeFileSync(path.join(OUT, "scope.json"), JSON.stringify(all, null, 1));
    await browser.close();
    console.log("frames in", OUT);
    process.exit(bad ? 1 : 0);
  }
  if (RING) {
    const all = [];
    for (const [w, h, touch, dsf] of WINDOWS) {
      const r = await ringFrames(browser, w, h, touch, dsf);
      all.push(r.out);
      if (r.bad) { bad += 1; }
    }
    fs.writeFileSync(path.join(OUT, "ring.json"), JSON.stringify(all, null, 1));
    await browser.close();
    console.log("frames in", OUT);
    process.exit(bad ? 1 : 0);
  }
  for (const [w, h, touch, dsf] of WINDOWS) {
    const { ctx, page, errors } = await openWindow(browser, w, h, touch, dsf);
    await page.route(/d32dm0rphc51dk\.cloudfront\.net/, r => r.fulfill({ status: 200, contentType: "image/jpeg", body: jpg }));
    await page.route(/nasa\.gov|metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)/, r => r.abort());
    await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
    const names = await page.evaluate(a => { Land.pace(false); return Land.arrival(a); }, POINTED ? "" : ARRIVAL);
    if (!POINTED && !names.includes(ARRIVAL)) { console.log(w, "no arrival named", ARRIVAL, "among", names.join(", ")); bad += 1; await ctx.close(); continue; }
    await page.evaluate(id => Land.work(id), WORK);
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "work" && !x.flying; }, null, { timeout: 30000 });
    if (POINTED) {
      await page.waitForTimeout(12000);   // past the first look's own arrival
      await page.evaluate(k => window.__setSlow(k), SLOW);
      const ok = await page.evaluate(n => Land.pointed(n, 0.3, 0.4).includes(n), POINTED);
      if (!ok) { console.log(w, "no pointed effect named", POINTED); bad += 1; await ctx.close(); continue; }
    } else { await page.evaluate(k => window.__setSlow(k), SLOW); }
    await page.waitForFunction(() => !!document.querySelector("#art-plate .deal-veil"), null, { timeout: 20000 }).catch(() => {});
    const t0 = await page.evaluate(() => performance.now());
    let n = 0;
    while (n < 80) {
      const s = await page.evaluate(() => {
        const v = document.querySelector("#art-plate .deal-veil");
        if (!v) { return null; }
        const r = v.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, t: performance.now() };
      });
      if (!s) { break; }
      await page.screenshot({ path: path.join(OUT, `${w}-${String(n).padStart(2, "0")}-${Math.round(s.t - t0)}.png`),
                              clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.w, w), height: Math.min(s.h, h) } });
      n += 1;
    }
    await page.evaluate(() => window.__setSlow(1));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${w}-after.png`) });
    console.log(w, "frames:", n, "errors:", errors.length ? errors.slice(0, 3) : "none");
    if (errors.length || !n) { bad += 1; }
    await ctx.close();
  }
  await browser.close();
  console.log("frames in", OUT);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

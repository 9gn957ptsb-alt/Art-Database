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
// docs/v2/KALEIDOSCOPE.md: a new kaleidoscope adds its own way of being seen here.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const PORT = arg("port", "8863");
const OUT = arg("out", fs.mkdtempSync(path.join(os.tmpdir(), "kal-")));
const WORK = arg("work", "4f9bcc20aa99be0001000727");          // Monet, The Japanese Footbridge (NGA)
const ARRIVAL = arg("arrival", "kaleidoscope");
const POINTED = arg("pointed", "");   // --pointed kaleidoscope: see the fold a mouse-over makes (13 Oct 2026)
const RING = process.argv.includes("--ring");
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

// The page's clock, wrapped before it loads: slowed by __setSlow(k) (1 is real time), or stopped with
// __setSlow(0) and moved on by __advance(ms), a held frame at a time.
function clockScript() {
  const realNow = performance.now.bind(performance);
  let base = 0, realBase = 0, f = 1;
  const virt = () => base + (realNow() - realBase) * f;
  window.__setSlow = k => { base = virt(); realBase = realNow(); f = k; };
  window.__advance = ms => { base += ms; };
  performance.now = virt;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(virt()));
}

async function openWindow(browser, w, h, touch, dsf) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(clockScript);
  return { ctx, page, errors };
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

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jpg = RING ? null : picture();
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  let bad = 0;
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

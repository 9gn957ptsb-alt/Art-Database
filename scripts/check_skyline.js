/* The cities' skylines, checked in a browser: what the cities' pass (docs/v2/grounds/REFINE.md) runs
   after it has cut a city finer or read it again, before it publishes.

   For each city asked for (default: every city with a skyline), at a phone's size (390×844, three device
   pixels to one, touch) and a desktop's (1440×900, two), it opens the city on the page and checks:

     drawn: the skyline is on, for that city, on the GPU (WebGL 2) at the screen's density — or, with
       --2d, on the 2D canvas from a ground no finer than its COARSE cells — with dots in it;
     made: the city was made into dots in under --budget ms (default 4000; headless Chromium is slow);
     named: its museums are on it, and at least one is named;
     time: turned to the dial's first years, less of it stands (the share risen goes down), and back;
     pressed: a named museum, pressed, goes into the museum, and up again brings the skyline back;
     quiet: no page error and no console error but the blocked hosts' (NASA, Artsy's images, Commons,
       Google Fonts are not reached from the sandbox).

     cd docs && python3 -m http.server 8911 &
     NODE_PATH=$(npm root -g) node scripts/check_skyline.js [--port 8911] [--sizes 390x844x3,1440x900x2]
         [--2d] [--budget 4000] [--shots DIR] [--ground key=path ...] [key ...]

   --ground serves a city's ground from a file in place of the published one (a cut not yet committed).
   Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function opt(name, dflt) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; }
const PORT = opt("--port", "8911");
const SIZES = opt("--sizes", "390x844x3,1440x900x2").split(",").map((s) => s.split("x").map(Number));
const BUDGET = +opt("--budget", "4000");
const SHOTS = opt("--shots", null);
const TWO_D = args.includes("--2d");
const GROUNDS = {};
args.forEach((a, i) => { if (args[i - 1] === "--ground") { const [k, p] = a.split("="); GROUNDS[k] = path.resolve(p); } });
const valued = new Set(["--port", "--sizes", "--budget", "--shots", "--ground"]);
let keys = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
const ROOT = path.resolve(__dirname, "..");
if (!keys.length) {
  const places = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/v2/cityplaces.json"), "utf8")).places;
  keys = places.filter((p) => fs.existsSync(path.join(ROOT, "docs/v2/grounds", p.slug + ".json"))).map((p) => p.key);
}
const BLOCKED = /nasa\.gov|artsy\.net|wikimedia|googleapis|gstatic|wikidata|openstreetmap/;

let failed = 0;
function check(tag, ok, what, detail) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (detail !== undefined ? " · " + detail : ""));
  if (!ok) { failed += 1; }
}

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined })
    .catch(() => chromium.launch());
  for (const [w, h, dpr] of SIZES) {
    const touch = w <= 720, size = w + "x" + h;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch,
                                           reducedMotion: "reduce" });
    if (TWO_D) { await ctx.addInitScript(() => { window.SKYLINE_2D = true; }); }
    const P = await ctx.newPage();
    const errors = [];
    P.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
    P.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) { errors.push(m.text().slice(0, 300)); } });
    P.on("requestfailed", (r) => { if (!BLOCKED.test(r.url()) && /grounds\/city-|skyline/.test(r.url())) { errors.push("failed: " + r.url()); } });
    await P.route(BLOCKED, (r) => r.abort());
    for (const k of Object.keys(GROUNDS)) {
      await P.route(new RegExp("grounds/city-" + k + "\\.json"), (r) => r.fulfill({ body: fs.readFileSync(GROUNDS[k]), contentType: "application/json" }));
    }
    await P.goto("http://localhost:" + PORT + "/v2/");
    await P.waitForFunction(() => window.Land && window.Skyline, null, { timeout: 90000 });
    await P.waitForTimeout(2500);
    for (const key of keys) {
      const tag = size + " " + key;
      errors.length = 0;
      await P.evaluate((k) => Land.town(k), key);
      const on = await P.waitForFunction((k) => Skyline.on() && Skyline.state().key === k && Skyline.state().count > 0, key, { timeout: 120000 })
        .then(() => true, () => false);
      check(tag, on, "the skyline is on");
      if (!on) { await P.evaluate(() => Land.up()); await P.waitForTimeout(3000); continue; }
      // Come from another city, the page may still be flying: the names are placed once it has landed.
      await P.waitForFunction(() => !Land.where().flying, null, { timeout: 30000 }).catch(() => {});
      await P.waitForTimeout(3500);
      let s = await P.evaluate(() => Skyline.state());
      check(tag, TWO_D ? !s.gpu : s.gpu, TWO_D ? "drawn on the 2D canvas" : "drawn on the GPU",
        s.count + (s.gpu ? " strips" : " dots") + ", " + s.n + " cells a side (" + Math.round(s.cell) + " m), density " + s.density);
      if (TWO_D) { check(tag, s.n <= 160, "the 2D canvas is given 160 cells a side or fewer", s.n); }
      else { check(tag, s.density === Math.min(3, dpr), "at the screen's density", s.density); }
      check(tag, s.ms < BUDGET, "made in under " + BUDGET + " ms", s.ms + " ms");
      const museums = s.marks.filter((m) => m.kind === "museum");
      check(tag, museums.length > 0 && museums.some((m) => m.named), "its museums on it, one named at least",
        museums.filter((m) => m.named).map((m) => m.name).join(", "));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await P.screenshot({ path: path.join(SHOTS, key + "-" + size + ".png") }); }
      // The dial: its first years stand less of the city than now.
      const first = await P.evaluate(() => { const d = Land.dial && Land.dial(); return d && d.y0 ? d.y0 : null; });
      if (first && s.years) {
        // The dial eases to a year turned to: wait for the skyline to stand at it.
        const at = async (y) => {
          await P.evaluate((y) => Land.dialYear(y), y);
          await P.waitForFunction((y) => Math.abs((Skyline.state().year || new Date().getFullYear()) - y) <= 2, y, { timeout: 15000 }).catch(() => {});
          await P.waitForTimeout(600);
          return P.evaluate(() => Skyline.state().shown);
        };
        const early = await at(first + 1);
        const late = await at(new Date().getFullYear());
        check(tag, early < late, "turned to " + (first + 1) + ", less of it stands", early.toFixed(3) + " < " + late.toFixed(3));
      } else if (!s.years) {
        console.log("  --   " + tag + " · its buildings' years are not in its ground yet: the dial not checked");
      }
      // A named museum, pressed, goes in; up again, the skyline is back.
      const named = museums.find((m) => m.named && !m.hidden);
      if (named) {
        await P.evaluate((name) => {
          const b = [...document.querySelectorAll(".skyline-museum[data-named]")].find((e) => e.textContent === name);
          if (b) { b.click(); if (matchMedia("(pointer: coarse)").matches) { b.click(); } }
        }, named.name);
        const inside = await P.waitForFunction(() => Land.where().at === "museum", null, { timeout: 30000 }).then(() => true, () => false);
        check(tag, inside, "pressed, " + named.name + " goes into its museum", JSON.stringify(await P.evaluate(() => Land.where())));
        if (inside) {
          await P.waitForTimeout(2000);
          await P.evaluate(() => Land.up());
          const back = await P.waitForFunction((k) => Skyline.on() && Skyline.state().key === k, key, { timeout: 30000 }).then(() => true, () => false);
          check(tag, back, "up from the museum, the skyline is back");
        }
      }
      check(tag, !errors.length, "no page errors", errors.slice(0, 3).join(" | "));
      // Up to the world, and settled there, before the next city.
      await P.evaluate(() => Land.up());
      await P.waitForFunction(() => Land.where().at === "world" && !Land.where().flying, null, { timeout: 30000 }).catch(() => {});
      await P.waitForTimeout(1500);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? failed + " failed" : "all passed");
  process.exit(failed ? 1 : 0);
})();

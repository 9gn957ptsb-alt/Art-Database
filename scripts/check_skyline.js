/* The cities' skylines, checked in a browser: what the cities' pass (docs/v2/grounds/REFINE.md) runs
   after it has cut a city finer or read it again, before it publishes.

   For each city asked for (default: every city with a skyline), at a phone's size (390×844, three device
   pixels to one, touch) and a desktop's (1440×900, two), it opens the city on the page and checks:

     drawn: the skyline is on, for that city, on the GPU (WebGL 2) at the screen's density — or, with
       --2d, on the 2D canvas from a ground no finer than its COARSE cells — with dots in it;
     made: the city was made into dots in under --budget ms (default 4000; headless Chromium is slow);
     named: its museums are on it, and at least one is named;
     time: turned to the dial's first years, less of it stands (the share risen goes down), and back;
     ground: the dial lies on the city's ground, its ring wholly in the city's band, its animal (the hand) at
       the dial's year;
     pressed: a named museum, pressed, goes into the museum, and up again brings the skyline back; and each
       Architecture building set into the city (one with its own spot in its square), pressed, opens its
       own view, and up again brings the skyline back;
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
      // Its museums named: names come once the city has settled, and on a phone a long one may not fit
      // beside its museum as the city stands, so they are waited for, the city turned a quarter at a time.
      let turns = 0, named = [];
      for (; turns < 4; turns += 1) {
        if (turns) { await P.evaluate(() => Skyline.key("ArrowRight")); await P.waitForTimeout(1500); }
        named = await P.waitForFunction(() => {
          const a = Skyline.state().marks.filter((m) => m.kind === "museum" && m.named).map((m) => m.name);
          return a.length ? a : null;
        }, null, { timeout: 6000 }).then((h) => h.jsonValue(), () => []);
        if (named.length) { break; }
      }
      s = await P.evaluate(() => Skyline.state());
      const museums = s.marks.filter((m) => m.kind === "museum");
      check(tag, museums.length > 0 && named.length > 0, "its museums on it, one named at least",
        named.join(", ") + (turns ? " (turned " + turns + " quarter" + (turns > 1 ? "s" : "") + ")" : ""));
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await P.screenshot({ path: path.join(SHOTS, key + "-" + size + ".png") }); }
      // The dial: its first years stand less of the city than now.
      const first = await P.evaluate(() => { const d = Land.dial && Land.dial(); return d && d.y0 ? d.y0 : null; });
      if (first && s.years) {
        // The dial eases to a year turned to a few percent of the way a frame, and the skyline follows it a
        // few seconds behind, so a city of 400,000 strips in headless Chromium's software GL (0.4 s a
        // frame) takes a minute to arrive: wait for the skyline to stand at the year or to have come a
        // tenth of the dial's way toward it (`dir`: down going back, up coming forward), whichever is first.
        const at = async (y, dir, from) => {
          await P.evaluate((y) => Land.dialYear(y), y);
          await P.waitForFunction((a) => {
            const s = Skyline.state();
            return Math.abs((s.year || new Date().getFullYear()) - a.y) <= 2 || a.dir * (s.shown - a.from) >= 0.1;
          }, { y, dir, from }, { timeout: 90000 }).catch(() => {});
          await P.waitForTimeout(600);
          return P.evaluate(() => Skyline.state().shown);
        };
        const rest = await P.evaluate(() => Skyline.state().shown);
        const early = await at(first + 1, -1, rest);
        const late = await at(new Date().getFullYear(), 1, early);
        check(tag, early < late, "turned to " + (first + 1) + ", less of it stands", early.toFixed(3) + " < " + late.toFixed(3));
      } else if (!s.years) {
        console.log("  --   " + tag + " · its buildings' years are not in its ground yet: the dial not checked");
      }
      // The dial laid on its ground (skyline.js, "the ground dial"): its ring wholly in the band, round the
      // city, its animal (or the diamond, where the place has none drawn) at the dial's year.
      // The dial eases to its year and the animal walks after it at its own pace, a few seconds behind in headless
      // Chromium's software GL (a city of 400,000 strips draws two frames a second, and the dial takes a minute
      // to come to rest): wait for the dial to rest and the animal to arrive, as the skyline's own year was
      // waited for. A city where few buildings are dated changes little with the year (Venice's `shown` runs
      // 0.72 to 1.0), so the wait above ends while the dial is still on its way.
      await P.evaluate(() => { window.__dialT = undefined; });
      await P.waitForFunction(() => {
        const h = Skyline.hand(), d = Land.dial();
        if (!h || !d || typeof d.t !== "number") { return true; }
        const rest = window.__dialT !== undefined && Math.abs(d.t - window.__dialT) < 0.002;
        window.__dialT = d.t;
        return rest && Math.abs(h.t - d.t) < 0.01;
      }, null, { timeout: 120000, polling: 700 }).catch(() => {});
      const gd = await P.evaluate(() => ({ on: !!(Land.dialGround && Land.dialGround.on()), ring: Skyline.ring(), hand: Skyline.hand(),
                                          t: Land.dial() ? Land.dial().t : null, band: Skyline.state().band }));
      check(tag, gd.on && !!gd.ring && !!gd.hand, "its dial lies on its ground", gd.hand ? (gd.hand.name || "the diamond") : JSON.stringify(gd));
      if (gd.ring && gd.band) {
        const b = gd.band, r = gd.ring;
        check(tag, r.cx - r.R >= b.x - 1 && r.cx + r.R <= b.x + b.w + 1 && r.cy - r.ry >= b.y - 1 && r.cy + r.ry <= b.y + b.h + 1,
          "its ring wholly in the city's band", [Math.round(r.cx - r.R), Math.round(r.cy - r.ry), Math.round(r.cx + r.R), Math.round(r.cy + r.ry)].join(","));
      }
      if (gd.hand && gd.t !== null) { check(tag, Math.abs(gd.hand.t - gd.t) < 0.02, "its hand at the dial's year", gd.hand.t.toFixed(3) + " ~ " + gd.t.toFixed(3)); }
      // A named museum, pressed, goes in; up again, the skyline is back.
      const one = museums.find((m) => m.named && !m.hidden);
      if (one) {
        await P.evaluate((name) => {
          const b = [...document.querySelectorAll(".skyline-museum[data-named]")].find((e) => e.textContent === name);
          if (b) { b.click(); if (matchMedia("(pointer: coarse)").matches) { b.click(); } }
        }, one.name);
        const inside = await P.waitForFunction(() => Land.where().at === "museum", null, { timeout: 30000 }).then(() => true, () => false);
        check(tag, inside, "pressed, " + one.name + " goes into its museum", JSON.stringify(await P.evaluate(() => Land.where())));
        if (inside) {
          await P.waitForTimeout(2000);
          await P.evaluate(() => Land.up());
          const back = await P.waitForFunction((k) => Skyline.on() && Skyline.state().key === k, key, { timeout: 30000 }).then(() => true, () => false);
          check(tag, back, "up from the museum, the skyline is back");
        }
      }
      // Each Architecture building set into the city, pressed (named or not: its 24 px target), opens its own
      // view; up again, the skyline is back.
      const blds = (await P.evaluate(() => Skyline.state())).marks.filter((m) => m.kind === "building");
      for (const bl of blds) {
        await P.waitForFunction((k) => Skyline.on() && Skyline.state().key === k && !Land.where().flying, key, { timeout: 30000 }).catch(() => {});
        await P.waitForTimeout(1500);
        const pressed = await P.evaluate((name) => {
          const b = [...document.querySelectorAll(".skyline-building")].find((e) => e.textContent === name && !e.hidden);
          if (!b) { return false; }
          b.click(); if (matchMedia("(pointer: coarse)").matches) { b.click(); }
          return true;
        }, bl.name);
        check(tag, pressed, "the building " + bl.name + " is set into the city, pressable");
        if (!pressed) { continue; }
        const open = await P.waitForFunction(() => Land.where().at === "building" && !Land.where().flying, null, { timeout: 30000 }).then(() => true, () => false);
        check(tag, open, "pressed, " + bl.name + " opens its own view", JSON.stringify(await P.evaluate(() => Land.where())));
        if (open) {
          await P.waitForTimeout(2000);
          await P.evaluate(() => Land.up());
          const back = await P.waitForFunction((k) => Skyline.on() && Skyline.state().key === k, key, { timeout: 30000 }).then(() => true, () => false);
          check(tag, back, "up from " + bl.name + ", the skyline is back");
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

/* Walk the building, in every museum: opens each museum on the Artist
   Website, goes in by "Walk the building", walks, stands before a hung work
   and looks at it (where one hangs), climbs back out level by level and
   leaves by the banner — at a phone's size with touch and a desktop's with
   keys — and fails on any page error.

     cd docs && python3 -m http.server 8863 &
     NODE_PATH=$(npm root -g) node scripts/smoke_walk.js [--only slug,slug] [--sizes 390x844,1440x900]
         [--jobs 4] [--reduced] [--shots DIR] [--port 8863]

   Artsy's picture store, NASA and the museums' services are stood in for
   (page.route): a generated gradient, never a real picture. Shots go where
   --shots says, never into the repository. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); }
const PORT = +arg("port", 8863);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const JOBS = +arg("jobs", 4);
const REDUCED = !!arg("reduced", false);
const SHOTS = arg("shots", null);
const ROOT = path.join(__dirname, "..", "docs", "v2");
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);

const museums = JSON.parse(fs.readFileSync(path.join(ROOT, "museums.json"), "utf8")).museums;
let slugs = museums.map(m => m.slug);
if (arg("only", null)) { const only = String(arg("only")).split(","); slugs = slugs.filter(s => only.includes(s)); }

async function standIn(browser) {
  const p = await browser.newPage();
  const b64 = await p.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 300; c.height = 400;
    const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 300, 400);
    gr.addColorStop(0, "#7a98a6"); gr.addColorStop(0.5, "#868066"); gr.addColorStop(1, "#a1a293");
    g.fillStyle = gr; g.fillRect(0, 0, 300, 400);
    g.strokeStyle = "#eadfcd"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 400); g.lineTo(300, 0); g.stroke();
    return c.toDataURL("image/jpeg", 0.8).split(",")[1];
  });
  await p.close();
  return Buffer.from(b64, "base64");
}

async function session(browser, size, jpg) {
  const [w, h] = size.split("x").map(Number);
  const touch = w <= 720;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch,
                                         reducedMotion: REDUCED ? "reduce" : "no-preference" });
  await ctx.addInitScript(() => { try { localStorage.setItem("globe-layer", "museums"); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => {
    if (m.type() !== "error") { return; }
    const t = m.text();
    if (/net::|ERR_|Failed to load resource/.test(t)) { return; }
    errors.push("console: " + t);
  });
  await page.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov/, r => r.fulfill({ status: 200, contentType: "image/jpeg", body: jpg }));
  await page.route(/metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)/, r => r.abort());
  await page.goto("http://localhost:" + PORT + "/v2/", { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  return { ctx, page, errors, touch, w, h };
}

const until = (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms || 10000 });

async function touchDrag(page, x, y, dx, dy, steps) {
  const c = await page.context().newCDPSession(page);
  const pt = (px, py) => [{ x: px, y: py, id: 1 }];
  await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(x, y) });
  for (let i = 1; i <= steps; i += 1) {
    await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(x + dx * i / steps, y + dy * i / steps) });
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(600);
  await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await c.detach();
}

async function pinchIn(page, x, y) {
  const c = await page.context().newCDPSession(page);
  const two = d => [{ x: x - d, y, id: 1 }, { x: x + d, y, id: 2 }];
  await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: two(120) });
  for (const d of [100, 80, 60, 40]) { await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: two(d) }); await page.waitForTimeout(30); }
  await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await c.detach();
}

async function one(s, slug, size) {
  const { page } = s;
  const r = { slug, size, ok: false, steps: [] };
  s.steps = r.steps;
  const step = t => r.steps.push(t);
  const e0 = s.errors.length;
  await page.evaluate(sl => Land.museum(sl), slug);
  await until(page, sl => { const w = Land.where(); const g = document.querySelector(".walk-go");
    return w.at === "museum" && !w.flying && g && !g.hidden && document.getElementById("banner-city").textContent; }, slug, 45000);
  step("building");
  if (SHOTS) { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, slug + "-0-building-" + size + ".png") }); }
  await page.click(".walk-go");
  await until(page, () => { const i = Land.inside(); return i && i.level === "plan"; }, null, 10000);
  step("plan");
  r.back = await page.evaluate(() => document.getElementById("banner-back").textContent.trim());
  if (SHOTS) { await page.waitForTimeout(1800); await page.screenshot({ path: path.join(SHOTS, slug + "-1-plan-" + size + ".png") }); }
  await page.keyboard.press("+");
  await until(page, () => Land.inside().level === "walk", null, 8000);
  step("walk");
  await page.waitForTimeout(REDUCED ? 200 : 1800);
  const a = await page.evaluate(() => Land.inside());
  const band = await page.evaluate(() => document.querySelector(".walk-view").getBoundingClientRect().toJSON());
  if (s.touch) { await touchDrag(page, band.x + band.width / 2, band.y + band.height * 0.6, 0, -band.height * 0.2, 8); }
  else { await page.keyboard.down("ArrowUp"); await page.waitForTimeout(900); await page.keyboard.up("ArrowUp"); }
  await page.waitForTimeout(300);
  const b = await page.evaluate(() => Land.inside());
  r.moved = Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(b.a - a.a);
  // A wall right ahead: turn round and try again.
  if (r.moved < 0.2) {
    await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(1800); await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowUp"); await page.waitForTimeout(900); await page.keyboard.up("ArrowUp");
    const c = await page.evaluate(() => Land.inside());
    r.moved = Math.hypot(c.x - a.x, c.y - a.y);
  }
  const st = await page.evaluate(() => Walk.stats());
  r.frames = st.frames; r.dot = st.dot; r.res = st.w + "x" + st.h;
  r.mean = +st.mean.toFixed(1); r.p95 = +st.p95.toFixed(1);
  r.shell = await page.evaluate(() => !!(Walk.world() && Walk.world().shell));
  r.under = await page.evaluate(() => document.getElementById("banner-under").textContent);
  if (SHOTS) { await page.screenshot({ path: path.join(SHOTS, slug + "-2-walk-" + size + ".png") }); }
  step("moved " + r.moved.toFixed(2));
  r.hung = await page.evaluate(() => Walk.hung().length);
  if (r.hung) {
    const id = await page.evaluate(() => Walk.hung()[0].id);
    await page.evaluate(i => Walk.goTo(i), id);
    await until(page, i => { const x = Land.inside(); return x.standing === i && !x.gliding; }, id, 25000);
    step("before a work");
    // What it is, at once, beside it: its title and its artist.
    await until(page, () => { const l = document.querySelector(".walk-label");
      return l && !l.hidden && l.querySelector(".walk-l-t[data-on=true]") && (!document.querySelector(".walk-label .walk-l-by") || l.querySelector(".walk-l-by[data-on=true]")); }, null, 4000);
    step("label");
    // Step back, then press the work itself (a tap on a phone, a click on a desktop): the look opens,
    // walking there first if it is far.
    const near = await page.evaluate(i => Walk._workOnScreen(i), id);
    if (s.touch) { await touchDrag(page, band.x + band.width / 2, band.y + band.height * 0.3, 0, band.height * 0.4, 10); }
    else { await page.keyboard.down("ArrowDown"); await page.waitForTimeout(2600); await page.keyboard.up("ArrowDown"); }
    await page.waitForTimeout(500);
    const at = (await page.evaluate(i => Walk._workOnScreen(i), id)) || near;
    r.pressedFrom = at ? +at.d.toFixed(1) : null;
    if (at) {
      r.press = await page.evaluate(p => { const e = document.elementFromPoint(p.x, p.y); const pk = Walk._pickAt(p.x, p.y);
        return { el: e ? e.className || e.tagName : null, pick: pk, state: Land.inside() }; }, at);
      if (s.touch) { await page.touchscreen.tap(at.x, at.y); } else { await page.mouse.click(at.x, at.y); }
      await until(page, () => Land.inside().level === "look", null, 25000);
      step("look by a press");
    } else {
      await page.keyboard.press("Enter");
      await until(page, () => Land.inside().level === "look", null, 25000);
      step("look by Enter");
    }
    // The label directly under the picture, whole at once.
    const lab = await page.evaluate(() => {
      const plate = document.querySelector(".walk-look-plate"), lines = document.querySelector(".walk-look-lines");
      const t = lines && lines.querySelector(".walk-l-t");
      if (!plate || !t) { return null; }
      const pb = plate.getBoundingClientRect(), lb = lines.getBoundingClientRect();
      return { title: t.textContent, on: lines.querySelectorAll(".walk-l[data-on=true]").length, under: lb.top >= pb.bottom - 2 };
    });
    if (!lab || !lab.title || !lab.under || lab.on < 3) { throw new Error("the look's label: " + JSON.stringify(lab)); }
    r.title = lab.title;
    step("label under the picture");
    if (SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(SHOTS, slug + "-3-look-" + size + ".png") }); }
    if (s.touch) { await page.tap(".walk-look-x"); } else { await page.keyboard.press("Escape"); }
    await until(page, () => Land.inside().level === "walk", null, 6000);
    step("back to the walk");
  }
  // Up, a level at a time: pinching in on a phone, Escape on a desktop.
  if (s.touch) { await pinchIn(page, band.x + band.width / 2, band.y + band.height / 2); } else { await page.keyboard.press("Escape"); }
  await until(page, () => Land.inside() && Land.inside().level === "plan", null, 8000);
  step("up to the plan");
  // And out at once by the banner's way back.
  await page.click("#banner-back");
  await until(page, () => !Land.inside() && Land.where().at === "museum", null, 8000);
  await until(page, () => { const g = document.querySelector(".walk-go"); return g && !g.hidden; }, null, 8000);
  step("out");
  r.errors = s.errors.slice(e0);
  r.ok = !r.errors.length && r.moved >= 0.2 && r.frames > 0;
  return r;
}

(async () => {
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); }
  const browser = await chromium.launch({ executablePath: EXE });
  const jpg = await standIn(browser);
  const results = [];
  for (const size of SIZES) {
    const queue = slugs.slice();
    await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
      let s = await session(browser, size, jpg);
      while (queue.length) {
        const slug = queue.shift();
        let r;
        try { r = await one(s, slug, size); }
        catch (e) {
          r = { slug, size, ok: false, error: String(e.message || e).split("\n")[0], errors: s.errors.slice(-3), steps: s.steps };
          await s.ctx.close();
          s = await session(browser, size, jpg);
        }
        results.push(r);
        console.log((r.ok ? "ok  " : "FAIL") + " " + size + " " + slug +
          (r.ok ? "  moved " + r.moved.toFixed(1) + " m · " + r.hung + " hung" + (r.pressedFrom !== undefined ? " · pressed from " + r.pressedFrom + " m" : "") + " · " + r.res + " dots · " + r.mean + " ms" + (r.shell ? " · shell" : "")
                : "  " + (r.error || "") + " " + JSON.stringify(r.steps || []) + " " + JSON.stringify(r.errors || [])));
      }
      await s.ctx.close();
    }));
  }
  await browser.close();
  const bad = results.filter(r => !r.ok);
  console.log("\n" + (results.length - bad.length) + " of " + results.length + " passed");
  if (arg("json", null)) { fs.writeFileSync(arg("json"), JSON.stringify(results, null, 1)); }
  process.exit(bad.length ? 1 : 0);
})();

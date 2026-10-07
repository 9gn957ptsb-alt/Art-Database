/* The small globe is one thing in every reading (artist, 7 Oct 2026: "make
   sure the globe is consistent across all types of layouts"; and "if there
   is a globe in view … bigger and smaller however they please"). Opens each
   view that reads in the lens — a work's history (from a museum's row), a
   life, a movement, a thread, a town's "Born here" — at a phone's size with
   touch and a desktop's with a mouse, and checks:

     at rest the whole Earth in its window: k = 1, the globe's radius 0.86 of
       the window's, its middle the window's, no DIRT ground in it;
     no empty band: a picture shown, or the band closed (noPicture);
     a drag on it turns it; two fingers (touch) landing outside its rim, or a
       wheel beside it (desktop), make it bigger; Escape brings it home;
     the round "+" / "−" buttons make it bigger and smaller.

     cd docs && python3 -m http.server 8898 &
     NODE_PATH=$(npm root -g) node scripts/check_globes.js [--port 8898] [--sizes 390x844,1440x900] [--shots DIR]

   Artsy's picture store and NASA are stood in for (page.route): a flat
   picture, never a real one. Exits 1 on any failure or page error. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8898);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const SHOTS = arg("shots", null);
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
// A stand-in picture (a flat gradient) for every picture asked for.
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a7a60"/><stop offset="1" stop-color="#3a3530"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/></svg>';

const VIEWS = [
  { name: "work, from a museum", open: async (P) => {
      await P.evaluate(() => Land.museum("museum-pushkin-museum-of-fine-arts"));
      for (let i = 0; i < 40; i++) {
        await P.waitForTimeout(500);
        const hit = await P.evaluate(() => {
          const b = [...document.querySelectorAll("button, a, [role=button], li, .held-work, [data-id]")]
            .find((e) => /Self Portrait Dedicated/i.test(e.textContent || e.getAttribute("aria-label") || ""));
          if (b) { b.scrollIntoView({ block: "center" }); b.click(); }
          return !!b;
        });
        if (hit) { break; }
      }
    }, kind: "work" },
  { name: "life", open: (P) => P.evaluate(() => Lives.open("pablo-picasso")), kind: "life" },
  { name: "movement", open: (P) => P.evaluate(() => Movements.open("mv-new-york-1948")), kind: "movement" },
  { name: "thread", open: (P) => P.evaluate(() => Land.thread("019ad704")), kind: "thread" },
  // The artist's state of 7 Oct 2026: a work opened while an animal is followed (its sprite over the lens), the dial turned.
  { name: "work, following the fox, dial turned", open: async (P) => {
      await P.evaluate(() => Characters.lead("fox").then((f) => f && Land.follow(f)));
      await P.waitForTimeout(12000);
      await P.evaluate(() => Land.work("516cc063fdc441ac440001af"));
    }, kind: "work", after: (P) => P.evaluate(() => Land.dialYear(1933)) },
  { name: "born here", open: (P) => P.evaluate(() => fetch("lives.json").then((r) => r.json())
      .then((d) => Lives.openMark(d.marks.find((m) => m[7] === "Memphis")))), kind: "life" },
];

const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}

async function run(size) {
  const [w, h] = size.split("x").map(Number), touch = w <= 720;
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("globe-layer", "museums"); } catch (e) {} });
  const P = await ctx.newPage();
  const cdp = await ctx.newCDPSession(P);
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const touchAt = async (pts, type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  const pinch = async (cx, cy, d0, d1) => {
    const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
    await touchAt([pts(d0)[0]], "touchStart");
    await touchAt(pts(d0), "touchStart");
    for (let i = 1; i <= 12; i++) { await touchAt(pts(d0 + (d1 - d0) * i / 12), "touchMove"); await P.waitForTimeout(25); }
    await touchAt([], "touchEnd");
  };
  const drag = async (x0, y0, x1, y1) => {
    if (touch) {
      await touchAt([{ x: x0, y: y0, id: 1 }], "touchStart");
      for (let i = 1; i <= 8; i++) { await touchAt([{ x: x0 + (x1 - x0) * i / 8, y: y0 + (y1 - y0) * i / 8, id: 1 }], "touchMove"); await P.waitForTimeout(25); }
      await touchAt([], "touchEnd");
    } else { await P.mouse.move(x0, y0); await P.mouse.down(); await P.mouse.move(x1, y1, { steps: 8 }); await P.mouse.up(); }
  };
  const tap = async (x, y) => {
    if (touch) { await touchAt([{ x, y, id: 1 }], "touchStart"); await touchAt([], "touchEnd"); } else { await P.mouse.click(x, y); }
  };
  const state = () => P.evaluate(() => Land.reading());
  const buttons = () => P.evaluate(() => {
    const box = document.querySelector(".lens-zoom");
    return box && !box.hidden ? [...box.querySelectorAll("button")].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }) : null;
  });
  const settle = async () => { for (let i = 0; i < 30; i++) { const r = await state(); if (r && !r.flying && !r.snapping && !r.travelling) { return r; } await P.waitForTimeout(200); } return state(); };

  await P.goto("http://localhost:" + PORT + "/v2/", { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 40000 });
  await P.waitForTimeout(800);
  for (const v of VIEWS) {
    const tag = size + " " + v.name;
    console.log(tag);
    await v.open(P);
    let r = null;
    for (let i = 0; i < 60 && !(r && r.kind === v.kind && !r.flying); i++) { await P.waitForTimeout(300); r = await state(); }
    if (!r) { check(tag, false, "opened"); continue; }
    // A work's first look ends on any touch.
    if (r.look === "plate") { await tap(r.at.x, r.at.y); }
    await P.waitForTimeout(4000);       // a view with no picture closes its band after 3 s
    if (v.after) { await v.after(P); await P.waitForTimeout(1500); }
    r = await settle();
    check(tag, r.kind === v.kind, "the view", r.kind);
    check(tag, Math.abs(r.k - 1) < 0.01, "at rest (k 1)", r.k);
    check(tag, Math.abs(r.R / r.rest - 1) < 0.03 && Math.abs(r.rest / r.at.r - 0.86) < 0.01, "the whole Earth, 0.86 of its window",
          { R: Math.round(r.R), window: r.at.r });
    check(tag, Math.hypot(r.cx - r.at.x, r.cy - r.at.y) < 2, "in the middle of its window", { cx: r.cx, cy: r.cy });
    check(tag, !r.ground, "no ground in it");
    check(tag, r.plateShown || r.noPicture, "no empty band", { plate: r.plateShown, closed: r.noPicture });
    if (SHOTS) { await P.screenshot({ path: SHOTS + "/" + size + "-" + v.name.replace(/\W+/g, "-") + ".png" }); }
    const L = r.at;
    // A drag on it turns it.
    const under = await P.evaluate((p) => { const e = document.elementFromPoint(p.x, p.y); return e ? (e.id || e.className || e.tagName) : null; }, { x: L.x - L.r * 0.3, y: L.y });
    await drag(L.x - L.r * 0.3, L.y, L.x + L.r * 0.3, L.y + 6);
    await P.waitForTimeout(400);
    let r2 = await state();
    check(tag, Math.abs(r2.lon - r.lon) > 0.5 && r2.kind === v.kind, "a drag turns it", { lon0: +r.lon.toFixed(2), lon1: +r2.lon.toFixed(2), under });
    // Bigger however the fingers land: outside the rim (touch), a wheel beside it (desktop).
    if (touch) { await pinch(L.x, L.y - L.r - 24, 60, 200); }
    else { await P.mouse.move(L.x + L.r + 18, L.y - L.r * 0.5); for (let i = 0; i < 5; i++) { await P.mouse.wheel(0, -100); await P.waitForTimeout(40); } }
    await P.waitForTimeout(600);
    r2 = await state();
    check(tag, r2 && r2.k > 1.3, touch ? "two fingers outside the rim make it bigger" : "a wheel beside it makes it bigger", r2 && r2.k);
    await P.keyboard.press("Escape");
    await P.waitForTimeout(900);
    r2 = await settle();
    check(tag, r2 && Math.abs(r2.k - 1) < 0.01 && r2.kind === v.kind, "Escape brings it home", r2 && r2.k);
    // The buttons.
    const b = await buttons();
    check(tag, !!b && b.length === 2 && b.every((x) => x.w >= 24), "a + and a − of 24 px or more", b && b.map((x) => x.w));
    if (b) {
      await tap(b[0].x, b[0].y); await P.waitForTimeout(500);
      r2 = await state();
      check(tag, r2.k > 1.1, "+ makes it bigger", r2.k);
      const b2 = await buttons();
      await tap(b2[1].x, b2[1].y); await P.waitForTimeout(500);
      await tap(b2[1].x, b2[1].y); await P.waitForTimeout(500);
      r2 = await state();
      check(tag, r2.k < 1 && r2.kind === v.kind, "− makes it smaller, never out of the view", r2.k);
      await P.keyboard.press("Escape"); await P.waitForTimeout(900);
    }
    // Up to the world for the next.
    for (let i = 0; i < 5; i++) {
      if (await P.evaluate(() => Land.where().at === "world")) { break; }
      await P.evaluate(() => Land.up());
      await P.waitForTimeout(3000);
    }
  }
  errors.forEach((e) => check(size, false, "page error", e));
  await browser.close();
}

(async () => {
  for (const s of SIZES) { await run(s); }
  console.log(fails.length ? "\n" + fails.length + " failed" : "\nall passed");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

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
const ONLY = arg("only", null);       // a view's name, in part: --only born
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
// A stand-in picture (a flat gradient) for every picture asked for.
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><defs><linearGradient id="g"><stop offset="0" stop-color="#8a7a60"/><stop offset="1" stop-color="#3a3530"/></linearGradient></defs><rect width="300" height="400" fill="url(#g)"/></svg>';

const VIEWS = [
  { name: "work, from a museum", open: async (P) => {
      await P.evaluate(() => Land.museum("museum-pushkin-museum-of-fine-arts"));
      for (let i = 0; i < 80; i++) {
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
  // The artist's report of 7 Oct 2026: "Born in New York", 210 works, no dial and the arrows on the picture.
  // Since the same day a town with a skyline opens as its city ("I want the isometric of the urban skyline to
  // come up"), so New York's mark must open the skyline, Born here in its column; Memphis, with none, reads.
  { name: "born here, New York", open: (P) => P.evaluate(() => fetch("lives.json").then((r) => r.json())
      .then((d) => Lives.openMark(d.marks.find((m) => m[7] === "New York" && m[4].length > 1)))), kind: "life", skyline: true },
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
    return box && !box.hidden && box.querySelector("button") && box.querySelector("button").offsetWidth ? [...box.querySelectorAll("button")].map((b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }) : null;
  });
  const settle = async () => { for (let i = 0; i < 30; i++) { const r = await state(); if (r && !r.flying && !r.snapping && !r.travelling) { return r; } await P.waitForTimeout(200); } return state(); };

  /* The three parts (artist, 7 Oct 2026: "1) globe, 2) artwork thumbnail, 3) dial. Each one should
     adapt to its new shape but maintain its functionality"): every arrangement reached by its one-press
     way, each part drawn and its key gesture working in its new place and form. */
  const parts = () => P.evaluate(() => Land.parts().parts);
  // What a turn of the dial changes: its year, or where a path on it stands (a Born here's works).
  const turned = () => P.evaluate(() => { const p = window.Dial && Dial._state && Dial._state().path; return (Land.reading() || {}).year + "|" + (p ? p.at : ""); });
  const pk = (q) => q.globe.charAt(0) + q.picture.charAt(0) + q.dial.charAt(0);
  const dialBox = () => P.evaluate(() => { const t = document.getElementById("art-time"); return { r: t.getBoundingClientRect().toJSON(), form: t.dataset.form || "", slot: t.dataset.slot || "" }; });
  const lit = () => P.evaluate(() => {
    const c = document.querySelector(".flat-map");
    if (!c || c.hidden) { return 0; }
    const g = c.getContext("2d"); let n = 0;
    for (let i = 1; i < 10; i++) { for (let j = 1; j < 6; j++) { const d = g.getImageData(Math.floor(c.width * i / 10), Math.floor(c.height * j / 6), 1, 1).data; if (d[0] + d[1] + d[2] > 60) { n++; } } }
    return n;
  });
  async function partsChecks(tag, v) {
    let r = await settle();
    // The globe into the big place: a tap on it.
    await tap(r.at.x + r.at.r * 0.2, r.at.y + r.at.r * 0.3);
    await P.waitForTimeout(1300);
    let q = await parts();
    check(tag, q.globe === "big", "a tap on the small globe puts it in the big place", pk(q));
    let f = await P.evaluate(() => Land.flat());
    check(tag, !!f && (await lit()) >= 20, "there it is a map, drawn", f && { w: Math.round(f.rect.w), lit: await lit() });
    if (f) {
      const R0 = f.rect, cx0 = R0.x + R0.w / 2, cy0 = R0.y + R0.h / 2;
      await drag(cx0, cy0, cx0 - 60, cy0 + 10);
      await P.waitForTimeout(300);
      let f2 = await P.evaluate(() => Land.flat());
      check(tag, Math.abs(f2.lon - f.lon) > 1, "a drag moves the map", { lon0: +f.lon.toFixed(1), lon1: +f2.lon.toFixed(1) });
      if (touch) { await pinch(cx0, cy0, 60, 180); } else { await P.mouse.move(cx0, cy0); for (let i = 0; i < 4; i++) { await P.mouse.wheel(0, -100); await P.waitForTimeout(40); } }
      await P.waitForTimeout(300);
      const f3 = await P.evaluate(() => Land.flat());
      check(tag, f3 && f3.k > f2.k * 1.3 && (await state()).kind === v.kind, "two fingers or a wheel make the map bigger, in the view", f3 && +(f3.k / f2.k).toFixed(2));
      const b = await buttons();
      if (touch) { await pinch(cx0, cy0, 180, 70); } else { await P.mouse.move(cx0, cy0); for (let i = 0; i < 3; i++) { await P.mouse.wheel(0, 100); await P.waitForTimeout(40); } }
      await P.waitForTimeout(300);
      const f4 = await P.evaluate(() => Land.flat());
      check(tag, f4 && f4.k < f3.k && (await state()).kind === v.kind, "pinching in or a wheel make the map smaller, in the view", f4 && +(f4.k / f3.k).toFixed(2));
    }
    // The dial into the big place: its ⤢.
    let sw = await P.evaluate(() => { const b = document.querySelector("#art-time .dial-swap"); if (!b || !b.offsetWidth) { return null; } const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (sw) { await tap(sw.x, sw.y); await P.waitForTimeout(1200); }
    q = await parts();
    let db = await dialBox();
    // Every reading view has its dial, so every one has the ⤢.
    const hasDial = !!sw;
    check(tag, hasDial && q.dial === "big" && db.form === "band", "the dial's ⤢ unrolls it in the big place", { parts: pk(q), form: db.form });
    if (db.form === "band") {
      const ax = db.r.y + Math.max(64, Math.min(db.r.height * 0.38, db.r.height / 2));
      const y0 = await turned();
      await drag(db.r.x + db.r.width * 0.5, ax, db.r.x + db.r.width * 0.3, ax);
      await P.waitForTimeout(700);
      const y1 = await turned();
      check(tag, y0 !== y1, "its handle turns the year (or, a path on it, its stop)", [y0, y1]);
      // Play and pause from the band's left end, with a path on the dial.
      await P.evaluate(() => {
        window.__p = Dial.path({ kind: "check", title: "Check", stops: [{ y: null, label: "one" }, { y: null, label: "two" }],
          onToggle: function () { window.__p.set({ paused: !Dial._state().path.paused }); } });
      });
      await P.waitForTimeout(500);
      db = await dialBox();
      if (process.env.DEBUG) { console.log("    debug", JSON.stringify(await P.evaluate((p) => ({ host: Dial._state().host, under: (document.elementFromPoint(p.x, p.y) || {}).className, parts: Land.parts() }), { x: db.r.x + 20, y: ax })), JSON.stringify(db)); }
      await tap(db.r.x + 20, ax);
      await P.waitForTimeout(700);
      const ps = await P.evaluate(() => Dial._state().path);
      check(tag, ps && ps.paused === true, "a tap on its left end pauses the path", ps && ps.paused);
      await P.evaluate(() => { try { Dial.end(); } catch (e) {} });
      await P.waitForTimeout(400);
    }
    // The globe in the dial's place: whole, and turned by a drag.
    r = await state();
    if (hasDial) check(tag, q.globe === "dial" && Math.abs(r.R / r.rest - 1) < 0.05 && Math.abs(r.rest / r.at.r - 0.86) < 0.02, "the globe in the dial's place, whole",
          { parts: pk(q), R: Math.round(r.R), window: r.at.r });
    // The picture back to the big place: a tap on it (a view with no picture: its home mark).
    const pl = r.plate;
    if (r.plateShown) { await tap(pl.x + pl.w / 2, pl.y + pl.h / 2); }
    else { const hm = await P.evaluate(() => { const e = document.querySelector(".lens-home"); if (!e || e.hidden) { return null; } const b = e.getBoundingClientRect(); return { x: b.x + 6, y: b.y + 6 }; }); if (hm) { await tap(hm.x, hm.y); } }
    await P.waitForTimeout(1300);
    q = await parts();
    r = await state();
    check(tag, q.picture === "big" && (r.plateShown || r.noPicture), "a tap on the picture brings it back to the big place", pk(q));
    db = await dialBox();
    if (q.dial === "small") {
      const y0 = await turned(), c0 = { x: db.r.x + db.r.width / 2, y: db.r.y + db.r.height / 2 }, rr = db.r.width / 2 - 13;
      await drag(c0.x + rr * Math.cos(-0.3), c0.y + rr * Math.sin(-0.3), c0.x + rr * Math.cos(0.9), c0.y + rr * Math.sin(0.9));
      await P.waitForTimeout(700);
      { const y1 = await turned(); check(tag, y1 !== y0, "the dial in the small place still turns", [y0, y1]); }
    }
    // Away from home, Escape puts all three home (at home it would go up a level).
    if (pk(await parts()) === "sbd") { await P.evaluate(() => Land.swap(true)); await P.waitForTimeout(900); }
    await P.keyboard.press("Escape");
    await P.waitForTimeout(1200);
    q = await parts();
    check(tag, pk(q) === "sbd" && !!(await state()), "Escape puts all three home", pk(q));
    // A city pressed on the map goes there.
    await P.evaluate(() => Land.swap(true));
    await P.waitForTimeout(1300);
    f = await P.evaluate(() => Land.flat());
    const m = f && f.shown.filter((x) => x.x > f.rect.x + 12 && x.y > f.rect.y + 12 && x.x < f.rect.x + f.rect.w - 60 && x.y < f.rect.y + f.rect.h - 50)[0];
    if (m) {
      await tap(m.x, m.y);
      await P.waitForTimeout(600);
      const w2 = await P.evaluate(() => Land.where());
      check(tag, !(await state()) || w2.flying || w2.at !== v.kind, "a mark pressed on the map goes there", { title: m.title, at: w2.at });
    } else { check(tag, false, "a mark on the map to press", f && f.shown.length); }
  }

  await P.goto("http://localhost:" + PORT + "/v2/", { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 40000 });
  await P.waitForTimeout(800);
  for (const v of VIEWS) {
    if (ONLY && v.name.indexOf(ONLY) < 0) { continue; }
    const tag = size + " " + v.name;
    console.log(tag);
    await v.open(P);
    if (v.skyline) {
      // A town with a skyline is its city, not a reading: the skyline drawn, nothing else of the reading's to check.
      let sk = null;
      for (let i = 0; i < 120 && !sk; i++) { await P.waitForTimeout(300); sk = await P.evaluate(() => Land.city && Land.city.state && Land.city.state()); }
      check(tag, !!sk, "opens as its skyline", sk && sk.name);
      await P.keyboard.press("Escape"); await P.waitForTimeout(400);
      continue;
    }
    let r = null;
    for (let i = 0; i < 120 && !(r && r.kind === v.kind && !r.flying); i++) { await P.waitForTimeout(300); r = await state(); }
    if (!r) { check(tag, false, "opened"); continue; }
    // A work's first look ends on any touch.
    if (r.look === "plate") { await tap(w - 30, h - 30); }
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
    // The three constant parts (artist, 7 Oct 2026: "The dial has completely disappeared, bring it back"),
    // the arrows outside the picture ("…should be outside the boundary of the thumbnail") and the label
    // under it ("the info for the artwork should always be below the thumbnail of the artwork").
    const lay = await P.evaluate(() => {
      const box = (e) => { if (!e || e.hidden || !e.offsetParent && getComputedStyle(e).position !== "fixed") { return null; } const b = e.getBoundingClientRect(); return b.width && b.height ? b.toJSON() : null; };
      const plate = document.getElementById("art-plate");
      const lab = document.querySelector(".art > .wall-label.wl-plate[data-on]");
      return { dial: box(document.getElementById("art-time")), plate: plate && !plate.hidden ? box(plate) : null,
               label: lab && !lab.hidden ? box(lab) : null,
               arrows: [...document.querySelectorAll(".art > .voice-swipe")].map(box).filter(Boolean) };
    });
    check(tag, !!lay.dial, "the dial is there at rest", lay.dial && { x: Math.round(lay.dial.x), y: Math.round(lay.dial.y), w: lay.dial.width });
    if (lay.plate && lay.label) {
      const P0 = lay.plate, Lb = lay.label;
      check(tag, Lb.top >= P0.bottom - 1 && Lb.left < P0.right && Lb.right > P0.left, "the wall label is under the picture",
            { plateBottom: Math.round(P0.bottom), labelTop: Math.round(Lb.top) });
    }
    if (lay.plate) {
      const P0 = lay.plate;
      const over = lay.arrows.filter((a) => a.right > P0.left + 0.5 && a.left < P0.right - 0.5 && a.bottom > P0.top && a.top < P0.bottom);
      check(tag, !over.length && lay.arrows.every((a) => a.width >= 24 && a.height >= 24 && a.left >= 0 && a.right <= w),
            "the ‹ › stand outside the picture, 24 px or more", { arrows: lay.arrows.map((a) => [Math.round(a.left), Math.round(a.width)]), plate: [Math.round(P0.left), Math.round(P0.right)] });
      if (/born/.test(v.name)) { check(tag, lay.arrows.length === 2, "a picture that swipes has its ‹ ›", lay.arrows.length); }
    }
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
    // The round + / − were hidden at the artist's request (7 Oct 2026: pinching scales it).
    const b = await buttons();
    check(tag, !b, "the round + and − are hidden", b && b.map((x) => x.w));
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
    await partsChecks(tag, v);
    // Up to the world for the next (after any flight a press began).
    for (let i = 0; i < 40 && (await P.evaluate(() => Land.where().flying)); i++) { await P.waitForTimeout(500); }
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

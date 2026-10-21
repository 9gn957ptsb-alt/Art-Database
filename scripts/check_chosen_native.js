/* Berkeley's and Santa Monica's native character, chosen by the artist, in the page
   (docs/v2/characters/REFINE.md, "Anna's hummingbird, a stain and a hover").

   The artist, 21 Oct 2026: "Give Berkeley and Santa Monica the hummingbird." Helen Frankenthaler's drawn
   Anna's hummingbird is the native of those two places (characters.json's `chosen`; the place file's
   `native.how` is "chosen", never "born"), and the generated hummingbirds the generator drew there after Mary Corse
   (born in Berkeley) and Mark Bradford (born in Los Angeles) are kept in the file as `own`. At 390×844 (touch,
   density 2) and 1440×900, for each of the two places:

     the wave: a hold and release on bare ground brings the drawn hummingbird out (id "hummingbird") with the place's
       plants; it is drawn (its box is full of dots, at the size it is drawn: reported) and wholly in the window;
       pressed, its line reads "Anna's hummingbird · after Helen Frankenthaler, of New York …" with the place's
       plants ("among Berkeley's …") and never says she was born there;
     the dial's hand: neither city has a skyline (cityplaces.json), so the hand is read and drawn directly
       (Characters.hand: the hummingbird, after Frankenthaler, its five poses at the size the dial draws it), and,
       to see it on a ground, Los Angeles's skyline is given the same record for its place file (the stand-in,
       page.route): the hummingbird is the dial's hand there, standing at now, flying when the year is turned
       (pose trot, lifted), and pressed it says what it is;
     the artist born there keeps their own: Mary Corse's life at Berkeley (her one place, 1945) and Mark Bradford's
       at Los Angeles, 2017–2019, a wave in each brings the hummingbird the generator drew after them (id
       "p:berkeley-us", "p:santa-monica-us": "Anna's hummingbird · after Mary Corse, born in Berkeley"), never
       Frankenthaler's; pressed, it offers Follow, and following it is following Corse's (her map); and Frankenthaler's
       own life place (New York, 1928) brings the drawn one, as before;
     an arrival: a journey's hometown meeting (here, one at rest, the random held) is the place's native too, the
       drawn one, "at home in Berkeley", with her home's plants named when they rise;
     no page errors (the picture stores, Wikimedia, NASA and Google Fonts are stood in for or refused).

     cd docs && python3 -m http.server 8951 &
     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_chosen_native.js [--port 8951]
         [--sizes 390x844,1440x900] [--shots DIR] [--only wave,hand,own,arrive]

   Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8951);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const SHOTS = arg("shots", null);
const ONLY = String(arg("only", "wave,hand,own,arrive")).split(",");
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#7a6a58"/></svg>';
const ROOT = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PLACES = ["berkeley-us", "santa-monica-us"];
const NAME = { "berkeley-us": "Berkeley", "santa-monica-us": "Santa Monica" };

let bad = 0;
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { bad++; }
}

async function open(browser, size, routes) {
  const [w, h] = size.split("x").map(Number), touch = w <= 720;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("globe-layer", "museums");
      localStorage.setItem("dial.seen", JSON.stringify(["l:mary-corse", "l:mark-bradford", "l:helen-frankenthaler"]));
    } catch (e) {}
  });
  await ctx.route(/cloudfront\.net|wikimedia|nasa\.gov|fonts\.(googleapis|gstatic)\.com|artsy\.net|googletagmanager/, (r) =>
    /\.(jpg|png)|FilePath/.test(r.request().url()) ? r.fulfill({ body: PIC, contentType: "image/svg+xml" }) : r.abort());
  for (const [pat, fn] of routes || []) { await ctx.route(pat, fn); }
  const P = await ctx.newPage();
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.goto("http://localhost:" + PORT + "/v2/?x=" + Date.now(), { waitUntil: "load" });
  for (let i = 0; i < 60; i++) { if (await P.evaluate(() => !!(window.Land && window.Characters && window.Skyline))) { break; } await sleep(500); }
  await sleep(2500);
  return { ctx, P, errors, w, h, touch };
}

// A point on bare ground: nothing there is a name, a button, a link, the column, the banner or the dial, and none within 22 px.
function bareSpot([w, h]) {
  const bad = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.matches && e.matches("button, a, [role=button], [class*=name], [class*=label], input, #art-col, #banner, .banner, .dial, [class*=dial]")) { return true; }
    }
    return false;
  };
  const x0 = w < 700 ? 0.42 : 0.25, x1 = w < 700 ? 0.75 : 0.55, y0 = w < 700 ? 0.18 : 0.2, y1 = w < 700 ? 0.5 : 0.75;
  for (let r = 0; r < 40; r++) {
    for (let q = 0; q < 40; q++) {
      const x = Math.round(w * (x0 + (x1 - x0) * ((q * 7 + r * 3) % 40) / 40)), y = Math.round(h * (y0 + (y1 - y0) * ((r * 11 + q * 5) % 40) / 40));
      const el = document.elementFromPoint(x, y);
      if (!el || bad(el) || !(el.tagName === "CANVAS" || el.id === "land" || el.closest(".skyline, #land, .land"))) { continue; }
      let near = false;
      for (let dx = -22; dx <= 22 && !near; dx += 11) {
        for (let dy = -14; dy <= 14 && !near; dy += 7) { const e2 = document.elementFromPoint(x + dx, y + dy); if (e2 && bad(e2)) { near = true; } }
      }
      if (!near) { return { x, y }; }
    }
  }
  return null;
}

// The first character button on the screen: its box (the hit box is the middle 70% by 80% of the animal's bounds) and the
// dots the character canvas has drawn within the bounds.
// (Of the animals out, the first whose label begins "Anna's hummingbird": a city's own animal may be out at rest beside it.)
function characterNow() {
  const b = [].slice.call(document.querySelectorAll("button.character")).filter((e) => !e.hidden && /^Anna's hummingbird/.test(e.getAttribute("aria-label") || ""))[0];
  if (!b) { return null; }
  const q = b.getBoundingClientRect(), bw = q.width / 0.7, bh = q.height / 0.8;
  const box = { l: q.left - 0.15 * bw, t: q.top - 0.2 * bh, r: q.left - 0.15 * bw + bw, b: q.top - 0.2 * bh + bh };
  const cv = document.getElementById("characters");
  let dots = 0;
  if (cv) {
    const dpr = cv.width / window.innerWidth, g = cv.getContext("2d");
    const x0 = Math.max(0, Math.round(box.l * dpr)), y0 = Math.max(0, Math.round(box.t * dpr));
    const w = Math.min(cv.width - x0, Math.round(bw * dpr)), h = Math.min(cv.height - y0, Math.round(bh * dpr));
    if (w > 0 && h > 0) { const d = g.getImageData(x0, y0, w, h).data; for (let i = 3; i < d.length; i += 4) { if (d[i] > 40) { dots += 1; } } }
  }
  return { x: q.left + q.width / 2, y: q.top + q.height / 2, label: b.getAttribute("aria-label"), box, w: Math.round(bw), h: Math.round(bh), dots };
}

const whole = (b, w, h) => b.l >= 0 && b.t >= 0 && b.r <= w && b.b <= h;

async function tap(env, x, y) {
  if (env.touch) { await env.P.touchscreen.tap(x, y); } else { await env.P.mouse.click(x, y); }
}

// A hold and release at a point: by touch (the device's own events) on a phone, the mouse on a desktop.
async function hold(env, x, y) {
  if (env.touch) {
    const cdp = await env.ctx.newCDPSession(env.P);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await sleep(700);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await env.P.mouse.move(x, y);
    await env.P.mouse.down();
    await sleep(700);
    await env.P.mouse.up();
  }
}

async function shot(env, name, box) {
  if (!SHOTS) { return; }
  fs.mkdirSync(SHOTS, { recursive: true });
  const clip = box ? { x: Math.max(0, box.l - 20), y: Math.max(0, box.t - 20), width: Math.min(env.w, box.r - box.l + 40), height: Math.min(env.h, box.b - box.t + 40) } : undefined;
  // (A big skyline in software GL is slow to paint: the screenshot waits for a frame.)
  await env.P.screenshot({ path: path.join(SHOTS, name + ".png"), clip, timeout: 180000 });
}

// What the line says now (null when it is not shown).
function saying(P) {
  return P.evaluate(() => { const e = document.querySelector(".character-says"); return e && !e.hidden ? e.textContent : null; });
}

// Press the animal until its line shows (a touch release can itself press the one that comes out of the wave, and a second press lets it go).
async function pressForLine(env) {
  for (let k = 0; k < 4; k++) {
    const said = await saying(env.P);
    if (said) { return said; }
    const r = await env.P.evaluate(characterNow);
    if (!r) { await sleep(300); continue; }
    // The art layer of a life's place whose ground was never read (Corse's Berkeley, "No ground has been read") lies over the
    // stage, 95% dark, and takes the touch: there the button is pressed in the page (as it was before this change).
    if (k < 2 && !env.viaPage) { await tap(env, r.x, r.y); } else { await env.P.evaluate(() => { const b = [].slice.call(document.querySelectorAll("button.character")).filter((e) => !e.hidden && /^Anna's hummingbird/.test(e.getAttribute("aria-label") || ""))[0]; if (b) { b.click(); } }); }
    await sleep(700);
  }
  return await saying(env.P);
}

async function townDown(env, key) {
  await env.P.evaluate((k) => Land.town(k), key);
  let at = null;
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    at = await env.P.evaluate(() => Land.where());
    if (at && at.at === "town" && !at.flying) { break; }
  }
  return at;
}

// ---- the wave -------------------------------------------------------------------------------------------------

async function wave(browser, size, place) {
  const env = await open(browser, size);
  const tag = size + " " + place + " wave";
  // The meeting at rest in its hometown is one visit in φ² (the arrival's check, below): held off here, so the wave is the wave.
  await env.P.evaluate(() => { window.__r = Math.random; Math.random = () => 0.99; });
  const at = await townDown(env, place);
  check(tag, !!at && at.at === "town" && at.key === place, "down in the city", at && { at: at.at, key: at.key });
  const sky = await env.P.evaluate(() => !!(window.Skyline && Skyline.hand && Skyline.hand()));
  check(tag, !sky, "no skyline: the city's dial is the round one (cityplaces.json has neither)");
  await sleep(9000);
  await env.P.evaluate(() => { Math.random = window.__r; Characters._reset(); });
  const pt = await env.P.evaluate(bareSpot, [env.w, env.h]);
  check(tag, !!pt, "a bare spot to press", pt);
  await hold(env, pt ? pt.x : Math.round(env.w * 0.3), pt ? pt.y : Math.round(env.h * 0.4));
  let st = null, shown = null;
  for (let i = 0; i < 60; i++) {
    await sleep(150);
    st = await env.P.evaluate(() => Characters._state());
    const r = await env.P.evaluate(characterNow);
    if (st && r && whole(r.box, env.w, env.h) && r.dots > 150) { await sleep(300); shown = await env.P.evaluate(characterNow); if (shown && whole(shown.box, env.w, env.h)) { break; } }
  }
  const crowd = (st && st.crowd) || [];
  const wv = crowd.filter((c) => c.mode === "wave")[0] || null;
  check(tag, !!wv && wv.id === "hummingbird", "the wave brings the drawn hummingbird (Frankenthaler's), not a generated one", wv && { id: wv.id, mode: wv.mode });
  check(tag, !crowd.some((c) => /^p:/.test(c.id)), "and no generated hummingbird after Corse or Bradford", crowd.map((c) => c.id));
  check(tag, !!wv && wv.plants > 0, "the place's plants rose with it", wv && { plants: wv.plants, home: wv.home });
  check(tag, !!shown, "it is wholly in the window and drawn", shown && { size: shown.w + "×" + shown.h + " px", dots: shown.dots, box: shown.box });
  if (shown) {
    check(tag, shown.dots > 150, "it reads: its box is full of dots", shown.dots);
    await shot(env, "wave_" + size + "_" + place + "_out", shown.box);
    const said = await pressForLine(env);
    const line = said ? said.replace(/\s*Follow$/, "") : "";
    check(tag, /^Anna's hummingbird · after Helen Frankenthaler, of New York City, New York/.test(line), "pressed: its line says what it is and whose", line);
    check(tag, line.indexOf(NAME[place] + "’s") >= 0, "among the place's own plants", line);
    check(tag, !/born/i.test(line), "and never says she was born there", line);
    check(tag, !!said && /Follow$/.test(said), "and offers Follow");
    await shot(env, "wave_" + size + "_" + place + "_pressed");
    if (SHOTS) {
      // Let go (a second press), and look at it as it goes off, away from its line.
      const r = await env.P.evaluate(characterNow);
      if (r) { await tap(env, r.x, r.y); await sleep(450); const g = await env.P.evaluate(characterNow); if (g) { await shot(env, "wave_" + size + "_" + place + "_going", g.box); } }
    }
  }
  check(tag, env.errors.length === 0, "no page errors", env.errors.slice(0, 3));
  await env.ctx.close();
}

// ---- the dial's hand ------------------------------------------------------------------------------------------

async function hand(browser, size) {
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/v2/characters/places/berkeley-us.json"), "utf8"));
  delete rec.own;
  // The stand-in: Los Angeles's place file is Berkeley's (the chosen hummingbird), so a skyline city has the drawn bird for its hand.
  const standIn = Object.assign({}, rec, { key: "los-angeles-us", name: "Los Angeles", ll: [34.0522, -118.2437] });
  const env = await open(browser, size, [[/characters\/places\/los-angeles-us\.json/, (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(standIn) })]]);
  const tag = size + " dial's hand";
  // Berkeley's and Santa Monica's own, read directly and drawn.
  for (const place of PLACES) {
    const got = await env.P.evaluate(async (k) => {
      const h = await Characters.hand(k);
      if (!h) { return null; }
      const poses = {};
      const scale = 1;
      const bx = h.box(scale);
      for (const pose of ["trot", "stand", "back", "look", "sit"]) {
        const cv = document.createElement("canvas");
        cv.width = Math.ceil(bx.w * 2 + 40); cv.height = Math.ceil(bx.h * 2 + 40);
        const g = cv.getContext("2d");
        h.draw(g, cv.width / 2, cv.height / 2 + bx.foot, pose, 0, 1, scale);
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) { if (d[i] > 40) { n += 1; } }
        poses[pose] = n;
      }
      return { name: h.name, artist: h.artist, line: h.line, id: h.id, box: bx, poses };
    }, place);
    check(tag, !!got && got.id === "hummingbird" && got.artist === "Helen Frankenthaler", place + ": the hand is the drawn hummingbird, after Frankenthaler", got && { id: got.id, artist: got.artist });
    check(tag, !!got && got.line === "Anna's hummingbird · after Helen Frankenthaler, of New York City, New York", place + ": what the hand says it is", got && got.line);
    check(tag, !!got && Object.keys(got.poses).every((p) => got.poses[p] > 200), place + ": every pose is drawn (dots)", got && got.poses);
  }
  // On a skyline: Los Angeles with the stand-in.
  const at = await townDown(env, "los-angeles-us");
  check(tag, !!at && at.at === "town" && at.key === "los-angeles-us", "Los Angeles opened", at && { at: at.at, key: at.key });
  let h0 = null;
  for (let i = 0; i < 160; i++) {
    h0 = await env.P.evaluate(() => (window.Skyline && Skyline.hand && Skyline.hand()) || null);
    if (h0 && h0.name && h0.t >= 0.999 && h0.box) { break; }
    await sleep(700);
  }
  check(tag, !!h0 && h0.name === "Anna's hummingbird", "on its skyline the dial's hand is the hummingbird", h0 && { name: h0.name, t: h0.t, pose: h0.pose });
  if (h0 && h0.box) {
    const b = h0.box;
    check(tag, b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= env.w && b.top >= 0 && b.top + b.h <= env.h, "standing on the ring, wholly in the window", { w: Math.round(b.w), h: Math.round(b.h), x: Math.round(b.x), top: Math.round(b.top) });
    await shot(env, "hand_" + size + "_rest", { l: b.x - b.w / 2, t: b.top, r: b.x + b.w / 2, b: b.top + b.h });
    // The year turned: it goes there along the ring, flying (the trot pose, lifted).
    const dv = await env.P.evaluate(() => Land.dial());
    const mid = Math.round(dv.y0 + (dv.y1 - dv.y0) * 0.4);
    await env.P.evaluate((y) => Land.dialYear(y), mid);
    let flew = false, poses = {};
    for (let i = 0; i < 60; i++) {
      await sleep(80);
      const s = await env.P.evaluate(() => Skyline.hand());
      if (!s) { continue; }
      poses[s.pose] = (poses[s.pose] || 0) + 1;
      if (s.pose === "trot" && s.alt > 1) { flew = true; if (SHOTS && !check.shot) { check.shot = true; const bb = s.box; await shot(env, "hand_" + size + "_flying", { l: bb.x - bb.w / 2 - 30, t: bb.top - 30, r: bb.x + bb.w / 2 + 30, b: bb.top + bb.h + 30 }); } }
    }
    check(tag, flew, "turned to " + mid + ", it flies the ring (pose trot, lifted off the ground)", poses);
    await sleep(2500);
    const b2 = await env.P.evaluate(() => Skyline.hand().box);
    await tap(env, b2.x, b2.top + b2.h / 2);
    await sleep(700);
    const said = await env.P.evaluate(() => { const e = document.querySelector(".skyline-hand-says"); return e && !e.hidden ? e.textContent : null; });
    check(tag, said === "Anna's hummingbird · after Helen Frankenthaler, of New York City, New York", "pressed, the hand says what it is", said);
    await shot(env, "hand_" + size + "_pressed");
  }
  check(tag, env.errors.length === 0, "no page errors", env.errors.slice(0, 3));
  await env.ctx.close();
}

// ---- the artist born there keeps their own ----------------------------------------------------------------------

async function lifePlace(env, life, k) {
  await env.P.evaluate((l) => Lives.open(l), life);
  for (let i = 0; i < 80; i++) { const r = await env.P.evaluate(() => Land.reading && Land.reading()); if (r && !r.flying && r.at) { break; } await sleep(300); }
  await sleep(1500);
  await env.P.evaluate(([l, n]) => Lives.enter(l, n), [life, k]);
  let up = false;
  for (let i = 0; i < 120; i++) {
    // The life's place is up (a town of the record with the life its view); where its ground was cut (the notable lives'),
    // its clod too, but Corse's, Bradford's and Frankenthaler's are not among those (lifeplaces.json): the town's own view.
    up = await env.P.evaluate((l) => { const w = Land.where && Land.where(), s = window.PlaceThen && PlaceThen._state(); return !!(w && !w.flying && w.at === "town" && w.life && w.life.id === l && s && s.ready); }, life);
    if (up) { break; }
    await sleep(400);
  }
  await sleep(2500);
  return up;
}

async function own(browser, size, spec) {
  const env = await open(browser, size);
  const tag = size + " " + spec.name;
  env.viaPage = true;      // (the art layer of a life's place with no ground read lies over the stage and takes the touch)
  const up = await lifePlace(env, spec.life, spec.k);
  check(tag, up, "the place is up and its clod drawn");
  if (up) {
    const w = await env.P.evaluate(() => { const x = Land.where(); return { key: x.key, ll: x.ll, name: x.name, life: x.life && x.life.name }; });
    check(tag, w.life === spec.artist, "the view is the artist's life", w);
    // Where the wave is fired: on the clod where there is one, else on bare ground.
    const clod = await env.P.evaluate((dim) => {
      const c = document.querySelector(".pt-clod");
      if (c) { const q = c.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, clod: true }; }
      return { x: Math.round(dim[0] * (dim[0] < 700 ? 0.5 : 0.4)), y: Math.round(dim[1] * 0.3), clod: false };
    }, [env.w, env.h]);
    await env.P.evaluate(() => { Characters._reset(); });
    // The wave, as land.js fires it (squash): where the artist's own animal may come.
    await env.P.evaluate(([x, y, ww]) => Characters.wave(x, y, { key: ww.key, lat: ww.ll[0], lon: ww.ll[1], r: 60, name: ww.name }), [clod.x, clod.y, w]);
    // (What came out of the wave: a hometown animal seen far below from a history's stop may be out too, and is not it.)
    let wv = null, shown = null;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const st = await env.P.evaluate(() => Characters._state());
      wv = ((st && st.crowd) || []).filter((c) => c.mode === "wave")[0] || null;
      if (wv) { shown = await env.P.evaluate(characterNow); if (shown && shown.dots > 100) { break; } }
    }
    const id = wv && wv.id;
    check(tag, id === spec.id, "the wave brings " + spec.said, wv && { id: wv.id, mode: wv.mode });
    check(tag, id !== "hummingbird" || spec.id === "hummingbird", "never Frankenthaler's drawn hummingbird in another artist's life");
    if (wv) {
      check(tag, wv.line.indexOf(spec.line) === 0, "its line: " + spec.line + " …", wv.line);
    }
    if (shown) {
      check(tag, shown.dots > 100, "it is drawn (dots)", { dots: shown.dots, size: shown.w + "×" + shown.h });
      await shot(env, "own_" + size + "_" + spec.life);
      if (spec.follow) {
        // Pressed, it offers Follow, and following it is following that artist's map.
        const said = await pressForLine(env);
        check(tag, !!said && said.indexOf(spec.line) === 0 && /Follow$/.test(said), "pressed: the line and Follow", said);
        const f = await env.P.evaluate(() => { const b = document.querySelector(".character-follow"); if (b) { b.click(); } return !!b; });
        await sleep(1500);
        const fl = await env.P.evaluate(() => (Land.following && Land.following()) || null);
        check(tag, f && !!fl && fl.artist === spec.artist, "following it is following " + spec.artist + "'s map", fl && { artist: fl.artist, animal: fl.animal });
      }
    }
  }
  check(tag, env.errors.length === 0, "no page errors", env.errors.slice(0, 3));
  await env.ctx.close();
}

// ---- an arrival -----------------------------------------------------------------------------------------------

async function arrive(browser, size, place) {
  const env = await open(browser, size);
  const tag = size + " " + place + " arrival";
  // The meeting at rest is one visit in φ²: held, so it is decided now.
  await env.P.evaluate(() => { const r = Math.random; window.__r = r; Math.random = () => 0; });
  const at = await townDown(env, place);
  check(tag, !!at && at.key === place, "down in the city", at && { at: at.at, key: at.key });
  let st = null;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    st = await env.P.evaluate(() => Characters._state());
    if (st && st.crowd && st.crowd.some((c) => c.mode === "rest")) { break; }
  }
  await env.P.evaluate(() => { Math.random = window.__r; });
  const c = st && st.crowd && st.crowd.filter((x) => x.mode === "rest")[0];
  check(tag, !!c && c.id === "hummingbird", "the hometown animal at rest is the drawn hummingbird", st && st.crowd && st.crowd.map((x) => [x.id, x.mode]));
  check(tag, !!c && /^Anna's hummingbird · after Helen Frankenthaler, of New York City, New York · at home in /.test(c.line) && !/born/i.test(c.line), "its line: at home, after Frankenthaler, of New York", c && c.line);
  check(tag, env.errors.length === 0, "no page errors", env.errors.slice(0, 3));
  await env.ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--disable-dev-shm-usage"] });
  // Each part by itself, so one that fails to run does not hide the others.
  const part = async (tag, fn) => { try { await fn(); } catch (e) { check(tag, false, "script error", String(e && e.stack || e).slice(0, 400)); } };
  const OWN = [
    { name: "Mary Corse's life at Berkeley", life: "mary-corse", k: 0, artist: "Mary Corse", id: "p:berkeley-us",
      said: "the hummingbird the generator drew after Mary Corse", line: "Anna's hummingbird · after Mary Corse, born in Berkeley", follow: true },
    { name: "Mark Bradford's life at Los Angeles, 2017–2019", life: "mark-bradford", k: 1, artist: "Mark Bradford", id: "p:santa-monica-us",
      said: "the hummingbird the generator drew after Mark Bradford", line: "Anna's hummingbird · after Mark Bradford, born in Los Angeles", follow: true },
    { name: "Frankenthaler's life at New York, 1928", life: "helen-frankenthaler", k: 0, artist: "Helen Frankenthaler", id: "hummingbird",
      said: "her own drawn hummingbird, as before", line: "Anna's hummingbird · after Helen Frankenthaler, of New York City, New York" }
  ];
  for (const size of SIZES) {
    if (ONLY.includes("wave")) { for (const p of PLACES) { await part(size + " " + p + " wave", () => wave(browser, size, p)); } }
    if (ONLY.includes("hand")) { await part(size + " dial's hand", () => hand(browser, size)); }
    if (ONLY.includes("own")) { for (const spec of OWN) { await part(size + " " + spec.name, () => own(browser, size, spec)); } }
    if (ONLY.includes("arrive")) { for (const p of PLACES) { await part(size + " " + p + " arrival", () => arrive(browser, size, p)); } }
  }
  await browser.close();
  console.log(bad ? "FAILED " + bad : "ALL OK");
  process.exit(bad ? 1 : 0);
})();

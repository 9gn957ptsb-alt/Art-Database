/* The characters, in the page (docs/v2/characters/REFINE.md, "Each run", step 5).
   For each place and each size it goes down into the city (Land.town), presses
   and holds on bare ground for 700 ms and lets go (the wave), and checks:

     the city opened;
     something came out of the wave (its own character, or the place's plants
       alone) and the place's plants rose;
     the character, pressed while it is on the screen, stops and says what it
       is (the line under it, "Wild boar · after J. M. W. Turner, born in
       Maiden Lane · among London's European beech … · 19 of the artist's works
       have been here", and Follow);
     where the city's dial lies on its ground (a skyline city: skyline.js, "the
       ground dial"), its animal is that dial's hand: the wave raises the plants
       alone, and the hand, pressed, says what it is ("Wild boar · after J. M. W.
       Turner, born in Maiden Lane");
     no page errors.

   A native born in the place may be at rest there already (one visit in φ²);
   then the wave raises its plants alone and the press is on the one at rest.

     python3 -m http.server 8911 --directory docs &
     NODE_PATH=$(npm root -g) node scripts/check_characters.js [--port 8911]
         [--sizes 390x844,1440x900] [--places london-gb,paris-fr] [--shots DIR]

   NASA, Artsy's picture store and Google Fonts are stood in for or refused
   (page.route), as in check_globes.js. Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8911);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const PLACES = String(arg("places", "london-gb,paris-fr,washington-us")).split(",");
const SHOTS = arg("shots", null);
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#6a5a48"/></svg>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let bad = 0;
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { bad++; }
}

// A point on bare ground: nothing there is a name, a button, a link, the column, the banner or the dial,
// and none within 22 px; on a phone toward the middle, where a character that walks off to the left has room.
function bareSpot([w, h]) {
  // Not on a city's ground dial (skyline.js): a press on its ring or its marks turns time, not the wave.
  const ring = window.Skyline && Skyline.ring ? Skyline.ring() : null;
  const onRing = (x, y) => {
    if (!ring) { return false; }
    const du = x - ring.cx, dw = (y - ring.cy) / ring.st;
    return Math.hypot(du, dw) > ring.R * 0.8;
  };
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
      if (onRing(x, y)) { continue; }
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

// The first character button on the screen, as a box.
function characterBox() {
  const b = [].slice.call(document.querySelectorAll("button.character")).filter((e) => !e.hidden)[0];
  if (!b) { return null; }
  const q = b.getBoundingClientRect();
  return { x: q.left + q.width / 2, y: q.top + q.height / 2, l: q.left, r: q.right };
}

async function run(size, place) {
  const [w, h] = size.split("x").map(Number);
  const tag = size + " " + place;
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("globe-layer", "museums"); } catch (e) {} });
  const P = await ctx.newPage();
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com|artsy\.net|googletagmanager/, (r) => r.abort());
  await P.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  for (let i = 0; i < 60; i++) { if (await P.evaluate(() => !!(window.Land && window.Characters))) { break; } await sleep(500); }
  await sleep(2500);
  await P.evaluate((k) => Land.town(k), place);
  let at = null;
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    at = await P.evaluate(() => Land.where());
    if (at && at.at === "town" && !at.flying) { break; }
  }
  check(tag, at && at.at === "town" && at.key === place, "down in the city", at && { at: at.at, key: at.key });
  await sleep(9000);                       // the first play of the dial, the arrival
  await P.evaluate(() => { Characters._reset(); });
  const pt = await P.evaluate(bareSpot, [w, h]);
  check(tag, !!pt, "a bare spot to press", pt);
  const x = pt ? pt.x : Math.round(w * 0.3), y = pt ? pt.y : Math.round(h * 0.4);
  await P.mouse.move(x, y);
  await P.mouse.down();
  await sleep(700);
  await P.mouse.up();
  let st = null, said = null;
  // Where the city's dial lies on its ground (skyline.js, "the ground dial") the place's own animal is
  // out already, as its hand: the wave raises the plants alone, and the press is on the hand.
  const hand = await P.evaluate(() => (window.Skyline && Skyline.hand && Skyline.hand()) || null);
  if (hand && hand.box) {
    for (let i = 0; i < 30 && !st; i++) { await sleep(100); st = await P.evaluate(() => Characters._state()); }
    const b = await P.evaluate(() => Skyline.hand().box);
    if (SHOTS) { await P.screenshot({ path: `${SHOTS}/chars_${place}_${w}.png` }); }
    await P.mouse.click(b.x, b.top + b.h / 2);
    await sleep(700);
    said = await P.evaluate(() => { const e = document.querySelector(".skyline-hand-says"); return e && !e.hidden ? e.textContent : null; });
    if (SHOTS) { await P.screenshot({ path: `${SHOTS}/chars_${place}_${w}_pressed.png` }); }
    check(tag, !!(st && (st.beds || st.plants)), "its plants rose round the wave (its animal is the dial's hand)", st && { beds: st.beds, plants: st.plants });
    check(tag, !!said && said.indexOf(hand.name) === 0, "the hand, pressed: what it is", said);
    check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
    await browser.close();
    return;
  }
  for (let i = 0; i < 60 && !said; i++) {
    await sleep(100);
    const cur = await P.evaluate(() => Characters._state());
    if (cur && !st) { st = cur; }
    const r = await P.evaluate(characterBox);
    if (!r || r.l <= 4 || r.r >= w - 4) { continue; }
    await sleep(400);
    const r2 = await P.evaluate(characterBox);
    if (!r2 || r2.l <= 4 || r2.r >= w - 4) { continue; }
    if (SHOTS) { await P.screenshot({ path: `${SHOTS}/chars_${place}_${w}.png` }); }
    await P.mouse.click(r2.x, r2.y);
    await sleep(700);
    said = await P.evaluate(() => { const e = document.querySelector(".character-says"); return e && !e.hidden ? e.textContent : null; });
    if (SHOTS) { await P.screenshot({ path: `${SHOTS}/chars_${place}_${w}_pressed.png` }); }
  }
  check(tag, !!st, "something came out of the wave", st && { id: st.id, mode: st.mode, plants: st.plants, beds: st.beds });
  if (st) {
    check(tag, (st.plants || 0) + (st.beds || 0) > 0 || !!(st.crowd && st.crowd.some((c) => c.plants > 0)), "its plants rose", { plants: st.plants, beds: st.beds });
  }
  check(tag, !!said, "pressed: the caption shows", said);
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await browser.close();
}

(async () => {
  for (const s of SIZES) {
    for (const p of PLACES) {
      try { await run(s, p); } catch (e) { check(s + " " + p, false, "script error", String(e).slice(0, 200)); }
    }
  }
  console.log(bad ? "FAILED " + bad : "ALL OK");
  process.exit(bad ? 1 : 0);
})();

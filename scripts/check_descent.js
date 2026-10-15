/* The descent, checked in a browser (land.js, "into a city from the world"; artist, 14 Oct 2026: "I should be
   able to zoom into the plot of New York City seamlessly from outer space and this goes for all the plots in
   the globe"): past the globe's nearest the fingers, a wheel or "+" go on down into the city whose plot is under
   them, and never into DIRT Earth's ground.
     390x844 (touch): from a far globe, strokes go down into New York's skyline; a short stroke is held for the
       next, which carries on; pinched back out, the world, nothing left half way.
     1440x900: the wheel goes down into New York; "+" at the nearest into Paris; open sea stays at the nearest;
       on the Collages layer New York's plot all the same; on the Artists layer New York opens on Born here.
     cd docs && python3 -m http.server 8871 &
     NODE_PATH=$(npm root -g) node scripts/check_descent.js [port] [shots dir]     (ONLY=aimed|phone|desktop: one part)
   Exits 1 on any failure. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const PORT = process.argv[2] || "8871";
const OUT = process.argv[3] || require("os").tmpdir();
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8a6"/></svg>';
const NYC = [40.758, -73.985];
const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}

async function open(browser, w, h, touch, layer) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript((l) => { try { localStorage.setItem("globe-layer", l); localStorage.removeItem("dial.seen"); } catch (e) {} }, layer);
  const P = await ctx.newPage();
  // A city's first play redraws its skyline every frame, ~7 s a frame for New York in software GL: a
  // screenshot waits for one.
  P.setDefaultTimeout(90000);
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await P.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe" && window.Land && Land.globeAt, null, { timeout: 60000 });
  await P.waitForTimeout(5000);                  // the cities, read a little after the page comes up
  await P.evaluate(() => Land.pace(false));
  const cdp = await ctx.newCDPSession(P);
  return { ctx, P, cdp, errors };
}
const ground = (P) => P.evaluate(() => {
  const g = document.querySelector(".ground-dirt"), f = document.querySelector(".ground-dirt iframe, iframe.ground-frame");
  return { shown: !!g && !g.hidden && getComputedStyle(g).opacity !== "0", src: f ? f.getAttribute("src") || "" : "" };
});

async function phone(browser) {
  const tag = "390x844";
  const { ctx, P, cdp, errors } = await open(browser, 390, 844, true, "museums");
  const touchAt = (pts, type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  // One stroke: two fingers d0 apart spread to d1 about (x, y), in n steps; lifted unless keep.
  const seen = [];
  async function stroke(x, y, d0, d1, n, keep, shots) {
    const pts = (d) => [{ x: x - d / 2, y, id: 1 }, { x: x + d / 2, y, id: 2 }];
    await touchAt([pts(d0)[0]], "touchStart");
    await touchAt(pts(d0), "touchStart");
    for (let i = 1; i <= n; i++) {
      await touchAt(pts(d0 + (d1 - d0) * i / n), "touchMove");
      await P.waitForTimeout(40);
      if (shots && shots.indexOf(i) >= 0) { await P.screenshot({ path: path.join(OUT, `${tag}-stroke-${i}.png`) }); }
      const sd = await P.evaluate(() => Land.descent() || (Land.rise() && Land.rise().down ? Land.rise() : null));
      if (sd) { seen.push(sd); }
    }
    if (!keep) { await touchAt([], "touchEnd"); }
  }
  // Pinch the far globe in to its nearest, facing New York, as a hand would: three strokes about the city.
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 0.5), NYC);
  await P.screenshot({ path: path.join(OUT, `${tag}-0-far.png`) });
  for (let k = 0; k < 3; k++) { await stroke(195, 422, 40, 220, 10); await P.waitForTimeout(250); }
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 2.6180339887), NYC);   // exactly at the nearest, the city in the middle
  await P.waitForTimeout(400);
  await P.screenshot({ path: path.join(OUT, `${tag}-1-nearest.png`) });
  // Spread on: the descent begins (never the DIRT ground).
  await stroke(195, 422, 50, 190, 14, true, [4, 9, 14]);
  check(tag, seen.length > 0, "spreading past the globe's nearest goes down (descent or its rise)", seen[seen.length - 1]);
  const g1 = await ground(P);
  check(tag, !g1.shown && !g1.src, "DIRT Earth's ground never comes up", g1);
  await touchAt([], "touchEnd");
  await P.waitForTimeout(3200);
  const w1 = await P.evaluate(() => ({ where: Land.where(), sky: !!(window.Skyline && Skyline.on && Skyline.on()), rise: Land.rise(), descent: Land.descent() }));
  check(tag, w1.where.at === "town" && w1.where.key === "new-york-us" && !w1.where.flying, "let go a third of the way down, it goes on into New York", w1.where);
  await P.waitForTimeout(2500);
  const w1b = await P.evaluate(() => ({ sky: !!(window.Skyline && Skyline.on && Skyline.on()), state: window.Skyline && Skyline.state && Skyline.state() }));
  check(tag, w1b.sky, "New York's skyline is its view", { on: w1b.sky, n: w1b.state && w1b.state.n });
  await P.screenshot({ path: path.join(OUT, `${tag}-2-city.png`) });
  // Out again to the world by the rise, then a short stroke in that springs back.
  for (let k = 0; k < 4 && (await P.evaluate(() => !!Land.where().key)); k++) {
    const pts = (d) => [{ x: 195 - d / 2, y: 300, id: 1 }, { x: 195 + d / 2, y: 300, id: 2 }];
    await touchAt([pts(220)[0]], "touchStart"); await touchAt(pts(220), "touchStart");
    for (let i = 1; i <= 10; i++) { await touchAt(pts(220 - 180 * i / 10), "touchMove"); await P.waitForTimeout(30); }
    await touchAt([], "touchEnd");
    await P.waitForTimeout(1600);
  }
  const w2 = await P.evaluate(() => Land.where());
  check(tag, w2.at === "world", "pinched out, the world again", w2);
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 2.6180339887), NYC);
  await P.waitForTimeout(300);
  await stroke(195, 422, 80, 104, 6);            // a short stroke: under a third of the way
  await P.waitForTimeout(150);
  const s1 = await P.evaluate(() => Land.descent());
  check(tag, !!s1 && s1.p < 0.3, "a short stroke is held a moment for the next", s1);
  // The next stroke within the moment carries on from there.
  await stroke(195, 422, 60, 200, 10, true);
  const s2 = await P.evaluate(() => Land.descent() || Land.rise());
  check(tag, !!s2 && (s2.p > (s1 ? s1.p : 0) || s2.down), "the next stroke carries on down", s2);
  // Pinched back out past where it began: the world's own pinch, these fingers.
  const pts = (d) => [{ x: 195 - d / 2, y: 422, id: 1 }, { x: 195 + d / 2, y: 422, id: 2 }];
  for (let i = 1; i <= 16; i++) { await touchAt(pts(200 - 170 * i / 16), "touchMove"); await P.waitForTimeout(30); }
  await touchAt([], "touchEnd");
  await P.waitForTimeout(1500);
  const w3 = await P.evaluate(() => ({ where: Land.where(), descent: Land.descent(), rise: Land.rise() }));
  check(tag, w3.where.at === "world" && !w3.descent && !w3.rise, "pinched back out, the world, nothing left half way", w3);
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await ctx.close();
}

// The recording of 14 Oct 2026: the Artists layer at the globe's nearest over the east coast, two fingers spread on
// New York's name with Boston's dot nearer the point between them. Only the cities are named while the world comes
// nearer, the city the fingers are on is lit, the way goes into New York, the lilac frame never shows, and from
// the hand-off the skyline is there, solid, the world round it going down into its dark.
async function aimed(browser) {
  const tag = "390x844 artists";
  const { ctx, P, cdp, errors } = await open(browser, 390, 844, true, "studios");
  const touchAt = (pts, type) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  await P.evaluate(() => {
    window.__sky = [];
    (function rec() {
      const r = Land.rise(), sk = document.querySelector(".skyline");
      if (r && r.down && sk && !sk.hidden && window.__sky.length < 400) {
        const cs = getComputedStyle(sk), m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor);
        window.__sky.push({ s: +r.s.toFixed(3), op: Number(cs.opacity), bg: m ? Number((m[1].split(",")[3] || "1").trim()) : 1 });
      }
      requestAnimationFrame(rec);
    })();
  });
  await P.evaluate(() => Land.globeAt(41.6, -72.4, 2.6180339887));
  await P.waitForTimeout(900);
  const before = await P.evaluate(() => Land.names());
  check(tag, !before.cities && before.named.some((n) => !n.town), "at rest the layer names its own (artists)", before.named.slice(0, 6).map((n) => n.title));
  // The point between the fingers on New York's name, toward its end (the side Boston is on).
  const nyName = before.named.filter((n) => /^New York/.test(n.title))[0];
  const ny = await P.evaluate(() => Land.at(40.758, -73.985));
  const x = nyName && nyName.box ? nyName.box[0] + (nyName.box[2] - nyName.box[0]) * 0.7 : ny.x + 30;
  const y = nyName && nyName.box ? (nyName.box[1] + nyName.box[3]) / 2 : ny.y;
  const pts = (d) => [{ x: x - d / 2, y, id: 1 }, { x: x + d / 2, y, id: 2 }];
  const during = [];
  // A first stroke, as a hand zooms; the second, within the moment the first is held for, goes just past the
  // hand-off and is held there while the skyline is made (software GL takes seconds), then on.
  await touchAt([pts(40)[0]], "touchStart");
  await touchAt(pts(40), "touchStart");
  for (let i = 1; i <= 12; i++) {
    await touchAt(pts(40 + 80 * i / 12), "touchMove");
    await P.waitForTimeout(40);
    during.push(await P.evaluate(() => ({ n: Land.names(), d: Land.descent() })));
    if (i === 8) { await P.screenshot({ path: path.join(OUT, `${tag}-aim.png`) }); }
  }
  const frame = await P.evaluate(() => getComputedStyle(document.getElementById("land")).outlineStyle);
  check(tag, frame === "none", "no lilac frame round the window after a touch", frame);
  await touchAt([], "touchEnd");
  await P.waitForTimeout(150);
  const d1 = await P.evaluate(() => Land.descent());
  const want = d1 ? Math.pow(d1.z1, 0.62) / d1.zoom : 6;            // to 0.62 of the way down
  await touchAt([pts(40)[0]], "touchStart");
  await touchAt(pts(40), "touchStart");
  for (let i = 1; i <= 8; i++) { await touchAt(pts(40 * Math.pow(want, i / 8)), "touchMove"); await P.waitForTimeout(40); }
  await P.waitForFunction(() => window.Skyline && Skyline.on && Skyline.on(), null, { timeout: 30000 }).catch(() => {});
  await P.waitForTimeout(600);
  await P.screenshot({ path: path.join(OUT, `${tag}-coming.png`) });
  const dEnd = 40 * want;
  for (let i = 1; i <= 8; i++) { await touchAt(pts(dEnd * Math.pow(1.6, i / 8)), "touchMove"); await P.waitForTimeout(60); }
  const named = during.filter((s) => s.n.cities).map((s) => s.n.named);
  check(tag, named.length > 0 && named.every((list) => list.every((n) => n.town)), "while the world comes nearer only the cities are named",
        named.length ? named[named.length - 1].map((n) => n.title) : null);
  const aims = during.map((s) => s.d && s.d.town).filter(Boolean);
  check(tag, aims.length > 0 && aims[aims.length - 1] === "new-york-us", "the way is aimed at New York, the city the fingers are on", aims);
  const lit = during.map((s) => s.n.named.filter((n) => n.aimed).map((n) => n.key)).filter((l) => l.length);
  check(tag, lit.length > 0 && lit[lit.length - 1][0] === "new-york-us", "its name is lit among the cities'", lit.slice(-1));
  await touchAt([], "touchEnd");
  // From the hand-off: the skyline solid, its ground's dark coming in (sampled every frame in the page: a
  // software GL frame is too slow to sample between).
  await P.waitForFunction(() => Land.where().at === "town" && !Land.rise() && !Land.descent(), null, { timeout: 60000 }).catch(() => {});
  const seenSky = await P.evaluate(() => (window.__sky || []).slice());
  check(tag, seenSky.length > 0 && seenSky.every((o) => o.op > 0.99), "on the way down the skyline is there, solid", seenSky.slice(0, 4));
  check(tag, seenSky.some((o) => o.bg < 0.6), "the world round it goes down into its dark as it comes, not at once", seenSky.map((o) => o.bg.toFixed(2)).slice(0, 8));
  await P.waitForTimeout(2500);
  const w = await P.evaluate(() => ({ where: Land.where(), names: Land.names().cities }));
  check(tag, w.where.at === "town" && w.where.key === "new-york-us", "into New York", w.where);
  check(tag, !w.names, "arrived, the world's names are the layer's again", w.names);
  await P.screenshot({ path: path.join(OUT, `${tag}-arrived.png`) });
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await ctx.close();
}

async function desktop(browser) {
  const tag = "1440x900";
  let { ctx, P, errors } = await open(browser, 1440, 900, false, "museums");
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 2.6180339887), NYC);
  await P.waitForTimeout(400);
  await P.mouse.move(720, 450);
  let shot = 0, wseen = null;
  for (let i = 0; i < 26; i++) {
    await P.mouse.wheel(0, -120);
    await P.waitForTimeout(45);
    wseen = wseen || await P.evaluate(() => Land.descent());
    if (i === 6 || i === 14 || i === 22) { await P.screenshot({ path: path.join(OUT, `${tag}-wheel-${shot++}.png`) }); }
  }
  check(tag, !!wseen, "the wheel past the globe's nearest goes down", wseen);
  await P.waitForTimeout(3500);
  const w = await P.evaluate(() => Land.where());
  check(tag, w.at === "town" && w.key === "new-york-us", "and, once it pauses, on into New York", w);
  await P.waitForTimeout(2000);
  await P.screenshot({ path: path.join(OUT, `${tag}-city.png`) });
  check(tag, (await ground(P)).src === "", "DIRT Earth's ground never loads", await ground(P));
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await ctx.close();

  // "+" at the nearest: the whole way, eased.
  ({ ctx, P, errors } = await open(browser, 1440, 900, false, "museums"));
  await P.evaluate(() => Land.globeAt(48.86, 2.34, 2.6180339887));        // Paris
  await P.waitForTimeout(300);
  await P.evaluate(() => document.body.focus());
  await P.keyboard.press("+");
  await P.waitForTimeout(4500);
  const k = await P.evaluate(() => Land.where());
  check(tag, k.at === "town" && /paris/.test(k.key || ""), "\"+\" at the nearest goes the whole way into the city in the middle", k);
  check(tag, errors.length === 0, "no page errors (+)", errors.slice(0, 3));
  await ctx.close();

  // Open sea: nothing within reach, the world stays at its nearest.
  ({ ctx, P, errors } = await open(browser, 1440, 900, false, "collages"));
  await P.evaluate(() => Land.globeAt(30, -40, 2.6180339887));
  await P.mouse.move(720, 450);
  for (let i = 0; i < 10; i++) { await P.mouse.wheel(0, -120); await P.waitForTimeout(40); }
  await P.waitForTimeout(900);
  const sea = await P.evaluate(() => ({ where: Land.where(), descent: Land.descent(), g: !!document.querySelector(".ground-dirt.on") }));
  check(tag, sea.where.at === "world" && !sea.descent && !sea.g, "over open sea the world stays at its nearest", sea);
  // On the Collages layer, over New York: its plot all the same.
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 2.6180339887), NYC);
  await P.waitForTimeout(300);
  for (let i = 0; i < 26; i++) { await P.mouse.wheel(0, -120); await P.waitForTimeout(45); }
  await P.waitForTimeout(3600);
  const col = await P.evaluate(() => Land.where());
  check(tag, col.at === "town" && col.key === "new-york-us", "on the Collages layer too, down into New York's plot", col);
  check(tag, errors.length === 0, "no page errors (sea, collages)", errors.slice(0, 3));
  await ctx.close();

  // The Artists layer: New York opens on those born there.
  ({ ctx, P, errors } = await open(browser, 1440, 900, false, "studios"));
  await P.waitForTimeout(1500);
  await P.evaluate((c) => Land.globeAt(c[0], c[1], 2.6180339887), NYC);
  await P.mouse.move(720, 450);
  for (let i = 0; i < 26; i++) { await P.mouse.wheel(0, -120); await P.waitForTimeout(45); }
  await P.waitForTimeout(6000);
  const born = await P.evaluate(() => ({ where: Land.where(), born: !!document.querySelector(".skyline-col .skyline-kicker") &&
    /Born here/.test(document.querySelector(".skyline-col").textContent) }));
  check(tag, born.where.at === "town" && born.born, "on the Artists layer New York opens on those born there", born);
  await P.screenshot({ path: path.join(OUT, `${tag}-artists.png`) });
  check(tag, errors.length === 0, "no page errors (artists)", errors.slice(0, 3));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  // ONLY=aimed|phone|desktop runs one part (ONLY_AIMED=1 as before).
  const only = process.env.ONLY || (process.env.ONLY_AIMED ? "aimed" : "");
  if (!only || only === "aimed") { try { await aimed(browser); } catch (e) { console.log("aimed threw", e); fails.push("aimed threw"); } }
  if (!only || only === "phone") { try { await phone(browser); } catch (e) { console.log("phone threw", e); fails.push("phone threw"); } }
  if (!only || only === "desktop") { try { await desktop(browser); } catch (e) { console.log("desktop threw", e); fails.push("desktop threw"); } }
  await browser.close();
  console.log(fails.length ? "FAILS: " + fails.length : "ALL OK");
  process.exit(fails.length ? 1 : 0);
})();

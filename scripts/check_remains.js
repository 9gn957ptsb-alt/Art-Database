// The remains (artist, 21 Oct 2026: "I want the pictures that show up of the galaxy and stars from NASA for quick
// 2nd as they fade away, they become a part of the background, as in, they actually become to animate some aspect
// of that black space"; docs/v2/land.js, "the remains"): what the telescope's photographs, dropped by the pointer in
// the far views, leave in the black as they fade. Checked in headless Chromium against NASA's real answers
// (scripts/nasa_standins.js), at 390x844 by touch (3x) and 1440x900 with a mouse (2x):
//
//   1. arrival    the clock stopped and stepped a held frame at a time: nothing before 0.7 of the print's life, then
//                 exposures phi^2, phi, 1 at 0.7, 0.8, 0.9 (a frame either way); the lights lit never fewer, the
//                 faintest lit never brighter; the light stays (what the box holds over the black, after the print
//                 is gone, at least 0.4 of what it held at 0.75); the brightest star within a CSS px of a peak of the
//                 photograph;
//   2. leaving    in phi s steps: lights lit never more, those gone always fainter than those left, none by 20 s
//                 and the canvas 0 x 0 and hidden;
//   3. behind     a photograph never dropped where it would lie over the world or Search; one dropped near the
//                 world, the world then grown over it: lights fall within 0.95 R and the screen there is as it was;
//   4. turned     the arrow keys turn the world: the black drifts phi^-3 of the land's way (to a pixel), its gas
//                 kept on the screen's grid; carried by a drag on the black, the world moves and the light holds;
//   5. crisp      a star a square of one colour on #remains and of s * dpr device pixels on the screen; a gas
//                 tile 11 CSS px of one colour;
//   6. cap        photographs one after another: never more than 13 at once unhurried, a hurried one gone in a second;
//   7. mirrors    one through the telescope's mirrors leaves its photograph's light, never the mirrors' lilac;
//   8. the dial   no light drawn under the globe's dial's words, nor under Search and the words at the foot;
//  13. a nebula   a photograph a nebula fills to its edges (made here, served as NASA's): its print shows no card
//                 (its corners and edges are the page's black), and its remains leave no frame (the light along
//                 its edges a small part of its brightest);
//   9. cleared    Hold still clears it at once, and so does going down into a city (and it is still clear up again);
//  10. calm       under reduced motion, even with Hold still turned off, nothing is left;
//  11. real route the pointer across the sky at real speed: at most 13, what drawing and reading cost.
//
// The software GL here draws a frame in a quarter of a second or more, which a phone does not: the sections on a
// running clock (4, 6, 7, 11) run it at a quarter (SLOW), so the page has the time a real GPU would give it, and
// the costs are given back in real milliseconds.
//  12. no page errors (a SecurityError would be a tainted read). Writes remains.json and the frames.
//
// Run: NODE_PATH=/opt/node22/lib/node_modules node scripts/check_remains.js --port 8741 --out <dir> [--only 1440]
// (serve docs/ on the port first: python3 -m http.server 8741, from docs/).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { openWindow, nasaStandIns, routeNasa, skySpots } = require("./nasa_standins");

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const PORT = arg("port", "8741");
const OUT = arg("out", fs.mkdtempSync(path.join(os.tmpdir(), "remains-")));
const ONLY = arg("only", "");
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const WINDOWS = [[390, 844, true, 3], [1440, 900, false, 2]].filter(w => !ONLY || String(w[0]) === ONLY);
const PHI = (1 + Math.sqrt(5)) / 2, INV3 = 1 / (PHI * PHI * PHI), BEAT5 = 1097;
const LILAC = [0x9d, 0x95, 0xe6];
const SLOW = 0.25;
const NEBULA = "https://images-assets.nasa.gov/image/remains-check-nebula/remains-check-nebula~thumb.jpg";

// A screenshot's pixels, read in a page of their own (no image library here): fn(d, w, h, args) runs on its RGBA.
async function inPixels(dec, png, fn, args) {
  return dec.evaluate(async ([b64, src, a]) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    return (new Function("d", "w", "h", "a", src))(d, c.width, c.height, a);
  }, [png.toString("base64"), fn, args]);
}
// The light a box holds over a black, outside a disc (all in CSS px; k the device's pixels to one).
const EXCESS = `
  const [bx, by, bw, bh, k, black, cx, cy, r] = a; let s = 0;
  for (let y = Math.max(0, Math.round(by * k)); y < Math.min(h, Math.round((by + bh) * k)); y++)
    for (let x = Math.max(0, Math.round(bx * k)); x < Math.min(w, Math.round((bx + bw) * k)); x++) {
      if (Math.hypot(x / k - cx, y / k - cy) < r) continue;
      const i = (y * w + x) * 4, e = 0.2126 * Math.max(0, d[i] - black[0]) + 0.7152 * Math.max(0, d[i + 1] - black[1]) + 0.0722 * Math.max(0, d[i + 2] - black[2]);
      s += e;
    }
  return s / (k * k);`;
// The colours at points (CSS px, k device px to one).
const AT = `const [pts, k] = a; return pts.map(([x, y]) => { const i = (Math.floor(y * k) * w + Math.floor(x * k)) * 4; return [d[i], d[i + 1], d[i + 2]]; });`;
// Whether a square (CSS px) is one colour, at the device's pixels.
const SQUARE = `const [x, y, s, k] = a; let first = null, same = true;
  for (let yy = Math.round(y * k); yy < Math.round((y + s) * k); yy++) for (let xx = Math.round(x * k); xx < Math.round((x + s) * k); xx++) {
    const i = (yy * w + xx) * 4, c = [d[i], d[i + 1], d[i + 2]];
    if (!first) { first = c; } else if (c[0] !== first[0] || c[1] !== first[1] || c[2] !== first[2]) { same = false; }
  }
  return { same, colour: first, n: Math.round(s * k) };`;
// The brightest pixels' places in a box (CSS px), for the photograph's peaks.
const PEAKS = `const [bx, by, bw, bh, k] = a; const out = [];
  for (let y = Math.round(by * k) + 1; y < Math.round((by + bh) * k) - 1; y++) for (let x = Math.round(bx * k) + 1; x < Math.round((bx + bw) * k) - 1; x++) {
    const i = (y * w + x) * 4, L = d[i] + d[i + 1] + d[i + 2];
    if (L < 300) continue;
    let top = true;
    for (let dy = -1; dy <= 1 && top; dy++) for (let dx = -1; dx <= 1; dx++) { const j = ((y + dy) * w + x + dx) * 4; if (d[j] + d[j + 1] + d[j + 2] > L) { top = false; break; } }
    if (top) out.push([x / k, y / k, L]);
  }
  return out.sort((p, q) => q[2] - p[2]).slice(0, 80);`;

async function check(browser, w, h, touch, dsf, stand) {
  const fails = [], out = { window: [w, h, dsf] };
  const fail = m => { fails.push(m); console.log("  FAIL " + w + ": " + m); };
  const { ctx, page, errors } = await openWindow(browser, w, h, touch, dsf);
  const dec = await ctx.newPage();
  // A nebula that fills its photograph to the edges (no sky in it at all), made here and served among NASA's.
  const nebula = Buffer.from(await dec.evaluate(() => {
    const c = document.createElement("canvas"), W = 640, H = 420;
    c.width = W; c.height = H;
    const g = c.getContext("2d"), im = g.createImageData(W, H), d = im.data;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = Math.pow(Math.hypot(x - W * 0.45, y - H * 0.55) / Math.hypot(W * 0.55, H * 0.55), 0.8), n = (rnd() - 0.5) * 18, i = (y * W + x) * 4;
      d[i] = 230 + (90 - 230) * t + n; d[i + 1] = 170 + (60 - 170) * t + n; d[i + 2] = 140 + (58 - 140) * t + n; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    for (let k = 0; k < 30; k++) { g.fillStyle = "#fff"; g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 2, 2); }
    return c.toDataURL("image/jpeg", 0.92).split(",")[1];
  }), "base64");
  const withNebula = JSON.parse(stand.body);
  withNebula.collection.items.unshift({ data: [{ nasa_id: "remains-check-nebula", title: "Hubble nebula filling the frame (the check's own)",
    keywords: ["Hubble", "nebula"], description: "A nebula seen by Hubble, filling the frame.", date_created: "2020-01-01" }], links: [{ href: NEBULA, render: "image" }] });
  await routeNasa(page, { body: JSON.stringify(withNebula), images: Object.assign({}, stand.images, { [NEBULA]: nebula }) });
  await page.addInitScript(() => {
    // The print's own 2.4 s clean-up runs on the real clock; held, it would take it away mid-sequence.
    const later = window.setTimeout.bind(window);
    window.setTimeout = (fn, ms, ...a) => later(fn, ms === 2400 ? 600000 : ms, ...a);
  });
  await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
  await page.evaluate(() => Land.pace(false));
  await page.evaluate(() => Land.globeAt(20, 10, 0.4));
  await page.waitForFunction(() => { const x = Land.shot(5, 5, "plain"); return x.tokens > 4 && x.shown; }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const R0 = await page.evaluate(() => Land.remains());
  if (!R0.on) { fail("the remains are off (REMAINS false)"); }
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  // The world back where the check put it: left alone it swings to a new distance (and over a spot in the sky).
  const reseat = async () => { await page.evaluate(() => Land.globeAt(20, 10, 0.4)); await settle(); };
  // A print held still by the check is finished, so it goes as it would (its animationend).
  const finishCss = () => page.evaluate(() => document.querySelectorAll(".trail-shot").forEach(el => el.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} })));
  const empty = async () => {
    await finishCss();
    await page.evaluate(() => window.__setSlow(1));
    await page.waitForFunction(() => document.querySelectorAll(".trail-shot").length === 0 && Land.remains().n === 0, null, { timeout: 40000 }).catch(() => {});
  };
  await empty();
  const geo = await page.evaluate(() => Land.remains());
  const black = await page.evaluate(() => (getComputedStyle(document.getElementById("stage")).backgroundColor.match(/\d+/g) || [15, 10, 7]).slice(0, 3).map(Number));
  // Points in the sky where a photograph lies wholly on the black (land.js onTheBlack), nearest the world first.
  const spots = await skySpots(page, w, h);
  out.room = spots.length;
  if (!spots.length) { fail("no room on the black for a photograph"); await ctx.close(); out.fails = fails; return out; }
  // The arrival's: the one farthest from the world (its clip wholly on the window); the cap's: spread over the rest.
  const far = spots.filter(p => p[0] >= 100 && p[0] <= w - 100 && p[1] >= 100 && p[1] <= h - 100);
  let [px, py] = (far.length ? far : spots)[(far.length ? far : spots).length - 1];
  const spreadOf = (all) => {
    const out2 = [];
    all.slice().reverse().forEach(p => { if (out2.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > 115)) { out2.push(p); } });
    return out2;
  };
  let spread = spreadOf(spots);
  out.spread = spread.length;
  const spot = (i) => spread[i % spread.length].slice(0, 2);
  const holdCss = () => page.evaluate(ms => document.querySelectorAll(".trail-shot").forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; })), 0);
  const cssAt = (ms) => page.evaluate(m => document.querySelectorAll(".trail-shot").forEach(el => el.getAnimations().forEach(a => { a.pause(); a.currentTime = m; })), ms);

  // 1. Arrival.
  await page.evaluate(() => window.__setSlow(0));
  const t0 = await page.evaluate(([x, y]) => { const t = performance.now(); Land.shot(x, y, "plain"); return t; }, [px, py]);
  await holdCss();
  await page.waitForFunction(() => Land.remains().n === 1, null, { timeout: 8000 }).catch(() => {});
  if ((await page.evaluate(() => Land.remains().n)) !== 1) { fail("the photograph was not read for its remains"); }
  const frames = [], half = 100;
  const clip = { x: Math.max(0, px - half), y: Math.max(0, py - half), width: 2 * half, height: 2 * half };
  let shot820 = null, shot1139 = null, box = null;
  for (let ms = 0, n = 0; ms <= 1300; ms += 42, n += 1) {
    if (ms) { await page.evaluate(() => window.__advance(42)); }
    await settle();
    const v = Math.round(await page.evaluate(() => performance.now()) - t0);
    await cssAt(v);
    const r = await page.evaluate(() => Land.remains(true));
    const one = r.list[0];
    const lit = one ? one.lights.filter(l => l[8]) : [];
    frames.push({ ms: v, E: one ? one.E : null, lit: lit.length, faintest: lit.length ? Math.min(...lit.map(l => l[6])) : null });
    if (!box && one) { box = one.box; out.box = box; out.stars = one.stars; out.tiles = one.tiles; out.black = one.black; }
    const png = await page.screenshot({ path: path.join(OUT, `${w}-remains-${String(n).padStart(2, "0")}-${v}.png`), clip });
    if (!shot820 && v >= 0.75 * BEAT5) { shot820 = await page.screenshot(); }
    if (!shot1139 && v >= BEAT5 + 42) { shot1139 = await page.screenshot(); }
  }
  out.arrival = frames;
  const near = (ms, k) => frames.filter(f => Math.abs(f.ms - ms) <= 43).some(f => Math.abs((f.E || 0) - k) < 1e-6);
  if (frames.some(f => f.ms < 0.7 * BEAT5 - 43 && f.E)) { fail("light before the print began to fade"); }
  if (!near(0.7 * BEAT5 + 21, PHI * PHI) || !near(0.8 * BEAT5 + 21, PHI) || !near(0.9 * BEAT5 + 21, 1)) { fail("exposures not phi^2, phi, 1 at 0.7, 0.8, 0.9: " + JSON.stringify(frames.filter(f => f.E).map(f => [f.ms, +(f.E || 0).toFixed(3)]))); }
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].lit < frames[i - 1].lit) { fail("fewer lights lit as it arrived at " + frames[i].ms + " ms"); break; }
    if (frames[i - 1].faintest !== null && frames[i].faintest !== null && frames[i].faintest > frames[i - 1].faintest + 1e-6) { fail("the faintest lit got brighter at " + frames[i].ms + " ms"); break; }
  }
  if (box && shot820 && shot1139) {
    const a = [box[0], box[1], box[2], box[3], dsf, black, geo.cx, geo.cy, geo.R * 1.02];
    const e820 = await inPixels(dec, shot820, EXCESS, a), e1139 = await inPixels(dec, shot1139, EXCESS, a);
    out.light = { at820: Math.round(e820), at1139: Math.round(e1139), kept: +(e1139 / Math.max(1, e820)).toFixed(3) };
    if (e1139 < 0.4 * e820) { fail("the light did not stay: " + JSON.stringify(out.light)); }
    // The brightest star where the photograph had a peak.
    const r = await page.evaluate(() => Land.remains(true));
    const stars = r.list.length ? r.list[0].lights.filter(l => l[0] === "star") : [];
    if (stars.length) {
      const top = stars.slice().sort((p, q) => q[6] - p[6])[0];
      const peaks = await inPixels(dec, shot820, PEAKS, [box[0], box[1], box[2], box[3], dsf]);
      const dist = Math.min(...peaks.map(p => Math.hypot(p[0] - (top[1] + 0.5 * top[7]), p[1] - (top[2] + 0.5 * top[7]))));
      out.brightest = { at: [top[1], top[2]], size: top[7], V: +top[6].toFixed(1), toPeak: +dist.toFixed(2) };
      // Its square's middle within half a pixel more than its own size of a peak (a bloomed star is two pixels).
      if (!(dist <= top[7] + 0.5)) { fail("the brightest star is " + dist.toFixed(1) + " CSS px from the photograph's nearest peak"); }
    } else { out.brightest = null; }
  }

  await finishCss();
  // 5. Crisp, while it is whole (after the print, before it dims).
  {
    await page.evaluate(() => window.__advance(400));
    await settle();
    const r = await page.evaluate(() => Land.remains(true));
    const lights = r.list.length ? r.list[0].lights.filter(l => l[8]) : [];
    const lone = (l) => !lights.some(o => o !== l && o[1] < l[1] + l[7] + 1 && l[1] < o[1] + o[7] + 1 && o[2] < l[2] + l[7] + 1 && l[2] < o[2] + o[7] + 1);
    const star = lights.find(l => l[0] === "star" && lone(l) && Math.hypot(l[1] - r.cx, l[2] - r.cy) > 1.3 * r.R);
    const gas = lights.find(l => l[0] === "gas" && Math.hypot(l[1] - r.cx, l[2] - r.cy) > 1.3 * r.R &&
      !lights.some(o => o[0] === "star" && o[1] + o[7] > l[1] && o[1] < l[1] + l[7] && o[2] + o[7] > l[2] && o[2] < l[2] + l[7]));
    const png = await page.screenshot();
    out.crisp = {};
    if (star) {
      const onCanvas = await page.evaluate(([x, y, s]) => {
        const c = document.getElementById("remains"), d = c.getContext("2d").getImageData(x, y, s, s).data;
        for (let i = 4; i < d.length; i += 4) { if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) { return false; } }
        return [d[0], d[1], d[2]];
      }, [star[1], star[2], star[7]]);
      const onScreen = await inPixels(dec, png, SQUARE, [star[1], star[2], star[7], dsf]);
      out.crisp.star = { size: star[7], canvas: onCanvas, screen: onScreen };
      if (!onCanvas || !onScreen.same || onScreen.n !== Math.round(star[7] * dsf)) { fail("a star is not a crisp square: " + JSON.stringify(out.crisp.star)); }
    } else { out.crisp.star = "no lone star clear of the world"; }
    if (gas) {
      const sq = await page.evaluate(([x, y, s]) => {
        const c = document.getElementById("remains"), d = c.getContext("2d").getImageData(x, y, s, s).data;
        for (let i = 4; i < d.length; i += 4) { if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) { return null; } }
        return [d[0], d[1], d[2]];
      }, [gas[1], gas[2], gas[7]]);
      const onScreen = await inPixels(dec, png, SQUARE, [gas[1], gas[2], gas[7], dsf]);
      out.crisp.gas = { grain: gas[7], canvas: sq, screen: onScreen };
      if (!sq || !onScreen.same || onScreen.n !== Math.round(gas[7] * dsf)) { fail("a square of gas is not one colour at the device's pixels: " + JSON.stringify(out.crisp.gas)); }
    }
  }

  // 2. Leaving, in phi s steps.
  {
    const steps = [];
    let prev = null, ok = true;
    for (let t = 0; t < 22000; t += 1618) {
      await page.evaluate(() => window.__advance(1618));
      await settle();
      const r = await page.evaluate(() => Land.remains(true));
      const one = r.list[0];
      if (!one) { steps.push({ at: Math.round(await page.evaluate(() => performance.now()) - t0), n: 0, shown: r.shown, canvas: r.canvas }); prev = 0; continue; }
      const lit = one.lights.filter(l => l[8]), dark = one.lights.filter(l => !l[8] && l[1] + l[7] >= 0 && l[2] + l[7] >= 0 && l[1] <= r.W && l[2] <= r.H);
      steps.push({ at: Math.round(await page.evaluate(() => performance.now()) - t0), E: +one.E.toFixed(3), grain: one.grain, lit: lit.length });
      if (prev !== null && lit.length > prev) { ok = false; fail("more lights lit as it went out"); }
      if (lit.length && dark.length && Math.max(...dark.map(l => l[6])) > Math.min(...lit.map(l => l[6])) + 1e-6) { ok = false; fail("a brighter light went before a fainter one"); }
      prev = lit.length;
      if (!ok) { break; }
    }
    out.leaving = steps;
    const grains = steps.filter(s => s.grain).map(s => s.grain);
    const ladder = [2, 3, 5, 8, 13];
    for (let i = 1; i < grains.length; i++) {
      if (grains[i] < grains[i - 1] || (grains[i] !== grains[i - 1] && ladder.indexOf(grains[i]) !== ladder.indexOf(grains[i - 1]) + 1)) { fail("the gas did not coarsen step by step: " + grains.join(", ")); break; }
    }
    if (grains.length && grains[0] !== 2) { fail("the gas did not begin at 2 px: " + grains[0]); }
    const last = await page.evaluate(() => Land.remains());
    if (last.n !== 0 || last.shown || (last.canvas && (last.canvas[0] || last.canvas[1]))) { fail("still there after 22 s: " + JSON.stringify({ n: last.n, shown: last.shown, canvas: last.canvas })); }
    const at20 = steps.filter(s => s.at <= 20200 + BEAT5).pop();
    out.goneBy = (steps.find(s => s.n === 0) || {}).at;
    if (!out.goneBy || out.goneBy > 20000 + 1700) { fail("not gone by 20 s"); }
  }
  await empty();

  // 3. Never dropped over the world or Search; behind the world when it is grown over the light.
  {
    const g = await page.evaluate(() => Land.remains());
    const a = -2.4, d = g.R * 1.1;
    const bx = Math.round(g.cx + Math.cos(a) * d), by = Math.round(g.cy + Math.sin(a) * d);
    const rim = await page.evaluate(([x, y]) => Land.shot(x, y, "plain").dropped, [bx, by]);
    const find = await page.evaluate(() => { const el = document.querySelector("#art-find"); if (!el || el.hidden) { return null; } const b = el.getBoundingClientRect(); return b.width ? [b.left + b.width / 2, b.top + b.height / 2 - 30] : null; });
    const onFind = find ? await page.evaluate(([x, y]) => Land.shot(x, y, "plain").dropped, find) : null;
    out.refused = { rim: !rim, search: find ? !onFind : "no Search" };
    if (rim) { fail("a photograph was dropped over the world's rim"); }
    if (find && onFind) { fail("a photograph was dropped over Search"); }
    await finishCss();
    await empty();
    // The nearest spot to the world with room; placed and whole, then the world grown over it.
    await reseat();
    const [nx, ny] = spots[0];
    await page.evaluate(() => window.__setSlow(0));
    await page.evaluate(([x, y]) => Land.shot(x, y, "plain"), [nx, ny]);
    await holdCss();
    await page.waitForFunction(() => Land.remains().n === 1, null, { timeout: 8000 }).catch(() => {});
    for (let ms = 0; ms < BEAT5 + 84; ms += 42) { await page.evaluate(() => window.__advance(42)); await settle(); }
    await cssAt(BEAT5 + 84);
    // Grown in steps until the world lies over the light (the page holds a large world on the window, so its middle moves).
    let grownTo = 0, size = 0.4, r = null;
    for (let step = 0; step < 8; step++) {
      size *= 1.35;
      grownTo = (await page.evaluate(k => Land.globeAt(20, 10, k), size)) ? size : 0;
      for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__advance(42)); await settle(); }
      r = await page.evaluate(() => Land.remains(true));
      if (r.list.length && r.list[0].lights.some(l => l[8] && Math.hypot(l[1] + l[7] / 2 - r.cx, l[2] + l[7] / 2 - r.cy) < 0.95 * r.R)) { break; }
    }
    const inside = r.list.length ? r.list[0].lights.filter(l => l[8] && Math.hypot(l[1] + l[7] / 2 - r.cx, l[2] + l[7] / 2 - r.cy) < 0.95 * r.R) : [];
    out.behind = { dropped: [nx, ny], grown: !!grownTo, R: Math.round(r.R), n: r.n, lightsInside: inside.length };
    if (!r.n) { fail("growing the world cleared the black's light"); }
    if (!inside.length) {
      out.behind.note = "no light fell inside 0.95 R (the world did not grow over it)";
      if (grownTo) { fail("the world was grown over the light, yet none of it lay inside the world"); }
    } else {
      // At one moment (the clock stopped): the screen with the black's light, and without it.
      const after = await page.screenshot();
      await page.evaluate(() => { document.getElementById("remains").style.visibility = "hidden"; });
      await settle();
      const before = await page.screenshot();
      await page.evaluate(() => { document.getElementById("remains").style.visibility = ""; });
      const pts = inside.slice(0, 40).map(l => [l[1] + l[7] / 2, l[2] + l[7] / 2]);
      const c0 = await inPixels(dec, before, AT, [pts, dsf]), c1 = await inPixels(dec, after, AT, [pts, dsf]);
      const worst = Math.max(...c0.map((c, i) => Math.abs(c[0] - c1[i][0]) + Math.abs(c[1] - c1[i][1]) + Math.abs(c[2] - c1[i][2])));
      out.behind.worstChange = worst;
      if (worst > 6) { fail("light shows over the world (a change of " + worst + " where the world is)"); }
    }
    await finishCss();
    await empty();
    await reseat();
  }

  // 13. A nebula that fills its photograph: no card in the print, no frame left in the black.
  {
    await reseat();
    await page.evaluate(() => window.__setSlow(0));
    const shot = await page.evaluate(([x, y]) => Land.shot(x, y, "plain", "remains-check-nebula"), [px, py]);
    out.nebula = { known: shot.ids.indexOf("remains-check-nebula") >= 0, dropped: shot.dropped };
    if (!out.nebula.known) { fail("the check's nebula was never measured as a photograph"); }
    await holdCss();
    await page.waitForFunction(() => Land.remains().n === 1, null, { timeout: 8000 }).catch(() => {});
    await cssAt(400);
    await settle();
    const print = await page.evaluate(() => { const el = document.querySelector(".trail-shot"); if (!el) { return null; } const b = el.getBoundingClientRect(); return { box: [b.left, b.top, b.width, b.height], filter: el.style.filter || "" }; });
    if (print) {
      const [bx, by, bw, bh] = print.box;
      // Its outermost pixel all round (a card is a line there), every 4 CSS px.
      const pts = [];
      for (let t = 0.5; t < bw; t += 4) { pts.push([bx + t, by + 0.4], [bx + t, by + bh - 0.6]); }
      for (let t = 0.5; t < bh; t += 4) { pts.push([bx + 0.4, by + t], [bx + bw - 0.6, by + t]); }
      const cs = await inPixels(dec, await page.screenshot(), AT, [pts, dsf]);
      const worst = Math.max(...cs.map(c => Math.abs(c[0] - black[0]) + Math.abs(c[1] - black[1]) + Math.abs(c[2] - black[2])));
      out.nebula.print = { filter: /remains-black/.test(print.filter), edgeOffBlack: worst };
      if (!out.nebula.print.filter) { fail("the print's own black is not taken off it"); }
      if (worst > 12) { fail("the nebula's print shows a card: its edge is " + worst + " off the page's black"); }
    } else { fail("the nebula's print was not put up"); }
    for (let ms = 0; ms < BEAT5 + 84; ms += 42) { await page.evaluate(() => window.__advance(42)); await settle(); }
    const r = await page.evaluate(() => Land.remains(true));
    const one = r.list[0];
    if (one) {
      const [ox, oy, ow, oh] = one.box, sx = one.shift[0], sy = one.shift[1];
      const gas = one.lights.filter(l => l[0] === "gas");
      const edge = gas.filter(l => { const mx = l[1] + l[7] / 2 - sx, my = l[2] + l[7] / 2 - sy; return Math.min(mx - ox, ox + ow - mx, my - oy, oy + oh - my) < 3; });
      const top = Math.max(0, ...gas.map(l => l[6])), edgeTop = Math.max(0, ...edge.map(l => l[6]));
      out.nebula.remains = { black: one.black, top: +top.toFixed(1), edgeTop: +edgeTop.toFixed(1), ratio: +(edgeTop / Math.max(1e-6, top)).toFixed(3) };
      if (!top) { fail("the nebula left nothing"); }
      else if (edgeTop > 0.2 * top) { fail("the nebula's remains keep its frame: " + JSON.stringify(out.nebula.remains)); }
    } else { fail("the nebula's light was not read"); }
    await finishCss();
    await empty();
  }

  // 4. Turned, and carried (the clock at a quarter, as for every section on a running clock).
  {
    await reseat();
    await page.evaluate(k => window.__setSlow(k), SLOW);
    await page.evaluate(([x, y]) => Land.shot(x, y, "plain"), [px, py]);
    await page.waitForFunction(() => Land.remains().list.some(r => r.placed), null, { timeout: 20000 }).catch(() => {});
    if (!(await page.evaluate(() => Land.remains().n))) { fail("a photograph dropped on a running clock left nothing"); }
    const a = await page.evaluate(() => Land.remains());
    for (let i = 0; i < 6; i++) { await page.evaluate(() => Land.keys("ArrowRight")); await page.waitForTimeout(120); }
    await page.waitForTimeout(1500);
    const b = await page.evaluate(() => Land.remains());
    let dSpin = b.spin - a.spin;
    while (dSpin > Math.PI) { dSpin -= 2 * Math.PI; } while (dSpin < -Math.PI) { dSpin += 2 * Math.PI; }
    const want = -b.R * dSpin * INV3, got = b.off[0] - a.off[0];
    out.turned = { dSpin: +dSpin.toFixed(4), driftX: +got.toFixed(2), want: +want.toFixed(2), driftY: +(b.off[1] - a.off[1]).toFixed(2) };
    if (!(Math.abs(dSpin) > 0.01)) { fail("the arrow keys did not turn the world"); }
    if (Math.abs(got - want) > 1 || Math.abs(b.off[1] - a.off[1]) > 1) { fail("the black did not drift phi^-3 of the land's way: " + JSON.stringify(out.turned)); }
    // Its gas still on the screen's grid at its grain.
    const onGrid = await page.evaluate(() => Land.remains(true).list.every(r => r.lights.filter(l => l[0] === "gas").every(l => l[1] % l[7] === 0 && l[2] % l[7] === 0)));
    out.turned.gasOnGrid = onGrid;
    if (!onGrid) { fail("the drift took the gas off the screen's grid"); }
    // Carried by a drag on the black: the world moves, the light holds.
    const c0 = await page.evaluate(() => Land.remains(true));
    const sx = Math.max(20, Math.min(w - 20, c0.cx - c0.R * 1.5)), sy = Math.max(20, Math.min(h - 140, c0.cy + c0.R * 0.2));
    const cdp = touch ? await ctx.newCDPSession(page) : null;
    const fingerAt = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    if (touch) { await fingerAt("touchStart", sx, sy); } else { await page.mouse.move(sx, sy); await page.mouse.down(); }
    for (let i = 1; i <= 8; i++) {
      if (touch) { await fingerAt("touchMove", sx + i * 8, sy - i * 4); } else { await page.mouse.move(sx + i * 8, sy - i * 4); }
      await page.waitForTimeout(40);
    }
    if (touch) { await fingerAt("touchEnd", 0, 0); } else { await page.mouse.up(); }
    await page.waitForTimeout(500);
    const c1 = await page.evaluate(() => Land.remains(true));
    const moved = Math.hypot(c1.cx - c0.cx, c1.cy - c0.cy);
    // The same photograph's light (by when it was dropped): moved only by the drift of whatever turn the drag gave the world.
    const was = c0.list[0], now = was ? c1.list.find(l => l.at === was.at) : null;
    let dTurn = c1.spin - c0.spin;
    while (dTurn > Math.PI) { dTurn -= 2 * Math.PI; } while (dTurn < -Math.PI) { dTurn += 2 * Math.PI; }
    const turned = Math.abs(dTurn) > 1e-6 || Math.abs(c1.tilt - c0.tilt) > 1e-6;
    const shift = now ? [now.shift[0] - was.shift[0], now.shift[1] - was.shift[1]] : null;
    const drift = [Math.round(c1.off[0]) - Math.round(c0.off[0]), Math.round(c1.off[1]) - Math.round(c0.off[1])];
    out.carried = { worldMoved: +moved.toFixed(1), turned, dSpin: +dTurn.toFixed(4), shift, drift, n: c1.n };
    if (now && (shift[0] !== drift[0] || shift[1] !== drift[1])) { fail("the light moved other than by the drift: " + JSON.stringify(out.carried)); }
    if (now && moved > 2 && !turned && (shift[0] || shift[1])) { fail("carrying the world moved the light: " + JSON.stringify(out.carried)); }
    if (!(moved > 2)) { out.carried.note = "the drag did not carry the world (it may have dropped photographs only)"; }
    await empty();
  }

  // 7. Through the mirrors.
  {
    await reseat();
    await page.evaluate(k => window.__setSlow(k), SLOW);
    await page.evaluate(([x, y]) => Land.shot(x, y, "through"), [px, py]);
    await page.waitForFunction(() => Land.remains().list.some(r => r.placed && r.E === 1), null, { timeout: 30000 }).catch(() => {});
    const r = await page.evaluate(() => Land.remains(true));
    const lights = r.list.length ? r.list[0].lights.filter(l => l[8]) : [];
    const lilac = lights.filter(l => Math.abs(l[3] - LILAC[0]) + Math.abs(l[4] - LILAC[1]) + Math.abs(l[5] - LILAC[2]) < 12);
    out.mirrors = { n: r.n, lit: lights.length, lilac: lilac.length };
    if (!r.n || !lights.length) { fail("a photograph through the mirrors left nothing"); }
    if (lilac.length) { fail("the mirrors' lilac was left in the black"); }
    await empty();
  }

  // 6. The cap: photographs one after another, round the world.
  {
    // The world back where it was (it swings to a new distance when left alone), and the room on the black again.
    await page.evaluate(() => window.__setSlow(1));
    await reseat();
    spread = spreadOf(await skySpots(page, w, h));
    if (!spread.length) { spread = [[px, py]]; }
    await page.evaluate(k => window.__setSlow(k), SLOW);
    let most = 0, slow = 0, dropped = 0;
    const hurriedAt = {};
    const watch = async () => {
      const r = await page.evaluate(() => Object.assign(Land.remains(), { now: performance.now() }));
      most = Math.max(most, r.list.filter(l => l.placed && !l.hurried).length);
      r.list.forEach(l => { if (l.hurried && !hurriedAt[l.at]) { hurriedAt[l.at] = r.now; } });
      Object.keys(hurriedAt).forEach(k => { if (hurriedAt[k] && !r.list.some(l => String(l.at) === k)) { if (r.now - hurriedAt[k] > 1500) { slow += 1; } hurriedAt[k] = 0; } });
    };
    // 24 photographs, one a seventh of a print's life apart (seven prints at most at once), round the sky.
    for (let i = 0; i < 24; i++) {
      const [x, y] = spot(i);
      if ((await page.evaluate(([x, y]) => Land.shot(x, y, "plain"), [x, y])).dropped) { dropped += 1; }
      await page.waitForTimeout(Math.ceil(BEAT5 / 7 / SLOW) + 20);
      await watch();
    }
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(300); await watch(); }
    const r = await page.evaluate(() => Land.remains());
    out.cap = { dropped, most, hurried: Object.keys(hurriedAt).length, slowToGo: slow, n: r.n };
    if (most > 13) { fail("more than 13 at once: " + most); }
    if (!Object.keys(hurriedAt).length) { fail("the cap was never reached: " + JSON.stringify(out.cap)); }
    if (slow) { fail("a hurried one took more than a second and a half to go"); }
    await page.screenshot({ path: path.join(OUT, `${w}-remains-many.png`) });

    // 8. The dial's words keep their black.
    const boxes = await page.evaluate(() => (window.GlobeDial && GlobeDial.boxes ? GlobeDial.boxes() : []).map(b => [b.x0, b.y0, b.x1, b.y1]));
    // Under the dial's words the black is the stage's own: nothing of the light there.
    const under = await page.evaluate(([bx, black]) => {
      const c = document.getElementById("remains");
      if (!c || c.hidden || !c.width) { return -1; }
      const g = c.getContext("2d");
      let n = 0;
      bx.forEach(b => {
        const x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(c.width, Math.ceil(b[2])), y1 = Math.min(c.height, Math.ceil(b[3]));
        if (x1 <= x0 || y1 <= y0) { return; }
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        for (let i = 0; i < d.length; i += 4) { if (d[i] !== black[0] || d[i + 1] !== black[1] || d[i + 2] !== black[2]) { n += 1; } }
      });
      return n;
    }, [boxes, black]);
    out.dial = { boxes: boxes.length, litPixelsUnder: under };
    if (under > 0) { fail(under + " pixels of light under the dial's words"); }
    // And under the words at the foot (Search, the guide's pill …), which the page keeps (remainsKeep).
    const keep = await page.evaluate(() => Land.remains().keep.map(b => [b.x0, b.y0, b.x1, b.y1]));
    const underKeep = await page.evaluate(([bx, black]) => {
      const c = document.getElementById("remains");
      if (!c || c.hidden || !c.width) { return -1; }
      const g = c.getContext("2d");
      let n = 0;
      bx.forEach(b => {
        const x0 = Math.max(0, Math.floor(b[0])), y0 = Math.max(0, Math.floor(b[1])), x1 = Math.min(c.width, Math.ceil(b[2])), y1 = Math.min(c.height, Math.ceil(b[3]));
        if (x1 <= x0 || y1 <= y0) { return; }
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        for (let i = 0; i < d.length; i += 4) { if (d[i] !== black[0] || d[i + 1] !== black[1] || d[i + 2] !== black[2]) { n += 1; } }
      });
      return n;
    }, [keep, black]);
    out.foot = { boxes: keep.length, litPixelsUnder: underKeep };
    if (underKeep > 0) { fail(underKeep + " pixels of light under the words at the world's foot"); }

    // 9. Hold still clears it at once.
    await page.evaluate(() => Land.still(true));
    await settle();
    const s = await page.evaluate(() => Land.remains());
    out.still = { n: s.n, shown: s.shown };
    if (s.n || s.shown) { fail("Hold still did not clear it"); }
    await page.evaluate(() => Land.still(false));
  }

  // 11. The real route: the pointer across the sky at real speed.
  {
    await empty();
    await page.evaluate(k => window.__setSlow(k), SLOW);
    const cdp = touch ? await ctx.newCDPSession(page) : null;
    const finger = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
    const g = await page.evaluate(() => Land.remains());
    const sky = [];
    for (let i = 0; i < 70; i++) {
      const x = 40 + (i * 131) % (w - 80), y = i % 2 ? Math.max(40, g.cy - g.R * 1.5) : Math.min(h - 140, g.cy + g.R * 1.5);
      sky.push([Math.max(10, Math.min(w - 10, x)), Math.max(10, Math.min(h - 10, y))]);
    }
    let most = 0, draw = 0, read = 0;
    if (touch) { await finger("touchStart", [{ x: sky[0][0], y: sky[0][1], id: 1, radiusX: 4, radiusY: 4, force: 1 }]); }
    else { await page.mouse.move(sky[0][0], sky[0][1]); }
    for (const [x, y] of sky) {
      if (touch) { await finger("touchMove", [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }]); } else { await page.mouse.move(x, y, { steps: 2 }); }
      await page.waitForTimeout(90);
      const r = await page.evaluate(() => Land.remains());
      most = Math.max(most, r.list.filter(l => l.placed && !l.hurried).length);
      draw = Math.max(draw, r.cost.draw); read = Math.max(read, r.cost.read);
    }
    if (touch) { await finger("touchEnd", []); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `${w}-remains-whole.png`) });
    const r = await page.evaluate(() => Land.remains());
    out.route = { most, n: r.n, drawMs: +(draw / SLOW).toFixed(2), readMs: +(read / SLOW).toFixed(2) };
    if (most > 13) { fail("more than 13 at once on the real route"); }
    if (!r.n) { fail("the real route left nothing in the black"); }

    // 9b. Down into a city clears it, and it is still clear up again.
    await page.evaluate(() => window.__setSlow(1));
    await page.evaluate(() => Land.town("paris-fr"));
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "town" && !x.flying; }, null, { timeout: 60000 }).catch(() => {});
    const inCity = await page.evaluate(() => Land.remains());
    await page.evaluate(() => Land.up());
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "globe" && !x.flying; }, null, { timeout: 60000 }).catch(() => {});
    const upAgain = await page.evaluate(() => Land.remains());
    out.city = { inCity: inCity.n, upAgain: upAgain.n, shownUp: upAgain.shown };
    if (inCity.n || inCity.shown) { fail("going down into a city did not clear it"); }
    if (upAgain.n || upAgain.shown) { fail("the world's light came back after a city"); }
  }
  out.errors = errors.slice(0, 3);
  if (errors.length) { fail("page errors: " + errors.slice(0, 3).join(" | ")); }
  await ctx.close();

  // 10. Calm: reduced motion, even with Hold still turned off.
  {
    const { ctx: c2, page: p2, errors: e2 } = await openWindow(browser, w, h, touch, dsf, { reducedMotion: "reduce" });
    await routeNasa(p2, stand);
    await p2.addInitScript(() => { try { localStorage.setItem("site.still", "0"); } catch (e) {} });
    await p2.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
    await p2.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
    await p2.evaluate(() => Land.globeAt(20, 10, 0.4));
    await p2.waitForFunction(() => { const x = Land.shot(5, 5, "plain"); return x.tokens > 4 && x.shown; }, null, { timeout: 60000 }).catch(() => {});
    await p2.waitForTimeout(1500);
    await p2.evaluate(([x, y]) => Land.shot(x, y, "plain"), [px, py]);
    await p2.waitForTimeout(2500);
    const r = await p2.evaluate(() => Land.remains());
    out.calm = { n: r.n, shown: r.shown, still: await p2.evaluate(() => Land.still()) };
    if (r.n || r.shown) { fail("under reduced motion something was left: " + JSON.stringify(out.calm)); }
    if (e2.length) { fail("page errors (reduced motion): " + e2.slice(0, 2).join(" | ")); }
    await c2.close();
  }
  out.fails = fails;
  console.log(w, JSON.stringify(out));
  return out;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const stand = nasaStandIns(OUT);
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const all = [];
  for (const [w, h, touch, dsf] of WINDOWS) { all.push(await check(browser, w, h, touch, dsf, stand)); }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "remains.json"), JSON.stringify(all, null, 1));
  const bad = all.reduce((s, o) => s + o.fails.length, 0);
  console.log(bad ? bad + " failed" : "all ok", "· frames in", OUT);
  process.exit(bad ? 1 : 0);
})();

/* The dials' two functions, checked in a browser (globedial.js; land.js, "the city's dial on the categories";
   skyline.js, "the category the city shows"). The artist, 15 Oct 2026: "In the globe view rotating the dial
   should rotate you through the different categories and in the city views the rotation of the dial should
   change the time … switching between the categories function and the time function. Add Character as a
   category filter and Philosophers category as well."
     The world, 390x844 (touch) and 1440x900: its ring shown round the front globe, six categories on it, the
       pills given way; a tap on a name and a drag along the ring choose the layer; the crown turns it to time,
       a year holds marks back, and back; the Characters and Philosophers layers drawn as figures, no name over
       another name, a figure or the ring's words; the ring gone while the world is brought nearer.
     A city (Paris): opened on its time, its crown beside its animal; turned to the categories, six names round
       it; Philosophers tapped, the philosophers born there walk it named and a press opens a card; the arrows
       turn the categories; Characters, no one walks; T back to time.
     cd docs && python3 -m http.server 8871 &
     NODE_PATH=$(npm root -g) node scripts/check_globedial.js [port] [shots dir]
   Exits 1 on any failure. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const PORT = process.argv[2] || "8871";
const OUT = process.argv[3] || require("os").tmpdir();
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8a6"/></svg>';
const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}

async function open(browser, w, h, touch, layer, seen) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  await ctx.addInitScript((a) => {
    try { localStorage.setItem("globe-layer", a[0]); localStorage.setItem("dial.seen", JSON.stringify(a[1] || [])); } catch (e) {}
  }, [layer, seen]);
  const P = await ctx.newPage();
  P.setDefaultTimeout(90000);              // a skyline's frame can take seconds in software GL
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await P.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe" && window.Land && Land.globeAt && window.GlobeDial,
                          null, { timeout: 90000 });
  await P.waitForTimeout(5000);
  await P.evaluate(() => Land.pace(false));
  return { ctx, P, errors };
}
const press = (P, touch, x, y) => touch ? P.touchscreen.tap(x, y) : P.mouse.click(x, y);
// Where a category's name stands on the world's ring.
const labelAt = (s, key) => {
  const k = s.keys.indexOf(key), o = s.labels.find((l) => l.k === k);
  if (!o) { return null; }
  const r = s.ring.r + (Math.sin(o.th) > 0 ? 13 : 11);
  return { x: s.ring.cx + Math.cos(o.th) * r, y: s.ring.cy + Math.sin(o.th) * r };
};
const dialState = (P) => P.evaluate(() => Object.assign(GlobeDial.state(), { keys: Land.layers().map((l) => l.key), layer: Land.layer() }));
// What is named on the world, and whether any of it meets: a name another name, a figure, the ring's words.
const clashes = (P) => P.evaluate(() => {
  const vis = [...document.querySelectorAll(".city")].filter((e) => e.style.visibility !== "hidden" && e.dataset.named === "true");
  const R = (r) => ({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
  const meets = (a, b) => a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
  const items = vis.map((e) => {
    const n = e.querySelector(".city-name"), f = e.querySelector(".city-figure");
    return { t: n.textContent, name: R(n.getBoundingClientRect()), fig: f ? R(f.getBoundingClientRect()) : null };
  });
  const out = [], ring = GlobeDial.boxes();
  items.forEach((a, i) => {
    items.forEach((b, j) => {
      if (i === j) { return; }
      if (i < j && meets(a.name, b.name)) { out.push("name/name " + a.t + " · " + b.t); }
      if (b.fig && meets(a.name, b.fig)) { out.push("name/figure " + a.t + " over " + b.t); }
      if (i < j && a.fig && b.fig && meets(a.fig, b.fig)) { out.push("figure/figure " + a.t + " · " + b.t); }
    });
    if (ring.some((r) => meets(a.name, r))) { out.push("name/ring " + a.t); }
  });
  return { named: items.length, figures: items.filter((i) => i.fig).length, out };
});

async function world(browser, w, h, touch) {
  const tag = w + "x" + h;
  const { ctx, P, errors } = await open(browser, w, h, touch, "museums");
  await P.evaluate(() => Land.globeAt(46, 10, 1.6));
  await P.waitForTimeout(2500);
  let s = await dialState(P);
  check(tag, s.alpha > 0.9 && s.fn === "categories", "the world's ring is on, on the categories", { alpha: s.alpha, fn: s.fn });
  check(tag, s.labels.length === 6 && s.keys.indexOf("characters") >= 0 && s.keys.indexOf("philosophers") >= 0,
        "six categories, Characters and Philosophers among them", s.keys);
  const pills = await P.evaluate(() => { const f = document.getElementById("filter"); return !!f && f.offsetParent !== null && getComputedStyle(f).visibility !== "hidden"; });
  check(tag, !pills, "the pills give way to the ring on the front globe");
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-world.png`) });

  // A tap on a name chooses it.
  let at = labelAt(s, "philosophers");
  await press(P, touch, at.x, at.y);
  await P.waitForTimeout(1500);
  s = await dialState(P);
  check(tag, s.layer === "philosophers" && s.front === "philosophers", "a tap on Philosophers chooses it", { layer: s.layer, front: s.front });
  await P.waitForFunction(() => document.querySelectorAll(".city[data-kind=philosopher] .city-figure").length > 2, null, { timeout: 20000 }).catch(() => {});
  await P.waitForTimeout(1500);
  let c = await clashes(P);
  check(tag, c.named >= 5 && c.figures === c.named, "philosophers named, each a figure", { named: c.named, figures: c.figures });
  check(tag, c.out.length === 0, "no name over a name, a figure or the ring's words", c.out.slice(0, 6));
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-philosophers.png`) });

  // A drag along the ring turns it on (here: back toward the front's neighbours).
  s = await dialState(P);
  const G = s.ring, pts = [];
  for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + i * 0.11; pts.push([G.cx + Math.cos(a) * G.r, G.cy + Math.sin(a) * G.r]); }
  if (touch) {
    const cdp = await ctx.newCDPSession(P);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0][0], y: pts[0][1], id: 1 }] });
    for (const p of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p[0], y: p[1], id: 1 }] }); await P.waitForTimeout(30); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await P.mouse.move(pts[0][0], pts[0][1]);
    await P.mouse.down();
    for (const p of pts.slice(1)) { await P.mouse.move(p[0], p[1]); await P.waitForTimeout(30); }
    await P.mouse.up();
  }
  await P.waitForTimeout(1200);
  const was = s.layer;
  s = await dialState(P);
  check(tag, s.layer !== was && s.front === s.layer, "a drag along the ring turns to another", { from: was, to: s.layer });

  // Characters: animals as figures, as calm.
  at = labelAt(s, "characters");
  await press(P, touch, at.x, at.y);
  await P.waitForTimeout(1500);
  await P.waitForFunction(() => document.querySelectorAll(".city[data-kind=character] .city-figure").length > 2, null, { timeout: 20000 }).catch(() => {});
  await P.waitForTimeout(1500);
  c = await clashes(P);
  check(tag, (await P.evaluate(() => Land.layer())) === "characters" && c.named >= 5 && c.figures === c.named, "Characters: the animals named, each a figure", { named: c.named, figures: c.figures });
  check(tag, c.out.length === 0, "Characters: nothing written over anything", c.out.slice(0, 6));
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-characters.png`) });

  // The crown: time, a year, and back.
  await P.evaluate(() => GlobeDial.turnTo("studios"));
  await P.waitForTimeout(1500);
  const before = (await P.evaluate(() => Land.names().named.length));
  const crown = await P.$(".globe-dial-crown");
  if (touch) { await crown.tap(); } else { await crown.click(); }
  await P.waitForTimeout(800);
  s = await dialState(P);
  check(tag, s.fn === "time" && !!s.span, "the crown turns the ring to time", { fn: s.fn, span: s.span });
  const y = await P.evaluate(() => GlobeDial.year(1900));
  await P.waitForTimeout(1800);
  check(tag, Math.abs(y - 1900) < 2, "the year on the ring is the world's", y);
  const then = await P.evaluate(() => Land.names().named.map((n) => n.title));
  check(tag, then.length > 0, "the Artists living in 1900 named", then.slice(0, 8));
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-1900.png`) });
  if (touch) { await crown.tap(); } else { await crown.click(); }
  await P.waitForTimeout(800);
  s = await dialState(P);
  check(tag, s.fn === "categories" && (await P.evaluate(() => Land.globeYear())) === null, "the crown again: the categories, nothing held back", s.fn);
  void before;

  // Brought nearer: only the cities, and the ring gone.
  await P.mouse.move(w / 2, h / 2);
  for (let i = 0; i < 6; i++) { await P.mouse.wheel(0, -120); await P.waitForTimeout(60); }
  await P.waitForTimeout(300);
  const zoom = await P.evaluate(() => ({ cities: Land.names().cities, alpha: GlobeDial.state().alpha, ring: Land.globeRing().on }));
  check(tag, zoom.cities && !zoom.ring, "brought nearer: the cities only, the ring off", zoom);
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await ctx.close();
}

async function city(browser, w, h, touch) {
  const tag = w + "x" + h + " Paris";
  const { ctx, P, errors } = await open(browser, w, h, touch, "museums", ["t:paris-fr"]);
  await P.evaluate(() => Land.town("paris-fr"));
  await P.waitForFunction(() => Skyline.on() && Skyline.state().key === "paris-fr" && Skyline.state().count > 0, null, { timeout: 180000 });
  await P.waitForFunction(() => !Land.where().flying && Land.dialGround.on(), null, { timeout: 60000 }).catch(() => {});
  await P.waitForTimeout(3000);
  check(tag, (await P.evaluate(() => Land.dialGround.fn())) === "time", "a city opens on its time");
  const crown = await P.$(".dial-crown");
  check(tag, !!crown && await crown.isVisible(), "its crown beside its animal");
  if (touch) { await crown.tap(); } else { await crown.click(); }
  await P.waitForTimeout(900);
  let c = await P.evaluate(() => Land.dialGround.cats());
  check(tag, c.fn === "categories" && c.boxes.length === 6, "the crown: the six categories round the city", { fn: c.fn, n: c.boxes.length });
  check(tag, c.counts.philosophers === 9 && c.counts.museums > 0, "what Paris holds of each", c.counts);
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-categories.png`) });
  const pb = c.boxes.find((b) => b.key === "philosophers");
  await press(P, touch, (pb.x0 + pb.x1) / 2, (pb.y0 + pb.y1) / 2);
  await P.waitForTimeout(1200);
  c = await P.evaluate(() => Land.dialGround.cats());
  check(tag, c.layer === "philosophers" && c.front === "philosophers", "Philosophers tapped: the world's category", { layer: c.layer, front: c.front });
  await P.waitForFunction(() => Skyline.state().walkers.some((x) => x.phil && !x.leaving), null, { timeout: 20000 }).catch(() => {});
  await P.waitForTimeout(2500);
  let s = await P.evaluate(() => Skyline.state());
  const phil = s.walkers.filter((x) => x.phil && !x.leaving), art = s.walkers.filter((x) => !x.phil && !x.leaving);
  check(tag, s.category === "philosophers" && phil.length > 0 && art.length === 0, "the philosophers born here walk it, no one else",
        phil.map((x) => x.name));
  check(tag, /9 philosophers born here/.test(s.note), "the note says what it holds", s.note);
  const quiet = s.marks.filter((m) => m.named).length;
  check(tag, quiet === 0, "the museums' names give way", quiet);
  await P.screenshot({ path: path.join(OUT, `globedial-${tag}-philosophers.png`) });
  const btn = await P.$(".skyline-phil:not([hidden])");
  if (btn) {
    for (let i = 0; i < 2 && !(await P.$(".phil-card")); i++) {
      const bb = await btn.boundingBox();
      if (bb) { await press(P, touch, bb.x + bb.width / 2, bb.y + bb.height / 2); }
      await P.waitForTimeout(700);
    }
    check(tag, !!(await P.$(".phil-card")), "a philosopher pressed: their card");
    if (await P.$(".phil-card")) { await P.keyboard.press("Escape"); await P.waitForTimeout(400); }
  } else { check(tag, false, "a philosopher to press"); }
  await P.focus("#art-time-range");
  await P.keyboard.press("ArrowLeft");
  await P.waitForTimeout(700);
  c = await P.evaluate(() => Land.dialGround.cats());
  check(tag, c.front === "characters" && c.layer === "characters", "the arrows turn the categories", c.front);
  await P.waitForTimeout(1500);
  s = await P.evaluate(() => Skyline.state());
  check(tag, s.walkers.filter((x) => !x.leaving).length === 0, "Characters: no one walks, its animal is the dial's hand", s.note);
  await P.keyboard.press("t");
  await P.waitForTimeout(600);
  check(tag, (await P.evaluate(() => Land.dialGround.fn())) === "time", "T: back to time");
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  try {
    await world(browser, 390, 844, true);
    await world(browser, 1440, 900, false);
    await city(browser, 390, 844, true);
    await city(browser, 1440, 900, false);
  } finally { await browser.close(); }
  console.log(fails.length ? fails.length + " failed:\n  " + fails.join("\n  ") : "all ok");
  process.exit(fails.length ? 1 : 0);
})();

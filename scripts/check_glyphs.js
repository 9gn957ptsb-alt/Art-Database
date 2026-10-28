/* Glyph Light on the Artist Website, checked in a browser (docs/v2/glyphlight.js, docs/v2/glyphs.js). The artist,
   27 Oct 2026: "Implement this as the aesthetic for the artist website … The content should remain the same for each,
   what changes is how the aesthetic texture of what is being displayed is achieved."
     At 390x844 (touch, 3x) and 1440x900 (1x):
     The world: one glyph overlay in the stage, shown, as large as the stage at the screen's density, drawn (lit
       glyphs on the globe, the stage's dark round it), taking no press (what is under the globe's middle is not it),
       under the telescope's photographs and every word; the animals' canvas lifted over it.
     A city with a skyline (Paris): the world's overlay steps away and the skyline's is shown and drawn, under its
       light and its names.
     A museum (the National Gallery of Art): the building's overlay shown and drawn under its ring.
     A life (Picasso): the world's overlay drawn in the lens.
     Every overlay in Glyph Light's ASCII style and no other (artist, 28 Oct 2026).
     No page errors anywhere.
     cd docs && python3 -m http.server 8811 &
     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_glyphs.js [port] [shots dir]
   Exits 1 on any failure. */
const { chromium } = require("playwright");
const path = require("path");
const PORT = process.argv[2] || "8811";
const OUT = process.argv[3] || require("os").tmpdir();
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8a6"/></svg>';
const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) fails.push(tag + " · " + what);
}

// What each overlay is doing: its box, its backing, whether it shows, and how much of it is lit (read back by drawing it
// into a 2D canvas in the same task as a fresh frame of its own).
const state = (P) => P.evaluate(() => (window.Glyphs ? Glyphs.overlays() : []).map((g) => {
  g.frame();
  const c = g.canvas, r = c.getBoundingClientRect(), shown = getComputedStyle(c).display !== "none";
  let lit = 0, dark = 0;
  if (shown && c.width && c.height) {
    const t = document.createElement("canvas"); t.width = 96; t.height = 96;
    const x = t.getContext("2d"); x.drawImage(c, 0, 0, 96, 96);
    const d = x.getImageData(0, 0, 96, 96).data;
    for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l > 150) lit++; else if (d[i + 3] > 200) dark++; }
  }
  return { cls: c.className, parent: c.parentNode && String(c.parentNode.className).split(" ")[0], style: g.options.style, shown, w: c.width, h: c.height, cw: Math.round(r.width), ch: Math.round(r.height), lit, dark };
}));

async function run(browser, w, h, touch, dpr) {
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: dpr });
  await ctx.addInitScript(() => { try { localStorage.setItem("dial.seen", JSON.stringify(["t:paris-fr", "l:pablo-picasso"])); } catch (e) {} });
  const P = await ctx.newPage();
  P.setDefaultTimeout(120000);
  const errors = [], styles = new Set();
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org|artsy\.net/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe" && window.Land && window.Glyphs);
  await P.waitForTimeout(6000);
  await P.evaluate(() => Land.pace && Land.pace(false));

  // the world
  let s = await state(P);
  s.forEach((o) => styles.add(o.style));
  const world = s.find((o) => o.parent === "stage");
  check(tag, !!world && world.shown, "the world's overlay is in the stage and shown", world);
  const sr = await P.evaluate(() => { const r = document.getElementById("stage").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  check(tag, world && world.cw === sr[0] && world.ch === sr[1], "it covers the stage", [world && world.cw, world && world.ch, sr]);
  check(tag, world && Math.abs(world.w - sr[0] * dpr) <= 2, "at the screen's density", [world && world.w, sr[0] * dpr]);
  check(tag, world && world.lit > 20 && world.dark > 2000, "drawn: lit glyphs on the stage's dark", world && [world.lit, world.dark]);
  const hit = await P.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight * 0.45); return e && (e.className || e.tagName) + ""; });
  check(tag, !/glyphlight/.test(hit), "a press on the globe goes to what is under the glyphs", hit);
  const order = await P.evaluate(() => {
    const st = document.getElementById("stage"), kids = [...st.children], g = st.querySelector("canvas.glyphlight");
    const ch = st.querySelector("canvas.characters");
    return { beforeTrail: kids.indexOf(g) === kids.indexOf(document.getElementById("trail")) - 1, animals: ch ? getComputedStyle(ch).zIndex : "none" };
  });
  check(tag, order.beforeTrail, "it lies just under the telescope's photographs", order);
  check(tag, order.animals === "1" || order.animals === "none", "the animals' canvas is lifted over it", order.animals);
  await P.screenshot({ path: path.join(OUT, `glyphs-world-${tag}.png`) });

  // a city with a skyline
  await P.evaluate(() => Land.town("paris-fr"));
  await P.waitForFunction(() => document.documentElement.hasAttribute("data-skyline") && document.querySelector(".skyline-clod"), null, { timeout: 120000 });
  await P.waitForTimeout(15000);
  s = await state(P);
  s.forEach((o) => styles.add(o.style));
  const sky = s.find((o) => o.parent === "skyline"), w2 = s.find((o) => o.parent === "stage");
  check(tag, sky && sky.shown && sky.lit > 20, "the skyline's overlay is shown and drawn", sky);
  check(tag, w2 && !w2.shown, "the world's steps away while the skyline is up", w2 && w2.shown);
  const skyOrder = await P.evaluate(() => {
    const sk = document.querySelector(".skyline"), k = [...sk.children].map((c) => c.className.split(" ")[0]);
    return k;
  });
  check(tag, skyOrder.indexOf("glyphlight") === skyOrder.indexOf("skyline-clod") + 1 && skyOrder.indexOf("skyline-light") > skyOrder.indexOf("glyphlight"),
    "under the skyline's light and its dial's front half", skyOrder);
  await P.screenshot({ path: path.join(OUT, `glyphs-paris-${tag}.png`) });

  // a museum
  await P.evaluate(() => Land.museum("museum-national-gallery-of-art-washington-dc"));
  await P.waitForFunction(() => document.querySelector("#building-map .building-clod"), null, { timeout: 120000 });
  await P.waitForTimeout(12000);
  s = await state(P);
  s.forEach((o) => styles.add(o.style));
  const bld = s.find((o) => o.parent === "building-map");
  check(tag, bld && bld.shown && bld.lit > 10, "the building's overlay is shown and drawn", bld);
  await P.screenshot({ path: path.join(OUT, `glyphs-nga-${tag}.png`) });

  // a life, read in the lens
  await P.evaluate(() => Lives.open("pablo-picasso"));
  await P.waitForTimeout(14000);
  s = await state(P);
  s.forEach((o) => styles.add(o.style));
  const w3 = s.find((o) => o.parent === "stage");
  const lens = await P.evaluate(() => document.getElementById("stage").dataset.lens || "");
  check(tag, w3 && w3.shown && w3.lit > 2, "a life: the world's overlay drawn", { lens, w3 });
  await P.screenshot({ path: path.join(OUT, `glyphs-life-${tag}.png`) });

  check(tag, styles.size === 1 && styles.has("ascii"), "every overlay in the ASCII style alone", [...styles]);
  check(tag, errors.length === 0, "no page errors", errors.slice(0, 5));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  try {
    await run(browser, 390, 844, true, 3);
    await run(browser, 1440, 900, false, 1);
  } catch (e) { fails.push("crashed: " + e.message); console.log("  FAIL crashed · " + e.message); }
  await browser.close();
  console.log(fails.length ? `${fails.length} failed` : "all ok");
  process.exit(fails.length ? 1 : 0);
})();

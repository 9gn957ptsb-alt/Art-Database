/* A filmed bit drawn again as a character, checked in a browser (bits.js; land.js, the Characters layer's
   marks; skyline.js, "a filmed bit"). The artist, 14 Oct 2026: "Recreate a gif like animation of this YouTube
   short. Create Ed Bassmaster's character and have it link to his YouTube".
     390x844 (touch) and 1440x900:
       Find finds it ("Bassmaster"), under Characters; chosen, its card: the loop drawn and playing (its frames
         change), a press on its button pauses it (they stop) and plays it again; the short and the channel on
         YouTube, each in a new tab with noopener and said so; the card wholly on the screen; its three ways on
         (London, the works painted near it, the museums near it), a tab opening its rows; Escape closes it.
       The globe's Characters layer: its mark at Horse Guards, its figure the dot once named.
       London's skyline on its Characters: the pair standing at Horse Guards, on the screen, named or nameable;
         pressed (on a touch screen, twice), its card.
     390x844 under reduced motion: the card opens with the loop paused.
     cd docs && python3 -m http.server 8873 &
     NODE_PATH=$(npm root -g) node scripts/check_bits.js [port] [shots dir]
   Exits 1 on any failure. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const PORT = process.argv[2] || "8873";
const OUT = process.argv[3] || require("os").tmpdir();
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#8a6"/></svg>';
const fails = [];
function check(tag, ok, what, got) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (got !== undefined ? " · " + JSON.stringify(got) : ""));
  if (!ok) { fails.push(tag + " · " + what); }
}

async function open(browser, w, h, touch, layer, reduced) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1,
                                         reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.addInitScript((l) => { try { localStorage.setItem("globe-layer", l); } catch (e) {} }, layer);
  const P = await ctx.newPage();
  P.setDefaultTimeout(90000);
  const errors = [];
  P.on("pageerror", (e) => errors.push(e.message));
  await P.route(/d32dm0rphc51dk\.cloudfront\.net|nasa\.gov|wikimedia\.org/, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: PIC }));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await P.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
  await P.waitForFunction(() => document.getElementById("land").dataset.at === "globe" && window.Land && Land.globeAt && window.Bits,
                          null, { timeout: 90000 });
  await P.waitForTimeout(4000);
  await P.evaluate(() => Land.pace(false));
  return { ctx, P, errors };
}
const press = (P, touch, x, y) => touch ? P.touchscreen.tap(x, y) : P.mouse.click(x, y);
// A digest of the loop's canvas, to see whether its frames change.
const loopSum = (P) => P.evaluate(() => {
  const c = document.querySelector(".bit-card .bit-loop");
  if (!c || !c.width) { return null; }
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 97) { s = (s * 31 + d[i]) % 1000000007; }
  return s;
});

async function card(P, tag, touch, shots) {
  // Find: "Bassmaster"
  const sb = await P.evaluate(() => {
    const b = document.getElementById("art-find");
    if (!b || !b.offsetWidth) { return null; }
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  check(tag, !!sb, "Search is there", sb);
  if (!sb) { return; }
  await press(P, touch, sb.x, sb.y);
  await P.waitForTimeout(500);
  const ff = await P.evaluate(() => { const f = document.getElementById("finder-field"); if (!f || !f.offsetWidth) { return null; } const r = f.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  check(tag, !!ff, "its field is there", ff);
  if (!ff) { return; }
  await press(P, touch, ff.x, ff.y);
  await P.waitForTimeout(200);
  await P.keyboard.type("Bassmaster", { delay: 30 });
  await P.waitForFunction(() => document.querySelector(".bit-found .finder-row"), null, { timeout: 8000 }).catch(() => {});
  await P.waitForTimeout(1800);          // the other groups arrive and the list settles
  const row = await P.evaluate(() => {
    const box = document.querySelector(".bit-found");
    if (!box) { return null; }
    const r = box.querySelector(".finder-row"), rr = r.getBoundingClientRect();
    return { group: box.querySelector(".finder-group").textContent, text: r.textContent, x: rr.x + rr.width / 2, y: rr.y + rr.height / 2, h: rr.height };
  });
  // (kinds.js puts the category's glyph before its heading: "∴Characters")
  check(tag, !!row && /^∴?\s*Characters$/.test(row.group) && /Royal Nothin/.test(row.text), "Find finds it under Characters", row);
  if (!row) { return; }
  await P.evaluate(() => document.querySelector(".bit-found .finder-row").scrollIntoView({ block: "center" }));
  const rr = await P.evaluate(() => { const r = document.querySelector(".bit-found .finder-row").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await press(P, touch, rr.x, rr.y);
  await P.waitForFunction(() => document.querySelector(".bit-card[data-loaded]"), null, { timeout: 15000 }).catch(() => {});
  const c = await P.evaluate(() => {
    const k = document.querySelector(".bit-card");
    if (!k) { return null; }
    const r = k.getBoundingClientRect(), cv = k.querySelector(".bit-loop").getBoundingClientRect();
    const links = [...k.querySelectorAll("a.bit-link")].map((a) => ({ href: a.href, target: a.target, rel: a.rel, label: a.getAttribute("aria-label") }));
    return { on: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, w: r.width, h: r.height,
             loop: { w: cv.width, h: cv.height }, links, tabs: [...k.querySelectorAll(".bit-tab, .bit-go")].map((b) => b.textContent),
             play: k.querySelector(".bit-play").getAttribute("aria-label"), focus: document.activeElement && document.activeElement.className };
  });
  check(tag, !!c && c.on, "the card wholly on the screen", c && { w: c.w, h: c.h });
  if (!c) { return; }
  check(tag, c.loop.w >= 160 && c.loop.h >= 280, "the loop large", c.loop);
  check(tag, c.links.length === 2 && c.links[0].href === "https://www.youtube.com/shorts/nDsF0a6rVmo" &&
        c.links[1].href === "https://www.youtube.com/@edbassmaster" && c.links.every((l) => l.target === "_blank" && /noopener/.test(l.rel) && /new tab/.test(l.label)),
        "the short and the channel, each in a new tab, said so", c.links);
  check(tag, c.tabs.some((t) => /Painted near it · \d+/.test(t)) && c.tabs.some((t) => /Museums near it · \d+/.test(t)) && c.tabs.some((t) => /London/.test(t)),
        "its three ways on", c.tabs);
  check(tag, c.play === "Pause the loop" && /bit-close/.test(c.focus || ""), "playing, the focus on its close", { play: c.play, focus: c.focus });
  const s0 = await loopSum(P);
  await P.waitForTimeout(700);
  const s1 = await loopSum(P);
  check(tag, s0 !== null && s0 !== s1, "its frames change", [s0, s1]);
  if (shots) { await P.screenshot({ path: path.join(OUT, "bits-card-" + tag + ".png") }); }
  const pb = await P.evaluate(() => { const r = document.querySelector(".bit-play").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
  await press(P, touch, pb.x, pb.y);
  await P.waitForTimeout(300);
  const p0 = await loopSum(P);
  await P.waitForTimeout(700);
  const p1 = await loopSum(P);
  const lab = await P.evaluate(() => document.querySelector(".bit-play").getAttribute("aria-label"));
  check(tag, p0 === p1 && lab === "Play the loop" && pb.w >= 24, "its button pauses it", { p0, p1, lab, w: pb.w });
  await press(P, touch, pb.x, pb.y);
  await P.waitForTimeout(700);
  const p2 = await loopSum(P);
  check(tag, p2 !== p1, "and plays it again", [p1, p2]);
  // a tab: the works painted near it
  const tb = await P.evaluate(() => { const t = [...document.querySelectorAll(".bit-tab")].find((b) => /Painted/.test(b.textContent)); t.scrollIntoView({ block: "nearest" }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await press(P, touch, tb.x, tb.y);
  await P.waitForTimeout(300);
  const rows = await P.evaluate(() => [...document.querySelectorAll(".bit-list .bit-row")].slice(0, 3).map((r) => r.textContent));
  check(tag, rows.length > 0 && rows.some((t) => /Monet|Sisley|Turner|Pissarro/.test(t)), "a tab opens its rows", rows);
  await P.keyboard.press("Escape");
  await P.waitForTimeout(300);
  check(tag, await P.evaluate(() => !document.querySelector(".bit-card")), "Escape closes it");
}

async function globeMark(P, tag, shots) {
  await P.evaluate(() => { if (Land.chooseLayer) { Land.chooseLayer("characters"); } Land.globeAt(51.505, -0.127); });
  await P.waitForTimeout(4000);
  const m = await P.evaluate(() => {
    const e = [...document.querySelectorAll(".city[data-layer='characters']")].find((x) => /Royal Nothin/.test(x.textContent));
    if (!e) { return null; }
    const f = e.querySelector(".city-figure");
    return { kind: e.dataset.kind, named: e.dataset.named === "true", shown: e.style.visibility !== "hidden", fig: f ? [f.width, f.height] : null };
  });
  check(tag, !!m && m.kind === "character", "its mark on the Characters layer", m);
  if (m && m.named) { check(tag, !!m.fig, "its figure the dot, named", m); }
  else { console.log("  info " + tag + " · the mark is not named at this distance (the calm rules): " + JSON.stringify(m)); }
  if (shots) { await P.screenshot({ path: path.join(OUT, "bits-globe-" + tag + ".png") }); }
}

async function london(P, tag, touch, shots) {
  await P.evaluate(() => { if (Land.chooseLayer) { Land.chooseLayer("characters"); } Land.town("london-gb"); });
  await P.waitForFunction(() => window.Skyline && Skyline.on() && Skyline.state().key === "london-gb" && Skyline.state().count > 0, null, { timeout: 240000 });
  await P.waitForFunction(() => (Skyline.state().bits || []).some((b) => !b.hidden && b.w > 24), null, { timeout: 120000 }).catch(() => {});
  const s = await P.evaluate(() => ({ bits: Skyline.state().bits, note: (document.querySelector(".skyline-note") || {}).textContent || "", W: innerWidth, H: innerHeight }));
  const b = (s.bits || [])[0];
  check(tag, !!b && !b.hidden && b.x >= 0 && b.y >= 0 && b.x + b.w <= s.W && b.y + b.h <= s.H, "the pair standing at Horse Guards on London's skyline", b);
  check(tag, /Royal Nothin at Horse Guards/.test(s.note), "the note says it is here", s.note);
  if (shots) { await P.screenshot({ path: path.join(OUT, "bits-london-" + tag + ".png") }); }
  if (!b || b.hidden) { return; }
  // Pressed as a person would, once it holds still: the skyline swings a quarter turn every φ⁷ s, and in
  // software GL a frame takes seconds, so a point read a moment before can be where the pair was.
  const pair = P.locator(".skyline-bit");
  if (touch) { await pair.tap(); await P.waitForTimeout(300); await pair.tap(); } else { await pair.click(); }
  await P.waitForFunction(() => document.querySelector(".bit-card"), null, { timeout: 8000 }).catch(() => {});
  check(tag, await P.evaluate(() => !!document.querySelector(".bit-card")), "pressed, its card");
  if (shots) { await P.waitForTimeout(1500); await P.screenshot({ path: path.join(OUT, "bits-london-card-" + tag + ".png") }); }
  await P.keyboard.press("Escape");
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [w, h, touch] of [[390, 844, true], [1440, 900, false]]) {
    const tag = w + "x" + h;
    const { ctx, P, errors } = await open(browser, w, h, touch, "characters");
    await card(P, tag, touch, true);
    await globeMark(P, tag, true);
    if (!process.env.NO_CITY) { await london(P, tag, touch, true); }
    check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
    await ctx.close();
  }
  {
    const tag = "390x844 reduced";
    const { ctx, P, errors } = await open(browser, 390, 844, true, "characters", true);
    await P.evaluate(() => Bits.open("royal-nothin"));
    await P.waitForFunction(() => document.querySelector(".bit-card[data-loaded]"), null, { timeout: 15000 }).catch(() => {});
    const a = await loopSum(P);
    await P.waitForTimeout(700);
    const b = await loopSum(P);
    const lab = await P.evaluate(() => (document.querySelector(".bit-play") || {}).getAttribute && document.querySelector(".bit-play").getAttribute("aria-label"));
    check(tag, a !== null && a === b && lab === "Play the loop", "under reduced motion it opens paused", { a, b, lab });
    check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
    await ctx.close();
  }
  await browser.close();
  console.log(fails.length ? "\n" + fails.length + " FAILED\n" + fails.join("\n") : "\nall ok");
  process.exit(fails.length ? 1 : 0);
})();

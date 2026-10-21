// What the checks of the far views share (check_kaleidoscope.js --scope, check_remains.js): the page's clock
// wrapped so it can be stopped and stepped a held frame at a time, a window to open, and NASA's real answer to
// a Hubble search with its first thumbnails, fetched once with curl (headless Chromium does not go through the
// session's proxy) and served to the page with the CORS header NASA sends, everything else off the site aborted.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// The page's clock, wrapped before it loads: slowed by __setSlow(k) (1 is real time), or stopped with
// __setSlow(0) and moved on by __advance(ms), a held frame at a time.
function clockScript() {
  const realNow = performance.now.bind(performance);
  let base = 0, realBase = 0, f = 1;
  const virt = () => base + (realNow() - realBase) * f;
  window.__setSlow = k => { base = virt(); realBase = realNow(); f = k; };
  window.__advance = ms => { base += ms; };
  performance.now = virt;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(virt()));
}

async function openWindow(browser, w, h, touch, dsf, extra) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: dsf }, extra || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(clockScript);
  return { ctx, page, errors };
}

// NASA's real answer to a Hubble search and its first thumbnails, fetched with curl, for the page to be served.
function nasaStandIns(out, query) {
  const jsonFile = path.join(out, "nasa.json");
  execFileSync("curl", ["-sS", "--max-time", "60", "-o", jsonFile, "https://images-api.nasa.gov/search?media_type=image&q=" + encodeURIComponent(query || "hubble galaxy")]);
  const d = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  const items = [], images = {};
  for (const it of d.collection.items) {
    if (items.length >= 14) { break; }
    const link = (it.links || []).find(l => l.render === "image" || /thumb|small|medium/i.test(l.href || ""));
    if (!link) { continue; }
    const file = path.join(out, "nasa-" + items.length + ".jpg");
    try { execFileSync("curl", ["-sS", "--max-time", "60", "-o", file, link.href]); } catch (e) { continue; }
    if (fs.statSync(file).size < 2000) { continue; }
    images[link.href.replace(/^http:/, "https:")] = fs.readFileSync(file);
    items.push(it);
  }
  d.collection.items = items;
  return { body: JSON.stringify(d), images };
}

// The page served NASA's answers (with NASA's own CORS header), and nothing else off the site.
async function routeNasa(page, stand) {
  const cors = { "access-control-allow-origin": "*" };
  await page.route(/images-api\.nasa\.gov\/search/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: stand.body }));
  await page.route(/images-assets\.nasa\.gov\//, r => {
    const b = stand.images[r.request().url()];
    if (b) { r.fulfill({ status: 200, contentType: "image/jpeg", headers: cors, body: b }); } else { r.abort(); }
  });
  await page.route(/metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)|cloudfront/, r => r.abort());
}

// Points in the sky where the largest photograph (128 x 180 CSS px) lies wholly on the black, as land.js's onTheBlack
// asks: on the window, clear of the world and its air, of the words at the world's foot and of the globe's dial;
// [x, y, distance from the world's middle], nearest the world first.
async function skySpots(page, w, h) {
  return page.evaluate(([w, h]) => {
    const d = Land.density();
    const words = ["#art-find", ".guide-world", "#filter", "#banner"].map(s => document.querySelector(s))
      .filter(el => el && !el.hidden).map(el => el.getBoundingClientRect()).filter(b => b.width && b.height)
      .map(b => [b.left - 6, b.top - 6, b.right + 6, b.bottom + 6])
      .concat((window.GlobeDial && GlobeDial.boxes ? GlobeDial.boxes() : []).map(b => [b.x0 - 6, b.y0 - 6, b.x1 + 6, b.y1 + 6]));
    const bw = 128, bh = 180, out = [];
    for (let y = 0; y < h; y += 12) {
      for (let x = 0; x < w; x += 12) {
        if (x - bw / 2 < 6 || x + bw / 2 > w - 6 || y - bh / 2 < 6 || y + bh / 2 > h - 6) { continue; }
        const nx = Math.max(x - bw / 2, Math.min(d.cx, x + bw / 2)), ny = Math.max(y - bh / 2, Math.min(d.cy, y + bh / 2));
        if (Math.hypot(nx - d.cx, ny - d.cy) < d.R * 1.1 + 2) { continue; }
        if (words.some(b => x + bw / 2 > b[0] && x - bw / 2 < b[2] && y + bh / 2 > b[1] && y - bh / 2 < b[3])) { continue; }
        out.push([x, y, Math.hypot(x - d.cx, y - d.cy)]);
      }
    }
    return out.sort((a, b) => a[2] - b[2]);
  }, [w, h]);
}

module.exports = { clockScript, openWindow, nasaStandIns, routeNasa, skySpots };

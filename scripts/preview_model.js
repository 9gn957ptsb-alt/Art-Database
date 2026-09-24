#!/usr/bin/env node
/* Render a building model (docs/v2/models/<slug>.json) the way the site
   draws it, from four sides, into one PNG — to check it against the
   photographs it was made from.

     node scripts/preview_model.js docs/v2/models/<slug>.json out.png

   Uses the site's own docs/v2/models.js and the DIRT at the building's place
   (docs/v2/dirt-land.png, located from docs/v2/architecture.json). Needs
   Playwright; in a session it is installed globally. */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function playwright() {
  try { return require("playwright"); } catch (e) {
    const root = execSync("npm root -g").toString().trim();
    return require(path.join(root, "playwright"));
  }
}

(async () => {
  const [specPath, out] = process.argv.slice(2);
  if (!specPath || !out) {
    console.error("usage: node scripts/preview_model.js <model.json> <out.png>");
    process.exit(2);
  }
  const root = path.resolve(__dirname, "..");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const where = JSON.parse(fs.readFileSync(path.join(root, "docs/v2/architecture.json"), "utf8"))
    .buildings.find(b => b.slug === spec.slug) || { lat: 0, lon: 0 };
  const models = fs.readFileSync(path.join(root, "docs/v2/models.js"), "utf8");
  const dirt = "data:image/png;base64," +
    fs.readFileSync(path.join(root, "docs/v2/dirt-land.png")).toString("base64");

  const browser = await playwright().chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("pageerror", e => { console.error("page error:", e.message); });
  await page.setContent(`<!doctype html><body style="margin:0;background:#eeecec">
    <canvas id="c" width="1200" height="900" style="image-rendering:pixelated"></canvas>
    <script>${models}</script></body>`);
  const info = await page.evaluate(async ({ spec, dirt, where }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = dirt; });
    const t = document.createElement("canvas");
    t.width = img.width; t.height = img.height;
    const tx = t.getContext("2d"); tx.drawImage(img, 0, 0);
    const px = tx.getImageData(0, 0, t.width, t.height).data, n = t.width;
    const cell = (n_, a) => ((Math.floor(a) % n_) + n_) % n_;
    const u0 = Math.floor((where.lon / 360 + 0.5) * 2 * n);
    const v0 = Math.floor((0.5 - where.lat / 180) * n);
    const soil = (i, j) => {
      const o = (cell(n, v0 + j) * n + cell(n, u0 + i)) * 4;
      return [px[o], px[o + 1], px[o + 2], Math.round(px[o + 3] / 85)];
    };
    const t0 = performance.now();
    const dots = Models.build(spec, soil);
    const built = performance.now() - t0;
    const big = document.getElementById("c"), bx = big.getContext("2d");
    bx.imageSmoothingEnabled = false;
    const small = document.createElement("canvas");
    small.width = 300; small.height = 225;
    [0, 1, 2, 3].forEach((q, i) => {
      Models.draw(small, dots, Math.PI / 4 + q * Math.PI / 2, 1, 0.9);   // the four isometric views
      bx.drawImage(small, (i % 2) * 600, Math.floor(i / 2) * 450, 600, 450);
    });
    return { dots: dots.count, ms: Math.round(built) };
  }, { spec, dirt, where });
  await page.locator("#c").screenshot({ path: out });
  console.log(`${spec.slug}: ${info.dots} dots, built in ${info.ms} ms -> ${out}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

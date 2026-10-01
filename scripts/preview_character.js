#!/usr/bin/env node
/* Draws a character large, every pose, on the soil of a few cities, with each
   city's plants beside it — for checking it against the real animal and the
   artist's hand (docs/v2/characters/REFINE.md). Drawn by the page's own code
   (docs/v2/characters.js), in headless Chromium, from the files on disk.

     NODE_PATH=/opt/node22/lib/node_modules node scripts/preview_character.js fox /tmp/fox.png [--scale 8]

   Writes one picture: a row per city (London, New York, Sydney, San Francisco,
   São Paulo, Phoenix), each pose in order, then the city's plants, one crown
   per stratum; and prints what each city is in DIRT (biome, realm, soil,
   plants). */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const CITIES = [
  ["London", 51.5074, -0.1278], ["New York", 40.7257, -73.9996], ["Sydney", -33.8688, 151.2093],
  ["San Francisco", 37.7749, -122.4194], ["São Paulo", -23.55, -46.63], ["Phoenix", 33.45, -112.07]
];

(async () => {
  const args = process.argv.slice(2);
  const id = args[0] || "fox", out = args[1] || "/tmp/" + id + ".png";
  const k = args.indexOf("--scale");
  const scale = k >= 0 ? Number(args[k + 1]) : 6;
  const sprite = JSON.parse(fs.readFileSync(path.join(V2, "characters", id + ".json"), "utf8"));
  const poses = [];
  Object.keys(sprite.poses).forEach((p) => sprite.poses[p].forEach((_, n) => poses.push([p, n])));
  const cw = sprite.w * sprite.cell * scale, ch = sprite.h * sprite.cell * scale;
  const W = (poses.length + 3) * (cw + 12) + 160, H = CITIES.length * (ch + 16) + 16;

  const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } : {});
  const page = await browser.newPage({ viewport: { width: Math.min(W, 4000), height: Math.min(H, 4000) } });
  await page.route("http://preview.local/**", (r) => {
    const f = path.join(V2, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) { return r.fulfill({ status: 404, body: "" }); }
    r.fulfill({ status: 200, body: fs.readFileSync(f),
                contentType: f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : "text/html" });
  });
  await page.route("http://preview.local/", (r) => r.fulfill({ status: 200, contentType: "text/html",
    body: "<!doctype html><meta charset=utf-8><body style='margin:0;background:#15100c'><div class=stage id=stage><canvas id=tiles></canvas></div>" +
          "<canvas id=c width=" + W + " height=" + H + "></canvas><script src='characters.js'></script>" }));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://preview.local/");
  const info = await page.evaluate(async ({ id, poses, CITIES, scale, cw, ch }) => {
    await window.Characters.load();
    const cv = document.getElementById("c"), g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.font = "13px monospace";
    const said = [];
    CITIES.forEach(([name, lat, lon], r) => {
      const y = 16 + r * (ch + 16);
      // The ground: the place's soil, dark as the site's city ground is.
      const here = window.Characters.preview(g, { id, pose: poses[0][0], n: 0, lat, lon, scale, x: -9999, y: -9999 });
      const soil = here ? here.soilRgb : [80, 60, 40];
      g.fillStyle = "rgb(" + soil.map((v) => Math.round(v * 0.32 + 12)).join(",") + ")";
      g.fillRect(0, y - 8, cv.width, ch + 16);
      g.fillStyle = "#eadfcd";
      g.fillText(name, 8, y + 16);
      poses.forEach(([p, n], i) => {
        window.Characters.preview(g, { id, pose: p, n, lat, lon, scale, x: 160 + i * (cw + 12), y });
      });
      window.Characters.preview(g, { id, plants: true, lat, lon, scale: scale / 2, x: 160 + poses.length * (cw + 12) + 40, y: y + ch / 2 });
      said.push([name, here]);
    });
    return said;
  }, { id, poses, CITIES, scale, cw, ch });
  await page.locator("#c").screenshot({ path: out });
  info.forEach(([name, h]) => {
    console.log(name + ": " + (h ? h.biome + ", " + h.realm + " (" + h.eco + "); soil " + h.soil : "nothing in DIRT here"));
    if (h) { h.strata.forEach((s) => console.log("    " + s)); }
  });
  if (errors.length) { console.log("errors: " + errors.join("; ")); }
  console.log("wrote " + out);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();

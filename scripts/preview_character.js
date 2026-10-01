#!/usr/bin/env node
/* Draws a character large, every pose, on the soil of a few cities, with each
   city's plants beside it — for checking it against the real animal and the
   artist's hand (docs/v2/characters/REFINE.md). Drawn by the page's own code
   (docs/v2/characters.js), in headless Chromium, from the files on disk.

     NODE_PATH=/opt/node22/lib/node_modules node scripts/preview_character.js fox /tmp/fox.png [--scale 8]

   A chimera (three of the cast, head, body, hindquarters, as the corpse
   game makes them: scripts/characters/chimera.py) is drawn by naming three:

     NODE_PATH=/opt/node22/lib/node_modules node scripts/preview_character.js bison,eagle,slug /tmp/chimera.png [--scale 4]

   every pose of it (the walk, the idles, the pause, the look, the rest, the
   presentation, each part's instinct, the ritual, the settled rest of the
   unfolding) on the soil of London, New York and Sydney.

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

async function chimeraSheet(ids, out, px) {
  const NAMES = ["stand0", "stand1", "stand2", "back", "look", "rest", "present", "settle",
                 "walk0", "walk1", "walk2", "walk3", "walk4", "walk5", "act0", "act1", "act2", "act3", "ritual0", "ritual1"];
  const cities = CITIES.slice(0, 3);
  const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route("http://preview.local/**", (r) => {
    const f = path.join(V2, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) { return r.fulfill({ status: 404, body: "" }); }
    r.fulfill({ status: 200, body: fs.readFileSync(f),
                contentType: f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : "text/html" });
  });
  await page.route("http://preview.local/", (r) => r.fulfill({ status: 200, contentType: "text/html",
    body: "<!doctype html><meta charset=utf-8><body style='margin:0;background:#15100c'><canvas id=c></canvas><script src='characters.js'></script>" }));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://preview.local/");
  const size = await page.evaluate(async ({ ids, NAMES, cities, px }) => {
    const per = 10, rowsOf = Math.ceil(NAMES.length / per);
    const chs = [];
    for (const [name, lat, lon] of cities) {
      const ch = window.Characters.chimera(ids, { lat, lon, hidden: true });
      await ch.ready;
      chs.push(ch);
    }
    const probe = document.createElement("canvas").getContext("2d");
    const one = chs[0].draw(probe, 0, 0, "stand0", px);
    const cw = one.w + 8, chh = one.h + 18;
    const cv = document.getElementById("c");
    cv.width = per * cw + 130; cv.height = cities.length * rowsOf * chh + 40;
    const g = cv.getContext("2d");
    g.fillStyle = "#15100c"; g.fillRect(0, 0, cv.width, cv.height);
    g.font = "12px monospace";
    g.fillStyle = "#eadfcd";
    g.fillText(chs[0].name + " · " + ids.join(" / "), 8, 20);
    cities.forEach(([name, lat, lon], r) => {
      const here = window.Characters.preview(probe, { id: ids[0], pose: "stand", n: 0, lat, lon, scale: 1, x: -9999, y: -9999 });
      const soil = here ? here.soilRgb : [80, 60, 40];
      for (let q = 0; q < rowsOf; q += 1) {
        const y = 32 + (r * rowsOf + q) * chh;
        g.fillStyle = "rgb(" + soil.map((v) => Math.round(v * 0.32 + 12)).join(",") + ")";
        g.fillRect(0, y, cv.width, chh - 4);
        g.fillStyle = "#eadfcd";
        if (!q) { g.fillText(name, 8, y + 16); }
        NAMES.slice(q * per, q * per + per).forEach((n, i) => {
          const names = n === "settle" ? ["rest", "act3", "rest"] : n;
          chs[r].draw(g, 130 + i * cw, y + 4, names, px);
          g.fillStyle = "rgba(234,223,205,0.55)";
          g.fillText(n, 130 + i * cw + 2, y + chh - 8);
        });
      }
    });
    return [cv.width, cv.height];
  }, { ids, NAMES, cities, px });
  await page.setViewportSize({ width: Math.min(size[0], 4000), height: Math.min(size[1], 4000) });
  await page.locator("#c").screenshot({ path: out });
  if (errors.length) { console.log("errors: " + errors.join("; ")); }
  console.log("wrote " + out);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

/* The canonical chimera drawn fine (parts/canonical/, scripts/characters/canonical.py):
   every pose of the large drawing, the living changes (blink, breath, the
   slug's ripple), and the small drawing at its own size and enlarged.

     NODE_PATH=/opt/node22/lib/node_modules node scripts/preview_character.js bison,eagle,slug /tmp/fine.png --fine [--scale 3] */
async function fineSheet(ids, out, px) {
  const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ? { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route("http://preview.local/**", (r) => {
    const f = path.join(V2, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!fs.existsSync(f)) { return r.fulfill({ status: 404, body: "" }); }
    r.fulfill({ status: 200, body: fs.readFileSync(f),
                contentType: f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : "text/html" });
  });
  await page.route("http://preview.local/", (r) => r.fulfill({ status: 200, contentType: "text/html",
    body: "<!doctype html><meta charset=utf-8><body style='margin:0;background:#15100c'><canvas id=c></canvas><script src='characters.js'></script>" }));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://preview.local/");
  const size = await page.evaluate(async ({ ids, px, lat, lon }) => {
    const ch = window.Characters.chimera(ids, { lat, lon, hidden: true });
    await ch.ready;
    const names = ch.fine();
    if (!names) { return null; }
    const cells = names.map((n) => [n, "large", {}]).concat([
      ["stand", "large", { blink: true }], ["stand", "large", { breath: true }],
      ["stand", "large", { ripple: 0 }], ["stand", "large", { ripple: 2 }], ["stand", "large", { ripple: 4 }]]);
    const small = names.map((n) => [n, "small", {}]);
    const probe = document.createElement("canvas").getContext("2d");
    const one = ch.drawFine(probe, 0, 0, "stand", px, 1, "large");
    const sm = ch.drawFine(probe, 0, 0, "stand", px, 1, "small");
    const per = 4, cw = one.w + 10, chh = one.h + 18, rows = Math.ceil(cells.length / per);
    const sper = 8, scw = sm.w + 8, sch = sm.h + 18, srows = Math.ceil(small.length / sper);
    const cv = document.getElementById("c");
    cv.width = Math.max(per * cw, sper * scw) + 20; cv.height = rows * chh + srows * sch + 150;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#2a1d14"; g.fillRect(0, 0, cv.width, cv.height);
    g.font = "12px monospace";
    g.fillStyle = "#eadfcd";
    g.fillText(ch.name + " · large, a cell " + px + " px", 10, 18);
    cells.forEach(([n, sc, v], k) => {
      const x = 10 + (k % per) * cw, y = 26 + Math.floor(k / per) * chh;
      ch.drawFine(g, x, y, n, px, 1, sc, v);
      g.fillStyle = "rgba(234,223,205,0.6)";
      g.fillText(n + (v.blink ? " blink" : v.breath ? " breath" : v.ripple >= 0 ? " ripple " + v.ripple : ""), x + 4, y + chh - 6);
    });
    let y0 = 26 + rows * chh + 10;
    g.fillStyle = "#eadfcd";
    g.fillText("small, a cell " + px + " px; and at its size in a city (4/3 CSS px a cell)", 10, y0);
    small.forEach(([n, sc, v], k) => {
      const x = 10 + (k % sper) * scw, y = y0 + 8 + Math.floor(k / sper) * sch;
      ch.drawFine(g, x, y, n, px, 1, sc, v);
      g.fillStyle = "rgba(234,223,205,0.6)";
      g.fillText(n, x + 4, y + sch - 6);
    });
    y0 += 8 + srows * sch + 6;
    ["stand", "walkA", "passB", "walkB", "passA", "look", "mantle", "rest"].forEach((n, k) => {
      ch.drawFine(g, 10 + k * 110, y0, n, 2, 1, "small");
    });
    return [cv.width, cv.height];
  }, { ids, px, lat: 51.5074, lon: -0.1278 });
  if (!size) { console.log("no fine drawing for " + ids.join("-")); await browser.close(); process.exit(1); }
  await page.setViewportSize({ width: Math.min(size[0], 4000), height: Math.min(size[1], 6000) });
  await page.locator("#c").screenshot({ path: out });
  if (errors.length) { console.log("errors: " + errors.join("; ")); }
  console.log("wrote " + out);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

(async () => {
  const args = process.argv.slice(2);
  const id = args[0] || "fox", out = args[1] || "/tmp/" + id + ".png";
  const k = args.indexOf("--scale");
  if (id.indexOf(",") > 0 && args.indexOf("--fine") >= 0) { return fineSheet(id.split(","), out, k >= 0 ? Number(args[k + 1]) : 3); }
  if (id.indexOf(",") > 0) { return chimeraSheet(id.split(","), out, k >= 0 ? Number(args[k + 1]) : 4); }
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

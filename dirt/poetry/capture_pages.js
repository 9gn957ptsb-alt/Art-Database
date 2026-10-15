/* Picture Poetry's pages as DRIFT Poetry needs them, read from that artifact's own published files.

   Picture Poetry draws its characters over each page image as it runs, so they are captured here the way it draws
   them: the artifact is served from a folder of its files, opened in Chromium, and each page's sheet is photographed
   with its page image and its buildings hidden and its ground transparent, at the page image's own size. What its data
   says about each page (its size in the book, where it sets its photograph, where its buildings and characters
   stand) goes into pages.json beside the overlays. The buildings are drawn live in DRIFT Poetry, turned by a swipe as
   in the book (layer.js), so they are taken as Picture Poetry builds them: its model code (models.js, the script that
   makes window.Models) and buildings.json (each building's description, its place's latitude and longitude, its
   name, its outline drawn at rest, and the soil it is made of).

     NODE_PATH=$(npm root -g) node dirt/poetry/capture_pages.js SRC OUT

   SRC holds Picture Poetry's files as published (index.html, page-N.jpg, photo-N.jpg: read them back with the
   Artifact tool); OUT is private (dirt/private/poetry/), and gets pages.json, overlays/over-N.png and a copy of each
   page image and photograph. */
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const { chromium } = require("playwright");

const [SRC, OUT] = process.argv.slice(2).map((p) => p && path.resolve(p));
if (!SRC || !OUT) { console.error("usage: node capture_pages.js SRC OUT"); process.exit(2); }
const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".webp": "image/webp", ".json": "application/json", ".js": "text/javascript" };
const SHEET = { portrait: 460, landscape: 980 };      // the sheets' widths in Picture Poetry's own layout (CSS pixels)

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(SRC, rel);
    if (!file.startsWith(SRC + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

(async () => {
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  fs.mkdirSync(path.join(OUT, "overlays"), { recursive: true });
  const errors = [];
  let book = null;
  for (const want of ["portrait", "landscape"]) {
    // the device pixels a CSS pixel, so that a sheet comes out at its page image's size
    const probe = book && book.pages.find((p) => (p.w > p.h ? "landscape" : "portrait") === want);
    const imgW = probe ? probe.imgW : (want === "portrait" ? 1080 : 1920);
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: imgW / SHEET[want] });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());   // the poems are in the page images
    await page.goto(url, { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => document.querySelectorAll(".sheet").length > 0, null, { timeout: 60000 });
    await sleep(6000);
    if (!book) {
      book = await page.evaluate(() => ({
        pages: D.pages.map((p) => ({ n: p.n, w: p.w, h: p.h, img: p.img, photo: p.photo })),
        objects: D.objects.map((o) => ({ page: o.page, note: o.note, kind: o.kind, hit: o.hit, draw: o.draw || null, model: o.model || null })),
        // the buildings: what each is made of, and (box, the book's own function) its outline drawn at rest on a
        // 900 by 675 canvas, by which the book places it
        models: Object.fromEntries(Object.entries(D.models).map(([slug, m]) => [slug, { spec: m.spec, lat: m.lat, lon: m.lon, rest: box(slug) }])),
        notes: Object.fromEntries(D.objects.filter((o) => o.kind === "model").map((o) => [o.note, { name: D.notes[o.note].name, sub: D.notes[o.note].sub }])),
        dirt: D.dirt,
        code: [...document.scripts].map((s) => s.textContent).find((t) => t.includes("window.Models =")) || null,
      }));
      if (!book.code) throw new Error("Picture Poetry's model code (window.Models) was not found: has the book changed shape?");
      for (const p of book.pages) {
        p.imgW = await page.evaluate((src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im.naturalWidth); im.onerror = () => ok(0); im.src = src; }), p.img);
      }
      if (want === "portrait" && !book.pages.some((p) => p.w <= p.h)) { await ctx.close(); continue; }
    }
    await page.addStyleTag({ content: "img.page,canvas.model{opacity:0!important} .sheet{box-shadow:none!important;background:transparent!important} html,body{background:transparent!important}" });
    const sheets = await page.$$(".sheet");
    for (let i = 0; i < sheets.length; i++) {
      const p = book.pages[i];
      if (!p || (p.w > p.h ? "landscape" : "portrait") !== want) continue;
      await sheets[i].scrollIntoViewIfNeeded();
      await sleep(2500);                                  // the buildings rise a storey at a time as they come into view
      await sheets[i].screenshot({ path: path.join(OUT, "overlays", `over-${p.n}.png`), omitBackground: true });
      console.log("captured page", p.n, want);
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  // Where each page sets its photograph and its buildings and characters, in its page image's pixels.
  const pages = book.pages.map((p) => {
    const k = p.imgW / p.w, box = (b) => b && [b[0] * k, b[1] * k, (b[0] + b[2]) * k, (b[1] + b[3]) * k].map(Math.round);
    const objs = book.objects.filter((o) => o.page === p.n);
    const photo = objs.find((o) => o.kind === "photo");
    return { n: p.n, img: p.img, photo: p.photo, book: [p.w, p.h], photoRect: photo ? box(photo.hit) : null,
             objects: objs.filter((o) => o.kind !== "photo").map((o) => ({ kind: o.kind, note: o.note, box: box(o.draw || o.hit), ...(o.model ? { model: o.model, hit: box(o.hit) } : {}) })) };
  });
  fs.writeFileSync(path.join(OUT, "pages.json"), JSON.stringify({ pages }, null, 1) + "\n");
  fs.writeFileSync(path.join(OUT, "buildings.json"), JSON.stringify({ models: book.models, notes: book.notes, dirt: book.dirt }) + "\n");
  fs.writeFileSync(path.join(OUT, "models.js"), book.code.trim() + "\n");
  for (const p of book.pages) for (const f of [p.img, p.photo]) if (f) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));
  console.log(pages.length, "pages;", errors.length ? "page errors: " + JSON.stringify(errors) : "no page errors");
  if (errors.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });

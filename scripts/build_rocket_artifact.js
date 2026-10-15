#!/usr/bin/env node
/* Rocket as an Artifact (a page hosted on claude.ai), straight into play: no start card, the
   screen black until the place is built, then the eyes open under the tree beside the wreck.
   The Artifact is called Holographic Mr Pearl, the name the game is becoming (artist, 15 Oct 2026:
   "Rename the artifact to holographic Mr Pearl").

   An Artifact's frame loads nothing from other sites, so everything the game needs is bundled:
   the scripts and the style inlined into the page (index.html); sections.json; a catalogue of
   the modelled buildings and a pool of saved works with what the clues need of their histories;
   each building's model and ground (data/); and the works' pictures, fetched once from Artsy's
   image server (art/). Its escapes are the new forms and the modelled buildings: the museums
   and the cities need more of the site than an Artifact should carry.

   The bundle is written outside the repository (the pictures are the works', not the site's):

     node scripts/build_rocket_artifact.js <out dir> [number of works, 150]

   then published with the Artifact tool: index.html, with every other file under <out dir> as
   its files. */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const V2 = path.join(DOCS, "v2");
const ROCKET = path.join(DOCS, "worlds", "rocket");
const CDN = "https://d32dm0rphc51dk.cloudfront.net/";

// The new forms a first visit can open on: each has an upper box, a crown and a pool.
const FORMS = [2, 4, 11, 12, 13, 15, 16, 23, 24, 27, 35, 41, 50, 64, 67];

const out = process.argv[2];
const N = +process.argv[3] || 150;
if (!out) { console.error("usage: node scripts/build_rocket_artifact.js <out dir> [works]"); process.exit(1); }

const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

function fetchTo(url, file) {
  return new Promise((done) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) { done(true); return; }
    execFile("curl", ["-sS", "-f", "--max-time", "30", "-o", file, url], (err) => {
      if (err) { try { fs.unlinkSync(file); } catch (e) { /* none */ } done(false); return; }
      done(true);
    });
  });
}
async function pool(items, size, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: size }, worker));
  return results;
}

async function main() {
  mkdir(out); mkdir(path.join(out, "art")); mkdir(path.join(out, "data", "grounds")); mkdir(path.join(out, "data", "models"));
  const cat = json(path.join(ROCKET, "catalogue.json"));
  const sections = json(path.join(ROCKET, "sections.json"));
  const slugs = sections.projects.map((p) => p.slug);

  // The buildings, each with its model and its ground.
  const buildings = cat.buildings.filter((b) => slugs.includes(b.slug));
  buildings.forEach((b) => {
    fs.copyFileSync(path.join(V2, "models", b.slug + ".json"), path.join(out, "data", "models", b.slug + ".json"));
  });
  slugs.forEach((slug) => { fs.copyFileSync(path.join(V2, "grounds", slug + ".json"), path.join(out, "data", "grounds", slug + ".json")); });

  // A pool of the saved works, spread through the site's, each with its picture.
  const step = Math.max(1, cat.pool.length / N), want = [];
  for (let k = 0; k < N && Math.floor(k * step) < cat.pool.length; k += 1) { want.push(cat.pool[Math.floor(k * step)]); }
  const histories = {};
  const got = await pool(want, 8, async (w) => {
    let h;
    try { h = json(path.join(V2, "histories", w.id + ".json")); } catch (e) { return null; }
    const image = h.image || String(w.i || "").split("/")[0];
    if (!image) { return null; }
    if (!(await fetchTo(CDN + image + "/medium.jpg", path.join(out, "art", image + ".jpg")))) { return null; }
    histories[w.id] = { title: h.title, artists: h.artists, date: h.date, medium: h.medium, dimensions: h.dimensions, c: h.c, image };
    return w;
  });
  const works = got.filter(Boolean);
  fs.writeFileSync(path.join(out, "catalogue.json"), JSON.stringify({
    note: "Rocket's catalogue for its Artifact, from docs/worlds/rocket/catalogue.json by scripts/build_rocket_artifact.js: the modelled buildings and a pool of the saved works with what the clues need of their histories.",
    museums: [], cities: [], buildings, pool: works, histories
  }));
  fs.copyFileSync(path.join(ROCKET, "sections.json"), path.join(out, "sections.json"));

  // The page: the game's own, with its style and scripts inlined, set to play straight in.
  let html = read(path.join(ROCKET, "index.html"));
  const take = (re, s) => { if (!re.test(html)) { throw new Error("not in index.html: " + re); } html = html.replace(re, s); };
  take(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, "");
  take(/<meta charset="utf-8">\s*/i, "");
  take(/<meta name="viewport"[^>]*>\s*/i, "");
  take(/<\/head>\s*<body>\s*/i, "\n");
  take(/\s*<\/body>\s*<\/html>\s*$/i, "\n");
  take(/<title>Rocket<\/title>/, "<title>Holographic Mr Pearl</title>");
  take(/<meta name="description" content="[^"]*">/, '<meta name="description" content="A first-person game in blocks: you come to under a tree beside your crashed capsule, in a world built of the parts of the buildings the site has modelled, and find the four pieces of your rocket.">');
  take(/<link rel="stylesheet" href="rocket\.css">/, () => "<style>\n" + read(path.join(ROCKET, "rocket.css")) + "</style>");
  take(/<div class="veil" id="veil" hidden><\/div>/, '<div class="veil" id="veil"></div>');
  take(/<section class="start" id="start">/, '<section class="start" id="start" hidden>');
  take(/\s*<a class="apart" href="forms\.html">[^<]*<\/a>/, "");
  take(/\s*<a class="apart" href="figure\.html">[^<]*<\/a>/, "");
  const scripts = ["../../v2/models.js", "forms.js", "adventure.js", "place.js", "rocket.js"];
  const files = { "../../v2/models.js": path.join(V2, "models.js") };
  let inline = "<script>\nwindow.ROCKET = { name: \"Holographic Mr Pearl\", base: \"data/\", play: true, kinds: [\"form\", \"form\", \"form\", \"building\"], forms: " + JSON.stringify(FORMS) +
               ", art: function (id) { return \"art/\" + id + \".jpg\"; } };\n</script>\n";
  scripts.forEach((src) => {
    const code = read(files[src] || path.join(ROCKET, src));
    if (/<\/script/i.test(code)) { throw new Error(src + " holds a closing script tag"); }
    inline += "<script>\n" + code + "\n</script>\n";
  });
  take(/(\s*<script src="[^"]+"><\/script>)+/, () => "\n" + inline);
  fs.writeFileSync(path.join(out, "index.html"), html);

  const size = (dir) => fs.readdirSync(dir).reduce((s, f) => { const p = path.join(dir, f); return s + (fs.statSync(p).isDirectory() ? size(p) : fs.statSync(p).size); }, 0);
  const count = (dir) => fs.readdirSync(dir).reduce((s, f) => { const p = path.join(dir, f); return s + (fs.statSync(p).isDirectory() ? count(p) : 1); }, 0);
  console.log("page " + Math.round(fs.statSync(path.join(out, "index.html")).size / 1024) + " KB; " + works.length + " works with pictures; " +
              buildings.length + " buildings; " + count(out) + " files, " + Math.round(size(out) / 1024 / 1024 * 10) / 10 + " MB in " + out);
}

main().catch((e) => { console.error(e); process.exit(1); });

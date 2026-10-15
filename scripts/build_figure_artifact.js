#!/usr/bin/env node
/* The figure in 3D (docs/worlds/rocket/figure.html) as an Artifact, a page hosted on claude.ai:
   the same page, its studies (figures.json) inlined, since an Artifact's frame fetches nothing,
   and without the way back to Rocket on the site.

     node scripts/build_figure_artifact.js <out.html>

   then published with the Artifact tool. */

"use strict";

const fs = require("fs");
const path = require("path");

const ROCKET = path.resolve(__dirname, "..", "docs", "worlds", "rocket");
const out = process.argv[2];
if (!out) { console.error("usage: node scripts/build_figure_artifact.js <out.html>"); process.exit(1); }

let html = fs.readFileSync(path.join(ROCKET, "figure.html"), "utf8");
const data = fs.readFileSync(path.join(ROCKET, "figures.json"), "utf8");
const take = (re, s) => { if (!re.test(html)) { throw new Error("not in figure.html: " + re); } html = html.replace(re, s); };

// The Artifact wraps the page in its own document, with a charset and a viewport.
take(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, "");
take(/<meta charset="utf-8">\s*/i, "");
take(/<meta name="viewport"[^>]*>\s*/i, "");
take(/<\/head>\s*<body>\s*/i, "\n");
take(/\s*<\/body>\s*<\/html>\s*$/i, "\n");
// Its name, and the promise that the side gutter clears a phone's side bars (.wrap pads by both insets).
take(/<title>[^<]*<\/title>/, '<title>The Figure in 3D</title>\n  <meta name="claude:viewport-fit-sides" content="cover">');
take(/\s*<a class="back" href="\.\/">[^<]*<\/a>/, "");
if (/<\/script/i.test(data)) { throw new Error("figures.json holds a closing script tag"); }
take(/(\n\s*)<script>\n/, (m, sp) => sp + "<script>window.FIGURES = " + data.trim() + ";</script>" + sp + "<script>\n");
fs.writeFileSync(out, html);
console.log(out + ": " + Math.round(html.length / 1024) + " KB");

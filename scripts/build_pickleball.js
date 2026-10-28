#!/usr/bin/env node
// build_pickleball.js - the pickleball game (docs/worlds/pickleball/) as a YouTube Playables bundle, or as one page.
//   node scripts/build_pickleball.js --playable <outdir>   a folder and <outdir>.zip, index.html at the root, the SDK
//                                                         (https://www.youtube.com/game_api/v1) its first script
//   node scripts/build_pickleball.js --artifact <file>     one self-contained HTML, everything inlined, no SDK
// The page's scripts are static <script src> tags (YouTube's Content Security Policy puts nonces on the scripts in
// the HTML file, and the SDK's firstFrameReady() checks that its own tag is the first, neither defer nor async); his
// body's spec goes in as a script (pearl-body.js) since the bundle may not fetch. The build refuses an inline script,
// an inline event handler, eval or new Function. No dependencies: the zip is written here (deflate from zlib).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, ".."), SRC = path.join(ROOT, "docs/worlds/pickleball"), ROCKET = path.join(ROOT, "docs/worlds/rocket");
const SDK = '<script src="https://www.youtube.com/game_api/v1"></script>';
const [mode, out] = process.argv.slice(2);
if (!/^--(playable|artifact)$/.test(mode || "") || !out) { console.error("usage: build_pickleball.js --playable <outdir> | --artifact <file.html>"); process.exit(2); }
const fail = (why) => { console.error("refused: " + why); process.exit(1); };

let html = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) { fail("an inline <script> in index.html"); }
if (/<[^>]+\son[a-z]+\s*=/i.test(html)) { fail("an inline event handler in index.html"); }
const files = {
  "pearl.js": fs.readFileSync(path.join(ROCKET, "pearl.js"), "utf8"),
  "pearl-body.js": "window.PEARL_BODY = " + JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROCKET, "pearl-body.json"), "utf8"))) + ";\n",
  "pickleball.js": fs.readFileSync(path.join(SRC, "pickleball.js"), "utf8"),
  "pickleball.css": fs.readFileSync(path.join(SRC, "pickleball.css"), "utf8"),
};
Object.keys(files).forEach((n) => { if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(files[n])) { fail("eval or new Function in " + n); } });
if (html.indexOf('<script src="../rocket/pearl.js"></script>') < 0) { fail("index.html does not load ../rocket/pearl.js as expected"); }
html = html.replace('<script src="../rocket/pearl.js"></script>', '<script src="pearl.js"></script>\n<script src="pearl-body.js"></script>');

if (mode === "--artifact") {
  // (an Artifact's host wraps the page in its own document, charset and viewport: so the title, the style and the
  // page's elements, with no document tags of their own)
  let one = html.replace(/<!doctype html>\n?|<\/?html[^>]*>\n?|<\/?head>\n?|<\/?body>\n?|<meta charset[^>]*>\n?|<meta name="viewport"[^>]*>\n?/gi, "");
  one = one.replace(/<link rel="stylesheet" href="pickleball.css">/, () => "<style>\n" + files["pickleball.css"] + "</style>");
  one = one.replace(/<script src="([^"]+)"><\/script>/g, (m, n) => { if (!files[n]) { fail("unknown script " + n); } return "<script>\n" + files[n].replace(/<\/script/gi, "<\\/script") + "</script>"; });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, one);
  console.log(out, one.length, "bytes");
  process.exit(0);
}

// --playable: the SDK the first script in <head>, after the charset alone
html = html.replace(/<meta charset="utf-8">\n?/i, (m) => m + SDK + "\n");   // (the charset first: it must lie in the first 1024 bytes)
const first = (html.match(/<script[^>]*>/i) || [""])[0];
if (first.indexOf("https://www.youtube.com/game_api/") < 0 || /\b(defer|async)\b/.test(first)) { fail("the SDK is not the first plain script"); }
files["index.html"] = html;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const names = ["index.html", "pickleball.css", "pearl.js", "pearl-body.js", "pickleball.js"];
names.forEach((n) => fs.writeFileSync(path.join(out, n), files[n]));

// the zip: each file deflated, a local header before it, the central directory after
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) { c = crcT[(c ^ b) & 0xff] ^ (c >>> 8); } return (c ^ 0xffffffff) >>> 0; };
const parts = [], central = [];
let offset = 0;
names.forEach((n) => {
  const data = Buffer.from(files[n], "utf8"), comp = zlib.deflateRawSync(data, { level: 9 }), name = Buffer.from(n, "utf8"), crc = crc32(data);
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(0, 30); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
  parts.push(lh, name, comp); central.push(ch, name);
  offset += 30 + name.length + comp.length;
  console.log(n.padEnd(16), String(data.length).padStart(8), "bytes,", String(comp.length).padStart(7), "zipped");
});
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat(parts.concat([cd, end]));
fs.writeFileSync(out.replace(/\/$/, "") + ".zip", zip);
console.log(out.replace(/\/$/, "") + ".zip", zip.length, "bytes");

/* Checks for Glyph Light's engine (dirt/engine/glyphlight.js, and the site's copy, docs/v2/glyphlight.js).

     NODE_PATH=$(npm root -g) node dirt/engine/check_glyphlight.js compat [OLD] [NEW]
     NODE_PATH=$(npm root -g) node dirt/engine/check_glyphlight.js shots OUTDIR [NEW]
     NODE_PATH=$(npm root -g) node dirt/engine/check_glyphlight.js cost [OLD] [NEW]

   OLD is a file or a git object (REV:PATH), by default HEAD:dirt/engine/glyphlight.js (the engine as committed); NEW is
   a file, by default this folder's glyphlight.js. Everything runs in headless Chromium on SwiftShader.

   compat draws one test picture (gradients, shapes, words, a photograph, a second canvas laid on with opacity and
   screen blending) through OLD and NEW with the same options, for every style, mode, two sets, glow on and off, under,
   invert, detail, auto levels off, keep circles, DRIFT's and DRIFT Poetry's calls and the Artist Website's call, and
   compares the two overlays' pixels as drawn (readPixels, premultiplied). It exits 1 if any channel of any pixel
   differs by more than 1 level, and says where the differences are. With none of the storyboard's options the engine
   must draw what it drew before.

   shots writes PNGs to OUTDIR: a plane (a big canvas) slid under a phone-sized overlay by `origin`, with a field that
   changes every control frame by frame, with the motions laid out as places, and with a text per frame, each before
   and after the origin moves by a fraction of a frame, plus magnified gutters and the plane itself. It measures how
   far the glyphs ride with the plane (the second shot against the first, shifted) and, for comparison, how far the old
   engine's screen-fixed grid lets them re-pick. It also checks g.at(), g.stats(), the page's maps and the flash guard.

   cost times whole frames (read, cell pass, glow, draw) on a 390 × 800 CSS view at dpr 3, the phone of the map's
   estimate, for OLD and NEW. SwiftShader is a CPU rasteriser: the ratios mean something, the milliseconds do not;
   only a real phone says how fast. */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { chromium } = (() => {
  try { return require("playwright"); }
  catch (e) { return require(path.join(cp.execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright")); }   // NODE_PATH unset
})();
const [cmd, ...args] = process.argv.slice(2);
const T0 = Date.now(), log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0) + "s", ...a);
const launch = () => chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const REPO = path.resolve(__dirname, "..", "..");

function source(spec, fallback) {
  if (!spec) spec = fallback;
  if (fs.existsSync(spec)) return fs.readFileSync(spec, "utf8");
  return cp.execFileSync("git", ["show", spec], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 26 });
}
// a photograph for the test picture: the private screens beside this checkout or its main one, else none (a made one)
function photo() {
  const dirs = [path.join(REPO, "dirt", "private", "screens")];
  try {
    const common = cp.execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: REPO, encoding: "utf8" }).trim();
    dirs.push(path.join(path.dirname(common), "dirt", "private", "screens"));
  } catch (e) { /* not a git checkout */ }
  if (process.env.GL_PHOTO && fs.existsSync(process.env.GL_PHOTO)) return "data:image/jpeg;base64," + fs.readFileSync(process.env.GL_PHOTO).toString("base64");
  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const f = fs.readdirSync(d).filter((n) => /\.jpe?g$/i.test(n)).sort();
    const pick = f.find((n) => /waterfall/.test(n)) || f[0];
    if (pick) return "data:image/jpeg;base64," + fs.readFileSync(path.join(d, pick)).toString("base64");
  }
  return null;
}

// The test picture, drawn in the page into a canvas: gradients, shapes, words, a photograph (or a made one).
const PICTURE = `
window.drawPicture = async function (c, photo, seed) {
  const g = c.getContext("2d"), W = c.width, H = c.height;
  let s = seed || 7; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  const lg = g.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, "#081428"); lg.addColorStop(0.45, "#c0603a"); lg.addColorStop(0.7, "#f2d68a"); lg.addColorStop(1, "#1d3b2a");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W * 0.72, H * 0.3, 2, W * 0.72, H * 0.3, H * 0.45);
  rg.addColorStop(0, "rgba(255,255,240,1)"); rg.addColorStop(1, "rgba(255,255,240,0)");
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { g.fillStyle = "hsl(" + (rnd() * 360) + ",70%," + (20 + rnd() * 60) + "%)"; g.beginPath(); g.arc(rnd() * W, rnd() * H, 6 + rnd() * H * 0.12, 0, 7); g.fill(); }
  g.strokeStyle = "#fff"; g.lineWidth = Math.max(1, W / 300); g.strokeRect(W * 0.05, H * 0.6, W * 0.3, H * 0.3);
  g.fillStyle = "#000"; g.fillRect(W * 0.38, H * 0.08, W * 0.12, H * 0.5);
  g.fillStyle = "#fff"; g.font = "bold " + Math.round(H * 0.12) + "px serif"; g.fillText("Glyph Light", W * 0.06, H * 0.2);
  g.font = Math.round(H * 0.05) + "px sans-serif"; g.fillText("the texture of what is drawn", W * 0.06, H * 0.3);
  const px = W * 0.55, py = H * 0.5, pw = W * 0.4, ph = H * 0.45;
  if (photo) {
    const im = new Image(); im.src = photo; await im.decode();
    g.drawImage(im, px, py, pw, ph);
  } else {
    const d = g.createImageData(Math.round(pw), Math.round(ph));
    for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
      const i = (y * d.width + x) * 4, v = 0.5 + 0.25 * Math.sin(x / 9) * Math.cos(y / 13) + 0.25 * (rnd() - 0.5);
      d.data[i] = 255 * v * 0.8; d.data[i + 1] = 255 * v; d.data[i + 2] = 255 * (1 - v) * 0.7; d.data[i + 3] = 255;
    }
    g.putImageData(d, Math.round(px), Math.round(py));
  }
};`;

const POEM = "The plane is a storyboard. Its x axis is the story: forward is the view moving right, as a book's leaf " +
  "turns. Frames are columns side by side; neighbouring frames are successive moments, so a swipe plays them as a " +
  "thumb flips a flip book. 一二人口山日 ｱｶｻﾀﾅ ∴∵→○◇△◎¶▢◆ watercolour, frameless, seamless.";
const SITE_SET = " ∴∵→○◇△◎¶▢◆";

async function compat(oldSpec, newSpec) {
  const OLD = source(oldSpec, "HEAD:dirt/engine/glyphlight.js"), NEW = source(newSpec, path.join(__dirname, "glyphlight.js"));
  const browser = await launch();
  const ph = photo();
  log("photograph:", ph ? "yes" : "made");
  const configs = [
    { name: "desktop", W: 360, H: 240, dpr: 2 },
    { name: "phone", W: 240, H: 300, dpr: 3 },
  ];
  const cases = [];
  const base = { cell: 6 };
  for (const mode of ["full", "mono", "gold", "blue"]) for (const glow of [0.6, 0]) {
    for (const set of [undefined, "fine"]) cases.push({ name: `ascii ${mode} ${set || "ascii"} glow ${glow}`, o: { style: "ascii", mode, glow, set: set ? "SETS.fine" : undefined } });
    for (const style of ["dots", "grain", "scan", "text"]) cases.push({ name: `${style} ${mode} glow ${glow}`, o: { style, mode, glow, text: style === "text" ? "POEM" : undefined } });
  }
  for (const style of ["ascii", "dots", "grain", "scan", "text"]) {
    cases.push({ name: `${style} under 0.3`, o: { style, under: 0.3, text: style === "text" ? "POEM" : undefined } });
    cases.push({ name: `${style} invert`, o: { style, invert: true, text: style === "text" ? "POEM" : undefined } });
    cases.push({ name: `${style} detail 1.4`, o: { style, detail: 1.4, text: style === "text" ? "POEM" : undefined } });
  }
  cases.push({ name: "ascii no auto, exposure 0.7, contrast 1.6, gamma 1.3, thresh 0.5", o: { auto: false, exposure: 0.7, contrast: 1.6, gamma: 1.3, thresh: 0.5 } });
  cases.push({ name: "dots keep circles", o: { style: "dots", keep: "KEEP" } });
  cases.push({ name: "ascii set 'blocks', bg", o: { set: "SETS.blocks", bg: [0.06, 0.04, 0.02] } });
  cases.push({ name: "grain cell 5 glow 1 thresh 0.3", o: { style: "grain", cell: 5, glow: 1, thresh: 0.3 } });
  cases.push({ name: "text gold thresh 0.1 (glow in the fade)", o: { style: "text", mode: "blue", thresh: 0.1, text: "POEM" } });
  cases.push({ name: "DRIFT (ascii, fine, cell (w) => w < 600 ? 5 : 6)", o: { style: "ascii", set: "SETS.fine", cell: "DRIFT_CELL" } });
  cases.push({ name: "DRIFT Poetry (text, the poems, cell × 1.4)", o: { style: "text", text: "POEM", cell: "POETRY_CELL" } });
  cases.push({ name: "site (its set, bg, contrast 1, gamma 0.8, thresh 0.82, glow 0.5, fit, layout boxes, class, cell fn, active)", site: true,
    o: { set: "SITE_SET", bg: [15 / 255, 10 / 255, 7 / 255], contrast: 1, gamma: 0.8, thresh: 0.82, glow: 0.5, boxes: "layout", className: "world", cell: "SITE_CELL", fit: "FIT", active: "ACTIVE" } });
  cases.push({ name: "storyboard options at their defaults (origin 0, 0; levels screen; level 0)", o: { origin: "ORIGIN0", levels: "screen", level: 0, seam: 0.236 } });
  const lit = (o) => "{" + Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => {
    const s = typeof v === "string" ? ({ "SETS.fine": "GL.SETS.fine", "SETS.blocks": "GL.SETS.blocks", POEM: JSON.stringify(POEM), SITE_SET: JSON.stringify(SITE_SET),
      KEEP: "() => [{ x: 60, y: 50, r: 30 }, { x: 200, y: 160, r: 45 }]", DRIFT_CELL: "(w) => (w < 600 ? 5 : 6)", POETRY_CELL: "(w) => (w < 600 ? 5 : 6) * 1.4",
      SITE_CELL: "() => (innerWidth < 700 ? 5 : 6)", FIT: "() => document.getElementById('src')", ACTIVE: "() => true", ORIGIN0: "() => ({ x: 0, y: 0 })" }[v] || JSON.stringify(v)) : JSON.stringify(v);
    return k + ": " + s;
  }).join(", ") + "}";
  let worst = 0, failed = 0, errors = [];
  for (const cf of configs) {
    const page = await browser.newPage({ viewport: { width: cf.W + 40, height: cf.H + 40 }, deviceScaleFactor: cf.dpr });
    page.setDefaultTimeout(600000);
    page.on("pageerror", (e) => { errors.push(cf.name + ": " + e.message); log("PAGE ERROR", e.message.slice(0, 300)); });
    page.on("console", (m) => { if (m.type() === "error") { errors.push(cf.name + ": " + m.text()); log("CONSOLE ERROR", m.text().slice(0, 300)); } });
    await page.setContent(`<!doctype html><style>body{margin:0;background:#222}#host{position:relative;left:20px;top:20px;width:${cf.W}px;height:${cf.H}px;overflow:hidden}
      #src{position:absolute;left:0;top:0;width:100%;height:100%}#over{position:absolute;left:30%;top:20%;width:50%;height:60%;opacity:.6;mix-blend-mode:screen}</style>
      <div id=host><canvas id=src width=${cf.W * cf.dpr} height=${cf.H * cf.dpr}></canvas><canvas id=over width=${Math.round(cf.W * 0.5)} height=${Math.round(cf.H * 0.6)}></canvas></div>`);
    await page.addScriptTag({ content: PICTURE });
    await page.evaluate(async (ph) => { await window.drawPicture(document.getElementById("src"), ph, 7); await window.drawPicture(document.getElementById("over"), null, 99); }, ph);
    await page.addScriptTag({ content: OLD + "\n;window.OldGL = window.GlyphLight;" });
    await page.addScriptTag({ content: NEW + "\n;window.NewGL = window.GlyphLight;" });
    // auto levels probe 500 ms apart on the page's clock (from 0): past that, both overlays probe on their first frame
    await page.waitForFunction(() => performance.now() > 1500);
    for (const c of cases) {
      const o = Object.assign({}, base, c.o);
      const make = (GL) => `(() => { const GL = window.${GL}, host = document.getElementById("host"); const o = Object.assign(${lit(o)}, { host, sources: () => [document.getElementById("src"), document.getElementById("over")] }); return GL.create(o); })()`;
      await page.evaluate(`window.__a = ${make("OldGL")}; window.__b = ${make("NewGL")};`);
      await page.evaluate(() => document.fonts.ready.then(() => new Promise((ok) => setTimeout(ok, 120))));
      const r = await page.evaluate(() => {
        const out = [];
        for (const g of [window.__a, window.__b]) {
          g.frame();
          const c = g.canvas, gl = c.getContext("webgl2"), px = new Uint8Array(c.width * c.height * 4);
          gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
          out.push({ w: c.width, h: c.height, px });
        }
        const [a, b] = out;
        if (a.w !== b.w || a.h !== b.h) return { size: [a.w, a.h, b.w, b.h] };
        let max = 0, n1 = 0, n2 = 0, lit = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1; const where = [];
        for (let i = 0; i < a.px.length; i++) {
          if (a.px[i] > 8) lit++;
          const d = Math.abs(a.px[i] - b.px[i]);
          if (!d) continue;
          const p = i >> 2, x = p % a.w, y = a.h - 1 - Math.floor(p / a.w);
          max = Math.max(max, d); n1++;
          if (d > 1) { n2++; if (where.length < 6) where.push([x, y, "rgba"[i & 3], a.px[i], b.px[i]]); }
          bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
        }
        window.__a.destroy(); window.__b.destroy();
        return { w: a.w, h: a.h, max, n1, n2, lit, box: n1 ? [bx0, by0, bx1, by1] : null, where };
      });
      if (r.size) { failed++; log("FAIL", cf.name, c.name, "sizes differ", r.size); continue; }
      worst = Math.max(worst, r.max);
      const ok = r.max <= 1 && r.lit > 1000;
      if (!ok) failed++;
      log(ok ? "ok  " : "FAIL", cf.name, `${r.w}x${r.h}`, c.name, `max ${r.max}`, r.n1 ? `(${r.n1} channel values off by 1${r.n2 ? `, ${r.n2} by more: ${JSON.stringify(r.where)}` : ""}, within x ${r.box[0]}..${r.box[2]}, y ${r.box[1]}..${r.box[3]})` : "(identical)", r.lit > 1000 ? "" : "NOTHING DRAWN");
    }
    await page.close();
  }
  await browser.close();
  log(`${failed ? "FAILED" : "PASSED"}: ${failed} case(s) differ by more than 1 level; largest difference ${worst}; ${errors.length} page error(s)`);
  process.exit(failed || errors.length ? 1 : 0);
}

// ---- shots: the storyboard ------------------------------------------------------------------------------------
const PLANE = `
window.drawPlane = async function (c, photo, fw, fh) {
  const g = c.getContext("2d"), W = c.width, H = c.height;
  const lg = g.createLinearGradient(0, 0, W, H * 0.4);
  lg.addColorStop(0, "#0a1a3a"); lg.addColorStop(0.3, "#5a2a6a"); lg.addColorStop(0.55, "#d0703a"); lg.addColorStop(0.8, "#f0e0a0"); lg.addColorStop(1, "#204a3a");
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  let s = 3; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 70, rg = g.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, "hsla(" + (rnd() * 360) + ",80%," + (40 + rnd() * 50) + "%,0.95)"); rg.addColorStop(1, "hsla(0,0%,0%,0)");
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  if (photo) { const im = new Image(); im.src = photo; await im.decode(); for (let k = 0; k < 6; k++) g.drawImage(im, 60 + k * 410, 40 + (k % 3) * 300, 330, 270); }
  // each frame's number, in the middle of the frame, so a shot says where it is
  g.textAlign = "center"; g.textBaseline = "middle";
  for (let j = 0; j * fh < H; j++) for (let i = 0; i * fw < W; i++) {
    g.font = "bold " + Math.round(fh * 0.34) + "px sans-serif"; g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillText(String(i + 13 * j), (i + 0.5) * fw, (j + 0.5) * fh);
  }
};`;

const LINES = ["the plane is a storyboard", "a thumb is the direction of the story", "frames placed side by side",
  "not one behind the other", "a flip book laid flat", "watercolour without a seam", "each visit opens somewhere else",
  "stillness when the thumb is still"];

const FIELDS = {
  // every control changes frame by frame (k = i + 13 j, the story index): continuous ones on waves of Fibonacci
  // periods, discrete ones in steps, and two motions laid out along the story
  every: `(i, j) => { const k = i + 13 * j, m = (a, n) => ((a % n) + n) % n, w = (p) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / p);
    return Object.assign({ style: ["ascii", "dots", "ascii", "grain", "scan", "text", "ascii"][m(k, 7)],
      set: ["fine", "ascii", "blocks", "kana", "binary", "kanji"][m(k, 6)], mode: ["full", "gold", "blue", "mono", "full"][m(k, 5)],
      level: [0, 0, 1, 0, 2, 1][m(k, 6)], exposure: -0.5 + w(13), contrast: 1 + 0.6 * w(5), gamma: 0.75 + 0.6 * w(8), detail: 1.2 * w(3),
      glow: 0.35 + 0.5 * w(4), thresh: 0.6 + 0.25 * w(21), under: 0.38 * w(34), invert: m(k, 7) === 3 },
      GlyphLight.motions.shimmer(k), { gain: GlyphLight.motions.pulse(m(k, 8) / 8).gain }); }`,
  // the motions laid out as places: a row each, s running along the row
  motions: `(i, j) => { const m = (a, n) => ((a % n) + n) % n, s = m(i, 8) / 8, row = m(j, 4), M = GlyphLight.motions;
    const base = { style: "ascii", set: "fine" };
    if (row === 0) return Object.assign(base, M.pulse(s));
    if (row === 1) return Object.assign(base, M.shimmer(i));
    if (row === 2) { const pp = s < 0.5 ? 2 * s : 2 - 2 * s; return Object.assign(base, M.reveal(pp)); }
    return Object.assign(base, M.push(m(i, 3) / 3 + 0.17)); }`,
  // DRIFT Poetry's kind: the text style, each frame its own line, colour by page, tone along the lines
  poetry: `(i, j) => { const k = i + 13 * j, m = (a, n) => ((a % n) + n) % n;
    return Object.assign({ style: "text", mode: ["full", "gold", "blue"][m(Math.floor(k / 4), 3)], exposure: -0.3 + 0.15 * m(k, 4), glow: 0.5 }, GlyphLight.motions.shimmer(k)); }`,
};

async function shots(outDir, newSpec) {
  if (!outDir) throw new Error("shots OUTDIR");
  fs.mkdirSync(outDir, { recursive: true });
  const NEW = source(newSpec, path.join(__dirname, "glyphlight.js")), OLD = source(null, "HEAD:dirt/engine/glyphlight.js");
  const browser = await launch();
  const ph = photo();
  const VW = 390, VH = 300, DPR = 2;
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  page.setDefaultTimeout(900000);
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); log("PAGE ERROR", e.message.slice(0, 400)); });
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); if (m.type() === "error" || m.type() === "warning") log("CONSOLE", m.type(), m.text().slice(0, 300)); });
  const PW = 2700, PH = 1300;
  await page.setContent(`<!doctype html><style>body{margin:0;background:#000;overflow:hidden}#host{position:relative;width:${VW}px;height:${VH}px;overflow:hidden}
    #plane{position:absolute;left:0;top:0;width:${PW}px;height:${PH}px;transform-origin:0 0}</style>
    <div id=host><canvas id=plane width=${PW} height=${PH}></canvas></div>`);
  await page.addScriptTag({ content: PLANE });
  await page.addScriptTag({ content: OLD + "\n;window.OldGL = window.GlyphLight;" });
  await page.addScriptTag({ content: NEW + "\n;window.NewGL = window.GlyphLight; window.GlyphLight = window.NewGL;" });
  const FW = 150, FH = 120;
  await page.evaluate(async ([ph, fw, fh]) => { await window.drawPlane(document.getElementById("plane"), ph, fw, fh); }, [ph, FW, FH]);
  await page.evaluate(`window.LINES = ${JSON.stringify(LINES)}; window.O = { x: 0, y: 0 };
    window.moveTo = (x, y) => { O.x = x; O.y = y; document.getElementById("plane").style.transform = "translate(" + (-x) + "px," + (-y) + "px)"; };
    window.grab = (g, scale, clip) => { g.frame(); const c = g.canvas, gl = c.getContext("webgl2"), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const [cx, cy, cw, ch] = clip || [0, 0, w, h], s = scale || 1, out = document.createElement("canvas"); out.width = cw * s; out.height = ch * s;
      const im = new ImageData(w, h); for (let y = 0; y < h; y++) im.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      // the overlay is premultiplied: laid on black, as it shows over a dark page
      for (let i = 0; i < im.data.length; i += 4) im.data[i + 3] = 255;
      const t = document.createElement("canvas"); t.width = w; t.height = h; t.getContext("2d").putImageData(im, 0, 0);
      const g2 = out.getContext("2d"); g2.imageSmoothingEnabled = false; g2.drawImage(t, cx, cy, cw, ch, 0, 0, cw * s, ch * s);
      window.__last = px; window.__lw = w; window.__lh = h;
      return out.toDataURL("image/png"); };
    // of the lit pixels (either shot) inside a margin, the share where shot b matches shot a moved by dx device px
    // (the plane moved left by dx) within 2 levels; the margin keeps the edges' halos and new ground out
    window.ride = (a, b, w, h, dx, margin) => { let same = 0, n = 0;
      for (let y = margin; y < h - margin; y++) for (let x = margin; x < w - dx - margin; x++) {
        const i = (y * w + x) * 4, j = (y * w + x + dx) * 4;
        if (Math.max(b[i], b[i + 1], b[i + 2], a[j], a[j + 1], a[j + 2]) < 24) continue;
        n++;
        if (Math.abs(b[i] - a[j]) <= 2 && Math.abs(b[i + 1] - a[j + 1]) <= 2 && Math.abs(b[i + 2] - a[j + 2]) <= 2) same++; }
      return +(same / Math.max(1, n)).toFixed(4); };`);
  const save = async (name, dataUrl) => { const f = path.join(outDir, name + ".png"); fs.writeFileSync(f, Buffer.from(dataUrl.split(",")[1], "base64")); log("wrote", f); return f; };
  const report = {};
  const make = async (GL, opts) => page.evaluate(`window.__g && window.__g.destroy(); window.__g = ${GL}.create(Object.assign({ host: document.getElementById("host"),
    sources: () => [document.getElementById("plane")], cell: 5 }, ${opts})); !!window.__g`);
  const settle = () => page.evaluate(() => document.fonts.ready.then(() => new Promise((ok) => setTimeout(ok, 400))));
  const DX = 57;                                    // 0.38 of a frame, a whole number of device px (114)

  // 1. the plane itself, where the shots look
  await page.evaluate(() => moveTo(330, 150));
  await save("00-plane", await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 390 * 2; c.height = 300 * 2;
    c.getContext("2d").drawImage(document.getElementById("plane"), O.x, O.y, 390, 300, 0, 0, 780, 600); return c.toDataURL(); }));

  for (const [name, field, extra] of [["every", FIELDS.every, ""], ["motions", FIELDS.motions, ", region: { w: 130, h: 75 }"],
    ["poetry", FIELDS.poetry, ", text: (i, j) => ({ text: LINES[((i + 13 * j) % LINES.length + LINES.length) % LINES.length], at: 0 }), cell: 7"]]) {
    const region = extra.includes("region") ? "" : ", region: { w: " + FW + ", h: " + FH + " }";
    if (!(await make("NewGL", `{ origin: () => ({ x: O.x, y: O.y }), field: ${field}${region}${extra} }`))) throw new Error("create failed");
    await page.evaluate(() => moveTo(330, 150));
    await settle();
    const a = await page.evaluate(() => grab(window.__g));
    await save(`${name}-1-origin`, a);
    const aPx = await page.evaluate(() => Array.from(window.__last));
    await page.evaluate((dx) => moveTo(330 + dx, 150), DX);
    const b = await page.evaluate(() => grab(window.__g));
    await save(`${name}-2-moved-${DX}px`, b);
    report[name + " ride"] = await page.evaluate(([aPx, dx]) => ride(aPx, window.__last, window.__lw, window.__lh, dx, 150), [aPx, DX * DPR]);
    // a gutter, magnified (where frames 2|3 and 15|16 meet in the "every" field)
    await page.evaluate(() => moveTo(330, 150));
    await save(`${name}-3-gutter-x3`, await page.evaluate(() => grab(window.__g, 3, [ (450 - 330 - 50) * 2, 0, 200, 600 ])));
    report[name + " stats"] = await page.evaluate(() => window.__g.stats());
    report[name + " at"] = await page.evaluate(() => [window.__g.at(120, 60), window.__g.at(195, 60)]);
  }
  // the old engine, the same plane slid under its screen-fixed grid: how far its glyphs re-pick
  await make("OldGL", `{ style: "ascii", set: OldGL.SETS.fine }`);
  await page.evaluate(() => moveTo(330, 150)); await settle();
  await page.evaluate(() => grab(window.__g));
  let aPx = await page.evaluate(() => Array.from(window.__last));
  await page.evaluate((dx) => moveTo(330 + dx, 150), DX + 0.5);
  await page.evaluate(() => grab(window.__g));
  report["old engine ride (no origin)"] = await page.evaluate(([aPx, dx]) => ride(aPx, window.__last, window.__lw, window.__lh, dx, 150), [aPx, DX * DPR + 1]);
  // the new engine, origin only (no field), the same move
  await make("NewGL", `{ style: "ascii", set: NewGL.SETS.fine, origin: () => ({ x: O.x, y: O.y }), levels: "frozen" }`);
  await page.evaluate(() => moveTo(330, 150)); await settle();
  await save("origin-only-1", await page.evaluate(() => grab(window.__g)));
  aPx = await page.evaluate(() => Array.from(window.__last));
  await page.evaluate((dx) => moveTo(330 + dx, 150), DX + 0.5);
  await save("origin-only-2-moved", await page.evaluate(() => grab(window.__g)));
  report["new engine ride (origin, half-px move)"] = await page.evaluate(([aPx, dx]) => ride(aPx, window.__last, window.__lw, window.__lh, dx, 150), [aPx, DX * DPR + 1]);

  // the page's maps: tone and marks from canvases, in screen space; a letters map
  await make("NewGL", `(() => { const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const tone = mk(26, 20), marks = mk(26, 20), light = mk(26, 20), letters = mk(26, 20);
    const t = tone.getContext("2d"), mm = marks.getContext("2d"), l = light.getContext("2d"), lt = letters.getContext("2d");
    for (let y = 0; y < 20; y++) for (let x = 0; x < 26; x++) { const e = NewGL.encode({ exposure: (x - 13) / 8, contrast: 1.2, gamma: 1,
        style: x < 9 ? "ascii" : x < 18 ? "dots" : "text", set: y % 4 < 2 ? 0 : 1, level: (y >> 3) % 3, mode: y < 10 ? "full" : "gold", glow: 0.7, thresh: 0.6, under: 0 });
      t.fillStyle = "rgb(" + e.tone + ")"; t.fillRect(x, y, 1, 1); mm.fillStyle = "rgb(" + e.marks + ")"; mm.fillRect(x, y, 1, 1);
      l.fillStyle = "rgb(" + e.light + ")"; l.fillRect(x, y, 1, 1); lt.fillStyle = "rgb(" + ((x + y) % 5) + ",0,0)"; lt.fillRect(x, y, 1, 1); }
    window.__maps = { tone, marks, light, letters, space: "screen", rect: { x: 0, y: 0, w: 390, h: 300 } };
    return { sets: ["kana"], letters: "MAPS*", maps: window.__maps, levels: "frozen" }; })()`);
  await page.evaluate(() => moveTo(330, 150)); await settle();
  await save("maps-1", await page.evaluate(() => grab(window.__g)));
  report["maps at"] = await page.evaluate(() => [window.__g.at(20, 20), window.__g.at(300, 280)]);

  // the flash guard: the plane under the view flips from dark to bright every frame (about 8 Hz); with the guard the
  // overlay's light should stop swinging once it has swung more than twice in a second; without it, it swings on
  // (a small view, so SwiftShader keeps up with the flicker)
  await page.evaluate(() => { const h = document.getElementById("host"); h.style.width = "120px"; h.style.height = "100px"; });
  for (const guard of [false, true]) {
    await make("NewGL", `{ style: "ascii", guard: ${guard}, levels: "frozen", origin: () => ({ x: O.x, y: O.y }) }`);
    report["guard " + guard] = await page.evaluate(async () => {
      const c = document.getElementById("plane"), g = c.getContext("2d"), img = g.getImageData(300, 100, 500, 400);
      const gl = window.__g.canvas.getContext("webgl2"), px = new Uint8Array(120 * 120 * 4), seq = [];
      const t0 = performance.now(); let k = 0, most = 0;
      while (performance.now() - t0 < 3000) {
        g.fillStyle = k++ % 2 ? "#fff" : "#202020"; g.fillRect(300, 100, 500, 400);
        window.__g.frame();
        gl.readPixels(60, 40, 120, 120, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let s = 0; for (let i = 0; i < px.length; i += 4) s += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        seq.push(Math.round(s / (120 * 120)));
        most = Math.max(most, window.__g.stats().guarded);
        await new Promise((ok) => setTimeout(ok, 60));
      }
      g.putImageData(img, 300, 100);
      const st = window.__g.stats();
      let swings = 0; for (let i = 2; i < seq.length; i++) if ((seq[i] - seq[i - 1]) * (seq[i - 1] - seq[i - 2]) < 0 && Math.abs(seq[i] - seq[i - 1]) > 20) swings++;
      return { light: seq.join(" "), swings, perSecond: +(swings / 3).toFixed(1), mostHeld: most, guardEvents: st.guardEvents, frames: seq.length };
    });
  }
  await page.evaluate(() => { const h = document.getElementById("host"); h.style.width = ""; h.style.height = ""; });
  await page.evaluate(() => window.__g && window.__g.destroy());
  await browser.close();
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
  for (const [k, v] of Object.entries(report)) log(k, typeof v === "number" ? v.toFixed(4) : JSON.stringify(v).slice(0, 600));
  log(errors.length ? `${errors.length} page error(s)` : "no page errors");
  process.exit(errors.length ? 1 : 0);
}

// ---- cost ---------------------------------------------------------------------------------------------------------
async function cost(oldSpec, newSpec) {
  const OLD = source(oldSpec, "HEAD:dirt/engine/glyphlight.js"), NEW = source(newSpec, path.join(__dirname, "glyphlight.js"));
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 3 });
  page.setDefaultTimeout(900000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // the source has a small backing store, so drawing it small (read) costs little and the passes are what is timed
  await page.setContent(`<!doctype html><style>body{margin:0}#host{position:relative;width:390px;height:800px;overflow:hidden}#src{position:absolute;inset:0;width:100%;height:100%}</style>
    <div id=host><canvas id=src width=312 height=640></canvas></div>`);
  await page.addScriptTag({ content: PICTURE });
  await page.evaluate(async (ph) => window.drawPicture(document.getElementById("src"), ph, 5), photo());
  await page.addScriptTag({ content: OLD + "\n;window.OldGL = window.GlyphLight;" });
  await page.addScriptTag({ content: NEW + "\n;window.NewGL = window.GlyphLight;" });
  // pairs timed frame by frame in turn (old, new, old, new ...), so the machine's drift falls on both alike
  const pairs = [
    ["DRIFT (ascii, fine, cell 5)", `{ style: "ascii", set: GL.SETS.fine }`, `{ style: "ascii", set: GL.SETS.fine }`],
    ["detail 1", `{ style: "ascii", set: GL.SETS.fine, detail: 1 }`, `{ style: "ascii", set: GL.SETS.fine, detail: 1 }`],
    ["DRIFT Poetry (text, cell 7)", `{ style: "text", text: ${JSON.stringify(POEM)}, cell: 7 }`, `{ style: "text", text: ${JSON.stringify(POEM)}, cell: 7 }`],
    ["dots, glow 0", `{ style: "dots", glow: 0 }`, `{ style: "dots", glow: 0 }`],
    ["old DRIFT : new field, one level in view", `{ style: "ascii", set: GL.SETS.fine }`,
      `{ origin: () => ({ x: 1000, y: 500 }), region: { w: 130, h: 200 }, field: (i, j) => ({ style: ["ascii", "dots", "scan"][((i % 3) + 3) % 3], set: "fine", glow: 0.4 + 0.1 * (i % 4), mode: ["full", "gold"][((i % 2) + 2) % 2] }) }`],
    ["old DRIFT : new field, levels 0, 1, 2 in view", `{ style: "ascii", set: GL.SETS.fine }`,
      `{ origin: () => ({ x: 1000, y: 500 }), region: { w: 130, h: 200 }, field: (i, j) => Object.assign({ set: "fine" }, GL.motions.push(((i % 3) + 3) % 3 / 3 + 0.17)) }`],
    ["old DRIFT : new field + guard", `{ style: "ascii", set: GL.SETS.fine }`, `{ guard: true, origin: () => ({ x: 1000, y: 500 }), region: { w: 130, h: 200 }, field: (i, j) => ({ set: "fine", glow: 0.5 }) }`],
  ];
  for (const [name, oo, no] of pairs) {
    const r = await page.evaluate(async ([oo, no]) => {
      const mk = (GL, opts) => GL.create(Object.assign({ host: document.getElementById("host"), sources: () => [document.getElementById("src")], cell: 5 }, (new Function("GL", "return " + opts))(GL)));
      const a = mk(window.OldGL, oo), b = mk(window.NewGL, no);
      await document.fonts.ready; await new Promise((ok) => setTimeout(ok, 300));
      const one = new Uint8Array(4), ta = [], tb = [];
      const time = (g, out) => { const gl = g.canvas.getContext("webgl2"); const t0 = performance.now(); g.frame(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); out.push(performance.now() - t0); };
      time(a, []); time(b, []);
      for (let i = 0; i < 9; i++) { time(a, ta); time(b, tb); }
      const w = a.canvas.width, h = a.canvas.height, sb = b.stats();
      a.destroy(); b.destroy();
      const med = (t) => t.slice().sort((x, y) => x - y)[t.length >> 1];
      return { a: med(ta), b: med(tb), amin: Math.min(...ta), bmin: Math.min(...tb), w, h, levels: sb.levels };
    }, [oo, no]);
    log(name.padEnd(46), `${r.w}x${r.h}`, `old median ${r.a.toFixed(0)} ms (min ${r.amin.toFixed(0)})`, `new median ${r.b.toFixed(0)} ms (min ${r.bmin.toFixed(0)})`,
      `new/old ${(r.b / r.a).toFixed(2)}`, `levels ${r.levels}`);
  }
  await browser.close();
  log(errors.length ? `${errors.length} page error(s): ${errors.join(" | ").slice(0, 600)}` : "no page errors");
  process.exit(errors.length ? 1 : 0);
}

(cmd === "compat" ? compat(args[0], args[1]) : cmd === "shots" ? shots(args[0], args[1]) : cmd === "cost" ? cost(args[0], args[1])
  : Promise.reject(new Error("usage: check_glyphlight.js compat [OLD] [NEW] | shots OUTDIR [NEW] | cost [OLD] [NEW]")))
  .catch((e) => { console.error(e); process.exit(2); });

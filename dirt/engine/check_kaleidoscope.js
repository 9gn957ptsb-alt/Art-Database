/* Checks for a change to DRIFT's engine (dirt/KALEIDOSCOPE.md): every program it compiles, in both builds, and shots.

     NODE_PATH=$(npm root -g) node dirt/engine/check_kaleidoscope.js compile [ENGINE]
     NODE_PATH=$(npm root -g) node dirt/engine/check_kaleidoscope.js shoot SITE PAGE OUT HASH WxHxDPR PLACES [SETTLE_MS]

   compile links the ten programs setup() makes, with WORDS 0 (DRIFT) and 1 (DRIFT Poetry), on SwiftShader, and exits 1
   if any fails. shoot serves SITE (DRIFT's page as PAGE, with its quilts/, antiquity/, faces/ and plane/ beside it, read
   back from the artifact), opens PAGE + HASH ("#forcegl&tier2", and "&nokal=name" for the shot without a kaleidoscope)
   at that size, and for each place [x, y, "name"] (cells, the view's middle; PLACES is JSON, or a page expression that
   returns the list) waits for the ground and writes OUT-name.png. A headless shot shows that it compiles and draws;
   only a real GPU says how fast. */
"use strict";
const fs = require("fs"), http = require("http"), path = require("path");
const { chromium } = require("playwright");
const [cmd, ...args] = process.argv.slice(2);
const T0 = Date.now(), log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0) + "s", ...a);
const launch = () => chromium.launch({ args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });

async function compile(enginePath) {
  const engine = fs.readFileSync(enginePath || path.join(__dirname, "ground-gl.js"), "utf8");
  const browser = await launch();
  let bad = 0;
  for (const words of [false, true]) {
    const page = await browser.newPage();
    page.setDefaultTimeout(600000);
    await page.setContent(`<canvas id=c></canvas><script>var FIELD_K = 0.381966011250105; ${words ? "window.DRIFT_WORDS = true;" : ""}</script>`);
    await page.addScriptTag({ content: engine + `\n;window.__P = { W: WORDS, VS: GROUND_VS, a: GROUND_FS, b: GROUND_PX_USED, c: lettered(GROUND_FORMAL),
      d: lettered(GROUND_DEPTH), e: lettered(GROUND_LIGHT), f: lettered(GROUND_SPACE), g: lettered(GROUND_CANOPY),
      h: lettered(GROUND_COLLAGE), i: lettered(GROUND_TOYS), j: GROUND_MINIMAL };` });
    const r = await page.evaluate(() => {
      const gl = document.getElementById("c").getContext("webgl2"), P = window.__P, out = {};
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      for (const k of "abcdefghij") {
        const vs = sh(gl.VERTEX_SHADER, P.VS), fs = sh(gl.FRAGMENT_SHADER, P[k].replace("#version 300 es\n", "#version 300 es\n#define WORDS " + P.W + "\n"));
        const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
        out[k] = gl.getProgramParameter(pr, gl.LINK_STATUS) ? "ok" : (gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(pr)).slice(0, 1200);
      }
      return out;
    });
    for (const [k, v] of Object.entries(r)) if (v !== "ok") { bad++; console.log(`WORDS ${+words} program ${k}: ${v}`); }
    console.log(`WORDS ${+words}: ${Object.values(r).filter((v) => v === "ok").length} of 10 programs link`);
    await page.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
}

async function shoot(site, pageName, out, hash, size, places, settle) {
  const root = path.resolve(site), [W, H, dpr] = size.split("x").map(Number);
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || pageName);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".json") ? "application/json" : "image/jpeg" }); res.end(d); });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr || 1 });
  page.setDefaultTimeout(900000);
  const errors = [];
  page.on("pageerror", (e) => { errors.push(e.message); log("PAGE ERROR", e.message.slice(0, 400)); });
  page.on("console", (m) => { if (/shader/i.test(m.text())) { errors.push(m.text()); log("console", m.text().slice(0, 1200)); } });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}${hash}`, { waitUntil: "load" });
  await page.waitForFunction(() => typeof GLG !== "undefined" && GLG && chunks.size > 0, null, { polling: 2000 });
  if (/nogl/.test(await page.evaluate(() => location.hash))) errors.push("the engine fell back to #nogl");
  const list = places.trim().startsWith("[") ? JSON.parse(places) : await page.evaluate(places);
  for (const [x, y, name] of list) {
    await page.evaluate(([x, y]) => { vx = x - VW / 2; vy = y - VH / 2; velX = velY = 0; }, [x, y]);
    await page.waitForFunction(() => { for (let j = Math.floor(vy / N); j <= Math.floor((vy + VH) / N); j++) for (let i = Math.floor(vx / N); i <= Math.floor((vx + VW) / N); i++) { const c = chunks.get(ck(i, j)); if (!c || !c.cells) return false; } return true; }, null, { polling: 2000 });
    await new Promise((ok) => setTimeout(ok, +(settle || 25000)));
    await page.screenshot({ path: `${out}-${name}.png` });
    log("shot", name, Math.round(x), Math.round(y), "tier", await page.evaluate(() => TIER.n));
  }
  log(errors.length ? `${errors.length} errors` : "no page errors");
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
}

(cmd === "compile" ? compile(args[0]) : cmd === "shoot" ? shoot(...args) : Promise.reject(new Error("compile or shoot")))
  .catch((e) => { console.error(e.message); process.exit(2); });

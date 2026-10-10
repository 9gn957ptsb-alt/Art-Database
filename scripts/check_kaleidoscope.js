// Frames of a kaleidoscope on the Artist Website, with the page's clock slowed so each held frame can be seen.
//
//   python3 -m http.server 8863 --directory docs &      (serve the site first)
//   NODE_PATH=$(npm root -g) node scripts/check_kaleidoscope.js --port 8863 --out <dir> [--work <id>] [--arrival kaleidoscope] [--slow 0.08]
//
// Opens /v2/ at 390x844 (touch, 3x) and 1440x900 (2x), makes the next photograph to arrive come by the arrival
// named (Land.arrival), opens the work (Land.work) and photographs the art plate's veil every moment it is
// there, the page's clock running at `slow` of real time (performance.now and requestAnimationFrame, wrapped
// before the page loads). The work's picture is fetched from Artsy's CDN with curl, through the session's
// proxy (headless Chromium does not use it), and served to the page in its place. Writes <w>-<n>-<ms>.png
// (ms of page time since the veil appeared) and <w>-after.png; exits 1 on a page error or no frame.
// docs/v2/KALEIDOSCOPE.md: a new kaleidoscope adds its own way of being seen here.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const PORT = arg("port", "8863");
const OUT = arg("out", fs.mkdtempSync(path.join(os.tmpdir(), "kal-")));
const WORK = arg("work", "4f9bcc20aa99be0001000727");          // Monet, The Japanese Footbridge (NGA)
const ARRIVAL = arg("arrival", "kaleidoscope");
const SLOW = parseFloat(arg("slow", "0.08"));
const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
const ROOT = path.join(__dirname, "..");

function picture() {
  const h = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/v2/histories", WORK + ".json"), "utf8"));
  if (!h.image) { throw new Error("work " + WORK + " has no image"); }
  const file = path.join(OUT, "work.jpg");
  execFileSync("curl", ["-sS", "--max-time", "60", "-o", file, "https://d32dm0rphc51dk.cloudfront.net/" + h.image + "/large.jpg"]);
  return fs.readFileSync(file);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jpg = picture();
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  let bad = 0;
  for (const [w, h, touch, dsf] of [[390, 844, true, 3], [1440, 900, false, 2]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => {
      const realNow = performance.now.bind(performance);
      let base = 0, realBase = 0, f = 1;
      const virt = () => base + (realNow() - realBase) * f;
      window.__setSlow = k => { base = virt(); realBase = realNow(); f = k; };
      performance.now = virt;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = cb => raf(() => cb(virt()));
    });
    await page.route(/d32dm0rphc51dk\.cloudfront\.net/, r => r.fulfill({ status: 200, contentType: "image/jpeg", body: jpg }));
    await page.route(/nasa\.gov|metmuseum|artic\.edu|clevelandart|smk\.dk|wikidata|wikimedia|fonts\.(googleapis|gstatic)/, r => r.abort());
    await page.goto(`http://localhost:${PORT}/v2/`, { waitUntil: "load" });
    await page.waitForFunction(() => document.getElementById("land").dataset.at === "globe", null, { timeout: 60000 });
    const names = await page.evaluate(a => { Land.pace(false); return Land.arrival(a); }, ARRIVAL);
    if (!names.includes(ARRIVAL)) { console.log(w, "no arrival named", ARRIVAL, "among", names.join(", ")); bad += 1; await ctx.close(); continue; }
    await page.evaluate(id => Land.work(id), WORK);
    await page.waitForFunction(() => { const x = Land.where(); return x.at === "work" && !x.flying; }, null, { timeout: 30000 });
    await page.evaluate(k => window.__setSlow(k), SLOW);
    await page.waitForFunction(() => !!document.querySelector("#art-plate .deal-veil"), null, { timeout: 20000 }).catch(() => {});
    const t0 = await page.evaluate(() => performance.now());
    let n = 0;
    while (n < 80) {
      const s = await page.evaluate(() => {
        const v = document.querySelector("#art-plate .deal-veil");
        if (!v) { return null; }
        const r = v.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, t: performance.now() };
      });
      if (!s) { break; }
      await page.screenshot({ path: path.join(OUT, `${w}-${String(n).padStart(2, "0")}-${Math.round(s.t - t0)}.png`),
                              clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.w, w), height: Math.min(s.h, h) } });
      n += 1;
    }
    await page.evaluate(() => window.__setSlow(1));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${w}-after.png`) });
    console.log(w, "frames:", n, "errors:", errors.length ? errors.slice(0, 3) : "none");
    if (errors.length || !n) { bad += 1; }
    await ctx.close();
  }
  await browser.close();
  console.log("frames in", OUT);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

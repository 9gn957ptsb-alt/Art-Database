// pb_aspect.js - every aspect ratio YouTube names, in one session (28 Oct 2026; the design rule: "be playable in all
// aspect ratios and adjust automatically when the viewport changes. Non-exhaustive examples: 9:32, 9:21, 9:16, 3:4, 1:1,
// 4:3, 16:9, 21:9, 32:9", and keep the game's state when the window is resized). Each ratio at its long side 1280 and
// at its smallest real screen (a phone's short side, 360, for 9:16 and narrower or 16:9 and wider; 600 for the near
// squares, 3:4 to 4:3, which are tablets, folding phones and windows): the canvas fills it at the screen's pixels,
// nothing is lost, and no word, button or the serve's bar covers another or leaves the screen; walking, on a court,
// and at the serve. node pb_aspect.js outdir [port]
const { chromium } = require("playwright");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const R = [[9, 32], [9, 21], [9, 16], [3, 4], [1, 1], [4, 3], [16, 9], [21, 9], [32, 9]], bad = [];
const check = (ok, what) => { if (!ok) { bad.push(what); console.log("FAIL " + what); } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
  for (const where of ["walk", "court", "serve"]) {
    if (where === "court") { await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.5); }); }
    if (where === "serve") { await p.evaluate(() => { const d = window.Pickleball.debug(); d.toServe(); d.run(0.3); }); }
    await p.evaluate(() => window.Pickleball.debug().pause(true));
    const st0 = await p.evaluate(() => { const d = window.Pickleball.debug(); return JSON.stringify([d.me.x, d.me.z, d.court.m && d.court.m.k, d.courts.map((c) => c.level)]); });
    for (const [a, c] of R) {
      for (const size of ["long1280", "small"]) {
        const short = Math.max(a, c) / Math.min(a, c) < 16 / 9 ? 600 : 360;
        const k = size === "long1280" ? 1280 / Math.max(a, c) : short / Math.min(a, c), w = Math.round(a * k), h = Math.round(c * k), tag = `${where} ${a}:${c} ${w}x${h}`;
        await p.setViewportSize({ width: w, height: h });
        await p.waitForTimeout(80);
        const r = await p.evaluate(() => {
          const d = window.Pickleball.debug(); d.draw(); d.draw();   // (twice: the bar sits under the HUD as the last frame drew it)
          const box = (el) => { if (!el || getComputedStyle(el).display === "none" || el.hidden || el.style.opacity === "0" || !el.textContent.trim() && el.tagName !== "BUTTON") { return null; } const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height, n: el.id || el.className }; };
          const v = document.getElementById("view"), top = document.querySelector(".top");
          const whereT = document.getElementById("where"), range = document.createRange(); range.selectNodeContents(whereT); const wr = range.getBoundingClientRect();
          const sz = Math.min(22, (innerWidth - 24 - 45) / 10), y0 = top.getBoundingClientRect().bottom + 8;
          const strip = { x: 12, y: y0, w: Math.min(10, d.courts.length) * (sz + 5), h: sz, n: "strip" }, words = { x: wr.left, y: wr.top, w: wr.width, h: wr.height, n: "where" };
          const boxes = [words, strip, box(document.getElementById("say")), box(document.getElementById("super")), d.hud().meter && Object.assign({ n: "the serve's bar" }, d.hud().meter), d.hud().reticle && Object.assign({ n: "the Scope's mark" }, d.hud().reticle)].filter(Boolean);
          return { cw: v.width, ch: v.height, ew: Math.round(v.clientWidth * Math.min(3, devicePixelRatio)), eh: Math.round(v.clientHeight * Math.min(3, devicePixelRatio)), W: innerWidth, H: innerHeight, boxes,
                   st: JSON.stringify([d.me.x, d.me.z, d.court.m && d.court.m.k, d.courts.map((c) => c.level)]) };
        });
        check(r.cw === r.ew && r.ch === r.eh, `${tag}: the canvas fills it at the screen's pixels (${r.cw}x${r.ch}, wanted ${r.ew}x${r.eh})`);
        check(r.st === st0, `${tag}: the state kept through the resize`);
        r.boxes.forEach((q) => check(q.x >= 0 && q.y >= 0 && q.x + q.w <= r.W + 0.5 && q.y + q.h <= r.H + 0.5, `${tag}: ${q.n} inside the screen ${JSON.stringify(q)}`));
        for (let i = 0; i < r.boxes.length; i++) { for (let j = i + 1; j < r.boxes.length; j++) { const A = r.boxes[i], B = r.boxes[j];
          if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) { check(false, `${tag}: ${A.n} and ${B.n} overlap`); } } }
        if (["9:32", "1:1", "32:9", "16:9"].includes(`${a}:${c}`) && size === "small") { await p.screenshot({ path: `${out}/${where}_${a}x${c}.png` }); }
      }
    }
    await p.evaluate(() => window.Pickleball.debug().pause(false));
  }
  check(errs.length === 0, "no errors: " + errs.slice(0, 2).join(" | "));
  await b.close();
  console.log(bad.length ? bad.length + " FAILED" : "all ok: nine ratios, two sizes, walking, on a court and at the serve");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

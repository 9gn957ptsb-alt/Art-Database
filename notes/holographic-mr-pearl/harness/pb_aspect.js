// pb_aspect.js - every aspect ratio YouTube names, in one session (28 Oct 2026; the design rule: "be playable in all
// aspect ratios and adjust automatically when the viewport changes. Non-exhaustive examples: 9:32, 9:21, 9:16, 3:4, 1:1,
// 4:3, 16:9, 21:9, 32:9", and keep the game's state when the window is resized). Each ratio at its long side 1280 and
// at its smallest real screen (a phone's short side, 360, for 9:16 and narrower or 16:9 and wider; 600 for the near
// squares, 3:4 to 4:3, which are tablets, folding phones and windows): the canvas fills it at the screen's pixels,
// nothing is lost, and no word, button or the serve's bar covers another or leaves the screen; walking, on a court,
// at the serve, and in Mr Plan's super (its banner clear of the counter's bar). node pb_aspect.js outdir [port]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const R = [[9, 32], [9, 21], [9, 16], [3, 4], [1, 1], [4, 3], [16, 9], [21, 9], [32, 9]], bad = [];
const check = (ok, what) => { if (!ok) { bad.push(what); console.log("FAIL " + what); } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
  for (const where of ["walk", "court", "serve", "plansuper"]) {
    if (where === "court") { await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.5); }); }
    if (where === "serve") { await p.evaluate(() => { const d = window.Pickleball.debug(); d.toServe(); d.run(0.3); }); }
    // (Mr Plan's super, just struck: its banner and the counter's bar both up; the game paused there)
    if (where === "plansuper") { const ok = await p.evaluate(() => { const d = window.Pickleball.debug(), C = d.COURT, me = d.me; d.pause(true); d.PSUP.P0 = d.PSUP.P1 = 1; let lastFire = -99;
      for (let i = 0; i < 60 * 60; i++) { const m = d.court.m; if (!m) { return false; } if (m.phase === "plansuper" && m.psup.struck) { d.run(0.15); return true; }
        let tx = 0.6, tz = C.L - 1.2; if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 1)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
        const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
        const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz); d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
        const u = d.meter(), fire = m.phase !== "plansuper" && u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 1 && i - lastFire > 12; if (fire) { lastFire = i; } d.run(1 / 60, fire); }
      return false; }); check(ok, "Mr Plan's super reached"); }
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
          // (no words at the top now: the courts' squares are the top, the box the HUD drew them in)
          const v = document.getElementById("view");
          // (the numbers' buttons, a finger's height over the squares: one box round them all, when they are there to tap)
          const cb = [...document.querySelectorAll("#courts button")].map((e) => e.getBoundingClientRect()), cv = getComputedStyle(document.getElementById("courts")).visibility !== "hidden";
          const taps = cv && cb.length ? { x: Math.min(...cb.map((q) => q.left)), y: Math.min(...cb.map((q) => q.top)), w: Math.max(...cb.map((q) => q.right)) - Math.min(...cb.map((q) => q.left)), h: Math.max(...cb.map((q) => q.bottom)) - Math.min(...cb.map((q) => q.top)), n: "the courts' buttons" } : null;
          const strip = Object.assign({ n: "strip" }, d.hud().strip);
          const boxes = [strip, taps, box(document.getElementById("say")), box(document.getElementById("help")), box(document.getElementById("super")), d.hud().meter && Object.assign({ n: "the serve's bar" }, d.hud().meter), d.hud().reticle && Object.assign({ n: "the Scope's mark" }, d.hud().reticle), d.hud().banner && d.hud().banner.w && Object.assign({ n: "the SUPER banner" }, d.hud().banner)].filter(Boolean);
          return { cw: v.width, ch: v.height, ew: Math.round(v.clientWidth * Math.min(3, devicePixelRatio)), eh: Math.round(v.clientHeight * Math.min(3, devicePixelRatio)), W: innerWidth, H: innerHeight, boxes,
                   st: JSON.stringify([d.me.x, d.me.z, d.court.m && d.court.m.k, d.courts.map((c) => c.level)]) };
        });
        check(r.cw === r.ew && r.ch === r.eh, `${tag}: the canvas fills it at the screen's pixels (${r.cw}x${r.ch}, wanted ${r.ew}x${r.eh})`);
        check(r.st === st0, `${tag}: the state kept through the resize`);
        r.boxes.forEach((q) => check(q.x >= 0 && q.y >= 0 && q.x + q.w <= r.W + 0.5 && q.y + q.h <= r.H + 0.5, `${tag}: ${q.n} inside the screen ${JSON.stringify(q)}`));
        for (let i = 0; i < r.boxes.length; i++) { for (let j = i + 1; j < r.boxes.length; j++) { const A = r.boxes[i], B = r.boxes[j];
          // (the buttons lie over the squares they name: that pair is meant to overlap)
          if ([A.n, B.n].includes("strip") && [A.n, B.n].includes("the courts' buttons")) { continue; }
          if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) { check(false, `${tag}: ${A.n} and ${B.n} overlap`); } } }
        if (["9:32", "1:1", "32:9", "16:9"].includes(`${a}:${c}`) && size === "small") { await p.screenshot({ path: `${out}/${where}_${a}x${c}.png` }); }
      }
    }
    if (where !== "plansuper") { await p.evaluate(() => window.Pickleball.debug().pause(false)); }
  }
  // ten squares, twenty courts won: in a match on the phones where a row of 28 px squares reached the Super (430 wide)
  // and the narrowest (9:32), the squares short of the Super and the words under it; between matches the words under
  // the numbers' buttons (48 px tall), on every phone
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 20, tut: 1 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.pause(true); d.enter(20); d.run(0.5); });
  for (const match of [true, false]) {
    if (!match) { await p.evaluate(() => { const d = window.Pickleball.debug(); d.winCourt(); d.run(0.5); }); }
    for (const [w, h] of [[430, 932], [390, 844], [360, 1280], [300, 1067]]) {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(60);
      const r = await p.evaluate(() => {
        const d = window.Pickleball.debug(); d.draw(); d.draw();
        const st = d.hud().strip, su = document.getElementById("super"), sb = su.getBoundingClientRect(), shown = getComputedStyle(su).display !== "none";
        const bt = [...document.querySelectorAll("#courts button")].map((e) => e.getBoundingClientRect()), taps = getComputedStyle(document.getElementById("courts")).visibility !== "hidden";
        return { n: d.court.m ? 1 : 0, squares: Math.round((st.w + 5) / (st.h + 5)), strip: st, sup: shown ? { x: sb.left, bottom: sb.bottom } : null, sayTop: parseFloat(document.getElementById("say").style.top), btnBottom: taps && bt.length ? Math.max(...bt.map((q) => q.bottom)) : 0, W: innerWidth };
      });
      const tag = `${match ? "in a match" : "between matches"} ${w}x${h}`;
      // (between matches ten; in a match beside the Super as many as fit, each wide enough for its two digits)
      check((match ? r.squares >= 1 && r.squares <= 10 && r.strip.h >= 20 : r.squares === 10) && r.strip.x + r.strip.w <= r.W, `${tag}: ${r.squares} squares of ${Math.round(r.strip.h)} px inside the screen ${JSON.stringify(r.strip)}`);
      if (match) { check(!!r.sup && r.strip.x + r.strip.w <= r.sup.x && r.sayTop >= r.sup.bottom, `${tag}: the squares short of the Super, the words under it ${JSON.stringify(r)}`); }
      else { check(r.btnBottom > 0 && r.sayTop >= r.btnBottom, `${tag}: the words under the numbers' buttons ${JSON.stringify(r)}`); }
    }
  }
  check(errs.length === 0, "no errors: " + errs.slice(0, 2).join(" | "));
  await b.close();
  console.log(bad.length ? bad.length + " FAILED" : "all ok: nine ratios, two sizes, walking, on a court, at the serve and in Mr Plan's super; the courts' squares in a match and between, on four phones");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

// pb_game.js - the pickleball game on its own (28 Oct 2026): boots clean, the ASCII set is the prescription, a bot
// plays court one (it runs Mr Pearl at the ring where Mr Plan's shot comes down, and serves), the rules hold, the
// athletes move as athletes (speeds, split-steps, lunges, dives, leaps), and screenshots for the eye.
// node pb_game.js phone|desk outdir [port] [url]
const { chromium } = require("playwright");
const fs = require("fs");
const [view, out, port, url] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const V = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
            desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } }[view];
const bad = [];
const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } };
(async () => {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage(V), errors = [], hosts = new Set();
  page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); } });
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  await page.goto(url || `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await page.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (fn, a) => page.evaluate(fn, a);
  const g = await D(() => window.Pickleball.debug().glyphs);
  check(!!g && [..." .:-=+*#%@∴∵→○◇△◎¶▢◆"].every((c) => g.includes(c)) && g[0] === " ", "the glyph set is the keyboard's and the marks, sorted by ink, blank first: " + JSON.stringify(g));
  check(await D(() => window.Pickleball.debug().ascOk()), "the ASCII pass is on");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/01_start.png` });
  // the bot: court one; between his strokes he runs at the ring (or the middle of his baseline), and serves
  const res = await D(() => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me, log = { points: [], hits: [], maxMe: 0, maxPlan: 0, moves: {}, splits: 0, kitchenVolleys: 0, serves: 0 };
    d.enter(0); d.run(0.2);
    let lastRally = 0, wasAir = false;
    for (let i = 0; i < 60 * 90 && log.points.length < 12; i++) {
      const m = d.court.m;
      if (!m) { break; }
      let tx = 0.6, tz = C.L - 1.2;
      if (m.mark && m.ball && m.ball.last === "them") { tx = m.mark.x - 0.5; tz = m.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.2 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 2), dy: dz / L * 60 * Math.min(1, L / 2) } : null;
      d.run(1 / 60, m.phase === "serve" && i % 30 === 0);
      const m2 = d.court.m;
      if (!m2) { break; }
      if (m2.rally !== lastRally && m2.ball) { log.hits.push({ by: m2.ball.last, at: [m2.ball.x, m2.ball.y, m2.ball.z].map((v) => +v.toFixed(2)) }); if (m2.ball.last === "you" && m2.rally > 3 && Math.abs(me.z) < C.K && m2.ball.bounces === 0) { log.kitchenVolleys++; } lastRally = m2.rally; }
      if (m2.phase === "point" && log.points[log.points.length - 1] !== m2.you + ":" + m2.them) { log.points.push(m2.you + ":" + m2.them); }
      log.maxMe = Math.max(log.maxMe, me.speed); log.maxPlan = Math.max(log.maxPlan, d.plans[0].speed);
      [me, d.plans[0]].forEach((a) => { if (a.move && !a.move.seen) { a.move.seen = 1; log.moves[a.move.reach + "/" + a.move.kind] = (log.moves[a.move.reach + "/" + a.move.kind] || 0) + 1; } });
      const air = d.plans[0].hop; if (air && !wasAir) { log.splits++; } wasAir = air;
      if (Object.values(me).some((v) => typeof v === "number" && !isFinite(v))) { log.nan = true; break; }
    }
    d.input.stick = null;
    log.score = d.court.m ? [d.court.m.you, d.court.m.them] : "level won";
    log.best = d.courts.best; log.won = d.courts[0].won;
    return log;
  });
  console.log(JSON.stringify(res));
  check(!res.nan, "no NaN in his state");
  check(res.points.length >= 3, "points were played: " + res.points.join(" "));
  check(res.hits.length >= 6, "strokes on both sides: " + res.hits.length);
  check(res.maxMe > 8 && res.maxPlan > 6, "they move like athletes: Mr Pearl " + res.maxMe.toFixed(1) + " m/s, Mr Plan " + res.maxPlan.toFixed(1) + " m/s");
  check(res.splits >= 2, "Mr Plan split-steps at Mr Pearl's strokes: " + res.splits);
  check(res.kitchenVolleys === 0, "no volley from the kitchen");
  // pictures: a rally, the athletes close, the Scope
  const shot = async (name, setup) => { await D(setup); await D(() => window.Pickleball.debug().draw()); await page.screenshot({ path: `${out}/${name}.png` }); };
  await shot("02_now", () => {});
  await D(() => { const d = window.Pickleball.debug(); if (!d.court.m) { d.enter(1); d.run(0.3); } d.run(1.5, true); });
  await shot("03_rally_a", () => window.Pickleball.debug().run(0.45));
  await shot("03_rally_b", () => window.Pickleball.debug().run(0.35));
  await shot("03_rally_c", () => window.Pickleball.debug().run(0.35));
  const hasGlyphs = await page.evaluate(() => {
    window.Pickleball.debug().draw(); const c = document.getElementById("view"), g = c.getContext("webgl2"), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    let black = 0; for (let i = 0; i < px.length; i += 4) { if (px[i] + px[i + 1] + px[i + 2] < 24) { black++; } }
    return black / (w * h);
  });
  check(hasGlyphs > 0.25, "the frame is characters on black (black share " + hasGlyphs.toFixed(2) + ")");
  await D(() => { const d = window.Pickleball.debug(); d.view.scope = false; });
  await page.keyboard.press("r"); await D(() => window.Pickleball.debug().run(0.5));
  await shot("05_scope", () => {});
  check(errors.length === 0, "no errors: " + errors.slice(0, 3).join(" | "));
  check([...hosts].every((h) => h.startsWith("127.0.0.1")), "no request leaves the page's host: " + [...hosts].join(" "));
  await browser.close();
  console.log(bad.length ? `${bad.length} FAILED` : "all ok");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

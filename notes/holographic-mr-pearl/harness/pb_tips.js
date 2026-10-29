// pb_tips.js - how to play, at its moments (the artist, 28 Oct 2026: "I want the how to to be pop-ups that happen when
// you're walking through that are cued by certain moments"), shown on the things themselves, not in a card (29 Oct 2026:
// "I don't like this chat box for the method of showing users how to play. I want a more interactive learning experience
// for users"). Past the walk-through: from the start, the ghost of the stick (on a desk the keys, Shift to run), gone
// once he moves; walking about, a trail to the open court and "← or tap" by its square; onto the court, the trail to the
// gold circle; on the mark, the ghost tap under the bar; after the first pearl, "again"; Mr Plan's first return, "get
// here" and the trail. Each once, one at a time, its sentence for a screen reader only, every word inside the screen and
// clear of the controls; kept with the save, so after a reload none comes back.
// node pb_tips.js outdir [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port, kind] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const desk = kind === "desk";
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(desk ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  // the cue drawn now, the screen reader's sentence and its box, and any word not clear (of the screen's edge, the
  // Super and 6 px round it, the squares, Mr Plan's banner)
  const tip = () => p.evaluate(() => {
    const d = window.Pickleball.debug(); d.draw();
    const q = d.hud().cue || {}, e = document.getElementById("help"), r = e.getBoundingClientRect(), sr = document.getElementById("super").getBoundingClientRect(), st = d.hud().strip, W = innerWidth, H = innerHeight;
    const meets = (A, B) => !!A && !!B && A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h, sup = sr.width ? { x: sr.left - 6, y: sr.top - 6, w: sr.width + 12, h: sr.height + 12 } : null;
    const off = (q.items || []).filter((it) => it.what !== "pop" && (it.x < 11.5 || it.y < 11.5 || it.x + it.w > W - 11.5 || it.y + it.h > H - 11.5 || meets(it, sup) || meets(it, st) || meets(it, d.hud().banner))).map((it) => it.what);
    return { key: q.key, ghost: q.ghost, items: (q.items || []).map((x) => x.what + ":" + x.t), keys: (q.keys || []).map((k) => k.ch), trail: q.trail, ready: q.ready,
             text: e.textContent, sr: r.width <= 1.5 && r.height <= 1.5, off, meter: d.hud().meter };
  });
  const has = (t, what) => t.items.some((x) => x.split(":")[0] === what);
  const step = (sec, stick) => p.evaluate(({ sec, stick }) => { const d = window.Pickleball.debug(); d.pause(true); d.input.stick = stick ? { id: -1, x: 0, y: 0, dx: stick[0], dy: stick[1] } : null; d.run(sec); d.input.stick = null; }, { sec, stick });
  await step(0.5);
  let t = await tip();
  check(t.key === "move" && /Move/.test(t.text) && t.sr && t.ghost && t.ghost.dy < -0.99 && (desk ? t.keys.includes("W") && t.keys.includes("shift") && has(t, "run") : has(t, "drag")) && !t.off.length,
        `at the start: ${desk ? "W A S D, W the way, Shift to run" : "the ghost of the stick pushing up, \"drag\""}; its sentence for a screen reader only (${t.text.slice(0, 40)}) ${t.off.join(" ")}`);
  await p.screenshot({ path: `${out}/1_move.png` });
  await step(0.6, [60, 0]); await step(1.5);
  t = await tip(); check(t.key !== "move", "gone once he moves");
  await step(6);
  t = await tip();
  check(t.key === "court" && has(t, "go") && t.trail && t.trail.n > 0 && /open court/.test(t.text) && t.sr && !t.off.length, `walking about: the trail to the open court, "${desk ? "← or click" : "← or tap"}" by its square (${t.items.join(", ")}) ${t.off.join(" ")}`);
  await p.screenshot({ path: `${out}/2_court.png` });
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(1.6); });
  t = await tip(); check(t.key === "serve" && has(t, "here") && t.trail && t.trail.n > 0 && !t.off.length, `onto the court: "serve here" and the trail to it (${t.items.join(", ")})`);
  await p.screenshot({ path: `${out}/3_serve.png` });
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.toServe(); d.run(1.5); });
  t = await tip();
  check(t.key === "bar" && t.ghost && t.ghost.tap && t.meter && t.ghost.y > t.meter.y0 && (desk ? t.keys.includes("space") : has(t, "tap")) && !t.off.length, `on the mark: the ghost tap under the bar (${desk ? "the space key" : "\"tap\""})`);
  await p.screenshot({ path: `${out}/4_bar.png` });
  // the first pearl: the bar's tip done, "again" for the second; the second: "again" done
  const served = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 300; i++) { const u = d.meter(); if (u != null && u > 0.5 && u < 0.66) { d.draw(); d.run(1 / 60, true); break; } d.run(1 / 60); } d.run(0.4); return d.court.m.served + d.court.m.tosses.length; });
  t = await tip();
  check(served === 1 && t.key === "pearls" && (desk ? t.keys.includes("space") : t.items.includes("tap:again")) && t.ghost && t.ghost.tap && /2nd and a 3rd/.test(t.text), `the first pearl: the bar's tip done, "again" for a second (${t.items.join(", ")})`);
  await p.screenshot({ path: `${out}/5_again.png` });
  const two = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 300; i++) { const u = d.meter(); if (u != null && u > 0.5 && u < 0.66 && d.gt() >= d.court.m.meterT0) { d.run(1 / 60, true); break; } d.run(1 / 60); } d.run(0.1); return { n: d.court.m.served + d.court.m.tosses.length, seen: d.tipsSeen() }; });
  check(two.n === 2 && (two.seen & 128), "a second pearl: \"again\" done, kept as seen");
  // (a player: to the gold circle and three pearls a serve, to where Mr Plan's returns come down)
  await p.evaluate(() => {
    window.__play = (i) => {
      const d = window.Pickleball.debug(), C = d.COURT, me = d.me, m = d.court.m; if (!m) { return false; }
      let tx = 0.6, tz = C.L - 1.2;
      if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 3)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = m.phase !== "plansuper" && u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 3 && i - (window.__lastFire || -99) > 12; if (fire) { window.__lastFire = i; }
      d.run(1 / 60, fire); return true;
    };
  });
  const rally = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 60 * 40; i++) { if (!window.__play(i)) { break; } if (/ring/.test(document.getElementById("help").textContent)) { d.input.stick = null; d.draw(); return d.hud().cue.key; } } d.input.stick = null; return null; });
  t = await tip();
  check(rally === "rally" && (has(t, "get") || t.ready) && !t.off.length, `Mr Plan's return: "get here" and the trail (${t.items.join(", ")})`);
  await p.screenshot({ path: `${out}/6_rally.png` });
  // kept as seen once each has gone (move, court, serve, bar, pearls; the rally's once it has had its time)
  const seen = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  check((seen & 0b10001111) === 0b10001111, "the five gone, kept as seen (" + seen.toString(2) + ")");
  // the rest of a match, three pearls a serve, counting each tip's sentences: none twice
  const shows = await p.evaluate(() => {
    const d = window.Pickleball.debug(), e = document.getElementById("help"), n = {}; let last = "";
    for (let i = 0; i < 60 * 90; i++) { if (!window.__play(i)) { break; } const now = e.textContent; if (now && now !== last) { n[now] = (n[now] || 0) + 1; } last = now; }
    d.input.stick = null; return n;
  });
  const twice = Object.entries(shows).filter((x) => x[1] > 1);
  check(Object.keys(shows).length > 0 && !twice.length, "the rest of a match: no tip twice (" + Object.keys(shows).map((x) => x.slice(0, 20)).join(" / ") + ")" + (twice.length ? " " + JSON.stringify(twice) : ""));
  const seen2 = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  check((seen2 & 0b10011111) === 0b10011111, "and the rally's, after its time (" + seen2.toString(2) + ")");
  // a reload: the tips seen are kept with the save, so the move tip does not come back
  const kept = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await step(1.5);
  t = await tip();
  const after = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  check(t.key !== "move" && after === kept && after < 256, "after a reload the tips seen stay seen (" + after.toString(2) + "), the move tip not shown again");
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();

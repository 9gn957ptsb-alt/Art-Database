// pb_tips.js - how to play, as pop-ups at their moments (the artist, 28 Oct 2026: "I want the how to to be pop-ups that
// happen when you're walking through that are cued by certain moments"). From the start: the move tip, gone once he
// moves; walking about, the court tip; onto the court, the serve tip; on the mark, the bar's (under the bar); Mr Plan's
// first return, the rally's; each once, one at a time, and inside the screen; kept with the save, so after a reload none
// comes back. node pb_tips.js outdir [port]
const { chromium } = require("playwright");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const tip = () => p.evaluate(() => { const d = window.Pickleball.debug(); d.draw(); const e = document.getElementById("help"), r = e.getBoundingClientRect(); return { shown: !e.hidden && getComputedStyle(e).display !== "none" && e.style.opacity !== "0", text: e.textContent.replace("◆ How to play", "").slice(0, 60), top: Math.round(r.top), bottom: Math.round(r.bottom), H: innerHeight, meter: d.hud().meter }; });
  const step = (sec, stick) => p.evaluate(({ sec, stick }) => { const d = window.Pickleball.debug(); d.pause(true); d.input.stick = stick ? { id: -1, x: 0, y: 0, dx: stick[0], dy: stick[1] } : null; d.run(sec); d.input.stick = null; }, { sec, stick });
  await step(0.5);
  let t = await tip(); check(t.shown && /Move/.test(t.text), "at the start: how to move (" + t.text + ")");
  await p.screenshot({ path: `${out}/1_move.png` });
  await step(0.6, [60, 0]); await step(1.5);
  t = await tip(); check(!/Move/.test(t.text) || !t.shown, "gone once he moves");
  await step(6);
  t = await tip(); check(t.shown && /open court/.test(t.text), "walking about: the court tip (" + t.text + ")");
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(1.6); });
  t = await tip(); check(t.shown && /serve/.test(t.text), "onto the court: the serve tip (" + t.text + ")");
  await p.screenshot({ path: `${out}/2_serve.png` });
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.toServe(); d.run(1.5); });
  t = await tip(); check(t.shown && /bar/.test(t.text) && t.meter && t.top >= t.meter.y + t.meter.h && t.bottom <= t.H, "on the mark: the bar's tip, under the bar, inside the screen (" + t.text + ")");
  await p.screenshot({ path: `${out}/3_bar.png` });
  const served = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 300; i++) { const u = d.meter(); if (u != null && u > 0.5 && u < 0.66) { d.run(1 / 60, true); break; } d.run(1 / 60); } d.run(1.4); return d.court.m.served; });
  t = await tip(); check(served >= 1 && !(t.shown && /bar/.test(t.text)), "served: the bar's tip gone");
  const rally = await p.evaluate(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 600; i++) { d.run(1 / 60); const e = document.getElementById("help"); if (!e.hidden && /ring/.test(e.textContent)) { return true; } } return false; });
  check(rally, "Mr Plan's return: the rally's tip");
  await p.screenshot({ path: `${out}/4_rally.png` });
  // kept as seen once each has gone (move, court, serve, bar; the rally's once it has had its time)
  const seen = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  check((seen & 15) === 15, "the four gone, kept as seen (" + seen.toString(2) + ")");
  const seen2 = await p.evaluate(() => { const d = window.Pickleball.debug(); d.run(9); return d.tipsSeen(); });
  check((seen2 & 31) === 31, "and the rally's, after its time (" + seen2.toString(2) + ")");
  // the rest of a match, three pearls a serve, counting each tip's showings: none twice
  const shows = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me, e = document.getElementById("help"), n = {}; let last = "", lastFire = -99;
    for (let i = 0; i < 60 * 90; i++) {
      const m = d.court.m; if (!m) { break; }
      let tx = 0.6, tz = C.L - 1.2;
      if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 3)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = m.phase !== "plansuper" && u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 3 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      const t = e.hidden ? "" : e.textContent; if (t && t !== last) { n[t] = (n[t] || 0) + 1; } last = t;
    }
    d.input.stick = null; return n;
  });
  const twice = Object.entries(shows).filter((x) => x[1] > 1);
  check(Object.keys(shows).length > 0 && !twice.length, "the rest of a match: no tip twice (" + Object.values(shows).join(" ") + ")" + (twice.length ? " " + JSON.stringify(twice) : ""));
  // a reload: the tips seen are kept with the save, so the move tip does not come back
  const kept = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await step(1.5);
  t = await tip();
  const after = await p.evaluate(() => window.Pickleball.debug().tipsSeen());
  check(!(t.shown && /Move/.test(t.text)) && after === kept, "after a reload the tips seen stay seen (" + after.toString(2) + "), the move tip not shown again");
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();

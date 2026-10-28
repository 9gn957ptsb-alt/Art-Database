// pb_rules.js - the serve's rules and the match's recording, as the review of 28 Oct 2026 found them broken: a pearl only
// from the gold mark (off it the serve is over); a second tap in the first pearl's toss is a second pearl; the super
// pressed in the pause after Mr Plan takes a match still comes on the next point, and the match he goes on to win is
// recorded from its start; a match's recording takes its own court's bursts only. node pb_rules.js [port]
const { chromium } = require("playwright");
const [port] = process.argv.slice(2);
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  const fresh = async (save) => {
    await p.goto(url);
    await p.evaluate((s) => { localStorage.clear(); if (s) { localStorage.setItem("pickleball-save-v1", JSON.stringify(s)); } }, save || null);
    await p.reload();
    await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await p.evaluate(() => window.Pickleball.debug().pause(true));
  };
  // (on court one, on the mark, the bar stopped mid-way: one pearl struck)
  const serveOne = () => {
    const d = window.Pickleball.debug(); d.enter(0); d.run(0.4); d.toServe();
    const m = d.court.m;
    for (let i = 0; i < 600; i++) { const u = d.meter(); const fire = u != null && u >= 0.45 && u <= 0.66; d.run(1 / 60, fire); if (fire) { break; } }
    return m;
  };

  // 1. a second tap 0.1 s after the first, in the first pearl's toss: two pearls
  await fresh();
  const r1 = await p.evaluate((serveOne) => {
    const m = eval("(" + serveOne + ")")(), d = window.Pickleball.debug();
    for (let i = 0; i < 6; i++) { d.run(1 / 60); }
    const phase = m.phase; d.run(1 / 60, true);
    for (let i = 0; i < 60; i++) { d.run(1 / 60); }
    return { phase, n: m.served + m.tosses.length };
  }, serveOne.toString());
  check(r1.n === 2, `a second tap in the first toss (phase ${r1.phase}) is a second pearl: ${r1.n}`);

  // 2. one pearl from the mark; then off it towards the net, and a tap: no pearl, the serve over
  await fresh();
  const r2 = await p.evaluate((serveOne) => {
    const m = eval("(" + serveOne + ")")(), d = window.Pickleball.debug(), sp = d.serveSpot();
    for (let i = 0; i < 30; i++) { d.run(1 / 60); }
    const n0 = m.served + m.tosses.length;
    d.input.stick = { id: -1, x: 0, y: 0, dx: 0, dy: -60 };
    for (let i = 0; i < 42; i++) { d.run(1 / 60); }
    const off = Math.hypot(d.me.x - sp[0], d.me.z - sp[1]), open = m.meterOn;
    for (let i = 0; i < 12; i++) { d.run(1 / 60, true); }
    d.input.stick = null;
    return { n0, n: m.served + m.tosses.length, off: +off.toFixed(2), open };
  }, serveOne.toString());
  check(r2.n0 === 1 && r2.n === 1 && !r2.open, `off the mark (${r2.off} m from it) the serve is over, a tap no pearl: ${JSON.stringify(r2)}`);

  // 3. Mr Plan takes the match; in the pause the super is pressed: it comes on the next point, and the recording starts over
  await fresh();
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.6); const m = d.court.m; m.them = d.COURT.WIN; m.phase = "point"; m.t = d.gt(); });
  await p.evaluate(() => window.Pickleball.debug().pause(false)); await p.click("#super"); await p.evaluate(() => window.Pickleball.debug().pause(true));
  const r3 = await p.evaluate(() => {
    const d = window.Pickleball.debug(), m = d.court.m, armed = m.sup.armed, rec0 = m.rec;
    let phases = new Set(), t = 0;
    for (let i = 0; i < 60 * 4; i++) { d.run(1 / 60); if (d.court.m) { phases.add(d.court.m.phase); } if (m.phase === "super" && !t) { t = d.gt(); } }
    return { armed, super: phases.has("super"), newRec: m.rec !== rec0, recFrom: +(m.rec.t0 - (t || d.gt())).toFixed(2) };
  });
  check(r3.armed && r3.super, `the super pressed as Mr Plan takes it comes on the next point: ${JSON.stringify(r3)}`);
  check(r3.newRec && r3.recFrom > -2, `the next match recorded from its start: ${JSON.stringify(r3)}`);

  // 4. three courts won before (no recordings: they rally as scripted, with their bursts); 30 s on court four: its
  // recording takes none of theirs
  await fresh({ v: 2, won: 3, rally: 4 });
  const r4 = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT; d.enter(3); d.run(0.3); d.draw();
    const m = d.court.m, cx = 3 * C.GAP;
    for (let i = 0; i < 30; i++) { d.run(1); d.draw(); }
    return { k: m.k, fx: m.rec.fx.length, elsewhere: m.rec.fx.filter((e) => Math.abs(e.p[0] - cx) > C.GAP / 2).length };
  });
  check(r4.k === 3 && r4.elsewhere === 0, `court four's recording takes no burst of the courts beside it: ${JSON.stringify(r4)}`);
  await p.evaluate(() => localStorage.clear());

  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();

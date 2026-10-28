// pb_plansuper.js - Mr Plan's super return (the artist, 28 Oct 2026: "Mr. Plan should also have a super return, however,
// for him you have a chance to return his super return and it is the same moving bar that we have to choose where to
// serve, but you have to land in that ace zone to return Mr. Plan's super return"). His chance made certain for the test;
// a rally until he uses it; then the bar: stopped in the ace zone, the pearl goes back and the rally plays on; stopped
// outside it, the point is his; once a game. Pictures through it. node pb_plansuper.js outdir [port]
const { chromium } = require("playwright");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  // play until his super starts (the bot on the ring, serving one pearl), then stop the bar where asked
  const run = (want, shots) => p.evaluate(async ({ want, shots }) => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; d.pause(true); d.PSUP.P0 = d.PSUP.P1 = 1;
    if (!d.court.m) { d.enter(d.courts.length - 1); d.run(0.5); }
    let lastFire = -99, started = false, m;
    for (let i = 0; i < 60 * 60 && !started; i++) {
      m = d.court.m; if (!m) { d.enter(d.courts.length - 1); d.run(0.5); continue; }
      let tx = 0.6, tz = C.L - 1.2;
      if (m.phase === "serve" && !m.meterOn) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 1 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      started = !!(d.court.m && d.court.m.phase === "plansuper");
    }
    d.input.stick = null;
    if (!started) { return { started: false }; }
    m = d.court.m; const y0 = m.you, t0 = m.them, sp = m.psup, ball = sp.ball, avail = sp.avail;
    let maxY = 0, pics = 0;
    // to the strike
    for (let i = 0; i < 60 * 3 && !sp.struck; i++) { d.run(1 / 60); maxY = Math.max(maxY, d.plans[m.k].y); }
    const struck = sp.struck, slowed = Math.hypot(ball.vx, ball.vy, ball.vz);
    // the bar: wait until it is where we want it, then tap
    let tapped = false;
    for (let i = 0; i < 60 * 4 && !tapped && m.phase === "plansuper"; i++) {
      const u = sp.uNow || 0, inAce = u >= d.SERVE.ACE[0] + 0.01 && u < d.SERVE.ACE[1] - 0.01, outAce = u > 0.3 && u < 0.5;
      const fire = want === "ace" ? inAce : outAce; d.run(1 / 60, fire); tapped = sp.tapped;
    }
    for (let i = 0; i < 60 * 4 && m.phase === "plansuper"; i++) { d.run(1 / 60); }
    return { started: true, struck, maxY: +maxY.toFixed(2), avail, tapped, ok: sp.ok, you: m.you - y0, them: m.them - t0, phase: m.phase, ballLast: ball.last, ballDead: ball.dead, again: m.psup.avail, say: document.getElementById("say").textContent.slice(0, 70) };
  }, { want, shots });
  const a = await run("ace");
  console.log(JSON.stringify(a));
  check(a.started && a.struck, "Mr Plan uses his super in a rally");
  check(a.maxY > 3.5, "he leaps high: " + a.maxY + " m");
  check(a.tapped && a.ok && a.them === 0 && a.ballLast === "you" && !a.ballDead && (a.phase === "rally" || a.phase === "point"), "the bar stopped in the ace zone: the pearl goes back and the rally plays on");
  check(a.again === false, "once a game: spent");
  // a new game, the bar stopped outside the zone
  await p.evaluate(() => { const d = window.Pickleball.debug(), m = d.court.m; if (m) { m.psup = { avail: true }; } });
  const o = await run("out");
  console.log(JSON.stringify(o));
  check(o.started && o.tapped && !o.ok && o.them === 1 && o.ballDead, "the bar stopped outside the ace zone: the point is Mr Plan's");
  // pictures: his leap, the strike, the bar
  await p.evaluate(() => { const d = window.Pickleball.debug(), m = d.court.m; if (m) { m.psup = { avail: true }; } });
  await p.evaluate(async () => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; let lastFire = -99;
    for (let i = 0; i < 60 * 60; i++) { const m = d.court.m; if (!m) { d.enter(d.courts.length - 1); d.run(0.5); continue; } if (m.phase === "plansuper") { break; }
      let tx = 0.6, tz = C.L - 1.2; if (m.phase === "serve" && !m.meterOn) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz); d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 1 && i - lastFire > 12; if (fire) { lastFire = i; } d.run(1 / 60, fire); }
    d.input.stick = null;
  });
  for (const [t, name] of [[0.9, "1_leap"], [0.5, "2_strike"], [0.6, "3_bar"]]) { await p.evaluate((t) => { const d = window.Pickleball.debug(); d.run(t); d.draw(); }, t); await p.screenshot({ path: `${out}/${name}.png` }); }
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();

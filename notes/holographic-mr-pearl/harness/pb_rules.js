// pb_rules.js - the serve's rules and the match's recording, as the reviews of 28 Oct 2026 found them broken: a pearl
// only from the gold mark (off it the serve is over); a double tap is one pearl, not a fault in the kitchen, and a tap
// once the bar sweeps again is the next pearl; the super pressed in the pause after Mr Plan takes a match still comes
// on the next point, and the match he goes on to win is recorded from its start; a match's recording takes its own
// court's bursts only; the serve goes where he looked at the tap; on the mark the view swings round to the net, not
// cut; in a rally the side arrows step him sideways; Mr Plan's super return ends the serve, so the next one starts at
// the gold circle; the GL context lost and given back, the picture comes back; the serve's bar quicker every court.
// node pb_rules.js [port]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port] = process.argv.slice(2);
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
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

  // 1. a second tap 0.1 s after the first (a double tap): one pearl, no fault; a tap once the bar sweeps again: the next
  await fresh();
  const r1 = await p.evaluate((serveOne) => {
    const m = eval("(" + serveOne + ")")(), d = window.Pickleball.debug();
    for (let i = 0; i < 6; i++) { d.run(1 / 60); }
    d.run(1 / 60, true);
    for (let i = 0; i < 20; i++) { d.run(1 / 60); }
    const n1 = m.served + m.tosses.length, stops = m.stops.slice();
    let n2 = n1;
    for (let i = 0; i < 300; i++) { const u = d.meter(); const fire = u != null && u >= 0.45 && u <= 0.66; d.run(1 / 60, fire); if (fire) { for (let j = 0; j < 30; j++) { d.run(1 / 60); } n2 = m.served + m.tosses.length; break; } }
    return { n1, n2, stops: stops.map((v) => +v.toFixed(2)) };
  }, serveOne.toString());
  check(r1.n1 === 1, `a double tap is one pearl, not a second in the kitchen: ${JSON.stringify(r1)}`);
  check(r1.n2 === 2, `a tap once the bar sweeps again is the second pearl: ${JSON.stringify(r1)}`);

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
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; d.enter(3); d.run(0.3); d.draw();
    const m = d.court.m, cx = 3 * C.GAP; let lastFire = -99;
    // (30 s played on court four, as pb_curve's ideal player: on the mark to serve, on the ring of Mr Plan's shot)
    for (let i = 0; i < 60 * 30 && d.court.m === m; i++) {
      let tx = cx + 0.6, tz = C.L - 1.2;
      if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 1)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = m.phase !== "plansuper" && u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 1 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire); if (i % 60 === 0) { d.draw(); }
    }
    d.input.stick = null;
    return { k: m.k, fx: m.rec.fx.length, elsewhere: m.rec.fx.filter((e) => Math.abs(e.p[0] - cx) > C.GAP / 2).length };
  });
  check(r4.k === 3 && r4.fx > 0 && r4.elsewhere === 0, `court four's recording takes its own bursts and none of the courts beside it: ${JSON.stringify(r4)}`);
  await p.evaluate(() => localStorage.clear());

  // 5. the serve's aim: the view turned 0.3 left at the tap, the pearl lands well left of one served straight
  const aimed = async (yaw) => {
    await fresh();
    return p.evaluate((yaw) => {
      const d = window.Pickleball.debug(); d.enter(0); d.run(0.4); d.toServe(); const m = d.court.m;
      for (let i = 0; i < 40; i++) { d.run(1 / 60); }
      for (let i = 0; i < 600; i++) { d.view.yaw = yaw; const u = d.meter(); const fire = u != null && u >= 0.45 && u <= 0.6; d.run(1 / 60, fire); if (fire) { break; } }
      for (let i = 0; i < 240; i++) { d.run(1 / 60); const b = m.balls[0]; if (b && b.bounces >= 1) { return { x: +(b.x - 3 * 0).toFixed(2), z: +b.z.toFixed(2), yawAtStrike: +d.view.yaw.toFixed(3) }; } }
      return null;
    }, yaw);
  };
  const a0 = await aimed(0), a1 = await aimed(-0.3);
  check(a0 && a1 && a1.x < a0.x - 0.8, `the serve goes where he looked at the tap: straight ${JSON.stringify(a0)}, 0.3 left ${JSON.stringify(a1)}`);

  // 6. walking to the mark with the view turned 1.2 away: on the mark it swings round, no cut, and faces the net by the bar
  await fresh();
  const r6 = await p.evaluate(() => {
    const d = window.Pickleball.debug(); d.enter(0); d.run(0.4); d.view.yaw = 1.2; d.toServe(); const m = d.court.m;
    let jump = 0, prev = d.view.yaw, y0 = d.view.yaw;
    while (d.gt() < m.meterT0) { d.run(1 / 60); jump = Math.max(jump, Math.abs(d.view.yaw - prev)); prev = d.view.yaw; }
    return { y0: +y0.toFixed(2), jump: +jump.toFixed(3), atBar: +d.view.yaw.toFixed(3) };
  });
  check(r6.y0 > 0.8 && r6.jump < 0.3 && Math.abs(r6.atBar) < 0.05, `on the mark the view swings round to the net: ${JSON.stringify(r6)}`);

  // 7. in a rally (the serve over, the view held behind him) the side arrows step him sideways
  await fresh();
  const r7 = await p.evaluate((serveOne) => {
    const m = eval("(" + serveOne + ")")(), d = window.Pickleball.debug();
    for (let i = 0; i < 200 && m.meterOn; i++) { d.run(1 / 60); }
    const x0 = d.me.x; d.input.keys.ArrowLeft = true; d.run(0.3); d.input.keys.ArrowLeft = false; d.run(0.4); const xl = d.me.x;
    d.input.keys.ArrowRight = true; d.run(0.3); d.input.keys.ArrowRight = false; d.run(0.4);
    return { phase: m.phase, open: m.meterOn, left: +(xl - x0).toFixed(2), right: +(d.me.x - xl).toFixed(2) };
  }, serveOne.toString());
  check(r7.left < -0.3 && r7.right > 0.3, `in a rally the side arrows step him sideways: ${JSON.stringify(r7)}`);

  // 8. Mr Plan's super return (never his return of serve: the counter would be a volley of the third shot, against the
  // two-bounce rule); when it starts the serve is over, and after it the next serve starts at the gold circle
  await fresh();
  const r8 = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; d.PSUP.P0 = d.PSUP.P1 = 1; d.enter(0); d.run(0.4);
    let m = d.court.m, lastFire = -99, out = null;
    for (let i = 0; i < 60 * 60 && !out; i++) {
      m = d.court.m; if (!m) { break; }
      let tx = 0.6, tz = C.L - 1.2;
      if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 1)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = m.phase !== "plansuper" && u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 1 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      // (his stroke: the shot after the pearl's last)
      if (m.phase === "plansuper") { out = { shot: m.psup.ball.rally + 1, open: m.meterOn }; }
    }
    d.input.stick = null; if (!out) { return { started: false }; }
    for (let i = 0; i < 60 * 8 && m.phase !== "serve"; i++) { d.run(1 / 60); }
    return Object.assign(out, { started: true, nextServe: m.phase, lockedAtStart: m.meterOn });
  });
  check(r8.started && r8.shot >= 4, `Mr Plan's super never on his return of serve (its shot: ${r8.shot})`);
  check(r8.started && r8.open === false && r8.nextServe === "serve" && r8.lockedAtStart === false, `when it starts the serve is over; the next starts at the circle: ${JSON.stringify(r8)}`);

  // 9. the GL context lost (a phone in the background, short of memory) and given back: the picture comes back
  await fresh();
  const lum = () => p.evaluate(() => { const d = window.Pickleball.debug(); d.draw(); const g = document.getElementById("view").getContext("webgl2"), w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(w * h * 4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); let s = 0; for (let i = 0; i < px.length; i += 4) { s += px[i] + px[i + 1] + px[i + 2]; } return +(s / (w * h * 3)).toFixed(2); });
  await p.evaluate(() => window.Pickleball.debug().run(1));
  const l0 = await lum();
  const lost = await p.evaluate(() => new Promise((res) => { const c = document.getElementById("view"), x = c.getContext("webgl2").getExtension("WEBGL_lose_context"); if (!x) { res("no extension"); return; } c.addEventListener("webglcontextrestored", () => res("restored"), { once: true }); c.addEventListener("webglcontextlost", () => setTimeout(() => x.restoreContext(), 50), { once: true }); x.loseContext(); setTimeout(() => res("timeout"), 5000); }));
  await p.evaluate(() => window.Pickleball.debug().run(0.5));
  const l1 = await lum();
  check(lost === "restored" && l0 > 1 && l1 > 0.5 * l0, `the GL context lost and given back: the picture comes back (${lost}; light ${l0} before, ${l1} after)`);

  // the serve's bar quicker every court, without end (the artist, 29 Oct 2026: "The speed of the moving dot in the serve
  // bar should progressively get faster as you increase in levels"): the numbers, courts 1 to 200, each quicker than the
  // last and none at the floor; and the dot itself, timed across the bar at the serve on courts 1, 10 and 20
  await fresh();
  const sw = await p.evaluate(() => {
    const d = window.Pickleball.debug(), H = d.HARD; let down = true, prev = 99, min = 99;
    for (let l = 1; l <= 200; l++) { const v = d.skill(l).sweep; if (!(v < prev)) { down = false; } prev = v; min = Math.min(min, v); }
    const timed = [1, 10, 20].map((l) => {
      d.enter(d.courts.length - 1); d.run(0.3); const m = d.court.m; m.level = l; m.sk = d.skill(l); d.toServe(); d.run(0.4);
      let t0 = null, t1 = null; for (let i = 0; i < 600 && t1 == null; i++) { const u = d.meter(); if (u != null) { if (t0 == null && u >= 0.1 && u < 0.5) { t0 = d.gt(); } else if (t0 != null && u >= 0.9) { t1 = d.gt(); } } d.run(1 / 120); }
      const out = { level: l, sweep: +m.sk.sweep.toFixed(3), across: t1 != null ? +((t1 - t0) / 0.8).toFixed(3) : null };
      m.you = 3; d.winCourt(); d.run(0.3); return out;
    });
    return { down, above: min > H.FLOOR, min: +min.toFixed(4), floor: H.FLOOR, one: +d.skill(1).sweep.toFixed(3), timed };
  });
  check(sw.down && sw.above && sw.one > 1.0, `the bar quicker every court, 1 to 200, never at its floor (${sw.one} s a sweep on court one, ${sw.min} on court 200, the floor ${sw.floor})`);
  const tm = sw.timed;
  check(tm.every((x) => x.across != null && Math.abs(x.across - x.sweep) < 0.03) && tm[0].across > tm[1].across && tm[1].across > tm[2].across, "and the dot itself, timed across the bar, quicker on court 10 than 1 and on 20 than 10: " + JSON.stringify(tm));
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();

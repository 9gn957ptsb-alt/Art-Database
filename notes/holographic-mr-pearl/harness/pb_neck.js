// pb_neck.js - the view's neck in a rally (the artist, 30 Oct 2026, of a rally on a phone: "When the game perspective no
// longer captures the ball or barely Mr Pearl like this I want your view to turn like a neck left and right to
// compensate for keeping the pearls in view"). On a phone held upright (390 by 844), a bot plays rallies on a hard court
// (Mr Plan's widest shots) for 50 s of game time, three pearls a serve; each frame of a rally, where the view is held,
// it asks of every pearl coming to him (the pearl and where it comes down), of the next he must play, of Mr Plan and of
// Mr Pearl whether they are on the screen (inside its width, in front of the eye), and counts the frames where one is
// not (the next pearl and Mr Pearl are what the neck is for; Mr Plan is counted, not chased); and how far the
// view turned and how fast. Run against the game before (its own port) and now, the share of such frames should fall;
// the neck stays within NECK.max (0.45 rad) and turns no faster than NECK.rate (1 rad/s, on a spring: NECK.w), and swivels
// half as much as the first neck did (4 Nov 2026); on a desk it hardly turns.
// node pb_neck.js [port] [phone|desk] [label]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, kind, label] = process.argv.slice(2);
const VIEW = kind === "desk" ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 9, rally: 4, tut: 1, tips: 255 })); });
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const r = await p.evaluate((ov) => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; d.pause(true); d.run(0.3);
    if (ov && d.NECK) { Object.assign(d.NECK, ov); }   // (PB_NECK='{...}': other numbers for the neck, to compare)
    const k = d.courts.length - 1; d.enter(k); d.run(0.5);
    const W = innerWidth, inView = (pt) => { const s = d.toScreen(pt); return !!s && s[0] >= 0 && s[0] <= W; };
    let frames = 0, outAny = 0, outPearl = 0, outNext = 0, outNextP = 0, outNextM = 0, outPlan = 0, outMe = 0, maxNeck = 0, maxStep = 0, lastYaw = null, lastFire = -99, sumNeck = 0, travel = 0, lastNk = null, straight = 0, maxOut = 0, maxBack = 0, maxOutAcc = 0, lastV = null;
    for (let i = 0; i < 60 * 50; i++) {
      const m = d.court.m; if (!m) { d.enter(d.courts.length - 1); d.run(0.5); continue; }
      let tx = 0.6, tz = C.L - 1.2;
      if (((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 3)) && d.serveSpot()) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark).sort((a, c) => (a.mark.t || 0) - (c.mark.t || 0))[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.08 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(); let fire = u != null && u >= 0.4 && u <= 0.66 && (m.served + m.tosses.length) < 3 && i - lastFire > 12;
      if (m.phase === "plansuper") { fire = u != null && Math.abs(u - (d.SERVE.ACE[0] + d.SERVE.ACE[1]) / 2) < 0.02; }
      if (fire) { lastFire = i; }
      d.run(1 / 60, fire); d.draw();
      const m2 = d.court.m; if (!m2 || m2.phase !== "rally") { lastYaw = null; continue; }
      const coming = m2.balls.filter((q) => !q.dead && q.last === "them"); if (!coming.length) { lastYaw = null; continue; }
      frames++;
      const out1 = (q) => !inView([q.x, q.y, q.z]) || (q.mark && q.bounces === 0 && !inView([q.mark.x, 0.1, q.mark.z]));
      const nq = coming.slice().sort((a, c) => ((a.mark && a.mark.t) || 9e9) - ((c.mark && c.mark.t) || 9e9))[0];
      const pe = coming.some(out1), nx = out1(nq);
      if (nx) { outNext++; } if (!inView([nq.x, nq.y, nq.z])) { outNextP++; } if (nq.mark && nq.bounces === 0 && !inView([nq.mark.x, 0.1, nq.mark.z])) { outNextM++; }
      const pl = d.plans[m2.k], pn = !inView([pl.x, 1.0, pl.z]), mn = !inView([me.x, 1.0, me.z]);
      if (pe) { outPearl++; } if (pn) { outPlan++; } if (mn) { outMe++; } if (pe || pn || mn) { outAny++; }
      const yw = d.view.nk != null ? d.view.nk : d.view.yaw; sumNeck += Math.abs(d.view.nk || 0); if (Math.abs(d.view.nk || 0) < 0.05) { straight++; } if (lastNk != null && lastYaw != null) { const nk = d.view.nk || 0, dk = nk - lastNk, v = dk * 60; travel += Math.abs(dk);
        // (out: the turn growing on its side; back: toward straight on. Out, its speed and how sharply that speed changes)
        if (Math.abs(nk) > Math.abs(lastNk) && nk * lastNk >= 0) { maxOut = Math.max(maxOut, Math.abs(v)); if (lastV != null && v * lastV > 0) { maxOutAcc = Math.max(maxOutAcc, Math.abs(v - lastV) * 60); } } else { maxBack = Math.max(maxBack, Math.abs(v)); }   // (the change in speed only while it goes on out: a reversal is not a lurch)
        lastV = v; } else { lastV = null; } lastNk = d.view.nk || 0; maxNeck = Math.max(maxNeck, Math.abs(Math.atan2(Math.sin(yw), Math.cos(yw)))); if (lastYaw != null) { maxStep = Math.max(maxStep, Math.abs(yw - lastYaw)); } lastYaw = yw;
    }
    d.input.stick = null;
    const pc = (n) => +(100 * n / Math.max(1, frames)).toFixed(1);
    return { frames, outAny: pc(outAny), outPearl: pc(outPearl), outNext: pc(outNext), outNextPearl: pc(outNextP), outNextMark: pc(outNextM), outPlan: pc(outPlan), outMe: pc(outMe), maxNeck: +maxNeck.toFixed(3), meanNeck: +(sumNeck / Math.max(1, frames)).toFixed(3), swivelPerSec: +(travel * 60 / Math.max(1, frames)).toFixed(3), straight: pc(straight), maxOut: +maxOut.toFixed(2), maxBack: +maxBack.toFixed(2), maxOutAcc: +maxOutAcc.toFixed(1), maxStepPerSec: +(maxStep * 60).toFixed(2), NECK: d.NECK || null };
  }, process.env.PB_NECK ? JSON.parse(process.env.PB_NECK) : null);
  r.label = label || ""; r.kind = kind || "phone";
  console.log(JSON.stringify(r));
  // (a game with the neck: inside its turn and its rate)
  const bad = [];
  if (r.NECK) {
    if (r.maxNeck > r.NECK.max + 1e-3) { bad.push(`the neck turned ${r.maxNeck} rad, past ${r.NECK.max}`); }
    // (out at NECK.rate at most, its speed eased (no lurch: under 40 rad/s/s); back at NECK.back at most)
    if (r.maxOut > r.NECK.rate * 1.05 + 0.02) { bad.push(`the neck turned out at ${r.maxOut} rad/s, past ${r.NECK.rate}`); }
    if (r.maxOutAcc > 40) { bad.push(`a turn out lurched: its speed changed at ${r.maxOutAcc} rad/s/s`); }
    if (r.maxBack > (r.NECK.back || r.NECK.rate) * 1.01 + 0.01) { bad.push(`the neck came back at ${r.maxBack} rad/s, past ${r.NECK.back || r.NECK.rate}`); }
    // (the middle ground, 4 Nov 2026: half the swivel of the first neck, 0.73 rad a second; and still some help: where the
    // next pearl comes down out of the picture less often than with no neck at all, 52% to 60% on a phone. A few rallies,
    // so the shares move by ten points from run to run: the bounds are loose)
    if (r.swivelPerSec > (r.kind === "desk" ? 0.3 : 0.5)) { bad.push(`the view swivelled ${r.swivelPerSec} rad a second`); }
    if (r.outNextPearl > (r.kind === "desk" ? 15 : 50) || (r.kind !== "desk" && r.outNextMark > 50)) { bad.push(`the next pearl out of the picture in ${r.outNextPearl}% of the rally's frames, where it comes down ${r.outNextMark}%`); }
    if (r.frames < 300) { bad.push(`only ${r.frames} rally frames`); }
  }
  bad.forEach((x) => console.log("FAIL " + x));
  console.log(errs.length ? "ERRORS " + errs.slice(0, 2).join(" | ") : "no errors");
  await b.close();
  process.exit(errs.length || bad.length ? 1 : 0);
})();

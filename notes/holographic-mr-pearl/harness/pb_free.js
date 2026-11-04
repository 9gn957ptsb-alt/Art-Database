// pb_free.js - no barriers (the artist, 4 Nov 2026: "Make sure that I can drive anywhere in the coupe, and there are no
// barriers to where I can get out, even the highest level that I am next to play. Even if I start the game [and] the coupe
// is on the court, that is my fault and have it be in the way, there are no physical barriers"). With two courts won: the
// coupe driven straight onto the open court, parked there, out of it there, nothing pushing it off; he walks through it;
// parked over the gold circle it stays while he steps on and plays, and while the court is won; driven past the world's
// old edge and out there, nothing holding either; out on the staircase's ramp onto its steps and in again there; and
// Mr Plan's donut with the coupe left on his court, round a circle at its side, no jump. No errors.
// node pb_free.js [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, kind] = process.argv.slice(2);
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 2, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (f, a) => p.evaluate(f, a);
  await D(() => {
    const d = window.Pickleball.debug(); d.pause(true); d.run(0.3);
    window.__in = () => { const c = d.car; if (d.ride.mode !== "car") { d.me.x = c.x + 1.6; d.me.z = c.z; d.me.y = 0; d.run(0.05); d.rideToggle(); d.run(0.05); } return d.ride.mode === "car"; };
    window.__drive = (secs) => { d.input.keys.w = true; for (let i = 0; i < secs * 60; i++) { d.run(1 / 60); } d.input.keys.w = false; };
    window.__stop = () => { d.car.v = 0; d.run(0.1); };
  });

  // 1. straight onto the open court, parked there, out there; nothing shoves it off
  const oc = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1, cx = k * C.GAP, o = { k };
    c.mode = "ground"; c.x = cx + 3; c.z = C.L + 9; c.y = 0; c.yaw = 0; c.vh = 0; c.v = 0; d.run(0.1);
    o.in = window.__in(); c.x = cx + 3; c.z = C.L + 9; c.yaw = 0; c.vh = 0; c.v = 0;
    let minZ = 99; d.input.keys.w = true; for (let i = 0; i < 60 * 1.6; i++) { d.run(1 / 60); minZ = Math.min(minZ, c.z); } d.input.keys.w = false;
    window.__stop(); o.minZ = +minZ.toFixed(2); o.at = [+c.x.toFixed(2), +c.z.toFixed(2)]; o.onCourt = Math.abs(c.x - cx) < C.HW + 1 && Math.abs(c.z) < C.L;
    d.rideToggle(); d.run(0.1); o.out = d.ride.mode === null; o.me = [+d.me.x.toFixed(2), +d.me.z.toFixed(2), +d.me.y.toFixed(3)]; o.match = !!d.court.m;
    const P = [c.x, c.z]; d.run(2); o.moved = +Math.hypot(c.x - P[0], c.z - P[1]).toFixed(3);
    // (through it on foot: stood in its middle, nothing puts him out)
    d.me.x = c.x; d.me.z = c.z; d.run(0.4); o.through = +Math.hypot(d.me.x - c.x, d.me.z - c.z).toFixed(3);
    return o;
  });
  check(oc.in && oc.onCourt && oc.minZ < 3, `the coupe driven straight onto the open court (court ${oc.k + 1}), parked on it at ${JSON.stringify(oc.at)}`);
  check(oc.out && Math.abs(oc.me[2]) < 0.01 && !oc.match && oc.moved < 0.01, `out of it there, on the court's ground (${JSON.stringify(oc.me)}), no match begun by it; the coupe left as it stood (${oc.moved} m in 2 s)`);
  check(oc.through < 0.05, `he walks through the coupe: stood in it, he stays there (${oc.through} m)`);

  // 2. parked over the gold circle: he steps on, the match begins and plays, the court is won; it stays put throughout
  const gc = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, o = {};
    const sp = d.serveSpot ? d.serveSpot() : null, k = d.courts.length - 1, C = d.COURT, op = [k * C.GAP + 0.9, C.L + 0.4];
    c.mode = "ground"; c.x = op[0]; c.z = op[1]; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 0; d.run(0.1); const P = [c.x, c.z];
    d.me.x = op[0] + 2.5; d.me.z = op[1] + 2.5; d.run(0.2); o.before = !!d.court.m;
    d.me.x = op[0]; d.me.z = op[1]; for (let i = 0; i < 40 && !d.court.m; i++) { d.run(1 / 30); }
    o.began = !!d.court.m; o.meAt = Math.hypot(d.me.x - op[0], d.me.z - op[1]);
    if (d.court.m) { for (let i = 0; i < 60 && !d.court.m.meterOn; i++) { d.toServe(); d.run(1 / 30); } o.meter = !!d.court.m.meterOn; }
    o.movedMatch = +Math.hypot(c.x - P[0], c.z - P[1]).toFixed(3);
    d.winCourt(); d.run(0.5); o.won = d.courts.length === k + 2; o.movedWin = +Math.hypot(c.x - P[0], c.z - P[1]).toFixed(3);
    o.sp = sp;
    return o;
  });
  check(!gc.before && gc.began && gc.meAt < 0.6 && gc.meter, `the coupe parked over the gold circle: he steps onto it through the coupe, the match begins, his serve comes (${JSON.stringify(gc)})`);
  check(gc.movedMatch < 0.01 && gc.won && gc.movedWin < 0.01, `the coupe left in the way: unmoved through the match and the court won (${gc.movedMatch}, ${gc.movedWin} m)`);

  // 3. past the world's old edge: driven on, out there, nothing holds either
  const ed = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, B = d.BOUND, o = {};
    if (d.court.m) { d.court.m = null; }
    c.mode = "ground"; c.x = B.x0 + 4; c.z = 0; c.yaw = -Math.PI / 2; c.vh = c.yaw; c.v = 0; d.run(0.1);
    o.in = window.__in(); c.x = B.x0 + 4; c.z = 0; c.yaw = -Math.PI / 2; c.vh = c.yaw; c.v = 0;
    window.__drive(3); window.__stop(); o.x = +c.x.toFixed(1); o.x0 = B.x0;
    d.rideToggle(); d.run(0.1); o.out = d.ride.mode === null; const mx = d.me.x; d.run(0.6); o.meX = +d.me.x.toFixed(2); o.held = +Math.abs(d.me.x - mx).toFixed(3);
    // (and out the far side in z, on foot)
    d.me.x = 0; d.me.z = B.z1 + 20; d.run(0.5); o.meZ = +d.me.z.toFixed(1); o.z1 = B.z1;
    return o;
  });
  check(ed.in && ed.x < ed.x0 - 15 && ed.out && ed.meX < ed.x0 && ed.held < 0.01, `past the world's old edge (x ${ed.x0}): driven on to x ${ed.x}, out there, and he stays (${ed.meX})`);
  check(Math.abs(ed.meZ - (ed.z1 + 20)) < 0.01, `on foot past its far side in z too: ${ed.meZ} (the old edge ${ed.z1})`);

  // 4. out on the staircase's ramp, onto its steps, the coupe held there; in again from the steps
  const rp = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, o = {};
    d.me.x = c.x + 1.6; d.me.z = c.z; d.ride.mode = null;
    c.mode = "ground"; c.x = d.STAIR.c[0] + 9; c.z = d.STAIR.c[1]; c.v = 0; d.run(0.1); o.in0 = window.__in();
    const s = Math.min(1.2, d.stairEnd() * 0.5), q = d.stairAt(s);
    c.mode = "ramp"; c.s = s; c.off = [0, 0]; c.x = q.x; c.z = q.z; c.y = q.y; c.v = 0; d.run(0.1);
    const rb = document.getElementById("ride"); o.outShown = !rb.hidden && getComputedStyle(rb).display !== "none";
    const C0 = [c.x, c.z, c.y]; d.rideToggle(); d.run(0.3);
    o.mode = d.ride.mode; o.meY = +d.me.y.toFixed(2); o.carMode = c.mode; o.carMoved = +Math.hypot(c.x - C0[0], c.z - C0[1], c.y - C0[2]).toFixed(3);
    o.gap = +d.carGap(d.me.x, d.me.z).toFixed(2); o.inShown = !rb.hidden && getComputedStyle(rb).display !== "none" && rb.textContent;
    d.rideToggle(); d.run(0.2); o.back = d.ride.mode;
    d.rideToggle(); d.run(0.2);
    // (left empty on the ramp, a court won: it stays where it stood)
    const K0 = [c.x, c.y, c.z], k0 = d.courts.length - 1; d.ride.mode = null; d.me.x = k0 * 12 + 0.9; d.me.y = 0; d.me.z = 7.1; d.enter(k0); d.run(0.3);
    if (d.court.m) { d.winCourt(); d.run(0.6); } o.wonKept = { mode: c.mode, moved: +Math.hypot(c.x - K0[0], c.y - K0[1], c.z - K0[2]).toFixed(3), courts: d.courts.length };
    // (and on its board's tip: a court won, still on the ramp, on the new board, not fallen to the ground)
    const e0 = d.stairEnd(), qt = d.stairAt(e0); c.mode = "ramp"; c.s = e0; c.off = [0, 0]; c.x = qt.x; c.z = qt.z; c.y = qt.y; c.v = 0; d.run(0.2);
    const k1 = d.courts.length - 1; d.me.x = k1 * 12 + 0.9; d.me.z = 7.1; d.enter(k1); d.run(0.3);
    if (d.court.m) { d.winCourt(); d.run(1.0); } o.tipKept = { mode: c.mode, y: +c.y.toFixed(2), s: +c.s.toFixed(2), end: +d.stairEnd().toFixed(2), courts: d.courts.length };
    return o;
  });
  check(rp.in0 && rp.outShown && rp.mode === "stair" && rp.meY > 0.3 && rp.carMode === "ramp" && rp.carMoved < 0.02 && rp.gap > 0.3 && rp.gap < 1.3, `on the staircase's ramp: Get out there, and out onto its steps beside it, not in it (${rp.meY} m up, ${rp.gap} m off it), the coupe held on the ramp (${JSON.stringify(rp)})`);
  check(!!rp.inShown && rp.back === "car", `in again from the steps beside it ("${rp.inShown}")`);
  check(rp.wonKept.mode === "ramp" && rp.wonKept.moved < 0.05, `left empty on the ramp's steps, a court won (the ramp a step longer): it stays where it stood (${JSON.stringify(rp.wonKept)})`);
  check(rp.tipKept.mode === "ramp" && rp.tipKept.y > 1 && rp.tipKept.s <= rp.tipKept.end + 1e-6, `left empty on its board's tip, a court won: still on the board, not launched off it (${JSON.stringify(rp.tipKept)})`);

  // 5. Mr Plan's donut with the coupe left on his court: round a circle at its side, no jump, back as it stood
  const pd = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT; d.ride.mode = null; d.me.y = 0; if (d.court.m) { d.court.m = null; }
    const k = d.courts.length - 1, cx = k * C.GAP;
    c.mode = "ground"; c.x = cx + 0.9; c.z = C.L + 0.4; c.yaw = 0; c.vh = c.yaw; c.v = 0; d.run(0.1); const P0 = [c.x, c.z, c.yaw];
    d.enter(k); d.run(0.5); const m = d.court.m; if (!m) { return { m: false }; }
    m.them = C.WIN; m.phase = "point"; m.t = d.gt() - 2; d.run(1 / 60);
    const stages = []; let first = null, maxStep = 0, last = [c.x, c.z], eye = null, maxEye = 0;
    for (let i = 0; i < 60 * 20 && m.phase === "donut"; i++) {
      if (m.dn && stages[stages.length - 1] !== m.dn.stage) { stages.push(m.dn.stage); if (m.dn.stage === "drive") { first = null; } }
      d.run(1 / 60);
      if (m.dn && m.dn.stage === "drive") { const st = Math.hypot(c.x - last[0], c.z - last[1]); maxStep = Math.max(maxStep, st); if (first == null) { first = +Math.hypot(c.x - P0[0], c.z - P0[1]).toFixed(3); } }
      last = [c.x, c.z]; d.draw(); const e = d.camNow().e; if (eye) { maxEye = Math.max(maxEye, Math.hypot(e[0] - eye[0], e[1] - eye[1], e[2] - eye[2])); } eye = e.slice();
    }
    return { m: true, stages: stages.join(","), first, maxStep: +maxStep.toFixed(3), back: +(Math.hypot(c.x - P0[0], c.z - P0[1])).toFixed(3), phase: m.phase, maxEye: +maxEye.toFixed(2) };
  });
  check(pd.m && pd.stages === "run,drive,back" && pd.first < 0.6 && pd.maxStep < 0.6 && pd.back < 0.01, `Mr Plan's donut with the coupe left on his court: round a circle at its side, no jump (first ${pd.first} m, at most ${pd.maxStep} m a frame), back as it stood (${JSON.stringify(pd)})`);
  check(pd.maxEye < 3, `and its view never whips round (the eye at most ${pd.maxEye} m a frame: its ease in from 22 m off on a phone; the whip was 5 to 22 m)`);

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

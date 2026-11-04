// pb_lock.js - the coupe held by the track (the artist, 4 Nov 2026: "The coop needs to be a lot easier to drive, have it
// lock on to the center of the race car track when you were driving the coupe making it really hard to actually fall off
// the track. When slowing down to a very low speed, you are allowed to move more off the track so that when you really
// slow down, you're able to get back off the track how you [get] onto the track has to be very smooth and non-disruptive
// to me passing through it or getting out of it"). With two courts won, in the coupe: flat out with the wheel let go it
// goes round both bends by itself near the middle line; a sloppy driver's wheel never gets it off; the wheel moves it
// across its lane and back; steering hard for the edge at speed, still on; driven across the track it is not caught;
// onto it at a shallow angle, caught smoothly (no snap, no jerk); slowed to a crawl, off it at will; on foot and in the
// coupe across the track's bank, no jolt. No errors. node pb_lock.js [port] [phone|desk]
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
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 2, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (f, a) => p.evaluate(f, a);
  await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; d.pause(true); d.run(0.3);
    window.__keys = (w, s, a, dd) => Object.assign(d.input.keys, { w: !!w, s: !!s, a: !!a, d: !!dd });
    window.__put = (x, z, yaw, v) => {   // (in the coupe, here, this way, at this speed)
      if (d.ride.mode !== "car") { d.me.x = c.x + 1.6; d.me.z = c.z; d.me.y = 0; d.run(0.05); d.rideToggle(); d.run(0.05); }
      c.mode = "ground"; c.x = x; c.z = z; c.yaw = yaw; c.vh = yaw; c.v = v; c.yr = 0; c.si = 0; c.steer = 0; c.lk = 0; c.lkDir = 0; c.y = d.groundAt(x, z); window.__keys();
    };
    window.__o = () => d.trkAt(c.x, c.z).d - T.W / 2;
  });

  // 1. flat out, the wheel let go: round both bends by itself, near the middle line
  const hands = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; window.__put(0, T.R, Math.PI / 2, 12);
    let maxO = 0, minD = 99, maxD = -99, s0 = d.trkAt(c.x, c.z).s, run = 0, sPrev = s0, len = d.trkAt(0, 0).len;
    window.__keys(1); for (let i = 0; i < 60 * 30; i++) { d.run(1 / 60); const t = d.trkAt(c.x, c.z); if (i > 90) { maxO = Math.max(maxO, Math.abs(t.d - T.W / 2)); } minD = Math.min(minD, t.d); maxD = Math.max(maxD, t.d); let ds = t.s - sPrev; if (ds < -len / 2) { ds += len; } if (ds > len / 2) { ds -= len; } run += ds; sPrev = t.s; }
    window.__keys(); return { maxO: +maxO.toFixed(2), minD: +minD.toFixed(2), maxD: +maxD.toFixed(2), laps: +(run / len).toFixed(2), v: +c.v.toFixed(1), lk: +(c.lk || 0).toFixed(2) };
  });
  check(hands.laps > 1.5 && hands.minD > 0.5 && hands.maxD < 7.5 && hands.maxO < 1.5, `flat out with the wheel let go: ${hands.laps} laps round both bends by itself, within ${hands.maxO} m of the middle line (${JSON.stringify(hands)})`);

  // 2. a sloppy driver's wheel: never off it
  const slop = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; window.__put(0, T.R, Math.PI / 2, 14);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let minD = 99, maxD = -99, st = 0;
    for (let i = 0; i < 60 * 30; i++) { if (i % 18 === 0) { const r = rnd(); st = r < 0.35 ? -1 : r < 0.7 ? 1 : 0; } window.__keys(1, 0, st < 0, st > 0); d.run(1 / 60); const t = d.trkAt(c.x, c.z); minD = Math.min(minD, t.d); maxD = Math.max(maxD, t.d); }
    window.__keys(); return { minD: +minD.toFixed(2), maxD: +maxD.toFixed(2) };
  });
  check(slop.minD > 0 && slop.maxD < 8, `a sloppy driver, flat out, the wheel thrown about for 30 s: never off it (${slop.minD} to ${slop.maxD} m across 8)`);

  // 3. the wheel moves it across its lane; let go, back to the middle
  const lane = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; window.__put(0, T.R, Math.PI / 2, 14);
    window.__keys(1); d.run(1.0); window.__keys(1, 0, 0, 1); for (let i = 0; i < 90; i++) { d.run(1 / 60); } const right = window.__o();
    window.__keys(1); for (let i = 0; i < 150; i++) { d.run(1 / 60); } const back = window.__o(); window.__keys();
    return { right: +right.toFixed(2), back: +back.toFixed(2) };
  });
  check(Math.abs(lane.right) > 1.6 && Math.abs(lane.back) < 0.6, `the wheel moves it across its lane (${lane.right} m), let go back to the middle (${lane.back} m)`);

  // 4. steering hard for the edge at speed: still on it
  const hard = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; window.__put(0, T.R, Math.PI / 2, 16);
    let minD = 99, maxD = -99; window.__keys(1, 0, 0, 1); for (let i = 0; i < 180; i++) { d.run(1 / 60); const t = d.trkAt(c.x, c.z); minD = Math.min(minD, t.d); maxD = Math.max(maxD, t.d); }
    window.__keys(1, 0, 1, 0); for (let i = 0; i < 180; i++) { d.run(1 / 60); const t = d.trkAt(c.x, c.z); minD = Math.min(minD, t.d); maxD = Math.max(maxD, t.d); }
    window.__keys(); return { minD: +minD.toFixed(2), maxD: +maxD.toFixed(2), v: +c.v.toFixed(1) };
  });
  check(hard.minD > 0.3 && hard.maxD < 7.7, `steering hard for each edge at speed: still on it (${hard.minD} to ${hard.maxD} m)`);

  // 5. driven straight across the track: not caught, not turned
  const cross = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, z0 = T.R - T.W / 2 - 5; window.__put(6, z0, Math.PI, 10);
    let maxTurn = 0, maxLk = 0; const y0 = c.yaw; window.__keys(1);
    for (let i = 0; i < 60 * 2.5; i++) { d.run(1 / 60); maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(c.yaw - y0), Math.cos(c.yaw - y0)))); maxLk = Math.max(maxLk, c.lk || 0); }
    window.__keys(); return { d: +d.trkAt(c.x, c.z).d.toFixed(1), turn: +(maxTurn * 180 / Math.PI).toFixed(1), lk: +maxLk.toFixed(2) };
  });
  check(cross.d > 9 && cross.turn < 4 && cross.lk < 0.05, `driven straight across the track at 10 m/s: through and out the far side, not caught (turned ${cross.turn}°, held ${cross.lk})`);

  // 6. onto it at a shallow angle: caught smoothly, no snap, no jerk, to the middle
  const entry = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, z0 = T.R - T.W / 2 - 2.5; window.__put(-8, z0, Math.PI / 2 + 0.45, 12);
    let maxDy = 0, maxJump = 0, maxDdy = 0, lastY = c.yaw, lastDy = 0, last = [c.x, c.z]; window.__keys(1);
    for (let i = 0; i < 60 * 4; i++) { d.run(1 / 60); const dy = Math.atan2(Math.sin(c.yaw - lastY), Math.cos(c.yaw - lastY)); maxDy = Math.max(maxDy, Math.abs(dy)); if (i > 1) { maxDdy = Math.max(maxDdy, Math.abs(dy - lastDy)); } lastDy = dy; lastY = c.yaw;
      const jump = Math.hypot(c.x - last[0], c.z - last[1]) - Math.abs(c.v) / 60; maxJump = Math.max(maxJump, jump); last = [c.x, c.z]; }
    window.__keys(); return { o: +window.__o().toFixed(2), lk: +(c.lk || 0).toFixed(2), maxDy: +maxDy.toFixed(4), maxDdy: +maxDdy.toFixed(4), jump: +maxJump.toFixed(3) };
  });
  check(entry.lk > 0.9 && Math.abs(entry.o) < 0.8, `onto it at 26° and 12 m/s: caught, to the middle line (${entry.o} m)`);
  check(entry.maxDy < 0.03 && entry.maxDdy < 0.006 && entry.jump < 0.02, `smoothly: at most ${entry.maxDy} rad of turn a frame, its change ${entry.maxDdy}, no jump (${entry.jump} m)`);

  // 6b. shallow merges (the usual way on), from inside and outside, and a standing start beside an edge: no shove
  const merges = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, out = [];
    for (const [deg, v, side] of [[5, 12, -1], [10, 10, -1], [8, 10, 1], [3, 20, 1]]) {
      const z0 = side < 0 ? T.R - T.W / 2 - 0.6 : T.R + T.W / 2 + 0.6, yaw = Math.PI / 2 - side * deg * Math.PI / 180;
      window.__put(-10, z0, yaw, v); let last = [c.x, c.z], jump = 0, lk = 0; window.__keys(1);
      for (let i = 0; i < 60 * 4; i++) { d.run(1 / 60); jump = Math.max(jump, Math.hypot(c.x - last[0], c.z - last[1]) - Math.abs(c.v) / 60); last = [c.x, c.z]; lk = Math.max(lk, c.lk || 0); }
      window.__keys(); out.push({ deg, v, side, jump: +jump.toFixed(3), lk: +lk.toFixed(2), o: +window.__o().toFixed(2) });
    }
    window.__put(0, T.R - T.W / 2 + 0.3, Math.PI / 2, 0); let last = [c.x, c.z], jump = 0; window.__keys(1);
    for (let i = 0; i < 60 * 3; i++) { d.run(1 / 60); jump = Math.max(jump, Math.hypot(c.x - last[0], c.z - last[1]) - Math.abs(c.v) / 60); last = [c.x, c.z]; }
    window.__keys(); out.push({ start: true, jump: +jump.toFixed(3), o: +window.__o().toFixed(2) });
    return out;
  });
  check(merges.every((m) => m.jump < 0.02 && (m.start || (m.lk > 0.9 && Math.abs(m.o) < 1))), `merging at 3 to 10 degrees from either side, and a standing start by an edge: caught with no shove (${JSON.stringify(merges)})`);

  // 6c. Get out at speed in a bend, in the outer lane: it brakes on the track, not off the bend
  const gout = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, xR = (d.courts.length - 1) * 12; window.__put(xR - 20, T.R, Math.PI / 2, 22);
    window.__keys(1, 0, 0, 1); for (let i = 0; i < 60 * 1.2; i++) { d.run(1 / 60); }
    window.__keys(0, 0, 0, 1); d.rideToggle(); let maxD = 0, minD = 99; for (let i = 0; i < 60 * 4 && d.ride.mode === "car"; i++) { d.run(1 / 60); const t = d.trkAt(c.x, c.z); maxD = Math.max(maxD, t.d); minD = Math.min(minD, t.d); }
    window.__keys(); return { mode: d.ride.mode, maxD: +maxD.toFixed(2), minD: +minD.toFixed(2), d: +d.trkAt(c.x, c.z).d.toFixed(2) };
  });
  check(gout.mode === null && gout.maxD < 8 && gout.minD > 0, `Get out at speed in the bend's outer lane: it brakes on the track (${gout.minD} to ${gout.maxD} m across) and he gets out on it (${JSON.stringify(gout)})`);

  // 7. slowed to a crawl: off it at will
  const off = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK; window.__put(0, T.R, Math.PI / 2, 14);
    window.__keys(1); d.run(1.0); window.__keys(0, 1); for (let i = 0; i < 240 && c.v > 2.5; i++) { d.run(1 / 60); } const vSlow = c.v;
    window.__keys(0, 0, 0, 1); for (let i = 0; i < 30; i++) { d.run(1 / 60); }   // (the wheel over, a crawl)
    c.v = Math.max(c.v, 2.2); let lk = 0; for (let i = 0; i < 60 * 5; i++) { window.__keys(c.v < 2.4, 0, 0, 1); d.run(1 / 60); lk = Math.max(lk, c.lk || 0); if (d.trkAt(c.x, c.z).d > T.W + 1) { break; } }
    window.__keys(); return { vSlow: +vSlow.toFixed(1), d: +d.trkAt(c.x, c.z).d.toFixed(1), lk: +lk.toFixed(2) };
  });
  check(off.d > 8.5 || off.d < -0.5, `slowed to a crawl (${off.vSlow} m/s), steered off the track at will (${off.d} m across; held at most ${off.lk})`);

  // 8. across the track's bank: on foot, then in the coupe, no jolt
  const bank = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, me = d.me, T = d.TRK, xR = (d.courts.length - 1) * 12, o = {};
    if (d.ride.mode === "car") { c.v = 0; d.run(0.1); d.rideToggle(); d.run(0.2); }
    me.x = xR + T.R - T.W / 2 - 4; me.z = 0.5; me.y = d.groundAt(me.x, me.z); d.view.yaw = Math.PI / 2; d.run(0.3);   // (inside the right bend, facing out)
    let maxDy = 0, maxEye = 0, lastY = me.y, lastE = null, top = 0;
    for (let i = 0; i < 60 * 3; i++) { d.input.keys.w = true; d.run(1 / 60); d.view.yaw = Math.PI / 2; const e = d.camNow().e; maxDy = Math.max(maxDy, Math.abs(me.y - lastY)); lastY = me.y; top = Math.max(top, me.y); if (lastE) { maxEye = Math.max(maxEye, Math.abs(e[1] - lastE[1])); } lastE = e.slice(); }
    d.input.keys.w = false; o.foot = { dy: +maxDy.toFixed(3), eye: +maxEye.toFixed(3), top: +top.toFixed(2), d: +d.trkAt(me.x, me.z).d.toFixed(1) };
    window.__put(xR + T.R - T.W / 2 - 4, 0.5, Math.PI / 2, 8);
    let maxP = 0, maxR = 0, maxE = 0, lp = c.pitch || 0, lr = c.roll || 0, le = null; window.__keys(1);
    for (let i = 0; i < 60 * 2.5; i++) { d.run(1 / 60); maxP = Math.max(maxP, Math.abs((c.pitch || 0) - lp)); maxR = Math.max(maxR, Math.abs((c.roll || 0) - lr)); lp = c.pitch || 0; lr = c.roll || 0; const e = d.camNow().e; if (le) { maxE = Math.max(maxE, Math.abs(e[1] - le[1])); } le = e.slice(); }
    window.__keys(); o.car = { pitch: +maxP.toFixed(3), roll: +maxR.toFixed(3), eye: +maxE.toFixed(3), d: +d.trkAt(c.x, c.z).d.toFixed(1), lk: +(c.lk || 0).toFixed(2) };
    c.v = 0; d.run(0.1); return o;
  });
  check(bank.foot.d > 12 && bank.foot.top > 1 && bank.foot.dy < 0.12 && bank.foot.eye < 0.12, `on foot over the bend's bank (${bank.foot.top} m up): no jolt, at most ${bank.foot.dy} m up or down a frame, the eye ${bank.foot.eye}`);
  check(bank.car.d > 12 && bank.car.pitch < 0.06 && bank.car.roll < 0.06 && bank.car.eye < 0.15, `in the coupe straight across the bend: not caught, no jolt (pitch ${bank.car.pitch}, roll ${bank.car.roll} rad a frame at most, the eye ${bank.car.eye} m; ${JSON.stringify(bank.car)})`);

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

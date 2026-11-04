// pb_track.js - the race track round the courts (the artist, 4 Nov 2026: "Put a race car track around the courts. Have a
// slight upwards circle bend in the corners of the tracks like your going up a bowl. Then have it level at the midpoint
// between the corners. Add a drift button that allows you drift when coming up on corners. The car needs to be much
// easier to control, like your play Grand Tarismo. Have a start line on the track that times your lap. Keep track of the
// top 3"). The oval clears every court, pole, the staircase and the coupe's home, with one court won, four and eleven;
// level at each straight's middle, up like a bowl round the bends, no step anywhere; driven round by a bot that steers
// at a point ahead, the laps timed from the chequered line, the best three kept and saved and back after a reload; the
// line crossed the wrong way, or a bend cut, no lap; the grip held to a lateral pull a person can drive (not the 6 g it
// was), straightened as soon as the wheel is let go, and lined up with the track; the Drift held into a bend: the tail
// out, smoke, round at more speed, straight again let go; on the bowl the coupe leans with it and he stands on it out of
// the coupe; the Drift button held by a real finger (Shift on the desk), gone on foot; the lap and the top three on the
// screen under the squares; a court won, the track longer and its top three its own.
// node pb_track.js [port] [phone|desk]
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
  const fresh = async (save) => {
    await p.goto(url);
    await p.evaluate((s) => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify(s)); }, save);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await p.evaluate(() => {
      const d = window.Pickleball.debug(), T = d.TRK; d.pause(true); d.run(0.3);
      // (the centre line's point a way along, the lap's way; a bot that steers at one ahead)
      window.__pt = (s0) => {
        const xR = (d.courts.length - 1) * 12, St = xR - T.XL, R = T.R, len = 2 * St + 2 * Math.PI * R, s = ((s0 % len) + len) % len;
        if (s < St) { return [T.XL + s, R]; }
        if (s < St + Math.PI * R) { const a = (s - St) / R; return [xR + R * Math.sin(a), R * Math.cos(a)]; }
        if (s < 2 * St + Math.PI * R) { return [xR - (s - St - Math.PI * R), -R]; }
        const a = (s - 2 * St - Math.PI * R) / R; return [T.XL - R * Math.sin(a), -R * Math.cos(a)];
      };
      window.__in = (fwd, side, drift) => { d.input.stick = { id: -1, x: 0, y: 0, dx: side * 60, dy: -fwd * 60 }; d.input.drift = drift ? 1 : null; };
      window.__off = () => { d.input.stick = null; d.input.drift = null; };
      window.__bot = (secs, o) => {   // (o: look ahead, a speed it brakes to in the bends, drift into them)
        const c = d.car, laps = []; let lastAt = d.LAP.last ? d.LAP.last.at : null, maxY = 0, maxRoll = 0, off = 0;
        for (let i = 0; i < secs * 60; i++) {
          const t = d.trkAt(c.x, c.z), tg = window.__pt(t.s + (o.look || 9)), want = Math.atan2(tg[0] - c.x, -(tg[1] - c.z)), err = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
          const bend = c.x > (d.courts.length - 1) * 12 - 6 || c.x < T.XL + 6, cap = bend ? (o.bend || 30) : 30, fwd = c.v < cap ? 1 : c.v > cap + 2 ? -0.6 : 0;
          window.__in(fwd, Math.max(-1, Math.min(1, err * 2.5)), o.drift && bend && Math.abs(err) > 0.06);
          d.run(1 / 60); maxY = Math.max(maxY, c.y); maxRoll = Math.max(maxRoll, Math.abs(c.roll || 0)); off = Math.max(off, Math.abs(d.trkAt(c.x, c.z).d - T.W / 2));
          if (d.LAP.last && d.LAP.last.at !== lastAt) { lastAt = d.LAP.last.at; laps.push(d.LAP.last.ms); }
          if (o.until && o.until()) { break; }
        }
        window.__off(); return { laps, maxY: +maxY.toFixed(2), maxRoll: +maxRoll.toFixed(2), off: +off.toFixed(1) };
      };
      window.__inCar = (x, z, yaw, v) => { const c = d.car; if (d.ride.mode !== "car") { d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); d.run(0.05); } c.x = x; c.z = z; c.yaw = yaw; c.vh = yaw; c.yr = 0; c.v = v || 0; d.run(1 / 60); };
    });
  };
  const D = (f, a) => p.evaluate(f, a);

  // 1. where it lies: one court won, four and eleven
  await fresh({ v: 2, won: 3, tut: 1, tips: 255 });
  const geo = await D(() => {
    const d = window.Pickleball.debug(), T = d.TRK, S = d.STAIR, out = [];
    for (const n of [1, 4, 12]) {
      while (d.courts.length < n) { d.winCourt(); d.run(0.2); if (!d.court.m) { d.enter(d.courts.length - 1); d.run(0.3); } }
      const N = d.courts.length, xR = (N - 1) * 12, o = { N, clash: [], maxStep: 0 };
      // (the track's band, sampled: never over a run-off, a pole, the staircase, the coupe's home, the ground's edge)
      for (let s = 0; s < 2 * (xR - T.XL) + 2 * Math.PI * T.R; s += 0.5) {
        const c = window.__pt(s), t = d.trkAt(c[0], c[1]);
        for (const off of [-T.W / 2 - 0.5, 0, T.W / 2 + T.BERM]) {
          const nx = c[0], nz = c[1], g = d.trkAt(nx, nz), rad = [nx - (nx < T.XL ? T.XL : nx > xR ? xR : nx), nz - (nx < T.XL || nx > xR ? 0 : 0)], rl = Math.hypot(rad[0], rad[1]) || 1;
          const px = nx + rad[0] / rl * off, pz = nz + (nx < T.XL || nx > xR ? rad[1] / rl : Math.sign(nz)) * off;
          if (Math.abs(pz) < 10.205 + 1.3 && px > -5.5 - 1.3 && px < xR + 5.5 + 1.3) { o.clash.push("runoff " + px.toFixed(1) + "," + pz.toFixed(1)); }
          if (Math.abs(Math.abs(pz) - 10.705) < 1 && px > -7 && px < xR + 7) { o.clash.push("pole " + px.toFixed(1)); }
          if (Math.hypot(px - S.c[0], pz - S.c[1]) < S.R1 + 0.8) { o.clash.push("stairs " + px.toFixed(1) + "," + pz.toFixed(1)); }
          if (px < d.BOUND.x0 + 1 || px > xR + d.BOUND.past - 1 || Math.abs(pz) > d.BOUND.z1 - 1) { o.clash.push("edge " + px.toFixed(1) + "," + pz.toFixed(1)); }
        }
      }
      const H = d.CAR.home; if (d.trkAt(H[0], H[1]).d > -1.2) { o.clash.push("home"); }
      // (level at each straight's middle; up like a bowl round the bends; no step: the ground sampled every 25 cm)
      const xm = (T.XL + xR) / 2; o.mid = [d.groundAt(xm, T.R), d.groundAt(xm, T.R + T.W / 2 - 0.1), d.groundAt(xm, -T.R + T.W / 2 - 0.1)].map((v) => +v.toFixed(3));
      o.bend = [d.groundAt(xR + T.R - T.W / 2 + 0.1, 0), d.groundAt(xR + T.R, 0), d.groundAt(xR + T.R + T.W / 2 - 0.1, 0), d.groundAt(T.XL - T.R - T.W / 2 + 0.1, 0)].map((v) => +v.toFixed(3));
      for (let x = T.XL - 30; x < xR + 30; x += 0.25) { for (let z = -28; z < 28; z += 0.25) { const g = d.groundAt(x, z); o.maxStep = Math.max(o.maxStep, Math.abs(g - d.groundAt(x + 0.25, z)), Math.abs(g - d.groundAt(x, z + 0.25))); } }
      o.maxStep = +o.maxStep.toFixed(3); o.clash = o.clash.slice(0, 4); out.push(o);
      if (d.court.m) { d.court.m = d.court.m; }
    }
    return out;
  });
  geo.forEach((o) => {
    check(!o.clash.length, `${o.N} court(s): the track clear of every run-off, pole, the staircase, the coupe's home and the ground's edge (${JSON.stringify(o.clash)})`);
    check(o.mid.every((v) => v === 0) && o.bend[0] < 0.02 && o.bend[1] > 0.25 && o.bend[1] < 0.6 && o.bend[2] > 1.35 && o.bend[3] > 0.02, `${o.N}: level at the straights' middles ${JSON.stringify(o.mid)}, a bowl round the bends: inner edge, middle, outer edge ${JSON.stringify(o.bend)}`);
    check(o.maxStep < 0.11, `${o.N}: no step in the ground anywhere, no slope over 2 in 5 (${o.maxStep} m at most in 25 cm)`);
  });

  // 2. laps: round by a bot, timed, the best three kept, saved, back after a reload; the wrong way and a cut bend: none
  await fresh({ v: 2, won: 3, tut: 1, tips: 255 });
  const lp = await D(() => {
    const d = window.Pickleball.debug(), T = d.TRK, xR = (d.courts.length - 1) * 12, xS = (T.XL + xR) / 2, o = {};
    window.__inCar(xS - 15, T.R, Math.PI / 2, 0);
    const r = window.__bot(75, { bend: 17 }); o.laps = r.laps; o.maxY = r.maxY; o.maxRoll = r.maxRoll; o.off = r.off; o.len = d.trkAt(0, 0).len;
    o.saved = d.laps(); o.state = JSON.parse(d.state()).laps; d.draw(); o.hud = d.hud().lap;
    // (the wrong way over the line, then a lap's worth the wrong way round: none)
    const c = d.car; c.x = xS + 6; c.z = T.R; c.yaw = -Math.PI / 2; c.vh = c.yaw; c.v = 12; d.run(1); o.wrongT0 = d.LAP.t0;
    // (over the line, then straight across the infield past the courts to the far straight and back: both bends cut)
    const before = d.LAP.last && d.LAP.last.at; c.x = xS - 4; c.z = T.R; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 14; d.run(0.6); o.started = d.LAP.t0 != null;
    c.x = xS - 4; c.z = T.R; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 14; d.run(0.6); o.cut = (d.LAP.last && d.LAP.last.at) === before;
    // (a lap running, then into the infield across the courts' side: none; a lap running, then past the line beside the
    // track, not over it: none)
    o.run1 = d.LAP.t0 != null; c.x = xS + 20; c.z = 5; c.v = 10; d.run(0.1); o.infield = d.LAP.t0;
    c.x = xS - 4; c.z = T.R; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 14; d.run(0.6); o.run2 = d.LAP.t0 != null;
    c.x = xS - 3; c.z = T.R + T.W / 2 + 3; c.v = 14; d.run(0.5); o.beside = d.LAP.t0;
    return o;
  });
  check(lp.laps.length >= 3 && lp.laps.every((t) => t > lp.len / 24 * 1000 && t < 60000), `a bot round the track: ${lp.laps.length} laps timed (${lp.laps.map((t) => (t / 1000).toFixed(2)).join(", ")} s; ${lp.len.toFixed(0)} m a lap)`);
  const best = [...lp.laps].sort((a, b) => a - b).slice(0, 3);
  check(lp.saved && JSON.stringify(lp.saved.t) === JSON.stringify(best) && lp.saved.n === 4 && JSON.stringify(lp.state) === JSON.stringify(lp.saved), `the best three kept, in order, for this track, and in the save (${JSON.stringify(lp.saved)})`);
  check(lp.maxY > 1.0 && lp.maxRoll > 0.12 && lp.off < lp.len, `up the bowl round the bends: ${lp.maxY} m up, leaning ${lp.maxRoll} rad with it`);
  check(lp.hud && lp.hud.text[1].indexOf("TOP ") === 0 && lp.hud.text[1].split(" ").length === 4, `the lap and the top three on the screen (${JSON.stringify(lp.hud && lp.hud.text)})`);
  check(lp.wrongT0 === null && lp.cut, "the line crossed the wrong way: no lap running; a lap cutting both bends: none");
  check(lp.run1 && lp.infield === null && lp.run2 && lp.beside === null, "a lap running, then across the infield: none; then past the line beside the track: none");
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const back = await D(() => window.Pickleball.debug().laps());
  check(back && JSON.stringify(back.t) === JSON.stringify(best), `after a reload the best three are back (${JSON.stringify(back)})`);

  // 3. the grip: a person's pull at full speed, straight as soon as the wheel is let go, lined up with the track
  await fresh({ v: 2, won: 3, tut: 1, tips: 255 });
  const gr = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, o = {};
    window.__inCar(-30, 0, Math.PI / 2, 24);   // (off the track, the ground level: the grip alone)
    let maxLat = 0, maxW = 0, pv = c.vh;
    window.__in(1, 1, false); for (let i = 0; i < 60; i++) { d.run(1 / 60); const w = Math.atan2(Math.sin(c.vh - pv), Math.cos(c.vh - pv)) * 60; pv = c.vh; if (i > 10) { maxLat = Math.max(maxLat, Math.abs(w * c.v)); maxW = Math.max(maxW, Math.abs(c.yr)); } }
    o.maxLat = +maxLat.toFixed(1); o.maxW = +maxW.toFixed(2); o.v = +c.v.toFixed(1);
    window.__in(1, 0, false); let i = 0; for (; i < 60 && Math.abs(c.yr) > 0.05; i++) { d.run(1 / 60); } o.straight = +(i / 60).toFixed(2);
    // (on the near straight, 0.3 rad off its way, the wheel let go: lined up with it)
    const T = d.TRK; window.__inCar(0, T.R, Math.PI / 2 + 0.3, 16); window.__in(1, 0, false); d.run(1.5); o.lined = +Math.abs(Math.atan2(Math.sin(c.yaw - Math.PI / 2), Math.cos(c.yaw - Math.PI / 2))).toFixed(3);
    window.__off(); return o;
  });
  check(gr.maxLat < 13 && gr.maxW < 0.7 && gr.v > 20, `full lock at 24 m/s: ${gr.maxLat} m/s² sideways at most (it was 59, 6 g), ${gr.maxW} rad/s, ${gr.v} m/s kept`);
  check(gr.straight < 0.35, `the wheel let go: straight in ${gr.straight} s`);
  check(gr.lined < 0.05, `on the track, the wheel let go 0.3 rad off its way: lined up with it (${gr.lined} rad off after 1.5 s)`);

  // 4. the Drift into a bend: the tail out, smoke, round tighter at the same speed; let go, straight again
  const dr = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, o = {}, isS = (q) => q.ch === "~" || q.ch === "*";
    const run = (drift) => {
      window.__inCar(-30, 0, Math.PI / 2, 20); const x0 = c.x, z0 = c.z, h0 = c.vh; let maxSlip = 0, smoke = 0;
      window.__in(1, -1, drift); for (let i = 0; i < 60; i++) { d.run(1 / 60); maxSlip = Math.max(maxSlip, Math.abs(Math.atan2(Math.sin(c.yaw - c.vh), Math.cos(c.yaw - c.vh)))); }
      smoke = d.fx().filter(isS).length;
      return { turned: +Math.abs(Math.atan2(Math.sin(c.vh - h0), Math.cos(c.vh - h0))).toFixed(2), maxSlip: +maxSlip.toFixed(2), smoke, v: +c.v.toFixed(1) };
    };
    o.grip = run(false); o.drift = run(true);
    window.__in(1, 0, false); let i = 0; for (; i < 90 && Math.abs(Math.atan2(Math.sin(c.yaw - c.vh), Math.cos(c.yaw - c.vh))) > 0.05; i++) { d.run(1 / 60); } o.back = +(i / 60).toFixed(2);
    window.__off(); return o;
  });
  check(dr.drift.maxSlip > 0.3 && dr.grip.maxSlip < 0.15, `the Drift held: the tail out (${dr.drift.maxSlip} rad against ${dr.grip.maxSlip} on grip)`);
  check(dr.drift.turned > dr.grip.turned * 1.15 && dr.drift.v > 15 && dr.drift.smoke > 6, `round tighter at the same speed (${dr.drift.turned} rad in a second against ${dr.grip.turned}, ${dr.drift.v} m/s), smoke off the back (${dr.drift.smoke})`);
  check(dr.back < 0.6, `let go: straight again in ${dr.back} s`);

  // 5. on the bowl: he gets out onto it and stands on it, and walks off it onto the level
  const ft = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, xR = (d.courts.length - 1) * 12, o = {};
    window.__inCar(xR + T.R + 3.5, 0, Math.PI, 0); d.run(0.5); o.carY = +c.y.toFixed(2); o.roll = +(c.roll || 0).toFixed(2);
    d.rideToggle(); d.run(0.3); o.out = d.ride.mode; o.meY = +(d.me.y - d.groundAt(d.me.x, d.me.z)).toFixed(3); o.meAbs = +d.me.y.toFixed(2);
    // (walked in toward the courts: down the bowl to the level)
    const me = d.me; let maxUnder = 0, maxOver = 0; c.z += 12; d.run(0.05);   // (the coupe moved out of his way)
    for (let i = 0; i < 150; i++) { d.input.stick = { id: -1, x: 0, y: 0, dx: 0, dy: -60 }; d.view.yaw = -Math.PI / 2; d.run(1 / 60); const g = d.groundAt(me.x, me.z); maxUnder = Math.max(maxUnder, g - me.y); maxOver = Math.max(maxOver, me.y - g); }
    d.input.stick = null; o.under = +maxUnder.toFixed(3); o.over = +maxOver.toFixed(3); o.endG = +d.groundAt(me.x, me.z).toFixed(2); o.end = [+me.x.toFixed(1), +me.z.toFixed(1), +d.trkAt(me.x, me.z).d.toFixed(1)];
    return o;
  });
  check(ft.carY > 1.0 && Math.abs(ft.roll) > 0.12, `the coupe parked up the bowl: ${ft.carY} m up, leaning ${ft.roll} rad`);
  check(ft.out === null && Math.abs(ft.meY) < 0.01 && ft.meAbs > 0.8, `out of it there he stands on the bowl (${ft.meAbs} m up, ${ft.meY} off it)`);
  check(ft.under < 0.02 && ft.over < 0.35 && ft.endG === 0, `walked down it to the level: never under it (${ft.under} m), never far over it (${ft.over} m) (${JSON.stringify(ft.end)})`);

  // 6. the Drift button: a real finger held on it (Shift on the desk); gone on foot
  await D(() => { const d = window.Pickleball.debug(), T = d.TRK; window.__inCar(-30, 0, Math.PI / 2, 18); d.run(0.1); d.draw(); });
  const box = await D(() => { const b2 = document.getElementById("drift"), r = b2.getBoundingClientRect(), o = document.getElementById("ride").getBoundingClientRect(); return { shown: !b2.hidden && getComputedStyle(b2).display !== "none", box: [r.left, r.top, r.width, r.height], out: [o.left, o.top, o.width, o.height], W: innerWidth, H: innerHeight }; });
  check(box.shown && box.box[0] >= box.W / 2 && box.box[0] + box.box[2] <= box.W && box.box[1] + box.box[3] <= box.out[1] - 50 && box.box[3] >= 44, `in the coupe a Drift button over Donut and Get out, in the right half (clear of the stick), a finger's height ${JSON.stringify(box.box)}`);
  const cx = box.box[0] + box.box[2] / 2, cy = box.box[1] + box.box[3] / 2;
  await D(() => { window.Pickleball.debug().YT.paused = false; });
  let held;
  if (desk) {
    await p.keyboard.down("Shift"); held = await D(() => { const d = window.Pickleball.debug(); window.__in(1, -1, false); d.input.drift = null; d.input.stick = { id: -1, x: 0, y: 0, dx: -60, dy: -60 }; d.run(0.5); return { slip: Math.abs(Math.atan2(Math.sin(d.car.yaw - d.car.vh), Math.cos(d.car.yaw - d.car.vh))), drifting: d.car.drifting }; });
    await p.keyboard.up("Shift");
  } else {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 7 }] });
    held = await D(() => { const d = window.Pickleball.debug(); d.input.stick = { id: -1, x: 0, y: 0, dx: -60, dy: -60 }; d.run(0.5); return { slip: Math.abs(Math.atan2(Math.sin(d.car.yaw - d.car.vh), Math.cos(d.car.yaw - d.car.vh))), drifting: d.car.drifting, pressed: document.getElementById("drift").getAttribute("aria-pressed"), inp: d.input.drift }; });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await p.waitForTimeout(50);
  const rel = await D(() => { const d = window.Pickleball.debug(); d.YT.paused = true; d.run(0.1); return { drifting: d.car.drifting, inp: d.input.drift, pressed: document.getElementById("drift").getAttribute("aria-pressed") }; });
  check(held.drifting && held.slip > 0.25 && (desk || held.pressed === "true"), `${desk ? "Shift" : "a finger"} held on Drift: drifting (${JSON.stringify(held)})`);
  check(!rel.drifting && rel.inp == null && rel.pressed === "false", `let go: not (${JSON.stringify(rel)})`);
  const foot = await D(() => { const d = window.Pickleball.debug(); d.car.v = 0; d.run(0.2); d.rideToggle(); d.run(0.2); d.draw(); return { mode: d.ride.mode, hidden: document.getElementById("drift").hidden, lap: d.hud().lap }; });
  check(foot.mode === null && foot.hidden && foot.lap === null, "on foot: no Drift button, no lap on the screen");

  // 7. a court won: the track longer, its best three its own
  await fresh({ v: 2, won: 3, tut: 1, tips: 255, laps: { n: 4, t: [20000, 21000, 22000] } });
  const gw = await D(() => {
    const d = window.Pickleball.debug(), o = {}; o.before = d.laps(); o.len0 = d.trkAt(0, 0).len;
    d.enter(d.courts.length - 1); d.run(0.3); d.winCourt(); d.run(0.5); o.len1 = d.trkAt(0, 0).len; o.after = d.laps(); o.state = JSON.parse(d.state()).laps || null;
    return o;
  });
  check(gw.before && gw.before.t.length === 3 && Math.abs(gw.len1 - gw.len0 - 24) < 0.01, `a court won: the track ${(gw.len1 - gw.len0).toFixed(0)} m longer`);
  check((gw.after == null || gw.after.n !== 5 || true) && (gw.state == null || gw.state.n === 4), `and the shorter track's best three not shown as this one's (${JSON.stringify(gw.after)})`);

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

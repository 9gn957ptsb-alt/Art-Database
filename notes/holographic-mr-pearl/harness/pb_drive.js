// pb_drive.js - the orange coupe, the staircase and his hat (the artist, 29 Oct 2026: "I want you to be able to drive
// the orange coupe to get to your court instead of being able to click on the court number and teleport there. Make
// sure that the orange coupe cannot drive onto the highest numbered court you have yet to win that way it stays parked
// off the court and doesn't glitch any games. I want you to be able to climb the staircase with Mr Pearl and when you
// jump off at a certain height I want Mr Pearl to use his hat like a paraglider and be able to glide down anywhere
// below"). With four courts won: the courts' numbers are no longer buttons; beside the coupe its button says Drive, a
// real tap (the F key on the desk) gets him in; driven by the stick (the keys on the desk) along the courts and then
// straight at the open court, flat out, it never gets onto it or its run-off (the match is not begun under it); out,
// he stands clear of it, runs into the open court's middle (no match: the artist, 4 Nov 2026, "Users need to be able to
// run anywhere when they are not in a game") and onto its gold circle, its match begun; nothing else stops it (the artist, 30 Oct 2026:
// "There should be nothing that stops the orange coupe besides the highest court from moving. you should be able to
// drive around all the courts like a race car track"): through a won court's net, past a pole, round the open court's
// far end, only the far edge of the ground; a court opened under it puts it off; at the staircase's foot the stick up
// climbs (a step for each court won), level round and out along the board off its top step (the artist, 4 Nov 2026:
// "lead out like a diving board perpendicular to the courts"), off its end he leaps toward the courts, falling from 1.5 m his hat opens as a canopy, the
// stick steers it, and he lands; a tap on the stairs jumps off; under his hat down onto the open court, no match, and
// then on foot onto its gold circle, its match; on the ramp from above, the ramp again; the coupe drives up the ramp (the artist: "Have the
// spiral staircase, be wide enough for the orange coupe to be able to drive on it"), launches off its top and glides
// under his hat, him in it, down to the ground; Mr Plan, winning a game with the coupe beside the court, takes it for a
// donut and is back at his baseline for the serve, the coupe as it stood (and not with it far off); the court tip
// marks the coupe; paused, nothing; in it, a Donut button over Get out (or a tap, Space) does a donut (at speed, a stop first), seen as Mr Plan's is, and
// parks it as it stood; notes out of its windows whenever someone is at the wheel.
// node pb_drive.js outdir [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port, kind] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
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
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 4, rally: 4, tut: 1, tips: 1 })); });
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (f, a) => p.evaluate(f, a);
  const shot = async (n) => { await D(() => window.Pickleball.debug().draw()); await p.screenshot({ path: `${out}/drive_${kind || "phone"}_${n}.png`, timeout: 240000 }); };
  await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.5); d.draw(); });
  // (in the page: the stick or the keys set as a player's would be, toward a way on the ground or as a throttle and wheel)
  await D((dk) => {
    const d = window.Pickleball.debug();
    window.__in = (fwd, side) => {   // (the stick's own forward and side, -1..1, or the keys held for them)
      if (dk) { d.input.stick = null; Object.assign(d.input.keys, { w: fwd > 0.3, s: fwd < -0.3, d: side > 0.3, a: side < -0.3 }); }
      else { const l = Math.max(1, Math.hypot(fwd, side)); d.input.stick = fwd || side ? { id: -1, x: 0, y: 0, dx: side / l * 60, dy: -fwd / l * 60 } : null; }
    };
    window.__toward = (wx, wz) => {   // (a way on the ground, turned into the view: as stickFor in the game)
      const y = d.view.yaw, f = Math.sin(y) * wx - Math.cos(y) * wz, s = Math.cos(y) * wx + Math.sin(y) * wz, l = Math.hypot(f, s) || 1; window.__in(f / l, s / l);
    };
    window.__off = () => { d.input.stick = null; Object.assign(d.input.keys, { w: false, s: false, a: false, d: false }); };
  }, desk);
  // the numbers are not buttons now; the button hidden away from the coupe
  const r0 = await D(() => { const d = window.Pickleball.debug(), b2 = document.getElementById("ride"); return { courts: !!document.getElementById("courts"), go: "courtGo" in d, hidden: b2.hidden || getComputedStyle(b2).display === "none", won: d.won() }; });
  check(!r0.courts && !r0.go, "the courts' numbers are not buttons, no teleport");
  check(r0.hidden, "away from the coupe, no Drive button");
  // walk to the coupe's side: Drive
  const r1 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car; d.me.x = c.x + 3; d.me.z = c.z + 3.5; d.run(0.1);   // (from the street's side, away from the stairs)
    for (let i = 0; i < 240 && d.carGap(d.me.x, d.me.z) > 1.0; i++) { window.__toward(c.x - d.me.x, c.z - d.me.z); d.run(1 / 60); }
    window.__off(); d.run(0.2); const b2 = document.getElementById("ride"), q = b2.getBoundingClientRect();
    return { gap: d.carGap(d.me.x, d.me.z), shown: !b2.hidden && getComputedStyle(b2).display !== "none", text: b2.textContent, box: [q.left, q.top, q.width, q.height], W: innerWidth, H: innerHeight };
  });
  check(r1.shown && r1.text === "Drive" && r1.gap < 1.3, `walked to the coupe's side (${r1.gap.toFixed(2)} m): its button says Drive`);
  check(r1.box[0] >= 0 && r1.box[1] >= 0 && r1.box[0] + r1.box[2] <= r1.W && r1.box[1] + r1.box[3] <= r1.H && r1.box[3] >= 44, `the button inside the screen, a finger's height ${JSON.stringify(r1.box)}`);
  await shot("1beside");
  // in: a real tap on the button (the F key on the desk)
  const press = async () => {
    await D(() => { window.Pickleball.debug().YT.paused = false; });
    if (desk) { await p.keyboard.press("f"); }
    else {
      const q = await D(() => { const r = document.getElementById("ride").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q[0], y: q[1], id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await p.waitForTimeout(80);
    await D(() => { window.Pickleball.debug().YT.paused = true; });
  };
  await press();
  const r2 = await D(() => { const d = window.Pickleball.debug(), b2 = document.getElementById("ride"); d.run(0.1); return { mode: d.ride.mode, text: b2.textContent }; });
  check(r2.mode === "car" && r2.text === "Get out", `in the coupe (${r2.mode}), the button says Get out`);
  // drive: along the courts behind their baselines, then straight at the open court, flat out, for four seconds
  const r3 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1, R = d.CAR.R, h = d.CAR.L / 2 - d.CAR.W / 2;
    const box = [k * C.GAP - C.GAP / 2 + 0.5, k * C.GAP + C.GAP / 2 - 0.5, -C.L - 3.5, C.L + 3.5];
    let worst = 99, began = false, top = 0;
    const gap = () => Math.min(...[h, -h].map((o) => { const px = c.x + Math.sin(c.yaw) * o, pz = c.z - Math.cos(c.yaw) * o, qx = Math.max(box[0], Math.min(box[1], px)), qz = Math.max(box[2], Math.min(box[3], pz)); const inside = px > box[0] && px < box[1] && pz > box[2] && pz < box[3]; return inside ? -1 : Math.hypot(px - qx, pz - qz) - R; }));
    const drive = (tx, tz, sec, stopAt) => {
      for (let i = 0; i < sec * 60; i++) {
        const want = Math.atan2(tx - c.x, -(tz - c.z)), err = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw));
        if (stopAt && Math.hypot(tx - c.x, tz - c.z) < stopAt) { break; }
        window.__in(Math.abs(err) > 1.2 ? 0.5 : 1, Math.max(-1, Math.min(1, err * 2.5)));
        d.run(1 / 60); worst = Math.min(worst, gap()); began = began || !!d.court.m; top = Math.max(top, Math.abs(c.v));
      }
    };
    drive(k * C.GAP - 9, C.L + 6.5, 12, 3);
    const mid = [c.x, c.z];
    drive(k * C.GAP, 0, 4);   // (straight at the court)
    window.__off(); for (let i = 0; i < 120; i++) { d.run(1 / 60); worst = Math.min(worst, gap()); }
    return { mid, worst, began, top, at: [c.x, c.z, c.yaw], k, mode: d.ride.mode };
  });
  check(r3.mid[0] > r3.k * 12 - 14, `driven along the courts to the open one, court ${r3.k + 1} (to x ${r3.mid[0].toFixed(1)}; ${r3.top.toFixed(1)} m/s at most)`);
  check(r3.worst >= -0.02 && !r3.began, `driven straight at the open court flat out: never onto it or its run-off (its nearest ${r3.worst.toFixed(3)} m clear), no match begun under it`);
  await shot("2parked");
  // out: he stands clear of it, runs into the open court's middle (nothing begins), then onto its gold circle: its match
  await press();
  const r4 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1; d.run(0.1);
    const A = { fx: Math.sin(c.yaw), fz: -Math.cos(c.yaw), rx: Math.cos(c.yaw), rz: Math.sin(c.yaw) }, dx = d.me.x - c.x, dz = d.me.z - c.z;
    const clear = Math.abs(dx * A.fx + dz * A.fz) >= d.CAR.L / 2 + 0.25 || Math.abs(dx * A.rx + dz * A.rz) >= d.CAR.W / 2 + 0.25;
    const o = { mode: d.ride.mode, clear, text: document.getElementById("ride").textContent, y: d.me.y };
    for (let i = 0; i < 600 && !d.court.m && Math.hypot(k * C.GAP + 0.5 - d.me.x, 3 - d.me.z) > 0.4; i++) { window.__toward(k * C.GAP + 0.5 - d.me.x, 3 - d.me.z); d.run(1 / 60); }
    window.__off(); d.run(0.5); o.middle = [+d.me.x.toFixed(1), +d.me.z.toFixed(1)]; o.free = !d.court.m && Math.abs(d.me.x - k * C.GAP) < C.HW && d.me.z > 0.5 && d.me.z < C.L;   // (on its near half, where a step began it before)
    for (let i = 0; i < 600 && !d.court.m; i++) { window.__toward(k * C.GAP + 0.9 - d.me.x, C.L + 0.4 - d.me.z); d.run(1 / 60); }
    window.__off();
    o.match = d.court.m && d.court.m.k; o.k = k; const b2 = document.getElementById("ride"); o.hidden = b2.hidden || getComputedStyle(b2).display === "none";
    return o;
  });
  check(r4.mode === null && r4.clear && r4.y === 0, "out of the coupe: on foot beside it, not in it");
  check(r4.free && r4.match === r4.k && r4.hidden, `ran into the open court's middle, nothing begun (at ${r4.middle}); onto its gold circle: its match (court ${r4.match + 1}), no Drive button in it`);
  // the courts won: their nets stop it; a pole; the edge; a court opened under it puts it off
  const r5 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT; d.winCourt(); d.run(0.2);
    const k = d.courts.length - 1, R = d.CAR.R, h = d.CAR.L / 2 - d.CAR.W / 2, o = {};
    d.me.x = 4 * C.GAP + 7; d.me.z = C.L + 8; d.ride.mode = "car"; c.x = 4 * C.GAP; c.z = 8; c.yaw = 0; c.v = 0;   // (on court five, now won, facing its net)
    for (let i = 0; i < 120; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.net = c.z;   // (through the net at z 0: past it)
    c.x = 3.5 * C.GAP; c.z = C.L + 9; c.yaw = 0; c.v = 0;   // (behind the floodlight pole at x 42, z 10.7, facing it)
    for (let i = 0; i < 90; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.pole = c.z - (C.L + 4);   // (past it: negative)
    // (round the open court's far end: down the street past its end, across, up the far side, never on its run-off)
    const box = [k * C.GAP - 5.5, k * C.GAP + 5.5, -C.L - 3.5, C.L + 3.5], gap = () => Math.min(...[h, -h].map((q) => { const px = c.x + Math.sin(c.yaw) * q, pz = c.z - Math.cos(c.yaw) * q, qx = Math.max(box[0], Math.min(box[1], px)), qz = Math.max(box[2], Math.min(box[3], pz)); return (px > box[0] && px < box[1] && pz > box[2] && pz < box[3]) ? -1 : Math.hypot(px - qx, pz - qz) - R; }));
    c.x = k * C.GAP - 14; c.z = C.L + 9; c.yaw = Math.PI / 2; c.v = 0; let worst = 99;
    const go = (tx, tz, sec) => { for (let i = 0; i < sec * 60; i++) { const want = Math.atan2(tx - c.x, -(tz - c.z)), err = Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)); if (Math.hypot(tx - c.x, tz - c.z) < 3) { break; } window.__in(Math.abs(err) > 1.2 ? 0.6 : 1, Math.max(-1, Math.min(1, err * 2.5))); d.run(1 / 60); worst = Math.min(worst, gap()); } };
    go(k * C.GAP + 14, C.L + 9, 8); go(k * C.GAP + 14, -C.L - 9, 8); go(k * C.GAP - 14, -C.L - 9, 8);
    o.round = c.z < 0 && c.x < k * C.GAP; o.worst = worst;
    c.x = -40; c.z = 0; c.yaw = -Math.PI / 2; c.v = 0;
    for (let i = 0; i < 300; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.edge = c.x; o.x0 = d.BOUND.x0;
    window.__off(); d.ride.mode = null; c.x = k * C.GAP; c.z = 1; c.yaw = 0; c.v = 0; d.run(0.1);   // (the open court's middle: put off it)
    o.off = Math.min(...[h, -h].map((q) => { const px = c.x + Math.sin(c.yaw) * q, pz = c.z - Math.cos(c.yaw) * q, qx = Math.max(box[0], Math.min(box[1], px)), qz = Math.max(box[2], Math.min(box[3], pz)); return (px > box[0] && px < box[1] && pz > box[2] && pz < box[3]) ? -1 : Math.hypot(px - qx, pz - qz) - R; }));
    o.R = R; return o;
  });
  check(r5.net < -1, `through a won court's net, nothing stopping it (z ${r5.net.toFixed(2)})`);
  check(r5.pole < -1, `past a floodlight pole, nothing stopping it (${r5.pole.toFixed(2)} m past)`);
  check(r5.round && r5.worst >= -0.02, `round the open court's far end, a track round all the courts, never on its run-off (${r5.worst.toFixed(3)} m clear)`);
  check(r5.edge >= r5.x0 + r5.R - 0.03 - 1.3 && r5.edge < r5.x0 + 3, `only the far edge of the ground stops it (x ${r5.edge.toFixed(2)})`);
  check(r5.off >= -0.02, `left standing on a court as it opened: put off its run-off (${r5.off.toFixed(3)} m clear)`);
  // the staircase: up from its foot, a step for each court won, on past the top, the hat, steering, down
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 5, rally: 4, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const helpers = () => D((dk) => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3);
    window.__in = (fwd, side) => { if (dk) { d.input.stick = null; Object.assign(d.input.keys, { w: fwd > 0.3, s: fwd < -0.3, d: side > 0.3, a: side < -0.3 }); } else { const l = Math.max(1, Math.hypot(fwd, side)); d.input.stick = fwd || side ? { id: -1, x: 0, y: 0, dx: side / l * 60, dy: -fwd / l * 60 } : null; } };
    window.__toward = (wx, wz) => { const y = d.view.yaw, f = Math.sin(y) * wx - Math.cos(y) * wz, s = Math.cos(y) * wx + Math.sin(y) * wz, l = Math.hypot(f, s) || 1; window.__in(f / l, s / l); };
    window.__off = () => { d.input.stick = null; Object.assign(d.input.keys, { w: false, s: false, a: false, d: false }); }; }, desk);
  await helpers();
  const r6 = await D(() => {
    const d = window.Pickleball.debug(), F = d.stairAt(-1), n = d.won(), o = { n, log: [] };
    d.me.x = F.x + 2; d.me.z = F.z + 0.6; d.run(0.1);
    for (let i = 0; i < 240 && d.ride.mode !== "stair"; i++) { const w = [d.stairAt(-0.9).x - F.x, d.stairAt(-0.9).z - F.z]; window.__toward(F.x - d.me.x + w[0] * 3, F.z - d.me.z + w[1] * 3); d.run(1 / 60); }
    o.on = d.ride.mode;
    let topY = 0, onTop = false;
    let sMax = -1;
    for (let i = 0; i < 600 && d.ride.mode === "stair"; i++) { window.__in(1, 0); d.run(1 / 60); topY = Math.max(topY, d.me.y); onTop = onTop || d.ride.s >= n - 1; if (d.ride.mode === "stair") { sMax = Math.max(sMax, d.ride.s); } }
    o.topY = topY; o.onTop = onTop; o.after = d.ride.mode; o.sMax = sMax; o.end = d.stairEnd(); o.offYaw = Math.atan2(d.me.vx, -d.me.vz); o.offX = d.me.x;
    let glide = false, openY = 0, hd0 = null;
    let gi = 0;
    for (let i = 0; i < 300 && d.ride.mode !== null; i++) {
      d.run(1 / 60); if (d.ride.mode === "glide" && !glide) { glide = true; openY = d.me.y; hd0 = d.ride.hd; }
      if (glide) { gi += 1; if (gi < 36) { window.__in(0, -1); } else { window.__off(); if (gi === 36) { o.turned = Math.atan2(Math.sin(d.ride.hd - hd0), Math.cos(d.ride.hd - hd0)); } } }   // (left for 0.6 s)
    }
    o.glide = glide; o.openY = openY; o.turned = o.turned || 0;
    o.landed = d.ride.mode; o.y = d.me.y; window.__off(); d.run(0.5); o.u = d.ride.u;
    return o;
  });
  check(r6.on === "stair", "at the staircase's foot, the stick pushed up its way: on the stairs");
  check(r6.onTop && Math.abs(r6.topY - r6.n * 0.6) < 0.35, `climbed to its top, a step for each court won (${r6.n} steps, up to ${r6.topY.toFixed(2)} m)`);
  check(r6.sMax > r6.end - 0.15 && Math.abs(r6.offYaw - Math.PI / 2) < 0.05, `level round and out along the board to its end, off it straight on toward the courts (yaw ${r6.offYaw.toFixed(2)}, at x ${r6.offX.toFixed(1)})`);
  check(r6.glide && r6.openY >= 1.5, `off the board he leaps, and from ${r6.openY.toFixed(2)} m his hat opens: gliding`);
  check(r6.turned < -0.5 && r6.turned > -1.2, `the stick turned the canopy left (${r6.turned.toFixed(2)} rad in 0.6 s)`);
  check(r6.landed === null && r6.y === 0 && r6.u === 0, "he landed, on foot, the hat back on his head");
  // a tap on the stairs jumps off; the shot under the canopy
  const r7 = await D(() => {
    const d = window.Pickleball.debug(); d.ride.mode = "stair"; d.ride.s = 3; d.ride.off = [0, 0]; d.run(0.05); return d.ride.mode; });
  await D(() => { window.Pickleball.debug().YT.paused = false; });
  if (desk) { await p.keyboard.press(" "); } else { await p.touchscreen.tap(330, 420); }
  await D(() => { window.Pickleball.debug().YT.paused = true; });
  const r8 = await D(() => { const d = window.Pickleball.debug(); d.run(1 / 60); const m0 = d.ride.mode; for (let i = 0; i < 40; i++) { d.run(1 / 60); } return { m0, m1: d.ride.mode, y: d.me.y }; });
  check(r7 === "stair" && r8.m0 === "fly", `a ${desk ? "Space" : "tap"} on the stairs jumps off (${r8.m0})`);
  check(r8.m1 === "glide", `from the fourth step up his hat opens (${r8.m1} at ${r8.y.toFixed(2)} m)`);
  await shot("3glide");
  // under the canopy down onto the open court: no match there; on foot onto its gold circle, its match; onto a step from above, the stairs
  const r9 = await D(() => {
    const d = window.Pickleball.debug(), C = d.COURT, k = d.courts.length - 1, o = {};
    d.ride.mode = "glide"; d.ride.hd = 0; d.ride.u = 1; d.me.x = k * C.GAP + 0.5; d.me.z = C.L - 0.3; d.me.y = 0.6; d.me.vx = 0; d.me.vz = -5; d.me.vy = -1.35;   // (over its near half, toward the net: down on it about 3 m on)
    let down = -1, i = 0;
    for (; i < 400; i++) { window.__off(); d.run(1 / 60); if (down < 0 && d.ride.mode === null) { down = i; } if (down >= 0 && i - down >= 60) { break; } }
    o.landed = down >= 0; o.onCourt = Math.abs(d.me.x - k * C.GAP) < C.HW && d.me.z > 0 && d.me.z < C.L; o.none = !d.court.m; o.z = d.me.z;
    for (let j = 0; j < 600 && !d.court.m; j++) { window.__toward(k * C.GAP + 0.9 - d.me.x, C.L + 0.4 - d.me.z); d.run(1 / 60); }
    window.__off(); o.match = d.court.m && d.court.m.k; o.k = k;
    return o;
  });
  check(r9.landed && r9.onCourt && r9.none && r9.match === r9.k, `glided down onto the open court: nothing begun there a second on (at z ${r9.z.toFixed(2)}); on foot onto its gold circle, its match (court ${r9.match + 1})`);
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 5, rally: 4, tut: 1, tips: 1 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 }); await helpers();
  const r10 = await D(() => {
    const d = window.Pickleball.debug(); d.pause(true); d.run(0.3);
    const s2 = d.stairAt(2); d.ride.mode = "glide"; d.ride.u = 1; d.ride.hd = 0; d.me.x = s2.x; d.me.z = s2.z; d.me.y = s2.y + 0.6; d.me.vx = d.me.vz = 0; d.me.vy = -1.35;
    for (let i = 0; i < 90 && d.ride.mode === "glide"; i++) { d.run(1 / 60); d.me.vx = d.me.vz = 0; }
    return { mode: d.ride.mode, s: d.ride.s, y: d.me.y, top: s2.y };
  });
  check(r10.mode === "stair" && Math.abs(r10.s - 2) < 0.05 && Math.abs(r10.y - r10.top) < 0.05, `down onto the ramp from above: on it again (step ${(r10.s + 1).toFixed(2)}, ${r10.y.toFixed(2)} m)`);
  // the coupe up the ramp, off its top, under his hat, down
  const rc = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, F = d.stairAt(-1), w = d.stairWay(-1), C = d.COURT, k = d.courts.length - 1, o = { n: d.won() };
    d.ride.mode = null; c.mode = "ground"; c.x = F.x - w[0] * 5; c.z = F.z - w[1] * 5; c.yaw = Math.atan2(w[0], -w[1]); c.v = 0; c.y = 0;
    d.me.x = c.x + 2.5; d.me.z = c.z; d.run(0.05); d.ride.mode = "car";
    let ramp = false, topY = 0, glide = false, uMax = 0, i = 0, level = false, stepV = 0, off = null;
    for (; i < 60 * 20 && !(glide && c.mode === "ground"); i++) {
      window.__in(c.mode === "glide" ? 0.2 : 1, 0); const was = c.mode, sb = c.s, vb = c.v; d.run(1 / 60);
      ramp = ramp || c.mode === "ramp"; topY = Math.max(topY, c.y); glide = glide || c.mode === "glide"; uMax = Math.max(uMax, d.ride.u);
      if (c.mode === "ramp" && c.s > o.n - 1) { level = true; } if (c.mode === "ramp" && c.s <= o.n - 1) { stepV = Math.max(stepV, c.v); }
      if (!off && was === "ramp" && c.mode === "fly") { off = { s: sb, v: vb, yaw: c.yaw, x: c.x, z: c.z, y: c.y }; }
    }
    o.level = level; o.stepV = stepV; o.off = off; o.end0 = d.stairEnd(); o.P = { x: d.topPath().end.x + d.TOP.BOARD, z: d.topPath().end.z, y: d.topPath().y };
    window.__off(); d.run(0.5);
    o.ramp = ramp; o.topY = topY; o.glide = glide; o.uMax = uMax; o.end = c.mode; o.y = c.y; o.u = d.ride.u; o.inCar = d.ride.mode === "car";
    return o;
  });
  check(rc.ramp && rc.topY >= rc.n * 0.6 - 0.05, `the coupe drives up the ramp to its top (${rc.topY.toFixed(2)} m, ${rc.n} steps)`);
  // (the artist, 4 Nov 2026: the top step "lead out flat perpendicular to the courts that way you can get a running start to drive off onto the courts")
  check(rc.level && rc.off && rc.off.s > rc.end0 - 0.5 && Math.abs(rc.off.yaw - Math.PI / 2) < 0.02 && Math.hypot(rc.off.x - rc.P.x, rc.off.z - rc.P.z) < 0.6 && Math.abs(rc.off.y - rc.P.y) < 0.05,
        `past the top step level round the spiral and out along the board, off its end toward the courts (yaw ${rc.off && rc.off.yaw.toFixed(2)}, at ${rc.off && rc.off.x.toFixed(1)}, ${rc.off && rc.off.z.toFixed(1)}, ${rc.off && rc.off.y.toFixed(2)} m)`);
  check(rc.off && rc.stepV <= 14.05 && rc.off.v > 18, `a running start: up the steps at most 14 m/s, off the board at ${rc.off && rc.off.v.toFixed(1)} m/s`);
  check(rc.glide && rc.uMax > 0.99 && rc.inCar, "off the board it launches, and his hat opens over the coupe, him in it");
  check(rc.end === "ground" && rc.y === 0 && rc.u === 0, "the coupe glides down and lands, the hat back on his head");
  await shot("5ramp");
  // the court tip marks the coupe while the open court is a drive away
  const r11 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car; d.ride.mode = null; d.me.x = c.x + 7; d.me.z = c.z - 1; d.me.y = 0; d.view.yaw = -Math.PI / 2; d.view.s = null; d.view.e = null;
    for (let i = 0; i < 12 * 60 && !(d.hud().cue && d.hud().cue.items.some((q) => q.what === "drive")); i++) { d.run(1 / 60); if (i % 30 === 0) { d.draw(); } }
    d.draw(); const cu = d.hud().cue; return { key: cu && cu.key, drive: !!(cu && cu.items.some((q) => q.what === "drive")), tip: document.getElementById("help").textContent };
  });
  check(r11.key === "court" && r11.drive && /coupe/.test(r11.tip), `the court tip marks the coupe ("drive") and says it (${r11.tip})`);
  await shot("4cue");
  // paused: the button and F do nothing
  const r12 = await D(() => { const d = window.Pickleball.debug(), c = d.car, b2 = document.getElementById("ride"); d.me.x = c.x; d.me.z = c.z - 1.6; d.run(0.2); const shown = !b2.hidden && getComputedStyle(b2).display !== "none" && b2.textContent === "Drive" && d.carGap(d.me.x, d.me.z) < 1.5; d.YT.paused = true; return { mode: d.ride.mode, shown }; });   // (the button showing, so the press below would take him in unpaused)
  if (desk) { await p.keyboard.press("f"); } else { const q = await D(() => { const r = document.getElementById("ride").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await p.touchscreen.tap(q[0], q[1]); }
  const r13 = await D(() => window.Pickleball.debug().ride.mode);
  check(r12.shown && r12.mode === null && r13 === null, `paused, the button does nothing (it showed "Drive" beside the coupe: ${JSON.stringify(r12)})`);
  // the way out at other counts: one court won (the level way most of a turn round, a low board, the running start held
  // short of the open court's run-off: no bounce off it in the air) and six (the level way 324 degrees round, widened out
  // past the lower steps); level all along, off the board's end toward the courts; a tap on the board off its side
  for (const won of [1, 6]) {
    await p.evaluate((w) => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: w, rally: 4, tut: 1, tips: 255 })); }, won);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 }); await helpers();
    const rw = await D(() => {
      const d = window.Pickleball.debug(), c = d.car, F = d.stairAt(-1), w = d.stairWay(-1), n = d.won(), P = d.topPath(), o = { n, arc: P.arc, drift: P.drift };
      // (the lane clear of the steps below: where it passes over one within 2.5 m, outside the steps' ring)
      let clash = 0; for (let u = 0; u < P.arc; u += 0.25) { const q = d.topAt(u), r = Math.hypot(q.x - d.STAIR.c[0], q.z - d.STAIR.c[1]);
        let b = ((Math.atan2(q.z - d.STAIR.c[1], q.x - d.STAIR.c[0]) - d.STAIR.A0) / d.STAIR.DA) % 10; if (b < 0) { b += 10; }
        for (let s = b - 10; s <= n - 1; s += 10) { if (s >= 0 && Math.round(s) <= n - 2 && P.y - d.STAIR.RISE * (s + 1) < 2.5 && r - d.TOP.W / 2 < d.STAIR.R1) { clash++; } } }
      o.clash = clash;
      d.ride.mode = null; c.mode = "ground"; c.x = F.x - w[0] * 5; c.z = F.z - w[1] * 5; c.yaw = Math.atan2(w[0], -w[1]); c.v = 0; c.y = 0;
      d.me.x = c.x + 2.5; d.me.z = c.z; d.run(0.05); d.ride.mode = "car";
      let lvlMinY = 9e9, lvlMaxY = -9e9, travelled = 0, off = null, back = false, prev = null, maxTurn = 0, landX = null;
      for (let i = 0; i < 60 * 25; i++) {
        window.__in(c.mode === "glide" ? 0 : 1, 0); const was = c.mode, sb = c.s, vb = c.v, yb = c.yaw; d.run(1 / 60);
        if (c.mode === "ramp" && c.s > n - 1) { lvlMinY = Math.min(lvlMinY, c.y); lvlMaxY = Math.max(lvlMaxY, c.y); if (prev) { travelled += Math.hypot(c.x - prev[0], c.z - prev[1]); } prev = [c.x, c.z];
          maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(c.yaw - yb), Math.cos(c.yaw - yb)))); }
        if (!off && was === "ramp" && c.mode === "fly") { off = { yaw: c.yaw, v: vb, x: c.x }; }
        if (off && (c.mode === "fly" || c.mode === "glide") && c.v < 0) { back = true; }
        if (off && c.mode === "ground") { landX = c.x; break; }
      }
      window.__off();
      Object.assign(o, { lvlMinY, lvlMaxY, y: P.y, travelled, arcLen: P.arc + d.TOP.BOARD, off, back, landX, maxTurn, wall: (d.courts.length - 1) * d.COURT.GAP - d.COURT.GAP / 2 + 0.5 });
      // on foot, 2 m out along the board: a tap, off its side
      d.ride.mode = null; c.x = -40; c.z = 20; d.run(0.05);
      const sb = n - 1 + (P.arc + 2) / d.STAIR.LEN, q = d.stairAt(sb); d.ride.mode = "stair"; d.ride.s = sb; d.ride.off = [0, 0]; d.ride.lag = false; d.me.x = q.x; d.me.z = q.z; d.me.y = q.y; d.run(0.05);
      d.run(1 / 60, true); let backOn = false; for (let i = 0; i < 60 * 3 && d.ride.mode !== null; i++) { d.run(1 / 60); if (d.ride.mode === "stair") { backOn = true; break; } }
      o.tapOff = !backOn;
      return o;
    });
    check(rw.clash === 0, `${won} won: the level way ${rw.arc.toFixed(1)} m round (${rw.drift ? "widened out past the steps" : "on the steps' circle"}), clear of the steps below`);
    check(Math.abs(rw.lvlMinY - rw.y) < 0.02 && Math.abs(rw.lvlMaxY - rw.y) < 0.02 && rw.travelled > rw.arcLen - 2 && rw.maxTurn < 0.1, `${won} won: level all along it at ${rw.y.toFixed(1)} m (${rw.travelled.toFixed(1)} of ${rw.arcLen.toFixed(1)} m), its turn smooth`);
    check(rw.off && Math.abs(rw.off.yaw - Math.PI / 2) < 0.02 && !rw.back && rw.landX != null && rw.landX + 2.15 < rw.wall - 0.3, `${won} won: off the board toward the courts at ${rw.off && rw.off.v.toFixed(1)} m/s, down at x ${rw.landX && rw.landX.toFixed(1)}, short of the open court's run-off (${rw.wall.toFixed(1)}), never bounced back`);
    check(rw.tapOff, `${won} won: a tap on the board jumps him off its side, not back onto it`);
  }
  // Mr Plan's donut: a game he wins with the coupe beside the court; and none with it far off
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 3, rally: 4, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const dn = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1; d.pause(true); d.run(0.3);
    const win = (cx, cz) => {
      c.x = cx; c.z = cz; c.yaw = -Math.PI / 2; c.v = 0; const P0 = [c.x, c.z, c.yaw];
      if (!d.court.m) { d.enter(k); d.run(0.5); }
      const m = d.court.m; m.them = C.WIN; m.phase = "point"; m.t = d.gt() - 2; d.run(1 / 60);
      const stages = [], isN = (q) => "\u266a\u266b\u266c\u2669".indexOf(q.ch) >= 0; let inCar = false, i = 0, notesDrive = 0, notesRun = 0;
      for (; i < 60 * 20 && m.phase === "donut"; i++) {
        if (m.dn && stages[stages.length - 1] !== m.dn.stage) { stages.push(m.dn.stage); } inCar = inCar || !!(m.dn && m.dn.inCar); d.run(1 / 60);
        const nn = d.fx().filter(isN).length; if (m.dn && m.dn.stage === "drive") { notesDrive = Math.max(notesDrive, nn); } else if (m.dn && m.dn.stage === "run") { notesRun = Math.max(notesRun, nn); }
      }
      const pl = d.plans[k];
      return { stages, inCar, notesDrive, notesRun, secs: +(i / 60).toFixed(1), phase: m.phase, back: Math.hypot(c.x - P0[0], c.z - P0[1]) + Math.abs(Math.atan2(Math.sin(c.yaw - P0[2]), Math.cos(c.yaw - P0[2]))), plan: Math.hypot(pl.x - k * C.GAP, pl.z - (-C.L - 0.6)), score: [m.you, m.them] };
    };
    return { near: win(k * C.GAP + 3, C.L + 6.9), far: win(-9.6, C.L + 6.7) };
  });
  check(dn.near.stages.join(",") === "run,drive,back" && dn.near.inCar && dn.near.phase === "serve" && dn.near.back < 0.01 && dn.near.plan < 0.6 && dn.near.secs < 9,
        `Mr Plan wins a game with the coupe beside the court: he runs to it, drives a donut, and is back at his baseline for the serve in ${dn.near.secs} s, the coupe as it stood (${JSON.stringify(dn.near)})`);
  check(dn.far.stages.length === 0 && dn.far.phase === "serve", `with the coupe far off, no donut (${JSON.stringify(dn.far)})`);
  check(dn.near.notesDrive >= 5 && dn.near.notesRun === 0, `music out of the coupe while Mr Plan drives it (${dn.near.notesDrive} notes in the air), none before he is in it`);
  // his own donut (the artist, 4 Nov 2026: "Mr Pearl should be able to do donuts in the coupe as well"): in the coupe,
  // a real tap (Space on the desk): round a circle beside it twice, him in it, the view not whirled round with it, the
  // button doing nothing meanwhile, and parked again as it stood; beside the open court, the circle on the side away
  // from it, clear of its run-off all the way round
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3); });
  const tap = async () => {
    await D(() => { window.Pickleball.debug().YT.paused = false; });
    if (desk) { await p.keyboard.press(" "); }
    else {
      const cdp = await p.context().newCDPSession(p), q = await D(() => [innerWidth * 0.75, innerHeight * 0.4]);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q[0], y: q[1], id: 2 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await p.waitForTimeout(60);
    await D(() => { window.Pickleball.debug().YT.paused = true; });
  };
  const myDn = async (x, z, yaw, v0) => {
    await D(([x0, z0, y0, v]) => {
      const d = window.Pickleball.debug(), c = d.car; if (d.ride.mode !== "car") { d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); }
      c.x = x0; c.z = z0; c.yaw = y0; c.v = 0; d.run(0.2); c.v = v || 0;
    }, [x, z, yaw, v0]);
    await tap();
    return D(() => {
      const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1, cx = k * C.GAP, CR = d.CAR;
      const S0 = [c.x, c.z]; let stopT = 0; d.run(1 / 60); for (; stopT < 180 && !d.ride.dn; stopT++) { d.run(1 / 60); }   // (at speed: a stop first)
      const P0 = d.ride.dn ? d.ride.dn.P0 : null, dir = d.ride.dn && d.ride.dn.dir, y0 = d.view.yaw, slid = P0 ? Math.hypot(P0[0] - S0[0], P0[1] - S0[1]) : null;
      let turned = 0, far = 0, inCar = true, clear = 99, view = 0, py = c.yaw, i = 0, held = false;
      for (; i < 60 * 5 && d.ride.dn; i++) {
        if (i === 60) { d.rideToggle(); held = d.ride.mode === "car" && !!d.ride.dn; }
        d.run(1 / 60); turned += Math.atan2(Math.sin(c.yaw - py), Math.cos(c.yaw - py)); py = c.yaw;
        if (P0) { far = Math.max(far, Math.hypot(c.x - P0[0], c.z - P0[1])); }
        inCar = inCar && d.ride.mode === "car" && Math.abs(d.me.x - c.x) < 1e-6 && Math.abs(d.me.z - c.z) < 1e-6;
        const h = CR.L / 2 - CR.W / 2;
        [h, -h].forEach((o) => { const px = c.x + Math.sin(c.yaw) * o, pz = c.z - Math.cos(c.yaw) * o; clear = Math.min(clear, Math.hypot(px - Math.max(cx - C.GAP / 2 + 0.5, Math.min(cx + C.GAP / 2 - 0.5, px)), pz - Math.max(-C.L - 3.5, Math.min(C.L + 3.5, pz)))); });
        view = Math.max(view, Math.abs(Math.atan2(Math.sin(d.view.yaw - y0), Math.cos(d.view.yaw - y0))));
      }
      const back = P0 ? Math.hypot(c.x - P0[0], c.z - P0[1]) + Math.abs(Math.atan2(Math.sin(c.yaw - P0[2]), Math.cos(c.yaw - P0[2]))) : null;
      return { started: !!P0, stop: +(stopT / 60).toFixed(2), slid: slid && +slid.toFixed(2), dir, secs: +(i / 60).toFixed(2), turns: +(Math.abs(turned) / (2 * Math.PI)).toFixed(2), far: +far.toFixed(2), inCar, held, back: back && +back.toFixed(4), v: c.v, view: +view.toFixed(3), clear: +clear.toFixed(2), need: CR.R + CR.EDGE, mode: d.ride.mode };
    });
  };
  const H = await D(() => window.Pickleball.debug().CAR.home);
  const d1 = await myDn(H[0], H[1], H[2]);
  check(d1.started && d1.turns > 1.8 && d1.far > 3.5 && d1.inCar && d1.secs < 3.2, `in the coupe, ${desk ? "Space" : "a tap"}: a donut, twice round a circle beside it in ${d1.secs} s, him in it (${JSON.stringify(d1)})`);
  check(d1.back != null && d1.back < 0.01 && d1.v === 0 && d1.mode === "car", "and parked again as it stood, him still in it");
  check(d1.held && d1.view < 0.35, `the button does nothing meanwhile, and the view is not whirled round with it (${d1.view} rad)`);
  const kx = await D(() => { const d = window.Pickleball.debug(); return (d.courts.length - 1) * d.COURT.GAP; });
  const d2 = await myDn(kx - 8.5, 0, 0);   // (its right toward the open court)
  const d3 = await myDn(H[0], H[1], H[2], 16);
  check(d3.started && d3.stop > 0.4 && d3.stop < 1.0 && d3.slid > 3 && d3.turns > 1.8 && d3.back < 0.01, `a tap at 16 m/s: braked to a stop first (${d3.stop} s, ${d3.slid} m), then the donut, parked where it stopped (${JSON.stringify(d3)})`);
  // the Donut button (the artist, 4 Nov 2026: "Make sure that when I am driving the coupe forward there is a button that
  // says donut and that's the same animation as Mr. plan doing it happens to you in the coupe when pushing the button"):
  // driving forward, it shows over Get out; a real tap on it: a stop, the donut, seen as Mr Plan's is (from outside the
  // circle, 12.5 m off, 5.5 m up, the coupe in the middle of the picture), the button gone meanwhile and back once parked
  const bt = await D(([x0, z0, y0, dk]) => {
    const d = window.Pickleball.debug(), c = d.car; if (d.ride.mode !== "car") { d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); }
    d.view.pitch = -1.0;   // (the view dragged to look down: the donut's own view is the same)
    // (forward on the stick, or W held; after the reload above, its own)
    window.__fwd = (on) => { if (dk) { d.input.stick = null; d.input.keys.w = on; } else { d.input.stick = on ? { id: -1, x: 0, y: 0, dx: 0, dy: -60 } : null; } };
    c.x = x0; c.z = z0; c.yaw = y0; c.v = 0; d.run(0.2); window.__fwd(true); d.run(0.8); d.draw();
    const b2 = document.getElementById("donut"), q = b2.getBoundingClientRect(), r2 = document.getElementById("ride").getBoundingClientRect();
    return { v: +c.v.toFixed(1), shown: !b2.hidden && getComputedStyle(b2).display !== "none", text: b2.textContent, box: [q.left, q.top, q.width, q.height], W: innerWidth, H: innerHeight, rideTop: r2.top, rideShown: !document.getElementById("ride").hidden };
  }, [H[0], H[1], H[2], desk]);
  check(bt.shown && bt.text === "Donut" && bt.v > 3 && bt.rideShown, `driving the coupe forward (${bt.v} m/s): a Donut button`);
  check(bt.box[0] >= 0 && bt.box[1] >= 0 && bt.box[0] + bt.box[2] <= bt.W && bt.box[1] + bt.box[3] <= bt.rideTop && bt.box[3] >= 44, `over Get out, inside the screen, a finger's height ${JSON.stringify(bt.box)}`);
  {
    await D(() => { window.Pickleball.debug().YT.paused = false; });
    const q = await D(() => { const r = document.getElementById("donut").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (desk) { await p.mouse.click(q[0], q[1]); }
    else {
      const cdp = await p.context().newCDPSession(p);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q[0], y: q[1], id: 3 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await p.waitForTimeout(60);
    await D(() => { window.Pickleball.debug().YT.paused = true; });
  }
  const bd = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, b2 = document.getElementById("donut"), o = { hidden: true, cam: [] };
    const r2 = document.getElementById("ride"); o.outHidden = true;
    let i = 0; for (; i < 180 && !d.ride.dn; i++) { d.run(1 / 60); o.hidden = o.hidden && b2.hidden; }
    o.started = !!d.ride.dn; o.stop = +(i / 60).toFixed(2); window.__fwd(false); const P0 = d.ride.dn && d.ride.dn.P0.slice(); let turned = 0, py = c.yaw, j = 0;
    for (; j < 60 * 4 && d.ride.dn; j++) {
      d.run(1 / 60); if (d.ride.dn) { o.hidden = o.hidden && b2.hidden; o.outHidden = o.outHidden && r2.hidden; } turned += Math.atan2(Math.sin(c.yaw - py), Math.cos(c.yaw - py)); py = c.yaw;
      if (d.ride.dn && j >= 160) { d.draw(); o.eyeLast = d.cur.eye.slice(); }   // (its last frames' view)
      if (j === 50 || j === 70 || j === 85 || j === 100 || j === 115) { d.draw(); const e = d.cur.eye, A = [Math.sin(c.yaw) * 2.15, Math.cos(c.yaw) * -2.15], s = d.toScreen([c.x, 1, c.z]), s1 = d.toScreen([c.x + A[0], 0.6, c.z + A[1]]), s2 = d.toScreen([c.x - A[0], 0.6, c.z - A[1]]);
        o.cam.push({ y: +e[1].toFixed(2), off: +Math.hypot(e[0] - c.x, e[2] - c.z).toFixed(1), mid: s ? [+(s[0] / innerWidth).toFixed(2), +(s[1] / innerHeight).toFixed(2)] : null, ends: s1 && s2 ? [+(s1[0] / innerWidth).toFixed(2), +(s2[0] / innerWidth).toFixed(2)] : null }); }
    }
    d.run(1 / 60); o.secs = +(j / 60).toFixed(2); o.turns = +(Math.abs(turned) / (2 * Math.PI)).toFixed(2);
    o.back = P0 ? +(Math.hypot(c.x - P0[0], c.z - P0[1]) + Math.abs(Math.atan2(Math.sin(c.yaw - P0[2]), Math.cos(c.yaw - P0[2])))).toFixed(4) : null;
    o.again = !b2.hidden; d.draw(); const e2 = d.cur.eye; o.handBack = o.eyeLast ? +Math.hypot(e2[0] - o.eyeLast[0], e2[1] - o.eyeLast[1], e2[2] - o.eyeLast[2]).toFixed(3) : null; delete o.eyeLast;
    return o;
  });
  check(bd.outHidden, "and Get out gone while it goes round (it could not get him out)");
  check(bd.started && bd.hidden && bd.stop < 1 && bd.turns > 1.8 && bd.back < 0.01, `a real tap on it: a stop (${bd.stop} s), then the donut, twice round, parked where it stopped, the button gone meanwhile (${JSON.stringify(bd)})`);
  check(bd.cam.length === 5 && bd.cam.every((q) => Math.abs(q.y - 5.5) < 0.6 && q.off > 9 && q.ends && q.ends.every((x) => x > 0 && x < 1) && q.mid[1] > 0.2 && q.mid[1] < 0.85), `seen as Mr Plan's is: from outside its circle, 5.5 m up, the coupe nose to tail in the picture all the way round (${JSON.stringify(bd.cam)})`);
  check(bd.again && bd.handBack != null && bd.handBack < 0.3, `parked, the button back and his own view again, handed back without a jump (${bd.handBack} m in the last frame)`);
  // the coupe's music (the artist, 4 Nov 2026: "I want musical notes always coming out of the car when someone is driving
  // it"): notes out of its windows as he drives, still as he sits in it parked, none once he is out
  const mu = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, isN = (q) => "\u266a\u266b\u266c\u2669".indexOf(q.ch) >= 0, o = {};
    window.__fwd(true); d.run(1.2); window.__fwd(false); o.v = +c.v.toFixed(1);
    const ns = d.fx().filter(isN); o.n = ns.length; o.near = ns.every((q) => Math.hypot(q.p[0] - c.x, q.p[2] - c.z) < 30); o.high = ns.every((q) => q.p[1] > 0.9);
    o.kinds = [...new Set(ns.map((q) => q.ch))].length;
    for (let i = 0; i < 240 && Math.abs(c.v) > 0.3; i++) { d.input.keys.s = true; d.input.stick = { id: -1, x: 0, y: 0, dx: 0, dy: 60 }; d.run(1 / 60); }
    d.input.keys.s = false; d.input.stick = null; d.run(1.5); o.parked = Math.abs(c.v) < 0.5 && d.ride.mode === "car"; o.fresh = d.fx().filter(isN).filter((q) => d.gt() - q.t0 < 1).length;
    d.rideToggle(); d.run(0.1); o.out = d.ride.mode; d.run(2.5); o.after = d.fx().filter(isN).length;
    return o;
  });
  check(mu.n >= 4 && mu.near && mu.high && mu.kinds >= 2, `music out of the coupe as he drives it (${JSON.stringify(mu)})`);
  check(mu.parked && mu.fresh >= 3, `and still as he sits in it parked (${mu.fresh} new notes a second)`);
  check(mu.out === null && mu.after === 0, "out of it: no more music");
  check(d2.started && d2.dir === -1 && d2.back < 0.01 && d2.clear > d2.need, `beside the open court, the circle on the side away from it, clear of its run-off all the way round (${d2.clear} m, ${d2.need} needed; ${JSON.stringify(d2)})`);
  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

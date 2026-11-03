// pb_drive.js - the orange coupe, the staircase and his hat (the artist, 29 Oct 2026: "I want you to be able to drive
// the orange coupe to get to your court instead of being able to click on the court number and teleport there. Make
// sure that the orange coupe cannot drive onto the highest numbered court you have yet to win that way it stays parked
// off the court and doesn't glitch any games. I want you to be able to climb the staircase with Mr Pearl and when you
// jump off at a certain height I want Mr Pearl to use his hat like a paraglider and be able to glide down anywhere
// below"). With four courts won: the courts' numbers are no longer buttons; beside the coupe its button says Drive, a
// real tap (the F key on the desk) gets him in; driven by the stick (the keys on the desk) along the courts and then
// straight at the open court, flat out, it never gets onto it or its run-off (the match is not begun under it); out,
// he stands clear of it, and walks onto the court, its match begun; the nets of the courts won, the floodlights'
// poles, the edge of the ground stop it; a court opened under it puts it off; at the staircase's foot the stick up
// climbs (a step for each court won), on past the top he leaps, falling from 1.5 m his hat opens as a canopy, the
// stick steers it, and he lands; a tap on the stairs jumps off; under his hat over the open court its match begins
// only once he is down; on a step from above, the stairs again; the court tip marks the coupe; paused, nothing.
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
  // out: he stands clear of it, then walks onto the court: its match
  await press();
  const r4 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT, k = d.courts.length - 1; d.run(0.1);
    const A = { fx: Math.sin(c.yaw), fz: -Math.cos(c.yaw), rx: Math.cos(c.yaw), rz: Math.sin(c.yaw) }, dx = d.me.x - c.x, dz = d.me.z - c.z;
    const clear = Math.abs(dx * A.fx + dz * A.fz) >= d.CAR.L / 2 + 0.25 || Math.abs(dx * A.rx + dz * A.rz) >= d.CAR.W / 2 + 0.25;
    const o = { mode: d.ride.mode, clear, text: document.getElementById("ride").textContent, y: d.me.y };
    for (let i = 0; i < 600 && !d.court.m; i++) { window.__toward(k * C.GAP + 0.5 - d.me.x, 3 - d.me.z); d.run(1 / 60); }
    window.__off();
    o.match = d.court.m && d.court.m.k; o.k = k; const b2 = document.getElementById("ride"); o.hidden = b2.hidden || getComputedStyle(b2).display === "none";
    return o;
  });
  check(r4.mode === null && r4.clear && r4.y === 0, "out of the coupe: on foot beside it, not in it");
  check(r4.match === r4.k && r4.hidden, `walked onto the open court: its match begun (court ${r4.match + 1}), no Drive button in it`);
  // the courts won: their nets stop it; a pole; the edge; a court opened under it puts it off
  const r5 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car, C = d.COURT; d.winCourt(); d.run(0.2);
    const k = d.courts.length - 1, R = d.CAR.R, h = d.CAR.L / 2 - d.CAR.W / 2, o = {};
    d.me.x = 4 * C.GAP + 7; d.me.z = C.L + 8; d.ride.mode = "car"; c.x = 4 * C.GAP; c.z = 8; c.yaw = 0; c.v = 0;   // (on court five, now won, facing its net)
    for (let i = 0; i < 180; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.net = c.z - h;   // (its front disc's middle, past the net at z 0 by its radius at least)
    c.x = 3.5 * C.GAP; c.z = C.L + 9; c.yaw = 0; c.v = 0;   // (behind the floodlight pole at x 42, z 10.7, facing it)
    for (let i = 0; i < 180; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.pole = Math.hypot(c.x + Math.sin(c.yaw) * h - 3.5 * C.GAP, c.z - Math.cos(c.yaw) * h - (C.L + 4));
    c.x = -20; c.z = 0; c.yaw = -Math.PI / 2; c.v = 0;
    for (let i = 0; i < 300; i++) { window.__in(1, 0); d.run(1 / 60); }
    o.edge = c.x; o.x0 = d.BOUND.x0;
    window.__off(); d.ride.mode = null; c.x = k * C.GAP; c.z = 1; c.yaw = 0; c.v = 0; d.run(0.1);   // (the open court's middle: put off it)
    const box = [k * C.GAP - 5.5, k * C.GAP + 5.5, -C.L - 3.5, C.L + 3.5];
    o.off = Math.min(...[h, -h].map((q) => { const px = c.x + Math.sin(c.yaw) * q, pz = c.z - Math.cos(c.yaw) * q, qx = Math.max(box[0], Math.min(box[1], px)), qz = Math.max(box[2], Math.min(box[3], pz)); return (px > box[0] && px < box[1] && pz > box[2] && pz < box[3]) ? -1 : Math.hypot(px - qx, pz - qz) - R; }));
    o.R = R; return o;
  });
  check(r5.net >= 0.08 + r5.R - 0.03, `a won court's net stops it (its front ${r5.net.toFixed(2)} m from the net's middle)`);
  check(r5.pole >= r5.R - 0.03, `a floodlight pole stops it (${r5.pole.toFixed(2)} m)`);
  check(r5.edge >= r5.x0 + r5.R - 0.03 - 1.3, `the edge of the ground stops it (x ${r5.edge.toFixed(2)})`);
  check(r5.off >= -0.02, `left standing on a court as it opened: put off its run-off (${r5.off.toFixed(3)} m clear)`);
  // the staircase: up from its foot, a step for each court won, on past the top, the hat, steering, down
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 5, rally: 4, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await D((dk) => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3);
    window.__in = (fwd, side) => { if (dk) { d.input.stick = null; Object.assign(d.input.keys, { w: fwd > 0.3, s: fwd < -0.3, d: side > 0.3, a: side < -0.3 }); } else { const l = Math.max(1, Math.hypot(fwd, side)); d.input.stick = fwd || side ? { id: -1, x: 0, y: 0, dx: side / l * 60, dy: -fwd / l * 60 } : null; } };
    window.__toward = (wx, wz) => { const y = d.view.yaw, f = Math.sin(y) * wx - Math.cos(y) * wz, s = Math.cos(y) * wx + Math.sin(y) * wz, l = Math.hypot(f, s) || 1; window.__in(f / l, s / l); };
    window.__off = () => { d.input.stick = null; Object.assign(d.input.keys, { w: false, s: false, a: false, d: false }); }; }, desk);
  const r6 = await D(() => {
    const d = window.Pickleball.debug(), F = d.stairAt(-1), n = d.won(), o = { n, log: [] };
    d.me.x = F.x + 2; d.me.z = F.z + 0.6; d.run(0.1);
    for (let i = 0; i < 240 && d.ride.mode !== "stair"; i++) { const w = [d.stairAt(-0.9).x - F.x, d.stairAt(-0.9).z - F.z]; window.__toward(F.x - d.me.x + w[0] * 3, F.z - d.me.z + w[1] * 3); d.run(1 / 60); }
    o.on = d.ride.mode;
    let topY = 0, onTop = false;
    for (let i = 0; i < 600 && d.ride.mode === "stair"; i++) { window.__in(1, 0); d.run(1 / 60); topY = Math.max(topY, d.me.y); onTop = onTop || d.ride.s >= n - 1; }
    o.topY = topY; o.onTop = onTop; o.after = d.ride.mode;
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
  check(r6.glide && r6.openY >= 1.5, `on past the top he leaps, and from ${r6.openY.toFixed(2)} m his hat opens: gliding`);
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
  // under the canopy over the open court: its match only once he is down; onto a step from above, the stairs
  const r9 = await D(() => {
    const d = window.Pickleball.debug(), C = d.COURT, k = d.courts.length - 1, o = {};
    d.ride.mode = "glide"; d.ride.hd = Math.PI; d.ride.u = 1; d.me.x = k * C.GAP; d.me.z = 1.5; d.me.y = 4; d.me.vx = 0; d.me.vz = 0; d.me.vy = -1.35;
    let early = false;
    for (let i = 0; i < 400 && !d.court.m; i++) { window.__in(-1, 0); d.run(1 / 60); if (d.court.m && d.me.y > 0.05) { early = true; } }
    window.__off(); o.match = d.court.m && d.court.m.k; o.k = k; o.early = early; o.y = d.me.y;
    return o;
  });
  check(r9.match === r9.k && !r9.early, `glided down onto the open court: its match begun once he was down (court ${r9.match + 1}), not in the air`);
  await p.evaluate(() => { localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 5, rally: 4, tut: 1, tips: 1 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const r10 = await D(() => {
    const d = window.Pickleball.debug(); d.pause(true); d.run(0.3);
    const s2 = d.stairAt(2); d.ride.mode = "glide"; d.ride.u = 1; d.ride.hd = 0; d.me.x = s2.x; d.me.z = s2.z; d.me.y = s2.y + 0.6; d.me.vx = d.me.vz = 0; d.me.vy = -1.35;
    for (let i = 0; i < 90 && d.ride.mode === "glide"; i++) { d.run(1 / 60); d.me.vx = d.me.vz = 0; }
    return { mode: d.ride.mode, s: d.ride.s, y: d.me.y, top: s2.y };
  });
  check(r10.mode === "stair" && r10.s === 2 && Math.abs(r10.y - r10.top) < 0.01, `down onto a step from above: on the stairs again (step ${r10.s + 1}, ${r10.y.toFixed(2)} m)`);
  // the court tip marks the coupe while the open court is a drive away
  const r11 = await D(() => {
    const d = window.Pickleball.debug(), c = d.car; d.ride.mode = null; d.me.x = c.x + 7; d.me.z = c.z - 1; d.me.y = 0; d.view.yaw = -Math.PI / 2; d.view.s = null; d.view.e = null;
    for (let i = 0; i < 12 * 60 && !(d.hud().cue && d.hud().cue.items.some((q) => q.what === "drive")); i++) { d.run(1 / 60); if (i % 30 === 0) { d.draw(); } }
    d.draw(); const cu = d.hud().cue; return { key: cu && cu.key, drive: !!(cu && cu.items.some((q) => q.what === "drive")), tip: document.getElementById("help").textContent };
  });
  check(r11.key === "court" && r11.drive && /coupe/.test(r11.tip), `the court tip marks the coupe ("drive") and says it (${r11.tip})`);
  await shot("4cue");
  // paused: the button and F do nothing
  const r12 = await D(() => { const d = window.Pickleball.debug(), c = d.car; d.me.x = c.x; d.me.z = c.z - 1.6; d.run(0.2); d.YT.paused = true; return d.ride.mode; });
  if (desk) { await p.keyboard.press("f"); } else { const q = await D(() => { const r = document.getElementById("ride").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await p.touchscreen.tap(q[0], q[1]); }
  const r13 = await D(() => window.Pickleball.debug().ride.mode);
  check(r12 === null && r13 === null, "paused, the button does nothing");
  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

// fingers.js - the two fingers (wf15 spec 6.2), a phone: node fingers.js outdir port
// The left thumb by CDP Input.dispatchTouchEvent (its own id), held on the stick all through; the right finger as
// dispatched touch PointerEvents (pointerType "touch", isPrimary false, ids from 51), because Chromium's emulation
// lifts the wrong finger of two. Writes results.json and log.txt in outdir.
const L = require("./lib.js");
const fs = require("fs");
const [out, port] = process.argv.slice(2);
const R = { cases: {} };
(async () => {
  const G = await L.start("phone", port, out);
  const { P, D, say, check, shot } = G;
  const frames = G.frames;
  const K = await D(() => ({ H: innerHeight, W: innerWidth, T35: Math.tan(35 * Math.PI / 180), BEAT: window.Rocket.debug().sightConsts.BEAT }));
  const k = 2 * K.T35 / K.H;
  const { site, cell } = await L.arena(G, 44, 4);
  R.site = site; say("arena " + JSON.stringify(site));
  // a wall at 30 m across the run, for the hold to bring a point of it to the mark
  const wall = [];
  for (let q = -7; q <= 7; q++) for (let h = 0; h < 12; h++) { wall.push(cell(30, q, h)); }
  await L.setB(G, wall, 9);
  await L.recorder(G);
  await L.stand(G, { x: site.x + 0.5, y: site.y, z: site.z + 0.5, yaw: site.yaw, pitch: 0 });
  await frames(4);
  const W = () => D(() => { const d = window.Rocket.debug(); return { walked: d.P.walked, yaw: d.P.yaw, pitch: d.P.pitch, vx: d.P.vx, vz: d.P.vz, carried: d.carried(), up: d.sight().up, stick: d.stick(), x: d.P.x, z: d.P.z }; });
  let pid = 50;
  const right = (type, x, y, id) => D((a) => {
    const el = a.sel ? document.querySelector(a.sel) : document.getElementById("view"), r = el.getBoundingClientRect();
    const cx = a.sel ? r.left + r.width / 2 : a.x, cy = a.sel ? r.top + r.height / 2 : a.y;
    el.dispatchEvent(new PointerEvent(a.type, { pointerId: a.id, pointerType: "touch", isPrimary: false, bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: a.type === "pointermove" ? -1 : 0, buttons: a.type === "pointerup" ? 0 : 1 }));
    return { f: window.__frames, now: performance.now(), V: window.__V };
  }, { type, x, y, id, sel: typeof x === "string" ? x : null });
  // the left thumb down at (90, 660) and pushed up to (90, 620): a full push (REACH 40 px), held to the end
  await G.touch("touchStart", [{ x: 90, y: 660, id: 1 }]); await G.touch("touchMove", [{ x: 90, y: 620, id: 1 }]);
  await frames(8);
  // 1. the right finger on Sight: the sight up, and he still walking
  pid += 1; await right("pointerdown", "#v-sight", null, pid); await frames(1); await right("pointerup", "#v-sight", null, pid);
  const a1 = await W(); await frames(16); const b1 = await W();
  const v1 = (b1.walked - a1.walked) / (16 * 0.025);
  await shot("20_walking_sight_up", 0);
  R.cases.sight = { up: b1.up, speed: v1, stick: b1.stick };
  check(b1.up && v1 >= 4.2, "the left thumb held, the right on Sight: the sight up (" + b1.up + "), he still walking at " + v1.toFixed(2) + " m/s (>= 4.2)");
  // 2. a drag of the right finger on the canvas: six moves of +10, -5 px a frame
  const a2 = await W();
  pid += 1; await right("pointerdown", 300, 400, pid);
  for (let i = 1; i <= 6; i++) { await frames(1); await right("pointermove", 300 + 10 * i, 400 - 5 * i, pid); if (i === 3) { await shot("21_mid_drag", 0); } }
  await right("pointerup", 360, 370, pid);
  const b2 = await W();
  R.cases.drag = { dyaw: b2.yaw - a2.yaw, want: 60 * k, dpitch: b2.pitch - a2.pitch, wantPitch: 30 * k, thrown: a2.carried - b2.carried };
  check(Math.abs(b2.yaw - a2.yaw - 60 * k) < 1e-4 && b2.carried === a2.carried, "walking, the right finger's drag turns the aim " + (b2.yaw - a2.yaw).toFixed(5) + " (60 x " + k.toFixed(5) + " = " + (60 * k).toFixed(5) + ", his walk turning it nil), nothing thrown");
  check(Math.abs(b2.pitch - a2.pitch - 30 * k) < 1e-4, "and the pitch up by 30 px of it (" + (b2.pitch - a2.pitch).toFixed(5) + ")");
  // 3. a tap while walking: thrown, his walk in it
  await L.recOn(G, true);
  pid += 1; await right("pointerdown", 300, 400, pid); await frames(2); const t3 = await right("pointerup", 300, 400, pid);
  const a3 = await D(() => { const d = window.Rocket.debug(), p = d.pearls()[0]; return { n: d.pearls().length, mv: p && p.from.mv, vel: p && p.from.vel, P: [d.P.vx, d.P.vz], walked: d.P.walked, stick: d.stick(), thrown: d.sight().thrown, f: window.__frames }; });
  await frames(1);
  await shot("22_throw_while_walking", 0);
  // 4. a second tap 4 frames after: kept, thrown a beat after the first
  await frames(3);
  pid += 1; await right("pointerdown", 300, 400, pid); await frames(1); await right("pointerup", 300, 400, pid);
  const kept = (await D(() => window.Rocket.debug().sight().next));
  await P.waitForFunction(() => window.Rocket.debug().pearls().length >= 2, null, { timeout: 600000 });
  await frames(1);
  await shot("23_a_beat_later", 0);
  const rec = await L.recs(G); await L.recOn(G, false);
  const f2 = rec.find((r) => r.n >= 2), walks = rec.every((r, i) => i === 0 || r.walked > rec[i - 1].walked);
  R.cases.tap = a3; R.cases.kept = { kept, f1: a3.f, f2: f2 && f2.f, after: f2 && f2.f - a3.f, walkedAllThrough: walks };
  check(a3.n === 1 && a3.mv && Math.abs(a3.mv[0] - a3.P[0]) < 0.01 && Math.abs(a3.mv[2] - a3.P[1]) < 0.01 && Math.hypot(a3.mv[0], a3.mv[2]) > 4, "a tap while walking throws, his walk in it (from.mv " + JSON.stringify(a3.mv && a3.mv.map((v) => +v.toFixed(3))) + ", his " + JSON.stringify(a3.P.map((v) => +v.toFixed(3))) + ")");
  check(a3.stick, "the stick's water drawn under the left thumb all the while (busy)");
  check(kept && f2 && f2.f - a3.f === 20, "a second tap 4 frames later is kept and thrown " + (f2 && f2.f - a3.f) + " frames after the first (20)");
  check(walks, "he walked on through every frame of it (" + rec.length + " frames)");
  // 5. a hold at (330, 300) for 22 frames, still walking: that point comes to the mark
  const before = await W();
  pid += 1; const h0 = await right("pointerdown", 330, 300, pid);
  await frames(22);
  const mid = await D(() => window.Rocket.debug().sight());
  await P.waitForFunction(() => !window.Rocket.debug().sight().turn, null, { timeout: 600000 });
  const s5 = await D(() => { const d = window.Rocket.debug(), s = d.sight(), c = d.cam(); return { hit: s.hit, turn: s.turn, eye: c.eye, yaw: c.last.yaw, pitch: c.last.pitch, walked: d.P.walked }; });
  await right("pointerup", 330, 300, pid);
  // the point the hold took (what the ray through (330, 300) met a beat on), against the crux's line from the eye now
  const Qp = mid.aimAt, fd = [Math.sin(s5.yaw) * Math.cos(s5.pitch), Math.sin(s5.pitch), -Math.cos(s5.yaw) * Math.cos(s5.pitch)];
  const v = Qp ? [Qp[0] - s5.eye[0], Qp[1] - s5.eye[1], Qp[2] - s5.eye[2]] : [1, 0, 0], vl = Math.hypot(v[0], v[1], v[2]);
  const ang = Math.acos(Math.min(1, (v[0] * fd[0] + v[1] * fd[1] + v[2] * fd[2]) / vl)) * 180 / Math.PI;
  R.cases.hold = { turnAt22: mid.turn, Q: Qp, angleDeg: ang, hit: s5.hit, walked: s5.walked - before.walked };
  check(!!Qp && ang < 0.2, "the held point " + (Qp ? vl.toFixed(1) + " m off" : "") + " is under the crux, " + ang.toFixed(3) + " deg off, though he walked on");
  check(mid.turn === true && s5.hit && s5.hit.b === 9 && s5.walked - before.walked > 3, "walking, a hold at (330, 300) for a beat turns the aim (turn at frame 22), and the wall's point under it comes to the mark: the crux on the wall " + JSON.stringify(s5.hit && [s5.hit.x, s5.hit.y, s5.hit.z]) + ", " + (s5.walked - before.walked).toFixed(2) + " m walked meanwhile");
  R.cases.hold.screenNow = await D((h) => { const d = window.Rocket.debug(); return h ? d.screenOf([h.x + 0.5, h.y + 0.5, h.z + 0.5]) : null; }, s5.hit);
  // 6. the left thumb lifted: he stops; the sight stays up
  await G.touch("touchEnd", []);
  await frames(12);
  const a6 = await W(); await frames(8); const b6 = await W();
  R.cases.lift = { walked: b6.walked - a6.walked, up: b6.up };
  check(b6.walked - a6.walked < 0.02 && b6.up, "the left thumb lifted: he stops (" + (b6.walked - a6.walked).toFixed(3) + " m in 8 frames), the sight stays up");
  check(G.errors.length === 0, "no page errors or WebGL warnings " + JSON.stringify(G.errors));
  R.errors = G.errors; R.bad = G.bad;
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(R, null, 1));
  fs.writeFileSync(`${out}/log.txt`, G.log.join("\n") + "\n");
  await G.browser.close();
  console.log(G.bad.length ? "FAILED: " + G.bad.join("; ") : "ALL OK");
  process.exit(G.bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); fs.writeFileSync(`${out}/results.json`, JSON.stringify(R, null, 1)); process.exit(1); });

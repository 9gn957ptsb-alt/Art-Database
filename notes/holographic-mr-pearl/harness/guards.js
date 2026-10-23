// guards.js - the guards made seen (artist, 21 Oct 2026: "there are people trying to grab me"): on their rounds; who
// sees him (in front within LOOK, not behind, not through a wall); the grab a beat in reach (an alarm, the last coin
// back, the grace); the third alarm walks him out; the body grabbed while the head is out puts him under his tree; a
// tap on one says what it is. node guards.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8814, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 4);
  const G0 = await D(() => window.Rocket.debug().guards().map((g) => ({ room: g.room && g.room.name, round: g.round.length, x: g.x, z: g.z, mode: g.mode })));
  const K = await D(() => window.Rocket.debug().guardConsts());
  say("guards " + JSON.stringify(G0) + " consts " + JSON.stringify(K));
  check(G0.length >= 1 && G0.length <= 3, G0.length + " guards, one to a ground-floor room works hang in");
  // keep him out of their way while they walk (on the tree's crown), then see that they walk their rounds
  await D(() => { const d = window.Rocket.debug(), t = d.place.tree; Object.assign(d.P, { x: t.x + 0.5, y: t.top + 1, z: t.z + 0.5, vx: 0, vy: 0, vz: 0 }); });
  await frames(P, 80);
  const G1 = await D(() => window.Rocket.debug().guards().map((g) => ({ walked: g.walked, mode: g.mode })));
  check(G1.every((g) => g.walked > 0.5 || g.mode !== "round"), "each walks its round (" + G1.map((g) => g.walked.toFixed(1) + " m " + g.mode).join(", ") + ")");
  // put the first guard on open ground in the plot and him in front of it, 5 m off, then behind it
  const spot = await D(() => {
    const d = window.Rocket.debug(), S = d.stands(), w = d.w, g = d.guards()[0];
    for (let r = 0; r < 40; r++) for (let a = 0; a < Math.max(1, 8 * r); a++) {
      const th = a / Math.max(1, 8 * r) * 2 * Math.PI, x = Math.floor(g.x + Math.cos(th) * r), z = Math.floor(g.z + Math.sin(th) * r);
      let ok = true;
      for (let k = -6; k <= 6 && ok; k++) { const c = z * w.SX + x + k; if (S[c] < 0 || S[c] !== S[z * w.SX + x]) { ok = false; } for (let h = 0; h < 4 && ok; h++) { if (w.SOLID[w.get(x + k, S[z * w.SX + x] + h, z)]) { ok = false; } } }
      if (ok) { return { x, z, y: S[z * w.SX + x] }; }
    }
    return null;
  });
  if (!check(!!spot, "open level ground in the plot " + JSON.stringify(spot))) { await browser.close(); process.exit(1); }
  const place = (gx, px, face) => D((a) => {
    const d = window.Rocket.debug(), g = d.guards()[0];
    d.guards().forEach((o, i) => { if (i) { Object.assign(o, { mode: "hold", holdT: 1e9 }); } });
    Object.assign(g, { x: a.gx, y: a.y, z: a.z, face: a.face, mode: "round", pause: 1e9, tell: 0, tellT: 0, seenAt: -1e9 });
    Object.assign(d.P, { x: a.px, y: a.y, z: a.z, vx: 0, vy: 0, vz: 0 });
    window.__toasts.length = 0;
  }, { gx, px, face, y: spot.y, z: spot.z + 0.5 });
  // he stands 5 m east of it; it faces east (yaw pi/2), then west
  await place(spot.x - 4.5, spot.x + 0.5, Math.PI / 2);
  await frames(P, 14);
  let r = await D(() => ({ mode: window.Rocket.debug().guards()[0].mode, toasts: window.__toasts.slice(), near: document.getElementById("near").textContent }));
  check(r.mode === "chase" && r.toasts.indexOf("A guard has seen you.") >= 0, "in front within 9 m it sees him and chases (" + JSON.stringify(r) + ")");
  check(/A guard · \d+ m/.test(r.near), "the direction line says a guard chases (" + r.near + ")");
  await P.screenshot({ path: `${out}/guard_chases.png` });
  await place(spot.x - 4.5, spot.x + 0.5, -Math.PI / 2);
  await frames(P, 14);
  r = await D(() => ({ mode: window.Rocket.debug().guards()[0].mode }));
  check(r.mode === "round", "behind it, it does not see him (" + r.mode + ")");
  // a wall between: a column of stone in the line
  await D((a) => { const d = window.Rocket.debug(); for (let h = 0; h < 4; h++) { d.w.set(a.x - 2, a.y + h, a.z, 3); } d.remeshAt(a.x - 2, a.z); }, spot);
  await place(spot.x - 4.5, spot.x + 0.5, Math.PI / 2);
  await frames(P, 14);
  r = await D(() => ({ mode: window.Rocket.debug().guards()[0].mode }));
  check(r.mode === "round", "a wall between, it does not see him (" + r.mode + ")");
  await D((a) => { const d = window.Rocket.debug(); for (let h = 0; h < 4; h++) { d.w.set(a.x - 2, a.y + h, a.z, 0); } d.remeshAt(a.x - 2, a.z); }, spot);
  // the grab: a coin taken first; it in reach, chasing: after a beat (not before) an alarm and the coin back
  await D(() => { const d = window.Rocket.debug(); d.takeCoin(0); });
  const had = await D(() => window.Rocket.debug().coins().got.length);
  await place(spot.x - 0.5, spot.x + 0.5, Math.PI / 2);
  await D(() => { const g = window.Rocket.debug().guards()[0]; g.mode = "chase"; g.seenAt = performance.now(); g.pause = 0; window.__toasts.length = 0; });
  const beatF = Math.ceil(K.GUARD.TELL * 1000 / 25);
  await frames(P, beatF - 3);
  r = await D(() => ({ alarms: window.Rocket.debug().alarms(), tell: window.Rocket.debug().guards()[0].tell }));
  check(r.alarms === 0 && r.tell > 0.5, "its arms rise for a beat first (alarms " + r.alarms + ", arms " + r.tell.toFixed(2) + ")");
  await P.screenshot({ path: `${out}/guard_reaches.png` });
  await frames(P, 6);
  r = await D(() => ({ alarms: window.Rocket.debug().alarms(), got: window.Rocket.debug().coins().got.length, toasts: window.__toasts.slice(), mode: window.Rocket.debug().guards()[0].mode }));
  check(r.alarms === 1 && r.got === had - 1 && r.mode === "hold", "a beat in reach, it has hold of him: an alarm, the last coin back (" + had + " to " + r.got + "), it stands (" + JSON.stringify(r) + ")");
  check(r.toasts.some((t) => t.indexOf("A guard has hold of you") === 0), "it says so");
  // the grace: another, chasing in reach, does not grab within a bar
  await D(() => { const d = window.Rocket.debug(), gs = d.guards(); if (gs[1]) { Object.assign(gs[1], { x: gs[0].x, z: gs[0].z + 0.6, y: gs[0].y, mode: "chase", seenAt: performance.now(), holdT: 0 }); } });
  await frames(P, beatF + 4);
  r = await D(() => ({ alarms: window.Rocket.debug().alarms() }));
  check(r.alarms === 1, "no second grab within a bar (alarms " + r.alarms + ")");
  // the third alarm walks him out (two set; the grace over)
  await frames(P, 80);
  await D(() => window.Rocket.debug().alarms(2));
  await place(spot.x - 0.5, spot.x + 0.5, Math.PI / 2);
  await D(() => { const d = window.Rocket.debug(), g = d.guards()[0]; Object.assign(g, { mode: "chase", seenAt: performance.now(), pause: 0 }); });
  await P.waitForFunction(() => { const i = window.Rocket.debug().intro(); return i && i.lines[0] === "The guards walk you out."; }, null, { timeout: 600000 }).catch(() => null);
  r = await D(() => ({ alarms: window.Rocket.debug().alarms(), intro: window.Rocket.debug().intro() && window.Rocket.debug().intro().lines[0] }));
  check(r.intro === "The guards walk you out." && r.alarms === 0, "the third alarm walks him out, the alarms quiet (" + JSON.stringify(r) + ")");
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await frames(P, 4);
  // the head out, the body grabbed: under his tree
  await D(() => window.Rocket.debug().toggle());
  await frames(P, 20);
  await D(() => { const d = window.Rocket.debug(), g = d.guards()[0]; Object.assign(g, { x: d.P.x - 1, z: d.P.z, y: d.P.y, mode: "chase", seenAt: performance.now(), holdT: 0 }); });
  await frames(P, beatF + 6);
  r = await D(() => ({ intro: window.Rocket.debug().intro() && window.Rocket.debug().intro().lines[0], head: !!window.Rocket.debug().head() }));
  check(r.intro === "The guards have your body." && !r.head, "the body grabbed while the head is out: he comes to under his tree (" + JSON.stringify(r) + ")");
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await frames(P, 4);
  // a tap on one: what it is
  // (on the open ground found above: it there, he three metres east looking at it)
  await D((a) => { const d = window.Rocket.debug(), g = d.guards()[0]; d.guards().forEach((o) => Object.assign(o, { mode: "hold", holdT: 1e9 })); Object.assign(g, { x: a.x - 2.5, y: a.y, z: a.z + 0.5, face: Math.PI / 2, amount: 0 });
    Object.assign(d.P, { x: a.x + 0.5, y: a.y, z: a.z + 0.5, vx: 0, vy: 0, vz: 0, yaw: -Math.PI / 2, face: -Math.PI / 2, pitch: -0.2 }); window.__toasts.length = 0; const b = d.cam().blend; if (b) { b.t0 = -1e9; } }, spot);
  await frames(P, 30);
  const sp = await D(() => { const d = window.Rocket.debug(), g = d.guards()[0], s = d.screenOf([g.x, g.y + 0.9, g.z]); if (s) { d.act(s[0], s[1], false); } return s; });
  await frames(P, 2);
  r = await D(() => ({ toasts: window.__toasts.slice() }));
  await P.screenshot({ path: `${out}/guard_tapped.png` });
  check(sp && r.toasts.some((t) => t.indexOf("A guard of") === 0), "a tap on a guard says what it is (" + JSON.stringify(r.toasts) + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

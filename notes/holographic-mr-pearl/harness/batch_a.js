// batch_a.js - the artist's asks of 26 Oct 2026: the button called Scope; pearls without end; a pearl breaks what it
// strikes and metal sends it back; the studies' stones say nothing (the homage's still do); the words under the glass
// only on a guard; a riddle on a work's label; as the hologram a double tap takes the head there, and onto a guard it
// rides it. node batch_a.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8815, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 4);
  const K = await D(() => window.Rocket.debug().sightConsts);
  // the button
  const btn = await D(() => ({ text: document.querySelector("#v-sight span").textContent, title: document.getElementById("v-sight").title }));
  check(btn.text === "Scope" && /^The scope/.test(btn.title), "the button is Scope (" + JSON.stringify(btn) + ")");
  // a platform in the air, clear of everything, a wall of brick five metres ahead at eye height
  const site = await D(() => {
    const d = window.Rocket.debug(), w = d.w, x = Math.floor(Math.min(Math.max(d.P.x, 12), w.SX - 20)), z = Math.floor(Math.min(Math.max(d.P.z, 12), w.SZ - 12));
    let top = 0; for (let X = x - 3; X <= x + 9; X++) { for (let Z = z - 3; Z <= z + 3; Z++) { for (let y = w.SY - 1; y > 0; y--) { if (w.get(X, y, Z)) { top = Math.max(top, y); break; } } } }
    const Y = Math.min(top + 6, w.SY - 8);
    w.set(x, Y, z, 15); d.remeshAt(x, z);   // (metal: a pearl coming back does not break it from under him)
    Object.assign(d.P, { x: x + 0.5, y: Y + 1, z: z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, pitch: 0, face: Math.PI / 2 });
    return { x, z, Y };
  });
  const wall = (b) => D((a) => { const d = window.Rocket.debug(), w = d.w; for (let y = a.Y; y <= a.Y + 3; y++) { for (let z = a.z - 2; z <= a.z + 2; z++) { w.set(a.x + 5, y, z, a.b); } } d.remeshAt(a.x + 5, a.z); }, Object.assign({ b }, site));
  const count = (b) => D((a) => { const w = window.Rocket.debug().w; let n = 0; for (let y = a.Y; y <= a.Y + 3; y++) { for (let z = a.z - 2; z <= a.z + 2; z++) { if (w.get(a.x + 5, y, z) === a.b) { n++; } } } return n; }, Object.assign({ b }, site));
  await wall(9);   // brick
  await frames(P, 4);
  await D(() => { window.__toasts.length = 0; window.Rocket.debug().raiseSight(true); });
  await frames(P, Math.ceil(K.T_VIEW * 40) + 10);
  const tag0 = await D(() => ({ hidden: document.getElementById("sight-tag").hidden, hit: window.Rocket.debug().sight().hit }));
  check(tag0.hidden && tag0.hit, "the nose on a wall: no words under the glass (" + JSON.stringify(tag0) + ")");
  const b0 = await count(9);
  await D(() => window.Rocket.debug().throwAt());
  await frames(P, 40);
  const b1 = await count(9), sh = await D(() => window.Rocket.debug().shards().length || 0);
  check(b1 === b0 - 1, "a pearl breaks the brick it strikes (" + b0 + " to " + b1 + ", shards " + sh + ")");
  await P.screenshot({ path: `${out}/pearl_breaks.png` });
  // metal sends it back: a metal wall, and a metal floor before it for what comes back to lie on
  await wall(B_METAL());
  await D((a) => { const d = window.Rocket.debug(), w = d.w; for (let X = a.x - 12; X <= a.x + 4; X++) { for (let z = a.z - 5; z <= a.z + 5; z++) { w.set(X, a.Y, z, 15); } } d.remeshAt(a.x - 8, a.z); d.remeshAt(a.x + 2, a.z); }, site);
  await frames(P, 4);
  const m0 = await count(B_METAL());
  await D(() => window.Rocket.debug().throwAt());
  // (the pearl watched until it first touches: what it touched, and which way it then goes)
  const pr = await D(() => new Promise((done) => { const d = window.Rocket.debug(), f0 = window.__frames, n0 = d.pearls().length;
    const go = () => { const ps = d.pearls(), p = ps[ps.length - 1]; if ((p && p.first) || window.__frames - f0 > 80) { setTimeout(() => { const q = d.pearls()[d.pearls().length - 1]; done(q ? { b: q.first && q.first.b, vx: q.vx, state: q.state } : null); }, 0); return; } requestAnimationFrame(go); }; go(); }));
  await frames(P, 40);
  const m1 = await count(B_METAL());
  check(m1 === m0 && pr && pr.b === 15 && pr.vx < 0, "metal sends it back, unbroken (" + m0 + " to " + m1 + "; " + JSON.stringify(pr) + ")");
  // pearls without end: twenty more, a beat apart; nothing counted short; at most thirteen lie about
  for (let i = 0; i < 20; i++) { await D(() => window.Rocket.debug().throwAt()); await frames(P, 21); }
  await frames(P, 40);
  const inf = await D(() => ({ n: window.Rocket.debug().pearls().length, toasts: window.__toasts.slice(), carried: window.Rocket.debug().carried(), shown: !document.getElementById("pearls").hidden }));
  check(inf.n <= 13 && inf.n >= 10 && !inf.toasts.some((t) => /No pearl/.test(t)) && !inf.shown, "twenty-two thrown, no end of them, " + inf.n + " lie about, no count shown (" + JSON.stringify(inf) + ")");
  // the words under the glass on a guard
  const gs = await D((a) => { const d = window.Rocket.debug(), g = d.guards()[0]; if (!g) { return null; } d.w.set(a.x + 5, a.Y, a.z, 0); for (let y = a.Y; y <= a.Y + 3; y++) { for (let z = a.z - 2; z <= a.z + 2; z++) { d.w.set(a.x + 5, y, z, 0); } } d.remeshAt(a.x + 5, a.z); Object.assign(g, { x: a.x + 8.5, y: a.Y + 1, z: a.z + 0.5 }); return true; }, site);
  if (gs) {
    // the look from his head to the guard's middle (the scope's line runs through his head)
    await D(() => { const d = window.Rocket.debug(), g = d.guards()[0], v = [g.x - d.P.x, g.y + 0.8 - (d.P.y + 1.3724), g.z - d.P.z], L = Math.hypot(...v); d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.asin(v[1] / L); });
    await frames(P, 10);
    const tg = await D(() => ({ hidden: document.getElementById("sight-tag").hidden, text: document.getElementById("sight-tag").textContent }));
    check(!tg.hidden && /A guard/.test(tg.text), "the nose on a guard: the words come up (" + JSON.stringify(tg) + ")");
    await P.screenshot({ path: `${out}/scope_on_guard.png` });
  } else { say("(no guards in this place: the guard's words not tried)"); }
  await D(() => window.Rocket.debug().raiseSight(false));
  await frames(P, Math.ceil(K.T_VIEW * 40) + 4);
  // the studies' stones say nothing; the homage's still do
  const st = await D(() => { const d = window.Rocket.debug(), s = d.studies(), h = d.homage(); return { s: s && s.stands[0] && s.stands[0].at, h: h && h.stands[0] && h.stands[0].at }; });
  if (st.s) {
    await D((a) => { window.__toasts.length = 0; Object.assign(window.Rocket.debug().P, { x: a[0], y: a[1], z: a[2], vx: 0, vy: 0, vz: 0 }); }, st.s);
    await frames(P, 30);
    const t1 = await D(() => window.__toasts.slice());
    check(!t1.some((t) => /^The (ladder|crux|closed|sphere)/.test(t)), "on a study's stone nothing is said (" + JSON.stringify(t1) + ")");
  }
  if (st.h) {
    await D((a) => { window.__toasts.length = 0; Object.assign(window.Rocket.debug().P, { x: a[0], y: a[1], z: a[2], vx: 0, vy: 0, vz: 0 }); }, st.h);
    await frames(P, 30);
    const t2 = await D(() => window.__toasts.slice());
    check(t2.some((t) => /^The first figure/.test(t)), "on the homage's stone it still says which figure (" + JSON.stringify(t2.slice(0, 1)) + ")");
  }
  // a riddle on a work's label
  const rd = await D(() => { const d = window.Rocket.debug(), p = d.paintings[0] || (d.paintings.length ? d.paintings[0] : null); if (!p) { return null; } d.showLabel(p); return document.querySelector("#label .l-room").textContent; });
  if (rd != null) { check(/^Riddle: .*\?$/.test(rd), "a work's label gives a riddle: " + JSON.stringify(rd)); await P.screenshot({ path: `${out}/riddle.png` }); }
  await D(() => { document.getElementById("label").hidden = true; });
  // as the hologram: a double tap takes the head there; a guard there, it rides it
  await D(() => window.Rocket.debug().toggle());
  await P.waitForFunction(() => { const h = window.Rocket.debug().head(); return h && h.phase === "free"; }, null, { timeout: 600000 });
  const W = await D(() => ({ w: innerWidth, h: innerHeight }));
  const dbl = async (x, y) => {
    if (view === "phone") {
      await D((a) => { const cv = document.getElementById("view"); for (let i = 0; i < 2; i++) { const o = { pointerId: 200 + i, pointerType: "touch", clientX: a.x, clientY: a.y, bubbles: true }; cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", o)); } }, { x, y });
    } else {
      await D(() => { const cv = document.getElementById("view"), r = cv.getBoundingClientRect(); for (let i = 0; i < 2; i++) { const o = { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }; cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); } });
    }
  };
  const h0 = await D(() => { const h = window.Rocket.debug().head(); return [h.x, h.y, h.z]; });
  // (pointed a little below the horizon, at the ground ahead)
  await D(() => { window.Rocket.debug().P.pitch = -0.35; });
  await frames(P, 6);
  await dbl(view === "phone" ? W.w * 0.6 : 0, view === "phone" ? W.h * 0.6 : 0);
  await frames(P, 2);
  const h1 = await D(() => { const h = window.Rocket.debug().head(); return [h.x, h.y, h.z]; });
  const moved = Math.hypot(h1[0] - h0[0], h1[1] - h0[1], h1[2] - h0[2]);
  check(moved > 3, "a double " + (view === "phone" ? "tap" : "click") + " takes the head where it points (" + moved.toFixed(1) + " m)");
  await P.screenshot({ path: `${out}/teleported.png` });
  if (gs) {
    // a guard on open ground ahead of the head: a double tap on it, and it carries the head on its round
    // the head put three metres off the guard and a metre over it, looking at its middle
    const g0 = await D(() => { const d = window.Rocket.debug(), h = d.head(), g = d.guards()[0]; Object.assign(h, { x: g.x - 3, y: g.y + 2, z: g.z, vx: 0, vy: 0, vz: 0 });
      const v = [g.x - h.x, g.y + 0.8 - h.y, g.z - h.z], L = Math.hypot(...v); d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.asin(v[1] / L); return { g: [g.x, g.y, g.z] }; });
    await frames(P, 30);
    g0.s = await D(() => { const d = window.Rocket.debug(), g = d.guards()[0]; return d.screenOf([g.x, g.y + 0.8, g.z]); });
    if (g0.s) {
      if (view === "phone") { await dbl(g0.s[0], g0.s[1]); }
      else { await D((g) => { const d = window.Rocket.debug(), h = d.head(), v = [g[0] - h.x, g[1] + 1 - h.y, g[2] - h.z], L = Math.hypot(...v); d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.asin(v[1] / L); }, g0.g); await frames(P, 4); await dbl(0, 0); }
      await frames(P, 4);
      await D(() => { const g = window.Rocket.debug().guards()[0]; Object.assign(g, { mode: "round", pause: 0, holdT: 0 }); });
      const r0 = await D(() => { const h = window.Rocket.debug().head(), g = window.Rocket.debug().guards()[0]; return { on: !!h.on, dx: h.x - g.x, dz: h.z - g.z, dy: h.y - g.y }; });
      await frames(P, 60);
      const r1 = await D(() => { const h = window.Rocket.debug().head(), g = window.Rocket.debug().guards()[0]; return { on: !!h.on, dx: h.x - g.x, dz: h.z - g.z, walked: g.walked }; });
      check(r0.on && r1.on && Math.hypot(r1.dx, r1.dz) < 0.01, "a double tap on a guard: the head rides it as it walks (" + JSON.stringify([r0, r1]) + ")");
      await P.screenshot({ path: `${out}/riding.png` });
      if (view === "phone") { await D((W) => { const cv = document.getElementById("view"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 300, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85, bubbles: true })); cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 300, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W); }
      else { await P.keyboard.down("w"); }
      await frames(P, 30);
      if (view === "phone") { await D((W) => { document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 300, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W); } else { await P.keyboard.up("w"); }
      const r2 = await D(() => ({ on: !!window.Rocket.debug().head().on }));
      check(!r2.on, "the stick takes it off (" + JSON.stringify(r2) + ")");
    } else { say("(the guard not on the screen: riding not tried)"); }
  }
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
function B_METAL() { return 15; }

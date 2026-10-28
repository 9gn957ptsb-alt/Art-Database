// spam.js - the work spammed (artist, 28 Oct 2026: "When I am breaking something with Mr Pearls guitar, I will spam
// the object to break or place something. However, because of the double tap dash now, I end up dashing away when
// breaking things. I want you to incorporate the dash when tapping to breaking and placing now, that way when I spam
// place or break Mr Pearl can now those tasks twice as fast"): walking, a run of taps on a block (each within a beat of
// the last) breaks, never dashes; nor in Place; a run ended, a double tap at the sky still dashes; a strike in a run
// breaks two (the block and the one behind it), at the swing's own pace; a tap in Place in a run lays two.
// node spam.js desk|phone outdir port [hash]
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
  const K = await D(() => window.Rocket.debug().smashConsts());
  // a metal floor in the air (as dash.js), and on it, ahead, a box of brick 6 deep, 3 high, 5 wide
  const A = await D(() => {
    const d = window.Rocket.debug(), w = d.w, x = Math.max(4, Math.min(Math.floor(d.P.x) - 10, w.SX - 26)), z = Math.floor(d.P.z);
    let top = 0; for (let X = x - 2; X <= x + 22; X++) { for (let Z = z - 2; Z <= z + 2; Z++) { for (let y = w.SY - 1; y > 0; y--) { if (w.get(X, y, Z)) { top = Math.max(top, y); break; } } } }
    const Y = Math.min(top + 6, w.SY - 10);
    for (let X = x - 1; X <= x + 21; X++) { for (let Z = z - 2; Z <= z + 2; Z++) { w.set(X, Y, Z, 15); for (let y = Y + 1; y < Y + 8; y++) { w.set(X, y, Z, 0); } } }
    return { x, z, Y };
  });
  const box = (x0) => D((a) => { const d = window.Rocket.debug(), w = d.w;
    for (let X = a.x - 1; X <= a.x + 21; X++) { for (let Z = a.z - 2; Z <= a.z + 2; Z++) { for (let y = a.Y + 1; y < a.Y + 8; y++) { w.set(X, y, Z, X >= a.x0 && X < a.x0 + 6 && y <= a.Y + 3 ? 9 : 0); } } }
    for (let X = a.x - 1; X <= a.x + 21; X += 4) { d.remeshAt(X, a.z); } }, Object.assign({ x0 }, A));
  const stand = (pitchAt) => D((a) => { const d = window.Rocket.debug(); Object.assign(d.P, { x: a.x + 0.5, y: a.Y + 1, z: a.z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, pitch: -0.2, face: Math.PI / 2 }); d.P.want = null; }, A);
  // the view turned so the crosshair (the screen's centre) is on a point
  const aimAt = (q) => D((q) => { const d = window.Rocket.debug();
    for (let i = 0; i < 4; i++) { const c = d.cam(), e = c.eye, v = [q[0] - e[0], q[1] - e[1], q[2] - e[2]]; d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); } }, q);
  const W = await D(() => ({ w: innerWidth, h: innerHeight }));
  const walkOn = () => view === "phone" ? D((W) => { const cv = document.getElementById("view"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85, bubbles: true })); cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W) : P.keyboard.down("w");
  const walkOff = () => view === "phone" ? D((W) => { document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W) : P.keyboard.up("w");
  // a tap (a click) at the screen's centre: where the crosshair is
  let pid = 100;
  const tap = () => D((a) => { const cv = document.getElementById("view"), r = cv.getBoundingClientRect(), o = { pointerId: a.id, pointerType: a.v === "phone" ? "touch" : "mouse", button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true };
    cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); return performance.now(); }, { v: view, id: pid++ });
  const solid = () => D((a) => { const w = window.Rocket.debug().w; let n = 0; for (let X = a.x; X <= a.x + 20; X++) { for (let Z = a.z - 2; Z <= a.z + 2; Z++) { for (let y = a.Y + 1; y < a.Y + 8; y++) { if (w.get(X, y, Z)) { n++; } } } } return n; }, A);
  const mode = (m) => D((m) => { const b = document.getElementById("mode"); if ((b.textContent || "").toLowerCase().indexOf(m) < 0) { b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 99, pointerType: "touch", bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { pointerId: 99, pointerType: "touch", bubbles: true })); } return window.Rocket.debug().mode ? window.Rocket.debug().mode() : b.textContent; }, m);
  // a recorder after each of the game's frames: the swing's clock, whether struck, the dash
  await D(() => { window.__rec = []; (function rec() { const d = window.Rocket.debug(), s = d.swing(); window.__rec.push({ t: performance.now(), u: s ? s.u : null, struck: s ? s.struck : null, at: s && s.at, quick: s && s.quick, dash: !!d.dash(), x: d.P.x }); requestAnimationFrame(rec); })(); });
  const recSince = (t) => D((t) => window.__rec.filter((r) => r.t >= t), t);
  // the moments a swing struck after t (the frame its struck flag turns on, or its target changes struck)
  const strikes = (rec) => { const o = []; let prev = null; for (const r of rec) { const k = r.at ? r.at.join(",") : ""; if (r.struck && !(prev && prev.struck && prev.k === k)) { o.push(r.t); } prev = { struck: r.struck, k }; } return o; };

  // 1. walking toward the box (its face 4.5 m on), a run of taps on it: blocks break, he never dashes
  await box(A.x + 5); await stand(); await frames(P, 4);
  await aimAt([A.x + 5, A.Y + 2.2, A.z + 0.5]); await frames(P, 2);
  const m1 = await mode("break");
  const n0 = await solid();
  await walkOn(); await frames(P, 3);
  const t1 = await tap(); const x1 = await D(() => window.Rocket.debug().P.x);
  for (let i = 0; i < 5; i++) { await frames(P, 2); await tap(); }
  await frames(P, 8); await walkOff(); await frames(P, 4);
  const r1 = await recSince(t1), n1 = await solid(), x2 = await D(() => window.Rocket.debug().P.x);
  const dashed1 = r1.some((r) => r.dash), walkedMax = K.BEAT * 0 + ((r1[r1.length - 1].t - t1) / 1000) * 4.3 + 0.3;
  check(!dashed1 && n0 - n1 >= 2 && x2 - x1 < walkedMax, "walking, a run of " + (view === "phone" ? "taps" : "clicks") + " on the box breaks it and never dashes (mode " + m1 + ", " + (n0 - n1) + " broken; " + (x2 - x1).toFixed(2) + " m on, at most his walk " + walkedMax.toFixed(2) + "; dash " + dashed1 + ")");
  await P.screenshot({ path: `${out}/01_run_broke.png` });

  // 2. the same in Place: blocks laid, no dash
  await box(A.x + 5); await stand(); await frames(P, 30);
  await aimAt([A.x + 5, A.Y + 2.2, A.z + 0.5]); await frames(P, 2);
  const m2 = await mode("place");
  const p0 = await solid();
  await walkOn(); await frames(P, 3);
  const t2 = await tap();
  for (let i = 0; i < 3; i++) { await frames(P, 2); await tap(); }
  await frames(P, 6); await walkOff(); await frames(P, 4);
  const r2 = await recSince(t2), p1 = await solid();
  check(!r2.some((r) => r.dash) && p1 - p0 >= 2, "walking, a run of taps in Place lays blocks and never dashes (mode " + m2 + ", " + (p1 - p0) + " laid)");
  await P.screenshot({ path: `${out}/02_run_laid.png` });

  // 3. a beat and more with no tap (the run over), walking, a double tap at the sky: the dash, as before
  await mode("break"); await box(A.x + 30); await stand(); await frames(P, 30);
  await D(() => { const d = window.Rocket.debug(); d.P.yaw = Math.PI / 2; d.P.pitch = 0.3; }); await frames(P, 2);
  await walkOn(); await frames(P, 6);
  const t3 = await tap(); await frames(P, 1); await tap(); await frames(P, 3);
  const r3 = await recSince(t3);
  await walkOff(); await frames(P, 8);
  check(r3.some((r) => r.dash), "the run over, walking, a double tap at the sky still dashes (" + r3.some((r) => r.dash) + ")");

  // 4. standing: a lone tap strikes half a beat on (SWING) and breaks the block; a pair on a block breaks it and the
  // one behind it at that strike; a run of taps on the box breaks two a strike, at the swing's own pace
  await box(A.x + 3); await stand(); await frames(P, 30);
  await aimAt([A.x + 3, A.Y + 2.5, A.z + 0.5]); await frames(P, 2);
  const c0 = await solid(), t4 = await tap(); await frames(P, 14);
  const s4 = strikes(await recSince(t4)), lone = s4.length ? (s4[0] - t4) / 1000 : null, c1 = await solid();
  check(lone != null && Math.abs(lone - K.SWING) <= 0.045 && c0 - c1 === 1, "a lone tap strikes half a beat on and breaks one (" + (lone && lone.toFixed(3)) + " s; SWING " + K.SWING.toFixed(3) + "; " + (c0 - c1) + " broken)");
  await box(A.x + 3); await frames(P, 30);
  const cellAt = (c) => D((c) => window.Rocket.debug().w.get(c[0], c[1], c[2]), c);
  await aimAt([A.x + 3, A.Y + 2.5, A.z + 0.5]); await frames(P, 2);
  const t6 = await tap(); await frames(P, 2); await tap(); await frames(P, 14);
  const s6 = strikes(await recSince(t6)), pair = [await cellAt([A.x + 3, A.Y + 2, A.z]), await cellAt([A.x + 4, A.Y + 2, A.z]), await cellAt([A.x + 5, A.Y + 2, A.z])];
  check(s6.length === 1 && Math.abs((s6[0] - t6) / 1000 - K.SWING) <= 0.045 && pair[0] === 0 && pair[1] === 0 && pair[2] !== 0, "a pair of taps on a block: one strike, half a beat on, breaks it and the one behind it, no more (" + JSON.stringify(pair) + ")");
  await box(A.x + 3); await frames(P, 30);
  const b0 = await solid(), cells = [];
  for (let L = 0; L < 2; L++) { for (let y = 1; y <= 3; y++) { for (let dz = -1; dz <= 1; dz++) { cells.push([A.x + 3 + L, A.Y + y + 0.5, A.z + dz + 0.5]); } } }
  let t5 = null, tLast = null;
  for (let i = 0; i < 12; i++) { await aimAt(cells[i]); tLast = await tap(); t5 = t5 || tLast; await frames(P, 2); }
  await frames(P, 20);
  const r5 = await recSince(t5), s5 = strikes(r5), b1 = await solid(), quick = r5.some((r) => r.quick);
  const gaps = s5.slice(1).map((t, i) => (t - s5[i]) / 1000);
  // (the strikes at the swing's own pace, a SWING apart at the soonest; each breaking two, unless the one behind is
  // out of his reach)
  check(quick && s5.length >= 2 && b0 - b1 >= 2 * s5.length - 2 && Math.min.apply(null, gaps) >= K.SWING - 0.045, "a run of 12 taps: " + s5.length + " strikes a SWING apart at the soonest (" + gaps.map((g) => g.toFixed(2)).join(" ") + "), " + (b0 - b1) + " broken: two a strike");
  await P.screenshot({ path: `${out}/04_two_a_strike.png` });

  // 5. standing, Place: a lone tap lays one; the next in its run lays two (on the first, the way it was laid)
  await box(A.x + 5); await stand(); await frames(P, 30);
  await aimAt([A.x + 5, A.Y + 2.5, A.z + 0.5]); await frames(P, 2);
  await mode("place");
  const q0 = await solid(); await tap(); await frames(P, 3);
  const q1 = await solid(); await tap(); await frames(P, 3);
  const q2 = await solid();
  check(q1 - q0 === 1 && q2 - q1 === 2, "in Place a lone tap lays one (" + (q1 - q0) + "), the next in its run two (" + (q2 - q1) + ")");
  await P.screenshot({ path: `${out}/05_two_laid.png` });
  await mode("break");

  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

// dash.js - the dash (artist, 27 Oct 2026: "When I am walking with Mr. Pearl, I want to be able to double tap with my
// right hand and he quickly dashes forward 10 feet"): walking, a double tap (a double click) takes him ten feet on
// along his way in half a beat; standing, it does not. node dash.js desk|phone outdir port [hash]
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
  // a metal floor in the air, twenty metres east, clear of everything; he stands at its west end facing east
  const a = await D(() => {
    const d = window.Rocket.debug(), w = d.w, x = Math.max(4, Math.min(Math.floor(d.P.x) - 10, w.SX - 26)), z = Math.floor(d.P.z);
    let top = 0; for (let X = x - 2; X <= x + 22; X++) { for (let Z = z - 2; Z <= z + 2; Z++) { for (let y = w.SY - 1; y > 0; y--) { if (w.get(X, y, Z)) { top = Math.max(top, y); break; } } } }
    const Y = Math.min(top + 6, w.SY - 8);
    for (let X = x - 1; X <= x + 21; X++) { for (let Z = z - 2; Z <= z + 2; Z++) { w.set(X, Y, Z, 15); } }
    for (let X = x; X <= x + 21; X += 8) { d.remeshAt(X, z); }
    Object.assign(d.P, { x: x + 0.5, y: Y + 1, z: z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, pitch: -0.2, face: Math.PI / 2 });
    return { x, z, Y };
  });
  await frames(P, 10);
  const K = await D(() => window.Rocket.debug().dashConsts);
  const W = await D(() => ({ w: innerWidth, h: innerHeight }));
  const walkOn = () => view === "phone" ? D((W) => { const cv = document.getElementById("view"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85, bubbles: true })); cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W) : P.keyboard.down("w");
  const walkOff = () => view === "phone" ? D((W) => { document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 50, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W) : P.keyboard.up("w");
  const dbl = () => D((v) => { const cv = document.getElementById("view"), r = cv.getBoundingClientRect(), x = r.left + r.width * 0.7, y = r.top + r.height * 0.35;
    for (let i = 0; i < 2; i++) { const o = { pointerId: 60 + i, pointerType: v === "phone" ? "touch" : "mouse", button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }; cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); } }, view);
  const px = () => D(() => window.Rocket.debug().P.x);
  // walking: twelve frames (0.3 s) at his walk, then twelve with a double tap at their start
  await walkOn(); await frames(P, 12);
  const w0 = await px(); await frames(P, 12); const w1 = await px();
  await dbl(); const dOn = await D(() => !!window.Rocket.debug().dash());
  await frames(P, 12); const w2 = await px();
  await walkOff(); await frames(P, 6);
  const walk = w1 - w0, dashed = w2 - w1;
  // (the dash takes the walk's place while it lasts: ten feet, then his walk for what is left of the 0.3 s)
  check(dOn && dashed > K.D - 0.02 && dashed < K.D + walk + 0.02, "walking, a double " + (view === "phone" ? "tap" : "click") + " dashes him on (" + walk.toFixed(2) + " m walked in 0.3 s; " + dashed.toFixed(2) + " m with the dash: ten feet, " + K.D + " m, and the rest of the 0.3 s walked)");
  // standing: no dash
  const s0 = await px(); await dbl(); await frames(P, 12); const s1 = await px();
  check(Math.abs(s1 - s0) < 0.2 && !(await D(() => !!window.Rocket.debug().dash())), "standing, a double tap does not dash (" + (s1 - s0).toFixed(2) + " m)");
  await P.screenshot({ path: `${out}/dashed.png` });
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

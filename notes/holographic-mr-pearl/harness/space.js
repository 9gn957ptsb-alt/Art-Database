// space.js - the ride and space (artist, 21 Oct 2026): ten coins build the rocket; he rides it, the stick steering it
// until the figure in the sky is passed; then space: the ship, the windshield and the mark, shots from the guns, ten
// brought down, the last head on, the hit, the fall: the place again, pieces and coins where they lay.
// node space.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
// A swing kept up over the view, dispatched in the page on the game's frames: round a circle a quarter of the screen's
// height across, `turns` turns a second, for `secs` seconds of the game's clock (25 ms a frame).
const swing = (P, turnsPerSec, secs) => P.evaluate((a) => new Promise((done) => {
  const cv = document.getElementById("view"), W = innerWidth, H = innerHeight, f0 = window.__frames, n = Math.round(a.secs * 40);
  const go = () => {
    const k = window.__frames - f0, th = k * 0.025 * a.tps * 2 * Math.PI;
    cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 70, pointerType: "mouse", clientX: W / 2 + Math.cos(th) * H / 8, clientY: H / 2 + Math.sin(th) * H / 8, bubbles: true }));
    if (k < n) { requestAnimationFrame(go); } else { done(); }
  };
  go();
}), { tps: turnsPerSec, secs });
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8815, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 4);
  // the ten coins: the rocket built; a note read, to see it kept after the fall
  await D(() => { const d = window.Rocket.debug(), c = d.coins(); d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); c.list.forEach((q, i) => d.takeCoin(i)); const n = d.notes[0]; if (n) { d.readNote(n.x, n.y, n.z); } });
  await frames(P, 4);
  const known0 = await D(() => Object.keys(window.Rocket.debug().known).length);
  check(await D(() => !document.getElementById("launch").hidden), "ten coins: Launch offered");
  await D(() => { window.__toasts.length = 0; window.Rocket.debug().launch(); });
  // the fire struck by a swing kept up (fire.js tests it)
  await swing(P, 4, 4);
  await P.waitForFunction(() => !!window.Rocket.debug().ride(), null, { timeout: 900000 });
  await frames(P, 30);
  const R0 = await D(() => window.Rocket.debug().ride());
  check(!!R0 && R0.top > 13, "he rides it: the threshold the figure in the sky's height (" + (R0 && R0.top.toFixed(1)) + " m)");
  await P.screenshot({ path: `${out}/ride_up.png` });
  // the stick steers it across
  const steer = await D(async () => { const d = window.Rocket.debug(), r = d.ride(); const x0 = r.dx, z0 = r.dz; document.dispatchEvent(new KeyboardEvent("keydown", { key: "d" })); return { x0, z0 }; });
  await frames(P, 20);
  await D(() => document.dispatchEvent(new KeyboardEvent("keyup", { key: "d" })));
  const R1 = await D(() => window.Rocket.debug().ride());
  check(Math.hypot(R1.dx - steer.x0, R1.dz - steer.z0) > 0.5, "the stick (D) steers it across (" + Math.hypot(R1.dx - steer.x0, R1.dz - steer.z0).toFixed(2) + " m)");
  await P.waitForFunction(() => { const r = window.Rocket.debug().ride(); return r && r.cut; }, null, { timeout: 900000 });
  const t1 = await D(() => window.__toasts.slice());
  check(t1.some((t) => t.indexOf("Past the figure in the sky") === 0), "past the figure in the sky, control goes and the camera watches");
  await frames(P, 20);
  await P.screenshot({ path: `${out}/ride_watched.png` });
  await P.waitForFunction(() => !!window.Rocket.debug().space(), null, { timeout: 900000 });
  // the eyes open first, as on opening the Artifact; then the stick is his
  await frames(P, 20);
  await P.screenshot({ path: `${out}/space_waking.png` });
  const wk = await D(() => ({ phase: window.Rocket.debug().space().phase, en: window.Rocket.debug().space().enemies.length }));
  check(wk.phase === "wake" && wk.en === 0, "in space he comes to first, the eyes opening (" + JSON.stringify(wk) + ")");
  await P.waitForFunction(() => { const s = window.Rocket.debug().space(); return s && s.phase === "fight"; }, null, { timeout: 900000 });
  await frames(P, 10);
  const S0 = await D(() => ({ where: document.getElementById("where").textContent, fire: document.getElementById("jump").getAttribute("aria-label"), on: document.body.dataset.space, en: window.Rocket.debug().space().enemies.length, K: window.Rocket.debug().spaceConsts() }));
  say("space " + JSON.stringify(S0));
  check(S0.on === "true" && S0.where === "Space · 0 of 10 down" && S0.fire === "Fire", "space: the tally, the jump made Fire");
  check(S0.en === 2, "two come at a time (" + S0.en + ")");
  await P.screenshot({ path: `${out}/space.png` });
  // a tap fires two shots, from the guns
  await D(() => window.Rocket.debug().act(10, 10, false));
  await frames(P, 2);
  const shots = await D(() => window.Rocket.debug().space().shots.filter((s) => s.mine).length);
  check(shots === 2, "a tap fires both guns (" + shots + " shots)");
  await frames(P, 30);
  // ten brought down: each in turn set on the mark's line ahead, and fired at
  for (let k = 0; k < 14; k += 1) {
    const st = await D(() => { const d = window.Rocket.debug(), s = d.space(); return s && { down: s.down, phase: s.phase }; });
    if (!st || st.down >= 10) { break; }
    await D(() => {
      const d = window.Rocket.debug(), s = d.space(), c = d.cam(), K = d.spaceConsts(), e = s.enemies.find((q) => !q.last);
      if (!e) { return; }
      const yaw = c.last.yaw, pitch = c.last.pitch - K.MARK, f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      for (let i = 0; i < 3; i += 1) { e.p[i] = c.eye[i] + f[i] * K.SPACE.ZERO; e.v[i] = 0; }
      s.fired = -1e9; d.act(10, 10, false);
    });
    await frames(P, 12);
    if (k === 3) { await P.screenshot({ path: `${out}/space_hit.png` }); }
  }
  const S1 = await D(() => { const s = window.Rocket.debug().space(); return s && { down: s.down, phase: s.phase, where: document.getElementById("where").textContent }; });
  check(S1 && S1.down === 10 && (S1.phase === "last" || S1.phase === "hit"), "ten brought down, the last comes (" + JSON.stringify(S1) + ")");
  // the last fires, the ship is hit and falls; he comes to again
  await P.waitForFunction(() => { const s = window.Rocket.debug().space(); return !s || s.phase === "hit"; }, null, { timeout: 900000 });
  await frames(P, 20);
  await P.screenshot({ path: `${out}/space_falling.png` });
  await P.waitForFunction(() => !window.Rocket.debug().space() && window.Rocket.debug().intro(), null, { timeout: 900000 });
  const A = await D(() => { const d = window.Rocket.debug(); return { intro: d.intro().lines[0], found: d.found.length, got: d.coins().got.length, known: Object.keys(d.known).length, coins: d.coins().list.length, launch: !document.getElementById("launch").hidden, space: document.body.dataset.space || "" }; });
  check(A.got === 0 && A.found === 0 && !A.launch && A.coins === 10 && !A.space, "down again: the place as it was, the coins and pieces to find again (" + JSON.stringify(A) + ")");
  check(A.known === known0, "what he read is kept (" + A.known + " of " + known0 + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

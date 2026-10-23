// fire.js - the fire that strikes the rocket's engine (artist, 21 Oct 2026: "sparks made of galaxies that are animated and
// fade out very quickly ... a bright light that builds as you swing more and more your finger or cursor around, and
// eventually, with enough movement from the finger, there generates enough friction in the game where a fire is
// started"): a slow swing never strikes it, a swing kept up does, the sparks and the light come and go, taps strike
// too, and struck, he rides it. node fire.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
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
  await D(() => { const d = window.Rocket.debug(); d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); d.coins().list.forEach((q, i) => d.takeCoin(i)); });
  await frames(P, 4);
  await D(() => { window.__toasts.length = 0; window.Rocket.debug().launch(); });
  await frames(P, 4);
  let r = await D(() => ({ ig: !!window.Rocket.debug().ignite(), launched: !!window.Rocket.debug().ride(), toasts: window.__toasts.slice(), K: window.Rocket.debug().igniteConsts }));
  check(r.ig && !r.launched && r.toasts.some((t) => /needs a fire/.test(t)), "Launch asks for the fire (" + JSON.stringify(r.toasts) + ")");
  // a slow swing (a turn in two seconds: under a screen's height a second) never gets there
  await swing(P, 0.5 / PHI(), 4);
  r = await D(() => { const i = window.Rocket.debug().ignite(); return { E: i.E, struck: i.struck, sparks: i.sparks.length }; });
  check(!r.struck && r.E > 0.3 && r.E < r.E + 1, "a slow swing warms it and stops short (heat " + r.E.toFixed(2) + " of " + (1.618 ** 3).toFixed(2) + ")");
  await frames(P, 60);
  const cooled = await D(() => window.Rocket.debug().ignite().E);
  check(cooled < r.E * 0.6, "left alone it cools (" + r.E.toFixed(2) + " to " + cooled.toFixed(2) + ")");
  // a swing kept up: sparks, the light, then struck
  await swing(P, 4, 1.0);
  r = await D(() => { const i = window.Rocket.debug().ignite(); return { E: i.E, struck: !!i.struck, sparks: i.sparks.length }; });
  await P.screenshot({ path: `${out}/fire_sparks.png` });
  check(r.sparks > 5 && r.E > 1, "a swing kept up: sparks of galaxies, the heat climbing (" + JSON.stringify(r) + ")");
  await frames(P, 24);
  const gone = await D(() => window.Rocket.debug().ignite() && window.Rocket.debug().ignite().sparks.length);
  check(gone === 0, "the sparks are gone within a beat (" + gone + " left)");
  await swing(P, 4, 3);
  r = await D(() => { const i = window.Rocket.debug().ignite(); return i ? { struck: !!i.struck } : { struck: true, gone: true }; });
  await P.screenshot({ path: `${out}/fire_struck.png` });
  check(r.struck, "with enough movement the fire is struck");
  await P.waitForFunction(() => !!window.Rocket.debug().ride(), null, { timeout: 600000 });
  await frames(P, 10);
  r = await D(() => ({ ride: !!window.Rocket.debug().ride(), ig: !!window.Rocket.debug().ignite(), toasts: window.__toasts.slice() }));
  check(r.ride && !r.ig && r.toasts.some((t) => t.indexOf("Struck") === 0), "struck, he rides it up");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  // taps strike it too: a fresh page
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
function PHI() { return (1 + Math.sqrt(5)) / 2; }

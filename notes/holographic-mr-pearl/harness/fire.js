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
  // two fingers: a thumb resting on the stick while the other swings a little; only each finger's own path rubs
  // (the review, 23 Oct 2026: the way between the two had struck it in a tenth of a second)
  await D(() => new Promise((done) => {
    const cv = document.getElementById("view"), W = innerWidth, H = innerHeight, f0 = window.__frames;
    const go = () => {
      const k = window.__frames - f0;
      cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 71, pointerType: "touch", clientX: W * 0.2 + (k % 2), clientY: H * 0.8, bubbles: true }));
      cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 72, pointerType: "touch", clientX: W * 0.6 + 2 * k, clientY: H * 0.45, bubbles: true }));
      if (k < 20) { requestAnimationFrame(go); } else { done(); }
    };
    go();
  }));
  r = await D(() => { const i = window.Rocket.debug().ignite(); return { E: i.E, struck: !!i.struck }; });
  check(!r.struck && r.E < 0.3, "a thumb resting while another finger moves: only their own paths rub (heat " + r.E.toFixed(2) + ")");
  // the hologram (H) and the sight (R, the right button) wait while the fire is asked for
  await P.keyboard.press("h"); await P.keyboard.press("r");
  await D(() => { const cv = document.getElementById("view"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 73, pointerType: "mouse", button: 2, buttons: 2, clientX: 200, clientY: 200, bubbles: true })); cv.dispatchEvent(new PointerEvent("pointerup", { pointerId: 73, pointerType: "mouse", button: 2, buttons: 0, clientX: 200, clientY: 200, bubbles: true })); });
  await frames(P, 4);
  r = await D(() => ({ head: !!window.Rocket.debug().head(), sight: document.body.dataset.sight || "" }));
  check(!r.head && !r.sight, "no hologram and no sight while the fire is asked for (" + JSON.stringify(r) + ")");
  await frames(P, 80);
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
  // taps strike it too, however slowly they come: a fresh page; eleven taps (Space on a computer, the lower left of a phone)
  // half a bar apart do not, the twelfth does
  await P.reload({ waitUntil: "load" });
  await P.waitForFunction(() => { const b = document.getElementById("begin"); return (b && !b.disabled) || (window.Rocket && window.Rocket.debug().place); }, null, { timeout: 180000 });
  if (await D(() => { const b = document.getElementById("begin"); return !!b && !b.disabled && !b.closest("[hidden]"); })) { await P.click("#begin"); }
  await P.waitForFunction(() => window.Rocket && window.Rocket.debug().place && window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { const d = window.Rocket.debug(); document.getElementById("notes").hidden = true; d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); d.coins().list.forEach((q, i) => d.takeCoin(i)); window.__toasts.length = 0; d.launch(); });
  await frames(P, 4);
  // (a phone taps in the lower left, where the stick is when there is something to walk; a computer presses Space)
  const tap = view === "phone"
    ? (i) => D((i) => { const cv = document.getElementById("view"), o = { pointerId: 90 + i, pointerType: "touch", clientX: innerWidth * 0.15, clientY: innerHeight * 0.85, bubbles: true };
        cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", o)); }, i)
    : () => P.keyboard.press(" ");
  for (let i = 0; i < 11; i += 1) { await tap(i); await frames(P, 38); }
  r = await D(() => { const i = window.Rocket.debug().ignite(); return i ? { struck: !!i.struck, taps: i.taps, E: i.E } : null; });
  check(r && !r.struck && r.taps === 11, "eleven taps half a bar apart: not yet (" + JSON.stringify(r) + ")");
  await tap(11); await frames(P, 2);
  r = await D(() => { const i = window.Rocket.debug().ignite(); return i ? { struck: !!i.struck, taps: i.taps } : { gone: true }; });
  check(r.struck, "the twelfth strikes it (" + JSON.stringify(r) + ")");
  check(errors.length === 0, "no page errors after the taps " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
function PHI() { return (1 + Math.sqrt(5)) / 2; }

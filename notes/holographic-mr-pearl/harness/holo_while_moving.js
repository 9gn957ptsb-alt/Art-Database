// holo_while_moving.js - the left thumb on the stick, the right taps Holo, twice: node holo_while_moving.js outdir [port]
const { open, frames } = require("/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/scripts/game.js");
const fs = require("fs");
const [out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const bad = [];
const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } };
(async () => {
  const { browser, P, errors } = await open({ view: "phone", virtual: 25, port: port ? +port : 8803 });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; window.__clicks = 0; document.getElementById("v-holo").addEventListener("click", (e) => { window.__clicks += 1; window.__last = e.detail + ":" + e.pointerType + ":" + e.isTrusted; }, true); });
  await frames(P, 30);
  const cdp = await P.context().newCDPSession(P);
  const b = await D(() => { const r = document.getElementById("v-holo").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const L = { x: 90, y: 660, id: 1 };
  const send = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  // the left thumb down and pushing up
  await send("touchStart", [L]); await send("touchMove", [{ ...L, y: 620 }]); await frames(P, 8);
  // The right finger on the button: its own touch pointer (Chromium's touch emulation lifts the wrong finger of two),
  // pressed and lifted while the left thumb's touch, sent through the browser, stays down on the stick.
  let pid = 50;
  const tap = async () => {
    pid += 1;
    await D((id) => { const el = document.getElementById("v-holo"), r = el.getBoundingClientRect(), o = { pointerId: id, pointerType: "touch", isPrimary: false, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      el.dispatchEvent(new PointerEvent("pointerdown", o)); }, pid);
    await frames(P, 2);
    await D((id) => { const el = document.getElementById("v-holo"); el.dispatchEvent(new PointerEvent("pointerup", { pointerId: id, pointerType: "touch", bubbles: true })); }, pid);
    await frames(P, 2);
  };
  await tap(); await frames(P, 16);
  let s = await D(() => { const h = window.Rocket.debug().head(); return { head: h ? h.phase : null, pressed: document.getElementById("v-holo").getAttribute("aria-pressed") }; });
  check(s.head !== null && s.pressed === "true", "the left thumb held, a tap on Holo sends the head out (" + JSON.stringify(s) + ")");
  await P.screenshot({ path: out + "/1_holo_while_held.png" });
  await tap(); await frames(P, 6);
  s = await D(() => { const h = window.Rocket.debug().head(); return { head: h ? h.phase : null }; });
  check(s.head === "follow" || s.head === "home" || s.head === null, "a second tap, still held: the body follows the head (" + JSON.stringify(s) + ")");
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 120000 });
  await frames(P, 10);
  const moved0 = await D(() => window.Rocket.debug().P.walked);
  await frames(P, 20);
  const moved1 = await D(() => window.Rocket.debug().P.walked);
  check(moved1 > moved0, "back in third person, the held thumb still walks him (" + (moved1 - moved0).toFixed(2) + " m)");
  await send("touchEnd", []);
  // a lone tap on Holo toggles once, not twice (its click is not counted again)
  await frames(P, 4);
  await send("touchStart", [{ x: b.x, y: b.y, id: 3 }]); await send("touchEnd", []); await frames(P, 12);
  s = await D(() => { const h = window.Rocket.debug().head(); return { head: h ? h.phase : null, clicks: window.__clicks, last: window.__last }; });
  check(s.head === "lift" || s.head === "free", "a lone tap sends the head out once (" + JSON.stringify(s) + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

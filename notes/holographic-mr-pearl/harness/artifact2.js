// artifact2.js - the built Artifact (on 8805) boots and plays: the wake-up, walking, Holo out and back (the body
// follows), a smash at the crosshair; no page errors. node artifact2.js desk|phone outdir
const { open, frames, state } = require("./game.js");
const fs = require("fs");
const [view, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, P, errors } = await open({ view, play: true, virtual: 25, url: "http://127.0.0.1:8805/index.html" });
  const D = (fn, arg) => P.evaluate(fn, arg);
  let n = 0;
  const shot = async (name, wait) => { await frames(P, wait || 2); const s = await state(P); await P.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}_${name}.png` }); console.log(name, JSON.stringify(s)); return s; };
  console.log("title", await P.title(), "buttons", await D(() => [!!document.getElementById("v-holo"), !document.getElementById("joy"), !document.querySelector("[data-pov]")].join(",")));
  await D(() => { window.Rocket.debug().intro().t0 = performance.now() - 7400; });
  await shot("intro_eyes", 1);
  await D(() => { const i = window.Rocket.debug().intro(); if (i) { i.t0 = performance.now() - 9700; } });
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = performance.now() - b.dur * 1000; } document.getElementById("notes").hidden = true; });
  await shot("woke_third", 4);
  await P.keyboard.down("w"); await frames(P, 24); await P.keyboard.up("w");
  await shot("walked", 2);
  await P.keyboard.press("h"); await frames(P, 24);
  await P.keyboard.down("w"); await frames(P, 20); await P.keyboard.up("w");
  await shot("holo_flown", 2);
  await P.keyboard.press("h"); await frames(P, 30);
  await shot("body_following", 1);
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 900000, polling: 500 });
  await shot("followed", 6);
  await D(() => { window.Rocket.debug().P.pitch = -0.9; }); await frames(P, 4);
  const aim = await D(() => window.Rocket.debug().aim());
  const r = await D(() => { const c = document.getElementById("view").getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });
  if (view === "phone") { await P.touchscreen.tap(r.x, r.y + 60); } else { await P.mouse.click(r.x, r.y); }
  await shot("smash_swing", 8);
  await shot("smash_after", 20);
  console.log("aim", aim, "swing", await D(() => JSON.stringify(window.Rocket.debug().swing ? window.Rocket.debug().swing() : null)));
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

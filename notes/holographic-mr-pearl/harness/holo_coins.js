// holo_coins.js - the coins taken as the hologram (artist, 23 Oct 2026: "Make sure that I can still collect the coins
// when I'm in holographic mode"), by the controls a player has, in the built Artifact: Holo (the button on a phone, H on
// a computer), then flown at two coins, the look turned at each (as a drag turns it) and the stick (phone) or W
// (computer) held, until each is taken; the tally and the words count them. node holo_coins.js desk|phone outdir [port]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, play: true, virtual: 25, url: "http://127.0.0.1:" + (port || 8806) + "/index.html" });
  const D = (fn, a) => P.evaluate(fn, a);
  await P.waitForFunction(() => window.Rocket && window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { const i = window.Rocket.debug().intro(); if (i) { i.t0 = performance.now() - 9700; } });
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 4);
  const C = await D(() => { const d = window.Rocket.debug(), c = d.coins(); return { n: c.list.length, got: c.got.length, list: c.list.map((q) => ({ id: q.id, kind: q.kind, x: q.x, y: q.y, z: q.z })) }; });
  check(C.n === 10 && C.got === 0, "ten coins laid, none taken (" + C.n + ", " + C.got + ")");
  // Holo, as a player raises it
  if (view === "phone") { await P.tap("#v-holo"); } else { await P.keyboard.press("h"); }
  await P.waitForFunction(() => { const h = window.Rocket.debug().head(); return h && h.phase === "free"; }, null, { timeout: 600000 });
  check(true, "the head is out, by " + (view === "phone" ? "the Holo button" : "H"));
  // the two nearest the head that are not on the tree's crown (the tree's is a step from where he wakes)
  const order = await D((list) => { const h = window.Rocket.debug().head(); return list.filter((q) => q.kind !== "tree").map((q) => ({ id: q.id, kind: q.kind, d: Math.hypot(q.x - h.x, q.y - h.y, q.z - h.z) })).sort((a, b) => a.d - b.d).slice(0, 2); }, C.list);
  say("flying to " + JSON.stringify(order));
  // the stick held forward (phone: a thumb on the lower left pushed up), or W held (computer)
  const W = await D(() => ({ w: innerWidth, h: innerHeight }));
  const stickOn = async () => {
    if (view === "phone") {
      await D((W) => { const cv = document.getElementById("view"); cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 81, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85, bubbles: true }));
        cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 81, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W);
    } else { await P.keyboard.down("w"); }
  };
  const stickOff = async () => {
    if (view === "phone") { await D((W) => { document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 81, pointerType: "touch", clientX: W.w * 0.15, clientY: W.h * 0.85 - 80, bubbles: true })); }, W); }
    else { await P.keyboard.up("w"); }
  };
  let n = 0;
  for (const target of order) {
    // each frame the look is turned at the coin from where the head is (what a drag does), the stick held
    await stickOn();
    const r = await D((id) => new Promise((done) => {
      const d = window.Rocket.debug(), q = d.coins().list.find((c) => c.id === id), f0 = window.__frames;
      const go = () => {
        const h = d.head(), got = d.coins().got.indexOf(id) >= 0;
        if (got || !h || window.__frames - f0 > 800) { done({ got, frames: window.__frames - f0, phase: h && h.phase }); return; }
        const v = [q.x - h.x, q.y - h.y, q.z - h.z], L = Math.hypot(v[0], v[1], v[2]);
        d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.asin(Math.max(-1, Math.min(1, v[1] / L)));
        requestAnimationFrame(go);
      };
      go();
    }), target.id);
    await stickOff();
    n += r.got ? 1 : 0;
    const t = await D(() => ({ tally: document.getElementById("coins").textContent, toasts: window.__toasts.slice(-1) }));
    check(r.got, "flown at the " + target.kind + " coin " + target.d.toFixed(1) + " m off, the head takes it in " + r.frames + " frames (" + t.tally + "; " + JSON.stringify(t.toasts) + ")");
    await frames(P, 4);
  }
  await P.screenshot({ path: `${out}/holo_coin.png` });
  const end = await D(() => ({ got: window.Rocket.debug().coins().got.length, head: !!window.Rocket.debug().head(), tally: document.getElementById("coins").textContent }));
  check(end.got === 2 && end.head && /Coins 2 of 10/.test(end.tally), "two taken as the hologram, still out (" + JSON.stringify(end) + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

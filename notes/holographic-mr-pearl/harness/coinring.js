// coinring.js - the ten coins round his tree, and the coin win (artist, 28 Oct 2026: "I can't find all 10 rings, for
// now place them right by the tree that way they are easy to get / I collected all the coins and went to the launchpad
// and nothing happened / I want collecting the 10 coins as an alternative way to beating the game"): ten in a ring by
// the tree at his head's height over open ground; walked through, the tenth builds the rocket; the direction line
// leads to it; flown onto as the hologram the pad says the body must come; walked onto, the launch begins (the fire).
// node coinring.js desk|phone outdir port [hash]
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
  await frames(P, 6);
  // laid: ten, 2.5 to 6 m from the trunk, at his head's height over open ground level with the tree's
  const L = await D(() => {
    const d = window.Rocket.debug(), w = d.w, t = d.place.tree, tx = t.x + 0.5, tz = t.z + 0.5, y0 = Math.floor(d.place.crash.y);
    return d.coins().list.map((q) => { const x = Math.floor(q.x), z = Math.floor(q.z), y = Math.round(q.y - 1.3724);
      return { id: q.id, text: q.text, r: +Math.hypot(q.x - tx, q.z - tz).toFixed(2), dy: y - y0, feet: w.get(x, y, z), head: w.get(x, y + 1, z), under: w.SOLID[w.get(x, y - 1, z)] }; });
  });
  check(L.length === 10 && L.every((c) => c.r >= 2.4 && c.r <= 6.2 && Math.abs(c.dy) <= 1 && c.feet === 0 && c.head === 0 && c.under && /^by your tree, to its /.test(c.text)), "ten coins round the tree, over open ground (" + JSON.stringify(L.map((c) => [c.r, c.dy, c.text.replace("by your tree, to its ", "")])) + ")");
  check(new Set(L.map((c) => c.text)).size === L.length, "each says its own way from the tree (" + L.map((c) => c.text.replace("by your tree, to its ", "")).join(", ") + ")");
  const near0 = await D(() => document.getElementById("near").textContent);
  check(/A coin/.test(near0), "the direction line leads to a coin (" + near0 + ")");
  await P.screenshot({ path: `${out}/01_the_ring.png` });
  // walked through, one by one (the body's box): the tenth builds the rocket, and the line leads to it
  await D(() => { window.__toasts.length = 0; });
  for (let i = 0; i < L.length; i++) {
    await D((i) => { const d = window.Rocket.debug(), q = d.coins().list[i]; Object.assign(d.P, { x: q.x, y: q.y - 1.3724, z: q.z, vx: 0, vy: 0, vz: 0 }); }, i);
    await frames(P, 2);
  }
  const r = await D(() => { const d = window.Rocket.debug(); return { got: d.coins().got.length, launch: !document.getElementById("launch").hidden, near: document.getElementById("near").textContent, toasts: window.__toasts.slice(-2) }; });
  check(r.got === 10 && r.launch && /The rocket/.test(r.near) && r.toasts.some((x) => /The tenth coin/.test(x) && /Walk onto its ground/.test(x)), "the tenth coin builds the rocket; Launch is offered and the line leads to it (" + JSON.stringify(r) + ")");
  await P.screenshot({ path: `${out}/02_built.png` });
  // the hologram flown onto the pad: it says the body must come, and nothing launches
  const wr = await D(() => window.Rocket.debug().place.wreck);
  await D((wr) => { const d = window.Rocket.debug(); Object.assign(d.P, { x: wr.x + 0.5 + 6, z: wr.z + 0.5, vx: 0, vz: 0, yaw: -Math.PI / 2, face: -Math.PI / 2, pitch: -0.1 }); }, wr);
  await frames(P, 4);
  await D(() => window.Rocket.debug().toggle());
  await P.waitForFunction(() => { const h = window.Rocket.debug().head(); return h && h.phase === "free"; }, null, { timeout: 120000 }).catch(() => null);
  await D(() => { window.__toasts.length = 0; });
  await D((wr) => { const h = window.Rocket.debug().head(); Object.assign(h, { x: wr.x + 0.5 + 1, z: wr.z + 0.5, vx: 0, vy: 0, vz: 0 }); }, wr);
  await frames(P, 4);
  const hp = await D(() => ({ toasts: window.__toasts.slice(), ignite: !!window.Rocket.debug().ignite() }));
  check(!hp.ignite && hp.toasts.some((x) => /waits for his body/.test(x)), "the head flown onto the pad: told the body must come, no launch (" + JSON.stringify(hp) + ")");
  // the hologram left there: his body follows the head onto the pad, and the launch begins
  await D(() => window.Rocket.debug().toggle());
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 240000 }).catch(() => null);
  await frames(P, 6);
  const hb = await D(() => { const d = window.Rocket.debug(), wr = d.place.wreck; return { head: !!d.head(), ignite: !!d.ignite(), off: +Math.hypot(d.P.x - wr.x - 0.5, d.P.z - wr.z - 0.5).toFixed(2) }; });
  check(!hb.head && hb.ignite, "the hologram left on the pad: his body comes and the launch begins (" + JSON.stringify(hb) + ")");
  await P.screenshot({ path: `${out}/03_the_fire_from_the_head.png` });
  // the page again (the rocket kept by the save): walked onto the launchpad, the launch begins
  const again = async () => {
    await P.reload({ waitUntil: "load" });
    await P.waitForFunction(() => { const b = document.getElementById("begin"); return b && !b.disabled; }, null, { timeout: 600000 });
    await P.click("#begin");
    await P.waitForFunction(() => window.Rocket && window.Rocket.debug().place && window.Rocket.debug().intro(), null, { timeout: 600000 });
    await D((v) => { const d = window.Rocket.debug(); d.hold(v === "phone" ? 0.5 : 1); d.flush(); if (v === "phone") { document.body.dataset.touch = "true"; } }, view);
    await D(() => window.Rocket.debug().skip());
    await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
    await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); window.__toasts.length = 0; });
    await frames(P, 6);
  };
  await again();
  const kept = await D(() => ({ launch: !document.getElementById("launch").hidden, got: window.Rocket.debug().coins().got.length }));
  check(kept.launch && kept.got === 10, "the page again: the coins and the rocket kept (" + JSON.stringify(kept) + ")");
  for (const dx of [5, 4, 3, 2, 1.2]) {
    await D((a) => { const d = window.Rocket.debug(); Object.assign(d.P, { x: a.wr.x + 0.5 + a.dx, z: a.wr.z + 0.5 }); }, { wr, dx });
    await frames(P, 2);
  }
  const lp = await D(() => ({ ignite: !!window.Rocket.debug().ignite(), toasts: window.__toasts.slice() }));
  check(lp.ignite && lp.toasts.some((x) => /needs a fire/.test(x)), "walked onto the launchpad, the launch begins: the fire is asked for (" + JSON.stringify(lp) + ")");
  await P.screenshot({ path: `${out}/03_the_fire.png` });
  // a save from before the coins went round the tree (its ten laid by the old rule, the rocket built by them): kept
  const key = await D(() => JSON.parse(localStorage.getItem("rocket-save-v2")).key);
  await D((k) => localStorage.setItem("rocket-save-v2", JSON.stringify({ key: k, found: [], known: {}, looked: {}, alarms: 0, built: true, done: false, escaped: false,
    coins: ["way@1,1", "way@2,2", "roof@3,3", "pool@4,4", "work@5,5", "work@6,6", "work@7,7", "room@8,8", "grass@9,9", "tree@10,10"] })), key);
  await again();
  const old = await D(() => ({ got: window.Rocket.debug().coins().got.length, launch: !document.getElementById("launch").hidden, near: document.getElementById("near").textContent }));
  check(old.got === 10 && old.launch && /The rocket/.test(old.near), "an older save's ten coins and its rocket carried onto the ring (" + JSON.stringify(old) + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

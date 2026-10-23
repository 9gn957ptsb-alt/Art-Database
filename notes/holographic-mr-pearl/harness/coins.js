// coins.js - the ten coins in the game (artist, 21 Oct 2026): laid, the tally, one taken by the body walking through it,
// one by the head flown through it (and one flown past not), one tapped (its words, not taken), the save, the tenth
// building the rocket. node coins.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const H = hash || "form/15/7", url = `http://127.0.0.1:${+port || 8814}/worlds/rocket/index.html#${H}`;
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8814, hash: H });
  const D = (fn, a) => P.evaluate(fn, a);
  const wake = async () => {
    await D(() => window.Rocket.debug().skip());
    await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
    await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
    await frames(P, 4);
  };
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await wake();
  const C = await D(() => window.Rocket.debug().coins());
  say("coins " + JSON.stringify({ R: C.R, RO: C.RO, units: C.units, kinds: C.list.map((q) => q.kind) }));
  check(C.list.length === 10, "ten coins laid (" + C.list.length + ")");
  check(C.RO === 7 && C.units > 150, "a coin is his head's outline in his cells: " + C.RO + " cells out, " + C.units + " cells");
  const tally = () => D(() => { const el = document.getElementById("coins"); return { text: el.textContent, hidden: el.hidden }; });
  let t = await tally();
  check(!t.hidden && t.text === "Coins 0 of 10", "the tally in the header (" + JSON.stringify(t) + ")");
  // the body walks through one: the first outside one on the ground (the way in)
  const i0 = C.list.findIndex((q) => q.kind === "way");
  const q0 = C.list[i0];
  await D((q) => { const d = window.Rocket.debug(); window.__toasts.length = 0; Object.assign(d.P, { x: q.x - 1.5, y: q.y - 1.3724, z: q.z, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, face: Math.PI / 2, pitch: -0.2, want: null }); }, q0);
  await frames(P, 3);
  let g = await D(() => window.Rocket.debug().coins().got.length);
  check(g === 0, "a step and a half off, not taken (" + g + ")");
  await P.screenshot({ path: `${out}/coin_before.png` });
  await D((q) => { const d = window.Rocket.debug(); Object.assign(d.P, { x: q.x, z: q.z }); }, q0);
  await frames(P, 2);
  const r1 = await D(() => ({ got: window.Rocket.debug().coins().got, toasts: window.__toasts.slice() }));
  t = await tally();
  check(r1.got.length === 1 && r1.got[0] === q0.id, "the body takes the coin it passes through (" + JSON.stringify(r1.got) + ")");
  check(t.text === "Coins 1 of 10", "the tally counts it (" + t.text + ")");
  check(r1.toasts.some((x) => x.indexOf("A coin, 1 of 10: " + q0.text) === 0), "it says which and where (" + JSON.stringify(r1.toasts) + ")");
  const notes = await D(() => document.getElementById("notes-list").textContent);
  check(/Coins: 1 of 10/.test(notes), "Notes count it");
  // the head flown through one, a frame's flight at the hologram's speed (22.5 m/s: 0.56 m a frame of 25 ms) either side
  const i1 = C.list.findIndex((q) => q.kind === "tree");
  const q1 = C.list[i1];
  await D(() => window.Rocket.debug().toggle());
  await frames(P, 20);
  const ph = await D(() => window.Rocket.debug().head() && window.Rocket.debug().head().phase);
  check(ph === "free", "the head is out (" + ph + ")");
  // past it, a metre to its side: not taken
  await D((q) => { const h = window.Rocket.debug().head(); Object.assign(h, { x: q.x - 0.6, y: q.y, z: q.z + 1, vx: 0, vy: 0, vz: 0 }); }, q1);
  await frames(P, 1);
  await D((q) => { const h = window.Rocket.debug().head(); Object.assign(h, { x: q.x + 0.6, y: q.y, z: q.z + 1, vx: 0, vy: 0, vz: 0 }); }, q1);
  await frames(P, 1);
  g = await D(() => window.Rocket.debug().coins().got.length);
  check(g === 1, "the head flown past a metre off does not take it (" + g + ")");
  // through it in one frame: taken, though the head is never within reach at a frame's end
  await D((q) => { window.__toasts.length = 0; const h = window.Rocket.debug().head(); Object.assign(h, { x: q.x - 0.6, y: q.y, z: q.z, vx: 0, vy: 0, vz: 0 }); }, q1);
  await frames(P, 1);
  await D((q) => { const h = window.Rocket.debug().head(); Object.assign(h, { x: q.x + 0.6, y: q.y, z: q.z, vx: 0, vy: 0, vz: 0 }); }, q1);
  await frames(P, 1);
  const r2 = await D(() => window.Rocket.debug().coins().got);
  check(r2.length === 2 && r2[1] === q1.id, "the head flown through it in a frame takes it (" + JSON.stringify(r2) + ")");
  await D(() => window.Rocket.debug().bring());
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 600000 });
  await frames(P, 4);
  // a tap on one: its words, not taken
  const i2 = C.list.findIndex((q, i) => i !== i0 && i !== i1 && q.kind === "roof") >= 0 ? C.list.findIndex((q) => q.kind === "roof") : C.list.findIndex((q, i) => i !== i0 && i !== i1);
  const q2 = C.list[i2];
  const tap = await D((q) => {
    const d = window.Rocket.debug(); window.__toasts.length = 0;
    Object.assign(d.P, { x: q.x - 3, y: q.y - 1.3724, z: q.z, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, face: Math.PI / 2, pitch: 0, want: null });
    return null;
  }, q2);
  await frames(P, 30);
  const sp = await D((q) => { const d = window.Rocket.debug(), s = d.screenOf([q.x, q.y, q.z]); if (s) { d.act(s[0], s[1], false); } return s; }, q2);
  await frames(P, 2);
  const r3 = await D(() => ({ got: window.Rocket.debug().coins().got.length, toasts: window.__toasts.slice() }));
  await P.screenshot({ path: `${out}/coin_tapped.png` });
  check(sp && r3.got === 2 && r3.toasts.some((x) => x.indexOf("A ring of the unit as wide as your head") > 0), "a tap on a coin says what it is and does not take it (" + JSON.stringify(r3) + ")");
  // the save: reloaded, the two kept
  await P.goto(url, { waitUntil: "load" });
  await P.reload({ waitUntil: "load" });
  // past the start card, as game.js opens it
  await P.waitForFunction(() => { const b = document.getElementById("begin"); return b && !b.disabled; }, null, { timeout: 180000 });
  await P.click("#begin");
  await P.waitForFunction(() => window.Rocket && window.Rocket.debug().place && window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D((q) => { const d = window.Rocket.debug(); d.hold(q); d.flush(); }, view === "phone" ? 0.5 : 1);
  await wake();
  const r4 = await D(() => window.Rocket.debug().coins().got);
  t = await tally();
  check(r4.length === 2 && t.text === "Coins 2 of 10", "the save keeps them (" + JSON.stringify(r4) + ", " + t.text + ")");
  // the other eight: the tenth builds the rocket
  await D(() => { const d = window.Rocket.debug(), c = d.coins(); window.__toasts.length = 0; c.list.forEach((q, i) => { if (c.got.indexOf(q.id) < 0) { d.takeCoin(i); } }); });
  await frames(P, 4);
  const r5 = await D(() => ({ got: window.Rocket.debug().coins().got.length, launch: !document.getElementById("launch").hidden, toasts: window.__toasts.slice(), notes: document.getElementById("notes-list").textContent }));
  check(r5.got === 10 && r5.launch, "ten coins build the rocket: Launch is offered (" + JSON.stringify({ got: r5.got, launch: r5.launch }) + ")");
  check(r5.toasts.some((x) => x.indexOf("The tenth coin") === 0), "the tenth says so (" + JSON.stringify(r5.toasts.slice(-1)) + ")");
  await D(() => { const d = window.Rocket.debug(), wr = d.place.wreck; Object.assign(d.P, { x: wr.x + 8, z: wr.z + 0.5, yaw: -Math.PI / 2, face: -Math.PI / 2, pitch: 0.1 }); });
  await frames(P, 30);
  await P.screenshot({ path: `${out}/rocket_by_coins.png` });
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

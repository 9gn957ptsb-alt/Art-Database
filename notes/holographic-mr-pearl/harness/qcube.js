// qcube.js - the character cube (artist, 28 Oct 2026: "instead of that shape being in the middle of that cube ..., it
// is a character, for example, a giant Q in which stands for question and so when you click on it, it asks you a
// question"): a glass cube with a giant Q stands a few steps ahead of where he wakes; a tap on it (a click at the
// crosshair) asks where a piece of the rocket lies, three answers to tap; the right one turns the arrow to that piece,
// a wrong one says where it lies; Escape and Leave it close the question. node qcube.js desk|phone outdir port [hash]
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
  const shot = (n) => P.screenshot({ path: `${out}/${n}.png` });
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 10);
  const Q = await D(() => { const d = window.Rocket.debug(), q = d.qcubes()[0], t = d.underTree(), c = d.chars(); return q && { x: q.x, y: q.y, z: q.z, ch: q.ch, fromTree: Math.hypot(q.x - t.x, q.z - t.z), chars: c.count }; });
  check(!!Q && Q.ch === "Q" && Q.fromTree >= 4.5 && Q.fromTree <= 11, "a cube with a giant Q a few steps from where he wakes (" + JSON.stringify(Q) + ")");
  if (!Q) { throw new Error("no cube"); }
  // stood three metres off it and a step and a half aside, facing it (so his head is not in front of it)
  await D((q) => { const d = window.Rocket.debug(), x = q.x + 2.2, z = q.z + 5.5, yaw = Math.atan2(q.x - x, -(q.z - z)); Object.assign(d.P, { x, y: q.y - 0.5, z, vx: 0, vy: 0, vz: 0, yaw, face: yaw, pitch: -0.15 }); const b = d.cam().blend; if (b) { b.t0 = -1e9; } }, Q);
  await frames(P, 20); await shot("01_the_q_glyphs");
  await D(() => window.Rocket.debug().glyph(0)); await frames(P, 2); await shot("02_the_q_picture"); await D(() => window.Rocket.debug().glyph(1));
  // the tap: on a phone where the cube is seen, on a computer at the crosshair, the view turned to it
  const aimAt = (q) => D((q) => { const d = window.Rocket.debug();
    for (let i = 0; i < 3; i++) { const c = d.cam(), e = c.eye, v = [q[0] - e[0], q[1] - e[1], q[2] - e[2]]; d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); } }, q);
  const screenOf = (q) => D((q) => { const d = window.Rocket.debug(), c = d.cam(), y = c.last.yaw, p = c.last.pitch;
    const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], r = [Math.cos(y), 0, Math.sin(y)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], v = [q[0] - c.eye[0], q[1] - c.eye[1], q[2] - c.eye[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], z = dot(v, f), k = 1 / Math.tan(35 * Math.PI / 180), W = innerWidth, H = innerHeight;
    return { x: (dot(v, r) / z * k * H / W * 0.5 + 0.5) * W, y: (1 - (dot(v, u) / z * k * 0.5 + 0.5)) * H }; }, q);
  const tap = (x, y) => D((a) => { const cv = document.getElementById("view"), o = { pointerId: 72, pointerType: a.v === "phone" ? "touch" : "mouse", button: 0, buttons: 1, clientX: a.x, clientY: a.y, bubbles: true };
    cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); }, { v: view, x, y });
  const tapCube = async () => {
    const m = [Q.x, Q.y, Q.z];
    if (view !== "phone") { await aimAt(m); await frames(P, 4); }
    const s = await screenOf(m);
    await tap(view === "phone" ? s.x : 0, view === "phone" ? s.y : 0); await frames(P, 3);
    return s;
  };
  const read = () => D(() => { const d = window.Rocket.debug(), a = d.asking(), el = document.getElementById("ask"); return { open: !el.hidden, q: document.getElementById("ask-q").textContent, answers: [...document.querySelectorAll("#ask-a button")].map((b) => b.textContent), right: a && a.right, marked: Object.keys(d.marked()) }; });
  const s1 = await tapCube();
  const a1 = await read();
  check(a1.open && /^Where does .+ lie\?$/.test(a1.q) && a1.answers.length === 3 && a1.answers.indexOf(a1.right) >= 0, "a " + (view === "phone" ? "tap" : "click") + " on the Q: it asks (" + JSON.stringify(a1) + ", the cube at " + JSON.stringify({ x: Math.round(s1.x), y: Math.round(s1.y) }) + ")");
  await shot("03_asked");
  // the right answer is where that piece came to lie (in a town: a park, the water, a square's paving, a tree too)
  const W = { work: "behind a work on a wall", pool: "on the floor of the pool", garden: "buried in the garden", roof: "up on a roof", park: "dug into a park", water: "at the bottom of the water", paving: "under the paving of a square", tree: "up in a tree" };
  const lies = await D((q) => { const p = window.Rocket.debug().adv.pieces.filter((p) => q.toLowerCase().indexOf(p.name.toLowerCase()) >= 0)[0]; return p && (p.how || p.hide.type); }, a1.q);
  check(!!lies && a1.right === W[lies], "its right answer is where the piece lies (" + lies + ": " + a1.right + ")");
  // the right answer: the arrow turned to that piece
  await D((r) => { [...document.querySelectorAll("#ask-a button")].filter((b) => b.textContent === r)[0].click(); }, a1.right);
  await frames(P, 4);
  const r1 = await D(() => ({ open: !document.getElementById("ask").hidden, marked: Object.keys(window.Rocket.debug().marked()).filter((k) => window.Rocket.debug().marked()[k]), said: document.getElementById("toast").textContent, near: document.getElementById("near").textContent }));
  check(!r1.open && r1.marked.length === 1 && /^Yes: /.test(r1.said), "the right answer: the arrow turned to that piece (" + JSON.stringify(r1) + ")");
  await shot("04_answered");
  // asked again, a wrong answer: it says where it lies
  await frames(P, 30);
  await tapCube();
  const a2 = await read();
  const wrong = a2.answers.filter((x) => x !== a2.right)[0];
  await D((w) => { [...document.querySelectorAll("#ask-a button")].filter((b) => b.textContent === w)[0].click(); }, wrong);
  await frames(P, 4);
  const r2 = await D(() => ({ open: !document.getElementById("ask").hidden, said: document.getElementById("toast").textContent }));
  check(a2.open && !r2.open && /^No: /.test(r2.said) && r2.said.indexOf(a2.right) > 0, "asked again, a wrong answer: it says where it lies (" + JSON.stringify(r2) + ")");
  // Escape closes it
  await frames(P, 30);
  await tapCube();
  const open3 = (await read()).open;
  await P.keyboard.press("Escape"); await frames(P, 2);
  const r3 = await read();
  check(open3 && !r3.open, "Escape closes the question (" + open3 + " -> " + r3.open + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

// studies.js - the unit's studies in their row beside the tree, in the game: planned, each stone saying its study, the
// view from each stone (his eyes, the figure closing), the crosshair's words on the row. node studies.js desk|phone outdir port [hash]
const { open, frames, state } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8803, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 6);
  const S = await D(() => { const s = window.Rocket.debug().studies(), tr = window.Rocket.debug().place.tree; return s && { row: s.row, box: s.box, tree: tr && [tr.x, tr.z], stands: s.stands.map((t) => ({ name: t.name, at: t.at, eye: t.eye, said: t.said })), figures: s.figures.map((f) => ({ name: f.name, eye: f.eye, centre: f.centre, n: f.count })) }; });
  say("studies " + JSON.stringify(S && { row: S.row, tree: S.tree, figures: S.figures.map((f) => f.name + " " + f.n) }));
  if (!check(!!S, "the studies' row is planned beside the tree")) { await browser.close(); process.exit(1); }
  check(S.stands.length >= 3 && S.figures.length >= 3, S.stands.length + " stones, " + S.figures.length + " figures drawn");
  check(S.figures.every((f) => f.n > 0), "every figure uploaded (" + S.figures.map((f) => f.n).join(", ") + " indices)");
  for (let i = 0; i < S.stands.length; i++) {
    const st = S.stands[i], f = S.figures.find((q) => q.name === st.name);
    // stood on the stone, facing what it shows (the figure's middle, or the row's line)
    const T = f ? f.centre : [st.at[0] + S.row.along[0] * 5, st.at[1] + 1, st.at[2] + S.row.along[1] * 5];
    await D((a) => { const d = window.Rocket.debug(), yaw = Math.atan2(a.T[0] - a.at[0], -(a.T[2] - a.at[2])), pitch = Math.atan2(a.T[1] - (a.at[1] + 1.62), Math.hypot(a.T[0] - a.at[0], a.T[2] - a.at[2]));
      Object.assign(d.P, { x: a.at[0], y: a.at[1], z: a.at[2], vx: 0, vy: 0, vz: 0, yaw, face: yaw, pitch, want: null }); window.__toasts.length = 0; }, { at: st.at, T });
    await frames(P, 30);
    const r = await D(() => { const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } return { stone: d.stone(), toasts: window.__toasts.slice(), pov: d.pov ? d.pov() : "" }; });
    await frames(P, 4);
    await P.screenshot({ path: `${out}/stone_${i}.png` });
    // (the studies' stones say nothing since 26 Oct 2026, the artist: "Get rid of this"; the homage's still speak)
    check(!r.toasts.some((t) => t.indexOf(st.name) === 0 || (st.said && t.indexOf(st.said.slice(0, 30)) >= 0)), st.name + ": its stone says nothing (" + JSON.stringify(r.toasts) + ")");
    if (f) { check(r.stone === true, st.name + ": from its stone the view is his eyes (" + r.stone + ")"); }
  }
  // the crosshair's (or the sight's) words on a block of the row
  const lab = await D(() => { const d = window.Rocket.debug(), s = d.studies(), k = Object.keys(s.at)[0].split(",").map(Number); return { at: k, text: s.at[k.join(",")] }; });
  check(/studies|Stand here|The /.test(lab.text), "a block of the row says what it is (" + lab.text + ")");
  // the row seen from where you wake
  await D(() => { const d = window.Rocket.debug(), w = d.underTree(), s = d.studies(), c = s.figures[0].centre, yaw = Math.atan2(c[0] - w.x, -(c[2] - w.z));
    Object.assign(d.P, { x: w.x, y: w.y, z: w.z, vx: 0, vy: 0, vz: 0, yaw, face: yaw, pitch: -0.2, want: null }); });
  await frames(P, 30);
  await D(() => { const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 6);
  await P.screenshot({ path: `${out}/from_the_tree.png` });
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });

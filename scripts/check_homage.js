#!/usr/bin/env node
/* Checks Rocket's homage site (docs/worlds/rocket/homage.js) in every place an escape can be made of
   without a page: each new form the Artifact opens on and each modelled building, built in Node as the game
   builds it (place, works hung, pieces hidden), then the three planned where you wake. For each it prints
   where the row stands (how far, how far round from the way you first face, which way it faces), each
   figure's stone and how far from it the figure's middle is, and how many of the three the waking eye sees.
   It fails if a place has no room for the row, or a figure is not its drawing from its stone.

     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_homage.js [--forms N] [--all]

   With --page PORT [shots dir] it opens the game itself (docs/ served on PORT) in headless Chromium at
   1440x900 and 390x844 on a new form, and checks the homage there: planned in the first world, its three
   in the waking turn (shots at 6.2, 7 and 7.8 s), each figure's stone saying what it is, and the view from
   each stone and from a step and a half beside it (shots); no page errors. Then it reloads as if escaped
   to the next world and checks there is no homage there, nor when that world is come back to.

     cd docs && python3 -m http.server 8731 &
     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_homage.js --page 8731 /tmp/shots

   The drawing check: each figure's triangles, seen from its stone's eye down its line of sight in
   perspective, against the same figure's drawing (its triangles seen orthographically down its own eye
   direction), both rasterised to which tone covers each pixel. */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const ROCKET = path.join(ROOT, "docs", "worlds", "rocket");
global.window = global;
require(path.join(V2, "models.js"));
window.Forms = require(path.join(ROCKET, "forms.js"));
window.Adventures = require(path.join(ROCKET, "adventure.js"));
const Pl = window.RocketPlace = require(path.join(ROCKET, "place.js"));
const Homage = require(path.join(ROCKET, "homage.js"));
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const FORMS_OPEN = [2, 4, 11, 12, 13, 15, 16, 23, 24, 27, 35, 41, 50, 64, 67];
const EYE = 1.62;
const data = json(path.join(ROCKET, "homage.json"));
const forms = window.Forms.load(json(path.join(ROCKET, "sections.json")));
const cat = json(path.join(ROCKET, "catalogue.json"));
const argv = process.argv.slice(2);
const nForms = argv.includes("--forms") ? +argv[argv.indexOf("--forms") + 1] : FORMS_OPEN.length;

function underTree(place) {
  const c = place.crash, wr = place.wreck, tr = place.tree;
  const tx = tr ? tr.x + 0.5 : c.x, tz = tr ? tr.z + 0.5 : c.z, ax = wr.x + 0.5 - tx, az = wr.z + 0.5 - tz, L = Math.hypot(ax, az) || 1;
  return { x: tx + ax / L * 1.7, y: c.y, z: tz + az / L * 1.7 };
}

// Which tone covers each pixel of triangles seen from an eye (perspective) or down a direction (orthographic).
function raster(pos, wts, idx, view, size) {
  const { E, F, U, R, ortho, span, fov, C } = view, n = pos.length / 3, sx = new Float64Array(n), sy = new Float64Array(n), sz = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const q = [pos[3 * i] - (ortho ? C[0] : E[0]), pos[3 * i + 1] - (ortho ? C[1] : E[1]), pos[3 * i + 2] - (ortho ? C[2] : E[2])];
    const a = q[0] * R[0] + q[1] * R[1] + q[2] * R[2], b = q[0] * U[0] + q[1] * U[1] + q[2] * U[2], d = q[0] * F[0] + q[1] * F[1] + q[2] * F[2];
    const x = ortho ? a / (span / 2) : a / (d * Math.tan(fov / 2)), y = ortho ? b / (span / 2) : b / (d * Math.tan(fov / 2));
    sx[i] = (x + 1) * size / 2; sy[i] = (1 - y) * size / 2; sz[i] = -d;
  }
  const best = new Float64Array(size * size).fill(-Infinity), tone = new Int8Array(size * size).fill(-1);
  for (let t = 0; t < idx.length; t += 3) {
    const [i, j, k] = [idx[t], idx[t + 1], idx[t + 2]];
    const x0 = Math.max(0, Math.floor(Math.min(sx[i], sx[j], sx[k]))), x1 = Math.min(size - 1, Math.ceil(Math.max(sx[i], sx[j], sx[k])));
    const y0 = Math.max(0, Math.floor(Math.min(sy[i], sy[j], sy[k]))), y1 = Math.min(size - 1, Math.ceil(Math.max(sy[i], sy[j], sy[k])));
    const den = (sy[j] - sy[k]) * (sx[i] - sx[k]) + (sx[k] - sx[j]) * (sy[i] - sy[k]);
    if (Math.abs(den) < 1e-12) { continue; }
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const gx = px + 0.5, gy = py + 0.5;
        const l0 = ((sy[j] - sy[k]) * (gx - sx[k]) + (sx[k] - sx[j]) * (gy - sy[k])) / den;
        const l1 = ((sy[k] - sy[i]) * (gx - sx[k]) + (sx[i] - sx[k]) * (gy - sy[k])) / den, l2 = 1 - l0 - l1;
        if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) { continue; }
        const z = l0 * sz[i] + l1 * sz[j] + l2 * sz[k], p = py * size + px;
        if (z > best[p]) {
          best[p] = z;
          const w = [0, 1, 2].map((m) => l0 * wts[3 * i + m] + l1 * wts[3 * j + m] + l2 * wts[3 * k + m]);
          tone[p] = w[0] >= w[1] && w[0] >= w[2] ? 0 : w[1] >= w[2] ? 1 : 2;
        }
      }
    }
  }
  return tone;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]); return a.map((q) => q / n); };

/* A figure seen from its stone, against its drawing: pixels of a different tone, off the edges of the
   drawing, of those the drawing covers. */
function closes(fig, key, size = 220) {
  const src = data[key], shape = Homage.shapeOf(src), fr = Homage.frameOf(src);
  const E = fig.eye, C = fig.centre, F = unit([C[0] - E[0], C[1] - E[1], C[2] - E[2]]);
  const U = unit([-F[0] * F[1], 1 - F[1] * F[1], -F[2] * F[1]]), R = cross(F, U);
  // Only the figure's own triangles (its support rod comes after them).
  const nT = shape.T.length, pos = fig.mesh.pos.subarray(0, shape.P.length), idx = fig.mesh.idx.subarray(0, nT);
  let half = 0;
  for (let i = 0; i < pos.length / 3; i += 1) {
    const q = [pos[3 * i] - E[0], pos[3 * i + 1] - E[1], pos[3 * i + 2] - E[2]], d = q[0] * F[0] + q[1] * F[1] + q[2] * F[2];
    half = Math.max(half, Math.abs(q[0] * R[0] + q[1] * R[1] + q[2] * R[2]) / d, Math.abs(q[0] * U[0] + q[1] * U[1] + q[2] * U[2]) / d);
  }
  const fov = 2 * Math.atan(half * 1.1);
  const seen = raster(pos, shape.W, idx, { E, F, U, R, fov }, size);
  // The drawing: its own triangles, orthographic down its eye, at the same size on the page.
  // (centred on the middle of its drawing, as the figure is drawn in about it)
  const P = shape.P.map((v) => v * Homage.SCALE), axes = [fr.r, fr.u, fr.e], mid = axes.map((v) => {
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < P.length; i += 3) { const q = P[i] * v[0] + P[i + 1] * v[1] + P[i + 2] * v[2]; lo = Math.min(lo, q); hi = Math.max(hi, q); }
    return (lo + hi) / 2;
  });
  const M = [0, 1, 2].map((k) => mid[0] * fr.r[k] + mid[1] * fr.u[k] + mid[2] * fr.e[k]);
  const Fd = fr.e.map((q) => -q), D = Math.hypot(C[0] - E[0], C[1] - E[1], C[2] - E[2]);
  const drawn = raster(P, shape.W, shape.T, { C: M, F: Fd, U: fr.u, R: fr.r, ortho: true, span: 2 * Math.tan(fov / 2) * D }, size);
  let diff = 0, cover = 0;
  for (let p = 0; p < size * size; p += 1) {
    if (drawn[p] >= 0) { cover += 1; }
    if (drawn[p] === seen[p]) { continue; }
    let edge = false;
    const x = p % size, y = Math.floor(p / size);
    for (let dy = -1; dy <= 1 && !edge; dy += 1) { for (let dx = -1; dx <= 1 && !edge; dx += 1) { const q = (y + dy) * size + x + dx; if (q >= 0 && q < size * size && drawn[q] !== drawn[p]) { edge = true; } } }
    if (!edge) { diff += 1; }
  }
  return { diff, cover };
}

function build(kind, e, sd) {
  let d;
  if (kind === "form") {
    const R = window.Forms.form(forms, +e), base = R.placed.filter((P2) => P2.role === "base")[0], pj = forms.projects[base.sec.p];
    d = { kind, name: R.name, form: R, ground: json(path.join(V2, "grounds", pj.slug + ".json")), forms, works: [] };
  } else {
    const pj = forms.projects.filter((q) => q.slug === e.slug)[0];
    d = { kind, name: e.name, model: json(path.join(V2, "models", e.slug + ".json")), ground: json(path.join(V2, "grounds", e.slug + ".json")), interior: null, forms, works: [] };
    if (pj) { d.sections = pj.sections.map((id) => forms.sections[id]); }
  }
  const place = Pl.place(d);
  const setting = { kind, slug: String(e.slug || e), name: d.name, where: "", city: "", recipe: "" };
  const adv = window.Adventures.make(setting, sd, { works: [], pool: !!(place.M && place.M.pool && place.M.pool.length) });
  Pl.hide(place, adv, [], sd);
  return { place, name: d.name };
}

async function page(port, shots) {
  const { chromium } = require("playwright");
  const EXE = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
  const browser = await chromium.launch({ executablePath: EXE, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  let bad = 0;
  const ok = (cond, what) => { console.log((cond ? "ok   " : "FAIL ") + what); if (!cond) { bad += 1; } };
  if (shots) { fs.mkdirSync(shots, { recursive: true }); }
  for (const [W, H, touch] of [[1440, 900, false], [390, 844, true]]) {
    const tag = W + "x" + H, ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
    const P = await ctx.newPage(), errors = [];
    P.on("pageerror", (e) => errors.push(String(e)));
    P.on("console", (m) => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) { errors.push(m.text()); } });
    P.on("response", (r) => { if (r.status() >= 400 && !/cloudfront|artsy/.test(r.url())) { errors.push(r.status() + " " + r.url()); } });
    await P.goto(`http://localhost:${port}/worlds/rocket/#form/2/7`, { waitUntil: "load" });
    await P.waitForFunction(() => document.getElementById("begin") && !document.getElementById("begin").disabled, null, { timeout: 60000 });
    await P.click("#begin");
    await P.waitForFunction(() => window.Rocket && window.Rocket.debug().intro(), null, { timeout: 120000 });
    const h = await P.evaluate(() => { const h = Rocket.debug().homage(); return h && { n: h.figures.length, stands: h.stands.map((s) => ({ at: s.at, name: s.name })), figs: h.figures.map((f) => ({ eye: f.eye, centre: f.centre })), row: h.row }; });
    ok(h && h.n === 2 && h.stands.length === 3, tag + " the homage stands in the first world (" + (h ? h.n + " figures, " + h.stands.length + " stones, " + h.row.rho + " m off" : "none") + ")");
    // The waking turn passes the three.
    for (const u of [6.2, 7, 7.8]) {
      await P.waitForFunction((u) => { const i = Rocket.debug().intro(); return !i || performance.now() - i.t0 >= u * 1000; }, u, { timeout: 120000 });
      if (shots) { await P.screenshot({ path: path.join(shots, tag + "-wake-" + u + ".png") }); }
    }
    await P.evaluate(() => Rocket.debug().skip());
    await P.waitForFunction(() => !Rocket.debug().intro(), null, { timeout: 60000 });
    await P.evaluate(() => { document.getElementById("notes").hidden = true; });
    for (const [i, st] of (h ? h.stands : []).entries()) {
      const fig = h.figs.find((f) => Math.hypot(f.eye[0] - st.at[0], f.eye[2] - st.at[2]) < 0.01);
      for (const [side, label] of [[0, "stone"], [1.5, "aside"]]) {
        await P.evaluate(([st, fig, side]) => {
          const d = Rocket.debug(), Pp = d.P, Fw = d.homage().row.along;
          const tx = fig ? fig.centre : [st.at[0] + 3 * Fw[0], st.at[1] + 1.2, st.at[2] + 3 * Fw[1]], dx0 = tx[0] - st.at[0], dz0 = tx[2] - st.at[2], L = Math.hypot(dx0, dz0) || 1;
          Pp.x = st.at[0] + (-dz0 / L) * side; Pp.z = st.at[2] + (dx0 / L) * side; Pp.y = st.at[1] + (side ? 0.0 : 0); Pp.vx = Pp.vy = Pp.vz = 0;
          const e = [Pp.x, Pp.y + 1.62, Pp.z], dx = tx[0] - e[0], dy = tx[1] - e[1], dz = tx[2] - e[2];
          Pp.yaw = Math.atan2(dx, -dz); Pp.pitch = Math.atan2(dy, Math.hypot(dx, dz));
          d.flush();
        }, [st, fig, side]);
        await P.waitForTimeout(1200);
        if (shots) { await P.screenshot({ path: path.join(shots, tag + "-" + (i + 1) + "-" + label + ".png") }); }
        if (!side) {
          const said = await P.evaluate(() => document.getElementById("toast").textContent);
          ok(said.indexOf(st.name) === 0, tag + " on the " + ["first", "second", "third"][i] + " stone it says: " + said.slice(0, 90));
        }
      }
    }
    ok(!errors.length, tag + " no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
    // Escaped to the next world: no homage there.
    if (W === 1440) {
      await P.evaluate(() => { sessionStorage.setItem("rocket-escaped", "1"); location.reload(); });
      await P.waitForFunction(() => document.getElementById("begin") && !document.getElementById("begin").disabled, null, { timeout: 60000 });
      await P.click("#begin");
      await P.waitForFunction(() => window.Rocket && window.Rocket.debug().intro(), null, { timeout: 120000 });
      ok(!(await P.evaluate(() => Rocket.debug().homage())), tag + " no homage in a world escaped to");
      await P.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("rocket-save-v2")).escaped === true; } catch (e) { return false; } }, null, { timeout: 30000 });
      await P.evaluate(() => location.reload());
      await P.waitForFunction(() => document.getElementById("begin") && !document.getElementById("begin").disabled, null, { timeout: 60000 });
      await P.click("#begin");
      await P.waitForFunction(() => window.Rocket && window.Rocket.debug().intro(), null, { timeout: 120000 });
      ok(!(await P.evaluate(() => Rocket.debug().homage())), tag + " nor in it come back to");
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad ? bad + " problems" : "all ok");
  process.exit(bad ? 1 : 0);
}
if (argv.includes("--page")) { page(argv[argv.indexOf("--page") + 1], argv[argv.indexOf("--page") + 2]); return; }

const list = FORMS_OPEN.slice(0, nForms).map((n) => ["form", n]);
const buildings = cat.buildings.filter((b) => forms.projects.some((q) => q.slug === b.slug));
(argv.includes("--all") ? buildings : buildings.slice(0, 12)).forEach((b) => list.push(["building", b]));
let bad = 0, spare = 0;
list.forEach(([kind, e]) => {
  const { place, name } = build(kind, e, 7);
  const wake = underTree(place), wr = place.wreck, toWreck = Math.atan2(wr.x - wake.x, -(wr.z - wake.z));
  const why = {}, t0 = Date.now(), h = Homage.plan(place, data, { wake, yaw: toWreck - 1.5, eye: EYE, B: Pl.B, why }), ms = Date.now() - t0;
  const label = (kind === "form" ? "form " + e : e.slug).padEnd(34) + " ";
  // No room is a failure where a first visit can open (the Artifact's new forms); elsewhere the homage is left out.
  if (!h) { if (kind === "form") { bad += 1; } else { spare += 1; } console.log(label + "NO ROOM  (" + ms + " ms)  " + name + "  " + JSON.stringify(why)); return; }
  const side = ["N", "E", "S", "W"][[[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex((q) => q[0] === h.row.along[0] && q[1] === h.row.along[1])];
  const turn = h.row.theta - (toWreck - 1.5);
  const figs = h.figures.map((f) => {
    const D = Math.hypot(f.centre[0] - f.eye[0], f.centre[1] - f.eye[1], f.centre[2] - f.eye[2]);
    const c = closes(f, f.i === 0 ? "one" : f.i === 1 ? "two" : "three");
    if (c.diff > c.cover * 0.002) { bad += 1; }
    return f.name.split(" ")[1] + " " + D.toFixed(2) + " m, " + c.diff + "/" + c.cover + " off";
  });
  console.log(label + h.row.rho + " m, turn " + turn.toFixed(2) + ", faces " + side + ", hidden " + h.row.hidden + " | " + figs.join(" | ") + "  (" + ms + " ms)");
});
if (spare) { console.log(spare + " of " + list.length + " places have no room for the homage: it is left out there"); }
console.log(bad ? bad + " problems" : "all ok");
process.exit(bad ? 1 : 0);

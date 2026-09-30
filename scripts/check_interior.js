#!/usr/bin/env node
/* Check a museum's interior (docs/v2/interiors/<slug>.json) the way the walk
   will have it: the page's own docs/v2/models.js and docs/v2/walk-plan.js,
   run here in a vm, compile it against the museum's model and apply every
   rule of INTERIORS.md (WalkPlan.check).

     node scripts/check_interior.js docs/v2/interiors/<slug>.json [--png dir]
     node scripts/check_interior.js --all [--png dir]

   It prints the tier, the square metres of documented and reconstructed
   rooms on each floor, what can be reached from the door, the works by how
   the museum's records place them, and every error and warning. Errors set
   the exit code. It writes the tier back into the file, and into the
   museum's entry in docs/v2/models/ledger.json its interior's tier, rooms
   and works; a finding against the model (a documented room outside it, a
   footprint that does not stand on the ground's buildings) goes into the
   model's own log there, for its next refinement.

   --png renders through Playwright (installed globally in a session), into
   the directory given: a plan of every floor seen from above (rooms tinted
   by how they are known, their ids, the openings, the stairs as arrows, the
   hung works as ticks of their colours on their walls, the model's
   footprint outlined and any room outside it in red), the cut-away plan
   level from two diagonals as the page draws it, and — once docs/v2/walk.js
   offers Walk.snapshot — first-person frames from the door and before up to
   six hung works, each work a stand-in picture of its three colours
   (Artsy's image store is not reachable from a session). It prints the
   frame times. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const LEDGER = path.join(V2, "models", "ledger.json");

function readJSON(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return fallback; }
}

// The page's own code, in a context of its own.
function pageCode() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const f of ["models.js", "walk-plan.js"]) {
    vm.runInContext(fs.readFileSync(path.join(V2, f), "utf8"), sandbox, { filename: f });
  }
  return sandbox.window;
}

function today() { return new Date().toISOString().slice(0, 10); }

function checkOne(file, W, museums, opts) {
  const text = fs.readFileSync(file, "utf8");
  let interior;
  try { interior = JSON.parse(text); } catch (e) {
    return { file, slug: path.basename(file, ".json"), errors: ["not JSON: " + e.message], warnings: [], stats: {}, tier: "shell" };
  }
  const slug = interior.slug || path.basename(file, ".json");
  const model = readJSON(path.join(V2, "models", slug + ".json"), null);
  const ground = readJSON(path.join(V2, "grounds", slug + ".json"), null);
  const museum = museums.find(m => m.slug === slug) || null;
  const res = W.WalkPlan.check(interior, model, museum, ground, { bytes: Buffer.byteLength(text), today: today() });
  if (!model) { res.errors.unshift("no model at docs/v2/models/" + slug + ".json"); }
  res.file = file;
  res.slug = slug;
  res.interior = interior;
  res.model = model;
  res.museum = museum;
  res.ground = ground;
  // The tier, written back where it stands, without reflowing the file.
  if (!res.errors.length && interior.tier !== res.tier) {
    const next = text.replace(/"tier": "(documented|reconstructed|shell)"/, `"tier": "${res.tier}"`);
    if (next !== text) { fs.writeFileSync(file, next); }
  }
  return res;
}

function report(r, brief) {
  const s = r.stats || {};
  const works = s.works || {};
  const how = ["museum", "elsewhere", "off", "none"].filter(k => works[k]).map(k => `${k} ${works[k]}`).join(", ") || "no works";
  if (brief) {
    const rooms = (s.floors || []).reduce((a, f) => a + (f.rooms || 0), 0);
    const reach = (s.floors || []).reduce((a, f) => a + (f.reached || 0), 0);
    const mark = r.errors.length ? "ERR " : r.warnings.length ? "warn" : "ok  ";
    console.log(`${mark} ${r.slug.padEnd(58)} ${String(r.tier).padEnd(13)} rooms ${String(rooms).padStart(3)} reached ${String(reach).padStart(3)}  ${how}; hung ${s.hung || 0}`);
    r.errors.forEach(e => console.log("       error: " + e));
    return;
  }
  console.log(`${r.slug}: ${r.tier}`);
  (s.floors || []).forEach(f => {
    console.log(`  ${f.name || f.id} (z ${f.z} m): ${f.rooms} rooms, ${f.reached} reached from the door; ` +
                `${f.documented} m² documented, ${f.reconstructed} m² reconstructed; ${f.cells} cells`);
  });
  console.log(`  works: ${how}; ${s.hung || 0} hung, ${s.spill || 0} with no wall to hang on`);
  if (s.ground !== undefined && s.ground !== null) { console.log(`  the model's footprint on the ground's buildings: ${Math.round(s.ground * 100)}%`); }
  r.errors.forEach(e => console.log("  error: " + e));
  r.warnings.forEach(w => console.log("  warning: " + w));
}

// The museum's entry in the ledger: its interior, and the findings against its model.
function record(results) {
  const ledger = readJSON(LEDGER, null);
  if (!ledger) { return; }
  let changed = false;
  for (const r of results) {
    const entry = ledger[r.slug];
    if (!entry || !r.stats || !r.stats.floors) { continue; }
    const inside = entry.interior || { tier: "shell", refined: null, passes: 0, rooms: {}, works: {}, log: [] };
    const rooms = { documented: 0, reconstructed: 0 };
    if (r.world) {
      r.world.floors.forEach(fl => fl.rooms.forEach(room => {
        if (room.pseudo) { return; }
        rooms[room.sure === "documented" ? "documented" : "reconstructed"] += 1;
      }));
    }
    const w = r.stats.works || {};
    const works = { hung: r.stats.hung || 0, elsewhere: w.elsewhere || 0, off: w.off || 0, none: w.none || 0 };
    const was = JSON.stringify([inside.tier, inside.rooms, inside.works]);
    if (!r.errors.length) { inside.tier = r.tier; }
    inside.rooms = rooms;
    inside.works = works;
    if (JSON.stringify([inside.tier, inside.rooms, inside.works]) !== was || !entry.interior) { changed = true; }
    entry.interior = inside;
    // Findings for the model's next refinement, each once.
    entry.log = entry.log || [];
    for (const f of r.findings || []) {
      let line;
      if (f.room) {
        line = `interior finding: documented room ${f.room} (${f.floor}) lies ${Math.round(f.out * 100)}% outside the model, ` +
               `x ${f.x0.toFixed(1)} to ${f.x1.toFixed(1)}, y ${f.y0.toFixed(1)} to ${f.y1.toFixed(1)} m`;
      } else if (f.ground !== undefined) {
        line = `interior finding: only ${Math.round(f.ground * 100)}% of the model's footprint stands on the ground's buildings`;
      } else if (f.text) {
        line = "interior finding: " + f.text;
      }
      if (line && !entry.log.some(l => l.indexOf(line) >= 0)) {
        entry.log.push(`${today()} ${line}`);
        changed = true;
      }
    }
  }
  if (changed) { fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + "\n"); }
}

// Several documented rooms outside the model are one finding: the model's
// extent against theirs, as the next refinement needs it.
function gather(r) {
  const rooms = (r.findings || []).filter(f => f.room);
  if (rooms.length < 4) { return; }
  const by = {};
  rooms.forEach(f => { (by[f.floor] = by[f.floor] || []).push(f); });
  const out = (r.findings || []).filter(f => !f.room);
  Object.keys(by).forEach(fid => {
    const list = by[fid];
    const y0 = Math.min(...list.map(f => f.y0)), y1 = Math.max(...list.map(f => f.y1));
    const x0 = Math.min(...list.map(f => f.x0)), x1 = Math.max(...list.map(f => f.x1));
    out.push({ text: `${list.length} documented rooms on the ${fid} floor lie outside the model ` +
                     `(${list.map(f => f.room).slice(0, 12).join(", ")}${list.length > 12 ? ", …" : ""}), ` +
                     `between x ${x0.toFixed(1)} and ${x1.toFixed(1)}, y ${y0.toFixed(1)} and ${y1.toFixed(1)} m` });
  });
  r.findings = out;
}

function playwright() {
  try { return require("playwright"); } catch (e) {
    const root = execSync("npm root -g").toString().trim();
    return require(path.join(root, "playwright"));
  }
}

async function pictures(results, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await playwright().chromium.launch(exe ? { executablePath: exe } : {});
  const code = ["models.js", "walk-plan.js", "walk.js"].map(f => path.join(V2, f)).filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, "utf8"));
  const dirt = "data:image/png;base64," + fs.readFileSync(path.join(V2, "dirt-land.png")).toString("base64");
  for (const r of results) {
    if (!r.model || r.errors.some(e => /does not compile/.test(e))) { continue; }
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setContent(`<!doctype html><body style="margin:0;background:#0f0c0a">
      <canvas id="c"></canvas>${code.map(c => `<script>${c}</script>`).join("")}</body>`);
    const out = await page.evaluate(async ({ interior, model, museum, dirt }) => {
      const img = new Image();
      await new Promise(res => { img.onload = res; img.src = dirt; });
      const t = document.createElement("canvas");
      t.width = img.width; t.height = img.height;
      const tx = t.getContext("2d"); tx.drawImage(img, 0, 0);
      const px = tx.getImageData(0, 0, t.width, t.height).data, n = t.width;
      const cellOf = (m, a) => ((Math.floor(a) % m) + m) % m;
      const lat = museum ? museum.lat : 0, lon = museum ? museum.lon : 0;
      const u0 = Math.floor((lon / 360 + 0.5) * 2 * n), v0 = Math.floor((0.5 - lat / 180) * n);
      // The soil as land.js reads it: soilCell(dirt.land, b, i, j).
      const soil = (i, j) => {
        const o = (cellOf(n, v0 + i) * n + cellOf(n, u0 + j)) * 4;
        return [px[o], px[o + 1], px[o + 2], Math.round(px[o + 3] / 85)];
      };
      const shots = {};
      let t0 = performance.now();
      const world = WalkPlan.compile(interior, model, { soil, sky: { alt: 0.8 } });
      const compileMs = performance.now() - t0;
      const hung = WalkPlan.hang(world, interior.works, interior.pins).hung;
      // A plan of each floor from above.
      world.floors.forEach(fl => {
        const S = Math.max(1, Math.min(6, Math.floor(1300 / (fl.gw * fl.cell)) / 1)) ;
        const scale = S / fl.cell;              // pixels a metre, as a whole number of pixels a cell
        const c = document.createElement("canvas");
        c.width = Math.ceil(fl.gw * S); c.height = Math.ceil(fl.gh * S) + 30;
        const g = c.getContext("2d");
        g.fillStyle = "#0f0c0a"; g.fillRect(0, 0, c.width, c.height);
        const img2 = g.createImageData(fl.gw, fl.gh), buf = new Uint32Array(img2.data.buffer);
        for (let q = 0; q < fl.n; q += 1) {
          const k = fl.kind[q], r = fl.room[q] >= 0 ? fl.rooms[fl.room[q]] : null;
          let ink = fl.inkF[q];
          if (k === WalkPlan.WALL || k === WalkPlan.GLASS) { ink = fl.foot[q] === 2 ? 0xff5c6a78 : fl.foot[q] ? 0xff3c4a5a : 0xff202830; }
          else if (r && !r.pseudo) {
            const u = WalkPlan.unpack(fl.inkF[q]);
            const tint = r.sure === "documented" ? [120, 180, 150] : [200, 170, 110];
            const m = [u[0] * 0.5 + tint[0] * 0.5, u[1] * 0.5 + tint[1] * 0.5, u[2] * 0.5 + tint[2] * 0.5];
            ink = WalkPlan.pack(m);
            if (!r.reach) { ink = WalkPlan.pack([m[0] * 0.55, m[1] * 0.55, m[2] * 0.55]); }
          } else if (r && r.pseudo === "stair") { ink = 0xffd6b48c; }
          else if (r && r.pseudo === "outside") { ink = 0xff8cc2d6; }
          else if (k === WalkPlan.CLOSED) { ink = 0xff161210; }
          // The model's footprint where a room goes past it: red.
          if (r && !r.pseudo && !fl.foot[q]) {
            const u = WalkPlan.unpack(ink);
            ink = WalkPlan.pack([Math.min(255, u[0] * 0.5 + 150), u[1] * 0.5, u[2] * 0.5]);
          }
          if (fl.door[q] >= 0) { ink = 0xffeeeeee; }
          buf[q] = ink;
        }
        const tmp = document.createElement("canvas");
        tmp.width = fl.gw; tmp.height = fl.gh;
        tmp.getContext("2d").putImageData(img2, 0, 0);
        g.imageSmoothingEnabled = false;
        g.drawImage(tmp, 0, 30, fl.gw * S, fl.gh * S);
        const X = x => (x - fl.x0) * scale, Y = y => (y - fl.y0) * scale + 30;
        // Stairs as arrows, rising.
        world.stairs.forEach(st => {
          if (st.from !== fl.index && st.to !== fl.index) { return; }
          const r = st.rect, ax = st.rise[1] === "x", up = st.rise[0] === "-" ? -1 : 1;
          const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, h = (ax ? r[2] - r[0] : r[3] - r[1]) * 0.4;
          g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath();
          const x0 = ax ? cx - up * h : cx, y0 = ax ? cy : cy - up * h, x1 = ax ? cx + up * h : cx, y1 = ax ? cy : cy + up * h;
          g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1));
          const a = Math.atan2(Y(y1) - Y(y0), X(x1) - X(x0));
          g.lineTo(X(x1) - 8 * Math.cos(a - 0.5), Y(y1) - 8 * Math.sin(a - 0.5));
          g.moveTo(X(x1), Y(y1)); g.lineTo(X(x1) - 8 * Math.cos(a + 0.5), Y(y1) - 8 * Math.sin(a + 0.5));
          g.stroke();
        });
        // The hung works, ticks of their first colour.
        hung.filter(h => h.floor === fl.index).forEach(h => {
          g.strokeStyle = (h.work.c && h.work.c[0]) || "#fff"; g.lineWidth = 4; g.beginPath();
          g.moveTo(X(h.x0), Y(h.y0)); g.lineTo(X(h.x1), Y(h.y1)); g.stroke();
          g.strokeStyle = "#fff"; g.lineWidth = 1; g.beginPath();
          g.moveTo(X(h.cx), Y(h.cy)); g.lineTo(X(h.cx + h.nx * 1.2), Y(h.cy + h.ny * 1.2)); g.stroke();
        });
        // Ids.
        g.font = `${Math.max(9, Math.min(13, S * 3))}px monospace`; g.textAlign = "center"; g.textBaseline = "middle";
        fl.rooms.forEach(r => {
          if (r.pseudo || !r.poly) { return; }
          g.fillStyle = r.reach ? "#fff" : "#999";
          g.fillText(r.id.replace(/^[MG]-0*/, ""), X(r.cx), Y(r.cy));
        });
        if (world.enter && world.enter.floor === fl.index) {
          g.fillStyle = "#5e52c7"; g.fillRect(X(world.enter.x) - 5, Y(world.enter.y) - 5, 10, 10);
        }
        g.fillStyle = "#ddd"; g.font = "14px sans-serif"; g.textAlign = "left";
        g.fillText(`${interior.slug} · ${fl.name || fl.id} · green documented, amber reconstructed, dim: no way in known, red: outside the model, white: openings`, 8, 16);
        shots["plan-" + fl.id] = c.toDataURL("image/png");
      });
      // The cut-away plan level, from two diagonals.
      const dotsOf = Models.build(model, (i, j) => soil(j, i));
      const times = [];
      [Math.PI / 4, Math.PI * 5 / 4].forEach((h, k) => {
        const fl = world.floors[world.enter ? world.enter.floor : 0];
        const joined = WalkPlan.planDots(world, fl.index, dotsOf, null, fl.z + 3, undefined,
          world.enter ? { x: world.enter.x, y: world.enter.y, a: world.enter.a } : null, hung);
        const c = document.createElement("canvas");
        c.width = 520; c.height = 390;
        const t1 = performance.now();
        Models.draw(c, joined, h, joined.cut, 0.92);
        times.push(performance.now() - t1);
        const big = document.createElement("canvas");
        big.width = 1040; big.height = 780;
        const bg = big.getContext("2d");
        bg.fillStyle = "#0f0c0a"; bg.fillRect(0, 0, 1040, 780);
        bg.imageSmoothingEnabled = false;
        bg.drawImage(c, 0, 0, 1040, 780);
        shots["cut-" + (k ? "b" : "a")] = big.toDataURL("image/png");
        shots.dots = joined.count;
      });
      // First person, where the walk offers a way to draw one frame.
      const frames = [];
      if (window.Walk && typeof Walk.snapshot === "function") {
        const stand = [];
        if (world.enter) { stand.push({ name: "door", x: world.enter.x, y: world.enter.y, a: world.enter.a, floor: world.enter.floor }); }
        hung.slice(0, 6).forEach((h, k) => stand.push({ name: "work-" + (k + 1), x: h.spot.x, y: h.spot.y, a: h.spot.face, floor: h.floor }));
        for (const s of stand) {
          const t2 = performance.now();
          const c = await Walk.snapshot(world, hung, { x: s.x, y: s.y, a: s.a, floor: s.floor, w: 130, h: 148, dot: 3 });
          frames.push({ name: s.name, ms: performance.now() - t2, url: c && c.toDataURL ? c.toDataURL("image/png") : null });
        }
      }
      return { shots, compileMs, planMs: times, frames, hung: hung.length };
    }, { interior: r.interior, model: r.model, museum: r.museum, dirt });
    for (const [name, url] of Object.entries(out.shots)) {
      if (typeof url !== "string") { continue; }
      fs.writeFileSync(path.join(dir, `${r.slug}-${name}.png`), Buffer.from(url.split(",")[1], "base64"));
    }
    out.frames.forEach(f => {
      if (f.url) { fs.writeFileSync(path.join(dir, `${r.slug}-walk-${f.name}.png`), Buffer.from(f.url.split(",")[1], "base64")); }
    });
    console.log(`  ${r.slug}: compiled in ${out.compileMs.toFixed(0)} ms; plan level ${out.shots.dots} dots, drawn in ` +
                out.planMs.map(t => t.toFixed(1)).join(" and ") + " ms" +
                (out.frames.length ? "; first-person frames " + out.frames.map(f => `${f.name} ${f.ms.toFixed(1)} ms`).join(", ")
                                   : "; first-person frames: walk.js has no Walk.snapshot yet"));
    errors.forEach(e => console.log("  page error: " + e));
    await page.close();
  }
  await browser.close();
}

(async () => {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const pi = args.indexOf("--png");
  const png = pi >= 0 ? args[pi + 1] : null;
  const files = all
    ? fs.readdirSync(path.join(V2, "interiors")).filter(f => f.endsWith(".json")).sort().map(f => path.join(V2, "interiors", f))
    : args.filter((a, i) => !a.startsWith("--") && (pi < 0 || i !== pi + 1));
  if (!files.length) {
    console.error("usage: node scripts/check_interior.js docs/v2/interiors/<slug>.json [--png dir] | --all [--png dir]");
    process.exit(2);
  }
  const W = pageCode();
  const museums = (readJSON(path.join(V2, "museums.json"), {}) || {}).museums || [];
  const results = files.map(f => checkOne(f, W, museums));
  results.forEach(gather);
  results.forEach(r => report(r, all));
  record(results);
  if (all) {
    const tiers = {};
    results.forEach(r => { tiers[r.tier] = (tiers[r.tier] || 0) + 1; });
    const bad = results.filter(r => r.errors.length).length;
    console.log(`${results.length} interiors: ` + Object.entries(tiers).map(([k, v]) => `${v} ${k}`).join(", ") +
                `; ${bad} with errors`);
  }
  if (png) { await pictures(results, png); }
  process.exit(results.some(r => r.errors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

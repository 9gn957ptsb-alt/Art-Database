#!/usr/bin/env node
/* Check a museum's interior (docs/v2/interiors/<slug>.json) the way the walk
   will have it: the page's own docs/v2/models.js and docs/v2/walk-plan.js,
   run here in a vm, compile it against the museum's model and ground and
   apply every rule of INTERIORS.md (WalkPlan.check).

     node scripts/check_interior.js docs/v2/interiors/<slug>.json [--png dir]
     node scripts/check_interior.js --all [--png dir]

   It prints the tier, the square metres of documented and reconstructed
   rooms on each floor, what can be reached from the door, the works by how
   the museum's records place them, and every error and warning; --all a
   line a museum. Errors set the exit code. It writes the tier back into the
   file, and into the museum's entry in docs/v2/models/ledger.json its
   interior's tier, rooms and works; the findings against the model (a
   documented room outside it, a footprint that does not stand on the
   ground's buildings) go into the model's own log there, for its next
   refinement, one line a kind, rewritten as they change. The ledger is
   written as the Python scripts write it.

   --png renders through Playwright (installed globally in a session), into
   the directory given: a plan of every floor seen from above (rooms tinted
   by how they are known, their ids, the openings, the stairs as arrows, the
   hung works as ticks of their colours on their walls, the model's
   footprint and any room outside it in red), the cut-away plan level from
   two diagonals as the page draws it, and — once docs/v2/walk.js offers
   Walk.snapshot(world, hung, {x, y, a, floor, w, h, dot}), resolving to a
   canvas of one frame — first-person frames from the door and before up to
   six hung works. Artsy's pictures are stood in for by each work's three
   colours (its image store is not reachable from a session); nothing else
   leaves the page. It prints the frame times. */

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
    const next = text.replace(/"tier":(\s*)"(documented|reconstructed|shell)"/, (m, sp) => `"tier":${sp}"${res.tier}"`);
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
  // Read just before writing: the daily routine and other runs write here too.
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
    // The findings against the model, for its next refinement: the checker's
    // current ones, a line each, rewritten as they change — a line that
    // still holds stays where it is, one that no longer does is taken out
    // (the refinement's own line says what changed), a new one goes last.
    entry.log = entry.log || [];
    const now = (r.findings || []).map(findingLine).filter(Boolean);
    const mine = /^\d{4}-\d{2}-\d{2} interior finding: /;
    const kept = [], had = new Set();
    for (const line of entry.log) {
      if (!mine.test(line)) { kept.push(line); continue; }
      const text = line.slice(11);
      if (now.includes(text) && !had.has(text)) { kept.push(line); had.add(text); } else { changed = true; }
    }
    for (const text of now) {
      if (!had.has(text)) { kept.push(`${today()} ${text}`); had.add(text); changed = true; }
    }
    entry.log = kept;
  }
  if (changed) { fs.writeFileSync(LEDGER, pythonJSON(ledger) + "\n"); }
}

// The ledger as the Python scripts write it (json.dumps, indent 2, ASCII),
// so a run of the checker changes only the lines it means to.
function pythonJSON(x) {
  return JSON.stringify(x, null, 2).replace(/[\u0080-\uffff]/g, ch => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
}

function findingLine(f) {
  if (f.text) { return "interior finding: " + f.text; }
  if (f.room) {
    return `interior finding: documented room ${f.room} (${f.floor}) lies ${Math.round(f.out * 100)}% outside the model, ` +
           `x ${f.x0.toFixed(1)} to ${f.x1.toFixed(1)}, y ${f.y0.toFixed(1)} to ${f.y1.toFixed(1)} m`;
  }
  if (f.ground !== undefined) {
    return `interior finding: only ${Math.round(f.ground * 100)}% of the model's footprint stands on the ground's buildings`;
  }
  return null;
}

// How far the model's footprint reaches across a band of it, at a floor's
// eye height: along y for a band of x (axis "x"), or along x for a band of
// y — the voxels built there and over them, a wall rather than a step or a
// kerb, and not a post standing alone. [lo, hi] or null.
function modelReach(world, z, axis, lo, hi) {
  const vx = world && world.vox;
  if (!vx) { return null; }
  const k = Math.floor((z + 1.6) / vx.v);
  if (k < 0 || k >= vx.nz) { return null; }
  const plane = vx.nx * vx.ny;
  const at = (i, j, kk) => {
    if (kk >= vx.nz) { return true; }
    const m = vx.grid[kk * plane + j * vx.nx + i];
    return !!(m && vx.built[m - 1]);
  };
  const built = (i, j) => i >= 0 && j >= 0 && i < vx.nx && j < vx.ny && at(i, j, k) && at(i, j, k + 1);
  let a = Infinity, b = -Infinity;
  for (let j = 0; j < vx.ny; j += 1) {
    for (let i = 0; i < vx.nx; i += 1) {
      if (!built(i, j) || !(built(i - 1, j) || built(i + 1, j) || built(i, j - 1) || built(i, j + 1))) { continue; }
      const x = (i + 0.5) * vx.v - vx.site[0] / 2, y = (j + 0.5) * vx.v - vx.site[1] / 2;
      const on = axis === "x" ? x : y, across = axis === "x" ? y : x;
      if (on < lo || on > hi) { continue; }
      a = Math.min(a, across - vx.v / 2); b = Math.max(b, across + vx.v / 2);
    }
  }
  return isFinite(a) ? [a, b] : null;
}

// Several documented rooms outside the model are one finding a floor, said
// the way the next refinement needs it: which way the rooms overreach the
// model (for each room, the way it would take the smaller change to the
// model to take it in), and across the bands they stand in, how far the
// rooms reach that way and how far the model does — the National Gallery's
// wings, 92 m deep in its own outlines and 62 m in its model.
function gather(r) {
  const rooms = (r.findings || []).filter(f => f.room);
  if (rooms.length < 4 || !r.world) { return; }
  const by = {};
  rooms.forEach(f => { (by[f.floor] = by[f.floor] || []).push(f); });
  const out = (r.findings || []).filter(f => !f.room);
  const c = r.world.cos, s = r.world.sin;
  // A room's extent in the model's frame.
  const extent = room => {
    const pts = room.poly.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]);
    return [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])),
            Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))];
  };
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  Object.keys(by).forEach(fid => {
    const list = by[fid], fl = r.world.floors.find(f => f.id === fid);
    if (!fl) { return; }
    const documented = fl.rooms.filter(room => !room.pseudo && room.sure === "documented" && room.poly).map(extent);
    // Each room: the model's reach across its band either way, and which way it overshoots least.
    const each = list.map(f => {
      const my = modelReach(r.world, fl.z, "x", f.x0, f.x1), mx = modelReach(r.world, fl.z, "y", f.y0, f.y1);
      const oy = my ? Math.max(0, my[0] - f.y0, f.y1 - my[1]) : Infinity;
      const ox = mx ? Math.max(0, mx[0] - f.x0, f.x1 - mx[1]) : Infinity;
      const axis = oy > 0 && (oy <= ox || !(ox > 0)) ? "y" : "x";
      return { f, axis, m: axis === "y" ? my : mx };
    }).filter(e => e.m);
    const ids = list.map(f => f.room);
    let text = `${list.length} documented rooms of the ${fl.name || fid} lie outside the model (` +
               `${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", …" : ""})`;
    const ys = each.filter(e => e.axis === "y"), xs = each.filter(e => e.axis === "x");
    const way = ys.length >= xs.length ? ys : xs;
    if (way.length) {
      const axis = way[0].axis, along = axis === "y" ? "x" : "y";
      // The bands the rooms stand in, joined where they touch.
      const bands = way.map(e => axis === "y" ? [e.f.x0, e.f.x1] : [e.f.y0, e.f.y1]).sort((a, b) => a[0] - b[0]);
      const joined = [];
      bands.forEach(b => {
        const last = joined[joined.length - 1];
        if (last && b[0] <= last[1] + 2) { last[1] = Math.max(last[1], b[1]); } else { joined.push(b.slice()); }
      });
      // How far the documented rooms in those bands reach, and the model.
      let a = Infinity, b = -Infinity;
      documented.forEach(e => {
        const on = axis === "y" ? [e[0], e[2]] : [e[1], e[3]];
        if (!joined.some(j => on[1] >= j[0] && on[0] <= j[1])) { return; }
        a = Math.min(a, axis === "y" ? e[1] : e[0]); b = Math.max(b, axis === "y" ? e[3] : e[2]);
      });
      const m0 = median(way.map(e => e.m[0])), m1 = median(way.map(e => e.m[1]));
      if (isFinite(a)) {
        text += `: its rooms reach ${axis} ${a.toFixed(1)} to ${b.toFixed(1)} m (${(b - a).toFixed(1)} m) where the model reaches ` +
                `${axis} ${m0.toFixed(1)} to ${m1.toFixed(1)} m (${(m1 - m0).toFixed(1)} m), in ${along} ` +
                joined.map(j => `${j[0].toFixed(1)} to ${j[1].toFixed(1)}`).join(" and ") + " m";
      }
    }
    out.push({ text });
  });
  r.findings = out;
}

function playwright() {
  try { return require("playwright"); } catch (e) {
    const root = execSync("npm root -g").toString().trim();
    return require(path.join(root, "playwright"));
  }
}

// A stand-in for a work's picture: its three measured colours as bands,
// 5:3:2 from the top, the way the walk shows a saved work before its picture
// comes (Artsy's image store is not reachable from a session). A small BMP,
// which needs no library to write.
function standIn(colours, w = 60, h = 40) {
  const rgb = (colours || []).map(c => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128];
  });
  while (rgb.length < 3) { rgb.push(rgb[rgb.length - 1] || [128, 128, 128]); }
  const row = Math.ceil(w * 3 / 4) * 4, size = 54 + row * h, b = Buffer.alloc(size);
  b.write("BM", 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(-h, 22);   // rows top down
  b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y += 1) {
    const c = y < h * 0.5 ? rgb[0] : y < h * 0.8 ? rgb[1] : rgb[2];
    for (let x = 0; x < w; x += 1) {
      const o = 54 + y * row + x * 3;
      b[o] = c[2]; b[o + 1] = c[1]; b[o + 2] = c[0];
    }
  }
  return b;
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
    // Artsy's pictures, stood in for by each work's three colours; nothing else leaves the page.
    const byKey = {};
    (r.interior.works || []).forEach(w => { if (w.i) { byKey[w.i] = w.c; } });
    await page.route(/^https?:\/\//, route => {
      const m = /d32dm0rphc51dk\.cloudfront\.net\/([^/]+)\//.exec(route.request().url());
      if (m) { return route.fulfill({ status: 200, contentType: "image/bmp", body: standIn(byKey[m[1]]) }); }
      return route.abort();
    });
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
      // The soil as the page gives it to the model and the plan: i east, j
      // south of the museum's point, a pixel of dirt-land.png a cell
      // (land.js: (i, j) => soilCell(dirt.land, b, j, i)).
      const soil = (i, j) => {
        const o = (cellOf(n, v0 + j) * n + cellOf(n, u0 + i)) * 4;
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
      const dotsOf = Models.build(model, soil);
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

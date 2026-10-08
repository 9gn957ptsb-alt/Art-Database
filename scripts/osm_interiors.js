#!/usr/bin/env node
/* OpenStreetMap's indoor plan, fitted to the museum's model as the walk compiles it (the page's own
   models.js and walk-plan.js, in a vm). Called by scripts/build_interiors.py --osm, which reads
   osm/indoor/<slug>.json into rooms, doors and ways between floors; this does what needs the
   compiled plan. Reads {doc, slug, mode, osm} on stdin and writes {doc, report} on stdout.

   mode "rooms" (a museum whose rooms no source gives — a shell, or the site's arrangement):
     the levels  each level's height from the model: the storey (3.5-7 m, a quarter metre at a
                 time) that gives the most of the mapped rooms on the upper levels headroom under
                 the model's roof (2.4 m), nearest 5 m where several do as well;
     the rooms   a room is kept where half of it stands on the museum in the model (the part of the
                 footprint the shell's rule takes for the museum, 3 m round it); mapped outlines
                 off it are neighbours (a station, a transit hall) and are dropped; overlaps the
                 compiler refuses give the smaller room up;
     the doors   the mapped doors that cannot be cut (no wall between their rooms within 1.5 m)
                 are dropped;
     the way in  of OpenStreetMap's entrances by a room of the lowest floor (entrance=main first,
                 then the nearest the museum's point), the one that reaches the most; else the
                 shell's own door (the middle of the model's longest south-facing wall), cut
                 through to the nearest room, said so;
     between     a lift where OpenStreetMap maps a lift or a stair across levels, its square (2 m,
                 ours) set where it lands inside one walkable room on two floors or more; where
                 no mapped one joins a floor to the rest, one by the rule in a room both share,
                 nearest the way in (osm-rule);
     the rule    a room no door reaches is joined to one already reached that it shares a wall
                 with (3 m of it or more, at most 2.5 m thick), a corridor or hall first, then the
                 longest wall: a doorway 2.4 m wide at the middle of the shared wall (osm-rule),
                 until no more can be;
     the fit     each floor's mapped rooms against the model's footprint there (the museum's
                 part), and how much of their floor is reached from the way in.
   mode "own" (the NGA, the Met, the Art Institute: their own data draws the rooms): only OSM's
     doors between two of their rooms, its lifts where they land in one of their rooms on two
     floors or more, and inside a wing it maps as one room by a range of gallery numbers, doorways
     by the rule between its galleries that share a wall, enough to join them. */
"use strict";

const fs = require("fs");
const path = require("path");
const A = require("./build_interiors_arranged.js");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const TODAY = new Date().toISOString().slice(0, 10);
const MARK = "OpenStreetMap's indoor mapping";
const THICK = 2.5, SHARE = 3.0, DOOR = 2.4, LIFT = 2.0;

function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return d; } }
function r2(v) { return Math.round(v * 100) / 100; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }

const W = A.pageCode();
const P = W.WalkPlan;

function compile(doc, model) {
  return P.compile(Object.assign({}, doc, { works: [] }), model, { soil: null });
}

// A rect of the grid ([gx0, gy0, gx1, gy1]) as the file writes it: its first corner in the model's frame.
function fileRect(turn, g) {
  const c = P.toWorld(turn, g[0], g[1]);
  return [r2(c[0]), r2(c[1]), r2(g[2] - g[0]), r2(g[3] - g[1])];
}

// The model's height over a point of its frame: its roof less a voxel there, or -1 off it.
function roofAt(vx, x, y) {
  const i = Math.floor((x + vx.site[0] / 2) / vx.v), j = Math.floor((y + vx.site[1] / 2) / vx.v);
  if (i < 0 || j < 0 || i >= vx.nx || j >= vx.ny) { return -1; }
  const t = vx.top[j * vx.nx + i];
  return t >= 0 ? t * vx.v : -1;
}

function inPoly(p, x, y) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) { ins = !ins; }
  }
  return ins;
}
function samples(poly, step) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  poly.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
  const s = Math.max(step, Math.sqrt((x1 - x0) * (y1 - y0) / 400));
  const out = [];
  for (let y = y0 + s / 2; y < y1; y += s) { for (let x = x0 + s / 2; x < x1; x += s) { if (inPoly(poly, x, y)) { out.push([x, y]); } } }
  if (!out.length) { out.push([(x0 + x1) / 2, (y0 + y1) / 2]); }
  return out;
}
function polyArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i, i += 1) { a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); }
  return Math.abs(a / 2);
}

/* ---------------------------------------------------------------- the museum in the model */

// The model's buildings at a level: the parts of its footprint there of a size (a tenth of the
// largest, 100 m² at least: the shell's rule, which then takes the one nearest the museum's point;
// here every one, since OpenStreetMap says which the museum's rooms are in). `part(x, y)` is the
// part a point of the model's frame stands on (within `grow` metres of it), or -1; `area(set)` the
// floor of those parts.
function building(model, cell, turn, z, grow) {
  const world = A.shellAt(W, model, cell, turn, z), fl = world.floors[0];
  if (!fl) { return null; }
  const mp = A.mainPart(W, world, fl);
  if (!mp) { return null; }
  const largest = Math.max(...mp.parts.map(p => p.length));
  const label = new Int32Array(fl.n).fill(-1);
  mp.parts.forEach((p, k) => {
    if (p.length < 0.1 * largest || p.length * cell * cell < 100) { return; }
    p.forEach(q => { label[q] = k; });
  });
  const r = Math.ceil(grow / cell);
  let near = label;
  if (r > 0) {
    near = Int32Array.from(label);
    for (let q = 0; q < fl.n; q += 1) {
      if (label[q] < 0) { continue; }
      const i = q % fl.gw, j = Math.floor(q / fl.gw);
      for (let dj = -r; dj <= r; dj += 1) {
        for (let di = -r; di <= r; di += 1) {
          const a = i + di, b = j + dj;
          if (a >= 0 && b >= 0 && a < fl.gw && b < fl.gh && near[b * fl.gw + a] < 0) { near[b * fl.gw + a] = label[q]; }
        }
      }
    }
  }
  return {
    world,
    part(x, y) {
      const g = P.toGrid(turn, x, y), q = P.cellAt(fl, g[0], g[1]);
      return q >= 0 ? near[q] : -1;
    },
    area(set) {
      let n = 0;
      set.forEach(k => { if (mp.parts[k]) { n += mp.parts[k].length; } });
      return n * cell * cell;
    }
  };
}

/* ---------------------------------------------------------------- what touches what */

// Every pair of rooms of a floor facing each other across a wall (at most THICK), along the grid's
// axes: {a, b (room indexes), n (cells of wall between them), at [x, y] (grid, the middle contact)}.
function contacts(fl) {
  const gw = fl.gw, gh = fl.gh, cell = fl.cell, lim = Math.round(THICK / cell) + 1, pairs = {};
  const ok = q => q >= 0 && fl.room[q] >= 0 && !fl.rooms[fl.room[q]].pseudo && fl.kind[q] === P.FLOOR;
  for (let j = 0; j < gh; j += 1) {
    for (let i = 0; i < gw; i += 1) {
      const q = j * gw + i;
      if (!ok(q)) { continue; }
      const a = fl.room[q];
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        let k = 1, b = -1;
        while (k <= lim) {
          const ii = i + di * k, jj = j + dj * k;
          if (ii >= gw || jj >= gh) { break; }
          const p = jj * gw + ii;
          if (fl.room[p] >= 0) { if (ok(p) && fl.room[p] !== a) { b = fl.room[p]; } break; }
          if (fl.kind[p] !== P.WALL) { break; }
          k += 1;
        }
        if (b < 0 || k < 2) { continue; }
        const key = Math.min(a, b) + ":" + Math.max(a, b) + ":" + (di ? "x" : "y");
        const c = pairs[key] || (pairs[key] = { a: Math.min(a, b), b: Math.max(a, b), axis: di ? "x" : "y", pts: [] });
        c.pts.push([fl.x0 + (i + 0.5 + di * k / 2) * cell, fl.y0 + (j + 0.5 + dj * k / 2) * cell]);
      }
    }
  }
  // Each pair's contact along both axes together (a wall off the grid's axes steps between them):
  // its length the cells of wall it faces across, its doorway at the contact nearest their middle.
  const both = {};
  Object.values(pairs).forEach(c => {
    const k = c.a + ":" + c.b;
    const t = both[k] || (both[k] = { a: c.a, b: c.b, pts: [], nx: 0, ny: 0 });
    t.pts = t.pts.concat(c.pts);
    if (c.axis === "x") { t.nx += c.pts.length; } else { t.ny += c.pts.length; }
  });
  return Object.values(both).map(c => {
    let mx = 0, my = 0;
    c.pts.forEach(p => { mx += p[0]; my += p[1]; });
    mx /= c.pts.length; my /= c.pts.length;
    let at = c.pts[0], bd = Infinity;
    c.pts.forEach(p => { const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2; if (d < bd) { bd = d; at = p; } });
    return { a: c.a, b: c.b, n: c.pts.length, len: Math.max(c.nx, c.ny) * cell, at };
  }).filter(c => c.len >= SHARE);
}

/* ---------------------------------------------------------------- reach, as a graph */

// Rooms (floor:index) joined by the openings carved and the lifts.
function graph(world) {
  const parent = {};
  const find = x => { while (parent[x] !== undefined && parent[x] !== x) { x = parent[x]; } return x; };
  const join = (x, y) => { const a = find(x), b = find(y); if (a !== b) { parent[a] = b; } };
  world.floors.forEach(fl => {
    fl.rooms.forEach(r => { if (!r.pseudo) { parent[fl.index + ":" + r.index] = fl.index + ":" + r.index; } });
    fl.doors.forEach(d => { if (d.cells > 0 && d.a >= 0 && d.b >= 0) { join(fl.index + ":" + d.a, fl.index + ":" + d.b); } });
  });
  world.lifts.forEach(lf => {
    const at = [];
    lf.floors.forEach(fi => {
      const fl = world.floors[fi];
      const c = P.cellAt(fl, (lf.rect[0] + lf.rect[2]) / 2, (lf.rect[1] + lf.rect[3]) / 2);
      // The room round the lift: the cells beside its square.
      const i = c % fl.gw, j = Math.floor(c / fl.gw), half = Math.ceil((lf.rect[2] - lf.rect[0]) / fl.cell / 2) + 1;
      for (let dj = -half; dj <= half; dj += 1) {
        for (let di = -half; di <= half; di += 1) {
          const q = (j + dj) * fl.gw + i + di;
          if (q >= 0 && q < fl.n && fl.room[q] >= 0 && !fl.rooms[fl.room[q]].pseudo) { at.push(fi + ":" + fl.room[q]); }
        }
      }
    });
    for (let k = 1; k < at.length; k += 1) { join(at[0], at[k]); }
  });
  return { find, join };
}

// The rooms reached from the way in, by the compiler's own walk.
function reachedSet(world) {
  const s = new Set();
  world.floors.forEach(fl => fl.rooms.forEach(r => { if (!r.pseudo && r.reach) { s.add(fl.index + ":" + r.index); } }));
  return s;
}

function areaOf(world, keys) {
  let a = 0;
  keys.forEach(k => { const [fi, ri] = k.split(":").map(Number); a += world.floors[fi].rooms[ri].area || 0; });
  return a;
}

/* ---------------------------------------------------------------- lifts */

// Where a lift of side s can stand near (x, y) (model frame) inside one walkable room on each of the
// floors given: {rect (grid), floors: [index], dist} with the most floors, then the nearest, or null.
function liftAt(world, x, y, floors, reach, side) {
  const g = P.toGrid(world.turn !== undefined ? world.turn : 0, x, y);
  const fl0 = world.floors[floors[0]], cell = fl0.cell, s = side || LIFT, n = Math.round(s / cell);
  let best = null;
  const R = Math.round(reach / cell);
  for (let dj = -R; dj <= R; dj += 1) {
    for (let di = -R; di <= R; di += 1) {
      const d = Math.hypot(di, dj) * cell;
      if (d > reach) { continue; }
      const gx0 = Math.round((g[0] - s / 2) / cell + di) * cell, gy0 = Math.round((g[1] - s / 2) / cell + dj) * cell;
      const rect = [gx0, gy0, gx0 + n * cell, gy0 + n * cell];
      const on = [];
      floors.forEach(fi => {
        const fl = world.floors[fi];
        let room = -2;
        for (let b = 0; b < n && room !== -1; b += 1) {
          for (let a = 0; a < n; a += 1) {
            const q = P.cellAt(fl, rect[0] + (a + 0.5) * cell, rect[1] + (b + 0.5) * cell);
            if (q < 0 || fl.kind[q] !== P.FLOOR || fl.room[q] < 0 || fl.rooms[fl.room[q]].pseudo || fl.door[q] >= 0 ||
                fl.stair[q] >= 0 || fl.lift[q] >= 0 || (room >= 0 && fl.room[q] !== room)) { room = -1; break; }
            room = fl.room[q];
          }
        }
        // Not hard against a doorway: a cell's ring round it stays in the room too.
        if (room >= 0) {
          for (let b = -1; b <= n && room >= 0; b += 1) {
            for (let a = -1; a <= n; a += 1) {
              if (a >= 0 && a < n && b >= 0 && b < n) { continue; }
              const q = P.cellAt(fl, rect[0] + (a + 0.5) * cell, rect[1] + (b + 0.5) * cell);
              if (q >= 0 && fl.door[q] >= 0) { room = -1; break; }
            }
          }
        }
        if (room >= 0) { on.push(fi); }
      });
      if (on.length < 2) { continue; }
      if (!best || on.length > best.floors.length || (on.length === best.floors.length && d < best.dist)) { best = { rect, floors: on, dist: d }; }
    }
  }
  return best;
}

/* ---------------------------------------------------------------- the problems the compiler finds */

function dropFailing(doc, world) {
  let dropped = 0;
  const bad = new Set();
  world.problems.forEach(p => {
    const m = /^opening (.+?) — (.+?) on (\S+): /.exec(p.text);
    if (m) { bad.add(m[3] + "|" + m[1] + "|" + m[2]); }
  });
  // Rooms overlapping more than the checker allows: the smaller gives way.
  const gone = new Set();
  world.overlaps.forEach(o => {
    const fl = world.floors[o.floor], a = fl.rooms[o.a], b = fl.rooms[o.b];
    const small = Math.min(a.area, b.area) / (fl.cell * fl.cell);
    if (o.cells > 0.05 * small) { gone.add(fl.id + "|" + (a.area < b.area ? a.id : b.id)); }
  });
  doc.floors.forEach(f => {
    const before = f.open.length;
    f.open = f.open.filter(o => !bad.has(f.id + "|" + o.a + "|" + o.b));
    dropped += before - f.open.length;
    if (gone.size) {
      const ids = new Set(f.rooms.filter(r => gone.has(f.id + "|" + r.id)).map(r => r.id));
      f.rooms = f.rooms.filter(r => !ids.has(r.id));
      f.open = f.open.filter(o => !ids.has(o.a) && !ids.has(o.b));
    }
  });
  return dropped + gone.size;
}

/* ---------------------------------------------------------------- the rooms mode */

function roomsMode(doc, slug, osm, model) {
  const report = { ok: false };
  const cell = doc.grid.cell, turn = doc.grid.turn;
  const vx = A.shellAt(W, model, cell, turn, 0).vox;
  if (!vx) { report.why = "no model"; return { doc, report }; }
  // The storey.
  const upper = [];
  doc.floors.forEach(f => {
    if (f._lv < 1) { return; }
    f.rooms.forEach(r => { upper.push({ lv: f._lv, a: r._area || polyArea(r.poly), pts: samples(r.poly, 2) }); });
  });
  let storey = 5, bestScore = -1;
  for (let s = 3.5; s <= 7.0001; s += 0.25) {
    let score = 0;
    upper.forEach(u => {
      const z = u.lv * s;
      const k = u.pts.filter(p => roofAt(vx, p[0], p[1]) >= z + 2.4).length / u.pts.length;
      score += u.a * k;
    });
    if (score > bestScore + 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && Math.abs(s - 5) < Math.abs(storey - 5))) { bestScore = score; storey = s; }
  }
  report.storey = storey;
  doc.floors.forEach(f => { f.z = r2(f._lv * storey); });
  // The museum's part of the model: rooms off it are its neighbours'.
  const bld = building(model, cell, turn, 0, 3);
  if (!bld) { report.why = "the model has no footprint"; return { doc, report }; }
  let dropped = 0;
  doc.floors.forEach(f => {
    const keep = f.rooms.filter(r => {
      const pts = samples(r.poly, 1.5);
      return pts.filter(p => bld.part(p[0], p[1]) >= 0).length >= 0.5 * pts.length;
    });
    dropped += f.rooms.length - keep.length;
    const ids = new Set(keep.map(r => r.id));
    f.rooms = keep;
    f.open = f.open.filter(o => ids.has(o.a) && (o.b === "outside" || ids.has(o.b)));
  });
  doc.floors = doc.floors.filter(f => f.rooms.length);
  report.off = dropped;
  if (!doc.floors.length) { report.why = "no mapped room stands on the museum's model"; report.rooms = 0; report.cover = 0; report.reach = 0; return { doc, report }; }
  doc.floors.sort((a, b) => a.z - b.z);
  // The rooms that can be compiled, and the doors that can be cut.
  doc.enter = { floor: doc.floors[0].id, at: [0, 0], face: 0, door: [0, 0], out: [], sure: "reconstructed", src: ["osm-indoor"] };
  for (let k = 0; k < 6; k += 1) {
    const w = compile(doc, model);
    if (!dropFailing(doc, w)) { break; }
  }
  report.doors = doc.floors.reduce((a, f) => a + f.open.filter(o => o.kind === "door").length, 0);
  // The way in.
  const first = doc.floors[0];
  const lowest = first._lv;
  let world = compile(Object.assign({}, doc, { enter: null }), model);
  const fl0 = world.floors[0];
  const tries = [];
  (osm.entrances || []).forEach(e => {
    if (e.tagged && e.levels.indexOf(lowest) < 0) { return; }
    // The nearest walkable cell of a room within 3 m.
    const g = P.toGrid(turn, e.x, e.y);
    let near = null;
    const R = Math.ceil(3 / cell);
    const q0 = P.cellAt(fl0, g[0], g[1]);
    if (q0 < 0) { return; }
    const i0 = q0 % fl0.gw, j0 = Math.floor(q0 / fl0.gw);
    for (let dj = -R; dj <= R; dj += 1) {
      for (let di = -R; di <= R; di += 1) {
        const q = (j0 + dj) * fl0.gw + i0 + di;
        if (q < 0 || q >= fl0.n || fl0.room[q] < 0 || fl0.rooms[fl0.room[q]].pseudo || fl0.kind[q] !== P.FLOOR) { continue; }
        if (fl0.rooms[fl0.room[q]].kind === "closed") { continue; }
        const d = Math.hypot(di, dj) * cell;
        if (d <= 3 && (!near || d < near.d)) { near = { d, q, room: fl0.rooms[fl0.room[q]] }; }
      }
    }
    if (near) { tries.push({ e, near, score: (e.main ? 0 : 1000) + Math.hypot(e.x, e.y) }); }
  });
  tries.sort((a, b) => a.score - b.score);
  report.entrances = tries.length;
  let chosen = null;
  for (const t of tries.slice(0, 6)) {
    const c = P.centreOf(fl0, t.near.q), g = P.toGrid(turn, t.e.x, t.e.y);
    let ux = g[0] - c[0], uy = g[1] - c[1], L = Math.hypot(ux, uy);
    if (L < 0.3) { ux = g[0] - t.near.room.cx; uy = g[1] - t.near.room.cy; L = Math.hypot(ux, uy) || 1; }
    ux /= L; uy /= L;
    const at = [g[0] + ux * 2.5, g[1] + uy * 2.5];
    const outG = [Math.min(at[0], g[0]) - 3, Math.min(at[1], g[1]) - 3, Math.max(at[0], g[0]) + 3, Math.max(at[1], g[1]) + 3];
    const atW = P.toWorld(turn, at[0], at[1]);
    const open = { a: t.near.room.id, b: "outside", at: [r2(t.e.x), r2(t.e.y)], w: DOOR, h: null, kind: "door", sure: "reconstructed",
                   src: ["osm-indoor"], note: `${MARK}: its entrance (${t.e.id}${t.e.main ? ", entrance=main" : ""}${t.e.name ? ", " + t.e.name : ""}); its width ours` };
    const enter = { floor: first.id, at: [r2(atW[0]), r2(atW[1])], face: r2(((Math.atan2(-ux, uy) * 180 / Math.PI) + 360 + 180 + turn) % 360),
                    door: [r2(t.e.x), r2(t.e.y)], out: [fileRect(turn, outG)], sure: "reconstructed", src: ["osm-indoor"],
                    note: `${MARK}: its entrance${t.e.main ? " (entrance=main)" : ""}${t.e.name ? ", " + t.e.name : ""}, node ${t.e.id}` };
    const trial = clone(doc);
    trial.floors[0].open.push(open);
    trial.enter = enter;
    const w = compile(trial, model);
    if (w.problems.some(p => /entrance|opening .* outside/.test(p.text))) { continue; }
    const got = areaOf(w, reachedSet(w));
    if (got > 0 && (!chosen || got > chosen.got)) { chosen = { got, open, enter, t }; }
  }
  if (chosen) {
    first.open.push(chosen.open);
    doc.enter = chosen.enter;
    report.enter_said = `OpenStreetMap's entrance${chosen.t.e.main ? " (entrance=main)" : ""}${chosen.t.e.name ? ", " + chosen.t.e.name : ""} into ${chosen.open.a}`;
  } else {
    // A way in by the rule: from a mapped room of the lowest floor straight out through the model's
    // wall to open ground (4 m of it before the door), the thinnest wall first, then facing south,
    // then nearest the shell's own door; cut 2.4 m wide, said so.
    const sw = A.shellAt(W, model, cell, turn, first.z), se = sw.enter;
    const sd = se ? se.door : [0, 0];
    const south = P.toGrid(turn, 0, 1);
    const outside = q => q >= 0 && q < fl0.n && fl0.room[q] < 0 && fl0.kind[q] === P.CLOSED && !fl0.foot[q];
    const lim = Math.round(8 / cell), deep = Math.round(4 / cell);
    let best = null;
    for (let q = 0; q < fl0.n; q += 1) {
      if (fl0.room[q] < 0 || fl0.rooms[fl0.room[q]].pseudo || fl0.kind[q] !== P.FLOOR || fl0.rooms[fl0.room[q]].kind === "closed") { continue; }
      const i = q % fl0.gw, j = Math.floor(q / fl0.gw);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let k = 1;
        while (k <= lim) {
          const ii = i + di * k, jj = j + dj * k;
          if (ii < 0 || jj < 0 || ii >= fl0.gw || jj >= fl0.gh) { k = lim + 1; break; }
          const p = jj * fl0.gw + ii;
          if (outside(p)) { break; }
          if (fl0.kind[p] !== P.WALL && fl0.kind[p] !== P.GLASS) { k = lim + 1; break; }
          k += 1;
        }
        if (k > lim || k < 2) { continue; }
        let open = true;
        for (let t = 0; t < deep && open; t += 1) {
          const ii = i + di * (k + t), jj = j + dj * (k + t);
          if (ii < 0 || jj < 0 || ii >= fl0.gw || jj >= fl0.gh || !outside(jj * fl0.gw + ii)) { open = false; }
        }
        if (!open) { continue; }
        const c = P.centreOf(fl0, q);
        const facing = di * south[0] + dj * south[1];
        const score = k * cell * 10 - (facing > 0.5 ? 5 : 0) + Math.hypot(c[0] - sd[0], c[1] - sd[1]) / 20;
        if (!best || score < best.score) { best = { score, q, c, di, dj, k, room: fl0.rooms[fl0.room[q]] }; }
      }
    }
    if (!best) {
      report.why = "no mapped room of the lowest floor has a wall to open ground";
      report.rooms = doc.floors.reduce((x, f) => x + f.rooms.length, 0); report.cover = 0; report.reach = 0;
      return { doc, report };
    }
    const half = DOOR / 2, c = best.c, L = best.k * cell;
    const end = [c[0] + best.di * (L + cell / 2), c[1] + best.dj * (L + cell / 2)];
    const atG = [c[0] + best.di * (L + 2.5), c[1] + best.dj * (L + 2.5)];
    const doorG = [c[0] + best.di * (L - cell / 2), c[1] + best.dj * (L - cell / 2)];
    const cutG = best.di ? [Math.min(c[0], end[0]), c[1] - half, Math.max(c[0], end[0]), c[1] + half]
                         : [c[0] - half, Math.min(c[1], end[1]), c[0] + half, Math.max(c[1], end[1])];
    const atW = P.toWorld(turn, atG[0], atG[1]), doorW = P.toWorld(turn, doorG[0], doorG[1]);
    first.open.push({ a: best.room.id, b: "outside", cut: fileRect(turn, cutG), h: null, kind: "door", sure: "reconstructed",
                      src: ["osm-rule"], note: `${MARK} gives no entrance that opens on a room it draws here: a way in by the rule, from ${best.room.id} straight out through the model's wall (${r2(L)} m) to open ground; ours` });
    const outs = [[atG[0] - 3, atG[1] - 3, atG[0] + 3, atG[1] + 3]];
    doc.enter = { floor: first.id, at: [r2(atW[0]), r2(atW[1])], face: 0, door: [r2(doorW[0]), r2(doorW[1])],
                  out: outs.map(o => fileRect(turn, o)), sure: "reconstructed", src: ["osm-rule", "model"],
                  note: "a way in by the rule: OpenStreetMap maps no entrance into its rooms here, so the thinnest wall from a mapped room to open ground is cut" };
    report.enter_said = "the rule (OpenStreetMap maps no entrance into its rooms here): the thinnest wall from a mapped room to open ground, cut into " + best.room.id;
  }
  // The face: recomputed from the compiled entrance so the walker faces in.
  world = compile(doc, model);
  if (world.enter) {
    const e = world.enter, dx = e.door[0] - e.x, dy = e.door[1] - e.y;
    const mw = P.toWorld(turn, dx, dy);
    doc.enter.face = r2((Math.atan2(mw[0], -mw[1]) * 180 / Math.PI + 360) % 360);
  }
  // Between floors: the lifts and stairs OpenStreetMap maps.
  world = compile(doc, model);
  const byLv = {};
  world.floors.forEach(fl => { byLv[doc.floors[fl.index]._lv] = fl.index; });
  const lifts = [];
  let nLift = 0;
  (osm.lifts || []).forEach(l => {
    if (l.untagged) { return; }
    const fls = l.levels.filter(v => v === Math.round(v) && byLv[v] !== undefined).map(v => byLv[v]);
    if (fls.length < 2) { return; }
    const got = liftAt(world, l.x, l.y, fls, l.kind === "stair" ? 6 : 4, l.kind === "stair" ? 1.5 : LIFT);
    if (!got || got.floors.length < 2) { return; }
    // Not twice in one place.
    if (lifts.some(o => Math.hypot(o.c[0] - (got.rect[0] + got.rect[2]) / 2, o.c[1] - (got.rect[1] + got.rect[3]) / 2) < 6 &&
                        got.floors.every(f => o.floors.indexOf(f) >= 0))) { return; }
    nLift += 1;
    const spec = { id: "lift-" + l.id, name: l.kind === "stair" ? "Stair" : "Lift", rect: fileRect(turn, got.rect),
                   floors: got.floors.map(fi => world.floors[fi].id), sure: "reconstructed", src: ["osm-indoor"],
                   note: `${MARK}: ${l.kind === "stair" ? "a stair" : "a lift"} (${l.id}) across levels ${l.levels.join(";")}; walked as a lift${l.kind === "stair" ? " (its flight is not known)" : ""}, its square ours` };
    lifts.push({ spec, c: [(got.rect[0] + got.rect[2]) / 2, (got.rect[1] + got.rect[3]) / 2], floors: got.floors });
  });
  lifts.forEach(l => { doc.floors[l.floors[0]].lifts.push(l.spec); });
  report.lifts = nLift;
  // The rule: rooms no door reaches, joined to one reached through the wall they share; and a floor
  // no lift reaches, by a lift in a room both share.
  let rule = 0, ruleLift = 0;
  for (let round = 0; round < 400; round += 1) {
    world = compile(doc, model);
    const reached = reachedSet(world);
    const G = graph(world);
    const comp = new Set();
    reached.forEach(k => comp.add(G.find(k)));
    let best = null;
    world.floors.forEach(fl => {
      contacts(fl).forEach(c => {
        const ka = fl.index + ":" + c.a, kb = fl.index + ":" + c.b;
        const ina = comp.has(G.find(ka)), inb = comp.has(G.find(kb));
        if (ina === inb) { return; }
        const ra = fl.rooms[c.a], rb = fl.rooms[c.b];
        if (ra.kind === "closed" || rb.kind === "closed") { return; }
        const hallish = (ra.kind === "hall" || ra.kind === "lobby" ? 1 : 0) + (rb.kind === "hall" || rb.kind === "lobby" ? 1 : 0);
        const score = hallish * 100 + Math.min(c.len, 30);
        if (!best || score > best.score) { best = { score, fl, c, ra, rb }; }
      });
    });
    if (best) {
      const atW = P.toWorld(turn, best.c.at[0], best.c.at[1]);
      doc.floors[best.fl.index].open.push({ a: best.ra.id, b: best.rb.id, at: [r2(atW[0]), r2(atW[1])], w: DOOR, h: null, kind: "door",
        sure: "reconstructed", src: ["osm-indoor", "osm-rule"],
        note: `${MARK} draws the two side by side (${r2(best.c.len)} m of wall) and no door between them: a doorway at the middle of the wall, 2.4 m, by the rule, where one had no way in` });
      rule += 1;
      continue;
    }
    // A floor not reached at all: a lift by the rule from the nearest floor reached.
    const floorsReached = new Set(Array.from(reached).map(k => +k.split(":")[0]));
    const missing = world.floors.filter(fl => !floorsReached.has(fl.index) && fl.rooms.some(r => !r.pseudo && r.kind !== "closed"));
    if (!missing.length) { break; }
    let placed = false;
    for (const fl of missing) {
      const others = Array.from(floorsReached).sort((a, b) => Math.abs(world.floors[a].z - fl.z) - Math.abs(world.floors[b].z - fl.z));
      for (const fo of others) {
        // A room of this floor over a reached room of that one, nearest the way in.
        const cand = [];
        fl.rooms.forEach(r => { if (!r.pseudo && r.kind !== "closed") { cand.push(r); } });
        cand.sort((a, b) => Math.hypot(a.cx - world.enter.x, a.cy - world.enter.y) - Math.hypot(b.cx - world.enter.x, b.cy - world.enter.y));
        for (const r of cand.slice(0, 40)) {
          const cw = P.toWorld(turn, r.cx, r.cy);
          const got = liftAt(world, cw[0], cw[1], [fo, fl.index], Math.min(12, Math.sqrt(r.area)), LIFT);
          if (got && got.floors.length === 2) {
            const spec = { id: "lift-rule-" + fl.id, name: "Lift", rect: fileRect(turn, got.rect), floors: [world.floors[fo].id, fl.id],
                           sure: "reconstructed", src: ["osm-rule"],
                           note: `${MARK} maps no way between ${world.floors[fo].id} and ${fl.id} that lands in its rooms: a lift by the rule, in a room both floors have, nearest the way in; ours` };
            doc.floors[fo].lifts.push(spec);
            ruleLift += 1;
            placed = true;
            break;
          }
        }
        if (placed) { break; }
      }
      if (placed) { break; }
    }
    if (!placed) { break; }
  }
  report.rule = rule;
  report.rule_lift = ruleLift;
  // The fit.
  world = compile(doc, model);
  const res = P.check(Object.assign({}, doc, { works: [] }), model, null, readJSON(path.join(V2, "grounds", slug + ".json"), null), { bytes: 0, today: TODAY });
  report.errors = res.errors.slice(0, 12);
  const reached = reachedSet(world);
  let roomA = 0, reachA = 0, footA = 0, onA = 0, nRooms = 0, nReached = 0;
  report.floors = [];
  world.floors.forEach(fl => {
    const b = building(model, cell, turn, fl.z, 0);
    let ra = 0, rn = 0;
    const touched = new Set();
    fl.rooms.forEach(r => {
      if (r.pseudo || r.kind === "closed") { return; }
      nRooms += 1;
      const k = fl.index + ":" + r.index;
      const pts = samples(doc.floors[fl.index].rooms.find(x => x.id === r.id).poly, 1.5);
      let on = 0;
      const tally = {};
      if (b) { pts.forEach(p => { const t = b.part(p[0], p[1]); if (t >= 0) { on += 1; tally[t] = (tally[t] || 0) + 1; } }); }
      // The parts of the model the mapped rooms are in: the museum's buildings, as OpenStreetMap has them.
      Object.keys(tally).forEach(t => { if (tally[t] >= 0.25 * pts.length) { touched.add(+t); } });
      ra += r.area * on / pts.length;
      roomA += r.area;
      if (reached.has(k)) { reachA += r.area; nReached += 1; rn += 1; }
    });
    const fa = b ? b.area(touched) : 0;
    footA += fa;
    onA += Math.min(ra, fa);
    report.floors.push({ id: fl.id, lv: doc.floors[fl.index]._lv, z: fl.z, rooms: fl.rooms.filter(r => !r.pseudo).length, reached: rn,
                         cover: fa ? Math.min(1, ra / fa) : 0 });
  });
  report.rooms = nRooms;
  report.reached = nReached;
  report.cover = footA ? onA / footA : 0;
  report.reach = roomA ? reachA / roomA : 0;
  report.ok = !res.errors.length;
  if (res.errors.length) { report.why = "it does not check: " + res.errors.slice(0, 3).join("; "); }
  report.tier = res.tier;
  return { doc, report };
}

/* ---------------------------------------------------------------- the own mode */

function numbersOf(r) {
  const out = new Set();
  [r.id].concat(r.ref || []).forEach(k => {
    const m = /^(?:Gallery\s+|G-)?(\d+)$/i.exec(String(k || "").trim());
    if (m) { out.add(+m[1]); }
  });
  return out;
}

function ownMode(doc, slug, osm, model) {
  const report = {};
  const turn = (doc.grid && doc.grid.turn) || 0;
  let world = compile(doc, model);
  const before = reachedSet(world);
  report.reached_before = before.size;
  report.rooms = world.floors.reduce((a, fl) => a + fl.rooms.filter(r => !r.pseudo).length, 0);
  let doors = 0, lifts = 0, rule = 0;
  // OSM's doors between two of its rooms.
  doc.floors.forEach(f => {
    const add = (osm.opens || {})[f.id] || [];
    const have = new Set(f.open.map(o => [o.a, o.b].sort().join("|")));
    add.forEach(o => { if (!have.has([o.a, o.b].sort().join("|"))) { f.open.push(o); doors += 1; } });
  });
  for (let k = 0; k < 4; k += 1) { world = compile(doc, model); if (!dropFailing(doc, world)) { break; } }
  doors = doc.floors.reduce((a, f) => a + f.open.filter(o => (o.note || "").startsWith(MARK + ": a door")).length, 0);
  // Its lifts.
  world = compile(doc, model);
  const byLv = {};
  Object.keys(osm.levels || {}).forEach(lv => { const fl = world.floors.find(x => x.id === osm.levels[lv]); if (fl) { byLv[lv] = fl.index; } });
  const placed = [];
  (osm.lifts || []).forEach(l => {
    if (l.untagged || l.kind !== "lift") { return; }
    const fls = l.levels.filter(v => byLv[String(v)] !== undefined).map(v => byLv[String(v)]);
    if (fls.length < 2) { return; }
    const got = liftAt(Object.assign(world, { turn }), l.x, l.y, fls, 4, LIFT);
    if (!got) { return; }
    if (placed.some(o => Math.hypot(o[0] - got.rect[0], o[1] - got.rect[1]) < 6)) { return; }
    placed.push([got.rect[0], got.rect[1]]);
    const spec = { id: "lift-" + l.id, name: "Lift", rect: fileRect(turn, got.rect), floors: got.floors.map(fi => world.floors[fi].id),
                   sure: "reconstructed", src: ["osm-indoor"],
                   note: `${MARK}: a lift (${l.id}) on levels ${l.levels.join(";")}; its square ours, set in the room it lands in` };
    doc.floors[got.floors[0]].lifts = doc.floors[got.floors[0]].lifts || [];
    doc.floors[got.floors[0]].lifts.push(spec);
    lifts += 1;
  });
  // Inside each wing OSM maps as one room: its galleries joined by the rule, enough to join them all.
  (osm.groups || []).forEach(g => {
    g.levels.forEach(lv => {
      world = compile(doc, model);
      const fi = byLv[String(lv)];
      if (fi === undefined) { return; }
      const fl = world.floors[fi];
      const nums = new Set(g.nums);
      const members = new Set();
      fl.rooms.forEach(r => {
        if (r.pseudo || r.kind === "closed") { return; }
        const ns = numbersOf(r.spec);
        let hit = false;
        ns.forEach(n => { if (nums.has(n)) { hit = true; } });
        if (!hit) { return; }
        const cw = P.toWorld(turn, r.cx, r.cy);
        // Its middle inside the wing's outline, or within 15 m of it.
        let near = inPoly(g.poly, cw[0], cw[1]);
        if (!near) { near = g.poly.some(p => Math.hypot(p[0] - cw[0], p[1] - cw[1]) < 15); }
        if (near) { members.add(r.index); }
      });
      (report.groups = report.groups || []).push((g.name || g.id) + " L" + lv + ": " + members.size + " galleries");
      if (members.size < 2) { return; }
      for (let k = 0; k < members.size; k += 1) {
        world = compile(doc, model);
        const fl2 = world.floors[fi];
        const G = graph(world);
        // Components among the members, joined by the longest shared wall between two of them.
        const comps = {};
        members.forEach(m => { const c = G.find(fi + ":" + m); (comps[c] = comps[c] || []).push(m); });
        if (Object.keys(comps).length < 2) { break; }
        let best = null;
        contacts(fl2).forEach(c => {
          if (!members.has(c.a) || !members.has(c.b)) { return; }
          if (G.find(fi + ":" + c.a) === G.find(fi + ":" + c.b)) { return; }
          if (!best || c.len > best.len) { best = c; }
        });
        if (!best) { break; }
        const atW = P.toWorld(turn, best.at[0], best.at[1]);
        doc.floors[fi].open.push({ a: fl2.rooms[best.a].id, b: fl2.rooms[best.b].id, at: [r2(atW[0]), r2(atW[1])], w: DOOR, h: null,
          kind: "door", sure: "reconstructed", src: ["osm-indoor", "osm-rule"],
          note: `${MARK} maps both in one room, “${g.name || g.id}” (ref ${g.ref}): a doorway at the middle of the wall they share (${r2(best.len)} m), 2.4 m, by the rule` });
        rule += 1;
      }
    });
  });
  for (let k = 0; k < 4; k += 1) { world = compile(doc, model); if (!dropFailing(doc, world)) { break; } }
  world = compile(doc, model);
  // OpenStreetMap's entrances into its rooms: where one reaches far more of them than the way in the
  // file has (at least twice as many, ten more), it is the way in, said so.
  let after = reachedSet(world);
  const enterFl = doc.enter && world.floors.find(fl => fl.id === doc.enter.floor);
  const lvOf = {};
  Object.keys(osm.levels || {}).forEach(lv => { lvOf[osm.levels[lv]] = +lv; });
  if (enterFl) {
    let best = null;
    (osm.entrances || []).forEach(e => {
      if (e.tagged && e.levels.indexOf(lvOf[enterFl.id]) < 0) { return; }
      const g = P.toGrid(turn, e.x, e.y);
      // The room within 1.5 m of it.
      let near = null;
      const q0 = P.cellAt(enterFl, g[0], g[1]);
      if (q0 < 0) { return; }
      const R = Math.ceil(6 / enterFl.cell), i0 = q0 % enterFl.gw, j0 = Math.floor(q0 / enterFl.gw);
      for (let dj = -R; dj <= R; dj += 1) {
        for (let di = -R; di <= R; di += 1) {
          const q = (j0 + dj) * enterFl.gw + i0 + di;
          if (q < 0 || q >= enterFl.n || enterFl.room[q] < 0) { continue; }
          const r = enterFl.rooms[enterFl.room[q]];
          if (r.pseudo || r.kind === "closed" || r.kind === "void") { continue; }
          const d = Math.hypot(di, dj);
          if (!near || d < near.d) { near = { d, q, room: r }; }
        }
      }
      if (!near) { return; }
      const c = P.centreOf(enterFl, near.q);
      let ux = g[0] - c[0], uy = g[1] - c[1], L = Math.hypot(ux, uy);
      if (L < 0.3) { ux = g[0] - near.room.cx; uy = g[1] - near.room.cy; L = Math.hypot(ux, uy) || 1; }
      ux /= L; uy /= L;
      const at = [g[0] + ux * 2.5, g[1] + uy * 2.5];
      const atW = P.toWorld(turn, at[0], at[1]), mw = P.toWorld(turn, -ux, -uy);
      const gap = Math.hypot(g[0] - c[0], g[1] - c[1]);
      const named = `${e.id}${e.main ? ", entrance=main" : ""}${e.name ? ", " + e.name : ""}`;
      let open;
      if (gap <= 1.5) {
        open = { a: near.room.id, b: "outside", at: [r2(e.x), r2(e.y)], w: DOOR, h: null, kind: "door", sure: "reconstructed", src: ["osm-indoor"],
                 note: `${MARK}: the building's entrance here (${named}), into the room it opens on; its width ours` };
      } else {
        // The entrance stands off the nearest drawn room: a passage from the room to it, along the
        // axis they lie most apart on, through what no source shows between them.
        const ax = Math.abs(g[0] - c[0]) >= Math.abs(g[1] - c[1]), h2 = DOOR / 2;
        const end = ax ? [g[0] + Math.sign(g[0] - c[0]) * 0.75, c[1]] : [c[0], g[1] + Math.sign(g[1] - c[1]) * 0.75];
        const cutG = ax ? [Math.min(c[0], end[0]), c[1] - h2, Math.max(c[0], end[0]), c[1] + h2] : [c[0] - h2, Math.min(c[1], end[1]), c[0] + h2, Math.max(c[1], end[1])];
        open = { a: near.room.id, b: "outside", cut: fileRect(turn, cutG), h: null, kind: "door", sure: "reconstructed", src: ["osm-indoor", "osm-rule"],
                 note: `${MARK}: the building's entrance (${named}) stands ${r2(gap)} m from the nearest room drawn, ${near.room.id}: a passage cut from it to the room, through what no source shows between them; ours` };
      }
      const enter = { floor: enterFl.id, at: [r2(atW[0]), r2(atW[1])], face: r2((Math.atan2(mw[0], -mw[1]) * 180 / Math.PI + 360) % 360),
                      door: [r2(e.x), r2(e.y)], out: [fileRect(turn, [Math.min(at[0], g[0], c[0]) - 1.5, Math.min(at[1], g[1], c[1]) - 1.5, Math.max(at[0], g[0], c[0]) + 1.5, Math.max(at[1], g[1], c[1]) + 1.5])], sure: "reconstructed", src: ["osm-indoor"],
                      note: `${MARK}: the building's entrance${e.main ? " (entrance=main)" : ""}${e.name ? ", " + e.name : ""}, node ${e.id}; it reaches more of the rooms than the way in the file had (${doc.enter.note || "its own"})` };
      const trial = clone(doc);
      trial.floors.find(f => f.id === enterFl.id).open.push(open);
      trial.enter = enter;
      const w = compile(trial, model);
      const tq = w.enter ? P.cellAt(w.floors[w.enter.floor], w.enter.x, w.enter.y) : -1;
      (report.entrance_tries = report.entrance_tries || []).push([e.id, r2(gap), w.problems.length ? w.problems[0].text : "ok", w.enter ? P.walkable(w.floors[w.enter.floor], tq) : null, reachedSet(w).size]);
      if (w.problems.length) { return; }
      const got = reachedSet(w).size;
      if (!best || got > best.got) { best = { got, open, enter }; }
    });
    report.entrance_best = best ? best.got : null;
    if (best && best.got >= 2 * after.size && best.got >= after.size + 5) {
      doc.floors.find(f => f.id === enterFl.id).open.push(best.open);
      doc.enter = best.enter;
      report.entered = best.enter.note;
      world = compile(doc, model);
      after = reachedSet(world);
    }
  }
  report.reached_after = after.size;
  report.doors = doors;
  report.lifts = lifts;
  report.rule = doc.floors.reduce((a, f) => a + f.open.filter(o => (o.note || "").startsWith(MARK + " maps both")).length, 0);
  report.added = report.doors + report.lifts + report.rule;
  const res = P.check(Object.assign({}, doc, { works: [] }), model, null, readJSON(path.join(V2, "grounds", slug + ".json"), null), { bytes: 0, today: TODAY });
  report.errors = res.errors.slice(0, 12);
  report.ok = !res.errors.length;
  return { doc, report };
}

function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const { doc, slug, mode, osm } = input;
  const model = readJSON(path.join(V2, "models", slug + ".json"), null);
  if (!model) { process.stdout.write(JSON.stringify({ doc, report: { ok: false, why: "no model" } })); return; }
  doc.floors.forEach(f => { f.open = f.open || []; f.lifts = f.lifts || []; f.stairs = f.stairs || []; f.things = f.things || []; });
  const out = mode === "own" ? ownMode(doc, slug, osm, model) : roomsMode(doc, slug, osm, model);
  process.stdout.write(JSON.stringify(out));
}

main();

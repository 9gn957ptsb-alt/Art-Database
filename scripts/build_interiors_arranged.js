#!/usr/bin/env node
/* Arranged interiors: galleries the site lays out inside a museum's walls, where no plan of the
   museum has been read — so that every major museum can be walked, with the saved works on its
   walls, before its own rooms are known (INTERIORS.md, "Arranged").

   The artist, 7 Oct 2026, of MoMA's shell walk: "Focus on building the walkable models for all
   major museums in major cities. I want to be able to walk up to an artwork inside the museum and
   click on it and learn about it." A shell is bare earth inside the model's walls, and no work
   hangs in it; this pass puts rooms in, by a stated rule, and hangs the works by another — every
   room, doorway, floor, stair and work of it marked `sure: "arranged"` and saying so, never
   called by a gallery name of the museum's, and never in a museum whose own rooms are drawn.

   The rule, in the model's own walls (the footprint at each floor's eye height, as the walk
   reads it — the page's own models.js and walk-plan.js run here in a vm):
     the grid      turned to the building's main walls (the turn that fits the footprint in the
                   least rectangle), at the stub's cell;
     the floors    the museum's own count where a source read gives it (FLOORS, below, each with
                   its source), else as many 5 m storeys as the model stands over most of its
                   ground floor, three at most; each floor's rooms only where the model is;
     the rooms     a hall along the long axis (6-10 m wide, where the building is 26 m deep or
                   more), bays either side in ranks of about 12 m deep and 10-14 m along it,
                   each the largest rectangle of its bay inside the walls; doorways on the hall,
                   between neighbours along a rank (the enfilade) and from an outer rank to the
                   inner, 2.4 m wide at the middle of the wall they share;
     the way in    the shell's own door (the middle of the model's longest south-facing wall),
                   into the room behind it;
     up and down   a straight stair down the middle of the hall where the hall is long enough,
                   else a lift in a room on both floors;
     the works     every saved work the museum holds that its own records do not place in a
                   room drawn (its `how` none or elsewhere; never one its record says is off
                   view), then the works the museum showed ("Also here": places/<city>.json, its
                   venue), each group by period, then artist, then date, filling the rooms in
                   walking order from the door, one work to every 2.5 m of a run of wall, a new
                   room at a new period; `how: "arranged"`, what the record said kept in `rec`;
     the names     Room 1, Room 2 … in walking order; the hall is Hall. Never a museum's own.

   Run after build_interiors.py (which rewrites the works from the museums' records): with no
   argument it re-hangs the works of every arranged museum and lays out every shell left (the targets first).

     node scripts/build_interiors_arranged.js                 the targets (TARGETS) and re-hangs
     node scripts/build_interiors_arranged.js --only slug,slug
     node scripts/build_interiors_arranged.js --works         re-hang the arranged museums only
     node scripts/build_interiors_arranged.js --all           every museum whose rooms no source gives
     node scripts/build_interiors_arranged.js --dry           say what it would write

   Public files only (museums.json, models/, interiors/, histories/, places/, cities.json); never
   data/. A museum whose rooms a source gives (documented or reconstructed), or that the
   museums' own data draws (the National Gallery of Art, the Met, the Art Institute, Cleveland),
   or whose rooms OpenStreetMap's indoor mapping draws (build_interiors.py --osm took its plan:
   then only the works no record places are hung in its galleries, by the same rule), is never
   arranged. The same bytes every run on the same inputs, but for
   the day's date. */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const OUT = path.join(V2, "interiors");
const OSM_INDOOR = path.join(ROOT, "osm", "indoor");
const TODAY = new Date().toISOString().slice(0, 10);

// The museums whose own open data draws their rooms (build_interiors.py's passes): never arranged.
const OWN_DATA = new Set([
  "museum-national-gallery-of-art-washington-dc", "museum-the-metropolitan-museum-of-art",
  "museum-art-institute-of-chicago", "museum-cleveland-museum-of-art"]);

// The major museums in major cities (the skyline cities first) and the great European ones, by
// saved works held and fame: the ones laid out by default.
const TARGETS = [
  // New York, Washington, San Francisco, Los Angeles, Boston, Chicago, Houston, Seattle, Philadelphia
  "museum-the-museum-of-modern-art", "museum-guggenheim-museum", "museum-whitney-museum-of-american-art-1",
  "museum-new-museum-1", "museum-cooper-hewitt-smithsonian-design-museum", "museum-the-studio-museum-in-harlem",
  "museum-el-museo-del-barrio", "museum-grey-art-gallery", "museum-dia-art-foundation",
  "museum-phillips-collection", "museum-smithsonian-freer-and-sackler-galleries",
  "museum-national-museum-of-women-in-the-arts",
  "museum-san-francisco-museum-of-modern-art-sfmoma", "museum-de-young-museum", "museum-legion-of-honor",
  "museum-j-paul-getty-museum", "museum-los-angeles-county-museum-of-art", "museum-hammer-museum", "museum-the-broad",
  "museum-museum-of-fine-arts-boston", "museum-isabella-stewart-gardner-museum",
  "museum-mca-chicago", "museum-contemporary-arts-museum-houston", "museum-the-menil-collection",
  "museum-seattle-art-museum", "museum-frye-art-museum", "museum-philadelphia-museum-of-art",
  // London, Paris, Amsterdam, Madrid, Berlin, Brussels, Copenhagen, Milan
  "museum-the-national-gallery-london", "museum-tate-britain", "museum-british-museum",
  "museum-victoria-and-albert-museum-v-and-a", "museum-the-courtauld-gallery", "museum-national-portrait-gallery",
  "museum-the-wellington-museum", "museum-ben-uri-gallery-and-museum",
  "museum-centre-pompidou", "museum-musee-dorsay", "museum-musee-du-louvre", "museum-musee-picasso-paris",
  "museum-fondation-louis-vuitton", "museum-musee-rodin", "museum-musee-du-petit-palais",
  "museum-van-gogh-museum", "museum-rijksmuseum", "museum-stedelijk-museum-amsterdam",
  "museum-museo-nacional-del-prado", "museum-museo-reina-sofia", "museum-museo-thyssen-bornemisza",
  "museum-alte-nationalgalerie", "museum-gemaldegalerie-alte-meister",
  "museum-centre-for-fine-arts-bozar", "museum-musee-dixelles",
  "museum-statens-museum-for-kunst", "museum-faurschou-foundation",
  "museum-triennale-design-museum", "museum-padiglione-darte-contemporanea-pac", "museum-pinacoteca-di-brera",
  // The great European museums elsewhere
  "museum-kroller-muller-museum", "museum-guggenheim-museum-bilbao", "museum-belvedere-museum",
  "museum-kunstmuseum-basel", "museum-musei-vaticani", "museum-the-state-hermitage-museum",
  "museum-pushkin-museum-of-fine-arts", "museum-louisiana-museum-of-modern-art", "museum-moderna-museet",
  "museum-tate-liverpool", "museum-turner-contemporary", "museum-museum-ludwig", "museum-museum-brandhorst",
  "museum-kunstmuseum-bern", "museum-ordrupgaard", "museum-museum-folkwang", "museum-galleria-dell-accademia",
  "museum-galleria-nazionale-d-arte-moderna-rome", "museum-frans-halsmuseum", "museum-middelheim-museum"
];

/* The museum's own floors, where a source read gives them: how many floors its galleries take,
   and (where known) the storey. Each with its source, quoted. A museum not here has its floors by
   the rule (the model's height, 5 m a storey, three at most), said so in its notes. */
const FLOORS = {};

const STOREY = 5.0;          // m: a storey by the rule
const RULE_MAX = 3;          // floors at most by the rule
const MODULE = 12;           // m: a room along the hall, by the rule (10-14)
const SPINE_FROM = 26;       // m: a building at least this deep has a hall down its long axis
const MIN_SIDE = 5;          // m: no room narrower than this
const DOOR = 2.4;            // m: a doorway's width, by the rule
const SHARE = 3.0;           // m: the least wall two rooms share for a doorway between them
const STAIR_W = 2.4;         // m: a stair's width
const LIFT = 2.5;            // m: a lift's side

const SAID_ROOM = "Where the museum hangs these is not known: the rooms are arranged by the site inside its walls";
const SAID_HALL = "Where the museum's halls are is not known: this hall is arranged by the site inside its walls";

function readJSON(p, dflt) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return dflt; }
}
function r2(v) { return Math.round(v * 100) / 100; }

// The page's own code, in a context of its own (as scripts/check_interior.js has it).
function pageCode() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  for (const f of ["models.js", "walk-plan.js"]) {
    vm.runInContext(fs.readFileSync(path.join(V2, f), "utf8"), sandbox, { filename: f });
  }
  return sandbox.window;
}

/* ---------------------------------------------------------------- the file, in build_interiors.py's layout */

const KEY_ORDER = ["slug", "v", "building", "grid", "sources", "from", "enter", "floors", "pins", "notes",
                   "works", "asof", "tier"];
const FLOOR_ORDER = ["id", "name", "z", "sure", "src", "note", "rooms", "open", "things", "stairs", "lifts"];

function dumps(x) { return JSON.stringify(x); }

function layoutText(doc) {
  const keys = KEY_ORDER.filter(k => k in doc).concat(Object.keys(doc).filter(k => !KEY_ORDER.includes(k)));
  const parts = keys.map(k => {
    const v = doc[k];
    if ((k === "sources" || k === "works") && Array.isArray(v) && v.length) {
      return `"${k}": [\n  ` + v.map(dumps).join(",\n  ") + "]";
    }
    if (k === "floors" && Array.isArray(v) && v.length) {
      const fl = v.map(f => {
        const fk = FLOOR_ORDER.filter(x => x in f).concat(Object.keys(f).filter(x => !FLOOR_ORDER.includes(x)));
        return "{" + fk.map(x => {
          const fv = f[x];
          if (["rooms", "open", "things", "stairs", "lifts"].includes(x) && Array.isArray(fv) && fv.length) {
            return `"${x}": [\n   ` + fv.map(dumps).join(",\n   ") + "]";
          }
          return `"${x}": ` + dumps(fv);
        }).join(",\n  ") + "}";
      });
      return '"floors": [\n  ' + fl.join(",\n  ") + "]";
    }
    return `"${k}": ` + dumps(v);
  });
  const text = "{" + parts.join(",\n ") + "}\n";
  JSON.parse(text);
  return text;
}

/* ---------------------------------------------------------------- the footprint */

// A floor of the model, at a level, as the walk reads it: the shell compiled there.
function shellAt(W, model, cell, turn, z) {
  return W.WalkPlan.compile({ slug: model.slug, v: 1, grid: { cell, turn }, enter: z ? { z } : null, floors: null },
                            model, { soil: null });
}

// The inside's parts at a floor (four-connected cells of foot 1), each a list of cells.
function partsOf(fl) {
  const gw = fl.gw, n = fl.n, part = new Int32Array(n).fill(-1), parts = [];
  for (let q = 0; q < n; q += 1) {
    if (fl.foot[q] !== 1 || part[q] >= 0) { continue; }
    const id = parts.length, list = [q];
    part[q] = id;
    for (let h = 0; h < list.length; h += 1) {
      const c = list[h], i = c % gw;
      const ns = [i > 0 ? c - 1 : -1, i < gw - 1 ? c + 1 : -1, c - gw, c + gw];
      for (const p of ns) {
        if (p >= 0 && p < n && fl.foot[p] === 1 && part[p] < 0) { part[p] = id; list.push(p); }
      }
    }
    parts.push(list);
  }
  return { part, parts };
}

// The museum: of the parts of a size (a tenth of the largest, 100 m² at least), the one nearest
// the model's middle, the museum's own point (the shell's rule: a model often holds neighbours).
function mainPart(W, world, fl) {
  const { part, parts } = partsOf(fl);
  if (!parts.length) { return null; }
  const largest = Math.max(...parts.map(p => p.length));
  const o = W.WalkPlan.toGrid(world, 0, 0);
  let best = -1, bd = Infinity;
  parts.forEach((p, m) => {
    if (p.length < 0.1 * largest || p.length * fl.cell * fl.cell < 100) { return; }
    let d = Infinity;
    for (const q of p) {
      const c = W.WalkPlan.centreOf(fl, q);
      d = Math.min(d, (c[0] - o[0]) ** 2 + (c[1] - o[1]) ** 2);
    }
    if (d < bd) { bd = d; best = m; }
  });
  if (best < 0) { best = parts.findIndex(p => p.length === largest); }
  return { part, parts, main: best };
}

// The turn of the grid that fits the main part in the least rectangle (0 where it fits as well).
function bestTurn(W, model, cell) {
  const world = shellAt(W, model, cell, 0, 0), fl = world.floors[0];
  if (!fl) { return 0; }
  const mp = mainPart(W, world, fl);
  if (!mp) { return 0; }
  const pts = mp.parts[mp.main].map(q => W.WalkPlan.centreOf(fl, q));
  function area(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) {
      const gx = p[0] * c + p[1] * s, gy = -p[0] * s + p[1] * c;
      if (gx < x0) { x0 = gx; } if (gx > x1) { x1 = gx; }
      if (gy < y0) { y0 = gy; } if (gy > y1) { y1 = gy; }
    }
    return (x1 - x0) * (y1 - y0);
  }
  let best = 0, ba = area(0);
  for (let d = -45; d < 45; d += 1) { const v = area(d); if (v < ba - 1e-9) { ba = v; best = d; } }
  for (let d = best - 1; d <= best + 1; d += 0.25) { const v = area(d); if (v < ba - 1e-9) { ba = v; best = d; } }
  // Kept square to the model where turning gains less than 3%.
  return area(0) <= ba * 1.03 ? 0 : Math.round(best * 4) / 4;
}

/* ---------------------------------------------------------------- the levels */

// A floor's mask on the shared grid (the cells of the museum's inside there), and its area.
function levelMask(W, model, cell, turn, z, G, keepNear) {
  const world = shellAt(W, model, cell, turn, z), fl = world.floors[0];
  const mask = new Uint8Array(G.w * G.h);
  if (!fl) { return { mask, area: 0 }; }
  const mp = mainPart(W, world, fl);
  if (!mp) { return { mask, area: 0 }; }
  const di = Math.round((fl.x0 - G.x0) / cell), dj = Math.round((fl.y0 - G.y0) / cell);
  // The ground floor: its main part. Above it: every part that stands over the ground floor's.
  const keep = new Set();
  if (!keepNear) { keep.add(mp.main); }
  else {
    mp.parts.forEach((p, m) => {
      let over = 0;
      for (const q of p) {
        const i = q % fl.gw + di, j = Math.floor(q / fl.gw) + dj;
        if (i >= 0 && j >= 0 && i < G.w && j < G.h && keepNear[j * G.w + i]) { over += 1; }
      }
      if (over >= 0.5 * p.length && p.length * cell * cell >= 60) { keep.add(m); }
    });
  }
  // Only where the model stands high enough over the floor for a room: its roof less a voxel (the
  // walk's ceiling there) at least 2.4 m over it, so a walker has headroom under it.
  const vx = world.vox, P = W.WalkPlan;
  function tall(q) {
    if (!vx) { return true; }
    const c = P.centreOf(fl, q), mw = P.toWorld(world, c[0], c[1]);
    const ci = Math.floor((mw[0] + vx.site[0] / 2) / vx.v), cj = Math.floor((mw[1] + vx.site[1] / 2) / vx.v);
    if (ci < 0 || cj < 0 || ci >= vx.nx || cj >= vx.ny) { return false; }
    return vx.top[cj * vx.nx + ci] * vx.v >= z + 2.4;
  }
  let n = 0;
  keep.forEach(m => {
    for (const q of mp.parts[m]) {
      const i = q % fl.gw + di, j = Math.floor(q / fl.gw) + dj;
      if (i >= 0 && j >= 0 && i < G.w && j < G.h && tall(q)) { mask[j * G.w + i] = 1; n += 1; }
    }
  });
  return { mask, area: n * cell * cell, world };
}

/* ---------------------------------------------------------------- rectangles */

// The largest rectangle of mask cells within [i0, i1) × [j0, j1), as [i0, j0, i1, j1], or null.
function largestRect(mask, G, i0, j0, i1, j1) {
  const w = i1 - i0, hgt = new Int32Array(w);
  let best = null, ba = 0;
  for (let j = j0; j < j1; j += 1) {
    for (let i = i0; i < i1; i += 1) { hgt[i - i0] = mask[j * G.w + i] ? hgt[i - i0] + 1 : 0; }
    // The largest rectangle under the histogram of this row.
    const stack = [];
    for (let k = 0; k <= w; k += 1) {
      const h = k < w ? hgt[k] : 0;
      let start = k;
      while (stack.length && stack[stack.length - 1][1] >= h) {
        const [s, sh] = stack.pop();
        const a = sh * (k - s);
        if (a > ba) { ba = a; best = [i0 + s, j - sh + 1, i0 + k, j + 1]; }
        start = s;
      }
      stack.push([start, h]);
    }
  }
  return best;
}

function cellsIn(mask, G, r) {
  let n = 0;
  for (let j = r[1]; j < r[3]; j += 1) { for (let i = r[0]; i < r[2]; i += 1) { if (mask[j * G.w + i]) { n += 1; } } }
  return n;
}

/* ---------------------------------------------------------------- one floor's rooms */

// The bounds along the long axis (modules of 10-14 m) and the ranks across (a hall in the middle
// where the building is deep enough), in cells of the shared grid.
function splits(n, cell, target, lo, hi) {
  const len = n * cell;
  let k = Math.max(1, Math.round(len / target));
  while (len / k > hi) { k += 1; }
  while (k > 1 && len / k < lo) { k -= 1; }
  const out = [];
  for (let m = 0; m <= k; m += 1) { out.push(Math.round(m * n / k)); }
  return out;
}

function frame(mask, G, mod) {
  mod = mod || MODULE;
  let i0 = Infinity, i1 = -1, j0 = Infinity, j1 = -1;
  for (let j = 0; j < G.h; j += 1) {
    for (let i = 0; i < G.w; i += 1) {
      if (!mask[j * G.w + i]) { continue; }
      if (i < i0) { i0 = i; } if (i > i1) { i1 = i; }
      if (j < j0) { j0 = j; } if (j > j1) { j1 = j; }
    }
  }
  if (i1 < 0) { return null; }
  const cell = G.cell, W = (i1 - i0 + 1) * cell, H = (j1 - j0 + 1) * cell;
  const longX = W >= H;
  const nL = longX ? i1 - i0 + 1 : j1 - j0 + 1, nD = longX ? j1 - j0 + 1 : i1 - i0 + 1;
  const along = splits(nL, cell, mod, mod - 2, mod + 2).map(b => b + (longX ? i0 : j0));
  // Across: outer ranks, the hall, inner ranks.
  const D = nD * cell, ranks = [];
  const base = longX ? j0 : i0;
  if (D >= SPINE_FROM) {
    const hallW = Math.min(10, Math.max(6, D * 0.22)), hc = Math.round(hallW / cell);
    const side = Math.floor((nD - hc) / 2), sideM = side * cell;
    const ns = Math.max(1, Math.round(sideM / mod)) + (sideM / Math.max(1, Math.round(sideM / mod)) > mod + 3 ? 1 : 0);
    for (let m = 0; m < ns; m += 1) { ranks.push({ a: base + Math.round(m * side / ns), b: base + Math.round((m + 1) * side / ns), hall: false, side: -1, depth: ns - 1 - m }); }
    ranks.push({ a: base + side, b: base + side + hc, hall: true, side: 0, depth: -1 });
    const rest = nD - side - hc;
    for (let m = 0; m < ns; m += 1) { ranks.push({ a: base + side + hc + Math.round(m * rest / ns), b: base + side + hc + Math.round((m + 1) * rest / ns), hall: false, side: 1, depth: m }); }
  } else {
    const nr = Math.max(1, Math.round(D / mod));
    for (let m = 0; m < nr; m += 1) { ranks.push({ a: base + Math.round(m * nD / nr), b: base + Math.round((m + 1) * nD / nr), hall: false, side: 0, depth: m }); }
  }
  return { i0, i1, j0, j1, longX, along, ranks };
}

// The rooms of one floor on the shared frame: each module's largest rectangle inside the walls.
function roomsOf(mask, G, F) {
  const cell = G.cell, rooms = [];
  const minC = Math.ceil(MIN_SIDE / cell);
  F.ranks.forEach((rk, ri) => {
    const mods = [];
    for (let k = 0; k + 1 < F.along.length; k += 1) {
      const a0 = F.along[k], a1 = F.along[k + 1];
      const box = F.longX ? [a0, rk.a, a1, rk.b] : [rk.a, a0, rk.b, a1];
      const area = (box[2] - box[0]) * (box[3] - box[1]);
      const inside = cellsIn(mask, G, box);
      if (inside < 0.45 * area) { mods.push(null); continue; }
      const r = largestRect(mask, G, box[0], box[1], box[2], box[3]);
      if (!r) { mods.push(null); continue; }
      const w = r[2] - r[0], d = r[3] - r[1];
      const minSide = rk.hall ? Math.ceil(4 / cell) : minC;
      if (w < minSide || d < minSide || w * d < 0.4 * area) { mods.push(null); continue; }
      mods.push({ r, k, rank: ri, hall: rk.hall, full: r[0] === box[0] && r[1] === box[1] && r[2] === box[2] && r[3] === box[3] });
    }
    if (rk.hall) {
      // The hall: each run of whole modules is one; a module trimmed is a hall of its own.
      let run = null;
      mods.forEach(m => {
        if (m && m.full && run && run.full) {
          run.r = F.longX ? [run.r[0], run.r[1], m.r[2], run.r[3]] : [run.r[0], run.r[1], run.r[2], m.r[3]];
          run.k1 = m.k;
          return;
        }
        if (run) { rooms.push(run); }
        run = m ? Object.assign({ k1: m.k }, m) : null;
      });
      if (run) { rooms.push(run); }
    } else {
      mods.forEach(m => { if (m) { m.k1 = m.k; rooms.push(m); } });
    }
  });
  return rooms;
}

// Where two rooms meet: the shared stretch of their facing sides (a wall up to 2.5 m thick between
// them), or null: {axis 'x'|'y' (the wall's normal), at [i, j] (cells, the middle), len (m)}.
function meet(a, b, cell) {
  const A = a.r, B = b.r, maxGap = Math.floor(2.0 / cell);
  // a left of b, or b left of a
  for (const [L, R] of [[A, B], [B, A]]) {
    const gap = R[0] - L[2];
    if (gap >= 0 && gap <= maxGap) {
      const lo = Math.max(L[1], R[1]), hi = Math.min(L[3], R[3]);
      if ((hi - lo) * cell >= SHARE) { return { axis: "x", at: [(L[2] + R[0]) / 2, (lo + hi) / 2], len: (hi - lo) * cell, lo, hi }; }
    }
  }
  for (const [T, U] of [[A, B], [B, A]]) {
    const gap = U[1] - T[3];
    if (gap >= 0 && gap <= maxGap) {
      const lo = Math.max(T[0], U[0]), hi = Math.min(T[2], U[2]);
      if ((hi - lo) * cell >= SHARE) { return { axis: "y", at: [(lo + hi) / 2, (T[3] + U[1]) / 2], len: (hi - lo) * cell, lo, hi }; }
    }
  }
  return null;
}

// The doorways of a floor by the rule: every bay onto the hall; along each rank, neighbour to
// neighbour; an outer rank into the inner; with no hall, across at every other bay. Then any room
// still not reached is joined to a reached neighbour; any that cannot be, dropped.
function doorsOf(rooms, F, cell, start) {
  const doors = [], key = new Set();
  function add(a, b, m) {
    const k = Math.min(a, b) + ":" + Math.max(a, b);
    if (key.has(k)) { return; }
    key.add(k);
    doors.push({ a, b, m });
  }
  const hall = F.ranks.findIndex(r => r.hall);
  const last = F.along.length - 2;
  for (let x = 0; x < rooms.length; x += 1) {
    for (let y = x + 1; y < rooms.length; y += 1) {
      const A = rooms[x], B = rooms[y];
      const m = meet(A, B, cell);
      if (!m) { continue; }
      // Neighbours along the long axis (the wall between them runs across it), or side by side across it.
      const along = (m.axis === "x") === F.longX;
      if (A.hall && B.hall) { add(x, y, m); continue; }                 // a hall's pieces, end to end
      if (A.hall || B.hall) { if (!along) { add(x, y, m); } continue; } // every bay onto the hall
      if (A.rank === B.rank && along) { add(x, y, m); continue; }       // the enfilade
      if (A.rank !== B.rank && !along) {
        const rA = F.ranks[A.rank], rB = F.ranks[B.rank];
        if (hall >= 0 && rA.side === rB.side) { add(x, y, m); continue; }   // an outer rank into the inner
        const k = Math.min(A.k, B.k);
        if (hall < 0 && (k % 2 === 0 || k === last)) { add(x, y, m); }     // no hall: across at every other bay
      }
    }
  }
  // Every room reached from the first (the one the way in opens into).
  for (let pass = 0; pass < 3; pass += 1) {
    const seen = reached(rooms.length, doors, start);
    if (seen.every(Boolean)) { break; }
    let joined = false;
    for (let x = 0; x < rooms.length && !joined; x += 1) {
      if (seen[x]) { continue; }
      for (let y = 0; y < rooms.length; y += 1) {
        if (!seen[y]) { continue; }
        const m = meet(rooms[x], rooms[y], cell);
        if (m) { add(x, y, m); joined = true; break; }
      }
    }
    if (!joined) { break; }
  }
  return doors;
}

function reached(n, doors, start) {
  const seen = new Array(n).fill(false);
  if (start < 0 || start >= n) { return seen; }
  const stack = [start];
  seen[start] = true;
  while (stack.length) {
    const x = stack.pop();
    doors.forEach(d => {
      const o = d.a === x ? d.b : d.b === x ? d.a : -1;
      if (o >= 0 && !seen[o]) { seen[o] = true; stack.push(o); }
    });
  }
  return seen;
}

/* ---------------------------------------------------------------- the way in */

// The way in: a room of the ground floor with a side to the outside through a wall of 2.5 m at
// most, and open ground before it (4 m out, 3 m across) — of those, the side facing south (within
// 60°, as the shell's rule has it), the longest, nearest the shell's own door. {room, at (the
// opening, in the grid), door, stand, a (facing in), out ([x0, y0, x1, y1] in the grid)} or null.
function wayIn(W, model, cell, turn, G, rooms) {
  const P = W.WalkPlan;
  const world = shellAt(W, model, cell, turn, 0), fl = world.floors[0], e = world.enter;
  if (!fl) { return null; }
  // Open ground on the shared grid: outside the footprint at eye height.
  const ground = new Uint8Array(G.w * G.h);
  const di = Math.round((fl.x0 - G.x0) / cell), dj = Math.round((fl.y0 - G.y0) / cell);
  for (let q = 0; q < fl.n; q += 1) {
    if (fl.foot[q] !== 0) { continue; }
    const i = q % fl.gw + di, j = Math.floor(q / fl.gw) + dj;
    if (i >= 0 && j >= 0 && i < G.w && j < G.h) { ground[j * G.w + i] = 1; }
  }
  const isGround = (i, j) => i >= 0 && j >= 0 && i < G.w && j < G.h && ground[j * G.w + i] === 1;
  const sv = P.toGrid(turn, 0, 1);                                    // south, in the grid
  const shellDoor = e && e.door ? e.door : null;
  // The wall: 2.5 m at most, or where the model is drawn coarser, its voxel and a half (a model of
  // 4.5 m voxels has a wall 4.5 m thick: the way in is cut through it, and the cut says so).
  const vox = world.vox ? world.vox.v : 1;
  const thick = Math.round(Math.max(2.5, vox * 1.5) / cell), deep = Math.round(4 / cell), half = Math.ceil(1.5 / cell);
  let best = null;
  rooms.forEach((rm, x) => {
    const r = rm.r;
    // Each side: its outward normal (cells), the first cell beyond it, and its run of cells along.
    const sides = [
      { n: [1, 0], at: (t) => [r[2], t], lo: r[1], hi: r[3] },
      { n: [-1, 0], at: (t) => [r[0] - 1, t], lo: r[1], hi: r[3] },
      { n: [0, 1], at: (t) => [t, r[3]], lo: r[0], hi: r[2] },
      { n: [0, -1], at: (t) => [t, r[1] - 1], lo: r[0], hi: r[2] }];
    sides.forEach(sd => {
      const len = (sd.hi - sd.lo) * cell;
      if (len < 4) { return; }
      const facing = sd.n[0] * sv[0] + sd.n[1] * sv[1];
      // From the middle of the side outward along it, the first place with a thin wall and ground before it.
      const mid = Math.floor((sd.lo + sd.hi) / 2);
      let found = false;
      for (let s = 0; s <= (sd.hi - sd.lo) / 2 - half - 1 && !found; s += 1) {
        for (const t of s ? [mid - s, mid + s] : [mid]) {
          const c0 = sd.at(t);
          let k = 0;
          while (k <= thick && !isGround(c0[0] + sd.n[0] * k, c0[1] + sd.n[1] * k)) { k += 1; }
          if (k > thick || k < 1) { continue; }
          // Open ground a step beyond the wall's face (a wall a little stepped on a turned grid is
          // still the wall), out to where a visitor stands, across a doorway's width.
          let open = true;
          for (let a = 2; a < deep && open; a += 1) {
            for (let b = -half + 1; b <= half - 1 && open; b += 1) {
              const ci = c0[0] + sd.n[0] * (k + a) + (sd.n[0] ? 0 : b), cj = c0[1] + sd.n[1] * (k + a) + (sd.n[1] ? 0 : b);
              if (!isGround(ci, cj)) { open = false; }
            }
          }
          if (!open) { continue; }
          // In the grid: the room's side, the wall's outer face, the middle of the doorway.
          const sx = G.x0 + (sd.n[0] > 0 ? r[2] : sd.n[0] < 0 ? r[0] : t + 0.5) * cell;
          const sy = G.y0 + (sd.n[1] > 0 ? r[3] : sd.n[1] < 0 ? r[1] : t + 0.5) * cell;
          const fx = sx + sd.n[0] * k * cell, fy = sy + sd.n[1] * k * cell;
          const dDoor = shellDoor ? Math.hypot(fx - shellDoor[0], fy - shellDoor[1]) : 0;
          const score = (facing >= 0.5 ? 1000 : facing > -0.5 ? 500 : 0) + Math.min(len, 30) - dDoor / 10 - s * cell / 4 + (rm.hall ? 5 : 0);
          if (!best || score > best.score) { best = { score, x, n: sd.n, k, s: [sx, sy], f: [fx, fy] }; }
          found = true;
          break;
        }
      }
    });
  });
  if (!best) { return null; }
  const n = best.n, f = best.f, s0 = best.s;
  const across = [-n[1], n[0]];
  function box(a0, a1, b0, b1, from) {
    const ends = [[a0, b0], [a1, b0], [a0, b1], [a1, b1]].map(u => [from[0] + across[0] * u[0] + n[0] * u[1], from[1] + across[1] * u[0] + n[1] * u[1]]);
    return [Math.min(...ends.map(p => p[0])), Math.min(...ends.map(p => p[1])), Math.max(...ends.map(p => p[0])), Math.max(...ends.map(p => p[1]))];
  }
  // The doorway: cut through the wall from the room's side to a cell past its face, 2.4 m wide
  // (the wall a turned grid steps is cut whole, not searched for); the ground before it from the
  // room's side (so whatever ground the stepped wall leaves by the door is the ground before it)
  // out 4 m past the face and 6 m across; standing 2 m out, facing in.
  const reach = best.k * cell + cell;
  return {
    room: best.x, cut: box(-DOOR / 2, DOOR / 2, 0, reach, s0),
    door: [f[0] - n[0] * cell / 2, f[1] - n[1] * cell / 2], stand: [f[0] + n[0] * 2, f[1] + n[1] * 2],
    a: Math.atan2(-n[1], -n[0]), out: [box(-3, 3, 0, best.k * cell + 4, s0)], thick: best.k * cell, world
  };
}

/* ---------------------------------------------------------------- up and down */

// A straight stair down the middle of a hall both floors have (its run a cell a riser, risers of
// 0.2 m at most), at one end for one floor and the other end for the next; else a lift in a room
// both floors have. Returns {stair} or {lift} in cells, or null.
function between(lo, hi, cell, used, prev) {
  const dz = hi.z - lo.z, n = Math.ceil(dz / 0.2 - 1e-9), run = n;           // cells along
  const wc = Math.round(STAIR_W / cell), pass = Math.ceil(1.0 / cell);
  const halls = (rs) => rs.filter(r => r.hall);
  for (const A of halls(lo.rooms)) {
    for (const B of halls(hi.rooms)) {
      const I = [Math.max(A.r[0], B.r[0]), Math.max(A.r[1], B.r[1]), Math.min(A.r[2], B.r[2]), Math.min(A.r[3], B.r[3])];
      const w = I[2] - I[0], d = I[3] - I[1];
      if (w <= 0 || d <= 0) { continue; }
      const longX = w >= d, L = longX ? w : d, Wd = longX ? d : w;
      if (L < run + 4 || Wd < wc + 2 * pass + 2) { continue; }
      // Down the middle of its width; at the end not taken by the stair below.
      const mid = longX ? Math.floor((I[1] + I[3] - wc) / 2) : Math.floor((I[0] + I[2] - wc) / 2);
      for (const end of used % 2 ? [1, 0] : [0, 1]) {
        const s0 = end ? (longX ? I[2] : I[3]) - 2 - run : (longX ? I[0] : I[1]) + 2;
        const rect = longX ? [s0, mid, s0 + run, mid + wc] : [mid, s0, mid + wc, s0 + run];
        const rise = longX ? (end ? "-x" : "+x") : (end ? "-y" : "+y");
        // Not over the stair that came up from below.
        if (lo.stairs.concat(lo.lifts || []).some(t => !(rect[2] <= t[0] || t[2] <= rect[0] || rect[3] <= t[1] || t[3] <= rect[1]))) { continue; }
        return { stair: { rect, rise, lo: A, hi: B } };
      }
    }
  }
  // A lift: in a room the two floors share, in its corner, a cell in from its walls — the shaft the
  // floor below's lift came up in, where it goes on up into a room, else another clear of it.
  const lc = Math.ceil(LIFT / cell);
  const meets = (a, t) => !(a[2] <= t[0] || t[2] <= a[0] || a[3] <= t[1] || t[3] <= a[1]);
  const inside = (a, rc) => a[0] >= rc[0] + 1 && a[1] >= rc[1] + 1 && a[2] <= rc[2] - 1 && a[3] <= rc[3] - 1;
  if (prev) {
    const A = lo.rooms.find(r => inside(prev, r.r)), B = hi.rooms.find(r => inside(prev, r.r));
    if (A && B && !lo.stairs.some(t => meets(prev, t))) { return { lift: { rect: prev, lo: A, hi: B } }; }
  }
  for (const A of lo.rooms) {
    for (const B of hi.rooms) {
      const I = [Math.max(A.r[0], B.r[0]), Math.max(A.r[1], B.r[1]), Math.min(A.r[2], B.r[2]), Math.min(A.r[3], B.r[3])];
      if (I[2] - I[0] < lc + 2 || I[3] - I[1] < lc + 2) { continue; }
      const rect = [I[0] + 1, I[1] + 1, I[0] + 1 + lc, I[1] + 1 + lc];
      if (lo.stairs.some(t => meets(rect, t)) || (prev && meets(rect, prev))) { continue; }
      return { lift: { rect, lo: A, hi: B } };
    }
  }
  return null;
}

/* ---------------------------------------------------------------- the works */

const PERIODS = [[0, 1400, "before 1400"], [1400, 1600, "1400-1599"], [1600, 1800, "1600-1799"],
                 [1800, 1860, "1800-1859"], [1860, 1900, "1860-1899"], [1900, 1945, "1900-1944"],
                 [1945, 1980, "1945-1979"], [1980, 3000, "since 1980"]];
function yearOf(y) { const m = /(\d{4})/.exec(String(y || "")); return m ? +m[1] : null; }
function periodOf(y) {
  const n = yearOf(y);
  if (n === null) { return PERIODS.length; }
  return PERIODS.findIndex(p => n >= p[0] && n < p[1]);
}
// An artist by their surname, for the order (the last word of the first name given).
function artistKey(a) {
  const first = String(a || "").split(/,| and /)[0].trim();
  const words = first.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return (words[words.length - 1] + " " + first).toLowerCase();
}
function order(a, b) {
  return periodOf(a.y) - periodOf(b.y) || artistKey(a.a).localeCompare(artistKey(b.a)) ||
         (yearOf(a.y) || 9999) - (yearOf(b.y) || 9999) || String(a.t).localeCompare(String(b.t)) || (a.id < b.id ? -1 : 1);
}

// A work's facts from its public history: title, artist, date, medium, picture, colours, size.
function factsOf(W, id) {
  const h = readJSON(path.join(V2, "histories", id + ".json"), null);
  if (!h) { return null; }
  const d = W.WalkPlan.dims(h.dimensions);
  const out = { t: h.title || "", a: (h.artists || []).join(", "), y: h.date || "", m: h.medium || "",
                i: h.image || "", c: h.c || [], cm: null, cmsrc: null };
  if (d && d.h) { out.cm = d.w ? [d.w, d.h].concat(d.d ? [d.d] : []) : [null, d.h]; out.cmsrc = "artsy"; }
  return { facts: out, hist: h };
}

// The works the museum showed and does not hold ("Also here"): its city's places file, its venue.
function alsoHere(slug, have) {
  const cities = readJSON(path.join(V2, "cities.json"), {}) || {};
  const town = (cities.towns || []).find(t => (t[6] || []).includes(slug));
  if (!town) { return []; }
  const pf = readJSON(path.join(V2, "places", town[0] + ".json"), null);
  if (!pf) { return []; }
  const venues = new Set();
  (pf.venues || []).forEach((v, i) => { if (v[1] === slug) { venues.add(i); } });
  const out = [], seen = new Set();
  (pf.works || []).forEach(r => {
    if (!venues.has(r[5]) || have.has(r[0]) || seen.has(r[0])) { return; }
    seen.add(r[0]);
    out.push({ id: r[0], kinds: r[8] || [], y0: r[6], y1: r[7] });
  });
  return out;
}

const KIND_WORD = { held: "Held", listed: "Listed", exhibited: "Shown", owned: "Owned", offered: "Offered",
                    sold: "Sold", made: "Made", written: "Written", other: "Here" };
function yearsText(a, b) {
  if (!a) { return b ? String(b) : ""; }
  if (!b || b === a) { return String(a); }
  return a + "–" + b;
}

/* ---------------------------------------------------------------- one museum */

function arrange(W, m, opts) {
  const slug = m.slug;
  const file = path.join(OUT, slug + ".json");
  const doc = readJSON(file, null);
  const model = readJSON(path.join(V2, "models", slug + ".json"), null);
  if (!doc || !model) { return { slug, skip: "no interior file or no model" }; }
  if (OWN_DATA.has(slug)) { return { slug, skip: "its own open data draws its rooms" }; }
  // Rooms OpenStreetMap's indoor mapping draws (build_interiors.py --osm took its plan): never laid
  // out again; only the works no record places are hung in its galleries, by the same rule.
  if (osmDrawn(doc)) { return hangInOSM(W, m, model, doc, opts); }
  const wasArranged = doc.tier === "arranged" || (doc.floors || []).some(f => f.sure === "arranged");
  if (doc.floors && doc.floors.length && !wasArranged) { return { slug, skip: "its rooms are drawn from a source (" + doc.tier + ")" }; }
  if (opts.worksOnly && !wasArranged) { return { slug, skip: "not arranged" }; }

  const cell = (doc.grid && doc.grid.cell) || 0.5;
  const museums = readJSON(path.join(V2, "museums.json"), {}).museums || [];
  const keep = wasArranged && (opts.worksOnly || !opts.relayout);
  // A new layout that comes out over the file's 96 KB is laid out again with larger rooms.
  let got = null;
  for (let grow = 0; grow <= 8; grow += 2) {
    got = build(grow);
    if (got.skip || keep || got.bytes <= 94 * 1024) { break; }
  }
  if (got.skip) { return got; }
  if (got.res.errors.length) { return { slug, skip: "it does not check: " + got.res.errors.slice(0, 4).join("; "), errors: got.res.errors }; }
  const { next, res, placed, layout } = got;
  next.tier = res.tier;
  const out = layoutText(next);
  if (opts.to) { fs.mkdirSync(opts.to, { recursive: true }); fs.writeFileSync(path.join(opts.to, slug + ".json"), out); }
  if (!opts.dry && !opts.to) { fs.writeFileSync(file, out); }
  const levels = next.floors.length, rooms = next.floors.reduce((a, f) => a + f.rooms.length, 0);
  return { slug, tier: res.tier, levels, rooms, hung: res.stats.hung, works: next.works.length,
           arranged: placed.count, also: placed.also, kb: Math.round(Buffer.byteLength(out) / 1024), warnings: res.warnings,
           turn: next.grid.turn, kept: !!layout.kept };

  function build(grow) {
    let layout;
    if (keep) {
      layout = { floors: JSON.parse(JSON.stringify(doc.floors)), enter: doc.enter, grid: doc.grid, notes: doc.notes, kept: true };
    } else {
      layout = lay(W, m, model, cell, grow);
      if (layout.error) { return { slug, skip: layout.error }; }
    }
    const next = Object.assign({}, doc, { grid: layout.grid, enter: layout.enter, floors: layout.floors });
    // The sources: the model, the rule, the histories (for the works shown here), the floors' source.
    const srcs = (doc.sources || []).filter(s => !["arranged", "histories"].includes(s.id) && !/^floors-/.test(s.id));
    srcs.push({ id: "arranged", t: "the site's arrangement: galleries laid out by rule inside the model's walls, where no plan of the museum has been read (INTERIORS.md, 'Arranged')", read: TODAY });
    const fsrc = FLOORS[slug];
    if (fsrc) { srcs.push(Object.assign({ id: "floors-" + slug.replace(/^museum-/, "").slice(0, 24) }, fsrc.src)); }
    next.sources = srcs;
    const placed = hangWorks(W, m, model, next, srcs);
    next.works = placed.works;
    if (placed.histories) { next.sources.push({ id: "histories", t: "the works' own histories on this site: when each was shown or held here", read: TODAY }); }
    next.notes = notesOf(layout, placed, fsrc);
    next.asof = TODAY;
    next.tier = "arranged";
    // Checked as the walk will have it; the tier is the checker's.
    const text = layoutText(next);
    if (opts.to) { fs.mkdirSync(opts.to, { recursive: true }); fs.writeFileSync(path.join(opts.to, slug + ".json"), text); }
    const bytes = Buffer.byteLength(text);
    const res = W.WalkPlan.check(JSON.parse(text), model, museums.find(x => x.slug === slug) || null,
                                 readJSON(path.join(V2, "grounds", slug + ".json"), null), { bytes, today: TODAY });
    if (res.errors.length && !(bytes > 96 * 1024 && !keep && grow < 8)) {
      return { slug, skip: "it does not check: " + res.errors.slice(0, process.env.DBG ? 40 : 4).join("; "), errors: res.errors };
    }
    return { next, res, placed, layout, bytes };
  }
}

// Whether a file's floors are OpenStreetMap's plan (build_interiors.py --osm), not the site's arrangement.
function osmDrawn(doc) {
  const fls = doc.floors || [];
  return fls.length > 0 && fls.every(f => (f.src || []).indexOf("osm-indoor") >= 0 && f.sure !== "arranged");
}

const OSM_HANG = "the site's hanging: where the museum hangs a work is not known, so the site hangs it in a gallery OpenStreetMap's indoor mapping draws, by the arranged rule (INTERIORS.md, 'Arranged')";

// A museum drawn from OpenStreetMap: its rooms kept as they are, the works no record places hung by the
// arranged rule in its galleries (kind gallery, reached from the way in), in walking order from the door.
function hangInOSM(W, m, model, doc, opts) {
  const slug = m.slug;
  const museums = readJSON(path.join(V2, "museums.json"), {}).museums || [];
  const next = JSON.parse(JSON.stringify(doc));
  const srcs = (doc.sources || []).filter(s => !["arranged", "histories"].includes(s.id) && !/^floors-/.test(s.id));
  srcs.push({ id: "arranged", t: OSM_HANG, read: TODAY });
  next.sources = srcs;
  const placed = hangWorks(W, m, model, next, srcs, { osm: true });
  next.works = placed.works;
  if (placed.histories) { next.sources.push({ id: "histories", t: "the works' own histories on this site: when each was shown or held here", read: TODAY }); }
  if (!placed.count) { next.sources = next.sources.filter(s => s.id !== "arranged"); }
  next.asof = TODAY;
  const text = layoutText(next);
  const bytes = Buffer.byteLength(text);
  const res = W.WalkPlan.check(JSON.parse(text), model, museums.find(x => x.slug === slug) || null,
                               readJSON(path.join(V2, "grounds", slug + ".json"), null), { bytes, today: TODAY });
  if (res.errors.length) { return { slug, skip: "it does not check: " + res.errors.slice(0, 4).join("; "), errors: res.errors }; }
  next.tier = res.tier;
  const out = layoutText(next);
  if (opts.to) { fs.mkdirSync(opts.to, { recursive: true }); fs.writeFileSync(path.join(opts.to, slug + ".json"), out); }
  if (!opts.dry && !opts.to) { fs.writeFileSync(path.join(OUT, slug + ".json"), out); }
  return { slug, tier: res.tier, levels: next.floors.length, rooms: next.floors.reduce((a, f) => a + f.rooms.length, 0),
           hung: res.stats.hung, works: next.works.length, arranged: placed.count, also: placed.also,
           kb: Math.round(Buffer.byteLength(out) / 1024), warnings: res.warnings, turn: next.grid.turn, kept: true, osm: true };
}

// The layout: the grid, the floors, the rooms, the doorways, the stairs, the way in.
function lay(W, m, model, cell, grow) {
  const P = W.WalkPlan;
  const turn = bestTurn(W, model, cell);
  const grid = { cell, turn };
  // The shared grid: wide enough for every floor.
  const g0 = shellAt(W, model, cell, turn, 0), f0 = g0.floors[0];
  if (!f0) { return { error: "the model has no floor" }; }
  const margin = 40;
  const G = { cell, x0: f0.x0 - margin * cell, y0: f0.y0 - margin * cell, w: f0.gw + 2 * margin, h: f0.gh + 2 * margin };
  const ground = levelMask(W, model, cell, turn, 0, G, null);
  if (ground.area < 120) { return { error: "the model's inside is too small to arrange (" + Math.round(ground.area) + " m²)" }; }
  // The floors: the museum's own count, else the rule.
  const fsrc = FLOORS[m.slug];
  const levels = [];
  const want = fsrc ? fsrc.n : RULE_MAX, storey = fsrc && fsrc.storey ? fsrc.storey : STOREY;
  for (let k = 0; k < want; k += 1) {
    const z = k * storey;
    const lv = k ? levelMask(W, model, cell, turn, z, G, ground.mask) : ground;
    if (k && (lv.area < 0.4 * ground.area || lv.area < 200)) { break; }
    levels.push({ k, z, mask: lv.mask, area: lv.area });
  }
  // Rooms of about 12 m; larger in a large museum, so that it keeps to some 140 rooms in all (the
  // file's 96 KB), and larger again where it would not.
  const total = levels.reduce((a, lv) => a + lv.area, 0);
  const mod = Math.min(24, Math.max(MODULE, Math.sqrt(total / 140)) + (grow || 0));
  const F = frame(ground.mask, G, mod);
  // Each floor's rooms on the shared frame.
  levels.forEach(lv => { lv.rooms = roomsOf(lv.mask, G, F); lv.stairs = []; });
  // The ground floor: the rooms its doorways hold together, the largest such group (by area),
  // and any the rule's doorways join to it; a part of the model standing apart is left out.
  {
    const lv = levels[0], n = lv.rooms.length;
    const doors = doorsOf(lv.rooms, F, cell, -1);
    const comp = new Int32Array(n).fill(-1);
    let best = -1, bestA = 0;
    for (let s = 0; s < n; s += 1) {
      if (comp[s] >= 0) { continue; }
      const seen = reached(n, doors, s);
      let a = 0;
      seen.forEach((v, x) => { if (v) { comp[x] = s; a += (lv.rooms[x].r[2] - lv.rooms[x].r[0]) * (lv.rooms[x].r[3] - lv.rooms[x].r[1]); } });
      if (a > bestA) { bestA = a; best = s; }
    }
    if (best < 0) { return { error: "no rooms fit inside the model's walls" }; }
    const seen = reached(n, doorsOf(lv.rooms, F, cell, best), best);
    lv.rooms = lv.rooms.filter((r, x) => seen[x]);
  }
  // The way in, on the ground floor.
  const way = wayIn(W, model, cell, turn, G, levels[0].rooms);
  if (!way) { return { error: "no room of its ground floor stands behind the shell's door" }; }
  // Up and down: from each floor to the next, where a stair or a lift can go.
  const ups = [];
  for (let n = 0; n + 1 < levels.length; n += 1) {
    const was = n && ups[n - 1] && ups[n - 1].lift ? ups[n - 1].lift.rect : null;
    const b = between(levels[n], levels[n + 1], cell, n, was);
    if (!b) { levels.length = n + 1; break; }
    if (b.stair) { levels[n + 1].stairs.push(b.stair.rect); } else { (levels[n + 1].lifts = levels[n + 1].lifts || []).push(b.lift.rect); }
    ups.push(b);
  }
  // The doorways of each floor: the ground floor's reached from the way in, each other floor's
  // from where its stair or lift comes up. Rooms not reached so are left out: not drawn.
  for (let n = 0; n < levels.length; n += 1) {
    const lv = levels[n];
    const arrive = n ? (ups[n - 1].stair ? ups[n - 1].stair.hi : ups[n - 1].lift.hi) : lv.rooms[way.room];
    const start = lv.rooms.indexOf(arrive);
    lv.doors = doorsOf(lv.rooms, F, cell, start);
    const seen = reached(lv.rooms.length, lv.doors, start);
    const leave = n + 1 < levels.length ? (ups[n].stair ? ups[n].stair.lo : ups[n].lift.lo) : null;
    if (leave && !seen[lv.rooms.indexOf(leave)]) {
      // The way up is in a room this floor's doorways do not reach: no floor above it is drawn.
      levels.length = n + 1;
      ups.length = n;
    }
    const idx = [];
    let k = 0;
    lv.rooms.forEach((r, x) => { idx[x] = seen[x] ? k++ : -1; });
    lv.rooms = lv.rooms.filter((r, x) => seen[x]);
    lv.doors = lv.doors.filter(d => seen[d.a] && seen[d.b]).map(d => Object.assign({}, d, { a: idx[d.a], b: idx[d.b] }));
    if (!n) { way.room = idx[way.room]; }
  }
  // In the file: ids by floor, rects in the model's frame.
  function toFile(rc) {          // a rect of cells → [x, y, w, d] (its first corner in the model's frame)
    const gx = G.x0 + rc[0] * cell, gy = G.y0 + rc[1] * cell;
    const mw = P.toWorld(turn, gx, gy);
    return [r2(mw[0]), r2(mw[1]), r2((rc[2] - rc[0]) * cell), r2((rc[3] - rc[1]) * cell)];
  }
  function pt(i, j) { const mw = P.toWorld(turn, G.x0 + i * cell, G.y0 + j * cell); return [r2(mw[0]), r2(mw[1])]; }
  function ptG(gx, gy) { const mw = P.toWorld(turn, gx, gy); return [r2(mw[0]), r2(mw[1])]; }
  const floors = levels.map((lv, n) => {
    const fid = "level-" + (n + 1);
    lv.id = fid;
    lv.rooms.forEach((r, x) => { r.id = "L" + (n + 1) + (r.hall ? "-H" : "-R") + String(x + 1).padStart(2, "0"); });
    return {
      id: fid, name: "Level " + (n + 1), z: r2(lv.z), sure: "arranged", src: ["arranged", "model"].concat(fsrc ? ["floors-" + m.slug.replace(/^museum-/, "").slice(0, 24)] : []),
      note: n ? "a floor " + r2(lv.z) + " m up, " + (fsrc ? "one of the museum's own floors (its source)" : "by the rule: 5 m a storey") + "; its rooms only where the model stands"
              : "the floor the way in opens on, at the model's ground",
      rooms: lv.rooms.map(r => ({ id: r.id, name: r.hall ? "Hall" : null, said: r.hall ? SAID_HALL : SAID_ROOM,
                                  kind: r.hall ? "hall" : "gallery", rect: toFile(r.r), sure: "arranged", src: ["arranged"] })),
      // Each doorway at the middle of the wall its rooms share, 2.4 m wide (narrower where they share less): the rule.
      open: lv.doors.map(d => Object.assign({ a: lv.rooms[d.a].id, b: lv.rooms[d.b].id, at: pt(d.m.at[0], d.m.at[1]) },
                                            d.m.len - 1.0 < DOOR ? { w: r2(d.m.len - 1.0) } : {}, { sure: "arranged", src: ["arranged"] })),
      things: [], stairs: [], lifts: []
    };
  });
  // The way in: a doorway cut from its room through the model's wall to the ground before it.
  const er = levels[0].rooms[way.room];
  function gRect(g) { const mw = P.toWorld(turn, g[0], g[1]); return [r2(mw[0]), r2(mw[1]), r2(g[2] - g[0]), r2(g[3] - g[1])]; }
  floors[0].open.push({ a: er.id, b: "outside", cut: gRect(way.cut), kind: "door", sure: "arranged", src: ["arranged", "model"],
                        note: "the way in by the rule: through the model's wall (" + r2(way.thick) + " m) from the room behind it, 2.4 m wide" });
  const out = (way.out || []).map(gRect);
  const enter = { floor: "level-1", at: ptG(way.stand[0], way.stand[1]), face: Math.round(P.compassOf(turn, way.a) * 10) / 10,
                  door: ptG(way.door[0], way.door[1]), out, sure: "arranged", src: ["arranged", "model"],
                  note: "a way in by the rule — of the walls of the model's ground floor that open on ground, one facing south, the longest, nearest the shell's own door: the museum's own door is not known here" };
  // Stairs and lifts, listed on the floor below; a lift that goes on up in the same shaft is one
  // lift, serving every floor it reaches.
  let shaft = null;
  ups.forEach((b, n) => {
    if (b.stair) {
      floors[n].stairs.push({ id: "S" + (n + 1), name: null, rect: toFile(b.stair.rect), rise: b.stair.rise,
                              from: floors[n].id, to: floors[n + 1].id, sure: "arranged", src: ["arranged"] });
      shaft = null;
    } else if (shaft && shaft.cells.join() === b.lift.rect.join()) {
      shaft.spec.floors.push(floors[n + 1].id);
    } else {
      shaft = { cells: b.lift.rect, spec: { id: "E" + (n + 1), name: null, rect: toFile(b.lift.rect), floors: [floors[n].id, floors[n + 1].id],
                                            sure: "arranged", src: ["arranged"] } };
      floors[n].lifts.push(shaft.spec);
    }
  });
  return { grid, enter, floors, levels: levels.length, stairs: ups.filter(b => b.stair).length,
           lifts: ups.filter(b => b.lift).length, rooms: floors.reduce((a, f) => a + f.rooms.length, 0),
           ruleFloors: !fsrc, turn };
}

/* ---------------------------------------------------------------- hanging */

// Every saved work its records do not place in a room drawn, then the works it showed; each group by
// period, artist, date; into the rooms in walking order, one to every 2.5 m of a run of wall.
function hangWorks(W, m, model, doc, srcs, how) {
  const osm = !!(how && how.osm);
  const P = W.WalkPlan;
  const world = P.compile(Object.assign({}, doc, { works: [] }), model, { soil: null });
  const before = (doc.works || []).filter(w => !w.also);
  // Every saved work museums.json gives it is held, even before build_interiors.py has listed it.
  const listed = new Set(before.map(w => w.id));
  (m.works || []).forEach(x => {
    if (listed.has(x.id)) { return; }
    before.push({ id: x.id, how: "none", said: "where it hangs has not been read yet", src: null, asof: TODAY });
    listed.add(x.id);
  });
  const have = new Set(before.map(w => w.id));
  // The rooms in walking order from the way in (the path's length to each room's middle).
  const rooms = [];
  world.floors.forEach(fl => fl.rooms.forEach(r => {
    if (r.pseudo || !r.reach) { return; }
    if (osm ? (r.spec && r.spec.anchor === "osm-indoor" && r.kind === "gallery") : r.sure === "arranged") { rooms.push(r); }
  }));
  const e = world.enter;
  rooms.forEach(r => {
    const p = P.path(world, { x: e.x, y: e.y, floor: e.floor }, { x: r.cx, y: r.cy, floor: r.floor });
    let L = 0;
    if (p) { for (let k = 1; k < p.length; k += 1) { L += p[k][2] === p[k - 1][2] ? Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]) : 4; } }
    r.walk = p ? L : Infinity;
    // What its walls hold by the rule: a work to every 2.5 m of each run.
    r.cap = (r.walls || []).reduce((a, w) => a + w.runs.reduce((b, u) => b + (u[1] - u[0] >= 1.2 ? Math.max(1, Math.floor((u[1] - u[0]) / 2.5)) : 0), 0), 0);
  });
  rooms.sort((a, b) => a.walk - b.walk || a.floor - b.floor || a.index - b.index);
  const galleries = rooms.filter(r => r.kind !== "hall" && r.walk < Infinity);
  // The works: the held first (the record's placement kept), then the shown.
  const held = [], shown = [];
  let histories = false;
  before.forEach(w => {
    // Never one another museum's own record places (it hangs there: `at`), one its record says is off
    // view, or the very object of another saved work (it hangs once, as that one).
    if (w.same || w.at || w.how === "museum" || w.how === "off") { return; }
    const base = w.how === "arranged" ? (w.rec ? Object.assign({}, w.rec) : { how: "none", said: "where it hangs has not been read yet", src: null }) : { how: w.how, said: w.said, src: w.src, asof: w.asof };
    let f = w.t ? { t: w.t, a: w.a, y: w.y, m: w.m, i: w.i, c: w.c, cm: w.cm, cmsrc: w.cmsrc } : (factsOf(W, w.id) || {}).facts;
    if (!f) {
      // No history on the site yet: what museums.json says of it (its picture's key without the size).
      const x = (m.works || []).find(v => v.id === w.id);
      if (!x) { return; }
      f = { t: x.t || "", a: x.a || "", y: x.y || "", m: x.m || "", i: String(x.i || "").split("/")[0], c: [], cm: null, cmsrc: null };
    }
    held.push({ w, rec: base, f });
  });
  alsoHere(m.slug, have).forEach(a => {
    const got = factsOf(W, a.id);
    if (!got) { return; }
    // What the history says happened here, in its own words.
    const ev = (got.hist.events || []).filter(x => x.m === m.slug && x.k !== "written");
    const first = ev[0] || null;
    shown.push({ also: a, f: got.facts, ev: first });
  });
  held.sort((x, y) => order(Object.assign({ id: x.w.id }, x.f), Object.assign({ id: y.w.id }, y.f)));
  shown.sort((x, y) => order(Object.assign({ id: x.also.id }, x.f), Object.assign({ id: y.also.id }, y.f)));
  // Into the rooms: a room fills to what its walls hold; a new period opens the next room once a
  // room holds three; the shown begin in a room of their own.
  const assign = new Map();
  let ri = 0, inRoom = 0, lastP = null;
  function place(id, f, fresh) {
    const p = periodOf(f.y);
    // A new group (the shown) starts a room of its own; a new period does once a room holds three.
    if (ri < galleries.length && inRoom > 0 && (fresh || (p !== lastP && inRoom >= 3))) { ri += 1; inRoom = 0; }
    while (ri < galleries.length && inRoom >= galleries[ri].cap) { ri += 1; inRoom = 0; }
    if (ri >= galleries.length) { return false; }
    assign.set(id, galleries[ri]);
    inRoom += 1;
    lastP = p;
    return true;
  }
  held.forEach(h => place(h.w.id, h.f, false));
  shown.forEach((s, n) => place(s.also.id, s.f, n === 0));
  // What the rule gave a room must hang there: a work its walls cannot take (too wide for a run)
  // goes on to the next room with room for it, else it is not hung.
  for (let pass = 0; pass < 4; pass += 1) {
    const trial = [];
    held.concat(shown).forEach(x => {
      const id = x.w ? x.w.id : x.also.id, r = assign.get(id);
      if (r) { trial.push(Object.assign({ id, how: "arranged", room: r.id, wall: null }, x.f, x.w && x.w.free ? { free: true } : {})); }
    });
    const res = P.hang(world, trial, {});
    if (!res.spill.length) { break; }
    const used = {};
    res.hung.forEach(h => { used[h.room + ":" + h.floor] = (used[h.room + ":" + h.floor] || 0) + 1; });
    res.spill.forEach(id => {
      const at = galleries.indexOf(assign.get(id));
      assign.delete(id);
      for (let k = at + 1; k < galleries.length; k += 1) {
        const g = galleries[k], n = Array.from(assign.values()).filter(v => v === g).length;
        if (n < g.cap) { assign.set(id, g); break; }
      }
    });
  }
  // The works, in the file: the arranged in the rule's order (which is how they hang).
  const works = [];
  const arrangedIds = new Set();
  let count = 0, also = 0;
  held.forEach(h => {
    const r = assign.get(h.w.id);
    if (!r) { return; }
    const rec = h.rec && (h.rec.src || h.rec.how === "elsewhere") ? h.rec : null;
    const w = { id: h.w.id, how: "arranged", room: r.id, wall: null,
                said: (rec && rec.how === "elsewhere" ? rec.said + "; " : "") + "where the museum hangs it is not known: the site has hung it here",
                src: "arranged", asof: TODAY };
    if (rec) { w.rec = { how: rec.how, said: rec.said, src: rec.src || null, asof: rec.asof || null }; }
    if (h.w.ref) { w.ref = h.w.ref; }
    Object.assign(w, h.f);
    if (h.w.free) { w.free = true; }
    if (h.w.cmk) { w.cmk = h.w.cmk; }
    works.push(w);
    arrangedIds.add(h.w.id);
    count += 1;
  });
  shown.forEach(s => {
    const r = assign.get(s.also.id);
    if (!r) { return; }
    const words = (s.also.kinds || []).map(k => KIND_WORD[k] || k).filter((x, i, all) => all.indexOf(x) === i).join(" · ");
    const yrs = yearsText(s.also.y0, s.also.y1);
    const w = { id: s.also.id, how: "arranged", room: r.id, wall: null,
                said: (words || "Here") + " here" + (yrs ? ", " + yrs : "") + ", its history says; it is not the museum's: the site has hung it here",
                src: "arranged", asof: TODAY, also: { k: s.also.kinds, y: [s.also.y0, s.also.y1] } };
    if (s.ev && s.ev.q) { w.also.q = s.ev.q; }
    Object.assign(w, s.f);
    works.push(w);
    arrangedIds.add(s.also.id);
    count += 1;
    also += 1;
    histories = true;
  });
  // The rest as they were (the record's placement; any arranged before and not now, back to its record).
  before.forEach(w => {
    if (arrangedIds.has(w.id)) { return; }
    if (w.how === "arranged") {
      const rec = w.rec || { how: "none", said: "where it hangs has not been read yet", src: null };
      const back = { id: w.id, how: rec.how, said: rec.said, src: rec.src || null, asof: rec.asof || TODAY };
      if (w.ref) { back.ref = w.ref; }
      works.push(back);
    } else { works.push(w); }
  });
  // Rooms named in walking order: Room 1, 2 … (a hall is Hall); a room's said says what hangs there.
  const byId = {};
  doc.floors.forEach(f => f.rooms.forEach(r => { byId[r.id] = r; }));
  let n = 0;
  rooms.forEach(r => {
    const spec = byId[r.id];
    if (!spec || spec.kind === "hall" || spec.sure !== "arranged") { return; }
    n += 1;
    spec.name = "Room " + n;
  });
  // Rooms not reached are left nameless (they are not reached: there are none by the rule).
  return { works, count, also, histories };
}

function notesOf(layout, placed, fsrc) {
  const floors = layout.floors.length;
  const parts = [
    "Arranged by the site (INTERIORS.md, 'Arranged'): no plan of the museum has been read, so its rooms are laid out by rule inside the model's walls — " +
    "a hall along its long axis where it is deep enough, bays of about 12 m either side, doorways on the hall and between neighbours, the way in at the shell's door (the middle of the model's longest south-facing wall). " +
    "None of it is the museum's plan: no room here is one of its galleries, and the walk's rooms are numbered, not named.",
    fsrc ? "Its floors: " + fsrc.said : "Its floors: " + floors + (floors === 1 ? " floor" : " floors") + " by the rule (5 m a storey, as many as the model stands over most of its ground floor, three at most): no source read gives the museum's own.",
    "The works: the saved works it holds that its records do not place in a room drawn, then the works it showed (its history), each by period, then artist, then date, " +
    "one to every 2.5 m of wall, in walking order from the door; " + placed.count + " hung so" + (placed.also ? ", " + placed.also + " of them shown here, not held" : "") + "."
  ];
  if (layout.notes && layout.kept) { return layout.notes.replace(/; \d+ hung so(, \d+ of them shown here, not held)?\.$/, "; " + placed.count + " hung so" + (placed.also ? ", " + placed.also + " of them shown here, not held" : "") + "."); }
  return parts.join(" ");
}

/* ---------------------------------------------------------------- the run */

function main() {
  const args = process.argv.slice(2);
  const arg = name => { const i = args.indexOf("--" + name); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
  const opts = { worksOnly: !!arg("works"), dry: !!arg("dry"), relayout: !!arg("relayout"), to: arg("to") || null };
  const W = pageCode();
  const museums = (readJSON(path.join(V2, "museums.json"), {}) || {}).museums || [];
  const bySlug = {};
  museums.forEach(x => { bySlug[x.slug] = x; });
  let slugs;
  if (arg("only")) { slugs = String(arg("only")).split(","); }
  else if (arg("all")) { slugs = museums.map(x => x.slug); }
  else {
    // The targets, every museum already arranged (its works re-hung) and every shell left (a new
    // museum's, from the intake): the artist's ask is every museum walkable with its works.
    const arranged = [], shells = [];
    museums.forEach(x => {
      const d = readJSON(path.join(OUT, x.slug + ".json"), {});
      if (d && (d.tier === "arranged" || (d.floors || []).some(f => f.sure === "arranged") || osmDrawn(d))) { arranged.push(x.slug); }
      else if (d && !(d.floors && d.floors.length)) { shells.push(x.slug); }
    });
    slugs = opts.worksOnly ? arranged : Array.from(new Set(TARGETS.concat(arranged, shells)));
  }
  const done = [];
  for (const slug of slugs) {
    const m = bySlug[slug];
    if (!m) { console.log(`  ${slug}: not in museums.json`); continue; }
    let r;
    try { r = arrange(W, m, opts); } catch (e) { r = { slug, skip: "failed: " + (e && e.stack || e) }; }
    done.push(r);
    if (r.skip) { console.log(`  ${slug}: left as it is — ${r.skip}`); continue; }
    console.log(`  ${slug}: ${r.tier}, ${r.levels} floor${r.levels === 1 ? "" : "s"}, ${r.rooms} rooms, turn ${r.turn}°; ` +
                `${r.arranged} works hung by the rule (${r.also} shown here), ${r.hung} hung in all; ${r.kb} KB${r.kept ? " (its rooms kept)" : ""}` +
                (r.warnings && r.warnings.length ? "\n      " + r.warnings.slice(0, 4).join("\n      ") : ""));
  }
  const ok = done.filter(r => !r.skip).length;
  console.log(`${ok} arranged${opts.dry ? " (dry run: nothing written)" : ""}; ${done.length - ok} left as they are.`);
}

if (require.main === module) { main(); }
module.exports = { arrange, pageCode, TARGETS, FLOORS, lay, shellAt, levelMask, frame, roomsOf, wayIn, bestTurn, mainPart, doorsOf, between };

#!/usr/bin/env node
/* The Architectural Authority's projects, taken apart: docs/worlds/rocket/sections.json.

   Every building of docs/v2/architecture.json the site has modelled
   (docs/v2/models/<slug>.json, written by hand from the article's
   photographs) is broken into the sections it is made of, so that Rocket can
   put them together again in new ways (docs/worlds/rocket/forms.js):

   - its volumes, each named by the space it is: the ground floor, a wing, a
     long wing, the block, the glass pavilion, the hall, the tower, a block's
     storeys, the upper box (cantilevered where it runs out two metres or more
     past what holds it up, on columns where only columns hold it), the
     lookout on the roof, a berm or a plinth, the room of an interior drawn as
     a cutaway; and by what it is made of;
   - its roofs: gabled, hipped, sloping, a slab, a dome, each a roof however
     many parts it is drawn in, its main part kept as a shape to be drawn
     again at any size;
   - its features, what makes it that building rather than a box: a screen of
     mesh, slats, fins, a colonnade, the edges of floors, a frame, a wall, a
     canopy, a pergola, a stair, a plinth, columns, a corten panel, a glass or
     curtain wall, a structure, both those that stand free and those a volume
     wears on its face (they stay on it, and are also kept apart);
   - its ground: the pool, the pond or the lake, the terrace, deck or court,
     the garden's trees and shrubs.

   The models carry no names for their parts, so the sections are read from
   the parts themselves: the big parts are the masses (masses with one
   footprint stacked, or one inside another, are one volume: a block's
   storeys, a glass band in its frame), every smaller part belongs to the
   mass it touches most, the rest stand free and are grouped by touch; a roof
   belongs to the volume it sits on; a cut to whatever it cuts. What each is
   called comes from where it stands and how: on the ground or on another
   volume, how far it runs out past it, how tall, how long, how glazed.

   Each section is filled in with the site's own models.js at a metre to the
   block (as Rocket stands it), cropped and run-length coded: one letter for
   what a block is (A for nothing, then the section's own materials), then how
   many in a row. Where it stood in its project is kept (o, its first block's
   corner in metres), so a project can be drawn taken apart and put together
   (forms.html). A bay repeated along a building is kept once, with how many
   times it comes (rep).

     node scripts/build_sections.js [--list] */

"use strict";

const fs = require("fs");
const path = require("path");
global.window = {};
require("../docs/v2/models.js");
const Models = window.Models;

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const OUT = path.join(ROOT, "docs", "worlds", "rocket", "sections.json");

const { min, max, abs, round, ceil, floor } = Math;
const GROUNDS = new Set(["soil", "grass", "drygrass", "plant", "lavender", "sage", "sand", "gravel", "paving", "water"]);
const PLANTS = new Set(["plant", "lavender", "sage"]);
const ROOFS = new Set(["gable", "hip", "shed", "dome"]);
const MAT = {
  concrete: "concrete", render: "rendered", white: "white", stone: "stone", limestone: "limestone", marble: "marble",
  rubble: "rubble stone", brick: "brick", palebrick: "pale brick", paintbrick: "painted brick", sandstone: "sandstone",
  tile: "tiled", bluetile: "blue-tiled", earth: "rammed earth", ochre: "ochre", yellow: "yellow", rose: "rose",
  wood: "wooden", timber: "timber", ebony: "black timber", thatch: "thatched", glass: "glass", mesh: "mesh", metal: "metal",
  steel: "steel", dark: "dark", slate: "slate", copper: "copper", corten: "corten", grass: "grass", drygrass: "meadow",
  paving: "paved", gravel: "gravel", sand: "sand", water: "water", plant: "planted", lavender: "lavender", sage: "sage", soil: "earthen"
};

/* ---- the parts ---------------------------------------------------------------- */

const TYPES = ["box", "cut", "pcut", "gable", "shed", "hip", "cyl", "dome", "blob", "pool", "tree", "prism", "mesh"];
function typeOf(p) { for (const k of TYPES) { if (p[k]) { return k; } } return null; }
function bboxOf(p) {
  const t = typeOf(p), a = p[t];
  switch (t) {
    case "box": case "cut": case "gable": case "shed": case "hip":
      return [a[0], a[1], a[2], a[0] + a[3], a[1] + a[4], a[2] + a[5] + (p.thick || 0)];
    case "cyl": return [a[0] - a[3], a[1] - a[3], a[2], a[0] + a[3], a[1] + a[3], a[2] + a[4]];
    case "dome": return [a[0] - a[3], a[1] - a[3], a[2], a[0] + a[3], a[1] + a[3], a[2] + a[3]];
    case "blob": return [a[0] - a[3], a[1] - a[4], a[2] - a[5], a[0] + a[3], a[1] + a[4], a[2] + a[5]];
    case "pool": { const z = a[4] || 0; return [a[0], a[1], z, a[0] + a[2], a[1] + a[3], z + 0.6]; }
    case "tree": { const z = a[4] || 0; return [a[0] - a[3], a[1] - a[3], z, a[0] + a[3], a[1] + a[3], z + a[2]]; }
    case "prism": case "pcut": {
      const xs = a.map(q => q[0]), ys = a.map(q => q[1]);
      return [min(...xs), min(...ys), p.z || 0, max(...xs), max(...ys), (p.z || 0) + (p.h || 0)];
    }
    case "mesh": {
      const v = a.v, b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
      for (let i = 0; i < v.length; i += 3) {
        b[0] = min(b[0], v[i]); b[1] = min(b[1], v[i + 1]); b[2] = min(b[2], v[i + 2]);
        b[3] = max(b[3], v[i]); b[4] = max(b[4], v[i + 1]); b[5] = max(b[5], v[i + 2]);
      }
      return b;
    }
  }
  return null;
}
const W = b => b[3] - b[0], D = b => b[4] - b[1], H = b => b[5] - b[2];
const plan = b => max(0, W(b)) * max(0, D(b));
const interPlan = (a, b) => max(0, min(a[3], b[3]) - max(a[0], b[0])) * max(0, min(a[4], b[4]) - max(a[1], b[1]));
const inter3 = (a, b) => interPlan(a, b) * max(0, min(a[5], b[5]) - max(a[2], b[2]));
const grow = (b, e) => [b[0] - e, b[1] - e, b[2] - e, b[3] + e, b[4] + e, b[5] + e];
const hits = (a, b, e) => { const g = grow(a, e); return g[0] < b[3] && b[0] < g[3] && g[1] < b[4] && b[1] < g[4] && g[2] < b[5] && b[2] < g[5]; };
const inside = (a, b, e) => a[0] >= b[0] - e && a[1] >= b[1] - e && a[2] >= b[2] - e && a[3] <= b[3] + e && a[4] <= b[4] + e && a[5] <= b[5] + e;
const joinB = (a, b) => [min(a[0], b[0]), min(a[1], b[1]), min(a[2], b[2]), max(a[3], b[3]), max(a[4], b[4]), max(a[5], b[5])];
const boundsOf = list => list.reduce((b, q) => (b ? joinB(b, q.b) : q.b.slice()), null);
// The face a part shows: its largest side.
const faceOf = b => max(W(b) * H(b), D(b) * H(b), W(b) * D(b));

function groups(list, join) {
  const uf = list.map((_, i) => i), find = i => (uf[i] === i ? i : (uf[i] = find(uf[i])));
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) { if (join(list[i], list[j])) { uf[find(i)] = find(j); } }
  }
  const out = new Map();
  list.forEach((q, i) => { const r = find(i); if (!out.has(r)) { out.set(r, []); } out.get(r).push(q); });
  return [...out.values()];
}
function dominant(list, weigh) {
  const w = {};
  list.forEach(q => { w[q.m] = (w[q.m] || 0) + weigh(q); });
  return Object.keys(w).sort((a, b) => w[b] - w[a])[0] || "concrete";
}

/* ---- what a group of free-standing or applied parts is -------------------------- */

function featureNoun(members) {
  const mats = new Set(members.map(q => q.m)), b = boundsOf(members);
  if (mats.has("mesh")) { return "screen"; }
  if (members.every(q => q.m === "glass")) { return H(b) >= 4 ? "curtain wall" : "glass wall"; }
  if (members.every(q => q.m === "corten")) { return "corten panel"; }
  const thin = q => min(W(q.b), D(q.b)) <= 0.7;
  const thinV = members.filter(q => thin(q) && H(q.b) >= 1.8);
  const thinH = members.filter(q => H(q.b) <= 0.6 && q.b[2] >= 1.8);
  if (thinV.length >= 4) {
    const along = W(b) >= D(b) ? 0 : 1, c = thinV.map(q => (q.b[along] + q.b[along + 3]) / 2).sort((x, y) => x - y);
    let gaps = 0;
    for (let i = 1; i < c.length; i += 1) { gaps += c[i] - c[i - 1]; }
    const spacing = gaps / max(1, c.length - 1), m = dominant(thinV, q => H(q.b));
    if (spacing >= 1.4 && ["concrete", "white", "stone", "limestone", "marble", "render", "brick", "palebrick"].includes(m)) { return "colonnade"; }
    return ["wood", "timber", "ebony", "metal", "steel", "dark", "copper"].includes(m) ? "slats" : "fins";
  }
  if (thinH.length >= 3) {
    // Thin plates at one height are a pergola; stacked a storey apart, the edges of floors.
    const zs = thinH.map(q => q.b[2]);
    return max(...zs) - min(...zs) >= 2.4 ? "floor slabs" : "pergola";
  }
  if (thinH.length >= 1 && thinV.length >= 1) { return "frame"; }
  if (thinH.length >= 1 && plan(b) >= 8) { return "canopy"; }
  const steps = members.filter(q => H(q.b) <= 0.6).map(q => q.b[2]).sort((x, y) => x - y);
  let rising = 0;
  for (let i = 1; i < steps.length; i += 1) { const dz = steps[i] - steps[i - 1]; if (dz >= 0.1 && dz <= 0.5) { rising += 1; } }
  if (rising >= 3) { return "stair"; }
  if (H(b) <= 1.2 && b[2] <= 0.6) {
    const aspect = max(W(b), D(b)) / max(0.5, min(W(b), D(b)));
    return aspect >= 6 ? "low wall" : plan(b) >= 8 ? "plinth" : "step";
  }
  if (members.every(thin) && max(W(b), D(b)) >= 4 && H(b) >= 0.6) { return members.length <= 4 ? "wall" : "walls"; }
  if (H(b) >= 4 && max(W(b), D(b)) <= 1.6) { return members.length > 1 ? "columns" : "column"; }
  return "structure";
}
function phrase(adj, noun) {
  if (adj && noun.indexOf(adj) === 0) { adj = ""; }
  if (noun === "long wing") { return "the long " + (adj ? adj + " " : "") + "wing"; }
  return "the " + (adj ? adj + " " : "") + noun;
}

/* ---- one project ------------------------------------------------------------------ */

function breakDown(model, name) {
  const site = model.site || [30, 30];
  const parts = model.parts.map((p, i) => ({ p, i, t: typeOf(p), b: bboxOf(p), m: p.m || (p.tree ? "plant" : "concrete") }))
    .filter(q => q.t && q.b && isFinite(q.b[0]));
  parts.forEach((q, n) => {
    const { t, b, m } = q, h = H(b), w = W(b), d = D(b);
    if (t === "cut" || t === "pcut") { q.k = "cut"; }
    else if (t === "pool" || m === "water") { q.k = "water"; }
    else if (t === "tree") { q.k = "tree"; }
    else if (n === 0 && GROUNDS.has(m) && w * d >= site[0] * site[1] * 0.7 && h <= 1.2) { q.k = "plate"; }
    else if (GROUNDS.has(m) && b[2] <= 1.0 && h <= 1.0) { q.k = "surface"; }
    else if (PLANTS.has(m) || (t === "blob" && (GROUNDS.has(m) || m === "mesh"))) { q.k = "plant"; }
    else if (["wood", "timber"].includes(m) && b[2] <= 1.0 && h <= 0.5 && w * d >= 6) { q.k = "surface"; }
    else if (ROOFS.has(t) && (t !== "dome" || b[2] > 1.0)) { q.k = "roof"; }
    else if (w * d * h >= 25 && min(w, d) >= 2 && h >= 1.5 && !(m === "glass" && min(w, d) < 1)) { q.k = "mass"; }
    else { q.k = "detail"; }
  });

  // The volumes: masses of one footprint stacked, or one inside another, are one.
  const masses = parts.filter(q => q.k === "mass");
  const volumes = groups(masses, (a, b) => {
    const ip = interPlan(a.b, b.b), iou = ip / (plan(a.b) + plan(b.b) - ip);
    const gap = max(a.b[2], b.b[2]) - min(a.b[5], b.b[5]);
    return (a.m === b.m && iou >= 0.6 && gap <= 0.6) || inside(a.b, b.b, 0.3) || inside(b.b, a.b, 0.3);
  }).map(ms => ({ masses: ms, b: boundsOf(ms), details: [], roofs: [], cuts: [] }));

  // A roof belongs to the volume it sits on.
  const loose = [];
  parts.filter(q => q.k === "roof").forEach(q => {
    let best = null, bv = 0;
    volumes.forEach(v => {
      const ip = interPlan(q.b, v.b);
      if (ip >= 0.4 * plan(q.b) && q.b[2] >= v.b[2] + 1 && q.b[2] <= v.b[5] + 1.2 && ip > bv) { bv = ip; best = v; }
    });
    if (best) { best.roofs.push(q); } else { loose.push(q); }
  });
  // Every smaller part belongs to the volume it lies (at least half) within; the rest stand free.
  const bulk = b => max(0.05, W(b)) * max(0.05, D(b)) * max(0.05, H(b));
  parts.filter(q => q.k === "detail").forEach(q => {
    let best = null, bv = 0;
    const th = [q.b[0], q.b[1], q.b[2], max(q.b[3], q.b[0] + 0.05), max(q.b[4], q.b[1] + 0.05), max(q.b[5], q.b[2] + 0.05)];
    volumes.forEach(v => {
      if (!hits(q.b, v.b, 0.8)) { return; }
      const iv = inter3(th, grow(v.b, 1.0));
      if (iv >= 0.5 * bulk(th) && iv > bv) { bv = iv; best = v; }
    });
    if (best) { best.details.push(q); } else { loose.push(q); }
  });
  const cuts = parts.filter(q => q.k === "cut");
  volumes.forEach(v => { v.cuts = cuts.filter(c => hits(c.b, v.b, 0) && c.i > min(...v.masses.map(q => q.i))); });

  // An interior drawn as a cutaway (a lobby, a show-room) has no volume of its own on the ground: its
  // floor, with the walls standing on it and all it holds, is the room.
  if (!volumes.some(v => v.b[2] <= 1.2)) {
    const floors = parts.filter(q => (q.k === "detail" || q.k === "surface") && H(q.b) <= 0.6 && q.b[2] <= 1.0 && plan(q.b) >= 40 &&
                                     !["grass", "drygrass", "soil", "gravel", "sand"].includes(q.m)).sort((a, c) => plan(c.b) - plan(a.b));
    // (Not a building raised on columns, whose upper volumes stand over the floor.)
    const fl = floors[0] && !volumes.some(v => interPlan(v.b, floors[0].b) >= 0.3 * plan(floors[0].b)) ? floors[0] : null;
    if (fl) {
      const room = [fl.b[0] - 0.8, fl.b[1] - 0.8, -1, fl.b[3] + 0.8, fl.b[4] + 0.8, 99];
      const held = parts.filter(q => q !== fl && ["detail", "roof", "surface", "plant"].includes(q.k) && inside(q.b, room, 0));
      const walls = held.filter(q => min(W(q.b), D(q.b)) <= 0.9 && H(q.b) >= 2.4 && max(W(q.b), D(q.b)) >= 0.5 * min(W(fl.b), D(fl.b)));
      if (walls.length) {
        const list = [fl].concat(held), v = { masses: [fl].concat(walls), b: boundsOf(list), details: held.filter(q => walls.indexOf(q) < 0), roofs: [], cuts: [],
                                              room: /lobby/i.test(name) ? "lobby" : /living/i.test(name) ? "living room" : "room" };
        v.cuts = cuts.filter(c => hits(c.b, v.b, 0));
        volumes.push(v);
      }
    }
  }

  const out = [];
  const add = (sec) => { out.push(sec); return sec; };
  const mainGround = volumes.filter(v => v.b[2] <= 1.2).sort((a, b) => plan(b.b) - plan(a.b))[0];

  // The volumes, by the space each is.
  volumes.forEach(v => {
    const b = v.b, base = b[2], ground = base <= 1.2, area = plan(b), h = H(b), aspect = max(W(b), D(b)) / max(1, min(W(b), D(b)));
    const mat = dominant(v.masses, q => plan(q.b) * H(q.b));
    let glazed = 0;
    v.masses.concat(v.details).forEach(q => {
      if (q.m !== "glass") { return; }
      glazed += q.k === "mass" ? 2 * (W(q.b) + D(q.b)) * H(q.b) : faceOf(q.b);
    });
    const glass = min(1, glazed / max(1, 2 * (W(b) + D(b)) * h));
    const holders = volumes.filter(o => o !== v && interPlan(o.b, b) > 0.15 * area && abs(o.b[5] - base) <= 1.0);
    const held = min(area, holders.reduce((s, o) => s + interPlan(o.b, b), 0));
    const over = ground ? 0 : 1 - held / max(1, area);
    // How far it runs out past what holds it up, on its longest side.
    const hb = holders.length ? holders.reduce((u, o) => joinB(u, o.b), holders[0].b) : null;
    const reach = ground ? 0 : hb ? max(hb[0] - b[0], b[3] - hb[3], hb[1] - b[1], b[4] - hb[4], 0) : max(W(b), D(b));
    const storeys = max(1, round(h / 3.2));
    const metal = v.masses.every(q => q.t === "mesh") && ["metal", "steel"].includes(mat);
    // Held up by nothing but columns standing under it: raised on them, not cantilevered.
    const posts = !ground && !holders.length ? loose.filter(q => min(W(q.b), D(q.b)) <= 0.9 && H(q.b) >= 2 && abs(q.b[5] - base) <= 1.0 &&
                                                                 interPlan(q.b, b) >= 0.5 * max(0.05, plan(q.b))).length : 0;
    let noun;
    if (v.room) { noun = v.room; }
    else if (GROUNDS.has(mat)) { noun = PLANTS.has(mat) || mat === "grass" || mat === "drygrass" ? "berm" : "plinth"; }
    else if (metal) { noun = "sails"; }
    else if (!ground && area < 45) { noun = "lookout"; }
    else if (posts >= 2) { noun = "box on columns"; }
    else if (!ground && (reach >= 2 || over > 0.25)) { noun = "cantilevered box"; }
    else if (!ground) { noun = storeys >= 3 ? "upper storeys" : "upper box"; }
    else if (v.masses.length >= 4 && storeys >= 4) { noun = "storeys"; }
    else if (h >= 12 && area < 900) { noun = "tower"; }
    else if (area >= 600 && h >= 5) { noun = "hall"; }
    else if (glass >= 0.45) { noun = "glass pavilion"; }
    else if (aspect >= 2.6) { noun = "long wing"; }
    else if (v !== mainGround) { noun = "wing"; }
    else { noun = storeys >= 2 ? "block" : "ground floor"; }
    const adj = v.room || noun === "glass pavilion" ? "" : MAT[mat] || mat;
    v.sec = add({ kind: "volume", role: ground || v.room ? "ground" : noun === "lookout" ? "lookout" : "upper", noun, adj,
                  name: phrase(adj, noun), glass: +glass.toFixed(2), over: +over.toFixed(2), reach: +reach.toFixed(1), storeys,
                  parts: v.masses.concat(v.details, v.cuts), b });
  });
  // Its roofs, each also kept on its own: the parts of one roof that touch (a seam over a sheet, a
  // gable's end) are one, named by what it shows on top, and its main part is kept as a shape.
  volumes.forEach(v => groups(v.roofs, (a, c) => hits(a.b, c.b, 0.3)).forEach(list => {
    const q = list.slice().sort((a, c) => plan(c.b) - plan(a.b))[0], topm = list.slice().sort((a, c) => c.b[5] - a.b[5])[0].m;
    const noun = q.t === "gable" ? "gabled roof" : q.t === "hip" ? "hipped roof" : q.t === "dome" ? "dome" : q.p.thick ? "roof slab" : "sloping roof";
    const a = q.p[q.t], shape = q.t === "dome" ? { t: "dome", r: a[3], m: q.m } :
      { t: q.t, w: +a[3].toFixed(2), d: +a[4].toFixed(2), h: +a[5].toFixed(2), axis: q.p.axis, rise: q.p.rise, thick: q.p.thick, m: q.m };
    add({ kind: "roof", role: "crown", noun, adj: MAT[topm] || topm, name: phrase(MAT[topm] || topm, noun), on: v.sec, parts: list, b: boundsOf(list), shape });
  }));
  // What a volume wears on its face, kept apart too: a screen, slats, a panel.
  volumes.forEach(v => {
    const mat = dominant(v.masses, q => plan(q.b) * H(q.b)), byMat = {};
    v.details.forEach(q => { if (q.m !== mat && q.m !== "glass" && q.m !== "dark" && !GROUNDS.has(q.m)) { (byMat[q.m] = byMat[q.m] || []).push(q); } });
    Object.keys(byMat).forEach(m => {
      const list = byMat[m], area = list.reduce((s, q) => s + faceOf(q.b), 0);
      if (area < 5) { return; }
      const noun = featureNoun(list);
      add({ kind: "feature", role: "face", noun, adj: noun === "corten panel" ? "" : MAT[m] || m, name: phrase(noun === "corten panel" ? "" : MAT[m] || m, noun),
            on: v.sec, parts: list, b: boundsOf(list) });
    });
  });
  // What stands free: walls, colonnades, pergolas, stairs, a roof with nothing under it.
  groups(loose, (a, b) => a.m === b.m && hits(a.b, b.b, 0.5)).forEach(list => {
    const b = boundsOf(list);
    if (list.reduce((s, q) => s + faceOf(q.b), 0) < 3 || H(b) < 0.6 || list.every(q => GROUNDS.has(q.m))) { return; }
    const noun = list.some(q => q.k === "roof") && list.length <= 2 ? "canopy" : featureNoun(list), m = dominant(list, q => faceOf(q.b));
    add({ kind: "feature", role: "free", noun, adj: noun === "corten panel" ? "" : MAT[m] || m, name: phrase(noun === "corten panel" ? "" : MAT[m] || m, noun),
          parts: list.concat(cuts.filter(c => hits(c.b, b, 0))), b });
  });
  // The ground: the pools, with their edges; the terraces and decks.
  const surfaces = parts.filter(q => q.k === "surface");
  const used = new Set();
  groups(parts.filter(q => q.k === "water"), (a, c) => hits(a.b, c.b, 0.3)).forEach(list => {
    const b = boundsOf(list), q = list.slice().sort((a, c) => plan(c.b) - plan(a.b))[0];
    const edge = surfaces.filter(s => s.m === "paving" && !used.has(s) && hits(s.b, b, 1.2));
    edge.forEach(s => used.add(s));
    const raised = b[2] > 0.5, long = max(W(b), D(b)) / max(1, min(W(b), D(b))) >= 3;
    if (plan(b) < 4) { return; }
    const noun = plan(b) >= 400 ? "lake" : q.t !== "pool" && q.t !== "box" ? "pond" : raised ? "raised pool" : long ? "long pool" : "pool";
    add({ kind: "pool", role: "ground", noun, adj: "", name: "the " + noun,
          parts: list.concat(edge), b: edge.reduce((bb, s) => joinB(bb, s.b), b) });
  });
  groups(surfaces.filter(s => !used.has(s) && s.m !== "grass" && s.m !== "drygrass"), (a, b) => hits(a.b, b.b, 0.3)).forEach(list => {
    const b = boundsOf(list), area = list.reduce((s, q) => s + plan(q.b), 0);
    if (area < 10) { return; }
    const m = dominant(list, q => plan(q.b));
    const noun = ["wood", "timber"].includes(m) ? "deck" : m === "gravel" ? "gravel court" : m === "sand" ? "sand court" : "terrace";
    add({ kind: "terrace", role: "ground", noun, adj: noun === "terrace" ? MAT[m] || m : "", name: phrase(noun === "terrace" ? MAT[m] || m : "", noun), parts: list, b });
  });
  // The garden: its trees and shrubs, kept as they are to be stood again anywhere.
  const trees = parts.filter(q => q.k === "tree").map(q => {
    const a = q.p.tree;
    return { h: a[2], r: a[3], shape: q.p.shape || "round", trunk: q.p.trunk || "timber", m: q.p.m || "plant" };
  });
  const shrubs = parts.filter(q => q.k === "plant" && q.t === "blob" && q.b[2] <= 0.8).map(q => ({ r: [q.p.blob[3], q.p.blob[4], q.p.blob[5]], m: q.m }));
  return { sections: out, garden: { trees, shrubs }, ground: model.ground || "soil" };
}

/* ---- a section in blocks ------------------------------------------------------------- */

function moved(p, dx, dy, dz) {
  const q = JSON.parse(JSON.stringify(p)), t = typeOf(q), a = q[t];
  if (["box", "cut", "gable", "shed", "hip", "cyl", "dome", "blob"].includes(t)) { a[0] += dx; a[1] += dy; a[2] += dz; }
  else if (t === "pool") { a[0] += dx; a[1] += dy; a[4] = (a[4] || 0) + dz; }
  else if (t === "tree") { a[0] += dx; a[1] += dy; a[4] = (a[4] || 0) + dz; }
  else if (t === "prism" || t === "pcut") { q[t] = a.map(pt => [pt[0] + dx, pt[1] + dy]); (q.holes || []).forEach((h, i) => { q.holes[i] = h.map(pt => [pt[0] + dx, pt[1] + dy]); }); q.z = (q.z || 0) + dz; }
  else if (t === "mesh") { for (let i = 0; i < a.v.length; i += 3) { a.v[i] += dx; a.v[i + 1] += dy; a.v[i + 2] += dz; } }
  return q;
}
function stamp(sec) {
  const solid = sec.parts.filter(q => q.k !== "cut");
  const b = boundsOf(solid), cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2;
  const parts = sec.parts.slice().sort((a, c) => a.i - c.i).map(q => moved(q.p, -cx, -cy, -b[2]));
  const site = [2 * ceil(W(b) / 2) + 2, 2 * ceil(D(b) / 2) + 2];
  const vx = Models.voxelize({ voxel: 1, site, parts });
  const { nx, ny, nz, grid, names } = vx;
  let x0 = nx, x1 = -1, y0 = ny, y1 = -1, z0 = nz, z1 = -1;
  for (let k = 0; k < nz; k += 1) {
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        if (!grid[(k * ny + j) * nx + i]) { continue; }
        x0 = min(x0, i); x1 = max(x1, i); y0 = min(y0, j); y1 = max(y1, j); z0 = min(z0, k); z1 = max(z1, k);
      }
    }
  }
  if (x1 < 0) { return null; }
  const pal = [], at = {};
  let rle = "", run = 0, last = -1;
  const flush = () => { if (run) { rle += String.fromCharCode(65 + last) + (run > 1 ? run : ""); } };
  for (let k = z0; k <= z1; k += 1) {
    for (let j = y0; j <= y1; j += 1) {
      for (let i = x0; i <= x1; i += 1) {
        const g = grid[(k * ny + j) * nx + i];
        let v = 0;
        if (g) {
          const name = names[g - 1];
          if (at[name] === undefined) { at[name] = pal.length; pal.push(name); }
          v = at[name] + 1;
        }
        if (v === last) { run += 1; } else { flush(); last = v; run = 1; }
      }
    }
  }
  flush();
  if (pal.length > 25) { throw new Error("too many materials in one section"); }
  // o: where its first block's corner is in the project, in metres (x east, y south, z up).
  return { n: [x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1], mats: pal, d: rle,
           at: [+(b[0]).toFixed(2), +(b[1]).toFixed(2), +(b[2] + z0).toFixed(2)],
           o: [+(cx + x0 - site[0] / 2).toFixed(2), +(cy + y0 - site[1] / 2).toFixed(2), +(b[2] + z0).toFixed(2)] };
}

/* ---- all of them ----------------------------------------------------------------------- */

function main() {
  const arch = JSON.parse(fs.readFileSync(path.join(V2, "architecture.json"), "utf8")).buildings;
  const projects = [], sections = [];
  arch.forEach(entry => {
    const file = path.join(V2, "models", entry.slug + ".json");
    if (!fs.existsSync(file)) { return; }
    const model = JSON.parse(fs.readFileSync(file, "utf8"));
    const name = model.name || entry.name, pi = projects.length;
    const parts = breakDown(model, name), ids = [], seen = {};
    parts.sections.forEach(sec => {
      const st = stamp(sec);
      if (!st) { return; }
      if (sec.kind === "feature" && st.n[0] * st.n[1] * st.n[2] < 4) { return; }
      // A bay repeated along a building is one section, kept with how many times it comes.
      const key = sec.kind + st.n.join("x") + st.mats.join() + st.d;
      if (seen[key]) { seen[key].rep += 1; sec.id = seen[key].id; return; }
      const id = sections.length;
      sec.id = id;
      ids.push(id);
      sections.push({
        id, p: pi, kind: sec.kind, role: sec.role, noun: sec.noun, adj: sec.adj, name: sec.name,
        on: sec.on && sec.on.id !== undefined ? sec.on.id : undefined, glass: sec.glass, over: sec.over, reach: sec.reach, storeys: sec.storeys,
        size: [+W(sec.b).toFixed(1), +D(sec.b).toFixed(1), +H(sec.b).toFixed(1)], z: +sec.b[2].toFixed(2), rep: 1, shape: sec.shape,
        at: st.at, o: st.o, n: st.n, mats: st.mats, d: st.d
      });
      seen[key] = sections[id];
    });
    projects.push({ slug: entry.slug, name, where: entry.where || entry.country || "", ground: parts.ground, sections: ids, garden: parts.garden });
  });
  const out = { note: "Made by scripts/build_sections.js from docs/v2/models/ and docs/v2/architecture.json: every modelled building taken apart into its volumes, roofs, features and ground, each in one-metre blocks.",
                projects, sections };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const kinds = {};
  sections.forEach(s => { kinds[s.kind] = (kinds[s.kind] || 0) + 1; });
  console.log(projects.length + " projects, " + sections.length + " sections " + JSON.stringify(kinds) + "; " + round(fs.statSync(OUT).size / 1024) + " KB");
  if (process.argv.includes("--list")) {
    projects.forEach(p => {
      console.log("== " + p.name + " (" + p.garden.trees.length + " trees, " + p.garden.shrubs.length + " shrubs)");
      p.sections.forEach(id => {
        const s = sections[id];
        console.log("   " + s.kind.padEnd(8) + (s.name + (s.rep > 1 ? " ×" + s.rep : "")).padEnd(38) + " " + s.size.join("×") + " m @" + s.z +
                    (s.over ? " over " + s.over : "") + (s.reach ? " reach " + s.reach : "") + (s.glass ? " glass " + s.glass : "") +
                    (s.on !== undefined ? " on " + s.on : "") + " · " + s.n.join("×") + " blocks");
      });
    });
  }
}

main();

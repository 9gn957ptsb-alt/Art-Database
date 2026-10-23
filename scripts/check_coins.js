#!/usr/bin/env node
/* Checks Holographic Mr Pearl's places at half the surround (artist, 21 Oct 2026: "cut the surrounding space down in
   half for now"), without a page: each new form the Artifact opens on and each modelled building, built in Node as the
   game builds it (place, a dozen saved works hung by the seed, pieces hidden), and, with --cities, each city. For each
   it prints the world's size against the rule (place.js halfSurround), the model's footprint whole in it, where you
   come down (not the fallback), and the pieces hidden. It fails where a size is not the rule, a footprint is cut, the
   crash fell back, or a piece is missing.

   And the ten coins (place.js coins): ten, their ids unique, each where he can stand to take it, the inside ones in a
   room wherever there are rooms, the least distance between two, the same ten laid twice; --words prints what each says.

     NODE_PATH=/opt/node22/lib/node_modules node scripts/check_coins.js [--seed N] [--cities] [--words] */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const V2 = path.join(ROOT, "docs", "v2");
const ROCKET = path.join(ROOT, "docs", "worlds", "rocket");
global.window = global;
require(path.join(V2, "models.js"));
window.Forms = require(path.join(ROCKET, "forms.js"));
const Adv = window.Adventures = require(path.join(ROCKET, "adventure.js"));
const Pl = window.RocketPlace = require(path.join(ROCKET, "place.js"));
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const FORMS_OPEN = [2, 4, 11, 12, 13, 15, 16, 23, 24, 27, 35, 41, 50, 64, 67];   // the Artifact's (build_rocket_artifact.js)
const argv = process.argv.slice(2);
const SEED = argv.includes("--seed") ? +argv[argv.indexOf("--seed") + 1] : 7;
const forms = window.Forms.load(json(path.join(ROCKET, "sections.json")));
const cat = json(path.join(ROCKET, "catalogue.json"));

// A dozen of the saved works, by the seed, with their histories (rocket.js worksFor).
function worksFor(sd) {
  const r = Pl.rng(sd * 13 + 5), pool = cat.pool.slice(), pick = [];
  while (pick.length < 15 && pool.length) { pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
  return pick.map((wk) => {
    const f = path.join(V2, "histories", wk.id + ".json");
    return { work: wk, history: fs.existsSync(f) ? json(f) : null };
  }).filter((x) => x.history).slice(0, 12);
}

function build(kind, e, sd) {
  let d;
  if (kind === "form") {
    const R = window.Forms.form(forms, +e), base = R.placed.filter((P2) => P2.role === "base")[0], pj = forms.projects[base.sec.p];
    d = { kind, name: R.name, form: R, ground: json(path.join(V2, "grounds", pj.slug + ".json")), forms };
  } else {
    const pj = forms.projects.filter((q) => q.slug === e.slug)[0];
    d = { kind, name: e.name, model: json(path.join(V2, "models", e.slug + ".json")), ground: json(path.join(V2, "grounds", e.slug + ".json")), interior: null, forms };
    if (pj) { d.sections = pj.sections.map((id) => forms.sections[id]); }
  }
  d.works = worksFor(sd);
  const t0 = Date.now(), place = Pl.place(d), ms = Date.now() - t0;
  const cands = d.works.map((x) => { x.f = Adv.facts(x.work, x.history); return x; });
  const hung = Pl.hang(place, Pl.hangable(place, cands));
  const setting = { kind, slug: String(e.slug || e), name: d.name, where: "", city: "", recipe: "" };
  const adv = Adv.make(setting, sd, { works: hung.map((p) => p.work), pool: !!(place.M && place.M.pool && place.M.pool.length) });
  const hid = Pl.hide(place, adv, hung, sd);
  return { place, name: d.name, hung, adv, hid, ms, d };
}

// The size the rule gives (place.js halfSurround), from the model's site turned as makePlace turns it.
function ruled(d) {
  const s = d.kind === "form" ? [d.form.nx, d.form.ny] : d.model.site || [30, 30], span = Math.max(s[0], s[1]);
  return Math.min(256, Math.ceil((256 + span) / 2 / 16) * 16);
}

const HEAD_Y = 1.3724, HEAD_R = 0.2457;   // rocket.js PEARL until his body has come
function underTree(place) {
  const c = place.crash, wr = place.wreck, tr = place.tree;
  const tx = tr ? tr.x + 0.5 : c.x, tz = tr ? tr.z + 0.5 : c.z, ax = wr.x + 0.5 - tx, az = wr.z + 0.5 - tz, L = Math.hypot(ax, az) || 1;
  return { x: tx + ax / L * 1.7, y: c.y, z: tz + az / L * 1.7 };
}

let bad = 0;
const fail = (what) => { bad += 1; return "FAIL " + what; };
function report(kind, e) {
  const { place, name, hung, adv, hid, ms, d } = build(kind, e, SEED), w = place.w, M = place.M, out = [];
  const want = ruled(d);
  out.push(w.SX === want ? w.SX + " m" : fail("size " + w.SX + " (rule " + want + ")"));
  // the footprint whole: no footprint cell within 2 of the world's edge
  let cut = 0;
  for (let z = 0; z < w.SZ; z += 1) { for (let x = 0; x < w.SX; x += 1) { if (M.foot[z * w.SX + x] && (x < 2 || z < 2 || x >= w.SX - 2 || z >= w.SZ - 2)) { cut += 1; } } }
  out.push(cut ? fail("footprint cut (" + cut + ")") : "whole");
  const c = place.crash, edge = Math.min(c.x, c.z, w.SX - c.x, w.SZ - c.z);
  out.push(c.x === 24 + 1.5 && c.z === 24 + 1.5 ? fail("crash fell back") : "crash " + Math.round(edge) + " m in");
  out.push(hid.pieces.length + hung.filter((p) => p.k >= 0).length === 4 ? "4 pieces" : fail("pieces " + (hid.pieces.length + hung.filter((p) => p.k >= 0).length)));
  out.push(hung.length + " works, " + place.rooms.length + " rooms, " + ms + " ms");
  // the ten coins (place.js coins): ten, ids unique, each where he can stand to take it, the inside ones in a room,
  // the same ten on a second laying
  const opt = { wake: underTree(place), headY: HEAD_Y, headR: HEAD_R, reach: 6, name };
  const C = Pl.coins(place, hung, opt), C2 = Pl.coins(place, hung, opt), w2 = place.w;
  const open = (q) => { const x = Math.floor(q.x), z = Math.floor(q.z), feet = Math.floor(q.kind === "pool" ? q.y - HEAD_R : q.y - HEAD_Y);
    return [feet, Math.floor(q.y)].every((y) => !w2.SOLID[w2.get(x, y, z)] || w2.get(x, y, z) === Pl.B.LEAVES); };
  const ids = new Set(C.map((q) => q.id)), shut = C.filter((q) => !open(q)), inside = C.filter((q) => q.kind === "work" || q.kind === "room");
  const notIn = place.rooms.length ? inside.filter((q) => !Pl.roomAt(place, q.x, q.y - HEAD_Y + 0.5, q.z)) : [];
  let least = 1e9;
  C.forEach((a, i) => C.forEach((b, j) => { if (j > i) { least = Math.min(least, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)); } }));
  const kinds = {}; C.forEach((q) => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  out.push(C.length === 10 && ids.size === 10 ? "10 coins " + Object.keys(kinds).map((k) => k + (kinds[k] > 1 ? " " + kinds[k] : "")).join(" ") : fail(C.length + " coins, " + ids.size + " ids"));
  out.push(shut.length ? fail("shut in " + shut.map((q) => q.id).join(" ")) : "open");
  out.push(notIn.length ? fail("not in a room " + notIn.map((q) => q.id).join(" ")) : "least " + least.toFixed(1) + " m");
  out.push(JSON.stringify(C) === JSON.stringify(C2) ? "same" : fail("not the same twice"));
  if (argv.includes("--words")) { C.forEach((q) => out.push("\n    " + q.kind + " " + q.text)); }
  console.log((kind + " " + String(e.slug || e)).slice(0, 52).padEnd(54) + out.join(" | "));
  return { place, hung };
}

for (const n of FORMS_OPEN) { report("form", n); }
for (const b of cat.buildings.filter((q) => forms.projects.some((p) => p.slug === q.slug))) { report("building", b); }
if (argv.includes("--cities")) {
  for (const e of cat.cities) {
    const g = json(path.join(V2, "grounds", e.slug + ".json")), t0 = Date.now(), place = Pl.city(g, forms), ms = Date.now() - t0, w = place.w;
    const setting = { kind: "city", slug: e.key, name: e.name, where: e.name, city: e.name, recipe: "" };
    const adv = Adv.make(setting, SEED, { works: [], pool: false }), hid = Pl.hide(place, adv, [], SEED);
    const inside = hid.pieces.every((p) => p.x >= 0 && p.z >= 0 && p.x < w.SX && p.z < w.SZ);
    console.log(("city " + e.key).padEnd(54) + [w.SX === 192 ? "192 m" : fail("size " + w.SX), hid.pieces.length === 4 && inside ? "4 pieces" : fail("pieces"), adv.pieces.map((p) => p.how || "").join(","), ms + " ms"].join(" | "));
  }
}
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);

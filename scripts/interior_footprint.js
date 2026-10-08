#!/usr/bin/env node
/* A museum model's footprint at given heights, as the walk reads it: the
   page's own docs/v2/models.js voxelises the model (docs/v2/models/<slug>.json)
   and docs/v2/walk-plan.js says which materials are built (not grown, not
   water). For scripts/build_interiors.py, which lays reconstructed rooms
   inside the model and needs to know where its walls stand.

     node scripts/interior_footprint.js <slug> <z> [<z> …]

   Prints JSON: {slug, v, site: [w, d], nx, ny, nz, top: [m …], masks: {"<z>":
   "<rows>"}}, each mask ny rows of nx characters, row j at y = (j + 0.5)·v −
   d/2 (south is down), column i at x = (i + 0.5)·v − w/2: "#" built at that
   height (and the voxel over it, as the checker's model reach reads it),
   "." not. `top` is the highest built voxel's top in metres, column by column
   (row-major, −1 where nothing is built), for the floors' heights. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const V2 = path.join(__dirname, "..", "docs", "v2");
const [slug, ...zs] = process.argv.slice(2);
if (!slug || !zs.length) {
  console.error("usage: node scripts/interior_footprint.js <slug> <z> [<z> …]");
  process.exit(2);
}
const sandbox = { window: {}, console };
vm.createContext(sandbox);
for (const f of ["models.js", "walk-plan.js"]) {
  vm.runInContext(fs.readFileSync(path.join(V2, f), "utf8"), sandbox, { filename: f });
}
const W = sandbox.window;
const spec = JSON.parse(fs.readFileSync(path.join(V2, "models", slug + ".json"), "utf8"));
// A shell compiled with the page's own rules gives the voxels the walk reads.
const world = W.WalkPlan.compile({ slug, v: 1, grid: { cell: 1, turn: 0 }, floors: null }, spec, { soil: null });
const vx = world.vox;
const plane = vx.nx * vx.ny;
const built = (i, j, k) => {
  if (k >= vx.nz) { return true; }
  if (k < 0) { return false; }
  const m = vx.grid[k * plane + j * vx.nx + i];
  return !!(m && vx.built[m - 1]);
};
const masks = {};
for (const zs1 of zs) {
  const z = +zs1, k = Math.floor(z / vx.v);
  const rows = [];
  for (let j = 0; j < vx.ny; j += 1) {
    let row = "";
    for (let i = 0; i < vx.nx; i += 1) { row += built(i, j, k) && built(i, j, k + 1) ? "#" : "."; }
    rows.push(row);
  }
  masks[zs1] = rows.join("\n");
}
const top = [];
for (let q = 0; q < plane; q += 1) { top.push(vx.top[q] >= 0 ? +((vx.top[q] + 1) * vx.v).toFixed(2) : -1); }
process.stdout.write(JSON.stringify({ slug, v: vx.v, site: vx.site, nx: vx.nx, ny: vx.ny, nz: vx.nz, top, masks }));

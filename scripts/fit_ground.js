#!/usr/bin/env node
/* How well a model stands on its ground: the model's footprint against the
   building cells of docs/v2/grounds/<slug>.json, the same point in the
   middle of both.

     node scripts/fit_ground.js docs/v2/models/<slug>.json [more.json …]

   The footprint is every column of the model with something standing more
   than 3 m up that is not planting or water, voxelised by the site's own
   docs/v2/models.js. For each model it prints the share of the footprint on
   building cells ("on"), the share of the ground's building cells within the
   model's site that the footprint covers ("covers"), and the shift east and
   south (metres, within 60 m) that would fit it best, with the share it
   would then have. A ground cell is side / n metres (7 m for a museum). */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const ctx = { window: {}, Math: Math, console: console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "docs/v2/models.js"), "utf8"), ctx);
const Models = ctx.window.Models;
const SOFT = new Set(["plant", "grass", "lavender", "sage", "water", "drygrass", "soil", "sand", "gravel", "paving"]);
const names = Object.keys(Models.MATERIALS);

function fit(file) {
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  const gfile = path.join(root, "docs/v2/grounds", spec.slug + ".json");
  if (!fs.existsSync(gfile)) { return spec.slug + ": no ground file"; }
  const g = JSON.parse(fs.readFileSync(gfile, "utf8"));
  const vx = Models.voxelize(spec);
  const { grid, nx, ny, nz, v } = vx;
  const site = spec.site || [30, 30];
  const k0 = Math.ceil(3 / v);
  const foot = [];
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      for (let k = k0; k < nz; k += 1) {
        const m = grid[(k * ny + j) * nx + i];
        if (m && !SOFT.has(names[m - 1])) {
          foot.push([(i + 0.5) * v - site[0] / 2, (j + 0.5) * v - site[1] / 2]);
          break;
        }
      }
    }
  }
  if (!foot.length) { return spec.slug + ": nothing standing"; }
  const cell = g.side / g.n, half = g.side / 2;
  const isB = (x, y) => {
    const i = Math.floor((x + half) / cell), j = Math.floor((y + half) / cell);
    return i >= 0 && j >= 0 && i < g.n && j < g.n && g.kind[j * g.n + i] === "b";
  };
  const share = (dx, dy) => foot.reduce((s, p) => s + (isB(p[0] + dx, p[1] + dy) ? 1 : 0), 0) / foot.length;
  // The ground's building cells inside the site, and how many the footprint touches.
  const seen = new Set();
  foot.forEach(p => {
    const i = Math.floor((p[0] + half) / cell), j = Math.floor((p[1] + half) / cell);
    seen.add(j * g.n + i);
  });
  let inSite = 0, hit = 0;
  for (let j = 0; j < g.n; j += 1) {
    for (let i = 0; i < g.n; i += 1) {
      const x = (i + 0.5) * cell - half, y = (j + 0.5) * cell - half;
      if (Math.abs(x) > site[0] / 2 || Math.abs(y) > site[1] / 2 || g.kind[j * g.n + i] !== "b") { continue; }
      inSite += 1;
      if (seen.has(j * g.n + i)) { hit += 1; }
    }
  }
  let best = { dx: 0, dy: 0, s: share(0, 0) };
  for (let dy = -60; dy <= 60; dy += 2) {
    for (let dx = -60; dx <= 60; dx += 2) {
      const s = share(dx, dy);
      if (s > best.s + 0.02 || (s > best.s - 1e-9 && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy) && s >= best.s)) {
        best = { dx: dx, dy: dy, s: s };
      }
    }
  }
  const pc = x => Math.round(x * 100) + "%";
  return spec.slug + ": on " + pc(share(0, 0)) + ", covers " + (inSite ? pc(hit / inSite) : "–") +
    " of " + inSite + " building cells in the site; best shift " + best.dx + " m east, " + best.dy +
    " m south → on " + pc(best.s) + " (cells " + cell.toFixed(1) + " m)";
}

const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node scripts/fit_ground.js <model.json> [...]"); process.exit(2); }
files.forEach(f => console.log(fit(f)));

// The tree of many focal points (focus-tree.js): run with `node dirt/engine/focus-tree.test.mjs`.
import { createRequire } from "node:module";
const FT = createRequire(import.meta.url)("./focus-tree.js");
const FK = 0.381966011250105, G = 2584 * FK;
let fails = 0;
const check = (name, ok, more = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (more ? "  " + more : "")); if (!ok) fails++; };

// a tree somewhere near the origin
let at = null;
for (let j = 0; j < 30 && !at; j++) for (let i = 0; i < 30 && !at; i++) if (FT.draw((i + 0.5) * G, (j + 0.5) * G, 0, FK)) at = [(i + 0.5) * G, (j + 0.5) * G];
check("trees stand on the plane", !!at);
const a = FT.draw(at[0], at[1], 0, FK);
check("forty branches, twenty-seven washes of leaves", a.n === 40 && a.nl === 27, `${a.n} ${a.nl}`);

// it never comes apart: every branch starts where another ends (or at the root)
const ends = [];
for (let k = 0; k < a.n; k++) ends.push([a.seg[k * 4 + 2], a.seg[k * 4 + 3]]);
let joined = 0;
for (let k = 1; k < a.n; k++) if (ends.some((e) => Math.hypot(e[0] - a.seg[k * 4], e[1] - a.seg[k * 4 + 1]) < 1e-3)) joined++;
check("every branch grows from another", joined === a.n - 1, `${joined}/${a.n - 1}`);

// thirteen hearths: the points with branches growing from them
const g = [Math.floor(at[0] / G), Math.floor(at[1] / G)], T = FT.treeAt(g[0], g[1]);
check("thirteen hearths (1 + 3 + 9)", T.hearths.length === 13, `${T.hearths.length}`);

// the same tree every time it is grown
const b = FT.draw(at[0], at[1], 0, FK);
check("grown the same each time", a.seg.every((v, i) => v === b.seg[i]));

// focusing elsewhere warps it: looking from one hearth to another moves the branches round them, but not the root
const draws = T.hearths.map((h) => FT.draw(a.seg[(h - 1) * 4 + 2], a.seg[(h - 1) * 4 + 3], 0, FK));
let most = 0, all = 0, pairs = 0;
for (let x = 0; x < draws.length; x++) for (let y = x + 1; y < draws.length; y++) {
  let m = 0; for (let k = 0; k < 160; k++) m = Math.max(m, Math.abs(draws[x].seg[k] - draws[y].seg[k]));
  most = Math.max(most, m); all += m; pairs++;
}
check("where one looks changes how the tree is drawn (it sways)", all / pairs > 8 && most < 144, `mean ${(all / pairs).toFixed(1)}, most ${most.toFixed(1)} cells`);
const c = draws[draws.length - 1];
check("the root stays where it stands", c.seg[0] === a.seg[0] && c.seg[1] === a.seg[1]);
check("the hearth looked at is the one nearest the view", c.focus !== a.focus, `${a.focus} -> ${c.focus}`);

// and the wind sways it a little, slowly
const d = FT.draw(at[0], at[1], 3, FK);
let sway = 0;
for (let k = 0; k < 160; k++) sway = Math.max(sway, Math.abs(d.seg[k] - a.seg[k]));
check("a little wind in three seconds", sway > 0.05 && sway < 34, `${sway.toFixed(2)} cells`);

console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);

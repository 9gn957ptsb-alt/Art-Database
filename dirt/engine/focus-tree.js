// ---- the tree of many focal points ------------------------------------------------------------------------------
// Aries (2 October 2026): "Understanding something is still a matter of focus ... a tree ... where it has multiple
// focus points, in which the series of branches that stem from that focal point make the most sense when focusing on
// that point ... when looking at the tree as a whole ... it warps ... it sways as you look at it, depending on the
// scale in which you are focusing on the tree."
//
// Focus is Latin for a hearth, the fire in the middle of a house; Kepler (1604) made it the point where rays meet. This
// tree has thirteen hearths, one at every place it branches (the top of the trunk, the three limbs' ends, the nine
// boughs' ends: 1 + 3 + 9 = 13). It grows in three dimensions, each branch phi^-1 the length of the one it grows
// from, each fork turned the golden angle from the last. It is not drawn through one eye. Every branch is drawn in the
// perspective of the hearth it grows from, and each hearth looks from the side its own branches spread widest, so that
// at each hearth the branches read: which reach toward you, which away, how they fork. Since each branch starts where
// its hearth was drawn, the tree never comes apart; but no one perspective holds the whole, and the whole is
// impossible, as Cezanne's tables and Hockney's joiners are (Merleau-Ponty, "Cezanne's Doubt", 1945; Hockney,
// Pearblossom Hwy., 1986). And the eye's own focus moves it: the hearth nearest the middle of the view lends its
// perspective to its neighbours, less the further they are along the branches, so the tree comes together round
// wherever one looks and warps elsewhere; swiping across it, it sways. A little wind moves every hearth's eye too.
//
// Done here, on the main thread, each frame (41 points); the collage pass (ground-gl.js, tree()) paints it in
// watercolour: branches in sepia going to indigo with depth, leaves as transparent washes over one another.
const FOCUS_TREE = (() => {
  const PHI_ = (1 + Math.sqrt(5)) / 2, GA = 2 * Math.PI / (PHI_ * PHI_), TAU = 2 * Math.PI;
  const LEN = [144, 89, 55, 34], WID = [13, 8, 5, 3, 2];     // trunk, limbs, boughs, twigs; widths at their starts
  const hm = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; };
  const hh = (x, y, s) => hm(Math.imul(x | 0, 0x27d4eb2d) ^ hm((Math.imul(y | 0, 0x165667b1) + (s | 0)) | 0));
  const un = (h) => h / 4294967296;
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  /** v turned by angle a about the unit axis k (Rodrigues). */
  function turn(v, k, a) {
    const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2], x = cross(k, v);
    return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
  }

  /** The tree a seed grows, in three dimensions (y up): its points, each with its parent, level and children. */
  function grow(seed) {
    let n = 0;
    const r = () => un(hh(seed, n++, 61001));
    const nodes = [{ p: [0, 0, 0], parent: -1, level: -1, kids: [] }];
    const lean = [0.18 * (r() - 0.5), 1, 0.18 * (r() - 0.5)];
    nodes.push({ p: norm(lean).map((x) => x * LEN[0]), parent: 0, level: 0, kids: [] });
    nodes[0].kids.push(1);
    const fork = (i, level, dir, az0) => {
      if (level > 3) return;
      const side = norm(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      for (let k = 0; k < 3; k++) {
        const az = az0 + k * GA * (1 + 0.1 * (r() - 0.5));
        const out = turn(side, dir, az);                              // which way round the branch it leaves
        const tilt = (level === 1 ? 0.95 : 0.78) + 0.3 * (r() - 0.5);  // how far from its parent's line
        let d = norm(turn(dir, norm(cross(dir, out)), tilt));
        d = norm([d[0], d[1] + (level === 3 ? -0.12 : 0.05), d[2]]);  // limbs reach out; twigs droop a little
        const len = LEN[level] * (0.82 + 0.36 * r());
        const p = nodes[i].p;
        nodes.push({ p: [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len], parent: i, level, kids: [], dir: d });
        nodes[i].kids.push(nodes.length - 1);
        fork(nodes.length - 1, level + 1, d, az + GA * 0.5);
      }
    };
    fork(1, 1, norm(lean), TAU * r());
    return nodes;
  }

  /** A local eye: turned yaw about the vertical, looking up a little, with focal length f. */
  function eye(v, yaw, pitch, f) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = v[0] * cy - v[2] * sy, z0 = v[0] * sy + v[2] * cy;
    const y = v[1] * cp - z0 * sp, z = v[1] * sp + z0 * cp;
    const s = Math.min(2.0, Math.max(0.5, f / (f + z)));
    return [x * s, -y * s, z, s];                                     // screen (y down), depth, how much nearer or farther
  }
  /** The yaw from which a hearth's branches spread widest on the page: of 21 turns, the one whose nearest two
   * branches are furthest apart in angle. */
  function bestYaw(nodes, i) {
    const kids = nodes[i].kids;
    let best = 0, bestV = -1;
    for (let k = 0; k < 21; k++) {
      const yaw = k * TAU / 21, a = kids.map((j) => { const v = nodes[j].p.map((x, m) => x - nodes[i].p[m]), e = eye(v, yaw, -0.2, 1e6); return Math.atan2(e[1], e[0]); }).sort((p, q) => p - q);
      let m = TAU - (a[a.length - 1] - a[0]);
      for (let q = 1; q < a.length; q++) m = Math.min(m, a[q] - a[q - 1]);
      if (m > bestV) { bestV = m; best = yaw; }
    }
    return best;
  }

  const cache = new Map();
  /** The tree whose ground holds (gx, gy): its nodes and each hearth's own yaw, grown once. */
  function treeAt(gx, gy) {
    const key = gx + "," + gy;
    if (!cache.has(key)) {
      const nodes = grow(hh(gx, gy, 61000));
      nodes.forEach((nd, i) => { if (nd.kids.length && i > 0) nd.yaw = bestYaw(nodes, i); });
      nodes[0].yaw = nodes[1].yaw;
      // how far apart two hearths are along the branches (steps), for lending perspective
      const hearths = nodes.map((nd, i) => i).filter((i) => i > 0 && nodes[i].kids.length);
      const up = (i) => { const a = []; for (let j = i; j >= 0; j = nodes[j].parent) a.push(j); return a; };
      const steps = new Map();
      for (const a of hearths) for (const b of hearths) {
        const pa = up(a), pb = up(b), common = pa.find((x) => pb.includes(x));
        steps.set(a + "," + b, pa.indexOf(common) + pb.indexOf(common));
      }
      if (cache.size > 8) cache.clear();
      cache.set(key, { nodes, hearths, steps });
    }
    return cache.get(key);
  }

  /** The tree nearest the view's middle (cx, cy, in cells), drawn for this moment, or null. Trees stand in phi^-3 of
   * the squares 2584 FK cells across, their roots below the middle so they stand in it. */
  function draw(cx, cy, t, FK) {
    const G = 2584 * FK, gx0 = Math.floor(cx / G), gy0 = Math.floor(cy / G);
    let best = null, bd = Infinity;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = gx0 + i, gy = gy0 + j, h = hh(gx, gy, 61002);
      if (un(h) > 0.236) continue;
      const root = [(gx + 0.5) * G + (un(hm(h + 1)) - 0.5) * G * 0.4, (gy + 0.5) * G + 170 + (un(hm(h + 2)) - 0.5) * G * 0.3];
      const d = Math.hypot(root[0] - cx, root[1] - 170 - cy);
      if (d < bd) { bd = d; best = { gx, gy, root }; }
    }
    if (!best || bd > 700) return (api.last = null);
    const T = treeAt(best.gx, best.gy), N = T.nodes;
    // each hearth's eye: its own yaw, swayed by a little wind, and pulled toward the yaw of the hearth one is looking at
    const pos = new Array(N.length), dep = new Array(N.length), scl = new Array(N.length).fill(1);
    pos[0] = best.root; dep[0] = 0;
    const yaw = new Map();
    for (const i of T.hearths) yaw.set(i, N[i].yaw + 0.09 * Math.sin(t / (8 * PHI_) + i * GA) + 0.05 * Math.sin(t / 5 + i));
    // first pass: where each hearth would be drawn, to find which one the view is on
    const place = (yawOf) => {
      for (let i = 1; i < N.length; i++) {
        const par = N[i].parent, F = N[par].p, v = N[i].p.map((x, m) => x - F[m]);
        const own = par === 0 ? yawOf(1) : yawOf(par), f = 1.3 * LEN[Math.max(0, N[i].level)];   // near: the depth shows
        const e = eye(v, own, -0.2, f);
        pos[i] = [pos[par][0] + e[0], pos[par][1] + e[1]]; dep[i] = dep[par] + e[2]; scl[i] = e[3];
      }
    };
    place((i) => yaw.get(i));
    const look = T.hearths.map((i) => ({ i, a: Math.exp(-((pos[i][0] - cx) ** 2 + (pos[i][1] - cy) ** 2) / (2 * 89 * 89)) }));
    const sum = look.reduce((s, l) => s + l.a, 0);
    // then each hearth takes on the looked-at hearth's yaw, by how much it is looked at and how near it is to it
    const lent = new Map();
    for (const i of T.hearths) {
      let w = 0, y = 0;
      for (const l of look) {
        const k = l.a * Math.exp(-T.steps.get(i + "," + l.i) / 2.2);   // the looked-at hearth holds its neighbours together
        let d = yaw.get(l.i) - yaw.get(i); d = Math.atan2(Math.sin(d), Math.cos(d));
        w += k; y += k * d;
      }
      lent.set(i, yaw.get(i) + (sum > 0.02 ? Math.min(1, w / Math.max(sum, 1e-6)) * (w > 0 ? y / w : 0) : 0));
    }
    place((i) => lent.get(i));
    // out: the segments (from each point to its parent), their widths and depths; the leaves at the twigs' ends
    const seg = new Float32Array(160), wid = new Float32Array(160), leaf = new Float32Array(27 * 4);
    let n = 0, nl = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 1; i < N.length && n < 40; i++) {
      const par = N[i].parent, L = Math.max(0, N[i].level);
      seg.set([pos[par][0], pos[par][1], pos[i][0], pos[i][1]], n * 4);
      wid.set([WID[L] * scl[i], WID[L + 1] * scl[i], dep[par], dep[i]], n * 4);
      n++;
      for (const q of [pos[par], pos[i]]) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }
      if (!N[i].kids.length && nl < 27) {                             // a twig's end: a wash of leaves
        const h = hh(i, best.gx * 31 + best.gy, 61003), r = [13, 21, 21][h % 3] * scl[i];
        const pig = [0, 0, 1, 2, 2, 0, 1, 4, 2, 3][(h >>> 4) % 10];        // greens and ochre mostly; a blue, now and then a coleus red
        leaf.set([pos[i][0], pos[i][1], r, pig + Math.min(0.99, Math.max(0, dep[i] / 400 + 0.5))], nl * 4);
        nl++;
        x0 = Math.min(x0, pos[i][0] - r); y0 = Math.min(y0, pos[i][1] - r); x1 = Math.max(x1, pos[i][0] + r); y1 = Math.max(y1, pos[i][1] + r);
      }
    }
    return (api.last = { n, nl, seg, wid, leaf, box: [x0 - 110, y0 - 110, x1 + 110, y1 + 89],   // room for its air round it
      focus: look.reduce((m, l) => (l.a > m.a ? l : m), { a: 0 }).i });
  }
  /** How much of the tree's air is at x, y (0 to 1), as the collage pass lays it: life keeps off it, so it stays quiet. */
  function airAt(x, y) {
    const b = api.last && api.last.box;
    if (!b) return 0;
    const mx = (b[0] + b[2]) / 2, my = (b[1] + b[3]) / 2, qx = Math.abs(x - mx) / ((b[2] - b[0]) / 2), qy = Math.abs(y - my) / ((b[3] - b[1]) / 2);
    const rr = Math.pow(Math.pow(qx, 2.6) + Math.pow(qy, 2.6), 1 / 2.6), t = Math.min(1, Math.max(0, (rr - 0.62) / 0.35));
    return 1 - t * t * (3 - 2 * t);
  }
  const api = { draw, grow, treeAt, airAt, last: null };
  return api;
})();
if (typeof module !== "undefined") module.exports = FOCUS_TREE;

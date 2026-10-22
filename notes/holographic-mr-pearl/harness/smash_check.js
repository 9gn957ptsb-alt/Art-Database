// smash_check.js - the swing checked on his built body, in Node, with pearl.js's own pose() (act = { arms, twist }):
// node smash_check.js <dir with pearl.js and pearl-body.json>
// It computes the swing's numbers from the form as rocket.js's smashFrom() does (the far end, E0, Y_SH, ARMS_UP), then
// walks the whole swing (the coil, the downswing, the strike, the follow-through, back to rest; forehand and backhand)
// for blocks from straight below to over his head, standing and at four points of the stride, and checks that no cell
// of the arms or the guitar comes into his head's sphere (a cell's farthest corner at most on it), that the hat (which
// turns with the upper body) is never nearer them than a unit, and how near the legs come. Exit 1 on a fault.
const fs = require("fs");
const dir = process.argv[2] || __dirname + "/../../../docs/worlds/rocket";
const PB = require(dir + "/pearl.js");
const body = PB.build(JSON.parse(fs.readFileSync(dir + "/pearl-body.json", "utf8")), { skip: [6, 26] });
const hypot = Math.hypot, h = body.cell, half = h * Math.sqrt(3) / 2;
const norm = (v) => { const n = hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const apply = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
const part = (n) => body.parts.filter((p) => p.name === n && !p.empty)[0];
const J = body.joints, sR = J.shoulder_right.at, sL = J.shoulder_left.at, ax = norm([sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]]);
// smashFrom, as in rocket.js
let FAR_END = null, E0 = 0, best = -1;
const g = part("guitar"), M0 = PB.pose(body, 0, 0);
for (const b of g.blocks) {
  const c = [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5], p = apply(M0.guitar, c), d = [p[0] - sR[0], p[1] - sR[1], p[2] - sR[2]];
  const k = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2], q = [d[0] - k * ax[0], d[1] - k * ax[1], d[2] - k * ax[2]], r = hypot(q[0], q[1], q[2]);
  if (r > best) { best = r; FAR_END = c; const up = norm([-ax[1] * ax[0], 1 - ax[1] * ax[1], -ax[1] * ax[2]]); E0 = -Math.atan2(q[0] * up[0] + q[1] * up[1] + q[2] * up[2], -q[2]); }
}
const Y_SH = sR[1] - sR[0] / ax[0] * ax[1];
const cellsOf = (names, M) => { const out = []; for (const n of names) { const p = part(n); for (const b of p.blocks) { out.push(apply(M[n], [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5])); } } return out; };
const hc0 = body.head.centre, r0 = body.head.radius + half;
const clear = (a) => cellsOf(["arm_right", "arm_left", "guitar"], PB.pose(body, 0, 0, { arms: a })).every((q) => hypot(q[0] - hc0[0], q[1] - hc0[1], q[2] - hc0[2]) >= r0);
let lo = 0; while (lo < Math.PI && clear(lo + Math.PI / 360)) { lo += Math.PI / 360; }
let hi = lo + Math.PI / 360; while (hi - lo > 1e-4) { const m = (lo + hi) / 2; if (clear(m)) { lo = m; } else { hi = m; } }
const ARMS_UP = lo, COIL = Math.PI / 2, deg = (r) => +(r * 180 / Math.PI).toFixed(3);
const aimTwist = (arms) => { const M = PB.pose(body, 0, 0, { arms }), p = apply(M.guitar, FAR_END), s = J.spine.at, dx = p[0] - s[0], dz = p[2] - s[2]; return Math.atan2(-dz, dx) - Math.acos(Math.max(-1, Math.min(1, -s[0] / hypot(dx, dz)))); };
const smooth = (s) => { s = Math.max(0, Math.min(1, s)); return s * s * (3 - 2 * s); };
const lerp2 = (a, b, q) => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q];
function poseAt(u, hit, side) {
  const top = [ARMS_UP, hit[1] + side * COIL], other = [ARMS_UP, hit[1] - side * COIL];
  if (u < 0.5) { return lerp2([0, 0], top, smooth(u / 0.5)); }
  if (u < 1) { const q = (u - 0.5) / 0.5; return lerp2(top, hit, q * q); }
  if (u < 1.5) { const q = (u - 1) / 0.5; return lerp2(hit, other, q * (2 - q)); }
  return lerp2(other, [0, 0], smooth((u - 1.5) / 0.5));
}
const least = (A, Bs) => { let m = 1e9; for (const a of A) { for (const b of Bs) { const d = hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (d < m) { m = d; } } } return m; };
const out = { FAR_END, E0_deg: deg(E0), Y_SH, ARMS_UP_deg: deg(ARMS_UP), rho: best, cases: [] }, bad = [];
let worstHead = 1e9, worstHat = 1e9, worstLegs = 1e9;
for (const e of [-90, -62, -45, -30, -15, 0, 11.8, 30]) {
  const arms = Math.max(0, Math.min(ARMS_UP, E0 + e * Math.PI / 180)), hit = [arms, aimTwist(arms)];
  for (const side of [1, -1]) {
    for (const [phase, amount] of [[0, 0], [Math.PI / 2, 1], [Math.PI, 1], [1.5 * Math.PI, 1]]) {
      let mh = 1e9, mt = 1e9, ml = 1e9;
      for (let i = 0; i <= 32; i += 1) {
        const u = i / 16, a = poseAt(u, hit, side), M = PB.pose(body, phase, amount, { arms: a[0], twist: a[1] });
        const mov = cellsOf(["arm_right", "arm_left", "guitar"], M), hc = apply(M.head, body.head.centre);
        for (const q of mov) { mh = Math.min(mh, hypot(q[0] - hc[0], q[1] - hc[1], q[2] - hc[2]) - r0); }
        if (i % 4 === 0) {
          mt = Math.min(mt, least(mov, cellsOf(["hat"], M)) - h);
          ml = Math.min(ml, least(cellsOf(["arm_right", "arm_left"], M).concat(cellsOf(["guitar"], M)), cellsOf(["thigh_right", "shin_right", "thigh_left", "shin_left"], M)) - h);
        }
      }
      worstHead = Math.min(worstHead, mh); worstHat = Math.min(worstHat, mt); worstLegs = Math.min(worstLegs, ml);
      out.cases.push({ elev_deg: e, arms_hit_deg: deg(arms), twist_hit_deg: deg(hit[1]), side, phase: +phase.toFixed(3), amount, head_m: +mh.toFixed(5), hat_m: +mt.toFixed(4), legs_m: +ml.toFixed(4) });
      if (mh < -1e-9) { bad.push("head " + e + " " + side + " " + phase); }
      if (mt < h) { bad.push("hat " + e + " " + side + " " + phase); }
    }
  }
}
out.worst = { head_m: worstHead, hat_m: worstHat, legs_m: worstLegs };
fs.writeFileSync(process.argv[3] || "smash_check.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify({ FAR_END, E0_deg: deg(E0), Y_SH: +Y_SH.toFixed(5), ARMS_UP_deg: deg(ARMS_UP), rho: +best.toFixed(5), worst: out.worst }));
console.log(bad.length ? "FAULTS " + bad.join("; ") : "ALL CLEAR: no cell of the arms or guitar enters his head's sphere; the hat stays more than a unit off");
process.exit(bad.length ? 1 : 0);

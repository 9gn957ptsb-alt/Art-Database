// pose.js - test 6.1.18 in Node on the game's own pearl.js: the throwing arm's raise (act.right 0..1 by 1/16) and its
// fling (0..-pi/2 by pi/32), at rest and at the walk's four quarters: no cell of arm_right in the head's sphere.
var PB = require("/home/user/site/docs/worlds/rocket/pearl.js"), spec = require("/home/user/site/docs/worlds/rocket/pearl-body.json");
var body = PB.build(spec, { skip: [6, 26] }), ta = body.throwArm, h = body.cell, r = 3 * h, bad = [];
var check = function (ok, what) { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } };
function ap(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
var arm = body.parts.filter(function (p) { return p.name === "arm_right"; })[0], half = h * Math.sqrt(3) / 2, R = body.head.radius;
var least = 9, at = null;
[[0, 0], [0, 1], [Math.PI / 2, 1], [Math.PI, 1], [1.5 * Math.PI, 1]].forEach(function (q) {
  var acts = [];
  for (var s = 0; s <= 1.0001; s += 1 / 16) { acts.push({ right: s }); }
  for (var f = 0; f >= -Math.PI / 2 - 1e-9; f -= Math.PI / 32) { acts.push({ right: 1, fling: f }); }
  acts.forEach(function (a) {
    var M = PB.pose(body, q[0], q[1], a), c = ap(M.head, body.head.centre);
    arm.blocks.forEach(function (b) { var p = ap(M.arm_right, [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5]), g = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - half - R; if (g < least) { least = g; at = { phase: q, act: a }; } });
  });
});
console.log("a1", (ta.a1 * 180 / Math.PI).toFixed(3), "a2", (ta.a2 * 180 / Math.PI).toFixed(3), "least gap", least.toFixed(4), JSON.stringify(at));
check(Math.abs(ta.a2 * 180 / Math.PI - 128.22) < 0.01, "throwArm.a2 = 128.22 deg (" + (ta.a2 * 180 / Math.PI).toFixed(3) + ")");
check(least >= 0.049 - 1e-4, "no cell of arm_right enters the head's sphere over the raise, the fling and the walk (least gap " + (least * 100).toFixed(2) + " cm)");
var q = [ta.palm[0] + ta.fore[0] * r, ta.palm[1] + ta.fore[1] * r, ta.palm[2] + ta.fore[2] * r], HOLD = [0, 1, 2].map(function (k) { return (q[k] - arm.org[k]) / h; });
var HA = ap(PB.pose(body, 0, 0, { right: 1 }).arm_right, HOLD);
console.log("HOLD_AT", HA.map(function (v) { return +v.toFixed(5); }));
check(Math.hypot(HA[0] - 0.38536, HA[1] - 1.41552, HA[2] + 0.03399) < 1e-4, "the pearl in the raised glove at (0.385, 1.416, -0.034)");
// nothing else of the pose moves: with act {right: 0} every part is as with no act
var M0 = PB.pose(body, 1, 1), M1 = PB.pose(body, 1, 1, { right: 0, fling: 0 }), same = Object.keys(M0).every(function (k) { return M0[k].every(function (v, i) { return Math.abs(v - M1[k][i]) < 1e-12; }); });
check(same, "act {right: 0, fling: 0} leaves every part as at rest");
console.log(bad.length ? "FAILED" : "ALL OK");
process.exit(bad.length ? 1 : 0);

// hat.js - the doffed hat's way from his head to his left glove: does it pass through him? The straight way (the
// spec's: HAT_DOFF * e) against the one built (out to his left over the raise's first half, then down).
var PB = require(__dirname + "/../../../../docs/worlds/rocket/pearl.js"), spec = require(__dirname + "/../../../../docs/worlds/rocket/pearl-body.json");
var body = PB.build(spec, { skip: [6, 26] }), h = body.cell;
function ap(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
function smooth(s) { s = Math.max(0, Math.min(1, s)); return s * s * (3 - 2 * s); }
var hat = body.parts.filter(function (p) { return p.name === "hat"; })[0], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
hat.blocks.forEach(function (b) { for (var k = 0; k < 3; k++) { var v = hat.org[k] + (b[k] + 0.5) * h; lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); } });
var palm = null; spec.form.primitives.forEach(function (p) { if (p.part === "glove_left_palm") { palm = PB.toGame(p.c); } });
var DOFF = [palm[0] - hi[0], palm[1] - (lo[1] + hi[1]) / 2, palm[2] - (lo[2] + hi[2]) / 2];
var M = PB.pose(body, 0, 0, { right: 1 }), others = [];
body.parts.forEach(function (p) { if (p.empty || p.name === "hat" || p.name === "arm_right") { return; } p.blocks.forEach(function (b) { others.push([ap(M[p.name], [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5]), p.name]); }); });
var hc = body.head.centre, R = body.head.radius;
function worst(path) {
  var g = 9, at = null;
  for (var e = 0; e <= 1.0001; e += 1 / 32) {
    var off = path(e), cnt = {};
    hat.blocks.forEach(function (b) {
      var q = ap(M.hat, [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5]); q = [q[0] + off[0], q[1] + off[1], q[2] + off[2]];
      var dh = Math.hypot(q[0] - hc[0], q[1] - hc[1], q[2] - hc[2]) - R;
      if (dh < -h) { cnt.head = (cnt.head || 0) + 1; }
      others.forEach(function (o) { var d = Math.max(Math.abs(q[0] - o[0][0]), Math.abs(q[1] - o[0][1]), Math.abs(q[2] - o[0][2])); if (d < h / 2) { cnt[o[1]] = (cnt[o[1]] || 0) + 1; } });
    });
    if (Object.keys(cnt).length) { at = at || []; at.push(e.toFixed(3) + ":" + JSON.stringify(cnt)); }
  }
  return at;
}
console.log("HAT_DOFF", DOFF.map(function (v) { return +v.toFixed(4); }));
var J = function (a) { return a ? a.join("\n  ") : "none"; };
console.log("straight: hat cells within half a cell of him (raise: by part)\n  " + J(worst(function (e) { return [DOFF[0] * e, DOFF[1] * e, DOFF[2] * e]; })));
console.log("built (out, then down):\n  " + J(worst(function (e) { var a = smooth(2 * e), b = smooth(2 * e - 1); return [DOFF[0] * a, DOFF[1] * b, DOFF[2] * a]; })));

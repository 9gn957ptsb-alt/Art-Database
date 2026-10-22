"""gen_glsl.py - turn the primitive list (metres, z up) into a GLSL ES 3.00 scene: float mapScene(vec3 p, out int mat)
with one bounding sphere per group of parts (a ray far from a group never evaluates its parts), plus the head's
painted eyes. The output is pasted into pearl_view.html with pearl.glsl."""
import json, math
import numpy as np
from prims import bound

GROUP_IDS = ['pearl', 'eye', 'hat', 'band', 'jacket', 'trousers', 'glove', 'shoe', 'guitar', 'fretboard', 'dark',
             'tuner', 'strap', 'neck']

# parts gathered into bounding clusters (by name prefix)
CLUSTERS = [
    ('head', ('head',)),
    ('hat', ('hat_',)),
    ('torso', ('neck', 'collar', 'chest', 'yoke', 'waist', 'hips', 'shoulder_')),
    ('arm_r', ('upper_arm_right', 'forearm_right', 'cuff_right', 'glove_right')),
    ('arm_l', ('upper_arm_left', 'forearm_left', 'cuff_left', 'glove_left')),
    ('guitar', ('guitar_',)),
    ('legs', ('thigh_', 'flare_', 'shoe_')),
    ('strap', ('strap_',)),
]


def f(x):
    return '%.5f' % x


def v3(a):
    return 'vec3(%s, %s, %s)' % tuple(f(x) for x in a)


def m3(R):
    R = np.asarray(R, float)
    # GLSL mat3 is column-major: mat3(col0, col1, col2); world = c + R loc  ->  loc = R^T (p - c)
    return 'mat3(%s)' % ', '.join(f(x) for x in R.T.ravel()) if False else 'mat3(%s)' % ', '.join(f(x) for x in R.ravel(order='F'))


def call(pr):
    k = pr['kind']
    if k == 'sphere':
        return 'length(p - %s) - %s' % (v3(pr['c']), f(pr['r']))
    if k == 'ellipsoid':
        return 'sdEllipsoid(transpose(%s) * (p - %s), %s)' % (m3(pr['R']), v3(pr['c']), v3(pr['radii']))
    if k == 'capsule':
        return 'sdCapsule(p, %s, %s, %s)' % (v3(pr['a']), v3(pr['b']), f(pr['r']))
    if k == 'roundcone':
        return 'sdRoundCone(p, %s, %s, %s, %s)' % (v3(pr['a']), v3(pr['b']), f(pr['ra']), f(pr['rb']))
    if k == 'cappedcone':
        return 'sdCappedCone(p, %s, %s, %s, %s)' % (v3(pr['a']), v3(pr['b']), f(pr['ra']), f(pr['rb']))
    if k == 'roundbox':
        return 'sdRoundBox(transpose(%s) * (p - %s), %s, %s)' % (m3(pr['R']), v3(pr['c']), v3(pr['half']), f(pr['round']))
    if k == 'torus':
        return 'sdTorusZ(transpose(%s) * (p - %s), %s, %s)' % (m3(pr['R']), v3(pr['c']), f(pr['major']), f(pr['minor']))
    if k == 'dome':
        return 'sdDome(transpose(%s) * (p - %s), %s)' % (m3(pr['R']), v3(pr['c']), v3(pr['radii']))
    if k == 'dish':
        return 'sdDish(transpose(%s) * (p - %s), %s, %s, %s, %s)' % (m3(pr['R']), v3(pr['c']), f(pr['Rs']), f(pr['t']),
                                                                     f(pr['r_in']), f(pr['r_out']))
    raise ValueError(k)


SDF_LIB = r"""
// ---- exact SDFs of the pearl.json kinds (Inigo Quilez's formulas; ellipsoid and dome are bounds) ----
float sdEllipsoid(vec3 q, vec3 r) { float k0 = length(q / r); float k1 = length(q / (r * r)); return k0 * (k0 - 1.0) / max(k1, 1e-9); }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
    vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
    vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
    float rba = rb - ra; float baba = dot(b - a, b - a); float papa = dot(p - a, p - a); float paba = dot(p - a, b - a) / baba;
    float x = sqrt(max(papa - paba * paba * baba, 0.0));
    float cax = max(0.0, x - ((paba < 0.5) ? ra : rb)); float cay = abs(paba - 0.5) - 0.5;
    float k = rba * rba + baba; float f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
    float cbx = x - ra - f * rba; float cby = paba - f;
    float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
    return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
}
float sdRoundBox(vec3 q, vec3 h, float r) { vec3 d = abs(q) - (h - r); return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r; }
float sdTorusZ(vec3 q, float R, float r) { return length(vec2(length(q.xy) - R, q.z)) - r; }
float sdDome(vec3 q, vec3 r) { return max(sdEllipsoid(q, r), -q.z); }
float sdDish(vec3 q, float Rs, float t, float rin, float rout) {
    float rad = length(q.xy);
    float ds = abs(length(q - vec3(0.0, 0.0, -Rs)) - Rs) - 0.5 * t;
    return max(max(ds, rad - rout), rin - rad);
}
"""


def scene(prims, head=None, cluster_margin=0.02):
    parts = {pr['part']: i for i, pr in enumerate(prims)}
    used = set()
    lines = ['float mapScene(vec3 p, out int mat) {', '    float best = 1e9; float d; mat = -1;']
    for cname, prefixes in CLUSTERS:
        members = [i for i, pr in enumerate(prims) if any(pr['part'].startswith(px) for px in prefixes) and i not in used]
        if not members:
            continue
        used.update(members)
        # bounding sphere of the cluster
        cs = [bound(prims[i]) for i in members]
        lo = np.min([c - r for c, r in cs], axis=0); hi = np.max([c + r for c, r in cs], axis=0)
        cc = (lo + hi) / 2
        rr = max(np.linalg.norm(c - cc) + r for c, r in cs) + cluster_margin
        lines.append('    // %s (%d parts)' % (cname, len(members)))
        lines.append('    d = length(p - %s) - %s;' % (v3(cc), f(rr)))
        lines.append('    if (d > best) { } else if (d > 0.05) { best = min(best, d + 0.0); } else {')
        for i in members:
            g = GROUP_IDS.index(prims[i]['group'])
            lines.append('        d = %s; if (d < best) { best = d; mat = %d; }   // %s' % (call(prims[i]), g, prims[i]['part']))
        lines.append('    }')
    rest = [i for i in range(len(prims)) if i not in used]
    for i in rest:
        g = GROUP_IDS.index(prims[i]['group'])
        lines.append('    d = %s; if (d < best) { best = d; mat = %d; }   // %s' % (call(prims[i]), g, prims[i]['part']))
    lines.append('    return best;')
    lines.append('}')
    out = SDF_LIB + '\n'.join(lines) + '\n'
    if head is not None:
        out += eyes_glsl(head)
    return out


def eyes_glsl(head):
    """float eyePaint(vec3 p): 1 inside a painted eye on the head sphere (tangent-plane ellipses)"""
    c, r = head['c'], head['r']
    L = ['const vec3 HEAD_C = %s; const float HEAD_R = %s;' % (v3(c), f(r)),
         'float eyePaint(vec3 p) {', '    vec3 q = (p - HEAD_C) / HEAD_R; float m = 0.0;']
    for e in head['eyes']:
        e = np.asarray(e, float); e /= np.linalg.norm(e)
        up = np.array([0, 0, 1.0]) - e * e[2]; up /= np.linalg.norm(up)
        side = np.cross(up, e)
        L.append('    { vec3 e = %s, u = %s, s = %s; float x = dot(q, s) / %s, y = dot(q, u) / %s;'
                 % (v3(e), v3(up), v3(side), f(head['hw']), f(head['hh'])))
        L.append('      float k = x * x + y * y; if (dot(q, e) > 0.0) m = max(m, 1.0 - smoothstep(0.92, 1.0, k)); }')
    L.append('    return m;')
    L.append('}')
    return '\n'.join(L) + '\n'

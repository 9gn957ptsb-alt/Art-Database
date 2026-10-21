#!/usr/bin/env python3
"""Check a compiled build plan: every solid closed and positive, and no two solids sharing
volume (sampled). Prints a summary; exits non-zero on problems.

    python3 residential/tools/check.py build/<slug>.plan.json
"""
import json
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import primitives  # noqa: E402

primitives.math = math


def tris(F, V):
    out = []
    for fc in F:
        loops = fc[1:]
        # fan-triangulate each loop; holes contribute with their (opposite) winding, which
        # keeps ray-parity tests exact for straight-through holes
        for lp in loops:
            for i in range(1, len(lp) - 1):
                out.append((V[lp[0]], V[lp[i]], V[lp[i + 1]]))
    return out


def ray_hits(p, T):
    """Count crossings of the +x ray from p with triangles (Moller-Trumbore)."""
    n = 0
    for a, b, c in T:
        e1 = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
        e2 = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
        d = (1.0, 1e-7, 2e-7)
        h = (d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0])
        det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]
        if abs(det) < 1e-12:
            continue
        f = 1.0 / det
        s = (p[0] - a[0], p[1] - a[1], p[2] - a[2])
        u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2])
        if u < 0 or u > 1:
            continue
        q = (s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0])
        v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2])
        if v < 0 or u + v > 1:
            continue
        if f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) > 1e-9:
            n += 1
    return n


def main(path, samples="400"):
    samples = int(samples)
    plan = json.load(open(path))
    random.seed(1)
    L = plan["leaves"]
    R = [primitives.realize(lf["k"], lf["s"]) for lf in L]
    W = [[(x * 39.37007874015748, y * 39.37007874015748, z * 39.37007874015748) for x, y, z in V] for V, F in R]
    boxes = [(tuple(min(v[k] for v in V) for k in range(3)), tuple(max(v[k] for v in V) for k in range(3))) for V in W]
    T = [tris(F, V) for (_, F), V in zip(R, W)]
    problems = 0
    for i in range(len(L)):
        for j in range(i + 1, len(L)):
            a, b = boxes[i], boxes[j]
            lo = [max(a[0][k], b[0][k]) for k in range(3)]
            hi = [min(a[1][k], b[1][k]) for k in range(3)]
            if any(hi[k] - lo[k] < 0.5 for k in range(3)):      # under half an inch: tolerated
                continue
            inside = 0
            for _ in range(int(samples)):
                p = tuple(lo[k] + (hi[k] - lo[k]) * random.random() for k in range(3))
                if ray_hits(p, T[i]) % 2 and ray_hits(p, T[j]) % 2:
                    inside += 1
            if inside:
                vol = inside / samples * (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2])
                if vol > 30:                                   # in^3: ~0.5 litre
                    g1, g2 = plan["groups"][L[i]["g"]]["path"][-1], plan["groups"][L[j]["g"]]["path"][-1]
                    print(f"overlap ~{vol / 61023.7:.4f} m3: {g1} / {L[i]['n']}  x  {g2} / {L[j]['n']}")
                    problems += 1
    print(f"{plan['slug']}: {len(L)} solids checked, {problems} overlaps")
    return problems


if __name__ == "__main__":
    sys.exit(1 if main(*sys.argv[1:]) else 0)

# Checks the grip parts before they go to SketchUp: every offset ring simple, holes inside the outline, each part a closed
# solid, both rings inside the track at every click; then both little-finger versions (variants.py): closed, no edge SketchUp
# would merge, the open well's end bar and the stop on its cut rails, the sliding tang clear of the body at every click.
# Needs numpy, shapely, trimesh (with manifold3d), triangle, scipy.
import math, os, numpy as np, trimesh, triangle as tr
from shapely.geometry import Polygon
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gen.py")).read()); exec(open(os.path.join(HERE, "outlines.py")).read())
P = grip_parts()
def build(name, spec):
    mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq, swap = spec
    verts, tris, bottom, topf, groups = plate_mesh(math, outline, holes, R, RH, wbot, wt0, wt1, nq)
    for gi, rs in enumerate(groups):
        for k, r in enumerate(rs):
            assert Polygon([(a, b) for a, b, _ in r]).is_valid, (name, gi, k)
    for k in range(len(groups[0])):
        outer = Polygon([(a, b) for a, b, _ in groups[0][k]])
        for gi in range(1, len(groups)):
            assert outer.contains(Polygon([(a, b) for a, b, _ in groups[gi][min(k, len(groups[gi]) - 1)]])), (name, "hole leaves", k)
    V = np.array(verts); F = [list(t) for t in tris]
    for outer, inners in (bottom, topf):
        loops = [outer] + inners
        P2 = np.array([[V[i][0], V[i][1]] for L in loops for i in L]); segs, off = [], 0
        for L in loops:
            segs += [(off + k, off + (k + 1) % len(L)) for k in range(len(L))]; off += len(L)
        args = {"vertices": P2, "segments": np.array(segs)}
        if inners: args["holes"] = np.array([list(Polygon([(V[i][0], V[i][1]) for i in L]).representative_point().coords[0]) for L in inners])
        res = tr.triangulate(args, "p"); assert len(res["vertices"]) == len(P2)
        idx = [i for L in loops for i in L]; F += [[idx[t[0]], idx[t[1]], idx[t[2]]] for t in res["triangles"]]
    if swap: V = V[:, [0, 2, 1]]                      # outline (s, w), plate along y -> (s, y, w)
    m = trimesh.Trimesh(V, np.array(F), process=True); trimesh.repair.fix_normals(m)
    assert m.is_watertight and m.volume > 0, name
    edge = min(math.dist(verts[t[i]], verts[t[(i + 1) % 3]]) for t in tris for i in range(3))
    assert edge > 0.1, (name, "edge too short for SketchUp", edge)
    print(f"{name:20s} tris {len(m.faces):6d} vol {m.volume/1000:6.2f} cm3 euler {m.euler_number} s {V[:,0].min():.2f}..{V[:,0].max():.2f} y {V[:,1].min():.2f}..{V[:,1].max():.2f} w {V[:,2].min():.2f}..{V[:,2].max():.2f}")
    return m
M = {n: build(n, s) for n, s in P.items()}
fin = Polygon(frame_inner())
for slide in (0, 2, 4, 6, 8):
    c = Polygon(carriage(Y_HOME - slide, False)); t = Polygon(carriage(-Y_HOME + slide, True))
    print("slide", slide, "bottom inside", fin.contains(c), round(fin.exterior.distance(c), 3), "| top inside", fin.contains(t), round(fin.exterior.distance(t), 3))
print("slot vs frame gap", round(Polygon(stadium(SC - WALL + 1.4, 132)).exterior.distance(Polygon(stadium(SC - WALL + 1.3, 132))), 3))
print("Y_END", round(Y_END, 2), "| grip", round(S_OUT + BULGE - S_IN, 1), "x", round(2 * Y_END, 1), "| triangles", sum(len(m.faces) for m in M.values()))
print("today's grip without the fins, cm3:", round(sum(m.volume for m in M.values()) / 1000, 2), "| silicone", round((M["Grip Body"].volume + M["Ring Liner Top"].volume + M["Ring Liner Bottom"].volume) / 1000, 2))

# ---------- the two little-finger versions (variants.py, outlines from pinky.py) ----------
import sys; sys.path.insert(0, HERE); import meshes
from shapely.geometry import Point
NS = meshes.NS; VP = NS["variant_parts"]()
for key, parts in VP.items():
    for name, spec in parts.items():
        m = meshes.mesh(spec); verts, tris = spec[2], spec[3]
        assert m.is_watertight and m.volume > 0, (key, name)
        loops = [L for o, hs in spec[4] for L in [o] + hs]
        edge = min([math.dist(verts[t[i]], verts[t[(i + 1) % 3]]) for t in tris for i in range(3)] + [math.dist(verts[L[i]], verts[L[(i + 1) % len(L)]]) for L in loops for i in range(len(L))])
        assert edge > 0.05, (key, name, "edge too short for SketchUp", edge)
        for o, hs in spec[4]:
            po = Polygon([verts[i][:2] for i in o]); assert po.is_valid, (key, name)
            for h in hs: assert po.contains(Polygon([verts[i][:2] for i in h])), (key, name, "hole leaves the face")
        V = np.array(verts)
        print(f"{key} {name:18s} tris {len(m.faces):6d} vol {m.volume/1000:6.3f} cm3 pieces {len(m.split(only_watertight=False))} min edge {edge:.2f} "
              f"s {V[:,0].min():.2f}..{V[:,0].max():.2f} y {V[:,1].min():.2f}..{V[:,1].max():.2f} w {V[:,2].min():.2f}..{V[:,2].max():.2f}")
# Open well: the bar that closes each well holds the body's outer half on; the cut track is two rails whose stops still hold the carriages
W = NS["WELL"]; body = Polygon(body_outline(y_end=Y_END + W["longer"])); hole = Polygon(NS["pairs"](NS["WELL_HOLE"]))
print("open well: bar across the well's end %.2f mm wide (silicone; the carbon track is cut), carriage wall where it is thinned %.2f mm carbon"
      % (body.exterior.distance(hole), RO - W["trim"]["d"] - RI))
assert body.exterior.distance(hole) > W["bridge"] - 0.1 and len(meshes.mesh(VP["well"]["Grip Body"]).split(only_watertight=False)) == 1
rails = [Polygon(NS["pairs"](f)) for f in (NS["WELL_TRACK_HINGE"], NS["WELL_TRACK_FREE"])]
for slide in (0, 2, 4, 6, 8, 8.6):
    for tag, cy, flip in (("Bottom", Y_HOME - slide, False), ("Top", -Y_HOME + slide, True)):
        c = Polygon(NS["carriage_trimmed"](cy, flip)[0]); hits = [c.intersection(r).area for r in rails]
        if slide <= TRAVEL: assert max(hits) == 0, (slide, tag, hits)
        else: assert hits[0] > 0, (tag, "the hinge-side rail no longer stops the carriage")     # what is left of its end arc
        print(f"  slide {slide} {tag:6s} carriage overlaps the hinge-side / free-side rail {hits[0]:.2f} / {hits[1]:.2f} mm2, nearest {min(c.distance(r) for r in rails):.2f} mm"
              + (" (past the travel: the hinge-side rail stops it)" if slide > TRAVEL else ""))
# Sliding tang: the nose and strap ride with the carriage; at every click they clear the fixed body and track
from scipy.spatial import cKDTree
fixed = [meshes.mesh(VP["tang"][n]) for n in ("Grip Body", "Track Frame")]
trees = [cKDTree(trimesh.sample.sample_surface_even(f, 40000, seed=1)[0]) for f in fixed]
for n in ("Tang Nose Bottom", "Tang Strap Bottom"):
    mv = meshes.mesh(VP["tang"][n]); pts = trimesh.sample.sample_surface_even(mv, 20000, seed=1)[0]
    for slide in (0, 2, 4, 6, 8):
        a = mv.copy(); a.apply_translation([0, -slide, 0])
        inter = sum(a.intersection(f).volume for f in fixed); gap = min(t.query(pts - [0, slide, 0])[0].min() for t in trees)
        assert inter < 0.01, (n, slide, inter)
        print(f"  sliding tang {n:18s} slide {slide}: inside the body or track {inter:.3f} mm3, nearest {gap:.2f} mm")

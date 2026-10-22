import sys; sys.path.insert(0, '.')
from geom import *
X, Y, a, l = arc_path(60001)
seg = np.hypot(np.diff(a), np.diff(l)); arc_len = float(seg.sum())
curved = 2 * RHO * THETA
node = arc_len + 6 * H
tang = np.degrees(np.arctan2(np.gradient(l), np.gradient(a)))
depth = ((3 * H + X) - 3 * Y) / math.sqrt(3)   # centreline depth from start node toward the eye (sigma part + slide)
# angle of the straight part to the line of sight: direction -(e_k+2e_i+2e_j)/3 vs -m/sqrt3
dirv = -np.array([1, 2, 2]) / 3; ang_sight = math.degrees(math.acos(dirv @ (-np.ones(3) / math.sqrt(3))))
# thickness of the true cross-section vs H where the centreline tilts: slice plane contains m; the swept bar's
# perpendicular width in the bend plane = 2H*|sin(angle between tangent and m)| / sin(angle e_k to m)
km = math.acos(1 / math.sqrt(3))
thin = math.sin(math.radians(ang_sight)) / math.sin(km)
out = dict(profile='arc-straight-arc', rho=RHO, turn_deg=math.degrees(THETA), straight=LSTR, max_bend_deg=float(tang.max()),
           min_radius=RHO, bend_arc=arc_len, curved_length_per_beam=curved, beam_centreline_node_to_node=node,
           curved_fraction_of_centreline=curved / node, bend_fraction_of_centreline=arc_len / node,
           drawn_fraction_of_beam_in_bend=1 - 6 * H, sigma_per_piece=[float(X[20000]), float(X[40000] - X[20000]), float(X[-1] - X[40000])],
           depth_peak_above_nodes=float(depth.max()), depth_min=float(depth.min()), straight_angle_to_sight_deg=ang_sight,
           in_plane_width_ratio_on_straight=thin, curvature_continuity='G1 (curvature jumps 0 -> 1/rho at 4 joins)')
print(json.dumps(out, indent=1)); json.dump(out, open(OUT + 'arcs_metrics.json', 'w'), indent=1)

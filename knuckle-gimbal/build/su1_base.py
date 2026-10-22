# Step 1 of the SketchUp build. Run with build_model(clean=True).
# Materials, shared helpers (kept in session_state), the iPhone 18 Pro Max reference, the puck, the arm (45 mm out, fork end block)
# and the grip's hinge barrel and core tab in the hold pose. Units: the API works in inches, so every mm value is multiplied by MM.
MM = 1/25.4
ZP = 8.75
E = 45.0
AZ = 16.5
AX = 34.25 + E

def get_or_create_material(name, r, g, b, a=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing: return existing[name]
    mat = Material(); mat.set_name(name); mat.set_color(SUColor(r, g, b, a)); model.add_materials([mat]); return mat
W = 64; TW = 8; px = []
for y in range(W):
    for x in range(W):
        cx, cy = x // TW, y // TW
        warp = ((cx - cy) % 4) < 2
        u = ((x % TW) + 0.5) / TW if warp else ((y % TW) + 0.5) / TW
        along = ((y % TW) + 0.5) / TW if warp else ((x % TW) + 0.5) / TW
        v = 22 + (14 if warp else 6) + 46 * math.sin(math.pi * u) ** 3 + 1.1 * math.sin(along * 37.0 + cx * 1.7 + cy * 2.3)
        v = max(10, min(110, int(v)))
        px += [v + 6, v + 3, v + 2, 255]
rep = ImageRep(); rep.set_data(bytes(px), W, W, 32, 0)
tex = Texture.from_image_rep(rep); tex.set_dimensions(8 * MM, 8 * MM)
CF = get_or_create_material("Carbon Fiber Twill", 40, 42, 46); CF.set_texture(tex)
ST = get_or_create_material("Stainless Steel", 168, 172, 178)
AL = get_or_create_material("Anodized Aluminum", 92, 96, 104)
CU = get_or_create_material("Copper Windings", 184, 115, 51)
BAT = get_or_create_material("Battery Pouch", 150, 156, 168)
PCB = get_or_create_material("Circuit Board", 28, 52, 40)
DK = get_or_create_material("Port Black", 20, 20, 22)
LED = get_or_create_material("Status LED", 120, 220, 170)
PH = get_or_create_material("Phone Graphite", 58, 60, 64)
LG = get_or_create_material("Lens Glass", 18, 20, 24)
SI = get_or_create_material("Soft-Touch Silicone", 74, 71, 68)

def circ(cx, cy, r, n, a0=0.0):
    return [(cx + r * math.cos(a0 + 2 * math.pi * i / n), cy + r * math.sin(a0 + 2 * math.pi * i / n)) for i in range(n)]
def arc(cx, cy, r, a0, a1, n):
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
def hull(points):
    pts = sorted(set((round(p[0], 6), round(p[1], 6)) for p in points))
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def rrect(x0, y0, x1, y1, r, n=8):
    pts = []
    for (cx, cy, a0) in [(x1 - r, y0 + r, -math.pi/2), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, math.pi/2), (x0 + r, y0 + r, math.pi)]:
        for j in range(n + 1):
            a = a0 + (math.pi/2) * j / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts
def lo_(ids):
    lp = LoopInput()
    for i in ids: lp.add_vertex_index(i)
    return lp
def extrude(outer, holes, w0, w1, mapf=lambda u, v, w: (u, v, w)):
    loops = [outer] + holes; verts, idx = [], []
    for L in loops:
        b = list(range(len(verts), len(verts) + len(L))); verts += [mapf(u, v, w0) for (u, v) in L]
        t = list(range(len(verts), len(verts) + len(L))); verts += [mapf(u, v, w1) for (u, v) in L]
        idx.append((b, t))
    g = GeometryInput(); g.set_vertices([SUPoint3D(x * MM, y * MM, z * MM) for (x, y, z) in verts])
    ob, ot = idx[0]
    fi, g = g.add_face(lo_(list(reversed(ob))))
    for (hb, ht) in idx[1:]: g = g.face_add_inner_loop(fi, lo_(hb))
    fi, g = g.add_face(lo_(ot))
    for (hb, ht) in idx[1:]: g = g.face_add_inner_loop(fi, lo_(list(reversed(ht))))
    n = len(ob)
    for i in range(n):
        i2 = (i + 1) % n; _, g = g.add_face(lo_([ob[i], ob[i2], ot[i2], ot[i]]))
    for (hb, ht) in idx[1:]:
        m = len(hb)
        for i in range(m):
            i2 = (i + 1) % m; _, g = g.add_face(lo_([hb[i2], hb[i], ht[i], ht[i2]]))
    return g
def revolve(profile, n, cx=0.0, cy=0.0, z_off=0.0):
    P = len(profile); verts = []
    for (r, z) in profile:
        for j in range(n):
            a = 2 * math.pi * j / n
            verts.append(SUPoint3D((cx + r * math.cos(a)) * MM, (cy + r * math.sin(a)) * MM, (z + z_off) * MM))
    g = GeometryInput(); g.set_vertices(verts)
    for k in range(P):
        k2 = (k + 1) % P
        for j in range(n):
            j2 = (j + 1) % n; _, g = g.add_face(lo_([k * n + j, k * n + j2, k2 * n + j2, k2 * n + j]))
    return g
def soften(ents, deg=35):
    c = math.cos(math.radians(deg))
    for e in ents.get_edges():
        fs = e.get_faces()
        if len(fs) == 2:
            a, b = fs[0].get_normal(), fs[1].get_normal()
            if a.x*b.x + a.y*b.y + a.z*b.z > c: e.set_soft(True); e.set_smooth(True)
def orient_out(ents):
    s = 0.0
    for f in ents.get_faces():
        nr = f.get_normal(); vs = f.get_vertices()
        px_ = sum(v.get_position().x for v in vs) / len(vs); py_ = sum(v.get_position().y for v in vs) / len(vs); pz_ = sum(v.get_position().z for v in vs) / len(vs)
        s += f.get_area() * (nr.x*px_ + nr.y*py_ + nr.z*pz_)
    if s < 0:
        for f in ents.get_faces(): f.reverse()
def part(parent, name, geom, mat):
    grp = Group(); parent.get_entities().add_group(grp)
    grp.get_entities().fill(geom, weld_vertices=True)
    orient_out(grp.get_entities())
    for f in grp.get_entities().get_faces(): f.set_front_material(mat); f.set_back_material(mat)
    soften(grp.get_entities()); grp.set_name(name); return grp
for k, v in dict(circ=circ, arc=arc, hull=hull, rrect=rrect, extrude=extrude, revolve=revolve, part=part, lo_=lo_).items():
    session_state[k] = v

errors = []
phone = Group(); model.get_entities().add_group(phone); phone.set_name("iPhone 18 Pro Max (reference)")
try:
    part(phone, "Phone Body", extrude(rrect(-39, -81.7, 39, 81.7, 12, 10), [], 0, ZP), PH)
    part(phone, "Camera Plateau", extrude(rrect(-35, 33.7, 9, 77.7, 9, 8), [], ZP, ZP + 1.5), PH)
    for i, (lx, ly) in enumerate([(-23.5, 66.2), (-23.5, 45.2), (-3.5, 55.7)]):
        part(phone, "Lens Ring " + str(i + 1), revolve([(4.5, 0), (6.5, 0), (6.5, 1.0), (5.6, 1.4), (4.5, 1.4)], 48, lx, ly, ZP + 1.5), LG)
        part(phone, "Lens Glass " + str(i + 1), extrude(circ(lx, ly, 4.5, 48), [], ZP + 1.5, ZP + 2.6), LG)
except Exception as e: errors.append("phone: " + str(e))

top = Group(); model.get_entities().add_group(top); top.set_name("Knuckle")
yz = lambda u, v, w: (w, u, ZP + v)
rotor = Group(); top.get_entities().add_group(rotor); rotor.set_name("Rotor")
try:
    part(rotor, "MagSafe Face", revolve([(2.0, 0.0), (27.0, 0.0), (28.0, 0.6), (28.0, 2.0), (2.0, 2.0)], 96, z_off=ZP), CF)
    part(rotor, "Motor Rotor Can", revolve([(2.0, 2.0), (14.0, 2.0), (14.0, 6.6), (12.8, 6.6), (12.8, 3.0), (2.0, 3.0)], 64, z_off=ZP), AL)
except Exception as e: errors.append("rotor: " + str(e))
body = Group(); top.get_entities().add_group(body); body.set_name("Body")
try:
    part(body, "Puck Shell", revolve([(26.5, 2.5), (28.0, 2.5), (28.0, 10.6), (27.1, 11.5), (5.2, 11.5), (5.2, 10.0), (26.5, 10.0)], 96, z_off=ZP), CF)
    part(body, "Motor Stator", revolve([(2.2, 3.4), (12.4, 3.4), (12.4, 6.4), (5.0, 6.4), (5.0, 11.5), (2.2, 11.5)], 64, z_off=ZP), CU)
    a0, a1 = math.radians(-45), math.radians(225)
    part(body, "Curved Battery", extrude(arc(0, 0, 25.5, a0, a1, 48) + list(reversed(arc(0, 0, 15.5, a0, a1, 32))), [], ZP + 3.0, ZP + 7.2), BAT)
    part(body, "Control Board", extrude(circ(0, 0, 26.0, 96), [circ(0, 0, 5.6, 48)], ZP + 7.6, ZP + 8.6), PCB)
    part(body, "USB-C Port", extrude(rrect(-4.5, ZP + 4.0, 4.5, ZP + 7.2, 1.5, 4), [], -28.25, -27.85, lambda u, v, w: (u, w, v)), DK)
    part(body, "Mode Button", revolve([(0.6, 0), (3.2, 0), (3.2, 0.5), (2.8, 0.8), (0.6, 0.8)], 48, -12.0, -19.0, ZP + 11.5), ST)
    part(body, "Status LED", extrude(circ(-12.0, -13.5, 1.0, 24), [], ZP + 11.5, ZP + 11.75), LED)
    part(body, "Slide Rail", extrude([(-9.5, 11.5), (9.5, 11.5), (9.5, 14.5), (-9.5, 14.5)],
                                     [[(-8.5, 12.0), (8.5, 12.0), (8.5, 14.0), (-8.5, 14.0)]], -24.0, 30.0, yz), CF)
except Exception as e: errors.append("body: " + str(e))
arm = Group(); top.get_entities().add_group(arm); arm.set_name("Arm")
try:
    part(arm, "Arm Stage 1", extrude([(-8.4, 12.05), (8.4, 12.05), (8.4, 13.95), (-8.4, 13.95)],
                                     [[(-7.4, 12.55), (7.4, 12.55), (7.4, 13.45), (-7.4, 13.45)]], -23.5 + E / 2, 28.5 + E / 2, yz), AL)
    part(arm, "Arm Stage 2", extrude([(-7.3, 12.6), (7.3, 12.6), (7.3, 13.4), (-7.3, 13.4)], [], -21.0 + E, 31.0 + E, yz), ST)
    fork = [(AX - 6.0, -12.8), (AX + 2.6, -12.8), (AX + 2.6, -7.75), (AX - 2.75, -7.75),
            (AX - 2.75, 7.75), (AX + 2.6, 7.75), (AX + 2.6, 12.8), (AX - 6.0, 12.8)]
    part(arm, "End Block", extrude(fork, [], ZP + 12.0, ZP + 14.2), CF)
    lug = hull([(AX - 2.4, 14.2), (AX + 2.4, 14.2)] + [p for p in circ(AX, AZ, 2.4, 48) if p[1] >= 14.2])
    for nm, y0, y1 in [("Hinge Lug Top", 7.8, 12.8), ("Hinge Lug Bottom", -12.8, -7.8)]:
        part(arm, nm, extrude(lug, [circ(AX, AZ, 1.1, 24)], y0, y1, lambda u, v, w: (u, w, ZP + v)), CF)
    along = lambda u, v, w: (AX + u, w, ZP + AZ + v)
    part(arm, "Hinge Bolt M2", extrude(circ(0, 0, 1.0, 24), [], -12.8, 12.8, along), ST)
    part(arm, "Bolt Head", extrude(circ(0, 0, 1.9, 32), [circ(0, 0, 0.75, 6)], -14.4, -12.8, along), ST)
    part(arm, "Nyloc Nut", extrude(circ(0, 0, 2.3, 6, math.pi / 6), [], 12.8, 14.4, along), ST)
except Exception as e: errors.append("arm: " + str(e))
grip = Group(); top.get_entities().add_group(grip); grip.set_name("Grip")
try:
    hold = lambda u, v, w: (AX - w, v, ZP + AZ - u)          # grip turned 90 degrees toward the phone
    part(grip, "Hinge Barrel", extrude(circ(0, 0, 2.2, 48), [circ(0, 0, 1.1, 24)], -7.5, 7.5, lambda u, v, w: (AX + u, w, ZP + AZ + v)), CF)
    part(grip, "Grip Core Tab", extrude([(1.9, -7.5), (8.8, -7.5), (8.8, 7.5), (1.9, 7.5)], [], -1.6, 1.6, hold), CF)
except Exception as e: errors.append("grip: " + str(e))
result = {"errors": errors, "groups": [g.get_name() for g in top.get_entities().get_groups()], "materials": len(model.get_materials())}

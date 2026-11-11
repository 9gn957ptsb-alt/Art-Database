# A model page's model (its mh.json) in Blender with a soft look: its own colours, sky light, gentle sun shadows,
# shading where surfaces meet, faint edges. Run: /opt/blender-py3.13/bin/python blender/soft_look.py -- <mh.json> <out.png>
import bpy, json, sys, math, time
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon
src, out = sys.argv[sys.argv.index('--') + 1:][:2]
d = json.load(open(src))
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
mats = []
for m in d['materials']:
    r, g, b, a = m['rgba']
    if m.get('textured') and m.get('texture_avg'): r, g, b = m['texture_avg']
    M = bpy.data.materials.new(m['name']); M.use_nodes = True
    bs = M.node_tree.nodes['Principled BSDF']
    lin = lambda c: (c / 255) ** 2.2
    bs.inputs['Base Color'].default_value = (lin(r), lin(g), lin(b), 1); bs.inputs['Roughness'].default_value = 0.85
    if a < 255: bs.inputs['Alpha'].default_value = max(a / 255, 0.25)
    mats.append(M)
grey = bpy.data.materials.new('none'); grey.use_nodes = True
grey.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
verts, faces, fmat, hv = [], [], [], []
hidden = {g['id'] for g in d['groups'] if g['hidden']}
for g in d['groups']:
    if g['id'] in hidden or not g['faces'] or g.get('zone') == 'line': continue
    x = g['xform']; R = Matrix(((x[0], x[1], x[2]), (x[3], x[4], x[5]), (x[6], x[7], x[8]))); T = Vector(x[9:12])
    for f in g['faces']:
        mi, loops = f[0], [[Vector(l[i:i + 3]) for i in range(0, len(l), 3)] for l in f[1:]]
        loops = [[R @ v + T for v in L] for L in loops if len(L) >= 3]
        if not loops: continue
        flat = [v for L in loops for v in L]
        try: tris = tessellate_polygon(loops)
        except Exception: continue
        base = len(verts); verts.extend(flat)
        if g['zone'] == 'house': hv.extend(flat)
        for t in tris:
            faces.append((base + t[0], base + t[1], base + t[2])); fmat.append(mi)
me = bpy.data.meshes.new('house'); me.from_pydata([tuple(v) for v in verts], [], faces)
for M in mats: me.materials.append(M)
me.materials.append(grey)
me.polygons.foreach_set('material_index', [i if 0 <= i < len(mats) else len(mats) for i in fmat])
ob = bpy.data.objects.new('house', me); S.collection.objects.link(ob)
bpy.ops.mesh.primitive_plane_add(size=800, location=(mid.x if False else 0, 0, -0.03)) if False else None
cam = d['camera']; eye, tgt = Vector(cam['eye']), Vector(cam['target']); mid = eye
cd = bpy.data.cameras.new('cam'); cd.sensor_fit = 'VERTICAL'; cd.angle_y = math.radians(cam['fov_deg']); cd.clip_end = 2000
co = bpy.data.objects.new('cam', cd); S.collection.objects.link(co); co.location = eye
co.rotation_euler = (tgt - eye).to_track_quat('-Z', 'Y').to_euler(); S.camera = co
bpy.ops.mesh.primitive_plane_add(size=1500, location=(mid.x, mid.y, -0.05)); pl = bpy.context.object
bm = bpy.data.materials.new('under'); bm.use_nodes = True; bm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.42, 0.36, 0.29, 1); pl.data.materials.append(bm)
w = bpy.data.worlds.new('sky'); w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.78, 0.84, 0.92, 1); bg.inputs['Strength'].default_value = 0.9; S.world = w
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 2.2; sd.angle = math.radians(12); sd.color = (1.0, 0.95, 0.88)
so = bpy.data.objects.new('sun', sd); S.collection.objects.link(so); so.rotation_euler = (math.radians(48), 0, math.radians(-35))
S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 48; S.cycles.use_denoising = True; S.cycles.max_bounces = 3
S.view_settings.view_transform = 'AgX'; S.view_settings.look = 'AgX - Base Contrast'
S.render.use_freestyle = True; S.render.line_thickness = 0.7
fs = S.view_layers[0].freestyle_settings; ls = fs.linesets[0] if fs.linesets else fs.linesets.new('edges')
if not ls.linestyle: ls.linestyle = bpy.data.linestyles.new('edges')
ls.linestyle.color = (0.18, 0.18, 0.2); ls.linestyle.alpha = 0.55
S.render.resolution_x, S.render.resolution_y = 1280, 800; S.render.filepath = out
t = time.time(); bpy.ops.render.render(write_still=True)
print(len(faces), 'triangles; rendered in %.0f s' % (time.time() - t))

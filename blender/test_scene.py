# A small test scene: three pale columns on a plinth at dusk, rendered with Cycles on the CPU.
import bpy, math, sys, time
out = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
def mat(name, rgb, rough=0.5, emit=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = emit
    return m
stone, ground, glow = mat('stone', (0.86, 0.82, 0.74), 0.6), mat('ground', (0.12, 0.13, 0.16), 0.9), mat('glow', (1.0, 0.62, 0.3), 0.4, 6)
bpy.ops.mesh.primitive_plane_add(size=30); bpy.context.object.data.materials.append(ground)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0.25), scale=(3.2, 1.4, 0.25)); bpy.context.object.data.materials.append(stone)
for i, x in enumerate((-2, 0, 2)):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=3 + i * 0.6, location=(x, 0, 0.5 + (3 + i * 0.6) / 2), vertices=48)
    bpy.context.object.data.materials.append(stone)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, location=(0, 0, 5.2), segments=48, ring_count=24); bpy.context.object.data.materials.append(glow)
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(70), 0, math.radians(-40))); bpy.context.object.data.energy = 2.5
bpy.context.object.data.color = (1.0, 0.75, 0.55)
w = bpy.data.worlds.new('dusk'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.08, 0.1, 0.2, 1); S.world = w
bpy.ops.object.camera_add(location=(7.5, -8.5, 3.6)); cam = bpy.context.object; S.camera = cam
d = bpy.data.objects.new('aim', None); S.collection.objects.link(d); d.location = (0, 0, 2.4)
c = cam.constraints.new('TRACK_TO'); c.target = d
S.render.engine = 'CYCLES'; S.cycles.device = 'CPU'; S.cycles.samples = 64; S.cycles.use_denoising = True
S.render.resolution_x, S.render.resolution_y = 960, 640
S.render.filepath = out + '.png'
t = time.time(); bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=out + '.blend')
print(f'rendered in {time.time() - t:.1f} s ->', out + '.png')

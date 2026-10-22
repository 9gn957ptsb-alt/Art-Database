"""make_all.py - every deliverable from the current fit_params.json (re-runnable)."""
import os, sys, json, time, subprocess
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
import views
from fit import load_params
import gen_glsl
t0 = time.time()
step = sys.argv[1:] or ['views', 'overlay', 'holoflat', 'bases', 'gl', 'json', 'scene']
p = load_params()
rest = dict(p); rest['FACE_YAW'] = 0.0
c1 = dict(p); c1['FACE_YAW'] = 50.0
if 'views' in step:
    views.standard_views(rest, HERE, W=640, H=760, scale=380, which=('front', 'side', 'threequarter', 'back'),
                         sub='rest pose: face forward; the guitar pose; flat study shading')
    views.standard_views(c1, HERE, tag='_cover1pose', W=640, H=760, scale=380, which=('front',), sub='cover-1 pose: face turned 50 deg to his left')
    print('views %.0fs' % (time.time() - t0), flush=True)
if 'overlay' in step:
    views.overlay(c1, HERE)
    im = Image.open(os.path.join(HERE, 'overlay_front_on_pearl1.png'))
    im.crop((330, 280, 980, 1200)).save(os.path.join(HERE, 'overlay_front_on_pearl1_crop.png'))
    print('overlay %.0fs' % (time.time() - t0), flush=True)
if 'holoflat' in step:
    views.holo_flat(rest, os.path.join(HERE, 'render_holo_flat.png'))
    print('holo flat %.0fs' % (time.time() - t0), flush=True)
if 'bases' in step:
    subprocess.run([sys.executable, 'fit_bases.py'], check=True)
    print('bases %.0fs' % (time.time() - t0), flush=True)
if 'gl' in step:
    subprocess.run([sys.executable, 'holo.py', '640'], check=True)
    print('gl %.0fs' % (time.time() - t0), flush=True)
if 'scene' in step:
    pm, head, info = views.model_m(rest)
    open(os.path.join(HERE, 'pearl_scene.glsl'), 'w').write(
        '// Holographic Mr Pearl, rest pose: the primitives of pearl.json as one GLSL ES 3.00 scene (metres, z up)\n'
        '// float mapScene(vec3 p, out int mat): mat = index into GROUP_IDS: ' + ', '.join(gen_glsl.GROUP_IDS) + '\n'
        + gen_glsl.scene(pm, head))
    print('scene %.0fs' % (time.time() - t0), flush=True)
if 'json' in step:
    subprocess.run([sys.executable, 'build_json.py'], check=True)
    print('json %.0fs' % (time.time() - t0), flush=True)

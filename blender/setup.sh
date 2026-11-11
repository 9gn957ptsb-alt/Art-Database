#!/usr/bin/env bash
# Blender 5.3 as a Python module (bpy), headless, in its own environment: about 1 GB, a minute or two.
# Then: /opt/blender-py3.13/bin/python blender/test_scene.py -- <output path without extension>
set -e
UV=$(command -v uv || echo /root/.local/bin/uv)
[ -x /opt/blender-py3.13/bin/python ] || { $UV venv -q --python 3.13 /opt/blender-py3.13 && $UV pip install -q --python /opt/blender-py3.13/bin/python bpy==5.3.0; }
/opt/blender-py3.13/bin/python -c "import bpy; print('Blender', bpy.app.version_string)"

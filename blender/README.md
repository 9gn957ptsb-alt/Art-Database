# Blender in a cloud session

`bash blender/setup.sh` installs Blender 5.3 as a Python module (`bpy`) when a session needs it; it is not in the
environment's setup script, so other sessions do not download its 1 GB at every start. Scripts then run with
`/opt/blender-py3.13/bin/python <script> -- <args>`: scenes, models, materials, cameras, `.blend` files, and renders
with Cycles on the processor (no graphics card here, so EEVEE is out and big renders are slow: `test_scene.py`, 960×640
at 64 samples, took 12.5 s on 11 Nov 2026). Final 4K renders belong on the Mac, from the `.blend`.

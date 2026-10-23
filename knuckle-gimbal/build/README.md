# Knuckle build

How `../sketchup/knuckle.skp` and the web viewer (https://claude.ai/artifact/USqJnrwtiitGV1YgYBAVSQ) are made.

## SketchUp model

Run these with the Trimble SketchUp connector's `build_model` tool, pasting each file's text as the code, in order. Sessions come back empty after about 30 minutes idle, so run the steps back to back.

1. `su1_base.py` with `clean: true`: materials, shared helpers, the iPhone reference, the puck, the arm and the hinge.
2. `su2_grip.py`: the silicone body, the carbon track, and two ring sliders with liners and fins.
3. `su3_style.py`, then `su4_camera.py`: the studio style and the upright camera.
4. `save_model` with the filename `knuckle.skp`. The download link redirects, so fetch it with `curl -L`. Its thumbnail is `../sketchup/knuckle.png`.
5. `su5_export.py`: every face for the viewer. The result is too big to show, so it is saved to a tool-results file.

The grip shapes come from `gen.py` and `outlines.py`, and `su2_grip.py` carries a copy of both. After changing them, run `python3 check_grip.py` (needs numpy, shapely, trimesh and triangle), then paste the new text into `su2_grip.py`.

## Web viewer

Work in a scratch copy of this folder:

```
python3 pack.py <export tool-results file>   # writes mesh_meta.json and mesh_b64.txt
python3 hand_fit.py                           # writes hand_meta.json and hand_b64.txt
python3 build_page.py                         # writes index.html
python3 build_page.py full                    # also tests it in headless Chromium
```

The "Hand" box in the viewer shows a left hand holding the grip. It is the WebXR generic hand (`hand/left.glb`, from `@webxr-input-profiles/assets` 1.0.20, MIT licence in `hand/LICENSE.md`): a skinned mesh with 25 joints, about 190 mm from wrist to fingertip. `hand_fit.py` poses it against the grip parts from `outlines.py`. The index and ring fingers go through the rings, the middle finger through the gap, and the palm faces the phone. It fits an open hand, a closed hand, and each 2 mm click of the ring finger's ring, and checks every skin vertex against a distance field of the grip and the phone. The hand only holds the grip at the hold angle, so the viewer shows it there. The viewer blends those poses with its Fingers and Ring slide controls, and skins the mesh itself, so the 3D view and the basic view both show it. `hand_fit.py` needs numpy, scipy, shapely and pygltflib.

Each script has its own requirements:

- `pack.py` also needs mapbox_earcut.
- `hand_fit.py` needs scipy and pygltflib as well.
- The browser test needs Playwright with Chromium at `/opt/pw-browsers/chromium-1194`, plus three.js r128. Put three.js at `./package/build/three.min.js` (`npm pack three@0.128.0 && tar xzf three-0.128.0.tgz`) or point `THREE_JS` to it.

Publish `index.html` to the same artifact so the link stays the same.

The model is posed with the arm out 45 mm and the grip turned 90° toward the phone. The hinge axis is at x 79.25 mm, 16.5 mm above the phone back. `viewer.html` moves the arm, the grip and the ring slide from that pose, and shows the product standing up the way it is held.

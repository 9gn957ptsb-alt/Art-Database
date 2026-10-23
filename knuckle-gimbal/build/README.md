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
python3 phone.py                              # writes phone_meta.json and phone_b64.txt
python3 hand_range.py                         # adds the grip angles a hand fits to hand_meta.json (about 4 minutes)
python3 build_page.py                         # writes index.html
python3 build_page.py full                    # also tests it in headless Chromium
```

The "Hand" box in the viewer shows a left hand holding the grip. It is the WebXR generic hand (`hand/left.glb`, from `@webxr-input-profiles/assets` 1.0.20, MIT licence in `hand/LICENSE.md`): a skinned mesh with 25 joints, about 190 mm from wrist to fingertip. `hand_fit.py` poses it against the grip parts from `outlines.py`. The index and ring fingers go through the rings, the middle finger through the gap, and the palm faces the phone. It fits an open hand, a closed hand, and each 2 mm click of the ring finger's ring, and checks every skin vertex against a distance field of the grip and the phone. The hand turns with the grip. `hand_range.py` turns the posed hand through every Grip angle and finds the shortest arm extension at which every pose stays 1 mm clear of the phone, the puck and the arm (voxel distance fields of the packed mesh). With the hand in it, the grip turns from −123° to 90°; further back the hand would run into the puck. The viewer stops the Grip slider there and pushes the arm out as far as that angle needs. The forearm isn't modelled. The viewer blends those poses with its Fingers and Ring slide controls, and skins the mesh itself, so the 3D view and the basic view both show it. `hand_fit.py` needs numpy, scipy, shapely and pygltflib.

The "Phone" box shows an orange iPhone 17 Pro Max on the MagSafe face, centred on the puck. `phone.py` builds it as closed meshes. Its size comes from Apple's tech specs: 163.4 × 78.0 × 8.75 mm. The camera bar is 2.5 mm proud and the lenses 4.2 mm, from measurements of a dummy unit. The rest is estimated from photos: the bar's lower edge 37.7 mm above the centre, the lens, flash and button positions, the corner radius and the colour. Apple doesn't publish where the MagSafe ring sits. `phone.py` also gives `hand_range.py` a distance function for the phone. With the grip folded flat (stowed), the top fin clears the camera bar by about 0.5 mm. It's the phone, not the product, so it isn't in the SketchUp file, which still has its iPhone 18 Pro Max reference.

Each script has its own requirements:

- `pack.py` also needs mapbox_earcut.
- `hand_fit.py` needs scipy and pygltflib as well.
- `phone.py` needs numpy, trimesh and triangle; `hand_range.py` needs numpy, scipy and trimesh.
- The browser test needs Playwright with Chromium at `/opt/pw-browsers/chromium-1194`, plus three.js r128. Put three.js at `./package/build/three.min.js` (`npm pack three@0.128.0 && tar xzf three-0.128.0.tgz`) or point `THREE_JS` to it.

Publish `index.html` to the same artifact so the link stays the same.

The model is posed with the arm out 45 mm and the grip turned 90° toward the phone. The hinge axis is at x 79.25 mm, 16.5 mm above the phone back. `viewer.html` moves the arm, the grip and the ring slide from that pose, and shows the product standing up the way it is held. The phone's back is at z 0 and its screen at z −8.75.

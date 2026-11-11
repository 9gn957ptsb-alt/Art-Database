# Knuckle build

How `../sketchup/knuckle.skp` and the web viewer (https://claude.ai/artifact/USqJnrwtiitGV1YgYBAVSQ) are made.

## SketchUp model

Run these with the Trimble SketchUp connector's `build_model` tool, pasting each file's text as the code, in order. Sessions come back empty after about 30 minutes idle, so run the steps back to back.

1. `su1_base.py` with `clean: true`: materials, shared helpers, the iPhone reference, the puck, the arm and the hinge.
2. `su2_grip.py`: the grip in its two little-finger versions, Open well and Sliding tang (below). Each version is a group on its own tag, with a scene that shows only it; the file opens on Open well. Both versions' parts are closed solids.
3. `su3_style.py`, then `su4_camera.py`: the studio style and the upright camera.
4. `save_model` with the filename `knuckle.skp`. The download link redirects, so fetch it with `curl -L`. Its thumbnail is `../sketchup/knuckle.png`.
5. `su5_export.py`: every face for the viewer. The result is too big to show, so it is saved to a tool-results file.

The grip shapes come from `gen.py` (the rounded-edge plate generator), `outlines.py` (today's grip without the fins) and `variants.py` (the two versions). SketchUp's connector has no booleans, so the outlines that need them (the well, the cut track, the relieved corner, the strap) are worked out by `pinky.py` with shapely and written to `pinky_data.py` as lists with checksums. `pinky.py` then writes `su2_grip.py` by joining `gen.py`, `outlines.py`, `pinky_data.py`, `variants.py` and `su2_place.py`; don't edit it by hand. After changing any of them, run `python3 pinky.py` and `python3 check_grip.py`. The check needs numpy, shapely, trimesh with manifold3d, triangle and scipy. It confirms every part is closed and has no edge short enough for SketchUp to merge. It also checks the Open well's end bar and the stops on its cut track, and that the Sliding tang's nose and strap clear the body at every click.

## Little-finger versions

The fins are gone. The grip's ends come in two versions, built the same at both ends so the right hand's little finger gets the same at the top end:

- **Open well**: a well through the grip beside the ring finger's carriage (s 24 to 44.5 mm, from y 37 mm outward), so the little finger curls through the grip. The well cuts the carbon track's end arcs, so the track is two rails. What is left of the arc on the hinge-side rail still stops each carriage past its 8 mm of travel. A 4 mm silicone bar across each well's end holds the grip's outer half on. The ends are 4 mm longer than today's (the grip is 115 mm long instead of 107) so the bar sits past the curled finger. Each carriage has a 3 mm saddle across its palm-side rim and its outer wall thinned to 1 mm of carbon where the little finger leans on it.
- **Sliding tang**: the hinge-end corner is relieved, leaving 4.1 mm of silicone round the track. A soft nose on a 1.5 mm carbon strap rides with the ring finger's carriage, 0.6 mm off the relieved wall. The strap's end is moulded into the nose, so in the model the two solids overlap there by 0.7 mm.

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

The "Hand" box in the viewer shows a left hand holding the grip. It is the WebXR generic hand (`hand/left.glb`, from `@webxr-input-profiles/assets` 1.0.20, MIT licence in `hand/LICENSE.md`): a skinned mesh with 25 joints, about 190 mm from wrist to fingertip. `hand_fit.py` poses it against today's grip without the fins (`outlines.py`): the index and ring fingers go through the rings, the middle finger through the gap, the thumb rests at the far end, and the palm faces the phone. It fits an open hand, a closed hand, and each 2 mm click of the ring finger's ring. Then it fits the little finger to each version (`variants.py`). In the Open well the finger is placed curled through the well. That takes the least spread, then the most curl, of the poses whose skin gives no more than 0.6 mm, that clear the ring finger and the phone, and that touch the grip. Measured from the finger's own side (the ring bores filled), a thin wall can't read shallow. With the ring at home it curls at 70° knuckle, 29° spread, 95° and 80°. From the first click of the ring slide the carriage leaves the well too short past the bar, so the finger comes out and rests on the grip the way the Sliding tang's rule finds it. In the Sliding tang the finger is left to settle, curling in 2° steps until the skin gives 0.5 mm, and the most curled rest with pad contact on two phalanges is kept. It rests at 6° knuckle, 0° spread, 72° and 80° on the nose and the relieved corner. Across the clicks the curl stays within 8° and the spread within 0–12°, but at the 4 and 6 mm clicks the finger rests on the relieved corner only, clear of the nose. The open hand's little finger is chosen so that the viewer's straight blend to the closed hand stays out of the grip and 1 mm off the phone; in the Open well it already reaches into the well. The skin's triangles are 5 to 9 mm across, so the little finger is checked on points spread over its triangles, not only at its vertices: at most 0.58 mm (Open well) and 0.43 mm (Sliding tang) into the grip, from its own side. The rest of the hand is checked at its vertices, at most 0.85 mm. Between them the ring finger's skin dips up to 1.5 mm into the grip's outer edge at the last two ring clicks, as in the fit before the versions. The hand turns with the grip. `hand_range.py` turns the posed hand through every Grip angle and finds the shortest arm extension at which every pose stays 1 mm clear of the phone, the puck and the arm (voxel distance fields of the packed mesh). With the hand in it, the grip turns from −123° to 90° in both versions; further back the hand would run into the arm. The viewer stops the Grip slider there and pushes the arm out as far as that angle needs: at the 90° hold, 35 mm for both versions. The forearm isn't modelled. The viewer blends those poses with its Fingers and Ring slide controls, and skins the mesh itself, so the 3D view and the basic view both show it. `hand_fit.py` needs numpy, scipy, shapely, trimesh, triangle and pygltflib, and takes about 10 minutes for both versions; `python3 hand_fit.py well` fits one version, for a quick look only: the page needs both, so run it without an argument before `build_page.py`.

The "Phone" box shows an orange iPhone 17 Pro Max on the MagSafe face, centred on the puck. `phone.py` builds it as closed meshes. Its size comes from Apple's tech specs: 163.4 × 78.0 × 8.75 mm. The camera bar is 2.5 mm proud and the lenses 4.2 mm, from measurements of a dummy unit. The rest is estimated from photos: the bar's lower edge 37.7 mm above the centre, the lens, flash and button positions, the corner radius and the colour. Apple doesn't publish where the MagSafe ring sits. `phone.py` also gives `hand_range.py` a distance function for the phone. With the grip folded flat (stowed), the grip clears the phone by about 10 mm and rests 0.25 mm above the puck's slide rail. It's the phone, not the product, so it isn't in the SketchUp file, which still has its iPhone 18 Pro Max reference.

Each script has its own requirements:

- `pack.py` also needs mapbox_earcut.
- `hand_fit.py` needs scipy, trimesh, triangle and pygltflib as well.
- `phone.py` needs numpy, trimesh and triangle; `hand_range.py` needs numpy, scipy and trimesh.
- `build_page.py` needs Node (it syntax-checks the page's script).
- The browser test needs Playwright with Chromium at `/opt/pw-browsers/chromium-1194`, plus three.js r128. Put three.js at `./package/build/three.min.js` (`npm pack three@0.128.0 && tar xzf three-0.128.0.tgz`) or point `THREE_JS` to it.

Publish `index.html` to the same artifact so the link stays the same.

The model is posed with the arm out 45 mm and the grip turned 90° toward the phone. The hinge axis is at x 79.25 mm, 16.5 mm above the phone back. `viewer.html` moves the arm, the grip and the ring slide from that pose, and shows the product standing up the way it is held. The phone's back is at z 0 and its screen at z −8.75.

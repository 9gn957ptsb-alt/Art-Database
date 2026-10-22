# CHECK.md — wf6/check-pearl on wf6/pearl (16 Oct 2026)

My scripts and outputs are in /tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/.
The files from before my fix are in check-pearl/before/.

## Fixed here (and re-rendered)
- **The legs were not equal (REFUTED, then fixed).** `pmodel.legs` clamped `sqrt(max(L^2 - d^2, 0))` with no warning.
  So once HEM_L was put on the ground, the left shin came out 0.378 m against the right's 0.345 m, and the left leg
  0.658 m against 0.626 m. Even before grounding it was 0.350 m. Equal legs, grounded feet and the fitted left
  knee and hem cannot all hold: the projected distance from knee to hem is 185 px, the shin 169 px.
  The fix keeps the relation. If the fitted hem lies farther from the knee than a shin's length, the hem rises
  under its fitted column until the shins are equal. It is lifted 0.034 m and hangs over its shoe. **Both soles
  now stand on z = 0, whatever the hem height.**
  Result: left thigh/shin 0.2806/0.3450 = the right's. Figure IoU 0.9350 -> **0.9417** (traced 0.9397). Legs
  0.892 -> 0.913, feet 0.825 -> 0.862. Shoe base dE 0.079 -> 0.045.
  I reran make_all.py: make_all6.log, all renders, bases.json, gl/*, pearl_scene.glsl and pearl.json. I rebuilt
  render_views_flat.png from the new single views. build_json.py: the shoe and flare relations are corrected (the
  stale "the left on its rock, at its hem height" is gone), and a 'feet' region is added to fit.regions.

## Confirmed by my own numbers
- **Silhouette:** I ray-traced exact SDFs (iou_trace.py) and got 0.9332 on the old model against the hull 0.935
  claimed (hat+head 0.962, torso 0.938, legs 0.892). The wf5 reference mask looks like a faithful trace (ref_on_c1.png).
- **Cover 2:** hat+head IoU 0.928 against my own sky mask at the head-matched scale (567.5 px/m, yaw 45)
  (cover2_hat.py, hat_diff_both.png). The model's crown sits a little high and its brim a little wide on the right.
  On cover 1 my crude mask catches a planet, so trust the 0.964.
- **Head circles:** I compared the claimed circles with the strongest edge along each normal. Cover 1 median
  residual +1.0 px (MAD 1.75; right arc +2.75, where the head glows). Cover 2 -0.25 px (MAD 1.0). My own fit on
  cover 2 gives r 138.6 at (596.2, 468.5) against the claimed 139.4 at (596.4, 466.3). The "rms 1.0 px" on cover 1
  is optimistic (about 2 px), but R holds to about 1-2%. The scale 490.70 px/m (head top at phi), the hat
  numbers (tip 32.4, Rs 2.554, brim 0.398) and the eye chord 0.1243 all recompute from pearl.json.
- **One sphere:** in pearl_scene.glsl the head is an exact `length(p-c)-r` sphere, R 0.24565, centre z 1.37239.
- **pearl.glsl:** it compiles and links in Chromium 141 SwiftShader WebGL2. My own page is gl/film.html, read
  back through an RGBA32F target with gl error 0. pearlFilm agrees with an exact Airy film (complex s and p
  amplitudes, Wyman fit of the CIE 1931 colour matching functions, white-balanced): chroma dE mean 0.006, p95
  0.014 over d0 +-21%; luminance within 3%. At d0 and normal incidence the two give identical RGB (film_check.json,
  film_glsl_vs_exact.png). The Fourier sensitivity, the phases (pi + 0, since n3 > n2), the two Airy orders and
  the XYZ->sRGB matrix are Belcour & Barla's. OPD 2*1.1638*342.14 = 796 nm.
- **Hues:** the numpy twin at each cover's scale and face yaw, compared on the head (hue_check.json, hue_pair_*.png):
  - L 0.779 vs 0.772 (cover 1), 0.780 vs 0.752 (cover 2)
  - C 0.041 vs 0.045 / 0.048
  - chroma-weighted hue histogram correlation 0.73 / 0.81; median dE 0.015 / 0.028
  - The model is a little too yellow-green (OKLab hue 90-120) and short of blue-violet (270-300). Its arrangement
    is mottled, not the covers' broad swirls, as the report says.
- **Bases:** dE 0 on the fitted parts holds, but it is true by construction: each base is iterated until the median matches.
- **Option B:** after the 0.432 m drop the hat passes through nothing. The guitar and strap, which hat_settle leaves
  out of its search, are not hit either (hat_check.py). It rests on one point (the neck) with no tumble, which is a
  stated choice.
- **Levels and closure:** rocket.js line 341 `smoothstep(0.0125, 0.0275, uPx*dist)` and line 900
  `uPx = near*2tan(35deg)/chh`, with bars 0.1 of the edge (FIGURE) -> 8 px to 3.64 px. 14.3 e and 31.4 e hold
  for near = 1 on a 1600 px canvas. k3 at 3 m: drawn within 3.37 m. k4 mid-way (2.08-4.59 m). k5 is its mean
  beyond 2.83 m. Fill e/8 against phi^-4: +16.7%.

## Caveats the report should carry
- rocket.js's thresholds are absolute (1 m blocks). Scaling them per unit edge e is levels.py's assumption, not
  rocket.js as written. `near` grows to about 3.4 on slow frames and `quality` shrinks the canvas, which brings
  every closure distance nearer.
- The shoulders are full sphere primitives (r 0.055 m, mostly buried). The head is the only sphere *meant* to be
  seen, but it is not literally the only sphere in pearl.json.
- Shoulder joint heights: right 1.011 m, left 0.988 m ("one block" is the right one).

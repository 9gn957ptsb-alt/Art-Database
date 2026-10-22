# wf6/pearl — Holographic Mr Pearl as the test form (running notes)

Label: pearl. Output dir: /tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl/
Deliverables: pearl.json (primitives in metres, z up, feet z=0, facing -y), pearl.glsl (vec3 pearl(n,v,l,base)),
renders (front/side/3q, overlay on pearl-1, holographic mode x2 hat options), body-part levels.

## Inherited (wf5) — what holds
- wf5/form/model.py: primitive model (sphere head, ellipsoid eyes, lathe hat, capsules, lathe trousers, guitar boxes),
  S=471 px/m on pearl-1, U0=625, V0=1160. raycast.py: numpy SDF caster (sphere/ellipsoid/box/cylinder/frustum/cone/
  capsule/torus/lathe). views.py: front/side/3q/back + overlay. fit_hat.py -> fit_hat_best.json (hat fitted to the
  sky mask, NOT yet folded into form.json). refmask.py: reference silhouette (sky mask for head+hat, hand-traced
  polygon trace_body.json for the body).
- wf5/material/py/head.json: robust circle fits of the head: cover1 c=(581.2,486.6) r=120.5 px (rms 1.0);
  cover2 c=(596.4,466.3) r=139.4 px (rms 0.9).
- wf5/material: pearl.glsl ships PROVISIONAL constants (d0 230...), the later fit (py/fit5c.json, best seed 101:
  d0 342 nm, nf 1.16, n3 1.35, ...) was never folded in. palette.png + py/palette_head.json: measured colours.

## Found (step 1, measurements)
- Scale relation: top of the sphere at phi m (1.618 m; the block is 1 m). Cover 1: head top v=366.0, ground v=1160
  -> S = 490.70 px/m. Head: R = 120.54 px = 0.2456 m, centre z = 1.3724 m. Origin = ground point under the head
  centre (U0 = 581.18). Hat top then at ~1.70 m. Shoulder joints come out at ~1.00 m (one block): a check, not set.
- Covers disagree on head size: cover 1 is 3.29 head-diameters tall to the head top (R = 0.1518 x height), cover 2 is
  2.99 (R = 0.1673 x height). Chose cover 1 (the overlay reference).
- Eyes (meas/eyes.json, eyes.py, meas/head_circles_both.png): on the equator (el +1.2 c1, +0.2 c2), 29.3 deg apart
  (c1 29.3-29.7, c2 28.7-29.4), half-width 0.080 R, half-height 0.220 R (tangent plane, from the nearer eye;
  c1 0.0775/0.2201, c2 0.0821/0.2194); face turned 50 deg (c1) / 45 deg (c2) to his left. The eyes lean ~10 deg
  (top toward his face line... image-left) in both covers: read as the covers' view (camera ~10-19 deg above),
  since the artist calls them vertical.
- New design rule 6 (design-rules.txt): Cezanne-like painted rendering for the world and his body; the head is the one
  thing left unpainted (wf7 painterly-render does that). Our pearl() is the head's material; the body's
  version should take the painted strokes on top (not this study).

## Code (this dir)
- prims.py: convex GLSL-friendly kinds (sphere, ellipsoid, capsule, roundcone, cappedcone, roundbox, torus, dome,
  dish), exact numpy SDFs (tested against brute force), hull points for silhouettes.
- pmodel.py: the model in cover-1 px (-> metres by S). Depth by relations: guitar back on the belly, wrists on the
  guitar top, equal upper arms / forearms (closed-form scan), equal legs.
- sil.py: front silhouette by convex hulls + PIL fill; IoU vs wf5 ref_mask/ref_care. fit.py: group NM fit ->
  fit_params.json (resumable), log fit.log. Start IoU 0.864 (hat+head 0.919, torso 0.842, legs 0.836).

## Material (step 4) — pearl.glsl written, compiles, port-checked
- Pattern scale: mat/scale.py: the covers' colour residual (after a degree-4 trend) decorrelates at 3.0/3.5 deg
  (chroma, c1/c2) and 3.9/5.3 deg (lightness); model F=3: 3.5/4.0 deg, F=8 (wf5's): 1.6/2.1 deg -> F = 3.
- Constants = wf5 fit5c seed 101 (d0 342 nm, nf 1.164, n3 1.354, OPD 796 nm = Newton's 2nd order) at F = 3.
  eval at F=3: pixel mean-field dE 0.075/0.080 (floor 0.060, flat colour 0.122); cell-mean 0.069/0.076.
  A refit at F=3 (mat/refitF3.py, .json) scored better on cell means (0.060/0.063) but washed out chroma
  (C 0.023-0.048 vs covers 0.038-0.057) -> NOT used.
- WebGL2 (swiftshader): make_view.py + gen_glsl.py + shoot.js; gl/head.png; meas/head_gl_vs_covers.png.
  Port check mat/portcheck.py: GL vs numpy twin mean |d| 0.80/255 over 44,368 head px (p99 8, at limb/eye edges).
- Weak: the statistics match but the arrangement reads as mottled foil; the covers read as soft swirls under one
  broad highlight. A flow (domain-warped) thickness noise would be closer — not done.

## Renderers, scenes, levels (written, tested)
- render.py: numpy sphere tracer (exact SDFs), flat study shading, eyes painted (tangent-plane ellipses), and
  render_pearl() = numpy twin of pearlCovers(); body pattern pinned to the head's SEAT (body_c), head's to the head.
  NB model5 (wf5) inserts its folder first on sys.path (it has a fit.py): render.py restores the order.
- views.py: standard_views (front/side/3q/back), overlay (cover-1 scale), holo_flat (A/B study sheet).
- gen_glsl.py + make_view.py + shoot.js: GLSL scene from the primitives (cluster bounding spheres), WebGL2 page,
  Playwright screenshot. holo.py: GL renders rest front/side/3q, A_lift, A_body, B_lift, B_body + sheets.
- fit_bases.py: per-part base under the film fitted to the part's cover-1 median -> bases.json.
- levels.py: level k = round(log_phi(1 m / thickness)), holes filled at k+4; sound hole and bridge = paint.
- build_json.py: writes pearl.json (run last).

## Plan / status
1. [x] measure head+eyes on both covers, choose the scale relation
2. [ ] refit body to pearl-1 silhouette (IoU), fold the hat fit in
3. [ ] renders front/side/3q + overlay
4. [x] material: fold fit into pearl.glsl, compile in Chromium, render (port check ok)
5. [ ] holographic mode renders (hat with head / hat on body)
6. [ ] body-part levels
7. [ ] pearl.json, final notes

## RESUME (run 2, 16 Oct) — actual state found on disk
The plan list above was stale: make_all.py ran every step (make_all.log): views, overlay, holo flat, bases,
GL holo renders (gl/*.png, holo_A.png, holo_B.png), pearl_scene.glsl, pearl.json (56 prims, IoU 0.9149:
hat+head 0.964, torso+arms 0.923, legs 0.841). fit.py ran one round (hat, torso, guitar); legs never refit.
Faults seen on looking: (1) legs IoU low; (2) shoe base fitted blue #196fce from 883 px -> blue blob at the hem,
cover 2 shows white rounded toes; (3) hat base fitted #2b3da4 (blue) -> hat reads blue/pink mottle, cover hat
is warm pearl; (4) the film pattern reads mottled foil, not the covers' soft swirls.
Run 2 plan: [ ] legs refit  [ ] shoes from cover 2  [ ] constrain bases (low chroma)  [ ] flow-warped film
[ ] rerender all, rebuild pearl.json  [ ] levels against wf6/levels  [ ] final notes
- [x] flow-warped film TESTED, REJECTED (mat/flow.py, mat/flow.json): structure-tensor coherence of the chroma
  residual (sigma 0.05 R) covers 0.386 / 0.484, half-angle 2.97 / 3.83 deg; shipped F=3 W=0: 0.494, 3.64 deg.
  Warping (W 0.5-3, F 2-4) never brings coherence closer and shrinks the scale below the covers'. The covers are
  NOT more banded than the model at that scale; the "swirl" read is the large-scale angle trend + glassiness.
  Kept pearl.glsl's pattern (F=3, no warp). Weak point stays: arrangement, not statistics.
- bases: run-1 bases.json (19:48, after pearl.json) already chroma-limits (C<=0.08) but the hat still goes
  blue #455080 (dE 0.053) because the env is one warm colour (up-facing brim reflects sunset, not sky);
  shoe 883 px -> #5e77a7. Decision: hat, band, shoes = the jacket's base (cover 2 shows hat, suit and shoes as one
  pearl cloth); stated as a relation.
- [x] WebGL2 compile check of pearl.glsl AS WRITTEN (gl/make_compile_check.py -> compile_check.html, compile_check.js,
  compile_check.json, compile_check.png): Chromium 141 SwiftShader WebGL 2.0, fragment compiled + linked, empty logs,
  gl error 0, no NaN/black px; sphere mean sRGB (179,166,161) = #b3a6a1 vs cover-1 head median #c0b4b0. highp 23 bits.
- build_json.py now writes palette (26 entries, hex + where), material.pattern (mat/flow_summary.json),
  material.webgl (gl/compile_check.json), the run-2 bases relation.
- [x] legs refit (fit2.log): legs window 0.863 -> 0.919, figure 0.915 -> 0.936. (fit_params_run1.json = before)
- shoes: pmodel.py now puts the toe out of the hem ALONG THE FOOT'S YAW (SHOE_FWD, default 0.35) and the left foot's
  yaw is +58 (turned out to +x; the old -58 + unrotated shift pointed nowhere). fit.py has a 'shoes' group.
  TODO after fit2 (hands, guitar) ends: set SHOE_YAW_L = +|value| in fit_params.json, run `python3 fit.py 1 shoes`,
  then fit_bases.py (hat/band/shoe = jacket base) and make_all.py.

## RESUME (run 3, 16 Oct ~00:20 UTC)
- fit2 had stopped after legs (hands, guitar never ran in fit2). fit_params_run2_legs.json = state after legs.
- [x] SHOE_YAW_L set to +58.06; `python3 fit.py 1 shoes` started -> fit3.log
- next: fit_bases.py (SAME_AS hat/band/shoe = jacket already in code), make_all.py, levels vs wf6/levels/levels.json
- [x] levels.py rewritten to wf6/levels' ladder (levels.json): level 2 = the drawing = 1 m block, the world's smallest
  leaf; the body is below it, built of the leaf scaled by phi^-k (k = round(log_phi(1/t))), ladder level m = 2-k;
  fill = e/8 (the thirds hole; phi^-4 overflows 16.7%); game closure from rocket.js (bars 0.1 e; smoothstep 0.0125..
  0.0275 = bar 8 px .. 3.64 px; FOV 70; 1600 px canvas): drawn within 14.3 e, mean beyond 31.4 e. Fixed the prefix bug
  (hat brim had swallowed hat_brim_lip). At a 3 m third-person camera only chest/waist (k3) are drawn; yoke, hips,
  thighs, flares (k4) closing; everything k>=5 reads as its mean.
- [x] shoes fit (fit3.log): window 0.8957, figure 0.9386 -> 0.9414. fit_params_run3_shoes.json. Next: hands group (never run), then make_all.
- [x] hands fit (fit4.log): window 0.9564, figure 0.9468. Now make_all.py (-> make_all3.log).
- [x] make_all3 (after hands): pearl.json 56 prims, IoU 0.9468 (hat+head 0.964, torso+arms 0.941, legs 0.931). Bases: hat
  = jacket base renders #ecd8a8 vs cover-1 #b29d8a (dE 0.18: the one-colour warm env on an up-facing brim) - kept the
  cloth relation (cover 2 shows hat = suit), stated as weak. Shoes now white rounded toes as on cover 2.
- [x] option B made determined: hat_settle.py - with the head gone the hat falls straight down (axis kept) until its
  hollow crown (1 cm shell, open foot) first touches the body: drop 212 px = 0.432 m, rests on the bare neck, brim over
  the shoulders. holo.py/views.holo_flat/build_json use it. The old held render kept as holo_B_held.png.
  make_all4.log = holoflat gl json rerun.
- [x] FEET ON THE GROUND: the fit had the left hem at v 1144.8 (14 px = 0.029 m above the ground) - the cover's
  perspective, not the form (the brief: feet at z = 0). Set HEM_L v = HEM_R v (fit_params_feet.json -> fit_params.json;
  fit_params_run3_hands.json = before). Cost: feet window IoU 0.896 -> 0.825, figure 0.9468 -> 0.9350. make_all5.log.
- [x] make_all5 done: pearl.json 56 prims, IoU 0.9350 (hat+head 0.964, torso+arms 0.941, legs 0.892), feet on z=0.
  render_views_flat.png recomposed from the fresh single views; all renders looked at.
## STATUS (run 3, end): every deliverable written. Left / weak: hat brim too bright on cover 1 (one-colour env; a
## direction-dependent env would need a refit of pearl.glsl); film reads mottled foil, not soft swirls; the covers are
## treated as orthographic (the left foot's 14 px is their perspective); body painting (rule 6) is wf7's, not here.

## CHECK (wf6/check-pearl, 16 Oct ~01:20): see CHECK.md. The left leg was longer than the right (a silent clamp in
## pmodel.legs); fixed (hem rises to keep equal shins, soles on z=0), everything rerun (make_all6.log): IoU 0.9417.

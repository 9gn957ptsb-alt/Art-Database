# wf6/check-pearl — skeptic of wf6/pearl (running notes)
Started 16 Oct. Target: wf6/pearl (report claims: IoU 0.935, head sphere R 0.2456 m at phi top, eyes, hat, hat_settle,
pearl.glsl compiles, levels/closure numbers, bases dE 0).
## Steps
- [ ] look at covers and every render
- [ ] recompute IoU (sil.py), head circle fits, scale numbers
- [ ] head is a true sphere in pearl.json / GLSL
- [ ] GLSL compile rerun, equation check (Airy/Belcour-Barla)
- [ ] bases median claims
- [ ] levels/closure numbers vs rocket.js
- [ ] hat_settle
## Findings so far (16 Oct)
- IoU recomputed by ray tracing (iou_trace.py): 0.9332 (hat+head 0.962, torso 0.938, legs 0.892) vs claimed hull 0.935. CONFIRMED.
- Head circles: claimed circles vs strongest edges: c1 median resid +1.0 px (MAD 1.75; right arc +2.75 = glow), c2 -0.25 (MAD 1.0);
  own sky-boundary fit c2 r 138.6 at (596.2,468.5) vs claimed 139.4. CONFIRMED (c1 rms 1.0 px is optimistic; ~2 px).
- Scale 490.70 px/m, head top phi, hat numbers, eye chord: arithmetic CONFIRMED from pearl.json.
- pearl.glsl compiles+links (my own page gl/film.html, RGBA32F readback); pearlFilm vs exact Airy (s+p complex amplitudes,
  Wyman CIE fit): chroma dE mean 0.006 (d 270-415), luminance 3%. CONFIRMED. (film_check.json, film_glsl_vs_exact.png)
- Head hues (hue_check.py, numpy twin): c1 L .779/.772, C .041/.045, hue-hist corr 0.73, median dE 0.015; c2 corr 0.81, dE 0.028.
  Model a bit yellow-green, short of blue-violet. Confirmed with that caveat.
- hat_settle: dropped hat intersects nothing (guitar/strap left out of the search but not hit). CONFIRMED.
- Levels/closure numbers vs rocket.js lines 341/900: CONFIRMED for near=1, 1600 px; rocket.js's thresholds are absolute (1 m
  bars) - applying them per unit e is levels.py's assumption; `near` grows to ~3.4 on slow frames (closure nearer).
- REFUTED: "equal legs". pmodel.legs clamps s=0 silently: left shin 0.3503 before grounding, 0.3778 after (right 0.345);
  left leg 0.658 vs right 0.626 m (+5%). Grounding HEM_L made the chain infeasible.
- shoulders are full sphere primitives (r 0.055 m) - the head is not literally the only sphere primitive (minor).
- stale text in pearl.json: shoe relation "the left on its rock, at its hem height".
## Fix in progress: legs (left hem height from the equal shin; soles on the ground)
- [x] leg fix applied in wf6/pearl/pmodel.py + build_json.py texts; make_all6.log rerun; render_views_flat recomposed.
  New IoU 0.9417 (traced 0.9397), legs equal, soles z=0. All new renders looked at.
- [x] cover-2 hat+head IoU 0.928 (cover2_hat.py). CHECK.md written in wf6/pearl. DONE.

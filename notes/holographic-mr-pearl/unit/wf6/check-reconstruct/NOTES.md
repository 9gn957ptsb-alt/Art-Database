# check-reconstruct NOTES (running)
Task: skeptic of wf6/reconstruct (V3 arcs closed curved figure). CHECK.md goes in wf6/reconstruct/.
## Step 0: started 16 Oct; reading scripts.
## Step 1 (done): check1.py — own point-in-polygon raster of vector.json 'drawn' = their vec_tone (0 px diff);
  form.json's 882 hexes cast with figure_studies.cast (not their caster): 0 px from my raster, 2744 = 2.103% vs cls
  (3056 = 2.491% vs cls_holes). CONFIRMED mismatch + 'is the original from its eye'.
  Renders looked at: closed view, diff, compare_sheet, turned 20/45, below. Pinch visible in turned views.
## Next: analytic geometry of form.json (arcs, nodes, closure), thickness, span-extension test, golden, cost.
## Step 2 (done): check2.py/check2.json — form.json closes (node gap 1.2e-10 = rounding), nodes degree 2,4 (Q/J),
  all at depth -1/sqrt3; arcs lie on the stated circles (1e-10); hex corners = exact unslid square bar (9e-10);
  sigma pieces H:H:H and slide 1/18:2/9:1/18 CONFIRMED; tan(th/2)=sqrt2 CONFIRMED. Thickness on the straight run:
  contiguous in-plane run 0.111 vs 0.314 unbent (=1/3 up to hex chords) CONFIRMED; the beam folds to within 0.18
  of itself either side (check2b.py).
## Step 3: check3.py span test (V3 smootherstep, their caster, 1x): span [lo*H,1-lo*H] px differing from vector:
  lo=3.5,3.0,2.9,2.5,2.0 -> 0;  1.5 -> 7; 1.0 -> 96; 0.5 -> 367; 0 -> 1568.
  => "free span must be [3H,1-3H], zero margin" REFUTED at 1x: [2H,1-2H] (outside the node cubes, sigma
  extent of the cube [-H,H]^3 is +-2H) also gives 0 px. Then along-axis advance = 5/9-1/3 = 2/9 > 0, chord angle
  64.8 deg: a bend <= 90 deg becomes possible. Next: supersampled check of [2H,1-2H] + a 90-deg arc profile (rho=H).
## Step 4 (done): check4.py, alt90.json, alt90_vs_arcs_sheet.png (looked at). V3 with span [2H,1-2H] and a
  90-deg arc-straight-arc (rho = H exactly, straight sqrt2/3-2H): 0 px from vector, 2.103%, 0 of 6,804,000 3x3
  supersamples differ from the cut reading, 0 collisions; min in-plane thickness 0.707 (vs 1/3), radius 0.111 (vs 0.059).
  => REFUTED: "bend forced above 90 deg", "span set by no-overlap / zero margin", "pinch to 1/3 forced".
## Next: golden/Fibonacci claims, cost, CHECK.md.
## Run 2 of the check (20 Oct). Step 5 (check5.json, done earlier): golden sequence CONFIRMED (sum rule any H;
  1:2:3:5:8 thirds at H=1/9; geometric phi at 6H=1/phi; fig*phi^-4 = hole exactly). F(m+4)/F(m+3) -> phi is plain
  Fibonacci arithmetic, not a property of this form.
## Step 6 (done): check6.py/check6.json — the report's tone numbers (nearest axis 25.6%, Middling 26.4%) are the
  QUINTIC's; for the primary ARCS form they are 20.48% / 22.14%. Cost: 882 hex prisms (98/beam) vs 9 boxes; the
  numpy cast of the drawing view takes 4.9 s vs 0.9 s.
## Next: fix numbers_final.json (add arcs tone numbers), open renders, write CHECK.md, return.
## Step 7 (done): check7.py — R3 maps form.json's own centrelines and hex corners onto themselves to 1.2e-10 (rounding)
  CONFIRMED. check8.py — arcs form 3x3 supersampled: 0 of 6,804,000 differ from the cut reading CONFIRMED.
  Thickness formula cos th + sin th/sqrt2 re-derived by hand; rho = sqrt2/24 and tan(th/2)=sqrt2 re-derived by hand.
  FIXED numbers_final.json tone numbers (arcs 20.48/22.14; quintic kept under *_quintic).
  Renders opened: arcs_closed_view_beside_original, compare_sheet, arcs_diff_vs_cls, arcs_turned_90, alt90 sheet.
## Next: CHECK.md, return.
## Step 8 (done): CHECK.md written in wf6/reconstruct. DONE.

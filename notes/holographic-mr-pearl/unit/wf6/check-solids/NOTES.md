# wf6/check-solids — skeptic of wf6/solids (running NOTES)
Started 20 Oct 2026. No previous run of this label. Plan: read solids NOTES/json/common.py; open renders;
re-check numerically: face rule palette + tests, see-through, far closed form, Fibonacci divisibility + LOD
switch distances, cube/pyramid/sphere counts + IoU, sphere sil range, golden lengths; write CHECK.md in solids/.
## Step log
- Read solids NOTES, common.py, solids3/4.py, gameblock3.json, farface.py, rocket.js FS.
- FINDING 1 (refutes the 'today' baseline at 30 m): rocket.js lod = smoothstep(.0125,.0275,uPx*dist), uPx = 1/602.7
  on an 844 px phone: today DISCARDS (sees through) only where lod < 0.5, i.e. face dist < 12.05 m; beyond 16.6 m it
  does no walk at all (col = far: 0 tests, solid). The numpy 'today' mode ignores lod, so wall30/slope30 'today'
  see-through 8.9%/4.6% and 48 tests are not what the game does. To re-measure with the lod (check1.py).
- FINDING 2 (pyramid numbers wrong): solids_grid.volume_numbers samples n=4 per block with inclusive ties (biased)
  and only inside the built grid box (the ideal's base 2h overhangs the built 2h-1 by 1/2 a side). Exact, against
  the stated ideal (base 2h, height h, volume 4h^3/3): built/ideal 35/36 = 0.972, 680/682.7 = 0.996, 12341/12348 =
  0.9994; sym diff / ideal = 3/(4h) = 0.250 / 0.094 / 0.036 (reported 0.147 / 0.077 / 0.033).
- [check1.py -> check1.json] today WITH its lod (480x360, gameblock scene): see-through wall5 6.6% (no-lod 8.6%),
  wall30 0.28% (no-lod 9.2%), slope5 0, slope30 0; tests mean wall30 8.7 / slope30 10.0 (no-lod 23 / 26). So
  today's see-through is a NEAR (<12 m) fault only; the 30 m 'today' numbers in gameblock3/solids.json are not the game.
  Face rule: see-through 0, 6 tests: confirmed (by construction). PALETTE: on player views only 14-28% of face pixels
  are 0/64/128/192/255 (61-109 distinct values), because m(v) varies with view; the 5-colour claim holds from the
  crux only (m = 128 there).
- [check2.py -> check2.json, K2_*.png] (c) F(j)|F(k) iff j|k: no counterexample for j>=3 (F(2)=1 is the trivial
  exception). (a) LEVEL DEPENDS ON POSITION: 21 cube at world offset 0 from crux -> 3 m (as reported); same cube from
  the opposite eye -> 3/5/8/13 m mixed; offset 1 from crux -> 1/2 m; offset 5 -> 1/2/13 m. So 'tiled only by F(j),
  j|k' is not what the rule does: the rule only asks the cell at the entry point to be full (world-anchored cells),
  so faces of a 21 cube carry 2, 5, 8, 13 m units, set by world position mod F(j), not by the cube.
  (b) FULLNESS FETCHES: up to 6 levels tried (sphere21 drawing: 91% try 6; sphere21 at 30 m: 90% try 4; wall30
  up to 5): the claimed '1-3' is wrong. (d) sphere exact: built/ideal 1.2025/1.0146/1.0060; sym diff 0.276/0.092/0.034.
  (e) voxel sphere layer exposed areas NOT equal: range 25% / 56% / 60% of mean (end layers ~half): the 'equal area
  (Archimedes)' holds for the ideal bands, not for the built layers. (f) golden lengths: confirmed exactly.
- [check3.py -> check3.json, K3_gameunit_vs_original.png] the game unit (rocket FIGURE, the texture unit) from the
  crux, fitted (s 555.7, k 1.0393): mismatch 1.60% vs cls_clean (-2 ignored), against the lattice floor 0.79%
  (strokes excluded). Wrong pixels sit exactly at the three crossings the original cuts (top, bottom-right,
  bottom-middle): the unit is the straight model. Closure from the crux: confirmed.
- Looked at C3, t_face_cube3, t_unit_drawing, original. C3 panel 3 ('8 m, does not tile 21') is the 3 m texture
  again: walk_face's full-cell rule drops 8 -> 5 -> 3. t_face_cube3: the top face shows only dashes, not the figure;
  each face shows the part of each block's unit behind that rhombus.
- Re-rendered C3 (8 m forced); patched solids.json / solids3.json (pyramid and sphere exact numbers, palette, fetches,
  today with lod, tiling, equal area); farface re-run identical. Wrote solids/CHECK.md. DONE; StructuredOutput next.

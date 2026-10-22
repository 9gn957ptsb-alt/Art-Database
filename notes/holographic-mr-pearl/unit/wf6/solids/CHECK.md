# CHECK of wf6/solids (check-solids, 20 Oct 2026)

Scripts and outputs are in ../check-solids/ (check1.py, check2.py, check3.py, farface_rerun.py, *.json, K2_*.png, K3_*.png).
Originals of the files I changed are in ../check-solids/before/. I opened every listed render and the original drawing.

## Confirmed (checked myself)
- Golden lengths: hole 1-6H, growth 6H, side 1, tribar 1+6H, figure 2+6H. Each is the sum of the two before it, for any H.
  At H = 1/9 they are exactly 1:2:3:5:8 thirds. At 6H = 1/phi every ratio is phi, and figure/hole = phi^4 = 6.854.
- F(j) | F(k) iff j | k holds for every j, k from 3 to 29 (F(2) = 1 is the trivial exception).
- LOD switch distances: 0.1 s * 602.7 / t = 8 gives t = 7.53 s, so 7.5 / 15.1 / 22.6 / 37.7 / 60.3 / 97.9 / 158 m.
- Face rule from the crux: tones 0/64/128/192/255 only. It reads solid: see-through is 0 on every view, and the faces'
  three families stay apart (G3/G4/S3/S4 renders). The cost is 6 bar tests by construction: the ray never leaves its cell.
- Far face closed form: farface.py re-run gives identical errors (0.66-3.1 levels).
- Cube, pyramid and sphere unit counts and shells are right: 27/512/9261, 26/296/2402; 35/680/12341 = h(4h^2-1)/3;
  136/2176/39024.
- Closure from the crux: the game unit (rocket FIGURE) fitted to the original (s 555.7, k 1.0393) is 1.60% wrong
  against cls_clean (-2 ignored). The floor without strokes is 0.79%. Every wrong pixel sits at one of the three
  crossings the original cuts, so the unit is the straight lattice model (K3_gameunit_vs_original.png).

## Refuted or corrected
1. **The "today" baseline at 30 m is not the game.** rocket.js uses lod = smoothstep(.0125, .0275, uPx*dist). It
   discards (lets you see through) only where lod < 0.5, that is where the face is nearer than 12.05 m. Past 16.6 m
   it does no walk at all and paints the far colour. The numpy "today" mode ignores lod. With the lod applied
   (check1.json), see-through is wall5 6.6% (reported 8.6%), wall30 0.28% (8.9%), slope5 0, slope30 0. Mean tests
   are 8.7 for wall30 and 10.0 for slope30, not 42-48. Today's game has a see-through problem only near the player.
   What the face rule adds at 30 m is texture with face toning, not solidity. The G3 "today" panels at 30 m show a
   lattice the game never draws.
2. **"The only colours on a face are 0, 64, 128, 192, 255" holds only from the crux.** From the player views m(v)
   varies with direction: only 14-28% of face pixels take those five values, and there are 61-109 distinct values.
3. **"A cube of side F(k) is tiled only by F(j), j | k; the 21 cube takes 1, 3, 21" is not what the rule does.** The
   full-cell rule tests only the world-anchored cell at the entry point; it never checks that the face is tiled.
   - The same 21 cube seen from the opposite eye wears 3/5/8/13 m units mixed on one face
     (K2_cube21_offset0_opposite_asked13.png).
   - Moved by 1 block it wears 1/2 m; moved by 5 blocks, 1/2/13 m.
   - So the level is set by world position mod F(j), not by the solid: an arbitrary relation, against PURPOSE.
   - A fix to consider: anchor cells to each solid's own corner (one origin per form), or require the face to be
     tiled, not only the cell.
4. **Fullness fetches are 1-6 per pixel, not "1-3" (or "2-4").** For sphere 21 seen from the crux, 91% of pixels try
   6 levels; at 30 m, 90% try 4; wall30 tries up to 5. In numpy each fetch is an 8-tap summed-volume query; the
   per-level fullness texture this assumes is untested.
5. **The pyramid's volume numbers were wrong.** volume_numbers sampled 4 per block with inclusive ties, and only
   inside the built box, which clips the ideal's base of 2h. Exact values against the stated ideal (base 2h, height h):
   built/ideal 0.972 / 0.996 / 0.9994 (reported 0.971 / 0.967 / 0.988); symmetric difference 3/(4h) = 0.250 / 0.094 /
   0.036 (reported 0.147 / 0.077 / 0.033). The sphere is slightly off too: built/ideal 1.2025 / 1.0146 / 1.0060,
   symmetric difference 0.276 / 0.092 / 0.034. I fixed both in solids.json and solids3.json.
6. **"Its 2R layers are equal-height bands, so equal area (Archimedes)" fails for the built sphere.** Exposed area
   per layer ranges over 25% / 56% / 60% of its mean (R = 3 / 8 / 21), and the end layers have about half the
   area. Equal area belongs to the ideal sphere's bands, not to the voxel layers.
7. **C3 panel 3 ("8 m, does not tile 21") was the 3 m texture again.** walk_face's full-cell rule had dropped 8 to 5
   to 3. I re-rendered it with 8 m forced (full_cells=False). It now shows 8 m figures cut at the faces.
8. **t_face_cube3: "the figure showing on every face" overstates it.** Each face shows only what lies behind that
   rhombus of each block's hexagon; the top face shows dashes, not the figure. A whole figure appears only where
   the texture cell is the whole cube (C3 panel 4).

## Plausible, not checked further
- The silhouette IoUs (the pyramid's ideal_hit is not clipped, so those stand), the sphere silhouette ranges, and
  the dial and tribar results carried over from run 2.
- Nothing runs in WebGL yet; all of this is numpy, as the study itself says.

## Files I changed
- C3_cube21_texture_levels.png re-rendered; t_texlevels.py (8 m panel forced, levels printed).
- solids.json: pyramid and sphere fill numbers; palette text; GAME_BLOCK fetch line, today_with_lod and today_note;
  TEXTURE_LEVEL consequence; SPHERE rule note; CHECK_SOLIDS key.
- solids3.json: pyramid and sphere built_over_ideal, sym_diff_over_ideal and ideal_volume_m3.

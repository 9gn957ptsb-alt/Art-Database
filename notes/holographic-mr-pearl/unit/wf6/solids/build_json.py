import json, math
L = lambda p: json.load(open(p))
s3, sp, ff, g3, g4, g4b, dial, nest, s4 = (L('solids3.json'), L('spheres.json'), L('farface.json'), L('gameblock3.json'),
    L('gameblock4_face1_faceLOD_far.json'), L('gameblock4_faceLOD.json'), L('dial.json'), L('nest2d.json'), L('solids4.json'))
D = 'wf6/solids/'
J = {
 "name": "wf6/solids - how the unit approaches the cube, the sphere and the pyramid, and the game block",
 "date": "2026-10-20 (run 3; runs 1-2 15-16 Oct)",
 "frame": "model frame z up; game block -> model by model = (gx, 1 - gz, gy) (common.py); the drawing's eye (1,1,1)/sqrt3, up (0,-1,1)/sqrt2; tones x 128 grey, y 0 black, z 255 white",
 "unit": {"bars_game_frame": [[0.45,0.45,0,0.55,0.55,1],[0,0,0.45,1,0.1,0.55],[0.9,0.1,0.45,1,1,0.55],[0.55,0.45,0.45,0.9,0.55,0.55],[0.45,0.1,0.45,0.55,0.45,0.55],[0.9,0.45,0,1,0.55,0.45]],
          "relation": "rocket.js FIGURE: six square bars 0.1 of the block thick; from the block's crux they close into the drawing (outline an equilateral triangle of side 0.898 and height 0.778 block, inside the block's hexagon 1.633 x 1.414)",
          "bar_volume_of_block": 0.03584},
 "SURFACE_FILM_RULE": {
   "rule": "a ray that enters a filled block from air crosses a film toned by the axis of the face it enters (T_a: x 128, y 0, z 255, the drawing's rule = the cube at the dial's end H = 1/2); behind it the first bar of the texture unit (its face's axis tone; a bar cut by the face takes T_a), counted only if its point lies in a filled block, else the bulk m(v) = round(sum|v_i| tone_i / sum|v_i|) (the block's three back faces by projected area, wf6/colour unitBulk); pixel = round((T_a + B)/2), Colour Middling's Average, two films (what lies behind the face weighs 1/2, wf6/colour's 2^-k).",
   "palette_on_faces": "0, 64, 128, 192, 255 only (the drawing's films; from the crux the bulk is 128 exactly)",
   "why_not_others": {"today (bars only)": "a lattice: see-through 8.6-9% of solid rays at 5-30 m, 45-55% of a 3-cube's silhouette from the crux; tests 19.8 mean / 48 p95",
                      "avg+crossing (wf6/colour land2)": "solid but washed glass (std 22-33); exposed faces carry no film so near walls open into the lattice behind; 44-47 tests",
                      "closed+exit (run 2)": "solid, 6 tests, but every face one grey m(v): the cube loses its three rhombi",
                      "face-self (bulk = the face's own tone)": "keeps full tones but white bars on the white top and black on black walls vanish: texture lost (G3_*face-self.png)"},
   "verified": "t_face.py / t_face_cube3.png; gameblock3.json: see-through 0, tests 6.0 (p95 6) on all four views; face families stay apart (wall30: x 102, y 31, z ~180 mean) while the unit shows on each (std 16-25 within a face)"},
 "TEXTURE_LEVEL_RULE": {
   "rule": "the texture unit behind a face is the unit of side s = F(j) m, cells anchored at multiples of s from the world origin; s = the smallest Fibonacci number whose bars (0.1 s) are >= 8 px at the face's distance (phone focal 602.7 px: s = 1 to 7.5 m, 2 to 15.1, 3 to 22.6, 5 to 37.7, 8 to 60.3, 13 to 97.9, 21 to 158, 34 to 256, 55 to 414 m), stepped down until the s-cell at the face point is WHOLLY filled (full-cell rule; a summed-volume or per-level fullness texture: one fetch per level tried)",
   "consequence": "bars stay 8-16 px, so the texture never closes on big masses; thin things (2 m walls, 1 m steps, 2 m-deep ground) keep the 1 m or 2 m unit; a cube of side F(k) is tiled exactly only by F(j) with j | k (F(j) divides F(k) iff j divides k): the F(8) = 21 cube takes 1, 3, 21 - at 21 its hexagon carries ONE figure (C3_cube21_texture_levels.png), the drawing closed in its own cube",
   "failed_first": "the distance-only level (no full-cell test) left scattered bar fragments and seams on thin features (G4_gameblock_sheet_v1_noFullCell.png)",
   "verified": "walk_face(tex=1) == walk(film='face') on 81,442 px (0 differ); gameblock4_faceLOD.json; solids4.json"},
 "FAR_FACE": {"rule": "past the texture's last level the face shows round((T_a + m(v))/2): closed form, 0 bar tests, no table",
              "error": {k: round(v['closed_form_err'], 2) for k, v in ff.items()},
              "by_angle_off_normal": {k: v['by_theta'] for k, v in ff.items()},
              "verified": "farface.py: mean over each of the 6 faces x 108 view directions, 96x96 rays; face1 render means equal the far closed form within 1 level (gameblock4)"},
 "GAME_BLOCK": {
   "per_pixel": ["start at the meshed face (as today): T_a from the face normal's axis",
                 "s = texture level (distance), then the full-cell steps down (1-3 fetches typical)",
                 "6 box tests: the unit's bars scaled by s in its cell",
                 "1 occupancy fetch at the first bar's point; B = its tone or m(v)",
                 "pixel = round((T_a + B)/2), then unit.glsl's colour layer (Cezanne / film) on top",
                 "beyond the last level: mix toward round((T_a + m(v))/2) by rocket.js's lod k = smoothstep(0.125, 0.275, 1/barPx)"],
   "cost": {"today": "a walk of up to 8 blocks x 6 bar tests = 48 (wall at 5 m: mean 19.8, p95 48; see-through 8.6%)",
            "new": "6 bar tests + 2-4 texture fetches, no block walk (the ray never leaves its first block); far: 0 tests",
            "measured": {k: {a: round(b, 3) for a, b in v.items() if a in ('see_through', 'tests_mean', 'tests_p95', 'value_std')} for k, v in g3.items()}},
   "lod": "1 m bars full to 7.5 m; Fibonacci texture levels by distance where cells are full; past the full cells the old close 8 -> 3.64 px (7.5 -> 16.6 m for the 1 m unit) into the far face; a block is 1 px at 603 m (mesh LOD beyond)",
   "renders": ["G3_gameblock_sheet.png", "G4_gameblock_sheet_v1_noFullCell.png", "G4_gameblock_sheet_faceLOD.png", "G4_wall5_faceLOD.png", "G4_wall30_faceLOD.png", "G4_slope5_faceLOD.png", "G4_slope30_faceLOD.png", "G4_far110_faceLOD.png"],
   "measured_faceLOD": g4b},
 "CUBE": {
   "rule": "a cube of side F(k) blocks (k = 4, 6, 8: 3, 8, 21; levels phi^2 apart), every block the unit under the surface film; units per level F(k)^3 (27, 512, 9261), seen units = shell (26, 296, 2402)",
   "fill": {k: {a: s3[k][a] for a in ('blocks', 'shell_blocks', 'built_over_ideal', 'sym_diff_over_ideal', 'drawing_silhouette_iou', 'drawing_ideal_covered_today', 'drawing_see_through_face')} for k in s3 if k.startswith('cube')},
   "dial": "the FIGURE thickened never reads as the hexagon of three rhombi (tone IoU 0.28 at H 1/9, 0.33 at 6H = 1, 0.47 at H 1/2: its outline stays a truncated triangle); the cube's 12 EDGES as bars do: silhouette IoU 0.924 (H 1/9) -> 0.998 at 6H = 1 (where the figure's holes close), tone IoU 0.59 / 0.75 / 0.958 (H 1/3) / 1.000 (H 1/2); the surface film is that end of the dial made a film (dial.json, C1_dial.png)",
   "four_tribars": "the cube's 12 edges = 4 monotone paths, one per body diagonal: 18 ways; with the main diagonal's tribar the drawing's A (order y,x,z) 3; exactly one gives the other three one common order (z,x,y); none is 3-fold symmetric (tribars4.json)",
   "renders": ["S4_cube_sheet.png", "S3_cube_sheet.png", "C3_cube21_texture_levels.png", "C1_dial.png", "t_face_cube3.png"]},
 "PYRAMID": {
   "rule": "a stepped pyramid of height F(k) blocks, layer j from the top a square of side 2j - 1 (one block in per layer: the smallest step the grid allows, slope 1:1); units sum (2j-1)^2 = h(4h^2-1)/3 = 35, 680, 12341; ideal = the pyramid of base 2h, height h (the steps' corners on it at mid-layer)",
   "fill": {k: {a: s3[k][a] for a in ('blocks', 'shell_blocks', 'built_over_ideal', 'sym_diff_over_ideal', 'drawing_silhouette_iou', 'drawing_ideal_covered_today')} for k in s3 if k.startswith('pyramid')},
   "not_adopted": "Arnell's 2 copies at 90 deg hull a square pyramid of slant sqrt7 (turned forms lose the axis tones, as the off-grid spheres do); the 1:2 slope of the game block is the other grid pyramid (26.6 deg)",
   "renders": ["S4_pyramid_sheet.png", "S3_pyramid_sheet.png"]},
 "SPHERE": {
   "rule": "the voxel sphere: a block is filled iff its centre lies within R = F(k) blocks (3, 8, 21); its 2R layers are Arnell's equal-height bands (equal area by Archimedes), each a ring of units; units 136, 2176, 39024 (shell 80, 632, 4464)",
   "fill": {k: {a: s3[k][a] for a in ('blocks', 'shell_blocks', 'built_over_ideal', 'sym_diff_over_ideal', 'drawing_silhouette_iou', 'drawing_ideal_covered_today')} for k in s3 if k.startswith('sphere')},
   "reads_built_not_perfect": {R: {f: {a: round(sp[R][f][a], 4) for a in ('sil_rel_range', 'value_std', 'tests_mean_on_cover', 'cover_of_head_disc')} for f in ('voxel', 'bands', 'spiral', 'head')} for R in sp},
   "relation_to_head": "silhouette range ~0.6/R (12.7%, 6.8%, 2.9% at R 3, 8, 21) against the head's 0.26% (the render's pixel limit); the tone stays three flat families with contour rings (value std 58.8 at every R) where the head is a smooth gradient; and the texture levels keep the unit visible at every distance",
   "dropped": {"banded sphere of turned units (Arnell B = F(k) = R bands, cubes corner-on along the normal, zig-zag rows)": "faces along no axis: VS blends them to mid greys (std 30-34 vs 59), reads as a heap of crystals; 18-24 tests/px; gaps (fill 95.5% at R 21); polar units 3.6x the equator's",
                "golden-angle spiral (N = F(k) = 55, 377, 2584)": "the most even of the off-grid ones (range 2.4% at R 21), pinecone-like, but same grey blending and 25-28 tests/px",
                "golden shells (R, R/phi, R/phi^2)": "the outer shell already covers 99.8%; inner shells add tests (43) and nothing visible",
                "nesting the holes with copies at phi^-4": "fills the figure's own outline from the crux only (0.9986 at the limit, thirds) - off the crux the figure itself opens (wf6/levels: 0.151 of its size at 5 deg); 4^k copies per depth; it is the hologram's solid, not the land's"},
   "renders": ["S4_sphere_sheet.png", "S3_sphere_sheet.png", "SPH_R3_sheet.png", "SPH_R8_sheet.png", "SPH_R21_sheet.png"]},
 "GOLDEN": {"lengths": "hole 1-6H, growth 6H, side 1, tribar 1+6H, figure 2+6H: each the sum of the two before for any H (checked); geometric in phi iff 6H = 1/phi (hole 1/phi^2 ... figure phi^2, and the figure at phi^-4 is its own hole); at H = 1/9 they are 1:2:3:5:8 thirds",
            "levels": "solids at F(4), F(6), F(8) = 3, 8, 21 blocks; texture units F(j) m by distance; F(j) | F(k) iff j | k decides which texture levels tile a level-k cube",
            "nest2d": {"thirds_limit_filled_of_outline": nest.get('thirds', {}).get('limit_filled_of_outline') if isinstance(nest, dict) else None}},
 "solids4_texture_levels": s4,
 "scripts": ["common.py (walk, walk_face, tex_level, colour)", "gameblock3.py", "gameblock4.py", "solids3.py", "solids4.py", "spheres.py", "farface.py", "dial.py", "tribars4.py", "nest2d.py"]
}
json.dump(J, open('solids.json', 'w'), indent=1, default=float)
print(len(json.dumps(J)))

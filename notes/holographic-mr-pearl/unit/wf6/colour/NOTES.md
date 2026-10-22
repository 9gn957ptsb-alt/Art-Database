# wf6/colour — NOTES (running; next agent: read this first)

Task: colour and transparency of the base unit (request 3). (a) tone rule, (b) transparency forming colours,
(c) pearl thin film resolving to the drawing's greys from the drawing's eye, (d) solidity (Beer-Lambert),
final unit.glsl compiled in Chromium WebGL2.

## Step log
- [start] dir created; reading wf3/colour-albers, wf3/colour-glass, wf5/material, unit/.
- [read] wf3/colour-albers: Albers reading holds (white sheet = W+G faces, black sheet = K+G faces, the white sheet
  turned 120 deg lies on the black sheet, IoU 0.973; overlap = grey = 0.501 of each sheet; grey #808080 = sRGB middle
  of white and black). Its unit rule: one parent pair P/Q, weight w(n): one-sided w=1/2+(nz-ny)/2; L1 staircase
  w = sum(|n_i| A_i)/sum|n_i| (A_POS=(.5,0,1), A_NEG=(.5,1,0)). Layer mixes: opaque / middle (c0+c1)/2 / golden
  a=1/phi front. Aggregates: cube exact; sphere dL* 21.9 -> 5.2 from 8 to 55 per side; tetra stalls ~6 (back faces).
  CAVEAT: it used the 9-beam lattice figure (fs.figure, H .1118), not the finished vector figure (H 1/9, ends cut).
- [read] wf3/colour-glass: physical films (multiply / over / fitted alpha) can't make the original from the 3D
  model: class err 8.8-10.2% (the impossible ends); order-free 'logic' (rule_axis: the axis a ray passes clean
  through) gets 2.3% (the edge band). 'unit' = glass logic with golden-angle tints (LCh L90 C13, h0 40 + k*137.5).
- [read] wf5/material/pearl.glsl: Belcour-Barla thin film (Airy, 2 orders), d0 230 nm provisional, nf 1.33, n3 1.0;
  later fit (py/fit5c.json: d0 342, nf 1.16, n3 1.35) not folded in. palette.png = measured cover colours.
- map/ is empty at 19:06 (no middling.md, drift.md): reading Color Middling with the Artifact tool.
- [read] Color Middling (artifact Unn1oM2uv6Bxjv7iex92QP, saved html lines 2431-2660, 2942-2953, 3285-3309):
  default mode "Average (linear midpoint)": M = round(sum(A,B[,C]) / n) per 8-bit sRGB channel;
  offset d = round((B - A)/2): A + d = M, M + d = B. Other modes per channel on v/255 (multiply a*b, screen
  1-(1-a)(1-b), add clamp(a+b) ...). Equation can be solved backwards (exhaustive 0..255 per channel).
  Grey value = round(.299r + .587g + .114b). Print-gamut ink model: "Transparent inks filter the paper
  multiplicatively": v = paper * prod(1 - amt (1 - ink/255)), inks C #00AEEF M #EC008C Y #FFF100 K #231F20.
  => black + white -> round(127.5) = 128 = #808080 = the drawing's grey EXACTLY.
- [read] map/middling.md (19:07) agrees: Average = round((A+B[+C])/n) on 8-bit sRGB, order-free (an overlap never says
  which face is in front, which an impossible figure needs); 50% stacking is order-dependent (#A0A0A0 vs #606060);
  backwards B = 2M - A. Overlaps: G^K #404040, G^W #C0C0C0, K^W #808080 (Average); #000000/#808080/#000000 (Multiply).
- [geom] common.py: six bars from vector.json (model = straight, drawn = cut extents), all-crossings AABB caster
  layers(), drawing_rays() with the vector fit (s 250.65, cx 599.375, cy 375.148, k 1.0393), raster_drawn() = the 13
  polygons (exact vector original; 3988 px off cls_clean, edge band). Straight model opaque: 12794 px off cls_clean
  (the 3 impossible ends + edges); 27797 px of the drawing see 2 solids (crossings), none 3.
- [idea, to verify] VS rule tone(n,v) = sum max(0,n_i v_i) c_i / sum max(0,n_i v_i): what a staircase of axis faces
  shows from eye v. Drawing's eye -> positive-part L1; head-on -> squares rule. The inverted copy (R180 about the
  line of sight, faces off-axis) then shows exactly the Average middles G, #C0C0C0, #404040 from the drawing's eye.
- [a: DONE test A] tone_rule.py -> tone_planes.json, tone_planes_summary.json: 1441 (plane, eye) pairs, voxel
  staircases (72^3) seen from the drawing's eye + 23 others, 3000 rays each; average tone (8-bit) vs rule:
  VS mae 1.94 (max 34.6) | SQ 41.98 (max 219.6) | L1 44.15 | ONE 90.3 | LAM 93.0. Drawing's eye only (60): VS 2.93,
  SQ 20.3, L1 20.6. VS is exact to the Monte Carlo noise (~1.5) when no staircase family is back-facing (mae 1.27)
  or two are (0.00); one back-facing (occlusion): mae 2.84, max 34.6 at grazing (n.v < 0.4). Simple occlusion
  corrections tried (by |v|, |n|, p|v|...) do not beat VS. => THE TONE RULE = VS (two-sided by axis).
- [a: DONE test B] tone_sphere.py -> tone_spheres.json, A1_tone_rule_spheres.png: voxel spheres 8..55 across, far off
  (1.6 units/px), vs one smooth sphere under each rule. At 55: VS |d| 14.0 / 7.4 / 10.5 (drawing's eye / az20el15 /
  az200el50) vs SQ 22.3 / 27.5 / 39.1, L1 23.6 / 21.3 / 43.7; VS converges with N, SQ and L1 plateau.
- [b: films_drawing.json] six bars as films from the drawing's eye (layers = solids crossed, entry-face tone),
  |d| vs the vector original over the figure (8-bit): average 14.13 | golden 14.38 | add 14.78 | screen 15.01 |
  multiply 15.15 | opaque straight model 15.18 | multiply-lin 15.20 (crossings only: average 55.7, opaque 60.3).
  No rule can reproduce the original's crossings (it is opaque and impossible); the Average is closest, and is
  the only one that makes the drawing's grey from its white and black. Class-error metric dropped: a middle is
  equidistant from its parents (ties at 64, 191.5).
  Crossing colours (Average): G/W -> #C0C0C0, G/K -> #404040, K/W -> #808080, same/same -> same.
- [b: renders] B1_films_drawing.png (original | opaque | Average | multiply | add | screen | golden | crossings
  map), B1b_films_complement.png, B2_films_turned.png (5 eyes x opaque / Average grey / Average complementary).
  Complement of the covers' sun glow #FCE5AE = #031A51, OKLab dE 0.028 from the covers' zenith navy #061D43;
  Average(sun glow, zenith navy) = #818179 (within 1,1,7 of #808080). Any colour P and 255-P average to #808080.
- [decision b+d] THE MIXING RULE = the recursive Average: C_last = c_last; C_k = round((c_k + C_{k+1})/2) per 8-bit
  channel, front to back (= Colour Middling's Average for two films, order-free, as every crossing of the drawing
  is; Beer-Lambert in the count: what lies behind k films weighs 2^-k; at k = 8 it is < 1/255: solid). The ground
  never mixes in (the drawing's paper never shows through a face). n-ary Average rejected for stacks: deep films
  never fade (fog, not solid). Within one unit from the drawing's eye N <= 2, so the unit stays order-free.
- [b: DONE golden] golden_films.py -> B3_golden_films.png, golden_films.json (golden bar HG = 1/(6 phi); 'holes' =
  copies at phi^-4 in the 3 tribar holes + the R180 copy in the centre; 'laid' = copies at 1/phi, 1/phi^2 concentric,
  each lifted 0.9 towards the eye). Recursive Average: holes from the drawing's eye forms 0 64 128 192 255 (the R180
  copy's off-axis faces show 128/192/64 by VS); laid forms 14 greys 0 32 48 64 80 96 128 144 ... 224 255 (dyadic
  steps: 4 films deep -> 1/16 steps). Turned: up to 6 layers, 6-8 greys.
- [c: film_scan.py -> film_scan.json] UNIVERSAL ACHROMATIC POINT: at the crux angle every film (any n_f, n_s tried,
  1.16..2.4 on 1.0..2.0) is neutral (OKLab hue chroma 0.0002-0.002) at OPD = 2 n_f d cos(theta_t) = 1971 nm (shader
  model; spectral model 1974 nm). Next ones at 2553, 2853, 3148 nm. First-order white (OPD ~252) is less neutral
  (chroma ~0.005). Neutral reflectance r_D (free film, n_s 1): n 1.33 -> 0.099, 1.45 -> 0.140, 1.6 -> 0.189,
  1.8 -> 0.246, 2.0 -> 0.298, 2.4 -> 0.386.
- [c: pearl_film.py -> pearl_film.json, C1_film_angle_strips.png] designs at OPD_X 1971 (all exact at the crux):
  P-A one film (Mr Pearl's n 1.164 on 1.354, d 1188 nm) over the tone body, out = rho (T/T_D)^2 + (R - R_D):
    hologram only beyond the crux (Fresnel): black faces glint at 70-88 deg, white ~unchanged; chroma mean <= 0.034.
  P-B film alone on black, index per family so R_D(n_k) = tone_k R_D(n_z): n_y = 1 (no film), n_x 1.285 (d 993 nm),
    n_z 2.4 (d 437 nm): strong (chroma mean 0.053-0.059) on grey/white, black dead; values swing with angle.
  Physics: a face exactly black at the crux cannot shimmer if its film is neutral there (only subtraction tricks).
- [c: insight] consequential texture => any surface made of units is a set of AXIS facets, each seen at angle
  cos = |v_i| from eye v: from the drawing's eye every facet of every unit is at the crux (1/sqrt3), so the whole
  world resolves to the drawing's greys there, curved or not; only the head (not made of units) can show colour from
  the crux. The film colour of a surface is then sum_i w_i(n,v) F_i(|v_i|): a function of the eye direction (a
  hologram), the tone weights of the surface (VS).
- [a: DONE test C, logged on resume 16 Oct] curved_test.py -> tone_curved.json, A2_curved_tails.png: unit tails curved
  along the line of sight. Curved BACK (away from the eye): the turned faces gain a component towards the eye, so VS
  re-tones them (24.6k px change; |d| vs original 62.8 VS vs 48.6 identity). Curved TOWARDS the eye: the turn only adds
  components facing away, VS = identity exactly (0 px differ, |d| 17.0). Rule for the curved reconstruction: a face may
  turn as it likes and keep the drawing's tone under VS iff its normal only gains components with n_i v_i <= 0 (away
  from the drawing's eye); a turn toward the eye mixes in the other family's tone (that is the VS consequence, not an error).
- [c: DONE C2, logged on resume] film_designs.py -> film_designs.json, C2_film_designs.png: three designs on the six
  bars (recursive Average films), all exact at the drawing's eye. P-A (film over the tone body): weak (chroma mean
  x .011 y .046 z .006), green-teal glints on black at grazing. P-B (index per family): strong on grey (.069), value
  swings (dL .18), pink/teal. P-E (value of the drawing, hue of the film: F_i = tone_i * R/luma(R)): grey .065, white
  .069, black dead, value held (dL .008 grey): pink, teal, cyan. Choice pending -> P-F = P-E + P-A's grazing glint.
- [resume 16 Oct] left: (c) final design P-F numbers; (d) Beer-Lambert land test + 8-bit depth proof; unit.glsl +
  Chromium compile + GL render vs numpy; palette; final.
- [d: land.py -> land.json, D1_land_solid.png] the game's land (1 m blocks, unit scaled 0.45 = rocket.js FIGURE, bar
  0.1 m), walked block by block (DDA). FINDING: bare units leave the land a LATTICE: from the drawing's eye 36.4% of
  rays pass through ANY depth (the holes line up along (1,1,1), the direction that never changes the drawing): no
  Beer-Lambert decay at all from the crux; turned eyes decay (az30el35 0.41,0.089,0.009,0.0002 for 1-4 blocks;
  az60el60 ~x0.5 per block). Films per ray ~0.8 per block. Rounded recursive Average: after k films what lies behind
  changes the pixel by <= 128,64,32,16,8,4,2,1 levels (k=1..8), then 1 forever (a rounding flip); in float 255*2^-k.
- [d: land2.py -> land2.json, D2_block_films.png] BLOCK FILM: where a ray crosses from a filled block into a filled
  block it crosses a film of the block (the cube the unit approaches); exposed faces (block to air) carry none, so a
  lone unit stays a film and near facades open. 'mean' colour m(v) = sum|v_i| tone_i / sum|v_i| (a cube's 3 faces by
  projected area; from the drawing's eye round(383/3) = 128 = #808080, also for the Cezanne pair) beats 'axis' (each
  crossed face its own tone: striped, deeper-land changes 8.6-21% px): with 'mean' films per ray 7.3-10.2, >=8 films
  46-73% of rays, see-through 0.3% (was 36.9%), adding 4 blocks of land beneath changes 2.2-3.6% of px by >1 level
  (edges), mean change 0.2-0.6 levels (bare: 0.2-23). COST: the front bar always weighs 1/2 -> land shows its units
  in 64/128/192 over the grey body (contrast halved); a lone unit keeps full tones. Beer-Lambert: T = 2^-k, k = films
  (bars + block crossings) ~ L * |v|_1 blocks per metre -> mu = ln2 per film.
- [c: opd_scan.py, film_choice.py(+_fine) -> opd_scan.json, film_choice*.json] balancing the film on its OWN crux colour
  (chroma R/Y(R) divided by R_D/Y(R_D)) makes ANY thickness exact at the crux. Then choose d: OPD_crux 1971 (d 1188)
  neutral band only 0.8-1.1 deg wide; d 342 (Mr Pearl's head) garish (magenta #FF00FF head-on). Scored against the
  covers' film/pearl colours (OKLab nearest): best OPD_crux 420 nm, d = 253.2 nm (cover dist 0.057, strength 0.042,
  neutral band 9.4 deg wide on grey, 9.7 on white). 340-390 nm excluded (crux colour too saturated to balance).
- [c: pearl_final.py 253.2 -> pearl_final.json, C3_pearl_final.png (also _d342, _d1188)] P-F = P-E + P-A glint:
  F_i(c) = tone_i,lin * [R/Y(R)]/[R_D/Y(R_D)] + max(R - R_D, 0), c = |v_i|. Crux: #808080 / #000000 / #FFFFFF exact.
  At d 253: facets turned TOWARD the eye (c > 1/sqrt3) go WARM (grey: #A28064 at 40 deg, #CE7C35 head-on; white:
  #FFFFCA..#FFF870), turned AWAY go COOL then rose (grey #778096 at 65, #AC899B 75, #F2C7C7 85; black #041531 at 65,
  #3C415B at 75): Cezanne's warm/cool modelling falls out of the film, neutral exactly at the crux. Chroma mean
  x .049 y .041 z .036. DECISION (c): d = 253.2 nm, n_f 1.1638 on n_s 1.3539 (Mr Pearl's film indices).
- NEXT: unit.glsl (+ Chromium compile + GL-vs-numpy check), final.
- [resume 2, 16 Oct] found DONE but unlogged: unit.glsl (vec4 unitColour(n,v,l,layers,holo,barPx,closeMean),
  unitColourPair, unitBulk, UnitStack), gl_check.py -> gl_harness.html, gl_shoot.js, gl_result.json, gl_check.json,
  E1_webgl_vs_numpy.png: Chromium WebGL2 (SwiftShader) compiles + links; GL vs numpy max 1 level everywhere
  (drawing's eye holo 0 and Cezanne pair: 0 levels); drawing's eye colours #000000 #404040 #808080 #C0C0C0 #FFFFFF;
  Cezanne pair #031A51 #424D69 #808080 #BEB397 #FCE5AE; bulk at the crux = #808080 in all three modes.
  FAULT: holo 1 at the drawing's eye differs from holo 0 by 1 level in 1197 px (the crux colour is the tone only to
  float precision, and the Average's .5 middles then round either way). Fix: quantise each film to 8 bits before
  it enters the stack (Colour Middling works on 8-bit colours). Then: rocket.js close constants, Cezanne rule 6,
  tone rule on wf6/reconstruct if it has normals, final.
- [a: DONE test D, tone_V3.py -> tone_V3.json, A3_tone_rule_on_V3.png] the finished curved reconstruction (wf6/reconstruct
  V3: every beam bent BACK by m/3 in its free span, smootherstep): from the drawing's eye 47,036 of 122,633 figure px
  (38%) see off-axis normals and EVERY one gains a component toward the eye, so every normal rule smears the bends:
  vs the vector original mae identity 0.00 (0 px) | L1 37.5 | SQ 39.9 | VS 41.4 levels (40.8k-45.9k px off by >8).
  Analytic: a swept face's normal is a x t (a = section edge e_i + e_k/2, t = e_k - s f' m); n.m = -1 constant but its
  picture-plane part turns. => RULE (a) has two cases, by how the surface is made: (1) a SWEPT surface (the curved
  reconstruction: one section translated along a curved line) keeps the tone of the section edge it is swept from
  (= the face family; exact, 0 px, and turned it stays a clean drawing); (2) a surface MADE OF UNITS (staircase,
  sphere/pyramid shells, curved land) takes VS = sum max(0,n_i v_i) tone_i / sum max(0,n_i v_i), exact for staircases
  (mae 1.9). SQ (n_i^2) is the head-on limit of VS only; it is wrong for both cases.
- [unit.glsl v2, 16 Oct] (old copy unit_v1.glsl) each film quantised to 8 bits before stacking; close k =
  smoothstep(0.125, 0.275, 1/barPx) = rocket.js's lod exactly (8 px -> 3.64 px); unitSweptNormal(family, v) for
  case (1). Rebuilt + rerun gl_check: compiles + links (Chromium SwiftShader WebGL2), GL vs numpy max 1 level, drawing's
  eye holo 0 / holo 1 / Cezanne pair all 0 levels off; holo 1 vs holo 0 at the drawing's eye now 0 px (was 1197).
  NEXT: Cezanne check (do the film's warm-toward / cool-away hues match the paintings' lights and shades?), final.
- [Cezanne, cezanne_check.py -> cezanne_check.json, F1_cezanne_warm_cool.png] paintings, 24 px windows: lights warmer
  (db/dL > 0) in 72.3% (watercolour) / 95.9% (oil); light-minus-shade OKLab hue 69.6 / 78.9 deg. The unit film P-F
  (d 253.2): toward-minus-away hue grey 69.8 (40 vs 65 deg) .. 84.6, black 57.7-59.4, white 94.5-109.2. So the film's
  warm/cool IS Cezanne's modelling direction (grey within 0-6 deg of both paintings) - but it is set by the EYE, not
  the light; it agrees with 'lights warm' when lit tops face the eye (game eye above 35.26 deg). Washes = the Average.
  unit.glsl comment added; rebuilt, compiles, same numbers. NEXT: final StructuredOutput.
- [final, 16 Oct] unit_colour.json = every constant and rule for another agent. All of (a)-(d) settled; StructuredOutput sent.

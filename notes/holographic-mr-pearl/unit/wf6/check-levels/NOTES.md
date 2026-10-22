# check-levels — skeptic of wf6/levels (running notes)
Started 16 Oct. Read levels_result.json and levels/NOTES.md. Plan: open renders; check (1) Fibonacci lengths/sums,
(2) drawing as level 2 vs cls (2.098%), (3) phi^-4 opening exact, (4) corner copies, (5) closure, (6) rule D.
- step 1 DONE (c1_drawing.py): drawing at H=1/9 vs cls: 2744 px (2.103%) at vectorize fit, 2737 (2.098%) refit; golden 7853 (6.019%).
  Holes' edges 1.000 u exactly; outline envelope inradius 2.3094 u = exactly a side-8 triangle's; apex support 4.04 u (corners cut).
  Fibonacci sums and golden-fact algebra re-derived by hand: hold. CONFIRMED.
- q_ladder.json already shows sibling overlap 6841 px vs 7601 analytic (10% short: cut corners) - result claims "a triangle of side F(m+1)" without this.
- step 2 DONE c2_open.py (own hole = parent triangle minus children's filled outlines, levels 3-6): hole area = analytic F(m)
  triangle within 1%; opening copy 0 px outside, 0 px over children (faces or filled), 2.0-2.2% of hole left open. CONFIRMED.
  Children outside parent 0 px. Sibling overlap 9-9.7% SHORT of a full triangle of side F(m+1) (cut corners): qualify the claim.
- q_units.py rerun: woven 2.333% thirds / 6.209% golden reproduced.
- step 3 DONE c3_closure.py (level-6 nest, my own projections incl. off-axis turns): drawing 0, turned ortho identical at
  every level (0.163 at 5 deg about (1,2,-1), 0.500 at 20 deg about (0,1,3)), drawn-in perspective 0. CONFIRMED, but it is
  true by construction (both closing points share (a,b) so every placement moves them alike) - not evidence of anything more.
  Raw perspective: 0.08-1.06 (does not close), drawn in + eye 8 deg: 0.20-0.31 (open nearly together).
- step 4 DONE c4_ruleD.py (rule D re-coded from the result's words): K=12, 123.38 across, 3076 leaves, mean 0.513, max 3.575,
  max 1 opening per path, openings hold only records: REPRODUCED exactly; cities 6-11 (Washington 11; NY, Paris, SF 10) ok.
  ERRORS in result text: 12 equal -> offsets -2 (7) and -3 (6), not "-3 and -4"; 40 equal -> 21 at -4 and 20 at -3 (swapped).
  cityplaces.json has 31 cities (PURPOSE.txt says 28; study uses the file: fine).
NEXT: open the remaining renders; fix the result text; write CHECK.md.
- step 5: planet_lattice.png had TWO render faults: apex clipped (b range top 1.02 ext < circumradius 1.064 ext) and rays
  started at depth 80 (lv.drawing_rays) while the planet's pieces reach depth 94.2 (min -83.3): pieces wholly above 80 were
  never drawn. Patched r_planet.py (TOP/BOT 1.12/0.66, O += NH*920); originals saved as check-levels/planet_lattice_before.png,
  r_planet_before.py. Re-rendering (run `python3 r_planet.py lattice` in levels/).
- step 5 DONE: planet_lattice.png re-rendered (apex now inside the frame). The depth-80 origin was latent only: 0 of 27,684
  pieces lay wholly above 80, 2 straddled it (still hit), so the old picture was right apart from the clip.
- step 6 DONE: levels_result.json corrected (rule D examples; corner overlap caveat; 602 of 792 works wording; weak spots
  added: r_in/tree_views are run-1 renders, closure is by construction, woven seam marks, planet render fixed). Original
  saved as check-levels/levels_result_before.json. levels.json corner_relation caveat added. CHECK.md written in levels/.
ALL DONE.

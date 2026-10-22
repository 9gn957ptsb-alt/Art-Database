# CHECK — the Fibonacci ladder (wf6/levels), checked by wf6/check-levels, 16 Oct 2026

Scripts and outputs are in wf6/check-levels/ (c1_drawing.py, c2_open.py/.json, c3_closure.py/.json, c4_ruleD.py/.json, NOTES.md).

## Confirmed
- Lengths: hole 1-6H, growth 6H, side 1, tribar 1+6H, figure 2+6H. Each is the sum of the two before, for any H. They are geometric in phi only when 6H = 1/phi. At H = 1/9 they are 1:2:3:5:8 thirds. In the ladder, level m is F(m)..F(m+4) and the sums hold. The opening is 3F(m+2) - F(m+4) = F(m) and the overlap is 2F(m+3) - F(m+4) = F(m+1). Derived by hand and run (ladder.py).
- The drawing is level 2. On vector.json's polygons, all four holes have edges of exactly 1.000 u. The outline's inradius is 2.3094 u, which is exactly the inradius of a triangle with side 8 (its corners are cut). Against cls it is 2744 px wrong (2.103%) at the vectorize fit and 2737 px (2.098%) after a refit. The golden figure is 7853 px wrong (6.019%). The woven unit is 2.333% wrong (q_units.py rerun). The original's holes measure 1944 px, against 1990 predicted by thirds and 2651 by golden.
- The opening, checked on my own terms: I took the hole to be the parent triangle minus the corner children's filled outlines, at levels 3 to 6. Its area equals the analytic F(m) triangle to within 1%. The inverted level-(m-4) copy has 0 px outside the hole and 0 px over the children (neither their faces nor their filled outlines), and it leaves 2.0-2.2% of the hole open. The children have 0 px outside the parent. Thirds with an exact-phi child overflows by 16.7%, and an exact-phi corner falls 1.1% short (8·phi^-4 = 1.167; 8/phi = 4.944).
- Closure: I used a level-6 nest (the study used level 5), turned about off-axis directions. The gap is 0 in the drawing. When turned, it is the same at every level and in every opening (0.163 at 5° about (1,2,-1), 0.500 at 20° about (0,1,3)). In perspective drawn in toward one eye it is 0.
- Rule D: I re-coded it from the result's own words, not from ladder.py, and it reproduces the result exactly. The planet is K = 12, 123.4 drawings across, with 3076 leaves, a mean size error of 0.513 and a maximum of 3.575. No path has more than one opening, and openings hold only records. Cities sit at levels 6-11 (Washington 11; New York, Paris and San Francisco 10), places 6-10, works 5-9 and details 3-8. The toy is K = 8 (18 across). The comparison rules match q_rules3.json.
- Smaller claims: kappa = 1/(3L) = 0.408. 8 px to 4 px is phi^1.44. The joints in ladder_joints.png are A over B, B over C and C over A, all clean.

## Refuted or corrected (fixed in the files)
- Rule D examples. The result said "12 equal places give levels -3 and -4" and "40 equal works give 21 at -3 and 20 at -4". Its own q_rules3.json and my re-coding both say 12 equal places give 7 at -2 and 6 at -3, and 40 equal works give 21 at -4 and 20 at -3. Corrected in levels_result.json.
- "Each pair overlaps in a triangle of side F(m+1)": the overlap is that triangle minus its two cut corners, 9-10% smaller in area (q_ladder.json's own numbers were 6841 against 7601). Qualified in levels_result.json and levels.json.
- planet_lattice.png cut off its apex: the top of the frame was at 1.02 ext, below the apex at 1.064 ext. Its rays also started at depth 80, while the planet's pieces reach depth 94.2. This second fault had no effect: 0 pieces lay wholly beyond depth 80 and 2 straddled it. I patched r_planet.py (TOP/BOT 1.12/0.66, origin moved by NH·920) and re-rendered. The old files are in check-levels/ (planet_lattice_before.png, r_planet_before.py).
- "Only the 602 works in museums.json": museums.json now holds 792 works in 123 museums. The planet reads the 71 museums of the 31 cities in cityplaces.json, which hold 602 of them. Reworded. (unit/PURPOSE.txt says 28 cities, but cityplaces.json lists 31.)

## Caveats (added to "weak")
- The renders list includes r_in.png and tree_views.png. These are run-1 pictures (exact phi^-4 copies in all four holes; run 1's Huffman tree), not the ladder or rule D.
- Two closure claims are true by construction: "the same relative gap at every level" and "every level closes from one eye". The two closing points share (a, b), so every placement (scale, ±I, a drawing offset, a tilt along (1,1,1)) moves them alike. This shows the placements are consistent with each other. It is not evidence that the nest reads as one form from any other eye. Raw perspective does not close (0.08-1.06), and drawn in with the eye moved 8° the gap is 0.20-0.31.
- In every render, the woven unit leaves faint dashed marks at its slice joints.
- A leaf above level 2 is the drawing scaled by F(m+4)/8, so its own bars are not on the third-block grid. Only the frames' lengths are whole numbers of thirds.
- Details are title, artist, year and medium (museums.json). The levels the shared context names are terms, medium, size and colour; only medium is among them.

## Verdict
Sound after fixes. The geometry (the ladder, the opening, the corners, level 2 as the drawing) and rule D hold numerically. The errors were in the wording of the examples, in the corner-overlap claim and in one render.

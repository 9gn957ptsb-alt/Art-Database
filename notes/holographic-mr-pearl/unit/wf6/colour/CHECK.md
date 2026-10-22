# CHECK of wf6/colour (by wf6/check-colour, 16 Oct 2026)
Scripts and outputs of the check: wf6/check-colour/ (NOTES.md, films_recheck.py/json, vs_recheck.py/json,
tone_V3_rerun.py -> v3_tone_V3.json, facet_recheck.py/json, cez_rerun.py, gl_unit.py + gl_unit/report_v2*.json).
I opened every listed render, plus the original and both covers.

## Confirmed (reproduced independently or rerun)
- Crossing colours: #C0C0C0, #404040, #808080; with the Cezanne pair #BEB397, #424D69, #808080 (these need half-up rounding,
  as JS Math.round; Python's round() gives #BEB297). Complement #031A51 is OKLab dE 0.0281 from #061D43. Block film from the
  crux: round(383/3) = 128 for both pairs.
- Film-mix numbers reproduce exactly (Average 14.13, opaque 15.18, multiply 15.15, add 14.78; crossings 22.6% of the figure).
- VS on voxel staircases: my own exact DDA on 31 random plane/eye pairs gives VS mae 1.44 (SQ 40.8, L1 49.6).
- V3 tone test rerun: identical numbers (identity 0 px, SQ 39.9, L1 37.5, VS 41.4; 47,036 of 122,633 px off the axes).
- Film facet colours: my numpy port of unit.glsl's film gives every claimed hex (one off by 1 level: #A5A4AF at 85 deg).
  OPD at the crux 419.97 nm.
- WebGL2: the harness recompiles and links (Chromium, SwiftShader); pixels are identical to the stored run; GL vs numpy max
  1 level; at the drawing's eye holo 1 = holo 0 (0 px). gl_unit.py tests what the harness never ran: the facade close at
  barPx 100/8/6/5/4.5/4/3.64/2, unitSweptNormal, unitBulk at (1,2,3), and VS on turned normals. All give 0 levels off the
  equations. The close constants match rocket.js line 341 (smoothstep(0.0125, 0.0275, uPx*dist), with near = 1). The old
  close was 0.05..0.11, so the new range is exactly a quarter of it: 2 px -> 0.91 px became 8 px -> 3.64 px.
- Land solidity numbers (land2.json) as claimed. The low eye's 12.4% "through" is the frame margin, not holes.
- Cezanne numbers rerun identical.

## Refuted or overstated
1. "Seen as films from the drawing's eye, the Average comes closest to the original": this holds only for MEAN or RMS error,
   because a middle is half-wrong instead of wholly wrong. Counted by pixels that match (within 2 levels), the Average is
   the WORST of the rules: 83.9%, against opaque 89.9%, multiply 89.2%, add/screen 90.7%. 16.1% of its pixels are off by more
   than 32 levels (opaque 10.1%). The films do not read as the original. They read as the original plus 22.6% crossing bands.
2. "C_k = round((c_k + C_{k+1})/2) film by film" is not what unit.glsl does. UnitStack rounds ONCE, at the end, after the
   float weights 2^-k. For two films the two agree bit for bit. For 3-9 films they differ by 1 level: in 25-50% of random
   stacks, and in 95% of random 9-film stacks in GL. That is the 1-level GL-vs-numpy residue. FIXED (documentation): a
   comment in unit.glsl at unitStackEnd, and unit_colour.json "mix_rule" now states the rule the shader computes. The shader
   code is unchanged; it was rebuilt and rerun (gl_check.json unchanged). Copies from before the fix are in check-colour/*.before_check.
3. Thickness 253.2 nm "whose colours come closest to the covers' film colours": by its own scan (film_choice.json), OPD
   100 nm (cover 0.037) and 2600 nm (0.053) are both nearer the covers than 420 nm (0.057). 420 nm wins only after cuts that
   are not stated (minimum strength, minimum neutral band). Under "determined relations" the relation is incomplete: it
   should name those cuts.
4. "Neutral band about 9.4 degrees wide": true only by OKLab chroma < 0.02. The grey facet stays within 2 levels of #808080
   only from 53.95 to 55.53 degrees (1.6 degrees), and within 5 levels only over about 4 degrees.
5. Cezanne match: weak evidence. Any warm-minus-cool pair falls at 50-95 degrees of OKLab hue, so 70-85 degrees picks out
   little. The film's toward/away pair is also at almost equal lightness (dL 0.025), whereas the paintings pair light with
   shade. The film agrees in direction only; it is not the same modelling.

## Caveats (true but narrower than stated)
- The swept-surface "0 px" is exact by construction: the tone is the family label, and the V3 raster equals the vector
  raster. It is a bookkeeping rule (the shader needs a family id), not a property of the normal.
- VS was proven on staircases of SOLID cubes, not on staircases of the figure unit (bars with holes).
- The film's hues (orange #CE7C35, yellow #FFF870, navy, rose: a first-order film) are browner and more saturated than the
  covers' pastel pink/cyan/lilac pearl. The cover distance of 0.057 OKLab is about three just-noticeable differences.
- Half-up rounding at exact .5 middles (191.5, 127.5) is a knife edge. It held in float32 for all 65,536 two-film pairs
  with no FMA. It was not tested on phone GPUs.
- Small fix: pearl_final.py's docstring still said d = 1188 nm; it now names the final 253.2 nm.
- The pearl's silhouette, head size and brim are not part of this study (see wf6/pearl), so they were not checked here.

# wf6/check-colour — NOTES (skeptic of wf6/colour). Running log; next agent read first.
- [start 16 Oct] no prior check-colour folder or colour/CHECK.md. Read colour/NOTES.md, design-rules, PURPOSE.
  Plan: open renders; recheck numerically: (1) Average arithmetic + crossings; (2) films_drawing numbers; (3) tone VS on
  staircases; (4) V3 tone claim; (5) unit.glsl compile + vs equations; (6) pearl film colours; (7) land solidity;
  (8) close constants vs rocket.js; (9) Cezanne hue claims.
- [films] films_recheck.py/json: MAE reproduces (avg 14.13, opaque 15.18, mult 15.15, add 14.78). BUT share of figure px
  within 2 levels: Average 83.9% (worst), opaque 89.9%, multiply 89.2%, add/screen 90.7%; px off >32: Average 16.1%,
  opaque 10.1%. "Average closest" holds only for mean/RMS error (middles are half-wrong), not for pixels that match.
- [VS] vs_recheck.py (own exact DDA, 31 random plane/eye pairs, solid cube voxels): VS mae 1.44 (SQ 40.8, L1 49.6). CONFIRMED,
  but only for staircases of SOLID cubes, not of the figure unit (bars with holes).
- [V3] tone_V3_rerun.py -> v3_tone_V3.json: identical numbers. Identity = family label = exact BY CONSTRUCTION (V3 raster
  = vector raster, reconstruct mismatch_V3.json 0 px differing).
- [pearl facets] facet_recheck.py (own numpy port of unit.glsl's film): every claimed hex reproduces (85 deg black #A5A4AF vs
  #A5A5AF, 1 level). OPD crux 419.97 nm. Neutral band 9.4 deg is by OKLab chroma < 0.02; the grey facet stays within 2 levels
  of #808080 only 53.95-55.53 deg (1.6 deg), within 5 levels 52.75-56.78 (4 deg).
- [thickness] film_choice.json: OPD 100 nm scores cover 0.037 and 2600 nm 0.053, both nearer the covers than 420 (0.057);
  420 wins only with unstated cuts (strength / band). "the thickness whose colours come closest" is NOT the relation used.
- [land] land2.json reproduces claims; low eye 'through 12.4%' is frame margin (sky/edge rows in D2 tile), not holes.
- [cezanne] rerun identical. But any warm-minus-cool pair lands at 50-95 deg OKLab hue; and the film's toward/away pair is at
  ~equal value (dL 0.025) while the paintings' is light vs shade: weak evidence, direction only.
- [GL composition] unitStack rounds ONCE at the end (float weights 2^-k), not per film as the stated rule
  C_k = round((c_k + C_{k+1})/2): equal for 2 films, differ by 1 level in 25-50% of random 3-9 film stacks.
- [GL] rerun harness: compiles/links, identical px. gl_unit.py: close/swept/bulk/VS 0 levels off; 9-film stack differs from
  per-film rounding in 95% (1 level). FIXED docs: unit.glsl comment at unitStackEnd + unit_colour.json mix_rule; rebuilt
  gl_check (json unchanged). pearl_final.py stale docstring fixed. rocket.js close constants confirmed (old 0.05/0.11).
- [done] colour/CHECK.md written; StructuredOutput next.

# Refining the buildings — the standing pass

The artist's standing ask (24 Sep 2026): every Architectural Authority
building rendered as well as it possibly can be, and refined continuously.
A scheduled session follows this page each time it runs. It works on the
branch `claude/artist-website-dev-s92irf` — pushing there publishes the
Artist Website.

## Each run

1. **Start clean.** `git fetch origin claude/artist-website-dev-s92irf` and
   merge it (never rebase; other sessions push here too).
2. **New bookmarks.** `python3 scripts/update_buildings.py` — fetches the
   artist's bookmarks (signing itself in with `AA_REFRESH_TOKEN`), places new
   buildings on the globe, cuts their ground and fetches their photographs.
   If it stops because the refresh token was refused, carry on with step 3
   and say so at the end: the artist needs to copy a fresh one.
   - **Model every building it lists**, one first model each, the way the
     existing ones were made (`MODELS.md`; the best existing models are the
     guide). Add it to `ledger.json` with `passes: 1`.
   - **A public building** (a museum, a spa, a winery, a civic building) gets
     its own spot: look up its address and add it to `SPOTS` in
     `scripts/build_architecture.py` with its source, then rerun that script
     and `build_grounds.py --force --only <slug>`. **A private home never
     does** — it stays at its town.
2b. **The museums.** The globe also carries every museum that holds a work
   the artist saved on Artsy (the "Artworks" layer). `python3
   scripts/fetch_artsy_saves.py && python3 scripts/build_museums.py && python3
   scripts/build_grounds.py` — refetches the saves (Artsy's token is added by
   the proxy), rewrites `docs/v2/museums.json` (each museum at its door, with
   the works it holds) and cuts the ground of any new museum. Then **model
   the three museums without a model that hold the most works** (the order of
   `museums.json`), one first model each, the building the saved works are in
   (for a museum of several buildings, the one that holds them — the National
   Gallery's West Building). Add each to `ledger.json` with `passes: 1` and
   `"kind": "museum"`. Museums are public buildings: model them exactly.
   Their photographs come from Wikimedia Commons once
   `commons.wikimedia.org` and `upload.wikimedia.org` are allowed; until
   then, work from published plans and dimensions and say so in `notes`.
3. **Photographs** for the buildings to refine: `python3
   scripts/fetch_reference_photos.py` — into `data/photos/<slug>/`
   (gitignored; reference only, never committed).
4. **Choose.** Read `ledger.json` beside this page and take the **three**
   buildings refined longest ago (never refined first). Museums are in the
   ledger too and take their turn with the rest. A building whose
   `sketchup` flag is set is refined in SketchUp (step 6); at most one of those
   per run.
5. **Refine each** (`MODELS.md` has the format):
   - render it large: `node scripts/preview_model.js docs/v2/models/<slug>.json /tmp/<slug>.png --big`;
   - look at every contact sheet in `data/photos/<slug>/` and the key
     exteriors, and write down the five biggest mismatches, most important
     first — proportion, silhouette, roof form, where the glass is, material
     and colour, the defining feature, the setting;
   - fix them, re-render, compare; at least three rounds. Refine rather than
     restart. Keep `max(site) / voxel` about 100 and under ~25,000 dots;
   - update the model's `notes`: what changed, what is still guessed.
6. **SketchUp** (flagged buildings): follow `scripts/sketchup/README.md` —
   edit or write `scripts/sketchup/<name>.py`, build, save, read back,
   convert, preview. Re-commit the `.skp` in `sketchup/` only if the form
   really changed.
7. **If a gap is in the renderer**, not the model (a shape or material the
   parts can't make), add it to `docs/v2/models.js` and `MODELS.md` — small
   and general, in the file's own voice — and check every model still
   renders (`for f in docs/v2/models/*.json …`).
8. **Record.** In `ledger.json`, set each refined building's `refined` to
   today's date and add one to its `passes`; add a line to its `log`.
9. **Check and publish.** Open the site locally (`python3 -m http.server
   --directory docs`, then `/v2/`) and press one refined building: it rises,
   turns and swaps to its ground without errors. Commit ("Refine <names>")
   and push. If the push is refused, fetch, merge and push again.

## Keep

- Photographs never enter the repository or the site.
- Private homes stay unlocated (their clod is their town); nothing in a
  model's notes places a home more exactly than its town.
- Timings and proportions follow the site's golden ratio; the view is true
  isometric.
- Efficient and quiet: nothing redraws at rest; no model grows without
  showing more of its building.

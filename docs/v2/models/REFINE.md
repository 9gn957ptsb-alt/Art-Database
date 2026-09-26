# Refining the buildings — the standing pass

The artist's standing ask (24 Sep 2026): every building on the globe rendered
as well as it possibly can be, and refined continuously — the Architectural
Authority buildings, the museums that hold the works he saved, and every kind
of building added after them. A scheduled session follows this page each
time it runs. It works on the branch `claude/artist-website-dev-s92irf` —
pushing there publishes the Artist Website.

## The kinds of building

| kind | where the places come from | brought in by |
| --- | --- | --- |
| architecture | the artist's Architectural Authority bookmarks | `fetch_architecture_saves.py`, `build_architecture.py` → `architecture.json` |
| museums | the museums that hold the works he saved on Artsy | `fetch_artsy_saves.py`, `build_museums.py` → `museums.json` |

A new kind is one more row here, one more entry in `KINDS` in
`scripts/update_buildings.py`, one more in `LAYERS` in `land.js` (its filter
on the globe), and `"kind"` on its entries in `ledger.json`. Everything below
then covers it without change.

## Each run

1. **Start clean.** `git fetch origin claude/artist-website-dev-s92irf` and
   merge it (never rebase; other sessions push here too).
2. **Bring everything in.** `python3 scripts/update_buildings.py` — for every
   kind: fetches the source (the bookmarks sign themselves in with
   `AA_REFRESH_TOKEN`; Artsy's token is added by the proxy), places what is
   new on the globe, cuts its ground, fetches the new Architectural Authority
   buildings' photographs, and lists, kind by kind, the buildings with no
   model yet. A kind that fails is reported and the rest carry on — say so at
   the end (a refused refresh token means the artist copies a fresh one).
   - **First models.** Every new Architectural Authority building gets its
     first model this run. For the other kinds, model the **three** without a
     model that matter most — the order of their file (the museums holding
     the most saved works first) — so the backlog is worked through a few a
     day. One first model each, the way the existing ones were made
     (`MODELS.md`; the best existing models are the guide); add each to
     `ledger.json` with `passes: 1` and its `"kind"`.
   - **A public building** (a museum, a spa, a winery, a civic building) is
     modelled exactly and gets its own spot; an Architectural Authority one
     goes into `SPOTS` in `scripts/build_architecture.py` with its source,
     then rerun that script and `build_grounds.py --force --only <slug>`. **A
     private home never does** — it stays at its town.
   - For a museum of several buildings, model the one that holds the works
     (the National Gallery's West Building).
3. **Photographs** for the buildings to refine: `python3
   scripts/fetch_reference_photos.py` — into `data/photos/<slug>/`
   (gitignored; reference only, never committed). The Architectural Authority
   articles give their own; the museums' come from Wikimedia Commons once
   `commons.wikimedia.org` and `upload.wikimedia.org` are allowed under
   Network access. Where there are none, work from published plans,
   sections and dimensions, and say so in `notes`.
4. **Choose.** Read `ledger.json` beside this page and take the **ten**
   buildings refined longest ago (artist, 26 Sep 2026: raised from three) (never refined first), whatever their kind
   — every building of every kind takes its turn. A building whose
   `sketchup` flag is set is refined in SketchUp (step 6); at most one of those
   per run.
5. **Refine each** (`MODELS.md` has the format):
   - render it large: `node scripts/preview_model.js docs/v2/models/<slug>.json /tmp/<slug>.png --big`;
   - look at every contact sheet in `data/photos/<slug>/` and the key
     exteriors (or, with none, the published drawings), and write down the five biggest mismatches, most important
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
   --directory docs`, then `/v2/`), pick its layer in the filter and press one
   refined building: it rises, turns and swaps to its ground without errors. Commit ("Refine <names>")
   and push. If the push is refused, fetch, merge and push again.

## Keep

- Photographs never enter the repository or the site.
- Private homes stay unlocated (their clod is their town); nothing in a
  model's notes places a home more exactly than its town.
- Timings and proportions follow the site's golden ratio; the view is true
  isometric.
- Efficient and quiet: nothing redraws at rest; no model grows without
  showing more of its building.

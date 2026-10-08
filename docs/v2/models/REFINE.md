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
   A kind can be **paused** (`"paused"` on its entry in `KINDS`): its intake is
   skipped and says why. The museums' intake is paused since 6 Oct 2026, while
   every work by the artists he follows is saved on Artsy and until he decides
   how those works belong on the site; the existing museums are still modelled
   and refined as before.
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

## Interiors

The artist asked (27 Sep 2026) to walk the building, with every museum on
the site. Each museum has an interior file, `docs/v2/interiors/<slug>.json`
(the format, the certainty policy and the sources are in `INTERIORS.md`
there): its rooms as far as they are known, and where its saved works hang,
as the museum's own records put them. Every museum can be walked from the
first day, as its model's shell; the pass raises them a tier at a time.
After the buildings, each run:

1. **Where the works hang today.** `update_buildings.py` has already run
   `python3 scripts/build_interiors.py --stubs --refresh` (a shell for each
   new museum; the NGA's open data and the Met's, the Art Institute's,
   Cleveland's and SMK's records read again). Placements move as museums
   rehang: works moved, put up or taken down are written into the museum's
   interior log in `ledger.json`, and `update_buildings.py` lists the saved
   works placed in rooms not drawn yet.
   **Every work it holds on its walls, every run** (the artist, 8 Oct 2026:
   "Just because you don't know the location of every artwork in every
   museum doesn't mean you still can't put artwork inside the museum with
   artwork that you know is in the museum"): right after the works pass, `node
   scripts/build_interiors_arranged.js --works` hangs again every work the
   records place in no room drawn — in a museum whose rooms a source draws
   (the NGA, the Met, the Art Institute; OpenStreetMap's where its records
   place works there) beside the museum's own works by the same artist, else
   of its period and kind, else in the nearest room with wall free
   (INTERIORS.md, "Beside the known"); in an arranged museum, and one
   OpenStreetMap draws that no record places a work in, by the arranged
   rule. A newly saved work held by a museum goes up the same day. The pass
   takes the site's works back to their records first, so a work a museum's
   record now places hangs where the record says.
   **The collection on the walls, weekly** (on Mondays, and whenever a
   museum's rooms change): `python3 scripts/build_interiors.py --collection`
   reads again what the Met, the Art Institute, Cleveland and the National
   Gallery have on view (their highlights first) and rehangs up to 300 a
   museum in the rooms drawn (`data/collections/`, never committed). On the
   other days the works pass rehangs them from that copy. A museum's own
   on-view data moves weekly at most; a closed gallery takes its works down.
   **The museums' own maps, when they change:** the NGA's doorways are read
   off its visitor map by `scripts/nga_map_doors.py` (after `--nga`), the
   Met's galleries off its floor plans by `scripts/met_plan_rooms.py`, the
   Art Institute's round its own points by `scripts/aic_rooms.py`; each
   rewrites only what it wrote. A new edition of a map (the NGA's is June
   2025) is fetched into `data/plans/<slug>/` and the script run again.
   **OpenStreetMap's indoor mapping, monthly:** on the first run of each
   month write the date in `osm/INDOOR_REQUEST` and push it, so the
   `osm-indoor` workflow reads `osm/indoor/` again on GitHub's runners; once
   its commit is in, run `python3 scripts/build_interiors.py --osm
   --osm-only --osm-report /tmp/osm-fit.json`, then `node
   scripts/build_interiors_arranged.js --works` (the works no record places
   go up again, in OpenStreetMap's galleries where its plan was taken).
   A museum whose mapping has grown usable (INTERIORS.md, "The sources", 2:
   six rooms or more, two thirds reached, a floor half covered) takes its
   plan in place of the arranged rooms; one whose plan no longer is goes back
   to its shell and is arranged again. The Met, the Art Institute and the NGA
   get only what joins their own rooms. Look at the report's `cover`,
   `reach`, `off` (mapped rooms off the model: a neighbour's, or a model
   standing off its building — file that against the model) and check each
   museum it changed (step 4).
2. **Raise two museums a tier.** First any museum whose records place saved
   works in rooms not drawn (most such works first); then **arranged**
   museums (INTERIORS.md, "Arranged": the site's own rooms, laid out by rule
   so the artist can walk up to every work — his ask of 7 Oct 2026), the
   major museums in the major cities first and most saved works held first;
   then any shell left. An arranged museum is raised by finding its plan,
   its OpenStreetMap indoor mapping (`osm/indoor/<slug>.json`) or its own
   data: its floors are then drawn from the source (its `sure` reconstructed
   or documented, the arranged rooms and their `Room <n>` names dropped
   whole, never mixed with the source's), its works re-placed by their
   records, and `build_interiors_arranged.js` leaves it from then on. Where a
   source only gives its floor count and storeys, put that in `FLOORS` in
   `build_interiors_arranged.js` (with the source, quoted) and run it with
   `--only <slug> --relayout`. After every intake, `node
   scripts/build_interiors_arranged.js --works` re-hangs the arranged
   museums' works (new saved works and new "Also here" works go up by the
   rule) and the works hung beside the known, and with no flag it also lays
   out any new museum's shell (on its plinth's top where its model is solid
   at the ground). For each: research its public entrance (which façade,
   which door, its floor's level) and what its own pages say of where the
   saved works hang (`HANGS` in `build_interiors.py`, with each page's
   address and the day read); draw at least the entrance, the way in from it
   and every room where a saved work hangs, each with its source; leave the
   rest as not known. Plans go only into `data/plans/<slug>/` (never
   committed); nothing is traced — only facts are redrawn, in metres.
3. **Refine the three interiors refined longest ago.** List the five biggest
   mismatches against the sources — the outline, the doorways, the heights,
   the finishes, the entrance — fix them and check again; at least two
   rounds. A doorway needs a source saying the two rooms connect; a room
   name, a material, a height or a size needs its source; what no source
   gives stays earth.
4. **Check.** `node scripts/check_interior.js --all` until it is clean and
   its last line says every saved work is on the walls ("saved works on the
   walls 1129 of 1129"; a museum short of them is named — hang them, or say
   in its log why not), then
   `node scripts/check_interior.js docs/v2/interiors/<slug>.json --png
   /tmp/<slug>` for each museum touched, and look at the plans and frames;
   then `node scripts/smoke_walk.js --jobs 1 --site --only <slugs>` for the
   museums touched (one browser at a time: parallel Chromium crashes in a
   session; `--site` walks to a work the site hung and checks the column's
   and the look's sentences). Independent verifiers check every
   `said` against its source where it can be reached, and every
   reconstructed room against what it cites.
5. **Record.** Each museum's entry in `ledger.json` has
   `interior: {tier, refined, passes, rooms: {documented, reconstructed,
   arranged}, works: {hung, elsewhere, off, none, arranged}, log}` (tier
   documented, reconstructed, arranged or shell); the checker writes the tier,
   rooms and works. Set `refined` to today, add one to `passes`, and add a
   line to its `log`. A finding against the model (a documented room outside
   it, a footprint off its ground's buildings) goes into the model's own
   `log`, written by the checker, for its next refinement; when a model is
   refined, check its interior again, since the shell must still hold the
   rooms.
6. **Publish.** Commit ("Interiors: <names>") with the buildings' work and
   push to `claude/artist-website-dev-s92irf`.

Interiors are for museums only: a new kind of building never gets them by
default, and a private home never does.

## Keep

- Photographs and plans never enter the repository or the site.
- Private homes stay unlocated (their clod is their town); nothing in a
  model's notes places a home more exactly than its town.
- Timings and proportions follow the site's golden ratio; the view is true
  isometric.
- Efficient and quiet: nothing redraws at rest; no model grows without
  showing more of its building.

## The city guides

Each run, after the intake: `python3 scripts/fetch_city_guides.py` (about 10 minutes, paced) and commit `docs/v2/guides.json` and `docs/v2/guides/` — what is on in each city, from Artsy's public show listings (see `docs/v2/GUIDE.md`). Nothing else keeps the guides fresh; a guide read over 21 days ago says so on its pill.

## Bloomberg Connects (weekly)

Once a week is enough (a museum's guide on Bloomberg Connects changes slowly; the Monday run): `python3 scripts/fetch_bloomberg_guides.py`. It reads only the institutions' own "digital guide" pages named in `scripts/bloomberg_hand.json` (`pages`; each host's robots.txt first, 3 s between requests to a host), takes the Bloomberg Connects links it finds there verbatim and rewrites `docs/v2/bloomberg.json`; a refused host is said so and changes nothing. **Never read Bloomberg's own sites**: guides.bloombergconnects.org's robots.txt forbids every robot and www.bloombergconnects.org (its directory of guides) is behind bot protection — no directory, no checking a guide by opening it. Then, for a museum new to `museums.json` since last week, search the web for “"<name>" "Bloomberg Connects"” and add its row to the hand table: its status (guide, unconfirmed, none), its evidence, its own guide page in `pages`, and an address only where one was seen verbatim, with where (`seen`). A guide id is never made up: a guide without a seen address keeps `url: null` and the page shows nothing for it. Commit `scripts/bloomberg_hand.json` and `docs/v2/bloomberg.json` ("Bloomberg Connects: …"); the cache in `data/bloomberg/` never.

## The skylines

The cities' skylines have their own pass since 8 Oct 2026 (the artist: "I want
to make sure that over time this is getting refined to be as up-to-date with
the current status as possible"): `docs/v2/grounds/REFINE.md`, run by its own
daily routine ("Artist Website — cities pass (daily)"), which reads new cities,
cuts each finer a tier at a time and reads it again from Overture's newest
release (`scripts/refine_cities.py`). This pass no longer runs
`update_skylines.py`.

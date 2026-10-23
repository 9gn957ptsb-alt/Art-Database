# The coworker: new artists into DIRT's plane, every week

A scheduled Claude session runs this every week. It brings the next artists from Aries's own Artsy saves into DIRT's
plane (each as a minimal area on the ladder of complexity, see `roster.py`), commits them, and republishes DIRT.
Only the works he saved himself (his choice, 23 Oct 2026: "Only my saves"): not the fifty thousand a run on his
account saved from 1 to 14 October 2026, every work by the artists he follows, which had put KAWS, Honoré Daumier and
Banksy on the roster on 14 October for works he had not chosen.

It runs on Tuesdays at 19:47 UTC, just after the account's weekly usage comes back (Tuesdays at 19:00 UTC). It first
ran on Mondays at 15:00, when the week's usage was already spent, and its runs of 28 September, 5 October and 12
October 2026 all stopped on the usage limit before they began; each of those weeks was made up by hand the day after
or the day after that. A week that fails is made up the same way: these steps, run in any session.

Rules it keeps:

- Work on the branch `claude/digital-dirt-layers-paiial` and push only there (`git push -u origin claude/digital-dirt-layers-paiial`).
  Never push to `claude/artist-website-dev-s92irf`.
- Never commit `data/` or `dirt/private/`: the saves, the database, the downloaded images and the built page stay out
  of the repository. It commits only `dirt/artists/roster.json` (names, colours and numbers), the plants and cast,
  and `roster.py` when it adds an artist to FAMILY.
- The Artsy token is the environment's API credential, added by the proxy; never ask for it or write it anywhere.
- If a step fails, say which and why in the session, and commit nothing half-done.
- End commit messages with the attribution lines the session's own instructions give.

## Steps

```sh
git fetch origin claude/digital-dirt-layers-paiial && git checkout -B claude/digital-dirt-layers-paiial origin/claude/digital-dirt-layers-paiial
pip install numpy pillow requests "opencv-python-headless<4.13" scipy

# 1. his own saves into data/artworks.db: Color Middling's list of them (data/artsy_saves_raw.json on
#    claude/artsy-import-rwgk8s, kept level with Artsy by that branch's daily reconcile, the run's works set aside),
#    read with git lfs smudge (apt-get install -y git-lfs if it is missing); then normalized with the normalizer from
#    the same branch, run in memory and patched for open-ended prices (saves.py says how). It no longer walks Artsy.
git fetch origin claude/artsy-import-rwgk8s
python3 dirt/artists/saves.py

# 2. the next three artists onto the roster
python3 dirt/artists/roster.py --db data/artworks.db --cache dirt/private/briefs --add 3

# 2a. if a new artist's way of working is one of the compositions after a body of work (10-18 in roster.py's
#     docstring) better than the measured one, add them to FAMILY in roster.py, naming the body of work (a real series
#     and its years), and run roster.py again with --add 0 --repalette; then commit roster.py with the roster

# 3. a plant for each new artist (below), then commit the roster and the plants
git add dirt/artists/roster.json dirt/artists/plants.json dirt/artists/cast.json dirt/artists/roster.py
git commit -m "DIRT roster: <the artists added>"
git push -u origin claude/digital-dirt-layers-paiial

# 4. rebuild DIRT and republish it (the plane is built from the saves; its files stay in dirt/private/). In a fresh
#    session soil_tiles.py first downloads the chocolate paintings it uses (into dirt/private/cache/), so give it
#    time; a work Artsy has taken down since it was saved (403 or 404) is passed over for the next painting. It
#    takes the faces it may centre a clod on from dirt/private/faces.json (4a brings it from the artifact); without
#    that file it searches every saved painting for faces, some 11,000 downloads, an hour or more
# (4a, below: the quilts, the history and the faces into dirt/private/ first)
python3 dirt/soil_tiles.py --db data/artworks.db
python3 dirt/build_soil_viewer.py                 # the plane alone: the Earth is the website's globe
```

**3a. Every new artist gets a plant.** DRIFT's garden (`build_soil_viewer.py`, `LIFE.garden`) grows a plant for every
artist: coleus leaves in their colours and a flower tied to them. For each artist just added, find a plant with a real
tie and add it to `dirt/artists/plants.json`: a flower or plant they painted, photographed or made a work of (best,
`"tie": "work"`; check Aries's saved works in `data/artworks.db` first), one that does what their work does
(`"process"`), has its shape (`"form"`), or lives in their light (`"hour"`). Give `why` one sentence naming the work and
its year; never invent a work, and prefer a plant not already in the garden. Choose the `form` (radial, rose, cluster,
spike, pitcher, pad) and the flower's real colours `[heart, petal, edge]`; the leaves come from their palette. An
artist without an entry still grows a flower in their own colours, so the garden never waits, but the entry is the
point: the plants are how the artists relate to each other where their gardens meet and cross.
Then give the plant a character in `dirt/artists/cast.json` (the garden as a film, *Falling Like Leaves*): a name and
role drawn from the artist and the plant, the place on Earth where the plant thrives (with its latitude, longitude and
climate) as the setting, the scene they act out there, and the performance from the history of cinema the part is
written after (a real actor, film and year, and in `why` the performance and its honours, checked). Pick the `action`
that best shows the scene (petals, cut, flash, fling, rain, glow, void, wind, ripple, swap).

**4a. The private images come from the artifact, never from nowhere.** The page is built with the quilts
(`dirt/private/quilts/`) and the history of Greece and Rome (`dirt/private/antiquity/`); they are never committed, and
a fresh session does not have them. Built without them, the page loses the quilts, the history's light and the
collage's painting pieces, so it must not be published that way. They live beside the page in the DIRT artifact
itself. Before `soil_tiles.py` and `build_soil_viewer.py`, read them back with the Artifact tool (`action: "read"` with the artifact's
`url` and `paths`): first `quilts/quilts.json`, `antiquity/antiquity.json` and `faces/faces.json`, then every file
those list (`quilts/qNN.jpg`, `antiquity/aNN.jpg`, `faces/faces.jpg`), and copy them, with the JSON files, into
`dirt/private/quilts/`, `dirt/private/antiquity/` and `dirt/private/faces/`; and `plane/faces.json` (the faces found
in the saved paintings, the boxes the plane may centre a clod on) into `dirt/private/faces.json`. Check that every listed file arrived. **If any is missing, do not rebuild or republish:**
the roster is committed, and the next session that has the files picks it up; say so in the final line.

Then publish `dirt/private/collection-soil.html` to the existing DIRT artifact,
https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k (read it first, then publish with that `url`, passing no `files`:
the images and their JSON already there are kept). If the rebuild or the publish cannot be done in that session, the
roster is still committed and the next rebuild picks it up.

Then bring DRIFT Poetry into step: it is DRIFT's page with the pages of Picture Poetry laid on it, built from DRIFT
as just published, so follow `dirt/poetry/UPDATE.md` (https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp). If it
cannot be done, DRIFT Poetry stays a version behind until the next session that can; say so.

Finish with one short line: which artists were added, their grammar and rung (from `roster.py`'s output), their plants and characters, and whether
DRIFT and DRIFT Poetry were republished.

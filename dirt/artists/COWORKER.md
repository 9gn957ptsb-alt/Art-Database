# The coworker: new artists into DIRT's plane, every week

A scheduled Claude session runs this every week. It brings the next artists from the Artsy saves into DIRT's plane
(each as a minimal area on the ladder of complexity, see `roster.py`), commits them, and republishes DIRT.

Rules it keeps:

- Work on the branch `claude/digital-dirt-layers-paiial` and push only there (`git push -u origin claude/digital-dirt-layers-paiial`).
  Never push to `claude/artist-website-dev-s92irf`.
- Never commit `data/` or `dirt/private/`: the saves, the database, the downloaded images and the built page stay out
  of the repository. The only file it commits is `dirt/artists/roster.json` (names, colours and numbers).
- The Artsy token is the environment's API credential, added by the proxy; never ask for it or write it anywhere.
- If a step fails, say which and why in the session, and commit nothing half-done.
- End commit messages with the attribution lines the session's own instructions give.

## Steps

```sh
git fetch origin claude/digital-dirt-layers-paiial && git checkout -B claude/digital-dirt-layers-paiial origin/claude/digital-dirt-layers-paiial

# 1. the saves, fresh from Artsy, into data/artworks.db
python3 scripts/fetch_artsy_saves.py
git fetch origin claude/artsy-import-rwgk8s
git show origin/claude/artsy-import-rwgk8s:scripts/normalize_artsy_saves.py > scripts/normalize_artsy_saves.py
python3 scripts/normalize_artsy_saves.py          # writes data/artworks.db
rm scripts/normalize_artsy_saves.py

# 2. the next three artists onto the roster
pip install numpy pillow requests
python3 dirt/artists/roster.py --db data/artworks.db --cache dirt/private/briefs --add 3

# 3. a plant for each new artist (below), then commit the roster and the plants
git add dirt/artists/roster.json dirt/artists/plants.json dirt/artists/cast.json
git commit -m "DIRT roster: <the artists added>"
git push -u origin claude/digital-dirt-layers-paiial

# 4. rebuild DIRT and republish it (the plane is built from the saves; its files stay in dirt/private/)
pip install "opencv-python-headless<4.13" scipy
python3 dirt/soil_tiles.py --db data/artworks.db
# (4a, below: the quilts and the history into dirt/private/ first)
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
itself. Before `build_soil_viewer.py`, read them back with the Artifact tool (`action: "read"` with the artifact's
`url` and `paths`): first `quilts/quilts.json`, `antiquity/antiquity.json` and `faces/faces.json`, then every file
those list (`quilts/qNN.jpg`, `antiquity/aNN.jpg`, `faces/faces.jpg`), and copy them, with the JSON files, into
`dirt/private/quilts/`, `dirt/private/antiquity/` and `dirt/private/faces/`. Check that every listed file arrived. **If any is missing, do not rebuild or republish:**
the roster is committed, and the next session that has the files picks it up; say so in the final line.

Then publish `dirt/private/collection-soil.html` to the existing DIRT artifact,
https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k (read it first, then publish with that `url`, passing no `files`:
the images and their JSON already there are kept). If the rebuild or the publish cannot be done in that session, the
roster is still committed and the next rebuild picks it up.

Finish with one short line: which artists were added, their grammar and rung (from `roster.py`'s output), their plants and characters, and whether
DIRT was republished.

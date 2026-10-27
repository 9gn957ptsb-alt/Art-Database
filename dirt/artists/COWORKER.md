# The coworker: new artists into DIRT's plane, every week

A scheduled Claude session runs this every week. It brings the next artists from Aries's own Artsy saves into DIRT's
plane (each as a minimal area on the ladder of complexity, see `roster.py`), commits them, and republishes DIRT.
Who comes next is picked from the works he saved himself (his choice, 23 Oct 2026: "Only my saves"), not from the
fifty thousand a run on his account saved from 1 to 14 October 2026, every work by the artists he follows, which had
put Frank Stella, Karel Appel and Wayne Thiebaud on the roster on 6 October and KAWS, Honoré Daumier and Banksy on 14
October, for works he had not chosen (4, 1, 0, 0, 0 and 1 of his own). The plane still takes its paintings and
colours from every save, the run's included, so it keeps its variety (the same day: "maintaining the color
diversity"; on his own alone each chocolate painting would fill about 29 clods instead of about 4). It never
stops: "I want it to gradually become a mosaic of everyone" (Aries, 23 Oct 2026), every artist he has saved, the most
saved first, those he saves later joining the line.

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

# 1. every save, fresh from Artsy, into data/artworks.db (the plane's): four pages at a time, a page retried when its
#    tunnel drops or Artsy answers 5xx, and on past Artsy's count (which runs behind) until a page comes back empty;
#    then normalized with the normalizer from claude/artsy-import-rwgk8s, run in memory and patched for open-ended
#    prices (saves.py says how; fetch_artsy_saves.py alone, one page after another, rarely gets through forty thousand
#    saves). Then his own saves into data/own.db (the roster's): Color Middling's list of them (data/artsy_saves_raw.json
#    on that branch, kept level with Artsy by its daily reconcile, the run's works set aside), read with git lfs smudge
#    (apt-get install -y git-lfs if it is missing) and normalized the same way.
git fetch origin claude/artsy-import-rwgk8s
python3 dirt/artists/saves.py

# 2. the next three artists onto the roster
python3 dirt/artists/roster.py --db data/own.db --cache dirt/private/briefs --add 3

# 2a. if a new artist's way of working is one of the compositions after a body of work (10-18 in roster.py's
#     docstring) better than the measured one, add them to FAMILY in roster.py, naming the body of work (a real series
#     and its years), and run roster.py again with --db data/artworks.db --add 0 --repalette (palettes from every
#     save, so the colours keep their variety); then commit roster.py with the roster

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

**4b. The week's screenshots come in as the artists do.** Aries, 27 Oct 2026: "I want you to collage all of the
screenshots that you sent me throughout my code sessions start implementing those screenshots into DRIFT just like you
implement Artist works from Artsy." The screenshots Claude has sent Aries are kept beside the page in the artifact
(`screens/`, with `screens/screens.json`) and quilted by session, as an artist's works are (`artists/screens.py`, and
`quilt.py --screens`, which says how). Each week, after 4a: read `screens/screens.json` and every file it lists into
`dirt/private/screens/`. Then, for each of Aries's sessions (`list_sessions`, `mine: true`) updated since the newest
`at` in screens.json, this one aside, page `list_events` back from its newest event (`limit: 100`, `before_id` the
page's `first_id`) until its events are older than that `at`. Run
`python3 dirt/artists/screens.py page <session id> <the saved page> dirt/private/screens-work` on each page the
harness saves to a file (a page that comes back inline is small and holds no image: take its `first_id` and go on).
Write `dirt/private/screens-work/titles.json`, each session id to its title, then run
`python3 dirt/artists/screens.py join dirt/private/screens-work dirt/private/screens`. It adds each image sent that
Claude had looked at first (the others are lost, and it names them). If it added any, run
`python3 dirt/artists/quilt.py --screens dirt/private/screens --out dirt/private/quilts` before `build_soil_viewer.py`,
and publish the new and changed files with the page: `quilts/quilts.json`, the screens' quilts, and the new `screens/`
files with `screens/screens.json`.

Then publish `dirt/private/collection-soil.html` to the existing DIRT artifact,
https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k (read it first, then publish with that `url`, passing no `files`
but 4b's: the images and their JSON already there are kept). If the rebuild or the publish cannot be done in that session, the
roster is still committed and the next rebuild picks it up.

Then bring DRIFT Poetry into step: it is DRIFT's page with the pages of Picture Poetry laid on it, built from DRIFT
as just published, so follow `dirt/poetry/UPDATE.md` (https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp). If it
cannot be done, DRIFT Poetry stays a version behind until the next session that can; say so.

Finish with one short line: which artists were added, their grammar and rung (from `roster.py`'s output), their plants and characters, how many
screenshots came in (and how many were lost), and whether DRIFT and DRIFT Poetry were republished.

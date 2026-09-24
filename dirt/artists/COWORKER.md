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

# 3. commit the roster
git add dirt/artists/roster.json
git commit -m "DIRT roster: <the artists added>"
git push -u origin claude/digital-dirt-layers-paiial

# 4. rebuild DIRT and republish it (the plane is built from the saves; its files stay in dirt/private/)
pip install "opencv-python-headless<4.13" scipy
python3 dirt/soil_tiles.py --db data/artworks.db
python3 dirt/build_soil_viewer.py --earth dirt/earth/out
```

DIRT's Earth is the Artist Website's globe, published beside the page under `world/`, taken fresh from the website's
branch every time:

```sh
python3 dirt/world_files.py --out dirt/private/world --list > /tmp/world-files.json   # the paths to publish
```

Then publish `dirt/private/collection-soil.html` to the existing DIRT artifact,
https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k (read it first, then publish with that `url`), with `root` set to
`dirt/private` and `files` the list of `world/...` paths from `/tmp/world-files.json`. If the rebuild or the
publish cannot be done in that session, the roster is still committed and the next rebuild picks it up.

Finish with one short line: which artists were added, their grammar and rung (from `roster.py`'s output), and whether
DIRT was republished.

# Holographic Mr Pearl: work in progress, specs and the test harness

This folder is on the branch `claude/holographic-pearl-sight-wip` only, never on the site branch: it carries what a
new session needs that lived only in one container's scratchpad on 21–22 Oct 2026.

## The branch

`claude/holographic-pearl-sight-wip` is `claude/artist-website-dev-s92irf` at b197efca, plus one commit with the
reflex sight and the throw half built (docs/worlds/rocket/rocket.js, pearl.js, index.html, rocket.css, README.md,
about 950 lines) and this folder. It is not reviewed or fully tested, so it is not on the site branch, which GitHub
Pages deploys. To finish it: bring the site branch's newer commits into it, finish and test (below), then merge it
into `claude/artist-website-dev-s92irf` without this folder (`git rm -r notes/holographic-mr-pearl` first, or merge
and then remove it there).

Open in the sight and throw when it stopped: a pearl thrown onto water should sink and lie on the bottom; one thrown
onto a note should come to rest on it; the crux's label on water; the desk and phone runs had not run to the end.

## specs/

- `SIGHT-AND-THROW-SPEC.md` — the spec the build follows (the sight, the throw, the controls, the tests): read first.
- `SIGHT.md`, `THROW.md` — the earlier designs it reconciles (made when the game still had first person).
- `SMASH.md` — the guitar smash as built and published (v10); the artist has since asked for it twice as fast, in
  three styles chosen at random (not started).
- `STICK-WATER.md` — the left-thumb stick as a touch on water, as built (`Water()` in rocket.js).

## harness/

Headless Chromium tests of the game. `game.js` is the harness (`open({view: "desk"|"phone", virtual: 25, port})`, a
virtual clock of 25 ms a frame; `frames(P, n)`, `state(P)`); the others use it.

- Serve the site's docs: `python3 serve_utf8.py 8803 <repo>/docs` (in the background).
- Node: `NODE_PATH=/opt/node22/lib/node_modules node <script> desk|phone <outdir> 8803`.
- `game.js` points at a copy of Chromium renamed `w10brw` with its own profile folder (other workflows on that
  machine stopped browsers by name). On a new machine set `EXE` in `game.js` to `/opt/pw-browsers/chromium` (or make
  the copy again: copy the Chromium binary under another name) and `PROFILES` to a folder of your own; fix the
  `require("…/game.js")` paths in the other scripts to this folder.
- `landing.js` — the body following the head (every way out of the hologram); `smash.js` and `smash_check.js` — the
  smash in the game and its geometry against his head; `stick_game.js` — the water stick with real touches;
  `holo_while_moving.js` — Holo pressed with one thumb while the other is on the stick; `artifact2.js` — the built
  Artifact (served on 8805) plays through; `smoke.js` — loads without errors; `sight/` — the sight's own tests.
- Software GL is slow: run desk and phone at once in the background, with long timeouts. A raw Artifact bundle has no
  viewport tag of its own, so the emulated phone lays it out 980 px wide; the published page has the viewport.

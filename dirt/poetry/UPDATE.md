# Keeping DRIFT Poetry in step with DRIFT and Picture Poetry

DRIFT Poetry (https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp) is made of two other artifacts: DRIFT
(https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k), whose page it is, and Picture Poetry
(https://claude.ai/artifact/GK14x2YbV1T7rMDtpnmhQE), which is taken into it in pieces (README.md says how). Whenever either is published again,
DRIFT Poetry is built again from both, as they now stand, and republished. Aries, 14 Oct 2026: "Make sure that it
updates anytime either of the other artifacts are updated."

Who does it:

- **The session that made it** watches both artifacts (a durable wake subscription on each, held by the artifact
  service): it is woken with a new turn when either is republished from anywhere else, and follows the steps below.
- **The weekly coworker** (`dirt/artists/COWORKER.md`) follows them after it republishes DRIFT.
- **Any session that republishes DRIFT or Picture Poetry itself** follows them straight after: no wake comes for a
  session's own publish.

A session coming to it fresh has nothing private on disk: everything it needs is in the three artifacts and this
repository.

## Steps

0. **Is it needed?** Read DRIFT Poetry's `poetry/sources.json` (the Artifact tool, `action: "read"`, its url and
   `path`): it names the versions of DRIFT and Picture Poetry it was built from. Read DRIFT and Picture Poetry (`read`
   with each url; the result's first line names the version). If both versions match, stop: it is already in step.

1. **The branch and the tools.**

   ```sh
   git fetch origin claude/digital-dirt-layers-paiial && git checkout -B claude/digital-dirt-layers-paiial origin/claude/digital-dirt-layers-paiial
   pip install numpy pillow scipy
   ```

2. **DRIFT's page.** The `read` of DRIFT's url in step 0 saved its full page to a file and named it: that file is
   what DRIFT Poetry is built on. Note DRIFT's version, and list its files (`list`, `scope: "files"`).

3. **Picture Poetry's files.** List them (`list`, `scope: "files"`) and read them all back (`read` with `paths`):
   `index.html`, every `page-N.jpg` and `photo-N.jpg`. They are saved under one folder of the scratchpad; note it,
   and Picture Poetry's version.

4. **What the last build kept.** Read DRIFT Poetry's `poetry/poems.json` and `poetry/sources.json` (`read` with
   `paths`) and copy both into `dirt/private/poetry/` (ignored, never committed).

5. **Capture the pages.**

   ```sh
   NODE_PATH=$(npm root -g) node dirt/poetry/capture_pages.js <the folder of Picture Poetry's files> dirt/private/poetry
   ```

   It opens Picture Poetry in Chromium, photographs each page's creatures as that artifact draws them (its buildings
   hidden: DRIFT Poetry draws them live, to be turned), and copies the page images and photographs beside them, with
   what its data says about each page (`pages.json`), its buildings and the book's notes on everything on its pages
   (`buildings.json`, printed in the books the plots open into) and the code that draws the buildings (`models.js`).
   The creatures walk while they are photographed: if the creatures' sheet the build makes looks wrong (a creature cut
   in half), keep the last build's `overlays/` (copy `dirt/private/poetry/` to the scratchpad before capturing). A
   session coming fresh has no last overlays: capture again a few times into the scratchpad instead and keep, page by
   page, the `over-N.png` whose creatures lie most within their boxes (pages.json's `box`es: least of each creature
   spilling out round its box).

6. **The poems.** The poems exist only in the page images. For a page that is new (it has no entry in `poems.json`;
   the build refuses to run without one), read its poem from its image (crop it at full size and look) and add an
   entry: `n`, its `title` (or a `label`, its first words, for an untitled prose poem; a `signature` for a signed
   one), its `lines` (an empty line between stanzas, the words exactly as printed, curly quotes and dashes as they
   are) and `"prose": true` for prose. The build also says which pages have changed since the last one: check each
   one's poem against its image, line by line (on 14 Oct page 4 was redesigned, and one word of its poem changed with
   it).

7. **Build it.** Write the versions read in step 0 to a small file, then build:

   ```sh
   cat > <scratch>/sources.json <<'EOF'
   {"drift": {"url": "https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k", "version": "<DRIFT's version>"},
    "picturePoetry": {"url": "https://claude.ai/artifact/GK14x2YbV1T7rMDtpnmhQE", "version": "<Picture Poetry's version>"},
    "built": "<today>"}
   EOF
   curl -sSL -o <scratch>/MorphoLEX_en.xlsx https://raw.githubusercontent.com/hugomailhot/MorphoLex-en/master/MorphoLEX_en.xlsx
   pip install openpyxl
   python3 dirt/poetry/build_poetry.py --drift <DRIFT's page, from step 2> --out <scratch>/drift-poetry --sources <scratch>/sources.json \
     --morpholex <scratch>/MorphoLEX_en.xlsx
   ```

   MorphoLex (6.8 MB, the scratchpad only) is how the spirit postures the breath (README, "The spirit's postures"): it
   prints how many of the poems' words it found, shed and rooted, and how many of DRIFT's paintings share a root with
   them (`the kin`, Morphology's order between the plots). Always pass it: without `--morpholex` the build drops both
   (the lines breathe as before and the swimmers keep DRIFT's own choice between the plots). The paradise book
   (`books/`) and Glyph Light (in DRIFT's own page) come in with no option.

   Each page's photograph is cut from its image (where Picture Poetry's data sets it, or else the largest patch of the
   page unlike its paper) and its creatures from its overlay: read the printed sizes and look at any photograph that
   seems wrong. For each page it also prints the paper and ink it read and whether it read its lines' places (the
   indents its book sets them at): a page whose bands of type do not match its poem's lines is set flush, which is
   right only for a prose poem. The build refuses a DRIFT whose engine has no swimmers' lines (`GLG.verse`): publish DRIFT from this
   repository first.

8. **Look at it.** Serve `<scratch>/drift-poetry` with DRIFT's private folders beside it (`quilts/`, `antiquity/`,
   `faces/`, from DRIFT's files) and open `index.html#forcegl&pageN` in headless Chromium for each new or changed page
   (`pageN` begins beside the building of page N; `nopoetry` shows DRIFT alone; `nowords` leaves DRIFT's lines and
   swimmers as they are). There must be no page errors. `GLG.verse()` gives `{ begun, letters }`: after a minute the
   swimmers must have begun lines (`begun`, each with the index of its line) and set letters down (`letters` above 0),
   and a frame must show them legible (a software GPU draws slowly, so the swimmers crawl and few letters show at
   once). The calm country's lines must open into the poems' letters and close again (README.md says which).
   `window.DRIFT_POETRY.buildings()` lists the buildings on the screen (their middles, in client pixels): drag one
   sideways with the mouse and it must turn, and settle on a diagonal when let go; click one and it must open like a
   book (`window.DRIFT_POETRY.book()` gives `{ open, busy, wide, pos, pages }`), at a phone's size and a desktop's:
   look at the cover, the first leaf, the poem (its indents as on its page, nothing cut off) and the last leaf, turn
   every leaf, and close it (Escape): it must lie down where it was, and `open` be false. A photograph of Picture
   Poetry must arrive torn out near where the visit begins, a few seconds after the ground is painted. DRIFT's page
   lays Glyph Light over all of it (`window.GLYPHS`, its text the poems): `GLYPHS.set({ active: () => false })` shows
   the plane under the glyphs. On a software GPU (`--use-angle=swiftshader --enable-unsafe-swiftshader`, as
   `dirt/engine/check_kaleidoscope.js` launches it) the page takes minutes to load: keep the views few and small.

9. **Publish it** to DRIFT Poetry's url with the Artifact tool: `file_path` `<scratch>/drift-poetry/index.html`, and
   `files` mapping every `poetry/...` file of the build to its path (`photo-N.jpg`, `creatures.png`, `poems.json`,
   `sources.json`) and every `poetry/...` file DRIFT Poetry already has that the build does not to `null`, so it goes.
   List DRIFT Poetry's files first (`list`, `scope: "files"`): the tool will not replace a file the session has not
   seen. DRIFT's own files (its `quilts/`, `antiquity/` and `faces/`; not `index.html` or `plane/...`) are already in
   DRIFT Poetry and are kept when left out: map only those whose size differs between the two listings, or that DRIFT
   Poetry lacks, to `{"artifact": DRIFT's url, "path": the same path}`, copied server side. Leave `capabilities` out (they carry forward: DRIFT's own, `sample`,
   `assets`, `db` and `downloads`, which its page uses); if DRIFT's declaration has changed, declare the same set.

10. **Commit** whatever changed in `dirt/poetry/` (a fix to the cutting or the capture) and push to
    `claude/digital-dirt-layers-paiial`. Nothing from `dirt/private/` is ever committed.

If a step fails, leave DRIFT Poetry as it was (it still works, a version behind), and say which step failed and why.

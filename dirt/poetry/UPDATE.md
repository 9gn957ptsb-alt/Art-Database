# Keeping DRIFT Poetry in step with DRIFT and Picture Poetry

DRIFT Poetry (https://claude.ai/artifact/SkC8TxFP9ayxPk7DGyugdp) is made of two other artifacts: DRIFT
(https://claude.ai/artifact/BnUEaZBUoGZ31uGoF6d82k), whose page it is, and Picture Poetry
(https://claude.ai/artifact/GK14x2YbV1T7rMDtpnmhQE), whose pages lie on it. Whenever either is published again,
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

   It opens Picture Poetry in Chromium, photographs each page's buildings and characters as that artifact draws them,
   and copies the page images and photographs beside them, with what its data says about each page (`pages.json`).

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
   python3 dirt/poetry/build_poetry.py --drift <DRIFT's page, from step 2> --out <scratch>/drift-poetry --sources <scratch>/sources.json
   ```

   Each page is measured from its image (its photograph, its poem, its paper and its ink): read the printed
   measures and look at any that seem wrong. A page not named in `ACCENT` and `LEAN` in `build_poetry.py` takes the
   most vivid colour of its photograph and a still from its name; give a new page its own there if it deserves one.

8. **Look at it.** Serve `<scratch>/drift-poetry` with DRIFT's private folders beside it (`quilts/`, `antiquity/`,
   `faces/`, from DRIFT's files) and open `index.html#forcegl&pageN` in headless Chromium for each new or changed page
   (`pageN` begins on page N; `nopoetry` shows DRIFT alone). There must be no page errors, and every poem must be
   legible.

9. **Publish it** to DRIFT Poetry's url with the Artifact tool: `file_path` `<scratch>/drift-poetry/index.html`, and
   `files` mapping every `poetry/...` file of the build to its path, and every file DRIFT publishes except
   `index.html` and `plane/...` (its `quilts/`, `antiquity/` and `faces/`) to `{"artifact": DRIFT's url, "path":
   the same path}`, copied server side. Leave `capabilities` out (they carry forward: DRIFT's own, `sample`,
   `assets`, `db` and `downloads`, which its page uses); if DRIFT's declaration has changed, declare the same set.

10. **Commit** whatever changed in `dirt/poetry/` (a new page's accent, a fix to the measuring) and push to
    `claude/digital-dirt-layers-paiial`. Nothing from `dirt/private/` is ever committed.

If a step fails, leave DRIFT Poetry as it was (it still works, a version behind), and say which step failed and why.

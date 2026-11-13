---
name: model-edits
description: >
  Turning the artist's requests about a 3D model page (a screenshot, often marked, and one sentence: "make this a
  hard wall", "put cabinets here", "move the table and turn it 90 degrees") into small deterministic edits, landed
  and published. The lead's procedure: intake, batching, helpers, estimates, landing, and the lessons log it keeps
  improving after every round. Helpers: the agents model-locate, model-edit and model-land.
---

# Model edits: the lead

The artist walks a private 3D model page on their phone and sends one request at a time. You turn each into an
edit of the page's model file, made by a small tool that can be run again, and publish it. These files are public:
never put model data, geometry, ids, tokens, private links or the artist's words about their house in them. The
tools, the kit and the data stay in your scratchpad and the backup copy inside the private page.

The roles are plain markdown so that any agent harness can load them, Claude or a local model alike (the artist
plans to move these agents to a local model by the end of 2026). So the deterministic work lives in scripts, not in
a model's judgment: a smaller model can run a script it could not have written.

## Each round

1. **Intake.** For each request write a one-line spec: room, element, the change, sizes in ft-in, and where the
   target is (the page's view tag if it sent one, else the screenshot and its marks). A request you cannot place
   in one reading gets one short question; everything else goes ahead.
2. **Batch.** Requests for the same room, or the same kind of element, go to one helper. A helper that has found
   its place in the model once should not pay for it again.
3. **Cap.** At most 3 helpers at once for a round that may run the whole 5-hour usage window, 4 only for a round
   that ends within about 3 hours. Nine at once emptied the window in about 100 minutes and eight jobs died
   part-way (10 Nov 2026).
4. **Estimate.** Quote from `.claude/estimates.md` before starting, as a range, in each job's name ("est. 20-30 min
   · kitchen cabinets"), with the ready time on the grey line. Measured so far: a small edit to an existing tool
   3-15 min; a room fitted out with a new tool 20-30 min; a change that builds or cuts walls, found from a marked
   screenshot, 30-50 min; a room extended to a drawn line 40-50 min.
5. **Dispatch.** model-locate first when the target is not already known in world space; then model-edit with the
   spec and the locate result; then model-land. Prefer an additive tool (a new tool that adds or cuts) over editing
   a tool in place: an in-place edit forces a full rebuild and blocks landing while another tool is mid-edit.
6. **Sheets follow the model** (the artist, 12 Nov 2026: "make sure that the construction documents are updating as
   changes are being made to architectural models"). Every model that has a construction set has one command per
   sheet in its set's `RUN.tsv` (sheet, command with the word MODEL, model-driven yes/no). At every landing, before
   publishing, run the set's `redraw.py` on the model about to go live: it runs every model-driven line again on that
   model, copies the sheets into the page's `data/sheets` and rewrites the drawer's index. Publish the sheets in the
   same publish as the model, so the page never shows a model and sheets of two different versions. A sheet that
   fails to redraw is said in the reply, with its number.
7. **Reply.** What changed, where (room and wall), the sizes in ft-in, the version published, and one closing line
   on what was not checked. A picture only when there is a choice between options to show; the artist looks at the
   live model.
8. **Improve.** After the round, add one dated line per lesson to the log below (what slowed, what failed, what to
   do instead, in general terms), add the measured times to `.claude/estimates.md`, and change the role or step
   the lesson is about, so the next round starts better. Remove a lesson once a role or a tool makes it automatic.

## The helpers

| role | does | returns |
| --- | --- | --- |
| `model-locate` | turns a view tag or a marked screenshot into world-space targets | floor, faces, polygon or points, with a confidence and the alternatives |
| `model-edit` | writes one additive tool with the shared kit and runs its checks | the tool's path, what it changes, the checks' results |
| `model-land` | runs the tool on the live model, syncs the room line, checks, publishes | the version published, or why it refused |

## Lessons

- **10 Nov 2026** — Nine helpers at once emptied a 5-hour usage window in about 100 minutes; eight jobs were run
  again (about 2 million helper tokens lost). Cap at 3 (4 for a short round).
- **10 Nov 2026** — Each helper spent 250-450 thousand tokens finding its place in the model, however small the
  edit. Batch by room, and give helpers the locate result and the kit so they start editing at once.
- **10 Nov 2026** — Jobs located from a screenshot spent about a third of their time matching the camera; they were
  the only jobs that ran over their quote every time. A view tag from the page removes that step.
- **10 Nov 2026** — Every in-place tool edit forced a full rebuild (2-4 min) and blocked landing while another tool
  was mid-edit. Prefer additive tools; save a copy of a tool before editing it.
- **11 Nov 2026** — A whole-model change (every wall moved onto the plan's lines) fell short of its own check and was
  not put live. Give a change that touches every element its own check, and land it only when the check passes.
- **11 Nov 2026** — The soft look is in js/viewer.js of both model pages (sky light, a warm sun with soft-edged
  shadows, edges at 55%; `#flat` brings back the flat look). It changes drawing only: a tool or landing that
  republishes js/viewer.js reads the live one first, or the look is lost.
- **11 Nov 2026** — Shadows, as they stand: soft PCF on a 2048 map with a 6 x 6 texel tent filter patched into three's
  shader text, the map 32 m across with most of it ahead of the eye, snapped to its texel grid (no shimmer), faded out
  at its edge, a normal bias of three texels, each face casting from its far side, and faces under 1 cm wide (cables)
  casting none. What failed on the way: a wide plain PCF filter showed square texels; VSM smudged (pale blotches,
  scratchy streaks; three r147 also draws every receiver, glass included, into a VSM map); a map 20 m round the walk
  target left far rooms sunlit behind a straight line; thin cables' shadows broke into dots. Screen-space ambient
  occlusion (SAOPass, SSAOPass) blotched flat roofs and let interiors ghost through translucent roofs. Real corner
  shading needs a bake.
- **11 Nov 2026** — Check any change to drawing at the artist's own view tags (the comments carry them), in walk as
  well as 3D, near and far, at phone size, before and after side by side, and have someone else look: one look at one
  view passed the first two shadow versions, and the artist found what it missed.
- **12 Nov 2026** — A pass that "fixes white patches" repainted whole white walls, soffits and risers the artist had
  lived with; clay pictures hid it. Limit such passes by size (patches and strips only) and check every camera in colour
  as well as in clay before publishing.
- **12 Nov 2026** — A helper that edits page code or a shared build file in place makes everyone else's tests on those
  files unreliable while it works. Test against routed, fixed copies; save a copy of each file before editing it.
- **12 Nov 2026** — Walk tests timed by the wall clock measured the renderer's speed, not the walker (the walker's step
  is capped per frame). Drive page tests in fixed simulated steps.
- **12 Nov 2026** — A tool that adds a second copy of something a later tool expects once (a second ground face) made the
  later tool refuse. Make tools find what they need by name and shape and accept extra copies; when two tools both run
  after the same step, try both orders and keep the one that composes.
- **12 Nov 2026** — Independent checks of a whole composed version took 60-100 minutes, not 35-55: rendering 50+
  cameras twice on a loaded machine. Quote them at 60-100 minutes.
- **12 Nov 2026** — After a container restart, background results are on disk but are not delivered; read their output
  files before going on.
- **12 Nov 2026** — Helpers of one run finish at different times; waiting for the last one before landing held finished
  fixes back half an hour or more. Read a finished helper's return from the run's journal and land its part at once,
  when its tools are not being edited by a helper still running.
- **12 Nov 2026** — Two rounds of fixing a checker's long list (150 small wall and fit-out records) closed few of them for
  3-4 helper-hours each; the artist points at the ones that matter faster. Fix what the artist points at and what a
  new request breaks; run the full list and the independent pass every other day, not after every round.
- **12 Nov 2026** — A drawer step that only copies files and rewrites an index is a script (a minute), not a helper.
- **12 Nov 2026** — A sheet on a page anyone can open prints nothing that places the artist: a helper's change sheet quoted
  each request with its time and time zone. Before a first publish, search the sheets for the zone, the address words
  and names, not only the words the sheet's own check knows. And read the brief's code citations twice: the lead's brief
  put the model code's riser limit under the state code's name, and the helpers printed it on three sheets.
- **13 Nov 2026** — Four requests about one kitchen arrived within minutes; a helper already started on the first was stopped after 3
  minutes and one brief went to two helpers (one per area, a third pass composing them). Batch every same-room request that arrives before
  a helper has built anything, even if one has started.
- **13 Nov 2026** — Page code passed its builder's own tests twice and still failed two independent retests (crowding on a phone, stale
  drafts). Publish page code only after an independent retest of the final files, phone size first.
- **13 Nov 2026** — After a context reset the publish tool refused files it had not seen this session; a files listing of the artifact
  first is enough. List before the first publish of a session.

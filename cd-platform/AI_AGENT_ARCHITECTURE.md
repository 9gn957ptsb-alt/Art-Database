# AI agent architecture

No single prompt does everything. One orchestrator, specialist helpers with written briefs, and deterministic tools that do all the
computing. The language model interprets, plans and checks; it never invents a coordinate, a member size or a code requirement.

## The orchestrator (the lead session)

- Reads the ask (a thread or a red-line batch with its sheet geometry and picture).
- Retrieves structured project data instead of the whole history: the element index, the change log, the brief, the checks.
- Decides which specialists and tools are needed, in what order, and what can run in parallel.
- Writes each helper a brief: the goal, the inputs, the files it may write, the checks it must pass, the time it should take.
- Composes and lands the results with the tool chain; refusals stop the landing.
- Validates by tools (read-back checks, validation, clashes), then answers and resolves the thread or marks.
- Asks the designer only when a decision changes the design, cost or professional responsibility; otherwise decides and says so.

## Specialists (helper briefs) and their tools

| Brief's agent | Helper | Its deterministic tools and outputs |
|---|---|---|
| Architectural design | model-edit helper (locate, edit, land) | one edit tool per change; the composer; the room-twin sync; solid validation |
| Site and zoning | site helper | site record with sources and dates; placement fit; setback checks without map coordinates in public files |
| Building code | code helper | the rules table; checks.py (PASS / FAIL / WARNING / NOT APPLICABLE / UNVERIFIED) |
| Structural | structure helper | structure groups, bearing lines, member tables marked "to be confirmed by the engineer of record" |
| Mechanical | (Phase 5) | zones and equipment spaces from the element index |
| Electrical | (Phase 5) | lighting and power plans from fixtures and rooms |
| Plumbing | plumbing helpers (design, drain-waste-vent, supply) | runs as polylines with system, size, slope and enclosure; a run check for clashes |
| Interior | fit-out helpers | furniture and fixture groups; interior elevations; finish schedule |
| Construction documentation | drawing helpers | engine modules per sheet family; the redraw command; read-back checks |
| Cost | (Phase 7) | quantities from the element index; prices only from dated, cited sources |
| Independent check | check helper | re-measures a helper's result from the files with fresh eyes; returns must-fix items |

## Structured outputs

Every helper returns data, not prose alone: the files it wrote, the counts it measured, the checks it ran with their results, and
the time it took. Tools write JSON or check files with one line per item (PASS / FAIL / NOTE / NOT RUN and what was measured).

## Model routing

The platform is provider-independent in its data: briefs, tools and files do not depend on the model that runs a helper. Image
inputs (photos, red-line pictures) are read by the session's vision; geometry from them is always re-measured on the model.

## Guardrails

- A helper never edits the model file directly; it writes a tool that the composer runs.
- A structural size, a code requirement or a cost appears only with its calculation or source; otherwise it is marked as an
  assumption, UNVERIFIED, or "to be confirmed by the engineer of record".
- Corrections become standards only when the designer says so.

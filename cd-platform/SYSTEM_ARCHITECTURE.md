# System architecture

## Decision: artifacts, not a hosted stack

The brief recommends Next.js, FastAPI, PostgreSQL/PostGIS, Redis and a job queue. Nothing in this environment can host them, and
the work does not need them to be correct. Each part is mapped onto what exists:

| Brief component | Here |
|---|---|
| Web app (Next.js, React, Three.js) | one claude.ai artifact page per project: plain browser JavaScript, no build step, three.js for 3D, canvas and SVG for 2D |
| API server (FastAPI) | none at runtime; Claude's working session runs Python tools and publishes their outputs as data files |
| PostgreSQL | the artifact db (collections and documents, live listeners, leases) for state people create; data files for derived data |
| PostGIS, vector index | not available; geometry stays in the model and is indexed into a JSON element index |
| Object storage | artifact assets (uploads, sheet pictures, weekly PDFs) and the page's own files |
| Job queue, workers | the working session's background jobs and helper agents |
| WebSockets | the db's live listeners |
| Auth, roles | the platform's accounts; the page reads the viewer's role (editor or owner vs viewer) |
| Orchestrator and agents | Claude's session (orchestrator) and helper briefs (specialists), section AI_AGENT_ARCHITECTURE.md |

## Components

```
 designer (phone first)                                         Claude session (orchestrator)
  | Ask bar: words, photos, the camera                            | reads threads and red-line batches
  | red lines on a sheet, voice                                   | writes helper briefs; runs tools; lands; redraws; answers
  v                                                               v
 +---------------- project page (artifact) ----------------+     +------------- private working area -------------+
 | 3D viewer   plan view   walk mode   Ask bar             |     | edit tools: one deterministic tool per change   |
 | drawer: sheets, red lines, record, permits  (v2: CD)    |<----| compose: run the tools in a fixed order on the  |
 | files: model.json, sheets/*.svg|pdf, sheets/index.json  | publish|   base model; keep the room twins in step;   |
 |   v2: set, elements, checks, validation, clashes,       |     |   validate solids; print changed element groups |
 |       changes, brief, schedules/*.csv, revisions        |     | draw: the engine re-draws every sheet from the  |
 | db: red lines, weekly records, permits, voice queue;    |     |   model and reads each one back (check files)  |
 |   v2: reviews, clash status                             |     | index: derive the CD data files (Phase 1)       |
 +---------------------------------------------------------+     +-------------------------------------------------+
```

## One change, end to end

1. Ask: a thread from the Ask bar, or a submitted red-line batch (marks with sheet geometry, text, discipline, a picture).
2. Scope: Claude reads the ask, locates the elements, and writes or edits one tool (or several small ones).
3. Compose: the tools run in the canonical order on the base model; companion steps keep derived parts in step and refuse
   inconsistent results; the composer prints which groups changed, were added or removed, and the new model hash.
4. Draw: every sheet is re-drawn on the new model; each sheet's read-back check must have no FAIL.
5. Index (Phase 1): the CD data files are derived; a revision is cut only for sheets whose drawing changed; the change record is
   written.
6. Publish: the model and the data files; page code only when it changed.
7. Answer: the thread or the red-line marks are resolved with a link to the change record.

## Principles

- Deterministic tools compute geometry; the language model interprets and orchestrates. Same inputs, same bytes.
- Derived data is never edited by hand; it is regenerated.
- Every file names the model hash it was made from; the page shows stale data as stale.
- A page shows a control only when the data or capability behind it exists.
- Two pages share the drawer code byte for byte; page differences come from data.

# Database schema

Two kinds of storage, kept apart:
- **Derived data files** served with each page, regenerated from the model at every landing (never edited by hand).
- **The artifact db**: state that people (or Claude on their behalf) create: red lines, weekly records, permit snapshots, reviews,
  clash status, the voice-control queue.

## The brief's entities, mapped

| Brief entity | Here | Kind |
|---|---|---|
| Users | the platform's accounts; the page reads id and role (editor/owner/viewer); no names stored | platform |
| Firms | a standards profile file (Phase 8) | file |
| Projects | one page per project; `set.json` (phase, jurisdiction words, model hash) | file |
| ProjectRequirements | `brief.json` items | file |
| BuildingModels | the model file + kept versions by hash | file |
| BuildingElements, Levels, Rooms | `elements.json` | file |
| Documents | assets (uploads), an intake record later | assets |
| DrawingSheets | `sheets/index.json` v2 | file |
| CodeRules | the rules table (generic, in this repo when model-independent) | file |
| ValidationResults | `checks.json` (code), `validation.json` (model) | file |
| AIConversations | comment threads of the platform | platform |
| ModelCommands | `changes.json` | file |
| FirmKnowledge | later (Phase 8) | file |
| Revisions | `revisions` inside each index entry + archived sheet files | file |
| (markups) | db `redlines` | db |
| (reviews) | db `reviews` | db |
| (issue) | db `permits` (submission snapshots) | db |
| (clash state) | db `clash-status` | db |

Every derived file starts with `{"schema": "<name>/<n>", "page": "<page>", "model_sha": "<12 hex>"}`.

## Derived files (under the page's data/sheets/)

### index.json (v2): an array, one entry per sheet
v1 fields kept: `number, title, svg, pdf, dxf, status`. Added: `v` (2), `discipline` (G C L A S M E P), `kind` (sheet | study),
`set_index`, `set_total`, `model_sha`, `validation {state: auto-validated|preliminary, pass, fail, not_run, notes,
checked_model_sha, why}`, `revision {rev, date}`, `revisions [{rev, date, model_sha, changes[], clouds[{x,y,w,h}], svg, png, note}]`
(newest first, clouds in sheet units), `checks {PASS, FAIL, WARNING, NOT APPLICABLE, UNVERIFIED}`, `clashes {hard, soft}`,
`elements [ids]`, `exports {svg, pdf, dxf, csv[]}`.

### set.json
`{schema "cd-set/2", page, model_sha, made_at, phase, jurisdiction, notice, counts {...}, tools {...}, files {...}, exports {...}}`.

### elements.json
`{schema "cd-elements/1", page, model_sha, units "m", levels [{id, name, floors[]}], elements [{id, type, mark?, level, rooms[],
geometry {...summary...}, props {...}, groups [model group ids], relations {host?, sheets[]}, source {tool, first_seen,
changed_in[]}}]}`. Types: level, room, wall, door, window, stair, column, fixture, glass, guard, roof, pipe.

### checks.json
`{schema "cd-checks/1", page, model_sha, jurisdiction, notice, rules_version, summary {...}, checks [{id, title, discipline,
category, rule {id, code, edition, section, subject, jurisdiction, adoption confirmed|unconfirmed, amended_in_state, sources[]},
condition, applies, elements[], sheets[], design_value {value, unit, text}, required_value {op, value, unit, text},
status PASS|FAIL|WARNING|NOT APPLICABLE|UNVERIFIED, known, unclear, missing, resolve_by, measured_by {tool, model_sha}}]}`.

### validation.json
`{schema "cd-validation/1", page, model_sha, summary {VALID, WARNING, INVALID}, items [{id, kind, elements[], sheets[],
status, measured, expected, tool, note}]}`.

### clashes.json
`{schema "cd-clashes/1", page, model_sha, summary {hard, soft}, clashes [{id, kind hard|soft, severity high|medium|low,
location {level, room, at[x,y,z]}, elements[], disciplines[], description, suggested_resolution, responsible, sheets[],
found_by {tool, model_sha}}]}`. Ids are hashes of kind + elements + check, stable across unrelated changes.

### changes.json
`{schema "cd-changes/1", page, changes [{id, page_version, landed_at, model_before, model_after, instruction, source {kind, ref},
tools[], chain_tail, affected {groups_changed[], groups_added[], groups_removed[], elements[], materials_added}, sheets_revised[],
validation {...}, author, requested_by, status landed|reverted|superseded, undo}]}`. Fields the log does not hold are null.

### brief.json
`{schema "cd-brief/1", page, model_sha, categories[...], items [{id, category confirmed|preference|assumption|recommendation|
unresolved|regulatory, topic, text, value, source {kind, ref}, resolve_by, since, status open|settled, sheets[]}]}`.

### schedules/*.csv
UTF-8, header row, rows in the schedule's order, ft-in text and metre columns: doors, windows, rooms (with areas and finishes),
fixtures. The same rows the drawn schedule holds.

## db collections

| Collection | Document | Written by |
|---|---|---|
| redlines/<batch> | `{page, batch, round, submitted_at, week, by, mark_count, sheets [{number, revision, model_sha, picture, marks [{item, label, shape, geometry, text, discipline, status, answer, resolution {change, at}}]}], status, answer, sent}` | the page at Submit; Claude answers |
| redline-weeks/<YYYY-Www> | `{page, week, pdf {id, url, bytes, pages}, built_at, batches, sheets, marks, permits}` | the page (once, under a lease) |
| permits/<id> | `{page, id, name, date, week, notes, recorded_at, by, sheets [{number, title, revision, revision_date, model_sha, status}], model_sha}` | editors |
| reviews/<id> (v2) | `{page, id, sheet, revision, model_sha, discipline, role, outcome, notes, date, recorded_at, by}` | editors |
| clash-status/<id> (v2) | `{page, id, status open|resolved|accepted, note, by, at}` | editors or Claude |
| control/view | `{q [{n, cmd, args, at}], by}` | Claude (voice) |

`by` is the platform's opaque user id. No names, addresses or licence numbers are stored anywhere.

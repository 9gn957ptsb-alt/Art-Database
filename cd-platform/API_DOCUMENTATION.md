# Interfaces

The platform has no network API of its own. Its interfaces are command-line tools (run in Claude's working session), the files
they write, the page's JavaScript globals, and the artifact runtime capabilities the page uses.

## Command-line tools (Python, run as `env PYTHONDONTWRITEBYTECODE=1 python3 -I -B ...`)

| Tool | Arguments | Does | Exit |
|---|---|---|---|
| edit tool `apply_mirror.py` (one per change) | `IN OUT` | reads a model, writes the changed model; prints what it changed | 0 ok; non-zero refused |
| composer `land.sh` | `VER "note" TOOLDIR...` (`BASE=` for a full recomposition), `--copy VER` | runs the tools in order, then the room-twin sync, the source note, solid validation; prints changed/added/removed group ids and the hash | non-zero on a tool failure or a sync refusal |
| room-twin sync `sync_line.py` | `IN OUT` | keeps the derived room twins in step | 0 written; 2 refused, nothing written |
| redraw `redraw.py` | `MODEL --run RUN.tsv --out DIR --drawer SITE/data/sheets --sheets SHEETS.json [--jobs N] [--only A-101,...]` | re-draws every sheet on the model, copies SVG and PDF to the page, rewrites the sheet index | 1 if a command failed or a check has a FAIL line |
| engine modules `m1..m8` | `MODEL --sheet NUMBER [--sheet ...] --out DIR` | draw a sheet family and its read-back check | non-zero on error |
| `cdindex.py` (Phase 1) | `MODEL --page house|deck --set SETDIR --drawer SITE/data/sheets --log LOG --change ID` | derives elements, revisions, checks, validation, clashes, changes, brief, schedules, index v2, set.json | 1 on a schema or privacy failure (nothing written) |
| `checks.py`, `validation.py`, `clashes.py`, `brief.py`, `schedules.py` (Phase 1) | `MODEL --elements elements.json --out DIR` (+ `--rules RULES.json` for checks) | one data file each | 1 on a schema failure |

Every tool is deterministic: the same inputs give the same bytes. File schemas are pydantic models exported as JSON Schema.

## The brief's tool calls, mapped

| Brief tool | Here |
|---|---|
| create_project | a new artifact page from the project template |
| analyze_uploaded_file | Ask bar attachment -> the session reads it; intake record (Phase 3) |
| create_wall / modify_wall / create_door / create_window / create_room | an edit tool written for the change (deterministic, replayable) |
| calculate_room_area | the room recogniser in the engine; elements.json |
| generate_floor_plan / elevation / section / roof_plan | engine modules via the run list; `redraw.py` |
| generate_structural_plan / hvac / electrical / plumbing | engine modules per discipline (Phases 4-5) |
| run_code_check | `checks.py` |
| run_clash_detection | `clashes.py` |
| generate_drawing_package | `redraw.py` + `cdindex.py` (+ set PDF) |
| export_pdf / export_dxf / export_ifc | the engine's writers; the DXF conversion; the IFC exporter (Phase 6) |
| compare_revisions | the revision diff in `cdindex.py`; the drawer's compare view |
| retrieve_firm_standard | the standards profile (Phase 8) |
| generate_cost_estimate | quantities from elements.json (Phase 7) |

## Page interfaces (globals; plain scripts)

- `SHEETS.control(cmd, args)`: voice commands `sheets_open`, `sheets_close`, `sheet {number}`; v2 adds `sheet_info {number}`,
  `sheets_panel {name}`. Returns the toast text or null.
- `VIEW` (3D viewer), `PLAN2D` (plan canvas), `WALK` (walk mode), `APP` (page shell): documented in their files' headers.
- The page reads `data/sheets/index.json` (array) at load; v2 panels read their files on first open.

## Runtime capabilities used by the page

`user` (id, canEdit, isOwner), `db` (collections, documents, onSnapshot, leases), `comments` (sendToClaude: the Ask bar and the
red-line Submit), `assets` (uploads; sheet pictures; weekly PDFs), `downloads` (saving files). The page works for viewing with none
of them.

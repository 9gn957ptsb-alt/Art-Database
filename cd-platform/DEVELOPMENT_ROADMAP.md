# Development roadmap

The brief's nine phases, adapted to artifacts. A large part of the brief's Phase 1-4 already exists in private form (one model per
project, pages with 3D and walk modes, a drawing engine with read-back checks, a deterministic edit chain, red lines), so the order
below starts from what the drawing set lacks. Estimates come from measured times of similar past work (helpers on engine rounds
took 35-60 min each; page features with independent retests took 3-4 h).

| Phase | Builds | Deliverable | Estimate |
|---|---|---|---|
| 0 | Repository and feasibility audit; drawer v2 specification; these documents | a plan both stages can build from | 60-80 min (done 14 Nov 2026) |
| 1 | Drawer v2. Stage 2 (data): element index, revisions with clouds and printed revision numbers, checks with a rules table, model validation, clashes, change records (with a backfill), project brief, schedule CSVs, index v2, set file. Stage 3 (page): dashboard line, discipline chips, status on thumbnails, sheet info panel, compare view, brief / changes / checks / coordination / exports panels, discipline on red-line marks | the drawing set as construction documents with status, checks, revisions and history on both pages | stage 2: 2-3 h; stage 3: 3.5-5 h |
| 2 | General sheets from data: cover with the sheet index and each sheet's status, general notes, symbols and abbreviations, code analysis printed from the checks; a coordination site plan and setback checks (no map coordinates in public files) | a complete G-series and site sheet | 2.5-4 h |
| 3 | Change management v2: the composer writes the change record itself; undo by recomposition without a tool; an impact preview (elements -> sheets -> checks) before landing; intake records for uploads (type, pages, units, scale by a known dimension, confidence) | conversational changes with consequences shown first | 3-4 h |
| 4 | Structure (preliminary, for the engineer of record): foundation, framing, roof framing and bracing plans; a load-path graph from the structure groups; a detail library tied to assemblies (roof edge, windows and doors, stair and guards, waterproofing) | S-series and details, all "to be confirmed by the engineer of record" | 6-10 h |
| 5 | MEP: plumbing plans, risers and schedules from the landed plumbing runs; clashes across plumbing and structure; electrical lighting and power plans (optional for the permit); a mechanical zoning study | a coordinated preliminary MEP set | 6-9 h |
| 6 | Interoperability: DXF served (R2010 UTF-8) or downloadable; IFC4 export with IfcOpenShell; set PDF with bookmarks; JSON model export; each opened by an independent reader | tested exchange files | 3-5 h |
| 7 | Quantities from the element index (areas, counts, lengths, volumes); a preliminary estimate only from dated, cited cost sources, with assumptions and exclusions | quantity schedules; an estimate when sources exist | 3-5 h |
| 8 | Standards profile (graphic standards, sheet organisation, notes, typical assemblies as data the engines read); a corrections ledger where a correction becomes a standard only on the designer's word | firm standards applied consistently | 2-4 h |

## Not planned (not feasible in artifacts, or not needed)

- A hosted multi-tenant service with its own accounts, billing and private deployments.
- A licence-verification network with professional profiles.
- A browser CAD editor that edits the model directly.
- Point-cloud reconstruction; native DWG or Revit support.

## Dependencies

Phase 1 stage 2 before stage 3 (the page reads the files). The element index (Phase 1) before the impact preview (3), structure
(4), MEP (5), IFC (6) and quantities (7). The rules table (1) before the code analysis sheet (2).

# Testing strategy

A feature is done when it is measured, not when it looks right.

## 1. Read-back checks (every sheet, every landing)

Each engine module reads its own output back and measures it against the model. One line per item: PASS, FAIL, NOTE (a measured
value past a printed limit: a design matter, not a drawing fault) or NOT RUN, with what was measured. Items include: dimension texts
equal their lines (1/16 in.); dimension ends on wall centrelines; tags equal the element lists; schedule rows equal the elements;
section marks' ends equal the section planes (1 mm); every call-out names a sheet of the set; drawn extents equal the model's
(1 mm); stamps present; no compliance word; no address or personal name; model hash and sheet i of N printed. A FAIL stops the
landing.

## 2. Model checks (every landing)

The room-twin sync refuses inconsistent results; solid validation runs on the composed model; a model built from a spec is measured
back against every written dimension (1/16 in.); walk tests (stairs, doors, floors) run on the page.

## 3. Data files (Phase 1, stage 2)

- Determinism: two runs on the same inputs give byte-identical files.
- Schemas: every file validates (pydantic models, exported JSON Schema).
- Compatibility: the v1 drawer reads index.json v2 unchanged.
- Cross-checks: element counts equal the engines' lists and schedule rows; CSV rows equal the DXF schedule rows; every id named by a
  check, clash or revision exists; recomputing a check's design value gives the stored value.
- Revisions: no revision on an unchanged model; a test change revises exactly the sheets that draw the changed element, with clouds
  over it, and the title block prints the new revision.
- Words and privacy: no compliance claim; the fixed notice; no address, ZIP, lot, subdivision or personal name; the jurisdiction
  phrase exact.
- Size caps.

## 4. Page tests (Phase 1, stage 3)

Headless browser runs at 390 x 844 and 1440 x 900, light and dark, on both pages: every existing drawer and red-line scenario still
passes (gestures, paging, zoom, draw, reshape, Submit, record, weekly PDF, permit form); the dashboard numbers equal the files and
the db; discipline filters; the four statuses on fixture data (including a review at an older revision falling back); info panel
sections; compare alignment to 1 px; exports open or save the right files; no control without its data or capability; viewer and
no-capability runs without console errors; status readable in greyscale. Two independent retests by helpers who did not build it.

## 5. Export validation

DXF: ezdxf audit with no errors, the module's own read-back on the converted file, scale and units by a measured dimension. PDF:
page sizes, bookmarks, text extracted equals the sheet's text. IFC: schema validation, a re-import that counts elements by type
against the element index. "Opened in an independent application" is recorded only when a person has done it; until then the export
is listed as untested there.

## 6. The brief's acceptance tests, mapped

| Brief test | How it is run here |
|---|---|
| 1 Plan reconstruction | a traced plan rebuilt as a model and measured back against every written dimension |
| 2 Conversational modification | an ask -> tool -> landing -> redraw; the change record lists the elements and sheets; unaffected elements' groups unchanged (composer printout) |
| 3 Ceiling-height change | the same, plus the impact preview's stair, roof, structure and duct warnings (Phase 3) |
| 4 Site restrictions | setback and height checks with sources and UNVERIFIED where data is missing (Phase 2) |
| 5 Drawing coordination | the read-back checks (tags = schedules, marks = planes, call-outs, dimensions = geometry) |
| 6 MEP coordination | the plumbing run check and clashes.json (Phase 5 for the full set) |
| 7 Firm knowledge | standards profile retrieval (Phase 8) |
| 8 Export validation | section 5 |

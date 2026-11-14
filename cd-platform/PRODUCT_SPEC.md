# Product specification

## Who it is for

A small custom residential practice: one designer working with Claude, consultants (engineer of record, trades) brought in for
review. Projects: custom single-family houses, additions, renovations, outdoor structures. The structure of the data allows larger
projects later without a rebuild, because everything is keyed by element, sheet, discipline and change.

## What it does

1. **One model per project.** A JSON building model, metres, z up. All drawings, schedules, checks and quantities derive from it.
2. **Change by asking.** The designer types (or dictates, or attaches photos) in the page's Ask bar, or draws red-line clouds on a
   sheet and submits them. Claude scopes the ask, runs or writes one deterministic edit tool, composes the tool chain, validates,
   redraws the set and answers in the thread. Every change becomes a change record.
3. **A drawing set that follows the model.** Plans, reflected ceiling plans, roof plan, elevations (including developed elevations
   of curved walls), building and wall sections, enlarged plans and interior elevations, wall types and assemblies, door, window,
   room-finish and fixture schedules; structural sheets marked for the engineer of record. Each sheet is written as SVG, PDF and DXF
   and checked against the model after it is drawn.
4. **Checks with sources.** Measured design values (stair risers and goings, headroom, guards, handrails, escape openings, ceiling
   heights, alarms) compared with cited provisions of the jurisdiction's adopted code: PASS, FAIL, WARNING, NOT APPLICABLE or
   UNVERIFIED, each with code, edition, section, the design value and the required value.
5. **Coordination.** Model validation (VALID, WARNING, INVALID) and clash lists (hard and soft) with the responsible discipline and a
   status a person can set.
6. **Red lines.** Clouds and callouts on a sheet, numbered by round, assigned to a discipline, submitted to Claude, answered and
   resolved by a change record; a weekly PDF record; permit submissions recorded with a snapshot of every sheet's revision.
7. **Professional status in plain sight.** Each sheet shows one of: AI-generated preliminary, automatically validated, professionally
   reviewed (recorded by an editor, by role), issued. Never a seal; never "code compliant" for a sheet or the set.

## Phase 1: the drawer v2

The drawer (the sheet list under the Ask bar) gains:
- a dashboard line: sheets by status, check counts, open comments, the latest revision;
- discipline chips (G, C, L, A, S, M, E, P) that filter the sheets;
- a status word and shape on every thumbnail;
- a sheet info panel: status and why, checks, revisions with a compare view (overlay and slider), comments, coordination items,
  exports, the model and change that last revised it;
- panels for the project brief (confirmed, preference, assumption, recommendation, unresolved, regulatory), the change log, the
  set's checks, coordination, and exports (set PDF when built, sheet PDFs and SVGs, schedule CSVs, the element index as JSON, DXF
  when the page can serve it);
- a discipline on every red-line mark, and "resolved by change N" when Claude resolves it.

Unchanged: the drawer's gestures, the sheet viewer, red-line drawing and reshaping, Submit to Claude, the weekly record, permit
submissions, voice commands.

## Non-goals (for now, and why)

- A hosted multi-user SaaS with its own accounts and billing: the artifacts provide private pages shared by link, roles and a db.
- A CAD editor in the browser: edits go through deterministic tools so they stay replayable and checked.
- A licence-verification network: it needs board records and personal data; reviews are recorded by role, unverified, and say so.
- Point-cloud reconstruction and automatic plan recognition from scans: later, through an intake step, if a project needs it.
- Cost estimates without dated, cited cost sources: quantities first; prices only with their source and date.

# Changelog

Development log of the CD platform. Newest first. Private project details (models, sheets, locations) are not recorded here.

## 14 Nov 2026: Phase 0, audit and plan

- Repository and feasibility audit of the private system against the master brief's sections 1-22: what exists (two project pages
  with 3D, walk and a sheet drawer with red-line mode; a drawing engine with read-back checks; a deterministic edit-tool chain), what
  is partial, missing, or not feasible in artifacts.
- Decision: no hosted stack; the artifact runtime is the backend (see SYSTEM_ARCHITECTURE.md).
- Decision: keep the model as geometry and derive an element index at every landing with the drawing engine's own recognisers.
- Decision: code checks use a rules table of section numbers, numeric limits and sources (no code text) and five result words; the
  jurisdiction is written generically.
- Specification of the drawer v2 (Phase 1): data files first (compatible with the current drawer), page code second.
- Added these documents.

## Before this folder (summary)

- 6-14 Nov 2026: project pages, the edit-tool chain and landing log, the drawing engine and its read-back checks, red-line mode with
  submissions, weekly records and permit snapshots, a backyard deck project with its own model builder and drawing set.

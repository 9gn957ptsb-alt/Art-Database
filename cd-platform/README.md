# CD platform

An AI architectural production assistant for custom residential work, built on claude.ai artifacts instead of a hosted web
service. It takes a project from a model to a coordinated, checked, revisable set of construction documents, and keeps every
change, check and comment as structured data.

This folder holds the platform's design and the generic parts of its implementation. The projects themselves (their models,
geometry, drawings, site data and exports) are private and never enter this repository.

## The idea in one paragraph

Each project has ONE building model (a JSON file of named groups and faces, metres, z up). Every drawing sheet is drawn from that
model by a deterministic engine and read back against it. Every change to the model is a small deterministic tool, composed in a
fixed order and logged, so the model can be rebuilt, compared and undone. A page (a claude.ai artifact) shows the model in 3D, lets
the designer walk through it, ask for changes in plain words or with red lines on a sheet, and holds the drawing set in a drawer.
Claude, in a working session, is the orchestrator: it turns asks into tool runs, lands them, redraws the set and answers.

## The documents

| File | What it covers |
|---|---|
| [PRODUCT_SPEC.md](PRODUCT_SPEC.md) | what the product does, for whom, and the drawer v2 (Phase 1) |
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | how the pages, the engines, the tool chain and the db fit together |
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | the brief's entities mapped to data files and db collections; every file's shape |
| [AI_AGENT_ARCHITECTURE.md](AI_AGENT_ARCHITECTURE.md) | the orchestrator, specialist helpers and deterministic tools |
| [GEOMETRY_ENGINE.md](GEOMETRY_ENGINE.md) | the model format, the element index, the drawing engine and its read-back checks |
| [BIM_INTEROPERABILITY.md](BIM_INTEROPERABILITY.md) | PDF, SVG, DXF, CSV, JSON and IFC: what works, what is planned, how each is tested |
| [CODE_COMPLIANCE_ENGINE.md](CODE_COMPLIANCE_ENGINE.md) | the deterministic rule engine, the rules table and the five result words |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | the command-line tools and the page interfaces |
| [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | the phases, adapted to artifacts, with estimates |
| [TESTING_STRATEGY.md](TESTING_STRATEGY.md) | read-back checks, determinism, page tests, export tests |
| [SECURITY.md](SECURITY.md) | privacy, permissions, professional status, what is never published |
| [CHANGELOG.md](CHANGELOG.md) | the development log |

## Status (14 Nov 2026)

- Working (private): two project pages (a house and a backyard deck), each with a 3D viewer, walk mode, an Ask bar, and a sheet
  drawer with red-line mode, a weekly red-line record and permit-submission snapshots; a drawing engine that draws the house's
  architectural sheets and the deck's set from their models with read-back checks; a deterministic edit-tool chain.
- Phase 0 done: the repository and feasibility audit, the drawer v2 specification, these documents.
- Next: Phase 1, the drawer v2 (data engines, then page code). See DEVELOPMENT_ROADMAP.md.

## Known limitations

- No hosted backend: the artifact runtime (a per-page db, file assets, comments to Claude, user roles, downloads) is the backend.
- The model is geometry with names; building elements are recognised by the engines, not stored (the element index fixes this).
- DXF is written but not yet served by the pages; IFC is not produced yet.
- Code checks report measured values against cited provisions; they are preliminary and never a compliance statement.
- Structural, mechanical, electrical and plumbing work is preliminary and "to be confirmed by the engineer of record".

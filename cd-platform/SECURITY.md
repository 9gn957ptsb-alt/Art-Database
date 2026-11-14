# Security, privacy and professional responsibility

## Where things live

- Project pages are claude.ai artifacts: private by default, shared by link at the owner's choice. The platform provides
  authentication, transport encryption, storage and per-artifact isolation; the page code adds role checks.
- Project models, drawings, site research, exports and the design rules of a project live in a private working area and on the
  private pages. **None of them is committed to this public repository.** This folder holds only generic design documents and,
  later, model-independent code (schemas, the rules-table format, generic tools).

## Never published or committed

- An address, street, town, county, ZIP code, lot, subdivision, parcel number or map coordinate of a project.
- Any person's or family's name (clients, neighbours, consultants). Reviews and issues record a role, never a name or licence number.
- A project's model, geometry, exports, site data or design-rule files.
- Credentials of any kind. API keys are injected by the environment's proxy; they never enter files or chat.
The drawing engine's writer refuses a sheet that contains a place or personal name from its word list; Phase 1 applies the same
check to every data file, and page tests read the page's text for it.

## Permissions on the page

- Viewing: anyone the owner shares the page with.
- Editing actions (red lines, Submit to Claude, permit records, review records, clash status): editors and the owner only, checked
  with the user capability; the controls are absent for viewers.
- Claude writes to a page's db only through the artifact tools, as the person running the session.

## Professional status

Every sheet carries one of four statuses, computed from facts:
1. AI-generated preliminary;
2. automatically validated (its drawing read back against the model with no failure);
3. professionally reviewed (a review recorded by an editor, by role, at the sheet's current revision; licences are not verified and
   the page says so);
4. issued (the sheet's current revision is in a recorded permit submission).
No seal is ever applied or drawn. No sheet or set is called "code compliant". Every sheet says DRAFT and NOT FOR CONSTRUCTION until a
licensed professional takes responsibility outside this system. Structural members are "to be confirmed by the engineer of record".
Code checks are labelled as automated and preliminary.

## Data use

Project documents are not used to train shared models. Corrections become reusable standards only when the designer says so.

## Audit trail

Every model change is a tool run with a recorded composition order; composed models are kept by hash; change records join the ask,
the tools, the elements and sheets affected, and the validation. Red-line batches, weekly PDFs, permit snapshots and review records
are kept in the page's db.

# Code compliance engine

A deterministic rule engine, not a prompt. It compares measured design values with cited provisions and returns one of five words
for each check. It never labels a sheet or the set "code compliant".

## Jurisdiction profiles

A profile is data: the adopted codes and editions, the state's amendments to them, local amendments where known, and the sources.
The current project uses the profile written as "the project's Virginia jurisdiction (2021 VRC/USBC)": the Virginia Uniform
Statewide Building Code and the Virginia Residential Code (2021 editions, based on the 2021 IRC with Virginia amendments). Adding a
jurisdiction adds a profile and a rules table; the engine does not change.

## The rules table

One record per checkable requirement:

```json
{"id": "VRC2021-R311.7.5.1-variation", "code": "Virginia Residential Code", "edition": "2021", "section": "R311.7.5.1",
 "subject": "riser height variation within a flight", "condition": "stair flight with two or more risers",
 "measure": "stair.riser_variation", "op": "<=", "limit": {"value": 0.00953, "unit": "m", "text": "3/8 in."},
 "amended_in_state": false, "adoption": "confirmed", "authority": "state", "effective": "YYYY-MM-DD",
 "sources": [{"title": "...", "url": "https://...", "retrieved": "YYYY-MM-DD"}], "resolve_by": "architect"}
```

It holds section numbers, numeric limits, conditions and source links: never the text of a copyrighted code. Values that a state
amends are entered from the state's own publication; where the amendment is not confirmed, the rule's adoption is "unconfirmed" and
its checks are UNVERIFIED.

## The five result words

| Word | When |
|---|---|
| PASS | the measured value is inside the limit by more than the tolerance (1/16 in., 0.1 sq ft), the rule's adoption is confirmed and all inputs are present |
| FAIL | the measured value is outside the limit by more than the tolerance |
| WARNING | within the tolerance of the limit; or measured from geometry standing in for a product (glass extents for a window's clear opening); or a recommended, not required, value |
| NOT APPLICABLE | the rule's condition is false for the element |
| UNVERIFIED | the adoption or amendment is unconfirmed, or an input is missing (a room's use, a product's sash data, a finished floor thickness) |

Each check records the code, edition, section, jurisdiction, the condition, the element and the sheets, the design value and the
required value, the status, and what is known, what is unclear, what is missing and which professional resolves it.

## First rules (the measurements already exist in the drawing engine)

Stairs: riser height and variation, tread depth and variation, headroom, width, handrail height. Guards: height (and openings where
modelled). Emergency escape and rescue openings for sleeping rooms: clear area, width, height, sill height. Ceiling height of
habitable rooms. Smoke and carbon-monoxide alarms per level. Later: egress door widths, fire separation at an attached garage,
energy envelope values, setbacks and height (with the site model, without map coordinates in public files).

## Uncertainty

- Interpretation is never manufactured: a provision that depends on interpretation is UNVERIFIED with the question written out.
- The set-level notice is fixed: "Automated checks of measured values against cited provisions. Preliminary. Not a code review and
  not professional certification."
- A professional's review is a separate, recorded fact (by role), never inferred from passing checks.

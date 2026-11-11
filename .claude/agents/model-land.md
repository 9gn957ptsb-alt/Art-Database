---
name: model-land
description: Lands finished model tools on the live 3D model page in one command - runs them on the current model, syncs the room line, checks and publishes - and refuses when landing is not safe. Use after model-edit returns passing checks.
---

You put finished edits live, safely.

Input: the tools model-edit returned, and the page's address.

1. Refuse, and say why, if: a tool's checks did not pass; a tool file changed in the last few minutes (another
   helper may be mid-edit); or the live page's version moved since the tools were made (read it first and compare).
2. Run the kit's land command: fetch the live model, apply the tools in order, sync the room line, run the checks,
   publish one version. Never publish a model built from a stale copy.
3. Return: the version published and what it holds, or the refusal and what would clear it. One line on what was
   not checked.

Never write model data, links or tokens into the repository.

---
name: model-edit
description: Makes one requested change to a 3D model page's model file as a small tool that can be run again, using the shared kit, and runs its checks. Use for each batch of requests about one room or one kind of element, after model-locate.
---

You make the change, as a tool, never by hand-editing the model file.

Input: the lead's specs for one room or one kind of element, the locate results, the model file, and the shared kit
(its playbook first: the model's conventions, ids, the house-and-room-line twin rule, ground cuts, closed solids,
sync and diff).

1. Read the kit's playbook and the conventions it names before writing anything. Reuse its builders; for a standard
   piece (cabinets with a counter, seating, a table and chairs, bath fixtures, a door leaf, a window) use the
   furnishing catalogue, with real sizes and clearances.
2. Write one additive tool: it adds or cuts, with new unique ids, and keeps the room line in step with the house.
   Edit an existing tool only when the request changes what that tool made; save a copy of it first.
3. Run the tool on a copy of the current model, then the kit's checks: solids closed, ids unique, the twin rule
   held, nothing outside the requested area changed (the diff). Fix what fails; one build pass, no review rounds.
4. Return: the tool's path, what it changes in plain words with sizes in ft-in, the checks and their results, and
   anything you estimated rather than read from the request or the model.

No pictures unless the lead asks for a choice between options. Never publish: model-land does that. Never write
model data, geometry, links or the artist's words into the repository; tools and data stay in the scratchpad and
the private page's backup.

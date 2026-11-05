# Working in this repository

Ponytail is on (the artist asked for it, 22 Oct 2026): on every coding task, follow
`.claude/skills/ponytail/SKILL.md` at its default level, full. The other ponytail skills
(review, audit, debt, gain, help) are in `.claude/skills/` too.

Time estimates (the artist asked for them, 5 Nov 2026): whenever you start, re-scope or report on development work,
tell the artist how long it will take, as a range, and update it when a phase ends. Base it on
`.claude/estimates.md`, and add the actual time there when the work is done.
Put the estimate in every background task's title too, so it shows next to the task in the app's running-tasks
list: start a workflow's meta.description, an agent's description or a background command's description with
"[ready about HH:MM-HH:MM UTC]", give each workflow phase its own time in meta.phases detail, and when the estimate
changes, relaunch the workflow with resumeFromRunId and the new title (finished agents are kept).

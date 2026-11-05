# Working in this repository

Ponytail is on (the artist asked for it, 22 Oct 2026): on every coding task, follow
`.claude/skills/ponytail/SKILL.md` at its default level, full. The other ponytail skills
(review, audit, debt, gain, help) are in `.claude/skills/` too.

Time estimates (the artist asked for them, 5 Nov 2026): whenever you start, re-scope or report on development work,
tell the artist how long it will take, as a range, and update it when a phase ends. Base it on
`.claude/estimates.md`, and add the actual time there when the work is done.
Put the estimate where the artist sees it in the app's Background tasks list (checked on their phone, 5 Nov 2026):
the row with the running timer ("Workflow 20m 21s") is drawn by the app and cannot hold text, so the estimate goes
on the line right above it, the bold meta.name, as a duration counted from the same start as that timer, so the two
read together: "est. 30-50 min · DUH golden intro" (short: the line fades out past about 30 characters). Every
relaunch restarts the timer, so the duration is from that relaunch. The grey line, meta.description, starts with the
clock time it should be ready, "[ready about H:MM-H:MM pm your time]" (ask the artist for their time zone if you do
not know it; do not write it here, the repo is public); each stage row is a phase title, so give each its time ("Finish · about 45-60 min"; phase details
are not shown); each agent row is its label ("check:frames · about 30 min"); a background command shows its
description. Plan these from the start: renaming a phase or label later re-runs the agents already done under it.
To change only meta.name or meta.description, stop the workflow between agents and relaunch it with resumeFromRunId
(finished agents are kept; a running one starts over).

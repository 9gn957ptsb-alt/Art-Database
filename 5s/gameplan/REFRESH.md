# Refreshing the Game Plan reflection

Every other day a routine in the artist's "SOA -- Routines" conversation redoes the section "The first reflection"
of the artist's Game Plan doc from `reflect.mjs`. The routine names the doc; this file is the procedure, and it
changes.

Rules. Transcripts are the artist's private data: they stay in `/tmp/gameplan-refresh` (never in this repository,
which is public), are never quoted, and are deleted at the end. Report only counts, session titles and stage names.
The before and after numbers are an observed time series: never call a difference a saving.

1. Folder and script:

   ```
   T=/tmp/gameplan-refresh; rm -rf $T; mkdir -p $T/pages
   git fetch origin claude/art-database-photos-ilnaf7
   git show origin/claude/art-database-photos-ilnaf7:5s/gameplan/reflect.mjs > $T/reflect.mjs
   ```

2. Sessions: `list_sessions` (claude-code-remote, `mine: true`, `limit: 100`). Its result is saved to a file; copy
   that file to `$T/pages/list_sessions.txt`.
3. Pages: leave out `session_01UUJZZLGqPEMYKT7kGUUXxJ` (23 Oct 2026): its one 403 was a deliberate test of the
   hook, not a trap met. The report still lists it, with nothing read; do not count it among the sessions read.
   Split the other session ids into groups of five and start one helper per group (Agent tool, subagent_type
   "general-purpose", model "sonnet", run_in_background true) with the brief below, the group's ids put in. Wait
   for all of them.

   > For each session id in IDS: run `: > /tmp/gameplan-refresh/pages/<id>.txt`, then read at most 10 pages with
   > `list_events` (claude-code-remote; `kinds: ["user","assistant","result"]`, `limit: 100`, and from the second
   > page `before_id` = the cursor). If the result was saved to a file, do not read it: run
   > `cat "<path>" >> /tmp/gameplan-refresh/pages/<id>.txt`, and take the cursor and whether more remain from
   > `grep -o '"first_id":"[^"]*"' "<path>" | tail -1` and `grep -o '"has_more":[a-z]*' "<path>" | tail -1`.
   > If it came back inline, skip it: never write, copy or retype any of it (retyping trips a safety filter);
   > take only its top-level `first_id` and `has_more`. Stop when `has_more` is false or after 10 pages. These
   > transcripts are private: never quote them. Return per session only: pages saved, pages skipped, whether the
   > start was reached, and an error class if `list_events` failed.

4. Reflect: `node $T/reflect.mjs $T/pages > $T/report.md` (add `--json` for the per-session rows). Add up the pages
   saved and skipped from the helpers' reports.
5. The doc. Read it with `sinceRev` if you hold a bookmark, else its outline; the section is the one headed "The
   first reflection". From `report.md`, update in place, with guards (`ifHash`, `ifRev`) from your read:
   - the lead paragraph: sessions read, their date range, the most met trap and its count, and the next;
   - the chart widget's inline rows (sessions placed, and sessions that met the trap, per stage) by `draft-edit`,
     its title and `aria-label` if the finding changed, then look at it (screenshot) and `publish`; the embed's
     caption (sessions, date range);
   - the law table's Broken column, and the turn count in the sentence above it;
   - the before and after table, with the code-turn share written as "67% (10 of 15)";
   - the sentence on gaps: pages skipped out of pages fetched.

   Any other sentence in the section: check it against the report, change a number the report gives, and if a
   claim no longer holds, say so in one plain sentence instead of keeping it. Nothing outside the section changes,
   except "The plan as a script" when `git log --since="3 days ago" origin/claude/art-database-photos-ilnaf7 --
   5s/gameplan/reflect.mjs` shows commits: then update the sentences there that describe what changed.
6. `rm -rf $T`. Tell the artist in two or three short lines what moved (the most met trap, the laws, before and
   after) and give the doc's link.

# Time estimates: how long the work really takes

The artist asked (5 Nov 2026) for a time estimate every time something is being developed, and for the estimates
to get more accurate. Read this before giving one; add a row when the work is done.

## How to estimate

- Count the agents and how many run at once. Workflow agents run at most `nproc - 2` at a time (this container has
  4 CPUs, so 2). A phase with 3 agents takes two rounds, not one.
- Use these measured times per agent (DUH intro workflows, Nov 2026):

  | stage | one agent takes |
  | --- | --- |
  | build one take | 35-66 min |
  | judge (all takes) | 9-35 min |
  | finish (grafts, video, sound) | 22-55 min |
  | check | 20-34 min |
  | fix round (only if a check blocks) | 16-28 min |
  | my own review and delivery afterwards | 8-30 min |

- So, for the whole job, including my review:
  - 3 takes, judged, finished, checked, maybe fixed: 3.5-4.5 h (measured 3.2 and 3.35 h before my review);
  - 2 takes: about 2-2.5 h (measured 1.9 h);
  - a single finish-and-check: about 1 h;
  - a new sound made by me and put on an existing video: 20-30 min.
- Add 20-30% when the brief is new or harder than the last one.
- Give a range and the time it should be ready ("in about 4 to 5 hours"). When a phase ends or the scope changes,
  give the updated estimate.

## Log

| date | work | estimate given | actual | note |
| --- | --- | --- | --- | --- |
| 5 Nov | DUH intro: a fix round | about 1 h | 0.9 h | right |
| 5 Nov | DUH intro: a check | 20-30 min | about 15 min | right |
| 5 Nov | DUH intro: finish, sound, checks, fixes | about 2-2.4 h, stage by stage | 2.1 h | right |
| 5 Nov | DUH intro: echo entrance (2 takes) | 1.5-2 h | 1.9 h | right, at the top of the range |
| 5 Nov | DUH intro: sixteen layers (3 takes) | 1.5-2 h | 3.2 h | 1.6-2x too short: the third take waited for a free slot, the slowest take took 66 min, and a fix round ran |
| 5 Nov | DUH intro sound: wind and leaf, a preview on the current video (done by me, no workflow) | 30-45 min | 21 min | a little faster than said: one generator, two endings |
| 5 Nov | DUH intro sound: rework of that preview (keep the logo's sounds), by me | 15-20 min | about 5 min | too long: reusing a finished generator is quick; say 5-10 min for a change like this |
| 5 Nov | DUH intro: golden organization and paths (3 takes) | 2 h at first, corrected to 4-5 h, then by stage to ready 6:45-7:15 pm | 3.0 h (20:45-23:45 UTC, ready 6:45 pm), with a container restart and three relaunches to retitle | the first figure ignored the 2-at-a-time limit; the corrected 4-5 h was 1 h long because the finish took 22 min, not 45-60; the stage-by-stage estimate was right |

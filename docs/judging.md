# How judging works

The ranking logic is in [`src/lib/monte-carlo.ts`](../src/lib/monte-carlo.ts). It
uses your event's rubric, set in the admin panel, and is covered by tests.

1. **Per-judge normalization.** Each judge's scores on each criterion are
   rescaled to mean 0 and standard deviation 1 before the weights are applied.
   A judge who gives everyone 5s doesn't outweigh one who centres on 3.
2. **Shrinkage for thin evidence.** A project scored by few judges is pulled
   toward neutral by `n / (n + k)`, with `k = 3`. One enthusiastic judge doesn't
   beat nine judges who broadly agree.
3. **Monte Carlo.** 1,000 trials each add noise to every score, scaled by that
   judge's own spread, and re-rank. A project's chance of placing is the share
   of trials it landed in the top places. The seed is logged, so anyone can
   reproduce the result.
4. **Selection.** Projects that place in at least 70% of trials are locked in.
   Remaining places are drawn from the rest, weighted by their chance of
   placing, using the same seed.
5. **Ties.** Level rankings are ordered by the tie-breaker criteria. Pairs the
   tie-breakers can't separate are flagged for the panel to decide.

A recused judge's scores never count: declaring a conflict deletes any score
that judge gave the project, and new ones are refused.

## Who can see what

These rules are written as plain functions in
[`src/server/policy.ts`](../src/server/policy.ts) and enforced by every function
in [`src/server/`](../src/server/) that reads or writes on someone's behalf. The
tests beside them run against a real database.

| Who | Can |
| --- | --- |
| Public | Register and submit while the admin has those forms open. Edit their own submission through its private link. |
| Judges | See complete, unhidden submissions once judging opens, without any contact details. Answers to your own questions reach them only where you tick "Show the answer to judges". Read and write only their own scores and conflicts. See panel averages and anonymous notes once results open. |
| Mentors | See what judges see. Never score. |
| Admins | See everything, including contact details. Preview results at any time. |
| Admins with the viewer role | See everything admins see. Change nothing. |

---

[Back to the README](../README.md) · [All guides](README.md)

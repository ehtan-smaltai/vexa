# Calendar-driven meetings mail only the organizer: the completion event carries no participants

- Change ID: phase2-calendar-attendees
- Work type: bug
- Status: complete
- Created: 2026-09-21
- Baseline revision: 7d727ea2 (branch `phase-1`)

## Outcome and scope

**Reported as:** "for meetings that come from your calendar rather than an email invite, the
attendee list arrives empty, so only the organizer would be emailed" (my own phase-1 finding).

**Actually observed:** worse than reported. A calendar meeting mails **nobody at all** — not the
organizer either. `email_minutes` raises `KeyError('organizer')` before it sends anything, and the
reaction retries forever.

**In scope:** the `post_meeting` lane resolving who and what from the meeting row when the fact
does not carry it. **Out of scope:** branding, the admin UI, a live bot join.

## Acceptance criteria

| ID | Observable criterion | Verification | Status |
| --- | --- | --- | --- |
| R-101 | A `meeting.completed` fact carrying only `{uid, meeting_id, native, platform, completion_reason}` produces minutes mailed to the organizer and every inside-domain attendee from the meeting row | `bin/phase1-replay --calendar` → Mailpit | pass |
| R-102 | Those mails name the real organizer and meeting title, not the `"the organiser"` / `"your meeting"` placeholders | read the attendee mail | pass |
| R-103 | The invite lineage (fact carries participants) is unchanged | `bin/phase1-replay` → Mailpit | pass |
| R-104 | A meeting whose organizer cannot be resolved fails loudly rather than mailing a headless report | code path: `StepError` in `email_minutes` | pass (by inspection; not exercised) |

## Root cause

Two admission lineages put different facts in the same reaction, and every step after
`process_meeting` was written against only one of them.

- An emailed invite → `invite_intake` admits `{organizer, title, participants, participant_names, …}`.
- A calendar feed → meeting-api publishes `meeting_completed_refs` =
  `{uid, meeting_id, native, platform, completion_reason}` and nothing else. It also usually WINS
  the race to admit, because it fires the instant the row goes `completed` while the invite lane's
  own `emit_completed` waits for a poll tick.

The four missing facts already exist on the meeting row: calendar sync writes `data.name` (the ICS
SUMMARY) and `data.attendees` (`{email, name?, partstat?}`, reconciled with the feed).

## Decisions

- D-1 **One resolver, not four patched call sites.** `production._roster(ctx)` returns
  `{organizer, title, participants, participant_names}`, refs first and the meeting row second,
  cached in `ctx.scratch` (the same home and reasoning as `_meeting_stamp`). Eleven read sites
  across `process_meeting`, `email_minutes`, `_provenance`, `_attendees`, `email_attendees`,
  `drop_to_attendees` and `_scaffold_refs` now go through it.
- D-2 **Refs are not enriched in place.** `subject_refs` is written once at admission and never
  updated by the engine (`flows/loop.py` persists only `scratch`), so a durable enrichment would
  have meant a new engine capability. The resolver is the smaller change.
- D-3 **The organizer is the Vexa user, not the ICS `ORGANIZER`.** In this lane the word means
  *who had Vexa in the room* — the addressee of the minutes and the domain that bounds the
  fan-out. The ICS organizer is whoever booked the call, frequently at another company; using it
  would invert the containment `_attendees` exists to enforce. Resolved through identity with the
  new `common.platform_user_email(uid)` (`GET /admin/users/{id}`), the mirror of the existing
  `platform_user_id(email)`.
- D-4 **A missing organizer is a loud failure**, not a mail to nobody: `email_minutes` raises a
  retryable `StepError` naming the meeting and the user.

## Verification evidence

| Criterion | Command | Revision | Result | Evidence |
| --- | --- | --- | --- | --- |
| repro | `bin/phase1-replay --calendar` | 7d727ea2 | **bug reproduced** | reaction stuck `retrying email_minutes unexpected: KeyError('organizer')` for 16 polls; Mailpit 0 messages |
| R-101 | `bin/phase1-replay --calendar` | this change | pass | reaction `done` in ~40 s; Mailpit 3 messages — `Minutes: …` to ethan@smaltai.com, `… — what it means for you` to priya@ and marco@ |
| R-102 | read the attendee mail | this change | pass | "ethan@smaltai.com had me in Q3 pricing review … on 20 September 2026"; placeholder-leak check `False` |
| R-103 | `bin/phase1-replay` | this change | pass | reaction `done`; 3 messages to the same three addresses |

`drop_to_attendees` answers `agent:not_present` in both runs (no PUT workspace route in this cut),
which is the phase-1 degradation, not a regression.

## Documentation

`bin/phase1-replay` grew a `--calendar` mode that admits the fact exactly as meeting-api does, so
the two lineages can be exercised separately. Its header documents both.

## Handoff

- Complete. Both lineages mail the full room.
- Not exercised: R-104 (unresolvable organizer), and a REAL calendar sync — the replay seeds a row
  in the calendar shape rather than importing an ICS feed. A live ICS import is worth doing before
  a customer relies on it.
- Next: phase 2 proper — the `branding` settings key, the admin Branding surface, Minutes and
  Recipients screens, the approval gate.

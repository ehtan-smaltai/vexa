"""minutes.py — what a meeting PRODUCED and who actually received it.

A READ over what `post_meeting` already wrote, in the shape a person asks the question: *what came
out of that meeting, who got it, and did it reach them?* Nothing here admits, claims or runs
anything, and nothing new is stored — which is why it sits beside `service.py` rather than in
`flows/` or `flows_steps/`.

THE TWO SOURCES, and why both are needed:

  `reaction.subject_refs`   which meeting, whose, what it was called — WHEN THE FACT CARRIED IT.
  `reaction.scratch`        `_roster`, the organiser/title/attendees the lane RESOLVED. A meeting
                            that came from a calendar feed rather than an emailed invite is
                            admitted with only `{uid, meeting_id, native, platform}`, so refs
                            alone render such a meeting titleless, ownerless and one recipient
                            short — the same asymmetry `production._roster` exists to close, seen
                            from the read side.
  `effect_receipt.result`   what each step produced — the report (`process_meeting`), the
                            organiser's message id (`email_minutes`), the per-attendee fan-out
                            (`email_attendees.drops` / `.failed`), the desk copies
                            (`drop_to_attendees`).

Delivery is therefore a FACT WITH A RECEIPT rather than a guess: every address in `sent` has an
SMTP message-id behind it, and every address in `failed` carries the reason it did not go. A
screen built on this can say "delivered" without anybody having to believe it.

WHAT IT DOES NOT KNOW, stated because a recipients view invites the assumption: whether a person
OPENED the mail. Nothing in this system tracks that — there is no pixel and no click record — so
the vocabulary here stops at `sent`, `failed` and `pending`. A UI that shows "opened" is showing
something this deployment did not measure.

SCOPING IS THE SAME PAIR `list_reactions` USES, for the reason `model.concerns` documents: the
invite lineage carries an organizer address and no uid, the completed lineage carries a uid and no
address, and matching on one of them silently returns half a person's meetings.
"""
from __future__ import annotations

from typing import Callable, Optional

from flows_timeline.model import concerns, iso, loads
from flows_timeline.service import SCAN_ROWS, _rows, resolve_identity

#: The flow whose receipts this module reads. One name, spelled once.
FLOW = "post_meeting"

_R_COLS = ("reaction_id", "subject_refs", "scratch", "flow", "status", "step", "reason",
           "created_at", "updated_at")
_E_COLS = ("reaction_id", "step", "state", "provider_ref", "result", "confirmed_at")

#: A recipient's delivery state. Three, and no fourth: see the module docstring on "opened".
SENT, FAILED, PENDING = "sent", "failed", "pending"


def _receipts(db, reaction_ids: list) -> dict:
    """`{reaction_id: {step: result}}` for the confirmed effects of these reactions.

    One query for the whole page rather than one per meeting: a list of twenty meetings was
    otherwise twenty round trips, and the projection is read on every open of the screen.
    """
    if not reaction_ids:
        return {}
    marks = ", ".join(f":r{i}" for i in range(len(reaction_ids)))
    params = {f"r{i}": rid for i, rid in enumerate(reaction_ids)}
    rows = _rows(db, f"SELECT {', '.join(_E_COLS)} FROM effect_receipt "
                     f"WHERE reaction_id IN ({marks}) AND state = 'confirmed'", params, _E_COLS)
    out: dict = {}
    for r in rows:
        out.setdefault(r["reaction_id"], {})[r["step"]] = loads(r["result"]) or {}
    return out


def _recipients(refs: dict, results: dict) -> list:
    """Every address this meeting's minutes were meant for, with what happened to each.

    ORDER IS THE ROOM'S ORDER, organiser first: the person reading this screen is usually the
    organiser, and a list that opens with somebody else reads as a list of other people rather
    than as their own meeting's delivery.
    """
    organizer = str(refs.get("organizer") or "").strip().lower()
    minutes = results.get("email_minutes") or {}
    attendees = results.get("email_attendees") or {}
    dropped = {str(a).strip().lower() for a in (results.get("drop_to_attendees") or {}).get("to") or []}

    out: list = []
    seen: set = set()

    def add(address: str, state: str, *, role: str, message_id: str = "", detail: str = "") -> None:
        key = address.strip().lower()
        if not key or key in seen:
            return
        seen.add(key)
        out.append({"address": key, "role": role, "state": state,
                    "message_id": message_id, "detail": detail,
                    "filed_to_desk": key in dropped})

    if organizer:
        # `email_minutes` sends exactly one mail and returns its id; no id means the step has not
        # run (or was skipped because this person turned minutes off), which is `pending`, not a
        # failure — the difference matters to whoever is deciding whether to resend.
        mid = str(minutes.get("message_id") or "")
        add(organizer, SENT if mid else PENDING, role="organizer", message_id=mid)

    # `drops` carries one entry per person the fan-out ACTUALLY mailed, each with the link that
    # person was given; `to` is the same set of addresses. Prefer `drops` — it is the richer of
    # the two and the one `drop_to_attendees` itself runs on.
    for drop in (attendees.get("drops") or []):
        if isinstance(drop, dict):
            add(str(drop.get("to") or drop.get("address") or ""), SENT, role="attendee",
                message_id=str(drop.get("message_id") or ""))
    for address in (attendees.get("to") or []):
        add(str(address), SENT, role="attendee")
    # `failed` is `"address: reason"` — the address is what the screen keys on, the reason is what
    # the person needs in order to decide whether a resend would do anything.
    for entry in (attendees.get("failed") or []):
        text = str(entry)
        address, _, reason = text.partition(":")
        add(address, FAILED, role="attendee", detail=reason.strip() or text)
    return out


def _summary(recipients: list) -> dict:
    return {
        "total": len(recipients),
        SENT: sum(1 for r in recipients if r["state"] == SENT),
        FAILED: sum(1 for r in recipients if r["state"] == FAILED),
        PENDING: sum(1 for r in recipients if r["state"] == PENDING),
    }


def _identity(row: dict) -> dict:
    """WHO AND WHAT, refs first and the lane's resolved roster second.

    `subject_refs` is written once at admission and never updated, so on the calendar lineage it
    is the thinner of the two sources by design. `scratch` is persisted after every step and
    carries `_roster` from the moment `process_meeting` resolved it.
    """
    refs = dict(loads(row["subject_refs"]) or {})
    roster = (loads(row.get("scratch")) or {}).get("_roster") or {}
    if isinstance(roster, dict):
        for key in ("organizer", "title"):
            if not str(refs.get(key) or "").strip() and roster.get(key):
                refs[key] = roster[key]
    return refs


def _row_to_entry(row: dict, results: dict, *, with_report: bool) -> dict:
    refs = _identity(row)
    recipients = _recipients(refs, results)
    entry = {
        "meeting_id": str(refs.get("meeting_id") or ""),
        "native_meeting_id": str(refs.get("native") or ""),
        "platform": str(refs.get("platform") or ""),
        "title": str(refs.get("title") or ""),
        "organizer": str(refs.get("organizer") or ""),
        "reaction_id": row["reaction_id"],
        # The REACTION's state, not the mail's: `done` means the lane finished, and a lane can
        # finish having mailed nobody (everybody opted out). The per-recipient states below are
        # what a reader should believe about delivery.
        "state": row["status"],
        "step": row["step"],
        "reason": row["reason"] or "",
        "created_at": iso(row["created_at"]),
        "updated_at": iso(row["updated_at"]),
        "recipients": recipients,
        "delivery": _summary(recipients),
        "link": str((results.get("email_minutes") or {}).get("link") or ""),
        "filed": str((results.get("drop_to_attendees") or {}).get("entity") or ""),
        "has_report": bool((results.get("process_meeting") or {}).get("report")),
    }
    if with_report:
        entry["report"] = str((results.get("process_meeting") or {}).get("report") or "")
    return entry


def list_minutes(db, *, subject: str, limit: int = 50, scan: int = SCAN_ROWS,
                 identity: Optional[Callable] = None) -> Optional[list]:
    """One person's meetings that produced minutes, newest first. ``None`` when nobody answers to
    ``subject`` — the same three-way answer `list_reactions` gives, for the same reason.

    The REPORT is deliberately absent from the list: it is the largest field by an order of
    magnitude and a list screen shows none of it. `read_minutes` fetches it for the one meeting a
    person opened.
    """
    uid, email = (identity or resolve_identity)(subject)
    if not uid and not email:
        return None
    rows = _rows(db, f"SELECT {', '.join(_R_COLS)} FROM reaction WHERE flow = :f "
                     f"ORDER BY created_at DESC LIMIT {int(scan)}", {"f": FLOW}, _R_COLS)
    mine = [r for r in rows if concerns(loads(r["subject_refs"]), uid, email)][:int(limit)]
    results = _receipts(db, [r["reaction_id"] for r in mine])
    return [_row_to_entry(r, results.get(r["reaction_id"], {}), with_report=False) for r in mine]


def read_minutes(db, meeting_id: str, *, subject: str,
                 identity: Optional[Callable] = None) -> Optional[dict]:
    """ONE meeting's minutes and recipients, or ``None`` when there is no such meeting FOR THIS
    PERSON — the two cases are deliberately one answer here, because distinguishing them would
    tell a caller whether somebody else's meeting exists.
    """
    uid, email = (identity or resolve_identity)(subject)
    if not uid and not email:
        return None
    rows = _rows(db, f"SELECT {', '.join(_R_COLS)} FROM reaction WHERE flow = :f "
                     f"ORDER BY created_at DESC LIMIT {int(SCAN_ROWS)}", {"f": FLOW}, _R_COLS)
    want = str(meeting_id).strip()
    for row in rows:
        refs = loads(row["subject_refs"]) or {}
        if str(refs.get("meeting_id") or "") != want:
            continue
        if not concerns(refs, uid, email):
            continue
        results = _receipts(db, [row["reaction_id"]])
        return _row_to_entry(row, results.get(row["reaction_id"], {}), with_report=True)
    return None

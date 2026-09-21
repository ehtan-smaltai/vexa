# minutes (route handler)

`GET /api/minutes` — what this person's meetings produced and who received it, for the
`minutes` surface. `?meeting=<id>` returns one meeting with its report; without it, the list.

Backed by `GET /minutes` on **flows-api** (`flows_timeline/minutes.py`), which is a read over the
receipts `post_meeting` already wrote — the report, the organiser's message id, the attendee
fan-out and the desk copies. Delivery is a fact with an SMTP message-id behind it, not a guess.

Two properties worth keeping:

- **The user's own key is forwarded, never an operator credential.** flows-api derives the
  subject from the credential it is handed, so this route vouches for nobody. Sending the
  operator key with an asserted `subject` would make this server the thing that decides whose
  minutes you may read.
- **The flows door is addressed directly**, not through the gateway: the gateway carries the
  meetings and agent domains and has no flows route. `VEXA_FLOWS_API_URL` overrides the
  `flows-api:8200` default for a deployment that runs flows elsewhere — or that runs no flows
  domain at all, where this route answers 503 with the reason named so the surface can say
  "this deployment records no minutes" rather than rendering an empty list.

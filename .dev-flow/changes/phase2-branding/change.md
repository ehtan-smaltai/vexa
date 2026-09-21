# White-labeling: one branding setting, read at runtime by every surface

- Change ID: phase2-branding
- Work type: feature
- Status: complete (core slice)
- Created: 2026-09-21
- Baseline revision: 0fe3c490 (branch `phase-1`)
- Delivered revision: 4418381f

## Outcome and scope

**Requested:** white-label the product — the admin Branding screen from the UI concept
(https://claude.ai/artifact/3sS8PRi9HHhZw8g79Yzx3y), applied to what users and their guests see.

**In scope (done):** one `branding` platform setting; the terminal's name, mark, accent and tab
title; an admin-only Branding section with a live preview; the bot's display name in meetings;
the mail From name and every brand word in a mail body.

**Out of scope (next):** the Minutes and Recipients surfaces from the concept; the approval gate;
a logo UPLOAD (the field takes a URL — there is no asset store in this cut); replacing the
bundled `vexa-logo.svg` favicon; the `Built on Vexa` footer line is stored but not yet rendered
in the mail footer.

## Acceptance criteria

| ID | Observable criterion | Verification | Status |
| --- | --- | --- | --- |
| R-201 | A `branding` key stores name, accent, logo URL, bot name, sender name, support address and the attribution toggle | `PUT /internal/settings/branding` | pass |
| R-202 | An accent that is not a hex colour is refused | `PUT` with `"red; } html { display:none"` | pass — 422 |
| R-203 | The sign-in card shows the deployment's name and mark BEFORE authentication | browser at :13000 | pass |
| R-204 | The browser tab title follows the product name | browser tab | pass |
| R-205 | The bot's display name in a meeting follows the brand | `GET /internal/users/1/bot-context` | pass |
| R-206 | Minutes mail arrives From the brand, with no "Vexa" in the body | replay → Mailpit | pass |
| R-207 | An admin can edit branding in the UI; a non-admin cannot | Settings → Branding | partial — admin path built and type-checked; not clicked through (needs sign-in) |
| R-208 | The baked attendee-head default and `behavior/mail/attendee-head.md` stay byte-identical | AST comparison | pass |

## Decisions

- D-1 **One key, not a key per surface.** A product cannot be called two things in one instance,
  so branding is deployment-wide with no per-user tier — unlike `models`, which legitimately has
  one.
- D-2 **`GET /api/branding` is unauthenticated.** The sign-in card is the screen that most needs
  the deployment's own name, and gating it behind a session would mean every first impression is
  the stock brand. What it exposes is bounded to what every outbound mail already prints on the
  outside. The admin-api internal secret stays server-side.
- D-3 **The accent is validated as a hex colour in admin-api**, not at the edge that paints it:
  the value reaches a browser as a CSS custom property, where an arbitrary string is a
  style-injection sink, and the store is the one place every writer passes through.
- D-4 **The From display name is built with `email.headerregistry.Address`**, not an f-string. It
  is operator-supplied text going into a mail header; `Address` quotes and escapes it, so a name
  carrying a comma, a quote or `<evil@x>` cannot forge a second header.
- D-5 **Names here, sentences in the behavior tree.** What the assistant SAYS when it introduces
  itself stays in `_global/mail/attendee-head.md` (git-backed, hot-read, already the designed
  override path). This key carries NAMES. A second home for the same words is the drift
  `behavior/mail/README.md` exists to prevent. `mailtext.render` gained a `{{product}}` token so
  those templates can name the product without hardcoding it.
- D-6 **The bot name resolves inside admin-api**, which already owns both the person's calendar
  bot name and the branding row: person > deployment > stock, in one place, no extra HTTP hop.
- D-7 **Dev overlays rather than rebuilt release images.** `docker-compose.admin-src.yml` mounts
  admin-api's source like the flows overlay; the terminal cannot be overlaid (Next serves a
  production build) so `docker-compose.terminal-src.yml` builds it under the local tag
  `vexa/terminal:dev`, which can never shadow the published `v012` pointer.

## Verification evidence

| Criterion | Command | Result | Evidence |
| --- | --- | --- | --- |
| R-201 | `PUT /internal/settings/branding` | pass | stored `{product_name: "Northwind Minutes", accent: "#1F6F5F", bot_name: "Northwind Notetaker", support_email: …}` |
| R-202 | `PUT` with a CSS-injection accent | pass | HTTP 422 |
| R-203/204 | browser at :13000 through an SSH tunnel | pass | card reads "Northwind Minutes Terminal" with a green "N" mark; tab title "Northwind Minutes Terminal" |
| R-205 | `GET /internal/users/1/bot-context` | pass | `bot_name: Northwind Notetaker` |
| R-206 | `bin/phase1-replay --calendar` → Mailpit | pass | 3 mails, all From `Northwind Minutes <minutes@local.test>`; body opens "I am Northwind Minutes, the meeting assistant at Smalt AI"; `"Vexa" in body` → False |
| R-208 | AST compare of `mailtext.DEFAULTS["attendee-head"]` vs the behavior file | pass | identical |

The terminal image BUILDING is itself the type check: `next build` compiles every `.tsx` in the
change, and it succeeded (`vexa/terminal:dev`).

## Handoff

- Complete for the core slice. A deployment renames itself with one settings write and no rebuild.
- **The VM now runs a locally-built terminal** (`vexa/terminal:dev`) rather than the published
  image, and `~/compose-cmd.txt` carries the two new overlay files. Disk sits at ~84%.
- Branding on the VM is currently set to the placeholder "Northwind Minutes". Clear it with
  `PUT /internal/settings/branding {"product_name":""}` or set the real name.
- Not exercised: R-207 click-through (needs a signed-in admin), a logo URL end to end, the
  attribution footer rendering.
- Next: the Minutes and Recipients surfaces, the approval gate, and the favicon/`vexa-logo.svg`
  asset path.

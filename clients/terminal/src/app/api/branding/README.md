# branding (route handler)

`GET /api/branding` — the deployment's name, mark, accent and mail identity, for
[`../../../branding/`](../../../branding/) to render.

**Unauthenticated, on purpose**, and the narrowest route in this tree because of it: the sign-in
card has to show the product's own name BEFORE anybody has signed in, so gating it behind a
session would mean every first impression is the stock brand — the one screen a white-labelled
deployment most needs to own.

What that exposes is bounded to nothing secret — a name, a colour, a logo URL, a bot name, a From
name and a support address, all of them things this deployment already prints on the outside of
every mail it sends. The admin-api internal secret stays server-side, exactly as in the admin
settings proxy next door; this route forwards no client header.

**A failure here is not an outage.** admin-api down, unset or misconfigured all answer the stock
defaults with a 200: a terminal that will not render because it could not learn its own name is a
worse failure than one wearing the wrong name. The answer is cached for 30 s, which keeps a page
load to one upstream call without outliving an admin's patience after a rename.

Writes go the other way, through the admin-gated proxy at `../admin/settings/[key]`.

# branding

What this deployment calls itself — its name, mark, accent and mail identity — read at RUNTIME
from admin-api's `branding` platform setting. One settings write renames a deployment; nothing
here is a build-time constant, which is the whole point of the module: the name used to be a
literal in a dozen components and the bot's name was a `NEXT_PUBLIC_*` build arg, so "call it
something else" cost an image.

| file | what it is |
|---|---|
| `branding.ts` | the `Branding` shape, the stock `DEFAULTS`, and `fromSetting` — the ONE place admin-api's stored strings become a typed value. Imported by both tiers, so the server route and the client hook cannot disagree about a default. |
| `useBranding.tsx` | the client half: one fetch per page shared by every caller, `applyAccent` / `applyTitle`, and the `<Mark>` component (the configured logo, else the product's initial on the accent). |

The server half is [`../app/api/branding/`](../app/api/branding/), which reads the setting with
the internal secret and never lets it reach the browser.

Two rules this module keeps:

- **Defaults render first.** `useBranding()` never returns null and no caller writes a loading
  branch — a name that resolves a moment later is a repaint, while a spinner where the product
  name goes is a worse first impression than the stock name briefly showing.
- **The accent is a colour, checked before it is stored.** It reaches the page as a CSS custom
  property, so admin-api validates it as hex (`_HEX_COLOR`) and nothing arbitrary is ever painted.

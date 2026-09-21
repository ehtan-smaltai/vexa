"""branding.py — WHAT THIS DEPLOYMENT CALLS ITSELF, for the mail this engine sends.

The same `branding` platform setting the terminal reads, read here for the two names a recipient
actually sees: the From display name on every message, and the product's name where a sentence
has to say it. One store, so the workbench header and the mail signature cannot disagree about
what this product is called — which is precisely what happened while the name was a literal in
`emailx.send` and a build arg in the terminal image.

READ THROUGH IDENTITY, like every other deployment fact this tier needs: `admin-api` owns
platform settings and is the one domain everybody may depend on. Cached for a short window
because mail is bursty — a twenty-person fan-out is twenty sends in a second and they must not be
twenty settings reads — and because an operator who renames the product expects the NEXT meeting's
mail to carry it, not this one's second half.

FAILS SOFT, ALWAYS. admin-api down, the key unset, a half-written value: every one of them
answers the stock names. A deployment that cannot reach its settings store still has minutes to
deliver, and a mail that does not send because the sender's DISPLAY NAME could not be looked up is
the worst possible trade.
"""
from __future__ import annotations

import time
from typing import Optional

# NOT `from .common import ADMIN_API`. That name is a REQUIRED-EXPLICIT door served by `common`'s
# PEP-562 `__getattr__`, so importing it resolves the door AT IMPORT — the thing `_door` exists to
# avoid, and the thing `flows_defs/production.py` has a paragraph about. Resolved per call below.
from .common import _door, http, require_admin_key

#: The stock names — the product's own, used when nothing is configured.
DEFAULT_PRODUCT = "Vexa"

TTL_S = 60.0
_CACHE: Optional[tuple[dict, float]] = None


def reset_cache() -> None:
    """Forget the cached answer. TEST seam, and the same shape `instance_gate.reset_cache` has."""
    global _CACHE
    _CACHE = None


def _read() -> dict:
    """One live read of the `branding` key. Never raises — every failure IS the empty answer."""
    try:
        door = _door("VEXA_FLOWS_ADMIN_API_URL").rstrip("/")
        code, body = http("GET", f"{door}/internal/settings/branding",
                          {"X-Internal-Secret": _internal_secret()}, timeout=5)
    except Exception:  # noqa: BLE001 — including StepError, which common.http raises
        return {}
    if code != 200 or not isinstance(body, dict):
        return {}
    value = body.get("value")
    return value if isinstance(value, dict) else {}


def _internal_secret() -> str:
    # Imported lazily and by name so a deployment that has not set it fails HERE, with the empty
    # answer above, rather than at import of this module — branding is never worth a boot failure.
    from .common import require_internal_secret
    try:
        return require_internal_secret()
    except Exception:  # noqa: BLE001
        return ""


def settings() -> dict:
    """The stored branding dict, cached for `TTL_S`. `{}` when there is none."""
    global _CACHE
    now = time.monotonic()
    if _CACHE is not None and now < _CACHE[1]:
        return _CACHE[0]
    value = _read()
    _CACHE = (value, now + TTL_S)
    return value


def product_name() -> str:
    """What this deployment is called. Never empty."""
    return str(settings().get("product_name") or "").strip() or DEFAULT_PRODUCT


def sender_name() -> str:
    """The From DISPLAY name on outbound mail — the explicit setting, else the product's name.

    An operator who renamed the product and nothing else means the mail to come from the product
    they named; making them type it twice is how the header and the signature drift apart."""
    value = settings()
    return (str(value.get("sender_name") or "").strip()
            or str(value.get("product_name") or "").strip()
            or DEFAULT_PRODUCT)


def bot_name() -> str:
    """The bot's display name in the meeting — the explicit setting, else the product's name."""
    value = settings()
    return (str(value.get("bot_name") or "").strip()
            or str(value.get("product_name") or "").strip()
            or DEFAULT_PRODUCT)


def support_email() -> str:
    """Where a recipient can reach a human, or "" when the deployment names nobody."""
    return str(settings().get("support_email") or "").strip()


def powered_by() -> bool:
    """Whether outbound mail carries the "Built on Vexa" attribution line.

    ON unless an operator explicitly turned it off: the attribution is the licence-friendly
    default, and a typo in the setting must never be the thing that removes it."""
    return str(settings().get("powered_by") or "").strip().lower() not in ("false", "0", "no", "off")


def require_admin_key_present() -> bool:
    """Whether this tier can even ask. Used by nothing yet; kept next to the reader so a future
    caller does not reinvent the check against a different variable."""
    try:
        return bool(require_admin_key())
    except Exception:  # noqa: BLE001
        return False

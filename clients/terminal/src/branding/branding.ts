/** branding.ts — WHAT THIS DEPLOYMENT IS CALLED, as one shape both tiers agree on.
 *
 *  The values live in admin-api's `branding` platform setting and are read at RUNTIME, so an
 *  operator renames a deployment with a settings write and no rebuild. That is the whole point:
 *  the name used to be a literal in a dozen components and `NEXT_PUBLIC_DEFAULT_BOT_NAME` was a
 *  BUILD arg, so "call it something else" cost an image.
 *
 *  Server and client both import THIS module — the route below serves `Branding`, the hook
 *  consumes it, and `DEFAULTS` is the one place the stock names are written. Two copies of a
 *  default is how a sign-in page and a header come to disagree about what the product is called.
 */
export interface Branding {
  /** Replaces "Vexa" wherever a person reads the product's name. */
  productName: string;
  /** Hex, validated server-side (admin-api `_HEX_COLOR`) before it ever reaches a stylesheet. */
  accent: string;
  /** An http(s) URL, or "" to fall back to the bundled mark. */
  logoUrl: string;
  /** The bot's display name in the meeting's participant list. */
  botName: string;
  /** The From display name on outbound mail. */
  senderName: string;
  /** Shown in the mail footer; "" hides the line. */
  supportEmail: string;
  /** Whether the "Built on Vexa" attribution line shows. */
  poweredBy: boolean;
}

export const DEFAULTS: Branding = {
  productName: "Vexa",
  accent: "",            // "" = keep the stylesheet's own --accent
  logoUrl: "",
  botName: "Vexa",
  senderName: "Vexa",
  supportEmail: "",
  poweredBy: true,
};

/** admin-api stores strings; this is the one place they become a typed `Branding`.
 *  Unset fields fall back to `DEFAULTS` field-by-field, never all-or-nothing: an operator who
 *  set only the product name still gets every other default rather than an empty product. */
export function fromSetting(value: Record<string, unknown> | null | undefined): Branding {
  const s = (k: string): string => {
    const v = value?.[k];
    return typeof v === "string" ? v.trim() : "";
  };
  const poweredBy = s("powered_by").toLowerCase();
  return {
    productName: s("product_name") || DEFAULTS.productName,
    accent: s("accent") || DEFAULTS.accent,
    logoUrl: s("logo_url") || DEFAULTS.logoUrl,
    // The bot and the sender default to the PRODUCT name rather than to "Vexa": an operator who
    // names the product and nothing else expects the bot in the meeting to introduce the same
    // product, not the one they renamed away from.
    botName: s("bot_name") || s("product_name") || DEFAULTS.botName,
    senderName: s("sender_name") || s("product_name") || DEFAULTS.senderName,
    supportEmail: s("support_email") || DEFAULTS.supportEmail,
    // Only an explicit false hides it; anything else (unset, a typo) shows the line, because the
    // attribution is the licence-friendly default and a typo must not silently remove it.
    poweredBy: !["false", "0", "no", "off"].includes(poweredBy),
  };
}

/** The initial used when no logo is configured — the same glyph the mark would carry. */
export function initial(name: string): string {
  return (name.trim().charAt(0) || "V").toUpperCase();
}

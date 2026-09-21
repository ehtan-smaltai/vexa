/** GET /api/branding — the deployment's name, logo, accent and mail identity.
 *
 *  UNAUTHENTICATED ON PURPOSE, and the narrowest route in this tree because of it. The sign-in
 *  page has to render the product's name and mark BEFORE anybody has signed in, so gating this
 *  behind a session would mean every first impression is the stock brand — which is the one
 *  screen a white-labelled deployment most needs to own.
 *
 *  What that costs is bounded to nothing secret: the fields are a name, a colour, a logo URL, a
 *  bot name, a From name and a support address — all of them things this deployment already
 *  prints on the outside of every mail it sends. The admin-api internal secret stays server-side,
 *  exactly as in the admin settings proxy next door; this route never forwards a client header.
 *
 *  A FAILURE HERE IS NOT AN OUTAGE. admin-api down, unset, misconfigured: all answer the stock
 *  defaults with a 200, because a terminal that will not render because it could not learn its
 *  own name is a worse failure than a terminal wearing the wrong one.
 */
import { NextResponse } from "next/server";
import { DEFAULTS, fromSetting, type Branding } from "../../../branding/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every page load asks. A short server-side cache keeps that one admin-api call per window
// rather than one per viewer, and 30s is well inside the "did my rename take effect?" patience
// of the admin who just saved.
const TTL_MS = 30_000;
let cache: { at: number; value: Branding } | null = null;

export async function GET(): Promise<NextResponse> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return json(cache.value);

  const adminApiUrl = (process.env.VEXA_ADMIN_API_URL || "").replace(/\/$/, "");
  const secret = process.env.VEXA_INTERNAL_API_SECRET || "";
  if (!adminApiUrl || !secret) return json(DEFAULTS);

  try {
    const res = await fetch(`${adminApiUrl}/internal/settings/branding`, {
      headers: { "X-Internal-Secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return json(DEFAULTS);
    const body = (await res.json()) as { value?: Record<string, unknown> };
    const value = fromSetting(body?.value);
    cache = { at: now, value };
    return json(value);
  } catch {
    // Deliberately silent to the caller: the defaults ARE the answer when the store cannot be
    // reached, and an error body here would make every page render a failure state over a brand.
    return json(DEFAULTS);
  }
}

function json(value: Branding): NextResponse {
  return NextResponse.json(value, { headers: { "Cache-Control": "no-store" } });
}

/** GET /api/minutes — what this person's meetings produced, and who received it.
 *
 *  `?meeting=<id>` returns ONE meeting with its report; without it, the list (no reports — they
 *  are the largest field and a list shows none of them).
 *
 *  THE USER'S OWN KEY IS FORWARDED, never an operator credential. flows-api derives the subject
 *  from the credential it is handed (`subject_or_operator` → `scoped_subject`), so this route
 *  vouches for nobody: a person sees their own meetings because their own key says who they are.
 *  Sending the operator key plus an asserted `subject` would make this server the thing that
 *  decides whose minutes you may read, which is exactly the authority a proxy should not hold.
 *
 *  The flows door is NOT the gateway — the gateway carries the meetings and agent domains and
 *  does not route to flows — so it is addressed directly on the stack network, with the same
 *  `service:port` default shape the compose file uses for every other door.
 */
import { NextResponse } from "next/server";
import { resolveApiKey } from "../proxyAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FLOWS = (process.env.VEXA_FLOWS_API_URL || "http://flows-api:8200").replace(/\/+$/, "");

export async function GET(req: Request): Promise<NextResponse> {
  const key = await resolveApiKey();
  if (!key) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const meeting = new URL(req.url).searchParams.get("meeting")?.trim();
  // A meeting id reaches this line from the browser, so it is encoded rather than interpolated:
  // an id carrying `/` or `?` would otherwise re-point the request at another flows route.
  const path = meeting
    ? `/minutes/${encodeURIComponent(meeting)}`
    : `/minutes?limit=${encodeURIComponent(new URL(req.url).searchParams.get("limit") || "50")}`;

  try {
    const res = await fetch(`${FLOWS}${path}`, {
      headers: { "X-API-Key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    // A deployment may legitimately not carry the flows domain at all, in which case this door
    // is unreachable rather than broken. 503 with the reason named, so the surface can say "this
    // deployment records no minutes" instead of rendering an empty list that looks like "you have
    // had no meetings".
    return NextResponse.json(
      { error: `the minutes service is unreachable: ${(err as Error).message}` },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

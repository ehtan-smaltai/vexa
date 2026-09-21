/** minutesApi — reading what a meeting produced and who received it.
 *
 *  Data access only, in its own module for the reason the other `*Api.ts` files give: the surface
 *  renders, this fetches, and the shapes are provable without a DOM. Everything is scoped to the
 *  authed user by the SERVER (flows-api derives the subject from the forwarded key), so nothing
 *  here takes a subject — a client that could name one would be a client that could ask for
 *  somebody else's meetings.
 */

/** What happened to one address. Three states and no fourth: nothing in this system records
 *  whether a mail was OPENED, so a UI must not imply that it does. */
export type DeliveryState = "sent" | "failed" | "pending";

export interface Recipient {
  address: string;
  role: "organizer" | "attendee";
  state: DeliveryState;
  message_id: string;
  /** Why it failed, when it did — what a person needs to decide whether a resend would help. */
  detail: string;
  filed_to_desk: boolean;
}

export interface MinutesEntry {
  meeting_id: string;
  native_meeting_id: string;
  platform: string;
  title: string;
  organizer: string;
  reaction_id: string;
  /** The REACTION's state (`done`, `failed`, `retrying`…), not the mail's — a lane can finish
   *  having mailed nobody. Believe `recipients` for delivery. */
  state: string;
  step: string;
  reason: string;
  created_at: string;
  updated_at: string;
  recipients: Recipient[];
  delivery: { total: number; sent: number; failed: number; pending: number };
  link: string;
  filed: string;
  has_report: boolean;
  /** Present only on the single-meeting read; the list omits it deliberately. */
  report?: string;
}

/** Thrown when the deployment carries no flows domain, or it cannot be reached. Distinguished
 *  from "you have no meetings" so the surface can say which. */
export class MinutesUnavailable extends Error {}

async function read(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 503) throw new MinutesUnavailable((await res.json().catch(() => ({}))).error || "unavailable");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`minutes: HTTP ${res.status}`);
  return res.json();
}

export async function listMinutes(limit = 50): Promise<MinutesEntry[]> {
  const body = await read(`/api/minutes?limit=${encodeURIComponent(String(limit))}`) as
    { minutes?: MinutesEntry[] } | null;
  return body?.minutes ?? [];
}

export async function readMinutes(meetingId: string): Promise<MinutesEntry | null> {
  return await read(`/api/minutes?meeting=${encodeURIComponent(meetingId)}`) as MinutesEntry | null;
}

/** A meeting's own line in the list: what a person scans for. Kept here rather than in the view
 *  so the wording of a delivery summary has one home. */
export function deliverySummary(e: MinutesEntry): string {
  const { total, sent, failed, pending } = e.delivery;
  if (total === 0) return "no recipients";
  if (failed > 0) return `${failed} of ${total} failed`;
  if (pending > 0) return `${sent} of ${total} sent, ${pending} pending`;
  return `sent to ${sent}`;
}

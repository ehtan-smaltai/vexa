"use client";
/** Minutes — what a meeting produced, and who actually received it.
 *
 *  LEFT: one row per meeting that ran the minutes lane, newest first, each carrying its delivery
 *  summary — the thing a person scans this screen for is "did it go out", not "does it exist".
 *  CENTER: the report as it was mailed, plus a RECIPIENTS rail listing every address with what
 *  happened to it.
 *
 *  THE VOCABULARY STOPS AT SENT. Nothing in this system records whether a mail was opened — no
 *  pixel, no click record — so this surface says `sent`, `failed` and `pending` and never
 *  "opened". A status a deployment did not measure is worse than no status, because somebody
 *  will make a decision on it.
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useService } from "../platform";
import { LayoutServiceId, type TabDescriptor } from "../workbench/layout";
import { registerList, registerTab, type TabProps } from "../contributions";
import { Icon } from "../ui-kit";
import { usePreviewPinTab } from "./previewPinTab";
import { listMinutes, readMinutes, deliverySummary, MinutesUnavailable,
         type MinutesEntry, type Recipient } from "./minutesApi";

const tabFor = (e: MinutesEntry): TabDescriptor => ({
  id: `minutes:${e.meeting_id}`,
  title: e.title || `Meeting ${e.meeting_id}`,
  kind: "minutes",
  params: { meetingId: e.meeting_id },
  context: null,
});

const when = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined,
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const TONE: Record<string, { fg: string; bg: string }> = {
  sent: { fg: "var(--green)", bg: "var(--greenbg)" },
  failed: { fg: "var(--danger)", bg: "var(--dangerbg)" },
  pending: { fg: "var(--warn)", bg: "var(--warnbg)" },
};

function Pill({ state, children }: { state: string; children: React.ReactNode }) {
  const tone = TONE[state] ?? { fg: "var(--t2)", bg: "var(--panel2)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 999,
                   color: tone.fg, background: tone.bg, whiteSpace: "nowrap" }}>{children}</span>
  );
}

// ── LEFT: the list ────────────────────────────────────────────────────────────────
function MinutesRow({ entry }: { entry: MinutesEntry }) {
  const nav = usePreviewPinTab<HTMLDivElement>(tabFor(entry));
  const worst = entry.delivery.failed > 0 ? "failed" : entry.delivery.pending > 0 ? "pending" : "sent";
  return (
    <div onClick={nav.onClick} onDoubleClick={nav.onDoubleClick} role="button" tabIndex={0}
         onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") nav.onClick(e as unknown as React.MouseEvent<HTMLDivElement>); }}
         style={{ display: "flex", flexDirection: "column", gap: 3, padding: "8px 9px", borderRadius: 7,
                  cursor: "pointer", border: "1px solid transparent" }}>
      <div style={{ fontSize: 13, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {entry.title || `Meeting ${entry.meeting_id}`}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>{when(entry.created_at)}</span>
        <Pill state={worst}>{deliverySummary(entry)}</Pill>
      </div>
    </div>
  );
}

function MinutesLeft() {
  const layout = useService(LayoutServiceId);
  const [rows, setRows] = useState<MinutesEntry[] | null>(null);
  const [unavailable, setUnavailable] = useState("");

  useEffect(() => {
    let live = true;
    void listMinutes()
      .then((r) => { if (live) setRows(r); })
      .catch((e) => {
        if (!live) return;
        setRows([]);
        // "This deployment records no minutes" and "you have had no meetings" are different
        // answers with different fixes, so they are never collapsed into one empty list.
        if (e instanceof MinutesUnavailable) setUnavailable(e.message);
      });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (rows && rows[0]) layout.openTab(tabFor(rows[0])); }, [rows, layout]);

  return (
    <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", padding: "6px 4px 4px" }}>
        minutes sent
      </div>
      {rows === null && <div style={{ padding: "8px 4px", color: "var(--t3)", fontSize: 12 }}>Loading…</div>}
      {rows?.map((e) => <MinutesRow key={e.meeting_id} entry={e} />)}
      {rows?.length === 0 && (
        <div style={{ padding: "8px 4px", color: "var(--t3)", fontSize: 12, lineHeight: 1.5 }}>
          {unavailable
            ? `This deployment records no minutes — ${unavailable}`
            : "No minutes yet. They appear here after a meeting the bot attended finishes."}
        </div>
      )}
    </div>
  );
}

// ── CENTER: the report + the recipients rail ──────────────────────────────────────
const H: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: ".04em",
                           textTransform: "uppercase", color: "var(--t2)", margin: "0 0 8px" };

function RecipientRow({ r }: { r: Recipient }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0",
                  borderTop: "1px solid var(--line)", minHeight: 40 }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", flex: "none",
                   background: "var(--panel2)", color: "var(--t2)", fontSize: 10, fontWeight: 600,
                   display: "flex", alignItems: "center", justifyContent: "center" }}>
        {r.address.slice(0, 2).toUpperCase()}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.address}
        {r.role === "organizer" && <span style={{ color: "var(--t3)" }}> · organizer</span>}
      </span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {r.filed_to_desk && <Icon name="panel" size={12} />}
        <Pill state={r.state}>{r.state}</Pill>
      </span>
    </div>
  );
}

/** The report, rendered as the plain text it was mailed as.
 *  NOT markdown-rendered on purpose: this is the artefact that went out verbatim, and a screen
 *  that prettifies it shows something the recipients did not get. */
function Report({ text }: { text: string }) {
  return (
    <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6,
                  color: "var(--t1)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</pre>
  );
}

function MinutesView({ params }: TabProps) {
  const meetingId = String((params as { meetingId?: string })?.meetingId || "");
  const [entry, setEntry] = useState<MinutesEntry | null | "missing">(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!meetingId) return;
    void readMinutes(meetingId)
      .then((e) => setEntry(e ?? "missing"))
      .catch((e: Error) => setError(e.message));
  }, [meetingId]);
  useEffect(load, [load]);

  if (error) return <div style={{ padding: 24, color: "var(--danger)", fontSize: 13 }}>{error}</div>;
  if (entry === null) return <div style={{ padding: 24, color: "var(--t3)", fontSize: 13 }}>Loading…</div>;
  if (entry === "missing") return <div style={{ padding: 24, color: "var(--t3)", fontSize: 13 }}>No minutes for that meeting.</div>;

  const failed = entry.recipients.filter((r) => r.state === "failed");
  return (
    <div style={{ height: "100%", overflow: "auto", padding: "22px 26px", display: "flex", gap: 26, alignItems: "flex-start" }}>
      <article style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, color: "var(--t1)" }}>
            {entry.title || `Meeting ${entry.meeting_id}`}
          </h1>
          <div style={{ fontSize: 12, color: "var(--t3)" }}>
            {[when(entry.created_at), entry.platform, entry.organizer && `organized by ${entry.organizer}`]
              .filter(Boolean).join(" · ")}
          </div>
        </header>

        {entry.report
          ? <Report text={entry.report} />
          : (
            // A lane can finish without a report — it failed, or it is still running. Say which,
            // with the step and reason the engine recorded, rather than showing a blank page.
            <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
              No report was produced. The minutes lane is <b>{entry.state}</b> at step <code
                style={{ fontFamily: "var(--mono)" }}>{entry.step}</code>.
              {entry.reason && <div style={{ marginTop: 8, color: "var(--t3)" }}>{entry.reason}</div>}
            </div>
          )}
      </article>

      <aside style={{ width: 320, flex: "none", display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <h2 style={H}>Recipients</h2>
          <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 2 }}>{deliverySummary(entry)}</div>
          {entry.recipients.map((r) => <RecipientRow key={r.address} r={r} />)}
          {entry.recipients.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--t3)", paddingTop: 8, lineHeight: 1.5 }}>
              Nobody was mailed. Either the room was empty of addresses inside the allowed
              domains, or everyone in it turned minutes off.
            </div>
          )}
        </section>

        {failed.length > 0 && (
          <section>
            <h2 style={H}>Why they failed</h2>
            {failed.map((r) => (
              <div key={r.address} style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, paddingTop: 6 }}>
                <b style={{ color: "var(--t1)" }}>{r.address}</b><br />{r.detail || "no reason recorded"}
              </div>
            ))}
          </section>
        )}

        <section>
          <h2 style={H}>Also filed</h2>
          <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.6 }}>
            {entry.filed
              ? <>Each attendee&rsquo;s workspace · <span style={{ fontFamily: "var(--mono)" }}>{entry.filed}</span></>
              : "Not filed to any workspace by this deployment — the mail carries the report itself."}
          </div>
        </section>
      </aside>
    </div>
  );
}

registerTab("minutes", MinutesView);
registerList({ id: "minutes", label: "Minutes", icon: "tag", order: 20, component: MinutesLeft });

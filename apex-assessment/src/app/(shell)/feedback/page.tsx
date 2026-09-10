// My Feedback: a person's own results, unlocked once all three lenses are in.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  allLensesSubmitted,
  assignedAMs,
  getAssessment,
  listCapabilities,
  averageRequired,
  averageWeighted,
  scoredRows,
  submittedLevels,
  submittedThemeNotes,
  themeJustificationText,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, type Lens } from "@/lib/seed-data";
import { gapClass } from "@/lib/heat";
import FeedbackDownload from "./feedback-download";

function Chip({ level }: { level: number | null | undefined }) {
  return <span className={`lvl-chip ${level ? `lvl-${level}` : "lvl-none"}`}>{level ? `L${level}` : "n/a"}</span>;
}

export default async function FeedbackPage() {
  const user = await requireUser();
  // Feedback is for the assessed person (a self-assessor). Anyone else goes home.
  if (user.lens !== "self") redirect(user.role === "superadmin" ? "/analysis" : "/rate");

  const mine = assignedAMs(user.id);
  if (mine.length === 0) {
    return (
      <Shell title="My Feedback">
        <div className="banner banner-info">
          No Account Manager profile is linked to your account yet. Your administrator connects it in
          Users &amp; Access; your feedback will appear here once your profile is linked and all three
          assessments are submitted.
        </div>
      </Shell>
    );
  }
  const am = mine[0];
  if (!am.profile_complete) redirect("/onboarding");

  // Gate: all three lenses must be submitted before feedback is released.
  if (!allLensesSubmitted(am.id)) {
    const statuses = LENSES.map((lens) => ({
      label: LENS_LABELS[lens],
      submitted: getAssessment(am.id, lens)?.status === "submitted",
    }));
    return (
      <Shell title="My Feedback">
        <div className="banner banner-info">
          Your feedback will be available here once all three assessments are submitted: your own
          self-assessment, your manager&apos;s, and the APEX Panel&apos;s.
        </div>
        <div className="card card-pad" style={{ marginTop: 18, maxWidth: 460 }}>
          <h2 className="card-title" style={{ fontSize: 15 }}>Assessment status</h2>
          <ul className="mini-list" style={{ marginTop: 8 }}>
            {statuses.map((s) => (
              <li key={s.label}>
                <span className={`badge ${s.submitted ? "badge-green" : "badge-gray"}`}>
                  {s.submitted ? "✓ submitted" : "pending"}
                </span>
                <strong>{s.label}</strong>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    );
  }

  // ---- build the report (same definitions as the individual analysis + PDF) ----
  const rows = scoredRows(am.id, am.track);
  const applicable = rows.filter((r) => r.req != null);
  const strengths = applicable
    .filter((r) => r.gap != null && r.gap > 0)
    .sort((a, b) => b.gap! - a.gap!);
  const development = applicable
    .filter((r) => r.gap != null && r.gap < 0)
    .sort((a, b) => a.gap! - b.gap!);
  const perceptionGaps = rows
    .filter((r) => r.perception != null && Math.abs(r.perception) >= 1)
    .sort((a, b) => Math.abs(b.perception!) - Math.abs(a.perception!));

  const clusters: { name: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cap.cluster) clusters.push({ name: row.cap.cluster, rows: [row] });
    else last.rows.push(row);
  }

  const themeNotes = submittedThemeNotes(am.id);
  const notesByCluster = new Map<string, { lens: Lens; note: string }[]>();
  for (const n of themeNotes) {
    const text = themeJustificationText(n);
    if (!text) continue;
    if (!notesByCluster.has(n.cluster)) notesByCluster.set(n.cluster, []);
    notesByCluster.get(n.cluster)!.push({ lens: n.lens, note: text });
  }
  for (const list of notesByCluster.values()) {
    list.sort((a, b) => LENSES.indexOf(a.lens) - LENSES.indexOf(b.lens));
  }

  const meets = applicable.filter((r) => r.gap != null && r.gap >= 0).length;
  const below = applicable.filter((r) => r.gap != null && r.gap < 0).length;

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">My Feedback</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Your APEX assessment</h1>
            <div className="am-meta">
              <span className="badge badge-green">All three assessments complete</span>
              <span className="badge badge-zone">{am.zone}</span>
              <span className="badge badge-track">{am.track}</span>
            </div>
          </div>
          <FeedbackDownload amId={am.id} amName={am.name} />
        </div>
        <p className="page-sub" style={{ marginTop: 12 }}>
          The APEX Panel is the authoritative view. Across the {applicable.length} capabilities that apply
          to your {am.track} track, the panel places you at or above the required level on {meets} and below
          on {below}. Download the PDF above for the full written report.
        </p>
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <h2 className="card-title">Strengths</h2>
          <p className="card-sub">Where the APEX Panel places you above the required level.</p>
          {strengths.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
              The panel does not yet place you above the required level on any capability. You are on
              the baseline or building toward it.
            </p>
          ) : (
            <ul className="mini-list">
              {strengths.map((r) => (
                <li key={r.cap.id}>
                  <Chip level={r.expert} />
                  <strong>{r.cap.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>required L{r.req}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Development areas</h2>
          <p className="card-sub">Where the APEX Panel places you below the required level.</p>
          {development.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No capability sits below its required level.</p>
          ) : (
            <ul className="mini-list">
              {development.map((r) => (
                <li key={r.cap.id}>
                  <Chip level={r.expert} />
                  <strong>{r.cap.name}</strong>
                  <span className="badge badge-red">required L{r.req}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {perceptionGaps.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <h2 className="card-title">How you saw yourself vs the panel</h2>
          <p className="card-sub">
            Capabilities where your self-rating differed from the APEX Panel by a full level or more. Useful
            for a development conversation.
          </p>
          <ul className="mini-list">
            {perceptionGaps.map((r) => (
              <li key={r.cap.id}>
                <span className={`badge ${r.perception! > 0 ? "badge-amber" : "badge-gray"}`}>
                  {r.perception! > 0 ? "you rated higher" : "you rated lower"} by {Math.abs(r.perception!)}
                </span>
                <strong>{r.cap.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  you L{r.self} vs panel L{r.expert}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad">
        <h2 className="card-title">Capability detail · three lenses vs required</h2>
        <div className="legend" style={{ marginTop: 6, marginBottom: 10 }}>
          <span><span className="lens-dot ld-self" />You</span>
          <span><span className="lens-dot ld-manager" />Manager</span>
          <span><span className="lens-dot ld-expert" />APEX Panel</span>
          <span><span className="lens-dot ld-req" />Required</span>
        </div>
        <div className="hm-scroll">
          <table className="hm">
            <thead>
              <tr>
                <th className="hm-rowhead">Capability</th>
                <th><span className="lens-dot ld-self" />You</th>
                <th><span className="lens-dot ld-manager" />Manager</th>
                <th><span className="lens-dot ld-expert" />APEX</th>
                <th><span className="lens-dot ld-req" />Req</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cl) => (
                <FeedbackClusterRows key={cl.name} name={cl.name} rows={cl.rows} notes={notesByCluster.get(cl.name) ?? []} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FeedbackClusterRows({
  name,
  rows,
  notes,
}: {
  name: string;
  rows: {
    cap: { id: number; name: string };
    req: number | null;
    self?: number;
    manager?: number;
    expert?: number;
    gap: number | null;
  }[];
  notes: { lens: Lens; note: string }[];
}) {
  return (
    <>
      <tr className="cluster-row">
        <td colSpan={5}>{name}</td>
      </tr>
      {rows.map((r) => (
        <tr key={r.cap.id}>
          <th className="hm-rowhead">{r.cap.name}</th>
          <td className="cell" style={{ minWidth: 64 }}><Chip level={r.self} /></td>
          <td className="cell" style={{ minWidth: 64 }}><Chip level={r.manager} /></td>
          <td className={`cell ${r.req == null ? "hm-na" : gapClass(r.gap)}`} style={{ minWidth: 64 }}>
            {r.req == null ? "n/a" : <Chip level={r.expert} />}
          </td>
          <td className="cell" style={{ minWidth: 56, color: "var(--muted)" }}>{r.req == null ? "n/a" : `L${r.req}`}</td>
        </tr>
      ))}
      {notes.length > 0 && (
        <tr>
          <td colSpan={5} style={{ padding: "2px 8px 12px" }}>
            {notes.map((n, i) => (
              <div key={i} className="theme-note-block">
                <span className="theme-note-lens">{LENS_LABELS[n.lens]}</span>
                {n.note}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Assessment</div>
        <h1 className="page-title">{title}</h1>
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import {
  getAM,
  getAssessment,
  listCapabilities,
  requiredLevel,
  submittedLevels,
  submittedNotes,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, type Lens } from "@/lib/seed-data";
import { gapClass } from "@/lib/heat";
import { reopen } from "./actions";

function Chip({ level }: { level: number | null | undefined }) {
  return (
    <span className={`lvl-chip ${level ? `lvl-${level}` : "lvl-none"}`}>{level ? `L${level}` : "—"}</span>
  );
}

export default async function AmAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const am = getAM(Number(id));
  if (!am) notFound();

  const caps = listCapabilities();
  const levels = submittedLevels(am.id);
  const notes = submittedNotes(am.id);
  const capById = new Map(caps.map((c) => [c.id, c]));

  type Row = {
    cap: (typeof caps)[number];
    req: number | null;
    self?: number;
    manager?: number;
    expert?: number;
    gap: number | null; // expert - required
    perception: number | null; // self - expert
  };

  const rows: Row[] = caps.map((cap) => {
    const req = requiredLevel(cap, am.track);
    const self = levels.self.get(cap.id);
    const manager = levels.manager.get(cap.id);
    const expert = levels.expert.get(cap.id);
    return {
      cap,
      req,
      self,
      manager,
      expert,
      gap: req != null && expert != null ? expert - req : null,
      perception: self != null && expert != null ? self - expert : null,
    };
  });

  const applicable = rows.filter((r) => r.req != null);
  const strengths = applicable
    .filter((r) => r.gap != null && r.gap >= 0 && r.expert != null)
    .sort((a, b) => b.gap! - a.gap! || b.expert! - a.expert!)
    .slice(0, 5);
  const development = applicable
    .filter((r) => r.gap != null && r.gap < 0)
    .sort((a, b) => a.gap! - b.gap!)
    .slice(0, 5);
  const perceptionGaps = rows
    .filter((r) => r.perception != null && Math.abs(r.perception) >= 1)
    .sort((a, b) => Math.abs(b.perception!) - Math.abs(a.perception!));

  const lensStatus = LENSES.map((lens) => ({ lens, a: getAssessment(am.id, lens) }));

  // group rows per cluster
  const clusters: { name: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cap.cluster) clusters.push({ name: row.cap.cluster, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">
          <Link href="/analysis/individuals" style={{ color: "inherit" }}>Individual analysis</Link>
        </div>
        <h1 className="page-title">{am.name}</h1>
        <div className="am-meta" style={{ marginTop: 6 }}>
          <span className="badge badge-zone">{am.zone}</span>
          <span className="badge badge-track">{am.track} track</span>
          <span className="badge badge-gray">{am.account}</span>
          {lensStatus.map(({ lens, a }) => (
            <span key={lens} className={`badge ${a?.status === "submitted" ? "badge-green" : "badge-gray"}`}>
              {LENS_LABELS[lens]}: {a?.status === "submitted" ? "✓" : "pending"}
            </span>
          ))}
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <h2 className="card-title">Strengths</h2>
          <p className="card-sub">APEX Panel at or above the required level.</p>
          {strengths.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No submitted panel data yet.</p>
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
          <p className="card-sub">APEX Panel below the required level — feed these into the development plan.</p>
          {development.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
              {levels.expert.size === 0 ? "No submitted panel data yet." : "No capability below target. 🎉"}
            </p>
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
          <h2 className="card-title">Perception gaps</h2>
          <p className="card-sub">Self-assessment differs from the APEX Panel by a full level or more — worth a conversation.</p>
          <ul className="mini-list">
            {perceptionGaps.map((r) => (
              <li key={r.cap.id}>
                <span className={`badge ${r.perception! > 0 ? "badge-amber" : "badge-gray"}`}>
                  {r.perception! > 0 ? "overrates" : "underrates"} {Math.abs(r.perception!)}
                </span>
                <strong>{r.cap.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  self L{r.self} vs panel L{r.expert}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Capability detail · three lenses vs required</h2>
        <div className="legend" style={{ marginTop: 0, marginBottom: 12 }}>
          <span><span className="lens-dot ld-self" />Self</span>
          <span><span className="lens-dot ld-manager" />Manager</span>
          <span><span className="lens-dot ld-expert" />APEX Panel</span>
          <span><span className="lens-dot ld-req" />Required</span>
        </div>
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Capability</th>
                <th>Required</th>
                <th><span className="lens-dot ld-self" />Self</th>
                <th><span className="lens-dot ld-manager" />Manager</th>
                <th><span className="lens-dot ld-expert" />APEX</th>
                <th>Gap vs req</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cl) => (
                <ClusterSection key={cl.name} name={cl.name} rows={cl.rows} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <h2 className="card-title">Evidence & observations</h2>
          <p className="card-sub">Notes captured by evaluators during assessment.</p>
          {notes.map((n, i) => (
            <div key={i} className="note-block">
              <span className="note-cap">{capById.get(n.capability_id)?.name}</span>
              <span className="note-lens">{LENS_LABELS[n.lens as Lens]}</span>
              <div className="note-text">{n.note}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card card-pad">
        <h2 className="card-title">Administration</h2>
        <p className="card-sub">Reopen a submitted assessment to allow the evaluator to revise it.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {lensStatus.map(({ lens, a }) => (
            <form key={lens} action={reopen.bind(null, am.id, lens)}>
              <button className="btn btn-sm btn-outline" disabled={a?.status !== "submitted"} type="submit">
                Reopen {LENS_LABELS[lens]}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClusterSection({
  name,
  rows,
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
}) {
  return (
    <>
      <tr>
        <td colSpan={6} style={{ paddingTop: 14 }}>
          <span className="cluster-kicker">{name}</span>
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.cap.id}>
          <td style={{ fontWeight: 550 }}>{r.cap.name}</td>
          <td>
            {r.req == null ? (
              <span className="badge badge-gray">n/a for track</span>
            ) : (
              <span className="badge badge-lens">L{r.req}</span>
            )}
          </td>
          <td><Chip level={r.self} /></td>
          <td><Chip level={r.manager} /></td>
          <td><Chip level={r.expert} /></td>
          <td>
            {r.gap == null ? (
              <span style={{ color: "var(--muted)" }}>—</span>
            ) : (
              <span className={`lvl-chip ${gapClass(r.gap)}`} style={{ minWidth: 40 }}>
                {r.gap > 0 ? `+${r.gap}` : r.gap}
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

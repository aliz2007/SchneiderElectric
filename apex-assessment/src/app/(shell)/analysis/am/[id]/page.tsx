import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import {
  averageRequired,
  averageWeighted,
  formatScheduleDate,
  getAM,
  getAssessment,
  ratersByLens,
  scoredRows,
  submittedLevels,
  submittedThemeNotes,
  themeJustificationText,
  type ScoredRow,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, WEIGHTS_LABEL, type Lens } from "@/lib/seed-data";
import { fmt, gapClass } from "@/lib/heat";
import { aiNarrativeEnabled } from "@/lib/ai-narrative";
import { reopen } from "./actions";
import ExportPdfButton from "./export-pdf-button";
import ScheduleEditor from "./schedule-editor";
import AccountEditor from "./account-editor";
import ThemeRadar, { type RadarTheme } from "./theme-radar";

function Chip({ level }: { level: number | null | undefined }) {
  return (
    <span className={`lvl-chip ${level ? `lvl-${level}` : "lvl-none"}`}>{level ? `L${level}` : "n/a"}</span>
  );
}

/** The weighted score, shown as a decimal and coloured by its gap to required. */
function ScoreChip({ score, gap }: { score: number | null; gap: number | null }) {
  if (score == null) return <span className="lvl-chip lvl-none">n/a</span>;
  return (
    <span className={`lvl-chip ${gapClass(gap)}`} style={{ minWidth: 44, fontVariantNumeric: "tabular-nums" }}>
      {fmt(score, 1)}
    </span>
  );
}

export default async function AmAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const am = getAM(Number(id));
  if (!am) notFound();

  const levels = submittedLevels(am.id);

  // Theme notes (Self / Manager / APEX Panel) grouped by cluster, shown inside the
  // capability detail so each theme's commentary sits with its ratings.
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

  // Weighted score (Self 20% / APEX Panel 35% / Manager 45%) is the canonical figure:
  // gaps, strengths and development areas are all derived from it.
  type Row = ScoredRow;
  const rows: Row[] = scoredRows(am.id, am.track);

  const applicable = rows.filter((r) => r.req != null);
  // Strength = strictly ABOVE the required level. At-level is on the baseline, not a
  // strength. Development = every capability BELOW required (all of them, uncapped).
  const strengths = applicable
    .filter((r) => r.gap != null && r.gap > 0)
    .sort((a, b) => b.gap! - a.gap!);
  const development = applicable
    .filter((r) => r.gap != null && r.gap < 0)
    .sort((a, b) => a.gap! - b.gap!);
  const perceptionGaps = rows
    .filter((r) => r.perception != null && Math.abs(r.perception) >= 1)
    .sort((a, b) => Math.abs(b.perception!) - Math.abs(a.perception!));

  const overallWeighted = averageWeighted(applicable);
  const overallRequired = averageRequired(applicable);
  const hasAnyScores = rows.some((r) => r.weighted != null);

  const raters = ratersByLens(am.id);
  const lensStatus = LENSES.map((lens) => ({ lens, a: getAssessment(am.id, lens), rater: raters[lens] }));

  // group rows per cluster
  const clusters: { name: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cap.cluster) clusters.push({ name: row.cap.cluster, rows: [row] });
    else last.rows.push(row);
  }

  // One radar point per cluster: the mean of each lens, the weighted score, and the level
  // the track expects (the benchmark web).
  //
  // Only clusters that APPLY to this AM's track are plotted. An Acquisition AM has no
  // required level anywhere in Saturation Excellence (and vice versa), so that axis would
  // drag the expected web to the centre; those capabilities are also excluded from the
  // final score, so plotting them here would contradict the number next to the chart.
  const themeRadar: RadarTheme[] = clusters
    .filter((cl) => cl.rows.some((r) => r.req != null))
    .map((cl) => {
      const mean = (pick: (r: Row) => number | null | undefined) => {
        const vals = cl.rows.map(pick).filter((v): v is number => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      return {
        theme: cl.name,
        self: mean((r) => r.self),
        manager: mean((r) => r.manager),
        expert: mean((r) => r.expert),
        weighted: mean((r) => r.weighted),
        required: mean((r) => r.req),
      };
    });
  const overallGap =
    overallWeighted == null || overallRequired == null ? null : overallWeighted - overallRequired;

  return (
    <div>
      <div className="page-head">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div className="page-kicker">
              <Link href="/analysis/individuals" style={{ color: "inherit" }}>Individual analysis</Link>
            </div>
            <h1 className="page-title">{am.name}</h1>
          </div>
          <ExportPdfButton
            amId={am.id}
            amName={am.name}
            aiActive={aiNarrativeEnabled() && levels.expert.size > 0}
          />
        </div>
        <div className="am-meta" style={{ marginTop: 6 }}>
          <span className="badge badge-zone">{am.zone}</span>
          <span className="badge badge-track">{am.track} track</span>
          {am.segment && <span className="badge badge-segment">{am.segment}</span>}
          {am.account_type && <span className="badge badge-gray">{am.account_type}</span>}
          <span className="badge badge-gray">{am.account}</span>
          {lensStatus.map(({ lens, a, rater }) => (
            <span key={lens} className={`badge ${a?.status === "submitted" ? "badge-green" : "badge-gray"}`}>
              {LENS_LABELS[lens]}: {a?.status === "submitted" ? "✓" : "pending"}
              {rater ? ` · by ${rater}` : ""}
            </span>
          ))}
        </div>
        <div className="am-meta" style={{ marginTop: 10, alignItems: "center" }}>
          <ScheduleEditor
            amId={am.id}
            selfDeadline={am.self_deadline}
            managerDeadline={am.manager_deadline}
            panelDatetime={am.panel_datetime}
          />
          <AccountEditor amId={am.id} accountType={am.account_type} perfYtd={am.perf_ytd} />
          {am.self_deadline && (
            <span className="badge badge-sched">Self deadline · {formatScheduleDate(am.self_deadline)}</span>
          )}
          {am.manager_deadline && (
            <span className="badge badge-sched">Manager deadline · {formatScheduleDate(am.manager_deadline)}</span>
          )}
          {am.panel_datetime && (
            <span className="badge badge-sched">Panel call · {formatScheduleDate(am.panel_datetime, true)}</span>
          )}
        </div>
      </div>

      {/* Overall standing first: the number, its benchmark, and the shape of the profile.
          Everything below is the detail behind these two things. */}
      <div className="card card-pad standing-card" style={{ marginBottom: 20 }}>
        <div className="standing-score">
          <div className="kpi-label">Final score</div>
          <div className={`standing-value ${gapClass(overallGap)}`}>
            {overallWeighted == null ? "n/a" : fmt(overallWeighted, 2)}
            <span className="standing-outof">/3</span>
          </div>
          <div className="standing-vs">
            {overallRequired == null
              ? "No expected level for this track yet"
              : <>vs <strong>{fmt(overallRequired, 2)}</strong> average score expected</>}
          </div>
          {overallGap != null && (
            <span className={`lvl-chip ${gapClass(overallGap)}`} style={{ marginTop: 10, minWidth: 64 }}>
              {overallGap > 0 ? `+${fmt(overallGap, 2)}` : fmt(overallGap, 2)}
            </span>
          )}
          <p className="standing-note">{WEIGHTS_LABEL}</p>
        </div>
        <div className="standing-radar">
          {hasAnyScores ? (
            <ThemeRadar data={themeRadar} />
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 13.5, margin: 0 }}>
              The profile chart appears once an assessment has been submitted.
            </p>
          )}
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <h2 className="card-title">Strengths</h2>
          <p className="card-sub">Weighted score above the required level.</p>
          {strengths.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
              {hasAnyScores
                ? "No capability above the required level. The weighted score sits at or below the baseline throughout."
                : "No submitted assessments yet."}
            </p>
          ) : (
            <ul className="mini-list">
              {strengths.map((r) => (
                <li key={r.cap.id}>
                  <ScoreChip score={r.weighted} gap={r.gap} />
                  <strong>{r.cap.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 12.5 }}>required L{r.req}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Development areas</h2>
          <p className="card-sub">Weighted score below the required level. Feed these into the development plan.</p>
          {development.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 13.5 }}>
              {hasAnyScores ? "No capability below target." : "No submitted assessments yet."}
            </p>
          ) : (
            <ul className="mini-list">
              {development.map((r) => (
                <li key={r.cap.id}>
                  <ScoreChip score={r.weighted} gap={r.gap} />
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
          <p className="card-sub">Self-assessment differs from the weighted score by a full level or more, worth a conversation.</p>
          <ul className="mini-list">
            {perceptionGaps.map((r) => (
              <li key={r.cap.id}>
                <span className={`badge ${r.perception! > 0 ? "badge-amber" : "badge-gray"}`}>
                  {r.perception! > 0 ? "overrates" : "underrates"} {fmt(Math.abs(r.perception!), 1)}
                </span>
                <strong>{r.cap.name}</strong>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  self L{r.self} vs weighted {fmt(r.weighted, 1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <h2 className="card-title">Capability detail · three lenses, weighted vs required</h2>
        <p className="card-sub" style={{ marginTop: -2, marginBottom: 10 }}>
          Weighted score = {WEIGHTS_LABEL}. Justifications appear under each cluster.
          {overallWeighted != null && overallRequired != null && (
            <>
              {" "}Overall <strong>{fmt(overallWeighted, 2)}</strong> vs expected{" "}
              <strong>{fmt(overallRequired, 2)}</strong>.
            </>
          )}
        </p>
        {/* No legend strip above this table. The column headers below already carry the
            same dot and the same label, so a legend here says everything twice and pushes
            the first row of data further down the page. The dots ARE the legend. */}
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Capability</th>
                <th><span className="lens-dot ld-req" />Required</th>
                <th><span className="lens-dot ld-self" />Self</th>
                <th><span className="lens-dot ld-manager" />Manager</th>
                <th><span className="lens-dot ld-expert" />Panel</th>
                <th>Weighted</th>
                <th>Gap vs req</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cl) => (
                <ClusterSection
                  key={cl.name}
                  name={cl.name}
                  rows={cl.rows}
                  notes={notesByCluster.get(cl.name) ?? []}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
  notes,
}: {
  name: string;
  rows: ScoredRow[];
  notes: { lens: Lens; note: string }[];
}) {
  // the cluster's own standing, so the six themes can be compared without adding up
  // 22 rows by eye. Averaged over the capabilities that apply to this AM's track.
  const applicable = rows.filter((r) => r.req != null);
  const clusterWeighted = averageWeighted(applicable);
  const clusterRequired = averageRequired(applicable);
  const clusterGap =
    clusterWeighted == null || clusterRequired == null ? null : clusterWeighted - clusterRequired;
  return (
    <>
      <tr>
        <td colSpan={2} style={{ paddingTop: 14 }}>
          <span className="cluster-kicker">{name}</span>
        </td>
        <td colSpan={3} style={{ paddingTop: 14 }}>
          <span className="cluster-avg-label">
            cluster average{clusterRequired == null ? "" : ` · expected ${fmt(clusterRequired, 2)}`}
          </span>
        </td>
        <td style={{ paddingTop: 14 }}>
          {clusterWeighted == null ? (
            <span style={{ color: "var(--muted)" }}>n/a</span>
          ) : (
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(clusterWeighted, 2)}</strong>
          )}
        </td>
        <td style={{ paddingTop: 14 }}>
          {clusterGap == null ? (
            <span style={{ color: "var(--muted)" }}>n/a</span>
          ) : (
            <span
              className={`lvl-chip ${gapClass(clusterGap)}`}
              style={{ minWidth: 46, fontVariantNumeric: "tabular-nums" }}
            >
              {clusterGap > 0 ? `+${fmt(clusterGap, 2)}` : fmt(clusterGap, 2)}
            </span>
          )}
        </td>
      </tr>
      {notes.length > 0 && (
        <tr>
          <td colSpan={7} style={{ paddingTop: 0, paddingBottom: 4 }}>
            {notes.map((n, i) => (
              <div key={i} className="theme-note-block">
                <span className="note-lens">{LENS_LABELS[n.lens]}</span>
                <div className="note-text">{n.note}</div>
              </div>
            ))}
          </td>
        </tr>
      )}
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
            {/* weighted, unrounded — 1.6 and 2.4 must NOT read as the same level */}
            {r.weighted == null ? (
              <span style={{ color: "var(--muted)" }}>n/a</span>
            ) : (
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.weighted, 2)}</strong>
            )}
          </td>
          <td>
            {r.gap == null ? (
              <span style={{ color: "var(--muted)" }}>n/a</span>
            ) : (
              <span
                className={`lvl-chip ${gapClass(r.gap)}`}
                style={{ minWidth: 46, fontVariantNumeric: "tabular-nums" }}
              >
                {r.gap > 0 ? `+${fmt(r.gap, 2)}` : fmt(r.gap, 2)}
              </span>
            )}
          </td>
        </tr>
      ))}
    </>
  );
}

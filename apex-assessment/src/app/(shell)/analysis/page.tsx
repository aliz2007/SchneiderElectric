import Link from "next/link";
import { requireSuperadmin } from "@/lib/session";
import {
  assessmentStatuses,
  listAMs,
  overviewStats,
  trainingPriorities,
  zoneHeatmap,
} from "@/lib/queries";
import { gapClass, fmt } from "@/lib/heat";
import { ZONES } from "@/lib/seed-data";
import ZoneMap, { type ZoneMapStat } from "./zone-map";

export default async function AnalysisPage() {
  await requireSuperadmin();

  const stats = overviewStats();
  const { zones, rows } = zoneHeatmap();
  const priorities = trainingPriorities(6);
  const statuses = assessmentStatuses();
  const ams = listAMs();

  const submittedTotal = stats.byLens.self + stats.byLens.manager + stats.byLens.expert;
  const completionPct = Math.round((submittedTotal / (stats.amCount * 3)) * 100);

  // per-zone roll-up for the geographic map
  const zoneMapStats: ZoneMapStat[] = zones.map((zone, zi) => {
    const cells = rows.map((r) => ({ cap: r.cap.name, cell: r.cells[zi] }));
    const scored = cells.filter((c) => c.cell.avgScore != null);
    const gapped = cells.filter((c) => c.cell.gap != null);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const worstRow = gapped.reduce<{ cap: string; gap: number } | null>((worst, c) => {
      const g = c.cell.gap!;
      return g < 0 && (!worst || g < worst.gap) ? { cap: c.cap, gap: g } : worst;
    }, null);
    return {
      zone: zone as ZoneMapStat["zone"],
      ams: ams.filter((am) => am.zone === zone).length,
      avgScore: mean(scored.map((c) => c.cell.avgScore!)),
      avgReq: mean(scored.map((c) => c.cell.avgReq!)),
      gap: mean(gapped.map((c) => c.cell.gap!)),
      worst: worstRow,
    };
  });

  // group heat map rows by cluster for readable sections
  const clusters: { name: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cap.cluster) clusters.push({ name: row.cap.cluster, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Analysis</div>
        <h1 className="page-title">Capability Dashboard</h1>
        <p className="page-sub">
          APEX Panel results vs required levels across the TOP 25. Red cells indicate collective
          capability deficits — that is where targeted training programs should go.
        </p>
      </div>

      <div className="grid grid-kpi" style={{ marginBottom: 22 }}>
        <div className="card kpi">
          <div className="kpi-label">Campaign completion</div>
          <div className="kpi-value">{completionPct}%</div>
          <div className="kpi-note">
            {submittedTotal} / {stats.amCount * 3} assessments submitted
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Self submitted</div>
          <div className="kpi-value">
            {stats.byLens.self}
            <span style={{ fontSize: 16, color: "var(--muted)" }}> / {stats.amCount}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Manager submitted</div>
          <div className="kpi-value">
            {stats.byLens.manager}
            <span style={{ fontSize: 16, color: "var(--muted)" }}> / {stats.amCount}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">APEX Panel submitted</div>
          <div className="kpi-value">
            {stats.byLens.expert}
            <span style={{ fontSize: 16, color: "var(--muted)" }}> / {stats.amCount}</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Avg APEX maturity</div>
          <div className="kpi-value">{fmt(stats.avgExpert, 2)}</div>
          <div className="kpi-note">scale 1–3 · submitted panel scores</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Zone performance map</h2>
        <p className="card-sub">
          Each zone is coloured by its average APEX Panel score vs required level. Hover for
          details, click a zone to open its benchmark.
        </p>
        <ZoneMap zones={zoneMapStats} />
      </div>

      {priorities.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <h2 className="card-title">Recommended training focus</h2>
          <p className="card-sub">Largest zone-level deficits (APEX Panel score vs required level).</p>
          <ul className="mini-list">
            {priorities.map((p, i) => (
              <li key={i}>
                <span className={`lvl-chip ${gapClass(p.cell.gap)}`} style={{ minWidth: 52 }}>
                  {fmt(p.cell.gap, 2)}
                </span>
                <strong>{p.cap.name}</strong>
                <span className="badge badge-zone">{p.zone}</span>
                <span style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  avg {fmt(p.cell.avgScore)} vs required {fmt(p.cell.avgReq)} · {p.cell.n} AM{p.cell.n > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Training-needs heat map · capability × zone</h2>
        <p className="card-sub">
          Cell = average APEX Panel score for the zone (gap to required level drives the colour).
          Click a zone header for its detailed view.
        </p>
        <div className="hm-scroll">
          <table className="hm">
            <thead>
              <tr>
                <th className="hm-rowhead">Capability</th>
                {zones.map((z) => (
                  <th key={z}>
                    <Link href={`/analysis/zone/${z}`} style={{ color: "var(--blue)" }}>
                      {z}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clusters.map((cl) => (
                <ClusterRows key={cl.name} cluster={cl} zoneCount={zones.length} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span><span className="sw" style={{ background: "#c9f5d3" }} />At / above required</span>
          <span><span className="sw" style={{ background: "#ffefb8" }} />Slightly below (&lt; 0.5)</span>
          <span><span className="sw" style={{ background: "#ffd9ad" }} />Below (0.5 – 1)</span>
          <span><span className="sw" style={{ background: "#ffccc6" }} />Critical gap (&gt; 1)</span>
          <span><span className="sw" style={{ background: "#eef1f6" }} />No data / not applicable</span>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">TOP 25 roster</h2>
        <p className="card-sub">Assessment progress per lens. Open an Account Manager for the individual analysis.</p>
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Account Manager</th>
                <th>Zone</th>
                <th>Track</th>
                <th>Self</th>
                <th>Manager</th>
                <th>APEX Panel</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ams.map((am) => {
                const st = statuses.get(am.id)!;
                return (
                  <tr key={am.id} className="rowlink">
                    <td style={{ fontWeight: 600 }}>{am.name}</td>
                    <td><span className="badge badge-zone">{am.zone}</span></td>
                    <td><span className="badge badge-track">{am.track}</span></td>
                    {(["self", "manager", "expert"] as const).map((lens) => {
                      const s = st[lens];
                      return (
                        <td key={lens}>
                          {s.status === "submitted" ? (
                            <span className="badge badge-green">✓ Done</span>
                          ) : s.status === "draft" ? (
                            <span className="badge badge-amber">{s.rated}/22</span>
                          ) : (
                            <span className="badge badge-gray">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <Link className="btn btn-sm btn-outline" href={`/analysis/am/${am.id}`}>
                        Analysis →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ClusterRows({
  cluster,
  zoneCount,
}: {
  cluster: { name: string; rows: { cap: { id: number; name: string }; cells: { avgScore: number | null; avgReq: number | null; gap: number | null; n: number }[] }[] };
  zoneCount: number;
}) {
  return (
    <>
      <tr className="cluster-row">
        <td colSpan={zoneCount + 1}>{cluster.name}</td>
      </tr>
      {cluster.rows.map((row) => (
        <tr key={row.cap.id}>
          <th className="hm-rowhead">{row.cap.name}</th>
          {row.cells.map((cell, i) => (
            <td key={i} className={`cell ${gapClass(cell.gap)}`} title={cell.n ? `${cell.n} AM(s) · required ~${fmt(cell.avgReq)}` : "No submitted panel data"}>
              {cell.avgScore == null ? "—" : (
                <>
                  {fmt(cell.avgScore)}
                  <small>req {fmt(cell.avgReq)}</small>
                </>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

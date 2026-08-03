import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  assessmentStatuses,
  listAMs,
  listCapabilities,
  formatScheduleDate,
  overviewStats,
  weightedLevels,
  trainingPriorities,
  zoneHeatmap,
} from "@/lib/queries";
import { gapClass, fmt } from "@/lib/heat";
import { SEGMENTS, WEIGHTS_LABEL, ZONES } from "@/lib/seed-data";
import ZoneMap, { type MapAM, type MapCap } from "./zone-map";
import FilterBar from "./filter-bar";
import ScheduleTimeline, { type TimelineEntry } from "./schedule-timeline";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; segment?: string; cap?: string }>;
}) {
  // the aggregated dashboard is open to every signed-in user; drill-down into
  // individual ratings stays superadmin-only
  const user = await requireUser();
  const isAdmin = user.role === "superadmin";

  // Centralized filters (see FilterBar) — the track, segment and map-capability
  // URL params scope every analytics view at once.
  const { track: trackRaw, segment: segmentRaw, cap: capRaw } = await searchParams;
  const track = trackRaw === "Acquisition" || trackRaw === "Saturation" ? trackRaw : undefined;
  const segment = segmentRaw && (SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : undefined;
  const selectedCapId = capRaw && /^\d+$/.test(capRaw) ? Number(capRaw) : null;

  const stats = overviewStats();
  const { zones, rows } = zoneHeatmap(track, segment);
  const priorities = trainingPriorities(6, track, segment);
  const statuses = assessmentStatuses();
  const ams = listAMs().filter((am) => (!track || am.track === track) && (!segment || am.segment === segment));
  const capOptions = listCapabilities().map((c) => ({ id: c.id, name: c.name, cluster: c.cluster }));

  // the deck honours whatever the dashboard is filtered to
  const reportParams = new URLSearchParams();
  if (track) reportParams.set("track", track);
  if (segment) reportParams.set("segment", segment);
  const reportQuery = reportParams.toString() ? `?${reportParams.toString()}` : "";

  const maturityGap =
    stats.avgWeighted == null || stats.avgRequired == null ? null : stats.avgWeighted - stats.avgRequired;
  const submittedTotal = stats.byLens.self + stats.byLens.manager + stats.byLens.expert;
  const completionPct = Math.round((submittedTotal / (stats.amCount * 3)) * 100);

  // Raw per-AM panel scores + required levels for the thermal map. These are
  // individual results, so they are built and sent to the client ONLY for
  // superadmins; assessors get the aggregated views below, never this payload.
  const mapCaps: MapCap[] = isAdmin
    ? listCapabilities().map((c) => ({
        id: c.id,
        name: c.name,
        cluster: c.cluster,
        reqAcq: c.req_acq,
        reqSat: c.req_sat,
      }))
    : [];
  const mapAMs: MapAM[] = isAdmin
    ? ams.map((am) => ({
        id: am.id,
        code: am.code,
        name: am.name,
        zone: am.zone as MapAM["zone"],
        track: am.track,
        scores: Object.fromEntries(weightedLevels(am.id)),
      }))
    : [];

  // group heat map rows by cluster for readable sections
  const clusters: { name: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cap.cluster) clusters.push({ name: row.cap.cluster, rows: [row] });
    else last.rows.push(row);
  }

  // every scheduled date across the roster, for the campaign timeline
  const now = Date.now();
  const timeline: TimelineEntry[] = [];
  for (const am of ams) {
    const st = statuses.get(am.id)!;
    const add = (lens: "Manager" | "Panel", value: string | null, withTime: boolean, submitted: boolean) => {
      if (!value) return;
      const when = new Date(`${value.slice(0, 10)}T23:59:59.999`).getTime();
      if (Number.isNaN(when)) return;
      timeline.push({
        amId: am.id,
        amName: am.name,
        lens,
        value,
        withTime,
        state: submitted ? "done" : when < now ? "overdue" : "pending",
      });
    };
    add("Manager", am.manager_deadline, false, st.manager.status === "submitted");
    add("Panel", am.panel_datetime, true, st.expert.status === "submitted");
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Analysis</div>
        <h1 className="page-title">Capability Dashboard</h1>
        <p className="page-sub">
          Weighted results ({WEIGHTS_LABEL}) vs required levels across the TOP 25. Red cells indicate
          collective capability deficits. That is where targeted training programs should go.
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
          <div className="kpi-label">Avg weighted maturity</div>
          <div className="kpi-value">
            {stats.avgWeighted == null ? "n/a" : fmt(stats.avgWeighted, 2)}
            {stats.avgWeighted != null && (
              <span style={{ fontSize: 16, color: "var(--muted)" }}> / 3</span>
            )}
          </div>
          {/* the score on its own says nothing; the expected average and the gap are what
              make it readable as good or bad */}
          {stats.avgRequired != null && (
            <div className="kpi-bench">
              vs <strong>{fmt(stats.avgRequired, 2)}</strong> expected
              {maturityGap != null && (
                <span className={`lvl-chip ${gapClass(maturityGap)} kpi-bench-chip`}>
                  {maturityGap > 0 ? `+${fmt(maturityGap, 2)}` : fmt(maturityGap, 2)}
                </span>
              )}
            </div>
          )}
          <div className="kpi-note">{stats.avgWeighted == null ? "submitted scores" : WEIGHTS_LABEL}</div>
        </div>
      </div>

      {isAdmin && (
        <div className="report-row">
          <div>
            <div className="report-title">APEX Capability Dashboard</div>
            <div className="report-sub">
              Zone, segment and track radars with the expected level, plus the biggest gaps to
              close. Downloads what the filters above are showing.
            </div>
          </div>
          <a className="btn btn-primary btn-sm" href={`/analysis/report/pdf${reportQuery}`}>
            Download PDF
          </a>
        </div>
      )}

      <div className="analytics-filter-row">
        <FilterBar
          current={{
            track: track ?? "all",
            segment: segment ?? "all",
            cap: selectedCapId ? String(selectedCapId) : "all",
          }}
          caps={capOptions}
          showCapability={isAdmin}
        />
        {(track || segment) && (
          <span className="analytics-filter-note">
            Showing {ams.length} Account Manager{ams.length === 1 ? "" : "s"}
            {track ? ` · ${track}` : ""}
            {segment ? ` · ${segment}` : ""}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="card card-pad map-card" style={{ marginBottom: 22 }}>
          <h2 className="card-title">Zone performance map</h2>
          <p className="card-sub">
            Thermal view of weighted performance vs required levels across Schneider hubs:
            blue is on target, red is a critical gap. Filter by capability, hover the hubs,
            click a zone to focus.
          </p>
          <ZoneMap ams={mapAMs} caps={mapCaps} canDrill={isAdmin} capFilter={selectedCapId} />
        </div>
      )}

      <ScheduleTimeline entries={timeline} />

      {priorities.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 22 }}>
          <h2 className="card-title">Recommended training focus</h2>
          <p className="card-sub">Largest zone-level deficits (weighted score vs required level).</p>
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
          Cell = average weighted score for the zone (gap to required level drives the colour).
          Click a zone header for its detailed view.
        </p>
        <div className="hm-scroll">
          <table className="hm">
            <thead>
              <tr>
                <th className="hm-rowhead">Capability</th>
                {zones.map((z) => (
                  <th key={z}>
                    {isAdmin ? (
                      <Link href={`/analysis/zone/${z}`} style={{ color: "var(--blue)" }}>
                        {z}
                      </Link>
                    ) : (
                      z
                    )}
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
          <span><span className="sw" style={{ background: "#3dcd58" }} />At / above required</span>
          <span><span className="sw" style={{ background: "#facc15" }} />Slightly below (&lt; 0.5)</span>
          <span><span className="sw" style={{ background: "#fb923c" }} />Below (0.5 to 1)</span>
          <span><span className="sw" style={{ background: "#f4564a" }} />Critical gap (&gt; 1)</span>
          <span><span className="sw" style={{ background: "#3a465e" }} />No data / not applicable</span>
        </div>
      </div>

      <div className="card card-pad">
        {/* the count is read from the roster, not hardcoded: "TOP 25" went stale the moment
            anyone was added or removed */}
        <h2 className="card-title">Roster · {ams.length} Account Manager{ams.length === 1 ? "" : "s"}</h2>
        <p className="card-sub">
          Where each assessment stands, per lens. A tick means submitted and locked; an amber
          count is a draft in progress out of the 22 capabilities. The dates are the manager
          deadline and the APEX Panel call, set per person on their individual page.
        </p>
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
                <th>Schedule</th>
                {isAdmin && <th></th>}
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
                            <span className="badge badge-gray">n/a</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <ScheduleCell am={am} status={st} />
                    </td>
                    {isAdmin && (
                      <td>
                        <Link className="btn btn-sm btn-outline" href={`/analysis/am/${am.id}`}>
                          Analysis →
                        </Link>
                      </td>
                    )}
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

/**
 * The assessment schedule for one person, on the roster.
 *
 * EVERY scheduled date is shown, always. An earlier version hid the date once its lens had
 * been submitted, on the theory that a past deadline is not a "next step" — but the client
 * set a schedule, looked at a roster where everything was already submitted, and saw only
 * "complete". If someone sets a date, they have to be able to find it again; the state of
 * the assessment changes how the date READS, never whether it is shown.
 *
 * done    = the assessment came in, the date is history (muted)
 * overdue = the day has passed and that lens has still not submitted (red)
 * pending = the date is ahead (normal)
 */
function ScheduleCell({
  am,
  status,
}: {
  am: { manager_deadline: string | null; panel_datetime: string | null };
  status: Record<"self" | "manager" | "expert", { status: string; rated: number }>;
}) {
  const now = Date.now();
  type Entry = { label: string; value: string; withTime: boolean; when: number; state: "done" | "overdue" | "pending" };
  const dates: Entry[] = [];
  const push = (label: string, value: string | null, withTime: boolean, submitted: boolean) => {
    if (!value) return;
    const when = new Date(`${value.slice(0, 10)}T23:59:59.999`).getTime();
    if (Number.isNaN(when)) return;
    dates.push({
      label,
      value,
      withTime,
      when,
      state: submitted ? "done" : when < now ? "overdue" : "pending",
    });
  };
  push("Manager", am.manager_deadline, false, status.manager.status === "submitted");
  push("Panel", am.panel_datetime, true, status.expert.status === "submitted");
  // what needs attention first: overdue, then what is coming up, then what is settled
  const rank = { overdue: 0, pending: 1, done: 2 };
  dates.sort((a, b) => rank[a.state] - rank[b.state] || a.when - b.when);

  // capabilities still unscored across the lenses that have started but not submitted
  const left = (["self", "manager", "expert"] as const)
    .filter((l) => status[l].status === "draft")
    .reduce((n, l) => n + (22 - status[l].rated), 0);

  if (dates.length === 0) {
    const allDone = (["self", "manager", "expert"] as const).every((l) => status[l].status === "submitted");
    return (
      <div className="sched-cell">
        <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{allDone ? "complete" : "no date set"}</span>
        {left > 0 && <span className="sched-left">{left} left to score</span>}
      </div>
    );
  }

  const badgeClass = { overdue: "badge-red", pending: "badge-sched", done: "badge-gray" };
  return (
    <div className="sched-cell">
      {dates.map((d) => (
        <span key={d.label} className={`badge ${badgeClass[d.state]}`}>
          {d.label} · {formatScheduleDate(d.value, d.withTime)}
          {d.state === "overdue" ? " · overdue" : d.state === "done" ? " · done" : ""}
        </span>
      ))}
      {left > 0 && <span className="sched-left">{left} left to score</span>}
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
              {cell.avgScore == null ? "n/a" : (
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

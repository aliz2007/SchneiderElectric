import Link from "next/link";
import { requireSuperadmin } from "@/lib/session";
import { assessmentStatuses, listAMs, submittedLevels, listCapabilities, requiredLevel } from "@/lib/queries";
import { SEGMENTS, ZONES } from "@/lib/seed-data";
import { fmt } from "@/lib/heat";
import IndividualsFilters from "./filters";

export default async function IndividualsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; zone?: string; track?: string; segment?: string }>;
}) {
  await requireSuperadmin();

  // search + Zone / Track / Segment filters, all URL-param driven (see filters.tsx)
  const { q: qRaw, zone: zoneRaw, track: trackRaw, segment: segmentRaw } = await searchParams;
  const q = (qRaw ?? "").trim().toLowerCase();
  const zone = zoneRaw && (ZONES as readonly string[]).includes(zoneRaw) ? zoneRaw : undefined;
  const track = trackRaw === "Acquisition" || trackRaw === "Saturation" ? trackRaw : undefined;
  const segment = segmentRaw && (SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : undefined;

  const allAMs = listAMs();
  const ams = allAMs.filter(
    (am) =>
      (!q || am.name.toLowerCase().includes(q) || am.account.toLowerCase().includes(q) || am.code.toLowerCase().includes(q)) &&
      (!zone || am.zone === zone) &&
      (!track || am.track === track) &&
      (!segment || am.segment === segment)
  );
  const statuses = assessmentStatuses();
  const caps = listCapabilities();
  const filtered = ams.length !== allAMs.length;

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Analysis</div>
        <h1 className="page-title">Individual Results</h1>
        <p className="page-sub">
          Per-person comparison of the three assessment lenses, perception gaps, strengths and
          development areas.
        </p>
      </div>

      <IndividualsFilters
        current={{ q: qRaw ?? "", zone: zone ?? "all", track: track ?? "all", segment: segment ?? "all" }}
      />
      {filtered && (
        <p className="analytics-filter-note" style={{ marginTop: -6, marginBottom: 12 }}>
          Showing {ams.length} of {allAMs.length} Account Managers
        </p>
      )}

      <div className="card card-pad">
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Account Manager</th>
                <th>Zone</th>
                <th>Track</th>
                <th>Segment</th>
                <th>Self avg</th>
                <th>Mgr avg</th>
                <th>APEX avg</th>
                <th>Below target</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ams.map((am) => {
                const st = statuses.get(am.id)!;
                const levels = submittedLevels(am.id);
                const avg = (m: Map<number, number>) =>
                  m.size === 0 ? null : [...m.values()].reduce((a, b) => a + b, 0) / m.size;
                let below = 0;
                for (const cap of caps) {
                  const req = requiredLevel(cap, am.track);
                  const score = levels.expert.get(cap.id);
                  if (req != null && score != null && score < req) below++;
                }
                return (
                  <tr key={am.id} className="rowlink">
                    <td style={{ fontWeight: 600 }}>{am.name}</td>
                    <td><span className="badge badge-zone">{am.zone}</span></td>
                    <td><span className="badge badge-track">{am.track}</span></td>
                    <td>{am.segment ? <span className="badge badge-segment">{am.segment}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td>{fmt(avg(levels.self), 2)}</td>
                    <td>{fmt(avg(levels.manager), 2)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(avg(levels.expert), 2)}</td>
                    <td>
                      {st.expert.status !== "submitted" ? (
                        <span className="badge badge-gray">awaiting panel</span>
                      ) : below === 0 ? (
                        <span className="badge badge-green">0 gaps</span>
                      ) : (
                        <span className="badge badge-red">{below} capabilities</span>
                      )}
                    </td>
                    <td>
                      <Link className="btn btn-sm btn-outline" href={`/analysis/am/${am.id}`}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ams.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "14px 2px 4px" }}>
            No Account Manager matches these filters.
          </p>
        )}
      </div>
    </div>
  );
}

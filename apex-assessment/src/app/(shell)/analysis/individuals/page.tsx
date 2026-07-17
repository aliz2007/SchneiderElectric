import Link from "next/link";
import { requireSuperadmin } from "@/lib/session";
import { assessmentStatuses, listAMs, submittedLevels, listCapabilities, requiredLevel } from "@/lib/queries";
import { fmt } from "@/lib/heat";

export default async function IndividualsPage() {
  await requireSuperadmin();
  const ams = listAMs();
  const statuses = assessmentStatuses();
  const caps = listCapabilities();

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

      <div className="card card-pad">
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Account Manager</th>
                <th>Zone</th>
                <th>Track</th>
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
      </div>
    </div>
  );
}

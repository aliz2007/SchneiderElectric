import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import { listAMs, listCapabilities, requiredLevel, submittedLevels } from "@/lib/queries";
import { ZONES } from "@/lib/seed-data";
import { gapClass, fmt } from "@/lib/heat";

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  await requireSuperadmin();
  const { zone: zoneRaw } = await params;
  const zone = decodeURIComponent(zoneRaw);
  if (!(ZONES as readonly string[]).includes(zone)) notFound();

  const ams = listAMs().filter((am) => am.zone === zone);
  const caps = listCapabilities();
  const levels = new Map(ams.map((am) => [am.id, submittedLevels(am.id).expert]));

  // group per cluster
  const clusters: { name: string; caps: typeof caps }[] = [];
  for (const cap of caps) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== cap.cluster) clusters.push({ name: cap.cluster, caps: [cap] });
    else last.caps.push(cap);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">
          <Link href="/analysis" style={{ color: "inherit" }}>← Dashboard</Link>
        </div>
        <h1 className="page-title">Zone benchmark · {zone}</h1>
        <p className="page-sub">
          APEX Panel scores per Account Manager, coloured against each AM&apos;s required level
          (track-aware). The right column is the zone average.
        </p>
      </div>

      <div className="card card-pad">
        <div className="hm-scroll">
          <table className="hm">
            <thead>
              <tr>
                <th className="hm-rowhead">Capability</th>
                {ams.map((am) => (
                  <th key={am.id} title={`${am.account} · ${am.track}`}>
                    <Link href={`/analysis/am/${am.id}`} style={{ color: "var(--blue)" }}>
                      {am.code}
                    </Link>
                  </th>
                ))}
                <th>Zone avg</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cl) => (
                <ZoneClusterRows key={cl.name} name={cl.name} caps={cl.caps} ams={ams} levels={levels} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span><span className="sw" style={{ background: "#c9f5d3" }} />At / above required</span>
          <span><span className="sw" style={{ background: "#ffd9ad" }} />Below required</span>
          <span><span className="sw" style={{ background: "#ffccc6" }} />2+ levels below</span>
          <span><span className="sw" style={{ background: "#eef1f6" }} />No data / not applicable to track</span>
        </div>
      </div>
    </div>
  );
}

function ZoneClusterRows({
  name,
  caps,
  ams,
  levels,
}: {
  name: string;
  caps: ReturnType<typeof listCapabilities>;
  ams: ReturnType<typeof listAMs>;
  levels: Map<number, Map<number, number>>;
}) {
  return (
    <>
      <tr className="cluster-row">
        <td colSpan={ams.length + 2}>{name}</td>
      </tr>
      {caps.map((cap) => {
        const vals: number[] = [];
        return (
          <tr key={cap.id}>
            <th className="hm-rowhead">{cap.name}</th>
            {ams.map((am) => {
              const req = requiredLevel(cap, am.track);
              const score = levels.get(am.id)?.get(cap.id);
              if (req != null && score != null) vals.push(score);
              const gap = req == null || score == null ? null : score - req;
              const cls = req == null ? "hm-na" : gapClass(gap);
              return (
                <td key={am.id} className={`cell ${cls}`} title={req == null ? "Not applicable to this AM's track" : score == null ? "No submitted panel score" : `score L${score} · required L${req}`}>
                  {req == null ? "n/a" : score == null ? "—" : `L${score}`}
                </td>
              );
            })}
            <td className="cell hm-na" style={{ background: "#e9edf2", color: "var(--ink-2)" }}>
              {vals.length === 0 ? "—" : fmt(vals.reduce((a, b) => a + b, 0) / vals.length)}
            </td>
          </tr>
        );
      })}
    </>
  );
}

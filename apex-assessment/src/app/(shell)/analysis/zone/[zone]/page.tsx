import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import { listAMs, listCapabilities, weightedLevels } from "@/lib/queries";
import { ZONES } from "@/lib/seed-data";
import ZoneTable, { type ZoneAM, type ZoneCap } from "./zone-table";

export default async function ZonePage({ params }: { params: Promise<{ zone: string }> }) {
  await requireSuperadmin();
  const { zone: zoneRaw } = await params;
  const zone = decodeURIComponent(zoneRaw);
  if (!(ZONES as readonly string[]).includes(zone)) notFound();

  const caps: ZoneCap[] = listCapabilities().map((c) => ({
    id: c.id,
    name: c.name,
    cluster: c.cluster,
    reqAcq: c.req_acq,
    reqSat: c.req_sat,
  }));
  // superadmin-only page, so shipping per-AM panel scores to the client is fine
  const ams: ZoneAM[] = listAMs()
    .filter((am) => am.zone === zone)
    .map((am) => ({
      id: am.id,
      code: am.code,
      name: am.name,
      track: am.track,
      scores: Object.fromEntries(weightedLevels(am.id)),
    }));

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">
          <Link href="/analysis" style={{ color: "inherit" }}>← Dashboard</Link>
        </div>
        <h1 className="page-title">Zone benchmark · {zone}</h1>
        <p className="page-sub">
          APEX Panel scores per Account Manager, coloured against each AM&apos;s required level
          (track-aware). Filter by track and rank the Account Managers by overall standing.
        </p>
      </div>

      <div className="report-row">
        <div>
          <div className="report-title">{zone} Capability Report</div>
          <div className="report-sub">
            This zone only: its overview radar, its segments, Acquisition against Saturation,
            and the biggest gaps to close.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href={`/analysis/zone/${encodeURIComponent(zone)}/pdf`}>
          Download PDF
        </a>
      </div>

      <div className="card card-pad">
        <ZoneTable zone={zone} caps={caps} ams={ams} />
      </div>
    </div>
  );
}

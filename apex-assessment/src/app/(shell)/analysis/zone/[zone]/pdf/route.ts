import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/session";
import { groupProfile, listAMs, scoredRows, zoneTrackProfiles } from "@/lib/queries";
import { WEIGHTS_LABEL, ZONES } from "@/lib/seed-data";
import { DashboardPdf } from "@/lib/pdf-dashboard";
import { SHOW_LOGO, LOGO_MARK_PUBLIC_PATH } from "@/lib/brand";

let LOGO_DATA_URI = "";
if (SHOW_LOGO) {
  try {
    LOGO_DATA_URI =
      "data:image/png;base64," +
      fs.readFileSync(path.join(process.cwd(), "public", LOGO_MARK_PUBLIC_PATH)).toString("base64");
  } catch {
    /* asset missing — fall back to the "SE" text mark */
  }
}

/**
 * GET /analysis/zone/[zone]/pdf — the capability report for ONE zone.
 *
 * Same document as the all-zones deck, scoped to a single zone: its overview radar, its
 * segments, its two track radars, and its gap ranking. Downloaded from that zone's page,
 * which is where someone looking at a region expects to find it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ zone: string }> }) {
  await requireSuperadmin();
  const { zone: raw } = await params;
  const zone = decodeURIComponent(raw);
  if (!(ZONES as readonly string[]).includes(zone)) notFound();

  const ams = listAMs().filter((am) => am.zone === zone);
  const submittedCount = ams.filter((am) =>
    scoredRows(am.id, am.track).some((r) => r.weighted != null)
  ).length;

  // segments present in THIS zone only, so the deck has no empty cells
  const segLabels: string[] = [];
  for (const am of ams) {
    const seg = am.segment ?? "Unassigned";
    if (!segLabels.includes(seg)) segLabels.push(seg);
  }
  segLabels.sort((a, b) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));

  const buffer = await renderToBuffer(
    createElement(DashboardPdf, {
      generatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      logoDataUri: LOGO_DATA_URI,
      io: groupProfile(zone, ams),
      // a single-zone deck has no cross-zone comparison to make, so the zone grid is dropped
      zones: [],
      segments: segLabels.map((seg) =>
        groupProfile(seg, ams.filter((am) => (am.segment ?? "Unassigned") === seg))
      ),
      zoneTracks: zoneTrackProfiles(ams).filter((zt) => zt.zone === zone),
      scopeNote: null,
      amCount: ams.length,
      submittedCount,
      weightsLabel: WEIGHTS_LABEL,
      zoneLabel: zone,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="APEX-${zone}-Capability-Report-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

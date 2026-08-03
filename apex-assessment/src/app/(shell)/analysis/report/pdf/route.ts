import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSuperadmin } from "@/lib/session";
import {
  groupProfile,
  listAMs,
  scoredRows,
  segmentProfiles,
  zoneProfiles,
  zoneTrackProfiles,
} from "@/lib/queries";
import { SEGMENTS, WEIGHTS_LABEL } from "@/lib/seed-data";
import { DashboardPdf } from "@/lib/pdf-dashboard";
import { SHOW_LOGO, LOGO_MARK_PUBLIC_PATH } from "@/lib/brand";

// The brand mark, embedded once as a data URI. Only read when the logo is switched on.
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
 * GET /analysis/report/pdf — the APEX Capability Dashboard as a downloadable PDF.
 *
 * Population-level, so superadmin-only: it exposes every zone, segment and track at once.
 * Honours the same track/segment filters as the dashboard, so "download what I am looking
 * at" does what it says.
 */
export async function GET(req: Request) {
  await requireSuperadmin();

  const url = new URL(req.url);
  const trackRaw = url.searchParams.get("track");
  const segmentRaw = url.searchParams.get("segment");
  const track = trackRaw === "Acquisition" || trackRaw === "Saturation" ? trackRaw : undefined;
  const segment =
    segmentRaw && (SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : undefined;

  const ams = listAMs().filter(
    (am) => (!track || am.track === track) && (!segment || am.segment === segment)
  );
  const submittedCount = ams.filter((am) =>
    scoredRows(am.id, am.track).some((r) => r.weighted != null)
  ).length;

  const scopeParts = [track, segment].filter(Boolean) as string[];
  const scopeNote = scopeParts.length ? scopeParts.join(" · ") : null;

  const buffer = await renderToBuffer(
    createElement(DashboardPdf, {
      generatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      logoDataUri: LOGO_DATA_URI,
      io: groupProfile("International Operations", ams),
      zones: zoneProfiles(ams),
      segments: segmentProfiles(ams),
      zoneTracks: zoneTrackProfiles(ams),
      scopeNote,
      amCount: ams.length,
      submittedCount,
      weightsLabel: WEIGHTS_LABEL,
      // DocumentProps is a weak type (every field optional), so a props object sharing no
      // keys with it fails assignability. Same cast the individual report route uses.
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="APEX-Capability-Dashboard-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSuperadmin } from "@/lib/session";
import { averageRequired, averageWeighted, listAMs, scoredRows, submittedLevels } from "@/lib/queries";
import {
  ACCOUNT_TYPES,
  PERF_YTD_LABEL,
  PERF_YTD_SUFFIX,
  SEGMENTS,
  WEIGHTS_LABEL,
  ZONES,
} from "@/lib/seed-data";
import { PopulationPdf, type PopulationRow } from "@/lib/pdf-population";

/**
 * GET /analysis/population/pdf — the APEX Population Overview table as a PDF.
 *
 * Superadmin-only: one document naming every Account Manager with their manager and panel
 * scores. Honours the same q / zone / track / segment params as the Individual Results
 * page, so "download what I am looking at" holds.
 */
export async function GET(req: Request) {
  await requireSuperadmin();

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const zoneRaw = url.searchParams.get("zone");
  const trackRaw = url.searchParams.get("track");
  const segmentRaw = url.searchParams.get("segment");
  const zone = zoneRaw && (ZONES as readonly string[]).includes(zoneRaw) ? zoneRaw : undefined;
  const track = trackRaw === "Acquisition" || trackRaw === "Saturation" ? trackRaw : undefined;
  const segment =
    segmentRaw && (SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : undefined;
  const accountTypeRaw = url.searchParams.get("accountType");
  const accountType =
    accountTypeRaw && (ACCOUNT_TYPES as readonly string[]).includes(accountTypeRaw)
      ? accountTypeRaw
      : undefined;

  const all = listAMs();
  const matching = all.filter(
    (am) =>
      (!q ||
        am.name.toLowerCase().includes(q) ||
        am.account.toLowerCase().includes(q) ||
        am.code.toLowerCase().includes(q)) &&
      (!zone || am.zone === zone) &&
      (!track || am.track === track) &&
      (!segment || am.segment === segment) &&
      (!accountType || am.account_type === accountType)
  );

  const rows: PopulationRow[] = matching.map((am) => {
    const levels = submittedLevels(am.id);
    const mean = (m: Map<number, number>) =>
      m.size === 0 ? null : [...m.values()].reduce((a, b) => a + b, 0) / m.size;
    const applicable = scoredRows(am.id, am.track).filter((r) => r.req != null);
    const weighted = averageWeighted(applicable);
    const required = averageRequired(applicable);
    const selfAvg = mean(levels.self);
    return {
      zone: am.zone,
      segment: am.segment,
      account: am.account,
      amName: am.name,
      code: am.code,
      track: am.track,
      accountType: am.account_type,
      perfYtd: am.perf_ytd,
      self: selfAvg,
      manager: mean(levels.manager),
      expert: mean(levels.expert),
      weighted,
      required,
      gap: weighted != null && required != null ? weighted - required : null,
    };
  });
  rows.sort((a, b) => a.zone.localeCompare(b.zone) || a.amName.localeCompare(b.amName));

  const scopeParts = [zone, track, segment, accountType, q ? `search "${q}"` : null].filter(
    Boolean
  ) as string[];

  const buffer = await renderToBuffer(
    createElement(PopulationPdf, {
      generatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      rows,
      scopeNote: scopeParts.length ? scopeParts.join(" · ") : null,
      totalCount: all.length,
      weightsLabel: WEIGHTS_LABEL,
      // only show the column once somebody has actually recorded a figure
      showPerfYtd: rows.some((r) => r.perfYtd != null),
      perfLabel: PERF_YTD_LABEL,
      perfSuffix: PERF_YTD_SUFFIX,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="APEX-Population-Overview-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

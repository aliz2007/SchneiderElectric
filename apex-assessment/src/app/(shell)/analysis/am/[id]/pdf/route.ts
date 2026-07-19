import { createElement } from "react";
import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireSuperadmin } from "@/lib/session";
import {
  getAM,
  getAssessment,
  listCapabilities,
  requiredLevel,
  submittedLevels,
  submittedNotes,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, type Lens } from "@/lib/seed-data";
import { AmReportPdf, type ReportRow } from "@/lib/pdf-report";

/** GET /analysis/am/[id]/pdf — superadmin-only individual report download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const am = getAM(Number(id));
  if (!am) notFound();

  const caps = listCapabilities();
  const levels = submittedLevels(am.id);
  const notes = submittedNotes(am.id);
  const capById = new Map(caps.map((c) => [c.id, c]));

  type FullRow = ReportRow & { perception: number | null };
  const rows: FullRow[] = caps.map((cap) => {
    const req = requiredLevel(cap, am.track);
    const self = levels.self.get(cap.id);
    const manager = levels.manager.get(cap.id);
    const expert = levels.expert.get(cap.id);
    return {
      name: cap.name,
      cluster: cap.cluster,
      req,
      self,
      manager,
      expert,
      gap: req != null && expert != null ? expert - req : null,
      perception: self != null && expert != null ? self - expert : null,
    };
  });

  const applicable = rows.filter((r) => r.req != null);
  const strengths = applicable
    .filter((r) => r.gap != null && r.gap >= 0 && r.expert != null)
    .sort((a, b) => b.gap! - a.gap! || b.expert! - a.expert!)
    .slice(0, 5)
    .map((r) => ({ name: r.name, expert: r.expert!, req: r.req }));
  const development = applicable
    .filter((r) => r.gap != null && r.gap < 0)
    .sort((a, b) => a.gap! - b.gap!)
    .slice(0, 5)
    .map((r) => ({ name: r.name, expert: r.expert!, req: r.req }));
  const perceptionGaps = rows
    .filter((r) => r.perception != null && Math.abs(r.perception) >= 1)
    .sort((a, b) => Math.abs(b.perception!) - Math.abs(a.perception!))
    .map((r) => ({ name: r.name, perception: r.perception!, self: r.self, expert: r.expert }));

  const clusters: { name: string; rows: ReportRow[] }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cluster) clusters.push({ name: row.cluster, rows: [row] });
    else last.rows.push(row);
  }

  const buffer = await renderToBuffer(
    createElement(AmReportPdf, {
      amName: am.name,
      account: am.account,
      zone: am.zone,
      track: am.track,
      generatedAt: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      lensStatus: LENSES.map((lens) => ({
        label: LENS_LABELS[lens],
        submitted: getAssessment(am.id, lens)?.status === "submitted",
      })),
      strengths,
      development,
      perceptionGaps,
      clusters,
      notes: notes.map((n) => ({
        capability: capById.get(n.capability_id)?.name ?? "",
        lens: LENS_LABELS[n.lens as Lens],
        note: n.note,
      })),
      hasPanelData: levels.expert.size > 0,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const slug = am.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="APEX-Assessment-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

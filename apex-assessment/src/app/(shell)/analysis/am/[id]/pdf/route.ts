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
  submittedThemeNotes,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, type Lens } from "@/lib/seed-data";
import { AmReportPdf, type ReportRow } from "@/lib/pdf-report";
import { buildNarrative } from "@/lib/report-narrative";
import { aiNarrativeEnabled, generateAiNarrative } from "@/lib/ai-narrative";

/** GET /analysis/am/[id]/pdf — superadmin-only individual report download. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSuperadmin();
  const { id } = await params;
  const am = getAM(Number(id));
  if (!am) notFound();

  const caps = listCapabilities();
  const levels = submittedLevels(am.id);

  // Manager / APEX Panel theme notes, grouped by cluster and ordered by lens.
  const themeNotes = submittedThemeNotes(am.id);
  const notesByCluster = new Map<string, { lens: string; note: string }[]>();
  for (const n of themeNotes) {
    if (!notesByCluster.has(n.cluster)) notesByCluster.set(n.cluster, []);
    notesByCluster.get(n.cluster)!.push({ lens: n.lens, note: n.note });
  }
  for (const list of notesByCluster.values()) {
    list.sort((a, b) => LENSES.indexOf(a.lens as Lens) - LENSES.indexOf(b.lens as Lens));
    for (const item of list) item.lens = LENS_LABELS[item.lens as Lens];
  }

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

  const clusters: { name: string; rows: ReportRow[]; notes: { lens: string; note: string }[] }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cluster) {
      clusters.push({ name: row.cluster, rows: [row], notes: notesByCluster.get(row.cluster) ?? [] });
    } else last.rows.push(row);
  }

  const hasPanelData = levels.expert.size > 0;
  const narrative = buildNarrative({
    amName: am.name,
    track: am.track,
    hasPanelData,
    rows,
    caps,
    strengths,
    development,
    perceptionGaps,
  });

  // When Kimi (Moonshot) is configured and there is panel data to reason from, let it
  // write the three prose sections; otherwise keep the deterministic narrative. Any
  // failure returns null and we simply keep the deterministic prose — the PDF never
  // depends on the external call.
  let narrativeSource: "kimi" | "auto" = "auto";
  if (aiNarrativeEnabled() && hasPanelData) {
    const ai = await generateAiNarrative({
      amName: am.name,
      track: am.track,
      capabilities: rows
        .filter((r) => r.req != null)
        .map((r) => ({
          name: r.name,
          cluster: r.cluster,
          required: r.req,
          self: r.self ?? null,
          manager: r.manager ?? null,
          panel: r.expert ?? null,
          gapVsRequired: r.gap,
        })),
      themeNotes: themeNotes.map((n) => ({
        lens: LENS_LABELS[n.lens],
        cluster: n.cluster,
        note: n.note,
      })),
      definitions: narrative.definitions.map((d) => ({ name: d.name, level: d.level, text: d.text })),
    });
    if (ai) {
      narrative.strengths = ai.strength;
      narrative.development = ai.development;
      narrative.perception = ai.perception;
      narrativeSource = "kimi";
    }
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
      narrative,
      narrativeSource,
      hasPanelData,
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

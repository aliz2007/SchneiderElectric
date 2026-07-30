import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { notFound } from "next/navigation";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/session";
import {
  allLensesSubmitted,
  averageRequired,
  averageWeighted,
  getAM,
  getAssessment,
  isAssigned,
  listCapabilities,
  ratersByLens,
  scoredRows,
  submittedThemeNotes,
  themeJustificationText,
} from "@/lib/queries";
import { LENS_LABELS, LENSES, type Lens } from "@/lib/seed-data";
import { AmReportPdf, type ReportRow } from "@/lib/pdf-report";
import { buildNarrative } from "@/lib/report-narrative";
import { aiNarrativeEnabled, generateAiNarrative, recordAiResult, lastAiResult } from "@/lib/ai-narrative";
import { SHOW_LOGO, LOGO_MARK_PUBLIC_PATH } from "@/lib/brand";

// The brand mark, embedded once as a data URI so @react-pdf can draw it. Only
// read when the logo is switched on (see src/lib/brand.tsx); otherwise the
// report falls back to the "SE" text mark.
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
 * GET /analysis/am/[id]/pdf — individual report download. A superadmin can export
 * anyone; the assessed person (self lens) can export ONLY their own report, and
 * only once all three assessments are submitted.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const amId = Number(id);
  const am = getAM(amId);
  if (!am) notFound();
  if (user.role !== "superadmin") {
    const ownFinalised = user.lens === "self" && isAssigned(user.id, amId) && allLensesSubmitted(amId);
    if (!ownFinalised) return new Response("Not authorized", { status: 403 });
  }

  const caps = listCapabilities();

  // Theme notes (Self / Manager / APEX Panel), grouped by cluster and ordered by lens.
  const themeNotes = submittedThemeNotes(am.id);
  const notesByCluster = new Map<string, { lens: string; note: string }[]>();
  for (const n of themeNotes) {
    const text = themeJustificationText(n);
    if (!text) continue;
    if (!notesByCluster.has(n.cluster)) notesByCluster.set(n.cluster, []);
    notesByCluster.get(n.cluster)!.push({ lens: n.lens, note: text });
  }
  for (const list of notesByCluster.values()) {
    list.sort((a, b) => LENSES.indexOf(a.lens as Lens) - LENSES.indexOf(b.lens as Lens));
    for (const item of list) item.lens = LENS_LABELS[item.lens as Lens];
  }

  // Weighted score (Self 20% / Panel 35% / Manager 45%) drives every figure in the report.
  type FullRow = ReportRow & { perception: number | null };
  const scored = scoredRows(am.id, am.track);
  const rows: FullRow[] = scored.map((r) => ({
    name: r.cap.name,
    cluster: r.cap.cluster,
    req: r.req,
    self: r.self,
    manager: r.manager,
    expert: r.expert,
    weighted: r.weighted,
    gap: r.gap,
    perception: r.perception,
  }));

  const applicable = rows.filter((r) => r.req != null);
  // Strength = strictly ABOVE required (at-level is baseline, not a strength).
  const strengths = applicable
    .filter((r) => r.gap != null && r.gap > 0 && r.weighted != null)
    .sort((a, b) => b.gap! - a.gap!)
    .slice(0, 6)
    .map((r) => ({ name: r.name, weighted: r.weighted!, req: r.req }));
  const development = applicable
    .filter((r) => r.gap != null && r.gap < 0 && r.weighted != null)
    .sort((a, b) => a.gap! - b.gap!)
    .map((r) => ({ name: r.name, weighted: r.weighted!, req: r.req }));
  // for the narrative prose: only the meaningful divergences (a full level or more)
  const perceptionGaps = rows
    .filter((r) => r.perception != null && Math.abs(r.perception) >= 1)
    .sort((a, b) => Math.abs(b.perception!) - Math.abs(a.perception!))
    .map((r) => ({ name: r.name, perception: r.perception!, self: r.self, expert: r.expert }));
  void perceptionGaps;

  // Perception radar: the average level per theme (cluster) for each lens.
  const clusterOrder: string[] = [];
  for (const r of rows) if (!clusterOrder.includes(r.cluster)) clusterOrder.push(r.cluster);
  const themeRadar = clusterOrder.map((cluster) => {
    const inCluster = rows.filter((r) => r.cluster === cluster);
    const mean = (k: "self" | "manager" | "expert" | "weighted") => {
      const vals = inCluster.map((r) => r[k]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const reqVals = inCluster.map((r) => r.req).filter((v): v is number => v != null);
    return {
      theme: cluster,
      self: mean("self"),
      manager: mean("manager"),
      expert: mean("expert"),
      weighted: mean("weighted"),
      required: reqVals.length ? reqVals.reduce((a, b) => a + b, 0) / reqVals.length : null,
    };
  });

  // Headline grade: unrounded WEIGHTED average across the track's applicable capabilities,
  // against the expected overall (average of the required levels).
  const overallAvg = averageWeighted(scored.filter((r) => r.req != null));
  const overallReq = averageRequired(scored);

  const clusters: { name: string; rows: ReportRow[]; notes: { lens: string; note: string }[] }[] = [];
  for (const row of rows) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== row.cluster) {
      clusters.push({ name: row.cluster, rows: [row], notes: notesByCluster.get(row.cluster) ?? [] });
    } else last.rows.push(row);
  }

  const hasScores = rows.some((r) => r.weighted != null);
  const narrative = buildNarrative({
    amName: am.name,
    track: am.track,
    hasScores,
    rows,
    caps,
    strengths,
    development,
    perceptionGaps,
    themeNotes: themeNotes.map((n) => ({ lens: LENS_LABELS[n.lens], cluster: n.cluster, note: themeJustificationText(n) })),
  });

  // When Kimi (Moonshot) is configured and there is panel data to reason from, let it
  // write the three prose sections; otherwise keep the deterministic narrative. Any
  // failure returns null and we simply keep the deterministic prose — the PDF never
  // depends on the external call.
  let narrativeSource: "kimi" | "auto" = "auto";
  if (!aiNarrativeEnabled()) {
    recordAiResult("not attempted: AI feedback is off (no key set, or the toggle is off)");
  } else if (!hasScores) {
    recordAiResult(`not attempted: no submitted APEX Panel scores for ${am.name} — the APEX Panel assessment must be submitted first`);
  } else {
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
          weighted: r.weighted == null ? null : Math.round(r.weighted * 100) / 100,
          gapVsRequired: r.gap == null ? null : Math.round(r.gap * 100) / 100,
        })),
      themeNotes: themeNotes.map((n) => ({
        lens: LENS_LABELS[n.lens],
        cluster: n.cluster,
        note: themeJustificationText(n),
      })),
      definitions: narrative.definitions.map((d) => ({ name: d.name, level: d.level, text: d.text })),
    });
    if (ai) {
      narrative.strengths = ai.strengths;
      narrative.development = ai.development;
      narrative.comments = ai.comments.trim() ? ai.comments : null;
      narrativeSource = "kimi";
    }
    // generateAiNarrative records "OK" or the exact failure reason
  }
  const aiReason = lastAiResult() ?? "";

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
        rater: ratersByLens(am.id)[lens],
      })),
      strengths,
      development,
      themeRadar,
      overallAvg,
      overallReq,
      clusters,
      narrative,
      narrativeSource,
      logoDataUri: LOGO_DATA_URI,
      hasScores,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  );

  const slug = am.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="APEX-Assessment-${slug}.pdf"`,
      "Cache-Control": "no-store",
      // let the client show whether Kimi actually wrote the narrative, and why not
      "X-AI-Source": narrativeSource,
      "X-AI-Reason": encodeURIComponent(aiReason),
    },
  });
}

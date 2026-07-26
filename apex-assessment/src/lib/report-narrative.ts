// Deterministic, data-driven narrative for the individual PDF report. No LLM/external
// calls — the same assessment data always yields the same prose, so the report stays
// reproducible and the app remains the system of record. The wording is assembled from
// each person's APEX Panel scores vs the required level for their track, plus the
// self-vs-panel perception gaps. Capability "definitions" reuse the rubric behavioural
// anchors (the source Excel labels the L1/L2/L3 anchors as the capability definitions).

export type NarrRow = {
  name: string;
  cluster: string;
  req: number | null;
  self?: number;
  manager?: number;
  expert?: number;
  gap: number | null; // expert - required
  perception: number | null; // self - expert
};

type CapAnchors = { name: string; cluster: string; l1: string; l2: string; l3: string };
type Ranked = { name: string; expert: number; req: number | null };
type Perception = { name: string; perception: number; self?: number; expert?: number };

export type CapabilityDefinition = {
  name: string;
  cluster: string;
  level: number; // the level whose anchor is quoted (required level, or L2 fallback)
  applicable: boolean; // false when the capability is not assessed on this AM's track
  text: string;
};

export type Narrative = {
  summary: string;
  strengths: string;
  development: string;
  comments: string | null;
  definitions: CapabilityDefinition[];
};

/** "A", "A and B", "A, B and C" */
function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const possessive = (name: string) => `${name}${name.endsWith("s") ? "'" : "'s"}`;

export function buildNarrative(input: {
  amName: string;
  track: string;
  hasPanelData: boolean;
  rows: NarrRow[];
  caps: CapAnchors[];
  strengths: Ranked[];
  development: Ranked[];
  perceptionGaps: Perception[];
  themeNotes: { lens: string; cluster: string; note: string }[];
}): Narrative {
  const { amName, track, hasPanelData, rows, caps, strengths, development, perceptionGaps, themeNotes } = input;

  const applicable = rows.filter((r) => r.req != null);
  const scored = applicable.filter((r) => r.expert != null);
  const atOrAbove = applicable.filter((r) => r.gap != null && r.gap >= 0).length;
  const below = applicable.filter((r) => r.gap != null && r.gap < 0).length;
  const first = amName.split(" ")[0];
  const capByCluster = new Map(rows.map((r) => [r.name, r.cluster]));
  const rowByName = new Map(rows.map((r) => [r.name, r]));
  const clusterOrder: string[] = [];
  for (const r of rows) if (!clusterOrder.includes(r.cluster)) clusterOrder.push(r.cluster);
  const notesByCluster = new Map<string, string[]>();
  for (const n of themeNotes) {
    if (!notesByCluster.has(n.cluster)) notesByCluster.set(n.cluster, []);
    const lenses = notesByCluster.get(n.cluster)!;
    if (!lenses.includes(n.lens)) lenses.push(n.lens);
  }
  const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

  // ---- framing summary ----
  let summary: string;
  if (!hasPanelData) {
    summary =
      `${amName} is assessed on the ${track} track, which measures ${applicable.length} capabilities against their required levels. ` +
      `The APEX Panel — the authoritative lens — has not yet submitted its review, so the strengths and development picture below is provisional and will firm up once the panel completes its scoring.`;
  } else {
    const overallAvg = scored.reduce((a, r) => a + r.expert!, 0) / Math.max(1, scored.length);
    const overallReq = applicable.reduce((a, r) => a + (r.req ?? 0), 0) / Math.max(1, applicable.length);
    // strongest / weakest theme by average panel-vs-required gap
    const clusterGap = clusterOrder
      .map((cl) => {
        const inCl = applicable.filter((r) => r.cluster === cl && r.gap != null);
        return inCl.length
          ? { cl, gap: inCl.reduce((a, r) => a + r.gap!, 0) / inCl.length }
          : null;
      })
      .filter(Boolean) as { cl: string; gap: number }[];
    clusterGap.sort((a, b) => b.gap - a.gap);
    const strongest = clusterGap[0];
    const weakest = clusterGap[clusterGap.length - 1];
    const over = rows.filter((r) => r.perception != null && r.perception > 0).length;
    const under = rows.filter((r) => r.perception != null && r.perception < 0).length;
    const aligned = rows.filter((r) => r.perception === 0).length;
    const tendency =
      over > under + 2
        ? `${first} tends to rate themselves above the panel's read (higher on ${over} capabilities, lower on ${under})`
        : under > over + 2
          ? `${first} tends to under-rate themselves against the panel's read (lower on ${under} capabilities, higher on ${over})`
          : `${possessive(first)} self-image is broadly in line with the panel (aligned on ${aligned} capabilities, higher on ${over}, lower on ${under})`;

    summary =
      `${amName} is assessed on the ${track} track, which measures ${applicable.length} capabilities against the level that track requires. ` +
      `Across the ${scored.length} capabilities the APEX Panel has scored, ${first} meets or exceeds the bar on ${atOrAbove} and falls short on ${below}, ` +
      `for an overall average of ${fmt1(overallAvg)} against an expected ${fmt1(overallReq)}. ` +
      (strongest && weakest && strongest.cl !== weakest.cl
        ? `The strongest theme is ${strongest.cl}; the furthest from the bar is ${weakest.cl}. `
        : "") +
      `Comparing lenses, ${tendency}. ` +
      `The panel is the authoritative view, so the read below is anchored to its scores; the manager and self views are used as corroboration or contrast.`;
  }

  // ---- helpers for cluster-organised prose (same "Cluster: " lead the AI uses,
  //      so the PDF bolds the theme name either way) ----
  const clusterParagraphs = (
    items: Ranked[],
    kind: "strength" | "development"
  ): string => {
    const byCluster = new Map<string, Ranked[]>();
    for (const it of items) {
      const cl = capByCluster.get(it.name) ?? "Other";
      if (!byCluster.has(cl)) byCluster.set(cl, []);
      byCluster.get(cl)!.push(it);
    }
    const paras: string[] = [];
    for (const cl of clusterOrder) {
      const list = byCluster.get(cl);
      if (!list || list.length === 0) continue;
      const lead = list[0];
      const leadRow = rowByName.get(lead.name);
      const names = joinNames(list.map((r) => r.name));
      const sentences: string[] = [];
      if (kind === "strength") {
        sentences.push(
          list.length === 1
            ? `${cl}: the panel places ${first} above the bar on ${names}, at L${lead.expert} against a required L${lead.req}.`
            : `${cl}: ${first} stands above the bar on ${names}, led by ${lead.name} at L${lead.expert} against a required L${lead.req}.`
        );
        if (leadRow?.manager != null) {
          sentences.push(
            leadRow.manager >= lead.expert
              ? `The manager reads it the same way (L${leadRow.manager}), which makes this a strength the account can rely on rather than a one-off impression.`
              : `The manager is more reserved here (L${leadRow.manager} against the panel's L${lead.expert}), so it is worth making this strength more visible day to day.`
          );
        }
        if (leadRow?.self != null && lead.expert > leadRow.self) {
          sentences.push(`Notably, ${first} rates themselves only L${leadRow.self} on ${lead.name} — a strength others see more clearly than they do.`);
        }
      } else {
        const parts = list.map((r) => `${r.name} (L${r.expert} vs required L${r.req})`);
        sentences.push(
          `${cl}: ${list.length === 1 ? "the gap to close is" : "the gaps to close are"} ${joinNames(parts)}.`
        );
        const widest = list.reduce((a, b) => ((a.req ?? 0) - a.expert >= (b.req ?? 0) - b.expert ? a : b));
        const wRow = rowByName.get(widest.name);
        if ((widest.req ?? 0) - widest.expert > 1) {
          sentences.push(`${widest.name} is the pressing one — a full ${(widest.req ?? 0) - widest.expert} levels short of what the ${track} track expects.`);
        }
        if (wRow?.manager != null && wRow.manager > widest.expert) {
          sentences.push(`The manager scores it higher (L${wRow.manager}), a divergence worth resolving in the development conversation.`);
        } else if (wRow?.manager != null && wRow.manager === widest.expert) {
          sentences.push(`The manager sees the same gap (L${wRow.manager}), so evaluators agree on where the work is.`);
        }
        if (wRow?.self != null && wRow.self > widest.expert) {
          sentences.push(`${first} rates themselves L${wRow.self} here, above the panel's L${widest.expert} — closing the perception gap is part of closing the capability gap.`);
        }
        const noteLenses = notesByCluster.get(cl);
        if (noteLenses?.length) {
          sentences.push(
            `The written ${noteLenses.length > 1 ? "justifications" : "justification"} from ${joinNames(noteLenses)} on this theme (in the capability detail) ${noteLenses.length > 1 ? "give" : "gives"} the concrete context behind these scores.`
          );
        }
      }
      paras.push(sentences.join(" "));
    }
    return paras.join("\n\n");
  };

  // ---- strengths ----
  let strengthsText: string;
  if (!hasPanelData) {
    strengthsText = "A strengths summary will appear here once the APEX Panel assessment is submitted.";
  } else if (strengths.length === 0) {
    const closest = [...applicable]
      .filter((r) => r.expert != null && r.gap != null && r.gap < 0)
      .sort((a, b) => b.gap! - a.gap!)
      .slice(0, 2);
    strengthsText =
      `The panel does not yet place ${amName} above the required level on any capability, so this track has no established strengths to build on — the picture is one of a profile still converging on the bar. ` +
      (closest.length
        ? `The closest capabilities to crossing it are ${joinNames(closest.map((r) => r.name))}, each within a level of target; consolidating those first would give the profile its first clear anchor points.`
        : "");
  } else {
    strengthsText = clusterParagraphs(strengths, "strength");
    const extra = development.length === 0 && atOrAbove > strengths.length
      ? `\n\nBeyond these, ${atOrAbove - strengths.length} further ${atOrAbove - strengths.length === 1 ? "capability sits" : "capabilities sit"} solidly at the required level — a stable base rather than a gap.`
      : "";
    strengthsText += extra;
  }

  // ---- development / weaknesses ----
  let developmentText: string;
  if (!hasPanelData) {
    developmentText = "Development priorities will appear here once the APEX Panel assessment is submitted.";
  } else if (development.length === 0) {
    developmentText =
      `No capability currently falls below its required level, so there is no pressing capability gap on the ${track} track. ` +
      `The development conversation can shift from remediation to stretch: deepening the strongest themes, widening executive exposure, and converting at-level capabilities into clear strengths.`;
  } else {
    const ordered = [...development].sort((a, b) => ((b.req ?? 0) - b.expert) - ((a.req ?? 0) - a.expert));
    const priorities = ordered.slice(0, 3).map((r) => r.name);
    developmentText =
      clusterParagraphs(development, "development") +
      `\n\nTaken together, the first priorities for the development plan are ${joinNames(priorities)} — the widest gaps to the ${track} bar${development.length > priorities.length ? `, with ${development.length - priorities.length} further below-target ${development.length - priorities.length === 1 ? "capability" : "capabilities"} behind them` : ""}.`;
  }

  // ---- comments (only when evaluators actually wrote notes) ----
  let commentsText: string | null = null;
  if (themeNotes.length > 0) {
    const clusters: string[] = [];
    const seenC = new Set<string>();
    for (const n of themeNotes) if (!seenC.has(n.cluster)) { seenC.add(n.cluster); clusters.push(n.cluster); }
    const lenses: string[] = [];
    const seenL = new Set<string>();
    for (const n of themeNotes) if (!seenL.has(n.lens)) { seenL.add(n.lens); lenses.push(n.lens); }
    commentsText =
      `${joinNames(lenses)} recorded written justifications on ${clusters.length} of the six ${clusters.length === 1 ? "theme" : "themes"} — ${joinNames(clusters)}. ` +
      `They are the qualitative backing for the scores above: concrete situations, actions and outcomes rather than numbers. ` +
      `Each note is reproduced with its theme in the capability detail at the end of this report, and they are the right starting point for the development conversation.`;
  }

  // ---- definitions of every capability named above ----
  const capByName = new Map(caps.map((c) => [c.name, c]));
  const reqByName = new Map(rows.map((r) => [r.name, r.req]));
  const mentioned: string[] = [];
  const seen = new Set<string>();
  for (const list of [strengths, development, perceptionGaps]) {
    for (const r of list) {
      if (!seen.has(r.name)) {
        seen.add(r.name);
        mentioned.push(r.name);
      }
    }
  }
  const definitions: CapabilityDefinition[] = mentioned.flatMap((name) => {
    const cap = capByName.get(name);
    if (!cap) return [];
    const req = reqByName.get(name) ?? null;
    const level = req ?? 2;
    const text = level === 1 ? cap.l1 : level === 3 ? cap.l3 : cap.l2;
    return [{ name, cluster: cap.cluster, level, applicable: req != null, text }];
  });

  return { summary, strengths: strengthsText, development: developmentText, comments: commentsText, definitions };
}

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
  perception: string | null;
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
}): Narrative {
  const { amName, track, hasPanelData, rows, caps, strengths, development, perceptionGaps } = input;

  const applicable = rows.filter((r) => r.req != null);
  const scored = applicable.filter((r) => r.expert != null);
  const atOrAbove = applicable.filter((r) => r.gap != null && r.gap >= 0).length;
  const below = applicable.filter((r) => r.gap != null && r.gap < 0).length;

  // ---- framing summary ----
  let summary: string;
  if (!hasPanelData) {
    summary =
      `${amName} is assessed on the ${track} track, which measures ${applicable.length} capabilities against their required levels. ` +
      `The APEX Panel — the authoritative lens — has not yet submitted its review, so the strengths and development picture below is provisional and will firm up once the panel completes its scoring.`;
  } else {
    summary =
      `${amName} is assessed on the ${track} track, which measures ${applicable.length} capabilities against the level required for that track. ` +
      `Across the ${scored.length} the APEX Panel has scored, ${amName} meets or exceeds the required level in ${atOrAbove} and falls short in ${below}. ` +
      `The panel is the authoritative lens, so the summary below is anchored to its scores.`;
  }

  // ---- strengths ----
  let strengthsText: string;
  if (!hasPanelData) {
    strengthsText = "A strengths summary will appear here once the APEX Panel assessment is submitted.";
  } else if (strengths.length === 0) {
    strengthsText = `The panel does not yet place ${amName} at or above the required level on any capability, so clear strengths have still to establish themselves on this track.`;
  } else {
    const top = strengths.slice(0, 3);
    const lead = top[0];
    let s = `${possessive(amName)} clearest strengths are ${joinNames(top.map((r) => r.name))}. `;
    s += `In ${lead.name} the panel rates ${amName} at L${lead.expert} against a required L${lead.req}`;
    s += lead.req != null && lead.expert > lead.req ? ", exceeding the bar." : ", meeting the bar.";
    if (strengths.length > 3) {
      const extra = strengths.length - 3;
      s += ` A further ${extra} ${extra === 1 ? "capability sits" : "capabilities sit"} at or above target.`;
    }
    strengthsText = s;
  }

  // ---- development / weaknesses ----
  let developmentText: string;
  if (!hasPanelData) {
    developmentText = "Development priorities will appear here once the APEX Panel assessment is submitted.";
  } else if (development.length === 0) {
    developmentText = `No capability currently falls below its required level, so there is no pressing capability gap on the ${track} track — the focus shifts to deepening existing strengths.`;
  } else {
    const top = development.slice(0, 3);
    const lead = top[0];
    let d = `The priority development areas are ${joinNames(top.map((r) => r.name))}, where the panel scores below the level the ${track} track requires. `;
    d += `The widest gap is in ${lead.name}, rated L${lead.expert} against a required L${lead.req}.`;
    if (development.length > 3) {
      const extra = development.length - 3;
      d += ` ${extra} further ${extra === 1 ? "capability is" : "capabilities are"} also below target and should feed the development plan.`;
    }
    developmentText = d;
  }

  // ---- perception (self vs panel) ----
  let perceptionText: string | null = null;
  if (hasPanelData && perceptionGaps.length > 0) {
    const over = perceptionGaps.filter((p) => p.perception > 0).map((p) => p.name);
    const under = perceptionGaps.filter((p) => p.perception < 0).map((p) => p.name);
    const clauses: string[] = [];
    if (over.length) clauses.push(`rates themselves above the panel on ${joinNames(over)}`);
    if (under.length) clauses.push(`is more critical than the panel on ${joinNames(under)}`);
    const n = perceptionGaps.length;
    perceptionText =
      `Self-assessment and the panel diverge by a full level or more on ${n} ${n === 1 ? "capability" : "capabilities"}: ${amName} ${joinNames(clauses)}. ` +
      `These are the most useful starting points for a calibration conversation.`;
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

  return { summary, strengths: strengthsText, development: developmentText, perception: perceptionText, definitions };
}

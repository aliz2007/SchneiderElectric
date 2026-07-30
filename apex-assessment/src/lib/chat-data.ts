// Live-data snapshots for the in-app APEX Assistant, rebuilt on every question so
// the bot always reasons over the current database.
//
// ACCESS MIRRORS THE APP. The assistant must never reveal data the signed-in
// account cannot already see in the UI:
//   - superadmin: everything — roster, all three lenses, gaps vs required, notes,
//     users and assignments (matches the analysis + admin pages).
//   - assessor (self / manager / panel): ONLY their own work — the people they are
//     assigned to, their own ratings (drafts included, as in their wizard) and their
//     own theme notes — plus the overall completion counts the shared dashboard
//     already shows. Required/expected levels and other evaluators' scores are
//     deliberately absent from their snapshot, so the model cannot leak them.
//
// The superadmin snapshot also PRE-COMPUTES the analytically important facts per
// AM (strengths, skill gaps, perception gaps) and per zone (most common skill
// gaps), so the model answers from explicit fields instead of re-deriving numbers
// from raw scores — which is where an LLM hallucinates. Definitions match the app:
//   weighted   = Self 20% + APEX Panel 35% + Manager 45% (re-normalised over submitted
//                lenses) — the canonical score behind every metric
//   strength   = WEIGHTED score STRICTLY ABOVE the required level (gap > 0)
//   skill gap  = WEIGHTED score BELOW the required level (gap < 0)
//   at baseline= WEIGHTED score EQUAL to the required level (not a strength, not a gap)
//   perception gap = self and the weighted score differ by a full level or more
//
// Only SUBMITTED assessments feed the full snapshot, matching every analysis view.

import {
  assignedAMs,
  getAssessment,
  getRatings,
  getThemeNotesFull,
  listAMs,
  listCapabilities,
  listUsers,
  overviewStats,
  requiredLevel,
  submittedLevels,
  submittedThemeNotes,
  themeJustificationText,
} from "./queries";
import { LENS_LABELS, LENSES, WEIGHTS_LABEL, weightedScore, type Lens } from "./seed-data";

export type ChatViewer = {
  id: number;
  displayName: string;
  role: "superadmin" | "assessor";
  lens: Lens | null;
};

type CapRow = {
  capability: string;
  cluster: string;
  required: number | null;
  self: number | null;
  manager: number | null;
  panel: number | null;
  weighted: number | null; // Self 20% / Panel 35% / Manager 45%
  gapVsRequired: number | null; // weighted - required
  selfMinusWeighted: number | null;
};

function fullSnapshot() {
  const caps = listCapabilities();

  const accountManagers = listAMs().map((am) => {
    const levels = submittedLevels(am.id);
    const rows: CapRow[] = caps
      .map((cap) => {
        const required = requiredLevel(cap, am.track);
        const self = levels.self.get(cap.id) ?? null;
        const manager = levels.manager.get(cap.id) ?? null;
        const panel = levels.expert.get(cap.id) ?? null;
        const weighted = weightedScore({ self, manager, expert: panel });
        const round2 = (v: number | null) => (v == null ? null : Math.round(v * 100) / 100);
        return {
          capability: cap.name,
          cluster: cap.cluster,
          required,
          self,
          manager,
          panel,
          weighted: round2(weighted),
          gapVsRequired: required != null && weighted != null ? round2(weighted - required) : null,
          selfMinusWeighted: self != null && weighted != null ? round2(self - weighted) : null,
        };
      })
      .filter((r) => r.required != null || r.self != null || r.manager != null || r.panel != null);

    // pre-computed analysis (definitions above) so the model never has to derive them
    const scored = rows.filter((r) => r.gapVsRequired != null);
    const strengths = scored
      .filter((r) => r.gapVsRequired! > 0)
      .map((r) => ({ capability: r.capability, cluster: r.cluster, weighted: r.weighted, required: r.required, aboveRequiredBy: r.gapVsRequired }));
    const skillGaps = scored
      .filter((r) => r.gapVsRequired! < 0)
      .map((r) => ({ capability: r.capability, cluster: r.cluster, weighted: r.weighted, required: r.required, belowRequiredBy: Math.round(-r.gapVsRequired! * 100) / 100 }));
    const atBaseline = scored.filter((r) => r.gapVsRequired === 0).map((r) => r.capability);
    const perceptionGaps = rows
      .filter((r) => r.selfMinusWeighted != null && Math.abs(r.selfMinusWeighted) >= 1)
      .map((r) => ({
        capability: r.capability,
        self: r.self,
        weighted: r.weighted,
        direction: r.selfMinusWeighted! > 0 ? "over-rates self" : "under-rates self",
        byLevels: Math.abs(r.selfMinusWeighted!),
      }));

    return {
      code: am.code,
      name: am.name,
      account: am.account,
      zone: am.zone,
      track: am.track,
      segment: am.segment,
      assessmentsSubmitted: LENSES.filter((lens) => getAssessment(am.id, lens)?.status === "submitted").map(
        (lens) => LENS_LABELS[lens]
      ),
      analysis: {
        hasScores: scored.length > 0,
        strengths,
        skillGaps,
        atBaseline,
        perceptionGaps,
      },
      capabilities: rows,
      themeNotes: submittedThemeNotes(am.id)
        .map((n) => ({ lens: LENS_LABELS[n.lens], cluster: n.cluster, note: themeJustificationText(n) }))
        .filter((n) => n.note),
    };
  });

  // per-zone roll-up: which skill gaps recur most across the zone's people
  const zones = Array.from(new Set(accountManagers.map((a) => a.zone)));
  const zoneInsights = zones.map((zone) => {
    const inZone = accountManagers.filter((a) => a.zone === zone);
    const withPanel = inZone.filter((a) => a.analysis.hasScores);
    const gapCount = new Map<string, number>();
    for (const am of withPanel) for (const g of am.analysis.skillGaps) gapCount.set(g.capability, (gapCount.get(g.capability) ?? 0) + 1);
    const commonSkillGaps = [...gapCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([capability, count]) => ({ capability, peopleBelowRequired: count, ofPeopleWithPanelData: withPanel.length }));
    return { zone, accountManagers: inZone.length, withPanelData: withPanel.length, commonSkillGaps };
  });

  const users = listUsers().map((u) => ({
    displayName: u.display_name,
    role: u.role,
    lens: u.lens ? LENS_LABELS[u.lens] : null,
    active: u.active === 1,
    assesses: assignedAMs(u.id).map((am) => am.name),
  }));

  return {
    scope: "full — this user is a superadmin and may see everything",
    levelScale: { L1: "Developing", L2: "Proficient", L3: "Advanced" },
    definitions: {
      strength: "APEX Panel score strictly ABOVE the required level (a capability merely AT the required level is on the baseline, not a strength)",
      skillGap: "APEX Panel score BELOW the required level",
      perceptionGap: "self and APEX Panel differ by a full level or more",
    },
    capabilityCatalogue: caps.map((c) => ({
      name: c.name,
      cluster: c.cluster,
      requiredOnAcquisitionTrack: requiredLevel(c, "Acquisition"),
      requiredOnSaturationTrack: requiredLevel(c, "Saturation"),
    })),
    accountManagers,
    zoneInsights,
    scoringRule: `Weighted score = ${WEIGHTS_LABEL}, re-normalised over the lenses that have submitted. Every gap, strength and metric uses it.`,
    users,
  };
}

/** An assessor's view: their own work plus the dashboard's completion counts. */
function scopedSnapshot(viewer: ChatViewer) {
  const caps = listCapabilities();
  const capById = new Map(caps.map((c) => [c.id, c]));
  const stats = overviewStats();

  const myAssessments = viewer.lens
    ? assignedAMs(viewer.id).map((am) => {
        const a = getAssessment(am.id, viewer.lens!);
        const ratings = a
          ? getRatings(a.id)
              .filter((r) => r.level != null)
              .map((r) => ({
                capability: capById.get(r.capability_id)?.name ?? `capability ${r.capability_id}`,
                cluster: capById.get(r.capability_id)?.cluster ?? "",
                myLevel: r.level,
              }))
          : [];
        return {
          personAssessed: am.name,
          account: am.account,
          zone: am.zone,
          track: am.track,
          status: a?.status ?? "not started",
          capabilitiesRated: ratings.length,
          capabilitiesTotal: caps.length,
          myRatings: ratings,
          myThemeNotes: a
            ? getThemeNotesFull(a.id)
                .map((n) => ({ cluster: n.cluster, justification: themeJustificationText(n) }))
                .filter((n) => n.justification)
            : [],
        };
      })
    : [];

  return {
    scope:
      "restricted — this user is an assessor and may only see their own assessment work and overall completion counts",
    levelScale: { L1: "Developing", L2: "Proficient", L3: "Advanced" },
    // names and themes only: required/expected levels are hidden from assessors by design
    capabilityCatalogue: caps.map((c) => ({ name: c.name, cluster: c.cluster })),
    myLens: viewer.lens ? LENS_LABELS[viewer.lens] : null,
    myAssessments,
    programCompletion: {
      accountManagers: stats.amCount,
      submittedAssessments: {
        self: stats.byLens.self,
        manager: stats.byLens.manager,
        apexPanel: stats.byLens.expert,
      },
    },
  };
}

export function buildChatSnapshot(viewer: ChatViewer) {
  return viewer.role === "superadmin" ? fullSnapshot() : scopedSnapshot(viewer);
}

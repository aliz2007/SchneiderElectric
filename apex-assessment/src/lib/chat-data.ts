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
// Only SUBMITTED assessments feed the full (superadmin) snapshot, matching every
// analysis view. The whole dataset serialises to a few tens of KB, well inside
// Kimi's context window, so the model gets the full permitted picture.

import {
  assessmentStatuses,
  assignedAMs,
  getAssessment,
  getRatings,
  getThemeNotes,
  listAMs,
  listCapabilities,
  listUsers,
  overviewStats,
  requiredLevel,
  submittedLevels,
  submittedThemeNotes,
} from "./queries";
import { LENS_LABELS, LENSES, type Lens } from "./seed-data";

/** The caller's identity, as far as scoping needs it (a slice of SessionUser). */
export type ChatViewer = {
  id: number;
  displayName: string;
  role: "superadmin" | "assessor";
  lens: Lens | null;
};

function fullSnapshot() {
  const caps = listCapabilities();
  const statuses = assessmentStatuses();

  const accountManagers = listAMs().map((am) => {
    const levels = submittedLevels(am.id);
    const st = statuses.get(am.id);
    const capabilities = caps
      .map((cap) => {
        const required = requiredLevel(cap, am.track);
        const self = levels.self.get(cap.id) ?? null;
        const manager = levels.manager.get(cap.id) ?? null;
        const panel = levels.expert.get(cap.id) ?? null;
        return {
          capability: cap.name,
          cluster: cap.cluster,
          required,
          self,
          manager,
          panel,
          gapVsRequired: required != null && panel != null ? panel - required : null,
          selfMinusPanel: self != null && panel != null ? self - panel : null,
        };
      })
      // drop rows that are neither applicable to this track nor rated by anyone
      .filter((r) => r.required != null || r.self != null || r.manager != null || r.panel != null);

    return {
      code: am.code,
      name: am.name,
      account: am.account,
      zone: am.zone,
      track: am.track,
      assessments: LENSES.map((lens) => ({
        lens: LENS_LABELS[lens],
        status: st?.[lens]?.status ?? "missing",
        capabilitiesRated: st?.[lens]?.rated ?? 0,
      })),
      capabilities,
      themeNotes: submittedThemeNotes(am.id).map((n) => ({
        lens: LENS_LABELS[n.lens],
        cluster: n.cluster,
        note: n.note,
      })),
    };
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
    capabilityCatalogue: caps.map((c) => ({
      name: c.name,
      cluster: c.cluster,
      requiredOnAcquisitionTrack: requiredLevel(c, "Acquisition"),
      requiredOnSaturationTrack: requiredLevel(c, "Saturation"),
    })),
    accountManagers,
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
          myThemeNotes: a ? getThemeNotes(a.id) : [],
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

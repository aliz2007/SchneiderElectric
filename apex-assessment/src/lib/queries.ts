import { getDb } from "./db";
import { LENSES, LENS_WEIGHTS, ZONES, weightedScore, type Lens } from "./seed-data";

export type AM = {
  id: number;
  code: string;
  name: string;
  account: string;
  zone: (typeof ZONES)[number];
  track: "Acquisition" | "Saturation";
  segment: string | null; // business segment (Power & Grid / Energy & Chemicals / CS&P / Multi-segment)
  profile_complete: number; // 0 = created for a person who still needs to fill in their details
  manager_deadline: string | null; // YYYY-MM-DD — manager can no longer assess past this date
  panel_datetime: string | null; // YYYY-MM-DDTHH:MM — scheduled call; panel can no longer assess past that day
};

export type Capability = {
  id: number;
  ord: number;
  name: string;
  cluster: string;
  src: string;
  req_acq: number | null;
  req_sat: number | null;
  l1: string;
  l2: string;
  l3: string;
};

export function listAMs(): AM[] {
  return getDb().prepare("SELECT * FROM account_managers ORDER BY code").all() as AM[];
}

export function getAM(id: number): AM | undefined {
  return getDb().prepare("SELECT * FROM account_managers WHERE id = ?").get(id) as AM | undefined;
}

/** Create a brand-new person (Account Manager) whose details are filled in on first sign-in.
 *  Placeholder zone/track satisfy the schema until the person completes onboarding. */
export function createAccountManager(name: string, segment?: string | null): AM {
  const db = getDb();
  const maxId = (db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM account_managers").get() as { m: number }).m;
  const code = "AM" + String(maxId + 1).padStart(2, "0");
  const info = db
    .prepare(
      "INSERT INTO account_managers (code, name, account, zone, track, profile_complete, segment) VALUES (?, ?, '', 'MEA', 'Acquisition', 0, ?)"
    )
    .run(code, name.trim(), segment && segment.trim() !== "" ? segment.trim() : null);
  return getAM(Number(info.lastInsertRowid))!;
}

/** Complete (or edit) an Account Manager's profile — used by first-sign-in onboarding. */
export function updateAccountManagerProfile(
  amId: number,
  p: { name: string; account: string; zone: string; track: string; segment: string }
) {
  getDb()
    .prepare(
      "UPDATE account_managers SET name = ?, account = ?, zone = ?, track = ?, segment = ?, profile_complete = 1 WHERE id = ?"
    )
    .run(p.name.trim(), p.account.trim(), p.zone, p.track, p.segment, amId);
}

/** Superadmin: set (or clear) an AM's assessment schedule. */
export function setAssessmentSchedule(
  amId: number,
  s: { managerDeadline: string | null; panelDatetime: string | null }
) {
  getDb()
    .prepare("UPDATE account_managers SET manager_deadline = ?, panel_datetime = ? WHERE id = ?")
    .run(s.managerDeadline, s.panelDatetime, amId);
}

/** Human-readable date ("12 Aug 2026") / datetime ("12 Aug 2026, 14:30") for schedule strings. */
export function formatScheduleDate(value: string, withTime = false): string {
  const d = new Date(withTime && !value.includes("T") ? `${value}T00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime || !value.includes("T")) return date;
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * The assessment-window gate. Deadlines are inclusive of their day: the manager can work
 * until the end of manager_deadline; the APEX Panel until the end of the panel-call day
 * (so they can still score during and right after the call). Returns null when open, or
 * a human-readable reason when that lens can no longer assess this AM.
 */
export function assessmentLock(am: AM, lens: Lens): string | null {
  const pastEndOfDay = (value: string) => {
    const end = new Date(`${value.slice(0, 10)}T23:59:59.999`);
    return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
  };
  if (lens === "manager" && am.manager_deadline && pastEndOfDay(am.manager_deadline)) {
    return `The manager assessment window closed on ${formatScheduleDate(am.manager_deadline)}.`;
  }
  if (lens === "expert" && am.panel_datetime && pastEndOfDay(am.panel_datetime)) {
    return `The APEX Panel assessment took place on ${formatScheduleDate(am.panel_datetime, true)} and is now closed.`;
  }
  return null;
}

/** The display name of whoever submitted (or owns the draft of) each lens for an AM.
 *  Superadmin-only surfaces use this; it does not break blind assessment between evaluators. */
export function ratersByLens(amId: number): Partial<Record<Lens, string>> {
  const rows = getDb()
    .prepare(
      `SELECT a.lens, u.display_name AS name
       FROM assessments a JOIN users u ON u.id = a.rater_user_id
       WHERE a.am_id = ?`
    )
    .all(amId) as { lens: Lens; name: string }[];
  const out: Partial<Record<Lens, string>> = {};
  for (const r of rows) out[r.lens] = r.name;
  return out;
}

export function listCapabilities(): Capability[] {
  return getDb().prepare("SELECT * FROM capabilities ORDER BY ord").all() as Capability[];
}

/** Required level of a capability for an AM's track; null = not assessed on that track. */
export function requiredLevel(cap: Capability, track: AM["track"]): number | null {
  return track === "Acquisition" ? cap.req_acq : cap.req_sat;
}

// ---------- assessments & ratings ----------

export type Assessment = {
  id: number;
  am_id: number;
  lens: Lens;
  rater_user_id: number | null;
  status: "draft" | "submitted";
  updated_at: string | null;
  submitted_at: string | null;
};

export function getAssessment(amId: number, lens: Lens): Assessment | undefined {
  return getDb()
    .prepare("SELECT * FROM assessments WHERE am_id = ? AND lens = ?")
    .get(amId, lens) as Assessment | undefined;
}

export function getOrCreateAssessment(amId: number, lens: Lens, raterUserId: number): Assessment {
  const db = getDb();
  const existing = getAssessment(amId, lens);
  if (existing) return existing;
  db.prepare(
    "INSERT INTO assessments (am_id, lens, rater_user_id, updated_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(amId, lens, raterUserId);
  return getAssessment(amId, lens)!;
}

export type RatingRow = { capability_id: number; level: number | null; note: string | null };

export function getRatings(assessmentId: number): RatingRow[] {
  return getDb()
    .prepare("SELECT capability_id, level, note FROM ratings WHERE assessment_id = ?")
    .all(assessmentId) as RatingRow[];
}

export function upsertRating(assessmentId: number, capabilityId: number, level: number | null) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ratings (assessment_id, capability_id, level)
     VALUES (?, ?, ?)
     ON CONFLICT (assessment_id, capability_id) DO UPDATE SET level = excluded.level`
  ).run(assessmentId, capabilityId, level);
  db.prepare("UPDATE assessments SET updated_at = datetime('now') WHERE id = ?").run(assessmentId);
}

// ---------- theme (cluster) notes ----------

export type ThemeNoteFull = {
  cluster: string;
  note: string | null; // Manager / APEX Panel single justification
  situation: string | null; // the five self-assessor framework answers
  actions: string | null;
  results: string | null;
  impact: string | null;
  replication: string | null;
};

const THEME_FIELDS = ["note", "situation", "actions", "results", "impact", "replication"] as const;
export type ThemeField = (typeof THEME_FIELDS)[number];

/** Every theme row on one assessment (draft or submitted), all fields — for the wizard's initial state. */
export function getThemeNotesFull(assessmentId: number): ThemeNoteFull[] {
  return getDb()
    .prepare(
      "SELECT cluster, note, situation, actions, results, impact, replication FROM theme_notes WHERE assessment_id = ?"
    )
    .all(assessmentId) as ThemeNoteFull[];
}

/** Save one field of a theme's justification (Manager/Panel `note`, or a self framework field). */
export function saveThemeField(assessmentId: number, cluster: string, field: ThemeField, value: string | null) {
  if (!THEME_FIELDS.includes(field)) throw new Error("Invalid theme field.");
  const db = getDb();
  const v = value && value.trim() !== "" ? value.trim() : null;
  db.prepare(
    `INSERT INTO theme_notes (assessment_id, cluster, ${field}) VALUES (?, ?, ?)
     ON CONFLICT (assessment_id, cluster) DO UPDATE SET ${field} = excluded.${field}`
  ).run(assessmentId, cluster, v);
  // drop a row that has become entirely empty
  db.prepare(
    `DELETE FROM theme_notes WHERE assessment_id = ? AND cluster = ?
       AND note IS NULL AND situation IS NULL AND actions IS NULL AND results IS NULL AND impact IS NULL AND replication IS NULL`
  ).run(assessmentId, cluster);
  db.prepare("UPDATE assessments SET updated_at = datetime('now') WHERE id = ?").run(assessmentId);
}

/** Readable justification text for a theme row: the single note every lens now writes. */
export function themeJustificationText(row: Partial<ThemeNoteFull>): string {
  const note = (row.note ?? "").trim();
  if (note) return note;
  // legacy fallback: a self-assessment saved under the old five-field framework
  const fw: (string | null | undefined)[] = [row.situation, row.actions, row.results, row.impact, row.replication];
  const labels = ["Situation", "Actions", "Results", "Impact", "Replication"];
  return fw.map((v, i) => (v && v.trim() ? `${labels[i]}: ${v.trim()}` : "")).filter(Boolean).join("\n");
}

/** Clusters on this assessment still missing their required justification (the submit gate).
 *  Every lens now writes one justification note per theme. */
export function unjustifiedThemes(assessmentId: number): string[] {
  const clusters: string[] = [];
  const seen = new Set<string>();
  for (const c of listCapabilities()) if (!seen.has(c.cluster)) { seen.add(c.cluster); clusters.push(c.cluster); }
  const byCluster = new Map(getThemeNotesFull(assessmentId).map((n) => [n.cluster, n]));
  const has = (v: string | null | undefined) => !!(v && v.trim());
  return clusters.filter((cl) => !has(byCluster.get(cl)?.note));
}

export function submitAssessment(assessmentId: number, raterUserId: number) {
  // record who actually submitted, so the individual view/PDF names the right evaluator
  getDb()
    .prepare(
      "UPDATE assessments SET status = 'submitted', submitted_at = datetime('now'), rater_user_id = ? WHERE id = ? AND status = 'draft'"
    )
    .run(raterUserId, assessmentId);
}

export function reopenAssessment(assessmentId: number) {
  getDb()
    .prepare("UPDATE assessments SET status = 'draft', submitted_at = NULL WHERE id = ?")
    .run(assessmentId);
}

/** How many capabilities are rated for an assessment. */
export function ratedCount(assessmentId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM ratings WHERE assessment_id = ? AND level IS NOT NULL")
      .get(assessmentId) as { n: number }
  ).n;
}

// ---------- assignments ----------

export function assignedAMs(userId: number): AM[] {
  return getDb()
    .prepare(
      `SELECT am.* FROM assignments a JOIN account_managers am ON am.id = a.am_id
       WHERE a.user_id = ? ORDER BY am.code`
    )
    .all(userId) as AM[];
}

export function isAssigned(userId: number, amId: number): boolean {
  return !!getDb()
    .prepare("SELECT 1 FROM assignments WHERE user_id = ? AND am_id = ?")
    .get(userId, amId);
}

export function setAssignments(userId: number, amIds: number[]) {
  const db = getDb();
  // A self-assessor is linked to exactly one Account Manager — themselves. Enforce that
  // invariant here so it holds no matter which form calls this.
  const u = db.prepare("SELECT lens FROM users WHERE id = ?").get(userId) as { lens: string | null } | undefined;
  const ids = u?.lens === "self" ? amIds.slice(0, 1) : amIds;
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM assignments WHERE user_id = ?").run(userId);
    const ins = db.prepare("INSERT INTO assignments (user_id, am_id) VALUES (?, ?)");
    for (const id of ids) ins.run(userId, id);
  });
  tx();
}

// ---------- app settings (key/value) ----------

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  const db = getDb();
  if (value == null) {
    db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  } else {
    db.prepare(
      "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
    ).run(key, value);
  }
}

// ---------- users ----------

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  role: "superadmin" | "assessor";
  lens: Lens | null;
  active: number;
  created_at: string;
};

export function listUsers(): UserRow[] {
  return getDb()
    .prepare("SELECT id, username, display_name, role, lens, active, created_at FROM users ORDER BY role DESC, display_name")
    .all() as UserRow[];
}

// ---------- analysis ----------

/** Map: lens -> (capability_id -> level), submitted assessments only. */
export function submittedLevels(amId: number): Record<Lens, Map<number, number>> {
  const db = getDb();
  const out: Record<Lens, Map<number, number>> = {
    self: new Map(),
    manager: new Map(),
    expert: new Map(),
  };
  const rows = db
    .prepare(
      `SELECT a.lens, r.capability_id, r.level
       FROM assessments a JOIN ratings r ON r.assessment_id = a.id
       WHERE a.am_id = ? AND a.status = 'submitted' AND r.level IS NOT NULL`
    )
    .all(amId) as { lens: Lens; capability_id: number; level: number }[];
  for (const row of rows) out[row.lens].set(row.capability_id, row.level);
  return out;
}

/** Submitted theme justifications across all three lenses (every lens now writes one note
 *  per theme), for the individual analysis view and PDF. Call themeJustificationText(row)
 *  for display text. Rows with no content are excluded. */
export function submittedThemeNotes(amId: number): (ThemeNoteFull & { lens: Lens })[] {
  return getDb()
    .prepare(
      `SELECT a.lens, t.cluster, t.note, t.situation, t.actions, t.results, t.impact, t.replication
       FROM assessments a JOIN theme_notes t ON t.assessment_id = a.id
       WHERE a.am_id = ? AND a.status = 'submitted' AND a.lens IN ('self','manager','expert')
         AND (t.note IS NOT NULL OR t.situation IS NOT NULL OR t.actions IS NOT NULL
              OR t.results IS NOT NULL OR t.impact IS NOT NULL OR t.replication IS NOT NULL)`
    )
    .all(amId) as (ThemeNoteFull & { lens: Lens })[];
}

/** True once all three lenses (Self, Manager, APEX Panel) have submitted for this AM —
 *  the gate for releasing feedback to the assessed person. */
export function allLensesSubmitted(amId: number): boolean {
  return (["self", "manager", "expert"] as const).every(
    (lens) => getAssessment(amId, lens)?.status === "submitted"
  );
}

export type LensStatus = { status: "missing" | "draft" | "submitted"; rated: number };

/** Per-AM per-lens progress for roster tables. */
export function assessmentStatuses(): Map<number, Record<Lens, LensStatus>> {
  const db = getDb();
  const out = new Map<number, Record<Lens, LensStatus>>();
  for (const am of listAMs()) {
    out.set(am.id, {
      self: { status: "missing", rated: 0 },
      manager: { status: "missing", rated: 0 },
      expert: { status: "missing", rated: 0 },
    });
  }
  const rows = db
    .prepare(
      `SELECT a.am_id, a.lens, a.status,
              (SELECT COUNT(*) FROM ratings r WHERE r.assessment_id = a.id AND r.level IS NOT NULL) AS rated
       FROM assessments a`
    )
    .all() as { am_id: number; lens: Lens; status: "draft" | "submitted"; rated: number }[];
  for (const r of rows) {
    const rec = out.get(r.am_id);
    if (rec) rec[r.lens] = { status: r.status, rated: r.rated };
  }
  return out;
}

export type HeatCell = {
  avgScore: number | null; // average APEX Panel score across applicable AMs
  avgReq: number | null;
  gap: number | null; // avgScore - avgReq
  n: number; // number of AMs contributing
};

/** One capability's full picture for an AM: the three lens levels, the weighted score,
 *  the required level, and the gap (weighted − required). Shared by the individual
 *  analysis page, My Feedback and the PDF so they can never drift apart. */
export type ScoredRow = {
  cap: Capability;
  req: number | null;
  self?: number;
  manager?: number;
  expert?: number;
  weighted: number | null; // Self 20% / Panel 35% / Manager 45%, re-normalised
  gap: number | null; // weighted − required (decimal)
  perception: number | null; // self − weighted, for the perception views
};

/** Every capability scored for one AM, in rubric order. */
export function scoredRows(amId: number, track: AM["track"]): ScoredRow[] {
  const levels = submittedLevels(amId);
  return listCapabilities().map((cap) => {
    const self = levels.self.get(cap.id);
    const manager = levels.manager.get(cap.id);
    const expert = levels.expert.get(cap.id);
    const req = requiredLevel(cap, track);
    const weighted = weightedScore({ self, manager, expert });
    return {
      cap,
      req,
      self,
      manager,
      expert,
      weighted,
      gap: req != null && weighted != null ? weighted - req : null,
      perception: self != null && weighted != null ? self - weighted : null,
    };
  });
}

/** Weighted average of a set of scored rows (only rows that have a weighted score). */
export function averageWeighted(rows: ScoredRow[]): number | null {
  const vals = rows.map((r) => r.weighted).filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Average required level across rows that apply to the AM's track. */
export function averageRequired(rows: ScoredRow[]): number | null {
  const vals = rows.map((r) => r.req).filter((v): v is number => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Per-capability WEIGHTED score for one AM (Self 20% / APEX Panel 35% / Manager 45%),
 * built from the submitted assessments. This is the canonical score behind every average,
 * gap and metric in the app — see `weightedScore` in seed-data.ts for the re-normalisation
 * rule when a lens has not submitted yet.
 */
export function weightedLevels(amId: number): Map<number, number> {
  const levels = submittedLevels(amId);
  const out = new Map<number, number>();
  for (const cap of listCapabilities()) {
    const score = weightedScore({
      self: levels.self.get(cap.id),
      manager: levels.manager.get(cap.id),
      expert: levels.expert.get(cap.id),
    });
    if (score != null) out.set(cap.id, score);
  }
  return out;
}

/**
 * Training-needs heat map: zone x capability, based on the WEIGHTED score of the submitted
 * assessments vs the required level for each AM's track. Capabilities not applicable to an
 * AM's track are skipped for that AM.
 */
export function zoneHeatmap(
  track?: AM["track"],
  segment?: string
): { zones: string[]; rows: { cap: Capability; cells: HeatCell[] }[] } {
  const caps = listCapabilities();
  const ams = listAMs().filter((am) => (!track || am.track === track) && (!segment || am.segment === segment));
  const byZone = new Map<string, AM[]>();
  for (const z of ZONES) byZone.set(z, []);
  for (const am of ams) byZone.get(am.zone)!.push(am);

  const levels = new Map<number, Map<number, number>>(); // amId -> capId -> weighted score
  for (const am of ams) levels.set(am.id, weightedLevels(am.id));

  const rows = caps.map((cap) => {
    const cells: HeatCell[] = ZONES.map((zone) => {
      let sumScore = 0,
        sumReq = 0,
        n = 0;
      for (const am of byZone.get(zone)!) {
        const req = requiredLevel(cap, am.track);
        if (req == null) continue;
        const score = levels.get(am.id)!.get(cap.id);
        if (score == null) continue;
        sumScore += score;
        sumReq += req;
        n++;
      }
      return n === 0
        ? { avgScore: null, avgReq: null, gap: null, n: 0 }
        : { avgScore: sumScore / n, avgReq: sumReq / n, gap: (sumScore - sumReq) / n, n };
    });
    return { cap, cells };
  });

  return { zones: [...ZONES], rows };
}

// ---------- group profiles (the population radars) ----------
//
// Everything above is per-person. The dashboard reports the client asked for are per
// POPULATION: one radar per zone, per segment, per zone+track, and one for the whole of
// International Operations, each showing the 6 cluster capabilities against the 3 lenses
// plus the level the track expects.
//
// Two rules make these numbers trustworthy, and both are easy to get wrong:
//
//  1. Average the PEOPLE, not the ratings. Each Account Manager contributes one value per
//     cluster, so a zone with one heavily-rated person and one barely-rated person is not
//     skewed toward whoever has more submitted capabilities.
//  2. Respect track applicability. Acquisition Excellence has no required level on the
//     Saturation track and vice versa, so a mixed-track population has a required level for
//     a cluster only from the people it actually applies to. A cluster nobody in the group
//     is measured on is reported as null, never as zero: zero would drag the expected web
//     to the centre of the radar and read as "target met".

export type ClusterProfile = {
  cluster: string;
  self: number | null;
  manager: number | null;
  expert: number | null;
  weighted: number | null;
  required: number | null;
  /** how many Account Managers contributed a weighted score to this cluster */
  n: number;
};

export type GroupProfile = {
  label: string;
  amCount: number;
  /** AMs with at least one submitted rating; the radar is drawn from these */
  scoredCount: number;
  clusters: ClusterProfile[];
  overallWeighted: number | null;
  overallRequired: number | null;
  overallGap: number | null;
};

/**
 * Cluster-by-cluster profile of a population of Account Managers.
 *
 * Pass any list of AMs: a zone, a segment, a zone crossed with a track, or the whole
 * roster. Returns one row per cluster in rubric order, so several groups can be plotted on
 * radars with identical axes and compared against each other.
 */
export function groupProfile(label: string, ams: AM[]): GroupProfile {
  const caps = listCapabilities();
  const clusterOrder: string[] = [];
  for (const c of caps) if (!clusterOrder.includes(c.cluster)) clusterOrder.push(c.cluster);

  // one person's per-capability picture, computed once and reused for every cluster
  const perAm = ams.map((am) => ({ am, rows: scoredRows(am.id, am.track) }));
  const scoredCount = perAm.filter((p) => p.rows.some((r) => r.weighted != null)).length;

  const clusters: ClusterProfile[] = clusterOrder.map((cluster) => {
    // each AM contributes ONE mean per lens for this cluster, so people weigh equally
    const per: Record<"self" | "manager" | "expert" | "weighted" | "required", number[]> = {
      self: [], manager: [], expert: [], weighted: [], required: [],
    };
    let n = 0;
    for (const { rows } of perAm) {
      const inCluster = rows.filter((r) => r.cap.cluster === cluster);
      const mean = (vals: (number | null | undefined)[]) => {
        const v = vals.filter((x): x is number => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      const w = mean(inCluster.map((r) => r.weighted));
      const req = mean(inCluster.map((r) => r.req));
      const self = mean(inCluster.map((r) => r.self));
      const manager = mean(inCluster.map((r) => r.manager));
      const expert = mean(inCluster.map((r) => r.expert));
      if (w != null) { per.weighted.push(w); n++; }
      if (req != null) per.required.push(req);
      if (self != null) per.self.push(self);
      if (manager != null) per.manager.push(manager);
      if (expert != null) per.expert.push(expert);
    }
    const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
    return {
      cluster,
      self: avg(per.self),
      manager: avg(per.manager),
      expert: avg(per.expert),
      weighted: avg(per.weighted),
      required: avg(per.required),
      n,
    };
  });

  // Overall figures come from the capability rows directly, not from the cluster means:
  // clusters hold different numbers of capabilities, so averaging the six cluster averages
  // would silently weight a 2-capability cluster the same as a 6-capability one.
  const applicable = perAm.flatMap((p) => p.rows.filter((r) => r.req != null));
  const overallWeighted = averageWeighted(applicable);
  const overallRequired = averageRequired(applicable);

  return {
    label,
    amCount: ams.length,
    scoredCount,
    clusters,
    overallWeighted,
    overallRequired,
    overallGap:
      overallWeighted != null && overallRequired != null ? overallWeighted - overallRequired : null,
  };
}

/** One profile per zone, in the canonical zone order. Zones with nobody in them are kept
 *  so the deck has a consistent shape from run to run. */
export function zoneProfiles(ams: AM[] = listAMs()): GroupProfile[] {
  return ZONES.map((zone) => groupProfile(zone, ams.filter((am) => am.zone === zone)));
}

/** One profile per business segment. Segment is nullable on an AM, so anyone without one
 *  is grouped under "Unassigned" rather than being dropped silently. */
export function segmentProfiles(ams: AM[] = listAMs()): GroupProfile[] {
  const labels: string[] = [];
  for (const am of ams) {
    const seg = am.segment ?? "Unassigned";
    if (!labels.includes(seg)) labels.push(seg);
  }
  labels.sort((a, b) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)));
  return labels.map((seg) =>
    groupProfile(seg, ams.filter((am) => (am.segment ?? "Unassigned") === seg))
  );
}

/** Per zone, one profile for each track: the "where is Acquisition weak, where is
 *  Saturation weak" view. Empty combinations are returned with amCount 0 so the report can
 *  say so explicitly instead of leaving a hole in the grid. */
export function zoneTrackProfiles(
  ams: AM[] = listAMs()
): { zone: string; tracks: GroupProfile[] }[] {
  return ZONES.map((zone) => ({
    zone,
    tracks: (["Acquisition", "Saturation"] as const).map((track) =>
      groupProfile(track, ams.filter((am) => am.zone === zone && am.track === track))
    ),
  }));
}

/** Largest zone-level deficits — the "who to train on what, where" list. */
export function trainingPriorities(limit = 6, track?: AM["track"], segment?: string) {
  const { zones, rows } = zoneHeatmap(track, segment);
  const flat: { zone: string; cap: Capability; cell: HeatCell }[] = [];
  for (const row of rows)
    row.cells.forEach((cell, i) => {
      if (cell.gap != null && cell.gap < 0) flat.push({ zone: zones[i], cap: row.cap, cell });
    });
  flat.sort((a, b) => a.cell.gap! - b.cell.gap!);
  return flat.slice(0, limit);
}

/** Overall completion + maturity stats for the dashboard. */
export function overviewStats() {
  const db = getDb();
  const amCount = (db.prepare("SELECT COUNT(*) AS n FROM account_managers").get() as { n: number }).n;
  const submitted = db
    .prepare("SELECT lens, COUNT(*) AS n FROM assessments WHERE status = 'submitted' GROUP BY lens")
    .all() as { lens: Lens; n: number }[];
  const byLens: Record<Lens, number> = { self: 0, manager: 0, expert: 0 };
  for (const s of submitted) byLens[s.lens] = s.n;

  // Programme-wide maturity is the WEIGHTED average: average each lens's submitted ratings,
  // then combine those means with the lens weights (re-normalised over the lenses present).
  const perLens = db
    .prepare(
      `SELECT a.lens AS lens, AVG(r.level) AS avg FROM ratings r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE a.status = 'submitted' AND r.level IS NOT NULL
       GROUP BY a.lens`
    )
    .all() as { lens: Lens; avg: number | null }[];
  const meanByLens: Partial<Record<Lens, number>> = {};
  for (const row of perLens) if (row.avg != null) meanByLens[row.lens] = row.avg;
  const avgWeighted = weightedScore(meanByLens);

  // The benchmark the maturity score should be read against: the average required level
  // across every AM's own track. A score without it is just a number.
  const reqRow = db
    .prepare(
      `SELECT AVG(CASE WHEN am.track = 'Acquisition' THEN c.req_acq ELSE c.req_sat END) AS avg
       FROM account_managers am CROSS JOIN capabilities c
       WHERE (CASE WHEN am.track = 'Acquisition' THEN c.req_acq ELSE c.req_sat END) IS NOT NULL`
    )
    .get() as { avg: number | null };
  const avgRequired = reqRow.avg;

  return { amCount, byLens, avgWeighted, avgRequired, weights: LENS_WEIGHTS, lenses: LENSES };
}

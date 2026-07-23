import { getDb } from "./db";
import { ZONES, type Lens } from "./seed-data";

export type AM = {
  id: number;
  code: string;
  name: string;
  account: string;
  zone: (typeof ZONES)[number];
  track: "Acquisition" | "Saturation";
  segment: string | null; // business segment (Power & Grid / Energy & Chemicals / CS&P / Multi-segment)
  profile_complete: number; // 0 = created for a person who still needs to fill in their details
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

/**
 * Training-needs heat map: zone x capability, based on submitted APEX Panel scores
 * vs the required level for each AM's track. Capabilities not applicable to an AM's
 * track are skipped for that AM.
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

  const levels = new Map<number, Map<number, number>>(); // amId -> capId -> expert level
  for (const am of ams) levels.set(am.id, submittedLevels(am.id).expert);

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

  const avgRow = db
    .prepare(
      `SELECT AVG(r.level) AS avg FROM ratings r
       JOIN assessments a ON a.id = r.assessment_id
       WHERE a.status = 'submitted' AND a.lens = 'expert' AND r.level IS NOT NULL`
    )
    .get() as { avg: number | null };

  return { amCount, byLens, avgExpert: avgRow.avg };
}

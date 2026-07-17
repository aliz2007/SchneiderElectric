import { getDb } from "./db";
import { ZONES, type Lens } from "./seed-data";

export type AM = {
  id: number;
  code: string;
  name: string;
  account: string;
  zone: (typeof ZONES)[number];
  track: "Acquisition" | "Saturation";
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

export function upsertRating(assessmentId: number, capabilityId: number, level: number | null, note: string | null) {
  const db = getDb();
  db.prepare(
    `INSERT INTO ratings (assessment_id, capability_id, level, note)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (assessment_id, capability_id) DO UPDATE SET level = excluded.level, note = excluded.note`
  ).run(assessmentId, capabilityId, level, note);
  db.prepare("UPDATE assessments SET updated_at = datetime('now') WHERE id = ?").run(assessmentId);
}

export function submitAssessment(assessmentId: number) {
  getDb()
    .prepare(
      "UPDATE assessments SET status = 'submitted', submitted_at = datetime('now') WHERE id = ? AND status = 'draft'"
    )
    .run(assessmentId);
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
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM assignments WHERE user_id = ?").run(userId);
    const ins = db.prepare("INSERT INTO assignments (user_id, am_id) VALUES (?, ?)");
    for (const id of amIds) ins.run(userId, id);
  });
  tx();
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

export function submittedNotes(amId: number): { lens: Lens; capability_id: number; note: string }[] {
  return getDb()
    .prepare(
      `SELECT a.lens, r.capability_id, r.note
       FROM assessments a JOIN ratings r ON r.assessment_id = a.id
       WHERE a.am_id = ? AND a.status = 'submitted' AND r.note IS NOT NULL AND TRIM(r.note) != ''
       ORDER BY r.capability_id`
    )
    .all(amId) as { lens: Lens; capability_id: number; note: string }[];
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
export function zoneHeatmap(): { zones: string[]; rows: { cap: Capability; cells: HeatCell[] }[] } {
  const caps = listCapabilities();
  const ams = listAMs();
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
export function trainingPriorities(limit = 6) {
  const { zones, rows } = zoneHeatmap();
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

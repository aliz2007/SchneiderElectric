import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITIES, ROSTER } from "./seed-data";
import { hashPassword } from "./auth";

// The superadmin seeded on first launch. Change the password after first login.
export const DEFAULT_ADMIN = { username: "vladimir", password: "apex2026", displayName: "Vladimir" };

declare global {
  // eslint-disable-next-line no-var
  var __apexDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (globalThis.__apexDb) return globalThis.__apexDb;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "apex.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalThis.__apexDb = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('superadmin','assessor')),
      lens TEXT CHECK (lens IN ('self','manager','expert')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_managers (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      account TEXT NOT NULL,
      zone TEXT NOT NULL CHECK (zone IN ('MEA','SAM','India','Pacific')),
      track TEXT NOT NULL CHECK (track IN ('Acquisition','Saturation')),
      -- 0 = created for a person who still needs to fill in their details on first sign-in
      profile_complete INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS capabilities (
      id INTEGER PRIMARY KEY,
      ord INTEGER NOT NULL,
      name TEXT NOT NULL,
      cluster TEXT NOT NULL,
      src TEXT NOT NULL,
      req_acq INTEGER,
      req_sat INTEGER,
      l1 TEXT NOT NULL,
      l2 TEXT NOT NULL,
      l3 TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      am_id INTEGER NOT NULL REFERENCES account_managers(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, am_id)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY,
      am_id INTEGER NOT NULL REFERENCES account_managers(id) ON DELETE CASCADE,
      lens TEXT NOT NULL CHECK (lens IN ('self','manager','expert')),
      rater_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
      updated_at TEXT,
      submitted_at TEXT,
      UNIQUE (am_id, lens)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      capability_id INTEGER NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
      level INTEGER CHECK (level IN (1,2,3)),
      note TEXT,
      PRIMARY KEY (assessment_id, capability_id)
    );

    -- One mandatory justification note per theme (capability cluster) per assessment,
    -- written by every lens (self-assessors from a guided prompt, Manager/Panel free text).
    -- The legacy framework columns (situation/actions/...) are added by migration below.
    CREATE TABLE IF NOT EXISTS theme_notes (
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      cluster TEXT NOT NULL,
      note TEXT,
      PRIMARY KEY (assessment_id, cluster)
    );

    -- Simple key/value store for runtime settings (e.g. the Kimi/Moonshot AI config
    -- entered in the app instead of via .env.local).
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- The same idea, scoped to one person. Holds the dashboard's arrangement and colours
    -- (dashboard.layout, theme.colors): each superadmin arranges and colours their own
    -- dashboard, so these cannot live in app_settings, which is installation-wide.
    -- Deleting a user takes their preferences with them.
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key)
    );
  `);

  // Arranging the dashboard shipped for a few hours storing its state globally, before the
  // client asked for it per superadmin. Clear the two orphaned rows so nobody reading the
  // database later mistakes them for live settings. Idempotent, and it deliberately names
  // the two keys rather than emptying the table: app_settings still holds the AI config.
  db.prepare("DELETE FROM app_settings WHERE key IN ('dashboard.layout','theme.accent')").run();

  // add profile_complete to account_managers for databases created before onboarding existed
  try {
    db.exec("ALTER TABLE account_managers ADD COLUMN profile_complete INTEGER NOT NULL DEFAULT 1");
  } catch {
    /* column already exists */
  }
  // business segment on the account (picked at account creation / onboarding)
  try {
    db.exec("ALTER TABLE account_managers ADD COLUMN segment TEXT");
  } catch {
    /* column already exists */
  }
  // assessment schedule, set by superadmins on the individual page:
  //  - manager_deadline (YYYY-MM-DD): the manager can no longer assess once this date has passed
  //  - panel_datetime (YYYY-MM-DDTHH:MM): when the assessed person and the APEX Panel hold
  //    their assessment call; the panel can no longer assess once that day has passed
  //  - self_deadline (YYYY-MM-DD): the assessed person can no longer self-assess past this date
  for (const col of ["manager_deadline", "panel_datetime", "self_deadline"]) {
    try {
      db.exec(`ALTER TABLE account_managers ADD COLUMN ${col} TEXT`);
    } catch {
      /* column already exists */
    }
  }
  // Account tier and business performance, both asked for in the client's dashboard
  // proposal. account_type is the Schneider account-tier concept ("Account Type" in their
  // table); perf_ytd is a performance figure whose unit the client defines (see
  // PERF_YTD_LABEL in seed-data.ts). Both are set per Account Manager by a superadmin.
  try {
    db.exec("ALTER TABLE account_managers ADD COLUMN account_type TEXT");
  } catch {
    /* column already exists */
  }
  try {
    db.exec("ALTER TABLE account_managers ADD COLUMN perf_ytd REAL");
  } catch {
    /* column already exists */
  }
  // backfill the roster's segment on databases seeded before segments existed, matching by
  // code and never overwriting a segment someone has already chosen
  {
    const setSeg = db.prepare(
      "UPDATE account_managers SET segment = ? WHERE code = ? AND (segment IS NULL OR segment = '')"
    );
    for (const am of ROSTER) setSeg.run(am.segment, am.code);
  }
  // The CS&P segment label used to contain a standalone "-", which the client asked us to
  // remove from every user-facing string. The label is stored on the row, so existing
  // databases need the value rewritten or the segment filter stops matching. Idempotent.
  db.prepare("UPDATE account_managers SET segment = ? WHERE segment = ?").run(
    "CS&P · Cloud & Service Providers",
    "CS&P - Cloud & Service Providers"
  );
  // Heal demo databases seeded BEFORE the roster names were made fictional: bring each
  // seeded AM's name in line with ROSTER by code. Idempotent (no-op once names match). This
  // is safe because the seeded 25 AMs have no in-app name-edit path — onboarding only fills
  // brand-new accounts (codes past AM25), so this never clobbers a user-entered name.
  {
    const rename = db.prepare("UPDATE account_managers SET name = ? WHERE code = ? AND name <> ?");
    for (const am of ROSTER) rename.run(am.name, am.code, am.name);
  }
  // the self-assessor's five APEX framework answers per theme (Manager/Panel still use `note`)
  for (const col of ["situation", "actions", "results", "impact", "replication"]) {
    try {
      db.exec(`ALTER TABLE theme_notes ADD COLUMN ${col} TEXT`);
    } catch {
      /* column already exists */
    }
  }

  const capCount = (db.prepare("SELECT COUNT(*) AS n FROM capabilities").get() as { n: number }).n;
  if (capCount === 0) {
    const insCap = db.prepare(
      `INSERT INTO capabilities (ord, name, cluster, src, req_acq, req_sat, l1, l2, l3)
       VALUES (@ord, @name, @cluster, @src, @reqAcq, @reqSat, @l1, @l2, @l3)`
    );
    for (const c of CAPABILITIES) insCap.run(c);
  }

  const amCount = (db.prepare("SELECT COUNT(*) AS n FROM account_managers").get() as { n: number }).n;
  if (amCount === 0) {
    const insAm = db.prepare(
      `INSERT INTO account_managers (code, name, account, zone, track, segment, account_type)
       VALUES (@code, @name, @account, @zone, @track, @segment, @accountType)`
    );
    for (const am of ROSTER) insAm.run({ ...am, accountType: am.accountType ?? null });
  }

  // Backfill the demo account tier on databases seeded BEFORE the column existed, matching
  // by code and never overwriting one somebody has set. This has to run AFTER the roster
  // insert above: on a fresh database there are no rows to update at migration time.
  {
    const setType = db.prepare(
      "UPDATE account_managers SET account_type = ? WHERE code = ? AND (account_type IS NULL OR account_type = '')"
    );
    for (const am of ROSTER) if (am.accountType) setType.run(am.accountType, am.code);
  }

  const admin = db.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").get();
  if (!admin) {
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, lens)
       VALUES (?, ?, ?, 'superadmin', NULL)`
    ).run(DEFAULT_ADMIN.username, hashPassword(DEFAULT_ADMIN.password), DEFAULT_ADMIN.displayName);
  }
}

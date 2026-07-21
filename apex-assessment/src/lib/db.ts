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

    -- One free-text note per theme (capability cluster) per assessment. Captured by
    -- Manager / APEX Panel evaluators only (self-assessments carry no notes).
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
  `);

  // add profile_complete to account_managers for databases created before onboarding existed
  try {
    db.exec("ALTER TABLE account_managers ADD COLUMN profile_complete INTEGER NOT NULL DEFAULT 1");
  } catch {
    /* column already exists */
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
      `INSERT INTO account_managers (code, name, account, zone, track)
       VALUES (@code, @name, @account, @zone, @track)`
    );
    for (const am of ROSTER) insAm.run(am);
  }

  const admin = db.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").get();
  if (!admin) {
    db.prepare(
      `INSERT INTO users (username, password_hash, display_name, role, lens)
       VALUES (?, ?, ?, 'superadmin', NULL)`
    ).run(DEFAULT_ADMIN.username, hashPassword(DEFAULT_ADMIN.password), DEFAULT_ADMIN.displayName);
  }
}

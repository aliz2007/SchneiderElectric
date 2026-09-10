"use server";

// Server actions for Users & Access: create, edit, assign, disable, delete users.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/session";
import { createAccountManager, listAMs, listCapabilities, setAssignments } from "@/lib/queries";

function amIdsFrom(formData: FormData): number[] {
  return formData.getAll("am").map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

export async function createUser(formData: FormData) {
  await requireSuperadmin();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "assessor");
  const lensRaw = String(formData.get("lens") ?? "");
  const lens = ["self", "manager", "expert"].includes(lensRaw) ? lensRaw : null;

  if (!displayName || !username || password.length < 6) {
    redirect("/admin/users?err=" + encodeURIComponent("Name, username and a password of 6+ characters are required."));
  }
  if (!["superadmin", "assessor"].includes(role)) redirect("/admin/users?err=Invalid+role");
  if (role === "assessor" && !lens) {
    redirect("/admin/users?err=" + encodeURIComponent("An assessor needs a lens (Self / Manager / APEX Panel)."));
  }

  const db = getDb();
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) redirect("/admin/users?err=" + encodeURIComponent(`Username "${username}" is already taken.`));

  const info = db
    .prepare("INSERT INTO users (username, password_hash, display_name, role, lens) VALUES (?, ?, ?, ?, ?)")
    .run(username, hashPassword(password), displayName, role, lens);
  const userId = Number(info.lastInsertRowid);

  if (lens === "self" && formData.get("am_new")) {
    // create this person as a new Account Manager; they complete their profile on first sign-in
    const am = createAccountManager(displayName);
    setAssignments(userId, [am.id]);
  } else {
    setAssignments(userId, amIdsFrom(formData));
  }
  redirect("/admin/users?ok=" + encodeURIComponent(`User "${displayName}" created.`));
}

export async function updateAssignments(userId: number, formData: FormData) {
  await requireSuperadmin();
  setAssignments(userId, amIdsFrom(formData));
  revalidatePath("/admin/users");
}

/** Set (or clear) a user's assessment lens after creation, e.g. to let a superadmin who
 *  also assesses get their assessment window. Lens is read fresh each request, so the nav
 *  and access update on the next page load. */
export async function updateLens(userId: number, formData: FormData) {
  await requireSuperadmin();
  const lensRaw = String(formData.get("lens") ?? "");
  const lens = ["self", "manager", "expert"].includes(lensRaw) ? lensRaw : null;
  getDb().prepare("UPDATE users SET lens = ? WHERE id = ?").run(lens, userId);
  redirect("/admin/users?ok=Lens+updated");
}

export async function toggleActive(userId: number) {
  const me = await requireSuperadmin();
  if (userId === me.id) redirect("/admin/users?err=" + encodeURIComponent("You cannot deactivate your own account."));
  getDb().prepare("UPDATE users SET active = 1 - active WHERE id = ?").run(userId);
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  revalidatePath("/admin/users");
}

/** Permanently delete a user. Sessions & assignments cascade; submitted assessments are
 *  kept (rater_user_id is set NULL). Guards against self-deletion and removing the last
 *  superadmin. */
export async function deleteUser(userId: number) {
  const me = await requireSuperadmin();
  if (userId === me.id) {
    redirect("/admin/users?err=" + encodeURIComponent("You cannot delete your own account."));
  }
  const db = getDb();
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    | { role: string }
    | undefined;
  if (!target) redirect("/admin/users?err=" + encodeURIComponent("That user no longer exists."));
  if (target!.role === "superadmin") {
    const admins = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get() as {
      n: number;
    }).n;
    if (admins <= 1) {
      redirect("/admin/users?err=" + encodeURIComponent("Cannot delete the only superadmin account."));
    }
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  redirect("/admin/users?ok=Account+deleted");
}

export async function resetPassword(userId: number, formData: FormData) {
  await requireSuperadmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect("/admin/users?err=" + encodeURIComponent("Password must be 6+ characters."));
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), userId);
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  redirect("/admin/users?ok=Password+updated");
}

/** Fill the campaign with plausible demo ratings (replaces ALL existing ratings). */
export async function loadDemoData() {
  const me = await requireSuperadmin();
  const db = getDb();
  const caps = listCapabilities();
  const ams = listAMs();

  // deterministic pseudo-random so repeated runs give stable, plausible data
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = (weights: number[]) => {
    const r = rand();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (r < acc) return i + 1;
    }
    return weights.length;
  };
  // classic pattern: self slightly optimistic, panel strictest
  const WEIGHTS: Record<string, number[]> = {
    self: [0.1, 0.5, 0.4],
    manager: [0.2, 0.55, 0.25],
    expert: [0.28, 0.52, 0.2],
  };

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM assessments").run();
    const insA = db.prepare(
      "INSERT INTO assessments (am_id, lens, rater_user_id, status, updated_at, submitted_at) VALUES (?, ?, ?, 'submitted', datetime('now'), datetime('now'))"
    );
    const insR = db.prepare(
      "INSERT INTO ratings (assessment_id, capability_id, level, note) VALUES (?, ?, ?, NULL)"
    );
    for (const am of ams) {
      for (const lens of ["self", "manager", "expert"] as const) {
        const aId = Number(insA.run(am.id, lens, me.id).lastInsertRowid);
        for (const cap of caps) insR.run(aId, cap.id, pick(WEIGHTS[lens]));
      }
    }
  });
  tx();
  redirect("/admin/users?ok=" + encodeURIComponent("Demo dataset loaded. See the Dashboard."));
}

/**
 * Provision a ready-to-use sandbox for trying the assessment flow from every lens:
 * three assessor logins (self / manager / APEX Panel) all linked to one Account
 * Manager, whose assessments are wiped to blank drafts so each wizard opens empty.
 * Idempotent — re-running resets the same three accounts and clears that AM again.
 */
export async function createSandboxAssessors() {
  await requireSuperadmin();
  const db = getDb();
  const am = db
    .prepare("SELECT id, code, name FROM account_managers ORDER BY code LIMIT 1")
    .get() as { id: number; code: string; name: string } | undefined;
  if (!am) redirect("/admin/users?err=" + encodeURIComponent("No Account Managers exist to assess."));

  const password = "demo1234";
  const hash = hashPassword(password);
  const accounts = [
    { username: "self.demo", displayName: "Demo Self (KAM)", lens: "self" },
    { username: "manager.demo", displayName: "Demo Manager", lens: "manager" },
    { username: "panel.demo", displayName: "Demo APEX Panel", lens: "expert" },
  ];

  const tx = db.transaction(() => {
    // blank slate for this AM so every lens opens an empty assessment
    db.prepare("DELETE FROM assessments WHERE am_id = ?").run(am!.id);
    for (const a of accounts) {
      const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(a.username) as
        | { id: number }
        | undefined;
      let userId: number;
      if (existing) {
        userId = existing.id;
        db.prepare(
          "UPDATE users SET password_hash = ?, display_name = ?, role = 'assessor', lens = ?, active = 1 WHERE id = ?"
        ).run(hash, a.displayName, a.lens, userId);
      } else {
        userId = Number(
          db
            .prepare("INSERT INTO users (username, password_hash, display_name, role, lens) VALUES (?, ?, ?, 'assessor', ?)")
            .run(a.username, hash, a.displayName, a.lens).lastInsertRowid
        );
      }
      // link all three to the same Account Manager, and drop stale sessions
      db.prepare("DELETE FROM assignments WHERE user_id = ?").run(userId);
      db.prepare("INSERT OR IGNORE INTO assignments (user_id, am_id) VALUES (?, ?)").run(userId, am!.id);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    }
  });
  tx();

  redirect(
    "/admin/users?ok=" +
      encodeURIComponent(
        `Sandbox ready. Sign in as self.demo, manager.demo or panel.demo (password ${password}), all set to assess ${am!.name} (${am!.code}) with a blank assessment. Then return here as superadmin to open Individuals → ${am!.name} and export the PDF.`
      )
  );
}

/** Delete every assessment & rating. Structure (AMs, capabilities, users) is kept. */
export async function clearAllRatings() {
  await requireSuperadmin();
  getDb().prepare("DELETE FROM assessments").run();
  redirect("/admin/users?ok=All+ratings+cleared");
}

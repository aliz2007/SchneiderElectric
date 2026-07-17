"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireSuperadmin } from "@/lib/session";
import { listAMs, listCapabilities, setAssignments } from "@/lib/queries";

function amIdsFrom(formData: FormData): number[] {
  return formData.getAll("am").map(Number).filter(Number.isInteger);
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

  setAssignments(Number(info.lastInsertRowid), amIdsFrom(formData));
  redirect("/admin/users?ok=" + encodeURIComponent(`User "${displayName}" created.`));
}

export async function updateAssignments(userId: number, formData: FormData) {
  await requireSuperadmin();
  setAssignments(userId, amIdsFrom(formData));
  revalidatePath("/admin/users");
}

export async function toggleActive(userId: number) {
  const me = await requireSuperadmin();
  if (userId === me.id) redirect("/admin/users?err=" + encodeURIComponent("You cannot deactivate your own account."));
  getDb().prepare("UPDATE users SET active = 1 - active WHERE id = ?").run(userId);
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  revalidatePath("/admin/users");
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
  redirect("/admin/users?ok=" + encodeURIComponent("Demo dataset loaded — see the Dashboard."));
}

/** Delete every assessment & rating. Structure (AMs, capabilities, users) is kept. */
export async function clearAllRatings() {
  await requireSuperadmin();
  getDb().prepare("DELETE FROM assessments").run();
  redirect("/admin/users?ok=All+ratings+cleared");
}

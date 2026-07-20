"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getAM, getAssessment, isAssigned, ratedCount } from "@/lib/queries";

export type AssignResult = { ok: boolean; error?: string };

/** Assessors add anyone to their own task list — no admin needed. */
export async function selfAssign(amId: number): Promise<AssignResult> {
  const user = await requireUser();
  if (!user.lens) return { ok: false, error: "Your account has no assessment lens configured." };
  if (user.lens === "self") {
    return { ok: false, error: "Self-assessors can only complete their own assessment." };
  }
  const am = getAM(amId);
  if (!am) return { ok: false, error: "Unknown Account Manager." };
  if (isAssigned(user.id, amId)) return { ok: true };

  // one evaluator per AM per lens — keeps assessments blind and unshared
  const rival = getDb()
    .prepare(
      `SELECT u.display_name AS name FROM assignments a
       JOIN users u ON u.id = a.user_id
       WHERE a.am_id = ? AND u.lens = ? AND u.id != ? AND u.active = 1
       LIMIT 1`
    )
    .get(amId, user.lens, user.id) as { name: string } | undefined;
  if (rival) {
    return {
      ok: false,
      error: `${am.name} is already being assessed by ${rival.name} under the same lens. Ask your administrator if you should take over.`,
    };
  }

  getDb().prepare("INSERT OR IGNORE INTO assignments (user_id, am_id) VALUES (?, ?)").run(user.id, amId);
  revalidatePath("/rate");
  return { ok: true };
}

/** Remove an AM from the caller's list — only while nothing has been rated yet. */
export async function selfUnassign(amId: number): Promise<AssignResult> {
  const user = await requireUser();
  if (!user.lens) return { ok: false, error: "Your account has no assessment lens configured." };
  const assessment = getAssessment(amId, user.lens);
  if (assessment && (assessment.status === "submitted" || ratedCount(assessment.id) > 0)) {
    return { ok: false, error: "This assessment has already been started — ask your administrator to remove it." };
  }
  const db = getDb();
  if (assessment) db.prepare("DELETE FROM assessments WHERE id = ?").run(assessment.id);
  db.prepare("DELETE FROM assignments WHERE user_id = ? AND am_id = ?").run(user.id, amId);
  revalidatePath("/rate");
  return { ok: true };
}

/** Form-action wrapper (form actions must return void). */
export async function selfUnassignAction(amId: number): Promise<void> {
  await selfUnassign(amId);
}

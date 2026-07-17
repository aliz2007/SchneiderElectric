"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import { getAssessment, reopenAssessment } from "@/lib/queries";
import type { Lens } from "@/lib/seed-data";

/** Superadmin-only: unlock a submitted assessment so the evaluator can revise it. */
export async function reopen(amId: number, lens: Lens) {
  await requireSuperadmin();
  const a = getAssessment(amId, lens);
  if (a && a.status === "submitted") reopenAssessment(a.id);
  revalidatePath(`/analysis/am/${amId}`);
}

"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getAM,
  getOrCreateAssessment,
  isAssigned,
  listCapabilities,
  ratedCount,
  submitAssessment,
  upsertRating,
  upsertThemeNote,
} from "@/lib/queries";

/** Auth + ownership guard shared by every mutation. Returns the caller's draft assessment. */
async function guard(amId: number) {
  const user = await requireUser();
  if (!user.lens) throw new Error("No assessment lens configured for this account.");
  if (!isAssigned(user.id, amId)) throw new Error("You are not assigned to this Account Manager.");
  const am = getAM(amId);
  if (!am) throw new Error("Unknown Account Manager.");
  const assessment = getOrCreateAssessment(amId, user.lens, user.id);
  return { user, am, assessment };
}

export async function saveRating(amId: number, capabilityId: number, level: number | null) {
  const { assessment } = await guard(amId);
  if (assessment.status === "submitted") throw new Error("Assessment already submitted.");
  if (level != null && ![1, 2, 3].includes(level)) throw new Error("Invalid level.");
  const capIds = new Set(listCapabilities().map((c) => c.id));
  if (!capIds.has(capabilityId)) throw new Error("Invalid capability.");
  upsertRating(assessment.id, capabilityId, level);
}

/**
 * Save a Manager / APEX Panel note for one theme (capability cluster). Self-assessors
 * do not capture notes, so the self lens is rejected server-side.
 */
export async function saveThemeNote(amId: number, cluster: string, note: string) {
  const { user, assessment } = await guard(amId);
  if (user.lens === "self") throw new Error("Self-assessments do not capture notes.");
  if (assessment.status === "submitted") throw new Error("Assessment already submitted.");
  const clusters = new Set(listCapabilities().map((c) => c.cluster));
  if (!clusters.has(cluster)) throw new Error("Invalid theme.");
  upsertThemeNote(assessment.id, cluster, note.trim() === "" ? null : note.trim());
}

export async function submit(amId: number) {
  const { user, assessment } = await guard(amId);
  if (assessment.status === "submitted") return;
  const total = listCapabilities().length;
  if (ratedCount(assessment.id) < total) throw new Error("All capabilities must be rated before submitting.");
  submitAssessment(assessment.id, user.id);
  redirect("/rate?done=1");
}

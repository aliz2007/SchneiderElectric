"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getAM,
  getOrCreateAssessment,
  isAssigned,
  listCapabilities,
  ratedCount,
  saveThemeField,
  submitAssessment,
  unjustifiedThemes,
  upsertRating,
  type ThemeField,
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

const THEME_FIELDS: ThemeField[] = ["note", "situation", "actions", "results", "impact", "replication"];

/**
 * Save one theme-justification field for the caller's lens. Managers and the APEX Panel
 * fill the single `note`; self-assessors fill the five framework fields (situation …
 * replication). Both are mandatory to submit (enforced in submit()).
 */
export async function saveThemeNote(amId: number, cluster: string, field: string, value: string) {
  const { assessment } = await guard(amId);
  if (assessment.status === "submitted") throw new Error("Assessment already submitted.");
  const clusters = new Set(listCapabilities().map((c) => c.cluster));
  if (!clusters.has(cluster)) throw new Error("Invalid theme.");
  if (!THEME_FIELDS.includes(field as ThemeField)) throw new Error("Invalid field.");
  saveThemeField(assessment.id, cluster, field as ThemeField, value.trim() === "" ? null : value.trim());
}

export async function submit(amId: number) {
  const { user, assessment } = await guard(amId);
  if (assessment.status === "submitted") return;
  const total = listCapabilities().length;
  if (ratedCount(assessment.id) < total) throw new Error("All capabilities must be rated before submitting.");
  // every theme must be justified: self answers all five framework questions, Manager/Panel a note
  const missing = unjustifiedThemes(assessment.id, user.lens!);
  if (missing.length > 0) {
    throw new Error(
      user.lens === "self"
        ? `Answer all five framework questions for every theme first. Still incomplete: ${missing.join(", ")}.`
        : `Add a justification note for every theme first. Still missing: ${missing.join(", ")}.`
    );
  }
  submitAssessment(assessment.id, user.id);
  redirect("/rate?done=1");
}

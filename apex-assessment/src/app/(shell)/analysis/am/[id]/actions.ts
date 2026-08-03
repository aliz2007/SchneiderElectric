"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import { getAssessment, reopenAssessment, setAccountDetails, setAssessmentSchedule } from "@/lib/queries";
import type { Lens } from "@/lib/seed-data";

/** Superadmin-only: unlock a submitted assessment so the evaluator can revise it. */
export async function reopen(amId: number, lens: Lens) {
  await requireSuperadmin();
  const a = getAssessment(amId, lens);
  if (a && a.status === "submitted") reopenAssessment(a.id);
  revalidatePath(`/analysis/am/${amId}`);
}

/** Superadmin-only: set / clear the AM's assessment schedule (manager deadline + panel call). */
export async function saveSchedule(formData: FormData) {
  await requireSuperadmin();
  const amId = Number(formData.get("amId"));
  if (!Number.isInteger(amId) || amId <= 0) throw new Error("Invalid Account Manager.");
  const managerDeadline = String(formData.get("managerDeadline") ?? "").trim();
  const panelDatetime = String(formData.get("panelDatetime") ?? "").trim();
  if (managerDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(managerDeadline)) throw new Error("Invalid deadline date.");
  if (panelDatetime && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(panelDatetime)) throw new Error("Invalid panel date/time.");
  setAssessmentSchedule(amId, {
    managerDeadline: managerDeadline || null,
    panelDatetime: panelDatetime || null,
  });
  revalidatePath(`/analysis/am/${amId}`);
  revalidatePath("/rate");
}

/**
 * Superadmin-only: the commercial details from the client's dashboard proposal.
 * accountType is their "Account Type" column; perfYtd is the optional performance figure
 * (unit defined by PERF_YTD_LABEL / PERF_YTD_SUFFIX in seed-data.ts).
 */
export async function saveAccountDetails(formData: FormData) {
  await requireSuperadmin();
  const amId = Number(formData.get("amId"));
  if (!Number.isInteger(amId) || amId <= 0) throw new Error("Invalid Account Manager.");
  const accountType = String(formData.get("accountType") ?? "").trim();
  const perfRaw = String(formData.get("perfYtd") ?? "").trim();
  let perfYtd: number | null = null;
  if (perfRaw !== "") {
    perfYtd = Number(perfRaw);
    if (!Number.isFinite(perfYtd)) throw new Error("Perf YTD must be a number.");
  }
  setAccountDetails(amId, { accountType: accountType || null, perfYtd });
  revalidatePath(`/analysis/am/${amId}`);
  revalidatePath("/analysis/individuals");
}

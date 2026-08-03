"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import { setGapBasis, setRequiredLevels, type GapBasis } from "@/lib/queries";

/** Parse a required-level cell: "", "1", "2" or "3". Blank means not assessed on that track. */
function level(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 3) throw new Error("Required level must be 1, 2, 3 or blank.");
  return n;
}

/** Save every capability's required levels in one submit, so the rubric stays consistent. */
export async function saveRubric(formData: FormData) {
  await requireSuperadmin();
  const ids = formData.getAll("capId").map((v) => Number(v));
  for (const id of ids) {
    if (!Number.isInteger(id)) continue;
    setRequiredLevels(id, level(formData.get(`acq_${id}`)), level(formData.get(`sat_${id}`)));
  }
  revalidatePath("/admin/rubric");
  revalidatePath("/analysis");
}

export async function saveGapBasis(formData: FormData) {
  await requireSuperadmin();
  const basis = String(formData.get("basis") ?? "weighted");
  setGapBasis(basis === "self" ? "self" : (basis as GapBasis));
  revalidatePath("/admin/rubric");
  revalidatePath("/analysis/individuals");
}

"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { assignedAMs, updateAccountManagerProfile } from "@/lib/queries";
import { ZONES } from "@/lib/seed-data";

/** Save the details a new person fills in on their first sign-in. */
export async function saveOnboarding(formData: FormData) {
  const user = await requireUser();
  if (user.lens !== "self") redirect("/rate");
  const am = assignedAMs(user.id)[0];
  if (!am) redirect("/rate");

  const name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("account") ?? "").trim();
  const zone = String(formData.get("zone") ?? "");
  const track = String(formData.get("track") ?? "");

  if (!name || !account || !(ZONES as readonly string[]).includes(zone) || !["Acquisition", "Saturation"].includes(track)) {
    redirect("/onboarding?err=1");
  }

  updateAccountManagerProfile(am.id, { name, account, zone, track });
  redirect(`/rate/${am.id}`);
}

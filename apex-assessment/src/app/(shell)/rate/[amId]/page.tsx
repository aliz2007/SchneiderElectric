import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  getAM,
  getOrCreateAssessment,
  getRatings,
  getThemeNotes,
  isAssigned,
  listCapabilities,
} from "@/lib/queries";
import { LENS_LABELS } from "@/lib/seed-data";
import Wizard, { type WizardCap, type WizardInitial } from "./wizard";

export default async function RateAmPage({ params }: { params: Promise<{ amId: string }> }) {
  const user = await requireUser();
  const { amId: amIdRaw } = await params;
  const amId = Number(amIdRaw);
  if (!Number.isInteger(amId)) notFound();

  if (!user.lens) redirect("/rate");
  if (!isAssigned(user.id, amId)) redirect("/rate"); // confidentiality: only assigned raters enter

  const am = getAM(amId);
  if (!am) notFound();

  // a self-assessor whose profile is not filled in yet must onboard first
  if (user.lens === "self" && !am.profile_complete) redirect("/onboarding");

  const assessment = getOrCreateAssessment(amId, user.lens, user.id);
  const ratings = getRatings(assessment.id);

  // IMPORTANT: required levels are deliberately NOT passed to the client —
  // the brief mandates they stay hidden during assessment to avoid anchoring bias.
  const caps: WizardCap[] = listCapabilities().map((c) => ({
    id: c.id,
    name: c.name,
    cluster: c.cluster,
    l1: c.l1,
    l2: c.l2,
    l3: c.l3,
  }));

  const initial: WizardInitial = {};
  for (const r of ratings) initial[r.capability_id] = { level: r.level };

  // Every lens captures one note per theme. Managers and the APEX Panel record their
  // reasoning; self-assessors use it to justify or add context to their own ratings.
  const initialThemeNotes: Record<string, string> = {};
  for (const t of getThemeNotes(assessment.id)) initialThemeNotes[t.cluster] = t.note;

  return (
    <Wizard
      am={{ id: am.id, name: am.name, account: am.account, zone: am.zone, track: am.track }}
      lensLabel={LENS_LABELS[user.lens]}
      isSelf={user.lens === "self"}
      caps={caps}
      initial={initial}
      themeNotesEnabled
      initialThemeNotes={initialThemeNotes}
      submitted={assessment.status === "submitted"}
    />
  );
}

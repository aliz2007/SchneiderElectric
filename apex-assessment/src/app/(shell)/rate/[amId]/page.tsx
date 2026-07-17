import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getAM, getOrCreateAssessment, getRatings, isAssigned, listCapabilities } from "@/lib/queries";
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
  for (const r of ratings) initial[r.capability_id] = { level: r.level, note: r.note ?? "" };

  return (
    <Wizard
      am={{ id: am.id, name: am.name, account: am.account, zone: am.zone, track: am.track }}
      lensLabel={LENS_LABELS[user.lens]}
      caps={caps}
      initial={initial}
      submitted={assessment.status === "submitted"}
    />
  );
}

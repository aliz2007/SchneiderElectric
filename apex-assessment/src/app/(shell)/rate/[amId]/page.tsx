import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  assessmentLock,
  formatScheduleDate,
  getAM,
  getOrCreateAssessment,
  getRatings,
  getThemeNotesFull,
  isAssigned,
  listCapabilities,
} from "@/lib/queries";
import { CAPABILITY_QUESTIONS, LENS_LABELS } from "@/lib/seed-data";
import Wizard, { type ThemeData, type WizardCap, type WizardInitial } from "./wizard";

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

  // Assessment window: past the manager deadline / panel-call day the lens is locked
  // (also enforced in every server action). While open, surface the relevant date.
  const lockedMessage = assessmentLock(am, user.lens);
  let scheduleNote: string | null = null;
  if (!lockedMessage) {
    if (user.lens === "self" && am.panel_datetime) {
      scheduleNote = `Upcoming assessment: your call with the APEX Panel is scheduled for ${formatScheduleDate(am.panel_datetime, true)}.`;
    } else if (user.lens === "manager" && am.manager_deadline) {
      scheduleNote = `Deadline: complete this assessment by ${formatScheduleDate(am.manager_deadline)} (end of day).`;
    } else if (user.lens === "expert" && am.panel_datetime) {
      scheduleNote = `The assessment call with ${am.name} is scheduled for ${formatScheduleDate(am.panel_datetime, true)}. Scoring closes at the end of that day.`;
    }
  }

  // IMPORTANT: required levels are deliberately NOT passed to the client —
  // the brief mandates they stay hidden during assessment to avoid anchoring bias.
  // Each capability also carries the lens-specific question guide (two guiding
  // questions from the APEX Question Guide, different per Self / Manager / Panel).
  const caps: WizardCap[] = listCapabilities().map((c) => ({
    id: c.id,
    name: c.name,
    cluster: c.cluster,
    l1: c.l1,
    l2: c.l2,
    l3: c.l3,
    questions: CAPABILITY_QUESTIONS[c.name]?.[user.lens!] ?? [],
  }));

  const initial: WizardInitial = {};
  for (const r of ratings) initial[r.capability_id] = { level: r.level };

  // Per-theme justification: every lens writes one note per theme (self-assessors get a
  // guided prompt), mandatory to submit. Legacy framework columns are still hydrated.
  const initialThemeData: ThemeData = {};
  for (const t of getThemeNotesFull(assessment.id)) {
    initialThemeData[t.cluster] = {
      note: t.note ?? "",
      situation: t.situation ?? "",
      actions: t.actions ?? "",
      results: t.results ?? "",
      impact: t.impact ?? "",
      replication: t.replication ?? "",
    };
  }

  return (
    <Wizard
      am={{ id: am.id, name: am.name, account: am.account, zone: am.zone, track: am.track }}
      lensLabel={LENS_LABELS[user.lens]}
      isSelf={user.lens === "self"}
      caps={caps}
      initial={initial}
      initialThemeData={initialThemeData}
      submitted={assessment.status === "submitted"}
      lockedMessage={lockedMessage}
      scheduleNote={scheduleNote}
    />
  );
}

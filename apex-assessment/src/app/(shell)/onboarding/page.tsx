// First sign-in: a new Account Manager completes their own profile.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { assignedAMs } from "@/lib/queries";
import { SEGMENTS, ZONES } from "@/lib/seed-data";
import { saveOnboarding } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const user = await requireUser();
  if (user.lens !== "self") redirect("/rate");
  const am = assignedAMs(user.id)[0];
  if (!am) redirect("/rate"); // no profile linked — the /rate banner explains
  if (am.profile_complete) redirect(`/rate/${am.id}`);
  const { err } = await searchParams;

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="page-head">
        <div className="page-kicker">Welcome</div>
        <h1 className="page-title">Complete your profile</h1>
        <p className="page-sub">
          A few details about you before your self-assessment. Your administrator set up your login;
          the rest is up to you.
        </p>
      </div>

      {err && <div className="form-error">Please fill in every field.</div>}

      <div className="card card-pad">
        <form action={saveOnboarding}>
          <div className="field">
            <label>Your name</label>
            <input className="input" name="name" defaultValue={am.name || user.displayName} required />
          </div>
          <div className="field">
            <label>Account you manage</label>
            <input className="input" name="account" placeholder="e.g. Account 12" required />
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Region</label>
              <select className="input" name="zone" defaultValue="" required>
                <option value="" disabled>
                  select your region
                </option>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Track</label>
              <select className="input" name="track" defaultValue="" required>
                <option value="" disabled>
                  select your track
                </option>
                <option value="Acquisition">Acquisition</option>
                <option value="Saturation">Saturation</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Segment</label>
            <select className="input" name="segment" defaultValue="" required>
              <option value="" disabled>
                select your account&apos;s segment
              </option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 8 }} type="submit">
            Save and start my self-assessment
          </button>
        </form>
      </div>
    </div>
  );
}

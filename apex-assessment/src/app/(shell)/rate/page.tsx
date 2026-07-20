import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { assignedAMs, getAssessment, listAMs, ratedCount, listCapabilities } from "@/lib/queries";
import { LENS_LABELS } from "@/lib/seed-data";
import AddAssessment from "./add-assessment";
import { selfUnassignAction } from "./actions";

export default async function RatePage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const user = await requireUser();
  const { done } = await searchParams;
  const capCount = listCapabilities().length;

  if (!user.lens) {
    return (
      <div>
        <div className="page-head">
          <div className="page-kicker">Assessment</div>
          <h1 className="page-title">My Assessments</h1>
        </div>
        <div className="banner banner-info">
          Your account has no assessment lens configured. Ask your administrator to assign you a
          role (Self / Manager / APEX Panel) and Account Managers to assess.
        </div>
      </div>
    );
  }

  // A self-assessor only ever assesses themselves — skip the pick-someone list and
  // drop them straight onto their own self-assessment (their single linked profile).
  if (user.lens === "self") {
    const mine = assignedAMs(user.id);
    if (mine.length > 0) redirect(`/rate/${mine[0].id}`);
    return (
      <div>
        <div className="page-head">
          <div className="page-kicker">{LENS_LABELS.self}</div>
          <h1 className="page-title">My Self-Assessment</h1>
        </div>
        <div className="banner banner-info">
          Your self-assessment isn&apos;t set up yet. Ask your administrator to link your Account
          Manager profile to your account so it can appear here.
        </div>
      </div>
    );
  }

  const ams = assignedAMs(user.id);
  const assignedIds = new Set(ams.map((am) => am.id));
  const options = listAMs().map((am) => ({
    id: am.id,
    code: am.code,
    name: am.name,
    account: am.account,
    zone: am.zone,
    assigned: assignedIds.has(am.id),
  }));

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">{LENS_LABELS[user.lens]}</div>
        <h1 className="page-title">My Assessments</h1>
        <p className="page-sub">
          Rate each capability using the L1 / L2 / L3 behavioural anchors. Your answers are
          confidential — no other evaluator can see them.
        </p>
      </div>

      {done && <div className="banner banner-ok">✓ Assessment submitted. Thank you!</div>}

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <AddAssessment options={options} />
      </div>

      {ams.length === 0 ? (
        <div className="banner banner-info">
          Nothing on your list yet — type a name above to add your first assessment.
        </div>
      ) : (
        <div className="am-grid">
          {ams.map((am) => {
            const a = getAssessment(am.id, user.lens!);
            const rated = a ? ratedCount(a.id) : 0;
            const submitted = a?.status === "submitted";
            const pct = Math.round((rated / capCount) * 100);
            return (
              <div key={am.id} className="card am-card">
                <div className="am-name">{am.name}</div>
                <div className="am-meta">
                  <span className="badge badge-zone">{am.zone}</span>
                  <span className="badge badge-track">{am.track}</span>
                  <span className="badge badge-gray">{am.account}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${submitted ? 100 : pct}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {submitted ? (
                    <span className="badge badge-green">✓ Submitted</span>
                  ) : rated === 0 ? (
                    <span className="badge badge-gray">Not started</span>
                  ) : (
                    <span className="badge badge-amber">
                      In progress · {rated}/{capCount}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!submitted && rated === 0 && (
                      <form action={selfUnassignAction.bind(null, am.id)}>
                        <button className="btn btn-sm btn-ghost" type="submit" title="Remove from my list">
                          Remove
                        </button>
                      </form>
                    )}
                    <Link className="btn btn-sm btn-primary" href={`/rate/${am.id}`}>
                      {submitted ? "View" : rated === 0 ? "Start" : "Continue"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

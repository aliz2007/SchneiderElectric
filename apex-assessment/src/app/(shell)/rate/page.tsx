import Link from "next/link";
import { requireUser } from "@/lib/session";
import { assignedAMs, getAssessment, ratedCount, listCapabilities } from "@/lib/queries";
import { LENS_LABELS } from "@/lib/seed-data";

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

  const ams = assignedAMs(user.id);

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

      {ams.length === 0 ? (
        <div className="banner banner-info">
          No Account Managers are assigned to you yet. Your administrator controls assignments.
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
                  <Link className="btn btn-sm btn-primary" href={`/rate/${am.id}`}>
                    {submitted ? "View" : rated === 0 ? "Start" : "Continue"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

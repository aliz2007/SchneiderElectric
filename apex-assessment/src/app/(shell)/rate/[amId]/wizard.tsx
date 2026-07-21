"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { saveRating, saveThemeNote, submit } from "./actions";

export type WizardCap = {
  id: number;
  name: string;
  cluster: string;
  l1: string;
  l2: string;
  l3: string;
};

export type WizardInitial = Record<number, { level: number | null }>;

const LEVEL_META = [
  { level: 1, tag: "L1", name: "Developing", key: "l1" as const },
  { level: 2, tag: "L2", name: "Proficient", key: "l2" as const },
  { level: 3, tag: "L3", name: "Advanced", key: "l3" as const },
];

export default function Wizard({
  am,
  lensLabel,
  isSelf,
  caps,
  initial,
  themeNotesEnabled,
  initialThemeNotes,
  submitted,
}: {
  am: { id: number; name: string; account: string; zone: string; track: string };
  lensLabel: string;
  isSelf: boolean;
  caps: WizardCap[];
  initial: WizardInitial;
  themeNotesEnabled: boolean;
  initialThemeNotes: Record<string, string>;
  submitted: boolean;
}) {
  const [answers, setAnswers] = useState<WizardInitial>(() => {
    const a: WizardInitial = {};
    for (const c of caps) a[c.id] = initial[c.id] ?? { level: null };
    return a;
  });
  // ordered, de-duplicated list of themes (clusters) as they appear in the rubric
  const themes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of caps) if (!seen.has(c.cluster)) { seen.add(c.cluster); out.push(c.cluster); }
    return out;
  }, [caps]);
  const [themeNotes, setThemeNotes] = useState<Record<string, string>>(() => {
    const n: Record<string, string> = {};
    for (const t of themes) n[t] = initialThemeNotes[t] ?? "";
    return n;
  });
  const firstUnanswered = caps.findIndex((c) => (initial[c.id]?.level ?? null) == null);
  const [idx, setIdx] = useState(submitted ? -1 : firstUnanswered === -1 ? -1 : firstUnanswered);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const answeredCount = useMemo(
    () => caps.filter((c) => answers[c.id]?.level != null).length,
    [caps, answers]
  );
  const allAnswered = answeredCount === caps.length;
  const onReview = idx === -1;
  const cap = onReview ? null : caps[idx];

  const choose = useCallback(
    (capId: number, level: number) => {
      if (submitted) return;
      setAnswers((prev) => ({ ...prev, [capId]: { level } }));
      setSaveState("saving");
      saveRating(am.id, capId, level)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    },
    [am.id, submitted]
  );

  const setThemeNote = useCallback(
    (cluster: string, note: string) => {
      setThemeNotes((prev) => ({ ...prev, [cluster]: note }));
      if (noteTimers.current[cluster]) clearTimeout(noteTimers.current[cluster]);
      noteTimers.current[cluster] = setTimeout(() => {
        setSaveState("saving");
        saveThemeNote(am.id, cluster, note)
          .then(() => setSaveState("saved"))
          .catch(() => setSaveState("error"));
      }, 700);
    },
    [am.id]
  );

  // keyboard shortcuts: 1/2/3 select level, arrows navigate
  useEffect(() => {
    if (submitted || onReview) return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (e.key >= "1" && e.key <= "3" && cap) choose(cap.id, Number(e.key));
      if (e.key === "ArrowRight" && idx < caps.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cap, idx, caps.length, choose, submitted, onReview]);

  const doSubmit = () => {
    setSubmitError(null);
    startSubmit(async () => {
      try {
        await submit(am.id);
      } catch (err) {
        // redirect() throws internally on success — only surface real errors
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) {
          setSubmitError(err.message);
        } else {
          throw err;
        }
      }
    });
  };

  return (
    <div className="wizard">
      <div className="wizard-top">
        <div>
          <div className="page-kicker">{lensLabel}</div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {am.name}
          </h1>
          <div className="am-meta" style={{ marginTop: 6 }}>
            <span className="badge badge-zone">{am.zone}</span>
            <span className="badge badge-track">{am.track}</span>
            <span className="badge badge-gray">{am.account}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="wizard-counter">
            {answeredCount} / {caps.length} rated
          </div>
          <div className="progress-track" style={{ width: 180, marginTop: 6 }}>
            <div className="progress-fill" style={{ width: `${(answeredCount / caps.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {submitted && (
        <div className="banner banner-ok">
          ✓ This assessment has been submitted and is now locked. Contact your administrator if it
          needs to be reopened.
        </div>
      )}

      {!onReview && cap && (
        <div className="card card-pad">
          <div className="cluster-kicker">{cap.cluster}</div>
          <h2 className="cap-title">{cap.name}</h2>
          <div className="level-cards">
            {LEVEL_META.map((m) => {
              const selected = answers[cap.id]?.level === m.level;
              return (
                <button
                  key={m.level}
                  type="button"
                  className={`level-card${selected ? " selected" : ""}`}
                  onClick={() => choose(cap.id, m.level)}
                  disabled={submitted}
                >
                  <div className="lvl-head">
                    <span className="lvl-num">{m.tag}</span>
                    {m.name}
                    <span className="key-hint" style={{ marginLeft: "auto" }}>
                      press {m.level}
                    </span>
                  </div>
                  <div className="lvl-desc">{cap[m.key]}</div>
                </button>
              );
            })}
          </div>
          {themeNotesEnabled && (
            <div className="field theme-note-field" style={{ marginBottom: 0 }}>
              <label htmlFor={`theme-note-${idx}`}>
                {isSelf ? "Notes" : "Theme notes"} · <span className="theme-note-name">{cap.cluster}</span>
                <span className="theme-note-hint">
                  {isSelf
                    ? " — optional: explain or justify your ratings for this theme"
                    : " — one note for this theme, shared across its capabilities"}
                </span>
              </label>
              <textarea
                id={`theme-note-${idx}`}
                className="input"
                rows={2}
                placeholder={
                  isSelf
                    ? `Why you rated yourself this way on ${cap.cluster}… (optional)`
                    : `Overall observations on ${cap.cluster}…`
                }
                value={themeNotes[cap.cluster] ?? ""}
                onChange={(e) => setThemeNote(cap.cluster, e.target.value)}
                disabled={submitted}
              />
            </div>
          )}
        </div>
      )}

      {onReview && (
        <div className="card card-pad">
          <h2 className="card-title">Review {submitted ? "" : "& submit"}</h2>
          <p className="card-sub">
            {submitted
              ? "Your submitted ratings for this Account Manager."
              : "Check your ratings, then submit. After submitting, the assessment is locked."}
          </p>
          <div className="review-list">
            {caps.map((c, i) => {
              const a = answers[c.id];
              return (
                <div key={c.id} className="review-row">
                  <span className={`lvl-chip ${a?.level ? `lvl-${a.level}` : "lvl-none"}`}>
                    {a?.level ? `L${a.level}` : "—"}
                  </span>
                  <span className="review-cap">{c.name}</span>
                  {!submitted && (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => setIdx(i)}>
                      Edit
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {themeNotesEnabled && (
            <div className="theme-notes-review">
              <h3 className="card-title" style={{ fontSize: 15, marginTop: 22 }}>
                {isSelf ? "Your notes" : "Theme notes"}
              </h3>
              <p className="card-sub" style={{ marginBottom: 12 }}>
                {isSelf
                  ? "Optional — one note per theme to justify or add context to your ratings. These appear on your report."
                  : "One note per theme — these appear on the individual report and PDF."}
              </p>
              {themes.map((t) => (
                <div key={t} className="field theme-note-field">
                  <label htmlFor={`review-note-${t}`}>
                    <span className="theme-note-name">{t}</span>
                  </label>
                  <textarea
                    id={`review-note-${t}`}
                    className="input"
                    rows={2}
                    placeholder={`Overall observations on ${t}…`}
                    value={themeNotes[t] ?? ""}
                    onChange={(e) => setThemeNote(t, e.target.value)}
                    disabled={submitted}
                  />
                </div>
              ))}
            </div>
          )}

          {submitError && <div className="form-error" style={{ marginTop: 14 }}>{submitError}</div>}
          {!submitted && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
              <button
                className="btn btn-primary"
                type="button"
                disabled={!allAnswered || submitting}
                onClick={doSubmit}
              >
                {submitting ? "Submitting…" : "Submit assessment"}
              </button>
              {!allAnswered && (
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  {caps.length - answeredCount} capability{caps.length - answeredCount > 1 ? "ies" : ""} left to rate
                </span>
              )}
            </div>
          )}
          {submitted && (
            <Link className="btn btn-outline" style={{ marginTop: 18 }} href="/rate">
              ← Back to my assessments
            </Link>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <div style={{ display: "flex", gap: 8 }}>
          {!onReview && (
            <>
              <button
                className="btn btn-outline"
                type="button"
                disabled={idx === 0}
                onClick={() => setIdx(idx - 1)}
              >
                ← Prev
              </button>
              {idx < caps.length - 1 ? (
                <button className="btn btn-outline" type="button" onClick={() => setIdx(idx + 1)}>
                  Next →
                </button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => setIdx(-1)}>
                  Review & submit →
                </button>
              )}
            </>
          )}
          {onReview && !submitted && (
            <button className="btn btn-outline" type="button" onClick={() => setIdx(0)}>
              ← Back to questions
            </button>
          )}
        </div>
        <div className="dots">
          {caps.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`dot${answers[c.id]?.level != null ? " answered" : ""}${i === idx ? " current" : ""}`}
              title={c.name}
              onClick={() => setIdx(i)}
            />
          ))}
          <button
            type="button"
            className={`dot${onReview ? " current" : ""}`}
            title="Review & submit"
            style={{ width: 26, background: onReview ? "var(--ink)" : "#3a465e" }}
            onClick={() => setIdx(-1)}
          />
        </div>
        <div className="save-state">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved ✓"}
          {saveState === "error" && <span style={{ color: "var(--red)" }}>Save failed</span>}
        </div>
      </div>

      {!submitted && (
        <aside className="wizard-help">
          <h3 className="wizard-help-title">
            {isSelf ? "How to complete your self-assessment" : "How to run this assessment"}
          </h3>
          <ul className="wizard-help-list">
            {isSelf ? (
              <>
                <li>
                  Rate yourself on each capability: read the three levels and pick the one that best
                  matches how you work today. Be candid — there are no right or wrong answers.
                </li>
                <li>
                  Prefer the keyboard? Press <b>1</b>, <b>2</b> or <b>3</b> to choose a level, and use
                  the arrows or the dots below to move between capabilities.
                </li>
                <li>
                  Use the <b>Notes</b> box on any theme to explain or justify your ratings — for
                  example why you scored yourself a certain way. It is optional, and one note covers
                  the whole theme.
                </li>
                <li>
                  Everything saves automatically. Once all {caps.length} are rated, open{" "}
                  <b>Review &amp; submit</b>. Submitting locks your assessment.
                </li>
              </>
            ) : (
              <>
                <li>
                  Rate the Account Manager on each capability against the three levels. The target
                  each track expects is deliberately hidden here, so your scoring stays unbiased.
                </li>
                <li>
                  Press <b>1</b>, <b>2</b> or <b>3</b> to choose a level, and use the arrows or the
                  dots below to move between capabilities.
                </li>
                <li>
                  Add one <b>Theme note</b> per cluster to record the reasoning behind your scores —
                  these appear on the individual report and PDF.
                </li>
                <li>
                  Ratings save automatically. When all {caps.length} are rated, open{" "}
                  <b>Review &amp; submit</b>; submitting locks the assessment.
                </li>
              </>
            )}
          </ul>
        </aside>
      )}
    </div>
  );
}

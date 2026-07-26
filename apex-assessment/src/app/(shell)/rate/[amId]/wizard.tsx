"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SELF_JUSTIFICATION_PROMPT } from "@/lib/seed-data";
import { saveRating, saveThemeNote, submit } from "./actions";

export type WizardCap = {
  id: number;
  name: string;
  cluster: string;
  l1: string;
  l2: string;
  l3: string;
  /** the two lens-specific guiding questions from the APEX Question Guide */
  questions: string[];
};

export type WizardInitial = Record<number, { level: number | null }>;
/** cluster -> field -> value; every lens uses a single "note" field per theme */
export type ThemeData = Record<string, Record<string, string>>;

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
  initialThemeData,
  submitted,
  lockedMessage = null,
  scheduleNote = null,
}: {
  am: { id: number; name: string; account: string; zone: string; track: string };
  lensLabel: string;
  isSelf: boolean;
  caps: WizardCap[];
  initial: WizardInitial;
  initialThemeData: ThemeData;
  submitted: boolean;
  /** set when the assessment window has closed for this lens — everything goes read-only */
  lockedMessage?: string | null;
  /** upcoming deadline / panel-call info shown while the window is still open */
  scheduleNote?: string | null;
}) {
  // ordered, de-duplicated list of themes (clusters)
  const themes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of caps) if (!seen.has(c.cluster)) { seen.add(c.cluster); out.push(c.cluster); }
    return out;
  }, [caps]);
  // every lens justifies each theme with one mandatory note (self-assessors get a
  // guided prompt; Manager / APEX Panel a free note) — a single field either way
  const fields = useMemo(() => ["note"], []);

  const [answers, setAnswers] = useState<WizardInitial>(() => {
    const a: WizardInitial = {};
    for (const c of caps) a[c.id] = initial[c.id] ?? { level: null };
    return a;
  });
  const [themeData, setThemeData] = useState<ThemeData>(() => {
    const d: ThemeData = {};
    for (const t of themes) {
      d[t] = {};
      for (const f of fields) d[t][f] = initialThemeData[t]?.[f] ?? "";
    }
    return d;
  });

  const firstUnanswered = caps.findIndex((c) => (initial[c.id]?.level ?? null) == null);
  const [idx, setIdx] = useState(submitted ? -1 : firstUnanswered === -1 ? -1 : firstUnanswered);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // read-only when submitted OR the assessment window has closed for this lens
  const frozen = submitted || !!lockedMessage;

  const answeredCount = useMemo(() => caps.filter((c) => answers[c.id]?.level != null).length, [caps, answers]);
  const allAnswered = answeredCount === caps.length;

  const themeComplete = useCallback(
    (cluster: string) => fields.every((f) => (themeData[cluster]?.[f] ?? "").trim() !== ""),
    [fields, themeData]
  );
  const incompleteThemes = useMemo(() => themes.filter((t) => !themeComplete(t)), [themes, themeComplete]);
  const canSubmit = allAnswered && incompleteThemes.length === 0;

  const onReview = idx === -1;
  const cap = onReview ? null : caps[idx];

  const choose = useCallback(
    (capId: number, level: number) => {
      if (frozen) return;
      setAnswers((prev) => ({ ...prev, [capId]: { level } }));
      setSaveState("saving");
      saveRating(am.id, capId, level).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    },
    [am.id, frozen]
  );

  const setThemeField = useCallback(
    (cluster: string, field: string, value: string) => {
      if (frozen) return;
      setThemeData((prev) => ({ ...prev, [cluster]: { ...prev[cluster], [field]: value } }));
      const key = `${cluster}|${field}`;
      if (noteTimers.current[key]) clearTimeout(noteTimers.current[key]);
      noteTimers.current[key] = setTimeout(() => {
        setSaveState("saving");
        saveThemeNote(am.id, cluster, field, value).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
      }, 700);
    },
    [am.id, frozen]
  );

  // keyboard shortcuts: 1/2/3 select level, arrows navigate
  useEffect(() => {
    if (frozen || onReview) return;
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") return;
      if (e.key >= "1" && e.key <= "3" && cap) choose(cap.id, Number(e.key));
      if (e.key === "ArrowRight" && idx < caps.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [cap, idx, caps.length, choose, frozen, onReview]);

  const doSubmit = () => {
    setSubmitError(null);
    startSubmit(async () => {
      try {
        await submit(am.id);
      } catch (err) {
        if (err instanceof Error && !err.message.includes("NEXT_REDIRECT")) setSubmitError(err.message);
        else throw err;
      }
    });
  };

  const jumpToTheme = (cluster: string) => {
    const i = caps.findIndex((c) => c.cluster === cluster);
    if (i >= 0) setIdx(i);
  };

  // ---- justification block shown under the level cards for the current theme ----
  // One mandatory note per theme for every lens; self-assessors get a guided prompt.
  function Justification({ cluster }: { cluster: string }) {
    const done = themeComplete(cluster);
    return (
      <div className={`framework-block${done ? " done" : ""}`}>
        <div className="framework-head">
          <span className="framework-kicker">Justify your rating for this theme · {cluster}</span>
          <span className={`framework-status ${done ? "ok" : "todo"}`}>{done ? "✓ complete" : "required"}</span>
        </div>
        {isSelf && <p className="framework-intro">{SELF_JUSTIFICATION_PROMPT}</p>}
        <textarea
          className="input framework-note"
          rows={isSelf ? 5 : 3}
          value={themeData[cluster]?.note ?? ""}
          onChange={(e) => setThemeField(cluster, "note", e.target.value)}
          disabled={frozen}
          placeholder={
            isSelf
              ? "Describe a concrete example — situation, actions taken, results, impact, and where relevant how it could be replicated."
              : `What evidence supports your ratings for ${cluster}? A justification is required for every theme.`
          }
        />
      </div>
    );
  }

  return (
    <div className="wizard">
      <div className="wizard-top">
        <div>
          <div className="page-kicker">{lensLabel}</div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>{am.name}</h1>
          <div className="am-meta" style={{ marginTop: 6 }}>
            <span className="badge badge-zone">{am.zone}</span>
            <span className="badge badge-track">{am.track}</span>
            <span className="badge badge-gray">{am.account}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="wizard-counter">{answeredCount} / {caps.length} rated</div>
          <div className="progress-track" style={{ width: 180, marginTop: 6 }}>
            <div className="progress-fill" style={{ width: `${(answeredCount / caps.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {submitted && (
        <div className="banner banner-ok">
          ✓ This assessment has been submitted and is now locked. Contact your administrator if it needs to be
          reopened.
        </div>
      )}
      {!submitted && lockedMessage && (
        <div className="banner banner-warn">
          🔒 {lockedMessage} Contact your administrator if the window needs to be extended.
        </div>
      )}
      {!submitted && !lockedMessage && scheduleNote && (
        <div className="banner banner-info">📅 {scheduleNote}</div>
      )}

      {!onReview && cap && (
        <div className="card card-pad">
          <div className="cluster-kicker">{cap.cluster}</div>
          <h2 className="cap-title">{cap.name}</h2>
          {cap.questions.length > 0 && (
            <div className="qguide">
              <div className="qguide-head">
                Question guide
                <span className="qguide-sub">
                  {isSelf ? "Reflect on these before picking your level" : "Ask these during the assessment conversation"}
                </span>
              </div>
              {cap.questions.map((q, i) => (
                <div key={i} className="qguide-q">
                  <span className="qguide-num">Q{i + 1}</span>
                  <p>{q}</p>
                </div>
              ))}
            </div>
          )}
          <div className="level-cards">
            {LEVEL_META.map((m) => {
              const selected = answers[cap.id]?.level === m.level;
              return (
                <button
                  key={m.level}
                  type="button"
                  className={`level-card${selected ? " selected" : ""}`}
                  onClick={() => choose(cap.id, m.level)}
                  disabled={frozen}
                >
                  <div className="lvl-head">
                    <span className="lvl-num">{m.tag}</span>
                    {m.name}
                    <span className="key-hint" style={{ marginLeft: "auto" }}>press {m.level}</span>
                  </div>
                  <div className="lvl-desc">{cap[m.key]}</div>
                </button>
              );
            })}
          </div>
          <Justification cluster={cap.cluster} />
        </div>
      )}

      {onReview && (
        <div className="card card-pad">
          <h2 className="card-title">Review {submitted ? "" : "& submit"}</h2>
          <p className="card-sub">
            {submitted
              ? "Your submitted ratings for this Account Manager."
              : "Check your ratings and justifications, then submit. After submitting, the assessment is locked."}
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
                  {!frozen && (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => setIdx(i)}>Edit</button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="theme-notes-review">
            <h3 className="card-title" style={{ fontSize: 15, marginTop: 22 }}>
              Theme justifications
            </h3>
            <p className="card-sub" style={{ marginBottom: 12 }}>
              A justification is required for every theme.
            </p>
            {themes.map((t) => {
              const done = themeComplete(t);
              return (
                <div key={t} className="review-row">
                  <span className={`badge ${done ? "badge-green" : "badge-amber"}`}>{done ? "✓ complete" : "incomplete"}</span>
                  <span className="review-cap">{t}</span>
                  {!frozen && (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={() => jumpToTheme(t)}>Edit</button>
                  )}
                </div>
              );
            })}
          </div>

          {submitError && <div className="form-error" style={{ marginTop: 14 }}>{submitError}</div>}
          {!frozen && (
            <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="button" disabled={!canSubmit || submitting} onClick={doSubmit}>
                {submitting ? "Submitting…" : "Submit assessment"}
              </button>
              {!allAnswered && (
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  {caps.length - answeredCount} capabilit{caps.length - answeredCount > 1 ? "ies" : "y"} left to rate
                </span>
              )}
              {allAnswered && incompleteThemes.length > 0 && (
                <span style={{ fontSize: 13, color: "var(--amber)" }}>
                  Justify {incompleteThemes.length} more theme{incompleteThemes.length > 1 ? "s" : ""}: {incompleteThemes.join(", ")}
                </span>
              )}
            </div>
          )}
          {submitted && (
            <Link className="btn btn-outline" style={{ marginTop: 18 }} href="/rate">← Back to my assessments</Link>
          )}
        </div>
      )}

      <div className="wizard-nav">
        <div style={{ display: "flex", gap: 8 }}>
          {!onReview && (
            <>
              <button className="btn btn-outline" type="button" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Prev</button>
              {idx < caps.length - 1 ? (
                <button className="btn btn-outline" type="button" onClick={() => setIdx(idx + 1)}>Next →</button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={() => setIdx(-1)}>Review & submit →</button>
              )}
            </>
          )}
          {onReview && !submitted && (
            <button className="btn btn-outline" type="button" onClick={() => setIdx(0)}>← Back to questions</button>
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

      {!frozen && (
        <aside className="wizard-help">
          <h3 className="wizard-help-title">
            {isSelf ? "How to complete your self-assessment" : "How to run this assessment"}
          </h3>
          <ul className="wizard-help-list">
            {isSelf ? (
              <>
                <li>Rate yourself on each capability against the three levels — be candid.</li>
                <li>Press <b>1</b>, <b>2</b> or <b>3</b> to choose a level; use the arrows or the dots to move.</li>
                <li>
                  For every theme, write one <b>concrete example</b> to justify your ratings — structure it as
                  situation, actions, results and impact. It is mandatory.
                </li>
                <li>Everything saves automatically. You can only submit once all {caps.length} are rated and every theme is justified.</li>
              </>
            ) : (
              <>
                <li>Rate the Account Manager on each capability against the three levels.</li>
                <li>Press <b>1</b>, <b>2</b> or <b>3</b> to choose a level; use the arrows or the dots to move.</li>
                <li>Write a <b>justification note for every theme</b> — it is mandatory before you can submit.</li>
                <li>Ratings save automatically. Submit once all {caps.length} are rated and every theme is justified.</li>
              </>
            )}
          </ul>
        </aside>
      )}
    </div>
  );
}

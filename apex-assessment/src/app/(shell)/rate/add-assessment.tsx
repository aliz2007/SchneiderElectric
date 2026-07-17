"use client";

// Type-ahead box: assessors pick anyone to assess by typing their name.

import { useMemo, useRef, useState, useTransition } from "react";
import { selfAssign } from "./actions";

export type AssignOption = {
  id: number;
  code: string;
  name: string;
  account: string;
  zone: string;
  assigned: boolean;
};

export default function AddAssessment({ options }: { options: AssignOption[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return options
      .filter((o) => !o.assigned)
      .filter((o) => `${o.name} ${o.code} ${o.account}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, options]);

  const pick = (id: number) => {
    setError(null);
    startTransition(async () => {
      const res = await selfAssign(id);
      if (!res.ok) setError(res.error ?? "Could not add this assessment.");
      else {
        setQ("");
        setOpen(false);
      }
    });
  };

  return (
    <div className="assign-box">
      <label className="assign-label" htmlFor="assign-search">
        Add someone to assess
      </label>
      <div className="assign-field">
        <input
          id="assign-search"
          className="input assign-input"
          placeholder="Type a name, code or account…"
          value={q}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) {
              e.preventDefault();
              pick(matches[0].id);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {pending && <span className="assign-spinner">…</span>}
        {open && q.trim() !== "" && (
          <div className="assign-pop">
            {matches.length === 0 ? (
              <div className="assign-empty">No match — check the spelling or ask your administrator.</div>
            ) : (
              matches.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="assign-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.id)}
                >
                  <span className="assign-opt-name">{o.name}</span>
                  <span className="assign-opt-meta">
                    {o.code} · {o.account} · {o.zone}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error && <div className="form-error assign-error">{error}</div>}
    </div>
  );
}

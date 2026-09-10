"use client";

import { useState, useTransition } from "react";
import Icon, { Caret } from "@/app/(shell)/nav-icon";
import { ACCOUNT_TYPES, PERF_YTD_HELP, PERF_YTD_LABEL, PERF_YTD_SUFFIX } from "@/lib/seed-data";
import { saveAccountDetails } from "./actions";

/**
 * Superadmin editor for the two commercial fields the client's dashboard proposal asks for:
 * Account Type (their account-tier column) and Perf YTD (their optional performance figure).
 * Both feed the Population Overview table and its PDF.
 */
export default function AccountEditor({
  amId,
  accountType,
  perfYtd,
}: {
  amId: number;
  accountType: string | null;
  perfYtd: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedTick, setSavedTick] = useState(false);
  const filled = (accountType ? 1 : 0) + (perfYtd != null ? 1 : 0);

  return (
    <div className="sched">
      <button
        type="button"
        className={`filter-toggle${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name="tag" size={15} />
        Account details
        {filled > 0 && <span className="filter-badge">{filled}</span>}
        <Caret open={open} />
      </button>

      {open && (
        <div className="filter-panel sched-panel">
          <form
            action={(fd) => {
              startSaving(async () => {
                await saveAccountDetails(fd);
                setSavedTick(true);
                setTimeout(() => setSavedTick(false), 2500);
              });
            }}
          >
            <input type="hidden" name="amId" value={amId} />
            <label className="sched-field">
              <span>Account Type</span>
              <select className="input" name="accountType" defaultValue={accountType ?? ""}>
                <option value="">Not set</option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="sched-field">
              <span>
                {PERF_YTD_LABEL} ({PERF_YTD_SUFFIX})
              </span>
              <input
                className="input"
                type="number"
                step="0.1"
                name="perfYtd"
                defaultValue={perfYtd ?? ""}
                placeholder="e.g. 104.5"
              />
            </label>
            <p className="sched-help">{PERF_YTD_HELP}</p>
            <div className="sched-actions">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save details"}
              </button>
              {savedTick && <span className="sched-saved">Saved ✓</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

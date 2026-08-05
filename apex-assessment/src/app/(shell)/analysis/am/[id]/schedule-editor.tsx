"use client";

import { useState, useTransition } from "react";
import Icon, { Caret } from "@/app/(shell)/nav-icon";
import { saveSchedule } from "./actions";

/**
 * Superadmin scheduling window on the individual page: a toggle that opens a small
 * calendar area with two native pickers — the manager's assessment deadline (date)
 * and the APEX Panel assessment call (date + time). Past their day, the respective
 * lens can no longer assess (enforced server-side in the rate actions).
 */
export default function ScheduleEditor({
  amId,
  selfDeadline,
  managerDeadline,
  panelDatetime,
}: {
  amId: number;
  selfDeadline: string | null;
  managerDeadline: string | null;
  panelDatetime: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [savedTick, setSavedTick] = useState(false);
  const hasAny = !!(selfDeadline || managerDeadline || panelDatetime);

  return (
    <div className="sched">
      <button
        type="button"
        className={`filter-toggle${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name="calendar" size={15} />
        Assessment schedule
        {hasAny && (
          <span className="filter-badge">
            {(selfDeadline ? 1 : 0) + (managerDeadline ? 1 : 0) + (panelDatetime ? 1 : 0)}
          </span>
        )}
        <Caret open={open} />
      </button>

      {open && (
        <div className="filter-panel sched-panel">
          <form
            action={(fd) =>
              startSaving(async () => {
                await saveSchedule(fd);
                setSavedTick(true);
                setTimeout(() => setSavedTick(false), 2500);
              })
            }
          >
            <input type="hidden" name="amId" value={amId} />
            <div className="filter-group">
              <span className="filter-label">Self-assessment deadline</span>
              <input className="input" type="date" name="selfDeadline" defaultValue={selfDeadline ?? ""} />
              <span className="sched-hint">The assessed person can self-assess up to and including this date.</span>
            </div>
            <div className="filter-group">
              <span className="filter-label">Manager assessment deadline</span>
              <input className="input" type="date" name="managerDeadline" defaultValue={managerDeadline ?? ""} />
              <span className="sched-hint">The manager can assess up to and including this date.</span>
            </div>
            <div className="filter-group">
              <span className="filter-label">APEX Panel assessment call</span>
              <input className="input" type="datetime-local" name="panelDatetime" defaultValue={panelDatetime ?? ""} />
              <span className="sched-hint">
                Shown to the assessed person as their upcoming assessment; the panel can score
                until the end of that day.
              </span>
            </div>
            <div className="sched-actions">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save schedule"}
              </button>
              {savedTick && <span className="sched-saved">Saved ✓</span>}
              <span className="sched-hint">Clear a field and save to remove its limit.</span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

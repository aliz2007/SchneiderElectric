"use client";

import { useState, type ReactNode } from "react";

/**
 * The wrench. It opens the Dashboard Manager and closes it again.
 *
 * The manager lives behind a control rather than on the page because it is a tool, not
 * content: you come to Settings to change something occasionally, and the rest of the time
 * a workbench spread across the page is just noise between you and everything else.
 */
export default function ManagerToggle({
  arrange,
  colour,
}: {
  arrange: ReactNode;
  colour: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"arrange" | "colour">("arrange");

  return (
    <>
      <button
        type="button"
        className={`wrench${open ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dashboard-manager"
        title={open ? "Close the Dashboard Manager" : "Dashboard Manager"}
      >
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <path
            d="M13.6 2.6a4.4 4.4 0 0 0-4.9 5.7l-5.5 5.5a1.6 1.6 0 0 0 2.3 2.3l5.5-5.5a4.4 4.4 0 0 0 5.7-4.9l-2.4 2.4-2.1-.6-.6-2.1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <span className="wrench-label">Dashboard Manager</span>
      </button>

      {open && (
        <div className="dm" id="dashboard-manager">
          <div className="dm-tabs" role="tablist" aria-label="Dashboard Manager">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "arrange"}
              className={`dm-tab${tab === "arrange" ? " active" : ""}`}
              onClick={() => setTab("arrange")}
            >
              Arrange
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "colour"}
              className={`dm-tab${tab === "colour" ? " active" : ""}`}
              onClick={() => setTab("colour")}
            >
              Colour
            </button>
          </div>
          <div className="dm-body">{tab === "arrange" ? arrange : colour}</div>
        </div>
      )}
    </>
  );
}

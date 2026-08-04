"use client";

import { useEffect, useState } from "react";
import { NAV_COLLAPSED, NAV_COOKIE } from "@/lib/nav-cookie";

/**
 * Folds the menu bar away and gives the page the whole window.
 *
 * The state is a COOKIE, not localStorage, and the class it drives is put on `.shell` by
 * the server layout. That ordering is the whole point: a preference read in the browser
 * after hydration would paint the sidebar open and then yank it shut on every single
 * navigation. Read on the server, the page arrives already folded.
 *
 * The click itself does not wait for the server — it toggles the class directly and writes
 * the cookie, so the bar moves under your hand. The server only has to agree by the time
 * the next page is rendered.
 *
 * The button is fixed rather than living inside the bar, because a control that folds
 * something away cannot be inside the thing it folds. It slides with the edge, so it stays
 * where your eye left it.
 */

export default function SidebarToggle({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // keep the class in step if the value is changed anywhere else (a second tab, say)
  useEffect(() => {
    document.querySelector(".shell")?.classList.toggle("nav-collapsed", collapsed);
  }, [collapsed]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // a year, path-wide, lax: it is a display preference, not a credential
    document.cookie = `${NAV_COOKIE}=${next ? NAV_COLLAPSED : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <button
      type="button"
      className="nav-toggle"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Show the menu" : "Hide the menu"}
      title={collapsed ? "Show the menu" : "Hide the menu"}
    >
      <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="13" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="3.5" x2="8" y2="16.5" stroke="currentColor" strokeWidth="1.5" />
        {/* the filled leaf shows which side folds, and which way it will go */}
        <path
          d={collapsed ? "M11 7.5 L14 10 L11 12.5 Z" : "M14 7.5 L11 10 L14 12.5 Z"}
          fill="currentColor"
        />
      </svg>
    </button>
  );
}

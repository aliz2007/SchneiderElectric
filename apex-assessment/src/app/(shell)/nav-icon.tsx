/**
 * Drawn icons for the navigation and the small inline affordances.
 *
 * These replace the typographic symbols the app used to lean on — ▦ ☰ ⚙ ✎ ★ 📅 🏷. Those
 * are characters, so they arrive at whatever weight, size and vertical alignment the
 * platform font decides, they sit differently on Windows than on a Mac, and a couple of them
 * render in colour as emoji. Drawn at a fixed 18-unit grid with a single stroke weight, the
 * set finally looks like one family.
 *
 * `currentColor` throughout, so an icon inherits whatever the nav link or button is doing —
 * including the accent, once a superadmin has repainted it from the dashboard.
 */

export type IconName =
  | "dashboard"
  | "people"
  | "access"
  | "settings"
  | "assess"
  | "feedback"
  | "calendar"
  | "tag"
  | "filter";

const PATHS: Record<IconName, React.ReactNode> = {
  // four panels — the dashboard's own shape
  dashboard: (
    <>
      <rect x="2.5" y="2.5" width="5.6" height="5.6" rx="1.6" />
      <rect x="9.9" y="2.5" width="5.6" height="5.6" rx="1.6" />
      <rect x="2.5" y="9.9" width="5.6" height="5.6" rx="1.6" />
      <rect x="9.9" y="9.9" width="5.6" height="5.6" rx="1.6" />
    </>
  ),
  // a list of people: rows, each led by a marker
  people: (
    <>
      <path d="M7 4.5h8.5M7 9h8.5M7 13.5h8.5" />
      <circle cx="3.4" cy="4.5" r="1.1" />
      <circle cx="3.4" cy="9" r="1.1" />
      <circle cx="3.4" cy="13.5" r="1.1" />
    </>
  ),
  // a person and the key to what they may see
  access: (
    <>
      <circle cx="6.6" cy="5.8" r="2.6" />
      <path d="M2.2 15.2a4.4 4.4 0 0 1 8.8 0" />
      <circle cx="13.6" cy="9.4" r="1.9" />
      <path d="M13.6 11.3v4.1M12.4 13.8h2.4" />
    </>
  ),
  // sliders: settings you move rather than switch
  settings: (
    <>
      <path d="M3 5.4h12M3 12.6h12" />
      <circle cx="7.2" cy="5.4" r="1.9" />
      <circle cx="11.4" cy="12.6" r="1.9" />
    </>
  ),
  // a sheet being marked up
  assess: (
    <>
      <path d="M14.5 8.4v5.9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V3.7a2 2 0 0 1 2-2h4.2" />
      <path d="M6.4 9.4h3.1M6.4 12.4h4.6" />
      <path d="m11.4 6.9 4-4 1.7 1.7-4 4-2.2.5z" />
    </>
  ),
  // a report handed back, with a tick
  feedback: (
    <>
      <path d="M4.5 1.9h6.1l3.9 3.9v10.3a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V3.9a2 2 0 0 1 2-2z" />
      <path d="M10.4 2.1v4h4" />
      <path d="m6.4 11.6 1.9 1.9 3.6-3.9" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.4" y="3.6" width="13.2" height="12.2" rx="2.2" />
      <path d="M2.4 7.5h13.2M6 1.9v3.2M12 1.9v3.2" />
    </>
  ),
  tag: (
    <>
      <path d="M8.6 2.2H15a1 1 0 0 1 1 1v6.4a1 1 0 0 1-.3.7l-6 6a1 1 0 0 1-1.4 0L2.1 10a1 1 0 0 1 0-1.4l5.8-6a1 1 0 0 1 .7-.4z" />
      <circle cx="12.3" cy="5.8" r="1.3" />
    </>
  ),
  // narrowing lines: a filter
  filter: (
    <>
      <path d="M2.6 4.4h12.8M4.8 9h8.4M7.4 13.6h3.2" />
    </>
  ),
};

export default function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The chevron on a disclosure button. One definition, because the three buttons that use it
 * (Filters, Assessment schedule, Account details) sat next to each other on the same page
 * with two of them drawn and one still typing a ▼.
 */
export function Caret({ open }: { open: boolean }) {
  return (
    <svg
      className={`filter-caret${open ? " open" : ""}`}
      viewBox="0 0 12 12"
      width="11"
      height="11"
      aria-hidden="true"
    >
      <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

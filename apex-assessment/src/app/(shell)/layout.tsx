import { requireUser } from "@/lib/session";
import { LENS_LABELS } from "@/lib/seed-data";
import NavLinks, { type NavItem } from "./nav-links";
import { logout } from "./actions";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const rateItems: NavItem[] = user.lens
    ? [{ href: "/rate", label: user.lens === "self" ? "My Self-Assessment" : "My Assessments", ico: "✎" }]
    : [];
  // the aggregated dashboard is open to everyone; individual results & access
  // management stay superadmin-only
  const adminItems: NavItem[] = [
    { href: "/analysis", label: "Dashboard", ico: "▦" },
    ...(user.role === "superadmin"
      ? [
          { href: "/analysis/individuals", label: "Individuals", ico: "☰" },
          { href: "/admin/users", label: "Users & Access", ico: "⚙" },
        ]
      : []),
  ];

  const initials = user.displayName
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel =
    user.role === "superadmin" ? "Superadmin" : user.lens ? LENS_LABELS[user.lens] : "Assessor";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/se-logo.svg" alt="Schneider Electric" width={42} height={42} />
          <div>
            <div className="brand-name">APEX Assessment</div>
            <div className="brand-sub">Schneider Electric</div>
          </div>
        </div>
        <nav className="nav">
          {adminItems.length > 0 && (
            <div className="nav-section">{user.role === "superadmin" ? "Analysis & Admin" : "Analysis"}</div>
          )}
          <NavLinks items={adminItems} />
          {rateItems.length > 0 && <div className="nav-section">Assessment</div>}
          <NavLinks items={rateItems} />
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">{initials}</div>
          <div>
            <div className="foot-name">{user.displayName}</div>
            <div className="foot-role">{roleLabel}</div>
          </div>
          <form action={logout}>
            <button className="logout-btn" type="submit" title="Sign out">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

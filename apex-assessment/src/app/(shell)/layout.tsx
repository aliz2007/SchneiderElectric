import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { NAV_COLLAPSED, NAV_COOKIE } from "@/lib/nav-cookie";
import { LENS_LABELS } from "@/lib/seed-data";
import { allLensesSubmitted, assignedAMs, listAMs } from "@/lib/queries";
import { BrandMark } from "@/lib/brand";
import NavLinks, { type NavItem } from "./nav-links";
import ChatWidget from "./chat-widget";
import SidebarToggle from "./sidebar-toggle";
import HelpTools from "./help-tools";
import { logout } from "./actions";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // read on the SERVER so a folded menu arrives folded — a preference applied after
  // hydration would flash the bar open on every navigation
  const navCollapsed = (await cookies()).get(NAV_COOKIE)?.value === NAV_COLLAPSED;

  const rateItems: NavItem[] = user.lens
    ? [{ href: "/rate", label: user.lens === "self" ? "My Self-Assessment" : "My Assessments", ico: "assess" }]
    : [];
  // The assessed person sees their own feedback once all three lenses are submitted.
  if (user.lens === "self") {
    const mine = assignedAMs(user.id);
    if (mine.length > 0 && mine[0].profile_complete && allLensesSubmitted(mine[0].id)) {
      rateItems.push({ href: "/feedback", label: "My Feedback", ico: "feedback" });
    }
  }
  // the aggregated dashboard is open to everyone; individual results & access
  // management stay superadmin-only
  const adminItems: NavItem[] = [
    { href: "/analysis", label: "Dashboard", ico: "dashboard" },
    ...(user.role === "superadmin"
      ? ([
          { href: "/analysis/individuals", label: "Individuals", ico: "people" },
          { href: "/admin/users", label: "Users & Access", ico: "access" },
        ] as NavItem[])
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
    <div className={`shell${navCollapsed ? " nav-collapsed" : ""}`}>
      {/* the two page-level tools, together in the top-left corner: fold the menu, and ask
          what any of this is. They slide with the menu edge so they keep their relationship
          to the page rather than to the window. */}
      <div className="corner-tools">
        <SidebarToggle initialCollapsed={navCollapsed} />
        <HelpTools
          audience={{
            isAdmin: user.role === "superadmin",
            hasLens: user.lens != null,
            // the tour visits a real individual page, so it needs a real Account Manager;
            // on an empty database it simply skips those steps
            amId: user.role === "superadmin" ? (listAMs()[0]?.id ?? null) : null,
          }}
        />
      </div>
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
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
      <ChatWidget isSuperadmin={user.role === "superadmin"} />
    </div>
  );
}

import { requireSuperadmin } from "@/lib/session";
import { readColors, readLayout } from "@/lib/dashboard-settings";
import ManagerToggle from "./manager-toggle";
import DashboardCanvas from "./dashboard-canvas";
import ColourPanel from "./colour-panel";

export default async function SettingsPage() {
  const me = await requireSuperadmin();

  return (
    <div className="page-wide">
      <div className="page-head page-head-row">
        <div>
          <div className="page-kicker">Administration</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Your own settings. Each superadmin arranges and colours their dashboard the way
            they want it; saving here changes nothing for anyone else.
          </p>
        </div>
        {/* the wrench sits top-right, where a tool belongs on a page you mostly read */}
        <ManagerToggle
          arrange={<DashboardCanvas layout={readLayout(me.id)} />}
          colour={<ColourPanel colors={readColors(me.id)} />}
        />
      </div>
    </div>
  );
}

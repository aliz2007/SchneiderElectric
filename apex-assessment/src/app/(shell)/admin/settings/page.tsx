import { requireSuperadmin } from "@/lib/session";
import { isDefaultLayout } from "@/lib/dashboard-layout";
import { readAccent, readLayout } from "@/lib/dashboard-settings";
import DashboardManager from "./dashboard-manager";

export default async function SettingsPage() {
  const me = await requireSuperadmin();
  const layout = readLayout(me.id);
  const accent = readAccent(me.id);

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Administration</div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          These are your own settings. Each superadmin arranges and colours their dashboard
          the way they want it; nobody else&apos;s view changes when you save.
        </p>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">Dashboard Manager</h2>
        <p className="card-sub">
          Rearrange your Capability Dashboard, repaint the app, or put both back the way they
          shipped. Cards can be moved, made wider or narrower, and taken off the dashboard
          entirely — a removed card is only hidden, never deleted, so it can always come back.
        </p>
        <DashboardManager accent={accent} layout={layout} layoutIsDefault={isDefaultLayout(layout)} />
      </div>
    </div>
  );
}

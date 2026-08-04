import type { Metadata } from "next";
import "./globals.css";
import Fx from "./fx";
import { accentVars } from "@/lib/dashboard-layout";
import { readAccent } from "@/lib/dashboard-settings";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "APEX Assessment · Schneider Electric",
  description:
    "Digital assessment tool for the APEX TOP 25 Strategic Account Managers. 3 lenses, 22 capabilities, zone analytics.",
};

/**
 * The accent is applied at the ROOT rather than in the app shell so that it reaches every
 * page under it from one place, and it is server-rendered into the markup, so a page
 * arrives already the right colour — no flash of Schneider green on the way to a violet.
 *
 * The colour belongs to the signed-in person, so the sign-in screen itself has nobody to
 * ask and paints in the shipped green. Same for an assessor: the Dashboard Manager is
 * superadmin-only, so they have nothing stored and get the default.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const accent = readAccent(me?.id);
  return (
    <html lang="en" data-accent={accent} style={accentVars(accent) as React.CSSProperties}>
      <body>
        <Fx />
        {children}
      </body>
    </html>
  );
}

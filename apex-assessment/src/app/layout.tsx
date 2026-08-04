import type { Metadata } from "next";
import "./globals.css";
import Fx from "./fx";
import { DEFAULT_ACCENT, themeVars } from "@/lib/dashboard-layout";
import { readColors } from "@/lib/dashboard-settings";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "APEX Assessment · Schneider Electric",
  description:
    "Digital assessment tool for the APEX TOP 25 Strategic Account Managers. 3 lenses, 22 capabilities, zone analytics.",
};

/**
 * Colours are applied at the ROOT rather than in the app shell so they reach every page from
 * one place, and they are server-rendered into the markup, so a page arrives already the
 * right colour — no flash of the shipped palette on the way to a chosen one.
 *
 * They belong to the signed-in person, so the sign-in screen has nobody to ask and paints as
 * shipped. Same for an assessor: the Dashboard Manager is superadmin-only, so they have
 * nothing stored.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  const colors = readColors(me?.id);
  return (
    <html
      lang="en"
      data-accent={colors.accent ?? DEFAULT_ACCENT}
      style={themeVars(colors) as React.CSSProperties}
    >
      <body>
        <Fx />
        {children}
      </body>
    </html>
  );
}

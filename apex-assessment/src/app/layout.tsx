import type { Metadata } from "next";
import "./globals.css";
import Fx from "./fx";
import { accentVars } from "@/lib/dashboard-layout";
import { readAccent } from "@/lib/dashboard-settings";

export const metadata: Metadata = {
  title: "APEX Assessment · Schneider Electric",
  description:
    "Digital assessment tool for the APEX TOP 25 Strategic Account Managers. 3 lenses, 22 capabilities, zone analytics.",
};

/**
 * The accent is applied here rather than in the app shell so the sign-in screen is painted
 * in it too — the first thing anyone sees is the part of the app most worth having in the
 * customer's own colour.
 *
 * It is server-rendered into the markup, so the page arrives already the right colour;
 * there is no flash of Schneider green on the way to a Deep blue deployment.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const accent = readAccent();
  return (
    <html lang="en" data-accent={accent} style={accentVars(accent) as React.CSSProperties}>
      <body>
        <Fx />
        {children}
      </body>
    </html>
  );
}

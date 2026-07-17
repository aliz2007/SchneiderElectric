import type { Metadata } from "next";
import "./globals.css";
import Fx from "./fx";

export const metadata: Metadata = {
  title: "APEX Assessment · Schneider Electric",
  description:
    "Digital assessment tool for the APEX TOP 25 Strategic Account Managers — 3 lenses, 22 capabilities, zone analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Fx />
        {children}
      </body>
    </html>
  );
}

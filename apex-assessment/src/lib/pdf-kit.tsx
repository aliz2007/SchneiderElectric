import { StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";

/**
 * Shared @react-pdf primitives for every printable report in the app.
 *
 * Added with the population dashboard decks so they share one palette, one page chrome and
 * one score colour ramp. Anything specific to a single report stays in that report's file.
 *
 * KNOWN DUPLICATION: pdf-report.tsx (the individual report) still carries its own copies of
 * these constants and of Chrome/SectionHead. It predates this module and was left alone
 * rather than refactored late in a shipping session. The values are identical today; if you
 * change a colour here, change it there too, or better, finish the migration.
 *
 * Light theme on purpose: these are printed and shared. Stick to WinAnsi-safe characters
 * (no checkmarks, arrows or box drawing) because the base Helvetica font cannot encode them.
 */

export const INK = "#17203a";
export const MUTED = "#64748b";
export const FAINT = "#94a3b8";
export const LINE = "#e5eaf2";
export const CARD = "#f8fafc";
export const GREEN = "#0f9d4f";
export const GREEN_DEEP = "#007a3d";
export const GREEN_BG = "#e5f8ec";

/**
 * Lens colours, shared by every radar so a colour means the same thing in all reports —
 * and, since this pass, the same thing it means on screen. Blue used to be Manager in the
 * app and APEX Panel in print, which handed anyone holding both a report and a laptop two
 * contradictory keys.
 *
 * These are the darker, less chromatic cousins of the screen --lens-* tokens: the app
 * draws on near-black navy and a report prints on white, so the same hue needs more weight
 * here to hold a 0.9pt stroke.
 */
export const RADAR_SELF = "#7c5cd6"; // violet
export const RADAR_MANAGER = "#2f6fd0"; // blue
export const RADAR_PANEL = "#c02a97"; // magenta
export const RADAR_AVG = GREEN_DEEP;

/** Background/foreground for a score, by how far it sits from the level required. */
export function gapColors(gap: number): { bg: string; fg: string } {
  if (gap >= 0) return { bg: GREEN_BG, fg: GREEN };
  if (gap >= -1) return { bg: "#fdf1de", fg: "#b45309" };
  return { bg: "#fdeaea", fg: "#c92a2a" };
}

/**
 * @react-pdf's SVG <Text> is typed without fontSize/fontFamily/textAnchor even though it
 * honours them, so every chart label would need a cast at the call site. Widen the type
 * once here instead.
 */
type SvgTextProps = {
  x: number;
  y: number;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
  children?: string | number;
};
export const SvgText = Text as unknown as (props: SvgTextProps) => ReactElement;

export const kit = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 50,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
  },
  topBand: { position: "absolute", top: 0, left: 0, right: 0, height: 5, backgroundColor: GREEN_DEEP },
  footer: { position: "absolute", bottom: 22, left: 42, right: 42 },
  footerLine: { height: 1, backgroundColor: LINE, marginBottom: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: FAINT },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2, lineHeight: 1.4 },
  sectionSub: { fontSize: 8.5, color: MUTED, marginBottom: 6 },
});

export function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={kit.sectionTitle}>{title}</Text>
      {sub ? <Text style={kit.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

/** Green top band + page footer, repeated (fixed) on every content page. */
export function Chrome({ generatedAt, note }: { generatedAt: string; note?: string }) {
  return (
    <>
      <View style={kit.topBand} fixed />
      <View style={kit.footer} fixed>
        <View style={kit.footerLine} />
        <View style={kit.footerRow}>
          <Text style={kit.footerText}>
            {note ?? "Schneider Electric · APEX TOP 25 · Confidential assessment report"} · Generated{" "}
            {generatedAt}
          </Text>
          <Text
            style={kit.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </View>
    </>
  );
}

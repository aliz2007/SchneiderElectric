// Radar chart for a population (zone / segment / track), sized for grid cells.

import { G, Line, Polygon, Rect, Svg, Text, View } from "@react-pdf/renderer";
import {
  FAINT,
  INK,
  LINE,
  MUTED,
  RADAR_AVG,
  RADAR_MANAGER,
  RADAR_PANEL,
  RADAR_SELF,
  SvgText,
} from "./pdf-kit";
import type { ClusterProfile } from "./queries";

/**
 * Radar for a POPULATION (a zone, a segment, a zone crossed with a track, or everyone),
 * plotting the 6 cluster capabilities against the 3 lenses plus the level the track expects.
 *
 * Sized by its `size` prop so several can sit in a grid. Measured budget on A4 with the
 * standard page padding: FOUR at size 220 fit one page comfortably; EIGHT at size 150 do
 * NOT — the last row spills and orphans onto the next page. Callers must keep each grid
 * cell in a wrap={false} View and stay within that budget.
 *
 * Axes with no data are dropped rather than plotted at zero. A cluster nobody in the group
 * is measured on (Acquisition Excellence for a Saturation-only population, say) would
 * otherwise pull the expected web into the centre and read as "target comfortably met".
 */

const LENS_WEBS = [
  { key: "self" as const, label: "Self", color: RADAR_SELF },
  { key: "manager" as const, label: "Manager", color: RADAR_MANAGER },
  { key: "expert" as const, label: "APEX Panel", color: RADAR_PANEL },
];

/** Two-line labels so long cluster names stay clear of the web. */
function splitLabel(name: string): string[] {
  const words = name.split(" ");
  if (words.length < 2) return [name];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b);
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * Internal drawing space. Fixed, so type sizes and spacing stay in proportion no matter how
 * large the chart is rendered; only the `height` prop changes.
 *
 * WIDER than it is tall on purpose. Cluster names sit left and right of the web anchored
 * start/end, and on a square viewBox the longest of them ("Commercial & Sales Excellence")
 * runs past the edge, where SVG clips it.
 */
const VB_H = 240;
const VB_W = 340;
const ASPECT = VB_W / VB_H;

/** Minimum rendered height for content to fill a given column width without letterboxing. */
export function radarHeightFor(columnWidthPt: number): number {
  return Math.round(columnWidthPt / ASPECT) + 2;
}

export function GroupRadar({
  clusters,
  height = 170,
  showLabels = true,
}: {
  clusters: ClusterProfile[];
  /** rendered height in points; use radarHeightFor(columnWidth) so the chart fills its column */
  height?: number;
  /** off for very small charts, where cluster names would collide */
  showLabels?: boolean;
}) {
  // Only axes somebody in this group is actually scored on.
  const measured = clusters.filter((c) => c.weighted != null || c.required != null);
  // Then: if ANY axis has a required level, keep only the axes that have one. A single-track
  // population has no target at all on the other track's cluster (Saturation Excellence is
  // unrated on the Acquisition track and vice versa), and mixing an untargeted axis in means
  // no closed target web can be drawn, which leaves the reader with a shape and nothing to
  // read it against. The dropped cluster keeps its score in the table underneath. This is
  // the same rule the individual report applies.
  const anyRequired = measured.some((c) => c.required != null);
  const axes = anyRequired ? measured.filter((c) => c.required != null) : measured;
  if (axes.length < 3) return null;

  const n = axes.length;
  const size = VB_H;
  const H = VB_H;
  const W = showLabels ? VB_W : VB_H;
  const CX = W / 2;
  const CY = H / 2;
  const R = showLabels ? size * 0.34 : size * 0.40;
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const pt = (i: number, v: number): [number, number] => [
    CX + (Math.cos(angle(i)) * (R * v)) / 3,
    CY + (Math.sin(angle(i)) * (R * v)) / 3,
  ];
  const ring = (v: number) =>
    axes.map((_, i) => pt(i, v).map((c) => c.toFixed(1)).join(",")).join(" ");
  const web = (get: (c: ClusterProfile) => number | null) =>
    axes.map((c, i) => pt(i, get(c) ?? 0).map((v) => v.toFixed(1)).join(",")).join(" ");

  const activeLenses = LENS_WEBS.filter((l) => axes.some((c) => c[l.key] != null));
  // only close an expected web when EVERY axis has one, otherwise a missing axis drags it
  // through the centre and the shape lies
  const hasRequired = axes.every((c) => c.required != null);

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height}>
      {[1, 2, 3].map((v) => (
        <Polygon key={v} points={ring(v)} fill="none" stroke={LINE} strokeWidth={v === 3 ? 0.9 : 0.6} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 3);
        return <Line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke={LINE} strokeWidth={0.6} />;
      })}
      {/* level markers up the top spoke */}
      {[1, 2, 3].map((v) => (
        <SvgText key={v} x={CX + 3} y={CY - (R * v) / 3 - 1.5} fill={FAINT} fontSize={size * 0.030}>
          {`L${v}`}
        </SvgText>
      ))}

      {hasRequired && (
        <Polygon points={web((c) => c.required)} fill="none" stroke={INK} strokeWidth={1} strokeDasharray="3 2.5" />
      )}

      {activeLenses.map((l) => (
        <Polygon
          key={l.key}
          points={web((c) => c[l.key])}
          fill="none"
          stroke={l.color}
          strokeWidth={0.8}
        />
      ))}

      {/* the weighted score is the one that matters, so it is the emphasised web */}
      {axes.some((c) => c.weighted != null) && (
        <G>
          <Polygon
            points={web((c) => c.weighted)}
            fill={RADAR_AVG}
            fillOpacity={0.13}
            stroke={RADAR_AVG}
            strokeWidth={2.2}
          />
          {axes.map((c, i) => {
            if (c.weighted == null) return null;
            const [x, y] = pt(i, c.weighted);
            const r = size * 0.011;
            return <Rect key={i} x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r} fill={RADAR_AVG} />;
          })}
        </G>
      )}

      {showLabels &&
        axes.map((c, i) => {
          const a = angle(i);
          const lx = CX + Math.cos(a) * (R + size * 0.06);
          const ly = CY + Math.sin(a) * (R + size * 0.075);
          const cos = Math.cos(a);
          const anchor: "start" | "middle" | "end" = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
          const rows = splitLabel(c.cluster);
          const fs = size * 0.038;
          const baseY = ly + (Math.sin(a) > 0.35 ? fs : Math.sin(a) < -0.35 ? -fs * 0.6 : fs * 0.3);
          return (
            <G key={c.cluster}>
              {rows.map((row, ri) => (
                <SvgText
                  key={ri}
                  x={lx}
                  y={baseY + ri * (fs * 1.25) - ((rows.length - 1) * fs * 0.6)}
                  fill={INK}
                  fontSize={fs}
                  fontFamily="Helvetica-Bold"
                  textAnchor={anchor}
                >
                  {row}
                </SvgText>
              ))}
            </G>
          );
        })}
    </Svg>
  );
}

/** Shared key for the radars, so each chart does not repeat it. */
export function RadarLegend() {
  const keys = [...LENS_WEBS, { key: "weighted", label: "Weighted score", color: RADAR_AVG }];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 4 }}>
      {keys.map((l) => (
        <View key={l.key} style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, marginRight: 4, backgroundColor: l.color }} />
          <Text style={{ fontSize: 7.5, color: MUTED }}>{l.label}</Text>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            marginRight: 4,
            borderWidth: 1,
            borderColor: INK,
            borderStyle: "dashed",
          }}
        />
        <Text style={{ fontSize: 7.5, color: MUTED }}>Expected level</Text>
      </View>
    </View>
  );
}

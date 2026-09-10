// Capability Dashboard PDF document (population-level, 9 pages).

import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  CARD,
  Chrome,
  FAINT,
  GREEN_BG,
  GREEN_DEEP,
  INK,
  LINE,
  MUTED,
  SectionHead,
  gapColors,
  kit,
} from "./pdf-kit";
import { GroupRadar, RadarLegend, radarHeightFor } from "./pdf-group-radar";
import type { GroupProfile } from "./queries";

// Words never break with a hyphen: a mid-word "-" is both ugly and against the house style.
Font.registerHyphenationCallback((word) => [word]);

/**
 * APEX Capability Dashboard — the population-level report.
 *
 * Mirrors the client's proposal document section for section:
 *   IO Global Overview   one radar across all International Operations (the benchmark)
 *   Zone Overview        one radar per zone
 *   Segment View         one radar per business segment
 *   Track View           two radars per zone, Acquisition and Saturation, one page per zone
 *   Gap to Target        one radar plus a ranked table of the biggest cluster gaps
 *
 * Every figure is the WEIGHTED score (Self 20% / APEX Panel 35% / Manager 45%,
 * re-normalised over the lenses that have submitted), which is the canonical score
 * everywhere else in the app. Radars carry the expected level as a dashed web so a shape
 * can be read as on or off target without cross-referencing a table.
 */

export type DashboardProps = {
  generatedAt: string;
  logoDataUri: string;
  io: GroupProfile;
  zones: GroupProfile[];
  segments: GroupProfile[];
  zoneTracks: { zone: string; tracks: GroupProfile[] }[];
  /** filters in force when the report was generated, for the cover */
  scopeNote: string | null;
  amCount: number;
  submittedCount: number;
  weightsLabel: string;
  /** set when the deck covers ONE zone; retitles the report and drops the zone comparison */
  zoneLabel?: string;
};

const s = StyleSheet.create({
  ...kit,

  coverPage: { fontFamily: "Helvetica", color: INK, flexDirection: "column" },
  coverBand: { backgroundColor: GREEN_DEEP, paddingTop: 60, paddingBottom: 42, paddingHorizontal: 46 },
  coverBrandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  coverLogo: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  coverLogoText: { color: GREEN_DEEP, fontSize: 15, fontFamily: "Helvetica-Bold" },
  coverBrandName: { color: "#ffffff", fontSize: 13, fontFamily: "Helvetica-Bold" },
  coverBrandSub: { color: "#c9ecd6", fontSize: 9, marginTop: 2 },
  coverTitle: { color: "#ffffff", fontSize: 30, fontFamily: "Helvetica-Bold", marginTop: 26, letterSpacing: -0.4 },
  coverSub: { color: "#d6f2e0", fontSize: 11, marginTop: 6 },
  coverBody: { paddingHorizontal: 46, paddingTop: 30, flexGrow: 1 },
  coverLead: { fontSize: 10, color: MUTED, lineHeight: 1.6, marginBottom: 18 },

  statRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  stat: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 10, padding: 12, backgroundColor: CARD },
  statLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.7 },
  statValue: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 4 },
  statNote: { fontSize: 7.5, color: FAINT, marginTop: 2 },

  tocItem: { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 1, borderBottomColor: LINE },
  tocName: { flex: 1, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  tocWhy: { flex: 2, fontSize: 8.5, color: MUTED },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "48.6%", borderWidth: 1, borderColor: LINE, borderRadius: 9, padding: 9, backgroundColor: "#ffffff" },
  cellWide: { width: "100%", borderWidth: 1, borderColor: LINE, borderRadius: 9, padding: 12, backgroundColor: "#ffffff" },
  cellHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 1 },
  cellTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  cellMeta: { fontSize: 7.5, color: MUTED, marginBottom: 3 },
  pill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, minWidth: 40, alignItems: "center" },
  pillText: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  emptyCell: { fontSize: 8.5, color: FAINT, paddingVertical: 26, textAlign: "center" },

  tab: { marginTop: 10, borderWidth: 1, borderColor: LINE, borderRadius: 6 },
  tabHead: { flexDirection: "row", backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4, paddingHorizontal: 8 },
  tabRow: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f2f5f9" },
  th: { fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8.5 },
  colName: { width: "40%" },
  colNum: { width: "15%", textAlign: "center" },
  colNumWide: { width: "20%", textAlign: "center" },
});

function fmt(v: number | null | undefined, d = 2): string {
  return v == null ? "n/a" : v.toFixed(d);
}

function GapPill({ gap }: { gap: number | null }) {
  if (gap == null) return <Text style={[s.td, { color: FAINT, textAlign: "center" }]}>n/a</Text>;
  const c = gapColors(gap);
  return (
    <View style={[s.pill, { backgroundColor: c.bg, alignSelf: "center" }]}>
      <Text style={[s.pillText, { color: c.fg }]}>{`${gap > 0 ? "+" : ""}${gap.toFixed(2)}`}</Text>
    </View>
  );
}

/** One radar in a grid cell, with its headline score and gap. */
// Usable content width on A4 with this page padding, and what is left inside a grid cell
// after its own padding. The radar height is derived from these so the chart fills its
// column instead of being letterboxed by a guessed height.
const CONTENT_W = 595.28 - 42 * 2;
const CELL_W = CONTENT_W * 0.486 - 18;
const WIDE_W = CONTENT_W - 24;

function ProfileCell({
  profile,
  wide = false,
  showLabels = true,
}: {
  profile: GroupProfile;
  wide?: boolean;
  showLabels?: boolean;
}) {
  const empty = profile.scoredCount === 0;
  return (
    <View style={wide ? s.cellWide : s.cell} wrap={false}>
      <View style={s.cellHead}>
        <Text style={s.cellTitle}>{profile.label}</Text>
        {!empty && <GapPill gap={profile.overallGap} />}
      </View>
      <Text style={s.cellMeta}>
        {profile.amCount} Account Manager{profile.amCount === 1 ? "" : "s"}
        {empty
          ? " · no submitted assessments"
          : ` · ${fmt(profile.overallWeighted)} vs ${fmt(profile.overallRequired)} expected`}
      </Text>
      {empty ? (
        <Text style={s.emptyCell}>
          {profile.amCount === 0
            ? "Nobody on this track in this zone."
            : "No assessment submitted yet for this group."}
        </Text>
      ) : (
        <GroupRadar
          clusters={profile.clusters}
          height={radarHeightFor(wide ? WIDE_W : CELL_W)}
          showLabels={showLabels}
        />
      )}
    </View>
  );
}

/** Cluster-by-cluster figures under a set of radars. */
function ClusterTable({ profile }: { profile: GroupProfile }) {
  return (
    <View style={s.tab}>
      <View style={s.tabHead}>
        <Text style={[s.th, s.colName]}>Cluster capability</Text>
        <Text style={[s.th, s.colNum]}>Score</Text>
        <Text style={[s.th, s.colNumWide]}>Average score expected</Text>
        <Text style={[s.th, s.colNum]}>Gap</Text>
      </View>
      {profile.clusters.map((c) => {
        const gap = c.weighted != null && c.required != null ? c.weighted - c.required : null;
        return (
          <View key={c.cluster} style={s.tabRow} wrap={false}>
            <Text style={[s.td, s.colName]}>{c.cluster}</Text>
            <Text style={[s.td, s.colNum, { fontFamily: "Helvetica-Bold" }]}>{fmt(c.weighted)}</Text>
            <Text style={[s.td, s.colNumWide, { color: MUTED }]}>{fmt(c.required)}</Text>
            <View style={s.colNum}>
              <GapPill gap={gap} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Comparison table: one row per group, for the pages that show several radars. */
function GroupTable({ groups, header }: { groups: GroupProfile[]; header: string }) {
  return (
    <View style={s.tab}>
      <View style={s.tabHead}>
        <Text style={[s.th, s.colName]}>{header}</Text>
        <Text style={[s.th, s.colNum]}>AMs</Text>
        <Text style={[s.th, s.colNum]}>Score</Text>
        <Text style={[s.th, s.colNumWide]}>Average score expected</Text>
        <Text style={[s.th, s.colNum]}>Gap</Text>
      </View>
      {groups.map((g) => (
        <View key={g.label} style={s.tabRow} wrap={false}>
          <Text style={[s.td, s.colName]}>{g.label}</Text>
          <Text style={[s.td, s.colNum, { color: MUTED }]}>{g.amCount}</Text>
          <Text style={[s.td, s.colNum, { fontFamily: "Helvetica-Bold" }]}>{fmt(g.overallWeighted)}</Text>
          <Text style={[s.td, s.colNumWide, { color: MUTED }]}>{fmt(g.overallRequired)}</Text>
          <View style={s.colNum}>
            <GapPill gap={g.overallGap} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardPdf(p: DashboardProps) {
  const scored = p.io.scoredCount > 0;
  // biggest deficits across the whole population, worst first
  const ranked = [...p.io.clusters]
    .map((c) => ({ ...c, gap: c.weighted != null && c.required != null ? c.weighted - c.required : null }))
    .filter((c) => c.gap != null)
    .sort((a, b) => a.gap! - b.gap!);

  return (
    <Document
      title="APEX Capability Dashboard"
      author="Schneider Electric"
      subject="APEX TOP 25 population capability report"
    >
      {/* ---------- cover ---------- */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverBand}>
          <View style={s.coverBrandRow}>
            {p.logoDataUri ? (
              <View style={[s.coverLogo, { backgroundColor: "#ffffff" }]}>
                <Image src={p.logoDataUri} style={{ width: 30, height: 30 }} />
              </View>
            ) : (
              <View style={[s.coverLogo, { backgroundColor: "#ffffff" }]}>
                <Text style={s.coverLogoText}>SE</Text>
              </View>
            )}
            <View>
              <Text style={s.coverBrandName}>Schneider Electric</Text>
              <Text style={s.coverBrandSub}>APEX TOP 25 · Strategic Account Manager Assessment</Text>
            </View>
          </View>
          <Text style={s.coverTitle}>
            {p.zoneLabel ? `${p.zoneLabel} Capability Report` : "APEX Capability Dashboard"}
          </Text>
          <Text style={s.coverSub}>
            {p.zoneLabel
              ? `Every Account Manager in ${p.zoneLabel}`
              : "Population view across International Operations"}
            {p.scopeNote ? ` · ${p.scopeNote}` : ""}
          </Text>
        </View>

        <View style={s.coverBody}>
          <Text style={s.coverLead}>
            Where capability sits against what each track requires, read at population level rather
            than person by person. Every figure is the weighted score ({p.weightsLabel}), combined
            over the lenses that have submitted. Radars carry the expected level as a dashed web, so
            a shape can be read as on or off target on sight.
          </Text>

          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Population</Text>
              <Text style={s.statValue}>{p.amCount}</Text>
              <Text style={s.statNote}>Account Managers in scope</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Assessed</Text>
              <Text style={s.statValue}>{p.submittedCount}</Text>
              <Text style={s.statNote}>with at least one submitted lens</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Weighted score</Text>
              <Text style={[s.statValue, { color: scored ? GREEN_DEEP : FAINT }]}>
                {fmt(p.io.overallWeighted)}
              </Text>
              <Text style={s.statNote}>vs {fmt(p.io.overallRequired)} expected</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Gap</Text>
              <Text
                style={[
                  s.statValue,
                  { color: p.io.overallGap == null ? FAINT : gapColors(p.io.overallGap).fg },
                ]}
              >
                {p.io.overallGap == null
                  ? "n/a"
                  : `${p.io.overallGap > 0 ? "+" : ""}${p.io.overallGap.toFixed(2)}`}
              </Text>
              <Text style={s.statNote}>weighted minus expected</Text>
            </View>
          </View>

          <SectionHead title="What is in this report" />
          {(p.zoneLabel
            ? [
                [`${p.zoneLabel} Overview`, "Benchmark this zone's capability maturity."],
                ["Segment View", "Differentiate the learning offered per segment in this zone."],
                ["Track View", "See which capabilities are weak in Acquisition and in Saturation."],
                ["Gap to Target", "Know where to start: the biggest gaps to close first."],
              ]
            : [
                ["IO Global Overview", "Benchmark the capability maturity of the whole population."],
                ["Zone Overview", "Identify which zone to prioritise to start the learnings."],
                ["Segment View", "Differentiate the learning offered per segment."],
                ["Track View", "See which capabilities are weak in Acquisition and in Saturation."],
                ["Gap to Target", "Know where to start: the biggest gaps to close first."],
              ]
          ).map(([name, why]) => (
            <View key={name} style={s.tocItem}>
              <Text style={s.tocName}>{name}</Text>
              <Text style={s.tocWhy}>{why}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* ---------- IO global overview ---------- */}
      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Capability dashboard" />
        <SectionHead
          title={p.zoneLabel ? `${p.zoneLabel} Overview` : "IO Global Overview"}
          sub={
            p.zoneLabel
              ? `Every Account Manager in ${p.zoneLabel}. The cluster capabilities against the 3 lenses, with the level the tracks expect.`
              : "All International Operations. The 6 cluster capabilities against the 3 lenses, with the level the tracks expect."
          }
        />
        <ProfileCell profile={p.io} wide />
        <RadarLegend />
        <ClusterTable profile={p.io} />
      </Page>

      {/* ---------- zone overview (all-zones deck only) ---------- */}
      {p.zones.length > 0 && (
      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Capability dashboard" />
        <SectionHead
          title="Zone Overview"
          sub="One radar per zone. Which zone to prioritise to start the learnings."
        />
        <View style={s.grid}>
          {p.zones.map((z) => (
            <ProfileCell key={z.label} profile={z} />
          ))}
        </View>
        <RadarLegend />
        <GroupTable groups={p.zones} header="Zone" />
      </Page>
      )}

      {/* ---------- segment view ---------- */}
      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Capability dashboard" />
        <SectionHead
          title="Segment View"
          sub="One radar per business segment. Differentiate the learning offered per segment."
        />
        <View style={s.grid}>
          {p.segments.map((g) => (
            <ProfileCell key={g.label} profile={g} />
          ))}
        </View>
        <RadarLegend />
        <GroupTable groups={p.segments} header="Segment" />
      </Page>

      {/* ---------- track view: one page per zone ----------
          Two radars per zone rather than eight on one page: eight at a size small enough to
          fit overflow the page and orphan the last row, and the cluster labels stop being
          readable well before that. */}
      {p.zoneTracks.map((zt) => (
        <Page key={zt.zone} size="A4" style={s.page}>
          <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Capability dashboard" />
          <SectionHead
            title={`Track View · ${zt.zone}`}
            sub="Acquisition against Saturation. Which capabilities are weak on each track in this zone."
          />
          <View style={s.grid}>
            {zt.tracks.map((t) => (
              <ProfileCell key={t.label} profile={t} />
            ))}
          </View>
          <RadarLegend />
          {zt.tracks
            .filter((t) => t.scoredCount > 0)
            .map((t) => (
              <View key={t.label} wrap={false}>
                <Text style={[s.cellTitle, { marginTop: 10 }]}>{`${zt.zone} · ${t.label}`}</Text>
                <ClusterTable profile={t} />
              </View>
            ))}
        </Page>
      ))}

      {/* ---------- gap to target ---------- */}
      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Capability dashboard" />
        <SectionHead
          title="Gap to Target"
          sub={
            p.zoneLabel
              ? `${p.zoneLabel} against the level the tracks require. Where to start: the biggest gaps first.`
              : "The whole population against the level the tracks require. Where to start: the biggest gaps first."
          }
        />
        <ProfileCell profile={p.io} wide />
        <RadarLegend />

        <View style={{ marginTop: 12 }}>
          <SectionHead title="Biggest gaps to close" sub="Cluster capabilities ranked by weighted score minus expected." />
          <View style={s.tab}>
            <View style={s.tabHead}>
              <Text style={[s.th, { width: "8%" }]}>#</Text>
              <Text style={[s.th, { width: "42%" }]}>Cluster capability</Text>
              <Text style={[s.th, s.colNum]}>Score</Text>
              <Text style={[s.th, s.colNumWide]}>Average score expected</Text>
              <Text style={[s.th, s.colNum]}>Gap</Text>
            </View>
            {ranked.length === 0 ? (
              <View style={s.tabRow}>
                <Text style={[s.td, { color: FAINT }]}>No submitted assessments yet.</Text>
              </View>
            ) : (
              ranked.map((c, i) => (
                <View key={c.cluster} style={s.tabRow} wrap={false}>
                  <Text style={[s.td, { width: "8%", color: MUTED }]}>{i + 1}</Text>
                  <Text style={[s.td, { width: "42%", fontFamily: "Helvetica-Bold" }]}>{c.cluster}</Text>
                  <Text style={[s.td, s.colNum]}>{fmt(c.weighted)}</Text>
                  <Text style={[s.td, s.colNumWide, { color: MUTED }]}>{fmt(c.required)}</Text>
                  <View style={s.colNum}>
                    <GapPill gap={c.gap} />
                  </View>
                </View>
              ))
            )}
          </View>
          {ranked.length > 0 && ranked[0].gap != null && ranked[0].gap < 0 && (
            <Text style={[s.cellMeta, { marginTop: 8, backgroundColor: GREEN_BG, padding: 8, borderRadius: 6 }]}>
              Start with {ranked[0].cluster}: {fmt(ranked[0].weighted)} against {fmt(ranked[0].required)}{" "}
              expected, the widest gap across the population.
            </Text>
          )}
        </View>
      </Page>
    </Document>
  );
}

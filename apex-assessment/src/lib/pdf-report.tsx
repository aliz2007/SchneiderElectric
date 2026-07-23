import { Document, G, Image, Line, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { Narrative } from "./report-narrative";

/**
 * Individual APEX assessment report — printable PDF mirror of /analysis/am/[id].
 * Light theme on purpose: this document is meant to be printed and shared.
 * Stick to WinAnsi-safe characters (no ✓/✗/↓) — the base Helvetica font
 * can't encode them.
 *
 * Page order: (1) cover, (2) overview — profile + strengths/development +
 * perception, (3) narrative — strengths/weaknesses paragraphs + capability
 * definitions, (4) capability detail table (with theme notes).
 */

export type ReportRow = {
  name: string;
  cluster: string;
  req: number | null;
  self?: number;
  manager?: number;
  expert?: number;
  gap: number | null;
};

export type AmReportProps = {
  amName: string;
  account: string;
  zone: string;
  track: string;
  generatedAt: string;
  lensStatus: { label: string; submitted: boolean; rater?: string }[];
  strengths: { name: string; expert: number; req: number | null }[];
  development: { name: string; expert: number; req: number | null }[];
  perceptionGaps: { name: string; perception: number; self?: number; expert?: number }[];
  clusters: { name: string; rows: ReportRow[]; notes: { lens: string; note: string }[] }[];
  narrative: Narrative;
  narrativeSource: "kimi" | "auto";
  logoDataUri: string; // brand mark PNG as a data URI ("" = fall back to the "SE" text mark)
  hasPanelData: boolean;
};

const INK = "#17203a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e5eaf2";
const CARD = "#f8fafc";
const GREEN = "#0f9d4f";
const GREEN_DEEP = "#007a3d";
const GREEN_BG = "#e5f8ec";

const LVL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#fdeaea", fg: "#c92a2a" },
  2: { bg: "#fdf1de", fg: "#b45309" },
  3: { bg: GREEN_BG, fg: GREEN },
};

function gapColors(gap: number): { bg: string; fg: string } {
  if (gap >= 0) return { bg: GREEN_BG, fg: GREEN };
  if (gap >= -1) return { bg: "#fdf1de", fg: "#b45309" };
  return { bg: "#fdeaea", fg: "#c92a2a" };
}

const s = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 64,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
  },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: GREEN_DEEP,
  },
  footer: { position: "absolute", bottom: 22, left: 42, right: 42 },
  footerLine: { height: 1, backgroundColor: LINE, marginBottom: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: FAINT },

  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
  },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: GREEN_DEEP,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: { color: "#ffffff", fontSize: 11, fontFamily: "Helvetica-Bold" },
  brandName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 1 },
  confPill: {
    borderWidth: 1,
    borderColor: "#f0caca",
    backgroundColor: "#fdf3f3",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  confPillText: { fontSize: 7, color: "#b03a3a", fontFamily: "Helvetica-Bold", letterSpacing: 1.2 },

  name: { fontSize: 24, fontFamily: "Helvetica-Bold", letterSpacing: -0.3, lineHeight: 1.3 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 4, marginBottom: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 22 },
  chip: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3.5, backgroundColor: CARD, borderWidth: 1, borderColor: LINE },
  chipAccent: { backgroundColor: GREEN_BG, borderColor: "#bfe9cf" },
  chipText: { fontSize: 8.5, color: INK },
  chipOk: { color: GREEN, fontFamily: "Helvetica-Bold" },
  chipPending: { color: FAINT },

  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2, lineHeight: 1.4 },
  sectionSub: { fontSize: 8.5, color: MUTED, marginBottom: 8 },

  twoCol: { flexDirection: "row", gap: 10, marginBottom: 18 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#ffffff",
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  dot: { width: 7, height: 7, borderRadius: 99 },
  cardTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  cardSub: { fontSize: 8, color: MUTED, marginBottom: 8 },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: 3.5 },
  listItemLead: { marginRight: 8 },
  listName: { flex: 1, fontSize: 9.5, fontFamily: "Helvetica-Bold", marginRight: 8 },
  listMeta: { fontSize: 8, color: MUTED },
  emptyText: { fontSize: 8.5, color: FAINT, paddingVertical: 4 },

  lvl: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, minWidth: 24, alignItems: "center" },
  percePill: { width: 68, borderRadius: 5, paddingVertical: 2, alignItems: "center" },
  perceptLegend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 8, gap: 14 },
  perceptKey: { flexDirection: "row", alignItems: "center" },
  perceptSwatch: { width: 9, height: 9, borderRadius: 2, marginRight: 5 },
  perceptKeyText: { fontSize: 8, color: MUTED },
  perceptKeyNote: { fontSize: 8, color: FAINT },
  lvlText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  na: { fontSize: 8.5, color: FAINT, textAlign: "center" },

  table: { borderWidth: 1, borderColor: LINE, marginBottom: 18 },
  thead: { flexDirection: "row", backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 6, paddingHorizontal: 10 },
  th: { fontSize: 7.2, fontFamily: "Helvetica-Bold", color: MUTED, letterSpacing: 0.8, textTransform: "uppercase" },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 4.2, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#f0f3f8" },
  td: { fontSize: 9 },
  clusterRow: { backgroundColor: "#eef7f1", paddingVertical: 4, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: LINE },
  clusterText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: GREEN_DEEP, letterSpacing: 1 },
  cellCap: { width: "36%" },
  cellNum: { width: "11.6%", alignItems: "center" },
  cellText: { width: "11.6%", textAlign: "center" },

  // theme (cluster) note rendered inside the capability-detail table, under the header
  themeNoteRow: {
    paddingTop: 5,
    paddingBottom: 5,
    paddingHorizontal: 10,
    backgroundColor: "#fbfdfb",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f3f8",
  },
  themeNote: { flexDirection: "row", gap: 6, marginBottom: 3 },
  themeNoteLens: {
    width: 62,
    fontSize: 7,
    color: GREEN_DEEP,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: 1.5,
  },
  themeNoteText: { flex: 1, fontSize: 8.5, color: "#3c4760", lineHeight: 1.4 },

  // ---- cover page ----
  coverPage: { fontFamily: "Helvetica", color: INK, flexDirection: "column" },
  coverBand: { backgroundColor: GREEN_DEEP, paddingTop: 52, paddingBottom: 38, paddingHorizontal: 46 },
  coverBrandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  coverLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverLogoText: { color: "#ffffff", fontSize: 16, fontFamily: "Helvetica-Bold" },
  coverBrandName: { color: "#ffffff", fontSize: 16, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  coverBrandSub: { color: "#cdead8", fontSize: 8.5, marginTop: 2 },
  coverBody: { paddingHorizontal: 46, paddingTop: 92, flexGrow: 1 },
  coverKicker: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GREEN_DEEP,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  coverName: { fontSize: 34, fontFamily: "Helvetica-Bold", letterSpacing: -0.6, lineHeight: 1.15, marginTop: 12 },
  coverAccount: { fontSize: 12, color: MUTED, marginTop: 8, marginBottom: 16 },
  coverMeta: { paddingHorizontal: 46, paddingBottom: 44 },
  coverMetaLine: { height: 1, backgroundColor: LINE, marginBottom: 12 },
  coverMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  coverConf: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#b03a3a", letterSpacing: 1.4 },
  coverMetaText: { fontSize: 8.5, color: MUTED, marginTop: 3 },
  coverLensRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

  // ---- narrative page ----
  para: { fontSize: 9.5, color: "#31405e", lineHeight: 1.55, marginBottom: 11 },
  paraHead: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: INK, marginTop: 3, marginBottom: 4 },
  clusterLead: { fontFamily: "Helvetica-Bold", color: INK },
  sourceTag: {
    fontSize: 7.5,
    color: GREEN_DEEP,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: -4,
    marginBottom: 10,
  },
  listRow: { flexDirection: "row", marginBottom: 7 },
  listMarker: { width: 11, fontSize: 9.5, color: GREEN_DEEP, fontFamily: "Helvetica-Bold" },
  listItemText: { flex: 1, fontSize: 9.5, color: "#31405e", lineHeight: 1.5 },
});

/**
 * Renders a narrative section. Lines the model returned as "- ..." list items become
 * clean hanging-indent rows; everything else renders as a paragraph. Works for both the
 * AI output (lists) and the deterministic fallback (plain paragraphs).
 */
function NarrativeBody({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <View>
      {lines.map((line, i) => {
        const isItem = /^[-*]\s+/.test(line);
        const clean = line.replace(/^[-*]\s+/, "");
        return isItem ? (
          <View key={i} style={s.listRow}>
            <Text style={s.listMarker}>-</Text>
            <Text style={s.listItemText}>{clean}</Text>
          </View>
        ) : (
          <Text key={i} style={[s.para, { marginBottom: 7 }]}>
            {clean}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Renders a cluster-organised section (strengths / development). Each paragraph the
 * model writes starts with an exact cluster name; we bold that lead so the section
 * scans by theme. A paragraph that doesn't start with a known cluster (e.g. the
 * deterministic fallback prose) simply renders plain.
 */
function ClusterNarrative({ text, clusterNames }: { text: string; clusterNames: string[] }) {
  const paras = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <View>
      {paras.map((p, i) => {
        const clean = p.replace(/^[-*]\s+/, "");
        const cl = clusterNames.find((c) => clean.toLowerCase().startsWith(c.toLowerCase()));
        if (cl) {
          const rest = clean.slice(cl.length); // typically ": ..."
          return (
            <Text key={i} style={[s.para, { marginBottom: 9 }]}>
              <Text style={s.clusterLead}>{cl}</Text>
              {rest}
            </Text>
          );
        }
        return (
          <Text key={i} style={[s.para, { marginBottom: 9 }]}>
            {clean}
          </Text>
        );
      })}
    </View>
  );
}

function Lvl({ level }: { level?: number }) {
  if (!level) return <Text style={s.na}>—</Text>;
  const c = LVL[level];
  return (
    <View style={[s.lvl, { backgroundColor: c.bg }]}>
      <Text style={[s.lvlText, { color: c.fg }]}>L{level}</Text>
    </View>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

/** Green top band + page footer, repeated (fixed) on every content page. */
function Chrome({ generatedAt }: { generatedAt: string }) {
  return (
    <>
      <View style={s.topBand} fixed />
      <View style={s.footer} fixed>
        <View style={s.footerLine} />
        <View style={s.footerRow}>
          <Text style={s.footerText}>
            Schneider Electric · APEX TOP 25 — Confidential assessment report · Generated {generatedAt}
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </View>
    </>
  );
}

function CoverPage(p: AmReportProps) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBand}>
        <View style={s.coverBrandRow}>
          {p.logoDataUri ? (
            <View style={[s.coverLogo, { backgroundColor: "#ffffff" }]}>
              <Image src={p.logoDataUri} style={{ width: 30, height: 30 }} />
            </View>
          ) : (
            <View style={s.coverLogo}>
              <Text style={s.coverLogoText}>SE</Text>
            </View>
          )}
          <View>
            <Text style={s.coverBrandName}>Schneider Electric</Text>
            <Text style={s.coverBrandSub}>APEX TOP 25 · Strategic Account Manager Assessment</Text>
          </View>
        </View>
      </View>

      <View style={s.coverBody}>
        <Text style={s.coverKicker}>Individual Capability Report</Text>
        <Text style={s.coverName}>{p.amName}</Text>
        <Text style={s.coverAccount}>{p.account}</Text>
        <View style={s.chipRow}>
          <View style={[s.chip, s.chipAccent]}>
            <Text style={s.chipText}>{p.zone}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipText}>{p.track} track</Text>
          </View>
        </View>
      </View>

      <View style={s.coverMeta}>
        <View style={s.coverMetaLine} />
        <View style={s.coverMetaRow}>
          <View>
            <Text style={s.coverConf}>CONFIDENTIAL</Text>
            <Text style={s.coverMetaText}>Prepared for internal talent-development use only.</Text>
          </View>
          <Text style={s.coverMetaText}>Generated {p.generatedAt}</Text>
        </View>
        <View style={s.coverLensRow}>
          {p.lensStatus.map((l) => (
            <View key={l.label} style={s.chip}>
              <Text style={[s.chipText, l.submitted ? s.chipOk : s.chipPending]}>
                {l.label}: {l.submitted ? "submitted" : "pending"}
                {l.rater ? ` by ${l.rater}` : ""}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function NarrativePage(p: AmReportProps) {
  const n = p.narrative;
  const clusterNames = p.clusters.map((c) => c.name);
  return (
    <Page size="A4" style={s.page}>
      <Chrome generatedAt={p.generatedAt} />

      <SectionHead
        title="Strengths & development summary"
        sub="A narrative read of the APEX Panel scores, by capability cluster"
      />
      <Text style={s.sourceTag}>
        {p.narrativeSource === "kimi" ? "Written by Kimi (Moonshot AI)" : "Generated automatically from the assessment data"}
      </Text>
      <Text style={s.para}>{n.summary}</Text>

      <Text style={s.paraHead}>Strengths</Text>
      <ClusterNarrative text={n.strengths} clusterNames={clusterNames} />

      <Text style={s.paraHead} wrap={false}>Development areas</Text>
      <ClusterNarrative text={n.development} clusterNames={clusterNames} />

      {n.comments ? (
        <>
          <Text style={s.paraHead} wrap={false}>Assessment comments</Text>
          <NarrativeBody text={n.comments} />
        </>
      ) : null}
    </Page>
  );
}

// colours for the perception (over/under-rating) chart
const OVER = "#e0912f"; // amber — self rated ABOVE the panel (over-rates)
const UNDER = "#4a82c9"; // blue — self rated BELOW the panel (under-rates)

// @react-pdf's SVG <Text> type omits fontSize/fontFamily, though its renderer honours
// them — widen the typing so the chart labels can be sized without a cast at each call.
type SvgTextProps = {
  x: number;
  y: number;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
  textAnchor?: "start" | "middle" | "end";
  children?: string | number;
};
const SvgText = Text as unknown as (props: SvgTextProps) => ReactElement;

/**
 * Diverging bar chart of the person's perception profile: for every capability where
 * the self rating differs from the APEX Panel by a full level or more, a bar leaves the
 * centre axis — right (amber) when they over-rate, left (blue) when they under-rate — its
 * length the size of the gap in levels. Drawn with @react-pdf SVG primitives so it is
 * generated from the data, not a static image. Rows are ordered most over- to most
 * under-rated so the shape reads as a single profile.
 */
function PerceptionChart({ gaps }: { gaps: AmReportProps["perceptionGaps"] }) {
  const rows = [...gaps].sort((a, b) => b.perception - a.perception);
  const W = 511;
  const NAME_X = 168; // right edge of the capability-name gutter
  const PLOT_L = 178;
  const PLOT_R = 402;
  const CX = (PLOT_L + PLOT_R) / 2; // centre axis (agreement with the panel)
  const HALF = (PLOT_R - PLOT_L) / 2;
  const MAXMAG = 2; // levels are 1-3, so the gap is at most 2
  const PER = HALF / MAXMAG;
  const DETAIL_X = 509;
  const HEAD = 20;
  const ROW = 18;
  const BAR = 11;
  const H = HEAD + rows.length * ROW + 2;
  const gridTop = HEAD - 6;
  const gridBottom = H - 2;
  const clip = (name: string) => (name.length > 42 ? name.slice(0, 41) + "..." : name);
  const grid = [CX - 2 * PER, CX - PER, CX + PER, CX + 2 * PER];

  return (
    <View wrap={false}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 4 }}>
        {/* axis labels */}
        <SvgText x={(PLOT_L + CX) / 2} y={10} fill={UNDER} fontSize={7} fontFamily="Helvetica-Bold" textAnchor="middle">
          UNDER-RATES
        </SvgText>
        <SvgText x={(CX + PLOT_R) / 2} y={10} fill={OVER} fontSize={7} fontFamily="Helvetica-Bold" textAnchor="middle">
          OVER-RATES
        </SvgText>
        {/* faint gridlines at +/- 1 and +/- 2 levels, solid centre axis */}
        {grid.map((x, i) => (
          <Line key={i} x1={x} y1={gridTop} x2={x} y2={gridBottom} stroke={LINE} strokeWidth={0.75} />
        ))}
        <Line x1={CX} y1={gridTop} x2={CX} y2={gridBottom} stroke={FAINT} strokeWidth={1} />
        {rows.map((r, i) => {
          const y0 = HEAD + i * ROW;
          const midY = y0 + ROW / 2;
          const over = r.perception > 0;
          const mag = Math.min(MAXMAG, Math.abs(r.perception));
          const len = mag * PER;
          const fill = over ? OVER : UNDER;
          return (
            <G key={r.name}>
              <SvgText x={NAME_X} y={midY + 2.4} fill={INK} fontSize={7.4} textAnchor="end">
                {clip(r.name)}
              </SvgText>
              <Rect x={over ? CX : CX - len} y={midY - BAR / 2} width={len} height={BAR} rx={1.5} fill={fill} />
              <SvgText
                x={over ? CX + len - 3 : CX - len + 3}
                y={midY + 2.3}
                fill="#ffffff"
                fontSize={6.5}
                fontFamily="Helvetica-Bold"
                textAnchor={over ? "end" : "start"}
              >
                {(over ? "+" : "-") + mag}
              </SvgText>
              <SvgText x={DETAIL_X} y={midY + 2.4} fill={MUTED} fontSize={6.8} textAnchor="end">
                {`self L${r.self} vs panel L${r.expert}`}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={s.perceptLegend}>
        <View style={s.perceptKey}>
          <View style={[s.perceptSwatch, { backgroundColor: OVER }]} />
          <Text style={s.perceptKeyText}>Over-rates — self above the panel</Text>
        </View>
        <View style={s.perceptKey}>
          <View style={[s.perceptSwatch, { backgroundColor: UNDER }]} />
          <Text style={s.perceptKeyText}>Under-rates — self below the panel</Text>
        </View>
        <Text style={s.perceptKeyNote}>Bar length and the number show the gap in levels.</Text>
      </View>
    </View>
  );
}

export function AmReportPdf(p: AmReportProps) {
  return (
    <Document
      title={`APEX Assessment — ${p.amName}`}
      author="Schneider Electric"
      subject="APEX TOP 25 individual capability report"
    >
      <CoverPage {...p} />

      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} />

        {/* brand */}
        <View style={s.brandRow}>
          <View style={s.brandLeft}>
            {p.logoDataUri ? (
              <Image src={p.logoDataUri} style={{ width: 30, height: 30 }} />
            ) : (
              <View style={s.logoMark}>
                <Text style={s.logoMarkText}>SE</Text>
              </View>
            )}
            <View>
              <Text style={s.brandName}>Schneider Electric</Text>
              <Text style={s.brandSub}>APEX TOP 25 · Strategic Account Manager Assessment</Text>
            </View>
          </View>
          <View style={s.confPill}>
            <Text style={s.confPillText}>CONFIDENTIAL</Text>
          </View>
        </View>

        {/* profile header */}
        <Text style={s.name}>{p.amName}</Text>
        <Text style={s.subtitle}>Individual capability report · {p.account}</Text>
        <View style={s.chipRow}>
          <View style={[s.chip, s.chipAccent]}>
            <Text style={s.chipText}>{p.zone}</Text>
          </View>
          <View style={s.chip}>
            <Text style={s.chipText}>{p.track} track</Text>
          </View>
          {p.lensStatus.map((l) => (
            <View key={l.label} style={s.chip}>
              <Text style={[s.chipText, l.submitted ? s.chipOk : s.chipPending]}>
                {l.label}: {l.submitted ? "submitted" : "pending"}
                {l.rater ? ` by ${l.rater}` : ""}
              </Text>
            </View>
          ))}
        </View>

        {/* strengths / development */}
        <View style={s.twoCol}>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={[s.dot, { backgroundColor: GREEN }]} />
              <Text style={s.cardTitle}>Strengths</Text>
            </View>
            <Text style={s.cardSub}>APEX Panel at or above the required level</Text>
            {p.strengths.length === 0 ? (
              <Text style={s.emptyText}>No submitted panel data yet.</Text>
            ) : (
              p.strengths.map((r) => (
                <View key={r.name} style={s.listItem} wrap={false}>
                  <View style={s.listItemLead}>
                    <Lvl level={r.expert} />
                  </View>
                  <Text style={s.listName}>{r.name}</Text>
                  <Text style={s.listMeta}>required L{r.req}</Text>
                </View>
              ))
            )}
          </View>
          <View style={s.card}>
            <View style={s.cardHead}>
              <View style={[s.dot, { backgroundColor: "#c92a2a" }]} />
              <Text style={s.cardTitle}>Development areas</Text>
            </View>
            <Text style={s.cardSub}>APEX Panel below the required level</Text>
            {p.development.length === 0 ? (
              <Text style={s.emptyText}>
                {p.hasPanelData ? "No capability below target." : "No submitted panel data yet."}
              </Text>
            ) : (
              p.development.map((r) => (
                <View key={r.name} style={s.listItem} wrap={false}>
                  <View style={s.listItemLead}>
                    <Lvl level={r.expert} />
                  </View>
                  <Text style={s.listName}>{r.name}</Text>
                  <Text style={s.listMeta}>required L{r.req}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* perception gaps — diverging over/under-rating chart */}
        {p.perceptionGaps.length > 0 && (
          <View style={{ marginBottom: 18 }} wrap={false}>
            <SectionHead
              title="Perception profile"
              sub="Where the self-assessment differs from the APEX Panel by a full level or more"
            />
            <PerceptionChart gaps={p.perceptionGaps} />
          </View>
        )}

      </Page>

      <NarrativePage {...p} />

      {/* capability detail — three lenses vs required, grouped by cluster */}
      <Page size="A4" style={s.page}>
        <Chrome generatedAt={p.generatedAt} />
        <SectionHead
          title="Capability detail"
          sub="Three lenses vs the required level, grouped by cluster"
        />
        <View style={s.table}>
          <View style={s.thead}>
            <Text style={[s.th, s.cellCap]}>Capability</Text>
            <Text style={[s.th, s.cellText]}>Required</Text>
            <Text style={[s.th, s.cellText]}>Self</Text>
            <Text style={[s.th, s.cellText]}>Manager</Text>
            <Text style={[s.th, s.cellText]}>APEX</Text>
            <Text style={[s.th, s.cellText]}>Gap</Text>
          </View>
          {p.clusters.map((cl) => (
            <View key={cl.name}>
              <View style={s.clusterRow} wrap={false}>
                <Text style={s.clusterText}>{cl.name.toUpperCase()}</Text>
              </View>
              {cl.notes.length > 0 && (
                <View style={s.themeNoteRow} wrap={false}>
                  {cl.notes.map((n, i) => (
                    <View key={i} style={[s.themeNote, i === cl.notes.length - 1 ? { marginBottom: 0 } : {}]}>
                      <Text style={s.themeNoteLens}>{n.lens}</Text>
                      <Text style={s.themeNoteText}>{n.note}</Text>
                    </View>
                  ))}
                </View>
              )}
              {cl.rows.map((r) => (
                <View key={r.name} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.cellCap, { fontFamily: "Helvetica-Bold" }]}>{r.name}</Text>
                  <View style={s.cellNum}>
                    {r.req == null ? <Text style={s.na}>n/a</Text> : <Text style={s.td}>L{r.req}</Text>}
                  </View>
                  <View style={s.cellNum}>
                    <Lvl level={r.self} />
                  </View>
                  <View style={s.cellNum}>
                    <Lvl level={r.manager} />
                  </View>
                  <View style={s.cellNum}>
                    <Lvl level={r.expert} />
                  </View>
                  <View style={s.cellNum}>
                    {r.gap == null ? (
                      <Text style={s.na}>—</Text>
                    ) : (
                      <View style={[s.lvl, { backgroundColor: gapColors(r.gap).bg }]}>
                        <Text style={[s.lvlText, { color: gapColors(r.gap).fg }]}>
                          {r.gap > 0 ? `+${r.gap}` : r.gap}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

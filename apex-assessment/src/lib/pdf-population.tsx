import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CARD, Chrome, FAINT, GREEN_DEEP, INK, LINE, MUTED, SectionHead, gapColors, kit } from "./pdf-kit";

Font.registerHyphenationCallback((word) => [word]);

/**
 * APEX Population Overview — the account-level table from the client's proposal.
 *
 * One row per Account Manager, so capability results can be read against the accounts they
 * belong to. Repeats the header on every page and never splits a row.
 *
 * Gap is WEIGHTED SCORE minus AVERAGE REQUIRED, the same rule as everywhere else in the
 * app. The proposal's worked example computed it as Self minus Required instead; the two
 * disagree, so the convention is printed on the page rather than left implicit.
 */

export type PopulationRow = {
  zone: string;
  segment: string | null;
  account: string;
  amName: string;
  code: string;
  track: string;
  self: number | null;
  manager: number | null;
  expert: number | null;
  weighted: number | null;
  required: number | null;
  gap: number | null;
};

export type PopulationProps = {
  generatedAt: string;
  rows: PopulationRow[];
  scopeNote: string | null;
  totalCount: number;
  weightsLabel: string;
  /** true once a real performance feed exists; until then the column is shown empty */
  showPerfYtd: boolean;
};

const s = StyleSheet.create({
  ...kit,
  page: { ...kit.page, paddingHorizontal: 28 },
  lead: { fontSize: 8.5, color: MUTED, lineHeight: 1.5, marginBottom: 8 },
  note: {
    fontSize: 7.5,
    color: MUTED,
    lineHeight: 1.45,
    marginTop: 10,
    padding: 7,
    backgroundColor: CARD,
    borderRadius: 5,
    borderLeftWidth: 2,
    borderLeftColor: GREEN_DEEP,
  },
  tab: { borderWidth: 1, borderColor: LINE, borderRadius: 5 },
  head: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 3.6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f5f9",
    alignItems: "center",
  },
  th: { fontSize: 6.6, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, fontFamily: "Helvetica-Bold" },
  td: { fontSize: 8 },
  pill: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1.5, alignItems: "center" },
  pillText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
});

// column widths, summing to 100
const COL = {
  zone: "8%",
  segment: "15%",
  account: "13%",
  name: "15%",
  self: "8%",
  manager: "9%",
  expert: "8%",
  required: "9%",
  weighted: "8%",
  gap: "7%",
} as const;

const fmt = (v: number | null, d = 2) => (v == null ? "n/a" : v.toFixed(d));

export function PopulationPdf(p: PopulationProps) {
  const scored = p.rows.filter((r) => r.weighted != null);
  const below = scored.filter((r) => r.gap != null && r.gap < 0).length;

  return (
    <Document
      title="APEX Population Overview"
      author="Schneider Electric"
      subject="APEX TOP 25 account-level capability overview"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <Chrome generatedAt={p.generatedAt} note="Schneider Electric · APEX TOP 25 · Population overview" />
        <SectionHead
          title="APEX Population Overview"
          sub={`Account-level view of capability results${p.scopeNote ? ` · ${p.scopeNote}` : ""}`}
        />
        <Text style={s.lead}>
          {p.rows.length} of {p.totalCount} Account Managers
          {scored.length ? ` · ${scored.length} assessed · ${below} below the level their track requires` : " · no assessments submitted yet"}.
          Weighted score = {p.weightsLabel}, combined over the lenses that have submitted. Gap is
          the weighted score minus the average level required on that person&apos;s track.
        </Text>

        <View style={s.tab}>
          <View style={s.head} fixed>
            <Text style={[s.th, { width: COL.zone }]}>Zone</Text>
            <Text style={[s.th, { width: COL.segment }]}>Segment</Text>
            <Text style={[s.th, { width: COL.account }]}>Account</Text>
            <Text style={[s.th, { width: COL.name }]}>Account Name</Text>
            <Text style={[s.th, { width: COL.self, textAlign: "center" }]}>Avg self</Text>
            <Text style={[s.th, { width: COL.manager, textAlign: "center" }]}>Manager</Text>
            <Text style={[s.th, { width: COL.expert, textAlign: "center" }]}>Expert</Text>
            <Text style={[s.th, { width: COL.weighted, textAlign: "center" }]}>Weighted</Text>
            <Text style={[s.th, { width: COL.required, textAlign: "center" }]}>Avg required</Text>
            <Text style={[s.th, { width: COL.gap, textAlign: "center" }]}>Gap</Text>
            {p.showPerfYtd && <Text style={[s.th, { width: "8%", textAlign: "center" }]}>Perf YTD</Text>}
          </View>

          {p.rows.length === 0 ? (
            <View style={s.row}>
              <Text style={[s.td, { color: FAINT }]}>No Account Manager matches these filters.</Text>
            </View>
          ) : (
            p.rows.map((r) => (
              <View key={r.code} style={s.row} wrap={false}>
                <Text style={[s.td, { width: COL.zone }]}>{r.zone}</Text>
                <Text style={[s.td, { width: COL.segment, color: MUTED }]}>{r.segment ?? "n/a"}</Text>
                <Text style={[s.td, { width: COL.account }]}>{r.account || "n/a"}</Text>
                <Text style={[s.td, { width: COL.name, fontFamily: "Helvetica-Bold" }]}>{r.amName}</Text>
                <Text style={[s.td, { width: COL.self, textAlign: "center" }]}>{fmt(r.self)}</Text>
                <Text style={[s.td, { width: COL.manager, textAlign: "center" }]}>{fmt(r.manager)}</Text>
                <Text style={[s.td, { width: COL.expert, textAlign: "center" }]}>{fmt(r.expert)}</Text>
                <Text style={[s.td, { width: COL.weighted, textAlign: "center", fontFamily: "Helvetica-Bold" }]}>
                  {fmt(r.weighted)}
                </Text>
                <Text style={[s.td, { width: COL.required, textAlign: "center", color: MUTED }]}>
                  {fmt(r.required)}
                </Text>
                <View style={{ width: COL.gap, alignItems: "center" }}>
                  {r.gap == null ? (
                    <Text style={[s.td, { color: FAINT }]}>n/a</Text>
                  ) : (
                    <View style={[s.pill, { backgroundColor: gapColors(r.gap).bg }]}>
                      <Text style={[s.pillText, { color: gapColors(r.gap).fg }]}>
                        {`${r.gap > 0 ? "+" : ""}${r.gap.toFixed(2)}`}
                      </Text>
                    </View>
                  )}
                </View>
                {p.showPerfYtd && (
                  <Text style={[s.td, { width: "8%", textAlign: "center", color: FAINT }]}>n/a</Text>
                )}
              </View>
            ))
          )}
        </View>

        <Text style={s.note} wrap={false}>
          Two notes on how to read this table. Gap is the WEIGHTED score minus the average
          required level, which is the rule used everywhere else in the app; the worked example
          in the dashboard proposal subtracted the required level from the SELF score instead,
          which produces a different figure and moves a majority of people across the
          above/below-target line. Perf YTD is not shown: no business-performance data is held
          anywhere in this application, so there is nothing to populate it from yet.
        </Text>
      </Page>
    </Document>
  );
}

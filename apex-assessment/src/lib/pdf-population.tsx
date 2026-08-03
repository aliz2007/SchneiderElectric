import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CARD, Chrome, FAINT, GREEN_DEEP, INK, LINE, MUTED, SectionHead, gapColors, kit } from "./pdf-kit";

Font.registerHyphenationCallback((word) => [word]);

/**
 * APEX Population Overview — the account-level table from the client's proposal.
 *
 * One row per Account Manager, so capability results can be read against the accounts they
 * belong to. Repeats the header on every page and never splits a row.
 *
 * Gap follows the basis configured in Admin, Rubric & scoring: either the weighted score or
 * the self-assessment, minus the average required level. The proposal's worked example used
 * the self-based rule and the app defaults to weighted, so whichever is in force is printed
 * on the page rather than left implicit.
 */

export type PopulationRow = {
  zone: string;
  segment: string | null;
  account: string;
  amName: string;
  code: string;
  track: string;
  accountType: string | null;
  perfYtd: number | null;
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
  /** shown once anybody has a performance figure recorded */
  showPerfYtd: boolean;
  perfLabel: string;
  perfSuffix: string;
  /** how Gap was computed, printed so the number is never ambiguous */
  gapBasisLabel: string;
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
  zone: "7%",
  segment: "13%",
  account: "11%",
  name: "13%",
  type: "9%",
  self: "7%",
  manager: "8%",
  expert: "7%",
  weighted: "7%",
  required: "9%",
  gap: "9%",
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
          {" "}{p.gapBasisLabel.toLowerCase()}.
        </Text>

        <View style={s.tab}>
          <View style={s.head} fixed>
            <Text style={[s.th, { width: COL.zone }]}>Zone</Text>
            <Text style={[s.th, { width: COL.segment }]}>Segment</Text>
            <Text style={[s.th, { width: COL.account }]}>Account</Text>
            <Text style={[s.th, { width: COL.name }]}>Account Name</Text>
            <Text style={[s.th, { width: COL.type }]}>Account type</Text>
            <Text style={[s.th, { width: COL.self, textAlign: "center" }]}>Avg self</Text>
            <Text style={[s.th, { width: COL.manager, textAlign: "center" }]}>Manager</Text>
            <Text style={[s.th, { width: COL.expert, textAlign: "center" }]}>Expert</Text>
            <Text style={[s.th, { width: COL.weighted, textAlign: "center" }]}>Weighted</Text>
            <Text style={[s.th, { width: COL.required, textAlign: "center" }]}>Avg required</Text>
            <Text style={[s.th, { width: COL.gap, textAlign: "center" }]}>Gap</Text>
            {p.showPerfYtd && (
              <Text style={[s.th, { width: "10%", textAlign: "center" }]}>{p.perfLabel}</Text>
            )}
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
                <Text style={[s.td, { width: COL.type, color: MUTED }]}>{r.accountType ?? "n/a"}</Text>
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
                  <Text style={[s.td, { width: "10%", textAlign: "center" }]}>
                    {r.perfYtd == null ? "n/a" : `${r.perfYtd.toFixed(1)}${p.perfSuffix}`}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        <Text style={s.note} wrap={false}>
          Gap is {p.gapBasisLabel.toLowerCase()}, configured in Admin, Rubric &amp; scoring.
          {p.showPerfYtd
            ? ` ${p.perfLabel} is entered per Account Manager and is shown for information only; with a population this size, no relationship between capability maturity and performance should be inferred from it.`
            : ` ${p.perfLabel} is hidden because no figure has been recorded for anyone yet; set one on an Account Manager's page under Account details.`}
        </Text>
      </Page>
    </Document>
  );
}

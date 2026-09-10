// Individual Results: sortable, filterable table of every assessed AM (superadmin).

import Link from "next/link";
import { requireSuperadmin } from "@/lib/session";
import { averageRequired, averageWeighted, listAMs, scoredRows, submittedLevels } from "@/lib/queries";
import { ACCOUNT_TYPES, PERF_YTD_LABEL, PERF_YTD_SUFFIX, SEGMENTS, WEIGHTS_LABEL, ZONES } from "@/lib/seed-data";
import { fmt, gapClass } from "@/lib/heat";
import IndividualsFilters from "./filters";

/** Columns that can be sorted. Text columns open A to Z, numeric ones high to low. */
const SORT_KEYS = [
  "name",
  "zone",
  "track",
  "segment",
  "account",
  "accountType",
  "self",
  "manager",
  "expert",
  "weighted",
  "required",
  "gap",
  "perf",
  "below",
] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function IndividualsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    zone?: string;
    track?: string;
    segment?: string;
    accountType?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  await requireSuperadmin();

  // search + Zone / Track / Segment filters + sort, all URL-param driven
  const {
    q: qRaw,
    zone: zoneRaw,
    track: trackRaw,
    segment: segmentRaw,
    accountType: accountTypeRaw,
    sort: sortRaw,
    dir: dirRaw,
  } = await searchParams;
  const q = (qRaw ?? "").trim().toLowerCase();
  const zone = zoneRaw && (ZONES as readonly string[]).includes(zoneRaw) ? zoneRaw : undefined;
  const track = trackRaw === "Acquisition" || trackRaw === "Saturation" ? trackRaw : undefined;
  const segment = segmentRaw && (SEGMENTS as readonly string[]).includes(segmentRaw) ? segmentRaw : undefined;
  const accountType =
    accountTypeRaw && (ACCOUNT_TYPES as readonly string[]).includes(accountTypeRaw) ? accountTypeRaw : undefined;
  const sort = (SORT_KEYS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortKey) : "name";
  const dir: "asc" | "desc" = dirRaw === "desc" ? "desc" : "asc";

  const allAMs = listAMs();
  const matching = allAMs.filter(
    (am) =>
      (!q ||
        am.name.toLowerCase().includes(q) ||
        am.account.toLowerCase().includes(q) ||
        am.code.toLowerCase().includes(q)) &&
      (!zone || am.zone === zone) &&
      (!track || am.track === track) &&
      (!segment || am.segment === segment) &&
      (!accountType || am.account_type === accountType)
  );

  // Build every row first, then sort: the figures are derived (weighted score, gap count),
  // so they have to exist before they can be ordered by.
  const rowsData = matching.map((am) => {
    const levels = submittedLevels(am.id);
    const avg = (m: Map<number, number>) =>
      m.size === 0 ? null : [...m.values()].reduce((a, b) => a + b, 0) / m.size;
    const scored = scoredRows(am.id, am.track);
    const applicable = scored.filter((r) => r.req != null);
    const weighted = averageWeighted(applicable);
    const required = averageRequired(applicable);
    const selfAvg = avg(levels.self);
    return {
      am,
      self: selfAvg,
      manager: avg(levels.manager),
      expert: avg(levels.expert),
      weighted,
      required,
      // the canonical gap: weighted score minus the level this person's track expects
      gap: weighted != null && required != null ? weighted - required : null,
      below: scored.filter((r) => r.gap != null && r.gap < 0).length,
      hasScores: scored.some((r) => r.weighted != null),
    };
  });

  type Row = (typeof rowsData)[number];
  const asText: Partial<Record<SortKey, (r: Row) => string>> = {
    name: (r) => r.am.name,
    zone: (r) => r.am.zone,
    track: (r) => r.am.track,
    segment: (r) => r.am.segment ?? "",
    account: (r) => r.am.account,
    accountType: (r) => r.am.account_type ?? "",
  };
  const asNumber: Partial<Record<SortKey, (r: Row) => number | null>> = {
    self: (r) => r.self,
    manager: (r) => r.manager,
    expert: (r) => r.expert,
    weighted: (r) => r.weighted,
    required: (r) => r.required,
    gap: (r) => r.gap,
    perf: (r) => r.am.perf_ytd,
    below: (r) => (r.hasScores ? r.below : null),
  };

  const rows = rowsData.slice().sort((a, b) => {
    const text = asText[sort];
    if (text) {
      const c = text(a).localeCompare(text(b));
      return dir === "asc" ? c : -c;
    }
    const get = asNumber[sort]!;
    const va = get(a);
    const vb = get(b);
    // "no data yet" always sinks to the bottom, whichever direction is selected
    if (va == null && vb == null) return a.am.name.localeCompare(b.am.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });

  const popParams = new URLSearchParams();
  if (qRaw) popParams.set("q", qRaw);
  if (zone) popParams.set("zone", zone);
  if (track) popParams.set("track", track);
  if (segment) popParams.set("segment", segment);
  if (accountType) popParams.set("accountType", accountType);
  const popQuery = popParams.toString() ? `?${popParams.toString()}` : "";

  const isFiltered = rows.length !== allAMs.length;
  const hrefWith = (over: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (qRaw) sp.set("q", qRaw);
    if (zone) sp.set("zone", zone);
    if (track) sp.set("track", track);
    if (segment) sp.set("segment", segment);
    if (accountType) sp.set("accountType", accountType);
    for (const [k, v] of Object.entries(over)) sp.set(k, v);
    return `/analysis/individuals?${sp.toString()}`;
  };

  /** Header cell that toggles the sort. Sorting is a link, so it survives a reload
   *  and can be shared as a URL like the filters. */
  const Th = ({ label, k, numeric = false }: { label: string; k: SortKey; numeric?: boolean }) => {
    const active = sort === k;
    const nextDir = active ? (dir === "asc" ? "desc" : "asc") : numeric ? "desc" : "asc";
    return (
      <th className={`th-sort${active ? " active" : ""}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={hrefWith({ sort: k, dir: nextDir })}>
          {label}
          {/* Drawn, not typed. The old ↕ / ▲ / ▼ characters rendered at whatever size and
              baseline the platform font chose — at 9px the neutral one was a pair of specks
              you had to click to find out what it did. Both chevrons are always visible; the
              one matching the current direction lights up. */}
          <span className="th-arrow" aria-hidden="true">
            <svg viewBox="0 0 8 12" width="8" height="12">
              <path className={active && dir === "asc" ? "on" : ""} d="M1 5 4 2l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path className={active && dir === "desc" ? "on" : ""} d="M1 7 4 10l3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>
      </th>
    );
  };

  return (
    <div className="page-wide">
      <div className="page-head">
        <div className="page-kicker">Analysis</div>
        <h1 className="page-title">Individual Results</h1>
        <p className="page-sub">
          Per-person comparison of the three assessment lenses and the weighted score
          ({WEIGHTS_LABEL}), plus perception gaps, strengths and development areas.
          Click any column heading to sort.
        </p>
      </div>

      <div className="report-row">
        <div>
          <div className="report-title">APEX Population Overview</div>
          <div className="report-sub">
            The account-level table as a PDF, with the filters below applied.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href={`/analysis/population/pdf${popQuery}`}>
          Download PDF
        </a>
      </div>

      <IndividualsFilters
        current={{
          q: qRaw ?? "",
          zone: zone ?? "all",
          track: track ?? "all",
          segment: segment ?? "all",
          accountType: accountType ?? "all",
        }}
      />
      {isFiltered && (
        <p className="analytics-filter-note" style={{ marginTop: -6, marginBottom: 12 }}>
          Showing {rows.length} of {allAMs.length} Account Managers
        </p>
      )}

      <div className="card card-pad">
        {/* the table is wider than the card; without a hint people do not know the columns
            past "Weighted" exist at all */}
        <div className="scroll-hint">
          <span className="scroll-hint-ico">↔</span> Scroll sideways for the remaining columns
        </div>
        {/* The fade sits on a WRAPPER, never on the scroller. An absolutely-positioned child
            of a scrolling element is placed against its scrollable CONTENT, so `right: 0` on
            the scroller itself pinned the fade to the far right of the table and then let it
            travel with the content — landing as a grey seam down the middle of the columns
            the moment anybody scrolled. */}
        <div className="scroll-fade">
        <div className="hm-scroll table-compact">
          <table className="table">
            <thead>
              <tr>
                <Th label="Account Manager" k="name" />
                <Th label="Zone" k="zone" />
                <Th label="Track" k="track" />
                <Th label="Segment" k="segment" />
                <Th label="Account" k="account" />
                <Th label="Account type" k="accountType" />
                <Th label="Self avg" k="self" numeric />
                <Th label="Mgr avg" k="manager" numeric />
                <Th label="Panel avg" k="expert" numeric />
                <Th label="Weighted" k="weighted" numeric />
                <Th label="Avg required" k="required" numeric />
                <Th label="Gap" k="gap" numeric />
                <Th label={PERF_YTD_LABEL} k="perf" numeric />
                <Th label="Below target" k="below" numeric />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.am.id} className="rowlink">
                  <td style={{ fontWeight: 600 }}>
                    <Link className="row-name-link" href={`/analysis/am/${r.am.id}`}>{r.am.name}</Link>
                  </td>
                  <td><span className="badge badge-zone">{r.am.zone}</span></td>
                  <td><span className="badge badge-track">{r.am.track}</span></td>
                  <td>
                    {r.am.segment ? (
                      <span className="badge badge-segment">{r.am.segment}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>n/a</span>
                    )}
                  </td>
                  <td>
                    {r.am.account ? (
                      <span className="am-account">{r.am.account}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>n/a</span>
                    )}
                    <span className="am-code">{r.am.code}</span>
                  </td>
                  <td>
                    {r.am.account_type ? (
                      <span className="badge badge-gray">{r.am.account_type}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>n/a</span>
                    )}
                  </td>
                  <td>{fmt(r.self, 2)}</td>
                  <td>{fmt(r.manager, 2)}</td>
                  <td>{fmt(r.expert, 2)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(r.weighted, 2)}</td>
                  <td style={{ color: "var(--muted)" }}>{fmt(r.required, 2)}</td>
                  <td>
                    {r.gap == null ? (
                      <span style={{ color: "var(--muted)" }}>n/a</span>
                    ) : (
                      <span className={`lvl-chip ${gapClass(r.gap)}`} style={{ minWidth: 52, fontVariantNumeric: "tabular-nums" }}>
                        {r.gap > 0 ? `+${fmt(r.gap, 2)}` : fmt(r.gap, 2)}
                      </span>
                    )}
                  </td>
                  <td>
                    {r.am.perf_ytd == null ? (
                      <span style={{ color: "var(--muted)" }}>n/a</span>
                    ) : (
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {r.am.perf_ytd.toFixed(1)}
                        {PERF_YTD_SUFFIX}
                      </span>
                    )}
                  </td>
                  <td>
                    {!r.hasScores ? (
                      <span className="badge badge-gray">awaiting scores</span>
                    ) : r.below === 0 ? (
                      <span className="badge badge-green">0 gaps</span>
                    ) : (
                      <span className="badge badge-red">{r.below} capabilities</span>
                    )}
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-outline" href={`/analysis/am/${r.am.id}`}>
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        {rows.length === 0 && (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "14px 2px 4px" }}>
            No Account Manager matches these filters.
          </p>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { gapClass, fmt } from "@/lib/heat";

export type ZoneCap = { id: number; name: string; cluster: string; reqAcq: number | null; reqSat: number | null };
export type ZoneAM = {
  id: number;
  code: string;
  name: string;
  track: "Acquisition" | "Saturation";
  scores: Record<number, number>; // capability id -> submitted APEX Panel level
};

const req = (cap: ZoneCap, track: ZoneAM["track"]) => (track === "Acquisition" ? cap.reqAcq : cap.reqSat);

type Track = "all" | "Acquisition" | "Saturation";
type Sort = "code" | "top" | "bottom";

/**
 * Zone benchmark table (superadmin-only page). Capabilities are rows, Account
 * Managers are columns. Two controls change the view: a track filter
 * (All / Acquisition / Saturation) and a ranking (by AM code, or by overall
 * standing vs required — strongest or weakest first).
 */
export default function ZoneTable({ zone, caps, ams }: { zone: string; caps: ZoneCap[]; ams: ZoneAM[] }) {
  const [track, setTrack] = useState<Track>("all");
  const [sort, setSort] = useState<Sort>("code");

  // per-AM overall standing: average (panel - required) over applicable, scored capabilities
  const overall = useMemo(() => {
    const m = new Map<number, { gap: number | null; score: number | null }>();
    for (const am of ams) {
      let s = 0, r = 0, n = 0;
      for (const cap of caps) {
        const rq = req(cap, am.track);
        const sc = am.scores[cap.id];
        if (rq == null || sc == null) continue;
        s += sc; r += rq; n++;
      }
      m.set(am.id, n === 0 ? { gap: null, score: null } : { gap: (s - r) / n, score: s / n });
    }
    return m;
  }, [ams, caps]);

  const visibleAMs = useMemo(() => {
    const list = (track === "all" ? ams : ams.filter((a) => a.track === track)).slice();
    if (sort === "code") return list.sort((a, b) => a.code.localeCompare(b.code));
    return list.sort((a, b) => {
      const ga = overall.get(a.id)?.gap ?? null;
      const gb = overall.get(b.id)?.gap ?? null;
      if (ga == null && gb == null) return a.code.localeCompare(b.code);
      if (ga == null) return 1; // no data always sinks to the end
      if (gb == null) return -1;
      return sort === "top" ? gb - ga : ga - gb;
    });
  }, [ams, track, sort, overall]);

  const clusters = useMemo(() => {
    const out: { name: string; caps: ZoneCap[] }[] = [];
    for (const cap of caps) {
      const last = out[out.length - 1];
      if (!last || last.name !== cap.cluster) out.push({ name: cap.cluster, caps: [cap] });
      else last.caps.push(cap);
    }
    return out;
  }, [caps]);

  const rankColor = (gap: number | null) =>
    gap == null ? "var(--muted)" : gap > 0 ? "#5fe57d" : gap < 0 ? "var(--red)" : "var(--muted)";

  return (
    <div>
      <div className="zone-controls">
        <div className="zone-control">
          <span className="zone-control-label">Track</span>
          <div className="seg" role="group" aria-label="Filter by track">
            {(["all", "Acquisition", "Saturation"] as Track[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg-btn${track === t ? " active" : ""}`}
                aria-pressed={track === t}
                onClick={() => setTrack(t)}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
        </div>
        <div className="zone-control">
          <span className="zone-control-label">Rank</span>
          <select
            className="zmap-select zone-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Rank the Account Managers"
          >
            <option value="code">By AM code</option>
            <option value="top">Strongest first (highest vs required)</option>
            <option value="bottom">Weakest first (lowest vs required)</option>
          </select>
        </div>
        {track !== "all" && (
          <span className="analytics-filter-note">
            {visibleAMs.length} {track} Account Manager{visibleAMs.length === 1 ? "" : "s"} in {zone}
          </span>
        )}
      </div>

      <div className="hm-scroll">
        <table className="hm">
          <thead>
            <tr>
              <th className="hm-rowhead">Capability</th>
              {visibleAMs.map((am) => {
                const g = overall.get(am.id)?.gap ?? null;
                return (
                  <th key={am.id} title={`${am.name} · ${am.track}`}>
                    <Link href={`/analysis/am/${am.id}`} style={{ color: "var(--blue)" }}>
                      {am.code}
                    </Link>
                    <span className="zone-am-name" title={am.name}>{am.name}</span>
                    {sort !== "code" && (
                      <span className="zone-am-rank" style={{ color: rankColor(g) }}>
                        {g == null ? "n/a" : `${g > 0 ? "+" : ""}${g.toFixed(2)}`}
                      </span>
                    )}
                  </th>
                );
              })}
              <th>Zone avg</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cl) => (
              <Fragment key={cl.name}>
                <tr className="cluster-row">
                  <td colSpan={visibleAMs.length + 2}>{cl.name}</td>
                </tr>
                {cl.caps.map((cap) => {
                  const vals: number[] = [];
                  const cells = visibleAMs.map((am) => {
                    const rq = req(cap, am.track);
                    const score = am.scores[cap.id];
                    if (rq != null && score != null) vals.push(score);
                    const gap = rq == null || score == null ? null : score - rq;
                    const cls = rq == null ? "hm-na" : gapClass(gap);
                    return (
                      <td
                        key={am.id}
                        className={`cell ${cls}`}
                        title={rq == null ? "Not applicable to this AM's track" : score == null ? "No submitted panel score" : `score L${fmt(score, 2)} · required L${rq}`}
                      >
                        {/* the weighted score is a float: always format it, never interpolate
                            it raw, or a 2.3 renders as L2.3000000000000003 */}
                        {rq == null ? "n/a" : score == null ? "n/a" : `L${fmt(score, 2)}`}
                      </td>
                    );
                  });
                  return (
                    <tr key={cap.id}>
                      <th className="hm-rowhead">{cap.name}</th>
                      {cells}
                      <td className="cell hm-na" style={{ background: "rgba(255,255,255,0.09)", color: "var(--ink)" }}>
                        {vals.length === 0 ? "n/a" : fmt(vals.reduce((a, b) => a + b, 0) / vals.length, 2)}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><span className="sw" style={{ background: "#3dcd58" }} />At / above required</span>
        <span><span className="sw" style={{ background: "#fb923c" }} />Below required</span>
        <span><span className="sw" style={{ background: "#f4564a" }} />2+ levels below</span>
        <span><span className="sw" style={{ background: "#3a465e" }} />No data / not applicable to track</span>
      </div>
    </div>
  );
}

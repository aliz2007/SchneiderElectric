"use client";

// Zone benchmark table: sticky names, column paging, track filter, ranking.

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type Sort = "code" | "name" | "top" | "bottom";

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
    const m = new Map<number, { gap: number | null; score: number | null; req: number | null }>();
    for (const am of ams) {
      let s = 0, r = 0, n = 0;
      for (const cap of caps) {
        const rq = req(cap, am.track);
        const sc = am.scores[cap.id];
        if (rq == null || sc == null) continue;
        s += sc; r += rq; n++;
      }
      m.set(
        am.id,
        n === 0 ? { gap: null, score: null, req: null } : { gap: (s - r) / n, score: s / n, req: r / n }
      );
    }
    return m;
  }, [ams, caps]);

  const visibleAMs = useMemo(() => {
    const list = (track === "all" ? ams : ams.filter((a) => a.track === track)).slice();
    if (sort === "code") return list.sort((a, b) => a.code.localeCompare(b.code));
    if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
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

  // Horizontal paging. The native scrollbar sits at the BOTTOM of a table this tall, so
  // reaching it means scrolling the page down and losing sight of the header. These arrows
  // scroll the container from the top, and the capability column is sticky, so the row you
  // are reading stays labelled while the AM columns move.
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const syncEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ left: el.scrollLeft > 4, right: max > 4 && el.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges, visibleAMs.length]);

  const page = (dir: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: "smooth" });
  };

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
            <option value="name">By AM name (A to Z)</option>
            <option value="top">Strongest first (highest vs required)</option>
            <option value="bottom">Weakest first (lowest vs required)</option>
          </select>
        </div>
        {track !== "all" && (
          <span className="analytics-filter-note">
            {visibleAMs.length} {track} Account Manager{visibleAMs.length === 1 ? "" : "s"} in {zone}
          </span>
        )}
        {(edges.left || edges.right) && (
          <div className="hm-pager" role="group" aria-label="Scroll the Account Manager columns">
            <button type="button" className="hm-pager-btn" onClick={() => page(-1)} disabled={!edges.left} aria-label="Scroll left">
              ←
            </button>
            <button type="button" className="hm-pager-btn" onClick={() => page(1)} disabled={!edges.right} aria-label="Scroll right">
              →
            </button>
          </div>
        )}
      </div>

      <div className="hm-scroll hm-zone" ref={scroller} onScroll={syncEdges}>
        <table className="hm">
          <thead>
            <tr>
              <th className="hm-rowhead">Capability</th>
              {visibleAMs.map((am) => {
                const g = overall.get(am.id)?.gap ?? null;
                return (
                  <th key={am.id} title={`${am.name} · ${am.track}`}>
                    {/* the NAME is the label people read, so it leads and carries the link;
                        the code is the secondary reference underneath */}
                    <Link className="zone-am-name" href={`/analysis/am/${am.id}`} title={am.name}>
                      {am.name}
                    </Link>
                    <span className="zone-am-code">{am.code}</span>
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
            {/* every AM's overall standing, so the columns can be compared at a glance */}
            <tr className="cluster-avg-row">
              <th className="hm-rowhead">Weighted score · gap</th>
              {visibleAMs.map((am) => {
                const o = overall.get(am.id);
                return (
                  <td key={am.id} className={`cell ${gapClass(o?.gap ?? null)}`}>
                    {o?.score == null ? (
                      "n/a"
                    ) : (
                      <>
                        {fmt(o.score, 2)}
                        <small>
                          {o.gap! > 0 ? "+" : ""}
                          {fmt(o.gap, 2)} vs req
                        </small>
                      </>
                    )}
                  </td>
                );
              })}
              {/* the zone's own overall standing, averaged over the same AMs so the
                  column compares like for like with the cells to its left */}
              {(() => {
                const all = visibleAMs.map((am) => overall.get(am.id)).filter((o) => o?.score != null) as {
                  score: number;
                  req: number;
                  gap: number;
                }[];
                if (all.length === 0) return <td className="cell hm-na zone-avg-cell">n/a</td>;
                const mean = (f: (o: { score: number; req: number; gap: number }) => number) =>
                  all.reduce((a, o) => a + f(o), 0) / all.length;
                return (
                  <td className="cell hm-na zone-avg-cell">
                    {fmt(mean((o) => o.score), 2)}
                    <small>req {fmt(mean((o) => o.req), 1)}</small>
                  </td>
                );
              })()}
            </tr>
            {clusters.map((cl) => (
              <Fragment key={cl.name}>
                {/* the name lives in the sticky first column; the rest of the row is a
                    filler cell, otherwise a colSpan cell pinned at left:0 drags its text
                    off screen as the columns scroll */}
                <tr className="cluster-row">
                  <td className="hm-rowhead">{cl.name}</td>
                  <td colSpan={visibleAMs.length + 1} />
                </tr>
                {/* the cluster's own weighted average per AM, so a theme can be read without
                    adding up its capability rows */}
                {(() => {
                  const cells = visibleAMs.map((am) => {
                    const vals: number[] = [];
                    const reqs: number[] = [];
                    for (const cap of cl.caps) {
                      const rq = req(cap, am.track);
                      const sc = am.scores[cap.id];
                      if (rq == null || sc == null) continue;
                      vals.push(sc);
                      reqs.push(rq);
                    }
                    if (vals.length === 0) return null;
                    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
                    const score = mean(vals);
                    const rq = mean(reqs);
                    return { score, rq, gap: score - rq };
                  });
                  const withData = cells.filter(Boolean) as { score: number; rq: number; gap: number }[];
                  const mean2 = (f: (c: { score: number; rq: number; gap: number }) => number) =>
                    withData.length ? withData.reduce((a, c) => a + f(c), 0) / withData.length : null;
                  const zoneAvg = mean2((c) => c.score);
                  const zoneReq = mean2((c) => c.rq);
                  return (
                    <tr className="cluster-avg-row">
                      <th className="hm-rowhead">Cluster average</th>
                      {cells.map((c, i) => (
                        <td key={i} className={`cell ${gapClass(c?.gap ?? null)}`}>
                          {c == null ? (
                            "n/a"
                          ) : (
                            <>
                              {fmt(c.score, 2)}
                              <small>
                                req {c.rq.toFixed(1)} · {c.gap > 0 ? "+" : ""}
                                {fmt(c.gap, 2)}
                              </small>
                            </>
                          )}
                        </td>
                      ))}
                      <td className="cell hm-na zone-avg-cell">
                        {zoneAvg == null ? (
                          "n/a"
                        ) : (
                          <>
                            {fmt(zoneAvg, 2)}
                            <small>req {fmt(zoneReq, 1)}</small>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })()}
                {cl.caps.map((cap) => {
                  const vals: number[] = [];
                  const reqVals: number[] = [];
                  const cells = visibleAMs.map((am) => {
                    const rq = req(cap, am.track);
                    const score = am.scores[cap.id];
                    if (rq != null && score != null) { vals.push(score); reqVals.push(rq); }
                    const gap = rq == null || score == null ? null : score - rq;
                    const cls = rq == null ? "hm-na" : gapClass(gap);
                    return (
                      <td
                        key={am.id}
                        className={`cell ${cls}`}
                        title={rq == null ? "Not applicable to this AM's track" : score == null ? "No submitted panel score" : `score L${fmt(score, 2)} · required L${rq}`}
                      >
                        {/* the weighted score is a float: always format it, never interpolate
                            it raw, or a 2.3 renders as L2.3000000000000003. The required level
                            rides underneath so a number can be read as good or bad on sight. */}
                        {rq == null || score == null ? (
                          "n/a"
                        ) : (
                          <>
                            {fmt(score, 2)}
                            <small>
                              req {rq.toFixed(1)} · {score - rq > 0 ? "+" : ""}
                              {fmt(score - rq, 2)}
                            </small>
                          </>
                        )}
                      </td>
                    );
                  });
                  return (
                    <tr key={cap.id}>
                      <th className="hm-rowhead">{cap.name}</th>
                      {cells}
                      {/* the zone average needs its benchmark too, or it is just a number.
                          Required is averaged over the SAME AMs, so mixed-track zones compare
                          like for like. */}
                      <td className="cell hm-na zone-avg-cell">
                        {vals.length === 0 ? (
                          "n/a"
                        ) : (
                          <>
                            {fmt(vals.reduce((a, b) => a + b, 0) / vals.length, 2)}
                            <small>req {fmt(reqVals.reduce((a, b) => a + b, 0) / reqVals.length, 1)}</small>
                          </>
                        )}
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

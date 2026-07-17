"use client";

// Geographic zone map — world SVG with the four APEX zones coloured by their
// average gap to required level (same thresholds as the heat map). Hover a zone
// for its stats, click to open the zone analysis.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORLD_COUNTRIES, ZONE_LABEL_XY, type MapZone } from "./world-geo";

export type ZoneMapStat = {
  zone: MapZone;
  ams: number;
  avgScore: number | null;
  avgReq: number | null;
  gap: number | null;
  worst: { cap: string; gap: number } | null;
};

const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));

function fillClass(gap: number | null): string {
  if (gap == null) return "zm-na";
  if (gap >= 0) return "zm-good";
  if (gap >= -0.5) return "zm-mild";
  if (gap >= -1) return "zm-warn";
  return "zm-crit";
}

export default function ZoneMap({ zones }: { zones: ZoneMapStat[] }) {
  const router = useRouter();
  const [tip, setTip] = useState<{ zone: MapZone; x: number; y: number } | null>(null);

  const statByZone = useMemo(() => new Map(zones.map((z) => [z.zone, z])), [zones]);
  const byZone = useMemo(() => {
    const groups = new Map<MapZone, typeof WORLD_COUNTRIES>();
    const neutral: typeof WORLD_COUNTRIES = [];
    for (const c of WORLD_COUNTRIES) {
      if (!c.zone) neutral.push(c);
      else {
        if (!groups.has(c.zone)) groups.set(c.zone, []);
        groups.get(c.zone)!.push(c);
      }
    }
    return { groups, neutral };
  }, []);

  const onMove = (zone: MapZone) => (e: React.MouseEvent<SVGGElement>) => {
    const wrap = (e.currentTarget.ownerSVGElement?.parentElement ?? null) as HTMLElement | null;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setTip({ zone, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const open = (zone: MapZone) => router.push(`/analysis/zone/${zone}`);
  const tipStat = tip ? statByZone.get(tip.zone) : null;

  return (
    <div className="zmap-wrap">
      <svg className="zmap" viewBox="0 0 980 480" role="img" aria-label="World map of APEX zones coloured by capability gap">
        <g>
          {byZone.neutral.map((c) => (
            <path key={c.name} d={c.d} className="zm-neutral" />
          ))}
        </g>
        {(Object.keys(ZONE_LABEL_XY) as MapZone[]).map((zone) => {
          const stat = statByZone.get(zone);
          const cls = fillClass(stat?.gap ?? null);
          return (
            <g
              key={zone}
              className={`zmap-zone ${cls}${tip?.zone === zone ? " hot" : ""}`}
              onMouseMove={onMove(zone)}
              onMouseLeave={() => setTip(null)}
              onClick={() => open(zone)}
            >
              {(byZone.groups.get(zone) ?? []).map((c) => (
                <path key={c.name} d={c.d}>
                  <title>{`${c.name} · ${zone}`}</title>
                </path>
              ))}
            </g>
          );
        })}
      </svg>

      {(Object.entries(ZONE_LABEL_XY) as [MapZone, [number, number]][]).map(([zone, [x, y]]) => {
        const stat = statByZone.get(zone);
        return (
          <button
            key={zone}
            type="button"
            className={`zmap-label ${fillClass(stat?.gap ?? null)}`}
            style={{ left: `${(x / 980) * 100}%`, top: `${(y / 480) * 100}%` }}
            onClick={() => open(zone)}
            onMouseMove={(e) => {
              const r = e.currentTarget.parentElement!.getBoundingClientRect();
              setTip({ zone, x: e.clientX - r.left, y: e.clientY - r.top });
            }}
            onMouseLeave={() => setTip(null)}
          >
            {zone}
            <span className="zmap-label-val">{fmt(stat?.avgScore ?? null)}</span>
          </button>
        );
      })}

      {tip && tipStat && (
        <div className="zmap-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="zmap-tip-zone">{tip.zone}</div>
          <div className="zmap-tip-row">
            {tipStat.ams} Account Manager{tipStat.ams === 1 ? "" : "s"}
          </div>
          <div className="zmap-tip-row">
            Avg panel score <strong>{fmt(tipStat.avgScore)}</strong> vs required{" "}
            <strong>{fmt(tipStat.avgReq)}</strong>
          </div>
          <div className="zmap-tip-row">
            Gap{" "}
            <strong className={fillClass(tipStat.gap)}>
              {tipStat.gap != null && tipStat.gap > 0 ? "+" : ""}
              {fmt(tipStat.gap)}
            </strong>
          </div>
          {tipStat.worst && (
            <div className="zmap-tip-row zmap-tip-worst">
              Biggest deficit: {tipStat.worst.cap} ({tipStat.worst.gap.toFixed(2)})
            </div>
          )}
          <div className="zmap-tip-cta">Click to open zone analysis →</div>
        </div>
      )}
    </div>
  );
}

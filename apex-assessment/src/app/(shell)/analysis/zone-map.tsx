"use client";

// Thermographic zone map.
// A canvas renders a smooth thermal field (blue = at/above target … red = critical
// gap) over the four APEX zones, driven by real per-AM panel scores anchored at
// Schneider hub cities. A capability filter re-renders the field live. SVG on top
// handles country borders, hub markers and interaction: hover tooltips (hub or
// country), click-to-focus a zone with a stats panel, drag pan + wheel/button zoom.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WORLD_COUNTRIES, ZONE_LABEL_XY, type MapZone } from "./world-geo";
import { HUBS, type Hub } from "./locations";

export type MapCap = {
  id: number;
  name: string;
  cluster: string;
  reqAcq: number | null;
  reqSat: number | null;
};

export type MapAM = {
  id: number;
  code: string;
  name: string;
  zone: MapZone;
  track: "Acquisition" | "Saturation";
  /** capability id -> submitted APEX Panel level */
  scores: Record<number, number>;
};

const W = 980;
const H = 480;
const MIN_K = 1;
const MAX_K = 6;
const ZONES: MapZone[] = ["MEA", "SAM", "India", "Pacific"];

const fmt = (n: number | null, d = 2) => (n == null ? "—" : n.toFixed(d));

/** gap → severity 0 (comfortably above target) … 1 (critical deficit) */
const severity = (gap: number) => Math.min(1, Math.max(0, (0.5 - gap) / 2));

function chipClass(gap: number | null): string {
  if (gap == null) return "zm-na";
  if (gap >= 0) return "zm-good";
  if (gap >= -0.5) return "zm-mild";
  if (gap >= -1) return "zm-warn";
  return "zm-crit";
}

// thermal palette LUT (blue → cyan → green → yellow → orange → red)
const STOPS: [number, number, number, number][] = [
  [0.0, 30, 64, 175],
  [0.18, 14, 165, 233],
  [0.38, 34, 197, 94],
  [0.58, 250, 204, 21],
  [0.78, 251, 146, 60],
  [1.0, 239, 68, 68],
];
const LUT: [number, number, number][] = Array.from({ length: 256 }, (_, i) => {
  const t = i / 255;
  let a = STOPS[0];
  let b = STOPS[STOPS.length - 1];
  for (let s = 0; s < STOPS.length - 1; s++) {
    if (t >= STOPS[s][0] && t <= STOPS[s + 1][0]) {
      a = STOPS[s];
      b = STOPS[s + 1];
      break;
    }
  }
  const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  return [
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(a[3] + (b[3] - a[3]) * f),
  ];
});

// cheap deterministic 2-octave value noise for the organic thermographic mottle
function makeNoise() {
  const hash = (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return (((h ^ (h >> 16)) >>> 0) % 1000) / 1000;
  };
  const smooth = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number) => 0.65 * smooth(x, y) + 0.35 * smooth(x * 2.3, y * 2.3);
}

type View = { k: number; x: number; y: number };
const clampView = (v: View): View => {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  return { k, x: Math.min(0, Math.max(W * (1 - k), v.x)), y: Math.min(0, Math.max(H * (1 - k), v.y)) };
};

type Filter = "all" | number;

export default function ZoneMap({ ams, caps, canDrill }: { ams: MapAM[]; caps: MapCap[]; canDrill: boolean }) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoneRefs = useRef<Partial<Record<MapZone, SVGGElement | null>>>({});
  const drag = useRef<{ id: number; cx: number; cy: number; moved: number } | null>(null);
  const suppressClick = useRef(false);

  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState(true);
  const [selected, setSelected] = useState<MapZone | null>(null);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    zone: MapZone;
    country?: string;
    hub?: Hub;
  } | null>(null);

  const capById = useMemo(() => new Map(caps.map((c) => [c.id, c])), [caps]);
  const filterCap = filter === "all" ? null : (capById.get(filter) ?? null);

  const req = (cap: MapCap, track: MapAM["track"]) => (track === "Acquisition" ? cap.reqAcq : cap.reqSat);

  /** avg {score, req, gap} for one AM under the active filter (null = no data) */
  const amStat = useMemo(() => {
    return (am: MapAM): { score: number; req: number; gap: number } | null => {
      const use = filterCap ? [filterCap] : caps;
      let s = 0,
        r = 0,
        n = 0;
      for (const cap of use) {
        const rq = req(cap, am.track);
        const sc = am.scores[cap.id];
        if (rq == null || sc == null) continue;
        s += sc;
        r += rq;
        n++;
      }
      return n === 0 ? null : { score: s / n, req: r / n, gap: (s - r) / n };
    };
  }, [caps, filterCap]);

  /** per-zone roll-up under the active filter */
  const zoneStats = useMemo(() => {
    const out = new Map<
      MapZone,
      { ams: number; n: number; avgScore: number | null; avgReq: number | null; gap: number | null; worst: { cap: string; gap: number } | null }
    >();
    for (const zone of ZONES) {
      const zoneAMs = ams.filter((a) => a.zone === zone);
      const stats = zoneAMs.map(amStat).filter(Boolean) as { score: number; req: number; gap: number }[];
      const mean = (f: (s: { score: number; req: number; gap: number }) => number) =>
        stats.length ? stats.reduce((acc, s) => acc + f(s), 0) / stats.length : null;
      let worst: { cap: string; gap: number } | null = null;
      if (!filterCap) {
        for (const cap of caps) {
          let s = 0,
            n = 0;
          for (const am of zoneAMs) {
            const rq = req(cap, am.track);
            const sc = am.scores[cap.id];
            if (rq == null || sc == null) continue;
            s += sc - rq;
            n++;
          }
          if (n > 0) {
            const g = s / n;
            if (g < 0 && (!worst || g < worst.gap)) worst = { cap: cap.name, gap: g };
          }
        }
      }
      out.set(zone, {
        ams: zoneAMs.length,
        n: stats.length,
        avgScore: mean((s) => s.score),
        avgReq: mean((s) => s.req),
        gap: mean((s) => s.gap),
        worst,
      });
    }
    return out;
  }, [ams, caps, amStat, filterCap]);

  /** AMs distributed over their zone's hubs, round-robin by code */
  const hubAMs = useMemo(() => {
    const map = new Map<Hub, MapAM[]>();
    for (const hub of HUBS) map.set(hub, []);
    for (const zone of ZONES) {
      const zoneHubs = HUBS.filter((h) => h.zone === zone);
      const zoneAMs = [...ams.filter((a) => a.zone === zone)].sort((a, b) => a.code.localeCompare(b.code));
      zoneAMs.forEach((am, i) => map.get(zoneHubs[i % zoneHubs.length])!.push(am));
    }
    return map;
  }, [ams]);

  const countriesByZone = useMemo(() => {
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

  // ---- thermal field ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const hubs: { x: number; y: number; v: number; w: number }[] = [];
    for (const hub of HUBS) {
      const list = hubAMs.get(hub) ?? [];
      const stats = list.map(amStat).filter(Boolean) as { gap: number }[];
      const zoneGap = zoneStats.get(hub.zone)?.gap ?? null;
      if (stats.length > 0) {
        const g = stats.reduce((a, s) => a + s.gap, 0) / stats.length;
        hubs.push({ x: hub.x, y: hub.y, v: severity(g), w: 1 + 0.5 * (stats.length - 1) });
      } else if (zoneGap != null) {
        hubs.push({ x: hub.x, y: hub.y, v: severity(zoneGap), w: 0.45 });
      }
    }

    const FW = 490;
    const FH = 240;
    const off = document.createElement("canvas");
    off.width = FW;
    off.height = FH;
    const octx = off.getContext("2d")!;
    const img = octx.createImageData(FW, FH);
    const noise = makeNoise();
    const SIG2 = 2 * 48 * 48;

    for (let j = 0; j < FH; j++) {
      const y = (j + 0.5) * (H / FH);
      for (let i = 0; i < FW; i++) {
        const x = (i + 0.5) * (W / FW);
        let num = 1e-7 * 0.32;
        let den = 1e-7;
        for (const h of hubs) {
          const dx = x - h.x;
          const dy = y - h.y;
          const w = h.w * Math.exp(-(dx * dx + dy * dy) / SIG2);
          num += w * h.v;
          den += w;
        }
        let v = num / den;
        v += (noise(x * 0.045, y * 0.045) - 0.5) * 0.22;
        v = Math.min(1, Math.max(0, v));
        const [r, g, b] = LUT[Math.round(v * 255)];
        const p = (j * FW + i) * 4;
        img.data[p] = r;
        img.data[p + 1] = g;
        img.data[p + 2] = b;
        img.data[p + 3] = 235;
      }
    }
    octx.putImageData(img, 0, 0);

    canvas.width = W * 2;
    canvas.height = H * 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    // keep the thermal field only on zone land — one combined mask, single fill
    // (per-country destination-in fills would intersect away everything)
    const mask = new Path2D();
    for (const zone of ZONES) {
      for (const c of countriesByZone.groups.get(zone) ?? []) mask.addPath(new Path2D(c.d));
    }
    ctx.globalCompositeOperation = "destination-in";
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fill(mask);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 500, easing: "ease-out" });
    }
  }, [hubAMs, amStat, zoneStats, countriesByZone]);

  // ---- camera ----
  const toSvg = (clientX: number, clientY: number): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((clientX - r.left) * W) / r.width, ((clientY - r.top) * H) / r.height];
  };

  const zoomAt = (factor: number, cx: number, cy: number, animate = false) => {
    setAnim(animate);
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      return clampView({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [cx, cy] = toSvg(e.clientX, e.clientY);
      zoomAt(Math.exp(-e.deltaY * 0.002), cx, cy);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const focusZone = (zone: MapZone) => {
    const g = zoneRefs.current[zone];
    if (!g) return;
    const b = g.getBBox();
    const pad = 40;
    const k = Math.min(4.5, Math.max(1.15, Math.min(W / (b.width + pad * 2), H / (b.height + pad * 2))));
    setAnim(true);
    setView(clampView({ k, x: W / 2 - k * (b.x + b.width / 2), y: H / 2 - k * (b.y + b.height / 2) }));
    setSelected(zone);
  };

  const reset = () => {
    setAnim(true);
    setView({ k: 1, x: 0, y: 0 });
    setSelected(null);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, cx: e.clientX, cy: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const r = svgRef.current!.getBoundingClientRect();
    const dx = ((e.clientX - d.cx) * W) / r.width;
    const dy = ((e.clientY - d.cy) * H) / r.height;
    d.moved += Math.abs(e.clientX - d.cx) + Math.abs(e.clientY - d.cy);
    d.cx = e.clientX;
    d.cy = e.clientY;
    if (d.moved > 4) {
      setAnim(false);
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id === e.pointerId) {
      const wasDrag = drag.current.moved > 6;
      drag.current = null;
      if (wasDrag) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
      }
    }
  };

  const zoneClick = (zone: MapZone) => {
    if (suppressClick.current) return;
    if (selected === zone) reset();
    else focusZone(zone);
  };

  const onZoneMove = (zone: MapZone) => (e: React.MouseEvent<SVGGElement>) => {
    if (drag.current && drag.current.moved > 4) return;
    const wrap = svgRef.current?.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const [sx, sy] = toSvg(e.clientX, e.clientY);
    const mx = (sx - view.x) / view.k;
    const my = (sy - view.y) / view.k;
    let hub: Hub | undefined;
    let best = 26 / view.k;
    for (const h of HUBS) {
      const d = Math.hypot(h.x - mx, h.y - my);
      if (d < best) {
        best = d;
        hub = h;
      }
    }
    const country = (e.target as SVGElement).getAttribute("data-name") ?? undefined;
    setTip({ zone, country, hub, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const tipZone = tip ? zoneStats.get(tip.zone) : null;
  const tipHubAMs = tip?.hub ? (hubAMs.get(tip.hub) ?? []) : [];
  const tipHubStats = tipHubAMs.map(amStat).filter(Boolean) as { score: number; req: number; gap: number }[];
  const tipHubGap = tipHubStats.length
    ? tipHubStats.reduce((a, s) => a + s.gap, 0) / tipHubStats.length
    : null;
  const selStat = selected ? zoneStats.get(selected) : null;

  const clusters = useMemo(() => {
    const out: { name: string; caps: MapCap[] }[] = [];
    for (const cap of caps) {
      const last = out[out.length - 1];
      if (!last || last.name !== cap.cluster) out.push({ name: cap.cluster, caps: [cap] });
      else last.caps.push(cap);
    }
    return out;
  }, [caps]);

  return (
    <div>
      <div className="zmap-toolbar">
        <select
          className="zmap-select"
          value={filter === "all" ? "all" : String(filter)}
          onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
          aria-label="Filter the thermal map by capability"
        >
          <option value="all">All 22 capabilities</option>
          {clusters.map((cl) => (
            <optgroup key={cl.name} label={cl.name}>
              {cl.caps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="zmap-scale">
          <span>On target</span>
          <span className="zmap-scale-bar" />
          <span>Critical gap</span>
        </div>
      </div>

      <div className="zmap-wrap">
        <canvas
          ref={canvasRef}
          className={`zmap-thermal${anim ? " anim" : ""}`}
          style={{ transform: `translate(${(view.x / W) * 100}%, ${(view.y / H) * 100}%) scale(${view.k})` }}
        />
        <svg
          ref={svgRef}
          className="zmap"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Thermographic map of APEX zones"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g className={`zmap-canvas${anim ? " anim" : ""}`} transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <g>
              {countriesByZone.neutral.map((c) => (
                <path key={c.name} d={c.d} className="zm-neutral" data-name={c.name} />
              ))}
            </g>
            {ZONES.map((zone) => {
              const dim = selected != null && selected !== zone;
              return (
                <g
                  key={zone}
                  ref={(el) => {
                    zoneRefs.current[zone] = el;
                  }}
                  className={`zmap-zone${dim ? " dim" : ""}`}
                  onMouseMove={onZoneMove(zone)}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => zoneClick(zone)}
                >
                  {(countriesByZone.groups.get(zone) ?? []).map((c) => (
                    <path key={c.name} d={c.d} data-name={c.name} />
                  ))}
                </g>
              );
            })}
            <g className="zmap-hubs">
              {HUBS.map((h) => {
                const n = (hubAMs.get(h) ?? []).length;
                if (n === 0) return null;
                return (
                  <g key={h.name} className={selected != null && selected !== h.zone ? "dim" : undefined}>
                    <circle className="zmap-hub-glow" cx={h.x} cy={h.y} r={6} />
                    <circle className="zmap-hub" cx={h.x} cy={h.y} r={2.4} />
                    {view.k > 2 && (
                      <text className="zmap-hub-name" x={h.x + 4.5} y={h.y + 1.5}>
                        {h.name} · {n}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {(Object.entries(ZONE_LABEL_XY) as [MapZone, [number, number]][]).map(([zone, [lx, ly]]) => {
          const stat = zoneStats.get(zone);
          const x = (view.k * lx + view.x) / W;
          const y = (view.k * ly + view.y) / H;
          if (x < 0.02 || x > 0.98 || y < 0.03 || y > 0.97) return null;
          return (
            <button
              key={zone}
              type="button"
              className={`zmap-label ${chipClass(stat?.gap ?? null)}${anim ? " anim" : ""}${
                selected != null && selected !== zone ? " dim" : ""
              }`}
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              onClick={() => zoneClick(zone)}
            >
              {zone}
              <span className="zmap-label-val">{fmt(stat?.avgScore ?? null)}</span>
            </button>
          );
        })}

        <div className="zmap-controls">
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.5, W / 2, H / 2, true)}>+</button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5, W / 2, H / 2, true)}>−</button>
          <button type="button" aria-label="Reset view" onClick={reset}>⌂</button>
        </div>

        {tip && tipZone && !selected && (
          <div className="zmap-tip" style={{ left: tip.x, top: tip.y }}>
            {tip.hub ? (
              <>
                <div className="zmap-tip-zone">
                  {tip.hub.name} <span className="zmap-tip-sub">· {tip.zone} hub</span>
                </div>
                <div className="zmap-tip-row">
                  {tipHubAMs.length} Account Manager{tipHubAMs.length === 1 ? "" : "s"}:{" "}
                  {tipHubAMs.slice(0, 3).map((a) => a.name.split(" ")[0]).join(", ")}
                  {tipHubAMs.length > 3 ? "…" : ""}
                </div>
                {tipHubStats.length > 0 && (
                  <div className="zmap-tip-row">
                    Avg score{" "}
                    <strong>{fmt(tipHubStats.reduce((a, s) => a + s.score, 0) / tipHubStats.length)}</strong> vs
                    required{" "}
                    <strong>{fmt(tipHubStats.reduce((a, s) => a + s.req, 0) / tipHubStats.length)}</strong>
                    {"  "}
                    <strong className={chipClass(tipHubGap)}>
                      {tipHubGap != null && tipHubGap > 0 ? "+" : ""}
                      {fmt(tipHubGap)}
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="zmap-tip-zone">{tip.zone}</div>
                {tip.country && <div className="zmap-tip-row zmap-tip-country">{tip.country}</div>}
                <div className="zmap-tip-row">
                  {tipZone.ams} Account Manager{tipZone.ams === 1 ? "" : "s"} · avg{" "}
                  <strong>{fmt(tipZone.avgScore)}</strong> vs required <strong>{fmt(tipZone.avgReq)}</strong>
                </div>
              </>
            )}
            {filterCap && <div className="zmap-tip-row zmap-tip-cap">{filterCap.name}</div>}
            <div className="zmap-tip-cta">Click to focus this zone</div>
          </div>
        )}

        {selected && selStat && (
          <div className="zmap-panel">
            <div className="zmap-panel-head">
              <span className={`zmap-panel-dot ${chipClass(selStat.gap)}`} />
              <span className="zmap-panel-zone">{selected}</span>
              <button type="button" className="zmap-panel-close" aria-label="Close" onClick={reset}>✕</button>
            </div>
            {filterCap && <div className="zmap-panel-cap">{filterCap.name}</div>}
            <dl className="zmap-panel-stats">
              <div><dt>Account Managers</dt><dd>{selStat.ams}</dd></div>
              <div><dt>With panel data</dt><dd>{selStat.n}</dd></div>
              <div><dt>Avg panel score</dt><dd>{fmt(selStat.avgScore)}</dd></div>
              <div><dt>Avg required</dt><dd>{fmt(selStat.avgReq)}</dd></div>
              <div>
                <dt>Gap</dt>
                <dd className={chipClass(selStat.gap)}>
                  {selStat.gap != null && selStat.gap > 0 ? "+" : ""}
                  {fmt(selStat.gap)}
                </dd>
              </div>
            </dl>
            {selStat.worst && (
              <div className="zmap-panel-worst">
                Biggest deficit: <strong>{selStat.worst.cap}</strong> ({selStat.worst.gap.toFixed(2)})
              </div>
            )}
            {canDrill && (
              <button
                type="button"
                className="btn btn-primary btn-sm zmap-panel-open"
                onClick={() => router.push(`/analysis/zone/${selected}`)}
              >
                Open zone analysis →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

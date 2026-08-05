"use client";

import Icon, { Caret } from "../nav-icon";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SEGMENTS } from "@/lib/seed-data";

type Cap = { id: number; name: string; cluster: string };

/**
 * One togglable window holding every dashboard filter: Track and Segment (region
 * filters) plus the map's Capability filter. All drive URL params, so the server
 * re-scopes the map, heat map, training focus and roster together.
 */
export default function FilterBar({
  current,
  caps,
  showCapability,
}: {
  current: { track: string; segment: string; cap: string };
  caps: Cap[];
  showCapability: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const setParam = (key: string, value: string, isDefault: boolean) => {
    const p = new URLSearchParams(params.toString());
    if (isDefault) p.delete(key);
    else p.set(key, value);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeCount = [
    current.track !== "all",
    current.segment !== "all",
    showCapability && current.cap !== "all",
  ].filter(Boolean).length;

  const clusters: { name: string; caps: Cap[] }[] = [];
  for (const c of caps) {
    const last = clusters[clusters.length - 1];
    if (!last || last.name !== c.cluster) clusters.push({ name: c.cluster, caps: [c] });
    else last.caps.push(c);
  }

  return (
    <div className="filter-bar">
      <button
        type="button"
        className={`filter-toggle${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon name="filter" size={15} />
        Filters
        {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
        <Caret open={open} />
      </button>

      {open && (
        <div className="filter-panel">
          <div className="filter-group">
            <span className="filter-label">Track</span>
            <div className="seg" role="group" aria-label="Filter by track">
              {[
                ["all", "All"],
                ["Acquisition", "Acquisition"],
                ["Saturation", "Saturation"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={`seg-btn${current.track === v ? " active" : ""}`}
                  onClick={() => setParam("track", v, v === "all")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Segment</span>
            <select
              className="zmap-select"
              value={current.segment}
              onChange={(e) => setParam("segment", e.target.value, e.target.value === "all")}
              aria-label="Filter by segment"
            >
              <option value="all">All segments</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {showCapability && (
            <div className="filter-group">
              <span className="filter-label">Capability (map)</span>
              <select
                className="zmap-select"
                value={current.cap}
                onChange={(e) => setParam("cap", e.target.value, e.target.value === "all")}
                aria-label="Filter the map by capability"
              >
                <option value="all">All capabilities</option>
                {clusters.map((cl) => (
                  <optgroup key={cl.name} label={cl.name}>
                    {cl.caps.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {activeCount > 0 && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => router.push(pathname, { scroll: false })}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

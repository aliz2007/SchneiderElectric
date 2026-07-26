"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SEGMENTS, ZONES } from "@/lib/seed-data";

/**
 * Inline search + filters for the Individual Results list: a name/account search box
 * and Zone / Track / Segment selects. Everything drives URL search params, so the
 * server re-filters the table and the state survives refresh / sharing the link.
 */
export default function IndividualsFilters({
  current,
}: {
  current: { q: string; zone: string; track: string; segment: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(current.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (updates: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === "" || value === "all") p.delete(key);
      else p.set(key, value);
    }
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // debounce the search box so the table re-filters as you type, without a request per key
  const onSearch = (value: string) => {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value.trim() }), 350);
  };
  useEffect(() => () => { if (debounce.current) clearTimeout(debounce.current); }, []);

  const active = current.q !== "" || current.zone !== "all" || current.track !== "all" || current.segment !== "all";

  return (
    <div className="analytics-filter-row" style={{ marginBottom: 14 }}>
      <input
        className="input ifilter-search"
        type="search"
        placeholder="Search by name or account…"
        value={q}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search Account Managers"
      />
      <select
        className="zmap-select"
        value={current.zone}
        onChange={(e) => apply({ zone: e.target.value })}
        aria-label="Filter by zone"
      >
        <option value="all">All zones</option>
        {ZONES.map((z) => (
          <option key={z} value={z}>{z}</option>
        ))}
      </select>
      <select
        className="zmap-select"
        value={current.track}
        onChange={(e) => apply({ track: e.target.value })}
        aria-label="Filter by track"
      >
        <option value="all">All tracks</option>
        <option value="Acquisition">Acquisition</option>
        <option value="Saturation">Saturation</option>
      </select>
      <select
        className="zmap-select"
        value={current.segment}
        onChange={(e) => apply({ segment: e.target.value })}
        aria-label="Filter by segment"
      >
        <option value="all">All segments</option>
        {SEGMENTS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={() => { setQ(""); apply({ q: "", zone: "all", track: "all", segment: "all" }); }}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

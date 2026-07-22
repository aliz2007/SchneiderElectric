"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { v: "all", label: "All tracks" },
  { v: "Acquisition", label: "Acquisition" },
  { v: "Saturation", label: "Saturation" },
];

/**
 * Segmented All / Acquisition / Saturation control. It drives the `track` URL
 * param, so the server re-filters every analytics view (map, heat map, training
 * focus, roster) at once — and non-admins still never receive per-AM data.
 */
export default function TrackFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v === "all") p.delete("track");
    else p.set("track", v);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="seg" role="group" aria-label="Filter by track">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`seg-btn${current === o.v ? " active" : ""}`}
          aria-pressed={current === o.v}
          onClick={() => set(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

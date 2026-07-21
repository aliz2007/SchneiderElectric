"use client";

import { useState } from "react";

type Result = { source: string | null; reason: string } | null;

/**
 * Downloads the individual PDF via fetch so we can (a) show a live loading state while the
 * server renders it (and, when AI feedback is on, calls Kimi), and (b) read the
 * X-AI-Source / X-AI-Reason response headers and show, right here, whether Kimi actually
 * wrote the narrative or exactly why it fell back. Falls back to a plain navigation on error.
 */
export default function ExportPdfButton({
  amId,
  amName,
  aiActive,
}: {
  amId: number;
  amName: string;
  aiActive: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const download = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/analysis/am/${amId}/pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const source = res.headers.get("X-AI-Source");
      let reason = res.headers.get("X-AI-Reason") ?? "";
      try {
        reason = decodeURIComponent(reason);
      } catch {
        /* keep raw */
      }
      setResult({ source, reason });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const slug = amName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `APEX-Assessment-${slug || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.location.href = `/analysis/am/${amId}/pdf`;
    } finally {
      setLoading(false);
    }
  };

  const usedKimi = result?.source === "kimi";
  const reasonText = (result?.reason ?? "").split(" — ").slice(1).join(" — ") || result?.reason || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0, marginTop: 4 }}>
      <button type="button" className="btn btn-sm btn-outline" onClick={download} disabled={loading}>
        {loading ? (aiActive ? "Kimi is writing…" : "Generating…") : "Export PDF"}
      </button>
      {result && (
        <span
          style={{
            fontSize: 11.5,
            maxWidth: 340,
            textAlign: "right",
            lineHeight: 1.35,
            color: usedKimi ? "#5fe57d" : "var(--amber)",
          }}
        >
          {usedKimi ? "✓ Narrative written by Kimi" : `⚠ Kimi did not run — ${reasonText}`}
        </span>
      )}
    </div>
  );
}

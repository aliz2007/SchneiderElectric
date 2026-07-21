"use client";

import { useState } from "react";

/**
 * Downloads the individual PDF via fetch so we can show a live loading state while the
 * server renders it (and, when AI feedback is on, calls Kimi). Falls back to a plain
 * navigation if anything about the fetch/blob path fails.
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

  const download = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/analysis/am/${amId}/pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline"
      onClick={download}
      disabled={loading}
      style={{ flexShrink: 0, marginTop: 4 }}
    >
      {loading ? (aiActive ? "Kimi is writing…" : "Generating…") : "Export PDF"}
    </button>
  );
}

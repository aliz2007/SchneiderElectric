"use client";

import { useState } from "react";

/**
 * Downloads the assessed person's own PDF report via fetch, with a loading state
 * (the server may call Kimi to write the narrative, which takes a few seconds).
 */
export default function FeedbackDownload({ amId, amName }: { amId: number; amName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const download = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/analysis/am/${amId}/pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const slug = amName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `APEX-Feedback-${slug || "report"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
      <button type="button" className="btn btn-primary" onClick={download} disabled={loading}>
        {loading ? "Preparing your report…" : "Download your report (PDF)"}
      </button>
      {error && (
        <span style={{ fontSize: 11.5, color: "var(--amber)" }}>
          Could not generate the PDF just now. Please try again.
        </span>
      )}
    </div>
  );
}

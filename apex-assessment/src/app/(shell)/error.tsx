"use client";

import { useEffect, useState } from "react";

/**
 * Shell-wide error boundary. Its main job is turning a ChunkLoadError into a
 * non-event: that error only means the open browser tab predates the server's
 * current build (code was pulled / the server restarted), so the tab asked for
 * a JS file that no longer exists. One reload re-syncs the tab — do it
 * automatically (at most once every 30s, so a genuinely broken build can't
 * cause a reload loop). Anything else gets a calm retry card instead of a
 * stack trace.
 */
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleChunk = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|CSS chunk/i.test(
    `${error?.name ?? ""} ${error?.message ?? ""}`
  );
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (!isStaleChunk) return;
    const last = Number(sessionStorage.getItem("apex-chunk-reload") ?? 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem("apex-chunk-reload", String(Date.now()));
      setAutoReloading(true);
      window.location.reload();
    }
  }, [isStaleChunk]);

  if (autoReloading) {
    return (
      <div className="card card-pad" style={{ maxWidth: 460, margin: "60px auto", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Updating to the latest version…</p>
      </div>
    );
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 520, margin: "60px auto" }}>
      <h2 className="card-title">Something went wrong</h2>
      <p className="card-sub" style={{ marginBottom: 14 }}>
        {isStaleChunk
          ? "This tab was open on an older version of the app. Reload to pick up the latest one."
          : "An unexpected error occurred. Your data is safe — try again, or reload the page."}
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
          Reload page
        </button>
        {!isStaleChunk && (
          <button className="btn btn-outline" type="button" onClick={() => reset()}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

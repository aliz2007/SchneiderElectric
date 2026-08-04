"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  SIZE_LABEL,
  accentVars,
  blockDef,
  normalizeAccent,
  type DashboardLayout,
} from "@/lib/dashboard-layout";
import { resetAccent, resetAll, resetLayout, saveAccent, updateBlock } from "./actions";

/**
 * The Dashboard Manager.
 *
 * One button opens it, and behind that button are the three things a superadmin can do to
 * THEIR OWN dashboard: put it back the way it shipped, repaint the app, or go and rearrange
 * the cards. Nothing here touches anybody else's view.
 *
 * The colour picker previews by writing the accent variables straight onto <html>, so the
 * whole app — sidebar, buttons, the aurora behind the page — repaints as you drag the
 * swatch, before anything is saved. Leaving the panel without saving puts the live values
 * back, so a preview can never survive as a colour nobody chose.
 */
export default function DashboardManager({
  accent,
  layout,
  layoutIsDefault,
}: {
  accent: string;
  layout: DashboardLayout;
  layoutIsDefault: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"arrange" | "colour" | "reset">("arrange");
  const [preview, setPreview] = useState(accent);

  // Paint the previewed accent straight onto <html> while the picker is open, so the whole
  // app repaints as the swatch changes. The cleanup restores the SAVED accent rather than
  // clearing the properties: the server already rendered them inline on <html>, so removing
  // them would strip the real colour and drop the app back to the stylesheet default.
  useEffect(() => {
    const root = document.documentElement;
    const vars = accentVars(open ? preview : accent);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const [k, v] of Object.entries(accentVars(accent))) root.style.setProperty(k, v);
    };
  }, [open, preview, accent]);

  useEffect(() => {
    if (!open) setPreview(accent);
  }, [open, accent]);

  const hidden = layout.filter((b) => b.hidden);
  const custom = !ACCENT_PRESETS.some((p) => p.hex === accent);

  if (!open) {
    return (
      <div className="dm-launch">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          ✥ Open Dashboard Manager
        </button>
        <div className="dm-launch-state">
          <span className="dm-chip">
            <span className="dm-swatch" style={{ background: accent }} />
            {ACCENT_PRESETS.find((p) => p.hex === accent)?.name ?? accent}
          </span>
          <span className="dm-chip">
            {layoutIsDefault
              ? "Dashboard layout: default"
              : `Dashboard layout: customised${hidden.length ? ` · ${hidden.length} card${hidden.length === 1 ? "" : "s"} removed` : ""}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-panel">
      <div className="dm-head">
        <div className="seg" role="tablist" aria-label="Dashboard Manager sections">
          {(
            [
              ["arrange", "Arrange the cards"],
              ["colour", "App colour"],
              ["reset", "Reset"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={`seg-btn${tab === k ? " active" : ""}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {tab === "arrange" && (
        <div className="dm-body">
          <p className="dm-lede">
            The cards are arranged on the dashboard itself, where you can see what you are
            moving. Dragging, widths and removals all happen there; nothing is saved until you
            press Done.
          </p>
          <Link className="btn btn-primary" href="/analysis?edit=1">
            Arrange the dashboard →
          </Link>
          <table className="table dm-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Width</th>
                <th>On the dashboard</th>
              </tr>
            </thead>
            <tbody>
              {layout.map((b) => {
                const def = blockDef(b.id);
                return (
                  <tr key={b.id}>
                    <td>
                      <strong>{def.label}</strong>
                      <div className="dm-blurb">{def.blurb}</div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{SIZE_LABEL[b.size]}</span>
                    </td>
                    <td>
                      {def.pinned ? (
                        <span className="badge badge-gray">always shown</span>
                      ) : b.hidden ? (
                        // the escape hatch: a card removed from the dashboard can always be
                        // put back from here, without having to find it in edit mode
                        <form action={updateBlock}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="hidden" value="0" />
                          <button className="btn btn-sm btn-outline" type="submit">
                            Removed · put back
                          </button>
                        </form>
                      ) : (
                        <form action={updateBlock}>
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="hidden" value="1" />
                          <button className="btn btn-sm btn-outline" type="submit">
                            Shown · remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "colour" && (
        <div className="dm-body">
          <p className="dm-lede">
            The accent paints the app&apos;s chrome — the sidebar, the buttons, the focus ring
            and the glow behind the page — for you, wherever you are signed in. The result
            colours stay as they are: green still means at or above the required level, red
            still means a critical gap, and those have to keep meaning that whatever colour
            you pick.
          </p>
          <div className="dm-swatches">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.hex}
                type="button"
                className={`dm-swatch-btn${preview === p.hex ? " active" : ""}`}
                onClick={() => setPreview(p.hex)}
                aria-pressed={preview === p.hex}
              >
                <span className="dm-swatch dm-swatch-lg" style={{ background: p.hex }} />
                {p.name}
              </button>
            ))}
          </div>
          <div className="dm-custom">
            <label htmlFor="dm-hex">Custom</label>
            <input
              id="dm-hex"
              type="color"
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              aria-label="Pick a custom accent colour"
            />
            <input
              className="dm-hex-text"
              type="text"
              value={preview}
              spellCheck={false}
              onChange={(e) => setPreview(normalizeAccent(e.target.value) ?? e.target.value)}
              aria-label="Accent colour hex"
            />
            {custom && <span className="dm-blurb">Saved: {accent}</span>}
          </div>
          <div className="dm-actions">
            <form action={saveAccent}>
              <input type="hidden" name="accent" value={normalizeAccent(preview) ?? DEFAULT_ACCENT} />
              <button className="btn btn-primary" type="submit" disabled={!normalizeAccent(preview)}>
                Save colour
              </button>
            </form>
            <button type="button" className="btn btn-outline" onClick={() => setPreview(accent)}>
              Discard preview
            </button>
            <form action={resetAccent}>
              <button className="btn btn-outline" type="submit" disabled={accent === DEFAULT_ACCENT}>
                Back to Schneider green
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === "reset" && (
        <div className="dm-body">
          <p className="dm-lede">
            Reset puts your dashboard back the way the app ships. It only affects your own
            view, and it cannot be undone — but nothing is lost either, since a layout is only
            an arrangement of cards that are all still there.
          </p>
          <div className="dm-actions">
            <form action={resetLayout}>
              <button className="btn btn-outline" type="submit" disabled={layoutIsDefault}>
                Reset the dashboard layout
              </button>
            </form>
            <form action={resetAccent}>
              <button className="btn btn-outline" type="submit" disabled={accent === DEFAULT_ACCENT}>
                Reset the app colour
              </button>
            </form>
            <form action={resetAll}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={layoutIsDefault && accent === DEFAULT_ACCENT}
              >
                Reset everything
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

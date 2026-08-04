"use client";

import { useMemo, useRef, useState } from "react";
import {
  SIZES,
  SIZE_LABEL,
  SIZE_SPAN,
  allowedSizes,
  blockDef,
  defaultLayout,
  isDefaultLayout,
  serializeLayout,
  type BlockId,
  type BlockSize,
  type DashboardLayout,
} from "@/lib/dashboard-layout";
import { saveLayout } from "./actions";
import BlockGlyph from "./block-glyph";

/**
 * The arranging canvas — a small live model of the dashboard.
 *
 * The tiles sit on the SAME twelve-column grid as the real page and take the same relative
 * widths, so a half-width card is drawn half as wide here. Each one carries a wireframe of
 * what it contains, which is what lets you rearrange by recognition rather than by reading
 * labels. Drag a tile past another to reorder; the width control is three drawn bars, not
 * words; the switch takes a card off the dashboard without deleting anything.
 *
 * Drag-and-drop is not the only way to move a tile. Every reorder is also on the arrow
 * buttons, because a drag cannot be done from a keyboard and cannot be driven reliably by a
 * test harness — and an editor whose only affordance is a drag is an editor half the people
 * using it cannot operate.
 *
 * Nothing is written until Save.
 */

export default function DashboardCanvas({ layout }: { layout: DashboardLayout }) {
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  const dragging = useRef<BlockId | null>(null);
  const [dragId, setDragId] = useState<BlockId | null>(null);

  const dirty = useMemo(
    () => serializeLayout(draft) !== serializeLayout(layout),
    [draft, layout]
  );
  const pristine = isDefaultLayout(draft);
  const off = draft.filter((b) => b.hidden).length;

  const reorder = (from: BlockId, to: BlockId) =>
    setDraft((cur) => {
      const a = cur.findIndex((b) => b.id === from);
      const z = cur.findIndex((b) => b.id === to);
      if (a < 0 || z < 0 || a === z) return cur;
      const next = cur.slice();
      const [moved] = next.splice(a, 1);
      next.splice(z, 0, moved);
      return next;
    });

  const step = (id: BlockId, dir: -1 | 1) =>
    setDraft((cur) => {
      const at = cur.findIndex((b) => b.id === id);
      const to = at + dir;
      if (at < 0 || to < 0 || to >= cur.length) return cur;
      const next = cur.slice();
      const [moved] = next.splice(at, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const setSize = (id: BlockId, size: BlockSize) =>
    setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, size } : b)));

  const setHidden = (id: BlockId, hidden: boolean) =>
    setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, hidden } : b)));

  return (
    <form action={saveLayout} className="dc">
      <input type="hidden" name="layout" value={serializeLayout(draft)} />

      <div className="dc-bar">
        <span className="dc-hint">
          Drag a card to move it. Set how wide it should be. Switch one off to take it off
          your dashboard — it stays here, so you can bring it back.
        </span>
        <span className="dc-count">
          {draft.length - off} shown{off > 0 ? ` · ${off} off` : ""}
        </span>
      </div>

      <div className="dc-canvas" role="list">
        {draft.map((b, i) => {
          const def = blockDef(b.id);
          const sizes = allowedSizes(b.id);
          return (
            <div
              key={b.id}
              role="listitem"
              className={`dc-tile${b.hidden ? " is-off" : ""}${dragId === b.id ? " is-dragging" : ""}`}
              data-block={b.id}
              data-size={b.size}
              style={{ gridColumn: `span ${SIZE_SPAN[b.size]}` }}
              draggable
              onDragStart={() => {
                dragging.current = b.id;
                setDragId(b.id);
              }}
              onDragEnd={() => {
                dragging.current = null;
                setDragId(null);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging.current) reorder(dragging.current, b.id);
                dragging.current = null;
                setDragId(null);
              }}
            >
              <div className="dc-preview">
                <BlockGlyph id={b.id} />
              </div>

              <div className="dc-meta">
                <span className="dc-name">{def.label}</span>
                <span className="dc-blurb">{def.blurb}</span>
              </div>

              <div className="dc-controls">
                <span className="dc-move">
                  <button
                    type="button"
                    className="dc-btn"
                    onClick={() => step(b.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${def.label} earlier`}
                  >
                    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                      <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="dc-btn"
                    onClick={() => step(b.id, 1)}
                    disabled={i === draft.length - 1}
                    aria-label={`Move ${def.label} later`}
                  >
                    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>

                {/* Width, drawn rather than spelled: three bars in the proportions they
                    produce. Only the widths this card survives are offered — the zone map
                    is a fixed-aspect world canvas and the timeline places its markers as
                    percentages of the track, so a third-width version of either is not a
                    smaller chart, it is an unreadable one. */}
                <span className="dc-sizes" role="group" aria-label={`Width of ${def.label}`}>
                  {SIZES.map((sz) => {
                    const can = sizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        className={`dc-size${b.size === sz ? " active" : ""}`}
                        aria-pressed={b.size === sz}
                        disabled={!can}
                        title={can ? SIZE_LABEL[sz] : `${def.label} needs more room than ${SIZE_LABEL[sz].toLowerCase()}`}
                        onClick={() => setSize(b.id, sz)}
                      >
                        <svg viewBox="0 0 18 10" width="18" height="10" aria-hidden="true">
                          <rect x="0.5" y="0.5" width="17" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
                          <rect x="0.5" y="0.5" width={SIZE_SPAN[sz] * 1.5} height="9" rx="2" fill="currentColor" />
                        </svg>
                        <span className="dc-sr">{SIZE_LABEL[sz]}</span>
                      </button>
                    );
                  })}
                </span>

                {def.pinned ? (
                  <span className="dc-pinned" title="The filters scope every other card, so this one stays.">
                    always on
                  </span>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!b.hidden}
                    aria-label={`Show ${def.label} on the dashboard`}
                    className={`dc-switch${b.hidden ? "" : " on"}`}
                    onClick={() => setHidden(b.id, !b.hidden)}
                  >
                    <span className="dc-knob" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="dc-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty}>
          Save arrangement
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setDraft(layout)}
          disabled={!dirty}
        >
          Discard changes
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setDraft(defaultLayout())}
          disabled={pristine}
        >
          Back to the default
        </button>
      </div>
    </form>
  );
}

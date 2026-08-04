"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  SIZE_SPAN,
  allowedSizes,
  blockDef,
  defaultLayout,
  isDefaultLayout,
  serializeLayout,
  type BlockId,
  type BlockSize,
  type DashboardLayout,
  type ThemeColors,
} from "@/lib/dashboard-layout";
import { saveLayout } from "./dashboard-actions";
import ColourPanel from "./colour-panel";

/**
 * The dashboard, and the switch that makes it editable.
 *
 * There is no separate editor and no preview of the dashboard: the thing you arrange IS the
 * dashboard, with its real cards and its real numbers in them. Toggle the wrench and the
 * same page becomes movable; toggle it off and it freezes back into a page you read and
 * click. A miniature of the layout would be a second thing to keep in sync with the first,
 * and you would still have to look away from it to see what you had done.
 *
 * The cards are SERVER-rendered and arrive in `blocks` already finished. This component
 * never sees their data — it owns the order, the width and whether a card is on the page,
 * and nothing else. That is not tidiness: the zone map carries every Account Manager's
 * weighted score, and it must not cross into a client component just so a card can be
 * dragged.
 *
 * While editing, the card contents are inert (`pointer-events: none`), because a drag that
 * starts on a link is a navigation, not a drag.
 */

const COLS = 12;

type Props = {
  layout: DashboardLayout;
  blocks: Partial<Record<BlockId, ReactNode>>;
  canEdit: boolean;
  colors: ThemeColors;
};

export default function DashboardGrid({ layout, blocks, canEdit, colors }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  const [showColour, setShowColour] = useState(false);
  const [dragId, setDragId] = useState<BlockId | null>(null);
  // Pressing on the resize grip must not also start a native card drag. preventDefault on
  // the pointerdown is not enough — Chromium still begins the HTML5 drag of the draggable
  // ancestor, which swallows the pointermove stream and the edge never follows the mouse.
  // Taking `draggable` off for the duration is what actually stops it.
  const [resizing, setResizing] = useState(false);
  const dragging = useRef<BlockId | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // a fresh server layout (someone else's save, or our own coming back) replaces the draft
  useEffect(() => setDraft(layout), [layout]);

  const live = editing ? draft : layout;
  const present = live.filter((b) => blocks[b.id] != null);
  const dirty = serializeLayout(draft) !== serializeLayout(layout);

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

  const setSize = useCallback(
    (id: BlockId, size: BlockSize) =>
      setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, size } : b))),
    []
  );

  /**
   * Drag the right edge to choose a width.
   *
   * The pointer position is turned into a column count against the grid's real width, then
   * snapped to the sizes this card is allowed — so the edge follows your hand but can only
   * come to rest somewhere the card still works. The zone map is a fixed-aspect world canvas
   * and the timeline places its markers as percentages of its track; a third-width version
   * of either is not a smaller chart, it is an unreadable one.
   */
  const startResize = (e: React.PointerEvent, id: BlockId) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    const card = (e.currentTarget as HTMLElement).closest(".dash-block") as HTMLElement | null;
    if (!grid || !card) return;
    const gridBox = grid.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(grid).columnGap || "0");
    const colWidth = (gridBox.width - gap * (COLS - 1)) / COLS;
    const left = card.getBoundingClientRect().left;
    const options = allowedSizes(id);
    setResizing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const spanned = Math.round((ev.clientX - left + gap) / (colWidth + gap));
      // pick the allowed size whose span is nearest the width being asked for
      const best = options.reduce((a, b) =>
        Math.abs(SIZE_SPAN[b] - spanned) < Math.abs(SIZE_SPAN[a] - spanned) ? b : a
      );
      setSize(id, best);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const cancel = () => {
    setDraft(layout);
    setShowColour(false);
    setEditing(false);
  };

  return (
    <>
      {canEdit && (
        <div className={`dash-bar${editing ? " editing" : ""}`}>
          <button
            type="button"
            className={`wrench${editing ? " active" : ""}`}
            onClick={() => (editing ? cancel() : setEditing(true))}
            aria-pressed={editing}
            aria-label={editing ? "Stop arranging the dashboard" : "Arrange the dashboard"}
            title={editing ? "Stop arranging" : "Arrange the dashboard"}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M13.6 2.6a4.4 4.4 0 0 0-4.9 5.7l-5.5 5.5a1.6 1.6 0 0 0 2.3 2.3l5.5-5.5a4.4 4.4 0 0 0 5.7-4.9l-2.4 2.4-2.1-.6-.6-2.1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {editing && (
            <>
              <span className="dash-bar-note">
                Drag a card to move it. Pull its right edge to resize. × takes it off.
              </span>
              <button
                type="button"
                className={`dash-act${showColour ? " active" : ""}`}
                onClick={() => setShowColour((v) => !v)}
                aria-pressed={showColour}
              >
                Colour
              </button>
              <button
                type="button"
                className="dash-act"
                onClick={() => setDraft(defaultLayout())}
                disabled={isDefaultLayout(draft)}
              >
                Reset
              </button>
              <button type="button" className="dash-act" onClick={cancel}>
                Cancel
              </button>
              <form action={saveLayout} onSubmit={() => setEditing(false)}>
                <input type="hidden" name="layout" value={serializeLayout(draft)} />
                <button type="submit" className="dash-act primary" disabled={!dirty}>
                  Save
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {editing && showColour && (
        <div className="dash-colour">
          <ColourPanel colors={colors} />
        </div>
      )}

      <div className={`dash-grid${editing ? " editing" : ""}`} ref={gridRef}>
        {present
          .filter((b) => editing || !b.hidden)
          .map((b) => {
            const def = blockDef(b.id);
            return (
              <section
                key={b.id}
                className={`dash-block${editing ? " editable" : ""}${b.hidden ? " is-off" : ""}${
                  dragId === b.id ? " is-dragging" : ""
                }`}
                data-block={b.id}
                data-size={b.size}
                style={{ gridColumn: `span ${SIZE_SPAN[b.size]}` }}
                draggable={editing && !resizing}
                onDragStart={
                  editing
                    ? () => {
                        dragging.current = b.id;
                        setDragId(b.id);
                      }
                    : undefined
                }
                onDragEnd={
                  editing
                    ? () => {
                        dragging.current = null;
                        setDragId(null);
                      }
                    : undefined
                }
                onDragOver={editing ? (e) => e.preventDefault() : undefined}
                onDrop={
                  editing
                    ? (e) => {
                        e.preventDefault();
                        if (dragging.current) reorder(dragging.current, b.id);
                        dragging.current = null;
                        setDragId(null);
                      }
                    : undefined
                }
              >
                {editing && (
                  <>
                    {/* The card's name doubles as its grab handle. It has to be a real
                        button because dragging is unreachable from a keyboard — arrow keys
                        step the card past its neighbours, and that is also the only way a
                        test harness can drive a reorder deterministically. */}
                    <button
                      type="button"
                      className="dash-tag"
                      aria-label={`Move ${def.label}`}
                      onKeyDown={(e) => {
                        const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                        if (!dir) return;
                        e.preventDefault();
                        const here = present.findIndex((x) => x.id === b.id);
                        const neighbour = present[here + dir];
                        if (neighbour) reorder(b.id, neighbour.id);
                      }}
                    >
                      {def.label}
                    </button>
                    {!def.pinned && (
                      <button
                        type="button"
                        className="dash-off"
                        aria-label={`${b.hidden ? "Put back" : "Take off"} ${def.label}`}
                        onClick={() =>
                          setDraft((cur) => cur.map((x) => (x.id === b.id ? { ...x, hidden: !x.hidden } : x)))
                        }
                      >
                        {b.hidden ? "+" : "×"}
                      </button>
                    )}
                    {/* the side you pull. Arrow keys do the same thing, because a drag is
                        unreachable from a keyboard. */}
                    <span
                      className="dash-resize"
                      role="slider"
                      tabIndex={0}
                      aria-label={`Width of ${def.label}`}
                      aria-valuemin={SIZE_SPAN[allowedSizes(b.id)[0]]}
                      aria-valuemax={COLS}
                      aria-valuenow={SIZE_SPAN[b.size]}
                      onPointerDown={(e) => startResize(e, b.id)}
                      onKeyDown={(e) => {
                        const opts = allowedSizes(b.id);
                        const at = opts.indexOf(b.size);
                        if (e.key === "ArrowRight" && at < opts.length - 1) setSize(b.id, opts[at + 1]);
                        if (e.key === "ArrowLeft" && at > 0) setSize(b.id, opts[at - 1]);
                      }}
                    />
                  </>
                )}
                <div className="dash-body">{blocks[b.id]}</div>
              </section>
            );
          })}
      </div>
    </>
  );
}

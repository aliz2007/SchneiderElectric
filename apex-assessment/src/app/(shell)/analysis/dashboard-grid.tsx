"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
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
import { saveLayout } from "../admin/settings/actions";

/**
 * The Capability Dashboard's grid, and its edit mode.
 *
 * The cards themselves are still rendered on the SERVER — they read the database directly
 * and several of them are megabytes of geography and per-AM scores. They arrive here as
 * already-rendered nodes in `blocks`, and this component only decides the ORDER, the WIDTH
 * and whether each one is on the page at all. Nothing about a card's contents crosses into
 * the client because of this file.
 *
 * Edit mode is the iPhone-homescreen bit: the cards wobble, each one grows a size control
 * and a remove button, and they can be dragged past each other. Two things make that
 * honest rather than a gimmick:
 *   - arrow buttons do everything dragging does, because a drag is unreachable by keyboard
 *     and unreliable under a test harness;
 *   - nothing is written until Done, so a superadmin can shove every card around, decide
 *     they hated it, and press Cancel.
 */

const SIZE_ICON: Record<BlockSize, string> = { third: "▪", half: "▬", full: "▭" };

export default function DashboardGrid({
  layout,
  blocks,
  canEdit,
  editing,
}: {
  layout: DashboardLayout;
  /** server-rendered card for each block; a block missing here is not on this page at all */
  blocks: Partial<Record<BlockId, ReactNode>>;
  canEdit: boolean;
  editing: boolean;
}) {
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  const dragging = useRef<BlockId | null>(null);
  const [dragId, setDragId] = useState<BlockId | null>(null);

  // Only blocks that actually produced a card. An assessor never receives the zone map,
  // and "Recommended training focus" disappears when there are no deficits — neither
  // should leave a hole in the grid or a ghost tile in the editor.
  const present = useMemo(
    () => (editing ? draft : layout).filter((b) => blocks[b.id] != null),
    [draft, layout, editing, blocks]
  );

  /**
   * Step a card past its VISIBLE neighbour, not past its neighbour in the stored layout.
   *
   * The two differ whenever a block produced no card — an assessor has no zone map, and
   * "Recommended training focus" is absent when nothing is below target. Stepping through
   * the stored layout would swap a card with something that is not on the page, and the
   * arrow would appear to do nothing at all.
   */
  const move = (id: BlockId, dir: -1 | 1) => {
    const here = present.findIndex((b) => b.id === id);
    const neighbour = present[here + dir];
    if (here < 0 || !neighbour) return;
    setDraft((cur) => {
      const at = cur.findIndex((b) => b.id === id);
      const to = cur.findIndex((b) => b.id === neighbour.id);
      if (at < 0 || to < 0) return cur;
      const next = cur.slice();
      const [b] = next.splice(at, 1);
      next.splice(to, 0, b);
      return next;
    });
  };

  const setSize = (id: BlockId, size: BlockSize) =>
    setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, size } : b)));

  const setHidden = (id: BlockId, hidden: boolean) =>
    setDraft((cur) => cur.map((b) => (b.id === id ? { ...b, hidden } : b)));

  const dropOn = (target: BlockId) => {
    const from = dragging.current;
    dragging.current = null;
    setDragId(null);
    if (!from || from === target) return;
    setDraft((cur) => {
      const at = cur.findIndex((b) => b.id === from);
      const to = cur.findIndex((b) => b.id === target);
      if (at < 0 || to < 0) return cur;
      const next = cur.slice();
      const [b] = next.splice(at, 1);
      next.splice(to, 0, b);
      return next;
    });
  };

  // ---------- read-only render ----------
  if (!editing) {
    return (
      <>
        {canEdit && (
          <div className="dash-edit-bar">
            <Link className="btn btn-sm btn-outline" href="/analysis?edit=1">
              ✥ Arrange dashboard
            </Link>
            <span className="dash-edit-hint">
              Move, resize or remove the cards below. This is your own dashboard — what you
              save changes nobody else&apos;s view.
            </span>
          </div>
        )}
        <div className="dash-grid">
          {present
            .filter((b) => !b.hidden)
            .map((b) => (
              <section key={b.id} className="dash-block" data-block={b.id} data-size={b.size}
                style={{ gridColumn: `span ${SIZE_SPAN[b.size]}` }}>
                {blocks[b.id]}
              </section>
            ))}
        </div>
      </>
    );
  }

  // ---------- edit mode ----------
  const pristine = isDefaultLayout(draft);
  return (
    <form action={saveLayout} className="dash-edit">
      <input type="hidden" name="layout" value={serializeLayout(draft)} />
      <div className="dash-edit-bar dash-edit-bar-active">
        <strong className="dash-edit-title">Arranging the dashboard</strong>
        <span className="dash-edit-hint">
          Drag a card, or use ← →. Pick a width. ✕ takes a card off the dashboard — it stays
          here, greyed, so you can put it back.
        </span>
        <div className="dash-edit-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setDraft(defaultLayout())} disabled={pristine}>
            Reset to default
          </button>
          <Link className="btn btn-sm btn-outline" href="/analysis">
            Cancel
          </Link>
          <button type="submit" className="btn btn-sm btn-primary" name="done" value="1">
            Done
          </button>
        </div>
      </div>

      <div className="dash-grid dash-grid-editing">
        {present.map((b, i) => {
          const def = blockDef(b.id);
          return (
            <section
              key={b.id}
              className={`dash-block dash-block-edit${b.hidden ? " is-hidden" : ""}${dragId === b.id ? " is-dragging" : ""}`}
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
                dropOn(b.id);
              }}
            >
              <div className="dash-chrome">
                <span className="dash-grip" aria-hidden="true">
                  ⠿
                </span>
                <span className="dash-name">{def.label}</span>
                <div className="dash-tools">
                  <button
                    type="button"
                    className="dash-tool"
                    onClick={() => move(b.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${def.label} earlier`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="dash-tool"
                    onClick={() => move(b.id, 1)}
                    disabled={i === present.length - 1}
                    aria-label={`Move ${def.label} later`}
                  >
                    →
                  </button>
                  {/* only the widths this card survives: the map is a fixed-aspect world
                      canvas and the timeline places its flags as percentages of the track,
                      so a third-width version of either is not a smaller chart, it is an
                      unreadable one */}
                  <span className="dash-sizes" role="group" aria-label={`Width of ${def.label}`}>
                    {allowedSizes(b.id).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`dash-tool dash-size${b.size === s ? " active" : ""}`}
                        aria-pressed={b.size === s}
                        onClick={() => setSize(b.id, s)}
                        title={SIZE_LABEL[s]}
                      >
                        {SIZE_ICON[s]}
                      </button>
                    ))}
                  </span>
                  {def.pinned ? (
                    <span className="dash-pinned" title="This card carries the filters that scope the page, so it cannot be removed.">
                      pinned
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`dash-tool dash-remove${b.hidden ? " active" : ""}`}
                      onClick={() => setHidden(b.id, !b.hidden)}
                      aria-label={b.hidden ? `Put ${def.label} back` : `Remove ${def.label}`}
                      title="Take this card off your own dashboard"
                    >
                      {b.hidden ? "+" : "✕"}
                    </button>
                  )}
                </div>
              </div>
              <div className="dash-body" aria-hidden={b.hidden}>
                {blocks[b.id]}
              </div>
              {b.hidden && <div className="dash-hidden-veil">Removed from the dashboard</div>}
            </section>
          );
        })}
      </div>
    </form>
  );
}

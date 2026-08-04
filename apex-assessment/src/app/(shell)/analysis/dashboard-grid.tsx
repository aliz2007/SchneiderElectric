import type { ReactNode } from "react";
import { SIZE_SPAN, type BlockId, type DashboardLayout } from "@/lib/dashboard-layout";

/**
 * The Capability Dashboard's grid.
 *
 * A plain SERVER component — no JavaScript ships for it. Arranging happens in the Dashboard
 * Manager under Settings, so the dashboard itself carries no edit bar, no handles and no
 * wobble: it is the finished thing, not the workshop.
 *
 * `blocks` arrives already rendered. A card that does not apply to this reader is simply
 * absent from it, so an assessor's dashboard closes up where the zone map would have been
 * rather than leaving a hole, and a stored layout can never be used to reveal a card that
 * was never built for them.
 */
export default function DashboardGrid({
  layout,
  blocks,
}: {
  layout: DashboardLayout;
  blocks: Partial<Record<BlockId, ReactNode>>;
}) {
  return (
    <div className="dash-grid">
      {layout
        .filter((b) => !b.hidden && blocks[b.id] != null)
        .map((b) => (
          <section
            key={b.id}
            className="dash-block"
            data-block={b.id}
            data-size={b.size}
            style={{ gridColumn: `span ${SIZE_SPAN[b.size]}` }}
          >
            {blocks[b.id]}
          </section>
        ))}
    </div>
  );
}

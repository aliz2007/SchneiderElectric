import type { BlockId } from "@/lib/dashboard-layout";

/**
 * A small drawing of what each dashboard card actually looks like.
 *
 * The canvas is meant to be READ at a glance, the way you recognise an app on a homescreen
 * by its icon rather than by reading its name. A row of identical grey rectangles labelled
 * in 11px type is a list wearing a costume; a wireframe of five KPI tiles, or of a table
 * with a heat grid in it, is the card itself, small.
 *
 * Built from elements rather than from a fixed-viewBox SVG, because a tile here is anything
 * from a third of the canvas to all of it. A scaled SVG either shrinks into a stamp floating
 * in the middle of a wide tile, or — if stretched to fill — smears every mark into an
 * ellipse. Laid out with flex and grid, the wireframe reflows the way the real card does:
 * five KPI tiles stay five KPI tiles and stay the right shape at any width.
 */
export default function BlockGlyph({ id }: { id: BlockId }) {
  switch (id) {
    case "kpis": // five tiles, each a big number over a caption
      return (
        <div className="wf wf-row">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="wf-tile">
              <span className="wf-bar wf-lg" />
              <span className="wf-bar wf-sm" />
            </div>
          ))}
        </div>
      );

    case "report": // a line of copy with the download button on the right
      return (
        <div className="wf wf-split">
          <div className="wf-lines">
            <span className="wf-bar wf-md" />
            <span className="wf-bar wf-wide" />
          </div>
          <span className="wf-pill wf-solid" />
        </div>
      );

    case "filters": // control pills
      return (
        <div className="wf wf-row wf-start">
          <span className="wf-pill" />
          <span className="wf-pill wf-dim" />
          <span className="wf-pill wf-dimmer" />
        </div>
      );

    case "map": // hubs scattered over a band
      return (
        <div className="wf wf-map">
          <span className="wf-coast" />
          {[16, 39, 61, 84].map((left, i) => (
            <span key={left} className="wf-hub" style={{ left: `${left}%`, top: i % 2 ? "56%" : "30%" }} />
          ))}
        </div>
      );

    case "timeline": // one lane per lens, markers along each
      return (
        <div className="wf wf-stack">
          {[
            [22, 48, 74],
            [34, 62],
            [18, 55, 88],
          ].map((marks, lane) => (
            <div key={lane} className="wf-lane">
              {marks.map((left) => (
                <span key={left} className="wf-mark" style={{ left: `${left}%` }} />
              ))}
            </div>
          ))}
        </div>
      );

    case "priorities": // a ranked list, each row led by a score chip
      return (
        <div className="wf wf-stack">
          {[0, 1, 2].map((i) => (
            <div key={i} className="wf-listrow">
              <span className="wf-chip" style={{ opacity: 0.8 - i * 0.2 }} />
              <span className="wf-bar" style={{ width: `${62 - i * 14}%`, maxWidth: 260 - i * 50 }} />
            </div>
          ))}
        </div>
      );

    case "heatmap": // a label column beside a grid of cells at mixed intensities
      return (
        <div className="wf wf-heat">
          <div className="wf-heat-labels">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="wf-bar" />
            ))}
          </div>
          <div className="wf-heat-grid">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className="wf-cell" style={{ opacity: 0.16 + ((i * 5) % 6) * 0.13 }} />
            ))}
          </div>
        </div>
      );

    case "roster": // a table: header rule, then rows of a name and status pills
      return (
        <div className="wf wf-stack">
          <span className="wf-rule" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="wf-listrow">
              <span className="wf-bar" style={{ width: "26%", maxWidth: 130 }} />
              {[0, 1, 2, 3].map((j) => (
                <span key={j} className="wf-status" />
              ))}
            </div>
          ))}
        </div>
      );
  }
}

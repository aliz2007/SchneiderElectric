"use client";

/**
 * Perception radar for one Account Manager: one axis per cluster capability, one web per
 * lens plus the final weighted score and the EXPECTED level.
 *
 * The expected web is the point of the chart. Without it a shape is just a shape — you
 * cannot tell whether a small hexagon is a problem or exactly what the track asks for.
 * It is drawn dashed and unfilled so it reads as a target line rather than another score.
 *
 * Colours match the lens dots used in the tables on the same page (see .ld-* in
 * globals.css), so the legend is consistent across the whole individual view.
 */

export type RadarTheme = {
  theme: string;
  self: number | null;
  manager: number | null;
  expert: number | null;
  weighted: number | null;
  required: number | null;
};

const WEBS = [
  { key: "self" as const, label: "Self", color: "#a78bfa", width: 1.4, fill: 0 },
  { key: "manager" as const, label: "Manager", color: "#7db1ff", width: 1.4, fill: 0 },
  { key: "expert" as const, label: "APEX Panel", color: "#3dcd58", width: 1.4, fill: 0 },
  { key: "weighted" as const, label: "Final score", color: "#4ce26a", width: 3, fill: 0.16 },
];

const MAX = 3; // L3 is the outer ring

// generous viewBox so the cluster labels never clip; the SVG scales to its container
const W = 520;
const H = 360;
const CX = W / 2;
const CY = H / 2 + 4;
const R = 116;

/** split a long cluster name onto two lines so it stays clear of the web */
function splitLabel(name: string): string[] {
  const words = name.split(" ");
  if (words.length < 3) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export default function ThemeRadar({ data }: { data: RadarTheme[] }) {
  if (data.length < 3) return null;

  const angle = (i: number) => (Math.PI * 2 * i) / data.length - Math.PI / 2;
  const pt = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(MAX, value)) / MAX) * R;
    return [CX + Math.cos(angle(i)) * r, CY + Math.sin(angle(i)) * r] as const;
  };
  const poly = (get: (t: RadarTheme) => number | null) =>
    data.map((t, i) => pt(i, get(t) ?? 0).join(",")).join(" ");

  const active = WEBS.filter((w) => data.some((t) => t[w.key] != null));
  const hasRequired = data.some((t) => t.required != null);

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="radar-svg" role="img" aria-label="Perception by cluster capability">
        {/* rings at L1 / L2 / L3 */}
        {[1, 2, 3].map((lvl) => (
          <polygon
            key={lvl}
            points={data.map((_, i) => pt(i, lvl).join(",")).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
          />
        ))}
        {/* spokes */}
        {data.map((_, i) => {
          const [x, y] = pt(i, MAX);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />;
        })}
        {/* ring labels along the top spoke */}
        {[1, 2, 3].map((lvl) => (
          <text key={lvl} x={CX + 5} y={CY - (lvl / MAX) * R + 4} fill="#6b7689" fontSize={9.5}>
            L{lvl}
          </text>
        ))}

        {/* the expected level, dashed, drawn under the score webs */}
        {hasRequired && (
          <polygon
            points={poly((t) => t.required)}
            fill="none"
            stroke="#e8edf7"
            strokeWidth={1.8}
            strokeDasharray="5 4"
            opacity={0.85}
          />
        )}

        {active.map((w) => (
          <g key={w.key}>
            <polygon
              points={poly((t) => t[w.key])}
              fill={w.fill ? w.color : "none"}
              fillOpacity={w.fill}
              stroke={w.color}
              strokeWidth={w.width}
              strokeLinejoin="round"
            />
            {data.map((t, i) => {
              if (t[w.key] == null) return null;
              const [x, y] = pt(i, t[w.key]!);
              return <circle key={i} cx={x} cy={y} r={w.key === "weighted" ? 3.4 : 2.2} fill={w.color} />;
            })}
          </g>
        ))}

        {/* cluster names around the web */}
        {data.map((t, i) => {
          const a = angle(i);
          const lx = CX + Math.cos(a) * (R + 30);
          const ly = CY + Math.sin(a) * (R + 30);
          const cos = Math.cos(a);
          const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
          const rows = splitLabel(t.theme);
          const baseY = ly + (Math.sin(a) > 0.35 ? 8 : Math.sin(a) < -0.35 ? -4 : 2);
          return (
            <g key={t.theme}>
              {rows.map((row, ri) => (
                <text
                  key={ri}
                  x={lx}
                  y={baseY + ri * 12 - (rows.length - 1) * 6}
                  fill="#c3cdde"
                  fontSize={10.5}
                  fontWeight={650}
                  textAnchor={anchor}
                >
                  {row}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="radar-legend">
        {active.map((w) => (
          <span key={w.key}>
            <span className="sw" style={{ background: w.color }} />
            {w.label}
          </span>
        ))}
        {hasRequired && (
          <span>
            <span className="sw sw-dashed" />
            Expected level
          </span>
        )}
      </div>
    </div>
  );
}

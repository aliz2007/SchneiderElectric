/**
 * Dashboard layout & app accent — the state behind the superadmin Dashboard Manager.
 *
 * Both live in the `app_settings` key/value table, so they are properties of the
 * INSTALLATION, not of the person looking. That is deliberate: a superadmin arranging
 * the dashboard is deciding what this deployment's dashboard looks like for everyone,
 * the same way they decide who can see what. A per-user layout would mean the client
 * arranges their dashboard, screen-shares it, and nobody else sees what they are
 * describing.
 *
 * Everything here is defensive on read. The stored value is JSON a human can edit by
 * hand, and a layout that throws would take the whole dashboard down, so a malformed
 * or partial value always degrades to the shipped defaults rather than failing.
 *
 * This module is deliberately FREE of database imports. The dashboard's edit mode is a
 * client component and needs the block definitions, the sizes and the parser; pulling
 * getSetting() in here would drag better-sqlite3 and node:fs into the browser bundle and
 * fail the build. Reads and writes live in ./dashboard-settings, which is server-only.
 */

export const LAYOUT_KEY = "dashboard.layout";
export const ACCENT_KEY = "theme.accent";

/** How much of the 12-column dashboard grid a card takes. */
export type BlockSize = "third" | "half" | "full";

export const SIZE_SPAN: Record<BlockSize, number> = { third: 4, half: 6, full: 12 };
export const SIZES: BlockSize[] = ["third", "half", "full"];
export const SIZE_LABEL: Record<BlockSize, string> = {
  third: "Third width",
  half: "Half width",
  full: "Full width",
};

export type BlockId =
  | "kpis"
  | "report"
  | "filters"
  | "map"
  | "timeline"
  | "priorities"
  | "heatmap"
  | "roster";

export type BlockDef = {
  id: BlockId;
  label: string;
  blurb: string;
  size: BlockSize;
  /** built only for superadmins — an assessor never receives this block at all */
  adminOnly: boolean;
  /**
   * Cards that carry the page's controls. They can be moved and resized like anything
   * else, but they cannot be hidden: the filter bar scopes every other card on the page,
   * so hiding it would strip the only way to clear a filter that is still in the URL.
   */
  pinned?: boolean;
  /**
   * The narrowest width this card is still readable at.
   *
   * Some cards genuinely cannot be squeezed. The zone map is a fixed-aspect world canvas
   * with hub markers on it, and the timeline positions its flags as percentages of the
   * track, so at a third width both stop being charts and become smears. Rather than let
   * a superadmin pick a size that quietly ruins a card, the editor only offers the widths
   * that work — which is also why this lives next to the block and not in the CSS.
   */
  minSize?: BlockSize;
  /**
   * Shown next to the remove button. There is one layout for the whole deployment, so a
   * card taken off the dashboard goes for everyone — and for a couple of cards, the
   * people who lose the most are the ones with no other way to reach that information.
   */
  warn?: string;
};

/**
 * The shipped dashboard, in shipped order. "Reset" in the Dashboard Manager restores
 * exactly this, which is why the defaults live in one place rather than being spread
 * across the page.
 *
 * Adding a block here is enough to make it appear for everyone: a stored layout that
 * predates it simply does not mention it, and the merge below drops it back at its
 * default index.
 */
export const DASHBOARD_BLOCKS: BlockDef[] = [
  {
    id: "kpis",
    label: "Campaign KPIs",
    blurb: "Completion, submissions per lens, average weighted maturity.",
    size: "full",
    adminOnly: false,
    minSize: "half",
  },
  {
    id: "report",
    label: "PDF deck",
    blurb: "Download the Capability Dashboard as a PDF, honouring the filters.",
    size: "full",
    adminOnly: true,
  },
  {
    id: "filters",
    label: "Filters",
    blurb: "Track, segment and capability. Scopes every card below it.",
    size: "full",
    adminOnly: false,
    pinned: true,
  },
  {
    id: "map",
    label: "Zone performance map",
    blurb: "Weighted performance vs required across the Schneider hubs.",
    size: "full",
    adminOnly: true,
    minSize: "full",
  },
  {
    id: "timeline",
    label: "Assessment timeline",
    blurb: "Every self, manager and panel deadline across the roster.",
    size: "full",
    adminOnly: false,
    minSize: "half",
    warn: "Managers and panel members read their overdue list here.",
  },
  {
    id: "priorities",
    label: "Recommended training focus",
    blurb: "The largest zone-level deficits, worst first.",
    size: "full",
    adminOnly: false,
  },
  {
    id: "heatmap",
    label: "Training-needs heat map",
    blurb: "Capability × zone, with the required level and the gap in every cell.",
    size: "full",
    adminOnly: false,
    minSize: "half",
  },
  {
    id: "roster",
    label: "Roster",
    blurb: "Who has submitted, per lens, with their deadlines.",
    size: "full",
    adminOnly: false,
    minSize: "half",
    warn: "This is the only place an assessor can see who they were assigned.",
  },
];

const BY_ID = new Map(DASHBOARD_BLOCKS.map((b) => [b.id, b]));

export const isBlockId = (v: unknown): v is BlockId => typeof v === "string" && BY_ID.has(v as BlockId);
export const blockDef = (id: BlockId): BlockDef => BY_ID.get(id)!;

/** One card's placement. Order is the array index, so this carries no index of its own. */
export type BlockPref = { id: BlockId; size: BlockSize; hidden: boolean };

export type DashboardLayout = BlockPref[];

/** The widths this card may take, narrowest allowed first. */
export const allowedSizes = (id: BlockId): BlockSize[] => {
  const min = blockDef(id).minSize;
  return min ? SIZES.slice(SIZES.indexOf(min)) : SIZES;
};

export const defaultLayout = (): DashboardLayout =>
  DASHBOARD_BLOCKS.map((b) => ({ id: b.id, size: b.size, hidden: false }));

/** True when this layout is the shipped one — used to grey out "Reset". */
export const isDefaultLayout = (layout: DashboardLayout): boolean => {
  const def = defaultLayout();
  return (
    layout.length === def.length &&
    layout.every((b, i) => b.id === def[i].id && b.size === def[i].size && b.hidden === def[i].hidden)
  );
};

/**
 * Turn whatever is in the database into a layout that is guaranteed to name every block
 * exactly once.
 *
 * Three things can go wrong and all three have to degrade quietly:
 *   - the value is absent, truncated or not an array  → the shipped layout
 *   - it names a block that no longer exists          → that entry is dropped
 *   - it is missing a block that has since shipped    → appended at its default index
 * The last one is the important one. Without it, adding a card to the dashboard would
 * make it invisible on every deployment that had ever touched the Dashboard Manager.
 */
export function parseLayout(raw: string | null): DashboardLayout {
  if (!raw) return defaultLayout();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaultLayout();
  }
  if (!Array.isArray(parsed)) return defaultLayout();

  const seen = new Set<BlockId>();
  const out: DashboardLayout = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { id, size, hidden } = entry as { id?: unknown; size?: unknown; hidden?: unknown };
    if (!isBlockId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      size: allowedSizes(id).includes(size as BlockSize) ? (size as BlockSize) : blockDef(id).size,
      // a pinned card is never hidden, whatever the stored value claims
      hidden: blockDef(id).pinned ? false : hidden === true,
    });
  }

  // splice any block the stored layout never heard of back in at its shipped index
  for (const [i, def] of DASHBOARD_BLOCKS.entries()) {
    if (seen.has(def.id)) continue;
    out.splice(Math.min(i, out.length), 0, { id: def.id, size: def.size, hidden: false });
  }
  return out;
}

export const serializeLayout = (layout: DashboardLayout): string =>
  JSON.stringify(layout.map((b) => ({ id: b.id, size: b.size, hidden: b.hidden })));

// ---------- accent colour ----------

export const DEFAULT_ACCENT = "#3dcd58"; // Schneider green

export type AccentPreset = { hex: string; name: string };

/**
 * The offered accents. Every one of these has been checked to keep white text legible on
 * the primary button and to stay clear of the heat palette (green = at target, amber and
 * orange = below, red = critical), because the accent paints CHROME and the heat colours
 * carry meaning — if the two collide the dashboard starts looking like it is warning you
 * about its own sidebar.
 */
export const ACCENT_PRESETS: AccentPreset[] = [
  { hex: "#3dcd58", name: "Schneider green" },
  { hex: "#2e7cf6", name: "Deep blue" },
  { hex: "#0ea5b7", name: "Teal" },
  { hex: "#7c5cff", name: "Violet" },
  { hex: "#e0577f", name: "Rose" },
  { hex: "#c48a2a", name: "Bronze" },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Accepts `#rgb` and `#rrggbb`, in any case, and nothing else. */
export function normalizeAccent(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v) || /^[0-9a-f]{6}$/.test(v)) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return HEX.test(v) ? v : null;
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const h = normalizeAccent(hex) ?? DEFAULT_ACCENT;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
};

/** Mix a colour towards white (`amount` > 0) or black (`amount` < 0). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Perceived luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * The custom properties that repaint the app's chrome.
 *
 * Only the accent family is written. The result palette (--ok, --amber, --red, the .hm-*
 * cells) is deliberately absent: those colours are a legend, and a heat map whose "at or
 * above required" green followed the customer's brand colour would be reporting a
 * different answer depending on a setting. globals.css keeps the two families apart, and
 * this function is the reason it has to.
 *
 * These land as an INLINE STYLE on <html> rather than as a <style> block. An inline style
 * beats any stylesheet rule regardless of which one the framework decided to emit first,
 * so the accent cannot lose a cascade race with globals.css on some future build.
 */
export function accentVars(hex: string): Record<string, string> {
  const accent = normalizeAccent(hex) ?? DEFAULT_ACCENT;
  const [r, g, b] = hexToRgb(accent);
  return {
    "--accent": accent,
    "--accent-rgb": `${r}, ${g}, ${b}`,
    "--accent-bright": shade(accent, 0.18),
    "--accent-deep": shade(accent, -0.14),
    "--accent-soft": shade(accent, 0.55),
    // ink for text sitting ON a filled accent surface: it has to flip as the accent
    // lightens, or a pale brand turns every primary button into white-on-white
    "--accent-ink": luminance(accent) > 0.62 ? "#06210e" : "#ffffff",
  };
}

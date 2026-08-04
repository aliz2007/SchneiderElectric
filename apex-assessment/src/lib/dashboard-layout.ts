/**
 * Dashboard layout & app accent — the state behind the superadmin Dashboard Manager.
 *
 * Both live in the `user_settings` table, keyed by person: each superadmin arranges and
 * colours their OWN dashboard. Nothing here is installation-wide, so saving an arrangement
 * never changes what a colleague sees, and anyone without a stored preference — an
 * assessor, or the sign-in screen, which has no session yet — gets the shipped defaults.
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
export const COLORS_KEY = "theme.colors";

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
   * so hiding it would strip your only way to clear a filter that is still in the URL.
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
};

/**
 * The shipped dashboard, in shipped order. Everybody starts here, and "Reset" in the
 * Dashboard Manager restores exactly this — which is why the defaults live in one place
 * rather than being spread across the page.
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

// ---------- colour ----------

export const DEFAULT_ACCENT = "#3dcd58"; // Schneider green

/**
 * The parts of the app that can be recoloured independently.
 *
 * `accent` is the brand: buttons, links, focus rings, the glow. The other three are
 * SURFACES, and they are separate because changing the brand and changing the furniture are
 * different intentions — a customer may want their own green on a navy app, or the same
 * green on a black one.
 *
 * Deliberately absent: anything that carries a result. Green means "at or above the required
 * level" and magenta means "the APEX Panel said so"; those are a legend, not decoration, and
 * a dashboard that reported differently depending on a colour setting would be worse than
 * one that could not be recoloured at all.
 */
export type ThemePart = "accent" | "sidebar" | "bg" | "card";

export const THEME_PARTS: { id: ThemePart; label: string; blurb: string; fallback: string }[] = [
  { id: "accent", label: "Accent", blurb: "Buttons, links, focus and the glow.", fallback: DEFAULT_ACCENT },
  { id: "sidebar", label: "Menu bar", blurb: "The panel down the left.", fallback: "#060b16" },
  { id: "bg", label: "Background", blurb: "The canvas behind the cards.", fallback: "#070d19" },
  { id: "card", label: "Cards", blurb: "The panels the content sits on.", fallback: "#0f172a" },
];

export type ThemeColors = Partial<Record<ThemePart, string>>;

export type AccentPreset = { hex: string; name: string };

/** Offered for the accent. Each keeps its filled buttons legible and stays clear of the
 *  result palette, so a brand colour never reads as a warning about itself. */
export const ACCENT_PRESETS: AccentPreset[] = [
  { hex: "#3dcd58", name: "Schneider green" },
  { hex: "#2e7cf6", name: "Deep blue" },
  { hex: "#0ea5b7", name: "Teal" },
  { hex: "#7c5cff", name: "Violet" },
  { hex: "#e0577f", name: "Rose" },
  { hex: "#c48a2a", name: "Bronze" },
];

/** Offered for the surfaces: dark neutrals that keep body text above contrast. */
export const SURFACE_PRESETS: AccentPreset[] = [
  { hex: "#070d19", name: "Midnight navy" },
  { hex: "#0b1020", name: "Ink" },
  { hex: "#0a0f14", name: "Graphite" },
  { hex: "#10131c", name: "Slate" },
  { hex: "#120e1a", name: "Aubergine" },
  { hex: "#000000", name: "Black" },
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

/** Keep only the parts that are real colours, so nothing arbitrary reaches a style attribute. */
export function parseColors(raw: string | null): ThemeColors {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: ThemeColors = {};
  for (const { id } of THEME_PARTS) {
    const hex = normalizeAccent((parsed as Record<string, unknown>)[id] as string | undefined);
    if (hex) out[id] = hex;
  }
  return out;
}

export const serializeColors = (c: ThemeColors): string | null => {
  const clean = parseColors(JSON.stringify(c));
  return Object.keys(clean).length === 0 ? null : JSON.stringify(clean);
};

export const isDefaultColors = (c: ThemeColors): boolean => Object.keys(parseColors(JSON.stringify(c))).length === 0;

/**
 * The custom properties that repaint the app.
 *
 * Returns NOTHING for a part nobody has chosen, and that is the important part. globals.css
 * does not define --accent* at all; every rule that used to hold a brand green now carries
 * that exact green as its own var() fallback. So on a default install nothing is injected,
 * every fallback is used, and the stylesheet renders byte-for-byte what it always did. The
 * tokens only come into existence when somebody actually picks a colour.
 *
 * These land as an INLINE STYLE on <html> rather than as a <style> block. An inline style
 * beats any stylesheet rule regardless of which one the framework emits first.
 */
export function themeVars(colors: ThemeColors): Record<string, string> {
  const out: Record<string, string> = {};
  const accent = normalizeAccent(colors.accent);
  if (accent && accent !== DEFAULT_ACCENT) {
    const [r, g, b] = hexToRgb(accent);
    out["--accent"] = accent;
    out["--accent-rgb"] = `${r}, ${g}, ${b}`;
    out["--accent-bright"] = shade(accent, 0.18);
    out["--accent-deep"] = shade(accent, -0.14);
    out["--accent-soft"] = shade(accent, 0.55);
    // ink for text sitting ON a filled accent surface: it has to flip as the accent
    // lightens, or a pale brand turns every primary button into white-on-white
    out["--accent-ink"] = luminance(accent) > 0.62 ? "#06210e" : "#ffffff";
  }
  const sidebar = normalizeAccent(colors.sidebar);
  if (sidebar) {
    out["--sidebar"] = sidebar;
    // the bar is a gradient between two stops; one pick drives both so it keeps its depth
    out["--sidebar-2"] = shade(sidebar, 0.12);
  }
  const bg = normalizeAccent(colors.bg);
  if (bg) out["--bg"] = bg;
  const card = normalizeAccent(colors.card);
  if (card) {
    const [r, g, b] = hexToRgb(card);
    // cards keep their translucency, or the glass turns into flat plastic
    out["--card"] = `rgba(${r}, ${g}, ${b}, 0.6)`;
  }
  return out;
}

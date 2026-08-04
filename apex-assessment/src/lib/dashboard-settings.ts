/**
 * Reading and writing the Dashboard Manager's state.
 *
 * Split out from ./dashboard-layout so that module stays importable from client
 * components: this one touches better-sqlite3 through queries.ts, and anything that pulls
 * it into the browser bundle fails the build with an unhandled `node:fs` scheme.
 */

import { getSetting, setSetting } from "./queries";
import {
  ACCENT_KEY,
  DEFAULT_ACCENT,
  LAYOUT_KEY,
  normalizeAccent,
  parseLayout,
  serializeLayout,
  type DashboardLayout,
} from "./dashboard-layout";

export const readLayout = (): DashboardLayout => parseLayout(getSetting(LAYOUT_KEY));

/** Passing null clears the row, which is how "reset to the shipped layout" is stored. */
export const writeLayout = (layout: DashboardLayout | null) =>
  setSetting(LAYOUT_KEY, layout == null ? null : serializeLayout(layout));

export const readAccent = (): string => normalizeAccent(getSetting(ACCENT_KEY)) ?? DEFAULT_ACCENT;
export const writeAccent = (hex: string | null) => setSetting(ACCENT_KEY, hex);

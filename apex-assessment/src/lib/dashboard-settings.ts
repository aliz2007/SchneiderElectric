/**
 * Reading and writing the Dashboard Manager's state.
 *
 * PER USER. Each superadmin arranges and colours their own dashboard; nothing here is
 * installation-wide. That is why every function takes a `userId` and why the rows live in
 * `user_settings` rather than `app_settings` — the latter is one row per key for the whole
 * deployment, which is right for the AI config and wrong for a personal preference.
 *
 * `userId` is nullable throughout because the sign-in screen has no session yet. Whoever
 * has not chosen (or cannot choose) gets the shipped defaults, which is also what an
 * assessor gets: the Dashboard Manager is superadmin-only, so they have nothing stored.
 *
 * Split out from ./dashboard-layout so that module stays importable from client
 * components: this one touches better-sqlite3 through queries.ts, and anything that pulls
 * it into the browser bundle fails the build with an unhandled `node:fs` scheme.
 */

import { getUserSetting, setUserSetting } from "./queries";
import {
  ACCENT_KEY,
  DEFAULT_ACCENT,
  LAYOUT_KEY,
  normalizeAccent,
  parseLayout,
  serializeLayout,
  type DashboardLayout,
} from "./dashboard-layout";

export const readLayout = (userId: number | null | undefined): DashboardLayout =>
  parseLayout(userId == null ? null : getUserSetting(userId, LAYOUT_KEY));

/** Passing null clears the row, which is how "reset to the shipped layout" is stored. */
export const writeLayout = (userId: number, layout: DashboardLayout | null) =>
  setUserSetting(userId, LAYOUT_KEY, layout == null ? null : serializeLayout(layout));

export const readAccent = (userId: number | null | undefined): string =>
  (userId == null ? null : normalizeAccent(getUserSetting(userId, ACCENT_KEY))) ?? DEFAULT_ACCENT;

export const writeAccent = (userId: number, hex: string | null) =>
  setUserSetting(userId, ACCENT_KEY, hex);

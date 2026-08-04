"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import {
  allowedSizes,
  blockDef,
  isBlockId,
  normalizeAccent,
  parseLayout,
  type BlockSize,
  type DashboardLayout,
} from "@/lib/dashboard-layout";
import { readLayout, writeAccent, writeLayout } from "@/lib/dashboard-settings";

/**
 * The layout and the accent are installation-wide, so every path that renders either has
 * to be revalidated after a write — not just the page the form was posted from. The
 * dashboard is the point of the exercise; the settings page shows the same state back;
 * the accent is injected by the shell layout, which every page under it inherits.
 */
function revalidateEverything() {
  revalidatePath("/analysis");
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
}

/**
 * Save a whole layout at once.
 *
 * The editor is a client component holding the arrangement in local state, so it posts the
 * final arrangement rather than a stream of move/resize/hide events. That keeps dragging
 * free of round-trips and makes "cancel" mean something: nothing is written until Save.
 *
 * The payload is untrusted — it arrives as JSON from the browser — so it goes through the
 * same parseLayout() the database read uses, which drops unknown ids, de-duplicates, and
 * splices back anything the client left out.
 */
export async function saveLayout(formData: FormData) {
  await requireSuperadmin();
  const raw = String(formData.get("layout") ?? "");
  writeLayout(parseLayout(raw));
  revalidateEverything();
}

/** Put the dashboard back to the arrangement the app ships with. */
export async function resetLayout() {
  await requireSuperadmin();
  writeLayout(null);
  revalidateEverything();
}

/**
 * Set the app accent. An unparseable colour clears the setting rather than storing junk,
 * which makes "reset to Schneider green" and "someone typed nonsense" land in the same
 * safe place.
 */
export async function saveAccent(formData: FormData) {
  await requireSuperadmin();
  writeAccent(normalizeAccent(String(formData.get("accent") ?? "")));
  revalidateEverything();
}

export async function resetAccent() {
  await requireSuperadmin();
  writeAccent(null);
  revalidateEverything();
}

/** Reset both halves of the Dashboard Manager in one action. */
export async function resetAll() {
  await requireSuperadmin();
  writeLayout(null);
  writeAccent(null);
  revalidateEverything();
}

/**
 * Move / resize / hide a single block from the dashboard's own edit mode.
 *
 * The in-place editor works one card at a time (drag it, tap a size, tap remove), so it
 * posts a delta against the CURRENT stored layout instead of a whole arrangement. Reading
 * the layout back inside the action is what keeps two superadmins editing at once from
 * clobbering each other's other cards.
 */
export async function updateBlock(formData: FormData) {
  await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  if (!isBlockId(id)) return;

  const layout: DashboardLayout = readLayout();
  const at = layout.findIndex((b) => b.id === id);
  if (at < 0) return;

  const size = String(formData.get("size") ?? "");
  if (allowedSizes(id).includes(size as BlockSize)) layout[at].size = size as BlockSize;

  const hidden = formData.get("hidden");
  if (hidden != null && !blockDef(id).pinned) layout[at].hidden = hidden === "1";

  const move = String(formData.get("move") ?? "");
  if (move === "up" || move === "down") {
    const to = move === "up" ? at - 1 : at + 1;
    if (to >= 0 && to < layout.length) {
      const [b] = layout.splice(at, 1);
      layout.splice(to, 0, b);
    }
  }

  writeLayout(layout);
  revalidateEverything();
}

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
 * Both values belong to one person, but they are read on more than one path, so a write
 * has to invalidate all of them — not just the page the form was posted from. The
 * dashboard is the point of the exercise; the settings page shows the same state back; the
 * accent is applied by the ROOT layout, which every page inherits.
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
  const me = await requireSuperadmin();
  const raw = String(formData.get("layout") ?? "");
  writeLayout(me.id, parseLayout(raw));
  revalidateEverything();
}

/** Put the dashboard back to the arrangement the app ships with. */
export async function resetLayout() {
  const me = await requireSuperadmin();
  writeLayout(me.id, null);
  revalidateEverything();
}

/**
 * Set the app accent. An unparseable colour clears the setting rather than storing junk,
 * which makes "reset to Schneider green" and "someone typed nonsense" land in the same
 * safe place.
 */
export async function saveAccent(formData: FormData) {
  const me = await requireSuperadmin();
  writeAccent(me.id, normalizeAccent(String(formData.get("accent") ?? "")));
  revalidateEverything();
}

export async function resetAccent() {
  const me = await requireSuperadmin();
  writeAccent(me.id, null);
  revalidateEverything();
}

/** Reset both halves of the Dashboard Manager in one action — this account's, not everyone's. */
export async function resetAll() {
  const me = await requireSuperadmin();
  writeLayout(me.id, null);
  writeAccent(me.id, null);
  revalidateEverything();
}

/**
 * Move / resize / hide a single block, from the show/remove buttons on the Settings page.
 *
 * Those work one card at a time, so this posts a delta against the caller's CURRENT stored
 * layout rather than a whole arrangement — which means it has to read that layout back
 * here, inside the action, instead of trusting a copy the browser was holding.
 */
export async function updateBlock(formData: FormData) {
  const me = await requireSuperadmin();
  const id = String(formData.get("id") ?? "");
  if (!isBlockId(id)) return;

  const layout: DashboardLayout = readLayout(me.id);
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

  writeLayout(me.id, layout);
  revalidateEverything();
}

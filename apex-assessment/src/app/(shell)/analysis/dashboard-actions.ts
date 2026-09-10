"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/session";
import { parseColors, parseLayout } from "@/lib/dashboard-layout";
import { writeColors, writeLayout } from "@/lib/dashboard-settings";

/**
 * Both values belong to one person and are read on more than one path, so a write has to
 * invalidate all of them — not just the page the form was posted from.
 */
function revalidateEverything() {
  revalidatePath("/analysis");
  // the colours are applied by the ROOT layout, so every page inherits them
  revalidatePath("/", "layout");
}

/**
 * Save the whole arrangement at once.
 *
 * The canvas is a client component holding the arrangement in local state, so it posts the
 * finished layout rather than a stream of move/resize/toggle events. That keeps dragging
 * free of round-trips and makes Cancel mean something: nothing is written until Save.
 *
 * The payload is untrusted — it is JSON from a browser — so it goes through the same
 * parseLayout() the database read uses, which drops unknown ids, de-duplicates, clamps
 * widths, and splices back anything the client left out.
 */
export async function saveLayout(formData: FormData) {
  const me = await requireSuperadmin();
  writeLayout(me.id, parseLayout(String(formData.get("layout") ?? "")));
  revalidateEverything();
}

/** Put the dashboard back to the arrangement the app ships with. */
export async function resetLayout() {
  const me = await requireSuperadmin();
  writeLayout(me.id, null);
  revalidateEverything();
}

/**
 * Save the chosen colours. Anything that is not a hex is dropped by parseColors rather than
 * stored, so nothing arbitrary can reach the style attribute the root layout writes.
 */
export async function saveColors(formData: FormData) {
  const me = await requireSuperadmin();
  writeColors(me.id, parseColors(String(formData.get("colors") ?? "")));
  revalidateEverything();
}

export async function resetColors() {
  const me = await requireSuperadmin();
  writeColors(me.id, null);
  revalidateEverything();
}

"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = getDb()
    .prepare("SELECT id, password_hash, role, active FROM users WHERE username = ?")
    .get(username) as { id: number; password_hash: string; role: string; active: number } | undefined;

  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  redirect(user.role === "superadmin" ? "/analysis" : "/rate");
}

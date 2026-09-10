// Session helpers: getCurrentUser, requireUser, requireSuperadmin.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { newSessionToken } from "./auth";
import type { Lens } from "./seed-data";

const COOKIE = "apex_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: "superadmin" | "assessor";
  lens: Lens | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.role, u.lens
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
    )
    .get(token) as SessionUser | undefined;
  return row ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperadmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "superadmin") redirect("/rate");
  return user;
}

export async function createSession(userId: number): Promise<void> {
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expires.toISOString().replace("T", " ").slice(0, 19));
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(COOKIE);
}

// Root route: signed in goes to the dashboard, otherwise to login.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "superadmin" ? "/analysis" : "/rate");
}

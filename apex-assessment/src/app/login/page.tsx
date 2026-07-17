import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "superadmin" ? "/analysis" : "/rate");
  const { error } = await searchParams;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">SE</div>
          <div>
            <div className="brand-name" style={{ color: "var(--ink)" }}>
              APEX Assessment
            </div>
            <div className="brand-sub">Schneider Electric</div>
          </div>
        </div>
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">
          Strategic Account Manager capability assessment. Access is granted by your administrator.
        </p>
        {error && <div className="form-error">Invalid username or password.</div>}
        <form action={login}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input className="input" id="username" name="username" autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} type="submit">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

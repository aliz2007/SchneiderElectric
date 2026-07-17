import { requireSuperadmin } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listAMs, listUsers } from "@/lib/queries";
import { LENS_LABELS, type Lens } from "@/lib/seed-data";
import {
  clearAllRatings,
  createUser,
  loadDemoData,
  resetPassword,
  toggleActive,
  updateAssignments,
} from "./actions";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await requireSuperadmin();
  const { ok, err } = await searchParams;
  const users = listUsers();
  const ams = listAMs();
  const db = getDb();

  const assignmentRows = db.prepare("SELECT user_id, am_id FROM assignments").all() as {
    user_id: number;
    am_id: number;
  }[];
  const assignmentsByUser = new Map<number, Set<number>>();
  for (const r of assignmentRows) {
    if (!assignmentsByUser.has(r.user_id)) assignmentsByUser.set(r.user_id, new Set());
    assignmentsByUser.get(r.user_id)!.add(r.am_id);
  }

  return (
    <div>
      <div className="page-head">
        <div className="page-kicker">Administration</div>
        <h1 className="page-title">Users & Access</h1>
        <p className="page-sub">
          Provision evaluators and control what they can see. Assessors only ever see their own
          assessment tasks — analysis and other people&apos;s ratings are superadmin-only.
        </p>
      </div>

      {ok && <div className="form-ok">✓ {ok}</div>}
      {err && <div className="form-error">{err}</div>}

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Create user</h2>
        <p className="card-sub">
          Pick the lens for assessors: Self (a KAM rating themselves), Manager, or APEX Panel. Then
          tick which Account Managers they will assess.
        </p>
        <form action={createUser}>
          <div className="form-grid">
            <div className="field">
              <label>Full name</label>
              <input className="input" name="displayName" placeholder="e.g. Mohamed Marzouk" required />
            </div>
            <div className="field">
              <label>Username</label>
              <input className="input" name="username" placeholder="e.g. mmarzouk" required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" name="password" type="text" placeholder="min 6 characters" required />
            </div>
            <div className="field">
              <label>Role</label>
              <select className="input" name="role" defaultValue="assessor">
                <option value="assessor">Assessor</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
            <div className="field">
              <label>Lens (for assessors)</label>
              <select className="input" name="lens" defaultValue="">
                <option value="">—</option>
                <option value="self">Self (KAM)</option>
                <option value="manager">Manager</option>
                <option value="expert">APEX Panel</option>
              </select>
            </div>
          </div>
          <details className="details-box">
            <summary>Assign Account Managers to assess</summary>
            <div className="details-inner">
              <div className="check-grid">
                {ams.map((am) => (
                  <label key={am.id}>
                    <input type="checkbox" name="am" value={am.id} />
                    {am.code} · {am.name}
                  </label>
                ))}
              </div>
            </div>
          </details>
          <button className="btn btn-primary" style={{ marginTop: 14 }} type="submit">
            Create user
          </button>
        </form>
      </div>

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Users</h2>
        <div className="hm-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Lens</th>
                <th>Assigned AMs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const assigned = assignmentsByUser.get(u.id) ?? new Set<number>();
                return (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>
                      {u.display_name}
                      {u.id === me.id && <span className="badge badge-gray" style={{ marginLeft: 6 }}>you</span>}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{u.username}</td>
                    <td>
                      {u.role === "superadmin" ? (
                        <span className="badge badge-lens">Superadmin</span>
                      ) : (
                        <span className="badge badge-gray">Assessor</span>
                      )}
                    </td>
                    <td>{u.lens ? LENS_LABELS[u.lens as Lens] : "—"}</td>
                    <td>
                      <details className="details-box" style={{ marginTop: 0 }}>
                        <summary>{assigned.size} assigned</summary>
                        <div className="details-inner">
                          <form action={updateAssignments.bind(null, u.id)}>
                            <div className="check-grid">
                              {ams.map((am) => (
                                <label key={am.id}>
                                  <input
                                    type="checkbox"
                                    name="am"
                                    value={am.id}
                                    defaultChecked={assigned.has(am.id)}
                                  />
                                  {am.code} · {am.name}
                                </label>
                              ))}
                            </div>
                            <button className="btn btn-sm btn-outline" type="submit">
                              Save assignments
                            </button>
                          </form>
                        </div>
                      </details>
                    </td>
                    <td>
                      {u.active ? (
                        <span className="badge badge-green">Active</span>
                      ) : (
                        <span className="badge badge-red">Disabled</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {u.id !== me.id && (
                          <form action={toggleActive.bind(null, u.id)}>
                            <button className="btn btn-sm btn-outline" type="submit">
                              {u.active ? "Disable" : "Enable"}
                            </button>
                          </form>
                        )}
                        <details className="details-box" style={{ marginTop: 0 }}>
                          <summary>Reset password</summary>
                          <div className="details-inner">
                            <form action={resetPassword.bind(null, u.id)} style={{ display: "flex", gap: 8 }}>
                              <input className="input" name="password" type="text" placeholder="New password" style={{ width: 160 }} />
                              <button className="btn btn-sm btn-primary" type="submit">Set</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad">
        <h2 className="card-title">Data tools</h2>
        <p className="card-sub">
          For demos and testing. <strong>Load demo dataset</strong> fills all 75 assessments with
          plausible submitted scores so you can explore the dashboards — it replaces any existing
          ratings.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <form action={loadDemoData}>
            <button className="btn btn-outline" type="submit">Load demo dataset</button>
          </form>
          <form action={clearAllRatings}>
            <button className="btn btn-danger" type="submit">Clear all ratings</button>
          </form>
        </div>
      </div>
    </div>
  );
}

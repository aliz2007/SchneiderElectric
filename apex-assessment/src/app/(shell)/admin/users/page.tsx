import { requireSuperadmin } from "@/lib/session";
import { getDb } from "@/lib/db";
import { listAMs, listUsers } from "@/lib/queries";
import { LENS_LABELS, type Lens } from "@/lib/seed-data";
import {
  clearAllRatings,
  createSandboxAssessors,
  deleteUser,
  loadDemoData,
  resetPassword,
  toggleActive,
  updateAssignments,
  updateLens,
} from "./actions";
import CreateUserForm from "./create-user-form";

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
          assessment tasks. Analysis and other people&apos;s ratings are superadmin-only.
        </p>
      </div>

      {ok && <div className="form-ok">✓ {ok}</div>}
      {err && <div className="form-error">{err}</div>}

      <div className="card card-pad" style={{ marginBottom: 22 }}>
        <h2 className="card-title">Create user</h2>
        <p className="card-sub">
          Pick a lens for assessors: <strong>Self</strong> (a KAM rating themselves),{" "}
          <strong>Manager</strong>, or <strong>APEX Panel</strong>, then link the right Account
          Manager(s). The picker below changes to match the lens.
        </p>
        <CreateUserForm ams={ams} />
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
                    <td>
                      <details className="details-box" style={{ marginTop: 0 }}>
                        <summary>{u.lens ? LENS_LABELS[u.lens as Lens] : "none"}</summary>
                        <div className="details-inner">
                          <form
                            action={updateLens.bind(null, u.id)}
                            style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                          >
                            <select className="input" name="lens" defaultValue={u.lens ?? ""} style={{ maxWidth: 170 }}>
                              <option value="">None (admin only)</option>
                              <option value="self">Self</option>
                              <option value="manager">Manager</option>
                              <option value="expert">APEX Panel</option>
                            </select>
                            <button className="btn btn-sm btn-outline" type="submit">Save</button>
                          </form>
                          <p className="card-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                            Give a superadmin a lens so they can also assess people they are assigned.
                          </p>
                        </div>
                      </details>
                    </td>
                    <td>
                      <details className="details-box" style={{ marginTop: 0 }}>
                        <summary>
                          {u.lens === "self"
                            ? assigned.size === 1
                              ? "Own profile"
                              : "Not linked"
                            : `${assigned.size} assigned`}
                        </summary>
                        <div className="details-inner">
                          {u.lens === "self" ? (
                            <form action={updateAssignments.bind(null, u.id)}>
                              <label className="assign-label" style={{ display: "block", marginBottom: 6 }}>
                                This person&apos;s own Account Manager profile
                              </label>
                              <select
                                className="input"
                                name="am"
                                defaultValue={[...assigned][0] ?? ""}
                                style={{ maxWidth: 280 }}
                              >
                                <option value="">none</option>
                                {ams.map((am) => (
                                  <option key={am.id} value={am.id}>
                                    {am.code} · {am.name}
                                  </option>
                                ))}
                              </select>
                              <div>
                                <button className="btn btn-sm btn-outline" type="submit" style={{ marginTop: 8 }}>
                                  Save
                                </button>
                              </div>
                            </form>
                          ) : (
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
                          )}
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
                        {u.id !== me.id && (
                          <details className="details-box" style={{ marginTop: 0 }}>
                            <summary>Delete</summary>
                            <div className="details-inner">
                              <p className="card-sub" style={{ marginBottom: 8 }}>
                                Permanently removes <strong>{u.display_name}</strong> and their login.
                                Any assessments they submitted are kept (their name is just unlinked).
                                This can&apos;t be undone.
                              </p>
                              <form action={deleteUser.bind(null, u.id)}>
                                <button className="btn btn-sm btn-danger" type="submit">
                                  Confirm delete
                                </button>
                              </form>
                            </div>
                          </details>
                        )}
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
          For demos and testing.
        </p>
        <ul className="tool-notes">
          <li>
            <strong>Create test sandbox</strong> makes three ready-to-use logins
            (<code>self.demo</code>, <code>manager.demo</code>, <code>panel.demo</code>, password{" "}
            <code>demo1234</code>), all pointed at one Account Manager with a <em>blank</em>{" "}
            assessment. Log in as each to experience assessing from every lens, then come back as
            superadmin to compare them and export the PDF.
          </li>
          <li>
            <strong>Load demo dataset</strong> fills all 75 assessments with plausible{" "}
            <em>already-submitted</em> scores so the dashboards and heat maps have data. Good for
            exploring analysis, not for practising the assessment flow. Replaces existing ratings.
          </li>
        </ul>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
          <form action={createSandboxAssessors}>
            <button className="btn btn-primary" type="submit">Create test sandbox</button>
          </form>
          <form action={loadDemoData}>
            <button className="btn btn-outline" type="submit">Load demo dataset (submitted)</button>
          </form>
          <form action={clearAllRatings}>
            <button className="btn btn-danger" type="submit">Clear all ratings</button>
          </form>
        </div>
      </div>

    </div>
  );
}

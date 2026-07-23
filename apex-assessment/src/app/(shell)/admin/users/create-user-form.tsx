"use client";

import { useState } from "react";
import { createUser } from "./actions";

type AmOption = { id: number; code: string; name: string };

/**
 * Create-user form. The Account-Manager picker adapts to the chosen lens:
 *  - Self  → a brand-new person (they fill their own details on first sign-in), or link
 *            an existing Account Manager.
 *  - Manager / APEX Panel → tick every Account Manager they will assess.
 *  - Superadmin → may also take a lens, so an admin who also assesses gets the assessment
 *    window; leave the lens blank for an admin who only manages and views analytics.
 */
export default function CreateUserForm({ ams }: { ams: AmOption[] }) {
  const [role, setRole] = useState("assessor");
  const [lens, setLens] = useState("");
  const [selfMode, setSelfMode] = useState<"new" | "existing">("new");

  const isSelf = lens === "self";
  const isEvaluator = lens === "manager" || lens === "expert";

  return (
    <form action={createUser}>
      <div className="form-grid">
        <div className="field">
          <label>Full name</label>
          <input className="input" name="displayName" placeholder="e.g. Alex Carter" required />
        </div>
        <div className="field">
          <label>Username</label>
          <input className="input" name="username" placeholder="e.g. acarter" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input className="input" name="password" type="text" placeholder="min 6 characters" required />
        </div>
        <div className="field">
          <label>Role</label>
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="assessor">Assessor</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>
        <div className="field">
          <label>Lens{role === "superadmin" ? " (optional)" : ""}</label>
          <select className="input" name="lens" value={lens} onChange={(e) => setLens(e.target.value)}>
            <option value="">{role === "superadmin" ? "— none (admin only) —" : "— choose a lens —"}</option>
            <option value="self">Self (the KAM rating themselves)</option>
            <option value="manager">Manager</option>
            <option value="expert">APEX Panel</option>
          </select>
        </div>
      </div>

      {role === "superadmin" && lens === "" && (
        <p className="card-sub" style={{ marginTop: 4 }}>
          Superadmins manage the campaign and see analytics. Give a lens only if this admin will also
          assess people.
        </p>
      )}
      {role === "assessor" && lens === "" && (
        <p className="card-sub" style={{ marginTop: 4 }}>
          Choose a lens to link this assessor to the right Account Manager(s).
        </p>
      )}

      {isSelf && (
        <div style={{ marginTop: 4, maxWidth: 520 }}>
          <label className="assign-label" style={{ display: "block", marginBottom: 8 }}>
            This self-assessor is
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
              <input
                type="radio"
                name="selfmode"
                checked={selfMode === "new"}
                onChange={() => setSelfMode("new")}
                style={{ accentColor: "var(--se-green)", marginTop: 3 }}
              />
              <span>
                A <strong>new person</strong> — they fill in their region and other details themselves
                on their first sign-in.
              </span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
              <input
                type="radio"
                name="selfmode"
                checked={selfMode === "existing"}
                onChange={() => setSelfMode("existing")}
                style={{ accentColor: "var(--se-green)", marginTop: 3 }}
              />
              <span>An existing Account Manager already in the system.</span>
            </label>
          </div>
          {selfMode === "new" ? (
            <input type="hidden" name="am_new" value="1" />
          ) : (
            <select className="input" name="am" defaultValue="" required style={{ maxWidth: 320 }}>
              <option value="" disabled>
                — select their profile —
              </option>
              {ams.map((am) => (
                <option key={am.id} value={am.id}>
                  {am.code} · {am.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {isEvaluator && (
        <div style={{ marginTop: 4 }}>
          <label className="assign-label" style={{ display: "block", marginBottom: 6 }}>
            Account Managers this evaluator will assess
          </label>
          <div className="details-box" style={{ marginTop: 0 }}>
            <div className="details-inner" style={{ borderTop: "none" }}>
              <div className="check-grid">
                {ams.map((am) => (
                  <label key={am.id}>
                    <input type="checkbox" name="am" value={am.id} />
                    {am.code} · {am.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className="card-sub" style={{ marginTop: 6, marginBottom: 0 }}>
            Tick everyone they should evaluate. Assessors can also add people themselves later.
          </p>
        </div>
      )}

      <button className="btn btn-primary" style={{ marginTop: 16 }} type="submit">
        Create user
      </button>
    </form>
  );
}

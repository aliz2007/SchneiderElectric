"use client";

import { useState } from "react";
import { createUser } from "./actions";

type AmOption = { id: number; code: string; name: string };

/**
 * Create-user form. The Account-Manager picker adapts to the chosen lens so the
 * meaning is unambiguous:
 *  - Self  → pick the ONE Account Manager that IS this person (their own profile).
 *  - Manager / APEX Panel → tick every Account Manager they will assess.
 *  - Superadmin → no picker (superadmins don't assess).
 */
export default function CreateUserForm({ ams }: { ams: AmOption[] }) {
  const [role, setRole] = useState("assessor");
  const [lens, setLens] = useState("");

  const isAssessor = role === "assessor";
  const isSelf = isAssessor && lens === "self";
  const isEvaluator = isAssessor && (lens === "manager" || lens === "expert");

  return (
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
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="assessor">Assessor</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </div>
        {isAssessor && (
          <div className="field">
            <label>Lens</label>
            <select className="input" name="lens" value={lens} onChange={(e) => setLens(e.target.value)}>
              <option value="">— choose a lens —</option>
              <option value="self">Self (the KAM rating themselves)</option>
              <option value="manager">Manager</option>
              <option value="expert">APEX Panel</option>
            </select>
          </div>
        )}
      </div>

      {/* AM picker adapts to the lens */}
      {!isAssessor && (
        <p className="card-sub" style={{ marginTop: 4 }}>
          Superadmins manage the campaign and see analysis — they don&apos;t assess anyone, so no
          Account Manager link is needed.
        </p>
      )}

      {isAssessor && lens === "" && (
        <p className="card-sub" style={{ marginTop: 4 }}>
          Choose a lens above to link this assessor to the right Account Manager(s).
        </p>
      )}

      {isSelf && (
        <div className="field" style={{ marginTop: 4, maxWidth: 460 }}>
          <label>Which Account Manager is this person? (their own profile)</label>
          <select className="input" name="am" defaultValue="" required>
            <option value="" disabled>
              — select this person&apos;s own profile —
            </option>
            {ams.map((am) => (
              <option key={am.id} value={am.id}>
                {am.code} · {am.name}
              </option>
            ))}
          </select>
          <p className="card-sub" style={{ marginTop: 6, marginBottom: 0 }}>
            A self-assessor only ever fills in their own assessment, so they are linked to exactly one
            Account Manager — themselves. On login they land straight on it.
          </p>
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

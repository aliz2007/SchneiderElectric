# APEX Assessment · Schneider Electric

Digital assessment tool for the **APEX TOP 25** Strategic Account Managers — the web-app
replacement for the Excel workbook. Evaluators rate **22 capabilities** on the **L1/L2/L3**
scale through **3 lenses** (Self, Manager, APEX Panel); HR gets live analysis: individual
comparisons, perception gaps, and **training-needs heat maps** per zone (MEA, SAM, India,
Pacific).

The capability rubric and the 25-AM roster were seeded 1:1 from the source workbook.
**All ratings are created and stored in the app** — the Excel is retired.

## Launch

```bash
cd apex-assessment
npm install
npm run dev
```

Open **http://localhost:3000** and sign in as the seeded superadmin:

| Username   | Password   |
| ---------- | ---------- |
| `vladimir` | `apex2026` |

> ⚠️ Change this password after first login (Users & Access → Reset password).
> The SQLite database is created automatically at `data/apex.db` on first run —
> no external services needed. For production: `npm run build && npm start`.

## How it works

**Roles & confidentiality (enforced server-side):**

- **Superadmin** (Vladimir) — provisions users, assigns who assesses whom, sees all
  analysis. *Only superadmins can see ratings — assessments are confidential.*
- **Assessor** — has one lens (Self / Manager / APEX Panel) and a list of assigned AMs.
  Sees **only their own** assessment tasks: never other evaluators' scores, and never
  the required levels (hidden during rating to avoid anchoring bias, per the project brief).

**Flow:**

1. Vladimir creates users in **Users & Access** (lens + assigned AMs) and shares credentials.
2. Evaluators sign in → guided wizard: one capability at a time with its behavioural
   anchors inline, keyboard shortcuts (1/2/3, arrows), notes/evidence, autosave, then
   review & submit (submission locks the assessment; superadmin can reopen).
3. HR/superadmin reads the results:
   - **Dashboard** — completion KPIs, *recommended training focus*, and the
     capability × zone heat map (avg APEX Panel score vs required level).
   - **Zone views** — AM × capability heat map per region (track-aware requirements).
   - **Individuals** — Self vs Manager vs Panel side by side, gap to required level,
     strengths, development areas, perception gaps, and evaluators' evidence notes.

**Demo:** Users & Access → *Load demo dataset* fills all 75 assessments with plausible
scores so the dashboards can be explored immediately (*Clear all ratings* undoes it).

## Stack

Next.js 15 (App Router, server actions) · React 19 · SQLite via better-sqlite3 (single
file, zero infra; swap for Postgres if scaling out) · scrypt-hashed passwords, httpOnly
DB-backed sessions · no client-side data caches — every page render re-checks the session
and role.

```
src/lib          db.ts (schema + seed) · queries.ts (data + analysis) · session.ts · auth.ts
src/app/login    sign-in
src/app/(shell)  rate/            assessor task list + rating wizard
                 analysis/        dashboard · individuals · am/[id] · zone/[zone]
                 admin/users      provisioning, assignments, data tools
```

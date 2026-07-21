# HANDOFF — APEX Assessment (Schneider Electric)

**Purpose:** complete context archive. Any person or AI should be able to continue this
project using ONLY this repository — no external files, no prior conversation. If you are
an AI picking this up cold, read this file top to bottom first; it describes the product,
the data model, every feature, the architecture, how to run and test, and the decisions
behind it all.

Last updated: 2026-07-21.

---

## 1. Current state

- The app is complete and working, in `apex-assessment/`. Next.js 15 + SQLite, no external
  infrastructure required.
- Repo: `https://github.com/aliz2007/SchneiderElectric.git`.
- Active development branch: `claude/self-assessor-assessment-notes-en8uo1`.
- `npm run build` passes and the Playwright suite `e2e/smoke.mjs` is at **36/36**.
- Everything described below is implemented and pushed unless a line explicitly says it is
  not built yet (see §11 Open items).

## 2. The project

Schneider Electric replaced an Excel workbook used to assess the **APEX TOP 25
Strategic / Key Account Managers (KAMs)** with this web app. Goals from the client brief:
digitalize and simplify the assessment, improve the experience versus Excel, get a clear
view of each KAM's capability mastery, surface gaps between evaluators, feed development
and training plans, and consolidate results per individual and per geographic zone.

### Source materials (archived in this repo)

- `docs/source-materials/Brief-projet-Assessment.pdf` — 2-page project brief (French).
- `docs/source-materials/APEX_AM_Assesment140726-TEMPLATE-INSTRUCTIONS-ORDRE.xlsx` — the
  original Excel workbook (template version, ratings empty). Its "Capability Guide" tab
  holds the rubric; its "Consolidation" tab holds the roster; there is also a "Cover" tab.

Everything data-relevant from the workbook is embedded 1:1 in
`apex-assessment/src/lib/seed-data.ts`. The Excel has NO separate capability-definition
column: it labels the L1/L2/L3 behavioural anchors themselves as the "Capability
Definitions". That is why the PDF's capability definitions reuse those anchors.

### The assessment model

- **22 capabilities** in **6 clusters** (a.k.a. themes), each with written **L1 / L2 / L3
  behavioural anchors**. Levels are numeric: L1 Developing = 1, L2 Proficient = 2,
  L3 Advanced = 3. Full anchor texts live in `src/lib/seed-data.ts`.
- The 6 clusters: Account Strategy & Planning, Commercial & Sales Excellence, Executive &
  Customer Leadership, Offer/Segment & Solution Expertise, Acquisition Excellence,
  Saturation Excellence.
- **3 assessment lenses** per AM: **Self** (the KAM), **Manager**, **APEX Panel** (panel of
  Global Account Managers & Segment Leaders). In code the panel lens is called `expert`.
  The APEX Panel is the authoritative score used in analytics.
- Each AM has a **track**, Acquisition or Saturation, which sets the **required level** per
  capability. 4 capabilities apply only to Acquisition (Pipeline Shaping, Competitive
  Positioning, White-Space Penetration, Preferred Partner Positioning); 3 only to
  Saturation (Share of Wallet Expansion, Retention & Loss Prevention, Software & Services
  Attach). Required level is L2 for everything except L3 for Account Management (both
  tracks), Pipeline Shaping (Acquisition), and Share of Wallet Expansion (Saturation).
- **25 AMs across 4 zones**: MEA (AM01–06), SAM (AM07–12), India (AM13–18),
  Pacific (AM19–25). Roster in `src/lib/seed-data.ts`.
- **11 of 25 names are placeholders** ("Account Manager 1", 13–18, 22–25) because the Excel
  itself had placeholder tabs. Real names exist for AM02–AM12 and AM19–AM21. The user has
  not yet provided the missing names.

### Hard product rules (enforced server-side — keep them)

1. Evaluators must NEVER see other evaluators' scores (blind assessment).
2. Required levels are HIDDEN during rating to avoid anchoring bias; shown only in analysis.
3. Individual results and analysis are superadmin-only. The shared dashboard (zone-level,
   no individuals) is visible to any signed-in user.
4. The app is the system of record. Rubric + roster were seeded once from the Excel; all
   ratings are created in the app. The Excel is retired.

## 3. Architecture

- **Next.js 15 App Router**, React 19, TypeScript. Server Components render pages; all
  mutations are **Server Actions** (the `actions.ts` files). Every action re-checks the
  caller's role/lens before touching the DB, so confidentiality holds even if the UI is
  bypassed.
- **SQLite via `better-sqlite3`** (synchronous). The DB file is `data/apex.db`, created and
  seeded automatically on first run (`src/lib/db.ts`): rubric (22 capabilities), roster
  (25 AMs), and one superadmin. A single global connection is cached on `globalThis`.
- **Auth** (`src/lib/session.ts`, `src/lib/auth.ts`): scrypt password hashes; sessions
  stored in the DB behind an httpOnly cookie (`apex_session`, 30-day). Helpers:
  `getCurrentUser`, `requireUser`, `requireSuperadmin` (used on pages AND in actions).
- **PDF** via `@react-pdf/renderer`, rendered server-side on request.
- **AI (optional)**: Kimi / Moonshot via its OpenAI-compatible HTTP API (`fetch`), see §6.
- No other external services. Analytics read **submitted** assessments only; drafts stay
  private to their author.

### Data model (all tables in `src/lib/db.ts`)

- `users` (id, username unique nocase, password_hash, display_name, role
  ['superadmin'|'assessor'], lens ['self'|'manager'|'expert'|null], active, created_at).
- `sessions` (token PK, user_id, expires_at).
- `account_managers` (id, code unique, name, account, zone ['MEA'|'SAM'|'India'|'Pacific'],
  track ['Acquisition'|'Saturation']).
- `capabilities` (id, ord, name, cluster, src, req_acq, req_sat, l1, l2, l3).
- `assignments` (user_id, am_id) — which AMs a user is linked to. For self assessors this is
  the one AM that IS them; for manager/panel it is who they evaluate. PK (user_id, am_id).
- `assessments` (id, am_id, lens, rater_user_id, status ['draft'|'submitted'], updated_at,
  submitted_at). **UNIQUE (am_id, lens)** — one assessment per AM per lens.
- `ratings` (assessment_id, capability_id, level [1|2|3|null], note). PK (assessment_id,
  capability_id). NOTE: the per-capability `note` column still exists but is no longer
  written by the wizard; notes are now per-theme (see `theme_notes`).
- `theme_notes` (assessment_id, cluster, note). PK (assessment_id, cluster). One free-text
  note per theme, written only by Manager / APEX Panel.

## 4. Features and routes

- **Login** (`/login`): superadmin lands on `/analysis`, assessors on `/rate`.
  Seeded superadmin: `vladimir` / `apex2026`.
- **Rating** (`/rate`, `/rate/[amId]`):
  - Manager / APEX Panel assessors build their task list by typing a name (self-assign), or
    the admin pre-assigns. One evaluator per AM per lens (enforced).
  - **Self assessors** are the exception: `/rate` redirects them straight to their own
    assessment (`/rate/[their single linked AM]`); no pick-someone list; self-assign is
    refused server-side; if no AM is linked they see a banner explaining the admin must link
    their profile.
  - **Wizard** (`/rate/[amId]`): one capability per screen with the L1/L2/L3 anchors inline,
    keyboard shortcuts (1/2/3 to rate, arrows to move), 700 ms debounced autosave, progress
    dots, a review screen, then submit which locks the assessment. Required levels are never
    sent to the client. Superadmin can reopen a submitted assessment from the individual
    analysis page.
  - **Theme notes**: Manager and APEX Panel capture one note per theme (cluster), editable
    in-context on each capability screen and all together on the review screen. Self
    assessments capture no notes (enforced in `saveThemeNote`).
- **Analysis**:
  - `/analysis` (any signed-in user): completion KPIs including "Avg APEX maturity" shown as
    a rounded level (L1/L2/L3) with the exact average in the sub-note; an interactive
    geographic zone performance map; a thermal zone map with a capability filter; a
    recommended training focus; and a capability x zone heat map (avg APEX Panel score minus
    required level).
  - `/analysis/zone/[zone]` (superadmin): AM x capability heat maps, track-aware.
  - `/analysis/individuals` + `/analysis/am/[id]` (superadmin): Self vs Manager vs Panel per
    capability, gap-to-required, strengths, development areas, perception gaps
    (|self - panel| >= 1), and the Manager/Panel theme notes shown under each theme inside
    the capability detail. An **Export PDF** button.
- **PDF report** (`GET /analysis/am/[id]/pdf`, superadmin-only): a styled 4-page report
  (`src/lib/pdf-report.tsx`): (1) cover, (2) overview = profile + strengths/development +
  perception gaps, (3) narrative = per-person strengths/weaknesses prose + a definition of
  every capability it names, (4) capability-detail table with theme notes. See §5–6 for how
  the narrative and definitions are produced.
- **Admin — Users & Access** (`/admin/users`, superadmin):
  - Create user with a **lens-aware picker** (`create-user-form.tsx`): Self shows a
    single-select "which Account Manager is this person"; Manager/Panel show a checkbox grid
    of who they assess; Superadmin shows none.
  - Users table: edit assignments, enable/disable, reset password, and **Delete** (with a
    confirm step; guards: cannot delete yourself or the last superadmin; sessions and
    assignments cascade, submitted assessments are kept with rater set NULL).
  - Data tools: **Create test sandbox** (three blank-draft logins `self.demo` /
    `manager.demo` / `panel.demo`, password `demo1234`, all on the first AM, for trying the
    flow from every lens; idempotent), **Load demo dataset (submitted)** (fills all 75
    assessments with plausible submitted scores for the dashboards; replaces existing
    ratings), and **Clear all ratings**.

## 5. The PDF narrative (deterministic)

`src/lib/report-narrative.ts` builds the narrative page from data alone (no LLM): a factual
summary, a strengths paragraph, a development paragraph, an optional self-vs-panel
perception paragraph, and a list of capability definitions. Each definition is the rubric
behavioural anchor at the level the AM's track requires (an L2 reference when the capability
is not on the AM's track). When the panel has not scored the person, the prose falls back to
cautious "provisional" wording rather than inventing strengths. This deterministic output is
always the fallback for the AI path.

## 6. The PDF narrative (optional AI, Kimi / Moonshot)

`src/lib/ai-narrative.ts` can have Kimi write the three prose sections instead (strength /
development / self-perception vs panel). It is a pure enhancement with a hard fallback:

- Attempted only when a key is configured AND the panel has scored the person.
- On ANY failure (no key, network blocked, non-200, bad/empty JSON, timeout) it returns
  `null` and the route keeps the deterministic narrative. PDF export never depends on the
  external call.
- The model is prompted (see `SYSTEM_PROMPT`) to ground every statement in the provided
  scores, theme-note comments and definitions, to never quote the definitions, and to return
  strict JSON `{strength, development, perception}`. Capability definitions on the page stay
  deterministic (rubric-based) regardless.
- Config comes from the environment; the code reads it and never hardcodes a key:
  - `MOONSHOT_API_KEY` (required to enable AI), `MOONSHOT_BASE_URL`
    (default `https://api.moonshot.ai/v1`; use `.cn` for the China platform),
    `MOONSHOT_MODEL` (default `moonshot-v1-8k`; can be `kimi-k2-0711-preview` / `kimi-latest`),
    `MOONSHOT_TIMEOUT_MS` (default 20000), `MOONSHOT_ENABLED=0` to force-disable.
  - `apex-assessment/.env.example` documents these. The real key goes in
    `apex-assessment/.env.local`, which is git-ignored and must never be committed. (The
    platform's safety tooling also blocks pushing secrets.) To enable:
    `cp apex-assessment/.env.example apex-assessment/.env.local` then set the key.

## 7. Key files

```
src/lib/seed-data.ts         rubric (22 caps, L1/L2/L3 anchors) + 25-AM roster (1:1 from Excel)
src/lib/db.ts                schema + auto-seed (all 7 tables)
src/lib/queries.ts           all data access + analysis math (zoneHeatmap, trainingPriorities, theme notes)
src/lib/session.ts           getCurrentUser / requireUser / requireSuperadmin, cookie sessions
src/lib/auth.ts              scrypt hashing + session token
src/lib/report-narrative.ts  deterministic strengths/weaknesses prose + capability definitions
src/lib/ai-narrative.ts      optional Kimi (Moonshot) feedback, with graceful fallback
src/lib/pdf-report.tsx       4-page @react-pdf report (cover / overview / narrative / detail)
src/lib/heat.ts              heat-map colour helpers
src/app/login/               login page + action
src/app/(shell)/rate/        rating list + wizard + actions (ratings, theme notes, submit)
src/app/(shell)/analysis/    dashboard, zone view, individuals, am/[id], am/[id]/pdf route
src/app/(shell)/admin/users/ users page, lens-aware create-user-form, actions (incl. delete, sandbox)
src/app/globals.css          all styling (semantic class names)
src/app/fx.tsx               client-side scroll/hover effects
e2e/smoke.mjs                Playwright smoke suite (36 checks)
.env.example                 template for the optional AI key (.env.local is git-ignored)
```

## 8. How to run

```bash
cd apex-assessment
npm install
npm run dev          # http://localhost:3010 — login vladimir / apex2026
```

The dev port is 3010 (chosen so it does not collide with other localhost apps). Production:
`npm run build && npm start` (defaults to port 3000). To see analytics data, load the demo
dataset from Users & Access; to practise assessing, use Create test sandbox.

## 9. How to test

```bash
npm run build                         # production build + full type check
rm -rf data && npx next start -p 3111 # fresh DB, production server
node e2e/smoke.mjs                     # in a second shell — currently 36/36
```

The suite drives the real UI with Playwright: login, wrong-password, demo load, dashboard,
individual analysis, PDF export, zone view, assessor creation and confidentiality, the
rating wizard, theme notes end-to-end (wizard -> analysis -> PDF), the self-assessor direct
landing, the test sandbox, and account deletion. The e2e header comments explain the
`CHROMIUM` / `BASE` env vars. In this sandbox the Moonshot API is unreachable, so the PDF
tests exercise the deterministic fallback.

## 10. Path to production (not built, informational)

The app is fully functional but three things stand between it and a company-wide rollout:

1. **Storage**: SQLite is one file on the server's disk — perfect at this scale (25 KAMs,
   dozens of evaluators) but single-instance. Swap to Postgres for multiple app servers or
   managed backups. The data layer is centralized in `queries.ts`/`db.ts`, so this is a
   contained change.
2. **Auth**: username/password managed by the superadmin. Production would likely want SSO.
3. **Hosting**: currently runs locally (or via the Windows demo launcher). A real rollout
   needs deploying somewhere with a persistent disk/DB.

## 11. Open items

1. **11 placeholder AM names** — waiting on the user for the real names.
2. **Roster management is not built.** The 25 AMs come from the seed; there is no in-app way
   to add / edit / delete Account Managers or bulk-import them from CSV/Excel. This was
   discussed with the user (the roster was pre-loaded from the Excel, so no one hand-typed
   it) but not yet implemented. User account deletion IS built; AM (roster) CRUD is not.
3. **Production concerns** in §10 (Postgres / SSO / hosting) are unaddressed by design.
4. `demo.bat` sets `APEX_DEMO=1` but no code reads it (vestigial). Demo data loads from the
   admin button.

## 12. Decisions (do not relitigate without the user)

- SQLite is deliberate (zero infra); move to Postgres only if asked.
- v1 auth is username/password managed by the superadmin; SSO is a later concern.
- Theme notes (one per cluster, Manager/Panel only) **replaced** the old per-capability
  evidence note. Self assessments have no notes.
- The PDF narrative is deterministic by default and reproducible; Kimi is an optional
  enhancement layered on top, never a hard dependency.
- The AI key lives only in a git-ignored `.env.local`; it is never committed.

## 13. History (branches and the Windows demo)

- The project began on branch `claude/apex-assessment-ui-redesign-vr8uel`: the app + a dark
  "Apple-app feel" UI (glass/blur, Schneider green `#3DCD58` accent, springy easing, respects
  `prefers-reduced-motion`), a geographic zone map, a thermal zone map, self-service
  assignments, a shared dashboard, per-profile PDF export, and a `better-sqlite3` ^12 /
  `next` 15.5.20 bump that fixed a Windows demo install crash (no prebuilt binary for Node 24
  under the older version). If doing visual work, the look lives in `globals.css` (semantic
  class names) + `fx.tsx`; keep class names and visible text labels stable so `e2e/smoke.mjs`
  keeps passing, and rerun the suite after any redesign.
- Current branch `claude/self-assessor-assessment-notes-en8uo1` added: self-assessor direct
  landing, per-theme notes (wizard + analysis + PDF), the 4-page PDF (cover + narrative +
  definitions), the deterministic narrative and the optional Kimi integration, the lens-aware
  create-user form, the test sandbox, user account deletion, the dev port move to 3010, the
  "Avg APEX maturity" KPI as a rounded level, and this repo's README.
- `demo.bat` (repo root) is a double-click Windows launcher: installs Node LTS via winget if
  missing, downloads a branch zip, runs `npm ci` + `npm run build` when the zip changed, then
  `npm start -- -p 3000` and opens the browser. If you change which branch the demo ships,
  update the zip URL inside `demo.bat`.

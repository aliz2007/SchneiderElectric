# HANDOFF — APEX Assessment (Schneider Electric)

**Purpose:** complete context archive. Any person or AI should be able to continue this
project using ONLY this repository — no external files, no prior conversation. If you are
an AI picking this up cold, read this file top to bottom first; it describes the product,
the data model, every feature, the architecture, how to run and test, and the decisions
behind it all.

Last updated: 2026-07-23.

---

## 1. Current state

- The app is complete and working, in `apex-assessment/`. Next.js 15 + SQLite, no external
  infrastructure required.
- Repo: `https://github.com/aliz2007/SchneiderElectric.git`.
- Active development branch: `claude/self-assessor-assessment-notes-en8uo1`.
- `npm run build` passes and the Playwright suite `e2e/smoke.mjs` is green (see §9 for the
  current check count).
- Everything described below is implemented and pushed unless a line explicitly says it is
  not built yet (see §11 Open items).
- Most recent additions (2026-07-23): the demo roster now uses **fictional names** (legal —
  no real Schneider employees); the self-assessor justification is **one mandatory
  concrete-example note per theme** (a guided prompt — this replaced an earlier five-question
  variant); the PDF's perception section is now a **generated diverging over/under-rating
  chart**. Earlier this cycle (2026-07-22): a **mandatory one-note-per-theme** justification
  for every lens; a **business Segment** attribute on every account (picked at
  creation/onboarding) usable as an analytics filter and shown on the individual pages; a
  single **centralized Filters window** on the dashboard holding Track + Segment + map
  Capability; a **My Feedback** tab that releases each assessed person's own report once all
  three lenses have submitted; and strengths/development redefined strictly (strength =
  strictly above required, development = anything below). See the sections below and §14 (the
  parcours).

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
- Each AM also belongs to a **business segment**: Power & Grid, Energy & Chemicals,
  CS&P - Cloud & Service Providers, or Multi-segment (`SEGMENTS` in `seed-data.ts`). Segment
  is a first-class account attribute like zone and track: it is seeded on the 25-AM roster in
  `seed-data.ts`, a `db.ts` migration backfills it (by AM code, never overwriting a chosen
  value) on databases created before segments existed, and new accounts pick it at
  self-assessor onboarding / the admin create flow. It is shown on the individuals list and
  the individual detail header (a purple `badge-segment`), and is a reporting/filter dimension
  only — it does NOT change required levels (track does that).
- **The 25 roster names are FICTIONAL demo data** (`ROSTER` in `seed-data.ts`), not real
  Schneider employees — deliberately, to avoid using real people's names in the sample
  database. Any resemblance is coincidental. (The original Excel had some real-looking names;
  they were all replaced.) If the client later provides a real, cleared roster, edit `ROSTER`.

### Per-theme justification (the self-assessor's concrete example)

Every lens justifies each theme (cluster) with ONE mandatory free-text note, written in-context
under the level cards and required before the assessment can be submitted:

- **Self-assessors** get a guided prompt (`SELF_JUSTIFICATION_PROMPT` in `seed-data.ts`): "Please
  share a concrete example to support your rating. You can structure it as: situation, actions
  taken, results, impact — and, where relevant, how this could be replicated." It is one note,
  not five fields. (An earlier iteration split this into five separate framework questions;
  that was reverted to a single note at the user's request.)
- **Manager / APEX Panel** write a free justification note per theme.

All of these live in the `theme_notes.note` column (one row per assessment per cluster).
`themeJustificationText(row)` returns that note; it still falls back to the legacy five
framework columns if an old row only has those, so nothing pre-existing is lost.

### Hard product rules (enforced server-side — keep them)

1. Evaluators must NEVER see other evaluators' scores (blind assessment).
2. Required levels are HIDDEN during rating to avoid anchoring bias; shown only in analysis.
3. Individual results and analysis are superadmin-only. The shared dashboard (zone-level,
   no individuals) is visible to any signed-in user. EXCEPTION: the **My Feedback** tab lets
   an assessed self-assessor see their OWN consolidated report, but only after all three
   lenses have submitted (nothing about anyone else is exposed).
4. The app is the system of record. Rubric + roster were seeded once from the Excel; all
   ratings are created in the app. The Excel is retired.
5. Every theme must be justified before an assessment can be submitted: every lens writes one
   note per theme (self-assessors from a guided prompt). Enforced server-side in
   `unjustifiedThemes()` (called by `submit`).

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
  track ['Acquisition'|'Saturation'], profile_complete, segment [one of `SEGMENTS`; seeded on
  the roster and backfilled by migration, so effectively always set]).
- `capabilities` (id, ord, name, cluster, src, req_acq, req_sat, l1, l2, l3).
- `assignments` (user_id, am_id) — which AMs a user is linked to. For self assessors this is
  the one AM that IS them; for manager/panel it is who they evaluate. PK (user_id, am_id).
- `assessments` (id, am_id, lens, rater_user_id, status ['draft'|'submitted'], updated_at,
  submitted_at). **UNIQUE (am_id, lens)** — one assessment per AM per lens.
- `ratings` (assessment_id, capability_id, level [1|2|3|null], note). PK (assessment_id,
  capability_id). NOTE: the per-capability `note` column still exists but is no longer
  written by the wizard; notes are now per-theme (see `theme_notes`).
- `theme_notes` (assessment_id, cluster, note, situation, actions, results, impact,
  replication). PK (assessment_id, cluster). ONE row per theme per assessment. Every lens now
  fills `note` (self-assessors from a guided prompt, Manager/Panel free text). The five
  framework columns (situation/actions/results/impact/replication) are LEGACY — kept so any
  data saved during the brief five-question iteration still reads back, but no longer written.
  Columns are added by idempotent `ALTER TABLE … ADD COLUMN` migrations in `db.ts`. A row that
  becomes entirely empty is deleted (`saveThemeField`). Read helpers: `getThemeNotesFull`,
  `themeJustificationText`, `unjustifiedThemes`.
- `app_settings` (key PK, value) — runtime key/value store. Now holds only `moonshot_model`
  (the auto-selected working model) and `moonshot_last_result` (last PDF-AI outcome). The
  Kimi API key is HARDCODED in `ai-narrative.ts` (`EMBEDDED_KEY`), not stored here; there is
  no in-app AI settings card anymore.

A self-assessor is always linked to exactly ONE Account Manager (themselves).
`setAssignments` enforces this (it caps a self user's assignments to one), and both the
create-user form and the Users-table assignment editor use a single-select for the self
lens rather than a multi-checkbox.

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
  - **Per-theme justification (mandatory)**: below the level cards, each capability screen
    shows the justification block for that capability's theme (cluster) — one required note.
    For a **self-assessor** it is a bigger/wider text box carrying the guided prompt (a concrete
    example: situation, actions, results, impact, and where relevant replication). For a
    **Manager / APEX Panel** evaluator it is a single required note. Autosaved (700 ms
    debounce) via `saveThemeNote → saveThemeField`. The review screen shows a completion badge
    per theme, and **Submit is disabled** until every capability is rated AND every theme is
    justified; the server re-checks with `unjustifiedThemes()` and rejects an early submit.
- **Analysis**:
  - `/analysis` (any signed-in user): completion KPIs including "Avg APEX maturity" shown as
    a rounded level (L1/L2/L3) with the exact average in the sub-note; an interactive
    geographic zone performance map (superadmin only — it carries per-AM data); a recommended
    training focus; and a capability x zone heat map (avg APEX Panel score minus required
    level).
  - **Centralized Filters window** (`filter-bar.tsx`): one togglable "☰ Filters" button opens
    a panel with **Track** (All / Acquisition / Saturation), **Segment** (All + the four
    segments) and, for superadmins, the **map Capability** filter. All three drive URL search
    params (`track`, `segment`, `cap`), so the server re-scopes the zone map, training focus,
    heat map and roster together. An active-count badge and "Clear all" round it out. The old
    standalone track dropdown and the in-map capability dropdown were folded into this one
    window (the capability filter now re-colours the thermal map via the `capFilter` prop).
  - `/analysis/zone/[zone]` (superadmin): AM x capability heat maps, track-aware; the zone
    benchmark ranking can sort AMs and (for admins) shows each AM's name in a low-opacity font
    under their AM number.
  - `/analysis/individuals` + `/analysis/am/[id]` (superadmin): Self vs Manager vs Panel per
    capability, gap-to-required, **strengths (panel STRICTLY above required)**, **development
    areas (panel BELOW required — all of them, uncapped)**, perception gaps (|self - panel| >=
    1), and the theme justifications shown under each theme inside the capability detail. An
    **Export PDF** button. (A capability merely AT required is on the baseline — never a
    strength.)
  - **My Feedback** (`/feedback`, self-assessors only): the assessed person's own report —
    strengths, development areas, self-vs-panel perception gaps, a three-lens capability table
    with the theme justifications, and a **Download PDF** (the same PDF as the admin export).
    Gated by `allLensesSubmitted(am.id)`: until Self + Manager + APEX Panel have all submitted
    it shows a status checklist instead. The nav tab only appears for a linked self-assessor.
- **PDF report** (`GET /analysis/am/[id]/pdf`, superadmin-only): a styled 4-page report
  (`src/lib/pdf-report.tsx`): (1) cover, (2) overview = profile + strengths/development + a
  **perception-profile chart** (a diverging over/under-rating bar chart, `PerceptionChart`,
  drawn with @react-pdf SVG primitives — amber bars right = self over-rates vs the panel, blue
  bars left = under-rates, bar length = the gap in levels), (3) narrative = strengths/weaknesses
  prose + a definition of
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
  - There is NO in-app AI settings card: the Kimi key is hardcoded (see §6).

## 5. The PDF narrative (deterministic)

`src/lib/report-narrative.ts` builds the narrative page from data alone (no LLM): a factual
summary, a strengths paragraph, a development paragraph, an optional self-vs-panel
perception paragraph, and a list of capability definitions. Each definition is the rubric
behavioural anchor at the level the AM's track requires (an L2 reference when the capability
is not on the AM's track). When the panel has not scored the person, the prose falls back to
cautious "provisional" wording rather than inventing strengths. This deterministic output is
always the fallback for the AI path.

## 6. The PDF narrative (AI, Kimi / Moonshot)

`src/lib/ai-narrative.ts` has Kimi write the narrative sections. It is an enhancement with
a hard fallback:

- Attempted only when AI is enabled AND the panel has scored the person.
- On ANY failure (network blocked, non-200, bad/empty JSON, timeout) it returns `null` and
  the route keeps the deterministic narrative. PDF export never depends on the external call.
- Sections are `{strengths, development, comments}`. Strengths and development are organised
  BY CAPABILITY CLUSTER: one tight paragraph per cluster, led by the exact cluster name and
  a colon (the PDF bolds that lead — see `ClusterNarrative` in `pdf-report.tsx`). `comments`
  is a single paragraph synthesising the evaluators' theme justifications, and is empty
  (section hidden) when none exist. The model is prompted (see `SYSTEM_PROMPT`) to ground
  every statement in the provided data, never quote the rubric definitions, cover every
  qualifying capability, and stay concise. The prompt tells it that Manager/Panel notes are
  free text while a Self-Assessment note is a concrete example the person gives to justify their
  ratings (prompted to cover situation, actions, results, impact and, where relevant,
  replication) — their own evidence, to be weighed as their view, not the verdict.
  (`themeJustificationText` is what feeds these notes to the model.)
- THE KEY IS HARDCODED at the repo owner's explicit direction: `EMBEDDED_KEY` in
  `ai-narrative.ts` is the single place it lives, and it is read directly (no env fallback).
  There is no in-app AI settings card. Optional env overrides: `MOONSHOT_BASE_URL`,
  `MOONSHOT_MODEL`, `MOONSHOT_TIMEOUT_MS` (default 90000), `MOONSHOT_MAX_TOKENS` (default
  8000), and `MOONSHOT_ENABLED=0` to force-disable (used by the e2e run so tests stay
  hermetic).
- Model auto-fallback: default `kimi-latest`; if the key cannot use the configured model
  (Moonshot answers 404 resource_not_found), the call falls through `moonshot-v1-128k` then
  `moonshot-v1-32k`, uses the first that works and REMEMBERS it in `app_settings`
  (`moonshot_model`) so later calls skip the probing. Auth/rate-limit/network errors fail
  fast instead of cycling models.
- The reply parser tolerates real-world model output: markdown fences, trailing prose, raw
  newlines inside JSON strings, and a reply cut off by the token limit (repairJson closes
  open strings/braces). `sanitizeText` maps smart punctuation to ASCII and drops glyphs the
  PDF font cannot draw.
- Visibility: the narrative page is stamped with its source ("Written by Kimi (Moonshot AI)"
  vs "Generated automatically from the assessment data"), and the Export PDF button shows a
  "Kimi is writing…" state plus a verdict from the `X-AI-Source` / `X-AI-Reason` response
  headers. The last attempt's outcome is also stored in `app_settings.moonshot_last_result`.

## 6b. The APEX Assistant (in-app chatbot)

A floating chat bubble (bottom right, every page in the shell) opens a small window where
users ask quick questions over the live data ("which skill gaps repeat most in India",
"does X have a perception gap on Pipeline Shaping"). Pieces:

- `src/app/(shell)/chat-widget.tsx` — client widget (bubble, panel, example prompts).
  Mounted in the shell layout for every signed-in user.
- `src/app/api/chat/route.ts` — POST endpoint. Auth via `getCurrentUser()`; validates and
  caps the message history (12 messages, 4000 chars each); when `MOONSHOT_ENABLED=0` it
  returns a fixed "turned off" reply (the e2e asserts this deterministic round-trip).
- `src/lib/chat-data.ts` — `buildChatSnapshot(viewer)` rebuilds a fresh JSON snapshot of
  the database on EVERY question, so answers always reflect current data.
- ACCESS MIRRORS THE APP (hard rule): a superadmin's snapshot has everything (all lenses,
  required levels, gaps, theme justifications, segment, users and assignments). An assessor's
  snapshot contains ONLY their own work (their assigned people, their own ratings and
  justifications, drafts included) plus the dashboard's completion counts; required levels and
  other evaluators' scores are ABSENT from the payload, so the model cannot leak what it never
  receives. The system prompt also instructs the restricted variant to refuse such questions.
- The prompt is kept in step with the model: it explains segment as a dimension, and that
  per-theme justifications are one note per lens — a self-assessor's guided concrete example, or
  a manager/panel free note — to be quoted as evidence for "why" questions and never fabricated.
- Uses `kimiChat()` in `ai-narrative.ts` — same hardcoded key, same model auto-fallback.

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
src/lib/chat-data.ts         role-scoped live snapshot for the APEX Assistant chatbot
src/app/(shell)/rate/        rating list + wizard (framework/notes) + actions (ratings, theme fields, submit)
src/app/(shell)/analysis/    dashboard, filter-bar, zone-map, zone view, individuals, am/[id], am/[id]/pdf
src/app/(shell)/feedback/    My Feedback tab (self-assessor's own report + PDF download)
src/app/(shell)/onboarding/  new self-assessor profile form (name/account/zone/track/segment)
src/app/(shell)/chat-widget.tsx  floating APEX Assistant bubble + panel
src/app/api/chat/route.ts    chatbot endpoint (role-scoped snapshot + Kimi)
src/app/(shell)/admin/users/ users page, lens-aware create-user-form, actions (delete, sandbox, demo)
src/app/globals.css          all styling (semantic class names)
src/app/fx.tsx               client-side scroll/hover effects
e2e/smoke.mjs                Playwright smoke suite (see §9 for the check count)
.env.example                 optional AI overrides (the key itself is hardcoded, not in env)
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
npm run build                                    # production build + full type check
rm -f data/apex.db data/apex.db-shm data/apex.db-wal   # fresh DB
MOONSHOT_ENABLED=0 npm run start -- -p 3111       # production server, AI off (hermetic)
node e2e/smoke.mjs                                # in a second shell — currently 51/51
```

The suite drives the real UI with Playwright: login, wrong-password, demo load, dashboard,
the centralized Filters window, the APEX Assistant round-trip, individual analysis (incl. the
segment badge), PDF export, zone view, assessor creation and confidentiality, the rating
wizard, the mandatory per-theme justification note for BOTH the Manager (walking every theme)
and the self-assessor (the guided concrete-example prompt), justification end-to-end (wizard ->
analysis -> PDF), the self-assessor direct landing, onboarding (now incl. segment), the test
sandbox, and account
deletion. Run `MOONSHOT_ENABLED=0` so the AI is off and the run stays hermetic (deterministic
narrative, the chatbot returns its fixed "turned off" reply, no external call). The e2e header
comments explain the `CHROMIUM` / `BASE` env vars.

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

1. **The roster is fictional demo data.** All 25 names are made-up (deliberately — no real
   Schneider employees in the sample DB). A real, cleared roster would replace `ROSTER` in
   `seed-data.ts` (and/or arrive via the roster-management tooling below, which is not built).
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
- Justification is per-theme (one row per cluster), **replacing** the old per-capability
  evidence note. It is MANDATORY for all three lenses: one note per theme — self-assessors from
  a guided concrete-example prompt, Manager/APEX Panel free text. (A brief experiment split the
  self note into five separate framework questions; that was reverted to one note.)
- Strength vs development is strict: a strength is a capability where the panel is STRICTLY
  above required; anything below required is a development area (uncapped, all shown); AT
  required is the baseline and is neither.
- Segment is a filter/reporting dimension chosen at account creation; it does not affect
  required levels. All dashboard filters live in one centralized Filters window.
- The PDF narrative is deterministic by default and reproducible; Kimi is an optional
  enhancement layered on top, never a hard dependency.
- The Kimi API key is HARDCODED in `ai-narrative.ts` (`EMBEDDED_KEY`) at the repo owner's
  explicit, repeated direction, and read directly with no env fallback. (Earlier the key was
  env-only; that decision was overridden by the user.)

## 13. History (branches and the Windows demo)

- The project began on branch `claude/apex-assessment-ui-redesign-vr8uel`: the app + a dark
  "Apple-app feel" UI (glass/blur, Schneider green `#3DCD58` accent, springy easing, respects
  `prefers-reduced-motion`), a geographic zone map, a thermal zone map, self-service
  assignments, a shared dashboard, per-profile PDF export, and a `better-sqlite3` ^12 /
  `next` 15.5.20 bump that fixed a Windows demo install crash (no prebuilt binary for Node 24
  under the older version). If doing visual work, the look lives in `globals.css` (semantic
  class names) + `fx.tsx`; keep class names and visible text labels stable so `e2e/smoke.mjs`
  keeps passing, and rerun the suite after any redesign.
- Current branch `claude/self-assessor-assessment-notes-en8uo1` added, in order: self-assessor
  direct landing, per-theme notes (wizard + analysis + PDF), the 4-page PDF (cover + narrative
  + definitions), the deterministic narrative and the optional Kimi integration, the lens-aware
  create-user form, the test sandbox, user account deletion, the dev port move to 3010, the
  "Avg APEX maturity" KPI as a rounded level, this repo's README, the floating APEX Assistant
  chatbot (role-scoped), uniform-per-region zone colouring, the zone-benchmark AM names + track
  ranking, the strict strengths/development redefinition, the My Feedback tab, the Segment
  attribute + filter and centralized Filters window, and — most recently — fictional demo
  roster names (legal), the single guided concrete-example self-justification note per theme
  (which replaced a brief five-question variant), and the PDF perception-profile chart.
- `demo.bat` (repo root) is a double-click Windows launcher: installs Node LTS via winget if
  missing, downloads a branch zip, runs `npm ci` + `npm run build` when the zip changed, then
  `npm start -- -p 3000` and opens the browser. If you change which branch the demo ships,
  update the zip URL inside `demo.bat`.

## 14. Parcours (end-to-end user journeys)

How each kind of user moves through the app, start to finish. Use this as the quick mental
model; the sections above give the mechanics.

**A. Administrator (superadmin — `vladimir` / `apex2026`)**
1. Sign in → lands on **`/analysis`** (the dashboard).
2. First-time setup: **Users & Access** → *Load demo dataset* to populate the dashboards (or
   *Create test sandbox* to trial the flow), then create the real assessor logins with the
   lens-aware form (Self → single-select the account that IS the person; Manager / APEX Panel
   → check who they evaluate).
3. Monitor progress on the dashboard: completion KPIs, the **Filters** window (Track / Segment
   / map Capability), the zone performance map, training-focus list, and capability×zone heat
   map — all re-scope together from the filter URL params.
4. Drill in: **Individuals → an AM** for the three-lens comparison, strengths (strictly above
   required), development areas (all below), perception gaps and the per-theme justifications;
   **Export PDF** for the written report (Kimi-written when reachable, deterministic otherwise).
   Reopen a submitted assessment here if someone needs to edit it.
5. Ask the **APEX Assistant** (floating bubble) free-form questions over the full live data.

**B. Self-assessor (the KAM being assessed)**
1. Sign in. If their profile is not yet complete → **`/onboarding`**: name, account, region,
   track, and **segment**. Otherwise they go straight to their own assessment.
2. **`/rate/[their AM]`** opens directly (no picking anyone else; `/rate` just redirects here).
   For each of the 22 capabilities they pick L1/L2/L3 (required levels are hidden), and for
   each of the 6 themes they write **one concrete-example justification note** from the guided
   prompt (situation, actions, results, impact, and where relevant replication) — mandatory.
   Everything autosaves.
3. The review screen shows a completion badge per theme; **Submit** unlocks only once all 22
   are rated and all 6 themes are fully answered, then the assessment locks.
4. Once their Manager and the APEX Panel have also submitted, a **My Feedback** tab appears:
   their strengths, development areas, self-vs-panel perception gaps, the three-lens table with
   everyone's justifications, and a **Download PDF**. They can also use the Assistant, but it
   only ever sees their own scoped data.

**C. Manager / APEX Panel evaluator**
1. Sign in → **`/rate`**. Build the task list by typing a name to self-assign (or the admin
   pre-assigned them). One evaluator per AM per lens.
2. **`/rate/[amId]`**: rate the 22 capabilities and write ONE **mandatory justification note**
   per theme. Review → **Submit** (blocked until every theme has a note); the assessment locks.
3. They can view the shared dashboard, but never other evaluators' scores or individual
   results (those stay superadmin-only). The Assistant is fed only their own scoped data.

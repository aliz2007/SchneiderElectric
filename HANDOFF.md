# HANDOFF — APEX Assessment app (Schneider Electric)

Context transfer for a new Claude Code session. A previous session built this app but
pushed to the wrong repository. **Your first job: get this code into THIS repo, then
continue with the pending work below.**

## 1. What this project is

Schneider Electric wants a web app replacing an Excel workbook used to assess the
**APEX TOP 25 Strategic/Key Account Managers**. Source materials were a 2-page project
brief (PDF, French) and the workbook `APEX_AM_Assesment_140726` — both fully
reverse-engineered; everything relevant is already embedded in the code, the originals
are no longer needed.

The assessment model:
- **22 capabilities** in 6 clusters, each with written **L1/L2/L3 behavioural anchors**
  (L1 Developing = 1, L2 Proficient = 2, L3 Advanced = 3).
- **3 assessment lenses** per Account Manager: **Self**, **Manager**, **APEX Panel**
  (panel = the authoritative score used in analytics).
- Each AM has a **track** — *Acquisition* or *Saturation* — which determines the
  **required level** per capability (some capabilities don't apply to a track).
- 25 AMs across **4 zones**: MEA, SAM, India, Pacific.

Hard product rules from the client brief (already enforced server-side — keep them):
1. Evaluators must NEVER see other evaluators' scores (blind assessment).
2. Required levels must be HIDDEN during rating (anti-anchoring bias); they appear
   only in analysis.
3. Ratings are confidential: only superadmins see results/analysis.
4. The app is the system of record — rubric + roster were seeded from the Excel once;
   all ratings are created in-app. The Excel is retired.

## 2. What's in this zip

`apex-assessment/` — a complete, working **Next.js 15 (App Router) + React 19 +
better-sqlite3** app. No external services; SQLite DB auto-creates and auto-seeds at
`data/apex.db` on first run (rubric, 25 AMs, superadmin).

- **Login:** superadmin `vladimir` / `apex2026` (seeded; META: change-after-first-login).
- **Superadmin (Vladimir):** Users & Access page — creates users, sets role
  (superadmin/assessor), sets assessor lens (self/manager/expert), assigns which AMs
  each user rates, enable/disable, reset passwords. Data tools: **Load demo dataset**
  (fills all 75 assessments with plausible submitted scores — great for demos) and
  Clear all ratings.
- **Assessor flow:** `/rate` task list → guided wizard: one capability per screen,
  rubric anchors inline, keyboard shortcuts (1/2/3, ←/→), notes/evidence field,
  autosave (700ms debounce on notes), progress dots, review screen, submit → locks.
  Superadmin can reopen a submitted assessment (individual analysis page, bottom).
- **Analysis (superadmin only):** `/analysis` dashboard — completion KPIs,
  "Recommended training focus" (worst zone×capability deficits), **training-needs
  heat map** (capability × zone, colored by avg APEX score minus required level);
  `/analysis/zone/[zone]` AM×capability heat maps; `/analysis/individuals` +
  `/analysis/am/[id]` — Self vs Manager vs Panel comparison, gap-to-required,
  strengths, development areas, perception gaps (|self − panel| ≥ 1), evidence notes.
  Every profile page has an **Export PDF** button → `GET /analysis/am/[id]/pdf`
  renders a styled 2-page individual report server-side (@react-pdf/renderer,
  component in `src/lib/pdf-report.tsx`) and downloads it; superadmin-only, same
  data as the page.
- **Auth:** scrypt password hashes, httpOnly cookie sessions in DB, role checks in
  every page AND every server action (never trust the client).
- **Analysis uses submitted assessments only** — drafts stay private to their author.

Key files:
```
src/lib/seed-data.ts   the full rubric + roster (extracted 1:1 from the Excel)
src/lib/db.ts          schema + auto-seed (users, sessions, account_managers,
                       capabilities, assignments, assessments[unique am+lens], ratings)
src/lib/queries.ts     all data access + analysis math (zoneHeatmap, trainingPriorities…)
src/lib/session.ts     getCurrentUser / requireUser / requireSuperadmin
src/app/(shell)/…      rate/ (wizard), analysis/, admin/users/
e2e/smoke.mjs          Playwright E2E suite — 22/22 passing (see header
                       comment for how to run; needs a fresh DB + prod server on :3111)
```

## 3. Set up the repo (do this first)

1. Unzip so `apex-assessment/` sits in the repository (keep it as a subfolder unless
   the user prefers it at root).
2. `cd apex-assessment && npm install && npm run dev` → http://localhost:3000 —
   verify login as vladimir works.
3. Commit and push to the branch the user designates **in this new session's repo**.
4. Optionally run the E2E suite to confirm 18/18 (build + start on port 3111 first).

## 4. PENDING WORK — not started (this is the user's active request)

The user saw the current UI and **rejected it**: “looks terrible, like AI, simple
squares everywhere, kind of like Streamlit”. They want a full visual overhaul:

- **Apple-app feel**: sophisticated, premium, typography-led, depth (glass/blur,
  layered shadows, large radii), generous whitespace — NOT flat gray boxes.
- **Vibrant colors** (keep Schneider green #3DCD58 as the hero accent).
- **Scroll animations** (reveal-on-scroll), **hover animations** (lift, glow),
  **cursor UI animations** (e.g. spotlight/glow tracking the pointer on cards).
- Smooth springy easing, micro-interactions (button press, selection pop, animated
  progress, count-up KPIs are all fair game). Respect `prefers-reduced-motion`.

Implementation notes from the previous session (suggested, not binding): the entire
look lives in `src/app/globals.css` (semantic class names — cards, badges, heat map
cells, wizard level-cards…), so a rewrite of that file plus one small client component
(IntersectionObserver for reveals, pointermove for cursor glow, mounted in the root
layout) gets 90% of it without touching page logic. **Keep class names and visible
text labels stable** so `e2e/smoke.mjs` keeps passing — rerun it after the redesign
(add small waits before screenshots if reveal animations race them).

## 5. Other agreed decisions (context you may need)

- v1 auth is deliberately username/password managed by the superadmin; real SSO is a
  later production concern — flagged to the user already.
- SQLite is deliberate (zero infra); swap to Postgres only if the user asks.
- 10 of the 25 roster names are placeholders (e.g. "Account Manager 13") because the
  source Excel had placeholder tabs; user hasn't provided real names yet.
- Ideas floated but NOT requested: roster editing UI, CSV/Excel export, multi-cycle
  campaigns (year-over-year comparison). Don't build unless asked.

# HANDOFF — APEX Assessment app (Schneider Electric)

**Purpose of this file:** complete context archive. A new session should be able to
continue this project using ONLY this repository — no external files, no verbal context.
Last updated: 2026-07-20.

---

## 1. TL;DR — current state

- The app is **complete and working**: Next.js 15 + SQLite, in `apex-assessment/`.
- Repo: `https://github.com/aliz2007/SchneiderElectric.git`, branch
  `claude/apex-assessment-ui-redesign-vr8uel` (the only branch; the demo downloads it).
- 4 commits shipped: app + premium dark UI → geographic zone map → thermal zone map /
  self-service assignments / shared dashboard → per-profile PDF export.
- **UNCOMMITTED, MUST BE PUSHED** (as of 2026-07-20): `package.json` +
  `package-lock.json` bump `better-sqlite3` → `^12.11.1` and `next` → `15.5.20`.
  This fixes the Windows demo install crash (see §7). Build passes, E2E 22/22.
- Also uncommitted: this HANDOFF rewrite, `demo.bat` and `docs/source-materials/`
  (newly archived into the repo).

## 2. The project

Schneider Electric wants a web app replacing an Excel workbook used to assess the
**APEX TOP 25 Strategic/Key Account Managers (KAMs)**. The goal (from the client
brief): digitalize and simplify the assessment, improve UX vs Excel, get a clear view
of each KAM's capability mastery, identify gaps between evaluators, feed
development/training plans, and consolidate results per individual and per
geographic zone.

### Source materials (now archived IN this repo)

- `docs/source-materials/Brief-projet-Assessment.pdf` — 2-page project brief (French).
- `docs/source-materials/APEX_AM_Assesment140726-TEMPLATE-INSTRUCTIONS-ORDRE.xlsx` —
  the original Excel workbook (template version: all ratings empty).

Both were fully reverse-engineered; everything data-relevant is also embedded 1:1 in
`apex-assessment/src/lib/seed-data.ts`.

### The assessment model

- **22 capabilities** in **6 clusters**, each with written **L1/L2/L3 behavioural
  anchors** (L1 Developing = 1, L2 Proficient = 2, L3 Advanced = 3). Full anchor
  texts: `src/lib/seed-data.ts` (verbatim from the Excel "Capability Guide" tab).
- **3 assessment lenses** per AM: **Self** (the KAM), **Manager**, **APEX Panel**
  (panel of Global Account Managers & Segment Leaders — the authoritative score used
  in analytics).
- Each AM has a **track** — *Acquisition* or *Saturation* — determining the
  **required level** per capability. 4 capabilities apply only to Acquisition
  (Pipeline Shaping, Competitive Positioning, White-Space Penetration, Preferred
  Partner Positioning), 3 only to Saturation (Share of Wallet Expansion, Retention &
  Loss Prevention, Software & Services Attach).
- Required levels: L2 for everything, EXCEPT L3 for Account Management (both tracks),
  Pipeline Shaping (Acquisition), Share of Wallet Expansion (Saturation).
- The Excel "Src" column flags capability origin: SE / C (core) / A (acquisition-only)
  / S (saturation-only).
- **25 AMs across 4 zones**: MEA (AM01–06), SAM (AM07–12), India (AM13–18),
  Pacific (AM19–25). Roster with track per AM: `src/lib/seed-data.ts` (matches the
  Excel Consolidation tab exactly).
- **11 of 25 names are placeholders** ("Account Manager 1", "Account Manager 13–18",
  "Account Manager 22–25") because the Excel itself had placeholder tabs. Real names
  exist only for AM02–AM12 and AM19–AM21. User hasn't provided the missing names.

### Hard product rules from the brief (enforced server-side — KEEP THEM)

1. Evaluators must NEVER see other evaluators' scores (blind assessment).
2. Required levels must be HIDDEN during rating (anti-anchoring bias); shown only
   in analysis.
3. Ratings are confidential: individual results/analysis are superadmin-only.
4. The app is the system of record — rubric + roster were seeded once from the Excel;
   all ratings are created in-app. The Excel is retired.

The brief's analysis priorities (the client called analysis "the most important part"):
individual view comparing the 3 lenses + perception gaps + strengths/dev areas;
capability heat map (level obtained vs required, simple colour code); zone view
(MEA/SAM/India/Pacific) with strengths/weaknesses, maturity comparison, collective
development needs, heat maps / synthetic dashboards. **All implemented.**

## 3. The app (`apex-assessment/`)

Next.js 15 (App Router, server actions) · React 19 · better-sqlite3 ·
@react-pdf/renderer. No external services; SQLite DB auto-creates and auto-seeds at
`data/apex.db` on first run (rubric, 25 AMs, superadmin).

- **Login:** superadmin `vladimir` / `apex2026` (seeded; flagged
  change-after-first-login).
- **Superadmin:** Users & Access page — create users, set role (superadmin/assessor),
  set assessor lens (self/manager/expert), assign AMs, enable/disable, reset
  passwords. Data tools: **Load demo dataset** (fills all 75 assessments with
  plausible submitted scores) and **Clear all ratings**.
- **Assessors** self-assign AMs by typing a name on My Assessments (admin can also
  pre-assign). One evaluator per AM per lens.
- **Rating wizard** (`/rate`): one capability per screen, rubric anchors inline,
  keyboard shortcuts (1/2/3, ←/→), notes/evidence field, autosave (700 ms debounce),
  progress dots, review screen, submit → locks. Superadmin can reopen a submitted
  assessment.
- **Analysis** (dashboard is visible to everyone signed in; individual-level pages
  are superadmin-only):
  - `/analysis` — completion KPIs, interactive geographic zone performance map,
    thermal zone map with capability filter, "recommended training focus",
    capability × zone heat map (avg APEX Panel score − required level).
  - `/analysis/zone/[zone]` — AM × capability heat maps (track-aware).
  - `/analysis/individuals` + `/analysis/am/[id]` — Self vs Manager vs Panel,
    gap-to-required, strengths, development areas, perception gaps (|self − panel| ≥ 1),
    evidence notes. **Export PDF** button → `GET /analysis/am/[id]/pdf` renders a
    styled 2-page report server-side (`src/lib/pdf-report.tsx`), superadmin-only.
- **Auth:** scrypt password hashes, httpOnly cookie sessions in DB, role checks in
  every page AND every server action.
- **Analysis uses submitted assessments only** — drafts stay private to their author.

Key files:
```
src/lib/seed-data.ts    rubric (22 caps, L1/L2/L3 anchors) + 25-AM roster (1:1 from Excel)
src/lib/db.ts           schema + auto-seed (users, sessions, account_managers,
                        capabilities, assignments, assessments[unique am+lens], ratings)
src/lib/queries.ts      all data access + analysis math (zoneHeatmap, trainingPriorities…)
src/lib/session.ts      getCurrentUser / requireUser / requireSuperadmin
src/app/(shell)/…       rate/ (wizard), analysis/, admin/users/
e2e/smoke.mjs           Playwright E2E suite — 22 tests (see header comment for how to
                        run: fresh DB + prod server on :3111; on this Mac use
                        CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
```

## 4. How to run

```bash
cd apex-assessment
npm install
npm run dev          # http://localhost:3000 — login vladimir / apex2026
```

Prod: `npm run build && npm start`. E2E: build, delete `data/`,
`npx next start -p 3111`, then `node e2e/smoke.mjs` (currently **22/22 passing**).

## 5. Agreed decisions (don't relitigate)

- v1 auth = username/password managed by the superadmin; real SSO is a later
  production concern (already flagged to the user).
- SQLite is deliberate (zero infra); swap to Postgres only if the user asks.
- Ideas floated but NOT requested — don't build unless asked: roster editing UI,
  CSV/Excel export, multi-cycle campaigns (year-over-year comparison).

## 6. Pending / open items

1. **Push the uncommitted dependency fix** (§7) — the Windows demo stays broken
   until the branch is updated.
2. **UI redesign status — ask the user before doing visual work.** History: the user
   rejected the first UI ("looks terrible, like AI, simple squares everywhere, like
   Streamlit") and asked for an Apple-app feel (glass/blur, depth, vibrant colors with
   Schneider green #3DCD58 as hero accent, scroll/hover/cursor animations, springy
   easing, respect `prefers-reduced-motion`). Commit `03b5fe7` then shipped a "dark
   UI" redesign + thermal map; it's unclear whether the user has approved the current
   look. If more visual work is requested: the look lives in `src/app/globals.css`
   (semantic class names) + `src/app/fx.tsx` (client effects). **Keep class names and
   visible text labels stable** so `e2e/smoke.mjs` keeps passing; rerun E2E after any
   redesign.
3. **11 placeholder AM names** — waiting on the user for real names (§2).
4. `demo.bat` sets `APEX_DEMO=1` but no code reads it (vestigial) — demo data is
   loaded via the admin "Load demo dataset" button.

## 7. The Windows demo launcher (`demo.bat`)

`demo.bat` (now archived at repo root; the distributed copy lives one folder up on the
user's Mac) is a double-click Windows demo:

1. Installs Node.js LTS via winget if missing.
2. Downloads `https://github.com/aliz2007/SchneiderElectric/archive/refs/heads/claude/apex-assessment-ui-redesign-vr8uel.zip`
   on every launch into `%LOCALAPPDATA%\apex-assessment-demo`.
3. Skips install/build when the zip hash is unchanged; otherwise
   `npm ci --no-audit --no-fund` + `npm run build`.
4. Starts `npm start -- -p 3000`, opens the browser, prints the vladimir login.

**2026-07-19 incident (fixed, pending push):** install crashed on the demo PC —
`better-sqlite3@11.10.0` has no prebuilt binary for Node 24 (ABI v137, win32-x64),
so npm fell back to `node-gyp`, which needs Python + VS Build Tools. Fix:
`better-sqlite3` → `^12.11.1` (v12 ships `node-v137-win32-x64` prebuilds — verified;
no compilation ever needed) and `next` `15.1.6` → `15.5.20` (patches CVE-2025-66478,
which npm was warning about during the demo install). Verified on Node 24.18.0:
module loads, `npm run build` passes, E2E 22/22. Since the launcher runs `npm ci`
against the committed lockfile, pushing the lockfile IS the fix.

## 8. Machine-specific warning (this Mac)

The project folder is deeply nested with DUPLICATE copies:
`~/schneider project/SchneiderElectric/SchneiderElectric/…/SchneiderElectric` (6×).
**The canonical repo** is the deepest one (the one containing this file), whose
`origin` is `github.com/aliz2007/SchneiderElectric.git`. One level up there is
ANOTHER git repo with its own older `apex-assessment/`, `HANDOFF.md`, and the
distributed `demo.bat` — a leftover from an earlier session that pushed to the wrong
place. Don't edit or commit in the parent copy; consider cleaning it up with the user.

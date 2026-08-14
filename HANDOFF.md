# HANDOFF — APEX Assessment (Schneider Electric)

**Purpose:** complete context archive. Any person or AI should be able to continue this
project using ONLY this repository — no external files, no prior conversation. If you are
an AI picking this up cold, read this file top to bottom first; it describes the product,
the data model, every feature, the architecture, how to run and test, and the decisions
behind it all.

Last updated: 2026-08-14.

### Start here (if you are picking this up cold)

1. Read **§1** for what shipped most recently, then **§2b** (weighted scoring) and **§3 Traps**.
   Those three are where a newcomer gets something wrong.
2. Run it: `cd apex-assessment && npm install && npm run dev` → `localhost:3010`, sign in
   `vladimir` / `apex2026`, then **Users & Access → Load demo dataset** so the dashboards have
   data. §8.
3. Before you change anything, get a green baseline: §9. The suite needs a **fresh database and
   a stopped server** — that is not a nicety, see §9.
4. Never rename an identifier because it says "theme" (§2 Per-cluster justification), never
   define an `--accent*` token in `:root` (§3 Traps #4), and never round a weighted score
   (§2b).
5. §12 lists decisions the client already made. Do not re-propose what is in there.
6. Everything is on `claude/self-assessor-assessment-notes-en8uo1`. Commit and push there.

There are also two sales documents in `docs/` — `PITCH.md` (what the app does, part by part)
and `CALL-SCRIPT.md` (a 30-minute walkthrough script). They are written for the client, not
for you, but they are the shortest description of what every feature is *for*.

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
- Most recent additions (2026-08-14, fifth batch): vocabulary and a set of small things the
  handoff audit turned up. Nothing structural.
  1. **"Cluster", never "theme", in anything a user reads.** The review screen's
     "Justify 3 more themes", the server's refusal on an early submit, the note under the
     capability detail, the PDF narrative and ~40 of question mode's explanations all said
     theme. **The code still says theme on purpose** — see § Per-cluster justification for the
     rule, because this is the single easiest thing for a newcomer to "fix" and break.
  2. **Question mode answers per BUTTON, not per class.** `.filter-toggle` styles three
     unrelated controls (Filters, Assessment schedule, Account details) and answered "Filters"
     for all three; the `/ n` beside a KPI figure is a headcount on four tiles and the top of
     the level scale on the fifth. Both now resolve on what the element says (§ Traps #11).
  3. **The e2e helper for question mode could read a stale answer** — it hovered, waited, and
     read a card that had not changed. It now refuses a selector it cannot find and waits for
     the text to change (§ Traps #12). This is what caught (2).
  4. **Leftovers from the emoji strip**: "Assessment schedule" and "Account details" still had
     the empty `<span>`s their emoji were deleted from, and typed a `▲/▼` next to a Filters
     button that had already moved to a drawn chevron. One shared `Caret` in `nav-icon.tsx` now.
  5. **Two client-facing documents** in `docs/`: `PITCH.md` and `CALL-SCRIPT.md`.
  6. The handoff itself was audited against the code, section by section — §4, §7, §9 and §14
     had drifted, and § Traps was extended to twelve entries.
- Most recent additions (2026-08-05, fourth batch): the app got a customisation layer, a
  help layer, and a round of fixes for both. In rough order of how much of the codebase each
  one touches:
  1. **Arranging the dashboard in place** (superadmin, per account). A 34px wrench at the top
     left of the DASHBOARD turns that page editable: drag cards to reorder, pull a right edge
     to resize, × to take one off, Colour / Reset / Cancel / Save in a sticky bar. Switch it
     off and the page freezes back into something you read and click. There is no separate
     editor and no Settings page — an earlier version had both and the client rejected them
     (§ Arranging the dashboard).
  2. **Colour, one part at a time** — accent, menu bar, background, cards — from the same
     toolbar. Result colours (green = at or above required) and lens colours are frozen and
     can never follow a brand choice.
  3. **Help** (`?` top right, every page): **Tutorial mode** walks the whole app in order,
     spotlighting each part and crossing pages on its own; **Question mode** is a toggle that
     explains whatever the pointer rests on, per instance rather than per category
     (§ Help).
  4. **The menu bar folds away** (§ Folding the menu away), and **data pages use the whole
     window** instead of scrolling inside a 1260px cap (§ Wide pages).
  5. **UI refinement, not redesign**: the `▦ ☰ ⚙ ✎ ★ 📅 🏷` characters became a drawn icon
     set (`nav-icon.tsx`); 36 selectors came off font-weight 750/800; glass went on the
     surfaces that float (popovers, banners) and NOT on the sidebar or the 500-cell heat
     table; `prefers-reduced-transparency` is honoured.
  6. **Fixes to all of the above**, each with a test — see § Traps, which is the shortest
     useful read in this file if you are about to touch the CSS.
- Most recent additions (2026-08-04, third batch): three points raised in chat.
  1. **APEX Panel is no longer a second green.** The perception radar drew the APEX Panel
     web in Schneider green (`#3dcd58`) next to the Final score web in bright green
     (`#4ce26a`) — a shade apart, at a 1.4px stroke — so the one comparison the chart exists
     to make was the one a reader could not make. The Panel lens is now magenta `#e148b8`,
     the only wide arc of the colour wheel neither the lens set (violet Self, blue Manager,
     green Final score) nor the heat scale (amber / orange / red / green) had already spent.
     The change lands in four places at once so a lens means one thing everywhere:
     `theme-radar.tsx`, the frozen `--lens-*` tokens in `globals.css`, and the PDF palette in
     `pdf-kit.tsx` — which also **fixes an older inconsistency**: blue used to mean Manager on
     screen and APEX Panel in every printed report. `pdf-report.tsx` now imports the palette
     from `pdf-kit` instead of keeping its own copy of it.
  2. **The duplicated lens legend is gone.** The capability detail card printed
     Self / Manager / APEX Panel / Required as a strip directly above a table whose column
     headers carry the same dots and the same words. The strip is removed on both the
     individual analysis page and My Feedback; the `Required` header gained the dot it was
     missing, so nothing was lost with it. An e2e check asserts the strip stays gone AND that
     the four header dots are still painted and distinct — removing both would have been the
     easy way to make the first half of that check pass.
  3. **Arranging the dashboard** (superadmin-only, per-account) — see § Arranging the dashboard below.
- Most recent additions (2026-08-03, second batch): the eight points from
  `docs/source-materials/APEX_App_Feedbacks_2026-08-03.md` (Colline & Vladimir, 3 Aug).
  1. **Self-assessment deadline** — `self_deadline` joins the manager deadline and the panel
     call as a third per-AM date, set in the same editor, locking the self lens the same way
     (§ Assessment scheduling).
  2. **Timeline markers** — the campaign timeline draws one LANE PER LENS with labelled
     flags carrying the date and, when several people share a day, the count. It used to be
     a flat row of dots that read as "one dot per lens".
  3. **Cluster average / weighted score / gap** on the training needs heat map and the zone
     benchmark. Every cluster gets its own average row; the zone benchmark also opens with a
     `Weighted score · gap` row per Account Manager, and every cell carries `req X · ±gap`.
  4. **Access scope verified and fixed** — see § Access scope below.
  5. **Segment column** on the roster.
  6. **Horizontal scroll indicator** on Individual Results.
  7. **Employee names link** to their Individual Analysis, on Individual Results and the
     roster (superadmins only: an assessor has no individual page to open).
  8. **Zone map colours** — the shading is now RELATIVE to the zones in view. Zone averages
     roll up 22 capabilities over six or seven people, which lands all four inside a fraction
     of a level; on the old absolute on-target-to-critical ramp they came out the same green
     and the map compared nothing. `MIN_SPAN` (0.15, `zone-map.tsx`) stops a dead-level
     quarter being stretched into a ranking that is not there, the toolbar legend names the
     two zones and gaps the ramp runs between, and every gap figure on the hover card and the
     zone panel stays absolute.
- Most recent additions (2026-08-03): **population-level PDF reports**, built from the
  client's "APEX Dashboard Proposal" document. Two new downloads, both superadmin-only and
  both honouring the filters on the page they are launched from:
  `GET /analysis/report/pdf` (APEX Capability Dashboard: IO Global Overview, Zone Overview,
  Segment View, Track View one page per zone, Gap to Target) and
  `GET /analysis/population/pdf` (the account-level Population Overview table, landscape).
  New shared modules: `pdf-kit.tsx` (palette, page chrome, score colours, shared by every
  report), `pdf-group-radar.tsx` (radar for a POPULATION, sized to fit a grid cell) and
  `pdf-dashboard.tsx` / `pdf-population.tsx`. New aggregation in `queries.ts`:
  `groupProfile` / `zoneProfiles` / `segmentProfiles` / `zoneTrackProfiles` (see §2c). The
  Individual Results table gained **Avg required**, **Gap**, **Account type** and **Perf YTD**
  columns so it matches the proposal's column list exactly. The four points the brief needed
  that did not exist (gap convention, editable required levels, Account Type, Perf YTD) are
  built (Account Type, Perf YTD); see §11 item 5 for the two that were reverted. Each zone
  page also carries its own **Download PDF**, scoped to that zone.
- Earlier (2026-07-30): **fixed a float-formatting bug on the
  zone benchmark** — it interpolated the weighted score raw, so `L2.3000000000000003` and
  `L2.3499999999999996` were showing across the grid (see §2b, "Never print a weighted score
  raw"). Also: the mandatory justification block is now
  headed **`Justification - <cluster>`** with an italic lead and **one numbered line per
  capability** it covers (current one in bold), and the textarea placeholder seeds that same
  numbering, so nobody reads the shared note as a per-question box repeating itself. The
  duplicated prose that used to sit above it was removed (see §3).
  Also: **PDF wording aligned with the client's
  vocabulary** — the per-cluster table under the radar now reads
  `Cluster capability / Score / Average score expected / Gap`, the radar section is titled
  "Perception by cluster capability" with "Final score" as its emphasised web, the detail
  table's Weighted column is "Score", and the headline caption is
  "Final score vs. average score expected". Two layout fixes shipped with it: word
  hyphenation is **disabled** in the PDF (the renderer was splitting "EXPECTED" as "EX-PECTED",
  and a mid-word hyphen breaks the no-dashes rule), and the narrative and capability detail
  now share **one continuous page flow** instead of two separate `<Page>` elements, so a
  narrative that overflows by a line or two no longer strands a near-empty page. The radar and
  its table are skipped entirely when no lens has been submitted (they used to draw an empty
  web plus a table of n/a).
- Earlier (2026-07-30): **WEIGHTED SCORING** — every capability's score is now
  `Self 20% + APEX Panel 35% + Manager 45%`, and that weighted decimal drives every average,
  gap, strength, development area, heat map, KPI, chatbot answer and PDF figure in the app
  (see §2b). Also: the PDF radar gained a **fourth, emphasised "weighted average" web** (the
  three lens webs are now thin), a **per-cluster table** (weighted / expected / gap) under it,
  **decimal gaps** throughout, the detail table's APEX column renamed **Panel**, and the
  headline grade is now a **continuous colour gradient** by distance from expected
  (red → orange → amber → light green → deep green).
- Earlier (2026-07-26): a **search bar + Zone / Track / Segment filters** on
  Individual Results; the PDF **tightened** so the report is 4 pages again (the radar sits on
  the overview page instead of being orphaned onto its own, leaving blank space); a
  **substantially richer narrative page** — both the Kimi prompt and the deterministic
  fallback now write a detailed, cluster-by-cluster read (~500–700 words) instead of a few
  bare sentences; and a shell **error boundary** that auto-recovers from stale-tab
  ChunkLoadErrors after a deploy.
- Earlier (2026-07-24): the **per-lens Question Guide** (two guiding questions
  per capability for Self / Manager / APEX Panel, from the APEX Question Guide workbook)
  shown in every assessment; **assessment scheduling** (a superadmin calendar on the
  individual page setting the manager's deadline and the APEX Panel call date/time, with a
  server-enforced lockout once the day has passed and an "upcoming assessment" banner for
  the assessed person); an **unrounded Avg column** (e.g. 2.3) on the capability detail
  (page + PDF); the PDF perception section replaced by a **spider chart of perception by
  cluster** (Self / Manager / Panel webs); and a **big colored overall grade /3** under the
  CONFIDENTIAL pill on the PDF's overview page (red below the expected overall, green
  at/above, expected score printed beneath).
- Earlier (2026-07-23): fictional demo roster names (legal); the self-assessor justification
  as **one mandatory concrete-example note per cluster** (guided prompt — replaced an earlier
  five-question variant). Earlier (2026-07-22): mandatory one-note-per-cluster justification
  for every lens; the **business Segment** attribute + filter, shown on individual pages;
  the **centralized Filters window** (Track + Segment + map Capability); the **My Feedback**
  tab (released once all three lenses submit); strengths/development redefined strictly
  (strength = strictly above required, development = anything below). See §14 (parcours).

## 2. The project

Schneider Electric replaced an Excel workbook used to assess the **APEX TOP 25
Strategic / Key Account Managers (KAMs)** with this web app. Goals from the client brief:
digitalize and simplify the assessment, improve the experience versus Excel, get a clear
view of each KAM's capability mastery, surface gaps between evaluators, feed development
and training plans, and consolidate results per individual and per geographic zone.

### Source materials (archived in this repo)

- `docs/source-materials/Brief-projet-Assessment.pdf` — 2-page project brief (French).
- `docs/source-materials/APEX_App_Feedbacks_2026-08-03.md` — the client's 3 Aug review
  notes, transcribed from a .docx supplied in chat. Every point is implemented; see §1.
- `docs/source-materials/APEX_AM_Assesment140726-TEMPLATE-INSTRUCTIONS-ORDRE.xlsx` — the
  original Excel workbook (template version, ratings empty). Its "Capability Guide" tab
  holds the rubric; its "Consolidation" tab holds the roster; there is also a "Cover" tab.

Everything data-relevant from the workbook is embedded 1:1 in
`apex-assessment/src/lib/seed-data.ts`. The Excel has NO separate capability-definition
column: it labels the L1/L2/L3 behavioural anchors themselves as the "Capability
Definitions". That is why the PDF's capability definitions reuse those anchors.

### The assessment model

- **22 capabilities** in **6 clusters**, each with written **L1 / L2 / L3
  behavioural anchors**. Levels are numeric: L1 Developing = 1, L2 Proficient = 2,
  L3 Advanced = 3. Full anchor texts live in `src/lib/seed-data.ts`.
- The 6 clusters: Account Strategy & Planning, Commercial & Sales Excellence, Executive &
  Customer Leadership, Offer/Segment & Solution Expertise, Acquisition Excellence,
  Saturation Excellence.
- **3 assessment lenses** per AM: **Self** (the KAM), **Manager**, **APEX Panel** (panel of
  Global Account Managers & Segment Leaders). In code the panel lens is called `expert`.
  Historically the APEX Panel score alone drove analytics; since 2026-07-30 the WEIGHTED
  score does (see §2b).
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

### Per-cluster justification (the self-assessor's concrete example)

Every lens justifies each cluster with ONE mandatory free-text note, written in-context
under the level cards and required before the assessment can be submitted:

- **Self-assessors** get a guided prompt (`SELF_JUSTIFICATION_PROMPT` in `seed-data.ts`): "Please
  share a concrete example to support your rating. You can structure it as: situation, actions
  taken, results, impact — and, where relevant, how this could be replicated." It is one note,
  not five fields. (An earlier iteration split this into five separate framework questions;
  that was reverted to a single note at the user's request.)
- **Manager / APEX Panel** write a free justification note per cluster.

**The block names its cluster and lists what the note must cover.** It is headed
`Justification - <cluster>`, then an italic lead, then ONE NUMBERED LINE PER CAPABILITY in
the cluster with the one currently being rated in bold, and the textarea's placeholder seeds
the same numbering (`1. Account Management: ` / `2. Strategic Account Ambition: `). So the
box itself shows that a single note has to cover every capability of the cluster.

This is not cosmetic. Assessors were seeing their own text reappear under the next capability
of the cluster and reading it as a per-question box repeating the previous answer, so they
reported it as a bug. A distinct box per capability was considered and explicitly rejected by
the client in favour of this labelling: if it comes back, note it would take the mandatory
count from 6 to 22 per assessment (450 to 1 650 across a 25-AM campaign) and would need
somewhere to land in the PDF.

Keep the lead and the placeholder saying DIFFERENT things. A first pass had a prose paragraph
plus `SELF_JUSTIFICATION_PROMPT` plus a placeholder all restating "describe a concrete
example"; the client's note was that it was too much text and that the two visible strings
were near-identical. The lead now carries the guidance once, the list carries the scope, and
the placeholder carries only the structure. An e2e check asserts the placeholder does not
repeat the lead's wording.

**Vocabulary, and the trap inside it.** The client says **cluster**. Every string a user can
read says cluster — the wizard, the review screen's "Justify 3 more clusters", the server's
refusal on an early submit, the capability detail, the PDF narrative, question mode, the
assistant's system prompt. The word "theme" was purged from user-visible copy on 2026-08-14
and an e2e check asserts the justification kicker never says it.

**The CODE still says theme, deliberately.** The table is `theme_notes`, the helpers are
`themeJustificationText` / `unjustifiedThemes` / `saveThemeField`, the CSS class is
`.theme-note-block`, the radar file is `theme-radar.tsx`. Renaming any of those is a database
migration and a mass rename for zero user-visible gain — **do not "fix" them.** The rule is
simply: identifiers keep the old word, anything a human reads says cluster.

All of these live in the `theme_notes.note` column (one row per assessment per cluster).
`themeJustificationText(row)` returns that note; it still falls back to the legacy five
framework columns if an old row only has those, so nothing pre-existing is lost.

### 2b. Weighted scoring (the single most important rule)

`LENS_WEIGHTS` in `seed-data.ts`: **Self 20% · APEX Panel 35% · Manager 45%**. The helper
`weightedScore({self, manager, expert})` combines whichever lenses have a level and
**re-normalises over the lenses present**, so a partially-assessed person is still scored
fairly (self 2 + manager 3, no panel → `(0.2·2 + 0.45·3) / 0.65 = 2.69`); it returns null when
nothing has been submitted.

That weighted value — a DECIMAL, never rounded to a level — is the canonical score everywhere:

- `scoredRows(amId, track)` in `queries.ts` is the shared row builder (three lens levels +
  `weighted` + `req` + `gap` = weighted − required + `perception` = self − weighted). The
  individual page, My Feedback and the PDF all consume it, so they cannot drift apart.
  `averageWeighted` / `averageRequired` roll a row set up; `weightedLevels(amId)` gives the
  per-capability map used by the maps and heat maps.
- **Strength** = weighted STRICTLY above required · **development area** = weighted below
  required · at-required = baseline (neither). **Perception gap** = |self − weighted| >= 1.
- The zone heat map, training priorities, zone map colouring, the dashboard's
  "Avg weighted maturity" KPI, the individual "Weighted" column, the PDF's headline grade,
  radar and per-cluster table, the deterministic narrative and both AI prompts all use it.
- Individual lens levels are still shown (Self / Manager / Panel columns, the radar's three
  thin webs) — they are the inputs, not the verdict.

**Never print a weighted score raw.** It is a computed float, so binary floating point shows
through the moment it is interpolated into a string: 11 of the 27 possible level triples land
on a value that does not print cleanly, e.g. self 3 / panel 1 / manager 3 is
`2.3000000000000003`, and self 2 / panel 3 / manager 2 is `2.3499999999999996`.
Always go through `fmt(value, 2)` (`src/lib/heat.ts`) or `.toFixed(2)`. This bit us once, on the zone benchmark, which printed `` `L${score}` `` and
filled a third of the grid with 16-digit numbers; an e2e check now walks every cell of that
table and fails on anything that is not `n/a` or a level with at most two decimals. Individual
lens levels (`self` / `manager` / `expert`) are integers and are safe to interpolate; the
weighted score, gaps, and any average are NOT.

Changing the weights is a one-line edit to `LENS_WEIGHTS`; everything downstream follows.

### 2c. Group profiles (the population radars)

`groupProfile(label, ams)` in `queries.ts` is the aggregate behind every population radar.
Pass any list of AMs (a zone, a segment, a zone crossed with a track, or the whole roster)
and it returns one `ClusterProfile` per cluster: the mean of each lens, the weighted score,
the expected level and `n`. `zoneProfiles` / `segmentProfiles` / `zoneTrackProfiles` wrap it.

Two rules make these numbers trustworthy and both are easy to break:

1. **Average the PEOPLE, not the ratings.** Each AM contributes ONE value per cluster, so a
   zone holding one heavily-rated person and one barely-rated person is not skewed toward
   whoever has more submitted capabilities.
2. **Respect track applicability.** `Acquisition Excellence` has no required level on the
   Saturation track and vice versa, so a cluster is reported with `required: null` when
   nobody in the group is measured on it. Null, never zero: zero would drag the expected web
   into the centre of the radar and read as "target comfortably met".

The overall figures come from the capability rows directly, NOT from averaging the six
cluster means — clusters hold different numbers of capabilities (2 to 6), so averaging the
averages would weight a 2-capability cluster the same as a 6-capability one.

`GroupRadar` (`pdf-group-radar.tsx`) drops any axis with no expected level whenever at least
one axis has one, so a single-track radar becomes a 5-axis pentagon WITH a target web rather
than a 6-axis hexagon with none. The dropped cluster keeps its score in the table underneath.
Measured page budget: four radars at the grid size fit one A4 page; eight do not, they spill
and orphan the last row. That is why Track View is one page per zone.

### The Question Guide (per capability, per lens)

`CAPABILITY_QUESTIONS` in `seed-data.ts` embeds the APEX Question Guide workbook 1:1: for
each of the 22 capabilities, TWO guiding questions per lens. Self-assessors get reflective
prompts ("How do you build your strategic account plan…"); Manager and APEX Panel get the
interview prompts they ask the person ("Tell me about a time when…"). The wizard shows the
current lens's pair on every capability screen (the blue `qguide` block between the title
and the level cards). The guide's L1/L2/L3 anchors were verified identical to the seeded
rubric, so only the questions were added.

### Assessment scheduling & windows

Three per-AM dates, set by superadmins from the **individual page** (the "Assessment
schedule" toggle, opening native date / datetime pickers — `schedule-editor.tsx` + `saveSchedule`):

- `self_deadline` (date): the assessed person can self-assess up to and including that day;
  after it, their own assessment locks. Added 2026-08-03 at the client's request, so the
  campaign has a deadline on all three lenses rather than only the two downstream ones.
- `manager_deadline` (date): the manager can assess up to and including that day; after it,
  their assessment locks.
- `panel_datetime` (date + time): when the assessed person and the APEX Panel hold the
  assessment call. Shown to the assessed person on their own assessment page as an
  "Upcoming assessment" banner; the panel can score until the END of that day (so scoring
  during/after the call still works), then it locks.

Locks are decided by `assessmentLock(am, lens)` in `queries.ts` and enforced in EVERY rate
server action (`guard()`), not just the UI — the wizard renders read-only with a locked
banner when closed, and an info banner (deadline / call date) while the window is open.
Clearing a date in the editor removes its limit.

### Access scope (what a Manager or Panel member can reach)

Audited on 2026-08-03 against the client's request to "verify that Managers and Panel Members
only have access to their assigned scope", by signing in as each lens and requesting every
route. Findings and the fix, so nobody has to redo the sweep:

Already correct, left alone:

- Every superadmin surface redirects an assessor to `/rate`: `/analysis/individuals`,
  `/analysis/am/[id]`, `/analysis/zone/[zone]`, `/analysis/zone/[zone]/pdf`,
  `/analysis/report/pdf`, `/analysis/population/pdf`, `/admin/users`. The guard is
  `requireSuperadmin()` called at the top of each page and route, never a layout, so it holds
  for direct requests too.
- `/rate/[amId]` opens only for an AM the user is assigned (`isAssigned`), and every rate
  server action re-checks it.
- `/analysis/am/[id]/pdf` returns 403 to a Manager or Panel member for EVERY AM, including
  the ones they assess. Only a self-assessor gets 200, only for their own AM, only once all
  three lenses have submitted.
- The thermal map payload (raw per-AM panel scores) is built only for superadmins, so an
  assessor's browser never receives it.
- The chatbot snapshot is separately scoped (`scopedSnapshot` in `chat-data.ts`): the
  assessor's own ratings and notes, no required levels, no other lens, no other person.

Broken, and fixed in this batch: the shared `/analysis` dashboard is open to every signed-in
user, which is correct for its AGGREGATES (KPIs, zone heat map, training priorities: they roll
25 people together and name nobody), but the **roster** and the **campaign timeline** are
per-person — one row each with names, submission state and deadlines — and were showing all
25 to anyone signed in. Both are now cut to the viewer's assignments (`rosterAMs` in
`analysis/page.tsx`), the roster card is retitled "People you assess", and timeline entries
render as plain text for assessors instead of links to a page that would bounce them.

The e2e suite locks all of this down in section 7 (roster scoping, timeline scoping, no
timeline links, no map, four redirect checks, five PDF download checks).

### Arranging the dashboard (superadmin-only, per account)

One small square **wrench, top left of the dashboard**. It turns THIS page editable and back.
There is no Settings page and no separate editor: the thing being arranged is the real
dashboard with its real cards and real numbers in them. A miniature would be a second thing
to keep in sync with the first, and you would still have to look away from it to see what you
had done.

**Read mode** carries the wrench and nothing else — no toolbar, no handles, no tags — and the
cards are fully interactive. **Edit mode** puts a sticky bar at the top with **Colour · Reset
· Cancel · Save**, gives every card a dashed outline, a name tag, a × and a grip on its right
edge, and makes the card CONTENTS inert (`pointer-events: none`), because a drag that starts
on a link is a navigation rather than a drag. Nothing is written until Save; Cancel restores
and leaves.

- **Move**: drag a card onto another. The name tag is also a button — arrow keys step the
  card past its neighbours, because a drag is unreachable from a keyboard and cannot be
  driven deterministically by a test harness.
- **Resize**: pull the right edge. The pointer position is turned into a column count against
  the grid's real width and snapped to the sizes that card is allowed. Arrow keys on the grip
  do the same.
- **Take off**: the ×. The card stays visible in edit mode, greyed, so it can be put back.

One trap worth knowing: pressing the resize grip used to start a native HTML5 drag of the
draggable card underneath, which swallowed the pointermove stream so the edge never followed
the mouse. `preventDefault()` on the pointerdown is NOT enough — `draggable` has to come off
the card for the duration.

**Per account.** `user_settings (user_id, key, value)`, two keys per person:
`dashboard.layout` and `theme.colors`. Each superadmin arranges and colours their own
dashboard; saving never moves a colleague's. Anyone with nothing stored gets the shipped
defaults — an assessor (no wrench, nothing to store) and the sign-in screen, which has no
session to ask. `ON DELETE CASCADE` takes a user's preferences with them.

**Widths** are `third` / `half` / `full` (4 / 6 / 12 columns). Some cards carry a `minSize`:
the zone map is a fixed-aspect world canvas and the timeline places its markers as
percentages of its track, so a third-width version of either is not a smaller chart, it is an
unreadable one. The grip only comes to rest on a width the card survives, and `parseLayout`
clamps a hand-edited value to the same set. The filter card is `pinned` — movable and
resizable, never removable, because it scopes every other card and hiding it would strip the
only way to clear a filter still in the URL.

**Colour** is chosen one PART at a time — accent, menu bar, background, cards — from the same
toolbar, because "change the app's colour" is usually four different wishes and one swatch
row cannot express any of them past the first. Every change previews on the live page
immediately by writing the same custom properties the server writes on a real load.

**Two traps in the colour work, both hit once.** The page background is painted by
`body::before`, which covers `body` entirely — so setting `--bg` changed nothing anybody
could see except the scrollbar gutter. The gradient's three stops (`--bg-hi`, `--bg`,
`--bg-lo`) now all move together. And every panel surface derives from `--card-rgb` at its
own alpha — cards, the map, popovers, toolbars, the sticky first column of a scrolling
table. Before that, `--card` tinted the handful of surfaces that happened to read it and
left the rest navy, which is exactly what "random rectangles" looks like. Both have e2e
checks that assert the RENDERED surface, not the variable.

**The rule that matters most: chrome follows the colour, results never do.** `globals.css`
keeps two frozen families:

- `--ok` / `--ok-2` / `--ok-bright` / `--ok-strong` / `--ok-ink` / `--ok-rgb` — green means
  "at or above the required level".
- `--lens-self` / `--lens-manager` / `--lens-expert` / `--lens-weighted` / `--lens-req` — a
  lens colour is a legend entry too. `.ld-expert` used to read `var(--se-green)`; left alone
  it would have followed whatever brand colour a superadmin picked.

**How the default install stays byte-identical.** `globals.css` does not define `--accent*`
at all. Every rule that held a brand colour carries that exact colour as its own `var()`
fallback — `rgba(var(--accent-rgb, 61, 205, 88), 0.4)`, `var(--accent-deep, #27b346)` — and
`themeVars()` returns nothing for a part nobody has chosen. So on a default install no
property is injected, every fallback is used, and the stylesheet renders exactly what it
always did. An earlier version defined the tokens in `:root` with *derived* values, which
silently shifted about twenty greens and every ink on a filled surface across the whole app.
An e2e check now asserts a default install injects no overrides at all. **If you touch this
file, keep that property**: resolve the fallbacks by hand and diff against the previous
revision.

**Adding a card later:** append to `DASHBOARD_BLOCKS` in `dashboard-layout.ts` and add the
node in `analysis/page.tsx`. `parseLayout` splices any block a stored layout has never heard
of back in at its shipped index, so a new card appears for everyone rather than being
invisible to anyone who has ever arranged theirs.

### Help: the tour and question mode

A question mark sits in the **top-right** corner (`.help-corner`), on every page. It started
next to the menu-fold button on the left and covered the page kicker — the green "Analysis"
line — and it has no relationship to the menu edge anyway: it is about the page, not about
the navigation. It opens a two-item menu.

**Tutorial mode** walks the app once, in order: it dims everything except the part it is
explaining, says what that part is for, and waits to be told to continue. It crosses pages
on its own — later steps live on Individual Results and on an individual's page — so its
progress is kept in `sessionStorage` under `apex_tour`. That is not a preference, it is a
necessity: the component is destroyed and rebuilt on every navigation, and a tour held in
React state would end the moment it reached its second page.

The spotlight is ONE element carrying a 9999px box-shadow, so the hole *is* the thing being
explained and cannot drift out of register with it as the page reflows. The step polls with
`requestAnimationFrame` for its target rather than measuring once, because a step routinely
arrives before its page has finished rendering; after ~90 frames with no match it gives up
and shows the step as a plain centred card rather than trapping the reader behind an
invisible spotlight.

**Question mode** is a toggle, not a tooltip: it stays on across navigations (`apex_ask` in
sessionStorage) until it is turned off, and explains whatever the pointer is resting on. The
lookup runs once per animation frame, tries `element.closest()` for every registered
selector, and keeps the DEEPEST match — so pointing at a number inside a card explains the
number, not the card.

Question mode answers per INSTANCE, not per category. An entry may carry a `resolve(el)`
that reads the answer off the DOM at hover time: a heat cell names its capability, its zone,
its own figures and what its colour band means; a KPI tile answers from its own label; a
table cell is explained by its column heading, in every table in the app. A resolver
returning null means "not this one", so the lookup falls through instead of answering
vaguely. There is no fallback for "a card" or "a table" — silence beats naming the kind of
thing somebody is already looking at.

That principle extends to reused CLASSES, not just reused shapes. `.filter-toggle` styles
three unrelated buttons (Filters, Assessment schedule, Account details) and `.kpi-value span`
is a headcount on four tiles and the top of the level scale on the fifth. Both are resolved by
what the element says, not by the class it is styled with.

**Both read `src/lib/guide.ts`**, which is the single place the app describes itself. Two
copies of an explanation drift apart the first time a figure changes meaning. The tour is
also role-aware: `buildTour()` drops the steps whose page the reader cannot reach, because
walking a manager through the superadmin's table would spotlight a redirect.

The one real cost of keying explanations to CSS selectors is that a renamed class silently
loses its explanation, with nothing failing. The e2e suite therefore asserts that a sample
of the registered selectors still matches something on a page that definitely contains it —
**if you rename a class, that check is what tells you.**

### Folding the menu away

The `.nav-toggle` button slides the sidebar out on a negative margin (its width never
changes, so the nav labels do not reflow on the way out). The choice is a COOKIE read by the
server layout, not localStorage: read in the browser after hydration, the bar would paint
open and then be yanked shut on every navigation. The click itself does not wait for the
server — it toggles the class and writes the cookie, so the bar moves under your hand.

`NAV_COOKIE` lives in `src/lib/nav-cookie.ts` and **must not move into the client component
that writes it**. A module marked `"use client"` hands the server a client-reference proxy
for every export including plain constants, so `cookies().get(<proxy>)` reads nothing, with
no error anywhere — the bar folded and then sprang open on the next page. An e2e check
asserts the fold survives a navigation.

### Wide tables

Two traps, both hit on Individual Results.

`.scroll-fade` (the soft cut-off at the right edge) must be applied to a WRAPPER of the
scroller, never to the scroller itself. An absolutely-positioned child of a scrolling box is
laid out against that box's scrollable CONTENT, so `right: 0` pinned the fade to the far
right of the *table* — and it then slid inwards as you scrolled, drawing a grey seam straight
down the middle of the columns and dimming whatever it crossed.

Fifteen columns will not fit any ordinary window, so the first column is `position: sticky`.
Without it, scrolling right leaves rows of bare numbers with nothing to say whose they are.
The sticky cell needs an OPAQUE background (`--card` is `rgba(…, 0.6)`, which the scrolling
columns show straight through) and its own copy of the row-hover tint, or hovering visibly
splits the row in two.

The sort control is drawn, not typed. `↕ ▲ ▼` render at whatever size and baseline the
platform font picks; at 9px the neutral one was a pair of specks you had to click to
discover what they did. Both chevrons are always visible and the active direction lights up.

### Wide pages

`.main` caps at 1260px to keep a readable measure for prose. A 25-column table has no measure
to protect, so that cap only pushed content into a horizontal scroller while the right of the
window sat empty. Data pages opt out with `page-wide` on their root element
(`.main:has(> .page-wide) { max-width: none; }`): the dashboard, Individual Results and the
zone benchmark. The rating wizard, login, onboarding, an individual's page and Users & Access
keep the cap — they are read as prose, not scanned as a grid.

### Hard product rules (enforced server-side — keep them)

0. The score of record is the WEIGHTED score (Self 20% / APEX Panel 35% / Manager 45%), kept
   as a decimal. Never round it to a single level in a metric — a 1.6 and a 2.4 are different
   situations (§2b).
1. Evaluators must NEVER see other evaluators' scores (blind assessment).
2. Required levels are HIDDEN during rating to avoid anchoring bias; shown only in analysis.
3. Individual results and analysis are superadmin-only. The shared dashboard is visible to
   any signed-in user, but only its AGGREGATES: anything that names people (the roster, the
   campaign timeline) is cut to the viewer's own assignments, and the map's per-AM payload is
   never sent to an assessor. EXCEPTION: the **My Feedback** tab lets an assessed
   self-assessor see their OWN consolidated report, but only after all three lenses have
   submitted (nothing about anyone else is exposed). Full audit in § Access scope.
4. The app is the system of record. Rubric + roster were seeded once from the Excel; all
   ratings are created in the app. The Excel is retired.
5. Every cluster must be justified before an assessment can be submitted: every lens writes one
   note per cluster (self-assessors from a guided prompt). Enforced server-side in
   `unjustifiedThemes()` (called by `submit`).
6. Assessment windows are enforced server-side (`assessmentLock` in every rate action):
   past the manager deadline / panel-call day, that lens can no longer rate, justify or
   submit — the wizard going read-only is a reflection of the rule, not the rule itself.

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

### Traps

Every one of these cost real time and every one is now covered by a test. If you are about to
touch the CSS or the shell, read this first.

1. **`"use client"` poisons plain exports for the server.** A module marked `"use client"`
   hands the server a client-reference proxy for EVERY export, constants included. The
   sidebar-fold cookie name lived in the client component that writes it, so the layout was
   calling `cookies().get(<proxy>)` and reading nothing — with no error anywhere. The bar
   folded, then sprang open on the next navigation. Shared constants belong in a plain module
   (`src/lib/nav-cookie.ts`).

2. **`body::before` covers `body`.** The page background is a full-viewport pseudo-element at
   `z-index: -2`, so `background: var(--bg)` on `body` is invisible except in the scrollbar
   gutter. Changing the background colour appeared to do nothing but recolour "a bar on the
   right of the screen". The gradient's three stops (`--bg-hi`, `--bg`, `--bg-lo`) now move
   together.

3. **An absolutely-positioned child of a SCROLLING box is laid out against its content, not
   its viewport.** The right-edge fade on Individual Results was applied to the scroller
   itself, so `right: 0` pinned it to the far right of a 1,964px table; it then slid inwards
   as you scrolled and drew a grey seam down the middle of the columns, dimming whichever one
   it crossed. Fades and edge treatments go on a WRAPPER.

4. **A token defined in `:root` is not the same as a token that only exists when chosen.**
   The first version of the colour feature defined `--accent*` in `:root` with DERIVED values.
   That silently moved about twenty greens and every ink on a filled surface across the whole
   app, because the derived values were not the hand-picked originals. `globals.css` now
   defines no `--accent*` at all; each rule carries its own original colour as the `var()`
   fallback and `themeVars()` returns nothing for a part nobody chose. A default install is
   therefore byte-identical to before the feature existed, and an e2e check asserts no
   override is injected. **If you edit that file, resolve the fallbacks by hand and diff.**

5. **One token has to reach every surface of its kind.** `--card` originally tinted only the
   handful of elements that happened to read it; the map, the popovers, the toolbars and the
   sticky table column kept their own hardcoded navy. The result looked like random
   rectangles changing colour. All 27 panel surfaces now derive from `--card-rgb` at their
   own alpha.

6. **`preventDefault()` on `pointerdown` does not stop a native HTML5 drag.** Pressing the
   card resize grip started a drag of the draggable card underneath, which swallowed the
   pointermove stream so the edge never followed the mouse. `draggable` has to come OFF the
   card for the duration of the resize.

7. **`backdrop-filter` inside `backdrop-filter` is a second offscreen composite for no visual
   gain**, and it creates a containing block for fixed/absolute descendants. `.card` already
   blurs, so its children get a specular edge instead. The sidebar is never blurred: it is
   `position: sticky` at `height: 100vh` with a 38-second aurora animating behind it.

8. **A drag is unreachable from a keyboard and unreliable under a harness.** Everything
   draggable in this app also moves on arrow keys — the card name tag steps a card past its
   neighbours, the resize grip steps through the allowed widths — and the e2e suite drives
   the keyboard path for determinism plus one real mouse drag to prove dragging itself works.

9. **Sticky table columns need an opaque fill and their own hover state.** `--card` is
   `rgba(…, 0.6)`; the scrolling columns show straight through it. And without a copy of the
   row-hover tint on the sticky cell, hovering visibly splits the row in two at the seam.

10. **Explanations keyed to CSS selectors rot silently.** A renamed class loses its help text
    with nothing failing. The e2e suite asserts a sample of the registered selectors still
    matches something on a page that contains it.

11. **A class is not a meaning.** `.filter-toggle` styles three different buttons — Filters,
    Assessment schedule, Account details — so a `sel`-keyed entry answered "Filters" for all
    three. When one class covers several things, key the entry off what the element SAYS with
    a `resolve()`, and return `null` for anything it does not recognise so the lookup falls
    through instead of answering confidently and wrongly.

12. **Question mode rewrites one card in place, so a test can read a stale answer.** The e2e
    helper originally hovered, waited 220ms and read `.qm-tip-title`. A hover onto a selector
    that was not on that page left the PREVIOUS answer sitting there and the check passed on
    it. It now refuses a selector it cannot find and waits for the card's text to CHANGE.

### Data model (all tables in `src/lib/db.ts`)

- `users` (id, username unique nocase, password_hash, display_name, role
  ['superadmin'|'assessor'], lens ['self'|'manager'|'expert'|null], active, created_at).
- `sessions` (token PK, user_id, expires_at).
- `account_managers` (id, code unique, name, account, zone ['MEA'|'SAM'|'India'|'Pacific'],
  track ['Acquisition'|'Saturation'], profile_complete, segment [one of `SEGMENTS`; seeded on
  the roster and backfilled by migration, so effectively always set], self_deadline and
  manager_deadline [YYYY-MM-DD or null], panel_datetime [YYYY-MM-DDTHH:MM or null] — the
  three assessment windows, see §2 — plus account_type and perf_ytd, the account tier and
  the year-to-date performance figure, both set per person on their individual page).
- `capabilities` (id, ord, name, cluster, src, req_acq, req_sat, l1, l2, l3).
- `assignments` (user_id, am_id) — which AMs a user is linked to. For self assessors this is
  the one AM that IS them; for manager/panel it is who they evaluate. PK (user_id, am_id).
- `assessments` (id, am_id, lens, rater_user_id, status ['draft'|'submitted'], updated_at,
  submitted_at). **UNIQUE (am_id, lens)** — one assessment per AM per lens.
- `ratings` (assessment_id, capability_id, level [1|2|3|null], note). PK (assessment_id,
  capability_id). NOTE: the per-capability `note` column still exists but is no longer
  written by the wizard; notes are now per-cluster (see `theme_notes`).
- `theme_notes` (assessment_id, cluster, note, situation, actions, results, impact,
  replication). PK (assessment_id, cluster). ONE row per cluster per assessment. Every lens now
  fills `note` (self-assessors from a guided prompt, Manager/Panel free text). The five
  framework columns (situation/actions/results/impact/replication) are LEGACY — kept so any
  data saved during the brief five-question iteration still reads back, but no longer written.
  Columns are added by idempotent `ALTER TABLE … ADD COLUMN` migrations in `db.ts`. A row that
  becomes entirely empty is deleted (`saveThemeField`). Read helpers: `getThemeNotesFull`,
  `themeJustificationText`, `unjustifiedThemes`.
- `app_settings` (key PK, value) — INSTALLATION-wide key/value store. Now holds only
  `moonshot_model` (the auto-selected working model) and `moonshot_last_result` (last PDF-AI
  outcome). The Kimi API key is HARDCODED in `ai-narrative.ts` (`EMBEDDED_KEY`), not stored
  here; there is no in-app AI settings card anymore.
- `user_settings` (user_id + key PK, value, cascade on user delete) — the same idea scoped to
  one person, cascading on user delete. Holds exactly two keys, both JSON and both written
  only by the dashboard's own toolbar:
    - `dashboard.layout` — `[{ id, size, hidden }]`, the card order, widths and which cards
      are switched off.
    - `theme.colors` — `{ accent?, sidebar?, bg?, card? }`, only the parts actually chosen.
      An absent key means "shipped default", which is why nothing is written when a part is
      cleared (see § Arranging the dashboard for why that distinction matters).
  Read/written only through `getUserSetting` / `setUserSetting` in `queries.ts`, wrapped by
  `src/lib/dashboard-settings.ts`.

A self-assessor is always linked to exactly ONE Account Manager (themselves).
`setAssignments` enforces this (it caps a self user's assignments to one), and both the
create-user form and the Users-table assignment editor use a single-select for the self
lens rather than a multi-checkbox.

## 4. Features and routes

- **Login** (`/login`): superadmin lands on `/analysis`, assessors on `/rate`.
  Seeded superadmin: `vladimir` / `apex2026`.
- **Onboarding** (`/onboarding`, self-assessors only): a one-time profile form — name, account,
  zone, track, segment — shown before a self-assessor's first rating and skipped forever after
  (`am.profile_complete`). Any other lens is redirected to `/rate`; a self-assessor with no AM
  linked is too, and the `/rate` banner explains why.
- **Rating** (`/rate`, `/rate/[amId]`):
  - Manager / APEX Panel assessors build their task list by typing a name (self-assign), or
    the admin pre-assigns. One evaluator per AM per lens (enforced).
  - **Self assessors** are the exception: `/rate` redirects them straight to their own
    assessment (`/rate/[their single linked AM]`); no pick-someone list; self-assign is
    refused server-side; if no AM is linked they see a banner explaining the admin must link
    their profile.
  - **Wizard** (`/rate/[amId]`): one capability per screen with the L1/L2/L3 anchors inline
    and the lens-specific **Question Guide** (two guiding questions, blue block) above the
    level cards; keyboard shortcuts (1/2/3 to rate, arrows to move), 700 ms debounced
    autosave, progress dots, a review screen, then submit which locks the assessment.
    Required levels are never sent to the client. Superadmin can reopen a submitted
    assessment from the individual analysis page. **Assessment windows** apply per lens: an
    info banner shows the manager deadline / panel call while open, and past the window the
    wizard goes read-only with a locked banner (see §2 Assessment scheduling; server-enforced).
  - **Per-cluster justification (mandatory)**: below the level cards, each capability screen
    shows the justification block for that capability's cluster — one required note, headed
    `Justification · <cluster>` with an italic lead, a numbered line per capability the note
    covers (current one bold) and a placeholder seeding that same numbering (see §3).
    For a **self-assessor** the lead is the guided prompt (a concrete
    example: situation, actions, results, impact, and where relevant replication). For a
    **Manager / APEX Panel** evaluator it is a one-line lead. Autosaved (700 ms
    debounce) via `saveThemeNote → saveThemeField`. The review screen shows a completion badge
    per cluster, and **Submit is disabled** until every capability is rated AND every cluster is
    justified; the server re-checks with `unjustifiedThemes()` and rejects an early submit.
- **Analysis**:
  - `/analysis` (any signed-in user): completion KPIs, ending with **"Avg weighted maturity"**
    — the weighted average to two decimals over 3, and under it `vs <expected> expected` plus a
    signed gap chip coloured by `gapClass()`, because the score on its own does not read as
    good or bad. Then an interactive geographic zone performance map (superadmin only — it
    carries per-AM data); a campaign timeline; a recommended training focus; a capability x
    zone heat map (avg APEX Panel score minus required level); and the roster.
    Every one of those is a **block** the reader can rearrange — see §3 Arranging the
    dashboard. Blocks the reader may not see are never built, so an assessor's dashboard
    closes up where the map would have been rather than leaving a hole.
  - **Centralized Filters window** (`filter-bar.tsx`): one togglable **Filters** button opens
    a panel with **Track** (All / Acquisition / Saturation), **Segment** (All + the four
    segments) and, for superadmins, the **map Capability** filter. All three drive URL search
    params (`track`, `segment`, `cap`), so the server re-scopes the zone map, training focus,
    heat map and roster together. An active-count badge and "Clear all" round it out. The old
    standalone track dropdown and the in-map capability dropdown were folded into this one
    window (the capability filter now re-colours the thermal map via the `capFilter` prop).
  - `/analysis/zone/[zone]` (superadmin): AM x capability heat maps, track-aware; the zone
    benchmark ranking can sort AMs and (for admins) shows each AM's name in a low-opacity font
    under their AM number. Every cell is the WEIGHTED score formatted to two decimals
    (`L2.80`), as is the Zone avg column — see the formatting rule in §2b, this table is the
    one that shipped raw floats once.
  - `/analysis/individuals` + `/analysis/am/[id]` (superadmin): the list carries a **search
    bar** (name / account / AM code, debounced) and **Zone / Track / Segment filters** —
    URL-param driven (`filters.tsx`), with a "Showing N of M Account Managers" note and Clear
    all. The list is a **wide page** (`page-wide`, §3 Wide pages) with a **sticky name column**
    and a drawn sort chevron on every sortable head. Per person:
    Self vs Manager vs Panel per
    capability, gap-to-required, **strengths (panel STRICTLY above required)**, **development
    areas (panel BELOW required — all of them, uncapped)**, perception gaps (|self - panel| >=
    1), and the cluster justifications shown under each cluster inside the capability detail,
    which also carries an **Avg column** — the UNROUNDED three-lens mean (e.g. 2.3), because
    rounding would make a 1.6 and a 2.4 read as the same level. An **Export PDF** button, the
    **Assessment schedule** editor (self / manager deadline + panel call) and the **Account
    details** editor (account type + Perf YTD) live in the header.
    (A capability merely AT required is on the baseline — never a strength.)
  - **My Feedback** (`/feedback`, self-assessors only): the assessed person's own report —
    strengths, development areas, self-vs-panel perception gaps, a three-lens capability table
    with the cluster justifications, and a **Download PDF** (the same PDF as the admin export).
    Gated by `allLensesSubmitted(am.id)`: until Self + Manager + APEX Panel have all submitted
    it shows a status checklist instead. The nav tab only appears for a linked self-assessor.
- **PDF report** (`GET /analysis/am/[id]/pdf`, superadmin-only): a styled 4-page report
  (`src/lib/pdf-report.tsx`): (1) cover; (2) overview — right under its CONFIDENTIAL pill,
  a **big bold overall grade /3** (the unrounded WEIGHTED average across the track's
  applicable capabilities, coloured by a **continuous gradient** on its distance from the
  expected overall — deep red well below, orange, amber on the bar, light green a little
  above, deep green well above — with the expected overall printed smaller beneath; "— / 3"
  until something is submitted), then profile + strengths/development (the development card
  is capped at `OVERVIEW_LIST_MAX` with a "+N more" line so the radar always fits the page;
  the full list is in the detail table) + a **spider chart, "Perception by cluster
  capability"** (`ThemeRadar`, @react-pdf SVG: thin webs for Self amber / Manager violet /
  Panel blue plus a **thick deep-green "Final score" web**) and, under it, a compact
  **per-cluster table** headed `Cluster capability / Score / Average score expected / Gap`
  (decimals). The radar block is skipped when nothing has been submitted yet; (3) the
  narrative (strengths/weaknesses prose + a definition of every capability it names) followed
  in the SAME page flow by (4) the capability-detail table with cluster notes, the **Panel**
  column (formerly "APEX"), the **Score** column (formerly "Weighted") and a **decimal Gap**.
  Narrative and detail deliberately share one `<Page>`: when they were separate, a narrative
  that ran two lines long stranded an almost-empty page between them.
  Hyphenation is disabled document-wide (`Font.registerHyphenationCallback`) so no word ever
  breaks with a "-". Page count is 4 for a typical report and grows only with the volume of
  written justifications — verified across all 25 AMs on both an empty roster (4 pages each)
  and a worst-case fill with a long note on every capability and every cluster field (5 pages,
  6 for the two longest). See §5–6 for the narrative.
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
  - There is no `/admin/settings` route at all. It existed for one afternoon, held the first
    version of the Dashboard Manager, and was removed when that became a wrench on the
    dashboard itself. If you find a link to it, it is dead.
- **Everywhere (the shell,** `src/app/(shell)/layout.tsx`**)**:
  - The **left menu** folds away with the chevron at its foot (`sidebar-toggle.tsx`). The
    choice is a cookie, read on the server, so a folded bar stays folded through a navigation
    instead of flashing open (see §3 Folding the menu away).
  - The **question mark, top right** (`help-tools.tsx`) opens two modes: **Tutorial**, a guided
    walk that crosses pages, and **Question mode**, which explains whatever the pointer rests
    on. Both read one registry, `src/lib/guide.ts` (see §3 Help).
  - The **wrench, top left of the dashboard** (`dashboard-grid.tsx`, superadmin only) turns the
    dashboard editable in place, and the palette next to it recolours the app. Both are saved
    per user (see §3 Arranging the dashboard).
  - The **APEX Assistant** floats bottom right on every page (see §6b).

## 5. The PDF narrative (deterministic)

`src/lib/report-narrative.ts` builds the narrative page from data alone (no LLM), and is
always the fallback for the AI path — so it has to read like real feedback, not a stub. It
produces roughly 500 words:

- **summary** — capability counts vs the bar, the unrounded overall average vs the expected
  overall, the strongest and weakest cluster (by average gap), and whether the person tends to
  over- or under-rate themselves against the panel.
- **strengths / development** — organised BY CLUSTER, one paragraph each, using the same
  `"Cluster Name: …"` lead as the AI path (the PDF bolds that lead, see `ClusterNarrative`).
  Each paragraph names its capabilities with levels, brings in the manager and self views as
  corroboration or divergence, flags the widest gap, and points at that cluster's written
  justification. Development closes with an ordered priority list for the development plan.
- **comments** — what the evaluators wrote justifications on and how to use them (only when
  notes exist).
- **definitions** — the rubric behavioural anchor at the level the AM's track requires (an L2
  reference when the capability is not on the AM's track), for every capability named above.

When the panel has not scored the person, the prose falls back to cautious "provisional"
wording rather than inventing strengths.

## 6. The PDF narrative (AI, Kimi / Moonshot)

`src/lib/ai-narrative.ts` has Kimi write the narrative sections. It is an enhancement with
a hard fallback:

- Attempted only when AI is enabled AND the panel has scored the person.
- On ANY failure (network blocked, non-200, bad/empty JSON, timeout) it returns `null` and
  the route keeps the deterministic narrative. PDF export never depends on the external call.
- Sections are `{strengths, development, comments}`. Strengths and development are organised
  BY CAPABILITY CLUSTER: one tight paragraph per cluster, led by the exact cluster name and
  a colon (the PDF bolds that lead — see `ClusterNarrative` in `pdf-report.tsx`). `comments`
  is a single paragraph synthesising the evaluators' cluster justifications, and is empty
  (section hidden) when none exist. The model is prompted (see `SYSTEM_PROMPT`) to ground
  every statement in the provided data, never quote the rubric definitions, cover every
  qualifying capability, and be substantial: the prompt asks for roughly 500–700 words, four
  to six sentences per cluster paragraph that explain the pattern, the why (grounded in the
  themeNotes) and what closing a gap would look like in practice — feedback, not labels.
  The prompt tells it that Manager/Panel notes are
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
  required levels, gaps, cluster justifications, segment, users and assignments). An assessor's
  snapshot contains ONLY their own work (their assigned people, their own ratings and
  justifications, drafts included) plus the dashboard's completion counts; required levels and
  other evaluators' scores are ABSENT from the payload, so the model cannot leak what it never
  receives. The system prompt also instructs the restricted variant to refuse such questions.
- The prompt is kept in step with the model: it explains segment as a dimension, and that
  per-cluster justifications are one note per lens — a self-assessor's guided concrete example, or
  a manager/panel free note — to be quoted as evidence for "why" questions and never fabricated.
- Uses `kimiChat()` in `ai-narrative.ts` — same hardcoded key, same model auto-fallback.

## 7. Key files

```
src/lib/seed-data.ts         rubric (22 caps, L1/L2/L3 anchors) + 25-AM roster (1:1 from Excel)
src/lib/db.ts                schema + auto-seed (all 7 tables)
src/lib/queries.ts           all data access + analysis math (zoneHeatmap, trainingPriorities, cluster notes)
src/lib/session.ts           getCurrentUser / requireUser / requireSuperadmin, cookie sessions
src/lib/auth.ts              scrypt hashing + session token
src/lib/report-narrative.ts  deterministic strengths/weaknesses prose + capability definitions
src/lib/ai-narrative.ts      optional Kimi (Moonshot) feedback, with graceful fallback
src/lib/pdf-report.tsx       @react-pdf report (cover / overview / narrative + detail in one flow)
src/lib/pdf-dashboard.tsx    @react-pdf population deck (IO global / zone / segment / track radars)
src/lib/pdf-population.tsx   @react-pdf Population Overview table (landscape)
src/lib/pdf-group-radar.tsx  the shared grid radar both population decks draw with
src/lib/pdf-kit.tsx          shared @react-pdf page furniture (styles, header, footer)
src/lib/brand.tsx            the Schneider mark, drawn once for the app and the PDFs
src/lib/heat.ts              heat-map colour helpers
src/app/login/               login page + action
src/lib/chat-data.ts         role-scoped live snapshot for the APEX Assistant chatbot
src/app/(shell)/rate/        rating list + wizard (framework/notes) + actions (ratings, cluster fields, submit)
src/app/(shell)/analysis/    dashboard, filter-bar, zone-map, zone view, individuals, am/[id], am/[id]/pdf
src/app/(shell)/feedback/    My Feedback tab (self-assessor's own report + PDF download)
src/app/(shell)/onboarding/  new self-assessor profile form (name/account/zone/track/segment)
src/app/(shell)/chat-widget.tsx  floating APEX Assistant bubble + panel
src/app/(shell)/error.tsx    error boundary; auto-reloads once on a stale-tab ChunkLoadError
src/app/api/chat/route.ts    chatbot endpoint (role-scoped snapshot + Kimi)
src/app/(shell)/admin/users/ users page, lens-aware create-user-form, actions (delete, sandbox, demo)
src/lib/dashboard-layout.ts  block definitions, sizes, layout parser, accent helpers (NO db import — client-safe)
src/lib/dashboard-settings.ts  per-user reads/writes of dashboard.layout + theme.colors (server only)
src/lib/nav-cookie.ts        the sidebar-fold cookie name (NOT in the client component — see §Folding)
src/app/(shell)/nav-icon.tsx  the drawn icon set (replaced the ▦ ☰ ⚙ ✎ ★ characters)
src/app/(shell)/sidebar-toggle.tsx  folds the menu bar away
src/app/(shell)/help-tools.tsx  the question mark: guided tour + question mode
src/lib/guide.ts             what the app says about itself — tour steps and hover explanations
src/app/(shell)/analysis/dashboard-grid.tsx  the 12-column grid + the wrench that makes it editable in place
src/app/(shell)/analysis/colour-panel.tsx    accent / menu bar / background / cards, opened from the edit bar
src/app/(shell)/analysis/dashboard-actions.ts  save + reset for the layout and the colours
src/app/globals.css          all styling (semantic class names)
src/app/fx.tsx               client-side scroll/hover effects
e2e/smoke.mjs                Playwright smoke suite (see §9 for the check count)
.env.example                 optional AI overrides (the key itself is hardcoded, not in env)
```

Outside `apex-assessment/`:

```
HANDOFF.md                   this file — the only document you need to continue the project
README.md                    short repo readme
demo.bat                     double-click Windows launcher (see §13)
docs/PITCH.md                client-facing: what the app does, part by part, and why
docs/CALL-SCRIPT.md          client-facing: a 30-minute walkthrough script for a video call
docs/source-materials/       the client's brief, feedback notes and the original Excel (§2)
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
node e2e/smoke.mjs                                # in a second shell — currently 163/163 (weighted scoring verified separately)
```

The suite drives the real UI with Playwright: login, wrong-password, demo load, dashboard,
the centralized Filters window, the APEX Assistant round-trip, individual analysis (incl. the
segment badge), PDF export, zone view, assessor creation and confidentiality, the rating
wizard, the mandatory per-cluster justification note for BOTH the Manager (walking every
cluster) and the self-assessor (the guided concrete-example prompt), justification end-to-end
(wizard -> analysis -> PDF), the self-assessor direct landing, onboarding (now incl. segment),
the test sandbox, account deletion, arranging and recolouring the dashboard, folding the menu
away, and the guided tour and question mode.

**The run is not idempotent — delete the DB and restart the server between runs.** The suite
creates users, deletes one, loads the demo dataset and saves layouts and colours, so a second
run against the same database fails on setup steps that are already done. The `rm -f` line
above is part of the recipe, not a nicety, and it has to happen while the server is STOPPED:
deleting the file under a running process leaves it holding an unlinked inode and the fresh
database is never created.

Three checks exist because a specific bug got shipped once, so do not delete them lightly:

- **focus retention** in the justification textarea, typed with `pressSequentially` rather
  than `fill()` — a nested-component regression once remounted the box on every keystroke, and
  `fill()` sets the value in one shot so it cannot catch it (see §12).
- **justification block layout** — the `Justification - <cluster>` heading, the numbered list
  of covered capabilities, the highlight on the current one, and the fact that the placeholder
  does NOT repeat the lead's wording (the client rejected an earlier version for saying the
  same thing twice).
- **zone benchmark number formatting** — no cell may contain a number with three or more
  decimals, which catches raw floats leaking into the UI (see §2b). Asserted on the digits
  rather than on a whole-cell shape on purpose: an earlier version matched the cell's entire
  text, so adding a row to the table silently disabled the guard.

Two more that exist because the assertion, not the feature, was once wrong:

- **assessor scope** (section 7) — roster and timeline cut to the viewer's assignments, no
  timeline links, no map, four redirect checks and five PDF checks. The timeline half asserts
  on the ENTRIES and their names, not on a marker count: with no dates set the timeline
  renders its empty state and a count-based check passes without testing anything. The setup
  therefore schedules two people and fills all three date fields **by name**
  (`input[name="selfDeadline"]` etc.), because filling `input[type=date]` positionally
  started hitting the self deadline the moment it was added as the first field.
- **zone map colours** — the four zone chips must be four DIFFERENT colours and the legend
  must name both ends of the ramp. This is the whole point of the relative shading; an
  absolute ramp passes every other check while painting the map one flat green.

Four from arranging and recolouring the dashboard (sections 13–13b), all written to assert the
RESULT rather than the control that was clicked, because an editor whose state never reaches
the page is the failure this feature invites:

- **radar web colours** are read off the RENDERED elements — the legend swatches, then the
  polygon strokes — and the two are compared to each other. Recolouring only the legend, or
  only the chart, would leave the radar exactly as unreadable while looking fixed in a diff.
  A fourth check pins the Final score web as the emphasised one, so the fix cannot be
  smuggled in by re-emphasising a different web instead of changing a hue.
- **removing a card** asserts the map and `.map-card` are absent from the read-only DOM, not
  merely dimmed. `is-hidden` only greys the body in EDIT mode, so a hide implemented as CSS
  opacity would leave the card — and every AM's weighted scores — sitting in the page.
- **the accent** is checked three ways: the variable resolves, a PAINTED node changed hue
  (a variable check alone passes even if every rule still hardcodes green), and every
  `--accent-*` property resolves to a non-empty value. That last one caught a real bug during
  the build: a search-and-replace had rewritten `--accent-soft`'s own definition into
  `var(--accent-soft)`, a cycle that is invalid at computed-value time and silently paints
  nothing.
- **chrome vs results** — with a violet brand saved, `.cell.hm-good` must still compute to
  `rgba(61, 205, 88, 0.22)` and the APEX Panel dot must still be magenta. Without this, the
  natural implementation of "repaint the app" also repaints the legend, and the heat map
  starts reporting a different answer per setting.

Six more, each written against a bug the user reported in words, so the check speaks the same
language they did:

- **the background reaches the layer that paints** (13b) — `--bg` is set and then
  `getComputedStyle(document.body, "::before").backgroundImage` is searched for the chosen
  triple. `body::before` sits at `z-index: -2` and covers `body` completely, so setting `--bg`
  alone recoloured nothing anybody could see except the scrollbar gutter — the user's "it just
  changed the color of a bar on the right of the screen". A check on the variable passes for
  that bug; a check on the painted layer does not.
- **the card colour reaches every panel** (13b) — `.card`, `.map-card` and `.nav-toggle` are
  read together and ALL THREE must carry the chosen triple. Only two elements read `--card`
  originally, so the first version recoloured a couple of surfaces and left the rest navy:
  "it starts coloring random rectangles that aren't windows". Asserting on one element passes
  that bug too.
- **it all belongs to one account** (13c) — a second superadmin signs in and must see the
  shipped order and the shipped green. Layout and colours are rows in `user_settings`, and the
  obvious global implementation passes every other check in this section.
- **arranging is done on the real page** (13) — after a move, the reordered dashboard is read
  back with its cards still full: `.dash-block[data-block="heatmap"] table.hm`,
  `[data-block="map"] .map-card`, five `.kpi-value`s. The first version of this feature was a
  separate screen of grey placeholders, which is precisely what the user rejected.
- **the sticky name column and the fade** (13e) — the table is scrolled 700px, then the first
  cell's x is compared to the scroller's x, and `.scroll-fade::after` must sit at offset 0 from
  the right edge. That second one is the "rift": placed on the scrolling element, the fade was
  laid out against the 1,964px CONTENT, so it slid inwards and drew a grey seam down the middle
  of the columns. Both are geometry checks, because both bugs looked fine in the CSS.
- **question mode is specific** (14b) — two heat cells at different indices must give
  DIFFERENT titles and different bodies, and the body must contain a figure and say what the
  colour means. A registry that answers "this is a heat map cell" passes every other check in
  section 14 and is worth nothing to somebody pointing at one particular number: "a card, a
  page, navigation, literally no added value". Same shape for the KPI tiles.

And two that guard the guide and the vocabulary:

- **nobody says "theme"** (14c) — four pages are loaded and their RENDERED text is searched for
  the word. A source grep cannot do this job: the code says theme on purpose (`theme_notes`,
  `themeJustificationText`, `.theme-note-block`), so the only honest test is what a reader
  actually sees. If this fails, some copy regressed — not the schema.
- **selector health** (end of 14) — every selector the guide leans on (`.kpi-value`,
  `td.cell`, `.lvl-chip`, `.badge-zone`, `.filter-toggle`, `.wrench`, `.nav-toggle`, `.tl`, …)
  must still match something on a page that definitely contains it. `src/lib/guide.ts` is keyed
  to CSS selectors, so a class rename orphans an explanation silently — question mode simply
  falls through to a vaguer answer, and nothing anywhere fails.

Run `MOONSHOT_ENABLED=0` so the AI is off and the run stays hermetic (deterministic
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
   needs deploying somewhere with a persistent disk/DB — see §10b.

## 10b. Deploying online (auto-deploy from GitHub)

**The one constraint that decides everything**: `better-sqlite3` writes to the file
`data/apex.db` (created/seeded on first run by `db.ts`). Any host with an *ephemeral*
filesystem — Vercel, Netlify, Render's free tier, anything "serverless" — silently loses
that file on every redeploy, restart or cold start. The app still runs (it reseeds), but
submitted assessments vanish. So a host is only suitable for REAL data if it gives either a
**persistent disk** or a **managed database**.

Three viable shapes, cheapest first:

1. **Free demo hosting, no code change — Render free web service.**
   Connect the GitHub repo once; every push to the branch auto-builds and redeploys.
   Root directory `apex-assessment`, build `npm install && npm run build`, start
   `npm start -- -p $PORT`. Caveats, both from the free tier: no persistent disk (the DB
   resets on redeploy / restart — fine for a demo, just click *Load demo dataset* again),
   and the service sleeps after ~15 min idle, so the first hit takes 30–60 s. Good for
   showing the app; NOT for collecting real assessments.
2. **Real data, still cheap — Render (or any VM/container host) with a persistent disk.**
   Same setup, plus a mounted disk at `apex-assessment/data`; the disk is a paid add-on
   (~$0.25/GB/month) on top of a paid instance (~$7/month) that also removes the sleeping.
   Zero code change: SQLite keeps working exactly as it does locally. This is the least-work
   path to a genuine pilot.
3. **Vercel + a managed database — best Next.js experience, needs the DB swap.**
   Vercel auto-deploys from GitHub and runs Next.js natively, but its filesystem is
   ephemeral, so this REQUIRES replacing SQLite with a hosted DB (Neon/Supabase Postgres, or
   Turso which speaks SQLite) — i.e. rewriting `db.ts` and the query layer in `queries.ts`.
   Also note Vercel's free **Hobby plan forbids commercial use**; a Schneider-owned
   deployment belongs on a paid plan.

Whichever is chosen, set `MOONSHOT_ENABLED=0` in the host's environment variables if the AI
narrative should stay off, and remember the Kimi key is hardcoded in `ai-narrative.ts` — a
public deployment exposes it to anyone who can read the repo, so rotate it or move it to an
env var before putting the app on the open internet.

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
5. **Two fields from the dashboard proposal are built; two additions were reverted.**
   - **Account Type** (`account_managers.account_type`) and **Perf YTD**
     (`account_managers.perf_ytd`) are in the proposal: it names Account Type as a filter and
     lists Perf YTD as an optional column. Both are real columns, set per person under
     "Account details" on their page, filterable/printed on the Population Overview. The
     taxonomy lives in `ACCOUNT_TYPES` and the performance unit in `PERF_YTD_LABEL` /
     `PERF_YTD_SUFFIX` in seed-data.ts, so swapping either for the client's own is one edit.
   - **A "Rubric & scoring" admin page was built and then removed at the client's
     instruction.** It offered editable required levels and a gap-basis toggle
     (weighted vs self). NEITHER was in the proposal; both were added off our own bat in
     response to two observations, and the client rightly pushed back. Do not rebuild either
     without an explicit ask. The observations still stand and are worth raising with them:
     (a) the proposal's example rows imply an average required level of 2.80, which the seeded
     rubric (2.11 / 2.11, only 2 of 22 capabilities at L3) cannot produce; (b) the proposal
     computes Gap as `self - required` while the app uses `weighted - required`, and on the
     demo data that moves 18 of 25 people across the target line. Gap is weighted everywhere.
6. **Two security items were raised with the repo owner and never answered.** They are not
   bugs and were not changed unilaterally, but whoever picks this up should raise them again
   before anything real is loaded into the deployment:
   - the hardcoded Kimi key (§12) is readable by anyone who finds the public repo or the
     deployed bundle; moving it to an env var is a small change the owner has to approve.
   - the seeded superadmin `vladimir` / `apex2026` is reachable on the public Render URL.

## 12. Decisions (do not relitigate without the user)

- SQLite is deliberate (zero infra); move to Postgres only if asked.
- v1 auth is username/password managed by the superadmin; SSO is a later concern.
- Justification is per-cluster (one row per cluster), **replacing** the old per-capability
  evidence note. It is MANDATORY for all three lenses: one note per cluster — self-assessors
  from a guided concrete-example prompt, Manager/APEX Panel free text. (A brief experiment
  split the self note into five separate framework questions; that was reverted to one note.)
- **A distinct comment box per capability was built and then rejected.** The client reported
  that the shared cluster note looked like a per-question box repeating the previous answer,
  and offered two fixes: 22 separate boxes, or clearer labelling. The 22-box version was
  implemented in full (per-capability storage in `ratings.note`, PDF and analysis rendering,
  AI prompt) and then reverted at the client's explicit instruction in favour of the labelling
  fix now in §3. If it is ever revisited: it takes the mandatory count from 6 to 22 per
  assessment, i.e. 450 to 1 650 written paragraphs across a 25-AM campaign, and the notes need
  somewhere to land in the PDF. Do not re-propose it unprompted.
- **Justification wording is deliberately terse.** An earlier version carried a prose
  paragraph, a guidance sentence AND a placeholder that all said "describe a concrete
  example". The client's note was that it was too much text and the strings were near
  identical. The rule now: the lead carries the guidance ONCE, the numbered list carries the
  scope, the placeholder carries only the structure. An e2e check enforces the last part.
- Strength vs development is strict, and measured on the WEIGHTED score: a strength is
  STRICTLY above required; anything below required is a development area; AT required is the
  baseline and is neither. (The PDF's overview card shows the first few with a "+N more"
  pointer; the individual page and the PDF detail table list every one.)
- The lens weighting (Self 20 / Panel 35 / Manager 45) was set by the client. Note it means
  the MANAGER carries the most weight and the self-assessment the least — which supersedes the
  earlier "the APEX Panel is authoritative" rule. Change it in `LENS_WEIGHTS` only.
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
  direct landing, per-cluster notes (wizard + analysis + PDF), the 4-page PDF (cover + narrative
  + definitions), the deterministic narrative and the optional Kimi integration, the lens-aware
  create-user form, the test sandbox, user account deletion, the dev port move to 3010, the
  "Avg APEX maturity" KPI as a rounded level (since replaced by the decimal + its
  benchmark and gap chip), this repo's README, the floating APEX Assistant
  chatbot (role-scoped), uniform-per-region zone colouring, the zone-benchmark AM names + track
  ranking, the strict strengths/development redefinition, the My Feedback tab, the Segment
  attribute + filter and centralized Filters window, fictional demo roster names (legal), the
  single guided concrete-example self-justification note per cluster (which replaced a brief
  five-question variant), and — most recently — the per-lens Question Guide in the wizard,
  assessment scheduling with server-enforced windows, the unrounded Avg column, the
  perception-by-cluster spider chart, and the big colored overall grade on the PDF cover.
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
   required), development areas (all below), perception gaps, the unrounded Avg column and the
   per-cluster justifications; **Export PDF** for the written report (Kimi-written when
   reachable, deterministic otherwise). Set the **Assessment schedule** here — the self and
   manager deadlines and the APEX Panel call date/time — and reopen a submitted assessment
   if someone needs to edit it.
5. Ask the **APEX Assistant** (floating bubble) free-form questions over the full live data.
6. Make the dashboard their own: the **wrench** at its top left turns the page editable in
   place — drag a card to reorder, drag its right edge to resize, hide what they never read —
   and the **Colour** button next to it repaints the accent, the menu bar, the background or
   the cards. Save keeps it, Cancel drops it, Reset returns to the shipped dashboard. It is
   theirs alone: another superadmin still sees the shipped arrangement in Schneider green.

**B. Self-assessor (the KAM being assessed)**
1. Sign in. If their profile is not yet complete → **`/onboarding`**: name, account, region,
   track, and **segment**. Otherwise they go straight to their own assessment.
2. **`/rate/[their AM]`** opens directly (no picking anyone else; `/rate` just redirects here).
   If a panel call is scheduled, an **Upcoming assessment** banner shows its date and time.
   For each of the 22 capabilities they reflect on the two **Question Guide** prompts and pick
   L1/L2/L3 (required levels are hidden), and for each of the 6 clusters they write **one
   concrete-example justification note** from the guided prompt (situation, actions, results,
   impact, and where relevant replication) — mandatory. Everything autosaves.
3. The review screen shows a completion badge per cluster; **Submit** unlocks only once all 22
   are rated and all 6 clusters are fully answered, then the assessment locks.
4. Once their Manager and the APEX Panel have also submitted, a **My Feedback** tab appears:
   their strengths, development areas, self-vs-panel perception gaps, the three-lens table with
   everyone's justifications, and a **Download PDF**. They can also use the Assistant, but it
   only ever sees their own scoped data.

**C. Manager / APEX Panel evaluator**
1. Sign in → **`/rate`**. Build the task list by typing a name to self-assign (or the admin
   pre-assigned them). One evaluator per AM per lens.
2. **`/rate/[amId]`**: each capability screen offers the two lens-specific **Question Guide**
   interview prompts; rate the 22 capabilities and write ONE **mandatory justification note**
   per cluster. An info banner shows the manager's deadline / the panel's call date while the
   window is open; past it the wizard locks read-only (server-enforced). Review → **Submit**
   (blocked until every cluster has a note); the assessment locks.
3. They can view the shared dashboard, but never other evaluators' scores or individual
   results (those stay superadmin-only). The Assistant is fed only their own scoped data.

**D. Anyone who does not know what they are looking at**

Every page carries a **question mark, top right**, with two ways in:

1. **Tutorial mode** opens on a welcome card and then walks the app one part at a time,
   dimming everything except the thing it is describing and waiting to be told to continue.
   It crosses pages on its own — for a superadmin that is the dashboard, Individual Results
   and one individual's page (14 steps, 3 pages); somebody who also rates gets a step on their
   own assessment. The walk is cut to what this reader can actually reach, so an assessor is
   never shown a spotlight on a page that would redirect them. Skip or Escape ends it; a finished tour stays
   finished.
2. **Question mode** stays on until it is turned off, including across navigations, and
   explains whatever the pointer is resting on: not "this is a heat map cell" but *"Account
   Management in Pacific — Weighted 2.18 — req 3.0 · -0.82. Orange: short by half a level to a
   full level."* Both modes read one registry, `src/lib/guide.ts`, so they can never disagree
   about what a number means.

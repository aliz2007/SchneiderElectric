# APEX Assessment — the pitch

What the app is, part by part, and what each part is worth.

---

## The one line

APEX turns a 22-capability sales framework into a running assessment campaign: three people
rate each Account Manager, the app resolves them into one score against the level that
person's track requires, and every gap it finds comes out as a page somebody can act on.

## What it replaces

A capability review today is a spreadsheet. Someone builds it, someone fills it in, someone
chases the people who didn't, and the result is a file that gets opened once. Nobody sees the
population. Nobody can compare one zone to another. The person who was assessed learns
nothing from it. And the training budget goes to whatever was loudest in the last meeting.

APEX is that framework with the spreadsheet removed — and with the three things a spreadsheet
never gives you: a score you can defend, a population view, and a report the assessed person
can actually read.

---

## The model it enforces

- **22 capabilities**, grouped into **6 clusters**.
- **2 tracks** — Acquisition and Saturation — deciding which capabilities apply to whom, and
  what level each one requires. A capability that doesn't apply is dropped, not scored as zero.
- **3 levels** per capability, each with a written anchor, so "level 2" means the same thing
  to a manager in MEA and a panel member in Pacific.
- **3 lenses**: the Account Manager, their manager, the APEX Panel.
- **One score**: **Self 20% · APEX Panel 35% · Manager 45%**.

That weighting is the product's opinion, and it is the right one. Self-rating alone is
optimistic. A manager alone is one person's view of one person. The panel is the calibrated
lens but sees the least day-to-day. Weighting all three keeps the AM's own voice inside the
number without letting it drive.

The score stays a **decimal, everywhere**. A 1.6 and a 2.4 are two different situations, and
rounding both to "level 2" is how a capability review stops being useful.

---

## Part by part

### The assessment itself

One capability per screen. The three level anchors are printed inline, so nobody rates from
memory of what the framework says. Above them sit the two **lens-specific interview
questions** from the Question Guide — a manager and a panel member are prompted to ask
different things about the same capability, which is the point of having both.

It saves as you type. Rate with the 1/2/3 keys, move with the arrows. Twenty-two screens go
fast, and progress is visible the whole way.

**Sell:** the framework is embedded in the flow, not attached as a PDF nobody opens. The
quality of the assessment stops depending on how well each evaluator remembers a training day.

### Required levels are hidden while you rate

The level the track expects is never sent to the browser during an assessment. It appears
only in analysis.

**Sell:** anchoring is the single biggest threat to this kind of data. Show an evaluator the
target and a large share of them rate the target. Hide it and you get an observation instead
of a negotiation. This is enforced server-side, not by hiding a `<div>`.

### Evidence is mandatory, not encouraged

Each of the 6 clusters needs one written justification before the assessment can be submitted.
For the person assessing themselves, the prompt is guided and concrete: the situation, what
they did, the result, the impact, and where relevant how it was replicated. For a manager or
panel member it is a straight one-line lead.

Submit stays disabled until all 22 capabilities are rated **and** all 6 clusters are
justified — and the server checks again on submit, so it cannot be worked around.

**Sell:** a number with no evidence behind it cannot survive a calibration meeting. This is
what makes the panel call a conversation about facts rather than a re-vote. It is also the
part that ends up quoted in the final report.

### Blind by design

Evaluators never see each other's scores. Not while rating, not after, not in the assistant.

**Sell:** three independent readings are only worth having if they were independent. The
moment a manager can see the panel's score, you have one score with two rubber stamps.

### Deadlines that actually hold

Three dates per person: the self deadline, the manager deadline and the APEX Panel call
(date and time). Past its date, that lens goes read-only — enforced in every server action,
not just greyed out in the interface. Clearing a date removes the limit.

**Sell:** a campaign with dates nobody enforces is a campaign that finishes when the last
person feels like it. And every date stays visible on the roster after the fact, so whoever
set the schedule can find it again.

### The dashboard

The population, on one page:

- **Completion KPIs** — how much of the campaign is in, split by lens, plus the population's
  weighted average against the level its tracks require, with the gap as a signed chip. The
  score alone says nothing; next to its benchmark it says everything.
- **Filters** — track, segment, capability, held in the URL. Change one and the map, the heat
  map, the training list, the timeline, the roster and the PDF download all re-scope together.
  One filter, one truth.
- **Geographic zone map** — hubs shaded against each other rather than on an absolute scale,
  because four zone averages sit inside a fraction of a level and an absolute ramp paints them
  all the same green. Blue is strongest, red weakest; the gap figures printed on it are
  absolute.
- **Campaign timeline** — one lane per lens, every deadline as a labelled flag. Red has passed
  with the assessment still open, green is ahead, grey is done. This is the chase list.
- **Recommended training focus** — the capabilities the population is furthest behind on,
  ranked.
- **Capability × zone heat map** — capability down, zone across, each cell carrying the
  weighted score, the required level and the gap. Red cells are collective deficits, and a
  collective deficit is a training programme, not a performance conversation.
- **Roster** — all three assessments and their dates, per person.

**Sell:** this is the view that does not exist today. It is also the view that turns "we
should invest in negotiation training" into "these four zones are short on Pipeline Shaping by
this much, and here is the list".

### The zone benchmark

Every Account Manager in a zone against every capability, sortable, weighted to two decimals,
with the required level under each cell.

**Sell:** zone leadership gets its own page instead of a filtered screenshot of somebody
else's.

### Individual Results

Everyone in one sortable table — weighted score, required average, gap, per-lens averages,
how many capabilities sit below target. Search by name, account or AM code; filter by zone,
track, segment and account type. The name column stays pinned while the rest scrolls.

**Sell:** sort by gap and the top of that table is your intervention list, in one click.

### One person's page

- **Standing** — the weighted score out of 3, coloured by its distance from what the track
  expects, with the expected figure beside it.
- **Perception radar** — all three lenses plus the final score, per cluster, against a dashed
  web showing what this person's track requires. Capabilities that don't apply to their track
  are dropped from the chart rather than dragging it to the centre.
- **Strengths** — strictly above required. At required is baseline, not a strength.
- **Development areas** — everything below required. All of them, uncapped.
- **Perception gaps** — where self and panel differ by a level or more, in either direction.
- **Capability detail** — all three ratings, the unrounded three-lens average, the weighted
  score and the gap, with each cluster's written justifications underneath.

**Sell:** this is the page the panel call runs on. Everything the three evaluators disagreed
about is already isolated, and the evidence for each side is already on screen.

### What the assessed person gets

Their own report — strengths, development areas, the gap between how they see themselves and
how the panel does, the full three-lens table with everyone's written justifications, and the
same PDF the administrator exports. Released only once all three assessments are in.

**Sell:** this is the difference between an assessment and a performance review nobody
believes. The person being measured sees the whole thing, including the disagreements, in
their own words and everyone else's. It is also why they will take the next one seriously.

### The report that leaves the room

A four-page PDF per person: a cover, an overview carrying the overall grade out of 3 —
coloured on a continuous gradient by how far it sits from expected — plus profile, strengths,
development areas, the perception radar and a per-cluster table; then a written narrative with
a definition of every capability it names, followed by the full capability detail with the
justifications.

The narrative is generated from the data itself and needs no AI to work. An AI pass is
available and improves the prose; turn it off and the report is still complete. Nothing in the
document depends on a service being reachable.

**Sell:** the artefact that gets emailed, printed and filed is the one that decides whether
the campaign is taken seriously next year. This one is a document, not a data dump.

### Reports for the population, not just the person

- **APEX Capability Dashboard deck** — global overview, then a radar per zone, per segment and
  per track, each against required level, followed by the largest gaps to close. It honours
  whatever filters are set when you download it.
- **Population Overview** — the account-level table, landscape, with account type and
  performance alongside the capability picture.

**Sell:** leadership asks for a deck. This is the deck, generated from live data in one click,
so it can never disagree with the app.

### Ask it a question

A chat assistant on every page, over the live data. "Which skill gaps are most frequent in
India?" "Does anyone have a perception gap on Pipeline Shaping?" "Which assessments are still
missing?"

It is scoped to whoever is asking. A manager's assistant is fed only what a manager may see —
the data other evaluators produced is not in the payload at all, so it cannot leak what it
never received. It can be switched off entirely with one environment variable.

**Sell:** the population view answers the questions you thought to build a chart for. This
answers the rest.

### Running the campaign

Create evaluators with a picker that adapts to the lens: a self-assessor is linked to the one
account that IS them; a manager or panel member gets a grid of who they assess. Edit
assignments, disable, reset a password, delete an account — with guards, so you cannot delete
yourself or the last administrator, and submitted assessments survive the person who wrote
them.

Two tools worth their weight on day one: a **test sandbox** that creates three blank logins on
one Account Manager so anybody can walk the whole flow from every lens, and a **demo dataset**
that fills the campaign with plausible submitted scores so the dashboards can be shown before
a single real assessment exists.

**Sell:** you can put this in front of a sceptical stakeholder before you have any data, and
in front of a nervous evaluator before they touch a real record.

### Make the dashboard yours

The wrench in the corner turns the dashboard editable in place — the real page, with the real
cards and real numbers in it. Drag to reorder, pull an edge to resize, take off what you never
read. A colour control repaints the accent, the menu, the background or the cards
independently. Save, cancel, or reset to how it shipped.

It is stored per person, so two administrators can arrange the same dashboard differently and
neither moves the other's.

One rule is hard-wired: **chrome follows your colour, results never do.** Green always means
"at or above required" and each lens keeps its own colour, whatever brand you paint the app.
A heat map that reported a different answer depending on a personal setting would be worse
than no heat map.

**Sell:** people use what feels like theirs. And nobody has to justify a colour choice to IT.

### Nobody has to be trained on it

A question mark on every page opens two things:

- **Tutorial mode** — a guided walk through the whole app, one part at a time, dimming
  everything except what it is describing and waiting to be told to continue. It crosses pages
  on its own, and it is cut to what the person taking it is actually allowed to see.
- **Question mode** — a toggle that stays on and explains whatever the pointer rests on.
  Not "this is a heat map cell", but *"Account Management in Pacific — Weighted 2.18 — req 3.0
  · −0.82. Orange: short by half a level to a full level."* Every figure, column, badge and
  control has its own answer.

**Sell:** the reason internal tools fail is not that they are bad, it is that using them costs
a meeting. This one explains itself, to 25 evaluators, at once, forever.

---

## Who can see what

- Evaluators never see each other's scores.
- Required levels are never sent to the browser during an assessment.
- Individual results, the roster, the zone benchmark and every per-person export are
  administrator-only. Everyone else gets the aggregated dashboard, cut to the people they were
  assigned.
- Assessment windows are enforced in every server action, not in the interface.
- The assistant receives a snapshot already scoped to the person asking.

Each of those is enforced on the server and covered by an automated test, because "the button
is hidden" is not access control.

---

## What it costs to run

One Next.js application and one file-backed database. No cluster, no message queue, no
external service required — the AI is optional and the app is fully functional with it off.
A small box with a persistent disk runs a genuine pilot for a few dollars a month; a laptop
runs the whole thing offline for a demo.

162 automated end-to-end checks drive the real interface on every change, so the next person
to touch it can tell in ten minutes whether they broke anything.

---

## What it does not do yet

Worth saying out loud, because it is short:

- The 25-person roster comes from the seeded import. There is no in-app screen yet to add,
  edit or bulk-import Account Managers.
- The sample names are fictional on purpose — no real employee data sits in the demo database.
- A production deployment needs a decision about hosting and a persistent disk, and the AI key
  should move to an environment variable before the app is exposed publicly.

None of these touch the assessment logic. They are the difference between a working product
and a deployed one.

---

## The close

The framework already exists. What has been missing is everything around it: a way to collect
three honest readings, resolve them into one number that survives scrutiny, show the whole
population at once, and hand each person a report they will actually read.

That is this. It runs today, with data in it.

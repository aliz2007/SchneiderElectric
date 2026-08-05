# APEX Assessment — 30-minute call script

A script to read, not notes to improvise from. Roughly 3,400 words of speech, which is about
26 minutes at a normal pace and leaves four for interruptions.

`[bracketed]` lines are what should be on your screen. Everything else is what you say.

**Before you dial:** app running, signed in as superadmin, demo dataset loaded, dashboard on
screen, a second window signed in as an assessor so you never log in and out on camera. Ask
people to hold questions until the end of each section — say so in the first minute and they
will.

---

## 0:00 — Open (1 min)

[dashboard, full screen]

Thanks for the time. Thirty minutes, and by the end you'll have seen the whole application —
not a highlights reel.

Here's the shape of it. First the model the app enforces, which is really the APEX framework
with a few decisions made for it. Then I'll take you through it from three sides: the person
being assessed, the people assessing them, and the people who have to do something with the
result. Then the reports, the admin, and how it's secured.

Stop me whenever. If it's a question about something I'm about to cover I'll say so and come
back to it.

---

## 1:00 — The problem (1.5 min)

[stay on the dashboard]

Let me start with why this exists, because it's not "we needed an app."

Today a capability review is a spreadsheet. Somebody builds it, sends it round, chases the
people who don't fill it in, and ends up with a file. That file gets opened once. Nobody can
see the population in it. Nobody can compare one zone to another. The person who was assessed
learns nothing from it — they were measured and never told what came out. And when it's time
to spend the training budget, the spreadsheet doesn't help, so the money follows whatever was
loudest in the last meeting.

The framework isn't the problem. The framework is good. Everything around it is missing.

So this app does four things a spreadsheet can't. It collects three independent readings on
each person. It resolves them into one score you can defend in a room. It shows you the whole
population at once. And it hands each person a report they'll actually read.

---

## 2:30 — The model (2.5 min)

[stay on the dashboard, or the heat map]

The model, quickly, because everything else follows from it.

Twenty-two capabilities, grouped into six clusters.

Two tracks — Acquisition and Saturation. The track decides two things: which capabilities
apply to that person at all, and what level each one requires of them. That matters. If a
capability doesn't apply to someone's track, it's dropped from their assessment. It isn't
scored zero, and it doesn't drag their average down. A Saturation manager isn't penalised for
not doing an Acquisition job.

Three levels per capability, one to three. Each level has a written anchor — an actual
description of what that looks like in practice. So level two means the same thing to a
manager in MEA and a panel member in Pacific. That's the whole reason the anchors exist.

Three lenses. The Account Manager rates themselves. Their manager rates them. The APEX Panel
rates them.

And one score out of the three: **self twenty percent, APEX Panel thirty-five, manager
forty-five.**

I want to be straight that this weighting is a decision, not a fact. Here's the reasoning.
Self-rating on its own is optimistic — that's not a criticism of anyone, it's just what
self-rating is. A manager on their own is one person's view of one person. The panel is the
calibrated lens, but it sees the least of the day-to-day. Weighting all three keeps the
Account Manager's own voice inside the number without letting it drive the result. If you want
different weights, it's one line in a config file — but I'd argue for these.

Last thing on the model. The score stays a decimal everywhere in the app. It never gets
rounded back to "level two." A one-point-six and a two-point-four are two completely different
situations, and the moment you round both to two, you've thrown away the thing that made the
assessment worth doing.

---

## 5:00 — Being assessed (4 min)

[switch to the assessor window, self-assessor, the wizard]

This is what an Account Manager sees. They sign in and land straight on their own assessment.
There's no list to pick from, nothing to search — for this person there's exactly one thing to
do, so we do it for them.

One capability per screen. Here are the three levels, with the anchor text printed right
there. Nobody's rating from memory of a training day.

And above them — this is the part I'd point at — these are the guiding questions from the
APEX Question Guide, and they change depending on who's rating. The manager gets different
questions from the panel on the same capability. That's the point of having both lenses; if
they're asking the same question, you've collected the same answer twice.

Rate with the number keys, move with the arrows. It saves as you type — nobody loses twenty
minutes of work to a closed tab.

Now, the two decisions in here that I think matter most.

**First: they cannot see the required level while they rate.** It's not hidden in the page,
it's never sent to the browser at all. It only appears later, in analysis.

The reason is anchoring. If you show an evaluator the target, a large share of them rate the
target. You stop collecting an observation and start collecting a negotiation. Hide it and you
get what the person actually thinks.

**Second: evidence is mandatory.** [scroll to the justification block] Under the levels,
there's a written justification for the cluster this capability belongs to. Six clusters, six
notes, and every one of them is required.

For the person assessing themselves, the prompt is guided and concrete — the situation, what
they did, what came out of it, the impact. For a manager or a panel member it's a shorter
lead, because they're describing someone else.

[go to the review screen]

And here's the review screen. Submit is disabled — and it stays disabled until all
twenty-two capabilities are rated and all six clusters are justified. The server checks it
again on submit, so it's not something you can get around by being clever with the browser.

That's deliberate friction, and I'd defend it. A score with no evidence behind it does not
survive a calibration meeting. This is what turns the panel call into a conversation about
facts instead of a re-vote. And these notes are the part that ends up quoted in the final
report.

---

## 9:00 — The other two lenses, and blindness (2 min)

[switch to the manager login, same wizard]

The manager and the panel see the same shape. Same twenty-two screens, same anchors, different
guiding questions, same mandatory justifications.

What they don't see is each other.

No evaluator can see another evaluator's score. Not while rating, not after they've submitted,
and not through any other part of the app. That's enforced on the server, and it's also true
of the AI assistant I'll show you later — the other lenses' numbers aren't in the data it
receives, so it can't leak what it never got.

The reason is simple: three independent readings are only worth having if they were actually
independent. The moment a manager can see the panel's score, you don't have three assessments.
You have one assessment with two signatures on it.

[back to superadmin, an individual page, open the schedule editor]

Last thing on collection: dates. Every person gets three — a self deadline, a manager
deadline, and the APEX Panel call, with a time on it.

Past its date, that lens goes read-only. Not greyed out in the interface — refused by the
server. And every date stays visible on the roster afterwards, including the ones that have
already passed, so whoever set the schedule can always find it again.

A campaign with deadlines nobody enforces finishes whenever the last person feels like it.

---

## 11:00 — The campaign view (5 min)

[dashboard]

Now the other side. This is the view that doesn't exist today.

Start at the top. **Completion.** How much of the campaign is in, and how it splits across the
three lenses — so you know whether you're chasing self-assessments or chasing panels, which
are two very different conversations.

Then the population's weighted average. And next to it, deliberately, the average level its
tracks require, and the gap between them as a signed chip. A score on its own tells you
nothing. Two-point-one is meaningless. Two-point-one against a requirement of two-point-eight
is a plan.

**Filters.** Track, segment, capability. And the important bit — they don't filter one card,
they re-scope the entire page. The map, the heat map, the training list, the timeline, the
roster, and the PDF you download all move together. One filter, one version of the truth.
There's no way to end up in a meeting with two charts that disagree because someone filtered
one of them.

**The zone map.** Hubs shaded against each other rather than against a fixed scale. That was
a real decision: the four zone averages sit inside a fraction of a level, so on an absolute
scale all four came out the same green and the map compared nothing. Blue is the strongest,
red the weakest, and the gap figures printed on it are absolute so you still get the real
numbers.

**The timeline.** One lane per lens, every deadline as a flag. Red has passed with the
assessment still open, green is still ahead, grey is done. This is your chase list — you don't
have to build it, it's just there.

**Recommended training focus.** The capabilities the population is furthest behind on, ranked.

**And the heat map.** Capability down the side, zone across the top. Every cell carries the
weighted score, the level required, and the gap. Red cells are collective deficits.

I'd sit on that word — *collective*. A single person below required is a coaching
conversation. A whole column below required is a training programme. This is the chart that
tells you which one you're looking at, and it's the chart that turns "we should invest in
negotiation training" into "these zones are short on Pipeline Shaping by this much, here's the
list of people, here's what it would cost to close."

[click into a zone]

And each zone has its own page — every Account Manager in it against every capability, with
what each one is required to hit. Zone leadership gets a real view instead of a screenshot of
someone else's.

---

## 16:00 — One person (5 min)

[Individual Results]

From population to person.

Everyone in one table. Weighted score, what they're required to average, the gap, each lens
separately, and how many capabilities are below target. Search by name, account or code.
Filter by zone, track, segment, account type.

Sort by gap — [click it] — and the top of that table is your intervention list. That's it,
that's the whole workflow.

[open an individual]

And this is one person's page. This is the page a panel call runs on, so let me take it
properly.

**The standing.** Weighted score out of three, coloured by how far it sits from what their
track expects, with the expected figure right next to it.

**The radar.** All three lenses, plus the final weighted score, per cluster — against the
dashed line, which is what this person's track requires. So you're not reading four numbers,
you're reading a shape against a target. And capabilities that don't apply to their track are
dropped from the chart entirely, rather than being plotted at zero and pulling the whole thing
into the middle.

**Strengths.** Strictly above required. Not at required — above it. Being exactly where the
job asks you to be is the baseline; calling it a strength is how these reports become
meaningless.

**Development areas.** Everything below required. All of them. We don't cap it at a tidy three
bullet points, because if someone is short on nine capabilities, showing them three is a
misrepresentation.

**Perception gaps.** Where the person and the panel differ by a level or more — in both
directions. Someone who rates themselves well below the panel is as much of a conversation as
someone who rates themselves above it, and usually a more urgent one.

**And the detail.** [scroll] All three ratings per capability, the three-lens average, the
weighted score, the gap. And underneath each cluster, the written justifications — everyone's,
side by side.

That's why this is the page the call runs on. Every disagreement is already isolated, and the
evidence each side gave is already on the screen. Nobody's scrolling through a spreadsheet
looking for what the manager wrote.

[if you have a self-assessor login handy: My Feedback]

One more, and I think it's the one that decides whether people take the second campaign
seriously. The person who was assessed gets their own version of this — strengths, development
areas, where their self-rating and the panel's diverged, the full table, everyone's written
justifications, and the same PDF.

It's released only once all three assessments are in. And it's the whole thing, including the
parts where people disagreed with them.

That's the difference between an assessment and a performance review nobody believes.

---

## 21:00 — What leaves the room (3.5 min)

[open the individual PDF]

Whatever happens in the app, something gets emailed, printed and filed. That artefact decides
how seriously this is taken next year, so we treated it as a real deliverable.

Four pages per person.

Cover. Then the overview — the overall grade out of three, big, coloured on a continuous
gradient by how far it sits from expected. Not four colour buckets: continuous, so someone
slightly below target doesn't get painted the same red as someone a full level down. Under it,
the profile, strengths, development areas, the radar, and a per-cluster table.

Then a written narrative, with a definition of every capability it names — because the person
reading it isn't necessarily fluent in the framework. And in the same flow, the full
capability detail with the written justifications.

Now, the narrative. It's generated from the data itself and needs no AI at all. There's an
optional AI pass that makes the prose better, and if it's switched off — or the service is
down, or you'd rather it never ran — the report is still complete. Nothing in this document
depends on an external service being reachable. That was deliberate.

[population deck]

And for leadership, two population reports. The capability deck — a global overview, then a
radar per zone, per segment and per track, each against required level, then the biggest gaps
to close. And it honours whatever filters you had set when you downloaded it.

Plus an account-level overview table, landscape, with account type and performance alongside
the capability picture.

The point of these being generated rather than built by hand is that they can never disagree
with the app. Nobody's rebuilding the deck in PowerPoint from last month's numbers.

---

## 24:30 — Ask it a question (1.5 min)

[open the assistant]

There's an assistant on every page, over the live data.

"Which skill gaps are most frequent in India." "Does anyone have a perception gap on Pipeline
Shaping." "Which assessments are still missing."

Two things about it. It's scoped to whoever's asking — a manager's assistant is given only
what a manager is allowed to see, so it isn't filtering sensitive data out of an answer, it
never received it. And it can be switched off completely with one setting, with no effect on
anything else.

The dashboards answer the questions somebody thought to build a chart for. This is for the
rest.

---

## 26:00 — Running it (1.5 min)

[Users & Access]

Administration. Create an evaluator and the form adapts to their lens — a self-assessor gets
linked to the one account that *is* them, a manager or panel member gets a grid of who they
assess. Edit assignments, disable someone, reset a password, delete an account. With guards:
you can't delete yourself, you can't delete the last administrator, and submitted assessments
survive the person who wrote them.

Two things down here that are worth more than they look. A **test sandbox** — one click, three
blank logins on one Account Manager, so anyone can walk the entire flow from all three sides
without touching real data. And a **demo dataset** that fills the whole campaign with
plausible submitted scores.

Which means you can show this to a sceptical stakeholder before you have any data at all, and
you can let a nervous evaluator practise before they touch a real record. Both of those come
up in every rollout.

---

## 27:30 — Two things people don't expect (1.5 min)

[dashboard, click the wrench]

Two smaller things, quickly.

This dashboard is arrangeable. Not a settings screen — the real page becomes editable. Drag
cards, resize them, take off the ones you never read, recolour the app. It saves per person,
so two administrators can have completely different dashboards and neither one moves the
other's.

One rule is hard-wired: your colours change the interface, never the results. Green always
means at or above required, whatever you paint the app. A heat map that gave a different
answer depending on somebody's personal setting would be worse than having no heat map.

[click the question mark]

And this. Two modes. Tutorial mode walks somebody through the whole app one part at a time,
highlighting what it's describing and waiting for them to say they've read it — and it's cut
to what that person is actually allowed to see. Question mode you leave on, and it explains
whatever you point at. Not "this is a heat map cell" — it names the capability, the zone, the
score, the requirement, the gap, and what the colour means.

Internal tools don't fail because they're bad. They fail because using them costs a meeting.
This one explains itself, to everyone, at once, permanently.

---

## 29:00 — Where it stands (1 min)

[dashboard]

To close, three things.

**Security.** Evaluators never see each other. Required levels never reach the browser during
an assessment. Individual results and every per-person export are administrator-only —
everyone else gets the aggregated view, cut to the people they were assigned. Deadlines are
enforced by the server. All of that is server-side and covered by automated tests, because "we
hid the button" isn't access control.

**What it needs.** One application, one database file. No cluster, no external service
required. A small server with a persistent disk runs a real pilot; a laptop runs the whole
thing offline.

**What isn't built.** The roster came from the original import — there's no screen yet to add
or bulk-import Account Managers. The sample names in the demo are fictional on purpose. And a
public deployment needs a hosting decision and one key moved into configuration. None of that
touches the assessment logic; it's the gap between a working product and a deployed one.

The framework already existed. What was missing was everything around it. That's what this is,
and it runs today with data in it.

Questions.

---

## Appendix — answers you'll need

**"Can we change the weights?"** Yes — one constant, and every score, chart and PDF in the app
follows it. I'd want a conversation before you do, because the three lenses are weighted for a
reason, not for balance.

**"What stops someone rating themselves a three on everything?"** Three things. They're only
twenty percent. They have to write a concrete example for every cluster, which is much harder
to fake than a number. And the perception-gap section on their page shows exactly where their
rating and the panel's diverge, in both directions — so over-rating is visible rather than
buried.

**"Does the manager see what the panel gave?"** No. Never. Not during, not after.

**"Do we depend on the AI?"** No. The written narrative is generated from the data. The AI
improves the prose and can be switched off entirely; every report still generates.

**"Where does the data live?"** A single database file with the application. Nothing leaves it
unless the AI narrative is switched on, and that can be turned off.

**"Can it handle more than twenty-five people?"** Yes. Nothing here is sized for twenty-five —
that's just the current roster. What isn't built yet is the screen to bulk-load a bigger one.

**"How long does an assessment take?"** Twenty-two capabilities and six written notes. Call it
thirty to forty minutes done properly, and the writing is most of it — which is the intent.

**"What if someone misses their deadline?"** Their lens locks. An administrator can clear or
move the date, and can reopen a submitted assessment if something needs correcting.

**"Is it in French?"** Not currently. The interface text is in one place, so it's a
translation job rather than a rebuild.

---

## If you're running behind

Cut in this order — each one costs you the least next:

1. The zone page (11:00 block) — say the sentence, don't click into it.
2. The administration section (26:00) — one line: "user management, plus a sandbox and a demo
   dataset so people can practise."
3. The arrangeable dashboard (27:30) — keep the help modes, drop the wrench.
4. The population reports (21:00) — show the individual PDF, name the other two.

Never cut: the hidden required levels, the mandatory evidence, blindness between evaluators,
or the heat map. Those four are the argument.

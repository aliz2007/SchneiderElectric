/**
 * What the app says about itself.
 *
 * Two things read this file. The TOUR walks somebody through the product once, in order,
 * spotlighting each part as it explains it. QUESTION MODE answers "what is this?" about
 * whatever the pointer is resting on. They share a file because they are the same knowledge
 * asked for in two different ways, and because two copies of an explanation drift apart the
 * first time a number changes meaning.
 *
 * Both are keyed to CSS SELECTORS rather than to components. That is a deliberate trade: it
 * costs nothing at runtime and adds no props to any of the 40-odd files being explained, but
 * it means a renamed class silently loses its explanation. The e2e suite therefore asserts
 * that a sample of these selectors still matches something on a rendered page — if you
 * rename a class, that check is what tells you.
 *
 * Client-safe: no database, no server imports.
 */

export type Placement = "auto" | "center";

export type TourStep = {
  id: string;
  /** where this step lives; the tour navigates when the route changes */
  route: string;
  /** what to spotlight. Absent = a full-screen card, used for the welcome and the finish. */
  selector?: string;
  title: string;
  body: string;
  placement?: Placement;
};

export type HelpEntry = {
  /** matched with element.closest(), so it may be any valid selector */
  sel: string;
  title: string;
  body: string;
};

export type TourAudience = {
  isAdmin: boolean;
  /** the person also has an assessment of their own to fill in */
  hasLens: boolean;
  /** an Account Manager whose individual page can be shown, if there is one */
  amId: number | null;
};

/**
 * The guided tour, in order.
 *
 * Only steps whose page this person can reach — walking a manager through the superadmin's
 * table would spotlight a redirect.
 *
 * Every line states a fact: a weighting, a threshold, what a colour means, what a click
 * does. Nothing here describes the tour, congratulates the reader, or says a card is useful.
 * If a sentence would survive being deleted, delete it.
 */
export function buildTour({ isAdmin, hasLens, amId }: TourAudience): TourStep[] {
  const steps: TourStep[] = [
    {
      id: "welcome",
      route: "/analysis",
      title: "Welcome to APEX",
      body: "22 capabilities, rated by three people: the Account Manager, their manager, and the APEX Panel. Every score is weighted Self 20% · Panel 35% · Manager 45%.",
      placement: "center",
    },
    {
      id: "nav",
      route: "/analysis",
      selector: ".sidebar .nav",
      title: "Navigation",
      body: "Dashboard is the whole population. What else appears depends on your role.",
    },
    {
      id: "navfold",
      route: "/analysis",
      selector: ".nav-toggle",
      title: "Fold the menu",
      body: "Hides the menu and widens the page. Stays folded until you bring it back.",
    },
    {
      id: "kpis",
      route: "/analysis",
      selector: '.dash-block[data-block="kpis"]',
      title: "Campaign KPIs",
      body: "Submissions received, split by who was asked. The last tile is the population's weighted average against the level its tracks require.",
    },
    {
      id: "filters",
      route: "/analysis",
      selector: '.dash-block[data-block="filters"]',
      title: "Filters",
      body: "Track, segment, capability. Scopes every card below it and the PDF download.",
    },
  ];

  if (isAdmin) {
    steps.push(
      {
        id: "map",
        route: "/analysis",
        selector: '.dash-block[data-block="map"]',
        title: "Zone map",
        body: "Hubs are shaded against each other, not on an absolute scale — four zone averages sit within a fraction of a level and would otherwise come out one colour. Blue is the strongest, red the weakest. The gap figures are absolute.",
      },
      {
        id: "report",
        route: "/analysis",
        selector: '.dash-block[data-block="report"]',
        title: "PDF deck",
        body: "Zone, segment and track radars plus the biggest gaps. Honours the filters.",
      }
    );
  }

  steps.push(
    {
      id: "timeline",
      route: "/analysis",
      selector: '.dash-block[data-block="timeline"]',
      title: "Timeline",
      body: "One lane per assessment. Each marker is a deadline; the bracket is how many people share that day. Red has passed with the assessment open, green is ahead, grey is done.",
    },
    {
      id: "heatmap",
      route: "/analysis",
      selector: '.dash-block[data-block="heatmap"]',
      title: "Heat map",
      body: "Capability down, zone across. Each cell carries the weighted score, the required level and the gap. Red cells are collective deficits.",
    },
    {
      id: "roster",
      route: "/analysis",
      selector: '.dash-block[data-block="roster"]',
      title: isAdmin ? "Roster" : "Your people",
      body: isAdmin
        ? "All three assessments and their deadlines, per person. Click a name for the full analysis."
        : "The Account Managers assigned to you, and where each assessment stands. You see no others.",
    }
  );

  if (isAdmin) {
    steps.push({
      id: "wrench",
      route: "/analysis",
      selector: ".wrench",
      title: "Arrange the dashboard",
      body: "Drag cards to reorder, pull a right edge to resize, × to take one off. Colour repaints the app. Your view only.",
    });
    steps.push({
      id: "individuals",
      route: "/analysis/individuals",
      selector: "table.table",
      title: "Individual results",
      body: "Everyone, with weighted score, required level and gap. Click a heading to sort; gap puts the largest shortfalls first.",
    });
    if (amId != null) {
      steps.push(
        {
          id: "standing",
          route: `/analysis/am/${amId}`,
          selector: ".standing-card",
          title: "One person's standing",
          body: "Weighted score out of 3. The chart plots each lens per theme against the dashed line, which is what this person's track requires.",
        },
        {
          id: "detail",
          route: `/analysis/am/${amId}`,
          selector: ".card:has(.card-title)",
          title: "Capability detail",
          body: "All three ratings per capability, with the weighted score and the gap. Where the three disagree is what the panel call is for.",
        }
      );
    }
  }

  if (hasLens) {
    steps.push({
      id: "rate",
      route: "/rate",
      selector: ".main",
      title: "Your assessment",
      body: "Pick the level that describes what the person does now, not what you want. Each theme also needs one written example.",
    });
  }

  steps.push({
    id: "done",
    route: "/analysis",
    title: "Done",
    body: "Question mode, in the same menu, explains anything where it sits.",
    placement: "center",
  });

  return steps;
}

/**
 * Question mode's answers.
 *
 * Roughly specific-to-general, though the lookup does not rely on order: it keeps the
 * DEEPEST match, so a number inside a card explains the number.
 *
 * There is no generic fallback for cards, tables or headings. An entry that says "this is a
 * card, its title says what it holds" costs a reader a hover and returns nothing, and enough
 * of them turn the feature into noise. Silence is the better answer.
 */
export const HELP_ENTRIES: HelpEntry[] = [
  // ---- numbers and chips ----
  {
    sel: ".kpi-value",
    title: "Campaign figure",
    body: "A count across the whole population. The figure after the slash is the total it is measured against.",
  },
  {
    sel: ".kpi-bench",
    title: "Against expected",
    body: "The average level the tracks require, and the difference from the actual average. Green is at or above it.",
  },
  {
    sel: ".standing-value",
    title: "Weighted score",
    body: "Out of 3, weighted Self 20% · APEX Panel 35% · Manager 45%. Every strength, gap and training recommendation derives from this number.",
  },
  {
    sel: "td.cell",
    title: "Heat map cell",
    body: "Weighted score for this capability in this zone, with the required level and the gap. Green at or above required, amber under half a level short, orange up to a level, red more.",
  },
  {
    sel: ".lvl-chip",
    title: "Level",
    body: "L1 developing, L2 practising, L3 leading. A decimal is a weighted average of the three lenses, so 2.4 and 1.6 are different answers that would both round to 2.",
  },
  { sel: ".badge-green", title: "Submitted", body: "In and locked. A superadmin can reopen it from the person's page." },
  {
    sel: ".badge-amber",
    title: "Draft",
    body: "Capabilities rated so far, out of 22. Nothing reaches the assessed person until the whole assessment is submitted.",
  },
  { sel: ".badge-red", title: "Overdue", body: "The deadline has passed and this assessment is still open." },
  {
    sel: ".badge-sched",
    title: "Deadline",
    body: "Set per person on their individual page. The self and manager dates close those assessments; the panel date is when the call happens.",
  },
  { sel: ".badge-zone", title: "Zone", body: "The Schneider hub: MEA, SAM, India or Pacific." },
  {
    sel: ".badge-track",
    title: "Track",
    body: "Acquisition or Saturation. It decides which capabilities apply and at what level, so identical ratings on two tracks give different gaps.",
  },
  { sel: ".badge-segment", title: "Segment", body: "The account's business segment, used to compare like with like." },
  { sel: ".lens-dot", title: "Lens", body: "Violet self, blue manager, magenta APEX Panel, white required." },

  // ---- charts ----
  {
    sel: ".radar-svg",
    title: "Profile chart",
    body: "One axis per theme. Thin webs are the three lenses, the thick green web is the weighted score, the dashed outline is the required level. Inside the dashed line is short.",
  },
  { sel: ".radar-legend", title: "Key", body: "Matches the dots used in the tables on this page." },
  {
    sel: ".zmap-svg, .zmap-wrap",
    title: "Zone map",
    body: "Shaded against the other zones rather than absolutely — on an absolute ramp all four land on one colour. Hover a hub for its figures, click a zone to focus.",
  },
  { sel: ".tl", title: "Timeline", body: "One lane per assessment on a single date axis." },
  { sel: ".tl-mark", title: "Deadline", body: "Red has passed with the assessment open, green is ahead, grey is submitted. Hover for whose." },

  // ---- controls ----
  { sel: ".filter-toggle, .filter-panel", title: "Filters", body: "Track, segment, capability. Scopes every card on the page and the PDF." },
  {
    sel: ".wrench",
    title: "Arrange",
    body: "Drag cards to reorder, pull a right edge to resize, × to take one off, Colour to repaint the app. Your view only.",
  },
  { sel: ".nav-toggle", title: "Fold the menu", body: "Hides the menu and widens the page." },
  {
    sel: ".dash-resize",
    title: "Resize",
    body: "Pull to a third, a half or the full width — only the widths this card stays readable at.",
  },
  { sel: ".nav-link", title: "Navigation", body: "What appears here depends on your role." },
  { sel: ".th-sort", title: "Sortable column", body: "Click to sort by it, click again to reverse." },
  { sel: ".hm-scroll", title: "Scrolls sideways", body: "Wider than the window. The first column stays put as you scroll." },

  // ---- assessment ----
  {
    sel: ".level-card",
    title: "Level",
    body: "Pick what the person does today. The required level is hidden while you rate so it cannot pull the answer towards it.",
  },
  {
    sel: ".framework-block, .framework-note",
    title: "Justification",
    body: "One concrete example per theme: the situation, what they did, what came of it. This is what the panel call reviews.",
  },
  { sel: ".wizard-top, .progress", title: "Progress", body: "Answers save as you go. Nothing is visible to anyone else until you submit." },

  // ---- whole cards, when the pointer is on their margin ----
  {
    sel: '.dash-block[data-block="kpis"]',
    title: "Campaign KPIs",
    body: "Submissions by lens, and the population's weighted average against what its tracks require.",
  },
  { sel: '.dash-block[data-block="heatmap"]', title: "Heat map", body: "Capability by zone. Red cells are collective deficits." },
  { sel: '.dash-block[data-block="roster"]', title: "Roster", body: "Where each person's three assessments stand, with their deadlines." },
  { sel: '.dash-block[data-block="priorities"]', title: "Training focus", body: "The largest zone-level deficits, worst first." },
  { sel: ".sidebar", title: "Menu", body: "Everything your role can reach. Foldable from the button at its edge." },
];

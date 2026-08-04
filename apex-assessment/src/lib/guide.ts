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
 * Only steps whose page this person can actually reach are included — walking a manager
 * through the superadmin's individual-results table would spotlight a redirect.
 */
export function buildTour({ isAdmin, hasLens, amId }: TourAudience): TourStep[] {
  const steps: TourStep[] = [
    {
      id: "welcome",
      route: "/analysis",
      title: "Welcome to APEX",
      body:
        "APEX measures 22 capabilities for every Strategic Account Manager, through three pairs of eyes: their own, their manager's, and the APEX Panel's. This takes about a minute and shows you each part of the app as it explains it.",
      placement: "center",
    },
    {
      id: "nav",
      route: "/analysis",
      selector: ".sidebar .nav",
      title: "Getting around",
      body:
        "Everything lives behind these. The Dashboard is the whole population at a glance; the other entries appear according to what you are allowed to see and what you have been asked to do.",
    },
    {
      id: "navfold",
      route: "/analysis",
      selector: ".nav-toggle",
      title: "More room when you need it",
      body: "Folds the menu away and gives the page the full width of the window. It stays folded until you bring it back.",
    },
    {
      id: "kpis",
      route: "/analysis",
      selector: '.dash-block[data-block="kpis"]',
      title: "Where the campaign stands",
      body:
        "How much of the campaign has come in, broken down by who was asked. The last tile is the one to watch: the average weighted score across everyone, against the level their tracks expect.",
    },
    {
      id: "filters",
      route: "/analysis",
      selector: '.dash-block[data-block="filters"]',
      title: "One set of filters, every card",
      body:
        "Track, segment and capability. Whatever you choose here scopes every card below it and the PDF you download, so the deck always matches what you were looking at.",
    },
  ];

  if (isAdmin) {
    steps.push(
      {
        id: "map",
        route: "/analysis",
        selector: '.dash-block[data-block="map"]',
        title: "The zones, compared",
        body:
          "Each hub is shaded against the OTHER zones rather than on an absolute scale, because four zone averages land within a fraction of a level of each other and would otherwise all come out the same colour. Blue is the strongest gap in view, red the weakest. The gap figures themselves are absolute.",
      },
      {
        id: "report",
        route: "/analysis",
        selector: '.dash-block[data-block="report"]',
        title: "The deck",
        body: "The same analysis as a PDF: zone, segment and track radars, plus the biggest gaps to close. It honours the filters, so download what you are looking at.",
      }
    );
  }

  steps.push(
    {
      id: "timeline",
      route: "/analysis",
      selector: '.dash-block[data-block="timeline"]',
      title: "What is due, and what has slipped",
      body:
        "One lane per assessment. Each marker is a deadline with its date on it, and the number in brackets is how many people share that day. Red has passed with the assessment still open, green is still ahead, grey is done.",
    },
    {
      id: "heatmap",
      route: "/analysis",
      selector: '.dash-block[data-block="heatmap"]',
      title: "Where the training should go",
      body:
        "Capability down the side, zone across the top. Every cell carries the weighted score, the level required, and the gap between them. Red cells are collective deficits — that is what this whole page is for.",
    },
    {
      id: "roster",
      route: "/analysis",
      selector: '.dash-block[data-block="roster"]',
      title: "Who has done what",
      body: isAdmin
        ? "Every Account Manager, with each of the three assessments and their deadlines. Click a name to open that person's full analysis."
        : "The people you were assigned, with where each assessment stands. You only ever see your own.",
    }
  );

  if (isAdmin) {
    steps.push({
      id: "wrench",
      route: "/analysis",
      selector: ".wrench",
      title: "Make this dashboard yours",
      body:
        "This turns the dashboard editable: drag the cards into the order you want, pull a card's right edge to resize it, and switch off the ones you never look at. The Colour button behind it repaints the app. It is your view only — nobody else's dashboard moves.",
    });
    steps.push({
      id: "individuals",
      route: "/analysis/individuals",
      selector: "table.table",
      title: "Everyone, in one table",
      body:
        "The whole population with their weighted score, the level required, and the gap. Click any column heading to sort by it — sorting by gap puts whoever needs the most support at the top.",
    });
    if (amId != null) {
      steps.push(
        {
          id: "standing",
          route: `/analysis/am/${amId}`,
          selector: ".standing-card",
          title: "One person's standing",
          body:
            "The headline score is weighted: Self 20%, APEX Panel 35%, Manager 45%. The chart beside it plots each lens per theme against the dashed line, which is the level this person's track expects.",
        },
        {
          id: "detail",
          route: `/analysis/am/${amId}`,
          selector: '.card:has(.card-title)',
          title: "Capability by capability",
          body:
            "Every capability with all three ratings, the weighted score and the gap. Where the three disagree is usually the most useful conversation in the whole assessment.",
        }
      );
    }
  }

  if (hasLens) {
    steps.push({
      id: "rate",
      route: "/rate",
      selector: ".main",
      title: "Your own assessment",
      body:
        "This is where you rate. Each capability has three written levels — pick the one that describes what the person actually does, not what you hope they do. Every theme also asks for a short justification with a concrete example.",
    });
  }

  steps.push({
    id: "done",
    route: "/analysis",
    title: "That is the whole app",
    body:
      "Anything you are unsure about later: open the same question mark and turn on Question mode, then point at whatever is puzzling you and it will explain itself.",
    placement: "center",
  });

  return steps;
}

/**
 * Question mode's answers.
 *
 * Ordered roughly specific-to-general, though the lookup does not rely on that: it takes
 * every entry whose selector the pointer is inside and keeps the DEEPEST match, so a number
 * inside a card explains the number rather than the card.
 */
export const HELP_ENTRIES: HelpEntry[] = [
  // ---- numbers and chips: the things people actually point at ----
  {
    sel: ".kpi-value",
    title: "Campaign figure",
    body: "A live count across the whole population. The small number after the slash is the total it is being measured against.",
  },
  {
    sel: ".kpi-bench",
    title: "Against what is expected",
    body: "The average level the tracks require, and the difference between that and the actual average. Green means the population is at or above what its tracks ask for; red means it is short.",
  },
  {
    sel: ".standing-value",
    title: "Weighted score",
    body: "This person's overall score out of 3, weighted Self 20% · APEX Panel 35% · Manager 45%. It is the number every strength, gap and training recommendation is derived from.",
  },
  {
    sel: "td.cell",
    title: "One cell of the heat map",
    body: "The weighted score for this capability in this zone, with the level required underneath and the gap between them. Green is at or above required; amber is slightly short; orange is a level short; red is more than a level short.",
  },
  {
    sel: ".lvl-chip",
    title: "A level",
    body: "L1 is developing, L2 is practising, L3 is leading. Where the chip shows a decimal it is a weighted average of the three lenses rather than one person's rating, so 2.4 and 1.6 are genuinely different even though both would round to 2.",
  },
  {
    sel: ".badge-green",
    title: "Submitted",
    body: "This assessment is in and locked. It can be reopened by a superadmin from the person's individual page if it needs revising.",
  },
  {
    sel: ".badge-amber",
    title: "A draft in progress",
    body: "The count is how many of the 22 capabilities have been rated so far. Nothing is visible to the assessed person until the whole thing is submitted.",
  },
  {
    sel: ".badge-red",
    title: "Overdue",
    body: "The deadline has passed and this assessment has still not been submitted.",
  },
  {
    sel: ".badge-sched",
    title: "A scheduled date",
    body: "A deadline set per person on their individual page. The self and manager deadlines close those two assessments; the panel date is when the assessment call happens.",
  },
  {
    sel: ".badge-zone",
    title: "Zone",
    body: "Which Schneider hub this Account Manager belongs to: MEA, SAM, India or Pacific.",
  },
  {
    sel: ".badge-track",
    title: "Track",
    body: "Acquisition or Saturation. The track decides which capabilities apply and what level each one requires, so two people with identical ratings can have very different gaps.",
  },
  {
    sel: ".badge-segment",
    title: "Segment",
    body: "The business segment the account sits in. Used to compare like with like across the population.",
  },
  {
    sel: ".lens-dot",
    title: "Which lens",
    body: "Violet is the person's own view, blue is their manager's, magenta is the APEX Panel's, and white is the level their track requires.",
  },

  // ---- charts ----
  {
    sel: ".radar-svg",
    title: "The profile chart",
    body: "One axis per theme. Each web is one lens, the thick green web is the final weighted score, and the dashed white outline is the level this person's track expects. Where a web sits inside the dashed line, that theme is short.",
  },
  {
    sel: ".radar-legend",
    title: "Chart key",
    body: "Which colour is which lens. These match the dots used in the tables further down the same page.",
  },
  {
    sel: ".zmap-svg, .zmap-wrap",
    title: "Zone performance map",
    body: "Each hub is shaded against the other zones in view rather than on an absolute scale — four zone averages sit within a fraction of a level of each other, so an absolute ramp would paint them all the same colour. Hover a hub for its figures, click a zone to focus on it.",
  },
  {
    sel: ".tl",
    title: "Campaign timeline",
    body: "One lane per assessment across a single date axis. Each marker is a deadline labelled with its date; the number in brackets is how many people share that day.",
  },
  {
    sel: ".tl-mark",
    title: "A deadline",
    body: "Red has passed with the assessment still open, green is still ahead, grey is already submitted. Hover it to see who it belongs to.",
  },

  // ---- controls ----
  {
    sel: ".filter-toggle, .filter-panel",
    title: "Filters",
    body: "Track, segment and capability. Whatever you pick scopes every card on the page at once, and the PDF download honours it too.",
  },
  {
    sel: ".wrench",
    title: "Arrange this dashboard",
    body: "Turns the dashboard editable: drag cards to reorder them, pull a right edge to resize, × to take one off, and a Colour button to repaint the app. Your view only — nobody else's dashboard changes.",
  },
  {
    sel: ".nav-toggle",
    title: "Fold the menu away",
    body: "Hides the left-hand menu and gives the page the full window. It stays that way until you bring it back.",
  },
  {
    sel: ".dash-resize",
    title: "Resize handle",
    body: "Pull this to make the card narrower or wider. It snaps to a third, a half or the full width — and only to the widths that particular card is still readable at.",
  },
  {
    sel: ".nav-link",
    title: "Navigation",
    body: "What you see here depends on your role: analysis and administration for superadmins, your own assessment tasks for everyone else.",
  },
  {
    sel: ".btn-primary, .btn",
    title: "Action",
    body: "Buttons in this colour are the main action of whatever card they sit in.",
  },
  {
    sel: ".th-sort",
    title: "Sortable column",
    body: "Click the heading to sort by this column; click again to reverse it. Sorting by gap brings whoever needs the most support to the top.",
  },
  {
    sel: ".hm-scroll",
    title: "Scrolls sideways",
    body: "This table is wider than the window. Scroll it horizontally — the first column stays put so you never lose the row you are reading.",
  },

  // ---- assessment ----
  {
    sel: ".level-card",
    title: "One level",
    body: "Pick the description that matches what this person actually does today. The level required for their track is deliberately hidden while you rate, so it cannot pull your answer towards it.",
  },
  {
    sel: ".framework-block, .framework-note",
    title: "Justification",
    body: "Every theme needs a short written example: the situation, what they did, and what came of it. This is what makes the rating defensible in the panel call.",
  },
  {
    sel: ".wizard-top, .progress",
    title: "How far through you are",
    body: "Your answers save as you go, so you can leave and come back. Nothing is visible to anyone else until you submit.",
  },

  // ---- the big surfaces, as a fallback ----
  {
    sel: '.dash-block[data-block="kpis"]',
    title: "Campaign KPIs",
    body: "How much of the campaign has been submitted, split by who was asked, plus the population's average weighted maturity against what its tracks expect.",
  },
  {
    sel: '.dash-block[data-block="heatmap"]',
    title: "Training-needs heat map",
    body: "Capability by zone. Red cells are collective deficits — the places where a training programme would help the most people at once.",
  },
  {
    sel: '.dash-block[data-block="roster"]',
    title: "Roster",
    body: "Where each person's three assessments stand, with their deadlines.",
  },
  {
    sel: '.dash-block[data-block="priorities"]',
    title: "Recommended training focus",
    body: "The largest zone-level deficits, worst first. Read it as a shortlist of what to fix.",
  },
  { sel: ".sidebar", title: "The menu", body: "Everything you can reach, according to your role. It can be folded away with the button at its edge." },
  { sel: ".page-head", title: "Where you are", body: "The page you are on and a sentence on what it is for." },
  { sel: ".card", title: "A card", body: "One self-contained piece of the page. Its title says what it holds and the line underneath says how to read it." },
  { sel: "table", title: "A table", body: "Point at any individual figure inside it for what that particular number means." },
];

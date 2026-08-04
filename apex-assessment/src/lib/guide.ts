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

export type Answer = { title: string; body: string };

export type HelpEntry = {
  /** matched with element.closest(), so it may be any valid selector */
  sel: string;
  title?: string;
  body?: string;
  /**
   * For elements that repeat and mean something different each time.
   *
   * A heat-map cell means a different thing in every row and column; the five KPI tiles count
   * five different things; every cell of a table belongs to a different column. A single
   * static string for `td.cell` can only describe the CATEGORY, which is worth nothing to
   * somebody pointing at one particular number — so these read the answer off the DOM at
   * hover time: the row's header, the column's header, the tile's own label.
   *
   * Returning null means "I cannot answer for this one", and the lookup falls through to the
   * next-deepest entry rather than showing something vague.
   */
  resolve?: (el: Element) => Answer | null;
};

/* ------------------------------------------------------------------ helpers */

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** The heading of the column a cell sits in, matched by index against the table's thead. */
function columnHead(el: Element): string {
  const cell = el.closest("td, th") as HTMLTableCellElement | null;
  const table = cell?.closest("table");
  const head = table?.querySelector("thead tr");
  if (!cell || !head) return "";
  return clean(head.children[cell.cellIndex]?.textContent);
}

/** The row label of the row a cell sits in. */
function rowHead(el: Element): string {
  const row = el.closest("tr");
  return clean(row?.querySelector(".hm-rowhead, th, td")?.textContent);
}

/** A cell's own figure, with the small print under it separated out. */
function cellParts(el: Element): { value: string; sub: string } {
  const small = el.querySelector("small");
  const sub = clean(small?.textContent);
  const whole = clean(el.textContent);
  return { value: sub && whole.endsWith(sub) ? whole.slice(0, -sub.length).trim() : whole, sub };
}

/**
 * What the heat colouring on a cell is claiming.
 *
 * The four bands are the ones gapClass() actually assigns in src/lib/heat.ts — good, mild,
 * warn, crit — and the thresholds quoted here are its thresholds. If those move, move these.
 */
function heatMeaning(el: Element): string {
  const c = el.className;
  if (c.includes("hm-good")) return "Green: at or above the level required.";
  if (c.includes("hm-mild")) return "Yellow: short by less than half a level.";
  if (c.includes("hm-warn")) return "Orange: short by half a level to a full level.";
  if (c.includes("hm-crit")) return "Red: more than a full level short.";
  if (c.includes("hm-na")) return "Grey: no submitted data, or not applicable to that track.";
  return "";
}

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

/* ------------------------------------------------------- per-instance text */

/**
 * What each table column means, keyed by the heading above it.
 *
 * Every table in the app runs through this, so a cell is explained by the COLUMN it belongs
 * to rather than by the fact that it is a cell. A heading that is not listed here falls
 * through and the cell gets no answer, which is the right outcome: silence beats "this is a
 * table cell".
 */
const COLUMNS: Record<string, string> = {
  "account manager": "The person being assessed. Click the name to open their full analysis.",
  "capability": "One of the 22 capabilities in the APEX framework.",
  zone: "The Schneider hub this person reports into: MEA, SAM, India or Pacific.",
  track: "Acquisition or Saturation. The track sets which capabilities apply and what level each one requires.",
  segment: "The business segment of the account.",
  account: "The account this person runs.",
  "account type": "The account's tier, as classified by the business.",
  self: "Whether this person's own assessment is submitted, still a draft, or not started.",
  manager: "Whether their manager's assessment is submitted, still a draft, or not started.",
  "apex panel": "Whether the panel's assessment is submitted, still a draft, or not started.",
  schedule: "The self deadline, manager deadline and panel call date set for this person.",
  "self avg": "This person's own average rating across the capabilities their track applies, out of 3.",
  "mgr avg": "Their manager's average rating across applicable capabilities, out of 3.",
  "panel avg": "The APEX Panel's average rating across applicable capabilities, out of 3.",
  weighted: "Self 20% + APEX Panel 35% + Manager 45%, averaged over the capabilities that apply to their track.",
  "avg required": "The average level this person's track requires across those same capabilities.",
  gap: "Weighted score minus required level. Negative means short of what the track asks for.",
  "gap vs req": "Weighted score minus the level required for this capability. Negative means short.",
  "perf ytd": "The business performance figure recorded against this account for the year to date.",
  "below target": "How many of the applicable capabilities sit below their required level.",
  required: "The level this person's track requires for this capability.",
  panel: "The APEX Panel's rating for this capability.",
  "zone avg": "The average across the Account Managers shown in this zone, so it moves with the track filter.",
};

/** What each of the five KPI tiles counts. */
const KPI: Record<string, string> = {
  "campaign completion":
    "Submitted assessments as a percentage of three per Account Manager — self, manager and panel. 100% means every assessment is in.",
  "self submitted": "How many Account Managers have submitted their own self-assessment.",
  "manager submitted": "How many Account Managers have had their manager's assessment submitted.",
  "apex panel submitted": "How many Account Managers have had their APEX Panel assessment submitted.",
  "avg weighted maturity":
    "The population's average weighted score out of 3, against the average level their tracks require. The chip is the difference.",
};

/** Where each navigation entry goes. */
const NAV: Record<string, string> = {
  dashboard: "The whole population: completion, the zone map, the training heat map and the roster.",
  individuals: "Every Account Manager in one sortable table, with score, required level and gap.",
  "users & access": "Create evaluators, set their lens, and choose which Account Managers each one can assess.",
  "my assessments": "The people you have been asked to rate, and how far through each one you are.",
  "my self-assessment": "Your own assessment: 22 capabilities and a written example per theme.",
  "my feedback": "Your results, released once all three assessments are in.",
};

const label = (el: Element, sel: string) => clean(el.closest(".kpi")?.querySelector(sel)?.textContent).toLowerCase();

/**
 * Question mode's answers.
 *
 * The lookup keeps the DEEPEST entry whose selector the pointer is inside, so a number
 * inside a card explains the number. Entries that repeat — cells, tiles, links — resolve
 * their text from the DOM instead of describing the category they belong to.
 *
 * There is deliberately no fallback for "a card", "a table" or "a heading". An answer that
 * names the kind of thing you are pointing at and stops has cost a hover and returned
 * nothing; enough of them turn the whole feature into noise.
 */
export const HELP_ENTRIES: HelpEntry[] = [
  /* ---------------------------------------------------------- KPI tiles */
  {
    sel: ".kpi-value",
    resolve: (el) => {
      const name = label(el, ".kpi-label");
      return KPI[name] ? { title: clean(el.closest(".kpi")?.querySelector(".kpi-label")?.textContent), body: KPI[name] } : null;
    },
  },
  {
    sel: ".kpi-bench",
    resolve: (el) => ({
      title: "Against expected",
      body: `The average level the tracks require (${clean(el.querySelector("strong")?.textContent) || "the benchmark"}), and the chip is the difference from the actual average. Green is at or above it.`,
    }),
  },
  {
    sel: ".kpi-note",
    title: "How the figure is made up",
    body: "The counts behind the number above, or the weighting used to produce it.",
  },
  {
    sel: ".kpi",
    resolve: (el) => {
      const name = clean(el.querySelector(".kpi-label")?.textContent);
      return KPI[name.toLowerCase()] ? { title: name, body: KPI[name.toLowerCase()] } : null;
    },
  },

  /* -------------------------------------------------------- heat map ---- */
  {
    sel: "td.cell",
    resolve: (el) => {
      const cap = rowHead(el);
      const col = columnHead(el);
      const { value, sub } = cellParts(el);
      if (!cap && !col) return null;
      // a cluster-average row carries the theme's name in the row above it, not in its own
      // header, so say which theme rather than repeating the words "Cluster average"
      const theme = /cluster average/i.test(cap)
        ? clean(el.closest("tr")?.previousElementSibling?.textContent)
        : "";
      const what = theme ? `${theme} average` : cap;
      const where = what && col ? `${what} in ${col}` : what || col;
      if (value === "n/a") {
        return { title: where, body: "No submitted data for this combination, or the capability does not apply to that track." };
      }
      return { title: where, body: `Weighted ${value}${sub ? ` — ${sub}` : ""}. ${heatMeaning(el)}`.trim() };
    },
  },
  {
    sel: ".hm thead th",
    resolve: (el) => {
      const z = clean(el.textContent);
      if (!z || z === "Capability") return null;
      return { title: z, body: `Every figure in this column is the average across the Account Managers in ${z}. Click it for the zone's own benchmark page.` };
    },
  },
  {
    sel: ".hm .cluster-avg-row .hm-rowhead",
    title: "Cluster average",
    body: "The average across the capabilities in the theme above, so a theme can be judged without adding up its rows.",
  },
  {
    sel: ".hm .cluster-row",
    resolve: (el) => ({ title: clean(el.textContent), body: "A theme. The capabilities beneath it belong to it, and the row under them is its average." }),
  },
  {
    sel: ".hm-rowhead",
    resolve: (el) => {
      const t = clean(el.textContent);
      return t ? { title: t, body: "One of the 22 capabilities. The cells across this row are its score in each zone." } : null;
    },
  },
  { sel: ".legend .sw", title: "Legend swatch", body: "The colour band this shade belongs to. The label beside it says what range it covers." },

  /* --------------------------------------------------------- any table -- */
  {
    sel: ".table thead th, .th-sort",
    resolve: (el) => {
      const t = clean(el.textContent).replace(/[▲▼↕]/g, "").trim();
      const body = COLUMNS[t.toLowerCase()];
      if (!body) return null;
      const sortable = !!el.closest(".th-sort");
      return { title: t, body: sortable ? `${body} Click to sort by it; click again to reverse.` : body };
    },
  },
  {
    sel: ".table tbody td",
    resolve: (el) => {
      const col = clean(columnHead(el)).replace(/[▲▼↕]/g, "").trim();
      const body = COLUMNS[col.toLowerCase()];
      if (!body) return null;
      const val = clean(el.textContent);
      return { title: col, body: val && val.length < 40 ? `${val} — ${body}` : body };
    },
  },

  /* ------------------------------------------------------------ badges -- */
  { sel: ".badge-green", title: "Submitted", body: "In and locked. A superadmin can reopen it from this person's page if it needs revising." },
  { sel: ".badge-amber", title: "Draft", body: "Capabilities rated so far, out of 22. Nothing reaches the assessed person until the whole assessment is submitted." },
  { sel: ".badge-red", title: "Overdue", body: "The deadline has passed and this assessment is still open." },
  {
    sel: ".badge-sched",
    resolve: (el) => ({
      title: clean(el.textContent).split("·")[0].trim() || "Deadline",
      body: "Set per person on their individual page. The self and manager dates close those assessments; the panel date is when the assessment call happens.",
    }),
  },
  {
    sel: ".badge-zone",
    resolve: (el) => ({ title: clean(el.textContent), body: "One of the four Schneider hubs. It decides which zone column and zone average this person contributes to." }),
  },
  {
    sel: ".badge-track",
    resolve: (el) => {
      const t = clean(el.textContent);
      const acq = t.startsWith("Acquisition");
      return {
        title: t,
        body: acq
          ? "Winning new business. Acquisition capabilities apply; the Saturation ones are excluded from this person's score entirely."
          : "Growing existing accounts. Saturation capabilities apply; the Acquisition ones are excluded from this person's score entirely.",
      };
    },
  },
  { sel: ".badge-segment", resolve: (el) => ({ title: clean(el.textContent), body: "The account's business segment, used to compare like with like across the population." }) },
  { sel: ".badge-lens", title: "Required level", body: "The level this capability needs for this person's track." },
  { sel: ".badge-gray", resolve: (el) => ({ title: clean(el.textContent) || "Detail", body: "Context on the row: the account, its tier, or a state that carries no action." }) },
  {
    sel: ".lvl-chip",
    resolve: (el) => {
      const t = clean(el.textContent);
      if (/^L[123]$/.test(t)) {
        const n = t[1];
        const meaning = n === "1" ? "developing" : n === "2" ? "practising" : "leading";
        return { title: t, body: `Level ${n} — ${meaning}. One rater's judgement on this capability, not an average.` };
      }
      if (t === "n/a") return { title: "Not rated", body: "Either nobody has submitted a rating, or this capability does not apply to the person's track." };
      return { title: t, body: "A weighted figure, not a level: Self 20% + APEX Panel 35% + Manager 45%. 2.4 and 1.6 are different answers that would both round to 2." };
    },
  },

  /* -------------------------------------------------- individual page --- */
  { sel: ".standing-value", title: "Final score", body: "Out of 3, weighted Self 20% · APEX Panel 35% · Manager 45%, over the capabilities that apply to this person's track." },
  { sel: ".standing-vs", title: "The benchmark", body: "The average level this person's track requires. The score above it is only good or bad relative to this." },
  { sel: ".standing-note", title: "The weighting", body: "How the three assessments combine into the score above. The panel and manager carry more than the self-assessment." },
  {
    sel: ".radar-svg",
    title: "Profile chart",
    body: "One axis per theme. Thin webs are the three lenses, the thick green web is the weighted score, the dashed outline is the required level. Inside the dashed line is short.",
  },
  { sel: ".radar-legend", title: "Chart key", body: "Which colour is which lens. The same colours are used as dots in the tables below." },
  { sel: ".cluster-kicker", resolve: (el) => ({ title: clean(el.textContent), body: "A theme. The capabilities under it belong to it, and the row shows its average against what the track expects." }) },
  { sel: ".cluster-avg-label", title: "Theme average", body: "The average across this theme's capabilities, and the average level the track requires for them." },
  { sel: ".theme-note-block", title: "Written justification", body: "The example the rater gave for this theme. Every lens has to supply one before it can submit." },
  { sel: ".note-lens", resolve: (el) => ({ title: clean(el.textContent), body: "Which of the three raters wrote the note below." }) },
  { sel: ".mini-list li", title: "One capability", body: "The chip is the weighted score, and the note beside it is the level required for this person's track." },
  { sel: ".perception-gap, .badge-amber + strong", title: "Perception gap", body: "The self-rating differs from the weighted score by a level or more. Worth raising in the panel call." },

  /* --------------------------------------------------------- zone map -- */
  {
    sel: ".zmap-label",
    resolve: (el) => {
      const t = clean(el.textContent);
      return { title: t.replace(/[-+\d.]+$/, "").trim() || "Zone", body: "The zone's weighted average. Shading ranks the zones against each other; this figure is absolute." };
    },
  },
  { sel: ".zmap-tip", title: "Zone detail", body: "The zone's weighted average, the level required, and how many Account Managers it is built from." },
  { sel: ".zmap-panel", title: "Focused zone", body: "The selected zone's figures. Click the map background to clear the selection." },
  { sel: ".zmap-controls", title: "Map controls", body: "Zoom in, zoom out, and return to the whole world." },
  { sel: ".zmap-select", title: "Capability picker", body: "Narrows the map to one capability, so the shading shows where that single capability is weakest." },
  { sel: ".zmap-scale, .zmap-ramp", title: "Colour ramp", body: "The two ends are named: the strongest zone in view and the weakest. Everything between is interpolated." },

  /* -------------------------------------------------------- timeline --- */
  { sel: ".tl-lane-label", resolve: (el) => ({ title: clean(el.textContent).replace(/\d+ scheduled$/, "").trim(), body: "One lane per assessment. The count is how many of these are scheduled across the people you can see." }) },
  { sel: ".tl-mark", title: "A deadline", body: "Red has passed with the assessment still open, green is ahead, grey is submitted. Hover it for whose it is." },
  { sel: ".tl-today", title: "Today", body: "Where now sits on the axis. Everything left of it has already happened." },
  { sel: ".tl-next-group", title: "What is next", body: "The overdue assessments, then the ones coming up soonest." },
  { sel: ".tl-item", title: "One scheduled assessment", body: "Whose it is and when it falls. Click to open their analysis." },

  /* -------------------------------------------------------- controls --- */
  { sel: ".filter-toggle, .filter-panel", title: "Filters", body: "Track, segment and capability. Whatever you pick scopes every card on the page and the PDF download." },
  { sel: ".filter-badge", title: "Filters applied", body: "How many filters are currently narrowing the page." },
  { sel: ".wrench", title: "Arrange the dashboard", body: "Drag cards to reorder, pull a right edge to resize, × to take one off, Colour to repaint the app. Your view only." },
  { sel: ".nav-toggle", title: "Fold the menu", body: "Hides the menu and gives the page the full width of the window." },
  { sel: ".help-btn", title: "Help", body: "Opens the guided tour, and this question mode." },
  { sel: ".dash-resize", title: "Resize handle", body: "Pull to a third, a half or the full width — only the widths this particular card stays readable at." },
  { sel: ".dash-tag", title: "Move handle", body: "Drag it to move the card, or use the arrow keys." },
  { sel: ".dash-off", title: "Take the card off", body: "Removes it from your dashboard. It stays here while arranging, so you can put it back." },
  { sel: ".dash-act", resolve: (el) => ({ title: clean(el.textContent), body: "Reset restores the shipped arrangement, Cancel discards your changes, Save keeps them. Nothing is written until Save." }) },
  { sel: ".cp-part", resolve: (el) => ({ title: clean(el.querySelector(".cp-part-name")?.textContent), body: clean(el.querySelector(".cp-part-blurb")?.textContent) + " Result colours never change — green always means at or above required." }) },
  { sel: ".cp-slider", resolve: (el) => ({ title: clean(el.querySelector(".cp-slider-label")?.textContent), body: "Drag to change the colour of the part selected above. The page repaints as you move it; nothing is saved until you press Save colours." }) },
  { sel: ".cp-swatch", title: "Preset colour", body: "A ready-made choice for the part selected above." },
  {
    sel: ".nav-link",
    resolve: (el) => {
      const t = clean(el.textContent);
      const body = NAV[t.toLowerCase()];
      return body ? { title: t, body } : null;
    },
  },
  { sel: ".chat-fab, .chat-panel", title: "APEX Assistant", body: "Answers questions about the data you are allowed to see. It has no access to anything your role does not." },
  { sel: ".logout-btn", title: "Sign out", body: "Ends the session on this device." },
  { sel: ".avatar, .sidebar-foot", title: "Signed in as", body: "Your name and role. The role decides what appears in the menu above." },
  { sel: ".scroll-hint", title: "More columns", body: "The table is wider than the card. Scroll it sideways; the first column stays put." },
  { sel: ".hm-pager", title: "Page the columns", body: "Scrolls the columns sideways from here, so you do not have to reach the scrollbar at the foot of the table." },

  /* ------------------------------------------------------ assessment --- */
  { sel: ".level-card", resolve: (el) => ({ title: clean(el.querySelector(".lvl-head")?.textContent) || "A level", body: "Pick the description that matches what the person does today. The level their track requires is hidden while you rate so it cannot pull the answer." }) },
  { sel: ".framework-block, .framework-note", title: "Justification", body: "One concrete example per theme: the situation, what they did, what came of it. This is what the panel call reviews." },
  { sel: ".framework-caps", title: "What the note must cover", body: "The capabilities in this theme. The example should speak to them, and the one you are rating now is highlighted." },
  { sel: ".qguide", title: "Question guide", body: "Prompts to put to the person, or to yourself, before choosing a level." },
  { sel: ".wizard-top, .progress", title: "Progress", body: "Answers save as you go, so you can leave and come back. Nothing is visible to anyone else until you submit." },
  { sel: ".dot", title: "One capability", body: "Filled means rated. Click to jump straight to it." },
  { sel: ".review-row", title: "Review", body: "Everything you have chosen, before submitting. Submitting locks it — only a superadmin can reopen it." },

  /* ------------------------------------------------------------ admin -- */
  { sel: ".assign-box, .assign-pop", title: "Assignments", body: "Which Account Managers this evaluator may assess. They see nobody else, anywhere in the app." },
  { sel: ".seg", title: "A choice", body: "Pick one. The page updates immediately." },
  { sel: ".sidebar", title: "The menu", body: "Everything your role can reach. Foldable from the button at its edge." },
];

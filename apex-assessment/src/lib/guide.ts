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
          body: "Weighted score out of 3. The chart plots each lens per cluster against the dashed line, which is what this person's track requires.",
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
      body: "Pick the level that describes what the person does now, not what you want. Each cluster also needs one written example.",
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
  "my self-assessment": "Your own assessment: 22 capabilities and a written example per cluster.",
  "my feedback": "Your results, released once all three assessments are in.",
};

/**
 * The three buttons that share `.filter-toggle`, keyed by what each one says.
 *
 * They are one visual control reused three times, which is right for the CSS and wrong for
 * an explanation: "Filters" is a useless answer to somebody pointing at the schedule editor.
 */
const DISCLOSURE: Record<string, { title: string; body: string }> = {
  filters: {
    title: "Filters",
    body: "Track, segment and capability. Whatever you pick scopes every card on the page and the PDF download. The selections live in the URL, so opening or closing this panel applies nothing on its own.",
  },
  "assessment schedule": {
    title: "Assessment schedule",
    body: "Three dates for this person: the self deadline, the manager deadline and the APEX Panel call. Each one closes its own lens past that day, enforced server-side, not just hidden in the wizard. The badge counts how many are set.",
  },
  "account details": {
    title: "Account details",
    body: "Account type and Perf YTD for this person's account. Both are commercial attributes rather than assessment data: they feed the Population Overview table and its PDF, and never affect a score.",
  },
};

const label = (el: Element, sel: string) => clean(el.closest(".kpi")?.querySelector(sel)?.textContent).toLowerCase();

/** What each field of a form is asking for, keyed by its visible label. */
const FIELDS: Record<string, string> = {
  "full name": "The name shown wherever this person appears — on the roster, as the rater on an assessment, and in the sidebar when they sign in.",
  username: "What they sign in with. It has to be unique and is not case-sensitive.",
  password: "At least six characters. It is stored hashed, so it cannot be read back — a forgotten one has to be reset here.",
  role: "Superadmin sees every analysis and this page. Assessor only ever sees the assessments they were assigned.",
  lens: "Which assessment this person fills in: their own (Self), their reports' (Manager), or the panel's (APEX Panel). It also decides which weighting their ratings carry.",
  "account managers": "Who this person may assess. They see nobody else anywhere in the app — not on the roster, not on the timeline, not in the assistant.",
  "self deadline": "After this date the person can no longer edit their own assessment.",
  "manager deadline": "After this date the manager can no longer edit theirs.",
  "panel call": "When the assessment call happens. The panel can no longer rate once that day has passed.",
  "account type": "The account's tier. Shown on the individual page and in the population table.",
  "perf ytd": "The business performance figure for this account, year to date.",
};

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
const CORE_ENTRIES: HelpEntry[] = [
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
      // a cluster-average row carries the cluster's name in the row above it, not in its own
      // header, so say which cluster rather than repeating the words "Cluster average"
      const cluster = /cluster average/i.test(cap)
        ? clean(el.closest("tr")?.previousElementSibling?.textContent)
        : "";
      const what = cluster ? `${cluster} average` : cap;
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
    body: "The average across the capabilities in the cluster above, so a cluster can be judged without adding up its rows.",
  },
  {
    sel: ".hm .cluster-row",
    resolve: (el) => ({ title: clean(el.textContent), body: "A cluster. The capabilities beneath it belong to it, and the row under them is its average." }),
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
    body: "One axis per cluster. Thin webs are the three lenses, the thick green web is the weighted score, the dashed outline is the required level. Inside the dashed line is short.",
  },
  { sel: ".radar-legend", title: "Chart key", body: "Which colour is which lens. The same colours are used as dots in the tables below." },
  { sel: ".cluster-kicker", resolve: (el) => ({ title: clean(el.textContent), body: "A cluster. The capabilities under it belong to it, and the row shows its average against what the track expects." }) },
  { sel: ".cluster-avg-label", title: "Cluster average", body: "The average across this cluster's capabilities, and the average level the track requires for them." },
  { sel: ".theme-note-block", title: "Written justification", body: "The example the rater gave for this cluster. Every lens has to supply one before it can submit." },
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
  // Three different buttons share .filter-toggle, so answer by what the button says rather
  // than by the class it happens to be styled with — a reader hovering "Assessment schedule"
  // is not asking about filters.
  { sel: ".filter-toggle", resolve: (el) => DISCLOSURE[clean(el.textContent).replace(/\d+$/, "").trim().toLowerCase()] ?? null },
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
  { sel: ".framework-block, .framework-note", title: "Justification", body: "One concrete example per cluster: the situation, what they did, what came of it. This is what the panel call reviews." },
  { sel: ".framework-caps", title: "What the note must cover", body: "The capabilities in this cluster. The example should speak to them, and the one you are rating now is highlighted." },
  { sel: ".qguide", title: "Question guide", body: "Prompts to put to the person, or to yourself, before choosing a level." },
  { sel: ".wizard-top, .progress", title: "Progress", body: "Answers save as you go, so you can leave and come back. Nothing is visible to anyone else until you submit." },
  { sel: ".dot", title: "One capability", body: "Filled means rated. Click to jump straight to it." },
  { sel: ".review-row", title: "Review", body: "Everything you have chosen, before submitting. Submitting locks it — only a superadmin can reopen it." },

  /* ------------------------------------------------------------ forms -- */
  {
    sel: "label",
    resolve: (el) => {
      // the label's own text, minus any control nested inside it
      const own = clean(
        [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ")
      ).replace(/\(optional\)/i, "").replace(/[:*]$/, "").trim();
      const body = FIELDS[own.toLowerCase()];
      return body ? { title: own, body } : null;
    },
  },
  {
    sel: "a.btn-outline, .row-name-link",
    resolve: (el) => {
      const t = clean(el.textContent).replace(/[→>]/g, "").trim();
      return { title: t || "Open", body: "Opens this Account Manager's full analysis: their score, the profile chart, and every capability with all three ratings." };
    },
  },

  /* ------------------------------------------------------------ admin -- */
  { sel: ".assign-box, .assign-pop", title: "Assignments", body: "Which Account Managers this evaluator may assess. They see nobody else, anywhere in the app." },
  { sel: ".seg", title: "A choice", body: "Pick one. The page updates immediately." },
  { sel: ".sidebar", title: "The menu", body: "Everything your role can reach. Foldable from the button at its edge." },
];

/* ---------------------------------------------------------------------------
 * The rest of the app, element by element.
 *
 * Inventoried from the source and then checked against the running pages: every selector
 * below matched something real, or is a class the code still ships. Entries whose meaning
 * changes per instance — cells, tiles, links, badges — are handled by the resolvers above,
 * which sit deeper and therefore win; these carry the fixed answers.
 * ------------------------------------------------------------------------ */
export const MORE_ENTRIES: HelpEntry[] = [
  { sel: ".dash-block[data-block=\"kpis\"]", title: "Campaign KPIs", body: "Five tiles: completion, one submission count per lens, and the population's weighted maturity. These figures ignore the Filters card — they always cover the whole roster." },
  { sel: ".kpi-label", title: "Tile name", body: "Names what this tile counts. The four count tiles are submissions; the last is a score out of 3, not a count." },
  // The same little "/ n" means two different things depending on the tile it hangs off:
  // a headcount on the four submission tiles, the top of the level scale on the last one.
  {
    sel: ".kpi-value span",
    resolve: (el) => {
      const name = clean(el.closest(".kpi")?.querySelector(".kpi-label")?.textContent);
      const total = clean(el.textContent).replace(/^\/\s*/, "");
      if (!name) return null;
      return total === "3"
        ? { title: "Top of the scale", body: "APEX levels run 1 to 3, so the weighted average is read against 3. It is not a count of anything." }
        : { title: `Out of ${total}`, body: `Every Account Manager currently in view — what "${name}" is counted against. It moves with the track and segment filters.` };
    },
  },
  { sel: ".kpi-bench-chip", title: "Gap to expected", body: "Weighted average minus expected average, two decimals, signed. Green at or above expected, amber within half a level below, orange up to a level, red more than a level short." },
  { sel: ".dash-block[data-block=\"report\"]", title: "PDF deck", body: "Builds the Capability Dashboard as a PDF on the server. Superadmin only — the card is never sent to anyone else." },
  { sel: ".report-title", title: "Deck name", body: "The title the generated PDF carries. It is the population deck, not one person's report — individual reports are downloaded from each Account Manager's own page." },
  { sel: ".report-sub", title: "What is in the deck", body: "Radars per zone, per segment and per track, each against the level those tracks require, followed by the largest gaps to close." },
  { sel: "a[href^=\"/analysis/report/pdf\"]", title: "Download PDF", body: "Renders the deck server-side and downloads it. The track and segment filters ride along in the query string; the map's capability filter does not affect it." },
  { sel: ".dash-block[data-block=\"filters\"]", title: "Filters", body: "Track, segment and capability, all held in the URL, so the server re-scopes the map, heat map, training focus, timeline and roster together. This card cannot be taken off." },
  { sel: ".filter-toggle", title: "Filters", body: "Opens and closes the filter panel. Opening it applies nothing — the selections inside are already live in the URL whether the panel is showing or not." },
  { sel: ".filter-caret", title: "Open / closed", body: "Rotates 180° while the panel is open. It carries no state of its own beyond that." },
  { sel: ".filter-panel", title: "Filter panel", body: "Three controls writing the track, segment and cap URL parameters. Each change is a navigation without scrolling, so the server rebuilds every card underneath." },
  { sel: ".filter-group", title: "Filter", body: "One filter and its label." },
  { sel: ".filter-label", title: "Filter name", body: "Names the control below it." },
  { sel: ".filter-panel .seg", title: "Track", body: "Three exclusive buttons writing ?track=. Track decides which capabilities apply to a person and at what level, so switching it changes every required figure on the page." },
  { sel: ".seg-btn", title: "Track option", body: "Sets the track filter." },
  { sel: "select[aria-label=\"Filter by segment\"]", title: "Segment", body: "Restricts every card to one business segment: Power & Grid, Energy & Chemicals, CS&P · Cloud & Service Providers, or Multi-segment. Writes ?segment=; 'All segments' removes it." },
  { sel: "select[aria-label=\"Filter the map by capability\"]", title: "Capability (map)", body: "Picks one of the 22 capabilities, grouped by cluster, and recomputes the zone map from that capability alone. Writes ?cap=. The heat map, roster and PDF are untouched." },
  { sel: ".filter-panel .btn-ghost", title: "Clear all", body: "Navigates to the page with no query string, dropping track, segment and capability at once. Shown only while at least one filter is set." },
  { sel: ".analytics-filter-note", title: "What survives the filter", body: "How many Account Managers match the current track and segment, with those values spelled out. Appears only when one of them is set." },
  { sel: ".dash-block[data-block=\"map\"]", title: "Zone map", body: "Weighted performance against required levels across the four APEX zones. Built only for superadmins, because it carries every Account Manager's individual scores." },
  { sel: ".card-title", title: "Card", body: "Names the card below it." },
  { sel: ".card-sub", title: "How to read it", body: "States how this card's figures are computed and what its colours mean." },
  { sel: ".zmap-toolbar", title: "Map header", body: "What the shading is computed from, and the two zones the colour ramp is stretched between." },
  { sel: ".zmap-active-cap", title: "Shading source", body: "Which capability the zone fills are computed from. 'All capabilities' averages all 22 per Account Manager; otherwise it names the one picked in Filters." },
  { sel: ".zmap-scale", title: "Zones compared", body: "The ramp is relative, not absolute: the strongest gap in view is pinned to blue and the weakest to red. Four zone averages sit within a fraction of a level and would otherwise be one colour." },
  { sel: ".zmap-scale-cap", title: "Relative scale", body: "Says the four zones are ranked against each other. When no panel data exists it reads 'No panel scores submitted yet' and every zone is filled neutral grey." },
  { sel: ".zmap-scale-end", title: "Ramp end", body: "A zone name and its absolute gap, marking one end of the ramp." },
  { sel: ".zmap-scale-bar", title: "The ramp", body: "The blue-to-red gradient the zone fills are sampled from. The observed spread is stretched across it, with a floor of 0.15 of a level so level zones are not turned into a fake ranking." },
  { sel: ".zmap-wrap", title: "Map canvas", body: "A canvas paints the zone fills, an SVG on top carries borders and hubs. Drag to pan, wheel to zoom about the pointer, between 1× and 6×." },
  { sel: ".zmap", title: "World outline", body: "Country borders over the thermal fill. A drag of more than six pixels suppresses the following click, so panning across a zone never selects it." },
  { sel: ".zmap-zone", title: "Zone", body: "Every country of one APEX zone, filled one flat colour. The data is per zone, so nothing inside a region is shaded differently. Click to zoom to it; click again to reset." },
  { sel: ".zm-neutral", title: "Outside APEX", body: "A country with no APEX zone: no Account Managers, no score, no hover figures. Drawn dark so the four coloured zones read as the subject." },
  { sel: ".zmap-thermal", title: "Zone fill", body: "Each zone painted as one flat colour at 92% opacity from its average gap. A zone with no submitted data gets neutral slate at 42% instead of a black hole." },
  { sel: ".zmap-hub", title: "Hub", body: "A Schneider hub city. Account Managers are spread round-robin across their zone's hubs by code, so this is representative placement, not office data." },
  { sel: ".zmap-hub-name", title: "Hub label", body: "The hub's name and how many Account Managers are placed on it. Drawn only above 2× zoom, where the markers are far enough apart to label." },
  { sel: ".zmap-label-val", title: "Zone average", body: "That zone's average weighted score to two decimals. Its background comes off the relative ramp — blue for the strongest gap in view, red for the weakest — not from an absolute band." },
  { sel: ".zmap-tip-zone", title: "What is under the pointer", body: "Names what is being hovered." },
  { sel: ".zmap-tip-sub", title: "Which zone", body: "The APEX zone the hovered hub belongs to. All figures on this card are the zone's, not the hub's — the data has no finer granularity." },
  { sel: ".zmap-tip-row", title: "Hover figures", body: "One line of the hover card." },
  { sel: ".zmap-tip-country", title: "Country", body: "The country path under the pointer, read off its data-name. It carries no figures of its own; everything below it is the zone's." },
  { sel: ".zmap-tip-cap", title: "Restricted to", body: "The single capability the figures above are computed from. Shown only while the Filters capability select is set to something." },
  { sel: ".zmap-tip-cta", title: "Click to focus", body: "Clicking zooms the map to fit this zone's bounding box, dims the other three, and replaces this card with the zone panel." },
  { sel: ".zmap-panel-dot", title: "Standing", body: "Colours the absolute gap on fixed bands: green at or above required, yellow within half a level, orange up to a full level, red more than a level short." },
  { sel: ".zmap-panel-zone", title: "Selected zone", body: "The zone the map is focused on. The four are MEA, SAM, India and Pacific; every figure below is averaged over its Account Managers only." },
  { sel: ".zmap-panel-close", title: "Close", body: "Clears the selection and returns the map to 1× with no pan — the same action as the home button in the map controls." },
  { sel: ".zmap-panel-cap", title: "Restricted to", body: "The capability every figure below is computed from, set in Filters. With it set, the 'biggest deficit' line disappears, since there is only one capability in play." },
  { sel: ".zmap-panel-stats > div", title: "Zone figure", body: "One statistic for the selected zone." },
  { sel: ".zmap-panel-worst", title: "Biggest deficit", body: "The capability with this zone's most negative mean gap, and that gap. Computed across all 22 capabilities, so it is only shown when no capability filter is set." },
  { sel: ".zmap-panel-open", title: "Open zone analysis", body: "Goes to /analysis/zone/<zone>: every Account Manager in this zone with their weighted score, required level and gap per capability. Superadmin only." },
  { sel: ".zmap-controls button[aria-label=\"Zoom in\"]", title: "Zoom in", body: "Multiplies the zoom by 1.5 about the centre of the map, up to a limit of 6×. Above 2× the hub markers gain their name labels." },
  { sel: ".zmap-controls button[aria-label=\"Zoom out\"]", title: "Zoom out", body: "Divides the zoom by 1.5 about the centre, down to 1×, pulling the pan back inside the frame as it goes." },
  { sel: ".zmap-controls button[aria-label=\"Reset view\"]", title: "Reset view", body: "Back to 1× with no pan, and clears the selected zone along with its panel." },
  { sel: ".dash-block[data-block=\"timeline\"]", title: "Assessment timeline", body: "Every scheduled deadline across the roster on one date axis. For anyone but a superadmin it is cut to the people they were assigned." },
  { sel: ".tl", title: "Date axis", body: "Runs from two days before the earliest scheduled date to two days after the latest, and always contains today even when every date is ahead." },
  { sel: ".tl-axis", title: "Axis", body: "Carries the month boundaries and the today marker. The lanes below share its exact horizontal scale." },
  { sel: ".tl-tick", title: "Month", body: "A month boundary, labelled with the month and the full four-digit year. The year is never abbreviated here: 'Aug 26' would read as the 26th of August." },
  { sel: ".tl-today-line", title: "Today", body: "Today drawn down through the lane, so which side of it a marker sits on tells you whether that deadline has passed." },
  { sel: ".tl-lane", title: "Lane", body: "One row per assessment type." },
  { sel: ".tl-lane-count", title: "How many scheduled", body: "How many Account Managers have a date of this kind, not how many markers there are — a day shared by three people counts three here and shows as one marker." },
  { sel: ".tl-lane-track", title: "Lane track", body: "One lane's stretch of the shared date axis. Markers are placed as a percentage of its width, which is why this card cannot be narrowed below half." },
  { sel: ".tl-lane-empty", title: "Nothing scheduled", body: "No date of this kind exists for anyone in view. Dates are set per person, on their individual page, by a superadmin." },
  { sel: ".tl-next", title: "What needs attention", body: "What the axis cannot show at a glance: everything that has slipped, and the four dates closest to now." },
  { sel: ".tl-next-head", title: "List heading", body: "Names and counts the list below." },
  { sel: ".tl-item .badge", title: "Which assessment", body: "Which of the three assessments this date belongs to." },
  { sel: ".tl-more", title: "Remainder", body: "Either the overdue items not listed, or a statement that nothing is outstanding." },
  { sel: ".dash-block[data-block=\"priorities\"]", title: "Training focus", body: "The six largest zone-level shortfalls taken straight from the heat map, worst first. Cells at or above the required level never appear here. Follows the track and segment filters." },
  { sel: ".mini-list .lvl-chip", title: "Shortfall", body: "Mean weighted score minus mean required level for that zone, two decimals. Always negative in this list. Orange past half a level short, red past a full level." },
  { sel: ".mini-list li strong", title: "Capability", body: "One of the 22 capabilities. Its required level depends on the track, so the same capability can produce different gaps in different zones." },
  { sel: ".mini-list li > span:last-child", title: "Behind the chip", body: "The two figures the gap is made of — mean weighted score and mean required level, one decimal — and how many Account Managers in that zone contributed a score." },
  { sel: ".dash-block[data-block=\"heatmap\"]", title: "Heat map", body: "22 capabilities down, four zones across. Red cells are collective deficits, which is where a training programme pays. Scoped by the track and segment filters." },
  { sel: ".hm", title: "Capability × zone", body: "Rows are the 22 capabilities in rubric order, grouped into clusters; columns are the four APEX zones. Every figure is an average over the people in that zone whose track makes the capability applicable." },
  { sel: ".hm thead .hm-rowhead", title: "Capability column", body: "The rows below are capabilities, in rubric order, broken into cluster sections each headed by its own name and average row." },
  { sel: ".hm thead th a[href^=\"/analysis/zone/\"]", title: "Open the zone", body: "Opens that zone's own page: every Account Manager in it, with their weighted score, required level and gap per capability. Superadmin only; assessors see the zone name as plain text." },
  { sel: ".hm tbody tr:not(.cluster-avg-row) th.hm-rowhead", title: "Capability", body: "One of the 22 capabilities. Its required level differs by track, so the four cells in this row are each measured against their own zone's mix of Acquisition and Saturation people." },
  { sel: ".cluster-row", title: "Cluster", body: "A cluster heading spanning the table. The 22 capabilities are grouped into clusters such as Account Strategy & Planning and Commercial & Sales Excellence; the row under it is that cluster's average." },
  { sel: ".cluster-avg-row", title: "Cluster average", body: "The cluster's own mean per zone, so a cluster can be judged without adding its capability rows up by eye. Averaged only over the cells that carry data." },
  { sel: ".cluster-avg-row th.hm-rowhead", title: "Cluster average", body: "Marks the row as the mean of the capabilities in the cluster above, not a capability of its own." },
  { sel: ".cluster-avg-row td.cell", title: "Cluster average", body: "The mean of this cluster's capability cells for this zone, over those with data, with the mean required level and gap beneath. Same colour bands as any other cell." },
  { sel: ".cell small", title: "Required and gap", body: "The mean required level for this zone at one decimal, then the gap — weighted score minus required — signed, at two decimals. The gap is what drives the cell's colour." },
  { sel: ".legend", title: "Colour bands", body: "The four gap bands the cells are coloured on, plus the grey used where no Account Manager in that zone has a submitted score for the capability." },
  { sel: ".legend > span", title: "Colour band", body: "One of the five cell colours and what it means." },
  { sel: ".dash-block[data-block=\"roster\"]", title: "Roster", body: "Where each person's three assessments stand, with their deadlines. A superadmin sees everyone matching the filters; a manager or panel member sees only people assigned to them." },
  { sel: "table.table thead th", title: "Column", body: "Names the column below it." },
  { sel: "tr.rowlink", title: "One person", body: "One Account Manager and the state of all three of their assessments. Assessors only ever get rows for people they were assigned; the aggregate cards above name nobody." },
  { sel: ".row-name-link", title: "Open the person", body: "Opens their analysis page: all three lens ratings per capability, the weighted score, the gap, the radar and the schedule editor. Superadmin only." },
  { sel: "table.table tbody td", title: "Cell", body: "One field of this person's row." },
  { sel: ".sched-cell", title: "Schedule", body: "All three of this person's dates, ordered overdue first, then upcoming, then done. A date is never hidden once set, whatever the state of its assessment." },
  { sel: ".sched-cell .badge", title: "Deadline", body: "One scheduled date for this person, and what has happened to it." },
  { sel: ".sched-left", title: "Left to score", body: "Capabilities still unrated across the lenses that have a draft open: 22 minus the rated count, summed. Lenses nobody has opened are not counted here." },
  { sel: "table.table a.btn-outline[href^=\"/analysis/am/\"]", title: "Analysis", body: "Opens the same page as the person's name: the three lens ratings per capability, the weighted score, the gap, the radar and the schedule editor." },
  { sel: ".banner-info", title: "Nothing matches", body: "Shown in place of the table when the filters leave no one. For an assessor it also means none of their assigned people fall inside the current filters." },
  { sel: ".dash-bar", title: "Arrange bar", body: "Superadmin only. Whatever it saves is stored against your own account, so rearranging never changes what a colleague sees." },
  { sel: ".dash-bar-note", title: "The three gestures", body: "Drag a card body to swap it with another, pull its right edge to change width, press × to take it off the dashboard." },
  { sel: ".dash-act.primary", title: "Save", body: "Writes the order, the widths and the hidden flags to your account and leaves arrange mode. Greyed until something differs from what is already saved." },
  { sel: ".dash-block.editable", title: "Movable card", body: "Drag it onto another card to take that card's place. Its contents stop responding to clicks for the duration, because a drag that starts on a link would be a navigation." },
  { sel: ".dash-block.is-off", title: "Taken off", body: "Marked to be dropped. It is greyed out here so you can put it back, and disappears from the dashboard once you save." },
  { sel: ".dash-grid", title: "Grid", body: "Twelve columns. Cards flow in your saved order at their saved width, and any card your role never receives is simply absent rather than left as a hole." },
  { sel: ".dash-colour", title: "Colour", body: "Open only while arranging. Every change previews live by writing the same CSS custom properties the server writes on a real load, and is discarded unless saved." },
  { sel: ".cp-parts", title: "What to colour", body: "Pick the part first, then the colour. The four are independent, so your brand green on a navy app and the same green on a black one are two different choices." },
  { sel: ".cp-chip", title: "Current colour", body: "That part's colour as it stands. It shows the shipped default until you pick something, because nothing is written for a part nobody has chosen." },
  { sel: ".cp-preview", title: "Preview", body: "The colour being edited, filled large, with its hex beneath. Updates as the sliders move, and the page behind it repaints at the same time." },
  { sel: ".cp-hex", title: "Hex", body: "The same colour written out. Accepts #rgb or #rrggbb in any case; anything else is ignored while you type rather than clearing the colour." },
  { sel: ".cp-clear", title: "Back to default", body: "Drops your colour for this part so the shipped one is used again. Shown only while this part carries a custom value." },
  { sel: ".cp-swatches", title: "Presets", body: "Ten accent presets, or eight dark surface presets, depending on the part selected. Each is chosen to keep body text legible and to stay clear of the result colours." },
  { sel: ".cp-actions .btn-primary", title: "Save colours", body: "Stores the four colours against your account. They are re-applied as inline custom properties on every load, for you only. Greyed until something changed." },
  { sel: ".cp-actions .btn-outline", title: "Colour action", body: "Undoes colour work, at one of two depths." },
  { sel: ".page-kicker a", title: "Back to the list", body: "Links to /analysis/individuals, the sortable table of every Account Manager with weighted score, required level and gap." },
  { sel: ".am-meta .badge-zone", title: "Zone", body: "The Schneider hub this Account Manager sits in: MEA, SAM, India or Pacific. Zone is the column axis of the dashboard heat map and the unit the zone benchmark averages over." },
  { sel: ".am-meta .badge-track", title: "Track", body: "Acquisition or Saturation. The track fixes each capability's required level and leaves the other track's cluster out of the score, the gap and the radar." },
  { sel: ".am-meta .badge-segment", title: "Segment", body: "The account's business segment: Power & Grid, Energy & Chemicals, CS&P Cloud & Service Providers, or Multi-segment. Group comparisons and the dashboard filter use it." },
  { sel: ".am-meta .badge-gray", title: "Header badge", body: "Grey means no state to report: either a stored account field or a lens that has not submitted yet." },
  { sel: ".am-meta .badge-green", title: "Submitted", body: "This lens has submitted and is locked. Reopen it from the Administration card at the foot of this page." },
  { sel: ".am-meta .badge-sched", title: "Scheduled date", body: "A date stored on this Account Manager and enforced server-side by the rate actions. Set or cleared in the Assessment schedule editor to its left." },
  { sel: ".sched .filter-toggle", title: "Editor toggle", body: "Opens a superadmin edit panel below the header. Nothing is saved until the panel's save button is pressed." },
  { sel: ".sched .filter-badge", title: "Fields set", body: "How many of that panel's fields currently hold a value. It disappears when none are set." },
  { sel: ".sched-panel", title: "Edit panel", body: "Superadmin-only form. Values are validated server-side and the page is revalidated after saving." },
  { sel: ".filter-group:has(input[name=\"selfDeadline\"])", title: "Self deadline", body: "The last day the assessed person may self-assess. Inclusive: the window shuts at 23:59 on that date, after which the self rate action refuses." },
  { sel: ".filter-group:has(input[name=\"managerDeadline\"])", title: "Manager deadline", body: "The last day the manager may assess this person. Inclusive: the window shuts at 23:59 on that date and the manager rate action then refuses." },
  { sel: ".filter-group:has(input[name=\"panelDatetime\"])", title: "Panel call", body: "Date and time of the APEX Panel assessment call. The assessed person sees it as their upcoming assessment; the panel can still score until the end of that day." },
  { sel: ".sched-panel .input", title: "Field", body: "Saved only when the panel's save button is pressed; the value is re-validated on the server." },
  { sel: ".sched-field:has(select[name=\"accountType\"])", title: "Account Type", body: "The account tier: Strategic, Key, Growth or Developing. Stored on the Account Manager, shown as the grey header badge and used by the Population Overview table and PDF." },
  { sel: ".sched-field:has(input[name=\"perfYtd\"])", title: "Perf YTD", body: "Year-to-date performance against target, in percent, where 100 is on target. Optional, entered in steps of 0.1, and used only by the Population Overview." },
  { sel: ".sched-help", title: "Perf YTD definition", body: "Defines the figure above it: year-to-date performance against target, as a percentage, with 100 meaning on target." },
  { sel: ".sched-actions button.btn-primary", title: "Save", body: "Writes the panel's fields and revalidates the page. An empty field is stored as null, which removes that limit or clears that value." },
  { sel: ".sched-saved", title: "Saved", body: "The server action returned without an error. It clears itself after 2.5 seconds; the page data was revalidated at the same moment." },
  { sel: ".page-head .btn-outline", title: "Export PDF", body: "Fetches /analysis/am/<id>/pdf and downloads it as APEX-Assessment-<name>.pdf. The label reads 'Kimi is writing…' while the AI narrative is being generated, otherwise 'Generating…'." },
  { sel: ".page-head .btn-outline + span", title: "Narrative source", body: "Read from the PDF response headers X-AI-Source and X-AI-Reason. Green means Kimi wrote the narrative; amber means the deterministic generator was used, followed by the reason it fell back." },
  { sel: ".standing-card", title: "Overall standing", body: "The weighted score, the level this person's track expects, the signed gap between them, and the per-cluster radar. Everything further down the page is the detail behind these figures." },
  { sel: ".standing-score .kpi-label", title: "Final score", body: "Names the figure below it: the weighted average across the capabilities that apply to this track. It is a level, not a count or a percentage." },
  { sel: ".standing-outof", title: "Out of 3", body: "The ceiling of the scale. Levels run L1 to L3, so 3.00 is the highest any capability, cluster or overall average can reach." },
  { sel: ".standing-score .lvl-chip", title: "Gap", body: "Weighted score minus expected average, signed, in level points. Green at or above 0, yellow down to −0.5, orange to −1, red beyond." },
  { sel: ".standing-radar", title: "Profile area", body: "Holds the per-cluster radar. With no submitted assessment there is nothing to plot and a line says so; the chart also needs at least three applicable clusters to draw." },
  { sel: ".radar-svg polygon[stroke=\"#a78bfa\"], .radar-svg circle[fill=\"#a78bfa\"]", title: "Self web", body: "The Self Assessment, averaged per cluster over that cluster's rated capabilities. Counts 20% toward the weighted score." },
  { sel: ".radar-svg polygon[stroke=\"#7db1ff\"], .radar-svg circle[fill=\"#7db1ff\"]", title: "Manager web", body: "The Manager Assessment, averaged per cluster. At 45% it is the heaviest lens in the weighted score." },
  { sel: ".radar-svg polygon[stroke=\"#e148b8\"], .radar-svg circle[fill=\"#e148b8\"]", title: "APEX Panel web", body: "The panel's ratings, averaged per cluster. Counts 35%. Drawn magenta rather than green so it cannot be mistaken for the Final score web." },
  { sel: ".radar-svg polygon[stroke=\"#4ce26a\"], .radar-svg circle[fill=\"#4ce26a\"]", title: "Final score web", body: "The weighted score per cluster, Self 20% / APEX Panel 35% / Manager 45%. Every strength, development area and gap on this page derives from this web, not the thin ones." },
  { sel: ".radar-svg polygon[stroke-dasharray=\"5 4\"]", title: "Expected level", body: "The mean required level per cluster for this track, drawn dashed and unfilled so it reads as a target line. Green web inside it is a shortfall on that cluster." },
  { sel: ".radar-svg polygon[stroke=\"rgba(255,255,255,0.12)\"]", title: "Level ring", body: "Grid rings at L1, L2 and L3. The centre is 0 and the outer ring is 3, so distance from the centre is linear in level." },
  { sel: ".radar-svg line[stroke=\"rgba(255,255,255,0.1)\"]", title: "Axis", body: "One spoke per plotted cluster, drawn from the centre to that cluster's L3 point. It carries no value of its own." },
  { sel: ".radar-svg text[fill=\"#6b7689\"]", title: "Ring label", body: "Marks which level a grid ring stands for. The scale is the same on every axis." },
  { sel: ".radar-svg text[fill=\"#c3cdde\"]", title: "Cluster", body: "Names the axis. Each point on it is that cluster's mean across its capabilities, for whichever web it belongs to." },
  { sel: ".radar-legend > span", title: "Legend entry", body: "Names one web on the chart above. A web only appears here when at least one cluster has a value for it." },
  { sel: ".mini-list .badge-red", title: "Required level", body: "The level this capability demands on this Account Manager's track. Red because the weighted score sits below it." },
  { sel: ".two-col .card:first-child .mini-list li > span:last-child", title: "Required level", body: "The level this capability demands on this track. The weighted score is strictly above it, which is what put the row in Strengths." },
  { sel: ".mini-list .badge-amber", title: "Overrates", body: "The self rating sits above the weighted score by this many level points. Only differences of a full level or more are listed." },
  { sel: ".mini-list .badge-gray", title: "Underrates", body: "The self rating sits below the weighted score by this many level points. Only differences of a full level or more are listed." },
  { sel: ".hm-scroll:has(.cluster-kicker)", title: "Scrolls sideways", body: "The seven-column capability table scrolls horizontally inside this box when the window is narrower than it. No column is pinned here." },
  { sel: "table.table:has(.cluster-kicker) thead th", title: "Column", body: "Heads one column of the capability table." },
  { sel: ".ld-req", title: "Required dot", body: "White marks the required level: the benchmark column, set per capability by the track rather than by any rater." },
  { sel: ".ld-self", title: "Self dot", body: "Violet marks the Self Assessment, in this table and on the radar. That lens counts 20% of the weighted score." },
  { sel: ".ld-manager", title: "Manager dot", body: "Blue marks the Manager Assessment, in this table and on the radar. That lens counts 45%, the heaviest of the three." },
  { sel: ".ld-expert", title: "Panel dot", body: "Magenta marks the APEX Panel, in this table and on the radar. That lens counts 35% of the weighted score." },
  { sel: "table.table:has(.cluster-kicker) tbody td", title: "Cell", body: "One capability's value in this column." },
  { sel: "table.table:has(.cluster-kicker) .badge-lens", title: "Required level", body: "The level this capability demands on this Account Manager's track: L1 Developing, L2 Proficient, L3 Advanced. It is the number the gap is measured against." },
  { sel: "table.table:has(.cluster-kicker) .badge-gray", title: "Not on this track", body: "This capability carries no required level on this track, so it is left out of the weighted average, the gap, both lists and the radar." },
  { sel: "td .lvl-chip.lvl-1, td .lvl-chip.lvl-2, td .lvl-chip.lvl-3, td .lvl-chip.lvl-none", title: "Rated level", body: "One rater's level for this capability: L1 Developing, L2 Proficient, L3 Advanced. 'n/a' means that lens has not submitted." },
  { sel: "td .lvl-chip.hm-good, td .lvl-chip.hm-mild, td .lvl-chip.hm-warn, td .lvl-chip.hm-crit", title: "Gap vs required", body: "Weighted score minus required level, signed, in level points. Green at or above 0, yellow to −0.5, orange to −1, red beyond." },
  { sel: "table.table:has(.cluster-kicker) tbody strong", title: "Weighted score", body: "Self 20% / APEX Panel 35% / Manager 45%, re-normalised over the lenses that submitted. Shown to two decimals on purpose: 1.60 and 2.40 both round to L2 but are different answers." },
  { sel: "td .cluster-kicker", title: "Cluster", body: "Names one of the six clusters. The capability rows under it belong to it, and the figures to its right are that cluster's own averages." },
  { sel: ".note-text", title: "Justification", body: "The rater's written evidence for this cluster: the situation, what the person did and what came of it. It is the text the panel call reviews." },
  { sel: "form button.btn-outline", title: "Reopen assessment", body: "Sets that assessment back to draft and clears its submitted timestamp, so the evaluator can revise and submit again. Disabled unless the lens is currently submitted." },
  { sel: ".report-row a[href^=\"/analysis/population/pdf\"]", title: "Population PDF", body: "Renders the APEX Population Overview table as a PDF — one row per Account Manager, sorted by zone then name — carrying the search, zone, track, segment and account-type filters set below." },
  { sel: "input.ifilter-search", title: "Search", body: "Case-insensitive substring match against the Account Manager's name, their account and their AM code. Typing writes ?q= into the URL 350 ms after you stop, and the server re-filters." },
  { sel: "select.zmap-select[aria-label=\"Filter by zone\"]", title: "Zone filter", body: "Keeps only Account Managers in one of the four Schneider hubs: MEA, SAM, India or Pacific. Sets ?zone= in the URL and also scopes the Download PDF above." },
  { sel: "select.zmap-select[aria-label=\"Filter by track\"]", title: "Track filter", body: "Keeps only Acquisition or only Saturation Account Managers. The two tracks are scored on different capability sets — 19 and 18 of the 22 — so filtering compares like with like." },
  { sel: "select.zmap-select[aria-label=\"Filter by segment\"]", title: "Segment filter", body: "Limits the table to one business segment: Power & Grid, Energy & Chemicals, CS&P · Cloud & Service Providers, or Multi-segment. Anyone with no segment recorded drops out." },
  { sel: "select.zmap-select[aria-label=\"Filter by account type\"]", title: "Account type filter", body: "Limits the table to one account tier: Strategic, Key, Growth or Developing. This is the commercial classification of the account, not the Acquisition/Saturation assessment track." },
  { sel: ".analytics-filter-row .btn-ghost", title: "Clear all", body: "Empties the search box and returns the zone, track and segment selects to All. It only appears while at least one filter is set. It does not reset account type." },
  { sel: ".th-sort", title: "Column heading", body: "Click to sort by this column; click again to reverse. Text columns open A to Z, numeric ones high to low, and rows with no data always sink to the bottom. The active column is green." },
  { sel: ".th-sort .th-arrow", title: "Sort direction", body: "↕ means the table is not sorted by this column. ▲ is ascending, ▼ descending. Sort and direction live in the URL, so a sorted view survives a reload and can be shared." },
  { sel: ".scroll-fade .table tbody td", title: "Table cell", body: "One Account Manager's value in this column." },
  { sel: ".am-account", title: "Account", body: "The account this Account Manager runs. The search box matches this field as well as the person's name and code." },
  { sel: ".am-code", title: "AM code", body: "The Account Manager's identifier, AM01 upward, generated from the row id when the person is created. Search matches it, and the zone table can be ordered by it." },
  { sel: ".scroll-fade .table .badge-gray", title: "Account type", body: "The account's commercial tier — Strategic, Key, Growth or Developing. It is a business classification and has no effect on scoring or on required levels." },
  { sel: ".scroll-fade .table .lvl-chip", title: "Gap", body: "Weighted score minus average required level, signed, to two decimals. Green at or above 0, yellow down to −0.5, orange down to −1, red beyond that." },
  { sel: ".scroll-fade .table .badge-green", title: "No gaps", body: "Every capability that applies to this person's track has a weighted score at or above its required level — zero shortfalls across the 18 or 19 that apply." },
  { sel: ".scroll-fade .table .badge-red", title: "Below target", body: "How many applicable capabilities have a weighted score under their required level. It counts capabilities, not depth, so one deep shortfall and one shallow one both count as 1." },
  { sel: ".scroll-fade .table .btn-outline", title: "Open", body: "Goes to this Account Manager's analysis page — the same destination as their name at the start of the row." },
  { sel: ".page-kicker a[href=\"/analysis\"]", title: "Back to dashboard", body: "Returns to the population dashboard: campaign completion KPIs, the zone map, the capability heat map and the roster." },
  { sel: ".report-row a[href^=\"/analysis/zone/\"][href$=\"/pdf\"]", title: "Zone PDF", body: "Renders this zone's own deck — overview radar, segment breakdown, Acquisition against Saturation, and the largest gaps. It covers every Account Manager in the zone and ignores the track filter below." },
  { sel: ".zone-control-label", title: "Track", body: "Chooses which Account Manager columns appear. The Zone avg column is recomputed over whatever is left, so it always averages the columns you can see." },
  { sel: ".zone-controls .seg-btn", title: "Track filter", body: "Shows every Account Manager in the zone, both tracks side by side. Required levels still differ per person, so each cell is coloured against its own AM's track." },
  { sel: ".zmap-select.zone-sort", title: "Rank", body: "Orders the Account Manager columns: by AM code, by name A to Z, strongest first, or weakest first. Strongest and weakest rank on the mean of (weighted score − required) across each AM's scored capabilities." },
  { sel: ".hm-pager-btn[aria-label=\"Scroll left\"]", title: "Scroll left", body: "Moves the Account Manager columns back by 70% of the visible width, minimum 240px. Disabled once the table is at its left edge." },
  { sel: ".hm-pager-btn[aria-label=\"Scroll right\"]", title: "Scroll right", body: "Moves the Account Manager columns forward by 70% of the visible width, minimum 240px. Disabled once the last column is in view." },
  { sel: ".zone-controls .hm-pager", title: "Page the columns", body: "Only rendered when the table is wider than the card. It scrolls from up here because the native scrollbar sits at the foot of a very tall table; the capability column stays stuck to the left." },
  { sel: ".hm-zone thead th", title: "Account Manager column", body: "One Account Manager. Every cell below is their weighted score on that row, coloured against the level their own track requires." },
  { sel: ".zone-am-name", title: "Account Manager", body: "This column's Account Manager. Clicking opens their full analysis — standing, radar, all 22 capabilities per lens and the written justifications." },
  { sel: ".zone-am-code", title: "AM code", body: "The Account Manager's identifier. Ranking \"By AM code\" sorts the columns on this string, and it is the default order." },
  { sel: ".zone-am-rank", title: "Overall standing", body: "Mean of (weighted score − required level) over this AM's scored, applicable capabilities. Green above zero, red below, grey at zero or with no data. Hidden while ranking by AM code." },
  { sel: ".hm-zone .cluster-avg-row .hm-rowhead", title: "Weighted score · gap", body: "Each Account Manager's overall standing: their mean weighted score across scored, applicable capabilities, and underneath, that mean minus the mean level their track requires." },
  { sel: ".hm-zone tr.cluster-row", title: "Cluster", body: "One of the six APEX clusters. The Cluster average row directly beneath it carries its mean, and the capability rows under that belong to it." },
  { sel: ".hm-zone tbody tr:not(.cluster-row):not(.cluster-avg-row) .hm-rowhead", title: "Capability", body: "One of the 22 APEX capabilities. The cells across this row are each Account Manager's weighted score on it, against the level their own track requires. Levels run L1 to L3." },
  { sel: ".hm-zone tbody tr:first-child td.cell:not(.zone-avg-cell)", title: "Overall standing", body: "This Account Manager's mean weighted score across their scored, applicable capabilities, with the difference from their mean required level under it. Colour is that difference." },
  { sel: ".hm-zone .cluster-avg-row td.cell:not(.zone-avg-cell)", title: "Cluster average", body: "This Account Manager's mean weighted score across the capabilities of the cluster named above, with that cluster's mean required level and the difference underneath." },
  { sel: ".hm-zone tbody tr:not(.cluster-row):not(.cluster-avg-row) td.cell:not(.zone-avg-cell)", title: "Capability score", body: "This Account Manager's weighted score on this capability — Self 20% + APEX Panel 35% + Manager 45%, re-normalised over the lenses that submitted — with the required level and the difference beneath." },
  { sel: ".hm-zone .zone-avg-cell", title: "Zone average", body: "The mean across the Account Manager columns currently shown, so it moves with the track filter. The small line is the mean required level over those same people." },
  { sel: ".wizard-top", title: "Assessment header", body: "Which lens these ratings are stored under, the Account Manager they are filed against, and how many of the 22 capabilities already carry a level." },
  { sel: ".wizard-top .page-kicker", title: "Which assessment", body: "The lens these ratings are saved under. Self counts 20% of each capability score, the APEX Panel 35% and the Manager 45%." },
  { sel: ".wizard-top .page-title", title: "Who you are rating", body: "The Account Manager these ratings attach to. Self-assessors only ever see their own linked profile; managers and panel members see whoever they added on My Assessments." },
  { sel: ".wizard-counter", title: "Rated so far", body: "Capabilities that carry a level, out of the 22 in the framework. It ignores the six cluster justifications, which are equally required before you can submit." },
  { sel: ".wizard-top .progress-track, .wizard-top .progress-fill", title: "Rating progress", body: "Rated capabilities divided by 22. It fills from levels only; the six mandatory cluster notes are tracked on the review screen, not here." },
  { sel: ".wizard .banner-ok", title: "Submitted and locked", body: "Every level and note is read-only. A superadmin reopens it from the Administration card on this Account Manager's analysis page; nothing else unlocks it." },
  { sel: ".wizard .banner-warn", title: "Window closed", body: "The deadline for your lens has passed — self or manager deadline, or the day of the panel call. The server rejects saves too, not just this form." },
  { sel: ".wizard .banner-info", title: "Schedule", body: "The date that governs this lens. Scoring shuts at the end of that day, after which the page turns read-only." },
  { sel: ".cap-title", title: "Capability", body: "One of the 22 APEX capabilities, shown in fixed framework order. The level your track requires for it is withheld while you rate, so it cannot anchor the answer." },
  { sel: ".qguide-sub", title: "How to use the prompts", body: "Self-assessors reflect on the two questions before choosing a level; managers and panel members ask them during the assessment conversation." },
  { sel: ".qguide-q", title: "Guiding question", body: "One of the two questions the Question Guide lists for this capability under your lens. Nothing is recorded against it — only the level and the cluster note are stored." },
  { sel: ".qguide-num", title: "Q1 / Q2", body: "Numbering of the two prompts the guide lists for this capability and lens. The order carries no weight; both are optional to use." },
  { sel: ".level-cards", title: "The three levels", body: "The behavioural anchors for this capability: L1 Developing, L2 Proficient, L3 Advanced. One is stored; clicking another replaces it straight away." },
  { sel: ".level-card .lvl-num", title: "Level tag", body: "L1 Developing, L2 Proficient, L3 Advanced. Pressing 1, 2 or 3 on the keyboard picks the same level as clicking the card." },
  { sel: ".level-card .lvl-desc", title: "Behavioural anchor", body: "The framework's wording for this level of this capability. Pick the description that matches what the person does today, not what the role should look like." },
  { sel: ".key-hint", title: "Keyboard shortcut", body: "1, 2 and 3 pick a level; ← and → step between capabilities. The keys are ignored while the cursor is inside the justification box." },
  { sel: ".framework-block", title: "Cluster justification", body: "One mandatory note per cluster, not per capability. The same box with the same text appears on every capability of the cluster and is stored once." },
  { sel: ".framework-kicker", title: "Justification heading", body: "Names the cluster the note belongs to. It is deliberately not the capability name — the note is shared by every capability in that cluster." },
  { sel: ".framework-status", title: "Note status", body: "Whether this cluster's note has any text. Empty notes block the Submit button until all 6 clusters carry one." },
  { sel: ".framework-lead", title: "What to write", body: "The instruction for the note. Self-assessors are asked for situation, actions, results, impact and replication; managers and panel members for the evidence behind the ratings." },
  { sel: ".framework-caps li", title: "One capability to cover", body: "A capability in this cluster that the shared note has to speak to. The list is the cluster's full membership, in framework order." },
  { sel: ".framework-caps .framework-cap-current", title: "The one you are on", body: "The capability currently on screen, brightened inside the list so it is clear which part of the shared note you are adding to." },
  { sel: ".framework-note", title: "The note", body: "The cluster's justification. It autosaves 700 ms after you stop typing, is required to submit, and is shown to the assessed person in My Feedback once all three lenses are in." },
  { sel: ".wizard-nav .btn-outline", title: "Move between capabilities", body: "Steps through the 22 capabilities without changing any answer. The arrow keys do the same when the cursor is outside the note box." },
  { sel: ".dots", title: "Capability map", body: "One square per capability plus a wider one for the review screen. Filled squares are rated, the outlined square is where you are." },
  { sel: ".save-state", title: "Autosave", body: "State of the last write. Levels save on click, notes 700 ms after typing stops. Save failed means it never reached the server — often a closed window." },
  { sel: ".review-list", title: "Your ratings", body: "All 22 capabilities in framework order with the level you stored. Any row showing n/a is unrated and keeps the Submit button disabled." },
  { sel: ".review-list .review-row", title: "One rating", body: "The level you stored for that capability, with an Edit button back to its screen. Nothing here is visible to anyone else until you submit." },
  { sel: ".review-list .lvl-chip", title: "Level stored", body: "The level you chose for this capability: L1 Developing, L2 Proficient, L3 Advanced. n/a means nothing is stored and submitting stays blocked." },
  { sel: ".review-cap", title: "Row label", body: "Names what the row is about: a capability in the ratings list, a cluster in the justifications list underneath." },
  { sel: ".review-row .btn-ghost", title: "Edit", body: "Jumps back into the wizard at that point. From a capability row it opens that capability; from a cluster row it opens the cluster's first capability." },
  { sel: ".theme-notes-review", title: "Cluster justifications", body: "The 6 clusters and whether each has a note. Both this and all 22 levels must be complete before Submit is enabled." },
  { sel: ".theme-notes-review .badge-green", title: "Note written", body: "This cluster's shared justification has text saved. All 6 must reach this state before the assessment can be submitted." },
  { sel: ".theme-notes-review .badge-amber", title: "Note missing", body: "This cluster has no justification saved. The Submit button stays disabled, and the server rejects the submission with the missing clusters named." },
  { sel: "button.btn-primary", title: "Primary action", body: "The page's committing action: submitting the assessment, saving the profile, or generating the PDF report." },
  { sel: ".wizard .card .btn-outline", title: "Back to the list", body: "Returns to My Assessments. It only appears once this assessment is submitted, when there is nothing left to change here." },
  { sel: ".wizard .form-error", title: "Submission refused", body: "The server rejected the submit and this is its reason: an unrated capability, a cluster with no note, or a window that closed while you were working." },
  { sel: ".wizard-help", title: "How to complete this", body: "The rules in force: keyboard shortcuts, one note per cluster rather than per capability, and the two conditions for submitting. It disappears once submitted or locked." },
  { sel: ".assign-box", title: "Add someone to assess", body: "Evaluators build their own list here, with no administrator involved. You can only open a rating screen for someone on your list." },
  { sel: ".assign-input", title: "Search field", body: "Matches on name, code and account as you type, skipping anyone already on your list. Enter picks the first match, Escape closes the list." },
  { sel: ".assign-pop", title: "Matches", body: "At most eight matches, in roster order. Account Managers already on your list are filtered out." },
  { sel: ".assign-opt", title: "Add this person", body: "Clicking adds them to your list and creates your draft assessment for them. One evaluator per person per lens: if someone else holds that lens, the add is refused." },
  { sel: ".assign-opt-meta", title: "Who this is", body: "Their roster code, the account they run and their zone — enough to separate two people with similar names." },
  { sel: ".assign-empty", title: "No match", body: "Nothing in the roster matches that text, or everyone who does is already on your list. Only administrators can create new Account Managers." },
  { sel: ".assign-error", title: "Could not add", body: "The add was refused: usually the person is already held under the same lens by another evaluator, which keeps assessments unshared." },
  { sel: ".am-card", title: "One assessment", body: "A person on your list: their zone, track and account, how far your rating of them has got, and the button into it." },
  { sel: ".am-name", title: "Account Manager", body: "The person this card's assessment is about. The badges under it are their zone, track and account, which decide which capabilities apply to them." },
  { sel: ".am-card .progress-track, .am-card .progress-fill", title: "Your progress", body: "Capabilities you have rated, out of 22. A submitted assessment is drawn full regardless, since nothing is left to do." },
  { sel: ".am-card .badge-gray", title: "Card detail", body: "Either the account this person runs, or a state that needs no action." },
  { sel: ".am-card .btn-ghost", title: "Remove from my list", body: "Drops the person from your list and deletes your empty draft. Offered only while nothing is rated; after the first rating an administrator has to do it." },
  { sel: ".am-card .btn-primary", title: "Open the assessment", body: "Opens the rating wizard for this person at the first unrated capability." },
  { sel: ".page-head + .banner-ok", title: "Assessment submitted", body: "The assessment you just finished is written and locked. It appears in the assessed person's feedback only once all three lenses have submitted." },
  { sel: "input[name=\"name\"]", title: "Your name", body: "Prefilled from the profile your administrator created. This is the name that appears on every assessment, table and PDF report about you." },
  { sel: "input[name=\"account\"]", title: "Account you manage", body: "Free text, e.g. \"Account 12\". It shows as the grey badge next to your name and is what analysis groups your results under." },
  { sel: "select[name=\"zone\"]", title: "Region", body: "One of four Schneider hubs: MEA, SAM, India or Pacific. It sets which zone column and zone average your scores feed." },
  { sel: "select[name=\"track\"]", title: "Track", body: "Acquisition or Saturation. The track decides which of the 22 capabilities apply to you and what level each one requires; the other track's capabilities score n/a." },
  { sel: "select[name=\"segment\"]", title: "Segment", body: "Your account's business segment: Power & Grid, Energy & Chemicals, CS&P · Cloud & Service Providers or Multi-segment. Used to compare like with like across the population." },
  { sel: ".page-head + .form-error", title: "Fill in every field", body: "The form came back rejected: name, account, region, track and segment are all required, and region, track and segment must be values from their lists." },
  { sel: ".page-head .page-kicker", title: "Where you are", body: "Names the page you are on and, on assessment pages, which lens it belongs to." },
  { sel: ".page-head .page-sub", title: "Summary", body: "Sets out what the page counts and against what benchmark." },
  { sel: ".two-col > .card", title: "Strengths / Development", body: "Capabilities split by whether the score clears the level your track requires." },
  { sel: ".mini-list .badge-amber, .mini-list .badge-gray", title: "Row badge", body: "Either the direction and size of a perception gap, or whether a lens has submitted." },
  { sel: ".legend .lens-dot", title: "Colour key", body: "Which column each colour belongs to in the table underneath." },
  { sel: ".hm tbody th.hm-rowhead", title: "Capability", body: "One of the 22 capabilities. The four cells across the row are your level, your manager's, the panel's and the level your track requires." },
  { sel: ".hm td.cell", title: "One rating", body: "A single lens's level for that capability, or the level required." },
  { sel: ".hm .theme-note-block", title: "Written justification", body: "The note one lens wrote for this whole cluster when they submitted. Every lens has to supply one per cluster before it can submit, and it is reproduced verbatim." },
  { sel: ".theme-note-lens", title: "Who wrote it", body: "Which of the three assessments the note underneath came from. Notes are ordered Self, then Manager, then APEX Panel." },
  { sel: ".brand", title: "APEX Assessment", body: "The product mark. APEX rates Strategic Account Managers on 22 capabilities at levels L1 to L3, from three lenses weighted Self 20% / APEX Panel 35% / Manager 45%." },
  { sel: ".brand-mark", title: "SE monogram", body: "A stand-in for the Schneider logo: the real asset sits in public/brand/mark.png and replaces this square when SHOW_LOGO in src/lib/brand.tsx is true. Not clickable." },
  { sel: ".brand-name", title: "APEX Assessment", body: "The application name. APEX is the capability framework being measured here: 22 capabilities grouped into clusters, each required at L1, L2 or L3 depending on the person's track." },
  { sel: ".brand-sub", title: "Schneider Electric", body: "The organisation the campaign belongs to. A fixed label, not a filter: it does not change with your role, zone or assignments." },
  { sel: ".nav-section", title: "Menu group", body: "A heading over the links beneath it. Which headings appear depends on your role and whether you carry an assessment lens." },
  { sel: ".avatar", title: "Your initials", body: "The first letter of up to the first two words of your display name, uppercased. Decoration only: it opens nothing and is not a photo upload." },
  { sel: ".foot-name", title: "Signed in as", body: "The display name on the account you are using. It is set by whoever created the user in Users & Access, and is the name that appears on any assessment you submit." },
  { sel: ".foot-role", title: "Your role", body: "What this account is allowed to do. Superadmin outranks any lens and is shown instead of one." },
  { sel: ".help-item", title: "Help mode", body: "One of the two ways of asking the app about itself." },
  { sel: ".help-pip", title: "Question mode state", body: "Reads on or off. The flag lives in sessionStorage, so question mode stays on across navigations until you turn it off or press Escape." },
  { sel: ".qm-bar", title: "Question mode is on", body: "It tracks the pointer at one lookup per animation frame and explains the most specific element it recognises. Elements with no entry produce no card rather than a vague one." },
  { sel: ".qm-off", title: "Turn it off", body: "Ends question mode and clears the sessionStorage flag, so it stays off on the next page too. Escape does the same thing." },
  { sel: ".chat-fab", title: "APEX Assistant", body: "Opens and closes the assistant panel. The conversation is kept while you move between pages and is discarded on a full reload." },
  { sel: ".chat-panel", title: "APEX Assistant", body: "Each question posts to /api/chat, which rebuilds a role-scoped snapshot of the live database and has Kimi answer over it. It cannot see anything your account cannot." },
  { sel: ".chat-sub", title: "Live data, not a cache", body: "The snapshot is rebuilt from the database on every request. The model is instructed to answer only from it and to say so when the data cannot answer the question." },
  { sel: ".chat-close", title: "Close the panel", body: "Hides the window without clearing the conversation. Reopening it scrolls back to the last reply." },
  { sel: ".chat-empty", title: "Before you ask", body: "Shown until the first message. The suggested questions below it depend on your role: three for superadmins, two for assessors." },
  { sel: ".chat-example", title: "Example question", body: "Clicking sends this question immediately, exactly as written." },
  { sel: ".chat-msg.from-user", title: "Your question", body: "The last 12 messages of the conversation are sent with each request, so follow-up questions keep their context. Each message is truncated at 4000 characters." },
  { sel: ".chat-typing", title: "Waiting for the answer", body: "The request is in flight. The input and Send button stay disabled until the reply arrives or the call fails." },
  { sel: ".chat-msg.from-bot", title: "The answer", body: "Generated from the snapshot your role may see. An assessor's snapshot excludes required levels, other people's ratings and all individual results, and the model is told to refuse those questions." },
  { sel: ".chat-error", title: "The answer failed", body: "Either the network call failed, the session expired, or no AI key is configured on this server. Your question stays in the transcript so you can send it again." },
  { sel: ".chat-input-row .input", title: "Ask a question", body: "Write in English or French; the assistant replies in the language you used. Disabled while an answer is being generated, and refocused when the reply lands." },
  { sel: ".login-card", title: "Sign in", body: "The only way in. Accounts are created by a superadmin in Users & Access: there is no self-registration, no invitation email and no self-service password reset." },
  { sel: ".login-sub", title: "What this is", body: "APEX assesses Strategic Account Managers over 22 capabilities. Your username, password, lens and the people you may assess are all set by an administrator." },
  { sel: ".form-error", title: "Rejected", body: "The action did not go through, and nothing was changed." },
  { sel: ".form-ok", title: "Done", body: "The server action succeeded and passed this text back in the ?ok= query string. It disappears on the next navigation; nothing needs dismissing." },
  { sel: ".page-title", title: "Page heading", body: "Names the page you are on." },
  { sel: "input[name=\"displayName\"]", title: "Full name", body: "The name shown in the sidebar, the user table and on anything this person submits. For a new self-assessor it also names the Account Manager record created alongside the login." },
  { sel: "input[name=\"username\"]", title: "Username", body: "The sign-in name. It is lowercased on save and refused if already taken. There is no invitation email: you pass the username and password to the person yourself." },
  { sel: ".form-grid input[name=\"password\"]", title: "Initial password", body: "Minimum six characters, stored hashed. The field is deliberately plain text rather than masked, so you can read the password back to the person you are creating it for." },
  { sel: "select[name=\"role\"]", title: "Role", body: "Assessor reaches only the Dashboard and their own assessment work. Superadmin adds Individuals, this page and every individual's results. A superadmin may also carry a lens and assess." },
  { sel: ".form-grid select[name=\"lens\"]", title: "Lens", body: "Which of the three ratings this account gives, and how much it weighs: Self 20%, APEX Panel 35%, Manager 45%. An assessor with no lens is rejected; a superadmin may have none." },
  { sel: ".assign-label", title: "Picker label", body: "Names the choice beneath it." },
  { sel: "label:has(input[name=\"selfmode\"])", title: "Self-assessor setup", body: "Chooses whether a new Account Manager record is created for this person or an existing one is reused." },
  { sel: "select[name=\"am\"][required]", title: "Their existing profile", body: "Attaches this login to an Account Manager already in the system, listed as code · name. Required once you choose the existing-person option." },
  { sel: "div.details-box .check-grid", title: "Who they assess", body: "Every Account Manager in the system. A Manager or APEX Panel evaluator only ever sees the ones ticked here, in the pages and in the assistant. Ticking none creates the login with nothing to do." },
  { sel: "div.details-box .check-grid label", title: "Assign this person", body: "Ticked, this Account Manager appears in the new evaluator's queue." },
  { sel: ".table thead th", title: "Column", body: "Names the column beneath it." },
  { sel: "details.details-box > summary", title: "Expander", body: "Opens the control for this cell." },
  { sel: ".details-inner select[name=\"lens\"]", title: "Change the lens", body: "Sets or clears this account's lens after creation. The lens is read fresh on every request, so their menu and access change on their next page load." },
  { sel: ".details-inner select[name=\"am\"]", title: "Their own profile", body: "The single Account Manager record this self-assessor rates. Saving replaces whatever was linked before, so their existing draft or submission stops counting towards the old profile." },
  { sel: "details.details-box .check-grid label", title: "Assigned Account Manager", body: "Ticked, this evaluator assesses that person." },
  { sel: ".details-inner input[name=\"password\"]", title: "New password", body: "Minimum six characters, shown as plain text so you can read it back. Setting it replaces the stored hash and deletes that user's sessions, signing them out everywhere." },
  { sel: ".details-inner .card-sub", title: "Note", body: "Explains what the control above or below it does." },
  { sel: ".btn-primary", title: "Action", body: "Runs the action named on the button." },
  { sel: ".btn-outline", title: "Action", body: "Runs the action named on the button." },
  { sel: ".btn-danger", title: "Destructive action", body: "Deletes data. There is no undo and no second confirmation dialog." },
  { sel: ".tool-notes li", title: "What the tool does", body: "Describes the button below it." },
  { sel: ".tool-notes code", title: "Sandbox credential", body: "A login created by Create test sandbox." },
];

/**
 * Everything question mode can answer.
 *
 * CORE first only for readability — the lookup is by DOM depth, not by array order, so the
 * resolver for a heat cell beats the fixed answer for the card it sits in whichever way
 * round they are listed.
 */
export const HELP_ENTRIES: HelpEntry[] = [...CORE_ENTRIES, ...MORE_ENTRIES];

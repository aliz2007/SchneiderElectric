// End-to-end smoke test — drives the real UI with Playwright.
// Prereqs: app running (`npm run build && npx next start -p 3111`), fresh DB recommended
//   (delete the data/ folder before starting the server). The Kimi key is baked in,
//   so start the server with MOONSHOT_ENABLED=0 to keep this run hermetic (deterministic
//   narrative, no external API call): `MOONSHOT_ENABLED=0 npx next start -p 3111`.
// Run from the apex-assessment directory:  node e2e/smoke.mjs
// Env: BASE (default http://localhost:3111) · SHOTS (screenshot dir, default ./e2e-shots)
//      CHROMIUM (executable path, default /opt/pw-browsers/chromium; omit-able if
//      playwright's own browser install is available)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const SHOTS = process.env.SHOTS ?? "./e2e-shots";
mkdirSync(SHOTS, { recursive: true });

// distinctive per-theme note captured by the manager, asserted later in analysis
const THEME_NOTE = "Strong CTO relationship; needs a steadier C-level cadence next quarter.";

const results = [];
const ok = (name) => { results.push(`✓ ${name}`); console.log(`✓ ${name}`); };
const fail = (name, extra) => { results.push(`✗ ${name} ${extra ?? ""}`); console.log(`✗ ${name}`, extra ?? ""); };

const browser = await chromium.launch(
  process.env.CHROMIUM === "" ? {} : { executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" }
);
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();

try {
  // ---- 1. login as vladimir ----
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(700); // let entrance animation settle
  await page.screenshot({ path: `${SHOTS}/1-login.png` });
  await page.fill("#username", "vladimir");
  await page.fill("#password", "wrong-password");
  await page.click("button[type=submit]");
  await page.waitForURL("**/login?error=1");
  ok("wrong password rejected");

  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  ok("vladimir logs in → lands on dashboard");

  // ---- 2. load demo data ----
  await page.goto(`${BASE}/admin/users`);
  await page.locator('button:has-text("Load demo dataset")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  ok("demo dataset loaded");
  await page.waitForTimeout(700); // let entrance animation settle
  await page.screenshot({ path: `${SHOTS}/4-admin-users.png` });

  // ---- 3. dashboard with data ----
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".hm");
  await page.waitForTimeout(900); // let KPI count-up + reveal animations settle
  const goodCells = await page.locator(".cell.hm-good").count();
  const anyCells = await page.locator("td.cell").count();
  anyCells > 80 && goodCells > 0 ? ok(`heat map renders (${anyCells} cells)`) : fail("heat map cells", `${anyCells}`);
  // client feedback: the training needs heat map needs a cluster average per theme,
  // one per cluster, so a zone's standing on a theme reads off a single row
  const hmAvgRows = await page.locator("table.hm tr.cluster-avg-row").count();
  hmAvgRows === 6
    ? ok("training needs heat map carries a cluster average row per theme")
    : fail("heat map cluster averages", `${hmAvgRows} average rows, expected 6`);
  const completion = await page.locator(".kpi-value").first().textContent();
  completion?.trim() === "100%" ? ok("completion KPI = 100% after demo load") : fail("completion KPI", completion ?? "");
  // the maturity KPI has to carry its benchmark, or the number means nothing
  (await page.locator(".kpi-bench").textContent())?.includes("expected")
    ? ok("maturity KPI shows the expected average")
    : fail("KPI benchmark", "not shown");
  // the roster title counts the roster instead of hardcoding "TOP 25"
  (await page.locator('a[href^="/analysis/report/pdf"]').count()) === 1
    ? ok("dashboard offers the capability dashboard PDF")
    : fail("dashboard download button", "not found");
  const rosterTitle = await page.locator(".card-title", { hasText: "Roster" }).textContent();
  // a scheduled date must stay findable on the roster even after its lens is submitted:
  // hiding it once "done" was exactly why the client could not find the date they had set
  (await page.locator("table.table thead th", { hasText: "Schedule" }).count()) === 1
    ? ok("roster carries the assessment schedule")
    : fail("schedule column", "not found");
  // Dates on this chart must never be ambiguous. A two-digit year rendered "Aug 26",
  // which reads as the 26th of August on a scheduling view.
  // Give the timeline something to draw first: with no dates set it renders its empty
  // state and the assertions below would pass without testing anything.
  // Two people get dates, not one: the assessor scope check further down needs a
  // timeline that still has entries after it is cut to one person, or it passes on
  // an empty timeline without testing anything.
  {
    // all three lenses get a date, targeted by field name: the editor leads with the
    // self deadline now, so filling `input[type=date]` positionally set the wrong one
    for (const [amId, days] of [[1, 30], [2, 45]]) {
      const day = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
      await page.goto(`${BASE}/analysis/am/${amId}`);
      await page.locator('button:has-text("Assessment schedule")').click();
      await page.waitForSelector('input[name="selfDeadline"]');
      await page.fill('input[name="selfDeadline"]', day(days));
      await page.fill('input[name="managerDeadline"]', day(days + 10));
      await page.fill('input[name="panelDatetime"]', `${day(days + 20)}T14:00`);
      await page.locator('button:has-text("Save schedule")').click();
      await page.waitForTimeout(1200);
    }
    await page.goto(`${BASE}/analysis`);
    await page.waitForSelector(".tl-lane-track");
  }
  const axisLabels = await page.locator(".tl-tick-label").allTextContents();
  axisLabels.length > 0 && axisLabels.every((t) => /^[A-Za-z]{3,} \d{4}$/.test(t.trim()))
    ? ok(`timeline axis uses full years (${axisLabels.join(", ")})`)
    : fail("timeline axis labels", axisLabels.join(" | ") || "no ticks rendered");
  const todayLabel = (await page.locator(".tl-today-label").textContent()) ?? "";
  const expectedToday = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  todayLabel.includes(expectedToday)
    ? ok(`timeline marks today correctly (${expectedToday})`)
    : fail("timeline today marker", `showed "${todayLabel.trim()}", expected "${expectedToday}"`);
  /Roster · \d+ Account Manager/.test(rosterTitle ?? "")
    ? ok(`roster title counts the roster ("${rosterTitle?.trim()}")`)
    : fail("roster title", rosterTitle ?? "(none)");

  // ---- 3b. zone map: the four zones must not all come out the same colour ----
  // Zone averages sit inside a fraction of a level, so on an absolute on-target to
  // critical ramp all four rendered identical green and the map compared nothing.
  // The shading is relative to the zones in view, which is what these check.
  {
    await page.waitForSelector(".zmap-label-val");
    const swatches = await page.locator(".zmap-label-val").evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).backgroundColor)
    );
    const distinct = new Set(swatches);
    swatches.length >= 3 && distinct.size === swatches.length
      ? ok(`zone map gives each zone its own colour (${distinct.size} of ${swatches.length} distinct)`)
      : fail("zone map colours", `${distinct.size} distinct colours for ${swatches.length} zones`);
    // a relative ramp is only honest if it says what it is relative to
    const legend = (await page.locator(".zmap-scale").innerText()).replace(/\s+/g, " ").trim();
    /Zones compared .+ [+-]?\d\.\d\d .+ [+-]?\d\.\d\d/.test(legend)
      ? ok(`zone map legend names both ends (${legend})`)
      : fail("zone map legend", legend || "(empty)");
  }
  await page.screenshot({ path: `${SHOTS}/2-dashboard.png`, fullPage: false });

  // ---- 3c. Individual Results: account column + sortable headings ----
  await page.goto(`${BASE}/analysis/individuals`);
  await page.waitForSelector("table.table");
  (await page.locator(".th-sort").count()) >= 9
    ? ok("individual results headings are sortable")
    : fail("sortable headings", "not found");
  (await page.locator(".am-account").count()) > 0
    ? ok("individual results shows the account")
    : fail("account column", "not found");
  {
    const heads = await page.locator("table.table thead th").allTextContents();
    const need = ["Zone", "Track", "Segment", "Account", "Self avg", "Mgr avg", "Panel avg", "Weighted", "Avg required", "Gap"];
    const missing = need.filter((h) => !heads.some((t) => t.includes(h)));
    missing.length === 0
      ? ok("population table carries every column the proposal asked for")
      : fail("population columns", `missing ${missing.join(", ")}`);
  }
  (await page.locator('a[href^="/analysis/population/pdf"]').count()) === 1
    ? ok("population overview offers a PDF download")
    : fail("population download button", "not found");
  await page.locator('.th-sort a:has-text("Weighted")').click();
  await page.waitForURL(/sort=weighted/);
  // resolve the column by its heading, not by index: the table gains columns over time and
  // a hardcoded nth-child silently starts asserting about the wrong one
  const headTexts = await page.locator("table.table thead th").allTextContents();
  const weightedIdx = headTexts.findIndex((t) => t.includes("Weighted")) + 1;
  const weightedCol = await page.locator(`table.table tbody tr td:nth-child(${weightedIdx})`).allTextContents();
  const nums = weightedCol.map((t) => parseFloat(t)).filter((n) => !Number.isNaN(n));
  nums.every((n, i) => i === 0 || nums[i - 1] >= n)
    ? ok(`sorting by weighted orders the table (${nums.length} rows, high to low)`)
    : fail("weighted sort", nums.slice(0, 5).join(" "));
  await page.goto(`${BASE}/analysis`); // the steps below continue on the dashboard
  await page.waitForSelector(".hm");

  // ---- 3a. centralized filters window (track / segment / capability in one panel) ----
  await page.locator(".filter-toggle").click();
  await page.waitForSelector(".filter-panel");
  ok("filters window opens");
  await page.locator(".filter-panel .seg-btn", { hasText: "Acquisition" }).click();
  await page.waitForFunction(() => location.search.includes("track=Acquisition"));
  ok("track filter scopes the dashboard via URL");
  await page.goto(`${BASE}/analysis`); // reset filters for the following steps
  await page.waitForSelector(".hm");

  // ---- 3b. APEX Assistant (floating chatbot) ----
  (await page.locator(".chat-fab").count()) === 1
    ? ok("assistant bubble shown (superadmin)")
    : fail("assistant bubble", "not found");
  await page.click(".chat-fab");
  await page.waitForSelector(".chat-panel");
  ok("assistant panel opens");
  await page.fill(".chat-input-row input", "Which assessments are missing?");
  await page.click('.chat-input-row button[type="submit"]');
  // the e2e server runs with MOONSHOT_ENABLED=0, so the deterministic "turned off"
  // reply proves the whole widget → API → snapshot round-trip without an external call
  await page.waitForSelector(".chat-msg.from-bot:not(.chat-typing)", { timeout: 20000 });
  const botReply = await page.locator(".chat-msg.from-bot:not(.chat-typing)").first().textContent();
  botReply?.includes("turned off")
    ? ok("assistant answers through the API (AI-off reply)")
    : fail("assistant reply", botReply ?? "(none)");
  await page.click(".chat-close");
  await page.waitForTimeout(200);

  // ---- 4. individual analysis ----
  await page.locator("text=Analysis →").first().click();
  await page.waitForSelector("text=Capability detail");
  ok("individual analysis renders");
  // segment is shown at the top alongside zone/track
  (await page.locator(".am-meta .badge-segment").count()) === 1
    ? ok("segment shown in the individual profile header")
    : fail("segment badge on detail", "not found");
  // the overall standing sits above the fold: the score, its benchmark, and the radar
  (await page.locator(".standing-card .standing-value").count()) === 1
    ? ok("individual page leads with the final score")
    : fail("standing card", "not found");
  (await page.locator(".standing-card .radar-svg").count()) === 1
    ? ok("individual page shows the profile radar")
    : fail("radar on individual page", "not found");
  // the radar is unreadable without its benchmark web
  (await page.locator(".radar-legend").textContent())?.includes("Expected level")
    ? ok("radar plots the expected level")
    : fail("radar benchmark", "no expected-level web");
  // an Acquisition AM has no required level in Saturation Excellence, so that axis must be
  // dropped rather than dragging the expected web to the centre
  const radarAxes = await page.locator(".radar-svg text").allTextContents();
  !radarAxes.some((t) => t.includes("Saturation"))
    ? ok("radar drops the cluster that does not apply to the track")
    : fail("radar axes", "plots a cluster with no required level");
  // each cluster header carries its own average
  (await page.locator(".cluster-avg-label").count()) >= 5
    ? ok("capability detail shows an average per cluster")
    : fail("cluster averages", "not found");
  await page.waitForTimeout(700); // let entrance animation settle
  await page.screenshot({ path: `${SHOTS}/3-individual.png` });

  // ---- 5. PDF export ----
  const pdfResp = await page.context().request.get(`${BASE}/analysis/am/1/pdf`);
  const pdfBuf = await pdfResp.body();
  // 4 pages exactly: a 5th means the radar block was orphaned onto a page of its own,
  // which is the layout regression the client reported twice
  const pdfPages = (pdfBuf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  pdfPages === 4 ? ok("PDF is 4 pages (radar not orphaned)") : fail("PDF page count", `${pdfPages}`);
  const pdfOk =
    pdfResp.status() === 200 &&
    pdfResp.headers()["content-type"] === "application/pdf" &&
    pdfBuf.subarray(0, 5).toString() === "%PDF-" &&
    pdfBuf.length > 5000;
  pdfOk ? ok(`PDF export downloads (${pdfBuf.length} bytes)`) : fail("PDF export", `status ${pdfResp.status()}`);
  (await page.locator('button:has-text("Export PDF")').count()) > 0
    ? ok("Export PDF button on profile page")
    : fail("Export PDF button", "not found");

  // ---- 5b. population-level PDF reports (the client's dashboard proposal) ----
  for (const [label, path, minPages] of [
    ["capability dashboard", "/analysis/report/pdf", 8],
    ["population overview", "/analysis/population/pdf", 1],
  ]) {
    const resp = await page.context().request.get(`${BASE}${path}`);
    const buf = await resp.body();
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    const good =
      resp.status() === 200 &&
      resp.headers()["content-type"] === "application/pdf" &&
      buf.subarray(0, 5).toString() === "%PDF-" &&
      pages >= minPages;
    good
      ? ok(`${label} PDF downloads (${pages} pages, ${buf.length} bytes)`)
      : fail(`${label} PDF`, `status ${resp.status()} pages ${pages}`);
  }
  // the deck must honour the filters it was asked for, not silently return everything
  const filtered = await page.context().request.get(`${BASE}/analysis/report/pdf?track=Acquisition`);
  filtered.status() === 200 && (await filtered.body()).length > 5000
    ? ok("capability dashboard PDF accepts a track filter")
    : fail("filtered dashboard PDF", `status ${filtered.status()}`);

  // both reports are population-level, so they must be superadmin-only; checked from the
  // assessor session further down

  // ---- 5c. the four things the dashboard proposal needed that did not exist ----
  // Account Type: seeded on the roster, filterable
  await page.goto(`${BASE}/analysis/individuals?accountType=Strategic`);
  await page.waitForSelector("table.table");
  const typed = await page.locator("table.table tbody tr").count();
  typed > 0
    ? ok(`account type filter works (${typed} Strategic)`)
    : fail("account type filter", "no rows");

  // Perf YTD: set it on one AM and confirm it surfaces in the table
  await page.goto(`${BASE}/analysis/am/1`);
  await page.locator('button:has-text("Account details")').click();
  await page.waitForSelector('input[name="perfYtd"]');
  await page.fill('input[name="perfYtd"]', "104.5");
  await page.locator('button:has-text("Save details")').click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/analysis/individuals?q=Adam`);
  await page.waitForSelector("table.table");
  (await page.locator("table.table tbody tr").first().innerText()).includes("104.5")
    ? ok("Perf YTD saves and shows on the population table")
    : fail("Perf YTD", "not shown after saving");

  // ---- 6. zone view ----
  await page.goto(`${BASE}/analysis/zone/MEA`);
  await page.waitForSelector("text=Zone benchmark");
  ok("zone MEA heat map renders");
  // a report for THIS zone, downloadable from the zone page
  (await page.locator('a[href="/analysis/zone/MEA/pdf"]').count()) === 1
    ? ok("zone page offers its own PDF")
    : fail("zone PDF button", "not found");
  {
    const r = await page.context().request.get(`${BASE}/analysis/zone/MEA/pdf`);
    const buf = await r.body();
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    r.status() === 200 && buf.subarray(0, 5).toString() === "%PDF-" && pages >= 3
      ? ok(`zone PDF downloads (${pages} pages)`)
      : fail("zone PDF", `status ${r.status()} pages ${pages}`);
    const disp = r.headers()["content-disposition"] ?? "";
    disp.includes("MEA") ? ok("zone PDF is named after its zone") : fail("zone PDF filename", disp);
  }
  // The weighted score is a float, so every cell MUST be formatted. Interpolating it raw
  // once printed "L2.3000000000000003" across the whole benchmark. Asserted on the digits
  // rather than on a whole-cell shape, so adding a row to the table cannot silently
  // disable the guard: three or more decimals anywhere is an unformatted float.
  const zoneCells = await page.locator("table.hm td.cell").allTextContents();
  const rawFloats = zoneCells.filter((t) => /\d\.\d{3,}/.test(t));
  zoneCells.length > 0 && rawFloats.length === 0
    ? ok(`zone benchmark scores are all formatted (${zoneCells.length} cells)`)
    : fail("zone score formatting", rawFloats.slice(0, 3).join(" | ") || "no cells");
  // every scored cell must carry its benchmark, otherwise a number cannot be read as good or bad
  const withReq = zoneCells.filter((t) => /req/.test(t)).length;
  const scored = zoneCells.filter((t) => t.trim() !== "n/a").length;
  scored > 0 && withReq === scored
    ? ok(`every scored zone cell shows its required level (${scored})`)
    : fail("zone benchmark req", `${withReq}/${scored} carry a required level`);
  // client feedback: a theme has to be readable without adding up its capability rows,
  // and each AM needs their overall weighted score and gap at the top of their column
  const zoneAvgRows = await page.locator("table.hm tr.cluster-avg-row").count();
  zoneAvgRows === 7
    ? ok("zone benchmark carries an average row per cluster plus the overall score")
    : fail("zone benchmark cluster averages", `${zoneAvgRows} average rows, expected 7`);
  (await page.locator("table.hm th", { hasText: "Weighted score · gap" }).count()) === 1
    ? ok("zone benchmark leads with each AM's weighted score and gap")
    : fail("zone overall row", "not found");
  // sorting by AM name must be offered, not just by code
  (await page.locator('.zone-sort option[value="name"]').count()) === 1
    ? ok("zone benchmark can sort by AM name")
    : fail("sort by name", "option missing");

  // ---- 6. create an assessor (manager lens, assigned AM02) ----
  // Manager lens → the AM picker renders as a checkbox grid inside the create card.
  await page.goto(`${BASE}/admin/users`);
  await page.fill('input[name="displayName"]', "Test Manager");
  await page.fill('input[name="username"]', "tmanager");
  await page.fill('input[name="password"]', "secret123");
  await page.selectOption('select[name="lens"]', "manager");
  await page.locator('.card:has-text("Create user") input[name="am"][value="2"]').check();
  await page.locator('button:has-text("Create user")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  ok("assessor created with 1 assignment");

  // demo data submitted everything — reopen AM02's manager assessment so tmanager can edit
  await page.goto(`${BASE}/analysis/am/2`);
  await page.locator('button:has-text("Reopen Manager Assessment")').click();
  await page.waitForTimeout(600);
  ok("manager assessment reopened by superadmin");

  // ---- 7. confidentiality: assessor can't see analysis, sees only own task ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "tmanager");
  await page.fill("#password", "secret123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/rate");
  ok("assessor lands on My Assessments");

  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".kpi-value");
  ok("assessor can view the shared dashboard");

  // The dashboard is shared because its aggregates name nobody. The roster and the
  // campaign timeline DO name people, one row per person with their submission state
  // and deadlines, so they are cut to this assessor's assignments (currently AM02
  // only). Without this the shared page hands a manager the status of all 25.
  const rosterNames = await page.locator("table.table tbody tr td:first-child").allInnerTexts();
  rosterNames.length === 1
    ? ok("dashboard roster scoped to the assessor's own assignments")
    : fail("roster scoping", `${rosterNames.length} rows visible to an assessor`);
  (await page.locator(".card-title", { hasText: "People you assess" }).count()) === 1
    ? ok("roster card retitled for assessors")
    : fail("roster title", "no 'People you assess' heading");
  // the timeline is cut the same way: two people carry dates, this assessor must see
  // only their own. Asserting on the entries, not just the marker count, so an empty
  // timeline cannot pass this by accident.
  const tlItems = await page.locator(".tl-item").allInnerTexts();
  const mine = rosterNames[0]?.trim() ?? " ";
  tlItems.length > 0 && tlItems.every((t) => t.includes(mine))
    ? ok(`campaign timeline scoped to the assessor's own people (${tlItems.length} entries)`)
    : fail("timeline scoping", tlItems.join(" | ") || "no entries to check");
  // an assessor has no individual page to open, so the timeline must not link to one
  const tlLinks = await page.locator("a.tl-item").count();
  tlLinks === 0
    ? ok("timeline entries are not links for assessors")
    : fail("timeline links", `${tlLinks} links shown to an assessor`);
  // the thermal map ships raw per-AM panel scores to the browser: admin only
  (await page.locator(".map-card").count()) === 0
    ? ok("zone map withheld from assessors")
    : fail("map scoping", "map card rendered for an assessor");

  // every superadmin surface bounces an assessor back to their own work
  for (const [label, path] of [
    ["individual results", "/analysis/individuals"],
    ["an individual analysis", "/analysis/am/1"],
    ["a zone benchmark", "/analysis/zone/MEA"],
    ["user administration", "/admin/users"],
  ]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForURL("**/rate**");
    ok(`assessor blocked from ${label} (redirected)`);
  }

  // the population reports name every AM with their manager and panel scores
  for (const [label, path] of [
    ["capability dashboard", "/analysis/report/pdf"],
    ["population overview", "/analysis/population/pdf"],
    ["zone", "/analysis/zone/MEA/pdf"],
    ["assigned individual", "/analysis/am/2/pdf"],
    ["unassigned individual", "/analysis/am/1/pdf"],
  ]) {
    const r = await page.context().request.get(`${BASE}${path}`);
    const body = await r.body();
    const leaked = r.headers()["content-type"] === "application/pdf" && body.subarray(0, 5).toString() === "%PDF-";
    !leaked
      ? ok(`assessor cannot download the ${label} PDF`)
      : fail(`${label} leaked to assessor`, `status ${r.status()}`);
  }

  await page.goto(`${BASE}/rate`);
  const cards = await page.locator(".am-card").count();
  cards === 1 ? ok("assessor sees exactly 1 assigned AM") : fail("assignment scoping", `${cards} cards`);

  // self-service: add anyone to your list by typing their name
  await page.fill(".assign-input", "Omar");
  await page.locator(".assign-opt").first().click();
  await page.waitForFunction(() => document.querySelectorAll(".am-card").length === 2);
  ok("self-assigned an AM by typing a name");

  // ---- 8. rating wizard (AM02 reopened above; all 22 pre-rated by demo → review; edit one) ----
  await page.locator('.am-card:has-text("Layla Haddad") a.btn').click();
  await page.waitForSelector(".review-list");
  ok("wizard opens on review screen for fully-rated draft");
  await page.locator('.review-row button:has-text("Edit")').first().click();
  await page.waitForSelector(".level-cards");
  const reqVisible = await page.locator("text=/required level|Req \\//i").count();
  reqVisible === 0 ? ok("required level hidden during assessment") : fail("required level leak", `${reqVisible}`);
  await page.locator(".level-card").nth(0).click(); // change to L1
  await page.waitForSelector("text=Saved ✓");
  ok("rating change autosaves");

  // manager/panel justify EVERY theme with ONE mandatory note; exactly one note field
  // shows at a time (for the current theme). Self-assessors get the 5-question framework
  // instead — checked in step 10.
  const noteFields = await page.locator(".framework-note").count();
  noteFields === 1 ? ok("manager sees a per-theme note field") : fail("manager theme note field", `${noteFields}`);
  // a justification is now required for every theme before submitting: walk the capability
  // dots and fill the note for each theme (the field belongs to the current cap's cluster;
  // the client keeps the value on revisit, so this fills all six distinct clusters).
  for (let i = 0; i < 22; i++) {
    await page.locator(".dots .dot").nth(i).click();
    await page.waitForSelector(".framework-note");
    if (!(await page.locator(".framework-note").inputValue())) await page.fill(".framework-note", THEME_NOTE);
  }
  await page.waitForTimeout(1200); // let the last debounced note save reach the server
  await page.screenshot({ path: `${SHOTS}/5-wizard.png` });

  // reload → draft persisted with all 22 still answered + our edit + the theme note
  await page.reload();
  await page.waitForSelector(".level-cards, .review-list");
  const answered = await page.locator(".dot.answered").count();
  answered === 22 ? ok("draft persists across reload (22 answered)") : fail("draft persistence", `${answered}`);
  const firstChip = (await page.locator(".review-row .lvl-chip").first().textContent())?.trim();
  firstChip === "L1" ? ok("edited level persisted (L1)") : fail("edited level", firstChip ?? "");
  // the review screen shows a completion badge per theme; all six now justified
  const themesComplete = await page.locator(".theme-notes-review .badge-green").count();
  themesComplete === 6 ? ok("all six themes justified (complete badges persist)") : fail("theme justification badges", `${themesComplete}`);

  // submit the manager assessment so the note feeds analysis (all 22 rated → allowed)
  await page.locator('button:has-text("Submit assessment")').click();
  await page.waitForURL(/\/rate(\?|$)/);
  ok("manager assessment submitted");

  // ---- 9. back as superadmin: theme note surfaces in analysis + PDF ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  ok("vladimir back in");

  await page.goto(`${BASE}/analysis/am/2`);
  await page.waitForSelector("text=Capability detail");
  const noteInAnalysis = await page
    .locator(`.theme-note-block:has-text(${JSON.stringify(THEME_NOTE.slice(0, 24))})`)
    .count();
  noteInAnalysis > 0 ? ok("theme note surfaces in capability detail") : fail("theme note in analysis", `${noteInAnalysis}`);
  (await page.locator('text=/by Test Manager/').count()) > 0
    ? ok("submitter name shown on the individual view")
    : fail("rater name", "not shown");
  const pdf2 = await page.context().request.get(`${BASE}/analysis/am/2/pdf`);
  const pdf2Buf = await pdf2.body();
  pdf2.status() === 200 && pdf2Buf.subarray(0, 5).toString() === "%PDF-" && pdf2Buf.length > 5000
    ? ok("PDF with theme note renders")
    : fail("PDF with theme note", `status ${pdf2.status()}`);

  // ---- 10. self-assessor lands straight on their own assessment (no picking; can add own notes) ----
  // Self lens → the AM picker becomes a single-select "which AM is this person".
  await page.goto(`${BASE}/admin/users`);
  await page.fill('input[name="displayName"]', "Self KAM");
  await page.fill('input[name="username"]', "selfkam");
  await page.fill('input[name="password"]', "secret123");
  await page.selectOption('select[name="lens"]', "self");
  await page.locator('.card:has-text("Create user") label:has-text("existing Account Manager") input[type="radio"]').check();
  await page.selectOption('.card:has-text("Create user") select[name="am"]', "4");
  await page.locator('button:has-text("Create user")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  ok("self-assessor created (linked to AM04)");

  // demo submitted AM04's self assessment — reopen it so the KAM can open it
  await page.goto(`${BASE}/analysis/am/4`);
  await page.locator('button:has-text("Reopen Self Assessment")').click();
  await page.waitForTimeout(500);

  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "selfkam");
  await page.fill("#password", "secret123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/rate/4");
  ok("self-assessor lands directly on their own self-assessment");
  const ownName = await page.locator(".wizard-top .page-title").textContent();
  ownName?.includes("Sofia Rahman") ? ok("self-assessor sees their own profile") : fail("self profile", ownName ?? "");
  // the assessment page carries a how-to help block
  const helpShown = await page.locator(".wizard-help").count();
  helpShown > 0 ? ok("assessment how-to help shown") : fail("how-to help block", `${helpShown}`);
  // assessors get the assistant too (fed only their own scoped data server-side)
  (await page.locator(".chat-fab").count()) === 1
    ? ok("assistant bubble also shown for assessors")
    : fail("assessor assistant bubble", "not found");
  // self-assessors justify each theme with ONE mandatory concrete-example note (guided prompt).
  // AM04 is fully rated so the wizard opens on review — open a theme to reach the note field.
  await page.locator(".dots .dot").first().click();
  await page.waitForSelector(".framework-block");
  const selfFields = await page.locator(".framework-note").count();
  selfFields === 1 ? ok("self-assessor sees one justification note per theme") : fail("self note field", `${selfFields}`);
  (await page.locator(".framework-lead").textContent())?.includes("concrete example")
    ? ok("self-assessor sees the guided justification prompt")
    : fail("self justification prompt", "not shown");
  // the note is shared by the whole cluster: the block must say so and name what it covers,
  // otherwise it reads as a per-question box repeating the previous answer
  const kicker = await page.locator(".framework-kicker").textContent();
  kicker?.startsWith("Justification ·") && !kicker.toLowerCase().includes("theme")
    ? ok('justification block is titled "Justification · <cluster>"')
    : fail("justification title", kicker ?? "(none)");
  const capLines = await page.locator(".framework-caps li").allTextContents();
  capLines.length >= 2
    ? ok(`the block lists the ${capLines.length} capabilities the note must cover`)
    : fail("covered-capability list", `${capLines.length} entries`);
  (await page.locator(".framework-caps .framework-cap-current").count()) === 1
    ? ok("the capability being rated is highlighted in that list")
    : fail("current capability highlight", "not found");
  // the lead and the placeholder must not say the same thing twice
  const lead = (await page.locator(".framework-lead").textContent()) ?? "";
  const ph = (await page.locator(".framework-note").getAttribute("placeholder")) ?? "";
  ph.startsWith("1. ") && ph.includes("\n2. ") && !ph.includes("concrete example")
    ? ok("the placeholder seeds one numbered line per capability, no duplicated prose")
    : fail("placeholder", `lead="${lead.slice(0, 40)}" placeholder="${ph.slice(0, 60)}"`);
  // Type character-by-character, NOT fill(): a nested-component regression once remounted
  // this textarea on every keystroke, so focus was lost after each letter. fill() sets the
  // value in one shot and would not catch it; pressSequentially reproduces real typing.
  const TYPED = "Situation: rebuilt the exec map";
  await page.locator(".framework-note").click();
  await page.locator(".framework-note").pressSequentially(TYPED, { delay: 15 });
  const typedValue = await page.locator(".framework-note").inputValue();
  typedValue === TYPED
    ? ok("typing in the justification keeps focus (no per-keystroke remount)")
    : fail("justification typing", `got "${typedValue}" expected "${TYPED}"`);

  const SELF_NOTE =
    "Situation: took over a stalled strategic account. Actions: rebuilt the executive map. Results: reopened two deals. Impact: protected the renewal.";
  await page.locator(".framework-note").fill(SELF_NOTE);
  await page.waitForTimeout(1100); // debounced autosave (700ms) + server round-trip
  const themeDone = await page.locator(".framework-status.ok").count();
  themeDone >= 1 ? ok("theme marks complete once justified") : fail("theme completion", `${themeDone}`);
  await page.reload();
  await page.waitForSelector(".level-cards, .review-list");
  await page.locator(".dots .dot").first().click();
  await page.waitForSelector(".framework-block");
  const firstFw = await page.locator(".framework-note").inputValue();
  firstFw === SELF_NOTE ? ok("self justification persists (server accepts it)") : fail("self justification persistence", firstFw);

  // the pick-someone list is out of reach — /rate redirects them onto their own assessment
  await page.goto(`${BASE}/rate`);
  await page.waitForURL("**/rate/4");
  ok("self-assessor /rate redirects to own assessment (no picking others)");
  await page.screenshot({ path: `${SHOTS}/6-self-assessor.png` });

  // ---- 10b. new self-assessor (created as a new person) onboards on first sign-in ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  await page.goto(`${BASE}/admin/users`);
  await page.fill('input[name="displayName"]', "New KAM");
  await page.fill('input[name="username"]', "newkam");
  await page.fill('input[name="password"]', "secret123");
  await page.selectOption('select[name="lens"]', "self"); // "new person" is the default mode
  await page.locator('button:has-text("Create user")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  ok("new-person self account created");

  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "newkam");
  await page.fill("#password", "secret123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/onboarding");
  ok("new self-assessor lands on onboarding");
  await page.fill('input[name="account"]', "Account 99");
  await page.selectOption('select[name="zone"]', "India");
  await page.selectOption('select[name="track"]', "Saturation");
  await page.selectOption('select[name="segment"]', "Power & Grid");
  await page.locator('button:has-text("Save and start")').click();
  await page.waitForURL(/\/rate\/\d+/);
  await page.waitForSelector(".wizard-top");
  ok("onboarding completes and opens their own assessment");

  // ---- 11. one-click test sandbox: 3 lenses on one AM, blank drafts ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  await page.goto(`${BASE}/admin/users`);
  await page.locator('button:has-text("Create test sandbox")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  const sandboxMsg = await page.locator(".form-ok").textContent();
  sandboxMsg?.includes("self.demo")
    ? ok("test sandbox provisions demo assessors")
    : fail("sandbox banner", sandboxMsg ?? "");

  // self.demo (linked to AM01) logs in → blank self-assessment, straight away
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "self.demo");
  await page.fill("#password", "demo1234");
  await page.click("button[type=submit]");
  await page.waitForURL("**/rate/1");
  ok("sandbox self.demo lands on their own assessment");
  const sandboxAnswered = await page.locator(".dot.answered").count();
  sandboxAnswered === 0 ? ok("sandbox self-assessment starts blank") : fail("sandbox not blank", `${sandboxAnswered}`);

  // ---- 12. superadmin can permanently delete a user account ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  await page.goto(`${BASE}/admin/users`);
  const beforeRows = await page.locator("table.table tbody tr").count();
  await page.locator('tr:has-text("selfkam") details:has(summary:has-text("Delete")) summary').click();
  await page.locator('tr:has-text("selfkam") button:has-text("Confirm delete")').click();
  await page.waitForURL(/\/admin\/users\?ok=/);
  const afterRows = await page.locator("table.table tbody tr").count();
  const gone = await page.locator('tr:has-text("selfkam")').count();
  afterRows === beforeRows - 1 && gone === 0
    ? ok("superadmin deletes a user account")
    : fail("delete user", `${beforeRows}->${afterRows}, gone=${gone}`);
} catch (e) {
  fail("UNEXPECTED", e.message?.slice(0, 300));
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failures = results.filter((r) => r.startsWith("✗"));
console.log(`\n${results.length - failures.length}/${results.length} passed`);
process.exit(failures.length ? 1 : 0);

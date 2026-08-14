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

  // ---- 4b. lens colours: the APEX Panel web must not be a second green ----
  // The client could not tell the APEX Panel web from the Final score web: both were
  // Schneider green, a shade apart, at a 1.4px stroke. These read the RENDERED colours,
  // because recolouring only the legend swatch (or only the polygon) would leave the chart
  // exactly as unreadable while looking fixed in a diff.
  const webs = await page.locator(".radar-legend > span").evaluateAll((els) =>
    els
      .map((el) => {
        const sw = el.querySelector(".sw:not(.sw-dashed)");
        return sw ? { label: el.innerText.trim(), colour: getComputedStyle(sw).backgroundColor } : null;
      })
      .filter(Boolean)
  );
  {
    const panel = webs.find((w) => w.label === "APEX Panel");
    const final = webs.find((w) => w.label === "Final score");
    panel && final && panel.colour !== final.colour
      ? ok(`APEX Panel and Final score are different colours (${panel?.colour} vs ${final?.colour})`)
      : fail("panel/final web colour", `${panel?.colour ?? "?"} vs ${final?.colour ?? "?"}`);
    // separating Panel from Final by colliding it with Manager's blue would not be a fix
    const colours = webs.map((w) => w.colour);
    new Set(colours).size === colours.length && colours.length === 4
      ? ok(`radar gives each of the ${colours.length} webs its own colour`)
      : fail("radar web colours", colours.join(" | "));
    // the legend agrees with itself; this is the check that it agrees with the CHART
    const strokes = await page.locator(".radar-svg polygon[stroke]").evaluateAll((els) =>
      els.map((e) => getComputedStyle(e).stroke)
    );
    strokes.includes(panel?.colour) && strokes.includes(final?.colour)
      ? ok("the drawn webs match the legend swatches")
      : fail("radar strokes", `legend ${panel?.colour}/${final?.colour} not among ${strokes.join(" ")}`);
    // the recolour must not be smuggled in by re-emphasising a different web instead
    const finalWeb = await page
      .locator(".radar-svg polygon[fill-opacity]")
      .evaluateAll((els) => els.map((e) => `${e.getAttribute("stroke-width")}@${e.getAttribute("fill-opacity")}`));
    finalWeb.some((s) => s.startsWith("3@") && !s.endsWith("@0"))
      ? ok("the final score is still the emphasised web")
      : fail("final score emphasis", finalWeb.join(" "));
  }

  // ---- 4c. the lens legend is not printed twice ----
  // Client feedback (3 Aug): "no need to show self manager apex required at the top, it's
  // already over each column". The strip above the capability table is gone — but the
  // column headers have to keep carrying the dots, or removing the duplicate would have
  // cost the legend entirely.
  (await page.locator(".legend:has(.lens-dot)").count()) === 0
    ? ok("no duplicated lens legend above the capability table")
    : fail("lens legend", "the duplicate strip is back");
  {
    const heads = (
      await page.locator('.card:has(.card-title:has-text("Capability detail")) thead th').allTextContents()
    ).map((t) => t.trim());
    heads.join("|") === "Capability|Required|Self|Manager|Panel|Weighted|Gap vs req"
      ? ok("capability table headers name every lens")
      : fail("capability headers", heads.join("|"));
    // count-only would still pass if a future edit stripped the ld-* classes and left four
    // invisible spans behind, so this asserts each dot is painted and distinct
    const dots = await page
      .locator('.card:has(.card-title:has-text("Capability detail")) thead .lens-dot')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    dots.length === 4 && new Set(dots).size === 4 && !dots.includes("rgba(0, 0, 0, 0)")
      ? ok("each lens header dot is painted and distinct")
      : fail("header lens dots", dots.join(" | "));
    // the radar's docstring promises the dots match the webs; after the Panel recolour that
    // is exactly the promise most likely to be broken silently
    const panelDot = await page
      .locator('.card:has(.card-title:has-text("Capability detail")) thead th:has-text("Panel") .lens-dot')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    panelDot === webs.find((w) => w.label === "APEX Panel")?.colour
      ? ok("the Panel header dot matches the Panel web")
      : fail("panel dot vs web", `${panelDot} vs ${webs.find((w) => w.label === "APEX Panel")?.colour}`);
  }
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
  // arranging is a superadmin act, and the wrench is the only way in
  (await page.locator(".wrench").count()) === 0
    ? ok("no wrench on an assessor's dashboard")
    : fail("assessor wrench", "the arrange button is shown to an assessor");
  // an assessor still gets the dashboard, on the shipped arrangement — they have no stored
  // layout and no way to acquire one
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const sizes = await page.locator(".dash-block").evaluateAll((els) => els.map((e) => e.dataset.size));
    const rendered =
      (await page.locator(".kpi-value").count()) > 0 &&
      (await page.locator('.card-title:has-text("People you assess")').count()) === 1;
    rendered && sizes.length > 0 && sizes.every((z) => z === "full")
      ? ok("an assessor gets the dashboard on the shipped arrangement")
      : fail("assessor dashboard", `${sizes.join(",")} rendered=${rendered}`);
  }

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

  // ---- 13. arranging the dashboard in place ----
  // One small square wrench, top left of the DASHBOARD, turns this page editable and back.
  // There is no separate editor and no Settings page: the thing being arranged is the real
  // dashboard, with its real cards in it. Every check asserts the RESULT on the page.
  const order = () =>
    page.locator(".dash-block").evaluateAll((els) => els.map((e) => e.dataset.block));

  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  const baseline = await order();
  {
    const shipped = ["kpis", "report", "filters", "map", "timeline", "priorities", "heatmap", "roster"];
    ["kpis", "report", "filters", "map", "timeline", "heatmap", "roster"].every((id) => baseline.includes(id)) &&
    new Set(baseline).size === baseline.length &&
    baseline.join(",") === shipped.filter((id) => baseline.includes(id)).join(",")
      ? ok(`dashboard renders the shipped card order (${baseline.join(" → ")})`)
      : fail("shipped order", baseline.join(","));
    const filled =
      (await page.locator('.dash-block[data-block="heatmap"] table.hm').count()) === 1 &&
      (await page.locator('.dash-block[data-block="map"] .map-card').count()) === 1 &&
      (await page.locator('.dash-block[data-block="kpis"] .kpi-value').count()) >= 5 &&
      ((await page.locator('.dash-block[data-block="roster"] .card-title').textContent()) ?? "").includes("Roster");
    filled ? ok("every card sits inside its own block wrapper") : fail("block contents", "a wrapper is empty");
  }
  // read mode carries the wrench and nothing else — no toolbar, no handles, no tags
  (await page.locator(".wrench").count()) === 1 &&
  (await page.locator(".dash-bar.editing, .dash-tag, .dash-resize, .dash-off").count()) === 0
    ? ok("read mode shows one wrench and no editing chrome")
    : fail("read mode", `${await page.locator(".dash-tag, .dash-resize").count()} handles visible`);
  // and the cards are live: a link inside one is clickable
  (await page.locator('.dash-block[data-block="roster"] a.row-name-link').first().isEnabled())
    ? ok("cards are interactive when not arranging")
    : fail("read interactivity", "row link not clickable");
  // the Settings page is gone entirely
  {
    const r = await page.context().request.get(`${BASE}/admin/settings`, { maxRedirects: 0 });
    r.status() === 404
      ? ok("the Settings page no longer exists")
      : fail("settings removed", `${r.status()}`);
    (await page.locator('a.nav-link[href="/admin/settings"]').count()) === 0
      ? ok("no Settings item in the sidebar")
      : fail("settings nav", "still there");
  }

  // switch it on
  await page.locator(".wrench").click();
  await page.waitForSelector(".dash-bar.editing");
  {
    const tags = await page.locator(".dash-tag").count();
    const handles = await page.locator(".dash-resize").count();
    const acts = (await page.locator(".dash-act").allTextContents()).map((t) => t.trim());
    tags === baseline.length && handles === baseline.length &&
    ["Colour", "Reset", "Cancel", "Save"].every((a) => acts.includes(a))
      ? ok(`every card becomes editable, with Reset / Cancel / Save at the top`)
      : fail("edit mode", `${tags} tags, ${handles} handles, acts ${acts.join("|")}`);
    // a card being arranged is not a card being used: its contents must be inert, or a drag
    // that starts on a link is a navigation
    const inert = await page
      .locator('.dash-block[data-block="roster"] .dash-body')
      .evaluate((e) => getComputedStyle(e).pointerEvents);
    inert === "none"
      ? ok("card contents go inert while arranging")
      : fail("inert body", inert);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/9-dashboard-arranging.png` });

  // move a card by stepping it past its neighbours
  await page.locator('[aria-label="Move Roster"]').click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  {
    const now = await order();
    const want = baseline.filter((id) => id !== "roster");
    want.splice(baseline.indexOf("roster") - 2, 0, "roster");
    now.join(",") === want.join(",")
      ? ok(`a card can be moved (${now.join(" → ")})`)
      : fail("move", `${now.join(",")} — wanted ${want.join(",")}`);
  }

  // pull a card's right edge in to make it narrower
  {
    // scroll it into view FIRST: the move above focused a tag near the foot of the page, so
    // the KPI card is above the viewport and its box would come back with a negative y
    await page.locator('.dash-block[data-block="kpis"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const handle = await page.locator('.dash-block[data-block="kpis"] .dash-resize').boundingBox();
    const grid = await page.locator(".dash-grid").boundingBox();
    await page.mouse.move(handle.x + 6, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(grid.x + grid.width * 0.5, handle.y + handle.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    const size = await page.locator('.dash-block[data-block="kpis"]').getAttribute("data-size");
    const span = await page
      .locator('.dash-block[data-block="kpis"]')
      .evaluate((e) => getComputedStyle(e).gridColumn);
    // the attribute AND the computed span: a width that is recorded but never applied to the
    // grid has changed nothing a person can see
    size === "half" && span.includes("span 6")
      ? ok(`pulling the edge resizes the card (${span})`)
      : fail("resize by drag", `${size} / ${span}`);
  }

  // Cancel throws the lot away
  await page.locator('.dash-act:has-text("Cancel")').click();
  await page.waitForTimeout(300);
  (await order()).join(",") === baseline.join(",") &&
  (await page.locator('.dash-block[data-block="kpis"]').getAttribute("data-size")) === "full" &&
  (await page.locator(".dash-bar.editing").count()) === 0
    ? ok("Cancel restores the arrangement and leaves edit mode")
    : fail("cancel", (await order()).join(","));

  // do it again and Save this time
  await page.locator(".wrench").click();
  await page.waitForSelector(".dash-bar.editing");
  await page.locator('[aria-label="Move Roster"]').click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.locator('.dash-block[data-block="heatmap"] .dash-resize').focus();
  await page.keyboard.press("ArrowLeft"); // heat map: full -> half
  await page.locator('[aria-label="Take off Zone performance map"]').click();
  await page.locator('.dash-act:has-text("Save")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const after = await order();
    // move first, THEN drop the removed card — doing it the other way round shifts the index
    // the move was measured against
    const moved = baseline.filter((id) => id !== "roster");
    moved.splice(baseline.indexOf("roster") - 2, 0, "roster");
    const want = moved.filter((id) => id !== "map");
    const heat = await page.locator('.dash-block[data-block="heatmap"]').getAttribute("data-size");
    // a card taken off has to LEAVE the page, not merely be dimmed — .is-off only greys the
    // body while arranging, so a hide done with opacity would leave every AM's scores in the
    // read-mode DOM
    after.join(",") === want.join(",") &&
    (await page.locator(".map-card").count()) === 0 &&
    heat === "half"
      ? ok(`Save persists the move, the resize and the removal (${after.join(" → ")})`)
      : fail("save", `${after.join(",")} / heat ${heat} / maps ${await page.locator(".map-card").count()}`);
    // ...and the roster's own content travelled with its wrapper
    const rosterRows = await page.locator('.dash-block[data-block="roster"] table.table tbody tr').count();
    rosterRows > 1 ? ok(`the card's content moved with it (${rosterRows} rows)`) : fail("moved content", `${rosterRows}`);
  }
  // a card that was taken off comes back from edit mode, where it is still shown, greyed
  await page.locator(".wrench").click();
  await page.waitForSelector(".dash-bar.editing");
  (await page.locator('.dash-block[data-block="map"].is-off').count()) === 1
    ? ok("a card that was taken off is still there while arranging, switched off")
    : fail("off card", "not shown in edit mode");
  await page.locator('[aria-label="Put back Zone performance map"]').click();
  await page.locator('.dash-act:has-text("Save")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  (await page.locator(".map-card").count()) === 1
    ? ok("putting it back restores the card")
    : fail("restore", "map still missing");

  // ---- 13b. colour, per part, from the same toolbar ----
  await page.locator(".wrench").click();
  await page.waitForSelector(".dash-bar.editing");
  await page.locator('.dash-act:has-text("Colour")').click();
  await page.waitForSelector(".cp-parts");
  (await page.locator(".cp-part").count()) === 4
    ? ok("colour offers the accent and the three surfaces separately")
    : fail("colour parts", `${await page.locator(".cp-part").count()}`);
  await page.locator('.cp-swatch[aria-label="Violet"]').click();
  await page.locator('button:has-text("Save colours")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const declared = await page.evaluate(() => document.documentElement.dataset.accent);
    const resolved = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()
    );
    declared === "#7c5cff" && resolved === "#7c5cff"
      ? ok("the saved accent reaches every page")
      : fail("accent injection", `${declared} / ${resolved}`);
    // a check on the variable alone passes even if every rule still hardcodes green, so this
    // reads a PAINTED node — and on the HUE, since the nav pill is a gradient of two derived
    // shades rather than of the accent itself
    const painted = await page.locator(".nav-link.active").evaluate((e) => {
      const cs = getComputedStyle(e);
      return `${cs.backgroundImage} ${cs.backgroundColor}`;
    });
    const triples = [...painted.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map((m) => m.slice(1).map(Number));
    triples.some(([r, g, b]) => b > r && b > g) && !triples.some(([r, g, b]) => g > r && g > b)
      ? ok("the accent is actually painted, not just declared")
      : fail("accent paint", painted.slice(0, 160));
    const empties = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ["--accent", "--accent-rgb", "--accent-bright", "--accent-deep", "--accent-soft", "--accent-ink", "--se-green"]
        .filter((k) => !cs.getPropertyValue(k).trim());
    });
    empties.length === 0
      ? ok("every accent variable resolves to a value")
      : fail("unresolved accent vars", empties.join(" "));
    // THE rule for this feature: repainting the brand must not repaint the results
    const heatGood = await page.locator("td.cell.hm-good").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    const okRgb = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--ok-rgb").trim()
    );
    heatGood.includes("61, 205, 88") && okRgb.replace(/\s+/g, "") === "61,205,88"
      ? ok("the heat legend keeps its own colours under a repainted brand")
      : fail("heat vs accent", `${heatGood} / --ok-rgb ${okRgb}`);
    await page.goto(`${BASE}/analysis/am/1`);
    await page.waitForSelector(".lens-dot.ld-expert");
    const panelDot = await page.locator(".lens-dot.ld-expert").first().evaluate((e) => getComputedStyle(e).backgroundColor);
    panelDot === "rgb(225, 72, 184)"
      ? ok("the APEX Panel lens keeps its colour under a repainted brand")
      : fail("lens vs accent", panelDot);
  }
  // a surface is a separate choice from the brand — the whole point of the parts
  await page.goto(`${BASE}/analysis`);
  await page.locator(".wrench").click();
  await page.locator('.dash-act:has-text("Colour")').click();
  await page.locator('.cp-part:has-text("Menu bar")').click();
  await page.locator('.cp-swatch[aria-label="Aubergine"]').click();
  await page.locator('button:has-text("Save colours")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const sidebar = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--sidebar").trim()
    );
    const accent = await page.evaluate(() => document.documentElement.dataset.accent);
    sidebar === "#120e1a" && accent === "#7c5cff"
      ? ok("a surface can be recoloured without touching the accent")
      : fail("per-part colour", `sidebar ${sidebar}, accent ${accent}`);
  }
  // The background is painted by body::before, which covers body entirely. Setting --bg
  // alone changed nothing anybody could see except the scrollbar gutter, so this asserts the
  // layer that actually paints, not the variable.
  await page.goto(`${BASE}/analysis`);
  await page.locator(".wrench").click();
  await page.locator('.dash-act:has-text("Colour")').click();
  await page.locator('.cp-part:has(.cp-part-name:text-is("Background"))').click();
  await page.fill(".cp-hex", "#3b0764");
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Save colours")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const painted = await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage);
    const stops = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return ["--bg", "--bg-hi", "--bg-lo"].map((k) => cs.getPropertyValue(k).trim());
    });
    painted.includes("59, 7, 100") && stops.every(Boolean) && new Set(stops).size === 3
      ? ok("the background colour reaches the layer that actually paints the page")
      : fail("background", `${stops.join("/")} — ${painted.slice(0, 90)}`);
  }

  // Cards used to tint only the handful of surfaces that happened to read --card, leaving
  // the map, the popovers and the toolbars navy — which is what read as random rectangles.
  await page.locator(".wrench").click();
  await page.locator('.dash-act:has-text("Colour")').click();
  await page.locator('.cp-part:has(.cp-part-name:text-is("Cards"))').click();
  await page.fill(".cp-hex", "#1e3a5f");
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Save colours")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const surfaces = await page.evaluate(() =>
      [".card", ".map-card", ".nav-toggle"].map((s) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).backgroundColor + getComputedStyle(el).backgroundImage : "";
      })
    );
    // every one of them must have moved onto the chosen hue, not just the first
    const tinted = surfaces.filter((v) => v.includes("30, 58, 95")).length;
    tinted === surfaces.length
      ? ok(`the card colour reaches every panel (${tinted} of ${surfaces.length})`)
      : fail("card surfaces", surfaces.map((v) => v.slice(0, 40)).join(" | "));
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/10-recoloured.png` });

  // ---- 13c. it all belongs to ONE account ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "tmanager");
  await page.fill("#password", "secret123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/rate");
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const theirs = await order();
    const shipped = ["kpis", "report", "filters", "map", "timeline", "priorities", "heatmap", "roster"]
      .filter((id) => theirs.includes(id));
    const sizes = await page.locator(".dash-block").evaluateAll((els) => els.map((e) => e.dataset.size));
    const accent = await page.evaluate(() => document.documentElement.dataset.accent);
    const wrench = await page.locator(".wrench").count();
    theirs.join(",") === shipped.join(",") && sizes.every((z) => z === "full") && accent === "#3dcd58" && wrench === 0
      ? ok("another account is untouched, and has no wrench")
      : fail("per-user isolation", `${theirs.join(",")} / ${accent} / wrench ${wrench}`);
  }
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  await page.waitForSelector(".dash-block");
  {
    const mine = await order();
    const accent = await page.evaluate(() => document.documentElement.dataset.accent);
    const heat = await page.locator('.dash-block[data-block="heatmap"]').getAttribute("data-size");
    mine.indexOf("roster") === baseline.indexOf("roster") - 2 && accent === "#7c5cff" && heat === "half"
      ? ok("the superadmin's own arrangement and colours survived the other sign-in")
      : fail("own settings after switch", `${mine.join(",")} / ${accent} / heat ${heat}`);
  }

  // ---- 13d. back to the shipped state ----
  await page.locator(".wrench").click();
  await page.waitForSelector(".dash-bar.editing");
  await page.locator('.dash-act:has-text("Reset")').click();
  await page.locator('.dash-act:has-text("Save")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.locator(".wrench").click();
  await page.locator('.dash-act:has-text("Colour")').click();
  await page.locator('button:has-text("Back to the shipped palette")').click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const back = await order();
    const sizes = await page.locator(".dash-block").evaluateAll((els) => els.map((e) => e.dataset.size));
    const accent = await page.evaluate(() => document.documentElement.dataset.accent);
    const repainted = await page.locator(".nav-link.active").evaluate((e) => {
      const cs = getComputedStyle(e);
      return `${cs.backgroundImage} ${cs.backgroundColor}`;
    });
    const greenBack = [...repainted.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)]
      .map((m) => m.slice(1).map(Number))
      .some(([r, g, b]) => g > r && g > b);
    back.join(",") === baseline.join(",") && sizes.every((z) => z === "full") && accent === "#3dcd58" && greenBack
      ? ok("Reset restores the shipped layout and the shipped colours")
      : fail("reset", `${back.join(",")} / ${[...new Set(sizes)].join("+")} / ${accent} / green=${greenBack}`);
    // with nothing customised, --accent must be UNDEFINED rather than set to the shipped
    // green: the stylesheet's own fallbacks are what keep a default install rendering exactly
    // as it always did, and an injected value would quietly bypass every one of them
    const injected = await page.evaluate(() => document.documentElement.getAttribute("style") ?? "");
    !injected.includes("--accent")
      ? ok("a default install injects no colour overrides at all")
      : fail("clean default", injected.slice(0, 120));
  }

  // ---- 13e. folding the menu away ----
  await page.locator(".nav-toggle").click();
  await page.waitForTimeout(600);
  {
    const shellClass = (await page.locator(".shell").getAttribute("class")) ?? "";
    const sidebarRight = await page.locator(".sidebar").evaluate((e) => e.getBoundingClientRect().right);
    shellClass.includes("nav-collapsed") && sidebarRight <= 1
      ? ok("the menu bar folds away")
      : fail("collapse", `${shellClass} / right edge ${Math.round(sidebarRight)}`);
  }
  // the choice is a cookie read by the SERVER, so it survives a navigation without flashing
  await page.goto(`${BASE}/analysis/individuals`);
  await page.waitForSelector("table.table");
  {
    ((await page.locator(".shell").getAttribute("class")) ?? "").includes("nav-collapsed")
      ? ok("the folded menu stays folded across a navigation")
      : fail("collapse persistence", (await page.locator(".shell").getAttribute("class")) ?? "");
    const gap = await page.evaluate(() => {
      const m = document.querySelector(".main");
      return m ? Math.round(window.innerWidth - m.getBoundingClientRect().right) : -1;
    });
    gap >= 0 && gap < 40
      ? ok(`Individual Results uses the full window (${gap}px to spare)`)
      : fail("wide page", `${gap}px of empty space on the right`);
    // The name column has to stay put while the rest scrolls, or once the names are gone
    // there is nothing to say whose row you are reading.
    {
      await page.evaluate(() => { document.querySelector(".hm-scroll").scrollLeft = 700; });
      await page.waitForTimeout(300);
      const first = await page.locator(".table tbody td:first-child").first().boundingBox();
      const scroller = await page.locator(".hm-scroll").boundingBox();
      first && scroller && Math.abs(first.x - scroller.x) < 3
        ? ok("the name column stays pinned while the table scrolls")
        : fail("sticky name column", `${Math.round(first?.x ?? -1)} vs ${Math.round(scroller?.x ?? -1)}`);
      // and the right-edge fade must stay ON the right edge. Placed on the scroller itself
      // it was laid out against the scrollable CONTENT, so it slid inwards as you scrolled
      // and drew a grey seam down the middle of the columns.
      const seam = await page.evaluate(() => {
        const w = document.querySelector(".scroll-fade");
        if (!w) return -1;
        const cs = getComputedStyle(w, "::after");
        const r = w.getBoundingClientRect();
        return Math.round(r.right - (parseFloat(cs.right) || 0) - r.right);
      });
      seam === 0
        ? ok("the scroll fade stays on the right edge")
        : fail("scroll fade", `offset ${seam}px from the edge`);
    }
  }
  await page.locator(".nav-toggle").click();
  await page.waitForTimeout(600);
  !((await page.locator(".shell").getAttribute("class")) ?? "").includes("nav-collapsed")
    ? ok("the menu bar comes back")
    : fail("expand", "still collapsed");

  // ---- 14. help: the guided tour and question mode ----
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  await page.locator(".help-btn").click();
  {
    const items = (await page.locator(".help-item-name").allTextContents()).map((t) => t.trim());
    items.length === 2 && items[0].startsWith("Tutorial") && items[1].startsWith("Question")
      ? ok("the question mark offers Tutorial mode and Question mode")
      : fail("help menu", items.join("|"));
  }

  // the tour opens on a welcome card and steps forward on confirmation
  await page.locator('.help-item:has-text("Tutorial mode")').click();
  await page.waitForSelector(".tour-card.centred");
  ((await page.locator(".tour-title").textContent()) ?? "").includes("Welcome") &&
  ((await page.locator(".tour-count").textContent()) ?? "").includes("Step 1 of")
    ? ok("the tour opens with a welcome card")
    : fail("tour welcome", (await page.locator(".tour-title").textContent()) ?? "");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/11-tour-welcome.png` });

  await page.locator(".tour-actions .btn-primary").click();
  await page.waitForTimeout(700);
  {
    // the spotlight must sit ON the thing being described, not merely exist — an overlay
    // whose hole is somewhere else is worse than no overlay
    const spot = await page.locator(".tour-spot").boundingBox();
    const nav = await page.locator(".sidebar .nav").boundingBox();
    const close = spot && nav && Math.abs(spot.x + spot.width / 2 - (nav.x + nav.width / 2)) < 24 &&
      Math.abs(spot.y + spot.height / 2 - (nav.y + nav.height / 2)) < 24;
    close ? ok("the spotlight lands on the part being explained") : fail("spotlight", JSON.stringify({ spot, nav }));
  }

  // it walks the whole app, crossing pages on the way, and finishes cleanly
  {
    const visited = new Set([new URL(page.url()).pathname]);
    let steps = 1;
    for (let i = 0; i < 30; i++) {
      const btn = page.locator(".tour-actions .btn-primary");
      if (!(await btn.count())) break;
      await btn.click();
      await page.waitForTimeout(750);
      if (!(await page.locator(".tour-card").count())) break;
      visited.add(new URL(page.url()).pathname);
      steps++;
    }
    const gone = (await page.locator(".tour-card").count()) === 0;
    gone && steps >= 10 && visited.size >= 3
      ? ok(`the tour walks ${steps} steps across ${visited.size} pages and ends`)
      : fail("tour walk", `${steps} steps, ${visited.size} pages, card gone=${gone}`);
  }
  // and it does not come back on the next page load
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  (await page.locator(".tour-card").count()) === 0
    ? ok("a finished tour stays finished")
    : fail("tour restart", "the tour reopened");

  // ---- 14b. question mode ----
  await page.locator(".help-btn").click();
  await page.locator('.help-item:has-text("Question mode")').click();
  await page.waitForSelector(".qm-bar");
  // Hover something and read what question mode says about it.
  //
  // The card is one element that is rewritten in place, so a hover that lands on nothing
  // leaves the PREVIOUS answer on screen. Reading it blind meant a check could pass on a
  // stale card — a missing selector once came back as the answer to the question before it.
  // So: refuse to hover a selector that is not there, and wait for the card to actually
  // change before reading it.
  const answer = async (sel, nth = 0, position) => {
    const count = await page.locator(sel).count();
    if (count <= nth) return { title: `«no ${sel}[${nth}] on this page»`, body: "" };
    const before = await page.evaluate(() => document.querySelector(".qm-tip-title")?.textContent ?? "");
    const l = page.locator(sel).nth(nth);
    await l.scrollIntoViewIfNeeded().catch(() => {});
    await l.hover({ force: true, ...(position ? { position } : {}) }).catch(() => {});
    await page
      .waitForFunction(
        (prev) => {
          const e = document.querySelector(".qm-tip-title");
          return e !== null && e.textContent !== prev;
        },
        before,
        { timeout: 1500 }
      )
      .catch(() => {}); // an answer identical to the last one is legitimate; read it below
    return await page.evaluate(() => ({
      title: (document.querySelector(".qm-tip-title")?.textContent ?? "").trim(),
      body: (document.querySelector(".qm-tip-body")?.textContent ?? "").trim(),
    }));
  };
  {
    // three different kinds of thing, three different answers
    const seen = [];
    for (const sel of [".kpi-value", "td.cell", ".badge-zone"]) seen.push((await answer(sel)).title);
    new Set(seen).size === 3 && seen.every(Boolean)
      ? ok(`question mode explains each kind of thing on its own terms (${seen.join(" · ")})`)
      : fail("question answers", seen.join("|"));

    // THE point of this feature: two cells of the same TYPE must give different answers.
    // A registry that only names the category — "this is a heat map cell" — passes every
    // check above and is worth nothing to somebody pointing at one particular number.
    const a = await answer(".hm tbody tr:not(.cluster-row):not(.cluster-avg-row) td.cell", 2);
    const b = await answer(".hm tbody tr:not(.cluster-row):not(.cluster-avg-row) td.cell", 30);
    a.title !== b.title && a.body !== b.body && /\bin\b/.test(a.title)
      ? ok(`two heat cells answer differently ("${a.title}" vs "${b.title}")`)
      : fail("cell specificity", `${a.title} / ${b.title}`);
    // and it quotes the figure it is describing, not just the category
    /\d/.test(a.body) && /required|req |short|above/i.test(a.body)
      ? ok("a cell's answer carries its own figure and what the colour means")
      : fail("cell body", a.body.slice(0, 120));

    // The five KPI tiles count five different things. Hovered near the left edge on purpose:
    // the "/ 25" and "/ 3" hanging off the figure are a deeper match and answer for
    // themselves, so a centre hover would test those instead of the tiles.
    const k0 = await answer(".kpi-value", 0, { x: 4, y: 8 });
    const k4 = await answer(".kpi-value", 4, { x: 4, y: 8 });
    k0.title !== k4.title && k0.body !== k4.body && /completion/i.test(k0.title) && /maturity/i.test(k4.title)
      ? ok(`KPI tiles answer per tile ("${k0.title}" vs "${k4.title}")`)
      : fail("kpi specificity", `${k0.title} / ${k4.title}`);
    // and the little "/ n" is not one answer either: a headcount on the count tiles, the top
    // of the level scale on the last
    // (four spans, not five: Campaign completion is a percentage and has none)
    const s0 = await answer(".kpi-value span", 0);
    const s3 = await answer(".kpi-value span", 3);
    s0.title !== s3.title && /out of/i.test(s0.title) && /scale/i.test(s3.title)
      ? ok(`the "/ n" answers per tile too ("${s0.title}" vs "${s3.title}")`)
      : fail("kpi denominator", `${s0.title} / ${s3.title}`);
    // asserted while the pointer is still resting on something
    (await page.locator(".qm-ring").count()) === 1
      ? ok("the thing being explained is ringed where it sits")
      : fail("ring", `${await page.locator(".qm-ring").count()}`);

    // A plain figure in a table is explained by its COLUMN. It has to be a cell with nothing
    // deeper inside it — every roster cell holds a badge or a link, and those are more
    // specific answers that rightly win.
    await page.goto(`${BASE}/analysis/individuals`);
    await page.waitForSelector("table.table");
    const cell = await answer('.table tbody td', 9);
    cell.title.toLowerCase() === "weighted" && /20%|35%|45%/.test(cell.body)
      ? ok("a figure in a table is explained by the column it sits in")
      : fail("column answer", `${cell.title}: ${cell.body.slice(0, 80)}`);

    // Filters, Assessment schedule and Account details are ONE styled control reused three
    // times. Keyed on the class, all three answered "Filters", which is the same failure as
    // answering "a table cell" — right about the markup, useless to the reader.
    await page.goto(`${BASE}/analysis`);
    await page.waitForSelector(".dash-block");
    const filt = await answer(".filter-toggle");
    await page.goto(`${BASE}/analysis/am/1`);
    await page.waitForSelector(".sched .filter-toggle");
    const sched = await answer(".sched .filter-toggle", 0);
    const acct = await answer(".sched .filter-toggle", 1);
    new Set([filt.title, sched.title, acct.title]).size === 3 &&
    /schedule/i.test(sched.title) && /account/i.test(acct.title)
      ? ok(`one control, three answers (${filt.title} · ${sched.title} · ${acct.title})`)
      : fail("disclosure answers", [filt.title, sched.title, acct.title].join(" | "));

    await page.goto(`${BASE}/analysis`);
    await page.waitForSelector(".dash-block");

  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/12-question-mode.png` });

  // it stays on across a navigation, because it is a mode rather than a tooltip
  await page.goto(`${BASE}/analysis/individuals`);
  await page.waitForSelector("table.table");
  (await page.locator(".qm-bar").count()) === 1
    ? ok("question mode survives moving to another page")
    : fail("question persistence", "turned itself off");
  await page.locator(".qm-off").click();
  await page.waitForTimeout(250);
  (await page.locator(".qm-bar").count()) === 0 && (await page.locator(".qm-tip").count()) === 0
    ? ok("question mode turns off")
    : fail("question off", "still on");

  // The guide is keyed to CSS selectors, which a rename can silently orphan. This is the
  // check that tells you: every selector below must still match something on a page that
  // definitely contains it.
  await page.goto(`${BASE}/analysis`);
  await page.waitForSelector(".dash-block");
  {
    const must = [".kpi-value", ".kpi-bench", "td.cell", ".lvl-chip", ".badge-zone", ".badge-track",
                  ".filter-toggle", ".nav-link", ".wrench", ".nav-toggle", ".tl", ".sidebar"];
    const missing = [];
    for (const sel of must) if ((await page.locator(sel).count()) === 0) missing.push(sel);
    missing.length === 0
      ? ok(`every guide selector still matches (${must.length} checked)`)
      : fail("orphaned guide selectors", missing.join(" "));
  }

  // ---- 14c. the client's word is "cluster", never "theme" ----
  // The code still says theme on purpose — theme_notes, themeJustificationText, the
  // .theme-note-block class — so a grep of the source cannot guard this. Read the RENDERED
  // text of the pages that carry the word instead, and check what question mode says about
  // the elements most likely to regress.
  {
    const pages = ["/analysis", "/analysis/individuals", "/analysis/am/1", "/analysis/zone/MEA"];
    const offenders = [];
    for (const path of pages) {
      await page.goto(`${BASE}${path}`);
      await page.waitForSelector(".page-title");
      const text = await page.evaluate(() => document.body.innerText);
      const hit = text.match(/.{0,40}\bthemes?\b.{0,40}/i);
      if (hit) offenders.push(`${path}: …${hit[0].replace(/\s+/g, " ")}…`);
    }
    offenders.length === 0
      ? ok(`no page says "theme" out loud (${pages.length} pages read)`)
      : fail("theme leaked into visible copy", offenders.join(" | "));
  }
} catch (e) {
  fail("UNEXPECTED", e.message?.slice(0, 300));
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failures = results.filter((r) => r.startsWith("✗"));
console.log(`\n${results.length - failures.length}/${results.length} passed`);
process.exit(failures.length ? 1 : 0);

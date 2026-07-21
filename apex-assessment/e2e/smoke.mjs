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
  const completion = await page.locator(".kpi-value").first().textContent();
  completion?.trim() === "100%" ? ok("completion KPI = 100% after demo load") : fail("completion KPI", completion ?? "");
  await page.screenshot({ path: `${SHOTS}/2-dashboard.png`, fullPage: false });

  // ---- 4. individual analysis ----
  await page.locator("text=Analysis →").first().click();
  await page.waitForSelector("text=Capability detail");
  ok("individual analysis renders");
  await page.waitForTimeout(700); // let entrance animation settle
  await page.screenshot({ path: `${SHOTS}/3-individual.png` });

  // ---- 5. PDF export ----
  const pdfResp = await page.context().request.get(`${BASE}/analysis/am/1/pdf`);
  const pdfBuf = await pdfResp.body();
  const pdfOk =
    pdfResp.status() === 200 &&
    pdfResp.headers()["content-type"] === "application/pdf" &&
    pdfBuf.subarray(0, 5).toString() === "%PDF-" &&
    pdfBuf.length > 5000;
  pdfOk ? ok(`PDF export downloads (${pdfBuf.length} bytes)`) : fail("PDF export", `status ${pdfResp.status()}`);
  (await page.locator('button:has-text("Export PDF")').count()) > 0
    ? ok("Export PDF button on profile page")
    : fail("Export PDF button", "not found");

  // ---- 6. zone view ----
  await page.goto(`${BASE}/analysis/zone/MEA`);
  await page.waitForSelector("text=Zone benchmark");
  ok("zone MEA heat map renders");

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

  await page.goto(`${BASE}/analysis/individuals`);
  await page.waitForURL("**/rate");
  ok("assessor blocked from individual results (redirected)");

  await page.goto(`${BASE}/rate`);
  const cards = await page.locator(".am-card").count();
  cards === 1 ? ok("assessor sees exactly 1 assigned AM") : fail("assignment scoping", `${cards} cards`);

  // self-service: add anyone to your list by typing their name
  await page.fill(".assign-input", "Basim");
  await page.locator(".assign-opt").first().click();
  await page.waitForFunction(() => document.querySelectorAll(".am-card").length === 2);
  ok("self-assigned an AM by typing a name");

  // ---- 8. rating wizard (AM02 reopened above; all 22 pre-rated by demo → review; edit one) ----
  await page.locator('.am-card:has-text("Mohamed Marzouk") a.btn').click();
  await page.waitForSelector(".review-list");
  ok("wizard opens on review screen for fully-rated draft");
  await page.locator('.review-row button:has-text("Edit")').first().click();
  await page.waitForSelector(".level-cards");
  const reqVisible = await page.locator("text=/required level|Req \\//i").count();
  reqVisible === 0 ? ok("required level hidden during assessment") : fail("required level leak", `${reqVisible}`);
  await page.locator(".level-card").nth(0).click(); // change to L1
  await page.waitForSelector("text=Saved ✓");
  ok("rating change autosaves");

  // manager/panel capture ONE note per theme (self-assessors get none — checked in step 10)
  const noteFields = await page.locator(".theme-note-field textarea").count();
  noteFields === 1 ? ok("manager sees a per-theme note field") : fail("manager theme note field", `${noteFields}`);
  await page.fill(".theme-note-field textarea", THEME_NOTE);
  await page.waitForTimeout(1100); // debounce (700ms) + save
  await page.screenshot({ path: `${SHOTS}/5-wizard.png` });

  // reload → draft persisted with all 22 still answered + our edit + the theme note
  await page.reload();
  await page.waitForSelector(".level-cards, .review-list");
  const answered = await page.locator(".dot.answered").count();
  answered === 22 ? ok("draft persists across reload (22 answered)") : fail("draft persistence", `${answered}`);
  const firstChip = (await page.locator(".review-row .lvl-chip").first().textContent())?.trim();
  firstChip === "L1" ? ok("edited level persisted (L1)") : fail("edited level", firstChip ?? "");
  const savedNote = await page.locator(".theme-notes-review textarea").first().inputValue();
  savedNote === THEME_NOTE ? ok("theme note persists across reload") : fail("theme note persistence", savedNote);

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
  ownName?.includes("Biju Mathew") ? ok("self-assessor sees their own profile") : fail("self profile", ownName ?? "");
  // the assessment page carries a how-to help block
  const helpShown = await page.locator(".wizard-help").count();
  helpShown > 0 ? ok("assessment how-to help shown") : fail("how-to help block", `${helpShown}`);
  // self-assessors CAN now add notes to justify their own ratings, and they persist
  const selfNoteFields = await page.locator(".theme-note-field textarea").count();
  selfNoteFields > 0 ? ok("self-assessor has note fields to justify themselves") : fail("self note fields", `${selfNoteFields}`);
  const SELF_NOTE = "Self-justification: recent stretch assignments back this rating.";
  await page.locator(".theme-note-field textarea").first().fill(SELF_NOTE);
  await page.waitForTimeout(1100); // debounced autosave (700ms) + server round-trip
  await page.reload();
  await page.waitForTimeout(400);
  const selfSaved = await page.locator(".theme-note-field textarea").first().inputValue();
  selfSaved === SELF_NOTE ? ok("self note saved (server accepts self notes)") : fail("self note persistence", selfSaved);

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

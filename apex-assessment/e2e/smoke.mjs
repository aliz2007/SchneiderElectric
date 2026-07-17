// End-to-end smoke test — drives the real UI with Playwright.
// Prereqs: app running (`npm run build && npx next start -p 3111`), fresh DB recommended
//   (delete the data/ folder before starting the server).
// Run from the apex-assessment directory:  node e2e/smoke.mjs
// Env: BASE (default http://localhost:3111) · SHOTS (screenshot dir, default ./e2e-shots)
//      CHROMIUM (executable path, default /opt/pw-browsers/chromium; omit-able if
//      playwright's own browser install is available)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3111";
const SHOTS = process.env.SHOTS ?? "./e2e-shots";
mkdirSync(SHOTS, { recursive: true });

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

  // ---- 5. zone view ----
  await page.goto(`${BASE}/analysis/zone/MEA`);
  await page.waitForSelector("text=Zone benchmark");
  ok("zone MEA heat map renders");

  // ---- 6. create an assessor (manager lens, assigned AM02) ----
  await page.goto(`${BASE}/admin/users`);
  await page.fill('input[name="displayName"]', "Test Manager");
  await page.fill('input[name="username"]', "tmanager");
  await page.fill('input[name="password"]', "secret123");
  await page.selectOption('select[name="lens"]', "manager");
  await page.locator(".card form details summary").first().click();
  await page.locator('form input[name="am"][value="2"]').first().check();
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
  await page.waitForURL("**/rate");
  ok("assessor blocked from /analysis (redirected)");

  await page.goto(`${BASE}/rate`);
  const cards = await page.locator(".am-card").count();
  cards === 1 ? ok("assessor sees exactly 1 assigned AM") : fail("assignment scoping", `${cards} cards`);

  // ---- 8. rating wizard (all 22 pre-rated by demo → opens on review; edit one) ----
  await page.locator(".am-card a.btn").click();
  await page.waitForSelector(".review-list");
  ok("wizard opens on review screen for fully-rated draft");
  await page.locator('.review-row button:has-text("Edit")').first().click();
  await page.waitForSelector(".level-cards");
  const reqVisible = await page.locator("text=/required level|Req \\//i").count();
  reqVisible === 0 ? ok("required level hidden during assessment") : fail("required level leak", `${reqVisible}`);
  await page.locator(".level-card").nth(0).click(); // change to L1
  await page.waitForSelector("text=Saved ✓");
  ok("rating change autosaves");
  await page.fill("textarea", "Relies on the account team for plan direction this cycle.");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SHOTS}/5-wizard.png` });

  // reload → draft persisted with all 22 still answered + our edit
  await page.reload();
  await page.waitForSelector(".level-cards, .review-list");
  const answered = await page.locator(".dot.answered").count();
  answered === 22 ? ok("draft persists across reload (22 answered)") : fail("draft persistence", `${answered}`);
  const firstChip = (await page.locator(".review-row .lvl-chip").first().textContent())?.trim();
  firstChip === "L1" ? ok("edited level persisted (L1)") : fail("edited level", firstChip ?? "");

  // ---- 9. back as superadmin ----
  await page.click("text=Sign out");
  await page.waitForURL("**/login");
  await page.fill("#username", "vladimir");
  await page.fill("#password", "apex2026");
  await page.click("button[type=submit]");
  await page.waitForURL("**/analysis");
  ok("vladimir back in");
} catch (e) {
  fail("UNEXPECTED", e.message?.slice(0, 300));
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {});
} finally {
  await browser.close();
}

const failures = results.filter((r) => r.startsWith("✗"));
console.log(`\n${results.length - failures.length}/${results.length} passed`);
process.exit(failures.length ? 1 : 0);

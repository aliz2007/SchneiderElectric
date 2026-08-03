// Capability rubric + Account Manager roster, extracted 1:1 from the source Excel
// (APEX_AM_Assesment_140726). This is the only thing seeded from the workbook —
// all ratings are created in-app.

export type SeedCapability = {
  ord: number;
  name: string;
  cluster: string;
  src: string; // SE = Schneider core, C = complementary, A = Acquisition-track, S = Saturation-track
  reqAcq: number | null; // required level on the Acquisition track (null = not assessed)
  reqSat: number | null; // required level on the Saturation track
  l1: string;
  l2: string;
  l3: string;
};

export const CAPABILITIES: SeedCapability[] = [
  {
    ord: 1,
    name: "Account Management",
    cluster: "Account Strategy & Planning",
    src: "SE",
    reqAcq: 3,
    reqSat: 3,
    l1: "Drafts or contributes to the account plan but relies on others for overall direction; priorities broad or reactive",
    l2: "Leads a coherent Strategic Account Plan with clear priorities linked to ambition and growth plays; runs regular reviews",
    l3: "Uses the account plan as a steering tool for the Virtual Team and sponsors; anticipates shifts and proactively repositions",
  },
  {
    ord: 2,
    name: "Strategic Account Ambition",
    cluster: "Account Strategy & Planning",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Describes ambition mainly as 'more business' without clear positioning or focus",
    l2: "Defines Schneider's strategic intent, target position, and ambition for the account with a clear narrative",
    l3: "Crafts an ambition that galvanizes sponsors and the Virtual Team; uses it to unlock bigger moves",
  },
  {
    ord: 3,
    name: "Consultative Selling",
    cluster: "Commercial & Sales Excellence",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Leads with products/features; some discovery questions but weak link to business context",
    l2: "Anchors discussions in customer priorities and pain points; links offers to clear business outcomes",
    l3: "Reframes customer thinking and creates new space for Schneider; recognized as trusted advisor",
  },
  {
    ord: 4,
    name: "Negotiation",
    cluster: "Commercial & Sales Excellence",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Focuses mainly on price and concessions; reacts to customer demands; escalates quickly",
    l2: "Adapts negotiation approach to account context, risk, and strategic importance; prepares options",
    l3: "Designs and leads negotiation strategies that strengthen strategic position; helps others prepare",
  },
  {
    ord: 5,
    name: "Value Creation / Business Case",
    cluster: "Commercial & Sales Excellence",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Talks about benefits in broad terms; business case elements are incomplete or generic",
    l2: "Builds solid value arguments with data or credible logic; tailors the case to different stakeholders",
    l3: "Uses value logic to reshape scope, structure, or commercial model; reference for strong value cases",
  },
  {
    ord: 6,
    name: "Customer Relationship Management",
    cluster: "Executive & Customer Leadership",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Has working relationships around active deals but limited depth; depends on others to open doors",
    l2: "Maintains a healthy network across functions and levels; spots relationship risks and works to rebalance",
    l3: "Is perceived as a trusted interface to Schneider; manages complex stakeholder dynamics constructively",
  },
  {
    ord: 7,
    name: "Stakeholder Management",
    cluster: "Executive & Customer Leadership",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Sees stakeholders mainly through deal contacts; mapping incomplete or not kept current",
    l2: "Maintains a clear stakeholder map; actively works to align key players around priorities and actions",
    l3: "Anticipates shifts in influence and politics; orchestrates alignment across difficult coalitions",
  },
  {
    ord: 8,
    name: "Influencing Skills",
    cluster: "Executive & Customer Leadership",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Escalates quickly when facing resistance; tends to push messages rather than adapt",
    l2: "Adjusts style to audience; builds coalitions and uses facts, value, and relationships to secure alignment",
    l3: "Influences high-stakes decisions with senior stakeholders; regularly unblocks stuck topics",
  },
  {
    ord: 9,
    name: "Executive Presence",
    cluster: "Executive & Customer Leadership",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Feels less at ease in executive forums; messages can be too detailed or unclear",
    l2: "Prepares and delivers clear, concise messages at executive level; represents Schneider confidently",
    l3: "Shapes executive conversations and positions Schneider as strategic partner; trusted in C-suite",
  },
  {
    ord: 10,
    name: "C-Level Engagement",
    cluster: "Executive & Customer Leadership",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Participates in senior meetings mainly as observer; limited link to customer enterprise agenda",
    l2: "Plans and leads targeted C-level interactions connected to account ambition",
    l3: "Uses C-level interactions to open new spaces for Schneider and accelerate key decisions",
  },
  {
    ord: 11,
    name: "Executive Sponsorship Mobilization",
    cluster: "Executive & Customer Leadership",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Involves sponsors occasionally without clear objectives or preparation",
    l2: "Plans sponsor involvement with clear objectives; briefs and debriefs sponsors systematically",
    l3: "Strategically sequences sponsor involvement to unlock new plays and de-block issues",
  },
  {
    ord: 12,
    name: "Product Knowledge",
    cluster: "Offer, Segment & Solution Expertise",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Knows core offers in own area but has gaps on adjacent portfolios",
    l2: "Understands the relevant Schneider portfolio and recognises where it fits in the account",
    l3: "Anticipates how portfolio evolution and new offers could be used; reference for Top 50 conversations",
  },
  {
    ord: 13,
    name: "Industry Knowledge",
    cluster: "Offer, Segment & Solution Expertise",
    src: "SE",
    reqAcq: 2,
    reqSat: 2,
    l1: "Understands basic sector facts but limited view of trends, drivers, and customer economics",
    l2: "Reads the customer's sector context, market dynamics, and business environment",
    l3: "Uses industry insight to shape ambition, positioning, and timing; reference point on sector context",
  },
  {
    ord: 14,
    name: "One-SE Solution Positioning",
    cluster: "Offer, Segment & Solution Expertise",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Positions individual offers well but struggles to connect them into one coherent story",
    l2: "Builds clear One-SE propositions that connect multiple offers into one customer story",
    l3: "Designs One-SE plays that materially change Schneider's footprint; reference for One-SE positioning",
  },
  {
    ord: 15,
    name: "Technical & Solution Credibility",
    cluster: "Offer, Segment & Solution Expertise",
    src: "C",
    reqAcq: 2,
    reqSat: 2,
    l1: "Answers basic technical questions but quickly needs to hand over",
    l2: "Brings the right technical and solution credibility into customer dialogue and account planning",
    l3: "Frames the technical direction with customers and experts; seen as credible counterpart",
  },
  {
    ord: 16,
    name: "Pipeline Shaping",
    cluster: "Acquisition Excellence",
    src: "A",
    reqAcq: 3,
    reqSat: null,
    l1: "Enters late in opportunity cycle; mainly responds to defined demand and specs",
    l2: "Engages early enough to influence customer direction, opportunity framing, and positioning",
    l3: "Systematically shapes upstream discussions; changes customer frames, specs, or timing in SE's favour",
  },
  {
    ord: 17,
    name: "Competitive Positioning",
    cluster: "Acquisition Excellence",
    src: "A",
    reqAcq: 2,
    reqSat: null,
    l1: "Knows main competitors but focuses on price/features; competitive messages are generic",
    l2: "Analyses competitor strengths/weaknesses and sharpens Schneider differentiation in specific pursuits",
    l3: "Uses competitor insight to redesign strategy, offers, or deal structure; reference for competitive strategy",
  },
  {
    ord: 18,
    name: "White-Space Penetration",
    cluster: "Acquisition Excellence",
    src: "A",
    reqAcq: 2,
    reqSat: null,
    l1: "Sees white space in theory but struggles to translate into concrete targets and actions",
    l2: "Identifies and opens areas of the account where Schneider presence or access is limited",
    l3: "Systematically expands Schneider's footprint into new domains, sites, or stakeholders",
  },
  {
    ord: 19,
    name: "Preferred Partner Positioning",
    cluster: "Acquisition Excellence",
    src: "A",
    reqAcq: 2,
    reqSat: null,
    l1: "Interacts mostly as a supplier on transactions; limited perception as strategic counterpart",
    l2: "Builds trust and strategic relevance beyond transactional interactions",
    l3: "Achieves clear recognition as preferred partner; brought into early strategic discussions",
  },
  {
    ord: 20,
    name: "Share of Wallet Expansion",
    cluster: "Saturation Excellence",
    src: "S",
    reqAcq: null,
    reqSat: 3,
    l1: "Sees additional opportunities mainly reactively; limited structured view of penetration gaps",
    l2: "Broadens Schneider's footprint by identifying and prioritising additional portfolio penetration",
    l3: "Uses structured saturation analysis to drive a pipeline of expansion plays",
  },
  {
    ord: 21,
    name: "Retention & Loss Prevention",
    cluster: "Saturation Excellence",
    src: "S",
    reqAcq: null,
    reqSat: 2,
    l1: "Reacts to losses once they are visible; root causes analysed in a limited way",
    l2: "Protects existing business by monitoring risk signals and implementing corrective actions",
    l3: "Anticipates retention risks early; designs structured retention and recovery strategies",
  },
  {
    ord: 22,
    name: "Software & Services Attach",
    cluster: "Saturation Excellence",
    src: "S",
    reqAcq: null,
    reqSat: 2,
    l1: "Mentions software/services occasionally but not systematically",
    l2: "Identifies and positions software, digital, and services offers on top of core business footprint",
    l3: "Embeds attach logic into how the account is run; drives meaningful growth in software/services mix",
  },
];

export type SeedAM = {
  code: string;
  name: string;
  account: string;
  zone: "MEA" | "SAM" | "India" | "Pacific";
  track: "Acquisition" | "Saturation";
  segment: Segment;
  /** demo account tier; the client's own taxonomy replaces these */
  accountType?: AccountType;
};

// Business segments an account belongs to (picked when the account is created).
/**
 * Account tier, the "Account Type" column in the client's dashboard proposal. This is a
 * Schneider commercial classification, NOT the assessment track; edit the list to match
 * whatever taxonomy the business actually uses and the filters follow automatically.
 * Values on the seeded roster are demo data, like the names and accounts.
 */
export const ACCOUNT_TYPES = ["Strategic", "Key", "Growth", "Developing"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * What the Perf YTD figure means. The proposal marks the column optional and never defines
 * a unit, so the unit lives here in one place: change this label and every surface that
 * prints the number follows. It is entered per Account Manager by a superadmin.
 */
export const PERF_YTD_LABEL = "Perf YTD";
export const PERF_YTD_HELP = "Year-to-date performance against target, as a percentage. 100 = on target.";
export const PERF_YTD_SUFFIX = "%";

export const SEGMENTS = [
  "Power & Grid",
  "Energy & Chemicals",
  "CS&P · Cloud & Service Providers",
  "Multi-segment",
] as const;
export type Segment = (typeof SEGMENTS)[number];

// NOTE: these are fictional demo names, not real Schneider Electric employees.
// The roster is sample data only; any resemblance to real people is coincidental.
export const ROSTER: SeedAM[] = [
  { code: "AM01", name: "Adam Fisher", account: "Account 1", zone: "MEA", track: "Acquisition", segment: "Power & Grid" , accountType: "Strategic" },
  { code: "AM02", name: "Layla Haddad", account: "Account 2", zone: "MEA", track: "Saturation", segment: "Energy & Chemicals" , accountType: "Key" },
  { code: "AM03", name: "Omar Nasri", account: "Account 3", zone: "MEA", track: "Acquisition", segment: "CS&P · Cloud & Service Providers" , accountType: "Growth" },
  { code: "AM04", name: "Sofia Rahman", account: "Account 4", zone: "MEA", track: "Saturation", segment: "Multi-segment" , accountType: "Developing" },
  { code: "AM05", name: "Karim Belhaj", account: "Account 5", zone: "MEA", track: "Acquisition", segment: "Power & Grid" , accountType: "Strategic" },
  { code: "AM06", name: "Nadia Toure", account: "Account 6", zone: "MEA", track: "Acquisition", segment: "Energy & Chemicals" , accountType: "Key" },
  { code: "AM07", name: "Lucas Moreira", account: "Account 7", zone: "SAM", track: "Saturation", segment: "Power & Grid" , accountType: "Growth" },
  { code: "AM08", name: "Camila Rojas", account: "Account 8", zone: "SAM", track: "Acquisition", segment: "CS&P · Cloud & Service Providers" , accountType: "Developing" },
  { code: "AM09", name: "Mateo Silva", account: "Account 9", zone: "SAM", track: "Saturation", segment: "Energy & Chemicals" , accountType: "Strategic" },
  { code: "AM10", name: "Valentina Cruz", account: "Account 10", zone: "SAM", track: "Saturation", segment: "Multi-segment" , accountType: "Key" },
  { code: "AM11", name: "Diego Fernandes", account: "Account 11", zone: "SAM", track: "Acquisition", segment: "Power & Grid" , accountType: "Growth" },
  { code: "AM12", name: "Isabela Costa", account: "Account 12", zone: "SAM", track: "Acquisition", segment: "Energy & Chemicals" , accountType: "Developing" },
  { code: "AM13", name: "Rohan Mehta", account: "Account 13", zone: "India", track: "Saturation", segment: "CS&P · Cloud & Service Providers" , accountType: "Strategic" },
  { code: "AM14", name: "Priya Nair", account: "Account 14", zone: "India", track: "Acquisition", segment: "Power & Grid" , accountType: "Key" },
  { code: "AM15", name: "Arjun Kapoor", account: "Account 15", zone: "India", track: "Saturation", segment: "Multi-segment" , accountType: "Growth" },
  { code: "AM16", name: "Ananya Rao", account: "Account 16", zone: "India", track: "Saturation", segment: "Energy & Chemicals" , accountType: "Developing" },
  { code: "AM17", name: "Vikram Shah", account: "Account 17", zone: "India", track: "Acquisition", segment: "CS&P · Cloud & Service Providers" , accountType: "Strategic" },
  { code: "AM18", name: "Neha Iyer", account: "Account 18", zone: "India", track: "Acquisition", segment: "Power & Grid" , accountType: "Key" },
  { code: "AM19", name: "Ethan Walker", account: "Account 19", zone: "Pacific", track: "Acquisition", segment: "Energy & Chemicals" , accountType: "Growth" },
  { code: "AM20", name: "Mia Chen", account: "Account 20", zone: "Pacific", track: "Saturation", segment: "CS&P · Cloud & Service Providers" , accountType: "Developing" },
  { code: "AM21", name: "Liam Tan", account: "Account 21", zone: "Pacific", track: "Saturation", segment: "Multi-segment" , accountType: "Strategic" },
  { code: "AM22", name: "Grace Wong", account: "Account 22", zone: "Pacific", track: "Acquisition", segment: "Power & Grid" , accountType: "Key" },
  { code: "AM23", name: "Noah Park", account: "Account 23", zone: "Pacific", track: "Saturation", segment: "Energy & Chemicals" , accountType: "Growth" },
  { code: "AM24", name: "Olivia Lim", account: "Account 24", zone: "Pacific", track: "Acquisition", segment: "CS&P · Cloud & Service Providers" , accountType: "Developing" },
  { code: "AM25", name: "Jack Nguyen", account: "Account 25", zone: "Pacific", track: "Acquisition", segment: "Multi-segment" , accountType: "Strategic" },
];

export const ZONES = ["MEA", "SAM", "India", "Pacific"] as const;

// The single justification a self-assessor writes per theme to evidence their
// ratings. One mandatory free-text answer, gently guided by the APEX framework
// (situation / actions / results / impact / replication) rather than five fields.
export const SELF_JUSTIFICATION_PROMPT =
  "Share a concrete example for each capability below: situation, actions taken, results, impact, and where relevant how it could be replicated.";

// Interview / self-reflection question guide, 1:1 from the APEX Question Guide
// workbook: two guiding questions per capability for EACH lens. Self-assessors get
// reflection prompts ("How do you…"); Manager and APEX Panel get the interview
// prompts they ask the person ("Tell me about a time…"). Shown on every capability
// screen in the wizard, whatever the assessment type.
export const CAPABILITY_QUESTIONS: Record<string, Record<Lens, string[]>> = {
  "Account Management": {
    self: ["How do you build your strategic account plan, and how do you use it to steer your priorities day to day?", "How do you keep your account plan relevant when the account changes?"],
    manager: ["Tell me about a time when you used your account plan to align the virtual team and sponsors around clear priorities.", "Tell me about a time when a decision or resource shift on your account came directly from your planning."],
    expert: ["How does your account plan help you anticipate shifts in the account and reposition Schneider ahead of them?", "Describe a situation where your account strategy delivered impact well beyond a single deal."],
  },
  "Strategic Account Ambition": {
    self: ["How do you define your ambition and target position for an account, beyond growing the numbers?", "How do you get others to buy into the ambition you set for an account?"],
    manager: ["Tell me about a time when you set an ambition for an account that went beyond its expected trajectory.", "Tell me about a time when your ambition for an account pulled sponsors or the team behind a bigger move."],
    expert: ["How do you shape an account ambition that unlocks bigger moves and rallies sponsors around it?", "Describe a situation where your ambition reframed what the account could become for Schneider."],
  },
  "Consultative Selling": {
    self: ["How do you uncover what's really driving a customer before positioning any Schneider offer?", "How do you link what the customer needs to clear business outcomes rather than to product features?"],
    manager: ["Tell me about a time when you moved a customer conversation from products and features onto their business priorities.", "Tell me about a time when your questioning changed the direction of an opportunity."],
    expert: ["How do you bring a customer a perspective on their own business that reframes how they think?", "Describe a situation where a consultative approach opened an opportunity competitors did not see."],
  },
  "Negotiation": {
    self: ["How do you prepare for an important negotiation, and what guides your approach before price comes up?", "How do you protect or create value in a negotiation instead of conceding on price?"],
    manager: ["Tell me about a time when a negotiation you led strengthened Schneider's position rather than just closing the deal.", "Tell me about a time when you kept control of a negotiation that became difficult."],
    expert: ["How do you approach a negotiation that involves several parties and the long-term relationship?", "Describe a situation where the way you handled a negotiation reshaped the commercial relationship."],
  },
  "Value Creation / Business Case": {
    self: ["How do you build a business case, and how do you tailor the value argument to different stakeholders?", "How do you back your value argument with data or credible logic rather than general benefits?"],
    manager: ["Tell me about a time when your business case was decisive in a customer's decision.", "Tell me about a time when your value thinking reshaped the scope or structure of a deal."],
    expert: ["How do you connect the value you create to the financial or strategic priorities of the customer's leadership?", "Describe a situation where your value case helped the customer make the argument internally."],
  },
  "Customer Relationship Management": {
    self: ["How do you build and maintain your network across the customer's functions and levels, beyond deal contacts?", "How do you spot and address a relationship risk before it damages the account?"],
    manager: ["Tell me about a time when a relationship you built opened a door you would otherwise have depended on others to open.", "Tell me about a time when you were trusted to manage a difficult situation with the customer."],
    expert: ["How do you make sure Schneider, not only you, is seen as a trusted interface across the customer?", "Describe a situation where the trust you built shifted the balance on a strategic account."],
  },
  "Stakeholder Management": {
    self: ["How do you map the stakeholders in an account and keep that view current?", "How do you align stakeholders with different interests around your account priorities?"],
    manager: ["Tell me about a time when you aligned competing stakeholders around a way forward.", "Tell me about a time when you anticipated a shift in influence or politics and got ahead of it."],
    expert: ["How do you read where influence is moving inside a customer before it becomes obvious?", "Describe a situation where you had to influence without authority to execute an account plan."],
  },
  "Influencing Skills": {
    self: ["How do you adapt your approach when you meet resistance, rather than pushing your message harder?", "How do you build alignment using facts, value and relationships when you have no authority?"],
    manager: ["Tell me about a time when you won over a resistant stakeholder.", "Tell me about a time when you unblocked a stuck decision with senior stakeholders."],
    expert: ["How do you influence a high-stakes decision when the people who own it don't report to you?", "Describe a situation where your influence changed the outcome of a strategic decision."],
  },
  "Executive Presence": {
    self: ["How do you prepare and deliver a clear, concise message when you're in front of executives?", "How do you decide what to focus on when you only have a few minutes with a senior leader?"],
    manager: ["Tell me about a time when you represented Schneider confidently in a demanding executive setting.", "Tell me about a time when you shaped where an executive conversation went."],
    expert: ["How do you get treated as a peer rather than a vendor in a room of executives?", "Describe a situation where your presence turned a high-stakes conversation your way."],
  },
  "C-Level Engagement": {
    self: ["How do you gain access to C-level executives and stay relevant to their agenda?", "How do you connect your C-level interactions to the ambition you have for the account?"],
    manager: ["Tell me about a time when you engaged a C-level contact on what mattered to their business.", "Tell me about a time when a C-level relationship moved a key decision for you."],
    expert: ["How do you make yourself relevant to a CEO's agenda rather than only to procurement?", "Describe a situation where a C-level relationship made possible an outcome that otherwise wouldn't have happened."],
  },
  "Executive Sponsorship Mobilization": {
    self: ["How do you prepare and brief an executive sponsor so their involvement is genuinely useful?", "How do you time a sponsor's involvement to unlock something that's stuck?"],
    manager: ["Tell me about a time when you prepared a sponsor and it made a real difference.", "Tell me about a time when you brought a sponsor in at exactly the right moment to unlock a play."],
    expert: ["How do you sequence senior sponsors across a customer to build strategic momentum?", "Describe a situation where mobilising a sponsor changed the strategic position on an account."],
  },
  "Product Knowledge": {
    self: ["How do you build your knowledge of the Schneider portfolio, including offers beyond your usual area?", "How do you recognise where the portfolio fits a specific customer need?"],
    manager: ["Tell me about a time when your portfolio knowledge earned credibility or influenced a customer's choice.", "Tell me about a time when you saw how a newer or adjacent offer could fit an account."],
    expert: ["How do you connect where the portfolio is heading to where the customer is heading?", "Describe a situation where your grasp of the portfolio let you position a larger, more integrated solution."],
  },
  "Industry Knowledge": {
    self: ["How do you build your understanding of the customer's sector, its dynamics and economics, beyond the basics?", "How do you use industry insight to shape your positioning or timing on an account?"],
    manager: ["Tell me about a time when industry insight you brought strengthened Schneider's position.", "Tell me about a time when your read of the sector shaped a decision on an account."],
    expert: ["How do you use where the industry is heading to get ahead of where the customer will be?", "Describe a situation where anticipating a shift in the sector created an opportunity."],
  },
  "One-SE Solution Positioning": {
    self: ["How do you connect several Schneider offers into one coherent story for the customer?", "How do you build a One-SE proposition rather than positioning offers separately?"],
    manager: ["Tell me about a time when you connected multiple offers into one coherent customer story.", "Tell me about a time when a joined-up One-SE play changed Schneider's footprint in an account."],
    expert: ["How do you get past internal boundaries to put one integrated Schneider in front of a customer?", "Describe a situation where a One-SE approach created value no single offer could deliver."],
  },
  "Technical & Solution Credibility": {
    self: ["How much of the technical discussion do you carry yourself, and when do you bring in experts?", "How do you use your technical credibility to help frame the solution direction with a customer?"],
    manager: ["Tell me about a time when your technical credibility was decisive with a customer.", "Tell me about a time when you held the technical direction alongside customers or experts."],
    expert: ["How do you stay a credible counterpart when the room is full of technical decision-makers?", "Describe a situation where technical credibility helped you win a complex solution."],
  },
  "Pipeline Shaping": {
    self: ["At what point do you get involved in an opportunity, and what does that let you influence?", "How do you shape an opportunity's framing, specs or timing before the customer has fully defined it?"],
    manager: ["Tell me about a time when you engaged early and influenced how an opportunity took shape.", "Tell me about a time when you changed a customer's specs, framing or timing in Schneider's favour."],
    expert: ["How do you get upstream of demand instead of responding to it once it's defined?", "Describe a situation where you identified a growth opportunity not initially visible to the customer or your team, and what came of it."],
  },
  "Competitive Positioning": {
    self: ["How do you work out where Schneider genuinely wins against a specific competitor in a pursuit?", "How do you use competitor insight to sharpen your differentiation?"],
    manager: ["Tell me about a time when you sharpened Schneider's differentiation against a competitor in a live deal.", "Tell me about a time when competitor insight made you rethink a strategy or deal structure."],
    expert: ["How do you set the terms of a competition so it plays to Schneider's strengths?", "Describe a situation where you changed the basis on which a deal was being judged."],
  },
  "White-Space Penetration": {
    self: ["How do you turn white space in an account into concrete targets and actions?", "How do you open up parts of an account where Schneider has little presence or access?"],
    manager: ["Tell me about a time when you broke into an area of an account where Schneider had limited access.", "Tell me about a time when you expanded the footprint into a new site, domain or set of stakeholders."],
    expert: ["How do you expand Schneider systematically into parts of an account that have never bought from us?", "Describe a situation where white-space penetration materially grew an account."],
  },
  "Preferred Partner Positioning": {
    self: ["How do you build the trust and strategic relevance that make a customer see you as more than a supplier?", "How do you get brought into strategic discussions early, rather than at the buying stage?"],
    manager: ["Tell me about a time when you moved Schneider beyond a transactional supplier role with a customer.", "Tell me about a time when a customer treated you as a partner in their thinking, not just a vendor."],
    expert: ["How do you get Schneider written into a customer's planning as the natural partner to call?", "Describe a situation where being the preferred partner created a durable advantage."],
  },
  "Share of Wallet Expansion": {
    self: ["How do you build a clear picture of where your penetration gaps in an account actually are?", "How do you turn a structured view of an account into a set of expansion plays?"],
    manager: ["Tell me about a time when you identified and prioritised where Schneider was under-penetrated.", "Tell me about a time when you built a pipeline of expansion opportunities from a structured look at an account."],
    expert: ["How do you build a pipeline of growth from the gaps in an existing account?", "Describe a situation where you grew your share by displacing an entrenched competitor."],
  },
  "Retention & Loss Prevention": {
    self: ["How do you monitor the signals that tell you an account is at risk before it starts slipping?", "How do you act on the root cause of a retention risk rather than the symptom?"],
    manager: ["Tell me about a time when you caught an early warning and acted before business was lost.", "Tell me about a time when you put a structured plan around holding on to an at-risk account."],
    expert: ["How do you make an account resilient to competitive threats before any threat appears?", "Describe a situation where anticipating a threat let you secure a strategic account."],
  },
  "Software & Services Attach": {
    self: ["How do you make software and services a systematic part of how you sell, rather than an afterthought?", "How do you position software, digital and services on top of the core business footprint?"],
    manager: ["Tell me about a time when you built software or services onto the core business in an account.", "Tell me about a time when adding software or services meaningfully changed the value of a deal."],
    expert: ["How do you shift an account towards recurring, outcome-based value through software and services?", "Describe a situation where attach changed the underlying economics of an account."],
  },
};

export const LENSES = ["self", "manager", "expert"] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABELS: Record<Lens, string> = {
  self: "Self Assessment",
  manager: "Manager Assessment",
  expert: "APEX Panel",
};

/**
 * How much each lens counts toward a capability's score. The WEIGHTED score — not any
 * single lens — is the canonical figure behind every average, gap, strength, development
 * area, heat map and KPI in the app.
 *
 * When a lens has not submitted, its weight is dropped and the remaining weights are
 * re-normalised, so a partially assessed person is still scored fairly on what exists
 * (see `weightedScore`).
 */
export const LENS_WEIGHTS: Record<Lens, number> = {
  self: 0.2,
  expert: 0.35, // the APEX Panel
  manager: 0.45,
};

/** "Self 20% · APEX Panel 35% · Manager 45%" — for footnotes and tooltips. */
export const WEIGHTS_LABEL = `Self ${LENS_WEIGHTS.self * 100}% · APEX Panel ${
  LENS_WEIGHTS.expert * 100
}% · Manager ${LENS_WEIGHTS.manager * 100}%`;

/**
 * The weighted score for one capability from whichever lenses have a level.
 * Returns null when no lens has scored it. Weights are re-normalised over the lenses
 * present, so (self 2, manager 3) → (0.2*2 + 0.45*3) / 0.65 = 2.69.
 */
export function weightedScore(scores: Partial<Record<Lens, number | null | undefined>>): number | null {
  let total = 0;
  let weight = 0;
  for (const lens of LENSES) {
    const value = scores[lens];
    if (value == null) continue;
    total += value * LENS_WEIGHTS[lens];
    weight += LENS_WEIGHTS[lens];
  }
  return weight === 0 ? null : total / weight;
}

export const LEVEL_LABELS: Record<number, string> = {
  1: "L1 · Developing",
  2: "L2 · Proficient",
  3: "L3 · Advanced",
};

export const LEVEL_NAMES: Record<number, string> = {
  1: "Developing",
  2: "Proficient",
  3: "Advanced",
};

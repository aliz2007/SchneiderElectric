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
};

// Business segments an account belongs to (picked when the account is created).
export const SEGMENTS = [
  "Power & Grid",
  "Energy & Chemicals",
  "CS&P - Cloud & Service Providers",
  "Multi-segment",
] as const;
export type Segment = (typeof SEGMENTS)[number];

export const ROSTER: SeedAM[] = [
  { code: "AM01", name: "Account Manager 1", account: "Account 1", zone: "MEA", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM02", name: "Mohamed Marzouk", account: "Account 2", zone: "MEA", track: "Saturation", segment: "Energy & Chemicals" },
  { code: "AM03", name: "Basim El-Subihy", account: "Account 3", zone: "MEA", track: "Acquisition", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM04", name: "Biju Mathew", account: "Account 4", zone: "MEA", track: "Saturation", segment: "Multi-segment" },
  { code: "AM05", name: "Oseid Mohamemed Faqih", account: "Account 5", zone: "MEA", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM06", name: "Kamel Bedrane", account: "Account 6", zone: "MEA", track: "Acquisition", segment: "Energy & Chemicals" },
  { code: "AM07", name: "Moamen Mohamed Ahmed Ibrahim", account: "Account 7", zone: "SAM", track: "Saturation", segment: "Power & Grid" },
  { code: "AM08", name: "Ahmed Abdel-Maugod", account: "Account 8", zone: "SAM", track: "Acquisition", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM09", name: "Moteeb Albaqami", account: "Account 9", zone: "SAM", track: "Saturation", segment: "Energy & Chemicals" },
  { code: "AM10", name: "Anny Rodrigues de Assis", account: "Account 10", zone: "SAM", track: "Saturation", segment: "Multi-segment" },
  { code: "AM11", name: "Eduardo Salles de Carvalho", account: "Account 11", zone: "SAM", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM12", name: "Marco Antonio Martins", account: "Account 12", zone: "SAM", track: "Acquisition", segment: "Energy & Chemicals" },
  { code: "AM13", name: "Account Manager 13", account: "Account 13", zone: "India", track: "Saturation", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM14", name: "Account Manager 14", account: "Account 14", zone: "India", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM15", name: "Account Manager 15", account: "Account 15", zone: "India", track: "Saturation", segment: "Multi-segment" },
  { code: "AM16", name: "Account Manager 16", account: "Account 16", zone: "India", track: "Saturation", segment: "Energy & Chemicals" },
  { code: "AM17", name: "Account Manager 17", account: "Account 17", zone: "India", track: "Acquisition", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM18", name: "Account Manager 18", account: "Account 18", zone: "India", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM19", name: "Brian Casserly", account: "Account 19", zone: "Pacific", track: "Acquisition", segment: "Energy & Chemicals" },
  { code: "AM20", name: "Vishal Nayak", account: "Account 20", zone: "Pacific", track: "Saturation", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM21", name: "Franky Chan", account: "Account 21", zone: "Pacific", track: "Saturation", segment: "Multi-segment" },
  { code: "AM22", name: "Account Manager 22", account: "Account 22", zone: "Pacific", track: "Acquisition", segment: "Power & Grid" },
  { code: "AM23", name: "Account Manager 23", account: "Account 23", zone: "Pacific", track: "Saturation", segment: "Energy & Chemicals" },
  { code: "AM24", name: "Account Manager 24", account: "Account 24", zone: "Pacific", track: "Acquisition", segment: "CS&P - Cloud & Service Providers" },
  { code: "AM25", name: "Account Manager 25", account: "Account 25", zone: "Pacific", track: "Acquisition", segment: "Multi-segment" },
];

export const ZONES = ["MEA", "SAM", "India", "Pacific"] as const;

// The five APEX framework questions a self-assessor answers per theme to justify
// their ratings (from the APEX discussion guide). Situation/Actions/Results/Impact/
// Replication — the flow that separates knowledge, execution and strategic mastery.
export const FRAMEWORK_QUESTIONS = [
  { key: "situation", label: "Situation", prompt: "What was the context, challenge, or opportunity?" },
  { key: "actions", label: "Actions", prompt: "What did you personally do? What decisions? How did you influence?" },
  { key: "results", label: "Results", prompt: "What measurable outcomes? What changed?" },
  { key: "impact", label: "Impact", prompt: "Impact on the customer, the account, SE, or the long-term strategy?" },
  { key: "replication", label: "Replication", prompt: "Applied elsewhere? Is it repeatable or scalable?" },
] as const;
export type FrameworkKey = (typeof FRAMEWORK_QUESTIONS)[number]["key"];

export const LENSES = ["self", "manager", "expert"] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABELS: Record<Lens, string> = {
  self: "Self Assessment",
  manager: "Manager Assessment",
  expert: "APEX Panel",
};

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

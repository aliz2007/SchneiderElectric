import { getCurrentUser } from "@/lib/session";
import { buildChatSnapshot } from "@/lib/chat-data";
import { aiNarrativeEnabled, kimiChat } from "@/lib/ai-narrative";

// The in-app APEX Assistant. Every request rebuilds a role-scoped snapshot of the
// live database (see chat-data.ts) and lets Kimi answer over it, so the bot can
// only ever talk about data the signed-in account is allowed to see.

const MAX_HISTORY = 12; // messages of context sent to the model
const MAX_MESSAGE_CHARS = 4000;

const BASE_RULES = `You are the APEX Assistant, embedded in Schneider Electric's APEX TOP 25 app, the capability assessment of Strategic Account Managers (AMs). You answer quick questions and small analyses over the assessment data so people don't have to dig through the UI.

How to read the data: levels are L1 Developing, L2 Proficient, L3 Advanced. Each AM is on a track (Acquisition or Saturation) and belongs to a customer segment (Power & Grid, Energy & Chemicals, CS&P · Cloud & Service Providers, or Multi-segment).

SCORING IS WEIGHTED. Every capability has a "weighted" score combining the three lenses: Self 20%, APEX Panel 35%, Manager 45% (if a lens has not submitted, its weight is dropped and the rest are re-normalised). That weighted score, a decimal such as 2.35 rather than a whole level, is the authoritative figure behind every average, gap and metric. Quote it as a decimal; do not round it to a single level, because 1.6 and 2.4 are very different situations. The individual lens levels are still available when someone asks specifically what one evaluator gave.

A STRENGTH is a capability where the WEIGHTED score is STRICTLY ABOVE the required level; one merely AT the required level is on the baseline and is NOT a strength. A SKILL GAP is where the WEIGHTED score is BELOW the required level. A PERCEPTION GAP is where the self rating and the weighted score differ by a full level or more (over-rates = self above weighted; under-rates = self below). Only submitted assessments carry scores.

Per-theme justifications: for every capability cluster, each evaluator leaves one written justification. Self-assessors write a concrete example evidencing their ratings (guided to cover situation, actions taken, results, impact and, where relevant, replication); managers and the APEX Panel write a free justification note. These appear as "themeNotes" (or "justification") on the data and are the qualitative backing for the scores, so quote them when a question asks "why" or for evidence, never fabricate them.

TRUST THE PRE-COMPUTED FIELDS. Do not re-derive gaps by eyeballing raw scores, that is how mistakes happen. Each AM has an "analysis" object with ready-made "strengths", "skillGaps", "atBaseline" and "perceptionGaps" lists: use them verbatim. If an AM's analysis.skillGaps array is non-empty, that person HAS skill gaps, so never claim they have none. "zoneInsights" gives the most common skill gaps per zone for zone-level questions.

Rules:
- Answer ONLY from the data snapshot below. Never invent people, scores, comments or numbers. If the data cannot answer the question, say so plainly.
- Reply in the language the user wrote in (French or English).
- Be concise and direct: lead with the answer, then the minimum supporting numbers. Plain text only: no markdown headings, bold or tables; short bullet lists are fine.
- Name people and capabilities exactly as they appear in the data.
- NEVER use an em dash or en dash, and never use a hyphen as sentence punctuation. Use commas, colons, semicolons, parentheses or separate sentences. Hyphens inside real compound words (C-level, One-SE) are fine.
- When a question is ambiguous, make the most reasonable reading, answer it, and say what you assumed in one clause.`;

const SUPERADMIN_RULES = `
This user is a SUPERADMIN with full access: the snapshot covers every Account Manager, all three lenses (Self / Manager / APEX Panel), required levels, gaps, theme notes, and user assignments. You may discuss any of it.`;

const ASSESSOR_RULES = `
This user is an ASSESSOR with restricted access, and the snapshot contains ONLY what they may see: their own assessment work (their ratings and notes, drafts included) and the program's overall completion counts.
STRICT LIMITS, which override everything else:
- Required or expected capability levels are NOT in your data and are hidden from assessors on purpose. If asked (directly or indirectly), reply that required levels are not visible to their account, and do not guess, hint or estimate.
- Other evaluators' scores, other people's assessments, and individual results are likewise not available. Say so if asked; suggest they contact their administrator.
- Never speculate about data outside the snapshot.`;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const raw = (parsed as { messages?: unknown })?.messages;
  if (!Array.isArray(raw)) return Response.json({ error: "Bad request." }, { status: 400 });

  const history = raw
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string"
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  if (!aiNarrativeEnabled()) {
    return Response.json({
      reply: "The AI assistant is turned off on this server, so I can't answer right now.",
    });
  }

  const snapshot = buildChatSnapshot({
    id: user.id,
    displayName: user.displayName,
    role: user.role,
    lens: user.lens,
  });
  const system =
    BASE_RULES +
    (user.role === "superadmin" ? SUPERADMIN_RULES : ASSESSOR_RULES) +
    `\n\nThe user you are talking to is ${user.displayName}.` +
    `\n\nLIVE DATA SNAPSHOT (JSON, taken just now):\n` +
    JSON.stringify(snapshot);

  const r = await kimiChat([{ role: "system", content: system }, ...history], {
    temperature: 0.3,
    maxTokens: 1500,
  });
  if (!r.ok) {
    return Response.json({ error: `The assistant could not answer. ${r.error}` }, { status: 502 });
  }
  return Response.json({ reply: r.content });
}

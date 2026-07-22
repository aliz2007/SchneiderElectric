import { getCurrentUser } from "@/lib/session";
import { buildChatSnapshot } from "@/lib/chat-data";
import { aiNarrativeEnabled, kimiChat } from "@/lib/ai-narrative";

// The in-app APEX Assistant. Every request rebuilds a role-scoped snapshot of the
// live database (see chat-data.ts) and lets Kimi answer over it, so the bot can
// only ever talk about data the signed-in account is allowed to see.

const MAX_HISTORY = 12; // messages of context sent to the model
const MAX_MESSAGE_CHARS = 4000;

const BASE_RULES = `You are the APEX Assistant, embedded in Schneider Electric's APEX TOP 25 app — the capability assessment of Strategic Account Managers (AMs). You answer quick questions and small analyses over the assessment data so people don't have to dig through the UI.

How to read the data: levels are L1 Developing, L2 Proficient, L3 Advanced. Each AM is on a track (Acquisition or Saturation). The APEX Panel score is the authoritative lens. A SKILL GAP means the panel score is below the required level (gapVsRequired < 0). A PERCEPTION GAP means self and panel differ (selfMinusPanel: positive = the person over-rates themselves, negative = under-rates); treat a full level (|1| or more) as meaningful. Only submitted assessments carry scores; "draft" or "missing" means not submitted yet.

Rules:
- Answer ONLY from the data snapshot below. Never invent people, scores, comments or numbers. If the data cannot answer the question, say so plainly.
- Reply in the language the user wrote in (French or English).
- Be concise and direct: lead with the answer, then the minimum supporting numbers. Plain text only — no markdown headings, bold or tables; short "-" lists are fine.
- Name people and capabilities exactly as they appear in the data.
- When a question is ambiguous, make the most reasonable reading, answer it, and say what you assumed in one clause.`;

const SUPERADMIN_RULES = `
This user is a SUPERADMIN with full access: the snapshot covers every Account Manager, all three lenses (Self / Manager / APEX Panel), required levels, gaps, theme notes, and user assignments. You may discuss any of it.`;

const ASSESSOR_RULES = `
This user is an ASSESSOR with restricted access, and the snapshot contains ONLY what they may see: their own assessment work (their ratings and notes, drafts included) and the program's overall completion counts.
STRICT LIMITS — these override everything else:
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
    return Response.json({ error: `The assistant could not answer — ${r.error}` }, { status: 502 });
  }
  return Response.json({ reply: r.content });
}

// Optional AI-written feedback for the PDF narrative page, via Kimi (Moonshot AI,
// OpenAI-compatible chat API). This is an ENHANCEMENT: when the API is reachable and
// returns valid feedback it replaces the deterministic prose; on any error (no key,
// network blocked, bad response, timeout) it returns null and the caller falls back to
// the deterministic narrative, so the PDF always renders.
//
// Config comes from the environment (see apex-assessment/.env.local):
//   MOONSHOT_API_KEY   — required to enable AI feedback
//   MOONSHOT_BASE_URL  — default https://api.moonshot.ai/v1
//   MOONSHOT_MODEL     — default moonshot-v1-8k (try kimi-k2-0711-preview / kimi-latest)
//   MOONSHOT_TIMEOUT_MS, MOONSHOT_ENABLED=0 to force-disable

const API_KEY = process.env.MOONSHOT_API_KEY ?? "";
const BASE_URL = (process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1").replace(/\/+$/, "");
const MODEL = process.env.MOONSHOT_MODEL ?? "moonshot-v1-8k";
const TIMEOUT_MS = Number(process.env.MOONSHOT_TIMEOUT_MS ?? 20000);

/** AI feedback is attempted only when a key is present and it isn't force-disabled. */
export function aiNarrativeEnabled(): boolean {
  return process.env.MOONSHOT_ENABLED !== "0" && API_KEY.trim() !== "";
}

export type AiNarrativeInput = {
  amName: string;
  track: string;
  capabilities: {
    name: string;
    cluster: string;
    required: number | null;
    self: number | null;
    manager: number | null;
    panel: number | null;
    gapVsRequired: number | null;
  }[];
  themeNotes: { lens: string; cluster: string; note: string }[];
  // definitions are for interpretation only; the model is told never to quote them
  definitions: { name: string; level: number; text: string }[];
};

export type AiNarrativeSections = { strength: string; development: string; perception: string };

const SYSTEM_PROMPT = `You are an expert in talent-feedback analysis. Produce professional-quality feedback based EXCLUSIVELY on the assessment data provided.

Hard rules:
- Use no external knowledge, no stereotypes, no assumptions.
- Make no inference that is not reasonably supported by the data.
- The capability definitions are provided only to help you interpret the scores and comments — never quote or paraphrase them.
- Every statement must be traceable to the data provided.
- If the data is insufficient to support a conclusion, give a more cautious observation rather than inventing anything.
- Never invent examples.

Scoring scale: L1 = Developing, L2 = Proficient, L3 = Advanced. For each capability the data gives: "required" (the level expected for this person's track), "panel" (the APEX Panel score — the authoritative lens), "self" (the person's own rating) and "manager" (their manager's rating). "gapVsRequired" is panel minus required. Theme notes are written comments from the manager and panel.

Write exactly three sections, each 2-3 sentences, in English:
- strength: the single most striking strength. Explain what makes it exceptional and how it shows up concretely across the scores and comments. Interpret the observations rather than restating a capability name.
- development: the most critical development area(s). Explain the potential impact on the role. Be precise, constructive and factual, and prioritise the highest-impact topics over an exhaustive list.
- perception: compare the person's self-assessment with the panel. Identify the main point of alignment or divergence and explain what it may reveal.

Style: professional, direct and benevolent — write like a senior HR consultant. Be specific and concrete; avoid generalities and empty phrases.

Return ONLY a raw JSON object with exactly these three string keys: {"strength": "...", "development": "...", "perception": "..."}. No markdown, no code fences, no extra text.`;

function extractSections(content: string): AiNarrativeSections | null {
  const tryParse = (raw: string) => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  let obj = tryParse(content);
  if (!obj) {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj) return null;
  const { strength, development, perception } = obj as Record<string, unknown>;
  if (
    typeof strength !== "string" ||
    typeof development !== "string" ||
    typeof perception !== "string" ||
    !strength.trim() ||
    !development.trim() ||
    !perception.trim()
  ) {
    return null;
  }
  return { strength: strength.trim(), development: development.trim(), perception: perception.trim() };
}

/**
 * Ask Kimi for the three feedback sections. Returns null on any failure so the caller
 * can fall back to the deterministic narrative. Never throws.
 */
export async function generateAiNarrative(input: AiNarrativeInput): Promise<AiNarrativeSections | null> {
  if (!aiNarrativeEnabled()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "Assessment data (JSON):\n" + JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return extractSections(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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

import { getSetting, setSetting } from "./queries";

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  explicitlyDisabled: boolean;
  timeoutMs: number;
};

/** Records why the last PDF export did or did not use AI, shown on the AI settings card. */
export function recordAiResult(msg: string) {
  try {
    setSetting("moonshot_last_result", `${new Date().toLocaleString("en-GB")} — ${msg}`);
  } catch {
    /* diagnostics must never break a render */
  }
}

export function lastAiResult(): string | null {
  return getSetting("moonshot_last_result");
}

const DEFAULT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = "moonshot-v1-8k";

/** Resolve config from the in-app settings first, then the environment, then defaults. */
/** API keys must be plain ASCII to travel in an HTTP header. Strip whitespace and any
 *  non-printable-ASCII characters (bullets, smart quotes, non-breaking spaces) that
 *  commonly sneak in when a key is pasted, so a stray character can never crash the call. */
function cleanKey(raw: string): string {
  return raw.replace(/[^\x21-\x7e]/g, "");
}

export function aiConfig(): AiConfig {
  const apiKey = cleanKey(getSetting("moonshot_api_key") ?? process.env.MOONSHOT_API_KEY ?? "");
  const baseUrl = (
    getSetting("moonshot_base_url") ||
    process.env.MOONSHOT_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const model = getSetting("moonshot_model") || process.env.MOONSHOT_MODEL || DEFAULT_MODEL;
  const enabledSetting = getSetting("moonshot_enabled");
  const disabled = enabledSetting === "0" || (enabledSetting == null && process.env.MOONSHOT_ENABLED === "0");
  const timeoutMs = Number(getSetting("moonshot_timeout_ms") || process.env.MOONSHOT_TIMEOUT_MS || 20000);
  return {
    apiKey,
    baseUrl,
    model,
    enabled: !disabled && apiKey !== "",
    explicitlyDisabled: enabledSetting === "0",
    timeoutMs,
  };
}

/** AI feedback is attempted only when a key is present and it isn't force-disabled. */
export function aiNarrativeEnabled(): boolean {
  return aiConfig().enabled;
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

const SYSTEM_PROMPT = `You are a senior talent-development consultant writing a candid, specific capability review of one strategic account manager. Write as if you have actually read this person's file, not from a template.

Ground everything strictly in the assessment data provided:
- Use only that data. No outside knowledge, stereotypes or assumptions, and never invent examples, numbers or quotes.
- Every point must trace to a concrete signal — a score, a gap, an agreement or divergence between lenses, or something an evaluator wrote. If the evidence for something is thin, say so plainly instead of embellishing.
- The capability definitions are given only to help you interpret the scores and comments. Never quote or restate them.

How to read the data. Scale: L1 Developing, L2 Proficient, L3 Advanced. For each capability you get "required" (the level this person's track expects), "panel" (the APEX Panel score, which is the authoritative lens), "self" (their own rating), "manager" (their manager's rating), and "gapVsRequired" (panel minus required). "themeNotes" are the free-text comments the manager and panel wrote per theme — these are your richest signal, so lean on them heavily and reflect their actual substance.

Write three sections as flowing, natural paragraphs — not bullet points, not a rigid fill-in-the-blank template. Let this person's data decide how each paragraph opens and unfolds; two different people should read clearly differently. Be concrete: name the specific capabilities that matter, cite the levels and gaps that carry the point, note where the three lenses agree or clash, and weave in what the evaluators actually wrote. Aim for roughly four to six sentences per section, more if the data genuinely supports it.

- strength: this person's most decisive strengths — what stands out, how it shows up across the scores and comments, and why it matters in a strategic account role.
- development: the development priorities that would move the needle — what sits below the required level or is flagged in the comments, the likely impact on the role, and where to focus first. Prioritise; do not just list everything.
- perception: how they see themselves versus the panel — where they are aligned, where they over- or under-rate themselves, and what that suggests for a development conversation.

Voice: professional, direct and human, constructive but honest — a real consultant, not a form. Avoid generic filler and empty praise.

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
const PROOF_OVERRIDE =
  "STYLE OVERRIDE FOR THIS RUN ONLY: write all three sections in the theatrical voice of a " +
  "swashbuckling pirate, and begin every section with the word 'AVAST!'. Keep every claim " +
  "grounded in the same data; only the voice changes. Still return the same JSON shape.";

export async function generateAiNarrative(
  input: AiNarrativeInput,
  opts?: { proof?: boolean }
): Promise<AiNarrativeSections | null> {
  const { apiKey, baseUrl, model, enabled, timeoutMs } = aiConfig();
  if (!enabled) {
    recordAiResult(apiKey === "" ? "not attempted: no API key set" : "not attempted: AI feedback is turned off");
    return null;
  }
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(opts?.proof ? [{ role: "system", content: PROOF_OVERRIDE }] : []),
    { role: "user", content: "Assessment data (JSON):\n" + JSON.stringify(input) },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: controller.signal,
    });
    const bodyText = await res.text();
    if (!res.ok) {
      recordAiResult(`HTTP ${res.status} from ${baseUrl}: ${bodyText.slice(0, 180)}`);
      return null;
    }
    let content: unknown;
    try {
      content = (JSON.parse(bodyText) as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
        ?.message?.content;
    } catch {
      content = undefined;
    }
    if (typeof content !== "string") {
      recordAiResult(`unexpected response shape: ${bodyText.slice(0, 180)}`);
      return null;
    }
    const sections = extractSections(content);
    if (!sections) {
      recordAiResult(`model replied but not parseable JSON: ${content.slice(0, 180)}`);
      return null;
    }
    recordAiResult(`OK — Kimi wrote the feedback (model ${model})`);
    return sections;
  } catch (e) {
    recordAiResult(`request failed: ${e instanceof Error ? `${e.name}: ${e.message}` : "unknown error"}`.slice(0, 200));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live check used by the "Test connection" button. Sends a tiny request and reports
 * exactly what happened, so a misconfigured key / model / endpoint is easy to diagnose.
 */
export async function pingAi(): Promise<{ ok: boolean; detail: string }> {
  const { apiKey, baseUrl, model, timeoutMs } = aiConfig();
  if (apiKey === "") return { ok: false, detail: "No API key is set." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 15000));
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 60,
        // a silly, specific prompt: a canned/fake backend can't produce this, so the reply
        // is proof the real model is generating with this key/endpoint/model.
        messages: [
          {
            role: "user",
            content:
              "In one short, vivid sentence, tell me a surprising fact about octopuses, and begin the sentence with the word BANANA.",
          },
        ],
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status} from ${baseUrl}: ${text.slice(0, 220)}` };
    let reply = "";
    try {
      reply = JSON.parse(text)?.choices?.[0]?.message?.content ?? "";
    } catch {
      /* non-JSON success is unusual but not fatal */
    }
    return { ok: true, detail: `Kimi replied: ${String(reply).trim().slice(0, 160) || "(empty)"}` };
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : "request failed";
    return { ok: false, detail: `Could not reach ${baseUrl} — ${msg}`.slice(0, 220) };
  } finally {
    clearTimeout(timer);
  }
}

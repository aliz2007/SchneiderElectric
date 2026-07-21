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
// Moonshot's strongest general model for writing quality. If an account lacks access the
// Test-connection / export diagnostic shows a 404 and the model can be changed in the app.
const DEFAULT_MODEL = "kimi-k2-0711-preview";

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

const SYSTEM_PROMPT = `You are a senior talent-development consultant writing a thorough, candid capability review of one strategic account manager. Write only from the assessment data provided, as if you have read this person's file.

Grounding rules:
- Use only the data provided. No outside knowledge, stereotypes or assumptions; never invent examples, numbers or quotes.
- Every point must trace to a concrete signal: a score, a gap, an agreement or divergence between lenses, or something an evaluator wrote.
- The capability definitions are given only to help you interpret the scores and comments. Never quote or restate them.

How to read the data. Scale: L1 Developing, L2 Proficient, L3 Advanced. For each capability you get "required" (the level this person's track expects), "panel" (the APEX Panel score, which is the authoritative lens), "self" (their own rating), "manager" (their manager's rating), and "gapVsRequired" (panel minus required). "themeNotes" are the free-text comments the manager and panel wrote per theme; these are your richest signal, so lean on them and reflect their substance.

COMPLETENESS IS MANDATORY. Do not cherry-pick or summarise a handful of highlights.
- In "strength", cover EVERY capability whose panel score meets or exceeds its required level. Omit none.
- In "development", cover EVERY capability whose panel score is below its required level. Omit none.
Long is welcome; never leave a qualifying capability out.

Format "strength" and "development" as a list with one capability per line. Separate the lines with a single newline (\\n). Each line must follow this shape exactly:
- <Capability name> (panel L<x> vs required L<y>): two or three sentences interpreting what this means, drawing on the scores and on the manager and panel comments.
Start every line with "- ". Use only plain letters, numbers and basic punctuation (no bullet symbols, arrows, emojis or accented symbols).

"perception": one flowing paragraph comparing how this person rates themselves against the panel. Cover every capability where self and panel differ by a full level or more, say whether they over- or under-rate, and what it suggests for a development conversation.

Voice: professional, direct and human, constructive but honest. Return ONLY a raw JSON object with exactly these three string keys: {"strength": "...", "development": "...", "perception": "..."}. No markdown, no code fences, no extra text.`;

/**
 * Make model output safe for the base-Helvetica PDF font (WinAnsi). Maps common
 * "smart" punctuation to ASCII and drops anything outside Latin-1, so a stray glyph
 * (emoji, arrow, checkmark, CJK) can never crash the render. Keeps accented letters.
 */
function sanitizeText(s: string): string {
  return s
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•·●▪]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, "")
    .trim();
}

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
  return {
    strength: sanitizeText(strength),
    development: sanitizeText(development),
    perception: sanitizeText(perception),
  };
}

/**
 * Ask Kimi for the three feedback sections. Returns null on any failure so the caller
 * can fall back to the deterministic narrative. Never throws.
 */
export async function generateAiNarrative(input: AiNarrativeInput): Promise<AiNarrativeSections | null> {
  const { apiKey, baseUrl, model, enabled, timeoutMs } = aiConfig();
  if (!enabled) {
    recordAiResult(apiKey === "" ? "not attempted: no API key set" : "not attempted: AI feedback is turned off");
    return null;
  }
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
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
        temperature: 0,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with exactly: connection ok" }],
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
    return { ok: true, detail: `model "${model}" replied: ${String(reply).trim().slice(0, 120) || "(empty)"}` };
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : "request failed";
    return { ok: false, detail: `Could not reach ${baseUrl} — ${msg}`.slice(0, 220) };
  } finally {
    clearTimeout(timer);
  }
}

// Optional AI-written feedback for the PDF narrative page, via Kimi (Moonshot AI,
// OpenAI-compatible chat API). This is an ENHANCEMENT: when the API is reachable and
// returns valid feedback it replaces the deterministic prose; on any error (no key,
// network blocked, bad response, timeout) it returns null and the caller falls back to
// the deterministic narrative, so the PDF always renders.
//
// The API key is hardcoded (see EMBEDDED_KEY below) — no env file, no in-app field.
// The rest have sensible defaults, overridable from the environment if ever needed:
//   MOONSHOT_BASE_URL  — default https://api.moonshot.ai/v1
//   MOONSHOT_MODEL     — default kimi-latest; auto-falls back to moonshot-v1-128k / -32k if the key can't use it
//   MOONSHOT_MAX_TOKENS — default 8000 (room for a full report covering every capability)
//   MOONSHOT_TIMEOUT_MS — default 90000 (a complete report takes a while to write)
//   MOONSHOT_ENABLED=0  — force-disable

import { getSetting, setSetting } from "./queries";

export type AiConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  explicitlyDisabled: boolean;
  timeoutMs: number;
  maxTokens: number;
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
// Try Moonshot's always-current Kimi first (best writing quality, 128k context).
// Not every API key can use every model, so if the configured model is not
// available the call falls through this list and uses — and remembers — the first
// model the key CAN access. All have room for the large prompt plus a full report.
const DEFAULT_MODEL = "kimi-latest";
const FALLBACK_MODELS = ["kimi-latest", "moonshot-v1-128k", "moonshot-v1-32k"];

// The Kimi (Moonshot) API key, hardcoded directly so AI feedback just works:
// no setup, no environment file, no in-app field.
const EMBEDDED_KEY = "sk-ZVEY166shPfyZqQEWjkoICwlOkvb7qFjD9IYYiBhHQmupbUk";

/** The configured model first, then the fallbacks, de-duplicated and non-empty. */
function modelCandidates(configured: string): string[] {
  return [configured, ...FALLBACK_MODELS].filter((m, i, a) => !!m && a.indexOf(m) === i);
}

/** Moonshot answers 404 resource_not_found when the key cannot use a given model. */
function isModelUnavailable(status: number, body: string): boolean {
  return status === 404 && /resource_not_found|not found the model|permission denied/i.test(body);
}

/** Remember the model that actually worked, so later calls skip the probing. */
function rememberModel(model: string) {
  try {
    setSetting("moonshot_model", model);
  } catch {
    /* persistence must never break a render */
  }
}

/** One chat call. Returns the HTTP status + raw body, or an { error } on network/timeout. */
async function moonshotChat(
  cfg: AiConfig,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ status: number; text: string } | { error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model, ...body }),
      signal: controller.signal,
    });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : "request failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve config from the in-app settings first, then the environment, then defaults. */
/** API keys must be plain ASCII to travel in an HTTP header. Strip whitespace and any
 *  non-printable-ASCII characters (bullets, smart quotes, non-breaking spaces) that
 *  commonly sneak in when a key is pasted, so a stray character can never crash the call. */
function cleanKey(raw: string): string {
  return raw.replace(/[^\x21-\x7e]/g, "");
}

export function aiConfig(): AiConfig {
  // Key is fixed: read straight from the hardcoded constant, nothing to configure.
  const apiKey = cleanKey(EMBEDDED_KEY);
  const baseUrl = (process.env.MOONSHOT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  // model is the only stored setting: the auto-fallback remembers whichever model the key can use
  const model = getSetting("moonshot_model") || process.env.MOONSHOT_MODEL || DEFAULT_MODEL;
  const disabled = process.env.MOONSHOT_ENABLED === "0";
  const timeoutMs = Number(process.env.MOONSHOT_TIMEOUT_MS) || 90000;
  const maxTokens = Number(process.env.MOONSHOT_MAX_TOKENS) || 8000;
  return {
    apiKey,
    baseUrl,
    model,
    enabled: !disabled && apiKey !== "",
    explicitlyDisabled: disabled,
    timeoutMs,
    maxTokens,
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
    weighted: number | null;
    gapVsRequired: number | null;
  }[];
  themeNotes: { lens: string; cluster: string; note: string }[];
  // definitions are for interpretation only; the model is told never to quote them
  definitions: { name: string; level: number; text: string }[];
};

export type AiNarrativeSections = { strengths: string; development: string; comments: string };

const SYSTEM_PROMPT = `You are a senior talent-development consultant writing the narrative page of a confidential APEX TOP 25 capability report for one Schneider Electric Strategic Account Manager (AM). Write only from the assessment data provided. This page is the person's actual written feedback, so it must EXPLAIN, not just label: say what the pattern is, why it matters for running a strategic account, what evidence backs it, and what to do about it. Aim for roughly 500-700 words across the three fields - substantial and specific, never padded, and never a restatement of the scores as a list or table.

## The data (one person, JSON)
- amName; track (Acquisition or Saturation). Refer to the person by their first name or as they/them; never guess gender or pronouns from the name. Invent no other detail about them.
- capabilities[]: name; cluster; required (the level the track expects); self (their own rating); manager (their manager's rating); panel (the APEX Panel score); weighted (the AUTHORITATIVE score: Self 20% + APEX Panel 35% + Manager 45%, re-normalised over the lenses that submitted); gapVsRequired (weighted minus required, a decimal).
- themeNotes[]: the written justification an evaluator gave for a cluster, each tagged by lens (Manager, APEX Panel, or Self-Assessment) and cluster. Manager and APEX Panel notes are free text. A Self-Assessment note is a concrete example the person gives to justify their ratings (they are prompted to cover situation, actions taken, results, impact and, where relevant, replication), so it reads as their own evidence for the levels they picked; mine it for concrete situations and outcomes but treat it as their perspective, not the verdict. These are the only "comments" that exist. If this array is empty, there are no comments.
- definitions[]: rubric anchors, for your interpretation only - never quote, paraphrase closely, or restate them.

Scale: L1 Developing, L2 Proficient, L3 Advanced. The WEIGHTED score is authoritative and is a decimal (e.g. 2.35); required is the bar. Refer to it in plain words ("just short of the bar", "comfortably above Proficient") rather than parroting decimals in every sentence, but never round it to a single level when the distinction matters.

## Sort every capability (strict)
- weighted > required (STRICTLY above) -> STRENGTH.
- weighted < required -> DEVELOPMENT area.
- weighted EQUAL to required -> AT THE BASELINE: the person meets the bar, but this is NOT a strength. Never list an at-level capability as a strength; you may note briefly that a cluster sits solidly on the baseline.
Classify a capability only when it has both a weighted and a required value. Never move a capability to make the story flow.

## strengths and development: organise BY CLUSTER
Write BOTH fields as one short paragraph per capability CLUSTER, taking the clusters in the order they appear in the data. The clusters are: Account Strategy & Planning; Commercial & Sales Excellence; Executive & Customer Leadership; Offer, Segment & Solution Expertise; Acquisition Excellence; Saturation Excellence.
- In "strengths", write one paragraph for each cluster that has at least one capability STRICTLY ABOVE its required level (a capability merely at the required level does not qualify). In "development", one paragraph for each cluster that has at least one capability below its required level. Skip a cluster in a field where it has nothing to say.
- BEGIN EACH PARAGRAPH WITH THE EXACT CLUSTER NAME FOLLOWED BY A COLON, for example: "Executive & Customer Leadership: ...". Then, in four to six substantive sentences, give a reasoned read of that cluster: name the qualifying capabilities, explain what the pattern across them shows about how this person runs their account, bring in the manager and self views where they corroborate or contrast with the panel, and draw on that cluster's themeNotes for concrete evidence of the why. In development paragraphs, also say what closing the gap would look like in practice - the observable behaviour that would move the level, grounded in the definitions (paraphrased into advice, never quoted).
- Name every qualifying capability, and never use a "(panel Lx vs required Ly)" tag. Reference a level in plain words (Proficient, Advanced, a level short of the bar) where it sharpens a point.
- Separate the cluster paragraphs with a blank line. Substance over volume: every sentence must carry an observation, an explanation or a recommendation - if it merely restates a score, cut it.

## comments
A SINGLE flowing paragraph, four to six sentences, that synthesises what the evaluators actually wrote in themeNotes across the whole assessment: the themes their comments return to, where the Manager and the APEX Panel agree or differ, and what a Self-Assessment note adds as the person's own view. Draw ONLY on themeNotes; do not restate the scores here, and weigh a Self-Assessment note as the person's perspective, not as the verdict. Where the three lenses disagree, say so - the weighting means the manager's view carries the most and the self view the least.
- If themeNotes is empty, return an empty string "" for comments. Never invent a comment or a commenter.

## Grounding (non-negotiable)
Use only the provided data - no invented examples, quotes, numbers, deals, clients or outside knowledge, and no generic coaching platitudes. Every point must trace to a score, the gap to required, an agreement or divergence between the self / manager / panel lenses, or a themeNote. Never restate the definitions. The weighted score is the verdict.

## Output contract (non-negotiable)
Return ONE raw JSON object with exactly these three string keys: "strengths", "development", "comments". No markdown, no code fences, no text outside the JSON object, and no other keys. Full sentences and paragraphs only; the ONLY structure is the "Cluster Name:" lead on each strengths and development paragraph - never begin a line with a dash, bullet, asterisk or number. Use plain ASCII punctuation (straight quotes and apostrophes, a hyphen for any dash; accented letters in a name are fine). If a whole bucket is empty, write one short honest sentence for that field instead of leaving it blank - for strengths, that the panel does not yet place this person at or above the bar on any capability; for development, that no capability currently sits below the bar. Comments may be empty only as described above.`;

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

/**
 * Best-effort repair of the almost-JSON a model sometimes returns. Two things go
 * wrong in practice: a raw control character (a literal newline or tab) left
 * unescaped inside a string value, and a reply cut off by the token limit that
 * leaves a string and its enclosing braces unterminated. This walks the text
 * once, escaping stray control characters inside strings and closing whatever
 * string / object / array is still open at the end, so a long or slightly
 * malformed report still parses.
 */
function repairJson(raw: string): string {
  let out = "";
  let inStr = false;
  let escaped = false;
  const stack: string[] = [];
  for (const ch of raw) {
    if (inStr) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === "\\") {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inStr = false;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        out += "\\r";
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      out += ch;
    } else if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      out += ch;
    } else if (ch === "}" || ch === "]") {
      if (stack.length) stack.pop();
      out += ch;
    } else {
      out += ch;
    }
  }
  // finish anything a cut-off reply left open
  if (inStr) {
    if (escaped) out = out.slice(0, -1); // drop a dangling backslash
    out += '"';
  }
  while (stack.length) out += stack.pop();
  return out;
}

function extractSections(content: string): AiNarrativeSections | null {
  const tryParse = (raw: string) => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const trimmed = content.trim();
  // 1) straight parse  2) the first {...} block  3) repaired: escape stray control
  //    characters and close a reply a token limit cut off, so a long report still lands
  let obj = tryParse(trimmed);
  if (!obj) {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj) {
    const start = trimmed.indexOf("{");
    if (start >= 0) obj = tryParse(repairJson(trimmed.slice(start)));
  }
  if (!obj) return null;
  const { strengths, development, comments } = obj as Record<string, unknown>;
  // strengths & development must carry content; comments may be empty (no notes were written)
  if (
    typeof strengths !== "string" ||
    typeof development !== "string" ||
    typeof comments !== "string" ||
    !strengths.trim() ||
    !development.trim()
  ) {
    return null;
  }
  return {
    strengths: sanitizeText(strengths),
    development: sanitizeText(development),
    comments: sanitizeText(comments),
  };
}

/**
 * Ask Kimi for the three feedback sections. Returns null on any failure so the caller
 * can fall back to the deterministic narrative. Never throws.
 */
export async function generateAiNarrative(input: AiNarrativeInput): Promise<AiNarrativeSections | null> {
  const cfg = aiConfig();
  const { apiKey, baseUrl, model, enabled, timeoutMs, maxTokens } = cfg;
  if (!enabled) {
    recordAiResult(apiKey === "" ? "not attempted: no API key set" : "not attempted: AI feedback is turned off");
    return null;
  }
  const body = {
    temperature: 0.65,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: "Assessment data (JSON):\n" + JSON.stringify(input) },
    ],
  };

  // Try the configured model, then fall through the fallbacks if the key can't use it.
  const candidates = modelCandidates(model);
  const tried: string[] = [];
  for (const m of candidates) {
    tried.push(m);
    const r = await moonshotChat(cfg, m, body, timeoutMs);
    if ("error" in r) {
      // a network/timeout failure won't be fixed by trying another model
      recordAiResult(`request failed (model ${m}): ${r.error}`.slice(0, 200));
      return null;
    }
    if (isModelUnavailable(r.status, r.text)) continue; // this key can't use m — try the next
    if (r.status < 200 || r.status >= 300) {
      recordAiResult(`HTTP ${r.status} from ${baseUrl} (model ${m}): ${r.text.slice(0, 160)}`);
      return null;
    }
    let content: unknown;
    try {
      content = (JSON.parse(r.text) as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
        ?.content;
    } catch {
      content = undefined;
    }
    if (typeof content !== "string") {
      recordAiResult(`unexpected response shape (model ${m}): ${r.text.slice(0, 160)}`);
      return null;
    }
    const sections = extractSections(content);
    if (!sections) {
      const head = content.slice(0, 90).replace(/\s+/g, " ");
      const tail = content.slice(-60).replace(/\s+/g, " ");
      recordAiResult(`model ${m} replied but the JSON did not parse (length ${content.length}). starts: ${head} ... ends: ${tail}`);
      return null;
    }
    if (m !== model) rememberModel(m);
    recordAiResult(`OK — Kimi wrote the feedback (model ${m}${m !== model ? `, auto-selected because ${model} was unavailable` : ""})`);
    return sections;
  }
  recordAiResult(`no usable model — this key cannot access any of: ${tried.join(", ")}. Set the model in AI settings to one your Moonshot key allows.`);
  return null;
}

/**
 * General-purpose chat call, used by the in-app APEX Assistant. Same hardcoded key
 * and the same model auto-fallback as the PDF narrative. Returns the reply text,
 * or a plain-English error the caller can surface.
 */
export async function kimiChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ ok: true; content: string; model: string } | { ok: false; error: string }> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: false, error: "AI is turned off on this server." };
  const body = {
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 1500,
    messages,
  };
  const candidates = modelCandidates(cfg.model);
  const tried: string[] = [];
  for (const m of candidates) {
    tried.push(m);
    const r = await moonshotChat(cfg, m, body, cfg.timeoutMs);
    if ("error" in r) return { ok: false, error: r.error };
    if (isModelUnavailable(r.status, r.text)) continue; // this key can't use m — try the next
    if (r.status < 200 || r.status >= 300) return { ok: false, error: `HTTP ${r.status}: ${r.text.slice(0, 160)}` };
    let content: unknown;
    try {
      content = (JSON.parse(r.text) as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message
        ?.content;
    } catch {
      content = undefined;
    }
    if (typeof content !== "string" || !content.trim()) return { ok: false, error: "the model returned an empty reply" };
    if (m !== cfg.model) rememberModel(m);
    return { ok: true, content: content.trim(), model: m };
  }
  return { ok: false, error: `no usable model — this key cannot access any of: ${tried.join(", ")}` };
}

/**
 * Live check used by the "Test connection" button. Sends a tiny request and reports
 * exactly what happened, so a misconfigured key / model / endpoint is easy to diagnose.
 */
export async function pingAi(): Promise<{ ok: boolean; detail: string }> {
  const cfg = aiConfig();
  const { apiKey, baseUrl, model, timeoutMs } = cfg;
  if (apiKey === "") return { ok: false, detail: "No API key is set." };
  const body = {
    temperature: 0,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with exactly: connection ok" }],
  };
  const timeout = Math.min(timeoutMs, 20000);
  const candidates = modelCandidates(model);
  const tried: string[] = [];
  let networkErr = "";
  for (const m of candidates) {
    tried.push(m);
    const r = await moonshotChat(cfg, m, body, timeout);
    if ("error" in r) {
      networkErr = r.error;
      break; // network/timeout — another model won't help
    }
    if (isModelUnavailable(r.status, r.text)) continue; // try the next model
    if (r.status < 200 || r.status >= 300) {
      return { ok: false, detail: `HTTP ${r.status} from ${baseUrl} (model ${m}): ${r.text.slice(0, 200)}` };
    }
    let reply = "";
    try {
      reply = JSON.parse(r.text)?.choices?.[0]?.message?.content ?? "";
    } catch {
      /* non-JSON success is unusual but not fatal */
    }
    if (m !== model) rememberModel(m);
    const note = m !== model ? ` — auto-selected and saved, because "${model}" is not available on your key` : "";
    return { ok: true, detail: `model "${m}" replied: ${String(reply).trim().slice(0, 100) || "(empty)"}${note}` };
  }
  if (networkErr) return { ok: false, detail: `Could not reach ${baseUrl} — ${networkErr}`.slice(0, 220) };
  return {
    ok: false,
    detail: `Your Moonshot key cannot access any of these models: ${tried.join(", ")}. Enter a model your key allows in AI settings.`,
  };
}

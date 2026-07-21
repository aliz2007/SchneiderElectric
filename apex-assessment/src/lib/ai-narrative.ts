// Optional AI-written feedback for the PDF narrative page, via Kimi (Moonshot AI,
// OpenAI-compatible chat API). This is an ENHANCEMENT: when the API is reachable and
// returns valid feedback it replaces the deterministic prose; on any error (no key,
// network blocked, bad response, timeout) it returns null and the caller falls back to
// the deterministic narrative, so the PDF always renders.
//
// Config comes from the environment (see apex-assessment/.env.local):
//   MOONSHOT_API_KEY   — required to enable AI feedback
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
  const apiKey = cleanKey(getSetting("moonshot_api_key") ?? process.env.MOONSHOT_API_KEY ?? "");
  const baseUrl = (
    getSetting("moonshot_base_url") ||
    process.env.MOONSHOT_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const model = getSetting("moonshot_model") || process.env.MOONSHOT_MODEL || DEFAULT_MODEL;
  const enabledSetting = getSetting("moonshot_enabled");
  const disabled = enabledSetting === "0" || (enabledSetting == null && process.env.MOONSHOT_ENABLED === "0");
  const timeoutMs = Number(getSetting("moonshot_timeout_ms") || process.env.MOONSHOT_TIMEOUT_MS) || 90000;
  const maxTokens = Number(getSetting("moonshot_max_tokens") || process.env.MOONSHOT_MAX_TOKENS) || 8000;
  return {
    apiKey,
    baseUrl,
    model,
    enabled: !disabled && apiKey !== "",
    explicitlyDisabled: enabledSetting === "0",
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
    gapVsRequired: number | null;
  }[];
  themeNotes: { lens: string; cluster: string; note: string }[];
  // definitions are for interpretation only; the model is told never to quote them
  definitions: { name: string; level: number; text: string }[];
};

export type AiNarrativeSections = { strength: string; development: string; perception: string };

const SYSTEM_PROMPT = `You are a senior executive coach and talent-development consultant writing the narrative page of a confidential talent report for Schneider Electric's APEX TOP 25 program, which assesses Strategic Account Managers (AMs). You are briefing an executive sponsor on ONE Account Manager, working only from that person's assessment data. Write the way a coach who genuinely knows this person would brief the room: warm, precise, honest, and argued in connected prose - never a scorecard read aloud.

## The data you receive (one person, as JSON)
- amName - the Account Manager. Use their first name to ground the writing, then refer to them naturally by name or as they/them. Do not guess gender or pronouns from the name. Invent no surname, title, or any other detail.
- track - Acquisition or Saturation. This is the game this person is being asked to play. Let it colour how you frame every strength and every gap; the same score can mean different things on different tracks, so name that where it sharpens a point.
- capabilities[] - each has: name; cluster (the theme it belongs to); required (the level this track expects); self (their own rating); manager (their manager's rating); panel (the APEX Panel score - the authoritative verdict); gapVsRequired (panel minus required).
- themeNotes[] - free-text comments the Manager and the APEX Panel wrote, each tagged by lens (who wrote it) and cluster. A note is keyed to a cluster, not a single capability, so read it as the reasoning behind every capability in that cluster. These are your richest evidence: mine them for the WHY behind a score.
- definitions[] - rubric anchors, provided only so you can interpret the scores. Never quote them, paraphrase them closely, or restate them as a definition.

Scale: L1 = Developing, L2 = Proficient, L3 = Advanced. The panel score is the truth you write from; required is the threshold this person must clear.

## Sorting every capability (strict)
- panel >= required (this includes panel EQUAL to required) -> the capability is a STRENGTH.
- panel < required -> the capability is a DEVELOPMENT area.
A capability sitting exactly at its required level is a strength, not a gap - never demote an at-level capability into development or perception to make the story flow. Classify a capability only when it has both a panel and a required value; if either is missing, do not force it into a bucket, and you may note in a clause that it is not yet scored. Never move, soften, or drop a capability because it complicates the argument.

## What each field must accomplish
- strength - covers EVERY capability whose panel >= required. Omit none.
- development - covers EVERY capability whose panel < required. Omit none.
- perception - how this person sees themselves versus the Panel, centred on the capabilities where self and panel diverge by a full level or more (absolute difference of 1 or more). Ignore any capability missing a self or panel score.

## Voice - this is the whole point of the rewrite
The version we are replacing listed one capability per line in an identical shape, each stamped with a tag like "(panel L3 vs required L2)". That is banned. Write flowing, argued paragraphs instead.
- Open each field with a THROUGH-LINE: a sentence or two naming the kind of operator this person is, drawn from the actual pattern in their data. Everything after must serve that argument.
- Group capabilities by their cluster into short thematic paragraphs (roughly three to six sentences). Capabilities in the same cluster belong together, joined by reasoning - what they share, what one makes possible in another, where the pattern bends - not stacked as separate facts.
- Aim for two to four paragraphs per field, more when the number of capabilities warrants it. Being genuinely comprehensive is expected; it is fine to write a lot.
- Name every capability by its exact name, woven in as the subject or object of a real sentence - never as a leading label, a heading, or a roll-call at the end.

## How to keep it human, not a template (apply all of these)
- Convey standing in plain words. Name a level (Developing, Proficient, Advanced) or the relationship to the required bar only when it sharpens the argument - never attach one to every capability. For a fair share of capabilities, lead with the behavioural evidence and let the level stay implicit.
- Vary the architecture of your paragraphs, not just their opening words. Build one around the pattern in the scores, another around the tension between two lenses, another around what the track demands. Do not let any single mould (name the cluster, then the Panel, then the Manager, then a summary) repeat across paragraphs.
- Do not lean on "the bar" (or a near-synonym) as the connective between consecutive clauses, and do not open more than one paragraph or section with the same stock frame such as "The clearest signal is...". Vary how standing is expressed and how paragraphs begin.
- Turn a note's substance into consequence - what it means for this person on this track - rather than restating it near-verbatim. A paraphrase may carry only what the note actually says; do not add a cause, a timeline, a cadence, or a failure mode the note does not state.
- Never wrap a note's wording in quotation marks. You may echo one distinctive phrase inline and unquoted, sparingly; never present it as a quote.
- Lead with the substance of a note rather than announcing who wrote it. Attribute to the Manager or the Panel only when the source, or a difference between the two, is itself the point. Where the two disagree, write from the Panel's view, since it is authoritative - though a Manager-Panel difference can be worth naming.
- Do not enumerate three or more capabilities in a single semicolon- or comma-chained run; when several share one story, split them across two or three argued sentences so no passage reads as a disguised list row.
- Keep dashes sparse - roughly one per paragraph at most.
- If a whole cluster has no themeNotes, say so plainly and rest the case on the scores, rather than inventing a reason.

## Coverage - non-negotiable
Account for every capability before you allow yourself to summarise; brevity must never silently drop one. Before you finish, silently check every capability in the data against your text: confirm each panel>=required capability is named in strength, each panel<required capability is named in development, and each full-level self-vs-panel divergence is addressed in perception. Comprehensiveness beats smoothness; never thin the list to read more cleanly.

## Perception - specifics
Lead with the capabilities where self and panel diverge by a full level or more, distinguishing where the person under-rates themselves (the Panel sees more than they credit - a confidence-building opportunity) from where they over-rate themselves (a recalibration opportunity), and say what each suggests for a development conversation - flagging especially when an over-rated capability is also a development area. Then account for the rest of the picture: name the capabilities where self and panel agree so the calibration inventory is complete and no scored capability is silently left out. State the overall pattern once, then support it; keep it constructive, not judgemental.

## Grounding - non-negotiable
Use only the provided data. Every point must trace to a concrete signal: a score, the gap to required, agreement or divergence between the self / manager / panel lenses, or something an evaluator wrote in themeNotes. Invent nothing - no examples, quotes, numbers, deals, clients, metrics, events, or outside knowledge, and no generic coaching platitudes. Where the notes are silent on a capability, reason from its scores, its cluster, and the track without fabricating detail. Never reproduce or restate the definitions.

## Tone
Warm, direct, human, and professional - a coach who respects both the reader and the person described. Be honest about gaps without being cold or punishing: frame each development area as the next stretch for a capable operator, anchored in what the data actually shows.

## Edge cases
- If a bucket has no qualifying capabilities, do not invent one. Write a graceful sentence or two stating it plainly - for strength, that the Panel does not yet place this person at or above the bar on any capability; for development, that no capability currently sits below its required level. Never return an empty string.
- In perception, if nothing diverges by a full level, say the self-view and the Panel's view are broadly aligned, then name the sharpest of the smaller differences.

## Formatting and output contract - non-negotiable
Return ONE raw JSON object with exactly three string keys: "strength", "development", "perception". Each value is a single string of flowing prose whose thematic paragraphs are separated by a blank line (a "\\n\\n" between paragraphs). Full sentences only: never begin a line with a dash, bullet, asterisk, digit-and-dot, or a "Name:" label - anything list-like is re-rendered as a raw list row and ruins the page. No headings, no markdown, no bold, no bullet characters. Use plain ASCII punctuation: straight quotes and apostrophes, and a hyphen for any dash (accented letters in a name are fine). No text of any kind before or after the JSON object, and no keys other than these three.`;

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

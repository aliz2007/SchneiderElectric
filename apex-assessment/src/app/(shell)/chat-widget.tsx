"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const ADMIN_EXAMPLES = [
  "Quels skill gaps reviennent le plus dans la zone India ?",
  "Does anyone have a perception gap on Pipeline Shaping?",
  "Which assessments are still missing?",
];
const ASSESSOR_EXAMPLES = [
  "How far along are my assessments?",
  "Quelles capacités me restent a noter ?",
];

/**
 * The APEX Assistant: a floating bubble (bottom right) that opens a small chat
 * window. Every question is answered server-side by Kimi over a fresh, role-scoped
 * snapshot of the database — see /api/chat.
 */
export default function ChatWidget({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
      if (data?.reply) {
        setMsgs((m) => [...m, { role: "assistant", content: data.reply! }]);
      } else {
        setError(data?.error ?? `The assistant did not answer (HTTP ${res.status}).`);
      }
    } catch {
      setError("Network error - the assistant could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  const examples = isSuperadmin ? ADMIN_EXAMPLES : ASSESSOR_EXAMPLES;

  return (
    <>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="APEX Assistant">
          <div className="chat-head">
            <div>
              <div className="chat-title">APEX Assistant</div>
              <div className="chat-sub">Answers from the live assessment data</div>
            </div>
            <button className="chat-close" type="button" onClick={() => setOpen(false)} title="Close">
              ×
            </button>
          </div>
          <div className="chat-msgs">
            {msgs.length === 0 && !busy && (
              <div className="chat-empty">
                <p>
                  Ask a quick question about {isSuperadmin ? "the assessment data" : "your assessments"} instead of
                  digging through the pages.
                </p>
                {examples.map((ex) => (
                  <button key={ex} className="chat-example" type="button" onClick={() => send(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === "user" ? "from-user" : "from-bot"}`}>
                {m.content}
              </div>
            ))}
            {busy && <div className="chat-msg from-bot chat-typing">Analyzing…</div>}
            {error && <div className="chat-error">{error}</div>}
            <div ref={endRef} />
          </div>
          <form
            className="chat-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              className="input"
              placeholder="Ask about the data…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
      <button
        className="chat-fab"
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="APEX Assistant"
        aria-label={open ? "Close the APEX Assistant" : "Open the APEX Assistant"}
      >
        {open ? (
          <span style={{ fontSize: 26, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3C7 3 3 6.6 3 11c0 2.2 1 4.2 2.7 5.6-.1 1-.5 2.1-1.4 3.1 1.7-.1 3.1-.6 4.1-1.3.8.2 1.7.4 2.6.4 5 0 9-3.6 9-8s-4-7.8-9-7.8z"
              fill="currentColor"
            />
            <circle cx="8.5" cy="11" r="1.15" fill="#0b1424" />
            <circle cx="12" cy="11" r="1.15" fill="#0b1424" />
            <circle cx="15.5" cy="11" r="1.15" fill="#0b1424" />
          </svg>
        )}
      </button>
    </>
  );
}

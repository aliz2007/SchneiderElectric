"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HELP_ENTRIES, buildTour, type TourAudience, type TourStep } from "@/lib/guide";

/**
 * The question mark, and the two ways of asking it something.
 *
 * TUTORIAL walks the app once, in order, dimming everything except the part it is talking
 * about and waiting to be told to continue. It crosses pages, so its progress lives in
 * sessionStorage: the component is torn down and rebuilt on every navigation, and a tour
 * held in React state would end the moment it moved to the second page.
 *
 * QUESTION MODE stays on until you turn it off and explains whatever the pointer is resting
 * on. It reads the same registry, so the two can never disagree about what a number means.
 */

const TOUR_KEY = "apex_tour";
const ASK_KEY = "apex_ask";

type TourState = { i: number };

export default function HelpTools({ audience }: { audience: TourAudience }) {
  const [menu, setMenu] = useState(false);
  const [tour, setTour] = useState<TourState | null>(null);
  const [asking, setAsking] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const steps = buildTour(audience);

  // Pick both modes back up after a navigation. Reading in an effect rather than in
  // useState's initialiser keeps the first server and client renders identical.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOUR_KEY);
      if (raw) setTour(JSON.parse(raw) as TourState);
      setAsking(sessionStorage.getItem(ASK_KEY) === "1");
    } catch {
      /* private mode, or a value someone hand-edited */
    }
  }, []);

  const persistTour = (next: TourState | null) => {
    setTour(next);
    try {
      if (next) sessionStorage.setItem(TOUR_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(TOUR_KEY);
    } catch {
      /* nothing to do */
    }
  };

  const toggleAsk = (on: boolean) => {
    setAsking(on);
    try {
      if (on) sessionStorage.setItem(ASK_KEY, "1");
      else sessionStorage.removeItem(ASK_KEY);
    } catch {
      /* nothing to do */
    }
  };

  const step = tour ? steps[tour.i] : null;

  // the tour drives the router itself, so a step on another page simply arrives there
  useEffect(() => {
    if (step && step.route !== pathname) router.push(step.route);
  }, [step, pathname, router]);

  return (
    <>
      <div className="help-anchor">
        <button
          type="button"
          className={`help-btn${menu ? " active" : ""}${asking ? " asking" : ""}`}
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-label="Help"
          title="Help"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M7.6 7.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.9.7-.9 1.3v.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="14.4" r="0.95" fill="currentColor" />
          </svg>
        </button>

        {menu && (
          <>
            <div className="help-scrim" onClick={() => setMenu(false)} aria-hidden="true" />
            <div className="help-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="help-item"
                onClick={() => {
                  setMenu(false);
                  toggleAsk(false);
                  persistTour({ i: 0 });
                }}
              >
                <span className="help-item-name">Tutorial mode</span>
                <span className="help-item-blurb">A guided walk through the whole app, one part at a time.</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={`help-item${asking ? " on" : ""}`}
                aria-pressed={asking}
                onClick={() => {
                  setMenu(false);
                  persistTour(null);
                  toggleAsk(!asking);
                }}
              >
                <span className="help-item-name">
                  Question mode
                  <span className={`help-pip${asking ? " on" : ""}`}>{asking ? "on" : "off"}</span>
                </span>
                <span className="help-item-blurb">Point at anything and it explains itself. Stays on until you turn it off.</span>
              </button>
            </div>
          </>
        )}
      </div>

      {step && (
        <Tour
          step={step}
          index={tour!.i}
          total={steps.length}
          onNext={() => persistTour(tour!.i + 1 < steps.length ? { i: tour!.i + 1 } : null)}
          onBack={() => persistTour({ i: Math.max(0, tour!.i - 1) })}
          onQuit={() => persistTour(null)}
          ready={step.route === pathname}
        />
      )}

      {asking && !step && <QuestionMode onQuit={() => toggleAsk(false)} />}
    </>
  );
}

/* ---------------------------------------------------------------- tutorial */

type Rect = { top: number; left: number; width: number; height: number };

function Tour({
  step,
  index,
  total,
  onNext,
  onBack,
  onQuit,
  ready,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onQuit: () => void;
  ready: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [shown, setShown] = useState(false);

  /**
   * Find the target and hold on to where it is.
   *
   * It polls rather than measuring once, because a step often arrives before its page has
   * finished rendering — the tour navigates, this component remounts, and the card it wants
   * to point at may still be a server round-trip away. Polling also keeps the spotlight
   * attached while the entrance animations settle the layout underneath it.
   */
  useEffect(() => {
    setShown(false);
    if (!ready || !step.selector) {
      setRect(null);
      const t = setTimeout(() => setShown(true), 60);
      return () => clearTimeout(t);
    }
    let raf = 0;
    let tries = 0;
    const find = () => {
      const el = document.querySelector(step.selector!);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (!shownOnce.current) {
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            shownOnce.current = true;
          }
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setShown(true);
        }
      } else if (tries > 90) {
        // the selector no longer matches anything; rather than trap somebody behind an
        // invisible spotlight, show the step as a plain card
        setRect(null);
        setShown(true);
        return;
      }
      tries++;
      raf = requestAnimationFrame(find);
    };
    raf = requestAnimationFrame(find);
    return () => cancelAnimationFrame(raf);
  }, [step, ready]);

  const shownOnce = useRef(false);
  useEffect(() => {
    shownOnce.current = false;
  }, [step.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onQuit();
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onQuit]);

  const pad = 8;
  const box = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // sit the card under the highlight when there is room, otherwise above it
  const cardStyle: React.CSSProperties = box
    ? box.top + box.height + 210 < window.innerHeight
      ? { top: box.top + box.height + 14, left: Math.max(16, Math.min(box.left, window.innerWidth - 420)) }
      : { top: Math.max(16, box.top - 200), left: Math.max(16, Math.min(box.left, window.innerWidth - 420)) }
    : {};

  return (
    <div className={`tour${shown ? " in" : ""}`} role="dialog" aria-modal="true" aria-label={step.title}>
      {box ? (
        // one element, one enormous shadow: the hole IS the element, so the spotlight can
        // never drift out of register with what it is meant to be pointing at
        <div className="tour-spot" style={box} />
      ) : (
        <div className="tour-veil" />
      )}

      <div className={`tour-card${box ? "" : " centred"}`} style={cardStyle}>
        <div className="tour-count">
          Step {index + 1} of {total}
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onQuit}>
            Skip the tour
          </button>
          {index > 0 && (
            <button type="button" className="btn btn-sm btn-outline" onClick={onBack}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={onNext}>
            {index + 1 === total ? "Finish" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- question mode */

function QuestionMode({ onQuit }: { onQuit: () => void }) {
  const [hit, setHit] = useState<{ title: string; body: string; x: number; y: number; box: Rect } | null>(null);
  const frame = useRef(0);

  const onMove = useCallback((e: MouseEvent) => {
    if (frame.current) return; // one lookup per frame, not one per mouse event
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return setHit(null);
      if (target.closest(".help-anchor, .qm-tip, .qm-bar")) return; // do not explain itself

      // Every entry the pointer is inside, deepest first — a number inside a card should
      // explain the number, not the card it happens to be sitting in.
      let best: { el: Element; entry: (typeof HELP_ENTRIES)[number]; depth: number } | null = null;
      for (const entry of HELP_ENTRIES) {
        let el: Element | null = null;
        try {
          el = target.closest(entry.sel);
        } catch {
          continue; // a selector this browser cannot parse
        }
        if (!el) continue;
        let depth = 0;
        for (let n: Element | null = el; n; n = n.parentElement) depth++;
        if (!best || depth > best.depth) best = { el, entry, depth };
      }
      if (!best) return setHit(null);
      const r = best.el.getBoundingClientRect();
      setHit({
        title: best.entry.title,
        body: best.entry.body,
        x: e.clientX,
        y: e.clientY,
        box: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
    });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onQuit();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [onMove, onQuit]);

  // keep the card on screen: flip it to the other side of the pointer near an edge
  const W = 320;
  const left = hit ? (hit.x + 18 + W > window.innerWidth ? hit.x - W - 18 : hit.x + 18) : 0;
  const top = hit ? Math.min(hit.y + 16, window.innerHeight - 170) : 0;

  return (
    <>
      <div className="qm-bar" role="status">
        <span className="qm-dot" />
        Question mode — point at anything
        <button type="button" className="qm-off" onClick={onQuit}>
          Turn off
        </button>
      </div>
      {hit && (
        <>
          <div
            className="qm-ring"
            style={{ top: hit.box.top - 3, left: hit.box.left - 3, width: hit.box.width + 6, height: hit.box.height + 6 }}
          />
          <div className="qm-tip" style={{ left, top, width: W }}>
            <div className="qm-tip-title">{hit.title}</div>
            <div className="qm-tip-body">{hit.body}</div>
          </div>
        </>
      )}
    </>
  );
}

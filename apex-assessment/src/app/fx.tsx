"use client";

// Visual FX layer — mounted once in the root layout.
// 1. Cursor spotlight: tracks the pointer over cards via --mx/--my CSS vars.
// 2. Scroll reveal: below-fold cards get .rv and fade up when they enter the viewport.
// 3. Count-up KPIs: .kpi-value leading numbers animate from 0 on page load.
// All motion is skipped under prefers-reduced-motion.

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const REVEAL_SELECTOR = ".card, .banner, .note-block";
const SPOTLIGHT_SELECTOR = ".card, .level-card, .login-card";

export default function Fx() {
  const pathname = usePathname();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(SPOTLIGHT_SELECTOR);
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // reveal-on-scroll — only tag elements that start below the fold, so the
    // server-rendered first paint is never hidden and nothing flashes
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      },
      { threshold: 0.08 }
    );
    for (const el of document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
      if (el.classList.contains("rv")) continue;
      if (el.getBoundingClientRect().top > window.innerHeight - 32) {
        el.classList.add("rv");
        io.observe(el);
      }
    }

    // count-up KPI numbers (leading number of the first text node only)
    const rafs: number[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".kpi-value")) {
      const node = el.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE) continue;
      const match = (node.textContent ?? "").match(/^(\d+(?:\.\d+)?)(.*)$/);
      if (!match) continue;
      const target = parseFloat(match[1]);
      const decimals = match[1].includes(".") ? match[1].split(".")[1].length : 0;
      const suffix = match[2] ?? "";
      const start = performance.now();
      const duration = 600;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = (target * eased).toFixed(decimals) + suffix;
        if (p < 1) rafs.push(requestAnimationFrame(tick));
      };
      rafs.push(requestAnimationFrame(tick));
    }

    return () => {
      io.disconnect();
      rafs.forEach(cancelAnimationFrame);
    };
  }, [pathname]);

  return null;
}

"use client";

import { useEffect, useState } from "react";
import {
  ACCENT_PRESETS,
  SURFACE_PRESETS,
  THEME_PARTS,
  isDefaultColors,
  normalizeAccent,
  themeVars,
  type ThemeColors,
  type ThemePart,
} from "@/lib/dashboard-layout";
import { resetColors, saveColors } from "./dashboard-actions";

/**
 * Colour, one part at a time.
 *
 * You pick WHAT you are colouring first — the accent, the menu bar, the background, the
 * cards — and then the colour. That ordering is the point: "change the app's colour" is
 * usually four different wishes, and a single swatch row cannot express any of them beyond
 * the first.
 *
 * Every change previews on the live page immediately, by writing the same custom properties
 * onto <html> that the server writes on a real load. So you are not judging a swatch in a
 * box, you are watching the app you are sitting in change colour. Leaving without saving
 * puts the saved values back.
 *
 * Result colours are not in this list and never will be. Green means "at or above the
 * required level" and magenta means "the APEX Panel said so"; a dashboard that reported
 * differently depending on a colour setting would be worse than one you could not recolour.
 */
export default function ColourPanel({ colors }: { colors: ThemeColors }) {
  const [draft, setDraft] = useState<ThemeColors>(colors);
  const [part, setPart] = useState<ThemePart>("accent");

  useEffect(() => {
    const root = document.documentElement;
    const applied = themeVars(draft);
    // Clear first: dropping a part back to the default means REMOVING its property, and
    // setting the rest over the top would leave the old one behind.
    for (const k of Object.keys(themeVars(colors))) root.style.removeProperty(k);
    for (const [k, v] of Object.entries(applied)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(applied)) root.style.removeProperty(k);
      for (const [k, v] of Object.entries(themeVars(colors))) root.style.setProperty(k, v);
    };
  }, [draft, colors]);

  const def = THEME_PARTS.find((p) => p.id === part)!;
  const presets = part === "accent" ? ACCENT_PRESETS : SURFACE_PRESETS;
  const current = draft[part] ?? def.fallback;
  const dirty = JSON.stringify(draft) !== JSON.stringify(colors);

  const pick = (hex: string | null) =>
    setDraft((cur) => {
      const next = { ...cur };
      if (hex == null) delete next[part];
      else next[part] = hex;
      return next;
    });

  return (
    <div className="cp">
      <div className="cp-parts" role="tablist" aria-label="What to colour">
        {THEME_PARTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={part === p.id}
            className={`cp-part${part === p.id ? " active" : ""}`}
            onClick={() => setPart(p.id)}
          >
            <span className="cp-chip" style={{ background: draft[p.id] ?? p.fallback }} />
            <span className="cp-part-text">
              <span className="cp-part-name">{p.label}</span>
              <span className="cp-part-blurb">{p.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="cp-picker">
        <div className="cp-swatches">
          {presets.map((s) => (
            <button
              key={s.hex}
              type="button"
              className={`cp-swatch${current.toLowerCase() === s.hex ? " active" : ""}`}
              style={{ background: s.hex }}
              title={s.name}
              aria-label={s.name}
              aria-pressed={current.toLowerCase() === s.hex}
              onClick={() => pick(s.hex)}
            />
          ))}
          <label className="cp-custom" title="Any colour">
            <input
              type="color"
              value={current}
              aria-label={`Custom colour for ${def.label}`}
              onChange={(e) => pick(e.target.value)}
            />
          </label>
          <input
            className="cp-hex"
            type="text"
            spellCheck={false}
            value={current}
            aria-label={`${def.label} colour hex`}
            onChange={(e) => {
              const hex = normalizeAccent(e.target.value);
              if (hex) pick(hex);
            }}
          />
          {draft[part] && (
            <button type="button" className="cp-clear" onClick={() => pick(null)}>
              use the default
            </button>
          )}
        </div>
      </div>

      <div className="cp-actions">
        <form action={saveColors}>
          <input type="hidden" name="colors" value={JSON.stringify(draft)} />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!dirty}>
            Save colours
          </button>
        </form>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(colors)} disabled={!dirty}>
          Discard changes
        </button>
        <form action={resetColors}>
          <button className="btn btn-outline btn-sm" type="submit" disabled={isDefaultColors(colors)}>
            Back to the shipped palette
          </button>
        </form>
      </div>
    </div>
  );
}

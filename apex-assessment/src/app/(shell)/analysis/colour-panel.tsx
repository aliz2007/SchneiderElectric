"use client";

import { useEffect, useState } from "react";
import {
  ACCENT_PRESETS,
  SURFACE_PRESETS,
  THEME_PARTS,
  hexToHsl,
  hslToHex,
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
 * usually four different wishes, and a single swatch row cannot express any of them past
 * the first.
 *
 * The colour itself comes from three wide sliders plus a row of large presets. The native
 * `<input type="color">` is a 30px square that hands you the operating system's own dialog:
 * a different thing on every machine, and close to unusable on a trackpad. Hue, saturation
 * and lightness reach the same colours with targets you can hit, and they stay inside the
 * app, so what you are dragging is the app changing colour rather than a chip in a box.
 *
 * Everything previews live by writing the same custom properties the server writes on a real
 * load. Leaving without saving puts the saved values back.
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
    // Clear first: dropping a part back to its default means REMOVING that property, and
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
  const current = (draft[part] ?? def.fallback).toLowerCase();
  const [h, s, l] = hexToHsl(current);
  const dirty = JSON.stringify(draft) !== JSON.stringify(colors);
  const custom = draft[part] != null;

  const pick = (hex: string | null) =>
    setDraft((cur) => {
      const next = { ...cur };
      if (hex == null) delete next[part];
      else next[part] = hex.toLowerCase();
      return next;
    });

  const slide = (nh: number, ns: number, nl: number) => pick(hslToHex(nh, ns, nl));

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

      <div className="cp-editor">
        <div className="cp-preview" style={{ background: current }}>
          <span className="cp-preview-name">{def.label}</span>
          <span className="cp-preview-hex">{current}</span>
        </div>

        <div className="cp-sliders">
          <label className="cp-slider">
            <span className="cp-slider-label">Hue</span>
            <input
              type="range"
              min={0}
              max={360}
              value={h}
              aria-label={`${def.label} hue`}
              onChange={(e) => slide(Number(e.target.value), s, l)}
              style={{
                // the track shows what you are choosing from, not a grey bar
                background:
                  "linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)",
              }}
            />
          </label>
          <label className="cp-slider">
            <span className="cp-slider-label">Intensity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={s}
              aria-label={`${def.label} saturation`}
              onChange={(e) => slide(h, Number(e.target.value), l)}
              style={{ background: `linear-gradient(90deg, ${hslToHex(h, 0, l)}, ${hslToHex(h, 100, l)})` }}
            />
          </label>
          <label className="cp-slider">
            <span className="cp-slider-label">Lightness</span>
            <input
              type="range"
              min={0}
              max={100}
              value={l}
              aria-label={`${def.label} lightness`}
              onChange={(e) => slide(h, s, Number(e.target.value))}
              style={{
                background: `linear-gradient(90deg, #000, ${hslToHex(h, s, 50)}, #fff)`,
              }}
            />
          </label>
          <div className="cp-hexrow">
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
            {custom && (
              <button type="button" className="cp-clear" onClick={() => pick(null)}>
                use the default
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cp-swatches" role="group" aria-label={`Suggested colours for ${def.label}`}>
        {presets.map((sw) => (
          <button
            key={sw.hex}
            type="button"
            className={`cp-swatch${current === sw.hex ? " active" : ""}`}
            style={{ background: sw.hex }}
            title={sw.name}
            aria-label={sw.name}
            aria-pressed={current === sw.hex}
            onClick={() => pick(sw.hex)}
          />
        ))}
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

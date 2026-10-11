import type { BadgeTheme } from "./types";

export const DEFAULT_THEME: Readonly<BadgeTheme> = Object.freeze({
  bg: "#667eea",
  text: "#ffffff",
});

/**
 * Ready-made colour pairs. Every pair keeps text at 4.5:1 or better against its background
 * (WCAG AA); a test enforces that, so a pretty-but-unreadable preset can't slip in.
 */
export const PRESETS: ReadonlyArray<BadgeTheme & { label: string }> = [
  { label: "Indigo", bg: "#4f46e5", text: "#ffffff" },
  { label: "Violet", bg: "#7c3aed", text: "#ffffff" },
  { label: "Azure", bg: "#1a73e8", text: "#ffffff" },
  { label: "Teal", bg: "#0f766e", text: "#ffffff" },
  { label: "Forest", bg: "#15803d", text: "#ffffff" },
  { label: "Rose", bg: "#e11d48", text: "#ffffff" },
  { label: "Graphite", bg: "#27272a", text: "#fafafa" },
  { label: "Ember", bg: "#c2410c", text: "#ffffff" },
  { label: "Amber", bg: "#fbbf24", text: "#1c1304" },
  { label: "Sky", bg: "#7dd3fc", text: "#082f49" },
  { label: "Blossom", bg: "#f9a8d4", text: "#500724" },
  { label: "Lime", bg: "#bef264", text: "#1a2e05" },
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

/** Returns a theme made only of valid colours; invalid or missing parts fall back to `fallback`. */
export function sanitizeTheme(
  input: Partial<BadgeTheme> | null | undefined,
  fallback: BadgeTheme = DEFAULT_THEME,
): BadgeTheme {
  return {
    bg: isValidColor(input?.bg) ? input.bg.trim() : fallback.bg,
    text: isValidColor(input?.text) ? input.text.trim() : fallback.text,
  };
}

/** `#abc` -> `#aabbcc`; `<input type="color">` only accepts the six-digit form. */
export function toSixDigitHex(value: string): string {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return "#" + [...v.slice(1)].map((c) => c + c).join("");
  return v;
}

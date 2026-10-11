import type { BadgeTheme } from "./types";

export const DEFAULT_THEME: Readonly<BadgeTheme> = Object.freeze({
  bg: "#667eea",
  text: "#ffffff",
});

export const PRESETS: ReadonlyArray<BadgeTheme & { label: string }> = [
  { label: "Indigo Bloom", bg: "#5a67d8", text: "#f7f8ff" },
  { label: "Lime Glow", bg: "#1db954", text: "#fdfdf4" },
  { label: "Sunset Ember", bg: "#fe5f55", text: "#fff3e0" },
  { label: "Midnight Frost", bg: "#2d3246", text: "#f2f4ff" },
  { label: "Aurora Mist", bg: "#50c6c8", text: "#0c1a1b" },
  { label: "Copper Pulse", bg: "#d97706", text: "#1f1d1b" },
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

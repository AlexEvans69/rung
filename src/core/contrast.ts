import { toSixDigitHex } from "./theme";

/** WCAG relative luminance of a `#rgb`/`#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const h = toSixDigitHex(hex);
  const channel = (i: number) => {
    const v = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The lowest contrast at which white text is still preferred over a better-reading dark one. */
const WHITE_PREFERRED_FROM = 3;

/**
 * Text colour for a badge background. White is preferred as long as it stays readable
 * (that keeps the classic #667eea + white look); only when it would not, near-black is
 * used if it reads better.
 */
export function bestTextColor(background: string): "#ffffff" | "#111111" {
  const white = contrastRatio(background, "#ffffff");
  if (white >= WHITE_PREFERRED_FROM) return "#ffffff";
  return contrastRatio(background, "#111111") > white ? "#111111" : "#ffffff";
}

export type ContrastGrade = "AAA" | "AA" | "large" | "poor";

export function gradeContrast(ratio: number): ContrastGrade {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "large";
  return "poor";
}

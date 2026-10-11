import { describe, expect, it } from "vitest";
import { contrastRatio } from "../src/core/contrast";
import { DEFAULT_THEME, PRESETS, isValidColor, sanitizeTheme, toSixDigitHex } from "../src/core/theme";

describe("PRESETS", () => {
  it("has twelve uniquely named presets with valid colours", () => {
    expect(PRESETS).toHaveLength(12);
    expect(new Set(PRESETS.map((p) => p.label)).size).toBe(12);
    for (const p of PRESETS) {
      expect(isValidColor(p.bg)).toBe(true);
      expect(isValidColor(p.text)).toBe(true);
    }
  });

  it.each(PRESETS.map((p) => [p.label, p] as const))("%s keeps text at WCAG AA (4.5:1) or better", (_label, p) => {
    expect(contrastRatio(p.bg, p.text)).toBeGreaterThanOrEqual(4.5);
  });

  it("has no two identical colour pairs", () => {
    const pairs = PRESETS.map((p) => `${p.bg}/${p.text}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe("colour helpers", () => {
  it("validates hex colours only", () => {
    for (const ok of ["#fff", "#FFFFFF", "#667eea"]) expect(isValidColor(ok)).toBe(true);
    for (const bad of ["fff", "#ffff", "red", "url(x)", "#12345g", "", null, 3]) expect(isValidColor(bad)).toBe(false);
  });

  it("sanitises a theme part by part", () => {
    expect(sanitizeTheme({ bg: "nope", text: "#000" })).toEqual({ bg: DEFAULT_THEME.bg, text: "#000" });
  });

  it("expands short hex for colour inputs", () => {
    expect(toSixDigitHex("#abc")).toBe("#aabbcc");
    expect(toSixDigitHex("#AABBCC")).toBe("#aabbcc");
  });
});

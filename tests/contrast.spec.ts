import { describe, expect, it } from "vitest";
import { bestTextColor, contrastRatio, gradeContrast, relativeLuminance } from "../src/core/contrast";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  it("is symmetric and understands short hex", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(contrastRatio("#000000", "#ffffff"), 5);
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000")).toBeCloseTo(0, 5);
  });

  it("picks readable text for light and dark backgrounds", () => {
    expect(bestTextColor("#667eea")).toBe("#ffffff");
    expect(bestTextColor("#ffeb3b")).toBe("#111111");
    expect(bestTextColor("#000000")).toBe("#ffffff");
    expect(bestTextColor("#ffffff")).toBe("#111111");
  });

  it("grades ratios", () => {
    expect(gradeContrast(8)).toBe("AAA");
    expect(gradeContrast(4.5)).toBe("AA");
    expect(gradeContrast(3.2)).toBe("large");
    expect(gradeContrast(2)).toBe("poor");
  });
});

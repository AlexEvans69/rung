import { beforeEach, describe, expect, it } from "vitest";
import { detectPageTheme } from "../src/core/pageTheme";

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
});

describe("detectPageTheme", () => {
  it("reads a declared dark colour scheme", () => {
    document.documentElement.style.colorScheme = "dark";
    expect(detectPageTheme(document)).toBe("dark");
  });

  it("reads a declared light colour scheme", () => {
    document.documentElement.style.colorScheme = "light";
    document.body.style.backgroundColor = "#000";
    expect(detectPageTheme(document)).toBe("light");
  });

  it("falls back to the page background", () => {
    document.body.style.backgroundColor = "rgb(32, 33, 36)";
    expect(detectPageTheme(document)).toBe("dark");
    document.body.style.backgroundColor = "rgb(255, 255, 255)";
    expect(detectPageTheme(document)).toBe("light");
  });

  it("defaults to light when nothing is known", () => {
    expect(detectPageTheme(document)).toBe("light");
  });
});

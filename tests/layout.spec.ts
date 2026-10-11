import { describe, expect, it } from "vitest";
import {
  BADGE_GAP,
  CARD_MAX_WIDTH,
  RAIL_GAP,
  computeRail,
  firstLineCenter,
  sameGeometry,
} from "../src/core/layout";

const box = (left: number, right: number) => ({ left, right, top: 0, bottom: 100 });

describe("computeRail", () => {
  it("returns null without results", () => {
    expect(computeRail([], 1000)).toBeNull();
  });

  it("puts the badge rail left of the column and the note rail right of it", () => {
    const rail = computeRail([box(160, 812), box(160, 700)], 1280)!;
    expect(rail.badgeRight).toBe(160 - BADGE_GAP);
    expect(rail.x).toBe(812 + RAIL_GAP);
  });

  it("uses the widest result so results of different widths share one column", () => {
    const narrow = computeRail([box(100, 500), box(100, 700), box(100, 520)], 1200)!;
    expect(narrow.x).toBe(700 + RAIL_GAP);
  });

  it("shows the card with the available width, capped", () => {
    expect(computeRail([box(100, 600)], 1500)!).toMatchObject({ mode: "card", width: CARD_MAX_WIDTH });
    expect(computeRail([box(100, 600)], 600 + RAIL_GAP + 180 + 8)!).toMatchObject({ mode: "card", width: 180 });
  });

  it("falls back from card to chip to icon to inset as room shrinks", () => {
    const at = (free: number) => computeRail([box(100, 600)], 600 + RAIL_GAP + free + 8)!.mode;
    expect(at(150)).toBe("card");
    expect(at(149)).toBe("chip");
    expect(at(64)).toBe("chip");
    expect(at(63)).toBe("icon");
    expect(at(30)).toBe("icon");
    expect(at(29)).toBe("inset");
    expect(at(-50)).toBe("inset");
  });

  it("keeps the inset control inside the column", () => {
    const rail = computeRail([box(100, 600)], 610)!;
    expect(rail.mode).toBe("inset");
    expect(rail.x + rail.width).toBeLessThanOrEqual(600);
  });

  it("never pushes the badge off the left edge of the window", () => {
    const rail = computeRail([box(10, 400)], 1000)!;
    expect(rail.badgeRight).toBeGreaterThanOrEqual(54);
  });
});

describe("firstLineCenter", () => {
  it("centres on the first line of a multi-line title", () => {
    expect(firstLineCenter(100, 78, 26)).toBe(113);
  });

  it("uses the whole height for a single line or unknown line height", () => {
    expect(firstLineCenter(100, 26, 26)).toBe(113);
    expect(firstLineCenter(100, 30, null)).toBe(115);
    expect(firstLineCenter(100, 20, 40)).toBe(110);
  });
});

describe("sameGeometry", () => {
  const g = { titleY: 10, badgeX: -12, railX: 700, roomY: 80 };
  it("ignores sub-pixel noise", () => {
    expect(sameGeometry(g, { ...g, titleY: 10.3 })).toBe(true);
  });
  it("detects real movement and a missing previous value", () => {
    expect(sameGeometry(g, { ...g, railX: 702 })).toBe(false);
    expect(sameGeometry(null, g)).toBe(false);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_RESULTS, serpPage, type PageOpts } from "./fixtures";

const BUNDLE = readFileSync(resolve(process.cwd(), "dist/contentScript.js"), "utf8");

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Snapshot {
  badges: (Rect & { text: string })[];
  notes: Rect[];
  titles: Rect[];
  mode: string | null;
}

async function open(page: Page, opts: PageOpts = {}): Promise<{ before: Rect[] }> {
  await page.setContent(serpPage(opts));
  const before = await pageBoxes(page);
  await page.addScriptTag({ content: BUNDLE });
  await page.waitForSelector("serp-counter-host", { state: "attached" });
  await settle(page);
  return { before };
}

/** Two animation frames, so a debounced scan plus the following layout pass have run. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(250);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Boxes of everything Google itself renders; they must not move when we inject. */
function pageBoxes(page: Page): Promise<Rect[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("header, [data-hveid], h3, .VwiC3b, .thumb, #rhs")].map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
}

function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const rect = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const hosts = [...document.querySelectorAll("serp-counter-host")];
    const badges = hosts.flatMap((h) => {
      const b = h.shadowRoot?.querySelector(".badge");
      return b ? [{ ...rect(b), text: b.textContent?.trim() ?? "" }] : [];
    });
    const notes = hosts.flatMap((h) => {
      const b = h.shadowRoot?.querySelector(".rail .chip, .rail .card-head");
      return b ? [rect(b)] : [];
    });
    const titles = [...document.querySelectorAll("h3")]
      .filter((h) => !h.closest("[data-initq]"))
      .map((h) => {
        const r = h.getBoundingClientRect();
        const lh = Number.parseFloat(getComputedStyle(h).lineHeight);
        return { x: r.x, y: r.y, w: r.width, h: Math.min(lh, r.height) };
      });
    const mode = hosts[0]?.shadowRoot?.querySelector(".rail")?.className.match(/mode-(\w+)/)?.[1] ?? null;
    return { badges, notes, titles, mode };
  });
}

const cy = (r: Rect) => r.y + r.h / 2;

function expectAligned(s: Snapshot, count: number): void {
  expect(s.badges).toHaveLength(count);
  expect(s.notes).toHaveLength(count);
  expect(s.titles).toHaveLength(count);

  // one vertical line for the badges (right edge) and one for the notes
  const badgeRight = s.badges.map((b) => b.x + b.w);
  expect(Math.max(...badgeRight) - Math.min(...badgeRight)).toBeLessThan(0.6);
  const noteX = s.notes.map((n) => n.x);
  expect(Math.max(...noteX) - Math.min(...noteX)).toBeLessThan(0.6);

  s.titles.forEach((title, i) => {
    // badge and note are level with the first line of their title, and with each other
    expect(Math.abs(cy(s.badges[i]!) - cy(title))).toBeLessThan(1);
    expect(Math.abs(cy(s.notes[i]!) - cy(title))).toBeLessThan(1);
  });
}

test.describe("rails", () => {
  test("badges and notes sit on two straight lines, level with the titles", async ({ page }) => {
    await open(page);
    const s = await snapshot(page);
    expectAligned(s, DEFAULT_RESULTS.length);
    expect(s.mode).toBe("card");
  });

  test("numbers are consecutive", async ({ page }) => {
    await open(page);
    const s = await snapshot(page);
    expect(s.badges.map((b) => b.text)).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("the badge keeps its 54x26 pill size", async ({ page }) => {
    await open(page);
    const s = await snapshot(page);
    for (const b of s.badges) {
      expect(Math.round(b.w)).toBe(54);
      expect(Math.round(b.h)).toBe(26);
    }
  });

  test("injecting never moves anything Google rendered", async ({ page }) => {
    const { before } = await open(page);
    const after = await pageBoxes(page);
    expect(after).toEqual(before);
  });

  test("works when result containers are positioned elements", async ({ page }) => {
    const { before } = await open(page, { positionedResults: true });
    expectAligned(await snapshot(page), DEFAULT_RESULTS.length);
    expect(await pageBoxes(page)).toEqual(before);
  });

  test("dark pages align the same way", async ({ page }) => {
    await open(page, { dark: true });
    expectAligned(await snapshot(page), DEFAULT_RESULTS.length);
  });

  test("results with and without thumbnails share one note column", async ({ page }) => {
    await open(page);
    const s = await snapshot(page);
    // the fixture really has results of different widths
    const widths = await page.evaluate(() => [...document.querySelectorAll("[data-hveid]")].map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBeGreaterThan(1);
    expect(new Set(s.notes.map((n) => Math.round(n.x))).size).toBe(1);
  });

  test("keeps clear of a knowledge panel", async ({ page }) => {
    await open(page, { knowledgePanel: true });
    const s = await snapshot(page);
    const rhs = await page.evaluate(() => document.getElementById("rhs")!.getBoundingClientRect().left);
    for (const n of s.notes) expect(n.x + n.w).toBeLessThanOrEqual(rhs + 0.5);
    expectAligned(s, DEFAULT_RESULTS.length);
  });

  test("degrades to a smaller control instead of being clipped", async ({ page }) => {
    await page.setViewportSize({ width: 880, height: 800 });
    await open(page);
    const s = await snapshot(page);
    expect(s.mode).not.toBe("card");
    for (const n of s.notes) expect(n.x + n.w).toBeLessThanOrEqual(880);
    expectAligned(s, DEFAULT_RESULTS.length);
  });

  test("a clipping column pushes the note inside it, still level with the title", async ({ page }) => {
    await open(page, { clipColumn: true });
    const s = await snapshot(page);
    expect(s.mode).toBe("inset");
    const col = await page.evaluate(() => document.getElementById("center_col")!.getBoundingClientRect().right);
    for (const n of s.notes) expect(n.x + n.w).toBeLessThanOrEqual(col + 0.5);
    for (const [i, t] of s.titles.entries()) expect(Math.abs(cy(s.notes[i]!) - cy(t))).toBeLessThan(1);
  });

  test("re-aligns when the window is resized", async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 1000, height: 800 });
    await settle(page);
    expectAligned(await snapshot(page), DEFAULT_RESULTS.length);
  });

  test("re-aligns when Google's own content above the results changes", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const bar = document.createElement("div");
      bar.style.cssText = "height:120px";
      document.getElementById("center_col")!.prepend(bar);
    });
    await settle(page);
    expectAligned(await snapshot(page), DEFAULT_RESULTS.length);
  });

  test("re-aligns when a title grows (font load, zoom, A/B change)", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>("h3").forEach((h, i) => {
        if (i === 1) h.style.cssText = "font-size:34px;line-height:44px";
      });
    });
    await settle(page);
    expectAligned(await snapshot(page), DEFAULT_RESULTS.length);
  });

  test("a wrapping title is aligned to its first line", async ({ page }) => {
    await open(page);
    const s = await snapshot(page);
    const wrapped = await page.evaluate(() => [...document.querySelectorAll("h3")].map((h) => h.getBoundingClientRect().height > 40));
    expect(wrapped.some(Boolean)).toBe(true);
    expectAligned(s, DEFAULT_RESULTS.length);
  });

  test("People-also-ask rows are not numbered and do not break alignment", async ({ page }) => {
    await open(page, { paa: true });
    const s = await snapshot(page);
    expect(s.badges).toHaveLength(DEFAULT_RESULTS.length);
    expectAligned(s, DEFAULT_RESULTS.length);
  });
});

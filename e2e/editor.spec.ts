import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { serpPage, type PageOpts } from "./fixtures";

const BUNDLE = readFileSync(resolve(process.cwd(), "dist/contentScript.js"), "utf8");

async function open(page: Page, opts: PageOpts = {}, seed: Record<string, unknown> = {}): Promise<void> {
  await page.setContent(serpPage(opts));
  await page.evaluate((s) => Object.assign((window as never as { __mem: object }).__mem, s), seed);
  await page.addScriptTag({ content: BUNDLE });
  await page.waitForSelector("serp-counter-host", { state: "attached" });
  await page.waitForTimeout(300);
}

/** Playwright's CSS engine pierces open shadow roots, so these locators reach into them. */
const chip = (page: Page, i = 0) => page.locator("serp-counter-host").nth(i).locator(".rail .chip");
const app = (page: Page) => page.locator("#serp-counter-app");

test.describe("note editor", () => {
  test("add a note from the empty chip, then it shows as a card level with the title", async ({ page }) => {
    await open(page);
    await chip(page, 1).click();
    const editor = app(page).locator(".editor");
    await expect(editor).toBeVisible();
    await expect(editor.locator("textarea")).toBeFocused();
    await expect(editor.locator(".ed-host")).toHaveText("comparethemarket.com");
    await expect(editor.getByRole("button", { name: "Whole site" })).toHaveAttribute("aria-pressed", "true");

    await editor.locator("textarea").fill("Strong backlinks, check pricing");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(editor).toBeHidden();

    const card = page.locator("serp-counter-host").nth(1).locator(".card");
    await expect(card.locator(".card-text")).toHaveText("Strong backlinks, check pricing");
    await expect(card.locator(".tag")).toHaveText("Site");

    const [head, title] = await Promise.all([
      card.locator(".card-head").boundingBox(),
      page.locator("h3").nth(1).boundingBox(),
    ]);
    // card header is level with the first line of the title (26px line box in the fixture)
    expect(Math.abs(head!.y + head!.height / 2 - (title!.y + 13))).toBeLessThan(1.5);
  });

  test("whole-site notes show on other results of the same host and persist", async ({ page }) => {
    await open(page);
    await chip(page, 0).click();
    const editor = app(page).locator(".editor");
    await editor.getByRole("button", { name: "Whole site" }).click();
    await expect(editor.locator(".hint")).toContainText("every page of reboxed.co");
    await editor.locator("textarea").fill("Site wide");
    await editor.getByRole("button", { name: "Save" }).click();
    expect(await page.evaluate(() => (window as never as { __mem: Record<string, unknown> }).__mem["n:s:reboxed.co"])).toBe("Site wide");
    await expect(page.locator("serp-counter-host").nth(0).locator(".card .tag")).toHaveText("Site");
  });

  test("Escape cancels without saving and returns focus to the control", async ({ page }) => {
    await open(page);
    await chip(page, 0).click();
    await app(page).locator("textarea").fill("draft");
    await page.keyboard.press("Escape");
    await expect(app(page).locator(".editor")).toBeHidden();
    const mem = await page.evaluate(() => Object.keys((window as never as { __mem: object }).__mem));
    expect(mem.some((k) => k.startsWith("n:"))).toBe(false);
    const focused = await page.evaluate(() => {
      const host = document.querySelector("serp-counter-host");
      return host?.shadowRoot?.activeElement?.className ?? "";
    });
    expect(focused).toContain("chip");
  });

  test("clicking outside saves, deleting removes", async ({ page }) => {
    await open(page);
    await chip(page, 0).click();
    await app(page).locator("textarea").fill("saved by outside click");
    await page.mouse.click(5, 5);
    await expect(page.locator("serp-counter-host").nth(0).locator(".card-text")).toHaveText("saved by outside click");

    await page.locator("serp-counter-host").nth(0).locator(".card-head").click();
    await app(page).locator(".icon-btn.danger").click();
    await expect(page.locator("serp-counter-host").nth(0).locator(".card")).toHaveCount(0);
  });

  test("opens right under the control that was clicked, not at the top of the window", async ({ page }) => {
    await open(page, {}, { "n:s:comparethemarket.com": "A note" });
    const head = await page.locator("serp-counter-host").nth(1).locator(".card-head").boundingBox();
    await page.locator("serp-counter-host").nth(1).locator(".card-head").click();
    const box = await app(page).locator(".popover").boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(head!.y + head!.height);
    expect(box!.y).toBeLessThan(head!.y + head!.height + 20);
  });

  test("stays inside the viewport when opened near the bottom-right corner", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 420 });
    await open(page);
    await chip(page, 3).scrollIntoViewIfNeeded();
    await chip(page, 3).click();
    const box = await app(page).locator(".popover").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1000);
  });

  test("a long note collapses to whole lines and can be expanded over the next results", async ({ page }) => {
    const long = Array.from({ length: 14 }, (_, i) => `Line ${i + 1} of a long competitor analysis note`).join("\n");
    await open(page, {}, { "n:s:comparethemarket.com": long });
    const host = page.locator("serp-counter-host").nth(1);
    const card = host.locator(".card");
    await expect(card.locator(".card-more")).toHaveText(/Show more/);
    const collapsed = await card.boundingBox();
    const resultBottom = await page.locator("[data-hveid]").nth(1).evaluate((e) => e.getBoundingClientRect().bottom);
    // collapsed, the card stops above the next result's Note control
    const nextChip = await page.locator("serp-counter-host").nth(2).locator(".rail .chip").boundingBox();
    expect(collapsed!.y + collapsed!.height).toBeLessThanOrEqual(nextChip!.y);

    await card.locator(".card-more").click();
    await expect(card.locator(".card-more")).toHaveText(/Show less/);
    const expanded = await card.boundingBox();
    expect(expanded!.height).toBeGreaterThan(collapsed!.height);
    // expanding floats over the page: Google's own layout is untouched
    const next = await page.locator("[data-hveid]").nth(2).boundingBox();
    expect(next!.y).toBeGreaterThan(resultBottom);
  });
});

test.describe("badge colours", () => {
  test("applying new colours restyles every badge and persists", async ({ page }) => {
    await open(page);
    await page.locator("serp-counter-host").nth(0).locator(".badge").click();
    const dialog = app(page).locator(".colors");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Violet" }).click();
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toBeHidden();
    for (let i = 0; i < 3; i++) {
      const bg = await page.locator("serp-counter-host").nth(i).locator(".badge").evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(bg).toBe("rgb(124, 58, 237)");
    }
    expect(await page.evaluate(() => (window as never as { __mem: Record<string, unknown> }).__mem.theme)).toEqual({
      bg: "#7c3aed",
      text: "#ffffff",
    });
  });

  test("invalid colours cannot be applied", async ({ page }) => {
    await open(page);
    await page.locator("serp-counter-host").nth(0).locator(".badge").click();
    const dialog = app(page).locator(".colors");
    await dialog.getByLabel("Background colour hex").fill("javascript:1");
    await expect(dialog.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});

test.describe("theme", () => {
  test("the interface follows the Google page theme", async ({ page }) => {
    await open(page, { dark: true });
    const theme = await page.locator("serp-counter-host").first().locator(".ui").getAttribute("data-theme");
    expect(theme).toBe("dark");
  });

  test("and is light on a light page", async ({ page }) => {
    await open(page);
    const theme = await page.locator("serp-counter-host").first().locator(".ui").getAttribute("data-theme");
    expect(theme).toBe("light");
  });
});

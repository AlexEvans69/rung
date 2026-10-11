import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { serpPage } from "./fixtures";

const BUNDLE = readFileSync(resolve(process.cwd(), "dist/contentScript.js"), "utf8");

async function open(page: Page, seed: Record<string, unknown> = {}): Promise<void> {
  await page.setContent(serpPage());
  await page.evaluate((s) => Object.assign((window as never as { __mem: object }).__mem, s), seed);
  await page.addScriptTag({ content: BUNDLE });
  await page.waitForTimeout(300);
}

const setSettings = (page: Page, settings: object) =>
  page.evaluate((s) => (window as never as { chrome: typeof chrome }).chrome.storage.local.set({ settings: s }), settings);

const counts = (page: Page) =>
  page.evaluate(() => {
    const hosts = [...document.querySelectorAll("serp-counter-host")];
    return {
      hosts: hosts.length,
      badges: hosts.filter((h) => h.shadowRoot?.querySelector(".badge")).length,
      notes: hosts.filter((h) => h.shadowRoot?.querySelector(".note-btn")).length,
    };
  });

test.describe("toolbar settings apply live", () => {
  test("both features are on by default", async ({ page }) => {
    await open(page);
    expect(await counts(page)).toEqual({ hosts: 5, badges: 5, notes: 5 });
  });

  test("numbering off hides badges, keeps notes", async ({ page }) => {
    await open(page);
    await setSettings(page, { numbering: false, notes: true });
    await page.waitForTimeout(150);
    expect(await counts(page)).toEqual({ hosts: 5, badges: 0, notes: 5 });
  });

  test("notes off hides the Note controls, keeps badges", async ({ page }) => {
    await open(page);
    await setSettings(page, { numbering: true, notes: false });
    await page.waitForTimeout(150);
    expect(await counts(page)).toEqual({ hosts: 5, badges: 5, notes: 0 });
  });

  test("both off removes everything from the page, and back on restores it", async ({ page }) => {
    await open(page);
    await setSettings(page, { numbering: false, notes: false });
    await page.waitForTimeout(150);
    expect(await counts(page)).toEqual({ hosts: 0, badges: 0, notes: 0 });
    await setSettings(page, { numbering: true, notes: true });
    await page.waitForTimeout(300);
    expect(await counts(page)).toEqual({ hosts: 5, badges: 5, notes: 5 });
  });

  test("starts with the saved preference, no flash of the disabled feature", async ({ page }) => {
    await open(page, { settings: { numbering: true, notes: false } });
    expect(await counts(page)).toEqual({ hosts: 5, badges: 5, notes: 0 });
  });

  test("an open note editor closes when notes are switched off", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      document.querySelector("serp-counter-host")?.shadowRoot?.querySelector<HTMLElement>(".note-btn")?.click();
    });
    await page.waitForTimeout(100);
    const editor = () => page.evaluate(() => !!document.getElementById("serp-counter-app")?.shadowRoot?.querySelector("textarea"));
    expect(await editor()).toBe(true);
    await setSettings(page, { numbering: true, notes: false });
    await page.waitForTimeout(150);
    expect(await editor()).toBe(false);
  });
});

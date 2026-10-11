import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { serpPage } from "./fixtures";

const EXT = resolve(process.cwd(), "dist");

/** Unpacked extension id = first 32 hex chars of sha256(path), mapped 0-9a-f -> a-p. */
const extId = (p: string) =>
  createHash("sha256").update(p).digest("hex").slice(0, 32).replace(/[0-9a-f]/g, (c) => String.fromCharCode("a".charCodeAt(0) + parseInt(c, 16)));

/** Loads the built extension (dist/) into real Chromium, the same files the zip contains. */
test("the built extension loads in real Chromium and works on a google.com/search page", async () => {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "rung-")), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  try {
    await ctx.route("https://www.google.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: serpPage({ query: "refurbished smartphones" }) }),
    );
    const page = await ctx.newPage();
    await page.goto("https://www.google.com/search?q=refurbished+smartphones");
    await page.waitForSelector("serp-counter-host", { state: "attached", timeout: 8000 });
    await page.waitForTimeout(500);
    const info = await page.evaluate(() => {
      const hosts = [...document.querySelectorAll("serp-counter-host")];
      return {
        hosts: hosts.length,
        badges: hosts.map((h) => h.shadowRoot?.querySelector(".badge")?.textContent?.trim()),
        chips: hosts.filter((h) => h.shadowRoot?.querySelector(".rail")).length,
      };
    });
    expect(info.badges).toEqual(["1", "2", "3", "4", "5"]);
    expect(info.chips).toBe(5);

    // add a note through the real UI and see it persist in real chrome.storage
    await page.locator("serp-counter-host").first().locator(".chip").click();
    await page.locator("#serp-counter-app textarea").fill("persisted by real storage");
    await page.locator("#serp-counter-app").getByRole("button", { name: "Save" }).click();
    await expect(page.locator("serp-counter-host").first().locator(".card-text")).toHaveText("persisted by real storage");
    await page.reload();
    await expect(page.locator("serp-counter-host").first().locator(".card-text")).toHaveText("persisted by real storage");

    // the toolbar popup page opens with the new brand
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId(EXT)}/popup.html`);
    await expect(popup.locator(".head h1")).toContainText("Rung");
    await expect(popup.locator(".head .logo svg")).toHaveCount(1);
    await expect(popup.locator(".foot")).toContainText("1 note saved");
  } finally {
    await ctx.close();
  }
});

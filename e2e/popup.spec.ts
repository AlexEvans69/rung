import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const DIST = resolve(process.cwd(), "dist");
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

async function openPopup(page: Page, seed: Record<string, unknown> = {}, query = ""): Promise<void> {
  await page.route("http://ext.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "popup.html";
    const file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
  });
  await page.addInitScript((s) => {
    const mem: Record<string, unknown> = { ...s };
    const listeners: ((c: object, a: string) => void)[] = [];
    const cp = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
    (window as never as { chrome: object }).chrome = {
      runtime: { id: "x", getManifest: () => ({ version: "9.9.9" }), getURL: (p: string) => "http://ext.test/" + p },
      storage: {
        local: {
          get: async () => cp(mem),
          set: async (o: Record<string, unknown>) => {
            const ch: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(o)) {
              mem[k] = cp(v);
              ch[k] = { newValue: cp(v) };
            }
            listeners.forEach((f) => f(ch, "local"));
          },
          remove: async () => undefined,
        },
        onChanged: { addListener: (f: never) => listeners.push(f), removeListener: () => undefined },
      },
    };
    (window as never as { __mem: object }).__mem = mem;
  }, seed);
  await page.goto("http://ext.test/popup.html" + query);
  await page.waitForSelector(".popup");
}

const mem = (page: Page) => page.evaluate(() => (window as never as { __mem: Record<string, unknown> }).__mem);

test.describe("toolbar popup", () => {
  test("links the author's other tool once, in a new tab and without leaking the opener", async ({ page }) => {
    await openPopup(page);
    const link = page.locator(".also a");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveText("allclicks");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const href = new URL((await link.getAttribute("href"))!);
    expect(href.origin).toBe("https://allclicks.net");
    expect(href.searchParams.get("utm_source")).toBe("rung");
    await expect(page.locator(".also")).toContainText("Also by the author");
  });

  test("links the tip jar in a new tab and without leaking the opener", async ({ page }) => {
    await openPopup(page);
    const link = page.locator(".support a");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", "https://buymeacoffee.com/alexevans69");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("shows both switches on by default and the version", async ({ page }) => {
    await openPopup(page);
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(2);
    await expect(page.getByRole("switch", { name: "Numbering" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Notes" })).toHaveAttribute("aria-checked", "true");
    await expect(page.locator(".head")).toContainText("v9.9.9");
    await expect(page.locator(".head h1")).toContainText("Rung");
    await expect(page.locator(".head .logo svg")).toHaveCount(1);
    // the logo is laid out inside the header (a dropped CSS rule once let it overlap the labels)
    const logo = await page.locator(".head .logo svg").boundingBox();
    expect(Math.round(logo!.width)).toBe(32);
    expect(Math.round(logo!.height)).toBe(32);
    const title = await page.locator(".head h1").boundingBox();
    expect(logo!.x + logo!.width).toBeLessThanOrEqual(title!.x + 0.5);
  });

  test("toggling a switch is saved immediately", async ({ page }) => {
    await openPopup(page);
    await page.getByRole("switch", { name: "Notes" }).click();
    await expect(page.getByRole("switch", { name: "Notes" })).toHaveAttribute("aria-checked", "false");
    expect((await mem(page)).settings).toEqual({ numbering: true, notes: false });
  });

  test("reflects stored preferences and note count", async ({ page }) => {
    await openPopup(page, {
      settings: { numbering: false, notes: true },
      "n:u:https://a.example/": "one",
      "n:s:b.example": "two",
    });
    await expect(page.getByRole("switch", { name: "Numbering" })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(".foot")).toContainText("2 notes saved");
  });

  test("a preset changes the saved badge colour", async ({ page }) => {
    await openPopup(page);
    await page.getByRole("button", { name: "Violet" }).click();
    expect((await mem(page)).theme).toEqual({ bg: "#7c3aed", text: "#ffffff" });
    await expect(page.getByRole("button", { name: "Violet" })).toHaveClass(/selected/);
  });

  test("imports a backup in a tab and rejects garbage", async ({ page }) => {
    await openPopup(page, {}, "?tab=1");
    const backup = {
      app: "serp-counter-tool",
      version: 1,
      notes: { url: { "https://a.example/x": "hello" }, site: { "b.example": "world" } },
    };
    await page.locator("input[type=file]").setInputFiles({
      name: "notes.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.locator(".status")).toContainText("Imported 2 notes");
    const stored = await mem(page);
    expect(stored["n:u:https://a.example/x"]).toBe("hello");
    expect(stored["n:s:b.example"]).toBe("world");

    await page.locator("input[type=file]").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{nope"),
    });
    await expect(page.locator(".status")).toContainText("isn't valid JSON");
  });
});

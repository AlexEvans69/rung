/**
 * Generates the Chrome Web Store images into store/ (screenshots 1280x800, small promo tile
 * 440x280, marquee 1400x560). Content is fictional on purpose: no third-party brands.
 *
 *   npm run store-assets
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { serpPage, type ResultSpec } from "./fixtures";

test.skip(!process.env.STORE_ASSETS, "run with `npm run store-assets`");
test.describe.configure({ mode: "serial" });

const ROOT = process.cwd();
const OUT = resolve(ROOT, "store");
const DIST = resolve(ROOT, "dist");
const BUNDLE = readFileSync(join(DIST, "contentScript.js"), "utf8");
const LOCKUP = readFileSync(resolve(ROOT, "brand/rung-lockup-on-dark.svg"), "utf8").replace(/ width="[\d.]+" height="[\d.]+"/, "");
mkdirSync(OUT, { recursive: true });

const QUERY = "buy iphone";

/** Fictional shops (.example domains), no thumbnails: nothing here is a real site or image. */
const RESULTS: ResultSpec[] = [
  {
    host: "iphonedeals.example",
    title: "Buy iPhone: current models, prices and storage options",
    snippet: "Compare iPhone models side by side, check trade-in values and choose pickup or free delivery. Finance available on all new phones.",
    rating: true,
  },
  {
    host: "mobilestore.example",
    title: "iPhone with free delivery: buy online or in store",
    snippet: "Order today and get your new iPhone next day. Every phone is sealed, comes with a 12-month warranty and 30-day returns.",
  },
  {
    host: "refurbished-phones.example",
    title: "Refurbished iPhone: certified, tested and 40% off",
    snippet: "Each device passes a 60-point inspection, gets a new battery and ships with a 12-month warranty. Same iPhone, lower price.",
    rating: true,
  },
  {
    host: "network-direct.example",
    title: "iPhone contracts and SIM-free deals",
    snippet: "Pick a plan, add the phone you want and see your monthly cost before you check out.",
    sitelinks: true,
  },
  {
    host: "phone-guide.example",
    title: "How to buy the right iPhone: a buyer's guide",
    snippet: "Which model, how much storage and whether to buy new or refurbished: a short guide to spending less and getting more.",
  },
];

const SEED = {
  "n:s:mobilestore.example": "Main competitor. Strong product pages, thin guides: we can beat them on the buying guide.",
  "n:u:https://iphonedeals.example/p0": "Ranks #1 for the money query. Check their schema markup and the FAQ block.",
  "n:s:refurbished-phones.example": "Affiliate site.",
};

async function openSerp(page: Page, dark: boolean): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(serpPage({ results: RESULTS, dark, query: QUERY }));
  await page.evaluate((s) => Object.assign((window as never as { __mem: object }).__mem, s), SEED);
  await page.addScriptTag({ content: BUNDLE });
  await page.waitForSelector("serp-counter-host", { state: "attached" });
  await page.waitForTimeout(500);
}

const shot = (page: Page, name: string) => page.screenshot({ path: join(OUT, name) });
const host = (page: Page, i: number) => page.locator("serp-counter-host").nth(i);

test("1 results, light", async ({ page }) => {
  await openSerp(page, false);
  await shot(page, "screenshot-1-results.png");
});

test("2 results, dark", async ({ page }) => {
  await openSerp(page, true);
  await shot(page, "screenshot-2-dark.png");
});

test("3 note editor", async ({ page }) => {
  await openSerp(page, false);
  await host(page, 1).locator(".card-head").click();
  await expect(page.locator("#serp-counter-app .editor")).toBeVisible();
  await shot(page, "screenshot-3-note-editor.png");
});

test("4 badge colours", async ({ page }) => {
  await openSerp(page, true);
  await host(page, 0).locator(".badge").click();
  await page.locator("#serp-counter-app .colors").getByRole("button", { name: "Violet" }).click();
  await shot(page, "screenshot-4-colours.png");
});

test("5 toolbar popup", async ({ page }) => {
  await page.route("http://ext.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "popup.html";
    const file = join(DIST, path);
    const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    return existsSync(file)
      ? route.fulfill({ body: readFileSync(file), contentType: types[extname(file)] ?? "application/octet-stream" })
      : route.fulfill({ status: 404 });
  });
  await page.addInitScript(() => {
    if (location.hostname !== "ext.test") return;
    const mem: Record<string, unknown> = { "n:s:a.example": "x", "n:u:https://b.example/": "y", "n:s:c.example": "z", "n:s:d.example": "w" };
    (window as never as { chrome: object }).chrome = {
      runtime: { id: "x", getManifest: () => ({ version: "4.2.0" }), getURL: (p: string) => "http://ext.test/" + p },
      storage: {
        local: { get: async () => JSON.parse(JSON.stringify(mem)), set: async () => undefined, remove: async () => undefined },
        onChanged: { addListener() {}, removeListener() {} },
      },
    };
  });
  await openSerp(page, false);
  await page.evaluate(() => {
    const frame = document.createElement("iframe");
    frame.src = "http://ext.test/popup.html";
    frame.style.cssText =
      "position:fixed;top:16px;right:32px;width:320px;height:372px;border:1px solid rgba(0,0,0,.14);border-radius:14px;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.25);z-index:2147483647";
    document.body.appendChild(frame);
  });
  await page.waitForTimeout(600);
  await shot(page, "screenshot-5-toolbar.png");
});

function promoHtml(width: number, height: number, withShot: boolean): string {
  const shotData = withShot
    ? `data:image/png;base64,${readFileSync(join(OUT, "screenshot-1-results.png")).toString("base64")}`
    : "";
  const big = width > 1000;
  return `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#12163b;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:${withShot ? "space-between" : "center"};gap:${big ? 56 : 22}px;padding:${big ? "0 72px" : "0 28px"}}
.l{flex:none;display:flex;flex-direction:column;gap:${big ? 28 : 16}px}
.lockup svg{width:${big ? 460 : 300}px;height:auto;display:block}
p{margin:0;font-size:${big ? 27 : 16}px;color:#c9caf5;line-height:1.4;max-width:${big ? 460 : 330}px}
.s{flex:none;width:${big ? 700 : 0}px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 24px 56px rgba(0,0,0,.45);display:${withShot ? "block" : "none"}}
.s img{width:100%;display:block}
</style><div class="l"><div class="lockup">${LOCKUP}</div><p>Counts SERP for you.</p></div>
<div class="s">${withShot ? `<img src="${shotData}">` : ""}</div>`;
}

test("6 promo tiles", async ({ page }) => {
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(promoHtml(440, 280, false));
  await page.screenshot({ path: join(OUT, "promo-small-440x280.png") });

  await page.setViewportSize({ width: 1400, height: 560 });
  await page.setContent(promoHtml(1400, 560, true));
  await page.screenshot({ path: join(OUT, "promo-marquee-1400x560.png") });
});

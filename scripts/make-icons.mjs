/**
 * Renders brand/*.svg to the PNG icons the extension ships (16/32/48/128).
 * Run with: node scripts/make-icons.mjs   (needs `npx playwright install chromium` once)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = (name) => readFileSync(resolve(root, "brand", name), "utf8");

/** Small sizes use the chunkier mark so the rails stay crisp. */
const SIZES = [
  { size: 16, source: "rung-small.svg" },
  { size: 32, source: "rung-small.svg" },
  { size: 48, source: "rung.svg" },
  { size: 128, source: "rung.svg" },
];

const out = resolve(root, "public/icons");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const { size, source } of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg(source)}`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve(out, `icon${size}.png`), png);
  await page.close();
  console.log(`icon${size}.png`);
}
await browser.close();

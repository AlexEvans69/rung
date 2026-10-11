/**
 * Renders brand/rung-mark-indigo.svg to the PNG icons the extension ships.
 *   16/32/48: the mark fills the canvas
 *   128:      Chrome Web Store layout, a 96x96 mark inside 16px of transparent padding
 * Run with: node scripts/make-icons.mjs   (needs `npx playwright install chromium` once)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mark = readFileSync(resolve(root, "brand/rung-mark-indigo.svg"), "utf8").replace(/ width="\d+" height="\d+"/, "");
const out = resolve(root, "public/icons");
mkdirSync(out, { recursive: true });

const SIZES = [
  { size: 16, inner: 16, offset: 0 },
  { size: 32, inner: 32, offset: 0 },
  { size: 48, inner: 48, offset: 0 },
  { size: 128, inner: 96, offset: 16 },
];

const browser = await chromium.launch();
for (const { size, inner, offset } of SIZES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px}</style>${mark}`,
  );
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(resolve(out, `icon${size}.png`), png);
  await page.close();
  console.log(`icon${size}.png`);
}
await browser.close();

/**
 * Crops a real browser screenshot to the Chrome Web Store size (1280x800, no alpha).
 *   node scripts/crop-screenshot.mjs <input> <output> <x> <y> <width> <height>
 * The crop box should be 16:10; it is scaled to 1280x800.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { chromium } from "@playwright/test";

const [input, output, x, y, w, h] = process.argv.slice(2);
if (!input || !output || [x, y, w, h].some((v) => v === undefined)) {
  console.error("usage: crop-screenshot.mjs <input> <output> <x> <y> <width> <height>");
  process.exit(1);
}
const mime = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }[extname(input).toLowerCase()];
const data = `data:${mime};base64,${readFileSync(input).toString("base64")}`;
const scale = 1280 / Number(w);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(`<style>html,body{margin:0;background:#fff}</style>
<div style="width:1280px;height:800px;overflow:hidden;position:relative">
  <img id="i" src="${data}" style="position:absolute;left:${-Number(x) * scale}px;top:${-Number(y) * scale}px;width:var(--w)">
</div>`);
await page.evaluate((s) => {
  const img = document.getElementById("i");
  return new Promise((res) => {
    const set = () => {
      img.style.setProperty("--w", img.naturalWidth * s + "px");
      res();
    };
    if (img.complete) set();
    else img.onload = set;
  });
}, scale);
await page.screenshot({ path: output, clip: { x: 0, y: 0, width: 1280, height: 800 } });
await browser.close();
console.log("wrote", output);

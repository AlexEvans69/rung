import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_DOMAINS } from "../src/google-domains";
import { BRAND } from "../src/brand";
import { ICON_SIZES, createManifest } from "../src/manifest";

const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { version: string };

describe("manifest", () => {
  const manifest = createManifest(pkg.version);
  const script = manifest.content_scripts[0]!;

  it("is Manifest V3 and uses the package version", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(pkg.version);
  });

  it("requests only the storage permission and no host permissions", () => {
    expect(manifest.permissions).toEqual(["storage"]);
    expect(manifest).not.toHaveProperty("host_permissions");
  });

  it("runs only on search result pages", () => {
    expect(script.matches.length).toBe(GOOGLE_DOMAINS.length);
    for (const pattern of script.matches) expect(pattern).toMatch(/^\*:\/\/www\.google\.[a-z.]+\/search\*$/);
    expect(script.matches).toContain("*://www.google.com/search*");
  });

  it("has no duplicate domains", () => {
    expect(new Set(GOOGLE_DOMAINS).size).toBe(GOOGLE_DOMAINS.length);
  });

  it("is branded Rung, with a store-friendly title and summary", () => {
    expect(manifest.name).toBe(BRAND.storeTitle);
    expect(manifest.name.startsWith("Rung")).toBe(true);
    expect(manifest.name.length).toBeLessThanOrEqual(75);
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it("never puts a third-party trademark in the extension's name", () => {
    expect(manifest.name.toLowerCase()).not.toContain("google");
  });

  it("ships every icon size the store and toolbar need, with the right pixel size", () => {
    expect([...ICON_SIZES]).toEqual([16, 32, 48, 128]);
    for (const size of ICON_SIZES) {
      const file = resolve(process.cwd(), "public/icons", `icon${size}.png`);
      expect(existsSync(file), `icon${size}.png`).toBe(true);
      const png = readFileSync(file);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
      expect(manifest.icons[String(size)]).toBe(`icons/icon${size}.png`);
      expect(manifest.action.default_icon[String(size)]).toBe(`icons/icon${size}.png`);
    }
  });

  it("declares the toolbar popup", () => {
    expect(manifest.action.default_popup).toBe("popup.html");
  });

  it("references the built script and icon", () => {
    expect(script.js).toEqual(["contentScript.js"]);
  });
});

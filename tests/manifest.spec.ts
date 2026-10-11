import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_DOMAINS } from "../src/google-domains";
import { createManifest } from "../src/manifest";

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

  it("references the built script and icon", () => {
    expect(script.js).toEqual(["contentScript.js"]);
    expect(manifest.icons["128"]).toBe("icons/icon128.png");
  });
});
